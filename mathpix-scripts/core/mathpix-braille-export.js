/**
 * @file mathpix-braille-export.js
 * @description The "Braille (preview)" control in Resume Session (BR-3c, ruling BR-D3; released to everyone in the beta at
 * BR-3e, ruling BR-D6). Exposed as window.MathPixBrailleExport.
 *
 * The fieldset is written in tools.html and is always shown, with a one-line note that the files are made automatically and
 * not yet checked by a braille transcriber. This script only wires the button; the braille engine loads when it is pressed.
 *
 * Pressing "Make braille files" builds the document tree from the restored session, formats it as braille, and offers three
 * download LINKS (BR-D5, BR-3d) named from the source file: <stem>-braille.brf, <stem>-braille.txt (Unicode braille) and
 * <stem>-braille-proof.txt (the braille turned back into print, page by page, for a sighted person to check).
 * Nothing downloads by itself, so a browser's multiple-downloads prompt can never drop a file. The links' object URLs are
 * revoked when the next run starts or the session changes.
 * It makes no AI call, no OCR and no Convert request: everything runs in the browser.
 *
 * Announcement contract (announcement-placement-contract.md): nothing here is a live region. The outcome is the text focus
 * lands on. The status paragraph is focusable and not live; the text is written first and focus is moved to it, and every
 * later write carries the run's sequence number, so an older run can never overwrite a newer one. One line per outcome.
 * The link list is not live either.
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[BrailleExport]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[BrailleExport]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[BrailleExport]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[BrailleExport]", message, ...args);
  }

  const ELEMENT_IDS = Object.freeze({
    fieldset: "resume-braille-fieldset",
    layout: "resume-braille-layout",
    maths: "resume-braille-maths",
    text: "resume-braille-text",
    textInImage: "resume-braille-text-in-image",
    button: "resume-braille-btn",
    status: "resume-braille-status",
    links: "resume-braille-links",
    linkBrf: "resume-braille-link-brf",
    linkUnicode: "resume-braille-link-unicode",
    linkProof: "resume-braille-link-proof",
  });

  const FILE_SUFFIX = Object.freeze({ brf: "-braille.brf", unicode: "-braille.txt", proof: "-braille-proof.txt" });
  const LINK_LABEL = Object.freeze({ brf: "Braille file (BRF)", unicode: "Braille text (Unicode)", proof: "Print proof" });
  const MIME = Object.freeze({ brf: "text/plain;charset=us-ascii", text: "text/plain;charset=utf-8" });
  const DEFAULT_STEM = "braille";
  const SESSION_WATCH_MS = 1000;
  const WORD_LIMIT = 9;
  const NUMBER_WORDS = Object.freeze(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]);

  // Every line is fixed plain English. Raw errors go to the log at debug level only.
  const LINES = Object.freeze({
    working: "Making braille.",
    noDocument: "No braille made: there is no document yet. Open a saved session first.",
    failed: "No braille made: something went wrong. Try again.",
    refusedPrefix: "No braille made:",
  });

  /** Spoken counts write one to nine as words; larger counts stay as digits. */
  const countText = (n) => (n >= 1 && n <= WORD_LIMIT ? NUMBER_WORDS[n] : String(n));
  const plural = (n, singular, pluralForm) => `${countText(n)} ${n === 1 ? singular : pluralForm || singular + "s"}`;

  /** The outcome line for a finished run. Warnings follow the count; the pointer to the links comes last. */
  function readyLine(pageCount, warningCount) {
    const base = `Braille ready: ${plural(pageCount, "page")}`;
    const warnings = warningCount > 0 ? `, with ${plural(warningCount, "warning")}` : "";
    return `${base}${warnings}. Download the files below.`;
  }

  // Elements are looked up inside deps.scope (null means the whole document), so a guard row can drive a copy of the control
  // that sits somewhere it can take focus.
  const byId = (id) => (deps.scope || document).querySelector("#" + id);

  /** Everything a guard row may replace; each row restores what it found. */
  const deps = {
    scope: null, // null: the page's own control; a guard row sets an element holding a copy
    engine: null, // null: the formatter uses the shared engine
    createUrl: (text, mime) => URL.createObjectURL(new Blob([text], { type: mime })),
    revokeUrl: (url) => URL.revokeObjectURL(url),
    // The object that stands for the restored session; a different object means the session changed.
    sessionToken: () => {
      const restorer = typeof window.getMathPixSessionRestorer === "function" ? window.getMathPixSessionRestorer() : null;
      return (restorer && restorer.restoredSession) || null;
    },
    buildTree: async () => {
      await window.MathPixDocumentTree.ensureReady();
      return window.MathPixDocumentTree.build();
    },
    sourceName: () => {
      const restorer = typeof window.getMathPixSessionRestorer === "function" ? window.getMathPixSessionRestorer() : null;
      return (restorer && restorer.restoredSession && restorer.restoredSession.source && restorer.restoredSession.source.filename) || "";
    },
  };

  const state = { running: false, seq: 0, urls: [], session: null, watcher: null };

  /** Take the links down and revoke every object URL they held. Safe to call at any time. */
  function clearLinks() {
    if (state.watcher !== null) {
      clearInterval(state.watcher);
      state.watcher = null;
    }
    const urls = state.urls;
    state.urls = [];
    urls.forEach((url) => {
      try {
        deps.revokeUrl(url);
      } catch (error) {
        logDebug("revoke failed", String((error && error.message) || error).slice(0, 200));
      }
    });
    const list = byId(ELEMENT_IDS.links);
    if (!list) return;
    list.hidden = true;
    [ELEMENT_IDS.linkBrf, ELEMENT_IDS.linkUnicode, ELEMENT_IDS.linkProof].forEach((id) => {
      const link = byId(id);
      if (!link) return;
      link.removeAttribute("href");
      link.removeAttribute("download");
      link.textContent = "";
    });
  }

  /** If the restored session is no longer the one the links were made from, take the links down. Returns whether it did. */
  function checkSession() {
    if (state.urls.length === 0 || deps.sessionToken() === state.session) return false;
    clearLinks();
    return true;
  }

  /** Show the three links for the files just made. files: [{ id, name, label, url }]. */
  function offerLinks(files) {
    const list = byId(ELEMENT_IDS.links);
    if (!list) return;
    files.forEach((file) => {
      const link = byId(file.id);
      if (!link) return;
      link.href = file.url;
      link.download = file.name;
      link.textContent = `${file.label}, ${file.name}`;
    });
    list.hidden = false;
    state.watcher = setInterval(checkSession, SESSION_WATCH_MS);
  }

  /** The file name stem: the source file name without its extension, with anything awkward in a file name made safe. */
  function stemOf(name) {
    const base = String(name || "").replace(/\.[^/.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return base || DEFAULT_STEM;
  }

  /**
   * Write one line into the status, but only for the run that still owns it. Returns whether it wrote.
   * A write that lands after an await carries the sequence number it was armed with and does nothing when a later run has moved it.
   */
  function writeStatus(seq, text) {
    if (seq !== state.seq) return false;
    const status = byId(ELEMENT_IDS.status);
    if (!status) return false;
    status.textContent = text;
    return true;
  }

  function readOptions() {
    const value = (id, fallback) => (byId(id) && byId(id).value) || fallback;
    const box = byId(ELEMENT_IDS.textInImage);
    return {
      profile: value(ELEMENT_IDS.layout, "ukaaf"),
      mathCode: value(ELEMENT_IDS.maths, "UEB"),
      grade: value(ELEMENT_IDS.text, "g2"),
      includeTextInImage: box ? box.checked : true,
    };
  }

  /** Run once: build the tree, format it, offer three downloads, write one outcome line. Resolves to the outcome text. */
  async function run() {
    if (state.running) return null;
    const formatter = window.MathPixBrailleFormatter;
    const button = byId(ELEMENT_IDS.button);
    const status = byId(ELEMENT_IDS.status);
    if (!formatter || !button || !status) return null;

    state.running = true;
    state.seq += 1;
    const mine = state.seq;
    const options = readOptions();

    // The previous run's links go (and their object URLs are revoked) before anything new is made.
    clearLinks();

    // Text first, then focus on the status; only then is the button disabled, so focus never drops to the body.
    writeStatus(mine, LINES.working);
    status.focus();
    button.disabled = true;

    let outcome = LINES.failed;
    try {
      let tree = null;
      try {
        tree = await deps.buildTree();
      } catch (error) {
        logDebug("tree build failed", String((error && error.message) || error).slice(0, 200));
        outcome = LINES.noDocument;
      }
      if (tree) {
        const result = await formatter.format(tree, { ...options, engine: deps.engine || undefined });
        if (!result.ok) {
          outcome = `${LINES.refusedPrefix} ${result.reason}`;
        } else {
          const proof = await formatter.toProof(result.pages, deps.engine || undefined, { warnings: result.warnings });
          const stem = stemOf(deps.sourceName());
          if (mine === state.seq) {
            const made = [
              { id: ELEMENT_IDS.linkBrf, label: LINK_LABEL.brf, name: stem + FILE_SUFFIX.brf, text: formatter.toBRF(result.pages, deps.engine || undefined), mime: MIME.brf },
              { id: ELEMENT_IDS.linkUnicode, label: LINK_LABEL.unicode, name: stem + FILE_SUFFIX.unicode, text: formatter.toUnicodeText(result.pages), mime: MIME.text },
              { id: ELEMENT_IDS.linkProof, label: LINK_LABEL.proof, name: stem + FILE_SUFFIX.proof, text: proof, mime: MIME.text },
            ];
            const files = made.map((file) => {
              const url = deps.createUrl(file.text, file.mime);
              state.urls.push(url);
              return { id: file.id, label: file.label, name: file.name, url };
            });
            state.session = deps.sessionToken();
            offerLinks(files);
            outcome = readyLine(result.pages.length, result.warnings.length);
          }
        }
      }
    } catch (error) {
      logError("braille export failed", error);
      outcome = LINES.failed;
    } finally {
      writeStatus(mine, outcome);
      state.running = false;
      button.disabled = false;
    }
    return outcome;
  }

  /** Wire the button inside `scope` to a run. init() does this for the page; a guard row does it for its copy. */
  function bind(scope) {
    const button = scope.querySelector("#" + ELEMENT_IDS.button);
    if (button) button.addEventListener("click", () => { run(); });
  }

  function init() {
    bind(document);
  }

  window.MathPixBrailleExport = Object.freeze({
    deps, run, bind, writeStatus, stemOf, readyLine, clearLinks, checkSession, LINES, ELEMENT_IDS,
    isRunning: () => state.running,
    currentSeq: () => state.seq,
    advanceSeq: () => { state.seq += 1; return state.seq; },
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  logInfo("MathPixBrailleExport registered (nothing braille loads until the button is pressed)");
})();
