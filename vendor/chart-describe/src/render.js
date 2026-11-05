/**
 * Chart description renderer
 * Writes a DescriptionModel (model.js) as HTML under a profile. A profile is
 * data: the layout kind and, for the `sections` layout, the class map and
 * spacing. The model carries none of that. The short tier takes no profile:
 * it is always the escaped plain short.
 * renderText and renderMarkdown write the same model without a profile.
 *
 * Author runs are escaped here and nowhere else, through
 * ChartDescribeText.escapeHtml, resolved at call time. A node type or layout
 * the renderer cannot write makes it throw; it never returns partial output.
 *
 * Only the `lines` profile ships. A profile with class names belongs to the
 * adapter that owns those names, and that adapter passes it in.
 *
 * This file exports renderHtml, renderText, renderMarkdown and PROFILES. It
 * needs text.js (for escapeHtml). It does not need model.js at load time: it
 * only reads the plain objects that model.js builds. It exports itself as
 * window.ChartDescribeRender. In Node it also sets module.exports.
 */
(function (root) {
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

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Describe Render] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Render] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Render] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Render] DEBUG: ${message}`, ...args);
    }
  }

  const LAYOUTS = Object.freeze({
    LINES: "lines",
    SECTIONS: "sections",
  });

  const PROFILES = Object.freeze({
    lines: Object.freeze({
      name: "lines",
      layout: LAYOUTS.LINES,
    }),
  });

  const NEWLINE = "\n";

  // The one escape, resolved at call time so a later load order cannot capture undefined.
  function escapeAuthor(value) {
    const text = root.ChartDescribeText;
    if (!text || typeof text.escapeHtml !== "function") {
      throw new Error("ChartDescribeText.escapeHtml is not available");
    }
    return text.escapeHtml(value);
  }

  // Layout whitespace comes only from here.
  function layoutWhitespace(whitespace) {
    return whitespace;
  }

  function classAttribute(className) {
    return className ? ` class="${className}"` : "";
  }

  function lineBreak() {
    return layoutWhitespace(NEWLINE);
  }

  // The detailed tier's runs. The short tier never comes through here: renderHtml writes it as the escaped plain short.
  function inline(runs, profile) {
    return runs
      .map((run) => {
        switch (run.type) {
          case "text":
            return run.value;
          case "author":
            return escapeAuthor(run.value);
          case "strong":
            return `<strong>${inline(run.runs, profile)}</strong>`;
          case "term": {
            const inner = inline(run.runs, profile);
            if (!profile.termClass) return inner;
            return `<span${classAttribute(profile.termClass(run.role))}>${inner}</span>`;
          }
          default:
            throw new Error(`unknown inline type ${run.type}`);
        }
      })
      .join("");
  }

  function cell(tag, scope, content, profile) {
    const scopeAttr = scope ? ` scope="${scope}"` : "";
    return `<${tag}${scopeAttr}>${inline(content.runs, profile)}</${tag}>`;
  }

  function tableLines(block, profile) {
    const caption = block.caption
      ? `<caption>${inline(block.caption, profile)}</caption>`
      : null;
    const head = `<thead><tr>${block.columns.map((c) => cell("th", "col", c, profile)).join("")}</tr></thead>`;
    const rows = block.rows.map((row) => {
      const header = row.header ? cell("th", "row", row.header, profile) : "";
      return `<tr>${header}${row.cells.map((c) => cell("td", null, c, profile)).join("")}</tr>`;
    });
    const parts = ["<table>", ...(caption ? [caption] : []), head, "<tbody>", ...rows, "</tbody>", "</table>"];
    return parts.join(lineBreak());
  }

  function blockLines(block, profile) {
    switch (block.type) {
      case "paragraph":
        return `<p>${inline(block.runs, profile)}</p>`;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        // An empty list keeps the bytes the base wrote: no blank line between the tags.
        if (!block.items.length) return `<${tag}>${lineBreak()}</${tag}>`;
        const items = block.items.map((entry) => {
          const children = entry.children.length
            ? lineBreak() + entry.children.map((c) => blockLines(c, profile)).join(lineBreak()) + lineBreak()
            : "";
          return `<li>${inline(entry.runs, profile)}${children}</li>`;
        });
        return `<${tag}>${lineBreak()}${items.join(lineBreak())}${lineBreak()}</${tag}>`;
      }
      case "table":
        return tableLines(block, profile);
      default:
        throw new Error(`unknown block type ${block.type}`);
    }
  }

  function blockSections(block, profile) {
    switch (block.type) {
      case "paragraph":
        return `<p>${inline(block.runs, profile)}</p>`;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        const items = block.items.map((entry) => {
          if (entry.children.length) {
            throw new Error("nested blocks in a list item: the sections layout cannot write them");
          }
          const itemClass = entry.role && profile.itemClass[entry.role];
          return `<li${classAttribute(itemClass)}>${inline(entry.runs, profile)}</li>`;
        });
        const listClass = block.role && profile.listClass[block.role];
        return `<${tag}${classAttribute(listClass)}>${items.join("")}</${tag}>`;
      }
      case "table":
        throw new Error("table in the sections layout: the sections layout cannot write one");
      default:
        throw new Error(`unknown block type ${block.type}`);
    }
  }

  function detailedLines(model, profile) {
    return model.sections
      .map((sec) => {
        const heading = sec.heading
          ? [`<h4>${inline(sec.heading, profile)}</h4>`]
          : [];
        return [...heading, ...sec.blocks.map((b) => blockLines(b, profile))].join(lineBreak());
      })
      .join(lineBreak());
  }

  function sectionSpacing(profile, role) {
    return profile.sectionLayout[role] || profile.sectionLayout.default;
  }

  function detailedSections(model, profile) {
    return model.sections
      .map((sec) => {
        const spacing = sectionSpacing(profile, sec.role);
        const gap = layoutWhitespace(`\n${" ".repeat(spacing.indent)}`);
        const heading = sec.heading
          ? `${gap}<h4${classAttribute(profile.headingClass)}>${inline(sec.heading, profile)}</h4>${spacing.afterHeading ? gap : ""}`
          : "";
        const body = sec.blocks.map((b) => blockSections(b, profile)).join("");
        return `<section${classAttribute(profile.sectionClass(sec.role))}>${heading}${body}</section>`;
      })
      .join("");
  }

  // ---------- Plain text and Markdown ----------
  // Both write the same model as renderHtml and take no profile. Plain text escapes nothing. Markdown escapes author
  // runs only. The describer's own words are written as they are: they hold no markup, so they need no escape. The
  // result is that a title typed `Sales *2025* <draft>` reads back exactly as typed.

  const TEXT_BULLET = "• ";
  const TEXT_NESTING = "   ";
  const MARKDOWN_BULLET = "* ";
  const MARKDOWN_HEADING_MARK = "#### ";
  const BLANK_LINE = "\n\n";

  // Where an author run sits decides which escapes it needs. `openBlock`: the run opens a line-start block, list item
  // or paragraph. `flat`: a newline cannot survive there (heading, table cell). `cell`: a pipe ends the cell.
  const MD_CONTEXT = Object.freeze({
    BLOCK: Object.freeze({ openBlock: true, flat: false, cell: false }),
    INLINE: Object.freeze({ openBlock: false, flat: false, cell: false }),
    HEADING: Object.freeze({ openBlock: false, flat: true, cell: false }),
    CELL: Object.freeze({ openBlock: false, flat: true, cell: true }),
  });

  // Characters that start inline markup, in an author run anywhere.
  const MD_ESCAPE_INLINE = /[\\`*_[\]<~^]/g;
  const MD_ESCAPE_CELL = /[\\`*_[\]<~^|]/g;
  // An entity-shaped run (`&copy;`) would be decoded; a doubled `++` or `==` is insert or mark markup.
  const MD_ENTITY = /&(?=#?[A-Za-z0-9]+;)/g;
  const MD_PAIRED_MARK = /\+{2,}|={2,}/g;
  // Emoji shortcodes and the three things the linkify option turns into a link: a scheme before `//` (or `mailto:`), a
  // bare domain (any dot between a word character and two letters, since every country code is a domain) and an address.
  const MD_EMOJI_COLON = /:(?=[\w+-]+:)/g;
  const MD_SCHEME_COLON = /([A-Za-z][A-Za-z0-9+.-]*):(?=\/\/)|\b(mailto):/gi;
  const MD_DOMAIN_DOT = /(?<=\w)\.(?=[A-Za-z]{2,})/g;
  const MD_ADDRESS_AT = /(?<=\w)@(?=\w)/g;
  // A line of an author run that would open a block, tried in order; the first match is escaped.
  const MD_LINE_START_RULES = Object.freeze([
    [/^#{1,6}(?=[ \t]|$)/, (m) => `\\${m}`],
    [/^>/, (m) => `\\${m}`],
    [/^[-+](?=[ \t]|$)/, (m) => `\\${m}`],
    [/^(?:-[ \t]*){2,}$|^=+[ \t]*$/, (m) => `\\${m}`],
    [/^\d{1,9}(?=[.)](?:[ \t]|$))/, (m) => `${m}\\`],
    [/^:/, (m) => `\\${m}`],
    [/^\|/, (m) => `\\${m}`],
    [/^ {4,}/, (m) => `&#32;${m.slice(1)}`],
  ]);
  // The closing sequence of an ATX heading is dropped by the parser.
  const MD_HEADING_CLOSER = /(^|[ \t])(#+)(?=[ \t]*$)/;

  function plainRuns(runs) {
    return runs
      .map((run) => {
        switch (run.type) {
          case "text":
          case "author":
            return run.value;
          case "strong":
          case "term":
            return plainRuns(run.runs);
          default:
            throw new Error(`unknown inline type ${run.type}`);
        }
      })
      .join("");
  }

  function escapeLineStart(line) {
    for (const [pattern, fix] of MD_LINE_START_RULES) {
      if (pattern.test(line)) return line.replace(pattern, fix);
    }
    return line;
  }

  function escapeMarkdownAuthor(value, context) {
    let text = context.flat ? value.replace(/\r\n|\r|\n/g, " ") : value;
    text = text
      .replace(context.cell ? MD_ESCAPE_CELL : MD_ESCAPE_INLINE, "\\$&")
      .replace(MD_ENTITY, "\\&")
      .replace(MD_PAIRED_MARK, (run) => run.replace(/./g, "\\$&"))
      .replace(MD_EMOJI_COLON, "\\:")
      .replace(MD_SCHEME_COLON, (match, scheme) => (scheme ? `${scheme}\\:` : `${match.slice(0, -1)}\\:`))
      .replace(MD_DOMAIN_DOT, "\\.")
      .replace(MD_ADDRESS_AT, "\\@");
    if (context.flat) return text;
    return text
      .split("\n")
      .map((line, i) => (i === 0 && !context.openBlock ? line : escapeLineStart(line)))
      .join("\n");
  }

  // `**` must hug its text, because the parser will not open one before a space or close one after a space. Edge
  // whitespace moves outside the markers; at the start of a block it is dropped, as the page drops it anyway.
  function strongMarkdown(runs, context, atBlockStart) {
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(markdownRuns(runs, { ...context, openBlock: false }));
    const before = atBlockStart ? "" : lead;
    return core === "" ? before + trail : `${before}**${core}**${trail}`;
  }

  function markdownRuns(runs, context) {
    let out = "";
    for (const run of runs) {
      const atBlockStart = context.openBlock && out === "";
      const inner = { ...context, openBlock: atBlockStart };
      switch (run.type) {
        case "text":
          out += run.value;
          break;
        case "author":
          out += escapeMarkdownAuthor(run.value, inner);
          break;
        case "strong":
          out += strongMarkdown(run.runs, context, atBlockStart);
          break;
        case "term":
          out += run.role === "title" ? strongMarkdown(run.runs, context, atBlockStart) : markdownRuns(run.runs, inner);
          break;
        default:
          throw new Error(`unknown inline type ${run.type}`);
      }
    }
    return out;
  }

  function indentFollowing(text, pad) {
    return text
      .split("\n")
      .map((line) => (line === "" ? line : pad + line))
      .join("\n");
  }

  // A list as lines, or null when it has no items (it writes nothing and adds no blank block).
  function listText(block, bullet, writeRuns, writeBlock, padFor) {
    if (!block.items.length) return null;
    return block.items
      .map((entry, i) => {
        const marker = block.ordered ? `${i + 1}. ` : bullet;
        const kids = entry.children.map(writeBlock).filter((k) => k !== null).join("\n");
        const head = marker + writeRuns(entry.runs);
        return kids ? `${head}\n${indentFollowing(kids, padFor(marker))}` : head;
      })
      .join("\n");
  }

  function textBlock(block) {
    switch (block.type) {
      case "paragraph":
        return plainRuns(block.runs);
      case "list":
        return listText(block, TEXT_BULLET, plainRuns, textBlock, () => TEXT_NESTING);
      case "table": {
        const row = (r) => [...(r.header ? [plainRuns(r.header.runs)] : []), ...r.cells.map((c) => plainRuns(c.runs))].join(" | ");
        return [
          ...(block.caption ? [plainRuns(block.caption)] : []),
          block.columns.map((c) => plainRuns(c.runs)).join(" | "),
          ...block.rows.map(row),
        ].join("\n");
      }
      default:
        throw new Error(`unknown block type ${block.type}`);
    }
  }

  function markdownHeading(runs) {
    const heading = markdownRuns(runs, MD_CONTEXT.HEADING).replace(MD_HEADING_CLOSER, "$1\\$2");
    return MARKDOWN_HEADING_MARK + heading;
  }

  function markdownBlock(block) {
    switch (block.type) {
      case "paragraph":
        return markdownRuns(block.runs, MD_CONTEXT.BLOCK);
      case "list":
        return listText(block, MARKDOWN_BULLET, (runs) => markdownRuns(runs, MD_CONTEXT.BLOCK), markdownBlock, (marker) => " ".repeat(marker.length));
      case "table": {
        const cell = (c) => markdownRuns(c.runs, MD_CONTEXT.CELL);
        const line = (cells) => `| ${cells.join(" | ")} |`;
        const columns = block.columns.map(cell);
        const rows = block.rows.map((r) => line([...(r.header ? [cell(r.header)] : []), ...r.cells.map(cell)]));
        const caption = block.caption ? [strongMarkdown(block.caption, MD_CONTEXT.INLINE, true), ""] : [];
        return [...caption, line(columns), line(columns.map(() => "---")), ...rows].join("\n");
      }
      default:
        throw new Error(`unknown block type ${block.type}`);
    }
  }

  function sectionsText(model, writeHeading, writeBlock) {
    return model.sections
      .map((sec) => [...(sec.heading ? [writeHeading(sec.heading)] : []), ...sec.blocks.map(writeBlock).filter((b) => b !== null)])
      .filter((parts) => parts.length)
      .map((parts) => parts.join(BLANK_LINE))
      .join(BLANK_LINE);
  }

  /**
   * Write a model as plain text. Nothing is escaped, so `short` is the flattened short runs exactly.
   * @param {Object} model - A DescriptionModel (see model.js)
   * @returns {{short: string, detailed: string}} `detailed` has no trailing newline
   * @throws {Error} On a node type it cannot write
   */
  function renderText(model) {
    return { short: plainRuns(model.short), detailed: sectionsText(model, plainRuns, textBlock) };
  }

  /**
   * Write a model as Markdown. Author runs are escaped so they read back as typed; describer furniture is not.
   * @param {Object} model - A DescriptionModel (see model.js)
   * @returns {{short: string, detailed: string}}
   * @throws {Error} On a node type it cannot write
   */
  function renderMarkdown(model) {
    return { short: markdownRuns(model.short, MD_CONTEXT.BLOCK), detailed: sectionsText(model, markdownHeading, markdownBlock) };
  }

  /**
   * Write a model as HTML under a profile. `shortHTML` is always the escaped plain short (no spans, no
   * `<strong>`), whatever the profile; the profile shapes the detailed tier only.
   * @param {Object} model - A DescriptionModel (see model.js)
   * @param {Object} profile - PROFILES.lines, or a profile with layout "sections"
   * @returns {{shortHTML: string, detailed: string}}
   * @throws {Error} On a node type or layout it cannot write
   */
  function renderHtml(model, profile) {
    if (!profile || typeof profile !== "object") {
      throw new Error("renderHtml needs a profile");
    }
    let detailed;
    if (profile.layout === LAYOUTS.LINES) {
      detailed = detailedLines(model, profile);
    } else if (profile.layout === LAYOUTS.SECTIONS) {
      detailed = detailedSections(model, profile);
    } else {
      throw new Error(`unknown layout ${profile.layout}`);
    }
    return {
      shortHTML: escapeAuthor(plainRuns(model.short)),
      detailed,
    };
  }

  logInfo("Description renderer initialised successfully");

  const api = {
    renderHtml,
    renderText,
    renderMarkdown,
    PROFILES,
  };

  root.ChartDescribeRender = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
