/**
 * @file tikz-studio-ui.js
 * @description The page side of TikZ Studio: binds the markup in tools.html (every control, label, region, the skip link and
 * its target are in the HTML; this file populates and listens), runs the render/error/live-rendering behaviour on top of
 * TikzStudioController, announces through the shared announcer, and offers SVG, PNG (four sizes) and HTML download.
 *
 * Exposes `window.TikzStudio`. `init()` is called by TOOL_CONFIG["TikZ Studio"] on every switch to the tool and is idempotent;
 * it returns false on a genuine failure (the kit would not load or start), so a broken tool refuses to open rather than
 * opening with dead controls.
 *
 * ANNOUNCEMENTS. Through window.accessibilityHelpers, resolved at call time. No live region is created here. The visible
 * status line is a plain paragraph, not a live region, and the error list stays on screen until the state changes.
 *   - "Diagram rendered."  on the Render button press (every press), and on live rendering only when the state changes.
 *   - "The source has N problem(s). First: ..." on entering the error state; an identical repeat is silent, and live
 *     rendering announces only the ENTRY to the error state, never a change from one error to another, because someone
 *     typing an unfinished diagram would otherwise be interrupted at every pause.
 * Downloads use the toast system (notifySuccess / notifyError), which announces for itself.
 * Describe with AI: ONE announcement per press, through announce() alone, for the outcome (written, refused, failed or stopped).
 * The press that starts a request says nothing until it ends; the button label changes meanwhile. The same sentence stays on
 * screen in a plain paragraph. No toast, because a toast would announce too.
 * Fix with AI (P4b): the same arrangement, one announcement per press for the outcome (a fix is ready, none rendered, stopped, dropped
 * or refused). Apply fix announces nothing itself: it writes the source and runs the normal render, whose own sentence is the voice.
 * Discard says nothing. The author's source never changes without a press of Apply fix.
 * Draw with AI (P4c): the same arrangement, one announcement per press for the outcome (a drawing is ready, none rendered, stopped or
 * refused). The proposal is shown beside the author's diagram (or the picture they chose); "Use this drawing" writes the source and runs
 * the normal render, whose own sentence is the voice. Discard says nothing. The author's source never changes without that press.
 *
 * @module TikzStudio
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzStudio]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzStudio]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TikzStudio]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[TikzStudio]", message, ...args);
  }

  const C = window.TikzStudioController;
  if (!C) {
    logError("tikz-studio-controller.js must load before tikz-studio-ui.js");
    return;
  }

  // Captured while this script runs: the export facade is imported relative to it, on first use of Download HTML.
  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const SCORM_EXPORT_PATH = "../js/scorm-export/scorm-export.js";
  const TEMPLATES_PATH = "tikz-studio/templates.json";
  const SUPPORTED_PATH = "tikz-studio/supported-packages.json";

  const MESSAGES = Object.freeze({
    rendered: "Diagram rendered.",
    supportedUnavailable: "The list of packages did not load. Reload the page to try again.",
    notesRendered: "To draw this, the Studio made these changes to a copy of your source. Your own text is not changed.",
    notesFailed: "The Studio made these changes to a copy of your source and tried again. Your own text is not changed.",
    sourceEmpty: "The source is empty.",
    ready: "Ready.",
    rendering: "Rendering…",
    stopped: "Stopped.",
    changed: "The source has changed. Press Render to update the preview.",
    noPreview: "No preview: the source has problems.",
    noPreviewYet: "Press Render to see the diagram.",
    renderFirst: "Render the diagram first, then download or export it.",
    outOfDateStatus: " The drawing shown is out of date.",
    outOfDateDownload: "The drawing on screen is out of date. Fix the problems in the source, then download it.",
    outOfDateDescribe: "The drawing on screen is out of date. Fix the problems in the source, then describe it.",
    liveOff: "Render as you type is off because TeX would run on this page, where a source that loops could freeze it. Use the Render button.",
    svgDone: "SVG downloaded.",
    pngDone: "PNG downloaded.",
    htmlDone: "HTML downloaded.",
    pngSizeRender: "Render the diagram to see the size in pixels.",
    pngTooLarge: "too large for this diagram",
    templateFirst: "Choose an example first.",
    describeIdle: "Describe with AI",
    describeBusy: "Describing…",
    describeWritten: "Description written to the empty fields. It may contain mistakes, so check it against the figure.",
    describeWrittenCheck: "Description written to the empty fields. It may contain mistakes, and some numbers could not be matched to the figure, so check them first.",
    describeRaced: "Both fields were filled while the description was being written, so nothing was changed.",
    describeEmptied: "The source was emptied while the description was being written, so nothing was changed.",
    describeRenderFirst: "Render the diagram first, then describe it.",
    describeDecorative: "This figure is marked decorative, so there is nothing to describe. Untick that box first.",
    describeFull: "Both fields already have text, so nothing was sent.",
    describeUnavailable: "Describe with AI is not available on this page.",
    fixIdle: "Fix with AI",
    fixBusy: "Fixing…",
    fixRenderFirst: "The source has changed since it was last rendered. Press Render first, then fix.",
    fixUnavailable: "Fix with AI is not available on this page.",
    fixNoExplanation: "The model gave no explanation of the change.",
    emptyLine: "(empty line)",
    generateIdle: "Draw with AI",
    generateBusy: "Drawing…",
    generateMissing: "Describe the diagram you want, or choose a picture, then press Draw with AI.",
    generateReady: "A drawing is ready. It is shown beside yours, below.",
    generateBadPicture: "Choose a PNG, JPEG or WebP picture.",
    generateOnePicture: "Choose one picture at a time.",
    pictureNone: "No picture chosen",
    generatePictureUnreadable: "The picture could not be read, so nothing was sent.",
    generateUnavailable: "Draw with AI is not available on this page.",
    generateStale: "Your source has changed since this drawing was made. Using it will replace what is there now.",
    generateNoSummary: "The model gave no description of the drawing.",
    compareYourPicture: "Your picture",
    compareYourDiagram: "Your diagram now",
  });
  /** The one announcement a successful Fix with AI press makes. */
  const fixReadySentence = (changed) => "A fix is ready: " + changed + (changed === 1 ? " line" : " lines") + " changed. It is below the problems.";
  /** A picture sent to the model has its longer side scaled down to this many pixels at most (never scaled up). */
  const MAX_PICTURE_SIDE = 1024;
  const PICTURE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
  const IMAGE_MIME_PREFIX = "image/";
  const DRAG_ACTIVE_CLASS = "gb-drag-active";
  /** Input types that take typed text, so a paste into one belongs to it. Anything else (a checkbox, a button, a file input) does not. */
  const NON_TEXT_INPUT_TYPES = Object.freeze(["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"]);
  const BYTES_PER_KB = 1024;
  const BYTES_PER_MB = 1024 * 1024;
  const SVG_DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,";
  const ERROR_MESSAGE_MAX = 140;
  const LOG_MAX_CHARS = 20000;
  const PNG_DEFAULT_SCALE = 2;
  // The kit's own limit (tikz-kit-png.js MAX_CANVAS_SIDE, not exported): a longer side makes toPng refuse. Spec E7 checks the two agree.
  const PNG_MAX_SIDE = 16000;
  const PNG_SIZE_NAMES = Object.freeze({ 1: "Small", 2: "Medium", 4: "Large", 8: "Extra large" });
  const HTML_FILENAME = "tikz-figure.html";
  const URL_REVOKE_DELAY_MS = 10000;
  const FALLBACK_LINE_HEIGHT_FACTOR = 1.4;
  const DATA_CARD_MAX_COLUMNS = 6; // scorm-builder's DEFAULT_COLUMN_THRESHOLD: more columns than this scroll instead of stacking
  /** SR1: said first by a screen reader that lands on the kept drawing (or its wide-table region) while it is out of date. Name only, live DOM only. */
  const OUT_OF_DATE_NAME_PREFIX = "Out of date. ";

  const PREVIEW_COLUMN_CLASS = "tikz-studio-preview-column";
  const COLUMN_TOP_PROPERTY = "--tikz-studio-column-top";
  const FALLBACK_ROOT_PX = 16;

  const FONT_TEX = "tex";
  const FONT_SANS = "sans";
  const FONT_SANS_CLASS = "tikz-studio-font-sans";
  const FONT_SANS_PROPERTY = "--tikz-studio-sans-family";

  // ------------------------------------------------------------------ elements
  const ids = [
    "app", "source", "template", "template-load", "render", "stop", "live", "live-note", "status", "problems-link-wrap", "problems-link", "notes", "notes-intro", "notes-list",
    "supported", "supported-builtin", "supported-packages", "supported-libraries", "unavailable", "errors-section", "errors", "log",
    "log-text", "skip", "describe-heading", "paper", "placeholder", "out-of-date", "figure", "alt", "caption", "longdesc", "decorative",
    "description-actions", "copy-text", "copy-formatted", "copy-html", "read-aloud", "read-aloud-label", "save-audio-group", "save-audio",
    "save-audio-label", "save-audio-format", "save-audio-format-label",
    "font-tex", "font-sans", "download-svg", "download-png", "download-html", "png-size", "png-size-note", "describe", "describe-status",
    "fix", "fix-status", "fix-result", "fix-heading", "fix-warning", "fix-change", "fix-diff", "fix-attempts", "fix-apply", "fix-discard",
    "generate-prompt", "generate-picture", "generate-picture-zone", "generate-picture-name", "generate-picture-remove", "generate-picture-status", "generate", "generate-status", "generate-result", "generate-stale",
    "compare-left-img", "compare-left-none", "compare-left-caption", "compare-right-img", "compare-right-caption",
    "generate-summary", "generate-code", "generate-use", "generate-discard", "generate-attempts",
  ];
  const el = {};
  let bound = false;
  let initPromise = null;
  const readyWaiters = [];
  let openDraw = null; // the promise of the draw on open (EX1); whenReady() waits for it
  let liveTimer = null;
  let pending = null; // { explicit } : a render asked for while one was running
  let lastOutcome = "none"; // "none" | "rendered" | "error"
  let lastSignature = "";
  let currentSignature = ""; // the signature of the error set on screen, "" when none
  let liveDefaultApplied = false;
  let templates = [];
  let exportingHtml = false; // true while Download HTML is being built: a second press then does nothing
  let annotationEdit = false; // true while the Studio itself rewrites the % @ lines through the source box: that edit needs no new render
  let reading = false; // the shared text-to-speech is speaking this description
  let saving = false; // an audio file is being made
  let describing = false;
  let describeSilent = false; // true while the tool is being left: a stopped description then says nothing
  let fixing = false;
  let fixSilent = false; // true while the tool is being left: a stopped fix then says nothing
  let generating = false;
  let generateSilent = false; // true while the tool is being left: a stopped drawing then says nothing
  let drawing = null; // { source, sourceAtStart } of the proposed drawing on screen, or null
  let picture = null; // the chosen picture: { name, ready: Promise<{dataUrl,width,height,bytes}> }, { invalid: true }, or null
  let proposal = null; // { source, firstLine } of the suggestion on screen, or null
  let lastErrors = []; // the problems of the last failed render, with the log and the source that produced them
  let lastLog = "";
  let errorsSource = null;
  let fontChoice = FONT_TEX; // F2: which font the drawing is shown and saved in; in memory only, kept across renders

  function bind() {
    if (bound) return true;
    for (const id of ids) {
      el[id] = document.getElementById("tikz-studio-" + id);
      if (!el[id]) {
        logError("Missing element #tikz-studio-" + id);
        return false;
      }
    }
    el.render.addEventListener("click", () => requestRender({ explicit: true }));
    el.stop.addEventListener("click", onStop);
    el.source.addEventListener("input", onSourceInput);
    el.live.addEventListener("change", onLiveChange);
    el.errors.addEventListener("click", onErrorsClick);
    el.skip.addEventListener("click", onSkip);
    el["problems-link"].addEventListener("click", onProblemsLink);
    el["template-load"].addEventListener("click", onTemplateLoad);
    el["download-svg"].addEventListener("click", () => download("svg"));
    el["download-png"].addEventListener("click", () => download("png"));
    el["download-html"].addEventListener("click", () => download("html"));
    el["png-size"].addEventListener("change", refreshPngSizes);
    el["font-tex"].addEventListener("change", onFontChange);
    el["font-sans"].addEventListener("change", onFontChange);
    el.describe.addEventListener("click", onDescribe);
    el.fix.addEventListener("click", onFix);
    el["fix-apply"].addEventListener("click", onFixApply);
    el["fix-discard"].addEventListener("click", onFixDiscard);
    el.generate.addEventListener("click", onGenerate);
    el["generate-picture"].addEventListener("change", onPictureChange);
    el["generate-picture-remove"].addEventListener("click", onPictureRemove);
    for (const type of ["dragenter", "dragover"]) el["generate-picture-zone"].addEventListener(type, onZoneDrag);
    el["generate-picture-zone"].addEventListener("dragleave", onZoneLeave);
    el["generate-picture-zone"].addEventListener("drop", onZoneDrop);
    document.addEventListener("paste", onPaste);
    el["generate-use"].addEventListener("click", onGenerateUse);
    el["generate-discard"].addEventListener("click", onGenerateDiscard);
    for (const id of ["alt", "caption", "longdesc", "decorative"]) {
      el[id].addEventListener("input", onFieldInput);
      el[id].addEventListener("change", onFieldInput);
    }
    el["copy-text"].addEventListener("click", () => onCopy(COPY_KINDS.text));
    el["copy-formatted"].addEventListener("click", () => onCopy(COPY_KINDS.formatted));
    el["copy-html"].addEventListener("click", () => onCopy(COPY_KINDS.html));
    el["read-aloud"].addEventListener("click", onReadAloud);
    el["save-audio"].addEventListener("click", onSaveAudio);
    el["save-audio-format"].addEventListener("click", onAudioFormat);
    wireSpeechEvents();
    bound = true;
    return true;
  }

  /** The figure helpers arrive with the kit, after bind(); handlers that need them wait for it. */
  const kitReady = () => !!window.TikzKitFigure;

  // ------------------------------------------------------------------ announcing
  /**
   * The shared announcer, resolved at call time. Polite only: an error that someone has to read is also on screen.
   * @param {string} text
   * @returns {boolean} whether an announcer was there to take it
   */
  function announce(text) {
    const helpers = window.accessibilityHelpers;
    if (!helpers || typeof helpers.announce !== "function") {
      logWarn("No shared announcer; not announced:", text);
      return false;
    }
    /* @announce */ helpers.announce(text);
    return true;
  }

  function notify(kind, message, options) {
    const fn = window[kind];
    if (typeof fn !== "function") {
      logWarn(kind + " is not available:", message);
      return undefined;
    }
    return fn(message, options);
  }

  // ------------------------------------------------------------------ fields and source
  function readFields() {
    return {
      alt: el.alt.value,
      caption: el.caption.value,
      longdesc: el.longdesc.value,
      isDecorative: el.decorative.checked,
    };
  }

  function applyDecorativeUi() {
    const decorative = el.decorative.checked;
    el.alt.disabled = decorative;
    el.longdesc.disabled = decorative;
  }

  /** Source to fields. A decorative source leaves the alt and long description fields as they are, so unticking restores them. */
  function syncFieldsFromSource() {
    if (!kitReady()) return;
    const a = C.readAnnotations(el.source.value);
    const setIfIdle = (node, value) => {
      /* P5C-SYNC-SITE */
      if (document.activeElement !== node && node.value !== value) node.value = value;
    };
    setIfIdle(el.caption, a.caption);
    if (!a.isDecorative) {
      setIfIdle(el.alt, a.alt);
      setIfIdle(el.longdesc, a.longdesc);
    }
    el.decorative.checked = a.isDecorative;
    applyDecorativeUi();
    refreshPreview();
  }

  /** Fields to source: rewrite the annotation lines above the first picture. Never triggers a TeX run: they are comments. */
  function onFieldInput() {
    if (!kitReady()) return;
    applyDecorativeUi();
    const next = C.writeAnnotations(el.source.value, readFields());
    if (next !== el.source.value) el.source.value = next;
    refreshPreview();
  }

  function onSourceInput() {
    // The Studio's own rewrite of the % @ lines (Describe with AI): the drawing is the same, so no suggestion goes stale and no render is due.
    if (annotationEdit) {
      syncFieldsFromSource();
      return;
    }
    // A suggestion was written for the source as it was; once the source moves it no longer applies. (A fix still being written is
    // dropped by the adapter's isCurrent check instead, which says so.)
    if (!fixing) clearFix();
    // A proposed drawing does not depend on the source, so it stays; the line saying the source has moved on is kept true.
    if (drawing) el["generate-stale"].hidden = el.source.value === drawing.sourceAtStart;
    syncFieldsFromSource();
    if (liveOn()) scheduleLive();
    else if (C.state.svg || currentSignature) setStatus(MESSAGES.changed);
  }

  // ------------------------------------------------------------------ live rendering
  function liveAllowed() {
    return C.isLiveAllowed() && C.state.ranIn !== "main-thread";
  }
  function liveOn() {
    return el.live.checked && !el.live.disabled && liveAllowed();
  }

  /** Bring the live checkbox and its note into line with where TeX runs. */
  function applyMode() {
    const allowed = liveAllowed();
    el.live.disabled = !allowed;
    if (!allowed) {
      el.live.checked = false;
    } else if (!liveDefaultApplied) {
      el.live.checked = true;
    }
    liveDefaultApplied = true;
    el["live-note"].hidden = allowed;
    if (!allowed) {
      const why = C.state.workerFallbackReason;
      el["live-note"].textContent = MESSAGES.liveOff + (why ? " (" + why + ")" : "");
    }
  }

  function scheduleLive() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => requestRender({ explicit: false }), C.config.debounceMs);
  }

  function onLiveChange() {
    if (liveOn()) scheduleLive();
    else clearTimeout(liveTimer);
  }

  // ------------------------------------------------------------------ rendering
  function setStatus(text) {
    el.status.textContent = text;
  }

  function setBusy(busy) {
    el.stop.hidden = !busy;
    if (busy) setStatus(MESSAGES.rendering);
  }

  /**
   * Render the textarea now. One TeX run at a time: a request that arrives during a run is remembered and run when it ends.
   * @param {{explicit: boolean, silent?: boolean}} options explicit is true for the Render button; silent is true only for the one
   *   draw on open (EX1), which shows the result and the status line and says nothing aloud
   */
  async function requestRender({ explicit, silent = false }) {
    if (!bound || !C.state.mode) return;
    clearTimeout(liveTimer);
    if (C.state.busy) {
      pending = { explicit: !!(pending && pending.explicit) || explicit };
      return;
    }
    pending = null;
    const source = el.source.value;
    let result;
    if (source.trim() === "") {
      result = { ok: false, aborted: false, errors: [{ message: MESSAGES.sourceEmpty }], log: "", ms: 0, ranIn: null };
    } else {
      setBusy(true);
      result = await C.renderOnce(source);
      setBusy(false);
    }
    if (result.aborted) {
      pending = null;
      setStatus(MESSAGES.stopped);
      return;
    }
    showResult(result, explicit, source, silent);
    if (pending) {
      const next = pending;
      pending = null;
      requestRender(next);
    }
  }

  function firstProblem(errors, notes) {
    const e = errors[0] || { message: "Unknown error." };
    let text = (e.line ? "line " + e.line + ": " : "") + C.plainMessage(e, notes);
    if (text.length > ERROR_MESSAGE_MAX) text = text.slice(0, ERROR_MESSAGE_MAX).trimEnd() + "…";
    return /[.!?…]$/.test(text) ? text : text + ".";
  }

  /**
   * K3: the status line for a failed render names the problem itself (Matthew, OR7: "Rendering failed: 1 problem." said nothing
   * about what was wrong). One problem: the sentence; more: the count and the first. The same sentence the announcement carries.
   */
  function failedStatusSentence(errors, notes) {
    const n = errors.length;
    const first = firstProblem(errors, notes);
    if (n === 1) return "Rendering failed. " + first.charAt(0).toUpperCase() + first.slice(1);
    return "Rendering failed: " + n + " problems. The first: " + first;
  }

  /** The "See the problems" link: focus goes to the problems heading, as the skip link does for its own target. */
  function onProblemsLink(event) {
    event.preventDefault();
    const target = document.getElementById((el["problems-link"].getAttribute("href") || "").replace(/^#/, ""));
    if (target) target.focus();
  }

  /**
   * What the kit changed to get the source to run: a plain list under the status line. It is not a live region and says nothing aloud;
   * the render sentence is still the only voice. The source box is never touched.
   */
  function showNotes(notes, ok) {
    el["notes-list"].replaceChildren();
    el.notes.hidden = !notes.length;
    if (!notes.length) return;
    el["notes-intro"].textContent = ok ? MESSAGES.notesRendered : MESSAGES.notesFailed;
    for (const note of notes) {
      const li = document.createElement("li");
      li.textContent = note;
      el["notes-list"].appendChild(li);
    }
  }

  function showResult(result, explicit, source, silent = false) {
    lastBuilt = null; /* EC1F-RESET */
    applyMode();
    clearFix(); // a new result makes any suggestion, and the sentence about the last press, out of date
    const notes = Array.isArray(result.notes) ? result.notes : [];
    showNotes(notes, result.ok);
    if (result.ok) {
      currentSignature = "";
      el["errors-section"].hidden = true;
      el["problems-link-wrap"].hidden = true;
      el.errors.replaceChildren();
      refreshPreview();
      // OD1: what a failure after this keeps on screen. Taken from the figure as it stands, so it is the drawing, copy, description and table together.
      goodDrawing = el.figure.innerHTML && !showingStale ? { html: el.figure.innerHTML } : null;
      setStatus("Rendered in " + Math.round(result.ms) + " ms" + (result.ranIn === "main-thread" ? " (on this page, not in a background Worker)." : "."));
      if (silent) return; // the draw on open: nothing spoken, and lastOutcome stays "none" so the first change a person makes still announces once
      if (explicit || lastOutcome !== "rendered") announce(MESSAGES.rendered);
      lastOutcome = "rendered";
      lastSignature = "";
      return;
    }
    const signature = C.errorSignature(result.errors);
    currentSignature = signature || "error";
    // Fix with AI works from these: the problems, the log and the exact source that produced them. An empty source has nothing to fix.
    lastErrors = result.errors;
    lastLog = result.log || "";
    errorsSource = typeof source === "string" ? source : null;
    el.fix.hidden = typeof source !== "string" || source.trim() === "";
    showErrors(result.errors, result.log, notes);
    refreshPreview();
    const n = result.errors.length;
    const failedStatus = /* K3-STATUS-SITE */ failedStatusSentence(result.errors, notes);
    setStatus(failedStatus + (showingStale ? MESSAGES.outOfDateStatus : ""));
    el["problems-link-wrap"].hidden = false; // shown exactly while the problems section is
    if (silent) return; // the draw on open stays silent even if the starter text cannot be drawn: the problem is on screen and in the status line
    // Entering the error state always announces. A change from one error to another announces only on the Render button.
    const entering = lastOutcome !== "error";
    if (entering || (explicit && currentSignature !== lastSignature)) {
      announce("The source has " + n + " problem" + (n === 1 ? "" : "s") + ". First: " + firstProblem(result.errors, notes));
    }
    lastOutcome = "error";
    lastSignature = currentSignature;
  }

  function showErrors(errors, log, notes) {
    el.errors.replaceChildren();
    for (const e of errors) {
      const li = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = (e.line ? "Line " + e.line + ": " : "") + C.plainMessage(e, notes);
      li.appendChild(text);
      if (e.line) {
        li.appendChild(document.createTextNode(" "));
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.line = String(e.line);
        button.textContent = "Go to line " + e.line;
        li.appendChild(button);
      }
      el.errors.appendChild(li);
    }
    el["log-text"].textContent = String(log || "").slice(0, LOG_MAX_CHARS);
    el.log.hidden = !log;
    el["errors-section"].hidden = false;
  }

  function onErrorsClick(event) {
    const button = event.target.closest && event.target.closest("button[data-line]");
    if (button) goToLine(Number(button.dataset.line));
  }

  function goToLine(n) {
    const ta = el.source;
    const range = C.lineRange(ta.value, n);
    ta.focus();
    ta.setSelectionRange(range.start, range.end);
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * FALLBACK_LINE_HEIGHT_FACTOR || 20;
    ta.scrollTop = Math.max(0, (range.line - 1) * lineHeight - ta.clientHeight / 2);
  }

  function onStop() {
    pending = null;
    C.abort();
  }

  function onSkip(event) {
    event.preventDefault();
    const target = document.getElementById((el.skip.getAttribute("href") || "").replace(/^#/, ""));
    if (target) target.focus();
  }

  // ------------------------------------------------------------------ preview
  /**
   * Responsive treatment of the figure's Data table on THIS page. The exported table gets scorm-builder's (cards at 6 or fewer
   * columns, a focusable scrolling region above that); this copies the same rule with a scoped sheet (tikz-studio.css), which
   * needs a label on every cell and, for a wide table, a named focusable wrapper. Page-side only: the figure the export builds
   * is untouched, so scorm-builder's enhancer meets the plain table.
   * @param {Element} root
   */
  function enhanceDataTables(root) {
    for (const table of root.querySelectorAll(".tikz-data table")) {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
      for (const row of table.querySelectorAll("tbody tr")) {
        Array.from(row.children).forEach((cell, i) => {
          if (headers[i]) cell.setAttribute("data-label", headers[i]);
        });
      }
      if (headers.length <= DATA_CARD_MAX_COLUMNS) {
        table.setAttribute("data-tikz-layout", "cards");
        continue;
      }
      table.setAttribute("data-tikz-layout", "scroll");
      const caption = table.querySelector("caption");
      const rows = table.querySelectorAll("tr").length;
      const wrapper = document.createElement("div");
      wrapper.className = "tikz-data-scroll";
      wrapper.setAttribute("role", "region");
      wrapper.tabIndex = 0;
      wrapper.setAttribute("aria-label", (caption ? caption.textContent.trim() : "Data") + ": table with " + rows + " rows and " + headers.length + " columns");
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }

  /** What the figure was last built from (KR1): the drawing and the four fields. Null when the figure is empty. */
  let lastBuilt = null;
  /**
   * OD1 (20 October 2026): the figure's HTML as the last SUCCESSFUL render left it (its drawing, its source copy, description and table),
   * kept here and not in C.state.svg, whose null after a failed render is what the specs' waits and Download HTML rely on. Shown, marked out of
   * date, while the source has problems; cleared with the figure when the source is emptied.
   */
  let goodDrawing = null;
  /** True while the figure holds goodDrawing in place of a current drawing. Downloads, Describe and the comparison refuse it. */
  let showingStale = false;

  /** OD2: the ids of the "out of date" Download toasts raised while the drawing was out of date (one per press, as each is its own toast). */
  const outOfDateToastIds = new Set();

  /**
   * OD2: the drawing has stopped being out of date (a good render replaced it, or the source was emptied), so the two refusals that said it was
   * are false. Close the Download toasts this Studio raised and hide the Describe line, but only while it holds that refusal. No announcement.
   */
  function clearOutOfDateMessages() {
    const notifier = window.UniversalNotifications;
    for (const id of outOfDateToastIds) {
      /* OD2-CLEAR */ if (notifier && typeof notifier.dismiss === "function") notifier.dismiss(id);
    }
    outOfDateToastIds.clear();
    if (el["describe-status"].textContent === MESSAGES.outOfDateDescribe) el["describe-status"].hidden = true;
  }

  function sameFields(a, b) {
    return a.alt === b.alt && a.caption === b.caption && a.longdesc === b.longdesc && a.isDecorative === b.isDecorative;
  }

  function refreshPreview() {
    if (!bound || !kitReady()) return;
    const fields = readFields();
    const source = el.source.value;
    // KR1 (PV1, 16 October 2026): a key in the source box changes neither the drawing nor the fields, and the only thing in the figure that
    // follows the source is the "View TikZ source" copy. Rebuilding 666 elements for that cost 184-232 ms a key at 6x CPU slowdown. Write the
    // copy and stop; the copy must stay current. An empty or space-only source has no copy (buildFigure omits it) and shows no drawing (EC1), so
    // that case rebuilds (EC1-F: `source.trim()`, not `source`). Every result reaches showResult, which resets lastBuilt, so a render that drew
    // the same picture again still redraws the figure, as before.
    // OD1: the kept drawing's copy is the source that drew it, so a key in the source box must never reach it (lastBuilt matches while stale).
    /* KR1-FAST */ if (!showingStale /* OD1-NOFAST */ && lastBuilt && lastBuilt.svg === C.state.svg && sameFields(lastBuilt.fields, fields) && source.trim()) {
      const copies = el.figure.querySelectorAll("details.tikz-source code");
      if (copies.length === 1) {
        const code = copies[0];
        code.textContent = source; /* KR1-WRITE */
        return;
      }
    }
    // EC1 (16 October 2026): an emptied source box shows no drawing. state.svg is kept, so putting the same source back (Ctrl+Z) redraws it at once.
    /* EC1-EMPTY */ if (!source.trim()) {
      // DE1 (20 October 2026): a "Description written…" sentence is about the figure being emptied, so it goes with it. Only when the figure had
      // content: a refusal said on an already-empty figure must survive the next blank keystroke. (Plain paragraph, not a live region: silent.)
      const hadContent = el.figure.innerHTML !== "";
      lastBuilt = null;
      // OD1: an emptied source clears the kept drawing for good (the owner's ruling), not only from the screen.
      goodDrawing = null;
      if (showingStale) clearOutOfDateMessages(); // OD2
      showingStale = false;
      el["out-of-date"].hidden = true;
      el.figure.innerHTML = "";
      if (hadContent) el["describe-status"].hidden = true; /* DE1F-HIDE */
      el.placeholder.hidden = false;
      refreshDescriptionActions();
      refreshPngSizes();
      el.placeholder.textContent = currentSignature ? MESSAGES.noPreview : MESSAGES.noPreviewYet;
      return;
    }
    const html = C.buildFigureHtml(fields, source);
    // OD1: the render failed (this error is on screen) but a drawing worked before: keep it, marked out of date, rather than empty the figure.
    /* OD1-KEEP */ if (!html && goodDrawing && currentSignature) {
      lastBuilt = { svg: C.state.svg, fields };
      if (!showingStale) {
        el.figure.innerHTML = goodDrawing.html;
        /* SR1-NAME */ for (const named of el.figure.querySelectorAll('svg[role="img"][aria-label], .tikz-data-scroll[role="region"][aria-label]')) named.setAttribute("aria-label", OUT_OF_DATE_NAME_PREFIX + named.getAttribute("aria-label"));
        showingStale = true;
      }
      /* OD1-MARK */ el["out-of-date"].hidden = false;
      el.placeholder.hidden = true;
      refreshDescriptionActions();
      refreshPngSizes();
      return;
    }
    if (showingStale) clearOutOfDateMessages(); // OD2: only on the true -> false change
    showingStale = false;
    el["out-of-date"].hidden = true;
    lastBuilt = html ? { svg: C.state.svg, fields } : null;
    el.figure.innerHTML = html || "";
    enhanceDataTables(el.figure);
    el.placeholder.hidden = !!html;
    refreshDescriptionActions();
    refreshPngSizes();
    if (!html) el.placeholder.textContent = currentSignature ? MESSAGES.noPreview : MESSAGES.noPreviewYet;
  }

  // ------------------------------------------------------------------ download and export
  function currentSvgString() {
    const svg = el.figure.querySelector("svg");
    return svg ? svg.outerHTML : null;
  }

  /** The drawing on screen only while it is current: an out-of-date one (OD1) counts as no drawing for the size note and the comparison. */
  function currentDrawingString() {
    return showingStale ? null : currentSvgString();
  }

  // ------------------------------------------------------------------ font in the drawing (F2)
  /** The site's own sans family, read from the sheet (main.css's `*` rule) through the Studio's own element, never retyped here. */
  function siteSansFamily() {
    return getComputedStyle(el.app).fontFamily;
  }

  /**
   * Show the drawing in the chosen font without drawing it again: a class on the figure container plus one sheet rule that beats the
   * inline family the kit pins on each <text>. The figure's own HTML is untouched, so its name, description and data table are too.
   */
  function applyFont() {
    el.figure.style.setProperty(FONT_SANS_PROPERTY, siteSansFamily());
    el.figure.classList.toggle(FONT_SANS_CLASS, fontChoice === FONT_SANS);
  }

  function onFontChange() {
    fontChoice = el["font-sans"].checked ? FONT_SANS : FONT_TEX;
    /* @font-switch */ applyFont();
  }

  /**
   * What gets saved follows what is shown: under Sans serif the family in every pinned style is the site's own; under TeX's own font the
   * string is returned untouched (byte for byte what the figure held before this choice existed).
   */
  function withChosenFont(markup) {
    if (fontChoice !== FONT_SANS) return markup;
    const family = siteSansFamily().replace(/"/g, "'");
    return markup.replace(/\sstyle="[^"]*"/g, (attr) => attr.replace(/font-family:[^;"]*/, () => "font-family:" + family));
  }

  /** The SVG as it is saved (SVG download and PNG), in the chosen font. */
  function svgForSaving() {
    const svg = currentSvgString();
    if (!svg) return null;
    /* @font-download */ return withChosenFont(svg);
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
  }

  /**
   * The PNG size list and the sentence under it. Every size is offered; one whose longer side would pass the kit's canvas limit is
   * disabled with the reason in its own text, and a chosen size that has become too large drops to the largest that fits. The sentence
   * is a plain paragraph the select points at (not a live region), so it is read when the select takes focus.
   */
  function refreshPngSizes() {
    const select = el["png-size"];
    const svg = currentDrawingString();
    let size = null;
    if (svg && window.TikzKitPng) {
      try {
        size = window.TikzKitPng.svgSize(svg);
      } catch (e) {
        logWarn("The figure's size could not be read:", e && e.message);
      }
    }
    const pixels = (scale) => size && { w: Math.ceil(size.w * scale), h: Math.ceil(size.h * scale) };
    for (const option of select.options) {
      const scale = Number(option.value);
      const label = PNG_SIZE_NAMES[scale] + " (" + scale + "×)";
      const px = pixels(scale);
      const tooLarge = !!px && (px.w > PNG_MAX_SIDE || px.h > PNG_MAX_SIDE);
      option.disabled = tooLarge;
      option.textContent = tooLarge ? label + " – " + MESSAGES.pngTooLarge : label;
    }
    if (select.selectedOptions[0] && select.selectedOptions[0].disabled) {
      const fits = [...select.options].filter((o) => !o.disabled);
      select.value = fits.length ? fits[fits.length - 1].value : select.options[0].value;
    }
    const chosen = pixels(Number(select.value));
    el["png-size-note"].textContent = chosen
      ? PNG_SIZE_NAMES[Number(select.value)] + ": " + chosen.w.toLocaleString("en-GB") + " by " + chosen.h.toLocaleString("en-GB") + " pixels"
      : MESSAGES.pngSizeRender;
  }

  /** The figure's accessible HTML (drawing, caption, long description, data table) as a standalone page, through the shared export facade. */
  async function downloadHtml() {
    if (exportingHtml) return;
    if (!SCRIPT_URL) throw new Error("the export code could not be located");
    exportingHtml = true;
    try {
      const mod = await import(new URL(SCORM_EXPORT_PATH, SCRIPT_URL).href);
      await mod.exportContent({ content: exportOptions.getContent(), format: "html", target: "html", title: exportOptions.getTitle(), download: true });
    } finally {
      exportingHtml = false;
    }
  }

  async function download(kind) {
    // OD1: the drawing on screen is the last one that worked, not what the source says now, so no file is made from it.
    /* OD1-GUARD */ if (showingStale) {
      const toastId = notify("notifyWarning", MESSAGES.outOfDateDownload, { duration: 0 });
      if (toastId) outOfDateToastIds.add(toastId); // OD2: closed when the drawing stops being out of date
      return;
    }
    const svg = svgForSaving();
    if (!svg) {
      notify("notifyWarning", MESSAGES.renderFirst, { duration: 0 });
      return;
    }
    try {
      if (kind === "svg") {
        saveBlob(new Blob([svg], { type: "image/svg+xml" }), "tikz-figure.svg");
        notify("notifySuccess", MESSAGES.svgDone);
      } else if (kind === "png") {
        const blob = await window.TikzKitPng.toPng(svg, { scale: Number(el["png-size"].value) || PNG_DEFAULT_SCALE });
        saveBlob(blob, "tikz-figure.png");
        notify("notifySuccess", MESSAGES.pngDone);
      } else {
        await downloadHtml();
        notify("notifySuccess", MESSAGES.htmlDone);
      }
    } catch (e) {
      logError("Download failed:", e);
      notify("notifyError", "The " + kind.toUpperCase() + " could not be created: " + ((e && e.message) || e));
    }
  }

  // ------------------------------------------------------------------ describe with AI
  const fillable = (node) => node.value.trim() === "";

  /** One sentence, on screen in the plain status paragraph and announced once. It stays on screen until the next press. */
  function say(sentence) {
    el["describe-status"].textContent = sentence;
    el["describe-status"].hidden = false;
    announce(sentence);
  }

  /** True when the text alternative box is empty. */
  const altIsEmpty = () => fillable(el.alt);

  /**
   * Replace the whole source through the browser's own edit path, as "Use this drawing" does, so Ctrl+Z in the source box undoes it.
   * Focus goes back to where it was (the Describe button), and the edit asks for no render: only comment lines changed.
   */
  function replaceSourceKeepingFocus(next) {
    const ta = el.source;
    const back = document.activeElement;
    const scrollTop = ta.scrollTop;
    annotationEdit = true;
    try {
      ta.focus({ preventScroll: true });
      ta.select();
      if (!document.execCommand("insertText", false, next)) {
        ta.value = next;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      ta.setSelectionRange(0, 0);
      ta.scrollTop = scrollTop;
    } finally {
      annotationEdit = false;
      if (back && back !== ta && typeof back.focus === "function") back.focus({ preventScroll: true });
    }
  }

  // ------------------------------------------------------------------ copy, read aloud and save the description (P5b)
  const COPY_KINDS = Object.freeze({ text: "text", formatted: "formatted", html: "html" });
  const COPY_MESSAGES = Object.freeze({
    text: "Description copied as text.",
    formatted: "Description copied, formatted.",
    formattedPlain: "Description copied as plain text. Formatted copying is not available here.",
    html: "Description copied as HTML.",
    failed: "The description could not be copied.",
  });
  const SPEECH_MESSAGES = Object.freeze({
    readIdle: "Read Aloud",
    readStop: "Stop reading",
    noVoice: "No voice is available on this device. Open Voice Settings on the Set Up page.",
    saved: "Audio file saved.",
    saveFailed: "Audio export failed: ",
  });
  /** The same key Image Describer keeps its choice under, so one choice serves both tools. */
  const AUDIO_FORMAT_KEY = "tts-export-format";
  const AUDIO_FORMATS = Object.freeze({ mp3: "mp3", wav: "wav" });

  const currentDescription = () => (kitReady() ? C.descriptionText(readFields()) : "");

  /** Shown only when a figure is on screen and has a description to act on. Read aloud and save also need the shared TTS to be on the page. */
  function refreshDescriptionActions() {
    if (!bound) return;
    el["description-actions"].hidden = !(el.figure.innerHTML !== "" && currentDescription() !== "");
    const hasSpeech = !!window.TTSController;
    el["read-aloud"].hidden = !hasSpeech;
    el["save-audio-group"].hidden = !hasSpeech;
    refreshAudioFormat();
  }

  async function copyFormatted(fields, text) {
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + C.descriptionHtml(fields) + "</body></html>";
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
      ]);
      return COPY_MESSAGES.formatted;
    } catch (e) {
      logWarn("Formatted copy failed, copying plain text:", e);
      await navigator.clipboard.writeText(text);
      return COPY_MESSAGES.formattedPlain;
    }
  }

  /** One press, one voice: the shared toast announces, so nothing else does. */
  async function onCopy(kind) {
    const fields = readFields();
    const text = C.descriptionText(fields);
    if (!text) return;
    try {
      let message = COPY_MESSAGES[kind];
      if (kind === COPY_KINDS.text) await navigator.clipboard.writeText(text);
      else if (kind === COPY_KINDS.html) await navigator.clipboard.writeText(C.descriptionHtml(fields));
      else message = await copyFormatted(fields, text);
      notify("notifySuccess", message);
    } catch (e) {
      logError("Copy failed:", e);
      notify("notifyError", COPY_MESSAGES.failed);
    }
  }

  let readRequested = false; // this tool asked for the speech now playing; speech another tool starts is not ours
  function setReading(on) {
    reading = on;
    el["read-aloud-label"].textContent = on ? SPEECH_MESSAGES.readStop : SPEECH_MESSAGES.readIdle;
  }
  function onReadAloud() {
    const speech = window.TTSController;
    if (!speech) return;
    if (reading) {
      speech.stop();
      return;
    }
    const text = currentDescription();
    if (!text) return;
    if (typeof speech.isAvailable === "function" && !speech.isAvailable()) {
      notify("notifyWarning", SPEECH_MESSAGES.noVoice, { duration: 0 });
      return;
    }
    readRequested = true;
    speech.speak({ text, sections: null });
  }
  function wireSpeechEvents() {
    const bus = window.EmbedEventEmitter;
    if (!bus || typeof bus.on !== "function") return;
    bus.on("tts:start", () => {
      if (readRequested) setReading(true);
    });
    for (const name of ["tts:end", "tts:error"]) {
      bus.on(name, () => {
        readRequested = false;
        if (reading) setReading(false);
      });
    }
  }

  function audioFormat() {
    try {
      const stored = localStorage.getItem(AUDIO_FORMAT_KEY);
      if (stored === AUDIO_FORMATS.mp3 || stored === AUDIO_FORMATS.wav) return stored;
    } catch (e) {
      /* storage unavailable: the default stands */
    }
    return AUDIO_FORMATS.mp3;
  }
  function refreshAudioFormat() {
    const label = audioFormat().toUpperCase();
    el["save-audio-label"].textContent = "Save as " + label;
    el["save-audio-format-label"].textContent = label;
    el["save-audio-format"].setAttribute("aria-label", "Change audio format. Currently " + label + ".");
  }
  function onAudioFormat() {
    if (saving) return;
    const next = audioFormat() === AUDIO_FORMATS.mp3 ? AUDIO_FORMATS.wav : AUDIO_FORMATS.mp3;
    try {
      localStorage.setItem(AUDIO_FORMAT_KEY, next);
    } catch (e) {
      logWarn("The audio format could not be stored:", e);
    }
    refreshAudioFormat();
    announce("Audio format set to " + next.toUpperCase());
  }

  /** Neither control is disabled while the file is made (a disabled focused control drops focus to the page); both carry aria-busy. */
  async function onSaveAudio() {
    if (saving) return;
    const speech = window.TTSController;
    const text = currentDescription();
    if (!speech || !text) return;
    const format = audioFormat();
    const exporter = format === AUDIO_FORMATS.mp3 ? speech.exportMp3 : speech.exportWav;
    if (typeof exporter !== "function") {
      notify("notifyWarning", SPEECH_MESSAGES.saveFailed + format.toUpperCase() + " export is not available.");
      return;
    }
    saving = true;
    el["save-audio"].setAttribute("aria-busy", "true");
    el["save-audio-format"].setAttribute("aria-busy", "true");
    announce("Generating " + format.toUpperCase() + " audio file…");
    try {
      await exporter.call(speech, { text, sections: null });
      notify("notifySuccess", SPEECH_MESSAGES.saved);
    } catch (e) {
      logError("Audio export failed:", e);
      notify("notifyWarning", SPEECH_MESSAGES.saveFailed + ((e && e.message) || "unknown error"), { duration: 0 });
    } finally {
      saving = false;
      el["save-audio"].removeAttribute("aria-busy");
      el["save-audio-format"].removeAttribute("aria-busy");
    }
  }

  function sentenceFor(result) {
    switch (result.reason) {
      case "cancelled":
        return result.message;
      case "no-model":
      case "truncated":
      case "parse":
        return result.message;
      default:
        return "The description could not be created. " + result.message;
    }
  }

  /** The Describe button: one press, one request, one announcement. A press while a request is out stops it. */
  async function onDescribe() {
    const llm = window.TikzStudioLLM;
    if (describing) {
      if (llm) llm.cancel();
      return;
    }
    if (!llm) return say(MESSAGES.describeUnavailable);
    if (showingStale) return say(MESSAGES.outOfDateDescribe); // OD1
    const svg = currentSvgString();
    if (!svg) return say(MESSAGES.describeRenderFirst);
    if (el.decorative.checked) return say(MESSAGES.describeDecorative);
    if (!altIsEmpty() && !fillable(el.longdesc)) return say(MESSAGES.describeFull);

    describing = true;
    describeSilent = false;
    el["describe-status"].hidden = true;
    el.describe.textContent = MESSAGES.describeBusy;
    let outcome = null;
    try {
      outcome = await llm.describe({ source: el.source.value, svg });
    } finally {
      describing = false;
      el.describe.textContent = MESSAGES.describeIdle;
    }
    if (describeSilent) return;
    if (!outcome.ok) return say(sentenceFor(outcome));
    // DE1 (20 October 2026): the source was emptied while the reply was out. Writing into it would bring the kept drawing back over empty fields
    // (or start a live render of a comment-only source that fails), so write nothing and say so. The test is EC1's own: blank now.
    if (!el.source.value.trim()) return say(MESSAGES.describeEmptied); /* DE1F-GUARD */
    // Only a part that is STILL empty is written: someone may have typed while the request was out. Both go in as ONE edit of the source
    // (the alt as its % @alt line, the long description through its box's lines), so Ctrl+Z in the source box undoes the whole press.
    const fields = readFields();
    let written = 0;
    if (altIsEmpty()) {
      fields.alt = outcome.alt;
      written += 1;
    }
    if (fillable(el.longdesc)) {
      fields.longdesc = C.withClosingLine(outcome.longdesc);
      written += 1;
    }
    if (written) replaceSourceKeepingFocus(C.writeAnnotations(el.source.value, fields));
    // One sentence only: the same outcome sentence, with a clause when numbers in the text could not be matched to the figure or source.
    const numbersUnchecked = Array.isArray(outcome.unsupportedNumbers) && outcome.unsupportedNumbers.length > 0;
    say(written ? (numbersUnchecked ? MESSAGES.describeWrittenCheck : MESSAGES.describeWritten) : MESSAGES.describeRaced);
  }

  // ------------------------------------------------------------------ fix with AI
  /** One sentence, on screen in the plain status paragraph and announced once. It stays until the next press or the next result. */
  function fixSay(sentence) {
    el["fix-status"].textContent = sentence;
    el["fix-status"].hidden = false;
    return announce(sentence);
  }

  /** Hide the suggestion, the earlier attempts and the sentence about the last press. Says nothing. */
  function clearFix() {
    proposal = null;
    el["fix-result"].hidden = true;
    el["fix-diff"].replaceChildren();
    el["fix-change"].textContent = "";
    el["fix-attempts"].replaceChildren();
    el["fix-status"].hidden = true;
    el["fix-status"].textContent = "";
  }

  /** The changed lines as a list in words ("Line 4, removed: ..."), never by colour alone; the code itself is monospace. */
  function fillDiffList(list, rows) {
    list.replaceChildren();
    for (const row of rows) {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = "Line " + row.line + ", " + row.type + ": ";
      const code = document.createElement("code");
      code.textContent = row.text === "" ? MESSAGES.emptyLine : row.text;
      li.append(label, code);
      list.appendChild(li);
    }
  }

  /** Each proposal that did not render, in a closed <details>: what it changed and the problems it left. */
  function showAttempts(attempts, source) {
    el["fix-attempts"].replaceChildren();
    for (const attempt of attempts) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Attempt " + attempt.n + " did not render";
      details.appendChild(summary);
      const change = document.createElement("p");
      change.textContent = attempt.change || MESSAGES.fixNoExplanation;
      details.appendChild(change);
      const diff = document.createElement("ul");
      diff.className = "tikz-studio-fix-diff";
      fillDiffList(diff, C.diffLines(source, attempt.source).rows);
      details.appendChild(diff);
      const left = document.createElement("p");
      left.textContent = "Problems it left:";
      details.appendChild(left);
      const problems = document.createElement("ul");
      for (const e of attempt.errors || []) {
        const li = document.createElement("li");
        li.textContent = (e.line ? "Line " + e.line + ": " : "") + e.message;
        problems.appendChild(li);
      }
      details.appendChild(problems);
      el["fix-attempts"].appendChild(details);
    }
  }

  function sentenceForFix(result) {
    switch (result.reason) {
      case "stale":
      case "cancelled":
      case "no-fix":
      case "no-model":
      case "sign-in":
      case "truncated":
      case "parse":
        return result.message;
      default:
        return "The fix could not be created. " + result.message;
    }
  }

  /** The Fix with AI button: one press, at most three model sends, one announcement. A press while a request is out stops it. */
  async function onFix() {
    const llm = window.TikzStudioLLM;
    if (fixing) {
      if (llm) llm.cancel();
      return;
    }
    if (!llm || typeof llm.fix !== "function") return fixSay(MESSAGES.fixUnavailable);
    const source = el.source.value;
    // The problems on screen belong to the source that was rendered; sending them with a different source would mislead the model.
    if (source !== errorsSource) return fixSay(MESSAGES.fixRenderFirst);

    clearFix();
    fixing = true;
    fixSilent = false;
    el.fix.textContent = MESSAGES.fixBusy;
    let outcome = null;
    try {
      outcome = await llm.fix({
        source,
        errors: lastErrors,
        log: lastLog,
        trialRender: C.trialRender,
        isCurrent: () => el.source.value === source,
      });
    } finally {
      fixing = false;
      el.fix.textContent = MESSAGES.fixIdle;
    }
    if (fixSilent) return;
    if (!outcome.ok) {
      if (outcome.reason !== "stale") showAttempts(outcome.attempts || [], source);
      return fixSay(sentenceForFix(outcome));
    }
    const diff = C.diffLines(source, outcome.source);
    el["fix-change"].textContent = outcome.change || MESSAGES.fixNoExplanation;
    fillDiffList(el["fix-diff"], diff.rows);
    showAttempts(outcome.attempts || [], source);
    proposal = { source: outcome.source, firstLine: diff.firstLine };
    el["fix-result"].hidden = false;
    fixSay(fixReadySentence(diff.changed));
  }

  /** Apply fix: the source is replaced through the browser's own edit command (so Ctrl+Z undoes it), then the normal render runs. */
  function onFixApply() {
    if (!proposal) return;
    const { source: next, firstLine } = proposal;
    clearFix();
    const ta = el.source;
    ta.focus();
    ta.select();
    if (!document.execCommand("insertText", false, next)) {
      ta.value = next;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    goToLine(firstLine);
    requestRender({ explicit: true });
  }

  function onFixDiscard() {
    clearFix();
    el.fix.focus();
  }

  // ------------------------------------------------------------------ draw with AI
  /** One sentence, on screen in the plain status paragraph and announced once. It stays until the next press or the next result. */
  function generateSay(sentence) {
    el["generate-status"].textContent = sentence;
    el["generate-status"].hidden = false;
    return announce(sentence);
  }

  const svgDataUrl = (svg) => SVG_DATA_URL_PREFIX + encodeURIComponent(svg);

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("The picture could not be read."));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * The picture as it will be sent: the file itself when its longer side is within MAX_PICTURE_SIDE, otherwise a copy scaled down
   * (never up) in a canvas. A scaled copy is painted on white first so transparency never turns black for the model.
   * @param {File} file
   * @returns {Promise<{dataUrl: string, width: number, height: number, bytes: number}>}
   */
  async function preparePicture(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const longer = Math.max(img.naturalWidth, img.naturalHeight);
      if (longer <= MAX_PICTURE_SIDE) {
        return { dataUrl: await blobToDataUrl(file), width: img.naturalWidth, height: img.naturalHeight, bytes: file.size };
      }
      const factor = MAX_PICTURE_SIDE / longer;
      const width = Math.max(1, Math.round(img.naturalWidth * factor));
      const height = Math.max(1, Math.round(img.naturalHeight * factor));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(img, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type));
      if (!blob) throw new Error("The picture could not be scaled.");
      return { dataUrl: await blobToDataUrl(blob), width, height, bytes: blob.size };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function setPictureStatus(text) {
    el["generate-picture-status"].textContent = text;
    el["generate-picture-status"].hidden = !text;
  }

  /** A picture is chosen (or cleared): it is scaled now, so the bytes that will be sent are on screen before the press. Says nothing aloud. */
  function onPictureChange() {
    const file = el["generate-picture"].files && el["generate-picture"].files[0];
    el["generate-picture-remove"].hidden = !file;
    if (!file) {
      picture = null;
      el["generate-picture-name"].textContent = MESSAGES.pictureNone;
      setPictureStatus("");
      return;
    }
    el["generate-picture-name"].textContent = file.name + " (" + formatFileSize(file.size) + ")";
    if (!PICTURE_TYPES.includes(file.type)) {
      picture = { invalid: true };
      setPictureStatus(MESSAGES.generateBadPicture);
      return;
    }
    const chosen = { name: file.name, ready: null };
    chosen.ready = preparePicture(file);
    picture = chosen;
    setPictureStatus("Reading " + file.name + "…");
    chosen.ready.then(
      (p) => {
        if (picture === chosen) setPictureStatus("Picture: " + file.name + ". It will be sent at " + p.width + " by " + p.height + " pixels, " + p.bytes + " bytes.");
      },
      (e) => {
        logWarn("The picture could not be prepared:", e && e.message);
        if (picture === chosen) setPictureStatus(MESSAGES.generatePictureUnreadable);
      }
    );
  }

  /** "812 bytes", "46.3 KB", "2.1 MB": one decimal above a kilobyte. */
  function formatFileSize(bytes) {
    if (bytes < BYTES_PER_KB) return bytes + " bytes";
    if (bytes < BYTES_PER_MB) return (bytes / BYTES_PER_KB).toFixed(1) + " KB";
    return (bytes / BYTES_PER_MB).toFixed(1) + " MB";
  }

  /** Hands one file to the picture input exactly as a choice from the file dialogue would, so a drop and a paste share its path. */
  function takePictureFile(file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    el["generate-picture"].files = transfer.files;
    el["generate-picture"].dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Remove picture: back to the words-only route. Says nothing; focus goes to the input, since the button hides itself. */
  function onPictureRemove() {
    el["generate-picture"].value = "";
    el["generate-picture"].dispatchEvent(new Event("change", { bubbles: true }));
    el["generate-picture"].focus();
  }

  function onZoneDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    el["generate-picture-zone"].classList.add(DRAG_ACTIVE_CLASS);
  }

  function onZoneLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Only when really leaving the zone, not when moving between its children
    if (!el["generate-picture-zone"].contains(event.relatedTarget)) el["generate-picture-zone"].classList.remove(DRAG_ACTIVE_CLASS);
  }

  function onZoneDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    el["generate-picture-zone"].classList.remove(DRAG_ACTIVE_CLASS);
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (files.length > 1) {
      setPictureStatus(MESSAGES.generateOnePicture);
      return;
    }
    takePictureFile(files[0]);
  }

  /** True when the focused element takes typed text, so a paste there belongs to it. */
  function focusIsInTextEntry() {
    const focused = document.activeElement;
    if (!focused) return false;
    if (focused.isContentEditable || focused.tagName === "TEXTAREA") return true;
    return focused.tagName === "INPUT" && !NON_TEXT_INPUT_TYPES.includes((focused.getAttribute("type") || "text").toLowerCase());
  }

  /** An image on the clipboard is taken while the Studio is showing and focus is not in a text entry. Any other paste is left alone. */
  function onPaste(event) {
    if (!el.app.checkVisibility() || focusIsInTextEntry()) return;
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    const item = Array.from(items).find((entry) => entry.kind === "file" && entry.type.startsWith(IMAGE_MIME_PREFIX));
    const file = item && item.getAsFile();
    if (!file) return;
    event.preventDefault();
    takePictureFile(file);
  }

  /** Hide the proposal, the earlier attempts and the sentence about the last press. Says nothing. Keeps the words and the picture. */
  function clearGenerate() {
    drawing = null;
    el["generate-result"].hidden = true;
    el["generate-stale"].hidden = true;
    for (const id of ["compare-left-img", "compare-right-img"]) {
      el[id].removeAttribute("src");
      el[id].setAttribute("alt", "");
    }
    el["generate-summary"].textContent = "";
    el["generate-code"].textContent = "";
    el["generate-attempts"].replaceChildren();
    el["generate-status"].hidden = true;
    el["generate-status"].textContent = "";
  }

  /** Each proposal that did not render, in a closed <details>: what it was meant to be, the problems it left, and its code. */
  function showDrawingAttempts(attempts) {
    el["generate-attempts"].replaceChildren();
    for (const attempt of attempts) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Attempt " + attempt.n + " did not render";
      details.appendChild(summary);
      const said = document.createElement("p");
      said.textContent = attempt.summary || MESSAGES.generateNoSummary;
      details.appendChild(said);
      const left = document.createElement("p");
      left.textContent = "Problems it left:";
      details.appendChild(left);
      const problems = document.createElement("ul");
      for (const e of attempt.errors || []) {
        const li = document.createElement("li");
        li.textContent = (e.line ? "Line " + e.line + ": " : "") + e.message;
        problems.appendChild(li);
      }
      details.appendChild(problems);
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = attempt.source;
      pre.appendChild(code);
      details.appendChild(pre);
      el["generate-attempts"].appendChild(details);
    }
  }

  /** The two panels: on the left the picture the author chose, or a copy of the preview as it is now; on the right the AI's drawing. */
  function showCompare(outcome, prepared) {
    const left = el["compare-left-img"];
    const none = el["compare-left-none"];
    none.hidden = true;
    left.hidden = false;
    if (prepared) {
      left.setAttribute("src", prepared.dataUrl);
      left.setAttribute("alt", MESSAGES.compareYourPicture);
      el["compare-left-caption"].textContent = MESSAGES.compareYourPicture;
    } else {
      /* OD1-COMPARE */ const svg = currentDrawingString();
      el["compare-left-caption"].textContent = MESSAGES.compareYourDiagram;
      if (svg) {
        left.setAttribute("src", svgDataUrl(svg));
        left.setAttribute("alt", MESSAGES.compareYourDiagram);
      } else {
        left.removeAttribute("src");
        left.setAttribute("alt", "");
        left.hidden = true;
        none.hidden = false;
      }
    }
    el["compare-right-img"].setAttribute("src", svgDataUrl(outcome.svg));
    el["compare-right-img"].setAttribute("alt", "The AI's drawing: " + (outcome.summary || MESSAGES.generateNoSummary));
  }

  /** The Draw with AI button: one press, at most three model sends, one announcement. A press while a request is out stops it. */
  async function onGenerate() {
    const llm = window.TikzStudioLLM;
    if (generating) {
      if (llm) llm.cancel();
      return;
    }
    if (!llm || typeof llm.generate !== "function") return generateSay(MESSAGES.generateUnavailable);
    const words = el["generate-prompt"].value.trim();
    if (picture && picture.invalid) return generateSay(MESSAGES.generateBadPicture);
    if (!words && !picture) return generateSay(MESSAGES.generateMissing);

    clearGenerate();
    generating = true;
    generateSilent = false;
    el.generate.textContent = MESSAGES.generateBusy;
    const sourceAtStart = el.source.value;
    let outcome = null;
    let prepared = null;
    try {
      if (picture) {
        try {
          prepared = await picture.ready;
        } catch (e) {
          logWarn("The picture could not be prepared:", e && e.message);
          return generateSay(MESSAGES.generatePictureUnreadable);
        }
      }
      outcome = await llm.generate({ words, pictureDataUrl: prepared ? prepared.dataUrl : "", trialRender: C.trialRender });
    } finally {
      generating = false;
      el.generate.textContent = MESSAGES.generateIdle;
    }
    if (generateSilent) return;
    if (!outcome.ok) {
      if (outcome.reason === "no-drawing") showDrawingAttempts(outcome.attempts || []);
      return generateSay(outcome.reason === "cancelled" || outcome.reason === "no-model" || outcome.reason === "sign-in" || outcome.reason === "truncated" || outcome.reason === "parse" || outcome.reason === "no-drawing" ? outcome.message : "The drawing could not be made. " + outcome.message);
    }
    showCompare(outcome, prepared);
    el["generate-summary"].textContent = outcome.summary || MESSAGES.generateNoSummary;
    el["generate-code"].textContent = outcome.source;
    showDrawingAttempts(outcome.attempts || []);
    drawing = { source: outcome.source, sourceAtStart };
    el["generate-stale"].hidden = el.source.value === sourceAtStart;
    el["generate-stale"].textContent = MESSAGES.generateStale;
    el["generate-result"].hidden = false;
    generateSay(MESSAGES.generateReady);
  }

  /** Use this drawing: the source is replaced through the browser's own edit command (so Ctrl+Z undoes it), then the normal render runs. */
  function onGenerateUse() {
    if (!drawing) return;
    const next = drawing.source;
    clearGenerate();
    const ta = el.source;
    ta.focus();
    ta.select();
    if (!document.execCommand("insertText", false, next)) {
      ta.value = next;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
    requestRender({ explicit: true });
  }

  function onGenerateDiscard() {
    clearGenerate();
    el.generate.focus();
  }

  /** What Download HTML exports. Exposed so the specs can call getContent without a real download. */
  const exportOptions = {
    getContent() {
      const html = C.buildFigureHtml(bound ? readFields() : { alt: "", caption: "", longdesc: "", isDecorative: false }, bound ? el.source.value : "");
      if (!html) throw new Error(MESSAGES.renderFirst);
      return withChosenFont(html);
    },
    getTitle() {
      return (bound && el.caption.value.trim()) || "TikZ figure";
    },
  };

  // ------------------------------------------------------------------ templates
  function loadTemplates() {
    if (templates.length) return;
    fetch(new URL(TEMPLATES_PATH, document.baseURI).href)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        templates = Array.isArray(data.templates) ? data.templates : [];
        for (const t of templates) {
          const option = document.createElement("option");
          option.value = t.id;
          option.textContent = t.name;
          el.template.appendChild(option);
        }
      })
      .catch((e) => {
        logWarn("Templates did not load:", e && e.message);
        el.template.disabled = true;
        el["template-load"].disabled = true;
      });
  }

  // ------------------------------------------------------------------ what this Studio can draw (K2)
  // The lists come from tikz-studio/supported-packages.json, which tikz-studio/docs/build-supported-packages.mjs builds from the
  // engine's own file set, so the page cannot name a package the engine lacks or hide one it has.
  function listItem(text) {
    const li = document.createElement("li");
    li.textContent = text;
    return li;
  }

  function fillSupported(data) {
    const purposes = data.purposes || {};
    el["supported-packages"].replaceChildren(...data.packages.map((name) => listItem(purposes[name] ? name + " — " + purposes[name] : name)));
    el["supported-builtin"].textContent = "Always loaded, with no \\usepackage line: " + data.builtIn.join(", ") + ".";
    el["supported-libraries"].textContent = data.libraries.join(", ");
    el.unavailable.replaceChildren(...data.notAvailable.map((n) => listItem(n.name + " — " + n.why)));
  }

  function loadSupported() {
    /* K2-LIST-SITE */
    fetch(new URL(SUPPORTED_PATH, document.baseURI).href)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(fillSupported)
      .catch((e) => {
        logWarn("The supported-packages list did not load:", e && e.message);
        el["supported-packages"].replaceChildren(listItem(MESSAGES.supportedUnavailable));
      });
  }

  /** Replace the source with a template through the browser's own edit command, so Ctrl+Z undoes it. */
  function onTemplateLoad() {
    const template = templates.find((t) => t.id === el.template.value);
    if (!template) {
      setStatus(MESSAGES.templateFirst);
      el.template.focus();
      return;
    }
    const ta = el.source;
    ta.focus();
    ta.select();
    if (!document.execCommand("insertText", false, template.source)) {
      ta.value = template.source;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
  }

  // ------------------------------------------------------------------ preview column pin (P5f)
  /**
   * On a wide window the CSS pins the preview column (drawing and downloads) with `top: var(--tikz-studio-column-top)`. A pinned box taller
   * than the window would hide its own bottom, so the property is kept at min(1rem, window height - column height - 1rem): a column that
   * fits pins 1rem from the top; a taller one gets a negative top, scrolls with the page until its bottom meets the window's bottom, then
   * pins there. Below 64em the CSS does not pin, so the property is harmless there. Read and written only; nothing moves by itself.
   */
  function watchPreviewColumn() {
    const column = el.app.querySelector("." + PREVIEW_COLUMN_CLASS);
    if (!column) {
      logWarn("The preview column was not found, so it will not follow the window.");
      return;
    }
    const update = () => {
      const margin = parseFloat(getComputedStyle(document.documentElement).fontSize) || FALLBACK_ROOT_PX;
      const height = column.getBoundingClientRect().height;
      const top = Math.min(margin, window.innerHeight - height - margin);
      column.style.setProperty(COLUMN_TOP_PROPERTY, Math.round(top * 100) / 100 + "px");
    };
    update();
    if (typeof ResizeObserver === "function") new ResizeObserver(update).observe(column);
    window.addEventListener("resize", update);
  }

  // ------------------------------------------------------------------ the draw on open (EX1)
  /**
   * The starter text is an example, so draw it once when the Studio first opens rather than showing an empty preview until Render is pressed.
   * Only if the preview is empty and the source is not (init runs once per page, but a drawing already shown is never replaced). Silent:
   * no announcement, no focus move; the status line says what a quiet render always says. One explicit render, not "live on": live mode
   * can be off on a machine that cannot run the Worker (applyMode), and the open draw must not depend on it.
   */
  async function drawOnOpen() {
    if (!bound || el.figure.querySelector("svg") || el.source.value.trim() === "") return;
    await requestRender({ explicit: false, /* EX1-SILENT */ silent: true });
  }

  // ------------------------------------------------------------------ lifecycle
  async function doInit() {
    if (!bind()) return false;
    watchPreviewColumn();
    const kit = await C.initKit();
    if (!kit) return false;
    applyMode();
    syncFieldsFromSource();
    loadTemplates();
    loadSupported();
    refreshPngSizes();
    if (!el.status.textContent.trim()) setStatus(MESSAGES.ready);
    // Not awaited: the tool switch moves focus when init resolves, and a TeX run must not hold that back. whenReady() waits for it instead.
    /* EX1-OPEN-RENDER */ openDraw = drawOnOpen().catch((e) => logError("draw on open failed:", e));
    return true;
  }

  function init() {
    if (!initPromise) {
      initPromise = doInit()
        .catch((e) => {
          logError("init failed:", e);
          return false;
        })
        .then((ok) => {
          if (!ok) initPromise = null;
          return ok;
        });
      readyWaiters.splice(0).forEach((resolve) => resolve(initPromise));
    }
    return initPromise;
  }

  /** Resolves with init's result once the draw on open (if any) has finished too, so a caller that renders next never races it. */
  function whenReady() {
    const ready = initPromise ? initPromise : new Promise((resolve) => readyWaiters.push(resolve));
    return ready.then((ok) => (openDraw ? openDraw.then(() => ok) : ok));
  }

  /** Called by TOOL_CONFIG when the tool is left: nothing may outlive it. An aborted run is silent. */
  function cleanup() {
    clearTimeout(liveTimer);
    pending = null;
    C.abort();
    if (describing && window.TikzStudioLLM) {
      describeSilent = true;
      window.TikzStudioLLM.cancel();
    }
    if (fixing && window.TikzStudioLLM) {
      fixSilent = true;
      window.TikzStudioLLM.cancel();
    }
    if (generating && window.TikzStudioLLM) {
      generateSilent = true;
      window.TikzStudioLLM.cancel();
    }
  }

  function state() {
    return {
      describing,
      fixing,
      generating,
      busy: C.state.busy,
      mode: C.state.mode,
      ranIn: C.state.ranIn,
      hasSvg: !!C.state.svg,
      errorSignature: currentSignature,
      live: bound ? liveOn() : false,
      liveAllowed: liveAllowed(),
    };
  }

  window.TikzStudio = {
    init,
    whenReady,
    cleanup,
    state,
    config: C.config,
    announce,
    exportOptions,
    getFigureHtml: () => (bound ? C.buildFigureHtml(readFields(), el.source.value) : null),
  };
  logInfo("TikzStudio ready");
})();
