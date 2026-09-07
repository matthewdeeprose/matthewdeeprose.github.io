/**
 * @file openrouter-embed-transcribe.js
 * @description Audio transcription client for the Foundry proxy Worker's
 * Speech route, POST /speech/transcriptions:transcribe.
 *
 * WHAT THIS MODULE OWNS
 * ---------------------
 * Composing the request, sending it, and normalising the reply into one shape.
 * Nothing else.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN — READ BEFORE EXTENDING
 * --------------------------------------------------------
 * IT SPEAKS TO NOTHING. No DOM writes, no live regions, no announcements, no
 * notifications, no focus changes. A caller decides what the user hears, and
 * AGENTS.md § Announcements is emphatic that a toast already announces through
 * the shared announcer — so a caller that pairs a notify*() with an announce()
 * for one event speaks it twice. Keeping every voice out of this module is what
 * makes that the caller's single decision rather than a shared one.
 *
 * IT HAS ONE WIRE TRANSFORM. The request body is composed in exactly one place,
 * _sendToSpeech(). Register item 36 records what a second, differently-keyed
 * transform costs: gates keyed on names the registry does not feed, and nine
 * correctly-registered models unreachable until a live send returned HTTP 400.
 *
 * THE TOKEN IS READ AT CALL TIME, NEVER AT LOAD, AND THIS IS LOAD-BEARING.
 * auth/entra-auth.js is tagged `defer` at tools.html:23382, while this module is
 * a plain script inside the openrouter-embed block around :19449. A plain script
 * executes during parsing and a deferred one only after parsing completes, so
 * window.EntraAuth is GUARANTEED undefined when this file runs. A module-scope
 * capture would therefore hold undefined for the life of the page — the exact
 * trap AGENTS.md § Announcements records for window.a11y, where ten call sites
 * across five files were dead because a deferred module captured a global that
 * a plain script had not yet published. Resolve it inside the function.
 *
 * @module OpenRouterEmbedTranscribe
 * @since 1 September 2026
 */
