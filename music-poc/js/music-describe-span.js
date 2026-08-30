// music-describe-span.js
// Bar-range description service for the Accessible Music proof of concept.
//
// A pure, stateless service: it owns no DOM, caches nothing and renders nothing.
// It exposes spanSummary(model, fromIndex, toIndex), which returns a short prose
// summary of ONE BAR RANGE as a string, and spanModelOf(model, fromIndex,
// toIndex), which returns the sub-model that summary is composed from. The second
// is public because the per-page screenshot work needs the SAME selection, and two
// independent selections would drift.
//
// It is the nearest sibling of music-render-summary.js and follows that file's
// composition pattern deliberately — a sentence list, one clause per fact, each
// clause omitted when its input is null — so a span reads like the piece summary
// rather than like a second voice. What it does NOT share is the piece-level
// facts: a span carries no part count, no key or meter, no tempo and no staff
// count, because those describe the whole piece and repeating them on every span
// would be noise.
//
// THE PIECE-BOOLEAN TRAP, which is the reason this module derives structure the
// long way. model.hasRepeat, model.hasKeyChange and model.hasClefChange are
// PIECE-level booleans set once by the parser over the whole part. A sub-model
// carries them through unchanged — it must, because they are part of the model's
// shape — so reading them here would make a span claim a repeat that happens
// somewhere else entirely. Every structural sentence below is therefore derived
// from the SLICED MEASURES' own fields (keyChange, clefChange, repeatTo,
// endingStart, endingStop, rehearsal), never from a piece boolean.
//
// Like the summary it is SYNCHRONOUS, it never notifies, and it NEVER throws: on
// bad input it logs and returns null. Exposed as window.MusicDescribeSpan. It is
// attached to window rather than globalThis, and is not node-runnable, because it
// reads MusicModelWalk and MusicNames.

