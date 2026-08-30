// music-app.js
// Main controller for the Accessible Music proof of concept.
//
// Stage 0 scope: it wires the file chooser to a FileReader-based loader that
// reads a chosen file as text, records the latest load in module state, and
// reports through the shared logging and notification adapters. No parsing, no
// rendering — those arrive in later stages. Exposed as window.MusicApp.
//
// It consumes every other music-poc global (MusicLog, MusicAnnounce via
// MusicNotify, MusicNotify, MusicConfirm), so it must be the LAST script loaded.

const MusicApp = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Notifications: route through MusicNotify when present, otherwise no-ops so
  // this file never touches the live region or toasts directly.
  const notify = window.MusicNotify || { info() {}, success() {}, warning() {}, error() {}, show() {} };

  // Visual score renderer: route through MusicRenderScore when present, otherwise
  // a no-op render that resolves false so callers never break if the renderer
  // file is absent.
  const renderScore = window.MusicRenderScore || { render() { return Promise.resolve(false); }, selfTest() {} };

  // MusicXML parser: route through MusicParse when present, otherwise a no-op
  // that returns null so callers fall back gracefully if the parser is absent.
  const parser = window.MusicParse || { parse() { return null; } };

  // Text-score renderer: route through MusicRenderText when present, otherwise a
  // no-op render that returns false so callers never break if the file is absent.
  const renderText = window.MusicRenderText || { render() { return false; }, selfTest() {} };

  // Summary renderer: route through MusicRenderSummary when present, otherwise a
  // no-op render that returns false so callers never break if the file is absent.
  const renderSummary = window.MusicRenderSummary || { render() { return false; }, selfTest() {} };

  // Export renderer: route through MusicExport when present, otherwise a no-op
  // render that returns false so callers never break if the file is absent.
  const renderExport = window.MusicExport || { render() { return false; }, selfTest() {} };

  // Audio player: route through MusicAudio when present, otherwise no-ops so this
  // file never touches the Web Audio graph directly if the player is absent.
  const audio = window.MusicAudio || { render() { return false; }, play() {}, stop() {}, onNote() {}, selfTest() {} };

  // MIDI download button: route through MusicMidi when present, otherwise a no-op
  // render that returns false so callers never break if the file is absent.
  const renderMidi = window.MusicMidi || { render() { return false; }, selfTest() {} };

  // Transpose: route through MusicTranspose when present, otherwise no-ops so this
  // file never breaks if the transposer is absent (transposeXml returns null,
  // which the handler treats as "re-render the original source").
  const transpose = window.MusicTranspose || { transposeXml() { return null; }, render() { return false; } };

  // Play-along: route through MusicPlayAlong when present, otherwise no-ops so
  // this file never breaks if the play-along glue is absent.
  const playAlong = window.MusicPlayAlong || { register() {}, reset() {} };

  // PDF orchestrator: route through MusicPdf when present, otherwise no-ops so this
  // file never breaks if the PDF pipeline is absent. generate resolves null, which
  // handlePdf treats as a failure. MusicPdf attaches to globalThis, which IS window
  // in the browser, so window.MusicPdf resolves.
  const pdf = window.MusicPdf || { generate() { return Promise.resolve(null); }, selfTest() {} };

  // .mxl extractor: route through MusicMxl when present, otherwise a no-op whose
  // extractXml resolves null so the loader degrades gracefully (an .mxl simply
  // fails to open rather than breaking) if the extractor file is absent.
  const mxl = window.MusicMxl || { extractXml() { return Promise.resolve(null); }, selfTest() {} };

  // Excerpt slicer and raster: route through MusicExcerpt and MusicRaster when
  // present, otherwise no-ops returning null so an absent module degrades to a
  // clean "could not" status rather than a thrown error. MusicExcerpt attaches to
  // globalThis and MusicRaster to window; both resolve off window in the browser.
  const excerpt = window.MusicExcerpt || { sliceXml() { return null; }, selfTest() {} };
  const raster = window.MusicRaster || {
    renderExcerptSvg() { return Promise.resolve(null); },
    rasteriseSvg() { return Promise.reject(new Error("MusicRaster absent")); },
    // The two refusal codes are part of the surface, not internal detail: the
    // capture handler branches on them to choose which sentence the user reads.
    // The stub carries them so an absent module degrades to "could not" rather
    // than to an undefined comparison that happens to be false.
    CANVAS_LIMIT_CODE: "CANVAS_LIMIT",
    CROP_EMPTY_CODE: "CROP_EMPTY",
    selfTest() {},
  };

  // Span descriptions: spanSummary gives the short prose for the image's alt, and
  // spanModelOf gives a sub-model the note-list outline builder can walk. Both
  // no-op to null so a missing module costs the descriptions, never the image.
  const describeSpan = window.MusicDescribeSpan || { spanSummary() { return null; }, spanModelOf() { return null; } };

  const els = {};
  const state = { filename: null, text: null, offset: { octaves: 0, steps: 0, semitones: 0 } };

  function cacheElements() {
    els.fileInput = document.getElementById("musicFile");
    els.scoreMount = document.getElementById("scoreMount");
    els.noteListMount = document.getElementById("noteListMount");
    els.summaryMount = document.getElementById("summaryMount");
    els.exportMount = document.getElementById("exportMount");
    els.audioMount = document.getElementById("audioMount");
    els.midiMount = document.getElementById("midiMount");
    els.transposeMount = document.getElementById("transposeMount");
    els.pdfButton = document.getElementById("pdfButton");
    els.pdfLargePrintButton = document.getElementById("pdfLargePrintButton");
    els.pdfStatus = document.getElementById("pdfStatus");
    els.captureFrom = document.getElementById("captureFrom");
    els.captureTo = document.getElementById("captureTo");
    els.captureButton = document.getElementById("captureButton");
    els.captureStatus = document.getElementById("captureStatus");
    els.captureResults = document.getElementById("captureResults");
    // Stage 88: the crop trims and the re-crop button. Cached with the rest of
    // the capture section because they are static HTML on the same shell.
    els.cropTop = document.getElementById("cropTop");
    els.cropBottom = document.getElementById("cropBottom");
    els.cropLeft = document.getElementById("cropLeft");
    els.cropRight = document.getElementById("cropRight");
    els.recropButton = document.getElementById("recropButton");
    // Stage 91: the large-print settings fieldset (the one change listener's host)
    // and its reset button. The RADIOS are deliberately NOT cached — every read of
    // them queries the document, so the value is read at generate time.
    els.largePrintSettings = document.getElementById("largePrintSettings");
    els.largePrintResetButton = document.getElementById("largePrintResetButton");
  }

  // Read a chosen file into MusicXML text. Plain .xml/.musicxml read as text. A
  // compressed .mxl reads as an ArrayBuffer and is unzipped to its inner
  // MusicXML via MusicMxl. Returns a Promise that ALWAYS resolves: the payload
  // on success, or null on a read or extraction failure. It never rejects.
  function loadFile(file) {
    const isMxl = /\.mxl$/i.test(file.name);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = function () {
        logError("Could not read file: " + file.name, reader.error);
        notify.error("Could not read " + file.name);
        resolve(null);
      };
      reader.onload = async function () {
        let text;
        if (isMxl) {
          text = await mxl.extractXml(reader.result); // ArrayBuffer in, XML string or null out
          if (text === null) {
            logError("Could not extract MusicXML from " + file.name);
            notify.error("Could not read " + file.name + " (not a valid .mxl file)");
            resolve(null);
            return;
          }
        } else {
          text = String(reader.result || "");
        }
        state.filename = file.name;
        state.text = text;
        state.offset = { octaves: 0, steps: 0, semitones: 0 }; // each new file starts at the original pitch
        logInfo("Loaded " + file.name + " (" + text.length + " characters)");
        notify.info("Loaded " + file.name + " (" + text.length + " characters)");
        resolve({ filename: file.name, text: text });
      };
      if (isMxl) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });
  }

  // Ensure a work-title is present in the copy of the MusicXML we hand to OSMD. This
  // injects the derived title only into the OSMD copy, so the on-screen heading stops
  // reading "Untitled Score"; the author's notation is not rewritten, and the export,
  // PDF, and state copies keep the original bytes. Pure: returns the input unchanged
  // on any problem (parse error, missing root, a title already present, or any thrown
  // error), so a titled file passes through byte-for-byte with no reserialisation.
  function withWorkTitle(xmlText, title) {
    try {
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      // A malformed document surfaces a parsererror element; leave it to OSMD to complain.
      if (doc.getElementsByTagName("parsererror").length) return xmlText;
      const root = doc.querySelector("score-partwise");
      if (!root) return xmlText;
      // A non-empty work-title already satisfies the heading: pass through untouched
      // so titled files are never reserialised.
      const existingTitle = root.querySelector("work-title");
      if (existingTitle && existingTitle.textContent && existingTitle.textContent.trim()) return xmlText;
      // Otherwise ensure a work element (as the first element child) and its work-title,
      // then set the derived title and serialise the amended copy.
      let work = root.querySelector("work");
      if (!work) {
        work = doc.createElement("work");
        root.insertBefore(work, root.firstElementChild);
      }
      let workTitle = work.querySelector("work-title");
      if (!workTitle) {
        workTitle = doc.createElement("work-title");
        work.appendChild(workTitle);
      }
      workTitle.textContent = title;
      return new XMLSerializer().serializeToString(doc);
    } catch (e) {
      return xmlText;
    }
  }

  // Render every output from one uploaded source. The visual score is handed the raw MusicXML (OSMD
  // parses it itself); every other output is driven by our own parsed model, parsed once here and shared.
  function renderOutputs(xmlText, filename) {
    // Stop any audio still playing from a previous upload before rendering afresh.
    audio.stop();
    // Clear the play-along cursor and note highlight before rendering the new/transposed score.
    playAlong.reset();

    // Parse our own model first so the derived work-title is available to inject into
    // the OSMD-bound copy below. Every other output still reads the original xmlText.
    const model = parser.parse(xmlText);

    if (els.scoreMount) {
      // Hand OSMD a copy carrying the derived title so its heading stops reading
      // "Untitled Score". Only the OSMD argument changes; export, PDF, state, and every
      // model-bound render keep the original bytes.
      const osmdXml = (model && model.workTitle) ? withWorkTitle(xmlText, model.workTitle) : xmlText;
      renderScore.render(osmdXml, els.scoreMount);
    } else logWarn("Score mount #scoreMount not found; skipping the visual score");

    if (els.exportMount) renderExport.render(xmlText, filename, els.exportMount);
    else logWarn("Export mount #exportMount not found; skipping the download button");

    if (!model) {
      logWarn("Could not parse the MusicXML; skipping the note list and summary");
      notify.error("Could not read the score structure");
      return;
    }
    // Stash the current render context so the static PDF button can read it at
    // click time. Because handleTranspose routes its transposed xml back through
    // renderOutputs, this is what makes the PDF follow a transpose.
    state.currentXml = xmlText;
    state.currentModel = model;

    if (els.noteListMount) renderText.render(model, els.noteListMount);
    else logWarn("Note list mount #noteListMount not found; skipping the note list");

    if (els.summaryMount) renderSummary.render(model, els.summaryMount);
    else logWarn("Summary mount #summaryMount not found; skipping the summary");

    if (els.audioMount) audio.render(model, els.audioMount);
    else logWarn("Audio mount #audioMount not found; skipping audio playback");

    // Stop should also clear the play-along highlight. The Stop button is rebuilt
    // on every render, so this fresh listener lands on the new button and never stacks.
    if (els.audioMount) {
      const stopButton = Array.from(els.audioMount.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Stop");
      if (stopButton) stopButton.addEventListener("click", function () { playAlong.reset(); });
    }

    if (els.midiMount) renderMidi.render(model, filename, els.midiMount);
    else logWarn("MIDI mount #midiMount not found; skipping the MIDI download");
  }

  // Change handler on the file input. Fire-and-forget: the UI path does not
  // await the load; observers use getLoaded() or the notification.
  function handleFileSelect(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) {
      logDebug("File selection cleared");
      return;
    }
    // Read, then hand the text to the output dispatch. Non-blocking: the handler
    // returns immediately; the visual score appears when OSMD resolves.
    loadFile(file).then(function (loaded) {
      if (!loaded) return; // read failed; loadFile already reported it
      renderOutputs(loaded.text, loaded.filename);
    });
  }

  // Spell small counts as words ("one octave"); fall back to digits beyond nine.
  function numberWord(n) {
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    return n >= 0 && n <= 9 ? words[n] : String(n);
  }

  // Describe the CUMULATIVE offset, so consecutive clicks announce distinct states
  // (which also avoids the notify 2-second duplicate suppression swallowing a repeat).
  function describeOffset(offset) {
    if (!offset.octaves && !offset.steps && !offset.semitones) return "Transposition reset to the original pitch.";
    const part = (n, unit) => {
      const mag = Math.abs(n);
      return (n > 0 ? "up " : "down ") + numberWord(mag) + " " + unit + (mag === 1 ? "" : "s");
    };
    const bits = [];
    if (offset.octaves) bits.push(part(offset.octaves, "octave"));
    if (offset.steps) bits.push(part(offset.steps, "step"));
    if (offset.semitones) bits.push(part(offset.semitones, "semitone"));
    // A semitone shift spells the result sharp-preferring (a black key reads as a
    // sharp, never a flat); stating it keeps the simplification audible.
    const spelling = offset.semitones ? " Accidentals are spelt with sharps." : "";
    return "Transposed " + bits.join(" and ") + "." + spelling;
  }

  // A transpose control click: fold the delta into the running offset, transpose
  // the ORIGINAL loaded text by the cumulative offset, re-render every output, and
  // announce the new transposition into #status.
  function handleTranspose(delta) {
    if (!state.text) { logDebug("Transpose ignored: no file loaded"); return; }
    state.offset = {
      octaves: state.offset.octaves + (delta && delta.octaves ? delta.octaves : 0),
      steps: state.offset.steps + (delta && delta.steps ? delta.steps : 0),
      semitones: state.offset.semitones + (delta && delta.semitones ? delta.semitones : 0),
    };
    const transposed = transpose.transposeXml(state.text, state.offset);
    if (!transposed) {
      logWarn("Transpose failed; re-rendering the original source");
      renderOutputs(state.text, state.filename);
    } else {
      renderOutputs(transposed, state.filename);
    }
    notify.info(describeOffset(state.offset)); // announce the new transposition into #status
  }

  // The most recently loaded file, or null if nothing has been loaded yet.
  function getLoaded() {
    return state.filename ? { filename: state.filename, text: state.text } : null;
  }

  // Derive a .pdf download name from the loaded filename: swap a trailing
  // .musicxml/.xml/.mxl extension for .pdf, falling back to "score.pdf". The
  // large-print profile suffixes the stem with -large-print so the two downloads
  // never overwrite each other.
  function pdfFilename(filename, profile) {
    const stem =
      typeof filename === "string" && filename.length
        ? filename.replace(/\.(musicxml|xml|mxl)$/i, "")
        : "score";
    const suffix = profile === LARGE_PRINT_PROFILE ? "-large-print" : "";
    return stem + suffix + ".pdf";
  }

  // The PDF image-description level radio group in the static HTML. The name is
  // the group's identity; the fallback is what an absent group or a fully
  // unchecked one yields, and it matches the radio marked checked in the markup
  // so the two cannot disagree.
  const ALT_TEXT_LEVEL_NAME = "pdfAltTextLevel";
  const ALT_TEXT_LEVEL_FALLBACK = "pages";

  // readAltTextLevel() -> the checked radio's value, or the fallback when the
  // group is missing or nothing is checked. Deliberately queries the document on
  // every call rather than caching an element at init, so the value is read at
  // GENERATE time and a change made after load is honoured with no change
  // listener. Private; selfTest calls it directly, which is how the read-at-
  // generate-time behaviour is proved without compiling a PDF.
  function readAltTextLevel() {
    const checked = document.querySelector(
      'input[name="' + ALT_TEXT_LEVEL_NAME + '"]:checked'
    );
    return checked ? checked.value : ALT_TEXT_LEVEL_FALLBACK;
  }

  // ---------------------------------------------------------------------------
  // Large-print settings (Stage 91)
  // ---------------------------------------------------------------------------

  // The ONE profile these settings reach. Stage 90's profileOverridesFrom refuses
  // an override aimed at any other, so this constant is the FIRST of two guards
  // rather than the only one: keeping the standard path passing exactly what it
  // passed before leaves that refusal warn a signal about a mistaken caller
  // instead of a line on every routine standard compile.
  const LARGE_PRINT_PROFILE = "large-print";

  // The three radio groups' names. The group is its name, exactly as the
  // image-description group above.
  const LARGE_PRINT_STAFF_NAME = "largePrintStaff";
  const LARGE_PRINT_THICKNESS_NAME = "largePrintThickness";
  const LARGE_PRINT_BARS_NAME = "largePrintBars";

  // The shipped defaults. These MUST match the radios marked checked in
  // index.html, and a selfTest row asserts exactly that, so the fallback and the
  // markup cannot disagree — the discipline ALT_TEXT_LEVEL_FALLBACK already
  // follows. They are also the values that make the default document
  // byte-identical to the pre-Stage-91 one: see
  // largePrintOverrides' note on the shipped geometry.
  const LARGE_PRINT_DEFAULTS = Object.freeze({
    staff: "current",
    thickness: "thin",
    barsPerSystem: 2,
  });

  // STAFF SIZES — the four candidates Stage 89 measured, keyed by the NAME that
  // is stored and rendered, mapped here and nowhere else. The millimetre figures
  // are of the PRINTED staff (160.0 mm of Typst content width), not of Verovio's
  // nominal page: 80 x unit / pageWidth x 160.0.
  //
  // `unit` is deliberately ABSENT from every entry. Stage 89 measured all four
  // sizes at unit 12, which is Verovio's cap, so pageWidth is the only lever and
  // the profile's own unit travels untouched.
  //
  // "current" is the Stage 89 table's own name for the shipped 1200 x 1700, kept
  // verbatim so the code and the record cannot drift apart. It denotes THAT
  // geometry, pinned on the line below — not "whatever ships today" — so a future
  // stage that moves the shipped default has to edit this mapping deliberately.
  const LARGE_PRINT_STAFF_SIZES = Object.freeze({
    small: Object.freeze({ pageWidth: 2200, pageHeight: 3117 }), // 6.98 mm
    medium: Object.freeze({ pageWidth: 1540, pageHeight: 2182 }), // 9.97 mm
    current: Object.freeze({ pageWidth: 1200, pageHeight: 1700 }), // 12.80 mm, shipped
    large: Object.freeze({ pageWidth: 1100, pageHeight: 1558 }), // 13.96 mm
  });

  // LINE WEIGHTS — the three levels Stage 89 rendered and confirmed by screenshot,
  // at SVG stroke widths 18/36/24, 26/52/36 and 36/72/48. "thin" is Verovio 6.2.0's
  // own defaults and therefore identical to today's output, which is what makes the
  // default selection byte-identical rather than merely equivalent.
  //
  // ONLY DRAWN LINES RESPOND. Noteheads, clefs, rests and accidentals are SMuFL
  // glyphs from Leipzig and keep their weight at every level, so the labels in
  // index.html say "line weight" and not "thicker notation" — the wider claim
  // would need a different font, not a different option.
  const LARGE_PRINT_LINE_WEIGHTS = Object.freeze({
    thin: Object.freeze({ staffLineWidth: 0.15, barLineWidth: 0.3, stemWidth: 0.2 }),
    medium: Object.freeze({ staffLineWidth: 0.22, barLineWidth: 0.44, stemWidth: 0.3 }),
    thick: Object.freeze({ staffLineWidth: 0.3, barLineWidth: 0.6, stemWidth: 0.4 }),
  });

  // Bars per system: the inclusive integer range the control offers, and the range
  // Stage 89 measured across all four staff sizes.
  const BARS_PER_SYSTEM_MIN = 1;
  const BARS_PER_SYSTEM_MAX = 4;

  // The localStorage key and the shape's version. NAMESPACED because this origin
  // is shared with tools.html, which seeds API keys on any localhost load, so an
  // unqualified key is a correctness problem rather than untidiness. The version
  // lets a future shape change be REFUSED rather than half-read: a record whose v
  // is not this one is treated as absent and the defaults apply.
  const LARGE_PRINT_STORE_KEY = "music-poc-large-print";
  const LARGE_PRINT_STORE_VERSION = 1;

  // validStaffName / validThicknessName / validBarsPerSystem — VALUE validation,
  // which closes the board item Stage 90 opened and deliberately left open. Stage
  // 90's filter validates override KEYS only, and one value degrades silently:
  // barsPerSystem 0 makes (n - 1) % systemEvery evaluate to NaN, which never
  // equals 0, so NO system break is injected and the score paginates as though the
  // profile were absent — a plausible document from a nonsense input, reported
  // nowhere. A negative and a non-numeric value degrade the same way.
  //
  // Each returns the shipped default for its key, with a warn naming what it saw.
  // The warn matters as much as the fallback: a control that silently did nothing
  // would look exactly like a control that worked.
  //
  // They are PURE, so selfTest drives them without a DOM and without compiling a
  // PDF, and they validate whatever reaches them — a radio's value, a stored
  // record, or a future programmatic caller — rather than trusting the source.
  function validStaffName(name) {
    if (LARGE_PRINT_STAFF_SIZES[name]) return name;
    logWarn(
      "Unknown large-print staff size '" + name + "'; using '" + LARGE_PRINT_DEFAULTS.staff + "'"
    );
    return LARGE_PRINT_DEFAULTS.staff;
  }

  function validThicknessName(name) {
    if (LARGE_PRINT_LINE_WEIGHTS[name]) return name;
    logWarn(
      "Unknown large-print line weight '" + name + "'; using '" + LARGE_PRINT_DEFAULTS.thickness + "'"
    );
    return LARGE_PRINT_DEFAULTS.thickness;
  }

  // A radio's value is a STRING, so the number is coerced here rather than at each
  // call site; Number("") is 0 and Number("3") is 3, and both then meet the same
  // integer-and-range test. Number.isInteger rejects 2.5 and NaN together.
  function validBarsPerSystem(value) {
    const n = Number(value);
    if (Number.isInteger(n) && n >= BARS_PER_SYSTEM_MIN && n <= BARS_PER_SYSTEM_MAX) return n;
    logWarn(
      "Large-print bars per system must be a whole number from " + BARS_PER_SYSTEM_MIN +
        " to " + BARS_PER_SYSTEM_MAX + "; saw '" + value + "', using " +
        LARGE_PRINT_DEFAULTS.barsPerSystem
    );
    return LARGE_PRINT_DEFAULTS.barsPerSystem;
  }

  // validLargePrintNames(names) → a fresh, fully validated { staff, thickness,
  // barsPerSystem }. PURE. Every path into the settings goes through this — the
  // DOM read, the stored record and the reset — so no unvalidated name can reach
  // the mapping below or the controls.
  function validLargePrintNames(names) {
    const n = names || {};
    return {
      staff: validStaffName(n.staff),
      thickness: validThicknessName(n.thickness),
      barsPerSystem: validBarsPerSystem(n.barsPerSystem),
    };
  }

  // largePrintOverrides(names) → { names, engraving, pagination }: the validated
  // names, and the two override objects Stage 90's seam takes. PURE — no DOM, no
  // toolkit — so selfTest drives the whole mapping directly.
  //
  // NAMES BECOME NUMBERS HERE AND NOWHERE ELSE. That is the point of storing
  // names: nothing downstream, and nothing on disk, ever holds a page width.
  //
  // The DEFAULT names map to exactly the values ENGRAVING_PROFILES["large-print"]
  // and PAGINATION_PROFILES["large-print"] already carry — 1200 x 1700, 0.15 /
  // 0.3 / 0.2, and 2 — so the default selection sends a third merge term whose
  // every value equals the second's, and the merged object is byte-identical to
  // the one the code built before this stage. The override path therefore RUNS on
  // the default rather than being bypassed, which is the stronger proof of the
  // two. A selfTest row pins those six numbers.
  function largePrintOverrides(names) {
    const valid = validLargePrintNames(names);
    const size = LARGE_PRINT_STAFF_SIZES[valid.staff];
    const weight = LARGE_PRINT_LINE_WEIGHTS[valid.thickness];
    return {
      names: valid,
      engraving: {
        pageWidth: size.pageWidth,
        pageHeight: size.pageHeight,
        staffLineWidth: weight.staffLineWidth,
        barLineWidth: weight.barLineWidth,
        stemWidth: weight.stemWidth,
      },
      pagination: { barsPerSystem: valid.barsPerSystem },
    };
  }

  // checkedValue(name, fallback) → the checked radio's value for a group, or the
  // fallback when the group is missing or nothing is checked. The readAltTextLevel
  // read, generalised over the three groups.
  function checkedValue(name, fallback) {
    const checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : fallback;
  }

  // readLargePrintSettings() → largePrintOverrides of whatever the three groups
  // currently show. Queries the document on EVERY call rather than caching at
  // init, so the value is read at GENERATE time and a change made after load is
  // honoured with no change listener on this path — the readAltTextLevel rule.
  // The stored copy is a convenience for the next visit; the DOM is the truth.
  function readLargePrintSettings() {
    return largePrintOverrides({
      staff: checkedValue(LARGE_PRINT_STAFF_NAME, LARGE_PRINT_DEFAULTS.staff),
      thickness: checkedValue(LARGE_PRINT_THICKNESS_NAME, LARGE_PRINT_DEFAULTS.thickness),
      barsPerSystem: checkedValue(LARGE_PRINT_BARS_NAME, LARGE_PRINT_DEFAULTS.barsPerSystem),
    });
  }

  // applyLargePrintSettings(names) → check the radio matching each validated name.
  // Setting .checked programmatically does NOT fire a change event, so this can
  // never loop back into the change listener that writes storage; the reset path
  // removes the key explicitly instead.
  function applyLargePrintSettings(names) {
    const valid = validLargePrintNames(names);
    const set = function (group, value) {
      const radio = document.querySelector(
        'input[name="' + group + '"][value="' + value + '"]'
      );
      if (radio) radio.checked = true;
      return !!radio;
    };
    set(LARGE_PRINT_STAFF_NAME, valid.staff);
    set(LARGE_PRINT_THICKNESS_NAME, valid.thickness);
    set(LARGE_PRINT_BARS_NAME, String(valid.barsPerSystem));
    return valid;
  }

  // readStoredLargePrint() → the stored names, or null when there is nothing
  // usable. Every failure — no storage at all (a locked-down profile or private
  // mode throws on access, it does not return null), no record, unparseable JSON,
  // a shape from another version — resolves to null so the caller applies the
  // shipped defaults. It NEVER throws out, because a bad stored record must not
  // be able to stop the page initialising.
  function readStoredLargePrint() {
    try {
      const raw = window.localStorage.getItem(LARGE_PRINT_STORE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== LARGE_PRINT_STORE_VERSION) {
        logWarn(
          "Ignoring a large-print settings record of version '" +
            (parsed && parsed.v) + "'; this build reads version " + LARGE_PRINT_STORE_VERSION
        );
        return null;
      }
      return {
        staff: parsed.staff,
        thickness: parsed.thickness,
        barsPerSystem: parsed.barsPerSystem,
      };
    } catch (e) {
      logWarn("Could not read the stored large-print settings; using the defaults", e);
      return null;
    }
  }

  // writeStoredLargePrint(names) → true when the record was written. Names only,
  // in the documented key order, validated first so a bad value cannot be stored
  // and read back as if it had been chosen.
  function writeStoredLargePrint(names) {
    const valid = validLargePrintNames(names);
    try {
      window.localStorage.setItem(
        LARGE_PRINT_STORE_KEY,
        JSON.stringify({
          v: LARGE_PRINT_STORE_VERSION,
          staff: valid.staff,
          thickness: valid.thickness,
          barsPerSystem: valid.barsPerSystem,
        })
      );
      return true;
    } catch (e) {
      logWarn("Could not save the large-print settings", e);
      return false;
    }
  }

  // clearStoredLargePrint() → true when the key is gone afterwards. Removes THIS
  // key by name and nothing else: the origin is shared with tools.html, so a
  // pattern-based clear would take credentials and unrelated sessions with it.
  function clearStoredLargePrint() {
    try {
      window.localStorage.removeItem(LARGE_PRINT_STORE_KEY);
      return true;
    } catch (e) {
      logWarn("Could not clear the stored large-print settings", e);
      return false;
    }
  }

  // A change anywhere in the settings fieldset: persist what is now showing. One
  // listener on the fieldset rather than three per-group ones, because change
  // bubbles and the three groups have no reason to be handled differently.
  function handleLargePrintChange() {
    const settings = readLargePrintSettings();
    writeStoredLargePrint(settings.names);
    logDebug(
      "Large-print settings saved: staff " + settings.names.staff +
        ", line weight " + settings.names.thickness +
        ", " + settings.names.barsPerSystem + " bars per system"
    );
  }

  // The reset button: put the shipped defaults back on the controls, forget the
  // stored record, and say so. Focus is RESTORED to the button only if it had it,
  // the Stage 88 pattern — nothing here moves focus, so this is the guarantee
  // rather than the repair, and it keeps a programmatic call (selfTest) from
  // stealing focus from wherever the user actually is.
  function handleLargePrintReset() {
    const hadFocus = document.activeElement === els.largePrintResetButton;
    applyLargePrintSettings(LARGE_PRINT_DEFAULTS);
    clearStoredLargePrint();
    const msg = "Large-print settings reset to the defaults.";
    if (els.pdfStatus) els.pdfStatus.textContent = msg;
    notify.success(msg);
    logInfo(msg);
    if (hadFocus && els.largePrintResetButton) els.largePrintResetButton.focus();
  }

  // pdfOptionsFor(profile, altTextLevel, settings) → the options object handed to
  // MusicPdf.generate. PURE, so selfTest can prove at BOTH profiles what travels,
  // without compiling a PDF. The engraving and pagination keys are ABSENT from a
  // standard call — not empty, absent — so the standard path passes exactly the
  // object it passed before this stage.
  function pdfOptionsFor(profile, altTextLevel, settings) {
    const opts = { altTextLevel: altTextLevel };
    if (profile === LARGE_PRINT_PROFILE && settings) {
      opts.engraving = settings.engraving;
      opts.pagination = settings.pagination;
    }
    return opts;
  }

  // A PDF button click: generate a tagged PDF of the CURRENT render context (so it
  // follows a transpose) under the given engraving profile and download it. The
  // label words the user-facing messages so both buttons read naturally. Private,
  // async, and never throws out: every failure path logs, sets pdfStatus and
  // notifies. Both PDF buttons are disabled for the whole compile and re-enabled
  // together, so a large-print compile cannot leave the standard button stuck and
  // vice versa.
  async function handlePdf(profile, label) {
    // Sentence-case the label for the start-of-sentence success message.
    const Label = label.charAt(0).toUpperCase() + label.slice(1);

    // Guard: nothing loaded yet. Report and bail without throwing.
    if (!state.currentModel || !state.currentXml) {
      const msg = "Load a score before downloading the " + label + " PDF.";
      if (els.pdfStatus) els.pdfStatus.textContent = msg;
      notify.warning(msg);
      return;
    }

    if (els.pdfStatus) els.pdfStatus.textContent = "Generating the " + label + " PDF. This can take a few seconds.";
    // Block a second concurrent compile from either button.
    if (els.pdfButton) els.pdfButton.disabled = true;
    if (els.pdfLargePrintButton) els.pdfLargePrintButton.disabled = true;

    try {
      // Read the level HERE, at generate time, so the radio the user has left
      // checked is the one that travels. Since Stage 82 MusicPdf.generate takes
      // an options object as its fourth argument and READS the level. All three
      // levels are now real: "pages" gives every page image the terse positional
      // alt; "summary" additionally puts the whole-piece summary on page 1's
      // figure alt; "talking-score" gives every page an alt describing its own
      // bars (Stage 83) and appends the whole note list to the document as tagged
      // headings and nested lists (Stage 84). Nothing here decides that — the
      // level travels as it is read, and the orchestrator owns what each one
      // means.
      const altTextLevel = readAltTextLevel();
      logDebug("PDF image-description level: " + altTextLevel);
      // The large-print settings are read HERE too, at generate time and off the
      // DOM, for the same reason: the radios the user has left checked are the
      // ones that travel. They reach the large-print profile ONLY — see
      // pdfOptionsFor and LARGE_PRINT_PROFILE — so the standard button passes
      // exactly the object it passed before Stage 91.
      const largePrint = profile === LARGE_PRINT_PROFILE ? readLargePrintSettings() : null;
      if (largePrint) {
        logDebug(
          "Large-print settings: staff " + largePrint.names.staff +
            ", line weight " + largePrint.names.thickness +
            ", " + largePrint.names.barsPerSystem + " bars per system"
        );
      }
      const bytes = await pdf.generate(
        state.currentModel, state.currentXml, profile,
        pdfOptionsFor(profile, altTextLevel, largePrint)
      );
      // A null or empty result is a failure, not a download.
      if (!bytes || !bytes.length) {
        logError("PDF generation returned no bytes");
        if (els.pdfStatus) els.pdfStatus.textContent = "The " + label + " PDF could not be generated.";
        notify.error("The " + label + " PDF could not be generated.");
        return;
      }

      // Download by mirroring music-export.js exactly: a Blob, a throwaway anchor,
      // click, remove, then revoke the object URL synchronously.
      const name = pdfFilename(state.filename, profile);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (els.pdfStatus) els.pdfStatus.textContent = Label + " PDF downloaded.";
      notify.success(Label + " PDF downloaded.");
      logInfo("Downloaded " + name + " (" + bytes.length + " bytes)");
    } catch (e) {
      logError("PDF generation failed", e);
      if (els.pdfStatus) els.pdfStatus.textContent = "The " + label + " PDF could not be generated.";
      notify.error("The " + label + " PDF could not be generated.");
    } finally {
      // Re-enable BOTH buttons so neither is left stranded by the other's compile.
      if (els.pdfButton) els.pdfButton.disabled = false;
      if (els.pdfLargePrintButton) els.pdfLargePrintButton.disabled = false;
    }
  }

  // Thin per-button handlers so each binds a no-arg click listener: the standard
  // button renders the "standard" profile (a "tagged" PDF), the large-print
  // button the "large-print" profile.
  // ---------------------------------------------------------------------------
  // Capture a bar range as an image (Stage 87)
  // ---------------------------------------------------------------------------

  // Bar numbers are STRINGS matched exactly against the model's own `number`
  // attribute, never parsed as integers — the music-excerpt rule, and the reason
  // the two inputs are type="text". barIndexOf returns the position of a printed
  // bar number on a part, or -1. It searches the part with the MOST measures
  // rather than part 0, because a part can be shorter than the score (an
  // instrument that stops early) and would then report a real bar as missing.
  function barIndexOf(model, number) {
    if (!model || !Array.isArray(model.parts) || !model.parts.length) return -1;
    let longest = model.parts[0];
    for (const p of model.parts) {
      if (p && Array.isArray(p.measures) && p.measures.length > (longest.measures || []).length) longest = p;
    }
    const measures = (longest && longest.measures) || [];
    for (let i = 0; i < measures.length; i++) {
      if (measures[i] && String(measures[i].number) === number) return i;
    }
    return -1;
  }

  // Render an outline (the shape MusicRenderText.outlineOf returns) as indented
  // plain text for the long-description textarea. Two spaces per level, so it
  // reads as an outline in a monospace box and pastes into anything. A bar can
  // carry EITHER grouped items (by staff and voice) OR a flat item list —
  // measured on the real outline, where both keys exist on every bar — so both
  // are handled rather than assuming the grouped shape.
  const OUTLINE_INDENT = "  ";
  function outlineToText(outline) {
    if (!outline || !Array.isArray(outline.blocks)) return "";
    const lines = [];
    const push = (depth, text) => lines.push(OUTLINE_INDENT.repeat(depth) + text);
    for (const block of outline.blocks) {
      if (block.heading) push(0, block.heading);
      for (const bar of block.bars || []) {
        if (bar.label) push(1, bar.label);
        for (const group of bar.groups || []) {
          if (group.heading) push(2, group.heading);
          for (const item of group.items || []) push(3, item.text);
        }
        // A bar with no groups carries its items directly.
        if (!(bar.groups || []).length) for (const item of bar.items || []) push(2, item.text);
      }
    }
    return lines.join("\n");
  }

  // Build the results region. The ONLY dynamic markup in this section: an image,
  // a download link and two labelled readonly textareas. Ids are needed because
  // each textarea needs a label, so they are generated once per capture and the
  // region is rebuilt wholesale rather than patched.
  function renderCaptureResults(pngUrl, filename, dims, altText, longText) {
    const region = els.captureResults;
    if (!region) return false;
    region.innerHTML = "";

    // The preview. Its alt IS the span summary, so a screen reader meets the same
    // sentence a sighted reader sees below — the image is not decorative and must
    // never carry an empty alt here.
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = pngUrl;
    img.alt = altText;
    img.style.maxWidth = "100%";
    figure.appendChild(img);
    const caption = document.createElement("figcaption");
    caption.textContent = dims.w + " by " + dims.h + " pixels.";
    figure.appendChild(caption);
    region.appendChild(figure);

    // The download, by the same throwaway-anchor pattern music-export.js uses —
    // except this one is a PERSISTENT link the user clicks, so the object URL is
    // not revoked here. It is revoked when the next capture replaces it.
    const dl = document.createElement("p");
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = filename;
    anchor.id = "captureDownload";
    anchor.innerHTML = getIconMarkup("download") + " Download this image";
    dl.appendChild(anchor);
    region.appendChild(dl);

    // The two descriptions, each a labelled readonly textarea so the text can be
    // read, selected and copied. readonly rather than disabled, because a
    // disabled control is skipped by keyboard navigation and could not be read.
    region.appendChild(buildDescriptionField("captureAltText", "Image description (alt text)", altText, 3));
    region.appendChild(
      buildDescriptionField("captureLongText", "Long description of these bars", longText, 12)
    );
    return true;
  }

  // One labelled readonly textarea. A real <label for> rather than aria-label, so
  // the name is visible to everyone and not only to assistive technology.
  function buildDescriptionField(id, labelText, value, rows) {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;
    const area = document.createElement("textarea");
    area.id = id;
    area.readOnly = true;
    area.rows = rows;
    area.value = value;
    area.style.width = "100%";
    wrap.appendChild(label);
    wrap.appendChild(area);
    return wrap;
  }

  // Icon markup for dynamically-inserted content. The inline getIcon pattern is
  // used rather than a data-icon span plus a refresh call, because the auto
  // populator only runs at DOMContentLoaded and this markup arrives later.
  function getIconMarkup(name) {
    return typeof window.getIcon === "function" ? window.getIcon(name) : "";
  }

  // The object URL of the current preview, held so it can be revoked when the
  // next capture replaces it. Revoking at render time would break the download
  // link and the preview both.
  let capturePngUrl = null;

  // --- Stage 88: the crop --------------------------------------------------

  // The LAST RENDERED EXCERPT, held between captures so a re-crop costs one
  // rasterise rather than the whole chain. Slicing and engraving are the
  // expensive halves and neither depends on the trims: the SVG for bars 9 to 16
  // is the same drawing whatever is cut off its edges. So a re-crop re-rasterises
  // THIS svg and never re-slices or re-renders.
  //
  // fullDims is the UNTRIMMED output size in pixels. It is not read from the PNG,
  // because the PNG on disk may itself be cropped; it is the measured dimensions
  // of the file plus the trims that produced it, which is exact integer
  // arithmetic rather than an estimate off the SVG's own units.
  //
  // altText and longText are held UNCHANGED across a re-crop and are deliberately
  // not recomputed: they describe the BARS, not the pixels, so cutting whitespace
  // off an edge cannot alter what the music is. A crop that removed a bar would
  // be a different capture, not a re-crop.
  let lastCapture = null;

  // readTrims() → the four crop boxes as a plain object, read at click time so a
  // value typed after load travels with no listener, exactly as the two bar
  // inputs do. Returns raw values; MusicRaster.normaliseTrims does the clamping,
  // so there is one place that decides what a trim means.
  function readTrims() {
    const val = function (el) { return el ? el.value : 0; };
    return {
      top: val(els.cropTop),
      bottom: val(els.cropBottom),
      left: val(els.cropLeft),
      right: val(els.cropRight),
    };
  }

  // croppedSize(dims, trims) → { w, h } after the trims, PURE and with no canvas
  // anywhere, which is what makes the refusal path below reachable in selfTest
  // without engraving anything. Trims are OUTPUT pixels: they are subtracted
  // straight from the finished image's dimensions, so a 4124-wide capture with 50
  // off each side is 4024 wide. Values may come back zero or negative — deciding
  // that is the caller's job, not this function's.
  function croppedSize(dims, trims) {
    const t = raster.normaliseTrims ? raster.normaliseTrims(trims) : null;
    const w = dims && dims.w ? dims.w : 0;
    const h = dims && dims.h ? dims.h : 0;
    if (!t) return { w: w, h: h };
    return { w: w - t.left - t.right, h: h - t.top - t.bottom };
  }

  // The one sentence both the capture and the re-crop path use when the trims
  // leave nothing. Named once so the two cannot drift apart.
  const CROP_EMPTY_MESSAGE =
    "Those trims would remove the whole image. Reduce them and try again.";

  // handleRecrop — re-rasterise the HELD svg at the current trims. Never slices,
  // never engraves, never touches the descriptions. On any refusal the PREVIOUS
  // result is left exactly as it stands: nothing is cleared before the new bytes
  // are in hand, so a user who over-trims still has the image they had.
  async function handleRecrop() {
    if (!lastCapture) {
      // Not normally reachable: the button ships disabled and is enabled only
      // after a capture succeeds. Kept because a disabled button is a UI state,
      // not a guarantee.
      if (els.captureStatus) els.captureStatus.textContent = "Capture some bars before re-cropping.";
      return;
    }

    const trims = readTrims();
    const size = croppedSize(lastCapture.fullDims, trims);
    if (size.w <= 0 || size.h <= 0) {
      if (els.captureStatus) els.captureStatus.textContent = CROP_EMPTY_MESSAGE;
      return;
    }

    if (els.captureStatus) els.captureStatus.textContent = "Re-cropping the image.";
    // Disabling a FOCUSED button drops focus to the body, and a keyboard user
    // pressing Enter here is doing so repeatedly while they tune the four trims —
    // so whether the button held focus is remembered and given back in the
    // finally, after it is enabled again. Measured 29 August 2026: without this,
    // document.activeElement was <body> after every keyboard re-crop.
    const hadFocus = document.activeElement === els.recropButton;
    if (els.recropButton) els.recropButton.disabled = true;
    if (els.captureButton) els.captureButton.disabled = true;

    try {
      let bytes = null;
      try {
        bytes = await raster.rasteriseSvg(lastCapture.svg, CAPTURE_SCALE, trims);
      } catch (e) {
        // MusicRaster refuses an empty crop itself as well, so the code is
        // honoured here rather than trusted to the pre-check above.
        if (e && e.code === raster.CROP_EMPTY_CODE) {
          if (els.captureStatus) els.captureStatus.textContent = CROP_EMPTY_MESSAGE;
          return;
        }
        logWarn("Re-crop exceeded the canvas limit", e);
        if (els.captureStatus) els.captureStatus.textContent = "That image is too large to redraw. Capture fewer bars.";
        return;
      }
      if (!bytes || !bytes.length) {
        if (els.captureStatus) els.captureStatus.textContent = "The re-cropped image came back empty.";
        return;
      }

      // Only now is the previous preview replaced, and only now is its object URL
      // revoked — every early return above leaves the standing result untouched.
      const dims = pngDimensions(bytes);
      if (capturePngUrl) URL.revokeObjectURL(capturePngUrl);
      capturePngUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      lastCapture.trims = trims;
      renderCaptureResults(
        capturePngUrl, lastCapture.filename, dims, lastCapture.altText, lastCapture.longText
      );

      const done = "Re-cropped to " + dims.w + " by " + dims.h + " pixels.";
      if (els.captureStatus) els.captureStatus.textContent = done;
      logInfo(done + " (" + bytes.length + " bytes)");
    } catch (e) {
      logError("Re-crop failed", e);
      if (els.captureStatus) els.captureStatus.textContent = "The image could not be re-cropped.";
      notify.error("The image could not be re-cropped.");
    } finally {
      if (els.recropButton) els.recropButton.disabled = false;
      if (els.captureButton) els.captureButton.disabled = false;
      if (hadFocus && els.recropButton) els.recropButton.focus();
    }
  }

  // handleCapture — the handlePdf shape: guard on loaded state, status line,
  // disable during work, try/catch/finally. NEVER throws and never lets an error
  // reach the console unhandled; every failure has its OWN status message, so a
  // user is told which step declined rather than "something went wrong".
  async function handleCapture() {
    if (!state.currentModel || !state.currentXml) {
      const msg = "Load a score before capturing bars.";
      if (els.captureStatus) els.captureStatus.textContent = msg;
      notify.warning(msg);
      return;
    }

    // Read at click time, so a value typed after load travels without a listener.
    const from = els.captureFrom ? els.captureFrom.value.trim() : "";
    const to = els.captureTo ? els.captureTo.value.trim() : "";

    if (!from || !to) {
      const msg = "Type both a from bar and a to bar.";
      if (els.captureStatus) els.captureStatus.textContent = msg;
      return;
    }

    // Resolve both numbers against the model BEFORE slicing, so an unknown bar is
    // named in the message rather than surfacing as a failed render.
    const fromIndex = barIndexOf(state.currentModel, from);
    const toIndex = barIndexOf(state.currentModel, to);
    if (fromIndex === -1 || toIndex === -1) {
      const missing = fromIndex === -1 ? from : to;
      const msg = "Bar " + missing + " is not in this score.";
      if (els.captureStatus) els.captureStatus.textContent = msg;
      return;
    }
    if (fromIndex > toIndex) {
      const msg = "Bar " + from + " comes after bar " + to + ". Swap them and try again.";
      if (els.captureStatus) els.captureStatus.textContent = msg;
      return;
    }

    if (els.captureStatus) els.captureStatus.textContent = "Capturing bars " + from + " to " + to + ".";
    // The SIBLING of the re-crop button restore below. Disabling a focused button
    // drops focus to the body, so a keyboard user who presses Enter here is
    // returned to the top of the document; the fault was found on the re-crop
    // button and is fixed on both, because this one predates it and behaves
    // identically. Measured 29 August 2026 on both buttons.
    const hadFocus = document.activeElement === els.captureButton;
    if (els.captureButton) els.captureButton.disabled = true;

    try {
      // Slice state.currentXml, not the original upload, so a transposition
      // composes: handleTranspose routes its transposed xml back through
      // renderOutputs, which is what sets currentXml and currentModel together.
      const slice = excerpt.sliceXml(state.currentXml, from, to);
      if (!slice) {
        if (els.captureStatus) els.captureStatus.textContent = "Bars " + from + " to " + to + " could not be taken from this score.";
        return;
      }

      const svg = await raster.renderExcerptSvg(slice);
      if (!svg) {
        if (els.captureStatus) els.captureStatus.textContent = "Bars " + from + " to " + to + " could not be drawn as music.";
        return;
      }

      // The trims are read at click time like everything else here, so whatever
      // is in the crop boxes applies to this capture and not only to a later
      // re-crop. Both ceilings REJECT rather than resolving null, so they are
      // caught separately and told apart by their code: one means the range is
      // too wide to draw at all, the other means the trims leave nothing.
      const trims = readTrims();
      let bytes = null;
      try {
        bytes = await raster.rasteriseSvg(svg, CAPTURE_SCALE, trims);
      } catch (e) {
        if (e && e.code === raster.CROP_EMPTY_CODE) {
          if (els.captureStatus) els.captureStatus.textContent = CROP_EMPTY_MESSAGE;
          return;
        }
        logWarn("Capture exceeded the canvas limit", e);
        if (els.captureStatus) els.captureStatus.textContent = "That range is too wide to turn into an image. Try fewer bars.";
        return;
      }
      if (!bytes || !bytes.length) {
        if (els.captureStatus) els.captureStatus.textContent = "The image for bars " + from + " to " + to + " came back empty.";
        return;
      }

      // Descriptions. Both are best-effort: a missing description costs the text
      // but never the image, so each falls back to a plain range sentence.
      const rangeSentence = "Bars " + from + " to " + to + ".";
      const altText = describeSpan.spanSummary(state.currentModel, fromIndex, toIndex) || rangeSentence;
      const sub = describeSpan.spanModelOf(state.currentModel, fromIndex, toIndex);
      const longText = outlineToText(sub ? renderText.outlineOf(sub) : null) || rangeSentence;

      // Dimensions off the PNG's own IHDR, not from the SVG times the factor, so
      // the caption reports the file rather than the arithmetic.
      const dims = pngDimensions(bytes);

      if (capturePngUrl) URL.revokeObjectURL(capturePngUrl);
      capturePngUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      const filename = captureFilename(state.filename, from, to);
      renderCaptureResults(capturePngUrl, filename, dims, altText, longText);

      // Hold the SVG and its descriptions so a re-crop needs neither the slicer
      // nor the engraver. fullDims adds back the trims just applied, so it is the
      // untrimmed size however this capture was cropped.
      const appliedTrims = raster.normaliseTrims ? raster.normaliseTrims(trims) : null;
      lastCapture = {
        svg: svg,
        filename: filename,
        altText: altText,
        longText: longText,
        trims: trims,
        fullDims: appliedTrims
          ? { w: dims.w + appliedTrims.left + appliedTrims.right, h: dims.h + appliedTrims.top + appliedTrims.bottom }
          : { w: dims.w, h: dims.h },
      };
      if (els.recropButton) els.recropButton.disabled = false;

      const done = "Captured bars " + from + " to " + to + ", " + dims.w + " by " + dims.h + " pixels.";
      if (els.captureStatus) els.captureStatus.textContent = done;
      logInfo(done + " (" + bytes.length + " bytes)");
    } catch (e) {
      logError("Capture failed", e);
      if (els.captureStatus) els.captureStatus.textContent = "Bars " + from + " to " + to + " could not be captured.";
      notify.error("The bars could not be captured.");
    } finally {
      if (els.captureButton) els.captureButton.disabled = false;
      if (hadFocus && els.captureButton) els.captureButton.focus();
    }
  }

  // 2x matches the Stage 86 measurements and keeps an eight-bar excerpt well
  // inside the 16384px canvas ceiling; 3x refuses above about 5,461px wide.
  const CAPTURE_SCALE = 2;

  // Read width and height from the PNG's IHDR chunk (big-endian at bytes 16-23).
  // Reading the file itself rather than multiplying the SVG's dimensions means a
  // reported size can never disagree with the image the user downloads.
  function pngDimensions(bytes) {
    if (!bytes || bytes.length < 24) return { w: 0, h: 0 };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: view.getUint32(16), h: view.getUint32(20) };
  }

  // "score-bars-9-16.png", from the loaded filename with its extension dropped.
  function captureFilename(filename, from, to) {
    const stem = (filename || "score").replace(/\.[^.]+$/, "");
    return stem + "-bars-" + from + "-" + to + ".png";
  }

  function handleStandardPdf() { return handlePdf("standard", "tagged"); }
  function handleLargePrintPdf() { return handlePdf(LARGE_PRINT_PROFILE, "large-print"); }

  function init() {
    cacheElements();
    if (els.fileInput) els.fileInput.addEventListener("change", handleFileSelect);
    else logWarn("File input #musicFile not found; file loading is disabled");
    // The PDF buttons are static HTML, so they are wired once here (addEventListener,
    // not onclick, because the handlers are private and not on the public surface).
    if (els.pdfButton) els.pdfButton.addEventListener("click", handleStandardPdf);
    else logWarn("PDF button #pdfButton not found; the PDF download is disabled");
    if (els.pdfLargePrintButton) els.pdfLargePrintButton.addEventListener("click", handleLargePrintPdf);
    else logWarn("Large-print PDF button #pdfLargePrintButton not found; the large-print PDF download is disabled");
    // The capture button is static HTML too, so it is wired once here alongside
    // the PDF buttons and never rebuilt per upload.
    if (els.captureButton) els.captureButton.addEventListener("click", handleCapture);
    else logWarn("Capture button #captureButton not found; the bar capture is disabled");
    // The re-crop button is static HTML and ships disabled; the capture handler
    // enables it once there is a held image to re-crop.
    if (els.recropButton) els.recropButton.addEventListener("click", handleRecrop);
    else logWarn("Re-crop button #recropButton not found; the crop is capture-time only");
    // Stage 91: the large-print settings. ONE change listener on the fieldset
    // (change bubbles, and the three groups need no separate handling) persists
    // the choice; the reset button puts the defaults back and forgets the record.
    if (els.largePrintSettings) els.largePrintSettings.addEventListener("change", handleLargePrintChange);
    else logWarn("Large-print settings #largePrintSettings not found; the choices will not be saved");
    if (els.largePrintResetButton) els.largePrintResetButton.addEventListener("click", handleLargePrintReset);
    else logWarn("Reset button #largePrintResetButton not found; the large-print settings cannot be reset");
    // Read the stored record ONCE, here, and put it on the controls. From this
    // point the DOM is the truth and the store is only the next visit's memory.
    // An absent, unreadable or wrong-version record leaves the markup's own
    // checked radios standing, which are the shipped defaults.
    const storedLargePrint = readStoredLargePrint();
    if (storedLargePrint) {
      const applied = applyLargePrintSettings(storedLargePrint);
      logInfo(
        "Restored large-print settings: staff " + applied.staff +
          ", line weight " + applied.thickness +
          ", " + applied.barsPerSystem + " bars per system"
      );
    }
    // The transpose control is not model-bound, so it is rendered ONCE here rather
    // than per upload; clicks adjust the running offset via handleTranspose.
    if (els.transposeMount) transpose.render(els.transposeMount, handleTranspose);
    else logWarn("Transpose mount #transposeMount not found; transpose control disabled");
    // Ensure the play-along handler is subscribed (idempotent; it also self-registers at load).
    playAlong.register();
    logInfo("MusicApp initialised");
  }

  // Self-test: async because it exercises the real FileReader pipeline end to
  // end. Verifies the public surface, the wiring of the file input, presence of
  // the sibling globals, and that loadFile/getLoaded round-trip a payload and
  // announce it through the live region. Restores the status region afterwards.
  async function selfTest() {
    const results = {};
    results.hasInit = typeof init === "function";
    results.hasGetLoaded = typeof getLoaded === "function";
    results.hasSelfTest = typeof selfTest === "function";
    results.fileInputWired = !!els.fileInput && els.fileInput === document.getElementById("musicFile");
    results.dependenciesPresent =
      !!window.MusicLog && !!window.MusicAnnounce && !!window.MusicNotify && !!window.MusicConfirm &&
      !!window.MusicRenderScore && !!window.MusicParse && !!window.MusicModelWalk &&
      !!window.MusicRenderText && !!window.MusicRenderSummary && !!window.MusicExport &&
      !!window.MusicAudioSchedule && !!window.MusicAudio &&
      !!window.MusicMidiBuild && !!window.MusicMidi && !!window.MusicTranspose &&
      !!window.MusicPlayAlong &&
      !!window.MusicPdfMarkup && !!window.MusicPdf &&
      !!window.MusicMxl;
    results.scoreMountCached =
      !!els.scoreMount && els.scoreMount === document.getElementById("scoreMount");
    results.noteListMountCached =
      !!els.noteListMount && els.noteListMount === document.getElementById("noteListMount");
    results.summaryMountCached =
      !!els.summaryMount && els.summaryMount === document.getElementById("summaryMount");
    results.exportMountCached =
      !!els.exportMount && els.exportMount === document.getElementById("exportMount");
    results.audioMountCached =
      !!els.audioMount && els.audioMount === document.getElementById("audioMount");
    results.midiMountCached =
      !!els.midiMount && els.midiMount === document.getElementById("midiMount");
    results.transposeMountCached =
      !!els.transposeMount && els.transposeMount === document.getElementById("transposeMount");
    results.pdfButtonCached =
      !!els.pdfButton && els.pdfButton === document.getElementById("pdfButton");
    results.pdfLargePrintButtonCached =
      !!els.pdfLargePrintButton && els.pdfLargePrintButton === document.getElementById("pdfLargePrintButton");
    results.pdfStatusCached =
      !!els.pdfStatus && els.pdfStatus === document.getElementById("pdfStatus");

    // The image-description group is static HTML: one fieldset carrying a legend,
    // three native radios sharing one name, in the documented value order, each
    // with a non-empty label bound by for/id. The default is asserted from the
    // MARKUP attribute rather than from live checked state, so the row is immune
    // to the flip the next row performs (and to any prior run order).
    const altRadios = document.querySelectorAll(
      'input[type="radio"][name="' + ALT_TEXT_LEVEL_NAME + '"]'
    );
    const altFieldset = altRadios.length ? altRadios[0].closest("fieldset") : null;
    const altLegend = altFieldset ? altFieldset.querySelector("legend") : null;
    const altValues = Array.prototype.map.call(altRadios, function (r) { return r.value; });
    const altAllLabelled = Array.prototype.every.call(altRadios, function (r) {
      const lab = r.id ? document.querySelector('label[for="' + r.id + '"]') : null;
      return !!lab && lab.textContent.trim().length > 0;
    });
    results.pdfAltTextLevelGroupPresent =
      altRadios.length === 3 &&
      !!altFieldset && !!altLegend &&
      altLegend.textContent.trim() === "PDF image descriptions" &&
      altValues.join(",") === "pages,summary,talking-score" &&
      altAllLabelled &&
      altRadios[0].hasAttribute("checked") &&
      !altRadios[1].hasAttribute("checked") &&
      !altRadios[2].hasAttribute("checked");

    // The level is READ at generate time, not captured at load. Flip a different
    // radio programmatically, invoke the read path directly (no PDF is compiled),
    // and confirm the NEW value comes back; then restore and confirm the read
    // path follows the restore too, which is what proves the read is live rather
    // than a one-off.
    const altPriorChecked = document.querySelector(
      'input[name="' + ALT_TEXT_LEVEL_NAME + '"]:checked'
    );
    const altBefore = readAltTextLevel();
    const altTalking = document.getElementById("pdfAltTextLevelTalkingScore");
    let altAfterFlip = null;
    if (altTalking) {
      altTalking.checked = true;
      altAfterFlip = readAltTextLevel();
    }
    if (altPriorChecked) altPriorChecked.checked = true; // restore
    results.pdfAltTextLevelReadAtGenerateTime =
      altBefore === ALT_TEXT_LEVEL_FALLBACK &&
      altAfterFlip === "talking-score" &&
      readAltTextLevel() === altBefore;

    // --- Stage 91: the large-print settings ---------------------------------
    // Everything below restores what it touched. Two things persist beyond this
    // function if they are not put back: the three radios (which decide what the
    // NEXT real large-print compile engraves) and one localStorage key. The key
    // is captured RAW here and written back byte-exactly at the end, including
    // the was-absent case, so a run of selfTest cannot silently change a setting
    // Matthew chose. Only THIS key is touched, by name: the origin is shared with
    // tools.html, so a pattern-based clear would take credentials with it.
    const lpPriorChecked = {
      staff: checkedValue(LARGE_PRINT_STAFF_NAME, null),
      thickness: checkedValue(LARGE_PRINT_THICKNESS_NAME, null),
      barsPerSystem: checkedValue(LARGE_PRINT_BARS_NAME, null),
    };
    let lpPriorRaw = null;
    let lpStorageReachable = true;
    try {
      lpPriorRaw = window.localStorage.getItem(LARGE_PRINT_STORE_KEY);
    } catch (e) {
      lpStorageReachable = false;
    }
    const lpPriorPdfStatus = els.pdfStatus ? els.pdfStatus.textContent : null;

    // The two cached elements, on the pattern of the rows above.
    results.largePrintSettingsCached =
      !!els.largePrintSettings &&
      els.largePrintSettings === document.getElementById("largePrintSettings") &&
      !!els.largePrintResetButton &&
      els.largePrintResetButton === document.getElementById("largePrintResetButton");

    // The shell: an outer fieldset with its legend and a non-empty hint, three
    // nested fieldsets each carrying a legend, and a reset button with a visible
    // accessible name and an aria-hidden icon span (never an icon alone).
    const lpFieldset = document.getElementById("largePrintSettings");
    const lpLegend = lpFieldset ? lpFieldset.querySelector("legend") : null;
    const lpNested = lpFieldset ? lpFieldset.querySelectorAll("fieldset") : [];
    const lpNestedLegends = Array.prototype.map.call(lpNested, function (f) {
      const l = f.querySelector("legend");
      return l ? l.textContent.trim() : "";
    });
    const lpReset = document.getElementById("largePrintResetButton");
    const lpResetIcon = lpReset ? lpReset.querySelector("[data-icon]") : null;
    results.largePrintFieldsetPresent =
      !!lpFieldset && !!lpLegend &&
      lpLegend.textContent.trim() === "Large-print settings" &&
      // The hint that says which button these reach. Asserted as a direct child
      // paragraph with real text, not merely that some paragraph exists.
      Array.prototype.some.call(lpFieldset.children, function (c) {
        return c.tagName === "P" && c.textContent.trim().length > 0;
      }) &&
      lpNested.length === 3 &&
      lpNestedLegends.join("|") === "Staff size|Line weight|Bars per system" &&
      !!lpReset &&
      lpReset.textContent.trim() === "Reset large-print settings" &&
      !!lpResetIcon &&
      lpResetIcon.getAttribute("data-icon") === "refresh" &&
      lpResetIcon.getAttribute("aria-hidden") === "true";

    // Each group: the right radios in the documented value order, every one bound
    // to a non-empty label, and the default asserted from the MARKUP attribute
    // rather than from live checked state — so these rows are immune to the flips
    // the rows below perform, and to any prior run order.
    const lpGroupShape = function (name, expectedValues, defaultIndex) {
      const radios = document.querySelectorAll(
        'input[type="radio"][name="' + name + '"]'
      );
      if (radios.length !== expectedValues.length) return false;
      const values = Array.prototype.map.call(radios, function (r) { return r.value; });
      if (values.join(",") !== expectedValues.join(",")) return false;
      const allLabelled = Array.prototype.every.call(radios, function (r) {
        const lab = r.id ? document.querySelector('label[for="' + r.id + '"]') : null;
        return !!lab && lab.textContent.trim().length > 0;
      });
      if (!allLabelled) return false;
      return Array.prototype.every.call(radios, function (r, i) {
        return r.hasAttribute("checked") === (i === defaultIndex);
      });
    };
    results.largePrintStaffGroupPresent =
      lpGroupShape(LARGE_PRINT_STAFF_NAME, ["small", "medium", "current", "large"], 2);
    results.largePrintThicknessGroupPresent =
      lpGroupShape(LARGE_PRINT_THICKNESS_NAME, ["thin", "medium", "thick"], 0);
    results.largePrintBarsGroupPresent =
      lpGroupShape(LARGE_PRINT_BARS_NAME, ["1", "2", "3", "4"], 1);

    // The fallback constants and the markup's own checked radios must agree, or a
    // missing group would silently engrave something nobody selected. Read from
    // the ATTRIBUTE, so this compares the two declarations rather than the live
    // state that both happen to produce.
    const lpMarkupDefault = function (name) {
      const radios = document.querySelectorAll('input[name="' + name + '"]');
      const checked = Array.prototype.filter.call(radios, function (r) {
        return r.hasAttribute("checked");
      });
      return checked.length === 1 ? checked[0].value : null;
    };
    results.largePrintDefaultsMatchMarkup =
      lpMarkupDefault(LARGE_PRINT_STAFF_NAME) === LARGE_PRINT_DEFAULTS.staff &&
      lpMarkupDefault(LARGE_PRINT_THICKNESS_NAME) === LARGE_PRINT_DEFAULTS.thickness &&
      lpMarkupDefault(LARGE_PRINT_BARS_NAME) === String(LARGE_PRINT_DEFAULTS.barsPerSystem);

    // The mapping, driven on the PURE function so no PDF is compiled. All four
    // staff names give their measured geometry, and `unit` is absent from every
    // one of them (Stage 89 measured all four at the unit cap, so the profile's
    // own unit must travel untouched).
    const lpAt = function (staff, thickness, bars) {
      return largePrintOverrides({ staff: staff, thickness: thickness, barsPerSystem: bars });
    };
    const lpSizeOf = function (staff) {
      const e = lpAt(staff, "thin", 2).engraving;
      return e.pageWidth + "x" + e.pageHeight + (("unit" in e) ? "+unit" : "");
    };
    results.largePrintMapsStaffSizes =
      lpSizeOf("small") === "2200x3117" &&
      lpSizeOf("medium") === "1540x2182" &&
      lpSizeOf("current") === "1200x1700" &&
      lpSizeOf("large") === "1100x1558";

    const lpWeightOf = function (thickness) {
      const e = lpAt("current", thickness, 2).engraving;
      return e.staffLineWidth + "/" + e.barLineWidth + "/" + e.stemWidth;
    };
    results.largePrintMapsLineWeights =
      lpWeightOf("thin") === "0.15/0.3/0.2" &&
      lpWeightOf("medium") === "0.22/0.44/0.3" &&
      lpWeightOf("thick") === "0.3/0.6/0.4";

    results.largePrintMapsBarsPerSystem =
      lpAt("current", "thin", 1).pagination.barsPerSystem === 1 &&
      lpAt("current", "thin", 2).pagination.barsPerSystem === 2 &&
      lpAt("current", "thin", 3).pagination.barsPerSystem === 3 &&
      lpAt("current", "thin", 4).pagination.barsPerSystem === 4 &&
      // A radio's value is a STRING, so the coercion is part of the contract.
      lpAt("current", "thin", "3").pagination.barsPerSystem === 3;

    // THE BYTE-IDENTITY PIN. The default names must map to exactly the values the
    // large-print engraving and pagination profiles already carry, or the default
    // selection stops being a no-op merge and today's 95,385-byte document moves
    // without anyone choosing anything. These six numbers are the whole of that
    // claim on this side of the seam.
    const lpDefault = largePrintOverrides(LARGE_PRINT_DEFAULTS);
    results.largePrintDefaultsMatchShippedProfile =
      lpDefault.engraving.pageWidth === 1200 &&
      lpDefault.engraving.pageHeight === 1700 &&
      lpDefault.engraving.staffLineWidth === 0.15 &&
      lpDefault.engraving.barLineWidth === 0.3 &&
      lpDefault.engraving.stemWidth === 0.2 &&
      lpDefault.pagination.barsPerSystem === 2;

    // VALUE VALIDATION — the Stage 90 board item, closed here. Each bad value
    // falls back to the shipped default for ITS key and leaves the other two
    // alone, which is what makes the fallback a repair rather than a reset.
    const lpBadStaff = lpAt("bogus", "thick", 3);
    results.largePrintUnknownStaffFallsBack =
      lpBadStaff.names.staff === "current" &&
      lpBadStaff.engraving.pageWidth === 1200 &&
      lpBadStaff.names.thickness === "thick" &&
      lpBadStaff.names.barsPerSystem === 3;
    const lpBadWeight = lpAt("small", "chunky", 3);
    results.largePrintUnknownThicknessFallsBack =
      lpBadWeight.names.thickness === "thin" &&
      lpBadWeight.engraving.staffLineWidth === 0.15 &&
      lpBadWeight.names.staff === "small" &&
      lpBadWeight.names.barsPerSystem === 3;

    // barsPerSystem 0 is the value Stage 90 named: it makes (n - 1) % systemEvery
    // NaN, so NO break is injected and the score paginates as though the profile
    // were absent. Every one of these must come back as 2, and the two POSITIVE
    // CANARIES on the end are what stop this row passing on a validator that
    // simply returns the default for everything.
    const lpBars = function (v) { return lpAt("current", "thin", v).names.barsPerSystem; };
    results.largePrintBarsOutOfRangeFallsBack =
      lpBars(0) === 2 && lpBars(5) === 2 && lpBars(-1) === 2 &&
      lpBars(2.5) === 2 && lpBars("abc") === 2 && lpBars(null) === 2 &&
      lpBars(undefined) === 2 && lpBars("") === 2 &&
      lpBars(1) === 1 && lpBars(4) === 4;

    // Read AT GENERATE TIME, not captured at load: flip a radio in each group
    // programmatically, invoke the read path directly (no PDF is compiled), and
    // confirm the new values come back; then restore and confirm the read follows
    // the restore too, which is what proves the read is live rather than a one-off.
    const lpBefore = readLargePrintSettings();
    const lpFlipStaff = document.getElementById("largePrintStaffSmall");
    const lpFlipWeight = document.getElementById("largePrintThicknessThick");
    const lpFlipBars = document.getElementById("largePrintBars4");
    if (lpFlipStaff) lpFlipStaff.checked = true;
    if (lpFlipWeight) lpFlipWeight.checked = true;
    if (lpFlipBars) lpFlipBars.checked = true;
    const lpAfterFlip = readLargePrintSettings();
    applyLargePrintSettings(LARGE_PRINT_DEFAULTS); // restore before asserting
    const lpAfterRestore = readLargePrintSettings();
    results.largePrintReadAtGenerateTime =
      lpBefore.names.staff === LARGE_PRINT_DEFAULTS.staff &&
      lpAfterFlip.names.staff === "small" &&
      lpAfterFlip.names.thickness === "thick" &&
      lpAfterFlip.names.barsPerSystem === 4 &&
      lpAfterFlip.engraving.pageWidth === 2200 &&
      lpAfterRestore.names.staff === LARGE_PRINT_DEFAULTS.staff &&
      lpAfterRestore.names.thickness === LARGE_PRINT_DEFAULTS.thickness &&
      lpAfterRestore.names.barsPerSystem === LARGE_PRINT_DEFAULTS.barsPerSystem;

    // The store: a write, a read-back, and a removal, all inside this function.
    // The round trip is asserted on the NAMES, and the raw record is read back
    // directly as well so the documented shape — v first, names not numbers — is
    // pinned rather than merely round-tripping through our own reader.
    if (lpStorageReachable) {
      const lpWrote = writeStoredLargePrint({ staff: "medium", thickness: "thick", barsPerSystem: 3 });
      let lpRaw = null;
      try { lpRaw = window.localStorage.getItem(LARGE_PRINT_STORE_KEY); } catch (e) { lpRaw = null; }
      const lpReadBack = readStoredLargePrint();
      const lpCleared = clearStoredLargePrint();
      const lpAfterClear = readStoredLargePrint();
      results.largePrintStorageRoundTrips =
        lpWrote === true &&
        lpRaw === '{"v":1,"staff":"medium","thickness":"thick","barsPerSystem":3}' &&
        !!lpReadBack && lpReadBack.staff === "medium" &&
        lpReadBack.thickness === "thick" && lpReadBack.barsPerSystem === 3 &&
        lpCleared === true && lpAfterClear === null;

      // A record from another version, and an unparseable one, are each treated as
      // ABSENT rather than half-read — and neither throws out of the reader.
      let lpWrongVersion = null;
      let lpMalformed = null;
      try {
        window.localStorage.setItem(
          LARGE_PRINT_STORE_KEY,
          '{"v":99,"staff":"small","thickness":"thick","barsPerSystem":1}'
        );
        lpWrongVersion = readStoredLargePrint();
        window.localStorage.setItem(LARGE_PRINT_STORE_KEY, "not json at all");
        lpMalformed = readStoredLargePrint();
        window.localStorage.removeItem(LARGE_PRINT_STORE_KEY);
      } catch (e) {
        lpWrongVersion = "threw";
        lpMalformed = "threw";
      }
      results.largePrintStorageRefusesForeignRecords =
        lpWrongVersion === null && lpMalformed === null;

      // A bad value cannot be STORED and read back as though it had been chosen.
      let lpStoredBadRaw = null;
      try {
        writeStoredLargePrint({ staff: "bogus", thickness: "thin", barsPerSystem: 9 });
        lpStoredBadRaw = window.localStorage.getItem(LARGE_PRINT_STORE_KEY);
        window.localStorage.removeItem(LARGE_PRINT_STORE_KEY);
      } catch (e) {
        lpStoredBadRaw = null;
      }
      results.largePrintStorageValidatesBeforeWriting =
        lpStoredBadRaw === '{"v":1,"staff":"current","thickness":"thin","barsPerSystem":2}';
    } else {
      // Storage genuinely unreachable (a locked-down profile). Say so as a red
      // rather than as a silent pass: these rows measure nothing here.
      results.largePrintStorageRoundTrips = false;
      results.largePrintStorageRefusesForeignRecords = false;
      results.largePrintStorageValidatesBeforeWriting = false;
    }

    // The reset: non-defaults on the controls AND in the store, then the real
    // handler, then the defaults back and the key gone. Driven programmatically,
    // so the hadFocus guard means the button does not steal focus here.
    if (lpFlipStaff) lpFlipStaff.checked = true;
    if (lpFlipWeight) lpFlipWeight.checked = true;
    if (lpFlipBars) lpFlipBars.checked = true;
    if (lpStorageReachable) writeStoredLargePrint({ staff: "small", thickness: "thick", barsPerSystem: 4 });
    const lpFocusBeforeReset = document.activeElement;
    handleLargePrintReset();
    const lpAfterReset = readLargePrintSettings();
    let lpKeyGone = true;
    try { lpKeyGone = window.localStorage.getItem(LARGE_PRINT_STORE_KEY) === null; } catch (e) { lpKeyGone = true; }
    results.largePrintResetRestoresDefaults =
      lpAfterReset.names.staff === LARGE_PRINT_DEFAULTS.staff &&
      lpAfterReset.names.thickness === LARGE_PRINT_DEFAULTS.thickness &&
      lpAfterReset.names.barsPerSystem === LARGE_PRINT_DEFAULTS.barsPerSystem &&
      lpKeyGone === true &&
      // It reports through the PDF status line, and it did not steal focus from
      // wherever the caller was.
      (!els.pdfStatus || els.pdfStatus.textContent === "Large-print settings reset to the defaults.") &&
      document.activeElement === lpFocusBeforeReset;

    // THE SETTINGS DO NOT REACH THE STANDARD PATH. Driven on the pure options
    // builder at BOTH profiles with the SAME non-default settings, so the
    // large-print half is the positive canary that stops the standard half
    // passing on a builder that returns nothing at all. The keys must be ABSENT
    // from the standard object, not merely empty: an absent key is the object
    // handlePdf passed before this stage.
    const lpNonDefault = lpAt("small", "thick", 4);
    const lpStandardOpts = pdfOptionsFor("standard", "pages", lpNonDefault);
    const lpLargeOpts = pdfOptionsFor(LARGE_PRINT_PROFILE, "pages", lpNonDefault);
    results.largePrintSettingsNeverReachStandard =
      Object.keys(lpStandardOpts).join(",") === "altTextLevel" &&
      !("engraving" in lpStandardOpts) && !("pagination" in lpStandardOpts) &&
      lpStandardOpts.altTextLevel === "pages" &&
      // Positive canary on the same builder, same settings, same call.
      lpLargeOpts.engraving.pageWidth === 2200 &&
      lpLargeOpts.engraving.stemWidth === 0.4 &&
      lpLargeOpts.pagination.barsPerSystem === 4 &&
      lpLargeOpts.altTextLevel === "pages";

    // Restore everything this block touched: the three radios to what they were
    // on entry, the store to its exact prior bytes (including absent), and the PDF
    // status line the reset handler wrote to.
    applyLargePrintSettings({
      staff: lpPriorChecked.staff,
      thickness: lpPriorChecked.thickness,
      barsPerSystem: lpPriorChecked.barsPerSystem,
    });
    if (lpStorageReachable) {
      try {
        if (lpPriorRaw === null) window.localStorage.removeItem(LARGE_PRINT_STORE_KEY);
        else window.localStorage.setItem(LARGE_PRINT_STORE_KEY, lpPriorRaw);
      } catch (e) {
        logWarn("selfTest could not restore the stored large-print settings", e);
      }
    }
    if (els.pdfStatus) els.pdfStatus.textContent = lpPriorPdfStatus || "";
    // The restore is asserted, not assumed: a harness that writes real persisted
    // storage proves it put it back, or the next reader inherits its residue.
    let lpRestoredRaw = null;
    try { lpRestoredRaw = window.localStorage.getItem(LARGE_PRINT_STORE_KEY); } catch (e) { lpRestoredRaw = null; }
    results.largePrintSelfTestRestoredWhatItTouched =
      lpRestoredRaw === lpPriorRaw &&
      checkedValue(LARGE_PRINT_STAFF_NAME, null) === lpPriorChecked.staff &&
      checkedValue(LARGE_PRINT_THICKNESS_NAME, null) === lpPriorChecked.thickness &&
      checkedValue(LARGE_PRINT_BARS_NAME, null) === lpPriorChecked.barsPerSystem;

    // --- Stage 87: the capture section -------------------------------------
    // The shell is static HTML, so its presence is asserted from the markup: a
    // heading, two text inputs each bound to a non-empty label, a button with an
    // accessible name, a polite status region and an empty results region.
    const capFrom = document.getElementById("captureFrom");
    const capTo = document.getElementById("captureTo");
    const labelFor = function (id) {
      const l = document.querySelector('label[for="' + id + '"]');
      return !!l && l.textContent.trim().length > 0;
    };
    results.captureSectionPresent =
      !!document.getElementById("captureHeading") &&
      !!capFrom && !!capTo &&
      // type="text", NOT number: bar numbers are strings ("0" pickup, "1a" split).
      capFrom.type === "text" && capTo.type === "text" &&
      labelFor("captureFrom") && labelFor("captureTo") &&
      !!els.captureButton && els.captureButton.textContent.trim().length > 0 &&
      !!els.captureStatus && els.captureStatus.getAttribute("aria-live") === "polite" &&
      !!els.captureResults;

    results.captureElementsCached =
      els.captureFrom === capFrom &&
      els.captureTo === capTo &&
      els.captureButton === document.getElementById("captureButton") &&
      els.captureStatus === document.getElementById("captureStatus") &&
      els.captureResults === document.getElementById("captureResults");

    // The inputs are READ at click time. Drive the handler with values set
    // programmatically and confirm the message names THOSE bars — which proves
    // the read is live, exactly as the alt-text-level row does above.
    const capPriorFrom = capFrom ? capFrom.value : "";
    const capPriorTo = capTo ? capTo.value : "";
    const capPriorStatus = els.captureStatus ? els.captureStatus.textContent : "";
    const capPriorModel = state.currentModel;
    const capPriorXml = state.currentXml;

    // Every failure below is reachable WITHOUT a render: each returns before any
    // Verovio or canvas work, so these rows cost no engraving and cannot be
    // billed to a slow machine.
    const driveCapture = async function (from, to) {
      if (capFrom) capFrom.value = from;
      if (capTo) capTo.value = to;
      await handleCapture();
      return els.captureStatus ? els.captureStatus.textContent : "";
    };

    // 1. Nothing loaded: the guard fires before the inputs are even read.
    state.currentModel = null;
    state.currentXml = null;
    results.captureRefusesWithNoScore = (await driveCapture("9", "16")) === "Load a score before capturing bars.";

    // A two-bar stub model, so the remaining rows resolve bar numbers against a
    // known set without loading a fixture or touching the renderer.
    state.currentModel = { parts: [{ id: "P1", measures: [{ number: "1" }, { number: "2" }] }] };
    state.currentXml = "<score-partwise/>";

    results.captureRefusesEmptyInput = (await driveCapture("", "")) === "Type both a from bar and a to bar.";
    results.captureRefusesUnknownBar = (await driveCapture("1", "99")) === "Bar 99 is not in this score.";
    results.captureRefusesReversedRange =
      (await driveCapture("2", "1")) === "Bar 2 comes after bar 1. Swap them and try again.";

    // Focus survives a capture. Driven through the SLICE FAILURE path — a valid
    // bar pair against a stub XML the slicer cannot cut — because that is the
    // shortest route that actually reaches the disable and the finally without
    // engraving anything. The four refusals above all return BEFORE the button is
    // ever disabled, so none of them could see this fault: the restore lives in
    // the finally, and only a drive that gets past the disable exercises it.
    // The status check is the positive canary that the drive really did get
    // there, so a row that never entered the try cannot read green.
    const capFocusPrior = document.activeElement;
    if (els.captureButton) els.captureButton.focus();
    const capHadFocus = document.activeElement === els.captureButton;
    const capFocusStatus = await driveCapture("1", "2");
    results.captureReturnsFocusToItsButton =
      capHadFocus &&
      capFocusStatus === "Bars 1 to 2 could not be taken from this score." &&
      document.activeElement === els.captureButton;
    if (capFocusPrior && typeof capFocusPrior.focus === "function") capFocusPrior.focus();

    // The bar lookup itself: a string match, never a parse. "01" must NOT resolve
    // to bar 1, or a pickup bar "0" and a split bar "1a" would both be reachable
    // by the wrong input.
    results.captureBarLookupIsStringExact =
      barIndexOf(state.currentModel, "1") === 0 &&
      barIndexOf(state.currentModel, "2") === 1 &&
      barIndexOf(state.currentModel, "01") === -1 &&
      barIndexOf(state.currentModel, "3") === -1;

    // The outline-to-text renderer, driven on a hand-built outline so it needs no
    // model, no parse and no render. Asserts the indent depths and that the flat
    // item shape (a bar with items and no groups) is handled too.
    const capOutlineText = outlineToText({
      blocks: [{
        heading: "Piano",
        bars: [
          { label: "Bar 9", groups: [{ heading: "Treble staff", items: [{ text: "C4 minim" }] }] },
          { label: "Bar 10", groups: [], items: [{ text: "rest crotchet" }] },
        ],
      }],
    });
    results.captureOutlineTextIndents =
      capOutlineText === "Piano\n  Bar 9\n    Treble staff\n      C4 minim\n  Bar 10\n    rest crotchet";
    results.captureOutlineTextEmptyOnNull = outlineToText(null) === "" && outlineToText({}) === "";

    // --- Stage 88: the crop trims ------------------------------------------
    // The four boxes are static HTML: number inputs, each bound to a non-empty
    // label, each min="0" with a default of 0. The default is asserted from the
    // MARKUP attribute rather than from live value, so the row survives the
    // drives below (and any prior run) writing into them.
    const cropIds = ["cropTop", "cropBottom", "cropLeft", "cropRight"];
    const cropEls = cropIds.map(function (id) { return document.getElementById(id); });
    results.cropInputsPresent =
      cropEls.every(function (el, i) {
        return !!el &&
          el.type === "number" &&
          el.getAttribute("min") === "0" &&
          el.getAttribute("value") === "0" &&
          labelFor(cropIds[i]);
      }) &&
      cropEls.every(function (el, i) { return el === [els.cropTop, els.cropBottom, els.cropLeft, els.cropRight][i]; });

    // The re-crop button exists, carries an accessible name, and is DISABLED
    // until a capture has succeeded. This row runs before any capture in this
    // self-test, and every drive below refuses before rasterising, so nothing
    // here can enable it — which is what makes the assertion meaningful rather
    // than a reading of whatever the page happened to be in.
    results.recropButtonDisabledBeforeAnyCapture =
      !!els.recropButton &&
      els.recropButton === document.getElementById("recropButton") &&
      els.recropButton.textContent.trim().length > 0 &&
      els.recropButton.disabled === true;

    // readTrims reads at CLICK time, not at load: write into the boxes, read, and
    // confirm the new values come back; restore and confirm the read follows the
    // restore too, which is what proves the read is live rather than a one-off.
    const cropPrior = cropEls.map(function (el) { return el ? el.value : ""; });
    if (els.cropTop) els.cropTop.value = "11";
    if (els.cropBottom) els.cropBottom.value = "22";
    if (els.cropLeft) els.cropLeft.value = "33";
    if (els.cropRight) els.cropRight.value = "44";
    const trimsAfterWrite = raster.normaliseTrims ? raster.normaliseTrims(readTrims()) : null;
    cropEls.forEach(function (el, i) { if (el) el.value = cropPrior[i]; }); // restore
    const trimsAfterRestore = raster.normaliseTrims ? raster.normaliseTrims(readTrims()) : null;
    results.cropTrimsReadAtClickTime =
      !!trimsAfterWrite &&
      trimsAfterWrite.top === 11 && trimsAfterWrite.bottom === 22 &&
      trimsAfterWrite.left === 33 && trimsAfterWrite.right === 44 &&
      trimsAfterRestore === null;

    // croppedSize is pure arithmetic on OUTPUT pixels, so the Satie figures are
    // asserted here without capturing anything: 4124 by 1104, trimmed 100 top,
    // 100 bottom, 50 left and 50 right, is 4024 by 904. This row is what pins the
    // UNIT — a trim in SVG units, or one applied before the 2x scale, would give
    // a different pair and redden.
    results.cropSizeIsOutputPixelSubtraction = (function () {
      const c = croppedSize({ w: 4124, h: 1104 }, { top: 100, bottom: 100, left: 50, right: 50 });
      const none = croppedSize({ w: 4124, h: 1104 }, { top: 0, bottom: 0, left: 0, right: 0 });
      return c.w === 4024 && c.h === 904 && none.w === 4124 && none.h === 1104;
    })();

    // The zero-size refusal, reachable WITHOUT a render. A held capture is seeded
    // with a junk SVG that would fail to engrave if it were ever reached, so the
    // row proves the refusal happens BEFORE the rasterise rather than merely that
    // a message appeared: were the pre-check absent, the drive would fall through
    // to the raster module and produce a different sentence.
    const cropPriorHeld = lastCapture;
    const cropPriorFocus = document.activeElement;
    const cropPriorRecropDisabled = els.recropButton ? els.recropButton.disabled : true;
    const cropPriorStatus = els.captureStatus ? els.captureStatus.textContent : "";
    lastCapture = {
      svg: "not an svg at all",
      filename: "selftest.png",
      altText: "alt",
      longText: "long",
      trims: null,
      fullDims: { w: 100, h: 100 },
    };
    if (els.cropTop) els.cropTop.value = "60";
    if (els.cropBottom) els.cropBottom.value = "60";
    await handleRecrop();
    results.recropRefusesZeroSizeWithoutRendering =
      (els.captureStatus ? els.captureStatus.textContent : "") === CROP_EMPTY_MESSAGE;

    // The positive control for the row above: with trims that leave something,
    // the same seeded state gets PAST the size check and fails later on the junk
    // SVG instead. Without this, a croppedSize that returned zero for everything
    // would read exactly like a working pre-check.
    if (els.cropTop) els.cropTop.value = "10";
    if (els.cropBottom) els.cropBottom.value = "10";
    await handleRecrop();
    results.recropPassesSizeCheckWhenTrimsFit =
      (els.captureStatus ? els.captureStatus.textContent : "") !== CROP_EMPTY_MESSAGE;

    // Focus survives a re-crop. The handler disables the button while it works,
    // and a disabled button loses focus to the body — which a keyboard user
    // meets on EVERY press, because tuning four trims means pressing this button
    // repeatedly. Driven on the seeded junk SVG so it costs no engraving, and
    // through the FAILING path deliberately: the finally is the only place the
    // restore can live, so a restore written on the success path alone would
    // read green here and strand a real user on the commonest gesture.
    lastCapture = {
      svg: "not an svg at all",
      filename: "selftest.png",
      altText: "alt", longText: "long", trims: null,
      fullDims: { w: 100, h: 100 },
    };
    if (els.cropTop) els.cropTop.value = "10";
    if (els.cropBottom) els.cropBottom.value = "10";
    if (els.recropButton) {
      els.recropButton.disabled = false;
      els.recropButton.focus();
    }
    const recropHadFocus = document.activeElement === els.recropButton;
    await handleRecrop();
    results.recropReturnsFocusToItsButton =
      recropHadFocus && document.activeElement === els.recropButton;

    // With NO held capture the handler refuses on its own guard, so a disabled
    // button is never the only thing standing between a click and a null read.
    lastCapture = null;
    await handleRecrop();
    results.recropRefusesWithNoHeldCapture =
      (els.captureStatus ? els.captureStatus.textContent : "") === "Capture some bars before re-cropping.";

    // Restore everything this block touched.
    lastCapture = cropPriorHeld;
    cropEls.forEach(function (el, i) { if (el) el.value = cropPrior[i]; });
    if (els.recropButton) els.recropButton.disabled = cropPriorRecropDisabled;
    if (els.captureStatus) els.captureStatus.textContent = cropPriorStatus;
    // Focus too: the row above deliberately focuses the re-crop button, so the
    // page is put back where the caller left it rather than wherever the last
    // drive ended.
    if (cropPriorFocus && typeof cropPriorFocus.focus === "function") cropPriorFocus.focus();
    results.cropSelfTestRestoredState =
      lastCapture === cropPriorHeld &&
      document.activeElement === cropPriorFocus &&
      cropEls.every(function (el, i) { return el ? el.value === cropPrior[i] : true; }) &&
      (els.recropButton ? els.recropButton.disabled === cropPriorRecropDisabled : true);

    // Restore everything this block touched, so the shape the caller reads next
    // is the shape it had before.
    if (capFrom) capFrom.value = capPriorFrom;
    if (capTo) capTo.value = capPriorTo;
    if (els.captureStatus) els.captureStatus.textContent = capPriorStatus;
    state.currentModel = capPriorModel;
    state.currentXml = capPriorXml;
    results.captureSelfTestRestoredState =
      (capFrom ? capFrom.value === capPriorFrom : true) &&
      state.currentModel === capPriorModel &&
      state.currentXml === capPriorXml;

    const statusEl = document.getElementById("status");
    const priorStatus = statusEl ? statusEl.textContent : "";
    const sampleText = "<score-partwise/>";
    const fname = "selftest-" + Date.now() + ".musicxml"; // unique so notify dedup never suppresses it
    const file = new File([sampleText], fname, { type: "text/xml" });
    const loaded = await loadFile(file);
    results.loadFileReadsText = !!loaded && loaded.text === sampleText && loaded.filename === fname;
    const g = getLoaded();
    results.getLoadedReturnsLast = !!g && g.filename === fname && g.text === sampleText;
    results.announcedLoad = !!statusEl && statusEl.textContent.indexOf("Loaded " + fname) === 0;
    if (statusEl) statusEl.textContent = priorStatus; // restore

    // describeOffset carries the new semitone term and states the sharp-preferring
    // spelling whenever a semitone shift is active, and not otherwise.
    results.describeOffsetReset = describeOffset({ octaves: 0, steps: 0, semitones: 0 }) === "Transposition reset to the original pitch.";
    results.describeOffsetSemitones =
      describeOffset({ octaves: 0, steps: 0, semitones: 2 }) === "Transposed up two semitones. Accidentals are spelt with sharps.";
    results.describeOffsetSpellingNoteOnlyWithSemitones =
      describeOffset({ octaves: 1, steps: 0, semitones: 0 }).indexOf("Accidentals are spelt with sharps.") === -1;
    results.describeOffsetCombines =
      describeOffset({ octaves: 1, steps: 0, semitones: -1 }) === "Transposed up one octave and down one semitone. Accidentals are spelt with sharps.";

    // An .mxl round-trips through the loader: build a real compressed MusicXML
    // with JSZip, wrap it in a File with a .mxl name, load it through loadFile,
    // and confirm the inner MusicXML marker comes back. Guarded so it never
    // throws if JSZip or MusicMxl is absent.
    if (typeof JSZip !== "undefined" && window.MusicMxl) {
      try {
        const mark = "APP-MXL-" + Date.now();
        const zip = new JSZip();
        zip.file("META-INF/container.xml",
          '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>' +
          '<rootfile full-path="score.xml"/></rootfiles></container>');
        zip.file("score.xml", "<score-partwise><!--" + mark + "--></score-partwise>");
        const buf = await zip.generateAsync({ type: "arraybuffer" });
        const mxlName = "selftest-" + Date.now() + ".mxl";
        const mxlFile = new File([buf], mxlName, { type: "application/octet-stream" });
        const mxlLoaded = await loadFile(mxlFile);
        results.mxlRoundTripsThroughLoader =
          !!mxlLoaded && mxlLoaded.filename === mxlName &&
          typeof mxlLoaded.text === "string" && mxlLoaded.text.indexOf(mark) !== -1;
      } catch (e) {
        results.mxlRoundTripsThroughLoader = false;
      }
    } else {
      results.mxlRoundTripsThroughLoader = false;
    }

    // withWorkTitle injects the derived title only into the OSMD-bound copy. DOMParser
    // is available in the browser selfTest, so exercise the helper directly: an untitled
    // score gains a work-title carrying the supplied title; an already-titled score is
    // returned byte-for-byte (no reserialisation); a movement-title-only score still
    // gains a work-title; and a malformed string falls back to the original unchanged.
    const wtUntitled = "<score-partwise><part-list/></score-partwise>";
    const wtAdded = withWorkTitle(wtUntitled, "Injected Title");
    results.withWorkTitleAddsTitle =
      wtAdded !== wtUntitled && /<work-title>Injected Title<\/work-title>/.test(wtAdded);
    const wtTitled = '<score-partwise><work><work-title>Kept Title</work-title></work><part-list/></score-partwise>';
    results.withWorkTitleKeepsTitledUnchanged = withWorkTitle(wtTitled, "Ignored") === wtTitled;
    const wtMovementOnly = '<score-partwise><movement-title>Movement</movement-title><part-list/></score-partwise>';
    const wtMovementAdded = withWorkTitle(wtMovementOnly, "From Movement");
    results.withWorkTitleMovementOnlyGainsTitle =
      wtMovementAdded !== wtMovementOnly && /<work-title>From Movement<\/work-title>/.test(wtMovementAdded);
    results.withWorkTitleMalformedUnchanged =
      withWorkTitle("not xml at all", "Nope") === "not xml at all";

    console.table(results);
    return results;
  }

  // Auto-initialise: now if the DOM is ready, else on DOMContentLoaded.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { init, getLoaded, selfTest };
})();

window.MusicApp = MusicApp;
