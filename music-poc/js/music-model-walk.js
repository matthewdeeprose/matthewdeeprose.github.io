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
  // note describes exactly as before, and the dynamic shaping the parser read,
  // carried raw, and the chord symbol's SPOKEN NAME.
  //
  // This return literal is an EXPLICIT whitelist, not a spread: a new note field
  // must be named here as well, or it is silently dropped for every renderer with
  // no throw and no failing row.
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
    // Dynamic shaping, carried RAW and unmapped: null when the note holds no
    // endpoint, otherwise the parser's own { starts, stops } object, where each
    // array holds wedge types ("crescendo", "diminuendo") in document order. Two
    // INDEPENDENT endpoint lists rather than a paired span, so a note can carry
    // two endings — both real hairpin files nest a diminuendo inside a crescendo
    // and close the pair at one point, the Satie at bar 8 and the Joplin at bar 68.
    //
    // NOT passed through names: unlike a dynamic code, the MusicXML type values
    // are already the spoken words, and MusicNames holds only closed-set lookups
    // that would return null for anything it had not been taught. Carried in the
    // sentinel-ternary idiom tie and slur use, so an absent field reads null and
    // never undefined, and the object is passed by REFERENCE rather than copied.
    //
    // Read per note exactly as dynamic is, so a chord follows the same rule with
    // no chord logic here: phraseOf reads its head note's descriptor for every
    // field but pitch. Stage 59 decides what a reader HEARS and may deliberately
    // voice fewer endings than this descriptor holds.
    const shaping = n.shaping === undefined ? null : n.shaping;
    // Chord symbol, carried as the SPOKEN NAME. The DESCRIPTOR's harmony is a
    // string — "C major", "F sharp minor over A sharp" — while the NOTE's harmony
    // is the parser's raw record { rootStep, rootAlter, kind, bassStep, bassAlter }.
    // The mapping from codes to words happens HERE, exactly as dynamic is mapped
    // from "f" to "forte", because the renderer should receive words and not codes.
    // null when the note carries no harmony, and null when the record is malformed:
    // chordSymbolName returns null rather than throwing for anything it cannot name.
    // It also suppresses a ZERO alter, so "natural" never appears in a chord name
    // even though pitchLabel spells it for a pitch. Stage 64 voices this field;
    // nothing reads it yet.
    //
    // Guarded twice, unlike the dynamic line above: once so an absent harmony never
    // reaches the namer, and once on the function itself, because the module-scope
    // names stub PREDATES chord naming and provides no chordSymbolName — an
    // unguarded call would throw there rather than degrade to null.
    const canNameChord = typeof names.chordSymbolName === "function";
    const harmony = n.harmony === null || n.harmony === undefined || !canNameChord ? null : names.chordSymbolName(n.harmony);
    return { isRest: isRest, pitch: pitch, value: value, dynamic: dynamic, lyric: lyric, tie: tie, slur: slur, tuplet: tuplet, articulations: articulations, ornaments: ornaments, shaping: shaping, harmony: harmony };
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

  // Dynamic codes ranked softest to loudest, for ordering a dynamics range. Only
  // the eight LEVEL codes are ranked. sf, sfz and fp are accents rather than
  // levels and have no honest place on a soft-to-loud scale, so they carry no
  // rank and are skipped, exactly as pitchRange skips a note whose step is not in
  // STEP_INDEX. The rank lives here rather than in music-names because that
  // module holds closed-set LOOKUPS, and this is an ORDER; STEP_INDEX sets the
  // precedent for an ordering table living beside the walk that needs it.
  const DYNAMIC_INDEX = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7 };

  // dynamicsOverview(model): pure; NEVER throws. Walks every note across
  // parts -> measures -> notes and returns
  // { softest, loudest, shapingStarts, shapingStops }, or null when the model
  // carries no dynamic and no shaping at all.
  //
  // softest and loudest are FULL NAMES through dynamicName, not raw codes, and
  // are both null when no note carries a rankable dynamic. A piece using one
  // dynamic returns the same name for both, which is what pitchRange does with a
  // single pitch.
  //
  // First-appearance order is deliberately DISCARDED. It is not loudness order in
  // any of the three real files, and the walk is part-major rather than
  // time-major, so on a multi-part score it is not heard order either.
  //
  // The two shaping counts are returned SEPARATELY and are never paired. The real
  // Palestrina carries seven crescendo starts and no stops, so any count that
  // assumed endpoints pair would be wrong on a real file in the corpus.
  function dynamicsOverview(model) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    let softestCode = null;
    let loudestCode = null;
    let softestIndex = 0;
    let loudestIndex = 0;
    let shapingStarts = 0;
    let shapingStops = 0;
    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        for (const note of notes) {
          const n = note || {};
          if (typeof n.dynamic === "string" && n.dynamic !== "") {
            const index = DYNAMIC_INDEX[n.dynamic];
            if (index !== undefined) {
              if (softestCode === null || index < softestIndex) {
                softestCode = n.dynamic;
                softestIndex = index;
              }
              if (loudestCode === null || index > loudestIndex) {
                loudestCode = n.dynamic;
                loudestIndex = index;
              }
            }
          }
          // The two endpoint lists are counted INDEPENDENTLY, each guarded on its
          // own, so a malformed shaping object carrying only one of them still
          // contributes the half it does carry rather than being dropped whole.
          if (n.shaping && typeof n.shaping === "object") {
            if (Array.isArray(n.shaping.starts)) shapingStarts += n.shaping.starts.length;
            if (Array.isArray(n.shaping.stops)) shapingStops += n.shaping.stops.length;
          }
        }
      }
    }
    if (softestCode === null && shapingStarts === 0 && shapingStops === 0) return null;
    return {
      softest: softestCode === null ? null : names.dynamicName(softestCode),
      loudest: loudestCode === null ? null : names.dynamicName(loudestCode),
      shapingStarts: shapingStarts,
      shapingStops: shapingStops,
    };
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

  // groupByVoice(notes): pure; NEVER throws. Splits a bar's flat note list into
  // one sequence per voice, as an array of { voice, notes } in first-appearance
  // order. The SINGLE definition of a voice. A single-voice bar (every note's
  // voice null) yields one group, so the note list reads exactly as today; a bar
  // that returns to voice 1 after voice 2 yields two groups, not three. Like
  // groupByStaff it groups by reference, never copying or mutating, and a
  // non-array argument yields []. The note list runs groupByStaff first, then
  // groupByVoice within each hand, then groupNotes within each voice, so chords
  // still group inside a voice inside a hand. The voice id is the raw MusicXML
  // value; any reader-facing numbering belongs to the renderer, because the
  // Satie's bass staff uses voices 5 and 6.
  function groupByVoice(notes) {
    if (!Array.isArray(notes)) return [];
    const groups = [];
    for (const note of notes) {
      const n = note || {};
      const voice = n.voice === undefined ? null : n.voice;
      let group = null;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g].voice === voice) {
          group = groups[g];
          break;
        }
      }
      if (!group) {
        group = { voice: voice, notes: [] };
        groups.push(group);
      }
      group.notes.push(n);
    }
    return groups;
  }

  // keyboardPairs(model): pure; NEVER throws; never mutates the model. The SINGLE
  // definition of a cross-part keyboard pair — a grand staff written as TWO parts
  // rather than as two staves of one part. A brace is the notation convention for
  // a keyboard staff group, so the brace is the signal here rather than a clef
  // heuristic: pairing "one treble part with one bass part" would wrongly marry a
  // flute to a bassoon. A group qualifies only when its symbol is exactly "brace",
  // it names exactly two ids, both resolve to DIFFERENT parts of model.parts, and
  // NEITHER part already uses more than one staff — a part whose notes carry
  // staves 1 and 2 is a grand staff in its own right, so the pair is not a
  // cross-part one. A braced group of three parts, such as an organ with a pedal
  // stave, does NOT qualify and reads exactly as it does today; nor does a bracket,
  // which is an ensemble grouping. A part belongs to at most one pair, so a later
  // group reusing a claimed part is skipped and warned about. Returns an array of
  // { groupNumber, partIds, partIndices, name }: partIndices are the two 0-based
  // indices into model.parts sorted ascending, and partIds correspond to them
  // position by position. name prefers the group's name, then the first named
  // member part, then the joined ids ("Parts P1 and P2") — it never invents an
  // instrument name, because the file did not say "Piano". This is the first
  // part-aware function in this module; everything above it walks notes.
  function keyboardPairs(model) {
    if (!model || typeof model !== "object") return [];
    if (!Array.isArray(model.parts)) return [];
    if (!Array.isArray(model.partGroups)) return [];
    const parts = model.parts;
    const groups = model.partGroups;

    // Resolve a part id to its 0-based index in model.parts, or -1. A missing id
    // never resolves, so two absent ids cannot silently match each other.
    function indexOfPartId(id) {
      if (id === null || id === undefined || id === "") return -1;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] && parts[i].id === id) return i;
      }
      return -1;
    }

    // How many DISTINCT staff values a part's notes carry, undefined read as null.
    // 0 or 1 means the part sits on a single stave; 2 or more means it is already
    // a grand staff and cannot be half of a cross-part pair.
    function distinctStaffCount(part) {
      const p = part || {};
      const measures = Array.isArray(p.measures) ? p.measures : [];
      const seen = [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        for (const note of notes) {
          const n = note || {};
          const staff = n.staff === undefined ? null : n.staff;
          if (seen.indexOf(staff) === -1) seen.push(staff);
        }
      }
      return seen.length;
    }

    // Label a part for the joined-id name: its id, or its 1-based position when
    // the id is missing, so the fallback always reads as something.
    function partLabel(index) {
      const part = parts[index] || {};
      if (typeof part.id === "string" && part.id.length > 0) return part.id;
      return String(index + 1);
    }

    const claimed = [];
    const pairs = [];
    for (const group of groups) {
      const g = group && typeof group === "object" ? group : {};
      if (g.symbol !== "brace") {
        logDebug("keyboardPairs: skipping a group whose symbol is not a brace");
        continue;
      }
      const ids = Array.isArray(g.partIds) ? g.partIds : [];
      if (ids.length !== 2) {
        logDebug("keyboardPairs: skipping a braced group of " + ids.length + " part(s); a pair needs exactly two");
        continue;
      }
      const firstIndex = indexOfPartId(ids[0]);
      const secondIndex = indexOfPartId(ids[1]);
      if (firstIndex === -1 || secondIndex === -1) {
        logWarn("keyboardPairs: a braced group names a part id absent from the parts list; skipping it");
        continue;
      }
      if (firstIndex === secondIndex) {
        logDebug("keyboardPairs: skipping a braced group that names the same part twice");
        continue;
      }
      if (distinctStaffCount(parts[firstIndex]) > 1 || distinctStaffCount(parts[secondIndex]) > 1) {
        logDebug("keyboardPairs: skipping a braced group whose member already uses more than one staff");
        continue;
      }

      // Indices ascending, ids kept in step with them, so the two arrays always
      // correspond position by position whatever order the part-list declared.
      const partIndices = firstIndex < secondIndex ? [firstIndex, secondIndex] : [secondIndex, firstIndex];
      if (claimed.indexOf(partIndices[0]) !== -1 || claimed.indexOf(partIndices[1]) !== -1) {
        logWarn("keyboardPairs: a braced group reuses a part already claimed by an earlier pair; skipping it");
        continue;
      }
      claimed.push(partIndices[0]);
      claimed.push(partIndices[1]);
      const partIds = [parts[partIndices[0]].id, parts[partIndices[1]].id];

      // Name fallback chain: the group's own name, then the first named member
      // part, then the joined ids. Never an invented instrument.
      let memberName = null;
      for (const index of partIndices) {
        const part = parts[index] || {};
        if (typeof part.name === "string" && part.name.length > 0) {
          memberName = part.name;
          break;
        }
      }
      const groupName = typeof g.name === "string" && g.name.length > 0 ? g.name : null;
      const name = groupName || memberName || ("Parts " + partLabel(partIndices[0]) + " and " + partLabel(partIndices[1]));

      pairs.push({ groupNumber: g.number, partIds: partIds, partIndices: partIndices, name: name });
    }

    if (pairs.length > 0) logInfo("Found " + pairs.length + " cross-part keyboard pair(s)");
    return pairs;
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
    // Voice grouping fixtures: a single-voice note array, a Satie-shaped bar
    // (voice "1" rest, note, chord member, then two voice "2" notes) and an
    // interleaved-voice array, so groupByVoice is asserted to split by voice,
    // merge a returning voice, and compose with groupNotes.
    const singleVoiceNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, voice: null },
      { rest: false, step: "D", octave: 4, type: "quarter", chord: false, voice: null },
    ];
    const satieBarNotes = [
      { rest: true, step: null, octave: null, type: "quarter", chord: false, voice: "1" },
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, voice: "1" },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: true, voice: "1" },
      { rest: false, step: "C", octave: 3, type: "quarter", chord: false, voice: "2" },
      { rest: false, step: "D", octave: 3, type: "quarter", chord: false, voice: "2" },
    ];
    const interleavedVoiceNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, voice: "1" },
      { rest: false, step: "C", octave: 3, type: "quarter", chord: false, voice: "2" },
      { rest: false, step: "D", octave: 4, type: "quarter", chord: false, voice: "1" },
    ];

    // Stage 50 keyboard-pair fixtures: hand-built models carrying partGroups, in
    // the shape MusicParse.parse() now returns, so keyboardPairs is asserted as
    // the single definition of a cross-part keyboard pair. The staff values on a
    // part's notes are what decide whether that part is already a grand staff in
    // its own right; kpUnnamedP1/P2 carry no staff at all, which is the Joplin
    // case, and no name either, which drives the joined-id fallback.
    const kpPartP1 = { id: "P1", name: "Right hand", measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 5, duration: 2, type: "quarter", staff: "1" },
    ] }] };
    const kpPartP2 = { id: "P2", name: "Left hand", measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 3, duration: 2, type: "quarter", staff: "1" },
    ] }] };
    const kpPartP3 = { id: "P3", name: "Pedal", measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 2, duration: 2, type: "quarter", staff: "1" },
    ] }] };
    const kpPartP4 = { id: "P4", name: "Manual", measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", staff: "1" },
    ] }] };
    const kpTwoStaffP1 = { id: "P1", name: "Piano", measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 5, duration: 2, type: "quarter", staff: "1" },
      { rest: false, step: "C", octave: 3, duration: 2, type: "quarter", staff: "2" },
    ] }] };
    const kpUnnamedP1 = { id: "P1", name: null, measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 4, duration: 2, type: "quarter" },
    ] }] };
    const kpUnnamedP2 = { id: "P2", name: null, measures: [{ number: "1", notes: [
      { rest: false, step: "C", octave: 3, duration: 2, type: "quarter" },
    ] }] };

    const KP_BRACED_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const KP_NAMED_GROUP_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: "Piano", partIds: ["P1", "P2"] }],
    };
    const KP_UNNAMED_MODEL = {
      parts: [kpUnnamedP1, kpUnnamedP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const KP_BRACKET_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "bracket", name: "Choir", partIds: ["P1", "P2"] }],
    };
    const KP_NULL_SYMBOL_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: null, name: null, partIds: ["P1", "P2"] }],
    };
    const KP_THREE_PART_MODEL = {
      parts: [kpPartP1, kpPartP2, kpPartP3],
      partGroups: [{ number: "1", symbol: "brace", name: "Organ", partIds: ["P1", "P2", "P3"] }],
    };
    const KP_ONE_PART_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1"] }],
    };
    const KP_TWO_STAFF_MODEL = {
      parts: [kpTwoStaffP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const KP_UNKNOWN_ID_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P9"] }],
    };
    const KP_SAME_ID_MODEL = {
      parts: [kpPartP1, kpPartP2],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P1"] }],
    };
    const KP_SHARED_PART_MODEL = {
      parts: [kpPartP1, kpPartP2, kpPartP3],
      partGroups: [
        { number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] },
        { number: "2", symbol: "brace", name: null, partIds: ["P2", "P3"] },
      ],
    };
    const KP_TWO_PAIRS_MODEL = {
      parts: [kpPartP1, kpPartP2, kpPartP3, kpPartP4],
      partGroups: [
        { number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] },
        { number: "2", symbol: "brace", name: null, partIds: ["P3", "P4"] },
      ],
    };
    const KP_MALFORMED_MODEL = {
      parts: [kpPartP1, kpPartP2, null],
      partGroups: [
        null,
        "brace",
        42,
        { number: "1", symbol: "brace", name: null, partIds: null },
        { number: "2", symbol: "brace", name: 7, partIds: ["P1", null] },
        { number: "3", symbol: "brace" },
        { number: "4", symbol: "brace", name: null, partIds: [null, undefined] },
      ],
    };
    const KP_NO_PARTS_MODEL = {
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const KP_EMPTY_GROUPS_MODEL = { parts: [kpPartP1, kpPartP2], partGroups: [] };

    // Stage 58 shaping fixtures, in the shape MusicParse now emits: shaping is
    // null, or { starts, stops } with each entry a wedge type in document order.
    // A note carrying a start; a note carrying TWO stops (the Satie bar 8 and
    // Joplin bar 68 shape, inner wedge first); a note carrying one of each; and a
    // note carrying shaping ALONGSIDE the existing fields, so the carry can be
    // proven not to disturb them.
    const shapingStartNote = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", shaping: { starts: ["crescendo"], stops: [] } };
    const shapingTwoStopsNote = { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", shaping: { starts: [], stops: ["diminuendo", "crescendo"] } };
    const shapingOneEachNote = { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", shaping: { starts: ["diminuendo"], stops: ["crescendo"] } };
    const shapingWithExtrasNote = {
      rest: false, step: "F", octave: 4, duration: 1, type: "quarter",
      dynamic: "f", lyric: "la", tie: { start: true, stop: false }, slur: { start: true, stop: false },
      shaping: { starts: ["crescendo"], stops: [] },
    };
    const dShapingStart = describeNote(shapingStartNote);
    const dShapingTwoStops = describeNote(shapingTwoStopsNote);
    const dShapingOneEach = describeNote(shapingOneEachNote);
    const dShapingWithExtras = describeNote(shapingWithExtrasNote);

    // A chord whose HEAD carries both a dynamic and shaping, and whose members
    // carry neither, so shaping is proven to be read from the same note dynamic is
    // read from. groupNotes supplies the head; describeNote itself never inspects
    // the chord flag.
    const shapingChordNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, dynamic: "f", shaping: { starts: ["crescendo"], stops: [] } },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: true },
      { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
    ];

    // A model whose every note carries shaping in some form — a start, two stops,
    // and a plain note with none — so the descriptor's key presence can be
    // asserted across a whole walk rather than on one note.
    const SHAPING_MODEL = {
      parts: [
        { id: "P1", name: "X", measures: [
          { number: "1", notes: [shapingStartNote, shapingTwoStopsNote] },
          { number: "2", notes: [{ rest: false, step: "G", octave: 4, duration: 4, type: "whole", shaping: null }] },
        ] },
      ],
    };

    // Every descriptor built from a model, so shaping's key presence and its
    // strictly-null neutral value can be asserted over a whole walk. Uses
    // hasOwnProperty rather than a truthiness test, so a descriptor that
    // legitimately reads null still counts as carrying the key.
    function everyDescriptorOwnsShaping(candidate) {
      const parts = candidate && Array.isArray(candidate.parts) ? candidate.parts : [];
      let seen = 0;
      for (const part of parts) {
        for (const measure of part.measures) {
          for (const note of measure.notes) {
            const d = describeNote(note);
            seen += 1;
            if (!Object.prototype.hasOwnProperty.call(d, "shaping")) return false;
            if (d.shaping === undefined) return false;
          }
        }
      }
      return seen > 0;
    }

    // Stage 63 harmony fixtures. The NOTE carries the parser's raw record; the
    // DESCRIPTOR must carry the spoken name. A plain triad; an altered root with an
    // altered bass; a kind MusicNames has no word for, which falls back to the
    // hyphens-to-spaces spelling; and four malformed records, none of which may
    // throw. harmonyWithExtrasNote carries a harmony ALONGSIDE every existing
    // field, so the carry can be proven not to disturb them.
    const harmonyPlainNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: { rootStep: "C", rootAlter: null, kind: "major", bassStep: null, bassAlter: null } };
    const harmonyAlteredNote = { rest: false, step: "F", octave: 4, duration: 2, type: "quarter", harmony: { rootStep: "F", rootAlter: 1, kind: "minor", bassStep: "A", bassAlter: 1 } };
    const harmonyUnmappedKindNote = { rest: false, step: "G", octave: 4, duration: 2, type: "quarter", harmony: { rootStep: "G", rootAlter: null, kind: "major-seventh", bassStep: null, bassAlter: null } };
    const harmonyZeroAlterNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: { rootStep: "C", rootAlter: 0, kind: "major", bassStep: "G", bassAlter: 0 } };
    const harmonyMalformedRecordNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: { rootStep: null, kind: null } };
    const harmonyMalformedStringNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: "C major" };
    const harmonyMalformedNumberNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: 7 };
    const harmonyMalformedArrayNote = { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", harmony: ["C", "major"] };
    const harmonyWithExtrasNote = {
      rest: false, step: "F", octave: 4, duration: 1, type: "quarter",
      dynamic: "f", lyric: "la", tie: { start: true, stop: false }, slur: { start: true, stop: false },
      shaping: { starts: ["crescendo"], stops: [] },
      harmony: { rootStep: "B", rootAlter: -1, kind: "major" },
    };
    const dHarmonyPlain = describeNote(harmonyPlainNote);
    const dHarmonyAltered = describeNote(harmonyAlteredNote);
    const dHarmonyWithExtras = describeNote(harmonyWithExtrasNote);

    // A chord whose HEAD carries both a dynamic and a harmony, and whose members
    // carry neither, so harmony is proven to be read from the same note dynamic is
    // read from. groupNotes supplies the head; describeNote itself never inspects
    // the chord flag.
    const harmonyChordNotes = [
      { rest: false, step: "C", octave: 4, type: "quarter", chord: false, dynamic: "f", harmony: { rootStep: "C", kind: "major" } },
      { rest: false, step: "E", octave: 4, type: "quarter", chord: true },
      { rest: false, step: "G", octave: 4, type: "quarter", chord: true },
    ];

    // A model whose notes carry harmony in some form — a plain triad, an altered
    // slash chord, and a plain note with none — so the descriptor's key presence
    // can be asserted across a whole walk rather than on one note.
    const HARMONY_MODEL = {
      parts: [
        { id: "P1", name: "X", measures: [
          { number: "1", notes: [harmonyPlainNote, harmonyAlteredNote] },
          { number: "2", notes: [{ rest: false, step: "G", octave: 4, duration: 4, type: "whole", harmony: null }] },
        ] },
      ],
    };

    // Every descriptor built from a model owns a harmony key and never reads
    // undefined. hasOwnProperty rather than a truthiness test, so a descriptor that
    // legitimately reads null still counts as carrying the key.
    function everyDescriptorOwnsHarmony(candidate) {
      const parts = candidate && Array.isArray(candidate.parts) ? candidate.parts : [];
      let seen = 0;
      for (const part of parts) {
        for (const measure of part.measures) {
          for (const note of measure.notes) {
            const d = describeNote(note);
            seen += 1;
            if (!Object.prototype.hasOwnProperty.call(d, "harmony")) return false;
            if (d.harmony === undefined) return false;
          }
        }
      }
      return seen > 0;
    }

    // A model that carries partGroups AND a bar with chords, staves and voices, so
    // the existing grouping seams are asserted untouched by the new field.
    const KP_REGRESSION_MODEL = {
      parts: [{ id: "P1", name: "Piano", measures: [{ number: "1", notes: pianoChordStaff1 }] }],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1"] }],
    };

    // Stage 68 fixtures. One bar, one part, so each model isolates exactly the
    // dynamic and shaping arrangement its row is named after and nothing else.
    function dynModel(notes) {
      return { parts: [{ id: "P1", name: "Dyn", measures: [{ number: "1", notes: notes }] }] };
    }
    function dynNote(dynamic, shaping) {
      return { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", dynamic: dynamic, shaping: shaping };
    }
    const DYN_TWO = dynModel([dynNote("pp", null), dynNote("f", null)]);
    const DYN_TWO_REVERSED = dynModel([dynNote("f", null), dynNote("pp", null)]);
    const DYN_SINGLE = dynModel([dynNote("mf", null)]);
    const DYN_NOTHING = dynModel([dynNote(null, null), dynNote(null, null)]);
    const DYN_SHAPING_ONLY = dynModel([dynNote(null, { starts: ["crescendo"], stops: ["diminuendo"] })]);
    // Three starts and no stops across two notes: the real Palestrina's arrangement,
    // which carries seven crescendo starts the file never closes.
    const DYN_STARTS_NO_STOPS = dynModel([
      dynNote(null, { starts: ["crescendo", "diminuendo"], stops: [] }),
      dynNote(null, { starts: ["crescendo"], stops: [] }),
    ]);
    const DYN_WITH_ACCENT = dynModel([dynNote("p", null), dynNote("sf", null), dynNote("f", null)]);
    const DYN_ACCENT_ONLY = dynModel([dynNote("sf", null)]);

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
      hasGroupByVoice: typeof groupByVoice === "function",
      groupByVoiceSingleOneGroup: (function () {
        const g = groupByVoice(singleVoiceNotes);
        return g.length === 1 && g[0].voice === null && g[0].notes.length === 2;
      })(),
      groupByVoiceTwoVoices: (function () {
        const g = groupByVoice(satieBarNotes);
        return g.length === 2 && g[0].voice === "1" && g[1].voice === "2" &&
          g[0].notes.length === 3 && g[1].notes.length === 2;
      })(),
      groupByVoicePreservesOrder: (function () {
        const g = groupByVoice(satieBarNotes);
        return g[0].voice === "1" && g[1].voice === "2" &&
          g[0].notes[0].rest === true && g[0].notes[1].step === "C" &&
          g[1].notes[0].step === "C" && g[1].notes[0].octave === 3 &&
          g[1].notes[1].step === "D";
      })(),
      groupByVoiceInterleavedIdsMerge: (function () {
        const g = groupByVoice(interleavedVoiceNotes);
        return g.length === 2 && g[0].voice === "1" && g[0].notes.length === 2 &&
          g[0].notes[0].step === "C" && g[0].notes[1].step === "D";
      })(),
      groupByVoiceUndefinedIsNull: (function () {
        const g = groupByVoice([{ rest: false, step: "C", octave: 4, type: "quarter", chord: false }]);
        return g.length === 1 && g[0].voice === null;
      })(),
      groupByVoiceEmptyArray: groupByVoice([]).length === 0,
      groupByVoiceNonArray: groupByVoice(null).length === 0 && groupByVoice(undefined).length === 0,
      groupByVoiceComposesWithGroupNotes: (function () {
        const g = groupByVoice(satieBarNotes);
        const voice1Events = groupNotes(g[0].notes);
        return voice1Events.length === 2 && voice1Events[1].length === 2 &&
          voice1Events[1][0].step === "C" && voice1Events[1][1].step === "E";
      })(),
      hasKeyboardPairs: typeof keyboardPairs === "function",
      keyboardPairsReturnsArray: Array.isArray(keyboardPairs(KP_BRACED_MODEL)),
      keyboardPairsNullModel: keyboardPairs(null).length === 0,
      keyboardPairsNoPartsArray: keyboardPairs(KP_NO_PARTS_MODEL).length === 0,
      keyboardPairsNoPartGroups: keyboardPairs(MODEL).length === 0,
      keyboardPairsEmptyGroups: keyboardPairs(KP_EMPTY_GROUPS_MODEL).length === 0,
      bracedTwoPartsOnePair: keyboardPairs(KP_BRACED_MODEL).length === 1,
      pairIndicesAreZeroAndOne: (function () {
        const p = keyboardPairs(KP_BRACED_MODEL);
        return p.length === 1 && p[0].partIndices.join(",") === "0,1";
      })(),
      pairIdsMatchIndices: (function () {
        const p = keyboardPairs(KP_BRACED_MODEL);
        return p.length === 1 && p[0].partIds.join(",") === "P1,P2";
      })(),
      pairGroupNumberCarried: (function () {
        const p = keyboardPairs(KP_BRACED_MODEL);
        return p.length === 1 && p[0].groupNumber === "1";
      })(),
      nameFromGroupName: (function () {
        const p = keyboardPairs(KP_NAMED_GROUP_MODEL);
        return p.length === 1 && p[0].name === "Piano";
      })(),
      nameFromFirstNamedPart: (function () {
        const p = keyboardPairs(KP_BRACED_MODEL);
        return p.length === 1 && p[0].name === "Right hand";
      })(),
      nameFromJoinedIds: (function () {
        const p = keyboardPairs(KP_UNNAMED_MODEL);
        return p.length === 1 && p[0].name === "Parts P1 and P2";
      })(),
      nameNeverInventsInstrument: (function () {
        const p = keyboardPairs(KP_UNNAMED_MODEL);
        return p.length === 1 && /piano|organ|keyboard|harpsichord/i.test(p[0].name) === false;
      })(),
      bracketSymbolNoPair: keyboardPairs(KP_BRACKET_MODEL).length === 0,
      nullSymbolNoPair: keyboardPairs(KP_NULL_SYMBOL_MODEL).length === 0,
      threePartBraceNoPair: keyboardPairs(KP_THREE_PART_MODEL).length === 0,
      onePartBraceNoPair: keyboardPairs(KP_ONE_PART_MODEL).length === 0,
      twoStaffMemberNoPair: keyboardPairs(KP_TWO_STAFF_MODEL).length === 0,
      singleStaffValueStillPairs: (function () {
        const p = keyboardPairs(KP_BRACED_MODEL);
        return p.length === 1 && p[0].partIndices.join(",") === "0,1";
      })(),
      nullStaffNotesStillPair: (function () {
        const p = keyboardPairs(KP_UNNAMED_MODEL);
        return p.length === 1 && p[0].partIds.join(",") === "P1,P2";
      })(),
      unknownPartIdNoPair: keyboardPairs(KP_UNKNOWN_ID_MODEL).length === 0,
      sameIdTwiceNoPair: keyboardPairs(KP_SAME_ID_MODEL).length === 0,
      partNeverInTwoPairs: (function () {
        const p = keyboardPairs(KP_SHARED_PART_MODEL);
        return p.length === 1 && p[0].partIds.join(",") === "P1,P2";
      })(),
      twoSeparatePairsBothReturned: (function () {
        const p = keyboardPairs(KP_TWO_PAIRS_MODEL);
        return p.length === 2 && p[0].partIndices.join(",") === "0,1" &&
          p[1].partIndices.join(",") === "2,3" && p[1].partIds.join(",") === "P3,P4";
      })(),
      malformedGroupsNeverThrow: (function () {
        let threw = false;
        let out = null;
        try {
          out = keyboardPairs(KP_MALFORMED_MODEL);
        } catch (e) {
          threw = true;
        }
        return threw === false && Array.isArray(out) && out.length === 0;
      })(),
      doesNotMutateModel: (function () {
        const before = JSON.stringify(KP_TWO_PAIRS_MODEL);
        keyboardPairs(KP_TWO_PAIRS_MODEL);
        return JSON.stringify(KP_TWO_PAIRS_MODEL) === before;
      })(),
      // Regression: the existing grouping seams are untouched by a model that
      // carries partGroups.
      groupNotesUnaffectedByGroups: (function () {
        const g = groupNotes(KP_REGRESSION_MODEL.parts[0].measures[0].notes);
        return g.length === 2 && g[0].length === 3 && g[1].length === 1;
      })(),
      groupByStaffUnaffectedByGroups: (function () {
        const g = groupByStaff(KP_REGRESSION_MODEL.parts[0].measures[0].notes);
        return g.length === 2 && g[0].staff === "1" && g[1].staff === "2" &&
          g[0].notes.length === 3 && g[1].notes.length === 1;
      })(),
      groupByVoiceUnaffectedByGroups: (function () {
        const g = groupByVoice(KP_REGRESSION_MODEL.parts[0].measures[0].notes);
        return g.length === 1 && g[0].voice === null && g[0].notes.length === 4;
      })(),
      // Dynamic shaping carried through the descriptor whitelist (Stage 58). The
      // field arrives RAW: two endpoint lists, unmapped, by reference. Nothing
      // voices it until Stage 59.
      describeSurfacesShapingStart: (function () {
        const s = dShapingStart.shaping;
        return !!s && Array.isArray(s.starts) && s.starts.length === 1 &&
          s.starts[0] === "crescendo" && Array.isArray(s.stops) && s.stops.length === 0;
      })(),
      describeSurfacesTwoStopsInOrder: (function () {
        const s = dShapingTwoStops.shaping;
        return !!s && s.stops.length === 2 && s.stops.join(",") === "diminuendo,crescendo";
      })(),
      describeSurfacesOneOfEachIntact: (function () {
        const s = dShapingOneEach.shaping;
        return !!s && s.starts.length === 1 && s.starts[0] === "diminuendo" &&
          s.stops.length === 1 && s.stops[0] === "crescendo";
      })(),
      describePlainShapingStrictlyNull: dPlain.shaping === null && dRich.shaping === null,
      // Carried RAW: not mapped, not flattened to a string, not coerced to a
      // boolean, and the SAME object the note holds rather than a copy.
      describeShapingCarriedRawByReference:
        dShapingStart.shaping === shapingStartNote.shaping &&
        typeof dShapingStart.shaping === "object",
      // A chord reads shaping from the same note it reads dynamic from: the head.
      // A member contributes nothing, exactly as it contributes no dynamic.
      describeChordShapingFromSameNoteAsDynamic: (function () {
        const g = groupNotes(shapingChordNotes);
        if (g.length !== 1 || g[0].length !== 3) return false;
        const dHead = describeNote(g[0][0]);
        return dHead.dynamic === "forte" && !!dHead.shaping &&
          dHead.shaping.starts.join(",") === "crescendo";
      })(),
      describeChordMemberContributesNoShaping: (function () {
        const g = groupNotes(shapingChordNotes);
        const dMemberOne = describeNote(g[0][1]);
        const dMemberTwo = describeNote(g[0][2]);
        return dMemberOne.shaping === null && dMemberOne.dynamic === null &&
          dMemberTwo.shaping === null && dMemberTwo.dynamic === null;
      })(),
      // The existing descriptor fields are untouched on a note that also carries
      // shaping, so the widened whitelist dropped nothing.
      describeExistingFieldsUnaffectedByShaping:
        dShapingWithExtras.pitch === "F4" &&
        dShapingWithExtras.value === "crotchet" &&
        dShapingWithExtras.isRest === false &&
        dShapingWithExtras.dynamic === "forte" &&
        dShapingWithExtras.lyric === "la" &&
        !!dShapingWithExtras.tie && dShapingWithExtras.tie.start === true &&
        !!dShapingWithExtras.slur && dShapingWithExtras.slur.start === true &&
        dShapingWithExtras.tuplet === null &&
        dShapingWithExtras.articulations === null &&
        dShapingWithExtras.ornaments === null,
      // The key is present on EVERY descriptor, shaped or not, in every model.
      describeShapingKeyOnEveryDescriptor: everyDescriptorOwnsShaping(SHAPING_MODEL),
      simpleModelEveryDescriptorShapingNull: (function () {
        if (!everyDescriptorOwnsShaping(MODEL)) return false;
        return MODEL.parts.every(function (part) {
          return part.measures.every(function (measure) {
            return measure.notes.every(function (note) {
              return describeNote(note).shaping === null;
            });
          });
        });
      })(),
      // Chord symbols carried through the descriptor whitelist as the SPOKEN NAME
      // (Stage 63), mapped through MusicNames.chordSymbolName exactly as dynamic is
      // mapped through dynamicName. Nothing voices it until Stage 64.
      describeSurfacesHarmonyName: dHarmonyPlain.harmony === "C major",
      describeSurfacesHarmonyAlteredRootAndBass: dHarmonyAltered.harmony === "F sharp minor over A sharp",
      describeHarmonyUnmappedKindFallsBack: describeNote(harmonyUnmappedKindNote).harmony === "G major seventh",
      // A zero alter is suppressed by the namer, so "natural" never reaches a chord
      // name even though pitchLabel spells it for a pitch.
      describeHarmonyZeroAlterUnspoken: (function () {
        const h = describeNote(harmonyZeroAlterNote).harmony;
        return h === "C major over G" && /natural/.test(h) === false;
      })(),
      describePlainHarmonyStrictlyNull: dPlain.harmony === null && dRich.harmony === null,
      // A note with no harmony must not reach the namer at all: the guard short
      // circuits before the call. Spied by swapping the namer on the shared names
      // object and restoring it in a finally, so no later row sees the spy.
      describePlainHarmonyNamerNotCalled: (function () {
        if (typeof names.chordSymbolName !== "function") return describeNote(plainNote).harmony === null;
        const realChordSymbolName = names.chordSymbolName;
        let calls = 0;
        let out = "unset";
        try {
          names.chordSymbolName = function (h) { calls += 1; return realChordSymbolName(h); };
          out = describeNote(plainNote).harmony;
        } catch (e) {
          calls = -1;
        } finally {
          names.chordSymbolName = realChordSymbolName;
        }
        return calls === 0 && out === null && names.chordSymbolName === realChordSymbolName;
      })(),
      // A malformed record yields null and never throws, whatever shape it is.
      describeMalformedHarmonyNullNoThrow: (function () {
        let threw = false;
        let record = "unset";
        let str = "unset";
        let num = "unset";
        let arr = "unset";
        try {
          record = describeNote(harmonyMalformedRecordNote).harmony;
          str = describeNote(harmonyMalformedStringNote).harmony;
          num = describeNote(harmonyMalformedNumberNote).harmony;
          arr = describeNote(harmonyMalformedArrayNote).harmony;
        } catch (e) {
          threw = true;
        }
        return threw === false && record === null && str === null && num === null && arr === null;
      })(),
      // The descriptor carries WORDS, not codes: a string, and not the raw record
      // the note holds. This is the division that puts "forte" on the descriptor
      // rather than "f", and it is what separates harmony from shaping.
      describeHarmonyCarriedAsStringNotRawObject: (function () {
        return typeof dHarmonyPlain.harmony === "string" &&
          typeof harmonyPlainNote.harmony === "object" &&
          dHarmonyPlain.harmony !== harmonyPlainNote.harmony;
      })(),
      // The whitelist is now twelve fields, named and ordered.
      describeFieldCountNowTwelve: (function () {
        const keys = Object.keys(dHarmonyWithExtras);
        return keys.length === 12 &&
          keys.join(",") === "isRest,pitch,value,dynamic,lyric,tie,slur,tuplet,articulations,ornaments,shaping,harmony";
      })(),
      // A chord reads harmony from the same note it reads dynamic from: the head.
      // A member contributes nothing, exactly as it contributes no dynamic.
      describeChordHarmonyFromSameNoteAsDynamic: (function () {
        const g = groupNotes(harmonyChordNotes);
        if (g.length !== 1 || g[0].length !== 3) return false;
        const dHead = describeNote(g[0][0]);
        return dHead.dynamic === "forte" && dHead.harmony === "C major";
      })(),
      describeChordMemberContributesNoHarmony: (function () {
        const g = groupNotes(harmonyChordNotes);
        const dMemberOne = describeNote(g[0][1]);
        const dMemberTwo = describeNote(g[0][2]);
        return dMemberOne.harmony === null && dMemberOne.dynamic === null &&
          dMemberTwo.harmony === null && dMemberTwo.dynamic === null;
      })(),
      // The existing descriptor fields are untouched on a note that also carries a
      // harmony, so the widened whitelist dropped nothing. shaping in particular
      // stays RAW and by reference while harmony arrives named.
      describeExistingFieldsUnaffectedByHarmony:
        dHarmonyWithExtras.pitch === "F4" &&
        dHarmonyWithExtras.value === "crotchet" &&
        dHarmonyWithExtras.isRest === false &&
        dHarmonyWithExtras.dynamic === "forte" &&
        dHarmonyWithExtras.lyric === "la" &&
        !!dHarmonyWithExtras.tie && dHarmonyWithExtras.tie.start === true &&
        !!dHarmonyWithExtras.slur && dHarmonyWithExtras.slur.start === true &&
        dHarmonyWithExtras.tuplet === null &&
        dHarmonyWithExtras.articulations === null &&
        dHarmonyWithExtras.ornaments === null &&
        dHarmonyWithExtras.shaping === harmonyWithExtrasNote.shaping &&
        dHarmonyWithExtras.harmony === "B flat major",
      // The key is present on EVERY descriptor, harmonised or not, in every model.
      describeHarmonyKeyOnEveryDescriptor: everyDescriptorOwnsHarmony(HARMONY_MODEL),
      simpleModelEveryDescriptorHarmonyNull: (function () {
        if (!everyDescriptorOwnsHarmony(MODEL)) return false;
        return MODEL.parts.every(function (part) {
          return part.measures.every(function (measure) {
            return measure.notes.every(function (note) {
              return describeNote(note).harmony === null;
            });
          });
        });
      })(),
      // --- Stage 68: the aggregate dynamics helper (M1-05) ---------------------
      hasDynamicsOverview: typeof dynamicsOverview === "function",
      dynamicsRangeAcrossTwo: (function () {
        const d = dynamicsOverview(DYN_TWO);
        return !!d && d.softest === "pianissimo" && d.loudest === "forte";
      })(),
      // The SAME two codes in the reverse document order give the identical result,
      // proving first-appearance order is discarded and the rank alone decides.
      dynamicsRangeIgnoresOrder: (function () {
        const forward = dynamicsOverview(DYN_TWO);
        const reversed = dynamicsOverview(DYN_TWO_REVERSED);
        return !!forward && !!reversed &&
          reversed.softest === forward.softest && reversed.loudest === forward.loudest &&
          reversed.softest === "pianissimo" && reversed.loudest === "forte";
      })(),
      dynamicsSingleValueBothEnds: (function () {
        const d = dynamicsOverview(DYN_SINGLE);
        return !!d && d.softest === "mezzo-forte" && d.loudest === "mezzo-forte";
      })(),
      // The returned strings are full NAMES, not the raw codes they came from.
      dynamicsNamesNotCodes: (function () {
        const d = dynamicsOverview(DYN_TWO);
        return !!d && d.softest !== "pp" && d.loudest !== "f";
      })(),
      dynamicsNullWhenNothing: dynamicsOverview(DYN_NOTHING) === null,
      dynamicsShapingOnlyGivesNulls: (function () {
        const d = dynamicsOverview(DYN_SHAPING_ONLY);
        return !!d && d.softest === null && d.loudest === null;
      })(),
      dynamicsShapingStartsCounted: (function () {
        const d = dynamicsOverview(DYN_STARTS_NO_STOPS);
        return !!d && d.shapingStarts === 3;
      })(),
      // The real Palestrina case: starts the file never closes. The two counts are
      // asserted as literals, so a pairing assumption could not read as a pass.
      dynamicsStartsWithoutStops: (function () {
        const d = dynamicsOverview(DYN_STARTS_NO_STOPS);
        return !!d && d.shapingStarts === 3 && d.shapingStops === 0;
      })(),
      dynamicsUnrankableSkipped: (function () {
        const d = dynamicsOverview(DYN_WITH_ACCENT);
        return !!d && d.softest === "piano" && d.loudest === "forte";
      })(),
      dynamicsOnlyUnrankableNullEnds: dynamicsOverview(DYN_ACCENT_ONLY) === null,
      dynamicsNeverThrows: (function () {
        try {
          dynamicsOverview(null);
          dynamicsOverview(undefined);
          dynamicsOverview({});
          dynamicsOverview({ parts: null });
          dynamicsOverview({ parts: [{ id: "P1", measures: [{ number: "1", notes: "not an array" }] }] });
          return true;
        } catch (e) {
          return false;
        }
      })(),
    };

    console.table(results);
    return results;
  }

  return { describeNote, pitchLabel, pitchRange, noteValueCounts, hasLyrics, dynamicsOverview, groupNotes, groupByStaff, groupByVoice, keyboardPairs, selfTest };
})();

window.MusicModelWalk = MusicModelWalk;
