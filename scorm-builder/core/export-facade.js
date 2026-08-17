// Unified export facade — one call for every output, plus app-wide defaults.
// This is the main entry a host wires to an "Export" button.
//
//   exportDocument({ target: 'scorm' | 'html' | 'html-offline', html|markdown, ... })
//     -> { data, filename, mediaType, metadata, html, entries? }
//
// `target` dispatches to the existing builders; everything else is merged over
// setDefaults() so the host configures deps/mathpix/features once.

import { build } from "./builder.js";
import { buildStandaloneHtml, buildStandalonePackage } from "./standalone.js";
import { ensureDependencies } from "../browser/ensure-deps.js";
import { download } from "../browser/download.js";

let DEFAULTS = {};

/** Merge app-wide defaults inherited by every later exportDocument() call. */
export function setDefaults(partial = {}) {
  const next = { ...DEFAULTS, ...partial };
  if (partial.features || DEFAULTS.features) {
    next.features = { ...DEFAULTS.features, ...partial.features };
  }
  if (partial.deps || DEFAULTS.deps) {
    next.deps = { ...DEFAULTS.deps, ...partial.deps };
  }
  DEFAULTS = next;
  return DEFAULTS;
}

export function getDefaults() {
  return DEFAULTS;
}

// Test/host helper: wipe the defaults store.
export function resetDefaults() {
  DEFAULTS = {};
}

const TARGETS = {
  scorm: build,
  html: buildStandaloneHtml,
  "html-offline": buildStandalonePackage,
};

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function hasGlobal(name) {
  return typeof globalThis !== "undefined" && globalThis[name] != null;
}

// Merge a single call's options over the stored defaults (features/deps deep-ish).
function mergeOptions(options) {
  const merged = { ...DEFAULTS, ...options };
  merged.features = { ...DEFAULTS.features, ...options.features };
  merged.deps = { ...DEFAULTS.deps, ...options.deps };
  return merged;
}

// Fill in JSZip / mathpix from the CDN when needed, missing, and allowed.
async function resolveDeps(target, opts) {
  if (opts.autoDeps === false || !isBrowser()) return opts.deps;

  const needsZip = target === "scorm" || target === "html-offline";
  const needsMathpix = opts.markdown != null && opts.mathpix == null && !opts.deps?.mathpix;

  const wantZip = needsZip && !opts.deps?.JSZip && !hasGlobal("JSZip");
  const wantMathpix = needsMathpix && !hasGlobal("markdownToHTML");
  if (!wantZip && !wantMathpix) return opts.deps;

  const loaded = await ensureDependencies({
    jszip: wantZip,
    mathpix: wantMathpix,
    jszipUrl: opts.jszipUrl,
    mathpixUrl: opts.mathpixUrl,
  });
  return { ...opts.deps, ...(wantZip ? { JSZip: loaded.JSZip } : {}), ...(wantMathpix ? { mathpix: loaded.mathpix } : {}) };
}

/**
 * @param {object} options - { target, html|markdown, download?, ...builderOptions }
 * @returns {Promise<{ data, filename, mediaType, metadata, html, entries? }>}
 */
export async function exportDocument(options = {}) {
  const opts = mergeOptions(options);

  // First-class `focusMode` boolean maps onto the raw scriptContext flag, so a
  // caller can open the document in focus mode without knowing the internal
  // scriptContext surface. An explicit scriptContext.startFocusMode still wins.
  if (opts.focusMode != null) {
    opts.scriptContext = {
      startFocusMode: !!opts.focusMode,
      ...opts.scriptContext,
    };
  }

  const target = opts.target || "scorm";
  const builder = TARGETS[target];
  if (!builder) {
    throw new Error(
      `exportDocument: unknown target "${target}". Use one of: ${Object.keys(TARGETS).join(", ")}.`
    );
  }

  opts.deps = await resolveDeps(target, opts);

  const result = await builder(opts);

  if (opts.download === true && isBrowser()) {
    download(result);
  }
  return result;
}
