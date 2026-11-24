/**
 * @fileoverview Accessible "Export to SCORM/HTML" control, shared by every mp-73
 *   tool that produces exportable content.
 * @module scorm-export/export-control
 * @requires ./scorm-export.js
 * @version 0.1.0
 * @since 0.1.0
 *
 * @description
 * Renders one small, self-contained control into a host container and wires it to
 * {@link module:scorm-export.exportContent}. A single control is reused by the
 * Markdown Editor, MathPix editor and OpenRouter results so the accessible markup
 * is defined — and audited — in exactly one place.
 *
 * UX (owner decisions, Phase 1):
 *   - **Default to SCORM.** Pressing the button with options closed exports a
 *     SCORM 2004 package. The button's accessible name always states what it will
 *     do ("Export as SCORM package") and updates when the format changes, so a
 *     screen-reader user is never surprised (WCAG 2.2 — 2.4.6, 2.5.3 label-in-name).
 *   - **Other targets behind an "options" disclosure.** A native `<details>`
 *     reveals a radiogroup for standalone HTML and the offline bundle.
 *   - **Native download.** Export reuses the same blob+anchor download every tool
 *     already uses (the library's `download()` performs exactly that); tools with
 *     their own downloader can pass one in via `opts.download`.
 *
 * Accessibility notes:
 *   - Semantic first: a real `<button>`, a `<fieldset>`/`<legend>` radiogroup, a
 *     `<details>`/`<summary>` disclosure. ARIA only fills the gaps (`role="status"`).
 *   - Progress and outcome are announced via a polite `role="status"` live region.
 *   - The button is marked `aria-disabled="true"` for the duration of an export and
 *     a busy flag blocks re-entry. It is never given the `disabled` property:
 *     disabling the focused control drops keyboard focus to `<body>` (MRC-104).
 *     Its label restores afterwards.
 *   - `idPrefix` keeps ids/`name`s unique so the control can mount more than once
 *     on a page without duplicate-id or radio-cross-talk bugs.
 */

import { exportContent, EXPORT_TARGETS } from "./scorm-export.js";

// --- logging (mp-73 module-scope convention) ---------------------------------
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.WARN;
const shouldLog = (l) => LOG_LEVELS[l] <= CURRENT_LOG_LEVEL;
const logError = (...a) => shouldLog("ERROR") && console.error("[export-control]", ...a);
const logInfo = (...a) => shouldLog("INFO") && console.info("[export-control]", ...a);

// Short, human labels for the button's accessible name per target.
const TARGET_ACTION_LABEL = Object.freeze({
  scorm: "Export as SCORM package",
  html: "Export as standalone HTML",
  "html-offline": "Export as offline HTML bundle",
});

// Targets the control OFFERS, in render order. Deliberately a subset of
// EXPORT_TARGETS/TARGET_ACTION_LABEL, both of which still understand every target —
// the facade is unchanged and a caller passing a target directly still works.
//
// "html-offline" is ABSENT ON PURPOSE, and putting the string back will ship a
// button that always fails. buildStandalonePackage forces mathjaxMode:"local"
// (scorm-builder/core/standalone.js), and bundleLocalMathjax THROWS on an absent or
// empty asset map (scorm-builder/util/zip-helpers.js) — only an *incomplete* map
// warns. mp-73 supplies no `mathjaxAssets` anywhere in its own application code, so
// every click on that radio landed in the catch below and printed an internal library
// message into the status region. Re-enabling it needs a vendored MathJax `es5/`
// bundle supplied as `mathjaxAssets`, and that bundle MUST include
// `es5/input/tex/extensions/mhchem.js` — mp-73 exports chemistry, and a missing
// autoload asset takes the WHOLE page's maths down, not just the chemistry.
const TARGET_ORDER = ["scorm", "html"];

// The busy marker the button carries while an export runs (see onClick).
const BUSY_ATTRIBUTE = "aria-disabled";
const BUSY_VALUE = "true";

// The app theme the control is drawn in (MRC-105b). The attribute is set on the root
// and the CSS below keys its colours off the two values.
const APP_THEME_ATTRIBUTE = "data-scex-app";
const APP_THEME = Object.freeze({ LIGHT: "light", DARK: "dark" });
const DARK_QUERY = "(prefers-color-scheme: dark)";
// The app's two theme sheet links. The toggle points BOTH at one file; with no saved
// choice they differ and the OS decides.
const THEME_LINK_IDS = Object.freeze(["lightCSS", "darkCSS"]);
const DARK_SHEET_PATTERN = /dark\.css/;

