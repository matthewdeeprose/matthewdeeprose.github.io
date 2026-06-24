// music-audio.js
// Web Audio playback service for the Accessible Music proof of concept.
//
// The effects-and-DOM half of Stage 5: it consumes the pure schedule from
// MusicAudioSchedule and plays it through the Web Audio API, and it builds the
// Play and Stop controls into a mount element. Unlike the pure schedule file it
// owns a little state (the model, a reused AudioContext, the live oscillators
// and highlight timers) and it touches the DOM. It mirrors the renderers:
// SYNCHRONOUS render that logs and returns false on bad input, and it never
// throws. A registered onNote callback fires per scheduled entry so Stage 8
// (play-along highlighting) can subscribe. Exposed as window.MusicAudio.

const MusicAudio = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side notifications: route through the shared MusicNotify when
  // present, otherwise fall back to silent no-ops so this file never notifies
  // directly if the notify layer is absent.
  const notify = window.MusicNotify || { info() {}, success() {}, warning() {}, error() {}, show() {} };

  // Consumer-side schedule provider: route through the shared MusicAudioSchedule
  // when present, otherwise fall back to neutral no-ops so this file never throws
  // if the schedule layer is absent.
  const schedule = window.MusicAudioSchedule || {
    buildSchedule() { return []; },
    pitchToMidi() { return null; },
    frequencyOf() { return null; },
  };

  // Gain envelope shape (seconds and peak). Short attack and release keep the
  // onset and end from clicking; the gentle peak avoids harsh output.
  const PEAK_GAIN = 0.2;
  const ATTACK_SECONDS = 0.005;
  const RELEASE_SECONDS = 0.03;

  // Private module state. The model and oscillators are set in render/play and
  // cleared in stop; the AudioContext is created lazily and reused across plays.
  const state = {
    model: null,
    ctx: null,
    oscillators: [],
    timeouts: [],
    onNoteCallback: null,
    playing: false,
  };

  // Build the Play and Stop controls into mountEl, wired to play()/stop(), and
  // store the model. Synchronous; returns true on success and false on any
  // failure; NEVER throws. There is no success notification — the audible
  // playback is the feedback, as with the visual renderer.
  function render(model, mountEl) {
    // Guard: we need a mount element to build into. A missing mount is a wiring
    // error, not user-facing, so we log and return without notifying.
    if (!mountEl) {
      logError("Cannot render audio controls: no mount element supplied");
      return false;
    }

    state.model = model;

    // Clear any previous render from the mount before building afresh.
    mountEl.replaceChildren();

    // Text-only buttons: the visible text is the accessible name (no title, no
    // icon). The library has a "play" icon but no "stop" icon, so keep both
    // buttons text-only and consistent.
    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.addEventListener("click", play);

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.textContent = "Stop";
    stopButton.addEventListener("click", stop);

    mountEl.appendChild(playButton);
    mountEl.appendChild(stopButton);

    logInfo("Rendered audio controls into #" + (mountEl.id || "mount"));
    return true;
  }

  // entryFrequencies(entry): the frequencies an entry should sound. Its
  // frequencies array when present (a chord has several, a single note one), else
  // the single frequency for older entries, else none for a rest. Filters out any
  // non-finite value. Pure, so the selfTest can check it without producing sound.
  function entryFrequencies(entry) {
    const e = entry || {};
    if (Array.isArray(e.frequencies)) {
      return e.frequencies.filter(function (f) { return typeof f === "number" && isFinite(f); });
    }
    if (typeof e.frequency === "number" && isFinite(e.frequency)) return [e.frequency];
    return [];
  }

  // Play the current model's schedule through the Web Audio API. Cancels any
  // in-flight playback first so a second Play restarts cleanly. NEVER throws.
  function play() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (typeof Ctx !== "function") {
      logError("Cannot play: Web Audio is not supported in this browser");
      notify.error("Audio playback is not supported in this browser");
      return;
    }

    // Cancel anything already sounding so Play always restarts from the top.
    stop();

    // Create the AudioContext lazily and reuse it; the Play click is the user
    // gesture, so resume a suspended context without awaiting.
    if (!state.ctx) {
      state.ctx = new Ctx();
    }
    if (state.ctx.state === "suspended" && typeof state.ctx.resume === "function") {
      state.ctx.resume();
    }
    const ctx = state.ctx;

    const entries = schedule.buildSchedule(state.model);
    if (!entries.length) {
      logDebug("Nothing to play: schedule is empty");
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // An event's pitches all sound together over one shared envelope: a chord
      // has several, a single note one, a rest none. Each pitch gets its own
      // oscillator and gain; the peak is split across them so a chord stays at the
      // same comfortable level as a single note rather than summing louder.
      const freqs = entryFrequencies(entry);
      if (!entry.isRest && freqs.length) {
        const t0 = ctx.currentTime + entry.startSeconds;
        const t1 = t0 + entry.durationSeconds;
        // Clamp the envelope so very short notes keep their ramps in order: the
        // release never starts before the attack has finished.
        const attackEnd = t0 + ATTACK_SECONDS;
        const releaseStart = Math.max(attackEnd, t1 - RELEASE_SECONDS);
        const peak = PEAK_GAIN / freqs.length;

        for (let f = 0; f < freqs.length; f++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freqs[f];
          osc.connect(gain);
          gain.connect(ctx.destination);

          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(peak, attackEnd);
          gain.gain.setValueAtTime(peak, releaseStart);
          gain.gain.linearRampToValueAtTime(0, t1);

          osc.start(t0);
          osc.stop(t1 + RELEASE_SECONDS);
          state.oscillators.push(osc);
        }
      }

      // Highlight hook for EVERY entry (rests included): a wall-clock timeout
      // relative to this play() call, good enough for the PoC. One callback per
      // entry keeps play-along one-to-one with the note list.
      const index = i;
      const timeoutId = setTimeout(function () {
        if (typeof state.onNoteCallback === "function") {
          state.onNoteCallback(index);
        }
      }, entry.startSeconds * 1000);
      state.timeouts.push(timeoutId);
    }

    state.playing = true;
    logInfo("Playing " + entries.length + " scheduled entr" + (entries.length === 1 ? "y" : "ies"));
  }

  // Stop all in-flight playback: silence the oscillators and cancel the
  // highlight timers. Keeps the AudioContext open for replay. NEVER throws.
  function stop() {
    for (const osc of state.oscillators) {
      // Stopping an already-finished oscillator throws, so guard each call.
      try {
        osc.stop();
      } catch (err) {
        logDebug("Oscillator stop ignored", err);
      }
      try {
        osc.disconnect();
      } catch (err) {
        logDebug("Oscillator disconnect ignored", err);
      }
    }
    state.oscillators = [];

    for (const id of state.timeouts) {
      clearTimeout(id);
    }
    state.timeouts = [];

    state.playing = false;
    logDebug("Stopped playback");
  }

  // Register (or clear) the highlight listener fired per scheduled entry. Pass a
  // function to subscribe, or null to clear. This is the hook Stage 8
  // (play-along) will use.
  function onNote(callback) {
    if (typeof callback === "function") {
      state.onNoteCallback = callback;
    } else if (callback === null) {
      state.onNoteCallback = null;
    }
  }

  // Self-test: synchronous and self-contained. It MUST NOT call play(), so no
  // sound is produced. Builds into a DETACHED temp <div> (never attached) and
  // asserts the public surface, the control markup, and the safe guards.
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
              ],
            },
          ],
        },
      ],
    };

    // A detached temp mount; never attached to the page.
    const temp = document.createElement("div");
    const renderReturnsTrue = render(MODEL, temp) === true;

    const buttons = temp.querySelectorAll("button");
    const labels = Array.from(buttons).map(function (b) { return b.textContent.trim(); });

    // Construct a bare AudioContext to confirm Web Audio is available, then
    // close it to free the resource — play() is never called here.
    const Ctx = window.AudioContext || window.webkitAudioContext;
    let audioContextConstructs = false;
    if (typeof Ctx === "function") {
      const probe = new Ctx();
      audioContextConstructs = typeof probe === "object" && probe !== null;
      if (typeof probe.close === "function") probe.close();
    }

    // onNote must accept a function and null without throwing.
    let onNoteAcceptsFunction = true;
    try {
      onNote(function () {});
      onNote(null);
    } catch (err) {
      onNoteAcceptsFunction = false;
      logDebug("onNote threw during selfTest", err);
    }

    const results = {
      hasRender: typeof render === "function",
      hasPlay: typeof play === "function",
      hasStop: typeof stop === "function",
      hasOnNote: typeof onNote === "function",
      hasSelfTest: typeof selfTest === "function",
      renderReturnsTrue: renderReturnsTrue,
      buildsTwoButtons: buttons.length === 2,
      buttonsAreTypeButton: buttons.length === 2 && buttons[0].type === "button" && buttons[1].type === "button",
      hasPlayLabel: labels.indexOf("Play") !== -1,
      hasStopLabel: labels.indexOf("Stop") !== -1,
      noTitleAttribute: buttons.length === 2 && !buttons[0].hasAttribute("title") && !buttons[1].hasAttribute("title"),
      audioContextConstructs: audioContextConstructs,
      onNoteAcceptsFunction: onNoteAcceptsFunction,
      guardNoMount: render(MODEL, null) === false,
      hasEntryFrequencies: typeof entryFrequencies === "function",
      entryFreqsChord: (function () {
        const f = entryFrequencies({ isRest: false, frequency: 261.63, frequencies: [261.63, 329.63, 392.0] });
        return f.length === 3 && f[0] === 261.63 && f[2] === 392.0;
      })(),
      entryFreqsSingle: (function () {
        const f = entryFrequencies({ isRest: false, frequency: 440, frequencies: [440] });
        return f.length === 1 && f[0] === 440;
      })(),
      entryFreqsRest: entryFrequencies({ isRest: true, frequency: null, frequencies: [] }).length === 0,
      entryFreqsLegacyFallback: (function () {
        const f = entryFrequencies({ isRest: false, frequency: 440 });
        return f.length === 1 && f[0] === 440;
      })(),
      entryFreqsFiltersNonFinite: (function () {
        const f = entryFrequencies({ isRest: false, frequencies: [440, null, NaN, 880] });
        return f.length === 2 && f[0] === 440 && f[1] === 880;
      })(),
    };

    // Tidy up: remove the temp div. The no-mount guard does not notify, so no
    // #status save/restore is needed.
    temp.remove();

    console.table(results);
    return results;
  }

  return { render, play, stop, onNote, selfTest };
})();

window.MusicAudio = MusicAudio;
