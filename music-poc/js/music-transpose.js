// music-transpose.js
// Diatonic transposition service for the Accessible Music proof of concept.
//
// TWO parts that share nothing but a namespace. transposeXml is a PURE STRING
// TRANSFORM: it parses a MusicXML string, shifts every pitch by a diatonic offset
// (whole octaves and/or single letter-name steps) and/or a chromatic semitone
// offset, and serialises the result back to a MusicXML string. The semitone shift
// reads and rewrites <alter>, spelling the result SHARP-PREFERRING: a shifted
// black key is always a sharp, so a transposed B flat reads as A sharp, never B
// flat. Full key-aware enharmonic spelling is out of scope for the PoC. It touches
// no DOM beyond DOMParser and XMLSerializer on the passed text, never throws, and
// returns null on bad input. render builds the six-button control (octave, step
// and semitone, up and down); it owns the only DOM this file creates and merely
// signals a delta object to its onChange caller, leaving all status, announcement
// and re-render to the app wiring. One octave is seven diatonic steps and twelve
// semitones; there are no range limits in the PoC. Exposed as window.MusicTranspose.

const MusicTranspose = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The seven diatonic letter names in order, and their index within an octave.
  // LETTERS is the inverse of STEP_INDEX: LETTERS[STEP_INDEX[x]] === x.
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  // Semitone offset of each letter within an octave, for reading a pitch's
  // chromatic position. C is 0.
  const STEP_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Sharp-preferring spelling of each semitone within an octave, for writing a
  // shifted pitch back. SIMPLIFICATION: a chromatic shift always spells the black
  // keys as sharps, so a transposed B flat reads as A sharp, never B flat. Full
  // key-aware enharmonic spelling (when to write a flat) is out of scope for the
  // PoC. Each entry is [letter, alter].
  const SEMITONE_SPELLING = [
    ["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0],
    ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0],
  ];

  // chromaticRespell(step, octave, alter, semitones): PURE. Shifts a pitch by a
  // number of semitones and returns its sharp-preferring spelling as
  // { step, octave, alter }. Reads alter (0 when absent). Octaves carry correctly
  // across C, since C starts each octave. Returns null if the step is unknown.
  function chromaticRespell(step, octave, alter, semitones) {
    if (!(step in STEP_SEMITONE)) return null;
    const a = typeof alter === "number" && isFinite(alter) ? alter : 0;
    const absolute = octave * 12 + STEP_SEMITONE[step] + a + semitones;
    const newOctave = Math.floor(absolute / 12);
    const within = ((absolute % 12) + 12) % 12; // floor-safe for negatives
    const spelt = SEMITONE_SPELLING[within];
    return { step: spelt[0], octave: newOctave, alter: spelt[1] };
  }

  // setAlter(pitch, stepEl, value): write the chromatic alteration into a <pitch>.
  // A non-zero value sets (or creates) an <alter> after <step>; a zero value
  // removes any existing <alter>, so a natural result reads as a plain note ("C")
  // rather than an explicit natural ("C natural").
  function setAlter(pitch, stepEl, value) {
    let alterEl = pitch.querySelector("alter");
    if (value === 0) {
      if (alterEl) pitch.removeChild(alterEl);
      return;
    }
    if (!alterEl) {
      alterEl = pitch.ownerDocument.createElement("alter");
      pitch.insertBefore(alterEl, stepEl.nextSibling); // after <step>, before <octave>
    }
    alterEl.textContent = String(value);
  }

  // transposeXml(xmlText, offset): PURE; NEVER throws. Shifts every pitch in a
  // MusicXML string by offset.octaves whole octaves plus offset.steps diatonic
  // steps (the diatonic phase), then by offset.semitones semitones (the chromatic
  // phase, which reads and rewrites <alter> and spells sharp-preferring). Each is
  // treated as 0 when missing or non-numeric, so a diatonic-only call behaves
  // exactly as before. Returns the rewritten MusicXML string, or null when the
  // input is not a non-empty string, fails to parse, or is not a score-partwise
  // document. Rests carry no <pitch> and are skipped naturally.
  function transposeXml(xmlText, offset) {
    if (typeof xmlText !== "string" || !xmlText.length) {
      logWarn("transposeXml: input is not a non-empty string");
      return null;
    }

    const o = offset || {};
    const octaves = typeof o.octaves === "number" && isFinite(o.octaves) ? o.octaves : 0;
    const steps = typeof o.steps === "number" && isFinite(o.steps) ? o.steps : 0;
    const semitones = typeof o.semitones === "number" && isFinite(o.semitones) ? o.semitones : 0;
    const totalShift = steps + octaves * 7;

    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror") || !doc.querySelector("score-partwise")) {
      logWarn("transposeXml: input did not parse as a score-partwise document");
      return null;
    }

    const pitches = doc.querySelectorAll("note pitch");
    for (const pitch of pitches) {
      const stepEl = pitch.querySelector("step");
      const octaveEl = pitch.querySelector("octave");
      if (!stepEl || !octaveEl) continue;

      const step = stepEl.textContent;
      if (!(step in STEP_INDEX)) continue;

      const octave = parseInt(octaveEl.textContent, 10);
      if (!isFinite(octave)) continue;

      // Diatonic phase: shift letter name and octave by the whole-octave and
      // letter-step offset. Alter is left untouched.
      const absolute = octave * 7 + STEP_INDEX[step];
      const newAbsolute = absolute + totalShift;
      const newIndex = ((newAbsolute % 7) + 7) % 7; // floor-safe for negatives
      let newStep = LETTERS[newIndex];
      let newOctave = Math.floor(newAbsolute / 7);

      // Chromatic phase: if a semitone shift is asked for, respell the
      // diatonically-shifted pitch (reading its alter) sharp-preferring, writing
      // the new alter back. A natural result drops <alter> so it reads plainly.
      if (semitones !== 0) {
        const alterEl = pitch.querySelector("alter");
        const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
        const respelt = chromaticRespell(newStep, newOctave, alter, semitones);
        if (respelt) {
          newStep = respelt.step;
          newOctave = respelt.octave;
          setAlter(pitch, stepEl, respelt.alter);
        }
      }

      stepEl.textContent = newStep;
      octaveEl.textContent = String(newOctave);
    }

    let serialised = new XMLSerializer().serializeToString(doc);
    if (serialised.indexOf("<?xml") !== 0) {
      serialised = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialised;
    }

    logInfo("transposeXml: shifted " + pitches.length + " pitch element(s) by " + totalShift + " diatonic step(s) and " + semitones + " semitone(s)");
    return serialised;
  }

  // render(mountEl, onChange): builds four type="button" controls into mountEl.
  // Each click signals a delta object to onChange (when it is a function) and does
  // nothing else — feedback and re-rendering belong to the app wiring. Returns
  // true on success, false when no mount is supplied; NEVER throws.
  function render(mountEl, onChange) {
    if (!mountEl) {
      logError("Cannot build transpose control: no mount element supplied");
      return false;
    }

    mountEl.replaceChildren();

    // Text-only buttons (like the audio Play/Stop controls): the icon library has
    // no transpose glyph, so the visible label is the whole accessible name and
    // no title attribute is used.
    const buttons = [
      { label: "Octave up", delta: { octaves: 1, steps: 0, semitones: 0 } },
      { label: "Octave down", delta: { octaves: -1, steps: 0, semitones: 0 } },
      { label: "Step up", delta: { octaves: 0, steps: 1, semitones: 0 } },
      { label: "Step down", delta: { octaves: 0, steps: -1, semitones: 0 } },
      { label: "Semitone up", delta: { octaves: 0, steps: 0, semitones: 1 } },
      { label: "Semitone down", delta: { octaves: 0, steps: 0, semitones: -1 } },
    ];

    for (const spec of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.appendChild(document.createTextNode(spec.label));
      button.addEventListener("click", function () {
        if (typeof onChange === "function") onChange(spec.delta);
      });
      mountEl.appendChild(button);
    }

    logInfo("Rendered transpose control into #" + (mountEl.id || "mount"));
    return true;
  }

  // Self-test: synchronous and self-contained. Re-parses each transposed result
  // with DOMParser to read its pitches back, and builds the control into a
  // DETACHED <div> that is never attached to the page. console.table()s and
  // returns the results object.
  function selfTest() {
    const SAMPLE =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<score-partwise version="4.0">\n' +
      "  <work><work-title>Accessible Music PoC sample</work-title></work>\n" +
      "  <part-list>\n" +
      '    <score-part id="P1"><part-name>Melody</part-name></score-part>\n' +
      "  </part-list>\n" +
      '  <part id="P1">\n' +
      '    <measure number="1">\n' +
      "      <attributes>\n" +
      "        <divisions>2</divisions>\n" +
      "        <key><fifths>0</fifths></key>\n" +
      "        <time><beats>4</beats><beat-type>4</beat-type></time>\n" +
      "        <clef><sign>G</sign><line>2</line></clef>\n" +
      "      </attributes>\n" +
      "      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>\n" +
      "      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>\n" +
      "      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "    </measure>\n" +
      '    <measure number="2">\n' +
      "      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>\n" +
      "      <note><rest/><duration>2</duration><type>quarter</type></note>\n" +
      "      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "    </measure>\n" +
      "  </part>\n" +
      "</score-partwise>\n";

    const CARRY =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<score-partwise version="4.0">\n' +
      '  <part id="P1">\n' +
      '    <measure number="1">\n' +
      "      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>\n" +
      "    </measure>\n" +
      "  </part>\n" +
      "</score-partwise>\n";

    // A minimal chord: a C major triad, to prove a chord survives a semitone shift
    // (its <chord/> elements untouched) and its pitches respell.
    const CHORD =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<score-partwise version="4.0">\n' +
      '  <part id="P1">\n' +
      '    <measure number="1">\n' +
      "      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>\n" +
      "      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>\n" +
      "      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>\n" +
      "    </measure>\n" +
      "  </part>\n" +
      "</score-partwise>\n";

    // readPitches(xml): parse a transposed result and return { error, pitches }
    // where pitches is an array of { step, octave, alter } in document order.
    function readPitches(xml) {
      if (typeof xml !== "string") return { error: true, pitches: [] };
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror")) return { error: true, pitches: [] };
      const out = [];
      const els = doc.querySelectorAll("note pitch");
      for (const p of els) {
        const alterEl = p.querySelector("alter");
        out.push({
          step: p.querySelector("step").textContent,
          octave: parseInt(p.querySelector("octave").textContent, 10),
          alter: alterEl ? parseInt(alterEl.textContent, 10) : null,
        });
      }
      return { error: false, pitches: out };
    }

    const original = readPitches(SAMPLE).pitches;

    const octaveUpXml = transposeXml(SAMPLE, { octaves: 1, steps: 0 });
    const octaveUp = readPitches(octaveUpXml);
    const octaveRiseRaisesEveryOctave =
      !octaveUp.error &&
      octaveUp.pitches.length === original.length &&
      octaveUp.pitches.every(function (p, i) {
        return p.step === original[i].step && p.octave === original[i].octave + 1;
      });

    const stepUp = readPitches(transposeXml(SAMPLE, { octaves: 0, steps: 1 }));
    const stepUpSteps = stepUp.pitches.map(function (p) {
      return p.step;
    });
    const stepUpMovesSteps = stepUpSteps.join(",") === ["D", "E", "F", "G", "A", "B", "D"].join(",");

    const carryUp = readPitches(transposeXml(CARRY, { octaves: 0, steps: 1 })).pitches[0];
    const carryUpResult = !!carryUp && carryUp.step === "C" && carryUp.octave === 5;

    const carryDown = readPitches(transposeXml(CARRY, { octaves: 0, steps: -1 })).pitches[1];
    const carryDownResult = !!carryDown && carryDown.step === "B" && carryDown.octave === 3;

    // Rests: the transposed SAMPLE must keep exactly one <rest/> and the same
    // pitched-note count as the original.
    const restsDoc = new DOMParser().parseFromString(octaveUpXml, "application/xml");
    const restsUntouched =
      restsDoc.querySelectorAll("rest").length === 1 && restsDoc.querySelectorAll("note pitch").length === original.length;

    const reParsesCleanly = !octaveUp.error && octaveUpXml.indexOf("<?xml") === 0;

    // Control: build into a detached div, capture the four buttons, click each and
    // record the delta passed to onChange.
    const temp = document.createElement("div");
    let lastDelta = null;
    const renderReturnsTrue = render(temp, function (delta) {
      lastDelta = delta;
    }) === true;
    const builtButtons = temp.querySelectorAll('button[type="button"]');
    const allButtons = temp.querySelectorAll("button");
    const labels = Array.prototype.map.call(builtButtons, function (b) {
      return b.textContent;
    });
    const noneHaveTitle = Array.prototype.every.call(allButtons, function (b) {
      return !b.hasAttribute("title");
    });

    function deltaFromClick(label) {
      lastDelta = null;
      for (const b of builtButtons) {
        if (b.textContent === label) b.click();
      }
      return lastDelta;
    }
    const upDelta = deltaFromClick("Octave up");
    const downDelta = deltaFromClick("Octave down");
    const stepUpDelta = deltaFromClick("Step up");
    const stepDownDelta = deltaFromClick("Step down");
    function deltaEquals(d, octaves, steps) {
      return !!d && d.octaves === octaves && d.steps === steps;
    }
    const buttonsSignalDeltas =
      deltaEquals(upDelta, 1, 0) &&
      deltaEquals(downDelta, -1, 0) &&
      deltaEquals(stepUpDelta, 0, 1) &&
      deltaEquals(stepDownDelta, 0, -1);

    const semiUpDelta = deltaFromClick("Semitone up");
    const semiDownDelta = deltaFromClick("Semitone down");
    const buttonsSignalSemitoneDeltas =
      !!semiUpDelta && semiUpDelta.semitones === 1 &&
      !!semiDownDelta && semiDownDelta.semitones === -1;

    // Chromatic results: a semitone-up of the sample, a chord that survives a
    // semitone shift, and a diatonic-then-chromatic composition.
    const semiUp = readPitches(transposeXml(SAMPLE, { octaves: 0, steps: 0, semitones: 1 }));
    const chordUpXml = transposeXml(CHORD, { octaves: 0, steps: 0, semitones: 1 });
    const chordUpDoc = new DOMParser().parseFromString(chordUpXml, "application/xml");
    const chordUpPitches = readPitches(chordUpXml).pitches;
    const combo = readPitches(transposeXml(SAMPLE, { octaves: 0, steps: 1, semitones: 1 })).pitches[0];

    const results = {
      hasTransposeXml: typeof transposeXml === "function",
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      octaveRiseRaisesEveryOctave: octaveRiseRaisesEveryOctave,
      stepUpMovesSteps: stepUpMovesSteps,
      carryUp: carryUpResult,
      carryDown: carryDownResult,
      restsUntouched: restsUntouched,
      reParsesCleanly: reParsesCleanly,
      rejectsGarbage: transposeXml("not xml", { octaves: 1 }) === null && transposeXml("", {}) === null,
      buildsSixButtons: allButtons.length === 6 && builtButtons.length === 6,
      buildsSixButtonsLabelled:
        labels.indexOf("Octave up") !== -1 &&
        labels.indexOf("Octave down") !== -1 &&
        labels.indexOf("Step up") !== -1 &&
        labels.indexOf("Step down") !== -1 &&
        labels.indexOf("Semitone up") !== -1 &&
        labels.indexOf("Semitone down") !== -1 &&
        noneHaveTitle &&
        renderReturnsTrue,
      buttonsSignalDeltas: buttonsSignalDeltas,
      buttonsSignalSemitoneDeltas: buttonsSignalSemitoneDeltas,
      chromaticRespellSharp: (function () {
        const r = chromaticRespell("C", 4, 0, 1);
        return !!r && r.step === "C" && r.octave === 4 && r.alter === 1;
      })(),
      chromaticRespellNatural: (function () {
        const r = chromaticRespell("E", 4, 0, 1);
        return !!r && r.step === "F" && r.octave === 4 && r.alter === 0;
      })(),
      chromaticRespellOctaveCarryUp: (function () {
        const r = chromaticRespell("B", 4, 0, 1);
        return !!r && r.step === "C" && r.octave === 5 && r.alter === 0;
      })(),
      chromaticRespellOctaveCarryDown: (function () {
        const r = chromaticRespell("C", 4, 0, -1);
        return !!r && r.step === "B" && r.octave === 3 && r.alter === 0;
      })(),
      chromaticRespellReadsAlter: (function () {
        const r = chromaticRespell("C", 4, 1, 1);
        return !!r && r.step === "D" && r.octave === 4 && r.alter === 0;
      })(),
      chromaticRespellSharpPreferring: (function () {
        const r = chromaticRespell("A", 4, 0, 1);
        return !!r && r.step === "A" && r.octave === 4 && r.alter === 1;
      })(),
      semitoneUpCSharp: !semiUp.error && semiUp.pitches[0].step === "C" && semiUp.pitches[0].alter === 1,
      semitoneUpEToFNatural: !semiUp.error && semiUp.pitches[2].step === "F" && semiUp.pitches[2].alter === null,
      chordSurvivesSemitone:
        chordUpDoc.querySelectorAll("chord").length === 2 && chordUpDoc.querySelectorAll("note pitch").length === 3,
      chordRespellsPitches:
        chordUpPitches.length === 3 &&
        chordUpPitches[0].step === "C" && chordUpPitches[0].alter === 1 &&
        chordUpPitches[1].step === "F" && chordUpPitches[1].alter === null &&
        chordUpPitches[2].step === "G" && chordUpPitches[2].alter === 1,
      diatonicThenChromaticComposes:
        !!combo && combo.step === "D" && combo.octave === 4 && combo.alter === 1,
      guardNoMount: render(null, function () {}) === false,
    };

    temp.remove();
    console.table(results);
    return results;
  }

  return { transposeXml, render, selfTest };
})();

window.MusicTranspose = MusicTranspose;
