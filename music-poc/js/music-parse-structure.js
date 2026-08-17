// music-parse-structure.js
// Structural-mark reader for the Accessible Music proof of concept.
//
// A PURE PER-MEASURE READER: it takes one <measure> element from a parsed
// MusicXML document and returns a plain object describing the structural marks
// that measure carries — barline repeats, voltas (first- and second-time
// endings), the clef and key declared in the measure's own <attributes>, and the
// rehearsal mark printed on a <direction>. It reads the measure's direct
// children only, never the page DOM, holds no
// cross-measure state, and never throws. Deciding whether a clef or key is a
// CHANGE needs the running value, so that decision belongs to the orchestrator
// (music-parse.js); this reader only reports what the measure declares. Exposed
// as window.MusicParseStructure.

const MusicParseStructure = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. The
  // full four-function block is kept by convention; this pure reader stays quiet.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Text content of the first matching descendant under root, trimmed, or null
  // when absent or empty. Mirrors the helper in music-parse.js so the two
  // parse-layer files read text the same way.
  function textOf(root, selector) {
    if (!root) return null;
    const el = root.querySelector(selector);
    if (!el) return null;
    const text = (el.textContent || "").trim();
    return text.length ? text : null;
  }

  // parseInt of the first matching descendant's text, or null when absent or NaN.
  function intOf(root, selector) {
    const text = textOf(root, selector);
    if (text === null) return null;
    const n = parseInt(text, 10);
    return Number.isNaN(n) ? null : n;
  }

  // Text of one already-located element, with every internal run of whitespace
  // collapsed to a single space and the ends trimmed, or null when the element is
  // absent or holds nothing but whitespace. This tidies only the FILE'S own line
  // breaks and indentation; it never alters the characters an engraver typed.
  function tidyTextOf(el) {
    if (!el) return null;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length ? text : null;
  }

  // readStructure(measureEl): pure. Returns the structural marks this measure
  // declares, every field neutral (false or null) when the mark is absent. It
  // never decides whether a clef or key is a change; the orchestrator does that
  // with the running value.
  function readStructure(measureEl) {
    const structure = {
      repeatForward: false,
      repeatBackward: false,
      endingStart: null,
      endingStop: null,
      clef: null,
      key: null,
      rehearsal: null,
    };
    if (!measureEl || !measureEl.children) return structure;

    // Usable rehearsal marks seen in this measure, so a duplicate warns ONCE
    // after the walk rather than once per extra mark.
    let rehearsalCount = 0;

    const children = measureEl.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === "barline") {
        // Repeat direction, on whichever barline carries it (forward on the
        // left, backward on the right), read from the direction attribute.
        const repeatEl = child.querySelector("repeat");
        if (repeatEl) {
          const direction = repeatEl.getAttribute("direction");
          if (direction === "forward") structure.repeatForward = true;
          else if (direction === "backward") structure.repeatBackward = true;
        }
        // Volta: a start opens an ending, a stop or discontinue closes one. The
        // ending number is kept as its raw string, matching the measure number.
        const endingEl = child.querySelector("ending");
        if (endingEl) {
          const number = endingEl.getAttribute("number");
          const type = endingEl.getAttribute("type");
          if (number) {
            if (type === "start") structure.endingStart = number;
            else if (type === "stop" || type === "discontinue") structure.endingStop = number;
          }
        }
      } else if (child.tagName === "attributes") {
        // The clef and key this measure declares, read raw. Single staff only;
        // multiple clefs and keys per measure are a Stage 14 concern.
        const clefEl = child.querySelector("clef");
        if (clefEl) {
          const sign = textOf(clefEl, "sign");
          const line = intOf(clefEl, "line");
          if (sign !== null) structure.clef = { sign: sign, line: line };
        }
        const fifths = intOf(child, "key fifths");
        if (fifths !== null) structure.key = { fifths: fifths };
      } else if (child.tagName === "direction") {
        // Rehearsal marks, shaped
        // <direction><direction-type><rehearsal>A</rehearsal></direction-type>.
        // The text is kept VERBATIM rather than mapped to spoken words, because a
        // rehearsal mark is an OPEN set — "A", "B.1", "Coda", "D.S. al Fine" —
        // unlike a clef sign or an ending number, which are closed lookups the
        // naming layer can safely table-map. A lookup here would return nothing
        // for every mark the table had not anticipated, silently dropping it.
        // Placement and every other attribute are ignored.
        const rehearsalEls = child.querySelectorAll("rehearsal");
        for (let r = 0; r < rehearsalEls.length; r++) {
          const mark = tidyTextOf(rehearsalEls[r]);
          if (mark === null) continue;
          rehearsalCount++;
          if (structure.rehearsal === null) structure.rehearsal = mark;
        }
      }
    }

    // A measure should carry at most one rehearsal mark. Where a file prints more
    // than one, the first wins and the rest are ignored — announcing several on a
    // single bar heading would be worse than losing the duplicates.
    if (rehearsalCount > 1) {
      logWarn(
        "Measure carried " + rehearsalCount + " rehearsal marks; reading only the first ('" +
        structure.rehearsal + "')"
      );
    }
    return structure;
  }

  // Self-test: synchronous and self-contained. Parses a small inline score with
  // DOMParser, reads each measure with readStructure, and asserts the marks,
  // including a plain bar and a null input that must both read neutral. A second
  // fixture covers the rehearsal mark on its own, so the first fixture's bar
  // indices never shift. console.table()s and returns the results object.
  function selfTest() {
    const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
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
    <measure number="6">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const doc = new DOMParser().parseFromString(SAMPLE, "application/xml");
    const measures = doc.querySelectorAll("measure");
    const s1 = readStructure(measures[0]);
    const s2 = readStructure(measures[1]);
    const s3 = readStructure(measures[2]);
    const s4 = readStructure(measures[3]);
    const s5 = readStructure(measures[4]);
    const s6 = readStructure(measures[5]);
    const sNull = readStructure(null);

    // Rehearsal-mark fixture, kept separate from SAMPLE so the six bars above
    // keep their indices and their rows stay exactly as they were. Bar by bar:
    // a plain mark, a dotted composite, a mark broken across lines by the file's
    // own indentation, a direction with no rehearsal child, no direction at all,
    // an empty and a whitespace-only mark, two marks, and a mark sharing its bar
    // with a forward repeat and an ending start.
    const REHEARSAL_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <direction placement="above">
        <direction-type>
          <rehearsal>A</rehearsal>
          </direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <direction placement="above">
        <direction-type>
          <rehearsal>B.1</rehearsal>
          </direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <direction placement="above">
        <direction-type>
          <rehearsal>D.S.
            al  Fine</rehearsal>
          </direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <direction placement="below">
        <direction-type><dynamics><f/></dynamics></direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="5">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="6">
      <direction placement="above">
        <direction-type><rehearsal></rehearsal></direction-type>
        </direction>
      <direction placement="above">
        <direction-type><rehearsal>   </rehearsal></direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="7">
      <direction placement="above">
        <direction-type><rehearsal>C</rehearsal></direction-type>
        </direction>
      <direction placement="above">
        <direction-type><rehearsal>D</rehearsal></direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="8">
      <barline location="left"><repeat direction="forward"/><ending number="1" type="start"/></barline>
      <direction placement="above">
        <direction-type><rehearsal>E</rehearsal></direction-type>
        </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    const rehearsalDoc = new DOMParser().parseFromString(REHEARSAL_SAMPLE, "application/xml");
    const rehearsalMeasures = rehearsalDoc.querySelectorAll("measure");
    const r1 = readStructure(rehearsalMeasures[0]);
    const r2 = readStructure(rehearsalMeasures[1]);
    const r3 = readStructure(rehearsalMeasures[2]);
    const r4 = readStructure(rehearsalMeasures[3]);
    const r5 = readStructure(rehearsalMeasures[4]);
    const r6 = readStructure(rehearsalMeasures[5]);
    const r7 = readStructure(rehearsalMeasures[6]);
    const r8 = readStructure(rehearsalMeasures[7]);

    const results = {
      hasReadStructure: typeof readStructure === "function",
      hasSelfTest: typeof selfTest === "function",

      bar1RepeatForward: s1.repeatForward === true,
      bar1NoRepeatBackward: s1.repeatBackward === false,
      bar1NoEndings: s1.endingStart === null && s1.endingStop === null,
      bar1Clef: !!s1.clef && s1.clef.sign === "G" && s1.clef.line === 2,
      bar1Key: !!s1.key && s1.key.fifths === 0,

      bar2KeyChange: !!s2.key && s2.key.fifths === 1,
      bar2NoClef: s2.clef === null,
      bar2NoRepeatsOrEndings:
        s2.repeatForward === false && s2.repeatBackward === false &&
        s2.endingStart === null && s2.endingStop === null,

      bar3Clef: !!s3.clef && s3.clef.sign === "F" && s3.clef.line === 4,
      bar3NoKey: s3.key === null,

      bar4EndingStart1: s4.endingStart === "1",
      bar4EndingStop1: s4.endingStop === "1",
      bar4RepeatBackward: s4.repeatBackward === true,
      bar4NoRepeatForward: s4.repeatForward === false,
      bar4NoClefNoKey: s4.clef === null && s4.key === null,

      bar5EndingStart2: s5.endingStart === "2",
      bar5EndingStop2: s5.endingStop === "2",
      bar5NoRepeats: s5.repeatForward === false && s5.repeatBackward === false,
      bar5NoClefNoKey: s5.clef === null && s5.key === null,

      plainBarAllNeutral:
        s6.repeatForward === false && s6.repeatBackward === false &&
        s6.endingStart === null && s6.endingStop === null &&
        s6.clef === null && s6.key === null,

      nullInputNeutral:
        sNull.repeatForward === false && sNull.repeatBackward === false &&
        sNull.endingStart === null && sNull.endingStop === null &&
        sNull.clef === null && sNull.key === null,

      rehearsalReadsMarkText: r1.rehearsal === "A",
      rehearsalDottedCompositeVerbatim: r2.rehearsal === "B.1",
      rehearsalCollapsesInternalWhitespace: r3.rehearsal === "D.S. al Fine",
      rehearsalNullWhenDirectionCarriesNoMark: r4.rehearsal === null,
      rehearsalNullWhenNoDirection: r5.rehearsal === null,
      rehearsalNullWhenEmptyOrWhitespace: r6.rehearsal === null,
      rehearsalFirstMarkWinsWhenTwo: r7.rehearsal === "C",
      rehearsalNullOnNullInput: sNull.rehearsal === null,
      rehearsalReadAlongsideStructuralMarks: r8.rehearsal === "E",
      rehearsalLeavesRepeatForwardIntact: r8.repeatForward === true,
      rehearsalLeavesEndingStartIntact: r8.endingStart === "1",
      rehearsalNullOnBarsWithoutDirections:
        s1.rehearsal === null && s2.rehearsal === null && s3.rehearsal === null &&
        s4.rehearsal === null && s5.rehearsal === null && s6.rehearsal === null,
    };

    console.table(results);
    return results;
  }

  return { readStructure, selfTest };
})();

window.MusicParseStructure = MusicParseStructure;
