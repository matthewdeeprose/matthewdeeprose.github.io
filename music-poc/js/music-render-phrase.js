// music-render-phrase.js
// Per-event phrase composition for the Accessible Music proof of concept.
//
// A PURE STRING SERVICE, the phrasing half of the text renderer: it turns one
// event (a group from MusicModelWalk.groupNotes) into its spoken phrase and owns
// no DOM. Unlike the render-* renderers it produces strings, not nodes, so it
// sits with the pure layer alongside model-walk: it never touches the page DOM,
// never throws, and never notifies. js/music-render-text.js assembles the <ol>
// and <li> and asks this module for each event's text. Splitting the phrasing out
// keeps a single definition of how an event reads, so the note list cannot drift
// from itself as later stages add more symbols. It consumes
// MusicModelWalk.describeNote for descriptors. Exposed as window.MusicRenderPhrase.

const MusicRenderPhrase = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side model walking: route through the shared MusicModelWalk when
  // present, otherwise fall back to a neutral descriptor so this file never
  // throws if the model-walk layer is absent.
  const walk = window.MusicModelWalk || { describeNote() { return { isRest: false, pitch: null, value: null }; } };

  // Compose the comma-separated extras for one note from its descriptor, plus the
  // next note so a slur can name where it goes: tuplet, articulations, ornaments,
  // then dynamic, tie, slur, lyric, in that order. The slur is named from its
  // starting note only. Returns an array of strings (possibly empty). Shared by the
  // single-note and chord paths so a chord reads the same extras from its head note.
  function extrasOf(d, nextNote) {
    const extras = [];
    if (d.tuplet) extras.push(d.tuplet);
    if (d.articulations) for (const a of d.articulations) extras.push(a);
    if (d.ornaments) for (const o of d.ornaments) extras.push(o);
    if (d.dynamic) extras.push(d.dynamic);
    if (d.tie && d.tie.start && d.tie.stop) extras.push("tied");
    else if (d.tie && d.tie.start) extras.push("tied to the next note");
    else if (d.tie && d.tie.stop) extras.push("tied from the previous note");
    if (d.slur && d.slur.start) {
      const nd = nextNote ? walk.describeNote(nextNote) : null;
      extras.push(nd && nd.pitch ? "slurred to " + nd.pitch : "slurred");
    }
    if (d.lyric) extras.push("lyric '" + d.lyric + "'");
    return extras;
  }

  // Compose the spoken text for one single note (or rest) from its descriptor,
  // plus the next note for the slur target. Order: pitch and value, then the
  // extras. This is the pre-grouping behaviour unchanged, so a melody note reads
  // exactly as it always has.
  function singleText(note, nextNote) {
    const d = walk.describeNote(note);

    let base;
    if (d.isRest) {
      base = d.value ? "rest " + d.value : "rest";
    } else if (d.pitch && d.value) {
      base = d.pitch + " " + d.value;
    } else if (d.pitch) {
      base = d.pitch;
    } else if (d.value) {
      base = d.value;
    } else {
      base = "";
    }

    const extras = extrasOf(d, nextNote);

    if (!base) return extras.join(", ");
    return extras.length ? base + ", " + extras.join(", ") : base;
  }

  // Join a chord's pitch labels as natural speech: "C4, E4 and G4". Expects two or
  // more labels; phraseOf guarantees that before calling.
  function chordPitchList(pitches) {
    if (pitches.length === 2) return pitches[0] + " and " + pitches[1];
    return pitches.slice(0, -1).join(", ") + " and " + pitches[pitches.length - 1];
  }

  // phraseOf(group, nextHead): pure; NEVER throws. The single public entry. Turns
  // one event (a group from MusicModelWalk.groupNotes) into its spoken phrase,
  // with nextHead (the next event's head note, or null) supplying the slur target.
  // A single-note group reads exactly as before grouping; a chord names its
  // pitches together with the shared value ("C4, E4 and G4 crotchet") then the
  // head note's extras. An empty or non-array group returns "".
  function phraseOf(group, nextHead) {
    const list = Array.isArray(group) ? group : [];
    if (list.length === 0) return "";
    if (list.length === 1) return singleText(list[0], nextHead);

    const head = list[0];
    const dHead = walk.describeNote(head);
    const pitches = [];
    for (let i = 0; i < list.length; i++) {
      const p = walk.describeNote(list[i]).pitch;
      if (p) pitches.push(p);
    }
    // A degenerate "chord" with fewer than two real pitches falls back to the
    // single-note phrasing so it never reads oddly.
    if (pitches.length <= 1) return singleText(head, nextHead);

    const value = dHead.value;
    const base = value ? chordPitchList(pitches) + " " + value : chordPitchList(pitches);
    const extras = extrasOf(dHead, nextHead);
    return extras.length ? base + ", " + extras.join(", ") : base;
  }

  // Self-test: synchronous and self-contained; needs MusicModelWalk loaded for
  // real descriptors. Asserts phraseOf for single notes, rests, rich extras and
  // chords, plus the guards. console.table()s and returns the results object.
  function selfTest() {
    const melodyC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter" };
    const melodyD4 = { rest: false, chord: false, step: "D", octave: 4, type: "quarter" };
    const restNote = { rest: true, chord: false, step: null, octave: null, type: "quarter" };

    const richC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", dynamic: "f", lyric: "la", slur: { start: true, stop: false }, tie: null };
    const tieStart = { rest: false, chord: false, step: "E", octave: 4, type: "quarter", tie: { start: true, stop: false } };
    const tieStop = { rest: false, chord: false, step: "E", octave: 4, type: "quarter", tie: { start: false, stop: true } };

    const triadCrotchet = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];
    const dyad = [
      { rest: false, chord: false, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];
    const triadMinim = [
      { rest: false, chord: false, step: "C", octave: 4, type: "half" },
      { rest: false, chord: true, step: "E", octave: 4, type: "half" },
      { rest: false, chord: true, step: "G", octave: 4, type: "half" },
    ];
    const degenerate = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: null, octave: null, type: "quarter" },
    ];
    const chordWithDynamic = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter", dynamic: "f" },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];

    // Stage 12 symbol fixtures: a dotted note (value flows through unchanged), an
    // articulated note, a two-articulation note, an ornamented note, a triplet, a
    // note carrying tuplet + articulation + dynamic together to prove the order,
    // and a chord whose head note carries an articulation.
    const dottedC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", dots: 1 };
    const staccatoC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", articulations: ["staccato"] };
    const twoArticC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", articulations: ["accent", "tenuto"] };
    const trillC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", ornaments: ["trill-mark"] };
    const tripletG4 = { rest: false, chord: false, step: "G", octave: 4, type: "eighth", timeModification: { actualNotes: 3, normalNotes: 2 } };
    const tupletArticDynG4 = { rest: false, chord: false, step: "G", octave: 4, type: "eighth", timeModification: { actualNotes: 3, normalNotes: 2 }, articulations: ["staccato"], dynamic: "f" };
    const triadStaccatoHead = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter", articulations: ["staccato"] },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];

    const results = {
      hasPhraseOf: typeof phraseOf === "function",
      hasSelfTest: typeof selfTest === "function",
      singleMelodyNote: phraseOf([melodyC4], melodyD4) === "C4 crotchet",
      singleRest: phraseOf([restNote], null) === "rest crotchet",
      richExtras: phraseOf([richC4], melodyD4) === "C4 crotchet, forte, slurred to D4, lyric 'la'",
      tieToNext: phraseOf([tieStart], null) === "E4 crotchet, tied to the next note",
      tieFromPrev: phraseOf([tieStop], null) === "E4 crotchet, tied from the previous note",
      triadNamedTogether: phraseOf(triadCrotchet, null) === "C4, E4 and G4 crotchet",
      dyadNamedTogether: phraseOf(dyad, null) === "E4 and G4 crotchet",
      triadMinimValue: phraseOf(triadMinim, null) === "C4, E4 and G4 minim",
      chordReadsHeadDynamic: phraseOf(chordWithDynamic, null) === "C4, E4 and G4 crotchet, forte",
      degenerateChordFallsBack: phraseOf(degenerate, null) === "C4 crotchet",
      emptyGroup: phraseOf([], null) === "",
      nonArrayGroup: phraseOf(null, null) === "" && phraseOf(undefined, null) === "",
      dottedNote: phraseOf([dottedC4], null) === "C4 dotted crotchet",
      staccatoNote: phraseOf([staccatoC4], null) === "C4 crotchet, staccato",
      twoArticulationsInOrder: phraseOf([twoArticC4], null) === "C4 crotchet, accent, tenuto",
      trillNote: phraseOf([trillC4], null) === "C4 crotchet, trill",
      tripletNote: phraseOf([tripletG4], null) === "G4 quaver, triplet",
      tupletArticDynamicOrder: phraseOf([tupletArticDynG4], null) === "G4 quaver, triplet, staccato, forte",
      plainNoteUnchanged: phraseOf([melodyC4], null) === "C4 crotchet",
      chordReadsHeadArticulation: phraseOf(triadStaccatoHead, null) === "C4, E4 and G4 crotchet, staccato",
    };

    console.table(results);
    return results;
  }

  return { phraseOf, selfTest };
})();

window.MusicRenderPhrase = MusicRenderPhrase;