// --- self-injected, namespaced styling -------------------------------------
// The control carries its own styling so it is robust in any host: every rule is
// scoped under `.scorm-export-control` (it cannot leak out, and host rules cannot
// distort it), colours track the host's light/dark via prefers-color-scheme, and
// interactive targets are an unambiguous >=24px (SC 2.5.8). Colours are the theme
// foreground on the theme background (maximal contrast, SC 1.4.3/1.4.11) with a
// distinct focus ring, so contrast is guaranteed by construction rather than
// inherited from — or left to — the host page. Injected once per document.
const STYLE_ID = "scorm-export-control-styles";
const CONTROL_CSS = `
.scorm-export-control {
  --scex-fg: #17181a;
  --scex-bg: #ffffff;
  --scex-border: #595f6a;
  --scex-accent: #0b57d0;
  --scex-btn-bg: transparent;
  --scex-gap: 0.4rem;
  --scex-icon-size: 1.3rem;
  --scex-chevron-size: 1.75rem;
  color-scheme: light dark;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 40rem;
  margin: 0.75rem 0;
  padding: 0.75rem;
  border: 1px solid var(--scex-border);
  border-radius: 8px;
  background: var(--scex-bg);
  color: var(--scex-fg);
  font: inherit;
  line-height: 1.4;
}
.scorm-export-control *,
.scorm-export-control *::before,
.scorm-export-control *::after { box-sizing: border-box; }
@media (prefers-color-scheme: dark) {
  .scorm-export-control {
    --scex-fg: #f2f4f7;
    --scex-bg: #1a1e24;
    --scex-border: #9aa3b0;
    --scex-accent: #86b0ff;
  }
}
.scorm-export-control .scorm-export-button {
  align-self: flex-start;
  min-height: 44px;
  padding: 0.4rem 1rem;
  border: 2px solid var(--scex-fg);
  border-radius: 6px;
  background: var(--scex-btn-bg);
  color: var(--scex-fg);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.scorm-export-control .scorm-export-button:hover {
  background: color-mix(in srgb, var(--scex-accent) 14%, transparent);
}
.scorm-export-control .scorm-export-button:disabled,
.scorm-export-control .scorm-export-button[${BUSY_ATTRIBUTE}="${BUSY_VALUE}"] { opacity: 0.6; cursor: default; }
/* A busy button can hold keyboard focus, and opacity would fade its focus ring with
   it (2.98:1 in the light theme, MRC-104). So while focused it dims its text and
   border by colour instead, and the ring keeps its full strength. */
.scorm-export-control .scorm-export-button[${BUSY_ATTRIBUTE}="${BUSY_VALUE}"]:focus-visible {
  opacity: 1;
  border-color: color-mix(in srgb, var(--scex-fg) 60%, transparent);
  color: color-mix(in srgb, var(--scex-fg) 60%, transparent);
}
.scorm-export-control .scorm-export-button:focus-visible {
  outline: 3px solid var(--scex-accent);
  outline-offset: 2px;
}
.scorm-export-control .scorm-export-options > summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.35rem 0.25rem;
  cursor: pointer;
}
.scorm-export-control .scorm-export-options > summary:focus-visible {
  outline: 3px solid var(--scex-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
.scorm-export-control .scorm-export-formats {
  margin: 0.25rem 0 0;
  border: 1px solid var(--scex-border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem 0.75rem;
}
.scorm-export-control .scorm-export-formats > legend {
  padding: 0 0.35rem;
  font-weight: 600;
  color: var(--scex-fg);
  background: transparent;
}
.scorm-export-control .scorm-export-format {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 44px;
  padding: 0.2rem 0;
  cursor: pointer;
}
.scorm-export-control .scorm-export-format input[type="radio"] {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
  accent-color: var(--scex-accent);
  cursor: pointer;
}
.scorm-export-control .scorm-export-format input[type="radio"]:focus-visible {
  outline: 3px solid var(--scex-accent);
  outline-offset: 2px;
}
.scorm-export-control .scorm-export-status {
  margin: 0.15rem 0 0;
  min-height: 1.4em;
  color: var(--scex-fg);
}

/* MRC-105b: the control follows the APP's theme, not only the OS's. The attribute is
   set from the app's theme sheet links (see appTheme); the colours are the app's own. */
.scorm-export-control[${APP_THEME_ATTRIBUTE}] {
  gap: var(--scex-gap);
  padding: 0.75rem 1rem;
  border-radius: 0.4rem;
  background: transparent;
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}="${APP_THEME.LIGHT}"] {
  color-scheme: light;
  --scex-fg: #00131d;
  --scex-border: #5a6b75;
  --scex-accent: #005c84;
  --scex-btn-bg: #eceef0;
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}="${APP_THEME.DARK}"] {
  color-scheme: dark;
  --scex-fg: #e1e8ec;
  --scex-border: #8d9aa3;
  --scex-accent: #c1d100;
  --scex-btn-bg: #231f20;
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-button:hover {
  background: color-mix(in srgb, var(--scex-accent) 18%, var(--scex-btn-bg));
}
/* The app's global rules put margin above and below the button and the details block;
   the control's own gap already spaces them. */
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-button,
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-options { margin: 0; }
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-options > summary { gap: var(--scex-gap); }
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-chevron {
  display: inline-flex;
  flex: none;
  width: var(--scex-chevron-size);
  height: var(--scex-chevron-size);
  transition: transform 0.15s;
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-chevron svg { width: 100%; height: 100%; }
/* The library's chevron is a thin stroke inside a large canvas; thicken it so the cue reads. */
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-chevron svg path { stroke-width: 1.6; }
.scorm-export-control[${APP_THEME_ATTRIBUTE}] details[open] > summary .scex-chevron { transform: rotate(90deg); }
/* An empty status line takes no height and no gap above it; it stays in the page, so the live region is unchanged. */
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scorm-export-status:empty { min-height: 0; margin: calc(var(--scex-gap) * -1) 0 0; }
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-title { margin: 0; font-weight: 700; font-size: 1.1em; }
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-btn-icon {
  display: inline-flex;
  flex: none;
  width: var(--scex-icon-size);
  height: var(--scex-icon-size);
}
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-btn-icon svg { width: 100%; height: 100%; }
/* A host page without the icon library leaves both icon spans empty; they then take no room. */
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-btn-icon:empty,
.scorm-export-control[${APP_THEME_ATTRIBUTE}] .scex-chevron:empty { display: none; }
@media (prefers-reduced-motion: reduce) {
  .scorm-export-control * { transition: none !important; }
}
`;

