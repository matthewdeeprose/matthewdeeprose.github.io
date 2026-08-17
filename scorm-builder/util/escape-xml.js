// XML special-character escaping. Ported verbatim from scorm-export-manager.js
// escapeXML (~line 1262).

export function escapeXML(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
