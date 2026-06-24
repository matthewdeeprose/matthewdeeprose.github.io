// music-model-walk.js
// Model-walking helpers for the Accessible Music proof of concept.
//
// A PURE DATA SERVICE: it operates only on the plain model object that
// MusicParse.parse() returns. It never parses anything itself (no DOMParser),
// never throws, never notifies, and never touches the page DOM. Its job is to
// describe a single note in neutral, structured terms — the British note-value
// name and a pitch label — leaving the final spoken phrasing to a later
// render-text layer. The code-to-word naming maps (note value, dynamic, key,
// accidental) now live in MusicNames, consumed here. Exposed as
// window.MusicModelWalk.

const MusicModelWalk = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side naming: route through the shared MusicNames when present,
  // otherwise fall back to neutral results so this file never throws if the
  // names layer is absent.
  const names = window.MusicNames || {
    noteValueName() { return null; },
    dynamicName() { return null; },
    keySignatureName() { return null; },
    alterName() { return null; },
    dottedValueName() { return null; },
    tupletName() { return null; },
    articulationName() { return null; },
    ornamentName() { return null; },
  };

  // pitchLabel(step, octave, alter): pure; NEVER throws. Spells a pitch for a
  // screen reader. A plain note returns step and octave unchanged ("C4"), so a
  // melody with no accidentals reads exactly as before; an altered note inserts
  // the spelled accidental ("C sharp 4", "B flat 3", "C natural 4"). Returns null
  // when step or octave is missing. An unmapped alter falls back to the plain
  // label and is logged.
  function pitchLabel(step, octave, alter) {
    if (step === null || step === undefined || octave === null || octave === undefined) return null;
    if (alter === null || alter === undefined) return String(step) + String(octave);
    const word = names.alterName(alter);
    if (!word) {
      logWarn("pitchLabel: unmapped alter " + alter + ", spelling without an accidental");
      return String(step) + String(octave);
    }
    return String(step) + " " + word + " " + String(octave);
  }

  // describeNote(note): pure; NEVER throws. Returns a structured description of
  // one note from the model — { isRest, pitch, value, ... } — without composing
  // the final phrase (render-text does that). pitch is null for rests or when the
  // step/octave are missing; value is the British note-value name adjusted for
  // augmentation dots ("dotted crotchet"), the raw type if unmapped, or null when
  // the type is missing. It also surfaces the spoken symbol fields — tuplet,
  // articulations and ornaments — each null when the symbol is absent, so a plain
  // note describes exactly as before.
  function describeNote(note) {
    const n = note || {};
    const isRest = n.rest === true;
    const hasPitch = !isRest && n.step !== null && n.step !== undefined && n.octave !== null && n.octave !== undefined;
    const pitch = hasPitch ? pitchLabel(n.step, n.octave, n.alter) : null;
    const value = names.dottedValueName(n.type, n.dots);
    // New fields, surfaced for the renderers. dynamic is mapped to its full name;
    // lyric, tie and slur pass through as the parser supplied them.
    const dynamic = names.dynamicName(n.dynamic);
    const lyric = n.lyric === undefined ? null : n.lyric;
    const tie = n.tie === undefined ? null : n.tie;
    const slur = n.slur === undefined ? null : n.slur;
    // Spoken symbol fields, each null when the symbol is absent. tuplet is the
    // spoken tuplet name; articulations and ornaments map each raw tag to its
    // spoken name (e.g. "trill-mark" -> "trill").
    const tuplet = names.tupletName(n.timeModification);
    const articulations = n.articulations ? n.articulations.map(names.articulationName) : null;
    const ornaments = n.ornaments ? n.ornaments.map(names.ornamentName) : null;
    return { isRest: isRest, pitch: pitch, value: value, dynamic: dynamic, lyric: lyric, tie: tie, slur: slur, tuplet: tuplet, articulations: articulations, ornaments: ornaments };
  }

  // Diatonic step letters mapped to their index within an octave, for ordering
  // pitches. Ordering stays diatonic and ignores alter, so a C sharp and a C
  // natural sort to the same slot; the spelled accidental lives in the label,
  // not the index.
  const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  // pitchRange(model): pure; NEVER throws. Walks every note across
  // parts -> measures -> notes, skipping rests and notes missing step/octave,
  // and returns { lowest, highest } as pitch labels (step+octave, e.g. "C4")
  // ordered by a diatonic index (octave * 7 + stepIndex). Returns null when the
  // model has no pitched note.
  function pitchRange(model) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    let lowest = null;
    let highest = null;
    let lowestIndex = 0;
    let highestIndex = 0;
    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        for (const note of notes) {
          const n = note || {};
          if (n.rest === true) continue;
          if (n.step === null || n.step === undefined || n.octave === null || n.octave === undefined) continue;
          const stepIndex = STEP_INDEX[n.step];
          if (stepIndex === undefined) continue;
          const index = Number(n.octave) * 7 + stepIndex;
          const label = pitchLabel(n.step, n.octave, n.alter);
          if (lowest === null || index < lowestIndex) {
            lowest = label;
            lowestIndex = index;
          }
          if (highest === null || index > highestIndex) {
            highest = label;
            highestIndex = index;
          }
        }
      }
    }
    if (lowest === null) return null;
    return { lowest: lowest, highest: highest };
  }

  // noteValueCounts(model): pure; NEVER throws. Tallies every note (pitched and
  // rests) across parts -> measures -> notes by British note-value name,
  // returning an object mapping name -> count. Notes whose type is unmapped to a
  // name (null type) are skipped.
  function noteValueCounts(model) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    const counts = {};
    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        for (const note of notes) {
          const name = names.noteValueName(note ? note.type : null);
          if (name !== null) counts[name] = (counts[name] || 0) + 1;
        }
      }
    }
    return counts;
  }

  // hasLyrics(model): pure; NEVER throws. Walks every note and returns true if any
  // carries a non-empty lyric, false otherwise.
  function hasLyrics(model) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        for (const note of notes) {
          if (note && note.lyric !== null && note.lyric !== undefined && String(note.lyric).length > 0) return true;
        }
      }
    }
    return false;
  }

  // groupNotes(notes): pure; NEVER throws. The SINGLE definition of a chord
  // event. Turns a bar's flat note list into an array of groups, each group an
  // array of notes that sound together. A note with chord true joins the current
  // group; any other note (chord false or absent, including every rest) starts a
  // new group. So a melody yields one single-note group per note, identical to
  // today, and a chord yields one group of several. A leading note flagged chord
  // (malformed) still starts a group rather than being dropped. A non-array
  // argument yields []. The notes are grouped by reference, never copied or
  // mutated, so every downstream consumer (the note list, the audio schedule and
  // the MIDI builder) reads the same note objects and cannot drift.
  function groupNotes(notes) {
    const list = Array.isArray(notes) ? notes : [];
    const groups = [];
    for (const note of list) {
      const n = note || {};
      if (n.chord === true && groups.length > 0) {
        groups[groups.length - 1].push(n);
      } else {
        groups.push([n]);
      }
    }
    return groups;
  }

  // groupByStaff(notes): pure; NEVER throws. Splits a bar's flat note list into
  // one sequence per staff, as an array of { staff, notes } in first-appearance
  // order. A single-staff bar (every note's staff null) yields one group, so the
  // note list reads exactly as today; a piano bar yields one group per hand. Like
  // groupNotes it groups by reference, never copying or mutating, and a non-array
  // argument yields []. The note list runs this first, then groupNotes within
  // each staff, so chords still group inside a hand.
  function groupByStaff(notes) {
    if (!Array.isArray(notes)) return [];
    const groups = [];
    for (const note of notes) {
      const n = note || {};
      const staff = n.staff === undefined ? null : n.staff;
      let group = null;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g].staff === staff) {
          group = groups[g];
          break;
        }
      }
      if (!group) {
        group = { staff: staff, notes: [] };
        groups.push(group);
      }
      group.notes.push(n);
    }
    return groups;
  }

  // Compare two describeNote results field by field (not via JSON.stringify).
  function sameDescription(a, b) {
    return !!a && !!b && a.isRest === b.isRest && a.pitch === b.pitch && a.value === b.value;
  }

  // Self-test: synchronous and self-contained. Asserts describeNote against an
  // embedded copy of the project sample model (the shape MusicParse.parse()
  // returns). Needs MusicNames loaded for the real names. console.table()s and
  // returns the results object.
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

    const m1 = MODEL.parts[0].measures[0].notes;
    const m2 = MODEL.parts[0].measures[1].notes;

    // Rich descriptors and a lyric-bearing model for the new fields.
    const richNote = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "f", lyric: "la", slur: { start: true, stop: false }, tie: null };
    const plainNote = { rest: false, step: "G", octave: 4, duration: 4, type: "whole" };
    const dRich = describeNote(richNote);
    const dPlain = describeNote(plainNote);
    const lyricModel = { parts: [{ id: "P1", name: "X", measures: [{ number: "1", notes: [richNote] }] }] };

    // Stage 12 symbol fixtures: dotted notes, a tuplet, articulations and
    // ornaments, so describeNote is asserted to surface the spoken symbols while
    // a plain note stays unchanged.
    const dottedNote = { rest: false, step: "C", octave: 4, duration: 3, type: "quarter", dots: 1 };
    const doubleDottedNote = { rest: false, step: "A", octave: 4, duration: 7, type: "half", dots: 2 };
    const tripletNote = { rest: false, step: "C", octave: 4, duration: 1, type: "eighth", timeModification: { actualNotes: 3, normalNotes: 2 } };
    const staccatoNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", articulations: ["staccato"] };
    const trillNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", ornaments: ["trill-mark"] };

    // Altered notes and a model with accidentals at both ends of the range, for
    // the Stage 10 spelling assertions.
    const sharpNote = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", alter: 1 };
    const naturalNote = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", alter: 0 };
    const plainAlterNull = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", alter: null };
    const ALTERED_MODEL = {
      parts: [
        { id: "P1", name: "X", measures: [{ number: "1", notes: [
          { rest: false, step: "B", octave: 3, duration: 1, type: "quarter", alter: -1 },
          { rest: false, step: "C", octave: 5, duration: 1, type: "quarter", alter: 1 },
        ] }] },
      ],
    };

    // Stage 11 grouping fixtures: note arrays mirroring the chord fixture's bars,
    // plus a melody, a dyad and edge cases, so groupNotes is asserted as the
    // single definition of an event.
    const melodyNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false },
      { rest: false, step: "D", octave: 4, type: "quarter", chord: false },
    ];
    const triadNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: true },
      { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
    ];
    const chordsBar1Notes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: true },
      { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
      { rest: false, step: "D", octave: 4, type: "quarter", chord: false },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: false },
      { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
      { rest: true, step: null, octave: null, type: "quarter", chord: false },
    ];
    const chordsBar2Notes = [
      { rest: false, step: "F", octave: 4, type: "half", chord: false },
      { rest: false, step: "C", octave: 4, type: "half", chord: false },
      { rest: false, step: "E", octave: 4, type: "half", chord: true },
      { rest: false, step: "G", octave: 4, type: "half", chord: true },
    ];
    // Stage 14 grouping fixtures: single-staff and two-staff note arrays, plus a
    // two-staff array with a chord on staff 1, so groupByStaff is asserted to
    // split by staff and compose with groupNotes.
    const singleStaffNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, staff: null },
      { rest: false, step: "D", octave: 4, type: "quarter", chord: false, staff: null },
    ];
    const pianoNotes = [
      { rest: false, step: "C", octave: 5, type: "quarter", chord: false, staff: "1" },
      { rest: false, step: "D", octave: 5, type: "quarter", chord: false, staff: "1" },
      { rest: false, step: "C", octave: 3, type: "quarter", chord: false, staff: "2" },
      { rest: false, step: "D", octave: 3, type: "quarter", chord: false, staff: "2" },
    ];
    const pianoChordStaff1 = [
      { rest: false, step: "G", octave: 4, type: "quarter", chord: false, staff: "1" },
      { rest: false, step: "B", octave: 4, type: "quarter", chord: true, staff: "1" },
      { rest: false, step: "D", octave: 5, type: "quarter", chord: true, staff: "1" },
      { rest: false, step: "C", octave: 3, type: "quarter", chord: false, staff: "2" },
    ];

    const results = {
      hasDescribeNote: typeof describeNote === "function",
      hasSelfTest: typeof selfTest === "function",
      describesCrotchet: sameDescription(describeNote(m1[0]), { isRest: false, pitch: "C4", value: "crotchet" }),
      describesQuaver: sameDescription(describeNote(m1[2]), { isRest: false, pitch: "E4", value: "quaver" }),
      describesMinim: sameDescription(describeNote(m2[0]), { isRest: false, pitch: "A4", value: "minim" }),
      describesHighOctave: sameDescription(describeNote(m2[2]), { isRest: false, pitch: "C5", value: "crotchet" }),
      describesRest: sameDescription(describeNote(m2[1]), { isRest: true, pitch: null, value: "crotchet" }),
      describesSemibreve: sameDescription(describeNote({ rest: false, step: "G", octave: 3, duration: 8, type: "whole" }), {
        isRest: false,
        pitch: "G3",
        value: "semibreve",
      }),
      handlesMissingType: describeNote({ rest: false, step: "C", octave: 4, duration: 2, type: null }).value === null,
      hasPitchRange: typeof pitchRange === "function",
      hasNoteValueCounts: typeof noteValueCounts === "function",
      pitchRangeCorrect: (function () {
        const r = pitchRange(MODEL);
        return !!r && r.lowest === "C4" && r.highest === "C5";
      })(),
      pitchRangeNullNoPitches:
        pitchRange({
          parts: [
            { id: "P1", name: "X", measures: [{ number: "1", notes: [{ rest: true, step: null, octave: null, duration: 2, type: "quarter" }] }] },
          ],
        }) === null,
      noteValueCountsCorrect: (function () {
        const c = noteValueCounts(MODEL);
        return c.crotchet === 5 && c.quaver === 2 && c.minim === 1 && Object.keys(c).length === 3;
      })(),
      describeSurfacesDynamic: dRich.dynamic === "forte",
      describeSurfacesLyric: dRich.lyric === "la",
      describeSurfacesSlurStart: !!dRich.slur && dRich.slur.start === true && dRich.slur.stop === false,
      describeTieNullWhenAbsent: dRich.tie === null,
      describePlainNewFieldsNull:
        dPlain.dynamic === null && dPlain.lyric === null && dPlain.tie === null && dPlain.slur === null,
      describeSurfacesDottedValue: describeNote(dottedNote).value === "dotted crotchet",
      describeSurfacesDoubleDottedValue: describeNote(doubleDottedNote).value === "double dotted minim",
      describePlainValueStillBaseName: describeNote(plainNote).value === "semibreve",
      describeSurfacesTuplet: describeNote(tripletNote).tuplet === "triplet",
      describePlainTupletNull: dPlain.tuplet === null,
      describeSurfacesArticulations: (function () {
        const a = describeNote(staccatoNote).articulations;
        return Array.isArray(a) && a.length === 1 && a[0] === "staccato";
      })(),
      describePlainArticulationsNull: dPlain.articulations === null,
      describeSurfacesOrnaments: (function () {
        const o = describeNote(trillNote).ornaments;
        return Array.isArray(o) && o.length === 1 && o[0] === "trill";
      })(),
      describePlainOrnamentsNull: dPlain.ornaments === null,
      hasHasLyrics: typeof hasLyrics === "function",
      hasLyricsTrueWhenPresent: hasLyrics(lyricModel) === true,
      hasLyricsFalseOnSimpleSample: hasLyrics(MODEL) === false,
      hasPitchLabel: typeof pitchLabel === "function",
      pitchLabelPlain: pitchLabel("C", 4, null) === "C4",
      pitchLabelPlainUndefinedAlter: pitchLabel("C", 4, undefined) === "C4",
      pitchLabelSharp: pitchLabel("C", 4, 1) === "C sharp 4",
      pitchLabelFlat: pitchLabel("B", 3, -1) === "B flat 3",
      pitchLabelNatural: pitchLabel("C", 4, 0) === "C natural 4",
      pitchLabelDoubleSharp: pitchLabel("C", 4, 2) === "C double sharp 4",
      pitchLabelDoubleFlat: pitchLabel("B", 3, -2) === "B double flat 3",
      pitchLabelNullNoStep: pitchLabel(null, 4, 1) === null,
      pitchLabelNullNoOctave: pitchLabel("C", null, 1) === null,
      describeSpellsSharp: describeNote(sharpNote).pitch === "C sharp 4",
      describeSpellsNatural: describeNote(naturalNote).pitch === "C natural 4",
      describePlainAlterNullUnchanged: describeNote(plainAlterNull).pitch === "C4",
      pitchRangeSpellsAccidentals: (function () {
        const r = pitchRange(ALTERED_MODEL);
        return !!r && r.lowest === "B flat 3" && r.highest === "C sharp 5";
      })(),
      hasGroupNotes: typeof groupNotes === "function",
      groupNotesSimpleMelodyUnchanged: (function () {
        const g = groupNotes(MODEL.parts[0].measures[0].notes);
        return g.length === 5 && g.every(function (grp) { return grp.length === 1; });
      })(),
      groupNotesMelodyOneEach: (function () {
        const g = groupNotes(melodyNotes);
        return g.length === 2 && g[0].length === 1 && g[1].length === 1;
      })(),
      groupNotesTriadOneGroupOfThree: (function () {
        const g = groupNotes(triadNotes);
        return g.length === 1 && g[0].length === 3 &&
          g[0][0].step === "C" && g[0][1].step === "E" && g[0][2].step === "G";
      })(),
      groupNotesBar1FourEvents: (function () {
        const g = groupNotes(chordsBar1Notes);
        return g.length === 4 && g[0].length === 3 && g[1].length === 1 &&
          g[2].length === 2 && g[3].length === 1;
      })(),
      groupNotesBar1RestOwnGroup: (function () {
        const g = groupNotes(chordsBar1Notes);
        return g[3].length === 1 && g[3][0].rest === true;
      })(),
      groupNotesBar2TwoEvents: (function () {
        const g = groupNotes(chordsBar2Notes);
        return g.length === 2 && g[0].length === 1 && g[1].length === 3 &&
          g[0][0].step === "F" && g[1][0].step === "C" && g[1][1].step === "E" && g[1][2].step === "G";
      })(),
      groupNotesDyadOneGroupOfTwo: (function () {
        const g = groupNotes([
          { rest: false, step: "E", octave: 4, type: "quarter", chord: false },
          { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
        ]);
        return g.length === 1 && g[0].length === 2;
      })(),
      groupNotesEmptyArray: groupNotes([]).length === 0,
      groupNotesNonArray: groupNotes(null).length === 0 && groupNotes(undefined).length === 0,
      groupNotesLeadingChordStartsGroup: (function () {
        const g = groupNotes([
          { rest: false, step: "C", octave: 4, type: "quarter", chord: true },
          { rest: false, step: "E", octave: 4, type: "quarter", chord: false },
        ]);
        return g.length === 2 && g[0].length === 1 && g[1].length === 1;
      })(),
      groupNotesPreservesNoteObjects: (function () {
        const g = groupNotes(triadNotes);
        return g[0][1] === triadNotes[1] && g[0][1].step === "E" && g[0][1].chord === true;
      })(),
      hasGroupByStaff: typeof groupByStaff === "function",
      groupByStaffSingleOneGroup: (function () {
        const g = groupByStaff(singleStaffNotes);
        return g.length === 1 && g[0].staff === null && g[0].notes.length === 2;
      })(),
      groupByStaffPianoTwoGroups: (function () {
        const g = groupByStaff(pianoNotes);
        return g.length === 2 && g[0].staff === "1" && g[1].staff === "2" &&
          g[0].notes.length === 2 && g[1].notes.length === 2;
      })(),
      groupByStaffPreservesOrder: (function () {
        const g = groupByStaff(pianoNotes);
        return g[0].notes[0].step === "C" && g[0].notes[0].octave === 5 &&
          g[1].notes[0].step === "C" && g[1].notes[0].octave === 3;
      })(),
      groupByStaffEmptyArray: groupByStaff([]).length === 0,
      groupByStaffNonArray: groupByStaff(null).length === 0 && groupByStaff(undefined).length === 0,
      groupByStaffPreservesNoteObjects: (function () {
        const g = groupByStaff(pianoNotes);
        return g[0].notes[0] === pianoNotes[0] && g[1].notes[0] === pianoNotes[2];
      })(),
      groupByStaffComposesWithGroupNotes: (function () {
        const g = groupByStaff(pianoChordStaff1);
        const staff1Events = groupNotes(g[0].notes);
        const staff2Events = groupNotes(g[1].notes);
        return g.length === 2 &&
          staff1Events.length === 1 && staff1Events[0].length === 3 &&
          staff2Events.length === 1 && staff2Events[0].length === 1;
      })(),
    };

    console.table(results);
    return results;
  }

  return { describeNote, pitchLabel, pitchRange, noteValueCounts, hasLyrics, groupNotes, groupByStaff, selfTest };
})();

window.MusicModelWalk = MusicModelWalk;
