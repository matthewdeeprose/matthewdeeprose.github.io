/**
 * @file tikz-kit-figure.js
 * @description Pure, DOM-free figure helpers for tikz-kit: annotation parsing, block extraction, the
 * SVG sanitiser, id prefixing and the figure markup of .claude/tikz/dispatches/figure-contract-v1.md.
 * Everything here is string in, string out, so it runs unchanged in Node (the tests) and the browser.
 *
 * The annotation parser is ported from pandoc/i44 TikzPreservationManager.parseAnnotations; the
 * decorative handling deliberately does NOT follow pandoc's addSVGAccessibility, which ignores
 * isDecorative and always writes role="img".
 *
 * @module TikzKitFigure
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

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzKitFigure]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzKitFigure]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TikzKitFigure]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[TikzKitFigure]", message, ...args);
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const ID_PREFIX = "tikz-fig-";

  // elements that never belong in a figure: scripting, embedding, and SMIL elements that can rewrite an href
  const DROP_ELEMENTS = new Set([
    "script", "foreignobject", "iframe", "object", "embed", "audio", "video",
    "set", "animate", "animatetransform", "animatemotion", "handler", "listener",
  ]);
  // attributes that load or navigate, none of which SVG drawn by TeX has any use for
  const DROP_ATTRIBUTES = new Set(["src", "srcset", "action", "formaction", "data", "poster", "ping", "background"]);
  const SAFE_NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

  // =========================================================================
  // Small string helpers
  // =========================================================================

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function localName(name) {
    return String(name).split(":").pop().toLowerCase();
  }

  // =========================================================================
  // Annotations and block extraction
  // =========================================================================

  /**
   * Parse the comment lines immediately above a block.
   *   % @alt: ...        % @caption: ...        % @longdesc: ... (may repeat)        % @decorative
   * Scans backwards from `position`, skipping blank lines, and stops at the first line that is not a comment.
   * @param {string} latex
   * @param {number} [position] index where the block starts; defaults to the end of the text
   * @returns {{alt:string, caption:string, longdesc:string, isDecorative:boolean}}
   */
  function parseAnnotations(latex, position) {
    const text = String(latex);
    const pos = position === undefined || position > text.length ? text.length : position;
    const result = { alt: "", caption: "", longdesc: "", isDecorative: false };
    const lines = text.slice(0, pos).split(/\r?\n/);
    const annotationLines = [];

    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed === "") continue;
      if (!trimmed.startsWith("%")) break;
      annotationLines.unshift(trimmed);
    }

    const longdescParts = [];
    for (const line of annotationLines) {
      const content = line.replace(/^%+\s*/, "").trim();
      if (/^@decorative\s*$/i.test(content)) {
        result.isDecorative = true;
      } else if (/^@alt:/i.test(content)) {
        result.alt = content.replace(/^@alt:\s*/i, "").trim();
      } else if (/^@caption:/i.test(content)) {
        result.caption = content.replace(/^@caption:\s*/i, "").trim();
      } else if (/^@longdesc:/i.test(content)) {
        const part = content.replace(/^@longdesc:\s*/i, "").trim();
        if (part) longdescParts.push(part);
      }
    }
    result.longdesc = longdescParts.join(" ");

    // a decorative figure has no text alternative to give
    if (result.isDecorative) {
      result.alt = "";
      result.longdesc = "";
    }
    return result;
  }

  // a character is escaped when preceded by an odd number of backslashes
  function isEscaped(text, index) {
    let n = 0;
    for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) n++;
    return n % 2 === 1;
  }

  function skipComment(text, index) {
    const nl = text.indexOf("\n", index);
    return nl === -1 ? text.length : nl + 1;
  }

  const BEGIN_RE = /\\begin\{(tikzpicture|tikzcd)\}/y;

  /**
   * Find every \begin{tikzpicture} / \begin{tikzcd} block. Comment-aware (a % comment never starts or ends
   * a block; \% is not a comment) and brace-aware (an \end inside a nested {...} group does not close it).
   * An unterminated block is returned with complete:false rather than dropped, so it fails visibly at render.
   * @param {string} text
   * @returns {Array<{type:string,start:number,end:number,source:string,complete:boolean,annotations:object}>}
   */
  function extractBlocks(text) {
    const src = String(text);
    const blocks = [];
    let i = 0;

    while (i < src.length) {
      const c = src[i];
      if (c === "%" && !isEscaped(src, i)) {
        i = skipComment(src, i);
        continue;
      }
      if (c !== "\\") {
        i++;
        continue;
      }
      BEGIN_RE.lastIndex = i;
      const m = BEGIN_RE.exec(src);
      if (!m) {
        i += 2; // skip the escaped character, so \% and \\ are not read as comment or token starts
        continue;
      }
      const type = m[1];
      const start = i;
      const endRe = new RegExp("\\\\end\\{" + type + "\\}", "y");
      const beginRe = new RegExp("\\\\begin\\{" + type + "\\}", "y");
      let j = start + m[0].length;
      let depth = 1;
      let brace = 0;
      let end = -1;

      while (j < src.length) {
        const d = src[j];
        if (d === "%" && !isEscaped(src, j)) {
          j = skipComment(src, j);
          continue;
        }
        if (d === "{") {
          brace++;
          j++;
          continue;
        }
        if (d === "}") {
          if (brace > 0) brace--;
          j++;
          continue;
        }
        if (d !== "\\") {
          j++;
          continue;
        }
        endRe.lastIndex = j;
        const e = endRe.exec(src);
        if (e) {
          if (brace === 0) {
            depth--;
            if (depth === 0) {
              end = j + e[0].length;
              break;
            }
          }
          j += e[0].length;
          continue;
        }
        beginRe.lastIndex = j;
        const b = beginRe.exec(src);
        if (b) {
          if (brace === 0) depth++;
          j += b[0].length;
          continue;
        }
        j += 2;
      }

      const complete = end !== -1;
      if (!complete) end = src.length;
      blocks.push({
        type,
        start,
        end,
        source: src.slice(start, end),
        complete,
        annotations: parseAnnotations(src, start),
      });
      i = end;
    }
    return blocks;
  }

  // =========================================================================
  // SVG tokeniser (shared by the sanitiser and the id prefixer)
  // =========================================================================

  const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([A-Za-z][^\s>\/]*)\s*>|<([A-Za-z][^\s\/>]*)((?:\s+[^\s=\/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  const ATTR_RE = /([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const NAME_OK = /^[A-Za-z][A-Za-z0-9:_.-]*$/;
  const ATTR_NAME_OK = /^[A-Za-z_:][A-Za-z0-9:_.-]*$/;

  function parseAttrs(attrText) {
    const attrs = [];
    ATTR_RE.lastIndex = 0;
    let m;
    while ((m = ATTR_RE.exec(attrText))) {
      const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
      attrs.push({ name: m[1], value });
    }
    return attrs;
  }

  /** @returns {Array<object>} tokens: text, open, close. Comments, CDATA, doctype and PIs are dropped. */
  function tokenise(svg) {
    const s = String(svg);
    const tokens = [];
    const re = new RegExp(TAG_RE.source, "g");
    let last = 0;
    let m;
    const pushText = (t) => {
      if (t) tokens.push({ k: "text", v: t.replace(/</g, "&lt;") });
    };
    while ((m = re.exec(s))) {
      pushText(s.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[0].startsWith("<!") || m[0].startsWith("<?")) continue;
      if (m[1] !== undefined) {
        if (NAME_OK.test(m[1])) tokens.push({ k: "close", name: m[1] });
        continue;
      }
      if (!NAME_OK.test(m[2])) continue; // a malformed tag name is dropped whole
      tokens.push({ k: "open", name: m[2], attrs: parseAttrs(m[3] || ""), self: m[4] === "/" });
    }
    pushText(s.slice(last));
    return tokens;
  }

  function serialise(tokens) {
    let out = "";
    for (const t of tokens) {
      if (t.k === "text") out += t.v;
      else if (t.k === "close") out += "</" + t.name + ">";
      else {
        out += "<" + t.name;
        for (const a of t.attrs) out += " " + a.name + '="' + String(a.value).replace(/"/g, "&quot;") + '"';
        out += t.self ? "/>" : ">";
      }
    }
    return out;
  }

  // decode numeric and the five basic named entities; report any other named entity (fail closed)
  function decodeEntities(value) {
    let unknown = false;
    const decoded = String(value)
      .replace(/&#x([0-9a-f]+);?/gi, (all, h) => (parseInt(h, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(h, 16)) : ""))
      .replace(/&#(\d+);?/g, (all, d) => (parseInt(d, 10) <= 0x10ffff ? String.fromCodePoint(parseInt(d, 10)) : ""))
      .replace(/&([A-Za-z][A-Za-z0-9]*);?/g, (all, name) => {
        if (Object.prototype.hasOwnProperty.call(SAFE_NAMED_ENTITIES, name)) return SAFE_NAMED_ENTITIES[name];
        unknown = true;
        return all;
      });
    return { decoded, unknown };
  }

  // =========================================================================
  // Sanitiser
  // =========================================================================

  const DATA_FONT_URL = /^url\(\s*(['"]?)(data:font\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+)\1\s*\)(\s*format\([^)]*\))?$/i;
  const FAMILY_OK = /^(['"]?)([A-Za-z0-9][A-Za-z0-9 _-]*)\1$/;

  /**
   * Reduce a <style> body to the @font-face rules whose only source is a data:font base64 URI.
   * Everything else (other rules, @import, any other url()) is dropped. Output is canonical, one rule each.
   */
  function cleanStyle(css) {
    const text = String(css).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\\/g, "");
    const rules = [];
    const re = /@font-face\s*\{([^{}]*)\}/gi;
    let m;
    while ((m = re.exec(text))) {
      let family = null;
      let src = null;
      // split on ';' outside parentheses: a data: URI carries its own ';base64'
      for (const decl of m[1].split(/;(?![^()]*\))/)) {
        const idx = decl.indexOf(":");
        if (idx === -1) continue;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        const val = decl.slice(idx + 1).trim();
        if (prop === "font-family") family = val;
        else if (prop === "src") src = val;
      }
      const fam = family && FAMILY_OK.exec(family);
      const url = src && DATA_FONT_URL.exec(src);
      if (!fam || !url) continue;
      const name = /^[A-Za-z][A-Za-z0-9_-]*$/.test(fam[2]) ? fam[2] : "'" + fam[2] + "'";
      rules.push("@font-face{font-family:" + name + ";src:url(" + url[2] + ")}");
    }
    return rules.join("");
  }

  // true when every url(...) in the value is a same-document #reference
  function urlsAreLocal(norm) {
    const re = /url\(([^)]*)\)/gi;
    let m;
    while ((m = re.exec(norm))) {
      const inner = m[1].replace(/^['"]|['"]$/g, "");
      if (inner[0] !== "#") return false;
    }
    return true;
  }

  // returns the value to keep, or null to drop the attribute
  function cleanAttribute(name, value) {
    const lname = name.toLowerCase();
    if (!ATTR_NAME_OK.test(name)) return null;
    if (/^on/.test(lname) || DROP_ATTRIBUTES.has(lname)) return null;
    if (lname === "xmlns" || lname.startsWith("xmlns:")) return value;

    const { decoded, unknown } = decodeEntities(value);
    if (unknown) return null;
    const norm = decoded.replace(/[\u0000- \\]/g, "");

    if (lname === "href" || /:href$/.test(lname)) {
      return value[0] === "#" && decoded[0] === "#" ? value : null;
    }
    if (/(javascript|vbscript):/i.test(norm)) return null;
    if (/expression\(|@import|-moz-binding|behavior:/i.test(norm)) return null;
    if (/url\(/i.test(norm) && !urlsAreLocal(norm)) return null;
    if (/https?:\/\//i.test(decoded) && !/^xmlns/.test(lname)) return null;
    return value;
  }

  /**
   * Remove everything contract rule 5 forbids. Idempotent. The kit's own @font-face data rules survive.
   * @param {string} svg
   * @returns {string}
   */
  function sanitiseSvg(svg) {
    const tokens = tokenise(svg);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.k === "text") {
        out.push(t);
        continue;
      }
      if (t.k === "close") {
        if (DROP_ELEMENTS.has(localName(t.name))) continue; // stray close of a dropped element
        out.push(t);
        continue;
      }
      const ln = localName(t.name);
      if (DROP_ELEMENTS.has(ln)) {
        if (!t.self) {
          let depth = 1;
          while (++i < tokens.length) {
            const u = tokens[i];
            if (u.k === "open" && !u.self && localName(u.name) === ln) depth++;
            else if (u.k === "close" && localName(u.name) === ln && --depth === 0) break;
          }
        }
        continue;
      }
      if (ln === "style" && !t.self) {
        let body = "";
        let j = i + 1;
        while (j < tokens.length && !(tokens[j].k === "close" && localName(tokens[j].name) === "style")) {
          if (tokens[j].k === "text") body += tokens[j].v;
          j++;
        }
        const cleaned = cleanStyle(body);
        if (cleaned) {
          out.push({ k: "open", name: t.name, attrs: [], self: false });
          out.push({ k: "text", v: cleaned });
          out.push({ k: "close", name: t.name });
        }
        i = j;
        continue;
      }
      const attrs = [];
      for (const a of t.attrs) {
        const kept = cleanAttribute(a.name, a.value);
        if (kept === null) continue;
        if (a.name.toLowerCase() === "style") {
          const rinsed = kept.replace(/\\/g, "");
          attrs.push({ name: a.name, value: rinsed });
        } else attrs.push({ name: a.name, value: kept });
      }
      if (ln === "text" || ln === "tspan") pinFontFamily(attrs);
      out.push({ k: "open", name: t.name, attrs, self: t.self });
    }
    return serialise(out);
  }

  // Characters a font-family attribute may carry into a style attribute; anything else is not copied.
  const PINNABLE_FAMILY = /^[A-Za-z0-9 _,'-]+$/;

  /**
   * Copy a <text>/<tspan> font-family attribute into an inline style, so a host rule such as
   * `* { font-family: Verdana }` (which beats a presentation attribute) cannot replace TeX's font.
   * Leaves the element alone when it has no usable family or already sets one in its style.
   */
  function pinFontFamily(attrs) {
    const fam = attrs.find((a) => a.name.toLowerCase() === "font-family");
    if (!fam) return;
    const family = String(fam.value).trim();
    if (!family || !PINNABLE_FAMILY.test(family)) return;
    const style = attrs.find((a) => a.name.toLowerCase() === "style");
    if (!style) {
      attrs.push({ name: "style", value: "font-family:" + family });
      return;
    }
    if (/(^|;)\s*font-family\s*:/i.test(style.value)) return;
    style.value = "font-family:" + family + (style.value.trim() ? ";" + style.value.trim() : "");
  }

  // =========================================================================
  // Id prefixing (contract rule 1)
  // =========================================================================

  /**
   * Prefix every id with tikz-fig-N- and rewrite every internal reference to match.
   * Idempotent for the same N; a different figure's prefix is not treated as "already prefixed".
   */
  function prefixIds(svg, n) {
    const prefix = ID_PREFIX + n + "-";
    const withPrefix = (id) => (id.indexOf(prefix) === 0 ? id : prefix + id);
    const tokens = tokenise(svg);
    for (const t of tokens) {
      if (t.k !== "open") continue;
      for (const a of t.attrs) {
        const lname = a.name.toLowerCase();
        if (lname === "id") a.value = withPrefix(a.value);
        else if (lname === "href" || /:href$/.test(lname)) {
          if (a.value[0] === "#") a.value = "#" + withPrefix(a.value.slice(1));
        } else if (/url\(/i.test(a.value)) {
          a.value = a.value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/gi, (all, q, id) => "url(#" + withPrefix(id) + ")");
        }
      }
    }
    return serialise(tokens);
  }

  // =========================================================================
  // Data table (parcel T1)
  //
  // A deterministic reader for the LITERAL data a figure's source carries, and the table built from it. It declines (returns
  // null) whenever it is unsure: a formula plot, a macro, a \foreach, an external file, error bars, a second axis or an option
  // it does not understand all give no table, because a wrong table is worse than none. The model never writes table values.
  // =========================================================================

  const DATA_MAX_ROWS = 200;
  const DATA_MAX_COLUMNS = 12;
  const DATA_BLANK_CELL = "No value";
  const DATA_NAME_MAX_CHARS = 100;
  const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  const TABLE_OPTION_KEYS = new Set(["x", "y", "row sep", "col sep"]);
  const AXIS_ENVIRONMENT = /\\begin\{(axis|semilogxaxis|semilogyaxis|loglogaxis|groupplot|polaraxis|ternaryaxis|smithchart)\}/g;

  const squash = (s) => String(s).replace(/\s+/g, " ").trim();

  // % comments, but not \%
  function stripTexComments(s) {
    return s.split("\n").map((l) => l.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  }

  // index of the bracket that closes the opener at i, or -1
  function closingIndex(s, i) {
    const open = s[i];
    const shut = { "{": "}", "[": "]", "(": ")" }[open];
    let depth = 0;
    for (let k = i; k < s.length; k++) {
      if (s[k] === "\\") {
        k++;
        continue;
      }
      if (s[k] === open) depth++;
      else if (s[k] === shut && --depth === 0) return k;
    }
    return -1;
  }

  // split on a separator that is not inside brackets
  function splitTopLevel(s, sep) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === "\\") {
        cur += ch + (s[k + 1] || "");
        k++;
        continue;
      }
      if ("{[(".includes(ch)) depth++;
      if ("}])".includes(ch)) depth--;
      if (ch === sep && depth === 0) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // "a=1,b={x,y},flag" -> { a: "1", b: "x,y", flag: true }
  function readOptionList(text) {
    const o = {};
    for (const part of splitTopLevel(text, ",")) {
      const t = part.trim();
      if (!t) continue;
      const eq = t.indexOf("=");
      if (eq < 0) {
        o[t] = true;
        continue;
      }
      let v = t.slice(eq + 1).trim();
      if (v[0] === "{" && closingIndex(v, 0) === v.length - 1) v = v.slice(1, -1);
      o[t.slice(0, eq).trim()] = v;
    }
    return o;
  }

  /**
   * A label as plain text, or null when TeX would remain. Maths delimiters are unwrapped ($t$ -> t, \(m\) -> m); anything that
   * still holds a control sequence, a superscript, a subscript or a brace is not shown, because raw TeX in a header is noise.
   */
  function plainLabel(raw) {
    if (raw == null || raw === true) return null;
    let s = squash(raw).replace(/\\\(|\\\)/g, "").replace(/\$/g, "").replace(/\\([%&])/g, "$1").replace(/~/g, " ");
    s = squash(s);
    if (!s || /[\\^_{}]/.test(s)) return null;
    return s;
  }

  const firstLabel = (candidates, fallback) => {
    for (const c of candidates) {
      const label = plainLabel(c);
      if (label) return label;
    }
    return fallback;
  };

  const plainCell = (c) => c !== "" && !/[\\${}]/.test(c) && !/\s/.test(c);

  // a table body (inline, or via a \pgfplotstableread macro) -> { head, data } or null
  function readInlineTable(body, options, macros) {
    const t = body.trim();
    if (/^\\[a-zA-Z]+$/.test(t)) {
      const macro = macros[t];
      if (!macro) return null;
      return readInlineTable(macro.body, Object.assign({}, macro.options, options), macros);
    }
    // a bare file name has neither a row separator nor a line break: the data is not in the source
    if (!/\\\\|\n/.test(t) && /\.\w+$/.test(t)) return null;
    for (const key of Object.keys(options)) if (!TABLE_OPTION_KEYS.has(key)) return null;
    const colSep = options["col sep"];
    if (colSep !== undefined && colSep !== "comma" && colSep !== "space") return null;
    const lines = t.split(/\\\\/.test(t) ? /\\\\/ : /\n/).map((l) => l.trim()).filter(Boolean);
    const cells = (l) => (colSep === "comma" ? l.split(",") : l.split(/\s+/)).map((c) => c.trim());
    if (lines.length < 2) return null;
    const head = cells(lines[0]);
    const data = lines.slice(1).map(cells);
    if (head.length < 2 || !head.every(plainCell)) return null;
    if (data.some((r) => r.length !== head.length || !r.every(plainCell))) return null;
    return { head, data };
  }

  // the legend names, in plot order: \legend{A,B} wins over \addlegendentry{...}
  function readLegend(body) {
    const grouped = body.match(/\\legend\s*\{((?:[^{}]|\{[^{}]*\})*)\}/);
    if (grouped) return splitTopLevel(grouped[1], ",").map(squash);
    return Array.from(body.matchAll(/\\addlegendentry\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)).map((m) => squash(m[1]));
  }

  // each \addplot -> { dim, pairs: string[][], columns?: [xName, yName] } or null when any one of them cannot be read
  function readPlots(body, macros) {
    const plots = [];
    const re = /\\addplot(3?)(?![a-zA-Z])\+?\s*(\[)?/g;
    let m;
    while ((m = re.exec(body))) {
      let i = m.index + m[0].length - (m[2] ? 1 : 0);
      let plotOptions = {};
      if (m[2]) {
        const end = closingIndex(body, i);
        if (end < 0) return null;
        plotOptions = readOptionList(body.slice(i + 1, end));
        i = end + 1;
      }
      if (plotOptions["forget plot"]) return null;
      const kind = body.slice(i).match(/^\s*(coordinates|table)\b/);
      if (!kind) return null; // a formula, a file, a graphic, gnuplot: nothing literal to show
      const dim = m[1] ? 3 : 2;
      let at = i + kind[0].length;
      if (kind[1] === "coordinates") {
        const open = body.indexOf("{", at);
        const end = open < 0 ? -1 : closingIndex(body, open);
        if (end < 0) return null;
        const inner = body.slice(open + 1, end);
        if (/\\[a-zA-Z]/.test(inner) || /\+-/.test(inner)) return null;
        const tuples = Array.from(inner.matchAll(/\(([^()]*)\)/g)).map((t) => t[1].split(",").map((c) => c.trim()));
        if (!tuples.length || inner.replace(/\(([^()]*)\)/g, "").trim() !== "") return null;
        if (tuples.some((t) => t.length !== dim || !t.every(plainCell))) return null;
        plots.push({ dim, pairs: tuples });
        re.lastIndex = end + 1;
      } else {
        if (dim === 3) return null;
        let tableOptions = {};
        const rest = body.slice(at).match(/^\s*\[/);
        if (rest) {
          const open = at + rest[0].length - 1;
          const end = closingIndex(body, open);
          if (end < 0) return null;
          tableOptions = readOptionList(body.slice(open + 1, end));
          at = end + 1;
        }
        const open = body.indexOf("{", at);
        const end = open < 0 ? -1 : closingIndex(body, open);
        if (end < 0) return null;
        const table = readInlineTable(body.slice(open + 1, end), tableOptions, macros);
        if (!table) return null;
        const xi = tableOptions.x ? table.head.indexOf(tableOptions.x) : 0;
        const yi = tableOptions.y ? table.head.indexOf(tableOptions.y) : 1;
        if (xi < 0 || yi < 0 || xi === yi) return null;
        plots.push({ dim: 2, pairs: table.data.map((r) => [r[xi], r[yi]]), columns: [table.head[xi], table.head[yi]] });
        re.lastIndex = end + 1;
      }
    }
    return plots;
  }

  /**
   * Read the literal data a figure's source carries.
   * @param {string} source TikZ source (annotation lines are comments and are ignored)
   * @returns {{headers:string[], rows:string[][], rowHeaderColumn?:number}|null} null when there is no literal data or the
   *   reader is not certain of it
   */
  function parseDataTable(source) {
    const src = stripTexComments(String(source == null ? "" : source));
    if (/\\foreach\b|\\nextgroupplot\b/.test(src)) return null;
    const axes = Array.from(src.matchAll(AXIS_ENVIRONMENT));
    if (axes.length !== 1 || axes[0][1] !== "axis") return null;

    const macros = {};
    for (const m of src.matchAll(/\\pgfplotstableread(?:\[([^\]]*)\])?\s*\{/g)) {
      const open = m.index + m[0].length - 1;
      const end = closingIndex(src, open);
      const after = end < 0 ? null : src.slice(end + 1).match(/^\s*(\\[a-zA-Z]+)/);
      if (after) macros[after[1]] = { body: src.slice(open + 1, end), options: readOptionList(m[1] || "") };
    }

    const body = src.slice(axes[0].index);
    const afterBegin = body.slice(axes[0][0].length);
    const bracket = afterBegin.match(/^\s*\[/);
    let axisOptions = {};
    if (bracket) {
      const open = bracket[0].length - 1;
      const end = closingIndex(afterBegin, open);
      if (end < 0) return null;
      axisOptions = readOptionList(afterBegin.slice(open + 1, end));
    }

    const plots = readPlots(body, macros);
    if (!plots || !plots.length) return null;
    const threeD = plots[0].dim === 3;
    if (threeD && plots.length > 1) return null;
    if (plots.length + 1 > DATA_MAX_COLUMNS) return null;

    const xl = axisOptions.xlabel;
    const yl = axisOptions.ylabel;
    const legend = readLegend(body);

    if (threeD) {
      if (plots[0].pairs.length > DATA_MAX_ROWS) return null;
      return { headers: [firstLabel([xl], "x"), firstLabel([yl], "y"), firstLabel([axisOptions.zlabel], "z")], rows: plots[0].pairs };
    }

    const xbar = Object.keys(axisOptions).some((k) => /^xbar/.test(k));
    const oriented = plots.map((p) => p.pairs.map((t) => (xbar ? [t[1], t[0]] : t)));
    const keys = [];
    for (const series of oriented) {
      const seen = new Set();
      for (const t of series) {
        if (seen.has(t[0])) return null; // a repeated x within one series cannot be placed in a shared row
        seen.add(t[0]);
        if (!keys.includes(t[0])) keys.push(t[0]);
      }
    }
    if (keys.length > DATA_MAX_ROWS) return null;
    const rows = keys.map((key) => [key, ...oriented.map((series) => (series.find((t) => t[0] === key) || [null, ""])[1])]);

    const single = plots.length === 1;
    const category = keys.some((k) => !NUMBER_PATTERN.test(k));
    const columns = plots[0].columns || [];
    const xHeader = firstLabel([xbar ? yl : xl, columns[0]], category ? "Category" : "x");
    let valueHeaders;
    if (single) valueHeaders = [firstLabel(xbar ? [xl, legend[0]] : [yl, legend[0], columns[1]], "Value")];
    else valueHeaders = plots.map((p, i) => firstLabel([legend[i]], "Series " + (i + 1)));

    const table = { headers: [xHeader, ...valueHeaders], rows };
    if (category) table.rowHeaderColumn = 0;
    return table;
  }

  /**
   * The Data section for a parsed table: a captioned table with column headers and, for a category column, row headers.
   * Carries no id, so two figures in one document cannot collide.
   * @param {{headers:string[], rows:string[][], rowHeaderColumn?:number}} table
   * @param {string} figureName what the caption names: the figure's caption, else its alt text, else "Figure N"
   * @returns {string}
   */
  function buildDataTableHtml(table, figureName) {
    const head = table.headers.map((h) => '<th scope="col">' + escapeHtml(h) + "</th>").join("");
    const body = table.rows
      .map((row) => {
        const cells = row
          .map((cell, c) => {
            const text = escapeHtml(cell === "" ? DATA_BLANK_CELL : cell);
            return c === table.rowHeaderColumn ? '<th scope="row">' + text + "</th>" : "<td>" + text + "</td>";
          })
          .join("");
        return "<tr>" + cells + "</tr>";
      })
      .join("");
    return (
      '<section class="tikz-data"><h3>Data</h3><table><caption>Data for ' + escapeHtml(figureName) + "</caption>" +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></section>"
    );
  }

  // the name a data table's caption gives its figure
  function dataTableName(n, caption, alt) {
    if (caption.trim()) return squash(caption);
    if (alt) {
      const text = squash(alt);
      return text.length > DATA_NAME_MAX_CHARS ? text.slice(0, DATA_NAME_MAX_CHARS).replace(/\s+\S*$/, "") + "…" : text;
    }
    return "Figure " + n;
  }

  // =========================================================================
  // Figure markup (contract v1)
  // =========================================================================

  function missingAlt(n) {
    return "Figure " + n + ": no text alternative supplied";
  }

  // set xmlns, a viewBox, and the contract's accessibility attributes on the root <svg>
  function finaliseRoot(svg, n, mode) {
    const tokens = tokenise(svg);
    const root0 = tokens.find((t) => t.k === "open" && localName(t.name) === "svg");
    if (!root0) return svg;
    const usesXlink = tokens.some((t) => t.k === "open" && t.attrs.some((a) => /^xlink:/i.test(a.name)));
    const strip = new Set(["role", "aria-label", "aria-labelledby", "aria-describedby", "aria-details", "aria-hidden", "focusable", "data-tikz-alt"]);
    let attrs = root0.attrs.filter((a) => !strip.has(a.name.toLowerCase()) && a.name.toLowerCase() !== "xmlns");
    const find = (nm) => attrs.find((a) => a.name.toLowerCase() === nm);
    if (!find("viewbox")) {
      const w = parseFloat((find("width") || {}).value);
      const h = parseFloat((find("height") || {}).value);
      if (w > 0 && h > 0) attrs.push({ name: "viewBox", value: "0 0 " + w + " " + h });
    }
    const head = [{ name: "xmlns", value: SVG_NS }];
    if (usesXlink && !attrs.some((a) => a.name === "xmlns:xlink")) head.push({ name: "xmlns:xlink", value: XLINK_NS });
    attrs = head.concat(attrs);
    if (mode.decorative) {
      attrs.push({ name: "aria-hidden", value: "true" }, { name: "focusable", value: "false" });
    } else {
      attrs.push({ name: "role", value: "img" }, { name: "aria-label", value: mode.label });
      if (mode.detailsId) attrs.push({ name: "aria-details", value: mode.detailsId });
    }
    root0.attrs = attrs;
    return serialise(tokens);
  }

  /**
   * Build the figure markup of contract v1.
   * @param {object} o
   * @param {number} o.n positive integer, unique in the document
   * @param {string|null} o.svg the rendered SVG, or null/empty for a failed render
   * @param {string} [o.alt] text alternative (plain text, escaped)
   * @param {string} [o.caption] figcaption text (plain text, escaped)
   * @param {string} [o.longdesc] long description (TRUSTED HTML, supplied by the author)
   * @param {boolean} [o.isDecorative]
   * @param {string} [o.source] TikZ source (plain text, escaped); shown in details.tikz-source, or as the failure fallback
   * @returns {string}
   */
  function buildFigure(o) {
    const n = o && o.n;
    if (typeof n !== "number" || !isFinite(n) || n !== Math.floor(n) || n < 1) {
      throw new TypeError("buildFigure: n must be a positive integer (got " + String(n) + ")");
    }
    const id = ID_PREFIX + n;
    const decorative = !!o.isDecorative;
    const alt = decorative ? "" : String(o.alt == null ? "" : o.alt).trim();
    const caption = o.caption == null ? "" : String(o.caption);
    const source = o.source == null ? "" : String(o.source).replace(/\r\n/g, "\n");
    const rendered = !!(o.svg && String(o.svg).trim());
    // A generated Data section closes the long description. Never for a decorative figure or a failed render.
    let dataHtml = "";
    if (rendered && !decorative && source) {
      const table = parseDataTable(source);
      if (table) dataHtml = buildDataTableHtml(table, dataTableName(n, caption, alt));
    }
    const longdesc = decorative ? "" : String(o.longdesc == null ? "" : o.longdesc) + dataHtml;
    const hasLong = longdesc.trim() !== "";
    const longId = id + "-longdesc";

    let graphic;
    if (rendered) {
      const clean = prefixIds(sanitiseSvg(o.svg), n);
      graphic = finaliseRoot(clean, n, {
        decorative,
        label: escapeAttrValue(alt || missingAlt(n)),
        detailsId: hasLong ? longId : "",
      });
    } else {
      if (!source) logWarn("figure " + n + " failed and no source was supplied for the fallback");
      graphic =
        '<details class="tikz-fallback"><summary>TikZ figure ' + n + " could not be rendered. View the source.</summary>" +
        "<pre><code>" + escapeHtml(source) + "</code></pre></details>";
    }

    let html = '<figure class="tikz-figure" id="' + id + '"><div class="tikz-graphic-container">' + graphic + "</div>";
    if (decorative) {
      if (caption.trim()) html += "<figcaption>" + escapeHtml(caption) + "</figcaption>";
    } else {
      html += "<figcaption>" + escapeHtml(caption.trim() ? caption : "Figure " + n) + "</figcaption>";
    }
    if (hasLong) html += '<div class="longdesc" id="' + longId + '">' + longdesc + "</div>";
    if (rendered && source) {
      html += '<details class="tikz-source"><summary>View TikZ source</summary><pre><code>' + escapeHtml(source) + "</code></pre></details>";
    }
    return html + "</figure>";
  }

  // an aria-label value goes through serialise(), which only escapes the quote, so escape it fully here
  function escapeAttrValue(text) {
    return escapeHtml(text);
  }

  const api = {
    escapeHtml,
    parseAnnotations,
    extractBlocks,
    sanitiseSvg,
    prefixIds,
    buildFigure,
    parseDataTable,
    buildDataTableHtml,
    missingAlt,
  };
  root.TikzKitFigure = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
