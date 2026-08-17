// music-export.js
// MusicXML export (download) service for the Accessible Music proof of concept.
//
// A stateless service, like music-render-text.js and music-render-summary.js: it
// owns no DOM elements, caches nothing, has no init and no readyState guard. It
// exposes a single render(xmlText, filename, mountEl) method that builds a
// "Download MusicXML" button into the given mount element, plus a selfTest().
// NOTE the signature differs from the other renderers: it takes the RAW xmlText
// and a filename, NOT the parsed model — it does not parse and does not use the
// model. The button, when clicked, downloads the supplied xmlText as a file. Like
// the other renderers it is SYNCHRONOUS, returns false on bad input, and NEVER
// throws. Exposed as window.MusicExport.

const MusicExport = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side notifications: route through the shared MusicNotify when
  // present, otherwise fall back to silent no-ops so this file never notifies
  // directly if the notify layer is absent.
  const notify = window.MusicNotify || { info() {}, success() {}, warning() {}, error() {}, show() {} };

  // Consumer-side icon library: route through the shared IconLibrary when
  // present, otherwise fall back to neutral no-ops so this file never throws if
  // the icon layer is absent — the visible text label still works.
  const icons = window.IconLibrary || { populateIcons() {}, getIcon() { return ""; }, hasIcon() { return false; } };

  // Build a Blob of the supplied MusicXML text. PRIVATE and pure: no DOM, no URL,
  // no click — the testable seam. The MIME type is not load-bearing because the
  // download filename carries the .musicxml extension; application/xml is an
  // acceptable alternative to the official recordare type.
  function buildBlob(xmlText) {
    return new Blob([xmlText], { type: "application/vnd.recordare.musicxml+xml" });
  }

  // Normalise a filename so it always ends ".musicxml". PRIVATE and pure.
  // The exported bytes are always uncompressed MusicXML, so the extension is
  // always ".musicxml", never the compressed ".mxl" (or any other extension):
  //   - a name containing a dot has only the text after its LAST dot replaced,
  //     so "Sicut_cervus.mxl" becomes "Sicut_cervus.musicxml" and
  //     "score_v1.2.mxl" becomes "score_v1.2.musicxml" (base kept, dots and all);
  //   - a name with no dot gains ".musicxml" appended;
  //   - a name already ending ".musicxml" is returned unchanged (the last-dot
  //     replacement rewrites "musicxml" with "musicxml", a no-op).
  function musicxmlName(filename) {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return filename + ".musicxml";
    return filename.slice(0, lastDot + 1) + "musicxml";
  }

  // Build a "Download MusicXML" button into mountEl that downloads xmlText as
  // filename when clicked. Synchronous; returns true on success and false on any
  // failure; NEVER throws. NOTE: takes raw xmlText + filename, not a parsed model.
  function render(xmlText, filename, mountEl) {
    // Guard: we need a non-empty string of MusicXML to export.
    if (typeof xmlText !== "string" || !xmlText.length) {
      logError("Cannot export: xmlText is missing or not a non-empty string");
      return false;
    }

    // Guard: we need a mount element to build into.
    if (!mountEl) {
      logError("Cannot export: no mount element supplied");
      return false;
    }

    // Resolve a safe download name, falling back to a sensible default.
    const name = (typeof filename === "string" && filename.length) ? filename : "score.musicxml";

    // Clear any previous render from the mount before building afresh.
    mountEl.replaceChildren();

      // Export invariant: buildBlob always emits uncompressed MusicXML bytes, so
    // the download name must always end ".musicxml", never the compressed ".mxl".
    // musicxmlName normalises the resolved name to honour that invariant.
    const downloadName = musicxmlName(name);

    // Build the button with createElement only (no innerHTML in our code):
    // a <button> containing an aria-hidden icon span then the visible label.
    // The accessible name is exactly "Download MusicXML".
    const button = document.createElement("button");
    button.type = "button";

    const iconSpan = document.createElement("span");
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.setAttribute("data-icon", "download");
    button.appendChild(iconSpan);
    button.appendChild(document.createTextNode(" Download MusicXML"));

    // Click handler closes over xmlText and downloadName. Builds a Blob,
    // downloads it via a throwaway anchor, then revokes the object URL
    // synchronously (per plan).
    button.addEventListener("click", function () {
      const blob = buildBlob(xmlText);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // If any browser cancels the download, defer the revoke with
      // setTimeout(() => URL.revokeObjectURL(url), 0) instead of revoking here.
      URL.revokeObjectURL(url);
      notify.success("Downloaded " + downloadName);
      logInfo("Downloaded " + downloadName);
    });

    mountEl.appendChild(button);

    // Inject the SVG icon into the data-icon span. The guard above makes this a
    // safe no-op when the library is absent; the visible text label still works.
    icons.populateIcons(button);

    logInfo("Rendered export button into #" + (mountEl.id || "mount"));
    return true;
  }

  // Self-test: synchronous and self-contained. Builds into a DETACHED temp <div>
  // (never attached to the page) so it never touches #status and never notifies —
  // no restore needed. It does NOT fire a real download and does NOT click the
  // button. As it lives inside the IIFE it calls the private buildBlob directly.
  // console.table()s and returns the results object.
  function selfTest() {
    const SAMPLE = "<score-partwise/>"; // export is parse-agnostic; any non-empty string is fine
    const temp = document.createElement("div");
    const returnsTrueOnRender = render(SAMPLE, "sample.musicxml", temp) === true;
    const button = temp.querySelector("button");
    const span = button ? button.querySelector("span[data-icon]") : null;
    const visibleText = button
      ? Array.from(button.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim()
      : "";

    const results = {
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      returnsTrueOnRender: returnsTrueOnRender,
      buttonExists: !!button,
      buttonTypeButton: !!button && button.type === "button",
      accessibleNameCorrect: visibleText === "Download MusicXML",
      iconSpanPresent: !!span && span.getAttribute("data-icon") === "download",
      iconSpanHidden: !!span && span.getAttribute("aria-hidden") === "true",
      iconPopulatesWhenAvailable: !window.IconLibrary || (!!span && !!span.querySelector("svg")),
      blobConstructed: (function () { const b = buildBlob(SAMPLE); return (b instanceof Blob) && b.size > 0; })(),
      handlesEmptyText: render("", "x.musicxml", document.createElement("div")) === false,
      handlesNoMount: render(SAMPLE, "x.musicxml", null) === false,
      // Export invariant: every download name ends ".musicxml", never ".mxl".
      mxlBecomesMusicxml: musicxmlName("Sicut_cervus.mxl") === "Sicut_cervus.musicxml",
      xmlBecomesMusicxml: musicxmlName("score.xml") === "score.musicxml",
      extensionlessGainsMusicxml: musicxmlName("score") === "score.musicxml",
      dottedBaseKept: musicxmlName("score_v1.2.mxl") === "score_v1.2.musicxml",
      alreadyMusicxmlUnchanged: musicxmlName("score.musicxml") === "score.musicxml",
      defaultFallbackEndsMusicxml: musicxmlName("score.musicxml").endsWith(".musicxml"),
    };

    console.table(results);
    return results;
  }

  return { render, selfTest };
})();

window.MusicExport = MusicExport;
