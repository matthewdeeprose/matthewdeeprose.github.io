// Unified Chat — Stage 1 part 1a: Local Chat UI characterisation suite
//
// Pins today's Local Chat UI behaviour (persistence, history panel/banner,
// send flow, clear-on-model-change) so a later refactor can prove zero change.
//
// Shape 1 runner (the gate Playwright reads back via browser_evaluate):
//     await LocalChatUITests.runStructural()   →  { passed, total, results }
//
// Also registers three modules with the Phase 9A runner for console parity:
//     await ImageDescriberTests.run('local-chat-ui-persistence')
//     await ImageDescriberTests.run('local-chat-ui-dom')
//     await ImageDescriberTests.run('local-chat-ui-sendflow')
//
// Tier 1 is fully static (stubs els/S, no real DOM). Tiers 2 and 3 require
// Local Chat to be mounted on the page (click the Local Chat radio first);
// those tests fail loudly if it is not.

(function () {
  "use strict";

  // ── Logging configuration ──────────────────────────────────────────────
  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error.apply(console, ["[LocalChatUITests]", message].concat(args));
  }
  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[LocalChatUITests]", message].concat(args));
  }
  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[LocalChatUITests]", message].concat(args));
  }

  // ── Console styles (match test-runner.js convention) ───────────────────
  var STYLES = {
    pass: "color: #2e7d32; font-weight: bold",
    fail: "color: #c62828; font-weight: bold",
    heading: "color: #1565c0; font-weight: bold; font-size: 1.1em",
    dim: "color: #757575",
  };

  // ── Module references ──────────────────────────────────────────────────
  var S = window.LocalChatState;
  var P = window.LocalChatPersistence;
  if (!S || !P) {
    logWarn(
      "LocalChatState / LocalChatPersistence not loaded — suite not registered."
    );
    return;
  }
  var registry = window.LocalTextModelRegistry;

  // ── Assertions (strict; mirror test-runner.js names so the same test
  //    functions run under either ImageDescriberTests or runStructural) ────
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
        (message || "assertFalse") +
          " — expected false, got " +
          JSON.stringify(value)
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
  function assertContains(haystack, needle, message) {
    if (typeof haystack === "string" || Array.isArray(haystack)) {
      if (haystack.indexOf(needle) < 0) {
        throw new Error(
          (message || "assertContains") +
            " — does not contain " +
            JSON.stringify(needle)
        );
      }
      return;
    }
    throw new Error((message || "assertContains") + " — haystack must be string/array");
  }

  var A = {
    assertEqual: assertEqual,
    assertTrue: assertTrue,
    assertFalse: assertFalse,
    assertNotNull: assertNotNull,
    assertContains: assertContains,
  };

  // ── State snapshot / restore ───────────────────────────────────────────
  // P and the core both captured `var els = S.els` at load, so we must NEVER
  // replace S.els — only mutate its keys in place. restore() wipes the keys
  // and re-installs the snapshotted ones, preserving the object identity.

  function snapshot() {
    return {
      session: sessionStorage.getItem(S.SESSION_KEY),
      archive: localStorage.getItem(S.ARCHIVE_KEY),
      messages: S.messages,
      currentModel: S.currentModel,
      currentEmbed: S.currentEmbed,
      isGenerating: S.isGenerating,
      els: Object.assign({}, S.els),
    };
  }

  function restore(snap) {
    if (snap.session === null) sessionStorage.removeItem(S.SESSION_KEY);
    else sessionStorage.setItem(S.SESSION_KEY, snap.session);
    if (snap.archive === null) localStorage.removeItem(S.ARCHIVE_KEY);
    else localStorage.setItem(S.ARCHIVE_KEY, snap.archive);
    S.messages = snap.messages;
    S.currentModel = snap.currentModel;
    S.currentEmbed = snap.currentEmbed;
    S.isGenerating = snap.isGenerating;
    Object.keys(S.els).forEach(function (k) {
      delete S.els[k];
    });
    Object.keys(snap.els).forEach(function (k) {
      S.els[k] = snap.els[k];
    });
  }

  function flushMicrotasks() {
    return new Promise(function (r) {
      setTimeout(r, 0);
    });
  }

  function requireMounted() {
    if (!S.els.messageList || !S.els.input || !S.els.select) {
      throw new Error(
        "Local Chat must be mounted (click the Local Chat radio) — " +
          "messageList/input/select not cached"
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIER 1 — static persistence (stubbed els/S, no real DOM)
  // ════════════════════════════════════════════════════════════════════════

  var tier1Tests = {
    "T1: saveSession/restoreSession round-trips messages, model, prompt, params":
      function (assert) {
        var snap = snapshot();
        try {
          S.els.systemInput = { value: "You are a test assistant." };
          S.els.temperatureSlider = { value: "0.5" };
          S.els.temperatureValue = { textContent: "" };
          S.els.temperatureDesc = { textContent: "" };
          S.els.maxTokensSlider = { value: "256" };
          S.els.maxTokensValue = { textContent: "" };
          S.els.maxTokensDesc = { textContent: "" };
          S.els.messageList = null; // rebuildMessageList() returns early
          S.els.select = { value: "" };
          S.els.presetSelect = null;
          S.currentModel = "lfm2-350m";
          S.messages = [
            { role: "user", content: "hi there" },
            { role: "assistant", content: "hello!", model: "lfm2-350m" },
          ];

          P.saveSession();
          var raw = sessionStorage.getItem(S.SESSION_KEY);
          assert.assertNotNull(raw, "session JSON should be written");

          // Wipe live state, then restore from sessionStorage
          S.messages = [];
          S.currentModel = null;
          S.els.systemInput.value = "";
          S.els.temperatureSlider.value = "0";
          S.els.maxTokensSlider.value = "0";

          var ok = P.restoreSession();
          assert.assertTrue(ok, "restoreSession() should return true");
          assert.assertEqual(S.messages.length, 2, "two messages restored");
          assert.assertEqual(S.messages[0].role, "user", "msg0 role");
          assert.assertEqual(S.messages[0].content, "hi there", "msg0 content");
          assert.assertEqual(S.messages[1].role, "assistant", "msg1 role");
          assert.assertEqual(S.messages[1].content, "hello!", "msg1 content");
          assert.assertEqual(S.currentModel, "lfm2-350m", "currentModel restored");
          assert.assertEqual(
            S.els.systemInput.value,
            "You are a test assistant.",
            "systemPrompt restored"
          );
          assert.assertEqual(
            parseFloat(S.els.temperatureSlider.value),
            0.5,
            "temperature restored"
          );
          assert.assertEqual(
            parseInt(S.els.maxTokensSlider.value, 10),
            256,
            "maxTokens restored"
          );
        } finally {
          restore(snap);
        }
      },

    "T1: session larger than SESSION_MAX_BYTES is not written": function (assert) {
      var snap = snapshot();
      try {
        S.els.systemInput = { value: "" };
        S.els.temperatureSlider = { value: "0.7" };
        S.els.maxTokensSlider = { value: "1024" };
        S.currentModel = "lfm2-350m";
        sessionStorage.removeItem(S.SESSION_KEY);
        // Build a payload guaranteed to exceed the 500KB cap
        var big = new Array(S.SESSION_MAX_BYTES + 5000).join("x"); // > cap chars
        S.messages = [{ role: "user", content: big }];

        P.saveSession();
        assert.assertEqual(
          sessionStorage.getItem(S.SESSION_KEY),
          null,
          "over-cap session must not be written"
        );
      } finally {
        restore(snap);
      }
    },

    "T1: restoreSession discards a session whose model is not in the registry":
      function (assert) {
        var snap = snapshot();
        try {
          assert.assertNotNull(registry, "registry must be available");
          S.els.messageList = null;
          S.els.select = { value: "" };
          S.els.systemInput = { value: "" };
          var payload = JSON.stringify({
            messages: [{ role: "user", content: "stale" }],
            currentModel: "nonexistent-model-xyz",
            systemPrompt: "",
            temperature: 0.7,
            maxTokens: 1024,
          });
          sessionStorage.setItem(S.SESSION_KEY, payload);

          var ok = P.restoreSession();
          assert.assertFalse(ok, "restoreSession() should return false");
          assert.assertEqual(
            sessionStorage.getItem(S.SESSION_KEY),
            null,
            "session should be cleared via clearSession()"
          );
        } finally {
          restore(snap);
        }
      },

    "T1: archiveConversation/loadArchive round-trip preserves the entry shape":
      function (assert) {
        var snap = snapshot();
        try {
          localStorage.removeItem(S.ARCHIVE_KEY);
          S.els.systemInput = { value: "be helpful" };
          S.currentModel = "lfm2-350m";
          S.messages = [
            { role: "user", content: "first question" },
            { role: "assistant", content: "an answer", model: "lfm2-350m" },
          ];

          var saved = P.archiveConversation();
          assert.assertTrue(saved, "archiveConversation() should return true");

          var archive = P.loadArchive();
          assert.assertEqual(archive.length, 1, "one archived entry");
          var e = archive[0];
          var keys = [
            "id",
            "title",
            "model",
            "modelDisplayName",
            "messageCount",
            "created",
            "lastActive",
            "systemPrompt",
            "messages",
          ];
          for (var i = 0; i < keys.length; i++) {
            assert.assertTrue(
              Object.prototype.hasOwnProperty.call(e, keys[i]),
              "entry should have key '" + keys[i] + "'"
            );
          }
          assert.assertEqual(e.title, "first question", "title from first user msg");
          assert.assertEqual(e.model, "lfm2-350m", "model key");
          assert.assertEqual(
            e.modelDisplayName,
            "LFM2 350M",
            "modelDisplayName from registry userInfo"
          );
          assert.assertEqual(e.messageCount, 2, "messageCount");
          assert.assertEqual(e.systemPrompt, "be helpful", "systemPrompt captured");
          assert.assertEqual(e.messages.length, 2, "messages copied");
        } finally {
          restore(snap);
        }
      },

    "T1: archive is newest-first": function (assert) {
      var snap = snapshot();
      try {
        localStorage.removeItem(S.ARCHIVE_KEY);
        S.els.systemInput = { value: "" };
        S.currentModel = "lfm2-350m";

        S.messages = [{ role: "user", content: "first question" }];
        P.archiveConversation();
        S.messages = [{ role: "user", content: "second question" }];
        P.archiveConversation();

        var archive = P.loadArchive();
        assert.assertEqual(archive.length, 2, "two entries");
        assert.assertEqual(
          archive[0].title,
          "second question",
          "newest entry is first"
        );
        assert.assertEqual(
          archive[1].title,
          "first question",
          "older entry is second"
        );
      } finally {
        restore(snap);
      }
    },

    "T1: archive honours the 20-conversation cap": function (assert) {
      var snap = snapshot();
      try {
        // Seed 20 minimal entries
        var seed = [];
        for (var i = 0; i < 20; i++) {
          seed.push({
            id: "seed-" + i,
            title: "seed " + i,
            model: "lfm2-350m",
            modelDisplayName: "LFM2 350M",
            messageCount: 1,
            created: "2026-01-01T00:00:00.000Z",
            lastActive: "2026-01-01T00:00:00.000Z",
            systemPrompt: "",
            messages: [{ role: "user", content: "x" }],
          });
        }
        localStorage.setItem(S.ARCHIVE_KEY, JSON.stringify(seed));

        S.els.systemInput = { value: "" };
        S.currentModel = "lfm2-350m";
        S.messages = [{ role: "user", content: "overflow message" }];
        P.archiveConversation();

        var archive = P.loadArchive();
        assert.assertEqual(archive.length, 20, "cap stays at 20");
        assert.assertEqual(
          archive[0].title,
          "overflow message",
          "newest entry kept at front"
        );
        assert.assertEqual(
          archive[19].id,
          "seed-18",
          "oldest entry (seed-19) was dropped"
        );
      } finally {
        restore(snap);
      }
    },

    "T1: deleteArchived(id) removes the entry": function (assert) {
      var snap = snapshot();
      try {
        localStorage.removeItem(S.ARCHIVE_KEY);
        S.els.systemInput = { value: "" };
        S.currentModel = "lfm2-350m";
        S.messages = [{ role: "user", content: "to be deleted" }];
        P.archiveConversation();

        var id = P.loadArchive()[0].id;
        P.deleteArchived(id);

        var archive = P.loadArchive();
        assert.assertEqual(archive.length, 0, "archive empty after delete");
        var found = archive.filter(function (e) {
          return e.id === id;
        });
        assert.assertEqual(found.length, 0, "deleted id not present");
      } finally {
        restore(snap);
      }
    },

    "T1: loadArchive() returns [] on miss or parse failure": function (assert) {
      var snap = snapshot();
      try {
        localStorage.removeItem(S.ARCHIVE_KEY);
        var miss = P.loadArchive();
        assert.assertTrue(Array.isArray(miss), "miss returns array");
        assert.assertEqual(miss.length, 0, "miss returns empty array");

        localStorage.setItem(S.ARCHIVE_KEY, "{not valid json");
        var bad = P.loadArchive();
        assert.assertTrue(Array.isArray(bad), "parse failure returns array");
        assert.assertEqual(bad.length, 0, "parse failure returns empty array");
      } finally {
        restore(snap);
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // TIER 2 — DOM-coupled (Local Chat mounted on the page)
  // ════════════════════════════════════════════════════════════════════════

  var tier2Tests = {
    "T2: openHistoryPanel creates the panel and hides the message list":
      function (assert) {
        requireMounted();
        var snap = snapshot();
        var listHTML = S.els.messageList.innerHTML;
        try {
          // Ensure no panel exists (openHistoryPanel toggles)
          if (document.getElementById("local-chat-history-panel")) {
            P.closeHistoryPanel();
          }
          P.openHistoryPanel();
          assert.assertNotNull(
            document.getElementById("local-chat-history-panel"),
            "#local-chat-history-panel should exist"
          );
          assert.assertTrue(
            S.els.messageList.hidden === true,
            "#local-chat-messages should be hidden"
          );

          P.closeHistoryPanel();
          assert.assertEqual(
            document.getElementById("local-chat-history-panel"),
            null,
            "panel removed after close"
          );
          assert.assertTrue(
            S.els.messageList.hidden === false,
            "message list unhidden after close"
          );
        } finally {
          if (document.getElementById("local-chat-history-panel")) {
            P.closeHistoryPanel();
          }
          S.els.messageList.hidden = false;
          S.els.messageList.innerHTML = listHTML;
          restore(snap);
        }
      },

    "T2: updateHistoryButton disables #local-chat-history when archive empty":
      function (assert) {
        requireMounted();
        var snap = snapshot();
        try {
          var btn = document.getElementById("local-chat-history");
          assert.assertNotNull(btn, "#local-chat-history button should exist");

          localStorage.removeItem(S.ARCHIVE_KEY);
          P.updateHistoryButton();
          assert.assertTrue(
            btn.disabled === true,
            "button disabled when archive empty"
          );

          localStorage.setItem(
            S.ARCHIVE_KEY,
            JSON.stringify([
              {
                id: "x1",
                title: "t",
                model: "lfm2-350m",
                modelDisplayName: "LFM2 350M",
                messageCount: 1,
                created: "2026-01-01T00:00:00.000Z",
                lastActive: "2026-01-01T00:00:00.000Z",
                systemPrompt: "",
                messages: [{ role: "user", content: "x" }],
              },
            ])
          );
          P.updateHistoryButton();
          assert.assertTrue(
            btn.disabled === false,
            "button enabled when archive non-empty"
          );
        } finally {
          restore(snap);
          P.updateHistoryButton();
        }
      },

    "T2: history entries carry data-archive-id": function (assert) {
      requireMounted();
      var snap = snapshot();
      var listHTML = S.els.messageList.innerHTML;
      try {
        localStorage.setItem(
          S.ARCHIVE_KEY,
          JSON.stringify([
            {
              id: "archive-id-test",
              title: "entry under test",
              model: "lfm2-350m",
              modelDisplayName: "LFM2 350M",
              messageCount: 1,
              created: "2026-01-01T00:00:00.000Z",
              lastActive: "2026-01-01T00:00:00.000Z",
              systemPrompt: "",
              messages: [{ role: "user", content: "x" }],
            },
          ])
        );
        if (document.getElementById("local-chat-history-panel")) {
          P.closeHistoryPanel();
        }
        P.openHistoryPanel();
        var entry = document.querySelector(
          "#local-chat-history-panel .local-chat-history-entry"
        );
        assert.assertNotNull(entry, "a history entry should be rendered");
        assert.assertEqual(
          entry.getAttribute("data-archive-id"),
          "archive-id-test",
          "entry carries data-archive-id"
        );
      } finally {
        if (document.getElementById("local-chat-history-panel")) {
          P.closeHistoryPanel();
        }
        S.els.messageList.hidden = false;
        S.els.messageList.innerHTML = listHTML;
        restore(snap);
      }
    },

    "T2: on load a pre-existing session is cleared and no restore banner shown":
      function (assert) {
        requireMounted();
        var snap = snapshot();
        try {
          // Today's truth: init() starts fresh — it calls clearSession() and
          // never invokes restoreSession()/showRestoreBanner(). The restore
          // helpers exist but are dormant.
          assert.assertEqual(
            typeof P.restoreSession,
            "function",
            "restoreSession exists (but is not auto-invoked)"
          );
          assert.assertEqual(
            typeof P.showRestoreBanner,
            "function",
            "showRestoreBanner exists (but is not auto-invoked)"
          );
          // No restore banner is present on the live, freshly-loaded page.
          assert.assertEqual(
            document.getElementById("local-chat-restore-banner"),
            null,
            "no #local-chat-restore-banner on the loaded page"
          );
          // The fresh-start primitive init() uses removes a pre-existing session.
          sessionStorage.setItem(
            S.SESSION_KEY,
            JSON.stringify({
              messages: [{ role: "user", content: "stale" }],
              currentModel: "lfm2-350m",
              systemPrompt: "",
              temperature: 0.7,
              maxTokens: 1024,
            })
          );
          P.clearSession();
          assert.assertEqual(
            sessionStorage.getItem(S.SESSION_KEY),
            null,
            "pre-existing session cleared on fresh start"
          );
          // Still no banner — restore remains dormant.
          assert.assertEqual(
            document.getElementById("local-chat-restore-banner"),
            null,
            "still no restore banner after a session existed"
          );
        } finally {
          restore(snap);
        }
      },
  };

  // ════════════════════════════════════════════════════════════════════════
  // TIER 3 — send flow and clear-on-model-change (mocked embed)
  // ════════════════════════════════════════════════════════════════════════

  var tier3Tests = {
    "T3: localChatSend pushes the user message, calls the embed, and saves":
      function (assert) {
        requireMounted();
        var snap = snapshot();
        var listHTML = S.els.messageList.innerHTML;
        var inputVal = S.els.input.value;
        try {
          var currentModel =
            S.currentModel || (S.els.select && S.els.select.value) || "lfm2-350m";
          S.currentModel = currentModel;
          S.messages = [];
          S.isGenerating = false;
          sessionStorage.removeItem(S.SESSION_KEY);

          var captured = null;
          var calledWith = { sent: false };
          var fake = {
            model: "local/" + currentModel,
            systemPrompt: undefined,
            container: null,
            sendStreamingRequest: function (opts) {
              calledWith.sent = true;
              captured = opts;
              if (opts.onComplete) {
                opts.onComplete({
                  text: "Mocked response.",
                  metadata: {
                    tokensPerSecond: 1,
                    tokens: { completion: 2 },
                    processingTime: 100,
                  },
                });
              }
              return Promise.resolve();
            },
          };
          S.currentEmbed = fake;
          S.els.input.value = "test message";

          window.localChatSend();

          // User message pushed
          assert.assertEqual(S.messages.length, 2, "user + assistant in messages");
          assert.assertEqual(S.messages[0].role, "user", "msg0 is user");
          assert.assertEqual(
            S.messages[0].content,
            "test message",
            "user content captured"
          );
          // Embed called with messagesForApi
          assert.assertTrue(calledWith.sent, "sendStreamingRequest was called");
          assert.assertNotNull(captured, "opts captured");
          assert.assertEqual(
            captured.userPrompt,
            "test message",
            "userPrompt passed"
          );
          assert.assertTrue(
            Array.isArray(captured.messages),
            "messages array passed (messagesForApi)"
          );
          assert.assertEqual(
            captured.messages.length,
            1,
            "messagesForApi has the one user turn"
          );
          assert.assertEqual(
            captured.messages[0].role,
            "user",
            "messagesForApi[0] role"
          );
          assert.assertEqual(
            captured.messages[0].content,
            "test message",
            "messagesForApi[0] content"
          );
          // postGeneration rendered the response and saved the session
          assert.assertEqual(
            S.messages[1].role,
            "assistant",
            "assistant turn pushed by postGeneration"
          );
          assert.assertEqual(
            S.messages[1].content,
            "Mocked response.",
            "assistant content rendered"
          );
          var raw = sessionStorage.getItem(S.SESSION_KEY);
          assert.assertNotNull(raw, "postGeneration called saveSession()");
          var parsed = JSON.parse(raw);
          assert.assertEqual(
            parsed.messages.length,
            2,
            "saved session has both turns"
          );
        } finally {
          S.els.messageList.innerHTML = listHTML;
          S.els.input.value = inputVal;
          restore(snap);
        }
      },

    "T3: model change with an active conversation gates on the exact confirm string and reverts on decline":
      async function (assert) {
        requireMounted();
        var snap = snapshot();
        var listHTML = S.els.messageList.innerHTML;
        var hadConfirm = "safeConfirm" in window;
        var origConfirm = window.safeConfirm;
        try {
          var opts = S.els.select.options;
          assert.assertTrue(
            opts && opts.length >= 2,
            "model select needs >= 2 options"
          );
          var optA = opts[0].value;
          var optB = opts[1].value;

          S.messages = [{ role: "user", content: "active" }];
          S.currentModel = optA;
          S.els.select.value = optB;

          var capturedMsg = null;
          var capturedTitle = null;
          window.safeConfirm = function (msg, title) {
            capturedMsg = msg;
            capturedTitle = title;
            return Promise.resolve(false); // decline
          };

          window.localChatModelChange();
          await flushMicrotasks();

          assert.assertEqual(
            capturedMsg,
            "Switching models will clear the current conversation. Continue?",
            "exact confirm message"
          );
          assert.assertEqual(capturedTitle, "Switch Model", "confirm title");
          assert.assertEqual(
            S.els.select.value,
            optA,
            "select reverts to current model on decline"
          );
          assert.assertEqual(
            S.currentModel,
            optA,
            "currentModel unchanged on decline"
          );
          assert.assertEqual(
            S.messages.length,
            1,
            "conversation preserved on decline"
          );
        } finally {
          if (hadConfirm) window.safeConfirm = origConfirm;
          else delete window.safeConfirm;
          S.els.messageList.innerHTML = listHTML;
          restore(snap);
        }
      },

    "T3: model change on confirm archives before performClear": async function (
      assert
    ) {
      requireMounted();
      var snap = snapshot();
      var listHTML = S.els.messageList.innerHTML;
      var hadConfirm = "safeConfirm" in window;
      var origConfirm = window.safeConfirm;
      var origArchive = P.archiveConversation;
      var origClear = P.performClear;
      try {
        var opts = S.els.select.options;
        var optA = opts[0].value;
        var optB = opts[1].value;

        var order = [];
        P.archiveConversation = function () {
          order.push("archive");
          return origArchive.apply(this, arguments);
        };
        P.performClear = function () {
          order.push("clear");
          return origClear.apply(this, arguments);
        };

        S.messages = [{ role: "user", content: "active" }];
        S.currentModel = optA;
        S.els.select.value = optB;
        window.safeConfirm = function () {
          return Promise.resolve(true); // confirm
        };

        window.localChatModelChange();
        await flushMicrotasks();

        assert.assertEqual(order.length, 2, "both archive and clear ran");
        assert.assertEqual(order[0], "archive", "archiveConversation ran first");
        assert.assertEqual(order[1], "clear", "performClear ran second");
        assert.assertEqual(
          S.currentModel,
          optB,
          "currentModel switched after confirm"
        );
      } finally {
        P.archiveConversation = origArchive;
        P.performClear = origClear;
        if (hadConfirm) window.safeConfirm = origConfirm;
        else delete window.safeConfirm;
        S.els.messageList.innerHTML = listHTML;
        restore(snap);
      }
    },

    "T3: empty-conversation model change switches silently with no archive":
      async function (assert) {
        requireMounted();
        var snap = snapshot();
        var listHTML = S.els.messageList.innerHTML;
        var hadConfirm = "safeConfirm" in window;
        var origConfirm = window.safeConfirm;
        var origArchive = P.archiveConversation;
        try {
          var opts = S.els.select.options;
          var optA = opts[0].value;
          var optB = opts[1].value;

          var archiveCalled = false;
          var confirmCalled = false;
          P.archiveConversation = function () {
            archiveCalled = true;
            return origArchive.apply(this, arguments);
          };
          window.safeConfirm = function () {
            confirmCalled = true;
            return Promise.resolve(true);
          };

          S.messages = [];
          S.currentModel = optA;
          S.currentEmbed = { model: "local/" + optA };
          S.els.select.value = optB;

          window.localChatModelChange();
          await flushMicrotasks();

          assert.assertFalse(confirmCalled, "no confirm dialog when empty");
          assert.assertFalse(archiveCalled, "no archive when empty");
          assert.assertEqual(
            S.currentModel,
            optB,
            "model switched silently when empty"
          );
          assert.assertEqual(
            S.currentEmbed,
            null,
            "embed reset on silent switch"
          );
        } finally {
          P.archiveConversation = origArchive;
          if (hadConfirm) window.safeConfirm = origConfirm;
          else delete window.safeConfirm;
          S.els.messageList.innerHTML = listHTML;
          restore(snap);
        }
      },
  };

  // ── Register with the Phase 9A runner (console parity) ──────────────────
  if (window.ImageDescriberTests) {
    window.ImageDescriberTests.register("local-chat-ui-persistence", {
      name: "Local Chat UI — Tier 1 Persistence (Stage 1a)",
      tests: tier1Tests,
    });
    window.ImageDescriberTests.register("local-chat-ui-dom", {
      name: "Local Chat UI — Tier 2 DOM (Stage 1a)",
      tests: tier2Tests,
    });
    window.ImageDescriberTests.register("local-chat-ui-sendflow", {
      name: "Local Chat UI — Tier 3 Send Flow (Stage 1a)",
      tests: tier3Tests,
    });
  } else {
    logWarn("ImageDescriberTests not loaded — modules not registered.");
  }

  // ── Shape 1 runner ──────────────────────────────────────────────────────

  async function runMaps(maps) {
    var results = {};
    var passed = 0;
    for (var m = 0; m < maps.length; m++) {
      var map = maps[m];
      var names = Object.keys(map);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
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
    var total = Object.keys(results).length;
    return { passed: passed, total: total, results: results };
  }

  async function runStructural() {
    console.log(
      "%c══ Local Chat UI Characterisation — Stage 1a ══",
      STYLES.heading
    );
    var out = await runMaps([tier1Tests, tier2Tests, tier3Tests]);
    var style = out.passed === out.total ? STYLES.pass : STYLES.fail;
    var icon = out.passed === out.total ? "ALL PASSED" : "FAILURES DETECTED";
    console.log(
      "%c " + icon + " %c — " + out.passed + " / " + out.total + " passed",
      style,
      ""
    );
    window._localChatUIResults = out;
    return out;
  }

  var LocalChatUITests = {
    runStructural: runStructural,
    runAll: runStructural,
    runTier1: function () {
      return runMaps([tier1Tests]);
    },
    runTier2: function () {
      return runMaps([tier2Tests]);
    },
    runTier3: function () {
      return runMaps([tier3Tests]);
    },
  };

  window.LocalChatUITests = LocalChatUITests;

  logInfo(
    "Local Chat UI characterisation suite registered — " +
      "run LocalChatUITests.runStructural()"
  );
})();