// Inject the control's stylesheet once per document (idempotent by element id).
function ensureStyles(doc) {
  if (!doc || !doc.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CONTROL_CSS;
  doc.head.appendChild(style);
}

// Which app theme to draw in. The toggle points BOTH sheet links at one file; with no
// saved choice they differ and the OS decides. With no links at all (a host that is not
// the app) the OS decides too, as the control did before MRC-105b.
function appTheme(doc) {
  const isDark = (link) => !!link && DARK_SHEET_PATTERN.test(link.getAttribute("href") || "");
  const [light, dark] = THEME_LINK_IDS.map((id) => doc.getElementById(id));
  if (light && dark) {
    if (isDark(light) && isDark(dark)) return APP_THEME.DARK;
    if (!isDark(light) && !isDark(dark)) return APP_THEME.LIGHT;
  }
  return doc.defaultView.matchMedia(DARK_QUERY).matches ? APP_THEME.DARK : APP_THEME.LIGHT;
}

// Icon-library span (aria-hidden); populated by the library once the control is in the page.
function iconSpan(doc, name, className) {
  const span = doc.createElement("span");
  span.className = className;
  span.setAttribute("aria-hidden", "true");
  span.setAttribute("data-icon", name);
  return span;
}

let instanceSeq = 0;

/**
 * Mount the export control into a container and wire it to the export facade.
 *
 * @param {object} opts
 * @param {Element|string} opts.container - element (or selector) to append into.
 * @param {(ctx: {setStatus: (msg: string) => void, target: string}) => (string|Promise<string>)} opts.getContent
 *   - returns the content to export at click time. May be async: a multi-second
 *   assembly (the MathPix Resume export) is awaited, and is handed `setStatus` so it
 *   can report progress through the control's EXISTING polite `role="status"` region
 *   rather than adding a second live region. A sync getter returning a string is
 *   unaffected. It is called INSIDE the try, so a getter that throws surfaces its
 *   message to the user and still re-enables the button.
 * @param {"html"|"markdown"|"json"|(() => string)} [opts.format="html"] - input format,
 *   or a getter (e.g. the MathPix tool can switch between MMD and rendered HTML).
 * @param {() => (string|undefined)} [opts.getTitle] - returns the document/package title.
 * @param {string} [opts.idPrefix] - unique id/name prefix; auto-generated if omitted.
 * @param {string} [opts.buttonClass] - class(es) to match the host tool's button styling.
 * @param {(params: object) => Promise<{filename:string}>} [opts.exporter=exportContent]
 *   - the export function; injectable for testing.
 * @param {() => (object|undefined)} [opts.getMetadata] - LOM/package metadata, forwarded
 *   top-level (the library's `build({ title })` is silently ignored).
 * @param {() => (object|undefined)} [opts.getFeatures] - optional feature flags.
 * @param {() => (object|undefined)} [opts.getScorm] - optional SCORM-specific settings.
 * @param {() => (object|undefined)} [opts.getFocusMode] - optional focus-mode settings.
 * @param {() => (object|undefined)} [opts.getOptions] - the facade's `options` escape
 *   hatch (image resolver, warning callbacks, `ensureH1`).
 * @returns {{ root: Element, destroy: () => void, getTarget: () => string }}
 */
export function mountExportControl(opts = {}) {
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) throw new Error("mountExportControl: no document (browser-only).");

  const container =
    typeof opts.container === "string" ? doc.querySelector(opts.container) : opts.container;
  if (!container) throw new Error("mountExportControl: container not found.");
  if (typeof opts.getContent !== "function")
    throw new Error("mountExportControl: opts.getContent must be a function.");

  ensureStyles(doc);

  const exporter = opts.exporter || exportContent;
  const formatOf = typeof opts.format === "function" ? opts.format : () => opts.format || "html";
  const getTitle = typeof opts.getTitle === "function" ? opts.getTitle : () => undefined;

  // Optional pass-throughs to the facade, all normalised the same way as getTitle so a
  // host that supplies none of them (every mount before Phase 4) forwards `undefined`.
  const asGetter = (fn) => (typeof fn === "function" ? fn : () => undefined);
  const getMetadata = asGetter(opts.getMetadata);
  const getFeatures = asGetter(opts.getFeatures);
  const getScorm = asGetter(opts.getScorm);
  const getFocusMode = asGetter(opts.getFocusMode);
  const getOptions = asGetter(opts.getOptions);

  const prefix = opts.idPrefix || `scorm-export-${++instanceSeq}`;
  const groupName = `${prefix}-target`;
  const statusId = `${prefix}-status`;

  // --- build markup ----------------------------------------------------------
  const root = doc.createElement("div");
  root.className = "scorm-export-control";
  root.setAttribute("data-scorm-export", "");

  const button = doc.createElement("button");
  button.type = "button";
  button.className = `scorm-export-button${opts.buttonClass ? " " + opts.buttonClass : ""}`;

  // The icon is decorative (aria-hidden); the label span carries the accessible name and
  // is the only thing the label code below rewrites.
  const buttonLabel = doc.createElement("span");
  button.append(iconSpan(doc, "download", "scex-btn-icon"), buttonLabel);

  // A <p>, not a heading: the mounts sit at different heading levels.
  const title = doc.createElement("p");
  title.className = "scex-title";
  title.textContent = "Export this document";

  const details = doc.createElement("details");
  details.className = "scorm-export-options";
  const summary = doc.createElement("summary");
  summary.textContent = "Export options";
  summary.prepend(iconSpan(doc, "chevronRight", "scex-chevron"));
  details.appendChild(summary);

  const fieldset = doc.createElement("fieldset");
  fieldset.className = "scorm-export-formats";
  const legend = doc.createElement("legend");
  const legendId = `${prefix}-formats-legend`;
  legend.id = legendId;
  legend.textContent = "Output format";
  // Native <fieldset>/<legend> already names the group, but IBM Equal Access
  // mis-reports a fieldset-inside-<details> as unnamed; the explicit
  // aria-labelledby silences that false positive and hard-guarantees the name.
  fieldset.setAttribute("aria-labelledby", legendId);
  fieldset.appendChild(legend);

  for (const target of TARGET_ORDER) {
    const id = `${prefix}-fmt-${target}`;
    const label = doc.createElement("label");
    label.className = "scorm-export-format";
    label.setAttribute("for", id);
    const input = doc.createElement("input");
    input.type = "radio";
    input.name = groupName;
    input.id = id;
    input.value = target;
    if (target === "scorm") input.checked = true;
    const text = doc.createElement("span");
    text.textContent = EXPORT_TARGETS[target];
    label.append(input, text);
    fieldset.appendChild(label);
  }
  details.appendChild(fieldset);

  const status = doc.createElement("p");
  status.className = "scorm-export-status";
  status.id = statusId;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  root.append(title, button, details, status);
  container.appendChild(root);
  if (window.IconLibrary && window.IconLibrary.populateIcons) window.IconLibrary.populateIcons(root);

  // Follow the app's theme: set it now, and again whenever the app's toggle repoints the
  // sheet links or (with no saved choice) the OS scheme changes.
  const syncTheme = () => root.setAttribute(APP_THEME_ATTRIBUTE, appTheme(doc));
  syncTheme();
  const themeWatch = new MutationObserver(syncTheme);
  for (const id of THEME_LINK_IDS) {
    const link = doc.getElementById(id);
    if (link) themeWatch.observe(link, { attributes: true, attributeFilter: ["href"] });
  }
  const darkQuery = doc.defaultView.matchMedia(DARK_QUERY);
  darkQuery.addEventListener("change", syncTheme);

  // --- behaviour -------------------------------------------------------------
  const selectedTarget = () => {
    const checked = root.querySelector(`input[name="${groupName}"]:checked`);
    return (checked && checked.value) || "scorm";
  };

  const syncButtonLabel = () => {
    const t = selectedTarget();
    buttonLabel.textContent = TARGET_ACTION_LABEL[t] || "Export";
  };
  syncButtonLabel();

  const onFormatChange = () => syncButtonLabel();
  fieldset.addEventListener("change", onFormatChange);

  const setStatus = (msg) => {
    status.textContent = msg;
  };

  // True while an export runs. The button stays focusable for the whole export, so
  // this flag, not the `disabled` property, is what blocks a second press.
  let busy = false;

  const onClick = async () => {
    // Re-entry guard: a press while an export is running starts nothing.
    if (busy) return;

    const target = selectedTarget();
    // Mark busy BEFORE awaiting getContent: the getter may run for several seconds, and
    // re-entry during it would start a second export. `finally` clears the markers on
    // every path, including a getter that throws — which is why the await lives inside
    // the try. Outside it, an async getter's rejection would be unhandled, the status
    // region would keep its last message, and the button would stay busy forever.
    //
    // The marker is aria-disabled, never `button.disabled = true`: disabling the
    // focused button drops keyboard focus to <body> and nothing brings it back.
    const restore = buttonLabel.textContent;
    busy = true;
    button.setAttribute(BUSY_ATTRIBUTE, BUSY_VALUE);
    setStatus(`Preparing ${EXPORT_TARGETS[target]}…`);
    try {
      // `target` lets a getter prepare the HTML export differently from SCORM
      // (MRC-85); a getter that ignores it is unaffected.
      const content = await opts.getContent({ setStatus, target });
      if (typeof content !== "string" || content.trim() === "") {
        setStatus("Nothing to export yet — add some content first.");
        return;
      }
      setStatus(`Building ${EXPORT_TARGETS[target]}…`);
      const result = await exporter({
        content,
        format: formatOf(),
        target,
        title: getTitle(),
        download: true,
        metadata: getMetadata(),
        features: getFeatures(),
        scorm: getScorm(),
        focusMode: getFocusMode(),
        options: getOptions(),
      });
      setStatus(`Exported — downloaded ${result && result.filename ? result.filename : "file"}.`);
      logInfo("export complete", result && result.filename);
    } catch (err) {
      const message = (err && err.message) || String(err);
      setStatus(`Export failed: ${message}`);
      logError("export failed", err);
    } finally {
      busy = false;
      button.removeAttribute(BUSY_ATTRIBUTE);
      buttonLabel.textContent = restore;
    }
  };
  button.addEventListener("click", onClick);

  const destroy = () => {
    themeWatch.disconnect();
    darkQuery.removeEventListener("change", syncTheme);
    button.removeEventListener("click", onClick);
    fieldset.removeEventListener("change", onFormatChange);
    root.remove();
  };

  return { root, destroy, getTarget: selectedTarget };
}
