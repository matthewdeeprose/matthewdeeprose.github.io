/**
 * Graph Builder Image
 * The "From an image" tab: sends a chart image to a vision model, parses the reply with
 * GraphBuilderImageReply and hands the checked table to the Graph Builder controller.
 *
 * Everything outside this file is resolved at call time, never at load: OpenRouterEmbed is a module
 * and runs after the plain scripts, and the Graph Builder controller exists only once its mode opens.
 *
 * Deliberately NOT built yet (parcel B-4):
 * - "Edit as CSV". Paste CSV keeps only the first series, so copying a multi-series table there would
 *   silently lose data.
 * - A cancel control.
 *
 * @version 1.0.0
 */

const GraphBuilderImage = (function () {
  "use strict";

  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // tools.html's ?dev=1 stores this key and ?dev=0 removes it. A dev session reads INFO; a plain one stays at the default.
  const DEV_FLAG_KEY = "dev-test-harnesses";
  const DEV_FLAG_ON = "true";

  /** Set the level from the dev flag. Run at load and again when an extraction starts, because ?dev=1 is written after this script has loaded. */
  function applyDevLogLevel() {
    let flag = null;
    try {
      flag = localStorage.getItem(DEV_FLAG_KEY);
    } catch (error) {
      // storage unavailable: stay at the default
    }
    currentLogLevel = flag === DEV_FLAG_ON ? LOG_LEVELS.INFO : DEFAULT_LOG_LEVEL;
  }
  applyDevLogLevel();

  /**
   * Check if logging should occur for given level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Graph Builder Image] ERROR: ${message}`);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Graph Builder Image] WARN: ${message}`);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Graph Builder Image] INFO: ${message}`);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Graph Builder Image] DEBUG: ${message}`);
    }
  }

  // ============================================
  // CONSTANTS
  // ============================================

  const PROMPT_URL = "md-scripts/charts/prompts/image-to-table.txt";
  const USER_TEXT = "Reconstruct the chart in this image.";

  // UX-3a: the person's optional hints, appended to USER_TEXT only when at least one is given
  const HINT_TEXT_MAX_CHARS = 500;
  const HINT_HEADING = "Hints from the person who uploaded the image (the image wins where they disagree):";
  const HINT_TYPE_PREFIX = "Chart type: ";
  const HINT_ABOUT_PREFIX = "About this chart: ";
  const HINT_ID = Object.freeze({
    TYPE: "gb-image-hint-type",
    TEXT: "gb-image-hint-text",
  });

  const REQUEST = Object.freeze({
    TEMPERATURE: 0,
    MAX_TOKENS: 4096,
  });

  // Image compression as the app does it (Image Describer's embed): above 200 KB, down-scale and re-encode.
  const COMPRESSION = Object.freeze({
    THRESHOLD_BYTES: 200 * 1024,
    MAX_WIDTH: 1200,
    MAX_HEIGHT: 900,
    QUALITY: 0.7,
  });

  const PROVIDER = Object.freeze({
    OPENROUTER: "openrouter",
    FOUNDRY_SURFACES: Object.freeze(["azure-openai", "azure-responses"]),
  });

  // Default model per provider; the person can still pick another model. OpenRouter: gemini-3.6-flash, chosen on
  // IC-4 and B-7 readings (closest on every real chart image, three readings each). Foundry (azure-openai only):
  // gpt-5.4, chosen on F-1's readings as the best measured Foundry option, not because it passed every check.
  // The azure-responses surface has no entry (gpt-5.4 is not on it), so it uses the picker's first option.
  const DEFAULT_MODEL = Object.freeze({
    [PROVIDER.OPENROUTER]: "google/gemini-3.6-flash",
    [PROVIDER.FOUNDRY_SURFACES[0]]: "azure-openai/gpt-5.4",
  });

  const ACCEPTED_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
  const CAPABILITY_VISION = "vision";
  const FOUNDRY_PROXY_KEY = "foundryProxyUrl";

  const ID = Object.freeze({
    PANEL: "gb-image-panel",
    INPUT: "gb-image-input",
    DROP_ZONE: "gb-image-drop-zone",
    FILE_NAME: "gb-image-file-name",
    MODEL: "gb-image-model",
    EXTRACT: "gb-image-extract",
    RESULT: "gb-image-result",
    PROGRESS: "gb-image-progress",
    PROGRESS_TEXT: "gb-image-progress-text",
    STOP: "gb-image-stop",
    PRICE: "gb-image-price",
    NOTE: "gb-image-note",
    EMBED_OUTPUT: "gb-image-embed-output",
    NEXT: "gb-data-next",
    CREATE_ANOTHER: "gb-create-another",
    ORIGINAL_DATA: "gb-image-original-data",
    ORIGINAL_TYPE: "gb-image-original-type",
    ORIGINAL_CONFIG: "gb-image-original-config",
    ORIGINAL_RESULT: "gb-image-original-result",
    DEV_FINISH: "gb-image-dev-finish-reason",
    DEV_REQUEST: "gb-image-dev-request",
    DEV_RESPONSE: "gb-image-dev-response",
    DEV_NOTE: "gb-image-dev-request-note",
    DEV_COPY_REQUEST: "gb-image-dev-copy-request",
    DEV_COPY_RESPONSE: "gb-image-dev-copy-response",
    DEV_EXPAND_REQUEST: "gb-image-dev-expand-request",
    DEV_REQUEST_PRE: "gb-image-dev-request-pre",
  });

  // The one voice of the developer panel: its copy buttons' confirmations
  const DEV_COPIED = Object.freeze({ request: "Request copied.", response: "Response copied." });

  // The image panel's holder shows as soon as a file is chosen; the three later screens' holders show only while
  // the table came from the image (state.imageExtraction)
  const ORIGINAL_HOLDERS_ALWAYS = Object.freeze([ID.ORIGINAL_DATA]);
  const ORIGINAL_HOLDERS_EXTRACTED = Object.freeze([ID.ORIGINAL_TYPE, ID.ORIGINAL_CONFIG, ID.ORIGINAL_RESULT]);
  const ORIGINAL_ALT_PREFIX = "Your chart image: ";

  const TAB_IDS = Object.freeze(["gb-tab-form", "gb-tab-paste", "gb-tab-upload", "gb-tab-image"]);

  const MESSAGE = Object.freeze({
    READING: "Reading your chart…",
    BAD_TYPE: "Choose a PNG, JPEG or WebP image.",
    ADDED: "Chart image added.",
    ONE_AT_A_TIME: "Drop one image at a time.",
    NO_IMAGE_CHOSEN: "No image chosen",
    NOTE_OPENROUTER: "To read a chart image, add your OpenRouter key in Set Up.",
    NOTE_FOUNDRY: "To read a chart image, sign in to Foundry in Set Up.",
    ESTIMATES: "Some values are estimates; check them against your image.",
    REDRAWN: "Your chart will be drawn as vertical side-by-side bars, so it will look different from the original.",
    NOTES_LEAD: "The model also noted:",
    CUT_OFF: "The reply was cut off before it finished. Try again, or choose another model.",
    UNREADABLE: "The model's reply could not be read. Try again, or choose another model.",
    NOT_A_CHART: "The model could not read a chart in this image.",
    NOT_ENOUGH: "The image does not show enough to recover the chart's data.",
    NOTES_BELOW: " Its notes are below.",
    AUTH: "Your key or sign-in was not accepted. Check it in Set Up, then try again.",
    FORBIDDEN: "Your account is not permitted to use this service.",
    BUSY: "The model is busy right now. Please try again shortly.",
    UNAVAILABLE: "The service is not available just now. Try again shortly, or choose another model.",
    NETWORK: "The request could not reach the service. Check your connection, then try again.",
    GENERIC: "Something went wrong while reading your chart. Try again, or choose another model.",
    NO_PRICE: "No price is listed for this model.",
    STOPPED: "Stopped. Nothing was read from the image.",
    STAGE_PREPARING: "Preparing your image…",
    STAGE_WAITING: "Waiting for the model…",
    STAGE_RECEIVING: "Receiving the reply…",
    STAGE_READING: "Reading the table…",
  });

  // Where a run is, for the progress line. RECEIVING is reached only by a streamed reply (no chunks arrive
  // under reduced motion, which sends without streaming).
  const STAGE = Object.freeze({ PREPARING: "preparing", WAITING: "waiting", RECEIVING: "receiving", READING: "reading" });
  const STAGE_TEXT = Object.freeze({
    [STAGE.PREPARING]: MESSAGE.STAGE_PREPARING,
    [STAGE.WAITING]: MESSAGE.STAGE_WAITING,
    [STAGE.RECEIVING]: MESSAGE.STAGE_RECEIVING,
    [STAGE.READING]: MESSAGE.STAGE_READING,
  });
  const PROGRESS_TICK_MS = 1000;
  const MS_PER_SECOND = 1000;

  const STATUS_CODE = Object.freeze({ AUTH: 401, FORBIDDEN: 403, BUSY: 429, SERVER_MIN: 500 });

  // Orientation value the reply parser uses for a horizontal chart.
  const ORIENTATION_HORIZONTAL = "horizontal";

  // The class Graph Builder's tab manager puts on the showing panel
  const ACTIVE_PANEL_CLASS = "active";

  // The class Graph Builder's own drop zone puts on itself while a file is dragged over it
  const DRAG_ACTIVE_CLASS = "gb-drag-active";

  const IMAGE_MIME_PREFIX = "image/";

  // Input types that do not take typed text: a paste while one of these has focus (the file input above all)
  // is still a paste of a chart image
  const NON_TEXT_INPUT_TYPES = Object.freeze(["file", "button", "submit", "reset", "image", "checkbox", "radio", "range", "color"]);

  // ============================================
  // STATE
  // ============================================

  let initialised = false;
  let running = false;
  let promptPromise = null;

  // The run in flight: its embed (for Stop), whether Stop was pressed, its stage and clock, and the token a
  // deferred end-of-run step checks so a later run is never touched by an earlier one
  let activeEmbed = null;
  let stopRequested = false;
  let stage = STAGE.PREPARING;
  let runStartedAt = 0;
  let progressTimer = null;
  let endToken = null;

  // One object URL per chosen file, revoked whenever it is replaced or cleared
  let originalUrl = null;
  let originalName = "";
  let originalFile = null;

  // The shared developer panel (js/dev-panel.js), built at init
  let devPanel = null;

  // ============================================
  // LOOKUPS (call time)
  // ============================================

  // Memoised, so that once the panel is set up an event never calls into the document (a lookup that
  // finds nothing is not cached)
  const elementCache = {};
  const byId = (id) => elementCache[id] || (elementCache[id] = document.getElementById(id));

  function controller() {
    return window.GraphBuilder && window.GraphBuilder._instance ? window.GraphBuilder._instance : null;
  }

  function notifications() {
    return window.GraphBuilderNotifications || null;
  }

  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    return switcher && typeof switcher.getActive === "function" ? switcher.getActive() : PROVIDER.OPENROUTER;
  }

  function isFoundry(providerId) {
    return providerId !== PROVIDER.OPENROUTER;
  }

  /** OpenRouter: the key. Foundry: signed in (isAvailable is always true for Foundry, so it says nothing). */
  function hasCredentials(providerId) {
    if (!isFoundry(providerId)) {
      const switcher = window.ProviderSwitcher;
      return !!(switcher && typeof switcher.isAvailable === "function" && switcher.isAvailable(providerId));
    }
    return !!(window.EntraAuth && typeof window.EntraAuth.isSignedIn === "function" && window.EntraAuth.isSignedIn());
  }

  // ============================================
  // PICKER
  // ============================================

  function eligibleModels(providerId) {
    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getEligibleModels !== "function") return [];
    try {
      return selector.getEligibleModels({ providerId, capabilities: [CAPABILITY_VISION] });
    } catch (error) {
      logWarn(`getEligibleModels failed: ${error.message}`);
      return [];
    }
  }

  function chooseDefault(models, providerId) {
    const wanted = DEFAULT_MODEL[providerId];
    if (wanted && models.some((m) => m.id === wanted)) return wanted;
    return models.length ? models[0].id : "";
  }

  function populatePicker() {
    const select = byId(ID.MODEL);
    if (!select) return;

    const providerId = activeProvider();
    const models = eligibleModels(providerId);
    const previous = select.value;

    select.textContent = "";
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name || model.id;
      select.appendChild(option);
    });

    // Keep the person's choice across a refill when it is still on offer
    select.value = models.some((m) => m.id === previous) ? previous : chooseDefault(models, providerId);

    refreshPrice();
    refreshControls();
  }

  function formatPrice(value) {
    return Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  function refreshPrice() {
    const line = byId(ID.PRICE);
    const select = byId(ID.MODEL);
    if (!line || !select) return;

    const model = eligibleModels(activeProvider()).find((m) => m.id === select.value);
    const costs = model && model.costs;
    if (!costs || (!costs.input && !costs.output)) {
      line.textContent = model ? MESSAGE.NO_PRICE : "";
      return;
    }
    // No dollar sign: MathJax reads a pair of them as maths delimiters and turns the sentence into a focusable equation
    line.textContent = `Price: USD ${formatPrice(costs.input || 0)} per million input tokens and USD ${formatPrice(costs.output || 0)} per million output tokens.`;
  }

  // ============================================
  // CONTROLS
  // ============================================

  /**
   * Keep the Extract button, its note and the price line in step with the file, model and credentials.
   * While a request runs the button uses aria-disabled, never the disabled property, so a focused
   * button keeps focus.
   */
  function refreshControls() {
    const button = byId(ID.EXTRACT);
    const note = byId(ID.NOTE);
    const input = byId(ID.INPUT);
    const select = byId(ID.MODEL);
    if (!button) return;

    const providerId = activeProvider();
    const credentials = hasCredentials(providerId);
    const ready = !!(input && input.files && input.files[0] && select && select.value && credentials);

    if (running) {
      button.disabled = false;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
      button.disabled = !ready;
    }

    if (note) {
      const text = credentials ? "" : isFoundry(providerId) ? MESSAGE.NOTE_FOUNDRY : MESSAGE.NOTE_OPENROUTER;
      note.textContent = text;
      note.hidden = !text;
      if (text) {
        button.setAttribute("aria-describedby", ID.NOTE);
      } else {
        button.removeAttribute("aria-describedby");
      }
    }
  }

  // ============================================
  // RESULT AREA (plain text, no live role)
  // ============================================

  function clearResult() {
    const area = byId(ID.RESULT);
    if (!area) return;
    area.textContent = "";
    area.hidden = true;
  }

  // ============================================
  // DEVELOPER INFORMATION (silent: no live role; the copy buttons' confirmation is its only voice)
  // ============================================

  /** The copy confirmation is this tab's success toast, which is the one voice (no direct announcement beside it). */
  function notifyCopied(message) {
    const toasts = notifications();
    if (toasts) toasts.success(message);
  }

  function createDevPanel() {
    if (!window.DevPanel) {
      logWarn("window.DevPanel is missing; the developer panel will stay empty");
      return null;
    }
    return window.DevPanel.create({
      ids: {
        finish: ID.DEV_FINISH,
        request: ID.DEV_REQUEST,
        response: ID.DEV_RESPONSE,
        note: ID.DEV_NOTE,
        copyRequest: ID.DEV_COPY_REQUEST,
        copyResponse: ID.DEV_COPY_RESPONSE,
        expandRequest: ID.DEV_EXPAND_REQUEST,
        requestPre: ID.DEV_REQUEST_PRE,
      },
      copiedMessages: DEV_COPIED,
      notifyCopied: notifyCopied,
    });
  }

  function clearDevInfo() {
    if (devPanel) devPanel.clear();
  }

  /** A failed send's error in plain fields only, so the panel never carries more than a status and a message. */
  function summariseError(error) {
    if (!error) return null;
    return { name: error.name, message: error.message, status: error.status || error.statusCode, code: error.code };
  }

  /** Fill the panel from the run's own embed (read before it is dropped) and its response, or its error. */
  function showDevInfo(embed, response, error) {
    if (!devPanel) return;
    const wire = embed && typeof embed.getLastWireRequest === "function" ? embed.getLastWireRequest() : null;
    const shown = response || { raw: summariseError(error) };
    devPanel.update(shown, wire, "");
  }

  function appendLine(area, text) {
    const p = document.createElement("p");
    p.textContent = text;
    area.appendChild(p);
  }

  function appendIssues(area, issues) {
    if (!issues || !issues.length) return;
    appendLine(area, MESSAGE.NOTES_LEAD);
    const list = document.createElement("ul");
    issues.forEach((issue) => {
      const item = document.createElement("li");
      item.textContent = issue.message;
      list.appendChild(item);
    });
    area.appendChild(list);
  }

  function showAccepted(result) {
    const area = byId(ID.RESULT);
    if (!area) return;
    area.textContent = "";

    if (result.status === "approximate") appendLine(area, MESSAGE.ESTIMATES);
    if (result.stacked === true || result.orientation === ORIENTATION_HORIZONTAL) appendLine(area, MESSAGE.REDRAWN);
    appendIssues(area, result.issues);

    area.hidden = area.childNodes.length === 0;
  }

  function showRefusalNotes(result) {
    const area = byId(ID.RESULT);
    if (!area) return;
    area.textContent = "";
    appendIssues(area, result.issues);
    area.hidden = area.childNodes.length === 0;
  }

  // ============================================
  // ORIGINAL IMAGE (visible content, no live role; the success toast stays the only voice)
  // ============================================

  function hasExtraction() {
    return !!(window.GraphBuilder && window.GraphBuilder._state && window.GraphBuilder._state.imageExtraction);
  }

  function fillHolder(id, visible) {
    const holder = byId(id);
    if (!holder) return;
    const img = holder.querySelector("img");
    if (visible && originalUrl) {
      if (img) {
        if (img.getAttribute("src") !== originalUrl) img.setAttribute("src", originalUrl);
        img.setAttribute("alt", ORIGINAL_ALT_PREFIX + originalName);
      }
      holder.hidden = false;
      return;
    }
    holder.hidden = true;
    if (img) {
      img.removeAttribute("src");
      img.setAttribute("alt", "");
    }
  }

  /** Show or hide each holder from the current file and extraction state. */
  function syncOriginalHolders() {
    ORIGINAL_HOLDERS_ALWAYS.forEach((id) => fillHolder(id, true));
    const extracted = hasExtraction();
    ORIGINAL_HOLDERS_EXTRACTED.forEach((id) => fillHolder(id, extracted));
  }

  /** The visible file input is hidden, so the chosen name is shown in a plain paragraph beside it. */
  function showFileName(name) {
    const line = byId(ID.FILE_NAME);
    if (line) line.textContent = name || MESSAGE.NO_IMAGE_CHOSEN;
  }

  function clearOriginal() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = null;
    originalName = "";
    originalFile = null;
    showFileName("");
    syncOriginalHolders();
  }

  function setOriginal(file) {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = URL.createObjectURL(file);
    originalName = file.name;
    originalFile = file;
    showFileName(file.name);
    syncOriginalHolders();
  }

  /** Follow the file input: no file, or a file a tab switch cleared, means no image. */
  function followFileInput() {
    const input = byId(ID.INPUT);
    const file = input && input.files && input.files[0];
    if (file && ACCEPTED_TYPES.includes(file.type)) {
      if (!originalUrl || originalFile !== file) setOriginal(file);
      else syncOriginalHolders();
      return;
    }
    clearOriginal();
  }

  // ============================================
  // PROMPT
  // ============================================

  function loadPrompt() {
    if (!promptPromise) {
      promptPromise = fetch(PROMPT_URL).then((response) => {
        if (!response.ok) throw new Error(`prompt fetch failed: ${response.status}`);
        return response.text();
      });
      // A failed fetch must not be cached
      promptPromise.catch(() => {
        promptPromise = null;
      });
    }
    return promptPromise;
  }

  // ============================================
  // REQUEST
  // ============================================

  function ensureEmbedContainer() {
    let container = byId(ID.EMBED_OUTPUT);
    if (container) return container;
    container = document.createElement("div");
    container.id = ID.EMBED_OUTPUT;
    container.hidden = true;
    const panel = byId(ID.PANEL);
    (panel || document.body).appendChild(container);
    return container;
  }

  function buildEmbed(modelId, systemPrompt) {
    if (!window.OpenRouterEmbed) throw new Error("OpenRouterEmbed is not available");

    ensureEmbedContainer();
    const config = {
      containerId: ID.EMBED_OUTPUT,
      announceContainer: false, // the container is a scratch area; the toasts are the only voice
      // This tab shows no streamed text (the reply goes to a hidden scratch container), so streaming moves nothing on
      // screen. Under reduced motion the embed would otherwise fall back to a non-streaming send, which on OpenRouter
      // reaches the shared request handler and adds its own "Sending request to API..." beside the start toast.
      respectReducedMotion: false,
      model: modelId,
      systemPrompt,
      temperature: REQUEST.TEMPERATURE,
      max_tokens: REQUEST.MAX_TOKENS,
      showNotifications: false,
      showStreamingProgress: false,
      enableCompression: true,
      compressionThreshold: COMPRESSION.THRESHOLD_BYTES,
      compressionMaxWidth: COMPRESSION.MAX_WIDTH,
      compressionMaxHeight: COMPRESSION.MAX_HEIGHT,
      compressionQuality: COMPRESSION.QUALITY,
    };

    // Only when Set Up has stored a proxy host; the Foundry adapters carry their own default otherwise
    const proxyUrl = localStorage.getItem(FOUNDRY_PROXY_KEY);
    if (proxyUrl) {
      config.providers = PROVIDER.FOUNDRY_SURFACES.reduce((map, id) => {
        map[id] = { proxyUrl };
        return map;
      }, {});
    }
    return new window.OpenRouterEmbed(config);
  }

  /** Plain words for a failed send; never the raw error text. */
  function describeError(error) {
    const status =
      (error && (error.status || error.statusCode)) ||
      (error && error.metadata && (error.metadata.status || error.metadata.statusCode)) ||
      Number((String(error && error.message).match(/\b(401|403|429|5\d\d)\b/) || [])[1]) ||
      0;

    if (status === STATUS_CODE.AUTH) return MESSAGE.AUTH;
    if (status === STATUS_CODE.FORBIDDEN) return MESSAGE.FORBIDDEN;
    if (status === STATUS_CODE.BUSY) return MESSAGE.BUSY;
    if (status >= STATUS_CODE.SERVER_MIN) return MESSAGE.UNAVAILABLE;
    if (/key not configured/i.test(String(error && error.message))) return MESSAGE.NOTE_OPENROUTER;
    if (error instanceof TypeError || (error && error.code === "NETWORK_ERROR")) return MESSAGE.NETWORK;
    return MESSAGE.GENERIC;
  }

  function refusalMessage(result) {
    const reasons = window.GraphBuilderImageReply.REASON;
    const hasNotes = !!(result.issues && result.issues.length);
    switch (result.reason) {
      case reasons.TRUNCATED:
        return MESSAGE.CUT_OFF;
      case reasons.STATUS_UNSUPPORTED:
        return MESSAGE.NOT_A_CHART + (hasNotes ? MESSAGE.NOTES_BELOW : "");
      case reasons.STATUS_INSUFFICIENT:
        return MESSAGE.NOT_ENOUGH + (hasNotes ? MESSAGE.NOTES_BELOW : "");
      default:
        return MESSAGE.UNREADABLE;
    }
  }

  /**
   * Log the provider's token counts when the reply carries them. The non-streaming path hands back
   * { prompt, completion, total } from the provider's own usage. The streaming path hands back an object the
   * client builds itself (completion_tokens is reply length / 4, prompt_tokens is 0 when untracked), so it is
   * skipped rather than logged as if measured. Neither path carries a cost.
   */
  function logUsage(response) {
    const usage = response && response.metadata && response.metadata.tokens;
    if (!usage || typeof usage.prompt !== "number") return;
    logInfo(`tokens: prompt ${usage.prompt}, completion ${usage.completion}, total ${usage.total}`);
  }

  // ============================================
  // PROGRESS AND STOP (visible text only: no live role, the toasts stay the only voice)
  // ============================================

  /** Stage plus whole elapsed seconds, rewritten only when it changes. */
  function renderProgress() {
    const line = byId(ID.PROGRESS_TEXT);
    if (!line) return;
    const seconds = Math.floor((performance.now() - runStartedAt) / MS_PER_SECOND);
    const text = stage === STAGE.READING || seconds < 1 ? STAGE_TEXT[stage] : `${STAGE_TEXT[stage]} ${seconds} s`;
    if (line.textContent !== text) line.textContent = text;
  }

  function setStage(next) {
    stage = next;
    renderProgress();
  }

  function stopProgressTimer() {
    if (progressTimer !== null) clearInterval(progressTimer);
    progressTimer = null;
  }

  function startProgress() {
    stage = STAGE.PREPARING;
    runStartedAt = performance.now();
    const area = byId(ID.PROGRESS);
    const line = byId(ID.PROGRESS_TEXT);
    if (line) line.textContent = "";
    renderProgress();
    if (area) area.hidden = false;
    stopProgressTimer();
    progressTimer = setInterval(renderProgress, PROGRESS_TICK_MS);
  }

  /**
   * End the progress area. When focus is inside it (Stop, above all) the hide waits for a full rendering update
   * after the release, so Stop is not hidden while focused and focus is not left to fall to the page; ONE
   * requestAnimationFrame is not enough (Image Describer parcels 43b and 43c measured it). Focus then moves to
   * Extract only if it is still in the area; a person who has moved on is left where they are.
   */
  function endProgress() {
    stopProgressTimer();
    const area = byId(ID.PROGRESS);
    if (!area) return;
    const token = {};
    endToken = token;
    if (!area.contains(document.activeElement)) {
      area.hidden = true;
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (endToken !== token || running) return;
        endToken = null;
        const button = byId(ID.EXTRACT);
        if (area.contains(document.activeElement) && button && !button.disabled) button.focus();
        area.hidden = true;
      })
    );
  }

  /**
   * Streaming: cancelStreaming resolves the pending send with the cancelled flag. Otherwise (reduced motion)
   * abort the embed's controller and its non-streaming fallback returns the flag. Never cancelRequest(), which
   * raises its own "Request cancelled" toast on the non-streaming path (Image Describer parcel 43e-2).
   */
  function onStopClick() {
    if (!running || stopRequested) return;
    stopRequested = true;
    stopProgressTimer();
    logInfo("stop pressed");
    const embed = activeEmbed;
    if (!embed) return;
    if (embed.isStreaming) {
      embed.cancelStreaming("User cancelled");
    } else {
      const controller = embed.getAbortController && embed.getAbortController();
      if (controller) controller.abort();
    }
  }

  /** The cancelled flag sits at the top level (reduced-motion fallback) or in raw (cancelStreaming). */
  function replyWasCancelled(response) {
    return !!(response && (response.cancelled === true || (response.raw && response.raw.cancelled === true)));
  }

  /** The text sent with the image: the fixed line, plus the person's hints when there are any. */
  function buildUserText() {
    const typeField = byId(HINT_ID.TYPE);
    const textField = byId(HINT_ID.TEXT);
    const type = typeField ? typeField.value : "";
    const about = textField ? textField.value.trim().slice(0, HINT_TEXT_MAX_CHARS) : "";
    if (!type && !about) return USER_TEXT;

    logInfo(`hints sent: type ${type || "none"}, text ${about.length} characters`);
    const lines = [USER_TEXT, "", HINT_HEADING];
    if (type) lines.push(HINT_TYPE_PREFIX + type);
    if (about) lines.push(HINT_ABOUT_PREFIX + about);
    return lines.join("\n");
  }

  async function extract() {
    if (running) return;

    const input = byId(ID.INPUT);
    const select = byId(ID.MODEL);
    const file = input && input.files && input.files[0];
    const providerId = activeProvider();
    const gb = controller();
    const toasts = notifications();
    const parser = window.GraphBuilderImageReply;
    if (!file || !select || !select.value || !hasCredentials(providerId) || !gb || !toasts || !parser) return;

    running = true;
    stopRequested = false;
    activeEmbed = null;
    refreshControls();
    startProgress();

    // The trail below never names a key, token, header or the image data: only sizes, ids, counts and codes
    applyDevLogLevel();
    const startedAt = performance.now();
    let outcome = "failed";
    logInfo(`extract: ${file.name}, ${file.type}, ${file.size} bytes`);
    logInfo(`provider ${providerId}, model ${select.value}`);
    // Read when Extract is pressed, so a later edit cannot change a request already under way
    const userText = buildUserText();
    logInfo(`compression ${file.size > COMPRESSION.THRESHOLD_BYTES ? "will" : "will not"} apply (${file.size} bytes against a ${COMPRESSION.THRESHOLD_BYTES} byte threshold)`);

    // A new extraction replaces whatever the last one loaded
    gb.clearDataState();
    clearResult();
    clearDevInfo();
    syncOriginalHolders();
    toasts.info(MESSAGE.READING);

    let embed = null;
    let sent = false;
    let reply = null;
    let failure = null;
    // The one voice for a Stop: no parse, no error toast, the file and its original image stay
    const stopQuietly = () => {
      outcome = "stopped";
      logInfo("stopped before any reply was read");
      clearResult();
      toasts.info(MESSAGE.STOPPED);
    };
    try {
      const systemPrompt = await loadPrompt();
      logInfo(`prompt loaded (${systemPrompt.length} characters)`);
      if (stopRequested) return stopQuietly();
      embed = buildEmbed(select.value, systemPrompt);
      activeEmbed = embed;
      await embed.attachFile(file);
      if (stopRequested) return stopQuietly();

      logInfo("request sent");
      setStage(STAGE.WAITING);
      const sentAt = performance.now();
      sent = true;
      const response = await embed.sendStreamingRequest({
        userPrompt: userText,
        onChunk: () => {
          if (stage === STAGE.WAITING && !stopRequested) setStage(STAGE.RECEIVING);
        },
      });
      reply = response;
      // A cancelled send RESOLVES: nothing is parsed and no error is raised. A Stop that landed before the
      // request could be aborted ends the same way, since the person asked for nothing to be read.
      if (stopRequested || replyWasCancelled(response)) return stopQuietly();
      setStage(STAGE.READING);
      logInfo(`reply received in ${Math.round(performance.now() - sentAt)} ms: ${response && response.text ? response.text.length : 0} characters, finishReason ${response && response.finishReason}`);
      logUsage(response);
      logDebug(`reply text: ${response && response.text}`);

      const result = parser.parse(response && response.text, { finishReason: response && response.finishReason });
      if (!result.ok) {
        logInfo(`refused: ${result.reason}`);
        outcome = "refused";
        showRefusalNotes(result);
        toasts.error(refusalMessage(result));
        return;
      }
      logInfo(
        `parsed: ok, status ${result.status}, suggestedType ${result.suggestedType}, ${result.table.rows.length} rows, ${result.table.headers.length} columns, warnings [${(result.warnings || []).map((w) => w.code).join(", ")}]`
      );

      // loadExtractedTable raises the success toast; nothing else speaks here
      const loaded = gb.loadExtractedTable(result);
      logInfo(`hand-off to Graph Builder: ${loaded ? "loaded" : "refused"}`);
      if (!loaded) {
        outcome = "hand-off refused";
        toasts.error(MESSAGE.UNREADABLE);
        return;
      }
      showAccepted(result);
      syncOriginalHolders();
      outcome = "loaded";
    } catch (error) {
      failure = error;
      if (stopRequested) {
        stopQuietly();
      } else {
        logError(`extraction failed: ${error && error.message}`);
        toasts.error(describeError(error));
      }
    } finally {
      logInfo(`done in ${Math.round(performance.now() - startedAt)} ms (${outcome})`);
      running = false;
      activeEmbed = null;
      // Read from this run's embed before it goes: success, refusal, error and Stop all reach here once a send began
      if (sent) showDevInfo(embed, reply, failure);
      const container = byId(ID.EMBED_OUTPUT);
      if (container) container.textContent = "";
      refreshControls();
      endProgress();
    }
  }

  // ============================================
  // PRESELECTING THE SUGGESTED TYPE
  // ============================================

  /** When the person reaches the chart-type screen, select the model's suggestion if it is on offer. */
  function preselectSuggestedType() {
    const extraction = window.GraphBuilder && window.GraphBuilder._state && window.GraphBuilder._state.imageExtraction;
    const type = extraction && extraction.suggestedType;
    if (!type) return;

    const option = document.querySelector(`.gb-chart-option[data-chart-type="${type}"]`);
    if (!option || option.disabled || option.style.display === "none") return;
    if (option.getAttribute("aria-pressed") === "true") return;

    // The controller's own selection path: it sets the controller's state as well as the screen's, and
    // raises the same "Selected …" cue a click would
    const gb = controller();
    if (gb && typeof gb.selectChartType === "function") gb.selectChartType(option);
  }

  // ============================================
  // WIRING
  // ============================================

  function onFileChange() {
    const input = byId(ID.INPUT);
    const file = input && input.files && input.files[0];
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      input.value = "";
      const toasts = notifications();
      if (toasts) toasts.error(MESSAGE.BAD_TYPE);
    }
    // A change event is a new choice, so the image is always replaced
    const chosen = input && input.files && input.files[0];
    if (chosen) setOriginal(chosen);
    else clearOriginal();
    refreshControls();
  }

  /**
   * Put a file into the file input and let the ordinary change handler do the rest (type check, original
   * image, Extract button). Raises the one "added" toast when the file was accepted; a refused file has
   * already had its own error toast from onFileChange.
   */
  function chooseFile(file) {
    const input = byId(ID.INPUT);
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const toasts = notifications();
    if (toasts && input.files && input.files[0]) toasts.success(MESSAGE.ADDED);
  }

  /** True when the focused element takes typed text, so a paste there belongs to it. */
  function focusIsInTextEntry() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
    return el.tagName === "INPUT" && !NON_TEXT_INPUT_TYPES.includes((el.getAttribute("type") || "text").toLowerCase());
  }

  /** Stand aside unless the image panel can actually be seen (tool, screen and tab all showing). */
  function panelIsShowing() {
    const panel = byId(ID.PANEL);
    return !!(panel && panel.checkVisibility());
  }

  function onPaste(event) {
    // Nothing is looked up before init, so a paste elsewhere in the page costs no document lookup
    if (!initialised || !panelIsShowing() || focusIsInTextEntry()) return;
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    const item = Array.from(items).find((entry) => entry.kind === "file" && entry.type.startsWith(IMAGE_MIME_PREFIX));
    const file = item && item.getAsFile();
    if (!file) return;
    event.preventDefault();
    chooseFile(file);
  }

  function onDropZoneDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    event.currentTarget.classList.add(DRAG_ACTIVE_CLASS);
  }

  function onDropZoneLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Only when really leaving the zone, not when moving between its children
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove(DRAG_ACTIVE_CLASS);
  }

  function onDropZoneDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove(DRAG_ACTIVE_CLASS);
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (files.length > 1) {
      const toasts = notifications();
      if (toasts) toasts.warning(MESSAGE.ONE_AT_A_TIME);
      return;
    }
    chooseFile(files[0]);
  }

  function onExtractClick(event) {
    const button = event.currentTarget;
    // aria-disabled keeps focus on the button, so the click has to be ignored here
    if (running || button.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    extract();
  }

  /** A tab switch clears the file and the loaded table (clearDataState), so the panel follows. */
  function onTabClick() {
    setTimeout(() => {
      const extraction = window.GraphBuilder && window.GraphBuilder._state && window.GraphBuilder._state.imageExtraction;
      if (!extraction) {
        clearResult();
        clearDevInfo();
      }
      followFileInput();
      refreshControls();
    }, 0);
  }

  function onNextClick() {
    // After the controller's own handler has moved to the chart-type screen
    setTimeout(preselectSuggestedType, 0);
  }

  // While the image panel is not the one showing, a provider or credentials event touches nothing: the
  // picker is refilled when the tab is opened. (The Mathpix batch-runner test counts any
  // document lookup during its drives, and these events can arrive then.)
  function onProviderOrCredentialsChanged() {
    const panel = byId(ID.PANEL);
    if (!panel || !panel.classList.contains(ACTIVE_PANEL_CLASS)) {
      return;
    }
    populatePicker();
  }

  function init() {
    if (initialised) return true;
    const input = byId(ID.INPUT);
    const select = byId(ID.MODEL);
    const button = byId(ID.EXTRACT);
    byId(ID.PANEL); // cached now, so the provider and credentials handlers never look it up
    if (!input || !select || !button) {
      logWarn("Image panel elements not found; module not initialised");
      return false;
    }

    // Price line and note are built here because tools.html is not edited for them
    if (!byId(ID.PRICE)) {
      const price = document.createElement("p");
      price.id = ID.PRICE;
      price.className = "gb-help-text";
      select.insertAdjacentElement("afterend", price);
      select.setAttribute("aria-describedby", ID.PRICE);
    }
    if (!byId(ID.NOTE)) {
      const note = document.createElement("p");
      note.id = ID.NOTE;
      note.className = "gb-help-text";
      note.hidden = true;
      button.insertAdjacentElement("afterend", note);
    }

    byId(ID.FILE_NAME); // cached now, so a file choice never looks it up
    input.addEventListener("change", onFileChange);
    const zone = byId(ID.DROP_ZONE);
    if (zone) {
      zone.addEventListener("dragenter", onDropZoneDrag);
      zone.addEventListener("dragover", onDropZoneDrag);
      zone.addEventListener("dragleave", onDropZoneLeave);
      zone.addEventListener("drop", onDropZoneDrop);
    }
    document.addEventListener("paste", onPaste);
    select.addEventListener("change", () => {
      refreshPrice();
      refreshControls();
    });
    button.addEventListener("click", onExtractClick);
    const stop = byId(ID.STOP);
    if (stop) stop.addEventListener("click", onStopClick);
    byId(ID.PROGRESS); // cached now, so a run never looks them up mid-flight
    byId(ID.PROGRESS_TEXT);
    TAB_IDS.forEach((id) => {
      const tab = byId(id);
      if (tab) tab.addEventListener("click", onTabClick);
    });
    const next = byId(ID.NEXT);
    if (next) next.addEventListener("click", onNextClick);
    // "Create another chart" resets Graph Builder to the form tab without a tab click
    const another = byId(ID.CREATE_ANOTHER);
    if (another) another.addEventListener("click", onTabClick);

    window.addEventListener("provider:changed", onProviderOrCredentialsChanged);
    window.addEventListener("credentials:changed", onProviderOrCredentialsChanged);

    devPanel = createDevPanel();
    initialised = true;
    populatePicker();
    logInfo("Initialised");
    return true;
  }

  // The model registry and embed can arrive after the DOM: the picker is re-filled whenever the tab is opened
  function onImageTabClick() {
    populatePicker();
  }

  function start() {
    if (!init()) return;
    const tab = byId("gb-tab-image");
    if (tab) tab.addEventListener("click", onImageTabClick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    init,
    populatePicker,
    refreshControls,
    extract,
  };
})();

// Attach to window
window.GraphBuilderImage = GraphBuilderImage;
