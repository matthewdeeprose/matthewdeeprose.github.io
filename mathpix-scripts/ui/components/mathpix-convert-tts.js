/**
 * @fileoverview MathPix Convert Mode — Speak (Read Aloud) wiring (Y.4-early)
 * @module MathPixConvertTts
 * @version 1.0.0
 *
 * @description
 * Hand-wired Speak/Stop/Pause/Resume button for Convert mode, ahead of the
 * Y.3 TTSPanelController factory. Public surface is `attachConvertSpeak`,
 * which the Convert mode controller calls from its `init()`.
 *
 * The export shape (`attachConvertSpeak(controller, opts)`) is intentionally
 * the same shape Y.3's factory `create({...})` is expected to take, so the
 * Y.4 swap is a one-line internal change.
 *
 * @accessibility
 * - Four CSS-selected labels (idle / loading / speaking / paused).
 * - `aria-label` swapped per engine state; `disabled` during loading.
 * - All four states announced via the supplied aria-live status region.
 */

// ============================================================================
// Logging Configuration
// ============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[ConvertTts] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ConvertTts] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ConvertTts] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ConvertTts] ${message}`, ...args);
}

// ============================================================================
// Module-scoped state
// ============================================================================

let activeSpeakBtn = null;
let eventsWired = false;
let engineState = "idle";

// Y.4-early readiness state (Convert preview not always immediately renderable
// because of CDN / MathJax warm-up). When previewReady is false and the engine
// is idle, the Speak button is disabled with an explanatory aria-label.
let previewReady = false;
let previewListenersWired = false;
let previewObserver = null;
const PREVIEW_NOT_READY_STATUS =
  "Preview is still rendering, please try again in a moment";
const PREVIEW_NOT_READY_ARIA_LABEL = "Preview is loading, please wait";

// ============================================================================
// State tables
// ============================================================================

const STATUS_MESSAGES = {
  idle: "",
  loading: "Preparing speech, please wait",
  speaking: "Reading aloud",
  paused: "Paused",
};

const ARIA_LABELS = {
  idle: null,
  loading: "Preparing speech, please wait",
  speaking: "Stop reading",
  paused: "Resume reading",
};

const ICONS = {
  idle: "message",
  loading: "hourglass",
  speaking: "close",
  paused: "message",
};

// ============================================================================
// State setter
// ============================================================================

function setEngineState(opts, state) {
  const { speakBtn, statusEl } = opts;
  if (!speakBtn) return;
  const prevState = engineState;
  engineState = state;
  speakBtn.setAttribute("data-tts-state", state);
  if (state === "idle") {
    // Defer disabled/aria-label to preview readiness.
    applyReadyState(opts);
  } else {
    speakBtn.disabled = state === "loading";
    if (ARIA_LABELS[state]) speakBtn.setAttribute("aria-label", ARIA_LABELS[state]);
    else speakBtn.removeAttribute("aria-label");
  }
  const icon = speakBtn.querySelector(".convert-speak-icon");
  if (icon) {
    icon.setAttribute("data-icon", ICONS[state]);
    if (typeof window.refreshIcons === "function") window.refreshIcons(icon);
  }
  if (statusEl) {
    // Announce "Stopped" only when returning to idle from active playback or
    // pause — mirrors the MathPix Processed Output panel (guide §3.3/§7). A
    // bare empty string here would leave the aria-live region silent on Stop,
    // so a screen-reader user gets no confirmation the reading ended. We do
    // NOT announce on initial setup or a loading→idle bail (where no audio
    // actually played) to avoid a misleading "Stopped".
    if (state === "idle") {
      statusEl.textContent =
        prevState === "speaking" || prevState === "paused" ? "Stopped" : "";
    } else {
      statusEl.textContent = STATUS_MESSAGES[state];
    }
  }
}

// ============================================================================
// Preview-readiness gating (Y.4-early defence in depth)
// ============================================================================
// Backed by three signals: the custom events dispatched from
// mathpix-convert-mode.js::_doRender, a MutationObserver fallback in case
// those events were missed during attach or fired before the listener was
// wired, and direct queries on the Convert mode controller's flags.

