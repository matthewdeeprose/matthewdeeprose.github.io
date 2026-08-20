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
  // then dynamic, shaping, tie, slur, lyric, in that order. The slur is named from
  // its starting note only. Returns an array of strings (possibly empty). Shared by
  // the single-note and chord paths so a chord reads the same extras from its head
  // note.
  function extrasOf(d, nextNote) {
    const extras = [];

    // Chord symbol (Stage 64), sited FIRST - ahead of the tuplet push and so ahead
    // of every other clause. Unlike every other extra, which is a property of the
    // NOTE being described (this note is staccato, this note begins a crescendo), a
    // chord symbol is the harmonic CONTEXT arriving at that point in the bar. It is
    // voiced at this note because document order put it there, not because it
    // belongs to the note, so it reads ahead of the note's own attributes.
    //
    // The descriptor's harmony string is emitted UNCHANGED, with no scaffold word
    // such as "chord" or "harmony" in front of it: the name already reads as a
    // chord symbol, and the naming was settled at Stage 62. So a note reads
    // "G5 semiquaver, C major, mezzo-piano, crescendo begins".
    //
    // Read DEFENSIVELY, exactly as the shaping clause below does. The three-key
    // describeNote fallback at the top of this file is a degraded-mode placeholder
    // that omits most of the descriptor's fields, so a descriptor from it carries
    // harmony === undefined. Widening that stub was considered and DECLINED at
    // Stage 59, and THAT DECISION STANDS: this guard is what keeps a degraded
    // render working. It therefore tolerates undefined, null, a non-string, and an
    // empty or whitespace-only string, adding no clause and never throwing.
    if (typeof d.harmony === "string" && d.harmony.trim() !== "") extras.push(d.harmony);

    if (d.tuplet) extras.push(d.tuplet);
    if (d.articulations) for (const a of d.articulations) extras.push(a);
    if (d.ornaments) for (const o of d.ornaments) extras.push(o);
    if (d.dynamic) extras.push(d.dynamic);

    // Dynamic shaping (Stage 59), sited immediately after the dynamic because it
    // IS a dynamic instruction and belongs beside it, ahead of the connective
    // marks. ONE clause per endpoint, exactly as articulations and ornaments push
    // one entry each, and EVERY endpoint the descriptor holds is voiced rather
    // than the outermost alone: a note can legitimately carry two endings, proved
    // on the real Joplin at bar 68 and the real Satie at bar 8, where a diminuendo
    // nested inside a crescendo closes the pair at one point. The parser spent an
    // amendment to stop an ending being lost, so nothing is dropped here.
    //
    // STOPS read before STARTS: an ending belongs to the span arriving at this
    // note and a beginning to the span leaving it, so "crescendo ends, diminuendo
    // begins" is chronologically right. Within each list the descriptor's own
    // order is preserved, which for stops is the inner hairpin first.
    //
    // The wording is composed here from the RAW MusicXML type, which is already
    // the spoken word ("crescendo", "diminuendo"). music-names.js is deliberately
    // not involved: it holds closed-set lookups that return null for anything
    // unmapped, and nothing needs mapping.
    //
    // Read DEFENSIVELY. The three-key describeNote fallback at the top of this
    // file is a degraded-mode placeholder that already omits seven of the eleven
    // descriptor fields, so a descriptor from it carries shaping === undefined.
    // Widening that stub was considered and DECLINED at Stage 59: this guard is
    // what keeps a degraded render working. It therefore tolerates undefined,
    // null, a non-object, and an object whose starts or stops is missing or is not
    // an array, adding no clause and never throwing, and it skips any entry that
    // is not a non-empty string.
    const shaping = d.shaping;
    if (shaping && typeof shaping === "object") {
      const stops = Array.isArray(shaping.stops) ? shaping.stops : [];
      for (const s of stops) if (typeof s === "string" && s) extras.push(s + " ends");
      const starts = Array.isArray(shaping.starts) ? shaping.starts : [];
      for (const s of starts) if (typeof s === "string" && s) extras.push(s + " begins");
    }

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

    // Stage 59 shaping fixtures, in the shape MusicParse emits and MusicModelWalk
    // carries: shaping is null, or { starts, stops } with each entry a raw wedge
    // type in document order. One start; one stop; one of each (the stop must read
    // first); two stops (the Satie bar 8 / Joplin bar 68 shape, inner hairpin
    // first); a note carrying a dynamic, shaping, a tie and a slur together to pin
    // the clause position; and a REST carrying shaping, which is the real Satie's
    // bar 8 staff 1 event and reaches extrasOf because singleText composes extras
    // for a rest exactly as it does for a pitched note.
    const shapeStartC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: ["crescendo"], stops: [] } };
    const shapeStopC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: [], stops: ["crescendo"] } };
    const shapeOneEachC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: ["diminuendo"], stops: ["crescendo"] } };
    const shapeTwoStopsC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: [], stops: ["diminuendo", "crescendo"] } };
    const shapeWithDynTieSlurC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", dynamic: "f", shaping: { starts: ["crescendo"], stops: [] }, tie: { start: true, stop: false }, slur: { start: true, stop: false } };
    const shapeRest = { rest: true, chord: false, step: null, octave: null, type: "quarter", shaping: { starts: ["diminuendo"], stops: ["crescendo"] } };

    // Malformed shaping values, each of which must add NO clause and never throw.
    // A string, a number, an object carrying neither array, an object whose starts
    // is not an array, an object whose stops is not an array, an empty pair, and a
    // pair whose entries are not non-empty strings.
    const shapeStringC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: "crescendo" };
    const shapeNumberC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: 7 };
    const shapeNoArraysC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: {} };
    const shapeStartsNotArrayC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: "crescendo", stops: [] } };
    const shapeStopsNotArrayC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: [], stops: 3 } };
    const shapeEmptyPairC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: [], stops: [] } };
    const shapeBadEntriesC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: ["", null, 3], stops: [undefined, ""] } };

    // A chord whose HEAD carries shaping and whose members carry none, and a chord
    // whose head carries none while a MEMBER carries shaping — the second proves a
    // member contributes nothing, exactly as it contributes no dynamic.
    const triadShapingHead = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter", shaping: { starts: ["crescendo"], stops: [] } },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];
    const triadShapingMemberOnly = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter", shaping: { starts: ["crescendo"], stops: [] } },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];

    // The three-key describeNote fallback stub yields a descriptor whose shaping is
    // undefined, but it is only reachable when MusicModelWalk is absent at load —
    // which the self-test cannot arrange after the fact. So the degraded descriptor
    // is staged by swapping walk.describeNote for the stub's exact three-key return
    // and restoring it in a finally, self-restoring so a throw cannot leave the
    // module patched. Under the stub the phrase is "" because there is no pitch and
    // no value; the row proves the guard added no clause and did not throw on a
    // missing shaping key. A second row re-measures afterwards to prove the swap
    // was undone before any later row ran.
    let stubDescriptorSafe = false;
    const realDescribeNote = walk.describeNote;
    try {
      walk.describeNote = function () { return { isRest: false, pitch: null, value: null }; };
      stubDescriptorSafe = phraseOf([shapeStartC4], null) === "";
    } catch (e) {
      stubDescriptorSafe = false;
    } finally {
      walk.describeNote = realDescribeNote;
    }
    const stubSwapRestored = walk.describeNote === realDescribeNote && phraseOf([melodyC4], null) === "C4 crotchet";

    // Stage 64 harmony fixtures. The NOTE carries the parser's RAW record and the
    // real describeNote names it, so these read through the shipping naming path
    // rather than a hand-written string: a plain triad name; the dispatch's own
    // worked example (a harmony beside a dynamic and a shaping start); a name with
    // a BASS, which is the only place the word "over" appears; an explicit null
    // harmony; a REST carrying a harmony, which is real - the Joplin puts symbols
    // on rests, and singleText composes extras for a rest exactly as it does for a
    // pitched note; and a note carrying a harmony ALONGSIDE a tuplet, an
    // articulation, a dynamic, shaping, a tie and a slur, with a harmony-free twin
    // so the two strings can be compared to prove the other clauses kept their
    // relative order.
    const harmonyPlainC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } };
    const harmonyRichG5 = { rest: false, chord: false, step: "G", octave: 5, type: "16th", dynamic: "mp", shaping: { starts: ["crescendo"], stops: [] }, harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } };
    const harmonyOverBassC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "dominant", bassStep: "B", bassAlter: -1 } };
    const harmonyNullC4 = { rest: false, chord: false, step: "C", octave: 4, type: "quarter", harmony: null };
    const harmonyRest = { rest: true, chord: false, step: null, octave: null, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } };
    const harmonyAllExtrasG4 = { rest: false, chord: false, step: "G", octave: 4, type: "eighth", timeModification: { actualNotes: 3, normalNotes: 2 }, articulations: ["staccato"], dynamic: "f", shaping: { starts: ["crescendo"], stops: [] }, tie: { start: true, stop: false }, slur: { start: true, stop: false }, harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } };
    const harmonyAllExtrasNoHarmonyG4 = { rest: false, chord: false, step: "G", octave: 4, type: "eighth", timeModification: { actualNotes: 3, normalNotes: 2 }, articulations: ["staccato"], dynamic: "f", shaping: { starts: ["crescendo"], stops: [] }, tie: { start: true, stop: false }, slur: { start: true, stop: false } };
    const harmonyAllExtrasText = phraseOf([harmonyAllExtrasG4], melodyD4);
    const harmonyAllExtrasNoHarmonyText = phraseOf([harmonyAllExtrasNoHarmonyG4], melodyD4);

    // A chord whose HEAD carries a harmony and whose members carry none, and a
    // chord whose head carries none while a MEMBER does - the second proves a
    // member contributes nothing, exactly as it contributes no dynamic and no
    // shaping, because phraseOf reads extras from the head's descriptor alone.
    const triadHarmonyHead = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];
    const triadHarmonyMemberOnly = [
      { rest: false, chord: false, step: "C", octave: 4, type: "quarter" },
      { rest: false, chord: true, step: "E", octave: 4, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } },
      { rest: false, chord: true, step: "G", octave: 4, type: "quarter" },
    ];

    // A NON-STRING harmony cannot be produced through the real describeNote, which
    // maps a malformed record to null before the renderer ever sees it, so those
    // values are staged at the DESCRIPTOR level: swap walk.describeNote for one
    // returning a fixed descriptor, and restore it in a finally so a throw cannot
    // leave the module patched. The staged descriptor carries a pitch and a value,
    // so "no clause" reads as the plain "C4 crotchet" rather than the empty string
    // and cannot be confused with the phrase collapsing for some other reason.
    function phraseWithStagedHarmony(value) {
      const real = walk.describeNote;
      try {
        walk.describeNote = function () { return { isRest: false, pitch: "C4", value: "crotchet", harmony: value }; };
        return phraseOf([melodyC4], null);
      } catch (e) {
        return "THREW: " + e;
      } finally {
        walk.describeNote = real;
      }
    }

    // The three-key describeNote fallback stub yields a descriptor whose harmony is
    // UNDEFINED - the stub is a degraded-mode placeholder, widening it was declined
    // at Stage 59, and that decision stands, so the guard in extrasOf is what keeps
    // a degraded render working. Staged the same way the Stage 59 row is, with the
    // stub's exact three-key return and a restore in a finally. Under the stub the
    // phrase is "" because there is no pitch and no value; the row proves the guard
    // added no clause and did not throw on a missing harmony key. The companion row
    // re-measures afterwards to prove the swap was undone before any later row ran.
    let harmonyStubDescriptorSafe = false;
    const realDescribeNoteForHarmony = walk.describeNote;
    try {
      walk.describeNote = function () { return { isRest: false, pitch: null, value: null }; };
      harmonyStubDescriptorSafe = phraseOf([harmonyPlainC4], null) === "";
    } catch (e) {
      harmonyStubDescriptorSafe = false;
    } finally {
      walk.describeNote = realDescribeNoteForHarmony;
    }
    const harmonyStubSwapRestored = walk.describeNote === realDescribeNoteForHarmony && phraseOf([melodyC4], null) === "C4 crotchet";

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
      // Stage 59: dynamic shaping voiced, one clause per endpoint, stops first.
      shapingStartVoiced: phraseOf([shapeStartC4], null) === "C4 crotchet, crescendo begins",
      shapingStopVoiced: phraseOf([shapeStopC4], null) === "C4 crotchet, crescendo ends",
      shapingStopReadsBeforeStart: phraseOf([shapeOneEachC4], null) === "C4 crotchet, crescendo ends, diminuendo begins",
      shapingTwoStopsBothVoicedInOrder: phraseOf([shapeTwoStopsC4], null) === "C4 crotchet, diminuendo ends, crescendo ends",
      shapingSitsAfterDynamicBeforeTie: phraseOf([shapeWithDynTieSlurC4], melodyD4) === "C4 crotchet, forte, crescendo begins, tied to the next note, slurred to D4",
      shapingNullByteIdentical: phraseOf([melodyC4], melodyD4) === "C4 crotchet",
      shapingRichExtrasByteIdentical: phraseOf([richC4], melodyD4) === "C4 crotchet, forte, slurred to D4, lyric 'la'",
      shapingUndefinedFromStubNoClause: stubDescriptorSafe,
      shapingStubSwapRestored: stubSwapRestored,
      shapingStringNoClause: phraseOf([shapeStringC4], null) === "C4 crotchet",
      shapingNumberNoClause: phraseOf([shapeNumberC4], null) === "C4 crotchet",
      shapingNoArraysNoClause: phraseOf([shapeNoArraysC4], null) === "C4 crotchet",
      shapingStartsNotArrayNoClause: phraseOf([shapeStartsNotArrayC4], null) === "C4 crotchet",
      shapingStopsNotArrayNoClause: phraseOf([shapeStopsNotArrayC4], null) === "C4 crotchet",
      shapingEmptyPairNoClause: phraseOf([shapeEmptyPairC4], null) === "C4 crotchet",
      shapingNonStringEntriesSkipped: phraseOf([shapeBadEntriesC4], null) === "C4 crotchet",
      shapingChordReadsHeadOnce: phraseOf(triadShapingHead, null) === "C4, E4 and G4 crotchet, crescendo begins",
      shapingChordMemberContributesNone: phraseOf(triadShapingMemberOnly, null) === "C4, E4 and G4 crotchet",
      shapingOnRestVoiced: phraseOf([shapeRest], null) === "rest crotchet, crescendo ends, diminuendo begins",
      // Stage 64: the chord symbol voiced, unchanged and unscaffolded, read first.
      harmonyVoiced: phraseOf([harmonyPlainC4], null) === "C4 crotchet, C major",
      harmonyFullPhraseWithDynamicAndShaping: phraseOf([harmonyRichG5], null) === "G5 semiquaver, C major, mezzo-piano, crescendo begins",
      harmonyReadsFirstAmongAllExtras: harmonyAllExtrasText === "G4 quaver, C major, triplet, staccato, forte, crescendo begins, tied to the next note, slurred to D4",
      harmonyPrecedesTuplet: harmonyAllExtrasText.indexOf("C major") > -1 && harmonyAllExtrasText.indexOf("C major") < harmonyAllExtrasText.indexOf("triplet"),
      harmonyOthersKeepOrderWithoutIt: harmonyAllExtrasNoHarmonyText === "G4 quaver, triplet, staccato, forte, crescendo begins, tied to the next note, slurred to D4" && harmonyAllExtrasText === harmonyAllExtrasNoHarmonyText.replace("G4 quaver, ", "G4 quaver, C major, "),
      harmonyNullByteIdentical: phraseOf([melodyC4], melodyD4) === "C4 crotchet" && phraseOf([harmonyNullC4], null) === "C4 crotchet",
      harmonyRichExtrasByteIdentical: phraseOf([richC4], melodyD4) === "C4 crotchet, forte, slurred to D4, lyric 'la'",
      harmonyUndefinedFromStubNoClause: harmonyStubDescriptorSafe,
      harmonyStubSwapRestored: harmonyStubSwapRestored,
      harmonyStagedNullNoClause: phraseWithStagedHarmony(null) === "C4 crotchet",
      harmonyStagedUndefinedNoClause: phraseWithStagedHarmony(undefined) === "C4 crotchet",
      harmonyNumberNoClause: phraseWithStagedHarmony(7) === "C4 crotchet",
      harmonyObjectNoClause: phraseWithStagedHarmony({ rootStep: "C", kind: "major" }) === "C4 crotchet",
      harmonyArrayNoClause: phraseWithStagedHarmony(["C major"]) === "C4 crotchet",
      harmonyEmptyStringNoClause: phraseWithStagedHarmony("") === "C4 crotchet",
      harmonyWhitespaceOnlyNoClause: phraseWithStagedHarmony("   ") === "C4 crotchet" && phraseWithStagedHarmony(" \t\n ") === "C4 crotchet",
      harmonyChordReadsHeadOnce: phraseOf(triadHarmonyHead, null) === "C4, E4 and G4 crotchet, C major",
      harmonyChordMemberContributesNone: phraseOf(triadHarmonyMemberOnly, null) === "C4, E4 and G4 crotchet",
      harmonyOnRestVoiced: phraseOf([harmonyRest], null) === "rest crotchet, C major",
      harmonyOverBassSurvivesIntact: phraseOf([harmonyOverBassC4], null) === "C4 crotchet, C dominant seventh over B flat",
    };

    console.table(results);
    return results;
  }

  return { phraseOf, selfTest };
})();

window.MusicRenderPhrase = MusicRenderPhrase;
