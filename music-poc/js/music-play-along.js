// music-play-along.js
// Play-along highlighting service for the Accessible Music proof of concept.
//
// The non-visual glue of Stage 8: it subscribes to MusicAudio.onNote and, on
// each scheduled note index during playback, advances the OSMD score cursor and
// moves aria-current onto the matching note <li> in the screen reader note list.
// It owns no UI of its own and never renders. Like the renderers it is built to
// never throw: the per-note handler degrades quietly if the score or note list
// is absent. The music-app.js wiring (reset on upload/transpose/Stop) is a
// separate step. Exposed as window.MusicPlayAlong.

const MusicPlayAlong = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer guards that capture the OBJECTS (not destructured methods) so the
  // selfTest can spy on their methods and cursor calls reach the live object.
  const audio = window.MusicAudio || { onNote() {} };
  const score = window.MusicRenderScore || {
    cursorShow() { return false; },
    cursorNext() { return false; },
    cursorReset() { return false; },
    cursorHide() { return false; },
  };

  // Private state for the current playback run.
  let noteItems = []; // cached flat note <li> list for the current playback
  let prevLi = null; // the <li> currently carrying aria-current
  let cursorAt = 0; // OSMD cursor position we have stepped the cursor to

  // The flat, ordered note <li>s from the page note list: one per note AND rest,
  // in parts -> measures -> notes order, so index N is the Nth schedule entry.
  function noteListItems() {
    const mount = document.getElementById("noteListMount");
    return mount ? Array.from(mount.querySelectorAll("ol ol > li")) : [];
  }

  // Drop aria-current from whatever <li> currently carries it.
  function clearAria() {
    if (prevLi) prevLi.removeAttribute("aria-current");
    prevLi = null;
  }

  // Move aria-current onto li (clearing it from the previous one first). A null
  // li just clears, leaving nothing current.
  function setAria(li) {
    clearAria();
    if (li) {
      li.setAttribute("aria-current", "true");
      prevLi = li;
    }
  }

  // The onNote subscriber, fired once per scheduled entry (rests included).
  // NEVER throws. aria-current is driven directly by index, so it stays exact
  // over rests regardless of where OSMD's visible cursor lands.
  function handleNote(index) {
    if (index === 0) {
      // Playback has (re)started: reset and show the cursor, recache the list.
      score.cursorReset();
      score.cursorShow();
      cursorAt = 0;
      noteItems = noteListItems();
    } else if (index > 0) {
      // A late subscription could miss index 0, so recache if we have nothing.
      if (!noteItems.length) noteItems = noteListItems();
      // Step the visible cursor forward until it matches the current index.
      while (cursorAt < index) {
        score.cursorNext();
        cursorAt += 1;
      }
    }

    setAria(noteItems[index] || null);
  }

  // Reset all play-along state and hide the cursor. The app calls this on a new
  // upload/transpose and on Stop. NEVER throws.
  function reset() {
    clearAria();
    score.cursorHide();
    score.cursorReset();
    cursorAt = 0;
    noteItems = [];
    prevLi = null;
  }

  // (Re)subscribe the per-note handler to playback.
  function register() {
    audio.onNote(handleNote);
  }

  // Self-test: synchronous; spies on the cursor ops, uses no audio and no real
  // OSMD render. It swaps a counting spy onto each live MusicRenderScore cursor
  // method (the score guard holds that same object, so handleNote drives the
  // spies), builds a known three-note list into #noteListMount, feeds three
  // indices, asserts, then restores both the note list and the cursor methods.
  function selfTest() {
    // Save and spy the live cursor methods so handleNote's calls are counted.
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

    // Save the note-list mount's current children, then build a test list with
    // the structure noteListItems() expects: an <ol> > measure <li> ("Bar 1")
    // whose nested <ol> holds three note <li>s, so "ol ol > li" finds n0..n2.
    const mount = document.getElementById("noteListMount");
    const savedNodes = mount ? Array.from(mount.childNodes) : null;
    let n0 = null;
    let n1 = null;
    let n2 = null;
    if (mount) {
      mount.replaceChildren();
      const outer = document.createElement("ol");
      const measure = document.createElement("li");
      measure.appendChild(document.createTextNode("Bar 1"));
      const inner = document.createElement("ol");
      n0 = document.createElement("li");
      n0.textContent = "n0";
      n1 = document.createElement("li");
      n1.textContent = "n1";
      n2 = document.createElement("li");
      n2.textContent = "n2";
      inner.appendChild(n0);
      inner.appendChild(n1);
      inner.appendChild(n2);
      measure.appendChild(inner);
      outer.appendChild(measure);
      mount.appendChild(outer);
    }

    // Drive three scheduled indices through the handler.
    handleNote(0);
    handleNote(1);
    handleNote(2);

    // Capture the spy counts BEFORE reset() so the start-of-play counts stand.
    const showOnStart = counts.show;
    const resetOnStart = counts.reset;
    const nextDuringPlay = counts.next;

    const testItems = mount ? Array.from(mount.querySelectorAll("ol ol > li")) : [];
    const currentDuringPlay = testItems.filter(function (li) {
      return li.getAttribute("aria-current") === "true";
    });

    const results = {
      hasRegister: typeof register === "function",
      hasReset: typeof reset === "function",
      hasSelfTest: typeof selfTest === "function",
      cursorResetOnceOnStart: resetOnStart === 1,
      cursorShowOnceOnStart: showOnStart === 1,
      cursorNextTwice: nextDuringPlay === 2,
      ariaOnThirdItem: !!n2 && n2.getAttribute("aria-current") === "true",
      ariaClearedFromOthers:
        !!n0 && !!n1 && !n0.hasAttribute("aria-current") && !n1.hasAttribute("aria-current"),
      singleAriaCurrent: currentDuringPlay.length === 1,
    };

    // Now reset and assert the teardown behaviour.
    reset();
    results.cursorHidden = counts.hide >= 1;
    const currentAfterReset = (mount ? Array.from(mount.querySelectorAll("ol ol > li")) : []).filter(
      function (li) {
        return li.hasAttribute("aria-current");
      }
    );
    results.ariaClearedAfterReset = currentAfterReset.length === 0;

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
