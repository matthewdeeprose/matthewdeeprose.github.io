/**
 * @file captions-fixer-llm.js
 * @description The model adapter — the ONE place Captions Fixer talks to a
 * model. A stage hands it a system prompt, a user prompt, the JSON shape it
 * expects and the cue ids it sent; it returns a parsed object carrying only
 * ids the caller named, or an error the stage can act on. It never touches
 * `fetch`, streaming, provider names, or any DOM beyond one hidden sink.
 *
 * PUBLIC API
 * ----------
 *   init({ sinkId, temperature }) bind one OpenRouterEmbed to the hidden sink
 *   complete({ systemPrompt, userPrompt, schema, knownIds, model, pass, signal })
 *   estimate({ systemPrompt, userPrompt, model, pass })
 *   resolveModel({ model, pass }) the id one send would use, PASS_UNAVAILABLE
 *                               for a pass that does not run on this provider, or null
 *   plausibilityScoresFromReply(raw, knownIds)  stage `pl`: scores, or a named refusal
 *   outputTokensFor(pass, modelId) the output tokens per send estimate assumes
 *   requestOptionsFor(modelId)  one send's reply ceiling and reasoning effort
 *   getTemperature()            what is ON the instance, or null
 *   cancel()                    reject the in-flight complete()
 *   PASSES, MODEL_BY_PASS       frozen; DEFAULT_PASS is PASSES.RECURRING
 *
 * TEMPERATURE IS AN OPTION AND THE SHIPPED DEFAULT DID NOT MOVE
 * ------------------------------------------------------------
 * `init()` with no `temperature` leaves the embed's own 0.7 exactly where it
 * is. Round cf-4 measured the shipped prompt spanning 4, 5 and 17 proposals on
 * byte-identical input at n = 3, and nothing in this tool controlled the
 * sampling temperature; Stage 7e makes it settable so round cf-5 can measure 0
 * against that 0.7. What ships changes only if cf-5 earns it, on its own
 * evidence, as a separate decision.
 *
 * ON THE FOUNDRY PATH THE PARAMETER DOES NOT REACH THE WIRE AT ALL.
 * `providers/azure-openai-v1.js` matches the deployment against
 * REASONING_MODEL_PATTERNS (~:107) and drops `temperature`, `top_p`,
 * `frequency_penalty` and `presence_penalty` from the body before the request
 * is built (~:659-670). The drop is announced on one `logDebug` line (~:679),
 * below the house default of WARN, and `isReasoningModel` is module-private
 * (~:373), so the page cannot ask the question either. A Foundry round
 * therefore has no refusal to record and no wire to read, and must not be
 * reported as though it measured the parameter. The OpenRouter path forwards
 * it: core `buildOptions` copies `this.temperature` (~:1016) and
 * `providers/openrouter.js` `buildRequest` puts it on the body (~:108).
 *
 * WHY THE EMBED IS RESOLVED AT CALL TIME AND NOT AT LOAD
 * -----------------------------------------------------
 * openrouter-embed-core.js is a `type="module"` tag in tools.html (~:20770),
 * so it executes AFTER every classic script on the page; this file is a plain
 * script running at parse time (~:20712). `window.OpenRouterEmbed` is
 * therefore UNDEFINED while this file is being read, and so is
 * `window.EmbedQueueClass` (~:20755). Nothing here may capture either in
 * module scope: `init()` reaches for both, at call time, and returns false
 * rather than throwing when they are absent.
 *
 * THE SINK, AND WHY IT TAKES A THIRD OPTION THE DISPATCH DID NOT NAME
 * ------------------------------------------------------------------
 * A JSON reply still renders into the embed's container, so the container is a
 * sink rather than an output surface: `<div id="…" hidden>`, with
 * `showNotifications: false` so the embed raises no toast of its own.
 *
 * `announceContainer: false` is passed as well, and that is a DELIBERATE
 * addition. OpenRouterEmbed's constructor stamps `aria-live="polite"` and
 * `aria-atomic="true"` onto its container (core ~:225, applied at ~:3043)
 * unless that option says otherwise, in which case it writes `aria-live="off"`
 * and removes the atomic flag. The image manager's sink and multipass Pass 2
 * both rely on `hidden` alone, which works — a hidden element is out of the
 * accessibility tree, so the polite region is inert. But the programme's
 * standing rule is that this tool never creates a live region, and relying on
 * `hidden` leaves a real polite region one attribute removal away from
 * speaking every token of a streamed reply. Opting out costs one line and
 * makes the rule true of the markup rather than true by circumstance.
 *
 * `showStreamingProgress: false` is passed for the same reason: the sink is
 * not a place to paint a progress indicator nobody can see.
 *
 * THE QUEUE IS REACHED THROUGH `enqueueRequest`, NOT `sendRequest`
 * ---------------------------------------------------------------
 * Measured in core: `sendRequest` (~:1192) does NOT consult the queue. The
 * queue's entry point is `enqueueRequest` (~:4506), whose executor
 * `_executeQueuedRequest` (~:4848) is what calls `this.sendRequest`. So
 * `configureQueue({ enabled: true, concurrency: 1 })` followed by a direct
 * `sendRequest` leaves the queue configured and INERT. `complete` therefore
 * enqueues, and falls back to a direct send only when the queue handler could
 * not be built (its class script absent) — with a WARN, because a silent
 * fallback would make the serialisation promise untrue without saying so.
 *
 * A stub placed on `sendRequest` intercepts BOTH routes, because the executor
 * calls the instance method. That is what makes the suite's zero-send proof
 * hold whichever route a given page takes.
 *
 * JSON WITHOUT JSON MODE
 * ----------------------
 * The embed cannot pass `response_format` yet (Release 2, Stage 9), and
 * neither it nor the providers mention `json_schema` anywhere. So the system
 * prompt carries a fixed instruction block and `complete` parses tolerantly:
 * three candidates in order — the whole reply, then each fenced block's body,
 * then the first bracket-counted span (string-aware, so a brace inside a
 * quoted string cannot end the scan early) — first that parses wins. One retry
 * with a suffix appended to the user prompt, then a rejection carrying the raw
 * reply. Read `extractFencedBlocks` for why the candidate ORDER is the design
 * and a fence-stripping pass was not.
 *
 * KNOWN IDS ONLY, AND NOTHING IS REPAIRED
 * ---------------------------------------
 * Every item whose id is not one the caller sent is dropped and counted; so is
 * an item missing a required key. A merged cue — an item whose id names two
 * cues at once — is not a known id, so it drops by the same rule rather than
 * needing one of its own. Ids compare through `String()` on both sides, so a
 * model that returns 3 where the caller sent "3" is matched rather than
 * discarded. Nothing is coerced, split, guessed at or written back.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It holds no cap. A cap is the orchestrator's (Stage 6), and a cap is a stop
 * rather than a throw, so it cannot live in a function whose only exit for a
 * refusal is a rejected promise. It speaks nothing: no notification, no
 * announcement, no live region. It writes no storage. It never sends without a
 * caller asking.
 *
 * @module CaptionsFixerLLM
 * @since 7 September 2026
 */
