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

  // ==========================================================================
  // SEQUENCE DIAGRAMS — the per-theme SVG encoding pass, 4 September 2026
  //
  // WHY IT EXISTS. The item 70 graphical checklist measured all nine selectable
  // theme/mode combinations and found sequence had NO encoding pass at all:
  // applySeriesEncoding returned null for every sequence subject while
  // returning an object for a gantt in the same run. The consequence is
  // recorded per cell in that report — 80 of 122 graphical objects
  // indistinguishable in accessibleDark (actor boundaries, lifelines, note
  // borders, block frames and label tags painted #000000 on a #2e282a ground,
  // 1.45:1), 80 / 76 / 47 of 122 in default, neutral and forest, and autonumber
  // digits at 1.00:1 in wcagLight, where the theme paints black glyphs on a
  // black disc.
  //
  // THREE FACTS MEASURED BEFORE ANY EDIT, each of which decides a mechanism:
  //
  //  1. EVERY COLOUR MERMAID GIVES A SEQUENCE DIAGRAM IS DECLARED AS A CLASS
  //     RULE IN ITS OWN IN-SVG <style> BLOCK — `#<id> .actor{stroke:…;fill:…}`,
  //     `.actor-line`, `.messageLine0/1`, `#arrowhead path`, `.sequenceNumber`,
  //     `.labelBox`, `.loopLine`, `.note`, `.activation0/1/2`. A presentation
  //     attribute is therefore INERT (standard rule 5, the xychart casing
  //     lesson). Every write below is an inline style.
  //
  //  2. NONE OF THOSE RULES CARRIES `!important`, and no page stylesheet reaches
  //     inside the diagram SVG at all — light.css and dark.css declare only
  //     `.mermaid-description …` panel rules. So a PLAIN inline style wins here,
  //     unlike gantt's labels, which need their own `important` priority to beat
  //     `.doneText0{fill:#000000!important}`. Verified at the computed value
  //     rather than assumed.
  //
  //  3. MARKER REFERENCES ARE ATTRIBUTES (`marker-end="url(#arrowhead)"`), the
  //     markers live in <defs>, and their ids are NOT chart-scoped: measured on
  //     a four-diagram page, `arrowhead`, `crosshead`, `filled-head` and
  //     `sequencenumber` each appear FOUR times with the same id, so every
  //     diagram paints its arrowheads from the first diagram's defs. That is
  //     Mermaid's own id collision and this pass does not repair it — every
  //     diagram on a page shares one theme and therefore one ink, so the
  //     rendered result is right either way. It is recorded because a probe
  //     reading getComputedStyle on the second diagram's marker reports the
  //     value written there while the PIXELS come from the first diagram's.
  //     Marker readings are settled by rasterising, per the checklist's § 10.4.
  // ==========================================================================

  /** Marker Mermaid sets on a sequence diagram root and on nothing else. */
  const SEQUENCE_ROLEDESCRIPTION = "sequence";

  /** SC 1.4.11 for every outline, boundary and the autonumber disc. */
  const SEQUENCE_OBJECT_TARGET = 3;

  /** SC 1.4.3 for the autonumber digits against their disc. */
  const SEQUENCE_TEXT_TARGET = 4.5;

  /**
   * The OUTLINE INKS OF RECORD, from the presentation standard § 1.4 — the same
   * pair the bar outlines use, `#00131D` for light grounds and `#E1E8EC` for
   * dark. They are tried FIRST and used wherever they clear the target, so this
   * type reads as one system with xychart rather than inventing a second ink.
   *
   * Both are offered to every derivation rather than being selected by mode.
   * The GROUND is the evidence: an element sitting on the author's own light
   * region inside a dark diagram wants the light-ground ink, and a mode flag
   * would hand it the wrong one.
   */
  const SEQUENCE_OUTLINE_INKS = Object.freeze(["#00131D", "#E1E8EC"]);

  /**
   * Fallback ramp, used only where neither ink of record clears the target.
   *
   * 65 steps rather than gantt's 17 because the case that needs it is NARROW: an
   * element crossing the author's `rect rgb(230,230,250)` region inside a dark
   * diagram has to clear both `#e6e6fa` and `#2e282a` at once, and the whole
   * admissible band is a luminance window about 0.06 wide. A coarse ramp lands
   * on its edge; a fine one lands near the optimum.
   */
  const SEQUENCE_INK_RAMP = Object.freeze(
    Array.from({ length: 65 }, (unused, i) => {
      const v = Math.round((i * 255) / 64);
      return rgbToHex(v, v, v);
    })
  );

  /** Width of the boundary given to a region rect Mermaid draws with none. */
  const SEQUENCE_REGION_BOUNDARY_WIDTH = 2;

  /** Attribute marking the defs block this pass owns, so a re-run rebuilds it. */
  const SEQUENCE_ENCODING_ATTRIBUTE = "data-sequence-encoding";

  /** Where a line's ORIGINAL marker references are parked, for idempotency. */
  const SEQUENCE_MARKER_REFS = Object.freeze([
    "marker-start",
    "marker-mid",
    "marker-end",
  ]);
  const SEQUENCE_MARKER_PARK_PREFIX = "data-sequence-";

  /**
   * Paint properties carried from an original marker onto a clone.
   *
   * A cloned marker takes a new id, so Mermaid's `#<svg> #arrowhead path`
   * rules no longer reach it and anything not written here falls back to the
   * browser default rather than to the theme.
   */
  const SEQUENCE_MARKER_CARRIED = Object.freeze([
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "fill-opacity",
    "stroke-opacity",
  ]);

  /**
   * Every outline the checklist named, with the selector that matches it.
   *
   * `rect.actor` and not `.actor`: Mermaid overloads that class onto BOTH the
   * rect and the `<text>`, which is what made the checklist's first sweep read
   * actor labels as white on white. Painting `.actor` would put a stroke on the
   * label glyphs.
   */
  const SEQUENCE_OUTLINE_TARGETS = Object.freeze([
    { key: "actorBox", selector: "rect.actor" },
    { key: "actorFigure", selector: "g.actor-man line, g.actor-man circle" },
    { key: "lifeline", selector: "line.actor-line" },
    { key: "messageLine", selector: "line[class*='messageLine']", markers: true },
    { key: "activationBar", selector: "rect[class*='activation']" },
    { key: "noteBorder", selector: "rect.note" },
    { key: "blockFrame", selector: "line.loopLine" },
    { key: "blockLabelTag", selector: "polygon.labelBox" },
  ]);

  /**
   * A CSS opacity value as a number, defaulting only when it is not a number.
   *
   * `parseFloat(value) || 1` reads a declared `0` as fully opaque, which is the
   * one value that matters here — a region with `fill-opacity: 0` paints
   * nothing and must not be treated as a ground.
   *
   * @param {string} value - A computed opacity or fill-opacity
   * @returns {number} The value, or 1 when it is not a number
   */
  function opacityValue(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 1;
  }

  /**
   * Apply the accessibility encoding to a rendered sequence diagram: an outline
   * ink per element that clears the ground that element actually sits on, a
   * boundary on the region rects Mermaid draws with `stroke: none`, and an
   * autonumber disc and digit pair derived TOGETHER.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES — the gantt argument,
   * unchanged. Four of the nine selectable combinations are Mermaid BUILT-INS
   * (`default`, `neutral`, `forest`, `dark`), which applyTheme reaches as
   * `{'theme': '<id>'}` with no themeVariables at all, so a variable written
   * here could never reach them. A pass over the rendered SVG reaches all nine
   * by construction.
   *
   * WHY THE INK IS PER ELEMENT AND NOT PER DIAGRAM. Gantt derives ONE ink
   * clearing every band because a bar can move between bands as the chart
   * relayouts, so no stable per-object assignment exists. A sequence region is
   * a FIXED area, so each element's grounds can be resolved geometrically —
   * and doing so matters: measured, one ink clearing both `#2e282a` and the
   * author's `#e6e6fa` region can reach only 3.4:1, so a single-ink diagram
   * would drop every outline in a dark E5 from about 12:1 to about 3.3:1 to
   * rescue the two elements that cross the region. Per-element grounds keep the
   * 119 that never touch it at the ink of record.
   *
   * IDEMPOTENT BY CONSTRUCTION. Every derivation reads only the page
   * background and the region FILLS — never a property this pass writes — so a
   * re-run cannot read back its own output. The defs it owns are swept and
   * rebuilt, and each line's original marker references are parked in an
   * attribute and restored before any repointing.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applySequenceEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === SEQUENCE_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${SEQUENCE_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      logDebug("No sequence SVG in this container - sequence encoding skipped");
      return null;
    }

    const chartId = (svg.getAttribute("id") || "sequence").replace(
      /[^A-Za-z0-9_-]/g,
      "-"
    );
    const svgNS = "http://www.w3.org/2000/svg";

    // --- sweep what a previous run owned ------------------------------------
    const ownedDefs = svg.querySelector(`defs[${SEQUENCE_ENCODING_ATTRIBUTE}]`);
    if (ownedDefs) ownedDefs.remove();

    const parkMarkerRefs = (element) => {
      SEQUENCE_MARKER_REFS.forEach((ref) => {
        const key = SEQUENCE_MARKER_PARK_PREFIX + ref;
        if (element.getAttribute(key) === null) {
          element.setAttribute(key, element.getAttribute(ref) || "");
        }
      });
    };
    const restoreMarkerRefs = (element) => {
      SEQUENCE_MARKER_REFS.forEach((ref) => {
        const parked = element.getAttribute(SEQUENCE_MARKER_PARK_PREFIX + ref);
        if (parked === null) return;
        if (parked === "") element.removeAttribute(ref);
        else element.setAttribute(ref, parked);
      });
    };

    // --- grounds ------------------------------------------------------------
    const pageGround = resolveHostGround(svg);
    const background = svg.querySelector("rect.background");
    const svgGround = background
      ? paintToHex(
          compositeOver(
            parsePaint(window.getComputedStyle(background).fill),
            parsePaint(pageGround)
          )
        )
      : pageGround;

    // `rect.rect` carries TWO different things: the author's `rect rgb(...)`
    // highlight region, which has a fill and NO stroke, and the frame Mermaid
    // draws for a `box` participant grouping, which has a stroke and no fill.
    // They are told apart by whether anything is actually painted, and every
    // alpha is composited before a ratio is taken (standard rule 13).
    const regions = [...svg.querySelectorAll("rect.rect")].map((rect) => {
      const computed = window.getComputedStyle(rect);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);

      return {
        element: rect,
        painted: alpha > 0,
        ground: paintToHex(
          compositeOver(
            declared ? { ...declared, a: alpha } : null,
            parsePaint(svgGround)
          )
        ),
        box: rect.getBoundingClientRect(),
      };
    });

    const paintedRegions = regions.filter((region) => region.painted);
    const allGrounds = [
      ...new Set([svgGround, ...paintedRegions.map((region) => region.ground)]),
    ];

    const applied = {
      pageGround,
      svgGround,
      grounds: allGrounds,
      regions: regions.length,
      paintedRegions: paintedRegions.length,
      counts: {},
      inks: [],
      elements: [],
      markerSets: 0,
      warnings: [],
    };

    /**
     * The ink for a set of grounds: an ink of record where one clears the
     * target, otherwise the ramp entry maximising the WORST ratio (standard
     * rule 12 — an ink clearing one ground at 15:1 and another at 1.2:1 is
     * invisible on part of the diagram, and a mean would call that good).
     */
    const inkCache = new Map();
    const inkFor = (grounds) => {
      const key = grounds.join("|");
      if (inkCache.has(key)) return inkCache.get(key);

      const record = pickInkAgainst(SEQUENCE_OUTLINE_INKS, grounds);
      let chosen;
      if (record.worst >= SEQUENCE_OBJECT_TARGET) {
        chosen = { ink: record.ink, worst: record.worst, source: "record" };
      } else {
        const derived = pickInkAgainst(SEQUENCE_INK_RAMP, grounds);
        chosen = { ink: derived.ink, worst: derived.worst, source: "derived" };
        applied.warnings.push(
          `no ink of record clears ${SEQUENCE_OBJECT_TARGET}:1 against ${grounds.join(
            " + "
          )} (best ${Math.round(record.worst * 100) / 100}:1 with ${
            record.ink
          }); derived ${derived.ink} at ${
            Math.round(derived.worst * 100) / 100
          }:1 - a CANDIDATE for the standard's section 1.4`
        );
      }
      chosen = { ...chosen, worst: Math.round(chosen.worst * 100) / 100, grounds };
      inkCache.set(key, chosen);
      applied.inks.push(chosen);
      return chosen;
    };

    /**
     * The grounds one element sits on, resolved geometrically.
     *
     * An element wholly INSIDE a painted region sits on that region alone; one
     * that merely crosses it sits on both, and has to clear both.
     */
    const groundsForBox = (box) => {
      const inside = paintedRegions.find(
        (region) =>
          box.left >= region.box.left &&
          box.right <= region.box.right &&
          box.top >= region.box.top &&
          box.bottom <= region.box.bottom
      );
      if (inside) return [inside.ground];

      const grounds = [svgGround];
      paintedRegions.forEach((region) => {
        const misses =
          box.right <= region.box.left ||
          box.left >= region.box.right ||
          box.bottom <= region.box.top ||
          box.top >= region.box.bottom;
        if (!misses) grounds.push(region.ground);
      });
      return [...new Set(grounds)];
    };

    // --- the autonumber disc and its digits, DERIVED TOGETHER ---------------
    // The checklist's finding F3 is explicit that they cannot be derived apart:
    // each theme sets them independently, and wcagLight sets BOTH to black, so
    // a disc chosen for the ground alone can leave no readable digit. The disc
    // is therefore chosen subject to a digit ink still clearing 4.5:1 against
    // it — the same shape as gantt's patterned-label constraint.
    //
    // It is derived against EVERY ground rather than per element, because a
    // disc is drawn from a single <marker> and can land anywhere in the diagram.
    const permitsDigit = (candidate) =>
      PATTERN_INKS.some(
        (digitInk) =>
          calculateContrastRatio(digitInk, candidate) >= SEQUENCE_TEXT_TARGET
      );

    let disc = pickInkAgainst(SEQUENCE_OUTLINE_INKS, allGrounds, permitsDigit);
    let discSource = "record";
    if (disc.worst < SEQUENCE_OBJECT_TARGET) {
      disc = pickInkAgainst(SEQUENCE_INK_RAMP, allGrounds, permitsDigit);
      discSource = "derived";
    }
    if (disc.worst < SEQUENCE_OBJECT_TARGET) {
      // No candidate leaves a readable digit. The DIGIT wins — an unreadable
      // number is worse than a disc that reads at less than 3:1 — and the
      // shortfall is reported rather than swallowed.
      const relaxed = pickInkAgainst(SEQUENCE_INK_RAMP, allGrounds);
      applied.warnings.push(
        `no autonumber disc clears ${SEQUENCE_OBJECT_TARGET}:1 against ${allGrounds.join(
          " + "
        )} while leaving a digit at ${SEQUENCE_TEXT_TARGET}:1; using ${
          relaxed.ink
        } at ${Math.round(relaxed.worst * 100) / 100}:1`
      );
      disc = relaxed;
      discSource = "relaxed";
    }
    const digit = pickInkAgainst(PATTERN_INKS, [disc.ink]);
    if (digit.worst < SEQUENCE_TEXT_TARGET) {
      applied.warnings.push(
        `autonumber digit ${digit.ink} reaches only ${
          Math.round(digit.worst * 100) / 100
        }:1 against the disc ${disc.ink}`
      );
    }
    applied.autonumber = {
      disc: disc.ink,
      discSource,
      discOnGround: Math.round(disc.worst * 100) / 100,
      digit: digit.ink,
      digitOnDisc: Math.round(digit.worst * 100) / 100,
    };

    // --- markers ------------------------------------------------------------
    // The originals carry the BASE ink — the one an element on the diagram
    // ground gets. A line needing a different ink gets a cloned set with
    // chart-scoped ids, so its arrowhead matches the line it terminates. The
    // clone also happens to be immune to the shared-id collision recorded in
    // the block comment above, which the originals are not.
    const baseInk = inkFor([svgGround]);
    const originalMarkers = [...svg.querySelectorAll("marker")];
    const encodingDefs = document.createElementNS(svgNS, "defs");
    encodingDefs.setAttribute(SEQUENCE_ENCODING_ATTRIBUTE, "true");

    const paintMarker = (marker, ink) => {
      marker.querySelectorAll("path, polygon, line").forEach((shape) => {
        const computed = window.getComputedStyle(shape);
        if (parsePaint(computed.fill)) shape.style.setProperty("fill", ink);
        if (parsePaint(computed.stroke)) shape.style.setProperty("stroke", ink);
      });
      // Every disc takes the autonumber ink whatever set it belongs to.
      marker
        .querySelectorAll("circle")
        .forEach((circle) => circle.style.setProperty("fill", disc.ink));
    };

    originalMarkers.forEach((marker) => paintMarker(marker, baseInk.ink));

    const markerSets = new Map();
    const markerSetFor = (ink) => {
      if (ink === baseInk.ink) return null;
      if (markerSets.has(ink)) return markerSets.get(ink);

      const slug = ink.replace(/[^0-9a-z]/gi, "").toLowerCase();
      const map = new Map();
      originalMarkers.forEach((marker) => {
        const id = marker.getAttribute("id");
        if (!id) return;
        const clone = marker.cloneNode(true);
        const cloneId = `${chartId}-seq-${slug}-${id}`;
        clone.setAttribute("id", cloneId);

        // THE CLONE'S PAINT IS CARRIED FROM THE ORIGINAL, NOT READ OFF THE
        // CLONE, and both halves of that are load-bearing.
        //
        // A detached node has NO computed style, so reading the clone before it
        // is inserted returns empty strings and every conditional write is
        // skipped — measured: the first version of this pass did exactly that
        // and left one arrowhead per dark cell at the base ink on the author's
        // region, 1.01:1, while every other reading was clean.
        //
        // And inserting it first would not be enough either. Mermaid's rules
        // are keyed on the marker's ID (`#<svg> #arrowhead path`), so a clone
        // with a new id matches NOTHING and would fall back to the browser
        // defaults for anything not written here.
        const from = marker.querySelectorAll("path, polygon, line, circle");
        const to = clone.querySelectorAll("path, polygon, line, circle");
        from.forEach((shape, index) => {
          const target = to[index];
          if (!target) return;
          const computed = window.getComputedStyle(shape);

          SEQUENCE_MARKER_CARRIED.forEach((property) => {
            const value = computed.getPropertyValue(property);
            if (value) target.style.setProperty(property, value);
          });

          if (target.tagName === "circle") {
            target.style.setProperty("fill", disc.ink);
            return;
          }
          if (parsePaint(computed.fill)) target.style.setProperty("fill", ink);
          if (parsePaint(computed.stroke)) {
            target.style.setProperty("stroke", ink);
          }
        });

        encodingDefs.appendChild(clone);
        map.set(id, cloneId);
      });

      markerSets.set(ink, map);
      return map;
    };

    const repointMarkers = (element, map) => {
      SEQUENCE_MARKER_REFS.forEach((ref) => {
        const value = element.getAttribute(ref);
        if (!value) return;
        const match = /^url\(#(.+)\)$/.exec(value.trim());
        if (!match) return;
        const cloneId = map.get(match[1]);
        if (cloneId) element.setAttribute(ref, `url(#${cloneId})`);
      });
    };

    // --- outlines -----------------------------------------------------------
    SEQUENCE_OUTLINE_TARGETS.forEach((target) => {
      const nodes = [...svg.querySelectorAll(target.selector)];
      applied.counts[target.key] = nodes.length;

      nodes.forEach((node) => {
        if (target.markers) {
          parkMarkerRefs(node);
          restoreMarkerRefs(node);
        }

        const grounds = groundsForBox(node.getBoundingClientRect());
        const chosen = inkFor(grounds);
        node.style.setProperty("stroke", chosen.ink);

        if (target.markers && chosen.ink !== baseInk.ink) {
          const map = markerSetFor(chosen.ink);
          if (map) repointMarkers(node, map);
        }

        applied.elements.push({
          key: target.key,
          ink: chosen.ink,
          source: chosen.source,
          grounds,
          worst: chosen.worst,
        });
      });
    });

    // --- region boundaries --------------------------------------------------
    // MERMAID DRAWS THE AUTHOR'S HIGHLIGHT REGION WITH `stroke: none`, so its
    // only channel is a fill the AUTHOR chose — measured at 1.21:1 against the
    // light ground in all nine cells, and carried by hue alone. The author's
    // fill stays the author's; what is added is the boundary Mermaid omitted.
    //
    // This is standard rule 16's move — synthesise what the renderer did not
    // draw, and say so — with one difference worth stating, because a later
    // reader cannot tell from the markup: gantt had NO element to style and a
    // <line> had to be inserted, whereas the rect here EXISTS and only its
    // boundary is missing, so the stroke is written onto Mermaid's own element
    // and no node is added to the tree.
    //
    // A boundary sits half inside the shape and half outside it, so it is
    // judged against BOTH the region's own composited ground and what is behind
    // the region.
    regions.forEach((region) => {
      const grounds = region.painted
        ? [...new Set([region.ground, svgGround])]
        : [svgGround];
      const chosen = inkFor(grounds);
      region.element.style.setProperty("stroke", chosen.ink);
      region.element.style.setProperty(
        "stroke-width",
        `${SEQUENCE_REGION_BOUNDARY_WIDTH}px`
      );
      applied.elements.push({
        key: region.painted ? "regionBoundary" : "boxFrame",
        ink: chosen.ink,
        source: chosen.source,
        grounds,
        worst: chosen.worst,
      });
    });
    applied.counts.regionBoundary = paintedRegions.length;
    applied.counts.boxFrame = regions.length - paintedRegions.length;

    // --- autonumber digits --------------------------------------------------
    const digits = [...svg.querySelectorAll("text.sequenceNumber")];
    digits.forEach((text) => text.style.setProperty("fill", digit.ink));
    applied.counts.autonumberDigit = digits.length;

    if (encodingDefs.childNodes.length) {
      svg.insertBefore(encodingDefs, svg.firstChild);
      applied.markerSets = markerSets.size;
    }

    logInfo(
      `Sequence encoding applied: ${applied.elements.length} outlines, ${
        applied.counts.autonumberDigit
      } autonumber digits, ${applied.markerSets} extra marker set(s), base ink ${
        baseInk.ink
      } at ${baseInk.worst}:1 on ${svgGround}, ${applied.warnings.length} warnings`
    );
    applied.warnings.forEach((warning) =>
      logWarn(`Sequence encoding: ${warning}`)
    );

    return applied;
  }

  // -----------------------------------------------------------------------
  // BLOCK DIAGRAM ENCODING (register item 80, 15 September 2026)
  // -----------------------------------------------------------------------

  const BLOCK_ROLEDESCRIPTION = "block";

  /** SC 1.4.11 for every outline and boundary. */
  const BLOCK_OBJECT_TARGET = 3;

  /**
   * The OUTLINE INKS OF RECORD, presentation standard § 1.4 — the same pair the
   * xychart casings and the sequence outlines use. Both are offered to every
   * derivation rather than being selected by mode: a block inside a pale group
   * inside a dark diagram wants the light-ground ink, and a mode flag would hand
   * it the wrong one (standard rule 18).
   */
  const BLOCK_OUTLINE_INKS = Object.freeze(["#00131D", "#E1E8EC"]);

  /**
   * Fallback ramp, used only where neither ink of record clears the target. 65
   * steps, matching sequence: a block sitting on a group fill that is itself
   * mid-grey leaves a narrow admissible band, and a coarse ramp lands on its
   * edge.
   */
  const BLOCK_INK_RAMP = Object.freeze(
    Array.from({ length: 65 }, (unused, i) => {
      const v = Math.round((i * 255) / 64);
      return rgbToHex(v, v, v);
    })
  );

  /** Attribute marking an element this pass has painted, for idempotency. */
  const BLOCK_ENCODING_ATTRIBUTE = "data-block-encoding";

  /** Paint properties this pass writes, and therefore sweeps before re-writing. */
  const BLOCK_OWNED_PROPERTIES = Object.freeze([
    "stroke",
    "stroke-opacity",
    "stroke-width",
    "fill",
  ]);

  /** Minimum boundary width, so a 1px hairline is not the only channel. */
  const BLOCK_BOUNDARY_WIDTH = 2;

  /**
   * Apply the accessibility encoding to a rendered block diagram: an outline ink
   * per element that clears the ground that element actually sits on, applied to
   * block boundaries, group frames, edge lines and arrowheads. AUTHOR AND THEME
   * FILLS ARE NEVER TOUCHED.
   *
   * WHY IT EXISTS — the measurement, and it is the group frame that forces it.
   * Swept 15 September 2026 across the nine selectable theme/mode combinations,
   * both site modes, four exemplars, every value COMPUTED:
   *
   *   - the GROUP FRAME boundary is indistinct in ALL NINE cells, 1.11:1 to
   *     1.91:1. The cause is Mermaid's own `stroke-opacity: 0.2` on the cluster
   *     rect, so the frame is a fifth of an outline whatever colour it carries;
   *   - the BLOCK boundary is indistinct in TWO of nine — `neutral` at 2.80:1
   *     and `accessibleDark` at 1.45:1, the latter painting a black outline on a
   *     dark ground;
   *   - EDGE LINES and ARROWHEADS were clean in all nine, which is a measurement
   *     of absence rather than an untested assumption. They are still written,
   *     because a theme this repository does not ship could move them and the
   *     cost of covering them is one selector.
   *
   * WHY FILLS ARE LEFT ALONE, when the same sweep found a block's FILL
   * indistinct from its ground in all nine cells at 1.02:1 to 1.45:1. That is
   * the design, not a shortfall, and it is standard rule 18's: the fill is the
   * author's and the theme's, and the outline is the channel that carries
   * distinguishability. Repainting fills would overwrite an authored choice to
   * fix something an outline fixes without touching it.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES — the gantt and sequence
   * argument, unchanged. Four of the nine combinations are Mermaid BUILT-INS
   * (`default`, `neutral`, `forest`, `dark`), which `applyTheme` reaches as
   * `{'theme': '<id>'}` with no themeVariables at all, so a variable written
   * here could never reach them.
   *
   * WHICH CASE OF RULE 16 THIS IS: THE SECOND. Mermaid DRAWS every boundary this
   * pass paints — the block rect, the cluster rect, the edge path, the marker —
   * and the pass writes style onto the renderer's own elements. NO NODE IS ADDED
   * TO THE TREE, so nothing here is synthesis and nothing needs `aria-hidden`.
   *
   * IDEMPOTENT BY CONSTRUCTION. Every derivation reads only the page background
   * and the group FILLS — never a property this pass writes — so a re-run cannot
   * read back its own output. Each painted element is marked, and its owned
   * properties are cleared before being written again.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applyBlockEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === BLOCK_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${BLOCK_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      logDebug("No block SVG in this container - block encoding skipped");
      return null;
    }

    // --- sweep what a previous run owned ------------------------------------
    svg.querySelectorAll(`[${BLOCK_ENCODING_ATTRIBUTE}]`).forEach((owned) => {
      BLOCK_OWNED_PROPERTIES.forEach((property) =>
        owned.style.removeProperty(property)
      );
      owned.removeAttribute(BLOCK_ENCODING_ATTRIBUTE);
    });

    // --- grounds ------------------------------------------------------------
    // A block SVG has no background rect of its own (measured: `background` on
    // the svg computes transparent in all nine cells), so the diagram ground is
    // the first opaque background above it.
    const svgGround = resolveHostGround(svg);

    /**
     * A group frame's composited interior, which is the ground for anything
     * drawn inside it. Its fill is read from the RENDERER's value, never from
     * anything this pass wrote.
     */
    const groupGroundOf = (frame, outerGround) => {
      const computed = window.getComputedStyle(frame);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);
      if (!declared || alpha <= 0) return outerGround;
      return paintToHex(
        compositeOver({ ...declared, a: alpha }, parsePaint(outerGround))
      );
    };

    // Group frames first, so a block can be told from the frame that holds it:
    // Mermaid puts `label-container` on BOTH, and a selector that did not
    // exclude the composite would paint the frame twice and call it a block.
    const frames = [...svg.querySelectorAll("[class*='composite']")];
    const frameGrounds = new Map();
    frames.forEach((frame) => {
      // An enclosing frame, if this group is nested inside another.
      const outerFrame = frame.parentElement
        ? frame.parentElement.closest("[class*='composite']")
        : null;
      const outer =
        outerFrame && frameGrounds.has(outerFrame)
          ? frameGrounds.get(outerFrame)
          : svgGround;
      frameGrounds.set(frame, groupGroundOf(frame, outer));
    });

    const applied = {
      svgGround,
      frames: frames.length,
      counts: {},
      elements: [],
      worst: null,
    };

    /**
     * Paint one element's boundary in the ink that best clears its own ground.
     *
     * The ink of record is tried first and used wherever it clears the target,
     * so block reads as one system with xychart and sequence; the ramp is
     * reached only when neither does.
     */
    const paint = (element, kind, ground, options) => {
      const settings = options || {};
      const record = pickInkAgainst(BLOCK_OUTLINE_INKS, [ground]);
      const chosen =
        record.worst >= BLOCK_OBJECT_TARGET
          ? record
          : pickInkAgainst(BLOCK_INK_RAMP, [ground]);

      element.style.setProperty("stroke", chosen.ink, "important");
      // The 0.2 Mermaid gives a cluster rect is the whole reason a group frame
      // is invisible, so opacity is written with the ink rather than left to
      // fight it.
      element.style.setProperty("stroke-opacity", "1", "important");
      if (settings.width) {
        element.style.setProperty(
          "stroke-width",
          `${settings.width}px`,
          "important"
        );
      }
      if (settings.fill) {
        element.style.setProperty("fill", chosen.ink, "important");
      }
      element.setAttribute(BLOCK_ENCODING_ATTRIBUTE, kind);

      applied.counts[kind] = (applied.counts[kind] || 0) + 1;
      applied.elements.push({
        kind: kind,
        ink: chosen.ink,
        ground: ground,
        ratio: Number(chosen.worst.toFixed(2)),
        ofRecord: record.worst >= BLOCK_OBJECT_TARGET,
      });
      if (applied.worst === null || chosen.worst < applied.worst) {
        applied.worst = Number(chosen.worst.toFixed(2));
      }
    };

    frames.forEach((frame) =>
      paint(frame, "groupFrame", frameGrounds.get(frame), {
        width: BLOCK_BOUNDARY_WIDTH,
      })
    );

    // Block boundaries, selected by POSITION rather than by class.
    //
    // `label-container` looks like the right class and is not enough: Mermaid
    // puts it on the `<rect>` it draws for a square block and on NOTHING ELSE.
    // A cylinder, a circle, a rhombus and a flag are each drawn as a CLASSLESS
    // `<path>` — measured on E3, where a first version of this pass selected on
    // that class, painted four of six shapes, and left `neutral` at 2.80:1 and
    // `accessibleDark` at 1.45:1 in a run whose other seven cells read zero.
    // **A partial selector produces a partial clean and looks like a pass.**
    //
    // What every block boundary DOES share is its position: a direct child of
    // the `g.node` Mermaid wraps each block in. The classless `<rect>` inside
    // `g.label` is a label backing rather than a boundary and is excluded by the
    // same test, which is why the selector is a child combinator and not a
    // descendant one. Composite frames painted above are skipped by their mark.
    [
      ...svg.querySelectorAll(
        "g[class*='node'] > rect, g[class*='node'] > path, g[class*='node'] > circle, g[class*='node'] > ellipse, g[class*='node'] > polygon, [class*='label-container']"
      ),
    ].forEach((shape) => {
      if (shape.hasAttribute(BLOCK_ENCODING_ATTRIBUTE)) return;
      const frame = shape.parentElement
        ? shape.parentElement.closest("[class*='composite']")
        : null;
      const ground =
        frame && frameGrounds.has(frame) ? frameGrounds.get(frame) : svgGround;
      paint(shape, "blockBoundary", ground, { width: BLOCK_BOUNDARY_WIDTH });
    });

    // Edge lines. Measured clean in all nine cells; written anyway, because a
    // theme this repository does not ship could move them.
    [
      ...svg.querySelectorAll("g.edgePaths path, path.path, path[class*='link']"),
    ].forEach((line) => {
      if (line.hasAttribute(BLOCK_ENCODING_ATTRIBUTE)) return;
      paint(line, "edgeLine", svgGround);
    });

    // Arrowheads live inside <marker>, are drawn at an arrow end over the
    // diagram ground, and are FILLED rather than stroked - so this is the one
    // place the pass writes a fill, and it is a marker's fill and never an
    // author's.
    [...svg.querySelectorAll("marker path, marker polygon, marker circle")].forEach(
      (head) => {
        if (head.hasAttribute(BLOCK_ENCODING_ATTRIBUTE)) return;
        paint(head, "arrowhead", svgGround, { fill: true });
      }
    );

    logInfo(
      `Block encoding applied: ${applied.elements.length} objects, worst ${applied.worst}:1 on ground ${svgGround}`
    );
    return applied;
  }

  // -----------------------------------------------------------------------
  // C4 DIAGRAM ENCODING (register item 86, 18 September 2026)
  // -----------------------------------------------------------------------

  const C4_ROLEDESCRIPTION = "c4";

  /** SC 1.4.11 for every outline, boundary, line and arrowhead. */
  const C4_OBJECT_TARGET = 3;

  /** SC 1.4.3 for label text. */
  const C4_TEXT_TARGET = 4.5;

  /**
   * The OUTLINE INKS OF RECORD, presentation standard § 1.4 — the same pair the
   * xychart casings and the sequence and block outlines use. Both are offered to
   * every derivation rather than being selected by mode, because a c4 label sits
   * on a dark element fill inside a light diagram and a mode flag would hand it
   * the wrong one (standard rule 18).
   */
  const C4_INKS = Object.freeze(["#00131D", "#E1E8EC"]);

  /**
   * Fallback ramp, reached only where neither ink of record clears the target.
   * 65 steps, matching sequence and block: a c4 relationship label crossing a
   * mid-blue element box leaves a narrow admissible band, and a coarse ramp
   * lands on its edge.
   */
  const C4_INK_RAMP = Object.freeze(
    Array.from({ length: 65 }, (unused, i) => {
      const v = Math.round((i * 255) / 64);
      return rgbToHex(v, v, v);
    })
  );

  /** Attribute marking an element this pass has painted, for idempotency. */
  const C4_ENCODING_ATTRIBUTE = "data-c4-encoding";

  /**
   * The properties written to a given element, recorded on the element itself.
   *
   * A SWEEP MUST REMOVE ONLY WHAT IT WROTE. Clearing a fixed list of "owned"
   * properties from every marked element removes the RENDERER's own inline
   * declarations too, and the failure is silent and delayed: Mermaid writes
   * `style="fill:none"` on a relationship `<line>`, a blanket sweep deleted it
   * on the second application, the line's computed fill fell back to inherited
   * white, and the ground resolver then composited a 100x10 white rectangle
   * under anything crossing that line. The first run looked perfect; the second
   * quietly changed the diagram AND the numbers derived from it.
   */
  const C4_OWNED_LIST_ATTRIBUTE = "data-c4-encoding-owned";

  /** Minimum boundary width, so a 0.5px hairline is not the only channel. */
  const C4_BOUNDARY_WIDTH = 2;

  /**
   * Apply the accessibility encoding to a rendered c4 diagram: an outline ink
   * per element that clears every ground that element actually sits on, applied
   * to element-shape boundaries, boundary frames, relationship lines and
   * arrowheads, plus a text ink WHERE AND ONLY WHERE the text fails.
   * AUTHOR AND THEME FILLS ARE NEVER TOUCHED.
   *
   * WHY IT EXISTS — the measurement, nine theme cells times two site modes times
   * four exemplars, 160 painted objects per cell and 2,880 in all, every value
   * COMPUTED (register item 86, 18 September 2026):
   *
   *   - 1,566 of 2,880 objects are indistinct before this pass;
   *   - RELATIONSHIP LINES fail in all eighteen cells, 135 of 198, worst 1.48:1;
   *   - ARROWHEADS fail in twelve of eighteen, 144 of 288, worst 1.02:1 — and
   *     that class read `0 of 0` until the instrument stopped treating "inside
   *     <defs>" as off stage, which is where Mermaid keeps every <marker>;
   *   - BOUNDARY FRAMES are clean in all nine light-site-mode cells and fail in
   *     all nine dark ones, 54 of 108;
   *   - TEXT fails 1,053 of 1,620, worst 1.02:1.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES — the gantt, sequence and
   * block argument, and here it is a step stronger. Across all eighteen cells
   * the c4 paint takes FOUR distinct fingerprints where a flowchart driven
   * through the identical code path takes NINE within each site mode: every
   * element fill, shape boundary, boundary frame and relationship line is
   * byte-identical in all nine themes, and only the arrowhead and text inks move
   * between the light and dark theme families. A theme variable could not reach
   * the four built-ins; here it would not reach the other five either.
   *
   * WHY FILLS ARE LEFT ALONE, when the same sweep found 63 of 288 element fills
   * indistinct from their ground. That is standard rule 18's design, arriving at
   * a fifth type: the fill is the author's and the renderer's, and the outline
   * is the channel that carries distinguishability. The unmoved count is
   * reported rather than omitted.
   *
   * WHICH CASE OF RULE 16 THIS IS: THE SECOND. Mermaid DRAWS every boundary,
   * line and arrowhead this pass paints, so the pass writes style onto the
   * renderer's own elements and ADDS NO NODE TO THE TREE. Nothing here is
   * synthesis and nothing needs `aria-hidden`.
   *
   * THE SELECTOR IS BUILT ON ELEMENT KIND AND STRUCTURE, NEVER ON A CLASS
   * (standard rule 19). A c4 diagram classes almost nothing: a boundary frame is
   * a classless `<rect>`, a relationship line a classless `<path>` or `<line>`,
   * and the only class in the tree is `person-man`, which the renderer puts on
   * the group wrapping EVERY element — a person, a system, a container and a
   * database alike — so a selector built on it would be both misleadingly named
   * and silently partial the day the renderer stops applying it. What the
   * subjects share is what they ARE: a shape that carries a fill is an element
   * glyph and its stroke is its boundary; one that carries none is a frame if it
   * is a `<rect>` and a relationship line otherwise, except where its own group
   * also holds a filled shape, which makes it a glyph's internal rim. The pass
   * counts what the selector reached against what the walk found and returns
   * both.
   *
   * GROUNDS ARE RESOLVED GEOMETRICALLY, NEVER FROM AN INHERITED `<g>` FILL.
   * `fill` is an inherited SVG property, so a `<g>` reports a fill it merely
   * inherited and anything measured against it reads 1.00:1 against itself. Only
   * an element that actually paints can be a ground. An outline is resolved at
   * its four EDGE midpoints, because a frame's centre is full of what it
   * encloses; a text at five points across its box, because a c4 relationship
   * label really is drawn over the element box it points at — measured, not
   * assumed — and an ink must then clear both grounds.
   *
   * IDEMPOTENT BY CONSTRUCTION. The sweep runs first, so every derivation reads
   * the RENDERER's values and never this pass's own output; each painted element
   * is marked, and its owned properties are cleared before being written again.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applyC4Encoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === C4_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${C4_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      logDebug("No c4 SVG in this container - c4 encoding skipped");
      return null;
    }

    // --- sweep what a previous run owned, and ONLY that ----------------------
    svg.querySelectorAll(`[${C4_ENCODING_ATTRIBUTE}]`).forEach((owned) => {
      (owned.getAttribute(C4_OWNED_LIST_ATTRIBUTE) || "")
        .split(",")
        .filter(Boolean)
        .forEach((property) => owned.style.removeProperty(property));
      owned.removeAttribute(C4_ENCODING_ATTRIBUTE);
      owned.removeAttribute(C4_OWNED_LIST_ATTRIBUTE);
    });

    // --- the walk, and the reach it is compared against ---------------------
    const SHAPE_TAGS = ["rect", "path", "circle", "ellipse", "polygon", "line"];
    const all = [...svg.querySelectorAll("*")];

    // "Off stage" is NOT "inside <defs>". Mermaid keeps its arrowhead <marker>
    // blocks there, and a marker's content IS painted, at every arrow end.
    const offstage = (element) =>
      !!(
        (element.closest("defs") && !element.closest("marker")) ||
        element.closest("symbol") ||
        element.closest("clipPath")
      );

    const boxOf = (element) => {
      try {
        const box = element.getBBox();
        return box && box.width > 0 && box.height > 0 ? box : null;
      } catch (e) {
        return null;
      }
    };

    // The diagram ground: a c4 SVG paints no background rect of its own, so it
    // is the first opaque background above it.
    const svgGround = resolveHostGround(svg);
    const svgGroundPaint = parsePaint(svgGround);

    /**
     * Shapes that can present a ground: they have an area to fill and a fill to
     * present. A `<line>` is in SHAPE_TAGS because it is a subject — it carries
     * a stroke — but it is NOT a ground: a line has no fillable region, and
     * `getComputedStyle` nevertheless reports a `fill` for it, inherited white
     * in a dark theme. Reading that as paint turns a 100x10 relationship line
     * into a white rectangle under everything that crosses it. Only an element
     * that actually paints an area can be a ground.
     */
    const GROUND_TAGS = ["rect", "path", "circle", "ellipse", "polygon"];

    /** Painted shapes in document order, with their box and composited fill. */
    const painted = [];
    all.forEach((element, index) => {
      if (!GROUND_TAGS.includes(element.tagName)) return;
      if (offstage(element) || element.closest("marker")) return;
      const computed = window.getComputedStyle(element);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);
      if (!declared || alpha <= 0.05) return;
      const box = boxOf(element);
      if (!box) return;
      painted.push({ element, index, box, paint: { ...declared, a: alpha } });
    });

    /** The composite actually shown at a point, counting only what precedes it. */
    const groundAt = (x, y, before) => {
      let colour = svgGroundPaint;
      for (const shape of painted) {
        if (shape.index >= before) break;
        const box = shape.box;
        if (x < box.x || x > box.x + box.width) continue;
        if (y < box.y || y > box.y + box.height) continue;
        colour = compositeOver(shape.paint, colour);
      }
      return colour;
    };

    /** Every DISTINCT ground a subject sits on, as hex. */
    const groundsOver = (points, before) => {
      const seen = new Set();
      points.forEach((point) =>
        seen.add(paintToHex(groundAt(point[0], point[1], before)))
      );
      return [...seen];
    };
    const edgePoints = (box) => [
      [box.x + box.width / 2, box.y + 0.5],
      [box.x + box.width / 2, box.y + box.height - 0.5],
      [box.x + 0.5, box.y + box.height / 2],
      [box.x + box.width - 0.5, box.y + box.height / 2],
    ];
    const spreadPoints = (box) => [
      [box.x + box.width / 2, box.y + box.height / 2],
      [box.x + box.width * 0.15, box.y + box.height * 0.5],
      [box.x + box.width * 0.85, box.y + box.height * 0.5],
      [box.x + box.width * 0.5, box.y + box.height * 0.15],
      [box.x + box.width * 0.5, box.y + box.height * 0.85],
    ];

    const applied = {
      svgGround,
      walked: all.length,
      reached: 0,
      counts: {},
      shortfalls: [],
      elements: [],
      // Every distinct ground the diagram can present, reported so a reading
      // that names an unexpected colour can be chased to the shape that paints
      // it rather than argued about.
      paintedFills: [...new Set(painted.map((shape) => `${shape.element.tagName}:${paintToHex(shape.paint)}`))],
      worst: null,
    };

    /**
     * Choose the ink that maximises the WORST ratio across every ground this
     * subject sits on, and write it. The inks of record are tried first and used
     * wherever they clear the target, so c4 reads as one system with xychart,
     * sequence and block; the ramp is reached only when neither does.
     *
     * A shortfall is RECORDED rather than swallowed: where no candidate clears
     * the target the best available is still written — it is strictly better
     * than what the renderer had — and the reading is returned so the session
     * can report it with its reason instead of it passing unnoticed.
     */
    const paint = (element, kind, grounds, target, options) => {
      const settings = options || {};
      const record = pickInkAgainst(C4_INKS, grounds);
      const chosen =
        record.worst >= target ? record : pickInkAgainst(C4_INK_RAMP, grounds);

      const written = [];
      if (settings.fill) {
        element.style.setProperty("fill", chosen.ink, "important");
        written.push("fill");
      } else {
        element.style.setProperty("stroke", chosen.ink, "important");
        element.style.setProperty("stroke-opacity", "1", "important");
        written.push("stroke", "stroke-opacity");
        if (settings.width) {
          element.style.setProperty(
            "stroke-width",
            `${settings.width}px`,
            "important"
          );
          written.push("stroke-width");
        }
      }
      element.setAttribute(C4_ENCODING_ATTRIBUTE, kind);
      element.setAttribute(C4_OWNED_LIST_ATTRIBUTE, written.join(","));

      applied.counts[kind] = (applied.counts[kind] || 0) + 1;
      applied.reached += 1;
      const reading = {
        kind: kind,
        ink: chosen.ink,
        grounds: grounds,
        ratio: Number(chosen.worst.toFixed(2)),
        target: target,
        ofRecord: record.worst >= target,
      };
      applied.elements.push(reading);
      if (chosen.worst < target) applied.shortfalls.push(reading);
      if (applied.worst === null || chosen.worst < applied.worst) {
        applied.worst = Number(chosen.worst.toFixed(2));
      }
    };

    all.forEach((element, index) => {
      const inMarker = !!element.closest("marker");
      if (offstage(element) && !inMarker) return;

      // ARROWHEADS. A marker's content has no box in page space, so its ground
      // is the diagram ground and that is said rather than implied. It is the
      // one place this pass writes a fill, and it is a marker's fill and never
      // an author's.
      if (inMarker) {
        if (!SHAPE_TAGS.includes(element.tagName)) return;
        const computed = window.getComputedStyle(element);
        const declared = parsePaint(computed.fill);
        const alpha =
          (declared ? declared.a : 0) *
          opacityValue(computed.fillOpacity) *
          opacityValue(computed.opacity);
        if (!declared || alpha <= 0.05) return;
        paint(element, "arrowhead", [svgGround], C4_OBJECT_TARGET, {
          fill: true,
        });
        return;
      }

      // TEXT, and ONLY where it fails. A label the renderer already got right
      // is left exactly as it is: rewriting it would overwrite a correct choice
      // and make every later reading a reading of this pass rather than of the
      // page.
      if (element.tagName === "text") {
        const computed = window.getComputedStyle(element);
        const declared = parsePaint(computed.fill);
        const alpha =
          (declared ? declared.a : 0) *
          opacityValue(computed.fillOpacity) *
          opacityValue(computed.opacity);
        const box = boxOf(element);
        if (!declared || alpha <= 0.05 || !box) return;
        const grounds = groundsOver(spreadPoints(box), index);
        const worstNow = grounds.reduce(
          (lowest, ground) =>
            Math.min(
              lowest,
              calculateContrastRatio(
                paintToHex(
                  compositeOver({ ...declared, a: alpha }, parsePaint(ground))
                ),
                ground
              )
            ),
          Infinity
        );
        if (worstNow >= C4_TEXT_TARGET) return;
        paint(element, "textInk", grounds, C4_TEXT_TARGET, { fill: true });
        return;
      }

      if (!SHAPE_TAGS.includes(element.tagName)) return;
      const box = boxOf(element);
      if (!box) return;

      const computed = window.getComputedStyle(element);
      const fillPaint = parsePaint(computed.fill);
      const fillAlpha =
        (fillPaint ? fillPaint.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);
      const strokePaint = parsePaint(computed.stroke);
      const strokeAlpha =
        (strokePaint ? strokePaint.a : 0) *
        opacityValue(computed.strokeOpacity) *
        opacityValue(computed.opacity);
      // A <line> is never a filled shape however its `fill` computes, so it can
      // never be an element glyph; see GROUND_TAGS.
      const hasFill =
        GROUND_TAGS.includes(element.tagName) && !!fillPaint && fillAlpha > 0.05;
      const hasStroke = !!strokePaint && strokeAlpha > 0.05;
      if (!hasStroke) return;

      // A shape carrying a fill is an element glyph and its stroke is that
      // glyph's boundary. One carrying none is a boundary frame if it is a
      // <rect>; otherwise it is a relationship line, UNLESS its own group also
      // holds a filled shape, which makes it a glyph's internal rim — a
      // database cylinder's lid and a queue's end cap are exactly that, and
      // classifying them by tag alone would put a glyph's detail in a class
      // named for arrows.
      const groupHoldsFill = painted.some(
        (shape) => shape.element.parentElement === element.parentElement
      );
      const kind = hasFill
        ? "elementBoundary"
        : element.tagName === "rect"
        ? "boundaryFrame"
        : groupHoldsFill
        ? "elementBoundary"
        : "relationshipLine";

      paint(element, kind, groundsOver(edgePoints(box), index), C4_OBJECT_TARGET, {
        width: kind === "relationshipLine" ? null : C4_BOUNDARY_WIDTH,
      });
    });

    logInfo(
      `C4 encoding applied: ${applied.reached} of ${applied.walked} walked elements painted, worst ${applied.worst}:1 on ground ${svgGround}` +
        (applied.shortfalls.length
          ? `, ${applied.shortfalls.length} below target and recorded`
          : "")
    );
    return applied;
  }

  // -----------------------------------------------------------------------
  // KANBAN DIAGRAM ENCODING (register item 88 step 7b, 21 September 2026)
  // -----------------------------------------------------------------------

  const KANBAN_ROLEDESCRIPTION = "kanban";

  /** SC 1.4.11 for every boundary and every priority line. */
  const KANBAN_OBJECT_TARGET = 3;

  /** SC 1.4.3 for label text. */
  const KANBAN_TEXT_TARGET = 4.5;

  /**
   * The OUTLINE INKS OF RECORD, presentation standard § 1.4 — the same pair
   * xychart's casings and the sequence, block and c4 outlines use. Both are
   * offered to every derivation rather than being selected by mode, because a
   * kanban card boundary sits on a light column inside a dark page and a mode
   * flag would hand it the wrong one (standard rule 18).
   */
  const KANBAN_INKS = Object.freeze(["#00131D", "#E1E8EC"]);

  /** Fallback ramp, reached only where neither ink of record clears. */
  const KANBAN_INK_RAMP = Object.freeze(
    Array.from({ length: 65 }, (unused, i) => {
      const v = Math.round((i * 255) / 64);
      return rgbToHex(v, v, v);
    })
  );

  /** Attribute marking an element this pass has painted, for idempotency. */
  const KANBAN_ENCODING_ATTRIBUTE = "data-kanban-encoding";

  /**
   * The properties written to a given element, recorded on the element itself
   * (standard rule 20). A sweep must remove only what it wrote: the kanban
   * renderer does not write inline paint today, but c4's did and the failure
   * was silent, delayed, and changed every number derived from the diagram.
   */
  const KANBAN_OWNED_LIST_ATTRIBUTE = "data-kanban-encoding-owned";

  /**
   * THE PRIORITY STAMP, and why it cannot be left out.
   *
   * The canvas's ONLY witness to a card's priority is the colour the renderer
   * strokes its line with — there is no class, no data attribute and no text.
   * This pass overwrites that stroke. So the priority must be read on FIRST
   * SIGHT and recorded on the element, or a second application and every theme
   * flip would be reading the ink the pass itself wrote and would re-derive the
   * wrong priority from its own output.
   *
   * The stamp deliberately SURVIVES the idempotency sweep, unlike everything
   * else this pass writes.
   */
  const KANBAN_PRIORITY_ATTRIBUTE = "data-kanban-priority";

  /**
   * The four DRAWN priority colours, exactly as the renderer paints them —
   * measured across all eighteen theme cells on 21 September 2026 and found
   * byte-identical in every one, because they are hard-coded in the kanban
   * renderer and are not theme variables.
   *
   * A fifth case exists and is deliberately absent: a priority the canvas does
   * not draw computes `stroke: none`, and this pass never paints it. The
   * picture stays as the renderer drew it and the description already discloses
   * the undrawn value in words (gold rules KR9 and KR10).
   */
  const KANBAN_PRIORITY_BY_STROKE = Object.freeze({
    "rgb(255, 0, 0)": "veryHigh",
    "rgb(255, 165, 0)": "high",
    "rgb(0, 0, 255)": "low",
    "rgb(173, 216, 230)": "veryLow",
  });

  /**
   * THE NON-COLOUR CHANNEL, ordered so that MORE INK MEANS MORE URGENT.
   *
   * WHY IT EXISTS — the measurement, eighteen cells times four exemplars, every
   * value COMPUTED (register item 88, 21 September 2026): the four priority
   * inks are **not distinguishable from each other** without hue. Taking the
   * contrast ratio between each pair, which is the arithmetic SC 1.4.11 uses
   * applied to two foregrounds, FOUR OF THE SIX PAIRS FALL BELOW 3:1 — Very
   * High against High at 2.02, against Low at 2.15 and against Very Low at
   * 2.62, and High against Very Low at **1.29**. No ink assignment repairs
   * that while the hue families are kept, because the failure is in the
   * CHANNEL and not in any colour value.
   *
   * THE DASH VOCABULARY IS THE PROJECT'S OWN, not a new one: `SERIES_DASHES`
   * above, the Chart.js `borderDash` list the xychart pass already uses, first
   * two entries — `5,5` for dashed and `2,2` for dotted.
   *
   * THE CAP IS `butt`, AND THAT REFUTES PART OF THE RULING THAT COMMISSIONED
   * THIS. The ruling asked for the dotted arm as "short dash, round cap". A
   * round cap extends every dash by HALF THE STROKE WIDTH AT EACH END, so on
   * this 4px stroke a 2-unit gap is over-run by 4 units and the pattern
   * collapses. Measured rather than reasoned: rasterised down a real rendered
   * line, `2,2` with a round cap paints 200 of 200 samples in ONE run — a
   * SOLID line, which would have made Very Low indistinguishable from High,
   * the exact defect this channel exists to remove. With a butt cap the same
   * array reads 13 runs. `5,5` reads 6 runs with either cap.
   */
  const KANBAN_PRIORITY_CHANNEL = Object.freeze({
    veryHigh: { widthMultiple: 2, dash: null, cap: "butt", rank: 4 },
    high: { widthMultiple: 1, dash: null, cap: "butt", rank: 3 },
    low: { widthMultiple: 1, dash: SERIES_DASHES[0], cap: "butt", rank: 2 },
    veryLow: { widthMultiple: 1, dash: SERIES_DASHES[1], cap: "butt", rank: 1 },
  });

  /** Steps in the per-hue lightness ramp each priority ink may be moved along. */
  const KANBAN_HUE_RAMP_STEPS = 128;

  /**
   * Convert a hex colour to HSL, so an ink can be moved in LIGHTNESS while its
   * HUE FAMILY is kept. The design seat's ruling keeps red, orange, blue and
   * light blue and moves each only as far as its grounds require.
   *
   * @param {string} hex - `#rrggbb`
   * @returns {{h: number, s: number, l: number}} h in [0,360), s and l in [0,1]
   */
  function kanbanHexToHsl(hex) {
    // `hexToRgb` RETURNS AN ARRAY `[r, g, b]`, NOT an object `{r, g, b}`.
    // Reading `.r` off it yields `undefined`, every arithmetic result downstream
    // is NaN, and `rgbToHex(NaN, NaN, NaN)` produces the string `#NaNNaNNaN` —
    // which `calculateContrastRatio` then scores as NaN, so every `>` and `>=`
    // comparison in the ramp search is FALSE and the search silently returns the
    // colour it started with. Nothing throws and nothing logs; the pass reports
    // its shortfalls honestly and simply never moves an ink. It was caught only
    // because the after sweep's priority readings were byte-identical to the
    // before ones while the pass claimed to have applied a channel — two parts
    // of one instrumentation disagreeing about the same construct.
    const rgb = hexToRgb(hex) || [0, 0, 0];
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;

    if (d === 0) return { h: 0, s: 0, l: l };

    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;

    return { h: h, s: s, l: l };
  }

  /**
   * The inverse, back to this module's `#rrggbb`.
   *
   * @param {number} h - Hue in [0,360)
   * @param {number} s - Saturation in [0,1]
   * @param {number} l - Lightness in [0,1]
   * @returns {string} `#rrggbb`
   */
  function kanbanHslToHex(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return rgbToHex(v, v, v);
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
      let value = t;
      if (value < 0) value += 1;
      if (value > 1) value -= 1;
      if (value < 1 / 6) return p + (q - p) * 6 * value;
      if (value < 1 / 2) return q;
      if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
      return p;
    };
    const hk = h / 360;
    return rgbToHex(
      Math.round(channel(hk + 1 / 3) * 255),
      Math.round(channel(hk) * 255),
      Math.round(channel(hk - 1 / 3) * 255)
    );
  }

  /**
   * Move an ink along its OWN hue's lightness ramp, outward from where the
   * renderer put it, and stop at the FIRST value clearing every ground.
   *
   * "Moved only as far as 3:1 needs" is taken literally: the candidates are
   * generated in order of increasing distance from the original lightness, so
   * the first acceptable one is the nearest acceptable one. Where nothing on
   * the ramp clears, the candidate maximising the WORST ratio is returned with
   * `cleared: false` and the caller records a shortfall — a maximum over a ramp
   * is not a proof of insolubility, which is rule 22's separate job.
   *
   * @param {string} hex - The renderer's own ink
   * @param {string[]} grounds - Every ground this ink must clear
   * @param {number} target - The ratio to clear
   * @returns {{ink: string, worst: number, cleared: boolean, moved: boolean}}
   */
  function pickKanbanHueInk(hex, grounds, target) {
    // A non-finite reading is treated as the WORST possible rather than
    // propagated: a NaN compares false against everything, so it cannot be
    // rejected by a `<` test and instead makes every candidate silently
    // unselectable. Returning -1 makes a malformed candidate lose outright and
    // keeps the failure inside this function.
    const worstOf = (candidate) => {
      const worst = grounds.reduce(
        (lowest, ground) =>
          Math.min(lowest, calculateContrastRatio(candidate, ground)),
        Infinity
      );
      return Number.isFinite(worst) ? worst : -1;
    };

    const original = worstOf(hex);
    if (original >= target) {
      return { ink: hex, worst: original, cleared: true, moved: false };
    }

    const hsl = kanbanHexToHsl(hex);
    let best = hex;
    let bestWorst = original;

    for (let step = 1; step <= KANBAN_HUE_RAMP_STEPS; step += 1) {
      const delta = step / KANBAN_HUE_RAMP_STEPS;
      const candidates = [hsl.l - delta, hsl.l + delta].filter(
        (l) => l >= 0 && l <= 1
      );

      for (const lightness of candidates) {
        const candidate = kanbanHslToHex(hsl.h, hsl.s, lightness);
        const worst = worstOf(candidate);
        if (worst > bestWorst) {
          bestWorst = worst;
          best = candidate;
        }
        if (worst >= target) {
          return { ink: candidate, worst: worst, cleared: true, moved: true };
        }
      }
    }

    return { ink: best, worst: bestWorst, cleared: false, moved: best !== hex };
  }

  /**
   * Apply the accessibility encoding to a rendered kanban board: an outline ink
   * per column frame and per card that clears the ground it sits on, a text ink
   * WHERE AND ONLY WHERE a text fails, and — the reason this pass exists — a
   * NON-COLOUR CHANNEL on the four drawn priority lines.
   * AUTHOR AND THEME FILLS ARE NEVER TOUCHED.
   *
   * WHY IT EXISTS — the measurement, nine selectable themes times two site
   * modes times four exemplars, 149 painted objects per cell and 2,682 in all,
   * every value COMPUTED (register item 88, 21 September 2026):
   *
   *   - 970 of 2,682 objects are indistinct before this pass;
   *   - THE PRIORITY LINE fails in all eighteen cells against BOTH of its
   *     grounds — 60 of 144 against the card at worst 1.47:1, and 82 of 144
   *     against the column at worst 1.01:1;
   *   - and the four priority inks are not distinguishable FROM EACH OTHER
   *     without hue: four of the six pairs fall below 3:1, High against Very
   *     Low at 1.29:1. See KANBAN_PRIORITY_CHANNEL above;
   *   - COLUMN FRAMES fail 87 of 180 in ten of eighteen cells, worst 1.06:1;
   *   - CARD BOUNDARIES fail 154 of 540 in six of eighteen, worst 1.00:1;
   *   - COLUMN TITLE TEXT fails 14 of 180 in four cells, worst 3.38:1, and
   *     every other text class passes in every cell.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES, and the argument is NOT
   * c4's. A theme DOES reach a kanban diagram: measured, the paint takes NINE
   * distinct fingerprints across the nine themes in each site mode, matching a
   * flowchart control driven through the identical code path. What no theme
   * variable can reach is the thing that is actually broken — the four priority
   * colours are hard-coded in the renderer, and the failure is a CHANNEL
   * failure that no colour value of any kind repairs.
   *
   * WHY FILLS ARE LEFT ALONE, when the same sweep found 486 of 540 card fills
   * and 87 of 180 column frame fills indistinct from their ground. That is
   * standard rule 18's design arriving at a sixth type: the fill is the
   * renderer's and the theme's, and the outline is the channel that carries
   * distinguishability. The unmoved counts are reported rather than omitted.
   *
   * WHICH CASE OF RULE 16 THIS IS: THE SECOND. Mermaid DRAWS every frame, card
   * and priority line this pass paints, so the pass writes style onto the
   * renderer's own elements and ADDS NO NODE TO THE TREE. Nothing here is
   * synthesis and nothing needs `aria-hidden`.
   *
   * THE SELECTOR IS BUILT ON STRUCTURE AND POSITION, NEVER ON A CLASS
   * (standard rule 19). A kanban column frame is a CLASSLESS `<rect>` whose
   * parent group carries `cluster`; a card is the `label-container` rect inside
   * a `node` group; a priority line is the `<line>` in that same group. And the
   * three texts on a card are told apart by POSITION — topmost is the label,
   * then left is the ticket and right the assignee — because the renderer's DOM
   * ORDER IS NOT STABLE: a linked ticket is wrapped in `a.kanban-ticket-link`,
   * which is emitted BEFORE the label, while an unlinked card emits the label
   * first. Measured on E6 against E4.
   *
   * GEOMETRY IS RESOLVED IN CLIENT SPACE, NEVER BY `getBBox`. A kanban node
   * group carries its own `transform`, so a card rect reports `x=-92.5` in its
   * own user space while its column rect reports `x=100` in the diagram's.
   * Comparing those two numbers is silently wrong and produces a completely
   * plausible result. `getBoundingClientRect` is ONE space for every element in
   * the tree.
   *
   * IDEMPOTENT BY CONSTRUCTION. Every derivation reads the RENDERER's values
   * and never this pass's own output: each painted element is marked, its owned
   * properties are cleared before being written again, and a priority line's
   * identity comes from a STAMP taken on first sight rather than from the
   * stroke this pass overwrote.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applyKanbanEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === KANBAN_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${KANBAN_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      logDebug("No kanban SVG in this container - kanban encoding skipped");
      return null;
    }

    // --- sweep what a previous run owned, and ONLY that ----------------------
    // The PRIORITY STAMP is deliberately not swept: it is the only surviving
    // witness to what the renderer drew, and this pass has overwritten the ink
    // it was derived from.
    svg.querySelectorAll(`[${KANBAN_ENCODING_ATTRIBUTE}]`).forEach((owned) => {
      (owned.getAttribute(KANBAN_OWNED_LIST_ATTRIBUTE) || "")
        .split(",")
        .filter(Boolean)
        .forEach((property) => owned.style.removeProperty(property));
      owned.removeAttribute(KANBAN_ENCODING_ATTRIBUTE);
      owned.removeAttribute(KANBAN_OWNED_LIST_ATTRIBUTE);
    });

    const all = [...svg.querySelectorAll("*")];

    const offstage = (element) =>
      !!(
        element.closest("defs") ||
        element.closest("symbol") ||
        element.closest("clipPath")
      );

    /** Client-space box, the ONE space every element in this tree shares. */
    const boxOf = (element) => {
      const rect = element.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0
        ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
        : null;
    };

    const hostGround = resolveHostGround(svg);
    const hostGroundPaint = parsePaint(hostGround);

    /**
     * Shapes that can present a ground. A `<line>` is a SUBJECT and never a
     * ground (standard rule 21): it has no fillable region, and
     * `getComputedStyle` still reports a `fill` for it.
     */
    const GROUND_TAGS = ["rect", "path", "circle", "ellipse", "polygon"];
    const painted = [];
    all.forEach((element, index) => {
      if (!GROUND_TAGS.includes(element.tagName) || offstage(element)) return;
      const computed = window.getComputedStyle(element);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);
      if (!declared || alpha <= 0.05) return;
      const box = boxOf(element);
      if (!box) return;
      painted.push({ element, index, box, paint: { ...declared, a: alpha } });
    });

    /** The composite actually shown at a client point, counting only what precedes it. */
    const groundAt = (x, y, before) => {
      let colour = hostGroundPaint;
      for (const shape of painted) {
        if (shape.index >= before) break;
        const box = shape.box;
        if (x < box.x || x > box.x + box.w) continue;
        if (y < box.y || y > box.y + box.h) continue;
        colour = compositeOver(shape.paint, colour);
      }
      return colour;
    };
    const groundsOver = (points, before) => {
      const seen = new Set();
      points.forEach((point) =>
        seen.add(paintToHex(groundAt(point[0], point[1], before)))
      );
      return [...seen];
    };
    const edgePoints = (box) => [
      [box.x + box.w / 2, box.y + 0.5],
      [box.x + box.w / 2, box.y + box.h - 0.5],
      [box.x + 0.5, box.y + box.h / 2],
      [box.x + box.w - 0.5, box.y + box.h / 2],
    ];
    const spreadPoints = (box) => [
      [box.x + box.w / 2, box.y + box.h / 2],
      [box.x + box.w * 0.15, box.y + box.h * 0.5],
      [box.x + box.w * 0.85, box.y + box.h * 0.5],
      [box.x + box.w * 0.5, box.y + box.h * 0.15],
      [box.x + box.w * 0.5, box.y + box.h * 0.85],
    ];

    const applied = {
      hostGround,
      walked: all.length,
      reached: 0,
      counts: {},
      shortfalls: [],
      elements: [],
      priorities: [],
      subjects: { columnFrames: 0, cards: 0, priorityLines: 0, undrawnLines: 0, texts: 0 },
      worst: null,
    };

    /** Write a derived value and record the reading that justified it. */
    const write = (element, kind, properties, reading) => {
      const written = [];
      Object.keys(properties).forEach((property) => {
        if (properties[property] === null) return;
        element.style.setProperty(property, properties[property], "important");
        written.push(property);
      });
      element.setAttribute(KANBAN_ENCODING_ATTRIBUTE, kind);
      element.setAttribute(KANBAN_OWNED_LIST_ATTRIBUTE, written.join(","));
      applied.counts[kind] = (applied.counts[kind] || 0) + 1;
      applied.reached += 1;
      applied.elements.push(reading);
      if (reading.ratio < reading.target) applied.shortfalls.push(reading);
      if (applied.worst === null || reading.ratio < applied.worst) {
        applied.worst = reading.ratio;
      }
    };

    /** The inks of record first, the grey ramp only where neither clears. */
    const pickOutline = (grounds, target) => {
      const record = pickInkAgainst(KANBAN_INKS, grounds);
      return record.worst >= target
        ? record
        : pickInkAgainst(KANBAN_INK_RAMP, grounds);
    };

    // --- the subjects, derived from structure -------------------------------
    const columnRects = all.filter(
      (element) =>
        element.tagName === "rect" &&
        element.parentElement &&
        /(^|\s)cluster(\s|$)/.test(element.parentElement.getAttribute("class") || "")
    );
    const cardRects = all.filter(
      (element) =>
        element.tagName === "rect" &&
        (element.getAttribute("class") || "").includes("label-container")
    );
    const nodeGroups = all.filter(
      (element) =>
        element.tagName === "g" &&
        /(^|\s)node(\s|$)/.test(element.getAttribute("class") || "")
    );

    /** The column whose rect encloses this card, in client space. */
    const columnFor = (cardBox) =>
      columnRects
        .map((rect) => ({ rect, box: boxOf(rect) }))
        .find(
          (entry) =>
            entry.box &&
            cardBox.x >= entry.box.x - 1 &&
            cardBox.x + cardBox.w <= entry.box.x + entry.box.w + 1 &&
            cardBox.y >= entry.box.y - 1 &&
            cardBox.y + cardBox.h <= entry.box.y + entry.box.h + 1
        );

    // --- COLUMN FRAMES: the boundary, never the fill ------------------------
    columnRects.forEach((rect) => {
      const index = all.indexOf(rect);
      const box = boxOf(rect);
      if (!box) return;
      applied.subjects.columnFrames += 1;
      const grounds = groundsOver(edgePoints(box), index);
      const chosen = pickOutline(grounds, KANBAN_OBJECT_TARGET);
      write(
        rect,
        "columnFrameBoundary",
        { stroke: chosen.ink, "stroke-opacity": "1", "stroke-width": "2px" },
        {
          kind: "columnFrameBoundary",
          ink: chosen.ink,
          grounds: grounds,
          ratio: Number(chosen.worst.toFixed(2)),
          target: KANBAN_OBJECT_TARGET,
        }
      );
    });

    // --- CARDS: the boundary, never the fill --------------------------------
    cardRects.forEach((rect) => {
      const index = all.indexOf(rect);
      const box = boxOf(rect);
      if (!box) return;
      applied.subjects.cards += 1;
      const grounds = groundsOver(edgePoints(box), index);
      const chosen = pickOutline(grounds, KANBAN_OBJECT_TARGET);
      write(
        rect,
        "cardBoundary",
        { stroke: chosen.ink, "stroke-opacity": "1", "stroke-width": "2px" },
        {
          kind: "cardBoundary",
          ink: chosen.ink,
          grounds: grounds,
          ratio: Number(chosen.worst.toFixed(2)),
          target: KANBAN_OBJECT_TARGET,
        }
      );
    });

    // --- PRIORITY LINES: the non-colour channel, plus an ink for both grounds
    all.forEach((element, index) => {
      if (element.tagName !== "line" || offstage(element)) return;

      const computed = window.getComputedStyle(element);

      // IDENTIFY FROM THE STAMP FIRST. On a first sight the renderer's stroke
      // is the only witness there is; on a second application this pass has
      // already overwritten it, so re-deriving from the ink would be reading
      // this pass's own output.
      let priority = element.getAttribute(KANBAN_PRIORITY_ATTRIBUTE);
      if (!priority) {
        priority = KANBAN_PRIORITY_BY_STROKE[computed.stroke] || null;
        if (priority) element.setAttribute(KANBAN_PRIORITY_ATTRIBUTE, priority);
      }

      // AN UNDRAWN LINE IS NEVER PAINTED. A priority the canvas does not draw
      // computes `stroke: none`, and the picture stays exactly as the renderer
      // left it; the description discloses the value in words instead.
      const declared = parsePaint(computed.stroke);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.strokeOpacity) *
        opacityValue(computed.opacity);
      if (!priority || !declared || alpha <= 0.05) {
        applied.subjects.undrawnLines += 1;
        return;
      }

      applied.subjects.priorityLines += 1;
      const channel = KANBAN_PRIORITY_CHANNEL[priority];

      // BOTH GROUNDS. The line is drawn flush with the card's left edge and the
      // card carries rx=5, so its ends lie over the column showing through the
      // rounded corner; and at the doubled width the Very High line overhangs
      // the card's left edge by 2 user units onto the column outright. One ink
      // has to clear both, and that is measured rather than assumed.
      const group = element.parentElement;
      const card = group
        ? group.querySelector("rect[class*='label-container']")
        : null;
      const cardBox = card ? boxOf(card) : null;
      const cardGround = cardBox
        ? paintToHex(groundAt(cardBox.x + cardBox.w / 2, cardBox.y + cardBox.h / 2, index))
        : hostGround;
      const column = cardBox ? columnFor(cardBox) : null;
      const columnGround =
        column && column.box
          ? paintToHex(
              groundAt(
                column.box.x + column.box.w / 2,
                column.box.y + 2,
                all.indexOf(column.rect) + 1
              )
            )
          : hostGround;

      const grounds = [...new Set([cardGround, columnGround])];

      // THE INK KEEPS ITS HUE FAMILY and moves only as far as 3:1 needs.
      const rendererInk = paintToHex({ ...declared, a: 1 });
      const chosen = pickKanbanHueInk(rendererInk, grounds, KANBAN_OBJECT_TARGET);

      const baseWidth = parseFloat(computed.strokeWidth) || 4;
      const reading = {
        kind: "priorityLine",
        priority: priority,
        rendererInk: rendererInk,
        ink: chosen.ink,
        moved: chosen.moved,
        grounds: grounds,
        ratio: Number(chosen.worst.toFixed(2)),
        target: KANBAN_OBJECT_TARGET,
        width: baseWidth * channel.widthMultiple,
        dash: channel.dash,
        cap: channel.cap,
        rank: channel.rank,
      };
      applied.priorities.push(reading);

      write(
        element,
        "priorityLine",
        {
          stroke: chosen.ink,
          "stroke-opacity": "1",
          "stroke-width": `${baseWidth * channel.widthMultiple}px`,
          "stroke-dasharray": channel.dash,
          "stroke-linecap": channel.cap,
        },
        reading
      );
    });

    // --- TEXT, and ONLY where it fails --------------------------------------
    // Every label, ticket and assignee is HTML inside a <foreignObject>; a
    // kanban diagram contains NO SVG <text> at all, so the ink is `color` and
    // an instrument or a pass reading `fill` here would find nothing and read
    // as clean. The paint channel is `color`, which is why the export's
    // INLINED_HTML_PAINT_PROPERTIES branch is the one that carries it.
    const textLeafOf = (host) => {
      const candidates = [...host.querySelectorAll("*")].filter(
        (element) => (element.textContent || "").trim().length > 0
      );
      return candidates.length ? candidates[candidates.length - 1] : null;
    };

    const considerText = (host, kind) => {
      if (!host) return;
      const leaf = textLeafOf(host);
      const box = boxOf(host);
      if (!leaf || !box) return;
      applied.subjects.texts += 1;
      const index = all.indexOf(host);
      const computed = window.getComputedStyle(leaf);
      const declared = parsePaint(computed.color);
      if (!declared) return;
      const alpha = declared.a * opacityValue(computed.opacity);
      const grounds = groundsOver(spreadPoints(box), index);
      const worstNow = grounds.reduce(
        (lowest, ground) =>
          Math.min(
            lowest,
            calculateContrastRatio(
              paintToHex(
                compositeOver({ ...declared, a: alpha }, parsePaint(ground))
              ),
              ground
            )
          ),
        Infinity
      );
      // A label the renderer already got right is left exactly as it is:
      // rewriting it would overwrite a correct choice and make every later
      // reading a reading of this pass rather than of the page.
      if (worstNow >= KANBAN_TEXT_TARGET) return;
      const chosen = pickOutline(grounds, KANBAN_TEXT_TARGET);
      write(
        leaf,
        kind,
        { color: chosen.ink },
        {
          kind: kind,
          ink: chosen.ink,
          grounds: grounds,
          ratio: Number(chosen.worst.toFixed(2)),
          target: KANBAN_TEXT_TARGET,
          wasAt: Number(worstNow.toFixed(2)),
        }
      );
    };

    [...svg.querySelectorAll("foreignObject")].forEach((host) => {
      if (!host.closest("g.cluster-label")) return;
      considerText(host, "columnTitleText");
    });

    nodeGroups.forEach((group) => {
      const hosts = [...group.querySelectorAll("foreignObject")]
        .map((host) => ({ host, box: boxOf(host) }))
        .filter((entry) => entry.box);
      if (!hosts.length) return;
      hosts.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      const rest = hosts.slice(1).sort((a, b) => a.box.x - b.box.x);
      considerText(hosts[0].host, "cardLabelText");
      if (rest[0]) {
        considerText(
          rest[0].host,
          rest[0].host.closest("a") ? "ticketLinkText" : "ticketText"
        );
      }
      if (rest[1]) considerText(rest[1].host, "assigneeText");
    });

    logInfo(
      `Kanban encoding applied: ${applied.reached} of ${applied.walked} walked elements painted, ` +
        `${applied.subjects.priorityLines} priority lines given a non-colour channel, ` +
        `${applied.subjects.undrawnLines} undrawn lines left alone, worst ${applied.worst}:1 on ground ${hostGround}` +
        (applied.shortfalls.length
          ? `, ${applied.shortfalls.length} below target and recorded`
          : "")
    );
    return applied;
  }

  // -----------------------------------------------------------------------
  // RADAR DIAGRAM ENCODING (register item 93 session 7b, 30 September 2026)
  // -----------------------------------------------------------------------

  const RADAR_ROLEDESCRIPTION = "radar";

  /** SC 1.4.11 for every curve, ring, axis and legend swatch. */
  const RADAR_OBJECT_TARGET = 3;

  /** SC 1.4.3 for the title, the axis labels and the legend text. */
  const RADAR_TEXT_TARGET = 4.5;

  /** The outline inks of record (standard § 1.4), for text only. */
  const RADAR_INKS = Object.freeze(["#00131D", "#E1E8EC"]);

  /** Attribute marking an element this pass has painted, for idempotency. */
  const RADAR_ENCODING_ATTRIBUTE = "data-radar-encoding";

  /** The properties written to an element, recorded on it (standard rule 20). */
  const RADAR_OWNED_LIST_ATTRIBUTE = "data-radar-encoding-owned";

  /**
   * THE SERIES STAMP. The renderer's own witness to a series is the index in
   * its class — `radarCurve-N` on the curve and `radarLegendBox-N` on the
   * legend swatch, N being the DECLARATION index. That is the pairing key, and
   * colour is not: measured 30 September 2026, the renderer paints every curve
   * pure black under accessibleDark and highContrastDark, and two of three the
   * same grey under neutral, so a pairing by colour is ambiguous in six of the
   * eighteen theme cells. And the index is not the DOM position of the curve:
   * a curve whose value count differs from the axis count is not drawn at all
   * (census Q3), so the legend can hold `radarLegendBox-2` while the plot has
   * only curves 0 and 1. Read on first sight and never rewritten; it survives
   * the idempotency sweep (standard rule 24).
   */
  const RADAR_SERIES_ATTRIBUTE = "data-radar-series";

  /**
   * THE NON-COLOUR CHANNEL, one per series in declaration order (standard rule
   * 24). The dash arrays are the project's own — `SERIES_DASHES`, the Chart.js
   * `borderDash` list — so a radar series and an xychart line read as one
   * system. Chart.js names `15,3,3,3` "dash-dot" and `10,5,2,5`
   * "long-dash-short-dash"; the sixth is a DOUBLED width, the shape kanban's
   * Very High line takes. EVERY CAP IS `butt` (standard rule 25). A seventh
   * series CYCLES back to the first, and the pass reports that it did: with
   * seven or more series two of them share a channel, and only hue then
   * separates them.
   */
  const RADAR_SERIES_CHANNEL = Object.freeze([
    Object.freeze({ name: "solid", widthMultiple: 1, dash: null }),
    Object.freeze({ name: "dashed", widthMultiple: 1, dash: SERIES_DASHES[0] }),
    Object.freeze({ name: "dotted", widthMultiple: 1, dash: SERIES_DASHES[1] }),
    Object.freeze({ name: "dash-dot", widthMultiple: 1, dash: SERIES_DASHES[2] }),
    Object.freeze({ name: "long-dash-short-dash", widthMultiple: 1, dash: SERIES_DASHES[3] }),
    Object.freeze({ name: "double", widthMultiple: 2, dash: null }),
  ]);

  /**
   * THE WORKING MARGINS a DERIVED ink is taken to (standard § 2): 3.2:1 and
   * 4.7:1 rather than 3:1 and 4.5:1. A renderer ink already clearing the
   * target is kept as it is — the margin is not a raised bar for judging a
   * colour this project did not choose.
   */
  const RADAR_OBJECT_MARGIN = 3.2;
  const RADAR_TEXT_MARGIN = 4.7;

  /** Mermaid's own curve width, `themeVariables.radar.curveStrokeWidth`. */
  const RADAR_DEFAULT_CURVE_WIDTH = 2;

  /**
   * Stroke sampling: at least this many points, and at least one per
   * `RADAR_SAMPLE_SPACING` user units. A fixed count is NOT enough — the
   * renderer smooths each curve with Béziers that OVERSHOOT the outer ring in
   * short slivers lying on the page itself, and 48 points along a 1,262-unit
   * curve stepped straight over one (measured 30 September 2026, gold E6); a
   * spacing of 4 then stepped over a shorter one on gold E1. One per unit.
   */
  const RADAR_STROKE_SAMPLES = 48;
  const RADAR_SAMPLE_SPACING = 1;

  /**
   * The curve fill-opacities the pass may step down to, in order, and ONLY
   * where a later curve's fill hides an earlier curve's stroke that some ink
   * could otherwise reveal. The first value at which every such stroke clears
   * is taken, so the fill moves only as far as it has to.
   */
  const RADAR_FILL_OPACITY_LADDER = Object.freeze([0.35, 0.25, 0.15, 0.1, 0.05, 0]);

  /**
   * THE GRATICULE DISCS' FILL, written to `none` (design ruling RR31, 28
   * September 2026). Each disc is `#DEDEDE` at 0.3 whatever the theme and is
   * drawn in increasing radius, so it covers every smaller ring's stroke and
   * every axis. It carries no information — the rings' strokes carry the
   * scale — so it is removed, and the rings and axes are then read against
   * the page itself. It is written BEFORE the grounds are gathered, so no
   * disc is ever a ground or a cover in anything this pass derives.
   */
  const RADAR_GRATICULE_FILL = "none";

  /**
   * Points along an element's outline, in its OWN user units, at most
   * `spacing` apart, read from the element's geometry rather than from
   * `getPointAtLength`. Measured 30 September 2026: on the ten-by-five chart
   * `getPointAtLength` took 315 of the pass's 457 ms, because on a Bézier path
   * the browser walks from the path's start on every call. Circles, rects,
   * lines, polygons and paths made of M, L, C and Z are evaluated directly;
   * anything else falls back to `getPointAtLength`.
   *
   * @param {SVGGeometryElement} element
   * @param {number} spacing - The largest gap between samples, in user units
   * @param {number} minimum - The fewest samples to take
   * @returns {Array<{x: number, y: number}>}
   */
  function radarOutlinePoints(element, spacing, minimum) {
    const number = (name) => parseFloat(element.getAttribute(name)) || 0;
    const segments = [];
    const line = (a, b) => segments.push({ kind: "L", a, b });

    const tag = element.tagName;
    if (tag === "circle") {
      const cx = number("cx");
      const cy = number("cy");
      const r = number("r");
      const count = Math.max(minimum, Math.ceil((2 * Math.PI * r) / spacing));
      return Array.from({ length: count }, (unused, i) => {
        const angle = ((i + 0.5) / count) * 2 * Math.PI;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
    }
    if (tag === "line") {
      line({ x: number("x1"), y: number("y1") }, { x: number("x2"), y: number("y2") });
    } else if (tag === "rect") {
      const x = number("x");
      const y = number("y");
      const w = number("width");
      const h = number("height");
      line({ x, y }, { x: x + w, y });
      line({ x: x + w, y }, { x: x + w, y: y + h });
      line({ x: x + w, y: y + h }, { x, y: y + h });
      line({ x, y: y + h }, { x, y });
    } else if (tag === "polygon") {
      const values = (element.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      const vertices = [];
      for (let i = 0; i + 1 < values.length; i += 2) vertices.push({ x: values[i], y: values[i + 1] });
      vertices.forEach((vertex, i) => line(vertex, vertices[(i + 1) % vertices.length]));
    } else if (tag === "path") {
      const tokens = (element.getAttribute("d") || "").match(/[A-Za-z]|-?[\d.]+(?:e-?\d+)?/g) || [];
      let command = null;
      let start = null;
      let current = null;
      let i = 0;
      let supported = true;
      while (i < tokens.length && supported) {
        if (/[A-Za-z]/.test(tokens[i])) command = tokens[i++];
        const take = (n) => tokens.slice(i, (i += n)).map(Number);
        if (command === "M") {
          const [x, y] = take(2);
          current = start = { x, y };
          command = "L";
        } else if (command === "L") {
          const [x, y] = take(2);
          line(current, { x, y });
          current = { x, y };
        } else if (command === "C") {
          const [x1, y1, x2, y2, x, y] = take(6);
          segments.push({ kind: "C", a: current, c1: { x: x1, y: y1 }, c2: { x: x2, y: y2 }, b: { x, y } });
          current = { x, y };
        } else if (command === "Z" || command === "z") {
          if (start && current) line(current, start);
          current = start;
          command = null;
        } else {
          supported = false;
        }
      }
      if (!supported || !segments.length) segments.length = 0;
    }

    if (!segments.length) {
      if (typeof element.getTotalLength !== "function") return [];
      const length = element.getTotalLength();
      const count = Math.max(minimum, Math.ceil(length / spacing));
      return Array.from({ length: count }, (unused, i) =>
        element.getPointAtLength(((i + 0.5) / count) * length)
      );
    }

    const distance = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const points = [];
    const perSegment = Math.max(1, Math.ceil(minimum / segments.length));
    segments.forEach((segment) => {
      // A Bézier is never longer than its control polygon, so this bound on
      // its length gives at least one sample per `spacing` along it.
      const bound =
        segment.kind === "C"
          ? distance(segment.a, segment.c1) + distance(segment.c1, segment.c2) + distance(segment.c2, segment.b)
          : distance(segment.a, segment.b);
      const count = Math.max(perSegment, Math.ceil(bound / spacing));
      for (let k = 0; k < count; k += 1) {
        const t = (k + 0.5) / count;
        if (segment.kind === "L") {
          points.push({ x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t });
        } else {
          const u = 1 - t;
          const w0 = u * u * u;
          const w1 = 3 * u * u * t;
          const w2 = 3 * u * t * t;
          const w3 = t * t * t;
          points.push({
            x: w0 * segment.a.x + w1 * segment.c1.x + w2 * segment.c2.x + w3 * segment.b.x,
            y: w0 * segment.a.y + w1 * segment.c1.y + w2 * segment.c2.y + w3 * segment.b.y,
          });
        }
      }
    });
    return points;
  }

  /**
   * Normalise any CSS colour Mermaid writes into a config — `hsl(…)` above all
   * — to `#rrggbb`, so a config value can be compared with a computed paint.
   *
   * @param {string} value - A CSS colour
   * @returns {string|null} `#rrggbb`, or null when the value does not parse
   */
  function radarNormaliseColour(value) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext && canvas.getContext("2d");
    if (!context || typeof value !== "string") return null;
    const sentinel = "#010203";
    context.fillStyle = sentinel;
    context.fillStyle = value;
    const out = String(context.fillStyle).toLowerCase();
    if (out === sentinel && value.trim().toLowerCase() !== sentinel) return null;
    return /^#[0-9a-f]{6}$/.test(out) ? out : null;
  }

  /**
   * The theme's own SERIES palette, for a diagram whose renderer inks carry no
   * series information at all.
   *
   * WHICH PALETTE, AND WHY IT IS READ RATHER THAN NAMED. The palette a theme
   * gives its series is `themeVariables.xyChart.plotColorPalette` — for
   * accessibleDark `XYCHART_PALETTES.dark` and for highContrastDark
   * `darkHighContrast` — and the only place this pass can learn which theme
   * drew the SVG is Mermaid's live config. That config is GLOBAL, so it is
   * trusted only after it has been shown to be THIS diagram's: every series's
   * `cScaleN` in it must normalise to exactly the ink the renderer painted
   * series N with. Every caller reaches this pass immediately after the
   * diagram's own render (applyTheme, reapplyAfterRender, the export's second
   * copy), so the check holds in practice; where it does not, the pass falls
   * back to the palette of record for the ground's family and says so.
   *
   * @param {string[]} rendererInks - Hex ink per series index
   * @param {string} hostGround - Hex ground behind the diagram
   * @returns {{palette: string[], source: string}}
   */
  function readRadarSeriesPalette(rendererInks, hostGround) {
    let themeVariables = null;
    try {
      const config =
        window.mermaid && window.mermaid.mermaidAPI && window.mermaid.mermaidAPI.getConfig
          ? window.mermaid.mermaidAPI.getConfig()
          : null;
      themeVariables = config ? config.themeVariables : null;
    } catch (error) {
      logWarn("Radar encoding could not read the Mermaid config", error);
    }

    const verified =
      !!themeVariables &&
      rendererInks.every((ink, index) => {
        if (!ink) return true;
        const configured = radarNormaliseColour(themeVariables[`cScale${index}`]);
        return configured !== null && configured === ink.toLowerCase();
      });
    const declared =
      themeVariables && themeVariables.xyChart && themeVariables.xyChart.plotColorPalette;
    const palette = String(declared || "")
      .split(",")
      .map((entry) => radarNormaliseColour(entry.trim()))
      .filter(Boolean);

    if (verified && palette.length) return { palette, source: "theme config" };

    const [r, g, b] = hexToRgb(hostGround);
    const darkGround = calculateLuminance([r, g, b]) < 0.18;
    return {
      palette: (darkGround ? XYCHART_PALETTES.dark : XYCHART_PALETTES.light).split(","),
      source: verified ? "fallback: the config carries no series palette" : "fallback: the config is not this diagram's",
    };
  }

  /**
   * The contrast of an ink against its ground AS SEEN: every fill painted
   * LATER that covers the point is composited over BOTH the ink and the
   * ground, because that is what the page shows. A radar paints later fills
   * over earlier strokes — each curve at fill-opacity 0.5 over the rings, the
   * axes and every earlier curve — so a ratio taken against the ground alone
   * describes a picture nobody is shown.
   *
   * @param {string} ink - Hex ink
   * @param {{ground: string, cover: Array}} context - The ground below, and the covering paints in order
   * @returns {number} The ratio
   */
  function radarSeenRatio(ink, context) {
    // Numeric throughout: this runs for every candidate ink against every
    // context, and a hex round trip per step cost most of the pass's time.
    let shown = typeof ink === "string" ? parsePaint(ink) : ink;
    let ground = context.groundPaint || parsePaint(context.ground);
    context.cover.forEach((paint) => {
      shown = compositeOver(paint, shown);
      ground = compositeOver(paint, ground);
    });
    const a = radarLuminance(shown);
    const b = radarLuminance(ground);
    const value = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    // A non-finite reading LOSES outright (standard rule 26).
    return Number.isFinite(value) ? value : -1;
  }

  /**
   * WCAG relative luminance of a parsed paint, channels rounded as `#rrggbb`
   * would round them, so the figure matches calculateContrastRatio's.
   *
   * @param {{r: number, g: number, b: number}} paint
   * @returns {number}
   */
  function radarLuminance(paint) {
    return calculateLuminance([
      Math.min(255, Math.max(0, Math.round(paint.r))),
      Math.min(255, Math.max(0, Math.round(paint.g))),
      Math.min(255, Math.max(0, Math.round(paint.b))),
    ]);
  }

  /**
   * Move an ink along its OWN hue's lightness ramp, outward from where the
   * renderer or the palette put it, and stop at the FIRST value clearing
   * every context — kanban's pickKanbanHueInk, scored as SEEN rather than
   * against bare grounds, and reusing its HSL helpers rather than a copy.
   *
   * The starting ink is KEPT where it already clears `target`; a moved ink is
   * taken to `margin` where the ramp reaches it, and otherwise the ramp's best.
   *
   * @param {string} hex - The starting ink
   * @param {Array} contexts - `{ground, cover}` per distinct place the ink sits
   * @param {number} target - The ratio to clear
   * @param {number} margin - The ratio a moved ink is taken to
   * @returns {{ink: string, worst: number, cleared: boolean, moved: boolean}}
   */
  function pickRadarHueInk(hex, contexts, target, margin) {
    // `floor`: once a candidate's running worst is at or below the best found
    // so far it can neither win nor clear, so the scan stops there. Exact.
    const worstOf = (candidate, floor = -Infinity) => {
      const paint = parsePaint(candidate);
      let lowest = Infinity;
      for (const context of contexts) {
        lowest = Math.min(lowest, radarSeenRatio(paint, context));
        if (lowest <= floor) return lowest;
      }
      return lowest;
    };

    const original = contexts.length ? worstOf(hex) : Infinity;
    if (original >= target) {
      return { ink: hex, worst: original, cleared: true, moved: false };
    }

    const hsl = kanbanHexToHsl(hex);
    let best = hex;
    let bestWorst = original;

    for (let step = 1; step <= KANBAN_HUE_RAMP_STEPS; step += 1) {
      const delta = step / KANBAN_HUE_RAMP_STEPS;
      const candidates = [hsl.l - delta, hsl.l + delta].filter((l) => l >= 0 && l <= 1);

      for (const lightness of candidates) {
        const candidate = kanbanHslToHex(hsl.h, hsl.s, lightness);
        const worst = worstOf(candidate, bestWorst);
        if (worst > bestWorst) {
          bestWorst = worst;
          best = candidate;
        }
        if (worst >= margin) {
          return { ink: candidate, worst: worst, cleared: true, moved: true };
        }
      }
    }

    return { ink: best, worst: bestWorst, cleared: bestWorst >= target, moved: best !== hex };
  }

  /**
   * Apply the accessibility encoding to a rendered radar chart: a NON-COLOUR
   * CHANNEL per series on its curve and its legend swatch, an outline ink per
   * curve, ring, axis and swatch that clears the ground it sits on, and a text
   * ink WHERE AND ONLY WHERE a text fails.
   *
   * WHY IT EXISTS — the measurement, nine selectable themes times two site
   * modes times seven sources, every value COMPUTED (register item 93,
   * 30 September 2026). Before this pass the series were separated by HUE
   * AND NOTHING ELSE — every curve `stroke-width: 2px`, no dash, butt cap,
   * `fill-opacity: 0.5`, no marker, in all eighteen cells (census Q9) — and
   * in six cells not even by hue: accessibleDark and highContrastDark paint
   * every curve pure black, and neutral paints two of three the same grey.
   * Curve strokes failed 3:1 against their own ground in most cells, rings in
   * every light-site cell, and title, axis and legend text in every cell where
   * the theme's family and the site mode disagree.
   *
   * WHY AN AFTER-RENDER PASS. A theme DOES reach a radar chart — nine distinct
   * fingerprints per site mode, matching a flowchart control — but no theme
   * variable reaches the defect that matters: the absence of any channel but
   * colour. And every radar paint is a CLASS RULE in Mermaid's in-SVG
   * `<style>`, so a presentation attribute would be inert (standard rule 5):
   * everything here is written as an inline style at `important` priority,
   * which `cloneNode(true)` carries into an export by construction.
   *
   * GROUNDS ARE RESOLVED AS SEEN. A radar paints LATER FILLS OVER EARLIER
   * STROKES, so a curve's ink is chosen against the ground below it AND with
   * every later curve's fill composited over both. Containment is exact —
   * `isPointInFill` in each shape's own user space, reached from a client
   * point through its screen matrix (standard rule 27) — because the bounding
   * box of a circle or a polygon contains points the shape does not.
   *
   * FILLS. The renderer's fills are left alone and reported, with ONE
   * exception the design ruling names: where a later curve's fill hides an
   * earlier curve's stroke that some ink could otherwise reveal, every curve
   * fill-opacity — and its legend swatch, so the key still matches — steps
   * down `RADAR_FILL_OPACITY_LADDER` to the first value at which every such
   * stroke clears. The graticule's own fills, which covered the inner rings'
   * strokes and the axes, are written to `none` (ruling RR31): they carry no
   * information, and nothing else could clear what they hid.
   *
   * WHICH CASE OF RULE 16 THIS IS: THE SECOND. Mermaid draws every curve,
   * swatch, ring, axis and text this pass paints; it adds no node.
   *
   * IDEMPOTENT BY CONSTRUCTION: every derivation reads the renderer's values,
   * restored by sweeping exactly the properties the previous run recorded,
   * and the series identity comes from the stamp.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was applied and every ratio measured, or null
   */
  function applyRadarEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === RADAR_ROLEDESCRIPTION
        ? root
        : root.querySelector(`svg[aria-roledescription="${RADAR_ROLEDESCRIPTION}"]`);

    if (!svg) {
      logDebug("No radar SVG in this container - radar encoding skipped");
      return null;
    }

    // --- sweep what a previous run owned, and ONLY that ----------------------
    // The series stamp is not swept: it is the identity this pass keys on.
    svg.querySelectorAll(`[${RADAR_ENCODING_ATTRIBUTE}]`).forEach((owned) => {
      (owned.getAttribute(RADAR_OWNED_LIST_ATTRIBUTE) || "")
        .split(",")
        .filter(Boolean)
        .forEach((property) => owned.style.removeProperty(property));
      owned.removeAttribute(RADAR_ENCODING_ATTRIBUTE);
      owned.removeAttribute(RADAR_OWNED_LIST_ATTRIBUTE);
    });

    const all = [...svg.querySelectorAll("*")];
    const offstage = (element) =>
      !!(
        element.closest("defs") ||
        element.closest("symbol") ||
        element.closest("clipPath") ||
        element.closest("marker")
      );
    const classOf = (element) => element.getAttribute("class") || "";
    const classIndex = (element, prefix) => {
      const match = classOf(element).match(new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`));
      return match ? Number(match[1]) : null;
    };

    // --- the subjects, by the renderer's own classes ------------------------
    const curves = all.filter(
      (element) =>
        (element.tagName === "path" || element.tagName === "polygon") &&
        classIndex(element, "radarCurve") !== null
    );
    const swatches = all.filter(
      (element) => element.tagName === "rect" && classIndex(element, "radarLegendBox") !== null
    );
    const rings = all.filter((element) => /(^|\s)radarGraticule(\s|$)/.test(classOf(element)));
    const axes = all.filter(
      (element) => element.tagName === "line" && /(^|\s)radarAxisLine(\s|$)/.test(classOf(element))
    );
    const texts = all.filter(
      (element) => element.tagName === "text" && (element.textContent || "").trim().length > 0
    );

    // --- THE STAMP, on first sight ------------------------------------------
    [...curves, ...swatches].forEach((element) => {
      if (element.hasAttribute(RADAR_SERIES_ATTRIBUTE)) return;
      const index = classIndex(element, element.tagName === "rect" ? "radarLegendBox" : "radarCurve");
      element.setAttribute(RADAR_SERIES_ATTRIBUTE, String(index));
    });
    const seriesOf = (element) => Number(element.getAttribute(RADAR_SERIES_ATTRIBUTE));

    const hostGround = resolveHostGround(svg);
    const hostPaint = parsePaint(hostGround);

    // --- RR31: the graticule discs lose their fill, BEFORE any ground is read.
    // Recorded on the element by paintOutline below, so the next run sweeps it.
    rings.forEach((element) => element.style.setProperty("fill", RADAR_GRATICULE_FILL, "important"));

    // --- the areas that can be a ground, and the geometry to reach them -----
    // A <line> and a <text> are never grounds (standard rule 21).
    const AREA_TAGS = ["circle", "polygon", "path", "rect", "ellipse"];
    const areas = [];
    all.forEach((element, index) => {
      if (!AREA_TAGS.includes(element.tagName) || offstage(element)) return;
      const computed = window.getComputedStyle(element);
      const declared = parsePaint(computed.fill);
      const alpha =
        (declared ? declared.a : 0) *
        opacityValue(computed.fillOpacity) *
        opacityValue(computed.opacity);
      if (!declared || alpha <= 0.02) return;
      areas.push({
        element,
        index,
        paint: declared,
        opacity: opacityValue(computed.opacity),
        rendererFillOpacity: opacityValue(computed.fillOpacity),
        isCurve: curves.includes(element),
      });
    });

    // Screen matrices are read ONCE per element: nothing this pass writes
    // moves a shape, and reading them per sample cost most of the geometry.
    const geometryResolved = !!svg.getScreenCTM();
    const forward = new Map();
    const inverse = new Map();
    const forwardOf = (element) => {
      if (!forward.has(element)) forward.set(element, element.getScreenCTM());
      return forward.get(element);
    };
    const inverseOf = (element) => {
      if (!inverse.has(element)) {
        const matrix = forwardOf(element);
        inverse.set(element, matrix ? matrix.inverse() : null);
      }
      return inverse.get(element);
    };
    const toClient = (element, point) =>
      new DOMPoint(point.x, point.y).matrixTransform(forwardOf(element));
    // A shape never paints outside its own client box, so the box rejects
    // most points before the exact (and far dearer) isPointInFill test.
    const boxes = new Map();
    const contains = (element, x, y) => {
      if (!boxes.has(element)) boxes.set(element, element.getBoundingClientRect());
      const box = boxes.get(element);
      if (x < box.left - 1 || x > box.right + 1 || y < box.top - 1 || y > box.bottom + 1) return false;
      const m = inverseOf(element);
      if (!m) return false;
      return element.isPointInFill({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    };

    /** Points along a stroke's centreline, in client space, dense by length. */
    const strokePoints = (element, minimum) => {
      if (!geometryResolved) return [];
      return radarOutlinePoints(element, RADAR_SAMPLE_SPACING, minimum).map((point) =>
        toClient(element, point)
      );
    };

    /**
     * Points over a text's box, in client space: a 5 x 3 grid reaching the
     * box's own ends. An axis label can overhang the outer graticule disc at
     * one end only, and a grid stopping short of the end stepped over it
     * twice — five central points, then a grid to within 5% of each end
     * (measured 30 September 2026, `dark` on the dark site).
     */
    const boxPoints = (element) => {
      if (!geometryResolved) return [];
      const box = element.getBBox();
      const points = [];
      [0, 0.25, 0.5, 0.75, 1].forEach((fx) =>
        [0.25, 0.5, 0.75].forEach((fy) =>
          points.push(toClient(element, { x: box.x + box.width * fx, y: box.y + box.height * fy }))
        )
      );
      return points;
    };

    /**
     * Where a subject sits: per sample, the areas painted BELOW it and the
     * areas painted OVER it, its own fill excluded. Resolved once; the ladder
     * below only changes the curve fills' alpha, never the geometry.
     */
    const placesOf = (subject, points) => {
      const own = all.indexOf(subject);
      // Many samples sit on the same stack of areas; keep one place per stack.
      const unique = new Map();
      points.forEach((point) => {
        const below = [];
        const cover = [];
        areas.forEach((area) => {
          if (area.element === subject) return;
          if (!contains(area.element, point.x, point.y)) return;
          (area.index < own ? below : cover).push(area);
        });
        const key = below.map((a) => a.index).join(",") + "|" + cover.map((a) => a.index).join(",");
        if (!unique.has(key)) unique.set(key, { below, cover });
      });
      return [...unique.values()];
    };

    /** The alpha an area paints with, given the curve fill-opacity in force. */
    const alphaOf = (area, curveFillOpacity) =>
      area.paint.a *
      area.opacity *
      (area.isCurve && curveFillOpacity !== null ? curveFillOpacity : area.rendererFillOpacity);

    /** Distinct `{ground, cover}` contexts for a set of places. */
    const contextsOf = (places, curveFillOpacity, withCover) => {
      const seen = new Map();
      places.forEach((place) => {
        const groundPaint = place.below.reduce(
          (colour, area) => compositeOver({ ...area.paint, a: alphaOf(area, curveFillOpacity) }, colour),
          hostPaint
        );
        const ground = paintToHex(groundPaint);
        const cover = withCover
          ? place.cover.map((area) => ({ ...area.paint, a: alphaOf(area, curveFillOpacity) }))
          : [];
        const key = ground + "|" + cover.map((paint) => paintToHex(paint) + paint.a).join(",");
        if (!seen.has(key)) seen.set(key, { ground, groundPaint, cover });
      });
      if (!places.length) {
        seen.set(hostGround, { ground: hostGround, groundPaint: hostPaint, cover: [] });
      }
      return [...seen.values()];
    };

    const applied = {
      hostGround,
      geometryResolved,
      walked: all.length,
      reached: 0,
      counts: {},
      shortfalls: [],
      series: [],
      palette: null,
      fill: null,
      subjects: {
        curves: curves.length,
        swatches: swatches.length,
        rings: rings.length,
        axes: axes.length,
        texts: texts.length,
      },
      worst: null,
    };

    /** Write a derived value and record the reading that justified it. */
    const write = (element, kind, properties, reading) => {
      const written = [];
      Object.keys(properties).forEach((property) => {
        if (properties[property] === null) return;
        element.style.setProperty(property, properties[property], "important");
        written.push(property);
      });
      element.setAttribute(RADAR_ENCODING_ATTRIBUTE, kind);
      element.setAttribute(RADAR_OWNED_LIST_ATTRIBUTE, written.join(","));
      applied.counts[kind] = (applied.counts[kind] || 0) + 1;
      applied.reached += 1;
      if (reading && reading.ratio < reading.target) applied.shortfalls.push(reading);
      if (reading && (applied.worst === null || reading.ratio < applied.worst)) {
        applied.worst = reading.ratio;
      }
    };

    const strokeHex = (element) => {
      const paint = parsePaint(window.getComputedStyle(element).stroke);
      return paint ? paintToHex({ ...paint, a: 1 }) : null;
    };

    // --- THE SERIES: identity, renderer ink, places -------------------------
    const indices = [...new Set([...curves, ...swatches].map(seriesOf))].sort((a, b) => a - b);
    const series = indices.map((index) => {
      const curve = curves.find((element) => seriesOf(element) === index) || null;
      const swatch = swatches.find((element) => seriesOf(element) === index) || null;
      const rendererInk = (curve && strokeHex(curve)) || (swatch && strokeHex(swatch)) || null;
      const curvePlaces = curve ? placesOf(curve, strokePoints(curve, RADAR_STROKE_SAMPLES)) : [];
      const swatchPlaces = swatch ? placesOf(swatch, strokePoints(swatch, 16)) : [];
      const baseWidth = curve
        ? parseFloat(window.getComputedStyle(curve).strokeWidth) || RADAR_DEFAULT_CURVE_WIDTH
        : RADAR_DEFAULT_CURVE_WIDTH;
      return { index, curve, swatch, rendererInk, curvePlaces, swatchPlaces, baseWidth };
    });

    // --- WHERE THE RENDERER'S INKS CARRY NO SERIES INFORMATION --------------
    // Every series one ink: the theme's own series palette instead.
    const rendererInks = [];
    series.forEach((entry) => (rendererInks[entry.index] = entry.rendererInk));
    const distinctInks = new Set(series.map((entry) => entry.rendererInk).filter(Boolean));
    const collapsed = series.length >= 2 && distinctInks.size === 1;
    const palette = collapsed ? readRadarSeriesPalette(rendererInks, hostGround) : null;
    applied.palette = {
      collapsed,
      source: palette ? palette.source : "the renderer's own inks",
      entries: palette ? palette.palette : null,
    };
    series.forEach((entry) => {
      entry.baseInk = palette
        ? palette.palette[entry.index % palette.palette.length]
        : entry.rendererInk || RADAR_INKS[0];
    });

    /**
     * Derive every series ink with the curve fills at a given opacity.
     *
     * ONE INK FOR A CURVE AND ITS SWATCH WHERE ONE EXISTS, TWO WHERE IT DOES
     * NOT. Measured in the dark site mode: the graticule's discs are
     * `#DEDEDE` at 0.3 whatever the theme, so they stack into a LIGHT
     * bullseye on the dark page — a curve crosses grounds from `#635F60` to
     * `#C0BFC0` and only a near-black ink clears it, while its swatch sits on
     * the page itself and only a light ink clears that. No single colour
     * satisfies both. So a shared ink is tried first; where none clears, the
     * curve and the swatch are each moved from the SAME base hue, only as far
     * as their own grounds need, and the split is reported. The dash, the cap
     * and the width still pair them.
     */
    const deriveSeries = (curveFillOpacity) =>
      series.map((entry) => {
        const curveContexts = entry.curve ? contextsOf(entry.curvePlaces, curveFillOpacity, true) : [];
        const swatchContexts = entry.swatch ? contextsOf(entry.swatchPlaces, curveFillOpacity, true) : [];
        const pick = (contexts) =>
          pickRadarHueInk(entry.baseInk, contexts, RADAR_OBJECT_TARGET, RADAR_OBJECT_MARGIN);
        const joint = pick([...curveContexts, ...swatchContexts]);
        if (joint.cleared || !entry.curve || !entry.swatch) {
          return { curve: joint, swatch: joint, split: false };
        }
        return { curve: pick(curveContexts), swatch: pick(swatchContexts), split: true };
      });

    // --- THE FILL DECISION: does a later curve's fill hide a stroke? --------
    // Only a curve stroke that CAN clear once nothing covers it is being
    // hidden; one that cannot clear even then fails for another reason, and
    // moving a fill would not help it.
    const atRenderer = deriveSeries(null);
    const uncovered = deriveSeries(0);
    const hideable = series.filter(
      (entry, i) => entry.curve && uncovered[i].curve.cleared && !atRenderer[i].curve.cleared
    );
    let chosen = atRenderer;
    let fillOpacity = null;
    if (hideable.length) {
      for (const step of RADAR_FILL_OPACITY_LADDER) {
        const trial = deriveSeries(step);
        const allClear = series.every(
          (entry, i) => !entry.curve || !uncovered[i].curve.cleared || trial[i].curve.cleared
        );
        if (allClear) {
          chosen = trial;
          fillOpacity = step;
          break;
        }
      }
    }
    applied.fill = {
      rendererFillOpacity: curves.length
        ? opacityValue(window.getComputedStyle(curves[0]).fillOpacity)
        : null,
      chosen: fillOpacity,
      hidden: hideable.map((entry) => entry.index),
      reason:
        fillOpacity === null
          ? hideable.length
            ? "a later curve's fill hides a stroke and no step on the ladder frees it"
            : "no curve's fill hides another curve's stroke; the renderer's fills are untouched"
          : `a later curve's fill hid series ${hideable.map((entry) => entry.index).join(", ")}; every curve and swatch fill-opacity stepped to ${fillOpacity}`,
    };

    // --- WRITE the series: curve, swatch, channel, ink ----------------------
    series.forEach((entry, i) => {
      const channel = RADAR_SERIES_CHANNEL[entry.index % RADAR_SERIES_CHANNEL.length];
      const picks = chosen[i];
      const width = `${entry.baseWidth * channel.widthMultiple}px`;
      const reading = (pick, kind) => ({
        kind,
        series: entry.index,
        drawn: !!entry.curve,
        legend: !!entry.swatch,
        rendererInk: entry.rendererInk,
        baseInk: entry.baseInk,
        ink: pick.ink,
        moved: pick.moved,
        split: picks.split,
        ratio: Number(pick.worst.toFixed(2)),
        target: RADAR_OBJECT_TARGET,
        channel: channel.name,
        cycled: entry.index >= RADAR_SERIES_CHANNEL.length,
        width,
        dash: channel.dash,
      });
      const properties = (pick) => ({
        stroke: pick.ink,
        "stroke-opacity": "1",
        "stroke-width": width,
        "stroke-dasharray": channel.dash,
        "stroke-linecap": "butt",
        "fill-opacity": fillOpacity === null ? null : String(fillOpacity),
      });
      if (entry.curve) {
        const curveReading = reading(picks.curve, "curve");
        applied.series.push(curveReading);
        write(entry.curve, "curve", properties(picks.curve), curveReading);
      }
      if (entry.swatch) {
        const swatchReading = reading(picks.swatch, "swatch");
        applied.series.push(swatchReading);
        write(entry.swatch, "swatch", properties(picks.swatch), swatchReading);
      }
    });
    if (series.some((entry) => entry.index >= RADAR_SERIES_CHANNEL.length)) {
      logWarn(
        `Radar encoding: ${series.length} series, more than the ${RADAR_SERIES_CHANNEL.length} channels; the channel cycles and hue alone separates the repeats`
      );
    }

    // --- RINGS and AXES: an ink against the ground below --------------------
    // `extra` carries properties already set earlier in this run (the ring
    // fill), so they are recorded with the rest and swept by the next run.
    const paintOutline = (element, kind, count, extra = {}) => {
      const ink = strokeHex(element);
      if (!ink) {
        if (Object.keys(extra).length) write(element, kind, extra, null);
        return;
      }
      const contexts = contextsOf(
        placesOf(element, strokePoints(element, count)),
        fillOpacity,
        false
      );
      const pick = pickRadarHueInk(ink, contexts, RADAR_OBJECT_TARGET, RADAR_OBJECT_MARGIN);
      write(
        element,
        kind,
        { ...extra, stroke: pick.ink, "stroke-opacity": "1" },
        {
          kind,
          rendererInk: ink,
          ink: pick.ink,
          moved: pick.moved,
          ratio: Number(pick.worst.toFixed(2)),
          target: RADAR_OBJECT_TARGET,
        }
      );
    };
    rings.forEach((element) =>
      paintOutline(element, "ring", RADAR_STROKE_SAMPLES, { fill: RADAR_GRATICULE_FILL })
    );
    axes.forEach((element) => paintOutline(element, "axis", 24));

    // --- TEXT, and ONLY where it fails, AS SEEN -----------------------------
    texts.forEach((element) => {
      const computed = window.getComputedStyle(element);
      const declared = parsePaint(computed.fill);
      if (!declared) return;
      const contexts = contextsOf(placesOf(element, boxPoints(element)), fillOpacity, true);
      const shownInk = paintToHex(
        compositeOver({ ...declared, a: declared.a * opacityValue(computed.opacity) }, hostPaint)
      );
      const now = contexts.reduce(
        (lowest, context) => Math.min(lowest, radarSeenRatio(shownInk, context)),
        Infinity
      );
      // A text the renderer already got right is left exactly as it is.
      if (now >= RADAR_TEXT_TARGET) return;
      const score = (candidate) =>
        contexts.reduce((lowest, context) => Math.min(lowest, radarSeenRatio(candidate, context)), Infinity);
      const pool = score(RADAR_INKS[0]) >= score(RADAR_INKS[1]) ? RADAR_INKS[0] : RADAR_INKS[1];
      const ink =
        score(pool) >= RADAR_TEXT_MARGIN
          ? pool
          : KANBAN_INK_RAMP.reduce((best, candidate) => (score(candidate) > score(best) ? candidate : best), pool);
      const kind = /radarTitle/.test(classOf(element))
        ? "titleText"
        : /radarLegendText/.test(classOf(element))
          ? "legendText"
          : "axisLabelText";
      write(
        element,
        kind,
        { fill: ink },
        {
          kind,
          ink,
          ratio: Number(score(ink).toFixed(2)),
          target: RADAR_TEXT_TARGET,
          wasAt: Number(now.toFixed(2)),
        }
      );
    });

    logInfo(
      `Radar encoding applied: ${series.length} series given a non-colour channel ` +
        `(palette: ${applied.palette.source}), ${applied.reached} of ${applied.walked} walked elements painted, ` +
        `curve fill-opacity ${fillOpacity === null ? "untouched" : fillOpacity}, worst ${applied.worst}:1 on ground ${hostGround}` +
        (applied.shortfalls.length ? `, ${applied.shortfalls.length} below target and recorded` : "")
    );
    return applied;
  }


  // -----------------------------------------------------------------------
  // PAGE INK ENCODING (Mermaid UI review parcel 10, 26 September 2026)
  // -----------------------------------------------------------------------

  const QUADRANT_ROLEDESCRIPTION = "quadrantChart";

  /** Attribute marking an element this pass has painted, for idempotency. */
  const PAGE_INK_ATTRIBUTE = "data-page-ink-encoding";

  /**
   * What each kind of marked element owns, and therefore what is swept before
   * re-writing. Per kind, not one list: a quadrant border line also carries
   * Mermaid's own inline stroke-width, which a blanket sweep would delete.
   */
  const PAGE_INK_OWNED_PROPERTIES = Object.freeze({
    root: Object.freeze(["color"]),
    bar: Object.freeze(["stroke", "stroke-width"]),
    line: Object.freeze(["stroke-width"]),
    border: Object.freeze(["stroke"]),
  });

  /** A bar's outline width. Mermaid hard-codes 0. */
  const XYCHART_BAR_OUTLINE_WIDTH = "2px";

  /** A line series' width, for legibility. Mermaid hard-codes 2. */
  const XYCHART_LINE_WIDTH = "3px";

  /**
   * Write onto the SVG itself the paint the PAGE used to supply, so a diagram
   * paints the same detached — an export, a copied SVG, a re-rendered
   * interactive export — as it does on tools.html. Runs for EVERY diagram.
   *
   * WHAT THE PAGE SUPPLIED, measured by the fifth design seat's probe and the
   * UI guard's PT rows (26 September 2026): the same svg.outerHTML in an
   * iframe with no site CSS differed from the page in exactly 45 element-
   * properties on five diagrams, in every one of the nine theme/mode cells,
   * and every page value was one of the two outline inks of record:
   *
   *   - the INHERITED ink: gantt axis and tick lines are `stroke:
   *     currentColor`, and the state and class HTML labels inherit `color`,
   *     both from the page's text colour. One write — the root's `color` —
   *     carries all of them;
   *   - the XYCHART rules (light.css / dark.css, until parcel 10 step 2): a
   *     2px outline on every bar and a 3px line series. Mermaid hard-codes the
   *     bar outline to `strokeWidth: 0` and the line to `2`, no theme variable
   *     reaches either, and it paints them with d3 `.attr()` — PRESENTATION
   *     ATTRIBUTES, the weakest source in the cascade — so an author rule beat
   *     them (disable-and-remeasure, 25 August 2026). A line's colour IS its
   *     palette colour and is left alone; only its width is written;
   *   - the QUADRANT rule: the six `g.border` lines are the only thing marking
   *     where one quadrant ends and the next begins — the four fills differ
   *     from each other and from the card by 1.00-1.66:1 in every theme — and
   *     Mermaid's own border measured 1.27-1.91:1 in four of nine cells,
   *     `accessibleDark`, the dark-mode default, among them (1 September
   *     2026). Mermaid writes that border as an INLINE STYLE, not an attribute,
   *     so the plain stylesheet rule was inert and it needed `!important`
   *     (disable-and-remeasure). An inline write replaces Mermaid's value in
   *     place. The stroke WIDTH is Mermaid's and is untouched.
   *
   * WHY AN AFTER-RENDER PASS AND NOT THEME VARIABLES: no theme variable
   * reaches any of these properties, and four of the nine cells are Mermaid
   * built-ins that applyTheme reaches with no themeVariables at all — the
   * gantt, sequence and block passes' argument, unchanged.
   *
   * WHY THE INK IS DERIVED AND NOT READ FROM THE SITE MODE: the two inks of
   * record are both offered to every derivation, and each element takes the
   * one that best clears the ground it sits on (standard rule 18, as the block
   * pass does) — the page's ground for the root colour, the chart's own
   * background for a bar, and for a quadrant border every surface the line
   * touches, the four quadrant fills and the page, maximising the WORST ratio
   * (rule 12: a quadrant chart is banded). In all nine cells that reproduces
   * what the stylesheets wrote: #00131D on every light ground (18.9:1 against
   * the white every light theme uses; 13.63-18.90:1 across the quadrant
   * surfaces) and #E1E8EC on every dark one (10.2:1, 13.46:1, 16.96:1 against
   * dark, accessibleDark and highContrastDark; 7.03-16.96:1 across the
   * quadrant surfaces). There is no fallback ramp, unlike the block pass: no
   * selectable cell presents a ground neither ink clears.
   *
   * WHY THE SELECTOR IS THE ROLEDESCRIPTION: every toolbar button carries an
   * inline icon <svg>, and a container-scoped query can reach those — that
   * trap once reported a diagram empty when the probe had read a button icon.
   * Mermaid sets aria-roledescription on the diagram root only.
   *
   * WRITTEN AS INLINE STYLE, which survives cloneNode(true) and innerHTML
   * serialisation, so every export path carries it without inlining computed
   * paint. It NEVER calls applyTheme: it is reached FROM the re-render
   * (register item 56). Idempotent: every derivation reads only backgrounds
   * and fills this pass never writes, and each marked element's owned
   * properties are swept before being written again.
   *
   * @param {HTMLElement|SVGElement} root - A container, a .mermaid div, or the SVG
   * @returns {Object|null} What was written, or null if no diagram was found
   */
  function applyPageInkEncoding(root) {
    if (!root) return null;

    const svg =
      root.tagName === "svg" && root.hasAttribute("aria-roledescription")
        ? root
        : root.querySelector("svg[aria-roledescription]");

    if (!svg) {
      logDebug("No diagram SVG in this container - page ink encoding skipped");
      return null;
    }

    // --- sweep what a previous run owned, kind by kind ----------------------
    const owned = [
      ...(svg.hasAttribute(PAGE_INK_ATTRIBUTE) ? [svg] : []),
      ...svg.querySelectorAll(`[${PAGE_INK_ATTRIBUTE}]`),
    ];
    owned.forEach((element) => {
      const kind = element.getAttribute(PAGE_INK_ATTRIBUTE);
      (PAGE_INK_OWNED_PROPERTIES[kind] || []).forEach((property) =>
        element.style.removeProperty(property)
      );
      element.removeAttribute(PAGE_INK_ATTRIBUTE);
    });

    const hostGround = resolveHostGround(svg);
    const inkOn = (grounds) => pickInkAgainst(BLOCK_OUTLINE_INKS, grounds).ink;
    const mark = (element, kind) =>
      element.setAttribute(PAGE_INK_ATTRIBUTE, kind);
    const applied = { type: svg.getAttribute("aria-roledescription"), hostGround };

    // --- the inherited ink: one write on the root ---------------------------
    applied.rootInk = inkOn([hostGround]);
    svg.style.setProperty("color", applied.rootInk, "important");
    mark(svg, "root");

    const type = applied.type;

    // --- xychart: bar outlines and line widths ------------------------------
    if (type === XYCHART_ROLEDESCRIPTION) {
      const chartPaint = parsePaint(resolveGroundColour(svg));
      const chartGround = chartPaint
        ? paintToHex(compositeOver(chartPaint, parsePaint(hostGround)))
        : hostGround;
      applied.barInk = inkOn([chartGround]);

      const bars = svg.querySelectorAll('g[class^="bar-plot"] rect');
      bars.forEach((bar) => {
        bar.style.setProperty("stroke", applied.barInk, "important");
        bar.style.setProperty("stroke-width", XYCHART_BAR_OUTLINE_WIDTH, "important");
        mark(bar, "bar");
      });

      // Mermaid's own paths only: a previous series pass's casings are
      // swept and rebuilt after this runs, and must keep their own width.
      const lines = svg.querySelectorAll(
        `g[class^="line-plot"] path:not([${CASING_ATTRIBUTE}])`
      );
      lines.forEach((line) => {
        line.style.setProperty("stroke-width", XYCHART_LINE_WIDTH, "important");
        mark(line, "line");
      });

      applied.bars = bars.length;
      applied.lines = lines.length;
    }

    // --- quadrant: the border lines, against every surface they touch -------
    if (type === QUADRANT_ROLEDESCRIPTION) {
      const pageGround = parsePaint(hostGround);
      const surfaces = [hostGround];
      svg.querySelectorAll("g.quadrant rect").forEach((rect) => {
        const computed = window.getComputedStyle(rect);
        const declared = parsePaint(computed.fill);
        const alpha =
          (declared ? declared.a : 0) *
          opacityValue(computed.fillOpacity) *
          opacityValue(computed.opacity);
        if (!declared || alpha <= 0) return;
        surfaces.push(
          paintToHex(compositeOver({ ...declared, a: alpha }, pageGround))
        );
      });
      applied.borderInk = inkOn(surfaces);

      const borders = svg.querySelectorAll("g.border line");
      borders.forEach((line) => {
        line.style.setProperty("stroke", applied.borderInk, "important");
        mark(line, "border");
      });
      applied.borders = borders.length;
    }

    logDebug("Page ink encoding applied:", applied);
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

    // PAGE INK DISPATCH, added 26 September 2026 (Mermaid UI review parcel
    // 10), FIRST and for every diagram type, at this seam for the gantt
    // dispatch's wiring reason below. First, because the xychart work at the
    // end of this function reads each line's COMPUTED width to size its
    // casing, and that width is now written here rather than by the page.
    applyPageInkEncoding(root);

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

    // SEQUENCE DISPATCH, added 4 September 2026, for the same wiring reason and
    // deliberately at the same seam: the invariant that reapplyAfterRender's
    // encoding limb re-applies everything after every theme flip and re-render
    // lives in ONE function, and a second call site would be a second place for
    // it to be forgotten. applySequenceEncoding never calls applyTheme — it is
    // reached FROM the re-render, so calling back into it would recurse.
    const sequenceEncoding = applySequenceEncoding(root);

    // BLOCK DISPATCH, added 15 September 2026, at the same seam and for the same
    // wiring reason: reapplyAfterRender's encoding limb calls THIS function, and
    // a second entry point would be a second place for the after-render
    // invariant to be forgotten. Before this line applySeriesEncoding returned
    // null for every block diagram, which was measured rather than read off the
    // source - the probe called it and recorded the null.
    const blockEncoding = applyBlockEncoding(root);

    // C4 DISPATCH, added 18 September 2026, at the same seam and for the same
    // wiring reason as gantt, sequence and block: reapplyAfterRender's encoding
    // limb calls THIS function, and a second entry point would be a second
    // place for the after-render invariant to be forgotten. Before this line
    // applySeriesEncoding returned null for every c4 diagram, which was
    // measured by calling it rather than read off the source.
    const c4Encoding = applyC4Encoding(root);

    // KANBAN DISPATCH, added 21 September 2026, at the same seam and for the
    // same wiring reason as gantt, sequence, block and c4: mermaid-controls.js's
    // reapplyAfterRender calls THIS function and nothing else, so a second entry
    // point would be a second place for the after-render invariant to be
    // forgotten. Before this line applySeriesEncoding returned null for every
    // kanban diagram, which was measured by calling it rather than read off the
    // source. applyKanbanEncoding never calls applyTheme — it is reached FROM
    // the re-render, so calling back into it would recurse.
    const kanbanEncoding = applyKanbanEncoding(root);

    // RADAR DISPATCH, added 30 September 2026 (register item 93 session 7b),
    // at the same seam and for the same wiring reason as the five above:
    // reapplyAfterRender's encoding limb calls THIS function and nothing else.
    // applyRadarEncoding never calls applyTheme, so it cannot recurse.
    const radarEncoding = applyRadarEncoding(root);

    const svg =
      root.tagName === "svg" &&
      root.getAttribute("aria-roledescription") === XYCHART_ROLEDESCRIPTION
        ? root
        : root.querySelector(
            `svg[aria-roledescription="${XYCHART_ROLEDESCRIPTION}"]`
          );

    if (!svg) {
      if (ganttEncoding) return { gantt: ganttEncoding };
      if (sequenceEncoding) return { sequence: sequenceEncoding };
      if (blockEncoding) return { block: blockEncoding };
      if (c4Encoding) return { c4: c4Encoding };
      if (kanbanEncoding) return { kanban: kanbanEncoding };
      if (radarEncoding) return { radar: radarEncoding };
      logDebug(
        "No xychart, gantt, sequence, block, c4, kanban or radar SVG in this container - series encoding skipped"
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
   * Place an `%%{init: …}%%` directive in a source so that a YAML frontmatter
   * block, where the source carries one, keeps the very first line.
   *
   * Mermaid requires the opening `---` fence to be the FIRST thing in the
   * source. A directive prepended ahead of it makes the fence an ordinary body
   * line and the whole render throws — measured 17 September 2026 on c4,
   * flowchart and block, and isolated two-sided: frontmatter alone renders, a
   * prepended directive alone renders, the two together throw. See
   * docs/mermaid-item-84-sweep-6-2026-09-17.md § F1.
   *
   * The directive is therefore inserted on the line AFTER the closing fence
   * where a frontmatter block opens the source, and prepended as before where
   * it does not. Both positions are line-starts, so applyTheme's existing
   * removal regex reaches a previously-inserted directive at either one.
   *
   * @param {string} code - The Mermaid source, with no init directive in it
   * @param {string} directive - The directive to insert, ending in a newline
   * @returns {string} The source carrying the directive
   */
  function insertInitDirective(code, directive) {
    const lines = code.split("\n");

    // An opening fence is `---` alone on the FIRST line. Anything else — a
    // blank line first, a fence with trailing text — is not frontmatter to
    // Mermaid, so the prepend stays correct for it.
    if (!/^---\s*$/.test(lines[0] || "")) {
      logDebug("No frontmatter fence; prepending the init directive");
      return directive + code;
    }

    // The closing fence is the next `---` alone on a line. An unterminated
    // block is not valid frontmatter, so prepending is the honest fallback:
    // it leaves the source exactly as this function found it plus a directive,
    // rather than inventing a position inside an incomplete block.
    for (let i = 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) {
        logDebug(`Frontmatter closes at line ${i + 1}; inserting after it`);
        const head = lines.slice(0, i + 1).join("\n");
        const tail = lines.slice(i + 1).join("\n");
        return head + "\n" + directive + tail;
      }
    }

    logWarn("Frontmatter fence never closes; prepending the init directive");
    return directive + code;
  }

  /**
   * Build a diagram's source carrying the `%%{init}%%` directive for a theme.
   *
   * The one place that builds it. applyTheme uses it for the page, and the
   * static export (Mermaid UI parcel 11a-3) uses it to paint each diagram a
   * second time for the other site mode. So it reads the FULL theme lists,
   * never getAllThemes(), which is filtered to the current mode: a light page
   * must be able to build the dark theme's source.
   *
   * @param {string} code - The Mermaid source, with or without an init directive
   * @param {string} themeId - A built-in or custom theme id
   * @returns {string|null} The source carrying that theme's directive, after
   *   any frontmatter block; null for an unknown id
   */
  function buildThemedSource(code, themeId) {
    // The body below is applyTheme's former branch, moved here verbatim.
    let newCode = code;

    // Check if it's a built-in theme or custom theme
    const customTheme = customThemes.find((theme) => theme.id === themeId);

    if (customTheme) {
      // For custom themes, we need to use the 'base' theme and apply theme variables
      const initDirective = `%%{init: {'theme': 'base', 'themeVariables': ${JSON.stringify(
        customTheme.variables
      )}}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive, after any frontmatter block
      newCode = insertInitDirective(newCode, initDirective);
      logDebug(`Applied custom theme variables for "${themeId}"`);
    } else if (builtInThemes.find((theme) => theme.id === themeId)) {
      // For built-in themes, we just need to specify the theme name
      const initDirective = `%%{init: {'theme': '${themeId}'}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive, after any frontmatter block
      newCode = insertInitDirective(newCode, initDirective);
      logDebug(`Applied built-in theme "${themeId}"`);
    } else {
      return null;
    }

    return newCode;
  }

  /**
   * The theme a diagram showing `themeId` should show in `targetMode`, by the
   * rule the site's own light/dark flip follows (resolveThemeForCurrentMode):
   * a theme the target mode offers stays; a paired theme becomes its pair
   * (THEME_PAIRS); anything else becomes the target mode's default.
   *
   * @param {string} themeId - The theme applied now
   * @param {"light"|"dark"} targetMode - The site mode to resolve for
   * @returns {string} A theme id the target mode offers
   */
  function getCounterpartTheme(themeId, targetMode) {
    const offered = themeConfig.modeVisibleThemes
      ? themeConfig.modeVisibleThemes[targetMode]
      : null;
    const isOffered = (id) => !offered || offered.includes(id);

    if (isOffered(themeId)) return themeId;

    const pair = THEME_PAIRS[themeId];
    if (pair && isOffered(pair)) return pair;

    return themeConfig.defaultThemes[targetMode];
  }

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

    // Create new code with the theme directive, built in one place. An
    // unknown id leaves the source as it was.
    const themedCode = buildThemedSource(originalCode, themeId);
    const newCode = themedCode === null ? originalCode : themedCode;

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

  /** The site's two theme stylesheet links (tools.html), found by id at call time. */
  const SITE_THEME_LINK_IDS = Object.freeze(["lightCSS", "darkCSS"]);

  /**
   * The longest a site flip waits for its swapped stylesheets before it
   * re-renders anyway. Measured 26 September 2026 (headless, preview server):
   * the gap from the flip handler's entry to the new sheet loading was 39-55 ms
   * in both directions; 2000 ms is over thirty times the slowest.
   */
  const SITE_THEME_STYLESHEET_WAIT_MS = 2000;

  /** How often the wait re-reads the links. */
  const SITE_THEME_STYLESHEET_POLL_MS = 10;

  /**
   * Resolve once every site theme link has finished loading its CURRENT href.
   *
   * WHY THE FLIP WAITS (Mermaid UI review parcel 10, 26 September 2026). The
   * site toggle swaps both links' hrefs and calls updateDiagramsForThemeChange
   * in the same task. Until the new sheet loads, neither sheet applies — the
   * body computes transparent — so every after-render pass that derives an ink
   * against the page ground (the block, gantt and series passes) fell back to
   * its light assumption, and a line's computed width was Mermaid's own 2px
   * rather than the stylesheet's 3px. A flip to dark therefore left dark ink
   * on the dark page and a narrower xychart casing, unlike a page loaded
   * straight into dark mode (the UI guard's PT4 row measures exactly that).
   *
   * THE READINESS TEST IS THE SHEET, NOT THE LOAD EVENT. Measured: during the
   * gap each link's `sheet` is still the OLD sheet, so `sheet.href` differs
   * from the link's resolved `href` until the new one lands. The `load` event
   * cannot be used: on the first flip to dark, #darkCSS's href does not change
   * (dark.css to dark.css) and it fires none.
   *
   * Never rejects: missing links are logged and the wait proceeds at once; a
   * timeout is logged and the wait proceeds, which is exactly today's
   * behaviour.
   *
   * @returns {Promise<void>}
   */
  function waitForSiteThemeStylesheets() {
    const links = SITE_THEME_LINK_IDS.map((id) =>
      document.getElementById(id)
    ).filter(Boolean);

    if (links.length !== SITE_THEME_LINK_IDS.length) {
      logWarn(
        "Site theme stylesheet link(s) not found; re-rendering without waiting for",
        SITE_THEME_LINK_IDS.filter((id) => !document.getElementById(id))
      );
    }

    const loaded = () =>
      links.every((link) => link.sheet && link.sheet.href === link.href);

    return new Promise((resolve) => {
      const started = Date.now();

      const check = () => {
        if (loaded()) {
          logDebug("Site theme stylesheets loaded after", Date.now() - started, "ms");
          resolve();
          return;
        }

        if (Date.now() - started >= SITE_THEME_STYLESHEET_WAIT_MS) {
          logWarn(
            `Site theme stylesheets not loaded after ${SITE_THEME_STYLESHEET_WAIT_MS} ms; re-rendering diagrams anyway`
          );
          resolve();
          return;
        }

        setTimeout(check, SITE_THEME_STYLESHEET_POLL_MS);
      };

      check();
    });
  }

  /**
   * Update mermaid diagrams when site theme changes
   * This function should be called when the site theme is toggled
   */
  function updateDiagramsForThemeChange() {
    logInfo("Theme change detected, updating diagrams");

    // Wait for the swapped site stylesheet first, so every after-render pass
    // reads the ground the page is actually changing to (see the helper).
    return waitForSiteThemeStylesheets()
      .then(rerenderDiagramsForThemeChange)
      .catch((error) =>
        logError("Updating diagrams after the theme change failed:", error)
      );
  }

  /**
   * The re-render itself, unchanged from before the wait was added: run once
   * the site theme stylesheets have loaded.
   */
  function rerenderDiagramsForThemeChange() {
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
    // The static export's second copy (Mermaid UI parcel 11a-3) builds its
    // source and chooses its theme through these, as applyTheme does.
    buildThemedSource: buildThemedSource,
    getCounterpartTheme: getCounterpartTheme,
    applySeriesEncoding: applySeriesEncoding,
    // Exported for MEASUREMENT, not as a second wiring route. Every production
    // path reaches it through applySeriesEncoding above; a probe needs to call
    // it directly and read back the ratios it measured.
    applyGanttEncoding: applyGanttEncoding,
    applySequenceEncoding: applySequenceEncoding,
    applyBlockEncoding: applyBlockEncoding,
    applyC4Encoding: applyC4Encoding,
    applyKanbanEncoding: applyKanbanEncoding,
    applyRadarEncoding: applyRadarEncoding,
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
