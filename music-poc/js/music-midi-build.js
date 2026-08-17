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

  // buildMidi(model, bpm): pure; NEVER throws. Reads music-onset's shared-clock
  // timeline (MusicOnset.eventsWithOnset), places every note at its absolute tick
  // so simultaneous voices, staves and aligned parts overlap in the one track,
  // then converts to delta times on emission. Rests contribute no events; the gap
  // a rest leaves is carried by the next event's delta. Returns a Uint8Array of a
  // complete format-0 Standard MIDI File. A missing MusicOnset, or a null/partless
  // model, yields a valid empty-but-well-formed file (tempo meta then
  // end-of-track). bpm defaults to 90 when omitted or not a positive number.
  function buildMidi(model, bpm) {
    const tempo = typeof bpm === "number" && isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_BPM;

    const trackData = [];

    // First event: the tempo meta, microseconds per quarter note, at delta 0.
    const microsecondsPerQuarter = Math.round(60000000 / tempo);
    trackData.push(...toVlq(0), 0xff, 0x51, 0x03,
      (microsecondsPerQuarter >>> 16) & 0xff, (microsecondsPerQuarter >>> 8) & 0xff, microsecondsPerQuarter & 0xff);

    // Read the shared-clock timeline: every event already placed on one clock in
    // quarters. When music-onset is absent we cannot align anything, so warn and
    // fall through to a valid empty-but-well-formed file rather than throwing.
    const hasOnset = !!(globalThis.MusicOnset && globalThis.MusicOnset.eventsWithOnset);
    if (!hasOnset) logWarn("buildMidi: MusicOnset absent, writing an empty MIDI file");
    const timeline = hasOnset ? globalThis.MusicOnset.eventsWithOnset(model) : { events: [] };
    const timelineEvents = Array.isArray(timeline.events) ? timeline.events : [];

    // Build an absolute-tick event list. Each non-rest event places its notes at
    // its own onTick/offTick; rests are skipped entirely, contributing no bytes.
    // maxOffTick tracks the furthest point the music reaches.
    const ticked = [];
    let maxOffTick = 0;
    for (const event of timelineEvents) {
      if (!event || event.rest === true) continue;
      const startQuarters = Number(event.startQuarters) || 0;
      const durationQuarters = Number(event.durationQuarters) || 0;
      const onTick = Math.round(startQuarters * MIDI_DIVISION);
      const offTick = Math.round((startQuarters + durationQuarters) * MIDI_DIVISION);
      const notes = Array.isArray(event.notes) ? event.notes : [];
      for (const note of notes) {
        const n = note || {};
        // Each note carries its own alter (Stage 25) so the saved file sounds
        // accidentals at true pitch; an unmapped pitch (non-finite key) is
        // skipped rather than sounded.
        const key = n.rest === true ? null : schedule.pitchToMidi(n.step, n.octave, n.alter);
        if (typeof key !== "number" || !isFinite(key)) continue;
        ticked.push({ tick: onTick, kind: "on", key: key });
        ticked.push({ tick: offTick, kind: "off", key: key });
        if (offTick > maxOffTick) maxOffTick = offTick;
      }
    }

    // Sort by absolute tick ascending; at the same tick put every "off" before
    // every "on", so a note repeated the instant another ends is not cut short.
    // Otherwise stable, preserving chord and part order within a tick.
    ticked.sort(function (a, b) {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.kind !== b.kind) return a.kind === "off" ? -1 : 1;
      return 0;
    });

    // Convert absolute ticks to delta times on emission. Items sharing a tick take
    // delta 0 after the first — how a chord and simultaneous parts are expressed.
    let lastTick = 0;
    for (const item of ticked) {
      const delta = item.tick - lastTick;
      lastTick = item.tick;
      if (item.kind === "on") {
        trackData.push(...toVlq(delta), NOTE_ON_STATUS, item.key, NOTE_VELOCITY);
      } else {
        trackData.push(...toVlq(delta), NOTE_OFF_STATUS, item.key, 0x00);
      }
    }

    // End-of-track meta at the music's final tick (clamped non-negative), so the
    // file's length reflects the music — overlapping holds included — rather than
    // ending on the last note-off emitted.
    const endDelta = Math.max(0, maxOffTick - lastTick);
    trackData.push(...toVlq(endDelta), 0xff, 0x2f, 0x00);

    // Header chunk: "MThd", length 6, format 0, one track, division 480.
    const header = [0x4d, 0x54, 0x68, 0x64, ...u32be(6), ...u16be(0), ...u16be(1), ...u16be(MIDI_DIVISION)];
    // Track chunk: "MTrk", track-data length, then the data itself.
    const track = [0x4d, 0x54, 0x72, 0x6b, ...u32be(trackData.length), ...trackData];

    const bytes = Uint8Array.from(header.concat(track));
    logInfo("Built MIDI file: " + bytes.length + " byte(s)");
    return bytes;
  }

  // Self-test: synchronous and self-contained; needs MusicAudioSchedule (pitch
  // mapping) and MusicOnset + MusicModelWalk (the shared-clock timeline and chord
  // grouping) loaded, so it runs in the browser rather than under bare node.
  // Builds the sample models into MIDI bytes and asserts the file structure, the
  // note counts and tempo, and — new for Stage 5.4 — that chords, two staves and
  // two parts overlap on absolute ticks. console.table()s and returns the results.
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

    // A delta-aware walker for the alignment assertions: accumulates each event's
    // delta into a running absolute tick and returns each channel event as
    // { delta, tick, kind: "on"|"off", key }. The absolute tick lets us assert
    // that simultaneous voices, staves and chord notes land on ONE tick, and that
    // a rest's gap is carried into the following note-on's delta.
    function walkEvents(bytes) {
      let i = 22;
      let abs = 0;
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
        abs += delta;
        const status = bytes[i++];
        if (status === 0xff) {
          const type = bytes[i++];
          const len = readVlq();
          i += len;
          if (type === 0x2f) break;
        } else if ((status & 0xf0) === 0x90) {
          const key = bytes[i];
          const velocity = bytes[i + 1];
          events.push({ delta: delta, tick: abs, kind: velocity > 0 ? "on" : "off", key: key });
          i += 2;
        } else if ((status & 0xf0) === 0x80) {
          events.push({ delta: delta, tick: abs, kind: "off", key: bytes[i] });
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
    // check simultaneous note-ons, the shared hold, and the next event placed at
    // its own absolute tick. divisions 1, so a crotchet is 480 ticks and a minim
    // 960. onset is the note's position within its bar in divisions; chord notes
    // share their head's onset, so eventsWithOnset lands them on one tick.
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
    const chordsEvents = walkEvents(buildMidi(CHORDS_MODEL));
    const chordsOn = chordsEvents.filter(function (e) { return e.kind === "on"; });
    const chordsOff = chordsEvents.filter(function (e) { return e.kind === "off"; });

    // Two-staff single-part fixture (Stage 5.4): a piano bar whose two staves both
    // begin at onset 0 (a backup rewinds the cursor between staves). The old
    // sequential walk laid the second staff AFTER the first; on the shared clock
    // they overlap, so both note-ons must land on ONE absolute tick, the second at
    // delta 0. divisions 1, so each minim spans 960 ticks.
    const TWO_STAFF_MODEL = {
      workTitle: "Accessible Music PoC two-staff sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [
        {
          id: "P1",
          name: "Piano",
          measures: [{ number: "1", notes: [
            { rest: false, chord: false, step: "C", octave: 5, duration: 2, type: "half", staff: "1", onset: 0 },
            { rest: false, chord: false, step: "C", octave: 3, duration: 2, type: "half", staff: "2", onset: 0 },
          ] }],
        },
      ],
    };
    const twoStaffEvents = walkEvents(buildMidi(TWO_STAFF_MODEL));

    // Two-part fixture (Stage 5.4): two independent parts, each two bars of one
    // whole note. Bar N of every part shares one onset, so a part-2 note-on lands
    // on the same absolute tick as the part-1 note-on at that bar, and the whole
    // file spans the aligned length (8 quarters = 3840 ticks), NOT the sum of both
    // parts laid end to end (16 quarters = 7680). This is the M1-02 / M2-07 fix.
    function twoBarPart(id, step1, step2, octave) {
      return {
        id: id,
        name: id,
        measures: [
          { number: "1", notes: [{ rest: false, chord: false, step: step1, octave: octave, duration: 4, type: "whole", onset: 0 }] },
          { number: "2", notes: [{ rest: false, chord: false, step: step2, octave: octave, duration: 4, type: "whole", onset: 0 }] },
        ],
      };
    }
    const TWO_PART_MODEL = {
      workTitle: "Accessible Music PoC two-part sample",
      divisions: 1,
      key: { fifths: 0 },
      time: { beats: 4, beatType: 4 },
      parts: [twoBarPart("P1", "C", "D", 4), twoBarPart("P2", "C", "D", 3)],
    };
    const twoPartEvents = walkEvents(buildMidi(TWO_PART_MODEL));
    const twoPartMaxTick = twoPartEvents.reduce(function (m, e) { return Math.max(m, e.tick); }, 0);

    // Accidentals (Phase 2): prove each note's own alter threads through the
    // key loop into the saved file, mirroring the audio schedule's B flat
    // fixture. Reading the first note-on key back out of the built bytes shows
    // the alter travelled end to end; a null or omitted alter stays unchanged
    // so the loop is backward compatible.
    function oneNoteModel(alter) {
      const note = { rest: false, step: "B", octave: 4, duration: 1, type: "quarter" };
      if (alter !== undefined) note.alter = alter;
      return {
        workTitle: "Accessible Music PoC B flat sample",
        divisions: 1,
        key: { fifths: 0 },
        time: { beats: 4, beatType: 4 },
        parts: [{ id: "P1", name: "Melody", measures: [{ number: "1", notes: [note] }] }],
      };
    }
    function firstNoteOnKey(model) {
      const on = walkEvents(buildMidi(model)).filter(function (e) { return e.kind === "on"; })[0];
      return on ? on.key : null;
    }
    const bFlatKey = firstNoteOnKey(oneNoteModel(-1));
    const bNaturalKey = firstNoteOnKey(oneNoteModel()); // alter omitted
    const bNullAlterKey = firstNoteOnKey(oneNoteModel(null));

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
      // A chord's note-ons land on ONE absolute tick (delta 0 after the first).
      chordsTriadSimultaneousOns:
        chordsEvents[0].kind === "on" && chordsEvents[0].key === 60 && chordsEvents[0].tick === 0 && chordsEvents[0].delta === 0 &&
        chordsEvents[1].kind === "on" && chordsEvents[1].key === 64 && chordsEvents[1].tick === 0 && chordsEvents[1].delta === 0 &&
        chordsEvents[2].kind === "on" && chordsEvents[2].key === 67 && chordsEvents[2].tick === 0 && chordsEvents[2].delta === 0,
      // ...and its note-offs share the tick after the shared duration.
      chordsTriadHeldThenReleasedTogether:
        chordsEvents[3].kind === "off" && chordsEvents[3].key === 60 && chordsEvents[3].tick === 480 && chordsEvents[3].delta === 480 &&
        chordsEvents[4].kind === "off" && chordsEvents[4].key === 64 && chordsEvents[4].tick === 480 && chordsEvents[4].delta === 0 &&
        chordsEvents[5].kind === "off" && chordsEvents[5].key === 67 && chordsEvents[5].tick === 480 && chordsEvents[5].delta === 0,
      chordsMelodyNoteUnchanged:
        chordsEvents[6].kind === "on" && chordsEvents[6].key === 62 && chordsEvents[6].tick === 480 && chordsEvents[6].delta === 0 &&
        chordsEvents[7].kind === "off" && chordsEvents[7].key === 62 && chordsEvents[7].tick === 960 && chordsEvents[7].delta === 480,
      // Rest re-expressed for the absolute-tick build: the rest emits no event, so
      // the FOLLOWING note-on (bar-2 F4) sits at its own absolute tick 1920, its
      // delta (480) spanning the gap the rest left behind.
      chordsRestGapCarriedToNextOn:
        chordsEvents[12].kind === "on" && chordsEvents[12].key === 65 && chordsEvents[12].tick === 1920 && chordsEvents[12].delta === 480,
      // Where F4 ends and the bar-2 triad begins on one tick (2880), the note-off
      // is emitted before the note-on, so the held note is not clipped.
      offBeforeOnAtSharedTick:
        chordsEvents[13].kind === "off" && chordsEvents[13].key === 65 && chordsEvents[13].tick === 2880 &&
        chordsEvents[14].kind === "on" && chordsEvents[14].tick === 2880,
      chordsBar2TriadMinim:
        chordsEvents[14].kind === "on" && chordsEvents[14].key === 60 && chordsEvents[14].tick === 2880 && chordsEvents[14].delta === 0 &&
        chordsEvents[15].kind === "on" && chordsEvents[15].key === 64 && chordsEvents[15].tick === 2880 && chordsEvents[15].delta === 0 &&
        chordsEvents[16].kind === "on" && chordsEvents[16].key === 67 && chordsEvents[16].tick === 2880 && chordsEvents[16].delta === 0 &&
        chordsEvents[17].kind === "off" && chordsEvents[17].key === 60 && chordsEvents[17].tick === 3840 && chordsEvents[17].delta === 960,
      // Single-voice rest re-expressed the same way: bar-2 C5 follows the rest at
      // absolute tick 3360, its delta (480) carrying the rest's gap.
      modelRestGapCarriedToNextOn:
        (function () {
          const c5On = walkEvents(bytes).find(function (e) { return e.kind === "on" && e.key === 72; });
          return !!c5On && c5On.tick === 3360 && c5On.delta === 480;
        })(),
      // Two staves that share onset 0 produce two note-ons at ONE absolute tick,
      // the second at delta 0 — the piano's two hands no longer play in sequence.
      twoStaffSharedOnset:
        twoStaffEvents[0].kind === "on" && twoStaffEvents[0].key === 72 && twoStaffEvents[0].tick === 0 &&
        twoStaffEvents[1].kind === "on" && twoStaffEvents[1].key === 48 && twoStaffEvents[1].tick === 0 && twoStaffEvents[1].delta === 0,
      // Two parts aligned: the part-2 note-on shares tick 0 with the part-1 note-on
      // at bar 1 — four voices overlap instead of serialising end to end.
      twoPartSharedOnset:
        twoPartEvents[0].kind === "on" && twoPartEvents[0].key === 60 && twoPartEvents[0].tick === 0 &&
        twoPartEvents[1].kind === "on" && twoPartEvents[1].key === 48 && twoPartEvents[1].tick === 0 && twoPartEvents[1].delta === 0,
      // ...and the file spans the aligned length (8 quarters), not the 16-quarter
      // sum of both parts laid end to end.
      twoPartLengthIsAligned: twoPartMaxTick === 8 * MIDI_DIVISION,
      // Accidentals (Phase 2): the note's own alter reaches the saved file.
      midiBFlatIsOneSemitoneDown: bFlatKey === bNaturalKey - 1,
      midiNaturalUnchanged: bNaturalKey === 71,
      midiNullAlterMatchesNatural: bNullAlterKey === bNaturalKey,
    };

    console.table(results);
    return results;
  }

  return { buildMidi, selfTest };
})();

window.MusicMidiBuild = MusicMidiBuild;
