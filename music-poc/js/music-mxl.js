// music-mxl.js
// The .mxl extractor for the Accessible Music proof of concept.
//
// An .mxl is a COMPRESSED MusicXML file: a ZIP archive holding
// META-INF/container.xml plus the real score file. container.xml carries a
// <rootfile full-path="..."> element whose attribute names the score entry to
// open. This module owns ONE responsibility: turn an .mxl ArrayBuffer into the
// inner MusicXML string. extractXml unzips the buffer, reads container.xml,
// follows its rootfile to the named entry, and returns that entry's text. If
// container.xml is missing or unusable it FALLS BACK to the first .musicxml/.xml
// entry that lives outside META-INF/. It returns null on any failure and never
// throws, so the loader (wired in step 2) can fall back gracefully to treating
// the upload as plain MusicXML.
//
// It does NOT parse the music, touch the DOM beyond DOMParser, or read the page.
//
// Dependencies: the JSZip global (self-hosted by Matthew at
// https://matthewdeeprose.github.io/scripts/jszip.min.js, JSZip 3.x, loaded via
// a plain <script> tag) and the browser's DOMParser. Both are browser-only, so
// this module is browser-only too — selfTest builds its fixtures with JSZip and
// must be run in the browser console, not under node. Exposed as window.MusicMxl.

