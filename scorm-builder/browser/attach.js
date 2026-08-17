// Browser helper: wire a DOM button to an export in one call. Framework-agnostic,
// no notification dependency — report via onStatus/onError callbacks.
//
//   const { detach } = attachExportButton(btn, {
//     target: 'scorm', format: 'markdown',
//     getContent: () => editor.getMarkdown(),
//     onStatus: (s) => statusEl.textContent = s.message,
//   });

import { exportDocument } from "../core/export-facade.js";

/**
 * @param {Element} el - the button element
 * @param {object} [options]
 * @param {() => (string|{html?:string,markdown?:string}|Promise)} [options.getContent]
 * @param {'html'|'markdown'} [options.format='html'] - how to interpret a string from getContent
 * @param {boolean} [options.download=true] - auto-download the result
 * @param {(s:{phase:string,message:string,result?:object,error?:Error})=>void} [options.onStatus]
 * @param {(err:Error)=>void} [options.onError]
 * @param {...*} options - remaining keys passed to exportDocument (target, features, deps, …)
 * @returns {{ detach: () => void, trigger: () => Promise<object|undefined> }}
 */
export function attachExportButton(el, options = {}) {
  if (!el || typeof el.addEventListener !== "function") {
    throw new Error("attachExportButton: a button element is required");
  }
  const { getContent, format = "html", download = true, onStatus, onError, ...exportOpts } = options;
  const status = (phase, message, extra) => onStatus && onStatus({ phase, message, ...extra });

  async function run() {
    const wasDisabled = el.disabled;
    el.disabled = true;
    try {
      status("start", "Exporting…");
      const raw = getContent ? await getContent() : undefined;

      const contentOpts = {};
      if (raw && typeof raw === "object") Object.assign(contentOpts, raw); // {html}|{markdown}
      else if (format === "markdown") contentOpts.markdown = raw ?? "";
      else contentOpts.html = raw ?? "";

      const result = await exportDocument({ ...exportOpts, ...contentOpts, download });
      status("done", `Exported "${result.filename}"`, { result });
      return result;
    } catch (error) {
      if (onError) onError(error);
      else status("error", error?.message || String(error), { error });
      return undefined;
    } finally {
      el.disabled = wasDisabled;
    }
  }

  function onClick() {
    run();
  }
  el.addEventListener("click", onClick);

  return {
    detach: () => el.removeEventListener("click", onClick),
    trigger: run,
  };
}
