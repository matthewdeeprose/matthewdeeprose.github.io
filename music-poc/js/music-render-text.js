// music-render-text.js
// Text-score rendering service for the Accessible Music proof of concept.
//
// A stateless service, like music-render-score.js: it owns no DOM elements and
// caches nothing. It exposes a single render(model, mountEl) method that builds
// an accessible, ordered text outline of a parsed model — headings per part,
// ordered lists of bars, and ordered lists of notes — into the given mount
// element, plus a selfTest(). Unlike the visual renderer it is SYNCHRONOUS and
// it never notifies: on bad input it logs and returns false. It groups each bar's
// notes into events with MusicModelWalk.groupNotes and asks MusicRenderPhrase for
// each event's spoken text, building every node with createElement + textContent
// so text is never injected unescaped. Exposed as window.MusicRenderText.

const MusicRenderText = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side model walking: route through the shared MusicModelWalk when
  // present, otherwise fall back to neutral helpers so this file never throws if
  // the model-walk layer is absent. groupNotes degrades to one group per note.
  const walk = window.MusicModelWalk || {
    describeNote() { return { isRest: false, pitch: null, value: null }; },
    groupNotes(notes) { return (Array.isArray(notes) ? notes : []).map(function (n) { return [n]; }); },
  };

  // Consumer-side phrase composition: route through the shared MusicRenderPhrase
  // when present, otherwise fall back to a neutral phrase so this file never
  // throws if the phrase layer is absent. The phrasing itself lives in that
  // module now, so this renderer only assembles the list.
  const phrase = window.MusicRenderPhrase || { phraseOf() { return ""; } };

  // Consumer-side naming: route through the shared MusicNames when present,
  // otherwise fall back to neutral lookups so this file never throws if the names
  // layer is absent. Used only for the bar-level structural announcements.
  const names = window.MusicNames || {
    keySignatureName() { return null; },
    clefName() { return null; },
    endingName() { return null; },
  };

  // Build the ordered note list for one sequence of notes: groupNotes turns it
  // into events (a chord is one group, so one <li>), and the phrase layer turns
  // each event into its spoken text, with the next event's head note as the slur
  // target. Used for a single-staff bar and for each hand of a piano bar.
  function noteListOf(notes) {
    const noteList = document.createElement("ol");
    const groups = walk.groupNotes(Array.isArray(notes) ? notes : []);
    for (let i = 0; i < groups.length; i++) {
      const noteItem = document.createElement("li");
      const nextHead = groups[i + 1] ? groups[i + 1][0] : null;
      noteItem.textContent = phrase.phraseOf(groups[i], nextHead);
      noteList.appendChild(noteItem);
    }
    return noteList;
  }

  // Heading for one hand: the staff's clef named and capitalised plus " staff",
  // e.g. "Treble staff", or "Staff <n>" when the clef is absent or unnamed.
  function staffHeadingOf(staff, model) {
    const clefs = model && model.clefs ? model.clefs : {};
    const clef = staff !== null && clefs[staff] ? clefs[staff] : null;
    const name = clef ? names.clefName(clef.sign, clef.line) : null;
    if (name) {
      return name.charAt(0).toUpperCase() + name.slice(1) + " staff";
    }
    return "Staff " + (staff === null ? "1" : staff);
  }

  // Build an accessible text outline of model into mountEl. Synchronous; returns
  // true on success and false on any failure; NEVER throws. There is no
  // notification — the rendered outline is itself the feedback.
  function render(model, mountEl) {
    // Guard: we need a model with a parts array to walk.
    if (!model || !Array.isArray(model.parts)) {
      logError("Cannot render text: model is missing or has no parts array");
      return false;
    }

    // Guard: we need a mount element to build into.
    if (!mountEl) {
      logError("Cannot render text: no mount element supplied");
      return false;
    }

    // Clear any previous render from the mount before building afresh.
    mountEl.replaceChildren();

    for (const part of model.parts) {
      // Part heading: the part name, or "Part <id>" when the name is absent.
      const heading = document.createElement("h3");
      const partName = part && part.name ? part.name : "Part " + (part ? part.id : "");
      heading.textContent = partName;
      mountEl.appendChild(heading);

      // Ordered list of bars, so assistive tech announces each bar's position.
      const measureList = document.createElement("ol");
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const measureItem = document.createElement("li");

        // Leading bar label, then the nested ordered list of notes. Stage 13
        // appends any structural marks this bar carries, comma-joined, so a marked
        // bar reads "Bar 4, first-time ending, repeat to bar 1" and a plain bar
        // still reads "Bar 4". The marks read in a natural order: the bar's ending
        // role, then a key or clef change entering it, then the repeat at its end.
        const marks = [];
        if (measure) {
          if (measure.endingStart) {
            const ending = names.endingName(measure.endingStart);
            if (ending) marks.push(ending);
          }
          if (measure.keyChange) {
            const keyName = names.keySignatureName(measure.keyChange.fifths);
            if (keyName) marks.push("key changes to " + keyName);
          }
          if (measure.clefChange) {
            const clef = names.clefName(measure.clefChange.sign, measure.clefChange.line);
            if (clef) marks.push("clef changes to " + clef);
          }
          if (measure.repeatTo) marks.push("repeat to bar " + measure.repeatTo);
        }
        const barLabel = "Bar " + (measure ? measure.number : "") + (marks.length ? ", " + marks.join(", ") : "");
        measureItem.appendChild(document.createTextNode(barLabel));

        // Split the bar into hands. A single-staff bar yields one group, so the
        // note list renders directly as before; a piano bar yields one sub-list
        // per hand, each under a clef-named heading.
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        const staffGroups = walk.groupByStaff(notes);
        if (staffGroups.length > 1) {
          const staffList = document.createElement("ol");
          for (let s = 0; s < staffGroups.length; s++) {
            const staffItem = document.createElement("li");
            staffItem.appendChild(document.createTextNode(staffHeadingOf(staffGroups[s].staff, model)));
            staffItem.appendChild(noteListOf(staffGroups[s].notes));
            staffList.appendChild(staffItem);
          }
          measureItem.appendChild(staffList);
        } else {
          const single = staffGroups.length === 1 ? staffGroups[0].notes : [];
          measureItem.appendChild(noteListOf(single));
        }
        measureList.appendChild(measureItem);
      }
      mountEl.appendChild(measureList);
    }

    logInfo("Rendered text outline into #" + (mountEl.id || "mount"));
    return true;
  }

  // Self-test: synchronous and self-contained. Builds the project sample model
  // into a DETACHED temp <div> (never attached to the page) and asserts the
  // resulting markup. Needs MusicModelWalk loaded for real descriptors.
  // console.table()s and returns the results object.
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

    // A detached temp mount; never attached to the page.
    const temp = document.createElement("div");
    const returnsTrue = render(MODEL, temp) === true;

    const headings = temp.querySelectorAll("h3");
    const measureList = temp.querySelector("ol");
    const measureItems = measureList ? measureList.querySelectorAll(":scope > li") : [];
    const noteItems = temp.querySelectorAll("ol ol > li");
    const firstNote = noteItems.length ? noteItems[0].textContent.trim() : "";
    const lastNote = noteItems.length ? noteItems[noteItems.length - 1].textContent.trim() : "";
    let restFound = false;
    noteItems.forEach(function (li) {
      if (li.textContent.trim() === "rest crotchet") restFound = true;
    });
    const firstMeasureLabel = measureItems.length ? measureItems[0].textContent.trim() : "";

    // Rich model (the shape MusicParse returns for sample-rich.musicxml) to check
    // the new per-note phrasing.
    const RICH_MODEL = {
      workTitle: "Accessible Music PoC rich sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      tempo: 120,
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [
            {
              number: "1",
              notes: [
                { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", dynamic: "f", lyric: "la", slur: { start: true, stop: false }, tie: null },
                { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: { start: false, stop: true }, tie: null },
                { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: null, tie: { start: true, stop: false } },
                { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", dynamic: null, lyric: null, slur: null, tie: { start: false, stop: true } },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, step: "G", octave: 4, duration: 4, type: "whole", dynamic: null, lyric: null, slur: null, tie: null },
              ],
            },
          ],
        },
      ],
    };
    const tempRich = document.createElement("div");
    render(RICH_MODEL, tempRich);
    const richItems = tempRich.querySelectorAll("ol ol > li");

    // Chords model (the shape MusicParse returns for sample-chords.musicxml) to
    // check that a chord becomes one <li> with its pitches named together and a
    // melody is unchanged: six events from eleven flat notes.
    const CHORDS_MODEL = {
      workTitle: "Accessible Music PoC chords sample",
      divisions: 1,
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
                { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" },
                { rest: false, chord: true, step: "E", octave: 4, duration: 1, type: "quarter" },
                { rest: false, chord: true, step: "G", octave: 4, duration: 1, type: "quarter" },
                { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter" },
                { rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter" },
                { rest: false, chord: true, step: "G", octave: 4, duration: 1, type: "quarter" },
                { rest: true, chord: false, step: null, octave: null, duration: 1, type: "quarter" },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, chord: false, step: "F", octave: 4, duration: 2, type: "half" },
                { rest: false, chord: false, step: "C", octave: 4, duration: 2, type: "half" },
                { rest: false, chord: true, step: "E", octave: 4, duration: 2, type: "half" },
                { rest: false, chord: true, step: "G", octave: 4, duration: 2, type: "half" },
              ],
            },
          ],
        },
      ],
    };
    const tempChords = document.createElement("div");
    render(CHORDS_MODEL, tempChords);
    const chordItems = tempChords.querySelectorAll("ol ol > li");

    // Structure model (the shape MusicParse returns for sample-structure.musicxml)
    // to check the bar-level structural announcements. A plain bar's label is
    // unchanged; a marked bar appends its marks comma-joined.
    const STRUCTURE_MODEL = {
      workTitle: "Accessible Music PoC structure sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      hasRepeat: true,
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" }] },
            { number: "2", clefChange: null, keyChange: { fifths: 1 }, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter" }] },
            { number: "3", clefChange: { sign: "F", line: 4 }, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
            { number: "4", clefChange: null, keyChange: null, repeatTo: "1", endingStart: "1", endingStop: "1",
              notes: [{ rest: false, chord: false, step: "G", octave: 3, duration: 1, type: "quarter" }] },
            { number: "5", clefChange: null, keyChange: null, repeatTo: null, endingStart: "2", endingStop: "2",
              notes: [{ rest: false, chord: false, step: "G", octave: 3, duration: 1, type: "quarter" }] },
          ],
        },
      ],
    };
    const tempStruct = document.createElement("div");
    render(STRUCTURE_MODEL, tempStruct);
    const structBarList = tempStruct.querySelector("ol");
    const structBars = structBarList ? structBarList.querySelectorAll(":scope > li") : [];
    const barLabelOf = function (i) {
      return structBars[i] && structBars[i].firstChild ? structBars[i].firstChild.textContent : "";
    };

    // Stage 14: a piano model (the shape parse() returns for sample-piano) to
    // check the per-hand sub-lists and their clef-named headings, plus a plain
    // single-staff model that must render with no staff heading at all.
    const PIANO_MODEL = {
      workTitle: "Accessible Music PoC piano sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      staves: 2,
      clefs: { "1": { sign: "G", line: 2 }, "2": { sign: "F", line: 4 } },
      parts: [
        {
          id: "P1",
          name: "Piano",
          measures: [
            {
              number: "1",
              clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [
                { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", staff: "1" },
                { rest: false, chord: true, step: "B", octave: 4, duration: 1, type: "quarter", staff: "1" },
                { rest: false, chord: true, step: "D", octave: 5, duration: 1, type: "quarter", staff: "1" },
                { rest: false, chord: false, step: "E", octave: 5, duration: 1, type: "quarter", staff: "1" },
                { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter", staff: "2" },
                { rest: false, chord: false, step: "D", octave: 3, duration: 1, type: "quarter", staff: "2" },
              ],
            },
          ],
        },
      ],
    };
    const tempPiano = document.createElement("div");
    render(PIANO_MODEL, tempPiano);
    const pianoBars = tempPiano.querySelector("ol");
    const pianoMeasure = pianoBars ? pianoBars.querySelector(":scope > li") : null;
    const pianoStaffList = pianoMeasure ? pianoMeasure.querySelector(":scope > ol") : null;
    const pianoStaffItems = pianoStaffList ? pianoStaffList.querySelectorAll(":scope > li") : [];
    const trebleHeading = pianoStaffItems[0] && pianoStaffItems[0].firstChild ? pianoStaffItems[0].firstChild.textContent : "";
    const bassHeading = pianoStaffItems[1] && pianoStaffItems[1].firstChild ? pianoStaffItems[1].firstChild.textContent : "";
    const trebleNotes = pianoStaffItems[0] ? pianoStaffItems[0].querySelectorAll("ol > li") : [];
    const bassNotes = pianoStaffItems[1] ? pianoStaffItems[1].querySelectorAll("ol > li") : [];

    const SINGLE_STAFF_MODEL = {
      workTitle: "single", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: null },
        { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", staff: null },
      ] }] }],
    };
    const tempSingle = document.createElement("div");
    render(SINGLE_STAFF_MODEL, tempSingle);

    const results = {
      hasRender: typeof render === "function",
      hasSelfTest: typeof selfTest === "function",
      returnsTrue: returnsTrue,
      onePartHeading: headings.length === 1 && headings[0].textContent.indexOf("Melody") !== -1,
      twoMeasures: measureItems.length === 2,
      eightNotes: noteItems.length === 8,
      firstNoteText: firstNote === "C4 crotchet",
      restText: restFound,
      lastNoteText: lastNote === "C5 crotchet",
      measureLabel: firstMeasureLabel.indexOf("Bar 1") === 0,
      realOrderedLists: temp.querySelectorAll("ol").length >= 3 && temp.querySelectorAll("ul").length === 0,
      handlesNullModel: render(null, document.createElement("div")) === false,
      handlesNoMount: render(MODEL, null) === false,
      richC4Full: richItems[0] && richItems[0].textContent.trim() === "C4 crotchet, forte, slurred to D4, lyric 'la'",
      richD4Plain: richItems[1] && richItems[1].textContent.trim() === "D4 crotchet",
      richE4TiedToNext: richItems[2] && richItems[2].textContent.trim() === "E4 crotchet, tied to the next note",
      richE4TiedFromPrev: richItems[3] && richItems[3].textContent.trim() === "E4 crotchet, tied from the previous note",
      richG4Plain: richItems[4] && richItems[4].textContent.trim() === "G4 semibreve",
      chordsSixItems: chordItems.length === 6,
      chordsTriadNamed: chordItems[0] && chordItems[0].textContent.trim() === "C4, E4 and G4 crotchet",
      chordsSingleD4: chordItems[1] && chordItems[1].textContent.trim() === "D4 crotchet",
      chordsDyadNamed: chordItems[2] && chordItems[2].textContent.trim() === "E4 and G4 crotchet",
      chordsRest: chordItems[3] && chordItems[3].textContent.trim() === "rest crotchet",
      chordsSingleF4: chordItems[4] && chordItems[4].textContent.trim() === "F4 minim",
      chordsTriadMinim: chordItems[5] && chordItems[5].textContent.trim() === "C4, E4 and G4 minim",
      structBar1PlainLabel: barLabelOf(0) === "Bar 1",
      structBar2KeyChangeLabel: barLabelOf(1) === "Bar 2, key changes to G major",
      structBar3ClefChangeLabel: barLabelOf(2) === "Bar 3, clef changes to bass",
      structBar4EndingAndRepeatLabel: barLabelOf(3) === "Bar 4, first-time ending, repeat to bar 1",
      structBar5SecondEndingLabel: barLabelOf(4) === "Bar 5, second-time ending",
      structBarsStillRenderNotes: structBars.length === 5 && tempStruct.querySelectorAll("ol ol > li").length === 5,
      pianoTwoStaffSubLists: pianoStaffItems.length === 2,
      pianoTrebleHeading: trebleHeading === "Treble staff",
      pianoBassHeading: bassHeading === "Bass staff",
      pianoTrebleTwoEvents: trebleNotes.length === 2,
      pianoTrebleChordFirst: !!trebleNotes[0] && trebleNotes[0].textContent === "G4, B4 and D5 crotchet",
      pianoBassTwoEvents: bassNotes.length === 2,
      singleStaffNoStaffHeading: (function () {
        const bars = tempSingle.querySelector("ol");
        const measure = bars ? bars.querySelector(":scope > li") : null;
        const directOl = measure ? measure.querySelector(":scope > ol") : null;
        const firstItem = directOl ? directOl.querySelector(":scope > li") : null;
        return !!firstItem && firstItem.textContent === "C4 crotchet";
      })(),
    };

    console.table(results);
    return results;
  }

  return { render, selfTest };
})();

window.MusicRenderText = MusicRenderText;
