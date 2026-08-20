// music-names.js
// Code-to-word naming lookups for the Accessible Music proof of concept.
//
// A PURE LOOKUP SERVICE: it owns the maps that translate raw MusicXML codes into
// the spelled-out British words a screen reader should announce — note-value
// names, dynamic names, major key names, accidental words and chord-symbol
// names. It walks no model and touches no DOM.
//
// Every function but one is a single map lookup. The exception is
// chordSymbolName, which composes a chord symbol's spoken name from four of
// those lookups; that is a deliberate, documented widening of the contract and
// is explained at the function itself. The composing-and-walking layer
// (MusicModelWalk) consumes these. Exposed as window.MusicNames.

const MusicNames = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // MusicXML note <type> values mapped to their British note-value names.
  const NOTE_VALUE_NAMES = {
    whole: "semibreve",
    half: "minim",
    quarter: "crotchet",
    eighth: "quaver",
    "16th": "semiquaver",
    "32nd": "demisemiquaver",
  };

  // Translate a MusicXML note type to its British name, falling back to the raw
  // type when unmapped, or null when the type is absent.
  function noteValueName(type) {
    if (type === null || type === undefined) return null;
    return NOTE_VALUE_NAMES[type] || type;
  }

  // Raw MusicXML dynamic codes mapped to their full names, so a screen reader
  // announces "forte" rather than "f". Unmapped codes fall back to the raw code.
  const DYNAMIC_NAMES = {
    ppp: "pianississimo",
    pp: "pianissimo",
    p: "piano",
    mp: "mezzo-piano",
    mf: "mezzo-forte",
    f: "forte",
    ff: "fortissimo",
    fff: "fortississimo",
    sf: "sforzando",
    sfz: "sforzando",
    fp: "forte-piano",
  };

  // dynamicName(code): pure. Maps a raw dynamic code to its full name, falls back
  // to the raw code when unmapped, or null when the code is absent.
  function dynamicName(code) {
    if (code === null || code === undefined) return null;
    return DYNAMIC_NAMES[code] || code;
  }

  // Accidental words keyed by the <alter> value, spelled in full as words (never
  // the symbols) and matching the sharp and flat words used for key names, so a
  // screen reader announces them clearly. A null or undefined alter means no
  // accidental.
  const ALTER_NAMES = {
    "2": "double sharp",
    "1": "sharp",
    "0": "natural",
    "-1": "flat",
    "-2": "double flat",
  };

  // alterName(alter): pure. Maps an <alter> value to its spelled accidental word
  // (e.g. 1 -> "sharp", -2 -> "double flat"), or null when the alter is absent or
  // unmapped. This is only the word lookup; composing the spelled pitch label
  // stays in MusicModelWalk.pitchLabel.
  function alterName(alter) {
    if (alter === null || alter === undefined) return null;
    return ALTER_NAMES[String(alter)] || null;
  }

  // Key-signature fifths values mapped to spelled-out major key names. The model
  // carries no mode, so major is assumed; "sharp"/"flat" are spelled out in full
  // (never the ♯/♭ glyphs) so a screen reader announces them clearly.
  const MAJOR_KEYS = {
    "-7": "C flat", "-6": "G flat", "-5": "D flat", "-4": "A flat", "-3": "E flat", "-2": "B flat", "-1": "F",
    "0": "C", "1": "G", "2": "D", "3": "A", "4": "E", "5": "B", "6": "F sharp", "7": "C sharp",
  };

  // keySignatureName(fifths): pure. Maps a key-signature fifths value to a
  // screen-reader-friendly major key name (e.g. 0 -> "C major"), or null when
  // the value is absent or out of the -7..7 range.
  function keySignatureName(fifths) {
    if (fifths === null || fifths === undefined) return null;
    const name = MAJOR_KEYS[String(fifths)];
    return name ? name + " major" : null;
  }

  // dottedValueName(type, dots): pure. The note-value name adjusted for
  // augmentation dots — 1 dot prepends "dotted ", 2 dots prepend "double dotted ",
  // and 0/null/undefined dots leave the plain base name unchanged. The base name
  // comes from noteValueName, so the British value names stay in one place.
  // Returns null when the type is absent.
  function dottedValueName(type, dots) {
    const base = noteValueName(type);
    if (base === null) return null;
    if (dots === 2) return "double dotted " + base;
    if (dots === 1) return "dotted " + base;
    return base;
  }

  // Tuplet names keyed on the actualNotes count of a <time-modification>, so a
  // screen reader announces "triplet" rather than "3 in the time of 2".
  const TUPLET_NAMES = {
    2: "duplet",
    3: "triplet",
    4: "quadruplet",
    5: "quintuplet",
    6: "sextuplet",
    7: "septuplet",
  };

  // tupletName(timeModification): pure. Maps a { actualNotes, normalNotes } object
  // to its spoken tuplet name, keyed on actualNotes, or null when the object is
  // absent or its actualNotes count is unmapped.
  function tupletName(timeModification) {
    if (timeModification === null || timeModification === undefined) return null;
    return TUPLET_NAMES[timeModification.actualNotes] || null;
  }

  // Articulation tag names mapped to their spoken names. Where the tag is
  // already a musical word it speaks as itself; "strong-accent" is the
  // MusicXML tag for the marcato mark and speaks as "strong accent". Any
  // unmapped tag falls back to the raw tag, so a hyphenated MusicXML tag can
  // still reach a reader.
  const ARTICULATION_NAMES = {
    staccato: "staccato",
    accent: "accent",
    tenuto: "tenuto",
    "strong-accent": "strong accent",
  };

  // articulationName(tag): pure. Maps a raw articulation tagName to its spoken
  // name, falling back to the raw tag when unmapped, or null when absent.
  function articulationName(tag) {
    if (tag === null || tag === undefined) return null;
    return ARTICULATION_NAMES[tag] || tag;
  }

  // Ornament tag names mapped to their spoken names, e.g. "trill-mark" -> "trill".
  // Any other tag falls back to the raw tag.
  const ORNAMENT_NAMES = {
    "trill-mark": "trill",
    mordent: "mordent",
    turn: "turn",
  };

  // ornamentName(tag): pure. Maps a raw ornament tagName to its spoken name,
  // falling back to the raw tag when unmapped, or null when absent.
  function ornamentName(tag) {
    if (tag === null || tag === undefined) return null;
    return ORNAMENT_NAMES[tag] || tag;
  }

  // Clef sign-and-line pairs mapped to their spoken clef names, keyed on the
  // sign letter joined to the staff line (e.g. "G2"). Only the four common clefs
  // are named; anything else falls through to null, since exotic clefs are out of
  // scope. The score draws the clef itself; this is only the spoken word.
  const CLEF_NAMES = {
    G2: "treble",
    F4: "bass",
    C3: "alto",
    C4: "tenor",
  };

  // clefName(sign, line): pure. Maps a clef sign and staff line to its spoken
  // name (e.g. "G", 2 -> "treble"), accepting the line as a number or a string,
  // or null when either part is absent or the pair is unmapped.
  function clefName(sign, line) {
    if (sign === null || sign === undefined || line === null || line === undefined) return null;
    return CLEF_NAMES[String(sign) + String(line)] || null;
  }

  // Volta numbers mapped to their spoken ending names, so a screen reader
  // announces "first-time ending" rather than "ending 1". Keyed as strings and
  // accepting a number or a string; only the common first and second endings are
  // named, and anything else falls through to null.
  const ENDING_NAMES = {
    "1": "first-time ending",
    "2": "second-time ending",
  };

  // endingName(number): pure. Maps a volta number to its spoken ending name
  // (e.g. "1" -> "first-time ending"), accepting a number or a string, or null
  // when the number is absent or unmapped.
  function endingName(number) {
    if (number === null || number === undefined) return null;
    return ENDING_NAMES[String(number)] || null;
  }

  // MusicXML <kind> values mapped to their spoken chord-quality words. The set is
  // SPEC-DEFINED AND MUCH LARGER THAN THIS — MusicXML names roughly thirty kinds,
  // from "augmented" and "major-seventh" through "suspended-fourth" to
  // "Neapolitan" — so these six are only what is exercised here: the five the
  // corpus uses plus the fixture's half-diminished. Anything unmapped falls back.
  // Note that "dominant" alone is MusicXML's DOMINANT SEVENTH chord, which is why
  // it does not map to the bare word.
  const CHORD_KIND_NAMES = {
    major: "major",
    minor: "minor",
    dominant: "dominant seventh",
    diminished: "diminished",
    "diminished-seventh": "diminished seventh",
    "half-diminished": "half-diminished",
  };

  // chordKindName(kind): pure. Maps a raw MusicXML <kind> value to its spoken
  // words, or null when the kind is absent or empty. Follows dynamicName's
  // FALLBACK-TO-RAW-CODE policy rather than the null-when-unmapped policy of
  // clefName, but normalises the fallback by replacing hyphens with spaces, so an
  // unmapped "major-seventh" reads as "major seventh" rather than as a hyphenated
  // token.
  //
  // The fallback exists because the closure at five kinds is a property of ONE
  // file, not of the format: a second engraver would very likely emit a kind
  // outside this map, and an unmapped kind should cost a reader a clumsy word and
  // never silence.
  function chordKindName(kind) {
    if (kind === null || kind === undefined || kind === "") return null;
    return CHORD_KIND_NAMES[kind] || String(kind).replace(/-/g, " ");
  }

  // Accidental suffix for a chord root or bass — " sharp", " flat" and so on with
  // the leading space, or "" when there is none. Private to the chord namer. Three
  // cases yield nothing: an absent alter, a ZERO alter (a natural, which a spoken
  // chord symbol leaves unsaid even though alterName words it), and an unmapped or
  // wrongly typed alter, which is dropped rather than allowed to reach a reader as
  // "undefined". The word itself always comes from alterName; the mapping is not
  // duplicated here.
  function chordAlterSuffix(alter) {
    if (alter === null || alter === undefined || alter === "") return "";
    if (Number(alter) === 0) return "";
    const word = alterName(alter);
    return word ? " " + word : "";
  }

  // chordSymbolName(harmony): pure. Composes the full spoken name of a chord
  // symbol from the parser's raw harmony record — { rootStep, rootAlter, kind,
  // bassStep, bassAlter } — as the root letter and its accidental, then the spoken
  // kind, then "over" and the bass letter and its accidental when a bass is
  // present. So "C major", "F sharp diminished seventh", "C minor over E flat".
  // Returns null when the record is absent, is not a plain object, or lacks a
  // usable root step or kind. It never throws, whatever it is handed.
  //
  // It reads ONLY the five fields the parser captures. There is deliberately no
  // text attribute on the record, and nothing here may reintroduce one.
  //
  // CONTRACT NOTE: this takes an OBJECT where most siblings take scalars, which
  // widens this module's pure-lookup contract a little. It is deliberate. A chord
  // symbol's spoken name is a composition of four closed-set lookups, and
  // splitting it across four call sites would put the composition — the word
  // order, and the rule that a zero alter stays unsaid — in the renderer instead.
  // tupletName already takes a parser record, so an object argument is not new;
  // what is new is reading several fields and joining them. It still walks no
  // model and touches no DOM.
  function chordSymbolName(harmony) {
    if (harmony === null || harmony === undefined) return null;
    if (typeof harmony !== "object" || Array.isArray(harmony)) return null;

    // Root and kind are both required; a record missing either cannot be named.
    const rootStep = harmony.rootStep;
    if (typeof rootStep !== "string" || rootStep === "") return null;

    const kind = harmony.kind;
    if (typeof kind !== "string" || kind === "") return null;

    const kindWords = chordKindName(kind);
    if (kindWords === null) return null;

    let name = rootStep + chordAlterSuffix(harmony.rootAlter) + " " + kindWords;

    // The bass is optional, and is spoken only when a bass step is present.
    const bassStep = harmony.bassStep;
    if (typeof bassStep === "string" && bassStep !== "") {
      name += " over " + bassStep + chordAlterSuffix(harmony.bassAlter);
    }

    return name;
  }

  // Self-test: synchronous and self-contained. Asserts every lookup against known
  // codes, including fallbacks and the null-when-absent paths. console.table()s
  // and returns the results object.
  function selfTest() {
    const results = {
      hasNoteValueName: typeof noteValueName === "function",
      noteValueNameExposed: noteValueName("eighth") === "quaver",
      noteValueNameCrotchet: noteValueName("quarter") === "crotchet",
      noteValueNameFallback: noteValueName("zz") === "zz",
      noteValueNameNullWhenAbsent: noteValueName(null) === null && noteValueName(undefined) === null,
      hasDynamicName: typeof dynamicName === "function",
      dynamicForte: dynamicName("f") === "forte",
      dynamicMezzoForte: dynamicName("mf") === "mezzo-forte",
      dynamicFallback: dynamicName("zz") === "zz",
      dynamicNullWhenAbsent: dynamicName(null) === null && dynamicName(undefined) === null,
      hasKeySignatureName: typeof keySignatureName === "function",
      keyCMajor: keySignatureName(0) === "C major",
      keyBFlatMajor: keySignatureName(-2) === "B flat major",
      keyNull: keySignatureName(null) === null,
      keyOutOfRange: keySignatureName(99) === null,
      hasAlterName: typeof alterName === "function",
      alterSharp: alterName(1) === "sharp",
      alterFlat: alterName(-1) === "flat",
      alterNatural: alterName(0) === "natural",
      alterDoubleSharp: alterName(2) === "double sharp",
      alterDoubleFlat: alterName(-2) === "double flat",
      alterNullWhenAbsent: alterName(null) === null && alterName(undefined) === null,
      alterNullWhenUnmapped: alterName(3) === null,
      hasDottedValueName: typeof dottedValueName === "function",
      dottedSingle: dottedValueName("quarter", 1) === "dotted crotchet",
      dottedDouble: dottedValueName("half", 2) === "double dotted minim",
      dottedNoDot: dottedValueName("quarter", null) === "crotchet",
      dottedNullType: dottedValueName(null) === null,
      hasTupletName: typeof tupletName === "function",
      tupletTriplet: tupletName({ actualNotes: 3, normalNotes: 2 }) === "triplet",
      tupletQuintuplet: tupletName({ actualNotes: 5, normalNotes: 4 }) === "quintuplet",
      tupletNull: tupletName(null) === null,
      tupletUnmapped: tupletName({ actualNotes: 11, normalNotes: 8 }) === null,
      hasArticulationName: typeof articulationName === "function",
      articulationStaccato: articulationName("staccato") === "staccato",
      articulationAccent: articulationName("accent") === "accent",
      articulationTenuto: articulationName("tenuto") === "tenuto",
      articulationStrongAccent: articulationName("strong-accent") === "strong accent",
      articulationFallback: articulationName("zz") === "zz",
      hasOrnamentName: typeof ornamentName === "function",
      ornamentTrill: ornamentName("trill-mark") === "trill",
      ornamentMordent: ornamentName("mordent") === "mordent",
      ornamentTurn: ornamentName("turn") === "turn",
      ornamentFallback: ornamentName("zz") === "zz",
      hasClefName: typeof clefName === "function",
      clefTreble: clefName("G", 2) === "treble",
      clefBass: clefName("F", 4) === "bass",
      clefAlto: clefName("C", 3) === "alto",
      clefTenor: clefName("C", 4) === "tenor",
      clefAcceptsStringLine: clefName("G", "2") === "treble",
      clefNullWhenUnmapped: clefName("TAB", 5) === null,
      clefNullWhenAbsent: clefName(null, null) === null && clefName("G", null) === null,
      hasEndingName: typeof endingName === "function",
      endingFirst: endingName("1") === "first-time ending",
      endingSecond: endingName("2") === "second-time ending",
      endingAcceptsNumber: endingName(1) === "first-time ending",
      endingNullWhenUnmapped: endingName("3") === null,
      endingNullWhenAbsent: endingName(null) === null && endingName(undefined) === null,
      hasChordKindName: typeof chordKindName === "function",
      chordKindMajor: chordKindName("major") === "major",
      chordKindMinor: chordKindName("minor") === "minor",
      chordKindDominantSeventh: chordKindName("dominant") === "dominant seventh",
      chordKindDiminished: chordKindName("diminished") === "diminished",
      chordKindDiminishedSeventh: chordKindName("diminished-seventh") === "diminished seventh",
      chordKindHalfDiminished: chordKindName("half-diminished") === "half-diminished",
      chordKindFallbackHyphenated: chordKindName("major-seventh") === "major seventh",
      chordKindFallbackMultiHyphen: chordKindName("suspended-fourth") === "suspended fourth",
      chordKindFallbackSingleWord: chordKindName("augmented") === "augmented",
      chordKindNullWhenAbsent: chordKindName(null) === null && chordKindName(undefined) === null,
      chordKindNullWhenEmpty: chordKindName("") === null,
      hasChordSymbolName: typeof chordSymbolName === "function",
      chordPlainRootAndKind: chordSymbolName({ rootStep: "C", kind: "major" }) === "C major",
      chordRootSharp: chordSymbolName({ rootStep: "F", rootAlter: 1, kind: "diminished-seventh" }) === "F sharp diminished seventh",
      chordRootFlat: chordSymbolName({ rootStep: "B", rootAlter: -1, kind: "major" }) === "B flat major",
      chordBassNoAlter: chordSymbolName({ rootStep: "C", kind: "major", bassStep: "G" }) === "C major over G",
      chordBassFlat: chordSymbolName({ rootStep: "C", kind: "minor", bassStep: "E", bassAlter: -1 }) === "C minor over E flat",
      chordAlteredRootAndBass: chordSymbolName({ rootStep: "F", rootAlter: 1, kind: "minor", bassStep: "A", bassAlter: 1 }) === "F sharp minor over A sharp",
      chordUnmappedKindFallsBack: chordSymbolName({ rootStep: "G", kind: "major-seventh" }) === "G major seventh",
      chordZeroAlterUnspoken: chordSymbolName({ rootStep: "C", rootAlter: 0, kind: "major", bassStep: "G", bassAlter: 0 }) === "C major over G",
      chordStringRootAlter: chordSymbolName({ rootStep: "C", rootAlter: "1", kind: "major" }) === "C sharp major",
      chordNullWhenNull: chordSymbolName(null) === null && chordSymbolName(undefined) === null,
      chordNullWhenString: chordSymbolName("C major") === null,
      chordNullWhenNumber: chordSymbolName(7) === null,
      chordNullWhenArray: chordSymbolName(["C", "major"]) === null,
      chordNullWhenMissingRoot: chordSymbolName({ kind: "major" }) === null,
      chordNullWhenMissingKind: chordSymbolName({ rootStep: "C" }) === null,
      chordNeverThrows: (function () {
        const hostile = [
          null, undefined, "C major", 7, true, ["C", "major"], {},
          { rootStep: "C" }, { kind: "major" }, { rootStep: "", kind: "" },
          { rootStep: 1, kind: 2 },
          { rootStep: "C", rootAlter: {}, kind: "major", bassStep: [], bassAlter: "x" },
          { rootStep: "C", kind: "major", bassStep: 5, bassAlter: null },
        ];
        try {
          return hostile.every(function (input) {
            const out = chordSymbolName(input);
            return out === null || typeof out === "string";
          });
        } catch (error) {
          return false;
        }
      })(),
      chordNoUndefinedOrNullText: (function () {
        const samples = [
          { rootStep: "C", kind: "major" },
          { rootStep: "F", rootAlter: 1, kind: "dominant" },
          { rootStep: "B", rootAlter: -1, kind: "diminished" },
          { rootStep: "C", kind: "minor", bassStep: "E", bassAlter: -1 },
          { rootStep: "G", rootAlter: "1", kind: "half-diminished", bassStep: "D", bassAlter: "x" },
          { rootStep: "A", kind: "major-seventh", bassStep: "C", bassAlter: 0 },
          { rootStep: "E", rootAlter: {}, kind: "diminished-seventh", bassStep: "B", bassAlter: [] },
        ];
        return samples.every(function (input) {
          const out = chordSymbolName(input);
          return typeof out === "string" && out.indexOf("undefined") === -1 && out.indexOf("null") === -1;
        });
      })(),
    };

    console.table(results);
    return results;
  }

  return { noteValueName, dynamicName, keySignatureName, alterName, dottedValueName, tupletName, articulationName, ornamentName, clefName, endingName, chordKindName, chordSymbolName, selfTest };
})();

window.MusicNames = MusicNames;
