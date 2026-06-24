// music-render-score.js
// Visual score rendering service for the Accessible Music proof of concept.
//
// A stateless service: it owns no DOM elements and caches nothing. It exposes a
// single render(xmlText, mountEl) method that draws a MusicXML string into the
// given mount element using OpenSheetMusicDisplay (OSMD), plus a selfTest().
// Exposed as window.MusicRenderScore.

const MusicRenderScore = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Notifications route through the shared MusicNotify adapter when present,
  // otherwise fall back to silent no-ops so this file never notifies directly.
  const notify = window.MusicNotify || { info() {}, success() {}, warning() {}, error() {}, show() {} };

  // The OSMD instance from the most recent successful render. Held so the
  // play-along module can drive the score cursor. Reset to null at the start of
  // every render and on any failure path, so it only ever points at a live score.
  let currentOsmd = null;

  // Render a MusicXML string into mountEl. Async, and like loadFile in
  // music-app.js it ALWAYS resolves and NEVER rejects: it resolves true on a
  // successful render and false on any failure. The visible score is the
  // success feedback, so there is no success notification.
  async function render(xmlText, mountEl) {
    // Guard: the OSMD notation library must be loaded and expose its constructor.
    if (
      typeof opensheetmusicdisplay === "undefined" ||
      typeof opensheetmusicdisplay.OpenSheetMusicDisplay !== "function"
    ) {
      logError("Cannot render score: OpenSheetMusicDisplay is unavailable");
      notify.error("Could not render score: notation library unavailable");
      return false;
    }

    // Guard: we need a mount element to draw into.
    if (!mountEl) {
      logError("Cannot render score: no mount element supplied");
      notify.error("Could not render score: no mount element");
      return false;
    }

    // Clear any previous render from the mount before drawing afresh.
    mountEl.replaceChildren();

    // Drop any prior instance: it stays null unless this render succeeds.
    currentOsmd = null;

    try {
      const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(mountEl, {
        backend: "svg",
        autoResize: true,
        drawTitle: true,
      });
      await osmd.load(xmlText);
      osmd.render();
      // Hold the live instance so the play-along module can drive its cursor.
      currentOsmd = osmd;
      logInfo("Rendered score into #" + (mountEl.id || "mount"));
      return true;
    } catch (err) {
      logError("Score render failed", err);
      notify.error(
        "Could not render score: " + (err && err.message ? err.message : "unknown error")
      );
      return false;
    }
  }

  // Thin, guarded wrappers around the held OSMD cursor. Each returns true when
  // the op ran on a live cursor and false otherwise (no live score, or the op
  // threw); none ever throws, so callers can drive playback without try/catch.
  function cursorShow() {
    if (!currentOsmd || !currentOsmd.cursor) { logWarn("No score cursor to show"); return false; }
    try { currentOsmd.cursor.show(); return true; } catch (e) { logError("cursor.show failed", e); return false; }
  }
  function cursorNext() {
    if (!currentOsmd || !currentOsmd.cursor) { logWarn("No score cursor to step"); return false; }
    try { currentOsmd.cursor.next(); return true; } catch (e) { logError("cursor.next failed", e); return false; }
  }
  function cursorReset() {
    if (!currentOsmd || !currentOsmd.cursor) { logWarn("No score cursor to reset"); return false; }
    try { currentOsmd.cursor.reset(); return true; } catch (e) { logError("cursor.reset failed", e); return false; }
  }
  function cursorHide() {
    if (!currentOsmd || !currentOsmd.cursor) { logWarn("No score cursor to hide"); return false; }
    try { currentOsmd.cursor.hide(); return true; } catch (e) { logError("cursor.hide failed", e); return false; }
  }

  // Self-test: async and self-contained (no fetch). Verifies the public surface,
  // that the OSMD library is loaded, that a known-valid minimal MusicXML renders
  // to an <svg>, and that invalid input is handled gracefully (resolving false).
  // Mounts are appended to <body> so OSMD sees a non-zero layout width. The
  // invalid-input assertion fires notify.error, which announces into #status, so
  // the original status text is captured and restored to leave the page as found.
  async function selfTest() {
    // A known-valid minimal MusicXML document: one whole note, C4, 4/4, G clef.
    const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
    <time><beats>4</beats><beat-type>4</beat-type></time>
    <clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
  </measure></part>
</score-partwise>`;

    // Capture the current status text so the invalid-input assertion's
    // notification does not leave a leftover in the live region.
    const statusEl = document.getElementById("status");
    const priorStatus = statusEl ? statusEl.textContent : "";

    // Temp mounts appended to BODY so they have layout width for OSMD.
    const t1 = document.createElement("div");
    document.body.appendChild(t1);
    const t2 = document.createElement("div");
    document.body.appendChild(t2);

    const results = {
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      hasCursorShow: typeof cursorShow === "function",
      hasCursorNext: typeof cursorNext === "function",
      hasCursorReset: typeof cursorReset === "function",
      hasCursorHide: typeof cursorHide === "function",
      osmdLoaded:
        typeof opensheetmusicdisplay !== "undefined" &&
        typeof opensheetmusicdisplay.OpenSheetMusicDisplay === "function",
      rendersValidXml: (await render(VALID_XML, t1)) === true && !!t1.querySelector("svg"),
      // These run while the valid score is still current (before the invalid
      // render below resets currentOsmd back to null).
      cursorShowAfterRender: cursorShow() === true,
      cursorNextAfterRender: cursorNext() === true,
      cursorResetAfterRender: cursorReset() === true,
      cursorHideAfterRender: cursorHide() === true,
      handlesInvalidXml: (await render("this is not valid musicxml", t2)) === false,
    };

    // Tidy up: remove the temp mounts and restore the original status text.
    t1.remove();
    t2.remove();
    if (statusEl) statusEl.textContent = priorStatus;

    console.table(results);
    return results;
  }

  return { render, cursorShow, cursorNext, cursorReset, cursorHide, selfTest };
})();

window.MusicRenderScore = MusicRenderScore;
