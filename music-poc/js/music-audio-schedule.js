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

  // Consumer-side grouping: route through the shared MusicModelWalk.groupNotes
  // (the single definition of an event) when present, otherwise fall back to one
  // group per note so this file never throws if the model-walk layer is absent.
  const walk = window.MusicModelWalk || {
    groupNotes(notes) { return (Array.isArray(notes) ? notes : []).map(function (n) { return [n]; }); },
  };

  // Default tempo in beats per minute. The sample carries no tempo and the
  // parser does not read one until Stage 9, so this is the only tempo source.
  const DEFAULT_BPM = 90;

  // Concert pitch reference: A4 = 440 Hz, which is MIDI note 69.
  const A4_FREQUENCY = 440;
  const A4_MIDI = 69;

  // Natural diatonic semitone offsets from C within an octave. The model
  // carries no accidental/alter, so only the seven naturals are mapped.
  const STEP_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // pitchToMidi(step, octave): pure; NEVER throws. Maps a natural diatonic
  // pitch to its MIDI note number (12 * (octave + 1) + semitone offset), so
  // C4 -> 60 and A4 -> 69. Returns null when the step is unrecognised or the
  // octave is not a finite number. Single source of pitch mapping.
  function pitchToMidi(step, octave) {
    const offset = STEP_SEMITONES[step];
    if (offset === undefined) return null;
    const oct = Number(octave);
    if (!isFinite(oct)) return null;
    return 12 * (oct + 1) + offset;
  }

  // frequencyOf(step, octave): pure; NEVER throws. Equal temperament from
  // A4 = 440 Hz: 440 * 2 ** ((midi - 69) / 12). So A4 is exactly 440 and C4 is
  // about 261.63. Returns null whenever pitchToMidi returns null.
  function frequencyOf(step, octave) {
    const midi = pitchToMidi(step, octave);
    if (midi === null) return null;
    return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  // buildSchedule(model, bpm): pure; NEVER throws. Walks
  // parts -> measures -> events, grouping each bar's notes with
  // MusicModelWalk.groupNotes, producing ONE flat array with an entry for EVERY
  // event (a chord is one entry, rests included) so indices line up with the
  // note-list items for play-along. Parts are concatenated so startSeconds runs
  // continuously. Each entry is
  //   { frequency, frequencies, startSeconds, durationSeconds, isRest }
  // where frequency is the event's first pitch (kept for one-pitch consumers) and
  // frequencies holds the whole chord. bpm defaults to 90 when omitted or not a
  // positive number. Returns [] for a null model or one with no parts array.
  function buildSchedule(model, bpm) {
    const m = model || {};
    const parts = Array.isArray(m.parts) ? m.parts : [];
    if (parts.length === 0) return [];

    const tempo = typeof bpm === "number" && isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const secondsPerQuarter = 60 / tempo;

    // Guard divisions: a non-positive or non-finite value falls back to 1 so we
    // never divide by zero or produce a non-finite duration.
    const divisions = typeof m.divisions === "number" && isFinite(m.divisions) && m.divisions > 0 ? m.divisions : 1;

    const schedule = [];
    let cumulativeSeconds = 0;

    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        // Group the bar's flat notes into events: a chord is ONE entry sounding
        // its pitches together, so the schedule stays one entry per note-list
        // item for play-along. A melody yields one group per note, unchanged.
        const groups = walk.groupNotes(notes);
        for (const group of groups) {
          const head = group[0] || {};
          const isRest = head.rest === true;

          // Per-event quarter length from the head note, then seconds. All notes
          // of a chord share the head's duration, so time advances once per event.
          // A missing/odd duration falls back to 0 so the maths stays finite.
          const rawDuration = Number(head.duration);
          const quarterLength = (isFinite(rawDuration) ? rawDuration : 0) / divisions;
          const durationSeconds = quarterLength * secondsPerQuarter;

          // Every pitched note in the event contributes a frequency; rests and
          // notes missing step/octave contribute none but still consume the time.
          const frequencies = [];
          if (!isRest) {
            for (const note of group) {
              const f = frequencyOf(note.step, note.octave);
              if (typeof f === "number" && isFinite(f)) frequencies.push(f);
            }
          }
          // frequency (singular) is the event's first pitch, kept so existing
          // consumers and tests that read one frequency still work; frequencies
          // carries the whole chord.
          const frequency = frequencies.length ? frequencies[0] : null;

          schedule.push({
            frequency: frequency,
            frequencies: frequencies,
            startSeconds: cumulativeSeconds,
            durationSeconds: durationSeconds,
            isRest: isRest,
          });

          cumulativeSeconds += durationSeconds;
        }
      }
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
    const chordsSchedule = buildSchedule(CHORDS_MODEL);
    const cs0 = chordsSchedule[0], cs1 = chordsSchedule[1], cs2 = chordsSchedule[2];
    const cs3 = chordsSchedule[3], cs5 = chordsSchedule[5];

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
    };

    console.table(results);
    return results;
  }

  return { pitchToMidi, frequencyOf, buildSchedule, selfTest };
})();

window.MusicAudioSchedule = MusicAudioSchedule;