function isPreviewReadyForTts(panelEl) {
  if (!panelEl || !panelEl.isConnected) return false;
  if (panelEl.querySelector(".mmd-preview-loading")) return false;
  if (panelEl.children.length === 0) return false;
  const mode =
    typeof window.getMathPixConvertMode === "function"
      ? window.getMathPixConvertMode()
      : null;
  if (mode && mode.pendingPreviewRender) return false;
  const src =
    (mode && (mode.pendingPreviewContent || mode.currentMMDContent)) || "";
  const expectsMath = /\$\$?|\\\[|\\\(/.test(src);
  if (expectsMath && !panelEl.querySelector("mjx-container")) return false;
  return true;
}

// Only call when engineState === "idle". Caller's responsibility.
function applyReadyState(opts) {
  const { speakBtn } = opts;
  if (!speakBtn) return;
  if (previewReady) {
    speakBtn.disabled = false;
    speakBtn.removeAttribute("aria-label");
  } else {
    speakBtn.disabled = true;
    speakBtn.setAttribute("aria-label", PREVIEW_NOT_READY_ARIA_LABEL);
  }
}

function setPreviewReady(opts, ready) {
  if (previewReady === ready) return;
  previewReady = ready;
  logDebug("Preview ready =", ready);
  if (engineState === "idle") applyReadyState(opts);
}

function wirePreviewReadiness(opts) {
  if (previewListenersWired) return;
  const { panelEl } = opts;
  if (!panelEl) return;

  // Initial sync — preview may already be ready by the time we attach.
  setPreviewReady(opts, isPreviewReadyForTts(panelEl));

  // Option A — custom events from _doRender.
  panelEl.addEventListener("convert-preview-rendered", () => {
    setPreviewReady(opts, isPreviewReadyForTts(panelEl));
  });
  panelEl.addEventListener("convert-preview-loading", () => {
    setPreviewReady(opts, false);
  });

  // Option C fallback — MutationObserver catches mode switches, recovery
  // cycles, and any path that doesn't go through _doRender's success/fail
  // branches.
  if (typeof MutationObserver === "function" && !previewObserver) {
    previewObserver = new MutationObserver(() => {
      setPreviewReady(opts, isPreviewReadyForTts(panelEl));
    });
    previewObserver.observe(panelEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  previewListenersWired = true;
  logDebug("Preview readiness wiring attached");
}

// ============================================================================
// Event wiring (one-time)
// ============================================================================

function wireTtsEvents(opts) {
  if (eventsWired) return;
  if (
    !window.EmbedEventEmitter ||
    typeof window.EmbedEventEmitter.on !== "function"
  ) {
    logWarn("EmbedEventEmitter not available — Speak button state will not update");
    return;
  }
  window.EmbedEventEmitter.on("tts:start", () => {
    if (activeSpeakBtn) setEngineState(opts, "speaking");
  });
  window.EmbedEventEmitter.on("tts:end", () => {
    if (activeSpeakBtn) {
      setEngineState(opts, "idle");
      activeSpeakBtn = null;
    }
  });
  window.EmbedEventEmitter.on("tts:error", () => {
    if (activeSpeakBtn) {
      setEngineState(opts, "idle");
      activeSpeakBtn = null;
    }
  });
  window.EmbedEventEmitter.on("tts:pause", () => {
    if (activeSpeakBtn) setEngineState(opts, "paused");
  });
  window.EmbedEventEmitter.on("tts:resume", () => {
    if (activeSpeakBtn) setEngineState(opts, "speaking");
  });
  eventsWired = true;
  logDebug("TTS event listeners wired");
}

// ============================================================================
// Prepare-pipeline
// ============================================================================

async function getPreparedConvertResult(panelEl) {
  if (!panelEl) return null;
  let target = panelEl;
  if (
    window.TTSRewriters &&
    typeof window.TTSRewriters.preparePanelForTts === "function"
  ) {
    target = await window.TTSRewriters.preparePanelForTts(panelEl);
  }
  if (
    window.TTSSemantic &&
    typeof window.TTSSemantic.linearise === "function"
  ) {
    const result = window.TTSSemantic.linearise(target, {
      verbosity: window.TTSSemantic.getVerbosity(),
      skipSelectors: "mathml, asciimath, latex",
    });
    if (result && result.text) return result;
  }
  const plain = (target.innerText || target.textContent || "").trim();
  return plain ? { text: plain, sections: null } : null;
}

// ============================================================================
// Click handler
// ============================================================================

async function handleClick(opts) {
  const { speakBtn, panelEl, flushPendingRender } = opts;
  if (!speakBtn) return;

  // Re-entrancy guard
  if (engineState === "loading") return;

  if (engineState === "speaking") {
    window.TTSController.stop();
    return;
  }
  if (engineState === "paused") {
    window.TTSController.resume();
    return;
  }

  // idle path — flush debounce so what we read is what the user just typed
  if (typeof flushPendingRender === "function") {
    try {
      await flushPendingRender();
    } catch (e) {
      logWarn("flushPendingRender failed", e);
    }
  }

  // Defence in depth: button should already be disabled when the preview
  // is not ready, but a click can still arrive via timing races or
  // assistive tech edge cases. Refuse and announce instead of reading the
  // "Loading preview renderer…" placeholder aloud.
  if (!isPreviewReadyForTts(panelEl)) {
    if (opts.statusEl) {
      opts.statusEl.textContent = PREVIEW_NOT_READY_STATUS;
      setTimeout(() => {
        if (
          opts.statusEl &&
          opts.statusEl.textContent === PREVIEW_NOT_READY_STATUS
        ) {
          opts.statusEl.textContent = "";
        }
      }, 3000);
    }
    return;
  }

  const preflight =
    panelEl && (panelEl.innerText || panelEl.textContent || "").trim();
  if (!preflight) return;

  window.TTSController.stop();
  activeSpeakBtn = speakBtn;

  const sreCached = !!(
    window.TTSSreLoader &&
    typeof window.TTSSreLoader.isLoaded === "function" &&
    window.TTSSreLoader.isLoaded()
  );
  if (!sreCached) setEngineState(opts, "loading");

  try {
    const result = await getPreparedConvertResult(panelEl);
    if (activeSpeakBtn !== speakBtn) {
      if (engineState === "loading") setEngineState(opts, "idle");
      return;
    }
    if (!result || !result.text) {
      if (engineState === "loading") setEngineState(opts, "idle");
      if (activeSpeakBtn === speakBtn) activeSpeakBtn = null;
      return;
    }
    window.TTSController.speak(result);
  } catch (err) {
    logError("Convert Speak prepare-pipeline failed", err);
    if (engineState === "loading") setEngineState(opts, "idle");
    if (activeSpeakBtn === speakBtn) activeSpeakBtn = null;
  }
}

// ============================================================================
// Public surface
// ============================================================================

export function attachConvertSpeak(controller, opts) {
  if (!window.TTSController || !window.TTSController.isAvailable()) {
    logDebug("TTSController not available — Convert Speak disabled");
    return { detach() {} };
  }
  if (typeof window.TTSController.preloadIfNeeded === "function") {
    try {
      window.TTSController.preloadIfNeeded();
    } catch (e) {
      logDebug("preloadIfNeeded threw (non-critical)", e);
    }
  }
  wireTtsEvents(opts);
  wirePreviewReadiness(opts);
  controller._convertSpeakClick = () => handleClick(opts);
  logInfo("Convert Speak attached");

  // detach() is provided for the Y.3/Y.4 factory's teardown contract, but it
  // is deliberately NOT called when the user switches away from MathPix mode:
  //
  //   1. Design decision (plan-y4-early-convert-speak-button.md, decision #2):
  //      speech continues on mode-switch-away, matching Local Chat. There is
  //      no cross-mode coordination to unwind.
  //   2. attachConvertSpeak runs once per controller lifetime (init() is
  //      guarded by `this.initialised`). Calling detach() on mode-exit would
  //      null `_convertSpeakClick` and disconnect the observer with no path to
  //      re-attach — permanently breaking the Speak button on return to
  //      Convert mode.
  //
  // The persistent MutationObserver is benign: it watches a panel that lives
  // for the page lifetime and only does cheap readiness recomputation on
  // mutation; when another mode is active the Convert preview does not mutate.
  // A stale `engineState === "speaking"` while the (hidden) button is off-screen
  // is harmless and is reset by the next `tts:end`/`tts:error`.
  return {
    detach() {
      controller._convertSpeakClick = null;
      if (previewObserver) {
        try {
          previewObserver.disconnect();
        } catch (e) {
          logDebug("previewObserver.disconnect failed (non-critical)", e);
        }
        previewObserver = null;
      }
      previewListenersWired = false;
      // TTS event listeners are module-scoped and one-time-wired by design.
    },
  };
}
