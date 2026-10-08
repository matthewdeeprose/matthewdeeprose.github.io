/**
 * Developer information panel — shared renderer (Chat and the Graph Builder image tab)
 *
 * window.DevPanel.create({ ids, copiedMessages, announce, wiredKey, finishReasonFromResponse })
 * returns { update(response, wire, note), clear() } for ONE panel. The panel's markup
 * lives in the page (HTML-first); this file only fills it, clears it, and wires its two
 * copy buttons. The caller supplies the element ids, the copy confirmations and the
 * announce function, so the same code serves a panel in any tool.
 *
 * The panel updates SILENTLY: none of its regions is a live region. The only spoken cue
 * is the copy confirmation, raised as a success notification by the caller's notifyCopied
 * function (the toast is the one voice; the copy buttons themselves never change).
 *
 * The request shown is whatever the caller passes as `wire`. Callers read the embed
 * core's scrubbed snapshot (getLastWireRequest), so no credential and no image data ever
 * reaches the display.
 *
 * @version 0.1.0 — extracted from chat/chat-dev-panel.js (UX-5)
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
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
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[DevPanel]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[DevPanel]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[DevPanel]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[DevPanel]");
      console.log.apply(console, args);
    }
  }

  // Resting placeholder for the finish-reason line when there is no run to report on.
  const FINISH_RESTING = "Not reported";
  const FINISH_ABSENT = "not reported";

  // Prism is skipped above this length: highlighting multi-MB strings freezes the
  // browser.
  const MAX_HIGHLIGHT_LENGTH = 100000;
  const PREVIEW_LENGTH = 2000;
  // The reply text, put together from the stream, is added to the Response view under this key.
  const REPLY_TEXT_KEY = "replyText";
  const REPLY_FROM_STREAM_NOTE =
    "The reply text was put together from the stream; the provider's last message did not include it.";
  const EXPAND_LABEL = { more: "Show the whole request", less: "Show less" };
  const DEFAULT_WIRED_KEY = "devPanelWired";

  // ── Pure helpers ───────────────────────────────────────────────────────────

  /**
   * Derive a human-readable finish-reason string. Reads raw.choices[0].finish_reason
   * and, when present, appends " (native: X)". When the raw body carries none (a
   * streamed reply, the Responses surface) and fromResponse is on, falls back to the
   * response's own finishReason. Null-safe.
   *
   * @param {Object|null} response - The engine response ({ raw, finishReason, ... }).
   * @param {boolean} fromResponse - Whether response.finishReason may be read.
   * @returns {string}
   */
  function normaliseFinishReason(response, fromResponse) {
    if (fromResponse && response && typeof response.finishReason === "string" && response.finishReason) {
      return response.finishReason;
    }
    const raw = response && response.raw;
    const choice = raw && raw.choices && raw.choices[0];
    const reason = choice && choice.finish_reason;
    if (!reason) return FINISH_ABSENT;
    const nativeReason = choice.native_finish_reason;
    return nativeReason ? reason + " (native: " + nativeReason + ")" : reason;
  }

  /**
   * Render a value as pretty JSON into a <code> element, Prism-highlighted when
   * available and safe to do so. The full JSON string is always stored on the
   * element's dataset (data-raw) so the copy button yields plain JSON, never the
   * highlighted HTML — even when the visible text is truncated for display.
   *
   * @param {HTMLElement|null} codeEl - The <code class="language-json"> target.
   * @param {*} value - Any JSON-serialisable value (may be null/undefined).
   */
  function renderJson(codeEl, value) {
    if (!codeEl) {
      logWarn("renderJson: target element missing");
      return;
    }

    let str;
    try {
      str = JSON.stringify(value, null, 2);
    } catch (err) {
      logWarn("renderJson: JSON.stringify failed", err);
      str = String(value);
    }
    // JSON.stringify(undefined) returns undefined, not a string.
    if (typeof str !== "string") str = "null";

    // The copy button always reads plain JSON from here.
    codeEl.dataset.raw = str;

    if (str.length > MAX_HIGHLIGHT_LENGTH) {
      // Too large for Prism — show a short preview and note the full size. The
      // full string still lives on dataset.raw, so copy yields everything.
      const preview = str.slice(0, PREVIEW_LENGTH);
      const kb = (str.length / 1024).toFixed(1);
      codeEl.textContent =
        preview +
        "\n\n... [truncated for display: " +
        kb +
        "KB total; full data was sent]";
    } else if (
      window.Prism &&
      window.Prism.languages &&
      window.Prism.languages.json
    ) {
      // Prism.highlight escapes the source, so this is safe against injection.
      codeEl.innerHTML = window.Prism.highlight(
        str,
        window.Prism.languages.json,
        "json",
      );
    } else {
      codeEl.textContent = str;
    }
  }

  /**
   * True when the raw body already carries a reply: some choice holds message content.
   * A streamed Foundry reply ends in a usage-only chunk, so its raw `choices` is `[]`.
   */
  function rawCarriesReply(raw) {
    const choices = raw && raw.choices;
    if (!Array.isArray(choices)) return false;
    return choices.some(function (choice) {
      const content = choice && choice.message && choice.message.content;
      return Array.isArray(content) ? content.length > 0 : typeof content === "string" && content !== "";
    });
  }

  /**
   * What the Response view shows. The raw object unchanged when it carries the reply;
   * otherwise, when the response object holds the streamed reply text, the raw object
   * unchanged plus one top-level `replyText` key. Never invents `choices`.
   *
   * @returns {{ shown: *, fromStream: boolean }}
   */
  function responseToShow(response) {
    const raw = response && response.raw;
    const text = response && response.text;
    const isObject = raw && typeof raw === "object" && !Array.isArray(raw);
    if (!isObject || rawCarriesReply(raw) || typeof text !== "string" || text === "") {
      return { shown: raw, fromStream: false };
    }
    const shown = Object.assign({}, raw);
    shown[REPLY_TEXT_KEY] = text;
    return { shown: shown, fromStream: true };
  }

  // ── Factory ────────────────────────────────────────────────────────────────

  /**
   * @param {Object} options
   * @param {Object} options.ids - { finish, request, response, note, copyRequest, copyResponse }.
   * @param {Object} options.copiedMessages - { request, response } confirmation texts.
   * @param {Function} options.notifyCopied - Called with a confirmation text; raises the caller's success notification, which is the one voice.
   * @param {string} [options.wiredKey] - dataset key marking a copy button as bound.
   * @param {boolean} [options.finishReasonFromResponse=true] - Read response.finishReason first.
   * @returns {{ update: Function, clear: Function }}
   */
  function create(options) {
    const ids = options.ids;
    const copiedMessages = options.copiedMessages;
    const notifyCopied = options.notifyCopied;
    const wiredKey = options.wiredKey || DEFAULT_WIRED_KEY;
    const finishFromResponse = options.finishReasonFromResponse !== false;

    /**
     * Repopulate the three regions. Silent. Every element lookup is guarded — a
     * missing panel is a warn, never a throw.
     *
     * @param {Object|null} response - { raw, finishReason, ... } or an error-shaped { raw }.
     * @param {*} wire - The request to show (the scrubbed snapshot, or a preview).
     * @param {string} [note] - Caption above the request; empty or absent hides it.
     */
    function update(response, wire, note) {
      const reply = responseToShow(response);
      if (reply.fromStream) {
        note = note ? note + " " + REPLY_FROM_STREAM_NOTE : REPLY_FROM_STREAM_NOTE;
      }

      const finishEl = document.getElementById(ids.finish);
      if (finishEl) {
        finishEl.textContent = normaliseFinishReason(response, finishFromResponse);
      } else {
        logWarn("update: #" + ids.finish + " not found");
      }

      const requestEl = document.getElementById(ids.request);
      const noteEl = document.getElementById(ids.note);
      if (requestEl) {
        renderJson(requestEl, wire);
        if (noteEl) {
          noteEl.textContent = note || "";
          noteEl.hidden = !note;
        }
      } else {
        logWarn("update: #" + ids.request + " not found");
      }

      const responseEl = document.getElementById(ids.response);
      if (responseEl) {
        renderJson(responseEl, reply.shown);
      } else {
        logWarn("update: #" + ids.response + " not found");
      }
    }

    /** Blank the regions and reset the finish reason to its resting placeholder. */
    function clear() {
      const finishEl = document.getElementById(ids.finish);
      if (finishEl) finishEl.textContent = FINISH_RESTING;

      const requestEl = document.getElementById(ids.request);
      if (requestEl) {
        requestEl.textContent = "";
        delete requestEl.dataset.raw;
      }

      const responseEl = document.getElementById(ids.response);
      if (responseEl) {
        responseEl.textContent = "";
        delete responseEl.dataset.raw;
      }

      const noteEl = document.getElementById(ids.note);
      if (noteEl) {
        noteEl.textContent = "";
        noteEl.hidden = true;
      }
    }

    function wireCopyButton(buttonId, codeId, message) {
      const button = document.getElementById(buttonId);
      const codeEl = document.getElementById(codeId);
      if (!button || !codeEl) return;
      // Idempotent: never bind twice.
      if (button.dataset[wiredKey] === "true") return;
      button.dataset[wiredKey] = "true";

      button.addEventListener("click", function () {
        // Always copy the stored plain JSON, never the highlighted HTML.
        const raw =
          codeEl.dataset.raw != null ? codeEl.dataset.raw : codeEl.textContent || "";
        navigator.clipboard
          .writeText(raw)
          .then(function () {
            // The button never changes; the success notification is the one voice.
            if (typeof notifyCopied === "function") notifyCopied(message);
          })
          .catch(function () {
            logWarn("Clipboard write failed");
          });
      });
    }

    /** One toggle beside the Request view: lifts or restores the height limit on its <pre>. */
    function wireExpandButton() {
      const button = ids.expandRequest && document.getElementById(ids.expandRequest);
      const pre = ids.requestPre && document.getElementById(ids.requestPre);
      if (!button || !pre) return;
      if (button.dataset[wiredKey] === "true") return;
      button.dataset[wiredKey] = "true";
      button.addEventListener("click", function () {
        const expand = button.getAttribute("aria-expanded") !== "true";
        pre.style.maxHeight = expand ? "none" : "";
        button.setAttribute("aria-expanded", expand ? "true" : "false");
        button.textContent = expand ? EXPAND_LABEL.less : EXPAND_LABEL.more;
      });
    }

    function wireCopyButtons() {
      wireCopyButton(ids.copyRequest, ids.request, copiedMessages.request);
      wireCopyButton(ids.copyResponse, ids.response, copiedMessages.response);
      wireExpandButton();
    }

    // Wire once the panel markup is present (and its icons populated).
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireCopyButtons);
    } else {
      wireCopyButtons();
    }

    return { update: update, clear: clear };
  }

  window.DevPanel = { create: create };

  logInfo("Developer panel factory loaded");
})();
