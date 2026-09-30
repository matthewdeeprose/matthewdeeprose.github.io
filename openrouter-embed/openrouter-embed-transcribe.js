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
  //
  // THIS IS THE AZURE UK SOUTH CONTAINER APP AS OF 21 SEPTEMBER 2026, NOT THE
  // CLOUDFLARE WORKER. Owner decision, taken for tester reach. "Kept identical"
  // above is the load-bearing half: this adapter is reached by a different
  // route from the other two — resolveProxyUrl reads storage inside the
  // per-request path rather than at configure time — so a copy left behind here
  // would route Transcribe to a host the rest of the app had left, and nothing
  // in the page would say so.
  //
  // The accepted consequence, and the keep-in-step obligation covering all six
  // copies, are in the sibling comment in providers/azure-openai-v1.js.
  const LS_PROXY_URL_KEY = "foundryProxyUrl";
  const DEFAULT_PROXY_URL =
    "https://accesstools-proxy-staging.politebeach-5f8ce065.uksouth.azurecontainerapps.io";

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
   * The stem every unnamed speaker prints, in all three surfaces and in the
   * caption lane's adapter. Hoisted here because unit 2 is the first code to
   * compose it outside a template literal.
   *
   * UNIT 5 HAS NOW ROUTED BOTH FORMATTERS THROUGH `speakerDisplayName`, so the
   * inline `Speaker ${n}` literals this comment used to defer are gone from
   * `toPlainText` and `toSrt`. The withdrawn clause read: "the three existing
   * call sites keep their inline literals until unit 5 routes them through
   * `speakerDisplayName`, so that this unit cannot move a downloaded byte."
   * That was true of unit 2 and is no longer the arrangement.
   *
   * THE BYTE-IDENTITY IT PROTECTED STILL HOLDS, by a different mechanism:
   * `speakerDisplayName` returns this exact stem for an absent name, so an
   * empty names map reproduces the previous output character for character.
   * Unit 5 measured that on both downloads rather than reasoning it.
   */
  const SPEAKER_NAME_PREFIX = "Speaker ";

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
   * WHAT A SPEAKER IS CALLED — the name if the slot carries one, otherwise
   * `Speaker N`.
   *
   * Sits IMMEDIATELY AFTER `speakerLabelFor` on purpose: that function decides
   * WHETHER a label prints, this one decides WHAT IT SAYS, and the two halves
   * of one question are easier to keep consistent when they are read together.
   *
   * IT IS DOWNSTREAM OF THAT DECISION AND NEVER INSIDE IT. `speakerLabelFor`'s
   * signature is load-bearing across a lane boundary — the other project's
   * caption tool calls it, and its only protection is a check that the function
   * exists, so a changed signature would pass that check and quietly produce
   * wrong caption files. Naming therefore sits beside it and never in it.
   *
   * NAMED `speakerDisplayName`, NOT `speakerStemFor`. The design calls the
   * return value a display stem, but `STEM` already means an id prefix in this
   * codebase — `ROW_ID_STEM`, `EDIT_ID_STEM` — and a second meaning for one
   * word in one lane is a collision a later reader has to unpick.
   *
   * IT RETURNS NO PUNCTUATION, EVER. `Amira` or `Speaker 5`, never a colon and
   * never a trailing space. The three consumers punctuate differently —
   * `Amira:` in plain text, `Amira: ` in SRT, a separate element in the DOM —
   * so pushing the wording in here would force each of them to unpick it
   * again. This is the same reasoning `speakerLabelFor` gives for returning a
   * number rather than a string.
   *
   * IT TRIMS NOTHING, AND THAT IS A DECISION. `setSpeakerName` owns the trim
   * rule and guarantees the map holds trimmed, non-empty strings or no entry at
   * all. The one route that could put an untrimmed name into the map is
   * `deserialise`, which accepts a stored map wholesale; nothing writes a
   * serialised object anywhere yet, so the case is unreachable today, and
   * sanitising on restore is that function's decision to take. TWO TRIMS IN TWO
   * FILES WOULD BE TWO RULES, and the second one to change would lose.
   *
   * `undefined` AND `null` FALL THROUGH TO "Speaker undefined" AND
   * "Speaker null", AND THOSE ARE REQUIREMENTS RATHER THAN OVERSIGHTS — this is
   * the part most likely to be "fixed" by a later reader being helpful.
   * `speakerLabelFor` above deliberately does not guard `undefined`, so a
   * phrase with no `speaker` key makes both formatters emit "Speaker
   * undefined:" today. That is HEAD's shipped behaviour and the downloaded .txt
   * and .srt are byte-identical to what they have always been. UNIT 5 HAS NOW
   * ROUTED BOTH FORMATTERS THROUGH THIS FUNCTION — the warning is therefore
   * LIVE rather than anticipated, and a guard added here WOULD change those
   * bytes today. The shape is refused at the DOM renderer in the -ui file
   * instead, where refusing it costs nothing.
   *
   * NO LOGGING. It is pure and it is hot — unit 5 calls it once per phrase,
   * which is 657 calls per download on the committed fixture. `speakerLabelFor`
   * has none for the same reason.
   *
   * THE CAPTION LANE SHOULD ADOPT THIS AT ITS STAGE 12. `fromTranscribeResult`
   * in `captions-fixer/captions-fixer-cues.js` composes `Speaker N: ` from its
   * own local constants, and its header claims the adapter reaches the same
   * resolver so the two cannot drift — a claim that goes false for any NAMED
   * transcript the moment unit 5 lands. RECORDED, NOT FIXED: it is the other
   * lane's file and this project does not edit it.
   *
   * @param {object} args
   * @param {number|null|undefined} args.speaker - the slot to name
   * @param {Object<string, string>} [args.names={}] - the names map, keyed by
   *   speaker number. Object keys are strings either way, so `{ 5: "Amira" }`
   *   and `{ "5": "Amira" }` are the same map.
   * @returns {string} the display stem, unpunctuated
   */
  function speakerDisplayName({ speaker, names = {} }) {
    const name = names ? names[speaker] : undefined;
    if (typeof name === "string" && name !== "") return name;
    return `${SPEAKER_NAME_PREFIX}${speaker}`;
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

  // ==========================================================================
  // REGISTER ITEM 47 — REVIEW SURFACE (pure, no DOM, no announcements)
  // ==========================================================================

  /**
   * MIRRORED, NEVER IMPORTED, from `SPEAKER_LABEL_PREFIX` and
   * `SPEAKER_LABEL_SUFFIX` in captions-fixer/captions-fixer-cues.js
   * (`fromTranscribeResult`), the same convention that file's own header
   * already uses in the other direction for `toSrtTimestamp`. This is a
   * cross-lane coupling, recorded as owed in the register item 47 design
   * document's § 3 and § 10.
   *
   * TRANSITIONAL. Owed item (b) of the Captions Fixer lane's seam row at
   * `dd15a4d` commits that lane to stopping `fromTranscribeResult` inlining
   * this prefix at its Stage 12, passing `speaker` as a structured field and
   * adopting `speakerDisplayName` instead. When that lands, `entry.original`
   * stops carrying this prefix for change sets produced afterwards and rule 1
   * of `suggestionTextFor` below becomes the only path a fresh change set
   * ever takes — rule 2 stays correct for any change set produced before the
   * hand-off, so it is not removed, only no longer reached by new input.
   *
   * GROUNDED 15 September 2026 against `captions-fixer-cues.js` at HEAD:
   * `fromTranscribeResult` calls `speakerLabelFor` with no `mode` argument, so
   * the default `SPEAKER_LABEL_MODE.EVERY_LINE` applies and the label is
   * inlined on EVERY phrase whose resolved speaker is non-null — not only on
   * the opening line of a speaker run, which is how the register item 47
   * design document's § 3 introduces the phenomenon. That framing is
   * corrected here rather than in the design document, which is committed
   * unaltered by this project's own convention (see register item 115,
   * finding (3)). It does not change the rule below: `suggestionTextFor`
   * takes the row's already-resolved `speakerLabel` as an argument and knows
   * nothing about runs either way.
   */
  const SUGGESTION_SPEAKER_LABEL_PREFIX = "Speaker ";
  const SUGGESTION_SPEAKER_LABEL_SUFFIX = ": ";

  /**
   * Resolve the text a row should render for a proposed suggestion, and the
   * prefix it had to strip to get there.
   *
   * PURE. No DOM, no announcement, no knowledge of display options — a caller
   * decides what a person sees and hears, this function only decides what the
   * suggestion resolves to. Never throws; every failure is a refused result
   * with a machine-readable `reason` token, matching `validateFile`'s shape
   * above. `reason` is a TOKEN, not a sentence: the design document's § 3
   * quotes human wording for two of these, but composing a sentence is
   * display and belongs to the caller that renders one, in a later unit.
   *
   * Three rules, in order:
   *
   *   1. `original === currentText` — the bare-text world and the
   *      post-hand-off world both. Prefix is "", text is `proposed` as sent.
   *   2. Otherwise, compose the expected prefix from `speakerLabel`, mirroring
   *      `fromTranscribeResult`'s own composition above. If the composed
   *      prefix is non-empty and `original` equals it followed by
   *      `currentText` EXACTLY — never a suffix test, which would fire on any
   *      phrase whose current text happens to end a longer original — then:
   *      `proposed` carrying the same prefix resolves to `proposed` with the
   *      prefix removed; `proposed` not carrying it refuses `label-changed`.
   *   3. Otherwise, where `sourceSpeaker` is an integer DIFFERENT from
   *      `speakerLabel`, compose the prefix from it instead and apply the
   *      same exact test: a match means the row's SPEAKER was changed after
   *      the change set was produced while its WORDS were not, and refuses
   *      `speaker-changed`. Added at design § 12's D5.
   *   4. Anything else refuses `stale-base` — including a row whose speaker
   *      was reassigned AND whose words also changed, which is the intended
   *      outcome and not a defect: the expected prefix no longer matches, so
   *      the row is honestly stale rather than silently wrong.
   *
   * RULE 3's ACCOUNT OF WHAT RULE 4 USED TO COVER IS WITHDRAWN AND QUOTED, per
   * register items 51 and 56. Rule 3 formerly read: "Anything else refuses
   * `stale-base` — including a row whose speaker was reassigned after the
   * change set was produced". That is now true only of a row whose words
   * ALSO changed. The refusal was never wrong; the single token was, because
   * the caller's sentence for `stale-base` says the line has changed, which
   * is false when only the speaker moved.
   *
   * `sourceSpeaker` IS OPTIONAL AND ITS ABSENCE IS NOT `bad-input`. A caller
   * that does not pass it simply never reaches rule 3 and gets the behaviour
   * this function had before D5 — which is what makes the argument additive
   * and lets the controller adopt it in its own commit.
   *
   * @param {object} args
   * @param {string} args.original - the change set entry's recorded original
   * @param {string} args.proposed - the change set entry's proposed text
   * @param {string} args.currentText - the phrase's current text, live
   * @param {number|null|undefined} args.speakerLabel - the row's resolved
   *   speaker number, or null/undefined when no label applies to this row
   * @param {number|null|undefined} [args.sourceSpeaker] - the phrase's
   *   speaker BEFORE any move, i.e. the number the adapter would have inlined
   *   when the change set was built. Optional; anything but an integer
   *   differing from `speakerLabel` disables rule 3 and nothing else.
   * @returns {{ok: true, prefix: string, text: string}|{ok: false, reason: "stale-base"|"label-changed"|"speaker-changed"|"bad-input"}}
   */
  function suggestionTextFor({
    original,
    proposed,
    currentText,
    speakerLabel,
    sourceSpeaker,
  }) {
    const labelIsUsable =
      speakerLabel === null ||
      speakerLabel === undefined ||
      Number.isInteger(speakerLabel);
    if (
      typeof original !== "string" ||
      typeof proposed !== "string" ||
      typeof currentText !== "string" ||
      !labelIsUsable
    ) {
      return { ok: false, reason: "bad-input" };
    }

    if (original === currentText) {
      return { ok: true, prefix: "", text: proposed };
    }

    const prefix =
      speakerLabel === null || speakerLabel === undefined
        ? ""
        : `${SUGGESTION_SPEAKER_LABEL_PREFIX}${speakerLabel}${SUGGESTION_SPEAKER_LABEL_SUFFIX}`;

    if (prefix !== "" && original === `${prefix}${currentText}`) {
      if (proposed.startsWith(prefix)) {
        return { ok: true, prefix, text: proposed.slice(prefix.length) };
      }
      return { ok: false, reason: "label-changed" };
    }

    // RULE 3, ADDED AT DESIGN § 12's D5. The row's speaker was changed AFTER
    // the change set was produced, and the WORDS are untouched.
    //
    // WHY IT NEEDS ITS OWN TOKEN. Before this rule such a row refused
    // `stale-base`, and the caller's sentence for `stale-base` says the line
    // has changed since the suggestion was made — which is FALSE when the
    // words are identical and only the speaker moved. The refusal was right
    // and the reason given for it was not, so the fix belongs here rather
    // than in the wording.
    //
    // THE MECHANISM IS THE ONE RULE 2 ALREADY USES, COMPOSED FROM THE OTHER
    // SPEAKER. `sourceSpeaker` is the phrase's speaker before any move, which
    // is the number the adapter would have inlined when it built the entry.
    // So compose the prefix from THAT and test the same exact equality rule 2
    // tests — never a suffix or a pattern match, for the reason rule 2's own
    // comment gives, and never the digits-only `SPEAKER_LABEL_PATTERN` the
    // other lane carries, which § 3 of the design refuses to copy.
    //
    // IT IS EXACT ABOUT THE WORDS AND SAYS NOTHING ELSE. A row whose speaker
    // moved AND whose words also changed does not match this test, falls
    // through, and refuses `stale-base` — correctly, because the sentence
    // about the line having changed is then true and is the more useful of
    // the two things that happened.
    //
    // `sourceSpeaker` EQUAL TO `speakerLabel` IS NOT A SPEAKER CHANGE, and is
    // excluded rather than left to rule 2: rule 2 has already tested that
    // exact prefix and failed, so re-testing it here would be a second
    // computation that cannot ever succeed.
    const sourceIsUsable =
      Number.isInteger(sourceSpeaker) && sourceSpeaker !== speakerLabel;
    if (sourceIsUsable) {
      const sourcePrefix = `${SUGGESTION_SPEAKER_LABEL_PREFIX}${sourceSpeaker}${SUGGESTION_SPEAKER_LABEL_SUFFIX}`;
      if (original === `${sourcePrefix}${currentText}`) {
        return { ok: false, reason: "speaker-changed" };
      }
    }

    return { ok: false, reason: "stale-base" };
  }

  /**
   * A ceiling on the WORD count of either side of a diff, above which
   * `diffSpansOrWhole` skips the comparison entirely rather than running an
   * O(m*n) longest-common-subsequence over a pathological input. Measured
   * against the 657-phrase fixture: the longest phrase is 514 characters and
   * the mean is 85, so 200 words is generous rather than tight — this is a
   * guard against a pathological input, not a value tuned against real data,
   * and it has its own harness row.
   */
  const MAX_DIFF_WORDS = 200;

  /**
   * `MAX_DIFF_SPANS` WAS HERE AND IS WITHDRAWN (design § 12's D7, heard at
   * listen row 52 part (h) on 21 September 2026). The withdrawn text is quoted
   * rather than deleted, per register items 51 and 56:
   *
   *   "A ceiling on the number of CHANGED spans (removed plus added, never
   *    the total) a rendered diff may carry before the caller falls back to
   *    one whole-phrase `<del>`/`<ins>` pair. THIS IS A GUESS, unmeasured —
   *    listen row 52 part (h) is what tests it, per the register item 47
   *    design document's § 5.
   *
   *    const MAX_DIFF_SPANS = 4;"
   *
   * IT WAS TESTED EXACTLY AS IT SAID IT WOULD BE, AND THE MEASURE WAS WRONG
   * RATHER THAN THE NUMBER. A span count says how many PLACES changed and
   * nothing about how much of the sentence SURVIVED, so five small
   * single-word replacements in a twenty-one-word sentence scored worse than
   * one replacement of half of it. The fixture's cueId 3 is that case: five
   * approved pairs, 10 changed spans, and 16 of its 21 words untouched. It
   * fell back to two whole-phrase readings of a sentence a reader could have
   * followed word by word.
   *
   * THIS IS A SUPERSESSION AND NOT A CORRECTION. The threshold was written
   * down as a guess with the part that would test it named in the same
   * sentence; it was tested and found wanting, which is the mechanism working.
   */

  /**
   * The share of the ORIGINAL's words that must survive unchanged in the
   * proposal for a word-level diff to be worth reading (design § 12's D7).
   * Below it, the caller falls back to one whole-phrase `<del>`/`<ins>` pair,
   * because a sentence that has mostly been rewritten reads better as two
   * clean readings than as a diff of a sentence that is no longer there.
   *
   * MEASURED AGAINST THE FIXTURE BEFORE IT WAS CHOSEN, which is what
   * distinguishes it from the span count it replaces. All eight entries of
   * the inlined change set, surviving words over original words:
   *
   *   cue 90  1.000   cue 2  0.971   cue 5  0.941   cue 109 0.929
   *   cue 30  0.923   cue 93 0.833   cue 3  0.762   cue 6   0.667
   *
   * So NO fixture entry falls back at one half, and cueId 3 — the case the
   * sitting judged — clears it by a wide margin at 0.762. A genuine rewrite,
   * which the fixture does not contain, still falls back and has its own
   * harness row built from a constructed input.
   *
   * THE PROPORTION IS PROVISIONAL and is heard again at session 2. It is a
   * named constant rather than a literal so that the sitting has one number
   * to move.
   *
   * WORDS, NOT SPANS OR CHARACTERS. `tokenize` already splits on exactly the
   * boundary the diff itself uses, so the ratio is computed over the same
   * units the spans are made of and cannot disagree with them.
   */
  const MIN_SURVIVING_WORD_RATIO = 0.5;

  /**
   * Split text into tokens that losslessly reconstruct it: each token is a
   * run of non-whitespace plus the whitespace immediately following it, so
   * `tokens.join("") === text` always. A leading whitespace-only run (no
   * preceding non-whitespace) is its own token, which is what keeps the
   * reconstruction exact even for text starting with a space.
   *
   * @param {string} text
   * @returns {string[]}
   */
  function tokenize(text) {
    return text.match(/\S+\s*|\s+/g) || [];
  }

  /**
   * Word-level diff of two strings, as one linear sequence of spans — never
   * two sequences, never nested. Longest common subsequence over tokens from
   * `tokenize`, so a single mis-heard word reads as that word alone rather
   * than the whole phrase twice.
   *
   * PURE, and it applies no threshold of its own: `diffSpansOrWhole` decides
   * when the result is too shredded to render, which keeps that policy out
   * of this function's semantics.
   *
   * LOSSLESS BY CONSTRUCTION: joining every span whose type is not "added"
   * reproduces `original` exactly, and joining every span whose type is not
   * "removed" reproduces `proposed` exactly — both are harness rows, because
   * `tokenize` carries trailing whitespace precisely so this holds.
   *
   * DETERMINISTIC: the same inputs always produce the same sequence, and a
   * tie in the backtrack (a token could equally be read as removed-then-added
   * or added-then-removed) is always resolved as removed before added.
   *
   * @param {string} original
   * @param {string} proposed
   * @returns {Array<{type: "same"|"removed"|"added", text: string}>}
   */
  function diffSpans(original, proposed) {
    const a = tokenize(original);
    const b = tokenize(proposed);
    const m = a.length;
    const n = b.length;

    // Longest-common-subsequence length table, filled from the bottom-right
    // corner so the backtrack below can walk forward from (0, 0).
    const table = [];
    for (let i = 0; i <= m; i += 1) table.push(new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i -= 1) {
      for (let j = n - 1; j >= 0; j -= 1) {
        table[i][j] =
          a[i] === b[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }

    const spans = [];
    const push = (type, text) => {
      const last = spans[spans.length - 1];
      // Adjacent spans of the same type are merged as they are produced, so
      // the sequence handed back is always minimal.
      if (last && last.type === type) {
        last.text += text;
      } else {
        spans.push({ type, text });
      }
    };

    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        push("same", a[i]);
        i += 1;
        j += 1;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        // Tie broken towards "removed" first, which is what makes the
        // ordering deterministic rather than an artefact of table layout.
        push("removed", a[i]);
        i += 1;
      } else {
        push("added", b[j]);
        j += 1;
      }
    }
    while (i < m) {
      push("removed", a[i]);
      i += 1;
    }
    while (j < n) {
      push("added", b[j]);
      j += 1;
    }

    return spans;
  }

  /**
   * `diffSpans`, guarded: skips the comparison for a pathological input
   * (either side over `MAX_DIFF_WORDS`) or for a sentence that has mostly
   * been rewritten (fewer than `MIN_SURVIVING_WORD_RATIO` of the original's
   * words surviving unchanged), and reports whether it fell back so the
   * harness can test the diff and the fallback independently.
   *
   * THE SECOND GUARD'S MEASURE CHANGED AT DESIGN § 12's D7. It was a count of
   * CHANGED SPANS against `MAX_DIFF_SPANS`; it is now a proportion of
   * SURVIVING WORDS. See the withdrawn `MAX_DIFF_SPANS` block above for why —
   * in one line, a span count says how many places changed and nothing about
   * how much of the sentence is still there.
   *
   * A fallback is always the whole-phrase pair — one "removed" span carrying
   * `original`, one "added" span carrying `proposed` — which is what a
   * caller renders as one `<del>` and one `<ins>` when a diff of a sentence
   * that is no longer there would read worse than two clean readings.
   *
   * @param {string} original
   * @param {string} proposed
   * @returns {{spans: Array<{type: "same"|"removed"|"added", text: string}>, fellBack: boolean}}
   */
  function diffSpansOrWhole(original, proposed) {
    const wholePhraseFallback = () => ({
      spans: [
        { type: "removed", text: original },
        { type: "added", text: proposed },
      ],
      fellBack: true,
    });

    if (typeof original !== "string" || typeof proposed !== "string") {
      return wholePhraseFallback();
    }
    if (
      tokenize(original).length > MAX_DIFF_WORDS ||
      tokenize(proposed).length > MAX_DIFF_WORDS
    ) {
      return wholePhraseFallback();
    }

    const spans = diffSpans(original, proposed);

    // THE ORIGINAL'S OWN WORD COUNT IS THE DENOMINATOR, never the proposal's
    // and never the union. The question D7 asks is how much of the sentence a
    // person already read is still there — so a proposal that adds twenty
    // words to a sentence it otherwise leaves alone is NOT a rewrite, and a
    // denominator counting the proposal would call it one.
    const originalWords = tokenize(original).length;

    // AN EMPTY ORIGINAL CANNOT BE REWRITTEN, so it never falls back on this
    // test. Guarded explicitly rather than left to produce NaN, which would
    // compare false against the threshold and reach the same answer by
    // accident — the distinction matters because a later change to the
    // comparison's direction would silently invert an accident.
    if (originalWords > 0) {
      const surviving = spans
        .filter((span) => span.type === "same")
        .reduce((total, span) => total + tokenize(span.text).length, 0);
      if (surviving / originalWords < MIN_SURVIVING_WORD_RATIO) {
        return wholePhraseFallback();
      }
    }

    return { spans, fellBack: false };
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
   *
   * `names` IS OPTIONAL AND DEFAULTS TO AN EMPTY MAP, so every existing call
   * site is unaffected and the downloaded bytes are unchanged. With no names
   * `speakerDisplayName` returns the `Speaker N` stem, which is character for
   * character what the inline literal here emitted before unit 5 routed this
   * through it — that byte-identity is the unit's own gate, not a nicety.
   *
   * @param {object} result - a normalised result
   * @param {{speakers?: boolean, timestamps?: boolean,
   *          names?: Object<string, string>}} [options]
   * @returns {string}
   */
  function toPlainText(
    result,
    { speakers = true, timestamps = true, names = {} } = {},
  ) {
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
        // COMPOSED INSIDE THE `label !== null` BRANCH, NEVER BEFORE IT.
        // speakerLabelFor decides WHETHER a label prints and naming sits
        // DOWNSTREAM of that decision — its signature is load-bearing across
        // the lane boundary, so nothing here may reach into it. The colon is
        // this caller's own punctuation: speakerDisplayName returns none.
        if (label !== null) {
          parts.push(`${speakerDisplayName({ speaker: label, names })}:`);
        }
        parts.push(phrase.text);
        return parts.join(" ").trim();
      })
      .join("\n");
  }

  /**
   * Render SubRip subtitles. Pure — no DOM, no side effects.
   *
   * IT TAKES AN OPTIONS OBJECT AS OF UNIT 5, AND IT TOOK NONE BEFORE. The
   * withdrawn doc comment read, in full:
   *
   *   "Render SubRip subtitles. Pure — no DOM, no side effects.
   *    @param {object} result - a normalised result
   *    @returns {string}"
   *
   * THE DEFAULT ON THE WHOLE PARAMETER IS WHAT KEEPS EVERY EXISTING CALLER
   * WORKING. `toSrt(result)` is the only form anywhere in the tree — three
   * call sites in the caption lane's test files, one in its model harness and
   * one in `make-capture-srt.mjs`, all read on 12 September 2026 — and
   * `{ names = {} } = {}` makes every one of them byte-identical to before.
   * A bare `{ names = {} }` without the outer default would throw on all five.
   *
   * STILL PURE. The options object is read and never written, and nothing here
   * touches the DOM or any module state.
   *
   * @param {object} result - a normalised result
   * @param {{names?: Object<string, string>}} [options]
   * @returns {string}
   */
  function toSrt(result, { names = {} } = {}) {
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
        // Composed INSIDE the `speaker !== null` test and never before it, for
        // the reason toPlainText's note above gives. The colon AND the trailing
        // space are this caller's own punctuation — speakerDisplayName returns
        // neither, which is why the two formatters can differ here at all.
        const label =
          speaker !== null
            ? `${speakerDisplayName({ speaker, names })}: `
            : "";
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
    // What a speaker is CALLED, once speakerLabelFor has decided a label prints
    // at all. Exported for the picker and the renderer in the -ui file, and for
    // the two formatters below, which unit 5 routes through it. Adding an
    // export cannot break the caption lane's guard, which tests three named
    // functions for existence.
    speakerDisplayName: speakerDisplayName,
    SPEAKER_LABEL_MODE: SPEAKER_LABEL_MODE,
    SPEAKER_NAME_PREFIX: SPEAKER_NAME_PREFIX,
    MEASURED_MAX_BYTES: MEASURED_MAX_BYTES,
    // Register item 47, unit 2. Pure review-surface helpers, no DOM, no
    // announcements — see the section comment above previousSpeakerAt.
    suggestionTextFor: suggestionTextFor,
    diffSpans: diffSpans,
    diffSpansOrWhole: diffSpansOrWhole,
    // MAX_DIFF_SPANS WAS EXPORTED HERE AND IS WITHDRAWN (design § 12 D7).
    // See the withdrawn constant block above. MIN_SURVIVING_WORD_RATIO takes
    // its place on the export list so the harness can read the threshold
    // rather than typing a second copy of it.
    MIN_SURVIVING_WORD_RATIO: MIN_SURVIVING_WORD_RATIO,
    MAX_DIFF_WORDS: MAX_DIFF_WORDS,
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
