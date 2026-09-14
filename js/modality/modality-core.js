/**
 * js/modality/modality-core.js
 *
 * ONE implementation of "what can this model take in and give out, and what did
 * this response actually carry?".
 *
 * WHY IT IS A SEPARATE PLAIN SCRIPT. The two consumers are in different module
 * styles: js/openrouter-client/ is ES modules and openrouter-embed/ is IIFEs on
 * window. A plain script published on window is reachable from both, because
 * deferred ES modules always run after plain scripts. This is exactly the
 * js/pricing-display.js precedent and the reasoning is the same — a copy per
 * consumer is two chances for the answer to drift apart.
 *
 * NOTHING HERE DOES I/O OR TOUCHES THE DOM. That is what lets the whole surface
 * be proved in Node against recorded wire fixtures at zero spend, which is the
 * point: the fixtures cost real money to capture and must never need recapturing
 * to run a test.
 *
 * ============================================================================
 * THE THREE FACTS THAT SHAPE EVERY FUNCTION BELOW, ALL MEASURED 10 SEPTEMBER
 * 2026 ON REAL WIRE CAPTURES IN .claude/modality/fixtures/.
 * ============================================================================
 *
 * 1. AN IMAGE RESPONSE CARRIES `message.content: null` AND `message.images[]`.
 *    js/request-manager/request-manager-response.js:113-140 narrows a choice to
 *    a string through an if/else chain whose final fallback is
 *    JSON.stringify(choice, null, 2). Replayed against the real capture that
 *    renders 880,993 CHARACTERS of base64 into the results pane, after the user
 *    has been billed for it. `normaliseMessage` exists so a caller can ask for
 *    `.text` and get "" rather than a wall.
 *
 * 2. AN AUDIO CHUNK CARRIES `delta.content: ""` ALONGSIDE `delta.audio`.
 *    Fifteen of seventeen chunks in the audio-out capture carry BOTH keys, and
 *    the content is the EMPTY STRING every time. Because the shipped chain
 *    tests `if (choice.delta?.content)`, an empty string is falsy, so the chunk
 *    falls through every arm and the audio is dropped in silence. The failure
 *    mode is therefore the OPPOSITE of the image one — nothing appears at all
 *    rather than too much. Any fold here must distinguish "absent" from "empty".
 *
 * 3. `.text` MUST ALWAYS BE A STRING. openrouter-embed-core.js:1810-1817 throws
 *    on `typeof rawText !== "string"`, and handleStreamChunk does
 *    `streamBuffer += chunk` at :1997, which corrupts the buffer silently on a
 *    non-string. Every structured result below therefore keeps `.text` a string,
 *    "" at worst, never null and never an object. This is what keeps the change
 *    additive: an existing caller takes `.text` and behaves exactly as now.
 *
 * Publishes window.ModalityCore. No dependencies; loads before its consumers.
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // ── Vocabulary ──────────────────────────────────────────────────────────
  //
  // The four modality names OpenRouter's architecture block uses, frozen so a
  // typo cannot silently become a fifth. Measured across the live catalogue on
  // 10 September 2026: output_modalities is one of ["text"], ["image","text"]
  // or ["audio","text"] and nothing else, over 437 models.
  const MODALITY = Object.freeze({
    TEXT: "text",
    IMAGE: "image",
    AUDIO: "audio",
    FILE: "file",
    VIDEO: "video",
  });

  // Where a registration records what the model can do. Captured at registration
  // by .claude/model-add/ from architecture.input_modalities / output_modalities,
  // NOT derived from `capabilities`.
  //
  // WHY NOT `capabilities`: it is unvalidated free text. Measured over all 478
  // registrations — 298 distinct strings, 200 used exactly once, ten spellings of
  // tool-calling and twenty modality-ish strings ("vision" 174, "image" 8,
  // "audio" 5, "image_generation" 1, "speech" 1), NONE of which distinguishes an
  // input from an output. A model that reads images and one that draws them both
  // say "vision".
  //
  // WHY THE KEY IS NESTED UNDER metadata: two registrations already carry a
  // hand-written TOP-LEVEL `modalities:` array — google/gemini-3.5-flash and
  // qwen/qwen3.7-flash — mixing inputs and outputs in one list, which is the
  // same free-text disease already spread to this very name. Nesting under
  // metadata, beside the pricing provenance fields, avoids the collision.
  const METADATA_KEY = "modalities";

  // ── modalityOf ──────────────────────────────────────────────────────────
  /**
   * What a model takes in and gives out, as recorded at registration.
   *
   * FAILS OPEN, DELIBERATELY. An entry with no recorded modalities returns
   * text-in/text-out rather than empty arrays, because every consumer of this
   * treats "outputs" as the set it must be able to render, and an empty set
   * would make an ordinary unmigrated text model look unrenderable. The
   * registry is 478 entries deep and this field is new; the common case for a
   * long while will be "not recorded yet", and that case must behave exactly as
   * the app does today.
   *
   * @param {Object} modelMeta - a registry entry, or its metadata block
   * @returns {{inputs: string[], outputs: string[], recorded: boolean}}
   */
  function modalityOf(modelMeta) {
    const fallback = {
      inputs: [MODALITY.TEXT],
      outputs: [MODALITY.TEXT],
      recorded: false,
    };
    if (!modelMeta || typeof modelMeta !== "object") return fallback;

    // Accept either a whole entry or the metadata block itself, because callers
    // hold one or the other depending on which registry surface they came from.
    const block =
      modelMeta[METADATA_KEY] ||
      (modelMeta.metadata && modelMeta.metadata[METADATA_KEY]);
    if (!block || typeof block !== "object") return fallback;

    const inputs = Array.isArray(block.inputs) ? block.inputs.slice() : null;
    const outputs = Array.isArray(block.outputs) ? block.outputs.slice() : null;
    if (!inputs || !outputs || !inputs.length || !outputs.length) {
      logDebug("modalityOf: partial record, failing open to text/text");
      return fallback;
    }

    return { inputs, outputs, recorded: true };
  }

  /** Convenience predicates. Each answers one question and nothing else. */
  function canOutput(modelMeta, modality) {
    return modalityOf(modelMeta).outputs.indexOf(modality) !== -1;
  }
  function canAccept(modelMeta, modality) {
    return modalityOf(modelMeta).inputs.indexOf(modality) !== -1;
  }
  /**
   * True when the model cannot produce plain text at all.
   *
   * Measured 10 September 2026: NO registered model is in this state — all 13
   * non-text-output models emit text ALONGSIDE image or audio, so every one of
   * them degrades to a working text reply rather than to nothing. The predicate
   * exists because the catalogue is not ours and that could change; it must not
   * be read as describing anything registered today.
   */
  function isTextIncapable(modelMeta) {
    return !canOutput(modelMeta, MODALITY.TEXT);
  }

  // ── modalityWarnings ────────────────────────────────────────────────────
  /**
   * Why a request should be refused BEFORE it is sent, as warning objects in
   * the shape openrouter-client-validator.js's `parameterWarnings` channel
   * already carries. The decision lives here, pure, so it can be proved in
   * Node; the plumbing lives in the validator.
   *
   * TWO CONDITIONS, AND BOTH ARE ABOUT PAYING FOR A REPLY NOBODY CAN USE:
   *
   *   1. asking for an output the model cannot produce — billed for a text
   *      reply and the image never arrives;
   *   2. an ORDINARY text request to a model whose only output is non-text —
   *      billed, and nothing renderable comes back at all.
   *
   * AN UNRECORDED MODEL IS NEVER REFUSED, AND THAT IS THE WHOLE CARE OF THIS
   * FUNCTION. modalityOf FAILS OPEN to text/text for an entry carrying no
   * metadata.modalities block, and measured 11 September 2026 that is ALL 478
   * registrations — the key is written by .claude/model-add/ at registration
   * and no entry has been re-registered through it yet. A predicate refusing
   * on the failed-open value would therefore refuse every image request in the
   * catalogue, which is why the `recorded` flag is tested rather than the
   * outputs list. Absence means UNMEASURED, not text-only.
   *
   * @param {Object} modelMeta - registry entry for the target model
   * @param {Object} [options] - { wantImage, wantAudio, modelName }
   * @returns {Array<{parameter: string, message: string, value: *}>}
   */
  function modalityWarnings(modelMeta, options) {
    const opts = options || {};
    const warnings = [];
    const recorded = modalityOf(modelMeta);
    if (!recorded.recorded) return warnings;

    const name =
      opts.modelName || (modelMeta && modelMeta.name) || "this model";
    const wantImage = opts.wantImage === true;
    const wantAudio = opts.wantAudio === true;

    if (wantImage && recorded.outputs.indexOf(MODALITY.IMAGE) === -1) {
      warnings.push({
        parameter: METADATA_KEY,
        value: MODALITY.IMAGE,
        message: `${name} cannot produce image output, so the image was not requested`,
      });
    }
    if (wantAudio && recorded.outputs.indexOf(MODALITY.AUDIO) === -1) {
      warnings.push({
        parameter: METADATA_KEY,
        value: MODALITY.AUDIO,
        message: `${name} cannot produce audio output, so the audio was not requested`,
      });
    }

    // The second condition is about an ordinary request, so it is asked only
    // when nothing non-text was asked for. A model that cannot emit text and
    // was asked for an image it CAN emit is working exactly as intended.
    if (!wantImage && !wantAudio && isTextIncapable(modelMeta)) {
      warnings.push({
        parameter: METADATA_KEY,
        value: MODALITY.TEXT,
        message: `${name} cannot produce text output — its only output is ${recorded.outputs.join(", ")}`,
      });
    }

    return warnings;
  }

  // ── requestAdditions ────────────────────────────────────────────────────
  //
  // Formats OpenAI accepts for streamed audio output. Measured, not read from
  // documentation: `wav` is refused with 400 "'audio.format' does not support
  // 'wav' when stream=true. Supported values are: 'pcm16'."
  const STREAMING_AUDIO_FORMAT = "pcm16";

  // ── THE DEFAULT VOICE, CHOSEN BY EAR ────────────────────────────────────
  //
  // `ballad` since 13 September 2026, and it was `alloy` before that — which was
  // the provider's first name in its own refusal list and therefore an arbitrary
  // default dressed as a considered one.
  //
  // THE OWNER CHOSE IT, AND NO MEASUREMENT SUPPORTS OR CONTRADICTS HIM. Parcel
  // 1-voice-catalogue generated a panel of thirteen voices over one script, plus
  // a fourteenth cell repeating one voice as a WITHIN-voice control, and asked
  // him a single question: which one should read a document aloud. He answered
  // `ballad`, from the second take. Nothing in this file can check that: duration,
  // peak, RMS and the tail verdict are the same four numbers for a distinctive
  // voice and a dull one, and the only instrument that can tell them apart is a
  // person. A default recorded with no reason is indistinguishable from an
  // arbitrary one and the next reader will change it back, which is why this
  // block exists rather than a bare literal.
  //
  // AND THE WITHIN-VOICE CONTROL IS WHY A PANEL NEEDED ONE. The same voice on an
  // identical request measured 16.95s and then 25.00s, so this model's own output
  // varies more between identical calls than two voices differed from each other.
  // Read any future voice comparison against a repeated cell, never against the
  // other voices alone.
  //
  // BALLAD'S FIRST TAKE IGNORED THE SCRIPT ENTIRELY — it asked whether it should
  // begin, rather than beginning — and this choice rests on the RETAKE. That is
  // n=1, and three other voices in the same panel added preambles of their own, so
  // it is NOT established as a property of this voice. It is recorded here so that
  // an off-script ballad reply is met with a known observation rather than a fresh
  // investigation.
  //
  // THE AUDIO ITSELF IS NOT COMMITTED, deliberately. Regenerate the panel with
  // `node .claude/modality/capability-send.mjs --capability audio-out --voices …`,
  // which is a BILLABLE send and needs its own authority.
  const DEFAULT_AUDIO_VOICE = "ballad";

  // ── THE VOICE CATALOGUE, TAKEN FROM THE PROVIDER'S OWN REFUSAL ──────────
  //
  // MEASURED THE SAME WAY STREAMING_AUDIO_FORMAT WAS, 13 September 2026, and
  // for the same reason: a 400 generates no tokens, so a deliberately-invalid
  // request is the cheapest true answer available. Sending
  // `audio.voice: "definitely-not-a-real-voice-xyzzy"` is refused with
  //
  //   "Invalid value: 'def...zzy'. Supported values are: 'alloy', 'echo',
  //    'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse', 'ballad', 'ash',
  //    'sage', 'marin', and 'cedar'."   param: audio.voice
  //
  // THIS LIST IS THE PROVIDER'S, NOT DOCUMENTATION'S, and that distinction is
  // the whole point of recording it. The public catalogue's `supported_voices`
  // field reads `null` for this model, so nothing free and unauthenticated
  // enumerates them; the refusal does. Reproduce it with
  // `node .claude/modality/audio-probe.mjs --refusals`.
  //
  // MEASURED ON BOTH OpenAI AUDIO MODELS, 13 September 2026, and they AGREE.
  // Until parcel 1-voice-catalogue this array was one model's refusal and nothing
  // established that the sibling enumerated the same list — the public
  // catalogue's `supported_voices` reads `null` for BOTH ids, so nothing free
  // could arbitrate it. `openai/gpt-audio` was sent the same impossible-voice
  // probe and its 400 came back BYTE-IDENTICAL to the mini's: the same thirteen
  // names, in the same order, in the same sentence. So the single frozen array is
  // correct for both and the catalogue does NOT need to be per-model.
  //
  // TWO MODELS IS NOT EVERY MODEL. The registry holds four audio-output
  // registrations; the other two are Google's Lyria pair, which are MUSIC models
  // with no voice concept at all and were deliberately not called (they are
  // billed per song). If a third SPEECH model is ever registered, probe it rather
  // than assuming this list — and if it disagrees, this becomes per-model and the
  // lists must NOT be merged into a superset, which would offer a caller a voice
  // their chosen model refuses.
  //
  // IT IS FOR TELLING A HUMAN WHAT TO TRY, AND NOTHING VALIDATES AGAINST IT.
  // A client-side allowlist built from this would silently refuse a voice the
  // provider added the week after it was captured, and the provider already
  // refuses an unknown one with a better message than we could write. So this
  // is a catalogue, not a gate — and it carries a capture date because a
  // catalogue without one is indistinguishable from a promise.
  const MEASURED_AUDIO_VOICES = Object.freeze([
    "alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral",
    "verse", "ballad", "ash", "sage", "marin", "cedar",
  ]);
  const MEASURED_AUDIO_VOICES_CAPTURED = "2026-09-13";

  /**
   * The body fragment a modality request needs. A FRAGMENT ONLY — this never
   * builds or mutates a request, so it cannot fight with either client's own
   * builder.
   *
   * IDEMPOTENT ACROSS A DOUBLE BUILD, WHICH IS A HARD REQUIREMENT, NOT A NICETY.
   * openrouter-embed-core.js calls buildRequest at :1020 and streamRequest calls
   * it AGAIN with stream:true merged, so every field here is constructed twice
   * per streaming request. This function derives its output purely from its
   * arguments and holds no state, so merging the result twice is identical to
   * merging it once. That is the bug the max_tokens rename hit and the Responses
   * adapter had to re-avoid.
   *
   * RETURNS AN EMPTY OBJECT FOR AN ORDINARY TEXT REQUEST, so a caller can
   * unconditionally spread it and nothing changes for the 465 text models.
   *
   * @param {Object} modelMeta - registry entry for the target model
   * @param {Object} [options] - { wantImage, wantAudio, stream, voice }
   * @returns {{modalities?: string[], audio?: Object}}
   */
  function requestAdditions(modelMeta, options) {
    const opts = options || {};
    const additions = {};
    const wantImage = opts.wantImage === true;
    const wantAudio = opts.wantAudio === true;

    if (!wantImage && !wantAudio) return additions;

    const outputs = [MODALITY.TEXT];
    if (wantImage && canOutput(modelMeta, MODALITY.IMAGE)) {
      outputs.push(MODALITY.IMAGE);
    }
    if (wantAudio && canOutput(modelMeta, MODALITY.AUDIO)) {
      outputs.push(MODALITY.AUDIO);
    }

    // Nothing was actually addable — the model cannot do what was asked. Say
    // nothing rather than sending a modalities list the model will ignore; the
    // refusal belongs to the gate in the validator, not here.
    if (outputs.length === 1) return additions;

    additions.modalities = outputs;

    if (outputs.indexOf(MODALITY.AUDIO) !== -1) {
      additions.audio = {
        voice: opts.voice || DEFAULT_AUDIO_VOICE,
        format: STREAMING_AUDIO_FORMAT,
      };
    }

    return additions;
  }

  // ── audioContentPart ────────────────────────────────────────────────────
  /**
   * The canonical input_audio content part.
   *
   * BASE64 ONLY — there is no URL form for audio input, unlike image_url. The
   * part shape is architecturally identical to the image_url and file parts
   * minted in openrouter-embed-file.js.
   *
   * THAT FILE IS NOT THE SINGLE PLACE THIS VOCABULARY IS DEFINED, AND THIS
   * COMMENT SAID IT WAS. Corrected 11 September 2026 by counting: FIVE shipped
   * sites mint an image_url part across FOUR files — the embed, the main client
   * (js/request-manager/request-manager-parameters.js), chat
   * (chat/chat-attach.js), and the diagnostic panel twice
   * (openrouter-embed/openrouter-embed-diagnostic.js). A sixth sits in a
   * dev-gated harness. The duplication is REPORTED, not collapsed: a four-site
   * refactor of shipped IMAGE behaviour has no golden-file differential behind
   * it, and this programme's rule is that a change claiming "nothing moved"
   * needs a differential rather than rows written alongside it.
   *
   * Proved end to end on 10 September 2026: the audio-out capture's own speech,
   * wrapped in a RIFF header, was sent back through this shape and transcribed
   * correctly, with usage.prompt_tokens_details.audio_tokens = 25 confirming it
   * was processed as audio rather than ignored.
   *
   * @param {string} base64 - raw base64, NO data: prefix
   * @param {string} format - container format, e.g. "wav" or "mp3"
   * @returns {{type: string, input_audio: {data: string, format: string}}}
   */
  function audioContentPart(base64, format) {
    return {
      type: "input_audio",
      input_audio: { data: base64 || "", format: format || "wav" },
    };
  }

  // ── audioFormatFor ──────────────────────────────────────────────────────
  //
  // MIME TYPE IN, CONTAINER NAME OUT. `input_audio.format` takes "wav", NOT
  // the MIME type "audio/wav" a File carries in `.type`, so a caller holding a
  // File cannot pass `file.type` straight through. That is the second of the
  // two ways to get audio input wrong; the first is copying the image part's
  // `data:` URL, which audioContentPart's own comment covers.
  //
  // EXACTLY ONE PAIR BELOW IS MEASURED: audio/wav → "wav". It is proved end to
  // end by the 10 September capture, whose request carries format:"wav" and
  // whose usage reports prompt_tokens_details.audio_tokens = 25 — the positive
  // canary that the attachment was read as audio rather than dropped.
  //
  // EVERY OTHER PAIR IS DECLARED AND UNMEASURED, and that distinction must
  // survive contact with a green row. They are transcribed from the containers
  // OpenAI documents for input_audio, not tested, because testing one costs a
  // real send. A row proving audioFormatFor("audio/ogg") === "ogg" proves this
  // MAP says so and says NOTHING about whether the provider accepts it.
  const AUDIO_MIME_TO_FORMAT = Object.freeze({
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
  });

  /**
   * The container format for a MIME type, or null when there is none.
   *
   * REFUSES RATHER THAN DEFAULTING, DELIBERATELY. Browsers supply an empty
   * `file.type` for some files, and a silent default of "wav" would put a
   * mislabelled container on the wire — billing the user for a request the
   * provider rejects, with nothing in the code to say a guess had been made.
   * null forces the caller to decide, which is the right burden for a caller
   * that cannot name its own container.
   *
   * @param {string} mimeType - a File's `.type`, e.g. "audio/wav"
   * @returns {string|null} the container name, or null if unrecognised
   */
  function audioFormatFor(mimeType) {
    if (typeof mimeType !== "string" || !mimeType) return null;

    // Strip any codec parameter before matching. MediaRecorder hands back
    // "audio/webm;codecs=opus", which is not a key in the map and would
    // otherwise miss — a recorded file refused for the shape of its label.
    const bare = mimeType.split(";")[0].trim().toLowerCase();

    // hasOwnProperty, not a bare lookup: an inherited key such as "constructor"
    // is truthy on any object literal, so a bare lookup would hand back a
    // function where a container name belongs.
    if (!Object.prototype.hasOwnProperty.call(AUDIO_MIME_TO_FORMAT, bare)) {
      logDebug("audioFormatFor: no container format for MIME type", { mimeType });
      return null;
    }
    return AUDIO_MIME_TO_FORMAT[bare];
  }

  // ── pcm16ToWav ──────────────────────────────────────────────────────────
  //
  // THE STREAMED AUDIO REPLY IS NOT A FILE. `audio.format: "pcm16"` is the only
  // value streaming accepts — `wav` is refused with 400 "'audio.format' does not
  // support 'wav' when stream=true" — and pcm16 is headerless samples. Handing
  // those bytes to an <audio> element, or back to input_audio, produces nothing
  // playable and nothing a provider will read. The 44-byte RIFF/WAVE header
  // below is the entire difference between the two.
  //
  // IT LIVES IN THE SHARED MODULE, NOT IN THE HARNESS THAT FIRST NEEDED IT,
  // because the audio result has to become playable everywhere it is shown, and
  // a copy per surface is two chances for the sample rate to drift apart.
  //
  // ==========================================================================
  // THE SAMPLE RATE IS ASSERTED, NOT MEASURED, AND THAT MUST SURVIVE A GREEN ROW
  // ==========================================================================
  // A pcm16 stream carries no header, so NOTHING in any capture states its rate.
  // 24 kHz mono 16-bit is the figure OpenAI documents for its audio models, and
  // .claude/modality/fixtures/README.md § 3 already records the same caveat: the
  // 10 September capture was transcribed back correctly, which is CONSISTENT
  // with 24 kHz and does not prove it, because a modest rate error still yields
  // intelligible speech. A wrong rate here yields a valid file that plays at the
  // wrong pitch — the silent kind of inaccuracy. `sampleRate` is an option so a
  // caller who has measured one can pass it; the default is a declaration.
  //
  // CONFIRMED BY EAR 14 SEPTEMBER 2026, TO ±33% AND NO FURTHER. One generation
  // was wrapped three times from the IDENTICAL payload — 16000, 24000, 32000 —
  // and put to a listener blinded to A/B/C in randomised order, the key sealed
  // outside the tree and read only after the answer was recorded. The listener
  // picked the 24000 wrap, unprompted, on one question. Because the three share
  // their bytes exactly, the only thing that can differ between them is playback
  // rate, so the judgement can be about nothing else.
  //
  // WHAT THAT DOES AND DOES NOT BUY. It rules out a GROSS rate error, which is
  // the failure mode this comment was written for. It does NOT resolve the rate
  // any finer than the panel's own spacing — 24000 against 23000 was never put
  // to anyone — and it is one listener, one clip, one voice, one model. The
  // default remains a declaration; it is now a declaration with one measurement
  // standing behind it. Register item 95 carries the figures.
  //
  // ==========================================================================
  // NO Buffer, NO atob, NO DOM — AND THAT IS WHY THE BASE64 CODEC IS INLINE
  // ==========================================================================
  // This module is a plain browser script that must also run under Node in
  // prove-modality.mjs, so it may use neither environment's codec. The two
  // helpers below are ~20 lines and are proved against a paid capture rather
  // than against themselves: .claude/modality/fixtures/audio-in.meta.json
  // carries the exact wav that .claude/modality/capture-fixtures.mjs built from
  // the audio-out stream and SENT, and which came back correctly transcribed
  // with usage.prompt_tokens_details.audio_tokens = 25. A row asserting this
  // function reproduces those 160,060 base64 characters byte for byte is
  // therefore a statement about a container a provider really accepted, not
  // about two of our own implementations agreeing.
  //
  // THAT SECOND IMPLEMENTATION IS REPORTED, NOT COLLAPSED. `wrapPcm16AsWav` in
  // capture-fixtures.mjs is Node-only (it is built on Buffer) and is the one
  // that produced the committed fixture; re-pointing it at this function would
  // edit the provenance of a capture that cost real money and can never be
  // cheaply re-run. The golden row above binds them instead, which is the
  // stronger relationship: they are held identical by measurement rather than
  // by sharing code.
  const PCM16_SAMPLE_RATE = 24000;
  const PCM16_CHANNELS = 1;
  const PCM16_BITS_PER_SAMPLE = 16;
  const WAV_HEADER_BYTES = 44;
  const WAV_MIME_TYPE = "audio/wav";

  const B64_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Reverse lookup built once. A plain object is enough and keeps the module
  // free of any environment's own codec.
  const B64_INVERSE = (function () {
    const map = Object.create(null);
    for (let i = 0; i < B64_ALPHABET.length; i++) map[B64_ALPHABET[i]] = i;
    return map;
  })();

  /**
   * base64 -> Uint8Array, or null when the input is not well-formed base64.
   *
   * REFUSES RATHER THAN SALVAGING. A stray character means the accumulated
   * stream is not what we think it is, and a codec that quietly skips one
   * produces audio that is subtly wrong from that byte onwards — far worse to
   * diagnose than a refusal at the door.
   */
  function base64ToBytes(b64) {
    if (typeof b64 !== "string") return null;
    const clean = b64.replace(/=+$/, "");
    if (/[^A-Za-z0-9+/]/.test(clean)) return null;
    // 4 base64 characters carry 3 bytes; a remainder of 1 is impossible.
    const remainder = clean.length % 4;
    if (remainder === 1) return null;

    const byteLength = Math.floor((clean.length * 3) / 4);
    const out = new Uint8Array(byteLength);
    let o = 0;
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < clean.length; i++) {
      buffer = (buffer << 6) | B64_INVERSE[clean[i]];
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[o++] = (buffer >> bits) & 0xff;
      }
    }
    return out;
  }

  /** Uint8Array -> base64, padded. */
  function bytesToBase64(bytes) {
    let out = "";
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out +=
        B64_ALPHABET[(n >> 18) & 63] +
        B64_ALPHABET[(n >> 12) & 63] +
        B64_ALPHABET[(n >> 6) & 63] +
        B64_ALPHABET[n & 63];
    }
    const left = bytes.length - i;
    if (left === 1) {
      const n = bytes[i] << 16;
      out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63] + "==";
    } else if (left === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out +=
        B64_ALPHABET[(n >> 18) & 63] +
        B64_ALPHABET[(n >> 12) & 63] +
        B64_ALPHABET[(n >> 6) & 63] +
        "=";
    }
    return out;
  }

  /** Little-endian writers, so the header does not depend on the host's endianness. */
  function writeAscii(bytes, offset, text) {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  }
  function writeUint32LE(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
    bytes[offset + 3] = (value >> 24) & 0xff;
  }
  function writeUint16LE(bytes, offset, value) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
  }

  /**
   * Wrap raw little-endian 16-bit PCM in a RIFF/WAVE container.
   *
   * PURE. No DOM, no Blob, no URL.createObjectURL — a caller that wants an
   * object URL can make one from `base64`, and a caller that wants an <audio>
   * src can use `dataUrl` directly. Keeping the DOM out is what lets the whole
   * function be proved in Node against the recorded captures.
   *
   * @param {string} pcm16Base64 - accumulated `audio.data`, raw base64, no data: prefix
   * @param {Object} [options] - { sampleRate, channels }
   * @returns {{base64: string, dataUrl: string, mimeType: string, byteLength: number,
   *            sampleCount: number, durationSeconds: number, sampleRate: number,
   *            channels: number, bitsPerSample: number}|null} null when refused
   */
  function pcm16ToWav(pcm16Base64, options) {
    const opts = options || {};
    const sampleRate = Number(opts.sampleRate) > 0 ? Number(opts.sampleRate) : PCM16_SAMPLE_RATE;
    const channels = Number(opts.channels) > 0 ? Number(opts.channels) : PCM16_CHANNELS;

    const pcm = base64ToBytes(pcm16Base64);
    if (!pcm) {
      logWarn("pcm16ToWav: input is not well-formed base64 — refusing to build a container");
      return null;
    }
    if (!pcm.length) {
      logWarn("pcm16ToWav: no samples — refusing to build an empty container");
      return null;
    }
    // AN ODD BYTE COUNT IS NOT PCM16. Every sample is two bytes, so an odd total
    // means the payload is either truncated or was never pcm16 — and the wav
    // built from it would be malformed in a way only a player complains about,
    // long after the fact.
    if (pcm.length % 2 !== 0) {
      logWarn("pcm16ToWav: odd byte count — the payload is not whole 16-bit samples", {
        byteLength: pcm.length,
      });
      return null;
    }

    const blockAlign = (channels * PCM16_BITS_PER_SAMPLE) / 8;
    const byteRate = sampleRate * blockAlign;
    const out = new Uint8Array(WAV_HEADER_BYTES + pcm.length);

    writeAscii(out, 0, "RIFF");
    writeUint32LE(out, 4, WAV_HEADER_BYTES - 8 + pcm.length); // everything after this field
    writeAscii(out, 8, "WAVE");
    writeAscii(out, 12, "fmt ");
    writeUint32LE(out, 16, 16); // fmt chunk size for PCM
    writeUint16LE(out, 20, 1); // audio format 1 = PCM
    writeUint16LE(out, 22, channels);
    writeUint32LE(out, 24, sampleRate);
    writeUint32LE(out, 28, byteRate);
    writeUint16LE(out, 32, blockAlign);
    writeUint16LE(out, 34, PCM16_BITS_PER_SAMPLE);
    writeAscii(out, 36, "data");
    writeUint32LE(out, 40, pcm.length);
    out.set(pcm, WAV_HEADER_BYTES);

    const base64 = bytesToBase64(out);
    const sampleCount = pcm.length / blockAlign;
    return {
      base64: base64,
      dataUrl: "data:" + WAV_MIME_TYPE + ";base64," + base64,
      mimeType: WAV_MIME_TYPE,
      byteLength: out.length,
      sampleCount: sampleCount,
      durationSeconds: sampleCount / sampleRate,
      sampleRate: sampleRate,
      channels: channels,
      bitsPerSample: PCM16_BITS_PER_SAMPLE,
    };
  }

  // ── wavToSamples / analyseAudioSamples ──────────────────────────────────
  //
  // ==========================================================================
  // A VALID CONTAINER IS NOT SOUND, AND NOTHING HERE HAS EVER ASKED THE
  // DIFFERENCE
  // ==========================================================================
  // `pcm16ToWav` above returns a container. Every check this programme has ever
  // made about a generated audio reply — `audioRendered: true`, the element's
  // `readyState: 4`, `error: null`, a byte count, a duration — is satisfied
  // EXACTLY AS WELL by sixty thousand zero samples. Such a file is a perfectly
  // legal RIFF wav, plays for 2.5 seconds, raises no error and reports itself
  // ready. The owner pressing play hears nothing and has no way to tell that
  // from a player he cannot find.
  //
  // So these two functions answer the one question the container cannot:
  // `wavToSamples` recovers the samples, `analyseAudioSamples` says whether any
  // of them move.
  //
  // ==========================================================================
  // WHY HERE AND NOT IN THE HARNESS THAT NEEDED IT
  // ==========================================================================
  // The same argument `pcm16ToWav` makes twenty lines above, and it is the
  // reason that function is here too: the thing being analysed is produced
  // here, and a copy per surface is two chances for the definition of "silent"
  // to drift apart. It is also the only placement under which the analysis can
  // be proved IN NODE against the recorded capture at zero spend, which
  // .claude/modality/prove-modality.mjs does in its V family — that harness
  // loads this module and nothing else.
  //
  // NO DOM, NO AudioContext, NO Buffer. The browser's own decoder is a second
  // and genuinely independent reader, and the capability runner cross-checks
  // against it on the stage — but the arithmetic below must run in Node, so it
  // reads the bytes itself. The two agreeing is a measurement; the two sharing
  // code would not be.
  //
  // ==========================================================================
  // THE SILENCE FLOOR IS A DECLARATION. THE ZERO TEST IS NOT.
  // ==========================================================================
  // Two different claims, deliberately kept apart, because one is a fact about
  // the format and the other is a judgement:
  //
  //   SILENT      peak is below ONE int16 LSB (1/32768). For a payload that
  //               came from pcm16 that is EXACTLY "every sample is zero" —
  //               there is no smaller non-zero amplitude the format can carry.
  //               Nothing is chosen here.
  //
  //   NEAR-SILENT peak is below `nearSilentPeak`, default 0.001, which is
  //               −60 dBFS. THAT NUMBER IS A DECLARATION, not a measurement,
  //               in the same sense as PCM16_SAMPLE_RATE above: it is
  //               conventional, it is an option so a caller who has measured
  //               one can pass it, and a reading that lands near it should be
  //               reported with the figure rather than the label.
  //
  // Everything else — peak, RMS, the non-zero proportion — is arithmetic and
  // carries no judgement at all. Report the numbers; the verdict is a
  // convenience for a human reading a stage, not the evidence.
  const SILENT_PEAK = 1 / 32768;
  const DEFAULT_NEAR_SILENT_PEAK = 0.001;
  const INT16_FULL_SCALE = 32768;
  const PCM_FORMAT_TAG = 1;

  // ── THE TAIL CHECK: DECLARED NUMBERS, AND A MEASURED FALSE NEGATIVE ─────
  //
  // WHAT IT IS FOR. Everything above proves a clip CONTAINS sound. None of it
  // can tell whether the clip contains ALL of the sound, and on 13 September
  // 2026 the owner heard speech stop mid-word on a run whose every existing
  // figure read healthy — valid RIFF container, readyState 4, error null,
  // peak 0.6638, RMS 0.0940, 99.573% of samples non-zero, verdict `sound`.
  //
  // THE IDEA IS ONE LINE. Speech that was allowed to finish decays to silence;
  // speech that was cut off stops at SPEAKING level. So compare the level of
  // the final window against the level of the clip as a whole.
  //
  // TAIL_WINDOW_SECONDS AND DEFAULT_TAIL_QUIET_RATIO ARE DECLARATIONS, in the
  // same sense as DEFAULT_NEAR_SILENT_PEAK above: conventional, overridable by
  // a caller who has measured their own, and reported as figures so a reading
  // landing near the line can be judged rather than merely labelled. The ratio
  // is a factor of 8, about 18 dB down.
  //
  // THE FIGURES ARE MEASURED, not chosen to taste. Truncating the recorded
  // fixture's own 60,000 samples and re-measuring, 13 September 2026 —
  // overall RMS divided by final-100ms RMS:
  //
  //     whole clip   69.03   ends in silence      <- the negative control
  //     cut to 80%    2.59   ends at speaking
  //     cut to 60%    0.48   ends at speaking     <- the positive control
  //     cut to 40%    3.01   ends at speaking
  //
  // AND ITS FALSE NEGATIVE IS MEASURED TOO, rather than supposed. The SAME
  // fixture cut to 30% reads 67.29 — indistinguishable from the complete clip
  // — because that cut lands inside the natural pause after "Sure!". Cut to
  // 20% reads 8.51 and also passes.
  //
  // SO THE TWO VERDICTS ARE NOT EQUALLY STRONG, and the sentence this returns
  // says so in words rather than leaving a reader to infer it:
  //
  //   ENDS AT SPEAKING LEVEL is STRONG evidence the clip was cut off.
  //   ENDS IN SILENCE is WEAK evidence it was not. Every cut landing in a
  //   pause produces it, and so does a speaker who finished one sentence of
  //   the three they were going to say.
  //
  // THIS IS AN INDICATOR AND NOT PROOF. The proof is transcribing the audio
  // back and comparing it against the transcript the stream itself carried —
  // a different measurement, which costs money and is not done here. Writing
  // this up as proof would put a false certainty in the record, which is the
  // failure this programme has already paid for twice.
  const TAIL_WINDOW_SECONDS = 0.1;
  const DEFAULT_TAIL_QUIET_RATIO = 8;

  const AUDIO_VERDICT = Object.freeze({
    SOUND: "sound",
    NEAR_SILENT: "near-silent",
    SILENT: "silent",
  });

  const TAIL_VERDICT = Object.freeze({
    ENDS_IN_SILENCE: "ends-in-silence",
    ENDS_AT_SPEAKING_LEVEL: "ends-at-speaking-level",
    TOO_SHORT: "too-short-to-judge",
  });

  /** Array-like of numbers, from any realm. `instanceof` is NOT used: the Node
   *  proof hands this function a Buffer minted in the outer realm, where every
   *  cross-realm brand check fails and the refusal would look like a finding. */
  function isNumericArrayLike(v) {
    return !!v && typeof v === "object" && typeof v.length === "number";
  }

  function asciiAt(bytes, offset, length) {
    let s = "";
    for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i]);
    return s;
  }

  function uint32LE(bytes, o) {
    return (
      (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) +
      bytes[o + 3] * 0x1000000
    );
  }

  function uint16LE(bytes, o) {
    return bytes[o] | (bytes[o + 1] << 8);
  }

  function int16LE(bytes, o) {
    const v = bytes[o] | (bytes[o + 1] << 8);
    return v >= 0x8000 ? v - 0x10000 : v;
  }

  /**
   * A RIFF/WAVE byte array -> normalised samples, or null.
   *
   * IT WALKS THE CHUNKS RATHER THAN ASSUMING OUR OWN OFFSETS. `pcm16ToWav`
   * always puts `fmt ` at 12 and `data` at 36, so fixed offsets would work for
   * every file this module produces — and would silently misread any other wav
   * handed to it, which is precisely the case where a wrong answer matters.
   *
   * IT REFUSES ANYTHING THAT IS NOT 16-BIT PCM rather than guessing. An analyser
   * that reads 8-bit or float samples as int16 returns plausible numbers about a
   * file it did not understand, and a plausible number is the failure mode this
   * whole programme keeps paying for.
   *
   * @param {Uint8Array|Array<number>} bytes - a whole .wav file
   * @returns {{samples: Float32Array, sampleCount: number, sampleRate: number,
   *            channels: number, bitsPerSample: number}|null}
   */
  function wavToSamples(bytes) {
    if (!isNumericArrayLike(bytes) || bytes.length < WAV_HEADER_BYTES) {
      logWarn("wavToSamples: not a byte array long enough to hold a RIFF header");
      return null;
    }
    if (asciiAt(bytes, 0, 4) !== "RIFF" || asciiAt(bytes, 8, 4) !== "WAVE") {
      logWarn("wavToSamples: no RIFF/WAVE magic — refusing to read it as audio");
      return null;
    }

    let fmtOffset = -1;
    let dataOffset = -1;
    let dataSize = 0;
    let cursor = 12;
    while (cursor + 8 <= bytes.length) {
      const id = asciiAt(bytes, cursor, 4);
      const size = uint32LE(bytes, cursor + 4);
      const body = cursor + 8;
      if (id === "fmt ") fmtOffset = body;
      else if (id === "data") {
        dataOffset = body;
        // The declared size is trusted only as far as the file goes. A truncated
        // capture otherwise reads past the end as zeros — silence manufactured by
        // the reader, which is the one wrong answer this function must never give.
        dataSize = Math.min(size, bytes.length - body);
      }
      // Chunks are word-aligned; an odd size carries one pad byte.
      cursor = body + size + (size % 2);
    }

    if (fmtOffset === -1 || dataOffset === -1) {
      logWarn("wavToSamples: no fmt or data chunk", { fmtOffset, dataOffset });
      return null;
    }

    const format = uint16LE(bytes, fmtOffset);
    const channels = uint16LE(bytes, fmtOffset + 2);
    const sampleRate = uint32LE(bytes, fmtOffset + 4);
    const bitsPerSample = uint16LE(bytes, fmtOffset + 14);
    if (format !== PCM_FORMAT_TAG || bitsPerSample !== PCM16_BITS_PER_SAMPLE) {
      logWarn("wavToSamples: not 16-bit PCM — refusing rather than reading it as one", {
        format,
        bitsPerSample,
      });
      return null;
    }
    if (dataSize < 2) {
      logWarn("wavToSamples: the data chunk holds no whole sample", { dataSize });
      return null;
    }

    const total = Math.floor(dataSize / 2);
    const samples = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      samples[i] = int16LE(bytes, dataOffset + i * 2) / INT16_FULL_SCALE;
    }
    return {
      samples: samples,
      sampleCount: channels > 0 ? total / channels : total,
      sampleRate: sampleRate,
      channels: channels,
      bitsPerSample: bitsPerSample,
    };
  }

  /**
   * Peak, RMS and the non-zero proportion of normalised samples, with a verdict
   * and a sentence a human can read without interpreting any of it.
   *
   * THE SENTENCE IS PART OF THE CONTRACT, not decoration. The whole point of
   * this function is that somebody looking at a stage, or at a report, can tell
   * "it played and made a noise" from "it played and made none" — and a person
   * reading `peak: 0.000031` is being asked to do the analysis themselves.
   *
   * @param {Float32Array|Array<number>} samples - normalised, nominally -1..1
   * @param {{nearSilentPeak?: number}} [options]
   * @returns {{sampleCount:number, peak:number, rms:number, nonZeroSamples:number,
   *            nonZeroProportion:number, verdict:string, silent:boolean,
   *            nearSilent:boolean, sentence:string}|null}
   */
  function analyseAudioSamples(samples, options) {
    if (!isNumericArrayLike(samples) || samples.length === 0) {
      logWarn("analyseAudioSamples: no samples — refusing to report on nothing");
      return null;
    }
    const opts = options || {};
    const floor =
      Number(opts.nearSilentPeak) > 0
        ? Number(opts.nearSilentPeak)
        : DEFAULT_NEAR_SILENT_PEAK;

    const n = samples.length;
    let peak = 0;
    let sumSquares = 0;
    let nonZero = 0;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      if (s !== 0) nonZero++;
      const magnitude = s < 0 ? -s : s;
      if (magnitude > peak) peak = magnitude;
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / n);
    const proportion = nonZero / n;

    const silent = peak < SILENT_PEAK;
    const nearSilent = !silent && peak < floor;
    const verdict = silent
      ? AUDIO_VERDICT.SILENT
      : nearSilent
        ? AUDIO_VERDICT.NEAR_SILENT
        : AUDIO_VERDICT.SOUND;

    const pct = (v) => (v * 100).toFixed(v < 0.01 ? 4 : 1);
    const sentence = silent
      ? `THIS AUDIO IS SILENT. All ${n} samples are zero: a valid, playable container ` +
        "around nothing at all. Whatever was billed for, no sound came back."
      : nearSilent
        ? `THIS AUDIO IS ALL BUT SILENT. It peaks at ${pct(peak)}% of full scale, below the ` +
          `${pct(floor)}% floor this check declares, with ${pct(proportion)}% of its ` +
          `${n} samples non-zero. Treat it as silence until somebody has listened.`
        : `This audio CONTAINS SOUND. It peaks at ${pct(peak)}% of full scale, its RMS level ` +
          `is ${pct(rms)}% of full scale, and ${pct(proportion)}% of its ${n} samples are ` +
          "non-zero.";

    return {
      sampleCount: n,
      peak: peak,
      rms: rms,
      nonZeroSamples: nonZero,
      nonZeroProportion: proportion,
      verdict: verdict,
      silent: silent,
      nearSilent: nearSilent,
      nearSilentPeak: floor,
      sentence: sentence,
    };
  }

  /**
   * Does this clip END in silence, or does it end at speaking level?
   *
   * READ THE CONSTANTS BLOCK ABOVE BEFORE USING THIS. It carries the measured
   * false negative, and a caller who reports `endsInSilence` as "the audio is
   * complete" has overstated it by exactly the amount that block quantifies.
   *
   * `sampleRate` IS REQUIRED AND IS NOT GUESSED. The window is a duration, so a
   * wrong rate measures a different window and returns a confident figure about
   * a clip it did not understand — the plausible-number failure this module's
   * other refusals exist to prevent. There is no default; a caller with no rate
   * gets null.
   *
   * @param {Float32Array|Array<number>} samples - normalised, nominally -1..1
   * @param {number} sampleRate - the container's own declared rate
   * @param {{tailQuietRatio?: number, tailWindowSeconds?: number}} [options]
   * @returns {{tailWindowSeconds:number, tailSampleCount:number, tailRms:number,
   *            tailPeak:number, overallRms:number, quietRatio:number,
   *            tailQuietRatio:number, verdict:string, endsInSilence:boolean,
   *            sentence:string}|null}
   */
  function analyseAudioTail(samples, sampleRate, options) {
    if (!isNumericArrayLike(samples) || samples.length === 0) {
      logWarn("analyseAudioTail: no samples — refusing to report on nothing");
      return null;
    }
    if (!(Number(sampleRate) > 0)) {
      logWarn(
        "analyseAudioTail: no usable sample rate — refusing rather than assuming one, " +
          "because the window is a duration and a wrong rate measures a different window",
        { sampleRate: sampleRate },
      );
      return null;
    }

    const opts = options || {};
    const windowSeconds =
      Number(opts.tailWindowSeconds) > 0
        ? Number(opts.tailWindowSeconds)
        : TAIL_WINDOW_SECONDS;
    const ratioFloor =
      Number(opts.tailQuietRatio) > 0
        ? Number(opts.tailQuietRatio)
        : DEFAULT_TAIL_QUIET_RATIO;

    const rmsOf = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += samples[i] * samples[i];
      return Math.sqrt(sum / (to - from));
    };

    const n = samples.length;
    const want = Math.round(Number(sampleRate) * windowSeconds);
    const tailCount = Math.min(n, want);
    const overallRms = rmsOf(0, n);

    // A CLIP SHORTER THAN THE WINDOW CANNOT BE JUDGED, because its "tail" is
    // the whole clip and the ratio is 1 by construction — which would read as
    // ENDS AT SPEAKING LEVEL for every short clip whatever it contains.
    if (n < want) {
      return {
        tailWindowSeconds: windowSeconds,
        tailSampleCount: n,
        tailRms: overallRms,
        tailPeak: 0,
        overallRms: overallRms,
        quietRatio: 1,
        tailQuietRatio: ratioFloor,
        verdict: TAIL_VERDICT.TOO_SHORT,
        endsInSilence: false,
        sentence:
          `THIS CLIP IS TOO SHORT TO JUDGE. It holds ${n} samples, fewer than the ` +
          `${want} in the ${windowSeconds * 1000}ms window this check measures, so its ` +
          "tail IS the whole clip and any ratio would be 1 by construction. No verdict " +
          "is offered rather than one that could only ever say the same thing.",
      };
    }

    const tailStart = n - tailCount;
    const tailRms = rmsOf(tailStart, n);
    let tailPeak = 0;
    for (let i = tailStart; i < n; i++) {
      const magnitude = samples[i] < 0 ? -samples[i] : samples[i];
      if (magnitude > tailPeak) tailPeak = magnitude;
    }

    // A DIGITALLY SILENT TAIL divides by zero. Infinity is the honest reading —
    // it is as quiet as a tail can be — and it is reported as a number a human
    // can see rather than collapsed to a boolean.
    const quietRatio = tailRms > 0 ? overallRms / tailRms : Infinity;
    const endsInSilence = quietRatio >= ratioFloor;

    const ms = Math.round(windowSeconds * 1000);
    const ratioText = quietRatio === Infinity ? "digitally silent" : quietRatio.toFixed(1) + "x";
    const sentence = endsInSilence
      ? `THIS CLIP ENDS IN SILENCE. Its final ${ms}ms sits ${ratioText} below the clip's ` +
        `own average level, past the ${ratioFloor}x this check declares. That is CONSISTENT ` +
        "WITH COMPLETE SPEECH and is NOT proof of it: a clip cut off inside a pause reads " +
        "exactly the same, measured at 67.3x on a fixture truncated to 30%. Only " +
        "transcribing the audio back and comparing it against the transcript settles it."
      : `THIS CLIP ENDS AT SPEAKING LEVEL. Its final ${ms}ms sits only ${ratioText} below ` +
        `the clip's own average level, short of the ${ratioFloor}x this check declares. ` +
        "Speech that was allowed to finish decays to silence, so this is STRONG EVIDENCE " +
        "THE AUDIO WAS CUT OFF — either at the token budget or somewhere in our own " +
        "handling of it. Listen to the end of it, and transcribe it back.";

    return {
      tailWindowSeconds: windowSeconds,
      tailSampleCount: tailCount,
      tailRms: tailRms,
      tailPeak: tailPeak,
      overallRms: overallRms,
      quietRatio: quietRatio,
      tailQuietRatio: ratioFloor,
      verdict: endsInSilence
        ? TAIL_VERDICT.ENDS_IN_SILENCE
        : TAIL_VERDICT.ENDS_AT_SPEAKING_LEVEL,
      endsInSilence: endsInSilence,
      sentence: sentence,
    };
  }

  /**
   * The two above, for the common case: whole wav bytes in, analysis out, with
   * the container's own declared rate and channel count carried alongside.
   *
   * `sampleRate` HERE IS STILL AN ASSERTION. It is read out of the header, and
   * the header is written by pcm16ToWav from a declared constant — so a wrong
   * rate produces a file that analyses as sound, plays at the wrong speed, and
   * raises nothing anywhere. Only a person listening can test it.
   */
  function analyseWavBytes(bytes, options) {
    const decoded = wavToSamples(bytes);
    if (!decoded) return null;
    const analysis = analyseAudioSamples(decoded.samples, options);
    if (!analysis) return null;
    // THE TAIL IS CARRIED AS ITS OWN SUB-OBJECT rather than spread alongside
    // peak and RMS. The two answer different questions — "is there sound" and
    // "is there ALL of the sound" — and flattening them invites a caller to
    // report one verdict where there are two. It is null where the rate could
    // not support a judgement; a consumer must handle that rather than read an
    // absent tail as a good one.
    return Object.assign({}, analysis, {
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      bitsPerSample: decoded.bitsPerSample,
      durationSeconds: decoded.sampleRate > 0 ? decoded.sampleCount / decoded.sampleRate : null,
      tail: analyseAudioTail(decoded.samples, decoded.sampleRate, options),
    });
  }

  // ── normaliseMessage ────────────────────────────────────────────────────
  /**
   * A complete (non-streaming) message, as a structured result.
   *
   * ALWAYS returns the same shape, so the streaming and non-streaming paths
   * cannot diverge for a consumer — the plan's "processResponse and
   * buildFinalResponse must stay shape-identical" requirement, enforced by
   * construction rather than by discipline.
   *
   * @param {Object} message - choices[0].message
   * @returns {{text: string, images: Object[], audio: Object|null,
   *            reasoning: string, refusal: string|null, toolCalls: Object|null}}
   */
  function normaliseMessage(message) {
    const out = emptyResult();
    if (!message || typeof message !== "object") return out;

    // content may legitimately be null (image responses) — "" is the contract.
    if (typeof message.content === "string") out.text = message.content;

    if (Array.isArray(message.images)) out.images = message.images.slice();
    if (message.audio && typeof message.audio === "object") {
      out.audio = message.audio;
    }
    if (typeof message.reasoning === "string") out.reasoning = message.reasoning;
    if (message.refusal !== null && message.refusal !== undefined) {
      out.refusal = message.refusal;
    }
    if (Array.isArray(message.tool_calls)) out.toolCalls = message.tool_calls;

    return out;
  }

  /** The zero value of the structured result. `text` is "" and never null. */
  function emptyResult() {
    return {
      text: "",
      images: [],
      audio: null,
      reasoning: "",
      refusal: null,
      toolCalls: null,
    };
  }

  // ── reduceStreamDelta ───────────────────────────────────────────────────
  /**
   * Fold one streaming delta into an accumulator. PURE: returns a NEW
   * accumulator and never mutates the one passed in, so a caller can keep a
   * history of folds and a test can replay a stream twice and get the same
   * answer both times.
   *
   * THE EMPTY-STRING DISTINCTION IS THE WHOLE POINT. An audio chunk carries
   * `delta.content: ""` beside `delta.audio`, so a fold testing truthiness would
   * treat it as "no text" and a fold testing presence would append nothing but
   * still be right. Text is APPENDED, which makes "" a harmless no-op, and audio
   * is handled independently of it rather than in an else-arm. That is the
   * difference between this and the shipped chain, which drops the audio.
   *
   * @param {Object} delta - choices[0].delta
   * @param {Object} [acc] - accumulator; a fresh one is made when absent
   * @returns {Object} the new accumulator
   */
  function reduceStreamDelta(delta, acc) {
    const next = acc ? cloneResult(acc) : emptyResult();
    if (!delta || typeof delta !== "object") return next;

    if (typeof delta.content === "string") next.text += delta.content;
    if (typeof delta.reasoning === "string") next.reasoning += delta.reasoning;

    // Images arrive whole rather than as fragments, so they are collected.
    if (Array.isArray(delta.images)) next.images = next.images.concat(delta.images);

    // Audio arrives as fragments across many chunks: `data` is base64 audio
    // appended a slice at a time, `transcript` is the spoken text appended a
    // word at a time, and `id`/`expires_at` are per-response constants that
    // simply overwrite. Measured on the audio-out capture: 15 of 17 chunks
    // carry delta.audio, and no single chunk carries both data and transcript.
    if (delta.audio && typeof delta.audio === "object") {
      const a = next.audio || { id: null, data: "", transcript: "", expiresAt: null };
      if (typeof delta.audio.data === "string") a.data += delta.audio.data;
      if (typeof delta.audio.transcript === "string") {
        a.transcript += delta.audio.transcript;
      }
      if (delta.audio.id) a.id = delta.audio.id;
      if (delta.audio.expires_at) a.expiresAt = delta.audio.expires_at;
      next.audio = a;
    }

    if (delta.refusal !== null && delta.refusal !== undefined) {
      next.refusal = delta.refusal;
    }
    if (Array.isArray(delta.tool_calls)) {
      next.toolCalls = (next.toolCalls || []).concat(delta.tool_calls);
    }

    return next;
  }

  function cloneResult(r) {
    return {
      text: r.text,
      images: r.images.slice(),
      audio: r.audio ? Object.assign({}, r.audio) : null,
      reasoning: r.reasoning,
      refusal: r.refusal,
      toolCalls: r.toolCalls ? r.toolCalls.slice() : null,
    };
  }

  // ── The two extractors the stream collapse uses ──────────────────────────
  //
  // THERE ARE TWO OF THESE AND NOT ONE, AND THAT IS A MEASUREMENT RATHER THAN A
  // PREFERENCE. js/openrouter-client/openrouter-client-stream.js holds FOUR
  // extraction sites in TWO different precedence orders:
  //
  //   delta-first   processLine (:770,831,876,921)
  //                 processBufferLine SSE branch (:1000,1007,1014)
  //   message-first done path (:401,403)
  //                 processBufferLine full-JSON branch (:1089,1096)
  //
  // Two of the four never inspect `delta` at all. The orders are NOT
  // interchangeable: on a choice carrying both `text` and `message.content` the
  // delta-first order yields `text` and the message-first order yields
  // `message.content`. Collapsing all four into a single fold would therefore
  // change shipped behaviour at one of them — which is exactly what the
  // golden-file differential in .claude/modality/ exists to catch, and why the
  // collapse preserves both orders instead of unifying them.
  //
  // Each returns { kind, content, toolCalls } and NEVER a bare string, so a call
  // site reads `.content` and behaves precisely as its own chain did.

  const KIND = Object.freeze({
    CONTENT: "content",
    TEXT: "text",
    MESSAGE: "message",
    TOOL_CALLS: "toolCalls",
    NONE: "none",
  });

  /**
   * Delta-first precedence, for a streaming chunk.
   * Order: delta.content -> text -> message.content -> delta.tool_calls
   */
  function extractDeltaChoice(choice) {
    if (!choice || typeof choice !== "object") {
      return { kind: KIND.NONE, content: null, toolCalls: null };
    }
    if (choice.delta && choice.delta.content) {
      return { kind: KIND.CONTENT, content: choice.delta.content, toolCalls: null };
    }
    if (choice.text) {
      return { kind: KIND.TEXT, content: choice.text, toolCalls: null };
    }
    if (choice.message && choice.message.content) {
      return { kind: KIND.MESSAGE, content: choice.message.content, toolCalls: null };
    }
    if (choice.delta && choice.delta.tool_calls) {
      return { kind: KIND.TOOL_CALLS, content: null, toolCalls: choice.delta.tool_calls };
    }
    return { kind: KIND.NONE, content: null, toolCalls: null };
  }

  /**
   * Message-first precedence, for a complete body.
   * Order: message.content -> text
   *
   * Deliberately does NOT inspect `delta`, matching both sites it replaces.
   */
  function extractMessageChoice(choice) {
    if (!choice || typeof choice !== "object") {
      return { kind: KIND.NONE, content: null, toolCalls: null };
    }
    if (choice.message && choice.message.content) {
      return { kind: KIND.MESSAGE, content: choice.message.content, toolCalls: null };
    }
    if (choice.text) {
      return { kind: KIND.TEXT, content: choice.text, toolCalls: null };
    }
    return { kind: KIND.NONE, content: null, toolCalls: null };
  }

  window.ModalityCore = {
    MODALITY,
    METADATA_KEY,
    KIND,
    STREAMING_AUDIO_FORMAT,
    DEFAULT_AUDIO_VOICE,
    MEASURED_AUDIO_VOICES,
    MEASURED_AUDIO_VOICES_CAPTURED,
    modalityOf,
    canOutput,
    canAccept,
    isTextIncapable,
    modalityWarnings,
    requestAdditions,
    audioContentPart,
    audioFormatFor,
    pcm16ToWav,
    // EXPORTED SO THERE IS ONE CODEC AND NOT TWO. The capability runner needs
    // the wav's BYTES to build a Blob and to analyse it; without this it would
    // reach for `atob`, which is a second base64 implementation in a module
    // whose own comment records why it has none.
    base64ToBytes,
    wavToSamples,
    analyseAudioSamples,
    analyseAudioTail,
    analyseWavBytes,
    AUDIO_VERDICT,
    TAIL_VERDICT,
    TAIL_WINDOW_SECONDS,
    DEFAULT_TAIL_QUIET_RATIO,
    normaliseMessage,
    reduceStreamDelta,
    emptyResult,
    extractDeltaChoice,
    extractMessageChoice,
  };

  logInfo("Modality core helpers ready");
})();
