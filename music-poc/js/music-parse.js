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
  const noteLayer = window.MusicParseNote || {
    extractNote() {
      return { rest: false, chord: false, step: null, octave: null, alter: null, duration: null, type: null, tie: null, slur: null, lyric: null, dynamic: null };
    },
  };

  // Consumer-side structural reading: route through the shared MusicParseStructure
  // when present, otherwise fall back to a neutral structure so this file never
  // throws if the structure-reading layer is absent. The per-measure structural
  // reads (repeats, endings, clef and key declarations) live in that module now.
  const structureLayer = window.MusicParseStructure || {
    readStructure() {
      return { repeatForward: false, repeatBackward: false, endingStart: null, endingStop: null, clef: null, key: null };
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

  // Tempo in quarter-notes per minute from the first <sound tempo="...">, or null.
  function tempoOf(root) {
    const soundEl = root.querySelector("sound[tempo]");
    if (!soundEl) return null;
    const t = parseInt(soundEl.getAttribute("tempo"), 10);
    return Number.isNaN(t) ? null : t;
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

  // Per-staff initial clefs from the first <attributes>, keyed by the clef's
  // staff number ("1", "2") as a string, each { sign, line }. A clef with no
  // number attribute is keyed "1". Empty object when no clef is declared. Used
  // for the hand headings, so a piano score can name its treble and bass staves.
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
    const workTitle = textOf(root, "work-title");
    const divisions = intOf(root, "divisions");
    const fifths = intOf(root, "fifths");
    const key = fifths === null ? null : { fifths: fifths };
    const beats = intOf(root, "beats");
    const beatType = intOf(root, "beat-type");
    const time = beats === null || beatType === null ? null : { beats: beats, beatType: beatType };
    const tempo = tempoOf(root);
    // Multiple-staves overview, taken from the first <attributes>: the staff count
    // and the initial clef on each staff. A single-staff score reports one staff
    // and one clef, so these read harmlessly for every existing fixture.
    const stavesValue = intOf(root, "staves");
    const staves = stavesValue === null ? 1 : stavesValue;
    const clefs = clefsOf(root);

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
      const measures = [];
      const measureEls = partEl.querySelectorAll("measure");
      // Running structural state, reset per part: the clef and key in force, so a
      // later measure's declaration can be detected as a change; and the most
      // recent forward-repeat bar, so a backward repeat can say which bar it
      // returns to (the first bar when there is no forward repeat).
      let runningClef = null;
      let runningKey = null;
      let lastForwardRepeatBar = null;
      const firstBarNumber = measureEls.length ? measureEls[0].getAttribute("number") : null;
      for (let m = 0; m < measureEls.length; m++) {
        const measureEl = measureEls[m];
        const notes = [];
        // Track the dynamic from any <direction> we pass so it attaches to the
        // next note. Reset per measure; cross-measure persistence is out of scope.
        let pendingDynamic = null;
        // Walk the measure's direct children in document order: <direction>
        // elements sit between notes, so only an in-order walk associates a
        // dynamic with the note that follows it. Notes are direct measure children.
        const children = measureEl.children;
        for (let c = 0; c < children.length; c++) {
          const child = children[c];
          if (child.tagName === "direction") {
            const dyn = dynamicOf(child);
            if (dyn) pendingDynamic = dyn;
          } else if (child.tagName === "note") {
            const note = noteLayer.extractNote(child);
            note.dynamic = pendingDynamic;
            pendingDynamic = null;
            notes.push(note);
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
        });
      }
      parts.push({
        id: id,
        name: id && Object.prototype.hasOwnProperty.call(nameById, id) ? nameById[id] : null,
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
      hasRepeat: hasRepeat,
      hasKeyChange: hasKeyChange,
      hasClefChange: hasClefChange,
      staves: staves,
      clefs: clefs,
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
    };

    console.table(results);
    return results;
  }

  return { parse, selfTest };
})();

window.MusicParse = MusicParse;
