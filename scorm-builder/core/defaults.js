// Default options + sidebar control context for the document shell. Everything
// here is overridable by the caller (build({ sidebar: {...} })).

export const DEFAULT_FEATURES = Object.freeze({
  fonts: true,
  readingTools: true,
  mathjaxControls: true,
  theme: true,
  contentColours: true,
  imageBase64: true,
  // Transform authored <div class="longdesc"> blocks into an accessible <details>
  // long-description disclosure below the image (with aria-details wiring).
  imageLongDescriptions: true,
  // Normalise mathpix's figure markup into semantic <figure>/<figcaption>, so a
  // caption is programmatically tied to its image. ON by default deliberately:
  // the trigger classes (figure_img / caption_figure) are mathpix-specific, so
  // { html } authors are unaffected in practice, and defaulting it off would mean
  // nobody gets the fix without opting in.
  mathpixFigures: true,
  distractionFree: true,
  save: true,
  footer: true,
  readAloud: true,
  visualAids: true,
  navAids: true,
  search: true,
  shortcutsHelp: true,
  // Interactive quizzes are opt-in: only meaningful when the content actually
  // carries quiz blocks, and off by default so every existing build is unchanged.
  quiz: false,

  // Bundled optional UI components (vendored, self-contained). OFF by default:
  // they are groundwork — available on-demand for "special exports" — and ship
  // no script/CSS unless their flag is turned on, so existing exports are
  // byte-identical. Each exposes its window globals (UniversalModal /
  // UniversalNotifications / UniversalToggletip) for a bodyEnd script to call.
  universalNotifications: false,
  universalModal: false,
  universalToggletip: false,

  // Vendored lite-youtube-embed (Apache-2.0). OFF by default. When on, ships the
  // <lite-youtube> custom element + its CSS. The component bakes offline, but a
  // rendered embed still needs network for its poster and the play iframe. See
  // source/templates/js/VENDORED.md.
  liteYoutube: false,
});

export const DEFAULT_FONT_OPTIONS = [
  { value: "", label: "Default", selected: true },
  { value: "'Atkinson Hyperlegible', sans-serif", label: "Atkinson Hyperlegible", selected: false },
  { value: "'OpenDyslexic', sans-serif", label: "OpenDyslexic", selected: false },
  { value: "'Annotation Mono', monospace", label: "Annotation Mono", selected: false },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif", selected: false },
  { value: "system-ui, sans-serif", label: "Sans-serif", selected: false },
];

export const DEFAULT_WIDTH_OPTIONS = [
  { value: "narrow", label: "Narrow", selected: false },
  { value: "medium", label: "Medium", selected: true },
  { value: "wide", label: "Wide", selected: false },
  { value: "full", label: "Full width", selected: false },
];

export const DEFAULT_ZOOM_OPTIONS = [
  { id: "zoom-click", value: "Click", checked: true, label: "Single click", description: "Click an equation to magnify it" },
  { id: "zoom-doubleclick", value: "DoubleClick", checked: false, label: "Double click", description: "Double-click an equation to magnify it" },
  { id: "zoom-none", value: "NoZoom", checked: false, label: "No zoom", description: "Disable click-to-zoom" },
];

export const DEFAULT_USAGE_INSTRUCTIONS = [
  { type: "Context menu", instruction: "Right-click (or long-press) any equation for navigation options" },
  { type: "Zoom", instruction: "Click an equation to magnify it" },
  { type: "Explore", instruction: "Use the arrow keys to walk through an expression's structure" },
];

// The full context consumed by the sidebar templates, with sensible defaults.
export function buildSidebarContext(overrides = {}) {
  return {
    // theme-toggle-section. These MUST be the pair theme-management.js sets for
    // the light theme, which is the theme the document parses in: it rewrites
    // both halves on init, so any other pair here is a WCAG SC 2.5.3 Label in
    // Name failure that exists only between parse and script — real, and
    // invisible to any check that runs after load. "Toggle theme" against
    // "Switch between light and dark mode" was exactly that.
    ariaLabel: "Switch to dark mode",
    isDarkMode: false,
    icon: "◐", // half-filled circle
    text: "Dark",

    // content-colours-section (whether to render it + the light-theme defaults
    // used as the initial control values, matching :root in custom-properties.css.
    // content-colours.js re-syncs these to the live theme on init).
    contentColours: true,
    colourBodyBg: "#fffff4",
    colourBodyText: "#00131d",
    colourHeading: "#495961",
    colourLink: "#002e3b",
    colourLinkHover: "#005051",
    colourBorder: "#8d3970",

    // reading-tools-section
    fontOptions: DEFAULT_FONT_OPTIONS,
    widthOptions: DEFAULT_WIDTH_OPTIONS,
    fontSize: 1.0,
    paragraphSpacing: 1.25,
    letterSpacing: 0, // em; WCAG 1.4.12 (matches DEFAULT_SCRIPT_CONTEXT)
    wordSpacing: 0, // em; WCAG 1.4.12 (matches DEFAULT_SCRIPT_CONTEXT)

    // read-aloud-section (gate the whole section on the feature flag)
    readAloud: true,

    // visual-aids-section (reading guide + colour overlay)
    visualAids: true,

    // find-section (in-document search)
    search: true,

    // keyboard-shortcuts help button (in Document Actions)
    shortcutsHelp: true,

    // mathjax-accessibility-controls (gate the whole section on the feature flag)
    mathjaxControls: true,
    zoomOptions: DEFAULT_ZOOM_OPTIONS,
    zoomScale: 200,
    assistiveMathML: true,
    tabNavigation: false,
    usageInstructions: DEFAULT_USAGE_INSTRUCTIONS,

    ...overrides,
  };
}
