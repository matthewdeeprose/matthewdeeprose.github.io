// Browser helper: trigger a file download from a builder/facade result.
// Generalises the demo's hand-rolled downloadBlob.

/**
 * @param {{ data: Blob|ArrayBuffer|Uint8Array|string, filename?: string, mediaType?: string }} result
 * @param {object} [opts] - { filename, mediaType } overrides
 * @returns {string} the filename used
 */
export function download(result, opts = {}) {
  if (typeof document === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
    throw new Error("download() requires a browser environment");
  }
  const data = result?.data ?? result;
  const filename = opts.filename || result?.filename || "download";
  const mediaType = opts.mediaType || result?.mediaType || "application/octet-stream";

  const blob = data instanceof Blob ? data : new Blob([data], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Best-effort cleanup; don't let a late revoke throw or keep a process alive.
  const t = setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 2000);
  if (t && typeof t.unref === "function") t.unref();
  return filename;
}
