// Emit the end-of-body UI <script> blocks. The playground's UI scripts are
// themselves templates ({{defaultTheme}}, {{#if respectSystemPreference}}, ...),
// so each is rendered through the template engine with a context before being
// inlined. Scripts are gated by feature flags and bound to the canonical shell.

import { render } from "./template-engine.js";
import { getScript, hasScript } from "../assets/index.js";

// feature flag -> ordered list of script asset keys it contributes.
// Expanded per phase as each feature's wiring is built and tested. Scripts for
// not-yet-wired features are intentionally omitted so every build stays runnable.
const FEATURE_SCRIPTS = {
  theme: ["theme-management.js"],
  // reading-tools-setup.js is self-contained (defines + instantiates the manager).
  // Do NOT also include reading-accessibility-manager-class.js — it declares the
  // same class name and would throw a redeclaration error.
  readingTools: ["reading-tools-setup.js"],
  // mathjax-controls.js defines the manager class but does not instantiate it
  // (the dropped mathjax-manager.js used to). FEATURE_INIT supplies the init.
  mathjaxControls: ["mathjax-controls.js"],
  // self-instantiating IIFE; overrides content colours scoped to <main>, reads
  // defaults from CSS at runtime so it needs no template placeholders.
  contentColours: ["content-colours.js"],
  // both self-instantiate on DOMContentLoaded
  distractionFree: ["distraction-free-manager.js"],
  // exposes window.saveCompleteDocument (has a clean-DOM fallback, so it works
  // even without the base64 self-reference embed)
  save: ["document-save-functionality.js"],
  // self-instantiating; browser-native TTS (speechSynthesis), no dependency
  readAloud: ["read-aloud.js"],
  // self-instantiating; reading guide + colour overlay, injected at runtime
  visualAids: ["visual-aids.js"],
  // self-instantiating; progress bar, back-to-top, TOC current-section
  navAids: ["navigation-aids.js"],
  // self-instantiating; in-document find/highlight over the rendered content
  search: ["find-in-document.js"],
  // self-instantiating; accessible keyboard-shortcut help modal
  shortcutsHelp: ["shortcuts-help.js"],

  // self-instantiating; reads each quiz block rendered by enhancers/quiz.js,
  // scores it, shows two-level feedback, and (SCORM target only) reports the
  // score to the LMS via window.SCORM.reportScore. No-op if no quiz present.
  quiz: ["quiz-runtime.js"],

  // self-instantiating; opens image long-description <details> for printing and
  // restores them afterwards, so printed pages include the description. No-op when
  // the document carries no long descriptions.
  imageLongDescriptions: ["long-description-print.js"],

  // Bundled optional components (vendored IIFEs that self-attach window globals;
  // no auto-DOM side effects until a caller invokes them). OFF by default.
  // Notifications is listed before modal so the modal's optional
  // window.UniversalNotifications reference resolves when both are enabled.
  universalNotifications: ["universal-notifications.js"],
  universalModal: ["universal-modal.js"],
  universalToggletip: ["universal-toggletip.js"],

  // Vendored lite-youtube-embed (Apache-2.0). Registers the <lite-youtube>
  // custom element; inert until such an element is present in the content.
  liteYoutube: ["lite-yt-embed.js"],

  // focus tracking is a harmless always-useful a11y utility
  _always: ["focus-tracking.js"],
};

// feature flag -> ordered list of CSS asset keys it contributes. Unlike
// FEATURE_SCRIPTS, this map governs ONLY opt-in component CSS: any CSS key NOT
// listed here is always-on library CSS and always ships. A key listed here is
// gated — it is included only when its feature flag is on. Keys are CSS asset
// keys (path relative to source/templates/css).
const FEATURE_CSS = {
  universalNotifications: ["components/universal-notifications.css"],
  universalModal: ["components/universal-modal.css"],
  universalToggletip: ["components/universal-toggletip.css"],
  liteYoutube: ["components/lite-yt-embed.css"],
};

// The set of every CSS key that is gated behind some feature flag. A key in this
// set ships only when its feature is enabled; every other key is always-on.
const GATED_CSS_KEYS = new Set(Object.values(FEATURE_CSS).flat());

