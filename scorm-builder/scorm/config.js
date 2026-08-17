// SCORM packaging configuration. Ported from scorm-export-manager.js SCORM_CONFIG
// (~line 49), genericised so it carries no pandoc/playground branding and every
// value can be overridden by the caller.

export const DEFAULT_SCORM_CONFIG = {
  VERSION: "2004 3rd Edition",
  SCHEMA_VERSION: "2004 3rd Edition",
  API_VERSION: "1.0",

  CONTENT_FILENAME: "content.html",
  MANIFEST_FILENAME: "imsmanifest.xml",
  METADATA_FILENAME: "metadata.xml",
  API_FILENAME: "scorm-api.js",
  README_FILENAME: "README.txt",

  MATHJAX_MODE: "cdn", // "cdn" | "local"
  CDN_MATHJAX_URL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js",
  LOCAL_MATHJAX_PATH: "./libs/mathjax/es5/tex-chtml.js",
  LOCAL_MATHJAX_DIR: "libs/mathjax", // zip folder that mathjaxAssets are written under

  MAX_PACKAGE_SIZE_MB: 50,
  COMPRESSION_LEVEL: 6,

  // Generic product identity used in readme/manifest text. Override to rebrand.
  PRODUCT_NAME: "Accessible SCORM Builder",
};

// Merge caller overrides onto the defaults (shallow — config is flat).
export function resolveConfig(overrides = {}) {
  return { ...DEFAULT_SCORM_CONFIG, ...overrides };
}
