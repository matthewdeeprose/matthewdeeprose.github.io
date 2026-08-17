/**
 * @file alt-text-progress.js
 * @module MathPixAltTextProgress
 * @description
 * Phase 2 Stage 2, Parcel 1.1 — headless-first progress / status / aria-live /
 * error factory for the MathPix AI-description orchestrator.
 *
 * This is a straight lift of Image Describer's cloud-path progress wiring
 * (`image-describer-controller-generate.js` — PROGRESS_STAGES, showProgress,
 * calculateProgressPercentage, updateProgressBar, the elapsed timer, hideProgress)
 * plus the status / error / announce channel from `image-describer-controller.js`
 * (showStatus, showError, announceStatus) — retargeted onto an INJECTED element
 * set and INJECTED dependencies so it runs with no live DOM and no global reach.
 *
 * ── The honesty pin (do not "improve" this away) ───────────────────────────
 * In the live Image Describer code `announceStatus()` is a NO-OP that only logs;
 * ALL real screen-reader output rides on `showStatus(text, type)` writing to the
 * single `aria-live="polite"` element `#imgdesc-status`. Announce and status are
 * therefore the SAME channel, not two. Consequences honoured here:
 *
 *   • The factory models ONE status/live channel (the `showStatus` write path).
 *   • The announce method writes ONLY to a DOM-silent announce-trace log — a
 *     recorded list, never a live region. It is never a second live channel.
 *   • The aria-live stream of a full SUCCESSFUL cloud run is a SINGLE entry: the
 *     success line. Every per-stage line is visual-only (written to the stage
 *     element, which is NOT a live region).
 *   • The error path writes the live channel ONCE. The live main-catch
 *     double-write (`showError(...)` then `showStatus("Generation failed",…)`) is
 *     an incidental quirk and is deliberately NOT reproduced.
 *
 * ── Injection ──────────────────────────────────────────────────────────────
 * The module attaches to `window` at definition time, but an INSTANCE reaches no
 * global at runtime: `create({ elements, deps })` takes an element set (refs, not
 * selectors) and dependencies (getIcon, notifyError, a clock, hideCacheRecallBanner,
 * showAnalysisSlots). The two elements the live code fetched by CLASS querySelector
 * (`.imgdesc-progress-bar`, `.imgdesc-progress-fill`) become injected refs — this
 * is the load-bearing injectify change, so two instances (or one headless sink)
 * cannot collide on a document-global class query.
 *
 * Only the CLOUD stage set is embedded here (the eight entries). The three local
 * sibling maps (FastVLM / Qwen3.5 / LFM2-VL) are deferred to the local phase.
 *
 * @see image-describer/image-describer-controller-generate.js (source of the copied shapes)
 * @see image-describer/image-describer-controller.js (showStatus/showError/announceStatus, cacheElements)
 */

