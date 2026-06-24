// music-midi.js
// MIDI export (download) service for the Accessible Music proof of concept.
//
// A stateless service, the near-twin of music-export.js: it owns no DOM
// elements, caches nothing, has no init and no readyState guard. It exposes a
// single render(model, filename, mountEl) method that builds a "Download MIDI"
// button into the given mount element, plus a selfTest(). NOTE the signature
// takes the PARSED MODEL, not raw text — it builds Standard MIDI File bytes from
// the model via MusicMidiBuild.buildMidi and, when the button is clicked,
// downloads them as a .mid file. Like the other renderers it is SYNCHRONOUS,
// returns false on bad input, and NEVER throws. Exposed as window.MusicMidi.

const MusicMidi = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side notifications: route through the shared MusicNotify when
  // present, otherwise fall back to silent no-ops so this file never notifies
  // directly if the notify layer is absent.
  const notify = window.MusicNotify || { info() {}, success() {}, warning() {}, error() {}, show() {} };

  // MIDI byte builder: route through MusicMidiBuild when present, otherwise a
  // no-op that returns empty bytes so this file never throws if the builder is
  // absent (the download would simply be an empty .mid).
  const midi = window.MusicMidiBuild || { buildMidi() { return new Uint8Array(); } };

  // toMidiFilename(name): pure; NEVER throws. Replaces the source filename's last
  // extension with ".mid" ("sample.musicxml" -> "sample.mid", "a.b.xml" ->
  // "a.b.mid"); a name with no extension gets ".mid" appended. An empty string, a
  // non-string, or a name that reduces to empty (e.g. ".xml") returns "music.mid".
  function toMidiFilename(name) {
    if (typeof name !== "string" || !name.length) return "music.mid";
    const lastDot = name.lastIndexOf(".");
    // base = everything before the last dot; the whole name when there is no dot;
    // empty when the name begins with a dot (lastDot === 0).
    const base = lastDot === -1 ? name : name.slice(0, lastDot);
    const trimmed = base.trim();
    if (!trimmed.length) return "music.mid";
    return trimmed + ".mid";
  }

  // Build a Blob of the model's MIDI bytes. PRIVATE and pure: no DOM, no URL, no
  // click — the testable seam. "audio/midi" is the standard MIME type for a .mid
  // file.
  function buildBlob(model) {
    return new Blob([midi.buildMidi(model)], { type: "audio/midi" });
  }

  // Build a "Download MIDI" button into mountEl that downloads the model as a
  // .mid file when clicked. Synchronous; returns true on success and false on a
  // missing mount; NEVER throws. NOTE: takes the parsed model + filename.
  function render(model, filename, mountEl) {
    // Guard: we need a mount element to build into (no notify, matching the
    // other renderers' no-mount guards).
    if (!mountEl) {
      logError("Cannot build MIDI download: no mount element supplied");
      return false;
    }

    // Resolve the .mid download name from the source filename.
    const name = toMidiFilename(filename);

    // Clear any previous render from the mount before building afresh.
    mountEl.replaceChildren();

    // Build the button with createElement only (no innerHTML in our code):
    // a <button> containing an aria-hidden icon span then the visible label.
    // The accessible name is exactly "Download MIDI".
    const button = document.createElement("button");
    button.type = "button";

    const iconSpan = document.createElement("span");
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.setAttribute("data-icon", "download");
    button.appendChild(iconSpan);
    button.appendChild(document.createTextNode(" Download MIDI"));

    // Click handler closes over model and name. Builds a Blob, downloads it via a
    // throwaway anchor, then revokes the object URL synchronously (per plan).
    button.addEventListener("click", function () {
      const blob = buildBlob(model);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // If any browser cancels the download, defer the revoke with
      // setTimeout(() => URL.revokeObjectURL(url), 0) instead of revoking here.
      URL.revokeObjectURL(url);
      notify.success("Downloaded " + name);
      logInfo("Downloaded " + name);
    });

    mountEl.appendChild(button);

    // Inject the SVG icon into the data-icon span. Guarded so this is a safe
    // no-op when the library is absent (music-poc served as its own root 404s the
    // icon); the visible "Download MIDI" text remains the accessible name.
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
      window.IconLibrary.populateIcons(button);
    }

    logInfo("Rendered MIDI download button into #" + (mountEl.id || "mount"));
    return true;
  }

  // Self-test: synchronous and self-contained. Builds into a DETACHED temp <div>
  // (never attached to the page) and NEVER clicks the button, so it fires no real
  // download and never touches #status or notifies — no restore needed.
  // console.table()s and returns the results object.
  function selfTest() {
    const MODEL = {
      workTitle: "Accessible Music PoC sample",
      divisions: 2,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [
            {
              number: "1",
              notes: [
                { rest: false, step: "C", octave: 4, duration: 2, type: "quarter" },
                { rest: false, step: "D", octave: 4, duration: 2, type: "quarter" },
                { rest: false, step: "E", octave: 4, duration: 1, type: "eighth" },
                { rest: false, step: "F", octave: 4, duration: 1, type: "eighth" },
                { rest: false, step: "G", octave: 4, duration: 2, type: "quarter" },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, step: "A", octave: 4, duration: 4, type: "half" },
                { rest: true, step: null, octave: null, duration: 2, type: "quarter" },
                { rest: false, step: "C", octave: 5, duration: 2, type: "quarter" },
              ],
            },
          ],
        },
      ],
    };

    const temp = document.createElement("div");
    const renderReturnsTrue = render(MODEL, "sample.musicxml", temp) === true;
    const buttons = temp.querySelectorAll("button");
    const button = buttons[0] || null;
    const span = button ? button.querySelector('span[data-icon="download"]') : null;
    const bytes = window.MusicMidiBuild ? window.MusicMidiBuild.buildMidi(MODEL) : new Uint8Array();

    const results = {
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      renderReturnsTrue: renderReturnsTrue,
      buildsOneButton: buttons.length === 1,
      buttonTypeButton: !!button && button.type === "button",
      accessibleName: !!button && button.textContent.includes("Download MIDI"),
      noTitle: !!button && !button.hasAttribute("title"),
      hasDownloadIconSpan: !!span && span.getAttribute("aria-hidden") === "true",
      buildsValidMidiBytes:
        bytes instanceof Uint8Array && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64,
      blobConstructs: (function () {
        const b = new Blob([bytes], { type: "audio/midi" });
        return b instanceof Blob && b.size > 0;
      })(),
      filenameFromXml: toMidiFilename("sample.musicxml") === "sample.mid",
      filenameStripsLastExtOnly: toMidiFilename("a.b.xml") === "a.b.mid",
      filenameDefaults: toMidiFilename("") === "music.mid" && toMidiFilename(null) === "music.mid",
      guardNoMount: render(MODEL, "x.musicxml", null) === false,
    };

    temp.remove();
    console.table(results);
    return results;
  }

  return { render, selfTest };
})();

window.MusicMidi = MusicMidi;
