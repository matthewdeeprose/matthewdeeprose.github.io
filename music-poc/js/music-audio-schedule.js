// music-audio-schedule.js
// Audio-scheduling maths for the Accessible Music proof of concept.
//
// A PURE DATA SERVICE: it turns the plain model object that MusicParse.parse()
// returns into a flat, time-stamped schedule of frequencies and durations. It
// has no Web Audio and no DOM — it only does the pitch and timing arithmetic
// that a later player (js/music-audio.js) will feed into the Web Audio API. It
// never parses anything itself, never throws, never notifies, and returns null
// or a neutral value on bad input. The pitch mapping here is the single source
// of truth: Stage 6 (MIDI) will reuse pitchToMidi. Exposed as
// window.MusicAudioSchedule.

const MusicAudioSchedule = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Default tempo in beats per minute. The sample carries no tempo and the
  // parser does not read one until Stage 9, so this is the only tempo source.
  const DEFAULT_BPM = 90;

  // Concert pitch reference: A4 = 440 Hz, which is MIDI note 69.
  const A4_FREQUENCY = 440;
  const A4_MIDI = 69;

  // Natural diatonic semitone offsets from C within an octave. The model
  // carries note.alter since Phase 3, and the pitch mapping applies it (see
  // pitchToMidi) so accidentals sound at true pitch; this table holds only the
  // seven naturals and the alter is added on top.
  const STEP_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // pitchToMidi(step, octave, alter): pure; NEVER throws. Maps a diatonic pitch
  // to its MIDI note number (12 * (octave + 1) + semitone offset + alter), so
  // C4 -> 60 and A4 -> 69. The optional alter is the accidental in semitones
  // (-1 flat, +1 sharp, 0 natural); a null or omitted alter is coerced to 0, so
  // an omitted third argument gives today's natural result. B flat (alter -1)
  // returns one below the natural B, F sharp (alter 1) one above the natural F.
  // Returns null when the step is unrecognised or the octave is not a finite
  // number. Single source of pitch mapping.
  function pitchToMidi(step, octave, alter) {
    const offset = STEP_SEMITONES[step];
    if (offset === undefined) return null;
    const oct = Number(octave);
    if (!isFinite(oct)) return null;
    const a = alter || 0;
    return 12 * (oct + 1) + offset + a;
  }

  // frequencyOf(step, octave, alter): pure; NEVER throws. Equal temperament from
  // A4 = 440 Hz: 440 * 2 ** ((midi - 69) / 12). So A4 is exactly 440 and C4 is
  // about 261.63. The optional alter is forwarded to pitchToMidi so a flat
  // sounds lower and a sharp higher; an omitted alter gives today's natural
  // result. Returns null whenever pitchToMidi returns null.
  function frequencyOf(step, octave, alter) {
    const midi = pitchToMidi(step, octave, alter);
    if (midi === null) return null;
    return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  // buildSchedule(model, bpm): pure; NEVER throws. Reads music-onset's
  // shared-clock timeline (MusicOnset.eventsWithOnset) rather than walking parts
  // and measures on its own running clock, so simultaneous voices and aligned
  // parts share start times: a two-voice bar sounds its true length and parts N
  // bars long play together, not in series. It produces ONE flat array with an
  // entry for EVERY timeline event (a chord is one entry, rests included), and
  // the array is ordered BY START TIME (the timeline is sorted), not by document
  // order. Each entry is
  //   { frequency, frequencies, startSeconds, durationSeconds, isRest, notes, seq }
  // where frequency is the event's first pitch (kept for one-pitch consumers) and
  // frequencies holds the whole chord. notes is the group's note objects, carried
  // by reference straight from music-onset (never copied or mapped), so play-along
  // can map an entry back to its note-list item by identity now that the schedule
  // is sorted by start time and position no longer lines up. seq is the event's
  // note-list document-order position, copied straight from music-onset's
  // event.seq, so play-along maps an entry to noteItems[seq] directly without
  // walking the model. bpm defaults to 90 when omitted or not a positive number.
  // Returns [] for a null/partless model or when the onset layer is absent.
  function buildSchedule(model, bpm) {
    const tempo = typeof bpm === "number" && isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const secondsPerQuarter = 60 / tempo;

    // The shared clock lives in music-onset: it aligns bar N of every part and
    // returns each event already placed in quarters on one running clock. If that
    // layer is absent we cannot place events on the shared clock, so warn once and
    // return an empty schedule — never throw.
    const hasOnset = !!(globalThis.MusicOnset && globalThis.MusicOnset.eventsWithOnset);
    const timeline = hasOnset ? globalThis.MusicOnset.eventsWithOnset(model) : { events: [] };
    if (!hasOnset) {
      logWarn("buildSchedule: MusicOnset absent, returning empty schedule");
    }

    const events = Array.isArray(timeline.events) ? timeline.events : [];
    const schedule = [];

    for (const event of events) {
      // startSeconds and durationSeconds come straight from the timeline's
      // shared-clock quarter counts — no running clock is accumulated here.
      const startSeconds = event.startQuarters * secondsPerQuarter;
      const durationSeconds = event.durationQuarters * secondsPerQuarter;
      const isRest = event.rest === true;

      // Every pitched note in the event contributes a frequency; rests and notes
      // missing step/octave contribute none. Each note in a chord carries its own
      // alter, so pass each note's own value; frequencyOf coerces a null/absent
      // alter to natural.
      const frequencies = [];
      if (!isRest) {
        const notes = Array.isArray(event.notes) ? event.notes : [];
        for (const note of notes) {
          const f = frequencyOf(note.step, note.octave, note.alter);
          if (typeof f === "number" && isFinite(f)) frequencies.push(f);
        }
      }
      // frequency (singular) is the event's first pitch, kept so existing
      // consumers and tests that read one frequency still work; frequencies
      // carries the whole chord.
      const frequency = frequencies.length ? frequencies[0] : null;

      // notes is the group's note objects by reference (the same array music-onset
      // carries as event.notes), so a later play-along stage can map this entry to
      // its note-list item by identity rather than by position. seq is the event's
      // document-order position, copied from the timeline so play-along can index
      // the note list directly.
      schedule.push({
        frequency: frequency,
        frequencies: frequencies,
        startSeconds: startSeconds,
        durationSeconds: durationSeconds,
        isRest: isRest,
        notes: event.notes,
        seq: event.seq,
      });
    }

    logInfo("Built audio schedule: " + schedule.length + " entr" + (schedule.length === 1 ? "y" : "ies"));
    return schedule;
  }

  // Self-test: synchronous and self-contained. Asserts the four public helpers
  // against an embedded copy of the project sample model (the shape
  // MusicParse.parse() returns). console.table()s and returns the results.
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
                { rest: false, step: "C", octave: 4, duration: 2, type: "quarter", onset: 0 },
                { rest: false, step: "D", octave: 4, duration: 2, type: "quarter", onset: 2 },
                { rest: false, step: "E", octave: 4, duration: 1, type: "eighth", onset: 4 },
                { rest: false, step: "F", octave: 4, duration: 1, type: "eighth", onset: 5 },
                { rest: false, step: "G", octave: 4, duration: 2, type: "quarter", onset: 6 },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, step: "A", octave: 4, duration: 4, type: "half", onset: 0 },
                { rest: true, step: null, octave: null, duration: 2, type: "quarter", onset: 4 },
                { rest: false, step: "C", octave: 5, duration: 2, type: "quarter", onset: 6 },
              ],
            },
          ],
        },
      ],
    };

    const schedule = buildSchedule(MODEL);

    const startSecondsNonDecreasing = (function () {
      for (let i = 1; i < schedule.length; i++) {
        if (schedule[i].startSeconds < schedule[i - 1].startSeconds) return false;
      }
      return true;
    })();

    // The rest is the seventh entry (index 6); the first entry is a pitched C4.
    const restEntry = schedule[6];
    const pitchedEntry = schedule[0];

    // Chords model (the shape MusicParse returns for sample-chords.musicxml) to
    // check that a chord is ONE entry sounding several frequencies, and that the
    // time advances once per event rather than once per chord note.
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
                { rest: false, chord: false, step: "C", octave: 4, duration: 1, type: "quarter", onset: 0 },
                { rest: false, chord: true, step: "E", octave: 4, duration: 1, type: "quarter", onset: 0 },
                { rest: false, chord: true, step: "G", octave: 4, duration: 1, type: "quarter", onset: 0 },
                { rest: false, chord: false, step: "D", octave: 4, duration: 1, type: "quarter", onset: 1 },
                { rest: false, chord: false, step: "E", octave: 4, duration: 1, type: "quarter", onset: 2 },
                { rest: false, chord: true, step: "G", octave: 4, duration: 1, type: "quarter", onset: 2 },
                { rest: true, chord: false, step: null, octave: null, duration: 1, type: "quarter", onset: 3 },
              ],
            },
            {
              number: "2",
              notes: [
                { rest: false, chord: false, step: "F", octave: 4, duration: 2, type: "half", onset: 0 },
                { rest: false, chord: false, step: "C", octave: 4, duration: 2, type: "half", onset: 2 },
                { rest: false, chord: true, step: "E", octave: 4, duration: 2, type: "half", onset: 2 },
                { rest: false, chord: true, step: "G", octave: 4, duration: 2, type: "half", onset: 2 },
              ],
            },
          ],
        },
      ],
    };
    const chordsSchedule = buildSchedule(CHORDS_MODEL);
    const cs0 = chordsSchedule[0], cs1 = chordsSchedule[1], cs2 = chordsSchedule[2];
    const cs3 = chordsSchedule[3], cs5 = chordsSchedule[5];

    // Accidentals (Phase 2): prove the alter threads through the single pitch
    // point end to end. A tiny one-note model whose only note is a B flat should
    // schedule the flat frequency, not the natural B.
    const bFlatFreq = frequencyOf("B", 4, -1);
    const bNaturalFreq = frequencyOf("B", 4);
    const bFlatMidi = pitchToMidi("B", 4, -1);
    const BFLAT_MODEL = {
      workTitle: "Accessible Music PoC B flat sample",
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
                { rest: false, step: "B", octave: 4, alter: -1, duration: 1, type: "quarter", onset: 0 },
              ],
            },
          ],
        },
      ],
    };
    const bFlatSchedule = buildSchedule(BFLAT_MODEL);
    const bFlatEntry = bFlatSchedule[0];

    // Stage 35 (shared clock): the timing now comes from music-onset, so two
    // voices at the same onset must SOUND TOGETHER — two entries with equal
    // startSeconds — rather than one after the other on a running clock. A
    // two-staff single-part bar: a treble voice and a bass note both onset 0.
    const TWO_STAFF_MODEL = {
      workTitle: "Accessible Music PoC two-staff sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [
        {
          id: "P1",
          name: "Piano",
          measures: [
            {
              number: "1",
              notes: [
                { rest: false, step: "C", octave: 5, duration: 2, type: "half", chord: false, staff: "1", onset: 0 },
                { rest: false, step: "D", octave: 5, duration: 2, type: "half", chord: false, staff: "1", onset: 2 },
                { rest: false, step: "C", octave: 3, duration: 4, type: "whole", chord: false, staff: "2", onset: 0 },
              ],
            },
          ],
        },
      ],
    };
    const twoStaffSchedule = buildSchedule(TWO_STAFF_MODEL);

    // Two parts, three bars each of one whole note (divisions 1, bar width 4), the
    // parts pitched apart (C4 vs C5) so entries can be told apart by frequency.
    // Aligned, the last entry starts at bar 3 (8 quarters), NOT at the sum of both
    // parts laid end to end (part 2 bar 3 would be 20 quarters if concatenated).
    function wholeBar(number, step, octave) {
      return { number: number, notes: [{ rest: false, step: step, octave: octave, duration: 4, type: "whole", chord: false, staff: null, onset: 0 }] };
    }
    function threeBarPart(id, step, octave) {
      return { id: id, name: id, measures: [wholeBar("1", step, octave), wholeBar("2", step, octave), wholeBar("3", step, octave)] };
    }
    const TWO_PART_MODEL = {
      workTitle: "Accessible Music PoC two-part sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [threeBarPart("P1", "C", 4), threeBarPart("P2", "C", 5)],
    };
    const twoPartSchedule = buildSchedule(TWO_PART_MODEL);
    const freqC4 = frequencyOf("C", 4);
    const freqC5 = frequencyOf("C", 5);

    // A 3/4 bar with two voices, each a dotted-half filling the bar (3 quarters).
    // On the shared clock the bar spans about three beats of seconds, not six.
    const THREE_FOUR_MODEL = {
      workTitle: "Accessible Music PoC 3/4 two-voice sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 3, beatType: 4 },
      parts: [
        {
          id: "P1",
          name: "Piano",
          measures: [
            {
              number: "1",
              notes: [
                { rest: false, step: "C", octave: 5, duration: 3, type: "half", chord: false, staff: "1", onset: 0 },
                { rest: false, step: "C", octave: 3, duration: 3, type: "half", chord: false, staff: "2", onset: 0 },
              ],
            },
          ],
        },
      ],
    };
    const threeFourSchedule = buildSchedule(THREE_FOUR_MODEL);
    const threeFourSpanSeconds = threeFourSchedule.reduce(function (max, e) {
      const end = e.startSeconds + e.durationSeconds;
      return end > max ? end : max;
    }, 0);
    const secondsPerQuarter90 = 60 / 90;

    // Stage 5.6a (note reference): each entry now carries its group's note objects
    // by reference. A two-note model whose two note objects are held in local
    // handles (noteC, noteD) lets us prove the reference survives music-onset and
    // buildSchedule uncopied — an entry's notes[0] must be the SAME object, not a
    // clone. The notes are distinct pitches at distinct onsets so the sort keeps
    // noteC first and noteD second.
    const noteC = { rest: false, step: "C", octave: 4, duration: 1, type: "quarter", chord: false, staff: null, onset: 0 };
    const noteD = { rest: false, step: "D", octave: 4, duration: 1, type: "quarter", chord: false, staff: null, onset: 1 };
    const TWO_NOTE_MODEL = {
      workTitle: "Accessible Music PoC two-note sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [
        {
          id: "P1",
          name: "Melody",
          measures: [{ number: "1", notes: [noteC, noteD] }],
        },
      ],
    };
    const twoNoteSchedule = buildSchedule(TWO_NOTE_MODEL);

    // Stage 5.6c-prep-2 (seq copy): each entry now carries its event's seq — the
    // note-list document-order position — so play-along indexes noteItems[seq]
    // without a model walk. Read the timeline from the SAME model the schedule was
    // built from: both come from eventsWithOnset in the same order, so entry i and
    // event i must share a seq. The onset layer may be absent (buildSchedule then
    // returns []), so guard the read rather than assume it.
    const hasOnsetForSeq = !!(globalThis.MusicOnset && globalThis.MusicOnset.eventsWithOnset);
    const seqTimeline = hasOnsetForSeq ? globalThis.MusicOnset.eventsWithOnset(MODEL) : { events: [] };
    const seqEvents = Array.isArray(seqTimeline.events) ? seqTimeline.events : [];

    // The seq values across the whole schedule, sorted, must be exactly 0..n-1:
    // every note-list position present once, no gaps and no repeats.
    const sortedSeqs = schedule.map(function (e) { return e.seq; }).sort(function (a, b) { return a - b; });

    const results = {
      hasPitchToMidi: typeof pitchToMidi === "function",
      hasFrequencyOf: typeof frequencyOf === "function",
      hasBuildSchedule: typeof buildSchedule === "function",
      hasSelfTest: typeof selfTest === "function",
      midiC4Is60: pitchToMidi("C", 4) === 60,
      midiA4Is69: pitchToMidi("A", 4) === 69,
      midiUnknownStepNull: pitchToMidi("Q", 4) === null,
      freqA4Exactly440: frequencyOf("A", 4) === 440,
      freqC4Near26163: Math.abs(frequencyOf("C", 4) - 261.63) < 0.5,
      freqUnknownStepNull: frequencyOf("Q", 4) === null,
      scheduleHasEightEntries: buildSchedule(MODEL).length === 8,
      firstEntryStartsAtZero: schedule[0].startSeconds === 0,
      firstCrotchetDuration: Math.abs(schedule[0].durationSeconds - 60 / 90) < 0.001,
      startSecondsNonDecreasing: startSecondsNonDecreasing,
      restEntryHasNoFrequency: !!restEntry && restEntry.isRest === true && restEntry.frequency === null,
      pitchedEntryHasFrequency: !!pitchedEntry && typeof pitchedEntry.frequency === "number" && isFinite(pitchedEntry.frequency),
      handlesNullModel: buildSchedule(null).length === 0,
      simpleEntryHasFrequenciesArray: Array.isArray(schedule[0].frequencies) && schedule[0].frequencies.length === 1,
      simpleRestHasEmptyFrequencies: !!restEntry && Array.isArray(restEntry.frequencies) && restEntry.frequencies.length === 0,
      chordsSixEntries: chordsSchedule.length === 6,
      chordsTriadThreeFreqs: !!cs0 && cs0.isRest === false && Array.isArray(cs0.frequencies) && cs0.frequencies.length === 3,
      chordsTriadFreqMatchC4: !!cs0 && Math.abs(cs0.frequencies[0] - 261.63) < 0.5,
      chordsTriadFreqMatchE4: !!cs0 && Math.abs(cs0.frequencies[1] - 329.63) < 0.5,
      chordsTriadFreqMatchG4: !!cs0 && Math.abs(cs0.frequencies[2] - 392.00) < 0.5,
      chordsSingularIsFirst: !!cs0 && cs0.frequency === cs0.frequencies[0],
      chordsSingleD4OneFreq: !!cs1 && cs1.frequencies.length === 1,
      chordsDyadTwoFreqs: !!cs2 && cs2.frequencies.length === 2,
      chordsRestEntry: !!cs3 && cs3.isRest === true && cs3.frequencies.length === 0 && cs3.frequency === null,
      chordsBar2TriadThreeFreqs: !!cs5 && cs5.frequencies.length === 3,
      chordsTriadAdvancesOnce: !!cs0 && !!cs1 && Math.abs(cs1.startSeconds - cs0.durationSeconds) < 0.001,
      chordsCumulativeTiming: !!cs5 && Math.abs(cs5.startSeconds - 6 * (60 / 90)) < 0.001,
      // Accidentals (Phase 2): the alter threads through the single pitch point.
      flatIsOneSemitoneDown: pitchToMidi("B", 4, -1) === pitchToMidi("B", 4) - 1,
      sharpIsOneSemitoneUp: pitchToMidi("F", 4, 1) === pitchToMidi("F", 4) + 1,
      nullAlterMatchesBare: pitchToMidi("C", 5, null) === pitchToMidi("C", 5),
      zeroAlterMatchesBare: pitchToMidi("C", 5, 0) === pitchToMidi("C", 5),
      freqFlatLowerThanNatural: bFlatFreq < bNaturalFreq,
      freqFlatMatchesMidi: Math.abs(bFlatFreq - A4_FREQUENCY * Math.pow(2, (bFlatMidi - A4_MIDI) / 12)) < 1e-9,
      buildScheduleAppliesAlter: !!bFlatEntry && Math.abs(bFlatEntry.frequency - bFlatFreq) < 1e-6 && Math.abs(bFlatEntry.frequency - bNaturalFreq) > 0.5,
      // Stage 35 (shared clock): simultaneous voices sound together, aligned
      // parts share start times, and a bar spans its true length.
      // Two staves onset 0 → two entries, both starting at 0 (together, not in series).
      twoStaffTwoEntriesAtZero:
        twoStaffSchedule.length === 3 &&
        twoStaffSchedule[0].startSeconds === 0 &&
        twoStaffSchedule[1].startSeconds === 0 &&
        twoStaffSchedule[0] !== twoStaffSchedule[1],
      // Two parts of three bars: six entries, last starts at bar 3 (8 quarters),
      // not the 20 quarters a concatenated part-2 bar 3 would give.
      twoPartSixEntries: twoPartSchedule.length === 6,
      twoPartLastAligned:
        !!twoPartSchedule[5] && Math.abs(twoPartSchedule[5].startSeconds - 8 * secondsPerQuarter90) < 0.001,
      twoPartNotConcatenated:
        !!twoPartSchedule[5] && twoPartSchedule[5].startSeconds < 20 * secondsPerQuarter90 - 0.001,
      // At the same bar, a part-2 entry (C5) shares a startSeconds with a part-1
      // entry (C4): entries[0]/[1] are both bar 1 at 0; entries[2]/[3] bar 2.
      twoPartBar1Shared:
        !!twoPartSchedule[0] && !!twoPartSchedule[1] &&
        twoPartSchedule[0].startSeconds === twoPartSchedule[1].startSeconds &&
        Math.abs(twoPartSchedule[0].frequency - freqC4) < 0.5 &&
        Math.abs(twoPartSchedule[1].frequency - freqC5) < 0.5,
      twoPartBar2Shared:
        !!twoPartSchedule[2] && !!twoPartSchedule[3] &&
        twoPartSchedule[2].startSeconds === twoPartSchedule[3].startSeconds &&
        twoPartSchedule[2].startSeconds > 0,
      // A 3/4 two-voice bar spans about three beats of seconds, not six.
      threeFourSpansThreeBeats:
        Math.abs(threeFourSpanSeconds - 3 * secondsPerQuarter90) < 0.001 &&
        threeFourSpanSeconds < 6 * secondsPerQuarter90 - 0.001,
      // Stage 5.6a (note reference): each entry carries its group's note objects by
      // reference so play-along can map an entry to its note-list item by identity
      // now that the schedule is sorted by start time and position no longer lines up.
      // Every entry (rests included) has a non-empty notes array.
      everyEntryHasNotesArray: schedule.every(function (e) {
        return Array.isArray(e.notes) && e.notes.length >= 1;
      }),
      // A chord entry's notes array length matches its frequencies length (triad:
      // three notes, three frequencies).
      chordEntryNotesMatchFrequencies:
        !!cs0 && Array.isArray(cs0.notes) &&
        cs0.notes.length === cs0.frequencies.length && cs0.notes.length === 3,
      // A rest entry has a single-note notes array whose note has rest true and no step.
      restEntryNotesSingleNoStep:
        !!cs3 && Array.isArray(cs3.notes) && cs3.notes.length === 1 &&
        cs3.notes[0].rest === true && !cs3.notes[0].step,
      // The notes on an entry are the SAME objects as in the model, not copies:
      // the reference is preserved through music-onset and buildSchedule.
      notesPreservedByReference:
        !!twoNoteSchedule[0] && Array.isArray(twoNoteSchedule[0].notes) &&
        twoNoteSchedule[0].notes[0] === noteC &&
        !!twoNoteSchedule[1] && twoNoteSchedule[1].notes[0] === noteD,
      // Stage 5.6c-prep-2 (seq copy): every entry carries a numeric seq.
      everyEntryHasNumericSeq: schedule.every(function (e) {
        return typeof e.seq === "number" && isFinite(e.seq);
      }),
      // On this multi-event model the seq values are the full range 0..n-1 — each
      // note-list position exactly once, no gaps and no repeats.
      seqIsFullRangeNoGapsOrRepeats:
        sortedSeqs.length === schedule.length &&
        sortedSeqs.every(function (s, i) { return s === i; }),
      // An entry's seq is its OWN event's seq: the timeline and the schedule are
      // built from the same model and both keep eventsWithOnset's order, so entry
      // i and event i must agree.
      entrySeqMatchesOwnEvent:
        seqEvents.length === schedule.length &&
        schedule.every(function (e, i) { return e.seq === seqEvents[i].seq; }),
    };

    console.table(results);
    return results;
  }

  return { pitchToMidi, frequencyOf, buildSchedule, selfTest };
})();

window.MusicAudioSchedule = MusicAudioSchedule;
