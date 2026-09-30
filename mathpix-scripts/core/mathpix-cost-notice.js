/**
 * @fileoverview MathPix cost notice writer
 * @module MathPixCostNotice
 * @since 24 September 2026
 *
 * @description
 * Writes the text of a MathPix cost notice (tools.html, class
 * "mathpix-cost-notice") that changes at runtime: the upload-preview page
 * estimate and the PDF options estimate.
 *
 * Each notice holds an icon-library icon and a `.mathpix-cost-notice-text`
 * span. Only the span is rewritten, so the icon survives. Figures are wrapped
 * in <strong> so they stand out visually; the words carry the meaning, so the
 * emphasis is never the only cue.
 *
 * Deliberately NOT a live region: each notice is tied to its button by
 * aria-describedby, so a screen reader hears it on focus and a change stays
 * silent. Writes only when the text has changed.
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

const COST_NOTICE_TEXT_SELECTOR = ".mathpix-cost-notice-text";

/**
 * Write a cost notice's text from segments.
 *
 * @param {string} noticeId - id of the `.mathpix-cost-notice` paragraph
 * @param {Array<string|{figure: string}>} segments - Plain strings, and
 *   `{ figure }` objects for amounts to emphasise
 * @returns {{text: string|null, written: boolean}} The plain text, and
 *   whether the DOM was changed. text is null when the notice is absent.
 *
 * @example
 * writeCostNotice("mathpix-pdf-cost-notice", [
 *   "4 pages at ", { figure: "$0.005" }, " each: about ", { figure: "$0.02" }, ".",
 * ]);
 */
function writeCostNotice(noticeId, segments) {
  const target = document
    .getElementById(noticeId)
    ?.querySelector(COST_NOTICE_TEXT_SELECTOR);
  if (!target) {
    logDebug("writeCostNotice: notice text span not in DOM", { noticeId });
    return { text: null, written: false };
  }

  const text = segments
    .map((segment) => (typeof segment === "string" ? segment : segment.figure))
    .join("");

  // Collapse whitespace so the markup's wrapped fallback compares equal
  if (target.textContent.replace(/\s+/g, " ").trim() === text) {
    return { text, written: false };
  }

  const nodes = segments.map((segment) => {
    if (typeof segment === "string") return document.createTextNode(segment);
    const strong = document.createElement("strong");
    strong.textContent = segment.figure;
    return strong;
  });
  target.replaceChildren(...nodes);

  logDebug("Cost notice written", { noticeId, text });
  return { text, written: true };
}

export { writeCostNotice };
