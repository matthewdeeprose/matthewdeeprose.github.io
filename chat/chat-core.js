/**
 * Unified Chat Tool — Stage 3 step 5a-ii (rich-render wiring in postGeneration)
 *
 * Duplicates Local Chat's send path, scoped entirely to the Chat tool. This file
 * drives window.ChatState ONLY — it never calls any window.LocalChat* /
 * window.localChat* global and never touches window.LocalChatState.
 *
 * It reuses the single engine handle that chat/chat.js already built in
 * buildEngineHandle (stored on S.embed). Before each send it sets that embed's
 * instance properties for the turn — crucially embed.model = S.currentModel, the
 * FULL chosen id (local/…, an OpenRouter id like anthropic/…, or azure-openai/…),
 * which is what lets the embed route cross-provider. It does NOT construct a
 * second embed and does NOT re-prefix the model the way Local Chat does.
 *
 * Bubble creation is intentionally minimal and inline for this step; it reuses
 * Local Chat's CLASS names (local-chat-bubble, -user, -assistant, local-chat-typing)
 * so the richer messages module in step 3 can supersede it without a CSS change.
 *
 * Loads AFTER chat/chat.js so window.ChatState and the engine handle exist.
 *
 * @version 0.4.0 — step 5b-iii: standing Clear-conversation button + the
 *                   conversation-state UI seam (updateConversationUI) — the one
 *                   place conversation-dependent controls are enabled/disabled.
 *                   Today the seam owns exactly one control (the clear button);
 *                   parity controls (sliders, regenerate, history) hook in here
 *                   later instead of toggling inline.
 *                   step 5b-ii: wire persistence into the lifecycle — restore the
 *                   saved session (and show the restore banner) on init, and save
 *                   the session at the end of postGeneration so each completed
 *                   assistant turn (with its model + providerId) is persisted
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Tokens held back beyond the answer reservation, to absorb the estimator's
  // approximation and any slack in a copied/borrowed context limit. Tunable.
  const BUDGET_SAFETY_MARGIN = 512;
  // Answer-room reservation used only if the embed exposes no numeric max_tokens;
  // matches the embed's own default so behaviour stays consistent if it fires.
  const DEFAULT_ANSWER_RESERVATION = 2000;
  // Flat per-image token allowance added by applyTokenWindow for each image part
  // in the payload (Unified Chat attachments, checkpoint 1). Deliberately
  // CONSERVATIVE: real vision billing ranges from ~85 tokens (low detail) to
  // ~1.5k+ (high detail) depending on model and resolution, and the exact figure
  // is not known at window time. Over-estimating only trims the payload more
  // aggressively — it never causes an over-send — so a generous flat value keeps
  // an image-bearing turn from overflowing the context window. This lives in the
  // pure window function (not only the token estimator) so it still applies when
  // ChatBudgetTests inject their own estimate; it is additive and ZERO for
  // text-only threads, so those tests are unaffected.
  const IMAGE_TOKEN_ESTIMATE = 1600;

  // Default caption sent when a PDF is attached without a typed caption — the
  // embed core rejects an empty prompt, so a caption-less PDF send needs one.
  const DEFAULT_ATTACHMENT_CAPTION = "Please review the attached file";

  // Plain-language error text for the HTTP statuses the Foundry proxy actually
  // returns for a sign-in problem. Keyed by NUMERIC status; postError checks
  // `typeof error.status === "number"` BEFORE looking a key up here, because a
  // property access coerces its key to a string and a string "401" would
  // otherwise match this map exactly as a real 401 does.
  //
  // 403 DELIBERATELY DOES NOT SUGGEST SIGNING IN AGAIN. A 403 means the account
  // signed in successfully and is not permitted to use the service, so another
  // sign-in cannot change the outcome. Sending somebody round that loop — sign
  // out, sign in, fail identically — is worse than saying nothing, because it
  // costs them time and implies the fault is theirs to fix. Do not "improve"
  // this wording by adding a next step it does not have.
  const ERROR_TEXT_BY_STATUS = Object.freeze({
    401: "Your sign-in has expired. Sign in again to continue, then send your message.",
    403: "Your account is not permitted to use this service.",
    503: "The service could not check your sign-in just now. Please try again shortly.",
  });

  // The named Entra scope the Foundry providers ask for. Matches ENTRA_SCOPE_NAME
  // in openrouter-embed/providers/azure-openai-v1.js and -responses.js, and a key
  // of SCOPES in auth/entra-auth.js. One access token carries one audience, so
  // this must stay the Foundry scope and never be widened.
  const ENTRA_SCOPE_NAME = "foundry";

  // What a screen reader hears when the failure carries no status we recognise.
  // The bubble still shows the raw provider message (unchanged from before), but
  // that text can run to a full HTTP body and is not worth speaking — so the
  // announcement stays the short sentence the two call sites used to say.
  const GENERIC_ERROR_ANNOUNCEMENT = "Error generating response.";

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Capture the state OBJECT once at load; chat/chat.js creates it synchronously
  // before this file's IIFE runs. Everything inside (S.els, S.messages,
  // S.currentModel, S.embed) is read LIVE through S at call time, never cached
  // here, mirroring chat.js's own discipline.
  const S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-core.js",
    );
    return;
  }

  // Wire-once guard so init() stays idempotent (the static buttons persist; we
  // must not stack a second click/keydown listener on re-entry).
  let wired = false;

  // ── Draft stash (F2-13b) ───────────────────────────────────────────────────
  //
  // sendMessage clears the input twenty-odd lines before the request is issued,
  // and until now kept nothing recoverable — so a send that failed on an expired
  // sign-in silently lost whatever had been typed. A module variable would not
  // do, because the remedy for an expired sign-in is to sign in again and that
  // NAVIGATES THE PAGE AWAY to Microsoft, destroying every variable on it.
  // sessionStorage survives that round trip; nothing else available here does.
  //
  // The key is DERIVED from the state's own id prefix rather than hardcoded,
  // following the <idPrefix>-<purpose> convention the ChatState factory already
  // uses for SESSION_KEY ("chat-session") and ARCHIVE_KEY ("chat-history").
  // Chat's idPrefix is "chat", so this resolves to "chat-draft"; Local Chat is
  // built from the same factory with idPrefix "local-chat" and would resolve to
  // its own key, so the two tools can never share a draft. The fallback exists
  // only so a factory that stopped supplying idPrefix would still produce a
  // usable, non-colliding key rather than the string "undefined-draft".
  const DRAFT_KEY = (S.idPrefix || "chat") + "-draft";

  // ── Element caching ───────────────────────────────────────────────────────
  // Extend S.els with the step-1 message-area elements. chat.js::cacheElements
  // caches only the picker elements, so these keys are additive. We use S.elId()
  // because the ChatState factory's elId prefixes with "chat-", which matches the
  // step-1 HTML ids (chat-messages / chat-input / chat-send / chat-cancel /
  // chat-stats). messageList lands on els.messageList so S.setMessageListLive()
  // (which reads this.els.messageList) works.
  function cacheElements() {
    const els = S.els;
    els.messageList = document.getElementById(S.elId("messages"));
    els.input = document.getElementById(S.elId("input"));
    els.sendBtn = document.getElementById(S.elId("send"));
    els.cancelBtn = document.getElementById(S.elId("cancel"));
    els.clearBtn = document.getElementById(S.elId("clear"));
    els.exportBtn = document.getElementById(S.elId("export"));
    els.stats = document.getElementById(S.elId("stats"));
    // Visible-only draft token counter (Half 1, Stage A). Mirrors Local Chat's
    // plain-div counter — it is SEEN while typing but never a live region, so it
    // is not announced. Resolves to #chat-input-counter via the "chat-" prefix.
    els.inputCounter = document.getElementById(S.elId("input-counter"));
    // Optional system-prompt input — not present in step 1, so this resolves to
    // null and the per-send systemPrompt becomes undefined.
    els.systemInput = document.getElementById(S.elId("system"));
    // Generation-parameters panel (5c-i). Cached into the SAME S.els the shared
    // helpers read, so S.getTemperature()/S.getMaxTokens() see the live sliders.
    els.temperatureSlider = document.getElementById(S.elId("temperature"));
    els.temperatureValue = document.getElementById(S.elId("temperature-value"));
    els.temperatureDesc = document.getElementById(S.elId("temperature-desc"));
    els.topPSlider = document.getElementById(S.elId("top-p"));
    els.topPValue = document.getElementById(S.elId("top-p-value"));
    els.frequencyPenaltySlider = document.getElementById(S.elId("frequency-penalty"));
    els.frequencyPenaltyValue = document.getElementById(S.elId("frequency-penalty-value"));
    els.presencePenaltySlider = document.getElementById(S.elId("presence-penalty"));
    els.presencePenaltyValue = document.getElementById(S.elId("presence-penalty-value"));
    els.maxTokensSlider = document.getElementById(S.elId("max-tokens"));
    els.maxTokensValue = document.getElementById(S.elId("max-tokens-value"));
    els.maxTokensDesc = document.getElementById(S.elId("max-tokens-desc"));
    els.maxTokensNumber = document.getElementById(S.elId("max-tokens-number"));
    els.maxTokensPresets = Array.prototype.slice.call(document.querySelectorAll(".chat-token-preset"));
    // System-prompt preset select (5c-ii-b). Changing it fills the system box from
    // the shared S.SYSTEM_PRESETS map; "None (custom)" clears it. Wired in wire().
    els.presetSelect = document.getElementById(S.elId("preset-select"));
  }

  // ── Max-tokens range helpers ───────────────────────────────────────────────
  // The slider's own min/max/step is the single source of the range, so a future
  // model-aware ceiling only sets the slider max. Read S.els live (no cached alias).
  function maxTokenRange() {
    const s = S.els.maxTokensSlider;
    return {
      min: s ? parseInt(s.min, 10) : 128,
      max: s ? parseInt(s.max, 10) : 4096,
      step: s ? parseInt(s.step, 10) : 128,
    };
  }
  function clampSnapTokens(raw) {
    const r = maxTokenRange();
    let v = parseInt(raw, 10);
    if (isNaN(v))
      v =
        parseInt(S.els.maxTokensSlider ? S.els.maxTokensSlider.value : "1024", 10) ||
        1024;
    v = Math.max(r.min, Math.min(r.max, v));
    v = r.min + Math.round((v - r.min) / r.step) * r.step;
    return Math.max(r.min, Math.min(r.max, v));
  }
  // Single write path: clamp/snap once, then mirror to slider, number field, value
  // output and description. getMaxTokens() still reads the slider, so it stays the
  // authoritative source for the token budget.
  function setMaxTokens(raw) {
    const v = clampSnapTokens(raw);
    if (S.els.maxTokensSlider) S.els.maxTokensSlider.value = v;
    if (S.els.maxTokensNumber) S.els.maxTokensNumber.value = v;
    if (S.els.maxTokensValue) S.els.maxTokensValue.textContent = v;
    if (S.els.maxTokensDesc)
      S.els.maxTokensDesc.textContent = S.getMaxTokensDescription(v);
    return v;
  }

  // ── Bubble rendering (delegated to the step-3 messages module) ─────────────
  // chat/chat-messages.js loads AFTER this file and registers window.ChatMessages.
  // These thin wrappers keep the send-flow call sites unchanged while routing all
  // rendering through that module. They are only ever called at runtime (send
  // time), by which point window.ChatMessages is defined.

  function createUserBubble(text, index) {
    return window.ChatMessages.createUserBubble(text, index);
  }

  function createAssistantBubble() {
    return window.ChatMessages.createAssistantBubble();
  }

  function addTypingIndicator(bubble) {
    window.ChatMessages.addTypingIndicator(bubble);
  }

  function removeTypingIndicator(bubble) {
    window.ChatMessages.removeTypingIndicator(bubble);
  }

  function scrollMessagesToBottom() {
    window.ChatMessages.scrollMessagesToBottom();
  }

  // ── Send/cancel UI state ───────────────────────────────────────────────────

  function disableSend() {
    const els = S.els;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.cancelBtn) els.cancelBtn.hidden = false;
    if (els.input) els.input.disabled = true;
  }

  function enableSend() {
    const els = S.els;
    if (els.sendBtn) els.sendBtn.disabled = false;
    if (els.cancelBtn) els.cancelBtn.hidden = true;
    if (els.input) {
      els.input.disabled = false;
      els.input.focus();
    }
  }

  // Trim notice — written to the visible stats region (#chat-stats), an <output>
  // with implicit role="status"/aria-live="polite", so it is seen AND announced
  // without colliding with the shared "Generating response." cue. Wording makes
  // clear the model won't see older turns; nothing is deleted.
  function announceTrim(dropped) {
    if (!S.els.stats) return;
    S.els.stats.textContent =
      dropped > 0
        ? "Older messages aren't sent to this model, to fit its context limit."
        : "";
  }

  // Pure composer for the post-turn token readout (Stage D; honesty rule Stage
  // D-bis). Turns a completed turn's usage object into a short, British-spelt
  // line, reading the OpenAI-style keys prompt_tokens / completion_tokens /
  // total_tokens (both OpenRouter and the Azure/Foundry proxy return them).
  //
  // The two providers hand back usage of different QUALITY, so the line hedges
  // to match:
  //   • TRUSTWORTHY (Foundry-style real usage) — prompt AND completion are both
  //     present, both integers, and prompt > 0. Only then is the in/out split
  //     shown, e.g. "83 tokens (71 in, 12 out)" (total = total_tokens when an
  //     integer, else prompt + completion).
  //   • OTHERWISE — the OpenRouter STREAMING path returns a fractional chars/4
  //     estimate with prompt_tokens 0 (e.g. completion 7.25). Splitting that
  //     would print a misleading "0 in", so instead show one hedged, rounded
  //     figure: "about {n} tokens" (n = total_tokens, else completion_tokens,
  //     else prompt + completion). Never an in/out split, never a "0 in".
  // Returns "" when usage is falsy or carries no usable positive number, so the
  // caller can leave the send-time trim notice untouched rather than blanking it.
  // Does NOT compute tokens-per-second — that timing readout is a separate track.
  function composeTokenReadout(usage) {
    if (!usage || typeof usage !== "object") return "";
    function num(v) {
      return typeof v === "number" && isFinite(v) ? v : null;
    }
    const promptTokens = num(usage.prompt_tokens);
    const completionTokens = num(usage.completion_tokens);
    const totalTokens = num(usage.total_tokens);
    // No usable numbers at all.
    if (promptTokens === null && completionTokens === null && totalTokens === null) {
      return "";
    }
    // Trustworthy: real integer usage with a genuine prompt count → in/out split.
    if (
      promptTokens !== null &&
      completionTokens !== null &&
      Number.isInteger(promptTokens) &&
      Number.isInteger(completionTokens) &&
      promptTokens > 0
    ) {
      const total = Number.isInteger(totalTokens)
        ? totalTokens
        : promptTokens + completionTokens;
      return (
        total.toLocaleString() +
        " tokens (" +
        promptTokens.toLocaleString() +
        " in, " +
        completionTokens.toLocaleString() +
        " out)"
      );
    }
    // Estimate: one hedged, rounded figure — never a split, never a "0 in".
    const basis =
      totalTokens !== null
        ? totalTokens
        : completionTokens !== null
          ? completionTokens
          : (promptTokens || 0) + (completionTokens || 0);
    const n = Math.round(basis);
    if (!(n > 0)) return "";
    return "about " + n.toLocaleString() + " tokens";
  }

  // ── Input token counter (visible-only, Stage A) ────────────────────────────
  // Mirrors Local Chat's updateInputTokenCount, but cross-provider: the context
  // limit is read from window.Chat.getContextLimit(S.currentModel) rather than a
  // single local registry, so it tracks OpenRouter / Azure / local models alike.
  // The counter is a plain <div> (not a live region), so it is seen while typing
  // and never announced. Guarded — a missing element is a no-op warn, never a
  // throw. Hides when the draft is empty and after a send.
  function updateInputTokenCount() {
    const els = S.els;
    if (!els.inputCounter || !els.input) {
      logWarn("updateInputTokenCount: input counter or input element missing");
      return;
    }

    const text = els.input.value;
    if (!text || text.trim().length === 0) {
      els.inputCounter.hidden = true;
      return;
    }

    const estimate = Math.ceil(text.length / 4);
    let display = "~" + estimate.toLocaleString() + " tokens";

    // Current model's context window, cross-provider via the picker's lookup.
    // Fall back to a safe positive value when the lookup is unavailable or <= 0,
    // so the percentage check never divides by zero or a bad limit.
    let limit = 0;
    if (window.Chat && typeof window.Chat.getContextLimit === "function") {
      const l = window.Chat.getContextLimit(S.currentModel);
      if (typeof l === "number" && l > 0) limit = l;
    }
    if (!(limit > 0)) limit = 4096;

    if (estimate / limit > 0.5) {
      display += " — over half the context window";
      els.inputCounter.classList.add("chat-input-counter-warning");
    } else {
      els.inputCounter.classList.remove("chat-input-counter-warning");
    }

    els.inputCounter.textContent = display;
    els.inputCounter.hidden = false;
  }

  // ── Provider id from the full model id ─────────────────────────────────────
  // Single home for the prefix → providerId mapping. Stored on each assistant
  // turn now; the visible per-turn badge consumes it. Both Foundry surfaces
  // (azure-openai/ and azure-responses/) resolve to the single providerId
  // "azure-openai", matching the selector's group key (chat.js GROUP_ORDER),
  // so the badge reads "Microsoft Foundry" for either surface.
  function providerIdFromModel(id) {
    if (typeof id !== "string") return "openrouter";
    if (id.indexOf("local/") === 0) return "local";
    if (id.indexOf("azure-openai/") === 0) return "azure-openai";
    if (id.indexOf("azure-responses/") === 0) return "azure-openai";
    return "openrouter";
  }

  // ── Draft stash: identity, read, write, clear (F2-13b) ─────────────────────

  /**
   * The username of whoever is signed in, or null.
   *
   * THIS IS CHAT'S FIRST REFERENCE TO window.EntraAuth. Every guard below exists
   * because a chat send must not depend on the auth layer being present at all:
   * Chat runs perfectly well against OpenRouter and against a local model on a
   * page where EntraAuth was never loaded, and on any of those paths this must
   * return null rather than throw. Guarded exactly as the Foundry providers
   * guard their own reads (readEntraToken / isEntraSignedIn in
   * openrouter-embed/providers/azure-openai-v1.js) — global present, method is a
   * function, result is the shape expected — with a try/catch on top purely so a
   * throwing implementation cannot take a send down with it.
   *
   * @returns {string|null} the signed-in username, or null on any doubt
   */
  function currentIdentity() {
    const auth = window.EntraAuth;
    if (!auth) return null;
    if (typeof auth.getAccount !== "function") return null;
    try {
      const account = auth.getAccount();
      if (!account || typeof account !== "object") return null;
      return typeof account.username === "string" ? account.username : null;
    } catch (err) {
      logWarn("reading the signed-in identity threw — treating as signed out", err);
      return null;
    }
  }

  /**
   * Stash the draft with the identity of whoever typed it.
   *
   * THE IDENTITY TAG IS THE WHOLE POINT OF THE JSON WRAPPER. sessionStorage is
   * per-TAB, not per-person, and it survives the sign-in redirect — so on a
   * shared machine person A's failed send could otherwise leave text that gets
   * restored into person B's input box after B signs in on that same tab.
   *
   * A storage failure is logged and swallowed: losing the ability to restore a
   * draft is a far smaller harm than failing the send the person is making.
   *
   * @param {string} text the text that will actually be sent
   */
  function stashDraft(text) {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ text: text, identity: currentIdentity() }),
      );
    } catch (err) {
      logWarn("could not stash the draft — the send continues regardless", err);
    }
  }

  /**
   * Read and validate the stash. Anything malformed reads as absent, so a
   * hand-edited or half-written value can never reach the input box.
   * @returns {{text: string, identity: string|null}|null}
   */
  function readDraftStash() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (typeof raw !== "string") return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.text !== "string") return null;
      return {
        text: parsed.text,
        identity: typeof parsed.identity === "string" ? parsed.identity : null,
      };
    } catch (err) {
      logWarn("could not read the draft stash — treating it as absent", err);
      return null;
    }
  }

  function clearDraftStash() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      logWarn("could not clear the draft stash", err);
    }
  }

  /**
   * Put the draft back after a failed send — but only when it is safe to.
   *
   * The stash is consumed on EVERY path through here, restored or not: it exists
   * to survive exactly one failure, and nothing else in Chat would ever clean it
   * up (every other storage removal in this tool is a targeted removeItem of a
   * different key, so an abandoned draft would sit in sessionStorage until the
   * tab closed).
   *
   * Three conditions, each protecting a different person:
   *   1. a stash exists and parses;
   *   2. the input is empty — someone who has started typing something new must
   *      not have it overwritten by a resurrected draft;
   *   3. the identity MATCHES. Both null counts as a match, which covers an
   *      OpenRouter user whose send failed for an unrelated reason and a page
   *      with no EntraAuth at all. Any mismatch — including null against a
   *      string in either direction — discards the draft SILENTLY and restores
   *      nothing. THE SCENARIO THIS PROTECTS: person A's send fails, person A
   *      walks away, person B signs in on the same tab, and B must never see A's
   *      text appear in their input box.
   */
  function restoreDraftAfterFailure() {
    const stash = readDraftStash();
    if (!stash) return;
    // Consumed either way — restored or discarded, it has served its purpose.
    clearDraftStash();

    const els = S.els;
    if (!els.input) return;

    if (els.input.value.trim().length > 0) {
      logDebug("draft not restored — the input already holds newly typed text");
      return;
    }

    if (stash.identity !== currentIdentity()) {
      logDebug("draft discarded — it belongs to a different signed-in identity");
      return;
    }

    els.input.value = stash.text;
    // sendMessage called this when it cleared the input, so without it here the
    // visible draft token counter would stay hidden over a repopulated box.
    updateInputTokenCount();
    logDebug("draft restored after a failed send");
  }

  // ── Send-boundary token refresh (F2-13b) ───────────────────────────────────

  /**
   * Renew the Foundry token immediately before a request, when one is due.
   *
   * WHY HERE AND NOT ONLY ON A TIMER. entra-auth.js schedules a renewal at about
   * 75% of each token's life, which covers a page left open and working. It
   * cannot cover a machine that SLEPT: a setTimeout does not fire while the
   * laptop is suspended, so a person who closes the lid over lunch and reopens
   * it wakes to a token that expired unrenewed. Refreshing at the send boundary
   * removes nearly every expiry event, including that one, because it is the
   * moment the token is about to be used.
   *
   * Gated three ways, so no non-Foundry send ever waits on the auth layer:
   * providerIdFromModel must resolve "azure-openai" (which covers BOTH Foundry
   * surfaces and excludes local/ and OpenRouter), EntraAuth must be present with
   * a callable ensureFresh, and somebody must actually be signed in.
   *
   * ENSUREFRESH RESOLVES TO NULL ON FAILURE — IT DOES NOT THROW. So the failure
   * guard is a test of the RETURNED VALUE, and the try/catch below is DEFENCE
   * against a synchronous throw from a future implementation, not the failure
   * path. entra-auth.js draws exactly this distinction in its own priming code
   * ("THE FALSY RETURN IS THE REAL FAILURE SIGNAL, NOT THE CATCH"); a guard
   * written only as a catch here would be dead code.
   *
   * A failed refresh WARNS AND PROCEEDS. It never blocks the send: the cached
   * token may still be valid, so the request may well succeed — and if it does
   * not, postError now says exactly what went wrong rather than swallowing it.
   */
  async function refreshFoundryTokenIfNeeded() {
    if (providerIdFromModel(S.currentModel) !== "azure-openai") return;

    const auth = window.EntraAuth;
    if (!auth || typeof auth.ensureFresh !== "function") return;
    if (typeof auth.isSignedIn !== "function" || auth.isSignedIn() !== true) return;

    try {
      const token = await auth.ensureFresh(ENTRA_SCOPE_NAME);
      if (!token) {
        logWarn(
          "send-boundary token refresh returned nothing — proceeding with " +
            "whatever token is already cached, which may be expired. If it is, " +
            "the proxy answers 401 and the error bubble says so.",
        );
      }
    } catch (err) {
      // Defence only. ensureFresh is documented not to throw; if it ever does,
      // the send still goes out rather than dying here.
      logWarn(
        "send-boundary token refresh threw — proceeding with the cached token",
        err,
      );
    }
  }

  // ── Embed handle ───────────────────────────────────────────────────────────

  /**
   * Reuse the engine handle chat/chat.js already built (S.embed). We do NOT
   * construct a second embed here. Per-turn instance properties are set by the
   * caller (sendMessage) immediately before the send. Returns null when the
   * handle is unavailable (e.g. chat.js init has not run, or OpenRouterEmbed is
   * absent); the caller surfaces that as an error in the assistant bubble.
   * @returns {Object|null} the shared OpenRouterEmbed instance, or null
   */
  function getOrCreateEmbed() {
    const embed = S.embed || null;
    if (!embed) {
      logWarn("no engine handle on S.embed — chat/chat.js init/refresh must run first");
    }
    return embed;
  }

  // ── Post-generation / post-error (DRY) ─────────────────────────────────────

  // TRUE once the current send's failure has been treated, so the SECOND arrival
  // of the same failure is a no-op.
  //
  // ONE FAILURE REACHES postError TWICE, BY DESIGN OF THE EMBED CORE'S ERROR
  // SURFACE — this is measured, not suspected. Both of these fire, in this order:
  //
  //   1. the `onError` callback passed to embed.sendStreamingRequest (see
  //      dispatchSend below, in the streaming-options object), which the embed
  //      core invokes from its terminal handler _finaliseStreamError;
  //   2. the `.catch` chained onto the promise sendStreamingRequest returns
  //      (see the tail of dispatchSend).
  //
  // Neither may be removed. Which one arrives first depends on where the failure
  // occurred — a pre-stream rejection and a mid-stream abort take different
  // routes — so deleting either would lose a failure mode outright and leave a
  // send hung with the typing indicator still spinning.
  //
  // Until this guard existed the duplication was INAUDIBLE RATHER THAN ABSENT:
  // both sites announced the identical fixed string, and the shared announcer
  // (accessibility-announcer.js) drops an identical repeat inside a five-second
  // window keyed on string EQUALITY. That masking is incidental — it is a
  // debounce, not a design, and it evaporates the moment the two utterances
  // differ by even one character. THIS FLAG IS THEREFORE THE PRECONDITION FOR
  // THE MESSAGE VARYING AT ALL: without it, the status-aware text below would be
  // spoken twice, and the developer panel would be written twice per failure.
  let sendErrorHandled = false;

  /**
   * Choose the bubble text and the announcement for one failure.
   *
   * The status has always been reachable here — the provider attaches it to the
   * Error it throws (err.status = response.status) and nothing between there and
   * this function wraps or reshapes the object, so postError receives the very
   * same reference. It was simply never read.
   *
   * Falls through to the pre-existing wording for anything unrecognised, which
   * covers three distinct cases with one branch: an unmapped status, an error
   * carrying no status at all, and the plain object literal that dispatchSend
   * passes when there is no engine handle ({ message: … }, no status, not even
   * an Error).
   *
   * @param {Error|{message: string}} error
   * @returns {{bubble: string, announcement: string}}
   */
  function composeErrorText(error) {
    const status = error ? error.status : undefined;
    // typeof FIRST: the map is keyed by number but property access stringifies,
    // so a string "401" would match without this test.
    if (typeof status === "number" && ERROR_TEXT_BY_STATUS[status]) {
      const plain = ERROR_TEXT_BY_STATUS[status];
      // Same sentence on screen and in the ear — nothing is said that cannot
      // also be read, and nothing read that cannot also be heard.
      return { bubble: plain, announcement: plain };
    }
    return {
      bubble: "Error: " + (error && error.message ? error.message : error),
      announcement: GENERIC_ERROR_ANNOUNCEMENT,
    };
  }

  async function postGeneration(assistantBubble, response) {
    removeTypingIndicator(assistantBubble);
    // Derive the provider id ONCE — reused for the stored turn and the badge.
    const providerId = providerIdFromModel(S.currentModel);
    S.messages.push({
      role: "assistant",
      content: response.text,
      model: S.currentModel,
      providerId: providerId,
    });
    const assistantIndex = S.messages.length - 1;

    // Build the assistant bubble through the shared helper so the live path and
    // the restore path (step 5b-i) produce identical bubbles from one code path:
    // rich accessible body first (replacing the streamed plain render), then the
    // badge (inserted before the bubble's first child) and the parity controls
    // (copy, formatted copy, timestamp), then the data-icon glyph population.
    await window.ChatMessages.renderAssistantTurn(
      assistantBubble,
      response.text,
      S.currentModel,
      providerId,
      assistantIndex,
    );

    // Populate the developer panel silently from the completed turn — finish
    // reason, the scrubbed wire request, and the raw response. Guarded so a
    // missing panel is a no-op; adds no spoken cue (no region is a live region).
    if (window.ChatDevPanel) window.ChatDevPanel.update(response);

    // Post-turn token readout (Stage D): now the reply is rendered, overwrite the
    // send-time trim notice in #chat-stats with the usage line. The stats <output>
    // is a polite live region, so this progression (trim-at-send → tokens-at-
    // completion) is both seen and announced once. Guarded, and only written when
    // usage yielded a line, so a usage-less turn keeps the trim notice in place.
    if (S.els.stats) {
      const tokenLine = composeTokenReadout(
        response && response.raw ? response.raw.usage : null,
      );
      if (tokenLine) S.els.stats.textContent = tokenLine;
    }

    S.isGenerating = false;
    // A send that completed leaves no failure outstanding, so reset the guard
    // here as well as at the start of the next dispatchSend. Belt and braces on
    // purpose: this is the path that runs when nothing went wrong, and leaving a
    // stale TRUE behind would swallow the NEXT send's error entirely.
    sendErrorHandled = false;
    // The send landed, so the draft is no longer wanted. Nothing else in Chat
    // would ever remove it — every other storage removal here targets a
    // different key — so a completed send has to clear it itself or the stash
    // would outlive its purpose until the tab closed.
    clearDraftStash();
    enableSend();
    // Reply, badge and controls are now in the bubble: switch the log live so the
    // whole response reads cleanly, then announce readiness ONCE.
    S.setMessageListLive("polite");
    S.announceToScreenReader("Response ready.");
    scrollMessagesToBottom();
    // Persist the thread now the assistant turn is pushed and rendered, so the
    // saved session includes the completed turn with its model + providerId.
    window.ChatPersistence.saveSession();
    // Refresh conversation-state-dependent UI (the clear button) now the thread
    // has a completed turn — routed through the single seam, not toggled inline.
    updateConversationUI();
  }

  function postError(assistantBubble, error) {
    // The second arrival of the same failure stops here, before ANY side effect:
    // no bubble write, no developer-panel update, no S.isGenerating flip, no
    // enableSend, no announcement. See sendErrorHandled above for why a single
    // failure reaches this function twice and why both call sites must stay.
    if (sendErrorHandled) {
      logDebug(
        "postError suppressed — this send's failure has already been treated " +
          "(the embed core's onError and the promise .catch both fire)",
      );
      return;
    }
    sendErrorHandled = true;

    removeTypingIndicator(assistantBubble);
    // Status-aware where we recognise the status, today's exact wording where we
    // do not — see composeErrorText.
    const text = composeErrorText(error);
    // Plain-text error for this step; the full error-bubble UI lands later.
    assistantBubble.textContent = text.bubble;
    // Reflect what is available in the developer panel: the finish reason
    // resolves to "not reported", the request from the scrubbed wire snapshot,
    // and the error itself as the response. Minimal and guarded. The RAW error
    // goes here unchanged, so the developer panel still shows the provider's own
    // message and status even when the bubble shows plain language.
    if (window.ChatDevPanel) window.ChatDevPanel.update({ raw: error });
    S.isGenerating = false;
    enableSend();
    // Restore the log's politeness in a LATER task — deliberately, and not to be
    // tidied into a plain attribute set. #chat-messages is a live region in the
    // STATIC markup (tools.html: role="log" plus aria-live="polite");
    // setMessageListLive only silences and un-silences it. Writing the error
    // sentence into the assistant bubble — a child of that region — and flipping
    // the region back to polite in the SAME task gives the browser one
    // accessibility-tree diff, computed at the end of the task, by which point
    // aria-live is already polite: the mutation is attributed to a live region
    // and spoken. The announcer below says the same sentence, so the region's
    // utterance is a straight duplicate — and the region reads adjacent content
    // besides, including the preceding user bubble's visible "Edit" label and
    // earlier turns, which is the wrong voice for a single error sentence.
    //
    // Confirmed by a real NVDA listen with the flip removed ENTIRELY: the
    // doubling still occurred. So this is about the TASK BOUNDARY — the tree diff
    // for the text insertion must be computed while the region is still "off" —
    // not about the toggle. A macrotask (setTimeout 0) is used rather than a
    // microtask because a microtask still runs before the browser computes that
    // diff, which would change nothing.
    //
    // The region MUST end up polite: left "off" it would silence Chat's log for
    // the rest of the session, which is worse than the stutter. Hence
    // unconditional, outside every guard.
    setTimeout(function () {
      S.setMessageListLive("polite");
    }, 0);

    // Put the typed text back, so the send can be retried without retyping it.
    // Runs inside the idempotence guard, so it happens once per failed send —
    // and it consumes the stash whether or not it restores. See
    // restoreDraftAfterFailure for the three conditions and who each protects.
    restoreDraftAfterFailure();

    // The announcement lives HERE, not at the two call sites, because only this
    // function knows the status and therefore what to say. It is written AFTER
    // the bubble so the spoken sentence is the sentence already on screen, and
    // it runs exactly once per failed send by virtue of the guard above.
    //
    // Deliberately NOT a toast. Toasts now announce through the same polite
    // channel this uses, so a toast alongside this would put two different
    // strings on one failure — audibly, since they would not be equal and the
    // announcer's repeat suppression would not apply.
    S.announceToScreenReader(text.announcement);
  }

  // ── Token-budget sliding window ────────────────────────────────────────────

  // Impure estimate via the published bridge (step one). Separate so the pure
  // window function stays testable with an injected estimate.
  function estimateWithBridge(messages) {
    if (window.TokenEstimator && typeof window.TokenEstimator.estimateTokens === "function") {
      return window.TokenEstimator.estimateTokens(messages);
    }
    logError("window.TokenEstimator unavailable — trimming to the latest turn only");
    return Number.MAX_SAFE_INTEGER; // fail safe: trim rather than over-send
  }

  // ── Multimodal content helpers (Unified Chat attachments, checkpoint 1) ─────

  /** Concatenate the text parts (and bare strings) of array content into one string. */
  function extractTextFromContent(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    const parts = [];
    for (const p of content) {
      if (typeof p === "string") parts.push(p);
      else if (p && p.type === "text" && typeof p.text === "string") parts.push(p.text);
    }
    return parts.join(" ");
  }

  /** Count the SENDABLE image parts (live image_url) in a content value. */
  function contentImageCount(content) {
    if (!Array.isArray(content)) return 0;
    return content.filter(function (p) {
      return p && (p.type === "image_url" || p.type === "image");
    }).length;
  }

  /**
   * Normalise ONE turn's content for the wire.
   *   - String content passes through unchanged.
   *   - Live array content (a real image_url part, or a PDF file part, + text) is
   *     PRESERVED as an array (never stringified) so the image or PDF file part
   *     reaches the provider.
   *   - A restored turn whose only attachment element is a BYTE-FREE reference
   *     ({ kind:"image"|"pdf", … }, no bytes) has no sendable image or file part,
   *     so it collapses to its text string — the honest outcome (a restored image
   *     or PDF cannot be re-sent).
   * Non-text, non-attachment parts (e.g. a stray reference) are dropped from live
   * arrays.
   */
  function normaliseTurnForWire(content) {
    if (!Array.isArray(content)) return content;
    const hasLiveAttachment = content.some(function (p) {
      return p && (p.type === "image_url" || p.type === "file");
    });
    if (!hasLiveAttachment) return extractTextFromContent(content);
    return content.filter(function (p) {
      if (typeof p === "string") return true;
      return p && (p.type === "text" || p.type === "image_url" || p.type === "file");
    });
  }

  /**
   * Pure limit-aware sliding window. Keeps a recent slice of the thread that fits
   * the model's context window once the answer reservation and safety margin are
   * held back. Never returns empty — the most recent message is always kept, even
   * if it alone exceeds the budget (a tiny placeholder window). Trims the PAYLOAD
   * only; the caller's stored S.messages is untouched.
   * @returns {{messages: Array, dropped: number}}
   */
  function applyTokenWindow(o) {
    const estimate = o.estimate || estimateWithBridge;
    // Flat per-image allowance (default IMAGE_TOKEN_ESTIMATE; overridable for tests).
    // Added here — not only in the estimator — so it still applies under an injected
    // estimate. Zero for text-only threads, so existing behaviour is unchanged.
    const imageEstimate =
      typeof o.imageEstimate === "number" ? o.imageEstimate : IMAGE_TOKEN_ESTIMATE;
    const inputBudget = o.limit - o.answerReservation - o.safetyMargin;
    const sysMsgs =
      o.systemPrompt && o.systemPrompt.trim()
        ? [{ role: "system", content: o.systemPrompt }]
        : [];
    const imageCost = function (msgs) {
      return msgs.reduce(function (sum, m) {
        return sum + imageEstimate * contentImageCount(m.content);
      }, 0);
    };
    const totalEstimate = function (msgs) {
      return estimate(sysMsgs.concat(msgs)) + imageCost(msgs);
    };
    const kept = o.messages.slice();
    while (kept.length > 1 && totalEstimate(kept) > inputBudget) {
      kept.shift();
    }
    return { messages: kept, dropped: o.messages.length - kept.length };
  }

  // ── Send flow ──────────────────────────────────────────────────────────────

  function sendMessage() {
    const els = S.els;
    if (!els.input) return;

    const rawText = els.input.value.trim();

    // Attachment decision — PURE READS, no side effects — hoisted above the
    // empty-text guard so a caption-less PDF send can supply a default caption.
    // If an image or a PDF is attached AND the model accepts it, we build
    // multimodal content below:
    //   image → [ { type:"image_url", image_url:{ url:"data:…" } }, { type:"text", text } ]
    //   pdf   → [ { type:"file",      file:{ filename, file_data:"data:…" } }, { type:"text", text } ]
    // Otherwise the turn stays a bare string, byte-identical to before.
    const attach = window.ChatAttach;
    // Capture the BYTE-FREE reference (kind/filename/type/size) WHILE the attachment
    // is still live — the live turn's wire content deliberately omits the filename,
    // so chat-persistence.js reads this to serialise the session without the base64.
    // buildReference is called ONCE here and reused as the attachmentRef below.
    const held =
      attach &&
      typeof attach.hasAttachment === "function" &&
      attach.hasAttachment() &&
      typeof attach.buildReference === "function"
        ? attach.buildReference() // { kind, filename, mimeType, size } | null
        : null;
    const kind = held ? held.kind : null;
    const modelAcceptsHeld =
      kind === "pdf"
        ? attach.modelAcceptsPDF(S.currentModel)
        : kind === "image"
        ? attach.modelAcceptsImages(S.currentModel)
        : false;
    const useAttachment = !!held && modelAcceptsHeld;

    // A caption-less PDF that will actually send gets the neutral default caption
    // (the embed core rejects an empty prompt). Caption-less IMAGE sends stay
    // blocked by the empty-text guard, exactly as before — PDF-only by decision.
    const text =
      !rawText && useAttachment && kind === "pdf"
        ? DEFAULT_ATTACHMENT_CAPTION
        : rawText;
    if (!text) return;
    if (S.isGenerating) return;

    S.isGenerating = true;
    S.setMessageListLive("off");

    // Stash the draft BEFORE the input is cleared, so a send that fails can put
    // it back. Stashes `text`, not rawText — the default-caption substitution
    // above has already run, so this is the string that will actually be sent,
    // and a restore therefore returns the person to exactly what they sent.
    stashDraft(text);

    // Clear the input.
    els.input.value = "";
    // Hide the draft token counter now the input is empty (Stage A).
    updateInputTokenCount();

    // Build the turn content. The attachment is cleared AFTER the turn is pushed
    // so its bytes live on in the stored turn.
    const attachmentRef = useAttachment ? held : null;
    const content = useAttachment
      ? [attach.getAttachmentPart(), { type: "text", text: text }]
      : text;

    // Push the user turn and render it. An attachment turn carries its byte-free
    // reference alongside the (bytes-bearing) content; the bytes live only for
    // this session and are dropped on save.
    const turn = { role: "user", content: content };
    if (attachmentRef) turn.attachment = attachmentRef;
    S.messages.push(turn);
    createUserBubble(content, S.messages.length - 1);
    if (useAttachment) attach.clearAttachment();
    scrollMessagesToBottom();

    // Hand off to the shared back half (assistant bubble → embed → stream).
    dispatchSend({ userPrompt: text });
  }

  /**
   * Shared send back-half: create the assistant bubble, set the per-turn embed
   * properties, apply the token window and fire the streaming request. Extracted
   * verbatim from sendMessage so a later edit-resend slice can reuse it.
   *
   * Owns the disableSend() side (moved here from sendMessage's front half); the
   * enable side stays with postGeneration/postError, which the callbacks below
   * call. assistantBubble is closed over by the callbacks.
   * @param {{userPrompt: string}} opts
   */
  async function dispatchSend(opts) {
    disableSend();

    // Arm the one-treatment-per-send guard at the very TOP of the function, not
    // beside the request below, because the no-engine-handle branch a few lines
    // down calls postError and returns without ever reaching the request. Reset
    // there and a previous send's stale TRUE would swallow that error silently,
    // leaving the user with a spinning typing indicator and nothing said.
    sendErrorHandled = false;

    // Empty assistant bubble + typing indicator.
    const assistantBubble = createAssistantBubble();
    addTypingIndicator(assistantBubble);
    // Immediate cue that work has started — heard right away. The clean full
    // read comes on completion ("Response ready."); we do NOT announce per chunk.
    S.announceToScreenReader("Generating response.");

    // Reuse the shared handle.
    const embed = getOrCreateEmbed();
    if (!embed) {
      postError(assistantBubble, {
        message: "Chat engine is not ready yet. Open the Chat tool and pick a model first.",
      });
      return;
    }

    // Set per-turn instance properties. embed.model = the FULL chosen id is what
    // routes the request to the right provider; no "local/" re-prefixing.
    embed.model = S.currentModel;
    const systemPrompt = S.els.systemInput ? S.els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble; // the embed renders its output here

    // Per-turn generation parameters from the Parameters panel. Reading the helpers
    // (not the elements) keeps the slider as the single source. max_tokens is set
    // BEFORE the budget block below, so the answer reservation tracks the slider.
    embed.temperature = S.getTemperature();
    embed.top_p = S.getTopP();
    embed.frequency_penalty = S.getFrequencyPenalty();
    embed.presence_penalty = S.getPresencePenalty();
    embed.max_tokens = S.getMaxTokens();

    // Normalise the full thread to role/content. Array (multimodal) content is
    // PRESERVED for live image turns so the image reaches the wire; a restored
    // byte-free reference turn collapses to its text (it cannot be re-sent).
    const fullThread = S.messages.map(function (m) {
      return { role: m.role, content: normaliseTurnForWire(m.content) };
    });
    // Limit-aware sliding window: keep a recent slice that fits the chosen
    // model's context window, reserving room for the answer. Trims the PAYLOAD
    // only — S.messages and the on-screen thread are untouched. The reservation
    // reads the embed's live max_tokens, so when the max-tokens slider lands it
    // tracks the slider with no change here.
    const contextLimit = window.Chat.getContextLimit(S.currentModel);
    const answerReservation =
      embed && typeof embed.max_tokens === "number"
        ? embed.max_tokens
        : DEFAULT_ANSWER_RESERVATION;
    const windowed = applyTokenWindow({
      messages: fullThread,
      limit: contextLimit,
      answerReservation: answerReservation,
      safetyMargin: BUDGET_SAFETY_MARGIN,
      systemPrompt: systemPrompt,
    });
    announceTrim(windowed.dropped);
    if (windowed.dropped > 0) {
      logInfo("token budget: dropped", windowed.dropped, "oldest turn(s) to fit", contextLimit, "tokens for", S.currentModel);
    }
    const messagesForApi = windowed.messages;

    // THE FIRST AND ONLY AWAIT IN THIS FUNCTION, and it is placed here on
    // purpose: every synchronous step above — the assistant bubble, the typing
    // indicator, the "Generating response." cue, the embed properties and the
    // token window — has already run, so nothing a person sees or hears is
    // delayed by it. It is a no-op for any non-Foundry model. Making this
    // function async changes its return type to a Promise, which is safe for
    // both callers: sendMessage ignores the return, and chat-messages.js's
    // edit-resend (commitEdit) also ignores it and continues synchronously —
    // its own announcement still lands after the cue above, as its comment
    // there requires.
    await refreshFoundryTokenIfNeeded();

    embed
      .sendStreamingRequest({
        userPrompt: opts.userPrompt, // required by the embed core's validation
        messages: messagesForApi,
        onChunk: function () {
          // The embed writes the text into embed.container itself; we only clear
          // the typing indicator and keep the view pinned to the bottom.
          removeTypingIndicator(assistantBubble);
          scrollMessagesToBottom();
        },
        onComplete: async function (response) {
          // postGeneration owns the "Response ready." announcement (after the
          // badge is in place), so we do not announce again here.
          await postGeneration(assistantBubble, response);
          logInfo("response complete —", (response.text || "").length, "chars");
        },
        onError: function (error) {
          // postError owns the announcement now — it is the only place that
          // knows the status, and announcing here as well would speak twice.
          postError(assistantBubble, error);
          logError("send error:", (error && error.message) || error);
        },
      })
      .catch(function (error) {
        // The second of the two arrivals in the common case — postError's guard
        // makes it a no-op then. It is NOT redundant: when the failure bypasses
        // the embed core's onError this is the only path that treats it, which
        // is why it stays and why it, too, no longer announces.
        postError(assistantBubble, error);
        logError("send error (catch):", (error && error.message) || error);
      });
  }

  /**
   * Minimal cancel for this step: drop the generating flag and restore the send
   * controls. Full cancellation parity (aborting the in-flight request) is a
   * later step.
   */
  function cancel() {
    S.isGenerating = false;
    enableSend();
    logDebug("cancel — generating flag cleared, send re-enabled");
  }

  // ── Conversation-state UI seam ─────────────────────────────────────────────

  // Single source of truth for conversation-state-dependent UI. Every control
  // whose enabled/visible state depends on the thread (today: the clear button;
  // later, as we reach parity: sliders, regenerate, history) is updated HERE, and
  // callers that change the thread call updateConversationUI() afterwards rather
  // than toggling a control inline. This keeps controls from drifting out of sync
  // with the thread.
  function updateConversationUI() {
    const hasMessages = S.messages.length > 0;
    // A cleared thread blanks the developer panel through this single seam —
    // never by touching the panel's elements inline elsewhere. Guarded.
    if (!hasMessages && window.ChatDevPanel) window.ChatDevPanel.clear();
    if (S.els.clearBtn) {
      S.els.clearBtn.disabled = !hasMessages;
    }
    if (S.els.exportBtn) S.els.exportBtn.disabled = !hasMessages;
    // Re-check every Chat Save-as-Audio button through the container-scoped seam
    // exposed in commit 1. This is the single place every thread-state change
    // converges — the end of postGeneration (once S.isGenerating has flipped
    // false), edit re-sends, clears, and the post-restore sync — so the Save
    // button never stays stuck disabled from the one-microtask-too-early
    // enabled-state read on the live send path. Guarded because this seam also
    // runs on the init/restore path; a no-op is preferable to a throw if the
    // messages module is somehow not yet registered.
    if (
      window.ChatMessages &&
      typeof window.ChatMessages.refreshAllChatSaveAudioButtons === "function"
    ) {
      window.ChatMessages.refreshAllChatSaveAudioButtons();
    }
    // Empty-log tab stop: a role="log" region only earns a tab stop when it has
    // content to scroll. Keep it focusable when populated so keyboard users can
    // arrow-scroll it; drop the tab stop when empty so it is not a dead stop.
    if (S.els.messageList) {
      if (hasMessages) {
        S.els.messageList.setAttribute("tabindex", "0");
      } else {
        S.els.messageList.removeAttribute("tabindex");
      }
    }
    // Starter prompts: show when the thread is empty, hide when it has messages.
    if (window.ChatChips && typeof window.ChatChips.syncToConversationState === "function") {
      window.ChatChips.syncToConversationState();
    }
    // Future parity controls hook in here.
  }

  // ── Clear conversation ─────────────────────────────────────────────────────

  // Confirm-then-clear, no archive (Chat has no history). Local Chat consumes
  // window.safeConfirm asynchronously (it returns a Promise), so we await it here
  // and match that contract. performClear() (confirmed in 5b) already clears the
  // session, empties S.messages and the message list, focuses the input, and
  // announces "Conversation cleared." — we do not duplicate any of that; we only
  // confirm, call performClear, then refresh the UI seam.
  async function handleClear() {
    if (S.messages.length === 0) return; // nothing to clear
    const ok =
      typeof window.safeConfirm === "function"
        ? await window.safeConfirm("Clear this conversation? This cannot be undone.")
        : window.confirm("Clear this conversation? This cannot be undone.");
    if (!ok) return;
    window.ChatPersistence.performClear();
    updateConversationUI();
  }

  // ── Global handlers + wiring ───────────────────────────────────────────────

  window.chatSend = sendMessage;
  window.chatCancel = cancel;

  // Inert guard for a model-ignored sampling slider. chat.js marks a slider
  // aria-disabled="true" (and records data-preserved-value) when the selected
  // model ignores that parameter. A keyboard nudge must then be a no-op: restore
  // the preserved value so the nudge is reverted, and report that the listener
  // should bail before updating any value output or description. With the CSS's
  // pointer-events:none this makes the dimmed control fully inert, while its
  // preserved value still reaches dispatchSend unchanged (the provider wire drops
  // the ignored param model-side). Returns true when it reverted so the caller
  // returns early. Only ever true for the four sampling sliders chat.js dims.
  function revertIfSamplingDisabled(slider) {
    if (slider.getAttribute("aria-disabled") !== "true") return false;
    const preserved = slider.getAttribute("data-preserved-value");
    if (preserved !== null) slider.value = preserved;
    return true;
  }

  function wire() {
    if (wired) return;
    const els = S.els;
    if (els.sendBtn) {
      els.sendBtn.addEventListener("click", function () {
        window.chatSend();
      });
    }
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", function () {
        window.chatCancel();
      });
    }
    if (els.clearBtn) {
      els.clearBtn.addEventListener("click", function () {
        handleClear();
      });
    }
    if (els.input) {
      // Enter sends; Shift+Enter inserts a newline.
      els.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          window.chatSend();
        }
      });
      // Live draft token estimate — a SEPARATE "input" listener from the keydown
      // above. Visible-only; never announced (Stage A).
      els.input.addEventListener("input", updateInputTokenCount);
    }
    // Sign-out drops the draft stash (F2-13b). Signing out is a deliberate
    // handover signal — it is the moment somebody on a shared machine expects
    // their traces gone — so a draft they never got to send must not outlive it.
    //
    // Tested for isSignedIn === false SPECIFICALLY, not merely "not true". A
    // "renewal-failed" event fires while the person is still signed in, and that
    // is the very case this stage exists to protect: their token expired, their
    // send failed, and their text must survive so they can sign in and retry.
    // Clearing on anything falsy would throw that draft away at exactly the
    // wrong moment.
    //
    // Touches the stash and NOTHING else — no announcement (this is not a state
    // change anybody needs read to them, and the sign-in card already announces
    // sign-out through the shared announcer), and never the input box.
    if (window.EntraAuth && typeof window.EntraAuth.CHANGE_EVENT === "string") {
      window.addEventListener(window.EntraAuth.CHANGE_EVENT, function (event) {
        const detail = event && event.detail ? event.detail : {};
        if (detail.isSignedIn === false) clearDraftStash();
      });
    }
    // Parameters panel (5c-i): live value + description on drag. The banding is
    // owned by the shared description helpers — we do not reimplement it here.
    if (els.temperatureSlider) {
      els.temperatureSlider.addEventListener("input", function () {
        if (revertIfSamplingDisabled(els.temperatureSlider)) return;
        const val = parseFloat(els.temperatureSlider.value);
        if (els.temperatureValue) els.temperatureValue.textContent = val.toFixed(1);
        if (els.temperatureDesc) els.temperatureDesc.textContent = S.getTemperatureDescription(val);
      });
    }
    if (els.topPSlider) {
      els.topPSlider.addEventListener("input", function () {
        if (revertIfSamplingDisabled(els.topPSlider)) return;
        const val = parseFloat(els.topPSlider.value);
        if (els.topPValue) els.topPValue.textContent = val.toFixed(2);
      });
    }
    if (els.frequencyPenaltySlider) {
      els.frequencyPenaltySlider.addEventListener("input", function () {
        if (revertIfSamplingDisabled(els.frequencyPenaltySlider)) return;
        const val = parseFloat(els.frequencyPenaltySlider.value);
        if (els.frequencyPenaltyValue) els.frequencyPenaltyValue.textContent = val.toFixed(1);
      });
    }
    if (els.presencePenaltySlider) {
      els.presencePenaltySlider.addEventListener("input", function () {
        if (revertIfSamplingDisabled(els.presencePenaltySlider)) return;
        const val = parseFloat(els.presencePenaltySlider.value);
        if (els.presencePenaltyValue) els.presencePenaltyValue.textContent = val.toFixed(1);
      });
    }
    if (els.maxTokensSlider) {
      els.maxTokensSlider.addEventListener("input", function () {
        setMaxTokens(els.maxTokensSlider.value);
      });
    }
    if (els.maxTokensNumber) {
      els.maxTokensNumber.addEventListener("change", function () {
        setMaxTokens(els.maxTokensNumber.value);
      });
    }
    els.maxTokensPresets.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMaxTokens(btn.dataset.tokens);
      });
    });
    // Guaranteed initial sync so the number field matches the slider on load.
    if (els.maxTokensSlider) setMaxTokens(els.maxTokensSlider.value);
    // System-prompt preset (5c-ii-b): selecting a preset fills the system box from
    // the shared S.SYSTEM_PRESETS map; "None (custom)" clears it. Textarea only —
    // Chat has no welcome card / currentEmbed to touch.
    if (els.presetSelect) {
      els.presetSelect.addEventListener("change", function () {
        if (!els.systemInput) return;
        const key = els.presetSelect.value;
        if (key && S.SYSTEM_PRESETS[key]) {
          els.systemInput.value = S.SYSTEM_PRESETS[key];
        } else {
          els.systemInput.value = "";
        }
        S.logInfo("Chat system-prompt preset changed to:", key || "none (custom)");
      });
    }
    wired = true;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialise the Chat core send loop. Idempotent — re-caches the message-area
   * elements and wires the static buttons exactly once. Safe to call before or
   * after chat.js's picker init, because the handle is fetched lazily at send
   * time, not here.
   */
  function init() {
    cacheElements();
    wire();
    // Restore any saved session once on load (cacheElements() above has populated
    // S.els.messageList, which the restore path rebuilds into). Persistence binds
    // its own state via its default window.ChatState capture — core does not call
    // attach on the other modules, so we do not add an attach call here. init() is
    // not async and self-runs on DOMContentLoaded, so kick the restore off without
    // blocking; show the banner only when a thread was actually restored.
    window.ChatPersistence.restoreSession().then(function (restored) {
      if (restored) {
        window.ChatPersistence.showRestoreBanner();
      }
      // In all cases, sync the conversation-state UI once after restore resolves
      // through the single seam, so the clear button reflects whether a thread was
      // restored (enabled) or not (disabled on a fresh load).
      updateConversationUI();
    });
    logInfo("init complete (core send loop wired)");
  }

  // Self-init on DOM-ready. The step-1 message-area elements are static HTML, so
  // wiring does not depend on the tool being switched to; and S.embed is read
  // lazily at send time (by then chat.js's init/refresh has built it). This keeps
  // chat-core.js self-contained — no edit to chat.js's lifecycle is required.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Expose singleton ───────────────────────────────────────────────────────
  window.ChatCore = {
    init: init,
    sendMessage: sendMessage,
    _dispatchSend: dispatchSend,
    _getOrCreateEmbed: getOrCreateEmbed,
    _postGeneration: postGeneration,
    _updateConversationUI: updateConversationUI,
    // Refresh the visible draft token counter — called by chat.js on model change
    // (Stage B) so the >50% warning re-computes against the new context window.
    _updateInputCounter: updateInputTokenCount,
    // Pure post-turn token-readout composer (Stage D) — exposed for inspection /
    // cross-provider verification (OpenRouter and Foundry usage share the keys).
    _composeTokenReadout: composeTokenReadout,
    applyTokenWindow: applyTokenWindow,
    // Wire-normalisation of one turn's content (Unified Chat attachments) —
    // exposed for inspection: preserves live arrays, collapses byte-free refs.
    _normaliseTurnForWire: normaliseTurnForWire,
    _contentImageCount: contentImageCount,
  };
})();
