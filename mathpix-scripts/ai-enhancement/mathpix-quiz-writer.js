/**
 * @fileoverview MathPix Quiz Writer - asks a model for a practice quiz about the open session
 * @module MathPixQuizWriter
 * @version 1.0.0
 * @since QZ-4 (22 November 2026)
 *
 * Builds one request from the open session's working text and the person's
 * three choices (which question types, how hard, how many), sends it through
 * the same client the MMD correction uses (OpenRouterEmbed.sendRequest), checks
 * the reply with MathPixQuizFormat, and on success hands the quiz to
 * MathPixQuizStore. It has no window and says nothing aloud: part 3 builds the
 * UI and owns every announcement and toast.
 *
 * MEASURED AT QZ-5, REVISED AT QZ-6. The estimate's bounds below come from the
 * eight real sends of QZ-5 (n = 8, two documents, one model, prompt qz4-1.0.0).
 * The prompt in mathpix-quiz-prompts.json is now qz6-1.1.0, which NO send has
 * measured. Every figure `estimate` returns is an estimate, not a price.
 *
 * THE MODEL IS CHOSEN BY PURPOSE, for the provider the person has chosen:
 * MathPixModelRegistry.recommendedModel("practice-quiz", active provider). An
 * unrecognised provider is refused. A Foundry choice never gets an OpenRouter
 * model and no price crosses either (AGENTS.md; memory "never cross the
 * provider streams").
 *
 * DATA POLICY: the correction checks none before it sends (QZ-4 report), so
 * this module checks none either. The only pre-send check it shares is the
 * provider-membership check (MathPixModelCapability.isModelProviderAvailable).
 *
 * @requires window.MathPixModelRegistry (mathpix-model-registry.js)
 * @requires window.MathPixQuizFormat, window.MathPixQuizStore
 * @accessibility No live region, no announcement, no toast.
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
      console.error(`[QuizWriter] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[QuizWriter] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[QuizWriter] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[QuizWriter] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const VERSION = "1.0.0";

  /** The registry purpose this module asks for. */
  const PURPOSE = "practice-quiz";

  /** Where the prompt file sits, relative to this script. */
  const PROMPTS_FILE = "mathpix-quiz-prompts.json";

  /** The fewest questions a person may ask for. The most is the format's MAX_QUESTIONS. */
  const MIN_QUESTIONS = 3;

  /** The three difficulty levels the person chooses between. */
  const DIFFICULTY = Object.freeze({
    INTRODUCTORY: "introductory",
    INTERMEDIATE: "intermediate",
    CHALLENGING: "challenging",
  });

  /**
   * The provider used when ProviderSwitcher is not on the page. The same
   * default the correction uses (AI_ENHANCER_CONFIG.DEFAULT_PROVIDER_ID).
   */
  const DEFAULT_PROVIDER_ID = "openrouter";

  /**
   * Prompt-side bounds for the QUIZ prompt, in characters a token. Set from the
   * QZ-5 paid round (22 November 2026, n = 8 sends, two documents, one model,
   * anthropic/claude-fable-5.1): the wire reported 2.17 characters a token on the
   * capacitors document and 1.92 on the electric one. The correction's bounds
   * (2.7 / 2.0, M-10bs) are NOT used here because electric fell below their high
   * end. The range is widened a little either side of those two readings. It
   * covers the eight sends by construction, not by independent test.
   */
  const PROMPT_BOUNDS = Object.freeze({ LOW: 2.3, HIGH: 1.8 });

  /**
   * THE REPLY SIDE, from QZ-5 (n = 8, two documents, one model). Completion tokens,
   * reasoning included, were 3,114 to 3,616 at 4 questions and 3,131 to 3,430 at
   * 6: a base that barely moves with the count, not an amount a question. So the
   * reply is a flat low and high, widened either side of the measured spread, and
   * no longer 450 characters a question.
   *
   * ASSUMED, NOT MEASURED: how the reply grows beyond 6 questions (nothing above 6
   * was sent). Above MEASURED_COUNT_MAX the HIGH end adds EXTRA_REPLY_TOKENS_PER_QUESTION
   * a question (450 characters at the correction's 1.3 characters a token, QZ-4's
   * old per-question size). And max_tokens, the cut-off guard, which no QZ-5 reply
   * came near, is unchanged from QZ-4.
   */
  const ASSUMED = Object.freeze({
    REPLY_TOKENS_LOW: 2700,
    REPLY_TOKENS_HIGH: 4300,
    MEASURED_COUNT_MAX: 6,
    EXTRA_REPLY_TOKENS_PER_QUESTION: 350,
    MAX_TOKENS_BASE: 4000,
    MAX_TOKENS_PER_QUESTION: 800,
  });

  const TEMPERATURE = 0.3;
  const EMBED_CONTAINER_ID = "quiz-writer-embed-container";

  /** Plain sentences, spoken by nothing here; part 3 decides what to show. */
  const MESSAGES = Object.freeze({
    noFormat: "The quiz format checker has not loaded, so a quiz cannot be written",
    noRegistry: "The model registry has not loaded, so a quiz cannot be written",
    noPrompts: "The quiz prompt file has not loaded",
    noDocument: "There is no document content to write a quiz from",
    noModel: "No model is registered for writing a quiz with the chosen provider",
    notServed: "The chosen provider does not serve the model chosen for the quiz",
    noClient: "The AI client has not loaded, so a quiz cannot be written",
    cutOff: "The AI reply was cut off before it finished, so no quiz was kept",
    emptyReply: "The AI reply was empty, so no quiz was kept",
    notJson: "The AI reply was not a quiz in the expected format, so no quiz was kept",
    sendFailed: "The AI request failed",
  });

  // ============================================================================
  // STATE
  // ============================================================================

  /** The parsed prompt file, or null until loadPrompts or setPrompts. */
  let prompts = null;

  const SCRIPT_URL =
    typeof document !== "undefined" && document.currentScript
      ? document.currentScript.src
      : "";

  // ============================================================================
  // THE PROMPT FILE
  // ============================================================================

  /** Whether an object has every part of the prompt file this module reads. */
  function promptsAreUsable(p) {
    return (
      !!p &&
      typeof p.version === "string" &&
      typeof p.system === "string" &&
      typeof p.user === "string" &&
      !!p.difficulty &&
      Object.values(DIFFICULTY).every((d) => typeof p.difficulty[d] === "string") &&
      !!p.types &&
      typeof p.types === "object"
    );
  }

  /** Load the prompt file once. Resolves to true when it is held. */
  async function loadPrompts() {
    if (prompts) return true;
    try {
      const url = SCRIPT_URL
        ? new URL(PROMPTS_FILE, SCRIPT_URL).href
        : `mathpix-scripts/ai-enhancement/${PROMPTS_FILE}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = await response.json();
      if (!promptsAreUsable(parsed)) throw new Error("the prompt file is missing a part");
      prompts = parsed;
      return true;
    } catch (e) {
      logError("Could not load the quiz prompt file", e);
      return false;
    }
  }

  /** Test hook: supply the parsed prompt file, or null to forget it. */
  function setPrompts(p) {
    prompts = p === null ? null : promptsAreUsable(p) ? p : prompts;
    return prompts !== null;
  }

  // ============================================================================
  // READING THE WORLD AT CALL TIME (never captured)
  // ============================================================================

  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    return switcher && typeof switcher.getActive === "function"
      ? switcher.getActive()
      : DEFAULT_PROVIDER_ID;
  }

  /** The open session's working text, by the route the export uses. */
  function sessionText() {
    const getRestorer = window.getMathPixSessionRestorer;
    const restorer = typeof getRestorer === "function" ? getRestorer() : null;
    if (!restorer || typeof restorer.getCurrentMMDContent !== "function") return "";
    const text = restorer.getCurrentMMDContent();
    return typeof text === "string" ? text : "";
  }

  /** Price per token in US dollars for a model id, or null when none is known. */
  function pricesPerToken(modelId) {
    const registry = window.modelRegistry;
    if (!registry || typeof registry.getAllModels !== "function") return null;
    const found = registry.getAllModels().find((m) => m.id === modelId);
    if (!found || !found.costs) return null;
    const { input, output } = found.costs;
    if (typeof input !== "number" || typeof output !== "number") return null;
    return { input: input / 1_000_000, output: output / 1_000_000 };
  }

  // ============================================================================
  // OPTIONS
  // ============================================================================

  /**
   * Check the person's three choices. Returns a list of plain messages, empty
   * when the options are fine.
   */
  function optionProblems(options) {
    const problems = [];
    const format = window.MathPixQuizFormat;
    const allowed = format ? Object.values(format.ALLOWED_TYPES) : [];
    const max = format ? format.MAX_QUESTIONS : MIN_QUESTIONS;
    const o = options && typeof options === "object" ? options : {};

    const types = Array.isArray(o.types) ? o.types : [];
    if (types.length === 0) {
      problems.push("Choose at least one question type");
    } else if (types.some((t) => !allowed.includes(t))) {
      problems.push("One of the chosen question types is not one this quiz can use");
    }

    if (!Object.values(DIFFICULTY).includes(o.difficulty)) {
      problems.push("Choose a difficulty: introductory, intermediate or challenging");
    }

    if (!Number.isInteger(o.count) || o.count < MIN_QUESTIONS || o.count > max) {
      problems.push(`Choose a number of questions from ${MIN_QUESTIONS} to ${max}`);
    }
    return problems;
  }

  function refusal(errors) {
    return { ok: false, errors: errors.map((message) => ({ questionId: null, field: "", message })) };
  }

  // ============================================================================
  // BUILD THE REQUEST (pure: sends nothing)
  // ============================================================================

  /**
   * @param {{ types: string[], difficulty: string, count: number }} options
   * @returns {{ ok: true, provider: string, model: string, messages: object[],
   *   maxTokens: number, estimate: (object|null), promptVersion: string,
   *   promptChars: number } | { ok: false, errors: object[] }}
   */
  function buildRequest(options) {
    if (!window.MathPixQuizFormat) return refusal([MESSAGES.noFormat]);
    if (!window.MathPixModelRegistry) return refusal([MESSAGES.noRegistry]);
    if (!prompts) return refusal([MESSAGES.noPrompts]);

    const problems = optionProblems(options);
    if (problems.length > 0) return refusal(problems);

    const provider = activeProvider();
    const entry = window.MathPixModelRegistry.recommendedModel(PURPOSE, provider);
    if (!entry || typeof entry.modelId !== "string") return refusal([MESSAGES.noModel]);

    const docText = sessionText();
    if (docText.trim() === "") return refusal([MESSAGES.noDocument]);

    const typeWords = options.types.map((t) => prompts.types[t] || t).join("; ");
    const user = prompts.user
      .replace("{{COUNT}}", String(options.count))
      .replace("{{TYPES}}", typeWords)
      .replace("{{DIFFICULTY_NAME}}", options.difficulty)
      .replace("{{DIFFICULTY_MEANING}}", prompts.difficulty[options.difficulty])
      .replace("{{DOCUMENT}}", () => docText);

    const messages = [
      { role: "system", content: prompts.system },
      { role: "user", content: user },
    ];
    const maxTokens =
      ASSUMED.MAX_TOKENS_BASE + options.count * ASSUMED.MAX_TOKENS_PER_QUESTION;
    const promptChars = prompts.system.length + user.length;

    return {
      ok: true,
      provider,
      model: entry.modelId,
      messages,
      maxTokens,
      promptVersion: prompts.version,
      promptChars,
      estimate: estimateCost({ modelId: entry.modelId, promptChars, count: options.count, maxTokens }),
    };
  }

  /**
   * A low and a high US dollar figure. ESTIMATE ONLY. Low: the prompt at the
   * highest chars-a-token rate plus the lowest reply (reasoning included). High:
   * the prompt at the lowest rate plus the highest reply, which grows with the
   * count above MEASURED_COUNT_MAX and never exceeds max_tokens. Set from QZ-5's
   * eight sends (see PROMPT_BOUNDS and ASSUMED). Null when the model has no known
   * price.
   */
  function estimateCost({ modelId, promptChars, count, maxTokens }) {
    const prices = pricesPerToken(modelId);
    if (!prices) return null;

    const inputLow = Math.ceil(promptChars / PROMPT_BOUNDS.LOW);
    const inputHigh = Math.ceil(promptChars / PROMPT_BOUNDS.HIGH);
    const outputLow = ASSUMED.REPLY_TOKENS_LOW;
    const extraQuestions = Math.max(0, count - ASSUMED.MEASURED_COUNT_MAX);
    const outputHigh = Math.max(
      outputLow,
      Math.min(maxTokens, ASSUMED.REPLY_TOKENS_HIGH + extraQuestions * ASSUMED.EXTRA_REPLY_TOKENS_PER_QUESTION)
    );

    return {
      kind: "estimate",
      lowUsd: inputLow * prices.input + outputLow * prices.output,
      highUsd: inputHigh * prices.input + outputHigh * prices.output,
      inputTokensLow: inputLow,
      inputTokensHigh: inputHigh,
      outputTokensLow: outputLow,
      outputTokensHigh: outputHigh,
    };
  }

  // ============================================================================
  // SENDING
  // ============================================================================

  /**
   * The default transport: the same client and call the correction uses, a fresh
   * OpenRouterEmbed per request, then embed.sendRequest(userPrompt)
   * (mathpix-ai-enhancer.js initialiseEmbed ~:6361 and sendRequestWithTimeout
   * ~:6614). Nothing in this parcel calls it.
   */
  async function embedTransport(request) {
    if (typeof OpenRouterEmbed === "undefined") throw new Error(MESSAGES.noClient);

    let container = document.getElementById(EMBED_CONTAINER_ID);
    const made = !container;
    if (made) {
      container = document.createElement("div");
      container.id = EMBED_CONTAINER_ID;
      container.style.display = "none";
      container.setAttribute("aria-hidden", "true");
      document.body.appendChild(container);
    }

    try {
      const embed = new OpenRouterEmbed({
        containerId: EMBED_CONTAINER_ID,
        model: request.model,
        systemPrompt: request.messages[0].content,
        temperature: TEMPERATURE,
        max_tokens: request.maxTokens,
        showNotifications: false,
        enableLogging: false,
      });
      return await embed.sendRequest(request.messages[1].content);
    } finally {
      if (made && container.parentNode) container.parentNode.removeChild(container);
    }
  }

  /** The text of a reply, as the correction reads it. */
  function replyText(response) {
    if (typeof response === "string") return response;
    if (!response) return "";
    if (typeof response.text === "string") return response.text;
    if (typeof response.content === "string") return response.content;
    const choice = response.choices && response.choices[0];
    return choice && choice.message && typeof choice.message.content === "string"
      ? choice.message.content
      : "";
  }

  function replyUsage(response) {
    if (!response || typeof response !== "object") return null;
    return (
      (response.raw && response.raw.usage) ||
      (response.metadata && response.metadata.tokens) ||
      response.usage ||
      null
    );
  }

  function replyWasCutOff(response) {
    const raw = response && response.raw;
    const choice = raw && raw.choices && raw.choices[0];
    return !!choice && choice.finish_reason === "length";
  }

  /**
   * The reply as a quiz object. STRICT: the prompt asks for JSON only, so text
   * before or after the object is refused rather than cut out. One wrapping code
   * fence is tolerated because models add it unasked.
   */
  function parseQuiz(text) {
    const trimmed = String(text).trim();
    const unfenced = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```$/, "").trim();
    if (!unfenced.startsWith("{") || !unfenced.endsWith("}")) return null;
    try {
      const parsed = JSON.parse(unfenced);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Write a quiz: build, send ONCE, check, hold. No retry.
   *
   * @param {{ types: string[], difficulty: string, count: number }} options
   * @param {{ transport?: function }} [deps] transport(request) -> Promise<reply>;
   *   injectable so a test never reaches a network. Defaults to the real client.
   * @returns {Promise<{ ok: true, quiz: object, warnings: object[], usage: (object|null) }
   *   | { ok: false, errors: object[] }>}
   */
  async function generate(options, deps = {}) {
    await loadPrompts();
    const request = buildRequest(options);
    if (!request.ok) return request;

    // The one pre-send check the correction has: is the model served by the
    // provider the person chose? Absent facade is fail-open, as there.
    const capability = window.MathPixModelCapability;
    if (
      capability &&
      typeof capability.isModelProviderAvailable === "function" &&
      !capability.isModelProviderAvailable(request.model)
    ) {
      return refusal([MESSAGES.notServed]);
    }

    const transport = typeof deps.transport === "function" ? deps.transport : embedTransport;
    let response;
    try {
      response = await transport(request);
    } catch (e) {
      logWarn("The quiz request failed", e);
      return refusal([`${MESSAGES.sendFailed}: ${e && e.message ? e.message : e}`]);
    }

    const usage = replyUsage(response);
    if (replyWasCutOff(response)) return refusal([MESSAGES.cutOff]);

    const text = replyText(response);
    if (text.trim() === "") return refusal([MESSAGES.emptyReply]);

    const quiz = parseQuiz(text);
    if (!quiz) return refusal([MESSAGES.notJson]);

    const verdict = await window.MathPixQuizFormat.checkQuiz(quiz);
    if (!verdict.ok) return { ok: false, errors: verdict.errors };

    const store = window.MathPixQuizStore;
    if (!store || typeof store.set !== "function") {
      return refusal(["The quiz store has not loaded"]);
    }
    const held = store.set(quiz);
    if (!held.ok) return { ok: false, errors: held.errors };

    logInfo(`Quiz written and held (${held.count} questions)`);
    return { ok: true, quiz, warnings: verdict.warnings, usage };
  }

  window.MathPixQuizWriter = Object.freeze({
    VERSION,
    PURPOSE,
    DIFFICULTY,
    MIN_QUESTIONS,
    ASSUMED,
    loadPrompts,
    setPrompts,
    buildRequest,
    generate,
  });

  logInfo("Quiz writer ready");
})();
