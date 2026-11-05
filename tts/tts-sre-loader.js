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
 *   window.TTSSreLoader.loadSRE([domain]) → Promise<SRE>  (set up for the saved
 *       maths speech style, or `domain`; re-runs setupEngine when it changes)
 *   window.TTSSreLoader.isLoaded() → boolean  (true for the current domain)
 *   window.TTSSreLoader.getDomain() / setDomain(domain) → saved "tts-maths-speech"
 *       ("clearspeak" default, or "mathspeak")
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

  // Pinned to the version an export's own MathJax carries (4.0.6), so a formula is
  // spoken with the same engine as Read Aloud in an export. The floating
  // `@4` range resolved to 4.1.5, which words bold letters and logarithms
  // differently (RA-67, RA-69).
  const SRE_CDN_URL =
    "https://cdn.jsdelivr.net/npm/speech-rule-engine@4.0.6/lib/sre.js";

  // Maths speech style (RA-89, register 56): which SRE domain Read Aloud speaks
  // equations in. Saved under the tts- key convention; ClearSpeak is the default.
  const MATHS_SPEECH_DOMAIN = Object.freeze({
    CLEARSPEAK: "clearspeak",
    MATHSPEAK: "mathspeak",
  });
  const MATHS_SPEECH_STORAGE_KEY = "tts-maths-speech";

  // SRE's setupEngine HANGS rather than rejecting when its locale data is
  // unreachable (the export's Read Aloud measured this), so every call is raced
  // against this bound. A timeout rejects and callers fall back to aria-labels.
  const SETUP_ENGINE_TIMEOUT_MS = 20000;

  // The script is fetched once and kept; the engine is (re)configured whenever
  // the wanted domain differs from the configured one. _setupChain serialises
  // those configurations so two domains can never interleave.
  let _scriptPromise = null;
  let _setupChain = Promise.resolve();
  let _srePromise = null;
  let _readyDomain = null;
  let _isLoaded = false;

  // ==========================================================================
  // MATHS SPEECH STYLE
  // ==========================================================================

  function isValidDomain(value) {
    return (
      value === MATHS_SPEECH_DOMAIN.CLEARSPEAK ||
      value === MATHS_SPEECH_DOMAIN.MATHSPEAK
    );
  }

  /** The saved maths speech style; ClearSpeak when nothing valid is saved. */
  function getDomain() {
    try {
      const saved = window.localStorage.getItem(MATHS_SPEECH_STORAGE_KEY);
      if (isValidDomain(saved)) return saved;
    } catch (err) {
      logDebug("localStorage unavailable — using ClearSpeak", err);
    }
    return MATHS_SPEECH_DOMAIN.CLEARSPEAK;
  }

  /** Save the maths speech style. Returns false for an unknown value. */
  function setDomain(domain) {
    if (!isValidDomain(domain)) {
      logWarn("Unknown maths speech style ignored:", domain);
      return false;
    }
    try {
      window.localStorage.setItem(MATHS_SPEECH_STORAGE_KEY, domain);
    } catch (err) {
      logWarn("Could not save the maths speech style", err);
    }
    return true;
  }

  function withTimeout(promise, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(label + " timed out")),
        SETUP_ENGINE_TIMEOUT_MS,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Resolve the SRE engine configured for `domain` (default: the saved style).
   * Re-runs setupEngine when the wanted domain differs from the configured one.
   */
  function loadSRE(wantedDomain) {
    const domain = isValidDomain(wantedDomain) ? wantedDomain : getDomain();
    if (_srePromise && _readyDomain === domain) return _srePromise;
    if (_readyDomain !== domain) _isLoaded = false;
    logDebug("Configuring SRE for", domain);
    const mine = _scriptLoad().then((sre) => {
      const run = _setupChain.then(() =>
        withTimeout(
          Promise.resolve(
            sre.setupEngine({
              domain: domain,
              style: "default",
              modality: "speech",
              locale: "en",
            }),
          ),
          "SRE setupEngine",
        ),
      );
      _setupChain = run.catch(() => {});
      return run.then(() => sre);
    });
    _srePromise = mine;
    _readyDomain = domain;
    // Mark loaded only after full resolution (setupEngine complete).
    mine.then(
      () => {
        if (_srePromise === mine) {
          _isLoaded = true;
          logInfo("SRE ready (" + domain + ", en)");
        }
      },
      () => {
        // Rejection is handled below; this branch exists only to keep this
        // .then chain from producing an unhandled-rejection warning.
      },
    );
    // Allow retry on failure: clear the cached promise so the next call re-tries.
    mine.catch((err) => {
      logWarn("SRE load failed — cache cleared, next call will retry", err);
      if (_srePromise === mine) {
        _srePromise = null;
        _readyDomain = null;
        _isLoaded = false;
      }
    });
    return mine;
  }

  /** Fetch the SRE script once (no engine set-up). Resolves window.SRE. */
  function _scriptLoad() {
    if (_scriptPromise) return _scriptPromise;
    logDebug("First call — initiating SRE load from CDN");
    _scriptPromise = (async () => {
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
      return window.SRE;
    })();
    // A failed script fetch must be retried by the next call.
    _scriptPromise.catch(() => {
      _scriptPromise = null;
    });
    return _scriptPromise;
  }

  function isLoaded() {
    return _isLoaded;
  }

  return {
    loadSRE: loadSRE,
    isLoaded: isLoaded,
    getDomain: getDomain,
    setDomain: setDomain,
    DOMAIN: MATHS_SPEECH_DOMAIN,
  };
})();

window.TTSSreLoader = TTSSreLoader;
