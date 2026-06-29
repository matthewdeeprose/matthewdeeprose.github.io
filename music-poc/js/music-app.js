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

  // Render every output from one uploaded source. The visual score is handed the raw MusicXML (OSMD
  // parses it itself); every other output is driven by our own parsed model, parsed once here and shared.
  function renderOutputs(xmlText, filename) {
    // Stop any audio still playing from a previous upload before rendering afresh.
    audio.stop();
    // Clear the play-along cursor and note highlight before rendering the new/transposed score.
    playAlong.reset();

    if (els.scoreMount) renderScore.render(xmlText, els.scoreMount);
    else logWarn("Score mount #scoreMount not found; skipping the visual score");

    if (els.exportMount) renderExport.render(xmlText, filename, els.exportMount);
    else logWarn("Export mount #exportMount not found; skipping the download button");

    const model = parser.parse(xmlText);
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
    const suffix = profile === "large-print" ? "-large-print" : "";
    return stem + suffix + ".pdf";
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
      const bytes = await pdf.generate(state.currentModel, state.currentXml, profile);
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
  function handleStandardPdf() { return handlePdf("standard", "tagged"); }
  function handleLargePrintPdf() { return handlePdf("large-print", "large-print"); }

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
      !!window.MusicPdfMarkup && !!window.MusicPdfRasterise && !!window.MusicPdf &&
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

    console.table(results);
    return results;
  }

  // Auto-initialise: now if the DOM is ready, else on DOMContentLoaded.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { init, getLoaded, selfTest };
})();

window.MusicApp = MusicApp;