const MathPixAltTextProgress = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

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
      console.error(`[AltTextProgress] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextProgress] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextProgress] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextProgress] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // CLOUD PROGRESS STAGES — copied verbatim from PROGRESS_STAGES in
  // image-describer-controller-generate.js. British spelling as written.
  //
  // INSERTION ORDER IS LOAD-BEARING: calculateProgressPercentage() sums `weight`
  // across Object.keys() up to AND INCLUDING the current stage (capped at 100),
  // so it sums even stages that a given run skipped. That is why the minimal run
  // still reports PREPARING at 25 (COMPRESSING+ANALYSING weights are included)
  // and FINALISING at 100 (VERIFYING's weight is included; 105 → capped).
  //
  // REASONING is a weight:0 sub-state of GENERATING — it shares GENERATING's
  // percentage (85) and never shifts the downstream stages.
  // ---------------------------------------------------------------------------

  const CLOUD_PROGRESS_STAGES = {
    VALIDATING: {
      message: "Validating image...",
      icon: "search",
      weight: 5,
    },
    COMPRESSING: {
      message: "Optimising image...",
      icon: "image",
      weight: 8,
    },
    ANALYSING: {
      message: "Analysing image...",
      icon: "eye",
      weight: 8,
    },
    PREPARING: {
      message: "Preparing request...",
      icon: "upload",
      weight: 4,
    },
    GENERATING: {
      message: "Generating description...",
      icon: "aiSparkle",
      weight: 60,
    },
    // Sub-state of GENERATING shown while a reasoning model thinks before it
    // writes (it can emit no visible text for minutes). weight: 0 so it shares
    // GENERATING's progress percentage and never shifts the downstream stages.
    REASONING: {
      message:
        "Model is reasoning before it writes — this can take a few minutes for advanced models...",
      icon: "hourglass",
      weight: 0,
    },
    VERIFYING: {
      message: "Verifying visual accuracy...",
      icon: "check",
      weight: 15,
    },
    FINALISING: {
      message: "Finalising...",
      icon: "checkCircle",
      weight: 5,
    },
  };

  // Stages that show the pulsing generation animation (post-14F parity). Only
  // the cloud generation states apply here; the local generation states are
  // deferred with their sibling maps.
  const GENERATING_STAGES = { GENERATING: true, REASONING: true };

  // ---------------------------------------------------------------------------
  // PURE: cumulative progress percentage for a stage (weight-sum in insertion
  // order, capped at 100). Exposed at module level so tests can assert it with
  // no instance. Mirrors calculateProgressPercentage() for the cloud map.
  // ---------------------------------------------------------------------------

  function calculateProgressPercentage(stage) {
    const stages = Object.keys(CLOUD_PROGRESS_STAGES);
    const currentIndex = stages.indexOf(stage);
    if (currentIndex === -1) return 0;

    let progress = 0;
    for (let i = 0; i <= currentIndex; i++) {
      progress += CLOUD_PROGRESS_STAGES[stages[i]].weight;
    }
    return Math.min(progress, 100);
  }

  // ---------------------------------------------------------------------------
  // Small internal helpers
  // ---------------------------------------------------------------------------

  /** Format elapsed seconds for display. Copied from formatElapsedTime(). */
  function formatElapsedTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  /**
   * Build the icon+text stage-label HTML. Decorative icon keeps the
   * aria-hidden + visible-text treatment from the copied markup (never a
   * `title` attribute). Uses the injected getIcon; falls back to an
   * aria-hidden span wrapping the icon name when getIcon is unavailable.
   */
  function buildStageLabel(getIcon, config) {
    const iconHtml =
      typeof getIcon === "function"
        ? getIcon(config.icon)
        : `<span aria-hidden="true">${config.icon}</span>`;
    return `${iconHtml} ${config.message}`;
  }

  // ---------------------------------------------------------------------------
  // FACTORY
  // ---------------------------------------------------------------------------

  /**
   * Create a progress/status/announce/error controller bound to an injected
   * element set and injected dependencies. Reaches NO global.
   *
   * @param {Object} options
   * @param {Object} options.elements — element refs (not selectors):
   *   status, output, progress, progressBar, progressFill, progressStage,
   *   progressTime, completionTime, finalTime, and optionally progressSlots,
   *   profileSuggestion. `status` is the single aria-live channel; `output` is
   *   the second polite region (injected as its own ref, never folded into the
   *   status channel — unused by the cloud path in 1.1).
   * @param {Object} options.deps — injected dependencies:
   *   getIcon(name) → html, notifyError(msg), clock { now, setInterval,
   *   clearInterval }, hideCacheRecallBanner(), showAnalysisSlots(slotsEl).
   * @returns {Object} controller instance
   */
  function create(options) {
    const opts = options || {};
    const elements = opts.elements || {};
    const deps = opts.deps || {};

    const clock = deps.clock || {};
    const now = typeof clock.now === "function" ? clock.now : null;
    const setIntervalFn =
      typeof clock.setInterval === "function" ? clock.setInterval : null;
    const clearIntervalFn =
      typeof clock.clearInterval === "function" ? clock.clearInterval : null;

    if (!now || !setIntervalFn || !clearIntervalFn) {
      logWarn(
        "Injected clock is incomplete — elapsed timer will not tick (need now/setInterval/clearInterval)",
      );
    }

    // Per-instance mutable state (mirrors the fields the live controller kept
    // on `this`). All timing goes through the injected clock.
    const state = {
      currentStage: null,
      progressStartTime: null,
      progressTimer: null,
      lastElapsedTime: null,
      // DOM-silent announce-trace log. This is the honesty pin: intended
      // announcements are recorded here and NEVER written to a live region.
      announceTrace: [],
    };

    // -- ref helper: warn once at write time when a required ref is missing ---
    function ref(name) {
      const el = elements[name];
      if (!el) {
        logWarn(`Missing injected ref: '${name}' — write skipped`);
        return null;
      }
      return el;
    }

    // ========================================================================
    // VISUAL PROGRESS BAR
    // ========================================================================

    /** Set the fill width and the progressbar aria-valuenow. */
    function updateProgressBar(percentage) {
      const fill = elements.progressFill;
      if (fill) {
        fill.style.width = `${percentage}%`;
      }
      const bar = elements.progressBar;
      if (bar) {
        bar.setAttribute("aria-valuenow", percentage);
      }
    }

    // ========================================================================
    // ELAPSED TIMER (injected clock)
    // ========================================================================

    function getElapsedSeconds() {
      if (!state.progressStartTime || !now) return 0;
      return Math.floor((now() - state.progressStartTime) / 1000);
    }

    function updateProgressTime() {
      if (!state.progressStartTime || !now) return;
      const timeEl = elements.progressTime;
      if (!timeEl) return;
      const elapsed = Math.floor((now() - state.progressStartTime) / 1000);
      timeEl.textContent = `${elapsed}s`;
    }

    function hideCompletionTime() {
      if (elements.completionTime) {
        elements.completionTime.hidden = true;
      }
    }

    /** Write the completion wrapper + final-time refs on success. */
    function showCompletionTime(seconds) {
      state.lastElapsedTime = seconds;
      if (elements.finalTime) {
        elements.finalTime.textContent = formatElapsedTime(seconds);
      }
      if (elements.completionTime) {
        elements.completionTime.hidden = false;
      }
      logDebug("Completion time displayed:", formatElapsedTime(seconds));
    }

    // ========================================================================
    // STAGE ADVANCE
    // ========================================================================

    /**
     * Advance to a cloud stage: write the icon+text label to the stage ref,
     * set aria-valuenow + fill width from calculateProgressPercentage, toggle
     * the generating animation, and start the elapsed timer on first call.
     * Only cloud stages are known here (local maps are deferred).
     *
     * @param {string} stage — key from CLOUD_PROGRESS_STAGES
     */
    function showProgress(stage) {
      const config = CLOUD_PROGRESS_STAGES[stage];
      if (!config) {
        logWarn("Unknown progress stage:", stage);
        return;
      }

      state.currentStage = stage;

      // Clear any completion time from a previous run.
      hideCompletionTime();

      // Reveal the progress container.
      if (elements.progress) {
        elements.progress.hidden = false;
      }

      // Stage label (icon + message) — visual only; NOT the live channel.
      const stageEl = ref("progressStage");
      if (stageEl) {
        stageEl.innerHTML = buildStageLabel(deps.getIcon, config);
      }

      // Analysis slot breakdown (Phase 9E parity) — only when ANALYSING, and
      // only if the optional slots ref + callback are injected. Kept
      // document-free: no getElementById fallback.
      if (elements.progressSlots) {
        if (stage === "ANALYSING" && typeof deps.showAnalysisSlots === "function") {
          deps.showAnalysisSlots(elements.progressSlots);
        } else {
          elements.progressSlots.hidden = true;
        }
      }

      // Pulsing animation during generation stages (post-14F).
      if (elements.progressFill) {
        elements.progressFill.classList.toggle(
          "generating",
          !!GENERATING_STAGES[stage],
        );
      }

      // Progress bar percentage.
      const percentage = calculateProgressPercentage(stage);
      updateProgressBar(percentage);

      // Start the elapsed timer once, on first progress.
      if (!state.progressTimer && now && setIntervalFn) {
        state.progressStartTime = now();
        state.progressTimer = setIntervalFn(updateProgressTime, 1000);
      }

      logDebug("Progress updated:", stage, percentage + "%");
    }

    // ========================================================================
    // STATUS / LIVE CHANNEL (the ONE aria-live channel — showStatus path)
    // ========================================================================

    /**
     * Write the single status/live channel. This is the ONLY method that
     * writes an aria-live element. Per-stage lines never come through here.
     * @param {string} message
     * @param {string} [type="info"] — 'info' | 'success' | 'error' | ...
     */
    function showStatus(message, type) {
      const t = type || "info";
      const statusEl = ref("status");
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = `imgdesc-status imgdesc-status-${t}`;
      statusEl.hidden = false;
      logDebug("Status updated:", message, t);
    }

    function hideStatus() {
      if (elements.status) {
        elements.status.hidden = true;
      }
    }

    /**
     * Record an intended screen-reader announcement to the DOM-SILENT trace
     * log ONLY. Never writes a live region — this mirrors the live
     * announceStatus() no-op-that-logs. Tests read getAnnounceTrace().
     * @param {string} message
     */
    function announce(message) {
      state.announceTrace.push(message);
      logDebug("Announce (trace only, not a live region):", message);
    }

    // ========================================================================
    // ERROR PATH (single live write — NO double-write)
    // ========================================================================

    /**
     * Clean error termination: hide progress, write the live channel ONCE
     * (status = error), and fire the injected notifyError toast. Deliberately
     * does not reproduce the live main-catch double-write.
     * @param {string} message
     */
    function showError(message) {
      // Error terminates progress without showing a completion time.
      hideProgress(false);

      // ONE live write.
      showStatus(message, "error");

      // Toast is a separate surface, not the live channel.
      if (typeof deps.notifyError === "function") {
        deps.notifyError(message);
      } else {
        logWarn("notifyError dependency not injected — toast suppressed");
      }
    }

    // ========================================================================
    // HIDE / TEARDOWN
    // ========================================================================

    /**
     * Hide the progress indicator and clean up. On success, write the
     * completion wrapper + final-time refs and hide the cache-recall banner.
     * Stops the elapsed timer via the injected clock and resets the bar to 0.
     * @param {boolean} [showFinalTime=false]
     */
    function hideProgress(showFinalTime) {
      const success = showFinalTime === true;

      // Capture final elapsed time before clearing.
      const finalSeconds = getElapsedSeconds();

      if (elements.progress) {
        elements.progress.hidden = true;
      }

      // Stop the timer.
      if (state.progressTimer && clearIntervalFn) {
        clearIntervalFn(state.progressTimer);
      }
      state.progressTimer = null;

      // On success, surface the completion time and dismiss the cache banner.
      if (success && finalSeconds > 0) {
        showCompletionTime(finalSeconds);
      }
      if (success && typeof deps.hideCacheRecallBanner === "function") {
        deps.hideCacheRecallBanner();
      }

      // Hide the analysis slot breakdown if it was injected.
      if (elements.progressSlots) {
        elements.progressSlots.hidden = true;
        elements.progressSlots.innerHTML = "";
      }

      // Reset state and the bar.
      state.progressStartTime = null;
      state.currentStage = null;
      updateProgressBar(0);

      logDebug("Progress hidden, showFinalTime:", success);
    }

    // ========================================================================
    // PUBLIC INSTANCE API
    // ========================================================================

    return {
      // Stage / progress
      showProgress,
      calculateProgressPercentage,
      updateProgressBar,
      updateProgressTime,
      getElapsedSeconds,
      formatElapsedTime,
      showCompletionTime,
      hideCompletionTime,
      hideProgress,

      // Status / live channel + announce trace
      showStatus,
      hideStatus,
      announce,

      // Error
      showError,

      // Introspection (DOM-silent announce trace + current stage)
      getAnnounceTrace() {
        return state.announceTrace.slice();
      },
      clearAnnounceTrace() {
        state.announceTrace.length = 0;
      },
      getCurrentStage() {
        return state.currentStage;
      },
    };
  }

  logInfo("MathPixAltTextProgress factory ready (cloud stage set embedded)");

  return {
    create,
    calculateProgressPercentage,
    // Frozen reference copy of the embedded cloud stage set for tests.
    CLOUD_PROGRESS_STAGES: Object.freeze(CLOUD_PROGRESS_STAGES),
  };
})();

window.MathPixAltTextProgress = MathPixAltTextProgress;
