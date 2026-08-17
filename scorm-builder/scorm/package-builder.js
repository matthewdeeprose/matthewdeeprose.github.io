// Assemble a SCORM 2004 .zip from a self-contained HTML string.
// Ported from scorm-export-manager.js zip build (~lines 1112-1138).
//
// JSZip is an INJECTED dependency (opts.deps.JSZip) with a globalThis.JSZip
// fallback, so this module stays dependency-free for browser consumers while
// node tests pass JSZip explicitly.

import { resolveConfig } from "./config.js";
import { generateManifest } from "./manifest.js";
import { normaliseLom, renderLomDocument, renderLomFragment } from "./lom.js";
import { generateApiWrapper } from "./api-wrapper.js";
import { prepareScormHtml } from "./prepare-scorm-html.js";
import { generateReadme } from "./readme.js";
import { generateFilename } from "./filename.js";
import {
  resolveJSZip,
  bundleLocalMathjax,
  bundleAssets,
  auditMathjaxAssets,
} from "../util/zip-helpers.js";

// A stable id/date can be injected for deterministic output (tests, reproducible builds).
function resolveStamp(opts) {
  const epochMs = opts.epochMs ?? Date.now();
  const isoDate = opts.isoDate || new Date(epochMs).toISOString().slice(0, 10);
  const identifier = opts.identifier || `scorm_${epochMs}`;
  return { epochMs, isoDate, identifier };
}

/**
 * @param {string} html - a self-contained HTML document (the SCO content)
 * @param {object} [metadata] - { title, author?, date?, sections?, description? }
 * @param {object} [opts]
 * @param {object} [opts.deps] - { JSZip }
 * @param {object} [opts.config] - SCORM config overrides
 * @param {string} [opts.mathjaxMode] - "cdn" | "local"
 * @param {object} [opts.assets] - { 'relative/path.ext': content } companion files to bundle + declare
 * @param {string} [opts.identifier] - pin manifest/LOM identifier
 * @param {number} [opts.epochMs] - pin timestamps
 * @param {string} [opts.isoDate] - pin date (YYYY-MM-DD)
 * @param {string} [opts.lang] - document language; reaches LOM general.language
 *   and every LangString @language. Defaults to "en".
 * @param {(warning:{code:string}) => void} [opts.onMetadataWarning] - dropped or
 *   invalid LOM input (bad vocabulary token, bad date, bad language)
 * @param {(warning:{type,message,snippet}) => void} [opts.onMathjaxAssetWarning] -
 *   mathjaxMode 'local' with chemistry in the content but no mhchem.js in
 *   mathjaxAssets, which stops the WHOLE document typesetting
 * @param {string} [opts.outputType] - JSZip output type ("blob" | "nodebuffer" | "uint8array")
 * @returns {Promise<{ data: Blob|Buffer|Uint8Array, filename: string, entries: string[], mediaType: string }>}
 */
export async function buildPackage(html, metadata = {}, opts = {}) {
  const JSZip = resolveJSZip(opts);
  const config = resolveConfig(opts.config);
  const { isoDate, identifier } = resolveStamp(opts);
  const mathjaxMode = opts.mathjaxMode || config.MATHJAX_MODE;

  const scormHTML = prepareScormHtml(html, { config, mathjaxMode });

  const zip = new JSZip();
  zip.file(config.CONTENT_FILENAME, scormHTML);

  // Bundle caller-supplied companion files (video/audio/etc.) first, so their
  // paths can be declared as <file> entries in the manifest. Path-safe: throws
  // on ".."/absolute/reserved-name collisions.
  const assetEntries = bundleAssets(zip, opts.assets, config);

  // Quiz scoring wiring. "scored" = a quiz is present AND the build asked to
  // report it. Only then do we switch on gradebook behaviour: populate the
  // manifest masteryscore, expose the enable-scoring README, and tell the API
  // wrapper to defer completion/success to the quiz (so a formative quiz with
  // reporting off keeps the legacy complete-on-exit behaviour).
  const scored = opts.quizPresent === true && opts.reportScore === true;
  const masteryScore = Number.isFinite(opts.masteryScore) ? opts.masteryScore : 60;
  const maxScore = Number.isFinite(opts.maxScore) ? opts.maxScore : 100;

  // ONE normalisation, TWO serialisations. metadata.xml and the manifest's inline
  // <lom> therefore cannot drift apart, and a host that reads both sees the same
  // values twice. Inline is the form ADL's reference template uses and the form
  // Rustici documents reading; the external file is kept because it costs nothing,
  // preserves today's zip layout, and is a clean archival artefact.
  const lom = normaliseLom(metadata, {
    identifier: `${identifier}_lom`,
    config,
    language: opts.lang,
    onWarning: opts.onMetadataWarning,
  });

  zip.file(
    config.MANIFEST_FILENAME,
    generateManifest(metadata, {
      identifier,
      config,
      files: assetEntries,
      masteryScore: scored ? masteryScore : null,
      lom: renderLomFragment(lom, 4), // indented to sit inside <metadata> at depth 1
    })
  );
  zip.file(config.METADATA_FILENAME, renderLomDocument(lom));
  zip.file(config.API_FILENAME, generateApiWrapper({ quizPresent: scored, reportScore: scored }));
  zip.file(
    config.README_FILENAME,
    // isoDate is threaded through so the README honours the determinism pin like
    // the filename and manifest do; unpinned it still resolves to today.
    generateReadme(metadata, { config, mathjaxMode, reportScore: scored, maxScore, isoDate })
  );

  const entries = [
    config.CONTENT_FILENAME,
    config.MANIFEST_FILENAME,
    config.METADATA_FILENAME,
    config.API_FILENAME,
    config.README_FILENAME,
    ...assetEntries,
  ];

  // Local MathJax mode: bundle the MathJax es5 assets so the package renders
  // maths fully offline. content.html already references config.LOCAL_MATHJAX_PATH
  // (rewritten by prepareScormHtml). Asset keys are relative to LOCAL_MATHJAX_DIR
  // (e.g. "es5/tex-chtml.js"); values may be strings or Uint8Array (fonts).
  if (mathjaxMode === "local") {
    // Incomplete asset maps are a whole-document maths outage, not a per-equation
    // one — see auditMathjaxAssets. Warn (never throw) before we bundle.
    if (opts.onMathjaxAssetWarning) {
      for (const w of auditMathjaxAssets(html, opts.mathjaxAssets)) opts.onMathjaxAssetWarning(w);
    }
    entries.push(...bundleLocalMathjax(zip, opts.mathjaxAssets, config));
  }

  const outputType = opts.outputType || (typeof Blob !== "undefined" ? "blob" : "nodebuffer");
  const data = await zip.generateAsync({
    type: outputType,
    compression: "DEFLATE",
    compressionOptions: { level: config.COMPRESSION_LEVEL },
  });

  return {
    data,
    filename: generateFilename(metadata, { isoDate }),
    entries,
    mediaType: "application/zip",
  };
}
