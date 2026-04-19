/**
 * Local Chat — Shared State Module
 * Mutable namespace shared by all Local Chat modules via window.LocalChatState.
 *
 * @version 1.0.0 — Stage R1 of Local Chat refactor
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
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
    if (shouldLog(LOG_LEVELS.ERROR)) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[LocalChat]");
      console.log.apply(console, args);
    }
  }

  // ── Shared mutable state ──────────────────────────────────────────────
  window.LocalChatState = {
    // Mutable state
    messages: [],
    currentEmbed: null,
    isGenerating: false,
    currentModel: null,
    editingBubble: null,

    // Cached DOM elements (populated by core cacheElements())
    els: {},

    // ── Constants ─────────────────────────────────────────────────────────

    SYSTEM_PRESETS: {
      helpful: "You are a helpful, friendly assistant. Provide clear, well-structured answers.",
      concise: "You are a concise assistant. Give brief, direct answers without unnecessary explanation. Use short paragraphs.",
      ukhe: "You are an assistant for UK higher education. Use British English spelling. Tailor explanations for university students and staff. Reference UK academic conventions where relevant.",
      code: "You are a code assistant. Provide clean, well-commented code examples. Explain your approach briefly. Use modern best practices.",
      explain: "You are a patient teacher. Explain concepts simply using plain language and examples. Avoid jargon. Break complex ideas into small steps."
    },

    STATUS_LABELS: {
      "not-downloaded": "Not downloaded \u2014 download in Set Up",
      cached: "Ready",
      loading: "Loading\u2026",
      loaded: "Loaded",
      downloading: "Downloading\u2026",
      "download-error": "Download failed",
      "load-error": "Load failed",
      unknown: "Unknown"
    },

    SESSION_KEY: "local-chat-session",
    SESSION_MAX_BYTES: 500 * 1024,
    ARCHIVE_KEY: "local-chat-history",
    ARCHIVE_MAX_CONVERSATIONS: 20,
    ARCHIVE_MAX_BYTES: 2 * 1024 * 1024,

    // ── Logging functions (shared by all modules) ─────────────────────────
    logError: logError,
    logWarn: logWarn,
    logInfo: logInfo,
    logDebug: logDebug,

    // ── Parameter helpers ─────────────────────────────────────────────────

    getTemperature: function () {
      if (this.els.temperatureSlider) {
        return parseFloat(this.els.temperatureSlider.value);
      }
      return 0.7;
    },

    getMaxTokens: function () {
      if (this.els.maxTokensSlider) {
        return parseInt(this.els.maxTokensSlider.value, 10);
      }
      return 1024;
    },

    getTemperatureDescription: function (value) {
      var v = parseFloat(value);
      if (v <= 0.3) return "Very focused and consistent";
      if (v <= 0.7) return "Balanced creativity and consistency";
      if (v <= 1.3) return "More creative and varied";
      if (v <= 1.7) return "Highly creative responses";
      return "Maximum creativity and randomness";
    },

    getMaxTokensDescription: function (value) {
      var v = parseInt(value, 10);
      if (v <= 256) return "Very short responses";
      if (v <= 512) return "Short, concise responses";
      if (v <= 1024) return "Moderate length responses";
      if (v <= 2048) return "Detailed responses";
      return "Very detailed, comprehensive responses";
    },

    // ── Screen reader helpers ─────────────────────────────────────────────

    announceToScreenReader: function (text) {
      if (
        window.accessibilityHelpers &&
        typeof window.accessibilityHelpers.announceToScreenReader === "function"
      ) {
        window.accessibilityHelpers.announceToScreenReader(text);
      }
    },

    setMessageListLive: function (value) {
      if (this.els.messageList) {
        this.els.messageList.setAttribute("aria-live", value);
      }
    }
  };
})();
