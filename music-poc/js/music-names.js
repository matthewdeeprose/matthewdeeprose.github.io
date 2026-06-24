// music-names.js
// Code-to-word naming lookups for the Accessible Music proof of concept.
//
// A PURE LOOKUP SERVICE: it owns the maps that translate raw MusicXML codes into
// the spelled-out British words a screen reader should announce — note-value
// names, dynamic names, major key names and accidental words. It walks no model,
// composes no phrase and touches no DOM; each function is a single map lookup.
// The composing-and-walking layer (MusicModelWalk) consumes these. Exposed as
// window.MusicNames.

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

  // Articulation tag names mapped to their spoken names. The mapped tags speak as
  // themselves; any other tag falls back to the raw tag.
  const ARTICULATION_NAMES = {
    staccato: "staccato",
    accent: "accent",
    tenuto: "tenuto",
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
    };

    console.table(results);
    return results;
  }

  return { noteValueName, dynamicName, keySignatureName, alterName, dottedValueName, tupletName, articulationName, ornamentName, clefName, endingName, selfTest };
})();

window.MusicNames = MusicNames;
