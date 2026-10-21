/**
 * @file tikz-studio-controller.js
 * @description The engine side of TikZ Studio: loads tikz-kit lazily on the first switch to the tool, owns the render
 * pipeline (one TeX run at a time, timeout, abort, a trailing re-render), and reads and writes the `% @alt:` family of
 * annotation lines in the source. It touches no DOM except the <script> tags it appends. The page side is
 * tikz-studio-ui.js, which exposes `window.TikzStudio`.
 *
 * Plain script, no import/export, loaded eagerly by tools.html. The kit itself (about 480 KB of engine) is NOT loaded
 * here: see loadKit().
 *
 * @module TikzStudioController
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzStudioController]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzStudioController]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TikzStudioController]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[TikzStudioController]", message, ...args);
  }

  // Resolved against the page, so the kit is found whether tools.html is served from a root or a sub-folder.
  const KIT_FOLDER = "tikz-kit/";
  // Load order is the kit's own: engine bundle, figure helpers, kit, then PNG.
  const KIT_SCRIPTS = Object.freeze(["vendor/tikz-engine.js", "tikz-kit-figure.js", "tikz-kit.js", "tikz-kit-png.js"]);
  const FIGURE_NUMBER = 1; // the Studio edits one figure, so every id prefix is tikz-fig-1-
  const ANNOTATION_LINE = /^\s*%+\s*@(alt|caption|longdesc|decorative)\b/i;

  /** Mutable on purpose: the behaviour spec shortens the timeout and the debounce. Read at use, never cached. */
  const config = {
    timeoutMs: 30000,
    debounceMs: 800,
  };

  const state = {
    mode: null, // "worker" | "main-thread", from TikzKit.init
    workerFallbackReason: null,
    busy: false,
    ranIn: null,
    svg: null, // the last SUCCESSFUL render's SVG, or null after a failure
    ms: 0,
    inFlight: null, // { controller, aborted }
  };

  let kitPromise = null;
  let kitInitPromise = null;

  function pageConfig() {
    return window.TikzStudioConfig && typeof window.TikzStudioConfig === "object" ? window.TikzStudioConfig : {};
  }

  /** Append one script and resolve when it has run; reject (and remove the tag) if it will not load. */
  function appendScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load the kit's four scripts, once, in order. Lazy on purpose: 480 KB of engine on every tools.html load, for a tool most
   * visits never open, is the cost the Ally course data was moved off. The flag is reset on failure so a later switch retries.
   * @returns {Promise<boolean>}
   */
  function loadKit() {
    if (window.TikzKit && window.TikzKitFigure && window.TikzKitPng) return Promise.resolve(true);
    if (kitPromise) return kitPromise;
    kitPromise = (async () => {
      try {
        for (const rel of KIT_SCRIPTS) {
          await appendScript(KIT_FOLDER + rel);
        }
        return true;
      } catch (e) {
        logError("The TikZ kit did not load:", e.message);
        kitPromise = null;
        return false;
      }
    })();
    return kitPromise;
  }

  /**
   * Load the kit and start it. Resolves with TikzKit.init's result, or null if the kit could not start.
   * @returns {Promise<{mode:string, workerFallbackReason:(string|null)}|null>}
   */
  function initKit() {
    if (kitInitPromise) return kitInitPromise;
    kitInitPromise = (async () => {
      if (!(await loadKit())) {
        kitInitPromise = null;
        return null;
      }
      try {
        const opts = { vendorUrl: new URL(KIT_FOLDER + "vendor", document.baseURI).href };
        if (pageConfig().useWorker === false) opts.useWorker = false;
        const result = await window.TikzKit.init(opts);
        state.mode = result.mode;
        state.workerFallbackReason = result.workerFallbackReason || null;
        return result;
      } catch (e) {
        logError("TikzKit.init failed:", e && e.message);
        kitInitPromise = null;
        return null;
      }
    })();
    return kitInitPromise;
  }

  /** Whether live (render-as-you-type) is allowed: only when TeX runs in a Worker, so a loop cannot freeze the page. */
  function isLiveAllowed() {
    const mode = state.mode;
    const liveAllowed = mode === "worker";
    return liveAllowed;
  }

  // ------------------------------------------------------------------ rendering
  /**
   * Run TeX once. Never rejects. Only one run at a time: a caller that finds `busy` must queue itself.
   * @param {string} source
   * @returns {Promise<{ok:boolean, aborted:boolean, svg:(string|null), errors:Array, log:string, ms:number, ranIn:(string|null)}>}
   */
  async function renderOnce(source) {
    const flight = { controller: new AbortController(), aborted: false };
    state.inFlight = flight;
    state.busy = true;
    let r;
    try {
      r = await window.TikzKit.render(source, { figureId: FIGURE_NUMBER, timeoutMs: config.timeoutMs, signal: flight.controller.signal });
    } catch (e) {
      r = { ok: false, errors: [{ message: String((e && e.message) || e) }], log: "", ms: 0 };
    }
    state.inFlight = null;
    state.busy = false;
    const aborted = flight.aborted;
    state.ranIn = r.ranIn || null;
    state.ms = r.ms || 0;
    state.svg = r.ok && !aborted ? r.svg : null;
    logDebug("render finished", { ok: r.ok, aborted, ranIn: r.ranIn, ms: r.ms });
    return {
      ok: !!r.ok && !aborted,
      aborted,
      svg: state.svg,
      errors: Array.isArray(r.errors) ? r.errors : [],
      notes: Array.isArray(r.notes) ? r.notes : [],
      log: r.log || "",
      ms: r.ms || 0,
      ranIn: r.ranIn || null,
    };
  }

  // K2: plain sentences for what the engine cannot do. Each is chosen by the shape of TeX's own message and by nothing else;
  // any other message is returned exactly as TeX said it.
  const SEE_LIST = "The list under “What this Studio can draw” shows what it has.";
  const TOO_LARGE = "This drawing is too large for the engine.";
  const MISSING_PACKAGE_RE = /File [`']([^'`]+?)\.sty' not found/;
  const MISSING_LIBRARY_RES = [/did not find the tikz library '([^']+)'/, /File [`']tikzlibrary(.+?)\.code\.tex' not found/];
  const MISSING_FILE_RES = [/Could not read table file '([^']+)'/, /File [`']([^'`]+)' not found/];
  const LEFT_OUT_NOTE_RE = /^Left out (\S+) to try again/;

  /**
   * The sentence the Studio shows for one problem. `notes` are the kit's notes for the same run: an undefined command after a package
   * was left out is probably that package's.
   * @param {{message:string}} error
   * @param {string[]} [notes]
   * @returns {string}
   */
  function plainMessage(error, notes) {
    const raw = String((error && error.message) || "").trim();
    let m;
    if (/TeX capacity exceeded/i.test(raw)) return TOO_LARGE;
    if ((m = MISSING_PACKAGE_RE.exec(raw))) return "The package " + m[1] + " is not available in this Studio. " + SEE_LIST;
    for (const re of MISSING_LIBRARY_RES) {
      if ((m = re.exec(raw))) return "The TikZ library " + m[1] + " is not available in this Studio. " + SEE_LIST;
    }
    for (const re of MISSING_FILE_RES) {
      if ((m = re.exec(raw))) return "The drawing reads the file " + m[1] + ". The Studio cannot read files, so put what is in it into the source.";
    }
    if (/^Undefined control sequence/.test(raw)) {
      const left = (notes || []).map((n) => LEFT_OUT_NOTE_RE.exec(n)).find(Boolean);
      if (left) return raw + " The Studio left out the package " + left[1] + ", which is not available here, and that may be why.";
    }
    return raw;
  }

  /** Abort the run in flight, if any. The kit terminates its Worker, so a TeX loop stops. Returns whether a run was aborted. */
  function abort() {
    const flight = state.inFlight;
    if (!flight) return false;
    flight.aborted = true;
    flight.controller.abort();
    return true;
  }

  // BL1: elements that put marks on the sheet, and containers whose children are never painted where they stand.
  const MARK_ELEMENTS = new Set(["path", "rect", "line", "polyline", "polygon", "circle", "ellipse", "text", "use", "image"]);
  const UNPAINTED_CONTAINERS = new Set(["defs", "clippath", "mask", "symbol", "style", "script", "title", "desc", "metadata", "marker", "pattern"]);
  const SVG_STYLE_PROPERTIES = Object.freeze(["stroke", "fill", "stroke-width", "stroke-opacity", "fill-opacity", "opacity", "display", "visibility"]);
  const BLANK_MESSAGE = "The picture rendered, but nothing in it is visible. Draw with TikZ commands such as \\draw, \\fill, \\node and \\path, not with text-only nodes or packages that draw nothing here.";

  /** One property of an SVG element: the `style` attribute wins over the presentation attribute. Returns "" when neither sets it. */
  function svgProperty(el, name, styleMap) {
    if (styleMap && styleMap[name] !== undefined) return styleMap[name];
    const attr = el.getAttribute(name);
    return attr === null ? "" : attr.trim();
  }

  function parseStyleAttribute(el) {
    const out = {};
    const raw = el.getAttribute("style");
    if (!raw) return out;
    for (const part of raw.split(";")) {
      const at = part.indexOf(":");
      if (at < 0) continue;
      const key = part.slice(0, at).trim().toLowerCase();
      if (SVG_STYLE_PROPERTIES.includes(key)) out[key] = part.slice(at + 1).trim();
    }
    return out;
  }

  /**
   * BL1: does the SVG put anything on the sheet that a person could see? Judged from paint, not from markup: the kit can return a
   * drawing whose paths are all there with real coordinates but sit under `stroke="none"` and `fill="none"` (a text-only node that
   * the engine measured and did not draw), so "contains a path" is true of a blank picture. A mark counts when it is filled or stroked
   * with a colour, its opacity chain is above 0, and nothing above it is `display:none` or `visibility:hidden`. Defaults follow SVG:
   * fill black, stroke none, stroke-width 1. Clipping and zero-size boxes are NOT judged (that needs layout). Fails OPEN: anything it
   * cannot parse is treated as visible, because refusing a drawing it merely failed to read would cost a person a good one.
   * @param {string} svgText
   * @returns {boolean} false only when the SVG parses and holds no visible mark
   */
  function hasVisibleMarks(svgText) {
    let root;
    try {
      const doc = new DOMParser().parseFromString(String(svgText), "image/svg+xml");
      root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return true;
    } catch (e) {
      return true;
    }
    const isNone = (v) => v.toLowerCase() === "none";
    const zero = (v) => v !== "" && !Number.isNaN(parseFloat(v)) && parseFloat(v) <= 0;
    const walk = (el, inherited) => {
      const tag = el.localName.toLowerCase();
      if (UNPAINTED_CONTAINERS.has(tag)) return false;
      const style = parseStyleAttribute(el);
      const own = (name) => svgProperty(el, name, style);
      if (isNone(own("display")) || own("visibility").toLowerCase() === "hidden" || own("visibility").toLowerCase() === "collapse") return false;
      if (zero(own("opacity"))) return false;
      const paint = {
        stroke: own("stroke") || inherited.stroke,
        fill: own("fill") || inherited.fill,
        strokeWidth: own("stroke-width") || inherited.strokeWidth,
        strokeOpacity: own("stroke-opacity") || inherited.strokeOpacity,
        fillOpacity: own("fill-opacity") || inherited.fillOpacity,
      };
      if (MARK_ELEMENTS.has(tag)) {
        const filled = !isNone(paint.fill) && !zero(paint.fillOpacity);
        const stroked = !isNone(paint.stroke) && !zero(paint.strokeOpacity) && !zero(paint.strokeWidth);
        const hasContent = tag === "text" ? el.textContent.trim() !== "" : tag === "path" ? (el.getAttribute("d") || "").trim() !== "" : true;
        if (hasContent && (filled || stroked || tag === "image")) return true;
      }
      for (const child of el.children) if (walk(child, paint)) return true;
      return false;
    };
    return walk(root, { stroke: "none", fill: "#000", strokeWidth: "1", strokeOpacity: "1", fillOpacity: "1" });
  }

  /**
   * A trial run for a proposed fix (P4b): the kit renders `source` and NOTHING ELSE HAPPENS. It does not touch state (svg, busy, ranIn,
   * ms, inFlight), so the preview, the status line and the Stop button stay as the author's own last render left them, and it makes no
   * announcement. The kit queues its runs, so a trial that meets a render in progress simply waits its turn. Never rejects.
   * @param {string} source
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ok:boolean, errors:Array, log:string, svg:(string|null)}>} svg is the trial's drawing (P4c shows it beside the author's), kept out of state
   */
  async function trialRender(source, signal) {
    try {
      const trial = await window.TikzKit.render(source, { figureId: FIGURE_NUMBER, timeoutMs: config.timeoutMs, signal });
      const log = trial.log || "";
      // BL1: a picture with nothing visible in it is a failed trial, so the models' retry and escalation take over. The person's own Render is not judged.
      if (trial.ok && typeof trial.svg === "string" && !hasVisibleMarks(trial.svg)) {
        return { ok: false, errors: [{ message: BLANK_MESSAGE }], log, svg: null };
      }
      return { ok: !!trial.ok, errors: Array.isArray(trial.errors) ? trial.errors : [], log, svg: trial.ok && typeof trial.svg === "string" ? trial.svg : null };
    } catch (e) {
      return { ok: false, errors: [{ message: String((e && e.message) || e) }], log: "" };
    }
  }

  /** Above this many line pairs the diff does not search for common lines inside the changed block: it shows the block whole. */
  const DIFF_PAIR_LIMIT = 4000000;

  /**
   * The lines that differ between two sources, computed here and never taken from the model. Rows are grouped by change: the old lines
   * removed, then the new lines added, each with its own line number (removed rows count in the old text, added rows in the new).
   * `changed` is the number of lines changed (a replaced line counts once, a run of added or removed lines counts each);
   * `firstLine` is the 1-based line in the NEW text where the first change sits.
   * @param {string} oldText
   * @param {string} newText
   * @returns {{rows: Array<{type: "removed"|"added", line: number, text: string}>, changed: number, firstLine: number}}
   */
  function diffLines(oldText, newText) {
    const a = String(oldText).split("\n");
    const b = String(newText).split("\n");
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    let tailA = a.length;
    let tailB = b.length;
    while (tailA > head && tailB > head && a[tailA - 1] === b[tailB - 1]) {
      tailA--;
      tailB--;
    }
    const midA = a.slice(head, tailA);
    const midB = b.slice(head, tailB);
    const rows = [];
    let changed = 0;
    let firstLine = 0;
    const flush = (removed, added, newStart) => {
      if (!removed.length && !added.length) return;
      if (!firstLine) firstLine = newStart + 1;
      changed += Math.max(removed.length, added.length);
      rows.push(...removed, ...added);
    };
    if (midA.length * midB.length > DIFF_PAIR_LIMIT) {
      flush(
        midA.map((text, i) => ({ type: "removed", line: head + i + 1, text })),
        midB.map((text, i) => ({ type: "added", line: head + i + 1, text })),
        head
      );
      return { rows, changed, firstLine: Math.min(Math.max(firstLine, 1), b.length) };
    }
    // Longest common subsequence of the changed block, so an inserted line does not make every later line look changed.
    const n = midA.length;
    const m = midB.length;
    const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    let removed = [];
    let added = [];
    let hunkStart = head;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        flush(removed, added, hunkStart);
        removed = [];
        added = [];
        i++;
        j++;
        hunkStart = head + j;
      } else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) {
        removed.push({ type: "removed", line: head + i + 1, text: midA[i] });
        i++;
      } else {
        added.push({ type: "added", line: head + j + 1, text: midB[j] });
        j++;
      }
    }
    flush(removed, added, hunkStart);
    return { rows, changed, firstLine: Math.min(Math.max(firstLine, 1), b.length) };
  }

  /** A stable signature of an error set, so an identical repeat can be told from a change. */
  function errorSignature(errors) {
    return errors.map((e) => (e.line || 0) + ":" + e.message).join("|");
  }

  // ------------------------------------------------------------------ annotations
  function figureHelpers() {
    return window.TikzKitFigure;
  }

  /** Where the first picture starts (annotations sit in the comment lines immediately above it), or -1. */
  function anchorOf(text) {
    const blocks = figureHelpers().extractBlocks(text);
    return blocks.length ? blocks[0].start : -1;
  }

  /**
   * The long description's lines as the source holds them, one per `% @longdesc:` comment, joined with a newline. The kit's
   * parseAnnotations joins them with a space, which is right for the kit and would flatten the field's headings and lists the first
   * time the source was edited by hand (the fields are rewritten from the source), so the Studio reads its own lines. Same scan:
   * backwards from the picture over comment and blank lines.
   */
  function readLongdescLines(text, at) {
    const lines = text.slice(0, at).split(/\r?\n/);
    const annotationLines = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed === "") continue;
      if (!trimmed.startsWith("%")) break;
      annotationLines.unshift(trimmed);
    }
    const parts = [];
    for (const line of annotationLines) {
      const content = line.replace(/^%+\s*/, "").trim();
      if (!/^@longdesc:/i.test(content)) continue;
      const part = content.replace(/^@longdesc:\s*/i, "").trim();
      if (part) parts.push(part);
    }
    return parts.join("\n");
  }

  /** @returns {{alt:string, caption:string, longdesc:string, isDecorative:boolean}} the first picture's annotations */
  function readAnnotations(text) {
    const at = anchorOf(text);
    if (at < 0) return { alt: "", caption: "", longdesc: "", isDecorative: false };
    const parsed = figureHelpers().parseAnnotations(text, at);
    if (!parsed.isDecorative) parsed.longdesc = readLongdescLines(text, at);
    return parsed;
  }

  const oneLine = (s) => String(s == null ? "" : s).replace(/\s*\r?\n\s*/g, " ").trim();

  /**
   * Replace the annotation lines above the first picture with lines built from `fields`; every other line is left alone.
   * A decorative figure gets `% @decorative` and no alt or long description, as parseAnnotations would read it anyway.
   * With no picture in the text the lines go at the very top.
   * @param {string} text
   * @param {{alt:string, caption:string, longdesc:string, isDecorative:boolean}} fields
   * @returns {string}
   */
  function writeAnnotations(text, fields) {
    const at = anchorOf(text);
    const cut = at < 0 ? 0 : at;
    const head = text.slice(0, cut).split("\n");
    const tail = text.slice(cut);
    // drop the blank and annotation lines that sit directly above the block
    while (head.length && (head[head.length - 1].trim() === "" || ANNOTATION_LINE.test(head[head.length - 1]))) head.pop();
    const lines = [];
    if (fields.isDecorative) {
      lines.push("% @decorative");
    } else {
      const alt = oneLine(fields.alt);
      if (alt) lines.push("% @alt: " + alt);
    }
    const caption = oneLine(fields.caption);
    if (caption) lines.push("% @caption: " + caption);
    if (!fields.isDecorative) {
      String(fields.longdesc || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => lines.push("% @longdesc: " + l));
    }
    const before = head.length ? head.join("\n") + "\n" : "";
    return before + lines.map((l) => l + "\n").join("") + tail;
  }

  /**
   * THE LONG DESCRIPTION'S MARKUP. The field stays plain text an author can type. A line is one of:
   *   `## Heading`   a section heading (LONGDESC_HEADING_TAG)
   *   `- item`       an unordered list item
   *   `1. item`      an ordered list item (the number is ignored; the list numbers itself)
   *   anything else  a paragraph
   * Consecutive items of one kind share one list. A last line equal to CLOSING_LINE is the AI disclaimer. A long description typed
   * before this markup existed has no such lines and renders as before, one paragraph per line; the one change is that a plain line
   * which happens to begin `## `, `- ` or `1. ` is now a heading or an item.
   */
  const LONGDESC_HEADING_TAG = "h3"; // sibling of T1's generated "Data" heading; the chart and Mermaid exports use h4 under an h3 wrapper this figure lacks
  const CLOSING_LINE = "This description was written with AI and may contain mistakes. Check it against the figure.";
  // The wording before P4f (11 October 2026). A description saved with it is still recognised as the closing line and shown, and on
  // the next press replaced, in the new words, so it never appears twice.
  const LEGACY_CLOSING_LINES = Object.freeze(["Description written with AI; check it against the figure."]);
  const isClosingLine = (line) => line === CLOSING_LINE || LEGACY_CLOSING_LINES.includes(line);
  const HEADING_LINE = /^##\s+(\S.*)$/;
  const BULLET_LINE = /^-\s+(\S.*)$/;
  const NUMBERED_LINE = /^\d+\.\s+(\S.*)$/;

  /** The long description as author-supplied HTML: buildFigure trusts it, so every piece of text is escaped here and no author HTML survives. */
  function longdescHtml(longdesc) {
    const esc = figureHelpers().escapeHtml;
    const lines = String(longdesc || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let html = "";
    let open = ""; // "ul" or "ol" while a list is open
    const closeList = () => {
      if (open) html += "</" + open + ">";
      open = "";
    };
    const item = (tag, text) => {
      if (open !== tag) {
        closeList();
        html += "<" + tag + ">";
        open = tag;
      }
      html += "<li>" + esc(text) + "</li>";
    };
    lines.forEach((line, index) => {
      let m;
      if ((m = HEADING_LINE.exec(line))) {
        closeList();
        html += "<" + LONGDESC_HEADING_TAG + ">" + esc(m[1]) + "</" + LONGDESC_HEADING_TAG + ">";
      } else if ((m = BULLET_LINE.exec(line))) {
        item("ul", m[1]);
      } else if ((m = NUMBERED_LINE.exec(line))) {
        item("ol", m[1]);
      } else {
        closeList();
        const isClosing = index === lines.length - 1 && isClosingLine(line);
        // the closing line is shown in the current words whichever wording the field holds
        html += (isClosing ? '<p class="tikz-disclaimer">' : "<p>") + esc(isClosing ? CLOSING_LINE : line) + "</p>";
      }
    });
    closeList();
    return html;
  }

  /** A long description with the AI closing line as its last line, once. */
  function withClosingLine(longdesc) {
    const lines = String(longdesc || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !isClosingLine(l));
    return lines.length ? lines.concat(CLOSING_LINE).join("\n") : "";
  }

  /**
   * THE DESCRIPTION AS THE THREE COPIES, READING ALOUD AND SAVING SHARE (P5b): the alt sentence, then the long description. The
   * long description keeps its list markers and loses the `## ` of a heading; each paragraph, heading and list is separated by a blank line.
   * @param {{alt:string, longdesc:string, isDecorative:boolean}} fields
   * @returns {string} "" when there is nothing to say (a decorative figure, or no alt and no long description)
   */
  function descriptionText(fields) {
    if (fields.isDecorative) return "";
    const blocks = [];
    const alt = oneLine(fields.alt);
    if (alt) blocks.push(alt);
    let list = [];
    const flush = () => {
      if (list.length) blocks.push(list.join("\n"));
      list = [];
    };
    String(fields.longdesc || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        let m;
        if ((m = HEADING_LINE.exec(line))) {
          flush();
          blocks.push(m[1]);
        } else if (BULLET_LINE.test(line) || NUMBERED_LINE.test(line)) {
          list.push(line);
        } else {
          flush();
          blocks.push(isClosingLine(line) ? CLOSING_LINE : line);
        }
      });
    flush();
    return blocks.join("\n\n");
  }

  /** The same description as HTML: the alt sentence as a paragraph, then the long description as the figure renders it. */
  function descriptionHtml(fields) {
    if (fields.isDecorative) return "";
    const esc = figureHelpers().escapeHtml;
    const alt = oneLine(fields.alt);
    return (alt ? "<p>" + esc(alt) + "</p>" : "") + longdescHtml(fields.longdesc);
  }

  /** The contract figure for the last good render, or null if there is none. */
  function buildFigureHtml(fields, source) {
    if (!state.svg) return null;
    return figureHelpers().buildFigure({
      n: FIGURE_NUMBER,
      svg: state.svg,
      alt: fields.alt,
      caption: fields.caption,
      longdesc: longdescHtml(fields.longdesc),
      isDecorative: fields.isDecorative,
      source,
    });
  }

  /** 1-based line N of `text`, as a selection range. N is clamped to the text. */
  function lineRange(text, n) {
    const lines = text.split("\n");
    const idx = Math.min(Math.max(1, Math.floor(n) || 1), lines.length) - 1;
    let start = 0;
    for (let i = 0; i < idx; i++) start += lines[i].length + 1;
    return { start, end: start + lines[idx].length, line: idx + 1 };
  }

  window.TikzStudioController = {
    config,
    state,
    loadKit,
    initKit,
    isLiveAllowed,
    renderOnce,
    plainMessage,
    abort,
    trialRender,
    hasVisibleMarks,
    diffLines,
    errorSignature,
    readAnnotations,
    writeAnnotations,
    buildFigureHtml,
    longdescHtml,
    withClosingLine,
    descriptionText,
    descriptionHtml,
    CLOSING_LINE,
    lineRange,
  };
  logInfo("TikzStudioController ready");
})();
