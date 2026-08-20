// music-parse.js
// MusicXML parser for the Accessible Music proof of concept.
//
// A PURE DATA SERVICE: it takes a MusicXML string and returns a plain model
// object describing the score, or null on any failure. It never throws, never
// notifies, and never touches the page DOM — it uses DOMParser only to parse
// the string into an in-memory document it reads and discards. Failures are
// logged and surfaced as null; a later dispatch layer decides how to notify the
// user. Per-note extraction now lives in MusicParseNote; this file is the
// document-and-structure orchestrator that calls it. Exposed as window.MusicParse.

const MusicParse = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side note extraction: route through the shared MusicParseNote when
  // present, otherwise fall back to a neutral note so this file never throws if
  // the note-extraction layer is absent. The per-note reads live in that module now.
  //
  // The stub below is a SECOND independent copy of extractNote's default shape, so
  // it must stay in step with that shape key for key: a key present there but
  // missing here reads as undefined rather than null on every page where
  // MusicParseNote failed to load. dynamic, shaping and harmony are all listed for
  // that reason even though the orchestrator assigns all three on every note
  // regardless.
  const noteLayer = window.MusicParseNote || {
    extractNote() {
      return { rest: false, chord: false, step: null, octave: null, alter: null, duration: null, type: null, tie: null, slur: null, lyric: null, dynamic: null, shaping: null, harmony: null };
    },
  };

  // Consumer-side structural reading: route through the shared MusicParseStructure
  // when present, otherwise fall back to a neutral structure so this file never
  // throws if the structure-reading layer is absent. The per-measure structural
  // reads (repeats, endings, clef and key declarations, and the rehearsal mark)
  // live in that module now.
  //
  // The stub below is a SECOND independent copy of readStructure's return shape.
  // It must stay in step with that shape key for key: a key present there but
  // missing here reads as undefined rather than null on every page where
  // MusicParseStructure failed to load.
  const structureLayer = window.MusicParseStructure || {
    readStructure() {
      return { repeatForward: false, repeatBackward: false, endingStart: null, endingStop: null, clef: null, key: null, rehearsal: null };
    },
  };

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

  // The font-size of an element as a finite number, or 0. Reads the MusicXML
  // font-size attribute (present on <credit-words> and <words>); a missing or
  // non-numeric value counts as zero so it never wins the largest-font contest.
  function fontSizeOf(el) {
    const n = parseFloat(el.getAttribute("font-size"));
    return Number.isFinite(n) ? n : 0;
  }

  // True when text is a plausible title: non-empty once trimmed and holding at
  // least one letter. The Unicode-aware letter test keeps accented titles such
  // as "Gymnopédie" or "Edição" while rejecting a bare marker like "#" or a
  // lone number, which are engraving marks rather than a title.
  function looksLikeTitle(text) {
    if (typeof text !== "string") return false;
    const trimmed = text.trim();
    return trimmed.length > 0 && /\p{L}/u.test(trimmed);
  }

  // The explicit-marker title, or null. Returns the first <credit-words> text of
  // a credit whose <credit-type> reads "title" (case-insensitive). This is the
  // authoritative source: an engraver's own "title" marking overrides the
  // font-size heuristic below.
  function creditTypeTitleOf(root) {
    const credits = root.querySelectorAll("credit");
    for (let i = 0; i < credits.length; i++) {
      const creditType = textOf(credits[i], "credit-type");
      if (creditType && creditType.toLowerCase() === "title") {
        const words = textOf(credits[i], "credit-words");
        if (words !== null) return words;
      }
    }
    return null;
  }

  // The largest-font heading candidate's text, or null. When no element is
  // explicitly typed "title", the title is normally engraved largest, so this
  // gathers every heading candidate and picks the one set in the biggest font.
  // Candidates come from two places: every <credit-words> in the score, and the
  // direction <words> printed in the first measure of the first part (a bar-1
  // title word). Each candidate is { text, size } from its trimmed textContent
  // and fontSizeOf. Only candidates that looksLikeTitle survive, so a no-letter
  // marker cannot win however large. The greatest size wins; on a tie the first
  // candidate in collected order is kept (replace only on a strictly greater
  // size). This rests on the title being engraved largest.
  function headingTitleOf(root) {
    const candidates = [];
    const creditWords = root.querySelectorAll("credit-words");
    for (let i = 0; i < creditWords.length; i++) {
      candidates.push({ text: (creditWords[i].textContent || "").trim(), size: fontSizeOf(creditWords[i]) });
    }
    const firstPart = root.querySelector("part");
    const firstMeasure = firstPart ? firstPart.querySelector("measure") : null;
    if (firstMeasure) {
      const measureWords = firstMeasure.querySelectorAll("words");
      for (let i = 0; i < measureWords.length; i++) {
        candidates.push({ text: (measureWords[i].textContent || "").trim(), size: fontSizeOf(measureWords[i]) });
      }
    }
    let best = null;
    for (let i = 0; i < candidates.length; i++) {
      if (!looksLikeTitle(candidates[i].text)) continue;
      if (best === null || candidates[i].size > best.size) best = candidates[i];
    }
    return best ? best.text : null;
  }

  // The score title, as the first non-empty source in priority order, or null
  // when none is present. An explicit <work-title>, then <movement-title>, then
  // an engraver's credit-type "title" marking, are authoritative. Failing all
  // three, the title is chosen by engraving weight: headingTitleOf picks the
  // largest-font heading candidate (a missing font-size counts as zero), which
  // rests on the title being engraved largest. The final two steps — a bare
  // first credit-words, then a direction word — are last resorts for files that
  // carry no font sizes at all.
  function titleOf(root) {
    return (
      textOf(root, "work-title") ||
      textOf(root, "movement-title") ||
      creditTypeTitleOf(root) ||
      headingTitleOf(root) ||
      textOf(root, "credit-words") ||
      textOf(root, "words")
    );
  }

  // Sound tempo in quarter-notes per minute from the first <sound tempo="...">,
  // or null. This is the playback fallback used when a score carries no usable
  // printed metronome mark.
  function soundTempoOf(root) {
    const soundEl = root.querySelector("sound[tempo]");
    if (!soundEl) return null;
    const t = parseInt(soundEl.getAttribute("tempo"), 10);
    return Number.isNaN(t) ? null : t;
  }

  // The printed metronome mark from the first <metronome>, or null when there is
  // no usable printed mark. Returns { perMinute, beatUnit, beatUnitDots }:
  // perMinute is the first run of digits in <per-minute> (so "ca. 76" gives 76),
  // or null when it holds no digits (for example a metric-modulation mark);
  // beatUnit is the first <beat-unit> text (for example "quarter", "half"), or
  // null when absent; beatUnitDots counts the <beat-unit-dot> elements.
  function tempoMarkOf(root) {
    const metronome = root.querySelector("metronome");
    if (!metronome) return null;
    const perMinuteText = textOf(metronome, "per-minute");
    const digits = perMinuteText ? perMinuteText.match(/\d+/) : null;
    const perMinute = digits ? parseInt(digits[0], 10) : null;
    if (perMinute === null) return null;
    const beatUnit = textOf(metronome, "beat-unit");
    if (beatUnit === null) return null;
    const beatUnitDots = metronome.querySelectorAll("beat-unit-dot").length;
    return { perMinute: perMinute, beatUnit: beatUnit, beatUnitDots: beatUnitDots };
  }

  // Normalise a printed metronome mark to quarter-notes per minute. The beat unit
  // sets how many quarters make one beat, and any dots lengthen that beat: d dots
  // give a factor of (2 - 2^-d), so one dot is 1.5 and two dots 1.75. An
  // unrecognised beat unit falls back to one quarter per beat and logs a warning.
  // The result is left unrounded, since a fraction is fine for the timing maths.
  function quartersPerMinuteOf(mark) {
    const QUARTERS_PER_BEAT = {
      maxima: 32,
      long: 16,
      breve: 8,
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      "16th": 0.25,
      "32nd": 0.125,
      "64th": 0.0625,
    };
    let baseFactor = QUARTERS_PER_BEAT[mark.beatUnit];
    if (baseFactor === undefined) {
      logWarn("MusicParse: unrecognised beat unit '" + mark.beatUnit + "', assuming quarter");
      baseFactor = 1;
    }
    const dottedFactor = 2 - Math.pow(2, -mark.beatUnitDots);
    return mark.perMinute * baseFactor * dottedFactor;
  }

  // The dynamic inside a <direction>, as its raw MusicXML code (e.g. "f", "mf",
  // "p") taken from the first element child of <dynamics>, or null when the
  // direction carries no dynamics.
  function dynamicOf(directionEl) {
    const dynamics = directionEl.querySelector("dynamics");
    if (!dynamics) return null;
    const first = dynamics.firstElementChild;
    return first ? first.tagName : null;
  }

  // The wedge (hairpin) inside a <direction>, as its raw MusicXML type attribute
  // — "crescendo", "diminuendo" or "stop" — or null when the direction carries no
  // wedge. Scoped exactly as dynamicOf scopes its query, so it reads
  // direction > direction-type > wedge. ONLY the type attribute is read: no wedge
  // in the corpus carries a number, and spread/niente are engraving detail this
  // stage deliberately ignores.
  function wedgeOf(directionEl) {
    const wedge = directionEl.querySelector("wedge");
    if (!wedge) return null;
    return wedge.getAttribute("type");
  }

  // The TEXTUAL dynamic instruction inside a <direction> — an engraved "cresc."
  // or "dim." rather than a printed hairpin — as "crescendo", "diminuendo", or
  // null when the direction carries no recognised instruction. Scoped exactly as
  // dynamicOf and wedgeOf scope their queries, so it reads
  // direction > direction-type > words.
  //
  // The mapping lives HERE, in the parser, and nothing is added to music-names.js.
  // This is parser-side normalisation of a raw file — an engraver's abbreviation
  // turned into the same raw type a <wedge type="..."> already yields — and not
  // naming for a reader. music-names is consumed by the model-walk and render
  // layers, which sit ABOVE this one; music-parse.js depends on that module in no
  // way today, and a parse-to-names dependency would invert the existing layering.
  //
  // Normalisation: lowercase, trim, collapse internal whitespace (a <words> text
  // is routinely broken across lines), take the FIRST whitespace-separated token,
  // then strip that token's trailing full stops. The strip is applied to the token
  // rather than to the whole string so that a TRAILING qualifier — "cresc. poco a
  // poco" — still matches on its first token.
  function textualShapingOf(directionEl) {
    // The two closed sets of engraved abbreviations this stage recognises.
    // Anything outside them returns null, so an ordinary direction word
    // ("Moderato", "con pedale", "Repeat 8va", a bar-1 title word) can never be
    // read as shaping.
    const CRESCENDO_WORDS = ["cresc", "crescendo"];
    const DIMINUENDO_WORDS = ["dim", "dimin", "diminuendo", "decresc", "decrescendo"];
    // First-token matching means a mark written with a LEADING qualifier, such as
    // "poco a poco cresc.", is NOT matched: its first token is "poco". That is a
    // known and deliberate limit — no file in the corpus writes one — and the
    // cost of missing it is a reading that says nothing, never a wrong reading.
    const wordsEl = directionEl.querySelector("words");
    if (!wordsEl) return null;
    const normalised = (wordsEl.textContent || "").toLowerCase().trim().replace(/\s+/g, " ");
    if (!normalised.length) return null;
    const token = normalised.split(" ")[0].replace(/\.+$/, "");
    if (CRESCENDO_WORDS.indexOf(token) !== -1) return "crescendo";
    if (DIMINUENDO_WORDS.indexOf(token) !== -1) return "diminuendo";
    return null;
  }

  // The chord symbol inside a <harmony>, as an object of RAW MusicXML codes
  //   { rootStep, rootAlter, kind, bassStep, bassAlter }
  // or null when the element carries no usable root step or no kind. Scoped
  // exactly as dynamicOf, wedgeOf and textualShapingOf scope their queries, so
  // each read is a descendant lookup within the one <harmony> element it is given.
  //
  // RAW CODES ONLY. rootStep and bassStep are the bare MusicXML letters ("C",
  // "F", "B"); rootAlter and bassAlter are the raw integers, which the corpus
  // writes only as 1 or -1; kind is the raw MusicXML kind value ("major",
  // "dominant", "diminished-seventh", and whatever else a file we have not seen
  // may write). Nothing here is named, mapped or made speakable — the spoken name
  // is built at Stage 62 in music-names.js from the kind ELEMENT TEXT, and Stage
  // 64 voices it. Naming belongs there because music-names sits ABOVE this layer,
  // exactly as the textualShapingOf comment above records for the same reason.
  //
  // The <kind> element's "text" attribute is DELIBERATELY NOT READ. It holds the
  // engraver's display shorthand — the empty string for major, "mi", "7", "o",
  // "o7" in the Joplin — which is glyph shorthand for printing on a stave rather
  // than words a reader could hear, and for the commonest chord of all it is
  // empty. The element's text content is the machine-readable value and is the
  // only thing read here.
  //
  // rootAlter, bassStep and bassAlter are OPTIONAL and read null when absent,
  // never undefined and never NaN: textOf returns null for an absent or empty
  // element, and intOf returns null for an absent element and for a value that
  // does not parse. rootStep and kind are NOT optional — a harmony missing either
  // names no chord at all, so the whole read returns null rather than an object
  // with holes in it, and a malformed <harmony> therefore costs a reader silence
  // rather than a wrong symbol.
  function harmonyOf(harmonyEl) {
    const rootStep = textOf(harmonyEl, "root-step");
    const kind = textOf(harmonyEl, "kind");
    if (rootStep === null || kind === null) return null;
    return {
      rootStep: rootStep,
      rootAlter: intOf(harmonyEl, "root-alter"),
      kind: kind,
      bassStep: textOf(harmonyEl, "bass-step"),
      bassAlter: intOf(harmonyEl, "bass-alter"),
    };
  }

  // A <direction>'s staff key: the text of its <staff> child, or "1" when the
  // direction carries none. Keying an absent (or empty) staff as "1" is the
  // Stage 53 precedent — the hand heading keys a null staff as "1", and clefsOf
  // above keys a clef with no number attribute the same way — so a single-staff
  // direction that tags nothing and an explicitly staff-1 direction land on ONE
  // key and can pair with each other. Satie's wedge directions all carry a
  // <staff> child; Joplin's carry none, and this is what makes the two files
  // read alike.
  function directionStaffOf(directionEl) {
    const staff = textOf(directionEl, "staff");
    return staff === null ? "1" : staff;
  }

  // Initial clefs from the FIRST <attributes> within the element it is given,
  // keyed by the clef's staff number ("1", "2") as a string, each { sign, line }.
  // A clef with no number attribute keys as "1", whichever element is passed.
  // Empty object when no clef is declared. Passing the document root yields the
  // score's opening clefs (model.clefs, used for the hand headings so a piano
  // score can name its treble and bass staves); passing a <part> element yields
  // that part's own clefs. A two-part keyboard commonly declares each part's clef
  // with no number attribute, so both parts key as "1" while carrying different
  // signs — the clef that names a hand therefore belongs to the PART, not to the
  // staff number.
  function clefsOf(root) {
    const clefs = {};
    const attributes = root.querySelector("attributes");
    if (!attributes) return clefs;
    const clefEls = attributes.querySelectorAll("clef");
    for (let i = 0; i < clefEls.length; i++) {
      const clefEl = clefEls[i];
      const number = clefEl.getAttribute("number") || "1";
      const sign = textOf(clefEl, "sign");
      const line = intOf(clefEl, "line");
      if (sign !== null) clefs[number] = { sign: sign, line: line };
    }
    return clefs;
  }

  // The <part-list>'s groups, in the order they open, each as
  // { number, symbol, name, partIds }. Pure; NEVER throws. Returns [] when there
  // is no part-list. The part-list's element children are walked in document
  // order: a <part-group type="start"> opens a group (number from its number
  // attribute, or "1" when absent; symbol from <group-symbol>; name from
  // <group-name>), every following <score-part> id is appended to EVERY group
  // still open — so nested groups each collect their own members — and a
  // <part-group type="stop"> closes the most recently opened group carrying that
  // number. Malformed part-lists never throw: a stop with no matching open group
  // is ignored and warned about, and a group left unclosed is still returned, also
  // with a warning. group-symbol and group-name go through textOf, so an empty
  // element yields null, matching how part-name is read.
  //
  // Together with the per-part clefs added to each part below, this lets a later
  // stage detect a keyboard grand staff spread across TWO parts (a braced group of
  // two) and name each hand from its own part's clef. No such detection happens
  // here — this stage only records the two facts.
  function partGroupsOf(root) {
    const partList = root.querySelector("part-list");
    if (!partList) return [];

    // groups holds every group in the order it opened, so an unclosed group is
    // already collected; open holds only those still accepting members.
    const groups = [];
    const open = [];
    const children = partList.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === "part-group") {
        const type = child.getAttribute("type");
        const number = child.getAttribute("number") || "1";
        if (type === "start") {
          const group = {
            number: number,
            symbol: textOf(child, "group-symbol"),
            name: textOf(child, "group-name"),
            partIds: [],
          };
          groups.push(group);
          open.push(group);
        } else if (type === "stop") {
          // Close the most recently opened group carrying this number.
          let found = -1;
          for (let g = open.length - 1; g >= 0; g--) {
            if (open[g].number === number) {
              found = g;
              break;
            }
          }
          if (found === -1) {
            logWarn("MusicParse: part-group stop number '" + number + "' matches no open group, ignoring it");
          } else {
            open.splice(found, 1);
          }
        }
      } else if (child.tagName === "score-part") {
        const id = child.getAttribute("id");
        if (id) {
          for (let g = 0; g < open.length; g++) open[g].partIds.push(id);
        }
      }
    }

    // Anything still open is closed here by simply leaving it in groups.
    if (open.length > 0) {
      logWarn("MusicParse: part-list left " + open.length + " group(s) unclosed; returning them as they stand");
    }

    return groups;
  }

  // parse(xmlText): synchronous; returns a plain model object on success or null
  // on failure; NEVER throws.
  function parse(xmlText) {
    if (typeof xmlText !== "string" || xmlText.length === 0) {
      logWarn("MusicParse.parse expected a non-empty string");
      return null;
    }

    // DOMParser is created only here, never at module-load time.
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");

    if (doc.querySelector("parsererror")) {
      logError("MusicXML parse error");
      return null;
    }

    const root = doc.querySelector("score-partwise");
    if (!root) {
      logError("Not a partwise MusicXML document");
      return null;
    }

    // Document-level fields, taken from their first occurrence (simple scores).
    const workTitle = titleOf(root);
    const divisions = intOf(root, "divisions");
    const fifths = intOf(root, "fifths");
    const key = fifths === null ? null : { fifths: fifths };
    const beats = intOf(root, "beats");
    const beatType = intOf(root, "beat-type");
    const time = beats === null || beatType === null ? null : { beats: beats, beatType: beatType };
    // model.tempo is normalised quarter-notes per minute, preferring the printed
    // metronome mark over the sound tempo; model.tempoMark keeps the printed pair
    // (perMinute + beatUnit + dots) for the summary. The normalisation applies the
    // beat unit and any dots via quartersPerMinuteOf.
    const tempoMark = tempoMarkOf(root);
    const tempo = tempoMark ? quartersPerMinuteOf(tempoMark) : soundTempoOf(root);
    // Multiple-staves overview, taken from the first <attributes>: the staff count
    // and the initial clef on each staff. A single-staff score reports one staff
    // and one clef, so these read harmlessly for every existing fixture.
    const stavesValue = intOf(root, "staves");
    const staves = stavesValue === null ? 1 : stavesValue;
    const clefs = clefsOf(root);

    // Part-list groups (a brace or bracket drawn over several parts), recorded as
    // declared. A braced group of two parts is how a keyboard grand staff can be
    // spread across two PARTS rather than two staves of one part.
    const partGroups = partGroupsOf(root);
    logInfo("Read " + partGroups.length + " part group(s) from the part-list");
    for (const group of partGroups) {
      logDebug(
        "Part group symbol '" + (group.symbol === null ? "none" : group.symbol) +
          "' holds part(s): " + (group.partIds.length ? group.partIds.join(", ") : "none")
      );
    }

    // Build a part-id -> part-name map from <part-list> first.
    const nameById = {};
    const scoreParts = root.querySelectorAll("part-list score-part");
    for (let i = 0; i < scoreParts.length; i++) {
      const sp = scoreParts[i];
      const id = sp.getAttribute("id");
      if (id) nameById[id] = textOf(sp, "part-name");
    }

    // Iterate the actual <part> elements generically (multiple parts supported).
    const parts = [];
    // Piece-level flags for the summary: true when any measure carries a repeat,
    // a key change or a clef change.
    let hasRepeat = false;
    let hasKeyChange = false;
    let hasClefChange = false;
    const partEls = root.querySelectorAll("part");
    for (let p = 0; p < partEls.length; p++) {
      const partEl = partEls[p];
      const id = partEl.getAttribute("id");
      // This part's OWN initial clefs, read from its first <attributes>. Where a
      // keyboard is spread across two parts each declares its clef with no number
      // attribute, so both key as "1" and only the part tells the hands apart.
      const partClefs = clefsOf(partEl);
      const measures = [];
      const measureEls = partEl.querySelectorAll("measure");
      // Running structural state, reset per part: the clef and key in force, so a
      // later measure's declaration can be detected as a change; and the most
      // recent forward-repeat bar, so a backward repeat can say which bar it
      // returns to (the first bar when there is no forward repeat).
      let runningClef = null;
      let runningKey = null;
      let lastForwardRepeatBar = null;
      // Wedge (dynamic shaping) state, held ACROSS measure boundaries within this
      // part and reset per part — deliberately unlike pendingDynamic, which resets
      // per measure. lastChordHead is the most recent note emitted whose chord flag
      // is falsy, so a <wedge type="stop"> that opens a bar can reach back to the
      // previous bar's last note: three Satie spans cross a barline. It tracks the
      // chord HEAD rather than the last note pushed because the renderer reads a
      // chord's head note for its fields. openWedges maps a direction's staff key
      // to a stack of the wedge types still open on that staff, so a start on
      // staff 1 and a stop on staff 2 can never pair.
      let lastChordHead = null;
      const openWedges = {};
      const firstBarNumber = measureEls.length ? measureEls[0].getAttribute("number") : null;
      for (let m = 0; m < measureEls.length; m++) {
        const measureEl = measureEls[m];
        const notes = [];
        // Track the dynamic from any <direction> we pass so it attaches to the
        // next note. Reset per measure; cross-measure persistence is out of scope.
        let pendingDynamic = null;
        // Track every wedge START from the <direction> elements we pass so they
        // attach to the next note, as pendingDynamic does — and, as pendingDynamic
        // does, reset per measure. A LIST rather than a single value, because two
        // starts can arrive before the next note and neither may displace the other;
        // it is emptied when a note consumes it. A wedge STOP needs no pending
        // variable: it attaches BACKWARD, to lastChordHead, held per part instead.
        let pendingWedges = [];
        // Track the chord symbol from any <harmony> we pass so it attaches to the
        // next note, exactly as pendingDynamic does, and reset per measure
        // alongside it. SINGULAR, not a list like pendingWedges: two wedge starts
        // before one note are both real and neither may displace the other, but a
        // chord symbol replaced before it is ever heard is an engraving the model
        // has no way to express, so the FIRST is kept and the later one warned
        // about at the branch below.
        let pendingHarmony = null;
        // note.onset is the note's position in divisions from the bar start. The
        // cursor advances by each non-chord note's duration and is moved by a
        // <backup> (rewind) and a <forward> (skip), so simultaneous voices and
        // staves share onsets rather than running end to end; a chord member
        // takes the previous note's onset and does not advance the cursor; a
        // grace note carries no duration, so it advances the cursor by zero on
        // its own. Both reset per measure alongside pendingDynamic.
        let cursor = 0;
        let lastOnset = 0;
        // Walk the measure's direct children in document order: <direction>
        // elements sit between notes, so only an in-order walk associates a
        // dynamic with the note that follows it. Notes are direct measure children.
        const children = measureEl.children;
        for (let c = 0; c < children.length; c++) {
          const child = children[c];
          if (child.tagName === "direction") {
            const dyn = dynamicOf(child);
            if (dyn) pendingDynamic = dyn;
            // Wedge shaping. A start attaches FORWARD to the next note and is
            // pushed onto its staff's open stack; a stop attaches BACKWARD, because
            // the direction sits AFTER the last note of its span, and takes the type
            // of the wedge it closes by popping that staff's stack.
            const wedge = wedgeOf(child);
            if (wedge === "crescendo" || wedge === "diminuendo") {
              pendingWedges.push(wedge);
              const startStaff = directionStaffOf(child);
              if (!openWedges[startStaff]) openWedges[startStaff] = [];
              openWedges[startStaff].push(wedge);
            } else if (wedge === "stop") {
              const stopStaff = directionStaffOf(child);
              const stack = openWedges[stopStaff];
              if (!stack || stack.length === 0) {
                // Nothing open on THIS staff key, so the closing type is unknown.
                // Stamp nothing rather than emit an ending we cannot type.
                logWarn(
                  "MusicParse: wedge stop on staff " + stopStaff + " in bar " +
                    measureEl.getAttribute("number") + " closes nothing that is open; stamping no ending"
                );
              } else {
                if (stack.length > 1) {
                  logWarn(
                    "MusicParse: wedge stop on staff " + stopStaff + " in bar " +
                      measureEl.getAttribute("number") + ": " + stack.length +
                      " wedges are open on that staff and the file numbers no wedge, so the closing type is inferred as the most recently opened"
                  );
                }
                const closingType = stack.pop();
                if (lastChordHead === null) {
                  logDebug(
                    "MusicParse: wedge stop on staff " + stopStaff + " in bar " +
                      measureEl.getAttribute("number") + " has no preceding note in this part; stamping no ending"
                  );
                } else if (lastChordHead.shaping === null || lastChordHead.shaping === undefined) {
                  lastChordHead.shaping = { starts: [], stops: [closingType] };
                } else {
                  // PUSH, never overwrite. A note can legitimately end two wedges —
                  // the real Satie does at bar 8 and the real Joplin at bar 68 — and
                  // it can end one while beginning another, so neither endpoint list
                  // may displace the other or itself.
                  lastChordHead.shaping.stops.push(closingType);
                }
              }
            }
            // Textual dynamic shaping (Stage 60): an engraved "cresc." or "dim."
            // read from the SAME direction. Read AFTER the wedge deliberately — if
            // one direction somehow carried both, both would be pushed, which is
            // correct and needs no special case.
            //
            // A match pushes onto the SAME pendingWedges list a wedge start uses,
            // so it attaches forward to the next note by exactly the same route and
            // reads through the Stage 59 clause with no renderer change. A textual
            // instruction is NOT distinguished from a hairpin on the model, because
            // it is the same instruction; a future feature wanting to say "marked
            // cresc." would have to add the distinction then.
            //
            // It deliberately does NOT join openWedges. A textual mark has no
            // printed ending, so it could never be popped, and joining the stack
            // would fire the "part ended with N wedges still open" warning seven
            // times on a clean Palestrina. The consequence, accepted: a file that
            // printed cresc. and later closed it with a <wedge type="stop"> leaves
            // that stop unmatched, which produces the existing "closes nothing that
            // is open" warning and stamps no ending — a reading that is silent
            // about the close rather than a wrong one.
            const textualShaping = textualShapingOf(child);
            if (textualShaping) pendingWedges.push(textualShaping);
          } else if (child.tagName === "harmony") {
            // Chord symbols (Stage 61). A <harmony> is a direct child of <measure>
            // sitting between notes, exactly as a <direction> is, so it reaches a
            // note by the same forward-attaching route.
            const harmony = harmonyOf(child);
            if (harmony) {
              if (pendingHarmony === null) {
                pendingHarmony = harmony;
              } else {
                // MEASURED UNREACHABLE ON THE WHOLE CORPUS. No <harmony> in the
                // Joplin — the only real file that carries any — is followed by
                // another <harmony> without a note between them, checked across
                // all 72 adjacent pairs, and no other real file carries one at
                // all. This branch therefore exists for a file we have not seen,
                // and one warning is emitted rather than a silent discard so such
                // a file announces itself the first time it is opened.
                logWarn(
                  "MusicParse: a second <harmony> in bar " + measureEl.getAttribute("number") +
                    " arrives before any note has taken the first; keeping the earlier symbol and ignoring the later one"
                );
              }
            }
          } else if (child.tagName === "backup") {
            cursor -= (intOf(child, "duration") || 0);
          } else if (child.tagName === "forward") {
            cursor += (intOf(child, "duration") || 0);
          } else if (child.tagName === "note") {
            const note = noteLayer.extractNote(child);
            note.dynamic = pendingDynamic;
            pendingDynamic = null;
            // note.shaping is the dynamic shaping AT this note: an object
            // { starts, stops } holding two ARRAYS of wedge types ("crescendo" or
            // "diminuendo"), each in document order, either possibly empty but both
            // always present and never null. The whole field is null when the note
            // carries no endpoint at all — a note with nothing is null, never
            // { starts: [], stops: [] }. Assigned on EVERY note, exactly as dynamic
            // is, so the key is always present and the neutral value is null,
            // never undefined.
            //
            // The two members are INDEPENDENT ENDPOINT LISTS, not a paired span.
            // Like slurOf and tieOf this records endpoints rather than spans, except
            // that those carry a boolean per endpoint where this carries the wedge
            // type, and this carries a LIST because a note can hold more than one of
            // either. No pairing is attempted because no wedge in the corpus carries
            // a number attribute, and MusicXML leaves overlapping unnumbered wedges
            // ambiguous: the stack above resolves a close as the most recently
            // opened wedge on that staff and says so in a warning, which is an
            // inference, not the file's word.
            //
            // A note legitimately carrying TWO endings is not hypothetical: the real
            // Satie stamps two stops on the bar-8 rest and the real Joplin two on the
            // last note of bar 68. The model therefore holds every ending the file
            // writes. Stage 59 decides what a reader HEARS and may deliberately voice
            // fewer endings than the model holds.
            //
            // Named shaping rather than wedge because Stage 60 puts a textual
            // "cresc." into this same field, so the name must not be format-
            // specific. Stage 59 voices it; nothing reads it yet.
            note.shaping = pendingWedges.length === 0 ? null : { starts: pendingWedges, stops: [] };
            pendingWedges = [];
            // note.harmony is the chord symbol IN FORCE FROM this note: an object
            // { rootStep, rootAlter, kind, bassStep, bassAlter } of RAW MusicXML
            // codes, or null when no chord symbol precedes the note in its bar.
            // Assigned on EVERY note exactly as dynamic is, so the key is always
            // present and the neutral value is null, never undefined.
            //
            // It is stamped on the NEXT NOTE rather than held at the position it
            // was printed at because the model has no measure-position anchor: a
            // measure holds a list of notes and nothing else that carries a
            // position, so the pending mechanism pendingDynamic established is the
            // only precedent this model has for a between-notes event acquiring
            // one. The consequence, accepted and worth stating: a chord symbol
            // printed after the last note of a bar reaches no note and is lost,
            // which no file in the corpus does.
            //
            // The value is RAW and nothing reads it yet. Stage 62 adds the naming
            // map in music-names, Stage 63 carries it through describeNote, and
            // Stage 64 voices it; until then no reader hears anything at all.
            note.harmony = pendingHarmony;
            pendingHarmony = null;
            if (note.chord === true) {
              note.onset = lastOnset;
            } else {
              note.onset = cursor;
              lastOnset = cursor;
              cursor += (note.duration || 0);
            }
            notes.push(note);
            // The chord head a later stop reaches back to. A chord member is never
            // the head, and the reference survives the end of this measure.
            if (note.chord !== true) lastChordHead = note;
          }
        }
        // Structural marks for this measure, read by the structure layer. The
        // running clef and key turn a raw declaration into a change; the
        // forward-repeat bar resolves where a backward repeat returns to. Bar 1's
        // declarations seed the running state and are never themselves a change.
        const structure = structureLayer.readStructure(measureEl);
        let clefChange = null;
        let keyChange = null;
        if (structure.clef) {
          if (m > 0 && (runningClef === null || runningClef.sign !== structure.clef.sign || runningClef.line !== structure.clef.line)) {
            clefChange = structure.clef;
            hasClefChange = true;
          }
          runningClef = structure.clef;
        }
        if (structure.key) {
          if (m > 0 && (runningKey === null || runningKey.fifths !== structure.key.fifths)) {
            keyChange = structure.key;
            hasKeyChange = true;
          }
          runningKey = structure.key;
        }
        if (structure.repeatForward) lastForwardRepeatBar = measureEl.getAttribute("number");
        let repeatTo = null;
        if (structure.repeatBackward) {
          repeatTo = lastForwardRepeatBar !== null ? lastForwardRepeatBar : firstBarNumber;
        }
        if (structure.repeatForward || structure.repeatBackward) hasRepeat = true;
        measures.push({
          number: measureEl.getAttribute("number"),
          notes: notes,
          clefChange: clefChange,
          keyChange: keyChange,
          repeatTo: repeatTo,
          endingStart: structure.endingStart,
          endingStop: structure.endingStop,
          // The rehearsal mark printed on this bar, as the engraver's own text
          // ("A", "B.1", "Coda"), or null when the bar carries none. Carried
          // VERBATIM and unconverted: unlike a clef or key declaration it is a
          // mark printed ON the bar rather than a change against running state,
          // so it needs no running value to interpret it. The undefined guard
          // covers a structure layer that predates the key. Stage 56 announces
          // it on the bar heading; nothing reads it yet.
          rehearsal: structure.rehearsal === undefined ? null : structure.rehearsal,
        });
      }
      // Any wedge still open when the part ends is an unbalanced span: one warning
      // naming the part and how many, summed across every staff key. Unreached on
      // the current fixtures, where starts and stops balance on every staff.
      let wedgesLeftOpen = 0;
      for (const staffKey of Object.keys(openWedges)) wedgesLeftOpen += openWedges[staffKey].length;
      if (wedgesLeftOpen > 0) {
        logWarn(
          "MusicParse: part " + (id === null ? "(no id)" : id) + " ended with " +
            wedgesLeftOpen + " wedge(s) still open"
        );
      }
      parts.push({
        id: id,
        name: id && Object.prototype.hasOwnProperty.call(nameById, id) ? nameById[id] : null,
        clefs: partClefs,
        measures: measures,
      });
    }

    logInfo("Parsed MusicXML: " + parts.length + " part(s)");
    return {
      workTitle: workTitle,
      divisions: divisions,
      key: key,
      time: time,
      tempo: tempo,
      tempoMark: tempoMark,
      hasRepeat: hasRepeat,
      hasKeyChange: hasKeyChange,
      hasClefChange: hasClefChange,
      staves: staves,
      clefs: clefs,
      partGroups: partGroups,
      parts: parts,
    };
  }

  // Self-test: synchronous and self-contained (no fetch). Parses the project's
  // fixed fixture once and asserts the model against its known counts, then
  // confirms the failure paths return null. Needs MusicParseNote loaded for the
  // real note reads. console.table()s and returns the results object.
  function selfTest() {
    const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
      <note><rest/><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

    const model = parse(SAMPLE);

    // Flatten parts -> measures -> notes to compute counts.
    const allNotes = model
      ? model.parts.reduce(function (acc, part) {
          return acc.concat(
            part.measures.reduce(function (a, measure) {
              return a.concat(measure.notes);
            }, [])
          );
        }, [])
      : [];
    const pitchedCount = allNotes.filter(function (note) {
      return note.rest === false;
    }).length;
    const restNotes = allNotes.filter(function (note) {
      return note.rest === true;
    });
    const firstNote = model ? model.parts[0].measures[0].notes[0] : null;
    const theRest = restNotes.length === 1 ? restNotes[0] : null;

    // Rich fixture, identical to sample/sample-rich.musicxml. Exercises the new
    // per-note fields (tie, slur, lyric, dynamic) and the per-piece tempo.
    const RICH = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC rich sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>120</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="120"/>
      </direction>
      <direction placement="below">
        <direction-type>
          <dynamics><f/></dynamics>
        </direction-type>
      </direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations><slur type="start" number="1"/></notations>
        <lyric><text>la</text></lyric>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations><slur type="stop" number="1"/></notations>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <tie type="start"/>
        <type>quarter</type>
        <notations><tied type="start"/></notations>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <tie type="stop"/>
        <type>quarter</type>
        <notations><tied type="stop"/></notations>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`;
    const richModel = parse(RICH);
    const rm1 = richModel ? richModel.parts[0].measures[0].notes : [];
    const rm2 = richModel ? richModel.parts[0].measures[1].notes : [];
    const rC4 = rm1[0], rD4 = rm1[1], rE4a = rm1[2], rE4b = rm1[3], rG4 = rm2[0];

    // Accidentals fixture, identical to sample/sample-accidentals.musicxml.
    // Exercises the new alter field: a sharp (1), a natural (0), a flat (-1),
    // and plain notes (null), with 0 kept distinct from null.
    const ACCIDENTALS = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC accidentals sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <accidental>sharp</accidental>
      </note>
      <note>
        <pitch><step>C</step><alter>0</alter><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <accidental>natural</accidental>
      </note>
      <note>
        <pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <accidental>flat</accidental>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>`;
    const accModel = parse(ACCIDENTALS);
    const am1 = accModel ? accModel.parts[0].measures[0].notes : [];
    const am2 = accModel ? accModel.parts[0].measures[1].notes : [];
    const aC = am1[0], aCsharp = am1[1], aCnat = am1[2], aBflat = am1[3];
    const aG = am2[0], aD = am2[1];

    // Chords fixture, identical to sample/sample-chords.musicxml. Exercises the
    // new additive chord flag: bar 1 is a C major triad, a single note, a
    // two-note chord and a rest; bar 2 is a single note then a C major triad.
    // Eleven flat notes, six chord events, proving the flag without disturbing
    // any existing field.
    const CHORDS = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC chords sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <chord/>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <chord/>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <rest/>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <chord/>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>`;
    const chordsModel = parse(CHORDS);
    const cm1 = chordsModel ? chordsModel.parts[0].measures[0].notes : [];
    const cm2 = chordsModel ? chordsModel.parts[0].measures[1].notes : [];

    // Structure fixture, identical to sample/sample-structure.musicxml. Exercises
    // the new structural reads: a forward repeat (bar 1), a mid-piece key change
    // (bar 2), a mid-piece clef change to bass (bar 3), a first-time ending closing
    // with a backward repeat to bar 1 (bar 4), and a second-time ending (bar 5).
    const STRUCTURE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC structure sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <attributes><key><fifths>1</fifths></key></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <attributes><clef><sign>F</sign><line>4</line></clef></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <barline location="left"><ending number="1" type="start"/></barline>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
    <measure number="5">
      <barline location="left"><ending number="2" type="start"/></barline>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style><ending number="2" type="discontinue"/></barline>
    </measure>
  </part>
</score-partwise>`;
    const structModel = parse(STRUCTURE);
    const sm = structModel ? structModel.parts[0].measures : [];
    const sm1 = sm[0], sm2 = sm[1], sm3 = sm[2], sm4 = sm[3], sm5 = sm[4];

    // Piano fixture, identical to sample/sample-piano.musicxml. Two staves, a
    // treble clef on staff 1 and a bass clef on staff 2, a <backup> rewinding each
    // bar, every note staff-tagged, and a chord on the treble staff in bar 2.
    const PIANO = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC piano sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><chord/><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><chord/><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>A</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>B</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>`;
    const pianoModel = parse(PIANO);
    const pm1 = pianoModel ? pianoModel.parts[0].measures[0].notes : [];
    const pmClefs = pianoModel ? pianoModel.clefs : {};

    // Onset fixtures (Stage 5.1). Two tiny inline scores prove the two moves the
    // real files exercise: a <rest> advances the cursor like any note, and a
    // <backup> rewinds it so a later note shares an earlier note's onset.
    // REST_ONSET: a quarter rest (duration 2) then a note; the note's onset must
    // equal the rest's onset plus the rest's duration (0 + 2 = 2).
    const REST_ONSET = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><rest/><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const restOnsetModel = parse(REST_ONSET);
    const roNotes = restOnsetModel ? restOnsetModel.parts[0].measures[0].notes : [];
    const roRest = roNotes[0], roNote = roNotes[1];

    // BACKUP_ONSET: two notes (durations 2 and 2), a <backup> of the first note's
    // duration (2), then a third note; the backup rewinds the cursor from 4 to 2,
    // then again — a backup of 2 lands on 2, so the third note shares the SECOND
    // note's onset (2). To prove a backup can share the FIRST note's onset we back
    // up the full 4 instead, so the third note lands on 0 with the first note.
    const BACKUP_ONSET = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const backupOnsetModel = parse(BACKUP_ONSET);
    const boNotes = backupOnsetModel ? backupOnsetModel.parts[0].measures[0].notes : [];
    const boFirst = boNotes[0], boThird = boNotes[2];

    // Chord onset triad from bar 1 of CHORDS: cm1[0..2] are the C-E-G triad and
    // cm1[3] the next non-chord note. All three triad members share one onset and
    // the next event has a strictly greater onset (the chord advanced once).
    const chordTriadOnsets = cm1.length >= 4 ? [cm1[0].onset, cm1[1].onset, cm1[2].onset] : [];
    const chordNextOnset = cm1.length >= 4 ? cm1[3].onset : null;
    // Piano bar-1 onsets, reported so the two overlapping staves are visible: the
    // first staff-1 note and the first staff-2 note both sit at 0 (the backup
    // rewound to the bar start), and the last staff-1 note advanced past 0.
    const pianoBar1Onsets = pm1.map(function (n) { return n.onset; });

    // Tempo fixtures for the printed-metronome reader and normalisation. Each is a
    // minimal one-note score carrying a different tempo shape, so model.tempo and
    // model.tempoMark can be asserted without disturbing any note-level fields.
    function tempoScore(inner) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        "<part-list><score-part id=\"P1\"><part-name>Melody</part-name></score-part></part-list>" +
        '<part id="P1"><measure number="1">' +
        inner +
        "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>" +
        "</measure></part></score-partwise>"
      );
    }
    // Printed "quarter = ca. 76": digits parsed out of the noisy per-minute, no dots.
    const tempoQuarter76 = parse(
      tempoScore("<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>ca. 76</per-minute></metronome></direction-type></direction>")
    );
    // Printed "half = 100": a half beat is two quarters, so 100 -> 200 QPM.
    const tempoHalf100 = parse(
      tempoScore("<direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>100</per-minute></metronome></direction-type></direction>")
    );
    // Printed dotted quarter at 80: one dot lengthens the beat by 1.5, so 80 -> 120 QPM.
    const tempoDottedQuarter80 = parse(
      tempoScore("<direction><direction-type><metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>80</per-minute></metronome></direction-type></direction>")
    );
    // Sound tempo only (no metronome): tempoMark null, tempo falls back to the sound value.
    const tempoSoundOnly90 = parse(tempoScore('<direction><sound tempo="90"/></direction>'));
    // Neither a metronome nor a sound tempo: both null.
    const tempoNeither = parse(tempoScore(""));
    // Metronome whose per-minute holds no digits (e.g. a stray "ca."): no usable
    // mark, so it falls back to the sound tempo with a null mark.
    const tempoNoDigits = parse(
      tempoScore("<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>ca.</per-minute></metronome></direction-type><sound tempo=\"72\"/></direction>")
    );

    // Title fixtures for the title fallback chain (Stage 3.2). Each is a minimal
    // one-note score whose header (before the part-list) and measure carry a
    // different title source, so model.workTitle can be asserted without
    // disturbing any other field. header sits at score-partwise level; measureInner
    // sits inside bar 1 (used for the direction-word last resort).
    function titleScore(header, measureInner) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        header +
        "<part-list><score-part id=\"P1\"><part-name>Melody</part-name></score-part></part-list>" +
        '<part id="P1"><measure number="1">' +
        (measureInner || "") +
        "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>" +
        "</measure></part></score-partwise>"
      );
    }
    // work-title wins over a movement-title and a credit-words that are also present.
    const titleWorkWins = parse(
      titleScore("<work><work-title>Work Wins</work-title></work><movement-title>Movement Loser</movement-title><credit><credit-words>Credit Loser</credit-words></credit>", "")
    );
    // movement-title only.
    const titleMovementOnly = parse(titleScore("<movement-title>Only Movement</movement-title>", ""));
    // A single untyped credit-words.
    const titleCreditOnly = parse(titleScore("<credit><credit-words>Only Credit</credit-words></credit>", ""));
    // A credit typed "title" is preferred over an untyped credit-words both before and after it.
    const titleCreditTyped = parse(
      titleScore("<credit><credit-words>Untyped Earlier</credit-words></credit><credit><credit-type>title</credit-type><credit-words>Typed Title</credit-words></credit><credit><credit-words>Untyped Later</credit-words></credit>", "")
    );
    // A direction words element, with none of the above: the last-resort source.
    const titleDirection = parse(
      titleScore("", "<direction><direction-type><words>Direction Word</words></direction-type></direction>")
    );
    // None of the four sources present: null.
    const titleNone = parse(titleScore("", ""));

    // Largest-font heading selection (Stage 3.4). Each fixture carries no
    // work-title or movement-title, so the title is chosen by engraving weight
    // (or, for the last, by the explicit credit-type "title" marking). Credit
    // words and bar-1 direction words carry explicit font-size attributes.
    // Palestrina-like: three small credits (font-size 7 and 8, one a "#" marker)
    // are beaten by the bar-1 direction word "Sicut cervus" at 19; "Psalm 42"
    // and the composer line sit at 11.
    const titlePalestrina = parse(
      titleScore(
        "<credit><credit-words font-size=\"8\">James Gibb editions</credit-words></credit><credit><credit-words font-size=\"7\">#</credit-words></credit><credit><credit-words font-size=\"7\">G. P. da Palestrina</credit-words></credit>",
        "<direction><direction-type><words font-size=\"11\">Psalm 42</words></direction-type></direction>" +
          "<direction><direction-type><words font-size=\"19\">Sicut cervus</words></direction-type></direction>" +
          "<direction><direction-type><words font-size=\"11\">G. P. da Palestrina</words></direction-type></direction>"
      )
    );
    // Joplin-like: the title is the largest credit at 30, over the composer at
    // 15 and an edition note at 12.
    const titleJoplin = parse(
      titleScore(
        "<credit><credit-words font-size=\"30\">The Entertainer</credit-words></credit><credit><credit-words font-size=\"15\">Scott Joplin</credit-words></credit><credit><credit-words font-size=\"12\">Edition note</credit-words></credit>",
        ""
      )
    );
    // Satie-like: an accented title credit at 24 beats the composer at 12 and an
    // unsized (font-size zero) bar-1 tempo word. Proves accented text qualifies.
    const titleSatie = parse(
      titleScore(
        "<credit><credit-words font-size=\"24\">Gymnopédie No.1</credit-words></credit><credit><credit-words font-size=\"12\">Erik Satie</credit-words></credit>",
        "<direction><direction-type><words>Lent et douloureux</words></direction-type></direction>"
      )
    );
    // The largest-font candidate is a no-letter marker ("#" at 40); the smaller
    // lettered credit at 18 wins, proving the looksLikeTitle letter filter.
    const titleMarkerFiltered = parse(
      titleScore(
        "<credit><credit-words font-size=\"40\">#</credit-words></credit><credit><credit-words font-size=\"18\">Real Title</credit-words></credit>",
        ""
      )
    );
    // A credit-type "title" at a small font still overrides a larger untyped
    // credit, proving the explicit marker beats the heuristic.
    const titleTypedBeatsLarger = parse(
      titleScore(
        "<credit><credit-type>title</credit-type><credit-words font-size=\"9\">Typed Small Title</credit-words></credit><credit><credit-words font-size=\"40\">Big Untyped</credit-words></credit>",
        ""
      )
    );

    // Stage 49 fixtures: per-part clefs and part-list groups, both additive.
    // BRACED is modelled on the real Joplin file: a braced part-group over two
    // score-parts with EMPTY part-names, P1 declaring a G clef on line 2 and P2 an
    // F clef on line 4, each with NO number attribute (so both key as "1"), one
    // bar apiece. This is a keyboard spread across two parts rather than two
    // staves of one part.
    const BRACED = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <part-group type="start" number="1">
      <group-symbol>brace</group-symbol>
    </part-group>
    <score-part id="P1"><part-name></part-name></score-part>
    <score-part id="P2"><part-name></part-name></score-part>
    <part-group type="stop" number="1"/>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const bracedModel = parse(BRACED);
    const bracedParts = bracedModel ? bracedModel.parts : [];
    const bracedGroup = bracedModel && bracedModel.partGroups.length === 1 ? bracedModel.partGroups[0] : null;

    // A minimal score wrapping a given <part-list> body, with one real part so the
    // model still parses. Only the part-list matters to the group reads, so the
    // group fixtures below stay small.
    function groupScore(partListInner) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        "<part-list>" + partListInner + "</part-list>" +
        '<part id="P1"><measure number="1">' +
        "<attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>" +
        "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>" +
        "</measure></part></score-partwise>"
      );
    }

    // Nested groups: a bracket named "Choir" over all three score-parts, holding a
    // brace over the last two. The inner group's <group-name> is EMPTY, so it must
    // read null exactly as an absent one does.
    const nestedModel = parse(
      groupScore(
        '<part-group type="start" number="1"><group-symbol>bracket</group-symbol><group-name>Choir</group-name></part-group>' +
          '<score-part id="P1"><part-name>Soprano</part-name></score-part>' +
          '<part-group type="start" number="2"><group-symbol>brace</group-symbol><group-name></group-name></part-group>' +
          '<score-part id="P2"><part-name>Right</part-name></score-part>' +
          '<score-part id="P3"><part-name>Left</part-name></score-part>' +
          '<part-group type="stop" number="2"/>' +
          '<part-group type="stop" number="1"/>'
      )
    );
    const nestedGroups = nestedModel ? nestedModel.partGroups : [];
    const nestedOuter = nestedGroups[0] || null;
    const nestedInner = nestedGroups[1] || null;

    // A start with no stop: the group is still returned, with its members.
    const unclosedModel = parse(
      groupScore(
        '<part-group type="start" number="1"><group-symbol>brace</group-symbol></part-group>' +
          '<score-part id="P1"><part-name>Piano</part-name></score-part>'
      )
    );

    // A stop with no start: parse must not throw, so run it inside a guard and
    // record both whether it threw and what came back.
    const MALFORMED_GROUPS = groupScore(
      '<score-part id="P1"><part-name>Melody</part-name></score-part><part-group type="stop" number="1"/>'
    );
    let malformedModel = null;
    let malformedThrew = false;
    try {
      malformedModel = parse(MALFORMED_GROUPS);
    } catch (error) {
      malformedThrew = true;
    }

    // A score with no <part-list> at all: no names, and no groups.
    const NO_PART_LIST =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<score-partwise version="4.0">' +
      '<part id="P1"><measure number="1">' +
      "<attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>" +
      "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>" +
      "</measure></part></score-partwise>";
    const noPartListModel = parse(NO_PART_LIST);

    // A one-part score's part.clefs must carry the same keys and values as
    // model.clefs, since both read the same first <attributes>. Compared by value,
    // key by key — they are separate objects, so identity would prove nothing.
    const singlePartClefsMatch = (function () {
      if (!model || !model.clefs || !model.parts[0] || !model.parts[0].clefs) return false;
      const modelClefs = model.clefs;
      const partClefs = model.parts[0].clefs;
      const keys = Object.keys(modelClefs);
      if (Object.keys(partClefs).length !== keys.length) return false;
      return keys.every(function (key) {
        return (
          !!partClefs[key] &&
          partClefs[key].sign === modelClefs[key].sign &&
          partClefs[key].line === modelClefs[key].line
        );
      });
    })();

    // Rehearsal-mark fixture (Stage 55). Four bars that deliberately mix the new
    // mark with the existing structural marks, so the carry can be proven not to
    // disturb them: bar 1 a plain "A" sharing its bar with a forward repeat, bar
    // 2 a dotted composite "B.1" sharing its bar with a key change, bar 3 NO mark
    // at all sharing its bar with a clef change, and bar 4 a "C" sharing its bar
    // with a first-time ending that closes on a backward repeat.
    const REHEARSAL = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC rehearsal sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <barline location="left"><repeat direction="forward"/></barline>
      <direction placement="above"><direction-type><rehearsal>A</rehearsal></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <attributes><key><fifths>1</fifths></key></attributes>
      <direction placement="above"><direction-type><rehearsal>B.1</rehearsal></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <attributes><clef><sign>F</sign><line>4</line></clef></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <barline location="left"><ending number="1" type="start"/></barline>
      <direction placement="above"><direction-type><rehearsal>C</rehearsal></direction-type></direction>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
  </part>
</score-partwise>`;
    const rehearsalModel = parse(REHEARSAL);
    const hm = rehearsalModel ? rehearsalModel.parts[0].measures : [];
    const hm1 = hm[0], hm2 = hm[1], hm3 = hm[2], hm4 = hm[3];

    // True when EVERY measure of every part owns a rehearsal key in its own
    // right. Uses hasOwnProperty rather than a truthiness or undefined test, so a
    // bar that legitimately reads null still counts as carrying the key — which
    // is the whole point of the field being present on every bar.
    function everyMeasureOwnsRehearsal(candidate) {
      if (!candidate || !Array.isArray(candidate.parts) || candidate.parts.length === 0) return false;
      return candidate.parts.every(function (part) {
        return (
          part.measures.length > 0 &&
          part.measures.every(function (measure) {
            return Object.prototype.hasOwnProperty.call(measure, "rehearsal");
          })
        );
      });
    }

    // Wedge fixtures (Stage 57). WEDGES is the everyday shape: bar 1 opens a
    // crescendo before the first note and closes it after the second, sharing its
    // bar with an existing <dynamics> so the dynamic field can be proven
    // undisturbed; bar 2 opens a diminuendo on a direction that DOES carry
    // <staff>1</staff> and closes it on one that carries NO <staff> child, so the
    // pairing only holds if an absent staff keys as "1".
    const WEDGES = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Accessible Music PoC wedge sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="below"><direction-type><dynamics><f/></dynamics></direction-type></direction>
      <direction placement="below"><direction-type><wedge type="crescendo"/></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <direction placement="below"><direction-type><wedge type="stop"/></direction-type></direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <direction placement="below"><direction-type><wedge type="diminuendo"/></direction-type><staff>1</staff></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
      <direction placement="below"><direction-type><wedge type="stop"/></direction-type></direction>
    </measure>
  </part>
</score-partwise>`;
    const wedgeModel = parse(WEDGES);
    const wm1 = wedgeModel ? wedgeModel.parts[0].measures[0].notes : [];
    const wm2 = wedgeModel ? wedgeModel.parts[0].measures[1].notes : [];

    // A minimal single-part score wrapping given measure bodies, so the wedge
    // fixtures below stay small. Bar 1 declares the attributes; each later bar
    // holds only what the case needs.
    function wedgeScore(bars) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        '<part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>' +
        '<part id="P1">' +
        bars +
        "</part></score-partwise>"
      );
    }
    const WEDGE_ATTRS =
      "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
      "<time><beats>4</beats><beat-type>4</beat-type></time>" +
      "<clef><sign>G</sign><line>2</line></clef></attributes>";
    // A <note> element as a one-liner, so a fixture's shape stays readable.
    function wedgeNote(step, octave, duration, type, extra) {
      return (
        "<note>" + (extra || "") +
        "<pitch><step>" + step + "</step><octave>" + octave + "</octave></pitch>" +
        "<duration>" + duration + "</duration><type>" + type + "</type></note>"
      );
    }
    function wedgeDir(type) {
      return '<direction placement="below"><direction-type><wedge type="' + type + '"/></direction-type></direction>';
    }

    // A stop directly after a CHORD must reach the chord HEAD, not a member: the
    // crescendo opens before A3, the chord C4-E4-G4 follows, and the stop sits
    // after the last chord member.
    const wedgeChordModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeDir("crescendo") +
          wedgeNote("A", 3, 1, "quarter") +
          wedgeNote("C", 4, 1, "quarter") +
          wedgeNote("E", 4, 1, "quarter", "<chord/>") +
          wedgeNote("G", 4, 1, "quarter", "<chord/>") +
          wedgeDir("stop") +
          wedgeNote("B", 3, 1, "quarter") +
          "</measure>"
      )
    );
    const wcm = wedgeChordModel ? wedgeChordModel.parts[0].measures[0].notes : [];

    // A stop OPENING a bar belongs to the previous bar's last note — the shape
    // three Satie spans take. The stop is bar 2's first child, before any note.
    const wedgeCrossModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeDir("crescendo") +
          wedgeNote("C", 4, 2, "half") +
          wedgeNote("D", 4, 2, "half") +
          "</measure>" +
          '<measure number="2">' +
          wedgeDir("stop") +
          wedgeNote("E", 4, 4, "whole") +
          "</measure>"
      )
    );
    const xb1 = wedgeCrossModel ? wedgeCrossModel.parts[0].measures[0].notes : [];
    const xb2 = wedgeCrossModel ? wedgeCrossModel.parts[0].measures[1].notes : [];

    // A stop with nothing open on its staff must stamp NOTHING, since its closing
    // type is unknown. Logs one warning.
    const wedgeOrphanModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeNote("C", 4, 2, "half") +
          wedgeDir("stop") +
          wedgeNote("D", 4, 2, "half") +
          "</measure>"
      )
    );
    const wom = wedgeOrphanModel ? wedgeOrphanModel.parts[0].measures[0].notes : [];

    // A start on staff 1 and a stop on staff 2 must NOT pair: the staff-2 note
    // carries nothing, and the staff-1 wedge is still open when the part ends (a
    // second warning).
    const WEDGE_STAVES = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <direction placement="below"><direction-type><wedge type="crescendo"/></direction-type><staff>1</staff></direction>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><type>whole</type><staff>2</staff></note>
      <direction placement="below"><direction-type><wedge type="stop"/></direction-type><staff>2</staff></direction>
    </measure>
  </part>
</score-partwise>`;
    const wedgeStavesModel = parse(WEDGE_STAVES);
    const wsm = wedgeStavesModel ? wedgeStavesModel.parts[0].measures[0].notes : [];

    // Two STARTS before one note: both are carried, in document order, and neither
    // displaces the other. Bar 1 closes them again so the fixture balances.
    const wedgeTwoStartsModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeDir("crescendo") +
          wedgeDir("diminuendo") +
          wedgeNote("C", 4, 2, "half") +
          wedgeNote("D", 4, 2, "half") +
          wedgeDir("stop") +
          wedgeDir("stop") +
          "</measure>"
      )
    );
    const wtsm = wedgeTwoStartsModel ? wedgeTwoStartsModel.parts[0].measures[0].notes : [];

    // One start and one stop on the SAME note, so each array holds exactly one: the
    // crescendo opens before C4 and closes immediately after it.
    const wedgeOneEachModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeDir("crescendo") +
          wedgeNote("C", 4, 2, "half") +
          wedgeDir("stop") +
          wedgeNote("D", 4, 2, "half") +
          "</measure>"
      )
    );
    const woem = wedgeOneEachModel ? wedgeOneEachModel.parts[0].measures[0].notes : [];

    // The depth-two overlap both real files carry, in miniature (Satie bars 7-8,
    // Joplin bar 68): a crescendo opens in bar 1, a diminuendo opens in bar 2, and
    // TWO stops follow. Bar 2's note therefore carries one start and BOTH endings,
    // with nothing overwritten. The first stop pops the diminuendo (the most
    // recently opened, with one warning) and the second the crescendo, so stops
    // reads in LIFO pop order: most recently opened first.
    const wedgeBothModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          wedgeDir("crescendo") +
          wedgeNote("C", 4, 4, "whole") +
          "</measure>" +
          '<measure number="2">' +
          wedgeDir("diminuendo") +
          wedgeNote("D", 4, 4, "whole") +
          wedgeDir("stop") +
          wedgeDir("stop") +
          "</measure>"
      )
    );
    const wbo1 = wedgeBothModel ? wedgeBothModel.parts[0].measures[0].notes : [];
    const wbo2 = wedgeBothModel ? wedgeBothModel.parts[0].measures[1].notes : [];

    // Textual dynamic instruction fixtures (Stage 60). The real Palestrina carries
    // seven <words>cresc.</words> and ZERO wedges, while Satie and Joplin carry
    // wedges and no dynamic words, so no real file exercises both halves — every
    // mixed case below is a fixture built for that purpose.
    function wordsDir(text) {
      return '<direction placement="above"><direction-type><words>' + text + "</words></direction-type></direction>";
    }
    // Parse a one-bar part whose only direction is a <words> mark, and report the
    // starts the following note received: a comma-joined list, or null when the
    // note carries no shaping at all. One helper covers every matcher row below.
    function textStartsOf(text) {
      const m = parse(
        wedgeScore('<measure number="1">' + WEDGE_ATTRS + wordsDir(text) + wedgeNote("C", 4, 4, "whole") + "</measure>")
      );
      const note = m ? m.parts[0].measures[0].notes[0] : null;
      if (!note) return "(no note)";
      return note.shaping === null ? null : note.shaping.starts.join(",");
    }

    // Capture the warnings a parse emits. MusicLog's logWarn writes through
    // console.warn, so swapping console.warn for the length of the call sees every
    // warning the parse raises and nothing else. Restored in a finally so a throw
    // cannot leave the page instrumented; a row below re-checks the restore.
    const consoleWarnBeforeCapture = console.warn;
    function warningsDuringParse(xml) {
      const captured = [];
      const original = console.warn;
      try {
        console.warn = function () {
          captured.push(Array.prototype.slice.call(arguments).join(" "));
        };
        parse(xml);
      } finally {
        console.warn = original;
      }
      return captured;
    }

    // A part whose ONLY shaping is textual, across two bars. Nothing joins the
    // open-wedge stack, so the part must end with no warning of any kind — the
    // clean-Palestrina case in miniature.
    const TEXTUAL_ONLY_BARS =
      '<measure number="1">' + WEDGE_ATTRS + wordsDir("cresc.") + wedgeNote("C", 4, 4, "whole") + "</measure>" +
      '<measure number="2">' + wordsDir("dim.") + wedgeNote("D", 4, 4, "whole") + "</measure>";
    const textualOnlyWarnings = warningsDuringParse(wedgeScore(TEXTUAL_ONLY_BARS));
    const textualOnlyModel = parse(wedgeScore(TEXTUAL_ONLY_BARS));
    const tob1 = textualOnlyModel ? textualOnlyModel.parts[0].measures[0].notes : [];
    const tob2 = textualOnlyModel ? textualOnlyModel.parts[0].measures[1].notes : [];

    // The documented consequence of staying off the stack: a wedge stop following a
    // TEXTUAL start closes nothing, so it stamps no ending and raises the existing
    // "closes nothing that is open" warning rather than producing a wrong reading.
    const TEXT_THEN_STOP_BARS =
      '<measure number="1">' + WEDGE_ATTRS + wordsDir("cresc.") +
        wedgeNote("C", 4, 2, "half") + wedgeDir("stop") + wedgeNote("D", 4, 2, "half") + "</measure>";
    const textThenStopWarnings = warningsDuringParse(wedgeScore(TEXT_THEN_STOP_BARS));
    const textThenStopModel = parse(wedgeScore(TEXT_THEN_STOP_BARS));
    const tts = textThenStopModel ? textThenStopModel.parts[0].measures[0].notes : [];

    // A textual start and a HAIRPIN start in one part, with a single stop. Both
    // starts must land, and the stop must pop the wedge — never the text — so E4
    // ends the diminuendo and the part still closes with no warning.
    const MIXED_BARS =
      '<measure number="1">' + WEDGE_ATTRS + wordsDir("cresc.") + wedgeNote("C", 4, 2, "half") +
        wedgeDir("diminuendo") + wedgeNote("D", 4, 2, "half") + "</measure>" +
      '<measure number="2">' + wedgeNote("E", 4, 2, "half") + wedgeDir("stop") + wedgeNote("F", 4, 2, "half") + "</measure>";
    const mixedWarnings = warningsDuringParse(wedgeScore(MIXED_BARS));
    const mixedModel = parse(wedgeScore(MIXED_BARS));
    const mx1 = mixedModel ? mixedModel.parts[0].measures[0].notes : [];
    const mx2 = mixedModel ? mixedModel.parts[0].measures[1].notes : [];

    // A textual mark sharing its bar with a <dynamics>, so the dynamic field can be
    // proven undisturbed by the new read.
    const textualWithDynamicModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS +
          '<direction placement="below"><direction-type><dynamics><mf/></dynamics></direction-type></direction>' +
          wordsDir("cresc.") + wedgeNote("C", 4, 4, "whole") + "</measure>"
      )
    );
    const twd = textualWithDynamicModel ? textualWithDynamicModel.parts[0].measures[0].notes : [];

    // A plain fixture carrying no words and no wedges: shaping must stay null on
    // every note, so the new read cannot manufacture shaping out of nothing.
    const textualPlainModel = parse(
      wedgeScore(
        '<measure number="1">' + WEDGE_ATTRS + wedgeNote("C", 4, 2, "half") + wedgeNote("D", 4, 2, "half") + "</measure>" +
          '<measure number="2">' + wedgeNote("E", 4, 4, "whole") + "</measure>"
      )
    );

    // The title fallback chain on a file that ALSO carries a cresc. The bar-1
    // direction word must still resolve as the title, and the cresc. must not
    // displace it; a second fixture proves the chain's behaviour is unchanged even
    // when the only words element IS the cresc.
    const titleWithCresc = parse(titleScore("", wordsDir("Direction Word") + wordsDir("cresc.")));
    const titleCrescOnly = parse(titleScore("", wordsDir("cresc.")));

    // True when EVERY note of every part owns a shaping key in its own right.
    // Uses hasOwnProperty rather than a truthiness or undefined test, so a note
    // that legitimately reads null still counts as carrying the key — which is the
    // whole point of the field being present on every note.
    function everyNoteOwnsShaping(candidate) {
      if (!candidate || !Array.isArray(candidate.parts) || candidate.parts.length === 0) return false;
      let seen = 0;
      const ok = candidate.parts.every(function (part) {
        return part.measures.every(function (measure) {
          return measure.notes.every(function (note) {
            seen += 1;
            return Object.prototype.hasOwnProperty.call(note, "shaping") && note.shaping !== undefined;
          });
        });
      });
      return ok && seen > 0;
    }

    // Every wedge fixture parsed above, so the shape invariants below can be
    // asserted across all of them at once rather than fixture by fixture.
    const wedgeModels = [
      wedgeModel,
      wedgeChordModel,
      wedgeCrossModel,
      wedgeOrphanModel,
      wedgeStavesModel,
      wedgeTwoStartsModel,
      wedgeOneEachModel,
      wedgeBothModel,
    ];

    // True when every non-null shaping across these models carries BOTH arrays,
    // each a real array rather than null or undefined. Counts what it saw, so a
    // model list that shaped nothing cannot pass vacuously.
    function shapingArraysAlwaysPresent(candidates) {
      let seen = 0;
      for (const candidate of candidates) {
        if (!candidate) return false;
        for (const part of candidate.parts) {
          for (const measure of part.measures) {
            for (const note of measure.notes) {
              if (note.shaping === null) continue;
              seen += 1;
              if (!Array.isArray(note.shaping.starts) || !Array.isArray(note.shaping.stops)) return false;
            }
          }
        }
      }
      return seen > 0;
    }

    // True when NO note anywhere in these models carries a shaping object whose
    // both arrays are empty: a note with no endpoint must read null, so an empty
    // pair would be a second way of saying "nothing" and a trap for Stage 59.
    function noEmptyShapingPair(candidates) {
      for (const candidate of candidates) {
        if (!candidate) return false;
        for (const part of candidate.parts) {
          for (const measure of part.measures) {
            for (const note of measure.notes) {
              if (note.shaping === null) continue;
              if (note.shaping.starts.length === 0 && note.shaping.stops.length === 0) return false;
            }
          }
        }
      }
      return true;
    }

    // True when every note of every part reads shaping exactly null, for the
    // wedge-free fixtures. Rests on everyNoteOwnsShaping for key presence.
    function everyNoteShapingNull(candidate) {
      if (!everyNoteOwnsShaping(candidate)) return false;
      return candidate.parts.every(function (part) {
        return part.measures.every(function (measure) {
          return measure.notes.every(function (note) {
            return note.shaping === null;
          });
        });
      });
    }

    // True when every measure of every part reads rehearsal exactly null, for the
    // mark-free fixtures. Rests on everyMeasureOwnsRehearsal for key presence.
    function everyMeasureRehearsalNull(candidate) {
      if (!everyMeasureOwnsRehearsal(candidate)) return false;
      return candidate.parts.every(function (part) {
        return part.measures.every(function (measure) {
          return measure.rehearsal === null;
        });
      });
    }

    // Chord-symbol fixtures (Stage 61). HARMONY is identical in substance to
    // sample/sample-harmony.musicxml — four bars of plain quarter notes, one
    // chord symbol per bar except bar 2, which carries two with notes between
    // them, and bar 3, which puts a <direction> between its harmony and the next
    // note so a harmony and a dynamic are pending at once. Every <kind> keeps its
    // text attribute, empty on the two majors exactly as the Joplin writes it, so
    // the element-text reading is proved against both an empty and a non-empty
    // attribute.
    const HARMONY = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Accessible Music PoC harmony sample</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <harmony print-frame="no">
        <root><root-step>C</root-step></root>
        <kind text="">major</kind>
      </harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <harmony print-frame="no">
        <root><root-step>F</root-step><root-alter>1</root-alter></root>
        <kind text="7">dominant</kind>
      </harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <harmony print-frame="no">
        <root><root-step>A</root-step></root>
        <kind text="mi">minor</kind>
      </harmony>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <harmony print-frame="no">
        <root><root-step>B</root-step><root-alter>-1</root-alter></root>
        <kind text="">major</kind>
        <bass><bass-step>D</bass-step></bass>
      </harmony>
      <direction placement="below">
        <direction-type><dynamics><mf/></dynamics></direction-type>
      </direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <harmony print-frame="no">
        <root><root-step>D</root-step></root>
        <kind text="mi7b5">half-diminished</kind>
        <bass><bass-step>A</bass-step><bass-alter>-1</bass-alter></bass>
      </harmony>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const harmonyModel = parse(HARMONY);
    const harmonyWarnings = warningsDuringParse(HARMONY);
    const hb1 = harmonyModel ? harmonyModel.parts[0].measures[0].notes : [];
    const hb2 = harmonyModel ? harmonyModel.parts[0].measures[1].notes : [];
    const hb3 = harmonyModel ? harmonyModel.parts[0].measures[2].notes : [];
    const hb4 = harmonyModel ? harmonyModel.parts[0].measures[3].notes : [];

    // True when a note's harmony matches all five raw fields exactly. Compares
    // every field on every call — including the ones expected null — so a field
    // silently reading undefined can never pass by being left unasserted.
    function harmonyIs(note, rootStep, rootAlter, kind, bassStep, bassAlter) {
      if (!note || !note.harmony) return false;
      const h = note.harmony;
      return (
        h.rootStep === rootStep && h.rootAlter === rootAlter && h.kind === kind &&
        h.bassStep === bassStep && h.bassAlter === bassAlter
      );
    }

    // A <harmony> element as a one-liner, in the Joplin's own child order, so the
    // adjacency and malformed fixtures below stay readable. A null optional is
    // omitted from the markup entirely rather than written empty.
    function harmonyChord(rootStep, rootAlter, kind, kindText, bassStep, bassAlter) {
      return (
        '<harmony print-frame="no"><root><root-step>' + rootStep + "</root-step>" +
        (rootAlter === null ? "" : "<root-alter>" + rootAlter + "</root-alter>") +
        "</root>" +
        '<kind text="' + kindText + '">' + kind + "</kind>" +
        (bassStep === null
          ? ""
          : "<bass><bass-step>" + bassStep + "</bass-step>" +
            (bassAlter === null ? "" : "<bass-alter>" + bassAlter + "</bass-alter>") +
            "</bass>") +
        "</harmony>"
      );
    }

    // TWO harmonies with NO note between them — the case measured unreachable
    // across all 72 adjacent pairs in the Joplin. The first must win, the second
    // must be discarded, and exactly one warning must name the bar.
    const HARMONY_TWO_IN_A_ROW =
      '<measure number="1">' + WEDGE_ATTRS +
      harmonyChord("C", null, "major", "", null, null) +
      harmonyChord("G", null, "dominant", "7", null, null) +
      wedgeNote("C", 4, 4, "whole") + "</measure>";
    const harmonyTwoInARowModel = parse(wedgeScore(HARMONY_TWO_IN_A_ROW));
    const harmonyTwoInARowWarnings = warningsDuringParse(wedgeScore(HARMONY_TWO_IN_A_ROW));
    const htr = harmonyTwoInARowModel ? harmonyTwoInARowModel.parts[0].measures[0].notes : [];

    // Malformed harmonies: no root and no kind at all, a root with no kind, and a
    // kind with no root. Each must yield null on the following note, must not
    // throw, and must not warn — a warning belongs to the adjacency case only.
    const HARMONY_MALFORMED =
      '<measure number="1">' + WEDGE_ATTRS +
      '<harmony print-frame="no"></harmony>' + wedgeNote("C", 4, 4, "whole") + "</measure>" +
      '<measure number="2">' +
      '<harmony print-frame="no"><root><root-step>C</root-step></root></harmony>' +
      wedgeNote("D", 4, 4, "whole") + "</measure>" +
      '<measure number="3">' +
      '<harmony print-frame="no"><kind text="">major</kind></harmony>' +
      wedgeNote("E", 4, 4, "whole") + "</measure>";
    const harmonyMalformedModel = parse(wedgeScore(HARMONY_MALFORMED));
    const harmonyMalformedWarnings = warningsDuringParse(wedgeScore(HARMONY_MALFORMED));

    // True when EVERY note of every part owns a harmony key in its own right.
    // Uses hasOwnProperty rather than a truthiness or undefined test, so a note
    // that legitimately reads null still counts as carrying the key — which is the
    // whole point of the field being present on every note. Mirrors
    // everyNoteOwnsShaping exactly.
    function everyNoteOwnsHarmony(candidate) {
      if (!candidate || !Array.isArray(candidate.parts) || candidate.parts.length === 0) return false;
      let seen = 0;
      const ok = candidate.parts.every(function (part) {
        return part.measures.every(function (measure) {
          return measure.notes.every(function (note) {
            seen += 1;
            return Object.prototype.hasOwnProperty.call(note, "harmony") && note.harmony !== undefined;
          });
        });
      });
      return ok && seen > 0;
    }

    // True when every note across these models reads harmony exactly null, for the
    // harmony-free fixtures. Rests on everyNoteOwnsHarmony for key presence, so a
    // model whose notes lack the key entirely cannot pass this by reading
    // undefined. Counts nothing extra: everyNoteOwnsHarmony already refuses an
    // empty model.
    function everyNoteHarmonyNull(candidates) {
      for (const candidate of candidates) {
        if (!everyNoteOwnsHarmony(candidate)) return false;
        const clean = candidate.parts.every(function (part) {
          return part.measures.every(function (measure) {
            return measure.notes.every(function (note) {
              return note.harmony === null;
            });
          });
        });
        if (!clean) return false;
      }
      return candidates.length > 0;
    }

    // True when every non-null harmony carries EXACTLY the five agreed keys and no
    // others, across the models given. Counts what it saw, so a list that carried
    // no harmony at all cannot pass vacuously.
    function harmonyShapeAlwaysFiveKeys(candidates) {
      const EXPECTED = "bassAlter,bassStep,kind,rootAlter,rootStep";
      let seen = 0;
      for (const candidate of candidates) {
        if (!candidate) return false;
        for (const part of candidate.parts) {
          for (const measure of part.measures) {
            for (const note of measure.notes) {
              if (note.harmony === null) continue;
              seen += 1;
              if (Object.keys(note.harmony).sort().join(",") !== EXPECTED) return false;
            }
          }
        }
      }
      return seen > 0;
    }

    // Every fixture parsed in this self-test that carries NO <harmony> at all, so
    // the null-throughout sweep runs across the whole existing corpus of fixtures
    // rather than one convenient file.
    const harmonyFreeModels = [
      model, richModel, accModel, chordsModel, structModel, pianoModel,
      restOnsetModel, backupOnsetModel, rehearsalModel, wedgeModel, wedgeChordModel,
      wedgeCrossModel, wedgeStavesModel, textualOnlyModel, mixedModel,
      textualWithDynamicModel, textualPlainModel,
    ];

    const results = {
      hasParse: typeof parse === "function",
      hasSelfTest: typeof selfTest === "function",
      parseReturnsModel: !!model && typeof model === "object",
      onePart: !!model && model.parts.length === 1,
      partIdAndName: !!model && model.parts[0].id === "P1" && model.parts[0].name === "Melody",
      twoMeasures: !!model && model.parts[0].measures.length === 2,
      eightNotes: allNotes.length === 8,
      sevenPitchedOneRest: pitchedCount === 7 && restNotes.length === 1,
      keyFifthsZero: !!model && !!model.key && model.key.fifths === 0,
      timeIs4_4: !!model && !!model.time && model.time.beats === 4 && model.time.beatType === 4,
      divisionsTwo: !!model && model.divisions === 2,
      workTitlePresent: !!model && model.workTitle === "Accessible Music PoC sample",
      firstNoteCorrect:
        !!firstNote &&
        firstNote.rest === false &&
        firstNote.step === "C" &&
        firstNote.octave === 4 &&
        firstNote.duration === 2 &&
        firstNote.type === "quarter",
      restShapeCorrect:
        !!theRest &&
        theRest.rest === true &&
        theRest.step === null &&
        theRest.octave === null &&
        theRest.duration === 2,
      rejectsGarbage: parse("not xml at all") === null,
      rejectsNonPartwise: parse("<foo><bar/></foo>") === null,
      simpleTempoNull: model.tempo === null,
      simpleNewFieldsNullOnPlainNote:
        !!firstNote && firstNote.tie === null && firstNote.slur === null &&
        firstNote.lyric === null && firstNote.dynamic === null,
      richParses: !!richModel && typeof richModel === "object",
      richTempo120: !!richModel && richModel.tempo === 120,
      richFiveNotes: rm1.length === 4 && rm2.length === 1,
      richC4DynamicForte: !!rC4 && rC4.dynamic === "f",
      richC4LyricLa: !!rC4 && rC4.lyric === "la",
      richC4SlurStart: !!rC4 && !!rC4.slur && rC4.slur.start === true && rC4.slur.stop === false,
      richD4SlurStop: !!rD4 && !!rD4.slur && rD4.slur.stop === true && rD4.slur.start === false,
      richE4TieStart: !!rE4a && !!rE4a.tie && rE4a.tie.start === true && rE4a.tie.stop === false,
      richE4TieStop: !!rE4b && !!rE4b.tie && rE4b.tie.stop === true && rE4b.tie.start === false,
      richG4AllNewFieldsNull:
        !!rG4 && rG4.tie === null && rG4.slur === null && rG4.lyric === null && rG4.dynamic === null,
      accidentalsParses: !!accModel && typeof accModel === "object",
      accSixNotes: am1.length === 4 && am2.length === 2,
      accPlainCAlterNull: !!aC && aC.step === "C" && aC.octave === 4 && aC.alter === null,
      accCSharpAlter1: !!aCsharp && aCsharp.step === "C" && aCsharp.octave === 4 && aCsharp.alter === 1,
      accCNaturalAlter0: !!aCnat && aCnat.step === "C" && aCnat.octave === 4 && aCnat.alter === 0,
      accBFlatAlterMinus1: !!aBflat && aBflat.step === "B" && aBflat.octave === 3 && aBflat.alter === -1,
      accPlainGAlterNull: !!aG && aG.step === "G" && aG.octave === 4 && aG.alter === null,
      accPlainDAlterNull: !!aD && aD.step === "D" && aD.octave === 4 && aD.alter === null,
      simplePlainNoteAlterNull: !!firstNote && firstNote.alter === null,
      simpleRestAlterNull: !!theRest && theRest.alter === null,
      chordsParses: !!chordsModel && typeof chordsModel === "object",
      chordsBar1SevenNotes: cm1.length === 7,
      chordsBar2FourNotes: cm2.length === 4,
      chordsBar1HeadCChordFalse: !!cm1[0] && cm1[0].step === "C" && cm1[0].chord === false,
      chordsBar1TriadE4ChordTrue: !!cm1[1] && cm1[1].step === "E" && cm1[1].chord === true,
      chordsBar1TriadG4ChordTrue: !!cm1[2] && cm1[2].step === "G" && cm1[2].chord === true,
      chordsBar1SingleD4ChordFalse: !!cm1[3] && cm1[3].step === "D" && cm1[3].chord === false,
      chordsBar1DyadHeadE4ChordFalse: !!cm1[4] && cm1[4].step === "E" && cm1[4].chord === false,
      chordsBar1DyadG4ChordTrue: !!cm1[5] && cm1[5].step === "G" && cm1[5].chord === true,
      chordsBar1RestChordFalse: !!cm1[6] && cm1[6].rest === true && cm1[6].chord === false,
      chordsBar2SingleF4ChordFalse: !!cm2[0] && cm2[0].step === "F" && cm2[0].chord === false,
      chordsBar2TriadHeadC4ChordFalse: !!cm2[1] && cm2[1].step === "C" && cm2[1].chord === false,
      chordsBar2TriadE4ChordTrue: !!cm2[2] && cm2[2].step === "E" && cm2[2].chord === true,
      chordsBar2TriadG4ChordTrue: !!cm2[3] && cm2[3].step === "G" && cm2[3].chord === true,
      simplePlainNoteChordFalse: !!firstNote && firstNote.chord === false,
      simpleRestChordFalse: !!theRest && theRest.chord === false,
      structParses: !!structModel && typeof structModel === "object",
      structHasRepeatTrue: !!structModel && structModel.hasRepeat === true,
      structBar1NoChanges: !!sm1 && sm1.clefChange === null && sm1.keyChange === null && sm1.repeatTo === null && sm1.endingStart === null && sm1.endingStop === null,
      structBar2KeyChange: !!sm2 && !!sm2.keyChange && sm2.keyChange.fifths === 1 && sm2.clefChange === null,
      structBar3ClefChange: !!sm3 && !!sm3.clefChange && sm3.clefChange.sign === "F" && sm3.clefChange.line === 4 && sm3.keyChange === null,
      structBar4FirstEnding: !!sm4 && sm4.endingStart === "1" && sm4.endingStop === "1",
      structBar4RepeatToBar1: !!sm4 && sm4.repeatTo === "1",
      structBar5SecondEnding: !!sm5 && sm5.endingStart === "2" && sm5.endingStop === "2" && sm5.repeatTo === null,
      simpleHasRepeatFalse: !!model && model.hasRepeat === false,
      simpleMeasureNewFieldsNull: !!model && model.parts[0].measures[0].clefChange === null && model.parts[0].measures[0].keyChange === null && model.parts[0].measures[0].repeatTo === null && model.parts[0].measures[0].endingStart === null && model.parts[0].measures[0].endingStop === null,
      structHasKeyChangeTrue: !!structModel && structModel.hasKeyChange === true,
      structHasClefChangeTrue: !!structModel && structModel.hasClefChange === true,
      simpleHasKeyChangeFalse: !!model && model.hasKeyChange === false,
      simpleHasClefChangeFalse: !!model && model.hasClefChange === false,
      pianoParses: !!pianoModel && typeof pianoModel === "object",
      pianoStavesTwo: !!pianoModel && pianoModel.staves === 2,
      pianoClef1Treble: !!pmClefs["1"] && pmClefs["1"].sign === "G" && pmClefs["1"].line === 2,
      pianoClef2Bass: !!pmClefs["2"] && pmClefs["2"].sign === "F" && pmClefs["2"].line === 4,
      pianoBar1Staff1Notes: pm1.length === 8 && pm1[0].staff === "1" && pm1[3].staff === "1",
      pianoBar1Staff2Notes: pm1.length === 8 && pm1[4].staff === "2" && pm1[7].staff === "2",
      simpleStavesOne: !!model && model.staves === 1,
      simpleClefKeyedOne: !!model && !!model.clefs && !!model.clefs["1"] && model.clefs["1"].sign === "G" && model.clefs["1"].line === 2,
      simpleNotesStaffNull: !!model && model.parts[0].measures[0].notes[0].staff === null,
      // Per-note onset in divisions from the bar start (Stage 5.1).
      // PIANO bar 1: the two staves overlap because the backup rewinds to the bar
      // start, so the first note of each staff shares onset 0, and staff 1 has
      // advanced past 0 by its last note. pm1 onsets are [0,1,2,3,0,1,2,3].
      pianoBar1Staff1FirstOnsetZero: pm1.length === 8 && pm1[0].onset === 0,
      pianoBar1Staff2FirstOnsetZero: pm1.length === 8 && pm1[4].onset === 0,
      pianoBar1Staff1LastOnsetAdvanced: pm1.length === 8 && pm1[3].onset > 0,
      pianoBar1Staff1AndStaff2ShareOnsets:
        pm1.length === 8 &&
        pm1[0].onset === pm1[4].onset &&
        pm1[1].onset === pm1[5].onset &&
        pm1[2].onset === pm1[6].onset &&
        pm1[3].onset === pm1[7].onset,
      // CHORDS bar 1: the C-E-G triad members share one onset (0), and the next
      // non-chord note has a strictly greater onset (1) — the chord advanced the
      // cursor exactly once.
      chordsBar1TriadSharesOnset:
        chordTriadOnsets.length === 3 &&
        chordTriadOnsets[0] === chordTriadOnsets[1] &&
        chordTriadOnsets[1] === chordTriadOnsets[2],
      chordsBar1NextOnsetGreater:
        chordNextOnset !== null && chordTriadOnsets.length === 3 && chordNextOnset > chordTriadOnsets[0],
      // A rest advances the cursor: the note after a quarter rest (duration 2)
      // sits at the rest's onset (0) plus the rest's duration (2), i.e. onset 2.
      restAdvancesCursor:
        !!roRest && !!roNote && roRest.onset === 0 && roNote.onset === roRest.onset + roRest.duration && roNote.onset === 2,
      // A backup rewinds the cursor: after two quarter notes a full-bar backup (4)
      // returns to 0, so the third note shares the first note's onset (0).
      backupRewindsToSharedOnset:
        !!boFirst && !!boThird && boFirst.onset === 0 && boThird.onset === boFirst.onset && boThird.onset === 0,
      // Printed-metronome reader and normalisation (Stage 3.1).
      tempoQuarter76Value: !!tempoQuarter76 && tempoQuarter76.tempo === 76,
      tempoQuarter76Mark:
        !!tempoQuarter76 && !!tempoQuarter76.tempoMark &&
        tempoQuarter76.tempoMark.perMinute === 76 &&
        tempoQuarter76.tempoMark.beatUnit === "quarter" &&
        tempoQuarter76.tempoMark.beatUnitDots === 0,
      tempoHalf100Value: !!tempoHalf100 && tempoHalf100.tempo === 200,
      tempoHalf100BeatUnitHalf: !!tempoHalf100 && !!tempoHalf100.tempoMark && tempoHalf100.tempoMark.beatUnit === "half",
      tempoDottedQuarter80Value: !!tempoDottedQuarter80 && tempoDottedQuarter80.tempo === 120,
      tempoDottedQuarter80Dots: !!tempoDottedQuarter80 && !!tempoDottedQuarter80.tempoMark && tempoDottedQuarter80.tempoMark.beatUnitDots === 1,
      tempoSoundOnly90Value: !!tempoSoundOnly90 && tempoSoundOnly90.tempo === 90 && tempoSoundOnly90.tempoMark === null,
      tempoNeitherNull: !!tempoNeither && tempoNeither.tempo === null && tempoNeither.tempoMark === null,
      tempoNoDigitsFallsBack: !!tempoNoDigits && tempoNoDigits.tempo === 72 && tempoNoDigits.tempoMark === null,
      simpleTempoMarkNull: !!model && model.tempoMark === null,
      richTempoMarkQuarter120:
        !!richModel && !!richModel.tempoMark &&
        richModel.tempoMark.perMinute === 120 &&
        richModel.tempoMark.beatUnit === "quarter" &&
        richModel.tempoMark.beatUnitDots === 0,
      // Title fallback chain (Stage 3.2).
      titleWorkTitleWins: !!titleWorkWins && titleWorkWins.workTitle === "Work Wins",
      titleMovementOnly: !!titleMovementOnly && titleMovementOnly.workTitle === "Only Movement",
      titleCreditWordsOnly: !!titleCreditOnly && titleCreditOnly.workTitle === "Only Credit",
      titleCreditTypeTitlePreferred: !!titleCreditTyped && titleCreditTyped.workTitle === "Typed Title",
      titleDirectionWordsLastResort: !!titleDirection && titleDirection.workTitle === "Direction Word",
      titleNoneNull: !!titleNone && titleNone.workTitle === null,
      // Largest-font heading selection (Stage 3.4).
      titlePalestrinaLargestWins: !!titlePalestrina && titlePalestrina.workTitle === "Sicut cervus",
      titleJoplinLargestCredit: !!titleJoplin && titleJoplin.workTitle === "The Entertainer",
      titleSatieAccentedCredit: !!titleSatie && titleSatie.workTitle === "Gymnopédie No.1",
      titleMarkerFilteredByLetters: !!titleMarkerFiltered && titleMarkerFiltered.workTitle === "Real Title",
      titleTypedBeatsLargerUntyped: !!titleTypedBeatsLarger && titleTypedBeatsLarger.workTitle === "Typed Small Title",
      // Per-part clefs (Stage 49). Every part now carries its own clefs object,
      // read from that part's first <attributes>; model.clefs is untouched.
      partHasClefsObject: !!model && !!model.parts[0].clefs && typeof model.parts[0].clefs === "object",
      singlePartClefsMatchModel: singlePartClefsMatch,
      bracedPartOneTreble:
        !!bracedParts[0] && !!bracedParts[0].clefs["1"] &&
        bracedParts[0].clefs["1"].sign === "G" && bracedParts[0].clefs["1"].line === 2,
      bracedPartTwoBass:
        !!bracedParts[1] && !!bracedParts[1].clefs["1"] &&
        bracedParts[1].clefs["1"].sign === "F" && bracedParts[1].clefs["1"].line === 4,
      modelClefsUnchangedByParts:
        !!bracedModel && !!bracedModel.clefs && Object.keys(bracedModel.clefs).length === 1 &&
        !!bracedModel.clefs["1"] && bracedModel.clefs["1"].sign === "G" && bracedModel.clefs["1"].line === 2,
      partFieldsStillIdNameMeasures:
        !!model && model.parts[0].id === "P1" && model.parts[0].name === "Melody" &&
        Array.isArray(model.parts[0].measures) && model.parts[0].measures.length === 2,
      // Part-list groups (Stage 49). model.partGroups records each brace or
      // bracket as declared; no detection is done here.
      hasPartGroupsArray: !!model && Array.isArray(model.partGroups) && !!bracedModel && Array.isArray(bracedModel.partGroups),
      noPartListYieldsNoGroups:
        !!noPartListModel && Array.isArray(noPartListModel.partGroups) && noPartListModel.partGroups.length === 0,
      noGroupsYieldsEmptyArray: !!model && model.partGroups.length === 0,
      braceGroupDetected:
        !!bracedModel && bracedModel.partGroups.length === 1 &&
        !!bracedGroup && bracedGroup.symbol === "brace" && bracedGroup.number === "1",
      braceGroupMembers: !!bracedGroup && bracedGroup.partIds.join(",") === "P1,P2",
      groupNameCaptured: !!nestedOuter && nestedOuter.name === "Choir",
      groupNameNullWhenAbsent: !!bracedGroup && bracedGroup.name === null && !!nestedInner && nestedInner.name === null,
      nestedGroupsKeepOwnMembers:
        nestedGroups.length === 2 && !!nestedOuter && !!nestedInner &&
        nestedOuter.partIds.join(",") === "P1,P2,P3" && nestedInner.partIds.join(",") === "P2,P3",
      unclosedGroupStillReturned:
        !!unclosedModel && unclosedModel.partGroups.length === 1 &&
        unclosedModel.partGroups[0].symbol === "brace" &&
        unclosedModel.partGroups[0].partIds.join(",") === "P1",
      malformedPartListNeverThrows:
        malformedThrew === false && !!malformedModel &&
        Array.isArray(malformedModel.partGroups) && malformedModel.partGroups.length === 0,
      // Rehearsal mark carried onto the model measure (Stage 55). A pure carry:
      // the text arrives verbatim from the structure layer, and nothing reads it
      // until Stage 56 announces it on the bar heading.
      rehearsalParses: !!rehearsalModel && typeof rehearsalModel === "object",
      rehearsalFourMeasures: hm.length === 4,
      rehearsalBar1MarkA: !!hm1 && hm1.rehearsal === "A",
      rehearsalBar2DottedCompositeVerbatim: !!hm2 && hm2.rehearsal === "B.1",
      rehearsalBar4MarkC: !!hm4 && hm4.rehearsal === "C",
      rehearsalBar3NoMarkIsNull: !!hm3 && hm3.rehearsal === null,
      rehearsalBar3KeyPresentNotUndefined:
        !!hm3 && Object.prototype.hasOwnProperty.call(hm3, "rehearsal") && hm3.rehearsal !== undefined,
      // The existing structural fields on the SAME bars as a mark are untouched.
      rehearsalBar1RepeatUnaffected:
        !!hm1 && !!rehearsalModel && rehearsalModel.hasRepeat === true &&
        hm1.repeatTo === null && hm1.clefChange === null && hm1.keyChange === null &&
        hm1.endingStart === null && hm1.endingStop === null,
      rehearsalBar2KeyChangeUnaffected:
        !!hm2 && !!hm2.keyChange && hm2.keyChange.fifths === 1 &&
        hm2.clefChange === null && hm2.repeatTo === null && hm2.endingStart === null,
      rehearsalBar3ClefChangeUnaffected:
        !!hm3 && !!hm3.clefChange && hm3.clefChange.sign === "F" && hm3.clefChange.line === 4 &&
        hm3.keyChange === null && hm3.repeatTo === null,
      rehearsalBar4EndingAndRepeatToUnaffected:
        !!hm4 && hm4.endingStart === "1" && hm4.endingStop === "1" && hm4.repeatTo === "1",
      // The key is present on EVERY bar, marked or not, in every fixture.
      rehearsalKeyOnEveryMeasure: everyMeasureOwnsRehearsal(rehearsalModel),
      simpleEveryMeasureRehearsalNull: everyMeasureRehearsalNull(model),
      structEveryMeasureRehearsalNull: everyMeasureRehearsalNull(structModel),
      pianoEveryMeasureRehearsalNull: everyMeasureRehearsalNull(pianoModel),
      // Dynamic shaping carried onto every note (Stage 57). note.shaping holds two
      // INDEPENDENT endpoint LISTS, { starts, stops }, each in document order and
      // either possibly empty, and the whole field null when the note carries no
      // endpoint. Nothing reads it until Stage 59 voices it.
      wedgeParses: !!wedgeModel && typeof wedgeModel === "object",
      wedgeCrescendoStartOnNextNote:
        !!wm1[0] && wm1[0].step === "C" && !!wm1[0].shaping &&
        wm1[0].shaping.starts.join(",") === "crescendo" && wm1[0].shaping.stops.length === 0,
      wedgeDiminuendoStartOnNextNote:
        !!wm2[0] && wm2[0].step === "G" && !!wm2[0].shaping &&
        wm2[0].shaping.starts.join(",") === "diminuendo" && wm2[0].shaping.stops.length === 0,
      wedgeStopOnPreviousNote:
        !!wm1[1] && wm1[1].step === "D" && !!wm1[1].shaping &&
        wm1[1].shaping.stops.join(",") === "crescendo" && wm1[1].shaping.starts.length === 0,
      wedgeStopNotOnFollowingNote: !!wm1[2] && wm1[2].step === "E" && wm1[2].shaping === null,
      wedgeStopTakesTypeOfOpenWedge:
        !!wm2[1] && wm2[1].step === "A" && !!wm2[1].shaping && wm2[1].shaping.stops.join(",") === "diminuendo",
      // Bar 2's diminuendo direction carries <staff>1</staff> and its stop carries
      // NO <staff> child; they pair only because an absent staff keys as "1".
      wedgeNoStaffChildKeysAsOne:
        !!wm2[1] && !!wm2[1].shaping && wm2[1].shaping.stops.join(",") === "diminuendo" &&
        wm2[1].shaping.starts.length === 0,
      wedgeDynamicUnaffectedOnWedgeBar:
        !!wm1[0] && wm1[0].dynamic === "f" && !!wm1[0].shaping &&
        wm1[0].shaping.starts.join(",") === "crescendo" &&
        !!wm1[1] && wm1[1].dynamic === null,
      wedgePlainNoteShapingNull: !!wm1[3] && wm1[3].step === "F" && wm1[3].shaping === null,
      wedgeChordStartOnFirstNote:
        !!wcm[0] && wcm[0].step === "A" && !!wcm[0].shaping && wcm[0].shaping.starts.join(",") === "crescendo",
      wedgeChordStopOnChordHead:
        !!wcm[1] && wcm[1].step === "C" && wcm[1].chord === false &&
        !!wcm[1].shaping && wcm[1].shaping.stops.join(",") === "crescendo",
      wedgeChordMembersShapingNull:
        !!wcm[2] && wcm[2].chord === true && wcm[2].shaping === null &&
        !!wcm[3] && wcm[3].chord === true && wcm[3].shaping === null,
      wedgeStopOpeningBarAttachesToPreviousBarLastNote:
        !!xb1[1] && xb1[1].step === "D" && !!xb1[1].shaping && xb1[1].shaping.stops.join(",") === "crescendo",
      wedgeCrossBarStartUnaffected:
        !!xb1[0] && xb1[0].step === "C" && !!xb1[0].shaping &&
        xb1[0].shaping.starts.join(",") === "crescendo" && xb1[0].shaping.stops.length === 0,
      wedgeStopOpeningBarNotOnOwnBarFirstNote: !!xb2[0] && xb2[0].step === "E" && xb2[0].shaping === null,
      wedgeOrphanStopStampsNothing:
        wom.length === 2 && wom[0].shaping === null && wom[1].shaping === null,
      wedgeStartStaff1StopStaff2DoNotPair:
        wsm.length === 2 && !!wsm[0].shaping && wsm[0].shaping.starts.join(",") === "crescendo" &&
        wsm[0].shaping.stops.length === 0 && wsm[1].staff === "2" && wsm[1].shaping === null,
      wedgeBothStopAndStartOnOneNote:
        !!wbo2[0] && !!wbo2[0].shaping &&
        wbo2[0].shaping.starts.length > 0 && wbo2[0].shaping.stops.length > 0 &&
        wbo2[0].shaping.starts.join(",") === "diminuendo",
      wedgeOverlapOuterStartUnaffected:
        !!wbo1[0] && !!wbo1[0].shaping &&
        wbo1[0].shaping.starts.join(",") === "crescendo" && wbo1[0].shaping.stops.length === 0,
      // The key is present on EVERY note, shaped or not, in every fixture.
      wedgeShapingKeyOnEveryNote: everyNoteOwnsShaping(wedgeModel),
      simplePlainNoteShapingNull: !!firstNote && firstNote.shaping === null,
      simpleEveryNoteShapingNull: everyNoteShapingNull(model),
      richEveryNoteShapingNull: everyNoteShapingNull(richModel),
      chordsEveryNoteShapingNull: everyNoteShapingNull(chordsModel),
      structEveryNoteShapingNull: everyNoteShapingNull(structModel),
      pianoEveryNoteShapingNull: everyNoteShapingNull(pianoModel),
      // Endpoint LISTS (Stage 57 amendment). Nothing overwrites anything: a note
      // holds every endpoint the file writes at it, in document order.
      wedgeTwoStopsBothCarriedInOrder:
        !!wbo2[0] && !!wbo2[0].shaping && wbo2[0].shaping.stops.length === 2 &&
        wbo2[0].shaping.stops.join(",") === "diminuendo,crescendo",
      // The order is the LIFO pop order: the diminuendo opened SECOND and closes
      // first, the crescendo opened first and closes last.
      wedgeStopsOrderIsLifoPopOrder:
        !!wbo2[0] && !!wbo2[0].shaping &&
        wbo2[0].shaping.stops[0] === "diminuendo" && wbo2[0].shaping.stops[1] === "crescendo",
      wedgeTwoStartsBothCarried:
        !!wtsm[0] && wtsm[0].step === "C" && !!wtsm[0].shaping &&
        wtsm[0].shaping.starts.length === 2 &&
        wtsm[0].shaping.starts.join(",") === "crescendo,diminuendo" &&
        wtsm[0].shaping.stops.length === 0,
      wedgeOneStartOneStopEachArrayHoldsOne:
        !!woem[0] && woem[0].step === "C" && !!woem[0].shaping &&
        woem[0].shaping.starts.length === 1 && woem[0].shaping.starts[0] === "crescendo" &&
        woem[0].shaping.stops.length === 1 && woem[0].shaping.stops[0] === "crescendo" &&
        !!woem[1] && woem[1].shaping === null,
      wedgeArraysAlwaysPresentWhenShapingNonNull: shapingArraysAlwaysPresent(wedgeModels),
      wedgeNoEmptyArrayPairAnywhere: noEmptyShapingPair(wedgeModels),
      // Textual dynamic instruction (Stage 60). A recognised <words> mark pushes
      // onto the SAME pending-starts list a wedge start uses, so it reaches the
      // next note by the same route and reads through the Stage 59 clause with no
      // renderer change. The matcher rows below all run through textStartsOf.
      textualCrescAbbrevStartsOnNextNote: textStartsOf("cresc.") === "crescendo",
      textualCrescendoFullWord: textStartsOf("crescendo") === "crescendo",
      textualCrescNoFullStop: textStartsOf("cresc") === "crescendo",
      textualDimAbbrev: textStartsOf("dim.") === "diminuendo",
      textualDiminAbbrev: textStartsOf("dimin.") === "diminuendo",
      textualDiminuendoFullWord: textStartsOf("diminuendo") === "diminuendo",
      textualDecrescAbbrev: textStartsOf("decresc.") === "diminuendo",
      textualDecrescendoFullWord: textStartsOf("decrescendo") === "diminuendo",
      // A qualifier written AFTER the token still matches, because only the first
      // token is tested and its trailing full stops are stripped.
      textualTrailingQualifierMatches: textStartsOf("cresc. poco a poco") === "crescendo",
      // Case and whitespace are normalised away, including a text broken across
      // lines — the shape a real <words> element routinely takes.
      textualUpperCaseMatches: textStartsOf("CRESC.") === "crescendo",
      textualSurroundingWhitespaceMatches: textStartsOf(" cresc. ") === "crescendo",
      textualBrokenAcrossLinesMatches: textStartsOf("cresc.\n   poco") === "crescendo",
      textualInternalWhitespaceCollapsed: textStartsOf("  DIM.\n\t poco a poco ") === "diminuendo",
      // The KNOWN LIMIT of first-token matching, asserted rather than left implicit:
      // a LEADING qualifier is not matched. No fixture and no corpus file has one.
      textualLeadingQualifierDoesNotMatch: textStartsOf("poco a poco cresc.") === null,
      // Every non-dynamic words string the real corpus carries must NOT match.
      textualCorpusModeratoNoMatch: textStartsOf("Moderato (      = 70 bpm)") === null,
      textualCorpusRepeat8vaNoMatch: textStartsOf("Repeat 8va") === null,
      textualCorpusLentEtDouloureuxNoMatch: textStartsOf("Lent et douloureux ") === null,
      textualCorpusConPedaleNoMatch: textStartsOf("con pedale") === null,
      textualCorpusPsalm42NoMatch: textStartsOf("Psalm 42") === null,
      textualCorpusSicutCervusNoMatch: textStartsOf("Sicut cervus") === null,
      textualCorpusComposerCreditNoMatch:
        textStartsOf("Giovanni Pierluigi da Palestrina\n(1525-94)") === null,
      // Satie carries six EMPTY <words> elements and Joplin one, so the empty read
      // is a corpus case rather than a defensive one.
      textualEmptyWordsNoMatch: textStartsOf("") === null,
      // A textual instruction NEVER joins the open-wedge stack, so a part whose only
      // shaping is textual ends with no warning at all — the clean-Palestrina case.
      textualOnlyPartEmitsNoWarningAtAll: textualOnlyWarnings.length === 0,
      textualOnlyPartNoStillOpenWarning:
        textualOnlyWarnings.filter(function (w) { return w.indexOf("still open") !== -1; }).length === 0,
      textualOnlyBothBarsStartOnNextNote:
        !!tob1[0] && !!tob1[0].shaping && tob1[0].shaping.starts.join(",") === "crescendo" &&
        tob1[0].shaping.stops.length === 0 &&
        !!tob2[0] && !!tob2[0].shaping && tob2[0].shaping.starts.join(",") === "diminuendo" &&
        tob2[0].shaping.stops.length === 0,
      // The accepted consequence of staying off the stack: a wedge stop after a
      // textual start closes nothing, stamps no ending, and warns as it always did.
      textualStopAfterTextualStartStampsNoEnding:
        tts.length === 2 && !!tts[0].shaping && tts[0].shaping.starts.join(",") === "crescendo" &&
        tts[0].shaping.stops.length === 0 && tts[1].shaping === null,
      textualStopAfterTextualStartWarnsClosesNothing:
        textThenStopWarnings.filter(function (w) { return w.indexOf("closes nothing that is open") !== -1; }).length === 1,
      textualStopAfterTextualStartNoStillOpenWarning:
        textThenStopWarnings.filter(function (w) { return w.indexOf("still open") !== -1; }).length === 0,
      // A textual start and a hairpin start in ONE part: both land, and the stop
      // pops the WEDGE rather than the text, so neither interferes with the other.
      textualAndWedgeStartsBothLandInOnePart:
        !!mx1[0] && !!mx1[0].shaping && mx1[0].shaping.starts.join(",") === "crescendo" &&
        !!mx1[1] && !!mx1[1].shaping && mx1[1].shaping.starts.join(",") === "diminuendo",
      textualWedgeStopPopsTheWedgeNotTheText:
        !!mx2[0] && mx2[0].step === "E" && !!mx2[0].shaping &&
        mx2[0].shaping.stops.join(",") === "diminuendo" && mx2[0].shaping.starts.length === 0,
      textualMixedPartLastNoteUnshaped: !!mx2[1] && mx2[1].step === "F" && mx2[1].shaping === null,
      textualMixedPartEmitsNoWarningAtAll: mixedWarnings.length === 0,
      // dynamicOf is undisturbed: a bar carrying both a <dynamics> and a cresc.
      // yields both fields.
      textualDynamicFieldUnaffected:
        !!twd[0] && twd[0].dynamic === "mf" && !!twd[0].shaping &&
        twd[0].shaping.starts.join(",") === "crescendo",
      // No words and no wedges anywhere: shaping stays null on every note.
      textualNoWordsNoWedgesShapingNullThroughout: everyNoteShapingNull(textualPlainModel),
      textualShapingKeyOnEveryNote:
        everyNoteOwnsShaping(textualOnlyModel) && everyNoteOwnsShaping(mixedModel),
      textualNoEmptyArrayPairAnywhere:
        noEmptyShapingPair([textualOnlyModel, textThenStopModel, mixedModel, textualWithDynamicModel, textualPlainModel]),
      // The title fallback chain behaves identically. The six existing chain rows
      // are re-asserted together here, then a file carrying BOTH a direction-word
      // title and a cresc. must still resolve the title, with the cresc. losing.
      textualTitleChainSixSourcesUnchanged:
        !!titleWorkWins && titleWorkWins.workTitle === "Work Wins" &&
        !!titleMovementOnly && titleMovementOnly.workTitle === "Only Movement" &&
        !!titleCreditOnly && titleCreditOnly.workTitle === "Only Credit" &&
        !!titleCreditTyped && titleCreditTyped.workTitle === "Typed Title" &&
        !!titleDirection && titleDirection.workTitle === "Direction Word" &&
        !!titleNone && titleNone.workTitle === null,
      textualTitleDirectionWordStillResolvesBesideCresc:
        !!titleWithCresc && titleWithCresc.workTitle === "Direction Word",
      textualTitleChainStillReadsCrescWhenItIsTheOnlyWords:
        !!titleCrescOnly && titleCrescOnly.workTitle === "cresc.",
      // The warning-capture instrument put console.warn back as it found it.
      textualWarnCaptureRestoredConsoleWarn: console.warn === consoleWarnBeforeCapture,
      // Chord symbols (Stage 61). A <harmony> is a direct child of <measure> and
      // attaches FORWARD to the next note, exactly as a <direction>'s dynamic
      // does. Every value below is a RAW MusicXML code: nothing is named, mapped
      // or voiced at this stage, so no reader hears any of it.
      harmonyFixtureParses: !!harmonyModel && typeof harmonyModel === "object",
      harmonyFixtureFourBarsSixteenNotes:
        !!harmonyModel && harmonyModel.parts[0].measures.length === 4 &&
        hb1.length === 4 && hb2.length === 4 && hb3.length === 4 && hb4.length === 4,
      // Bar 1 — a plain root and kind: no root-alter, no bass. All five fields
      // asserted, so the three that must read null are checked rather than assumed.
      harmonyBar1PlainMajorOnFirstNote: harmonyIs(hb1[0], "C", null, "major", null, null),
      // The <kind> text attribute here is the EMPTY string, so a parser reading the
      // attribute instead of the element text would yield "" — which this row and
      // the bar-1 row above would both catch.
      harmonyBar1KindReadFromElementTextNotEmptyTextAttribute:
        !!hb1[0] && !!hb1[0].harmony && hb1[0].harmony.kind === "major" && hb1[0].harmony.kind !== "",
      harmonyBar1RemainingNotesNull:
        hb1[1].harmony === null && hb1[2].harmony === null && hb1[3].harmony === null,
      // Bar 2 — root-alter 1, and a kind whose text attribute is present and
      // DIFFERENT from the element text, proving the element-text reading a second
      // way round from bar 1's empty attribute.
      harmonyBar2RootAlterOneOnFirstNote: harmonyIs(hb2[0], "F", 1, "dominant", null, null),
      harmonyBar2KindReadFromElementTextNotNonEmptyTextAttribute:
        !!hb2[0] && !!hb2[0].harmony && hb2[0].harmony.kind === "dominant" && hb2[0].harmony.kind !== "7",
      // Two harmonies in one bar WITH notes between them — the only harmony
      // adjacency the corpus exhibits. Each lands on its own note, and the notes
      // between them carry nothing.
      harmonyBar2SecondHarmonyLandsOnThirdNote: harmonyIs(hb2[2], "A", null, "minor", null, null),
      harmonyBar2NotesBetweenAndAfterCarryNull:
        hb2[1].harmony === null && hb2[3].harmony === null,
      // Bar 3 — root-alter -1 with a bass that has a bass-step and NO bass-alter,
      // so a present bass and an absent bass-alter are proved in one note.
      harmonyBar3RootAlterMinusOneWithBassAndNoBassAlter:
        harmonyIs(hb3[0], "B", -1, "major", "D", null),
      // A <direction> sitting between the harmony and the next note — 38 of these
      // in the Joplin. BOTH pending values must land on that one note.
      harmonyBar3HarmonyAndDynamicBothLandOnSameNote:
        !!hb3[0] && !!hb3[0].harmony && hb3[0].harmony.rootStep === "B" && hb3[0].dynamic === "mf",
      harmonyBar3RemainingNotesCarryNeither:
        hb3[1].harmony === null && hb3[1].dynamic === null &&
        hb3[2].harmony === null && hb3[3].harmony === null,
      // Bar 4 — bass-alter -1, no root-alter beside it, and a kind OUTSIDE the five
      // the Joplin uses, carried through raw for a later stage's unmapped fallback.
      harmonyBar4BassAlterMinusOneAndNoRootAlter:
        harmonyIs(hb4[0], "D", null, "half-diminished", "A", -1),
      harmonyBar4UnmappedKindCarriedThroughRaw:
        !!hb4[0] && !!hb4[0].harmony && hb4[0].harmony.kind === "half-diminished" &&
        ["major", "minor", "dominant", "diminished", "diminished-seventh"].indexOf(hb4[0].harmony.kind) === -1,
      // Alters are NUMBERS, not the raw strings the file holds, and both signs the
      // corpus writes are read. typeof is asserted explicitly because "1" === 1 is
      // false but a string would still satisfy a naive truthiness check.
      harmonyAltersAreNumbersOfBothSigns:
        hb2[0].harmony.rootAlter === 1 && typeof hb2[0].harmony.rootAlter === "number" &&
        hb3[0].harmony.rootAlter === -1 && typeof hb3[0].harmony.rootAlter === "number" &&
        hb4[0].harmony.bassAlter === -1 && typeof hb4[0].harmony.bassAlter === "number",
      // An ABSENT optional reads null, never undefined and never NaN. hasOwnProperty
      // proves the key is there to be read at all, so an absent key cannot pass by
      // reading undefined and comparing unequal to a number.
      harmonyAbsentOptionalsAreNullNotUndefinedOrNaN:
        Object.prototype.hasOwnProperty.call(hb1[0].harmony, "rootAlter") &&
        hb1[0].harmony.rootAlter === null && hb1[0].harmony.bassStep === null &&
        hb1[0].harmony.bassAlter === null &&
        Object.prototype.hasOwnProperty.call(hb3[0].harmony, "bassAlter") &&
        hb3[0].harmony.bassAlter === null &&
        Object.prototype.hasOwnProperty.call(hb4[0].harmony, "rootAlter") &&
        hb4[0].harmony.rootAlter === null,
      harmonyFixtureEmitsNoWarningAtAll: harmonyWarnings.length === 0,
      harmonyKeyPresentOnEveryNoteOfParsedModel: everyNoteOwnsHarmony(harmonyModel),
      harmonyShapeIsAlwaysTheFiveAgreedKeys:
        harmonyShapeAlwaysFiveKeys([harmonyModel, harmonyTwoInARowModel]),
      // Two harmonies with NO note between them. Measured unreachable across all 72
      // adjacent pairs in the Joplin, so these rows guard a file we have not seen.
      harmonyTwoInARowFirstWins: harmonyIs(htr[0], "C", null, "major", null, null),
      harmonyTwoInARowEmitsExactlyOneWarning: harmonyTwoInARowWarnings.length === 1,
      harmonyTwoInARowWarningNamesBarAndSaysEarlierKept:
        harmonyTwoInARowWarnings.length === 1 &&
        harmonyTwoInARowWarnings[0].indexOf("bar 1") !== -1 &&
        harmonyTwoInARowWarnings[0].indexOf("keeping the earlier symbol") !== -1,
      // A malformed <harmony> yields null and never throws: an empty element, a
      // root with no kind, and a kind with no root are all read as naming no chord.
      harmonyMalformedParsesWithoutThrowing:
        !!harmonyMalformedModel && harmonyMalformedModel.parts[0].measures.length === 3,
      harmonyMalformedEmptyElementYieldsNull:
        !!harmonyMalformedModel && harmonyMalformedModel.parts[0].measures[0].notes[0].harmony === null,
      harmonyMalformedRootWithoutKindYieldsNull:
        !!harmonyMalformedModel && harmonyMalformedModel.parts[0].measures[1].notes[0].harmony === null,
      harmonyMalformedKindWithoutRootYieldsNull:
        !!harmonyMalformedModel && harmonyMalformedModel.parts[0].measures[2].notes[0].harmony === null,
      // A malformed harmony is silent: the one warning this stage adds belongs to
      // the adjacency case alone, so a file full of empty harmonies says nothing.
      harmonyMalformedEmitsNoWarning: harmonyMalformedWarnings.length === 0,
      // Every fixture in this self-test that carries no <harmony> reads null on
      // every note, so the new branch cannot manufacture a chord out of nothing.
      harmonyNullThroughoutEveryHarmonyFreeFixture: everyNoteHarmonyNull(harmonyFreeModels),
      // The existing per-note fields are undisturbed on a bar that carries a
      // harmony: bar 3 holds a harmony AND a dynamic and still shapes nothing, and
      // the rich fixture's dynamic, slur, tie and lyric reads are unchanged.
      harmonyShapingFieldUnaffectedOnHarmonyBars:
        hb1[0].shaping === null && hb3[0].shaping === null && hb4[0].shaping === null,
      harmonyDynamicAndShapingUnaffectedOnRichFixture:
        !!rC4 && rC4.dynamic === "f" && rC4.lyric === "la" && rC4.shaping === null &&
        !!rG4 && rG4.dynamic === null && rG4.shaping === null,
    };

    console.table(results);

    // Reported onset VALUES (Stage 5.1), printed separately so the numbers are
    // visible for verification without mixing non-boolean values into the
    // pass/fail rows above. These are the raw onsets the assertions checked.
    const onsetValues = {
      pianoBar1AllOnsets: JSON.stringify(pianoBar1Onsets),
      chordsBar1TriadOnsets: JSON.stringify(chordTriadOnsets),
      chordsBar1NextNonChordOnset: chordNextOnset,
      restFixtureRestOnset: roRest ? roRest.onset : null,
      restFixtureNextNoteOnset: roNote ? roNote.onset : null,
      backupFixtureFirstOnset: boFirst ? boFirst.onset : null,
      backupFixtureThirdOnset: boThird ? boThird.onset : null,
    };
    console.table(onsetValues);

    return results;
  }

  return { parse, selfTest };
})();

window.MusicParse = MusicParse;
