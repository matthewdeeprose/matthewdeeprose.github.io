/**
 * MathPix Image Recreate (FI-9): make a new picture with an image model and put it in place of
 * one in the Image Manager, through the manager's own Replace path.
 *
 * Adds a global `recreateImage(id)` for the card's Recreate button. One UniversalModal per open,
 * opened over the manager. Uses window.OpenRouterEmbedImage exactly as the Make an image tool
 * does (generate() never rejects; never the shared OpenRouter client). The existing alt text,
 * title, long description and decorative flag are KEPT by the swap, by design; the card says so.
 *
 * FI-10: a second route, "Drawing". A text model writes the picture as TikZ through the TikZ
 * tool's own adapter (window.TikzStudioLLM.generate with TikzStudioController.trialRender), and
 * the drawing is handed to the same Use this picture path as a white-backed PNG.
 *
 * Every global is resolved at call time, never cached at load.
 *
 * @version 1.1.0 (FI-10)
 * @date 22 November 2026
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
      console.error(`[ImageRecreate ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageRecreate WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageRecreate INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageRecreate DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const PROVIDER = Object.freeze({
    OPENROUTER: "openrouter",
    FOUNDRY: "azure-openai",
  });

  const PROVIDER_CHANGED_EVENT = "provider:changed";
  const DIALOG_CLASS = "image-recreate-dialog";
  const ID_PREFIX = "image-recreate-";
  const RECREATE_BTN_SELECTOR = ".image-manager-recreate-btn";
  const NOTE_CLASS = "image-manager-recreate-note";
  const FOUNDRY_CREDIT_TEXT = "Foundry credit";
  const COST_NOT_REPORTED_TEXT = "cost not reported";
  const SQUARE_SHAPE_ID = "square";
  const NO_PROMPT_FALLBACK = "";
  // Used only when the Make an image tool (window.ImageMaker) has not loaded.
  const PRICE_CHECK_FALLBACK_USD = 0.1;

  // FI-9c: the made file takes the original picture's name and type. The name used when the
  // original's name is not known is the one the file always had.
  const FALLBACK_FILE_BASE = "recreated-image";
  // JPEG quality for a made picture that replaces a JPEG (the canvas default is 0.92 and unstated).
  const REENCODE_QUALITY = 0.9;
  const REENCODE_BACKGROUND = "#ffffff"; // JPEG has no transparency; a clear PNG is flattened on white
  const MIME_BY_EXTENSION = Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  });

  // The shape of setup-tool.js `announceAfterModalClose` (350 ms): a polite write that lands in
  // the same moment as the post-close focus move is dropped, so the line waits.
  const ANNOUNCE_AFTER_CLOSE_DELAY_MS = 350;
  const CLOSING_LINE_VISIBLE_MS = 3000; // the manager's own auto-hide for a success line

  // Shape labels, worded as the Make an image tool words them.
  const SHAPE_LABEL = Object.freeze({
    square: "Square",
    "landscape-4-3": "Landscape (4:3)",
    "portrait-3-4": "Portrait (3:4)",
    "wide-16-9": "Wide (16:9)",
  });

  // Measured by FI-6 on 20 November 2026: this model chooses its own shape.
  const OWN_SHAPE_MODEL_IDS = Object.freeze(["google/gemini-3.1-flash-lite-image"]);

  // FI-10: the two ways to make the new picture. PICTURE is the image model (FI-9); DRAWING asks a
  // text model for TikZ through the TikZ tool's own adapter and turns the drawing into a PNG.
  const ROUTE = Object.freeze({ PICTURE: "picture", DRAWING: "drawing" });
  const ROUTE_NAME = `${ID_PREFIX}route`;

  // The drawing's PNG is scaled so its longer side is near this many pixels (a TikZ drawing has no
  // pixel size of its own), within these limits.
  const DRAW_PNG_LONG_SIDE_PX = 1600;
  const DRAW_PNG_MIN_SCALE = 1;
  const DRAW_PNG_MAX_SCALE = 8;

  // The cost estimate for one Drawing press (OpenRouter). The adapter's output cap is not exposed,
  // so it is restated here: MAX_OUTPUT_TOKENS in tikz-studio/tikz-studio-llm.js. The sends cap is
  // read from the adapter, with this as the figure when it cannot be.
  const DRAW_OUTPUT_TOKENS_PER_SEND = 6000;
  const DRAW_SENDS_FALLBACK = 3;
  // Input allowances, in tokens: the first send carries the prompt file, the words and the
  // picture; each later send also carries the reply before it (up to the output cap) and TeX's
  // problems with it.
  const DRAW_FIRST_INPUT_TOKENS = 4000;
  const DRAW_RETRY_EXTRA_INPUT_TOKENS = 1500;
  const TOKENS_PER_MILLION = 1000000; // the registry's prices are US dollars per million tokens
  // What one Drawing press usually costs on OpenRouter, in US dollars, review round included (FI-12).
  // MEASURED by FI-11 on 22 November 2026 on google/gemini-4-argon: the median first drawing of six
  // pictures was $0.0156 (range $0.0075 to $0.0336) and the median review round of twelve was
  // $0.0100 (range $0.0052 to $0.0198), so $0.0156 + $0.0100. FI-10's two earlier presses, with no
  // review, cost $0.0172 and $0.0201. The ceiling above is the three-sends worst case; this is the
  // usual. The review's input allowance is covered: the second send is allowed 11,500 input tokens
  // and the largest review FI-11 measured used 9,302.
  const DRAW_FIRST_DRAWING_USUAL_USD = 0.0156;
  const DRAW_REVIEW_USUAL_USD = 0.01;
  const DRAW_USUAL_USD = DRAW_FIRST_DRAWING_USUAL_USD + DRAW_REVIEW_USUAL_USD;

  const TEXT = Object.freeze({
    TITLE: "Recreate picture",
    MAKING: "Making the picture…",
    DRAWING: "Drawing the picture…",
    DRAWING_AGAIN: "Drawing the picture… The first drawing did not work, so it is being drawn again.",
    DRAWING_CHECKING: "Drawing the picture… Checking the drawing against the original.",
    ROUTE_LEGEND: "How to make it",
    ROUTE_PICTURE: "Picture, from an image model",
    ROUTE_DRAWING: "Drawing, as TikZ. Best for diagrams.",
    DRAW_NOT_AVAILABLE: "The drawing tool could not start, so nothing was sent.",
    DRAW_FAILED: "The drawing could not be made.",
    DRAW_CONFIRM_TITLE: "Make this drawing?",
    DRAW_COST_UNKNOWN: "The cost of one press is not known.",
    CANCELLED: "Cancelled. Nothing was changed.",
    GUIDE_LABEL: "Use the current picture as a guide",
    GUIDE_REASON: "This model has not been shown to follow a guide picture.",
    NO_MODELS: "No image model is available for this provider.",
    PROVIDER_CHANGED: "The provider was changed, so this dialog was closed and nothing was sent.",
    NOT_AVAILABLE: "Recreate is not available: the image tools have not loaded.",
    USE_FAILED: "The new picture could not be put in place. Nothing was changed.",
    KEPT_ALT_NOTE: "The alt text was kept. Check it still matches the new picture.",
    NO_MANAGER: "Recreate is not available: the Image Manager has not loaded.",
    SWAP_FALLBACK_LINE: "Image replaced.",
    CONFIRM_TITLE: "Make this image?",
    NO_PREVIEW: "No preview available.",
    TIKZ_COPIED: "TikZ code copied.",
    TIKZ_COPY_FAILED: "The TikZ code could not be copied.",
  });

  // The lines clearMaking may take down: the one spoken line of a press, on either route.
  const MAKING_LINES = Object.freeze([TEXT.MAKING, TEXT.DRAWING]);

  // FI-9d: the long description shows more of itself. Measured: 8 rows is 154px, shorter than
  // the 200px the shared textarea rules gave before, so 14.
  const PROMPT_ROWS = 14;

  const SHAPE_NOTE = Object.freeze({
    SQUARE_ONLY: "This model makes square pictures only.",
    OWN_SHAPE: "This model may choose its own shape.",
  });

  // ============================================================================
  // STATE
  // ============================================================================

  // One dialog at a time. Null when none is open.
  let session = null;

  // ============================================================================
  // HELPERS
  // ============================================================================

  function manager() {
    const api = window.MathPixImageManagerUI;
    return api && typeof api.getInstance === "function" ? api.getInstance() : null;
  }

  function embedImage() {
    return window.OpenRouterEmbedImage || null;
  }

  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.getActive !== "function") return null;
    return switcher.getActive();
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function escapeAttr(value) {
    return escapeHTML(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatPrice(usd) {
    return `$${usd.toFixed(2)}`;
  }

  function formatCost(usd) {
    return `$${usd.toFixed(3)}`;
  }

  function byId(suffix) {
    return document.getElementById(ID_PREFIX + suffix);
  }

  function say(kind, message, options) {
    const fn = window[kind];
    if (typeof fn === "function") fn(message, options);
    else logWarn(`${kind} is not available; this line is not spoken:`, message);
  }

  /** The price at or above which a picture is confirmed: the Make an image tool's own figure. */
  function priceCheckUsd() {
    const maker = window.ImageMaker;
    return maker && typeof maker.PRICE_CHECK_USD === "number" ? maker.PRICE_CHECK_USD : PRICE_CHECK_FALLBACK_USD;
  }

  /** The measured price of a model from either list shape, or null when it has none. */
  function usdOf(m) {
    if (typeof m.usdPerImage === "number") return m.usdPerImage;
    return m.estimate && typeof m.estimate.usdPerImage === "number" ? m.estimate.usdPerImage : null;
  }

  /**
   * The models on offer. Read from the Make an image tool's own list when it has loaded, so the
   * two tools cannot drift apart (that list already drops an OpenRouter model with no measured
   * price). When it has not loaded, this file applies the same rule to the embed module's list.
   */
  function listModels() {
    const maker = window.ImageMaker;
    let source;
    if (maker && typeof maker.listModels === "function") {
      source = maker.listModels();
    } else {
      const embed = embedImage();
      if (!embed || typeof embed.listModels !== "function") return [];
      source = embed.listModels();
      if (activeProvider() === PROVIDER.OPENROUTER) source = source.filter((m) => usdOf(m) !== null);
    }
    return source.map((m) => {
      const usd = usdOf(m);
      return {
        id: m.id,
        displayName: m.displayName,
        usdPerImage: usd,
        // FI-9f: the name only. The price is in the cost line under the select, built from usdPerImage.
        label: m.displayName,
        acceptsReference: m.acceptsReference === true,
        shapes: Array.isArray(m.shapes) && m.shapes.length > 0 ? m.shapes.slice() : [SQUARE_SHAPE_ID],
        shapeNote: shapeNoteFor(m),
        costIsCredit: usd === null,
        needsPriceCheck: usd !== null && usd >= priceCheckUsd(),
      };
    });
  }

  /** The price question, worded as the Make an image tool words it. Resolves false on No. */
  async function confirmPrice(model) {
    if (!model.needsPriceCheck) return true;
    const confirm = window.safeConfirm;
    if (typeof confirm !== "function") return true;
    const maker = window.ImageMaker;
    const price = maker && typeof maker.formatPrice === "function" ? maker.formatPrice(model.usdPerImage) : formatPrice(model.usdPerImage);
    return confirm(`${model.displayName} costs about ${price} for each image. Make this image?`, TEXT.CONFIRM_TITLE, {
      // The confirm opens over this dialog, so focus goes back to its Make button, never <body>.
      returnFocusTo: () => byId("make"),
    });
  }

  // --------------------------------------------------------------------------
  // The Drawing route (FI-10)
  // --------------------------------------------------------------------------

  /** The TikZ tool's adapter and controller, or null when either has not loaded. */
  function drawTools() {
    const llm = window.TikzStudioLLM;
    const controller = window.TikzStudioController;
    if (!llm || typeof llm.generate !== "function") return null;
    if (!controller || typeof controller.initKit !== "function" || typeof controller.trialRender !== "function") return null;
    return { llm, controller };
  }

  /** How many sends one press may make: the adapter's own cap. */
  function drawSendsCap() {
    const llm = window.TikzStudioLLM;
    return llm && typeof llm.MAX_SENDS_PER_PRESS === "number" ? llm.MAX_SENDS_PER_PRESS : DRAW_SENDS_FALLBACK;
  }

  /**
   * The most one Drawing press should cost on OpenRouter, in US dollars, or null when it cannot be
   * worked out. Built from the registry's prices for the adapter's two drawing models and the
   * adapter's caps: every send is taken to use the whole output cap; the first send goes to the
   * first model and each later one is priced at the dearer of the two.
   */
  function drawEstimateUsd() {
    const llm = window.TikzStudioLLM;
    const registry = window.modelRegistry;
    const pair = llm && llm.DRAW_MODEL_BY_PROVIDER && llm.DRAW_MODEL_BY_PROVIDER[PROVIDER.OPENROUTER];
    if (!pair || !registry || typeof registry.getModel !== "function") return null;

    const prices = [pair.first, pair.better].filter(Boolean).map((id) => {
      const model = registry.getModel(id);
      const costs = model && model.costs;
      return costs && typeof costs.input === "number" && typeof costs.output === "number" ? costs : null;
    });
    if (prices.length === 0 || prices.includes(null)) return null;

    const dearestInput = Math.max(...prices.map((p) => p.input));
    const dearestOutput = Math.max(...prices.map((p) => p.output));
    let usd = 0;
    for (let send = 1; send <= drawSendsCap(); send += 1) {
      const inputTokens = DRAW_FIRST_INPUT_TOKENS + (send - 1) * (DRAW_OUTPUT_TOKENS_PER_SEND + DRAW_RETRY_EXTRA_INPUT_TOKENS);
      const inputPrice = send === 1 ? prices[0].input : dearestInput;
      const outputPrice = send === 1 ? prices[0].output : dearestOutput;
      usd += (inputTokens * inputPrice + DRAW_OUTPUT_TOKENS_PER_SEND * outputPrice) / TOKENS_PER_MILLION;
    }
    return usd;
  }

  /** The Drawing route's cost line for a provider. */
  function drawCostText(provider) {
    if (provider !== PROVIDER.OPENROUTER) return FOUNDRY_CREDIT_TEXT;
    const usd = drawEstimateUsd();
    if (usd === null) return TEXT.DRAW_COST_UNKNOWN;
    if (!usualBelow(usd)) return `Up to about ${formatPrice(usd)} for one press (estimated, up to ${drawSendsCap()} tries)`;
    return `Usually about ${formatPrice(DRAW_USUAL_USD)} for one press. Up to about ${formatPrice(usd)} if it takes ${drawSendsCap()} tries. (estimated)`;
  }

  /** True when the usual figure is below the ceiling, so it can be shown beside it. */
  function usualBelow(ceilingUsd) {
    return DRAW_USUAL_USD < ceilingUsd;
  }

  /** The Drawing result line's cost, for a ceiling. */
  function drawResultCostText(usd) {
    if (!usualBelow(usd)) return `up to about ${formatPrice(usd)} (estimated)`;
    return `usually about ${formatPrice(DRAW_USUAL_USD)}, up to about ${formatPrice(usd)} (estimated)`;
  }

  /** What the Drawing route sends, in plain words. */
  function drawExplainText(hasPicture) {
    const sent = hasPicture
      ? "It is sent your prompt and the current picture."
      : "It is sent your prompt only, because the current picture could not be read.";
    // With a picture the model also checks its drawing once against it (FI-12); with words only no review runs.
    const checks = hasPicture ? ", checks it once against the current picture," : "";
    return `A text model writes the drawing as TikZ${checks} and it is turned into a picture. ${sent} Up to ${drawSendsCap()} tries.`;
  }

  /** The price question for a drawing. Resolves false on No. */
  function confirmDrawing(usd) {
    const confirm = window.safeConfirm;
    if (typeof confirm !== "function") return Promise.resolve(true);
    const question = usualBelow(usd)
      ? `A drawing usually costs about ${formatPrice(DRAW_USUAL_USD)}, and up to about ${formatPrice(usd)} if it takes ${drawSendsCap()} tries. Make this drawing?`
      : `A drawing costs up to about ${formatPrice(usd)} for one press. Make this drawing?`;
    return confirm(question, TEXT.DRAW_CONFIRM_TITLE, {
      returnFocusTo: () => byId("make"),
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  /** The current picture as a data URL for the drawing model, or null when it cannot be read. */
  async function currentDataUrl(entry) {
    if (entry && typeof entry.dataUri === "string" && entry.dataUri.startsWith("data:image/")) return entry.dataUri;
    const blob = await currentBlob(entry);
    return blob ? blobToDataUrl(blob) : null;
  }

  /**
   * The drawing as a PNG in the shape the Picture route's result has, so Use this picture runs one
   * path for both. The background is white and said outright: a TikZ drawing is lines on nothing,
   * which cannot be seen on a dark page and turns black as a JPEG.
   */
  async function drawingToImage(svg) {
    const png = window.TikzKitPng;
    let scale = DRAW_PNG_MIN_SCALE;
    try {
      const size = png.svgSize(svg);
      const wanted = DRAW_PNG_LONG_SIDE_PX / Math.max(size.w, size.h);
      scale = Math.min(DRAW_PNG_MAX_SCALE, Math.max(DRAW_PNG_MIN_SCALE, wanted));
    } catch (error) {
      logWarn("The drawing's size could not be read; using the smallest scale:", error);
    }
    const blob = await png.toPng(svg, { scale, background: REENCODE_BACKGROUND });
    const url = await blobToDataUrl(blob);
    return url ? { image_url: { url } } : null;
  }

  function chosenRoute() {
    const drawing = byId("route-drawing");
    return drawing && drawing.checked ? ROUTE.DRAWING : ROUTE.PICTURE;
  }

  /** Show the chosen route's controls and hide the other's. Nothing is moved and nothing is said. */
  function refreshRoute() {
    if (!session) return;
    const drawing = chosenRoute() === ROUTE.DRAWING;
    byId("picture-controls").hidden = drawing;
    byId("drawing-controls").hidden = !drawing;
    if (drawing) byId("draw-cost-line").textContent = drawCostText(session.provider);
  }

  function shapeNoteFor(model) {
    if (OWN_SHAPE_MODEL_IDS.includes(model.id)) return SHAPE_NOTE.OWN_SHAPE;
    const shapes = model.shapes || [];
    return shapes.length === 1 && shapes[0] === SQUARE_SHAPE_ID ? SHAPE_NOTE.SQUARE_ONLY : "";
  }

  /** The card's Recreate button for an image, or a control on that same card, or null. */
  function focusTargetFor(imageId) {
    const escaped = window.CSS && CSS.escape ? CSS.escape(imageId) : imageId;
    const card = document.querySelector(`.image-manager-card[data-image-id="${escaped}"]`);
    if (!card) return null;
    return (
      card.querySelector(RECREATE_BTN_SELECTOR) ||
      card.querySelector(".image-manager-alt-btn") ||
      card.querySelector("button")
    );
  }

  /** The picture to send as a guide: the registry's own bytes. Null when there are none. */
  async function currentBlob(entry) {
    if (entry && entry.blob instanceof Blob) return entry.blob;
    if (entry && typeof entry.dataUri === "string" && entry.dataUri.startsWith("data:")) {
      try {
        const response = await fetch(entry.dataUri);
        return await response.blob();
      } catch (error) {
        logWarn("Could not read the current picture as a blob:", error);
      }
    }
    return null;
  }

  function extensionOf(image) {
    const url = image && image.image_url && image.image_url.url;
    const match = typeof url === "string" ? /^data:image\/([a-z0-9]+)/i.exec(url) : null;
    return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "png";
  }

  /**
   * The original picture's file name (no folder), read from the session's own filename map. The
   * image registry holds no file name, so the map is the only source. Null when it is not known.
   */
  function originalFileName(mgr, imageId) {
    const map = mgr && mgr.restorer && mgr.restorer.imageFilenameMap;
    const named = map && map[imageId] && map[imageId].filename;
    return typeof named === "string" && named ? named.split("/").pop() : null;
  }

  /** Draw a data URL onto a canvas and encode it as `mime`; null if the browser cannot. */
  function encodeAs(url, mime) {
    return new Promise((resolve) => {
      const probe = new window.Image();
      probe.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = probe.naturalWidth;
        canvas.height = probe.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }
        if (mime === "image/jpeg") {
          context.fillStyle = REENCODE_BACKGROUND;
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(probe, 0, 0);
        const encoded = canvas.toDataURL(mime, REENCODE_QUALITY);
        // toDataURL falls back to PNG for a type it cannot write, so the result is checked.
        resolve(encoded.startsWith(`data:${mime}`) ? encoded : null);
      };
      probe.onerror = () => resolve(null);
      probe.src = url;
    });
  }

  /**
   * The made picture and the name it is handed over under, so that the name, the extension and the
   * bytes agree. A picture already of the original's type keeps its bytes; otherwise it is
   * re-encoded to that type. If it cannot be, the original's base name is kept with the made
   * picture's own extension.
   */
  async function keepNameAndType(image, original) {
    const extension = (/\.([a-z0-9]+)$/i.exec(original) || [])[1];
    const wanted = extension ? MIME_BY_EXTENSION[extension.toLowerCase()] : null;
    const base = original.replace(/\.[^.]+$/, "");
    const url = image.image_url.url;
    const have = /^data:(image\/[a-z0-9.+-]+)/i.exec(url);
    if (wanted && have && have[1].toLowerCase() === wanted) return { image, name: original };

    const encoded = wanted ? await encodeAs(url, wanted) : null;
    if (encoded) return { image: { image_url: { url: encoded } }, name: original };
    return { image, name: `${base}.${extensionOf(image)}` };
  }

  function imageSize(image) {
    return new Promise((resolve) => {
      const url = image && image.image_url && image.image_url.url;
      const probe = new window.Image();
      probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve(null);
      probe.src = url;
    });
  }

  // ============================================================================
  // THE DIALOG
  // ============================================================================

  /** The current picture's address, resolved as the manager's own card resolves it. */
  function currentSrc(entry) {
    const mgr = manager();
    if (mgr && typeof mgr._getImageSrc === "function") return mgr._getImageSrc(entry);
    return entry.dataUri || null;
  }

  function buildContent(entry, models, promptStart) {
    const modelOptions = models
      .map((m) => `<option value="${escapeAttr(m.id)}">${escapeHTML(m.label)}</option>`)
      .join("");
    const styles = (embedImage().styles || [])
      .map((s) => `<option value="${escapeAttr(s.id)}">${escapeHTML(s.label)}</option>`)
      .join("");
    // FI-9f: the intro names the file as the card does (FI-9c), and the id only when no name is known.
    const shownName = originalFileName(manager(), entry.id) || entry.id;
    // Alt "" because the current alt text is printed in the form beside it.
    const src = currentSrc(entry);
    const preview = src
      ? `<img id="${ID_PREFIX}current" src="${escapeAttr(src)}" alt="" />`
      : `<p class="image-recreate-hint">${escapeHTML(TEXT.NO_PREVIEW)}</p>`;

    // FI-9d: two children, the form then the pictures. main.css sets them side by side from 48rem
    // up and stacks them below it; the source order is the reading and tab order in both.
    return `
      <div class="image-recreate-body">
       <div class="image-recreate-columns">
        <div class="image-recreate-form">
        <p id="${ID_PREFIX}intro">Recreating <strong>${escapeHTML(shownName)}</strong>. The alt text, caption and long description stay as they are.</p>
        <div class="image-recreate-current">
          <p><span class="image-recreate-current-label">Current alt text:</span> ${escapeHTML(entry.altText || "none")}</p>
        </div>
        <fieldset class="image-recreate-route">
          <legend>${escapeHTML(TEXT.ROUTE_LEGEND)}</legend>
          <div>
            <input type="radio" name="${ROUTE_NAME}" id="${ID_PREFIX}route-picture" value="${ROUTE.PICTURE}" checked />
            <label for="${ID_PREFIX}route-picture">${escapeHTML(TEXT.ROUTE_PICTURE)}</label>
          </div>
          <div>
            <input type="radio" name="${ROUTE_NAME}" id="${ID_PREFIX}route-drawing" value="${ROUTE.DRAWING}" />
            <label for="${ID_PREFIX}route-drawing">${escapeHTML(TEXT.ROUTE_DRAWING)}</label>
          </div>
        </fieldset>
        <div class="image-recreate-field">
          <label for="${ID_PREFIX}prompt">Prompt</label>
          <textarea id="${ID_PREFIX}prompt" rows="${PROMPT_ROWS}">${escapeHTML(promptStart)}</textarea>
        </div>
        <div id="${ID_PREFIX}picture-controls">
        <div class="image-recreate-field">
          <label for="${ID_PREFIX}model">Model</label>
          <select id="${ID_PREFIX}model">${modelOptions}</select>
        </div>
        <div class="image-recreate-field">
          <label for="${ID_PREFIX}style">Style</label>
          <select id="${ID_PREFIX}style">${styles}</select>
        </div>
        <div class="image-recreate-field">
          <label for="${ID_PREFIX}shape">Shape</label>
          <select id="${ID_PREFIX}shape"></select>
          <p id="${ID_PREFIX}shape-note" class="image-recreate-hint" hidden></p>
        </div>
        <div class="image-recreate-field">
          <label for="${ID_PREFIX}guide">
            <input type="checkbox" id="${ID_PREFIX}guide" aria-describedby="${ID_PREFIX}guide-reason" />
            ${escapeHTML(TEXT.GUIDE_LABEL)}
          </label>
          <p id="${ID_PREFIX}guide-reason" class="image-recreate-hint"></p>
        </div>
        <p id="${ID_PREFIX}cost-line" class="image-recreate-hint"></p>
        </div>
        <div id="${ID_PREFIX}drawing-controls" hidden>
          <p id="${ID_PREFIX}draw-explain" class="image-recreate-hint">${escapeHTML(drawExplainText(true))}</p>
          <p id="${ID_PREFIX}draw-cost-line" class="image-recreate-hint"></p>
        </div>
        <div class="image-recreate-actions">
          <button type="button" id="${ID_PREFIX}make" class="image-manager-btn">Make</button>
          <button type="button" id="${ID_PREFIX}cancel" class="image-manager-btn" aria-disabled="true">Cancel</button>
        </div>
        <p id="${ID_PREFIX}busy" class="image-recreate-hint" hidden>${escapeHTML(TEXT.MAKING)}</p>
        </div>
        <div class="image-recreate-pictures">
        <section class="image-recreate-picture" aria-labelledby="${ID_PREFIX}current-heading">
          <h2 id="${ID_PREFIX}current-heading">Current picture</h2>
          ${preview}
        </section>
        <section id="${ID_PREFIX}result" class="image-recreate-result" hidden aria-labelledby="${ID_PREFIX}result-heading">
          <h2 id="${ID_PREFIX}result-heading" tabindex="-1">New picture</h2>
          <img id="${ID_PREFIX}result-img" alt="The new picture, not yet described" />
          <p id="${ID_PREFIX}result-meta"></p>
          <div class="image-recreate-actions">
            <button type="button" id="${ID_PREFIX}use" class="image-manager-btn">Use this picture</button>
            <button type="button" id="${ID_PREFIX}again" class="image-manager-btn">Try again</button>
            <button type="button" id="${ID_PREFIX}copy-tikz" class="image-manager-btn" hidden>Copy TikZ code</button>
          </div>
        </section>
        </div>
       </div>
      </div>`;
  }

  /** Show only what the chosen model can do: its shapes, the guide, the cost. */
  function refreshModelControls(models) {
    const select = byId("model");
    const model = models.find((m) => m.id === select.value) || null;

    const shapeSelect = byId("shape");
    const previous = shapeSelect.value;
    const shapes = model ? model.shapes : [SQUARE_SHAPE_ID];
    shapeSelect.innerHTML = shapes
      .map((id) => `<option value="${escapeAttr(id)}">${escapeHTML(SHAPE_LABEL[id] || id)}</option>`)
      .join("");
    shapeSelect.value = shapes.includes(previous) ? previous : shapes[0];

    const note = model ? model.shapeNote : "";
    const noteEl = byId("shape-note");
    noteEl.textContent = note;
    noteEl.hidden = note === "";

    const guide = byId("guide");
    const reason = byId("guide-reason");
    const accepts = !!(model && model.acceptsReference);
    guide.disabled = !accepts;
    if (!accepts) guide.checked = false;
    reason.textContent = accepts ? "" : TEXT.GUIDE_REASON;
    reason.hidden = accepts;

    // FI-9f: built from the price itself, never parsed back out of the option label.
    byId("cost-line").textContent = !model
      ? ""
      : model.costIsCredit
        ? FOUNDRY_CREDIT_TEXT
        : `About ${formatPrice(model.usdPerImage)} per image (measured)`;
  }

  function setRunning(running) {
    if (!session) return;
    const make = byId("make");
    const cancel = byId("cancel");
    const busy = byId("busy");
    if (!make || !cancel || !busy) return;
    session.running = running;
    // The focused control is never disabled: aria-busy plus the re-entry flag instead.
    if (running) make.setAttribute("aria-busy", "true");
    else make.removeAttribute("aria-busy");
    if (running) cancel.removeAttribute("aria-disabled");
    else cancel.setAttribute("aria-disabled", "true");
    busy.hidden = !running;
  }

  /**
   * FI-9f: take the "Making the picture…" line out of this dialog's status area when the request
   * ends (result, error or cancel). It is raised with no auto-hide, so it lasts exactly as long as
   * the request. Only that line, and only in this dialog: another message, or a status area that
   * is not the top modal's, is left alone. Hiding empties the text, so nothing new is spoken.
   */
  function clearMaking(s) {
    const modalApi = window.UniversalModal;
    const root = s.instance && s.instance.modal;
    const area = root && root.querySelector(".universal-modal-status");
    const text = area && area.querySelector(".universal-modal-status-text");
    if (!text || !MAKING_LINES.includes(text.textContent.trim())) return;
    if (!modalApi || typeof modalApi.hideStatus !== "function" || typeof modalApi.getCurrentModalId !== "function") return;
    if (area.id !== `${modalApi.getCurrentModalId()}-status`) return;
    modalApi.hideStatus();
  }

  /**
   * FI-10: wait for an answered price question to leave before the press starts. safeConfirm
   * resolves while its dialog is still closing (200 ms with animations on), and for that time a
   * status line is written into the confirm's own status area and goes with it, and the confirm's
   * focus restore lands after a quick result's focus move. Measured on the build before this: the
   * making line was lost that way. Everything a press says or focuses comes after this wait.
   */
  function confirmGone() {
    return new Promise((resolve) => window.setTimeout(resolve, ANNOUNCE_AFTER_CLOSE_DELAY_MS));
  }

  /** FI-15: keep (or drop) the TikZ code of the shown result; the Copy button is there only while there is code. */
  function setDrawSource(s, source) {
    s.drawSource = typeof source === "string" && source.trim() ? source : null;
    const button = byId("copy-tikz");
    if (button) button.hidden = !s.drawSource;
  }

  /** FI-15: copy the shown drawing's TikZ code. One toast line says what happened; nothing else speaks. */
  async function onCopyTikz() {
    const s = session;
    if (!s || !s.drawSource) return;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(s.drawSource);
        copied = true;
      }
    } catch (error) {
      logWarn("The TikZ code could not be copied:", error);
    }
    if (copied) say("notifySuccess", TEXT.TIKZ_COPIED);
    else say("notifyError", TEXT.TIKZ_COPY_FAILED, { duration: 0 });
  }

  /** Put the outcome of a press on screen and move focus to "New picture" (both routes). */
  async function showResult(s, outcome, costText, drawSource) {
    byId("busy").hidden = true;
    s.result = outcome;
    const image = outcome.images[0];
    const size = await imageSize(image);
    if (session !== s || !byId("make")) return;

    const sizeText = size ? `${size.width} × ${size.height} pixels` : "size not known";
    byId("result-img").src = image.image_url.url;
    byId("result-meta").textContent = `${sizeText}. Cost: ${costText}.`;
    setDrawSource(s, drawSource);
    byId("result").hidden = false;
    byId("result-heading").focus();
  }

  /**
   * FI-10: one press of Make on the Drawing route. The TikZ tool's adapter writes the drawing (up
   * to its own cap of sends, each one trial-rendered), and the drawing becomes a white-backed PNG
   * in the same shape the Picture route's result has. One line is spoken for the whole press.
   */
  async function onMakeDrawing() {
    const s = session;
    const tools = drawTools();
    if (!tools) {
      say("notifyError", TEXT.DRAW_NOT_AVAILABLE, { duration: 0 });
      return;
    }

    // The flag stops a second press while the engine starts and the price question is open.
    s.running = true;
    let kit = null;
    try {
      kit = await tools.controller.initKit();
    } catch (error) {
      logError("initKit rejected:", error);
    }
    if (session !== s || !byId("make")) return;
    const png = window.TikzKitPng;
    if (!kit || !png || typeof png.toPng !== "function") {
      s.running = false;
      say("notifyError", TEXT.DRAW_NOT_AVAILABLE, { duration: 0 });
      return;
    }

    // The price question, by the Picture route's own rule: asked at or above the same figure.
    const estimate = s.provider === PROVIDER.OPENROUTER ? drawEstimateUsd() : null;
    const asked = estimate !== null && estimate >= priceCheckUsd() && typeof window.safeConfirm === "function";
    const agreed = asked ? await confirmDrawing(estimate) : true;
    if (asked && agreed) await confirmGone();
    const picture = await s.pictureDataUrl;
    if (session !== s || !byId("make")) return;
    s.running = false;
    if (!agreed) return;

    s.controller = new AbortController();
    s.drawTries = 0;
    byId("busy").textContent = TEXT.DRAWING;
    setRunning(true);
    byId("result").hidden = true;
    setDrawSource(s, null);
    // Spoken once, here, for the whole press: no line per try. No auto-hide; clearMaking takes it
    // down when the press ends.
    say("notifyInfo", TEXT.DRAWING, { duration: 0 });

    // Each reply is trial-rendered through this. A drawing that does not compile changes the
    // visible busy line only: that line is plain text, not a live region, so nothing is spoken.
    const trialRender = async (source, signal) => {
      s.drawTries += 1;
      const trial = await tools.controller.trialRender(source, signal);
      const failed = !(trial && trial.ok && trial.svg);
      // A failed trial during the review is not "the first drawing did not work": the first drawing stands.
      if (failed && !reviewing && session === s && s.running && byId("busy")) byId("busy").textContent = TEXT.DRAWING_AGAIN;
      return trial;
    };

    // FI-12: the adapter checks the first drawing once against the original. Visible text only: not a live region, so nothing more is spoken.
    let reviewing = false;
    const onReview = () => {
      reviewing = true;
      if (session === s && s.running && byId("busy")) byId("busy").textContent = TEXT.DRAWING_CHECKING;
    };

    let outcome;
    try {
      outcome = await tools.llm.generate({
        words: byId("prompt").value,
        pictureDataUrl: picture || undefined,
        trialRender,
        review: true,
        onReview,
        signal: s.controller.signal,
      });
    } catch (error) {
      // generate() never rejects; a rejection here is a defect worth a line.
      logError("TikZ generate rejected:", error);
      outcome = { ok: false, message: (error && error.message) || String(error) };
    }

    // The dialog was closed or replaced while this ran: touch nothing.
    if (session !== s || !byId("make")) return;
    const cancelled = s.controller.signal.aborted;
    s.controller = null;
    setRunning(false);
    clearMaking(s);

    if (cancelled) {
      byId("busy").hidden = false;
      byId("busy").textContent = TEXT.CANCELLED;
      byId("make").focus();
      return;
    }

    let image = null;
    if (outcome && outcome.ok && outcome.svg) {
      try {
        image = await drawingToImage(outcome.svg);
      } catch (error) {
        logError("The drawing could not be turned into a picture:", error);
      }
      if (session !== s || !byId("make")) return;
    }
    if (!image) {
      const failedWell = outcome && !outcome.ok && outcome.message;
      say("notifyError", failedWell ? outcome.message : TEXT.DRAW_FAILED, { duration: 0 });
      byId("make").focus();
      return;
    }

    const costText = estimate === null ? (s.provider === PROVIDER.OPENROUTER ? COST_NOT_REPORTED_TEXT : FOUNDRY_CREDIT_TEXT) : drawResultCostText(estimate);
    await showResult(s, { ok: true, images: [image] }, costText, outcome.source);
  }

  async function onMake() {
    if (!session || session.running || session.using) return;
    if (chosenRoute() === ROUTE.DRAWING) {
      await onMakeDrawing();
      return;
    }
    const s = session;
    const models = s.models;
    const modelId = byId("model").value;
    const model = models.find((m) => m.id === modelId);
    const embed = embedImage();
    if (!model || !embed) {
      say("notifyError", TEXT.NOT_AVAILABLE, { duration: 0 });
      return;
    }

    // The price question comes first: No sends nothing. The flag stops a second press meanwhile.
    s.running = true;
    const agreed = await confirmPrice(model);
    // FI-10: only when the question was really asked and answered Yes.
    if (agreed && model.needsPriceCheck && typeof window.safeConfirm === "function") await confirmGone();
    if (session !== s || !byId("make")) return;
    s.running = false;
    if (!agreed) return;

    const request = {
      prompt: byId("prompt").value,
      styleId: byId("style").value,
      shapeId: byId("shape").value,
      model: modelId,
    };

    const guide = byId("guide");
    if (guide.checked && !guide.disabled) {
      const blob = await currentBlob(s.entry);
      if (blob) request.reference = blob;
    }

    s.controller = new AbortController();
    request.signal = s.controller.signal;
    byId("busy").textContent = TEXT.MAKING;
    setRunning(true);
    byId("result").hidden = true;
    setDrawSource(s, null);
    // Spoken once, here. No auto-hide (the info default is 4,000 ms, shorter than a real send):
    // clearMaking takes it down when the request ends.
    say("notifyInfo", TEXT.MAKING, { duration: 0 });

    let outcome;
    try {
      outcome = await embed.generate(request);
    } catch (error) {
      // generate() never rejects; a rejection here is a defect worth a line.
      logError("generate rejected:", error);
      outcome = { ok: false, error: (error && error.message) || String(error), images: [] };
    }

    // The dialog was closed or replaced while this ran: touch nothing.
    if (session !== s || !byId("make")) return;
    const cancelled = s.controller.signal.aborted;
    s.controller = null;
    setRunning(false);
    // Before any branch: an error then replaces it (a new message cancels the hide's delayed clear).
    clearMaking(s);

    if (cancelled) {
      byId("busy").hidden = false;
      byId("busy").textContent = TEXT.CANCELLED;
      byId("make").focus();
      return;
    }

    if (!outcome || !outcome.ok || !outcome.images || outcome.images.length === 0) {
      say("notifyError", (outcome && outcome.error) || "The image could not be made.", { duration: 0 });
      byId("make").focus();
      return;
    }

    const costText =
      typeof outcome.cost === "number" ? formatCost(outcome.cost) : model.costIsCredit ? FOUNDRY_CREDIT_TEXT : COST_NOT_REPORTED_TEXT;
    await showResult(s, outcome, costText);
  }

  function onCancel() {
    if (!session || !session.running || !session.controller) return;
    session.controller.abort();
  }

  async function onUse() {
    if (!session || session.using || session.running || !session.result) return;
    const s = session;
    const mgr = manager();
    if (!mgr || typeof mgr.swapFromFile !== "function") {
      say("notifyError", TEXT.NO_MANAGER, { duration: 0 });
      return;
    }

    const use = byId("use");
    s.using = true;
    use.setAttribute("aria-busy", "true");

    let file;
    try {
      const image = s.result.images[0];
      const fallbackName = `${FALLBACK_FILE_BASE}.${extensionOf(image)}`;
      const original = originalFileName(mgr, s.imageId);
      const target = original ? await keepNameAndType(image, original) : null;
      const name = target ? target.name : fallbackName;
      const toSend = target ? target.image : image;
      file = embedImage().toFile(toSend, name);
    } catch (error) {
      logError("toFile failed:", error);
      s.using = false;
      use.removeAttribute("aria-busy");
      say("notifyError", TEXT.USE_FAILED, { duration: 0 });
      return;
    }

    // The swap writes its own status lines into the top modal, which is THIS dialog, a moment
    // before it leaves (measured by FI-9: 23 to 226 ms before focus moves). Written then, they
    // are either lost to the close or spoken twice beside the line below. So this dialog's status
    // area is silenced (aria-live="off": still visible) while the swap runs, and the manager's
    // own success line is spoken ONCE, after the close and the focus restore.
    const statusEl = s.instance.modal && s.instance.modal.querySelector(".universal-modal-status-text");
    // The old value is kept so a failure puts the area back exactly as it was ("polite").
    const previousLive = statusEl ? statusEl.getAttribute("aria-live") : null;
    if (statusEl) statusEl.setAttribute("aria-live", "off");

    const outcome = await mgr.swapFromFile(s.imageId, file);
    if (session !== s) return;

    if (!outcome || !outcome.ok) {
      s.using = false;
      // The reflection property, because null removes the attribute and a value restores it.
      if (statusEl) statusEl.ariaLive = previousLive;
      if (byId("use")) byId("use").removeAttribute("aria-busy");
      say("notifyError", (outcome && outcome.error) || TEXT.USE_FAILED, { duration: 0 });
      return;
    }

    // The manager's own words for this swap, read back from the silenced area.
    const written = statusEl ? statusEl.textContent.trim() : "";
    s.closingLine = written || TEXT.SWAP_FALLBACK_LINE;
    s.used = true;
    s.instance.close();
  }

  /**
   * Speak one line once the dialog has left and focus has been restored. The status area of the
   * manager (now the top modal) is the one place that is exposed and not mid-teardown. Written
   * too soon after the focus move, a polite write is dropped, so it waits.
   */
  function speakAfterClose(line) {
    window.setTimeout(() => {
      const modalApi = window.UniversalModal;
      if (!modalApi || typeof modalApi.showStatus !== "function") {
        logWarn("UniversalModal.showStatus is unavailable; the closing line is not spoken:", line);
        return;
      }
      modalApi.showStatus(line, "success", { duration: CLOSING_LINE_VISIBLE_MS });
    }, ANNOUNCE_AFTER_CLOSE_DELAY_MS);
  }

  /** The note on the card, plain visible text and not a live region. */
  function addKeptNote(imageId) {
    const escaped = window.CSS && CSS.escape ? CSS.escape(imageId) : imageId;
    const card = document.querySelector(`.image-manager-card[data-image-id="${escaped}"]`);
    if (!card || card.querySelector(`.${NOTE_CLASS}`)) return;
    const note = document.createElement("p");
    note.className = NOTE_CLASS;
    note.textContent = TEXT.KEPT_ALT_NOTE;
    // FI-9d: in the card's text flow, straight after its details list (name, size, status). The
    // card's FIRST role="group" is the icon cluster, absolutely placed over the thumbnail, which
    // is where the note used to land.
    const meta = card.querySelector(".image-manager-meta");
    if (meta) meta.after(note);
    else card.appendChild(note);
  }

  function onClosed() {
    const s = session;
    if (!s) return;
    session = null;
    s.drawSource = null;
    window.removeEventListener(PROVIDER_CHANGED_EVENT, s.onProviderChanged);
    if (s.controller) s.controller.abort();
    if (!s.used) return;
    addKeptNote(s.imageId);
    speakAfterClose(s.closingLine);
  }

  // ============================================================================
  // ENTRY POINT
  // ============================================================================

  /**
   * Open the Recreate dialog for one image. A no-op with a logged line when it cannot.
   * @param {string} imageId - Registry image id
   */
  function recreateImage(imageId) {
    if (session) {
      logWarn("recreateImage: a dialog is already open");
      return;
    }
    const mgr = manager();
    const embed = embedImage();
    if (!mgr || !embed || !window.UniversalModal || typeof window.UniversalModal.Modal !== "function") {
      logWarn(TEXT.NOT_AVAILABLE);
      return;
    }
    const registry = mgr.restorer && mgr.restorer.imageRegistry;
    const entry = registry && registry.hasImage(imageId) ? registry.getImage(imageId) : null;
    if (!entry) {
      logWarn(`recreateImage: no image ${imageId}`);
      return;
    }

    // The provider is read once, here. A switch while the dialog is open closes it.
    const provider = activeProvider();
    if (provider !== PROVIDER.OPENROUTER && provider !== PROVIDER.FOUNDRY) {
      logWarn("recreateImage: no usable provider");
      return;
    }
    const models = listModels();
    const promptStart = (entry.longDescription && entry.longDescription.trim()) || (entry.altText && entry.altText.trim()) || NO_PROMPT_FALLBACK;

    const s = {
      imageId,
      entry,
      provider,
      models,
      instance: null,
      controller: null,
      running: false,
      using: false,
      used: false,
      closingLine: "",
      result: null,
      drawSource: null,
      onProviderChanged: null,
      // FI-10: the tries of a drawing press, and the current picture read once for the Drawing
      // route (null when it cannot be).
      drawTries: 0,
      pictureDataUrl: null,
    };
    session = s;
    s.pictureDataUrl = currentDataUrl(entry).catch((error) => {
      logWarn("The current picture could not be read for the Drawing route:", error);
      return null;
    });

    s.onProviderChanged = () => {
      if (session !== s) return;
      if (s.controller) s.controller.abort();
      s.instance.close();
      say("notifyInfo", TEXT.PROVIDER_CHANGED);
    };
    window.addEventListener(PROVIDER_CHANGED_EVENT, s.onProviderChanged);

    s.instance = new window.UniversalModal.Modal({
      title: TEXT.TITLE,
      content: buildContent(entry, models, promptStart),
      // FI-9d: the largest UniversalModal size short of fullscreen (800px; md-scripts/css/modal.css).
      size: "large",
      className: DIALOG_CLASS,
      closeOnOverlayClick: true,
      // Resolved at CLOSE time: the card is rebuilt by a swap, so the button that opened this
      // dialog may be gone by then. Falls to a control on the same card.
      returnFocusTo: () => focusTargetFor(imageId),
      onOpen: (instance) => {
        const root = instance.modal;
        if (root) root.classList.add(DIALOG_CLASS);
        if (models.length === 0) {
          say("notifyError", TEXT.NO_MODELS, { duration: 0 });
          byId("make").setAttribute("aria-disabled", "true");
          return;
        }
        byId("model").addEventListener("change", () => refreshModelControls(models));
        // FI-10: the route. Picture is checked in the markup, so every open starts there.
        byId("route-picture").addEventListener("change", refreshRoute);
        byId("route-drawing").addEventListener("change", refreshRoute);
        s.pictureDataUrl.then((url) => {
          const explain = session === s ? byId("draw-explain") : null;
          if (explain && !url) explain.textContent = drawExplainText(false);
        });
        byId("make").addEventListener("click", onMake);
        byId("cancel").addEventListener("click", onCancel);
        byId("use").addEventListener("click", onUse);
        byId("copy-tikz").addEventListener("click", onCopyTikz);
        byId("again").addEventListener("click", () => {
          byId("result").hidden = true;
          setDrawSource(s, null);
          byId("prompt").focus();
        });
        // Focus is left where the modal manager puts it: on the dialog, which names the task.
        refreshModelControls(models);
      },
      onClose: onClosed,
    });
    s.instance.open();
  }

  window.recreateImage = recreateImage;
  logInfo("MathPix Image Recreate ready");
})();
