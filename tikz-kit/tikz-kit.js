/**
 * @file tikz-kit.js
 * @description Renders TikZ / pgfplots / circuitikz / tikz-cd / chemfig source to SVG in the browser with
 * engine B (isomorphic-tikzjax, bundled in vendor/tikz-engine.js). One retained resource loader, a render
 * queue (the engine allows one run at a time), timeout and abort, TeX log capture, an error offset map,
 * per-figure font embedding and a sanitised, id-prefixed SVG.
 *
 * Nothing loads this yet: no shipped page references it. It makes no request except to `vendorUrl`
 * (same origin, checked in init()).
 *
 * @module TikzKit
 */
(function (root) {
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

  // These write to console.error / console.warn, never console.log: render() swaps console.log while it runs.
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzKit]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzKit]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[TikzKit]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[TikzKit]", message, ...args);
  }

  const DEFAULT_TIMEOUT_MS = 30000;
  // K2: TeX that runs out of memory writes this to its log and then never finishes, so the caller would wait out the whole timeout
  const CAPACITY_RE = /TeX capacity exceeded/;
  const CAPACITY_POLL_MS = 250;
  const CAPACITY_MESSAGE = "TeX capacity exceeded, sorry.";
  const DEFAULT_GRACE_MS = 5000; // how long the next render waits for a timed-out run before resetting the engine
  const ECHO_MARKER = "TikZJax: Rendering input:";
  const GENERIC_FAILURE = /^TeX engine render failed/;

  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Where this script was loaded from, read once while it runs: the Worker script sits beside it. Null when not a browser page.
  const KIT_SCRIPT_URL = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || null;
  const WORKER_FILE = "tikz-kit-worker.js";
  const WORKER_ENGINE_FILE = "tikz-worker-engine.js"; // under vendorUrl
  const RAN_IN = Object.freeze({ WORKER: "worker", MAIN: "main-thread" });

  function figureModule() {
    if (root.TikzKitFigure) return root.TikzKitFigure;
    if (typeof require === "function") return require("./tikz-kit-figure.js");
    throw new Error("tikz-kit-figure.js must be loaded before tikz-kit.js");
  }

  // =========================================================================
  // Source handling: directives, wrapping, log parsing
  // =========================================================================

  function commentIndex(line) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== "%") continue;
      let slashes = 0;
      for (let k = i - 1; k >= 0 && line[k] === "\\"; k--) slashes++;
      if (slashes % 2 === 0) return i;
    }
    return -1;
  }

  const PKG_RE = /\\usepackage\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/g;
  const LIB_RE = /\\usetikzlibrary\s*\{([^}]*)\}/g;

  /**
   * Lift \usepackage and \usetikzlibrary out of the source so they become engine options.
   * The matched text is blanked IN PLACE, so line numbers do not move. Commented directives are ignored.
   * One-line directives only: a \usepackage list split across lines is left for TeX to read as before.
   */
  function parseDirectives(source) {
    const packages = {};
    const libraries = [];
    const directives = [];
    const lines = String(source).split("\n");
    const out = lines.map((line, idx) => {
      const ci = commentIndex(line);
      const code = ci === -1 ? line : line.slice(0, ci);
      const comment = ci === -1 ? "" : line.slice(ci);
      const cleaned = code
        .replace(PKG_RE, (all, options, names) => {
          for (const raw of names.split(",")) {
            const name = raw.trim();
            if (!name) continue;
            packages[name] = options ? options.trim() : "";
            directives.push({ kind: "package", name, options: options || "", line: idx + 1 });
          }
          return "";
        })
        .replace(LIB_RE, (all, names) => {
          for (const raw of names.split(",")) {
            const name = raw.trim();
            if (!name) continue;
            if (!libraries.includes(name)) libraries.push(name);
            directives.push({ kind: "library", name, options: "", line: idx + 1 });
          }
          return "";
        });
      return cleaned + comment;
    });
    return { source: out.join("\n"), packages, libraries, directives };
  }

  function stripComments(text) {
    return String(text)
      .split("\n")
      .map((l) => {
        const ci = commentIndex(l);
        return ci === -1 ? l : l.slice(0, ci);
      })
      .join("\n");
  }

  // NP1: a source with no picture makes the engine's SVG step throw (MEASURED: "Cannot read properties of null (reading 'outerHTML')", whose
  // wording differs by browser), so the failure branch of that step says what is wrong instead. The test reads the source, never the message.
  const NOTHING_TO_DRAW = "The source has nothing to draw. Put the drawing between \\begin{tikzpicture} and \\end{tikzpicture}.";
  const PICTURE_RE = /\\begin\{(?:tikzpicture|tikzcd)\}|\\tikz(?![A-Za-z@])/;
  function nothingToDraw(source) {
    return !PICTURE_RE.test(stripComments(source));
  }

  // ---------------- K1: accepting what people paste from the web ----------------
  //
  // The first TeX run is the user's source exactly as before (apart from splitting a line the engine cannot read at all).
  // Only when it fails does the kit try again, at most MAX_RETRIES times inside the caller's one timeout, with the
  // smallest change the failure points to, and it says what it did in `notes`. The Studio does not show `notes` yet.

  const LONG_LINE_LIMIT = 4500; // MEASURED (W1): a 4,484-character line renders, a 4,997-character line does not
  const SPLIT_SIZE = 1500; // MEASURED (W1): lines split at 1,500 characters render
  const MAX_RETRIES = 2;
  const ENGINE_COMPAT = { major: 1, minor: 16 }; // MEASURED (W1): the engine ships pgfplots 1.16 and refuses a newer compat
  const LAYOUT_ONLY_PACKAGES = Object.freeze(["preview", "geometry", "verbatim", "fullpage", "a4wide", "fancyhdr", "fontenc", "inputenc", "lmodern", "subfig"]);
  const KEY_TO_LIBRARY = Object.freeze({
    "regular polygon": "shapes.geometric",
    "matrix of math nodes": "matrix",
    "matrix of nodes": "matrix",
    "spy using outlines": "spy",
    "spy scope": "spy",
    mindmap: "mindmap",
  });
  const CONTROL_SEQUENCE_TO_PACKAGE = Object.freeze({ pgfplotsset: "pgfplots", addplot: "pgfplots", leadsto: "amssymb", mathbb: "amssymb", operatorname: "amsmath", text: "amsmath" });
  // K3: the names tikz-uml and contour define, READ from the engine's own archive by .claude/measurements/k3-tikz-problem-packages/k3-derive-names.mjs
  // (tikz-uml.sty: 8 environments and 256 commands, the `uml` and `tikzuml` prefixes, \tikzumlset included; contour.sty: 3 commands).
  // problem-packages.test.mjs re-derives them and refuses a kit that differs.
  // An undefined one of these means the drawing uses the package but did not name it, so the kit adds the \usepackage line.
  const TIKZ_UML_ENVIRONMENTS = new Set(["umlcall", "umlcallself", "umlcomponent", "umlfragment", "umlpackage", "umlseqdiag", "umlstate", "umlsystem"]);
  const TIKZ_UML_COMMANDS = new Set(["tikzumlActorName", "tikzumlActorPos", "tikzumlAssemblyConnectorEndAnchor", "tikzumlAssemblyConnectorFirstArm", "tikzumlAssemblyConnectorLastArm", "tikzumlAssemblyConnectorMiddleArm", "tikzumlAssemblyConnectorSecondArm", "tikzumlAssemblyConnectorStartAnchor", "tikzumlAssemblyConnectorWithPort", "tikzumlAssocClassAttributes", "tikzumlAssocClassDestAnchor", "tikzumlAssocClassHPadding", "tikzumlAssocClassName", "tikzumlAssocClassNodeName", "tikzumlAssocClassOperations", "tikzumlAssocClassPos", "tikzumlAssocClassRelationName", "tikzumlAssocClassSrcAnchor", "tikzumlAssocClassType", "tikzumlAssocClassVPadding", "tikzumlCNRelationAlignT", "tikzumlCNRelationAttrNameT", "tikzumlCNRelationDestAnchor", "tikzumlCNRelationMultiplicityT", "tikzumlCNRelationPositionT", "tikzumlCNRelationSrcAnchor", "tikzumlCall", "tikzumlCallDT", "tikzumlCallEndNodeName", "tikzumlCallStartNodeName", "tikzumlCallWithReturn", "tikzumlClassAttributes", "tikzumlClassHPadding", "tikzumlClassName", "tikzumlClassNodeName", "tikzumlClassOperations", "tikzumlClassPos", "tikzumlClassTags", "tikzumlClassType", "tikzumlClassVPadding", "tikzumlComponent", "tikzumlComponentFitTmp", "tikzumlComponentLayersNum", "tikzumlCreateCallSrc", "tikzumlDelegateConnectorWithEndPort", "tikzumlDelegateConnectorWithStartPort", "tikzumlDestClassName", "tikzumlFirstArc", "tikzumlFragmentLabel", "tikzumlFragmentLayersNum", "tikzumlInterfaceWithPort", "tikzumlLastArc", "tikzumlMidOneArc", "tikzumlNaryName", "tikzumlNaryNodeAnchor", "tikzumlNaryNodeLabelPos", "tikzumlNarynodePos", "tikzumlNoteDestAnchor", "tikzumlNoteSrcAnchor", "tikzumlObjectName", "tikzumlPackage", "tikzumlPackageFitTmp", "tikzumlPackageLayersNum", "tikzumlPackageType", "tikzumlRelationAlignT", "tikzumlRelationAttrNameT", "tikzumlRelationDestAnchor", "tikzumlRelationMultiplicityT", "tikzumlRelationPositionT", "tikzumlRelationSrcAnchor", "tikzumlSrcClassName", "tikzumlState", "tikzumlStateDecisionPos", "tikzumlStateDeepHistoryPos", "tikzumlStateEndPos", "tikzumlStateEnterPos", "tikzumlStateExitPos", "tikzumlStateFinalPos", "tikzumlStateFitTmp", "tikzumlStateHistoryPos", "tikzumlStateInitialPos", "tikzumlStateJoinPos", "tikzumlStateLayersNum", "tikzumlStateText", "tikzumlSystemName", "tikzumlUseCasePos", "tikzumlUseCaseText", "tikzumlcallSrc", "tikzumlcallheight", "tikzumlcallstyle", "tikzumlset", "tikzumlskipescape", "tikzumlstatebodyinnerysep", "tikzumlstaterootinnerysep", "tikzumlstaterootlabel", "umlCNaggreg", "umlCNassoc", "umlCNcompo", "umlCNdep", "umlCNextend", "umlCNfriend", "umlCNimpl", "umlCNimport", "umlCNinclude", "umlCNinherit", "umlCNnest", "umlCNreal", "umlCNrelation", "umlCNtrans", "umlCNuniaggreg", "umlCNuniassoc", "umlCNunicompo", "umlHVHaggreg", "umlHVHassemblyconnector", "umlHVHassoc", "umlHVHcompo", "umlHVHdelegateconnector", "umlHVHdep", "umlHVHextend", "umlHVHfriend", "umlHVHimpl", "umlHVHimport", "umlHVHinclude", "umlHVHinherit", "umlHVHnest", "umlHVHnote", "umlHVHreal", "umlHVHrelation", "umlHVHtrans", "umlHVHuniaggreg", "umlHVHuniassoc", "umlHVHunicompo", "umlHVaggreg", "umlHVassemblyconnector", "umlHVassoc", "umlHVcompo", "umlHVdelegateconnector", "umlHVdep", "umlHVextend", "umlHVfriend", "umlHVimpl", "umlHVimport", "umlHVinclude", "umlHVinherit", "umlHVnest", "umlHVnote", "umlHVreal", "umlHVrelation", "umlHVtrans", "umlHVuniaggreg", "umlHVuniassoc", "umlHVunicompo", "umlNarynode", "umlVHVaggreg", "umlVHVassemblyconnector", "umlVHVassoc", "umlVHVcompo", "umlVHVdelegateconnector", "umlVHVdep", "umlVHVextend", "umlVHVfriend", "umlVHVimpl", "umlVHVimport", "umlVHVinclude", "umlVHVinherit", "umlVHVnest", "umlVHVnote", "umlVHVreal", "umlVHVrelation", "umlVHVtrans", "umlVHVuniaggreg", "umlVHVuniassoc", "umlVHVunicompo", "umlVHaggreg", "umlVHassemblyconnector", "umlVHassoc", "umlVHcompo", "umlVHdelegateconnector", "umlVHdep", "umlVHextend", "umlVHfriend", "umlVHimpl", "umlVHimport", "umlVHinclude", "umlVHinherit", "umlVHnest", "umlVHnote", "umlVHreal", "umlVHrelation", "umlVHtrans", "umlVHuniaggreg", "umlVHuniassoc", "umlVHunicompo", "umlabstract", "umlactor", "umlaggreg", "umlassemblyconnector", "umlassemblyconnectorsymbol", "umlassoc", "umlassocclass", "umlbasiccomponent", "umlbasicobject", "umlbasicstate", "umlbiassoc", "umlboundary", "umlclass", "umlcompo", "umlcontrol", "umlcreatecall", "umldatabase", "umldelegateconnector", "umldep", "umlemptyclass", "umlemptypackage", "umlentity", "umlenum", "umlextend", "umlfpart", "umlfriend", "umlimpl", "umlimport", "umlinclude", "umlinherit", "umlinterface", "umlmulti", "umlnest", "umlnode", "umlnote", "umlobject", "umlpoint", "umlport", "umlprovidedinterface", "umlreal", "umlrelation", "umlrequiredinterface", "umlsdnode", "umlsimpleclass", "umlsimpleinterface", "umlstatedecision", "umlstatedeephistory", "umlstateend", "umlstateenter", "umlstateexit", "umlstatefinal", "umlstatehistory", "umlstateinitial", "umlstatejoin", "umlstatetext", "umlstatic", "umltrans", "umltypedef", "umluniaggreg", "umluniassoc", "umlunicompo", "umlusecase", "umlvirt"]);
  const CONTOUR_COMMANDS = new Set(["contour", "contourlength", "contournumber"]);
  const UML_REPAIR = /* K3-UML-SITE */ true; // the test plant turns the tikz-uml repair off here, and nowhere else
  const CONTOUR_OUTLINE_OPTION = "outline"; // MEASURED (E2): needs PostScript, which this engine does not have
  const DOCUMENTCLASS_RE = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{[^}]*\}/;
  const PREVIEW_COMMAND_RE = /\\Preview[A-Za-z]*/;
  const COMPAT_RE = /(\bcompat\s*=\s*)(\d+)\.(\d+)/g;
  // K2: the standalone class's border= option, kept when the \documentclass line is ignored (M1 proposal A1).
  const BORDER_OPTION_RE = /(?:^|,)\s*border\s*=\s*(\{[^}]*\}|[^,\]]+)/;
  const BORDER_DIMENSION_RE = /^(\d*\.?\d+)\s*(pt|bp|cm|mm|in)$/;
  const TEX_POINTS_PER = Object.freeze({ pt: 1, bp: 72.27 / 72, cm: 72.27 / 2.54, mm: 72.27 / 25.4, in: 72.27 });
  const SVG_NUMBER_DECIMALS = 3;

  const NOTES = Object.freeze({
    documentclass: "Ignored the \\documentclass line.",
    border: (text) => "Kept the border of " + text + " from the \\documentclass line.",
    layout: (name) => "Ignored the layout package " + name + ".",
    preview: "Ignored the preview commands.",
    addedPackage: (name) => "Added the " + name + " package, which the drawing uses but did not name.",
    addedLibrary: (name) => "Added the TikZ library " + name + ", which the drawing uses but did not name.",
    leftOutOk: (name) => "Left out " + name + ": it is not available here and the drawing does not use it.",
    leftOutFailed: (name) => "Left out " + name + " to try again: it is not available here. If the drawing needs it, that is why it still fails.",
    compat: "Set pgfplots compat to " + ENGINE_COMPAT.major + "." + ENGINE_COMPAT.minor + ", the newest this engine has.",
    contourOutline: "Left out the outline option of contour: it needs PostScript, which this engine does not have.",
    split: (chars, line) => "Split a line of " + chars + " characters (line " + line + ") into shorter lines so the engine can read it.",
  });

  /**
   * The border a \documentclass option list asks for, in TeX points as [left, bottom, right, top], or null (no border option,
   * a size the kit cannot read in points, or a list that is not one, two or four sizes). standalone reads one size as all four
   * sides, two as horizontal and vertical, four as left, bottom, right, top.
   * @returns {{pt:number[], text:string}|null}
   */
  function parseBorder(options) {
    const m = BORDER_OPTION_RE.exec(String(options || ""));
    if (!m) return null;
    const text = m[1].replace(/^\{|\}$/g, "").trim().replace(/\s+/g, " ");
    const sizes = text.split(" ").map((part) => {
      const d = BORDER_DIMENSION_RE.exec(part);
      return d ? parseFloat(d[1]) * TEX_POINTS_PER[d[2]] : null;
    });
    if (sizes.some((s) => s === null)) return null;
    const pt = sizes.length === 1 ? [sizes[0], sizes[0], sizes[0], sizes[0]] : sizes.length === 2 ? [sizes[0], sizes[1], sizes[0], sizes[1]] : sizes.length === 4 ? sizes : null;
    return pt && pt.some((s) => s > 0) ? { pt, text } : null;
  }

  /** Grow the SVG root's viewBox, and its width and height at the same scale, by the border (left, bottom, right, top in TeX points). */
  function applyBorder(svg, border) {
    if (!border) return svg;
    const tag = /<svg\b(?:"[^"]*"|'[^']*'|[^'">])*>/.exec(svg);
    if (!tag) return svg;
    const attr = (name) => new RegExp("\\s" + name + "=\"([^\"]*)\"").exec(tag[0]);
    const vb = attr("viewBox");
    const width = attr("width");
    const height = attr("height");
    if (!vb || !width || !height) return svg;
    const [x, y, w, h] = vb[1].trim().split(/\s+/).map(Number);
    const wide = parseFloat(width[1]);
    const high = parseFloat(height[1]);
    if (![x, y, w, h, wide, high].every(Number.isFinite) || !(w > 0) || !(h > 0)) return svg;
    const [left, bottom, right, top] = border.pt;
    const round = (n) => String(+n.toFixed(SVG_NUMBER_DECIMALS));
    const grown = tag[0]
      .replace(vb[0], ' viewBox="' + [x - left, y - top, w + left + right, h + top + bottom].map(round).join(" ") + '"')
      .replace(width[0], ' width="' + round(wide + (left + right) * (wide / w)) + '"')
      .replace(height[0], ' height="' + round(high + (top + bottom) * (high / h)) + '"');
    return svg.slice(0, tag.index) + grown + svg.slice(tag.index + tag[0].length);
  }

  /** Cut `text` at spaces into pieces of about `size` characters. Returns null when a piece would still be over the limit. */
  function splitAtSpaces(text, size) {
    const pieces = [];
    let rest = text;
    while (rest.length > size) {
      let at = -1;
      for (let i = Math.min(size, rest.length - 1); i > 0; i--) {
        if (rest[i] === " " && rest[i - 1] !== "\\") {
          at = i;
          break;
        }
      }
      if (at === -1) {
        for (let i = size + 1; i < rest.length && i <= LONG_LINE_LIMIT; i++) {
          if (rest[i] === " " && rest[i - 1] !== "\\") {
            at = i;
            break;
          }
        }
      }
      if (at === -1) return null;
      pieces.push(rest.slice(0, at));
      rest = rest.slice(at + 1);
    }
    pieces.push(rest);
    return pieces;
  }

  /**
   * Split every line over LONG_LINE_LIMIT at spaces. A comment never leaks into code: the code part is split on its own,
   * and the comment goes on lines of its own, each starting with %.
   * @returns {{lines:string[], origin:number[], splits:Array<{line:number,chars:number}>, tooLong:null|{line:number,chars:number}}}
   */
  function splitLongLines(lines) {
    const out = [];
    const origin = [];
    const splits = [];
    let tooLong = null;
    lines.forEach((line, idx) => {
      if (line.length <= LONG_LINE_LIMIT) {
        out.push(line);
        origin.push(idx + 1);
        return;
      }
      const ci = commentIndex(line);
      const code = ci === -1 ? line : line.slice(0, ci);
      const comment = ci === -1 ? "" : line.slice(ci);
      const codePieces = splitAtSpaces(code, SPLIT_SIZE);
      if (!codePieces) {
        if (!tooLong) tooLong = { line: idx + 1, chars: line.length };
        out.push(line);
        origin.push(idx + 1);
        return;
      }
      const emit = [...codePieces];
      if (comment) {
        const last = emit[emit.length - 1];
        if (last.length + comment.length <= LONG_LINE_LIMIT) emit[emit.length - 1] = last + comment;
        else {
          // a comment is ignored by TeX, so one that cannot be split is cut rather than reported
          const bodyText = comment.slice(1).trim();
          const cp = splitAtSpaces(bodyText, SPLIT_SIZE) || [bodyText.slice(0, SPLIT_SIZE)];
          for (const piece of cp) emit.push("% " + piece);
        }
      }
      for (const piece of emit) {
        out.push(piece);
        origin.push(idx + 1);
      }
      splits.push({ line: idx + 1, chars: line.length });
    });
    return { lines: out, origin, splits, tooLong };
  }

  /**
   * The text TeX will read, plus everything needed to map its line numbers back.
   * `plan` is how the kit repairs a source after a failure (all optional; no plan is today's input):
   *   split: false switches off the splitting of very long lines (default on)
   *   fixes: true applies the changes that need no TeX message: the \documentclass line, layout-only packages,
   *          preview commands and a pgfplots compat the engine does not have
   *   addPackages / addLibraries: names to add; drop: names of \usepackage entries to leave out
   */
  function buildInput(engine, source, plan) {
    plan = plan || {};
    const notes = [];
    const norm = String(source).replace(/\r\n?/g, "\n");
    const sourceLines = norm.split("\n").length;

    let lines = norm.split("\n");
    let lineOrigin = null;
    let tooLong = null;
    if (plan.split !== false) {
      const s = splitLongLines(lines);
      tooLong = s.tooLong;
      if (s.splits.length) {
        lines = s.lines;
        lineOrigin = s.origin;
        for (const sp of s.splits) notes.push(NOTES.split(sp.chars, sp.line));
      }
    }

    let border = null;
    if (plan.fixes) {
      let sawClass = false;
      let sawPreview = false;
      let sawCompat = false;
      lines = lines.map((line) => {
        const ci = commentIndex(line);
        let code = ci === -1 ? line : line.slice(0, ci);
        const comment = ci === -1 ? "" : line.slice(ci);
        const classLine = DOCUMENTCLASS_RE.exec(code);
        if (classLine) {
          sawClass = true;
          border = border || parseBorder(classLine[1]);
          code = code.replace(DOCUMENTCLASS_RE, "");
        }
        if (PREVIEW_COMMAND_RE.test(code)) {
          sawPreview = true;
          code = "";
        }
        code = code.replace(COMPAT_RE, (all, head, major, minor, offset, whole) => {
          const newer = +major > ENGINE_COMPAT.major || (+major === ENGINE_COMPAT.major && +minor > ENGINE_COMPAT.minor);
          // not inside \usepackage[...]: pgfplots does not take compat as a package option, so clamping it there would only swap one error for another
          if (!newer || /\\usepackage\s*\[[^\]]*$/.test(whole.slice(0, offset))) return all;
          sawCompat = true;
          return head + ENGINE_COMPAT.major + "." + ENGINE_COMPAT.minor;
        });
        return code + comment;
      });
      if (sawClass) notes.push(NOTES.documentclass);
      if (border) notes.push(NOTES.border(border.text));
      if (sawPreview) notes.push(NOTES.preview);
      if (sawCompat) notes.push(NOTES.compat);
    }

    const d = parseDirectives(lines.join("\n"));
    const leftOut = [];
    if (plan.fixes) {
      for (const name of LAYOUT_ONLY_PACKAGES) {
        if (!(name in d.packages)) continue;
        delete d.packages[name];
        notes.push(NOTES.layout(name));
      }
      // K3: \usepackage[outline]{contour} fails in this engine (PostScript), so the option goes and the package stays
      if ("contour" in d.packages) {
        const options = d.packages.contour.split(",").map((o) => o.trim());
        if (options.includes(CONTOUR_OUTLINE_OPTION)) {
          d.packages.contour = options.filter((o) => o && o !== CONTOUR_OUTLINE_OPTION).join(",");
          notes.push(NOTES.contourOutline);
        }
      }
    }
    for (const name of plan.drop || []) {
      if (!(name in d.packages)) continue;
      delete d.packages[name];
      leftOut.push(name);
    }
    for (const name of plan.addPackages || []) {
      if (name in d.packages) continue;
      d.packages[name] = "";
      notes.push(NOTES.addedPackage(name));
    }
    for (const name of plan.addLibraries || []) {
      if (d.libraries.includes(name)) continue;
      d.libraries.push(name);
      notes.push(NOTES.addedLibrary(name));
    }

    const hasDocument = /\\begin\{document\}/.test(stripComments(d.source));
    // wrapping adds no line before the user's first line: \begin{document} shares it
    const body = hasDocument ? d.source : "\\begin{document}" + d.source + "\n\\end{document}";
    const tex = { texPackages: d.packages, tikzLibraries: d.libraries.join(",") };
    const preamble = engine.getTexPreamble(tex);
    return {
      input: preamble + body,
      body,
      texOptions: tex,
      preamble,
      preambleLines: (preamble.match(/\n/g) || []).length,
      directives: d.directives,
      wrapped: !hasDocument,
      sourceLines,
      lineOrigin, // null unless a line was split: then, for each line TeX reads, the user's line it came from
      processedLines: lines.length,
      notes,
      leftOut,
      tooLong,
      border, // null, or { pt: [left, bottom, right, top], text } read from the ignored \documentclass line
    };
  }

  /** The sentences for a finished run: what was done before TeX, and what was left out (said differently if it still failed). */
  function notesFor(built, ok) {
    return built.notes.concat(built.leftOut.map((n) => (ok ? NOTES.leftOutOk(n) : NOTES.leftOutFailed(n))));
  }

  /** The control sequence TeX could not find, read from the log around an "Undefined control sequence" error. */
  function undefinedControlSequence(log) {
    const after = (String(log).match(/Undefined control sequence\.[\s\S]{0,600}/) || [""])[0].split("\n").slice(1).join("\n");
    const recent = after.match(/<recently read>\s*\\([A-Za-z]+)/);
    const firstLine = after.split("\n").find((l) => l.trim() && !/^<recently read>/.test(l)) || "";
    const last = (firstLine.match(/\\([A-Za-z@]+)\s*$/) || [])[1] || null;
    return recent ? recent[1] : last;
  }

  /**
   * What the first error of a failed run points to, or null. One of
   * { addPackage }, { addLibrary } or { drop } (a \usepackage the engine does not have), each only if not done already.
   */
  function repairFor(attempt, built, plan) {
    const first = attempt.errors[0];
    if (!first) return null;
    const m = first.message || "";
    const named = (name) => name in built.texOptions.texPackages;
    const addPackage = (name) => (name && !named(name) ? { addPackage: name } : null);
    const addLibrary = (name) => (name && !built.texOptions.tikzLibraries.split(",").includes(name) ? { addLibrary: name } : null);
    let x;
    if ((x = /File [`']([^'`]+?)\.sty' not found/.exec(m))) {
      return built.directives.some((d) => d.kind === "package" && d.name === x[1]) && !(plan.drop || []).includes(x[1]) ? { drop: x[1] } : null;
    }
    if ((x = /Environment ([A-Za-z]+) undefined/.exec(m))) {
      if (x[1] === "axis") return addPackage("pgfplots");
      if (UML_REPAIR && TIKZ_UML_ENVIRONMENTS.has(x[1])) return addPackage("tikz-uml");
      return null;
    }
    if ((x = /You need to say \\usetikzlibrary\{([^}]+)\}/.exec(m))) return addLibrary(x[1]);
    if ((x = /do not know the key '\/tikz\/([^']+)'/.exec(m)) && KEY_TO_LIBRARY[x[1]]) return addLibrary(KEY_TO_LIBRARY[x[1]]);
    if (/Command \\\w+ not provided in base LaTeX2e/.test(m)) return addPackage("amssymb");
    if (/Unknown arrow tip kind/.test(m)) return addLibrary("arrows");
    if (/^Undefined control sequence/.test(m)) {
      const name = undefinedControlSequence(attempt.log);
      if (!name) return null;
      if (CONTROL_SEQUENCE_TO_PACKAGE[name]) return addPackage(CONTROL_SEQUENCE_TO_PACKAGE[name]);
      if (UML_REPAIR && TIKZ_UML_COMMANDS.has(name)) return addPackage("tikz-uml");
      if (CONTOUR_COMMANDS.has(name)) return addPackage("contour");
      return null;
    }
    return null;
  }

  /** K3: the name sets the repairs above read from, as copies, so a test can compare them with the archive's own .sty files. */
  function repairNames() {
    return {
      tikzUml: { environments: [...TIKZ_UML_ENVIRONMENTS], commands: [...TIKZ_UML_COMMANDS] },
      contour: { environments: [], commands: [...CONTOUR_COMMANDS] },
    };
  }

  /** The plan for the next run: the old plan, the no-message fixes, and the repair the last error points to. Null when there is nothing to try. */
  function nextPlan(plan, attempt, built, engine, source) {
    const next = { split: plan.split, fixes: true, addPackages: [...(plan.addPackages || [])], addLibraries: [...(plan.addLibraries || [])], drop: [...(plan.drop || [])] };
    const repair = repairFor(attempt, built, plan);
    if (repair && repair.addPackage) next.addPackages.push(repair.addPackage);
    if (repair && repair.addLibrary) next.addLibraries.push(repair.addLibrary);
    if (repair && repair.drop) next.drop.push(repair.drop);
    const candidate = buildInput(engine, source, next);
    // a retry that would read exactly what the last run read cannot give a different answer
    return candidate.input === built.input ? null : { plan: next, built: candidate };
  }

  // the lifted directive a message is about, for the two errors TeX raises while it loads what the kit lifted
  // into the generated preamble: "File `x.sty' not found" and "Option clash for package x"
  function liftedDirective(message, directives) {
    const missing = /File [`'"]([^`'"]+)['"] not found/.exec(message);
    if (missing) {
      const file = missing[1];
      const lib = /^(?:tikz|pgf)library(.+?)\.code\.tex$/.exec(file);
      if (lib) return directives.find((d) => d.kind === "library" && d.name === lib[1]) || null;
      const base = file.replace(/\.(sty|cls|tex|def|cfg)$/, "");
      return directives.find((d) => d.kind === "package" && d.name === base) || null;
    }
    const clash = /Option clash for package (\S+?)\.?$/.exec(message);
    if (clash) return directives.find((d) => d.kind === "package" && d.name === clash[1]) || null;
    return null;
  }

  /**
   * Read '! message' / 'l.N context' pairs out of a TeX log and map N back to the user's source line.
   * @returns {Array<{line:number|null, texLine:number|null, message:string, detail?:string, inPreamble?:boolean, beyondEnd?:boolean}>}
   */
  function parseLog(log, ctx) {
    const lines = String(log).split("\n");
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      const m = /^! (.*)$/.exec(lines[i]);
      if (!m) continue;
      const detail = [];
      let texLine = null;
      for (let k = i + 1; k < lines.length && k <= i + 10; k++) {
        const l = /^l\.(\d+)\b/.exec(lines[k]);
        if (l) {
          texLine = parseInt(l[1], 10);
          break;
        }
        if (/^! /.test(lines[k]) || /^\?/.test(lines[k])) break;
        if (lines[k].trim()) detail.push(lines[k].trim());
      }
      found.push({ message: m[1].trim(), detail: detail.join(" "), texLine });
    }
    const real = found.filter((e) => !/^Emergency stop\.?$/.test(e.message) && !/Fatal error occurred/.test(e.message));
    const kept = real.length ? real : found;
    const seen = new Set();
    const errors = [];
    for (const e of kept) {
      const key = e.message + "|" + e.texLine;
      if (seen.has(key)) continue;
      seen.add(key);
      const out = { line: null, texLine: e.texLine, message: e.message };
      if (e.detail) out.detail = e.detail;
      const lifted = liftedDirective(e.message, ctx.directives);
      if (lifted) {
        // a missing or clashing package is reported at the line AFTER the \usepackage, so blame the directive itself
        out.inPreamble = true;
        out.line = lifted.line;
      } else if (e.texLine !== null) {
        if (e.texLine <= ctx.preambleLines) {
          out.inPreamble = true;
          const hit = ctx.directives.find((d) => (e.message + " " + e.detail).includes(d.name));
          out.line = hit ? hit.line : ctx.directives.length ? ctx.directives[0].line : 1;
        } else {
          const user = e.texLine - ctx.preambleLines;
          // a split line makes TeX's numbering run ahead of the user's: lineOrigin says which user line each TeX line came from
          const total = ctx.lineOrigin ? ctx.lineOrigin.length : ctx.sourceLines;
          if (user > total) {
            out.line = ctx.sourceLines;
            out.beyondEnd = true;
          } else {
            out.line = ctx.lineOrigin ? ctx.lineOrigin[user - 1] : user;
          }
        }
      }
      errors.push(out);
    }
    return errors;
  }

  function toBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  // =========================================================================
  // The kit
  // =========================================================================

  function create() {
    const state = {
      initPromise: null,
      vendorUrl: null,
      engine: null,
      loader: null,
      fetchFn: null,
      graceMs: DEFAULT_GRACE_MS,
      fontMap: null,
      fontCache: new Map(),
      queue: [],
      running: false,
      abandoned: null,
      abandonedRestore: null,
      mode: RAN_IN.MAIN, // where TeX runs: RAN_IN.WORKER once a Worker has started, else the page's own thread
      fallbackReason: null, // why TeX runs on the page although a Worker was wanted (null when asked for, or when the Worker works)
      workerUrl: null,
      workerEntry: null,
      nextId: 0,
      stats: { renders: 0, texRuns: 0, active: 0, maxConcurrent: 0, resets: 0, workerStarts: 0, workerTerminations: 0, lastWorkerStartMs: null },
    };

    function resolveVendorUrl(vendorUrl) {
      if (typeof vendorUrl !== "string" || !vendorUrl) throw new Error("init: vendorUrl is required");
      let url = vendorUrl;
      if (typeof location !== "undefined" && location.href && typeof URL !== "undefined") {
        const abs = new URL(vendorUrl, location.href);
        if (abs.origin !== location.origin) {
          throw new Error("init: vendorUrl must be on the page origin (" + location.origin + "), got " + abs.origin);
        }
        url = abs.href;
      }
      return url.replace(/\/+$/, "");
    }

    function init(opts) {
      opts = opts || {};
      let vendorUrl;
      try {
        vendorUrl = resolveVendorUrl(opts.vendorUrl);
      } catch (e) {
        return Promise.reject(e);
      }
      if (state.initPromise) {
        if (state.vendorUrl !== vendorUrl) {
          return Promise.reject(new Error("init: already initialised with a different vendorUrl (" + state.vendorUrl + ")"));
        }
        return state.initPromise;
      }
      const engine = opts.engine || root.TikzKitEngine;
      if (!engine) return Promise.reject(new Error("init: no engine; load vendor/tikz-engine.js first"));
      state.vendorUrl = vendorUrl;
      state.engine = engine;
      state.fetchFn = opts.fetch || (root.fetch ? root.fetch.bind(root) : null);
      state.graceMs = opts.graceMs === undefined ? DEFAULT_GRACE_MS : opts.graceMs;
      state.loader = opts.loader || new engine.BrowserResourceLoader(vendorUrl + "/tex");
      state.mode = RAN_IN.MAIN;
      state.fallbackReason = null;
      state.workerEntry = null;
      state.workerUrl = opts.workerUrl || defaultWorkerUrl(vendorUrl);
      state.initPromise = startup(opts).then(
        () => ({ vendorUrl, engine: engine.engine || "unknown", version: engine.version || "unknown", mode: state.mode, workerFallbackReason: state.fallbackReason }),
        (e) => {
          discardWorker();
          state.initPromise = null; // let a later init() try again
          state.vendorUrl = null;
          throw e;
        }
      );
      return state.initPromise;
    }

    // ---------------- the Worker ----------------

    /** TeX runs in a Worker unless the caller asked otherwise or none can start; then it runs on the page, as before. */
    async function startup(opts) {
      if (opts.useWorker === false) return state.loader.preload();
      if (typeof root.Worker !== "function") {
        state.fallbackReason = "this environment has no Worker";
        return state.loader.preload();
      }
      try {
        state.workerEntry = spawnEntry();
        await state.workerEntry.ready;
        state.mode = RAN_IN.WORKER;
      } catch (e) {
        discardWorker();
        state.fallbackReason = "the Worker could not start: " + String((e && e.message) || e);
        logWarn(state.fallbackReason + "; TeX will run on the page's own thread");
        return state.loader.preload();
      }
    }

    function defaultWorkerUrl(vendorUrl) {
      if (KIT_SCRIPT_URL && typeof URL !== "undefined") return new URL(WORKER_FILE, KIT_SCRIPT_URL).href;
      return vendorUrl.replace(/\/[^/]*$/, "") + "/" + WORKER_FILE;
    }

    /** Start one Worker. It loads its bundle and preloads the TeX resources, then answers `ready`. Throws if `new Worker` does. */
    function spawnEntry() {
      const t0 = now();
      const w = new root.Worker(state.workerUrl);
      const entry = { w, dead: false, isReady: false, current: null, ready: null, rejectReady: null };
      entry.ready = new Promise((resolve, reject) => {
        entry.rejectReady = reject;
        w.onmessage = (ev) => {
          const m = (ev && ev.data) || {};
          if (m.type === "ready") {
            entry.isReady = true;
            state.stats.lastWorkerStartMs = +(now() - t0).toFixed(1);
            resolve();
          } else if (m.type === "init-error") {
            reject(new Error(m.message));
          } else if (entry.current && m.id === entry.current.id) {
            if (m.type === "log") entry.current.onLog(m.line);
            else if (m.type === "done") entry.current.onDone(m.dvi);
            else if (m.type === "fail") entry.current.onFail(m.message);
          }
        };
        w.onerror = (ev) => {
          const message = (ev && ev.message) || "the Worker raised an error";
          if (ev && ev.preventDefault) ev.preventDefault();
          if (entry.current) entry.current.onFail(message);
          reject(new Error(message)); // no effect once ready
          // after any error the Worker is not trusted. Replace it, unless it never got going (that would loop on a missing script).
          killWorker(entry, { respawn: entry.isReady });
        };
      });
      entry.ready.catch(() => {}); // acquireWorker and idle observe it; it must never be an unhandled rejection
      state.stats.workerStarts += 1;
      w.postMessage({ type: "init", engineUrl: state.vendorUrl + "/" + WORKER_ENGINE_FILE, texUrl: state.vendorUrl + "/tex" });
      return entry;
    }

    /** Terminate a Worker (the only way to stop a TeX run that does not yield) and, if asked, start its replacement. */
    function killWorker(entry, { respawn }) {
      if (entry.dead) return;
      entry.dead = true;
      try {
        entry.w.terminate();
      } catch (e) {
        logError("Worker terminate threw", e);
      }
      entry.rejectReady(new Error("the Worker was terminated")); // no effect once ready; frees anything waiting on a boot
      state.stats.workerTerminations += 1;
      if (!respawn || state.mode !== RAN_IN.WORKER || state.workerEntry !== entry) return;
      try {
        state.workerEntry = spawnEntry();
      } catch (e) {
        state.workerEntry = null;
        fallBackToMain("the Worker could not restart: " + String((e && e.message) || e));
      }
    }

    function discardWorker() {
      const entry = state.workerEntry;
      state.workerEntry = null;
      if (entry && !entry.dead) killWorker(entry, { respawn: false });
    }

    function fallBackToMain(reason) {
      discardWorker();
      state.mode = RAN_IN.MAIN;
      state.fallbackReason = reason;
      logWarn(reason + "; TeX will run on the page's own thread from now on");
    }

    /** The live Worker for the next run, waiting out a restart; null (and the mode switched) if none can be had. */
    async function acquireWorker() {
      for (let attempt = 0; attempt < 3; attempt++) {
        const entry = state.workerEntry;
        if (!entry) break;
        try {
          await entry.ready;
        } catch (e) {
          if (entry.dead) continue; // it was replaced while we waited
          fallBackToMain("the Worker could not restart: " + String((e && e.message) || e));
          return null;
        }
        if (!entry.dead) return entry;
      }
      if (state.mode === RAN_IN.WORKER) fallBackToMain("no live Worker");
      return null;
    }

    /** Run TeX in the Worker. Resolves with the DVI bytes; rejects on a TeX failure, a Worker error, or cancelTex(). */
    function texViaWorker(task, entry, built) {
      return new Promise((resolve, reject) => {
        const id = ++state.nextId;
        let settled = false;
        const end = (fn, value) => {
          if (settled) return;
          settled = true;
          entry.current = null;
          task.cancelTex = null;
          fn(value);
        };
        entry.current = {
          id,
          onLog: (line) => task.captured.push(line),
          onDone: (dvi) => end(resolve, dvi),
          onFail: (message) => end(reject, new Error(message)),
        };
        // timeout and abort land here: stop the run for good and have a fresh Worker ready for the next render
        task.cancelTex = () => {
          if (settled) return false;
          end(reject, new Error("TeX was stopped"));
          killWorker(entry, { respawn: true });
          return true;
        };
        entry.w.postMessage({ type: "tex", id, input: built.body, options: Object.assign({ showConsole: true }, built.texOptions) });
      });
    }

    /** Flags every result of a render that reached the queue with where TeX ran. */
    function stamp(task, result) {
      result.ranIn = task.ranIn || (state.mode === RAN_IN.WORKER ? RAN_IN.WORKER : RAN_IN.MAIN);
      if (state.fallbackReason) result.workerFallbackReason = state.fallbackReason;
      return result;
    }

    // ---------------- fonts ----------------

    async function fetchOk(url) {
      if (!state.fetchFn) throw new Error("no fetch available");
      const res = await state.fetchFn(url);
      if (!res.ok) throw new Error("fetch " + url + " -> " + res.status);
      return res;
    }

    async function fontMap() {
      if (!state.fontMap) {
        state.fontMap = (async () => {
          const css = await (await fetchOk(state.vendorUrl + "/css/fonts.css")).text();
          const map = new Map();
          for (const rule of css.match(/@font-face\s*\{[^}]*\}/g) || []) {
            const fam = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(rule);
            const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(rule);
            if (fam && url) map.set(fam[1].trim(), url[1]);
          }
          return map;
        })();
        state.fontMap.catch(() => { state.fontMap = null; });
      }
      return state.fontMap;
    }

    function fontRule(family) {
      if (!state.fontCache.has(family)) {
        const p = (async () => {
          const map = await fontMap();
          const rel = map.get(family);
          const res = await fetchOk(state.vendorUrl + "/css/" + rel);
          const bytes = new Uint8Array(await res.arrayBuffer());
          return "@font-face{font-family:" + family + ";src:url(data:font/ttf;base64," + toBase64(bytes) + ")}";
        })();
        p.catch(() => state.fontCache.delete(family));
        state.fontCache.set(family, p);
      }
      return state.fontCache.get(family);
    }

    function familiesIn(svg) {
      const used = new Set();
      for (const m of svg.matchAll(/\sfont-family="([^"]*)"/g)) {
        for (const f of m[1].split(",")) used.add(f.trim().replace(/^['"]|['"]$/g, ""));
      }
      used.delete("");
      return [...used].sort();
    }

    async function embedFonts(svg) {
      const used = familiesIn(svg);
      const map = await fontMap();
      const known = used.filter((f) => map.has(f));
      const missing = used.filter((f) => !map.has(f));
      if (!known.length) return { svg, fontsUsed: [], fontsMissing: missing, fontBytes: 0 };
      const rules = await Promise.all(known.map(fontRule));
      const style = "<style>" + rules.join("") + "</style>";
      const rootTag = /<svg\b(?:"[^"]*"|'[^']*'|[^'">])*>/.exec(svg);
      if (!rootTag || /\/>$/.test(rootTag[0])) return { svg, fontsUsed: [], fontsMissing: missing, fontBytes: 0 };
      const at = rootTag.index + rootTag[0].length;
      return { svg: svg.slice(0, at) + style + svg.slice(at), fontsUsed: known, fontsMissing: missing, fontBytes: style.length };
    }

    // ---------------- one render, inside the queue ----------------

    function fail(message, extra) {
      return Object.assign({ ok: false, log: "", errors: [{ line: null, texLine: null, message }], notes: [], ms: 0 }, extra || {});
    }

    async function engineRun(task) {
      const F = figureModule();
      const t0 = now();
      const repair = task.opts.repair !== false;
      let plan = { split: repair };
      let built = buildInput(state.engine, task.source, plan);
      if (built.tooLong) {
        // no TeX run: the engine cannot read a line this long, and one with no space in it cannot be split
        const t = built.tooLong;
        const message = "Line " + t.line + " is too long for the engine (" + t.chars + " characters with no space to split at; the limit is about " + LONG_LINE_LIMIT + ").";
        return { ok: false, log: "", errors: [{ line: t.line, texLine: null, message }], notes: notesFor(built, false), ms: now() - t0 };
      }
      const captured = [];
      task.captured = captured;

      // TeX runs in the Worker when there is one (its log lines are streamed into `captured`); otherwise on this thread,
      // where the only way to reach the log is to replace console.log for the length of the run.
      const entry = state.mode === RAN_IN.WORKER ? await acquireWorker() : null;
      task.ranIn = entry ? RAN_IN.WORKER : RAN_IN.MAIN;
      if (entry && task.gaveUp) return { ok: false, log: "", errors: [{ line: null, texLine: null, message: "Render abandoned" }], ms: now() - t0 };

      let restore = () => {};
      if (!entry) {
        const original = console.log;
        const patched = function () {
          captured.push(Array.prototype.map.call(arguments, String).join(" "));
        };
        console.log = patched;
        restore = () => {
          if (console.log === patched) console.log = original; // never clobber a replacement made by someone else
        };
      }
      task.restore = restore;
      state.stats.renders += 1;
      state.stats.active += 1;
      state.stats.maxConcurrent = Math.max(state.stats.maxConcurrent, state.stats.active);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        state.stats.active -= 1;
      };
      task.release = release; // a cancelled Worker run releases at once, so the next render never overlaps it in the count

      const logText = () => {
        const rest = captured.slice();
        if (rest[0] === ECHO_MARKER) rest.splice(0, 2); // the marker and the echoed input
        return rest.join("\n");
      };
      const ctxOf = (b) => ({ preambleLines: b.preambleLines, directives: b.directives, sourceLines: b.sourceLines, lineOrigin: b.lineOrigin });

      // one TeX run on one input; resolves with the DVI (or null) and the errors read from its log
      const attemptOn = async (b) => {
        captured.length = 0; // each run starts with its own log
        state.stats.texRuns += 1;
        try {
          const dvi = entry
            ? await texViaWorker(task, entry, b)
            : await state.engine.tex(b.body, Object.assign({ showConsole: true }, b.texOptions), state.loader);
          const log = logText();
          const errors = parseLog(log, ctxOf(b));
          if (errors.length) return { dvi, raw: null, log, errors };
          // K3: the SVG step can fail on its own after a clean TeX run (MEASURED: contour's `outline` option, "Invalid or unimplemented
          // postscript expression"). Read here, the failure is one the retry loop can see, so the no-message fixes get their try.
          try {
            return { dvi, raw: await state.engine.dvi2svg(dvi, {}), log, errors: [] };
          } catch (e) {
            const message = /* NP1-NOTHING-SITE */ nothingToDraw(task.source) ? NOTHING_TO_DRAW : "Render threw: " + String((e && e.message) || e);
            return { dvi, raw: null, log, errors: [{ line: null, texLine: null, message }] };
          }
        } catch (e) {
          const log = logText();
          let errors = parseLog(log, ctxOf(b));
          if (!errors.length) errors = [{ line: null, texLine: null, message: String((e && e.message) || e) }];
          return { dvi: null, raw: null, log, errors };
        }
      };

      try {
        let attempt = await attemptOn(built);
        // K1: a failed first run is retried with the smallest change its error points to, at most MAX_RETRIES times, inside the one timeout
        for (let retries = 0; repair && attempt.errors.length && retries < MAX_RETRIES; retries++) {
          if (task.done || task.gaveUp || task.aborting || (entry && entry.dead)) break;
          const next = nextPlan(plan, attempt, built, state.engine, task.source);
          if (!next) break;
          plan = next.plan;
          built = next.built;
          logDebug("retry " + (retries + 1) + " after: " + attempt.errors[0].message);
          attempt = await attemptOn(built);
        }
        const log = attempt.log;
        if (attempt.errors.length) return { ok: false, log, errors: attempt.errors, notes: notesFor(built, false), ms: now() - t0 };

        const raw = attempt.raw; // K3: made inside attemptOn, so a failure there could be retried
        if (typeof raw !== "string" || !/<svg[\s>]/.test(raw)) {
          return { ok: false, log, errors: [{ line: null, texLine: null, message: "The engine produced no SVG" }], notes: notesFor(built, false), ms: now() - t0 };
        }
        let svg = F.sanitiseSvg(applyBorder(raw, built.border));
        if (task.opts.figureId !== undefined) svg = F.prefixIds(svg, task.opts.figureId);
        const svgBytesBeforeFonts = svg.length;
        const fonts = await embedFonts(svg);
        return {
          ok: true,
          svg: fonts.svg,
          log,
          errors: [],
          fontsUsed: fonts.fontsUsed,
          fontsMissing: fonts.fontsMissing,
          fontBytes: fonts.fontBytes,
          svgBytesBeforeFonts,
          svgBytes: fonts.svg.length,
          notes: notesFor(built, true),
          ms: now() - t0,
        };
      } finally {
        release();
        restore();
      }
    }

    async function settleAbandoned() {
      if (!state.abandoned) return;
      const pending = state.abandoned;
      const settled = await Promise.race([pending.then(() => true), delay(state.graceMs).then(() => false)]);
      if (settled || state.abandoned !== pending) return;
      // the earlier run never finished: wipe the engine's module state, put console.log back, move on
      logWarn("a timed-out render did not finish within " + state.graceMs + "ms; resetting the engine");
      try {
        if (state.engine.reset) state.engine.reset();
      } catch (e) {
        logError("engine reset threw", e);
      }
      state.stats.resets += 1;
      if (state.abandonedRestore) state.abandonedRestore();
      state.abandoned = null;
      state.abandonedRestore = null;
    }

    async function execute(task) {
      task.started = true;
      await settleAbandoned();
      if (task.done) return;
      if (task.aborting) {
        task.finish(stamp(task, fail("Render aborted"))); // aborted while waiting for an earlier run: the engine never sees this source
        return;
      }

      const timeoutMs = task.opts.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : task.opts.timeoutMs;
      const work = engineRun(task);
      const guard = work.catch((e) => stamp(task, fail("Render threw: " + String((e && e.message) || e), { log: task.captured ? task.captured.join("\n") : "" })));
      let timer = null;
      const timedOut = timeoutMs > 0 && isFinite(timeoutMs)
        ? new Promise((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); })
        : new Promise(() => {});
      const aborted = new Promise((resolve) => { task.abortNow = () => resolve("abort"); });
      if (task.aborting) task.abortNow();

      let scanned = 0;
      let watch = null;
      const outOfMemory = new Promise((resolve) => {
        watch = setInterval(() => {
          const lines = task.captured || [];
          if (scanned > lines.length) scanned = 0; // a retry starts its log afresh
          for (; scanned < lines.length; scanned++) if (CAPACITY_RE.test(lines[scanned])) return resolve("capacity");
        }, CAPACITY_POLL_MS);
      });

      const outcome = await Promise.race([guard.then((r) => ({ r })), timedOut, aborted, outOfMemory]);
      if (timer) clearTimeout(timer);
      clearInterval(watch);
      if (outcome.r) {
        task.finish(stamp(task, outcome.r));
        return;
      }
      const partial = task.captured ? task.captured.join("\n") : "";
      const msg = outcome === "timeout" ? "Render timed out after " + timeoutMs + "ms" : outcome === "capacity" ? CAPACITY_MESSAGE : "Render aborted";
      // in the Worker the run CAN be stopped: terminate it and the next render starts on a fresh one, with nothing to wait for
      if (task.cancelTex && task.cancelTex()) {
        if (task.release) task.release();
        task.finish(stamp(task, fail(msg, { log: partial })));
        return;
      }
      // abandoned: this run cannot be interrupted (main thread, or past the TeX step), so remember it and make the next render wait for it
      task.gaveUp = true;
      const p = guard.then(() => {
        if (state.abandoned === p) {
          state.abandoned = null;
          state.abandonedRestore = null;
        }
      });
      state.abandoned = p;
      state.abandonedRestore = task.restore || null;
      task.finish(stamp(task, fail(msg, { log: partial })));
    }

    async function pump() {
      if (state.running) return;
      state.running = true;
      try {
        while (state.queue.length) {
          const task = state.queue.shift();
          if (task.done) continue;
          try {
            await execute(task);
          } catch (e) {
            logError("render task threw", e);
            task.finish(stamp(task, fail("Render threw: " + String((e && e.message) || e))));
          }
        }
      } finally {
        state.running = false;
      }
    }

    /**
     * @param {string} source TikZ source: a block, or a document body with \usepackage lines
     * @param {{timeoutMs?:number, signal?:AbortSignal, figureId?:number, repair?:boolean}} [opts]
     *   repair: false runs the source exactly as given, once (no retry, no splitting of long lines). Default on: see "K1" above.
     * @returns {Promise<{ok:boolean, svg?:string, log:string, errors:Array<{line:number|null,texLine:number|null,message:string}>, notes:string[], fontsUsed?:string[], ms:number}>}
     *   notes: plain sentences saying what the kit changed to get the source to run (empty when it changed nothing)
     */
    function render(source, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        const task = { source, opts, started: false, done: false, aborting: false, captured: null, restore: null, abortNow: null };
        const signal = opts.signal;
        const onAbort = () => {
          if (task.done) return;
          if (!task.started) task.finish(fail("Render aborted"));
          else {
            task.aborting = true;
            if (task.abortNow) task.abortNow();
          }
        };
        task.finish = (r) => {
          if (task.done) return;
          task.done = true;
          if (signal) signal.removeEventListener("abort", onAbort);
          resolve(r);
        };
        if (signal && signal.aborted) return task.finish(fail("Render aborted"));
        if (signal) signal.addEventListener("abort", onAbort, { once: true });

        const ready = state.initPromise;
        if (!ready) return task.finish(fail("TikzKit.init() has not been called"));
        ready.then(
          () => {
            if (task.done) return;
            state.queue.push(task);
            pump();
          },
          (e) => task.finish(fail("TikzKit.init() failed: " + String((e && e.message) || e)))
        );
      });
    }

    /** Resolves when nothing is queued, running or abandoned (an abandoned run is given the grace period). */
    async function idle() {
      for (;;) {
        if (state.running || state.queue.some((t) => !t.done)) {
          await delay(2);
          continue;
        }
        if (state.abandoned) {
          const pending = state.abandoned;
          await Promise.race([pending, delay(state.graceMs)]);
          if (state.abandoned === pending) return;
          continue;
        }
        // a terminated Worker's replacement is still booting: wait for it, so a caller that measures after idle() sees a settled kit
        if (state.workerEntry) await state.workerEntry.ready.catch(() => {});
        return;
      }
    }

    return {
      version: "1.0.0",
      init,
      render,
      idle,
      stats: () => Object.assign({ mode: state.mode, workerFallbackReason: state.fallbackReason }, state.stats),
      internals: {
        parseDirectives,
        buildInput: (source, plan) => buildInput(state.engine || root.TikzKitEngine || { getTexPreamble: defaultPreamble }, source, plan),
        parseLog,
        repairNames,
      },
    };
  }

  // used by internals.buildInput before init(): the engine's own getTexPreamble joined the same way
  function defaultPreamble(options) {
    options = options || {};
    const pk = Object.entries(options.texPackages || {}).map(([n, o]) => "\\usepackage" + (o ? "[" + o + "]" : "") + "{" + n + "}").join("");
    return pk + (options.tikzLibraries ? "\\usetikzlibrary{" + options.tikzLibraries + "}" : "") + "\n";
  }

  const kit = create();
  kit.create = create;
  root.TikzKit = kit;
  if (typeof module !== "undefined" && module.exports) module.exports = kit;
})(typeof window !== "undefined" ? window : globalThis);
