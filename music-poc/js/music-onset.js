// music-onset.js
// Shared-clock timeline builder for the Accessible Music proof of concept.
//
// A PURE DATA SERVICE: it operates only on the plain model object that
// MusicParse.parse() returns (with per-note onsets added in Stage 33). It never
// parses anything itself, never throws, never notifies, and never touches the
// page DOM or window. Its one job is to align bar N of every part on a single
// shared clock and flatten the result into one sorted timeline of events, so a
// later play-along layer can drive every part from the same running quarter
// count. Chord grouping is delegated to MusicModelWalk.groupNotes — the single
// definition of a chord event — so the timeline never re-implements it and
// cannot drift. Runs under node for its self-test, so it reads its dependencies
// through globalThis and exposes itself as globalThis.MusicOnset.

const MusicOnset = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Warn at most once per session that the chord grouper is absent, so the
  // fallback (one note per group) does not spam the log. Production always has
  // MusicModelWalk; the fallback only serves the node self-test's alignment rows.
  let warnedNoWalk = false;

  // contentLength(measure): pure. The bar-width contribution of one measure —
  // the furthest point any of its notes reaches, as onset + duration in
  // divisions — or 0 when the measure has no notes. Deriving each bar's width
  // from the music itself handles pickups, metre changes and a short final bar
  // without needing the time signature, as long as at least one part fills it.
  function contentLength(measure) {
    const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
    let longest = 0;
    for (const note of notes) {
      const n = note || {};
      const onset = typeof n.onset === "number" ? n.onset : 0;
      const reach = onset + (n.duration || 0);
      if (reach > longest) longest = reach;
    }
    return longest;
  }

  // eventsWithOnset(model): pure; NEVER throws. Aligns bar N of every part on one
  // shared clock and returns the flat timeline as { events, totalQuarters }. A
  // null or partless model returns { events: [], totalQuarters: 0 }.
  function eventsWithOnset(model) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    if (parts.length === 0) return { events: [], totalQuarters: 0 };

    // Resolve the chord grouper once. Production has MusicModelWalk.groupNotes;
    // without it, fall back to one note per group (chords will not be merged).
    const walk = globalThis.MusicModelWalk;
    const groupNotes = walk && typeof walk.groupNotes === "function"
      ? walk.groupNotes
      : (notes) => (notes || []).map((n) => [n]);
    if (!(walk && typeof walk.groupNotes === "function") && !warnedNoWalk) {
      logWarn("eventsWithOnset: MusicModelWalk absent, chords will not be merged");
      warnedNoWalk = true;
    }

    const divisions = m.divisions || 1;

    // Bar count = the greatest measures.length across all parts, so a part with
    // fewer bars still lines up with the longest part on the shared clock.
    let barCount = 0;
    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      if (measures.length > barCount) barCount = measures.length;
    }

    // Each bar's width is the greatest content length across every part's
    // measure at that index; barStart is the running sum of prior bar widths,
    // and totalDivisions the full sum. This is the shared clock.
    const barStart = new Array(barCount);
    let totalDivisions = 0;
    for (let b = 0; b < barCount; b++) {
      let width = 0;
      for (const part of parts) {
        const measures = part && Array.isArray(part.measures) ? part.measures : [];
        const len = measures[b] ? contentLength(measures[b]) : 0;
        if (len > width) width = len;
      }
      barStart[b] = totalDivisions;
      totalDivisions += width;
    }

    // Emit one event per chord group in every measure of every part, placing the
    // group at its bar's start plus the head note's onset within the bar. The
    // group's notes are kept BY REFERENCE for play-along.
    const events = [];

    // seq is the event's position in document order — the order the note list is
    // built in, from the same parts, measures and groupNotes walk. Assigned here,
    // before the onset sort, so it travels with each event and a consumer can map
    // an onset-sorted event back to its note-list item by index, without walking
    // the model and without relying on object identity.
    let seq = 0;
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (let b = 0; b < measures.length; b++) {
        const measure = measures[b];
        const groups = groupNotes(measure ? measure.notes : []);
        for (const group of groups) {
          const head = group[0] || {};
          const headOnset = typeof head.onset === "number" ? head.onset : 0;
          const onsetDivisions = barStart[b] + headOnset;
          const durationDivisions = head.duration || 0;
          events.push({
            seq: seq,
            partIndex: p,
            staff: head.staff === undefined ? null : head.staff,
            barIndex: b,
            barNumber: measure ? measure.number : null,
            onsetDivisions: onsetDivisions,
            startQuarters: onsetDivisions / divisions,
            durationDivisions: durationDivisions,
            durationQuarters: durationDivisions / divisions,
            rest: head.rest === true,
            notes: group,
          });
          seq += 1;
        }
      }
    }

    // Sort by onsetDivisions, then partIndex, then staff, so the timeline reads
    // as a stable shared clock. staff can be null or a string; a neutral key
    // orders them consistently without throwing.
    const staffKey = (s) => (s === null || s === undefined ? "" : String(s));
    events.sort((a, b) => {
      if (a.onsetDivisions !== b.onsetDivisions) return a.onsetDivisions - b.onsetDivisions;
      if (a.partIndex !== b.partIndex) return a.partIndex - b.partIndex;
      const ka = staffKey(a.staff);
      const kb = staffKey(b.staff);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    return { events: events, totalQuarters: totalDivisions / divisions };
  }

  // Self-test: synchronous and self-contained; node-runnable. Because the real
  // groupNotes cannot load under node (it references window at load), install a
  // faithful local double on globalThis.MusicModelWalk for the chord rows, save
  // and restore any existing value. console.table()s and returns the results.
  function selfTest() {
    // Local double: group consecutive chord-flagged notes BY REFERENCE, matching
    // MusicModelWalk.groupNotes. A leading chord note still starts its own group.
    function localGroupNotes(notes) {
      const list = Array.isArray(notes) ? notes : [];
      const groups = [];
      for (const note of list) {
        const n = note || {};
        if (n.chord === true && groups.length > 0) {
          groups[groups.length - 1].push(n);
        } else {
          groups.push([n]);
        }
      }
      return groups;
    }

    // A single-part model of three full bars (divisions 1, each bar 4 wide), so
    // content-based bar width places bar 3 at absolute onset 8.
    function fullBar(number, base) {
      return {
        number: number,
        notes: [
          { rest: false, step: "C", octave: 4, duration: 2, type: "half", chord: false, staff: null, onset: 0 },
          { rest: false, step: "D", octave: 4, duration: 2, type: "half", chord: false, staff: null, onset: 2 },
        ],
      };
    }
    const threeBarModel = { divisions: 1, parts: [{ id: "P1", name: "M", measures: [fullBar("1"), fullBar("2"), fullBar("3")] }] };

    // Four parts, each six bars of eight quarters (divisions 1), so bar 4
    // (index 3) starts at 24 and the whole timeline is 48 quarters.
    function eightBar(number) {
      return { number: number, notes: [{ rest: false, step: "C", octave: 4, duration: 8, type: "whole", chord: false, staff: null, onset: 0 }] };
    }
    function sixBarPart(id) {
      return { id: id, name: id, measures: ["1", "2", "3", "4", "5", "6"].map(eightBar) };
    }
    const fourPartModel = { divisions: 1, parts: [sixBarPart("P1"), sixBarPart("P2"), sixBarPart("P3"), sixBarPart("P4")] };

    // A two-staff single-part bar: staff-1 notes then a staff-2 note whose onset
    // is 0 (a backup rewound the cursor), so the staves overlap at the bar start.
    const twoStaffModel = {
      divisions: 1,
      parts: [{ id: "P1", name: "Piano", measures: [{ number: "1", notes: [
        { rest: false, step: "C", octave: 5, duration: 2, type: "half", chord: false, staff: "1", onset: 0 },
        { rest: false, step: "D", octave: 5, duration: 2, type: "half", chord: false, staff: "1", onset: 2 },
        { rest: false, step: "C", octave: 3, duration: 4, type: "whole", chord: false, staff: "2", onset: 0 },
      ] }] }],
    };

    // A triad (three notes sharing onset 0) then a non-chord note at onset 1,
    // for the chord-merge row (needs the groupNotes double installed).
    const triadModel = {
      divisions: 1,
      parts: [{ id: "P1", name: "M", measures: [{ number: "1", notes: [
        { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", chord: false, staff: null, onset: 0 },
        { rest: false, step: "E", octave: 4, duration: 1, type: "quarter", chord: true, staff: null, onset: 0 },
        { rest: false, step: "G", octave: 4, duration: 1, type: "quarter", chord: true, staff: null, onset: 0 },
        { rest: false, step: "A", octave: 4, duration: 1, type: "quarter", chord: false, staff: null, onset: 1 },
      ] }] }],
    };

    // divisions 480 with an onset of 1920, so startQuarters is 4.0.
    const divisionsModel = {
      divisions: 480,
      parts: [{ id: "P1", name: "M", measures: [{ number: "1", notes: [
        { rest: false, step: "C", octave: 4, duration: 480, type: "quarter", chord: false, staff: null, onset: 1920 },
      ] }] }],
    };

    // Two parts whose document order differs from onset order: part 1's bar 1
    // opens late (onset 2), so part 2's bar 1 at onset 0 sorts ahead of it, and
    // part 1's bar 2 (onset 4) sorts behind it. Document order is P1 bar 1
    // (seq 0), P1 bar 2 (seq 1), P2 bar 1 (seq 2); onset order is seq 2, 0, 1.
    const docOrderModel = {
      divisions: 1,
      parts: [
        { id: "P1", name: "Upper", measures: [
          { number: "1", notes: [{ rest: false, step: "C", octave: 4, duration: 2, type: "half", chord: false, staff: null, onset: 2 }] },
          { number: "2", notes: [{ rest: false, step: "D", octave: 4, duration: 4, type: "whole", chord: false, staff: null, onset: 0 }] },
        ] },
        { id: "P2", name: "Lower", measures: [
          { number: "1", notes: [{ rest: false, step: "G", octave: 3, duration: 4, type: "whole", chord: false, staff: null, onset: 0 }] },
        ] },
      ],
    };

    // Install the chord grouper double for the chord and triad-dependent rows.
    const savedWalk = globalThis.MusicModelWalk;
    globalThis.MusicModelWalk = { groupNotes: localGroupNotes };

    let threeBar;
    let fourPart;
    let twoStaff;
    let triad;
    let divisionsRes;
    let docOrder;
    try {
      threeBar = eventsWithOnset(threeBarModel);
      fourPart = eventsWithOnset(fourPartModel);
      twoStaff = eventsWithOnset(twoStaffModel);
      triad = eventsWithOnset(triadModel);
      divisionsRes = eventsWithOnset(divisionsModel);
      docOrder = eventsWithOnset(docOrderModel);
    } finally {
      globalThis.MusicModelWalk = savedWalk;
    }

    // Timeline helpers for the assertions.
    const bar3Event = threeBar.events.find((e) => e.barIndex === 2);
    const fourPartBar4 = fourPart.events.filter((e) => e.barIndex === 3);
    const twoStaff1 = twoStaff.events.find((e) => e.staff === "1");
    const twoStaff2 = twoStaff.events.find((e) => e.staff === "2");
    const triadHead = triad.events[0];
    const isSorted = (evs) => evs.every((e, i) => i === 0 || evs[i - 1].onsetDivisions <= e.onsetDivisions);

    // seq helpers: every event carries a numeric seq, and a result's seq values
    // are exactly 0..n-1 — collected, sorted numerically, compared to the range.
    const allResults = [threeBar, fourPart, twoStaff, triad, divisionsRes, docOrder];
    const allNumericSeq = (evs) => evs.every((e) => typeof e.seq === "number");
    const seqIsFullRange = (evs) => {
      const seqs = evs.map((e) => e.seq).sort((a, b) => a - b);
      return seqs.length === evs.length && seqs.every((s, i) => s === i);
    };
    const docOrderSeq0 = docOrder.events.find((e) => e.seq === 0);

    const results = {
      hasEventsWithOnset: typeof eventsWithOnset === "function",
      hasSelfTest: typeof selfTest === "function",
      nullModelEmpty: (function () {
        const r = eventsWithOnset(null);
        return r.events.length === 0 && r.totalQuarters === 0;
      })(),
      partlessModelEmpty: (function () {
        const r = eventsWithOnset({ divisions: 4 });
        return r.events.length === 0 && r.totalQuarters === 0;
      })(),
      contentBasedBar3Onset: !!bar3Event && bar3Event.onsetDivisions === 8 && bar3Event.startQuarters === 8,
      contentBasedTotalQuarters: threeBar.totalQuarters === 12,
      crossPartBar4StartsAt24: fourPartBar4.length === 4 && fourPartBar4.every((e) => e.startQuarters === 24),
      crossPartTotalQuarters: fourPart.totalQuarters === 48,
      crossPartNotConcatenated: fourPart.totalQuarters * 4 === 192,
      twoStaffSharesBarStart:
        !!twoStaff1 && !!twoStaff2 && twoStaff1.onsetDivisions === 0 && twoStaff2.onsetDivisions === 0,
      triadIsOneEventOfThree: !!triadHead && triadHead.notes.length === 3 && triadHead.onsetDivisions === 0,
      triadNextNoteSeparateLater: triad.events.length === 2 && triad.events[1].onsetDivisions === 1 && triad.events[1].notes.length === 1,
      triadNotesByReference: !!triadHead && triadHead.notes[1].step === "E" && triadHead.notes[1].chord === true,
      divisionsConversionQuarters: (function () {
        const e = divisionsRes.events[0];
        return !!e && e.startQuarters === 4.0 && e.onsetDivisions === 1920;
      })(),
      eventsSortedThreeBar: isSorted(threeBar.events),
      eventsSortedFourPart: isSorted(fourPart.events),
      everyEventHasNumericSeq: allResults.every((r) => allNumericSeq(r.events)),
      seqIsFullRangeNoGapsOrRepeats: allResults.every((r) => seqIsFullRange(r.events)),
      seqZeroIsFirstDocumentEvent:
        !!docOrderSeq0 &&
        docOrderSeq0.partIndex === 0 &&
        docOrderSeq0.barIndex === 0 &&
        docOrderSeq0.notes[0].step === "C",
      seqRecordsDocumentNotOnsetOrder: docOrder.events[0].seq === 2 && docOrder.events.map((e) => e.seq).join() === "2,0,1",
      singlePartSeqMatchesPlainWalk: (function () {
        // Repeat the plain parts-measures-groupNotes walk that render-text builds
        // the note list from, and confirm each group's head note carries the seq
        // matching its position in that walk.
        const expected = [];
        for (const part of threeBarModel.parts) {
          for (const measure of part.measures) {
            for (const group of localGroupNotes(measure.notes)) expected.push(group[0]);
          }
        }
        if (expected.length !== threeBar.events.length) return false;
        return expected.every((head, i) => {
          const ev = threeBar.events.find((e) => e.notes[0] === head);
          return !!ev && ev.seq === i;
        });
      })(),
      walkRestoredAfterTest: globalThis.MusicModelWalk === savedWalk,
    };

    console.table(results);
    return results;
  }

  return { eventsWithOnset, selfTest };
})();

globalThis.MusicOnset = MusicOnset;
