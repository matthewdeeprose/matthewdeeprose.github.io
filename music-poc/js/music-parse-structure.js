// music-parse-structure.js
// Structural-mark reader for the Accessible Music proof of concept.
//
// A PURE PER-MEASURE READER: it takes one <measure> element from a parsed
// MusicXML document and returns a plain object describing the structural marks
// that measure carries — barline repeats, voltas (first- and second-time
// endings), and the clef and key declared in the measure's own <attributes>. It
// reads the measure's direct children only, never the page DOM, holds no
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
    };
    if (!measureEl || !measureEl.children) return structure;

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
      }
    }
    return structure;
  }

  // Self-test: synchronous and self-contained. Parses a small inline score with
  // DOMParser, reads each measure with readStructure, and asserts the marks,
  // including a plain bar and a null input that must both read neutral.
  // console.table()s and returns the results object.
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
    };

    console.table(results);
    return results;
  }

  return { readStructure, selfTest };
})();

window.MusicParseStructure = MusicParseStructure;
