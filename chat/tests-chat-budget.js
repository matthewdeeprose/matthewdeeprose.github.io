// Unified Chat — Stage 2b-ii: Chat token-budget sliding-window maths suite
//
// Proves the PURE limit-aware sliding window added in step 2b-i
// (window.ChatCore.applyTokenWindow). Calls the REAL function — never a
// reimplementation — with a deterministic injected estimate so the suite is
// pure and network-free.
//
// STATIC SUITE — no network, no DOM mutation, no model load. Every case feeds a
// fixed thread + a fixed estimate and asserts {dropped, kept} (and, for two
// cases, payload-only immutability and suffix ordering).
//
// Shape 1 runner (the gate Playwright reads back via browser_evaluate):
//     window.ChatBudgetTests.runStructural()  →  { passed, total, results }
//
// The returned `results` is an array of { name, passed, detail } rows; the
// return object's shape ({ passed, total, results }) matches the canonical
// Shape 1 runner in tests-local-chat-isolation.js.

(function () {
  "use strict";

  // ── Logging configuration ──────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error.apply(console, ["[ChatBudgetTests]", message].concat(args));
  }
  function logWarn(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[ChatBudgetTests]", message].concat(args));
  }
  function logInfo(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[ChatBudgetTests]", message].concat(args));
  }

  // ── Console styles (match tests-local-chat-isolation.js) ────────────────
  const STYLES = {
    pass: "color: #2e7d32; font-weight: bold",
    fail: "color: #c62828; font-weight: bold",
    heading: "color: #1565c0; font-weight: bold; font-size: 1.1em",
    dim: "color: #757575",
  };

  // ── Function under test ─────────────────────────────────────────────────
  // Call the REAL pure window. If ChatCore / applyTokenWindow is absent the
  // step 2b-i wiring has not landed — do not register a misleading green.
  const CC = window.ChatCore;
  if (!CC || typeof CC.applyTokenWindow !== "function") {
    logWarn(
      "window.ChatCore.applyTokenWindow not available — Chat budget suite not registered."
    );
    return;
  }
  const applyTokenWindow = CC.applyTokenWindow;

  // ── Deterministic fixtures ──────────────────────────────────────────────
  // A fixed thread of n user turns, and an estimate that is a pure function of
  // message count (each message 10 tokens, +5 fixed overhead). With this
  // estimate the budget maths is exactly predictable.
  const est = function (a) {
    return a.length * 10 + 5;
  };
  const ten = function (n) {
    return Array.from({ length: n }, function (_, i) {
      return { role: "user", content: "m" + i };
    });
  };

  // ── Assertions ──────────────────────────────────────────────────────────
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        (message || "assertEqual") +
          " — expected " +
          JSON.stringify(expected) +
          ", got " +
          JSON.stringify(actual)
      );
    }
  }
  function assertTrue(value, message) {
    if (value !== true) {
      throw new Error(
        (message || "assertTrue") + " — expected true, got " + JSON.stringify(value)
      );
    }
  }

  // Assert {dropped, kept} for a single applyTokenWindow call. Returns a short
  // detail string for the result row.
  function assertWindow(opts, expectedDropped, expectedKept, label) {
    const r = applyTokenWindow(opts);
    assertEqual(r.dropped, expectedDropped, label + ": dropped");
    assertEqual(r.messages.length, expectedKept, label + ": kept");
    return "dropped " + r.dropped + ", kept " + r.messages.length;
  }

  // ── Cases (each a named result row) ─────────────────────────────────────
  const cases = {
    "no-trim: whole thread fits": function () {
      return assertWindow(
        { messages: ten(10), limit: 200, answerReservation: 20, safetyMargin: 0, systemPrompt: "", estimate: est },
        0,
        10,
        "no-trim"
      );
    },

    "basic trim: limit 100 drops 3": function () {
      return assertWindow(
        { messages: ten(10), limit: 100, answerReservation: 20, safetyMargin: 0, systemPrompt: "", estimate: est },
        3,
        7,
        "basic trim"
      );
    },

    "reservation raises drops: reserve 40 drops 5": function () {
      return assertWindow(
        { messages: ten(10), limit: 100, answerReservation: 40, safetyMargin: 0, systemPrompt: "", estimate: est },
        5,
        5,
        "reserve 40"
      );
    },

    "system prompt counts against the budget": function () {
      return assertWindow(
        { messages: ten(10), limit: 100, answerReservation: 20, safetyMargin: 0, systemPrompt: "You are helpful", estimate: est },
        4,
        6,
        "system prompt"
      );
    },

    "tiny window keeps only the latest turn": function () {
      return assertWindow(
        { messages: ten(10), limit: 1024, answerReservation: 2000, safetyMargin: 512, systemPrompt: "", estimate: est },
        9,
        1,
        "tiny window"
      );
    },

    "never empty: keeps the latest even when it alone overflows": function () {
      return assertWindow(
        { messages: ten(10), limit: 5, answerReservation: 0, safetyMargin: 0, systemPrompt: "", estimate: est },
        9,
        1,
        "never empty"
      );
    },

    "single message untouched even under a tiny budget": function () {
      return assertWindow(
        { messages: ten(1), limit: 5, answerReservation: 0, safetyMargin: 0, systemPrompt: "", estimate: est },
        0,
        1,
        "single message"
      );
    },

    "payload-only: returns a new array and does not mutate the input": function () {
      const input = ten(10);
      const r = applyTokenWindow({
        messages: input,
        limit: 100,
        answerReservation: 20,
        safetyMargin: 0,
        systemPrompt: "",
        estimate: est,
      });
      assertTrue(r.messages !== input, "returned messages is a NEW array, not the input");
      assertEqual(input.length, 10, "input array length unchanged after the call");
      return "new array returned; input still length " + input.length;
    },

    "suffix ordering: oldest dropped from the front (kept[0] === 'm3')": function () {
      const r = applyTokenWindow({
        messages: ten(10),
        limit: 100,
        answerReservation: 20,
        safetyMargin: 0,
        systemPrompt: "",
        estimate: est,
      });
      assertEqual(r.dropped, 3, "suffix: dropped");
      assertEqual(r.messages.length, 7, "suffix: kept");
      assertEqual(
        r.messages[0].content,
        "m3",
        "first surviving message is m3 (oldest three dropped from the front)"
      );
      return "kept[0].content = " + r.messages[0].content;
    },

    // ── Edit-plus-window coexistence (plan step 6) ────────────────────────
    // These two cases model commitEdit's truncation as DATA: edit a turn,
    // slice(0, k+1), then window. The end-to-end edit is proven separately in
    // the slice-3 browser run; here we only assert the window sees the
    // truncated payload.
    "edit-plus-window: truncation removes post-edit turns; window sees only the truncated payload":
      function () {
        const full = ten(10);
        // mirrors commitEdit — S.messages[4].content = newText;
        // S.messages = S.messages.slice(0, 5)
        full[4].content = "EDITED";
        const truncated = full.slice(0, 5);
        const r = applyTokenWindow({
          messages: truncated,
          limit: 200,
          answerReservation: 20,
          safetyMargin: 0,
          systemPrompt: "",
          estimate: est,
        }); // limit is generous so nothing trims
        assertEqual(r.dropped, 0, "edit-plus-window: nothing dropped");
        assertEqual(r.messages.length, 5, "edit-plus-window: kept all 5 truncated turns");
        assertEqual(
          r.messages[r.messages.length - 1].content,
          "EDITED",
          "edited turn is the latest in the payload"
        );
        return "truncated 5, dropped 0, last = " + r.messages[r.messages.length - 1].content;
      },

    "edit-plus-window: the truncated thread still trims from the front to fit":
      function () {
        const full = ten(10);
        full[6].content = "EDITED";
        const truncated = full.slice(0, 7); // truncated = [m0..m5, EDITED], length 7
        const r = applyTokenWindow({
          messages: truncated,
          limit: 60,
          answerReservation: 20,
          safetyMargin: 0,
          systemPrompt: "",
          estimate: est,
        }); // tight limit forces a front-drop over the truncated 7; inputBudget = 40, kept shrinks to 3
        assertEqual(r.dropped, 4, "dropped from the front of the truncated thread");
        assertEqual(r.messages.length, 3, "edit-plus-window: kept 3 after front-drop");
        assertEqual(
          r.messages[0].content,
          "m4",
          "oldest surviving is m4 (m0–m3 front-dropped)"
        );
        assertEqual(
          r.messages[r.messages.length - 1].content,
          "EDITED",
          "edited turn survives as the latest"
        );
        return "truncated 7 → kept 3 (front-dropped), last = " + r.messages[r.messages.length - 1].content;
      },
  };

  // ── Shape 1 runner ──────────────────────────────────────────────────────
  function runStructural() {
    console.log("%c══ Chat token-budget sliding window — Stage 2b-ii (static) ══", STYLES.heading);
    const results = [];
    let passed = 0;
    const names = Object.keys(cases);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      try {
        const detail = cases[name]();
        results.push({ name: name, passed: true, detail: detail || "ok" });
        passed++;
        console.log("%c  PASS %c " + name, STYLES.pass, STYLES.dim);
      } catch (err) {
        const detail = err && err.message ? err.message : String(err);
        results.push({ name: name, passed: false, detail: detail });
        console.log("%c  FAIL %c " + name, STYLES.fail, STYLES.dim);
        console.log("       " + detail);
      }
    }
    const total = results.length;
    const style = passed === total ? STYLES.pass : STYLES.fail;
    const icon = passed === total ? "ALL PASSED" : "FAILURES DETECTED";
    console.log("%c " + icon + " %c — " + passed + " / " + total + " passed", style, "");
    const out = { passed: passed, total: total, results: results };
    window._chatBudgetResults = out;
    return out;
  }

  const ChatBudgetTests = {
    static: true,
    runStructural: runStructural,
    runAll: runStructural,
  };

  window.ChatBudgetTests = ChatBudgetTests;

  logInfo("Chat token-budget suite registered (static) — run ChatBudgetTests.runStructural()");
})();
