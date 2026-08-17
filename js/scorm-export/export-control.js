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
 *   - The button is disabled for the duration of an export to prevent re-entry;
 *     its label restores afterwards.
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
  background: transparent;
  color: var(--scex-fg);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.scorm-export-control .scorm-export-button:hover {
  background: color-mix(in srgb, var(--scex-accent) 14%, transparent);
}
.scorm-export-control .scorm-export-button:disabled { opacity: 0.6; cursor: default; }
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

let instanceSeq = 0;

/**
 * Mount the export control into a container and wire it to the export facade.
 *
 * @param {object} opts
 * @param {Element|string} opts.container - element (or selector) to append into.
 * @param {(ctx: {setStatus: (msg: string) => void}) => (string|Promise<string>)} opts.getContent
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
  button.setAttribute("aria-describedby", statusId);

  const details = doc.createElement("details");
  details.className = "scorm-export-options";
  const summary = doc.createElement("summary");
  summary.textContent = "Export options";
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

  root.append(button, details, status);
  container.appendChild(root);

  // --- behaviour -------------------------------------------------------------
  const selectedTarget = () => {
    const checked = root.querySelector(`input[name="${groupName}"]:checked`);
    return (checked && checked.value) || "scorm";
  };

  const syncButtonLabel = () => {
    const t = selectedTarget();
    button.textContent = TARGET_ACTION_LABEL[t] || "Export";
  };
  syncButtonLabel();

  const onFormatChange = () => syncButtonLabel();
  fieldset.addEventListener("change", onFormatChange);

  const setStatus = (msg) => {
    status.textContent = msg;
  };

  const onClick = async () => {
    const target = selectedTarget();
    // Disable BEFORE awaiting getContent: the getter may run for several seconds, and
    // re-entry during it would start a second export. `finally` re-enables on every
    // path, including a getter that throws — which is why the await lives inside the
    // try. Outside it, an async getter's rejection would be unhandled, the status
    // region would keep its last message, and the button would stay disabled forever.
    const restore = button.textContent;
    button.disabled = true;
    setStatus(`Preparing ${EXPORT_TARGETS[target]}…`);
    try {
      const content = await opts.getContent({ setStatus });
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
      button.disabled = false;
      button.textContent = restore;
    }
  };
  button.addEventListener("click", onClick);

  const destroy = () => {
    button.removeEventListener("click", onClick);
    fieldset.removeEventListener("change", onFormatChange);
    root.remove();
  };

  return { root, destroy, getTarget: selectedTarget };
}