/**
 * Build the CSS-inclusion predicate for a set of resolved feature flags. Every
 * always-on library CSS key passes; a gated component CSS key passes only when
 * its owning feature is enabled. With FEATURE_CSS empty this is the identity
 * filter, so existing exports are byte-identical.
 * @param {object} [features] - resolved feature flags
 * @returns {(key: string) => boolean} predicate for allCss()
 */
export function cssFilterFor(features = {}) {
  if (GATED_CSS_KEYS.size === 0) return () => true;
  const enabled = new Set();
  for (const [flag, keys] of Object.entries(FEATURE_CSS)) {
    if (features[flag]) for (const k of keys) enabled.add(k);
  }
  return (key) => !GATED_CSS_KEYS.has(key) || enabled.has(key);
}

export { FEATURE_CSS };

// Per-feature initialiser code appended after the feature's scripts (for scripts
// that define but don't self-instantiate).
const FEATURE_INIT = {
  mathjaxControls: `<script>
document.addEventListener('DOMContentLoaded', function () {
  try {
    window.mathJaxControlsManager = new MathJaxControlsManager();
    window.mathJaxControlsManager.initialize();
  } catch (e) { console.error('MathJax controls init failed:', e); }
});
</script>`,
};

export const DEFAULT_SCRIPT_CONTEXT = Object.freeze({
  // theme-management.js
  defaultTheme: "light",
  enableTransitions: true,
  respectSystemPreference: true,

  // reading-tools-setup.js (defaults match the sidebar control initial values)
  fontSize: 1.0,
  fontFamily: "",
  readingWidth: "medium",
  lineHeight: 1.6,
  paragraphSpacing: 1.25,
  letterSpacing: 0, // em; WCAG 1.4.12 letter-spacing slider default
  wordSpacing: 0, // em; WCAG 1.4.12 word-spacing slider default
  advancedControls: false, // legacy change-event word/letter controls (superseded)

  // focus-tracking.js
  enableConsoleCommands: false,
  commandsDelayMs: 1000,

  // distraction-free-manager.js
  // When true, the document opens in focus mode on load (TOC + sidebar hidden).
  // The reader can always exit (Escape / the focus-mode toggle); no persistence.
  // Only takes effect when the distractionFree feature is on (the script that
  // honours this flag only ships then).
  startFocusMode: false,

  // mathjax-controls.js
  zoom: "Click",
  zscale: "200%",
  assistiveMathML: true,
  tabNavigation: false,
  // Equation Explorer is opt-in via the sidebar checkbox (off by default); it
  // lazy-loads SRE data over the network, so it cannot start on a file:// doc.
  mathExplorer: false,
  // Default maths speech ruleset domain for the "Maths speech style" radio.
  speechDomain: "clearspeak",

  // quiz-runtime.js
  // Whether this build should report the quiz score to the LMS. Only the SCORM
  // target sets this true (build() → scriptContext); html/html-offline leave it
  // false, so the same runtime just shows a local results summary offline.
  quizReportScore: false,
  // Pass threshold as a percentage (0–100). The runtime marks the attempt
  // "passed" when the rolled-up score reaches it; mirrors the manifest masteryscore.
  quizMasteryScore: 60,
});

function emit(key, context) {
  if (!hasScript(key)) return "";
  const js = render(getScript(key), context);
  return `<script>\n${js}\n</script>`;
}

/**
 * @param {object} features - resolved feature flags
 * @param {object} [context] - script template context overrides
 * @returns {string} concatenated <script> blocks
 */
export function buildFeatureScripts(features = {}, context = {}) {
  const ctx = { ...DEFAULT_SCRIPT_CONTEXT, ...context };
  const keys = [...FEATURE_SCRIPTS._always];
  for (const [flag, scripts] of Object.entries(FEATURE_SCRIPTS)) {
    if (flag === "_always") continue;
    if (features[flag]) keys.push(...scripts);
  }
  // de-dupe while preserving order
  const seen = new Set();
  const ordered = keys.filter((k) => (seen.has(k) ? false : seen.add(k)));
  const scriptBlocks = ordered.map((k) => emit(k, ctx)).filter(Boolean);

  // Append per-feature initialisers for enabled features.
  const initBlocks = Object.entries(FEATURE_INIT)
    .filter(([flag]) => features[flag])
    .map(([, code]) => code);

  return [...scriptBlocks, ...initBlocks].join("\n");
}
