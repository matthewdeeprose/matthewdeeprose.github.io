/**
 * Local Chat — Shared State Module
 * Mutable namespace shared by all Local Chat modules via window.LocalChatState.
 *
 * Stage 1b (factory refactor, step 1): the state object is now produced by
 * window.createChatState({ idPrefix, sessionKey, archiveKey }) so a future
 * unified chat can spin up its own independent state. window.LocalChatState
 * remains a back-compatible instance built from the original keys, so every
 * existing consumer (persistence, messages, chips, core) keeps working
 * unchanged.
 *
 * @version 1.1.0 — Stage 1b of Local Chat refactor (additive factory)
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
      args.unshift("[LocalChat]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.log.apply(console, args);
    }
  }

  // ── Shared constants (same value for every instance — NOT per-instance
  //    configuration) ──────────────────────────────────────────────────────

  const SYSTEM_PRESETS = {
    helpful: "You are a helpful, friendly assistant. Provide clear, well-structured answers.",
    concise: "You are a concise assistant. Give brief, direct answers without unnecessary explanation. Use short paragraphs.",
    ukhe: "You are an assistant for UK higher education. Use British English spelling. Tailor explanations for university students and staff. Reference UK academic conventions where relevant.",
    code: "You are a code assistant. Provide clean, well-commented code examples. Explain your approach briefly. Use modern best practices.",
    explain: "You are a patient teacher. Explain concepts simply using plain language and examples. Avoid jargon. Break complex ideas into small steps."
  };

  const STATUS_LABELS = {
    "not-downloaded": "Not downloaded — download in Set Up",
    cached: "Ready",
    loading: "Loading…",
    loaded: "Loaded",
    downloading: "Downloading…",
    "download-error": "Download failed",
    "load-error": "Load failed",
    unknown: "Unknown"
  };

  // Capacity caps are shared across all state instances.
  const SESSION_MAX_BYTES = 500 * 1024;
  const ARCHIVE_MAX_CONVERSATIONS = 20;
  const ARCHIVE_MAX_BYTES = 2 * 1024 * 1024;

  // ── Shared methods (use `this` so they bind to the calling instance) ──────

  function getTemperature() {
    if (this.els.temperatureSlider) {
      return parseFloat(this.els.temperatureSlider.value);
    }
    return 0.7;
  }

  function getMaxTokens() {
    if (this.els.maxTokensSlider) {
      return parseInt(this.els.maxTokensSlider.value, 10);
    }
    return 1024;
  }

  function getTemperatureDescription(value) {
    const v = parseFloat(value);
    if (v <= 0.3) return "Very focused and consistent";
    if (v <= 0.7) return "Balanced creativity and consistency";
    if (v <= 1.3) return "More creative and varied";
    if (v <= 1.7) return "Highly creative responses";
    return "Maximum creativity and randomness";
  }

  function getMaxTokensDescription(value) {
    const v = parseInt(value, 10);
    if (v <= 256) return "Very short responses";
    if (v <= 512) return "Short, concise responses";
    if (v <= 1024) return "Moderate length responses";
    if (v <= 2048) return "Detailed responses";
    return "Very detailed, comprehensive responses";
  }

  function announceToScreenReader(text) {
    if (
      window.accessibilityHelpers &&
      typeof window.accessibilityHelpers.announceToScreenReader === "function"
    ) {
      window.accessibilityHelpers.announceToScreenReader(text);
    }
  }

  function setMessageListLive(value) {
    if (this.els.messageList) {
      this.els.messageList.setAttribute("aria-live", value);
    }
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Build a fresh Local-Chat-style state object.
   *
   * Accepts either an options object — createChatState({ idPrefix, sessionKey,
   * archiveKey }) — or the three values positionally, so the back-compatible
   * call createChatState('local-chat', 'local-chat-session', 'local-chat-history')
   * also works.
   *
   * @param {string|Object} idPrefix   — id prefix, or an options object
   * @param {string} [sessionKey]      — sessionStorage key for the live session
   * @param {string} [archiveKey]      — localStorage key for the conversation archive
   * @returns {Object} a fresh state instance
   */
  function createChatState(idPrefix, sessionKey, archiveKey) {
    // Allow an options object as the first argument.
    if (idPrefix && typeof idPrefix === "object") {
      const opts = idPrefix;
      archiveKey = opts.archiveKey;
      sessionKey = opts.sessionKey;
      idPrefix = opts.idPrefix;
    }

    return {
      // ── Mutable state (fresh per instance) ──────────────────────────────
      messages: [],
      currentEmbed: null,
      isGenerating: false,
      currentModel: null,
      editingBubble: null,

      // Cached DOM elements (populated by core cacheElements())
      els: {},

      // ── Instance identity (derived from the factory arguments) ──────────
      idPrefix: idPrefix,
      sessionKey: sessionKey,
      archiveKey: archiveKey,

      // Build an element id from this instance's id prefix. Captures idPrefix
      // from the factory arguments at creation time (a closure), not via this,
      // so it is safe even when called detached.
      elId: (suffix) => idPrefix + "-" + suffix,

      // ── Constants ───────────────────────────────────────────────────────

      SYSTEM_PRESETS: SYSTEM_PRESETS,

      STATUS_LABELS: STATUS_LABELS,

      // Storage keys (back-compat aliases of sessionKey / archiveKey).
      SESSION_KEY: sessionKey,
      SESSION_MAX_BYTES: SESSION_MAX_BYTES,
      ARCHIVE_KEY: archiveKey,
      ARCHIVE_MAX_CONVERSATIONS: ARCHIVE_MAX_CONVERSATIONS,
      ARCHIVE_MAX_BYTES: ARCHIVE_MAX_BYTES,

      // ── Logging functions (shared by all modules) ───────────────────────
      logError: logError,
      logWarn: logWarn,
      logInfo: logInfo,
      logDebug: logDebug,

      // ── Parameter helpers ───────────────────────────────────────────────

      getTemperature: getTemperature,

      getMaxTokens: getMaxTokens,

      getTemperatureDescription: getTemperatureDescription,

      getMaxTokensDescription: getMaxTokensDescription,

      // ── Screen reader helpers ───────────────────────────────────────────

      announceToScreenReader: announceToScreenReader,

      setMessageListLive: setMessageListLive
    };
  }

  // ── Expose factory + back-compatible default instance ─────────────────────

  window.createChatState = createChatState;

  // Back-compat: the original Local Chat state, built from the original keys.
  window.LocalChatState = createChatState(
    "local-chat",
    "local-chat-session",
    "local-chat-history"
  );
})();
