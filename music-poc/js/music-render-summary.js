// music-render-summary.js
// Plain-language summary rendering service for the Accessible Music proof of
// concept.
//
// A stateless service, like music-render-text.js: it owns no DOM elements and
// caches nothing. It exposes render(model, mountEl), which builds a short,
// plain-language overview of a parsed model — how many parts and bars, the key
// and time signature, the pitch range, and the dominant note value — into a
// single <p> in the given mount element; summaryText(model), which returns that
// same prose as a STRING for a consumer that needs the words rather than the
// markup (the PDF page-image alt text); and a selfTest(). Both run through one
// private sentence builder, so the two can never disagree. Like the text
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
  // Every method this module calls must be declared here. The stub exists so a
  // page missing the real module renders a degraded summary rather than
  // throwing, and a method called but not stubbed defeats that. Each returns the
  // value that means "omit this clause": a null helper result routes into the
  // clause's own absent branch rather than into a special case.
  const walk = window.MusicModelWalk || {
    pitchRange() { return null; },
    noteValueCounts() { return {}; },
    hasLyrics() { return false; },
    dynamicsOverview() { return null; },
  };

  // Consumer-side naming: route through the shared MusicNames when present,
  // otherwise fall back to a neutral result so this file never throws if the
  // names layer is absent.
  // Every method this module calls must be declared here. The stub exists so a
  // page missing the real module renders a degraded summary rather than
  // throwing, and a method called but not stubbed defeats that. Each returns the
  // value that means "omit this clause": a null helper result routes into the
  // clause's own absent branch rather than into a special case.
  const names = window.MusicNames || {
    keySignatureName() { return null; },
    noteValueName() { return null; },
  };

  // A meter's denominator as a note-type string, so the beat can be NAMED. This
  // maps a NUMBER to a type string, which is a different job from naming a type,
  // and music-names holds the naming. It lives here rather than there because one
  // file per stage is a hard rule and this stage's file is this one.
  const BEAT_UNIT_TYPES = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th", 32: "32nd" };

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

  // summarySentences(model) → the ordered sentence array, or null when the model
  // cannot be summarised. PRIVATE and PURE: it touches no DOM, so the same prose
  // can be rendered into a mount or handed back as a string with no chance of the
  // two drifting apart. Both render() and summaryText() below run through it, and
  // it is the ONLY place a clause is built.
  function summarySentences(model) {
    // Guard: we need a model with a parts array to summarise.
    if (!model || !Array.isArray(model.parts)) {
      return null;
    }

    // Each clause is only added when its underlying data exists.
    const sentences = [];

    const parts = model.parts.length;
    const measures = model.parts[0] && model.parts[0].measures ? model.parts[0].measures.length : 0;
    sentences.push(
      "This piece has " + parts + (parts === 1 ? " part" : " parts") + " across " +
        measures + (measures === 1 ? " bar." : " bars.")
    );

    const keyName = model.key ? names.keySignatureName(model.key.fifths) : null;
    // The meter is spoken only when its denominator NAMES A NOTE VALUE. A number
    // that is not a note value — 3/6, say — parses cleanly and reaches here intact,
    // because intOf validates that the text is an integer and nothing validates
    // what the integer MEANS. So the test is a whitelist against BEAT_UNIT_TYPES,
    // the same closed set the tempo naming below already relies on, rather than a
    // range check: the valid denominators are a fixed list, not an interval.
    // The key is still spoken. A meter that cannot exist is worse than no meter,
    // and dropping the whole sentence would lose a fact the file gets right.
    // The tempo sentence needs no separate guard — it reads the same table, so it
    // already falls back to plain "beats per minute" on the same denominators.
    const meterIsNamed =
      !!model.time && Object.prototype.hasOwnProperty.call(BEAT_UNIT_TYPES, model.time.beatType);
    if (model.time && !meterIsNamed) {
      logWarn("Meter denominator " + model.time.beatType + " is not a note value; omitting the time signature");
    }
    const timeText = meterIsNamed ? model.time.beats + "/" + model.time.beatType : null;
    if (keyName && timeText) sentences.push("It is in " + keyName + " and " + timeText + " time.");
    else if (keyName) sentences.push("It is in " + keyName + ".");
    else if (timeText) sentences.push("It is in " + timeText + " time.");

    // The tempo is spoken against the METER's beat unit, so a non-quarter beat is
    // not labelled plain "beats per minute". model.tempo itself is untouched: it
    // stays the normalised quarter-notes-per-minute number, so playback and MIDI
    // still run at the true value and only the spoken label changes. The unit
    // comes from the meter rather than from model.tempoMark, because two of the
    // three corpus files carry no printed metronome and their tempoMark is null.
    // KNOWN LIMIT: a compound meter reads wrongly. In 6/8 the felt beat is a dotted
    // crotchet, and beatType alone gives a quaver. No file in the corpus is compound,
    // so this is recorded rather than solved.
    if (model.tempo !== null && model.tempo !== undefined) {
      const beatType = model.time ? model.time.beatType : null;
      const beatUnitName = names.noteValueName(BEAT_UNIT_TYPES[beatType]);
      if (beatUnitName) {
        // A beat is 4 / beatType quarter notes, so the beats per minute against
        // that unit is the quarter-note tempo scaled by beatType / 4.
        const beatsPerMinute = (model.tempo * beatType) / 4;
        if (Number.isInteger(beatsPerMinute)) {
          sentences.push("The tempo is " + beatsPerMinute + " " + beatUnitName + " beats per minute.");
        } else {
          sentences.push("The tempo is about " + Math.round(beatsPerMinute) + " " + beatUnitName + " beats per minute.");
        }
      } else {
        // No meter, an unmapped beat type, or no name for it: the existing wording
        // stands. A file with no meter is not an error, so nothing is logged.
        sentences.push("The tempo is " + model.tempo + " beats per minute.");
      }
    }

    const range = walk.pitchRange(model);
    if (range && range.lowest && range.highest) {
      if (range.lowest === range.highest) sentences.push("All notes are at " + range.lowest + ".");
      else sentences.push("The pitch ranges from " + range.lowest + " to " + range.highest + ".");
    }

    const counts = walk.noteValueCounts(model);
    const dominant = dominantNoteValue(counts);
    if (dominant) sentences.push("The notes are mostly " + dominant + "s.");

    // Dynamics. Shaping STARTS are voiced and stops are not, because a start is a
    // change a listener hears, and Palestrina's seven crescendo starts have no
    // stops at all, so voicing stops would report zero on a file that plainly
    // does crescendo.
    const dynamics = walk.dynamicsOverview(model);
    if (dynamics) {
      const starts = dynamics.shapingStarts;
      const changes = starts + (starts === 1 ? " gradual change in volume" : " gradual changes in volume");
      if (dynamics.softest && dynamics.loudest) {
        const range = dynamics.softest === dynamics.loudest
          ? "The only dynamic marking is " + dynamics.softest
          : "The dynamics run from " + dynamics.softest + " to " + dynamics.loudest;
        sentences.push(starts > 0 ? range + ", with " + changes + "." : range + ".");
      } else if (starts > 0) {
        sentences.push("The music has " + changes + ".");
      }
    }

    // Structural overview: the repeated section, key change and clef change are
    // the navigation cues a blind reader most needs flagged. Each reads a
    // model-level flag the parser sets; the specific pitch and clef stay in the
    // note list, so the summary keeps its aggregate voice.
    // Count-neutral: the model holds a boolean and no count of repeated sections
    // anywhere, so a count-bearing phrase would need a number that does not exist.
    // "repeated music" reads true on one repeat and on many.
    if (model.hasRepeat) sentences.push("The piece contains repeated music.");
    if (model.hasKeyChange) sentences.push("The key changes during the piece.");
    if (model.hasClefChange) sentences.push("The clef changes during the piece.");
    if (model.staves > 1) sentences.push("The piece is written on " + model.staves + " staves.");

    if (walk.hasLyrics(model)) sentences.push("It has lyrics.");

    return sentences;
  }

  // summaryText(model) → the plain-language summary as a STRING, exactly the prose
  // render() puts in its <p>, or "" when the model cannot be summarised. PUBLIC and
  // DOM-FREE, so a consumer that needs the words rather than the markup — the PDF
  // orchestrator's page-image alt text, above all — takes them from here instead of
  // rendering into a detached div and scraping the <p> back out. Synchronous and it
  // NEVER throws; a bad model logs and returns the empty string, which every caller
  // can treat as "no summary available" without a special case.
  function summaryText(model) {
    const sentences = summarySentences(model);
    if (!sentences) {
      logError("Cannot build summary text: model is missing or has no parts array");
      return "";
    }
    return sentences.join(" ");
  }

  // Build a plain-language summary of model into mountEl. Synchronous; returns
  // true on success and false on any failure; NEVER throws. There is no
  // notification — the rendered summary is itself the feedback. The prose comes
  // from summarySentences, the same source summaryText reads, so the rendered
  // paragraph and the string handed to the PDF can never say different things.
  function render(model, mountEl) {
    // Guard: we need a model with a parts array to summarise. Checked here as
    // well as inside summarySentences so the failure keeps its own message.
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

    const summary = summaryText(model);

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

    // Stage 69 fixtures. Render a model into a fresh detached mount and return its
    // summary text, so each new row below reads as one assertion rather than
    // repeating the mount dance seventeen times over.
    function summaryTextOf(model) {
      const mount = document.createElement("div");
      render(model, mount);
      const built = mount.querySelector("p");
      return built ? built.textContent : "";
    }

    // dynamicsOverview counts the LENGTH of each shaping endpoint array and never
    // reads an entry, so n starts is n entries of any shape.
    function startsOf(count) {
      const starts = [];
      for (let i = 0; i < count; i += 1) starts.push({ type: "crescendo" });
      return starts;
    }

    // One plain crotchet is enough for every row below: none asserts on pitch,
    // rhythm or lyrics, so a one-note bar keeps each model readable. Built in the
    // compressed literal style PIANO_SUMMARY_MODEL uses.
    function partsOf(notes) {
      return [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: notes }] }];
    }
    const ONE_CROTCHET = { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" };

    // M2-01: the meter supplies the beat unit, so each fixture varies beatType.
    const TEMPO_CROTCHET_MODEL = { time: { beats: 3, beatType: 4 }, tempo: 76, parts: partsOf([ONE_CROTCHET]) };
    const TEMPO_MINIM_MODEL = { time: { beats: 4, beatType: 2 }, tempo: 200, parts: partsOf([ONE_CROTCHET]) };
    // 75 quarter notes per minute against a minim beat is 37.5, which must round.
    const TEMPO_ROUNDED_MODEL = { time: { beats: 4, beatType: 2 }, tempo: 75, parts: partsOf([ONE_CROTCHET]) };
    const TEMPO_NO_METER_MODEL = { time: null, tempo: 76, parts: partsOf([ONE_CROTCHET]) };
    // A beatType of 6 is not a note value and is absent from BEAT_UNIT_TYPES.
    const TEMPO_ODD_BEAT_TYPE_MODEL = { time: { beats: 3, beatType: 6 }, tempo: 76, parts: partsOf([ONE_CROTCHET]) };
    const TEMPO_ABSENT_MODEL = { time: { beats: 3, beatType: 4 }, tempo: null, parts: partsOf([ONE_CROTCHET]) };

    // Stage 79: a meter whose denominator is not a note value. It carries a key and
    // a tempo so one model can exercise all three rows — that the key survives, that
    // the time clause is dropped, and that the tempo sentence needed no change.
    const METER_INVALID_MODEL = { key: { fifths: 0 }, time: { beats: 3, beatType: 6 }, tempo: 76, parts: partsOf([ONE_CROTCHET]) };

    // M1-05: dynamics and shaping, one model per branch of the clause.
    const DYN_RANGE_SHAPING_MODEL = { parts: partsOf([
      { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "p", shaping: { starts: startsOf(13), stops: [] } },
      { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", dynamic: "f" },
    ]) };
    const DYN_SINGLE_SHAPING_MODEL = { parts: partsOf([
      { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "mf", shaping: { starts: startsOf(4), stops: [] } },
    ]) };
    const DYN_RANGE_NO_SHAPING_MODEL = { parts: partsOf([
      { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "p" },
      { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", dynamic: "f" },
    ]) };
    // Palestrina's shape: shaping starts with no printed dynamic marking anywhere.
    const DYN_SHAPING_ONLY_MODEL = { parts: partsOf([
      { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", shaping: { starts: startsOf(7), stops: [] } },
    ]) };
    const DYN_ONE_CHANGE_MODEL = { parts: partsOf([
      { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", shaping: { starts: startsOf(1), stops: [] } },
    ]) };
    const DYN_NONE_MODEL = { parts: partsOf([ONE_CROTCHET]) };

    const tempoCrotchetText = summaryTextOf(TEMPO_CROTCHET_MODEL);
    const tempoMinimText = summaryTextOf(TEMPO_MINIM_MODEL);
    const tempoRoundedText = summaryTextOf(TEMPO_ROUNDED_MODEL);
    const tempoNoMeterText = summaryTextOf(TEMPO_NO_METER_MODEL);
    const tempoOddBeatTypeText = summaryTextOf(TEMPO_ODD_BEAT_TYPE_MODEL);
    const tempoAbsentText = summaryTextOf(TEMPO_ABSENT_MODEL);
    const meterInvalidText = summaryTextOf(METER_INVALID_MODEL);
    const dynRangeShapingText = summaryTextOf(DYN_RANGE_SHAPING_MODEL);
    const dynSingleShapingText = summaryTextOf(DYN_SINGLE_SHAPING_MODEL);
    const dynRangeNoShapingText = summaryTextOf(DYN_RANGE_NO_SHAPING_MODEL);
    const dynShapingOnlyText = summaryTextOf(DYN_SHAPING_ONLY_MODEL);
    const dynOneChangeText = summaryTextOf(DYN_ONE_CHANGE_MODEL);
    const dynNoneText = summaryTextOf(DYN_NONE_MODEL);

    // The walk and names aliases are captured at LOAD, so swapping
    // window.MusicModelWalk now would prove nothing: this module would keep using
    // the object it already holds. Stage the METHOD on the captured object and
    // restore it in a finally, the pattern music-render-phrase.js uses for
    // harmonyStubDescriptorSafe, including its companion restore-proof row.
    let stubDynamicsOverviewNoClause = false;
    const realDynamicsOverview = walk.dynamicsOverview;
    try {
      walk.dynamicsOverview = function () { return null; };
      const stubbedDynamicsText = summaryTextOf(DYN_RANGE_SHAPING_MODEL);
      stubDynamicsOverviewNoClause =
        stubbedDynamicsText.toLowerCase().indexOf("dynamic") === -1 &&
        stubbedDynamicsText.toLowerCase().indexOf("gradual") === -1;
    } catch (e) {
      stubDynamicsOverviewNoClause = false;
    } finally {
      walk.dynamicsOverview = realDynamicsOverview;
    }

    // Asserted on the TEMPO sentence alone, not on the absence of "crotchet"
    // anywhere in the text: music-model-walk reads noteValueName off the same
    // shared MusicNames object, so staging it also silences the dominant-note-value
    // clause, and a whole-text check would pass for the wrong reason.
    let stubNoteValueNameFallsBackToPlainTempo = false;
    const realNoteValueName = names.noteValueName;
    try {
      names.noteValueName = function () { return null; };
      const stubbedTempoText = summaryTextOf(TEMPO_CROTCHET_MODEL);
      stubNoteValueNameFallsBackToPlainTempo =
        stubbedTempoText.indexOf("The tempo is 76 beats per minute.") !== -1 &&
        stubbedTempoText.indexOf("The tempo is 76 crotchet") === -1;
    } catch (e) {
      stubNoteValueNameFallsBackToPlainTempo = false;
    } finally {
      names.noteValueName = realNoteValueName;
    }

    // Without this row a staged swap can leak into every row after it. Identity
    // proves the restore ran; the two re-renders prove the full sentences came back
    // rather than the module being left in a degraded state.
    const stubSwapsRestored =
      walk.dynamicsOverview === realDynamicsOverview &&
      names.noteValueName === realNoteValueName &&
      summaryTextOf(DYN_RANGE_SHAPING_MODEL).indexOf("The dynamics run from piano to forte, with 13 gradual changes in volume.") !== -1 &&
      summaryTextOf(TEMPO_CROTCHET_MODEL).indexOf("The tempo is 76 crotchet beats per minute.") !== -1;

    const results = {
      hasRender: typeof render === "function",
      hasSummaryText: typeof summaryText === "function",
      hasSelfTest: typeof selfTest === "function",
      returnsTrue: returnsTrue,
      producesParagraph: paragraph !== null,
      mentionsParts: text.indexOf("1 part") !== -1 && text.indexOf("2 bars") !== -1,
      mentionsKey: text.indexOf("C major") !== -1,
      mentionsTime: text.indexOf("4/4 time") !== -1,
      mentionsRange: text.indexOf("C4 to C5") !== -1,
      mentionsRhythm: text.indexOf("mostly crotchets") !== -1,
      // Wording updated at Stage 69. The row's subject is unchanged; only the string
      // it pins moved, because the clause it asserts was rephrased in that stage.
      richMentionsTempo: richText.indexOf("120 crotchet beats per minute") !== -1,
      richMentionsLyrics: richText.indexOf("It has lyrics") !== -1,
      simpleNoTempo: text.indexOf("beats per minute") === -1,
      simpleNoLyrics: text.toLowerCase().indexOf("lyric") === -1,
      handlesNullModel: render(null, document.createElement("div")) === false,
      handlesNoMount: render(MODEL, null) === false,
      // Wording updated at Stage 69. The row's subject is unchanged; only the string
      // it pins moved, because the clause it asserts was rephrased in that stage.
      structMentionsRepeat: structText.indexOf("The piece contains repeated music.") !== -1,
      // Repointed at Stage 69. The needle was "repeated section", which that stage
      // removed from the module, so the row could no longer fail and measured nothing.
      // A zero-count check needs a phrase the code can still produce.
      simpleNoRepeatClause: text.indexOf("repeated music") === -1,
      structMentionsKeyChange: structText.indexOf("The key changes during the piece.") !== -1,
      structMentionsClefChange: structText.indexOf("The clef changes during the piece.") !== -1,
      simpleNoKeyChangeClause: text.indexOf("key changes during") === -1,
      simpleNoClefChangeClause: text.indexOf("clef changes during") === -1,
      pianoMentionsStaves: pianoSummaryText.indexOf("The piece is written on 2 staves.") !== -1,
      simpleNoStavesClause: text.indexOf("staves") === -1,
      // Stage 69, M2-01: the tempo names the meter's beat unit.
      tempoNamesCrotchetBeat: tempoCrotchetText.indexOf("The tempo is 76 crotchet beats per minute.") !== -1,
      tempoNamesMinimBeat: tempoMinimText.indexOf("The tempo is 100 minim beats per minute.") !== -1,
      tempoRoundsWithAbout:
        tempoRoundedText.indexOf("The tempo is about ") !== -1 &&
        tempoRoundedText.indexOf("The tempo is about 38 minim beats per minute.") !== -1,
      tempoFallsBackWithoutMeter: tempoNoMeterText.indexOf("The tempo is 76 beats per minute.") !== -1,
      tempoFallsBackOnOddBeatType: tempoOddBeatTypeText.indexOf("The tempo is 76 beats per minute.") !== -1,
      tempoAbsentNoSentence: tempoAbsentText.toLowerCase().indexOf("tempo") === -1,
      // Stage 69, M3-01: the repeat clause carries no count.
      repeatReadsCountNeutral:
        structText.indexOf("The piece contains repeated music.") !== -1 &&
        structText.indexOf("a repeated section") === -1,
      repeatAbsentNoSentence: text.toLowerCase().indexOf("repeat") === -1,
      // Stage 69, M1-05: the dynamics clause, one row per branch.
      dynamicsRangeWithShaping: dynRangeShapingText.indexOf("The dynamics run from piano to forte, with 13 gradual changes in volume.") !== -1,
      dynamicsSingleWithShaping: dynSingleShapingText.indexOf("The only dynamic marking is mezzo-forte, with 4 gradual changes in volume.") !== -1,
      dynamicsRangeNoShaping:
        dynRangeNoShapingText.indexOf("The dynamics run from piano to forte.") !== -1 &&
        dynRangeNoShapingText.indexOf("gradual") === -1,
      dynamicsShapingOnly: dynShapingOnlyText.indexOf("The music has 7 gradual changes in volume.") !== -1,
      dynamicsSingularOneChange:
        dynOneChangeText.indexOf("The music has 1 gradual change in volume.") !== -1 &&
        dynOneChangeText.indexOf("gradual changes") === -1,
      dynamicsNullNoSentence:
        dynNoneText.toLowerCase().indexOf("dynamic") === -1 &&
        dynNoneText.toLowerCase().indexOf("gradual") === -1,
      // Stage 79: the meter is spoken only when its denominator names a note value.
      // The valid row reads the WHOLE clause on the plain MODEL rather than a
      // fragment, so it fails if the wording moves and not only if the meter goes.
      meterValidReadsKeyAndTime: text.indexOf("It is in C major and 4/4 time.") !== -1,
      meterInvalidKeyWithoutTime:
        meterInvalidText.indexOf("It is in C major.") !== -1 &&
        meterInvalidText.indexOf("/6") === -1 &&
        meterInvalidText.indexOf(" time.") === -1,
      // The tempo sentence was left unchanged: BEAT_UNIT_TYPES[6] is undefined,
      // noteValueName(undefined) is null, and the existing else branch already
      // speaks the plain wording. This row pins that it stays true beside the new guard.
      meterInvalidTempoStaysPlain: meterInvalidText.indexOf("The tempo is 76 beats per minute.") !== -1,
      // Stage 69: the two captured-alias stubs, staged on the method, and the
      // companion row proving both swaps were undone before any later read.
      stubDynamicsOverviewNoClause: stubDynamicsOverviewNoClause,
      stubNoteValueNameFallsBackToPlainTempo: stubNoteValueNameFallsBackToPlainTempo,
      stubSwapsRestored: stubSwapsRestored,

      // Stage 82: the summary prose as a STRING. The identity rows are what make
      // the shared sentence builder provable — a summaryText that built its own
      // prose could pass every wording row above and still drift from the <p>.
      // Asserted on THREE models, not one, so a function returning a constant or
      // reading only the first clause cannot satisfy them.
      summaryTextMatchesRenderedParagraph: summaryText(MODEL) === text,
      summaryTextMatchesRichParagraph: summaryText(RICH_MODEL) === richText,
      summaryTextMatchesStructureParagraph: summaryText(STRUCTURE_MODEL) === structText,
      // The POSITIVE CANARY for the two degradation rows below: without it, a
      // summaryText that returned "" for everything would pass them both.
      summaryTextNonEmptyOnGoodModel: summaryText(MODEL).length > 0,
      // Degradation: a bad model yields the empty string rather than throwing.
      // Both shapes the guard tests are exercised, because "no model at all" and
      // "a model with no parts array" reach the guard by different clauses.
      summaryTextNullModelEmpty: summaryText(null) === "",
      summaryTextNoPartsArrayEmpty: summaryText({ workTitle: "No parts" }) === "",
      // summaryText must not touch the page: it is the DOM-free half of the
      // module, and the PDF orchestrator calls it precisely to avoid a mount.
      summaryTextRendersNothing:
        (function () {
          const before = document.body ? document.body.childElementCount : 0;
          summaryText(MODEL);
          return document.body ? document.body.childElementCount === before : true;
        })(),
    };

    console.table(results);
    return results;
  }

  return { render, summaryText, selfTest };
})();

window.MusicRenderSummary = MusicRenderSummary;
