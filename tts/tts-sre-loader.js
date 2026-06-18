/**
 * TTS SRE Loader — Stage 0
 *
 * Shared lazy CDN loader for the Speech Rule Engine (speech-rule-engine@4).
 * Configures SRE once for Clearspeak English speech output and returns the
 * cached `window.SRE` to every caller thereafter.
 *
 * Used by panels that need to convert MathML to Clearspeak speech text for
 * TTS (MathPix Processed Output, Image Describer, Local Chat, …). Loaded on
 * first call only — never at module init or page load.
 *
 * Why a shared module: the bundled MathJax SRE (Path 1) and the MMD-CDN's
 * `latexToSpeech` (Path 2) produce inconsistent speech across the
 * dual-renderer setup; loading SRE directly here gives every TTS consumer
 * one Clearspeak source-of-truth without touching either screen-reader
 * pipeline. Concurrent first-call requests from different panels share a
 * single network fetch via the promise cache.
 *
 * Semantics:
 *   - Idempotent. Concurrent callers share one in-flight promise.
 *   - On failure the cached promise reference is cleared so the next call
 *     can retry. The caller still receives the rejection from their await.
 *   - `isLoaded()` reports `true` only after a previous `loadSRE()` has
 *     fully resolved (setupEngine complete, `window.SRE` usable). UI code
 *     can gate a "Preparing…" spinner on this without awaiting.
 *
 * Public API:
 *   window.TTSSreLoader.loadSRE()  → Promise<SRE>
 *   window.TTSSreLoader.isLoaded() → boolean
 *
 * Locale note: SRE locale stays `"en"` — there is no `en-GB` locale at the
 * time of writing; the Clearspeak rules are language-agnostic enough that
 * this rarely matters in practice.
 *
 * @author Matthew Deeprose
 */
const TTSSreLoader = (function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
      console.error("[TTSSreLoader]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TTSSreLoader]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TTSSreLoader]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TTSSreLoader]", message, ...args);
  }

  // ==========================================================================
  // STATE
  // ==========================================================================

  const SRE_CDN_URL =
    "https://cdn.jsdelivr.net/npm/speech-rule-engine@4/lib/sre.js";
  let _srePromise = null;
  let _isLoaded = false;

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  function loadSRE() {
    if (_srePromise) return _srePromise;
    logDebug("First call — initiating SRE load from CDN");
    _srePromise = (async () => {
      if (typeof window.SRE === "undefined") {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector(
            'script[data-sre-loader="true"]',
          );
          if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener(
              "error",
              () => reject(new Error("SRE script tag failed")),
              { once: true },
            );
            return;
          }
          const script = document.createElement("script");
          script.src = SRE_CDN_URL;
          script.async = true;
          script.dataset.sreLoader = "true";
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener(
            "error",
            () => reject(new Error("SRE script failed to load")),
            { once: true },
          );
          document.head.appendChild(script);
        });
      }
      if (typeof window.SRE === "undefined" || !window.SRE.setupEngine) {
        throw new Error("SRE library loaded but window.SRE.setupEngine missing");
      }
      await window.SRE.setupEngine({
        domain: "clearspeak",
        style: "default",
        modality: "speech",
        locale: "en",
      });
      return window.SRE;
    })();
    // Mark loaded only after full resolution (setupEngine complete).
    _srePromise.then(
      () => {
        _isLoaded = true;
        logInfo("SRE ready (Clearspeak, en)");
      },
      () => {
        // Rejection is handled below; this branch exists only to keep this
        // .then chain from producing an unhandled-rejection warning.
      },
    );
    // Allow retry on failure: clear the cached promise so the next call re-tries.
    _srePromise.catch((err) => {
      logWarn("SRE load failed — cache cleared, next call will retry", err);
      _srePromise = null;
      _isLoaded = false;
    });
    return _srePromise;
  }

  function isLoaded() {
    return _isLoaded;
  }

  return {
    loadSRE: loadSRE,
    isLoaded: isLoaded,
  };
})();

window.TTSSreLoader = TTSSreLoader;