const CaptionsFixerLLM = (function () {
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
      console.error(`[CaptionsFixerLLM] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CaptionsFixerLLM] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CaptionsFixerLLM] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CaptionsFixerLLM] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * The passes a caller can name. `recurring` is the discovery stage's pass
   * over the whole transcript; `pass` is the cue-level pass over the applied
   * captions (captions-fixer-stage-llm-pass.js); `plausibility` (stage `pl`,
   * 1 October 2026) is the score-only send after each chunk's cue-level send,
   * which proposes nothing.
   */
  const PASSES = Object.freeze({
    RECURRING: "recurring",
    PASS: "pass",
    PLAUSIBILITY: "plausibility",
  });

  /**
   * What `resolveModel` returns for a pass whose MODEL_BY_PASS entry is an
   * explicit `null` on the active provider: "this pass does not run here".
   * It is a string so every caller that treats the result as an id keeps
   * working, and it is namespaced so no registry id can equal it. A caller
   * that wants to know compares against this; `complete` refuses it as
   * NO_MODEL, and `estimate` reports it as `unavailable`.
   */
  const PASS_UNAVAILABLE = "captions-fixer:pass-unavailable";

  /** The tier `estimate` reports for an unavailable pass, which sends nothing. */
  const UNAVAILABLE_TIER = "unavailable";

  /**
   * Passes that NEVER fall through to the first eligible model (stage `pl`,
   * ruling 13, 1 October 2026). For these, a preferred id that is not in the
   * eligible list for the active provider (retired, disabled, or no eligible
   * model at all) resolves to PASS_UNAVAILABLE, because the fall-through would
   * send a model nobody measured for this pass. The recurring and cue-level
   * passes are not in it and fall through as they always did.
   */
  const PASSES_WITHOUT_FALL_THROUGH = Object.freeze([PASSES.PLAUSIBILITY]);

  /** What a caller naming no pass resolves to, with a WARN saying so. */
  const DEFAULT_PASS = PASSES.RECURRING;

  /**
   * The preferred model, keyed by pass and then by provider.
   *
   * Stage `dm`, Matthew's decision of 27 September 2026, replacing the one
   * default per provider (PREFERRED_BY_PROVIDER) that every pass shared. The
   * recurring pass stays on gpt-5.4-mini on both providers. The cue-level pass
   * moves to Fable 5.1 on OpenRouter on the evidence of rounds cf-6 and cf-7:
   * 0 harmful proposals in 133 kept against mini's 25 in 82, and mini
   * returned an empty list for 5 of 9 chunks at cf-7 C1. Foundry carries no
   * Anthropic model, so its pass entry stayed on mini until a successor was
   * measured.
   *
   * Stage `mp`, Matthew's decision of 1 October 2026, product owner: Foundry's
   * cue-level default is gpt-6-sol, "better overall and for Foundry the better
   * option". Round cf-10 (effort "low", a 16,000-token limit) kept 31 proposals
   * with 0 harm by ear, 0 of 55 clean captions touched, 33 of 254 hunks right;
   * mini's 25 harms in 82 kept proposals at cf-6 are the comparison. The
   * recurring pass does not move on either provider.
   *
   * An entry is a PREFERENCE, never a guarantee — the ladder in
   * `resolveModel` uses it only when the id is in the eligible list for the
   * active provider, and falls through to the first eligible model otherwise
   * (except for a pass in PASSES_WITHOUT_FALL_THROUGH, which is unavailable).
   *
   * Two provider keys is the whole set: ProviderSwitcher.KNOWN_PROVIDERS
   * carries exactly `openrouter` and `azure-openai`, so `getActive()` returns
   * nothing else, and `azure-responses` models are folded under
   * `azure-openai` inside getEligibleModels rather than being an active
   * provider in their own right.
   */
  const MODEL_BY_PASS = Object.freeze({
    [PASSES.RECURRING]: Object.freeze({
      openrouter: "openai/gpt-5.4-mini",
      "azure-openai": "azure-openai/gpt-5.4-mini",
    }),
    [PASSES.PASS]: Object.freeze({
      openrouter: "anthropic/claude-fable-5.1",
      // Stage `mp`, 1 October 2026: gpt-6-sol, on round cf-10. Was
      // azure-openai/gpt-5.4-mini.
      "azure-openai": "azure-openai/gpt-6-sol",
    }),
    // Stage `pl`, 1 October 2026: the plausibility score, on the one model
    // round cf-10 measured it on (Foundry). Stage `mp-2`, Matthew's decision of
    // 5 October 2026, product owner: "gpt-6-sol is the OpenRouter plausibility
    // model; it matches Fable's catch at a quarter of the cost." Round cf-11
    // at bar 3: gpt-6-sol caught 93 of 139 with 5 false alarms in 55 for about
    // $0.12 a lecture, Fable 92 and 4 for about $0.49, mini fails (42 caught,
    // 2 of 9 chunks unscored). This was an explicit null, which `resolveModel`
    // still reads as "this pass does not run on this provider"
    // (PASS_UNAVAILABLE) for any future null entry.
    [PASSES.PLAUSIBILITY]: Object.freeze({
      openrouter: "openai/gpt-6-sol",
      "azure-openai": "azure-openai/gpt-6-sol",
    }),
  });

  /** Used when ProviderSwitcher is absent, matching its own default. */
  const DEFAULT_PROVIDER_ID = "openrouter";

  /**
   * The one provider on which a model's declared request options are applied
   * (stage `ro`, decision 3): its registered reasoning effort and its
   * registered output limit.
   *
   * OpenRouter takes NEITHER of those. Its provider builds a `reasoning`
   * object of its own from an enabled instance (providers/openrouter.js
   * ~:120-135), which decision 4 keeps out, so reasoning is never switched on
   * there. Its reply LIMIT follows the model through the shared resolver
   * instead (parcel H-22, 4 October 2026): `requestOptionsFor` below.
   *
   * This comment used to read "OpenRouter sends exactly what it sent before",
   * which stopped being true of the limit at H-22 and is true of reasoning
   * still.
   */
  const FOUNDRY_PROVIDER_ID = "azure-openai";

  /** The sink the tool's article carries from Stage 8; created here until then. */
  const DEFAULT_SINK_ID = "captions-fixer-embed-sink";

  /**
   * The error reasons a stage can branch on. Frozen so a typo at a call site
   * is a lookup of undefined rather than a comparison that quietly never
   * matches. Each is carried on the rejected Error as `.reason`.
   */
  const ERRORS = Object.freeze({
    NOT_INITIALISED: "not-initialised",
    NO_MODEL: "no-model",
    PARSE: "parse",
    CANCELLED: "cancelled",
    SEND: "send",
    BAD_REQUEST: "bad-request",
    // The provider stopped the reply at its token limit (finish reason
    // "length"). Not a parse failure: the reply is not parsed, and it is never
    // sent again (parcel H-22).
    TRUNCATED: "truncated",
  });

  /** The finish reason a provider reports when a reply was cut off at its token limit. */
  const FINISH_REASON_LENGTH = "length";

  /**
   * Appended to every system prompt. The embed cannot pass `response_format`,
   * so this block is the only thing asking for JSON at all. Kept short and
   * fixed: it sits in the SYSTEM prompt, identical across chunks, which is
   * what lets automatic prompt caching see a stable prefix.
   */
  const JSON_ONLY_INSTRUCTION =
    "Reply with JSON only. No prose before or after it, and no code fences. " +
    "Return exactly the shape described, with no extra keys and no commentary.";

  /** Appended to the USER prompt on the one retry after a parse failure. */
  const PARSE_RETRY_SUFFIX =
    "\n\nYour previous reply could not be parsed as JSON. " +
    "Reply again with JSON only: no prose, no code fences, nothing else.";

  /** How many times the user prompt is sent for one `complete` call. */
  const MAX_PARSE_ATTEMPTS = 2;

  /**
   * A fenced code block, capturing its BODY. Built from its code point rather
   * than typed, because a literal backtick run inside a comment or a grep
   * needle is exactly the quote-safe-marker trap: a needle spanning a
   * backtick reads zero for the wrong reason and a zero looks like a pass.
   */
  const FENCE_MARKER = String.fromCharCode(96).repeat(3);
  const FENCE_PATTERN = new RegExp(
    `${FENCE_MARKER}[a-zA-Z]*\\s*([\\s\\S]*?)\\s*${FENCE_MARKER}`,
    "g",
  );

  /** Token estimation. Four characters to a token is the house approximation. */
  const CHARS_PER_TOKEN = 4;

  /**
   * What `estimate` assumes a reply will cost for a pass and model with no
   * measured figure in OUTPUT_TOKENS_BY_PASS_AND_MODEL below.
   *
   * RAISED FROM 1,000 TO 2,000 AT STAGE 7b, ON MEASUREMENT. Round cf-1 read
   * 1,403.5 reported output tokens for `openai/gpt-5.4-mini` and 728.75 for
   * `openai/gpt-5.4` on a 55-minute transcript — 40 per cent above the old
   * assumption for the one and 27 per cent below it for the other. An hour's
   * lecture is longer than the fixture, so the assumption is set above the
   * larger of the two rather than between them: an estimate that under-reports
   * is the one that surprises somebody with a bill.
   *
   * Those two figures are NOT provider counts — see the note on
   * `MAX_OUTPUT_TOKENS` below — but they are the only readings of a real reply
   * this project had until cf-7, and reply LENGTH is what they measure correctly.
   */
  const OUTPUT_TOKENS_FALLBACK = 2000;

  /**
   * Output tokens per send, measured, keyed by pass and then by model id.
   * Stage `dm`, 27 September 2026, replacing first the one OUTPUT_TOKENS_ASSUMED
   * every model shared and then a map keyed by model alone, which carried a
   * figure measured on the cue-level pass into the recurring pass.
   *
   * THE TWO MEASURED ENTRIES ARE PROVIDER COUNTS, unlike cf-1's figures above:
   * the mean `completion_tokens` in the provider's own usage over the nine
   * sends of one round's cell C1 (the shipped pass prompt), one copy per
   * (chunk, attempt). Run files, by SHA-256 prefix:
   *   anthropic/claude-fable-5.1/C1-run1.json  9516d732b7f6837d  sum 20,069, mean 2,229.9
   *     (round cf-7, the 520-cue export)
   *   azure-openai/gpt-6-sol/C1-run1.json      1d9c62d59330ab89  sum 7,841, mean 871.2
   *     (round cf-10, stage `mp`, 1 October 2026, nine send records in the
   *     run's .sends folder, one attempt per chunk)
   * Each run's summed `cost` reproduces its score document exactly (Fable
   * $1.242780 at cf-7-score.md; gpt-6-sol $0.112214 at $2 / $10 per million,
   * the run file's own measuredUsd), which is the control that the right
   * records were read. Fable's figure is 64 per cent reasoning tokens and
   * gpt-6-sol's 39.5, which the provider bills as output: both figures
   * include reasoning.
   *
   * MINI HAS NO ENTRY, AND ITS C1 MEAN OF 436 IS WITHDRAWN: five of its nine
   * replies were an empty list (5 to 11 tokens each), so the mean describes
   * the empty lists rather than what a reply from mini costs.
   *
   * THE RECURRING PASS HAS NO MEASURED FIGURE ON ANY MODEL. Its entry is
   * empty, so every recurring estimate takes OUTPUT_TOKENS_FALLBACK, as does
   * any pair absent here — Foundry's `azure-openai/gpt-5.4-mini` included.
   * The cue-level pass on `azure-openai/gpt-6-sol` is measured, above.
   *
   * THE PLAUSIBILITY PASS ON gpt-6-sol IS MEASURED TOO: 398, the mean
   * `completion_tokens` over the four measured sends of round cf-10's cell C5
   * (266, 442, 442, 442; sum 1,592), reasoning inside it (16, 11, 11, 11). The
   * fifth send of that cell was an HTTP 429 carrying no usage and is not in the
   * mean. At $2 and $10 per million the four sends cost $0.029024.
   *
   * ON OPENROUTER (stage `mp-2`) THE SAME PASS IS 888: the mean completion
   * tokens over the nine sends of round cf-11's P2, reasoning inside it, from
   * 589 to 1,405. It is measured as the app sends it there, with no reasoning
   * effort, so it is not like-for-like with Foundry's 398 at effort low.
   */
  const OUTPUT_TOKENS_BY_PASS_AND_MODEL = Object.freeze({
    [PASSES.RECURRING]: Object.freeze({}),
    [PASSES.PASS]: Object.freeze({
      "anthropic/claude-fable-5.1": 2230,
      "azure-openai/gpt-6-sol": 871,
    }),
    [PASSES.PLAUSIBILITY]: Object.freeze({
      "azure-openai/gpt-6-sol": 398,
      "openai/gpt-6-sol": 888,
    }),
  });

  /**
   * The reply ceiling this adapter sets on its own embed, in tokens.
   *
   * The embed's own default is 2,000 (openrouter-embed-core.js ~:64). A model
   * that runs out of ceiling mid-array produces JSON nobody can parse, and the
   * send is paid for either way; raising the ceiling costs nothing when it is
   * not reached. cf-1's longest reply was ~1,403 tokens, which is within 600 of
   * the old default — close enough that a longer lecture would reach it.
   *
   * The harness set this by hand on the instance for round cf-1. It belongs to
   * the product, so the product sets it and the harness stops needing to.
   *
   * WHERE cf-1's OUTPUT FIGURES ACTUALLY CAME FROM, because it decides how much
   * weight they carry. `complete` reads `response.metadata.tokens`, which for
   * OpenRouter is built at js/openrouter-client/openrouter-client-stream.js
   * ~:454-460 as `{ prompt_tokens: this.totalPromptTokens || 0,
   * completion_tokens: fullResponse.length / 4, ... }` — a CHARACTER ESTIMATE
   * carrying the comment "Rough estimation based on characters", not a count
   * the provider reported. That is why cf-1 saw a zero input and a fractional
   * output, and it is why `usageRaw` below is kept verbatim rather than
   * trusted. The embed is not fixed here; Stage 7b reports it.
   */
  const MAX_OUTPUT_TOKENS = 4000;

  /**
   * The most this tool ever asks one OpenRouter model for in a reply, and the
   * ceiling it hands the shared resolver (js/model-output-budget.js).
   *
   * PARCEL H-22, 4 October 2026, after round cf-8 and Matthew's instruction
   * that "we keep hitting this type of issue lately so we need to be more
   * flexible for limits". On OpenRouter the limit sent is
   * `min(CAPTIONS_OUTPUT_CEILING, the model's published ceiling)`, and
   * MAX_OUTPUT_TOKENS above is now only the FALLBACK: what an unknown model, or
   * a page without the resolver, still sends. 16,000 is the figure the Foundry
   * registrations already chose for this tool (stage `ro`, round cf-9), so the
   * two providers ask for the same most.
   */
  const CAPTIONS_OUTPUT_CEILING = 16000;

  /** Registry `costs` are quoted per million tokens. */
  const TOKENS_PER_COST_UNIT = 1000000;

  /** `estimate`'s tier when the model is not in the registry. */
  const UNKNOWN_TIER = "unknown";

  /**
   * How many sends `estimate` assumes when a caller does not say. One, so every
   * call written before Stage 15 reports exactly what it always did.
   */
  const DEFAULT_SENDS = 1;

  /** How long `cancel()` is given to settle the in-flight promise. */
  const CANCEL_TIMEOUT_MS = 2000;

  /** The reason string `cancel()` hands the embed's own cancellation path. */
  const CANCEL_REASON = "Captions Fixer cancelled the request";

  // ==========================================================================
  // THE PLAUSIBILITY PASS — stage `pl`, 1 October 2026
  // ==========================================================================

  /**
   * A caption scoring AT OR BELOW this, and carrying no proposal, becomes a
   * "Check this caption" row (the stage that reads it, a later iteration).
   *
   * Matthew's decision of 1 October 2026, on round cf-10 (gpt-6-sol, effort
   * "low", a 16,000-token limit): at bar 3 the score caught 98 of the 139
   * erroneous captions (70.5 per cent) with 5 false alarms in 55 clean
   * captions; at bar 2 it caught 65 of 139 with 0 of 55. Scores run 1 to 5.
   */
  const PLAUSIBILITY_BAR = 3;

  /** The scale the prompt asks for; a score outside it is `invalid`. */
  const PLAUSIBILITY_SCORE_MIN = 1;
  const PLAUSIBILITY_SCORE_MAX = 5;

  /** The reply is one JSON object, never the array schema's list. */
  const PLAUSIBILITY_SCHEMA = Object.freeze({ type: "object" });

  /** Joins the prompt's four blocks, as the driver that measured it did. */
  const PLAUSIBILITY_BLOCK_SEPARATOR = "\n\n";

  /**
   * THE GLOSSARY LINE IS FIXED AT "none supplied", AS MEASURED. Round cf-10
   * sent exactly this, so its recall describes this prompt and no other. A
   * glossary-aware variant is out of scope until a round measures one; a person
   * who supplies terms still gets this line on this pass.
   */
  const PLAUSIBILITY_GLOSSARY_LINE = "Known terms for this module: none supplied.";

  /**
   * The plausibility system prompt, word for word the driver's constant
   * (.claude/a11y/sr/cf-6-drive.mjs `CF10_PLAUSIBILITY_SYSTEM`): 806
   * characters, SHA-256
   * 025eb53ba07dffe33e71d368abe08afda1324df3b0db7bb5de48d4d742d75ced.
   * The digest is asserted as a string by the suite, so an edit here that the
   * measurement does not cover reddens a row. It asks for scores and proposes
   * nothing.
   */
  const PROMPT_PLAUSIBILITY = [
    "You are a captioning editor for UK university lecture recordings. " +
      "Below is part of an automatic speech recogniser's transcript of one lecture, one caption per line, in the order the words were spoken.",
    "Do not correct anything and do not propose any text. " +
      "For each caption you may score, judge only whether it reads as a sensible sentence in context. " +
      "Score 1 if it does not read as a sentence anyone would say, and 5 if it reads as a sensible sentence in its context. Use the whole scale.",
    PLAUSIBILITY_GLOSSARY_LINE,
    "Reply with a JSON object at the top level, and nothing else. " +
      "Each key is the number in square brackets at the start of a caption you may score, written as a string; each value is the integer score from 1 to 5. " +
      "Score every caption you may score, once, and add no other key.",
  ].join(PLAUSIBILITY_BLOCK_SEPARATOR);

  /**
   * The plausibility user prompt's range sentence (133 characters), the
   * driver's `CF10_PLAUSIBILITY_RANGE_TEMPLATE`. `{first}` and `{last}` are the
   * chunk's own primary ids. It replaces the shipped user prompt's one range
   * paragraph and the cue lines stay byte for byte.
   */
  const PLAUSIBILITY_RANGE_TEMPLATE =
    "You may score captions {first} to {last} only. The other captions are here so you can read across the join; never score one of those.";

  /** How the shipped user prompt's range paragraph opens, which it must. */
  const PLAUSIBILITY_SHIPPED_RANGE_LEAD = "You may change captions ";

  // ==========================================================================
  // MODULE STATE
  // ==========================================================================

  /** The one embed instance, or null before `init` and after a failed one. */
  let embed = null;

  /** The sink element `init` bound to, kept so `init` can be called twice. */
  let sinkElement = null;

  /** True when `init` created the sink itself rather than finding it. */
  let sinkWasCreated = false;

  /**
   * The in-flight call's cancel hook, or null. One at a time by design: the
   * queue runs at concurrency 1 and a stage sends one chunk at a time, so a
   * second concurrent `complete` is a caller bug rather than a case to serve.
   */
  let inFlightReject = null;

  // ==========================================================================
  // HELPERS — every global reached at CALL time, guarded
  // ==========================================================================

  /**
   * The active provider, defaulting the way ProviderSwitcher itself does.
   * @returns {string}
   */
  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.getActive !== "function") {
      logWarn("ProviderSwitcher unavailable; assuming the default provider");
      return DEFAULT_PROVIDER_ID;
    }
    const active = switcher.getActive();
    return typeof active === "string" && active.trim()
      ? active
      : DEFAULT_PROVIDER_ID;
  }

  /**
   * The eligible models for one provider. NO capability filter: this tool
   * sends text, so a vision filter would exclude models that can do the job.
   * No `embed` is passed either — that argument turns on a configured-ness
   * gate which, for Foundry, reports false whenever no CUSTOM proxy is set
   * even though the built-in Worker makes Foundry usable (credential KB
   * § 2.3, § 7.1). Passing it would make the Foundry branch almost never fire.
   * @param {string} providerId
   * @returns {Array<object>} possibly empty, never null
   */
  function eligibleModels(providerId) {
    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getEligibleModels !== "function") {
      logWarn("EmbedModelSelector unavailable; no models can be resolved");
      return [];
    }
    try {
      const models = selector.getEligibleModels({ providerId: providerId });
      return Array.isArray(models) ? models : [];
    } catch (error) {
      logWarn("getEligibleModels failed:", error);
      return [];
    }
  }

  /**
   * One registry entry, or null. `silent` is true so an unknown id is a null
   * rather than a warning the caller cannot act on — `estimate` asks about
   * models a person may have typed.
   * @param {string} modelId
   * @returns {object|null}
   */
  function registryModel(modelId) {
    const registry = window.modelRegistry;
    if (!registry || typeof registry.getModel !== "function") {
      logWarn("window.modelRegistry unavailable");
      return null;
    }
    try {
      return registry.getModel(modelId, true) || null;
    } catch (error) {
      logWarn(`getModel('${modelId}') failed:`, error);
      return null;
    }
  }

  // ==========================================================================
  // PER-SEND REQUEST OPTIONS — stage `ro`
  // ==========================================================================

  /**
   * The reply limit for one OpenRouter send: the shared resolver's answer, or
   * MAX_OUTPUT_TOKENS when the resolver is not on the page or refuses.
   *
   * The resolver is reached at CALL time and through `window`, because it is a
   * plain script that loads after this one. It throws on a caller bug (an id
   * that is not a non-empty string); that is caught here and WARNed rather than
   * allowed to stop a send over a limit, and what is sent is then the old
   * fixed figure, never nothing.
   *
   * @param {string} modelId
   * @returns {number}
   */
  function openRouterLimitFor(modelId) {
    const budget = window.ModelOutputBudget;
    if (!budget || typeof budget.for !== "function") {
      logWarn(`openRouterLimitFor: the output budget resolver is absent; sending ${MAX_OUTPUT_TOKENS}`);
      return MAX_OUTPUT_TOKENS;
    }
    try {
      return budget.for(modelId, {
        toolCeiling: CAPTIONS_OUTPUT_CEILING,
        fallback: MAX_OUTPUT_TOKENS,
      });
    } catch (error) {
      logWarn(`openRouterLimitFor: the resolver refused '${String(modelId)}' (${error && error.message}); sending ${MAX_OUTPUT_TOKENS}`);
      return MAX_OUTPUT_TOKENS;
    }
  }

  /**
   * What one send asks of the instance: the reply ceiling and, where a model
   * declares one, a reasoning effort.
   *
   * FOUNDRY: READ OFF THE REGISTRATION. A registration may carry
   * `metadata.maxOutputTokens` and `metadata.reasoningEffort`
   * (js/foundry-model-definitions.js, stage `ro` iteration 1; `metadata` is the
   * one block registerModel keeps whole). Those are this tool's own chosen
   * settings, which is why the shared resolver does not read them (H-21b).
   *
   * OPENROUTER: THE LIMIT FOLLOWS THE MODEL, AND NO EFFORT IS EVER SET
   * (parcel H-22). The limit is the shared resolver's
   * `min(CAPTIONS_OUTPUT_CEILING, the model's published ceiling)`, falling
   * back to MAX_OUTPUT_TOKENS for a model with no published ceiling or a page
   * without the resolver. Reasoning stays off whatever the id — an explicit
   * Foundry id included — because decision 4 keeps it off that provider.
   *
   * A declared limit that is not a positive whole number is ignored with a
   * WARN rather than handed to `setMaxTokens`, which throws on it.
   *
   * @param {string} modelId the id `resolveModel` returned
   * @returns {{ maxOutputTokens: number, reasoningEffort: string|null }}
   */
  function requestOptionsFor(modelId) {
    const options = { maxOutputTokens: MAX_OUTPUT_TOKENS, reasoningEffort: null };
    if (activeProvider() !== FOUNDRY_PROVIDER_ID) {
      options.maxOutputTokens = openRouterLimitFor(modelId);
      return options;
    }

    const model = registryModel(modelId);
    const metadata = model && model.metadata ? model.metadata : null;
    if (!metadata) return options;

    const limit = metadata.maxOutputTokens;
    if (limit !== undefined && limit !== null) {
      if (typeof limit === "number" && isFinite(limit) && limit >= 1 && Math.floor(limit) === limit) {
        options.maxOutputTokens = limit;
      } else {
        logWarn(`requestOptionsFor: '${modelId}' declares maxOutputTokens ${String(limit)}; sending ${MAX_OUTPUT_TOKENS}`);
      }
    }

    const effort = metadata.reasoningEffort;
    if (typeof effort === "string" && effort.trim()) options.reasoningEffort = effort;
    return options;
  }

  /**
   * Put one send's options on the instance and return what was there before.
   *
   * The ceiling is always written, so a send carries its own model's limit
   * rather than whatever the previous send left. Reasoning is switched on only
   * when an effort is declared; the core forwards `reasoning` only while it is
   * enabled (openrouter-embed-core.js ~:1037), which is the one route the
   * Foundry adapter reads the effort from.
   *
   * @param {object} instance the bound embed
   * @param {{ maxOutputTokens: number, reasoningEffort: string|null }} options
   * @returns {{ maxTokens: number, reasoningEnabled: boolean, reasoningEffort: string|null }}
   */
  function applyRequestOptions(instance, options) {
    const found = instance.getReasoningConfig();
    const prior = {
      maxTokens: instance.max_tokens,
      reasoningEnabled: found.enabled === true,
      reasoningEffort: found.effort === undefined ? null : found.effort,
    };
    instance.setMaxTokens(options.maxOutputTokens);
    if (options.reasoningEffort !== null) {
      instance.configureReasoning({ enabled: true, effort: options.reasoningEffort });
    }
    return prior;
  }

  /**
   * Put back what `applyRequestOptions` found. Called from `complete`'s
   * `finally`, so a send that throws, is cancelled or fails to parse leaves
   * the instance as it was before the send.
   *
   * @param {object} instance the bound embed
   * @param {{ maxTokens: number, reasoningEnabled: boolean, reasoningEffort: string|null }} prior
   * @returns {void}
   */
  function restoreRequestOptions(instance, prior) {
    instance.setMaxTokens(prior.maxTokens);
    instance.configureReasoning({ enabled: prior.reasoningEnabled, effort: prior.reasoningEffort });
  }

  /**
   * An Error carrying a machine-readable reason and whatever context a stage
   * needs. `reason` is one of ERRORS.
   * @param {string} reason
   * @param {string} message
   * @param {object} [extra]
   * @returns {Error}
   */
  function adapterError(reason, message, extra) {
    const error = new Error(message);
    error.reason = reason;
    if (extra && typeof extra === "object") Object.assign(error, extra);
    return error;
  }

  // ==========================================================================
  // TOLERANT JSON PARSE
  // ==========================================================================

  /**
   * The BODY of every fenced code block in `text`, in order.
   *
   * WHY THIS REPLACED A "STRIP THE FENCES" HELPER, MEASURED 7 SEPTEMBER 2026.
   * The first version of this module stripped fence markers and then bracket-
   * scanned the result. The inversion written to bind that behaviour reddened
   * ZERO of its four rows, because stripping makes no difference to a scan
   * that finds the first `[` either way — the helper was inert and the rows
   * naming it were proving something else. Worse, neither arrangement handled
   * the case that actually breaks a bracket scan: PROSE CONTAINING A BRACKET
   * before the JSON ("here are the corrections [three of them]:"), where the
   * scan locks on to the prose and the parse fails.
   *
   * Extracting the fenced bodies as CANDIDATES fixes both. `parseTolerantly`
   * now tries the whole reply, then each fenced body, then the bracket scan,
   * and takes the first that parses — so a fenced reply wrapped in bracketed
   * prose parses through the fence, and removing this function makes those
   * replies fail. The behaviour is load-bearing, which is what makes the rows
   * naming it real.
   *
   * @param {string} text
   * @returns {Array<string>} possibly empty
   */
  function extractFencedBlocks(text) {
    const bodies = [];
    FENCE_PATTERN.lastIndex = 0;
    let match = FENCE_PATTERN.exec(text);
    while (match) {
      bodies.push(match[1]);
      match = FENCE_PATTERN.exec(text);
    }
    return bodies;
  }

  /**
   * The span of the first complete JSON value in `text`, or null.
   *
   * Bracket-counted rather than "first `{` to last `}`", and STRING-AWARE: a
   * brace or bracket inside a quoted string must not change the depth, or a
   * cue whose text contains one would truncate the scan. Escapes are honoured
   * so a quote inside a string cannot end it early.
   *
   * @param {string} text
   * @returns {{ start: number, end: number }|null}
   */
  function findJsonSpan(text) {
    const openers = { "{": "}", "[": "]" };
    let start = -1;
    for (let index = 0; index < text.length; index += 1) {
      if (openers[text[index]]) {
        start = index;
        break;
      }
    }
    if (start === -1) return null;

    const closer = openers[text[start]];
    const opener = text[start];
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === opener) depth += 1;
      else if (character === closer) {
        depth -= 1;
        if (depth === 0) return { start: start, end: index + 1 };
      }
    }
    return null;
  }

  /**
   * Parse a model reply into a value, tolerating fences and surrounding prose.
   *
   * THREE CANDIDATES, IN ORDER, FIRST THAT PARSES WINS:
   *   1. the whole reply, trimmed — a model that obeyed the instruction;
   *   2. each fenced block's body, in order — a model that wrapped it;
   *   3. the first bracket-counted span in the reply — a model that talked
   *      around it.
   *
   * The order matters. A bracket scan is the loosest of the three and would
   * happily lock on to a bracket in the prose, so it goes last; the fenced
   * body is a far better claim about where the JSON is, and it goes ahead of
   * it. The scan is deliberately NOT retried at later bracket positions: that
   * is a fishing expedition, and a fragment that happens to be valid JSON but
   * is not the reply is worse than an honest parse failure a retry can fix.
   *
   * @param {string} text
   * @returns {{ ok: true, value: *, via: string }|{ ok: false, error: string }}
   */
  function parseTolerantly(text) {
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "the reply was empty" };
    }

    const attempt = (candidate, via) => {
      if (typeof candidate !== "string" || !candidate.trim()) return null;
      try {
        return { ok: true, value: JSON.parse(candidate), via: via };
      } catch (error) {
        return null;
      }
    };

    const whole = attempt(text.trim(), "whole");
    if (whole) return whole;

    // Reached THROUGH the exported object, never through the closure, so a
    // suite that patches one property inverts the product too. An unpatchable
    // seam is an unprovable one — the same arrangement, for the same reason,
    // as DEFAULT_GUARDS in captions-fixer-guards.js.
    for (const body of api.extractFencedBlocks(text)) {
      const fenced = attempt(body.trim(), "fence");
      if (fenced) return fenced;
    }

    const span = api.findJsonSpan(text);
    if (!span) {
      return { ok: false, error: "no JSON object or array was found" };
    }
    const scanned = attempt(text.slice(span.start, span.end), "scan");
    if (scanned) return scanned;

    return {
      ok: false,
      error:
        "the reply carried no JSON that parses: not whole, not in a fence, and not in the first bracketed span",
    };
  }

  // ==========================================================================
  // SCHEMA AND KNOWN-ID FILTERING
  // ==========================================================================

  /**
   * Are two ids the same id? Compared through `String()` on BOTH sides, so a
   * model returning `3` where the caller sent `"3"` is matched rather than
   * discarded. Its own function, and reached through the exported object, so
   * the coercion is a thing a row can name and a suite can invert on its own
   * rather than a `String()` buried inside a filter.
   * @param {*} a
   * @param {*} b
   * @returns {boolean}
   */
  function sameId(a, b) {
    return String(a) === String(b);
  }

  /**
   * Does one item carry every required key with a value that is not undefined
   * or null? Types are checked only where the schema names one.
   * @param {object} item
   * @param {Array<string>} requiredKeys
   * @param {object} [types] key -> "string" | "number" | "boolean" | "object"
   * @returns {boolean}
   */
  function itemSatisfies(item, requiredKeys, types) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    for (const key of requiredKeys) {
      const value = item[key];
      if (value === undefined || value === null) return false;
      const expected = types && types[key];
      if (!expected) continue;
      if (expected === "object") {
        if (typeof value !== "object") return false;
      } else if (typeof value !== expected) {
        return false;
      }
    }
    return true;
  }

  /**
   * Keep only the items a caller can act on: those carrying every required key
   * and an id the caller actually sent. NOTHING IS REPAIRED — an item that
   * fails either test is dropped and counted, never coerced or split.
   *
   * A merged cue (an id naming two cues at once, "12+13") needs no rule of its
   * own: it is not in `knownIds`, so it drops with the unknown ids.
   *
   * `knownIds` being absent means the caller has no id list to check against —
   * a discovery send over the whole transcript, for instance — and the id
   * filter is then skipped rather than dropping everything. The required-key
   * check still runs.
   *
   * @param {*} value the parsed reply
   * @param {object} [schema] { type, items: { requiredKeys, types, idKey } }
   * @param {Array<string|number>} [knownIds]
   * @returns {{ data: *, discarded: number }}
   */
  function applySchema(value, schema, knownIds) {
    const spec = (schema && schema.items) || {};
    const requiredKeys = Array.isArray(spec.requiredKeys)
      ? spec.requiredKeys
      : [];
    const idKey = typeof spec.idKey === "string" ? spec.idKey : null;
    const known = Array.isArray(knownIds) ? knownIds.slice() : null;

    // An object-shaped schema is returned whole: it carries no per-item ids to
    // filter and no list to count discards against.
    if (!Array.isArray(value)) {
      if (schema && schema.type === "array") {
        logWarn("The reply was not an array where the schema asked for one");
        return { data: [], discarded: 0 };
      }
      return { data: value, discarded: 0 };
    }

    const kept = [];
    let discarded = 0;
    for (const item of value) {
      if (!itemSatisfies(item, requiredKeys, spec.types)) {
        discarded += 1;
        continue;
      }
      if (
        idKey &&
        known &&
        !known.some((candidate) => api.sameId(candidate, item[idKey]))
      ) {
        discarded += 1;
        continue;
      }
      kept.push(item);
    }
    if (discarded > 0) {
      logInfo(`${discarded} item(s) discarded, ${kept.length} kept`);
    }
    return { data: kept, discarded: discarded };
  }

  // ==========================================================================
  // MODEL RESOLUTION
  // ==========================================================================

  /**
   * The id one send would use, or null when nothing resolves.
   *
   * The ladder copies `_resolveModel` at
   * mathpix-scripts/ai-alt-text/alt-text-cloud-adapter.js:246, with the
   * capability filter deliberately dropped (see `eligibleModels`):
   *   1. an explicit `options.model` wins outright, whatever pass is named;
   *   2. otherwise the named pass's entry in MODEL_BY_PASS for the active
   *      provider, when that id is in the eligible list;
   *   3. otherwise the first eligible model, with a WARN naming what was
   *      wanted — a fall-through is a fact worth seeing in a log, because the
   *      benchmark that chose the preferred id no longer describes the send;
   *   4. otherwise null.
   *
   * Before step 2, a pass whose entry for the active provider is an explicit
   * `null` resolves to PASS_UNAVAILABLE: never a model, never a throw, never a
   * fall-through. And a pass in PASSES_WITHOUT_FALL_THROUGH (the plausibility
   * pass, ruling 13) skips step 3: when its preferred id is not eligible, or
   * nothing is, it resolves to PASS_UNAVAILABLE rather than to another model
   * or to null. The recurring and cue-level passes carry no null and are not
   * in that list, so they fall through as they always did.
   *
   * A MISSING OR UNKNOWN PASS IS NOT A HALT. It resolves as DEFAULT_PASS, the
   * recurring pass, and logs a WARN, so a caller that has not been taught its
   * pass name keeps working on the model it has always had. The recurring
   * stage is such a caller by decision: it reaches this through `estimate`
   * and `complete` without naming a pass.
   *
   * @param {object} [options]
   * @param {string} [options.model] explicit override
   * @param {string} [options.pass] a value of PASSES: 'recurring', 'pass' or 'plausibility'
   * @returns {string|null} a model id, PASS_UNAVAILABLE, or null
   */
  function resolveModel(options) {
    const opts = options || {};

    if (typeof opts.model === "string" && opts.model.trim()) {
      logDebug(`resolveModel: explicit model '${opts.model}'`);
      return opts.model;
    }

    const named = Object.prototype.hasOwnProperty.call(MODEL_BY_PASS, opts.pass);
    const passName = named ? opts.pass : DEFAULT_PASS;
    if (!named) {
      logWarn(`resolveModel: no known pass named (${String(opts.pass)}); resolving the '${DEFAULT_PASS}' pass's model`);
    }

    const provider = activeProvider();

    // An EXPLICIT null preference is "this pass does not run on this provider".
    // It is read before the eligible list on purpose: no model, eligible or
    // not, is the right answer, and falling through would send one nobody
    // measured. Only null counts; an absent key still falls through as before.
    if (MODEL_BY_PASS[passName][provider] === null) {
      logDebug(`resolveModel: the '${passName}' pass is unavailable on provider '${provider}'`);
      return PASS_UNAVAILABLE;
    }

    const eligible = eligibleModels(provider);
    const preferredId = MODEL_BY_PASS[passName][provider];
    const preferred = preferredId
      ? eligible.find((model) => model && model.id === preferredId)
      : undefined;

    // A pass that never falls through is unavailable when its own model is
    // not eligible, empty list included: no other model is the right answer.
    if (!preferred && PASSES_WITHOUT_FALL_THROUGH.includes(passName)) {
      logWarn(
        `resolveModel: preferred id '${preferredId}' for the '${passName}' pass is not eligible for provider '${provider}'; the pass does not run here`,
      );
      return PASS_UNAVAILABLE;
    }

    if (eligible.length === 0) {
      logWarn(`resolveModel: no eligible models for provider '${provider}'`);
      return null;
    }

    if (!preferred) {
      logWarn(
        `resolveModel: preferred id '${preferredId}' for the '${passName}' pass is not eligible for provider '${provider}'; falling through to '${eligible[0].id}'`,
      );
      return eligible[0].id;
    }

    logDebug(`resolveModel: '${preferred.id}' for the '${passName}' pass on provider '${provider}'`);
    return preferred.id;
  }

  // ==========================================================================
  // THE PLAUSIBILITY REPLY — six refusals, by name
  // ==========================================================================

  /**
   * The six reasons a plausibility reply is refused, IN THE ORDER THEY ARE
   * TESTED, named as the driver that measured the pass names them
   * (.claude/a11y/sr/cf-6-drive.mjs `cf10ScoresFromReply`, `:1033-1052`). A
   * refused reply leaves its chunk UNSCORED: never retried, never repaired, and
   * no score from it used. The stage records which refusal it was.
   *
   *   unparseable  not JSON at all
   *   shape        JSON that is not an object (a number, a string, null)
   *   proposes     an array, or any value that is text or an object: the
   *                reply is proposing, not scoring
   *   outside      a key that is not one of the chunk's ids
   *   omitted      an id of the chunk with no numeric score
   *   invalid      a score that is not an integer from 1 to 5
   */
  const PLAUSIBILITY_REFUSALS = Object.freeze(["unparseable", "shape", "proposes", "outside", "omitted", "invalid"]);

  /**
   * One predicate per refusal, each taking the reading `readingOfReply`
   * builds and returning true to REFUSE. Deliberately NOT frozen, and reached
   * through the exported object, so a suite can switch ONE refusal off and
   * redden exactly the rows that name it; frozen, no refusal could be bound
   * on its own. Each reads `ctx.value` defensively, so a predicate switched
   * off never makes a later one throw.
   */
  const plausibilityRefusalTests = {
    unparseable: (ctx) => !ctx.parsed || !ctx.parsed.ok,
    shape: (ctx) => ctx.value === null || typeof ctx.value !== "object",
    proposes: (ctx) =>
      Array.isArray(ctx.value) ||
      ctx.keys.some((key) => typeof ctx.value[key] === "string" || (ctx.value[key] !== null && typeof ctx.value[key] === "object")),
    outside: (ctx) => ctx.keys.some((key) => ctx.known.indexOf(key) === -1),
    omitted: (ctx) => ctx.known.some((id) => ctx.numeric.indexOf(id) === -1),
    invalid: (ctx) =>
      ctx.numeric.some(
        (key) =>
          !Number.isInteger(ctx.value[key]) ||
          ctx.value[key] < PLAUSIBILITY_SCORE_MIN ||
          ctx.value[key] > PLAUSIBILITY_SCORE_MAX,
      ),
  };

  /**
   * What the six predicates read, built once per reply from the shipped
   * tolerant parse, so the reply is parsed exactly the way `complete` parses
   * every other.
   * @param {*} raw
   * @param {Array<string|number>} knownIds
   * @returns {{ parsed: object, value: *, keys: Array<string>, known: Array<string>, numeric: Array<string> }}
   */
  function readingOfReply(raw, knownIds) {
    const parsed = api.parseTolerantly(typeof raw === "string" ? raw : "");
    const value = parsed.ok ? parsed.value : undefined;
    const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
    const keys = isObject ? Object.keys(value) : [];
    const known = Array.isArray(knownIds) ? knownIds.map(String) : [];
    const numeric = keys.filter((key) => known.indexOf(key) > -1 && typeof value[key] === "number");
    return { parsed: parsed, value: value, keys: keys, known: known, numeric: numeric };
  }

  /**
   * One chunk's raw plausibility reply to a map of id to score, or the NAME of
   * the first refusal that applies. Reads the RAW reply and not `complete`'s
   * `data`: an array schema reads an object reply as an empty list, so the
   * pass sends PLAUSIBILITY_SCHEMA, and the raw is what this reads either way.
   *
   * @param {string} raw the reply text
   * @param {Array<string|number>} knownIds the chunk's primary ids
   * @returns {{ ok: boolean, reason: string, scores: Object<string, number>|null }}
   */
  function plausibilityScoresFromReply(raw, knownIds) {
    const ctx = readingOfReply(raw, knownIds);
    for (const reason of PLAUSIBILITY_REFUSALS) {
      if (api.plausibilityRefusalTests[reason](ctx)) {
        return { ok: false, reason: reason, scores: null };
      }
    }
    const scores = {};
    ctx.numeric.forEach((key) => {
      scores[key] = ctx.value[key];
    });
    return { ok: true, reason: "", scores: scores };
  }

  /**
   * The plausibility user prompt for one chunk: the shipped user prompt with
   * its ONE range paragraph (the text up to the first blank line) replaced by
   * the template, the cue lines kept byte for byte. A shipped prompt that does
   * not open with its range paragraph is refused as null and never rewritten,
   * because a rewrite of an unrecognised prompt would send something nobody
   * measured.
   *
   * @param {string} shippedUserPrompt the cue-level pass's user prompt
   * @param {string|number} firstId the chunk's first primary id
   * @param {string|number} lastId the chunk's last primary id
   * @returns {string|null}
   */
  function buildPlausibilityUserPrompt(shippedUserPrompt, firstId, lastId) {
    const text = typeof shippedUserPrompt === "string" ? shippedUserPrompt : "";
    const paragraphEnd = text.indexOf("\n\n");
    if (text.indexOf(PLAUSIBILITY_SHIPPED_RANGE_LEAD) !== 0 || paragraphEnd === -1) return null;
    const idText = (id) => (id === undefined || id === null ? "" : String(id));
    const range = PLAUSIBILITY_RANGE_TEMPLATE.split("{first}").join(idText(firstId)).split("{last}").join(idText(lastId));
    return `${range}${text.slice(paragraphEnd)}`;
  }

  // ==========================================================================
  // INIT
  // ==========================================================================

  /**
   * The `temperature` option, if it is one, or null.
   *
   * A NAMED SEAM, exported and reached through `api`, so a suite can invert
   * the option's whole route to the instance and redden exactly the rows that
   * name it.
   *
   * ZERO IS A VALID TEMPERATURE AND THE TEST IS `typeof`, NEVER TRUTHINESS.
   * `opts.temperature ? … : null` reads 0 as absent and silently leaves the
   * embed's 0.7 in place, which is the one value round cf-5 exists to measure
   * against — a bug whose symptom is a reading that looks perfectly ordinary.
   *
   * ONLY THE TYPE IS CHECKED HERE. The RANGE belongs to the embed, which
   * validates 0 to 2 and throws (openrouter-embed-core.js ~:3194); `init`
   * catches that throw rather than restating the bounds, so there is no second
   * copy of the contract here to drift away from the first. `isFinite` is part
   * of the type question, not the range one: NaN and Infinity are numbers by
   * `typeof` and are not temperatures.
   *
   * @param {object} opts the options object `init` was given
   * @returns {number|null}
   */
  function resolveTemperatureOption(opts) {
    const value = opts ? opts.temperature : undefined;
    if (value === undefined || value === null) return null;
    if (typeof value !== "number" || !isFinite(value)) {
      logWarn(
        `init: temperature '${value}' is not a number; leaving the embed default in place`,
      );
      return null;
    }
    return value;
  }

  /**
   * Bind one OpenRouterEmbed to the hidden sink.
   *
   * Idempotent: a second call with the same sink returns true and does not
   * build a second instance or a second sink. Returns FALSE rather than
   * throwing on any failure, because a missing dependency is a page-wiring
   * fault the tool must degrade around, not an exception for a caller to
   * catch. The constructor itself throws on four separate absences
   * (window.openRouterClient, EmbedProviderLookup, the openrouter provider
   * registration, MarkdownEditor) as well as a missing container, so the try
   * is doing real work.
   *
   * @param {object} [options]
   * @param {string} [options.sinkId=DEFAULT_SINK_ID]
   * @param {number} [options.temperature] sampling temperature for this
   *   instance, 0 to 2. Omitted leaves the embed's own default (0.7) exactly
   *   where it is: THE SHIPPED DEFAULT DOES NOT MOVE, and a caller that wants
   *   a different one says so.
   * @returns {boolean}
   */
  function init(options) {
    const opts = options || {};
    const sinkId =
      typeof opts.sinkId === "string" && opts.sinkId.trim()
        ? opts.sinkId.trim()
        : DEFAULT_SINK_ID;

    if (embed && sinkElement && sinkElement.id === sinkId) {
      logDebug(`init: already bound to #${sinkId}`);
      return true;
    }

    if (typeof window.OpenRouterEmbed !== "function") {
      logWarn("init: window.OpenRouterEmbed unavailable; not initialised");
      return false;
    }

    let element = document.getElementById(sinkId);
    let created = false;
    if (!element) {
      // Until Stage 8 puts the sink in the article, one is made here. Said at
      // INFO because a created sink on a page that should carry its own is a
      // wiring fault worth noticing rather than a silent convenience.
      logInfo(`init: sink #${sinkId} absent; creating it on document.body`);
      element = document.createElement("div");
      element.id = sinkId;
      element.hidden = true;
      document.body.appendChild(element);
      created = true;
    }

    try {
      const instance = new window.OpenRouterEmbed({
        containerId: sinkId,
        showNotifications: false,
        showStreamingProgress: false,
        announceContainer: false,
      });
      instance.configureRetry({ enabled: true });
      instance.configureQueue({ enabled: true, concurrency: 1 });
      // The reply ceiling, set on the instance rather than left at the embed's
      // 2,000 default. See MAX_OUTPUT_TOKENS for why, and for the measurement.
      instance.setMaxTokens(MAX_OUTPUT_TOKENS);

      // The sampling temperature, when the caller named one. Same shape and
      // same reason as the ceiling above: the product sets on its own instance
      // what it was measured to need, and sets nothing it was not.
      //
      // ITS OWN TRY, INSIDE THE OUTER ONE, AND THAT NESTING IS THE POINT.
      // `setTemperature` THROWS on a value outside 0 to 2, and this call sits
      // inside the try that returns false on a construction failure — so an
      // un-caught range refusal would take the whole tool off the page because
      // a harness typed 9. A bad option is a warning; it is not a death. The
      // embed assigns only after its own validation passes, so the instance is
      // provably still at its default when the catch runs.
      const temperature = api.resolveTemperatureOption(opts);
      if (temperature !== null) {
        try {
          instance.setTemperature(temperature);
        } catch (error) {
          logWarn(
            `init: the embed refused temperature ${temperature} (${error && error.message}); leaving its default in place`,
          );
        }
      }

      embed = instance;
      sinkElement = element;
      sinkWasCreated = created;
      logInfo(`init: bound to #${sinkId}`);
      return true;
    } catch (error) {
      if (created && element.parentNode) element.parentNode.removeChild(element);
      embed = null;
      sinkElement = null;
      sinkWasCreated = false;
      logWarn(`init: construction failed: ${error && error.message}`);
      return false;
    }
  }

  /**
   * Release the embed and remove a sink this module created. Present so a
   * suite (and, from Stage 8, the tool's `cleanup`) can put the page back as
   * it found it. A sink the page authored is left alone.
   * @returns {void}
   */
  function teardown() {
    cancel();
    if (sinkWasCreated && sinkElement && sinkElement.parentNode) {
      sinkElement.parentNode.removeChild(sinkElement);
    }
    embed = null;
    sinkElement = null;
    sinkWasCreated = false;
    logDebug("teardown: released");
  }

  /**
   * The bound embed, or null. Exported so a suite can stub `sendRequest` on
   * the very instance `complete` will use — an unstubbable seam is an
   * unprovable one.
   * @returns {object|null}
   */
  function getEmbed() {
    return embed;
  }

  /**
   * The temperature that is ACTUALLY ON THE INSTANCE, or null when nothing is
   * bound.
   *
   * Read off the embed, never off the option `init` was given, so a caller
   * recording it records what the send will carry rather than what it asked
   * for. The two differ whenever the embed refused the value — which is a
   * thing a round must be able to see rather than a thing it must assume did
   * not happen. Same rule the harness already follows for the reply ceiling.
   *
   * @returns {number|null}
   */
  function getTemperature() {
    return embed ? embed.temperature : null;
  }

  // ==========================================================================
  // COMPLETE
  // ==========================================================================

  /**
   * Send one request through the queue and return its parsed reply.
   *
   * @param {object} options
   * @param {string} options.systemPrompt prompt WITHOUT the JSON instruction
   * @param {string} options.userPrompt
   * @param {object} [options.schema] { type, items: { requiredKeys, types, idKey } }
   * @param {Array<string|number>} [options.knownIds] ids the caller sent
   * @param {string} [options.model] explicit model id
   * @param {string} [options.pass] which pass is sending, passed to resolveModel
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ data: *, discarded: number, raw: string, model: string, usage: object|null, usageRaw: object|null, attempts: number, maxOutputTokens: number, reasoningEffort: string|null }>}
   *   `maxOutputTokens` and `reasoningEffort` are read off the instance during
   *   the send (stage `ro`); a parse rejection carries both as well, and so
   *   does the ERRORS.TRUNCATED rejection a `length` finish produces (H-22).
   */
  async function complete(options) {
    const opts = options || {};

    if (!embed) {
      throw adapterError(
        ERRORS.NOT_INITIALISED,
        "CaptionsFixerLLM.init() has not succeeded; there is no embed to send with.",
      );
    }
    if (typeof opts.userPrompt !== "string" || !opts.userPrompt.trim()) {
      throw adapterError(
        ERRORS.BAD_REQUEST,
        "complete() needs a non-empty userPrompt.",
      );
    }
    if (opts.systemPrompt !== undefined && typeof opts.systemPrompt !== "string") {
      throw adapterError(
        ERRORS.BAD_REQUEST,
        "complete() needs systemPrompt to be a string when supplied.",
      );
    }

    const modelId = api.resolveModel({ model: opts.model, pass: opts.pass });
    if (modelId === PASS_UNAVAILABLE) {
      throw adapterError(
        ERRORS.NO_MODEL,
        `The '${opts.pass}' pass does not run on the active provider; nothing was sent.`,
      );
    }
    if (!modelId) {
      throw adapterError(
        ERRORS.NO_MODEL,
        "No model could be resolved for the active provider.",
      );
    }

    const systemPrompt = `${opts.systemPrompt || ""}\n\n${JSON_ONLY_INSTRUCTION}`.trim();
    embed.setSystemPrompt(systemPrompt);
    embed.setModel(modelId);

    // One cancellation path, reached by three routes: cancel(), an abort on a
    // caller's signal, and the settle of the send itself. The promise below
    // races the send against this one, so whichever arrives first wins and the
    // loser cannot leave a promise hanging.
    let cancelled = false;
    let abortListener = null;
    const cancellation = new Promise((_resolve, reject) => {
      inFlightReject = (reason) => {
        if (cancelled) return;
        cancelled = true;
        reject(
          adapterError(
            ERRORS.CANCELLED,
            typeof reason === "string" ? reason : CANCEL_REASON,
          ),
        );
      };
    });

    if (opts.signal) {
      if (opts.signal.aborted) {
        inFlightReject = null;
        throw adapterError(ERRORS.CANCELLED, CANCEL_REASON);
      }
      abortListener = () => cancel();
      opts.signal.addEventListener("abort", abortListener);
    }

    // THIS SEND'S OPTIONS, put on the instance for the whole call (both parse
    // attempts) and put back in the `finally` below, whatever happens. Read
    // back off the instance rather than off `requested`, so what is returned
    // is what the send carried. Both through `api`, so a row can patch them.
    // The instance is held here because `teardown()` mid-send nulls `embed`,
    // and the restore must still reach the instance the options went on.
    const instance = embed;
    const requested = api.requestOptionsFor(modelId);
    const prior = api.applyRequestOptions(instance, requested);
    const onInstance = instance.getReasoningConfig();
    const sent = {
      maxOutputTokens: instance.max_tokens,
      reasoningEffort: onInstance.enabled === true && typeof onInstance.effort === "string" ? onInstance.effort : null,
    };

    let raw = "";
    let usage = null;
    let usageRaw = null;
    let attempts = 0;

    try {
      for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
        const userPrompt =
          attempt === 1 ? opts.userPrompt : opts.userPrompt + PARSE_RETRY_SUFFIX;

        let response;
        try {
          response = await Promise.race([send(userPrompt), cancellation]);
        } catch (error) {
          if (error && error.reason === ERRORS.CANCELLED) throw error;
          throw adapterError(
            ERRORS.SEND,
            `The request failed: ${error && error.message ? error.message : String(error)}`,
            {
              cause: error,
              maxOutputTokens: sent.maxOutputTokens,
              reasoningEffort: sent.reasoningEffort,
            },
          );
        }
        attempts = attempt;

        raw = typeof response === "string" ? response : response?.text || "";
        usage = response?.metadata?.tokens || null;

        // VERBATIM, and deliberately not normalised, coerced or judged here.
        // The token counts are paid for, so they are carried out of this
        // function exactly as they arrived and written down beside the reply;
        // whether they are trustworthy is a question for whoever reads them,
        // and cf-1 established that on the OpenRouter path they are a character
        // estimate rather than a provider count (see MAX_OUTPUT_TOKENS). The
        // one transformation is `undefined` to `null`, so a store record can
        // hold the field rather than lose it.
        //
        // NOTE the difference from `usage` one line above: that one uses `||`,
        // so a legitimately falsy object becomes null. This one does not.
        usageRaw = response?.metadata?.tokens ?? null;

        // A REPLY THE PROVIDER CUT OFF AT ITS TOKEN LIMIT IS REFUSED, NOT PARSED
        // AND NOT SENT AGAIN (parcel H-22). A reply stopped mid-array cannot close
        // its brackets, so it used to fail to parse and BUY A SECOND PAID SEND at
        // the same limit, which is likely to be cut again. The bytes are already
        // in `raw`, so the rejection carries them like a parse rejection does and
        // the pass stage persists them. Only `length` takes this branch: every
        // other reason, an absent one included, goes on to parse and retry
        // exactly as before.
        if (response && response.finishReason === FINISH_REASON_LENGTH) {
          throw adapterError(
            ERRORS.TRUNCATED,
            `The model's reply was cut off at its limit of ${sent.maxOutputTokens} tokens, so it was not used.`,
            {
              raw: raw,
              model: modelId,
              attempts: attempts,
              maxOutputTokens: sent.maxOutputTokens,
              reasoningEffort: sent.reasoningEffort,
            },
          );
        }

        // Both reached through the exported object, for the seam reason in
        // parseTolerantly's own comment.
        const parsed = api.parseTolerantly(raw);
        if (parsed.ok) {
          const filtered = api.applySchema(parsed.value, opts.schema, opts.knownIds);
          logDebug(
            `complete: parsed on attempt ${attempt}, ${filtered.discarded} discarded`,
          );
          return {
            data: filtered.data,
            discarded: filtered.discarded,
            raw: raw,
            model: modelId,
            usage: usage,
            usageRaw: usageRaw,
            attempts: attempts,
            maxOutputTokens: sent.maxOutputTokens,
            reasoningEffort: sent.reasoningEffort,
          };
        }
        logWarn(`complete: attempt ${attempt} did not parse — ${parsed.error}`);
      }

      throw adapterError(
        ERRORS.PARSE,
        `The model's reply could not be parsed as JSON after ${MAX_PARSE_ATTEMPTS} attempts.`,
        {
          raw: raw,
          model: modelId,
          attempts: attempts,
          maxOutputTokens: sent.maxOutputTokens,
          reasoningEffort: sent.reasoningEffort,
        },
      );
    } finally {
      // A restore that failed would leave the next send carrying this one's
      // options, so it is said at WARN rather than swallowed; it cannot throw
      // out of here and replace the error the caller is owed.
      try {
        api.restoreRequestOptions(instance, prior);
      } catch (error) {
        logWarn(`complete: the request options could not be restored: ${error && error.message}`);
      }
      inFlightReject = null;
      if (opts.signal && abortListener) {
        opts.signal.removeEventListener("abort", abortListener);
      }
    }
  }

  /**
   * One send, through the queue where the queue exists.
   *
   * `sendRequest` does NOT consult the queue (core ~:1192); `enqueueRequest`
   * (~:4506) is the entry point, and its executor calls `this.sendRequest`, so
   * a stub on `sendRequest` still intercepts. The direct fall-back exists for
   * a page without openrouter-embed-queue.js and WARNS, because silence there
   * would make the concurrency-1 promise untrue without saying so.
   *
   * @param {string} userPrompt
   * @returns {Promise<object>}
   * @private
   */
  function send(userPrompt) {
    const queueReady =
      typeof embed.enqueueRequest === "function" &&
      typeof embed.getQueueConfig === "function" &&
      embed.getQueueConfig().enabled === true;

    if (!queueReady) {
      logWarn("send: the queue is not available; sending directly");
      return embed.sendRequest(userPrompt);
    }
    return embed.enqueueRequest({ userPrompt: userPrompt });
  }

  /**
   * Cancel the in-flight `complete`, if there is one.
   *
   * Rejects that promise with ERRORS.CANCELLED rather than leaving it hanging,
   * and puts the embed back in a state a following `complete` can use.
   * Returns false when there was nothing to cancel, so a caller can tell the
   * two cases apart.
   *
   * THREE THINGS, NOT ONE, AND THE MIDDLE ONE WAS MISSING UNTIL MEASURED.
   *   1. `cancelRequest()` aborts a real in-flight send on the wire, so the
   *      request stops rather than merely being ignored.
   *   2. `clearQueue()` drops anything still PENDING. Without this a request
   *      cancelled before the queue started it stays queued for ever: measured
   *      7 September 2026, `getQueueLength()` read 1 after a cancel, and a
   *      cancel racing the queue's own start decides which of the two states
   *      you land in. Note that `getQueueLength()` counts PENDING only, so it
   *      reads 0 for a PROCESSING item — a bare 0 from it is not evidence the
   *      queue is idle, and no row should treat it as such.
   *   3. our own promise is rejected, so a caller awaiting it is released.
   *
   * WHAT IT CANNOT DO, STATED RATHER THAN GLOSSED. An item already PROCESSING
   * cannot be removed by any public queue API — `clearQueue()` skips it. With
   * a real send that does not matter, because (1) makes `sendRequest` reject
   * and the queue's executor settles, freeing the concurrency slot. With a
   * STUB that never settles the slot is held for ever, which is a property of
   * that stub and not of the product.
   *
   * @param {string} [reason]
   * @returns {boolean} true when a call was cancelled
   */
  function cancel(reason) {
    const reject = inFlightReject;
    if (!reject) {
      logDebug("cancel: nothing in flight");
      return false;
    }
    inFlightReject = null;

    // OUR rejection goes FIRST, and the order is load-bearing. `clearQueue()`
    // rejects a dropped item with a plain "Queue cleared" Error carrying no
    // `.reason`, and `complete` races that against this one — so clearing
    // first makes the caller see ERRORS.SEND where it asked for a cancel.
    // Settling this promise first makes it the winner of that race, and the
    // queue's own rejection is then a handled loser rather than a surprise.
    reject(reason);

    if (embed && typeof embed.cancelRequest === "function") {
      try {
        embed.cancelRequest(reason || CANCEL_REASON);
      } catch (error) {
        logWarn("cancel: the embed refused to cancel:", error);
      }
    }
    if (embed && typeof embed.clearQueue === "function") {
      try {
        const cleared = embed.clearQueue();
        if (cleared > 0) logDebug(`cancel: ${cleared} queued request(s) dropped`);
      } catch (error) {
        logWarn("cancel: the queue refused to clear:", error);
      }
    }
    logInfo("cancel: the in-flight request was cancelled");
    return true;
  }

  // ==========================================================================
  // ESTIMATE
  // ==========================================================================

  /**
   * How many sends to charge for, from whatever a caller passed.
   *
   * IT FALLS BACK TO ONE AND SAYS SO, RATHER THAN THROWING. `estimate` is
   * reached through the orchestrator's `costOfStage`, which CATCHES a throwing
   * estimator and treats the cost as zero — and a zero cost is a spend cap that
   * has quietly stopped capping, which is a worse failure than an under-report.
   * One is the honest floor: a pass that estimates at all makes at least one
   * send. The warning is what makes a mistyped option visible.
   *
   * @param {*} value
   * @returns {number} a positive integer
   */
  function resolveSends(value) {
    if (value === undefined || value === null) return DEFAULT_SENDS;
    if (typeof value !== "number" || !isFinite(value) || value < 1 || Math.floor(value) !== value) {
      // NAMED WITH BOTH FORMATTERS, BECAUSE NEITHER ALONE TELLS THE TRUTH HERE.
      // JSON.stringify renders NaN, Infinity and -Infinity ALL as "null" — and
      // null is the one input this function handles on its other branch, in
      // silence, so the warning would send a reader hunting for a null that is
      // not there. String() names those three correctly but renders the STRING
      // "2" as 2, indistinguishable from the number that would have been
      // accepted. Numbers go through String, everything else through
      // JSON.stringify, so every rejected value names itself.
      const described = typeof value === "number" ? String(value) : JSON.stringify(value);
      logWarn(`estimate: sends must be a positive whole number; got ${described}, charging for ${DEFAULT_SENDS}`);
      return DEFAULT_SENDS;
    }
    return value;
  }

  /**
   * The output tokens per send `estimate` assumes for one pass and model: the
   * measured figure where OUTPUT_TOKENS_BY_PASS_AND_MODEL has one,
   * OUTPUT_TOKENS_FALLBACK otherwise. `estimate` reads it through the exported
   * object, so the suite can bind the map by inversion.
   *
   * @param {string} pass a value of PASSES, as `estimate` resolved it
   * @param {string|null} modelId the id `resolveModel` returned
   * @returns {number}
   */
  function outputTokensFor(pass, modelId) {
    const byModel = Object.prototype.hasOwnProperty.call(OUTPUT_TOKENS_BY_PASS_AND_MODEL, pass)
      ? OUTPUT_TOKENS_BY_PASS_AND_MODEL[pass]
      : null;
    const known = !!byModel && typeof modelId === "string" && Object.prototype.hasOwnProperty.call(byModel, modelId);
    return known ? byModel[modelId] : OUTPUT_TOKENS_FALLBACK;
  }

  /**
   * What a pass would cost, approximately — one send by default, `sends` of
   * them where a caller says so.
   *
   * IT IS AN ESTIMATE AND THE SHAPE SAYS SO: `outputTokensAssumed` is one
   * round's mean for a measured pass and model and a fallback for any other, and
   * `inputTokens` is characters over four rather than a tokeniser's count.
   * A caller showing a figure to a person must say it is an estimate.
   *
   * `sends` IS A COST MULTIPLIER AND NOTHING ELSE, AND THE RETURNED SHAPE MIXES
   * TWO SCALES ON PURPOSE. `inputTokens` and `outputTokensAssumed` describe ONE
   * send — their names say "tokens", and a pass does not send a bigger prompt,
   * it sends the same prompt twice. `costUsd` and `tier` describe the WHOLE
   * pass, because they are what a spend cap and a person's confirmation are
   * about. `sends` is returned so the object states which scale is which rather
   * than leaving a reader to infer it from two fields that no longer divide.
   *
   * It multiplies rather than the caller doing so afterwards for one reason:
   * THE TIER MUST BE THE TIER OF THE TOTAL. Doubling `costUsd` outside this
   * function would leave `tier` describing half of it, and `tier` is not
   * cosmetic — captions-fixer-ui.js gates a confirmation on it. Tiering happens
   * at exactly one site, here, and the alternative considered at Stage 15 was a
   * caller re-tiering through `window.EmbedFileUtils`: a SECOND route to a
   * function this file reaches through its embed instance, whose identity with
   * the first is unmeasured.
   *
   * The tier comes from the embed's own `fileUtils.shouldWarnAboutCost`, which
   * is what the rest of the app uses. NOTE, and this is measured rather than
   * assumed: that function's thresholds are documented in GBP
   * (openrouter-embed-file.js:101) while the registry's `costs` are USD per
   * million (model-definitions.js:35870). The figure fed in is therefore USD
   * judged against GBP-labelled numbers. The dispatch asks for exactly this
   * arrangement and the app is consistent with itself; it is recorded here so
   * nobody reads the tier as a currency-correct judgement.
   *
   * @param {object} options
   * @param {string} [options.systemPrompt]
   * @param {string} options.userPrompt
   * @param {string} [options.model]
   * @param {string} [options.pass] which pass is estimated, passed to resolveModel
   * @param {number} [options.sends=1] how many identical sends the pass makes
   * @returns {{ model: string|null, inputTokens: number, outputTokensAssumed: number, sends: number, costUsd: number|null, tier: string }}
   */
  function estimate(options) {
    const opts = options || {};
    const systemPrompt = typeof opts.systemPrompt === "string" ? opts.systemPrompt : "";
    const userPrompt = typeof opts.userPrompt === "string" ? opts.userPrompt : "";

    // The instruction block is part of what is sent, so it is part of what is
    // counted; an estimate that omits it under-reports every call.
    const characters =
      `${systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}`.trim().length +
      userPrompt.length;
    const inputTokens = Math.ceil(characters / CHARS_PER_TOKEN);
    const sends = resolveSends(opts.sends);

    const modelId = api.resolveModel({ model: opts.model, pass: opts.pass });

    // A pass that does not run on this provider sends nothing, and says so: a
    // flag, no sends and its own tier, so a caller cannot read the zero cost
    // as a free model. `outputTokensAssumed` is 0 for the same reason.
    if (modelId === PASS_UNAVAILABLE) {
      return {
        model: PASS_UNAVAILABLE,
        unavailable: true,
        inputTokens: inputTokens,
        outputTokensAssumed: 0,
        sends: 0,
        costUsd: 0,
        tier: UNAVAILABLE_TIER,
      };
    }

    const model = modelId ? registryModel(modelId) : null;
    const costs = model && model.costs;

    // The pass as resolveModel resolved it: a missing or unknown pass is the
    // default pass. resolveModel has already logged the WARN, so none here.
    const passName = Object.prototype.hasOwnProperty.call(MODEL_BY_PASS, opts.pass) ? opts.pass : DEFAULT_PASS;
    const outputTokens = api.outputTokensFor(passName, modelId);

    if (!costs || typeof costs.input !== "number" || typeof costs.output !== "number") {
      logWarn(`estimate: no costs for '${modelId}'; reporting an unknown tier`);
      return {
        model: modelId,
        inputTokens: inputTokens,
        outputTokensAssumed: outputTokens,
        sends: sends,
        costUsd: null,
        tier: UNKNOWN_TIER,
      };
    }

    const costUsd =
      (sends * (inputTokens * costs.input + outputTokens * costs.output)) /
      TOKENS_PER_COST_UNIT;

    let tier = UNKNOWN_TIER;
    if (embed && embed.fileUtils && typeof embed.fileUtils.shouldWarnAboutCost === "function") {
      tier = embed.fileUtils.shouldWarnAboutCost(costUsd);
    } else {
      logWarn("estimate: the embed's fileUtils is unavailable; tier unknown");
    }

    return {
      model: modelId,
      inputTokens: inputTokens,
      outputTokensAssumed: outputTokens,
      sends: sends,
      costUsd: costUsd,
      tier: tier,
    };
  }

  logInfo("Captions Fixer model adapter loaded");

  const api = {
    init: init,
    teardown: teardown,
    complete: complete,
    estimate: estimate,
    resolveModel: resolveModel,
    outputTokensFor: outputTokensFor,
    // stage `ro`: one send's options, and their application and restoration,
    // exported so complete() reads them through here and a row can patch them
    requestOptionsFor: requestOptionsFor,
    applyRequestOptions: applyRequestOptions,
    restoreRequestOptions: restoreRequestOptions,
    cancel: cancel,
    getEmbed: getEmbed,
    getTemperature: getTemperature,
    // pure helpers, exported so the suite can bind them by inversion
    resolveTemperatureOption: resolveTemperatureOption,
    parseTolerantly: parseTolerantly,
    extractFencedBlocks: extractFencedBlocks,
    findJsonSpan: findJsonSpan,
    sameId: sameId,
    applySchema: applySchema,
    // stage `pl`: the plausibility pass's parser and user prompt
    plausibilityScoresFromReply: plausibilityScoresFromReply,
    buildPlausibilityUserPrompt: buildPlausibilityUserPrompt,
    // NOT frozen, so a suite can switch one refusal off (see its own comment)
    plausibilityRefusalTests: plausibilityRefusalTests,
    // constants
    PASSES: PASSES,
    PASS_UNAVAILABLE: PASS_UNAVAILABLE,
    UNAVAILABLE_TIER: UNAVAILABLE_TIER,
    PROMPT_PLAUSIBILITY: PROMPT_PLAUSIBILITY,
    PLAUSIBILITY_RANGE_TEMPLATE: PLAUSIBILITY_RANGE_TEMPLATE,
    PLAUSIBILITY_SHIPPED_RANGE_LEAD: PLAUSIBILITY_SHIPPED_RANGE_LEAD,
    PLAUSIBILITY_SCHEMA: PLAUSIBILITY_SCHEMA,
    PLAUSIBILITY_BAR: PLAUSIBILITY_BAR,
    PLAUSIBILITY_REFUSALS: PLAUSIBILITY_REFUSALS,
    DEFAULT_PASS: DEFAULT_PASS,
    MODEL_BY_PASS: MODEL_BY_PASS,
    ERRORS: ERRORS,
    JSON_ONLY_INSTRUCTION: JSON_ONLY_INSTRUCTION,
    PARSE_RETRY_SUFFIX: PARSE_RETRY_SUFFIX,
    MAX_PARSE_ATTEMPTS: MAX_PARSE_ATTEMPTS,
    CHARS_PER_TOKEN: CHARS_PER_TOKEN,
    OUTPUT_TOKENS_FALLBACK: OUTPUT_TOKENS_FALLBACK,
    OUTPUT_TOKENS_BY_PASS_AND_MODEL: OUTPUT_TOKENS_BY_PASS_AND_MODEL,
    MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
    CAPTIONS_OUTPUT_CEILING: CAPTIONS_OUTPUT_CEILING,
    FINISH_REASON_LENGTH: FINISH_REASON_LENGTH,
    FOUNDRY_PROVIDER_ID: FOUNDRY_PROVIDER_ID,
    TOKENS_PER_COST_UNIT: TOKENS_PER_COST_UNIT,
    UNKNOWN_TIER: UNKNOWN_TIER,
    DEFAULT_SENDS: DEFAULT_SENDS,
    CANCEL_TIMEOUT_MS: CANCEL_TIMEOUT_MS,
    DEFAULT_SINK_ID: DEFAULT_SINK_ID,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerLLM resolve at all — the same
// arrangement, for the same reason, as captions-fixer-guards.js:492.
window.CaptionsFixerLLM = CaptionsFixerLLM;
