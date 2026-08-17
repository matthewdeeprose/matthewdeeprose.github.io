// music-play-along.js
// Play-along highlighting service for the Accessible Music proof of concept.
//
// The non-visual glue of Stage 5.6c: a clock-driven, identity-mapped, per-slice
// highlighter. Rather than being pushed one note at a time, it reads the audio
// clock every animation frame (MusicAudio.getElapsed) against the schedule being
// played (MusicAudio.getSchedule) and, on each frame, lights up EVERY note whose
// sounding window contains the current instant — so simultaneous hands, voices
// and chord tones highlight together (M1-03) — and advances the OSMD score cursor
// once per distinct start time crossed, driven by the same clock so it cannot
// drift (M3-07). Each entry resolves to its note <li> by NOTE IDENTITY, not by
// document position: the schedule carries the model's OWN note objects by
// reference (music-onset keeps each event's group, music-audio-schedule copies it
// onto the entry as entry.notes), and Stage 51 gave every leaf note item the very
// same objects on a musicNotes property. A run therefore builds one
// note-object-to-item Map and looks each entry up in it. Identity is what lets the
// note list be REORDERED without breaking the highlight, because nothing in the
// frame path then depends on document order. The old positional lookup by seq
// survives only as a fallback for a page whose renderer predates musicNotes. It
// owns no UI of its own and never renders. Like the renderers it is built to
// never throw: every function degrades quietly if the score, note list or audio
// surface is absent. Lifecycle is driven by MusicAudio.onPlaybackStart and
// onPlaybackStop; the retained onNote is no longer used. Exposed as
// window.MusicPlayAlong.

