/**
 * Unified Chat Tool — Developer information panel populator (Chat dev panel)
 *
 * Fills the collapsed "Developer information" disclosure (#chat-dev-panel) after
 * each completed turn: the finish reason, the shaped wire request, and the raw
 * response. The request is read from the embed core's scrubbed snapshot
 * (S.embed.getLastWireRequest) so no credential ever reaches the display; for
 * on-device models — where the core captures no wire body — a clearly-labelled
 * pre-shaping PREVIEW is composed from the live engine props and the thread.
 *
 * The panel updates SILENTLY: none of its regions is a live region, so a new
 * turn never speaks the raw JSON. The only spoken cue is the per-block copy
 * button's confirmation, inherited verbatim from the assistant-bubble copy
 * affordance in chat/chat-messages.js.
 *
 * Wired into chat/chat-core.js (postGeneration, postError, updateConversationUI)
 * separately; this file just loads and exposes window.ChatDevPanel. Loads AFTER
 * chat/chat.js (which creates window.ChatState).
 *
 * @version 0.1.0 — Chat developer panel (Stage B)
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
      args.unshift("[ChatDevPanel]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Re-bindable module-local reference to this tool's conversation state.
  // Defaults to window.ChatState; attach(state) can re-point it. Internal code
  // reads the state — its currentModel, messages and embed handle — live
  // through S at call time, never caching them at load (parity with
  // chat-model-info.js).
  let S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-dev-panel.js",
    );
    return;
  }

  // Re-point the module at a freshly-attached state object.
  function attach(state) {
    if (state) S = state;
  }

  // ── Element ids (namespaced chat-dev-*; created HTML-first in tools.html) ──
  const FINISH_ID = "chat-dev-finish-reason";
  const REQUEST_ID = "chat-dev-request";
  const RESPONSE_ID = "chat-dev-response";
  const REQUEST_NOTE_ID = "chat-dev-request-note";
  const COPY_REQUEST_ID = "chat-dev-copy-request";
  const COPY_RESPONSE_ID = "chat-dev-copy-response";

  // Resting placeholder for the finish-reason line when there is no turn to
  // report on (a cleared thread, or before the first send).
  const FINISH_RESTING = "Not reported";

  // The local-model request note — the request is a pre-shaping preview, not the
  // real wire body, because the core captures no wire request for on-device runs.
  const LOCAL_REQUEST_NOTE =
    "Request preview — provider shaping is not captured for local models.";

  // Prism is skipped above this length: highlighting multi-MB strings freezes
  // the browser. Matches the old tool's 100KB threshold.
  const MAX_HIGHLIGHT_LENGTH = 100000;

  // ── Pure helpers ───────────────────────────────────────────────────────────

  /**
   * Derive a human-readable finish-reason string from a raw response body.
   * Reads raw.choices[0].finish_reason and, when present, appends
   * " (native: X)" from native_finish_reason (parity with the old tool's
   * updateFinishReason). Returns "not reported" when the choices/finish_reason
   * are absent — covering the Responses surface and on-device runs. Null-safe.
   *
   * @param {Object|null} raw - The raw response body (response.raw).
   * @returns {string}
   */
  function normaliseFinishReason(raw) {
    const choice = raw && raw.choices && raw.choices[0];
    const reason = choice && choice.finish_reason;
    if (!reason) return "not reported";
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
      const preview = str.slice(0, 2000);
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
   * Compose a PRE-SHAPING request preview for an on-device model, since the core
   * captures no wire body for local runs. Reads the live engine props off
   * S.embed and the current thread off S.messages. The caller labels this as a
   * preview (see LOCAL_REQUEST_NOTE); it is not the real provider payload.
   *
   * @returns {Object}
   */
  function buildLocalRequestPreview() {
    const e = S.embed || {};
    const preview = {
      model: e.model || S.currentModel || null,
      messages: (S.messages || []).map(function (m) {
        return { role: m.role, content: m.content };
      }),
      temperature: e.temperature,
      top_p: e.top_p,
      frequency_penalty: e.frequency_penalty,
      presence_penalty: e.presence_penalty,
      max_tokens: e.max_tokens,
    };
    if (e.systemPrompt) preview.systemPrompt = e.systemPrompt;
    return preview;
  }

  // ── Public update ──────────────────────────────────────────────────────────

  /**
   * Repopulate the three developer regions from a completed (or errored) turn.
   * Silent: no region is a live region, so this never speaks. Every element
   * lookup is guarded — a missing panel is a warn, never a throw.
   *
   * @param {Object|null} response - The engine response ({ text, raw, ... }) or
   *                                 an error-shaped { raw } for the error path.
   */
  function update(response) {
    const raw = response && response.raw;

    // Finish reason (plain text — the <dt> "Finish reason" supplies context).
    const finishEl = document.getElementById(FINISH_ID);
    if (finishEl) {
      finishEl.textContent = normaliseFinishReason(raw);
    } else {
      logWarn("update: #" + FINISH_ID + " not found");
    }

    // Request — the scrubbed wire snapshot for cloud models; a labelled preview
    // for on-device models (the core captures no wire body for those).
    const requestEl = document.getElementById(REQUEST_ID);
    const noteEl = document.getElementById(REQUEST_NOTE_ID);
    const isLocal =
      typeof S.currentModel === "string" &&
      S.currentModel.indexOf("local/") === 0;
    if (requestEl) {
      if (isLocal) {
        renderJson(requestEl, buildLocalRequestPreview());
        if (noteEl) {
          noteEl.textContent = LOCAL_REQUEST_NOTE;
          noteEl.hidden = false;
        }
      } else {
        const wire =
          S.embed && typeof S.embed.getLastWireRequest === "function"
            ? S.embed.getLastWireRequest()
            : null;
        renderJson(requestEl, wire);
        if (noteEl) {
          noteEl.textContent = "";
          noteEl.hidden = true;
        }
      }
    } else {
      logWarn("update: #" + REQUEST_ID + " not found");
    }

    // Response — the raw response body verbatim.
    const responseEl = document.getElementById(RESPONSE_ID);
    if (responseEl) {
      renderJson(responseEl, raw);
    } else {
      logWarn("update: #" + RESPONSE_ID + " not found");
    }
  }

  /**
   * Blank the three regions and reset the finish reason to its resting
   * placeholder. Called through the single conversation-state seam when the
   * thread is emptied, so a cleared chat blanks the panel too.
   */
  function clear() {
    const finishEl = document.getElementById(FINISH_ID);
    if (finishEl) finishEl.textContent = FINISH_RESTING;

    const requestEl = document.getElementById(REQUEST_ID);
    if (requestEl) {
      requestEl.textContent = "";
      delete requestEl.dataset.raw;
    }

    const responseEl = document.getElementById(RESPONSE_ID);
    if (responseEl) {
      responseEl.textContent = "";
      delete responseEl.dataset.raw;
    }

    const noteEl = document.getElementById(REQUEST_NOTE_ID);
    if (noteEl) {
      noteEl.textContent = "";
      noteEl.hidden = true;
    }
  }

  // ── Copy wiring ──────────────────────────────────────────────────────────
  // One copy button per JSON block, matching the assistant-bubble copy
  // affordance (markup, accessible name, and confirmation behaviour) so we
  // inherit an already-verified control and add NO new spoken cue — the
  // "Response copied to clipboard." announcement is the same existing cue.

  // Re-populate any data-icon glyphs after an innerHTML swap (the auto-populator
  // only runs once at DOMContentLoaded).
  function refreshIcons(scope) {
    if (
      window.IconLibrary &&
      typeof window.IconLibrary.populateIcons === "function"
    ) {
      window.IconLibrary.populateIcons(scope);
    } else if (typeof window.refreshIcons === "function") {
      window.refreshIcons(scope);
    }
  }

  function wireCopyButton(buttonId, codeId) {
    const button = document.getElementById(buttonId);
    const codeEl = document.getElementById(codeId);
    if (!button || !codeEl) return;
    // Idempotent: never bind twice.
    if (button.dataset.chatDevWired === "true") return;
    button.dataset.chatDevWired = "true";

    const restore = button.innerHTML;
    button.addEventListener("click", function () {
      // Always copy the stored plain JSON, never the highlighted HTML.
      const raw =
        codeEl.dataset.raw != null ? codeEl.dataset.raw : codeEl.textContent || "";
      navigator.clipboard
        .writeText(raw)
        .then(function () {
          button.innerHTML =
            '<span aria-hidden="true" data-icon="check"></span> Copied';
          refreshIcons(button);
          S.announceToScreenReader("Response copied to clipboard.");
          setTimeout(function () {
            button.innerHTML = restore;
            refreshIcons(button);
          }, 2000);
        })
        .catch(function () {
          logWarn("Clipboard write failed");
        });
    });
  }

  function wireCopyButtons() {
    wireCopyButton(COPY_REQUEST_ID, REQUEST_ID);
    wireCopyButton(COPY_RESPONSE_ID, RESPONSE_ID);
  }

  // Wire once the panel markup is present (and its icons populated).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireCopyButtons);
  } else {
    wireCopyButtons();
  }

  // ── Expose module ────────────────────────────────────────────────────────
  window.ChatDevPanel = {
    update: update,
    clear: clear,
    attach: attach,
  };

  logInfo("Developer information module loaded");
})();