const MusicMxl = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // extractXml(arrayBuffer) → Promise<string|null>. Unzips an .mxl ArrayBuffer
  // and returns the inner MusicXML text, following META-INF/container.xml to its
  // rootfile, or falling back to the first score-shaped entry outside META-INF/.
  // Returns null — never throws — on any failure, so the loader can fall back.
  async function extractXml(arrayBuffer) {
    if (!arrayBuffer) {
      logWarn("extractXml: no ArrayBuffer supplied");
      return null;
    }
    if (typeof JSZip === "undefined") {
      logError("extractXml: JSZip is not loaded — cannot unzip the .mxl file");
      return null;
    }

    try {
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Prefer the entry named by META-INF/container.xml's rootfile.
      let entryName = null;
      const containerEntry = zip.file("META-INF/container.xml");
      if (containerEntry) {
        const containerXml = await containerEntry.async("string");
        const doc = new DOMParser().parseFromString(containerXml, "application/xml");
        // Use getElementsByTagName, NOT querySelector: container.xml declares a
        // default XML namespace that querySelector does not reliably match.
        const rootfile = doc.getElementsByTagName("rootfile")[0];
        const path = rootfile ? rootfile.getAttribute("full-path") : null;
        if (path && zip.file(path)) {
          entryName = path;
        }
      }

      // Fall back: container.xml absent or gave no usable rootfile. Pick the
      // first entry outside META-INF/, not the mimetype marker, ending .musicxml
      // or .xml (case-insensitive).
      if (!entryName) {
        logWarn("extractXml: no usable rootfile in container.xml — falling back to first score entry");
        entryName =
          Object.keys(zip.files).find(function (name) {
            if (/^META-INF\//i.test(name)) return false;
            if (name === "mimetype") return false;
            return /\.(musicxml|xml)$/i.test(name);
          }) || null;
      }

      if (!entryName) {
        logError("extractXml: no MusicXML entry found in the .mxl archive");
        return null;
      }

      const xml = await zip.file(entryName).async("string");
      logInfo("extractXml: extracted entry", { entry: entryName, length: xml.length });
      return xml;
    } catch (e) {
      logError("extractXml: failed to extract MusicXML from the .mxl buffer", e);
      return null;
    }
  }

  // selfTest — BROWSER-ONLY (needs the JSZip global and DOMParser). Async because
  // it builds its own .mxl fixtures with JSZip.generateAsync and round-trips them
  // through extractXml. Builds a results object, console.table()s it and returns
  // it (the resolved value of the promise). MusicPdfRasterise.selfTest is the
  // precedent for an async selfTest.
  async function selfTest() {
    const MARKER = "<!--MXL-SELFTEST-->";
    // A minimal, well-formed MusicXML score carrying the unambiguous marker.
    const score =
      '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1">' +
      MARKER +
      "</score-partwise>";

    // container.xml naming a given rootfile path.
    function container(path) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
        "<rootfiles>" +
        '<rootfile full-path="' +
        path +
        '" media-type="application/vnd.recordare.musicxml+xml"/>' +
        "</rootfiles></container>"
      );
    }

    const results = {
      hasExtractXml: typeof extractXml === "function",
      hasSelfTest: typeof selfTest === "function",
      jszipPresent: typeof JSZip !== "undefined",
    };

    // Without JSZip the remaining fixture-building rows cannot run; report what
    // we know and return early so the table stays clean.
    if (!results.jszipPresent) {
      if (typeof console !== "undefined" && typeof console.table === "function") {
        console.table(results);
      }
      logWarn("MusicMxl selfTest: JSZip not present — fixture rows skipped");
      return results;
    }

    // Rootfile at the archive root: container.xml → score.xml.
    try {
      const zip = new JSZip();
      zip.file("mimetype", "application/vnd.recordare.musicxml+xml");
      zip.file("META-INF/container.xml", container("score.xml"));
      zip.file("score.xml", score);
      const buf = await zip.generateAsync({ type: "arraybuffer" });
      const xml = await extractXml(buf);
      results.extractsViaContainer = typeof xml === "string" && xml.indexOf(MARKER) !== -1;
    } catch (e) {
      logError("selfTest: extractsViaContainer fixture failed", e);
      results.extractsViaContainer = false;
    }

    // Nested rootfile: container.xml → MusicXML/song.musicxml.
    try {
      const zip = new JSZip();
      zip.file("mimetype", "application/vnd.recordare.musicxml+xml");
      zip.file("META-INF/container.xml", container("MusicXML/song.musicxml"));
      zip.file("MusicXML/song.musicxml", score);
      const buf = await zip.generateAsync({ type: "arraybuffer" });
      const xml = await extractXml(buf);
      results.followsNestedRootfile = typeof xml === "string" && xml.indexOf(MARKER) !== -1;
    } catch (e) {
      logError("selfTest: followsNestedRootfile fixture failed", e);
      results.followsNestedRootfile = false;
    }

    // No container.xml: fall back to the only score-shaped entry.
    try {
      const zip = new JSZip();
      zip.file("tune.musicxml", score);
      const buf = await zip.generateAsync({ type: "arraybuffer" });
      const xml = await extractXml(buf);
      results.fallsBackWithoutContainer = typeof xml === "string" && xml.indexOf(MARKER) !== -1;
    } catch (e) {
      logError("selfTest: fallsBackWithoutContainer fixture failed", e);
      results.fallsBackWithoutContainer = false;
    }

    // Garbage (non-zip) bytes: resolves null AND does not throw.
    try {
      const garbage = new Uint8Array([1, 2, 3, 4]).buffer;
      const xml = await extractXml(garbage);
      results.nullOnGarbageNoThrow = xml === null;
    } catch (e) {
      logError("selfTest: extractXml threw on garbage — it must resolve null instead", e);
      results.nullOnGarbageNoThrow = false;
    }

    // Null input: resolves null.
    try {
      results.nullOnNull = (await extractXml(null)) === null;
    } catch (e) {
      logError("selfTest: extractXml threw on null input", e);
      results.nullOnNull = false;
    }

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicMxl selfTest verdict", results);
    return results;
  }

  return {
    extractXml,
    selfTest,
  };
})();

// Exposed as window.MusicMxl. This module is browser-only (it needs the JSZip
// global and DOMParser), so attaching to window — rather than globalThis — is
// the right home; node --check only parses this file and never executes the
// assignment.
window.MusicMxl = MusicMxl;