const MusicPlayAlong = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer guards that capture the OBJECTS (not destructured methods) so the
  // selfTest can spy on their methods and cursor calls reach the live object.
  // The audio fallback carries the full clock surface so start()/frame() never
  // throw when MusicAudio is absent.
  const audio = window.MusicAudio || {
    onNote() {},
    onPlaybackStart() {},
    onPlaybackStop() {},
    getElapsed() { return null; },
    getSchedule() { return []; },
  };
  const score = window.MusicRenderScore || {
    cursorShow() { return false; },
    cursorNext() { return false; },
    cursorReset() { return false; },
    cursorHide() { return false; },
  };

  // Frame scheduling: bound so `this` stays correct, with silent fallbacks so a
  // headless/absent environment degrades quietly rather than throwing.
  const raf = typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : function () { return 0; };
  const caf = typeof window.cancelAnimationFrame === "function"
    ? window.cancelAnimationFrame.bind(window)
    : function () {};

  // Private state for the current playback run.
  let noteItems = []; // cached flat leaf note <li> list for the current playback
  let activeLis = []; // the <li>s currently carrying aria-current this frame
  let cursorAt = 0; // OSMD cursor position we have stepped the cursor to
  let schedule = []; // the schedule entries currently being played
  let sliceTimes = []; // sorted distinct start seconds (one per simultaneity slice)
  let totalDuration = 0; // greatest startSeconds + durationSeconds across the run
  let rafId = null; // the pending requestAnimationFrame handle, or null
  let noteItemByNote = null; // Map of note object -> its leaf note <li> for this run, or null when mapping positionally

  // The flat, ordered LEAF note <li>s from the page note list: every <li> that
  // has NO nested <ol>, in document order. This keeps only the note items and
  // excludes the measure and staff-heading <li>s (which each contain a nested
  // <ol>). Each leaf carries its event's note group on a musicNotes property
  // (Stage 51) — the model's OWN note objects, the same ones the schedule carries
  // by reference on entry.notes — so an entry is resolved by note identity rather
  // than by this list's order. The document order still matters for the
  // positional fallback (index N lines up with the entry whose seq is N), which
  // exists only for a page whose renderer predates musicNotes; identity is what
  // lets the note list be reordered without breaking the highlight.
  function leafNoteItems() {
    const mount = document.getElementById("noteListMount");
    if (!mount) return [];
    return Array.from(mount.querySelectorAll("li")).filter(function (li) {
      return !li.querySelector("ol");
    });
  }

  // Build this run's note-object-to-item lookup from the leaf item array. Walks
  // the items in order and maps EVERY note in an item's musicNotes array to that
  // item, not only the head note: the walk that builds the note list and the walk
  // that builds the onset timeline group notes independently in principle, so
  // keying on every note survives a grouping divergence between them. Returns
  // null when NO item carried the property, which means an old renderer and lets
  // the caller fall back to positional mapping. When only SOME items carried it,
  // still returns the Map and warns, because that is a partial render rather than
  // an old page. Pure apart from reading the elements. NEVER throws.
  function buildNoteItemMap(items) {
    const list = Array.isArray(items) ? items : [];
    const map = new Map();
    let carrying = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const notes = item && Array.isArray(item.musicNotes) ? item.musicNotes : null;
      if (!notes || !notes.length) continue;
      carrying += 1;
      for (let n = 0; n < notes.length; n++) {
        if (notes[n] && !map.has(notes[n])) map.set(notes[n], item);
      }
    }
    if (carrying === 0) return null;
    if (carrying < list.length) {
      logWarn(
        "Play-along note map: " + (list.length - carrying) + " of " + list.length +
        " note items carried no musicNotes — partial render, those entries will not resolve"
      );
    }
    return map;
  }

  // Resolve one schedule entry to its leaf note <li>, or null. With the identity
  // map present, try each of the entry's notes in order and return the first item
  // the map holds; an entry no note of which resolves gives null and does NOT fall
  // back to the index, because in a mapped run an unresolved entry means the two
  // walks disagree and the index would then be a guess. With no map, fall back to
  // the old positional lookup by seq. NEVER throws.
  function itemForEntry(entry) {
    if (!entry) return null;

    if (noteItemByNote) {
      const notes = Array.isArray(entry.notes) ? entry.notes : null;
      if (!notes || !notes.length) return null;
      for (let i = 0; i < notes.length; i++) {
        const item = noteItemByNote.get(notes[i]);
        if (item) return item;
      }
      return null;
    }

    return noteItems[entry.seq] || null;
  }

  // The entries whose sounding window contains elapsed: startSeconds <= elapsed
  // AND elapsed < startSeconds + durationSeconds. Returns an array (possibly
  // several, when hands/voices/chord tones sound together). NEVER throws.
  function activeEntriesAt(entries, elapsed) {
    if (!Array.isArray(entries)) return [];
    return entries.filter(function (entry) {
      return entry.startSeconds <= elapsed && elapsed < entry.startSeconds + entry.durationSeconds;
    });
  }

  // The 0-based index of the current simultaneity slice: the count of distinct
  // start times at or before elapsed, minus one (floored at 0), so at elapsed 0
  // the first slice is index 0. NEVER throws.
  function sliceIndexAt(times, elapsed) {
    if (!Array.isArray(times) || !times.length) return 0;
    let count = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] <= elapsed) count += 1;
    }
    return Math.max(0, count - 1);
  }

  // Drop aria-current from every <li> we set this run, then empty the set.
  // NEVER throws.
  function clearActive() {
    for (let i = 0; i < activeLis.length; i++) {
      if (activeLis[i]) activeLis[i].removeAttribute("aria-current");
    }
    activeLis = [];
  }

  // Make lis the current set: clear the previous set, then set aria-current on
  // each DISTINCT <li> in lis and collect it. A null or empty list just clears,
  // leaving nothing current. NEVER throws.
  function setActive(lis) {
    clearActive();
    if (!Array.isArray(lis)) return;
    for (let i = 0; i < lis.length; i++) {
      const li = lis[i];
      if (li && activeLis.indexOf(li) === -1) {
        li.setAttribute("aria-current", "true");
        activeLis.push(li);
      }
    }
  }

  // Step the visible OSMD cursor forward until it reaches index. Forward-only:
  // the clock only advances, so the cursor simply catches up one slice at a time.
  // NEVER throws.
  function stepCursorTo(index) {
    while (cursorAt < index) {
      score.cursorNext();
      cursorAt += 1;
    }
  }

  // The per-frame core, taking elapsed so the selfTest can drive it synchronously.
  // Lights every note active at elapsed (each mapped to its <li> by note identity)
  // so simultaneous notes highlight together, and advances the cursor to the
  // current slice. A null elapsed is a no-op. NEVER throws.
  function applyFrame(elapsed) {
    if (elapsed === null) return;
    const active = activeEntriesAt(schedule, elapsed);
    const lis = [];
    for (let i = 0; i < active.length; i++) {
      const li = itemForEntry(active[i]);
      if (li) lis.push(li);
    }
    setActive(lis);
    stepCursorTo(sliceIndexAt(sliceTimes, elapsed));
  }

  // Begin a playback run: recache the leaf note list and the schedule, derive the
  // slice times and total duration, reset and show the cursor, then start the
  // frame loop. Fired by onPlaybackStart. NEVER throws.
  function start() {
    noteItems = leafNoteItems();

    // The identity lookup for this run. Null means no item carried musicNotes, so
    // the frame path falls back to positional mapping — warned ONCE here, never
    // per frame.
    noteItemByNote = buildNoteItemMap(noteItems);
    if (!noteItemByNote) {
      logWarn(
        "No note item carried musicNotes — play-along has fallen back to positional mapping, which is order-dependent"
      );
    }

    schedule = audio.getSchedule() || [];

    // Distinct start times, sorted ascending — one per simultaneity slice.
    const seen = [];
    for (let i = 0; i < schedule.length; i++) {
      const s = schedule[i].startSeconds;
      if (seen.indexOf(s) === -1) seen.push(s);
    }
    seen.sort(function (a, b) { return a - b; });
    sliceTimes = seen;

    // The greatest end time across the run (0 when the schedule is empty).
    let maxEnd = 0;
    for (let i = 0; i < schedule.length; i++) {
      const end = schedule[i].startSeconds + schedule[i].durationSeconds;
      if (end > maxEnd) maxEnd = end;
    }
    totalDuration = maxEnd;

    score.cursorReset();
    score.cursorShow();
    cursorAt = 0;

    const mapping = noteItemByNote
      ? "by identity over " + noteItemByNote.size + " note" + (noteItemByNote.size === 1 ? "" : "s")
      : "by position";
    logInfo(
      "Play-along started over " + schedule.length + " entr" + (schedule.length === 1 ? "y" : "ies") +
      ", mapping " + mapping
    );

    // Kick off the audio-clock frame loop.
    rafId = raf(frame);
  }

  // One animation frame: read the audio clock and place the highlight. A null
  // clock means playback has stopped, so tear down. Past the end of the piece,
  // clear the highlight and stop looping but leave the cursor where it finished.
  // NEVER throws.
  function frame() {
    const elapsed = audio.getElapsed();
    if (elapsed === null) {
      teardown();
      return;
    }
    if (elapsed > totalDuration) {
      clearActive();
      return; // do not schedule another frame; leave the cursor in place
    }
    applyFrame(elapsed);
    rafId = raf(frame);
  }

  // Stop the frame loop and clear all play-along state: cancel any pending frame,
  // clear the highlight, hide and reset the cursor. Fired by onPlaybackStop and by
  // reset(). NEVER throws.
  function teardown() {
    caf(rafId);
    clearActive();
    score.cursorHide();
    score.cursorReset();
    cursorAt = 0;
    noteItems = [];
    noteItemByNote = null;
    schedule = [];
    sliceTimes = [];
    totalDuration = 0;
    rafId = null;
  }

  // Reset all play-along state. The app calls this on a new upload/transpose and
  // on Stop. NEVER throws.
  function reset() {
    teardown();
  }

  // Subscribe the lifecycle to playback: start on play, tear down on stop. The
  // retained onNote is no longer used.
  function register() {
    audio.onPlaybackStart(start);
    audio.onPlaybackStop(teardown);
  }

  // Self-test: synchronous; exercises the pure core with no real audio and no
  // rAF. It spies on the live cursor methods (the score guard holds that same
  // object, so applyFrame/stepCursorTo drive the spies), builds a MULTI-STAFF
  // note list into #noteListMount whose items carry stand-in note objects on
  // musicNotes, drives the identity-mapped per-slice model by hand (including the
  // positional fallback), asserts, then restores both the note list and the
  // cursor methods.
  function selfTest() {
    // Save and spy the live cursor methods so cursor calls are counted.
    const liveScore = window.MusicRenderScore;
    const savedMethods = {};
    const counts = { show: 0, next: 0, reset: 0, hide: 0 };
    if (liveScore) {
      savedMethods.cursorShow = liveScore.cursorShow;
      savedMethods.cursorNext = liveScore.cursorNext;
      savedMethods.cursorReset = liveScore.cursorReset;
      savedMethods.cursorHide = liveScore.cursorHide;
      liveScore.cursorShow = function () { counts.show += 1; return true; };
      liveScore.cursorNext = function () { counts.next += 1; return true; };
      liveScore.cursorReset = function () { counts.reset += 1; return true; };
      liveScore.cursorHide = function () { counts.hide += 1; return true; };
    }

    // Four distinct plain objects standing in for the model's note objects. Each
    // note <li> below carries one on musicNotes, exactly as the renderer attaches
    // the event's group, and each schedule entry carries the SAME object on its
    // notes array, exactly as music-audio-schedule copies it from music-onset.
    const noteA = { step: "A" };
    const noteB = { step: "B" };
    const noteC = { step: "C" };
    const noteD = { step: "D" };

    // Save the mount's current children, then build a MULTI-STAFF bar so the leaf
    // selector is genuinely tested: an <ol> > measure <li> ("Bar 1") whose nested
    // staff <ol> holds two staff <li>s ("Treble"/"Bass"), each carrying its own
    // note <ol> of note <li>s. leafNoteItems() must return ONLY the four note
    // <li>s (n0..n3), in document order, excluding the measure and staff <li>s.
    const mount = document.getElementById("noteListMount");
    const savedNodes = mount ? Array.from(mount.childNodes) : null;
    let n0 = null;
    let n1 = null;
    let n2 = null;
    let n3 = null;
    let measureLi = null;
    let trebleLi = null;
    let bassLi = null;
    if (mount) {
      mount.replaceChildren();
      const outer = document.createElement("ol");
      measureLi = document.createElement("li");
      measureLi.appendChild(document.createTextNode("Bar 1"));
      const staffOl = document.createElement("ol");

      trebleLi = document.createElement("li");
      trebleLi.appendChild(document.createTextNode("Treble"));
      const trebleNotes = document.createElement("ol");
      n0 = document.createElement("li");
      n0.textContent = "n0";
      n0.musicNotes = [noteA];
      n1 = document.createElement("li");
      n1.textContent = "n1";
      n1.musicNotes = [noteB];
      trebleNotes.appendChild(n0);
      trebleNotes.appendChild(n1);
      trebleLi.appendChild(trebleNotes);

      bassLi = document.createElement("li");
      bassLi.appendChild(document.createTextNode("Bass"));
      const bassNotes = document.createElement("ol");
      n2 = document.createElement("li");
      n2.textContent = "n2";
      n2.musicNotes = [noteC];
      n3 = document.createElement("li");
      n3.textContent = "n3";
      n3.musicNotes = [noteD];
      bassNotes.appendChild(n2);
      bassNotes.appendChild(n3);
      bassLi.appendChild(bassNotes);

      staffOl.appendChild(trebleLi);
      staffOl.appendChild(bassLi);
      measureLi.appendChild(staffOl);
      outer.appendChild(measureLi);
      mount.appendChild(outer);
    }

    // Leaf selector: only the four note <li>s, in document order.
    const leaves = leafNoteItems();
    const leafOnlyNotesInOrder =
      leaves.length === 4 &&
      leaves[0] === n0 && leaves[1] === n1 && leaves[2] === n2 && leaves[3] === n3;
    const leafExcludesHeadings =
      leaves.indexOf(measureLi) === -1 &&
      leaves.indexOf(trebleLi) === -1 &&
      leaves.indexOf(bassLi) === -1;

    // A schedule with two simultaneity slices, each holding two simultaneous
    // entries (one per staff). Each entry carries BOTH its note object (the
    // identity route) and its seq (the fallback route), and the two agree, so the
    // slices are exactly the ones the existing rows already describe. Slice 0
    // (start 0): n0 + n2. Slice 1 (start 1): n1 + n3.
    const testSchedule = [
      { seq: 0, startSeconds: 0, durationSeconds: 1, notes: [noteA] },
      { seq: 2, startSeconds: 0, durationSeconds: 1, notes: [noteC] },
      { seq: 1, startSeconds: 1, durationSeconds: 1, notes: [noteB] },
      { seq: 3, startSeconds: 1, durationSeconds: 1, notes: [noteD] },
    ];

    // buildNoteItemMap over standalone items, away from the module state: a chord
    // item carrying three notes yields three keys, all pointing at that one item.
    const chordNoteX = { step: "X" };
    const chordNoteY = { step: "Y" };
    const chordNoteZ = { step: "Z" };
    const chordItem = document.createElement("li");
    chordItem.musicNotes = [chordNoteX, chordNoteY, chordNoteZ];
    const chordMap = buildNoteItemMap([chordItem]);
    const mapKeysEveryNoteNotJustHead =
      !!chordMap && chordMap.size === 3 &&
      chordMap.get(chordNoteX) === chordItem &&
      chordMap.get(chordNoteY) === chordItem &&
      chordMap.get(chordNoteZ) === chordItem;

    // An old renderer's items carry nothing, so there is no map to build.
    const bareItem = document.createElement("li");
    const bareItemTwo = document.createElement("li");
    const mapNullWhenNoItemCarriesNotes = buildNoteItemMap([bareItem, bareItemTwo]) === null;

    // A partial render still yields a Map (and warns), holding only the notes of
    // the items that actually carried the property.
    const mixedNote = { step: "M" };
    const mixedItem = document.createElement("li");
    mixedItem.musicNotes = [mixedNote];
    const mixedMap = buildNoteItemMap([bareItem, mixedItem, bareItemTwo]);
    const mapBuiltFromBareAndCarrying =
      !!mixedMap && mixedMap.size === 1 && mixedMap.get(mixedNote) === mixedItem;

    // activeEntriesAt: exactly the entries whose window contains the time,
    // including the two simultaneous ones sharing a start.
    const activeAtZero = activeEntriesAt(testSchedule, 0);
    const activeEntriesAtSimultaneous =
      activeAtZero.length === 2 &&
      activeAtZero.indexOf(testSchedule[0]) !== -1 &&
      activeAtZero.indexOf(testSchedule[1]) !== -1;
    const activeAtOne = activeEntriesAt(testSchedule, 1);
    const activeEntriesAtLaterSlice =
      activeAtOne.length === 2 &&
      activeAtOne.indexOf(testSchedule[2]) !== -1 &&
      activeAtOne.indexOf(testSchedule[3]) !== -1;

    // sliceIndexAt: 0 at elapsed 0, advancing one per distinct start crossed.
    const testSliceTimes = [0, 1];
    const sliceIndexZeroAtStart = sliceIndexAt(testSliceTimes, 0) === 0;
    const sliceIndexAdvancesPerStart =
      sliceIndexAt(testSliceTimes, 0.5) === 0 && sliceIndexAt(testSliceTimes, 1) === 1;

    // Set the module state up for applyFrame, exactly as start() would — the
    // identity map included, built from the same leaf list.
    noteItems = leaves;
    noteItemByNote = buildNoteItemMap(leaves);
    schedule = testSchedule;
    sliceTimes = testSliceTimes;
    totalDuration = 2;
    cursorAt = 0;
    activeLis = [];

    // itemForEntry with the map present: identity decides, and the seq is not
    // consulted at all. The scrambled-seq row is the one that proves the stage.
    const unknownNote = { step: "unknown" };
    const identityResolvesToItsItem = itemForEntry(testSchedule[0]) === n0;
    const identityIgnoresSeqWhenMapped =
      itemForEntry({ seq: 3, startSeconds: 0, durationSeconds: 1, notes: [noteA] }) === n0;
    const identityTriesEveryNoteInEntry =
      itemForEntry({ seq: 0, startSeconds: 0, durationSeconds: 1, notes: [unknownNote, noteD] }) === n3;
    const unresolvedEntryYieldsNull =
      itemForEntry({ seq: 0, startSeconds: 0, durationSeconds: 1, notes: [unknownNote] }) === null;
    const entryWithNoNotesYieldsNull =
      itemForEntry({ seq: 0, startSeconds: 0, durationSeconds: 1 }) === null;

    // Malformed entries and item lists degrade quietly rather than throwing.
    const neverThrowsOnMalformedEntries = (function () {
      try {
        itemForEntry(null);
        itemForEntry(undefined);
        itemForEntry({});
        itemForEntry({ notes: null });
        itemForEntry({ notes: [] });
        itemForEntry({ notes: [null, undefined, 7, "x"] });
        itemForEntry({ seq: "nope", notes: "not an array" });
        buildNoteItemMap(null);
        buildNoteItemMap([null, undefined, { musicNotes: "not an array" }, { musicNotes: [] }]);
        return true;
      } catch (error) {
        return false;
      }
    })();

    // Frame at slice 0: BOTH simultaneous notes (n0, n2) light up (M1-03).
    applyFrame(0);
    const simultaneityAtSliceZero =
      n0.getAttribute("aria-current") === "true" &&
      n2.getAttribute("aria-current") === "true" &&
      !n1.hasAttribute("aria-current") &&
      !n3.hasAttribute("aria-current");
    const nextAfterSliceZero = counts.next; // expected 0: slice index 0

    // Frame at slice 1: the previous set clears, the new set (n1, n3) lights up,
    // and the cursor advances exactly ONCE for the whole slice (not per note).
    applyFrame(1);
    const staleCleared =
      !n0.hasAttribute("aria-current") && !n2.hasAttribute("aria-current");
    const newSliceSet =
      n1.getAttribute("aria-current") === "true" &&
      n3.getAttribute("aria-current") === "true";
    const cursorAdvancedOncePerSlice = counts.next - nextAfterSliceZero === 1;

    // The frame path itself maps by identity: with every seq deliberately
    // scrambled (and one pointing past the list), applyFrame still lights exactly
    // the two items whose notes are sounding. The cursor is left alone here — the
    // slice index is 0 and cursorAt has already passed it, so stepCursorTo is a
    // no-op and the cursor rows above are unaffected.
    schedule = [
      { seq: 3, startSeconds: 0, durationSeconds: 1, notes: [noteA] },
      { seq: 9, startSeconds: 0, durationSeconds: 1, notes: [noteC] },
      { seq: 0, startSeconds: 1, durationSeconds: 1, notes: [noteB] },
    ];
    applyFrame(0);
    const applyFrameHighlightsByIdentity =
      n0.getAttribute("aria-current") === "true" &&
      n2.getAttribute("aria-current") === "true" &&
      !n1.hasAttribute("aria-current") &&
      !n3.hasAttribute("aria-current");

    // With no map — a page whose renderer predates musicNotes — an entry resolves
    // by seq exactly as before. The note object here belongs to n0, so resolving
    // to n2 proves the seq was used and the identity route was not.
    noteItemByNote = null;
    const positionalFallbackWhenNoMap =
      itemForEntry({ seq: 2, startSeconds: 0, durationSeconds: 1, notes: [noteA] }) === n2;
    const fallbackOutOfRangeStillNull =
      itemForEntry({ seq: 9, startSeconds: 0, durationSeconds: 1 }) === null;

    // Put the map back so the teardown row proves it is genuinely cleared.
    noteItemByNote = buildNoteItemMap(leaves);

    // Teardown clears every aria-current, hides the cursor and drops the map.
    teardown();
    const anyCurrentAfterTeardown = leaves.some(function (li) {
      return li.hasAttribute("aria-current");
    });
    const mapClearedOnTeardown = noteItemByNote === null;

    const results = {
      hasRegister: typeof register === "function",
      hasReset: typeof reset === "function",
      hasSelfTest: typeof selfTest === "function",
      leafOnlyNotesInOrder: leafOnlyNotesInOrder,
      leafExcludesHeadings: leafExcludesHeadings,
      activeEntriesAtSimultaneous: activeEntriesAtSimultaneous,
      activeEntriesAtLaterSlice: activeEntriesAtLaterSlice,
      sliceIndexZeroAtStart: sliceIndexZeroAtStart,
      sliceIndexAdvancesPerStart: sliceIndexAdvancesPerStart,
      simultaneityAtSliceZero: simultaneityAtSliceZero, // M1-03
      staleCleared: staleCleared,
      newSliceSet: newSliceSet,
      cursorAdvancedOncePerSlice: cursorAdvancedOncePerSlice, // M3-07
      cursorHiddenOnTeardown: counts.hide >= 1,
      ariaClearedOnTeardown: anyCurrentAfterTeardown === false,
      // Stage 52 (identity mapping): a schedule entry resolves to its note item
      // by note object, so the note list's document order no longer decides the
      // highlight. The positional lookup survives only as a fallback.
      hasBuildNoteItemMap: typeof buildNoteItemMap === "function",
      mapKeysEveryNoteNotJustHead: mapKeysEveryNoteNotJustHead,
      mapNullWhenNoItemCarriesNotes: mapNullWhenNoItemCarriesNotes,
      mapBuiltFromBareAndCarrying: mapBuiltFromBareAndCarrying,
      identityResolvesToItsItem: identityResolvesToItsItem,
      identityIgnoresSeqWhenMapped: identityIgnoresSeqWhenMapped, // proves the stage
      identityTriesEveryNoteInEntry: identityTriesEveryNoteInEntry,
      unresolvedEntryYieldsNull: unresolvedEntryYieldsNull,
      positionalFallbackWhenNoMap: positionalFallbackWhenNoMap,
      fallbackOutOfRangeStillNull: fallbackOutOfRangeStillNull,
      entryWithNoNotesYieldsNull: entryWithNoNotesYieldsNull,
      applyFrameHighlightsByIdentity: applyFrameHighlightsByIdentity,
      mapClearedOnTeardown: mapClearedOnTeardown,
      neverThrowsOnMalformedEntries: neverThrowsOnMalformedEntries,
    };

    // Restore the note-list mount's original children and the cursor methods.
    if (mount) mount.replaceChildren.apply(mount, savedNodes || []);
    if (liveScore) {
      liveScore.cursorShow = savedMethods.cursorShow;
      liveScore.cursorNext = savedMethods.cursorNext;
      liveScore.cursorReset = savedMethods.cursorReset;
      liveScore.cursorHide = savedMethods.cursorHide;
    }

    console.table(results);
    return results;
  }

  // Subscribe once at load so playback drives play-along immediately.
  register();

  return { register, reset, selfTest };
})();

window.MusicPlayAlong = MusicPlayAlong;
