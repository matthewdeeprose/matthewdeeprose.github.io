// music-render-summary.js
// Plain-language summary rendering service for the Accessible Music proof of
// concept.
//
// A stateless service, like music-render-text.js: it owns no DOM elements and
// caches nothing. It exposes a single render(model, mountEl) method that builds
// a short, plain-language overview of a parsed model — how many parts and bars,
// the key and time signature, the pitch range, and the dominant note value —
// into a single <p> in the given mount element, plus a selfTest(). Like the text
// renderer it is SYNCHRONOUS and it never notifies: on bad input it logs and
// returns false. It does NOT parse and does NOT render per-note detail; it reads
// aggregate facts from the model, from MusicModelWalk and from MusicNames, built
// with createElement + textContent so text is never injected unescaped. Exposed
// as window.MusicRenderSummary.

const MusicRenderSummary = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side model walking: route through the shared MusicModelWalk when
  // present, otherwise fall back to neutral results so this file never throws if
  // the model-walk layer is absent.
  const walk = window.MusicModelWalk || {
    pitchRange() { return null; },
    noteValueCounts() { return {}; },
    hasLyrics() { return false; },
  };

  // Consumer-side naming: route through the shared MusicNames when present,
  // otherwise fall back to a neutral result so this file never throws if the
  // names layer is absent.
  const names = window.MusicNames || {
    keySignatureName() { return null; },
  };

  // Find the note-value name with the highest count in a counts object, or null
  // when the object is empty. Ties are resolved arbitrarily (first seen wins).
  function dominantNoteValue(counts) {
    let dominant = null;
    let best = -Infinity;
    for (const name in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, name) && counts[name] > best) {
        best = counts[name];
        dominant = name;
      }
    }
    return dominant;
  }

  // Build a plain-language summary of model into mountEl. Synchronous; returns
  // true on success and false on any failure; NEVER throws. There is no
  // notification — the rendered summary is itself the feedback.
  function render(model, mountEl) {
    // Guard: we need a model with a parts array to summarise.
    if (!model || !Array.isArray(model.parts)) {
      logError("Cannot render summary: model is missing or has no parts array");
      return false;
    }

    // Guard: we need a mount element to build into.
    if (!mountEl) {
      logError("Cannot render summary: no mount element supplied");
      return false;
    }

    // Clear any previous render from the mount before building afresh.
    mountEl.replaceChildren();

    // Each clause is only added when its underlying data exists.
    const sentences = [];

    const parts = model.parts.length;
    const measures = model.parts[0] && model.parts[0].measures ? model.parts[0].measures.length : 0;
    sentences.push(
      "This piece has " + parts + (parts === 1 ? " part" : " parts") + " across " +
        measures + (measures === 1 ? " bar." : " bars.")
    );

    const keyName = model.key ? names.keySignatureName(model.key.fifths) : null;
    const timeText = model.time ? model.time.beats + "/" + model.time.beatType : null;
    if (keyName && timeText) sentences.push("It is in " + keyName + " and " + timeText + " time.");
    else if (keyName) sentences.push("It is in " + keyName + ".");
    else if (timeText) sentences.push("It is in " + timeText + " time.");

    if (model.tempo !== null && model.tempo !== undefined) {
      sentences.push("The tempo is " + model.tempo + " beats per minute.");
    }

    const range = walk.pitchRange(model);
    if (range && range.lowest && range.highest) {
      if (range.lowest === range.highest) sentences.push("All notes are at " + range.lowest + ".");
      else sentences.push("The pitch ranges from " + range.lowest + " to " + range.highest + ".");
    }

    const counts = walk.noteValueCounts(model);
    const dominant = dominantNoteValue(counts);
    if (dominant) sentences.push("The notes are mostly " + dominant + "s.");

    // Structural overview: the repeated section, key change and clef change are
    // the navigation cues a blind reader most needs flagged. Each reads a
    // model-level flag the parser sets; the specific pitch and clef stay in the
    // note list, so the summary keeps its aggregate voice.
    if (model.hasRepeat) sentences.push("The piece contains a repeated section.");
    if (model.hasKeyChange) sentences.push("The key changes during the piece.");
    if (model.hasClefChange) sentences.push("The clef changes during the piece.");
    if (model.staves > 1) sentences.push("The piece is written on " + model.staves + " staves.");

    if (walk.hasLyrics(model)) sentences.push("It has lyrics.");

    const summary = sentences.join(" ");

    const paragraph = document.createElement("p");
    paragraph.textContent = summary;
    mountEl.appendChild(paragraph);

    logInfo("Rendered summary into #" + (mountEl.id || "mount"));
    return true;
  }

  // Self-test: synchronous and self-contained. Builds the project sample model
  // into a DETACHED temp <div> (never attached to the page) and asserts the
  // resulting summary. Needs MusicModelWalk loaded for real facts and MusicNames
  // loaded for the key name. console.table()s and returns the results object.
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

    // A detached temp mount; never attached to the page.
    const temp = document.createElement("div");
    const returnsTrue = render(MODEL, temp) === true;

    const paragraph = temp.querySelector("p");
    const text = paragraph ? paragraph.textContent : "";

    // Rich model (tempo 120 and a lyric) to check the two new summary sentences.
    const RICH_MODEL = {
      workTitle: "Accessible Music PoC rich sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      tempo: 120,
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [
            {
              number: "1",
              notes: [
                { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "f", lyric: "la", slur: { start: true, stop: false }, tie: null },
                { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: { start: false, stop: true }, tie: null },
                { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: null, tie: { start: true, stop: false } },
                { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: null, tie: { start: false, stop: true } },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, step: "G", octave: 4, duration: 4, type: "whole", dynamic: null, lyric: null, slur: null, tie: null },
              ],
            },
          ],
        },
      ],
    };
    const tempRich = document.createElement("div");
    render(RICH_MODEL, tempRich);
    const richParagraph = tempRich.querySelector("p");
    const richText = richParagraph ? richParagraph.textContent : "";

    // Structure model (with the model-level hasRepeat flag) to check the new
    // repeated-section clause. The plain MODEL has no flag, so it must not
    // mention a repeat.
    const STRUCTURE_MODEL = {
      workTitle: "Accessible Music PoC structure sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      hasRepeat: true,
      hasKeyChange: true,
      hasClefChange: true,
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" }] },
            { number: "2", clefChange: null, keyChange: { fifths: 1 }, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter" }] },
          ],
        },
      ],
    };
    const tempStruct = document.createElement("div");
    render(STRUCTURE_MODEL, tempStruct);
    const structParagraph = tempStruct.querySelector("p");
    const structText = structParagraph ? structParagraph.textContent : "";

    // Stage 14: a two-staff model to check the staves clause. A single-staff model
    // has no staves field, so model.staves > 1 is false and no clause appears.
    const PIANO_SUMMARY_MODEL = {
      workTitle: "Accessible Music PoC piano sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      staves: 2,
      parts: [{ id: "P1", name: "Piano", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: "1" },
        { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter", staff: "2" },
      ] }] }],
    };
    const tempPiano = document.createElement("div");
    render(PIANO_SUMMARY_MODEL, tempPiano);
    const pianoSummaryText = tempPiano.querySelector("p") ? tempPiano.querySelector("p").textContent : "";

    const results = {
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      returnsTrue: returnsTrue,
      producesParagraph: paragraph !== null,
      mentionsParts: text.indexOf("1 part") !== -1 && text.indexOf("2 bars") !== -1,
      mentionsKey: text.indexOf("C major") !== -1,
      mentionsTime: text.indexOf("4/4 time") !== -1,
      mentionsRange: text.indexOf("C4 to C5") !== -1,
      mentionsRhythm: text.indexOf("mostly crotchets") !== -1,
      richMentionsTempo: richText.indexOf("120 beats per minute") !== -1,
      richMentionsLyrics: richText.indexOf("It has lyrics") !== -1,
      simpleNoTempo: text.indexOf("beats per minute") === -1,
      simpleNoLyrics: text.toLowerCase().indexOf("lyric") === -1,
      handlesNullModel: render(null, document.createElement("div")) === false,
      handlesNoMount: render(MODEL, null) === false,
      structMentionsRepeat: structText.indexOf("The piece contains a repeated section.") !== -1,
      simpleNoRepeatClause: text.indexOf("repeated section") === -1,
      structMentionsKeyChange: structText.indexOf("The key changes during the piece.") !== -1,
      structMentionsClefChange: structText.indexOf("The clef changes during the piece.") !== -1,
      simpleNoKeyChangeClause: text.indexOf("key changes during") === -1,
      simpleNoClefChangeClause: text.indexOf("clef changes during") === -1,
      pianoMentionsStaves: pianoSummaryText.indexOf("The piece is written on 2 staves.") !== -1,
      simpleNoStavesClause: text.indexOf("staves") === -1,
    };

    console.table(results);
    return results;
  }

  return { render, selfTest };
})();

window.MusicRenderSummary = MusicRenderSummary;
