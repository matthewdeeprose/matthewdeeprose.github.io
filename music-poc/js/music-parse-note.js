// music-parse-note.js
// Per-note extraction service for the Accessible Music proof of concept.
//
// A PURE DATA HELPER for music-parse.js: given a single <note> element it returns
// a plain note model describing only what is intrinsic to that element. It never
// throws, never notifies, and never touches the page DOM beyond reading the
// element handed to it; its selfTest uses DOMParser to build elements in memory.
// The document-and-structure walk (parts, measures, dynamics from sibling
// <direction>s) stays in music-parse.js. Exposed as window.MusicParseNote.

const MusicParseNote = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Text content of the first matching child element under root, trimmed, or
  // null when the element is absent or empty.
  function textOf(root, selector) {
    if (!root) return null;
    const el = root.querySelector(selector);
    if (!el) return null;
    const text = (el.textContent || "").trim();
    return text.length ? text : null;
  }

  // parseInt of the first matching child's text, or null when absent or NaN.
  function intOf(root, selector) {
    const text = textOf(root, selector);
    if (text === null) return null;
    const n = parseInt(text, 10);
    return Number.isNaN(n) ? null : n;
  }

  // Tie state from a note's <tie type="start|stop"> children, as { start, stop }
  // booleans, or null when the note carries no tie.
  function tieOf(noteEl) {
    const ties = noteEl.querySelectorAll("tie");
    let start = false;
    let stop = false;
    for (let i = 0; i < ties.length; i++) {
      const type = ties[i].getAttribute("type");
      if (type === "start") start = true;
      if (type === "stop") stop = true;
    }
    if (!start && !stop) return null;
    return { start: start, stop: stop };
  }

  // Slur state from a note's <slur type="start|stop"> elements (inside
  // <notations>), as { start, stop } booleans, or null when there is no slur.
  function slurOf(noteEl) {
    const slurs = noteEl.querySelectorAll("slur");
    let start = false;
    let stop = false;
    for (let i = 0; i < slurs.length; i++) {
      const type = slurs[i].getAttribute("type");
      if (type === "start") start = true;
      if (type === "stop") stop = true;
    }
    if (!start && !stop) return null;
    return { start: start, stop: stop };
  }

  // Lyric text from a note's first <lyric><text>, trimmed, or null.
  function lyricOf(noteEl) {
    return textOf(noteEl, "lyric text");
  }

  // Augmentation-dot count from a note's <dot/> children, as an integer (1 for a
  // single dot, 2 for a double dot), or null when the note carries no dot. A
  // <dot/> only ever appears as a direct child of <note>, so a plain count is
  // safe here.
  function dotsOf(noteEl) {
    const count = noteEl.querySelectorAll("dot").length;
    return count > 0 ? count : null;
  }

  // Tuplet ratio from a note's <time-modification> (its <actual-notes> in the
  // time of <normal-notes>), as { actualNotes, normalNotes }, or null when the
  // note carries no <time-modification>. 3 in the time of 2 names a triplet.
  function timeModificationOf(noteEl) {
    const tm = noteEl.querySelector("time-modification");
    if (!tm) return null;
    return {
      actualNotes: intOf(tm, "actual-notes"),
      normalNotes: intOf(tm, "normal-notes"),
    };
  }

  // Raw tagNames of every element child under a note's <articulations> (inside
  // <notations>), in document order, e.g. ["staccato"], or null when there are
  // none. Reads every child, not only the named ones, so the model stays
  // faithful and the naming layer picks the ones it knows.
  function articulationsOf(noteEl) {
    const container = noteEl.querySelector("articulations");
    if (!container) return null;
    const names = [];
    for (let i = 0; i < container.children.length; i++) {
      names.push(container.children[i].tagName);
    }
    return names.length ? names : null;
  }

  // Raw tagNames of every element child under a note's <ornaments> (inside
  // <notations>), in document order, e.g. ["trill-mark"], or null when there are
  // none. Same faithful read; the raw "trill-mark" tag is mapped to "trill" by
  // the next layer.
  function ornamentsOf(noteEl) {
    const container = noteEl.querySelector("ornaments");
    if (!container) return null;
    const names = [];
    for (let i = 0; i < container.children.length; i++) {
      names.push(container.children[i].tagName);
    }
    return names.length ? names : null;
  }

  // Extract a single note model from a <note> element. A note is a rest when it
  // contains a <rest>; then step/octave/alter are null. Both rests and pitched
  // notes carry duration and type. A pitched note also carries alter: the
  // semitone alteration from <alter>, null when unmarked, 0 for an explicit
  // natural, 1 for a sharp, -1 for a flat, and 2 or -2 for a double sharp or
  // double flat. chord is true when the note carries a <chord/> child, marking it
  // as the second or later note of a chord (it sounds with the note before it);
  // the first note of a chord, and every melody note, has chord false. A <chord/>
  // only ever appears as a direct child of <note>, so querySelector is safe here.
  // dynamic is always null here: the dynamic is attached by the orchestrator from
  // a sibling <direction>, which only the document-level walk can see. staff is
  // the note's <staff> number as a string ("1", "2"), or null when the score has
  // a single staff and tags no note; the grouping into hands happens later.
  function extractNote(noteEl) {
    const isRest = !!noteEl.querySelector("rest");
    const pitch = noteEl.querySelector("pitch");
    return {
      rest: isRest,
      chord: !!noteEl.querySelector("chord"),
      step: isRest ? null : textOf(pitch, "step"),
      octave: isRest ? null : intOf(pitch, "octave"),
      alter: isRest ? null : intOf(pitch, "alter"),
      duration: intOf(noteEl, "duration"),
      type: textOf(noteEl, "type"),
      tie: tieOf(noteEl),
      slur: slurOf(noteEl),
      lyric: lyricOf(noteEl),
      dots: dotsOf(noteEl),
      timeModification: timeModificationOf(noteEl),
      articulations: articulationsOf(noteEl),
      ornaments: ornamentsOf(noteEl),
      staff: textOf(noteEl, "staff"),
      dynamic: null,
    };
  }

  // Self-test: synchronous and self-contained (no fetch). Builds <note> elements
  // by parsing small MusicXML snippets with DOMParser in memory (never attached
  // to the page) and asserts extractNote against them. console.table()s and
  // returns the results object.
  function selfTest() {
    // Parse a snippet and return its first <note> element, in memory only.
    function noteFrom(xml) {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      return doc.querySelector("note");
    }

    const plainC4 = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch>" +
        "<duration>1</duration><type>eighth</type></note>"
    );
    const rest = noteFrom("<note><rest/><duration>2</duration><type>quarter</type></note>");
    const chordMember = noteFrom(
      "<note><chord/><pitch><step>E</step><octave>4</octave></pitch>" +
        "<duration>1</duration><type>quarter</type></note>"
    );
    const altered = noteFrom(
      "<note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>" +
        "<duration>1</duration><type>quarter</type></note>"
    );
    const tieStart = noteFrom(
      "<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration>" +
        "<tie type=\"start\"/><type>quarter</type></note>"
    );
    const tieStop = noteFrom(
      "<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration>" +
        "<tie type=\"stop\"/><type>quarter</type></note>"
    );
    const slurStart = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><slur type=\"start\" number=\"1\"/></notations></note>"
    );
    const withLyric = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><lyric><text>la</text></lyric></note>"
    );
    const singleDot = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration>" +
        "<type>quarter</type><dot/></note>"
    );
    const doubleDot = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>7</duration>" +
        "<type>quarter</type><dot/><dot/></note>"
    );
    const triplet = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>eighth</type><time-modification><actual-notes>3</actual-notes>" +
        "<normal-notes>2</normal-notes></time-modification></note>"
    );
    const staccato = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><articulations><staccato/></articulations></notations></note>"
    );
    const accent = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><articulations><accent/></articulations></notations></note>"
    );
    const tenuto = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><articulations><tenuto/></articulations></notations></note>"
    );
    const trillMark = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><ornaments><trill-mark/></ornaments></notations></note>"
    );
    const mordent = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><ornaments><mordent/></ornaments></notations></note>"
    );
    const turn = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><notations><ornaments><turn/></ornaments></notations></note>"
    );
    const onStaffTwo = noteFrom(
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>" +
        "<type>quarter</type><staff>2</staff></note>"
    );

    const nC4 = extractNote(plainC4);
    const nRest = extractNote(rest);
    const nChord = extractNote(chordMember);
    const nAlt = extractNote(altered);
    const nTieStart = extractNote(tieStart);
    const nTieStop = extractNote(tieStop);
    const nSlurStart = extractNote(slurStart);
    const nLyric = extractNote(withLyric);
    const nSingleDot = extractNote(singleDot);
    const nDoubleDot = extractNote(doubleDot);
    const nTriplet = extractNote(triplet);
    const nStaccato = extractNote(staccato);
    const nAccent = extractNote(accent);
    const nTenuto = extractNote(tenuto);
    const nTrillMark = extractNote(trillMark);
    const nMordent = extractNote(mordent);
    const nTurn = extractNote(turn);
    const nStaffTwo = extractNote(onStaffTwo);

    const results = {
      hasExtractNote: typeof extractNote === "function",
      hasSelfTest: typeof selfTest === "function",
      plainC4Correct:
        nC4.rest === false &&
        nC4.chord === false &&
        nC4.step === "C" &&
        nC4.octave === 4 &&
        nC4.alter === null &&
        nC4.duration === 1 &&
        nC4.type === "eighth" &&
        nC4.tie === null &&
        nC4.slur === null &&
        nC4.lyric === null &&
        nC4.dynamic === null,
      restShapeCorrect:
        nRest.rest === true &&
        nRest.step === null &&
        nRest.octave === null &&
        nRest.alter === null,
      chordMemberChordTrue: nChord.chord === true && nChord.step === "E",
      alteredAlterOne: nAlt.alter === 1 && nAlt.step === "C",
      tieStartCorrect: !!nTieStart.tie && nTieStart.tie.start === true && nTieStart.tie.stop === false,
      tieStopCorrect: !!nTieStop.tie && nTieStop.tie.stop === true && nTieStop.tie.start === false,
      slurStartCorrect:
        !!nSlurStart.slur && nSlurStart.slur.start === true && nSlurStart.slur.stop === false,
      lyricLa: nLyric.lyric === "la",
      dynamicAlwaysNull:
        nC4.dynamic === null &&
        nRest.dynamic === null &&
        nChord.dynamic === null &&
        nAlt.dynamic === null &&
        nTieStart.dynamic === null &&
        nTieStop.dynamic === null &&
        nSlurStart.dynamic === null &&
        nLyric.dynamic === null,
      singleDotIsOne: nSingleDot.dots === 1,
      doubleDotIsTwo: nDoubleDot.dots === 2,
      noDotIsNull: nC4.dots === null,
      tripletTimeModification:
        !!nTriplet.timeModification &&
        nTriplet.timeModification.actualNotes === 3 &&
        nTriplet.timeModification.normalNotes === 2,
      noTupletTimeModificationNull: nC4.timeModification === null,
      staccatoArticulation:
        Array.isArray(nStaccato.articulations) &&
        nStaccato.articulations.length === 1 &&
        nStaccato.articulations[0] === "staccato",
      accentArticulation:
        Array.isArray(nAccent.articulations) &&
        nAccent.articulations.length === 1 &&
        nAccent.articulations[0] === "accent",
      tenutoArticulation:
        Array.isArray(nTenuto.articulations) &&
        nTenuto.articulations.length === 1 &&
        nTenuto.articulations[0] === "tenuto",
      noArticulationsNull: nC4.articulations === null,
      trillMarkOrnament:
        Array.isArray(nTrillMark.ornaments) &&
        nTrillMark.ornaments.length === 1 &&
        nTrillMark.ornaments[0] === "trill-mark",
      mordentOrnament:
        Array.isArray(nMordent.ornaments) &&
        nMordent.ornaments.length === 1 &&
        nMordent.ornaments[0] === "mordent",
      turnOrnament:
        Array.isArray(nTurn.ornaments) &&
        nTurn.ornaments.length === 1 &&
        nTurn.ornaments[0] === "turn",
      noOrnamentsNull: nC4.ornaments === null,
      plainNoteNewFieldsNull:
        nC4.dots === null &&
        nC4.timeModification === null &&
        nC4.articulations === null &&
        nC4.ornaments === null,
      staffReadsTwo: nStaffTwo.staff === "2",
      plainNoteStaffNull: nC4.staff === null,
    };

    console.table(results);
    return results;
  }

  return { extractNote, selfTest };
})();

window.MusicParseNote = MusicParseNote;
