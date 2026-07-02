// Unified Chat — Stage 3 step 7, slice 2: Chat export serialiser suite
//
// Proves the PURE export builders added in step 7 slice 1
// (window.ChatExport.buildMarkdown / buildText / buildHTML / buildJSON). Calls
// the REAL builders — never a reimplementation — from fixed, resolved fixtures
// with controlled labels, so the suite is pure and never touches the live
// picker, S.messages, or a download.
//
// STATIC SUITE — no network, no DOM mutation, no model load. Every case feeds a
// fixed messages array + a fixed meta and asserts substrings / parsed structure
// of the returned string.
//
// Shape 1 runner (the gate Playwright reads back via browser_evaluate):
//     window.ChatExportTests.runStructural()  →  { passed, total, results }
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
      console.error.apply(console, ["[ChatExportTests]", message].concat(args));
  }
  function logWarn(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[ChatExportTests]", message].concat(args));
  }
  function logInfo(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[ChatExportTests]", message].concat(args));
  }

  // ── Console styles (match tests-local-chat-isolation.js) ────────────────
  const STYLES = {
    pass: "color: #2e7d32; font-weight: bold",
    fail: "color: #c62828; font-weight: bold",
    heading: "color: #1565c0; font-weight: bold; font-size: 1.1em",
    dim: "color: #757575",
  };

  // ── Functions under test ────────────────────────────────────────────────
  // Call the REAL pure builders. If ChatExport / buildMarkdown is absent the
  // step 7 slice 1 data layer has not landed — do not register a misleading
  // green.
  const XE = window.ChatExport;
  if (!XE || typeof XE.buildMarkdown !== "function") {
    logWarn(
      "window.ChatExport.buildMarkdown not available — Chat export suite not registered."
    );
    return;
  }

  // ── Fixed fixtures (declared once, reused across cases) ─────────────────
  // RESOLVED messages with controlled labels — no live picker, no download.
  const meta = {
    exportedAtLocal: "1 July 2026, 10:21",
    exportedAtISO: "2026-07-01T09:21:00.000Z",
    count: 3,
    safeName: "chat-conversation-2026-07-01",
    systemPrompt: "You are helpful",
  };
  const msgs = [
    { role: "user", content: "Capital of France?" },
    {
      role: "assistant",
      content: "**Paris**.\n\n```js\nconsole.log('hi')\n```",
      model: "azure-openai/gpt-5.2",
      providerId: "azure-openai",
      modelName: "GPT-5.2",
      providerLabel: "Microsoft Foundry",
    },
    {
      role: "assistant",
      content: "Also Paris.",
      model: "anthropic/claude-haiku-4.5",
      providerId: "openrouter",
      modelName: "Claude Haiku 4.5",
      providerLabel: "OpenRouter",
    },
  ];
  const emptyMeta = {
    exportedAtLocal: "1 July 2026, 10:21",
    exportedAtISO: "2026-07-01T09:21:00.000Z",
    count: 0,
    safeName: "chat-conversation-2026-07-01",
    systemPrompt: "",
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
  function assertIncludes(haystack, needle, label) {
    if (typeof haystack !== "string" || haystack.indexOf(needle) === -1) {
      throw new Error(
        (label || "assertIncludes") +
          " — expected output to include " +
          JSON.stringify(needle)
      );
    }
  }
  function assertExcludes(haystack, needle, label) {
    if (typeof haystack === "string" && haystack.indexOf(needle) !== -1) {
      throw new Error(
        (label || "assertExcludes") +
          " — expected output NOT to include " +
          JSON.stringify(needle)
      );
    }
  }

  // ── Cases (each a named result row) ─────────────────────────────────────
  const cases = {
    "markdown: per-turn attribution and raw markdown preserved": function () {
      const md = XE.buildMarkdown(msgs, meta);
      assertIncludes(md, "# Chat conversation", "markdown file heading");
      assertIncludes(md, "3 messages", "markdown message count");
      assertIncludes(md, "**You:**", "markdown user attribution");
      assertIncludes(
        md,
        "**Assistant · GPT-5.2 · Microsoft Foundry:**",
        "markdown Foundry turn attribution"
      );
      assertIncludes(
        md,
        "**Assistant · Claude Haiku 4.5 · OpenRouter:**",
        "markdown OpenRouter turn attribution"
      );
      assertIncludes(md, "```js", "raw fence preserved");
      assertIncludes(md, "console.log('hi')", "raw code preserved");
      return "markdown: 3-turn per-turn attribution + raw fence intact";
    },

    "text: plain attribution and markdown stripped": function () {
      const txt = XE.buildText(msgs, meta);
      assertIncludes(
        txt,
        "Assistant · GPT-5.2 · Microsoft Foundry:",
        "text Foundry attribution"
      );
      assertIncludes(txt, "You:", "text user attribution");
      assertIncludes(txt, "Paris.", "bold stripped to plain");
      assertExcludes(txt, "**Paris**", "no markdown bold");
      assertExcludes(txt, "```", "code fences stripped");
      assertIncludes(txt, "console.log('hi')", "code text kept");
      return "text: attribution plain, bold + fences stripped, code text kept";
    },

    "html: standalone accessible shell (lang en-GB, one h1, an h2 per message)":
      function () {
        const html = XE.buildHTML(msgs, meta);
        assertIncludes(html, '<html lang="en-GB">', "html lang en-GB");
        assertIncludes(html, "Chat conversation", "html title/heading text");
        assertEqual((html.match(/<h1/g) || []).length, 1, "exactly one h1");
        assertEqual((html.match(/<h2/g) || []).length, 3, "one h2 per message");
        assertIncludes(
          html,
          "Assistant · GPT-5.2 · Microsoft Foundry",
          "attribution present in a heading"
        );
        return "html: en-GB shell, 1 h1, 3 h2, attribution in headings";
      },

    "html: content escaped before formatting; fenced code as pre/code; bold as strong":
      function () {
        const html = XE.buildHTML(msgs, meta);
        assertIncludes(
          html,
          "console.log(&#39;hi&#39;)",
          "single quotes escaped"
        );
        assertExcludes(
          html,
          "console.log('hi')",
          "no raw unescaped single quotes"
        );
        assertIncludes(html, "<pre><code", "fenced code opened as pre/code");
        assertIncludes(html, "</code></pre>", "fenced code closed");
        assertIncludes(html, "<strong>Paris</strong>", "bold rendered as strong");
        return "html: escaped-before-format, fenced pre/code, bold → strong";
      },

    "json: valid, file-level meta, per-message provenance": function () {
      const parsed = JSON.parse(XE.buildJSON(msgs, meta));
      assertEqual(parsed.tool, "chat", "json tool");
      assertEqual(parsed.messageCount, 3, "json messageCount");
      assertEqual(parsed.systemPrompt, "You are helpful", "json systemPrompt");
      assertEqual(
        parsed.exportedAt,
        "2026-07-01T09:21:00.000Z",
        "json exportedAt ISO"
      );
      assertEqual(parsed.messages.length, 3, "json messages length");
      assertEqual(
        Object.keys(parsed.messages[0]).sort().join(","),
        "content,role",
        "user message carries only role+content"
      );
      assertEqual(
        parsed.messages[1].model,
        "azure-openai/gpt-5.2",
        "json assistant[1] model"
      );
      assertEqual(
        parsed.messages[1].providerId,
        "azure-openai",
        "json assistant[1] providerId"
      );
      assertEqual(
        parsed.messages[1].modelName,
        "GPT-5.2",
        "json assistant[1] modelName"
      );
      assertEqual(
        parsed.messages[1].providerLabel,
        "Microsoft Foundry",
        "json assistant[1] providerLabel"
      );
      assertEqual(
        parsed.messages[2].providerId,
        "openrouter",
        "json assistant[2] providerId"
      );
      assertEqual(
        parsed.messages[2].providerLabel,
        "OpenRouter",
        "json assistant[2] providerLabel"
      );
      return "json: valid, file-level meta + per-message provenance";
    },

    "empty input: builders return valid output without throwing": function () {
      const md0 = XE.buildMarkdown([], emptyMeta);
      assertTrue(
        typeof md0 === "string" && md0.indexOf("# Chat conversation") === 0,
        "markdown header present on empty"
      );
      const parsed0 = JSON.parse(XE.buildJSON([], emptyMeta));
      assertEqual(parsed0.messages.length, 0, "empty messages array");
      assertEqual(parsed0.messageCount, 0, "empty messageCount");
      return "empty: markdown header intact, json messages []";
    },
  };

  // ── Shape 1 runner ──────────────────────────────────────────────────────
  function runStructural() {
    console.log("%c══ Chat export serialisers — Stage 3 step 7 slice 2 (static) ══", STYLES.heading);
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
    window._chatExportResults = out;
    return out;
  }

  const ChatExportTests = {
    static: true,
    runStructural: runStructural,
    runAll: runStructural,
  };

  window.ChatExportTests = ChatExportTests;

  logInfo("Chat export suite registered (static) — run ChatExportTests.runStructural()");
})();
