// Unified Chat — Stage 1 part 1c: Local Chat isolation + gap-fill suite
//
// Proves the Stage 1b factory (window.createChatState) gives each instance
// genuinely independent state, storage keys, element ids, and live regions,
// and fills the behavioural gaps the Stage 1a characterisation suite left
// open (retry / regenerate / edit on the live tool, and JSON-export carrying
// the system prompt).
//
// STATIC SUITE — no network. Groups A–D are pure (fresh instances, no live
// mutation). Groups E–F drive the mounted Local Chat but mock the embed seam
// (window.LocalChat._getOrCreateEmbed) so no model loads and nothing leaves
// the page.
//
// Shape 1 runner (the gate Playwright reads back via browser_evaluate):
//     await LocalChatIsolationTests.runStructural()  →  { passed, total, results }
//
// GUARD: every test snapshots + restores sessionStorage / localStorage for
// BOTH the "local-chat-" and "chat-" prefixes (session + history keys), and
// any test that re-points a shared module re-attaches it to the live default
// (window.LocalChatState) in its finally. Fresh instances are used for all
// isolation work — window.LocalChatState.messages / .els are never mutated
// directly except in the live groups (E, F), which snapshot and restore them.

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
      console.error.apply(console, ["[LocalChatIsolationTests]", message].concat(args));
  }
  function logWarn(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[LocalChatIsolationTests]", message].concat(args));
  }
  function logInfo(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[LocalChatIsolationTests]", message].concat(args));
  }

  // ── Console styles (match tests-local-chat-ui.js) ──────────────────────
  const STYLES = {
    pass: "color: #2e7d32; font-weight: bold",
    fail: "color: #c62828; font-weight: bold",
    heading: "color: #1565c0; font-weight: bold; font-size: 1.1em",
    dim: "color: #757575",
  };

  // ── Module references ──────────────────────────────────────────────────
  const S0 = window.LocalChatState; // live default instance
  const factory = window.createChatState; // Stage 1b state factory
  const P = window.LocalChatPersistence;
  const M = window.LocalChatMessages;
  const Chips = window.LocalChatChips;

  if (!S0 || typeof factory !== "function" || !P || !M) {
    logWarn(
      "LocalChatState / createChatState / persistence / messages not loaded — suite not registered."
    );
    return;
  }

  // ── Assertions (mirror tests-local-chat-ui.js) ─────────────────────────
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
  function assertFalse(value, message) {
    if (value !== false) {
      throw new Error(
        (message || "assertFalse") + " — expected false, got " + JSON.stringify(value)
      );
    }
  }
  function assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(
        (message || "assertNotNull") + " — got " + JSON.stringify(value)
      );
    }
  }

  const A = {
    assertEqual: assertEqual,
    assertTrue: assertTrue,
    assertFalse: assertFalse,
    assertNotNull: assertNotNull,
  };

  // ── Storage snapshot / restore (both prefixes) ─────────────────────────
  // The four keys any Local-Chat-style instance can touch: session +
  // history for the "local-chat-" prefix and the "chat-" prefix.
  function setOrRemove(storage, key, value) {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }

  function storageSnap() {
    return {
      lcSession: sessionStorage.getItem("local-chat-session"),
      lcHistory: localStorage.getItem("local-chat-history"),
      chatSession: sessionStorage.getItem("chat-session"),
      chatHistory: localStorage.getItem("chat-history"),
    };
  }

  function storageRestore(snap) {
    setOrRemove(sessionStorage, "local-chat-session", snap.lcSession);
    setOrRemove(localStorage, "local-chat-history", snap.lcHistory);
    setOrRemove(sessionStorage, "chat-session", snap.chatSession);
    setOrRemove(localStorage, "chat-history", snap.chatHistory);
  }

  // Re-point every shared module at the live default. Called from the
  // finally of any test that re-attached a module to a fresh instance.
  function reAttachLive() {
    if (P && typeof P.attach === "function") P.attach(S0);
    if (M && typeof M.attach === "function") M.attach(S0);
    if (Chips && typeof Chips.attach === "function") Chips.attach(S0);
  }

  // ── Live snapshot / restore (groups E + F) ─────────────────────────────
  // Mirrors the UI suite: NEVER replace S0.els (P + core captured it at
  // load) — only mutate its keys in place. Also snapshots the live DOM
  // surfaces the post-generation path writes to.
  function liveSnap() {
    return {
      storage: storageSnap(),
      messages: S0.messages,
      currentModel: S0.currentModel,
      currentEmbed: S0.currentEmbed,
      isGenerating: S0.isGenerating,
      editingBubble: S0.editingBubble,
      els: Object.assign({}, S0.els),
      messageListHTML: S0.els.messageList ? S0.els.messageList.innerHTML : null,
      statsHTML: S0.els.stats ? S0.els.stats.innerHTML : null,
      modelInfoHTML: S0.els.modelInfo ? S0.els.modelInfo.innerHTML : null,
      systemInputValue: S0.els.systemInput ? S0.els.systemInput.value : null,
    };
  }

  function liveRestore(snap) {
    storageRestore(snap.storage);
    S0.messages = snap.messages;
    S0.currentModel = snap.currentModel;
    S0.currentEmbed = snap.currentEmbed;
    S0.isGenerating = snap.isGenerating;
    S0.editingBubble = snap.editingBubble;
    Object.keys(S0.els).forEach(function (k) {
      delete S0.els[k];
    });
    Object.keys(snap.els).forEach(function (k) {
      S0.els[k] = snap.els[k];
    });
    if (snap.messageListHTML !== null && S0.els.messageList)
      S0.els.messageList.innerHTML = snap.messageListHTML;
    if (snap.statsHTML !== null && S0.els.stats)
      S0.els.stats.innerHTML = snap.statsHTML;
    if (snap.modelInfoHTML !== null && S0.els.modelInfo)
      S0.els.modelInfo.innerHTML = snap.modelInfoHTML;
    if (snap.systemInputValue !== null && S0.els.systemInput)
      S0.els.systemInput.value = snap.systemInputValue;
  }

  function requireMounted() {
    if (!S0.els.messageList || !S0.els.input || !S0.els.select) {
      throw new Error(
        "Local Chat must be mounted (click the Local Chat radio) — " +
          "messageList/input/select not cached"
      );
    }
  }

  // A mocked embed: calls onComplete synchronously with a fixed response so
  // the post-generation path runs without any network or model load.
  function makeFakeEmbed(responseText, capture) {
    return {
      model: null,
      systemPrompt: undefined,
      container: null,
      sendStreamingRequest: function (opts) {
        capture.calls++;
        capture.lastOpts = opts;
        if (opts && typeof opts.onComplete === "function") {
          opts.onComplete({ text: responseText, metadata: {} });
        }
        return Promise.resolve();
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // GROUP A — state isolation (pure, no DOM)
  // ════════════════════════════════════════════════════════════════════════

  const groupA = {
    "A1: fresh instances keep independent mutable state (messages, currentModel)":
      function (assert) {
        const snap = storageSnap();
        try {
          const a = factory("local-chat", "local-chat-session", "local-chat-history");
          const b = factory("chat", "chat-session", "chat-history");

          assert.assertFalse(
            a.messages === b.messages,
            "a.messages and b.messages are different array objects"
          );

          a.messages.push({ role: "user", content: "only on a" });
          assert.assertEqual(a.messages.length, 1, "a.messages received the push");
          assert.assertEqual(
            b.messages.length,
            0,
            "b.messages is unchanged by a push"
          );

          a.currentModel = "model-on-a";
          assert.assertEqual(a.currentModel, "model-on-a", "a.currentModel set");
          assert.assertEqual(
            b.currentModel,
            null,
            "b.currentModel does not see a's model"
          );
        } finally {
          storageRestore(snap);
        }
      },

    "A2: storage keys are per-prefix (SESSION_KEY / ARCHIVE_KEY)": function (assert) {
      const snap = storageSnap();
      try {
        const a = factory("local-chat", "local-chat-session", "local-chat-history");
        const b = factory("chat", "chat-session", "chat-history");

        assert.assertEqual(a.SESSION_KEY, "local-chat-session", "a.SESSION_KEY");
        assert.assertEqual(b.SESSION_KEY, "chat-session", "b.SESSION_KEY");
        assert.assertEqual(a.ARCHIVE_KEY, "local-chat-history", "a.ARCHIVE_KEY");
        assert.assertEqual(b.ARCHIVE_KEY, "chat-history", "b.ARCHIVE_KEY");
      } finally {
        storageRestore(snap);
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // GROUP B — elId isolation (pure)
  // ════════════════════════════════════════════════════════════════════════

  const groupB = {
    "B1: elId derives per-prefix element ids (input / history-panel / system-input)":
      function (assert) {
        const snap = storageSnap();
        try {
          const a = factory("local-chat", "local-chat-session", "local-chat-history");
          const b = factory("chat", "chat-session", "chat-history");

          assert.assertEqual(a.elId("input"), "local-chat-input", "a input id");
          assert.assertEqual(b.elId("input"), "chat-input", "b input id");
          assert.assertEqual(
            a.elId("history-panel"),
            "local-chat-history-panel",
            "a history-panel id"
          );
          assert.assertEqual(
            b.elId("history-panel"),
            "chat-history-panel",
            "b history-panel id"
          );
          assert.assertEqual(
            a.elId("system-input"),
            "local-chat-system-input",
            "a system-input id"
          );
          assert.assertEqual(
            b.elId("system-input"),
            "chat-system-input",
            "b system-input id"
          );
        } finally {
          storageRestore(snap);
        }
      },
  };

  // ════════════════════════════════════════════════════════════════════════
  // GROUP C — storage isolation (mandatory put-back)
  // ════════════════════════════════════════════════════════════════════════

  const groupC = {
    "C1: saveSession writes the chat-prefixed instance to chat-session and leaves local-chat-session untouched":
      function (assert) {
        const snap = storageSnap();
        let reattached = false;
        try {
          const preLocalSession = sessionStorage.getItem("local-chat-session");

          const b = factory("chat", "chat-session", "chat-history");
          // Minimal stubbed els carrying only what saveSession reads.
          b.els = { systemInput: { value: "SYS_MARKER_C1" } };
          b.messages = [{ role: "user", content: "C1_USER_MARKER" }];
          b.currentModel = "C1_MODEL_MARKER";

          P.attach(b);
          reattached = true;
          P.saveSession();

          const raw = sessionStorage.getItem("chat-session");
          assert.assertNotNull(raw, "chat-session written");
          const parsed = JSON.parse(raw);
          assert.assertEqual(parsed.messages.length, 1, "one message saved");
          assert.assertEqual(
            parsed.messages[0].content,
            "C1_USER_MARKER",
            "message marker saved to chat-session"
          );
          assert.assertEqual(
            parsed.currentModel,
            "C1_MODEL_MARKER",
            "model marker saved to chat-session"
          );
          assert.assertEqual(
            parsed.systemPrompt,
            "SYS_MARKER_C1",
            "system prompt marker saved to chat-session"
          );
          assert.assertEqual(
            sessionStorage.getItem("local-chat-session"),
            preLocalSession,
            "local-chat-session unchanged"
          );
        } finally {
          if (reattached) reAttachLive();
          storageRestore(snap);
        }
      },

    "C2: archiveConversation writes the chat-prefixed instance to chat-history and leaves local-chat-history untouched":
      function (assert) {
        const snap = storageSnap();
        let reattached = false;
        try {
          const preLocalHistory = localStorage.getItem("local-chat-history");

          const b = factory("chat", "chat-session", "chat-history");
          b.els = { systemInput: { value: "SYS_MARKER_C2" } };
          b.messages = [{ role: "user", content: "C2_USER_MARKER" }];
          b.currentModel = "C2_MODEL_MARKER";

          // Deterministic count — start the chat archive clean.
          localStorage.removeItem("chat-history");

          P.attach(b);
          reattached = true;
          const ok = P.archiveConversation();
          assert.assertTrue(ok, "archiveConversation returned true");

          const raw = localStorage.getItem("chat-history");
          assert.assertNotNull(raw, "chat-history written");
          const arr = JSON.parse(raw);
          assert.assertEqual(arr.length, 1, "one archived entry");
          assert.assertEqual(
            arr[0].messages[0].content,
            "C2_USER_MARKER",
            "message marker archived to chat-history"
          );
          assert.assertEqual(
            arr[0].model,
            "C2_MODEL_MARKER",
            "model marker archived to chat-history"
          );
          assert.assertEqual(
            arr[0].systemPrompt,
            "SYS_MARKER_C2",
            "system prompt marker archived to chat-history"
          );
          assert.assertEqual(
            localStorage.getItem("local-chat-history"),
            preLocalHistory,
            "local-chat-history unchanged"
          );
        } finally {
          if (reattached) reAttachLive();
          storageRestore(snap);
        }
      },
  };

  // ════════════════════════════════════════════════════════════════════════
  // GROUP D — live-region isolation (accessibility)
  //
  // Finding: announceToScreenReader(text) does NOT use `this` and writes to
  // nothing per-instance — it delegates to the single global
  // window.accessibilityHelpers.announceToScreenReader (one shared live
  // region). The genuinely per-instance live-region helper is
  // setMessageListLive(value), which writes the aria-live attribute on
  // this.els.messageList. D1 asserts isolation on that target; D2 documents
  // that announce is shared, not isolated.
  // ════════════════════════════════════════════════════════════════════════

  const groupD = {
    "D1: setMessageListLive writes aria-live only to its own instance's els.messageList":
      function (assert) {
        const snap = storageSnap();
        try {
          const a = factory("local-chat", "local-chat-session", "local-chat-history");
          const b = factory("chat", "chat-session", "chat-history");
          // Each instance gets its own detached live-region stub.
          a.els.messageList = document.createElement("div");
          b.els.messageList = document.createElement("div");

          a.setMessageListLive("polite");
          assert.assertEqual(
            a.els.messageList.getAttribute("aria-live"),
            "polite",
            "a's region received aria-live=polite"
          );
          assert.assertEqual(
            b.els.messageList.getAttribute("aria-live"),
            null,
            "b's region is untouched after announcing on a"
          );

          b.setMessageListLive("off");
          assert.assertEqual(
            b.els.messageList.getAttribute("aria-live"),
            "off",
            "b's region received aria-live=off"
          );
          assert.assertEqual(
            a.els.messageList.getAttribute("aria-live"),
            "polite",
            "a's region is still polite, unaffected by b"
          );
        } finally {
          // Stub regions were never appended to the document — nothing to remove.
          storageRestore(snap);
        }
      },

    "D2: announceToScreenReader routes through the shared global helper (not a per-instance target)":
      function (assert) {
        const snap = storageSnap();
        const hadHelpers = "accessibilityHelpers" in window;
        const origHelpers = window.accessibilityHelpers;
        try {
          const captured = [];
          window.accessibilityHelpers = {
            announceToScreenReader: function (text) {
              captured.push(text);
            },
          };

          const a = factory("local-chat", "local-chat-session", "local-chat-history");
          const b = factory("chat", "chat-session", "chat-history");

          a.announceToScreenReader("alpha");
          b.announceToScreenReader("beta");

          assert.assertEqual(
            captured.length,
            2,
            "both instances routed through the same global helper"
          );
          assert.assertEqual(captured[0], "alpha", "a's announcement captured globally");
          assert.assertEqual(captured[1], "beta", "b's announcement captured globally");
        } finally {
          if (hadHelpers) window.accessibilityHelpers = origHelpers;
          else delete window.accessibilityHelpers;
          storageRestore(snap);
        }
      },
  };

  // ════════════════════════════════════════════════════════════════════════
  // GROUP E — retry / regenerate / edit on the LIVE Local Chat (mocked embed)
  // ════════════════════════════════════════════════════════════════════════

  const groupE = {
    "E1: retryLastMessage produces a fresh assistant response via the mocked embed":
      function (assert) {
        requireMounted();
        const snap = liveSnap();
        const origEmbed = window.LocalChat._getOrCreateEmbed;
        try {
          S0.messages = [{ role: "user", content: "ping" }];
          S0.isGenerating = false;
          S0.currentEmbed = null;

          const cap = { calls: 0, lastOpts: null };
          const fake = makeFakeEmbed("RETRY_RESPONSE", cap);
          window.LocalChat._getOrCreateEmbed = function () {
            return fake;
          };

          // The error bubble retry removes from the DOM.
          const errBubble = document.createElement("div");
          errBubble.className = "local-chat-bubble local-chat-bubble-assistant";
          S0.els.messageList.appendChild(errBubble);

          M.retryLastMessage(errBubble);

          assert.assertEqual(cap.calls, 1, "embed.sendStreamingRequest called once");
          assert.assertEqual(
            cap.lastOpts.userPrompt,
            "ping",
            "retry re-sent the last user message"
          );
          assert.assertEqual(S0.messages.length, 2, "assistant turn appended");
          assert.assertEqual(
            S0.messages[1].role,
            "assistant",
            "appended turn is the assistant"
          );
          assert.assertEqual(
            S0.messages[1].content,
            "RETRY_RESPONSE",
            "assistant content is the mocked response"
          );
        } finally {
          window.LocalChat._getOrCreateEmbed = origEmbed;
          liveRestore(snap);
        }
      },

    "E2: regenerateLastResponse replaces the last assistant turn via the mocked embed":
      function (assert) {
        requireMounted();
        const snap = liveSnap();
        const origEmbed = window.LocalChat._getOrCreateEmbed;
        try {
          S0.messages = [
            { role: "user", content: "Q1" },
            { role: "assistant", content: "OLD_ANSWER", model: S0.currentModel },
          ];
          S0.isGenerating = false;

          // A DOM assistant bubble for regenerate to remove.
          const oldBubble = document.createElement("div");
          oldBubble.className = "local-chat-bubble local-chat-bubble-assistant";
          S0.els.messageList.appendChild(oldBubble);

          const cap = { calls: 0, lastOpts: null };
          const fake = makeFakeEmbed("NEW_ANSWER", cap);
          window.LocalChat._getOrCreateEmbed = function () {
            return fake;
          };

          M.regenerateLastResponse();

          assert.assertEqual(cap.calls, 1, "embed.sendStreamingRequest called once");
          assert.assertEqual(
            S0.messages.length,
            2,
            "still one user + one assistant (turn replaced, not appended)"
          );
          assert.assertEqual(S0.messages[0].content, "Q1", "user turn preserved");
          assert.assertEqual(
            S0.messages[1].content,
            "NEW_ANSWER",
            "last assistant turn replaced with the mocked response"
          );
        } finally {
          window.LocalChat._getOrCreateEmbed = origEmbed;
          liveRestore(snap);
        }
      },

    "E3: commitEdit edits the user message, truncates the array, and triggers saveSession":
      function (assert) {
        requireMounted();
        const snap = liveSnap();
        const origEmbed = window.LocalChat._getOrCreateEmbed;
        const origSave = P.saveSession;
        let saveCount = 0;
        try {
          S0.messages = [
            { role: "user", content: "original text" },
            { role: "assistant", content: "ASSIST_OLD", model: S0.currentModel },
          ];
          S0.isGenerating = false;
          S0.editingBubble = null;

          P.saveSession = function () {
            saveCount++;
            return origSave.apply(this, arguments);
          };

          const cap = { calls: 0, lastOpts: null };
          const fake = makeFakeEmbed("EDIT_RESPONSE", cap);
          window.LocalChat._getOrCreateEmbed = function () {
            return fake;
          };

          // Build the user bubble (adds Edit button) + a trailing assistant
          // bubble that commitEdit's truncation should remove from the DOM.
          const userBubble = M.createUserBubble("original text", 0);
          const assistBubble = document.createElement("div");
          assistBubble.className = "local-chat-bubble local-chat-bubble-assistant";
          S0.els.messageList.appendChild(assistBubble);

          // Drive the real edit UI: Edit → type → Re-send (= commitEdit).
          const editBtn = userBubble.querySelector(".local-chat-edit-btn");
          assert.assertNotNull(editBtn, "user bubble has an Edit button");
          editBtn.click();
          const textarea = userBubble.querySelector(".local-chat-edit-textarea");
          assert.assertNotNull(textarea, "edit mode opened a textarea");
          textarea.value = "edited text";
          const resendBtn = userBubble.querySelector(".local-chat-edit-resend");
          assert.assertNotNull(resendBtn, "edit mode has a Re-send button");
          resendBtn.click();

          assert.assertEqual(
            S0.messages[0].content,
            "edited text",
            "user message content written through"
          );
          assert.assertTrue(saveCount >= 1, "commitEdit triggered saveSession");
          assert.assertEqual(cap.calls, 1, "embed re-sent after the edit");
          assert.assertEqual(
            S0.messages.length,
            2,
            "array truncated to the edited turn, then mocked assistant appended"
          );
          assert.assertEqual(
            S0.messages[1].role,
            "assistant",
            "appended turn is the assistant"
          );
          assert.assertEqual(
            S0.messages[1].content,
            "EDIT_RESPONSE",
            "assistant content is the mocked response"
          );
        } finally {
          P.saveSession = origSave;
          window.LocalChat._getOrCreateEmbed = origEmbed;
          liveRestore(snap);
        }
      },
  };

  // ════════════════════════════════════════════════════════════════════════
  // GROUP F — JSON export carries the system prompt (proves the bug fix)
  // ════════════════════════════════════════════════════════════════════════

  const groupF = {
    "F1: exportAsJSON serialises the live system prompt into the JSON payload":
      async function (assert) {
        requireMounted();
        const snap = liveSnap();
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        const origAnchorClick = HTMLAnchorElement.prototype.click;
        try {
          const marker = "SYS_PROMPT_MARKER_F";
          S0.messages = [{ role: "user", content: "export me" }];

          const sysEl = document.getElementById(S0.elId("system-input"));
          assert.assertNotNull(sysEl, "#local-chat-system-input exists");
          sysEl.value = marker;

          // Capture the Blob exportAsJSON hands to triggerDownload, and
          // neutralise the actual download (createObjectURL → fake string,
          // anchor.click → no-op) so nothing leaves the page.
          let capturedBlob = null;
          URL.createObjectURL = function (blob) {
            capturedBlob = blob;
            return "blob:isolation-capture-f";
          };
          URL.revokeObjectURL = function () {};
          HTMLAnchorElement.prototype.click = function () {};

          P.exportAsJSON();

          assert.assertNotNull(capturedBlob, "a Blob was produced for download");
          const text = await capturedBlob.text();
          assert.assertTrue(
            text.indexOf(marker) >= 0,
            "exported JSON text contains the system-prompt marker"
          );
          const parsed = JSON.parse(text);
          assert.assertEqual(
            parsed.systemPrompt,
            marker,
            "parsed JSON systemPrompt field equals the live system prompt"
          );
        } finally {
          URL.createObjectURL = origCreate;
          URL.revokeObjectURL = origRevoke;
          HTMLAnchorElement.prototype.click = origAnchorClick;
          liveRestore(snap);
        }
      },
  };

  // ── Register with the Phase 9A runner (console parity) ──────────────────
  if (window.ImageDescriberTests) {
    window.ImageDescriberTests.register("local-chat-isolation-state", {
      name: "Local Chat Isolation — Groups A+B State/elId (Stage 1c)",
      tests: Object.assign({}, groupA, groupB),
    });
    window.ImageDescriberTests.register("local-chat-isolation-storage", {
      name: "Local Chat Isolation — Groups C+D Storage/Live-region (Stage 1c)",
      tests: Object.assign({}, groupC, groupD),
    });
    window.ImageDescriberTests.register("local-chat-isolation-live", {
      name: "Local Chat Isolation — Groups E+F Retry/Regen/Edit/Export (Stage 1c)",
      tests: Object.assign({}, groupE, groupF),
    });
  } else {
    logWarn("ImageDescriberTests not loaded — modules not registered.");
  }

  // ── Shape 1 runner ──────────────────────────────────────────────────────

  async function runMaps(maps) {
    const results = {};
    let passed = 0;
    for (let m = 0; m < maps.length; m++) {
      const map = maps[m];
      const names = Object.keys(map);
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        try {
          await map[name](A);
          results[name] = true;
          passed++;
          console.log("%c  PASS %c " + name, STYLES.pass, STYLES.dim);
        } catch (err) {
          results[name] = false;
          console.log("%c  FAIL %c " + name, STYLES.fail, STYLES.dim);
          console.log("       " + (err && err.message ? err.message : err));
        }
      }
    }
    const total = Object.keys(results).length;
    return { passed: passed, total: total, results: results };
  }

  async function runStructural() {
    console.log(
      "%c══ Local Chat Isolation + Gap-fill — Stage 1c (static) ══",
      STYLES.heading
    );
    const out = await runMaps([groupA, groupB, groupC, groupD, groupE, groupF]);
    const style = out.passed === out.total ? STYLES.pass : STYLES.fail;
    const icon = out.passed === out.total ? "ALL PASSED" : "FAILURES DETECTED";
    console.log(
      "%c " + icon + " %c — " + out.passed + " / " + out.total + " passed",
      style,
      ""
    );
    window._localChatIsolationResults = out;
    return out;
  }

  const LocalChatIsolationTests = {
    static: true,
    runStructural: runStructural,
    runAll: runStructural,
    runGroupA: function () {
      return runMaps([groupA]);
    },
    runGroupB: function () {
      return runMaps([groupB]);
    },
    runGroupC: function () {
      return runMaps([groupC]);
    },
    runGroupD: function () {
      return runMaps([groupD]);
    },
    runGroupE: function () {
      return runMaps([groupE]);
    },
    runGroupF: function () {
      return runMaps([groupF]);
    },
  };

  window.LocalChatIsolationTests = LocalChatIsolationTests;

  logInfo(
    "Local Chat isolation + gap-fill suite registered (static) — " +
      "run LocalChatIsolationTests.runStructural()"
  );
})();
