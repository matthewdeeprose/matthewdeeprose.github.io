// UTF-8-safe base64 encode/decode. The encode must round-trip with the export's
// in-page save script, which decodes via `decodeURIComponent(escape(atob(b64)))`
// (see source/templates/js/document-save-functionality.js). The matching browser
// encode is `btoa(unescape(encodeURIComponent(str)))`; under node we use Buffer.
// Either path produces standard base64 of the UTF-8 bytes, so they interoperate.

/**
 * Encode a string to base64 of its UTF-8 bytes.
 * @param {string} str
 * @returns {string} base64
 */
export function encodeBase64Utf8(str) {
  const s = String(str);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf8").toString("base64");
  }
  // Browser: percent-encode to UTF-8, then map each byte into btoa's latin1 input.
  return btoa(unescape(encodeURIComponent(s)));
}

/**
 * Decode base64 of UTF-8 bytes back to a string. Mirror of the save script's decode.
 * @param {string} b64
 * @returns {string}
 */
export function decodeBase64Utf8(b64) {
  const s = String(b64);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(s)));
}
