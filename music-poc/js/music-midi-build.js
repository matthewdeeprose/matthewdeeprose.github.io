// music-midi-build.js
// Standard MIDI File builder for the Accessible Music proof of concept.
//
// A PURE DATA SERVICE: it turns the plain model object that MusicParse.parse()
// returns into the bytes of a format-0 Standard MIDI File. It has no DOM, no Web
// Audio, no download, and no notifications — it only does the byte arithmetic
// that a later download layer (js/music-midi.js) will hand to the browser. It
// never parses anything itself, never throws, and returns sensible bytes on bad
// input. It reuses Stage 5's pitch mapping (MusicAudioSchedule.pitchToMidi) as
// the single source of truth rather than redefining it. Exposed as
// window.MusicMidiBuild.

const MusicMidiBuild = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Pitch helper: reuse Stage 5's mapping (the single source of truth) when
  // present, otherwise a no-op that returns null so a pitched note degrades to a
  // rest rather than throwing.
  const schedule = window.MusicAudioSchedule || { pitchToMidi() { return null; } };

  // Consumer-side grouping: route through the shared MusicModelWalk.groupNotes
  // (the single definition of an event) when present, otherwise fall back to one
  // group per note so this file never throws if the model-walk layer is absent.
  // Named modelWalk to avoid clashing with the selfTest's local walkTrack result.
  const modelWalk = window.MusicModelWalk || {
    groupNotes(notes) { return (Array.isArray(notes) ? notes : []).map(function (n) { return [n]; }); },
  };

  // Ticks per quarter note recorded in the file header (the time division).
  const MIDI_DIVISION = 480;
  // Default tempo in beats per minute, matching Stage 5's audio default.
  const DEFAULT_BPM = 90;
  // Fixed note velocity (0x40) — a comfortable mezzo-forte for every note.
  const NOTE_VELOCITY = 0x40;
  // Channel-0 note-on / note-off status bytes. Written on EVERY channel event
  // (no running status) so the file is trivial to decode.
  const NOTE_ON_STATUS = 0x90;
  const NOTE_OFF_STATUS = 0x80;

  // toVlq(value): MIDI variable-length quantity. Seven bits per byte, the high
  // bit set on every byte except the last; 0 encodes as [0x00]. So 480 -> [0x83,
  // 0x60]. Pure; NEVER throws.
  function toVlq(value) {
    let n = Math.max(0, Math.floor(Number(value) || 0));
    const bytes = [n & 0x7f];
    n = Math.floor(n / 128);
    while (n > 0) {
      bytes.unshift((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    return bytes;
  }

  // u32be(n): four big-endian bytes of an unsigned 32-bit integer.
  function u32be(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  }

  // u16be(n): two big-endian bytes of an unsigned 16-bit integer.
  function u16be(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    return [(v >>> 8) & 0xff, v & 0xff];
  }

  // buildMidi(model, bpm): pure; NEVER throws. Walks parts -> measures -> events,
  // grouping each bar's notes with MusicModelWalk.groupNotes, and returns a
  // Uint8Array of a complete format-0 Standard MIDI File. Rests (and notes whose
  // pitch will not map) advance time without emitting events; a single pitched
  // note emits a note-on then a note-off; a chord emits all its note-ons together,
  // advances the shared duration once, then all its note-offs together. bpm
  // defaults to 90 when omitted or not a positive number.
  function buildMidi(model, bpm) {
    const tempo = typeof bpm === "number" && isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;
    const m = model || {};
    const divisions = typeof m.divisions === "number" && isFinite(m.divisions) && m.divisions > 0 ? m.divisions : 1;
    const parts = Array.isArray(m.parts) ? m.parts : [];

    const trackData = [];

    // First event: the tempo meta, microseconds per quarter note, at delta 0.
    const microsecondsPerQuarter = Math.round(60000000 / tempo);
    trackData.push(...toVlq(0), 0xff, 0x51, 0x03,
      (microsecondsPerQuarter >>> 16) & 0xff, (microsecondsPerQuarter >>> 8) & 0xff, microsecondsPerQuarter & 0xff);

    // Trailing rests have no note-off to carry their time, so we hold the
    // accumulated rest ticks and prepend them to the next note's note-on delta
    // (or to the end-of-track event).
    let pendingRestTicks = 0;

    for (const part of parts) {
      const measures = part && Array.isArray(part.measures) ? part.measures : [];
      for (const measure of measures) {
        const notes = measure && Array.isArray(measure.notes) ? measure.notes : [];
        // Group the bar's flat notes into events: a chord sounds its pitches at
        // one time slot, so its note-ons share a start and its note-offs share an
        // end, and time advances once for the whole chord.
        const groups = modelWalk.groupNotes(notes);
        for (const group of groups) {
          const head = group[0] || {};
          const rawDuration = Number(head.duration);
          const ticks = isFinite(rawDuration) && rawDuration > 0 ? Math.round((rawDuration / divisions) * MIDI_DIVISION) : 0;

          // The event's MIDI keys: every note that maps to a pitch. A rest (or an
          // unmapped pitch) yields none.
          const keys = [];
          for (const note of group) {
            const n = note || {};
            const key = n.rest === true ? null : schedule.pitchToMidi(n.step, n.octave);
            if (key !== null) keys.push(key);
          }

          if (keys.length === 0) {
            // A rest, or an event whose pitches will not map: advance time, emit
            // nothing.
            pendingRestTicks += ticks;
          } else {
            // Note-ons together: the first carries any pending rest as its delta,
            // the rest follow at delta 0 so they sound simultaneously.
            for (let k = 0; k < keys.length; k++) {
              const delta = k === 0 ? pendingRestTicks : 0;
              trackData.push(...toVlq(delta), NOTE_ON_STATUS, keys[k], NOTE_VELOCITY);
            }
            pendingRestTicks = 0;
            // Note-offs together: the first carries the event's duration as its
            // delta, the rest follow at delta 0.
            for (let k = 0; k < keys.length; k++) {
              const delta = k === 0 ? ticks : 0;
              trackData.push(...toVlq(delta), NOTE_OFF_STATUS, keys[k], 0x00);
            }
          }
        }
      }
    }

    // End-of-track meta, absorbing any trailing rest into its delta.
    trackData.push(...toVlq(pendingRestTicks), 0xff, 0x2f, 0x00);

    // Header chunk: "MThd", length 6, format 0, one track, division 480.
    const header = [0x4d, 0x54, 0x68, 0x64, ...u32be(6), ...u16be(0), ...u16be(1), ...u16be(MIDI_DIVISION)];
    // Track chunk: "MTrk", track-data length, then the data itself.
    const track = [0x4d, 0x54, 0x72, 0x6b, ...u32be(trackData.length), ...trackData];

    const bytes = Uint8Array.from(header.concat(track));
    logInfo("Built MIDI file: " + bytes.length + " byte(s)");
    return bytes;
  }

  // Self-test: synchronous and self-contained; needs MusicAudioSchedule loaded
  // for the pitch mapping. Builds the project sample model into MIDI bytes and
  // asserts the file structure, plus a VLQ-aware walk to count note events and
  // capture the tempo honestly. console.table()s and returns the results.
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

    // VLQ-aware track walker: starts at the first track event (byte 22), counts
    // note-on / note-off events, and captures the tempo meta's 3 data bytes.
    function walkTrack(bytes) {
      let i = 22; // 14-byte MThd + 8-byte MTrk header
      let noteOn = 0;
      let noteOff = 0;
      let tempo = null;
      const readVlq = function () {
        let value = 0;
        let b;
        do {
          b = bytes[i++];
          value = value * 128 + (b & 0x7f);
        } while (b & 0x80);
        return value;
      };
      while (i < bytes.length) {
        readVlq(); // delta time
        const status = bytes[i++];
        if (status === 0xff) {
          const type = bytes[i++];
          const len = readVlq();
          if (type === 0x51 && len === 3) {
            tempo = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
          }
          i += len;
          if (type === 0x2f) break; // end of track
        } else if ((status & 0xf0) === 0x90) {
          const velocity = bytes[i + 1];
          if (velocity > 0) noteOn++;
          else noteOff++;
          i += 2;
        } else if ((status & 0xf0) === 0x80) {
          noteOff++;
          i += 2;
        } else {
          break; // unexpected status; stop honestly
        }
      }
      return { noteOn: noteOn, noteOff: noteOff, tempo: tempo };
    }

    // A delta-aware walker for the chord assertions: returns each channel event as
    // { delta, kind: "on"|"off", key }, so simultaneous note-ons (delta 0) and the
    // shared hold (the first note-off carrying the event's ticks) can be checked.
    function walkEvents(bytes) {
      let i = 22;
      const events = [];
      const readVlq = function () {
        let value = 0;
        let b;
        do {
          b = bytes[i++];
          value = value * 128 + (b & 0x7f);
        } while (b & 0x80);
        return value;
      };
      while (i < bytes.length) {
        const delta = readVlq();
        const status = bytes[i++];
        if (status === 0xff) {
          const type = bytes[i++];
          const len = readVlq();
          i += len;
          if (type === 0x2f) break;
        } else if ((status & 0xf0) === 0x90) {
          const key = bytes[i];
          const velocity = bytes[i + 1];
          events.push({ delta: delta, kind: velocity > 0 ? "on" : "off", key: key });
          i += 2;
        } else if ((status & 0xf0) === 0x80) {
          events.push({ delta: delta, kind: "off", key: bytes[i] });
          i += 2;
        } else {
          break;
        }
      }
      return events;
    }

    const bytes = buildMidi(MODEL); // default bpm 90
    const walk = walkTrack(bytes);
    const walk120 = walkTrack(buildMidi(MODEL, 120));

    // Chords model (the shape MusicParse returns for sample-chords.musicxml), to
    // check simultaneous note-ons, the shared hold, and time advancing once per
    // chord. divisions 1, so a crotchet is 480 ticks and a minim 960.
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
    const chordsEvents = walkEvents(buildMidi(CHORDS_MODEL));
    const chordsOn = chordsEvents.filter(function (e) { return e.kind === "on"; });
    const chordsOff = chordsEvents.filter(function (e) { return e.kind === "off"; });

    const results = {
      hasBuildMidi: typeof buildMidi === "function",
      hasSelfTest: typeof selfTest === "function",
      returnsUint8Array: bytes instanceof Uint8Array && bytes.length > 0,
      startsWithMThd: bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64,
      headerLengthIs6: ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) === 6,
      formatIsZero: ((bytes[8] << 8) | bytes[9]) === 0,
      oneTrack: ((bytes[10] << 8) | bytes[11]) === 1,
      divisionIs480: ((bytes[12] << 8) | bytes[13]) === 480,
      hasMTrk: bytes[14] === 0x4d && bytes[15] === 0x54 && bytes[16] === 0x72 && bytes[17] === 0x6b,
      trackLengthMatches: ((bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21]) === bytes.length - 22,
      endsWithEndOfTrack: bytes[bytes.length - 3] === 0xff && bytes[bytes.length - 2] === 0x2f && bytes[bytes.length - 1] === 0x00,
      noteOnCountIsSeven: walk.noteOn === 7,
      noteOffCountIsSeven: walk.noteOff === 7,
      tempoMetaMatches90: walk.tempo === Math.round(60000000 / 90),
      customBpmChangesTempo: walk120.tempo === Math.round(60000000 / 120),
      chordsTenNoteOns: chordsOn.length === 10,
      chordsTenNoteOffs: chordsOff.length === 10,
      chordsTriadSimultaneousOns:
        chordsEvents[0].kind === "on" && chordsEvents[0].key === 60 && chordsEvents[0].delta === 0 &&
        chordsEvents[1].kind === "on" && chordsEvents[1].key === 64 && chordsEvents[1].delta === 0 &&
        chordsEvents[2].kind === "on" && chordsEvents[2].key === 67 && chordsEvents[2].delta === 0,
      chordsTriadHeldThenReleasedTogether:
        chordsEvents[3].kind === "off" && chordsEvents[3].key === 60 && chordsEvents[3].delta === 480 &&
        chordsEvents[4].kind === "off" && chordsEvents[4].key === 64 && chordsEvents[4].delta === 0 &&
        chordsEvents[5].kind === "off" && chordsEvents[5].key === 67 && chordsEvents[5].delta === 0,
      chordsMelodyNoteUnchanged:
        chordsEvents[6].kind === "on" && chordsEvents[6].key === 62 && chordsEvents[6].delta === 0 &&
        chordsEvents[7].kind === "off" && chordsEvents[7].key === 62 && chordsEvents[7].delta === 480,
      chordsRestAbsorbedIntoNextOn:
        chordsEvents[12].kind === "on" && chordsEvents[12].key === 65 && chordsEvents[12].delta === 480,
      chordsBar2TriadMinim:
        chordsEvents[14].kind === "on" && chordsEvents[14].key === 60 && chordsEvents[14].delta === 0 &&
        chordsEvents[15].kind === "on" && chordsEvents[15].key === 64 && chordsEvents[15].delta === 0 &&
        chordsEvents[16].kind === "on" && chordsEvents[16].key === 67 && chordsEvents[16].delta === 0 &&
        chordsEvents[17].kind === "off" && chordsEvents[17].key === 60 && chordsEvents[17].delta === 960,
    };

    console.table(results);
    return results;
  }

  return { buildMidi, selfTest };
})();

window.MusicMidiBuild = MusicMidiBuild;
