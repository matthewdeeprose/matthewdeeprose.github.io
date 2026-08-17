/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — GENERATION PIPELINE SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Prompt construction, visual verification, progress management,
 * generation flow, and embed instance management for the
 * Image Describer controller.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.4.0
 * DATE: 29 March 2026
 * PHASE: Phase 14E/14H/14I — Qwen3.5 generation, analysis reference, educational context
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

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
      console.error(`[ControllerGenerate] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ControllerGenerate] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ControllerGenerate] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ControllerGenerate] ${message}`, ...args);
  }

  // ============================================================================
  // STREAMING FOLLOW-MODE FLAG (parity with Local Chat)
  // ============================================================================
  // true  = scrollable output box + thinking indicator + camera follows tokens
  // false = current behaviour: static box, tokens accumulate in flow
  // Persisted to localStorage ("imgdesc-stream-follow") and toggleable via
  // the checkbox in #imgdesc-generate-area — read fresh on each send.
  const STREAM_FOLLOW_STORAGE_KEY = "imgdesc-stream-follow";

  function isStreamFollowEnabled() {
    try {
      const v = localStorage.getItem(STREAM_FOLLOW_STORAGE_KEY);
      if (v === "false") return false;
      if (v === "true") return true;
    } catch (e) {}
    return true; // default on
  }

  // ============================================================================
  // ESCAPE-GUARD INSTRUCTION (Layer 1 — unsafe-failure hardening)
  // ============================================================================
  // The Foundry v1 surface silently strips images for non-vision models (HTTP
  // 200, confabulated alt text — lesson 27). This instruction tells the model to
  // refuse rather than invent when no image is present. Appended to the CLOUD
  // user prompts only (buildUserPrompt + buildVerificationUserPrompt) — the
  // tested position. Local builders (buildLocalPrompt/buildQwenPrompt/
  // buildLfm2VlPrompt) never receive it.
  //
  // Wording "A" — selected empirically over wordings B and C (12-cell matrix +
  // 3-rep stability rerun): 9/9 as-expected, caught the strip 3/3, zero false
  // refusals on two vision models including the known escaper Phi-4-multimodal.
  // SHIP VERBATIM — any rewording invalidates that result.
  const ESCAPE_GUARD_INSTRUCTION =
    "If no image is attached to this message, say so explicitly and do not invent a description.";

  // ============================================================================
  // IMAGE-STRIP TELEMETRY (Layer 2 — log-only observability, never user-facing)
  // ============================================================================
  // The Foundry v1 surface can silently strip an image (HTTP 200, text-scale
  // prompt_tokens). The deterministic vision re-check (isModelVisionCapable) is
  // the guard; this is observability ONLY — it emits logWarn + an
  // `imageStripSuspected` event when a response's prompt_tokens lands implausibly
  // close to the request's runtime text-token estimate (i.e. the image likely
  // contributed nothing). It NEVER blocks generation and NEVER surfaces to the
  // user.
  //
  // The floor is the delta below which a strip is suspected, in the SAME units
  // the runtime check uses (prompt_tokens − charEstimate). Calibration-derived
  // (Layer-2 step 4, 13-model gated azure-openai vision set, 9 June 2026): all
  // no-image/strip deltas clustered at ~−720; the smallest genuine with-image
  // delta was −20 (o4-mini) — cleanly separable with a ~700-token gap. The
  // value is NEGATIVE because the chars/4 estimate systematically overshoots
  // Foundry's tokenizer; −370 is the midpoint of the strip band (−720) and the
  // smallest real-image delta (−20), giving ~350 tokens of headroom each side.
  // Log-only, so a slightly off value is harmless (at worst a noisy/missed log).
  const IMAGE_STRIP_MIN_BUMP_TOKENS = -370; // calibration-derived (see above)

  // Rough chars-per-token divisor for the runtime text estimate (English ≈ 4).
  const CHARS_PER_TOKEN = 4;

  // The stages during which the model is actually producing text, so the progress
  // bar pulses and the screen-reader keep-alive below runs. Hoisted to one frozen
  // list because showProgress() and updateProgressTime() must agree on it: if they
  // drift, the bar pulses while the announcement is silent, or the reverse.
  const GENERATING_STAGES = Object.freeze([
    "GENERATING",
    "REASONING",
    "GENERATING_LOCAL",
    "GENERATING_QWEN",
    "GENERATING_LFM2VL",
  ]);

  // How often to tell a screen-reader user that a generation is still running.
  //
  // #imgdesc-output is deliberately NOT a live region (see tools.html): it is
  // rewritten on every streamed chunk, so announcing it re-read the ENTIRE
  // accumulated description each time — measured on a real run as ~25 re-reads of
  // a growing document, ending around 400 words per chunk. That is unusable, and
  // it buried the completion message.
  //
  // Silence alone is not right either: a reasoning model can think for minutes,
  // and with the output region quiet there is nothing to distinguish "still
  // working" from "dead". So a short keep-alive — long enough not to become
  // chatter in its own right, short enough to reassure.
  //
  // 10s, Matthew's call after hearing the first pass. Note the practical effect
  // on testing: at 20s a typical 8-11s cloud generation finished before the
  // first ping was ever due, so the keep-alive went unheard through two listens.
  const GENERATING_ANNOUNCE_INTERVAL_S = 10;

  // ============================================================================
  // PROGRESS STAGES (moved from core — only used by generate methods)
  // ============================================================================

  const PROGRESS_STAGES = {
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

  // Progress stages for local (FastVLM) generation (Phase 13C-1)
  const LOCAL_PROGRESS_STAGES = {
    LOADING_MODEL: {
      message: "Loading FastVLM model...",
      icon: "download",
      weight: 40,
    },
    GENERATING_LOCAL: {
      message: "Generating description locally...",
      icon: "aiSparkle",
      weight: 55,
    },
    FINALISING_LOCAL: {
      message: "Finalising...",
      icon: "checkCircle",
      weight: 5,
    },
  };

  // Progress stages for Qwen3.5 generation (Phase 14E)
  const QWEN_PROGRESS_STAGES = {
    LOADING_QWEN: {
      message: "Loading Qwen3.5 model\u2026",
      icon: "hourglass",
      weight: 30,
    },
    GENERATING_QWEN: {
      message: "Generating structured description\u2026",
      icon: "aiSparkle",
      weight: 65,
    },
    FINALISING_QWEN: {
      message: "Finalising\u2026",
      icon: "check",
      weight: 5,
    },
  };

  // Progress stages for LFM2-VL generation (Phase 15A)
  const LFM2VL_PROGRESS_STAGES = {
    LOADING_LFM2VL: {
      message: "Loading LFM2-VL model\u2026",
      icon: "download",
      weight: 40,
    },
    GENERATING_LFM2VL: {
      message: "Generating description locally\u2026",
      icon: "aiSparkle",
      weight: 55,
    },
    FINALISING_LFM2VL: {
      message: "Finalising\u2026",
      icon: "check",
      weight: 5,
    },
  };

  // ============================================================================
  // FAILURE WORDING (F2-14)
  // ============================================================================

  // Plain-language wording for the statuses worth naming. Anything absent falls
  // through to today's exact wording, so an unmapped status still says what it
  // has always said.
  const ERROR_TEXT_BY_STATUS = Object.freeze({
    401: "Your sign-in has expired. Sign in again, then try again.",
    // Deliberately does NOT suggest signing in again. A 403 is a permissions
    // decision, not an expired credential — signing in again cannot change it,
    // and sending someone round that loop is worse than saying nothing.
    403: "Your account is not permitted to use this service.",
    503: "The service could not check your sign-in just now. Please try again shortly.",
  });

  /**
   * Choose the sentence for one generation failure.
   *
   * The provider attaches the HTTP status to the Error it throws and nothing
   * between there and the outer catch reshapes the object, so the status is
   * readable here — it was simply never read.
   *
   * @param {Error|{message: string}} error
   * @returns {string} the sentence for the visible status, the toast and the
   *   announcement alike — all three are fed from this one value.
   */
  function composeGenerationErrorText(error) {
    const status = error ? error.status : undefined;
    // typeof FIRST: the map is keyed by number but property access stringifies,
    // so a string "401" would match without this test.
    if (typeof status === "number" && ERROR_TEXT_BY_STATUS[status]) {
      return ERROR_TEXT_BY_STATUS[status];
    }
    return "Generation failed: " + (error && error.message ? error.message : error);
  }

  // ============================================================================
  // METHODS (mixed into ImageDescriberController)
  // ============================================================================

  const methods = {
    // ========================================================================
    // STREAMING OUTPUT HELPERS (follow-mode, parity with Local Chat)
    // ========================================================================

    /**
     * Prepare the output element for streaming. In follow-mode, adds the
     * scrollable modifier class and a pulsing 3-dot thinking indicator that
     * is removed when the first token arrives. Outside follow-mode, just
     * clears the element — existing behaviour.
     * @param {object} [opts]
     * @param {boolean} [opts.preWrap=true] — set white-space: pre-wrap on the
     *   output element. Local paths write plain text progressively so they
     *   need this. The OpenRouter embed path renders HTML, so pass false.
     */
    _prepareStreamingOutput(opts) {
      if (!this.elements.output) return;
      const preWrap = !opts || opts.preWrap !== false;
      this.elements.output.innerHTML = "";
      if (preWrap) {
        this.elements.output.style.whiteSpace = "pre-wrap";
      }
      if (!isStreamFollowEnabled()) return;
      this.elements.output.classList.add("imgdesc-output--follow");
      // WCAG 2.1.1: a scrollable region must be keyboard-focusable so
      // keyboard-only users can scroll it with arrow keys. The element
      // has tabindex="-1" by default (focus target for a11y announcements);
      // promote it to "0" while follow-mode is active, restore on reset.
      this.elements.output.setAttribute("tabindex", "0");
      // Bring the output box into view so the user sees the thinking
      // indicator and the stream as it starts. Respects reduced motion
      // (streaming is already gated off in that case, but belt-and-braces).
      try {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        this.elements.output.scrollIntoView({
          block: "start",
          behavior: reduce ? "auto" : "smooth",
        });
      } catch (e) {}
      // Camera-follow: observe subtree mutations and snap scrollTop to the
      // bottom whenever content changes. This handles all injection paths —
      // the three local models (which call _onStreamToken) AND the cloud
      // embed path (which writes innerHTML directly in its own throttle).
      this._teardownFollowObserver();
      const outputEl = this.elements.output;
      this._followObserver = new MutationObserver(function () {
        outputEl.scrollTop = outputEl.scrollHeight;
      });
      this._followObserver.observe(outputEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      const indicator = document.createElement("div");
      indicator.className = "imgdesc-typing";
      indicator.setAttribute("role", "status");
      indicator.setAttribute("aria-label", "Generating description");
      indicator.innerHTML =
        '<span class="imgdesc-typing-dot"></span>' +
        '<span class="imgdesc-typing-dot"></span>' +
        '<span class="imgdesc-typing-dot"></span>';
      this.elements.output.appendChild(indicator);
    },

    /**
     * Apply a streaming token update to the output element and keep the
     * camera tracking the latest content. Safe to call regardless of
     * STREAM_FOLLOW_MODE — the scrollTop assignment is a no-op when the
     * element is not a scroll container. The MutationObserver installed
     * by _prepareStreamingOutput also catches this update, but the direct
     * assignment keeps things snappy for the common streaming case.
     * @param {string} accumulatedText — full text so far (not a delta)
     */
    _onStreamToken(accumulatedText) {
      if (!this.elements.output) return;
      this.elements.output.textContent = accumulatedText;
      this.elements.output.scrollTop = this.elements.output.scrollHeight;
    },

    /**
     * Disconnect the follow-mode MutationObserver if one is active.
     * Called on new image / reset and before each new stream starts.
     */
    _teardownFollowObserver() {
      if (this._followObserver) {
        try {
          this._followObserver.disconnect();
        } catch (e) {}
        this._followObserver = null;
      }
    },

    /**
     * Whether the given model id is a reasoning model, per the registry
     * capability list. Reasoning models (e.g. gpt-5-pro) can think for minutes
     * before emitting any visible text, so we set expectations during that
     * wait rather than letting the empty output look frozen.
     * @param {string} modelId
     * @returns {boolean}
     */
    _isReasoningModel(modelId) {
      try {
        const reg = window.modelRegistry;
        if (!reg || typeof reg.getModel !== "function") return false;
        const def = reg.getModel(modelId, true);
        return !!(
          def &&
          Array.isArray(def.capabilities) &&
          def.capabilities.includes("reasoning")
        );
      } catch (e) {
        return false;
      }
    },

    /**
     * Enter the "reasoning" progress state: swap the progress message to the
     * reasoning-aware one (the elapsed timer keeps ticking) and announce ONCE
     * to screen readers. Idempotent — safe to call both from the upfront
     * reasoning-model check and from each streaming heartbeat (the message swap
     * is guarded so heartbeats don't re-fire showProgress, and the announcement
     * is guarded so the screen reader is not spammed).
     */
    _enterReasoningState() {
      this._reasoningPhaseActive = true;
      if (this.currentStage !== "REASONING") {
        this.showProgress("REASONING");
      }
      if (!this._reasoningAnnounced) {
        this._reasoningAnnounced = true;
        this.announceStatus(
          "The model is reasoning before it writes. This can take a few minutes.",
        );
      }
    },

    /**
     * Leave the reasoning state once real description text starts arriving:
     * switch back to the "Generating description..." message. The elapsed timer
     * continues uninterrupted. No-op if a reasoning phase was never entered.
     */
    _exitReasoningState() {
      if (!this._reasoningPhaseActive) return;
      this._reasoningPhaseActive = false;
      if (this.currentStage === "REASONING") {
        this.showProgress("GENERATING");
      }
    },

    /**
     * Lazily mount the reusable reasoning disclosure into its markup mount point
     * (#imgdesc-reasoning-disclosure) and cache the instance. Returns the
     * instance, or null if the component or the mount point is unavailable, so
     * every caller degrades gracefully (the feature simply does not appear).
     */
    _ensureReasoningDisclosure() {
      if (this._reasoningDisclosure) return this._reasoningDisclosure;
      const Cls = window.EmbedReasoningDisclosureClass;
      const mountPoint = document.getElementById("imgdesc-reasoning-disclosure");
      if (typeof Cls !== "function" || !mountPoint) {
        logWarn(
          "Reasoning disclosure unavailable (component class or mount point missing)",
        );
        return null;
      }
      try {
        this._reasoningDisclosure = new Cls();
        this._reasoningDisclosure.mount(mountPoint);
      } catch (e) {
        logWarn("Failed to mount reasoning disclosure", e);
        this._reasoningDisclosure = null;
      }
      return this._reasoningDisclosure;
    },

    /**
     * Reset the reasoning disclosure at the start of a describe run, so a prior
     * run's summary never lingers (including a cloud-to-local switch). Mounts on
     * first use. Safe no-op when the component is unavailable.
     */
    _resetReasoningDisclosure() {
      const d = this._ensureReasoningDisclosure();
      if (d) d.reset();
    },

    // ========================================================================
    // PROMPT BUILDING
    // ========================================================================

    // Escape-guard instruction (Layer 1) exposed on the controller so console
    // tooling (breadth-sweep harness) can read the shipped wording and build
    // baseline/A conditions byte-identically. Read-only; do not mutate.
    ESCAPE_GUARD_INSTRUCTION: ESCAPE_GUARD_INSTRUCTION,

    /**
     * Check if prompts are loaded and ready
     * @returns {boolean}
     */
    arePromptsReady() {
      return !!(
        window.PROMPT_MARKDOWN &&
        window.PROMPT_WRITING_GUIDE &&
        window.PROMPT_IMAGE_DESCRIPTION
      );
    },

    /**
     * Wait for prompts to be loaded
     * @returns {Promise<boolean>}
     */
    async waitForPrompts() {
      // If already loaded, return immediately
      if (this.arePromptsReady()) {
        return true;
      }

      // Wait for the prompt loader
      if (window.ImageDescriberPrompts?.ready) {
        try {
          await window.ImageDescriberPrompts.ready;
          return this.arePromptsReady();
        } catch (error) {
          logError("Prompt loading failed:", error);
          return false;
        }
      }

      logWarn("Prompt loader not available");
      return false;
    },

    /**
     * Build the system prompt from modular prompt files
     * @returns {string} Combined system prompt
     */
    buildSystemPrompt() {
      const parts = [];

      // Add markdown formatting instructions
      if (window.PROMPT_MARKDOWN) {
        parts.push(window.PROMPT_MARKDOWN.trim());
      } else {
        logWarn("PROMPT_MARKDOWN not loaded");
      }

      // Add writing guide
      if (window.PROMPT_WRITING_GUIDE) {
        parts.push(window.PROMPT_WRITING_GUIDE.trim());
      } else {
        logWarn("PROMPT_WRITING_GUIDE not loaded");
      }

      // Add image description prompt
      if (window.PROMPT_IMAGE_DESCRIPTION) {
        parts.push(window.PROMPT_IMAGE_DESCRIPTION.trim());
      } else {
        logWarn("PROMPT_IMAGE_DESCRIPTION not loaded");
      }

      const systemPrompt = parts.join("\n\n---\n\n");

      logDebug("System prompt built", {
        parts: parts.length,
        length: systemPrompt.length,
      });

      return systemPrompt;
    },

    /**
     * Build the user prompt from form data
     * @returns {string} User prompt with context
     */
    buildUserPrompt() {
      const parts = [];

      // Basic context
      parts.push(
        "Please describe the attached image for accessibility purposes.",
      );
      parts.push("");

      // Subject area
      const subject = this.elements.subject?.value?.trim();
      if (subject) {
        parts.push(`**Subject Area:** ${subject}`);
      }

      // Specific topic
      const topic = this.elements.topic?.value?.trim();
      if (topic) {
        parts.push(`**Topic:** ${topic}`);
      }

      // Learning objective
      const objective = this.elements.objective?.value?.trim();
      if (objective) {
        parts.push(`**Learning Objective:** ${objective}`);
      }

      // Additional context
      const context = this.elements.context?.value?.trim();
      if (context) {
        parts.push(`**Additional Context:** ${context}`);
      }

      // Module code
      const module = this.elements.module?.value?.trim();
      if (module) {
        parts.push(`**Module:** ${module}`);
      }

      // Audience level (with prompt modifier from config)
      const audienceValue = this.elements.audience?.value;
      if (audienceValue && this.config?.audienceLevels) {
        const audienceConfig = this.config.audienceLevels.find(
          (a) => a.value === audienceValue,
        );
        if (audienceConfig?.promptModifier) {
          parts.push("");
          parts.push(audienceConfig.promptModifier);
        }
      }

      // Description style — always Detailed (Phase 2D simplification)
      if (this.config?.descriptionStyle?.promptModifier) {
        parts.push("");
        parts.push(this.config.descriptionStyle.promptModifier);
      }

      // Checkbox options (with prompt modifiers from config)
      if (this.config?.checkboxOptions) {
        const activeModifiers = [];

        this.config.checkboxOptions.forEach((opt) => {
          const checkbox = document.getElementById(`imgdesc-${opt.id}`);
          if (checkbox?.checked && opt.promptModifier) {
            activeModifiers.push(opt.promptModifier);
          }
        });

        if (activeModifiers.length > 0) {
          parts.push("");
          parts.push("**Additional Instructions:**");
          activeModifiers.forEach((mod) => {
            parts.push(`- ${mod}`);
          });
        }
      }

      // Pre-analysis context (if available)
      if (this.lastAnalysis) {
        // Use corrected analysis if user has made OCR edits (Phase 5D-2)
        let analysisToFormat = this.lastAnalysis;
        if (
          typeof window.ImageDescriberOverlay !== "undefined" &&
          window.ImageDescriberOverlay.hasCorrections()
        ) {
          analysisToFormat =
            window.ImageDescriberOverlay.getCorrectedAnalysis();
          logDebug("Using corrected analysis with user OCR edits");
        }
        const analysisText =
          window.ImageDescriberAnalyser.formatForPrompt(analysisToFormat);
        if (analysisText) {
          parts.push("");
          parts.push(analysisText);
        }
      }

      // Escape-guard (Layer 1) — appended as a final, clearly-delimited line.
      // Tested at this position (user prompt, not system prompt). See
      // ESCAPE_GUARD_INSTRUCTION definition.
      parts.push("");
      parts.push(ESCAPE_GUARD_INSTRUCTION);

      const userPrompt = parts.join("\n");

      logDebug("User prompt built", { length: userPrompt.length });

      return userPrompt;
    },

    // ========================================================================
    // LOCAL PROMPT BUILDING (Phase 13D)
    // ========================================================================

    /**
     * Build the prompt for local (FastVLM) generation.
     *
     * Empirical testing (Phase 13F) showed that FastVLM 0.5B cannot use
     * contextual instructions — it parrots metadata and hallucinates
     * domain knowledge when given form inputs or analysis data. The bare
     * instruction produces the cleanest, fastest output.
     *
     * Profile hints tested across 7 images × 2 conditions (Phase 2D-test).
     * Hints harmful for FastVLM in 4/7 cases — average score dropped from
     * 2.4 to 1.6/5. Model fabricates content matching the hint label rather
     * than describing what it sees (e.g. PV diagram → lever mechanism,
     * GA diagram → BBM formation). Bare instruction confirmed as optimal.
     * See profile-hint-test.js results.
     *
     * Form inputs and analysis data remain exclusive to the cloud path
     * via buildUserPrompt() and formatForPrompt().
     *
     * @returns {string} prompt text for FastVLM
     */
    buildLocalPrompt() {
      return "Describe this image in detail for accessibility purposes.";
    },

    /**
     * Builds the structured 4-part prompt for Qwen3.5.
     * Bare instruction only — educational context degrades accuracy
     * (decision gate result from Phase 14A testing).
     *
     * Profile hints neutral-to-slightly-negative for Qwen (average
     * 3.6→3.4/5 across 7 test images). Removed to avoid risk when CLIP
     * misclassifies the image type. Text Content instruction strengthened
     * to reduce false "No text content" responses for images with axis
     * labels, annotations, and numbers.
     *
     * @returns {string}
     */
    buildQwenPrompt() {
      return (
        "Describe this image for accessibility using these sections:\n\n" +
        "## 1. Title\n" +
        "A brief descriptive title under 10 words.\n\n" +
        "## 2. Alt Text\n" +
        "One or two sentences: what the image shows, then its educational significance.\n\n" +
        "## 3. Long Description\n" +
        "Detailed description of the visual content and its educational purpose.\n\n" +
        "## 4. Text Content\n" +
        'List every word, number, and label visible in the image. If none, write "No text content."'
      );
    },

    /**
     * Build a simple free-form prompt for LFM2-VL (Phase 15A).
     * Same approach as FastVLM — bare instruction, no structured sections.
     * @returns {string}
     */
    buildLfm2VlPrompt() {
      return "Describe this image in detail for accessibility purposes.";
    },

    // ========================================================================
    // ANALYSIS REFERENCE DATA (Phase 14H)
    // ========================================================================

    /**
     * Builds markdown-formatted reference data from this.lastAnalysis.
     * Appended below local model output so users can verify and correct
     * the AI description. The model never sees this data.
     *
     * Includes: OCR detections with positions, colour palette,
     * classification profile, depth zones.
     * Omits sections with no data. Returns empty string if nothing to show.
     *
     * @returns {string} Markdown text or empty string
     */
    buildAnalysisReferenceMarkdown() {
      // Use corrected analysis if user has made OCR edits (Phase 14H fix)
      let analysis = this.lastAnalysis;
      if (!analysis) return "";
      if (
        typeof window.ImageDescriberOverlay !== "undefined" &&
        window.ImageDescriberOverlay.hasCorrections()
      ) {
        analysis = window.ImageDescriberOverlay.getCorrectedAnalysis();
        logDebug("Analysis reference using corrected OCR data");
      }

      // Use the format module's confidenceWord if available
      const fmt = window.ImageDescriberAnalyserFormat;
      const confidenceWord = fmt && typeof fmt.confidenceWord === "function"
        ? fmt.confidenceWord
        : function () { return ""; };

      const sections = [];

      // --- OCR detections ---
      if (
        analysis.ocr &&
        analysis.ocr.status === "complete" &&
        analysis.ocr.items &&
        analysis.ocr.items.length > 0
      ) {
        const lines = [];
        const seen = new Set();
        for (let i = 0; i < analysis.ocr.items.length; i++) {
          const item = analysis.ocr.items[i];
          const text = (item.text || "").trim();
          if (!text) continue;
          const key = text.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const quadrant = item.quadrant || "unknown position";
          const conf = confidenceWord(item.confidence);
          let line = "- \"" + text + "\" — " + quadrant;
          if (conf) line += " (" + conf + ")";
          lines.push(line);
        }
        if (lines.length > 0) {
          sections.push("### Detected Text\n" + lines.join("\n"));
        }
      }

      // --- Colour palette ---
      if (
        analysis.colour &&
        analysis.colour.status === "complete" &&
        analysis.colour.palette &&
        analysis.colour.palette.length > 0
      ) {
        const colours = analysis.colour.palette.map(function (p) {
          const pct = Math.round((p.percentage || 0) * 100);
          const name = p.colourName
            ? p.colourName.charAt(0).toUpperCase() + p.colourName.slice(1)
            : "";
          return name + (pct > 0 ? " (" + pct + "%)" : "");
        });
        if (colours.length > 0) {
          sections.push("### Colour Palette\n" + colours.join(", "));
        }
      }

      // --- Classification ---
      if (analysis.classification && analysis.classification.profile) {
        const cls = analysis.classification;
        const pct = Math.round((cls.confidence || 0) * 100);
        const capProfile = cls.profile.charAt(0).toUpperCase() + cls.profile.slice(1);
        let line = "Type: " + capProfile + " (" + pct + "% confidence)";
        if (
          cls.clip &&
          cls.clip.topLabel &&
          cls.clip.topLabel.toLowerCase() !== cls.profile.toLowerCase()
        ) {
          const capClip = cls.clip.topLabel.charAt(0).toUpperCase() + cls.clip.topLabel.slice(1);
          line += ", CLIP: \"" + capClip + "\"";
        }
        // Show user-selected profile if different from auto-classification
        const selectedProfile = this.getSelectedProfile();
        if (selectedProfile && selectedProfile !== "default" &&
            selectedProfile.toLowerCase() !== cls.profile.toLowerCase()) {
          const capSelected = selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1);
          line += ", User profile: \"" + capSelected + "\"";
        }
        sections.push("### Image Classification\n" + line);
      }

      // --- Depth zones ---
      if (
        analysis.depth &&
        analysis.depth.status === "success" &&
        analysis.depth.hasSignificantDepth &&
        analysis.depth.zones
      ) {
        const zones = analysis.depth.zones;
        const zoneParts = [];
        const zoneNames = ["foreground", "midground", "background"];
        for (let z = 0; z < zoneNames.length; z++) {
          const zone = zones[zoneNames[z]];
          if (zone && zone.areaPercent >= 10) {
            zoneParts.push(zoneNames[z].charAt(0).toUpperCase() + zoneNames[z].slice(1) + " (" + Math.round(zone.areaPercent) + "%)");
          }
        }
        if (zoneParts.length > 1) {
          sections.push("### Depth Zones\n" + zoneParts.join(", "));
        }
      }

      if (sections.length === 0) return "";

      return (
        "## Analysis Reference Data\n\n" +
        "The following was detected by automated image analysis. " +
        "Use it to verify and correct the description above.\n\n" +
        sections.join("\n\n")
      );
    },

    /**
     * Builds semantic HTML for the analysis reference section.
     * Uses <aside>, <dl> for key-value data, <ul> for lists.
     * Returns empty string if no analysis data available.
     *
     * @returns {string} Semantic HTML or empty string
     */
    _buildAnalysisReferenceHTML() {
      // Use corrected analysis if user has made OCR edits (Phase 14H fix)
      let analysis = this.lastAnalysis;
      if (!analysis) return "";
      if (
        typeof window.ImageDescriberOverlay !== "undefined" &&
        window.ImageDescriberOverlay.hasCorrections()
      ) {
        analysis = window.ImageDescriberOverlay.getCorrectedAnalysis();
      }

      const fmt = window.ImageDescriberAnalyserFormat;
      const confidenceWord = fmt && typeof fmt.confidenceWord === "function"
        ? fmt.confidenceWord
        : function () { return ""; };

      const sections = [];

      // --- OCR detections ---
      if (
        analysis.ocr &&
        analysis.ocr.status === "complete" &&
        analysis.ocr.items &&
        analysis.ocr.items.length > 0
      ) {
        const items = [];
        const seen = new Set();
        for (let i = 0; i < analysis.ocr.items.length; i++) {
          const item = analysis.ocr.items[i];
          const text = (item.text || "").trim();
          if (!text) continue;
          const key = text.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          const quadrant = item.quadrant || "unknown position";
          const conf = confidenceWord(item.confidence);
          let desc = "\u201C" + text + "\u201D \u2014 " + quadrant;
          if (conf) desc += " (" + conf + ")";
          items.push("<li>" + desc + "</li>");
        }
        if (items.length > 0) {
          sections.push(
            "<section>" +
            "<h3>Detected Text</h3>" +
            "<ul>" + items.join("") + "</ul>" +
            "</section>"
          );
        }
      }

      // --- Colour palette ---
      if (
        analysis.colour &&
        analysis.colour.status === "complete" &&
        analysis.colour.palette &&
        analysis.colour.palette.length > 0
      ) {
        const items = [];
        for (let i = 0; i < analysis.colour.palette.length; i++) {
          const p = analysis.colour.palette[i];
          const pct = Math.round((p.percentage || 0) * 100);
          const name = p.colourName
            ? p.colourName.charAt(0).toUpperCase() + p.colourName.slice(1)
            : "";
          const label = name + (pct > 0 ? " (" + pct + "%)" : "");
          items.push("<li>" + label + "</li>");
        }
        if (items.length > 0) {
          sections.push(
            "<section>" +
            "<h3>Colour Palette</h3>" +
            '<ul class="imgdesc-ref-inline-list">' + items.join("") + "</ul>" +
            "</section>"
          );
        }
      }

      // --- Classification ---
      if (analysis.classification && analysis.classification.profile) {
        const cls = analysis.classification;
        const pct = Math.round((cls.confidence || 0) * 100);
        const capProfile = cls.profile.charAt(0).toUpperCase() + cls.profile.slice(1);
        let dlContent =
          "<dt>Type</dt>" +
          "<dd>" + capProfile + " (" + pct + "% confidence)</dd>";
        if (
          cls.clip &&
          cls.clip.topLabel &&
          cls.clip.topLabel.toLowerCase() !== cls.profile.toLowerCase()
        ) {
          const capClip = cls.clip.topLabel.charAt(0).toUpperCase() + cls.clip.topLabel.slice(1);
          dlContent +=
            "<dt>CLIP</dt>" +
            "<dd>" + capClip + "</dd>";
        }
        // Show user-selected profile if different from auto-classification
        const selectedProfile = this.getSelectedProfile();
        if (selectedProfile && selectedProfile !== "default" &&
            selectedProfile.toLowerCase() !== cls.profile.toLowerCase()) {
          const capSelected = selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1);
          dlContent +=
            "<dt>User profile</dt>" +
            "<dd>" + capSelected + "</dd>";
        }
        sections.push(
          "<section>" +
          "<h3>Image Classification</h3>" +
          "<dl>" + dlContent + "</dl>" +
          "</section>"
        );
      }

      // --- Depth zones ---
      if (
        analysis.depth &&
        analysis.depth.status === "success" &&
        analysis.depth.hasSignificantDepth &&
        analysis.depth.zones
      ) {
        const zones = analysis.depth.zones;
        const items = [];
        const zoneNames = ["foreground", "midground", "background"];
        for (let z = 0; z < zoneNames.length; z++) {
          const zone = zones[zoneNames[z]];
          if (zone && zone.areaPercent >= 10) {
            items.push(
              "<li>" + zoneNames[z].charAt(0).toUpperCase() + zoneNames[z].slice(1) + " (" + Math.round(zone.areaPercent) + "%)</li>"
            );
          }
        }
        if (items.length > 1) {
          sections.push(
            "<section>" +
            "<h3>Depth Zones</h3>" +
            '<ul class="imgdesc-ref-inline-list">' + items.join("") + "</ul>" +
            "</section>"
          );
        }
      }

      if (sections.length === 0) return "";

      return (
        '<aside class="imgdesc-analysis-reference" aria-label="Analysis reference data">' +
        "<h2>Analysis Reference Data</h2>" +
        "<p>The following was detected by automated image analysis. " +
        "Use it to verify and correct the description above.</p>" +
        sections.join("") +
        "</aside>"
      );
    },

    /**
     * Renders analysis reference data and appends it to the output div.
     * Call AFTER lastRawOutput/lastRawHTML are stored, BEFORE adjustHeadingLevels().
     * Safe to call when lastAnalysis is null — does nothing.
     */
    _appendAnalysisReference() {
      const refMarkdown = this.buildAnalysisReferenceMarkdown();
      if (!refMarkdown) {
        logDebug("No analysis reference data to append");
        return;
      }

      // Append markdown to raw output for text copy operations
      this.lastRawOutput += "\n\n---\n\n" + refMarkdown;

      // Build semantic HTML and append to output
      if (this.elements.output) {
        const refHtml = this._buildAnalysisReferenceHTML();
        if (refHtml) {
          // Insert as parsed DOM — the <aside> is the wrapper itself
          const temp = document.createElement("div");
          temp.innerHTML = refHtml;
          const aside = temp.firstElementChild;
          this.elements.output.appendChild(aside);
        }
      }

      // Update HTML store to include reference
      this.lastRawHTML = this.elements.output
        ? this.elements.output.innerHTML
        : this.lastRawHTML;

      logInfo("Analysis reference data appended to output");
    },

    // ========================================================================
    // EDUCATIONAL CONTEXT REFERENCE (Phase 14I)
    // ========================================================================

    /**
     * Builds markdown-formatted educational context from form fields.
     * Appended below local model output so users see their input reflected
     * in the output they copy. The model never sees this data.
     *
     * Includes: Subject Area, Topic, Learning Objective, Additional Context,
     * Module, Audience Level (if not default).
     * Omits empty fields. Returns empty string if nothing to show.
     *
     * @returns {string} Markdown text or empty string
     */
    buildEducationalContextMarkdown() {
      const lines = [];

      const subject = this.elements.subject?.value?.trim();
      if (subject) lines.push("- **Subject Area:** " + subject);

      const topic = this.elements.topic?.value?.trim();
      if (topic) lines.push("- **Topic:** " + topic);

      const objective = this.elements.objective?.value?.trim();
      if (objective) lines.push("- **Learning Objective:** " + objective);

      const context = this.elements.context?.value?.trim();
      if (context) lines.push("- **Additional Context:** " + context);

      const module = this.elements.module?.value?.trim();
      if (module) lines.push("- **Module:** " + module);

      // Audience level — omit if default ("general")
      const audienceSelect = this.elements.audience;
      if (audienceSelect && audienceSelect.value && audienceSelect.value !== "general") {
        const selectedOption = audienceSelect.options[audienceSelect.selectedIndex];
        const label = selectedOption ? selectedOption.textContent.trim() : audienceSelect.value;
        lines.push("- **Audience:** " + label);
      }

      if (lines.length === 0) return "";

      return "## Educational Context\n\n" + lines.join("\n");
    },

    /**
     * Builds semantic HTML for the educational context section.
     * Uses <aside> with <dl> for key-value pairs.
     * Returns empty string if no fields are populated.
     *
     * @returns {string} Semantic HTML or empty string
     */
    _buildEducationalContextHTML() {
      const pairs = [];

      const subject = this.elements.subject?.value?.trim();
      if (subject) pairs.push("<dt>Subject Area</dt><dd>" + subject + "</dd>");

      const topic = this.elements.topic?.value?.trim();
      if (topic) pairs.push("<dt>Topic</dt><dd>" + topic + "</dd>");

      const objective = this.elements.objective?.value?.trim();
      if (objective) pairs.push("<dt>Learning Objective</dt><dd>" + objective + "</dd>");

      const context = this.elements.context?.value?.trim();
      if (context) pairs.push("<dt>Additional Context</dt><dd>" + context + "</dd>");

      const module = this.elements.module?.value?.trim();
      if (module) pairs.push("<dt>Module</dt><dd>" + module + "</dd>");

      // Audience level — omit if default ("general")
      const audienceSelect = this.elements.audience;
      if (audienceSelect && audienceSelect.value && audienceSelect.value !== "general") {
        const selectedOption = audienceSelect.options[audienceSelect.selectedIndex];
        const label = selectedOption ? selectedOption.textContent.trim() : audienceSelect.value;
        pairs.push("<dt>Audience</dt><dd>" + label + "</dd>");
      }

      if (pairs.length === 0) return "";

      return (
        '<aside class="imgdesc-educational-context" aria-label="Educational context">' +
        "<h2>Educational Context</h2>" +
        "<dl>" + pairs.join("") + "</dl>" +
        "</aside>"
      );
    },

    /**
     * Renders educational context and appends it to the output div.
     * Call AFTER _appendAnalysisReference(), BEFORE adjustHeadingLevels().
     * Safe to call when no fields are populated — does nothing.
     */
    _appendEducationalContext() {
      const refMarkdown = this.buildEducationalContextMarkdown();
      if (!refMarkdown) {
        logDebug("No educational context to append");
        return;
      }

      // Append markdown to raw output for text copy operations
      this.lastRawOutput += "\n\n---\n\n" + refMarkdown;

      // Build semantic HTML and append to output
      if (this.elements.output) {
        const refHtml = this._buildEducationalContextHTML();
        if (refHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = refHtml;
          const aside = temp.firstElementChild;
          this.elements.output.appendChild(aside);
        }
      }

      // Update HTML store to include educational context
      this.lastRawHTML = this.elements.output
        ? this.elements.output.innerHTML
        : this.lastRawHTML;

      logInfo("Educational context appended to output");
    },

    // ========================================================================
    // VISUAL VERIFICATION (Two-Pass)
    // ========================================================================

    /**
     * Check whether visual verification is enabled
     * @returns {boolean}
     */
    isVerificationEnabled() {
      return this.elements.verifyEnabled?.checked === true;
    },

    /**
     * Get the selected verification model ID
     * Falls back to the main model if none selected
     * @returns {string} Model ID
     */
    getVerificationModel() {
      const verifyModel = this.elements.verifyModel?.value;
      if (verifyModel) return verifyModel;
      // Fallback to main model
      return this.getSelectedModel();
    },

    /**
     * Build the verification system prompt
     * Focused on visual accuracy checking, not description generation
     * @returns {string}
     */
    buildVerificationSystemPrompt() {
      if (window.PROMPT_VERIFICATION) {
        return window.PROMPT_VERIFICATION;
      }
      // Fallback if prompt file failed to load
      logWarn("PROMPT_VERIFICATION not loaded — using fallback");
      return "You are a visual accuracy checker for accessible image descriptions. Compare the written description against the actual image and identify any visual inaccuracies. List corrections found or confirm the description is accurate.";
    },

    /**
     * Build the verification user prompt
     * Includes the generated description for checking
     * @param {string} description - The generated description markdown
     * @returns {string}
     */
    buildVerificationUserPrompt(description) {
      return `Please check the following image description against the attached image. Identify any visual inaccuracies — places where the description does not match what is actually visible in the image.

---

${description}

---

Compare each visual claim in the description against the image. Report any inaccuracies you find, or confirm the description is visually accurate.

${ESCAPE_GUARD_INSTRUCTION}`;
    },

    /**
     * Get or create the verification embed instance
     * Uses a separate instance so it can have a different model
     * @returns {OpenRouterEmbed}
     */
    getOrCreateVerificationEmbed() {
      // Always recreate to pick up model changes
      if (!window.OpenRouterEmbed) {
        throw new Error("OpenRouterEmbed not available for verification.");
      }

      const verifyModel = this.getVerificationModel();
      logInfo("Creating verification embed with model:", verifyModel);

      const embedConfig = {
        containerId: "imgdesc-verification-output",

        // Same reason as the main output embed: streamed content into a live
        // region re-reads the whole thing per token. This container also sits
        // inside a closed <details>, so it was announcing only in the state
        // where the user had opened the disclosure and could read it anyway.
        announceContainer: false,
        model: verifyModel,
        temperature: 0.2, // Lower temperature for accuracy checking
        max_tokens: 2000, // Verification needs fewer tokens
        showNotifications: false,
        showStreamingProgress: false,
        enableCompression: false, // Image already compressed from pass 1
      };

      // Add retry if available
      if (window.EmbedRetryHandler || window.EmbedRetryHandlerClass) {
        embedConfig.retry = {
          enabled: true,
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: true,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        };
      }

      this.verificationEmbedInstance = new window.OpenRouterEmbed(embedConfig);
      return this.verificationEmbedInstance;
    },

    /**
     * Run the verification pass
     * Sends the image + description to the verification model
     * @param {string} description - The generated description to verify
     * @returns {Object} Verification result with text, tokens, corrections flag
     */
    async runVerification(description) {
      logInfo("Starting visual verification pass...");
      this.verificationStartTime = Date.now();

      const verifyEmbed = this.getOrCreateVerificationEmbed();

      // ── Layer 2: deterministic vision re-check (verification path) ─────────
      // The verification dropdown is vision-filtered at population time but
      // shares the gate's bypass weaknesses and falls back to the main model.
      // Re-check the model actually about to be used before sending the image;
      // if it is not vision-capable, skip verification via the non-fatal path
      // (this throw is caught in generate() → handleVerificationError) rather
      // than send the image to a non-vision model.
      const verifyModelInUse = verifyEmbed.model || this.getVerificationModel();
      if (!this.isModelVisionCapable(verifyModelInUse)) {
        logWarn(
          "Verification vision re-check FAILED — skipping verification for non-vision model:",
          verifyModelInUse,
        );
        throw new Error(
          "Verification model cannot process images — visual verification skipped.",
        );
      }

      const systemPrompt = this.buildVerificationSystemPrompt();
      const userPrompt = this.buildVerificationUserPrompt(description);

      verifyEmbed.systemPrompt = systemPrompt;

      // Attach the same image file
      await verifyEmbed.attachFile(this.currentFile);

      // Always use non-streaming for verification (simpler, result shown at once)
      const response = await verifyEmbed.sendRequest(userPrompt);

      // ── Layer 2: log-only strip telemetry (verification path) ─────────────
      this._checkImageStripTelemetry(
        response,
        systemPrompt,
        userPrompt,
        verifyModelInUse,
        "verification",
      );

      const verifyTime = Date.now() - this.verificationStartTime;

      // Determine if corrections were found
      const text = response.text || "";
      const hasCorrections = !text
        .toLowerCase()
        .includes("no corrections needed");

      this.lastVerificationOutput = text;

      logInfo("Verification complete", {
        hasCorrections,
        timeMs: verifyTime,
        responseLength: text.length,
      });

      return {
        text: text,
        hasCorrections: hasCorrections,
        timeMs: verifyTime,
        tokens: response.metadata?.tokens || response.raw?.usage || {},
        model: this.getVerificationModel(),
      };
    },

    /**
     * Display verification results in the UI
     * @param {Object} result - Result from runVerification()
     */
    displayVerificationResults(result) {
      // Show the panel
      if (this.elements.verifyPanel) {
        this.elements.verifyPanel.hidden = false;
        // Auto-open if corrections found
        if (result.hasCorrections) {
          this.elements.verifyPanel.open = true;
        }
      }

      // Set badge
      if (this.elements.verifyBadge) {
        if (result.hasCorrections) {
          this.elements.verifyBadge.textContent = "Corrections found";
          this.elements.verifyBadge.className =
            "imgdesc-verify-badge badge-corrections";
        } else {
          this.elements.verifyBadge.textContent = "Passed";
          this.elements.verifyBadge.className =
            "imgdesc-verify-badge badge-pass";
        }
      }

      // The output div already has the rendered response from the embed
      // Apply MathJax if needed
      if (this.elements.verifyOutput) {
        this.typesetMathJax(this.elements.verifyOutput);
      }
    },

    /**
     * Handle verification error — show error badge but don't fail the generation
     * @param {Error} error - The error that occurred
     */
    handleVerificationError(error) {
      logError("Verification failed:", error);

      if (this.elements.verifyPanel) {
        this.elements.verifyPanel.hidden = false;
      }

      if (this.elements.verifyBadge) {
        this.elements.verifyBadge.textContent = "Check failed";
        this.elements.verifyBadge.className =
          "imgdesc-verify-badge badge-error";
      }

      if (this.elements.verifyOutput) {
        this.elements.verifyOutput.textContent = `Verification could not be completed: ${error.message}. The description above was generated successfully.`;
      }
    },

    /**
     * Update debug panel with verification details
     * @param {Object} result - Verification result or null if disabled
     */
    updateVerificationDebug(result) {
      const setText = (el, val) => {
        if (el) el.textContent = val || "-";
      };

      if (!result) {
        // Verification was disabled
        setText(this.elements.debugVerifyEnabled, "No");
        if (this.elements.debugVerifySection) {
          this.elements.debugVerifySection.hidden = true;
        }
        return;
      }

      // Show the debug section
      if (this.elements.debugVerifySection) {
        this.elements.debugVerifySection.hidden = false;
      }

      setText(this.elements.debugVerifyEnabled, "Yes");
      setText(this.elements.debugVerifyModel, result.model || "-");

      // Tokens
      const tokens = result.tokens || {};
      const totalTokens =
        (tokens.prompt || tokens.prompt_tokens || 0) +
        (tokens.completion || tokens.completion_tokens || 0);
      setText(
        this.elements.debugVerifyTokens,
        totalTokens
          ? String(totalTokens)
          : "~" +
              Math.round((result.text?.length || 0) * 0.25) +
              " (estimated)",
      );

      // Time
      setText(
        this.elements.debugVerifyTime,
        result.timeMs ? `${(result.timeMs / 1000).toFixed(1)}s` : "-",
      );

      // Corrections
      setText(
        this.elements.debugVerifyCorrections,
        result.hasCorrections ? "Yes" : "No",
      );
    },

    /**
     * Clear verification UI state
     * Called on reset and new image
     */
    clearVerification() {
      this.lastVerificationOutput = null;
      this.verificationStartTime = null;

      if (this.elements.verifyPanel) {
        this.elements.verifyPanel.hidden = true;
        this.elements.verifyPanel.open = false;
      }

      if (this.elements.verifyOutput) {
        this.elements.verifyOutput.innerHTML = "";
      }

      if (this.elements.verifyBadge) {
        this.elements.verifyBadge.textContent = "";
        this.elements.verifyBadge.className = "imgdesc-verify-badge";
      }
    },

    /**
     * Populate the verification model selector.
     * Provider-aware (Task 3.5b) — mirrors populateModelSelector but for the
     * verification dropdown. The mismatch notice is shared with the main
     * selector (rendered by populateModelSelector), so this function only
     * clears the verification dropdown when the active provider has no
     * vision models — it doesn't render its own notice.
     */
    populateVerificationModelSelector() {
      const selector = this.elements.verifyModel;
      if (!selector) return;

      // Check for model registry (lowercase r — matches main selector)
      if (!window.modelRegistry) {
        logDebug("modelRegistry not available for verification selector");
        selector.innerHTML =
          '<option value="">Same as description model</option>';
        return;
      }

      // Determine the active provider (Task 3.5b)
      const activeProvider =
        window.ProviderSwitcher &&
        typeof window.ProviderSwitcher.getActive === "function"
          ? window.ProviderSwitcher.getActive()
          : "openrouter";

      // Get vision-capable models filtered to the active provider.
      // Primary path: EmbedModelSelector.getEligibleModels. Fallback:
      // KNOWN_VISION_MODELS via filterVisionModelsFallback (defined on
      // controller-model.js, accessed via `this`).
      let visionModels = [];

      if (
        window.EmbedModelSelector &&
        typeof window.EmbedModelSelector.getEligibleModels === "function"
      ) {
        try {
          visionModels = window.EmbedModelSelector.getEligibleModels({
            providerId: activeProvider,
            capabilities: ["vision"],
          });
          logDebug(
            `verifySelector: getEligibleModels returned ${visionModels.length} vision models for provider '${activeProvider}'`,
          );
        } catch (error) {
          logWarn(
            "verifySelector: getEligibleModels failed, using fallback:",
            error,
          );
          visionModels = this.filterVisionModelsFallback(activeProvider);
        }
      } else {
        visionModels = this.filterVisionModelsFallback(activeProvider);
      }

      if (visionModels.length === 0) {
        // Shared mismatch notice (if any) is rendered by populateModelSelector.
        // For the verification dropdown, just leave the safe default option.
        selector.innerHTML =
          '<option value="">Same as description model</option>';
        return;
      }

      // Group by cost tier (same as main selector)
      const groupedModels = this.groupModelsByCostTier(visionModels);

      // Build the dropdown
      selector.innerHTML =
        '<option value="">Same as description model</option>';

      const tierLabels = {
        low: "💰 Low Cost",
        medium: "⚖️ Medium Cost",
        high: "🚀 High Cost",
      };

      const tierOrder = ["low", "medium", "high"];

      tierOrder.forEach((tier) => {
        const models = groupedModels[tier];
        if (!models || models.length === 0) return;

        const optgroup = document.createElement("optgroup");
        optgroup.label = tierLabels[tier];

        const sortedModels = [...models].sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id),
        );

        sortedModels.forEach((model) => {
          const option = document.createElement("option");
          option.value = model.id;

          const displayName = model.name || model.id.split("/").pop();
          const provider = model.provider || model.id.split("/")[0];
          option.textContent = `${displayName} (${provider})`;

          if (model.costs) {
            option.dataset.inputCost = model.costs.input || 0;
            option.dataset.outputCost = model.costs.output || 0;
          }
          option.dataset.provider = provider;
          option.dataset.costTier = tier;

          optgroup.appendChild(option);
        });

        selector.appendChild(optgroup);
      });

      logInfo(
        `Verification model selector populated with ${visionModels.length} vision models`,
      );
    },

    /**
     * Bind verification UI event handlers
     * Called from bindEvents()
     */
    bindVerificationEvents() {
      // Toggle model selector visibility when checkbox changes
      if (this.elements.verifyEnabled) {
        this.elements.verifyEnabled.addEventListener("change", () => {
          const enabled = this.elements.verifyEnabled.checked;
          if (this.elements.verifyModelGroup) {
            this.elements.verifyModelGroup.hidden = !enabled;
          }
          logDebug("Verification toggled:", enabled);
        });
      }
    },

    // ========================================================================
    // PROGRESS MANAGEMENT (Phase 2A)
    // ========================================================================

    /**
     * Show progress indicator and start timer
     * @param {string} stage - Stage key from PROGRESS_STAGES
     */
    showProgress(stage) {
      const config =
        PROGRESS_STAGES[stage] || LOCAL_PROGRESS_STAGES[stage] || QWEN_PROGRESS_STAGES[stage] || LFM2VL_PROGRESS_STAGES[stage];
      if (!config) {
        logWarn("Unknown progress stage:", stage);
        return;
      }

      this.currentStage = stage;

      // Hide completion time from previous run
      this.hideCompletionTime();

      // Show progress container
      if (this.elements.progress) {
        this.elements.progress.hidden = false;
      }

      // Update stage text with icon
      if (this.elements.progressStage) {
        const iconHtml =
          typeof getIcon === "function"
            ? getIcon(config.icon)
            : `<span aria-hidden="true">${config.icon}</span>`;
        this.elements.progressStage.innerHTML = `${iconHtml} ${config.message}`;
      }

      // Show/hide analysis slot breakdown (Phase 9E)
      const slotsEl = document.getElementById("imgdesc-progress-slots");
      if (slotsEl) {
        if (stage === "ANALYSING") {
          this._showAnalysisSlots(slotsEl);
        } else {
          slotsEl.hidden = true;
        }
      }

      // Toggle pulsing animation during generation stages (post-14F)
      if (this.elements.progressFill) {
        this.elements.progressFill.classList.toggle(
          "generating",
          GENERATING_STAGES.indexOf(stage) !== -1,
        );
      }

      // Restart the screen-reader keep-alive clock on every stage change.
      // Elapsed accumulates across stages, so the marker must be set to NOW —
      // resetting it to 0 makes the first "Still generating" ping fire early
      // (time spent in earlier stages already exceeds the interval). With this,
      // the first ping lands one full interval after entering a generating stage.
      this._lastGeneratingAnnounceS = this.getElapsedSeconds();

      // Update progress bar
      const percentage = this.calculateProgressPercentage(stage);
      this.updateProgressBar(percentage);

      // Start timer if not already running
      if (!this.progressTimer) {
        this.progressStartTime = Date.now();
        this.progressTimer = setInterval(() => this.updateProgressTime(), 1000);
      }

      logDebug("Progress updated:", stage, percentage + "%");
    },

    // ========================================================================
    // ANALYSIS SLOT BREAKDOWN (Phase 9E)
    // ========================================================================

    /**
     * Analysis slot definitions for progress display.
     * Keys match analysis:stage event stage values.
     */
    _ANALYSIS_SLOTS: {
      ocr: { label: "Tesseract OCR" },
      colour: { label: "Colour sampling" },
      clip: { label: "CLIP classification" },
      depth: { label: "Depth estimation" },
      florenceCaption: { label: "Florence-2 caption" },
      florenceObjects: { label: "Florence-2 objects" },
    },

    /**
     * Show the per-slot analysis breakdown list.
     * Each slot starts as "pending" and updates via _updateProgressSlot.
     * @param {HTMLElement} slotsEl - The UL container
     */
    _showAnalysisSlots(slotsEl) {
      slotsEl.hidden = false;
      slotsEl.innerHTML = "";

      // Track slot statuses for this generation
      this._progressSlotStatuses = {};

      for (const [key, slot] of Object.entries(this._ANALYSIS_SLOTS)) {
        this._progressSlotStatuses[key] = "pending";

        const li = document.createElement("li");
        li.className = "imgdesc-progress-slot";
        li.id = "imgdesc-progress-slot-" + key;

        const iconSpan = document.createElement("span");
        iconSpan.className = "imgdesc-progress-slot-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        // Pending state: no icon yet
        li.appendChild(iconSpan);

        const labelSpan = document.createElement("span");
        labelSpan.className = "imgdesc-progress-slot-label";
        labelSpan.textContent = slot.label;
        li.appendChild(labelSpan);

        const statusSpan = document.createElement("span");
        statusSpan.className = "imgdesc-progress-slot-status";
        statusSpan.textContent = "pending";
        li.appendChild(statusSpan);

        slotsEl.appendChild(li);
      }

      // Subscribe to analysis:stage events for live updates
      this._bindProgressSlotListener();
    },

    /**
     * Bind (once) a listener for analysis:stage events to update slot display.
     */
    _bindProgressSlotListener() {
      // Avoid duplicate listeners
      if (this._progressSlotListenerBound) return;
      this._progressSlotListenerBound = true;

      if (window.EmbedEventEmitter) {
        window.EmbedEventEmitter.on("analysis:stage", (data) => {
          if (!data || !data.stage || !data.status) return;
          // Only update slots during ANALYSING stage
          if (this.currentStage === "ANALYSING") {
            this._updateProgressSlot(data.stage, data.status);
          }
        });
      }
    },

    /**
     * Update a single analysis slot's display.
     * @param {string} slotKey — "ocr", "colour", "clip"
     * @param {string} status — "running", "complete", "skipped", "error", "cached"
     */
    _updateProgressSlot(slotKey, status) {
      if (!this._ANALYSIS_SLOTS[slotKey]) return;

      this._progressSlotStatuses[slotKey] = status;

      const li = document.getElementById("imgdesc-progress-slot-" + slotKey);
      if (!li) return;

      li.setAttribute("data-slot-status", status);

      // Update icon
      const iconSpan = li.querySelector(".imgdesc-progress-slot-icon");
      if (iconSpan && typeof getIcon === "function") {
        const iconMap = {
          pending: "",
          running: "hourglass",
          complete: "checkCircle",
          skipped: "close",
          error: "error",
          cached: "disk",
        };
        const iconName = iconMap[status] || "";
        iconSpan.innerHTML = iconName ? getIcon(iconName) : "";
      }

      // Update status text
      const statusSpan = li.querySelector(".imgdesc-progress-slot-status");
      if (statusSpan) {
        const textMap = {
          pending: "pending",
          running: "running\u2026",
          complete: "complete",
          skipped: "skipped",
          error: "failed",
          cached: "restored from cache",
        };
        statusSpan.textContent = textMap[status] || status;
      }
    },

    /**
     * Calculate cumulative progress percentage for a stage
     * @param {string} stage - Current stage key
     * @returns {number} Percentage (0-100)
     */
    calculateProgressPercentage(stage) {
      // Determine which stage map this stage belongs to
      let stageMap = PROGRESS_STAGES;
      if (LOCAL_PROGRESS_STAGES[stage]) {
        stageMap = LOCAL_PROGRESS_STAGES;
      } else if (QWEN_PROGRESS_STAGES[stage]) {
        stageMap = QWEN_PROGRESS_STAGES;
      }

      const stages = Object.keys(stageMap);
      const currentIndex = stages.indexOf(stage);

      if (currentIndex === -1) return 0;

      let progress = 0;
      for (let i = 0; i <= currentIndex; i++) {
        progress += stageMap[stages[i]].weight;
      }

      return Math.min(progress, 100);
    },

    /**
     * Update the visual progress bar
     * @param {number} percentage - Percentage complete (0-100)
     */
    updateProgressBar(percentage) {
      if (this.elements.progressFill) {
        this.elements.progressFill.style.width = `${percentage}%`;
      }

      if (this.elements.progressBar) {
        this.elements.progressBar.setAttribute("aria-valuenow", percentage);
      }
    },

    /**
     * Update elapsed time display
     */
    updateProgressTime() {
      if (!this.progressStartTime || !this.elements.progressTime) return;

      const elapsed = Math.floor((Date.now() - this.progressStartTime) / 1000);
      this.elements.progressTime.textContent = `${elapsed}s`;

      this._announceStillGenerating(elapsed);
    },

    /**
     * Screen-reader keep-alive during generation.
     *
     * The elapsed counter above is visible-only: #imgdesc-progress-time is not a
     * live region, and making it one would speak every single second. This says
     * the same thing at a usable cadence.
     *
     * Only runs while the model is producing text. The earlier stages
     * (validating, compressing, analysing) are fast and already announced, so a
     * keep-alive there would be noise.
     *
     * @param {number} elapsed - Elapsed seconds, as counted for the visible timer
     */
    _announceStillGenerating(elapsed) {
      if (GENERATING_STAGES.indexOf(this.currentStage) === -1) return;

      const last = this._lastGeneratingAnnounceS || 0;
      if (elapsed - last < GENERATING_ANNOUNCE_INTERVAL_S) return;

      this._lastGeneratingAnnounceS = elapsed;
      this.announceStatus(
        `Still generating. ${this.formatElapsedTime(elapsed)} elapsed.`,
      );
    },

    /**
     * Get current elapsed time in seconds
     * @returns {number} Elapsed seconds
     */
    getElapsedSeconds() {
      if (!this.progressStartTime) return 0;
      return Math.floor((Date.now() - this.progressStartTime) / 1000);
    },

    /**
     * Format elapsed time for display
     * @param {number} seconds - Elapsed seconds
     * @returns {string} Formatted time string
     */
    formatElapsedTime(seconds) {
      if (seconds < 60) {
        return `${seconds}s`;
      }
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    },

    /**
     * Show completion time after successful generation
     * @param {number} seconds - Total elapsed seconds
     */
    showCompletionTime(seconds) {
      this.lastElapsedTime = seconds;

      if (this.elements.finalTime) {
        this.elements.finalTime.textContent = this.formatElapsedTime(seconds);
      }

      if (this.elements.completionTime) {
        this.elements.completionTime.hidden = false;
      }

      logDebug("Completion time displayed:", this.formatElapsedTime(seconds));
    },

    /**
     * Hide completion time display
     */
    hideCompletionTime() {
      if (this.elements.completionTime) {
        this.elements.completionTime.hidden = true;
      }
    },

    /**
     * Hide progress indicator and clean up
     * @param {boolean} showFinalTime - Whether to display completion time
     */
    hideProgress(showFinalTime = false) {
      // Capture final elapsed time before clearing
      const finalSeconds = this.getElapsedSeconds();

      // Hide progress container
      if (this.elements.progress) {
        this.elements.progress.hidden = true;
      }

      // Clear timer
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }

      // Store completion time (status message already shows timing)
      if (showFinalTime && finalSeconds > 0) {
        this.lastElapsedTime = finalSeconds;
        logDebug("Completion time:", this.formatElapsedTime(finalSeconds));
      }

      // Hide cache recall banner once generation completes (Phase 2D)
      if (showFinalTime) {
        this.hideCacheRecallBanner();
      }

      // Hide analysis slot breakdown (Phase 9E)
      const slotsEl = document.getElementById("imgdesc-progress-slots");
      if (slotsEl) {
        slotsEl.hidden = true;
        slotsEl.innerHTML = "";
      }
      this._progressSlotStatuses = null;

      // Reset state
      this.progressStartTime = null;
      this.currentStage = null;

      // Reset progress bar
      this.updateProgressBar(0);

      logDebug("Progress hidden, showFinalTime:", showFinalTime);
    },

    /**
     * Cancel the current generation
     */
    cancelGeneration() {
      logInfo("Generation cancelled by user");

      // Abort any in-flight request
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      // Hide progress (don't show completion time for cancellation)
      this.hideProgress(false);

      // Reset generating state
      this.isGenerating = false;
      this.updateButtonStates();

      // Show feedback
      this.showStatus("Generation cancelled", "info");

      if (window.notifyInfo) {
        window.notifyInfo("Generation cancelled");
      }

      // Announce to screen reader
      // No announceStatus here: notifyInfo above carries the same words, and the
      // notification container is aria-live="polite".

      // Hiding the progress area removed the Cancel button focus was sitting
      // on — a second focus drop (SC 2.4.3). Cancel does NOT restore the
      // config layout, so the Generate button is usually still hidden; fall
      // through to the first focusable of the ready-state controls.
      const active = document.activeElement;
      if (
        !active ||
        active === document.body ||
        active === this.elements.cancelBtn
      ) {
        const target = [
          this.elements.generateBtn,
          this.elements.regenerateBtn,
          this.elements.newImageBtn,
        ].find((el) => el && !el.disabled && el.offsetParent !== null);
        if (target) target.focus();
      }
    },

    /**
     * Move focus onto the Cancel button after the switch to the output UI.
     *
     * showOutputUI() hides the generate area, so a keyboard user's focus on
     * the Generate button silently drops to <body> (SC 2.4.3). Cancel is the
     * only actionable control while generating, so it takes focus — guarded
     * on where focus actually was, so a user focused elsewhere is not moved.
     *
     * Must run AFTER showOutputUI(): the Cancel button's ancestor
     * #imgdesc-output-section is display:none before that call, and focus()
     * on a hidden element is a silent no-op.
     */
    _focusCancelAfterOutputSwitch() {
      const active = document.activeElement;
      const focusDropped =
        !active ||
        active === document.body ||
        active === this.elements.generateBtn ||
        active === this.elements.generateLocalBtn;

      if (focusDropped && this.elements.cancelBtn) {
        this.elements.cancelBtn.focus();
      }
    },

    // ========================================================================
    // GENERATION
    // ========================================================================

    /**
     * Check if reduced motion is preferred
     * @returns {boolean}
     */
    prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },

    /**
     * Layer 2 — log-only image-strip telemetry. Compares a cloud response's
     * prompt_tokens against a runtime per-request text estimate; when the gap
     * (delta) is below the calibration-derived floor the image likely never
     * reached the model, so emit a logWarn + `imageStripSuspected` event.
     * NEVER throws, NEVER blocks generation, NEVER surfaces to the user.
     * @param {Object} response - Embed response (cloud)
     * @param {string} systemPrompt - System prompt sent this request
     * @param {string} userPrompt - User prompt sent this request
     * @param {string} modelId - Model actually used
     * @param {string} [context] - Label ("cloud" | "verification")
     */
    _checkImageStripTelemetry(response, systemPrompt, userPrompt, modelId, context) {
      try {
        const t = (response && response.metadata && response.metadata.tokens) || {};
        // Normalise across shapes: metadata.tokens.prompt (non-streaming) /
        // .prompt_tokens (streaming) / raw.usage.prompt_tokens (fallback).
        let promptTokens = null;
        if (typeof t.prompt === "number") promptTokens = t.prompt;
        else if (typeof t.prompt_tokens === "number") promptTokens = t.prompt_tokens;
        else if (
          response &&
          response.raw &&
          response.raw.usage &&
          typeof response.raw.usage.prompt_tokens === "number"
        )
          promptTokens = response.raw.usage.prompt_tokens;

        // A real multimodal request always carries a non-trivial prompt, so a
        // prompt_tokens of 0 (or negative) means the provider/route did not
        // report usage for this response — NOT that the image was stripped.
        // Treat it the same as absent usage and skip, otherwise the comparison
        // misfires (delta = 0 − textEstimate is hugely negative) and produces a
        // false "image strip suspected" warning. Seen with some streaming
        // reasoning models that omit usage counts (e.g. openai/gpt-5.5).
        if (typeof promptTokens !== "number" || promptTokens <= 0) {
          // Usage absent or unreported — skip the comparison, never throw.
          logDebug("Strip telemetry skipped — prompt_tokens unavailable", {
            context: context || "cloud",
            promptTokens,
          });
          return;
        }

        const estimatedTextTokens = Math.round(
          ((systemPrompt ? systemPrompt.length : 0) +
            (userPrompt ? userPrompt.length : 0)) /
            CHARS_PER_TOKEN,
        );
        const delta = promptTokens - estimatedTextTokens;

        if (delta < IMAGE_STRIP_MIN_BUMP_TOKENS) {
          const payload = {
            model: modelId,
            promptTokens: promptTokens,
            estimatedTextTokens: estimatedTextTokens,
            delta: delta,
            threshold: IMAGE_STRIP_MIN_BUMP_TOKENS,
            context: context || "cloud",
          };
          logWarn(
            `Image strip suspected (${context || "cloud"}): prompt_tokens ` +
              `${promptTokens} ≈ text estimate ${estimatedTextTokens} ` +
              `(delta ${delta} < floor ${IMAGE_STRIP_MIN_BUMP_TOKENS}). The ` +
              `image may not have reached the model.`,
            payload,
          );
          if (
            window.EmbedEventEmitter &&
            typeof window.EmbedEventEmitter.emit === "function"
          ) {
            window.EmbedEventEmitter.emit("imageStripSuspected", payload);
          }
        } else {
          logDebug("Strip telemetry OK", {
            delta,
            floor: IMAGE_STRIP_MIN_BUMP_TOKENS,
            context: context || "cloud",
          });
        }
      } catch (error) {
        // Telemetry must never break generation.
        logWarn("Strip telemetry check failed (non-fatal):", error);
      }
    },

    /**
     * Generate image description
     */
    async generate() {
      if (this.isGenerating) {
        logWarn("Generation already in progress");
        return;
      }

      if (!this.currentFile || !this.currentBase64) {
        this.showError("Please upload an image first.");
        return;
      }

      logInfo("Starting generation...");
      this.isGenerating = true;

      // Hide profile suggestion banner during generation
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;

      // Access config values via exposed _controllerConfig
      const cfg = this._controllerConfig || {};

      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController();

        // Stage 1: Validating
        this.showProgress("VALIDATING");
        this._resetReasoningDisclosure();
        this.updateButtonStates();

        // Wait for prompts to be ready
        const promptsReady = await this.waitForPrompts();
        if (!promptsReady) {
          throw new Error("Prompts failed to load. Please refresh the page.");
        }

        // Stage 2: Compressing (for large files)
        // Note: compression happens inside attachFile(), but we show the stage
        const fileSizeKB = this.currentFile.size / 1024;
        if (fileSizeKB > 200) {
          // Match compression threshold
          this.showProgress("COMPRESSING");
          // Small delay to ensure user sees stage
          await new Promise((r) => setTimeout(r, 100));
        }

        // Stage 3: Analysing (Local Analysis — OCR + colour sampling)
        // Background analysis starts on image load; here we check/await results
        if (this.lastAnalysis) {
          // Analysis already completed in background — skip the stage
          logInfo("Using pre-computed analysis results");
        } else if (this._analysisPending) {
          // Analysis still running — show stage and await it
          this.showProgress("ANALYSING");
          try {
            await this._analysisPending;

            // Check if cancelled while waiting
            if (this.abortController?.signal?.aborted) {
              logInfo("Generation cancelled during analysis");
              throw new DOMException("Aborted", "AbortError");
            }

            logInfo(
              this.lastAnalysis
                ? `Analysis complete: OCR ${this.lastAnalysis.ocr?.status}, ` +
                    `Colour ${this.lastAnalysis.colour?.status}, ` +
                    `${this.lastAnalysis.totalDuration}ms`
                : "Analysis completed but produced no results",
            );
          } catch (analysisError) {
            if (analysisError.name === "AbortError") {
              throw analysisError;
            }
            logWarn(
              "Background analysis failed — continuing without pre-analysis data:",
              analysisError.message,
            );
            this.lastAnalysis = null;
          }
        } else if (
          typeof window.ImageDescriberAnalyser !== "undefined" &&
          window.ImageDescriberAnalyser.isAvailable()
        ) {
          // Fallback: no background analysis ran — run inline
          this.showProgress("ANALYSING");
          try {
            const previewImg = this.elements.preview?.querySelector("img");
            if (previewImg) {
              const profile = this.getSelectedProfile();
              const analysisResult =
                await window.ImageDescriberAnalyser.analyse(
                  previewImg,
                  profile,
                );

              if (this.abortController?.signal?.aborted) {
                logInfo("Generation cancelled during analysis");
                throw new DOMException("Aborted", "AbortError");
              }

              this.lastAnalysis = analysisResult;
              logInfo(
                `Inline analysis complete: OCR ${analysisResult.ocr?.status}, ` +
                  `Colour ${analysisResult.colour?.status}, ` +
                  `${analysisResult.totalDuration}ms`,
              );
            } else {
              logWarn("No preview image found — skipping analysis");
            }
          } catch (analysisError) {
            if (analysisError.name === "AbortError") {
              throw analysisError;
            }
            logWarn(
              "Inline analysis failed — continuing without pre-analysis data:",
              analysisError.message,
            );
            this.lastAnalysis = null;
          }
        } else {
          logDebug("ImageDescriberAnalyser not available — skipping analysis");
        }

        // Stage 4: Preparing
        this.showProgress("PREPARING");

        // Switch to output UI (Phase 2B.2)
        this.showOutputUI();
        this._focusCancelAfterOutputSwitch();

        // Build prompts
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt();

        logDebug("Prompts ready", {
          systemLength: systemPrompt.length,
          userLength: userPrompt.length,
        });

        // Create or get OpenRouter Embed instance
        const embed = this.getOrCreateEmbed();

        // Update system prompt
        embed.systemPrompt = systemPrompt;

        // ── Layer 2: deterministic vision re-check (load-bearing) ──────────
        // The population gate is filter-at-population only; bypass routes
        // (show-all-models, restored preference, direct callers) can leave a
        // non-vision model selected. Re-check the model ACTUALLY about to be
        // used (embed.model — the embed is cached, so this is the real send
        // target) before any image leaves the browser. Refuse loudly rather
        // than silently confabulate. Cloud path only — local generators never
        // reach this code.
        const modelInUse = embed.model || this.getSelectedModel();
        if (!this.isModelVisionCapable(modelInUse)) {
          logWarn(
            "Vision re-check FAILED — refusing to send image to non-vision model:",
            modelInUse,
          );
          this.hideProgress(false);
          this.showError(
            "Selected model cannot process images — choose a vision-capable model.",
          );
          this.showStatus(
            "Generation stopped: selected model cannot process images",
            "error",
          );
          // No announceStatus here. showError() above already raises a toast, and
          // the notification container is aria-live="polite", so this said the
          // same thing again — measured on a real NVDA listen 3 August 2026 as
          // THREE utterances for one event.
          //
          // Worth recording why the gate did not catch it: the two wordings
          // differed only in punctuation ("images — choose" against
          // "images. Choose"), so neither string contained the other and the
          // duplicate detector — which matches by equality or containment — saw
          // two legitimate messages. This is the "duplicates that reword" blind
          // spot named in the a11y skill reference, and it is the first live
          // example of it. A human listen remains the only thing that finds it.
          return; // finally{} resets isGenerating / abortController / buttons
        }

        // Attach the image (compression happens here for large files)
        await embed.attachFile(this.currentFile);

        // Stage 4: Generating
        this.showProgress("GENERATING");

        // Reasoning models (e.g. gpt-5-pro) can think for minutes before any
        // visible text arrives. Reset the per-run reasoning flags, and if this
        // model reasons, set the reasoning-aware message up front so the wait
        // never reads as a crash — even if no heartbeat events arrive.
        this._reasoningAnnounced = false;
        this._reasoningPhaseActive = false;
        const isReasoningModel = this._isReasoningModel(modelInUse);
        if (isReasoningModel) {
          this._enterReasoningState();
        }

        // Check reduced motion preference
        const useStreaming = !this.prefersReducedMotion();

        // Show output section BEFORE streaming
        this.showOutputSection();

        let response;

        if (useStreaming) {
          logInfo("Using streaming mode");
          // Follow-mode: make output a scroll container + show thinking dots.
          // The embed's own scrollToBottom() will keep tracking the latest
          // content after each injectContent() once the box is scrollable.
          // preWrap: false — the embed injects rendered HTML, not raw text.
          this._prepareStreamingOutput({ preWrap: false });
          // Track the reasoning→writing transition: the first heartbeat keeps
          // the reasoning state alive; the first real TEXT chunk ends it.
          let firstTextChunkSeen = false;
          response = await embed.sendStreamingRequest({
            userPrompt: userPrompt,
            onReasoning: (info) => {
              logDebug("Reasoning heartbeat", info);
              if (!firstTextChunkSeen) this._enterReasoningState();
            },
            onChunk: (chunk) => {
              if (!firstTextChunkSeen && chunk && chunk.text) {
                firstTextChunkSeen = true;
                this._exitReasoningState();
              }
              logDebug("Chunk received", { length: chunk.text?.length });
            },
            onComplete: (resp) => {
              logInfo("Streaming complete");
            },
            onError: (error) => {
              logError("Streaming error:", error);
            },
          });
        } else {
          logInfo("Using non-streaming mode (reduced motion)");
          response = await embed.sendRequest(userPrompt);
        }

        // Store raw markdown for plain text copying (preserves original markdown with H1)
        this.lastRawOutput = response.text;

        // ── Belt: never announce success on empty output (cloud path) ──────
        // The azure-responses adapter now throws on a completed-but-empty or
        // incomplete response (reasoning exhausted the token budget), so the
        // catch below normally handles that case. This defends every cloud
        // path: if the model returned no usable text for ANY reason, fail
        // loudly here rather than running verification and reporting
        // "Description generated successfully" on nothing.
        if (
          typeof this.lastRawOutput !== "string" ||
          this.lastRawOutput.trim() === ""
        ) {
          logWarn("Cloud generation returned empty output — failing loudly");
          this.hideProgress(false);
          const emptyMsg =
            "The model returned an empty description — it may have run out of token budget. Try raising max tokens or a different model.";
          this.showStatus(emptyMsg, "error");
          this.announceStatus(emptyMsg);
          return;
        }

        // Reasoning Disclosure: show the model's own summary of its reasoning,
        // when it returned one. response.reasoning is populated by core on both
        // the streaming and reduced-motion paths. Reasoning models only; the
        // component renders nothing when the summary is absent, so non-reasoning
        // models leave no panel behind.
        if (
          isReasoningModel &&
          this._reasoningDisclosure &&
          typeof response.reasoning === "string" &&
          response.reasoning.trim() !== ""
        ) {
          this._reasoningDisclosure.setReasoning(response.reasoning);
        }

        // Apply MathJax typesetting before storing HTML
        // This converts LaTeX notation ($...$, $$...$$) into rendered mathematics
        await this.typesetMathJax(this.elements.output);

        // Store original HTML before heading adjustment (Phase 2B.3)
        // This preserves H1 headings AND rendered MathJax for Copy Formatted and Copy HTML
        this.lastRawHTML = this.elements.output.innerHTML;

        // Adjust heading levels in rendered output for accessibility (Phase 2B.3)
        // This shifts all headings down by 2 (H1→H3, H2→H4, etc.) in the displayed HTML
        // to maintain proper hierarchy after the H2 "Generated Description" heading
        this.adjustHeadingLevels(this.elements.output);

        // Unwrap <p> tags inside list items to prevent loose-list spacing issues
        this.unwrapLooseListItems(this.elements.output);

        // Extract and apply alt text to images (Phase 2E)
        this.extractAndApplyAltText();

        // ── Layer 2: log-only strip telemetry (observability, never blocks) ──
        // `response`, `systemPrompt`, `userPrompt`, `modelInUse` all in scope.
        this._checkImageStripTelemetry(
          response,
          systemPrompt,
          userPrompt,
          modelInUse,
          "cloud",
        );

        // ── Visual Verification Pass (conditional) ──────────────────
        let verificationResult = null;

        if (this.isVerificationEnabled()) {
          this.showProgress("VERIFYING");

          try {
            verificationResult = await this.runVerification(this.lastRawOutput);
            this.displayVerificationResults(verificationResult);
          } catch (verifyError) {
            // Verification failure is non-fatal — the description is still valid
            this.handleVerificationError(verifyError);
            verificationResult = {
              text: null,
              hasCorrections: false,
              timeMs: 0,
              error: verifyError.message,
              model: this.getVerificationModel(),
            };
          }
        } else {
          // Clear any previous verification results
          this.clearVerification();
        }

        // Stage: Finalising
        this.showProgress("FINALISING");

        // Brief delay to show final stage
        await new Promise((r) => setTimeout(r, 200));

        // Get final elapsed time before hiding progress
        const finalTime = this.getElapsedSeconds();

        // Hide progress and show completion time
        this.hideProgress(true); // true = show completion time

        // Show success status with time
        this.showStatus(
          `Description generated successfully in ${this.formatElapsedTime(
            finalTime,
          )}!`,
          "success",
        );

        // Announce to screen reader
        this.announceStatus(
          `Image description generated successfully in ${this.formatElapsedTime(
            finalTime,
          )}`,
        );

        logInfo("Generation complete in", this.formatElapsedTime(finalTime));

        // Stage 5: Get selected model details for debug panel
        const selectedModel = this.getSelectedModel();
        const modelDetails = this.getSelectedModelDetails();
        const costBreakdown = this.getCostBreakdown();

        // Update debug panel with generation details (Phase 2C + Stage 5)
        this.updateDebugPanel({
          model: selectedModel,
          selectedModelName: modelDetails?.name || selectedModel,
          selectedModelCost:
            costBreakdown?.calculated?.formatted || "Not available",
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          systemPrompt: systemPrompt,
          userPrompt: userPrompt,
          useStreaming: useStreaming,
          compression: embed.currentFileAnalysis?.compressionMetrics,
          response: response,
          estimatedCost: this.calculateEstimatedCost(response),
        });

        // Update verification debug info
        this.updateVerificationDebug(verificationResult);
      } catch (error) {
        // Hide progress on error (don't show completion time)
        this.hideProgress(false);

        // Check if it was a cancellation
        if (error.name === "AbortError") {
          logInfo("Generation was cancelled");
          return;
        }

        logError("Generation failed:", error);
        // ONE sentence, THREE surfaces. showError writes the visible status
        // (#imgdesc-status) and raises the toast, and the toast is what speaks —
        // it announces on the assertive channel through accessibilityHelpers.
        //
        // The separate showStatus("Generation failed", "error") that used to sit
        // on the next line has been REMOVED, and must not come back as a tidy-up.
        // It ran after showError and overwrote the visible text, so a sighted
        // user read four words while the toast and its announcement carried the
        // raw provider string — the HTTP code and the JSON body. The person who
        // most needs plain language was getting the rawest version of it.
        //
        // Nothing is added here to announce. #imgdesc-status is deliberately not
        // a live region (see the comment above it in tools.html: it measured
        // notRendered because its container is display:none until there is
        // output), and a second announcement beside the toast's would speak the
        // same failure twice — the defect Chat's stage 13 spent three commits
        // removing.
        this.showError(composeGenerationErrorText(error));
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.updateButtonStates();
      }
    },

    /**
     * Generate image description locally using FastVLM (Phase 13C-1)
     * Non-streaming — full result displayed on completion.
     * Streaming support will be added in Phase 13C-2.
     */
    async generateLocally() {
      if (this.isGenerating) {
        logWarn("Generation already in progress");
        return;
      }

      if (!this.currentFile || !this.currentBase64) {
        this.showError("Please upload an image first.");
        return;
      }

      // Hide output accuracy warning at start of any generation (Phase 14E)
      if (this.elements.outputAccuracyWarning) {
        this.elements.outputAccuracyWarning.hidden = true;
      }

      // Route to Qwen3.5 path if selected (Phase 14E)
      const localModel = this.elements.localModelSelect
        ? this.elements.localModelSelect.value
        : "fastvlm";

      if (localModel === "lfm2vl") {
        return this.generateLocallyLfm2Vl();
      }

      if (localModel === "qwen35") {
        return this.generateLocallyQwen();
      }

      // Check gateway availability
      const gateway =
        typeof window.ImageDescriberAnalyserTransformers !== "undefined"
          ? window.ImageDescriberAnalyserTransformers
          : null;

      if (!gateway || typeof gateway.generateLocalDescription !== "function") {
        this.showError(
          "Local generation is not available. The Transformers.js gateway is not loaded.",
        );
        return;
      }

      logInfo("Starting local generation with FastVLM...");
      this.isGenerating = true;
      this.lastGenerationSource = "local";

      // Hide profile suggestion banner during generation
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;

      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController();
        this.updateButtonStates();

        // Stage: Loading model
        // (shows download progress on first use, fast on subsequent uses)
        this.showProgress("LOADING_MODEL");
        this._resetReasoningDisclosure();

        // Check if FastVLM is already loaded — skip loading stage if so
        const currentStatus = gateway.getFastVLMStatus();
        if (currentStatus === "ready") {
          logDebug("FastVLM already loaded — skipping load stage");
        } else {
          logInfo("FastVLM status:", currentStatus, "— loading model...");
        }

        // Check for cancellation
        if (this.abortController?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Stage: Generating
        this.showProgress("GENERATING_LOCAL");

        // Switch to output UI (reuse existing layout switching)
        this.showOutputUI();
        this.showOutputSection();
        this._focusCancelAfterOutputSwitch();

        // Clear previous output
        if (this.elements.output) {
          this.elements.output.innerHTML = "";
        }

        // Get the preview image element for the gateway
        const previewImg = this.elements.preview?.querySelector("img");
        if (!previewImg) {
          throw new Error(
            "No preview image available. Please re-upload your image.",
          );
        }

        // Build local prompt — bare instruction only (Phase 13F, simplified from 13D)
        const promptText = this.buildLocalPrompt();
        logDebug("Local prompt built", { length: promptText.length, prompt: promptText });

        // Determine streaming mode based on reduced motion preference
        const useStreaming = !this.prefersReducedMotion();
        let result;

        if (useStreaming) {
          // Streaming mode: tokens render progressively
          logInfo("Using streaming mode for local generation");

          // Accumulator for raw text (used for final render + copy operations)
          let accumulatedText = "";
          let tokenCount = 0;

          // Prepare output area for streaming — follow-mode adds thinking
          // indicator + scrollable class; otherwise just clears the box.
          this._prepareStreamingOutput();

          // Track first token for progress update
          let firstTokenReceived = false;

          result = await gateway.generateLocalDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
            onChunk: (tokenText) => {
              // Update progress message on first token
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                if (this.elements.progressStage) {
                  const iconHtml =
                    typeof getIcon === "function"
                      ? getIcon("aiSparkle")
                      : '<span aria-hidden="true">&#10024;</span>';
                  this.elements.progressStage.innerHTML = `${iconHtml} Generating description...`;
                }
              }

              // Accumulate text
              accumulatedText += tokenText;
              tokenCount++;

              // Render + follow camera (no-op scroll outside follow-mode)
              this._onStreamToken(accumulatedText);
            },
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "Local generation failed");
          }

          // Final render pass: convert streamed text to proper HTML paragraphs
          // Use result.text (authoritative) rather than accumulatedText
          const finalText = result.text || accumulatedText;

          // Remove the pre-wrap style used during streaming
          if (this.elements.output) {
            this.elements.output.style.whiteSpace = "";

            this.elements.output.innerHTML = this._renderMarkdown(finalText);
          }

          // Store raw output for copy operations
          this.lastRawOutput = finalText;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";

          logInfo(
            `Streaming complete: ${tokenCount} tokens, ${finalText.length} chars`,
          );
        } else {
          // Non-streaming mode (prefers-reduced-motion) — existing 13C-1 path
          logInfo(
            "Using non-streaming mode for local generation (reduced motion)",
          );

          result = await gateway.generateLocalDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "Local generation failed");
          }

          // Render output as markdown
          if (this.elements.output) {
            this.elements.output.innerHTML = this._renderMarkdown(result.text);
          }

          // Store raw output for copy operations
          this.lastRawOutput = result.text;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";
        }

        // Append analysis reference data below AI output (Phase 14H)
        this._appendAnalysisReference();

        // Append educational context below analysis reference (Phase 14I)
        this._appendEducationalContext();

        // Adjust headings for page hierarchy and unwrap loose list items (same as cloud path)
        this.adjustHeadingLevels(this.elements.output);
        this.unwrapLooseListItems(this.elements.output);

        // Stage: Finalising
        this.showProgress("FINALISING_LOCAL");
        await new Promise((r) => setTimeout(r, 200));

        // Hide progress and show completion time
        this.hideProgress(true);

        // Show success status
        const durationStr = (result.duration / 1000).toFixed(1) + "s";
        this.showStatus(
          `Description generated locally in ${durationStr} (FastVLM)`,
          "success",
        );

        // Announce to screen reader
        this.announceStatus(
          `Image description generated locally in ${durationStr} using FastVLM`,
        );

        logInfo(
          "Local generation complete in",
          durationStr,
          "(" + result.text.length + " chars)",
        );

        // Update debug panel with local generation details
        this.updateDebugPanel({
          model: result.model || "FastVLM 0.5B",
          selectedModelName: "FastVLM 0.5B (Local)",
          selectedModelCost: "Free (local)",
          temperature: "N/A (greedy)",
          maxTokens: 512,
          systemPrompt: "(none — local model)",
          userPrompt: promptText,
          useStreaming: useStreaming,
          compression: null,
          response: {
            text: result.text,
            metadata: {
              tokens: null,
            },
          },
          estimatedCost: "Free",
          generationSource: "local",
          localDuration: durationStr,
        });

        // Clear verification (not applicable for local)
        this.clearVerification();
      } catch (error) {
        // Hide progress on error
        this.hideProgress(false);

        if (error.name === "AbortError") {
          logInfo("Local generation was cancelled");
          return;
        }

        logError("Local generation failed:", error);
        this.showError(`Local generation failed: ${error.message}`);
        this.showStatus("Local generation failed", "error");
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.updateButtonStates();
      }
    },

    /**
     * Generate a structured description using Qwen3.5-0.8B (Phase 14E).
     * Supports streaming (raw text during generation, markdown render on
     * completion) and non-streaming (prefers-reduced-motion fallback).
     * Output rendered as markdown (same as cloud path).
     */
    async generateLocallyQwen() {
      // Check gateway availability
      const gateway =
        typeof window.ImageDescriberAnalyserTransformers !== "undefined"
          ? window.ImageDescriberAnalyserTransformers
          : null;

      if (!gateway || typeof gateway.generateQwenDescription !== "function") {
        this.showError(
          "Qwen3.5 generation is not available. The Transformers.js gateway is not loaded.",
        );
        return;
      }

      logInfo("Starting local generation with Qwen3.5...");
      this.isGenerating = true;
      this.lastGenerationSource = "local";

      // Hide profile suggestion banner during generation
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;

      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController();
        this.updateButtonStates();

        // Stage: Loading model
        this.showProgress("LOADING_QWEN");
        this._resetReasoningDisclosure();

        // Check if Qwen3.5 is already loaded — skip loading stage if so
        const currentStatus = gateway.getQwenStatus();
        if (currentStatus === "ready") {
          logDebug("Qwen3.5 already loaded — skipping load stage");
        } else {
          logInfo("Qwen3.5 status:", currentStatus, "— loading model...");
        }

        // Check for cancellation
        if (this.abortController?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Stage: Generating
        this.showProgress("GENERATING_QWEN");

        // Switch to output UI
        this.showOutputUI();
        this.showOutputSection();
        this._focusCancelAfterOutputSwitch();

        // Clear previous output
        if (this.elements.output) {
          this.elements.output.innerHTML = "";
        }

        // Get the preview image element for the gateway
        const previewImg = this.elements.preview?.querySelector("img");
        if (!previewImg) {
          throw new Error(
            "No preview image available. Please re-upload your image.",
          );
        }

        // Build Qwen prompt — bare structured instruction only (Phase 14A decision gate)
        const promptText = this.buildQwenPrompt();
        logDebug("Qwen prompt built", { length: promptText.length });

        // Determine streaming mode based on reduced motion preference
        const useStreaming = !this.prefersReducedMotion();
        let result;

        if (useStreaming) {
          // Streaming mode: tokens render progressively as raw text,
          // then final markdown render on completion
          logInfo("Using streaming mode for Qwen3.5 generation");

          // Accumulator for raw markdown (used for final render + copy operations)
          let accumulatedText = "";
          let tokenCount = 0;

          // Prepare output area for streaming — follow-mode adds thinking
          // indicator + scrollable class; otherwise just clears the box.
          this._prepareStreamingOutput();

          // Track first token for progress update
          let firstTokenReceived = false;

          result = await gateway.generateQwenDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
            onChunk: (tokenText) => {
              // Update progress message on first token
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                if (this.elements.progressStage) {
                  const iconHtml =
                    typeof getIcon === "function"
                      ? getIcon("aiSparkle")
                      : '<span aria-hidden="true">&#10024;</span>';
                  this.elements.progressStage.innerHTML = `${iconHtml} Generating description\u2026`;
                }
              }

              // Accumulate text
              accumulatedText += tokenText;
              tokenCount++;

              // Render + follow camera (no-op scroll outside follow-mode)
              this._onStreamToken(accumulatedText);
            },
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "Qwen3.5 generation failed");
          }

          // Final render pass: convert streamed markdown to rendered HTML
          // Use result.text (authoritative) rather than accumulatedText
          const finalText = result.text || accumulatedText;

          // Remove the pre-wrap style used during streaming
          if (this.elements.output) {
            this.elements.output.style.whiteSpace = "";

            this.elements.output.innerHTML = this._renderMarkdown(finalText);
          }

          // Store raw output for copy operations
          this.lastRawOutput = finalText;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";

          logInfo(
            `Qwen3.5 streaming complete: ${tokenCount} tokens, ${finalText.length} chars`,
          );
        } else {
          // Non-streaming mode (prefers-reduced-motion)
          logInfo(
            "Using non-streaming mode for Qwen3.5 generation (reduced motion)",
          );

          result = await gateway.generateQwenDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "Qwen3.5 generation failed");
          }

          // Render output as markdown
          if (this.elements.output) {
            this.elements.output.innerHTML = this._renderMarkdown(result.text);
          }

          // Store raw output for copy operations
          this.lastRawOutput = result.text;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";
        }

        // Append analysis reference data below AI output (Phase 14H)
        this._appendAnalysisReference();

        // Append educational context below analysis reference (Phase 14I)
        this._appendEducationalContext();

        // Adjust headings for page hierarchy (same as cloud path)
        this.adjustHeadingLevels(this.elements.output);
        this.unwrapLooseListItems(this.elements.output);

        // Stage: Finalising
        this.showProgress("FINALISING_QWEN");
        await new Promise((r) => setTimeout(r, 200));

        // Hide progress and show completion time
        this.hideProgress(true);

        // Show accuracy warning (Phase 14E)
        if (this.elements.outputAccuracyWarning) {
          this.elements.outputAccuracyWarning.hidden = false;
        }

        // Show success status
        const durationStr = (result.duration / 1000).toFixed(1) + "s";
        this.showStatus(
          `Description generated locally in ${durationStr} (Qwen3.5)`,
          "success",
        );

        // Announce to screen reader
        this.announceStatus(
          `Image description generated locally in ${durationStr} using Qwen3.5`,
        );

        logInfo(
          "Qwen3.5 generation complete in",
          durationStr,
          "(" + result.text.length + " chars)",
        );

        // Update debug panel with Qwen3.5 generation details
        this.updateDebugPanel({
          model: "Qwen3.5-0.8B",
          selectedModelName: "Qwen3.5-0.8B (Local)",
          selectedModelCost: "Free (local)",
          temperature: "N/A (greedy)",
          maxTokens: 512,
          systemPrompt: "(none — local model)",
          userPrompt: promptText,
          useStreaming: useStreaming,
          compression: null,
          response: {
            text: result.text,
            metadata: {
              tokens: null,
            },
          },
          estimatedCost: "Free",
          generationSource: "local",
          localDuration: durationStr,
        });

        // Clear verification (not applicable for local)
        this.clearVerification();
      } catch (error) {
        // Hide progress on error
        this.hideProgress(false);

        if (error.name === "AbortError") {
          logInfo("Qwen3.5 generation was cancelled");
          return;
        }

        logError("Qwen3.5 generation failed:", error);
        this.showError(`Qwen3.5 generation failed: ${error.message}`);
        this.showStatus("Qwen3.5 generation failed", "error");
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.updateButtonStates();
      }
    },

    /**
     * Generate an image description using LFM2-VL 450M (Phase 15A).
     * Follows the FastVLM path: free-form prose, _renderPlainTextAsHtml().
     */
    async generateLocallyLfm2Vl() {
      // Check gateway availability
      const gateway =
        typeof window.ImageDescriberAnalyserTransformers !== "undefined"
          ? window.ImageDescriberAnalyserTransformers
          : null;

      if (!gateway || typeof gateway.generateLfm2VlDescription !== "function") {
        this.showError(
          "LFM2-VL generation is not available. The Transformers.js gateway is not loaded.",
        );
        return;
      }

      logInfo("Starting local generation with LFM2-VL...");
      this.isGenerating = true;
      this.lastGenerationSource = "local";

      // Hide profile suggestion banner during generation
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;

      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController();
        this.updateButtonStates();

        // Stage: Loading model
        this.showProgress("LOADING_LFM2VL");
        this._resetReasoningDisclosure();

        // Check if LFM2-VL is already loaded — skip loading stage if so
        const currentStatus = gateway.getLfm2VlStatus();
        if (currentStatus === "ready") {
          logDebug("LFM2-VL already loaded — skipping load stage");
        } else {
          logInfo("LFM2-VL status:", currentStatus, "— loading model...");
        }

        // Check for cancellation
        if (this.abortController?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Stage: Generating
        this.showProgress("GENERATING_LFM2VL");

        // Switch to output UI
        this.showOutputUI();
        this.showOutputSection();
        this._focusCancelAfterOutputSwitch();

        // Clear previous output
        if (this.elements.output) {
          this.elements.output.innerHTML = "";
        }

        // Get the preview image element for the gateway
        const previewImg = this.elements.preview?.querySelector("img");
        if (!previewImg) {
          throw new Error(
            "No preview image available. Please re-upload your image.",
          );
        }

        // Build LFM2-VL prompt — bare instruction only (Phase 15A)
        const promptText = this.buildLfm2VlPrompt();
        logDebug("LFM2-VL prompt built", { length: promptText.length, prompt: promptText });

        // Determine streaming mode based on reduced motion preference
        const useStreaming = !this.prefersReducedMotion();
        let result;

        if (useStreaming) {
          // Streaming mode: tokens render progressively
          logInfo("Using streaming mode for LFM2-VL generation");

          // Accumulator for raw text (used for final render + copy operations)
          let accumulatedText = "";
          let tokenCount = 0;

          // Prepare output area for streaming — follow-mode adds thinking
          // indicator + scrollable class; otherwise just clears the box.
          this._prepareStreamingOutput();

          // Track first token for progress update
          let firstTokenReceived = false;

          result = await gateway.generateLfm2VlDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
            onChunk: (tokenText) => {
              // Update progress message on first token
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                if (this.elements.progressStage) {
                  const iconHtml =
                    typeof getIcon === "function"
                      ? getIcon("aiSparkle")
                      : '<span aria-hidden="true">&#10024;</span>';
                  this.elements.progressStage.innerHTML = `${iconHtml} Generating description\u2026`;
                }
              }

              // Accumulate text
              accumulatedText += tokenText;
              tokenCount++;

              // Render + follow camera (no-op scroll outside follow-mode)
              this._onStreamToken(accumulatedText);
            },
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "LFM2-VL generation failed");
          }

          // Final render pass: convert streamed text to proper HTML paragraphs
          // Use result.text (authoritative) rather than accumulatedText
          const finalText = result.text || accumulatedText;

          // Remove the pre-wrap style used during streaming
          if (this.elements.output) {
            this.elements.output.style.whiteSpace = "";

            this.elements.output.innerHTML = this._renderMarkdown(finalText);
          }

          // Store raw output for copy operations
          this.lastRawOutput = finalText;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";

          logInfo(
            `Streaming complete: ${tokenCount} tokens, ${finalText.length} chars`,
          );
        } else {
          // Non-streaming mode (prefers-reduced-motion)
          logInfo(
            "Using non-streaming mode for LFM2-VL generation (reduced motion)",
          );

          result = await gateway.generateLfm2VlDescription(previewImg, {
            prompt: promptText,
            maxTokens: 512,
          });

          // Check for cancellation after inference
          if (this.abortController?.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          // Check result
          if (result.status === "error") {
            throw new Error(result.error || "LFM2-VL generation failed");
          }

          // Render output as markdown
          if (this.elements.output) {
            this.elements.output.innerHTML = this._renderMarkdown(result.text);
          }

          // Store raw output for copy operations
          this.lastRawOutput = result.text;
          this.lastRawHTML = this.elements.output
            ? this.elements.output.innerHTML
            : "";
        }

        // Append analysis reference data below AI output (Phase 14H)
        this._appendAnalysisReference();

        // Append educational context below analysis reference (Phase 14I)
        this._appendEducationalContext();

        // Adjust headings for page hierarchy and unwrap loose list items (same as cloud path)
        this.adjustHeadingLevels(this.elements.output);
        this.unwrapLooseListItems(this.elements.output);

        // Stage: Finalising
        this.showProgress("FINALISING_LFM2VL");
        await new Promise((r) => setTimeout(r, 200));

        // Hide progress and show completion time
        this.hideProgress(true);

        // Show success status
        const durationStr = (result.duration / 1000).toFixed(1) + "s";
        this.showStatus(
          `Description generated locally in ${durationStr} (LFM2-VL)`,
          "success",
        );

        // Announce to screen reader
        this.announceStatus(
          `Image description generated locally in ${durationStr} using LFM2-VL`,
        );

        logInfo(
          "LFM2-VL generation complete in",
          durationStr,
          "(" + result.text.length + " chars)",
        );

        // Update debug panel with local generation details
        this.updateDebugPanel({
          model: result.model || "LFM2-VL 450M",
          selectedModelName: "LFM2-VL 450M (Local)",
          selectedModelCost: "Free (local)",
          temperature: "N/A (greedy)",
          maxTokens: 512,
          systemPrompt: "(none — local model)",
          userPrompt: promptText,
          useStreaming: useStreaming,
          compression: null,
          response: {
            text: result.text,
            metadata: {
              tokens: null,
            },
          },
          estimatedCost: "Free",
          generationSource: "local",
          localDuration: durationStr,
        });

        // Clear verification (not applicable for local)
        this.clearVerification();
      } catch (error) {
        // Hide progress on error
        this.hideProgress(false);

        if (error.name === "AbortError") {
          logInfo("LFM2-VL generation was cancelled");
          return;
        }

        logError("LFM2-VL generation failed:", error);
        this.showError(`LFM2-VL generation failed: ${error.message}`);
        this.showStatus("LFM2-VL generation failed", "error");
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.updateButtonStates();
      }
    },

    /**
     * Render markdown text to HTML using markdown-it (matching OpenRouterEmbed config).
     * Falls back to _renderPlainTextAsHtml if markdown-it is unavailable.
     * @param {string} text — raw markdown text from local model
     * @returns {string} rendered HTML
     * @private
     */
    _renderMarkdown(text) {
      if (!text || !text.trim()) {
        return "<p><em>No description generated.</em></p>";
      }

      if (window.markdownit) {
        if (!this._markdownItInstance) {
          this._markdownItInstance = window.markdownit({
            html: true,
            breaks: true,
            linkify: true,
          });
        }
        return this._markdownItInstance.render(text);
      }

      return this._renderPlainTextAsHtml(text);
    },

    /**
     * Convert plain text to HTML paragraphs for display (Phase 13C-1)
     * Splits on double line breaks for paragraphs, preserves single breaks.
     * @param {string} text — raw text from FastVLM
     * @returns {string} HTML string with <p> elements
     * @private
     */
    _renderPlainTextAsHtml(text) {
      if (!text || !text.trim()) {
        return "<p><em>No description generated.</em></p>";
      }

      // Split on double line breaks (paragraph boundaries)
      const paragraphs = text.split(/\n\s*\n/);

      return paragraphs
        .map((para) => {
          const trimmed = para.trim();
          if (!trimmed) return "";

          // Escape HTML entities for safety
          const escaped = trimmed
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          // Preserve single line breaks within a paragraph
          const withBreaks = escaped.replace(/\n/g, "<br>");

          return "<p>" + withBreaks + "</p>";
        })
        .filter(Boolean)
        .join("\n");
    },

    /**
     * Get or create OpenRouter Embed instance
     * @returns {OpenRouterEmbed}
     */
    getOrCreateEmbed() {
      if (this.embedInstance) {
        return this.embedInstance;
      }

      if (!window.OpenRouterEmbed) {
        throw new Error(
          "OpenRouterEmbed not available. Ensure embed scripts are loaded.",
        );
      }

      logInfo("Creating OpenRouter Embed instance with compression...");

      // Access config values via exposed _controllerConfig
      const cfg = this._controllerConfig || {};

      // Stage 5: Use selected model instead of config default
      const selectedModel = this.getSelectedModel();
      logInfo("Creating OpenRouter Embed with model:", selectedModel);

      // Build configuration object
      const embedConfig = {
        containerId: "imgdesc-output",

        // The embed makes its container an aria-live region with
        // aria-atomic="true" unless told otherwise, and it does so AT RUNTIME —
        // which is why setting aria-live="off" in tools.html alone did nothing.
        // Streamed output rewrites the container per token, so the region
        // re-read the entire growing description each time. Completion is
        // announced by announceStatus() and progress by the 20s keep-alive.
        announceContainer: false,
        model: selectedModel,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        showNotifications: true,
        showStreamingProgress: false, // Disabled - we have Phase 2A progress indicator
        progressStyle: "minimal", // Minimal style as fallback

        // COMPRESSION CONFIGURATION
        // Based on performance testing: 92.17 ms/KB latency
        // Enable automatic image compression for optimal performance
        enableCompression: true,
        compressionThreshold: 200 * 1024, // 200KB (images below this perform acceptably)
        compressionMaxWidth: 1200, // Max dimensions for AI analysis
        compressionMaxHeight: 900,
        compressionQuality: 0.7, // 70% JPEG quality (optimal from testing)

        // STAGE 2 TASK 2.6: Foundry provider configuration.
        // Reads the proxy URL from localStorage (key: 'foundryProxyUrl')
        // with a hardcoded fallback for the smoke test. Stage 3 will
        // replace the hardcoded fallback with a Set Up tool credential
        // entry that writes to the same localStorage key. The library
        // ignores this block entirely for OpenRouter-routed models —
        // it only matters when the selected model id starts with
        // `azure-openai/` or `azure-responses/` (the two Foundry surfaces,
        // both reading the shared `foundryProxyUrl` credential — Task 5c).
        providers: {
          "azure-openai": {
            proxyUrl:
              localStorage.getItem("foundryProxyUrl") ||
              "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev",
          },
          "azure-responses": {
            proxyUrl:
              localStorage.getItem("foundryProxyUrl") ||
              "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev",
          },
        },
      };

      // STAGE 7: Add retry configuration if handler available
      // Graceful degradation - only add if EmbedRetryHandler is loaded
      if (window.EmbedRetryHandler || window.EmbedRetryHandlerClass) {
        embedConfig.retry = {
          enabled: true,
          maxRetries: 3,
          baseDelay: 1000, // 1 second initial delay
          maxDelay: 10000, // 10 second maximum delay
          backoffMultiplier: 2, // Exponential: 1s, 2s, 4s, 8s...
          jitter: true, // Add randomness to prevent thundering herd
          retryableStatuses: [408, 429, 500, 502, 503, 504],
          onRetry: (attempt, delay, error) => {
            this.handleRetryAttempt(attempt, delay, error);
          },
        };
        logInfo("Retry configuration enabled (Stage 7)");
      } else {
        logDebug("EmbedRetryHandler not available - retry disabled");
      }

      // STAGE 7: Add health monitoring if monitor available
      // Graceful degradation - only add if EmbedHealthMonitor is loaded
      if (window.EmbedHealthMonitor || window.EmbedHealthMonitorClass) {
        embedConfig.health = {
          enabled: true,
          checkInterval: 60000, // Check every 60 seconds
          timeout: 5000, // 5 second timeout for health checks
          onStatusChange: (status) => {
            this.handleHealthStatusChange(status);
          },
        };
        logInfo("Health monitoring enabled (Stage 7)");
      } else {
        logDebug(
          "EmbedHealthMonitor not available - health monitoring disabled",
        );
      }

      this.embedInstance = new window.OpenRouterEmbed(embedConfig);

      logInfo("OpenRouter Embed instance created with compression enabled");

      // Show health indicator now that monitoring is active (Stage 7)
      if (this.elements.healthIndicator) {
        this.elements.healthIndicator.hidden = false;
        logDebug("Health indicator shown");
      }

      return this.embedInstance;
    },
  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("Generation pipeline methods loaded");
  } else {
    logError(
      "ImageDescriberController not found \u2014 generation methods not loaded",
    );
  }
})();
