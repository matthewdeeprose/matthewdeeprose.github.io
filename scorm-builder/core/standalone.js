// Standalone HTML export — the original Pandoc-WASM playground's "self-contained
// .html" feature. A SCORM package *is* this same html plus SCORM scaffolding in a
// zip, so standalone export is just buildDocument() + a .html filename + a blob.
//
//   buildStandaloneHtml(options)    -> { data: Blob|string, filename, mediaType, html, metadata }
//   buildStandalonePackage(options) -> { data: zip, filename, entries, mediaType, html, metadata }
//
// This is purely additive packaging around buildDocument(); it never injects any
// SCORM artefacts (no scorm-api.js, manifest, LOM or README).

import { buildDocument } from "./builder.js";
import { resolveConfig } from "../scorm/config.js";
import { generateHtmlFilename } from "../scorm/filename.js";
import { resolveJSZip, bundleLocalMathjax, auditMathjaxAssets } from "../util/zip-helpers.js";

// Companion `assets` are a SCORM-only feature (they must be declared in the
// imsmanifest). The single-file HTML can't carry separate files, and the offline
// zip has no manifest — so reject rather than silently drop them.
function assertNoAssets(options, where) {
  if (options.assets && Object.keys(options.assets).length > 0) {
    throw new Error(
      `scorm-builder: 'assets' are only supported for target 'scorm' (a SCORM package). ` +
        `${where} cannot carry companion files — inline them as data: URLs, or use the SCORM target.`
    );
  }
}

/**
 * Build a single self-contained .html file. Maths renders via the MathJax CDN
 * (default `mathjaxMode:'cdn'`), matching the original playground export.
 * @param {object} [options] - the same options buildDocument accepts, plus opts.isoDate
 * @returns {Promise<{ data: Blob|string, filename: string, mediaType: string, html: string, metadata: object }>}
 */
export async function buildStandaloneHtml(options = {}) {
  assertNoAssets(options, "buildStandaloneHtml / target 'html'");
  const { html, metadata } = await buildDocument({
    ...options,
    mathjaxMode: options.mathjaxMode || "cdn",
  });

  const filename = generateHtmlFilename(metadata, { isoDate: options.isoDate });
  const data = typeof Blob !== "undefined" ? new Blob([html], { type: "text/html" }) : html;

  return { data, filename, mediaType: "text/html", html, metadata };
}

/**
 * Build an offline .zip variant: the standalone .html plus the bundled MathJax
 * es5 assets ("SCORM minus the manifest"). Forces `mathjaxMode:'local'` so the
 * html references the local MathJax path, and requires opts.mathjaxAssets.
 * @param {object} [options]
 * @param {object} [options.deps] - { JSZip }
 * @param {object} [options.mathjaxAssets] - { 'es5/...': content } map (required)
 * @param {(warning:{type,message,snippet}) => void} [options.onMathjaxAssetWarning] -
 *   chemistry in the content with no mhchem.js in mathjaxAssets (stops ALL maths)
 * @param {object} [options.config] - config overrides (LOCAL_MATHJAX_DIR etc.)
 * @param {string} [options.outputType] - JSZip output type ("blob" | "nodebuffer" | "uint8array")
 * @param {string} [options.isoDate] - pin date (YYYY-MM-DD)
 * @returns {Promise<{ data: Blob|Buffer|Uint8Array, filename: string, entries: string[], mediaType: string, html: string, metadata: object }>}
 */
export async function buildStandalonePackage(options = {}) {
  assertNoAssets(options, "buildStandalonePackage / target 'html-offline'");
  const JSZip = resolveJSZip(options);
  const config = resolveConfig(options.config);

  // Local MathJax so the html references ./libs/mathjax/...; no SCORM injection.
  const { html, metadata } = await buildDocument({
    ...options,
    mathjaxMode: "local",
  });

  // An incomplete asset map takes the whole document's maths down, not just the
  // chemistry — see auditMathjaxAssets. Warn at build time; never throw.
  if (options.onMathjaxAssetWarning) {
    for (const w of auditMathjaxAssets(html, options.mathjaxAssets)) options.onMathjaxAssetWarning(w);
  }

  const zip = new JSZip();
  zip.file("index.html", html);
  const entries = ["index.html", ...bundleLocalMathjax(zip, options.mathjaxAssets, config)];

  const outputType = options.outputType || (typeof Blob !== "undefined" ? "blob" : "nodebuffer");
  const data = await zip.generateAsync({
    type: outputType,
    compression: "DEFLATE",
    compressionOptions: { level: config.COMPRESSION_LEVEL },
  });

  const filename = generateHtmlFilename(metadata, { isoDate: options.isoDate, offline: true, ext: ".zip" });

  return { data, filename, entries, mediaType: "application/zip", html, metadata };
}
