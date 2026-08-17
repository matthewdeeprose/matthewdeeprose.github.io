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
    // render and the new look-ahead both call groupByStaff, and this module
    // promises never to throw, so the fallback degrades to a single group. It
    // cannot be self-tested, because walk is captured in a const at module load.
    groupByStaff(notes) { return [{ staff: null, notes: Array.isArray(notes) ? notes : [] }]; },
    // The voiced grouping and the look-ahead both call groupByVoice, and this
    // module promises never to throw, so the fallback degrades to a single group.
    // It cannot be self-tested, because walk is captured in a const at module load.
    groupByVoice(notes) { return [{ voice: null, notes: Array.isArray(notes) ? notes : [] }]; },
    // Stage 53: render asks for the cross-part keyboard pairs, and this module
    // promises never to throw, so the fallback degrades to "no pairs" — every part
    // then renders on its own, exactly as it did before this stage. Like the other
    // fallbacks it cannot be self-tested, because walk is captured in a const at
    // module load.
    keyboardPairs() { return []; },
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

  // The head note of the first event in the given staff AND voice within measure,
  // or null. Uses the shared groupByStaff, then groupByVoice within that staff,
  // then groupNotes, so the definition of a hand, a voice and an event stays the
  // shared one. Matches BOTH the staff and the voice STRICTLY with ===, so a
  // bar-final slur in voice 2 takes the next bar's voice 2 first note as its
  // target and never voice 1's. Stage 45 matched on staff alone, which was right
  // only while a staff held a single voice. Returns null when there is no measure,
  // no notes array, no matching staff, no matching voice, or the first event is
  // empty. Feeds a bar-final slur's look-ahead target.
  function firstHeadOnStaffVoice(measure, staff, voice) {
    if (!measure || !Array.isArray(measure.notes)) return null;
    const staffGroups = walk.groupByStaff(measure.notes);
    let staffMatch = null;
    for (let s = 0; s < staffGroups.length; s++) {
      if (staffGroups[s].staff === staff) {
        staffMatch = staffGroups[s];
        break;
      }
    }
    if (!staffMatch) return null;
    const voiceGroups = walk.groupByVoice(staffMatch.notes);
    let voiceMatch = null;
    for (let v = 0; v < voiceGroups.length; v++) {
      if (voiceGroups[v].voice === voice) {
        voiceMatch = voiceGroups[v];
        break;
      }
    }
    if (!voiceMatch) return null;
    const groups = walk.groupNotes(voiceMatch.notes);
    if (!groups.length || !groups[0].length) return null;
    return groups[0][0];
  }

  // Build the ordered note list for one sequence of notes: groupNotes turns it
  // into events (a chord is one group, so one <li>), and the phrase layer turns
  // each event into its spoken text, with the next event's head note as the slur
  // target. The last event of a bar takes the FOLLOWING bar's first event head on
  // the SAME staff (followingHead) as its slur target, so a bar-final slur names
  // where it goes; within-bar behaviour is unchanged. Used for a single-staff bar
  // and for each hand of a piano bar.
  //
  // Stage 51: each LEAF note item also carries its event's note group on a
  // musicNotes property. It is the model's OWN note objects by reference — the
  // array groupNotes returned, never copied, never mapped and never cloned — so a
  // consumer can recognise a note by identity. A chord item carries every note in
  // the chord; a single note or a rest carries a one-element array. It is a
  // PROPERTY rather than an attribute or a dataset entry because both of those
  // hold a string, and a string cannot carry object identity. Nothing is attached
  // to the measure <li>, the staff <li> or either <ol>: only the leaf note item
  // carries it, and only when the group is a non-empty array. The reference lives
  // and dies with the element, so a re-render (render clears the mount with
  // replaceChildren) drops it with the old items and no cleanup is needed. It
  // exists so play-along can map a schedule entry to its note item by identity
  // rather than by document position; NOTHING reads it yet.
  function noteListOf(notes, followingHead) {
    const noteList = document.createElement("ol");
    const groups = walk.groupNotes(Array.isArray(notes) ? notes : []);
    for (let i = 0; i < groups.length; i++) {
      const noteItem = document.createElement("li");
      const nextHead = groups[i + 1] ? groups[i + 1][0] : (followingHead || null);
      noteItem.textContent = phrase.phraseOf(groups[i], nextHead);

      // The event's own note objects, by reference. Guarded so an empty group
      // leaves the property unset rather than attaching a meaningless array.
      if (Array.isArray(groups[i]) && groups[i].length) {
        noteItem.musicNotes = groups[i];
      }

      noteList.appendChild(noteItem);
    }
    return noteList;
  }

  // Split a bar's flat note list into voiced groups: groupByStaff first, then
  // groupByVoice within each staff, returned as a FLAT array in document order.
  // Each entry carries its staff, its raw voice id, a 1-based voiceOrdinal (the
  // position of that voice WITHIN ITS STAFF, so the Satie's bass voices 5 and 6
  // give ordinals 1 and 2), and staffVoiceCount (how many voices that staff holds
  // in this bar). A MusicXML voice id is an opaque per-part identifier, so the
  // reader-facing number is positional and assigned here, not taken from the id.
  function voicedGroupsOf(notes) {
    const flat = [];
    const staffGroups = walk.groupByStaff(notes);
    for (let s = 0; s < staffGroups.length; s++) {
      const staffGroup = staffGroups[s];
      const voiceGroups = walk.groupByVoice(staffGroup.notes);
      for (let v = 0; v < voiceGroups.length; v++) {
        flat.push({
          staff: staffGroup.staff,
          voice: voiceGroups[v].voice,
          voiceOrdinal: v + 1,
          staffVoiceCount: voiceGroups.length,
          notes: voiceGroups[v].notes,
        });
      }
    }
    return flat;
  }

  // Heading for one voiced group, composed from two optional parts joined by
  // ", ". The staff part appears only in a multi-staff bar (staffCount > 1): the
  // clef named and capitalised plus " staff", e.g. "Treble staff", or "Staff <n>"
  // when the clef is absent or unnamed — byte-identical to the Stage 14 staff
  // heading. The voice part appears only when this staff holds more than one voice
  // (staffVoiceCount > 1): "voice " + the positional ordinal. When the voice part
  // stands alone (a single-staff bar) it is capitalised, so it reads "Voice 1";
  // when only the staff part is present the output does not move.
  function groupHeadingOf(group, model, staffCount) {
    const parts = [];
    if (staffCount > 1) {
      const clefs = model && model.clefs ? model.clefs : {};
      const staff = group.staff;
      const clef = staff !== null && clefs[staff] ? clefs[staff] : null;
      const name = clef ? names.clefName(clef.sign, clef.line) : null;
      if (name) {
        parts.push(name.charAt(0).toUpperCase() + name.slice(1) + " staff");
      } else {
        parts.push("Staff " + (staff === null ? "1" : staff));
      }
    }
    if (group.staffVoiceCount > 1) {
      parts.push("voice " + group.voiceOrdinal);
    }

    // When the voice part is the sole part (single-staff bar), capitalise it so it
    // reads "Voice 1" rather than "voice 1".
    const voiceOnly = staffCount <= 1 && group.staffVoiceCount > 1;
    const heading = parts.join(", ");
    if (voiceOnly) {
      return heading.charAt(0).toUpperCase() + heading.slice(1);
    }
    return heading;
  }

  // The leading bar label for one measure: "Bar <n>", plus any structural marks
  // this bar carries, comma-joined, so a marked bar reads "Bar 4, first-time
  // ending, repeat to bar 1" and a plain bar still reads "Bar 4". The marks read
  // in a natural order: the bar's ending role, then a key or clef change entering
  // it, then the repeat at its end. Extracted from render in Stage 53 so that a
  // merged keyboard bar can reuse the SAME wording and clause order rather than
  // growing a second copy of it; the single-part path is unchanged.
  function barLabelOf(measure) {
    const marks = [];
    if (measure) {
      // The rehearsal mark reads FIRST, right next to the bar number, so someone
      // scanning the bar list hears it where an engraver prints it. The text is
      // the ENGRAVER'S OWN and is carried VERBATIM — not trimmed, not mapped, and
      // with no stripping of a trailing dotted suffix, so the Joplin's "B.1"
      // reads as "B.1". The scaffold wording is composed here rather than in
      // music-names, as "key changes to " and "repeat to bar " already are,
      // because a rehearsal mark is an OPEN set and that module holds only
      // closed-set lookups, which return null for an unmapped value and would
      // therefore drop every real mark. A non-string, empty or whitespace-only
      // value adds no clause and leaves the label exactly as it was.
      if (typeof measure.rehearsal === "string" && measure.rehearsal.trim() !== "") {
        marks.push("rehearsal mark " + measure.rehearsal);
      }
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
    return "Bar " + (measure ? measure.number : "") + (marks.length ? ", " + marks.join(", ") : "");
  }

  // Merge the two parts' measures at one bar index into a single structural
  // measure for the label builder: the FIRST NON-NULL of the two for the bar
  // number and for each field barLabelOf reads. Returns null only when neither
  // part has a measure at that index.
  //
  // Known simplification, deliberately accepted: a mark printed on one hand only
  // is announced WITHOUT saying which hand. The trade is the right way round — a
  // repeat or an ending engraved on the lower part alone is structural for the
  // whole keyboard, and losing it would be far worse than announcing it without
  // attribution. Nothing here reads the notes; only the structural fields merge.
  function mergedMeasureOf(lowerMeasure, upperMeasure) {
    const lower = lowerMeasure || null;
    const upper = upperMeasure || null;
    if (!lower && !upper) return null;
    const firstNonNull = function (field) {
      if (lower && lower[field] !== null && lower[field] !== undefined) return lower[field];
      if (upper && upper[field] !== null && upper[field] !== undefined) return upper[field];
      return null;
    };
    // This list is an EXPLICIT whitelist, not a spread: a new structural field on
    // the model measure must be added here as well, or it is silently dropped on
    // the merged keyboard path while working perfectly on the single-part one.
    // The real Joplin prints all 11 of its rehearsal marks on P1 alone, which is
    // exactly this path, so the omission would hide the whole capability.
    return {
      number: firstNonNull("number"),
      endingStart: firstNonNull("endingStart"),
      endingStop: firstNonNull("endingStop"),
      keyChange: firstNonNull("keyChange"),
      clefChange: firstNonNull("clefChange"),
      repeatTo: firstNonNull("repeatTo"),
      rehearsal: firstNonNull("rehearsal"),
    };
  }

  // Heading for one hand of a merged keyboard bar. This exists rather than reusing
  // groupHeadingOf because the lookup is genuinely different, not merely differently
  // configured: groupHeadingOf reads model.clefs keyed by the NOTE's staff, which is
  // right for ONE part written on two staves, whereas a cross-part keyboard carries
  // its naming clef on the PART and commonly has no staff on any note at all (the
  // Joplin case). Handed the same group, groupHeadingOf would read "Staff 1" for
  // both hands, and would suppress the staff part altogether in a one-group bar.
  //
  // The clef comes from that part's OWN clefs object, keyed by the group's staff
  // coerced to a string, falling back to "1" when the staff is null or undefined.
  // A named clef gives "Treble staff"; otherwise the part's own name, and failing
  // that "Part <id>". A bar in which that part carries more than one voice appends
  // ", voice N" using the positional ordinal — the same wording groupHeadingOf uses.
  function keyboardHandHeadingOf(group, part) {
    const parts = [];
    const clefs = part && part.clefs ? part.clefs : {};
    const staffKey = group.staff === null || group.staff === undefined ? "1" : String(group.staff);
    const clef = clefs[staffKey] ? clefs[staffKey] : null;
    const name = clef ? names.clefName(clef.sign, clef.line) : null;
    if (name) {
      parts.push(name.charAt(0).toUpperCase() + name.slice(1) + " staff");
    } else if (part && part.name) {
      parts.push(part.name);
    } else {
      parts.push("Part " + (part ? part.id : ""));
    }
    if (group.staffVoiceCount > 1) {
      parts.push("voice " + group.voiceOrdinal);
    }
    return parts.join(", ");
  }

  // Render one cross-part keyboard pair as a SINGLE merged block: one <h3> named
  // by the pair, then one <ol> of bars interleaving both parts hand by hand, so a
  // reader hears bar 1 right hand, bar 1 left hand, bar 2 right hand … rather than
  // the whole right-hand part followed by the whole left-hand part. The partner
  // part emits nothing of its own; render skips it.
  //
  // Bars run to the GREATER of the two parts' measure counts, so a part that runs
  // short simply contributes no thread for the bars it does not reach. Threads are
  // emitted in partIndices order, which keyboardPairs sorts ascending, so the lower
  // part's hand always reads first. A bar-final slur takes its look-ahead from THAT
  // PART's own next measure, so a slur never crosses into the other hand.
  function renderKeyboardPair(pair, model, mountEl) {
    const heading = document.createElement("h3");
    heading.textContent = pair.name;
    mountEl.appendChild(heading);

    // The pair's member parts with their measure lists, in partIndices order.
    const members = [];
    for (let i = 0; i < pair.partIndices.length; i++) {
      const part = model.parts[pair.partIndices[i]] || {};
      members.push({ part: part, measures: Array.isArray(part.measures) ? part.measures : [] });
    }

    let barCount = 0;
    for (const member of members) {
      if (member.measures.length > barCount) barCount = member.measures.length;
    }

    // Unequal parts are a real file, not a fault: warn once for the pair, naming
    // both counts, then render the greater count. Logging inside the bar loop
    // would repeat the same line for every bar.
    if (members.length === 2 && members[0].measures.length !== members[1].measures.length) {
      logWarn(
        "Keyboard pair '" + pair.name + "' has parts of unequal length: " +
        members[0].measures.length + " bar(s) and " + members[1].measures.length +
        " bar(s); rendering the greater count"
      );
    }

    const measureList = document.createElement("ol");
    for (let mi = 0; mi < barCount; mi++) {
      const measureItem = document.createElement("li");

      // One merged label per bar, built by the shared label builder so the wording
      // and clause order stay exactly as they are for a single part.
      const lowerMeasure = members[0] ? members[0].measures[mi] || null : null;
      const upperMeasure = members[1] ? members[1].measures[mi] || null : null;
      measureItem.appendChild(document.createTextNode(barLabelOf(mergedMeasureOf(lowerMeasure, upperMeasure))));

      // One <li> per hand thread, both parts' hands under the one bar.
      const handList = document.createElement("ol");
      for (const member of members) {
        const measure = member.measures[mi] || null;
        const nextMeasure = member.measures[mi + 1] || null;
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        const groups = voicedGroupsOf(notes);
        for (let g = 0; g < groups.length; g++) {
          const group = groups[g];
          const handItem = document.createElement("li");
          handItem.appendChild(document.createTextNode(keyboardHandHeadingOf(group, member.part)));
          handItem.appendChild(noteListOf(group.notes, firstHeadOnStaffVoice(nextMeasure, group.staff, group.voice)));
          handList.appendChild(handItem);
        }
      }
      measureItem.appendChild(handList);
      measureList.appendChild(measureItem);
    }
    mountEl.appendChild(measureList);
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

    // Stage 53: the cross-part keyboard pairs, read ONCE per render from the
    // single shared definition. A pair is a grand staff written as two parts, and
    // the two are merged into one block below so the reader hears them bar by bar.
    // A model with no pairs — every single-part score, and every ensemble — takes
    // exactly the same path it took before this stage.
    const pairs = (walk && typeof walk.keyboardPairs === "function") ? walk.keyboardPairs(model) : [];

    // Two lookups keyed by part index: the pair a part is the LOWER member of (so
    // the merged block is emitted at that position), and the set of parts that are
    // the UPPER member of some pair (so they emit nothing, having already been
    // rendered with their partner). A part in neither renders exactly as today.
    const pairByLowerIndex = new Map();
    const upperIndices = new Set();
    for (const pair of pairs) {
      pairByLowerIndex.set(pair.partIndices[0], pair);
      upperIndices.add(pair.partIndices[1]);
    }

    for (let pi = 0; pi < model.parts.length; pi++) {
      const part = model.parts[pi];

      // Upper member: already rendered as part of its pair's merged block.
      if (upperIndices.has(pi)) continue;

      // Lower member: emit the merged keyboard block in this part's position.
      const pair = pairByLowerIndex.get(pi);
      if (pair) {
        renderKeyboardPair(pair, model, mountEl);
        continue;
      }

      // Unpaired part: unchanged from Stage 52 onwards.
      // Part heading: the part name, or "Part <id>" when the name is absent.
      const heading = document.createElement("h3");
      const partName = part && part.name ? part.name : "Part " + (part ? part.id : "");
      heading.textContent = partName;
      mountEl.appendChild(heading);

      // Ordered list of bars, so assistive tech announces each bar's position.
      const measureList = document.createElement("ol");
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (let mi = 0; mi < measures.length; mi++) {
        const measure = measures[mi];
        const nextMeasure = measures[mi + 1] || null;
        const measureItem = document.createElement("li");

        // Leading bar label, then the nested ordered list of notes. The label and
        // its structural marks are built by the shared barLabelOf, which Stage 53
        // extracted verbatim from here so a merged keyboard bar reuses the same
        // wording and clause order.
        measureItem.appendChild(document.createTextNode(barLabelOf(measure)));

        // Split the bar into voiced groups: one per voice within each staff, in
        // document order. A single-staff single-voice bar yields one group, so the
        // note list renders directly as before; a piano bar, or a staff carrying
        // more than one voice, yields one sub-list per group, each under a staff
        // and/or voice heading.
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        const groups = voicedGroupsOf(notes);
        const staffCount = new Set(groups.map((g) => g.staff)).size;
        if (groups.length > 1) {
          const staffList = document.createElement("ol");
          for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const staffItem = document.createElement("li");
            staffItem.appendChild(document.createTextNode(groupHeadingOf(group, model, staffCount)));
            staffItem.appendChild(noteListOf(group.notes, firstHeadOnStaffVoice(nextMeasure, group.staff, group.voice)));
            staffList.appendChild(staffItem);
          }
          measureItem.appendChild(staffList);
        } else {
          const single = groups.length === 1 ? groups[0] : null;
          const singleNotes = single ? single.notes : [];
          const singleFollowing = single ? firstHeadOnStaffVoice(nextMeasure, single.staff, single.voice) : null;
          measureItem.appendChild(noteListOf(singleNotes, singleFollowing));
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

    // Stage 6.2 (backlog M2-02): bar-final slur look-ahead models. A slur that
    // starts on a bar's last event now names the following bar's first event on
    // the SAME staff; a last bar of the part, a rest target, or a different staff
    // keeps it bare; and an unslurred last note is untouched.
    const SLUR_TWO_BAR_MODEL = {
      workTitle: "slur two bar", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: null },
        ] },
        { number: "2", notes: [
          { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", staff: null },
        ] },
      ] }],
    };
    const tempSlurTwoBar = document.createElement("div");
    render(SLUR_TWO_BAR_MODEL, tempSlurTwoBar);
    const slurTwoBarItems = tempSlurTwoBar.querySelectorAll("ol ol > li");
    const slurBar1Last = slurTwoBarItems.length ? slurTwoBarItems[0].textContent.trim() : "";

    const SLUR_WITHIN_BAR_MODEL = {
      workTitle: "slur within bar", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: null },
          { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", staff: null },
        ] },
      ] }],
    };
    const tempSlurWithin = document.createElement("div");
    render(SLUR_WITHIN_BAR_MODEL, tempSlurWithin);
    const slurWithinItems = tempSlurWithin.querySelectorAll("ol ol > li");
    const slurWithinFirst = slurWithinItems.length ? slurWithinItems[0].textContent.trim() : "";

    const SLUR_LAST_BAR_MODEL = {
      workTitle: "slur last bar", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: null },
          { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: null },
        ] },
      ] }],
    };
    const tempSlurLast = document.createElement("div");
    render(SLUR_LAST_BAR_MODEL, tempSlurLast);
    const slurLastItems = tempSlurLast.querySelectorAll("ol ol > li");
    const slurLastText = slurLastItems.length ? slurLastItems[slurLastItems.length - 1].textContent.trim() : "";

    const SLUR_TWO_STAFF_MODEL = {
      workTitle: "slur two staff", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 2,
      clefs: { "1": { sign: "G", line: 2 }, "2": { sign: "F", line: 4 } },
      parts: [{ id: "P1", name: "Piano", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: "1" },
          { rest: false, chord: false, step: "C", octave: 2, duration: 1, type: "quarter", staff: "2" },
        ] },
        { number: "2", notes: [
          { rest: false, chord: false, step: "A", octave: 4, duration: 1, type: "quarter", staff: "1" },
          { rest: false, chord: false, step: "C", octave: 2, duration: 1, type: "quarter", staff: "2" },
        ] },
      ] }],
    };
    const tempSlurTwoStaff = document.createElement("div");
    render(SLUR_TWO_STAFF_MODEL, tempSlurTwoStaff);
    const slurTwoStaffBars = tempSlurTwoStaff.querySelector("ol");
    const slurBar1 = slurTwoStaffBars ? slurTwoStaffBars.querySelector(":scope > li") : null;
    const slurBar1StaffList = slurBar1 ? slurBar1.querySelector(":scope > ol") : null;
    const slurBar1TrebleItem = slurBar1StaffList ? slurBar1StaffList.querySelector(":scope > li") : null;
    const slurTrebleNote = slurBar1TrebleItem ? slurBar1TrebleItem.querySelector("ol > li") : null;
    const slurTrebleText = slurTrebleNote ? slurTrebleNote.textContent.trim() : "";

    const SLUR_REST_TARGET_MODEL = {
      workTitle: "slur rest target", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: null },
        ] },
        { number: "2", notes: [
          { rest: true, chord: false, step: null, octave: null, duration: 1, type: "quarter", staff: null },
        ] },
      ] }],
    };
    const tempSlurRest = document.createElement("div");
    render(SLUR_REST_TARGET_MODEL, tempSlurRest);
    const slurRestItems = tempSlurRest.querySelectorAll("ol ol > li");
    const slurRestBar1Text = slurRestItems.length ? slurRestItems[0].textContent.trim() : "";

    // Stage 7.3 (backlog M1-07): voices within a staff. A single-staff single-voice
    // bar still reads with no heading sub-list; a staff carrying more than one
    // voice splits into headed groups; the reader-facing voice number is positional
    // (voices 5 and 6 read "voice 1" and "voice 2"); and a bar-final slur names the
    // next bar's first note in its OWN voice.

    // Single staff, single voice (voice "1" throughout): no heading sub-list, so
    // the measure's direct child list is the note list, exactly as today.
    const VOICE_SINGLE_MODEL = {
      workTitle: "voice single", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: null, voice: "1" },
        { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", staff: null, voice: "1" },
      ] }] }],
    };
    const tempVoiceSingle = document.createElement("div");
    render(VOICE_SINGLE_MODEL, tempVoiceSingle);
    const voiceSingleMeasure = tempVoiceSingle.querySelector("ol > li");
    const voiceSingleDirectOl = voiceSingleMeasure ? voiceSingleMeasure.querySelector(":scope > ol") : null;
    const voiceSingleFirstItem = voiceSingleDirectOl ? voiceSingleDirectOl.querySelector(":scope > li") : null;

    // One staff, voices "1" and "2": two headed groups reading "Voice 1"/"Voice 2".
    const VOICE_TWO_MODEL = {
      workTitle: "voice two", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: null, voice: "1" },
        { rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter", staff: null, voice: "1" },
        { rest: false, chord: false, step: "G", octave: 3, duration: 1, type: "quarter", staff: null, voice: "2" },
        { rest: false, chord: false, step: "F", octave: 3, duration: 1, type: "quarter", staff: null, voice: "2" },
      ] }] }],
    };
    const tempVoiceTwo = document.createElement("div");
    render(VOICE_TWO_MODEL, tempVoiceTwo);
    const voiceTwoMeasure = tempVoiceTwo.querySelector("ol > li");
    const voiceTwoStaffList = voiceTwoMeasure ? voiceTwoMeasure.querySelector(":scope > ol") : null;
    const voiceTwoItems = voiceTwoStaffList ? voiceTwoStaffList.querySelectorAll(":scope > li") : [];
    const voiceTwoHeading0 = voiceTwoItems[0] && voiceTwoItems[0].firstChild ? voiceTwoItems[0].firstChild.textContent : "";
    const voiceTwoHeading1 = voiceTwoItems[1] && voiceTwoItems[1].firstChild ? voiceTwoItems[1].firstChild.textContent : "";
    const voiceTwoNotes0 = voiceTwoItems[0] ? voiceTwoItems[0].querySelectorAll("ol > li") : [];
    const voiceTwoNotes1 = voiceTwoItems[1] ? voiceTwoItems[1].querySelectorAll("ol > li") : [];

    // A piano bar whose treble holds two voices: "Treble staff, voice 1",
    // "Treble staff, voice 2", "Bass staff".
    const PIANO_SPLIT_MODEL = {
      workTitle: "piano split", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 2,
      clefs: { "1": { sign: "G", line: 2 }, "2": { sign: "F", line: 4 } },
      parts: [{ id: "P1", name: "Piano", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", staff: "1", voice: "1" },
        { rest: false, chord: false, step: "B", octave: 4, duration: 1, type: "quarter", staff: "1", voice: "1" },
        { rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter", staff: "1", voice: "2" },
        { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", staff: "1", voice: "2" },
        { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter", staff: "2", voice: "5" },
        { rest: false, chord: false, step: "D", octave: 3, duration: 1, type: "quarter", staff: "2", voice: "5" },
      ] }] }],
    };
    const tempPianoSplit = document.createElement("div");
    render(PIANO_SPLIT_MODEL, tempPianoSplit);
    const pianoSplitMeasure = tempPianoSplit.querySelector("ol > li");
    const pianoSplitStaffList = pianoSplitMeasure ? pianoSplitMeasure.querySelector(":scope > ol") : null;
    const pianoSplitItems = pianoSplitStaffList ? pianoSplitStaffList.querySelectorAll(":scope > li") : [];
    const pianoSplitH0 = pianoSplitItems[0] && pianoSplitItems[0].firstChild ? pianoSplitItems[0].firstChild.textContent : "";
    const pianoSplitH1 = pianoSplitItems[1] && pianoSplitItems[1].firstChild ? pianoSplitItems[1].firstChild.textContent : "";
    const pianoSplitH2 = pianoSplitItems[2] && pianoSplitItems[2].firstChild ? pianoSplitItems[2].firstChild.textContent : "";

    // A staff (the Satie's bass) holding voices "5" and "6": the reader-facing
    // ordinals are 1 and 2, ignoring the raw ids.
    const VOICE_RAWID_MODEL = {
      workTitle: "voice raw id", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 2,
      clefs: { "1": { sign: "G", line: 2 }, "2": { sign: "F", line: 4 } },
      parts: [{ id: "P1", name: "Piano", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter", staff: "1", voice: "1" },
        { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter", staff: "2", voice: "5" },
        { rest: false, chord: false, step: "E", octave: 3, duration: 1, type: "quarter", staff: "2", voice: "6" },
      ] }] }],
    };
    const tempVoiceRawId = document.createElement("div");
    render(VOICE_RAWID_MODEL, tempVoiceRawId);
    const voiceRawIdMeasure = tempVoiceRawId.querySelector("ol > li");
    const voiceRawIdStaffList = voiceRawIdMeasure ? voiceRawIdMeasure.querySelector(":scope > ol") : null;
    const voiceRawIdItems = voiceRawIdStaffList ? voiceRawIdStaffList.querySelectorAll(":scope > li") : [];
    const voiceRawIdH1 = voiceRawIdItems[1] && voiceRawIdItems[1].firstChild ? voiceRawIdItems[1].firstChild.textContent : "";
    const voiceRawIdH2 = voiceRawIdItems[2] && voiceRawIdItems[2].firstChild ? voiceRawIdItems[2].firstChild.textContent : "";

    // A bar-final slur in voice 2 targets the next bar's voice 2 first note (F4),
    // never voice 1's first note (A5).
    const VOICE_SLUR_MODEL = {
      workTitle: "voice slur", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter", staff: null, voice: "1" },
          { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false }, staff: null, voice: "2" },
        ] },
        { number: "2", notes: [
          { rest: false, chord: false, step: "A", octave: 5, duration: 1, type: "quarter", staff: null, voice: "1" },
          { rest: false, chord: false, step: "F", octave: 4, duration: 1, type: "quarter", staff: null, voice: "2" },
        ] },
      ] }],
    };
    const tempVoiceSlur = document.createElement("div");
    render(VOICE_SLUR_MODEL, tempVoiceSlur);
    const voiceSlurMeasure = tempVoiceSlur.querySelector("ol > li");
    const voiceSlurStaffList = voiceSlurMeasure ? voiceSlurMeasure.querySelector(":scope > ol") : null;
    const voiceSlurItems = voiceSlurStaffList ? voiceSlurStaffList.querySelectorAll(":scope > li") : [];
    const voiceSlurVoice2Notes = voiceSlurItems[1] ? voiceSlurItems[1].querySelectorAll("ol > li") : [];
    const voiceSlurVoice2Last = voiceSlurVoice2Notes.length ? voiceSlurVoice2Notes[voiceSlurVoice2Notes.length - 1].textContent.trim() : "";

    // A rest carrying voice "1" groups with voice 1's notes, not with voice 2 —
    // the Satie's bar shape.
    const VOICE_REST_MODEL = {
      workTitle: "voice rest", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 }, staves: 1,
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: [
        { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", staff: null, voice: "1" },
        { rest: true, chord: false, step: null, octave: null, duration: 1, type: "quarter", staff: null, voice: "1" },
        { rest: false, chord: false, step: "G", octave: 3, duration: 1, type: "quarter", staff: null, voice: "2" },
      ] }] }],
    };
    const tempVoiceRest = document.createElement("div");
    render(VOICE_REST_MODEL, tempVoiceRest);
    const voiceRestMeasure = tempVoiceRest.querySelector("ol > li");
    const voiceRestStaffList = voiceRestMeasure ? voiceRestMeasure.querySelector(":scope > ol") : null;
    const voiceRestItems = voiceRestStaffList ? voiceRestStaffList.querySelectorAll(":scope > li") : [];
    const voiceRestVoice1Notes = voiceRestItems[0] ? voiceRestItems[0].querySelectorAll("ol > li") : [];
    const voiceRestVoice2Notes = voiceRestItems[1] ? voiceRestItems[1].querySelectorAll("ol > li") : [];

    // Stage 51 (musicNotes): the LEAF note items of a rendered mount — every <li>
    // with NO nested <ol>, in document order. This is the same definition
    // play-along uses to walk the note list, so the rows below test the elements
    // that will actually be looked up, not just the ones a ":scope" query reaches.
    const leavesOf = function (root) {
      return Array.from(root.querySelectorAll("li")).filter(function (li) {
        return !li.querySelector("ol");
      });
    };

    // Stage 53 (cross-part keyboard interleave): hand-built braced two-part models
    // in the shape MusicParse.parse() returns for the real Joplin — two parts with
    // EMPTY names and ids P1 and P2, each carrying its OWN clefs object, notes with
    // NO staff value at all, and a partGroups array holding one brace group naming
    // both ids. The empty part names drive keyboardPairs' joined-id name fallback,
    // so the pair reads "Parts P1 and P2".
    const KEYBOARD_MODEL = {
      workTitle: "Accessible Music PoC keyboard pair sample",
      divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      clefs: { "1": { sign: "G", line: 2 } },
      parts: [
        {
          id: "P1", name: "", clefs: { "1": { sign: "G", line: 2 } },
          measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter" }] },
            { number: "2", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "D", octave: 5, duration: 1, type: "quarter" }] },
            { number: "3", clefChange: null, keyChange: null, repeatTo: "1", endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "E", octave: 5, duration: 1, type: "quarter" }] },
          ],
        },
        {
          id: "P2", name: "", clefs: { "1": { sign: "F", line: 4 } },
          measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
            { number: "2", clefChange: null, keyChange: { fifths: 1 }, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "G", octave: 2, duration: 1, type: "quarter" }] },
            { number: "3", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
          ],
        },
      ],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const tempKeyboard = document.createElement("div");
    render(KEYBOARD_MODEL, tempKeyboard);

    // Readers for a merged keyboard mount: its bars, one bar's hand threads, a
    // thread's heading text, a thread's first carried note object, and a bar label.
    const kbBarsOf = function (root) {
      const list = root.querySelector("ol");
      return list ? list.querySelectorAll(":scope > li") : [];
    };
    const kbHandsOf = function (root, bar) {
      const bars = kbBarsOf(root);
      const list = bars[bar] ? bars[bar].querySelector(":scope > ol") : null;
      return list ? list.querySelectorAll(":scope > li") : [];
    };
    const kbHeadingOf = function (root, bar, hand) {
      const hands = kbHandsOf(root, bar);
      return hands[hand] && hands[hand].firstChild ? hands[hand].firstChild.textContent : "";
    };
    const kbFirstNoteOf = function (root, bar, hand) {
      const hands = kbHandsOf(root, bar);
      const leaf = hands[hand] ? hands[hand].querySelector("ol > li") : null;
      return leaf && Array.isArray(leaf.musicNotes) ? leaf.musicNotes[0] : null;
    };
    const kbBarLabelOf = function (root, bar) {
      const bars = kbBarsOf(root);
      return bars[bar] && bars[bar].firstChild ? bars[bar].firstChild.textContent : "";
    };

    // The pair as the shared definition reports it, so the heading row compares the
    // rendered h3 against the live contract rather than against a hard-coded guess.
    const kbPairs = (walk && typeof walk.keyboardPairs === "function") ? walk.keyboardPairs(KEYBOARD_MODEL) : [];
    const kbPairName = kbPairs.length ? kbPairs[0].name : "";
    const kbHeadings = tempKeyboard.querySelectorAll("h3");
    const kbHeadingText = kbHeadings.length ? kbHeadings[0].textContent : "";

    // The same repeat mark on a SINGLE-part bar, so the merged label can be proved
    // identical to today's wording rather than merely plausible.
    const KEYBOARD_SOLO_LABEL_MODEL = {
      workTitle: "keyboard solo label", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "3", clefChange: null, keyChange: null, repeatTo: "1", endingStart: null, endingStop: null,
          notes: [{ rest: false, chord: false, step: "E", octave: 5, duration: 1, type: "quarter" }] },
      ] }],
    };
    const tempKeyboardSolo = document.createElement("div");
    render(KEYBOARD_SOLO_LABEL_MODEL, tempKeyboardSolo);
    const kbSoloRepeatLabel = kbBarLabelOf(tempKeyboardSolo, 0);

    // Parts of unequal length: the lower part runs to three bars, the upper to two.
    const KEYBOARD_UNEQUAL_MODEL = {
      workTitle: "keyboard unequal", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "", clefs: { "1": { sign: "G", line: 2 } }, measures: [
          { number: "1", notes: [{ rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter" }] },
          { number: "2", notes: [{ rest: false, chord: false, step: "D", octave: 5, duration: 1, type: "quarter" }] },
          { number: "3", notes: [{ rest: false, chord: false, step: "E", octave: 5, duration: 1, type: "quarter" }] },
        ] },
        { id: "P2", name: "", clefs: { "1": { sign: "F", line: 4 } }, measures: [
          { number: "1", notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
          { number: "2", notes: [{ rest: false, chord: false, step: "G", octave: 2, duration: 1, type: "quarter" }] },
        ] },
      ],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const tempKeyboardUnequal = document.createElement("div");
    let kbUnequalThrew = false;
    let kbUnequalReturnedTrue = false;
    try {
      kbUnequalReturnedTrue = render(KEYBOARD_UNEQUAL_MODEL, tempKeyboardUnequal) === true;
    } catch (error) {
      kbUnequalThrew = true;
    }

    // A member part whose bar carries two voices: the hand heading appends the
    // positional voice ordinal, exactly as a one-part two-staff bar does.
    const KEYBOARD_VOICE_MODEL = {
      workTitle: "keyboard voices", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "", clefs: { "1": { sign: "G", line: 2 } }, measures: [{ number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter", voice: "1" },
          { rest: false, chord: false, step: "E", octave: 5, duration: 1, type: "quarter", voice: "1" },
          { rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", voice: "2" },
        ] }] },
        { id: "P2", name: "", clefs: { "1": { sign: "F", line: 4 } }, measures: [{ number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter", voice: "5" },
        ] }] },
      ],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const tempKeyboardVoice = document.createElement("div");
    render(KEYBOARD_VOICE_MODEL, tempKeyboardVoice);

    // A member part with no clef of its own falls back to its part name.
    const KEYBOARD_NO_CLEF_MODEL = {
      workTitle: "keyboard no clef", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "Right hand", clefs: {}, measures: [{ number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter" },
        ] }] },
        { id: "P2", name: "Left hand", clefs: { "1": { sign: "F", line: 4 } }, measures: [{ number: "1", notes: [
          { rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" },
        ] }] },
      ],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const tempKeyboardNoClef = document.createElement("div");
    render(KEYBOARD_NO_CLEF_MODEL, tempKeyboardNoClef);

    // A bar-final slur on the lower part must name the LOWER part's next bar (D5),
    // never the upper part's next bar (G2), even though both are in the same bar
    // item now.
    const KEYBOARD_SLUR_MODEL = {
      workTitle: "keyboard slur", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "", clefs: { "1": { sign: "G", line: 2 } }, measures: [
          { number: "1", notes: [{ rest: false, chord: false, step: "G", octave: 4, duration: 1, type: "quarter", slur: { start: true, stop: false } }] },
          { number: "2", notes: [{ rest: false, chord: false, step: "D", octave: 5, duration: 1, type: "quarter" }] },
        ] },
        { id: "P2", name: "", clefs: { "1": { sign: "F", line: 4 } }, measures: [
          { number: "1", notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
          { number: "2", notes: [{ rest: false, chord: false, step: "G", octave: 2, duration: 1, type: "quarter" }] },
        ] },
      ],
      partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
    };
    const tempKeyboardSlur = document.createElement("div");
    render(KEYBOARD_SLUR_MODEL, tempKeyboardSlur);
    const kbSlurHands = kbHandsOf(tempKeyboardSlur, 0);
    const kbSlurTrebleLeaves = kbSlurHands[0] ? kbSlurHands[0].querySelectorAll("ol > li") : [];
    const kbSlurTrebleLast = kbSlurTrebleLeaves.length ? kbSlurTrebleLeaves[kbSlurTrebleLeaves.length - 1].textContent.trim() : "";

    // Regression fixtures: two parts that are NOT a keyboard pair must keep today's
    // one-heading-and-one-bar-list-each output. An empty partGroups array, a
    // bracket group (an ensemble grouping, not a keyboard), and a model with no
    // partGroups field at all.
    const kbTwoPartMeasures = function (step, octave) {
      return [{ number: "1", notes: [{ rest: false, chord: false, step: step, octave: octave, duration: 1, type: "quarter" }] }];
    };
    const TWO_PART_NO_BRACE_MODEL = {
      workTitle: "two parts no brace", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "Flute", clefs: { "1": { sign: "G", line: 2 } }, measures: kbTwoPartMeasures("C", 5) },
        { id: "P2", name: "Bassoon", clefs: { "1": { sign: "F", line: 4 } }, measures: kbTwoPartMeasures("C", 3) },
      ],
      partGroups: [],
    };
    const tempTwoPartNoBrace = document.createElement("div");
    render(TWO_PART_NO_BRACE_MODEL, tempTwoPartNoBrace);

    const BRACKET_TWO_PART_MODEL = {
      workTitle: "bracket two parts", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "Soprano", clefs: { "1": { sign: "G", line: 2 } }, measures: kbTwoPartMeasures("C", 5) },
        { id: "P2", name: "Bass", clefs: { "1": { sign: "F", line: 4 } }, measures: kbTwoPartMeasures("C", 3) },
      ],
      partGroups: [{ number: "1", symbol: "bracket", name: "Choir", partIds: ["P1", "P2"] }],
    };
    const tempBracket = document.createElement("div");
    render(BRACKET_TWO_PART_MODEL, tempBracket);

    const NO_PART_GROUPS_MODEL = {
      workTitle: "no part groups", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [
        { id: "P1", name: "Flute", measures: kbTwoPartMeasures("C", 5) },
        { id: "P2", name: "Bassoon", measures: kbTwoPartMeasures("C", 3) },
      ],
    };
    const tempNoPartGroups = document.createElement("div");
    let kbNoGroupsThrew = false;
    let kbNoGroupsReturnedTrue = false;
    try {
      kbNoGroupsReturnedTrue = render(NO_PART_GROUPS_MODEL, tempNoPartGroups) === true;
    } catch (error) {
      kbNoGroupsThrew = true;
    }

    // Stage 56 (M3-05, rehearsal marks on the bar heading). A single-part model
    // carrying marks, and a CONTROL identical to it in every way except that every
    // rehearsal reads null, so "the label is unchanged when there is no mark" can
    // be proved byte for byte against the pre-Stage-56 wording rather than merely
    // asserted. Bar 3 carries no rehearsal KEY at all, covering the undefined case
    // a model built before Stage 55 would produce. Bar 4 carries a mark alongside
    // every other structural mark, so the clause ORDER is pinned.
    const rehearsalBarsOf = function (rehearsals) {
      return [
        { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          rehearsal: rehearsals[0],
          notes: [{ rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" }] },
        { number: "2", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          rehearsal: rehearsals[1],
          notes: [{ rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter" }] },
        // No rehearsal key at all on bar 3: the pre-Stage-55 model shape.
        { number: "3", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          notes: [{ rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter" }] },
        { number: "4", clefChange: { sign: "F", line: 4 }, keyChange: { fifths: 1 }, repeatTo: "1",
          endingStart: "1", endingStop: "1", rehearsal: rehearsals[3],
          notes: [{ rest: false, chord: false, step: "G", octave: 3, duration: 1, type: "quarter" }] },
      ];
    };
    const rehearsalModelOf = function (rehearsals) {
      return {
        workTitle: "rehearsal marks", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
        parts: [{ id: "P1", name: "Melody", measures: rehearsalBarsOf(rehearsals) }],
      };
    };
    const tempRehearsal = document.createElement("div");
    render(rehearsalModelOf(["A", "B.1", null, "C"]), tempRehearsal);
    const tempRehearsalControl = document.createElement("div");
    render(rehearsalModelOf([null, null, null, null]), tempRehearsalControl);

    // Null, empty string and whitespace-only, each of which must add no clause.
    const REHEARSAL_BLANK_MODEL = {
      workTitle: "rehearsal blanks", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
      parts: [{ id: "P1", name: "Melody", measures: [
        { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          rehearsal: null,
          notes: [{ rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter" }] },
        { number: "2", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          rehearsal: "",
          notes: [{ rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter" }] },
        { number: "3", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
          rehearsal: "   ",
          notes: [{ rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter" }] },
      ] }],
    };
    const tempRehearsalBlank = document.createElement("div");
    render(REHEARSAL_BLANK_MODEL, tempRehearsalBlank);

    // The merged keyboard path, which is where the explicit whitelist bites. Three
    // one-bar braced models: the mark on the LOWER hand only (members[0], the first
    // argument to mergedMeasureOf), on the UPPER hand only (members[1]), and on
    // neither. The Joplin prints every mark on P1 alone, so the lower-only case is
    // the real one; the upper-only case proves the fallback arm of firstNonNull.
    const keyboardRehearsalModelOf = function (lowerMark, upperMark) {
      return {
        workTitle: "keyboard rehearsal", divisions: 1, key: { fifths: 0 }, time: { beats: 4, beatType: 4 },
        clefs: { "1": { sign: "G", line: 2 } },
        parts: [
          { id: "P1", name: "", clefs: { "1": { sign: "G", line: 2 } }, measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              rehearsal: lowerMark,
              notes: [{ rest: false, chord: false, step: "C", octave: 5, duration: 1, type: "quarter" }] },
          ] },
          { id: "P2", name: "", clefs: { "1": { sign: "F", line: 4 } }, measures: [
            { number: "1", clefChange: null, keyChange: null, repeatTo: null, endingStart: null, endingStop: null,
              rehearsal: upperMark,
              notes: [{ rest: false, chord: false, step: "C", octave: 3, duration: 1, type: "quarter" }] },
          ] },
        ],
        partGroups: [{ number: "1", symbol: "brace", name: null, partIds: ["P1", "P2"] }],
      };
    };
    const tempKbRehearsalLower = document.createElement("div");
    render(keyboardRehearsalModelOf("D", null), tempKbRehearsalLower);
    const tempKbRehearsalUpper = document.createElement("div");
    render(keyboardRehearsalModelOf(null, "E"), tempKbRehearsalUpper);
    const tempKbRehearsalNeither = document.createElement("div");
    render(keyboardRehearsalModelOf(null, null), tempKbRehearsalNeither);

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
      slurBarFinalNamesNextBarHead: slurBar1Last === "G4 crotchet, slurred to D4",
      slurWithinBarUnchanged: slurWithinFirst === "C4 crotchet, slurred to D4",
      slurLastBarOfPartStaysBare: slurLastText.endsWith("slurred") && slurLastText.indexOf("slurred to") === -1,
      slurCrossBarStaysOnSameStaff: slurTrebleText === "G4 crotchet, slurred to A4" && slurTrebleText.indexOf("C2") === -1,
      slurCrossBarRestTargetStaysBare: slurRestBar1Text.endsWith("slurred") && slurRestBar1Text.indexOf("slurred to") === -1,
      plainBarsUnchangedByLookAhead: noteItems.length >= 5 && noteItems[4].textContent.trim() === "G4 crotchet",
      voiceSingleVoiceNoHeading: !!voiceSingleFirstItem && voiceSingleFirstItem.textContent === "C4 crotchet",
      voiceOneStaffTwoVoicesHeadings: voiceTwoHeading0 === "Voice 1" && voiceTwoHeading1 === "Voice 2",
      voiceOneStaffTwoVoicesItemsSplit:
        voiceTwoNotes0.length === 2 && voiceTwoNotes0[0].textContent === "C4 crotchet" && voiceTwoNotes0[1].textContent === "E4 crotchet" &&
        voiceTwoNotes1.length === 2 && voiceTwoNotes1[0].textContent === "G3 crotchet" && voiceTwoNotes1[1].textContent === "F3 crotchet",
      voicePianoHeadingsUnchanged: trebleHeading === "Treble staff" && bassHeading === "Bass staff",
      voicePianoSplitTrebleHeadings: pianoSplitH0 === "Treble staff, voice 1" && pianoSplitH1 === "Treble staff, voice 2" && pianoSplitH2 === "Bass staff",
      voiceOrdinalIgnoresRawId: voiceRawIdH1 === "Bass staff, voice 1" && voiceRawIdH2 === "Bass staff, voice 2",
      voiceSlurTargetStaysInVoice: voiceSlurVoice2Last === "C4 crotchet, slurred to F4",
      voiceRestGroupsWithItsVoice: voiceRestVoice1Notes.length === 2 && voiceRestVoice1Notes[1].textContent === "rest crotchet" && voiceRestVoice2Notes.length === 1,
      // Stage 51 (musicNotes): each leaf note item carries its event's note group
      // by reference, so play-along can map a schedule entry to its item by
      // identity rather than by position. Purely additive: no rendered text moves.
      leafItemCarriesMusicNotes: !!noteItems[0] && Array.isArray(noteItems[0].musicNotes),
      musicNotesIsNonEmptyArray: (function () {
        const leaves = leavesOf(temp);
        return leaves.length === 8 && leaves.every(function (li) {
          return Array.isArray(li.musicNotes) && li.musicNotes.length >= 1;
        });
      })(),
      // The head of the first item's group is the SAME OBJECT as the model note it
      // was rendered from, not an equal-looking copy.
      musicNotesHeadIsModelNote:
        !!noteItems[0] && Array.isArray(noteItems[0].musicNotes) &&
        noteItems[0].musicNotes[0] === MODEL.parts[0].measures[0].notes[0],
      // Mutating the model note is visible through the item's group, which a copy
      // could not show. The original value is restored in a finally block so no
      // other row sees the mutation.
      musicNotesNotACopy: (function () {
        const modelNote = MODEL.parts[0].measures[0].notes[0];
        const carried = noteItems[0] ? noteItems[0].musicNotes : null;
        if (!Array.isArray(carried) || !carried.length) return false;
        const original = modelNote.octave;
        try {
          modelNote.octave = original + 1;
          return carried[0].octave === original + 1;
        } finally {
          modelNote.octave = original;
        }
      })(),
      // The chords fixture: the opening triad is ONE item carrying all three of
      // its notes, in the model's order.
      chordItemCarriesWholeChord:
        !!chordItems[0] && Array.isArray(chordItems[0].musicNotes) && chordItems[0].musicNotes.length === 3,
      chordMusicNotesAreTheChordNotes: (function () {
        const carried = chordItems[0] ? chordItems[0].musicNotes : null;
        const modelNotes = CHORDS_MODEL.parts[0].measures[0].notes;
        return Array.isArray(carried) && carried.length === 3 &&
          carried[0] === modelNotes[0] && carried[1] === modelNotes[1] && carried[2] === modelNotes[2];
      })(),
      // A non-chord item (the D4 after the triad) carries exactly its one note.
      singleNoteItemCarriesOne:
        !!chordItems[1] && Array.isArray(chordItems[1].musicNotes) &&
        chordItems[1].musicNotes.length === 1 &&
        chordItems[1].musicNotes[0] === CHORDS_MODEL.parts[0].measures[0].notes[3],
      // A rest is an event too, so its item carries its own rest note object.
      restItemCarriesItsRest:
        !!chordItems[3] && Array.isArray(chordItems[3].musicNotes) &&
        chordItems[3].musicNotes.length === 1 &&
        chordItems[3].musicNotes[0] === CHORDS_MODEL.parts[0].measures[0].notes[6] &&
        chordItems[3].musicNotes[0].rest === true,
      // Structural items carry nothing: neither the bar <li> nor a staff <li>.
      measureItemHasNoMusicNotes: !!measureItems[0] && !("musicNotes" in measureItems[0]),
      staffItemHasNoMusicNotes: !!pianoStaffItems[0] && !("musicNotes" in pianoStaffItems[0]),
      everyPianoLeafCarriesMusicNotes: (function () {
        const leaves = leavesOf(tempPiano);
        return leaves.length === 4 && leaves.every(function (li) {
          return Array.isArray(li.musicNotes) && li.musicNotes.length >= 1;
        });
      })(),
      // Exactly the leaves carry the property: counting every <li> that has it
      // proves no measure or staff item picked it up.
      leafCountMatchesMusicNotesCount: (function () {
        const leaves = leavesOf(tempPiano);
        const carriers = Array.from(tempPiano.querySelectorAll("li")).filter(function (li) {
          return "musicNotes" in li;
        });
        return leaves.length > 0 && leaves.length === carriers.length;
      })(),
      // A hand's items carry only that hand's notes: the treble items are all
      // staff "1" and the bass items all staff "2".
      pianoLeafNotesMatchTheirStaff: (function () {
        const allOn = function (items, staff) {
          if (!items.length) return false;
          return Array.from(items).every(function (li) {
            return Array.isArray(li.musicNotes) && li.musicNotes.length >= 1 &&
              li.musicNotes.every(function (n) { return n.staff === staff; });
          });
        };
        return allOn(trebleNotes, "1") && allOn(bassNotes, "2");
      })(),
      // No note object backs two items: across a whole render each of the piano
      // fixture's six notes appears in exactly one item's group.
      noNoteObjectBacksTwoItems: (function () {
        const leaves = leavesOf(tempPiano);
        const seen = [];
        for (let i = 0; i < leaves.length; i++) {
          const carried = Array.isArray(leaves[i].musicNotes) ? leaves[i].musicNotes : [];
          for (let n = 0; n < carried.length; n++) {
            if (seen.indexOf(carried[n]) !== -1) return false;
            seen.push(carried[n]);
          }
        }
        return seen.length === 6;
      })(),
      // A second render into the same mount replaces the items outright, so the
      // fresh items carry the property and the first render's items are gone —
      // replaceChildren drops the references with the elements, no cleanup needed.
      rerenderCarriesFreshMusicNotes: (function () {
        const twice = document.createElement("div");
        render(MODEL, twice);
        const first = leavesOf(twice);
        const firstHead = first.length ? first[0] : null;
        render(MODEL, twice);
        const second = leavesOf(twice);
        return !!firstHead && second.length === first.length &&
          second.indexOf(firstHead) === -1 &&
          second.every(function (li) {
            return Array.isArray(li.musicNotes) && li.musicNotes.length >= 1;
          });
      })(),
      // Spot check that the property changed no rendered text: the same expected
      // strings firstNoteText and pianoTrebleChordFirst already assert.
      renderedTextUnchangedByProperty:
        firstNote === "C4 crotchet" &&
        !!trebleNotes[0] && trebleNotes[0].textContent === "G4, B4 and D5 crotchet",
      // Stage 53 (cross-part keyboard interleave): a braced two-part keyboard now
      // renders as ONE merged block, bar by bar, both hands under each bar.
      keyboardOneHeadingForPair: kbHeadings.length === 1,
      keyboardHeadingIsPairName: kbPairName === "Parts P1 and P2" && kbHeadingText === kbPairName,
      keyboardOneBarListForPair: tempKeyboard.querySelectorAll(":scope > ol").length === 1,
      keyboardBarCountIsGreater: kbBarsOf(tempKeyboard).length === 3,
      keyboardBarOneHasBothHands: kbHandsOf(tempKeyboard, 0).length === 2,
      keyboardLowerPartHandReadsFirst:
        kbFirstNoteOf(tempKeyboard, 0, 0) === KEYBOARD_MODEL.parts[0].measures[0].notes[0],
      keyboardTrebleHeadingFromPart: kbHeadingOf(tempKeyboard, 0, 0) === "Treble staff",
      keyboardBassHeadingFromPart: kbHeadingOf(tempKeyboard, 0, 1) === "Bass staff",
      // Bar order, not part order: bar 1 already holds the UPPER part's bar-1 note,
      // and bar 2 holds both parts' bar-2 notes. A part-ordered render could not.
      keyboardBarsInterleaved:
        kbFirstNoteOf(tempKeyboard, 0, 1) === KEYBOARD_MODEL.parts[1].measures[0].notes[0] &&
        kbFirstNoteOf(tempKeyboard, 1, 0) === KEYBOARD_MODEL.parts[0].measures[1].notes[0] &&
        kbFirstNoteOf(tempKeyboard, 1, 1) === KEYBOARD_MODEL.parts[1].measures[1].notes[0],
      // The key change is on the UPPER part's bar 2 only, and still reaches the
      // merged label.
      keyboardBarLabelMergesMarks: kbBarLabelOf(tempKeyboard, 1) === "Bar 2, key changes to G major",
      // The repeat is on the LOWER part's bar 3, and the merged label reads exactly
      // as the same mark reads on a single-part bar today.
      keyboardBarLabelKeepsWording:
        kbSoloRepeatLabel === "Bar 3, repeat to bar 1" &&
        kbBarLabelOf(tempKeyboard, 2) === kbSoloRepeatLabel,
      keyboardUnequalBarsStillRender:
        !kbUnequalThrew && kbUnequalReturnedTrue && kbBarsOf(tempKeyboardUnequal).length === 3,
      keyboardShortPartContributesNone:
        kbHandsOf(tempKeyboardUnequal, 2).length === 1 &&
        kbHeadingOf(tempKeyboardUnequal, 2, 0) === "Treble staff",
      keyboardVoiceAppendedWhenSplit:
        kbHeadingOf(tempKeyboardVoice, 0, 0) === "Treble staff, voice 1" &&
        kbHeadingOf(tempKeyboardVoice, 0, 1) === "Treble staff, voice 2" &&
        kbHeadingOf(tempKeyboardVoice, 0, 2) === "Bass staff",
      // The Joplin case: no note carries a staff at all, and both hands are still
      // named from their own part's clef.
      keyboardNoStaffStillNamed:
        !("staff" in KEYBOARD_MODEL.parts[0].measures[0].notes[0]) &&
        !("staff" in KEYBOARD_MODEL.parts[1].measures[0].notes[0]) &&
        kbHeadingOf(tempKeyboard, 0, 0) === "Treble staff" &&
        kbHeadingOf(tempKeyboard, 0, 1) === "Bass staff",
      keyboardHeadingFallsBackToName:
        kbHeadingOf(tempKeyboardNoClef, 0, 0) === "Right hand" &&
        kbHeadingOf(tempKeyboardNoClef, 0, 1) === "Bass staff",
      keyboardSlurStaysInItsPart:
        kbSlurTrebleLast === "G4 crotchet, slurred to D5" && kbSlurTrebleLast.indexOf("G2") === -1,
      keyboardLeavesCarryMusicNotes: (function () {
        const leaves = leavesOf(tempKeyboard);
        return leaves.length === 6 && leaves.every(function (li) {
          return Array.isArray(li.musicNotes) && li.musicNotes.length >= 1;
        });
      })(),
      keyboardNoNoteBacksTwoItems: (function () {
        const leaves = leavesOf(tempKeyboard);
        const seen = [];
        for (let i = 0; i < leaves.length; i++) {
          const carried = Array.isArray(leaves[i].musicNotes) ? leaves[i].musicNotes : [];
          for (let n = 0; n < carried.length; n++) {
            if (seen.indexOf(carried[n]) !== -1) return false;
            seen.push(carried[n]);
          }
        }
        return seen.length === 6;
      })(),
      keyboardStructuralItemsBare: (function () {
        const bars = kbBarsOf(tempKeyboard);
        const hands = kbHandsOf(tempKeyboard, 0);
        if (!bars.length || !hands.length) return false;
        const bare = function (items) {
          return Array.from(items).every(function (li) { return !("musicNotes" in li); });
        };
        return bare(bars) && bare(hands);
      })(),
      // Stage 53 regressions: everything that is NOT a braced keyboard pair keeps
      // the output it had before this stage.
      unpairedTwoPartsStillSeparate:
        tempTwoPartNoBrace.querySelectorAll("h3").length === 2 &&
        tempTwoPartNoBrace.querySelectorAll(":scope > ol").length === 2,
      bracketGroupStillSeparate:
        tempBracket.querySelectorAll("h3").length === 2 &&
        tempBracket.querySelectorAll(":scope > ol").length === 2,
      onePartTwoStavesUnchanged:
        tempPiano.querySelectorAll("h3").length === 1 &&
        pianoStaffItems.length === 2 && trebleHeading === "Treble staff" && bassHeading === "Bass staff" &&
        leavesOf(tempPiano).length === 4,
      singlePartUnchangedByPairs:
        headings.length === 1 && measureItems.length === 2 && noteItems.length === 8 &&
        firstNote === "C4 crotchet",
      modelWithoutPartGroupsRenders:
        !kbNoGroupsThrew && kbNoGroupsReturnedTrue &&
        tempNoPartGroups.querySelectorAll("h3").length === 2 &&
        tempNoPartGroups.querySelectorAll(":scope > ol").length === 2,
      // Stage 56: the rehearsal mark on the bar heading, completing M3-05.
      rehearsalBarLabelSingleMark:
        kbBarLabelOf(tempRehearsal, 0) === "Bar 1, rehearsal mark A",
      rehearsalBarLabelDottedVerbatim:
        kbBarLabelOf(tempRehearsal, 1) === "Bar 2, rehearsal mark B.1",
      // Clause ORDER: the mark reads first, then the existing clauses in their
      // existing order (ending, key change, clef change, repeat).
      rehearsalClauseReadsFirstThenExistingOrder:
        kbBarLabelOf(tempRehearsal, 3) ===
        "Bar 4, rehearsal mark C, first-time ending, key changes to G major, clef changes to bass, repeat to bar 1",
      rehearsalAbsentKeyLabelUnchanged: kbBarLabelOf(tempRehearsal, 2) === "Bar 3",
      // The control model proves the no-mark wording is byte-identical to today's.
      rehearsalControlLabelsByteIdentical:
        kbBarLabelOf(tempRehearsalControl, 0) === "Bar 1" &&
        kbBarLabelOf(tempRehearsalControl, 1) === "Bar 2" &&
        kbBarLabelOf(tempRehearsalControl, 2) === "Bar 3" &&
        kbBarLabelOf(tempRehearsalControl, 3) ===
          "Bar 4, first-time ending, key changes to G major, clef changes to bass, repeat to bar 1",
      rehearsalNullAddsNoClause: kbBarLabelOf(tempRehearsalBlank, 0) === "Bar 1",
      rehearsalEmptyStringAddsNoClause: kbBarLabelOf(tempRehearsalBlank, 1) === "Bar 2",
      rehearsalWhitespaceOnlyAddsNoClause: kbBarLabelOf(tempRehearsalBlank, 2) === "Bar 3",
      // The merged keyboard path, where the explicit whitelist would drop it.
      rehearsalMergedFromLowerHandOnly:
        kbBarLabelOf(tempKbRehearsalLower, 0) === "Bar 1, rehearsal mark D",
      rehearsalMergedFromUpperHandOnly:
        kbBarLabelOf(tempKbRehearsalUpper, 0) === "Bar 1, rehearsal mark E",
      rehearsalMergedNeitherHandUnchanged:
        kbBarLabelOf(tempKbRehearsalNeither, 0) === "Bar 1",
      // The clause is label-only: the leaf note items and their count are untouched.
      rehearsalLeafItemsUnchangedByClause:
        leavesOf(tempRehearsal).length === leavesOf(tempRehearsalControl).length &&
        leavesOf(tempRehearsal).length === 4 &&
        leavesOf(tempRehearsal)[0].textContent === leavesOf(tempRehearsalControl)[0].textContent,
      rehearsalMergedLeafItemsUnchangedByClause:
        leavesOf(tempKbRehearsalLower).length === leavesOf(tempKbRehearsalNeither).length &&
        leavesOf(tempKbRehearsalLower).length === 2 &&
        leavesOf(tempKbRehearsalLower)[0].textContent ===
          leavesOf(tempKbRehearsalNeither)[0].textContent,
    };

    console.table(results);
    return results;
  }

  return { render, selfTest };
})();

window.MusicRenderText = MusicRenderText;
