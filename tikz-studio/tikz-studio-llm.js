/**
 * @file tikz-studio-llm.js
 * @description The model adapter for TikZ Studio: the ONE place the Studio talks to a model. It takes the TikZ source and the
 * rendered SVG of one figure, sends them with the describe prompt, and returns an alt text and a long description, or a named
 * refusal. It never writes a field, speaks, or raises a toast: the page side (tikz-studio-ui.js) does all three.
 *
 * PUBLIC API (window.TikzStudioLLM)
 *   describe({ source, svg, signal }) -> Promise<{ ok: true, kind, alt, longdesc, sections, model, escalated, attempts, raw, unsupportedNumbers }
 *                                               | { ok: false, reason, message, raw?, model?, escalated? }>
 *   fix({ source, errors, log, trialRender, isCurrent, signal }) -> Promise<{ ok: true, source, change, model, escalated, sends, attempts }
 *                                               | { ok: false, reason, message, sends?, attempts? }>   (P4b; see "fix with AI" below)
 *   generate({ words, pictureDataUrl, trialRender, signal }) -> Promise<{ ok: true, source, summary, svg, model, escalated, sends, attempts, raw }
 *                                               | { ok: false, reason, message, sends?, attempts? }>   (P4c; see "draw with AI" below)
 *   resolveModel()   the model id one send would use on the active provider, or null
 *   cancel()         end the send in flight; its describe() resolves with reason "cancelled"
 *   REASONS, MODEL_BY_PROVIDER, DRAW_MODEL_BY_PROVIDER, PNG_SCALE   frozen (the second pair is Draw with AI's, MP1)
 *
 * A send that reached the model is never repeated as it stands. The only repeats are one after a reply that is not usable JSON
 * (MAX_PARSE_ATTEMPTS) and one correction after a reply with unsupported numbers (see THE NUMBER CHECK below). A reply the provider cut off at its token limit is refused and
 * not parsed and not sent again: a cut-off reply can still parse, and would then be written as though it were whole.
 *
 * THE REPLY SHAPE (11 October 2026) is `{ kind, alt, sections }`, titled sections of paragraphs and items, as the chart and Mermaid
 * descriptions are. The adapter turns the sections into the long-description field's line markup (`## Heading`, `- item`, `1. item`,
 * plain paragraph lines; rendered by the controller's longdescHtml), strips any markup the model typed inside the text, and still
 * accepts the older `longdesc` shape. It also tells the model whether the page will add a Data table, so a plot whose values are
 * already tabulated does not list them again.
 *
 * THE EMBED IS RESOLVED AT CALL TIME. openrouter-embed-core.js is a type="module" tag, so it runs after every classic script
 * such as this one; window.OpenRouterEmbed is undefined while this file is read. Nothing here captures it at load.
 *
 * THE SINK. The embed renders a reply into its container whatever the caller wants, so the container is a sink, not an output:
 * a hidden div the page carries. The embed would make it a polite live region and raise its own error toast, so both are
 * switched off in the constructor options, which makes "no live region" true of the markup and not by circumstance.
 *
 * THE MODEL TABLE is the owner's ruling of 10 October 2026: per provider a fast model first and a better model that takes over.
 * The better model is tried ONCE, and only when the first model's request failed, its reply was cut off at its limit, or its
 * reply still could not be read after its one parse retry. A cancel, a missing sign-in, bad input or a missing prompt or picture
 * never escalates, and neither does a model of the other provider: a Foundry person's model never falls back to an OpenRouter
 * one, and the reverse. A model that is not eligible on the provider or not vision-capable is not used; if the first is unusable
 * the better one is used alone, if the better is unusable nothing escalates, and if both are unusable nothing is sent. A press
 * makes at most three sends. The result records the model that wrote it (model) and whether it was the better one (escalated).
 *
 * THE NUMBER CHECK (11 October 2026). The request carries two facts lines beside the picture: the text the figure's SVG prints, and the
 * numbers in the source's code lines. After a reply parses, every number in it is checked (see checkNumbers): drawn, said to come from
 * the source, or unsupported. On unsupported numbers the same model gets ONE correction naming them; if the corrected reply is still
 * unsupported the better model gets its turn; and a reply that is still unsupported at the end is returned anyway with
 * `unsupportedNumbers` listing them, so the page can say so. It never blocks the author. The correction counts toward the same
 * MAX_SENDS_PER_PRESS (3) as a parse retry and the better model's send.
 *
 * FOUNDRY SIGN-IN. On Foundry the token is refreshed (EntraAuth.ensureFresh) before a model's first send, as Chat does, and again
 * before the better model's send, which can follow two long sends. It is not repeated before the parse retry, which follows the
 * first reply inside one send's time: ensureFresh renews at 75% of a token's life, so a refreshed token has a quarter of its life
 * left. A person who is not signed in gets no send and a sentence saying to sign in on the Set Up page.
 *
 * @module TikzStudioLLM
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzStudioLLM]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzStudioLLM]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TikzStudioLLM]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[TikzStudioLLM]", message, ...args);
  }

  const SINK_ID = "tikz-studio-embed-sink";
  const DEFAULT_PROVIDER_ID = "openrouter";
  const PROMPT_FOLDER = "tikz-studio/prompts/";
  const PROMPT_FILE = "describe.txt";
  // The prompt loader publishes what it loads as a window global of this name; nothing else reads it.
  const PROMPT_GLOBAL = "TIKZ_STUDIO_DESCRIBE_PROMPT";
  const FINISH_REASON_LENGTH = "length";
  // A heading, bullet or number a model types inside a paragraph or item. Stripped, so a reply cannot write markup by accident.
  const MARKUP_PREFIX = /^(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/;

  /**
   * 2x, the scale Download PNG uses. Measured 10 October 2026 over the 11 rendering corpus figures: at 1x the smallest is 79 by 70
   * pixels, too small to read a label; at 2x the largest is 611 by 566 pixels and 35,050 bytes, well inside any vision model's
   * input size. Cost scales with pixels, and 2x is the smallest scale at which the corpus's labels are legible.
   */
  const PNG_SCALE = 2;

  /** Ceiling on the reply. A long description of a dense chart is some hundreds of words; this leaves room for a reasoning model. */
  const MAX_OUTPUT_TOKENS = 6000;
  const MAX_PARSE_ATTEMPTS = 2;
  const PARSE_RETRY_SUFFIX = "\n\nYour last reply was not a single JSON object. Reply again with only the JSON object and nothing else.";
  const CANCEL_MESSAGE = "Description stopped.";

  const REASONS = Object.freeze({
    NO_MODEL: "no-model",
    SIGN_IN: "sign-in",
    NO_EMBED: "no-embed",
    NO_PROMPT: "no-prompt",
    BAD_INPUT: "bad-input",
    PNG: "png",
    SEND: "send",
    TRUNCATED: "truncated",
    PARSE: "parse",
    CANCELLED: "cancelled",
    STALE: "stale",
    NO_FIX: "no-fix",
    NO_DRAWING: "no-drawing",
  });

  /**
   * The owner's ruling of 10 October 2026: per provider, a fast model first and a better model that takes over once when the first
   * fails. Both must be eligible on the provider and pass MathPixModelCapability.isModelVisionCapable, or they are not used.
   */
  const MODEL_BY_PROVIDER = Object.freeze({
    openrouter: Object.freeze({ first: "anthropic/claude-haiku-5.5", better: "anthropic/claude-opus-5.5" }),
    "azure-openai": Object.freeze({ first: "azure-openai/gpt-5.2", better: "azure-openai/gpt-6-sol" }),
  });

  /**
   * Draw with AI's own pair (MP1, 15 October 2026), for drawing from words or a picture. Describe and Fix keep MODEL_BY_PROVIDER.
   * OpenRouter: the owner's ruling of 14 October 2026 ("yes to Gemini 4 as you propose"), conditional on Gemini 4 Argon's data policy,
   * which was checked CLEAR on 15 October. Foundry: the owner's ruling of 15 October 2026 ("yes to foundry pair"). Same use as above:
   * the first model, then the better one once; an id that is not eligible on the provider (or, with a picture, not vision-capable) is not used.
   */
  const DRAW_MODEL_BY_PROVIDER = Object.freeze({
    openrouter: Object.freeze({ first: "google/gemini-4-argon", better: "anthropic/claude-opus-5.5" }),
    "azure-openai": Object.freeze({ first: "azure-openai/gpt-6-sol", better: "azure-openai/gpt-6.1-sol" }),
  });

  /** A press makes at most this many sends in all: a parse retry, a number correction and the better model's turn share it. */
  const MAX_SENDS_PER_PRESS = 3;

  /**
   * THE NUMBER CHECK (P4e, 11 October 2026). A number is a digit token that is not part of a label (R1, 2x, 25th) and not a bare list
   * marker. DRAWN: the same value is among the numbers in the figure's own SVG text. SOURCE-SAID: the value is in the source's code
   * lines AND its sentence says it comes from the source. Anything else is UNSUPPORTED. It is a FILTER, not a proof: it matches values
   * and cannot tell which axis a drawn "4" belongs to, so a wrong sentence made only of drawn numbers passes it.
   */
  const NUMBER_RE = /(?<![\w.])[-−]?\d+(?:\.\d+)?(?![\w])/g;
  const LIST_MARKER_RE = /^\s*\d+[.)]\s*$/;
  const SOURCE_SAYS_RE = /\b(?:the|in the|from the|given in the|stated in the|defined in the)\s+source\b|\bsource (?:defines|states|gives|says|code)\b/i;
  const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/;
  const CLASS_DRAWN = "DRAWN";
  const CLASS_SOURCE_SAID = "SOURCE-SAID";
  const CLASS_UNSUPPORTED = "UNSUPPORTED";

  function numbersIn(text) {
    return (String(text).match(NUMBER_RE) || []).map((n) => n.replace("−", "-"));
  }

  /** The text of every <text> element in the figure's SVG, tags stripped and joined with spaces: what the picture prints. */
  function drawnTextOf(svg) {
    const parts = [];
    const re = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(String(svg)))) parts.push(m[1].replace(/<[^>]+>/g, "").trim());
    return parts.filter(Boolean).join(" ");
  }

  /** The source without its "% ..." lines: annotation lines are prose about the figure, not the figure's own numbers. */
  function sourceCodeOf(source) {
    return String(source).split("\n").filter((l) => !/^\s*%/.test(l)).join("\n");
  }

  /**
   * @param {string[]} unitTexts the alt, then each sentence and item of the long description
   * @param {{drawnText?: string, source?: string}} context
   * @returns {{units: Array<{text: string, numbers: Array<{value: string, cls: string}>, unsupported: string[]}>, unsupported: string[]}}
   */
  function checkNumbers(unitTexts, context) {
    const ctx = context || {};
    const drawn = new Set(numbersIn(ctx.drawnText || ""));
    const inSource = new Set(numbersIn(sourceCodeOf(ctx.source || "")));
    const units = unitTexts.map((text) => {
      if (LIST_MARKER_RE.test(text)) return { text, numbers: [], unsupported: [] };
      const saysSource = SOURCE_SAYS_RE.test(text);
      const numbers = numbersIn(text).map((value) => {
        if (drawn.has(value)) return { value, cls: CLASS_DRAWN };
        if (saysSource && inSource.has(value)) return { value, cls: CLASS_SOURCE_SAID };
        return { value, cls: CLASS_UNSUPPORTED };
      });
      return { text, numbers, unsupported: numbers.filter((n) => n.cls === CLASS_UNSUPPORTED).map((n) => n.value) };
    });
    return { units, unsupported: [...new Set(units.flatMap((u) => u.unsupported))] };
  }

  /** The units of a parsed reply: its alt, then each sentence of each paragraph line and each list item. Headings are not claims. */
  function replyUnits(parsed) {
    const out = [parsed.alt];
    for (const line of String(parsed.longdesc).split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (/^##\s/.test(line)) continue;
      const isItem = /^(?:-|\d+\.)\s+/.test(line);
      const text = line.replace(/^(?:-|\d+\.)\s+/, "");
      if (isItem) out.push(text);
      else out.push(...text.split(SENTENCE_SPLIT_RE));
    }
    return out;
  }

  /** The numbers in a parsed reply that nothing in the figure's text or the source supports. */
  function unsupportedNumbersOf(parsed, context) {
    return checkNumbers(replyUnits(parsed), context).unsupported;
  }

  /**
   * The two facts lines the request carries beside the picture: the NUMBERS the figure prints, and which numbers the source holds.
   * Numbers only (P4fL, V3a): the words the picture prints were removed because the SVG splits words into fragments ("Lab el") and a
   * reply echoed them. The check itself (checkNumbers) still reads the whole drawn text, so it is unchanged.
   */
  function factsLines(source, svg) {
    const drawnNumbers = [...new Set(numbersIn(drawnTextOf(svg)))];
    const inSource = [...new Set(numbersIn(sourceCodeOf(source)))];
    return "Numbers drawn in the figure: " + (drawnNumbers.length ? drawnNumbers.join(", ") : "none") + "\nNumbers in the source: " + (inSource.length ? inSource.join(", ") : "none");
  }

  function correctionText(unsupported) {
    return (
      "These numbers in your reply are not drawn in the figure and the source does not state them: " + unsupported.join(", ") + ". " +
      "Reply again with the whole JSON object. Keep a number only if the text drawn in the figure shows it, or the source states it and " +
      "the sentence says it comes from the source. Otherwise rewrite that sentence without the number, and place a position in words " +
      "against the marks that are drawn."
    );
  }

  /** Foundry's provider id, and the EntraAuth scope its token is kept under. */
  const FOUNDRY_PROVIDER_ID = "azure-openai";
  const ENTRA_SCOPE_NAME = "foundry";
  const SIGN_IN_MESSAGE = "You are not signed in to Foundry, so nothing was sent. Sign in on the Set Up page, then try again.";

  /** A model that failed, was cut off or could not be read hands over once to the better model; nothing else does. */
  const ESCALATE_ON = new Set([REASONS.SEND, REASONS.TRUNCATED, REASONS.PARSE]);

  let embed = null;
  const promptPromises = new Map(); // prompt file -> its load, so each prompt is fetched once and a failed load may be retried
  let inFlight = null; // { cancel }

  // ------------------------------------------------------------------ helpers
  function fail(reason, message, extra) {
    return Object.assign({ ok: false, reason, message }, extra || {});
  }

  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.getActive !== "function") {
      logWarn("ProviderSwitcher unavailable; assuming the default provider");
      return DEFAULT_PROVIDER_ID;
    }
    const active = switcher.getActive();
    return typeof active === "string" && active.trim() ? active : DEFAULT_PROVIDER_ID;
  }

  function eligibleIds(providerId) {
    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getEligibleModels !== "function") return [];
    try {
      const models = selector.getEligibleModels({ providerId });
      return Array.isArray(models) ? models.filter(Boolean).map((m) => m.id) : [];
    } catch (e) {
      logWarn("getEligibleModels failed:", e);
      return [];
    }
  }

  /** True when the model is eligible on the provider and the vision check accepts it. */
  function usableModel(provider, id) {
    if (!eligibleIds(provider).includes(id)) {
      logWarn("The chosen model is not eligible on this provider:", id);
      return false;
    }
    const capability = window.MathPixModelCapability;
    if (!capability || typeof capability.isModelVisionCapable !== "function" || !capability.isModelVisionCapable(id)) {
      logWarn("The chosen model is not vision-capable:", id);
      return false;
    }
    return true;
  }

  /**
   * The models one press may use, in order: [first, better], [better] alone when the first is unusable, [first] alone when the
   * better one is (nothing then escalates), or [] when neither is. Only the active provider's own pair is ever read, so a model
   * of one provider is never sent under the other.
   * @returns {string[]}
   */
  function resolvePlan() {
    const provider = activeProvider();
    const pair = MODEL_BY_PROVIDER[provider];
    if (!pair) {
      logWarn("No model is chosen for provider", provider);
      return [];
    }
    return [pair.first, pair.better].filter((id) => usableModel(provider, id));
  }

  /** The model a press would try first, or null. */
  function resolveModel() {
    return resolvePlan()[0] || null;
  }

  /**
   * Foundry only: the Foundry provider reads its token synchronously from the cache, so a token that lapsed while the page sat
   * open fails the send. Copied from chat/chat-core.js refreshFoundryTokenIfNeeded, with the same three gates (Foundry provider,
   * EntraAuth with a callable ensureFresh, signed in). ensureFresh resolves null on failure rather than throwing, so a null warns
   * and the send goes ahead on whatever is cached; a throw is caught and the send goes ahead too. EntraAuth is never init()ed or
   * signed in from here: nothing on this page may contact Microsoft except through a send the person asked for.
   */
  async function refreshFoundryTokenIfNeeded() {
    if (activeProvider() !== FOUNDRY_PROVIDER_ID) return;
    const auth = window.EntraAuth;
    if (!auth || typeof auth.ensureFresh !== "function") return;
    if (typeof auth.isSignedIn !== "function" || auth.isSignedIn() !== true) return;
    try {
      const token = await auth.ensureFresh(ENTRA_SCOPE_NAME);
      if (!token) logWarn("The Foundry token refresh returned nothing; sending with whatever token is cached, which may have expired");
    } catch (e) {
      logWarn("The Foundry token refresh threw; sending with the cached token", e);
    }
  }

  /** True when Foundry is active, EntraAuth is present and callable, and nobody is signed in: the one case where nothing is sent. */
  function foundrySignedOut() {
    if (activeProvider() !== FOUNDRY_PROVIDER_ID) return false;
    const auth = window.EntraAuth;
    if (!auth || typeof auth.ensureFresh !== "function" || typeof auth.isSignedIn !== "function") return false;
    return auth.isSignedIn() !== true;
  }

  /** A prompt (describe by default), loaded once through this adapter's OWN loader (never the shared singleton, whose base path others may rely on). */
  function loadPrompt(file = PROMPT_FILE, globalName = PROMPT_GLOBAL) {
    if (promptPromises.has(file)) return promptPromises.get(file);
    const loading = (async () => {
      if (typeof window.EmbedPromptLoader !== "function") return null;
      const loader = new window.EmbedPromptLoader();
      loader.configure({ basePath: new URL(PROMPT_FOLDER, document.baseURI).href });
      return (await loader.load(globalName, file)) || null;
    })().then((text) => {
      if (!text) promptPromises.delete(file); // a failed load may be retried on the next press
      return text;
    });
    promptPromises.set(file, loading);
    return loading;
  }

  function ensureEmbed() {
    if (embed) return embed;
    if (typeof window.OpenRouterEmbed !== "function") return null;
    let sink = document.getElementById(SINK_ID);
    if (!sink) {
      logInfo("The sink #" + SINK_ID + " is absent; creating it hidden on document.body");
      sink = document.createElement("div");
      sink.id = SINK_ID;
      sink.hidden = true;
      document.body.appendChild(sink);
    }
    embed = new window.OpenRouterEmbed({
      containerId: SINK_ID,
      showNotifications: false,
      showStreamingProgress: false,
      announceContainer: false,
    });
    embed.setMaxTokens(MAX_OUTPUT_TOKENS);
    return embed;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("The picture could not be read."));
      reader.readAsDataURL(blob);
    });
  }

  // ------------------------------------------------------------------ reply parsing
  /** Candidates in order: the whole reply, each fenced block's body, then the first string-aware bracket-counted object. */
  function candidatesOf(raw) {
    const out = [raw.trim()];
    const fence = /```[a-zA-Z]*\s*\n([\s\S]*?)```/g;
    let m;
    while ((m = fence.exec(raw))) out.push(m[1].trim());
    const start = raw.indexOf("{");
    if (start >= 0) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < raw.length; i += 1) {
        const ch = raw[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "{") depth += 1;
        else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            out.push(raw.slice(start, i + 1));
            break;
          }
        }
      }
    }
    return out;
  }

  /** One line of plain text: newlines folded, and any heading, bullet or number the model typed anyway removed, so it cannot become markup. */
  function plainText(value) {
    if (typeof value !== "string") return "";
    let text = value.replace(/\s*\r?\n\s*/g, " ").trim();
    while (MARKUP_PREFIX.test(text)) text = text.replace(MARKUP_PREFIX, "").trim();
    return text;
  }

  /**
   * The reply's `sections` as clean sections, or []. A section needs a heading and at least one paragraph or item; one that has neither
   * is dropped, and so are blank strings inside it. Paragraphs come before items, as the prompt says.
   * @returns {Array<{heading: string, paragraphs: string[], items: string[], ordered: boolean}>}
   */
  function normaliseSections(sections) {
    if (!Array.isArray(sections)) return [];
    const out = [];
    for (const s of sections) {
      if (!s || typeof s !== "object") continue;
      const heading = plainText(s.heading);
      const paragraphs = (Array.isArray(s.paragraphs) ? s.paragraphs : typeof s.paragraphs === "string" ? [s.paragraphs] : []).map(plainText).filter(Boolean);
      const items = (Array.isArray(s.items) ? s.items : []).map(plainText).filter(Boolean);
      if (!heading || (!paragraphs.length && !items.length)) continue;
      out.push({ heading, paragraphs, items, ordered: s.ordered === true });
    }
    return out;
  }

  /** The line markup the long-description field holds: `## Heading`, paragraph lines, `- item` or `1. item` lines. See the controller's longdescHtml. */
  function sectionsToMarkup(sections) {
    const lines = [];
    for (const s of sections) {
      lines.push("## " + s.heading);
      for (const p of s.paragraphs) lines.push(p);
      s.items.forEach((item, i) => lines.push((s.ordered ? i + 1 + ". " : "- ") + item));
    }
    return lines.join("\n");
  }

  /**
   * Reply shapes: `{ kind, alt, sections: [{ heading, paragraphs?, items?, ordered? }] }`, and the shape before 11 October 2026,
   * `{ kind, alt, longdesc }` with a string or an array of lines, which still parses (a model may fall back to it).
   * @returns {{kind: string, alt: string, longdesc: string, sections: object[]}|null} null unless the reply holds a non-empty alt and long description
   */
  function parseReply(raw) {
    for (const candidate of candidatesOf(String(raw || ""))) {
      let value;
      try {
        value = JSON.parse(candidate);
      } catch (e) {
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const alt = typeof value.alt === "string" ? value.alt.replace(/\s*\r?\n\s*/g, " ").trim() : "";
      const sections = normaliseSections(value.sections);
      let longdesc;
      if (sections.length) {
        longdesc = sectionsToMarkup(sections);
      } else {
        const longdescRaw = Array.isArray(value.longdesc) ? value.longdesc.join("\n") : value.longdesc;
        longdesc = typeof longdescRaw === "string" ? longdescRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n") : "";
      }
      if (!alt || !longdesc) continue;
      return { kind: typeof value.kind === "string" ? value.kind.trim() : "", alt, longdesc, sections };
    }
    return null;
  }

  /** True when the page will add a Data table to this figure's long description: the kit's own test, on the same source. */
  function hasDataTable(source) {
    const figure = window.TikzKitFigure;
    if (!figure || typeof figure.parseDataTable !== "function") return false;
    try {
      return !!figure.parseDataTable(source);
    } catch (e) {
      logWarn("parseDataTable threw; assuming no Data table:", e);
      return false;
    }
  }

  // ------------------------------------------------------------------ the send
  /**
   * @param {{source: string, svg: string, signal?: AbortSignal}} options
   * @returns {Promise<object>} never rejects
   */
  async function describe(options) {
    const opts = options || {};
    if (typeof opts.source !== "string" || !opts.source.trim() || typeof opts.svg !== "string" || !opts.svg.trim()) {
      return fail(REASONS.BAD_INPUT, "There is no source or drawing to describe.");
    }
    if (inFlight) return fail(REASONS.BAD_INPUT, "A description is already being written.");

    const plan = resolvePlan();
    if (!plan.length) return fail(REASONS.NO_MODEL, "No model that can read images is available on this provider, so nothing was sent.");
    if (foundrySignedOut()) return fail(REASONS.SIGN_IN, SIGN_IN_MESSAGE);
    const modelId = plan[0];
    const instance = ensureEmbed();
    if (!instance) return fail(REASONS.NO_EMBED, "The model connection is not available on this page, so nothing was sent.");

    // Cancellation has one path, reached by cancel() and by an abort on the caller's signal: the send races against it.
    let cancelled = false;
    let rejectCancel = null;
    const cancellation = new Promise((_resolve, reject) => {
      rejectCancel = reject;
    });
    cancellation.catch(() => {}); // the race below handles it; this stops an unhandled rejection when nothing is racing
    const current = {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        for (const method of ["cancelStreaming", "cancelRequest"]) {
          try {
            if (typeof instance[method] === "function") instance[method]("User cancelled");
          } catch (e) {
            logWarn(method + " failed:", e);
          }
        }
        rejectCancel(new Error(CANCEL_MESSAGE));
      },
    };
    inFlight = current;
    const onAbort = () => current.cancel();
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener("abort", onAbort);
    }

    try {
      const prompt = await Promise.race([loadPrompt(), cancellation]);
      if (!prompt) return fail(REASONS.NO_PROMPT, "The describe prompt could not be loaded, so nothing was sent.", { model: modelId });

      let dataUrl;
      try {
        const blob = await Promise.race([window.TikzKitPng.toPng(opts.svg, { scale: PNG_SCALE }), cancellation]);
        dataUrl = await blobToDataUrl(blob);
      } catch (e) {
        if (cancelled) return fail(REASONS.CANCELLED, CANCEL_MESSAGE, { model: modelId });
        return fail(REASONS.PNG, "The picture of the drawing could not be made: " + ((e && e.message) || e), { model: modelId });
      }

      instance.setSystemPrompt(prompt);
      const dataNote = "Data table added by the page below your description: " + (hasDataTable(opts.source) ? "yes" : "no");
      const numberContext = { drawnText: drawnTextOf(opts.svg), source: opts.source };
      const userText =
        "Describe this figure. The picture is above; its TikZ source follows.\n\n" + dataNote + "\n" + factsLines(opts.source, opts.svg) + "\n\nTikZ source:\n" + opts.source;
      const userMessage = (text) => ({ role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text }] });
      let sends = 0; // shared by every model's turn: a press makes at most MAX_SENDS_PER_PRESS

      /**
       * One send. Returns { raw } for a reply that arrived whole, or { failure } for a refusal (cancelled, failed, cut off).
       * A reply the provider cut off at its token limit is refused before it is parsed: a cut-off reply can still parse, and would then
       * be written as though it were whole. It is not sent again to the same model; the same prompt would be cut at the same place.
       */
      async function oneSend(modelId, messages, lastRaw) {
        sends += 1;
        let response;
        try {
          response = await Promise.race([
            instance.sendStreamingRequest({
              userPrompt: userText, // validated by the embed and otherwise unused: the messages below are sent as they stand
              messages,
            }),
            cancellation,
          ]);
        } catch (e) {
          if (cancelled) return { failure: fail(REASONS.CANCELLED, CANCEL_MESSAGE, { model: modelId, raw: lastRaw }) };
          return { failure: fail(REASONS.SEND, "The request failed: " + ((e && e.message) || e), { model: modelId, raw: lastRaw }) };
        }
        if (cancelled) return { failure: fail(REASONS.CANCELLED, CANCEL_MESSAGE, { model: modelId, raw: lastRaw }) };
        const raw = typeof response === "string" ? response : (response && response.text) || "";
        if (response && response.finishReason === FINISH_REASON_LENGTH) {
          return { failure: fail(REASONS.TRUNCATED, "The model's reply was cut off at its limit, so it was not used.", { model: modelId, raw }) };
        }
        return { raw };
      }

      // One model's turn: the sign-in refresh, then its send(s). Only the first model of the plan may repeat after an unreadable
      // reply. A reply that parses but carries numbers nothing supports gets ONE correction on the same model, inside the same cap.
      async function runModel(modelId, maxAttempts) {
        instance.setModel(modelId);
        await Promise.race([refreshFoundryTokenIfNeeded(), cancellation]);
        let raw = "";
        let parsed = null;
        let attempts = 0;
        let askedText = userText;
        for (let attempt = 1; attempt <= maxAttempts && sends < MAX_SENDS_PER_PRESS; attempt += 1) {
          askedText = attempt === 1 ? userText : userText + PARSE_RETRY_SUFFIX;
          const sent = await oneSend(modelId, [userMessage(askedText)], raw);
          if (sent.failure) return sent.failure;
          raw = sent.raw;
          attempts = attempt;
          parsed = parseReply(raw);
          if (parsed) break;
          logWarn("Attempt " + attempt + " on " + modelId + " did not give a usable JSON reply");
        }
        if (!parsed) return fail(REASONS.PARSE, "The model's reply could not be read as a description, so nothing was written.", { model: modelId, raw });

        let unsupported = unsupportedNumbersOf(parsed, numberContext);
        if (unsupported.length && sends < MAX_SENDS_PER_PRESS) {
          const messages = [userMessage(askedText), { role: "assistant", content: raw }, { role: "user", content: correctionText(unsupported) }];
          const sent = await oneSend(modelId, messages, raw);
          if (sent.failure && sent.failure.reason === REASONS.CANCELLED) return sent.failure;
          // A correction that fails, is cut off or cannot be read leaves the first reply in place, still flagged.
          const corrected = sent.failure ? null : parseReply(sent.raw);
          if (corrected) {
            parsed = corrected;
            raw = sent.raw;
            unsupported = unsupportedNumbersOf(corrected, numberContext);
          } else {
            logWarn("The number correction on " + modelId + " gave no usable reply; keeping the first reply");
          }
        }
        return Object.assign({ ok: true, model: modelId, attempts, raw, unsupportedNumbers: unsupported }, parsed);
      }

      let outcome = null;
      let flagged = null; // the latest reply that was readable but still carried unsupported numbers
      for (let index = 0; index < plan.length && sends < MAX_SENDS_PER_PRESS; index += 1) {
        outcome = await runModel(plan[index], index === 0 ? MAX_PARSE_ATTEMPTS : 1);
        if (outcome.ok) {
          if (!outcome.unsupportedNumbers.length) break;
          flagged = outcome;
          if (index + 1 < plan.length) logWarn("Escalating from " + plan[index] + " to " + plan[index + 1] + " after unsupported numbers: " + outcome.unsupportedNumbers.join(", "));
          continue;
        }
        if (!ESCALATE_ON.has(outcome.reason) || cancelled) break;
        if (index + 1 < plan.length) logWarn("Escalating from " + plan[index] + " to " + plan[index + 1] + " after: " + outcome.reason);
      }
      // A later model that failed outright does not take away a readable reply the earlier one gave; a cancel always wins.
      if (outcome && !outcome.ok && flagged && outcome.reason !== REASONS.CANCELLED) outcome = flagged;
      return Object.assign(outcome, { escalated: plan.indexOf(outcome.model) > 0 });
    } catch (e) {
      if (cancelled) return fail(REASONS.CANCELLED, CANCEL_MESSAGE);
      logError("describe failed:", e);
      return fail(REASONS.SEND, "The description could not be created: " + ((e && e.message) || e));
    } finally {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      inFlight = null;
    }
  }

  // ------------------------------------------------------------------ fix with AI (P4b)
  const FIX_PROMPT_FILE = "fix.txt";
  const FIX_PROMPT_GLOBAL = "TIKZ_STUDIO_FIX_PROMPT";
  const FIX_CANCEL_MESSAGE = "Fix stopped.";
  const FIX_PARSE_MESSAGE = "The model's reply could not be read as a fix, so nothing was changed.";
  const FIX_STALE_MESSAGE = "The source changed while the fix was being written, so the result was not used.";
  /** How much of the end of the TeX log a request carries. The request says how many characters of how many, so nothing is cut silently. */
  const LOG_TAIL_CHARS = 4000;

  const oneLineOf = (value) => String(value == null ? "" : value).replace(/\s*\r?\n\s*/g, " ").trim();

  /** The source with "N: " at the start of every line, so the model can answer in the compiler's own line numbers. */
  function numberedSource(source) {
    return String(source).split("\n").map((line, i) => i + 1 + ": " + line).join("\n");
  }

  function problemsText(errors) {
    if (!errors.length) return "- (none reported)";
    return errors
      .map((e) => "- " + (e.line ? "line " + e.line + ": " : "") + oneLineOf(e.message) + (e.detail ? " (" + oneLineOf(e.detail) + ")" : ""))
      .join("\n");
  }

  function logText(log) {
    const whole = String(log || "");
    const tail = whole.length > LOG_TAIL_CHARS ? whole.slice(-LOG_TAIL_CHARS) : whole;
    return "TeX log (last " + tail.length + " of " + whole.length + " characters):\n" + (tail || "(empty)");
  }

  function fixRequestText(source, errors, log) {
    return "This TikZ source did not compile.\n\nSource, with line numbers:\n" + numberedSource(source) + "\n\nProblems reported:\n" + problemsText(errors) + "\n\n" + logText(log);
  }

  function fixRetryText(errors, log) {
    return "That source still does not compile. Problems reported for it:\n" + problemsText(errors) + "\n\n" + logText(log) + "\n\nStart again from the original source and reply with the whole JSON object.";
  }

  /** `{ source, change }` from a reply, or null. The source keeps its text exactly; only its line endings are made "\n". */
  function parseFixReply(raw) {
    for (const candidate of candidatesOf(String(raw || ""))) {
      let value;
      try {
        value = JSON.parse(candidate);
      } catch (e) {
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if (typeof value.source !== "string" || !value.source.trim()) continue;
      return { source: value.source.replace(/\r\n?/g, "\n"), change: oneLineOf(value.change) };
    }
    return null;
  }

  /** The fast model then the better one, as Describe has them, for the active provider only. No vision is needed, so only eligibility is checked. */
  function resolveFixPlan() {
    const pair = MODEL_BY_PROVIDER[activeProvider()];
    if (!pair) {
      logWarn("No model is chosen for provider", activeProvider());
      return [];
    }
    const eligible = eligibleIds(activeProvider());
    return [pair.first, pair.better].filter((id) => eligible.includes(id));
  }

  /**
   * One press of Fix with AI: up to MAX_SENDS_PER_PRESS sends (the same cap as Describe), each proposal trial-rendered through
   * options.trialRender, stopping at the first that renders. The fast model makes the first tries and the better model takes the last
   * one, or takes over once when the fast model's request fails, is cut off or cannot be read (Describe's escalation). A model of the
   * other provider is never used. Never rejects, and never writes the author's source: it returns a proposal and the page applies it.
   * @param {{source: string, errors: Array, log?: string, trialRender: Function, isCurrent?: Function, signal?: AbortSignal}} options
   * @returns {Promise<{ok: true, source: string, change: string, model: string, escalated: boolean, sends: number, attempts: object[]}
   *   | {ok: false, reason: string, message: string, sends?: number, attempts?: object[]}>}
   */
  async function fix(options) {
    const opts = options || {};
    const errors = Array.isArray(opts.errors) ? opts.errors : [];
    if (typeof opts.source !== "string" || !opts.source.trim() || typeof opts.trialRender !== "function") {
      return fail(REASONS.BAD_INPUT, "There is no source to fix.");
    }
    if (inFlight) return fail(REASONS.BAD_INPUT, "Another AI request is already running.");
    const plan = resolveFixPlan();
    if (!plan.length) return fail(REASONS.NO_MODEL, "No model is available on this provider, so nothing was sent.");
    if (foundrySignedOut()) return fail(REASONS.SIGN_IN, SIGN_IN_MESSAGE);
    const instance = ensureEmbed();
    if (!instance) return fail(REASONS.NO_EMBED, "The model connection is not available on this page, so nothing was sent.");

    let cancelled = false;
    let rejectCancel = null;
    const cancellation = new Promise((_resolve, reject) => {
      rejectCancel = reject;
    });
    cancellation.catch(() => {}); // the races below handle it; this stops an unhandled rejection when nothing is racing
    const trialAbort = new AbortController();
    const current = {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        for (const method of ["cancelStreaming", "cancelRequest"]) {
          try {
            if (typeof instance[method] === "function") instance[method]("User cancelled");
          } catch (e) {
            logWarn(method + " failed:", e);
          }
        }
        trialAbort.abort();
        rejectCancel(new Error(FIX_CANCEL_MESSAGE));
      },
    };
    inFlight = current;
    const onAbort = () => current.cancel();
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener("abort", onAbort);
    }

    let sends = 0;
    const attempts = []; // proposals that did not render, oldest first
    const finish = (result) => Object.assign(result, { sends, attempts: attempts.slice() });
    const isStale = () => typeof opts.isCurrent === "function" && !opts.isCurrent();

    try {
      const prompt = await Promise.race([loadPrompt(FIX_PROMPT_FILE, FIX_PROMPT_GLOBAL), cancellation]);
      if (!prompt) return fail(REASONS.NO_PROMPT, "The fix prompt could not be loaded, so nothing was sent.");
      instance.setSystemPrompt(prompt);
      const requestText = fixRequestText(opts.source, errors, opts.log);
      let messages = [{ role: "user", content: requestText }];
      let modelIndex = 0;
      let refreshedFor = null;

      while (sends < MAX_SENDS_PER_PRESS) {
        const modelId = plan[modelIndex];
        instance.setModel(modelId);
        // the sign-in is refreshed before a model's first send (Foundry only), including the better model's, which can follow long sends
        if (refreshedFor !== modelId) {
          refreshedFor = modelId;
          const refresh = refreshFoundryTokenIfNeeded();
          await Promise.race([refresh, cancellation]);
        }
        sends += 1;
        let raw = "";
        let problem = null;
        try {
          const response = await Promise.race([instance.sendStreamingRequest({ userPrompt: requestText, messages }), cancellation]);
          raw = typeof response === "string" ? response : (response && response.text) || "";
          const cutOff = !!response && response.finishReason === FINISH_REASON_LENGTH;
          if (cutOff) problem = fail(REASONS.TRUNCATED, "The model's reply was cut off at its limit, so it was not used.", { model: modelId, raw });
        } catch (e) {
          if (cancelled) return finish(fail(REASONS.CANCELLED, FIX_CANCEL_MESSAGE, { model: modelId }));
          problem = fail(REASONS.SEND, "The request failed: " + ((e && e.message) || e), { model: modelId });
        }
        if (cancelled) return finish(fail(REASONS.CANCELLED, FIX_CANCEL_MESSAGE, { model: modelId }));
        if (isStale()) return finish(fail(REASONS.STALE, FIX_STALE_MESSAGE, { model: modelId }));

        const parsed = problem ? null : parseFixReply(raw);
        if (!problem && !parsed) problem = fail(REASONS.PARSE, FIX_PARSE_MESSAGE, { model: modelId, raw });
        if (problem) {
          if (ESCALATE_ON.has(problem.reason) && modelIndex + 1 < plan.length) {
            logWarn("Escalating from " + modelId + " to " + plan[modelIndex + 1] + " after: " + problem.reason);
            modelIndex += 1;
            continue;
          }
          return finish(problem);
        }

        // A proposal identical to the source is not a fix and is not worth a TeX run: it fails with the problems it started with.
        const trial = parsed.source === opts.source
          ? { ok: false, errors, log: opts.log || "" }
          : await Promise.race([opts.trialRender(parsed.source, trialAbort.signal), cancellation]);
        if (cancelled) return finish(fail(REASONS.CANCELLED, FIX_CANCEL_MESSAGE, { model: modelId }));
        if (isStale()) return finish(fail(REASONS.STALE, FIX_STALE_MESSAGE, { model: modelId }));
        if (trial.ok) {
          return finish({ ok: true, source: parsed.source, change: parsed.change, model: modelId, escalated: modelIndex > 0, raw });
        }
        attempts.push({ n: attempts.length + 1, model: modelId, source: parsed.source, change: parsed.change, errors: trial.errors, log: trial.log });
        messages = messages.concat([{ role: "assistant", content: raw }, { role: "user", content: fixRetryText(trial.errors, trial.log) }]);
        // the better model takes the last try when the fast model's earlier tries did not compile
        if (sends === MAX_SENDS_PER_PRESS - 1 && modelIndex === 0 && plan.length > 1) modelIndex = 1;
      }
      return finish(fail(REASONS.NO_FIX, "No fix that renders was found after " + attempts.length + (attempts.length === 1 ? " try." : " tries.")));
    } catch (e) {
      if (cancelled) return finish(fail(REASONS.CANCELLED, FIX_CANCEL_MESSAGE));
      logError("fix failed:", e);
      return finish(fail(REASONS.SEND, "The fix could not be created: " + ((e && e.message) || e)));
    } finally {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      inFlight = null;
    }
  }

  // ------------------------------------------------------------------ draw with AI (P4c)
  const GENERATE_PROMPT_FILE = "generate.txt";
  const GENERATE_PROMPT_GLOBAL = "TIKZ_STUDIO_GENERATE_PROMPT";
  const GENERATE_CANCEL_MESSAGE = "Drawing stopped.";
  const GENERATE_PARSE_MESSAGE = "The model's reply could not be read as a drawing, so nothing was changed.";
  /** A "% @alt:", "% @caption:", "% @longdesc:" or "% @decorative" line. The author owns these; a generated source carries none. */
  const ANNOTATION_LINE_RE = /^\s*%\s*@/;

  /** The source without its "% @" lines. Other comment lines are the model's and stay: they are not the figure's text alternative. */
  function stripAnnotationLines(source) {
    return source
      .split("\n")
      .filter((line) => !ANNOTATION_LINE_RE.test(line))
      .join("\n");
  }

  /** `{ source, summary }` from a reply, or null. Line endings are made "\n" and any "% @" line is removed before anything else sees the source. */
  function parseGenerateReply(raw) {
    for (const candidate of candidatesOf(String(raw || ""))) {
      let value;
      try {
        value = JSON.parse(candidate);
      } catch (e) {
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if (typeof value.source !== "string") continue;
      const source = stripAnnotationLines(value.source.replace(/\r\n?/g, "\n"));
      if (!source.trim()) continue;
      return { source, summary: oneLineOf(value.summary) };
    }
    return null;
  }

  /** The user turn: the person's words, or a request to redraw the picture above, or both. */
  function generateRequestParts(words, dataUrl) {
    const trimmed = String(words || "").trim();
    let text;
    if (dataUrl) {
      text = "Redraw the picture above as TikZ." + (trimmed ? "\n\nThe person also wrote:\n" + trimmed : "");
    } else {
      text = "Draw this diagram as TikZ.\n\nThe person wrote:\n" + trimmed;
    }
    const content = dataUrl ? [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text }] : text;
    return { content, text };
  }

  function generateRetryText(errors, log) {
    return (
      "That source does not compile. Problems reported for it:\n" + problemsText(errors) + "\n\n" + logText(log) +
      "\n\nWrite a corrected drawing of the same request and reply with the whole JSON object."
    );
  }

  /**
   * Models for a Draw with AI press, from the active provider's DRAW_MODEL_BY_PROVIDER pair only: with a picture, both must be
   * eligible and vision-capable; for words alone eligibility is enough.
   */
  function resolveGeneratePlan(hasPicture) {
    const provider = activeProvider();
    const pair = DRAW_MODEL_BY_PROVIDER[provider];
    if (!pair) {
      logWarn("No Draw model is chosen for provider", provider);
      return [];
    }
    const ids = [pair.first, pair.better];
    if (hasPicture) return ids.filter((id) => usableModel(provider, id));
    const eligible = eligibleIds(provider);
    return ids.filter((id) => eligible.includes(id));
  }

  /**
   * One press of Draw with AI: up to MAX_SENDS_PER_PRESS sends (the same cap as Describe and Fix), each proposal trial-rendered through
   * options.trialRender, stopping at the first that renders. Same model order and escalation as Fix. The author's source is never read
   * or written here: the adapter returns a drawing and the page decides what to do with it. Never rejects.
   * @param {{words?: string, pictureDataUrl?: string, trialRender: Function, signal?: AbortSignal}} options
   * @returns {Promise<{ok: true, source: string, summary: string, svg: string, model: string, escalated: boolean, sends: number, attempts: object[], raw: string}
   *   | {ok: false, reason: string, message: string, sends?: number, attempts?: object[]}>}
   */
  async function generate(options) {
    const opts = options || {};
    const words = typeof opts.words === "string" ? opts.words.trim() : "";
    const dataUrl = typeof opts.pictureDataUrl === "string" && opts.pictureDataUrl ? opts.pictureDataUrl : "";
    if ((!words && !dataUrl) || typeof opts.trialRender !== "function") {
      return fail(REASONS.BAD_INPUT, "There is nothing to draw.");
    }
    if (inFlight) return fail(REASONS.BAD_INPUT, "Another AI request is already running.");
    const plan = resolveGeneratePlan(!!dataUrl);
    if (!plan.length) return fail(REASONS.NO_MODEL, "No model is available on this provider, so nothing was sent.");
    if (foundrySignedOut()) return fail(REASONS.SIGN_IN, SIGN_IN_MESSAGE);
    const instance = ensureEmbed();
    if (!instance) return fail(REASONS.NO_EMBED, "The model connection is not available on this page, so nothing was sent.");

    let cancelled = false;
    let rejectCancel = null;
    const cancellation = new Promise((_resolve, reject) => {
      rejectCancel = reject;
    });
    cancellation.catch(() => {}); // the races below handle it; this stops an unhandled rejection when nothing is racing
    const trialAbort = new AbortController();
    const current = {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        for (const method of ["cancelStreaming", "cancelRequest"]) {
          try {
            if (typeof instance[method] === "function") instance[method]("User cancelled");
          } catch (e) {
            logWarn(method + " failed:", e);
          }
        }
        trialAbort.abort();
        rejectCancel(new Error(GENERATE_CANCEL_MESSAGE));
      },
    };
    inFlight = current;
    const onAbort = () => current.cancel();
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener("abort", onAbort);
    }

    let sends = 0;
    const attempts = []; // proposals that did not render, oldest first
    const finish = (result) => Object.assign(result, { sends, attempts: attempts.slice() });

    try {
      const prompt = await Promise.race([loadPrompt(GENERATE_PROMPT_FILE, GENERATE_PROMPT_GLOBAL), cancellation]);
      if (!prompt) return fail(REASONS.NO_PROMPT, "The drawing prompt could not be loaded, so nothing was sent.");
      instance.setSystemPrompt(prompt);
      const request = generateRequestParts(words, dataUrl);
      let messages = [{ role: "user", content: request.content }];
      let modelIndex = 0;
      let refreshedFor = null;

      while (sends < MAX_SENDS_PER_PRESS) {
        const modelId = plan[modelIndex];
        instance.setModel(modelId);
        // the sign-in is refreshed before a model's first send (Foundry only), including the better model's, which can follow long sends
        if (refreshedFor !== modelId) {
          refreshedFor = modelId;
          await Promise.race([refreshFoundryTokenIfNeeded(), cancellation]);
        }
        sends += 1;
        let raw = "";
        let problem = null;
        try {
          const response = await Promise.race([instance.sendStreamingRequest({ userPrompt: request.text, messages }), cancellation]);
          raw = typeof response === "string" ? response : (response && response.text) || "";
          if (response && response.finishReason === FINISH_REASON_LENGTH) {
            problem = fail(REASONS.TRUNCATED, "The model's reply was cut off at its limit, so it was not used.", { model: modelId, raw });
          }
        } catch (e) {
          if (cancelled) return finish(fail(REASONS.CANCELLED, GENERATE_CANCEL_MESSAGE, { model: modelId }));
          problem = fail(REASONS.SEND, "The request failed: " + ((e && e.message) || e), { model: modelId });
        }
        if (cancelled) return finish(fail(REASONS.CANCELLED, GENERATE_CANCEL_MESSAGE, { model: modelId }));

        const parsed = problem ? null : parseGenerateReply(raw);
        if (!problem && !parsed) problem = fail(REASONS.PARSE, GENERATE_PARSE_MESSAGE, { model: modelId, raw });
        if (problem) {
          if (ESCALATE_ON.has(problem.reason) && modelIndex + 1 < plan.length) {
            logWarn("Escalating from " + modelId + " to " + plan[modelIndex + 1] + " after: " + problem.reason);
            modelIndex += 1;
            continue;
          }
          return finish(problem);
        }

        const trial = await Promise.race([opts.trialRender(parsed.source, trialAbort.signal), cancellation]);
        if (cancelled) return finish(fail(REASONS.CANCELLED, GENERATE_CANCEL_MESSAGE, { model: modelId }));
        if (trial.ok && trial.svg) {
          return finish({ ok: true, source: parsed.source, summary: parsed.summary, svg: trial.svg, model: modelId, escalated: modelIndex > 0, raw });
        }
        attempts.push({ n: attempts.length + 1, model: modelId, source: parsed.source, summary: parsed.summary, errors: trial.errors, log: trial.log });
        messages = messages.concat([{ role: "assistant", content: raw }, { role: "user", content: generateRetryText(trial.errors, trial.log) }]);
        // the better model takes the last try when the fast model's earlier tries did not compile
        if (sends === MAX_SENDS_PER_PRESS - 1 && modelIndex === 0 && plan.length > 1) modelIndex = 1;
      }
      return finish(fail(REASONS.NO_DRAWING, "No drawing that renders was made after " + attempts.length + (attempts.length === 1 ? " try." : " tries.")));
    } catch (e) {
      if (cancelled) return finish(fail(REASONS.CANCELLED, GENERATE_CANCEL_MESSAGE));
      logError("generate failed:", e);
      return finish(fail(REASONS.SEND, "The drawing could not be made: " + ((e && e.message) || e)));
    } finally {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      inFlight = null;
    }
  }

  function cancel() {
    if (inFlight) inFlight.cancel();
  }

  window.TikzStudioLLM = Object.freeze({
    describe,
    fix,
    generate,
    resolveModel,
    cancel,
    checkNumbers,
    drawnTextOf,
    numbersIn,
    REASONS,
    MODEL_BY_PROVIDER,
    DRAW_MODEL_BY_PROVIDER,
    PNG_SCALE,
    MAX_SENDS_PER_PRESS,
  });
  logInfo("TikzStudioLLM ready");
})();
