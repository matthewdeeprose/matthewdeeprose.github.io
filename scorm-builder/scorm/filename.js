// Academic-style export filenames. Ported from scorm-export-manager.js
// generateSCORMFilename (~line 1278). Deterministic: the date (YYYY-MM-DD) is
// injected via opts.isoDate so tests can pin it.
//
// SCORM:      Title-Author_Year-SCORM_Package-Packaged_on_YYYY-MM-DD.zip
// Standalone: Title-Author_Year-Converted_on_YYYY-MM-DD.html
// Offline:    Title-Author_Year-Offline-Converted_on_YYYY-MM-DD.zip

const FILENAME_CONFIG = {
  WORD_SEPARATOR: "_",
  SECTION_SEPARATOR: "-",
  SCORM_IDENTIFIER: "SCORM_Package",
  PACKAGED_TEMPLATE: "Packaged_on_",
  CONVERTED_TEMPLATE: "Converted_on_",
  OFFLINE_IDENTIFIER: "Offline",
  DEFAULT_TITLE: "Accessible_Document",
  DEFAULT_AUTHOR: "Unknown_Author",
  MAX_TITLE_LENGTH: 50,
  MAX_AUTHOR_LENGTH: 25,
  ALLOWED_CHARS_REGEX: /[^a-zA-Z0-9\s]/g,
  MULTIPLE_SPACES_REGEX: /\s+/g,
  EXTENSION: ".zip",
};

export function clean(value, maxLength) {
  return value
    .trim()
    .replace(FILENAME_CONFIG.ALLOWED_CHARS_REGEX, " ")
    .replace(FILENAME_CONFIG.MULTIPLE_SPACES_REGEX, " ")
    .trim()
    .slice(0, maxLength)
    .replace(/\s+/g, FILENAME_CONFIG.WORD_SEPARATOR);
}

// Resolve cleaned { title, author, year } from metadata + a pinned isoDate.
function resolveParts(metadata, isoDate) {
  const title =
    metadata.title && metadata.title.trim()
      ? clean(metadata.title, FILENAME_CONFIG.MAX_TITLE_LENGTH)
      : FILENAME_CONFIG.DEFAULT_TITLE;

  const author =
    metadata.author && metadata.author.trim()
      ? clean(metadata.author, FILENAME_CONFIG.MAX_AUTHOR_LENGTH)
      : FILENAME_CONFIG.DEFAULT_AUTHOR;

  let year = isoDate.slice(0, 4);
  if (metadata.date) {
    const match = metadata.date.match(/\b(19|20)\d{2}\b/);
    if (match) year = match[0];
  }

  return { title, author, year };
}

// Join the cleaned parts plus any extra segments into a filename. The first two
// sections are always "Title" then "Author_Year"; `segments` follow, then `ext`.
function composeFilename({ title, author, year }, { segments = [], ext = FILENAME_CONFIG.EXTENSION } = {}) {
  const parts = [title, author + FILENAME_CONFIG.WORD_SEPARATOR + year, ...segments];
  return parts.join(FILENAME_CONFIG.SECTION_SEPARATOR) + ext;
}

export function generateFilename(metadata = {}, opts = {}) {
  const isoDate = opts.isoDate || new Date().toISOString().slice(0, 10);

  try {
    return composeFilename(resolveParts(metadata, isoDate), {
      segments: [FILENAME_CONFIG.SCORM_IDENTIFIER, FILENAME_CONFIG.PACKAGED_TEMPLATE + isoDate],
      ext: FILENAME_CONFIG.EXTENSION,
    });
  } catch {
    return `Accessible_Document-Unknown_Author-SCORM_Package-Packaged_on_${isoDate}.zip`;
  }
}

/**
 * Filename for a standalone HTML export (single file) or its offline zip variant.
 * @param {object} [metadata] - { title, author?, date? }
 * @param {object} [opts]
 * @param {string} [opts.isoDate] - pin date (YYYY-MM-DD)
 * @param {boolean} [opts.offline] - add an "Offline" segment (for the bundled zip)
 * @param {string} [opts.ext] - file extension (default ".html"; pass ".zip" for offline)
 * @returns {string}
 */
export function generateHtmlFilename(metadata = {}, opts = {}) {
  const isoDate = opts.isoDate || new Date().toISOString().slice(0, 10);
  const ext = opts.ext || ".html";

  try {
    const segments = [];
    if (opts.offline) segments.push(FILENAME_CONFIG.OFFLINE_IDENTIFIER);
    segments.push(FILENAME_CONFIG.CONVERTED_TEMPLATE + isoDate);

    return composeFilename(resolveParts(metadata, isoDate), { segments, ext });
  } catch {
    const offline = opts.offline ? `-${FILENAME_CONFIG.OFFLINE_IDENTIFIER}` : "";
    return `Accessible_Document-Unknown_Author${offline}-Converted_on_${isoDate}${ext}`;
  }
}