const MusicDescribeSpan = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side model walking: route through the shared MusicModelWalk when
  // present, otherwise fall back to neutral results so this file never throws if
  // the model-walk layer is absent.
  // Every method this module calls must be declared here. The stub exists so a
  // page missing the real module produces a degraded span rather than throwing,
  // and a method called but not stubbed defeats that. Each returns the value that
  // means "omit this clause": a null helper result routes into the clause's own
  // absent branch rather than into a special case.
  const walk = window.MusicModelWalk || {
    pitchRange() { return null; },
    noteValueCounts() { return {}; },
    hasLyrics() { return false; },
    dynamicsOverview() { return null; },
  };

  // Consumer-side naming: route through the shared MusicNames when present,
  // otherwise fall back to a neutral result so this file never throws if the
  // names layer is absent.
  // Every method this module calls must be declared here, on the same terms as
  // the walk stub above. A null name does NOT silence the sentence that would
  // have carried it: an unnamed key change still reads "The key changes at bar
  // 8", because a structural event a reader can navigate to is worth more than
  // the word for it, and dropping the sentence would hide the event entirely.
  const names = window.MusicNames || {
    keySignatureName() { return null; },
    clefName() { return null; },
    endingName() { return null; },
  };

  // The per-bar structural fields this module merges across parts. Held as an
  // explicit list rather than reached with for...in, so no inherited Object
  // member can join the set — the hazard STEP_INDEX and DYNAMIC_INDEX in
  // music-model-walk.js were both hardened against.
  const STRUCTURE_FIELDS = Object.freeze([
    "number",
    "keyChange",
    "clefChange",
    "repeatTo",
    "endingStart",
    "endingStop",
    "rehearsal",
  ]);

  // A bar number fit to SPEAK, or null. The parser carries measure.number
  // VERBATIM from the file — a raw string, with no fallback and no normalisation
  // — so it can be null, empty, non-numeric ("1a") or non-sequential. This
  // returns the trimmed text when there is any, and null otherwise, so a caller
  // can choose counting language instead of inventing a number. Nothing in this
  // module ever does arithmetic on a bar number.
  function speakableNumber(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text === "" ? null : text;
  }

  // Join a list of phrases into readable prose: "a", "a and b", "a, b and c".
  // Matches the joining in music-render-phrase.js so the two read alike.
  function joinList(items) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  // Find the note-value name with the highest count in a counts object, or null
  // when the object is empty. Ties are resolved arbitrarily (first seen wins).
  //
  // A PRIVATE COPY of the picker in music-render-summary.js, which is private to
  // that module and not exported. The two are independent and nothing keeps them
  // in step, so an edit to either must be checked against the other; they are
  // deliberately NOT merged, following the precedent STEP_INDEX sets across
  // music-model-walk.js and music-transpose.js.
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

  // spanModelOf(model, fromIndex, toIndex): pure; NEVER throws; never mutates the
  // model. Returns a sub-model holding only the measures from fromIndex to
  // toIndex INCLUSIVE, or null when the selection is empty or invalid.
  //
  // The indices are INDICES INTO PART 0's measures, following the part-0
  // bar-count convention this codebase already uses for "how many bars are in
  // this piece" (music-render-summary.js and music-pdf.js both read
  // model.parts[0].measures.length). They are NOT bar numbers: a bar number is a
  // verbatim string from the file and may be "0", "1a" or non-sequential, so it
  // cannot be indexed with.
  //
  // SHAPE: the model is spread, and each part is spread with its measures sliced.
  // The measure objects themselves are NOT copied, so every measure — and
  // therefore every note array and every note — is shared BY REFERENCE with the
  // original, exactly as groupNotes/groupByStaff/groupByVoice in
  // music-model-walk.js share theirs. A consumer reading a note out of a
  // sub-model and a consumer reading it out of the whole model hold the same
  // object and cannot drift.
  //
  // PIECE-LEVEL FIELDS ARE CARRIED THROUGH UNCHANGED — workTitle, divisions, key,
  // time, tempo, staves, partGroups, and the three has* booleans. That is
  // deliberate: the sub-model must still be a valid model for the walk to read.
  // It is also why spanSummary must never read the has* booleans; see the header.
  //
  // A toIndex past the last bar is CLAMPED rather than refused, because a caller
  // asking for the last page of a score reasonably overshoots, and a hard null
  // there would be a surprising failure. A fromIndex out of range, a non-integer
  // index, or toIndex below fromIndex is refused with null.
  function spanModelOf(model, fromIndex, toIndex) {
    if (!model || typeof model !== "object" || !Array.isArray(model.parts)) {
      logError("Cannot build a span: model is missing or has no parts array");
      return null;
    }
    const firstPart = model.parts[0];
    const barCount = firstPart && Array.isArray(firstPart.measures) ? firstPart.measures.length : 0;
    if (barCount === 0) {
      logWarn("Cannot build a span: the model's first part has no measures");
      return null;
    }
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
      logWarn("Cannot build a span: the indices must be integers");
      return null;
    }
    if (fromIndex < 0 || fromIndex >= barCount) {
      logWarn("Cannot build a span: fromIndex " + fromIndex + " is outside 0 to " + (barCount - 1));
      return null;
    }
    if (toIndex < fromIndex) {
      logWarn("Cannot build a span: toIndex " + toIndex + " is before fromIndex " + fromIndex);
      return null;
    }

    const lastIndex = toIndex >= barCount ? barCount - 1 : toIndex;
    if (lastIndex !== toIndex) {
      logDebug("Span toIndex " + toIndex + " clamped to the last bar index " + lastIndex);
    }

    // slice is end-EXCLUSIVE, so the inclusive range needs lastIndex + 1.
    const sliceEnd = lastIndex + 1;
    return Object.assign({}, model, {
      parts: model.parts.map(function (part) {
        const measures = part && Array.isArray(part.measures) ? part.measures : [];
        return Object.assign({}, part, { measures: measures.slice(fromIndex, sliceEnd) });
      }),
    });
  }

  // Merge the parts' measures at one bar index into a single structural row: the
  // FIRST NON-NULL of the parts for each field. Mirrors the keyboard merge in
  // music-render-text.js, where a structural mark printed on one staff of a grand
  // staff belongs to the bar rather than to that staff. Reading part 0 alone
  // would silently drop a key change engraved only in a lower part.
  function structureAt(spanModel, index) {
    const row = {};
    for (const field of STRUCTURE_FIELDS) row[field] = null;
    for (const part of spanModel.parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      const measure = measures[index];
      if (!measure) continue;
      for (const field of STRUCTURE_FIELDS) {
        if (row[field] === null && measure[field] !== null && measure[field] !== undefined) {
          row[field] = measure[field];
        }
      }
    }
    return row;
  }

  // The naming sentence: "Bars 6 to 10.", or "Bar 6." for a single bar, built
  // from measure.number VERBATIM. When either endpoint has no speakable number
  // the sentence falls back to COUNTING language ("5 bars.") rather than
  // inventing numbers from the indices — an index is not a bar number, and a
  // pickup bar numbered "0" makes the two differ for the whole rest of the piece.
  function namingSentence(rows) {
    const count = rows.length;
    const first = speakableNumber(rows[0].number);
    const last = speakableNumber(rows[count - 1].number);
    if (count === 1) return first ? "Bar " + first + "." : "1 bar.";
    if (first && last) return "Bars " + first + " to " + last + ".";
    logDebug("A span endpoint carries no bar number; naming the span by count instead");
    return count + " bars.";
  }

  // Each structural sentence below reads the MERGED ROWS and nothing else. The
  // clause order follows barLabelOf in music-render-text.js — rehearsal, ending,
  // key, clef, repeat — so a reader meeting both surfaces hears the same order.
  function structureSentences(rows) {
    const sentences = [];

    const marks = rows.filter(function (row) {
      return typeof row.rehearsal === "string" && row.rehearsal.trim() !== "";
    });
    if (marks.length > 0) {
      // The engraver's own text, carried VERBATIM — not trimmed to a shape, not
      // mapped — so the Joplin's "B.1" reads as "B.1". A rehearsal mark is an
      // OPEN set, which is why no music-names lookup exists for it.
      const phrases = marks.map(function (row) {
        const at = speakableNumber(row.number);
        return row.rehearsal + (at ? " at bar " + at : "");
      });
      sentences.push(
        (marks.length === 1 ? "Rehearsal mark " : "Rehearsal marks ") + joinList(phrases) + "."
      );
    }

    const endingStarts = rows.filter(function (row) { return row.endingStart; });
    const endingStops = rows.filter(function (row) { return row.endingStop; });
    if (endingStarts.length > 0) {
      const phrases = endingStarts.map(function (row) {
        const name = names.endingName(row.endingStart);
        const at = speakableNumber(row.number);
        return (name ? "a " + name : "an ending") + (at ? " at bar " + at : "");
      });
      sentences.push("There is " + joinList(phrases) + ".");
    } else if (endingStops.length > 0) {
      // A stop with no start means the ending opened BEFORE this span. Saying so
      // is worth a sentence: it tells a reader the span sits inside a volta.
      const phrases = endingStops.map(function (row) {
        const at = speakableNumber(row.number);
        return at ? "at bar " + at : "here";
      });
      sentences.push(
        (endingStops.length === 1 ? "An ending finishes " : "Endings finish ") + joinList(phrases) + "."
      );
    }

    const keyChanges = rows.filter(function (row) { return row.keyChange; });
    if (keyChanges.length > 0) {
      const phrases = keyChanges.map(function (row) {
        const name = names.keySignatureName(row.keyChange.fifths);
        const at = speakableNumber(row.number);
        if (name && at) return "to " + name + " at bar " + at;
        if (name) return "to " + name;
        if (at) return "at bar " + at;
        return null;
      }).filter(Boolean);
      if (phrases.length > 0) sentences.push("The key changes " + joinList(phrases) + ".");
    }

    const clefChanges = rows.filter(function (row) { return row.clefChange; });
    if (clefChanges.length > 0) {
      const phrases = clefChanges.map(function (row) {
        const name = names.clefName(row.clefChange.sign, row.clefChange.line);
        const at = speakableNumber(row.number);
        if (name && at) return "to " + name + " at bar " + at;
        if (name) return "to " + name;
        if (at) return "at bar " + at;
        return null;
      }).filter(Boolean);
      if (phrases.length > 0) sentences.push("The clef changes " + joinList(phrases) + ".");
    }

    const repeats = rows.filter(function (row) { return speakableNumber(row.repeatTo) !== null; });
    if (repeats.length > 0) {
      const phrases = repeats.map(function (row) {
        const at = speakableNumber(row.number);
        const to = speakableNumber(row.repeatTo);
        return (at ? "bar " + at + " " : "") + "back to bar " + to;
      });
      sentences.push("The music repeats from " + joinList(phrases) + ".");
    }

    return sentences;
  }

  // spanSummary(model, fromIndex, toIndex): pure; NEVER throws. Returns a short
  // prose summary of the bar range as a single string, or null when the selection
  // is empty or invalid. Each clause is omitted when its input is null, matching
  // the degradation pattern in music-render-summary.js, so a span of untyped
  // rests still names its bars and says nothing it cannot support.
  //
  // The try/catch is a BACKSTOP, not the mechanism: every guard below stands on
  // its own and the walk's four aggregates are each documented "pure; NEVER
  // throws". It exists because a stubbed or future helper could throw and a span
  // description is never worth taking a page down for. It logs at ERROR so a
  // swallowed fault is still visible.
  function spanSummary(model, fromIndex, toIndex) {
    try {
      const spanModel = spanModelOf(model, fromIndex, toIndex);
      if (!spanModel) return null;

      const firstPart = spanModel.parts[0];
      const measures = firstPart && Array.isArray(firstPart.measures) ? firstPart.measures : [];
      if (measures.length === 0) {
        logWarn("Cannot summarise a span: the selection holds no bars");
        return null;
      }

      const rows = [];
      for (let i = 0; i < measures.length; i++) rows.push(structureAt(spanModel, i));

      const sentences = [namingSentence(rows)];

      const range = walk.pitchRange(spanModel);
      if (range && range.lowest && range.highest) {
        if (range.lowest === range.highest) sentences.push("All notes are at " + range.lowest + ".");
        else sentences.push("The pitch ranges from " + range.lowest + " to " + range.highest + ".");
      }

      const dominant = dominantNoteValue(walk.noteValueCounts(spanModel));
      if (dominant) sentences.push("The notes are mostly " + dominant + "s.");

      // Dynamics. Shaping STARTS are voiced and stops are not, for the reason
      // music-render-summary.js records: a start is a change a listener hears,
      // and Palestrina's crescendo starts have no stops at all.
      const dynamics = walk.dynamicsOverview(spanModel);
      if (dynamics) {
        const starts = dynamics.shapingStarts;
        const changes = starts + (starts === 1 ? " gradual change in volume" : " gradual changes in volume");
        if (dynamics.softest && dynamics.loudest) {
          const spread = dynamics.softest === dynamics.loudest
            ? "The only dynamic marking is " + dynamics.softest
            : "The dynamics run from " + dynamics.softest + " to " + dynamics.loudest;
          sentences.push(starts > 0 ? spread + ", with " + changes + "." : spread + ".");
        } else if (starts > 0) {
          sentences.push("The music has " + changes + ".");
        }
      }

      // Structure derived from the SLICED MEASURES, never from model.hasRepeat,
      // model.hasKeyChange or model.hasClefChange. See the header.
      for (const sentence of structureSentences(rows)) sentences.push(sentence);

      if (walk.hasLyrics(spanModel)) sentences.push("It has lyrics.");

      return sentences.join(" ");
    } catch (e) {
      logError("spanSummary failed and returned null", e);
      return null;
    }
  }

  // Self-test: synchronous and self-contained. Every model below is BUILT BY HAND
  // in this file — no fixture is read, so a change to the corpus cannot move a
  // row. Needs MusicModelWalk loaded for real facts and MusicNames for the key,
  // clef and ending names. console.table()s and returns the results object.
  function selfTest() {
    // A plain crotchet, and a part builder, in the compressed literal style
    // music-render-summary.js uses for its Stage 69 fixtures.
    function note(step, octave, extra) {
      return Object.assign(
        { rest: false, chord: false, step: step, octave: octave, duration: 1, type: "quarter" },
        extra || {}
      );
    }
    function bar(number, notes, structure) {
      return Object.assign(
        { number: number, notes: notes, clefChange: null, keyChange: null, repeatTo: null,
          endingStart: null, endingStop: null, rehearsal: null },
        structure || {}
      );
    }
    function modelOf(measures, extra) {
      return Object.assign(
        { workTitle: "Span fixture", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
          tempo: 120, staves: 1, parts: [{ id: "P1", name: "Melody", measures: measures }] },
        extra || {}
      );
    }

    // TEN bars numbered 1 to 10, each one crotchet, ascending so a slice has its
    // own pitch range distinct from the whole piece.
    const STEPS = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E"];
    const OCTAVES = [4, 4, 4, 4, 4, 4, 4, 5, 5, 5];
    const TEN = modelOf(STEPS.map(function (step, i) {
      return bar(String(i + 1), [note(step, OCTAVES[i])]);
    }));

    // FILTER ROWS -----------------------------------------------------------
    const sub = spanModelOf(TEN, 5, 9);
    const filterSliced = !!sub && sub.parts[0].measures.length === 5;
    const filterFirstBarIsSix = !!sub && sub.parts[0].measures[0].number === "6";
    // Reference identity, the grouping helpers' contract: the sub-model's notes
    // are the SAME objects, not copies. Asserted on the note AND on its measure.
    const filterKeepsNotesByReference =
      !!sub && sub.parts[0].measures[0].notes[0] === TEN.parts[0].measures[5].notes[0];
    const filterKeepsMeasuresByReference =
      !!sub && sub.parts[0].measures[0] === TEN.parts[0].measures[5];
    const filterCarriesPieceFields =
      !!sub && sub.workTitle === "Span fixture" && sub.divisions === 1 &&
      sub.key === TEN.key && sub.time === TEN.time && sub.tempo === 120 && sub.staves === 1;
    const filterKeepsPartMetadata = !!sub && sub.parts[0].id === "P1" && sub.parts[0].name === "Melody";
    const filterDoesNotMutateSource = TEN.parts[0].measures.length === 10;

    // Every part is sliced, not only part 0.
    const TWO_PART = {
      parts: [
        { id: "P1", measures: [bar("1", [note("C", 4)]), bar("2", [note("D", 4)]), bar("3", [note("E", 4)])] },
        { id: "P2", measures: [bar("1", [note("C", 3)]), bar("2", [note("D", 3)]), bar("3", [note("E", 3)])] },
      ],
    };
    const twoPartSub = spanModelOf(TWO_PART, 1, 2);
    const filterSlicesEveryPart =
      !!twoPartSub && twoPartSub.parts[0].measures.length === 2 && twoPartSub.parts[1].measures.length === 2;

    // A toIndex past the end clamps; a fromIndex past the end refuses.
    const clamped = spanModelOf(TEN, 8, 99);
    const filterClampsOverrunToIndex = !!clamped && clamped.parts[0].measures.length === 2;
    const filterNullOnFromIndexPastEnd = spanModelOf(TEN, 10, 12) === null;
    const filterNullOnReversedRange = spanModelOf(TEN, 6, 2) === null;
    const filterNullOnNonIntegerIndex = spanModelOf(TEN, 1.5, 4) === null;
    const filterNullOnNullModel = spanModelOf(null, 0, 1) === null;
    const filterNullOnNoMeasures = spanModelOf({ parts: [{ id: "P1", measures: [] }] }, 0, 1) === null;

    // NAMING ROWS -----------------------------------------------------------
    const namesRange = spanSummary(TEN, 5, 9).indexOf("Bars 6 to 10.") === 0;
    const namesSingleBar = spanSummary(TEN, 5, 5).indexOf("Bar 6.") === 0;

    // Bar numbers are VERBATIM: a span starting at bar "7" must not read "Bars 1
    // to ...". This is the index-arithmetic row, and it fails if anyone ever
    // computes a number from an index.
    const namesNoIndexArithmetic = spanSummary(TEN, 6, 8).indexOf("Bars 7 to 9.") === 0;

    // A non-numeric number passes through unchanged.
    const ODD_NUMBERED = modelOf([
      bar("1a", [note("C", 4)]), bar("1b", [note("D", 4)]), bar("2", [note("E", 4)]),
    ]);
    const namesNonNumericVerbatim = spanSummary(ODD_NUMBERED, 0, 1).indexOf("Bars 1a to 1b.") === 0;
    const namesNonNumericSingleBar = spanSummary(ODD_NUMBERED, 0, 0).indexOf("Bar 1a.") === 0;

    // A null or empty endpoint falls back to counting language, at either end.
    const NULL_FIRST = modelOf([
      bar(null, [note("C", 4)]), bar("2", [note("D", 4)]), bar("3", [note("E", 4)]),
    ]);
    const NULL_LAST = modelOf([
      bar("1", [note("C", 4)]), bar("2", [note("D", 4)]), bar(null, [note("E", 4)]),
    ]);
    const EMPTY_NUMBER = modelOf([bar("   ", [note("C", 4)]), bar("2", [note("D", 4)])]);
    const namesFallsBackWhenFirstNull =
      spanSummary(NULL_FIRST, 0, 2).indexOf("3 bars.") === 0 &&
      spanSummary(NULL_FIRST, 0, 2).indexOf("Bars ") === -1;
    const namesFallsBackWhenLastNull = spanSummary(NULL_LAST, 0, 2).indexOf("3 bars.") === 0;
    const namesFallsBackOnEmptyString = spanSummary(EMPTY_NUMBER, 0, 1).indexOf("2 bars.") === 0;
    const namesFallsBackSingularOneBar = spanSummary(NULL_FIRST, 0, 0).indexOf("1 bar.") === 0;

    // CLAUSE PRESENT / OMITTED ----------------------------------------------
    const tenSixToTen = spanSummary(TEN, 5, 9);
    const clausePitchPresent = tenSixToTen.indexOf("The pitch ranges from A4 to E5.") !== -1;
    const clausePitchIsSpanLocalNotWholePiece = tenSixToTen.indexOf("C4") === -1;
    const clauseDominantPresent = tenSixToTen.indexOf("The notes are mostly crotchets.") !== -1;

    const SINGLE_PITCH = modelOf([bar("1", [note("C", 4)]), bar("2", [note("C", 4)])]);
    const clausePitchSinglePitch =
      spanSummary(SINGLE_PITCH, 0, 1).indexOf("All notes are at C4.") !== -1;

    // All rests: no pitched note, and no type either, so both clauses go.
    const ALL_RESTS = modelOf([
      bar("1", [{ rest: true, step: null, octave: null, duration: 1, type: null }]),
      bar("2", [{ rest: true, step: null, octave: null, duration: 1, type: null }]),
    ]);
    const restsText = spanSummary(ALL_RESTS, 0, 1);
    const clausePitchOmittedWhenAllRests =
      restsText.indexOf("pitch") === -1 && restsText.indexOf("All notes are at") === -1;
    const clauseDominantOmittedWhenNoTypes = restsText.indexOf("mostly") === -1;
    const clauseNamingSurvivesEmptyContent = restsText === "Bars 1 to 2.";

    const DYNAMICS = modelOf([
      bar("1", [note("C", 4, { dynamic: "p", shaping: { starts: [{ type: "crescendo" }], stops: [] } })]),
      bar("2", [note("D", 4, { dynamic: "f" })]),
    ]);
    const clauseDynamicsPresent =
      spanSummary(DYNAMICS, 0, 1).indexOf("The dynamics run from piano to forte, with 1 gradual change in volume.") !== -1;
    const clauseDynamicsOmittedWhenNone =
      tenSixToTen.toLowerCase().indexOf("dynamic") === -1 &&
      tenSixToTen.toLowerCase().indexOf("gradual") === -1;
    // The dynamics clause must be SPAN-LOCAL: a marking outside the span is silent.
    const clauseDynamicsOutsideSpanOmitted =
      spanSummary(DYNAMICS, 1, 1).indexOf("The only dynamic marking is forte.") !== -1;

    const LYRICS = modelOf([bar("1", [note("C", 4, { lyric: "la" })]), bar("2", [note("D", 4)])]);
    const clauseLyricsPresent = spanSummary(LYRICS, 0, 1).indexOf("It has lyrics.") !== -1;
    const clauseLyricsOmittedWhenNone = tenSixToTen.toLowerCase().indexOf("lyric") === -1;
    const clauseLyricsOutsideSpanOmitted =
      spanSummary(LYRICS, 1, 1).toLowerCase().indexOf("lyric") === -1;

    // STRUCTURE ROWS --------------------------------------------------------
    // Every has* boolean is TRUE on this model, and the structural events sit in
    // bars 1 and 2 only. A span over bars 3 and 4 must therefore mention NONE of
    // them — that is the piece-boolean trap, and it is the reason this module
    // derives structure from the sliced measures.
    const STRUCTURE = modelOf(
      [
        bar("1", [note("C", 4)], { rehearsal: "A", keyChange: { fifths: 1 } }),
        bar("2", [note("D", 4)], {
          clefChange: { sign: "F", line: 4 }, repeatTo: "1", endingStart: "1",
        }),
        bar("3", [note("E", 4)]),
        bar("4", [note("F", 4)]),
      ],
      { hasRepeat: true, hasKeyChange: true, hasClefChange: true }
    );
    const structureInSpan = spanSummary(STRUCTURE, 0, 1);
    const structureOutOfSpan = spanSummary(STRUCTURE, 2, 3);

    const structRehearsalPresent = structureInSpan.indexOf("Rehearsal mark A at bar 1.") !== -1;
    const structKeyChangePresent = structureInSpan.indexOf("The key changes to G major at bar 1.") !== -1;
    const structClefChangePresent = structureInSpan.indexOf("The clef changes to bass at bar 2.") !== -1;
    const structRepeatPresent = structureInSpan.indexOf("The music repeats from bar 2 back to bar 1.") !== -1;
    const structEndingPresent = structureInSpan.indexOf("There is a first-time ending at bar 2.") !== -1;

    // THE PIECE-BOOLEAN TRAP, one row per boolean. Each asserts the model really
    // does carry the boolean, so the row cannot pass because the fixture lost it.
    const trapHasRepeatSetButNoRepeatSentence =
      STRUCTURE.hasRepeat === true && structureOutOfSpan.indexOf("repeat") === -1;
    const trapHasKeyChangeSetButNoKeySentence =
      STRUCTURE.hasKeyChange === true && structureOutOfSpan.indexOf("key change") === -1 &&
      structureOutOfSpan.indexOf("The key changes") === -1;
    const trapHasClefChangeSetButNoClefSentence =
      STRUCTURE.hasClefChange === true && structureOutOfSpan.indexOf("clef") === -1;
    const trapSubModelStillCarriesTheBooleans = (function () {
      const s = spanModelOf(STRUCTURE, 2, 3);
      return !!s && s.hasRepeat === true && s.hasKeyChange === true && s.hasClefChange === true;
    })();
    const structOutOfSpanIsBareNaming = structureOutOfSpan.indexOf("Bars 3 to 4.") === 0;
    const structNoRehearsalOutOfSpan = structureOutOfSpan.indexOf("Rehearsal") === -1;
    const structNoEndingOutOfSpan = structureOutOfSpan.indexOf("ending") === -1;

    // A stop with no start: the span sits inside a volta opened earlier.
    const ENDING_STOP = modelOf([bar("5", [note("C", 4)], { endingStop: "1" })]);
    const structEndingStopOnly =
      spanSummary(ENDING_STOP, 0, 0).indexOf("An ending finishes at bar 5.") !== -1;

    // Two of a kind read as a list, and a rehearsal mark is verbatim including
    // the Joplin's dotted form.
    const TWO_MARKS = modelOf([
      bar("1", [note("C", 4)], { rehearsal: "A" }),
      bar("2", [note("D", 4)], { rehearsal: "B.1" }),
    ]);
    const structRehearsalListAndVerbatim =
      spanSummary(TWO_MARKS, 0, 1).indexOf("Rehearsal marks A at bar 1 and B.1 at bar 2.") !== -1;

    const BLANK_MARK = modelOf([bar("1", [note("C", 4)], { rehearsal: "   " })]);
    const structWhitespaceRehearsalAddsNothing =
      spanSummary(BLANK_MARK, 0, 0).indexOf("Rehearsal") === -1;

    // A structural mark engraved only in a LOWER part must still be found: the
    // merge is first-non-null across parts, not part 0 alone.
    const LOWER_PART_MARK = {
      parts: [
        { id: "P1", measures: [bar("1", [note("C", 4)]), bar("2", [note("D", 4)])] },
        { id: "P2", measures: [bar("1", [note("C", 3)]), bar("2", [note("D", 3)], { rehearsal: "C" })] },
      ],
    };
    const structFindsMarkInLowerPart =
      spanSummary(LOWER_PART_MARK, 0, 1).indexOf("Rehearsal mark C at bar 2.") !== -1;

    // An unmapped key still produces a sentence, without inventing a name.
    const UNMAPPED_KEY = modelOf([bar("1", [note("C", 4)], { keyChange: { fifths: 99 } })]);
    const structUnnamedKeyStillSpeaks = (function () {
      const text = spanSummary(UNMAPPED_KEY, 0, 0);
      return text.indexOf("The key changes at bar 1.") !== -1 && text.indexOf("undefined") === -1;
    })();

    // EDGE ROWS -------------------------------------------------------------
    const edgeEmptySelectionNull = spanSummary({ parts: [{ id: "P1", measures: [] }] }, 0, 0) === null;
    const edgeNullModelNull = spanSummary(null, 0, 1) === null;
    const edgeNeverThrows = (function () {
      try {
        spanSummary(null, 0, 1);
        spanSummary(undefined, 0, 1);
        spanSummary({}, 0, 1);
        spanSummary({ parts: null }, 0, 1);
        spanSummary({ parts: [] }, 0, 1);
        spanSummary({ parts: [{ measures: "not an array" }] }, 0, 1);
        spanSummary({ parts: [{ measures: [null, undefined] }] }, 0, 1);
        spanSummary(TEN, null, undefined);
        spanSummary(TEN, "0", "3");
        spanSummary(TEN, -5, 99);
        spanSummary(TEN, NaN, NaN);
        spanModelOf(null, 0, 1);
        spanModelOf({ parts: [{ measures: [{}] }] }, 0, 0);
        return true;
      } catch (e) {
        return false;
      }
    })();
    // A measure carrying no notes array at all still names its bars.
    const edgeMeasureWithoutNotes = (function () {
      const text = spanSummary({ parts: [{ id: "P1", measures: [{ number: "1" }, { number: "2" }] }] }, 0, 1);
      return text === "Bars 1 to 2.";
    })();

    // STUB ROWS -------------------------------------------------------------
    // The walk and names aliases are captured at LOAD, so swapping
    // window.MusicModelWalk now would prove nothing: this module would keep using
    // the object it already holds. Stage the METHOD on the captured object and
    // restore it in a finally, the pattern music-render-summary.js uses.
    let stubPitchRangeNoClause = false;
    const realPitchRange = walk.pitchRange;
    try {
      walk.pitchRange = function () { return null; };
      const stubbed = spanSummary(TEN, 5, 9);
      stubPitchRangeNoClause =
        stubbed.indexOf("pitch") === -1 && stubbed.indexOf("Bars 6 to 10.") === 0;
    } catch (e) {
      stubPitchRangeNoClause = false;
    } finally {
      walk.pitchRange = realPitchRange;
    }

    let stubClefNameStillSpeaks = false;
    const realClefName = names.clefName;
    try {
      names.clefName = function () { return null; };
      const stubbed = spanSummary(STRUCTURE, 0, 1);
      stubClefNameStillSpeaks =
        stubbed.indexOf("The clef changes at bar 2.") !== -1 && stubbed.indexOf("bass") === -1;
    } catch (e) {
      stubClefNameStillSpeaks = false;
    } finally {
      names.clefName = realClefName;
    }

    // Without this row a staged swap can leak into every row after it. Identity
    // proves the restore ran; the two re-reads prove the full sentences came back
    // rather than the module being left in a degraded state.
    const stubSwapsRestored =
      walk.pitchRange === realPitchRange &&
      names.clefName === realClefName &&
      spanSummary(TEN, 5, 9).indexOf("The pitch ranges from A4 to E5.") !== -1 &&
      spanSummary(STRUCTURE, 0, 1).indexOf("The clef changes to bass at bar 2.") !== -1;

    const results = {
      hasSpanSummary: typeof spanSummary === "function",
      hasSpanModelOf: typeof spanModelOf === "function",
      hasSelfTest: typeof selfTest === "function",

      filterSliced: filterSliced,
      filterFirstBarIsSix: filterFirstBarIsSix,
      filterKeepsNotesByReference: filterKeepsNotesByReference,
      filterKeepsMeasuresByReference: filterKeepsMeasuresByReference,
      filterCarriesPieceFields: filterCarriesPieceFields,
      filterKeepsPartMetadata: filterKeepsPartMetadata,
      filterDoesNotMutateSource: filterDoesNotMutateSource,
      filterSlicesEveryPart: filterSlicesEveryPart,
      filterClampsOverrunToIndex: filterClampsOverrunToIndex,
      filterNullOnFromIndexPastEnd: filterNullOnFromIndexPastEnd,
      filterNullOnReversedRange: filterNullOnReversedRange,
      filterNullOnNonIntegerIndex: filterNullOnNonIntegerIndex,
      filterNullOnNullModel: filterNullOnNullModel,
      filterNullOnNoMeasures: filterNullOnNoMeasures,

      namesRange: namesRange,
      namesSingleBar: namesSingleBar,
      namesNoIndexArithmetic: namesNoIndexArithmetic,
      namesNonNumericVerbatim: namesNonNumericVerbatim,
      namesNonNumericSingleBar: namesNonNumericSingleBar,
      namesFallsBackWhenFirstNull: namesFallsBackWhenFirstNull,
      namesFallsBackWhenLastNull: namesFallsBackWhenLastNull,
      namesFallsBackOnEmptyString: namesFallsBackOnEmptyString,
      namesFallsBackSingularOneBar: namesFallsBackSingularOneBar,

      clausePitchPresent: clausePitchPresent,
      clausePitchIsSpanLocalNotWholePiece: clausePitchIsSpanLocalNotWholePiece,
      clausePitchSinglePitch: clausePitchSinglePitch,
      clausePitchOmittedWhenAllRests: clausePitchOmittedWhenAllRests,
      clauseDominantPresent: clauseDominantPresent,
      clauseDominantOmittedWhenNoTypes: clauseDominantOmittedWhenNoTypes,
      clauseNamingSurvivesEmptyContent: clauseNamingSurvivesEmptyContent,
      clauseDynamicsPresent: clauseDynamicsPresent,
      clauseDynamicsOmittedWhenNone: clauseDynamicsOmittedWhenNone,
      clauseDynamicsOutsideSpanOmitted: clauseDynamicsOutsideSpanOmitted,
      clauseLyricsPresent: clauseLyricsPresent,
      clauseLyricsOmittedWhenNone: clauseLyricsOmittedWhenNone,
      clauseLyricsOutsideSpanOmitted: clauseLyricsOutsideSpanOmitted,

      structRehearsalPresent: structRehearsalPresent,
      structKeyChangePresent: structKeyChangePresent,
      structClefChangePresent: structClefChangePresent,
      structRepeatPresent: structRepeatPresent,
      structEndingPresent: structEndingPresent,
      structEndingStopOnly: structEndingStopOnly,
      structRehearsalListAndVerbatim: structRehearsalListAndVerbatim,
      structWhitespaceRehearsalAddsNothing: structWhitespaceRehearsalAddsNothing,
      structFindsMarkInLowerPart: structFindsMarkInLowerPart,
      structUnnamedKeyStillSpeaks: structUnnamedKeyStillSpeaks,
      structOutOfSpanIsBareNaming: structOutOfSpanIsBareNaming,
      structNoRehearsalOutOfSpan: structNoRehearsalOutOfSpan,
      structNoEndingOutOfSpan: structNoEndingOutOfSpan,

      trapHasRepeatSetButNoRepeatSentence: trapHasRepeatSetButNoRepeatSentence,
      trapHasKeyChangeSetButNoKeySentence: trapHasKeyChangeSetButNoKeySentence,
      trapHasClefChangeSetButNoClefSentence: trapHasClefChangeSetButNoClefSentence,
      trapSubModelStillCarriesTheBooleans: trapSubModelStillCarriesTheBooleans,

      edgeEmptySelectionNull: edgeEmptySelectionNull,
      edgeNullModelNull: edgeNullModelNull,
      edgeNeverThrows: edgeNeverThrows,
      edgeMeasureWithoutNotes: edgeMeasureWithoutNotes,

      stubPitchRangeNoClause: stubPitchRangeNoClause,
      stubClefNameStillSpeaks: stubClefNameStillSpeaks,
      stubSwapsRestored: stubSwapsRestored,
    };

    console.table(results);
    return results;
  }

  return { spanSummary, spanModelOf, selfTest };
})();

window.MusicDescribeSpan = MusicDescribeSpan;