const OpenRouterEmbedTranscribe = (function () {
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
      console.error(`[EmbedTranscribe] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedTranscribe] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedTranscribe] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedTranscribe] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  // The Worker route. An EXACT path — worker.js matches it with === and not a
  // prefix, so a trailing slash or a sibling path falls through to the Worker's
  // own 404 rather than reaching Azure.
  const SPEECH_ROUTE_PATH = "/speech/transcriptions:transcribe";

  // Proxy URL precedence mirrors azure-openai-v1.js: providerConfig, then
  // localStorage, then this default. Kept identical so a colleague who has
  // pointed one adapter at a staging Worker does not find the other still on
  // production.
  const LS_PROXY_URL_KEY = "foundryProxyUrl";
  const DEFAULT_PROXY_URL =
    "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev";

  // The EntraAuth scope name, matching SCOPES in auth/entra-auth.js and
  // ENTRA_SCOPE_NAME in azure-openai-v1.js:82.
  const ENTRA_SCOPE_NAME = "foundry";

  // The 401 sentence follows chat/chat-core.js:76 in shape. Its tail differs on
  // purpose: Chat's reads "then send your message", which names an action this
  // tool does not have. The remedy sentence must describe the remedy the user
  // is actually in front of.
  const SIGNED_OUT_MESSAGE =
    "Your sign-in has expired. Sign in again to continue, then start the transcription.";

  /**
   * MEASURED FLOOR, NOT A CEILING — 43,679,539 bytes, measured 1 September 2026
   * by sending good-cop-bad-cop.mp3 (a 1-hour recording) through the PRODUCTION
   * Worker and receiving HTTP 200 with a full transcript in 55,173 ms.
   *
   * It is the largest payload KNOWN to succeed, not the largest that CAN. The
   * true ceiling — Cloudflare's request limit, Azure's, or whichever binds
   * first — has never been measured, and nothing here should be read as
   * claiming it. Raising this constant needs a new measurement, not an estimate.
   *
   * Recorded in openrouter-embed/docs/foundry-f2-pending-doc-updates.md, item 35,
   * the unit 4 and 5 evidence block.
   */
  const MEASURED_MAX_BYTES = 43679539;

  // Azure's documented fast-transcription input formats. MIME type is checked
  // first; extension is the fallback because Windows reports an EMPTY file.type
  // for audio picked through some dialogues, which would otherwise refuse a
  // perfectly valid mp3.
  const ACCEPTED_MIME_TYPES = Object.freeze([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/opus",
    "audio/webm",
    "audio/flac",
    "audio/x-flac",
    "audio/aac",
    "audio/aacp",
  ]);

  const ACCEPTED_EXTENSIONS = Object.freeze([
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".opus",
    ".webm",
    ".flac",
    ".aac",
  ]);

  const SUPPORTED_BACKENDS = Object.freeze(["speech"]);

  const DEFAULT_LOCALE = "en-GB";
  const DEFAULT_MAX_SPEAKERS = 2;

  /**
   * AZURE REFUSES DIARISATION OF ONE SPEAKER — MEASURED, NOT INFERRED.
   *
   * POST /speech/transcriptions:transcribe with the definition
   * {"locales":["en-GB"],"diarization":{"enabled":true,"maxSpeakers":1}}
   * returns HTTP 400, body verbatim:
   *
   *   {"code":"InvalidArgument","message":"Max speakers should be greater than
   *   1.","innerError":{"code":"InvalidParameter","message":"Max speakers
   *   should be greater than 1."}}
   *
   * Measured 2 September 2026 in the owner's browser, raised from the shipped
   * UI with the speaker select set to 1. Recorded in
   * openrouter-embed/docs/foundry-f2-pending-doc-updates.md, item 35, unit 8.
   *
   * So one speaker is expressed by OMITTING the diarization property entirely
   * rather than by asking for a maximum of one. The floor is a property of the
   * service, not a preference, and lowering it re-arms the 400.
   */
  const MIN_DIARISATION_SPEAKERS = 2;

  /**
   * The speaker number a phrase carries when diarisation was deliberately not
   * requested. See normaliseSpeechResponse for why this is NOT a fabrication.
   */
  const SINGLE_SPEAKER_LABEL = 1;

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Format a byte count for a message a person reads.
   * @param {number} bytes
   * @returns {string}
   */
  function formatMegabytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /**
   * Whether a requested speaker maximum is one diarisation can be asked for.
   *
   * THE ONE PLACE THIS IS DECIDED. transcribe() calls it once and passes the
   * answer to both the wire composer and the normaliser, so the request body
   * and the shape read back can never disagree about whether diarisation was
   * asked for — a divergence that would surface as speaker numbers appearing
   * or vanishing for no reason a caller could see.
   *
   * A non-numeric or absent value answers FALSE, which is the safe direction:
   * the worst outcome is a transcript with no speaker split, against a hard 400
   * that fails the whole run.
   *
   * @param {number} maxSpeakers
   * @returns {boolean}
   */
  function diarisationRequested(maxSpeakers) {
    const value = Number(maxSpeakers);
    return Number.isFinite(value) && value >= MIN_DIARISATION_SPEAKERS;
  }

  /**
   * How many distinct speakers a normalised result actually names.
   *
   * Used by both formatters to decide whether a "Speaker N:" label is telling
   * the reader anything. One speaker across the whole transcript makes every
   * label identical, so the label distinguishes nothing and is noise on every
   * line.
   *
   * @param {object} result - a normalised result
   * @returns {number}
   */
  function distinctSpeakerCount(result) {
    if (!result || !Array.isArray(result.phrases)) return 0;
    const seen = new Set();
    result.phrases.forEach((phrase) => {
      if (phrase && phrase.speaker !== null && phrase.speaker !== undefined) {
        seen.add(phrase.speaker);
      }
    });
    return seen.size;
  }

  /**
   * How a consumer wants speaker labels distributed across the rows it renders.
   *
   * A frozen const enum rather than a boolean, per AGENTS.md § Language & Code
   * Conventions: `speakerLabelFor(phrase, prev, true, true)` at a call site says
   * nothing about which `true` means what.
   *
   * EVERY_LINE is the DEFAULT and reproduces what this tool has always emitted.
   * A default that changed the output would silently rewrite the downloaded
   * file for every existing caller.
   */
  const SPEAKER_LABEL_MODE = Object.freeze({
    EVERY_LINE: "every-line",
    ON_CHANGE: "on-change",
  });

  /**
   * THE SINGLE PLACE THAT DECIDES WHETHER A PHRASE PRINTS A SPEAKER LABEL.
   *
   * Before this existed the rule was duplicated in `toPlainText` and `toSrt`,
   * and register item 43 adds three more consumers — the DOM renderer, and
   * later the plain-text edit view (item 45) and the diff view (item 47). Five
   * copies of a rule is five chances for it to disagree with itself, and the
   * disagreement would be silent: each output looks plausible alone.
   *
   * IT RETURNS THE SPEAKER, NOT A FORMATTED STRING. The three callers format
   * differently — `Speaker 1:` in plain text, `Speaker 1: ` in SRT, a separate
   * element in the DOM — so what is genuinely shared is the DECISION, and
   * pushing the wording in here would force every caller to unpick it again.
   *
   * The three suppression cases, all of which predate the mode parameter:
   *
   *   1. `speaker === null` — diarisation was asked for and the backend did not
   *      answer. There is no label rather than a "Speaker null". NOTE that this
   *      half of the guard is UNOBSERVABLE through either formatter's output:
   *      `null` is both the phrase's "no speaker" value AND this function's
   *      "no label" return, so a caller's own `label !== null` check reaches
   *      the same answer with the guard removed. No output-diff test can prove
   *      it. It is defence in depth, and is stated that way rather than
   *      claimed as tested.
   *   2. Labels are not informative — one distinct speaker across the whole
   *      transcript makes every label identical, so it separates nothing. This
   *      also covers a backend that returns no labels at all.
   *   3. ON_CHANGE mode — the label is printed only where the speaker differs
   *      from the previous row, so a run of consecutive phrases by one person
   *      carries it once. This is the checkbox's unchecked state.
   *
   * `labelsAreInformative` IS PASSED IN, DELIBERATELY, RATHER THAN COMPUTED
   * HERE. It is a property of the whole result, so computing it inside a
   * per-phrase call would make an O(n) scan run n times — quadratic on the very
   * transcripts that most need not to be. The caller hoists it once; see the
   * note in `toPlainText`.
   *
   * IT DELIBERATELY DOES NOT GUARD `undefined`, AND THAT IS A DECISION RATHER
   * THAN AN OVERSIGHT. A phrase whose `speaker` key is absent entirely makes
   * both formatters emit "Speaker undefined:" — that is HEAD's behaviour, it
   * predates this function, and adding a guard here would have changed the
   * downloaded .txt and .srt. Strict byte-identity of the download won, so the
   * shape is refused at the DOM renderer in the -ui file instead, where it
   * costs nothing. `normaliseSpeechResponse` cannot produce that shape today;
   * a second backend filling the same contract could.
   *
   * @param {object} args
   * @param {number|null} args.speaker - this phrase's speaker
   * @param {number|null|undefined} args.previousSpeaker - the previous phrase's
   *   speaker, or `undefined` at the first phrase. `undefined` and `null` are
   *   deliberately distinct: the first means there is no previous row, the
   *   second means the previous row had no speaker.
   * @param {boolean} args.labelsAreInformative - hoisted, `distinctSpeakerCount
   *   (result) > 1`
   * @param {string} [args.mode=SPEAKER_LABEL_MODE.EVERY_LINE]
   * @returns {number|null} the speaker to print, or null to print no label
   */
  function speakerLabelFor({
    speaker,
    previousSpeaker,
    labelsAreInformative,
    mode = SPEAKER_LABEL_MODE.EVERY_LINE,
  }) {
    if (speaker === null) return null;
    if (!labelsAreInformative) return null;
    if (mode === SPEAKER_LABEL_MODE.ON_CHANGE && speaker === previousSpeaker) {
      return null;
    }
    return speaker;
  }

  /**
   * The previous phrase's speaker, or undefined at the first phrase.
   *
   * Pulled out because all three consumers need the same lookup and getting it
   * wrong at index 0 is the easy mistake — `phrases[-1]` is undefined, so a
   * naive read throws rather than returning the "no previous row" answer.
   *
   * @param {Array} phrases
   * @param {number} index
   * @returns {number|null|undefined}
   */
  function previousSpeakerAt(phrases, index) {
    if (index <= 0) return undefined;
    const previous = phrases[index - 1];
    return previous ? previous.speaker : undefined;
  }

  /**
   * Lower-cased extension including the dot, or "" when there is none.
   * @param {string} name
   * @returns {string}
   */
  function extensionOf(name) {
    const dot = String(name || "").lastIndexOf(".");
    return dot === -1 ? "" : String(name).slice(dot).toLowerCase();
  }

  /**
   * Check a file before anything is sent. Called by transcribe() before any
   * network, so an oversize or wrong-typed file costs nothing.
   *
   * Validation happens at SELECTION rather than after upload, unlike the Image
   * Describer, which checks type at the seam and defers size because it
   * compresses first (image-describer-controller-ui.js:151-163). Audio is not
   * compressed, so there is nothing to defer to: telling somebody their file is
   * too large after they have waited for it to upload is the worse outcome.
   *
   * @param {File} file
   * @returns {{ok: boolean, reason: string|null}}
   */
  function validateFile(file) {
    if (!file) {
      return { ok: false, reason: "No file was supplied." };
    }

    if (typeof file.size !== "number" || typeof file.name !== "string") {
      return { ok: false, reason: "That does not look like a file." };
    }

    if (file.size === 0) {
      return { ok: false, reason: "That file is empty." };
    }

    const type = String(file.type || "").toLowerCase();
    const extension = extensionOf(file.name);
    const typeAccepted = type !== "" && ACCEPTED_MIME_TYPES.includes(type);
    const extensionAccepted = ACCEPTED_EXTENSIONS.includes(extension);

    // Either route may vouch for the file. An empty type is common on Windows
    // and is not itself a reason to refuse, so the extension carries it.
    if (!typeAccepted && !extensionAccepted) {
      const described = type !== "" ? type : extension || "an unknown type";
      return {
        ok: false,
        reason: `That is not an audio file this tool can read (${described}). Use MP3, WAV, M4A, OGG, Opus, WebM, FLAC or AAC.`,
      };
    }

    if (file.size > MEASURED_MAX_BYTES) {
      const fileSize = formatMegabytes(file.size);
      const limit = formatMegabytes(MEASURED_MAX_BYTES);
      // Both figures are rounded to one decimal, so a file barely over the
      // limit renders as the SAME string as the limit — "That file is 41.7 MB.
      // The largest size proven to work is 41.7 MB" reads as a broken message
      // rather than a refusal. Where they collide, state the limit only.
      const sizeClause =
        fileSize === limit ? "That file is too large" : `That file is ${fileSize}`;
      return {
        ok: false,
        reason: `${sizeClause}. The largest size proven to work is ${limit}, so please use a shorter recording or split it.`,
      };
    }

    return { ok: true, reason: null };
  }

  // ==========================================================================
  // NORMALISATION
  // ==========================================================================

  /**
   * Turn Azure's fast-transcription reply into the shape every backend returns.
   *
   * The shape is deliberately backend-neutral so an OpenRouter backend can fill
   * it later without a caller changing. `raw` keeps the untouched reply, so
   * nothing is lost by normalising and no caller has to guess what was dropped.
   *
   * NULL AND 1 MEAN DIFFERENT THINGS, AND THE DIFFERENCE IS LOAD-BEARING.
   * `diarised` says whether diarisation was ASKED FOR, so an absent `speaker`
   * can be read two ways rather than one:
   *
   *   diarised === true  → the backend was asked and did not answer, so `null`
   *                        is the honest value. This is the case item 35's
   *                        unit 6 (i) decision is about: a later OpenRouter
   *                        backend returns no speaker field at all, and must
   *                        degrade honestly rather than claim one speaker.
   *   diarised === false → WE chose not to ask, because the caller said one
   *                        speaker and Azure refuses to diarise for one. Every
   *                        phrase then belongs to that one speaker, so `1` is
   *                        what was requested and confirmed, not a fabrication.
   *
   * `diarised` DEFAULTS TO TRUE so a two-argument call keeps the older,
   * stricter behaviour and no existing caller changes meaning.
   *
   * @param {object} json - Azure's response body, already parsed
   * @param {string} backend
   * @param {boolean} [diarised=true] - whether diarisation was requested
   * @returns {{text: string, phrases: Array, durationMs: number, raw: object, backend: string}}
   */
  function normaliseSpeechResponse(json, backend, diarised = true) {
    const source = json && typeof json === "object" ? json : {};

    const combined = Array.isArray(source.combinedPhrases)
      ? source.combinedPhrases
      : [];
    const text = combined
      .map((entry) => (entry && entry.text ? String(entry.text) : ""))
      .filter(Boolean)
      .join(" ")
      .trim();

    const rawPhrases = Array.isArray(source.phrases) ? source.phrases : [];
    const phrases = rawPhrases.map((phrase) => ({
      // Azure omits `speaker` entirely when diarisation is off. Which value
      // that absence deserves depends on WHY it is off — see the JSDoc above.
      speaker:
        typeof phrase.speaker === "number" && Number.isFinite(phrase.speaker)
          ? phrase.speaker
          : diarised
            ? null
            : SINGLE_SPEAKER_LABEL,
      offsetMs: Number(phrase.offsetMilliseconds) || 0,
      durationMs: Number(phrase.durationMilliseconds) || 0,
      text: phrase.text ? String(phrase.text) : "",
      // Confidence is PER-RUN, not a stable property of the audio: the same
      // file measured 0.9185525 twice and 0.91823304 once, with byte-identical
      // text. Never assert on it in a test.
      confidence:
        typeof phrase.confidence === "number" ? phrase.confidence : null,
    }));

    return {
      text,
      phrases,
      durationMs: Number(source.durationMilliseconds) || 0,
      raw: source,
      backend,
    };
  }

  // ==========================================================================
  // FORMATTERS — pure functions over the normalised shape
  // ==========================================================================

  /**
   * Milliseconds to an SRT timestamp, HH:MM:SS,mmm.
   * @param {number} ms
   * @returns {string}
   */
  function toSrtTimestamp(ms) {
    const total = Math.max(0, Math.floor(Number(ms) || 0));
    const milliseconds = total % 1000;
    const totalSeconds = Math.floor(total / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const pad = (value, width) => String(value).padStart(width, "0");
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(
      milliseconds,
      3,
    )}`;
  }

  /**
   * Milliseconds to a reading clock, H:MM:SS or MM:SS.
   * @param {number} ms
   * @returns {string}
   */
  function toClock(ms) {
    const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${minutes}:${pad(seconds)}`;
  }

  /**
   * Render a readable transcript. Pure — no DOM, no side effects.
   * @param {object} result - a normalised result
   * @param {{speakers?: boolean, timestamps?: boolean}} [options]
   * @returns {string}
   */
  function toPlainText(result, { speakers = true, timestamps = true } = {}) {
    if (!result || !Array.isArray(result.phrases)) return "";
    if (result.phrases.length === 0) return result.text || "";

    // Computed ONCE over the whole result, not per phrase: the question is a
    // property of the transcript, and asking it per line would turn an O(n)
    // scan into an O(n squared) one. The largest transcript ever MEASURED is
    // 658 phrases (register item 35 unit 3 (e), a one-hour four-speaker
    // recording); no ceiling has been established, so the hoist is worth
    // keeping whatever the real upper bound turns out to be.
    const labelsAreInformative = distinctSpeakerCount(result) > 1;

    return result.phrases
      .map((phrase, index) => {
        const parts = [];
        if (timestamps) parts.push(`[${toClock(phrase.offsetMs)}]`);
        // Whether a label is printed is decided in ONE place — see
        // speakerLabelFor. `speakers` stays here rather than moving into it:
        // that flag is a caller's preference about wanting labels at all,
        // which is a different question from whether a label would mean
        // anything.
        const label = speakers
          ? speakerLabelFor({
              speaker: phrase.speaker,
              previousSpeaker: previousSpeakerAt(result.phrases, index),
              labelsAreInformative,
            })
          : null;
        if (label !== null) parts.push(`Speaker ${label}:`);
        parts.push(phrase.text);
        return parts.join(" ").trim();
      })
      .join("\n");
  }

  /**
   * Render SubRip subtitles. Pure — no DOM, no side effects.
   * @param {object} result - a normalised result
   * @returns {string}
   */
  function toSrt(result) {
    if (!result || !Array.isArray(result.phrases)) return "";

    // Hoisted for the reason toPlainText gives, and passed to the shared
    // resolver rather than re-tested here. The one-speaker case is what makes
    // this load-bearing: that path carries a real speaker number rather than
    // null, so without the suppression a single-speaker transcript would print
    // "Speaker 1: " on every subtitle line while the plain text omitted it.
    const labelsAreInformative = distinctSpeakerCount(result) > 1;

    return result.phrases
      .map((phrase, index) => {
        const start = toSrtTimestamp(phrase.offsetMs);
        const end = toSrtTimestamp(phrase.offsetMs + phrase.durationMs);
        // SRT is a DOWNLOADED artefact and never follows the screen's display
        // mode, so it does not pass one: it always resolves at EVERY_LINE.
        const speaker = speakerLabelFor({
          speaker: phrase.speaker,
          previousSpeaker: previousSpeakerAt(result.phrases, index),
          labelsAreInformative,
        });
        const label = speaker !== null ? `Speaker ${speaker}: ` : "";
        return `${index + 1}\n${start} --> ${end}\n${label}${phrase.text}\n`;
      })
      .join("\n");
  }

  // ==========================================================================
  // SPEECH BACKEND
  // ==========================================================================

  /**
   * Resolve the proxy URL by the adapters' precedence.
   * @param {object|null} providerConfig
   * @returns {string}
   */
  function resolveProxyUrl(providerConfig) {
    let proxyUrl = null;

    if (
      providerConfig &&
      typeof providerConfig.proxyUrl === "string" &&
      providerConfig.proxyUrl.trim()
    ) {
      proxyUrl = providerConfig.proxyUrl.trim();
    } else {
      let stored = null;
      try {
        stored = window.localStorage.getItem(LS_PROXY_URL_KEY);
      } catch (err) {
        // Storage can throw in a locked-down profile. A default is better than
        // a failure here, so this is logged and swallowed deliberately.
        logWarn("Could not read the stored proxy URL:", err.message);
      }
      proxyUrl = stored && stored.trim() ? stored.trim() : DEFAULT_PROXY_URL;
    }

    return proxyUrl.replace(/\/+$/, "");
  }

  /**
   * Read the cached Entra token for the Foundry scope.
   *
   * getCachedToken is SYNCHRONOUS and returns string|null (auth/entra-auth.js
   * :542). The typeof guard is not decoration: getToken and ensureFresh on the
   * same object are async, and passing one of those by mistake would put the
   * string "[object Promise]" into an Authorization-style header, which fails
   * as a 401 that looks like an expired sign-in.
   *
   * @returns {string|null}
   */
  function readEntraToken() {
    const auth = window.EntraAuth;
    if (!auth || typeof auth.getCachedToken !== "function") {
      logWarn("EntraAuth.getCachedToken is not available.");
      return null;
    }

    const token = auth.getCachedToken(ENTRA_SCOPE_NAME);
    return typeof token === "string" && token ? token : null;
  }

  /**
   * Send one transcription request to the Worker's Speech route.
   *
   * THE ONLY PLACE A REQUEST BODY IS COMPOSED. Content-Type is deliberately not
   * set: the browser must generate the multipart boundary, and worker.js copies
   * the header whole so the boundary survives to Azure. Setting it by hand
   * omits the boundary and Azure cannot parse the parts.
   *
   * @param {File} file
   * @param {{locale: string, maxSpeakers: number, diarised: boolean, signal: AbortSignal|undefined, providerConfig: object|null}} options
   * @returns {Promise<object>} the parsed Azure body
   */
  async function _sendToSpeech(file, options) {
    const token = readEntraToken();
    if (!token) {
      // Rejected BEFORE any network, so a signed-out person never waits on a
      // request that cannot succeed.
      const err = new Error(SIGNED_OUT_MESSAGE);
      err.status = 401;
      throw err;
    }

    const proxyUrl = resolveProxyUrl(options.providerConfig);
    const targetUrl = proxyUrl + SPEECH_ROUTE_PATH;

    // The property is ADDED rather than sent with a falsy value. Azure reads
    // the definition as a whole, and there is no measured spelling of "one
    // speaker" it accepts — {"enabled":false} and {"maxSpeakers":1} are both
    // untested guesses, and the latter is the measured 400. Omission is the
    // only shape with evidence behind it.
    const definition = { locales: [options.locale] };
    if (options.diarised) {
      definition.diarization = {
        enabled: true,
        maxSpeakers: options.maxSpeakers,
      };
    }

    const form = new FormData();
    form.append("audio", file, file.name);
    form.append("definition", JSON.stringify(definition));

    logInfo(
      `Transcribing ${file.name} (${formatMegabytes(file.size)}) via ${targetUrl}`,
    );

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "x-user-token": token },
      body: form,
      signal: options.signal,
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.text();
      } catch (_) {
        errorBody = "<unable to read error body>";
      }
      // Matching azure-openai-v1.js:828-833 and :1014-1019 exactly. err.body
      // carries the response VERBATIM, which is what preserves the
      // Worker-versus-Azure discriminator for a caller: a body whose `error` is
      // a string came from the Worker, and one whose `error` is an object came
      // from Azure. Summarising it here would destroy that distinction.
      const err = new Error(
        `Transcription request failed: HTTP ${response.status} — ${errorBody}`,
      );
      err.status = response.status;
      err.body = errorBody;
      throw err;
    }

    return response.json();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Transcribe an audio file.
   *
   * @param {File} file
   * @param {object} [options]
   * @param {string} [options.locale="en-GB"]
   * @param {number} [options.maxSpeakers=2] - 1 omits diarisation entirely,
   *   because Azure refuses to diarise for one speaker with HTTP 400; every
   *   phrase then comes back as speaker 1 and the formatters print no labels
   * @param {string} [options.backend="speech"]
   * @param {AbortSignal} [options.signal]
   * @param {object} [options.providerConfig]
   * @returns {Promise<{text: string, phrases: Array, durationMs: number, raw: object, backend: string}>}
   */
  async function transcribe(
    file,
    {
      locale = DEFAULT_LOCALE,
      maxSpeakers = DEFAULT_MAX_SPEAKERS,
      backend = "speech",
      signal,
      providerConfig = null,
    } = {},
  ) {
    if (!SUPPORTED_BACKENDS.includes(backend)) {
      throw new Error(
        `Unknown transcription backend "${backend}". Only "speech" is available.`,
      );
    }

    // Before any network, so a refused file costs nothing.
    const validation = validateFile(file);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    // Decided ONCE and handed to both the wire composer and the normaliser, so
    // the body that goes out and the shape read back cannot disagree about
    // whether diarisation was asked for.
    const diarised = diarisationRequested(maxSpeakers);

    const started = Date.now();
    const json = await _sendToSpeech(file, {
      locale,
      maxSpeakers,
      diarised,
      signal,
      providerConfig,
    });
    const result = normaliseSpeechResponse(json, backend, diarised);

    logInfo(
      `Transcribed in ${Date.now() - started} ms: ${result.phrases.length} phrases, ${result.durationMs} ms of audio`,
    );

    return result;
  }

  logInfo("Transcribe module loaded");

  return {
    transcribe: transcribe,
    validateFile: validateFile,
    toPlainText: toPlainText,
    toSrt: toSrt,
    // Exported for the DOM renderer in the -ui file, which must reach the SAME
    // label decision these two formatters reach. A renderer with its own copy
    // of the rule is the fourth copy this resolver exists to prevent.
    distinctSpeakerCount: distinctSpeakerCount,
    speakerLabelFor: speakerLabelFor,
    previousSpeakerAt: previousSpeakerAt,
    SPEAKER_LABEL_MODE: SPEAKER_LABEL_MODE,
    MEASURED_MAX_BYTES: MEASURED_MAX_BYTES,
  };
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.OpenRouterEmbedTranscribe resolve at all. Without
// it the bare identifier would still work while every
// window.OpenRouterEmbedTranscribe reference read undefined — which is exactly
// the trap AGENTS.md § Announcements (SC 4.1.3), under "The four SHARED
// ANNOUNCEMENT CHANNELS", records for ALLY_UI_MANAGER, UniversalModal and
// UniversalNotifications: all three are top-level const declarations, so a
// console probe or a driven harness that reaches them through window silently
// instruments nothing.
window.OpenRouterEmbedTranscribe = OpenRouterEmbedTranscribe;
