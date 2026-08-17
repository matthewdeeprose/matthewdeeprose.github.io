// Element ids owned by the document shell, its controls, and the runtime scripts.
// Heading-id generation (enhancers/headings.js) seeds its dedupe set with these so
// an authored heading whose slug matches one (e.g. a section titled "Focus mode" →
// "focus-mode", which the distraction-free toggle button already owns) is given a
// numeric suffix instead of silently minting a DUPLICATE id. A duplicate id breaks
// that heading's TOC link, its skip-to-heading, and the current-section scrollspy,
// because getElementById() returns the first (shell) element, not the heading.
//
// Derived from source/templates/{*,structure,partials}/*.html and the ids created
// at runtime by source/templates/js/*.js. Keep in step with those and with the
// "Reserved names" section of docs/developer-guide.md when shell ids change.
export const RESERVED_IDS = new Set([
  // Shell + skip links
  "main", "sidebar", "toc", "skipToContent", "skipToToc", "skipToSidebar",
  "focus-announcements", "form-announcements",

  // Distraction-free / focus-mode controls
  "focus-mode", "toggle-toc", "toggle-sidebar",
  "focus-controls-heading", "focus-help", "toc-help", "sidebar-help",

  // Theme
  "theme-toggle", "theme-transitions", "appearance-heading",

  // Navigation aids
  "reading-progress", "back-to-top",

  // Reading tools
  "font-family", "font-size", "font-size-value", "font-size-help", "font-help",
  "reading-width", "line-height", "line-height-value", "line-height-help",
  "paragraph-spacing", "paragraph-spacing-value", "para-help",
  "letter-spacing", "letter-spacing-value", "letter-spacing-help",
  "word-spacing", "word-spacing-value",
  "reset-reading-tools", "reading-tools-heading", "reset-heading",

  // Read aloud
  "read-aloud-play", "read-aloud-pause", "read-aloud-stop",
  "read-aloud-prev", "read-aloud-next", "read-aloud-restart", "read-aloud-cursor-help",
  "read-aloud-click-to-read", "read-aloud-click-to-read-help",
  "read-aloud-voice", "read-aloud-voice-help",
  "read-aloud-rate", "read-aloud-rate-value", "read-aloud-rate-help",
  "read-aloud-pitch", "read-aloud-pitch-value", "read-aloud-pitch-help",
  "read-aloud-verbosity", "read-aloud-verbosity-help", "read-aloud-status",
  "read-aloud-heading",

  // Visual aids
  "reading-guide", "reading-guide-toggle", "reading-guide-help",
  "colour-overlay", "overlay-colour", "overlay-colour-help",
  "overlay-opacity", "overlay-opacity-value", "overlay-opacity-help",

  // Find in document
  "doc-search-input", "doc-search-next", "doc-search-prev", "doc-search-count",
  "doc-search-help", "find-heading",

  // Keyboard shortcuts
  "show-shortcuts", "shortcuts-overlay",

  // MathJax accessibility
  "assistive-mathml", "tab-navigation", "tab-help", "math-explorer", "explorer-help",
  "explorer-status",
  "zoom-scale", "MathJax-script", "mathjax-heading", "mathml-help",
  "mathjax-reload-notice", "mathjax-reload-btn",
  "speech-clearspeak", "speech-mathspeak", "speech-style-heading", "speech-style-help",
  "sr-support-heading",

  // Content colours
  "colour-customise", "colour-customise-intro", "user-content-colours",
  "cc-save", "cc-load", "cc-reset", "cc-status", "cc-contrast",

  // Save
  "original-content-data",

  // Bundled notification/toast layers
  "universal-toast-announcer", "universal-toast-container", "gb-toast-container",

  // Sidebar section headings
  "actions-heading", "credits-heading",
]);
