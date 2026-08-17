// Stable slug for heading ids / TOC anchors. Used by the metadata provider and
// the TOC generator so links and targets agree.

export function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}
