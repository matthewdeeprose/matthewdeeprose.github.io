/**
 * Mermaid Parse Adapter
 *
 * A thin, shared adapter over mermaid.mermaidAPI.getDiagramFromText, giving
 * the description modules one normalised flowchart graph shape instead of
 * eleven regex scanners. Stage 1 of the flowchart rewrite (item 2 in
 * docs/mermaid-outstanding.md): landed dark — nothing consumes it yet.
 *
 * getDiagramFromText is a semi-public internal of the pinned Mermaid 11.6.0
 * build (docs/mermaid-measurements-2026-08-01.md § B5), so this adapter
 * carries a self-check that parses a known fixture and asserts the accessor
 * names and field shapes measured in
 * docs/mermaid-flowchart-stage0-measurements-2026-08-01.md (M2, M3). A
 * Mermaid upgrade that changes those internals fails the self-check loudly
 * rather than degrading silently.
 */
window.MermaidParseAdapter = (function () {
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

  /**
   * Set the current logging level
   * @param {number} level - The logging level (0-3)
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
    }
  }

  /**
   * Check if logging should occur based on current level
   * @param {number} level - The level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The error message
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Parse Adapter] ERROR: ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The warning message
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Parse Adapter] WARN: ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The info message
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Parse Adapter] INFO: ${message}`, ...args);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The debug message
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Parse Adapter] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // Placeholder decoding — register item 9
  //
  // Mermaid's encodeEntities runs over the WHOLE diagram source inside
  // Diagram.fromText, BEFORE the parser ever sees it, and decodeEntities is
  // reached only from render-time label paths — never on the parse path. So
  // the db permanently holds private delimiter bytes wherever an author
  // typed Mermaid's own `#word;` / `#digits;` escape, and every description
  // tier has been reading them raw. Mechanism measured and the Mermaid
  // source quoted in
  // docs/mermaid-quot-placeholder-capture-2026-08-08.md § 3; the
  // per-surface verdicts adopted below are the completed render table in
  // docs/mermaid-quot-adoption-2026-08-08.md § 1.
  //
  // TWO transforms, because the surfaces genuinely differ and the
  // difference was MEASURED rather than assumed — the discriminator is
  // where Mermaid draws the label:
  //
  //   decodePlaceholders — resolves the placeholder to the character it
  //     stands for and leaves the author's OWN entity text alone. Correct
  //     for surfaces drawn into SVG <text>, where an author-typed `&quot;`
  //     is drawn literally. Git graph measured 0 foreignObjects.
  //   decodeAuthorText — additionally resolves the author's own character
  //     references. Correct for surfaces drawn into an HTML label subtree
  //     (foreignObject > div > span > p), where the browser's own parser
  //     resolves them: flowchart, ER and class.
  //
  // Both finish with a character-reference parse performed by a detached
  // <textarea>, which parses its content in RCDATA mode: references are
  // resolved while tag-looking text stays literal TEXT and nothing is ever
  // constructed as an element. Do not "simplify" this to DOMParser — that
  // strips tags, which would silently rewrite the hostile label of every
  // existing *-escaping fixture.
  //
  // Register item 19 (8 August 2026) completed the adoption across the
  // remaining author-text fields, on the same two functions. AMENDED
  // 4 SEPTEMBER 2026 BY REGISTER ITEM 78: this read "there is no third
  // transform, by design", and a THIRD ENTRY POINT now exists —
  // decodeSourcePlaceholders, below. It is a COMPOSITION over
  // decodePlaceholders, not a fourth mapping: it encodes with Mermaid's own
  // rule first, because its input is the CALLER'S RAW SOURCE, which
  // encodeEntities never ran over. It serves the core's author-override
  // route and nothing else. The per-surface carve-out below is UNCHANGED.
  // AMENDED 5 SEPTEMBER 2026: this read "it encodes with Mermaid's own
  // `#\w+;` rule first", which named ONE of encodeEntities' three passes.
  // The encode step is now the full three-pass copy, encodeMermaidEntities
  // (renamed from encodeXychartEntities the same day), so the override route
  // and the xychart source reader share one encoder rather than two. The two
  // leading passes strip the trailing semicolon of a `style:`/`classDef:`
  // colour token, so a one-pass encoder decoded a token the canvas leaves
  // alone — measured, and recorded on decodeSourcePlaceholders itself.
  // Its render table is
  // docs/mermaid-item19-field-capture-2026-08-08.md section 3, and each new
  // call site names its verdict. Three carve-outs are DELIBERATE and should
  // not be "completed" by a later editor:
  //
  //   accTitle / accDescr — no transform on ANY surface. ER and class deliver
  //     them permanently EMPTY while the rendered SVG's <title>/<desc> carries
  //     the author's text (a separate delivery defect, registered); flowchart
  //     and git do carry them, and no description module reads either field.
  //     AMENDED 4 SEPTEMBER 2026 BY REGISTER ITEM 78: this read "a transform
  //     there would be dead code no fixture could redden", and the CARVE-OUT
  //     STANDS for exactly that reason — the TEN surfaces still deliver both
  //     fields untransformed wherever they carry them at all. AMENDED
  //     5 SEPTEMBER 2026 BY REGISTER ITEM 80, which added the block surface
  //     and took the count from nine: the qualifier is new too, because two of
  //     the ten carry NEITHER field and a bare count implied otherwise. Sankey
  //     has no accTitle/accDescr syntax, and on block both directives are a
  //     HARD PARSE ERROR, so neither surface delivers the fields to transform.
  //     What changed is that the READER-FACING value
  //     does not come from a surface at all: the core reads the RAW SOURCE
  //     through parseAccessibilityDirectives and assigns it over both
  //     description tiers, and THAT route is now decoded, by
  //     decodeSourcePlaceholders below. Two undecoded forms from two code
  //     paths; this bullet governs the surface half only.
  //   flowchart / ER / class `title` — delivered permanently empty; those
  //     grammars have no body title statement and a frontmatter title never
  //     reaches getDiagramTitle().
  //   ER attribute `type` and `name`, class `namespaces[].name`, and the BARE
  //     `subgraph X` title form — C-NONE by rejection: their lexers refuse the
  //     delimiter bytes, so no author route delivers a placeholder to them.
  const PLACEHOLDER_NUMERIC = "ﬂ°°";
  const PLACEHOLDER_NAMED = "ﬂ°";
  const PLACEHOLDER_END = "¶ß";

  // Created on first use and reused; never inserted into the document.
  let referenceDecoder = null;

  /**
   * Resolve HTML character references in a string, without parsing tags.
   * @param {string} text - The text to decode
   * @returns {string} The text with character references resolved
   */
  function parseCharacterReferences(text) {
    if (!referenceDecoder) {
      referenceDecoder = document.createElement("textarea");
    }
    referenceDecoder.innerHTML = text;
    return referenceDecoder.value;
  }

  /**
   * Map Mermaid's private delimiters back onto the entity syntax they stand
   * for — the same mapping decodeEntities applies at render time.
   * @param {string} text - The delivered text
   * @returns {string} The text with delimiters mapped to entity syntax
   */
  function resolvePlaceholderDelimiters(text) {
    return text
      .split(PLACEHOLDER_NUMERIC)
      .join("&#")
      .split(PLACEHOLDER_NAMED)
      .join("&")
      .split(PLACEHOLDER_END)
      .join(";");
  }

  /**
   * Placeholder-only decode, for SVG-text surfaces. The author's own `&`
   * and `<` are protected BEFORE the delimiters are mapped, so an
   * author-typed entity survives as the literal text the canvas shows.
   * @param {string} text - The delivered text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodePlaceholders(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    const protectedText = text.split("&").join("&amp;").split("<").join("&lt;");
    return parseCharacterReferences(resolvePlaceholderDelimiters(protectedText));
  }

  /**
   * Full decode, for HTML-label surfaces: placeholders AND the author's own
   * character references, matching what the browser resolves in the label.
   * @param {string} text - The delivered text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodeAuthorText(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    return parseCharacterReferences(resolvePlaceholderDelimiters(text));
  }

  // ITEM 82, LINE BREAKS (ruled 2 October 2026): "a line break the picture
  // draws is read as a space; a <br> the picture prints as characters is read
  // as written." Both halves are decided HERE, on the RAW db string, because
  // decodeAuthorText turns an author-escaped `&lt;br&gt;` or `#lt;br#gt;` into
  // the same four characters a typed tag is, and nothing downstream can tell
  // them apart again. Measured 2 October 2026 on flowchart's four positions
  // (node, pipe edge, dash edge, subgraph): the raw string keeps a typed tag
  // (`<br>`, Mermaid having normalised every spelling) apart from the escaped
  // forms (`&lt;br&gt;`, and `#lt;br#gt;` as private delimiter bytes), on all
  // four. A surface calls decodeAuthorTextBreaks ONLY for a position whose
  // canvas draws the break (docs/mermaid-item-82-measure-2-2026-10-02.md § 3);
  // every other surface and every title position keeps decodeAuthorText or
  // decodePlaceholders and so keeps printing the tag.
  //
  // Typed forms matched: `<br>`, `<br/>`, `<br />`, any case. Measured: the
  // canvas breaks on all four spellings and on a run, and the db delivers them
  // as `<br>`; the pattern is wider than the delivery on purpose, so a Mermaid
  // change that stops normalising does not reopen the escaped-versus-typed
  // question. A RUN of breaks, with the whitespace around it, is ONE break.
  const TYPED_LINE_BREAK_RUN = /(?:\s*<br\s*\/?>\s*)+/gi;

  // ITEM 82, ENACTMENT 5 (3 October 2026): the per-call FORM SET. The surfaces
  // above all draw a break on every typed spelling, so they take ALL. Three
  // modules read the SOURCE (no adapter surface) and the canvas is
  // form-specific on two of them, measured 2 October 2026 (measure-2 § 3):
  // timeline breaks on `<br>` alone and prints `<br/>`, `<br />` and `<BR>`;
  // architecture breaks on every spelling EXCEPT `<BR>`, which it prints. A
  // form the canvas prints must be read as written, so each set is its own
  // pattern and a caller names the set rather than passing a pattern. The
  // names are exported as LINE_BREAK_FORMS so a module never types a string.
  const LINE_BREAK_FORMS = Object.freeze({
    ALL: "all",
    BR_ONLY: "br-only",
    NOT_UPPER_CASE: "not-upper-case",
  });
  const TYPED_LINE_BREAK_RUN_BY_FORMS = Object.freeze({
    [LINE_BREAK_FORMS.ALL]: TYPED_LINE_BREAK_RUN,
    [LINE_BREAK_FORMS.BR_ONLY]: /(?:\s*<br>\s*)+/g,
    [LINE_BREAK_FORMS.NOT_UPPER_CASE]: /(?:\s*<br\s*\/?>\s*)+/g,
  });

  /**
   * Replace typed line-break tags with the single space a reader hears, then
   * apply decodeAuthorText. An interior run becomes one space. A run at the
   * very start or end of the label is REMOVED, with the whitespace the run
   * itself carried: the canvas draws a leading break as an empty first line
   * and a trailing one not at all, so neither leaves a space in the words.
   * Whitespace the author typed elsewhere is untouched, and a label with no
   * break goes through byte-identically to decodeAuthorText.
   *
   * Item 82, markup (5 October 2026): a caller that passes `markup` also has
   * drawn markup read as its text, between the break rule and the decode
   * (replaceDrawnMarkup). Only the flowchart sites pass it; every other caller
   * passes nothing and is byte-unchanged.
   * @param {string} text - The delivered RAW label
   * @param {Object} [markup] - The sink's drawn-markup options, e.g.
   *   FLOWCHART_DRAWN_MARKUP; absent means no markup step
   * @returns {string} The decoded text with typed breaks read as spaces, or
   *   the input unchanged when not a non-empty string
   */
  function decodeAuthorTextBreaks(text, markup) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    const withoutBreaks = replaceTypedLineBreaks(text);
    const withoutMarkup = markup
      ? replaceDrawnMarkup(withoutBreaks, markup)
      : withoutBreaks;
    return decodeAuthorText(withoutMarkup);
  }

  // The single space that stands for "the author wrote a label and it draws
  // nothing". Item 82, enactment 4 (3 October 2026): a label that is only a
  // typed break is emptied by the transform, and a module that reads `""` as
  // "no label written" (block: the canvas then draws the id) would narrate the
  // bare id. Spaces-only labels already arrive as whitespace and already read
  // as unlabelled; this gives the break-only label the same delivery. The
  // module's own emptiness test is trim(), so the byte chosen never reaches a
  // narrated word.
  const PRESENT_BUT_EMPTY_LABEL = " ";

  /**
   * decodeAuthorTextBreaks for a position whose module distinguishes an ABSENT
   * label (`""`) from a PRESENT label that draws nothing. A non-empty raw
   * string that the break transform empties is delivered as one space; every
   * other input is exactly what decodeAuthorTextBreaks delivers.
   * A caller that passes `markup` also has drawn markup read as its text, so a
   * label that is only formatting tags (`<b></b>`) is delivered the same way.
   * @param {string} text - The delivered RAW label
   * @param {Object} [markup] - The sink's drawn-markup options
   * @returns {string} The decoded text, or one space for a break-only label
   */
  function decodeAuthorTextBreaksKeepingPresence(text, markup) {
    const decoded = decodeAuthorTextBreaks(text, markup);
    return typeof text === "string" && text !== "" && decoded === ""
      ? PRESENT_BUT_EMPTY_LABEL
      : decoded;
  }

  /**
   * The break rule itself, shared by both decode entries so the two kinds of
   * surface cannot drift apart: an interior run of typed breaks becomes one
   * space, and a run at the very start or end of the string is removed.
   * @param {string} text - A RAW db string
   * @param {string} [forms] - A LINE_BREAK_FORMS value naming the spellings the
   *   canvas draws a break for; absent or unknown means ALL
   * @returns {string} The string with typed breaks replaced
   */
  function replaceTypedLineBreaks(text, forms) {
    const pattern = Object.prototype.hasOwnProperty.call(
      TYPED_LINE_BREAK_RUN_BY_FORMS,
      forms
    )
      ? TYPED_LINE_BREAK_RUN_BY_FORMS[forms]
      : TYPED_LINE_BREAK_RUN;
    return text.replace(
      pattern,
      (run, offset, whole) =>
        offset === 0 || offset + run.length === whole.length ? "" : " "
    );
  }

  // ITEM 82, MARKUP (ruled 4 and 5 October 2026): "Formatting the picture
  // draws (bold, italic, underline, strikethrough, colour, and markdown
  // emphasis where Mermaid renders it) is read as the plain text it formats,
  // with no tags; a tag the picture prints as characters is read as written."
  // Extended on 5 October to <code> and <mark>. An image is read as its alt
  // text as written, and as nothing when it has none (I1). A link is read as
  // its text in this pass. A label the transform empties is an empty label
  // under the 2 October ruling and reads unlabelled in the type's own words.
  //
  // Like the break rule it runs on the RAW db string, AFTER the break rule and
  // BEFORE the decode: after the decode a typed `<b>` and an author-escaped
  // `&lt;b&gt;` or `#lt;b#gt;` are the same bytes. Measured 4 October 2026
  // (docs/mermaid-item-82-measure-3-2026-10-04.md § 6): the raw string keeps
  // them apart on every surface. A tag NOT listed (script, div, p, ...) is left
  // as typed: Mermaid's own sanitiser decides it, and the words read what the
  // picture prints. Enacted on flowchart only (5 October 2026); every other
  // surface still reads markup as delivered until its own session.
  const DRAWN_FORMATTING_TAG =
    /<\/?(?:b|i|u|s|strike|strong|em|code|mark|span|font|small|big|sub|sup)(?=[\s/>])(?:"[^"]*"|'[^']*'|[^<>"'])*>/gi;
  const DRAWN_IMAGE_TAG = /<img(?=[\s/>])((?:"[^"]*"|'[^']*'|[^<>"'])*)>/gi;
  const DRAWN_IMAGE_ALT =
    /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
  const DRAWN_ANCHOR_TAG = /<\/?a(?=[\s/>])(?:"[^"]*"|'[^']*'|[^<>"'])*>/gi;

  // Markdown, for the sinks whose canvas draws it. Two independent options,
  // because the sinks differ on them (measurement 3 § 3.2; enactment 2 of the
  // markup slice, 5 October 2026, measured on class and ER):
  //   emphasis  `*x*`, `**x**`, `_x_`, `__x__` and `\*` `\_` escapes. Class and
  //             ER DRAW it (all six positions); flowchart and block print it.
  //   codespan  `x`. PRINTED by every sink read so far, class and ER included,
  //             and the span is opaque: `a*b*c` inside backticks is not
  //             emphasis. No caller passes it yet.
  // Mermaid's canvas follows CommonMark's emphasis rules, which a regex does
  // not: `a*b*c` draws `abc` while `a_b_c` is left alone, `_a_b` draws `a_b`,
  // and `*a**` draws `a*`. readDrawnEmphasis below is the delimiter-run
  // algorithm, checked cell by cell against the canvas.
  const MARKDOWN_PUNCTUATION = /[\p{P}\p{S}]/u;
  const MARKDOWN_WHITESPACE = /\s/;

  /**
   * Read CommonMark emphasis (and, optionally, code spans) as its text.
   * Characters adjacent to a run are read from the string itself; the ends
   * count as whitespace. Backslash before `*` or `_` is dropped and the mark
   * kept; any other backslash is left as typed.
   * @param {string} text - A string after the tag removal
   * @param {Object} options - `{ emphasis, codespan }` booleans
   * @returns {string} The text with drawn markdown read as its text
   */
  function readDrawnMarkdown(text, options) {
    const chars = Array.from(text);
    const removed = new Array(chars.length).fill(false);
    const runs = [];
    const isSpace = (ch) => ch === undefined || MARKDOWN_WHITESPACE.test(ch);
    const isPunct = (ch) => ch !== undefined && MARKDOWN_PUNCTUATION.test(ch);

    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (ch === "\\") {
        const next = chars[i + 1];
        if (next === "*" || next === "_") {
          if (options.emphasis) {
            removed[i] = true;
          }
          i += 2;
        } else if (next === "\\") {
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }
      if (ch === "`") {
        let open = i;
        while (chars[open] === "`") {
          open += 1;
        }
        const fence = open - i;
        let close = open;
        let found = -1;
        while (close < chars.length) {
          if (chars[close] !== "`") {
            close += 1;
            continue;
          }
          let end = close;
          while (chars[end] === "`") {
            end += 1;
          }
          if (end - close === fence) {
            found = close;
            break;
          }
          close = end;
        }
        if (found === -1) {
          i = open;
          continue;
        }
        if (options.codespan) {
          for (let k = i; k < i + fence; k += 1) {
            removed[k] = true;
          }
          for (let k = found; k < found + fence; k += 1) {
            removed[k] = true;
          }
        }
        i = found + fence;
        continue;
      }
      if ((ch === "*" || ch === "_") && options.emphasis) {
        let end = i;
        while (chars[end] === ch) {
          end += 1;
        }
        const before = chars[i - 1];
        const after = chars[end];
        const left =
          !isSpace(after) &&
          (!isPunct(after) || isSpace(before) || isPunct(before));
        const right =
          !isSpace(before) &&
          (!isPunct(before) || isSpace(after) || isPunct(after));
        const underscore = ch === "_";
        runs.push({
          ch,
          start: i,
          length: end - i,
          originalLength: end - i,
          consumed: 0,
          canOpen: underscore ? left && (!right || isPunct(before)) : left,
          canClose: underscore ? right && (!left || isPunct(after)) : right,
        });
        i = end;
        continue;
      }
      i += 1;
    }

    for (let c = 0; c < runs.length; c += 1) {
      const closer = runs[c];
      while (closer.canClose && closer.length > 0) {
        let o = c - 1;
        while (o >= 0) {
          const opener = runs[o];
          const bothThree =
            opener.originalLength % 3 === 0 && closer.originalLength % 3 === 0;
          const blocked =
            (opener.canClose || closer.canOpen) &&
            (opener.originalLength + closer.originalLength) % 3 === 0 &&
            !bothThree;
          if (
            opener.ch === closer.ch &&
            opener.length > 0 &&
            opener.canOpen &&
            !blocked
          ) {
            break;
          }
          o -= 1;
        }
        if (o < 0) {
          break;
        }
        const opener = runs[o];
        const use = opener.length >= 2 && closer.length >= 2 ? 2 : 1;
        for (let k = 0; k < use; k += 1) {
          removed[opener.start + opener.length - 1 - k] = true;
          removed[closer.start + closer.consumed + k] = true;
        }
        opener.length -= use;
        closer.length -= use;
        closer.consumed += use;
        for (let between = o + 1; between < c; between += 1) {
          runs[between].length = 0;
        }
      }
    }
    return chars.filter((ch, index) => !removed[index]).join("");
  }

  // The options the class and ER sites pass to decodeAuthorTextBreaks: both
  // draw emphasis, both print backticks (measured at all six positions, 5
  // October 2026). Flowchart PRINTS emphasis (measurement 3 § 3.2), so it is
  // read as written.
  const FLOWCHART_DRAWN_MARKUP = Object.freeze({
    emphasis: false,
    codespan: false,
  });
  const CLASS_DRAWN_MARKUP = Object.freeze({ emphasis: true, codespan: false });
  const ER_DRAWN_MARKUP = Object.freeze({ emphasis: true, codespan: false });
  // Block PRINTS emphasis and backticks at both its positions (measurement 3
  // § 3.2, rechecked 5 October 2026), so only the tags are read as text.
  const BLOCK_DRAWN_MARKUP = Object.freeze({ emphasis: false, codespan: false });
  // Kanban DRAWS emphasis and PRINTS backticks at all five of its text
  // positions: column, card label, ticket, assigned (measurement 3 § 3.2, and
  // re-read per position on 5 October 2026 in enactment 3's draft table).
  const KANBAN_DRAWN_MARKUP = Object.freeze({ emphasis: true, codespan: false });

  /**
   * The markup rule: formatting the picture draws is read as the text it
   * formats. Formatting tags (open, close, unclosed, any case, any attributes)
   * are removed and their text kept; an image becomes its alt text as written,
   * or nothing; a link becomes its text. When anything was removed, runs of
   * whitespace collapse to one space and the ends are trimmed, as the canvas
   * shows them, so a tag-only label arrives empty. A label with nothing to
   * remove is returned byte-identical.
   * @param {string} raw - A RAW db string, after the break rule
   * @param {Object} [options] - `tags: false` leaves tags, images and links
   *   as written (default true); `emphasis: true` also reads drawn markdown
   *   emphasis as its text; `codespan: true` also removes code-span backticks
   * @returns {string} The string with drawn markup read as its text
   */
  function replaceDrawnMarkup(raw, options) {
    if (typeof raw !== "string" || raw === "") {
      return raw;
    }
    const read = readDrawnMarkupText(raw, options);
    if (!read.changed) {
      return raw;
    }
    logDebug(`Drawn markup read as text: "${raw}" -> "${read.text}"`);
    return read.text.replace(/\s+/g, " ").trim();
  }

  /**
   * The tag, image, link and markdown reading of replaceDrawnMarkup, WITHOUT
   * its whitespace collapse. Split out (item 82, L2) so the link-segment
   * reader can read each piece of a label the same way and collapse once
   * across the pieces; replaceDrawnMarkup is a pure move around it.
   * @param {string} raw - A non-empty RAW db string, after the break rule
   * @param {Object} [options] - As replaceDrawnMarkup
   * @returns {{text: string, changed: boolean}} The text with markup read, and
   *   whether anything was removed
   */
  function readDrawnMarkupText(raw, options) {
    let changed = false;
    const mark = (replacement) => {
      changed = true;
      return replacement;
    };

    // Item 82, enactment 4 (5 October 2026): a sink that PRINTS tags as
    // characters (architecture) passes `tags: false`, which skips the three
    // tag rules below and leaves every tag as written. The images and links
    // rules stay under it, because that sink prints those tags too.
    const readTags = !options || options.tags !== false;
    let text = raw;
    if (readTags) {
      text = text.replace(DRAWN_IMAGE_TAG, (tag, attributes) => {
        const alt = attributes.match(DRAWN_IMAGE_ALT);
        return mark(
          alt ? [alt[1], alt[2], alt[3]].find((v) => v !== undefined) : ""
        );
      });
      // The L2 pass reads the anchor's href HERE, before the tag is removed;
      // this pass reads a link as its text alone.
      text = text.replace(DRAWN_ANCHOR_TAG, () => mark(""));
      text = text.replace(DRAWN_FORMATTING_TAG, () => mark(""));
    }
    if (options && (options.emphasis === true || options.codespan === true)) {
      const read = readDrawnMarkdown(text, options);
      if (read !== text) {
        mark("");
        text = read;
      }
    }

    return { text, changed };
  }

  // ITEM 82, L2 (6 October 2026): a link the picture draws is a working link
  // in the words. Only an http: or https: address is admitted, tested exactly
  // as the kanban ticket link is (buildKanbanTicketUrl, K15): resolved against
  // document.baseURI, so a relative, protocol-relative or upper-case-scheme
  // address is admitted and mailto:, javascript: and the rest are text. That
  // test is fused with URL-building inside the kanban function and is not a
  // pure move, so it is duplicated here rather than lifted.
  const LINK_ADMITTED_SCHEMES = Object.freeze(["http:", "https:"]);
  const DRAWN_ANCHOR_PAIR =
    /<a(?=[\s/>])((?:"[^"]*"|'[^']*'|[^<>"'])*)>([\s\S]*?)<\/a\s*>/gi;
  const DRAWN_ANCHOR_HREF =
    /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

  /**
   * Is this href one the words may link to?
   * @param {string} href - The decoded href as written
   * @returns {boolean} True for an address resolving to http: or https:
   */
  function isAdmittedLinkHref(href) {
    if (typeof href !== "string" || href.trim() === "") {
      return false;
    }
    try {
      const resolved = new URL(href, document.baseURI);
      return LINK_ADMITTED_SCHEMES.indexOf(resolved.protocol) !== -1;
    } catch (error) {
      logDebug(`Link href refused, unparseable: ${JSON.stringify(href)}`);
      return false;
    }
  }

  /**
   * Read a label as ordered pieces so a link the picture draws can be
   * followed from the words. The plain label is NOT changed by this: it is
   * whatever decodeAuthorTextBreaks delivers, and the join of the segment
   * texts must equal it exactly or no segments are delivered.
   *
   * Each anchor's inner text takes the same breaks, markup and decode as the
   * label (so `<a><b>bold link</b></a>` is the text `bold link`); the text
   * between anchors is a plain segment. The href is decoded ONCE with the
   * surface's decode and is delivered as written, never resolved. A linked
   * segment is kept only for an admitted href with non-empty text; an anchor
   * with no href, an unadmitted one or an empty one delivers its text as a
   * plain segment, or nothing when it has none. Whitespace collapses once
   * across the pieces, as the label's does.
   * @param {string} text - The delivered RAW label
   * @param {Object} markup - The sink's drawn-markup options
   * @param {string} label - What decodeAuthorTextBreaks delivered for `text`
   * @returns {Array<{text: string, href?: string}>|null} The segments, or
   *   null when the label has no anchor or the join check fails
   */
  function readDrawnLinkSegments(text, markup, label) {
    if (typeof text !== "string" || text === "" || (markup && markup.tags === false)) {
      return null;
    }
    const raw = replaceTypedLineBreaks(text);
    const pieces = [];
    let cursor = 0;
    for (const match of raw.matchAll(DRAWN_ANCHOR_PAIR)) {
      if (match.index > cursor) {
        pieces.push({ raw: raw.slice(cursor, match.index), href: null });
      }
      const found = match[1].match(DRAWN_ANCHOR_HREF);
      pieces.push({
        raw: match[2],
        href: found
          ? decodeAuthorText([found[1], found[2], found[3]].find((v) => v !== undefined))
          : null,
        anchor: true,
      });
      cursor = match.index + match[0].length;
    }
    if (!pieces.some((piece) => piece.anchor)) {
      return null;
    }
    if (cursor < raw.length) {
      pieces.push({ raw: raw.slice(cursor), href: null });
    }

    // One collapse across the pieces, then the trim at both ends.
    let spaceBefore = true;
    for (const piece of pieces) {
      let read = readDrawnMarkupText(piece.raw, markup).text.replace(/\s+/g, " ");
      if (spaceBefore && read.startsWith(" ")) {
        read = read.slice(1);
      }
      piece.text = read;
      if (read !== "") {
        spaceBefore = read.endsWith(" ");
      }
    }
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      if (pieces[i].text !== "") {
        pieces[i].text = pieces[i].text.replace(/ $/, "");
        break;
      }
    }

    const segments = [];
    for (const piece of pieces) {
      const piecetext = decodeAuthorText(piece.text);
      if (piecetext === "") {
        continue;
      }
      const last = segments[segments.length - 1];
      if (piece.anchor && isAdmittedLinkHref(piece.href)) {
        segments.push({ text: piecetext, href: piece.href });
      } else if (last && last.href === undefined) {
        last.text += piecetext;
      } else {
        segments.push({ text: piecetext });
      }
    }
    if (segments.map((segment) => segment.text).join("") !== label) {
      logDebug(`Link segments dropped, their join differs from the label: "${label}"`);
      return null;
    }
    return segments;
  }

  /**
   * decodeAuthorTextBreaks plus the link segments of a drawn label.
   *
   * Item 82, entity slice (6 October 2026): a source-reading module passes
   * `{ fromSource: true }`, and the label is encoded with Mermaid's own rule
   * first, as the db-fed surfaces already are. Each segment's decodeAuthorText
   * then resolves Mermaid's `#name;` codes as well as the author's references,
   * so the segments join to what decodeAuthorTextFromSource delivers (24 of 24
   * linked cells in the measurement, § 5). Without the option the reader is
   * byte-unchanged.
   * @param {string} text - The delivered RAW label
   * @param {Object} markup - The sink's drawn-markup options
   * @param {{fromSource: boolean}} [options] - `fromSource` for raw diagram
   *   source that Mermaid's encode never ran over
   * @returns {{label: string, segments?: Array}} The label exactly as
   *   decodeAuthorTextBreaks delivers it; `segments` only when the label drew
   *   an anchor
   */
  function readLabelWithLinks(text, markup, options) {
    const source =
      options && options.fromSource === true && typeof text === "string"
        ? encodeMermaidEntities(text)
        : text;
    const label = decodeAuthorTextBreaks(source, markup);
    const segments = readDrawnLinkSegments(source, markup, label);
    return segments ? { label, segments } : { label };
  }

  // ITEM 82 on the SVG-text surfaces that decode with decodePlaceholders
  // (sequence and c4, enacted 2 October 2026). Measured on both, on every
  // narrated position whose canvas draws a break: all four typed spellings, a
  // run and the spaced form draw a break; `#lt;br#gt;` (private delimiter
  // bytes in the raw string) and `&lt;br&gt;` (entity text, a parse error on
  // sequence) are drawn as characters. So the per-form set is the same typed
  // set as decodeAuthorTextBreaks, applied to the RAW string before
  // decodePlaceholders. The decode then keeps both escaped forms as written,
  // as it always has. TITLES NEVER CALL THIS: on both types the canvas prints a
  // typed tag in the title, so the title keeps plain decodePlaceholders.
  // docs/mermaid-item-82-enact-3-2026-10-02.md carries the per-position table.

  /**
   * Replace typed line-break tags with the single space a reader hears, then
   * apply decodePlaceholders. The decodePlaceholders sibling of
   * decodeAuthorTextBreaks; same rule, same edge behaviour.
   * @param {string} text - The delivered RAW label
   * @returns {string} The decoded text with typed breaks read as spaces, or
   *   the input unchanged when not a non-empty string
   */
  function decodePlaceholdersBreaks(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    return decodePlaceholders(replaceTypedLineBreaks(text));
  }

  /**
   * Decode Mermaid's own #word; and #digits; escapes in text taken from the
   * RAW diagram source, which encodeEntities never touched.
   * Encodes with Mermaid's rule and then applies decodePlaceholders, so the
   * author's own & and < survive as typed. Register item 78: this serves ONLY
   * the core's author-override route, which reads the raw source; the TEN
   * surfaces still hand accTitle/accDescr through untransformed wherever they
   * carry them, because no module reads them there. (Nine until 5 September
   * 2026, when register item 80 added the block surface — which, like sankey,
   * carries neither field at all.)
   *
   * THE ENCODE STEP IS THE THREE-PASS COPY, AND HAS BEEN SINCE 5 SEPTEMBER
   * 2026. It was a one-pass `#\w+;` replace inlined here until then — item 78
   * implemented only the branch its dispatch named, and registered the
   * duplication as a thing to decide. It is decided: this calls the shared
   * encodeMermaidEntities below, and the local copy is gone.
   *
   * WHY THE TWO PRE-PASSES MATTER HERE and not only on xychart. Mermaid's own
   * encodeEntities runs its `style`/`classDef` passes over the WHOLE source
   * before the parser sees it, and each one STRIPS THE TRAILING SEMICOLON of a
   * colour token — so a `#…;` token following `style:` or `classDef:` with no
   * space between never becomes a placeholder, and the canvas draws it
   * literally. A one-pass encoder decodes a token the canvas leaves alone, and
   * the reader is then told something the sighted user cannot see. MEASURED
   * 5 September 2026 on `accTitle: style:#quot;x#quot;`: the SVG <title> reads
   * `style:"x#quot` where the one-pass decode gave `style:"x"`. The same value
   * WITH a space after the colon agreed on both sides before this change and
   * after it, because `\S*` cannot cross the space and no pre-pass fires.
   *
   * @param {string} text - Raw source text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodeSourcePlaceholders(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    // encodeMermaidEntities is a hoisted function declaration in this same
    // IIFE, declared below; the call is resolved by hoisting, not by order.
    return decodePlaceholders(encodeMermaidEntities(text));
  }

  // ITEM 82, ENTITY SLICE, ENACTMENT 1 (6 October 2026): the FOURTH decode
  // entry point, for the source-reading modules whose canvas draws the FULL
  // decode (mindmap node, state alias and state transition label: foreignObject
  // sinks). It differs from decodeSourcePlaceholders above in its second step
  // only. That one is decodePlaceholders, which leaves an author-typed `&lt;`
  // as the text `&lt;`, because an SVG-text canvas prints it so; this one is
  // decodeAuthorText, which resolves it, because these canvases draw `<`.
  // Measured 6 October 2026 (docs/mermaid-item-82-entity-measure-2026-10-06.md
  // § 2): A∘E matched the canvas on 15 of 15 forms at the mindmap node and the
  // state alias, where decodeSourcePlaceholders matched 9. Ruling: "the words
  // read the characters the picture prints, decoded once and escaped once."

  /**
   * Decode text taken from the RAW diagram source the way a foreignObject
   * canvas draws it: encode with Mermaid's own rule, then resolve the
   * placeholders AND the author's own character references.
   * @param {string} text - Raw source text, after the break and markup rules
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodeAuthorTextFromSource(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    return decodeAuthorText(encodeMermaidEntities(text));
  }

  // ---------------------------------------------------------------------
  // THE ADAPTER-WIDE PARSE QUEUE — register item 21
  //
  // Mermaid keeps the accessible title, the accessible description and the
  // diagram title in ONE module-scoped store shared by every diagram type
  // (`rA` / `iA` / `nA` in its common db), read through a single shared
  // getter and CLEARED BY EVERY PARSE. Measured and named in
  // docs/mermaid-item21-mechanism-2026-08-08.md §§ 5-6. Each normalise*
  // below reads that store inside its own parse's .then, so any OTHER parse
  // issued in the window between that parse resolving and the read had
  // already zeroed or overwritten it. Three consequences were measured:
  // ER and class delivered "" on the first call of a page (their own
  // self-check's fixture parse was the racer); two concurrent parses
  // delivered each other's accessible titles; and git's `title` — the one
  // field of the three that a description module actually consumes, since
  // it reaches the plain short and through it the SVG's aria-label — could
  // be lost outright.
  //
  // THE INVARIANT THIS QUEUE EXISTS TO ENFORCE, and the one line to keep
  // true when editing anything below:
  //
  //     NOTHING READS ANY MERMAID DB OUTSIDE A QUEUE SLOT.
  //
  // A slot runs one getDiagramFromText AND the whole read of its result —
  // normalise* for a consumer, the raw assertion reads for a self-check —
  // before the queue advances. Reading a db from a .then attached OUTSIDE
  // the slot happens to work by microtask attachment order; that is an
  // accident of scheduling, not a defence, and must not be relied on.
  //
  // THIS ONE QUEUE REPLACES THE TWO SURFACE-LOCAL QUEUES that preceded it
  // (git and sankey), and it inherits both of their rationales in full:
  //
  //   - GIT SINGLETON DEFENCE 2 (stage 0 M2e,
  //     docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md): the git
  //     db is a module-level SINGLETON, and a second parse destroys the
  //     first diagram's data IN PLACE. Serialising is what stops a second
  //     call mutating it mid-snapshot.
  //   - SANKEY SINGLETON DEFENCE 2 (stage 0 S2e,
  //     docs/mermaid-sankey-stage0-measurements-2026-08-03.md): the sankey
  //     db is likewise a shared singleton, but its data is REASSIGNED by
  //     the next parse rather than mutated in place. That difference is why
  //     defence 1 there is about WHEN getGraph() is called rather than
  //     about deep-copying what it returns — a projection taken at the
  //     right moment is durable, and the queue is what guarantees the right
  //     moment.
  //
  // Each surface's eager-snapshot defence 1 stays exactly where it was, in
  // normaliseGit and normaliseSankey. This queue does not replace it.
  //
  // WHY SANKEY QUEUES EVEN THOUGH IT CANNOT LOSE ANYTHING (measured
  // 9 August 2026, check CQ11 in
  // docs/mermaid-concurrency-instrument-2026-08-09.md): the sankey shape
  // carries none of the three fields, because the type has no syntax that
  // populates them — but a sankey parse CLEARS the shared store like every
  // other parse. It is a racer that can never be a victim, so it queues for
  // the other four surfaces' sake rather than its own.
  //
  // THE SURFACES ON THIS QUEUE, and there are TEN as of 5 September 2026:
  // flowchart (the bare `parse`), ER, class, git, sankey, xychart, gantt,
  // quadrant, sequence and block. Register item 80 added the last of them, and
  // block is the type this queue matters MOST to — its db is a shared
  // singleton on which a second parse replaces the WHOLE payload rather than
  // only the shared scalar trio, so the slot is what protects the blocks and
  // edges themselves and not merely the titles (census
  // docs/mermaid-item-80-census-1-2026-09-05.md § Q8).
  //
  // SHARED FATE, ACCEPTED DELIBERATELY: one queue means a parse that never
  // settles stalls all ten surfaces where ten queues would have stalled
  // one. There is no timeout machinery here on purpose — a timeout would
  // have to abandon a slot whose parse may still be mutating a singleton
  // db, which is the very thing the queue exists to prevent. What CANNOT
  // wedge the queue is a rejection: every enqueued run appends a
  // settlement-only tail, so the chain advances whether its parse resolved
  // or rejected.
  //
  // RESIDUAL, named rather than implied: the store belongs to Mermaid, so
  // this queue contains only the parses THIS ADAPTER issues. A
  // mermaid.render anywhere else on the page parses through the same store
  // and is outside it — registered separately in
  // docs/mermaid-outstanding.md.
  //
  // Verification: .claude/mermaid-harness/concurrency.mjs, which must be
  // fully green after any change to this file.
  let adapterParseQueue = Promise.resolve();

  // ---------------------------------------------------------------------

  // Direction spellings: Mermaid preserves "TD" rather than normalising it
  // (stage 0 M3a), so the adapter collapses the synonym itself.
  const DIRECTION_SYNONYMS = Object.freeze({ TD: "TB" });

  // Shape spellings: Mermaid delivers every `@{ shape: … }` name VERBATIM,
  // so one visual shape reaches the modules under several different strings
  // — a diamond as `diam`, `decision`, `question` or `diamond`. Measured
  // in docs/mermaid-shape-grounding-2026-08-20.md § 1.2 and § 5.1: 121
  // distinct strings collapse onto roughly forty visual shapes.
  //
  // The modules test the CANONICAL string, so an alias spelling silently
  // misses every shape predicate. `decisionIds` and the R7 split guard both
  // read `shape === "diamond"`, and an alias-spelled diamond was measured
  // narrating as an ordinary step — or, with unlabelled exits, as a
  // parallel split, which R13 forbids in terms (§ 5.2). This is the fix
  // for that defect.
  //
  // SECOND SLICE OF THE FULL NORMALISATION TABLE (register item 44 — NOT
  // item 41, which is markdown emphasis stripping; the two were conflated
  // once and item 44 records the misreading). The adapter is the only place
  // a spelling can be collapsed, because the modules never see the source.
  // Extend one shape at a time, and only for shapes something actually
  // READS — a row that no consumer tests buys nothing and can go stale.
  //
  //   Slice 1, 20 August 2026 — the diamond, for the two module predicates.
  //   Slice 2, 21 August 2026 — the datastore, both parallelogram directions
  //     and the manual-input sloped rectangle, for R25's shape vocabulary.
  //
  // CANONICAL CHOICE: the string the CLASSIC bracket form delivers, where a
  // classic form exists, otherwise Mermaid's own canonical name. That is why
  // the right-hand side carries the underscore spellings `lean_right` and
  // `lean_left` — those are what `[/x/]` and `[\x\]` deliver, and they cannot
  // be written inside `@{ shape: … }` at all (measured 21 August 2026: an
  // underscore name is REJECTED there, "Shape names should be lowercase").
  //
  // BOTH PARALLELOGRAM DIRECTIONS KEEP DISTINCT CANONICALS. They are
  // measurably different drawn shapes — mirrored polygons — and the adapter's
  // job is to preserve visual identity. R25 maps both to one narration
  // prefix; that collapse belongs to the module, not here.
  //
  // `disk` IS DELIBERATELY ABSENT from the cylinder rows. The shape grounding
  // lists it as a cylinder alias; a rendered-geometry comparison on
  // 21 August 2026 measured its outline byte-identical to `lin-cyl` ("disk
  // storage") and DIFFERENT from `cyl`. Including it would fire the datastore
  // narration on a shape the reader sees as something else, which is the
  // exact defect this table exists to prevent. See the shape vocabulary
  // report of 21 August 2026.
  //
  // NO TRAPEZOID SPELLING APPEARS HERE. `manual` and `manual-file` name the
  // manual-TASK trapezoid, a different visual shape from the manual-INPUT
  // sloped rectangle, and the two were measured distinct in both directions
  // — different delivered strings and different drawn outlines. Register
  // item 44 carries the ruling and its stop condition.
  const SHAPE_SYNONYMS = Object.freeze({
    // Slice 1: the diamond. Canonical is the classic `{ }` form's string.
    diam: "diamond",
    decision: "diamond",
    question: "diamond",
    // Slice 2, datastore. Canonical `cylinder` is what `[(x)]` delivers.
    cyl: "cylinder",
    db: "cylinder",
    database: "cylinder",
    // Slice 2, parallelogram pointing right. Canonical `lean_right` is what
    // `[/x/]` delivers; the `@{ }` spellings all collapse onto it.
    "lean-r": "lean_right",
    "in-out": "lean_right",
    "lean-right": "lean_right",
    // Slice 2, parallelogram pointing left. Canonical `lean_left` is what
    // `[\x\]` delivers.
    "lean-l": "lean_left",
    "out-in": "lean_left",
    "lean-left": "lean_left",
    // Slice 2, manual-input sloped rectangle. NO classic form exists for it,
    // so the canonical is Mermaid's own canonical name, `sl-rect`.
    "manual-input": "sl-rect",
  });

  // Single-slot memo: the last code string parsed and its promise. The
  // promise is cached, not the resolved value, so concurrent callers with
  // the same code share one parse and a rejection stays deterministic.
  let memoCode = null;
  let memoPromise = null;

  // Self-check health: null until the check has run, then true or false.
  let healthy = null;

  // The self-check runs LAZILY, memoised, on the first parse() call — not
  // eagerly at script evaluation. Measured 2 August 2026 (stage 1, step 0
  // and its gate): on a fully loaded tools.html, getDiagramFromText
  // resolves normally with no explicit mermaid.initialize call, but at
  // script-evaluation time — when this file's tag executes during page
  // load — the same call REJECTS with "No diagram type detected matching
  // given configuration", because Mermaid's diagram detectors are not yet
  // registered that early. An eager check therefore reported a false
  // failure on every page load; by first consumer call, Mermaid is ready.
  let selfCheckStarted = false;
  let selfCheckPromise = null;

  /**
   * The embedded self-check fixture. Small on purpose: eight nodes and seven
   * edges exercise all seven accessors and every field the normalised shape
   * exposes (labelled and bare-id nodes, labelled and unlabelled edges).
   */
  const SELF_CHECK_FIXTURE = [
    "graph TB",
    "    A[Start] -->|go| B(Round)",
    "    B --> C",
    // Item 82: a typed break and an author-escaped one, so a broken break
    // transform makes this surface unhealthy rather than silently narrating
    // the wrong reading. The fourth node's label is `one<br>two`, which must
    // arrive as `one two`; the fifth is `three&lt;br&gt;four`, which must
    // arrive as the characters `three<br>four`.
    '    C --> D["one<br>two"]',
    '    D --> E["three&lt;br&gt;four"]',
    // Item 82, markup (5 October 2026): a typed tag, an author-escaped one and
    // a tag-only label. F `<b>x</b>` must arrive as `x`; G `&lt;b&gt;x&lt;/b&gt;`
    // as the characters `<b>x</b>`; H `<b></b>` as the empty string, the same
    // delivery a break-only label has, which the module reads as unlabelled.
    '    E --> F["<b>x</b>"]',
    '    F --> G["&lt;b&gt;x&lt;/b&gt;"]',
    '    G --> H["<b></b>"]',
  ].join("\n");

  // Item 82, L2 (6 October 2026): the link rows. A second fixture, parsed in
  // its own queue slot after the first, so the original eight-node fixture and
  // every count asserted against it stay as they were. Each link form is the
  // measurement's (docs/mermaid-item-82-l2-measure-2026-10-05.md section 1),
  // and each row below asserts the delivered href equals the href attribute
  // the CANVAS drew for that form.
  const FLOWCHART_LINK_SELF_CHECK_FIXTURE = [
    "flowchart TB",
    "    L1[\"Zq <a href='https://example.org/a b?x=1&y=2'>text</a>\"] -->|\"<a href='https://example.org'>go</a>\"| L2[\"<a href='https://example.org'>one</a> and <a href='https://example.net'>two</a>\"]",
    "    L2 -- \"<a href='https://example.org'><b>bold link</b></a>\" --> L3[\"<a href='https://example.org'>dup</a> and dup\"]",
    "    L3 --> L4[\"<a href='https://example.org/a&quot;b'>quote in href</a>\"]",
    "    L4 --> L5[\"<a href='/relative'>r</a> <a href='//example.org/p'>p</a> <a href='HTTPS://EXAMPLE.ORG/X'>upper</a>\"]",
    "    L5 --> L6[\"<a href='javascript:alert(1)'>j</a> <a href='mailto:a@example.org'>m</a> <a>none</a> <a href='https://example.org'></a>.\"]",
    "    subgraph SG [\"<a href='https://example.org/s'>group</a> title\"]",
    "        L6",
    "    end",
  ].join("\n");

  /**
   * The link rows of the flowchart self-check, over the delivered link
   * fixture. Each is [name, predicate].
   * @param {Object} graph - The normalised link fixture
   * @returns {Array} Assertion rows
   */
  function flowchartLinkAssertions(graph) {
    const same = (actual, expected) =>
      JSON.stringify(actual) === JSON.stringify(expected);
    const node = (id) => graph.nodes.find((n) => n.id === id);
    const segmented = []
      .concat(graph.nodes, graph.edges, graph.subgraphs)
      .filter((element) => element.segments);
    return [
      [
        "link: a node's link, its & decoded once and its space kept (m6)",
        !!node("L1") &&
          same(node("L1").segments, [
            { text: "Zq " },
            { text: "text", href: "https://example.org/a b?x=1&y=2" },
          ]),
      ],
      [
        "link: a pipe edge's link (m6 form on an edge)",
        !!graph.edges[0] &&
          same(graph.edges[0].segments, [
            { text: "go", href: "https://example.org" },
          ]),
      ],
      [
        "link: a dash edge's nested bold link reads as 'bold link' (l2)",
        !!graph.edges[1] &&
          graph.edges[1].label === "bold link" &&
          same(graph.edges[1].segments, [
            { text: "bold link", href: "https://example.org" },
          ]),
      ],
      [
        "link: two links in one label, in order (l1)",
        !!node("L2") &&
          same(node("L2").segments, [
            { text: "one", href: "https://example.org" },
            { text: " and " },
            { text: "two", href: "https://example.net" },
          ]),
      ],
      [
        "link: the first of two identical words is the linked one (l3)",
        !!node("L3") &&
          same(node("L3").segments, [
            { text: "dup", href: "https://example.org" },
            { text: " and dup" },
          ]),
      ],
      [
        "link: the quote entity in an href is decoded once (l7)",
        !!node("L4") &&
          same(node("L4").segments, [
            { text: "quote in href", href: 'https://example.org/a"b' },
          ]),
      ],
      [
        "link: relative, protocol-relative and upper-case-scheme hrefs are " +
          "admitted as written (m9, l6, l4)",
        !!node("L5") &&
          same(node("L5").segments, [
            { text: "r", href: "/relative" },
            { text: " " },
            { text: "p", href: "//example.org/p" },
            { text: " " },
            { text: "upper", href: "HTTPS://EXAMPLE.ORG/X" },
          ]),
      ],
      [
        "link: javascript:, mailto:, no href and an empty link are plain " +
          "text, and an empty link leaves no text (m7, m8, l8, m10)",
        !!node("L6") &&
          node("L6").label === "j m none ." &&
          same(node("L6").segments, [{ text: "j m none ." }]),
      ],
      [
        "link: a subgraph title's link",
        !!graph.subgraphs[0] &&
          graph.subgraphs[0].title === "group title" &&
          same(graph.subgraphs[0].segments, [
            { text: "group", href: "https://example.org/s" },
            { text: " title" },
          ]),
      ],
      [
        "link: the segment texts join to the delivered label, everywhere",
        segmented.length === 9 &&
          segmented.every(
            (element) =>
              element.segments.map((s) => s.text).join("") ===
              (element.label !== undefined ? element.label : element.title)
          ),
      ],
    ];
  }

  /**
   * Parse the link fixture in its own queue slot and return its rows. A
   * rejection is one failing row, not a throw.
   * @returns {Promise<Array>} Assertion rows
   */
  function runFlowchartLinkRows() {
    const run = () =>
      window.mermaid.mermaidAPI
        .getDiagramFromText(FLOWCHART_LINK_SELF_CHECK_FIXTURE)
        .then((diagram) => flowchartLinkAssertions(normaliseFlowchart(diagram)));
    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued.catch((error) => [
      [`link fixture parses (rejected: ${error && error.message})`, false],
    ]);
  }

  /**
   * Collapse an alias shape spelling onto the canonical string the
   * description modules test. Anything absent from SHAPE_SYNONYMS — `null`
   * included — is returned exactly as Mermaid delivered it.
   * @param {string|null} rawShape - The shape as the db delivered it
   * @returns {string|null} The canonical shape, or the raw value unchanged
   */
  function normaliseShape(rawShape) {
    const canonical = SHAPE_SYNONYMS[rawShape];
    // A typeof test rather than a truthiness one: a shape string that happens
    // to name an Object.prototype member must not resolve through the
    // prototype chain and rewrite the shape into a function.
    if (typeof canonical !== "string") return rawShape;
    logDebug(`Shape alias "${rawShape}" normalised to "${canonical}"`);
    return canonical;
  }

  /**
   * Normalise one Mermaid Diagram instance into the adapter's graph shape.
   * Field sources are the stage 0 measurements: vertex and edge shapes from
   * M2, bare-id text and absent type from M3i, subgraph flattening from M3l.
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised graph
   */
  function normaliseFlowchart(diagram) {
    const db = diagram.db;

    const rawDirection = db.getDirection();
    const direction = DIRECTION_SYNONYMS[rawDirection] || rawDirection;

    // Map iteration order is source first-mention order (M3j).
    // Item 9, verdict C-FULL for this surface: flowchart labels are drawn
    // inside an HTML label subtree, so the author's own character
    // references resolve on the canvas too. `id` is a join key that edges
    // reference and is deliberately left raw.
    // Item 82, L2 (6 October 2026): a label that drew an anchor also carries
    // `segments`, nested on the element, so no top-level field is added. The
    // plain `label` is unchanged by it.
    const nodes = [...db.getVertices().values()].map((vertex) => {
      const read = readLabelWithLinks(vertex.text, FLOWCHART_DRAWN_MARKUP);
      return {
        id: vertex.id,
        label: read.label,
        // Bare-id nodes carry no type property at all (M3i); null marks
        // "no declared shape" explicitly for consumers. The alias spellings
        // are collapsed here, inside the queue slot the db read already runs
        // in, so every consumer sees one string per visual shape.
        shape: normaliseShape(vertex.type === undefined ? null : vertex.type),
        ...(read.segments ? { segments: read.segments } : {}),
      };
    });

    const edges = db.getEdges().map((edge) => {
      const read = readLabelWithLinks(edge.text, FLOWCHART_DRAWN_MARKUP);
      return {
        from: edge.start,
        to: edge.end,
        label: read.label,
        kind: edge.type,
        stroke: edge.stroke,
        ...(read.segments ? { segments: read.segments } : {}),
      };
    });

    // Mermaid reports subgraphs flat, with a child subgraph's id appearing
    // in its parent's nodes array alongside real node ids (M3l). Split the
    // two by matching entries against the set of subgraph ids.
    const rawSubgraphs = db.getSubGraphs();
    const subgraphIds = new Set(rawSubgraphs.map((s) => s.id));
    // Item 19, verdict C-FULL (8 August 2026): a subgraph title is drawn in an
    // HTML label subtree like every other flowchart label. `id` is the join key
    // childSubgraphIds resolve against and stays RAW. One recorded wrinkle:
    // the consumer narrates `sub.title || sub.id`, so the fallback branch would
    // narrate a raw id where the primary narrates a decoded title — unreachable
    // today, because the BARE `subgraph X` form rejects every placeholder and
    // only the bracketed form can carry one.
    const subgraphs = rawSubgraphs.map((s) => {
      const read = readLabelWithLinks(s.title, FLOWCHART_DRAWN_MARKUP);
      return {
        id: s.id,
        title: read.label,
        nodeIds: s.nodes.filter((n) => !subgraphIds.has(n)),
        childSubgraphIds: s.nodes.filter((n) => subgraphIds.has(n)),
        ...(read.segments ? { segments: read.segments } : {}),
      };
    });

    return {
      type: "flowchart",
      direction: direction,
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      nodes: nodes,
      edges: edges,
      subgraphs: subgraphs,
    };
  }

  /**
   * Parse Mermaid flowchart code into the normalised graph shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 M3k), so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseFlowchart's
   * read of it run in one slot of the adapter-wide queue, so no other
   * adapter parse can clear Mermaid's shared accessible-title store between
   * them. The chain advances on settlement, not success, so a rejection
   * cannot wedge the queue. See the queue declaration for the mechanism.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised graph
   */
  function parse(code) {
    // Lazy self-check trigger (see the comment on selfCheckStarted). The
    // flag is set before runSelfCheck() parses the fixture, so the
    // re-entrant parse() call inside it cannot recurse.
    if (!selfCheckStarted) {
      runSelfCheck();
    }

    if (code === memoCode && memoPromise) {
      logDebug("Returning memoised parse for identical code string");
      return memoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24). It sits INSIDE run, so every line
    // is emitted from the queue slot the parse actually executes in rather
    // than from the caller's turn. The code string's LENGTH is logged and
    // never its text - author content stays out of the console.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Flowchart parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Flowchart parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseFlowchart(diagram);
          logDebug(
            `Flowchart parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Flowchart parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    memoCode = code;
    memoPromise = result;
    return result;
  }

  /**
   * Parse the embedded fixture and assert the accessor names and field
   * shapes this adapter depends on. Resolves true on a clean pass. On any
   * failure it logs one ERROR naming the failed assertion, marks the
   * adapter unhealthy, and resolves false. Never throws and never rejects.
   *
   * Memoised: the check runs once, and later calls return the same settled
   * promise. It goes through parse() itself, so it exercises exactly the
   * path consumers use — and, since item 21, that means its fixture parse
   * takes a slot on the adapter-wide queue like any other. The trigger runs
   * before the consumer's own parse enqueues, so the fixture parse holds
   * the earlier slot; `selfCheckStarted` is set before the re-entrant
   * parse() call, so that call cannot re-trigger the check.
   *
   * @returns {Promise<boolean>} Resolves to the health verdict
   */
  function runSelfCheck() {
    if (selfCheckPromise) {
      return selfCheckPromise;
    }
    selfCheckStarted = true;

    selfCheckPromise = parse(SELF_CHECK_FIXTURE)
      .then((graph) => {
        // Each entry: [assertion name, predicate]. The first false predicate
        // fails the check and is named in the single ERROR line.
        const assertions = [
          ["eight nodes", graph.nodes.length === 8],
          [
            "node order A to H",
            graph.nodes.map((n) => n.id).join(",") === "A,B,C,D,E,F,G,H",
          ],
          [
            "typed formatting tag read as its text (node F 'x')",
            graph.nodes[5] && graph.nodes[5].label === "x",
          ],
          [
            "escaped tag kept as characters (node G '<b>x</b>')",
            graph.nodes[6] && graph.nodes[6].label === "<b>x</b>",
          ],
          [
            "tag-only label delivered empty (node H '')",
            graph.nodes[7] && graph.nodes[7].label === "",
          ],
          [
            "typed break read as one space (node D 'one two')",
            graph.nodes[3] && graph.nodes[3].label === "one two",
          ],
          [
            "escaped break kept as characters (node E 'three<br>four')",
            graph.nodes[4] && graph.nodes[4].label === "three<br>four",
          ],
          [
            "node A label 'Start'",
            graph.nodes[0] && graph.nodes[0].label === "Start",
          ],
          [
            "node A shape 'square'",
            graph.nodes[0] && graph.nodes[0].shape === "square",
          ],
          [
            "node B shape 'round'",
            graph.nodes[1] && graph.nodes[1].shape === "round",
          ],
          ["node C label 'C'", graph.nodes[2] && graph.nodes[2].label === "C"],
          ["node C shape null", graph.nodes[2] && graph.nodes[2].shape === null],
          ["seven edges", graph.edges.length === 7],
          [
            "edge A to B with label 'go'",
            graph.edges[0] &&
              graph.edges[0].from === "A" &&
              graph.edges[0].to === "B" &&
              graph.edges[0].label === "go",
          ],
          [
            "edge B to C with empty label",
            graph.edges[1] &&
              graph.edges[1].from === "B" &&
              graph.edges[1].to === "C" &&
              graph.edges[1].label === "",
          ],
          [
            "every edge kind 'arrow_point'",
            graph.edges.every((e) => e.kind === "arrow_point"),
          ],
          [
            "every edge stroke 'normal'",
            graph.edges.every((e) => e.stroke === "normal"),
          ],
          ["direction 'TB'", graph.direction === "TB"],
          ["no subgraphs", graph.subgraphs.length === 0],
        ];

        // Item 82, L2: the link rows read a second fixture, parsed after this
        // one, so every predicate above has already been evaluated.
        return runFlowchartLinkRows().then((linkRows) => {
          const failed = assertions
            .concat(linkRows)
            .find(([, pass]) => !pass);
          if (failed) {
            logError(
              `Self-check FAILED at assertion: ${failed[0]}. ` +
                "The pinned Mermaid build's parse internals no longer match " +
                "the stage 0 measurements; do not trust adapter output."
            );
            healthy = false;
            return false;
          }

          logInfo(
            "Self-check passed: all accessor and field-shape assertions hold"
          );
          healthy = true;
          return true;
        });
      })
      .catch((error) => {
        logError(
          `Self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        healthy = false;
        return false;
      });

    return selfCheckPromise;
  }

  /**
   * Report the adapter's health.
   * @returns {boolean|null} True or false once the self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isHealthy() {
    return healthy;
  }

  // ---------------------------------------------------------------------
  // Entity relationship surface
  //
  // Deliberately PARALLEL to the flowchart surface above rather than
  // generalised into a dispatcher: its own memo slot, its own self-check
  // state, its own health flag. A shared single-slot memo would let
  // parse(code) and parseEr(code) on the same string hand each other the
  // wrong cached promise, and a shared health flag would let a failed ER
  // check stop flowchart narrating (and vice versa).
  //
  // Field sources are docs/mermaid-er-stage0-measurements-2026-08-02.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the ER surface, matching parse()'s contract: the
  // promise is cached rather than the resolved value.
  let erMemoCode = null;
  let erMemoPromise = null;

  // ER self-check health: null until the check has run, then true or false.
  // Independent of the flowchart `healthy` flag by design.
  let erHealthy = null;

  // Lazy, memoised, first-parseEr trigger — same reasoning as the flowchart
  // self-check above: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let erSelfCheckStarted = false;
  let erSelfCheckPromise = null;

  /**
   * The embedded ER self-check fixture. Two entities, one relationship and
   * one attribute row exercise every db accessor and field shape the ER
   * surface depends on — including the crossed cardinality convention,
   * which is the assertion most worth failing loudly.
   */
  const ER_SELF_CHECK_FIXTURE = [
    "erDiagram",
    "    CUSTOMER ||--o{ ORDER : places",
    "    CUSTOMER {",
    '        string name PK "check"',
    "    }",
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A typed break and an author-escaped one on every ER
  // position whose canvas draws a break: the alias, the relationship role and
  // an attribute comment.
  const ER_BREAK_SELF_CHECK_FIXTURE = [
    "erDiagram",
    '    scBrk["one<br>two"]',
    '    scEsc["three&lt;br&gt;four"]',
    '    scBrk ||--o{ scEsc : "five<br>six"',
    '    scEsc ||--o{ scBrk : "eleven&lt;br&gt;twelve"',
    "    scBrk {",
    '        string name "seven<br>eight"',
    "    }",
    "    scEsc {",
    '        string name "nine&lt;br&gt;ten"',
    "    }",
    // Item 82, markup (5 October 2026): a typed tag, an emphasis run, an
    // author-escaped tag and a tag-only label on the same three positions.
    // Appended AFTER the break rows so relationships[0..1] keep their places.
    '    scTyp["<b>x</b>"]',
    '    scEmp["**y**"]',
    '    scEsm["&lt;b&gt;z&lt;/b&gt;"]',
    '    scNil["<b></b>"]',
    '    scTyp ||--o{ scEmp : "<i>r</i>"',
    '    scEmp ||--o{ scEsm : "**e**"',
    '    scEsm ||--o{ scNil : "&lt;i&gt;q&lt;/i&gt;"',
    '    scNil ||--o{ scTyp : "<u></u>"',
    "    scTyp {",
    '        string a "<b>c</b>"',
    "    }",
    "    scEmp {",
    '        string a "**d**"',
    "    }",
    "    scEsm {",
    '        string a "&lt;b&gt;e&lt;/b&gt;"',
    "    }",
    "    scNil {",
    '        string a "<b></b>"',
    "    }",
  ].join("\n");

  /**
   * Normalise one resolved ER Diagram instance into the adapter's ER shape.
   *
   * THE CROSSED CARDINALITY CONVENTION — resolved here, permanently.
   * Mermaid's relSpec does NOT describe the end you would expect from the
   * field names. Measured over eight relationship probes in
   * docs/mermaid-er-stage0-measurements-2026-08-02.md (M3 E1-E3):
   *
   *   relSpec.cardA records the RIGHT-hand symbol, drawn at entityB's end
   *     — i.e. how many `to` entities exist per `from` entity.
   *   relSpec.cardB records the LEFT-hand symbol, drawn at entityA's end
   *     — i.e. how many `from` entities exist per `to` entity.
   *
   * Anyone reading `cardA` as "entityA's own cardinality" inverts every
   * cardinality sentence in the narration. The normalised field names
   * `toPerFrom` and `fromPerTo` carry the measured meaning instead, so no
   * consumer ever sees cardA or cardB and no future editor can reintroduce
   * the trap downstream. runErSelfCheck() pins the raw convention so a
   * Mermaid upgrade that flips the sides fails loudly.
   *
   * Endpoints in relationships[] hold generated ids (`entity-CUSTOMER-0`),
   * not names (M2c), so both are resolved back to the entities Map key.
   * Attributes are copied into fresh objects with a fresh keys array —
   * db internals are never handed out, matching normaliseFlowchart.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised ER graph
   * @throws {Error} When a relationship endpoint id resolves to no entity
   */
  function normaliseEr(diagram) {
    const db = diagram.db;

    // Map iteration order is source first-mention order (E11), whether the
    // first mention is a relationship or an attribute block.
    const rawEntities = db.getEntities();

    // Endpoint ids are generated; the Map key is the source name (M2c).
    const idToName = new Map();
    rawEntities.forEach((entity, name) => {
      idToName.set(entity.id, name);
    });

    const entities = [];
    rawEntities.forEach((entity, name) => {
      // Item 82, L2 (6 October 2026): an alias, a role or an attribute comment
      // that drew an anchor also carries `segments`, nested on the entity,
      // the attribute or the relationship, so no top-level field is added.
      // The plain text is unchanged by it.
      const aliasRead = readLabelWithLinks(
        typeof entity.alias === "string" && entity.alias !== ""
          ? entity.alias
          : entity.label,
        ER_DRAWN_MARKUP
      );
      entities.push({
        // `name` is the Map key AND the join key relationships resolve to,
        // so it stays RAW — the consumer narrates displayName, and the two
        // carry identical bytes on every measured probe (item 9 § 1).
        name: name,
        // Display name is alias when declared, otherwise label (E5).
        // Item 9, verdict C-FULL: ER labels are drawn in an HTML subtree.
        // Item 82 (2 October 2026): the alias, the relationship role and an
        // attribute comment are positions whose canvas DRAWS a break, so a
        // typed tag reads as a space and an escaped one as written. The
        // attribute `type` and `name` are not author-text positions here.
        // Item 82, markup (5 October 2026): the same three positions also read
        // drawn formatting and emphasis as the text they format
        // (ER_DRAWN_MARKUP), after the break rule and before the decode.
        displayName: aliasRead.label,
        ...(aliasRead.segments ? { segments: aliasRead.segments } : {}),
        // Fresh objects and a fresh keys array — never db internals (E4).
        // Item 19 (8 August 2026): `comment` is the only attribute field that
        // can carry a placeholder, verdict C-FULL. `type` and `name` are
        // C-NONE BY REJECTION — the ATTRIBUTE_WORD lexer refuses U+00B0, so a
        // #word; token (which reaches the parser already as delimiter bytes)
        // rejects the whole diagram and can never be delivered here. `keys` is
        // a fixed enumeration, not author text.
        attributes: (entity.attributes || []).map((attribute) => {
          const commentRead = readLabelWithLinks(
            attribute.comment,
            ER_DRAWN_MARKUP
          );
          return {
            type: attribute.type,
            name: attribute.name,
            keys: Array.isArray(attribute.keys) ? [...attribute.keys] : [],
            comment: commentRead.label,
            ...(commentRead.segments ? { segments: commentRead.segments } : {}),
          };
        }),
      });
    });

    /**
     * Resolve one generated endpoint id back to its entity name.
     * @param {string} id - The generated endpoint id
     * @returns {string} The entities Map key
     */
    function resolveEndpoint(id) {
      const name = idToName.get(id);
      if (name === undefined) {
        throw new Error(
          `ER relationship endpoint id "${id}" does not resolve to any entity`
        );
      }
      return name;
    }

    // Source order (E11); duplicates between the same pair are preserved
    // as distinct relationships (E9).
    const relationships = db.getRelationships().map((relationship) => {
      const relSpec = relationship.relSpec || {};
      const roleRead = readLabelWithLinks(relationship.roleA, ER_DRAWN_MARKUP);
      return {
        from: resolveEndpoint(relationship.entityA),
        to: resolveEndpoint(relationship.entityB),
        // May be "" — an empty quoted label parses (E6). Item 9, C-FULL.
        role: roleRead.label,
        toPerFrom: relSpec.cardA,
        fromPerTo: relSpec.cardB,
        relType: relSpec.relType,
        ...(roleRead.segments ? { segments: roleRead.segments } : {}),
      };
    });

    return {
      type: "er",
      direction: db.getDirection(),
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      entities: entities,
      relationships: relationships,
    };
  }

  /**
   * Parse Mermaid entity relationship code into the normalised ER shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 E12), so awaiting this promise is
   * the single error path. An unresolvable relationship endpoint rejects
   * the same way, reaching the consumer's await rather than yielding a
   * half-built graph.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseEr's read
   * of it run in one slot of the adapter-wide queue, so no other adapter
   * parse can clear Mermaid's shared accessible-title store between them.
   * Before that queue existed, this surface's own self-check parse was the
   * racer, and the first parseEr of every page delivered accTitle "".
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised ER graph
   */
  function parseEr(code) {
    // Lazy ER self-check trigger. The flag is set before the check parses
    // its fixture, matching the flowchart surface's ordering.
    if (!erSelfCheckStarted) {
      runErSelfCheck();
    }

    if (code === erMemoCode && erMemoPromise) {
      logDebug("Returning memoised ER parse for identical code string");
      return erMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`ER parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `ER parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseEr(diagram);
          logDebug(
            `ER parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `ER parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    erMemoCode = code;
    erMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded ER fixture and assert the db accessor names and
   * field shapes the ER surface depends on. Resolves true on a clean pass.
   * On any failure it logs one ERROR naming the failed assertion, marks the
   * ER surface unhealthy, and resolves false. Never throws and never
   * rejects, and never reads or writes the flowchart health flag.
   *
   * Memoised: the check runs once, and later calls return the same settled
   * promise.
   *
   * Unlike the flowchart check, this one resolves the Diagram itself rather
   * than going through parseEr(): its assertions are deliberately about the
   * RAW db internals — the entities Map, the entity `id` fields, and
   * relSpec.cardA/cardB — which the normalised shape exists to hide. That
   * is the point of the check: pin the crossed convention at source, so a
   * Mermaid upgrade that flips the sides fails here instead of silently
   * inverting every cardinality sentence downstream.
   *
   * @returns {Promise<boolean>} Resolves to the ER health verdict
   */
  function runErSelfCheck() {
    if (erSelfCheckPromise) {
      return erSelfCheckPromise;
    }
    erSelfCheckStarted = true;

    // The fixture parse goes through the ADAPTER-WIDE QUEUE, and every raw
    // db read happens INSIDE the queued run: `run` resolves to the completed
    // assertion list, never to a diagram for a later .then to read. That is
    // the queue's invariant made structural — see its declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            ER_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          const entities = db.getEntities();
          const isMap = entities instanceof Map;
          const entityNames = isMap ? [...entities.keys()] : [];
          const customer = isMap ? entities.get("CUSTOMER") : undefined;
          const order = isMap ? entities.get("ORDER") : undefined;
          const attribute =
            customer && Array.isArray(customer.attributes)
              ? customer.attributes[0]
              : undefined;

          const relationships = db.getRelationships();
          const relationship = Array.isArray(relationships)
            ? relationships[0]
            : undefined;
          const relSpec = relationship ? relationship.relSpec : undefined;

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          const baseAssertions = [
            [
              "entities container is a Map of size 2",
              isMap && entities.size === 2,
            ],
            [
              "entity order CUSTOMER, ORDER",
              entityNames.join(",") === "CUSTOMER,ORDER",
            ],
            [
              "CUSTOMER first attribute has the four measured fields",
              attribute &&
                attribute.type === "string" &&
                attribute.name === "name" &&
                Array.isArray(attribute.keys) &&
                attribute.keys.length === 1 &&
                attribute.keys[0] === "PK" &&
                attribute.comment === "check",
            ],
            [
              "both relationship endpoints resolve through entity id fields",
              relationship &&
                customer &&
                order &&
                relationship.entityA === customer.id &&
                relationship.entityB === order.id,
            ],
            [
              "crossed cardinality convention holds (cardA right, cardB left)",
              relSpec &&
                relSpec.cardA === "ZERO_OR_MORE" &&
                relSpec.cardB === "ONLY_ONE" &&
                relSpec.relType === "IDENTIFYING",
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because the db is a singleton and this parse
          // replaces its payload. Delivered through normaliseEr itself, so
          // the rows test the transform on the path a consumer reads.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(ER_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakGraph = normaliseEr(breakDiagram);
              const byName = (name) =>
                breakGraph.entities.find((e) => e.name === name);
              const typed = byName("scBrk");
              const escaped = byName("scEsc");
              const typedRole = breakGraph.relationships[0];
              const escapedRole = breakGraph.relationships[1];
              return baseAssertions.concat([
                [
                  "a typed break reads as one space on an alias, a " +
                    "relationship role and an attribute comment (item 82)",
                  !!typed &&
                    typed.displayName === "one two" &&
                    !!typedRole &&
                    typedRole.role === "five six" &&
                    typed.attributes.length === 1 &&
                    typed.attributes[0].comment === "seven eight",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "an alias, a role and an attribute comment (item 82)",
                  !!escaped &&
                    escaped.displayName === "three<br>four" &&
                    !!escapedRole &&
                    escapedRole.role === "eleven<br>twelve" &&
                    escaped.attributes.length === 1 &&
                    escaped.attributes[0].comment === "nine<br>ten",
                ],
                [
                  "a typed formatting tag reads as its text on an alias, a " +
                    "role and an attribute comment (item 82)",
                  !!byName("scTyp") &&
                    byName("scTyp").displayName === "x" &&
                    !!breakGraph.relationships[2] &&
                    breakGraph.relationships[2].role === "r" &&
                    byName("scTyp").attributes.length === 1 &&
                    byName("scTyp").attributes[0].comment === "c",
                ],
                [
                  "an author-escaped formatting tag is kept as the " +
                    "characters <b> on an alias, a role and a comment (item 82)",
                  !!byName("scEsm") &&
                    byName("scEsm").displayName === "<b>z</b>" &&
                    !!breakGraph.relationships[4] &&
                    breakGraph.relationships[4].role === "<i>q</i>" &&
                    byName("scEsm").attributes.length === 1 &&
                    byName("scEsm").attributes[0].comment === "<b>e</b>",
                ],
                [
                  "a tag-only label is delivered empty on an alias, a role " +
                    "and an attribute comment (item 82)",
                  !!byName("scNil") &&
                    byName("scNil").displayName === "" &&
                    !!breakGraph.relationships[5] &&
                    breakGraph.relationships[5].role === "" &&
                    byName("scNil").attributes.length === 1 &&
                    byName("scNil").attributes[0].comment === "",
                ],
                [
                  "markdown emphasis reads as its text on an alias, a role " +
                    "and an attribute comment (item 82)",
                  !!byName("scEmp") &&
                    byName("scEmp").displayName === "y" &&
                    !!breakGraph.relationships[3] &&
                    breakGraph.relationships[3].role === "e" &&
                    byName("scEmp").attributes.length === 1 &&
                    byName("scEmp").attributes[0].comment === "d",
                ],
              ]);
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    erSelfCheckPromise = queued
      // Item 82, L2: the link rows read a third fixture, parsed after the
      // others, so every predicate above has already been evaluated.
      .then((assertions) =>
        runErLinkRows().then((linkRows) => assertions.concat(linkRows))
      )
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `ER self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's ER parse internals no longer match " +
              "the stage 0 measurements; do not trust ER adapter output."
          );
          erHealthy = false;
          return false;
        }

        logInfo(
          "ER self-check passed: all accessor and field-shape assertions hold"
        );
        erHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `ER self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        erHealthy = false;
        return false;
      });

    return erSelfCheckPromise;
  }

  // Item 82, L2 (6 October 2026): the ER link rows. A third source, parsed in
  // its own queue slot after the two above, so every existing fixture and
  // every count asserted against it stays as it was. Each link form is the
  // measurement's (docs/mermaid-item-82-l2-measure-2026-10-05.md section 1);
  // the alias, the role and an attribute comment are the three positions that
  // can carry a link, and each is read here.
  const ER_LINK_SELF_CHECK_FIXTURE = [
    "erDiagram",
    "    L1[\"Zq <a href='https://example.org/a b?x=1&y=2'>text</a>\"] {",
    "        string c1 \"<a href='https://example.org/c'>comment link</a> here\"",
    "    }",
    "    L2[\"<a href='https://example.org'>one</a> and <a href='https://example.net'>two</a>\"]",
    "    L3[\"<a href='https://example.org'><b>bold link</b></a>\"]",
    "    L4[\"<a href='https://example.org'>dup</a> and dup\"]",
    "    L5[\"<a href='https://example.org/a&quot;b'>quote in href</a>\"]",
    "    L6[\"<a href='/relative'>r</a> <a href='//example.org/p'>p</a> <a href='HTTPS://EXAMPLE.ORG/X'>upper</a>\"]",
    "    L7[\"<a href='javascript:alert(1)'>j</a> <a href='mailto:a@example.org'>m</a> <a>none</a> <a href='https://example.org'></a>.\"]",
    "    L1 ||--o{ L2 : \"<a href='https://example.org/role'>role link</a>\"",
  ].join("\n");

  /**
   * The link rows of the ER self-check, over the delivered link fixture.
   * @param {Object} graph - The normalised ER link fixture
   * @returns {Array} Assertion rows
   */
  function erLinkAssertions(graph) {
    const same = (actual, expected) =>
      JSON.stringify(actual) === JSON.stringify(expected);
    const entity = (name) => graph.entities.find((e) => e.name === name);
    const attributes = graph.entities.flatMap((e) => e.attributes);
    const segmented = []
      .concat(graph.entities, attributes, graph.relationships)
      .filter((element) => element.segments);
    return [
      [
        "link: an alias's link, its & decoded once and its space kept (m6)",
        !!entity("L1") &&
          same(entity("L1").segments, [
            { text: "Zq " },
            { text: "text", href: "https://example.org/a b?x=1&y=2" },
          ]),
      ],
      [
        "link: an attribute comment's link",
        !!attributes[0] &&
          attributes[0].comment === "comment link here" &&
          same(attributes[0].segments, [
            { text: "comment link", href: "https://example.org/c" },
            { text: " here" },
          ]),
      ],
      [
        "link: a relationship role's link",
        !!graph.relationships[0] &&
          graph.relationships[0].role === "role link" &&
          same(graph.relationships[0].segments, [
            { text: "role link", href: "https://example.org/role" },
          ]),
      ],
      [
        "link: a nested bold link reads as 'bold link' (l2)",
        !!entity("L3") &&
          entity("L3").displayName === "bold link" &&
          same(entity("L3").segments, [
            { text: "bold link", href: "https://example.org" },
          ]),
      ],
      [
        "link: two links in one label, in order (l1)",
        !!entity("L2") &&
          same(entity("L2").segments, [
            { text: "one", href: "https://example.org" },
            { text: " and " },
            { text: "two", href: "https://example.net" },
          ]),
      ],
      [
        "link: the first of two identical words is the linked one (l3)",
        !!entity("L4") &&
          same(entity("L4").segments, [
            { text: "dup", href: "https://example.org" },
            { text: " and dup" },
          ]),
      ],
      [
        "link: the quote entity in an href is decoded once (l7)",
        !!entity("L5") &&
          same(entity("L5").segments, [
            { text: "quote in href", href: 'https://example.org/a"b' },
          ]),
      ],
      [
        "link: relative, protocol-relative and upper-case-scheme hrefs are " +
          "admitted as written (m9, l6, l4)",
        !!entity("L6") &&
          same(entity("L6").segments, [
            { text: "r", href: "/relative" },
            { text: " " },
            { text: "p", href: "//example.org/p" },
            { text: " " },
            { text: "upper", href: "HTTPS://EXAMPLE.ORG/X" },
          ]),
      ],
      [
        "link: javascript:, mailto:, no href and an empty link are plain " +
          "text, and an empty link leaves no text (m7, m8, l8, m10)",
        !!entity("L7") &&
          entity("L7").displayName === "j m none ." &&
          same(entity("L7").segments, [{ text: "j m none ." }]),
      ],
      [
        "link: the segment texts join to the delivered label, everywhere",
        segmented.length === 9 &&
          segmented.every(
            (element) =>
              element.segments.map((s) => s.text).join("") ===
              (element.displayName !== undefined
                ? element.displayName
                : element.comment !== undefined
                  ? element.comment
                  : element.role)
          ),
      ],
    ];
  }

  /**
   * Parse the ER link fixture in its own queue slot and return its rows. A
   * rejection is one failing row, not a throw.
   * @returns {Promise<Array>} Assertion rows
   */
  function runErLinkRows() {
    const run = () =>
      window.mermaid.mermaidAPI
        .getDiagramFromText(ER_LINK_SELF_CHECK_FIXTURE)
        .then((diagram) => erLinkAssertions(normaliseEr(diagram)));
    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued.catch((error) => [
      [`ER link fixture parses (rejected: ${error && error.message})`, false],
    ]);
  }

  /**
   * Report the ER surface's health, independently of the flowchart surface.
   * @returns {boolean|null} True or false once the ER self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isErHealthy() {
    return erHealthy;
  }

  // ---------------------------------------------------------------------
  // Class diagram surface
  //
  // Parallel to the flowchart and ER surfaces above, for the same reasons:
  // its own memo slot, its own self-check state, its own health flag. None
  // of the three surfaces reads or writes another's state.
  //
  // Field sources are docs/mermaid-class-stage0-measurements-2026-08-02.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the class surface, matching parse()'s contract.
  let classMemoCode = null;
  let classMemoPromise = null;

  // Class self-check health: null until the check has run, then true or
  // false. Independent of the flowchart and ER flags by design.
  let classHealthy = null;

  // Lazy, memoised, first-parseClass trigger — same reasoning as the other
  // two self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let classSelfCheckStarted = false;
  let classSelfCheckPromise = null;

  /**
   * The embedded class self-check fixture. Four classes, one member and two
   * relations pin the raw internals the class surface depends on — above
   * all that AGGREGATION is the number 0 and the marker sits at the end
   * where the glyph is drawn (stage 0 C2, C3).
   */
  const CLASS_SELF_CHECK_FIXTURE = [
    "classDiagram",
    "    Animal <|-- Duck",
    "    Animal : +int age",
    "    Car o-- Wheel",
    // Two notes, one unattached and one attached, so the self-check can pin
    // the notes container and its declaration order (11.17.2 made it a Map).
    '    note "first note"',
    '    note for Animal "second note"',
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A typed break and an author-escaped one on every class
  // position whose canvas draws a break. The relation label has no escaped
  // twin: the relation lexer rejects an entity in a quoted label outright.
  const CLASS_BREAK_SELF_CHECK_FIXTURE = [
    "classDiagram",
    '    class scBrk["one<br>two"]',
    '    class scEsc["three&lt;br&gt;four"]',
    '    scBrk --> scEsc : "five<br>six"',
    '    note for scBrk "seven<br>eight"',
    '    note for scEsc "nine&lt;br&gt;ten"',
    // Item 82, markup (5 October 2026): a typed tag, an emphasis run, an
    // author-escaped tag and a tag-only label on the same three positions.
    // Appended AFTER the break rows so relationships[0] and notes[0..1] keep
    // their places.
    '    class scTyp["<b>x</b>"]',
    '    class scEmp["**y**"]',
    '    class scEsm["&lt;b&gt;z&lt;/b&gt;"]',
    '    class scNil["<b></b>"]',
    '    scTyp --> scEmp : "<i>r</i>"',
    '    scEmp --> scEsm : "**e**"',
    '    scEsm --> scNil : "<u></u>"',
    '    note for scTyp "<b>c</b>"',
    '    note for scEmp "**d**"',
    '    note for scEsm "&lt;b&gt;e&lt;/b&gt;"',
    '    note for scNil "<b></b>"',
  ].join("\n");

  // Item 82, L2 (6 October 2026): the class link rows. A third source, parsed
  // in its own queue slot after the two above, so every existing fixture and
  // every count asserted against it stays as it was. Each link form is the
  // measurement's (docs/mermaid-item-82-l2-measure-2026-10-05.md section 1);
  // the class label and the note are the two positions that can carry a link
  // (the relation label cannot: the parser rejects every authorable anchor).
  const CLASS_LINK_SELF_CHECK_FIXTURE = [
    "classDiagram",
    "    class L1[\"Zq <a href='https://example.org/a b?x=1&y=2'>text</a>\"]",
    "    class L2[\"<a href='https://example.org'>one</a> and <a href='https://example.net'>two</a>\"]",
    "    class L3[\"<a href='https://example.org'><b>bold link</b></a>\"]",
    "    class L4[\"<a href='https://example.org'>dup</a> and dup\"]",
    "    class L5[\"<a href='https://example.org/a&quot;b'>quote in href</a>\"]",
    "    class L6[\"<a href='/relative'>r</a> <a href='//example.org/p'>p</a> <a href='HTTPS://EXAMPLE.ORG/X'>upper</a>\"]",
    "    class L7[\"<a href='javascript:alert(1)'>j</a> <a href='mailto:a@example.org'>m</a> <a>none</a> <a href='https://example.org'></a>.\"]",
    '    L1 --> L2 : "Zq <a href="/relative">go</a> and <a href="//example.org/p">there</a>"',
    '    L2 --> L3 : "<a href="/only"></a>plain"',
    "    note for L1 \"Zq <a href='https://example.org/n'>note link</a> here\"",
    "    note \"<a href='https://example.org/f'>free</a>\"",
  ].join("\n");

  /**
   * The link rows of the class self-check, over the delivered link fixture.
   * @param {Object} graph - The normalised class link fixture
   * @returns {Array} Assertion rows
   */
  function classLinkAssertions(graph) {
    const same = (actual, expected) =>
      JSON.stringify(actual) === JSON.stringify(expected);
    const cls = (name) => graph.classes.find((c) => c.name === name);
    const segmented = []
      .concat(graph.classes, graph.notes, graph.relationships)
      .filter((element) => element.segments);
    return [
      [
        "link: a relation label's relative and protocol-relative links, " +
          "read as written (m9, l6)",
        !!graph.relationships[0] &&
          graph.relationships[0].label === "Zq go and there" &&
          same(graph.relationships[0].segments, [
            { text: "Zq " },
            { text: "go", href: "/relative" },
            { text: " and " },
            { text: "there", href: "//example.org/p" },
          ]),
      ],
      [
        "link: a relation label whose link has no text delivers the plain " +
          "text and no link",
        !!graph.relationships[1] &&
          graph.relationships[1].label === "plain" &&
          same(graph.relationships[1].segments, [{ text: "plain" }]),
      ],
      [
        "link: a class label's link, its & decoded once and its space kept (m6)",
        !!cls("L1") &&
          same(cls("L1").segments, [
            { text: "Zq " },
            { text: "text", href: "https://example.org/a b?x=1&y=2" },
          ]),
      ],
      [
        "link: a note's link (m6 form on a note)",
        !!graph.notes[0] &&
          graph.notes[0].text === "Zq note link here" &&
          same(graph.notes[0].segments, [
            { text: "Zq " },
            { text: "note link", href: "https://example.org/n" },
            { text: " here" },
          ]),
      ],
      [
        "link: a free note's link",
        !!graph.notes[1] &&
          same(graph.notes[1].segments, [
            { text: "free", href: "https://example.org/f" },
          ]),
      ],
      [
        "link: a nested bold link reads as 'bold link' (l2)",
        !!cls("L3") &&
          cls("L3").displayName === "bold link" &&
          same(cls("L3").segments, [
            { text: "bold link", href: "https://example.org" },
          ]),
      ],
      [
        "link: two links in one label, in order (l1)",
        !!cls("L2") &&
          same(cls("L2").segments, [
            { text: "one", href: "https://example.org" },
            { text: " and " },
            { text: "two", href: "https://example.net" },
          ]),
      ],
      [
        "link: the first of two identical words is the linked one (l3)",
        !!cls("L4") &&
          same(cls("L4").segments, [
            { text: "dup", href: "https://example.org" },
            { text: " and dup" },
          ]),
      ],
      [
        "link: the quote entity in an href is decoded once (l7)",
        !!cls("L5") &&
          same(cls("L5").segments, [
            { text: "quote in href", href: 'https://example.org/a"b' },
          ]),
      ],
      [
        "link: relative, protocol-relative and upper-case-scheme hrefs are " +
          "admitted as written (m9, l6, l4)",
        !!cls("L6") &&
          same(cls("L6").segments, [
            { text: "r", href: "/relative" },
            { text: " " },
            { text: "p", href: "//example.org/p" },
            { text: " " },
            { text: "upper", href: "HTTPS://EXAMPLE.ORG/X" },
          ]),
      ],
      [
        "link: javascript:, mailto:, no href and an empty link are plain " +
          "text, and an empty link leaves no text (m7, m8, l8, m10)",
        !!cls("L7") &&
          cls("L7").displayName === "j m none ." &&
          same(cls("L7").segments, [{ text: "j m none ." }]),
      ],
      [
        "link: the segment texts join to the delivered label, everywhere",
        segmented.length === 11 &&
          segmented.every(
            (element) =>
              element.segments.map((s) => s.text).join("") ===
              (element.displayName !== undefined
                ? element.displayName
                : element.text !== undefined
                  ? element.text
                  : element.label)
          ),
      ],
    ];
  }

  /**
   * Parse the class link fixture in its own queue slot and return its rows. A
   * rejection is one failing row, not a throw.
   * @returns {Promise<Array>} Assertion rows
   */
  function runClassLinkRows() {
    // The relation-label control: the same shape with an https address is
    // rejected at parse (measurement section 1), and with a relative address
    // is accepted, so a rejection here is proved to be about the address and
    // not about the source.
    const rejects = (source) =>
      window.mermaid.mermaidAPI.getDiagramFromText(source).then(
        () => false,
        () => true
      );
    const run = () =>
      window.mermaid.mermaidAPI
        .getDiagramFromText(CLASS_LINK_SELF_CHECK_FIXTURE)
        .then((diagram) => classLinkAssertions(normaliseClass(diagram)))
        .then((rows) =>
          Promise.all([
            rejects('classDiagram\n    A --> B : "<a href="https://example.org">x</a>"'),
            rejects('classDiagram\n    A --> B : "<a href="/relative">x</a>"'),
          ]).then(([httpsRejected, relativeRejected]) =>
            rows.concat([
              [
                "link: an https link in a relation label is rejected at parse " +
                  "(positive control: the relative form of the same source is not)",
                httpsRejected === true && relativeRejected === false,
              ],
            ])
          )
        );
    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued.catch((error) => [
      [`class link fixture parses (rejected: ${error && error.message})`, false],
    ]);
  }

  /**
   * Decode one raw class relation into { kind, markerAt, dashed }.
   *
   * TWO DECODE TRAPS, both measured (stage 0 M2a, C3) — every comparison
   * below is numeric and explicit, never truthiness:
   *   - AGGREGATION is the number 0, which is FALSY, so `if (type1)` drops
   *     every aggregation;
   *   - an absent marker is the STRING "none", which is TRUTHY, so the same
   *     test also fires on ends with no marker at all. Truthiness is wrong
   *     in both directions at once.
   *
   * The marker code sits at the end where the glyph is drawn (C2): in
   * `Animal <|-- Duck` the 1 lands on Animal, the parent. lineType is the
   * only field separating association from dependency and inheritance from
   * realisation (C3) — the codes alone cannot.
   *
   * Unmeasured input — an unknown code, or two DIFFERENT non-"none" codes
   * at the two ends — degrades honestly to a plain link with one WARN,
   * never a throw.
   *
   * @param {Object} relation - The raw relation object ({type1, type2, lineType})
   * @returns {Object} { kind, markerAt, dashed }
   */
  function decodeClassRelation(relation) {
    const type1 = relation.type1;
    const type2 = relation.type2;
    const dashed = relation.lineType === 1;

    const markerAtFrom = type1 !== "none";
    const markerAtTo = type2 !== "none";

    if (markerAtFrom && markerAtTo && type1 !== type2) {
      logWarn(
        `Class relation carries two different marker codes (${type1}, ${type2}); ` +
          "degrading to a plain link"
      );
      return { kind: "link", markerAt: "both", dashed: dashed };
    }

    if (!markerAtFrom && !markerAtTo) {
      return { kind: "link", markerAt: "none", dashed: dashed };
    }

    const markerAt = markerAtFrom && markerAtTo ? "both" : markerAtFrom ? "from" : "to";
    const code = markerAtFrom ? type1 : type2;

    let kind;
    if (code === 1) {
      kind = dashed ? "realisation" : "inheritance";
    } else if (code === 2) {
      kind = "composition";
    } else if (code === 0) {
      kind = "aggregation";
    } else if (code === 3) {
      kind = dashed ? "dependency" : "association";
    } else if (code === 4) {
      kind = "lollipop";
    } else {
      logWarn(
        `Class relation carries an unmeasured marker code (${code}); ` +
          "degrading to a plain link"
      );
      return { kind: "link", markerAt: "both", dashed: dashed };
    }

    return { kind: kind, markerAt: markerAt, dashed: dashed };
  }

  /**
   * Turn the class db's notes container into an Array.
   *
   * Mermaid 11.6.0 returns getNotes() as an Array; 11.17.2 returns a Map
   * keyed "note0", "note1" … whose values() run in declaration order (both
   * measured, register item 99 session 3). Any other shape THROWS: an empty
   * list would read as a diagram with no notes and every note would vanish
   * from the description without a sound.
   *
   * @param {*} notes - The value db.getNotes() returned
   * @returns {Array} The note objects, in declaration order
   */
  function classNotesToArray(notes) {
    if (Array.isArray(notes)) {
      return notes;
    }
    if (notes instanceof Map) {
      return Array.from(notes.values());
    }
    const shape = notes === null ? "null" : typeof notes;
    logError(`Class db getNotes() returned an unreadable shape (${shape})`);
    throw new Error(
      `Class db getNotes() returned neither an Array nor a Map (${shape})`
    );
  }

  /**
   * Normalise one resolved class Diagram instance into the adapter's class
   * shape.
   *
   * ENDPOINT RESOLUTION — deliberately DIFFERENT from the ER surface: no
   * throw when an endpoint is absent from the classes list. A lollipop
   * relation legitimately synthesises an id (`interface0`) that appears in
   * no class list, and drops the source's class name from getClasses()
   * entirely (stage 0 C3). `from` and `to` therefore stay raw ids and
   * consumers guard their lookups. Do not "fix" this into the ER surface's
   * throwing behaviour — that would reject every lollipop diagram.
   *
   * Members and methods are copied field by field from the ClassMember
   * instances, and NEVER from their `text` field, which carries an escaped
   * visibility prefix and HTML-escaped generics (C5, C6).
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised class graph
   */
  function normaliseClass(diagram) {
    const db = diagram.db;

    // Map iteration order is source first-mention order (C13), whether the
    // first mention is a relation, a member block or a namespace body.
    const classes = [];
    db.getClasses().forEach((cls, name) => {
      // Item 82, L2 (6 October 2026): a label that drew an anchor also carries
      // `segments`, nested on the class, so no top-level field is added. The
      // plain displayName is unchanged by it.
      const labelRead = readLabelWithLinks(cls.label, CLASS_DRAWN_MARKUP);
      classes.push({
        // `name` is the Map key, and relations reference it through their
        // own raw id1/id2, so it stays RAW. Measured: it holds the class
        // IDENTIFIER, never the bracket label, so it cannot carry a
        // placeholder (item 9 § 1). The consumer narrates displayName.
        name: name,
        // Always populated: equals the id when no bracket label given (C8).
        // Item 9, verdict C-FULL: class labels are drawn in an HTML subtree.
        // Item 82 (2 October 2026): the label, the relation label and a note
        // are positions whose canvas DRAWS a break, so a typed tag reads as a
        // space and an escaped one as written. Members, methods, generics,
        // annotations and multiplicities were not probed and keep the plain
        // decode.
        // Item 82, markup (5 October 2026): the same three positions also read
        // drawn formatting and emphasis as the text they format
        // (CLASS_DRAWN_MARKUP), after the break rule and before the decode.
        displayName: labelRead.label,
        ...(labelRead.segments ? { segments: labelRead.segments } : {}),
        // The generic parameter lives in its own field (C6): Shelf~Item~
        // gives type "Item"; "" when the class is not generic.
        // Item 19, verdict C-FULL (8 August 2026) for both.
        genericType: decodeAuthorText(cls.type || ""),
        annotations: (Array.isArray(cls.annotations) ? cls.annotations : []).map(
          (annotation) => decodeAuthorText(annotation)
        ),
        // A namespaced class carries `parent`; others lack the key (C9).
        namespace: typeof cls.parent === "string" ? cls.parent : "",
        members: (cls.members || []).map((member) => ({
          visibility: member.visibility,
          classifier: member.classifier,
          // Item 9, C-FULL. The renderer prefixes the visibility glyph
          // itself, so this field never carries it.
          declaration: decodeAuthorText(member.id),
        })),
        // Item 19, verdict C-FULL (8 August 2026) for all three text fields.
        // The renderer prefixes the visibility glyph and the signature
        // punctuation itself, so none of these carries it.
        methods: (cls.methods || []).map((method) => ({
          visibility: method.visibility,
          classifier: method.classifier,
          name: decodeAuthorText(method.id),
          parameters: decodeAuthorText(method.parameters),
          returnType: decodeAuthorText(method.returnType),
        })),
      });
    });

    // Source order (C13); duplicates between the same pair are preserved
    // as distinct relations (C11).
    const relationships = db.getRelations().map((relation) => {
      const decoded = decodeClassRelation(relation.relation || {});

      // `title` is an ABSENT KEY when the relation has no label — never ""
      // or null (M2c) — so presence is tested with `in`, not truthiness. A
      // quoted label keeps its quote characters (C4); one symmetric
      // surrounding pair is stripped here.
      let label = "";
      if ("title" in relation) {
        label = relation.title;
        if (
          label.length >= 2 &&
          label.charAt(0) === '"' &&
          label.charAt(label.length - 1) === '"'
        ) {
          label = label.slice(1, -1);
        }
      }

      const labelRead = readLabelWithLinks(label, CLASS_DRAWN_MARKUP);

      return {
        from: relation.id1,
        to: relation.id2,
        kind: decoded.kind,
        markerAt: decoded.markerAt,
        // Carried on every relationship for honesty, even where the kind
        // (realisation, dependency) already implies it.
        dashed: decoded.dashed,
        // Item 19 (8 August 2026), verdict C-FULL. C-PH and C-FULL are
        // PROVABLY IDENTICAL on this field: the two differ only on an intact
        // author-typed `&...;`, and the relation-label lexer rejects one
        // outright — measured on both the bare and the quoted form. C-FULL is
        // chosen for consistency with every other class field, not because the
        // measurement separated them.
        label: labelRead.label,
        // Item 82, L2 (6 October 2026, enactment 3): the relation label draws a
        // working link for the relative (/x) and protocol-relative (//x) forms,
        // the only two the parser accepts there, so it carries `segments` like
        // the class label and the note.
        ...(labelRead.segments ? { segments: labelRead.segments } : {}),
        // An absent multiplicity is the string "none" (C4). Item 19, C-FULL.
        // These two are also the lookup keys into the consumer's
        // MULTIPLICITY_PHRASES table, and the join cannot break: the transform
        // changes only a string carrying a #...; token or the delimiter bytes,
        // and no key in that table contains either.
        multiplicityFrom: decodeAuthorText(
          relation.relationTitle1 === "none" ? "" : relation.relationTitle1
        ),
        multiplicityTo: decodeAuthorText(
          relation.relationTitle2 === "none" ? "" : relation.relationTitle2
        ),
      };
    });

    const namespaces = [];
    db.getNamespaces().forEach((namespace, name) => {
      namespaces.push({
        name: name,
        classNames: [...namespace.classes.keys()],
      });
    });

    // A note's attachment may name a class that does not exist (C10); it
    // is passed through and the consumer guards the lookup.
    // Item 19, verdict C-FULL (8 August 2026) for `text`. `attachedTo` stays
    // RAW: it is a join key the consumer looks up in a Map built on the raw
    // classes[].name.
    // Item 82, L2 (6 October 2026): a note that drew an anchor also carries
    // `segments`. The relation label is read for links too (enactment 3): the
    // parser rejects every authorable anchor there but the relative and
    // protocol-relative forms, and those are drawn as working links.
    const notes = classNotesToArray(db.getNotes()).map((note) => {
      const read = readLabelWithLinks(note.text, CLASS_DRAWN_MARKUP);
      return {
        text: read.label,
        attachedTo: typeof note.class === "string" ? note.class : "",
        ...(read.segments ? { segments: read.segments } : {}),
      };
    });

    return {
      type: "class",
      direction: db.getDirection(),
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      classes: classes,
      relationships: relationships,
      namespaces: namespaces,
      notes: notes,
    };
  }

  /**
   * Parse Mermaid class diagram code into the normalised class shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 C14), so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseClass's
   * read of it run in one slot of the adapter-wide queue, so no other
   * adapter parse can clear Mermaid's shared accessible-title store between
   * them. Before that queue existed, this surface's own self-check parse
   * was the racer, and the first parseClass of every page delivered
   * accTitle "".
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised class graph
   */
  function parseClass(code) {
    // Lazy class self-check trigger, matching the other surfaces' ordering.
    if (!classSelfCheckStarted) {
      runClassSelfCheck();
    }

    if (code === classMemoCode && classMemoPromise) {
      logDebug("Returning memoised class parse for identical code string");
      return classMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Class parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Class parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseClass(diagram);
          logDebug(
            `Class parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Class parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    classMemoCode = code;
    classMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded class fixture and assert the db accessor names and
   * field shapes the class surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the class surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the flowchart or ER flags.
   *
   * Like the ER check and unlike the flowchart one, this resolves the
   * Diagram itself rather than going through parseClass(): its assertions
   * are deliberately about the RAW db internals the normalised shape exists
   * to hide — above all that AGGREGATION is the number 0 and that the
   * marker code sits at the end where the glyph is drawn. A Mermaid upgrade
   * that changes either fails here instead of silently mislabelling every
   * relation downstream.
   *
   * @returns {Promise<boolean>} Resolves to the class health verdict
   */
  function runClassSelfCheck() {
    if (classSelfCheckPromise) {
      return classSelfCheckPromise;
    }
    classSelfCheckStarted = true;

    // The fixture parse goes through the ADAPTER-WIDE QUEUE, and every raw
    // db read happens INSIDE the queued run: `run` resolves to the completed
    // assertion list, never to a diagram for a later .then to read. That is
    // the queue's invariant made structural — see its declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            CLASS_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          const classes = db.getClasses();
          const isMap = classes instanceof Map;
          const classNames = isMap ? [...classes.keys()] : [];
          const animal = isMap ? classes.get("Animal") : undefined;
          const member =
            animal && Array.isArray(animal.members)
              ? animal.members[0]
              : undefined;

          const relations = db.getRelations();
          const first = Array.isArray(relations) ? relations[0] : undefined;
          const second = Array.isArray(relations) ? relations[1] : undefined;

          // Notes go through the SAME helper normaliseClass uses. An
          // unreadable shape makes the helper throw; that is caught here so
          // the assertion below reads false instead of the check falling
          // into the generic "parse resolves" branch.
          let notes = null;
          try {
            notes = classNotesToArray(db.getNotes());
          } catch (error) {
            notes = null;
          }

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          const baseAssertions = [
            [
              "classes container is a Map of size 4 in order Animal, Duck, Car, Wheel",
              isMap && classNames.join(",") === "Animal,Duck,Car,Wheel",
            ],
            [
              "Animal's first member carries the four measured fields",
              member &&
                member.memberType === "attribute" &&
                member.visibility === "+" &&
                member.classifier === "" &&
                member.id === "int age",
            ],
            [
              "inheritance relation raw shape (marker 1 at Animal's end, lineType 0)",
              first &&
                first.id1 === "Animal" &&
                first.id2 === "Duck" &&
                first.relation &&
                first.relation.type1 === 1 &&
                first.relation.type2 === "none" &&
                first.relation.lineType === 0,
            ],
            [
              "AGGREGATION is 0 at the glyph end (Car o-- Wheel)",
              second &&
                second.id1 === "Car" &&
                second.relation &&
                second.relation.type1 === 0,
            ],
            [
              "title is not an own key of an unlabelled relation",
              first &&
                second &&
                !Object.prototype.hasOwnProperty.call(first, "title") &&
                !Object.prototype.hasOwnProperty.call(second, "title"),
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
            [
              "notes container is readable as two notes in declaration order (first note, then second note attached to Animal)",
              Array.isArray(notes) &&
                notes.length === 2 &&
                notes[0].text === "first note" &&
                typeof notes[0].class !== "string" &&
                notes[1].text === "second note" &&
                notes[1].class === "Animal",
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because the db is a singleton and this parse
          // replaces its payload. Delivered through normaliseClass itself, so
          // the rows test the transform on the path a consumer reads.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(CLASS_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakGraph = normaliseClass(breakDiagram);
              const byName = (name) =>
                breakGraph.classes.find((c) => c.name === name);
              const typed = byName("scBrk");
              const escaped = byName("scEsc");
              const relation = breakGraph.relationships[0];
              const typedNote = breakGraph.notes[0];
              const escapedNote = breakGraph.notes[1];
              return baseAssertions.concat([
                [
                  "a typed break reads as one space on the class label, the " +
                    "relation label and a note (item 82)",
                  !!typed &&
                    typed.displayName === "one two" &&
                    !!relation &&
                    relation.label === "five six" &&
                    !!typedNote &&
                    typedNote.text === "seven eight",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "the class label and a note (item 82)",
                  !!escaped &&
                    escaped.displayName === "three<br>four" &&
                    !!escapedNote &&
                    escapedNote.text === "nine<br>ten",
                ],
                [
                  "a typed formatting tag reads as its text on the class " +
                    "label, the relation label and a note (item 82)",
                  !!byName("scTyp") &&
                    byName("scTyp").displayName === "x" &&
                    !!breakGraph.relationships[1] &&
                    breakGraph.relationships[1].label === "r" &&
                    !!breakGraph.notes[2] &&
                    breakGraph.notes[2].text === "c",
                ],
                [
                  "an author-escaped formatting tag is kept as the " +
                    "characters <b> on the class label and a note (item 82)",
                  !!byName("scEsm") &&
                    byName("scEsm").displayName === "<b>z</b>" &&
                    !!breakGraph.notes[4] &&
                    breakGraph.notes[4].text === "<b>e</b>",
                ],
                [
                  "a tag-only label is delivered empty on the class label " +
                    "and a note, and on a relation label (item 82)",
                  !!byName("scNil") &&
                    byName("scNil").displayName === "" &&
                    !!breakGraph.relationships[3] &&
                    breakGraph.relationships[3].label === "" &&
                    !!breakGraph.notes[5] &&
                    breakGraph.notes[5].text === "",
                ],
                [
                  "markdown emphasis reads as its text on the class label, " +
                    "the relation label and a note (item 82)",
                  !!byName("scEmp") &&
                    byName("scEmp").displayName === "y" &&
                    !!breakGraph.relationships[2] &&
                    breakGraph.relationships[2].label === "e" &&
                    !!breakGraph.notes[3] &&
                    breakGraph.notes[3].text === "d",
                ],
              ]);
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    classSelfCheckPromise = queued
      // Item 82, L2: the link rows read a third fixture, parsed after the
      // others, so every predicate above has already been evaluated.
      .then((assertions) =>
        runClassLinkRows().then((linkRows) => assertions.concat(linkRows))
      )
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Class self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's class parse internals no longer " +
              "match the stage 0 measurements; do not trust class adapter output."
          );
          classHealthy = false;
          return false;
        }

        logInfo(
          "Class self-check passed: all accessor and field-shape assertions hold"
        );
        classHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Class self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        classHealthy = false;
        return false;
      });

    return classSelfCheckPromise;
  }

  /**
   * Report the class surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the class self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isClassHealthy() {
    return classHealthy;
  }

  // ---------------------------------------------------------------------
  // Git graph surface
  //
  // Parallel to the three surfaces above — own memo slot, own self-check
  // state, own health flag — but structurally DIFFERENT in one measured
  // respect: the git graph db is a module-level SINGLETON, not a fresh
  // instance per parse. Measured in
  // docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md § M2e: two
  // sequential getDiagramFromText calls return the SAME db object, and the
  // second parse destroys the first diagram's data in place. Two defences
  // follow, both mandatory:
  //
  //   1. EAGER SNAPSHOT — normaliseGit copies every value it reads into
  //      fresh plain objects and arrays inside the parse's own .then, so
  //      nothing in a resolved graph references a db-owned object. This
  //      defence lives here, on the surface, and is unaffected by item 21.
  //   2. SERIALISED PARSES — parseGit calls are chained through a promise
  //      queue, so a second call with different code cannot begin parsing
  //      (and therefore mutating the singleton) until the previous call's
  //      snapshot is complete. The self-check's fixture parse goes through
  //      the same queue for the same reason. Since item 21 that queue is
  //      the ADAPTER-WIDE `adapterParseQueue` rather than a git-local one,
  //      and the rationale for it — including this defence, restated in
  //      full — sits at its declaration near the top of this file. Nothing
  //      about the defence weakened in the move: widening the queue can
  //      only serialise MORE parses against a git parse, never fewer.
  //
  // Field sources are docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the git graph surface, matching parse()'s
  // contract: the promise is cached rather than the resolved value. The
  // memo sits IN FRONT of the parse queue — an identical-code call returns
  // the cached promise without enqueueing a second singleton mutation.
  let gitMemoCode = null;
  let gitMemoPromise = null;

  // Git self-check health: null until the check has run, then true or
  // false. Independent of the other three flags by design.
  let gitHealthy = null;

  // Lazy, memoised, first-parseGit trigger — same reasoning as the other
  // three self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let gitSelfCheckStarted = false;
  let gitSelfCheckPromise = null;

  /**
   * The embedded git graph self-check fixture. Three named commits, two
   * branches and one merge pin the raw internals the surface depends on —
   * above all the merge parent order (stage 0 G5), so a Mermaid upgrade
   * that reorders merge parents fails loudly instead of silently swapping
   * every "merged X into Y" sentence. `branch` auto-checks-out the new
   * branch (G4), so B and C land on dev and topic with no checkout
   * statements.
   *
   * THE FIXTURE DELIBERATELY NEVER NAMES THE DEFAULT BRANCH. Measured
   * 3 August 2026 (stage 2): rendering a git graph whose init directive
   * sets gitGraph.mainBranchName leaks that name into the config used by
   * subsequent getDiagramFromText parses (until the next render resets
   * it). A fixture saying `checkout main` REJECTED outright under that
   * leak — there is no branch called main in a renamed session — which
   * latched gitHealthy false for the whole page. So the merge is pinned
   * between two explicitly created branches (checkout dev is safe: dev is
   * created by this fixture), and the default branch appears only through
   * commit A's branch field, asserted against the db's own configured
   * name, never the literal "main".
   */
  const GIT_SELF_CHECK_FIXTURE = [
    "gitGraph",
    '    commit id: "A"',
    "    branch dev",
    '    commit id: "B"',
    "    branch topic",
    '    commit id: "C"',
    "    checkout dev",
    "    merge topic",
  ].join("\n");

  // Auto-generated commit ids have the measured shape `<seq>-<7 hex>`
  // (stage 0 G1) — see the hasCustomId rule in normaliseGit.
  const GIT_AUTO_ID_PATTERN = /^(\d+)-[0-9a-f]{7}$/;

  /**
   * Decode one numeric git commit type code into a kind string.
   *
   * THE FALSY-ZERO TRAP, third enum running on this project (stage 0 M2a):
   * NORMAL is the number 0, so any truthiness test reads every normal
   * commit as typeless. Every comparison below is numeric and explicit.
   *
   * An unmeasured code degrades to "unknown" with one WARN, never a throw.
   *
   * @param {number} code - The raw commitType code
   * @returns {string} "normal" | "reverse" | "highlight" | "merge" |
   *   "cherryPick" | "unknown"
   */
  function decodeGitCommitKind(code) {
    if (code === 0) return "normal";
    if (code === 1) return "reverse";
    if (code === 2) return "highlight";
    if (code === 3) return "merge";
    if (code === 4) return "cherryPick";
    logWarn(
      `Git commit carries an unmeasured type code (${code}); ` +
        'recording kind "unknown"'
    );
    return "unknown";
  }

  /**
   * Normalise one resolved git graph Diagram instance into the adapter's
   * git shape.
   *
   * EAGER SNAPSHOT (singleton defence 1, stage 0 M2e): the git graph db is
   * a shared singleton and the next git graph parse anywhere in the page
   * destroys its contents in place, so every value read here is copied
   * into fresh plain objects and arrays before this function returns.
   * Nothing in the returned graph references a db-owned object, and no
   * consumer may ever go back to the db later.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised git graph
   */
  function normaliseGit(diagram) {
    const db = diagram.db;

    // Seq order (G11): creation order regardless of branch.
    const rawCommits = db.getCommitsArray();

    // Snapshot-local id lookup for mergedFromBranch resolution — resolved
    // within this parse's own data, never against the db afterwards.
    const idToCommit = new Map();
    rawCommits.forEach((commit) => {
      idToCommit.set(commit.id, commit);
    });

    const commits = rawCommits.map((commit) => {
      const kind = decodeGitCommitKind(commit.type);
      const parents = Array.isArray(commit.parents) ? [...commit.parents] : [];

      // hasCustomId: for merge commits the db's own customId flag is
      // authoritative (M2c — the flag exists only on merges). For every
      // other commit this is a measured-shape heuristic (G1): an id is
      // auto-generated exactly when it matches `<seq>-<7 hex>` AND the
      // number equals the commit's own seq; hasCustomId is the negation.
      let hasCustomId;
      if (kind === "merge") {
        hasCustomId = commit.customId === true;
      } else {
        const autoMatch = GIT_AUTO_ID_PATTERN.exec(commit.id);
        const isAutoGenerated =
          autoMatch !== null && Number(autoMatch[1]) === commit.seq;
        hasCustomId = !isAutoGenerated;
      }

      // overrideKind: merges only — a `type:` option on a merge lands in
      // customType (numeric) while type stays 3 (G5). An unmodified merge
      // carries customType as an own key holding undefined (M2c), so the
      // check is an explicit typeof, never truthiness.
      const overrideKind =
        kind === "merge" && typeof commit.customType === "number"
          ? decodeGitCommitKind(commit.customType)
          : "";

      // Author tags only: the machine-generated cherry-pick markers
      // ("cherry-pick:S1", "cherry-pick:MG|parent:M2") are filtered out
      // (G6); the source reference survives structurally in parents[1].
      const tags = (Array.isArray(commit.tags) ? commit.tags : []).filter(
        (tag) => !/^cherry-pick:/.test(tag)
      );

      // mergedFromBranch: merges only — the branch of the commit whose id
      // is parents[1] (the merged-from head, G5), resolved within this
      // snapshot. Fails closed to "" when parents[1] is missing, self, or
      // unresolvable — including the self-parenting commit the
      // duplicate-id garbage produces (G10d), which is copied raw into
      // parents and never "repaired".
      let mergedFromBranch = "";
      if (kind === "merge" && parents.length > 1) {
        const source = idToCommit.get(parents[1]);
        if (source && source.id !== commit.id) {
          mergedFromBranch = source.branch;
        }
      }

      // cherryPickSourceId: cherry-picks only — parents[1] is the source
      // commit (G6); "" on any other commit or when absent.
      const cherryPickSourceId =
        kind === "cherryPick" && typeof parents[1] === "string"
          ? parents[1]
          : "";

      // Item 9, verdict C-PH for this surface: git graph draws into SVG
      // <text> (0 foreignObjects measured), so an author-typed entity is
      // drawn literally and must NOT be resolved — only the placeholders.
      //
      // EVERY commit-id-shaped and branch-name-shaped value is decoded
      // together, so the normalised shape's own cross-references keep
      // matching: consumers key commits by `id` and look `cherryPickSourceId`
      // up in that index, and compare `branch` against `branches[].name`.
      // All internal resolution above ran on the RAW values first —
      // `hasCustomId` in particular is computed from the raw id — so the
      // decode changes what is DELIVERED and never what was resolved.
      //
      // Item 19 (8 August 2026) adds `message` and `tags[]`, both C-PH.
      // `tags[]` was measured: it is drawn into SVG <text> like every other
      // git label, and C-PH is the only candidate matching all nine rows.
      // `message` is the one field in the corpus that Mermaid NEVER DRAWS —
      // gitGraph paints the branch label and the commit id and nothing else —
      // so there is no canvas to match and the render table could not decide
      // it. It is adopted C-PH on AUTHOR INTENT: someone who typed `#quot;`
      // meant a quote, and with no drawing to contradict them the surface's
      // own convention is what the reader should hear. It is also narrated in
      // the SAME SENTENCE as the id (refFor), which is the visible defect this
      // closes. The cherry-pick filter above runs on the RAW tags, so the
      // decode changes what is delivered and never what was filtered.
      return {
        id: decodePlaceholders(commit.id),
        hasCustomId: hasCustomId,
        message: decodePlaceholders(commit.message),
        seq: commit.seq,
        kind: kind,
        overrideKind: overrideKind,
        tags: tags.map((tag) => decodePlaceholders(tag)),
        parents: parents.map((parent) => decodePlaceholders(parent)),
        branch: decodePlaceholders(commit.branch),
        mergedFromBranch: decodePlaceholders(mergedFromBranch),
        cherryPickSourceId: decodePlaceholders(cherryPickSourceId),
      };
    });

    // Branches in DISPLAY order: getBranchesAsObjArray honours `order:`
    // options (G4) and supplies the sequence; each head comes from the
    // getBranches Map. headId is null for a branch with no head — an
    // empty graph's main maps to null (G8).
    const headByName = db.getBranches();
    const branches = db.getBranchesAsObjArray().map((branch) => {
      // The lookup uses the RAW name; only the delivered values decode.
      const headId = headByName.get(branch.name);
      return {
        name: decodePlaceholders(branch.name),
        headId:
          headId === undefined || headId === null
            ? null
            : decodePlaceholders(headId),
      };
    });

    return {
      type: "gitGraph",
      // "LR" default; LR, TB and BT all live (G9) — no synonym collapsing.
      direction: db.getDirection(),
      // Populated by a body `title` statement — the first measured type
      // where this accessor ever carries data (G10a). Item 9, C-PH.
      title: decodePlaceholders(db.getDiagramTitle() || ""),
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      currentBranch: decodePlaceholders(db.getCurrentBranch()),
      branches: branches,
      commits: commits,
    };
  }

  /**
   * Parse Mermaid git graph code into the normalised git shape.
   *
   * Rejects with Mermaid's own error on a parse failure — a
   * MermaidParseError with NO `hash` property on this type (stage 0 G12;
   * git graph is on the new parser, unlike flowchart, ER and class). The
   * call itself never throws synchronously, so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (singleton defence 2, stage 0 M2e; adapter-wide since
   * register item 21): every parse is chained through the queue so it cannot
   * mutate the shared singleton db while an earlier call's snapshot is still
   * in progress — and, since the queue now spans all five surfaces, nor can
   * a parse of any OTHER type clear Mermaid's shared accessible-title store
   * between this parse and normaliseGit's read of `title`. The chain
   * advances on settlement, not success, so a rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised git graph
   */
  function parseGit(code) {
    // Lazy git self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parse first, so it holds the
    // front of the queue ahead of this call's parse.
    if (!gitSelfCheckStarted) {
      runGitSelfCheck();
    }

    if (code === gitMemoCode && gitMemoPromise) {
      logDebug("Returning memoised git parse for identical code string");
      return gitMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Git parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Git parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseGit(diagram);
          logDebug(
            `Git parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Git parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    gitMemoCode = code;
    gitMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded git fixture and assert the db accessor names and
   * field shapes the git surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the git surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other three health flags.
   *
   * Like the ER and class checks, this resolves the Diagram itself rather
   * than going through parseGit(): its assertions are deliberately about
   * the RAW db internals the normalised shape exists to hide — above all
   * the merge parent order (parents[0] = target head, parents[1] =
   * merged-from head, stage 0 G5) and the numeric commitType enum with
   * NORMAL at 0 (M2a). A Mermaid upgrade that changes either fails here
   * instead of silently corrupting every merge sentence downstream.
   *
   * The fixture parse goes through the parse QUEUE (singleton defence 2):
   * a direct unqueued getDiagramFromText call could mutate the singleton
   * db mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * @returns {Promise<boolean>} Resolves to the git health verdict
   */
  function runGitSelfCheck() {
    if (gitSelfCheckPromise) {
      return gitSelfCheckPromise;
    }
    gitSelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read. Until item 21 those reads sat in a .then attached to
    // `queued` from outside the run, which held only by microtask
    // attachment order; the invariant is now structural — see the queue
    // declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            GIT_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done (singleton defence, M2e).
          const commitType = db.commitType;
          const commits = db.getCommits();
          const isMap = commits instanceof Map;
          const ids = isMap ? [...commits.keys()] : [];
          const values = isMap ? [...commits.values()] : [];
          const commitA = isMap ? commits.get("A") : undefined;
          const commitB = isMap ? commits.get("B") : undefined;
          const commitC = isMap ? commits.get("C") : undefined;
          const mergeCommit = values[3];
          const branchHeads = db.getBranches();
          const branchesIsMap = branchHeads instanceof Map;

          // The default branch's name is read from the db's own config, never
          // hard-coded as "main" — see the fixture comment above for the
          // measured directive leak that makes the literal wrong.
          const mainName =
            typeof db.getConfig === "function" &&
            db.getConfig() &&
            typeof db.getConfig().mainBranchName === "string"
              ? db.getConfig().mainBranchName
              : "main";

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "commitType enum is numeric with NORMAL 0, MERGE 3, CHERRY_PICK 4",
              commitType &&
                commitType.NORMAL === 0 &&
                commitType.MERGE === 3 &&
                commitType.CHERRY_PICK === 4,
            ],
            [
              "commits container is a Map of size 4 in order A, B, C, merge",
              isMap &&
                commits.size === 4 &&
                ids[0] === "A" &&
                ids[1] === "B" &&
                ids[2] === "C" &&
                mergeCommit !== undefined &&
                ids[3] === mergeCommit.id,
            ],
            [
              "commit A: type 0, empty parents array, on the configured default branch",
              commitA &&
                commitA.type === 0 &&
                Array.isArray(commitA.parents) &&
                commitA.parents.length === 0 &&
                commitA.branch === mainName,
            ],
            [
              "commit B on branch dev and commit C on branch topic",
              commitB &&
                commitB.branch === "dev" &&
                commitC &&
                commitC.branch === "topic",
            ],
            [
              "merge parent order: type 3 on dev with parents [B, C] " +
                "(parents[0] = target head, parents[1] = merged-from head)",
              mergeCommit &&
                mergeCommit.type === 3 &&
                mergeCommit.branch === "dev" &&
                Array.isArray(mergeCommit.parents) &&
                mergeCommit.parents[0] === "B" &&
                mergeCommit.parents[1] === "C",
            ],
            [
              "getBranches maps the default branch to A, dev to the merge commit, topic to C",
              branchesIsMap &&
                mergeCommit &&
                branchHeads.get(mainName) === "A" &&
                branchHeads.get("dev") === mergeCommit.id &&
                branchHeads.get("topic") === "C",
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    gitSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Git self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's git graph parse internals no " +
              "longer match the stage 0 measurements; do not trust git " +
              "adapter output."
          );
          gitHealthy = false;
          return false;
        }

        logInfo(
          "Git self-check passed: all accessor and field-shape assertions hold"
        );
        gitHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Git self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        gitHealthy = false;
        return false;
      });

    return gitSelfCheckPromise;
  }

  /**
   * Report the git surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the git self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isGitHealthy() {
    return gitHealthy;
  }

  // ---------------------------------------------------------------------
  // Sankey surface
  //
  // Parallel to the four surfaces above — own memo slot, own self-check
  // state, own health flag — and, like the git graph surface, built over a
  // SHARED SINGLETON db rather than a fresh instance per parse. Measured in
  // docs/mermaid-sankey-stage0-measurements-2026-08-03.md § S2e: two
  // sequential getDiagramFromText calls return the SAME db object
  // (dA.db === dB.db) and the second parse's data replaces the first's.
  // The same two defences follow, both mandatory:
  //
  //   1. EAGER SNAPSHOT — normaliseSankey reads db.getGraph() ONCE inside
  //      the parse's own .then and maps it into the adapter's own shape
  //      there. getGraph() projects the db's CURRENT arrays, so a call made
  //      after a later parse has begun would project the wrong diagram.
  //      This defence lives here, on the surface, and is unaffected by
  //      item 21.
  //   2. SERIALISED PARSES — parseSankey calls are chained through a
  //      promise queue, so a second call with different code cannot begin
  //      parsing (and therefore replacing the singleton's data) until the
  //      previous call's snapshot is complete. The self-check's fixture
  //      parse goes through the same queue for the same reason. Since
  //      item 21 that queue is the ADAPTER-WIDE `adapterParseQueue` rather
  //      than a sankey-local one, and the rationale for it — including this
  //      defence and the S2e reassignment note below, both restated in
  //      full — sits at its declaration near the top of this file.
  //
  // One measured difference from git graph, recorded so a future editor
  // does not weaken the defences on the strength of it: a sankey parse
  // REASSIGNS the db's internal arrays rather than mutating them in place
  // (S2e), so a snapshot taken at the right moment is durable. That is why
  // defence 1 is about WHEN getGraph() is called, not about deep-copying
  // what it returns — the projection is already a fresh plain object built
  // per call. The queue is what guarantees the "right moment".
  //
  // THREE THINGS THIS SURFACE DELIBERATELY NEVER TOUCHES:
  //   - db.getNodes() / db.getLinks() — the LIVE SankeyNode / SankeyLink
  //     instances, whose node key is an uppercase ID and whose link
  //     endpoints are object references (S2c). Reading `.id` off one of
  //     those returns undefined SILENTLY, which is stage 0's central trap;
  //     the self-check pins both key cases so an upgrade fails loudly.
  //   - db.nodesMap — vestigial. It reads Map(0) after every parse even as
  //     nodes are created, so the dedup index is a closure variable and
  //     this is not it (S2a).
  //   - every mutator, above all db.addLink(). Called with no arguments it
  //     returns undefined WITHOUT THROWING and poisons the db, so the
  //     failure arrives later, on an innocent-looking getGraph() call
  //     (S2b). This surface calls getters only.
  //
  // Field sources are docs/mermaid-sankey-stage0-measurements-2026-08-03.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the sankey surface, matching parse()'s contract:
  // the promise is cached rather than the resolved value. The memo sits IN
  // FRONT of the parse queue — an identical-code call returns the cached
  // promise without enqueueing a second singleton replacement.
  let sankeyMemoCode = null;
  let sankeyMemoPromise = null;

  // Sankey self-check health: null until the check has run, then true or
  // false. Independent of the other four flags by design.
  let sankeyHealthy = null;

  // Lazy, memoised, first-parseSankey trigger — same reasoning as the other
  // four self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let sankeySelfCheckStarted = false;
  let sankeySelfCheckPromise = null;

  /**
   * The embedded sankey self-check fixture. Two links and three nodes are
   * enough to pin everything this surface depends on: the projection's
   * lowercase `id` keys and STRING link endpoints, first-mention node order
   * (stage 0 K8), and a decimal value passing through as a number (K3).
   *
   * The fixture uses ASCII names only — not a stylistic choice. Every
   * character at or above U+0080 REJECTS the whole parse on this type
   * (K2), so an accented or curly-quoted fixture name would latch
   * sankeyHealthy false for the whole page session.
   */
  const SANKEY_SELF_CHECK_FIXTURE = [
    "sankey-beta",
    "    A,B,10",
    "    B,C,2.5",
  ].join("\n");

  /**
   * Normalise one resolved sankey Diagram instance into the adapter's
   * sankey shape.
   *
   * EAGER SNAPSHOT (singleton defence 1, stage 0 S2e): the sankey db is a
   * shared singleton whose data the next sankey parse replaces, so
   * getGraph() is read ONCE here — inside the parse's own .then, behind the
   * queue — and mapped into the adapter's own objects immediately. Nothing
   * in the returned graph references a db-owned object, and no consumer may
   * ever go back to the db later.
   *
   * The db's two graph shapes are NOT interchangeable (S2c): getGraph()
   * gives a freshly built plain projection with lowercase `id` and string
   * endpoints, while getNodes()/getLinks() give live SankeyNode/SankeyLink
   * instances keyed uppercase `ID` with object-reference endpoints. This
   * surface reads the projection only.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised sankey graph
   */
  function normaliseSankey(diagram) {
    const db = diagram.db;

    // The single read. Everything below maps this one projection.
    const graph = db.getGraph();
    const rawNodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    const rawLinks = graph && Array.isArray(graph.links) ? graph.links : [];

    // Projection order is first-mention, scanning source before target on
    // each row (K8) — deterministic within and across parses, so narration
    // may quote "the first flow" from it.
    // ITEM 9, VERDICT C-NONE — this surface applies NO decode, and that is
    // a measured result rather than an omission. encodeEntities runs before
    // the parser, so any `#word;` in sankey source reaches the grammar as
    // private delimiter bytes at or above U+0080, which this type rejects
    // outright (stage 0 K2). Every placeholder-bearing probe REJECTS here,
    // in both the bare and the quoted name form, so a sankey graph can
    // never carry a placeholder to decode. The two probes that do parse
    // (an apostrophe, and an author-typed `&quot;` which the canvas draws
    // literally) are identity under every candidate transform.
    // See docs/mermaid-quot-adoption-2026-08-08.md § 1.
    const nodes = rawNodes.map((node) => ({
      // A node name may legitimately be the EMPTY STRING: a name that
      // sanitises away (for example a leading "<") yields an id of ""
      // (K10a). It is passed through rather than dropped or substituted —
      // the narration module owns the fallback phrase.
      name: typeof node.id === "string" ? node.id : "",
    }));

    const links = rawLinks.map((link) => ({
      from: link.source,
      to: link.target,
      // VALUE IS COPIED RAW, and no truthiness test or filtering happens
      // anywhere on this surface. Measured in K3: value is ALWAYS
      // typeof "number", but 0 is a legal link value and is falsy, while
      // "abc" parses silently to NaN and "Infinity" to a real Infinity.
      // A filter on truthiness would drop every zero-value flow; a filter
      // on finiteness would hide the bad rows the narration layer has to
      // report. Guarding with Number.isFinite is the narration module's
      // job, not the adapter's.
      value: link.value,
    }));

    // NO title, accTitle or accDescr fields. Measured in K9: sankey has no
    // accTitle/accDescr syntax at all — every placement rejects the whole
    // parse — and a YAML frontmatter title does not arrive either, so
    // getDiagramTitle(), getAccTitle() and getAccDescription() are
    // permanently "" on this type. Dead fields would invite a consumer to
    // branch on data that can never exist; do not "complete" the shape by
    // adding them.
    //
    // NO config field either. getConfig() carries the only unit
    // information that exists (prefix/suffix/showValues), and it is
    // corrupted on exactly the path the engine uses: a render's sankey
    // config leaks into every subsequent getDiagramFromText parse until the
    // next render of any diagram type (S2f). This surface deliberately does
    // not expose it.
    return {
      type: "sankey",
      nodes: nodes,
      links: links,
    };
  }

  /**
   * Parse Mermaid sankey code into the normalised sankey shape.
   *
   * Rejects with Mermaid's own error on a parse failure — a plain Error
   * carrying the full five-key jison `hash` (text, token, line, loc,
   * expected) on this type (stage 0 K11; sankey sits with flowchart, ER and
   * class, not with git graph's hashless MermaidParseError). The call
   * itself never throws synchronously, so awaiting this promise is the
   * single error path.
   *
   * SERIALISED PARSES (singleton defence 2, stage 0 S2e; adapter-wide since
   * register item 21): every parse is chained through the queue so it cannot
   * replace the shared singleton's data while an earlier call's snapshot is
   * still in progress. Sankey carries none of the accessible-title fields
   * itself, but its parse CLEARS that shared store like any other, so it
   * queues for the other four surfaces' sake as well as its own. The chain
   * advances on settlement, not success, so a rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised sankey graph
   */
  function parseSankey(code) {
    // Lazy sankey self-check trigger, matching the other surfaces'
    // ordering. The check enqueues its own fixture parse first, so it holds
    // the front of the queue ahead of this call's parse.
    if (!sankeySelfCheckStarted) {
      runSankeySelfCheck();
    }

    if (code === sankeyMemoCode && sankeyMemoPromise) {
      logDebug("Returning memoised sankey parse for identical code string");
      return sankeyMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Sankey parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Sankey parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseSankey(diagram);
          logDebug(
            `Sankey parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Sankey parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    sankeyMemoCode = code;
    sankeyMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded sankey fixture and assert the db accessor names and
   * field shapes the sankey surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the sankey surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other four health flags.
   *
   * Like the ER, class and git checks, this resolves the Diagram itself
   * rather than going through parseSankey(): its assertions are
   * deliberately about the RAW db internals the normalised shape exists to
   * hide — above all THE TWO-SHAPES TRAP (stage 0 S2c), pinned here at
   * source so a Mermaid upgrade that renames or unifies the key cases fails
   * loudly instead of letting a future editor's `.id` read off the live
   * objects return undefined silently.
   *
   * The fixture parse goes through the parse QUEUE (singleton defence 2):
   * a direct unqueued getDiagramFromText call could replace the singleton
   * db's data mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * @returns {Promise<boolean>} Resolves to the sankey health verdict
   */
  function runSankeySelfCheck() {
    if (sankeySelfCheckPromise) {
      return sankeySelfCheckPromise;
    }
    sankeySelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read. Until item 21 those reads sat in a .then attached to
    // `queued` from outside the run, which held only by microtask
    // attachment order; the invariant is now structural — see the queue
    // declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            SANKEY_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done (singleton defence, S2e).
          const graph = db.getGraph();
          const graphNodes =
            graph && Array.isArray(graph.nodes) ? graph.nodes : [];
          const graphLinks =
            graph && Array.isArray(graph.links) ? graph.links : [];

          // The live objects, read ONLY to pin the two-shapes trap below.
          // Nothing else on this surface ever calls getNodes() (S2c).
          const liveNodes = db.getNodes();
          const liveFirst = Array.isArray(liveNodes) ? liveNodes[0] : undefined;

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "getGraph returns a plain object whose nodes are " +
                '[{id "A"}, {id "B"}, {id "C"}] in first-mention order with ' +
                "lowercase id keys",
              graph &&
                typeof graph === "object" &&
                graphNodes.length === 3 &&
                graphNodes[0].id === "A" &&
                graphNodes[1].id === "B" &&
                graphNodes[2].id === "C",
            ],
            [
              "getGraph links are [{A,B,10}, {B,C,2.5}] in source order with " +
                "STRING source/target and numeric values",
              graphLinks.length === 2 &&
                typeof graphLinks[0].source === "string" &&
                typeof graphLinks[0].target === "string" &&
                graphLinks[0].source === "A" &&
                graphLinks[0].target === "B" &&
                typeof graphLinks[0].value === "number" &&
                graphLinks[0].value === 10 &&
                typeof graphLinks[1].source === "string" &&
                typeof graphLinks[1].target === "string" &&
                graphLinks[1].source === "B" &&
                graphLinks[1].target === "C" &&
                typeof graphLinks[1].value === "number" &&
                graphLinks[1].value === 2.5,
            ],
            [
              "THE TWO-SHAPES PIN: the live getNodes() objects are keyed " +
                'uppercase ID ("A") and have NO lowercase id property',
              liveFirst !== undefined &&
                liveFirst !== null &&
                liveFirst.ID === "A" &&
                liveFirst.id === undefined,
            ],
            [
              "getAccTitle, getAccDescription and getDiagramTitle all return " +
                '"" (sankey has no syntax that populates them)',
              db.getAccTitle() === "" &&
                db.getAccDescription() === "" &&
                db.getDiagramTitle() === "",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    sankeySelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Sankey self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's sankey parse internals no longer " +
              "match the stage 0 measurements; do not trust sankey adapter " +
              "output."
          );
          sankeyHealthy = false;
          return false;
        }

        logInfo(
          "Sankey self-check passed: all accessor and field-shape assertions hold"
        );
        sankeyHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Sankey self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        sankeyHealthy = false;
        return false;
      });

    return sankeySelfCheckPromise;
  }

  /**
   * Report the sankey surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the sankey self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isSankeyHealthy() {
    return sankeyHealthy;
  }

  // ---------------------------------------------------------------------
  // XY chart surface
  //
  // Parallel to the five surfaces above in every structural respect — own
  // single-slot memo, own lazy self-check state, own advisory health flag,
  // every parse-and-read inside one adapterParseQueue slot — and DIFFERENT
  // from all five in one: ITS DATA COMES FROM READING THE DIAGRAM SOURCE,
  // not from the db.
  //
  // THAT IS FORCED BY MEASUREMENT, NOT CHOSEN. Measured 22 August 2026 and
  // recorded in docs/mermaid-xychart-grounding-2026-08-22.md:
  //
  //   - § 3.2 THE DB DELIVERS NO DATA. All nineteen of its members are
  //     FUNCTIONS and not one returns the chart's numbers. The only route to
  //     content is getDrawableElem(), which returns RENDERED GEOMETRY —
  //     a bar's value exists solely as a rectangle height and a line's values
  //     solely as pixel coordinates inside one SVG path string (§ 3.4). A
  //     description that wants to say "872 submissions on Friday" cannot get
  //     872 from Mermaid.
  //   - § 7 SERIES NAMES ARE DISCARDED OUTRIGHT. `bar "Actual intake" […]`
  //     parses cleanly and the name appears nowhere: not in the db, not in
  //     any group name, not in the rendered SVG.
  //   - § 6.2 BAND AND RANGE X-AXES ARE INDISTINGUISHABLE from anything
  //     Mermaid delivers. Two sources constructed to collide produced
  //     identical group structure, identical label texts, an identical path
  //     string byte for byte and an identical getChartConfig().xAxis; the
  //     ONLY difference anywhere was floating-point noise in tick
  //     x-positions (145.1 against 145.10000000000002), which is not a
  //     signal and which a Mermaid patch release could erase.
  //   - § 6.3 THE DECLARED AXIS RANGE IS NOT DELIVERED, and the top tick is
  //     not a substitute for it: a source declaring `0 --> 250` delivers a
  //     top tick of 240.
  //
  // MERMAID IS STILL THE JUDGE OF VALIDITY. The reader runs ONLY after
  // getDiagramFromText has resolved, in the same queue slot, so this surface
  // can never narrate a source Mermaid rejected. The reader is a second
  // opinion about CONTENT, never a first opinion about legality.
  //
  // THE READER'S FAILURE CONTRACT, stated here because a future consumer
  // depends on it: if the reader meets a source Mermaid ACCEPTED but our
  // grammar subset cannot understand — Mermaid's grammar growing past ours —
  // it THROWS an Error whose message begins XYCHART_READER_ERROR_PREFIX. It
  // never guesses, never partially fills the shape, and never returns a
  // chart with fields quietly missing. The generator module of build session
  // 2 will let that throw reach the core's generation-failed branch, so the
  // reader says "we could not read this" out loud instead of describing a
  // chart it half understood. A silent partial read is the one outcome this
  // surface must never produce.
  //
  // WHY THE SINGLETON DEFENCES STILL APPLY EVEN THOUGH THE DATA IS OURS.
  // Measured § 3.3: the xychart db IS a shared singleton (two parses return
  // the same object, and the second silently rewrites the first diagram's
  // contents), and § 5: `title`, `accTitle` and `accDescr` come from
  // Mermaid's cross-type shared store, which EVERY parse of EVERY type
  // clears. So the three scalars are read same-tick inside the parse's own
  // .then, behind the queue, exactly as normaliseGit does. The axis and
  // series data cannot be lost that way — it is read from the caller's own
  // string — but the three scalars can, and they are the whole reason this
  // surface queues.
  //
  // TWO DB MEMBERS THIS SURFACE DELIBERATELY NEVER TOUCHES:
  //   - setTmpSVGG() — handed a raw SVG <g> instead of a d3 selection it
  //     accepts silently and then EVERY subsequent getDrawableElem() on the
  //     page throws, for every diagram, not only the one that poisoned it
  //     (grounding § 0). getDrawableElem does not need it, so the correct
  //     handling is never to call it.
  //   - getDrawableElem() itself — rendered geometry, per the headline
  //     above. Nothing here needs it, and reading it would reintroduce the
  //     scale-inversion guesswork the source read exists to avoid.
  //
  // Field sources are docs/mermaid-xychart-grounding-2026-08-22.md; the
  // delivered shape is docs/mermaid-xychart-gold-targets-2026-08-23.md § 3.
  // ---------------------------------------------------------------------

  // Frozen-const enums rather than bare strings, per AGENTS.md: these values
  // cross the adapter boundary into a generator that will branch on them.
  const XYCHART_ORIENTATIONS = Object.freeze({
    VERTICAL: "vertical",
    HORIZONTAL: "horizontal",
  });
  const XYCHART_AXIS_KINDS = Object.freeze({ BAND: "band", RANGE: "range" });
  const XYCHART_SERIES_KINDS = Object.freeze({ BAR: "bar", LINE: "line" });

  // Every reader refusal carries this prefix, so a consumer can tell "our
  // subset lags Mermaid's grammar" from "Mermaid rejected the source" without
  // string-matching on Mermaid's own error text.
  const XYCHART_READER_ERROR_PREFIX = "XY chart source reader";

  // A declared axis bound: an optionally-signed integer or decimal. Anchored
  // at BOTH ends deliberately — an unanchored variant would accept trailing
  // text and silently discard it (AGENTS.md § Diagnosis Discipline: verify
  // the exact variant the prose names).
  const XYCHART_NUMBER = "-?\\d+(?:\\.\\d+)?";
  const XYCHART_RANGE_ONLY = new RegExp(
    `^(${XYCHART_NUMBER})\\s*-->\\s*(${XYCHART_NUMBER})$`
  );
  const XYCHART_TITLED_RANGE = new RegExp(
    `^(.*?)\\s+(${XYCHART_NUMBER})\\s*-->\\s*(${XYCHART_NUMBER})$`
  );

  // Single-slot memo, matching every other surface's contract: the PROMISE is
  // cached, not the resolved value, and the memo sits IN FRONT of the parse
  // queue so an identical-code call never enqueues a second singleton
  // replacement.
  let xychartMemoCode = null;
  let xychartMemoPromise = null;

  // XY chart self-check health: null until the check has run, then true or
  // false. Independent of the other five flags by design.
  let xychartHealthy = null;

  // Lazy, memoised, first-parseXychart trigger — same reasoning as the other
  // five self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let xychartSelfCheckStarted = false;
  let xychartSelfCheckPromise = null;

  /**
   * Band self-check fixture: a categorical x-axis, a declared y range and one
   * bar series. It carries a body `title`, an `accTitle` and an `accDescr`
   * because those three are the fields the shared store can lose, so the
   * check pins the same-tick snapshot as well as the reader.
   *
   * ASCII only, and every label distinctive, so a cross-delivery from another
   * diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const XYCHART_SELF_CHECK_FIXTURE_BAND = [
    "xychart-beta",
    "    accTitle: SelfCheck xychart acc title",
    "    accDescr: SelfCheck xychart acc descr",
    '    title "SelfCheck xychart title"',
    '    x-axis "SelfCheck x title" [Alpha, "Bravo two", Charlie]',
    '    y-axis "SelfCheck y title" 0 --> 90',
    '    bar "SelfCheck bar" [10, 20.5, 30]',
  ].join("\n");

  /**
   * Range self-check fixture: a NUMERIC-RANGE x-axis and a line series with
   * no series name. Two fixtures rather than one because the band/range split
   * is the single distinction Mermaid cannot express (grounding § 6.2) and is
   * therefore the reader's whole reason to exist — a check that exercised only
   * one of them would leave the other's branch unproven.
   */
  const XYCHART_SELF_CHECK_FIXTURE_RANGE = [
    "xychart-beta",
    '    title "SelfCheck range title"',
    '    x-axis "SelfCheck range x" 0 --> 100',
    "    y-axis 0 --> 40",
    "    line [1, 2, 4]",
  ].join("\n");

  /**
   * Reproduce Mermaid's own `encodeEntities` over raw source text.
   *
   * Quoted verbatim from the pinned 11.6.0 bundle in
   * docs/mermaid-quot-placeholder-capture-2026-08-08.md § 3.1, including the
   * two leading `style` / `classDef` passes, which are reproduced rather than
   * dropped so this function is a faithful copy rather than an approximation
   * of one.
   *
   * WHY IT IS HERE AT ALL, and it is the one thing about a raw-source decode
   * that a reader must understand. The db-fed surfaces receive text Mermaid
   * has ALREADY encoded — encodeEntities runs on the whole source inside
   * Diagram.fromText, before the parser sees it. A raw-source reader has been
   * through nothing. So to reach the same delivered bytes the db-fed surfaces
   * start from, the raw text must be encoded here first, and only then decoded
   * by the shared decodePlaceholders. Encode-then-decode is not a round trip
   * to nowhere: it is how Mermaid's own `#word;` escape reaches the character
   * it stands for.
   *
   * IT NOW SERVES TWO ROUTES, AND WAS RENAMED FOR IT ON 5 SEPTEMBER 2026 —
   * `encodeXychartEntities` until then, from the xychart surface that first
   * needed it. The second route is `decodeSourcePlaceholders` above, which
   * carried its own one-pass copy of the `#\w+;` branch alone until this date;
   * that copy is deleted and the two routes now share this one encoder. The
   * rename was taken because the single call site was, and remained, inside
   * this file. Dated session reports in docs/ still name the old spelling and
   * are correct as of their own dates.
   *
   * @param {string} source - Raw Mermaid text: a whole diagram source, or a
   *   directive value taken out of one
   * @returns {string} The text with `#word;` tokens in Mermaid's private
   *   delimiter form
   */
  function encodeMermaidEntities(source) {
    return source
      .replace(/style.*:\S*#.*;/g, (match) => match.substring(0, match.length - 1))
      .replace(/classDef.*:\S*#.*;/g, (match) => match.substring(0, match.length - 1))
      .replace(/#\w+;/g, (match) => {
        const inner = match.substring(1, match.length - 1);
        return /^\+?\d+$/.test(inner)
          ? `${PLACEHOLDER_NUMERIC}${inner}${PLACEHOLDER_END}`
          : `${PLACEHOLDER_NAMED}${inner}${PLACEHOLDER_END}`;
      });
  }

  /**
   * Throw the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   */
  function throwXychartReaderError(detail, lineNumber) {
    throw buildXychartReaderError(detail, lineNumber);
  }

  /**
   * The line shapes that hang Mermaid 11.6.0's xychart parser.
   *
   * `accDescr` has two spellings in Mermaid's accessibility grammar: the
   * one-line colon form and a braced BLOCK form. On `xychart-beta` the block
   * form does not parse — it HANGS, synchronously, and the whole page with it.
   * Measured 23 August 2026 (docs/mermaid-xychart-adapter-2026-08-23.md § 7):
   * four cases on their own fresh pages, each behind a positive control —
   * multi-line block NO SETTLE in 20,000ms, single-line `accDescr { inline }`
   * NO SETTLE in 20,000ms, one-line `accDescr:` ACCEPT in 12ms, and the same
   * block form on a `flowchart` ACCEPT in 19ms. The loop is SYNCHRONOUS by
   * inference rather than observation: two earlier probes raced the call
   * against a `setTimeout` and the timeout never fired, which requires the JS
   * thread to be blocked.
   *
   * `accDescription` is not Mermaid syntax at all and cannot hang; it is
   * matched here because the block form of a near-miss spelling is exactly the
   * thing a reader of this file will try next, and refusing is the safe
   * direction — an unreadable source falls back, where a hang takes the page.
   */
  const XYCHART_ACC_BLOCK_PATTERN = /^accDesc(?:r|ription)\s*\{/;

  /**
   * Cheap pre-scan for the hanging form, run BEFORE the parse is queued.
   *
   * The adapter has no timeout machinery by design (see the queue's own
   * declaration: a timeout would abandon a slot whose parse may still be
   * mutating a singleton db), so a queued parse that never settles would
   * stall ALL SIX surfaces for the life of the page. This is the only defence
   * available, and it costs one pass over the source's lines.
   *
   * NOT COMMENT-STRIPPED BEYOND `%%`, and deliberately not frontmatter-aware:
   * a false positive refuses a source and falls back, which is recoverable,
   * where a false negative hangs the page, which is not.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {number|null} The 1-based line number of the offending statement,
   *   or null when the source carries none
   */
  function findXychartHangingAccBlock(code) {
    // Same line-ending normalisation the source reader uses, and for the
    // same reason: a CRLF source must split identically to an LF one.
    const lines = String(code)
      .split("\r\n")
      .join("\n")
      .split("\r")
      .join("\n")
      .split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (XYCHART_ACC_BLOCK_PATTERN.test(stripXychartComment(lines[i]).trim())) {
        return i + 1;
      }
    }
    return null;
  }

  // The default tail on a reader refusal, and it states a PRECONDITION rather
  // than decorating the sentence: every refusal raised from readXychartSource
  // happens inside `getDiagramFromText(...).then`, so Mermaid has already
  // judged the source valid by the time it is reached. The hang guard is the
  // one refusal raised BEFORE the parse, so it must not claim this, and it
  // passes its own tail.
  const XYCHART_READER_ERROR_TAIL =
    "Mermaid accepted this source, so the reader's grammar subset lags " +
    "Mermaid's own; the diagram must fall back rather than be described " +
    "from a partial read.";

  /**
   * Build (never throw) the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   * @param {string} [tail] - Closing sentence; defaults to the
   *   Mermaid-already-accepted-it precondition above
   * @returns {Error} The reader error
   */
  function buildXychartReaderError(detail, lineNumber, tail) {
    const where = typeof lineNumber === "number" ? ` at source line ${lineNumber}` : "";
    return new Error(
      `${XYCHART_READER_ERROR_PREFIX}: ${detail}${where}. ` +
        (tail || XYCHART_READER_ERROR_TAIL)
    );
  }

  /**
   * Remove a trailing `%%` comment, ignoring one that falls inside quotes.
   * @param {string} line - One source line
   * @returns {string} The line with any comment removed
   */
  function stripXychartComment(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const character = line.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && character === "%" && line.charAt(i + 1) === "%") {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Take a leading double-quoted string off a statement's remainder.
   * @param {string} text - The trimmed remainder
   * @returns {Object|null} `{ value, rest }`, or null when there is no
   *   leading quoted string
   */
  function takeXychartQuoted(text) {
    if (text.charAt(0) !== '"') {
      return null;
    }
    const end = text.indexOf('"', 1);
    if (end === -1) {
      return null;
    }
    return { value: text.slice(1, end), rest: text.slice(end + 1).trim() };
  }

  /**
   * Strip one surrounding pair of double quotes, if present.
   * @param {string} text - A bracket-list item
   * @returns {string} The item without its surrounding quotes
   */
  function unquoteXychartItem(text) {
    const trimmed = text.trim();
    if (
      trimmed.length >= 2 &&
      trimmed.charAt(0) === '"' &&
      trimmed.charAt(trimmed.length - 1) === '"'
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  /**
   * Split a bracket list's interior on TOP-LEVEL commas only, so a quoted
   * label may legitimately contain one.
   * @param {string} inner - The text between `[` and `]`
   * @returns {string[]} The items, quotes intact, untrimmed
   */
  function splitXychartList(inner) {
    if (inner.trim() === "") {
      return [];
    }
    const items = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < inner.length; i += 1) {
      const character = inner.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        current += character;
        continue;
      }
      if (character === "," && !inQuotes) {
        items.push(current);
        current = "";
        continue;
      }
      current += character;
    }
    items.push(current);
    return items;
  }

  /**
   * Read one `x-axis` or `y-axis` statement's remainder.
   *
   * Four accepted forms, each with an optional leading axis title in either
   * the quoted or the bare spelling: a bracketed band list (x only), a
   * `min --> max` range, a title with no data at all, and a bare range.
   *
   * @param {string} remainder - The statement text after the keyword
   * @param {boolean} allowBand - True for the x-axis, false for the y-axis
   * @param {number} lineNumber - 1-based source line, for the error message
   * @returns {Object} `{ kind, title, categories }` or `{ kind, title, min, max }`
   */
  function readXychartAxis(remainder, allowBand, lineNumber) {
    let rest = remainder.trim();
    let title = null;

    const quoted = takeXychartQuoted(rest);
    if (quoted) {
      title = quoted.value;
      rest = quoted.rest;
    }

    // Title only, no data — a legal `y-axis "Count"` with no declared range.
    if (rest === "") {
      if (title === null) {
        throwXychartReaderError("an axis statement with nothing after it", lineNumber);
      }
      // The title decodes here exactly as it does on every other return path
      // below. Missing it would make ONE axis form silently deliver raw
      // placeholder bytes while the others decoded — the kind of per-branch
      // omission that reads as correct in review.
      return allowBand
        ? {
            kind: XYCHART_AXIS_KINDS.RANGE,
            title: decodePlaceholders(title),
            min: null,
            max: null,
          }
        : { kind: null, title: decodePlaceholders(title), min: null, max: null };
    }

    const open = rest.indexOf("[");
    if (open !== -1) {
      if (!allowBand) {
        throwXychartReaderError(
          "a bracketed category list on the y-axis, which has no band form",
          lineNumber
        );
      }
      const close = rest.lastIndexOf("]");
      if (close < open) {
        throwXychartReaderError("an unclosed category list", lineNumber);
      }
      if (rest.slice(close + 1).trim() !== "") {
        throwXychartReaderError("trailing text after a category list", lineNumber);
      }
      const beforeBracket = rest.slice(0, open).trim();
      if (beforeBracket !== "") {
        if (title !== null) {
          throwXychartReaderError(
            "two axis titles on one statement, one quoted and one bare",
            lineNumber
          );
        }
        title = beforeBracket;
      }
      const categories = splitXychartList(rest.slice(open + 1, close)).map((item) =>
        decodePlaceholders(unquoteXychartItem(item))
      );
      return {
        kind: XYCHART_AXIS_KINDS.BAND,
        title: title === null ? null : decodePlaceholders(title),
        categories: categories,
      };
    }

    const bare = XYCHART_RANGE_ONLY.exec(rest);
    if (bare) {
      return {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: title === null ? null : decodePlaceholders(title),
        min: Number(bare[1]),
        max: Number(bare[2]),
      };
    }

    // A bare (unquoted) axis title in front of a range.
    const titled = XYCHART_TITLED_RANGE.exec(rest);
    if (titled && titled[1].trim() !== "") {
      if (title !== null) {
        throwXychartReaderError(
          "two axis titles on one statement, one quoted and one bare",
          lineNumber
        );
      }
      return {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: decodePlaceholders(titled[1].trim()),
        min: Number(titled[2]),
        max: Number(titled[3]),
      };
    }

    throwXychartReaderError(
      `an axis statement in a form the reader does not know: ${JSON.stringify(remainder.trim())}`,
      lineNumber
    );
    return null;
  }

  /**
   * Read one `bar` or `line` statement's remainder.
   * @param {string} kind - "bar" or "line"
   * @param {string} remainder - The statement text after the keyword
   * @param {number} lineNumber - 1-based source line, for the error message
   * @returns {Object} `{ kind, name, values }`
   */
  function readXychartSeries(kind, remainder, lineNumber) {
    let rest = remainder.trim();
    let name = null;

    const quoted = takeXychartQuoted(rest);
    if (quoted) {
      name = quoted.value;
      rest = quoted.rest;
    }

    const open = rest.indexOf("[");
    const close = rest.lastIndexOf("]");
    if (open === -1 || close < open) {
      throwXychartReaderError(`a ${kind} statement with no value list`, lineNumber);
    }
    if (rest.slice(close + 1).trim() !== "") {
      throwXychartReaderError(`trailing text after a ${kind} value list`, lineNumber);
    }
    const beforeBracket = rest.slice(0, open).trim();
    if (beforeBracket !== "") {
      if (name !== null) {
        throwXychartReaderError(
          `two series names on one ${kind} statement, one quoted and one bare`,
          lineNumber
        );
      }
      name = beforeBracket;
    }

    const values = splitXychartList(rest.slice(open + 1, close)).map((item) => {
      const text = item.trim();
      const value = Number(text);
      if (text === "" || !Number.isFinite(value)) {
        throwXychartReaderError(
          `a ${kind} value the reader cannot read as a number: ${JSON.stringify(text)}`,
          lineNumber
        );
      }
      return value;
    });

    return {
      kind: kind,
      name: name === null ? null : decodePlaceholders(name),
      values: values,
    };
  }

  /**
   * Read the chart's axes, series and orientation out of the diagram SOURCE.
   *
   * Runs ONLY after getDiagramFromText has resolved on the same string, in
   * the same queue slot — see the surface preamble. Titles are NOT read here:
   * `title`, `accTitle` and `accDescr` statements are skipped, because the db
   * delivers those three and delivers them decoded of quoting.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {Object} `{ orientation, xAxis, yAxis, series }`
   */
  function readXychartSource(code) {
    // Encode first, so the shared decodePlaceholders below starts from the
    // same bytes every other surface starts from. See encodeMermaidEntities.
    const encoded = encodeMermaidEntities(
      String(code).split("\r\n").join("\n").split("\r").join("\n")
    );
    const lines = encoded.split("\n");

    let sawHeader = false;
    let inFrontmatter = false;
    let inAccBlock = false;
    let orientation = XYCHART_ORIENTATIONS.VERTICAL;
    let xAxis = null;
    let yAxis = null;
    const series = [];

    for (let i = 0; i < lines.length; i += 1) {
      const lineNumber = i + 1;
      let text = stripXychartComment(lines[i]).trim();

      if (inAccBlock) {
        if (text.indexOf("}") !== -1) {
          inAccBlock = false;
        }
        continue;
      }
      if (text === "") {
        continue;
      }
      // YAML frontmatter is skipped wholesale: whatever it carries, this
      // surface takes its three scalars from the db, never from the source.
      if (!sawHeader && text === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }
      if (text.charAt(text.length - 1) === ";") {
        text = text.slice(0, -1).trim();
      }

      if (!sawHeader) {
        if (!/^xychart-beta\b/.test(text)) {
          throwXychartReaderError(
            "a source that does not open with xychart-beta",
            lineNumber
          );
        }
        const tail = text.slice("xychart-beta".length).trim();
        if (tail === XYCHART_ORIENTATIONS.HORIZONTAL) {
          orientation = XYCHART_ORIENTATIONS.HORIZONTAL;
        } else if (tail !== "" && tail !== XYCHART_ORIENTATIONS.VERTICAL) {
          throwXychartReaderError(
            `an unknown word after xychart-beta: ${JSON.stringify(tail)}`,
            lineNumber
          );
        }
        sawHeader = true;
        continue;
      }

      // The db supplies all three of these; the reader only has to not choke.
      if (/^accDescr\s*\{/.test(text)) {
        inAccBlock = text.indexOf("}") === -1;
        continue;
      }
      if (/^(accTitle|accDescr)\s*:/.test(text)) {
        continue;
      }
      if (/^title\b/.test(text)) {
        continue;
      }

      if (/^x-axis\b/.test(text)) {
        if (xAxis !== null) {
          throwXychartReaderError("a second x-axis statement", lineNumber);
        }
        xAxis = readXychartAxis(text.slice("x-axis".length), true, lineNumber);
        continue;
      }
      if (/^y-axis\b/.test(text)) {
        if (yAxis !== null) {
          throwXychartReaderError("a second y-axis statement", lineNumber);
        }
        const read = readXychartAxis(text.slice("y-axis".length), false, lineNumber);
        yAxis = { title: read.title, min: read.min, max: read.max };
        continue;
      }
      const seriesKeyword = /^(bar|line)\b/.exec(text);
      if (seriesKeyword) {
        series.push(
          readXychartSeries(
            seriesKeyword[1] === XYCHART_SERIES_KINDS.BAR
              ? XYCHART_SERIES_KINDS.BAR
              : XYCHART_SERIES_KINDS.LINE,
            text.slice(seriesKeyword[1].length),
            lineNumber
          )
        );
        continue;
      }

      throwXychartReaderError(
        `a statement the reader does not know: ${JSON.stringify(text.slice(0, 60))}`,
        lineNumber
      );
    }

    if (!sawHeader) {
      throwXychartReaderError("a source with no xychart-beta header at all", null);
    }
    if (series.length === 0) {
      throwXychartReaderError("a chart with no bar or line series", null);
    }

    // AN ABSENT x-axis IS NOT AN ABSENT AXIS. Measured § 6.4: Mermaid
    // silently synthesises a numeric range 1 → N over the data length. It is
    // delivered here as a RANGE axis with NULL bounds rather than with the
    // synthesised 1 and N, because those bounds are the renderer's invention
    // and not the author's declaration — and rule XC2 says a description
    // speaks DECLARED bounds. A generator therefore finds nothing to speak,
    // which is the correct outcome, and the ordinal rule XC6 still applies.
    if (xAxis === null) {
      xAxis = {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: null,
        min: null,
        max: null,
      };
    }

    return {
      orientation: orientation,
      xAxis: xAxis,
      yAxis: yAxis,
      series: series,
    };
  }

  /**
   * Normalise one resolved xychart Diagram instance into the adapter's
   * xychart shape.
   *
   * SAME-TICK SNAPSHOT (the git/sankey singleton defence 1, reaching a third
   * surface): the three scalars below come from Mermaid's CROSS-TYPE shared
   * store, which every parse of every type clears (register item 21), and the
   * xychart db is itself a singleton (grounding § 3.3). They are therefore
   * read here — inside the parse's own .then, behind the queue — and copied
   * into this function's own return object before it returns. Nothing in the
   * delivered chart references a db-owned object, and no consumer may go back
   * to the db later.
   *
   * The axis and series data cannot be lost that way, because it is read from
   * the caller's own string rather than from the db; the source read is done
   * inside the slot anyway, so the whole function is one indivisible unit and
   * a future editor cannot accidentally split the scalars from the rest.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string} code - The caller's raw source, the reader's input
   * @returns {Object} The normalised xychart
   */
  function normaliseXychart(diagram, code) {
    const db = diagram.db;

    // The three shared-store reads, together, first, before anything else can
    // yield. Measured § 5: all three surface on the db and only on the db.
    const rawTitle = db.getDiagramTitle() || "";
    const rawAccTitle = db.getAccTitle() || "";
    const rawAccDescription = db.getAccDescription() || "";

    const read = readXychartSource(code);

    return {
      type: "xychart",
      // ITEM 9, VERDICT C-PH for the drawn text on this surface. Measured
      // § 6.1 on a CATEGORY LABEL: an author's `#quot;` is drawn as a real
      // quote, an author's `&` is drawn as itself, and there is no
      // foreignObject anywhere in an xychart. [OBSERVED]
      //
      // Applying the same verdict to the chart TITLE is an INFERENCE, stated
      // as one: `chart-title` is a `text` element on the same SVG drawing
      // path as `bottom-axis/label` (§ 3.4), so the same treatment follows —
      // but the title itself was not among the strings measured in § 6.1. The
      // test that would settle it is a render of a title carrying `#quot;`,
      // read back as code points; it has not been run.
      //
      // The one DELIBERATE DIVERGENCE FROM THE DRAWING, ruled by the design
      // seat as rule XC9 on 23 August 2026: an author's `<` is drawn by
      // Mermaid 11.6.0 as the literal five characters `&lt;` — a rendering
      // defect visible with none of our code involved — and this surface
      // delivers a real `<` instead, because the description speaks author
      // intent. Re-open trigger: a Mermaid upgrade that changes the drawing.
      title: decodePlaceholders(rawTitle),
      // NO transform on accTitle or accDescr, matching the standing
      // carve-out declared at the placeholder-decoding block near the top of
      // this file. It is deliberate on all six surfaces and must not be
      // "completed" by a later editor.
      accTitle: rawAccTitle,
      accDescr: rawAccDescription,
      orientation: read.orientation,
      xAxis: read.xAxis,
      yAxis: read.yAxis,
      series: read.series,
    };
  }

  /**
   * Parse Mermaid xychart code into the normalised xychart shape.
   *
   * Rejects with Mermaid's own error on a parse failure, and with a distinct
   * Error whose message begins "XY chart source reader" when Mermaid accepted
   * a source the reader's grammar subset cannot read. Both are rejections of
   * the returned promise; the call itself never throws synchronously, so
   * awaiting this promise is the single error path.
   *
   * SERIALISED PARSES: every parse is chained through the adapter-wide queue,
   * so it cannot replace the shared singleton's data or clear the shared
   * accessible-title store while an earlier call's snapshot is still in
   * progress. The chain advances on settlement, not success, so a rejection
   * cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised xychart
   */
  function parseXychart(code) {
    // THE HANG GUARD, AND IT RUNS BEFORE EVERYTHING ELSE — before the memo,
    // before the self-check trigger, before the queue. An `accDescr { ... }`
    // block hangs Mermaid's xychart parser synchronously, and this adapter
    // has no timeout machinery to recover a queue slot from that, so the one
    // safe move is never to queue such a source at all. See
    // findXychartHangingAccBlock for the measurements.
    //
    // It REJECTS rather than throwing, because this function's contract is
    // that it never throws synchronously and awaiting the promise is the
    // single error path. The rejection carries the reader's own error, so a
    // generator awaiting it propagates and the core speaks its
    // generation-failed statement, exactly as for any other refusal.
    const hangingBlockLine = findXychartHangingAccBlock(code);
    if (hangingBlockLine !== null) {
      return Promise.reject(
        buildXychartReaderError(
          "an accDescr block (brace syntax), which Mermaid 11.6.0 cannot " +
            "parse on an xychart at all",
          hangingBlockLine,
          "Mermaid has NOT judged this source: the block form hangs its " +
            "xychart parser synchronously, so the parse was refused before " +
            "it was queued rather than after it was accepted. Use the " +
            "one-line `accDescr:` form, which is fully supported."
        )
      );
    }

    // Lazy xychart self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parses first, so it holds the front
    // of the queue ahead of this call's parse.
    if (!xychartSelfCheckStarted) {
      runXychartSelfCheck();
    }

    if (code === xychartMemoCode && xychartMemoPromise) {
      logDebug("Returning memoised xychart parse for identical code string");
      return xychartMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for why
    // it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `XY chart parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `XY chart parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          // MERMAID HAS NOW JUDGED THE SOURCE VALID. Only here does the
          // reader run, and it runs inside this same slot.
          const chart = normaliseXychart(diagram, code);
          logDebug(
            `XY chart parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `XY chart parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects (see
    // the tail below), but `run` is passed as both handlers so a future change
    // to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    xychartMemoCode = code;
    xychartMemoPromise = result;
    return result;
  }

  /**
   * Parse the two embedded xychart fixtures and assert the db accessor names,
   * the same-tick title snapshot and the source reader's normalised shape.
   * Resolves true on a clean run; on any failure logs ONE ERROR naming the
   * first failed assertion, marks the xychart surface unhealthy, and resolves
   * false. Never throws.
   *
   * BOTH FIXTURES RUN INSIDE ONE QUEUE SLOT, and the band chart is fully
   * normalised BEFORE the range parse is issued. That ordering is the point:
   * the second parse clears the shared title store and rewrites the singleton
   * db, so a check that parsed both and read afterwards would be measuring
   * the second chart twice. One slot rather than two is deliberate — it is
   * strictly stronger isolation, and it keeps the pair indivisible.
   *
   * @returns {Promise<boolean>} Resolves to the xychart health verdict
   */
  function runXychartSelfCheck() {
    if (xychartSelfCheckPromise) {
      return xychartSelfCheckPromise;
    }
    xychartSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            XYCHART_SELF_CHECK_FIXTURE_BAND
          );
        })
        .then((bandDiagram) => {
          const db = bandDiagram.db;
          // The accessor names this surface depends on, read before anything
          // else, so a Mermaid rename fails here rather than delivering "".
          const accessorsPresent =
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function";
          // Fully normalised — including the same-tick scalar snapshot —
          // before the second parse is allowed to begin.
          const band = normaliseXychart(bandDiagram, XYCHART_SELF_CHECK_FIXTURE_BAND);

          return window.mermaid.mermaidAPI
            .getDiagramFromText(XYCHART_SELF_CHECK_FIXTURE_RANGE)
            .then((rangeDiagram) => {
              const range = normaliseXychart(
                rangeDiagram,
                XYCHART_SELF_CHECK_FIXTURE_RANGE
              );

              const bandSeries = band.series[0];
              const rangeSeries = range.series[0];

              // Each entry: [assertion name, predicate]. The first false
              // predicate fails the check and is named in the single ERROR
              // line. The predicates are EVALUATED HERE, inside the slot, so
              // the verdict below never touches a db.
              return [
                [
                  "the three shared-store accessors exist by name on the db",
                  accessorsPresent,
                ],
                [
                  "the band chart's title, accTitle and accDescr survive " +
                    "the same-tick snapshot",
                  band.title === "SelfCheck xychart title" &&
                    band.accTitle === "SelfCheck xychart acc title" &&
                    band.accDescr === "SelfCheck xychart acc descr",
                ],
                [
                  'the band x-axis reads kind "band", its quoted title, and ' +
                    "three categories in source order with quotes stripped",
                  band.xAxis.kind === "band" &&
                    band.xAxis.title === "SelfCheck x title" &&
                    band.xAxis.categories.length === 3 &&
                    band.xAxis.categories[0] === "Alpha" &&
                    band.xAxis.categories[1] === "Bravo two" &&
                    band.xAxis.categories[2] === "Charlie",
                ],
                [
                  "the band y-axis reads its title and its DECLARED bounds 0 " +
                    "and 90 as numbers",
                  band.yAxis !== null &&
                    band.yAxis.title === "SelfCheck y title" &&
                    band.yAxis.min === 0 &&
                    band.yAxis.max === 90,
                ],
                [
                  'the band series reads kind "bar", its quoted name, and its ' +
                    "three values including a decimal, as numbers",
                  band.series.length === 1 &&
                    bandSeries.kind === "bar" &&
                    bandSeries.name === "SelfCheck bar" &&
                    bandSeries.values.length === 3 &&
                    bandSeries.values[0] === 10 &&
                    bandSeries.values[1] === 20.5 &&
                    bandSeries.values[2] === 30,
                ],
                [
                  'orientation defaults to "vertical" with no keyword',
                  band.orientation === "vertical",
                ],
                [
                  'THE BAND/RANGE PIN: the range chart\'s x-axis reads kind ' +
                    '"range" with declared bounds 0 and 100 and NO categories ' +
                    "— the one distinction Mermaid cannot express",
                  range.xAxis.kind === "range" &&
                    range.xAxis.title === "SelfCheck range x" &&
                    range.xAxis.min === 0 &&
                    range.xAxis.max === 100 &&
                    range.xAxis.categories === undefined,
                ],
                [
                  'the range chart\'s series reads kind "line" with a null ' +
                    "name, and its untitled y-axis reads a null title with " +
                    "declared bounds",
                  range.series.length === 1 &&
                    rangeSeries.kind === "line" &&
                    rangeSeries.name === null &&
                    range.yAxis !== null &&
                    range.yAxis.title === null &&
                    range.yAxis.min === 0 &&
                    range.yAxis.max === 40,
                ],
                [
                  "the range chart's own title reaches it, proving the band " +
                    "chart's snapshot was taken before this parse cleared the " +
                    "shared store",
                  range.title === "SelfCheck range title",
                ],
              ];
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    xychartSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `XY chart self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's xychart internals no longer " +
              "match the 22 August 2026 measurements, or the source reader's " +
              "grammar subset has drifted; do not trust xychart adapter output."
          );
          xychartHealthy = false;
          return false;
        }

        logInfo(
          "XY chart self-check passed: accessor, snapshot and source-reader " +
            "assertions all hold"
        );
        xychartHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `XY chart self-check FAILED at assertion: both fixtures parse and read. ` +
            `The fixture run rejected: ${error && error.message}`
        );
        xychartHealthy = false;
        return false;
      });

    return xychartSelfCheckPromise;
  }

  /**
   * Report the xychart surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the xychart self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isXychartHealthy() {
    return xychartHealthy;
  }

  // ---------------------------------------------------------------------
  // Gantt chart surface
  //
  // Parallel to the five STANDARD surfaces above in every structural
  // respect — own single-slot memo, own lazy self-check state, own advisory
  // health flag, every parse-and-read inside one adapterParseQueue slot —
  // and deliberately NOT modelled on the xychart surface beside it. Xychart
  // reads the diagram source because its db delivers no data; the gantt db
  // is measured FULL, so this is an ordinary db-reading surface and there is
  // no source reader here.
  //
  // WHY THIS SURFACE EXISTS. The shipped gantt description module parses the
  // source with its own regexes, and a task line carrying a status flag
  // defeats them: `Research :done, r1, 2026-01-05, 5d` has FOUR metadata
  // fields against a THREE-capture pattern, so the flag becomes the id slot,
  // the real id is read as a timing field, and the date and duration arrive
  // jammed together. Every date in such a chart is lost, and the fixture
  // pinning it passes green while encoding a chart with no dates at all.
  // Measured in docs/mermaid-item-68-arc-open-2026-08-29.md § 3.3. Mermaid's
  // own db parses that line correctly, which is the whole reason for this
  // surface. Register item 68 owns the module rebuild that consumes it.
  //
  // WHAT THE DB DELIVERS, measured 29 August 2026 (arc-open § 3.6) and
  // re-measured directly this session:
  //
  //   - getTasks() returns fully RESOLVED tasks: `id` correct even behind a
  //     status flag, `prevTaskId` carrying the `after` target, and
  //     `startTime` / `endTime` as real Date instances with the dependency
  //     chain already walked.
  //   - `excludes weekends` is applied BY MERMAID: the same 5d task runs
  //     05→10 Jan with no excludes and 05→12 Jan with weekends excluded.
  //     Nothing here recomputes a working-day calendar.
  //   - the four status flags arrive as own keys holding `undefined` when
  //     absent and `true` when set, so every read is an explicit test rather
  //     than a truthiness check.
  //
  // SINGLETON MODE — REASSIGNMENT, LIKE SANKEY, NOT IN-PLACE LIKE GIT.
  // Measured this session, and it is why the snapshot below is shaped as it
  // is. Two parses return the SAME db object; the second installs a NEW
  // tasks array rather than mutating the first's, so the first parse's task
  // objects survive untouched (a tagged object kept its tag and its name),
  // while the db itself then answers with the second diagram's data. So a
  // projection taken at the right moment is durable — exactly sankey's S2e
  // reasoning — and the queue is what guarantees the right moment.
  //
  // EAGER SNAPSHOT (defence 1) IS REQUIRED, and the check that settles it:
  // getTasks() and getSections() return the SAME array reference, holding
  // the SAME element references, on repeated calls within one parse — they
  // are NOT freshly built per call the way sankey's getGraph() projection
  // is. So every value is copied into the adapter's own objects here, inside
  // the parse's own .then, behind the queue, and no consumer may ever go
  // back to the db afterwards.
  //
  // DATES ARE COPIED, NOT ALIASED, and that is not tidiness. Measured: a
  // dependent task's `startTime` IS THE SAME Date OBJECT as its
  // predecessor's `endTime`. Delivering those references would hand two
  // tasks one shared mutable Date, so a consumer normalising one task's date
  // in place would silently move another's. Every date below is a new Date.
  //
  // ITEM 9, VERDICT C-PLACEHOLDER — decodePlaceholders, MEASURED FOR THIS
  // TYPE rather than copied from another. The discriminator is where Mermaid
  // draws the label, and the gantt renderer draws every label into SVG
  // <text>: foreignObject count is ZERO on both a plain and a hostile
  // render, with the title, the section name and the task names all in
  // <text> nodes. A hostile source was then round-tripped: the db delivers
  // `Task <placeholder>one<placeholder> &amp; two` holding Mermaid's private
  // delimiter bytes, and the canvas DRAWS `Task "one" &amp; two` — the
  // placeholder resolved, the author's own `&amp;` drawn literally. Applying
  // both candidate transforms to the delivered bytes, decodePlaceholders
  // reproduces the drawn string exactly on the title, the section and the
  // task name, and decodeAuthorText differs on all three. Gantt therefore
  // sits with git graph, not with flowchart / ER / class.
  //
  // accTitle AND accDescr ARE POPULATED ON THIS TYPE, unlike ER and class
  // which deliver them permanently empty. Measured: `accTitle:` and
  // `accDescr:` both round-trip. They are still delivered with NO transform,
  // per the standing carve-out at the top of this file — clause X3 owns
  // author override and reads the raw source.
  //
  // The `title` body form wins over a frontmatter title, measured: a source
  // carrying both delivers the body form.
  //
  // Field sources and the three verbatim deliveries are in
  // docs/mermaid-item-68-gantt-surface-2026-08-29.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the gantt surface, matching parse()'s contract: the
  // promise is cached rather than the resolved value. The memo sits IN FRONT
  // of the parse queue — an identical-code call returns the cached promise
  // without enqueueing a second singleton replacement.
  let ganttMemoCode = null;
  let ganttMemoPromise = null;

  // Gantt self-check health: null until the check has run, then true or
  // false. Independent of the other six flags by design.
  let ganttHealthy = null;

  // Lazy, memoised, first-parseGantt trigger — same reasoning as the other
  // six self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let ganttSelfCheckStarted = false;
  let ganttSelfCheckPromise = null;

  /**
   * The embedded gantt self-check fixture. Two tasks are enough to pin
   * everything this surface depends on.
   *
   * The FIRST task is deliberately a FOUR-FIELD line carrying a status flag
   * (`:done, s1, 2026-01-05, 5d`). That is the exact shape the shipped
   * module's regexes mis-split, and pinning it here is the point of the
   * surface: if a Mermaid upgrade ever started reading the flag as the id,
   * this check fails loudly instead of the surface quietly delivering the
   * same wrong answer the regex parser does.
   *
   * The THIRD task pins `after` dependency resolution AND the distinction
   * between the dependency and Mermaid's `prevTaskId`: it depends on the
   * FIRST task while the SECOND is the one declared before it, so a reading
   * that confused the two would fail here. That confusion is not
   * hypothetical — this surface shipped it for one draft.
   */
  const GANTT_SELF_CHECK_FIXTURE = [
    "gantt",
    "    title Adapter self check",
    "    accTitle: Self check accessible title",
    "    dateFormat YYYY-MM-DD",
    "    section Alpha",
    "    First :done, s1, 2026-01-05, 5d",
    "    Second :s2, 2026-02-01, 2d",
    "    Third :s3, after s1, 3d",
  ].join("\n");

  /**
   * One day in milliseconds, for the duration assertion in the self-check.
   */
  const GANTT_MS_PER_DAY = 86400000;

  /**
   * An `after` dependency clause, matched case-insensitively on the keyword.
   */
  const GANTT_AFTER_CLAUSE = /^after\s+/i;

  /**
   * An `until` clause in the end slot.
   */
  const GANTT_UNTIL_CLAUSE = /^until\s+/i;

  /**
   * The task's START declaration, verbatim as the author wrote it — a date
   * string, or an `after ...` clause.
   * @param {Object} task - The db's task object
   * @returns {string} The declaration, or "" when absent
   */
  function ganttStartDeclaration(task) {
    const start = task && task.raw ? task.raw.startTime : null;
    return start && typeof start.startData === "string" ? start.startData : "";
  }

  /**
   * The task's END declaration, verbatim — a duration such as "5d", an
   * explicit end date, or an `until ...` clause.
   * @param {Object} task - The db's task object
   * @returns {string} The declaration, or "" when absent
   */
  function ganttEndDeclaration(task) {
    const end = task && task.raw ? task.raw.endTime : null;
    return end && typeof end.data === "string" ? end.data : "";
  }

  /**
   * The ids a task's `after` clause names, in the order written.
   *
   * THIS IS NOT prevTaskId, and the difference is the trap this helper
   * exists to close. MEASURED 29 August 2026: `prevTaskId` is the task
   * declared immediately BEFORE this one, unconditionally — a task with an
   * absolute start date and no dependency at all still carries one, and a
   * task written `after a` two positions later reports `b`. Mermaid resolves
   * the real dependency into startTime and keeps the clause only in
   * raw.startTime.startData, which is what this reads.
   *
   * Mermaid accepts several targets (`after a b`) and starts the task after
   * the LATEST of them, so this returns every id rather than the first.
   *
   * @param {Object} task - The db's task object
   * @returns {string[]} The dependency ids, empty when the start is a date
   */
  function ganttDependencies(task) {
    const declaration = ganttStartDeclaration(task);
    if (!GANTT_AFTER_CLAUSE.test(declaration)) {
      return [];
    }
    return declaration
      .replace(GANTT_AFTER_CLAUSE, "")
      .split(/\s+/)
      .filter((id) => id !== "");
  }

  /**
   * The id an `until` clause names, or null.
   * @param {Object} task - The db's task object
   * @returns {string|null} The target id, or null when the end is not an
   *   `until` clause
   */
  function ganttUntilTarget(task) {
    const declaration = ganttEndDeclaration(task);
    if (!GANTT_UNTIL_CLAUSE.test(declaration)) {
      return null;
    }
    const target = declaration.replace(GANTT_UNTIL_CLAUSE, "").trim();
    return target === "" ? null : target;
  }

  /**
   * Copy a db-owned Date into an adapter-owned one, or null.
   *
   * Never returns the db's own object: a dependent task's startTime is the
   * SAME Date instance as its predecessor's endTime (measured), so passing
   * references through would share one mutable date between two delivered
   * tasks. An unparseable date arrives as an Invalid Date rather than as
   * null, and is normalised to null here so a consumer has one absent case
   * to test rather than two.
   *
   * @param {*} value - The db's date value
   * @returns {Date|null} An adapter-owned Date, or null when absent/invalid
   */
  function copyGanttDate(value) {
    if (!(value instanceof Date)) {
      return null;
    }
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time);
  }

  /**
   * Normalise one resolved gantt Diagram instance into the adapter's gantt
   * shape.
   *
   * EAGER SNAPSHOT (defence 1): getTasks() and getSections() hand back the
   * db's own arrays holding the db's own objects — the same references on
   * every call — and the next gantt parse replaces them. Both are therefore
   * read ONCE here, inside the parse's own .then and behind the queue, and
   * mapped into the adapter's own objects immediately. Nothing in the
   * returned shape references a db-owned object, dates included.
   *
   * The three shared-store scalars (title, accTitle, accDescr) are read in
   * this same slot, per register item 21: they live in Mermaid's cross-type
   * common db, which EVERY parse of EVERY type clears.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised gantt chart
   */
  function normaliseGantt(diagram) {
    const db = diagram.db;

    // The two data reads. Everything below maps these.
    const rawTasks = Array.isArray(db.getTasks()) ? db.getTasks() : [];
    const rawSections = Array.isArray(db.getSections()) ? db.getSections() : [];

    const tasks = rawTasks.map((task) => ({
      // ITEM 9, VERDICT C-PLACEHOLDER — see the section header.
      //
      // TRIMMED, ruled 29 August 2026, reversing this surface's first
      // draft. Mermaid's grammar captures everything up to the colon, so
      // `Task :id` delivers "Task " and `Task:id` delivers "Task" —
      // measured, and the difference is the author's SEPARATOR spacing
      // rather than content they chose. Left untrimmed, every consumer
      // would have to strip it before interpolating or emit
      // "Research , which starts on ...", and the gold targets
      // (docs/mermaid-gantt-gold-targets-2026-08-29.md) are authored
      // against trimmed names.
      //
      // TRIMMED AFTER THE DECODE, not before: an author-encoded space
      // reaches the db as placeholder bytes and only becomes whitespace
      // once decoded, so trimming first would leave it behind.
      //
      // PER-TYPE BY RULE. This trim belongs to the gantt surface alone;
      // the other six deliver their author text untouched. The adapter
      // decides delivery per type on measurement and does not generalise
      // one surface's normalisation across the rest.
      name: decodePlaceholders(
        typeof task.task === "string" ? task.task : ""
      ).trim(),

      // The id survives a leading status flag — the defect this surface
      // exists to route around. Absent ids arrive as undefined; normalised
      // to null so a consumer has one absent case.
      id: typeof task.id === "string" ? task.id : null,

      section: decodePlaceholders(
        typeof task.section === "string" ? task.section : ""
      ),

      // Creation order across the whole chart, not within a section.
      order: typeof task.order === "number" ? task.order : null,

      // AN AUTO-GENERATED ID IS NOT AUTHOR TEXT. A task written without one
      // still receives an id — measured: an id-less task is delivered as
      // `task1`. The test is exact rather than a pattern match: Mermaid keeps
      // the author's own metadata verbatim in raw.data, so an id the author
      // wrote appears there and a generated one does not. A description that
      // said "task task1" would be quoting the parser to the reader.
      hasGeneratedId:
        typeof task.id === "string" &&
        !(
          task.raw &&
          typeof task.raw.data === "string" &&
          task.raw.data.indexOf(task.id) !== -1
        ),

      // The author's own start and end clauses, verbatim. Delivered raw
      // because Mermaid keeps no parsed form of them and the narration layer
      // owns how a duration or an explicit end date should read.
      startDeclaration: ganttStartDeclaration(task),
      endDeclaration: ganttEndDeclaration(task),

      // The REAL dependency, from the `after` clause — NOT prevTaskId, which
      // is declaration order (see ganttDependencies). An array because
      // Mermaid accepts several targets and starts after the latest.
      dependsOn: ganttDependencies(task),

      // The `until` target, which ends a task at another task rather than
      // after a duration.
      untilTaskId: ganttUntilTarget(task),

      startDate: copyGanttDate(task.startTime),
      endDate: copyGanttDate(task.endTime),

      // The four status flags are own keys holding `undefined` when unset,
      // so each is an explicit === true rather than a truthiness test, and
      // each is delivered as a real boolean.
      isDone: task.done === true,
      isActive: task.active === true,
      isCritical: task.crit === true,
      isMilestone: task.milestone === true,
    }));

    return {
      type: "gantt",

      // Gantt accepts the body `title` form, and it WINS over a frontmatter
      // title (measured). This is the third type after git graph and xychart
      // whose title genuinely carries data.
      title: decodePlaceholders(db.getDiagramTitle()),

      // NO transform on either, per the standing carve-out: clause X3 owns
      // author override and reads the raw source. Unlike ER and class these
      // are genuinely POPULATED on this type, so they are delivered rather
      // than omitted.
      accTitle: db.getAccTitle(),
      accDescr: db.getAccDescription(),

      // The author's declared date format, which the description names.
      dateFormat: db.getDateFormat(),

      // The day the working week starts. It is not decoration: it decides
      // WHICH days `excludes weekends` actually removes, so a description
      // naming Saturday and Sunday is wrong on a chart declaring
      // `weekday monday`.
      weekday: db.getWeekday(),

      // Copied into adapter-owned arrays for the same reason the tasks are.
      excludes: Array.isArray(db.getExcludes()) ? [...db.getExcludes()] : [],
      includes: Array.isArray(db.getIncludes()) ? [...db.getIncludes()] : [],

      sections: rawSections.map((section) =>
        decodePlaceholders(typeof section === "string" ? section : "")
      ),

      tasks: tasks,
    };
  }

  /**
   * Parse Mermaid gantt code into the normalised gantt shape.
   *
   * Rejects with Mermaid's own error on a parse failure. The call itself
   * never throws synchronously, so awaiting this promise is the single error
   * path.
   *
   * SERIALISED PARSES (adapter-wide since register item 21): every parse is
   * chained through the queue so it cannot replace the shared singleton's
   * data while an earlier call's snapshot is still in progress, and so the
   * three shared-store scalars are read before another parse can clear them.
   * The chain advances on settlement, not success, so a rejection cannot
   * wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised gantt chart
   */
  function parseGantt(code) {
    // Lazy gantt self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parse first, so it holds the front
    // of the queue ahead of this call's parse.
    if (!ganttSelfCheckStarted) {
      runGanttSelfCheck();
    }

    if (code === ganttMemoCode && ganttMemoPromise) {
      logDebug("Returning memoised gantt parse for identical code string");
      return ganttMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Gantt parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Gantt parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const chart = normaliseGantt(diagram);
          logDebug(
            `Gantt parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `Gantt parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    ganttMemoCode = code;
    ganttMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded gantt fixture and assert the db accessor names and
   * field shapes the gantt surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the gantt surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other six health flags.
   *
   * Like the ER, class, git, sankey and xychart checks, this resolves the
   * Diagram itself rather than going through parseGantt(): its assertions
   * are deliberately about the RAW db internals the normalised shape exists
   * to hide — above all THE FOUR-FIELD PIN, so a Mermaid upgrade that
   * started mis-splitting a flagged task line would fail here rather than
   * letting this surface deliver the same wrong answer the regex parser it
   * replaces already delivers.
   *
   * The fixture parse goes through the parse QUEUE: a direct unqueued
   * getDiagramFromText call could replace the singleton db's data
   * mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * NO ABSOLUTE CALENDAR DATE IS ASSERTED, deliberately — though NOT for
   * the reason this comment first gave, which was inverted.
   *
   * MEASURED 29 August 2026: Mermaid builds these Dates at LOCAL midnight,
   * NOT at UTC midnight. The consequence runs the opposite way to the
   * original claim — getDate() is the SAFE accessor and toISOString() is
   * the unsafe one, because from 29 March 2026 British Summer Time puts
   * local midnight at 23:00 UTC the previous day, so a UTC read reports
   * every date one day early. That silently invalidated a first-pass
   * derivation of the gold targets before it was caught.
   *
   * The assertions below are UNCHANGED and were measured sound: they use
   * only differences and identities, which hold in any zone, and the
   * day-count is rounded so a DST boundary inside a span cannot fail it.
   * An absolute-date assertion is still avoided, because it would pin this
   * check to the machine's own zone for no gain.
   *
   * @returns {Promise<boolean>} Resolves to the gantt health verdict
   */
  function runGanttSelfCheck() {
    if (ganttSelfCheckPromise) {
      return ganttSelfCheckPromise;
    }
    ganttSelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read — the structural form of the queue's invariant.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            GANTT_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done.
          const tasks = Array.isArray(db.getTasks()) ? db.getTasks() : [];
          const sections = Array.isArray(db.getSections())
            ? db.getSections()
            : [];
          const first = tasks[0];
          const second = tasks[1];
          const third = tasks[2];

          // The freshness pin below needs a second read of the same accessor.
          const tasksAgain = db.getTasks();

          const title = db.getDiagramTitle();
          const accTitle = db.getAccTitle();

          // Each entry: [assertion name, predicate]. The first false
          // predicate fails the check and is named in the single ERROR line.
          // The predicates are EVALUATED HERE, inside the slot, so the
          // verdict below never touches the db.
          return [
            [
              'getSections returns ["Alpha"] and getTasks returns three tasks',
              sections.length === 1 &&
                sections[0] === "Alpha" &&
                tasks.length === 3 &&
                !!first &&
                !!second &&
                !!third,
            ],
            [
              "THE FOUR-FIELD PIN: a task line written `:done, s1, <date>, 5d` " +
                'delivers id "s1" with done true — the flag is NOT read as the id',
              !!first && first.id === "s1" && first.done === true,
            ],
            [
              "an unset status flag is an own key holding undefined, not false",
              !!second &&
                Object.prototype.hasOwnProperty.call(second, "done") &&
                second.done === undefined,
            ],
            [
              "startTime and endTime are real Date instances spanning the " +
                "declared 5d duration",
              !!first &&
                first.startTime instanceof Date &&
                first.endTime instanceof Date &&
                !Number.isNaN(first.startTime.getTime()) &&
                !Number.isNaN(first.endTime.getTime()) &&
                Math.round(
                  (first.endTime.getTime() - first.startTime.getTime()) /
                    GANTT_MS_PER_DAY
                ) === 5,
            ],
            [
              "the `after` dependency is RESOLVED: the third task declares " +
                '`after s1` and starts exactly where the first task ends',
              !!third &&
                third.raw &&
                third.raw.startTime &&
                third.raw.startTime.startData === "after s1" &&
                third.startTime instanceof Date &&
                third.startTime.getTime() === first.endTime.getTime(),
            ],
            [
              "THE DEPENDENCY/ORDER PIN: prevTaskId is the task declared " +
                'BEFORE this one ("s2"), NOT the `after` target ("s1") — the ' +
                "two are different fields and this fixture separates them",
              !!third && third.prevTaskId === "s2",
            ],
            [
              "THE ALIASING PIN: a dependent task's startTime is the SAME Date " +
                "object as its dependency's endTime, so the surface must copy",
              !!third && third.startTime === first.endTime,
            ],
            [
              "THE FRESHNESS PIN: getTasks returns the db's OWN array, the same " +
                "reference on a second call, so an eager snapshot is required",
              tasksAgain === tasks,
            ],
            [
              "the body `title` form and `accTitle:` both populate on this type",
              title === "Adapter self check" &&
                accTitle === "Self check accessible title",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    ganttSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Gantt self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's gantt parse internals no longer " +
              "match the measurements this surface was built on; do not " +
              "trust gantt adapter output."
          );
          ganttHealthy = false;
          return false;
        }

        logInfo(
          "Gantt self-check passed: all accessor and field-shape assertions hold"
        );
        ganttHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Gantt self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        ganttHealthy = false;
        return false;
      });

    return ganttSelfCheckPromise;
  }

  /**
   * Report the gantt surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the gantt self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isGanttHealthy() {
    return ganttHealthy;
  }

  // ---------------------------------------------------------------------
  // Quadrant chart surface
  //
  // THE EIGHTH PER-TYPE SURFACE, and the second HYBRID one after xychart:
  // three scalars from Mermaid's db, everything else from a reader over the
  // author's own source. The split is a design-seat ruling of 1 September
  // 2026, and it rests on one measurement — Mermaid's quadrant db delivers
  // NO AUTHORED COORDINATE. `getQuadrantData().points` carries laid-out
  // PIXELS: an author's `[0.25, 0.85]` arrives as `{ x: 147, y: 108.6 }`,
  // after a layout that reserves a title band when a title is present and
  // does not when it is absent.
  //
  // The authored pair IS arithmetically recoverable from those pixels plus
  // the delivered quadrant rectangles — eight of eight exact to four decimal
  // places, measured in
  // docs/mermaid-item-69-quadrant-grounding-2026-09-01.md § B3.4a — and this
  // surface DELIBERATELY DOES NOT DO THAT. Recovering an author's number by
  // inverting a private layout is the same class of mistake as reading a
  // title off a rendered SVG (register item 67): the float noise needs an
  // arbitrary rounding decision nobody has authority to take on the author's
  // behalf, the plot rectangle changes shape with the title, and the
  // transform is Mermaid's layout code rather than a published contract, so
  // any release can move every recovered figure with no gate of ours
  // noticing. A description that states "coordinates [0.25, 0.85]" as fact
  // must not compute that number from a picture.
  //
  // WHAT THE DB IS USED FOR INSTEAD. The pixels, the positional axis-label
  // array and the quadrant rectangles are read in the SAME SLOT and
  // delivered under `crossCheck`, which is CORROBORATION MATERIAL AND NEVER
  // NARRATION. A consumer that speaks a crossCheck value is using the wrong
  // field; its purpose is to let a gate assert that the source read and the
  // canvas agree, which is the one thing a source reader cannot prove about
  // itself.
  //
  // MERMAID IS STILL THE JUDGE OF VALIDITY, exactly as on the xychart
  // surface: the reader runs ONLY after getDiagramFromText has resolved, in
  // the same queue slot, so this surface can never narrate a source Mermaid
  // rejected. The reader is a second opinion about CONTENT, never a first
  // opinion about legality.
  //
  // THE READER'S FAILURE CONTRACT. A point line the reader cannot parse is a
  // STOP: it throws an Error whose message begins
  // QUADRANT_READER_ERROR_PREFIX and NAMES THE LINE. It never guesses, never
  // partially fills the shape, and above all NEVER SILENTLY DROPS A POINT.
  // That last clause is the defect this surface exists to remove: the
  // shipped module's point regex cannot match Mermaid's own `Name:::class:`
  // syntax, so a three-point chart is narrated as "1 data point" with two of
  // the author's points invisible and nothing said about the loss
  // (grounding § B2.7, measured in both directions).
  //
  // WHY THE SINGLETON DEFENCES APPLY, and here they are STRONGER than on any
  // earlier surface. Measured (grounding § B3.4f): the quadrant db is a
  // shared singleton whose object identity is the same across every parse on
  // a page, and a second parse replaces the FIRST diagram's ENTIRE payload —
  // points, axis labels and quadrant labels, not merely the three scalars
  // register item 21 is about. Re-reading a stale Diagram handle after a
  // second parse returns the second chart's data in full, and the handle
  // looks live. So every db read below happens inside the parse's own .then,
  // behind the queue, and the whole normalise is one indivisible unit.
  //
  // The source-read half cannot be lost that way, because it is read from
  // the caller's own string — but the crossCheck half can, and it is exactly
  // the half a gate would trust.
  //
  // DECODE — measured 1 September 2026, and the answer is SPLIT. Recorded as
  // the ruling on open question OQ1.
  //
  //   Point names, axis end labels and quadrant labels: NO DECODE, because
  //   no escape can reach them. Mermaid's quadrant lexer REJECTS `#quot;`
  //   and `#35;` outright in all three positions ("Unrecognized text", and
  //   the error text shows the placeholder bytes, so encodeEntities ran
  //   first and the lexer then refused its own delimiters); it rejects a
  //   bare `"` with a parse error; and it rejects a pre-escaped `&lt;`. The
  //   one character that does get through is a bare `&`, and it is delivered
  //   and DRAWN as itself, untransformed. So there is nothing to decode, and
  //   a decode call here would be dead code no fixture could ever redden.
  //
  //   `title`: DECODED with decodePlaceholders, item 9 verdict C-PLACEHOLDER,
  //   [OBSERVED] on all four routes rather than inferred from a sibling
  //   surface. The title statement is a DIFFERENT lexer path from the three
  //   above and does accept escapes. Author `#quot;` reaches the db as
  //   placeholder bytes and is drawn as `"`; `#35;` is drawn as `#`; a bare
  //   `&` is drawn as itself; a pre-escaped `&lt;` is drawn as the literal
  //   six characters. decodePlaceholders reproduces the drawing in all four,
  //   and the quadrant SVG has ZERO foreignObjects, so the SVG-text verdict
  //   is the right one.
  //
  //   `accTitle` / `accDescr`: NO TRANSFORM, matching the standing carve-out
  //   on all seven earlier surfaces. They accept escapes and deliver
  //   placeholder bytes, and that is deliberately left alone here.
  //
  // NO HANG GUARD, and its absence is measured rather than assumed. The
  // `accDescr { ... }` block form that hangs Mermaid 11.6.0's xychart parser
  // parses cleanly on a quadrant chart in about a second and delivers its
  // text correctly (grounding § B4, re-confirmed this session as grammar
  // case G25). Register item 47 is unchanged; its blast radius simply does
  // not reach this type.
  //
  // Field sources, the grammar census and three verbatim deliveries are in
  // docs/mermaid-item-69-quadrant-surface-2026-09-01.md.
  // ---------------------------------------------------------------------

  // Every reader refusal carries this prefix, so a consumer can tell "our
  // subset lags Mermaid's grammar" from "Mermaid rejected the source"
  // without string-matching on Mermaid's own error text.
  const QUADRANT_READER_ERROR_PREFIX = "Quadrant chart source reader";

  // Stated as a PRECONDITION rather than as decoration: every refusal raised
  // from readQuadrantSource happens inside `getDiagramFromText(...).then`,
  // so Mermaid has already judged the source valid by the time it is
  // reached. This surface has no pre-parse refusal, so unlike xychart there
  // is no second tail.
  const QUADRANT_READER_ERROR_TAIL =
    "Mermaid accepted this source, so the reader's grammar subset lags " +
    "Mermaid's own; the diagram must fall back rather than be described " +
    "from a partial read.";

  // THE POINT LINE, and every branch of it was measured against Mermaid's
  // own parser on 1 September 2026 rather than copied from the shipped
  // module, whose equivalent pattern is the defect this surface replaces.
  //
  //   name        either a double-quoted string, or a bare run with NO
  //               colon in it. Bare is safe because Mermaid REJECTS a colon
  //               inside an unquoted point name (measured), so `[^:]*`
  //               cannot swallow the separator.
  //   :::class    Mermaid's class syntax, OPTIONAL. The class name itself is
  //               read and discarded — see readQuadrantSource for why it is
  //               matched at all rather than ignored.
  //   [x, y]      unsigned integer or decimal, both captured as the
  //               AUTHOR'S OWN STRING. Mermaid rejects a negative, a value
  //               above 1 and a bare `.5`, so this character class is
  //               exactly its accepted set.
  //   rest        trailing style pairs, accepted and discarded; this surface
  //               delivers no styling.
  //
  // Anchored at BOTH ends, so trailing text cannot be silently discarded
  // (AGENTS.md § Diagnosis Discipline — verify the exact variant the prose
  // names).
  const QUADRANT_POINT_LINE =
    /^(?:"([^"]*)"|([^:]*))(?::::([^:\s]+))?\s*:\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]\s*(.*)$/;

  // The four quadrant statements, `quadrant-1` to `quadrant-4`. Case is
  // Mermaid's own: measured, the axis keywords accept any case (`X-AXIS`
  // parses), so every keyword test here is case-insensitive to match.
  const QUADRANT_LABEL_LINE = /^quadrant-([1-4])\b\s*(.*)$/i;

  // Mermaid draws the arrow as `-->` in source. A dangling `x-axis Low -->`
  // is ACCEPTED by the grammar and delivered by the db as a single label
  // reading "Low ⟶" — the arrow glyph survives into the label text. Split
  // on the source spelling and the author's declaration is recovered
  // correctly; see readQuadrantAxis.
  const QUADRANT_AXIS_ARROW = "-->";

  // Single-slot memo, matching every other surface's contract: the PROMISE
  // is cached, not the resolved value, and the memo sits IN FRONT of the
  // parse queue so an identical-code call never enqueues a second singleton
  // replacement.
  let quadrantMemoCode = null;
  let quadrantMemoPromise = null;

  // Quadrant self-check health: null until the check has run, then true or
  // false. Independent of the other seven flags by design.
  let quadrantHealthy = null;

  // Lazy, memoised, first-parseQuadrant trigger — same reasoning as the
  // other seven self-checks: Mermaid's diagram detectors are not registered
  // at script-evaluation time, so an eager check reports a false failure.
  let quadrantSelfCheckStarted = false;
  let quadrantSelfCheckPromise = null;

  /**
   * Full self-check fixture: a title, both accessible fields, both axes with
   * arrows, all four quadrant labels, and three points.
   *
   * The THIRD point is written `Gamma:::big:` and there is a `classDef` line
   * below it. That is the whole reason this fixture exists in this shape: it
   * is the exact construct the shipped module's regex drops in silence, so
   * if a Mermaid upgrade ever changed the class syntax this check fails
   * loudly instead of the surface quietly losing a point the way the parser
   * it replaces already does.
   *
   * The SECOND point carries trailing inline styling, so the reader's
   * discard-the-rest branch is exercised rather than assumed.
   *
   * ASCII only, and every label distinctive, so a cross-delivery from
   * another diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_FULL = [
    "quadrantChart",
    "    title SelfCheck quadrant title",
    "    accTitle: SelfCheck quadrant acc title",
    "    accDescr: SelfCheck quadrant acc descr",
    "    x-axis SelfCheck low x --> SelfCheck high x",
    "    y-axis SelfCheck low y --> SelfCheck high y",
    "    quadrant-1 SelfCheck q one",
    "    quadrant-2 SelfCheck q two",
    "    quadrant-3 SelfCheck q three",
    "    quadrant-4 SelfCheck q four",
    "    Alpha point: [0.25, 0.85]",
    "    Beta point: [0.80, 0.30] radius: 12, color: #ff0000",
    "    Gamma point:::big: [0.5, 0.5]",
    "    classDef big radius: 15, stroke-width: 3px",
  ].join("\n");

  /**
   * Small self-check fixture: two points, no title, no quadrant labels, no
   * accessible fields.
   *
   * Two fixtures rather than one because the second is what proves the
   * FIRST one's scalars were snapshotted before it ran — the quadrant db is
   * a measured singleton whose second parse replaces the first chart's whole
   * payload, so a check that parsed both and read afterwards would be
   * measuring the second chart twice. It also pins the absent cases: an
   * unlabelled quadrant is delivered as "" rather than omitted, and an
   * absent title is "" rather than null.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_SMALL = [
    "quadrantChart",
    "    x-axis SelfCheck small low --> SelfCheck small high",
    "    y-axis SelfCheck small bottom --> SelfCheck small top",
    "    Quick win: [0.2, 0.8]",
    "    Long haul: [0.8, 0.3]",
  ].join("\n");

  /**
   * Single-label self-check fixture: an x-axis written with NO arrow beside a
   * y-axis written with one.
   *
   * A third fixture rather than a flag on the second, because the distinction
   * it pins is a RULING and not a shape detail. Gold rule R6 says a
   * single-label axis is an axis TITLE and must never be narrated as though
   * the author had declared a polarity, so this surface delivers such a label
   * in its own field with both ends left empty. Mixing the two forms in one
   * chart is what makes the fixture bite: a reader that filled `left` from
   * either form would pass on a chart carrying only one of them.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL = [
    "quadrantChart",
    "    x-axis SelfCheck lone x",
    "    y-axis SelfCheck lone low y --> SelfCheck lone high y",
    "    Lone point: [0.7, 0.2]",
  ].join("\n");

  /**
   * Build (never throw) the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   * @returns {Error} The reader error
   */
  function buildQuadrantReaderError(detail, lineNumber) {
    const where =
      typeof lineNumber === "number" ? ` at source line ${lineNumber}` : "";
    return new Error(
      `${QUADRANT_READER_ERROR_PREFIX}: ${detail}${where}. ` +
        QUADRANT_READER_ERROR_TAIL
    );
  }

  /**
   * Throw the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   */
  function throwQuadrantReaderError(detail, lineNumber) {
    throw buildQuadrantReaderError(detail, lineNumber);
  }

  /**
   * Remove a trailing `%%` comment, ignoring one that falls inside quotes.
   *
   * Quote-awareness is not decoration: a quoted point name is legal
   * (measured — `"Alpha Beta": [0.2, 0.7]` parses and delivers the name with
   * the quotes stripped), so a name could contain the comment marker.
   *
   * @param {string} line - One source line
   * @returns {string} The line with any comment removed
   */
  function stripQuadrantComment(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const character = line.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && character === "%" && line.charAt(i + 1) === "%") {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Read one axis statement's remainder into its end labels.
   *
   * Mermaid accepts three forms, all measured, and THEY ARE NOT THE SAME
   * DECLARATION:
   *
   *   `Low --> High`   two ends, a polarity the author stated.
   *   `Effort`         ONE LABEL AND NO POLARITY — an axis title. Mermaid
   *                    happens to draw it at the low end of the axis, but
   *                    that is a rendering choice, not something the author
   *                    said.
   *   `Low -->`        a dangling arrow: a low end declared and a high end
   *                    left empty. The db obscures this by delivering the
   *                    single label "Low ⟶", arrow glyph included; splitting
   *                    the author's own source on `-->` recovers it.
   *
   * THE SINGLE LABEL IS DELIVERED IN ITS OWN FIELD, NOT AS `low`, and that
   * is gold rule R6 rather than a preference: R6 rules that a single-label
   * axis narrates as `The x-axis is labelled "LABEL"` and explicitly REJECTS
   * "treating the single label as the left end and leaving the right end
   * blank", because doing so fabricates a polarity the author never wrote.
   * Delivering it as `low` would put the fabrication one step from every
   * consumer and would ALSO make it indistinguishable from the dangling-arrow
   * form, which really does declare a low end.
   *
   * @param {string} remainder - Everything after the axis keyword
   * @param {number} lineNumber - 1-based source line, for a refusal
   * @returns {Object} `{ low, high, label }`, each a string, "" when
   *   undeclared. `label` is non-empty ONLY for the single-label form, and
   *   `low`/`high` are both "" in that case.
   */
  function readQuadrantAxis(remainder, lineNumber) {
    const parts = String(remainder).split(QUADRANT_AXIS_ARROW);
    if (parts.length > 2) {
      throwQuadrantReaderError(
        `an axis statement with more than one ${QUADRANT_AXIS_ARROW} in it`,
        lineNumber
      );
    }
    if (parts.length === 1) {
      return { low: "", high: "", label: parts[0].trim() };
    }
    return {
      low: parts[0].trim(),
      high: parts[1].trim(),
      label: "",
    };
  }

  /**
   * Read the chart's axes, quadrant labels and points out of the diagram
   * SOURCE.
   *
   * Runs ONLY after getDiagramFromText has resolved on the same string, in
   * the same queue slot — see the surface preamble. `title`, `accTitle` and
   * `accDescr` statements are SKIPPED, because the db delivers those three
   * and is the better source for them.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {Object} `{ xAxis, yAxis, quadrants, points }`
   */
  function readQuadrantSource(code) {
    // No encode step, unlike xychart. That surface must reproduce Mermaid's
    // encodeEntities over the raw source so its reader starts from the same
    // bytes the db would have delivered — but here the three fields the
    // reader owns cannot carry an escape at all: the lexer refuses `#word;`
    // in a point name, an axis label and a quadrant label alike (measured).
    // Encoding would therefore transform nothing, and the decode that
    // followed it would be dead code.
    const lines = String(code)
      .split("\r\n")
      .join("\n")
      .split("\r")
      .join("\n")
      .split("\n");

    let sawHeader = false;
    let inFrontmatter = false;
    let inAccBlock = false;
    let xAxis = null;
    let yAxis = null;
    const quadrants = ["", "", "", ""];
    const points = [];

    for (let i = 0; i < lines.length; i += 1) {
      const lineNumber = i + 1;
      let text = stripQuadrantComment(lines[i]).trim();

      if (inAccBlock) {
        if (text.indexOf("}") !== -1) {
          inAccBlock = false;
        }
        continue;
      }
      if (text === "") {
        continue;
      }
      // YAML frontmatter is skipped wholesale. Measured, and worth stating
      // because it is a real delivery limit rather than a shortcut: a
      // frontmatter `title:` does NOT reach getDiagramTitle on this type,
      // exactly as on flowchart, ER and class, so there is nothing here for
      // either half of the surface to read. Only the body `title` form
      // carries a title.
      if (!sawHeader && text === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }
      if (text.charAt(text.length - 1) === ";") {
        text = text.slice(0, -1).trim();
      }

      if (!sawHeader) {
        if (!/^quadrantChart\b/i.test(text)) {
          throwQuadrantReaderError(
            "a source that does not open with quadrantChart",
            lineNumber
          );
        }
        const tail = text.slice("quadrantChart".length).trim();
        if (tail !== "") {
          throwQuadrantReaderError(
            `an unknown word after quadrantChart: ${JSON.stringify(tail)}`,
            lineNumber
          );
        }
        sawHeader = true;
        continue;
      }

      // The db supplies all three of these; the reader only has to not choke.
      if (/^accDescr\s*\{/i.test(text)) {
        inAccBlock = text.indexOf("}") === -1;
        continue;
      }
      if (/^(accTitle|accDescr)\s*:/i.test(text)) {
        continue;
      }
      if (/^title\b/i.test(text)) {
        continue;
      }

      // classDef is RECOGNISED AND SKIPPED. This surface delivers no
      // styling, so the declaration has nothing to contribute — but it must
      // be matched explicitly, because falling through to the point branch
      // would make a perfectly legal `classDef` line a reader refusal.
      if (/^classDef\b/i.test(text)) {
        continue;
      }

      // LAST DECLARATION WINS on a repeated axis or quadrant statement, and
      // that is Mermaid's own measured behaviour rather than a choice: two
      // `x-axis` lines deliver the second, and `quadrant-1` twice delivers
      // the second. Refusing the source instead would reject something
      // Mermaid accepts and describes perfectly well.
      if (/^x-axis\b/i.test(text)) {
        xAxis = readQuadrantAxis(text.slice("x-axis".length), lineNumber);
        continue;
      }
      if (/^y-axis\b/i.test(text)) {
        yAxis = readQuadrantAxis(text.slice("y-axis".length), lineNumber);
        continue;
      }

      const quadrantMatch = QUADRANT_LABEL_LINE.exec(text);
      if (quadrantMatch) {
        quadrants[Number(quadrantMatch[1]) - 1] = quadrantMatch[2].trim();
        continue;
      }

      // Anything left must be a point line, and a point line the reader
      // cannot parse is a STOP. It is never dropped: dropping one is the
      // shipped module's defect, and a description that states a point count
      // it computed from a partial read is worse than no description.
      const pointMatch = QUADRANT_POINT_LINE.exec(text);
      if (!pointMatch) {
        throwQuadrantReaderError(
          `a statement the reader does not know: ${JSON.stringify(text.slice(0, 60))}`,
          lineNumber
        );
      }

      const quoted = pointMatch[1];
      const bare = pointMatch[2];
      const name = (quoted === undefined ? bare : quoted).trim();
      if (name === "") {
        throwQuadrantReaderError("a point line with an empty name", lineNumber);
      }

      points.push({
        name: name,
        // THE AUTHOR'S OWN STRING, verbatim: `0.850` stays `0.850` and `0.85`
        // stays `0.85`. The db cannot supply this — it delivers a laid-out
        // pixel — and a consumer that wants to print the coordinate the
        // author wrote has no other source for it.
        x: pointMatch[4],
        y: pointMatch[5],
        // The same pair as numbers, so a consumer comparing against the 0.5
        // boundary does not each parse the strings itself and disagree about
        // how.
        xValue: Number(pointMatch[4]),
        yValue: Number(pointMatch[5]),
      });
    }

    if (!sawHeader) {
      throwQuadrantReaderError(
        "a source with no quadrantChart header at all",
        null
      );
    }

    // AN UNDECLARED AXIS IS NOT AN ERROR. Measured: a quadrant chart with no
    // axis statement at all, or with only one of the two, renders correctly
    // and Mermaid simply draws no label. It is delivered as two empty
    // strings, matching the way an unlabelled quadrant is delivered, so a
    // consumer has ONE absent case across every author-text field on this
    // surface rather than a null here and an empty string there.
    //
    // A POINTLESS CHART IS ALSO LEGAL, measured — `points` may be empty and
    // that is not a refusal.
    return {
      xAxis: xAxis || { low: "", high: "", label: "" },
      yAxis: yAxis || { low: "", high: "", label: "" },
      quadrants: quadrants,
      points: points,
    };
  }

  /**
   * Read the db's own view of the same chart, for corroboration only.
   *
   * EVERY VALUE HERE IS CROSS-CHECK MATERIAL AND NONE OF IT MAY BE
   * NARRATED. It is delivered so a gate can assert that the source read and
   * the canvas agree — the one thing a source reader cannot prove about
   * itself — and for no other purpose.
   *
   * Two normalisations are applied, both mechanical and both measured:
   *
   *   THE AXIS ARRAY IS NOT FIXED AT FOUR. Mermaid delivers one entry per
   *   DECLARED end, so its length is 0, 2, 3 or 4 depending on how many
   *   arrows the author wrote. x entries carry `rotation: 0` and y entries
   *   `rotation: -90`, which discriminates them reliably, so each axis's
   *   entries are placed in its own two slots and the rest padded with "".
   *   Without that the array's meaning would depend on the source, and a
   *   positional comparison against the delivered fields would be nonsense.
   *
   *   THE POINT ARRAY IS REVERSED. Mermaid delivers points in REVERSE
   *   declaration order (measured on every probe), so they are reversed back
   *   into source order here — otherwise a positional comparison against the
   *   reader's own list would pair every point with the wrong one.
   *
   * @param {Object} db - The resolved diagram's db, read inside the slot
   * @returns {Object} `{ axisLabels, quadrantLabels, pixels, plotRect }`
   */
  function readQuadrantCrossCheck(db) {
    const data = db.getQuadrantData();
    const rawAxis = Array.isArray(data.axisLabels) ? data.axisLabels : [];
    const rawQuadrants = Array.isArray(data.quadrants) ? data.quadrants : [];
    const rawPoints = Array.isArray(data.points) ? data.points : [];

    const xLabels = [];
    const yLabels = [];
    rawAxis.forEach((label) => {
      const text = label && typeof label.text === "string" ? label.text : "";
      if (label && label.rotation === 0) {
        xLabels.push(text);
      } else {
        yLabels.push(text);
      }
    });
    const slot = (list, index) =>
      typeof list[index] === "string" ? list[index] : "";

    // The plot rectangle as the UNION of the four quadrant rectangles,
    // derived rather than assumed. It moves with the chart — a titled chart
    // reserves a title band and an untitled one does not, and a chart with
    // no axis labels reclaims their margin — so nothing here may be a
    // constant.
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;
    rawQuadrants.forEach((quadrant) => {
      if (!quadrant || typeof quadrant.x !== "number") {
        return;
      }
      const right = quadrant.x + quadrant.width;
      const bottom = quadrant.y + quadrant.height;
      minX = minX === null ? quadrant.x : Math.min(minX, quadrant.x);
      minY = minY === null ? quadrant.y : Math.min(minY, quadrant.y);
      maxX = maxX === null ? right : Math.max(maxX, right);
      maxY = maxY === null ? bottom : Math.max(maxY, bottom);
    });

    return {
      axisLabels: [
        slot(xLabels, 0),
        slot(xLabels, 1),
        slot(yLabels, 0),
        slot(yLabels, 1),
      ],
      quadrantLabels: rawQuadrants.map((quadrant) =>
        quadrant && quadrant.text && typeof quadrant.text.text === "string"
          ? quadrant.text.text
          : ""
      ),
      pixels: rawPoints
        .map((point) => ({
          name:
            point && point.text && typeof point.text.text === "string"
              ? point.text.text
              : "",
          x: typeof point.x === "number" ? point.x : null,
          y: typeof point.y === "number" ? point.y : null,
        }))
        .reverse(),
      plotRect: {
        x: minX === null ? null : minX,
        y: minY === null ? null : minY,
        width: minX === null ? null : maxX - minX,
        height: minY === null ? null : maxY - minY,
      },
    };
  }

  /**
   * Normalise one resolved quadrant Diagram instance into the adapter's
   * quadrant shape.
   *
   * SAME-TICK SNAPSHOT, and on this surface it protects more than the three
   * scalars. The quadrant db is a measured singleton whose SECOND PARSE
   * REPLACES THE FIRST CHART'S ENTIRE PAYLOAD — points, axis labels and
   * quadrant labels included — and a stale Diagram handle read afterwards
   * returns the second chart's data while looking perfectly live. So the
   * crossCheck reads happen here, inside the parse's own .then, behind the
   * queue, and are copied into this function's own return object before it
   * returns. Nothing delivered references a db-owned object, and no consumer
   * may go back to the db later.
   *
   * The reader's half cannot be lost that way, because it comes from the
   * caller's own string; the source read is done inside the slot anyway, so
   * the whole function is one indivisible unit and a future editor cannot
   * accidentally split the db reads from the rest.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string} code - The caller's raw source, the reader's input
   * @returns {Object} The normalised quadrant chart
   */
  function normaliseQuadrant(diagram, code) {
    const db = diagram.db;

    // WRONG-TYPE GUARD, and it earns its place: getDiagramTitle, getAccTitle
    // and getAccDescription exist on EVERY Mermaid db, so a caller that
    // hands this surface a flowchart gets three happy scalar reads and then
    // a bare `db.getQuadrantData is not a function` TypeError from inside
    // the cross-check — measured. That is a stack trace where the contract
    // promises a named refusal, so the type is checked on the one accessor
    // that discriminates, before anything is read.
    if (typeof db.getQuadrantData !== "function") {
      throwQuadrantReaderError(
        "a diagram whose db has no getQuadrantData accessor, so it is not a " +
          "quadrant chart at all",
        null
      );
    }

    // The three shared-store reads, together, first, before anything else
    // can yield. They come from Mermaid's CROSS-TYPE shared store, which
    // every parse of every type clears (register item 21).
    const rawTitle = db.getDiagramTitle() || "";
    const rawAccTitle = db.getAccTitle() || "";
    const rawAccDescription = db.getAccDescription() || "";

    // The db's own view, same slot, corroboration only.
    const crossCheck = readQuadrantCrossCheck(db);

    // Mermaid has judged the source valid; only now does the reader run.
    const read = readQuadrantSource(code);

    return {
      type: "quadrantChart",
      // ITEM 9, VERDICT C-PLACEHOLDER for this field, [OBSERVED] on all four
      // routes rather than inferred: `#quot;` is drawn as `"`, `#35;` as
      // `#`, a bare `&` as itself, and a pre-escaped `&lt;` as the literal
      // six characters. decodePlaceholders reproduces the drawing in every
      // case, and the quadrant SVG carries no foreignObject.
      title: decodePlaceholders(rawTitle),
      // NO transform on accTitle or accDescr, matching the standing
      // carve-out declared at the placeholder-decoding block near the top of
      // this file. It is deliberate on all eight surfaces and must not be
      // "completed" by a later editor.
      accTitle: rawAccTitle,
      accDescr: rawAccDescription,

      // The author's own declarations, from the source. NO DECODE: the
      // lexer refuses every escape form in these positions, so there is
      // nothing a transform could do. See the surface preamble, OQ1.
      //
      // THREE FIELDS PER AXIS, NOT TWO, and the third is gold rule R6. A
      // two-ended axis fills left/right and leaves `label` ""; a single-label
      // axis fills `label` and leaves BOTH ends "". They are different
      // declarations — the first states a polarity, the second is an axis
      // title — and R6 forbids narrating the second as though it were the
      // first. Collapsing them into left/right would also merge the
      // single-label form with the dangling `x-axis Low -->`, which really
      // does declare a low end and no high one.
      xAxis: {
        left: read.xAxis.low,
        right: read.xAxis.high,
        label: read.xAxis.label,
      },
      yAxis: {
        bottom: read.yAxis.low,
        top: read.yAxis.high,
        label: read.yAxis.label,
      },

      // Mermaid's own quadrant order, 1 to 4. An unlabelled quadrant is ""
      // rather than omitted, so the array is always length four and a
      // consumer never indexes past its end.
      quadrants: read.quadrants.slice(),

      // SOURCE ORDER, which is the order the author wrote and the order a
      // description should speak. The db reverses it.
      points: read.points,

      crossCheck: crossCheck,
    };
  }

  /**
   * Parse Mermaid quadrant chart code into the normalised quadrant shape.
   *
   * Rejects with Mermaid's own error on a parse failure, and with a distinct
   * Error whose message begins "Quadrant chart source reader" when Mermaid
   * accepted a source the reader's grammar subset cannot read. Both are
   * rejections of the returned promise; the call itself never throws
   * synchronously, so awaiting this promise is the single error path.
   *
   * SERIALISED PARSES: every parse is chained through the adapter-wide
   * queue, so it cannot replace the shared singleton's data or clear the
   * shared accessible-title store while an earlier call's snapshot is still
   * in progress. The chain advances on settlement, not success, so a
   * rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised quadrant chart
   */
  function parseQuadrant(code) {
    // Lazy quadrant self-check trigger, matching the other surfaces'
    // ordering. The check enqueues its own fixture parses first, so it holds
    // the front of the queue ahead of this call's parse.
    if (!quadrantSelfCheckStarted) {
      runQuadrantSelfCheck();
    }

    if (code === quadrantMemoCode && quadrantMemoPromise) {
      logDebug("Returning memoised quadrant parse for identical code string");
      return quadrantMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for why
    // it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `Quadrant parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Quadrant parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          // MERMAID HAS NOW JUDGED THE SOURCE VALID. Only here does the
          // reader run, and it runs inside this same slot.
          const chart = normaliseQuadrant(diagram, code);
          logDebug(
            `Quadrant parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `Quadrant parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects (see
    // the tail below), but `run` is passed as both handlers so a future
    // change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    quadrantMemoCode = code;
    quadrantMemoPromise = result;
    return result;
  }

  /**
   * Parse the two embedded quadrant fixtures and assert the db accessor
   * names, the same-tick snapshot, the source reader's normalised shape and
   * the agreement between the two halves. Resolves true on a clean run; on
   * any failure logs ONE ERROR naming the first failed assertion, marks the
   * quadrant surface unhealthy, and resolves false. Never throws.
   *
   * BOTH FIXTURES RUN INSIDE ONE QUEUE SLOT, and the full chart is fully
   * normalised BEFORE the small one is issued. That ordering is the point,
   * and on this surface it is load-bearing beyond the three scalars: the
   * second parse replaces the first chart's WHOLE payload in the singleton
   * db, so a check that parsed both and read afterwards would be measuring
   * the second chart twice — including its crossCheck. One slot rather than
   * two is deliberate, is strictly stronger isolation, and keeps the pair
   * indivisible.
   *
   * @returns {Promise<boolean>} Resolves to the quadrant health verdict
   */
  function runQuadrantSelfCheck() {
    if (quadrantSelfCheckPromise) {
      return quadrantSelfCheckPromise;
    }
    quadrantSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            QUADRANT_SELF_CHECK_FIXTURE_FULL
          );
        })
        .then((fullDiagram) => {
          const db = fullDiagram.db;
          // The accessor names this surface depends on, read before anything
          // else, so a Mermaid rename fails here rather than delivering "".
          const accessorsPresent =
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function" &&
            typeof db.getQuadrantData === "function";
          // Fully normalised — including the same-tick snapshot of both the
          // scalars and the crossCheck — before the second parse begins.
          const full = normaliseQuadrant(
            fullDiagram,
            QUADRANT_SELF_CHECK_FIXTURE_FULL
          );

          return window.mermaid.mermaidAPI
            .getDiagramFromText(QUADRANT_SELF_CHECK_FIXTURE_SMALL)
            .then((smallDiagram) => {
              const small = normaliseQuadrant(
                smallDiagram,
                QUADRANT_SELF_CHECK_FIXTURE_SMALL
              );

              // THE THIRD PARSE, still inside this one slot. Each chart is
              // fully normalised before the next is issued, because the
              // quadrant db is a singleton whose next parse replaces the
              // previous chart's whole payload.
              return window.mermaid.mermaidAPI
                .getDiagramFromText(QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL)
                .then((singleLabelDiagram) => {
                  const singleLabel = normaliseQuadrant(
                    singleLabelDiagram,
                    QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL
                  );

                  // Each entry: [assertion name, predicate]. The first false
                  // predicate fails the check and is named in the single
                  // ERROR line. The predicates are EVALUATED HERE, inside the
                  // slot, so the verdict below never touches a db.
                  return [
                  [
                    "the four db accessors this surface reads exist by name",
                    accessorsPresent,
                  ],
                  [
                    "the full chart's title, accTitle and accDescr survive the " +
                      "same-tick snapshot",
                    full.title === "SelfCheck quadrant title" &&
                      full.accTitle === "SelfCheck quadrant acc title" &&
                      full.accDescr === "SelfCheck quadrant acc descr",
                  ],
                  [
                    "both axes read their two declared end labels from the " +
                      "source, with an EMPTY single-label field",
                    full.xAxis.left === "SelfCheck low x" &&
                      full.xAxis.right === "SelfCheck high x" &&
                      full.xAxis.label === "" &&
                      full.yAxis.bottom === "SelfCheck low y" &&
                      full.yAxis.top === "SelfCheck high y" &&
                      full.yAxis.label === "",
                  ],
                  [
                    "all four quadrant labels arrive in Mermaid's own 1-to-4 order",
                    full.quadrants.length === 4 &&
                      full.quadrants[0] === "SelfCheck q one" &&
                      full.quadrants[1] === "SelfCheck q two" &&
                      full.quadrants[2] === "SelfCheck q three" &&
                      full.quadrants[3] === "SelfCheck q four",
                  ],
                  [
                    "THE :::CLASS PIN: a point written `Gamma point:::big:` is " +
                      "READ, not dropped — three points arrive, in SOURCE order, " +
                      "and the classDef line is skipped rather than refused",
                    full.points.length === 3 &&
                      full.points[0].name === "Alpha point" &&
                      full.points[1].name === "Beta point" &&
                      full.points[2].name === "Gamma point",
                  ],
                  [
                    "THE AUTHORED STRING PIN: `0.80` is delivered as \"0.80\" and " +
                      "not as \"0.8\", with xValue/yValue the matching numbers",
                    full.points[1].x === "0.80" &&
                      full.points[1].y === "0.30" &&
                      full.points[1].xValue === 0.8 &&
                      full.points[1].yValue === 0.3 &&
                      full.points[0].x === "0.25" &&
                      full.points[0].y === "0.85",
                  ],
                  [
                    "trailing inline styling is discarded rather than read as " +
                      "part of the coordinate",
                    full.points[1].xValue === 0.8 && full.points[1].yValue === 0.3,
                  ],
                  [
                    "the crossCheck axis and quadrant labels agree with the " +
                      "source read, field for field",
                    full.crossCheck.axisLabels[0] === full.xAxis.left &&
                      full.crossCheck.axisLabels[1] === full.xAxis.right &&
                      full.crossCheck.axisLabels[2] === full.yAxis.bottom &&
                      full.crossCheck.axisLabels[3] === full.yAxis.top &&
                      full.crossCheck.quadrantLabels.length === 4 &&
                      full.crossCheck.quadrantLabels[0] === full.quadrants[0] &&
                      full.crossCheck.quadrantLabels[3] === full.quadrants[3],
                  ],
                  [
                    "THE R6 PIN: a SINGLE-LABEL axis delivers its label in " +
                      "`label` with BOTH ends empty, so no consumer can read it " +
                      "as a polarity the author never wrote — and the db's own " +
                      "positional array puts that same label in the first slot",
                    singleLabel.xAxis.label === "SelfCheck lone x" &&
                      singleLabel.xAxis.left === "" &&
                      singleLabel.xAxis.right === "" &&
                      singleLabel.yAxis.bottom === "SelfCheck lone low y" &&
                      singleLabel.yAxis.top === "SelfCheck lone high y" &&
                      singleLabel.yAxis.label === "" &&
                      singleLabel.crossCheck.axisLabels[0] === "SelfCheck lone x" &&
                      singleLabel.crossCheck.axisLabels[1] === "",
                  ],
                  [
                    "the crossCheck pixels are reversed back into SOURCE order " +
                      "and name the same three points",
                    full.crossCheck.pixels.length === 3 &&
                      full.crossCheck.pixels[0].name === "Alpha point" &&
                      full.crossCheck.pixels[2].name === "Gamma point",
                  ],
                  [
                    "THE PIXEL AGREEMENT PIN: every point's authored pair " +
                      "reproduces its delivered pixel through the plotRect, so " +
                      "the source read and the canvas describe one chart",
                    full.crossCheck.plotRect.width > 0 &&
                      full.crossCheck.plotRect.height > 0 &&
                      full.points.every((point, index) => {
                        const pixel = full.crossCheck.pixels[index];
                        const rect = full.crossCheck.plotRect;
                        const expectedX = rect.x + point.xValue * rect.width;
                        const expectedY =
                          rect.y + (1 - point.yValue) * rect.height;
                        return (
                          Math.abs(pixel.x - expectedX) < 0.5 &&
                          Math.abs(pixel.y - expectedY) < 0.5
                        );
                      }),
                  ],
                  [
                    "the small chart's ABSENT fields are empty strings rather " +
                      "than null, and its two points still arrive",
                    small.title === "" &&
                      small.accTitle === "" &&
                      small.accDescr === "" &&
                      small.quadrants.length === 4 &&
                      small.quadrants.every((label) => label === "") &&
                      small.points.length === 2 &&
                      small.points[0].name === "Quick win",
                  ],
                  [
                    "the small chart's own axis labels reach it, proving the " +
                      "full chart's snapshot was taken before this parse " +
                      "replaced the singleton's whole payload",
                    small.xAxis.left === "SelfCheck small low" &&
                      small.yAxis.top === "SelfCheck small top" &&
                      small.crossCheck.pixels.length === 2,
                  ],
                  [
                    "and the SINGLE-LABEL chart's own point reaches it too, so " +
                      "all three snapshots in this slot survived the two parses " +
                      "that followed them",
                    singleLabel.points.length === 1 &&
                      singleLabel.points[0].name === "Lone point" &&
                      singleLabel.crossCheck.pixels.length === 1 &&
                      singleLabel.crossCheck.pixels[0].name === "Lone point",
                  ],
                  ];
                });
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    quadrantSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Quadrant self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's quadrant internals no longer " +
              "match the 1 September 2026 measurements, or the source " +
              "reader's grammar subset has drifted; do not trust quadrant " +
              "adapter output."
          );
          quadrantHealthy = false;
          return false;
        }

        logInfo(
          "Quadrant self-check passed: accessor, snapshot, source-reader and " +
            "cross-check assertions all hold"
        );
        quadrantHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Quadrant self-check FAILED at assertion: both fixtures parse and read. ` +
            `The fixture run rejected: ${error && error.message}`
        );
        quadrantHealthy = false;
        return false;
      });

    return quadrantSelfCheckPromise;
  }

  /**
   * Report the quadrant surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the quadrant self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isQuadrantHealthy() {
    return quadrantHealthy;
  }

  // ---------------------------------------------------------------------
  // SEQUENCE — the ninth surface, and the second read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE, unlike quadrant. Quadrant needed one
  // because its db delivers points as LAID-OUT PIXELS: the author's own
  // numbers are recoverable only by inverting Mermaid's private layout.
  // Sequence's db delivers no post-layout value at all — every field below is
  // the author's own text, an id, or an enumerated constant, fixed at parse
  // time before any geometry exists. There is nothing to invert and nothing
  // to round. Measured in docs/mermaid-item-70-sequence-grounding-2026-09-02.md
  // and ruled by the design seat on 3 September 2026.
  //
  // THE SHAPE THIS DELIVERY IS BUILT FOR is the gold document's rules S7-S12
  // (docs/mermaid-sequence-gold-targets-2026-09-03.md). Mermaid hands back ONE
  // ordered array carrying messages, block markers, notes, activations and the
  // autonumber directive together. This surface keeps that single order —
  // splitting it into per-kind lists would destroy the only record of where a
  // note or a block boundary sits relative to the messages — but lifts the
  // autonumber directives out, because they are a property of the diagram
  // rather than events in it. EVERY directive is lifted, as an array carrying
  // the ordinal each one starts governing at (ruling R17, 4 September 2026);
  // the single object this surface delivered until then could not represent a
  // second directive, so `autonumber off` erased the `autonumber` that
  // preceded it.
  //
  // NESTING IS POSITIONAL IN THE DB: no depth field, no parent pointer. The
  // stack below recovers it, and refuses rather than repairs.
  const SEQUENCE_ARROW_KINDS = {
    SOLID: { line: "solid", head: "arrow" },
    SOLID_OPEN: { line: "solid", head: "open" },
    DOTTED: { line: "dotted", head: "arrow" },
    DOTTED_OPEN: { line: "dotted", head: "open" },
    SOLID_CROSS: { line: "solid", head: "cross" },
    DOTTED_CROSS: { line: "dotted", head: "cross" },
    SOLID_POINT: { line: "solid", head: "async" },
    DOTTED_POINT: { line: "dotted", head: "async" },
    BIDIRECTIONAL_SOLID: { line: "solid", head: "bidirectional" },
    BIDIRECTIONAL_DOTTED: { line: "dotted", head: "bidirectional" },
  };

  // Block markers, by LINETYPE NAME. Names rather than integers everywhere
  // except the self-check, which is where the integers are pinned, so an
  // upstream renumbering fails loudly in one place instead of silently
  // remapping every arrow.
  const SEQUENCE_BLOCK_STARTS = {
    LOOP_START: "loop",
    ALT_START: "alt",
    OPT_START: "opt",
    PAR_START: "par",
    PAR_OVER_START: "par",
    CRITICAL_START: "critical",
    BREAK_START: "break",
    RECT_START: "rect",
  };
  const SEQUENCE_BLOCK_BRANCHES = {
    ALT_ELSE: "alt",
    PAR_AND: "par",
    CRITICAL_OPTION: "critical",
  };
  const SEQUENCE_BLOCK_ENDS = {
    LOOP_END: "loop",
    ALT_END: "alt",
    OPT_END: "opt",
    PAR_END: "par",
    CRITICAL_END: "critical",
    BREAK_END: "break",
    RECT_END: "rect",
  };
  const SEQUENCE_PLACEMENTS = { LEFTOF: "left", RIGHTOF: "right", OVER: "over" };

  let sequenceMemoCode = null;
  let sequenceMemoPromise = null;
  let sequenceHealthy = null;
  let sequenceSelfCheckStarted = false;
  let sequenceSelfCheckPromise = null;

  /**
   * Build the integer-to-name lookup for a db enumeration, read OFF THE DB.
   * @param {Object} enumeration - db.LINETYPE or db.PLACEMENT
   * @returns {Object} Integer-keyed map of constant names
   */
  function sequenceNamesByValue(enumeration) {
    const names = {};
    if (!enumeration) {
      return names;
    }
    Object.keys(enumeration).forEach((name) => {
      names[enumeration[name]] = name;
    });
    return names;
  }

  /**
   * Normalise one Mermaid sequence diagram into the ninth surface's delivery.
   *
   * Every field is always present — "" or [] or null rather than absent — so a
   * consumer has one absent case per field and never an undefined member.
   *
   * @param {Object} diagram - The resolved Mermaid diagram
   * @returns {Object} The normalised sequence delivery
   */
  function normaliseSequence(diagram) {
    const db = diagram.db;

    // Read the two enumerations ONCE per parse, off this db instance.
    const lineTypeNames = sequenceNamesByValue(db.LINETYPE);
    const placementNames = sequenceNamesByValue(db.PLACEMENT);

    const rawEntries = Array.isArray(db.getMessages()) ? db.getMessages() : [];
    const actorKeys = Array.isArray(db.getActorKeys()) ? db.getActorKeys() : [];
    const actorMap = db.getActors();

    // The ordinal of a message is its one-based position among ARROW entries
    // only. Notes, block markers, activations and the autonumber directive do
    // not advance it, so the number a consumer narrates is the number the
    // diagram's own autonumber draws. Register item 70 ruling R7.
    const ordinalByIndex = {};
    let messageOrdinal = 0;
    rawEntries.forEach((entry, index) => {
      const name = lineTypeNames[entry.type];
      if (SEQUENCE_ARROW_KINDS[name]) {
        messageOrdinal += 1;
        ordinalByIndex[index] = messageOrdinal;
      }
    });

    /**
     * Convert a delivered list INDEX into a message ordinal, by counting arrow
     * entries up to and including it. Used for create and destroy, which the
     * db keys by index into getMessages().
     * @param {number} index - The delivered list index
     * @returns {number|null} The one-based message ordinal, or null
     */
    function ordinalForIndex(index) {
      if (typeof index !== "number") {
        return null;
      }
      let count = 0;
      for (let i = 0; i <= index && i < rawEntries.length; i += 1) {
        if (SEQUENCE_ARROW_KINDS[lineTypeNames[rawEntries[i].type]]) {
          count += 1;
        }
      }
      return count > 0 ? count : null;
    }

    /**
     * Read a Map delivered by the db into a plain id-to-ordinal object.
     * @param {Map|null} source - getCreatedActors() or getDestroyedActors()
     * @returns {Object} Id-keyed map of message ordinals
     */
    function lifecycleOrdinals(source) {
      const out = {};
      if (source && typeof source.forEach === "function") {
        source.forEach((index, id) => {
          out[id] = ordinalForIndex(index);
        });
      }
      return out;
    }

    const createdAtById = lifecycleOrdinals(
      typeof db.getCreatedActors === "function" ? db.getCreatedActors() : null
    );
    const destroyedAtById = lifecycleOrdinals(
      typeof db.getDestroyedActors === "function" ? db.getDestroyedActors() : null
    );

    // BOXES ARE BUILT BEFORE PARTICIPANTS, because membership is delivered as
    // an INDEX into this array (ruling R15) rather than as the owning box's
    // name. `getBoxes()` is the db's own grouping and is correct for an
    // unnamed box, where `actor.box.name` is not a string at all.
    const rawBoxes = typeof db.getBoxes === "function" ? db.getBoxes() : [];
    // Item 82: the box name, the participant name, the message text, the
    // note text and (enactment 5, 3 October 2026) the block labels (loop, alt,
    // else, opt, par, and, critical, option, break) draw a typed break, so
    // they take decodePlaceholdersBreaks. The title prints the tag and keeps
    // decodePlaceholders.
    const boxes = (Array.isArray(rawBoxes) ? rawBoxes : []).map((box) => ({
      name: decodePlaceholdersBreaks(typeof box.name === "string" ? box.name : ""),
      members: Array.isArray(box.actorKeys) ? box.actorKeys.slice() : [],
    }));

    // Id to the index of the box that holds it, built once. The FIRST box
    // naming an actor wins, matching the old consumer-side reconstruction; the
    // db does not put one actor in two boxes.
    const boxIndexById = {};
    boxes.forEach((box, boxIndex) => {
      box.members.forEach((id) => {
        if (!Object.prototype.hasOwnProperty.call(boxIndexById, id)) {
          boxIndexById[id] = boxIndex;
        }
      });
    });

    const participants = actorKeys.map((key) => {
      const actor = actorMap && actorMap.get ? actorMap.get(key) : null;
      // LINKS ARE DELIVERED VERBATIM, deliberately. The decode ruling below
      // covers text Mermaid DRAWS into an SVG <text>; a link is a menu entry
      // and a URL, and a URL must never be transformed. Recorded rather than
      // left to inference — see the surface report of 3 September 2026.
      const rawLinks = actor && actor.links ? actor.links : {};
      const links = Object.keys(rawLinks).map((label) => ({
        label: label,
        url: typeof rawLinks[label] === "string" ? rawLinks[label] : "",
      }));
      return {
        id: key,
        // The DISPLAY text is `description`; `name` on the db object is the
        // declared id. Delivered under the names a consumer expects.
        name: decodePlaceholdersBreaks(
          actor && typeof actor.description === "string" ? actor.description : ""
        ),
        kind:
          actor && typeof actor.type === "string" ? actor.type : "participant",
        // RULING R15, 4 September 2026: the INDEX into `boxes`, or null. This
        // replaces a `box` field carrying the owning box's NAME, which could
        // not tell "in no box" from "in an UNNAMED box" — both delivered null,
        // because an unnamed box's `actor.box.name` is not a string (sweep
        // F12, docs/mermaid-item-70-sequence-sweep-2026-09-04.md). No
        // narration was wrong on that account, because the only consumer read
        // `boxes[].members`; the field is repaired because the obvious field
        // being silently wrong is a trap for the next consumer.
        boxIndex: Object.prototype.hasOwnProperty.call(boxIndexById, key)
          ? boxIndexById[key]
          : null,
        links: links,
        createdAt:
          Object.prototype.hasOwnProperty.call(createdAtById, key) === true
            ? createdAtById[key]
            : null,
        destroyedAt:
          Object.prototype.hasOwnProperty.call(destroyedAtById, key) === true
            ? destroyedAtById[key]
            : null,
      };
    });

    // THE BLOCK STACK. Push on a start, check the top on a branch, pop on an
    // end. Every failure throws and names the entry index; nothing is
    // recovered silently, because a mis-paired block would otherwise deliver a
    // plausible tree describing a diagram nobody drew.
    const blockStack = [];
    const events = [];
    // RULING R17, 4 September 2026: EVERY directive, in source order, not one
    // field the last one overwrites. Empty array when the diagram has none.
    const autonumber = [];
    const activateFlags = [];
    const counts = {
      messages: 0,
      loops: 0,
      alternatives: 0,
      optionalSections: 0,
      parallelSections: 0,
      criticalSections: 0,
      breaks: 0,
    };
    const COUNT_KEY_FOR_BLOCK = {
      loop: "loops",
      alt: "alternatives",
      opt: "optionalSections",
      par: "parallelSections",
      critical: "criticalSections",
      break: "breaks",
    };

    rawEntries.forEach((entry, index) => {
      const name = lineTypeNames[entry.type];
      const text = typeof entry.message === "string" ? entry.message : "";

      if (name === "AUTONUMBER") {
        // THE ONLY HONEST SIGNAL. showSequenceNumbers() reads false on a
        // diagram that HAS autonumber, and getConfig().showSequenceNumbers
        // reads true on every diagram because it is the page's own Mermaid
        // config — measured, grounding § B1.5. Both were rejected.
        //
        // RULING R17: EVERY directive is delivered, each carrying the ordinal
        // of the FIRST MESSAGE IT GOVERNS. `counts.messages` is the count of
        // arrow entries seen so far in this ordered walk, so one more than it
        // is that ordinal by construction. Keeping a single overwritten object
        // made a second directive invisible: `autonumber` … `autonumber off`
        // delivered only the off, and a diagram drawing the numbers 1 and 2
        // was narrated as saying nothing about numbering at all (sweep F4).
        const directive = entry.message && typeof entry.message === "object" ? entry.message : {};
        autonumber.push({
          atOrdinal: counts.messages + 1,
          start: typeof directive.start === "number" ? directive.start : null,
          step: typeof directive.step === "number" ? directive.step : null,
          visible: directive.visible === true,
        });
        return;
      }

      const arrow = SEQUENCE_ARROW_KINDS[name];
      if (arrow) {
        counts.messages += 1;
        const ordinal = ordinalByIndex[index];
        events.push({
          kind: "message",
          ordinal: ordinal,
          from: typeof entry.from === "string" ? entry.from : null,
          to: typeof entry.to === "string" ? entry.to : null,
          text: decodePlaceholdersBreaks(text),
          line: arrow.line,
          head: arrow.head,
        });
        activateFlags.push({ ordinal: ordinal, activate: entry.activate === true });
        return;
      }

      if (name === "ACTIVE_START" || name === "ACTIVE_END") {
        events.push({
          kind: name === "ACTIVE_START" ? "activate" : "deactivate",
          actor: typeof entry.from === "string" ? entry.from : null,
        });
        return;
      }

      if (name === "NOTE") {
        const placement = SEQUENCE_PLACEMENTS[placementNames[entry.placement]] || null;
        // A single-actor note arrives with from === to; there is no
        // isSpanning field, so the comparison IS the signal.
        const actors =
          entry.from === entry.to
            ? [typeof entry.from === "string" ? entry.from : null]
            : [
                typeof entry.from === "string" ? entry.from : null,
                typeof entry.to === "string" ? entry.to : null,
              ];
        events.push({
          kind: "note",
          placement: placement,
          actors: actors,
          text: decodePlaceholdersBreaks(text),
        });
        return;
      }

      const startKind = SEQUENCE_BLOCK_STARTS[name];
      if (startKind) {
        blockStack.push({ block: startKind, index: index });
        const countKey = COUNT_KEY_FOR_BLOCK[startKind];
        if (countKey) {
          counts[countKey] += 1;
        }
        const startEvent = {
          kind: "blockStart",
          block: startKind,
          label: decodePlaceholdersBreaks(text),
        };
        if (name === "PAR_OVER_START") {
          // MEASURED UNREACHABLE on this build (3 September 2026): `par over
          // A,B: …` and `par over Label` both deliver PAR_START with the word
          // "over" swallowed into the label. The mapping is kept anyway so a
          // future build emitting 32 is delivered rather than refused as an
          // unknown integer; the flag is therefore UNEXERCISED, not proven.
          startEvent.parOver = true;
        }
        events.push(startEvent);
        return;
      }

      const branchKind = SEQUENCE_BLOCK_BRANCHES[name];
      if (branchKind) {
        const top = blockStack[blockStack.length - 1];
        if (!top || top.block !== branchKind) {
          throw new Error(
            `Sequence block structure is inconsistent: a ${name} branch at entry ` +
              `${index} inside ${top ? `a ${top.block} block` : "no block"}`
          );
        }
        events.push({
          kind: "blockBranch",
          block: branchKind,
          label: decodePlaceholdersBreaks(text),
        });
        return;
      }

      const endKind = SEQUENCE_BLOCK_ENDS[name];
      if (endKind) {
        const top = blockStack.pop();
        if (!top || top.block !== endKind) {
          throw new Error(
            `Sequence block structure is inconsistent: a ${name} at entry ` +
              `${index} closing ${top ? `a ${top.block} block` : "no open block"}`
          );
        }
        events.push({ kind: "blockEnd", block: endKind });
        return;
      }

      // An integer this surface has no mapping for is a STOP carrying the
      // integer, never a dropped event: a silently skipped entry would take a
      // message's neighbours with it and no consumer could tell.
      throw new Error(
        `Sequence delivered an unmapped LINETYPE ${entry.type}` +
          `${name ? ` (${name})` : ""} at entry ${index}`
      );
    });

    if (blockStack.length > 0) {
      throw new Error(
        `Sequence block structure is inconsistent: ${blockStack.length} block(s) ` +
          `left open at the last entry, the outermost a ${blockStack[0].block} ` +
          `opened at entry ${blockStack[0].index}`
      );
    }

    return {
      type: "sequence",
      // THE THREE SHARED-STORE FIELDS. Read here, inside the same slot and
      // the same .then as the payload, because Mermaid keeps the diagram
      // title, accessible title and accessible description in ONE
      // module-scoped store shared by every diagram type and cleared by every
      // parse (register item 21; measured for sequence at grounding § B3,
      // where a second parse overwrote the first handle's title in both
      // orders while its actors and messages survived untouched).
      title: decodePlaceholders(
        typeof db.getDiagramTitle === "function" ? db.getDiagramTitle() || "" : ""
      ),
      // accTitle and accDescr take NO transform, on this surface as on every
      // other — the standing carve-out documented at the top of this file.
      accTitle:
        typeof db.getAccTitle === "function" ? db.getAccTitle() || "" : "",
      accDescr:
        typeof db.getAccDescription === "function"
          ? db.getAccDescription() || ""
          : "",
      participants: participants,
      boxes: boxes,
      autonumber: autonumber,
      events: events,
      counts: counts,
      // Delivered for derivation checks only, never narrated: the message
      // objects' own activate flag, which differs between the two activation
      // spellings while the ACTIVE_START/ACTIVE_END events do not.
      crossCheck: { activateFlags: activateFlags },
    };
  }

  /**
   * Parse a sequence diagram and deliver the normalised shape.
   *
   * Same contract as the other eight surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every
   * db read happens inside this call's own queue slot.
   *
   * @param {string} code - The Mermaid sequence source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseSequence(code) {
    if (!sequenceSelfCheckStarted) {
      runSequenceSelfCheck();
    }

    if (code === sequenceMemoCode && sequenceMemoPromise) {
      logDebug("Returning memoised sequence parse for identical code string");
      return sequenceMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `Sequence parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Sequence parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const sequence = normaliseSequence(diagram);
          logDebug(
            `Sequence parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return sequence;
        })
        .catch((error) => {
          logDebug(
            `Sequence parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    sequenceMemoCode = code;
    sequenceMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: a title and both accessible fields, TWO autonumber
   * directives, a NAMED box holding an actor-kind and a participant-kind
   * declaration, an UNNAMED box holding one participant, a created
   * participant belonging to no box, ONE MESSAGE OF EACH OF THE TEN ARROW
   * FORMS, a note spanning two actors, and an alt with an else.
   *
   * THE SECOND BOX AND THE SECOND DIRECTIVE WERE ADDED 4 SEPTEMBER 2026,
   * with rulings R15 and R17, and each is the only thing that can catch its
   * own defect. The unnamed box gives `boxIndex` a member whose owning box
   * has no name — the case the old `box` NAME field could not tell from "in
   * no box", because both delivered null (sweep F12). The second directive,
   * `autonumber off` after two messages, gives the array a second element at
   * `atOrdinal` 3 — the case the old single overwritten object could not
   * represent at all, and the one that made a diagram drawing numbers 1 and 2
   * narrate as saying nothing about numbering (sweep F4). A fixture with one
   * box and one directive passes an assertion over either shape, which is why
   * neither was enough.
   *
   * The ten arrow forms are the point. The module this surface replaces reads
   * arrows with a regex whose greedy sender class swallows a hyphen, so an
   * unspaced two-dash arrow degrades and both bidirectional forms are dropped
   * entirely (grounding § A4.5). Every form is written UNSPACED here, which is
   * exactly the shape that defeated the regex, so if a Mermaid upgrade ever
   * changed the arrow lexer this check fails loudly rather than the surface
   * quietly reproducing the defect it exists to remove.
   *
   * ASCII only, every string distinctive, so a cross-delivery from another
   * diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const SEQUENCE_SELF_CHECK_FIXTURE = [
    "sequenceDiagram",
    "    title SelfCheck sequence title",
    "    accTitle: SelfCheck sequence acc title",
    "    accDescr: SelfCheck sequence acc descr",
    "    autonumber 3 2",
    "    box SelfCheck box",
    "        actor SA as SelfCheck actor",
    "        participant SB as SelfCheck bee",
    "    end",
    "    box rgb(210,220,230)",
    "        participant SC as SelfCheck cee",
    "    end",
    "    create participant SD as SelfCheck dee",
    "    SA->>SD: SelfCheck created",
    "    SA->SB: SelfCheck solid open",
    "    autonumber off",
    "    SA->>SB: SelfCheck solid arrow",
    "    SA-->SB: SelfCheck dotted open",
    "    SA-->>SB: SelfCheck dotted arrow",
    "    SA-xSB: SelfCheck solid cross",
    "    SA--xSB: SelfCheck dotted cross",
    "    SA-)SB: SelfCheck solid async",
    "    SA--)SB: SelfCheck dotted async",
    "    SA<<->>SB: SelfCheck solid bidi",
    "    SA<<-->>SB: SelfCheck dotted bidi",
    "    Note over SA,SB: SelfCheck note",
    "    alt SelfCheck alt cond",
    "        SA->>SC: SelfCheck alt yes",
    "    else SelfCheck else cond",
    "        SA->>SC: SelfCheck alt no",
    "    end",
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A typed break and an author-escaped one (`#lt;br#gt;`;
  // `&lt;br&gt;` is a parse error on this type) on each of the four positions
  // whose canvas draws a break, plus a TITLE carrying a typed break, which the
  // canvas prints and which must therefore arrive as written.
  const SEQUENCE_BREAK_SELF_CHECK_FIXTURE = [
    "sequenceDiagram",
    "    title SelfCheck break<br>title",
    "    box one<br>two",
    "        participant SA as three<br>four",
    "    end",
    "    box five#lt;br#gt;six",
    "        participant SB as seven#lt;br#gt;eight",
    "    end",
    "    SA->>SB: nine<br>ten",
    "    SB->>SA: eleven#lt;br#gt;twelve",
    "    Note over SA: thirteen<br>fourteen",
    "    Note over SB: fifteen#lt;br#gt;sixteen",
    // Enactment 5: block labels, appended after the notes so the indices the
    // rows above read do not move. A typed break on a loop label and on an
    // else branch, an author-escaped one on an alt label, a break-only loop
    // label (which must arrive empty) and a spaces-only one for comparison.
    "    loop seventeen<br>eighteen",
    "        SA->>SB: nineteen",
    "    end",
    "    alt twenty#lt;br#gt;one",
    "        SB->>SA: twentytwo",
    "    else twentythree<br>twentyfour",
    "        SA->>SB: twentyfive",
    "    end",
    "    opt <br>",
    "        SA->>SB: twentysix",
    "    end",
  ].join("\n");

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the sequence surface unhealthy, and
   * resolves false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the sequence health verdict
   */
  function runSequenceSelfCheck() {
    if (sequenceSelfCheckPromise) {
      return sequenceSelfCheckPromise;
    }
    sequenceSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            SEQUENCE_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getActorKeys === "function" &&
            typeof db.getActors === "function" &&
            typeof db.getBoxes === "function" &&
            typeof db.getMessages === "function" &&
            typeof db.getCreatedActors === "function" &&
            typeof db.getDestroyedActors === "function" &&
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function";

          // THE INTEGERS ARE PINNED HERE AND NOWHERE ELSE. Everything above
          // maps by NAME, so this is the single place an upstream renumbering
          // is caught.
          const lt = db.LINETYPE || {};
          const pl = db.PLACEMENT || {};
          const integersPinned =
            lt.SOLID === 0 &&
            lt.DOTTED === 1 &&
            lt.NOTE === 2 &&
            lt.SOLID_CROSS === 3 &&
            lt.DOTTED_CROSS === 4 &&
            lt.SOLID_OPEN === 5 &&
            lt.DOTTED_OPEN === 6 &&
            lt.SOLID_POINT === 24 &&
            lt.DOTTED_POINT === 25 &&
            lt.AUTONUMBER === 26 &&
            lt.BIDIRECTIONAL_SOLID === 33 &&
            lt.BIDIRECTIONAL_DOTTED === 34 &&
            pl.LEFTOF === 0 &&
            pl.RIGHTOF === 1 &&
            pl.OVER === 2;

          const rawEntryCount = Array.isArray(db.getMessages())
            ? db.getMessages().length
            : -1;

          const delivery = normaliseSequence(diagram);
          const messages = delivery.events.filter((e) => e.kind === "message");
          const heads = messages.map((m) => m.line + "/" + m.head).join(" ");

          const baseAssertions = [
            [
              "the nine db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "db.LINETYPE and db.PLACEMENT still carry the 3 September 2026 " +
                "integers for every constant this surface maps",
              integersPinned,
            ],
            [
              "the title and both accessible fields survive the read",
              delivery.title === "SelfCheck sequence title" &&
                delivery.accTitle === "SelfCheck sequence acc title" &&
                delivery.accDescr === "SelfCheck sequence acc descr",
            ],
            [
              "four participants arrive in declaration order, with display " +
                "names and kinds",
              delivery.participants.length === 4 &&
                delivery.participants[0].id === "SA" &&
                delivery.participants[0].name === "SelfCheck actor" &&
                delivery.participants[0].kind === "actor" &&
                delivery.participants[1].id === "SB" &&
                delivery.participants[1].kind === "participant" &&
                delivery.participants[2].id === "SC" &&
                delivery.participants[3].name === "SelfCheck dee",
            ],
            [
              "RULING R15: boxIndex is the INDEX of the owning box — 0 for " +
                "the boxed actor and its neighbour, 1 for the member of the " +
                "UNNAMED box, and null for the participant in no box",
              delivery.participants[0].boxIndex === 0 &&
                delivery.participants[1].boxIndex === 0 &&
                delivery.participants[2].boxIndex === 1 &&
                delivery.participants[3].boxIndex === null &&
                Object.prototype.hasOwnProperty.call(
                  delivery.participants[0],
                  "box"
                ) === false,
            ],
            [
              "two boxes arrive in declaration order — the named one with its " +
                "two members, the unnamed one with an EMPTY NAME and its one " +
                "member",
              delivery.boxes.length === 2 &&
                delivery.boxes[0].name === "SelfCheck box" &&
                delivery.boxes[0].members.length === 2 &&
                delivery.boxes[0].members[0] === "SA" &&
                delivery.boxes[0].members[1] === "SB" &&
                delivery.boxes[1].name === "" &&
                delivery.boxes[1].members.length === 1 &&
                delivery.boxes[1].members[0] === "SC",
            ],
            [
              "the created participant carries message ordinal one, converted " +
                "from the delivered list index, and nothing is destroyed",
              delivery.participants[3].createdAt === 1 &&
                delivery.participants[3].destroyedAt === null &&
                delivery.participants[0].createdAt === null,
            ],
            [
              "RULING R17: BOTH autonumber directives arrive, in source " +
                "order, at atOrdinal 1 and 3 — the first with its start and " +
                "step, the second the trailing `off`",
              Array.isArray(delivery.autonumber) &&
                delivery.autonumber.length === 2 &&
                delivery.autonumber[0].atOrdinal === 1 &&
                delivery.autonumber[0].start === 3 &&
                delivery.autonumber[0].step === 2 &&
                delivery.autonumber[0].visible === true &&
                delivery.autonumber[1].atOrdinal === 3 &&
                delivery.autonumber[1].start === null &&
                delivery.autonumber[1].step === null &&
                delivery.autonumber[1].visible === false,
            ],
            [
              "THE TEN ARROW FORMS: each unspaced form is typed distinctly, in " +
                "source order, and none degrades to another",
              heads ===
                "solid/arrow solid/open solid/arrow dotted/open dotted/arrow " +
                  "solid/cross dotted/cross solid/async dotted/async " +
                  "solid/bidirectional dotted/bidirectional solid/arrow solid/arrow",
            ],
            [
              "the note spans two actors, with its placement and text",
              delivery.events.filter((e) => e.kind === "note").length === 1 &&
                delivery.events.find((e) => e.kind === "note").placement ===
                  "over" &&
                delivery.events.find((e) => e.kind === "note").actors.length ===
                  2 &&
                delivery.events.find((e) => e.kind === "note").actors[0] ===
                  "SA" &&
                delivery.events.find((e) => e.kind === "note").text ===
                  "SelfCheck note",
            ],
            [
              "the alt arrives as a balanced start, branch and end, with both " +
                "conditions",
              delivery.events.filter((e) => e.kind === "blockStart").length ===
                1 &&
                delivery.events.find((e) => e.kind === "blockStart").block ===
                  "alt" &&
                delivery.events.find((e) => e.kind === "blockStart").label ===
                  "SelfCheck alt cond" &&
                delivery.events.find((e) => e.kind === "blockBranch").label ===
                  "SelfCheck else cond" &&
                delivery.events.filter((e) => e.kind === "blockEnd").length === 1,
            ],
            [
              "events.length and counts.messages are what the source declares, " +
                "and NEITHER autonumber directive is an event",
              rawEntryCount === 19 &&
                delivery.events.length === 17 &&
                delivery.counts.messages === 13 &&
                messages.length === 13,
            ],
            [
              "the structure counts read one alternative and nothing else",
              delivery.counts.loops === 0 &&
                delivery.counts.alternatives === 1 &&
                delivery.counts.optionalSections === 0 &&
                delivery.counts.parallelSections === 0 &&
                delivery.counts.criticalSections === 0 &&
                delivery.counts.breaks === 0,
            ],
            [
              "the crossCheck carries one activate flag per message, ordinals " +
                "one to thirteen, and none is set in this fixture",
              delivery.crossCheck.activateFlags.length === 13 &&
                delivery.crossCheck.activateFlags[0].ordinal === 1 &&
                delivery.crossCheck.activateFlags[12].ordinal === 13 &&
                delivery.crossCheck.activateFlags.every(
                  (f) => f.activate === false
                ),
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because the title store is shared and a second
          // parse overwrites it. Delivered through normaliseSequence itself,
          // so the rows test the transform on the path a consumer reads.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(SEQUENCE_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakDelivery = normaliseSequence(breakDiagram);
              const breakMessages = breakDelivery.events.filter(
                (e) => e.kind === "message"
              );
              const breakNotes = breakDelivery.events.filter(
                (e) => e.kind === "note"
              );
              const box = (i) => breakDelivery.boxes[i] || {};
              const person = (i) => breakDelivery.participants[i] || {};
              const message = (i) => breakMessages[i] || {};
              const note = (i) => breakNotes[i] || {};
              // The label of the first block event of one kind and block, or
              // null when there is none, so a missing event cannot read as an
              // empty label.
              const blockLabel = (kind, block) => {
                const found = breakDelivery.events.find(
                  (e) => e.kind === kind && e.block === block
                );
                return found ? found.label : null;
              };
              return baseAssertions.concat([
                [
                  "a typed break reads as one space on a box name, a " +
                    "participant name, a message and a note (item 82)",
                  box(0).name === "one two" &&
                    person(0).name === "three four" &&
                    message(0).text === "nine ten" &&
                    note(0).text === "thirteen fourteen",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "a box name, a participant name, a message and a note " +
                    "(item 82)",
                  box(1).name === "five<br>six" &&
                    person(1).name === "seven<br>eight" &&
                    message(1).text === "eleven<br>twelve" &&
                    note(1).text === "fifteen<br>sixteen",
                ],
                [
                  "a typed break in the TITLE arrives as written, because " +
                    "the canvas prints it there (item 82)",
                  breakDelivery.title === "SelfCheck break<br>title",
                ],
                [
                  "a typed break reads as one space on a block opener and on " +
                    "a branch label, and a break-only block label arrives " +
                    "empty (item 82, enactment 5)",
                  blockLabel("blockStart", "loop") === "seventeen eighteen" &&
                    blockLabel("blockBranch", "alt") ===
                      "twentythree twentyfour" &&
                    blockLabel("blockStart", "opt") === "",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "a block opener (item 82, enactment 5)",
                  blockLabel("blockStart", "alt") === "twenty<br>one",
                ],
              ]);
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    sequenceSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Sequence self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's sequence internals no longer " +
              "match the 2 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust sequence adapter output."
          );
          sequenceHealthy = false;
          return false;
        }

        logInfo(
          "Sequence self-check passed: accessor, enumeration, arrow-form, " +
            "block-balance and lifecycle assertions all hold"
        );
        sequenceHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Sequence self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        sequenceHealthy = false;
        return false;
      });

    return sequenceSelfCheckPromise;
  }

  /**
   * Report the sequence surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the sequence self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isSequenceHealthy() {
    return sequenceHealthy;
  }

  // ---------------------------------------------------------------------
  // BLOCK — the tenth surface, and the third read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE, unlike xychart and quadrant. Every
  // fact the canvas draws is in the db: ids, labels, shape names, nesting,
  // per-composite column declarations, spans, spaces and their widths, edge
  // endpoints, edge labels, edge arrow kinds, block-arrow directions, class
  // names, class definitions and inline styles. Three facts live in the
  // source and NOT in the db, and a sighted reader is given none of them
  // either — a frontmatter `title:` is discarded by the db, by Mermaid's
  // shared store AND by the canvas; the link spellings `---`, `-->` and
  // `<-->` are drawn identically at the markers; and an author's own
  // accTitle/accDescr is unauthorable, being a hard parse error. So there is
  // nothing for a source reader to recover. Measured in
  // docs/mermaid-item-80-census-1-2026-09-05.md §§ Q4, Q5 and Q9. This is the
  // SEQUENCE answer, not the quadrant one.
  //
  // NO title, accTitle OR accDescr FIELD — a MEASURED ABSENCE, 5 September
  // 2026, not an omission (census § Q5 and its CONTRADICTION 2). The block db
  // carries NO COMMON TRIO AT ALL: `getDiagramTitle`, `getAccTitle` and
  // `getAccDescription` are `undefined` on it, on every one of the census's
  // eight parsed probes, and `Object.keys(diagram)` has no title-shaped member
  // either. `accTitle:` and `accDescr:` are HARD PARSE ERRORS in this grammar
  // — the whole diagram fails to render — and a frontmatter `title:` reaches
  // neither the db, nor the shared store, nor the canvas, on a read route
  // positively controlled in the same session. A field here would therefore be
  // a FICTION: permanently empty, and implying an author route that does not
  // exist. Do not "complete" the shape by adding them.
  //
  // THE DECODE IS decodeAuthorText ON BOTH LABEL KINDS, and each half was
  // measured rather than inherited from the other. Block labels: the census's
  // § Q6 read nine probes at securityLevel "strict" and found a
  // <foreignObject> HTML subtree on every one, with ZERO <text> elements, and
  // decodeAuthorText agreeing with the canvas on all four author-typed
  // character references where decodePlaceholders disagreed on three. EDGE
  // labels were measured SEPARATELY in this session, 5 September 2026, because
  // the block-label answer does not transfer: on the census's P5 rendered at
  // strict the SVG carries 10 <foreignObject> and 0 <text>, the one labelled
  // edge's text sits in 1 foreignObject and 0 SVG text, and its host chain is
  // g.edgeLabel > g.label > foreignObject > div > span.edgeLabel. A second
  // probe confirmed the bytes: an edge label written `Amp &amp; edge` draws
  // `Amp & edge` and `Quot &quot;x&quot; edge` draws `Quot "x" edge`, which is
  // decodeAuthorText's output and not decodePlaceholders'. Both halves take
  // the same transform, for the same measured reason.
  //
  // THE DB IS A SHARED SINGLETON, AND THE WHOLE PAYLOAD CROSSES — this is the
  // register item 21 hazard in its strongest form. Census § Q8 measured
  // `dbA === dbB` true across two parses, with the first handle's getters
  // returning the SECOND diagram's blocks afterwards. Unlike sequence, where
  // only the shared scalar trio crosses, block has no per-instance half at
  // all. Every read below therefore happens inside this parse's own queue slot
  // and is copied into the adapter's own objects in the SAME TICK, before the
  // slot ends. See the eager snapshot in normaliseBlock.
  //
  // A RENDER MUTATES THE OBJECTS THE DB HANDS OUT (census § Q10), adding a
  // pixel `size` and a LIVE d3 selection holding DOM nodes, plus an
  // `intersect` function. That is why the copy below takes a NAMED KEY LIST
  // and must never become a structured clone of the db's block: a clone would
  // drag a d3 selection and a function across, and a later consumer would be
  // reading post-layout geometry it must never narrate. Nothing post-layout is
  // delivered by this surface at all — there is no crossCheck field, because
  // there is no authored value to corroborate against a laid-out one. `size`
  // is cross-check material only, and this surface does not carry it.
  //
  // WHAT `columns` MEANS HERE, and why getColumns is never called. Census § Q2:
  // `getColumns(id)` is a LAYOUT CONVENIENCE, not the author's declaration — it
  // returns `children.length` for a composite the author left alone, so a
  // two-child `block:grp` reports 2 whether the author wrote `columns 2` or
  // wrote nothing at all. The declaration is the block's OWN `columns` key,
  // which a nested composite carries only when declared and root always
  // carries, defaulting to -1. Both -1 and absent deliver null here, meaning
  // "not declared", so a narration can say "laid out in two columns" only when
  // the author said so.
  const BLOCK_COLUMNS_UNSET = -1;

  // The db's own `type` string for an empty cell. Named because the width
  // reconciliation in copyBlock branches on it, and a bare string literal in
  // that branch would read as an arbitrary choice rather than as the db's own
  // vocabulary. Delivered verbatim as the block's `shape`.
  const BLOCK_SHAPE_SPACE = "space";

  // Every delivered space cell spans exactly ONE column. Measured 13 September
  // 2026 across `space`, `space:1`, `space:2`, `space:3` and `space:2 space`,
  // the gap width read off the canvas against a control's own column centres
  // (register item 80, unruled edge U1). The db hands out one cell per column
  // the gap occupies, so the run's total is the CELL COUNT and never a sum of
  // the `width` values — which carry the run's declared K on every one of its
  // cells.
  const BLOCK_SPACE_COLUMNS_PER_CELL = 1;

  // The nine keys a delivered block carries, in order. Named as a constant
  // because the self-check asserts the delivered key set EXACTLY against it:
  // that is the assertion which catches a stray `size` from a render, and any
  // future field added here without a field-manifest row.
  const BLOCK_DELIVERED_KEYS = Object.freeze([
    "id",
    "label",
    "shape",
    "children",
    "widthInColumns",
    "columns",
    "classes",
    "styles",
    "directions",
  ]);

  let blockMemoCode = null;
  let blockMemoPromise = null;
  let blockHealthy = null;
  let blockSelfCheckStarted = false;
  let blockSelfCheckPromise = null;

  /**
   * Read a block's OWN declared column count.
   *
   * NEVER getColumns(id) — see the surface comment above. Absent and the
   * sentinel -1 both mean "the author declared nothing" and both deliver null,
   * so a consumer has ONE absent case rather than two.
   *
   * @param {Object|null} raw - A db block object, or null
   * @returns {number|null} The declared count, or null when undeclared
   */
  function blockDeclaredColumns(raw) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, "columns")) {
      return null;
    }
    const value = raw.columns;
    if (typeof value !== "number" || value === BLOCK_COLUMNS_UNSET) {
      return null;
    }
    return value;
  }

  /**
   * Copy ONE db block into this surface's own object, recursing into children.
   *
   * THE KEY LIST IS CLOSED AND THAT IS THE POINT (census § Q10). Only the nine
   * keys in BLOCK_DELIVERED_KEYS are read; nothing is spread, assigned wholesale
   * or cloned, so a `size` and a live d3 selection added by a render cannot
   * cross into the delivery even if this runs after one.
   *
   * A SPACE CELL'S SPAN IS ONE COLUMN, AND `width` IS NOT ITS SPAN.
   * CORRECTED 13 September 2026 (register item 80, unruled edge U1). This
   * comment previously read: "Both are the author's declared span in columns,
   * so both arrive here under the single delivered name `widthInColumns`",
   * and the code mapped `width` onto `widthInColumns` for a space cell. THAT
   * WAS WRONG, and surface contradiction C1 recorded the mapping as the
   * resolution of a field-name gap when it was in fact a value error.
   *
   * MEASURED, six sources on the pinned build, the column count read off the
   * CANVAS against a same-width control's own column centres rather than from
   * pixels: `space` and `space:1` deliver ONE cell of width 1 and draw a
   * ONE-column gap; `space:2` delivers TWO cells EACH of width 2 and draws a
   * TWO-column gap; `space:3` delivers THREE cells each of width 3 and draws a
   * THREE-column gap; `space:2 space` delivers three cells and draws three
   * columns. So the db hands out ONE CELL PER COLUMN THE GAP OCCUPIES, and
   * `width` is the RUN'S declared K repeated on each of the K cells — never
   * that cell's own span. Mapping it onto `widthInColumns` gave every cell of
   * a `space:2` a span of two, consumed four columns where the canvas draws
   * two, and pushed the following block onto a row it is not on.
   *
   * A DECLARED BLOCK is unaffected: `wide["W"]:3` carries `widthInColumns: 3`
   * on the block itself and is read straight through. `width` is now read
   * NOWHERE — it was only ever present on space cells, and its value is not a
   * span.
   *
   * ONE TRAP THE COPY STILL PRESERVES, because repairing it would hide the
   * db's own behaviour from a consumer that has to know it: a space block's
   * `label` is its OWN GENERATED PARENT ID, which is machine text,
   * non-deterministic between parses, and must never be spoken.
   *
   * @param {Object} raw - A db block object
   * @returns {Object} The delivered block
   */
  function copyBlock(raw) {
    const id = typeof raw.id === "string" ? raw.id : "";

    // LABEL. decodeAuthorText, per the ruling above. A block whose db label is
    // ABSENT delivers the id as the db gives it — and it should be recorded
    // which case the db actually produces, because the answer is "none of the
    // delivered ones". Measured 5 September 2026 across four sources: every
    // leaf, every space block and every composite carries a `label` key. A
    // composite's is the EMPTY STRING, not the id and not absent, so it is
    // delivered as "" and the narration module owns the fallback phrase. Only
    // ROOT has no label, and root is never delivered as a block. The fallback
    // is therefore a defence, not a live path.
    //
    // ITEM 82 (2 October 2026): the label is a position whose canvas DRAWS a
    // break, so decodeAuthorTextBreaks reads a typed tag as a space and an
    // escaped one as written. A space cell's generated-id label and a
    // composite's empty label carry no tag and pass through byte-identically.
    //
    // ENACTMENT 4 (3 October 2026): a label that is only a break is delivered
    // as one space, so the module reads it as a present label that draws
    // nothing (R14 LIFTED) and not as the absent label `""`.
    //
    // ITEM 82, L2 (6 October 2026, enactment 3): the label is read through
    // readLabelWithLinks, so a link the picture draws arrives as `segments`
    // beside the unchanged label. The present-but-empty substitution is
    // applied to the label exactly as before, and a label that is only that
    // substitution carries no segments.
    const labelRead =
      typeof raw.label === "string"
        ? readLabelWithLinks(raw.label, BLOCK_DRAWN_MARKUP)
        : null;
    const label = labelRead
      ? raw.label !== "" && labelRead.label === ""
        ? PRESENT_BUT_EMPTY_LABEL
        : labelRead.label
      : id;
    const labelSegments =
      labelRead && labelRead.segments && label === labelRead.label
        ? labelRead.segments
        : null;

    // A SPACE CELL DEFAULTS TO ONE COLUMN when the db gives it no
    // `widthInColumns`, which on this build is every time. The default is
    // stated rather than the raw key being read through to null, because a
    // consumer laying out a grid has to consume SOMETHING for a cell the
    // canvas draws a column for, and 1 is what the canvas draws. `raw.width`
    // is deliberately not consulted — see the block comment above.
    const widthInColumns =
      typeof raw.widthInColumns === "number"
        ? raw.widthInColumns
        : raw.type === BLOCK_SHAPE_SPACE
          ? BLOCK_SPACE_COLUMNS_PER_CELL
          : null;

    return {
      id: id,
      label: label,
      ...(labelSegments ? { segments: labelSegments } : {}),
      // THE DB'S OWN TYPE STRING, VERBATIM. Naming the vocabulary — deciding
      // that `stadium` is spoken one way and `lean_right` another — is a later
      // session's table, and inventing one here would put a wording decision
      // in the adapter where no fixture could reach it.
      shape: typeof raw.type === "string" ? raw.type : "",
      // [] FOR A LEAF, so the shape is uniform and a consumer never branches
      // on the presence of a key. A leaf carries no `children` key at all on
      // the db; a space block carries an empty array.
      children: Array.isArray(raw.children) ? raw.children.map(copyBlock) : [],
      widthInColumns: widthInColumns,
      columns: blockDeclaredColumns(raw),
      // Assigned class NAMES, and raw declaration strings, each present on the
      // db only when something was assigned. Both are the AUTHOR'S OWN
      // declarations rather than computed values, so unlike `size` they are
      // honest to read — but they are paint, and whether paint is ever
      // narrated is the presentation standard's question, not this file's.
      classes: Array.isArray(raw.classes) ? raw.classes.slice() : [],
      styles: Array.isArray(raw.styles) ? raw.styles.slice() : [],
      // AN ARRAY FOR block_arrow SHAPES, [] OTHERWISE. Measured 5 September
      // 2026: `ar1<["Right"]>(right)` delivers ["right"] and `(x)` delivers
      // ["x"], while every other kind carries `directions` as an OWN KEY
      // HOLDING undefined — invisible to JSON.stringify, which is why it was
      // read with Object.keys. A space block has no such key at all.
      directions: Array.isArray(raw.directions) ? raw.directions.slice() : [],
    };
  }

  /**
   * Snapshot the classDef table.
   *
   * The db delivers a MAP keyed by class name, whose values are db-owned
   * objects; this returns a plain object keyed the same way, with each entry's
   * arrays copied, so nothing in the delivery references anything the next
   * parse can replace. A Map is not delivered because the shape a consumer
   * reads should not depend on a container type the db happens to have chosen.
   *
   * @param {Map|null} rawClasses - db.getClasses()
   * @returns {Object} Class-name-keyed table of { id, styles, textStyles }
   */
  function copyBlockClasses(rawClasses) {
    const table = {};
    if (!rawClasses || typeof rawClasses.forEach !== "function") {
      return table;
    }
    rawClasses.forEach((value, name) => {
      table[name] = {
        id: value && typeof value.id === "string" ? value.id : String(name),
        styles: value && Array.isArray(value.styles) ? value.styles.slice() : [],
        textStyles:
          value && Array.isArray(value.textStyles) ? value.textStyles.slice() : [],
      };
    });
    return table;
  }

  /**
   * Normalise one Mermaid block diagram into the tenth surface's delivery.
   *
   * EAGER SNAPSHOT (the singleton defence, census § Q8): every db accessor is
   * called ONCE here, inside the parse's own .then and behind the adapter-wide
   * queue, and each result is mapped into this adapter's own objects in the
   * same tick. Nothing in the returned object references a db-owned object, and
   * no consumer may ever go back to the db later — on this type a second parse
   * replaces the WHOLE payload, not merely the shared scalars.
   *
   * Every field is always present — "" or [] or null rather than absent — so a
   * consumer has one absent case per field and never an undefined member.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised block delivery
   */
  function normaliseBlock(diagram) {
    const db = diagram.db;

    // The four reads. Everything below maps these and nothing else.
    // `getBlocks()` is ROOT'S CHILDREN as a tree, in declaration order, with
    // nesting preserved to every depth (census § Q1). `getBlocksFlat()` is the
    // same objects in a depth-first pre-order walk with ROOT FIRST, and it is
    // read here for one reason only: root's own `columns` key, which is the
    // author's top-level declaration and is on no other object.
    const rawBlocks = db.getBlocks();
    const rawFlat = db.getBlocksFlat();
    const rawEdges = db.getEdges();
    const rawClasses = db.getClasses();

    const rawRoot = Array.isArray(rawFlat) && rawFlat.length > 0 ? rawFlat[0] : null;

    const blocks = (Array.isArray(rawBlocks) ? rawBlocks : []).map(copyBlock);

    const edges = (Array.isArray(rawEdges) ? rawEdges : []).map((edge) => {
      // Item 82, L2 (enactment 3): read once for the label and its links, in
      // the same tick as the rest of the snapshot.
      const labelRead =
        typeof edge.label === "string"
          ? readLabelWithLinks(edge.label, BLOCK_DRAWN_MARKUP)
          : null;
      return {
      // The id is COMPOSED BY MERMAID as `<n>-<start>-<end>` and the endpoints
      // are the AUTHOR'S OWN ids (census § Q4), so an edge is quotable against
      // the blocks above without a lookup table.
      id: typeof edge.id === "string" ? edge.id : "",
      start: typeof edge.start === "string" ? edge.start : null,
      end: typeof edge.end === "string" ? edge.end : null,
      // decodeAuthorText, on the foreignObject measurement recorded at the top
      // of this surface. An unlabelled edge delivers "" from the db, not
      // undefined or null, and "" is passed through unchanged.
      // Item 82: an edge label is a break-drawing position too, so it takes
      // decodeAuthorTextBreaks. Item 82, markup (5 October 2026): and drawn
      // formatting is read as its text (BLOCK_DRAWN_MARKUP); a tag-only label
      // arrives empty, which the module reads as an unlabelled arrow.
      label: labelRead ? labelRead.label : "",
      ...(labelRead && labelRead.segments
        ? { segments: labelRead.segments }
        : {}),
      // THE ARROW-TYPE STRINGS ARE DELIVERED VERBATIM AND ARE FAITHFUL, which
      // is worth stating because they look lossy. On Mermaid 11.6.0 `---` and
      // `<-->` are both typed `arrow_point` at the end and `arrow_open` at the
      // start, exactly as a plain `-->` is — and the CANVAS AGREES: rendered
      // at strict, the plain `---` carries the same `marker-end` and a null
      // `marker-start` as `-->`, so the db is a truthful record of what is
      // drawn rather than a dropped distinction (census § Q4). On 11.17.2 the
      // db distinguishes them (an empty `arrowTypeEnd` for no end head,
      // `arrow_point` at the start for a start head) and the canvas agrees
      // on all 53 spellings measured on 30 September 2026.
      arrowTypeStart:
        typeof edge.arrowTypeStart === "string" ? edge.arrowTypeStart : null,
      arrowTypeEnd:
        typeof edge.arrowTypeEnd === "string" ? edge.arrowTypeEnd : null,
      // LINE STYLE, delivered verbatim when the db carries it and null when it
      // does not. 11.17.2 adds `pattern` ("solid" or "dotted") and `thickness`
      // ("normal" or "thick"), and the canvas draws both; 11.6.0 carries
      // neither, so the key is present and null there rather than absent.
      pattern: typeof edge.pattern === "string" ? edge.pattern : null,
      thickness: typeof edge.thickness === "string" ? edge.thickness : null,
      };
    });

    return {
      // `diagramType` rather than `type`, because `type` is this surface's
      // per-block SHAPE key and one word cannot honestly mean both. Named by
      // the design seat's dispatch of 5 September 2026; it is the only surface
      // of the ten whose discriminator is spelt this way, and the field
      // manifest carries it under that name.
      diagramType: "block",
      blocks: blocks,
      rootColumns: blockDeclaredColumns(rawRoot),
      edges: edges,
      classes: copyBlockClasses(rawClasses),
    };
  }

  /**
   * Parse a block diagram and deliver the normalised shape.
   *
   * Same contract as the other nine surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every db
   * read happens inside this call's own queue slot. On this type the queue is
   * load-bearing for the payload itself and not only for the shared scalars —
   * the db is a singleton whose whole contents a concurrent parse replaces.
   *
   * @param {string} code - The Mermaid block source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseBlock(code) {
    if (!blockSelfCheckStarted) {
      runBlockSelfCheck();
    }

    if (code === blockMemoCode && blockMemoPromise) {
      logDebug("Returning memoised block parse for identical code string");
      return blockMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(`Block parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Block parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const block = normaliseBlock(diagram);
          logDebug(
            `Block parse delivered after ${Math.round(performance.now() - startedAt)}ms: ` +
              `${block.blocks.length} top-level block(s), ${block.edges.length} edge(s), ` +
              `rootColumns ${block.rootColumns}`
          );
          return block;
        })
        .catch((error) => {
          logDebug(
            `Block parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    blockMemoCode = code;
    blockMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: root declaring `columns 2`, three leaf blocks, one
   * composite carrying one child and declaring NO columns of its own, a
   * `space:2`, and one labelled edge between two of the leaves.
   *
   * THE `space:2` IS THE U1 WITNESS, added 13 September 2026. It is the one
   * shape in this fixture whose db keys DISAGREE with the delivered ones: the
   * db hands out two cells each carrying `width: 2` and no `widthInColumns`,
   * and the delivery must answer ONE column for each. A fixture carrying only
   * declared blocks passes whether the width reconciliation is right or wrong,
   * which is why this one does not.
   *
   * THE UNDECLARED COMPOSITE IS THE POINT. `getColumns("scGroup")` returns 1 on
   * this fixture — its child count — which is indistinguishable from an author
   * who wrote `columns 1`. The delivered value must be null, and this is the
   * assertion that catches a future editor "simplifying" the own-key read into
   * a getColumns call. A fixture whose composite declared its own columns would
   * pass either way, which is why this one does not.
   *
   * ASCII only, every string distinctive and prefixed SelfCheck, so a
   * cross-delivery from another diagram NAMES ITS SOURCE rather than merely
   * looking wrong.
   */
  const BLOCK_SELF_CHECK_FIXTURE = [
    "block-beta",
    "    columns 2",
    '    scAlpha["SelfCheck alpha"]',
    '    scBravo["SelfCheck bravo"]',
    '    scCharlie["SelfCheck charlie"]',
    "    block:scGroup",
    '        scDelta["SelfCheck delta"]',
    "    end",
    "    space:2",
    '    scAlpha -- "SelfCheck edge" --> scBravo',
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A typed break and an author-escaped one on both block
  // positions whose canvas draws a break: a block label and an edge label.
  const BLOCK_BREAK_SELF_CHECK_FIXTURE = [
    "block-beta",
    "    columns 2",
    '    scBrk["one<br>two"]',
    '    scEsc["three&lt;br&gt;four"]',
    '    scBrk -- "five<br>six" --> scEsc',
    '    scEsc -- "seven&lt;br&gt;eight" --> scBrk',
    // Item 82, markup: appended after the break rows so every index above
    // holds. A typed tag, an author-escaped tag, a tag-only label and
    // emphasis (which block PRINTS, so it is left as written).
    '    scTyp["<b>x</b>"]',
    '    scEmp["**y**"]',
    '    scEsm["&lt;b&gt;z&lt;/b&gt;"]',
    '    scNil["<u></u>"]',
    '    scTyp -- "<i>r</i>" --> scEmp',
    '    scEmp -- "&lt;i&gt;q&lt;/i&gt;" --> scEsm',
    '    scEsm -- "<u></u>" --> scNil',
    '    scNil -- "**e**" --> scTyp',
  ].join("\n");

  // Item 82, L2 (6 October 2026, enactment 3): the block link rows. A source
  // of its own, parsed in its own queue slot after the two above, so every
  // existing fixture and every count asserted against it stays as it was (the
  // concurrency lane quotes the first verbatim). Each link form is the
  // measurement's (docs/mermaid-item-82-l2-measure-2026-10-05.md section 1);
  // a block label and an edge label are the two positions that can carry one.
  const BLOCK_LINK_SELF_CHECK_FIXTURE = [
    "block-beta",
    "    columns 2",
    "    L1[\"Zq <a href='https://example.org/a b?x=1&y=2'>text</a>\"]",
    "    L2[\"<a href='https://example.org'>one</a> and <a href='https://example.net'>two</a>\"]",
    "    L3[\"<a href='https://example.org'><b>bold link</b></a>\"]",
    "    L4[\"<a href='https://example.org'>dup</a> and dup\"]",
    "    L5[\"<a href='https://example.org/a&quot;b'>quote in href</a>\"]",
    "    L6[\"<a href='/relative'>r</a> <a href='//example.org/p'>p</a> <a href='HTTPS://EXAMPLE.ORG/X'>upper</a>\"]",
    "    L7[\"<a href='javascript:alert(1)'>j</a> <a href='mailto:a@example.org'>m</a> <a>none</a> <a href='https://example.org'></a>.\"]",
    "    L8[\"<a href='https://example.org'></a>\"]",
    "    L1 -- \"Zq <a href='https://example.org/e'>edge link</a>\" --> L2",
    "    L2 -- \"<a href='https://example.org'></a>\" --> L3",
  ].join("\n");

  /**
   * The link rows of the block self-check, over the delivered link fixture.
   * @param {Object} graph - The normalised block link fixture
   * @returns {Array} Assertion rows
   */
  function blockLinkAssertions(graph) {
    const same = (actual, expected) =>
      JSON.stringify(actual) === JSON.stringify(expected);
    const block = (id) => graph.blocks.find((b) => b.id === id);
    const segmented = []
      .concat(graph.blocks, graph.edges)
      .filter((element) => element.segments);
    return [
      [
        "link: a block label's link, its & decoded once and its space kept (m6)",
        !!block("L1") &&
          block("L1").label === "Zq text" &&
          same(block("L1").segments, [
            { text: "Zq " },
            { text: "text", href: "https://example.org/a b?x=1&y=2" },
          ]),
      ],
      [
        "link: an edge label's link (m6 form on an edge)",
        !!graph.edges[0] &&
          graph.edges[0].label === "Zq edge link" &&
          same(graph.edges[0].segments, [
            { text: "Zq " },
            { text: "edge link", href: "https://example.org/e" },
          ]),
      ],
      [
        "link: a nested bold link reads as 'bold link' (l2)",
        !!block("L3") &&
          block("L3").label === "bold link" &&
          same(block("L3").segments, [
            { text: "bold link", href: "https://example.org" },
          ]),
      ],
      [
        "link: two links in one label, in order (l1)",
        !!block("L2") &&
          same(block("L2").segments, [
            { text: "one", href: "https://example.org" },
            { text: " and " },
            { text: "two", href: "https://example.net" },
          ]),
      ],
      [
        "link: the first of two identical words is the linked one (l3)",
        !!block("L4") &&
          same(block("L4").segments, [
            { text: "dup", href: "https://example.org" },
            { text: " and dup" },
          ]),
      ],
      [
        "link: the quote entity in an href is decoded once (l7)",
        !!block("L5") &&
          same(block("L5").segments, [
            { text: "quote in href", href: 'https://example.org/a"b' },
          ]),
      ],
      [
        "link: relative, protocol-relative and upper-case-scheme hrefs are " +
          "admitted as written (m9, l6, l4)",
        !!block("L6") &&
          same(block("L6").segments, [
            { text: "r", href: "/relative" },
            { text: " " },
            { text: "p", href: "//example.org/p" },
            { text: " " },
            { text: "upper", href: "HTTPS://EXAMPLE.ORG/X" },
          ]),
      ],
      [
        "link: javascript:, mailto:, no href and an empty link are plain " +
          "text, and an empty link leaves no text (m7, m8, l8, m10)",
        !!block("L7") &&
          block("L7").label === "j m none ." &&
          same(block("L7").segments, [{ text: "j m none ." }]),
      ],
      [
        "link: a label that is only an empty link is the present-but-empty " +
          "one space and carries no segments; the same on an edge is empty " +
          "text and no linked segment (m10)",
        !!block("L8") &&
          block("L8").label === PRESENT_BUT_EMPTY_LABEL &&
          block("L8").segments === undefined &&
          !!graph.edges[1] &&
          graph.edges[1].label === "" &&
          same(graph.edges[1].segments, []),
      ],
      [
        "link: the segment texts join to the delivered label, everywhere",
        segmented.length === 9 &&
          segmented.every(
            (element) =>
              element.segments.map((s) => s.text).join("") === element.label
          ),
      ],
    ];
  }

  /**
   * Parse the block link fixture in its own queue slot and return its rows. A
   * rejection is one failing row, not a throw.
   * @returns {Promise<Array>} Assertion rows
   */
  function runBlockLinkRows() {
    const run = () =>
      window.mermaid.mermaidAPI
        .getDiagramFromText(BLOCK_LINK_SELF_CHECK_FIXTURE)
        .then((diagram) => blockLinkAssertions(normaliseBlock(diagram)));
    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued.catch((error) => [
      [`block link fixture parses (rejected: ${error && error.message})`, false],
    ]);
  }

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the block surface unhealthy, and resolves
   * false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the block health verdict
   */
  function runBlockSelfCheck() {
    if (blockSelfCheckPromise) {
      return blockSelfCheckPromise;
    }
    blockSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            BLOCK_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getBlocks === "function" &&
            typeof db.getBlocksFlat === "function" &&
            typeof db.getEdges === "function" &&
            typeof db.getClasses === "function" &&
            typeof db.getColumns === "function";

          // THE MEASURED ABSENCE, PINNED. The block db has no common trio, and
          // this surface's decision to deliver no title, accTitle or accDescr
          // rests on that. A Mermaid upgrade that ADDS any of the three should
          // fail here loudly, because it reopens the decision — a silently
          // available getter would leave the surface delivering a fiction of
          // absence rather than a measured one.
          const trioStillAbsent =
            typeof db.getDiagramTitle === "undefined" &&
            typeof db.getAccTitle === "undefined" &&
            typeof db.getAccDescription === "undefined";

          // Raw reads, taken in this same slot, for the two structural facts
          // the delivery cannot itself expose: that the flat walk starts at
          // root, and that getColumns would have LIED about the composite.
          const rawFlat = db.getBlocksFlat();
          const rawRoot = Array.isArray(rawFlat) ? rawFlat[0] : null;
          const rootIsFirst = !!rawRoot && rawRoot.id === "root";
          const getColumnsWouldLie = db.getColumns("scGroup") === 1;

          // The two RAW space cells, read in this same slot. The new space
          // assertion below needs both halves: that the db really did hand out
          // two cells carrying `width: 2` and NO `widthInColumns`, and that
          // the delivery answers 1 for each anyway. Without the raw half, a
          // build that simply stopped delivering `width` would satisfy the
          // delivered half for a reason that has nothing to do with the fix.
          const rawSpaces = (rawRoot && Array.isArray(rawRoot.children)
            ? rawRoot.children
            : []
          ).filter((b) => b && b.type === BLOCK_SHAPE_SPACE);

          const delivery = normaliseBlock(diagram);
          const [alpha, bravo, charlie, group, space1, space2] = delivery.blocks;
          const child = group && group.children ? group.children[0] : null;
          const edge = delivery.edges[0];
          const rawEdge = Array.isArray(db.getEdges()) ? db.getEdges()[0] : null;
          const keysOf = (b) => (b ? Object.keys(b).join(",") : "");
          const expectedKeys = BLOCK_DELIVERED_KEYS.join(",");

          const baseAssertions = [
            [
              "the five db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "the block db still carries NO getDiagramTitle, getAccTitle or " +
                "getAccDescription — the measured absence this surface's " +
                "missing title fields rest on",
              trioStillAbsent,
            ],
            [
              "getBlocksFlat still starts at root, which is where rootColumns " +
                "is read from",
              rootIsFirst,
            ],
            [
              "the delivery names its type and carries six top-level blocks " +
                "in declaration order, with the author's ids — the last two " +
                "being the pair of cells a `space:2` delivers",
              delivery.diagramType === "block" &&
                delivery.blocks.length === 6 &&
                alpha.id === "scAlpha" &&
                bravo.id === "scBravo" &&
                charlie.id === "scCharlie" &&
                group.id === "scGroup" &&
                !!space1 &&
                space1.shape === BLOCK_SHAPE_SPACE &&
                !!space2 &&
                space2.shape === BLOCK_SHAPE_SPACE,
            ],
            [
              "a `space:2` delivers TWO cells of ONE column each, and the db's " +
                "own `width: 2` on both is NOT read as a span — the U1 " +
                "correction of 13 September 2026, asserted on both halves so " +
                "a db that stopped delivering `width` could not satisfy it by " +
                "accident",
              rawSpaces.length === 2 &&
                rawSpaces.every(
                  (b) =>
                    b.width === 2 &&
                    !Object.prototype.hasOwnProperty.call(b, "widthInColumns")
                ) &&
                space1.widthInColumns === BLOCK_SPACE_COLUMNS_PER_CELL &&
                space2.widthInColumns === BLOCK_SPACE_COLUMNS_PER_CELL,
            ],
            [
              "every delivered block carries EXACTLY the nine documented keys " +
                "and no other — the assertion that catches a render's `size` " +
                "and `intersect` crossing into the delivery",
              keysOf(alpha) === expectedKeys &&
                keysOf(group) === expectedKeys &&
                keysOf(child) === expectedKeys &&
                keysOf(space1) === expectedKeys,
            ],
            [
              "labels are the author's text, the composite's is the EMPTY " +
                "STRING the db delivers rather than its id, and shapes are the " +
                "db's own type strings verbatim",
              alpha.label === "SelfCheck alpha" &&
                bravo.label === "SelfCheck bravo" &&
                charlie.label === "SelfCheck charlie" &&
                group.label === "" &&
                alpha.shape === "square" &&
                group.shape === "composite",
            ],
            [
              "root's declared columns reads 2, and the UNDECLARED composite " +
                "reads null even though getColumns would answer 1 for it",
              delivery.rootColumns === 2 &&
                group.columns === null &&
                alpha.columns === null &&
                getColumnsWouldLie,
            ],
            [
              "the composite carries its one child nested, and a leaf carries " +
                "an EMPTY children array rather than no key",
              group.children.length === 1 &&
                child.id === "scDelta" &&
                child.label === "SelfCheck delta" &&
                Array.isArray(alpha.children) &&
                alpha.children.length === 0,
            ],
            [
              "spans, classes, styles and directions are the empty-case shapes " +
                "this fixture declares — widthInColumns 1, and [] rather than " +
                "absent for the other three",
              alpha.widthInColumns === 1 &&
                group.widthInColumns === 1 &&
                Array.isArray(alpha.classes) &&
                alpha.classes.length === 0 &&
                Array.isArray(alpha.styles) &&
                alpha.styles.length === 0 &&
                Array.isArray(alpha.directions) &&
                alpha.directions.length === 0,
            ],
            [
              "the one edge carries the AUTHOR'S OWN ids at start and end, its " +
                "decoded label, and an arrow type at each end",
              delivery.edges.length === 1 &&
                edge.start === "scAlpha" &&
                edge.end === "scBravo" &&
                edge.label === "SelfCheck edge" &&
                edge.arrowTypeStart === "arrow_open" &&
                edge.arrowTypeEnd === "arrow_point" &&
                edge.id === "1-scAlpha-scBravo",
            ],
            [
              "the edge's LINE STYLE is delivered: `pattern` and `thickness` " +
                "are present on the delivery, verbatim when the db carries " +
                "them (11.17.2) and null when it does not (11.6.0) — so a db " +
                "that carries either and a delivery that drops it fails here",
              !!rawEdge &&
                Object.prototype.hasOwnProperty.call(edge, "pattern") &&
                Object.prototype.hasOwnProperty.call(edge, "thickness") &&
                edge.pattern ===
                  (typeof rawEdge.pattern === "string" ? rawEdge.pattern : null) &&
                edge.thickness ===
                  (typeof rawEdge.thickness === "string"
                    ? rawEdge.thickness
                    : null),
            ],
            [
              "the class table is a PLAIN OBJECT snapshot rather than the db's " +
                "Map, and is empty on a fixture declaring no classDef",
              !!delivery.classes &&
                typeof delivery.classes === "object" &&
                !(delivery.classes instanceof Map) &&
                Object.keys(delivery.classes).length === 0,
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because on this type a second parse replaces
          // the WHOLE db payload. Delivered through normaliseBlock itself, so
          // the rows test the transform on the path a consumer reads.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(BLOCK_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakDelivery = normaliseBlock(breakDiagram);
              const byId = (id) => breakDelivery.blocks.find((b) => b.id === id);
              const typed = byId("scBrk");
              const escaped = byId("scEsc");
              const typedEdge = breakDelivery.edges[0];
              const escapedEdge = breakDelivery.edges[1];
              return baseAssertions.concat([
                [
                  "a typed break reads as one space on a block label and an " +
                    "edge label (item 82)",
                  !!typed &&
                    typed.label === "one two" &&
                    !!typedEdge &&
                    typedEdge.label === "five six",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "a block label and an edge label (item 82)",
                  !!escaped &&
                    escaped.label === "three<br>four" &&
                    !!escapedEdge &&
                    escapedEdge.label === "seven<br>eight",
                ],
                [
                  "a typed formatting tag reads as its text on a block label " +
                    "and an edge label (item 82)",
                  !!byId("scTyp") &&
                    byId("scTyp").label === "x" &&
                    !!breakDelivery.edges[2] &&
                    breakDelivery.edges[2].label === "r",
                ],
                [
                  "an author-escaped formatting tag is kept as the " +
                    "characters <b> on a block label and an edge label " +
                    "(item 82)",
                  !!byId("scEsm") &&
                    byId("scEsm").label === "<b>z</b>" &&
                    !!breakDelivery.edges[3] &&
                    breakDelivery.edges[3].label === "<i>q</i>",
                ],
                [
                  "a tag-only label is delivered as the present-but-empty " +
                    "one space on a block label and as empty on an edge " +
                    "label (item 82)",
                  !!byId("scNil") &&
                    byId("scNil").label === PRESENT_BUT_EMPTY_LABEL &&
                    !!breakDelivery.edges[4] &&
                    breakDelivery.edges[4].label === "",
                ],
                [
                  "markdown emphasis is left as written on a block label and " +
                    "an edge label, because block prints it (item 82)",
                  !!byId("scEmp") &&
                    byId("scEmp").label === "**y**" &&
                    !!breakDelivery.edges[5] &&
                    breakDelivery.edges[5].label === "**e**",
                ],
              ]);
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    blockSelfCheckPromise = queued
      // Item 82, L2: the link rows read a third fixture, parsed after the
      // others, so every predicate above has already been evaluated.
      .then((assertions) =>
        runBlockLinkRows().then((linkRows) => assertions.concat(linkRows))
      )
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Block self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's block internals no longer " +
              "match the 5 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust block adapter output."
          );
          blockHealthy = false;
          return false;
        }

        logInfo(
          "Block self-check passed: accessor, absent-trio, key-set, nesting, " +
            "declared-column and edge assertions all hold"
        );
        blockHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Block self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        blockHealthy = false;
        return false;
      });

    return blockSelfCheckPromise;
  }

  /**
   * Report the block surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the block self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isBlockHealthy() {
    return blockHealthy;
  }

  // ---------------------------------------------------------------------
  // C4 — the eleventh surface, and the fourth read entirely from the db
  //
  // ONE SURFACE FOR FIVE DIAGRAM KINDS. `C4Context`, `C4Container`,
  // `C4Component`, `C4Dynamic` and `C4Deployment` all detect as `c4` and all
  // share one grammar, one db and one renderer (census
  // docs/mermaid-item-84-census-1-2026-09-16.md § Q1). The kind is recoverable
  // ONLY from the db, through getC4Type(), and is delivered here as
  // `diagramType`. Nothing may read it off a detection key — `unsupported:c4`
  // is identical for all five.
  //
  // WHY THERE IS NO SOURCE READER HERE. Everything the canvas draws about
  // elements, boundaries and relationships is in the db in declaration order
  // with the author's own aliases (census § Q9). Three facts live only in the
  // source and a sighted reader is given none of them either: a frontmatter
  // `title:` reaches neither getTitle() nor the canvas; the four directional
  // spellings `Rel_U`/`_D`/`_L`/`_R` draw identically to a plain `Rel`; and
  // which of `title` and `accTitle:` supplied the title is unrecoverable,
  // because both write one slot and the last writer wins. This is the SEQUENCE
  // and BLOCK answer, not the quadrant one.
  //
  // THE DECODE IS decodePlaceholders, ON EVERY AUTHOR STRING, AND IT IS THE
  // OPPOSITE OF BLOCK'S ANSWER. Census § Q7 rendered five probes at
  // securityLevel "strict" and found ZERO <foreignObject> elements on every
  // one — c4 draws into SVG <text> — then ran both candidate transforms
  // against the delivered bytes on eight references spanning block labels, rel
  // labels and a rel technology: decodePlaceholders agrees with the canvas on
  // all eight, and decodeAuthorText DISAGREES ON FOUR. The block census
  // reached the opposite verdict by the same method on the same day's
  // template. Do not inherit a decode from a neighbouring surface.
  // AMENDED 6 OCTOBER 2026 (item 82, entity slice, enactment 2): an element's
  // label, description and technology additionally resolve the author's
  // `&lt;` `&gt;` `&amp;` first (resolveC4CanvasEntities, below), because
  // decodePlaceholders keeps those as text where the element canvas draws the
  // character. Every other string here is unchanged.
  //
  // NO accTitle FIELD AND NO accDescr FIELD — a MEASURED REFUSAL, not an
  // omission, and for two DIFFERENT measured reasons (census § Q6
  // CONTRADICTION 2 and § Q8 CONTRADICTION 4).
  //   - getAccTitle() returned "" on every one of the census's fourteen parsed
  //     sources, INCLUDING the three that declare an `accTitle:`. The
  //     directive parses on this grammar — unlike block, where it is a hard
  //     parse error — and its text lands in the TITLE slot instead. A field
  //     here would be permanently empty and would imply an author route that
  //     does not reach it.
  //   - getAccDescription() is Mermaid's SHARED store, and a c4 parse does NOT
  //     clear it though a foreign parse does. So a second c4 diagram whose
  //     author wrote no description inherits the FIRST one's, and a field here
  //     would attach one author's description to another author's diagram with
  //     nothing in the value to say so. An absence gets noticed; a plausible
  //     sentence about the wrong diagram does not.
  // CLAUSE X3 IS UNAFFECTED AND MUST NOT BE "FIXED" BY READING THE DB. The
  // core reaches the author's own accTitle and accDescr by a regex over the
  // RAW SOURCE (mermaid-accessibility-utils.js), never through this db, which
  // is exactly why the broken getter and the leaking store cannot damage it.
  //
  // THE TITLE IS DELIVERED, AND THE RULING IS RECORDED RATHER THAN INFERRED.
  // Design-seat ruling of 16 September 2026, written into census § Q9: the
  // `title` field stays, sourced from getTitle(), and a generator narrates it
  // as the diagram's title whoever wrote it. The canvas draws that string as
  // the visible title either way and a sighted reader is shown it with no
  // provenance; clause X3 lifts an author's accTitle onto the short tier by
  // the raw-source route, so a title sentence is at worst a repetition and
  // never a contradiction; and the db cannot report which statement won, so a
  // qualified delivery would be qualified from a guess.
  //
  // THE GETTER IS getTitle, NOT getDiagramTitle (census § Q6). getDiagramTitle
  // is `undefined` on this db, so a presence check written in the other
  // surfaces' spelling reports c4 as carrying no title at all, which is wrong.
  // The self-check pins both halves.
  //
  // THE DB IS A SHARED SINGLETON AND THE WHOLE PAYLOAD CROSSES (census § Q8):
  // `dbA === dbB` measured true across two parses, with the first handle's
  // getters afterwards returning the SECOND diagram's type, shapes and title.
  // Every read below therefore happens inside this parse's own queue slot and
  // is copied into this adapter's own objects in the SAME TICK. The
  // concurrency lane asserts the PAYLOAD for the same reason.
  //
  // `null` AND `""` ARE DIFFERENT ANSWERS HERE, AND THE DIFFERENCE IS THE DB'S
  // RATHER THAN THIS SURFACE'S. `null` means the db carried NO SUCH KEY — a
  // three-argument element has no `techn` key at all, and a boundary that is
  // not a deployment node has no technology to give, and no boundary but a
  // deployment node has a `descr` key at all. `""` means the db handed
  // out a wrapper holding the empty string, which is what an undeclared
  // relationship technology or description does, and what a deployment node
  // with no fourth argument does. A consumer that treats the
  // two alike will say "no technology" for both, which is right; one that
  // needs to know whether the author could have written one has the
  // distinction available and is not asked to infer it.
  //
  // FOUR ACCESSORS TAKE AN ARGUMENT AND RETURN EVERYTHING WHEN GIVEN
  // `undefined` — getC4ShapeArray and getBoundarys are the element and
  // boundary accessors, and a tool whose safety rule declines one-argument
  // getters sees NONE of this type's payload. `getBoundaries` and
  // `getBoundarys` are the SAME ARRAY by identity; this surface picks
  // getBoundarys and says so.
  const C4_DEPLOYMENT_TYPE = "C4Deployment";

  // The synthetic boundary Mermaid manufactures at index 0 of every parse,
  // whose alias, label and type are all the machine string "global". It is NOT
  // drawn on the canvas, every top-level shape's parentBoundary points at it,
  // and a diagram with no author boundaries still delivers it (census § Q4).
  // IT IS DELIVERED RATHER THAN HIDDEN, because a consumer resolving a
  // parentBoundary needs it to resolve to something — but it must never be
  // spoken and never be counted as an author's boundary, and naming it here is
  // what lets a consumer exclude it deliberately rather than by a string
  // literal of its own.
  const C4_SYNTHETIC_ROOT_ALIAS = "global";

  // The three control vocabularies, delivered VERBATIM and never decoded: a
  // shape's kind (`person`, `system_db`, `container`…), an ordinary boundary's
  // kind (`global`, `ENTERPRISE`, `SYSTEM`, `CONTAINER`) and a relationship's
  // type (`rel`, `birel`, `rel_u`, `rel_d`, `rel_l`, `rel_r`, `rel_b`). They
  // are machine tokens a consumer switches on, so a transform there would be a
  // transform on a control value; every OTHER delivered string is author text
  // and is decoded. Naming the vocabulary — deciding how `system_db` is spoken
  // — is a later session's table, and inventing one here would put a wording
  // decision in the adapter where no fixture could reach it.
  const C4_DELIVERED_KEYS = Object.freeze([
    "diagramType",
    "title",
    "shapes",
    "boundaries",
    "rels",
  ]);
  const C4_DELIVERED_SHAPE_KEYS = Object.freeze([
    "alias",
    "kind",
    "label",
    "descr",
    "techn",
    "parentBoundary",
    "sprite",
    "tags",
    "link",
  ]);
  // SIX KEYS SINCE 16 SEPTEMBER 2026, NOT FIVE. `descr` was added by the gold
  // document's ruling CR10, which is the only case in this arc where a GOLD
  // RULING obliged the SURFACE to grow: measurement M1 found that a deployment
  // node's FOURTH argument is drawn by the canvas as its own <text> element and
  // was reachable by no generator, so a sighted reader was shown a sentence a
  // listener could not be given. The ruling required the key to land BEFORE any
  // c4 module registered, so the module could be built against a complete
  // surface rather than against a target it could not emit.
  const C4_DELIVERED_BOUNDARY_KEYS = Object.freeze([
    "alias",
    "label",
    "kind",
    "techn",
    "descr",
    "parentBoundary",
  ]);
  const C4_DELIVERED_REL_KEYS = Object.freeze([
    "type",
    "from",
    "to",
    "label",
    "techn",
    "descr",
  ]);

  let c4MemoCode = null;
  let c4MemoPromise = null;
  let c4Healthy = null;
  let c4SelfCheckStarted = false;
  let c4SelfCheckPromise = null;

  /**
   * Read one WRAPPED author string off a db object and decode it.
   *
   * `label`, `descr`, `techn` and `typeC4Shape` on a shape, `label` and `type`
   * on a boundary, and `label`, `techn` and `descr` on a relationship are each
   * `{ text: … }` and never a bare string (census §§ Q3, Q4, Q5). An
   * unlabelled field delivers `{ text: "" }` rather than undefined — but
   * `techn` is an ABSENT KEY on every three-argument shape, which is the case
   * this guard exists for.
   *
   * @param {Object|undefined} wrapped - A db wrapper, or undefined
   * @returns {string|null} The decoded text, or null when the key is absent
   */
  function c4WrappedText(wrapped) {
    if (!wrapped || typeof wrapped.text !== "string") {
      return null;
    }
    return decodePlaceholders(wrapped.text);
  }

  /**
   * As c4WrappedText, for a position whose canvas DRAWS a typed <br> as a
   * break (item 82): the typed break reads as one space, the escaped forms
   * as written. Measured 2 October 2026 on the element label, description
   * and technology, the boundary label, the deployment node's technology and
   * description, and the relationship label and technology. NOT the
   * relationship description, which the canvas does not draw at all, and
   * never the title, which prints the tag.
   *
   * @param {Object|undefined} wrapped - A db wrapper, or undefined
   * @returns {string|null} The decoded text, or null when the key is absent
   */
  function c4WrappedTextBreaks(wrapped) {
    if (!wrapped || typeof wrapped.text !== "string") {
      return null;
    }
    return decodePlaceholdersBreaks(wrapped.text);
  }

  // ITEM 82, ENTITY SLICE, ENACTMENT 2 (6 October 2026). Ruling (Matthew):
  // "the words read the characters the picture prints, decoded once and
  // escaped once", except that where the picture prints an entity code for a
  // character the author typed plainly the words read the author's character.
  // Measured on 11.17.2 (docs/mermaid-item-82-entity-enact-2-2026-10-06.md):
  // the c4 ELEMENT's label, description and technology resolve an author's
  // `&lt;` `&gt;` `&amp;` to the character and print every other author
  // reference as written, while Mermaid's own `#name;` codes resolve through
  // decodePlaceholders already. decodePlaceholders protects the author's `&`
  // BEFORE it parses, so it keeps `&lt;` as the four characters and the words
  // then read `&lt;` where the picture prints `<`. The three references are
  // therefore resolved on the RAW db string FIRST, in one left-to-right pass,
  // and decodePlaceholders runs after, which protects the result as text.
  // Resolving AFTER decodePlaceholders would decode twice: `#amp;lt;` is
  // `&lt;` once the codes are mapped, and a second pass would read it as `<`
  // where the picture prints `&lt;`.
  //
  // WHAT IT DELIBERATELY DOES NOT DO. The boundary label, the relationship
  // label and the relationship technology are drawn by a canvas that prints
  // every author reference as written, and decodePlaceholders already agrees
  // with it on all 25 forms, so they keep it. The title keeps it too: its
  // canvas rejects `&lt;` outright and prints a bare `<` as `&lt;`, a different
  // rule that belongs with the other titles. The numeric family (`&#39;`,
  // `&#60;`, `&#x3c;`, which Mermaid's encode garbles) is read as it was read
  // before, not chased, pending the owner's word on the hex form.
  const C4_CANVAS_REFERENCES = /&(lt|gt|amp);/g;
  const C4_CANVAS_REFERENCE_CHARACTERS = Object.freeze({
    lt: "<",
    gt: ">",
    amp: "&",
  });

  /**
   * Read an author string the way the c4 ELEMENT canvas draws it: the author's
   * `&lt;` `&gt;` `&amp;` become the characters, Mermaid's `#name;` codes
   * become their characters, and every other reference stays as written.
   * @param {string} text - The delivered RAW db string
   * @returns {string} The resolved text, or the input unchanged when not a
   *   non-empty string
   */
  function resolveC4CanvasEntities(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    const resolved = text.replace(
      C4_CANVAS_REFERENCES,
      (match, name) => C4_CANVAS_REFERENCE_CHARACTERS[name]
    );
    return decodePlaceholders(resolved);
  }

  // ITEM 82, ENTITY SLICE, FOLLOW-UP 2 (6 October 2026): THE TITLE, OPTION 1.
  // The body `title` grammar REJECTS a typed `&amp;` `&lt;` `&gt;`, so on a
  // title that line wrote, every one of the three in the db string is
  // Mermaid's sanitiser encoding a bare character the author typed, and the
  // words read the author's character. An `accTitle:` line PARSES a typed
  // `&amp;`, lands in the same getTitle() slot (last writer wins), and its db
  // string is byte-identical to the sanitised bare form, so neither the db
  // nor the canvas can say which the author meant. That title stays on its
  // earlier reading, recorded as an upstream watch (register item 108); the
  // core already reads an accTitle: correctly from the source through clause
  // X3. Measured on 11.17.2 in
  // docs/mermaid-item-82-entity-c4-title-2-2026-10-06.md: getTitle() answers
  // the LAST `title` or `accTitle:` line in every order tried.
  //
  // The accTitle test is COPIED VERBATIM from parseAccessibilityDirectives in
  // mermaid-accessibility-utils.js, so this surface and the core agree on
  // what counts as an accTitle: line. It is unanchored, so a label carrying
  // "accTitle:" also counts; that declines the resolve, the safe direction.
  const C4_CORE_ACC_TITLE_TEST = /accTitle\s*:\s*(.*?)(?:\n|$)/;
  const C4_BODY_TITLE_LINE = /^\s*title\s/;

  /**
   * Did the body `title` line write the title getTitle() answers? True when
   * no accTitle: line is present, or when the last title-writing line is a
   * body `title` line. Read off the same source string this parse parsed.
   *
   * @param {string} code - The c4 source handed to getDiagramFromText
   * @returns {boolean} True when the title is the body title's
   */
  function c4TitleIsFromBodyLine(code) {
    if (typeof code !== "string") {
      return false;
    }
    if (!C4_CORE_ACC_TITLE_TEST.test(code)) {
      return true;
    }

    // Both kinds may be present: the last writer decides. An accTitle: match
    // is tested first, so a line matching both declines the resolve.
    let lastWriterIsBody = false;
    for (const line of code.split(/\r?\n/)) {
      if (C4_CORE_ACC_TITLE_TEST.test(line)) {
        lastWriterIsBody = false;
      } else if (C4_BODY_TITLE_LINE.test(line)) {
        lastWriterIsBody = true;
      }
    }
    return lastWriterIsBody;
  }

  /**
   * As c4WrappedTextBreaks, for an element's label, description and
   * technology: the typed break reads as one space, then the canvas-resolved
   * entities (item 82).
   *
   * @param {Object|undefined} wrapped - A db wrapper, or undefined
   * @returns {string|null} The decoded text, or null when the key is absent
   */
  function c4ElementTextBreaks(wrapped) {
    if (!wrapped || typeof wrapped.text !== "string") {
      return null;
    }
    return resolveC4CanvasEntities(replaceTypedLineBreaks(wrapped.text));
  }

  /**
   * Read one BARE author string off a db object and decode it.
   *
   * `sprite`, `tags` and `link` are own keys holding `undefined` when the
   * author declares none — invisible to JSON.stringify, which is why the
   * census read them with Object.keys — and bare strings when declared.
   *
   * @param {*} value - A db value
   * @returns {string|null} The decoded string, or null when not a string
   */
  function c4BareText(value) {
    return typeof value === "string" ? decodePlaceholders(value) : null;
  }

  /**
   * Copy ONE db element into this surface's own object.
   *
   * `techn` IS NULL ON A THREE-ARGUMENT SHAPE BECAUSE THE KEY IS ABSENT, NOT
   * EMPTY (census § Q3). A `Person` in a container diagram carries no `techn`
   * key at all while every `Container*` beside it does, so a consumer reading
   * `shape.techn.text` unguarded throws on the first person in exactly the
   * diagram where technology is expected to be present. One absent case per
   * field is delivered here so no consumer has to know that.
   *
   * @param {Object} raw - A db shape object
   * @returns {Object} The delivered element
   */
  function copyC4Shape(raw) {
    return {
      alias: c4BareText(raw.alias) || "",
      // VERBATIM, never decoded — see the control-vocabulary note above. The
      // canvas draws this token as a stereotype, `<<person>>`, so a sighted
      // reader IS told the kind and a description that omits it withholds
      // something the canvas gives (census § Q3).
      kind:
        raw.typeC4Shape && typeof raw.typeC4Shape.text === "string"
          ? raw.typeC4Shape.text
          : "",
      // Item 82, entity slice: the element's three drawn strings resolve the
      // author's `&lt;` `&gt;` `&amp;` as the canvas does (see the note above).
      label: c4ElementTextBreaks(raw.label),
      descr: c4ElementTextBreaks(raw.descr),
      techn: c4ElementTextBreaks(raw.techn),
      // The author's own alias of the containing boundary, or the synthetic
      // root's. Never "" on a parsed shape.
      parentBoundary: c4BareText(raw.parentBoundary) || "",
      // NONE OF THESE THREE IS DRAWN, measured (census § Q3): a named sprite
      // draws nothing — the one <image> per person is the person glyph — tags
      // appear in no <text>, and there are ZERO <a> elements at strict. They
      // are delivered because they are the author's own declarations, not
      // because a reader is owed them.
      sprite: c4BareText(raw.sprite),
      tags: c4BareText(raw.tags),
      link: c4BareText(raw.link),
    };
  }

  /**
   * Copy ONE db boundary into this surface's own object.
   *
   * `type.text` MEANS TWO DIFFERENT THINGS AND THE FIELD CARRIES NO FLAG —
   * census § Q4, CONTRADICTION 1. On an `Enterprise_Boundary`, a
   * `System_Boundary`, a `Container_Boundary` and the synthetic root it is an
   * upper-case machine token naming what SORT of boundary this is. On a
   * DEPLOYMENT NODE the same slot holds the author's own second argument, a
   * technology string — `"Ubuntu 16.04 LTS"`, `"Apache Tomcat 8.x"` — and the
   * canvas agrees, drawing it bracketed exactly as it draws a container's
   * technology and drawing no stereotype at all.
   *
   * IT FAILS IN THE DIRECTION THAT PRODUCES CONFIDENT NONSENSE. A surface that
   * mapped `type.text` through a kind vocabulary would narrate "a boundary of
   * type Ubuntu 16.04 LTS", or drop the technology entirely, and both read as
   * ordinary output. So the slot is split here into TWO delivered fields,
   * exactly one of which is ever non-null, and the discriminator is the
   * sibling `nodeType` key, present only on deployment nodes. getC4Type() is
   * checked first, as the census instructs, so the per-boundary key test is
   * never the only thing standing between a kind and a technology.
   *
   * THE DECODE FOLLOWS THE MEANING, not the slot: a kind is a control token
   * and is verbatim, a technology is author text and is decoded.
   *
   * `descr` IS THE SIXTH KEY AND IS READ UNCONDITIONALLY, NOT GATED ON THE
   * DISCRIMINATOR (gold ruling CR10, 16 September 2026). Measured on this
   * build, 16 September 2026, across the six gold exemplars and the S1 source:
   * the key is PRESENT on every deployment node — carrying `{ text: "" }` when
   * the author wrote no fourth argument and their text when they did — and
   * ABSENT on the synthetic root and on every `Enterprise_Boundary`,
   * `System_Boundary`, `Container_Boundary`, bare `Boundary` and
   * custom-kind `Boundary` read.
   *
   * SO AN ABSENT KEY DELIVERS null AND AN EMPTY WRAPPER DELIVERS "", which is
   * this surface's standing convention applied unchanged rather than a new one
   * — `c4WrappedText` supplies both by construction. The distinction is worth
   * keeping: "" says the author declared a deployment node and left its fourth
   * argument empty, and null says this sort of boundary carries no such slot at
   * all. Reading it WITHOUT the `nodeType` gate is deliberate: if a later
   * Mermaid starts carrying a description on an ordinary boundary, the surface
   * delivers it rather than dropping it silently, and a gated read would have
   * to be found and changed by someone who knew to look.
   *
   * @param {Object} raw - A db boundary object
   * @param {boolean} isDeploymentDiagram - getC4Type() === "C4Deployment"
   * @returns {Object} The delivered boundary
   */
  function copyC4Boundary(raw, isDeploymentDiagram) {
    const isDeploymentNode =
      isDeploymentDiagram &&
      Object.prototype.hasOwnProperty.call(raw, "nodeType");
    const slot =
      raw.type && typeof raw.type.text === "string" ? raw.type.text : null;

    return {
      alias: c4BareText(raw.alias) || "",
      label: c4WrappedTextBreaks(raw.label),
      kind: isDeploymentNode ? null : slot,
      techn: isDeploymentNode ? decodePlaceholdersBreaks(slot) : null,
      // CR10's sixth key. null where the db carries no such key, "" where it
      // hands out an empty wrapper — see the note above.
      descr: c4WrappedTextBreaks(raw.descr),
      // "" on the synthetic root, and the parent's alias on everything else.
      parentBoundary: c4BareText(raw.parentBoundary) || "",
    };
  }

  /**
   * Copy ONE db relationship into this surface's own object.
   *
   * THE FOUR-ARGUMENT FORM IS TECHNOLOGY, NOT DESCRIPTION (census § Q5).
   * `Rel(a, b, "Uses", "HTTPS")` delivers label "Uses", techn "HTTPS" and
   * descr ""; the description is the FIFTH argument. A surface that read the
   * fourth as a description would narrate a protocol as prose.
   *
   * THERE IS NO ID ON A RELATIONSHIP, so two identical rels are
   * indistinguishable except by index, and `from`/`to` are the AUTHOR'S OWN
   * aliases — quotable against the elements above with no lookup table.
   *
   * `type` IS DELIVERED VERBATIM AND ALL SEVEN SPELLINGS ARE DISTINGUISHED.
   * WHAT THE SEVEN MEAN IS A GOLD QUESTION AND IS DELIBERATELY NOT DECIDED
   * HERE, but the census measured the canvas and a consumer must read it
   * before narrating a direction: `birel` draws TWO heads; `rel_b` draws its
   * ONE head at the SOURCE, so `Rel_Back(A, B)` is an arrow from B to A and a
   * surface narrating from → to states it backwards in an authoritative voice;
   * and `rel_u`, `rel_d`, `rel_l` and `rel_r` draw IDENTICALLY to a plain
   * `rel`, being layout hints a reader is given nothing by.
   *
   * @param {Object} raw - A db relationship object
   * @returns {Object} The delivered relationship
   */
  function copyC4Rel(raw) {
    return {
      type: typeof raw.type === "string" ? raw.type : "",
      from: c4BareText(raw.from) || "",
      to: c4BareText(raw.to) || "",
      label: c4WrappedTextBreaks(raw.label),
      techn: c4WrappedTextBreaks(raw.techn),
      // Item 82: NOT the break transform. The canvas does not draw a
      // relationship's description at all, so the ruling's "a line break
      // the picture draws" has nothing to say here; measured 2 October 2026.
      descr: c4WrappedText(raw.descr),
    };
  }

  /**
   * Normalise one Mermaid c4 diagram into the eleventh surface's delivery.
   *
   * EAGER SNAPSHOT (the singleton defence, census § Q8): every db accessor is
   * called ONCE here, inside the parse's own .then and behind the adapter-wide
   * queue, and each result is mapped into this adapter's own objects in the
   * same tick. Nothing in the returned object references a db-owned object,
   * and no consumer may ever go back to the db later — on this type a second
   * parse replaces the WHOLE payload, not merely the shared scalars.
   *
   * THE KEY LISTS ARE CLOSED, and nothing is spread or cloned wholesale. The
   * census measured post-render mutation on this type too — a rendered shape
   * gains `image`, `width`, `height`, `margin`, `x` and `y` — and none of that
   * may ever reach a narration.
   *
   * SOURCE ORDER IS KEPT AND IS NOT THE CANVAS'S ORDER. Elements, boundaries
   * and relationships all come back in declaration order (census § Q2), while
   * the canvas draws elements GROUPED BY BOUNDARY. The db's order is the
   * honest traversal for a narration; that the two differ is an order-fidelity
   * question for a later session, not a defect to repair here.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string} code - The source that diagram was parsed from, read only
   *   to tell which line wrote the title (item 82, follow-up 2)
   * @returns {Object} The normalised c4 delivery
   */
  function normaliseC4(diagram, code) {
    const db = diagram.db;

    // The four reads. getC4ShapeArray and getBoundarys are called with
    // `undefined` deliberately: both declare one parameter and both return
    // EVERYTHING when given none.
    const diagramType = typeof db.getC4Type() === "string" ? db.getC4Type() : "";
    const rawShapes = db.getC4ShapeArray(undefined);
    const rawBoundaries = db.getBoundarys(undefined);
    const rawRels = db.getRels();

    const isDeploymentDiagram = diagramType === C4_DEPLOYMENT_TYPE;
    const rawTitle = typeof db.getTitle() === "string" ? db.getTitle() : "";

    return {
      diagramType: diagramType,
      // getTitle(), NOT getDiagramTitle — which is undefined on this db. It
      // may be the author's `accTitle:` text rather than their body title,
      // last writer wins, and the design seat has ruled that a generator
      // narrates it as the title regardless; see the surface comment above.
      // Item 82, follow-up 2: the sanitiser's `&amp;` `&lt;` `&gt;` resolve
      // to the author's characters only when the body `title` line wrote it.
      title: c4TitleIsFromBodyLine(code)
        ? resolveC4CanvasEntities(rawTitle)
        : decodePlaceholders(rawTitle),
      shapes: (Array.isArray(rawShapes) ? rawShapes : []).map(copyC4Shape),
      boundaries: (Array.isArray(rawBoundaries) ? rawBoundaries : []).map(
        (raw) => copyC4Boundary(raw, isDeploymentDiagram)
      ),
      rels: (Array.isArray(rawRels) ? rawRels : []).map(copyC4Rel),
    };
  }

  /**
   * Parse a c4 diagram and deliver the normalised shape.
   *
   * Same contract as the other ten surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every
   * db read happens inside this call's own queue slot. On this type the queue
   * is load-bearing for the payload itself and not only for the shared
   * scalars — the db is a singleton whose whole contents a concurrent parse
   * replaces.
   *
   * @param {string} code - The Mermaid c4 source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseC4(code) {
    if (!c4SelfCheckStarted) {
      runC4SelfCheck();
    }

    if (code === c4MemoCode && c4MemoPromise) {
      logDebug("Returning memoised c4 parse for identical code string");
      return c4MemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(`C4 parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `C4 parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const c4 = normaliseC4(diagram, code);
          logDebug(
            `C4 parse delivered after ${Math.round(performance.now() - startedAt)}ms: ` +
              `${c4.diagramType}, ${c4.shapes.length} element(s), ` +
              `${c4.boundaries.length} boundary/boundaries including the synthetic root, ` +
              `${c4.rels.length} relationship(s)`
          );
          return c4;
        })
        .catch((error) => {
          logDebug(
            `C4 parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    c4MemoCode = code;
    c4MemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: a `C4Context` carrying an `accTitle:` AND a body
   * title, one `System_Boundary`, two elements and one four-argument `Rel`.
   *
   * THE accTitle IS THE POINT AND IS NOT DECORATION. It is declared FIRST and
   * the body title SECOND, so getTitle() must answer the BODY title —
   * last writer wins — while getAccTitle() must still answer "". That pins
   * CONTRADICTION 2 two-sided on a source that really does declare the
   * directive: a Mermaid upgrade which starts honouring `accTitle:` reddens
   * here rather than silently reopening this surface's refusal to carry an
   * accTitle field. A fixture declaring no accTitle would satisfy the same
   * assertion for a reason that has nothing to do with the finding.
   *
   * THE BOUNDARY IS THE SECOND POINT. getBoundarys returns TWO entries on this
   * one-boundary source, because the synthetic root is always index 0, and a
   * fixture with no author boundary at all would pass whether or not the root
   * is delivered. The person sits at the root and the system inside the
   * boundary, so parentBoundary is exercised on both sides.
   *
   * ONE THING THIS FIXTURE CANNOT REACH, stated rather than left to be
   * discovered: every element on a `C4Context` is a three-argument shape, so
   * the ABSENT `techn` key is covered and the PRESENT one is not, and neither
   * is the deployment-node branch of copyC4Boundary. Both need a
   * `C4Container` and a `C4Deployment`, which is two more fixture parses than
   * this check runs; they are covered by the session's console test instead,
   * and that is a weaker instrument because it runs when someone runs it.
   *
   * ASCII only, every string distinctive and prefixed SelfCheck, so a
   * cross-delivery from another diagram NAMES ITS SOURCE rather than merely
   * looking wrong.
   */
  const C4_SELF_CHECK_FIXTURE = [
    "C4Context",
    "    accTitle: SelfCheck c4 accessible title",
    "    title SelfCheck c4 title",
    '    Person(scPerson, "SelfCheck person", "SelfCheck person descr.")',
    '    System_Boundary(scBoundary, "SelfCheck boundary") {',
    '        System(scSystem, "SelfCheck system", "SelfCheck system descr.")',
    "    }",
    '    Rel(scPerson, scSystem, "SelfCheck uses", "SelfCheck protocol")',
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A C4Deployment, so the deployment node's technology and
  // description are reachable beside the element's three fields and the
  // relationship's label and technology. Node and element one carry a typed
  // break on every break position, node and element two the escaped
  // `#lt;br#gt;`. Two fields must arrive AS WRITTEN despite a typed break:
  // the TITLE, which the canvas prints, and the relationship DESCRIPTION,
  // which the canvas does not draw at all.
  const C4_BREAK_SELF_CHECK_FIXTURE = [
    "C4Deployment",
    "    title SelfCheck break<br>title",
    '    Deployment_Node(scbN1, "one<br>two", "three<br>four", "five<br>six") {',
    '        Container(scbC1, "seven<br>eight", "nine<br>ten", "eleven<br>twelve")',
    "    }",
    '    Deployment_Node(scbN2, "a#lt;br#gt;b", "c#lt;br#gt;d", "e#lt;br#gt;f") {',
    '        Container(scbC2, "g#lt;br#gt;h", "i#lt;br#gt;j", "k#lt;br#gt;l")',
    "    }",
    '    Rel(scbC1, scbC2, "m<br>n", "o<br>p", "q<br>r")',
    '    Rel(scbC2, scbC1, "s#lt;br#gt;t", "u#lt;br#gt;v")',
  ].join("\n");

  // Item 82, entity slice: a THIRD source, for the element canvas's entity
  // rule. Every reference is on an element's label, technology or description
  // (Container's own argument order), the boundary and the relationship
  // carry the positions that must NOT resolve, and nothing is a title (a
  // title cannot carry `&lt;`: the grammar rejects it). `sceH` carries the
  // hex reference, pinned as the picture prints it rather than as the
  // carve-out would read it, and the two double-decode forms.
  const C4_ENTITY_SELF_CHECK_FIXTURE = [
    "C4Container",
    '    Enterprise_Boundary(sceB, "bound &lt; x") {',
    '        Container(sceR, "lt &lt; x", "gt &gt; x", "amp &amp; x")',
    '        Container(sceU, "quot &quot;q&quot; x", "hash #quot;q#quot; x", "bare a & b x")',
    '        Container(sceH, "hex &#x3c; x", "both #amp;lt; x", "twice &amp;lt; x")',
    "    }",
    '    Rel(sceR, sceU, "rel &amp; x", "tech &gt; x")',
  ].join("\n");

  // Item 82, follow-up 2: three title sources, one title each, because a
  // diagram has one title slot. The first and second put both kinds of line
  // in opposite orders, so the last-writer test is exercised both ways; the
  // third pins that a `#quot;` code on a body title still reads as before.
  const C4_TITLE_SELF_CHECK_PERSON = '    Person(sctP, "SelfCheck title person")';
  const C4_TITLE_SELF_CHECK_SOURCES = Object.freeze([
    [
      "C4Context",
      "    accTitle: SelfCheck title acc",
      "    title SelfCheck Tom & Jerry a < b c > d",
      C4_TITLE_SELF_CHECK_PERSON,
    ].join("\n"),
    [
      "C4Context",
      "    title SelfCheck body first",
      "    accTitle: SelfCheck Tom &amp; Jerry a &lt; b",
      C4_TITLE_SELF_CHECK_PERSON,
    ].join("\n"),
    [
      "C4Context",
      "    title SelfCheck a #quot;q#quot; b",
      C4_TITLE_SELF_CHECK_PERSON,
    ].join("\n"),
  ]);

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the c4 surface unhealthy, and resolves
   * false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the c4 health verdict
   */
  function runC4SelfCheck() {
    if (c4SelfCheckPromise) {
      return c4SelfCheckPromise;
    }
    c4SelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            C4_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getC4Type === "function" &&
            typeof db.getC4ShapeArray === "function" &&
            typeof db.getBoundarys === "function" &&
            typeof db.getRels === "function" &&
            typeof db.getTitle === "function";

          // THE SPELLING TRAP, PINNED. getDiagramTitle — the name every other
          // surface's title read uses — is undefined on this db, and getTitle
          // is the one that answers. A check written in the other spelling
          // reports c4 as carrying no title at all.
          const titleGetterSpelling =
            typeof db.getDiagramTitle === "undefined" &&
            typeof db.getTitle === "function";

          // CONTRADICTION 2, two-sided, on a fixture that DOES declare an
          // accTitle: the directive parsed, its text is NOT in getAccTitle,
          // and the body title written after it is what getTitle answers.
          const accTitleStillLies =
            typeof db.getAccTitle === "function" &&
            db.getAccTitle() === "" &&
            db.getTitle() === "SelfCheck c4 title";

          // Raw reads, taken in this same slot, for the structural facts the
          // delivery cannot itself expose: that the person really carries NO
          // `techn` key (so the delivered null is the absent-key guard firing
          // rather than an empty wrapper passed through), and that an ordinary
          // boundary carries no `nodeType` discriminator.
          const rawShapes = db.getC4ShapeArray(undefined);
          const rawBoundaries = db.getBoundarys(undefined);
          const rawTechnAbsent =
            Array.isArray(rawShapes) &&
            rawShapes.length === 2 &&
            rawShapes.every(
              (s) => !Object.prototype.hasOwnProperty.call(s, "techn")
            );
          const rawNoNodeType =
            Array.isArray(rawBoundaries) &&
            rawBoundaries.every(
              (b) => !Object.prototype.hasOwnProperty.call(b, "nodeType")
            );
          // CR10's sixth key, asserted on BOTH halves for the same reason the
          // absent `techn` is: a build that started handing out an empty
          // wrapper on an ordinary boundary would deliver "" where this fixture
          // expects null, and could not satisfy the raw half by accident. This
          // fixture is a C4Context, so it reaches the ABSENT arm only; the
          // PRESENT arm needs a C4Deployment and is covered by the harness's
          // concurrency row CC1, which is a weaker instrument because it runs
          // when someone runs it.
          const rawDescrAbsentOnOrdinaryBoundaries =
            Array.isArray(rawBoundaries) &&
            rawBoundaries.length === 2 &&
            rawBoundaries.every(
              (b) => !Object.prototype.hasOwnProperty.call(b, "descr")
            );
          const boundariesAreOneArray =
            db.getBoundaries(undefined) === rawBoundaries;

          const delivery = normaliseC4(diagram, C4_SELF_CHECK_FIXTURE);
          const [person, system] = delivery.shapes;
          const [root, boundary] = delivery.boundaries;
          const rel = delivery.rels[0];
          const keysOf = (o) => (o ? Object.keys(o).join(",") : "");

          const baseAssertions = [
            [
              "the five db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "the title getter is still spelt getTitle and getDiagramTitle " +
                "is still undefined on this db — the spelling a check " +
                "inherited from another surface gets wrong",
              titleGetterSpelling,
            ],
            [
              "getAccTitle STILL answers \"\" on a source that DECLARES an " +
                "accTitle:, and that directive's text still lands in the " +
                "title slot with the later body title winning — the measured " +
                "lie this surface's refusal to carry an accTitle field rests on",
              accTitleStillLies,
            ],
            [
              "getBoundaries and getBoundarys are still ONE array by identity, " +
                "so picking either spelling reads the same boundaries",
              boundariesAreOneArray,
            ],
            [
              "the delivery carries EXACTLY the five documented top-level keys, " +
                "names its own c4 kind from the db rather than a detection " +
                "key, and delivers the body title decoded",
              keysOf(delivery) === C4_DELIVERED_KEYS.join(",") &&
                delivery.diagramType === "C4Context" &&
                delivery.title === "SelfCheck c4 title",
            ],
            [
              "every delivered element, boundary and relationship carries " +
                "EXACTLY its documented key set and no other — the assertion " +
                "that catches a render's post-layout x, y and image crossing " +
                "into the delivery",
              keysOf(person) === C4_DELIVERED_SHAPE_KEYS.join(",") &&
                keysOf(system) === C4_DELIVERED_SHAPE_KEYS.join(",") &&
                keysOf(root) === C4_DELIVERED_BOUNDARY_KEYS.join(",") &&
                keysOf(boundary) === C4_DELIVERED_BOUNDARY_KEYS.join(",") &&
                keysOf(rel) === C4_DELIVERED_REL_KEYS.join(","),
            ],
            [
              "the two elements arrive in DECLARATION order with the author's " +
                "own aliases, their labels and descriptions decoded, and their " +
                "kinds the db's own lower-case tokens verbatim",
              delivery.shapes.length === 2 &&
                person.alias === "scPerson" &&
                person.label === "SelfCheck person" &&
                person.descr === "SelfCheck person descr." &&
                person.kind === "person" &&
                system.alias === "scSystem" &&
                system.label === "SelfCheck system" &&
                system.kind === "system",
            ],
            [
              "a three-argument element delivers techn NULL because the db " +
                "carries NO techn KEY on it — asserted on both halves, so a " +
                "build that started delivering an empty wrapper could not " +
                "satisfy it by accident — and sprite, tags and link are null " +
                "rather than absent on a fixture declaring none",
              rawTechnAbsent &&
                person.techn === null &&
                system.techn === null &&
                person.sprite === null &&
                person.tags === null &&
                person.link === null,
            ],
            [
              "the SYNTHETIC ROOT is delivered rather than hidden, at index 0, " +
                "with its machine label and no parent, and the author's own " +
                "boundary follows it carrying its kind token",
              delivery.boundaries.length === 2 &&
                root.alias === C4_SYNTHETIC_ROOT_ALIAS &&
                root.label === C4_SYNTHETIC_ROOT_ALIAS &&
                root.kind === C4_SYNTHETIC_ROOT_ALIAS &&
                root.parentBoundary === "" &&
                boundary.alias === "scBoundary" &&
                boundary.label === "SelfCheck boundary" &&
                boundary.kind === "SYSTEM" &&
                boundary.parentBoundary === C4_SYNTHETIC_ROOT_ALIAS,
            ],
            [
              "on a NON-deployment diagram every boundary delivers a kind and " +
                "NO technology, and the db confirms it by carrying no nodeType " +
                "discriminator on either of them",
              rawNoNodeType &&
                delivery.boundaries.every((b) => b.techn === null) &&
                delivery.boundaries.every((b) => typeof b.kind === "string"),
            ],
            [
              "CR10's SIXTH boundary key is delivered, and on an ordinary " +
                "boundary it is NULL because the db carries no descr key there " +
                "- asserted on both halves, so a build that began handing out " +
                "an empty wrapper could not satisfy it by accident",
              rawDescrAbsentOnOrdinaryBoundaries &&
                delivery.boundaries.every((b) => b.descr === null),
            ],
            [
              "containment is delivered as the author's alias on each element, " +
                "the person at the synthetic root and the system inside the " +
                "declared boundary",
              person.parentBoundary === C4_SYNTHETIC_ROOT_ALIAS &&
                system.parentBoundary === "scBoundary",
            ],
            [
              "the one relationship carries its spelling verbatim, the " +
                "author's own aliases at both ends, and reads its FOURTH " +
                "argument as a TECHNOLOGY with the description left empty — " +
                "the four-argument trap",
              delivery.rels.length === 1 &&
                rel.type === "rel" &&
                rel.from === "scPerson" &&
                rel.to === "scSystem" &&
                rel.label === "SelfCheck uses" &&
                rel.techn === "SelfCheck protocol" &&
                rel.descr === "",
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because on this type a second parse replaces
          // the WHOLE db payload. Delivered through normaliseC4 itself, so
          // the rows test the transform on the path a consumer reads.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(C4_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakDelivery = normaliseC4(
                breakDiagram,
                C4_BREAK_SELF_CHECK_FIXTURE
              );
              const node = (alias) =>
                breakDelivery.boundaries.find((b) => b.alias === alias) || {};
              const shape = (alias) =>
                breakDelivery.shapes.find((s) => s.alias === alias) || {};
              const typedRel = breakDelivery.rels[0] || {};
              const escapedRel = breakDelivery.rels[1] || {};
              const breakAssertions = baseAssertions.concat([
                [
                  "a typed break reads as one space on a deployment node's " +
                    "label, technology and description, an element's label, " +
                    "technology and description, and a relationship's label " +
                    "and technology (item 82)",
                  node("scbN1").label === "one two" &&
                    node("scbN1").techn === "three four" &&
                    node("scbN1").descr === "five six" &&
                    shape("scbC1").label === "seven eight" &&
                    shape("scbC1").techn === "nine ten" &&
                    shape("scbC1").descr === "eleven twelve" &&
                    typedRel.label === "m n" &&
                    typedRel.techn === "o p",
                ],
                [
                  "an author-escaped break is kept as the characters <br> " +
                    "on the same eight positions (item 82)",
                  node("scbN2").label === "a<br>b" &&
                    node("scbN2").techn === "c<br>d" &&
                    node("scbN2").descr === "e<br>f" &&
                    shape("scbC2").label === "g<br>h" &&
                    shape("scbC2").techn === "i<br>j" &&
                    shape("scbC2").descr === "k<br>l" &&
                    escapedRel.label === "s<br>t" &&
                    escapedRel.techn === "u<br>v",
                ],
                [
                  "a typed break in the TITLE, which the canvas prints, and " +
                    "in a relationship DESCRIPTION, which it does not draw, " +
                    "both arrive as written (item 82)",
                  breakDelivery.title === "SelfCheck break<br>title" &&
                    typedRel.descr === "q<br>r",
                ],
              ]);

              // Item 82, entity slice: a third source, parsed after the
              // break source for the same reason that one is parsed after the
              // base predicates.
              return window.mermaid.mermaidAPI
                .getDiagramFromText(C4_ENTITY_SELF_CHECK_FIXTURE)
                .then((entityDiagram) => {
                  const entityDelivery = normaliseC4(
                    entityDiagram,
                    C4_ENTITY_SELF_CHECK_FIXTURE
                  );
                  const one = (alias) =>
                    entityDelivery.shapes.find((s) => s.alias === alias) || {};
                  const boundaryOne =
                    entityDelivery.boundaries.find((b) => b.alias === "sceB") ||
                    {};
                  const relOne = entityDelivery.rels[0] || {};
                  const entityAssertions = breakAssertions.concat([
                    [
                      "the author's &lt; &gt; &amp; read as the characters " +
                        "the element canvas draws, on label, technology and " +
                        "description (item 82, entity slice)",
                      one("sceR").label === "lt < x" &&
                        one("sceR").techn === "gt > x" &&
                        one("sceR").descr === "amp & x",
                    ],
                    [
                      "an author &quot; stays as written, a #quot; code and a " +
                        "bare & read as the character, and the hex reference " +
                        "reads as the picture prints it, `&&x3c;`",
                      one("sceU").label === "quot &quot;q&quot; x" &&
                        one("sceU").techn === 'hash "q" x' &&
                        one("sceU").descr === "bare a & b x" &&
                        one("sceH").label === "hex &&x3c; x",
                    ],
                    [
                      "the resolver runs ONCE: #amp;lt; reads &lt; as the " +
                        "picture prints it, and &amp;lt; too",
                      one("sceH").techn === "both &lt; x" &&
                        one("sceH").descr === "twice &lt; x",
                    ],
                    [
                      "a boundary label and a relationship label and " +
                        "technology are NOT resolved: their canvas prints the " +
                        "author's reference as written",
                      boundaryOne.label === "bound &lt; x" &&
                        relOne.label === "rel &amp; x" &&
                        relOne.techn === "tech &gt; x",
                    ],
                  ]);

                  // Item 82, follow-up 2: the three title sources, parsed one
                  // at a time and in order, each read in its own tick for
                  // the same singleton reason as the sources above.
                  const titles = [];
                  return C4_TITLE_SELF_CHECK_SOURCES.reduce(
                    (chain, source) =>
                      chain
                        .then(() =>
                          window.mermaid.mermaidAPI.getDiagramFromText(source)
                        )
                        .then((titleDiagram) => {
                          titles.push(normaliseC4(titleDiagram, source).title);
                        }),
                    Promise.resolve()
                  ).then(() =>
                    entityAssertions.concat([
                      [
                        "a body title the author typed with bare & < > reads " +
                          "the author's characters, written last after an " +
                          "accTitle: (item 82, follow-up 2)",
                        titles[0] === "SelfCheck Tom & Jerry a < b c > d",
                      ],
                      [
                        "an accTitle: written last, carrying a typed &amp; " +
                          "and &lt;, is NOT resolved: its db string cannot " +
                          "be told from the bare form, so it keeps its " +
                          "earlier reading (item 82, follow-up 2)",
                        titles[1] === "SelfCheck Tom &amp; Jerry a &lt; b",
                      ],
                      [
                        "a #quot; code on a body title still reads as the " +
                          "character, unchanged by the title resolver",
                        titles[2] === 'SelfCheck a "q" b',
                      ],
                    ])
                  );
                });
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    c4SelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `C4 self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's c4 internals no longer " +
              "match the 16 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust c4 adapter output."
          );
          c4Healthy = false;
          return false;
        }

        logInfo(
          "C4 self-check passed: accessor, title-spelling, accTitle-lie, " +
            "key-set, absent-techn, synthetic-root and four-argument-rel " +
            "assertions all hold"
        );
        c4Healthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "C4 self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        c4Healthy = false;
        return false;
      });

    return c4SelfCheckPromise;
  }

  /**
   * Report the c4 surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the c4 self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isC4Healthy() {
    return c4Healthy;
  }

  // ---------------------------------------------------------------------
  // KANBAN — the twelfth surface, and the fifth read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE. Everything the canvas draws about
  // columns and cards is in the db, in declaration order, with the author's
  // own text: labels, the column pointer, tickets, assignees, priorities and
  // the column-or-card distinction. Four facts live in the source or the
  // grammar and NOT in the db, and a sighted reader is given none of them
  // either — a frontmatter `title:` reaches neither the db, the canvas nor the
  // description; the mindmap card spellings `((…))`, `(…)` and `{{…}}` all
  // parse and the canvas draws them BYTE-IDENTICALLY; `::icon(fa fa-book)`
  // reaches the db and draws NOTHING AT ALL; and a third indentation level is
  // flattened to the column in `parentId` and drawn flat. So there is nothing
  // for a source reader to recover. Measured in
  // docs/mermaid-item-88-census-1-2026-09-18.md §§ Q6, Q9 and Q10. This is the
  // SEQUENCE, BLOCK and C4 answer, not the quadrant one.
  //
  // NO title, accTitle OR accDescr FIELD — a MEASURED ABSENCE, 18 September
  // 2026, and this type's reason is WORSE THAN BLOCK'S rather than the same.
  // All four of `getDiagramTitle`, `getAccTitle`, `getAccDescription` and
  // `getTitle` are undefined on the kanban db, on every one of the census's
  // probes, with the channel positively controlled in the same page (the same
  // probe reports three of the four PRESENT on a c4 db). But the sharper fact
  // is that on this grammar THE DIRECTIVES ARE NOT DIRECTIVES: an `accTitle:`
  // or `accDescr:` line, and a body `title X` line, are each swallowed as a
  // COLUMN LABEL and DRAWN as a spurious column, carrying the raw directive
  // text including its prefix and colon (census § Q6, CONTRADICTION 3).
  // Clause X3's raw-source regex still lifts the author's text onto the
  // description tiers, so following the fallback's own advice improves the
  // description AND silently corrupts the board. A `title` field here would
  // therefore deliver THE DEFECT RATHER THAN THE DATA. Do not "complete" the
  // shape by adding one; the disposition of the advice itself is register
  // item 81, not this surface's question.
  //
  // THE DECODE IS decodeAuthorText, ON LABELS AND ON `ticket` AND `assigned`
  // ALIKE, and each half was measured rather than inherited. Labels: the
  // census's § Q7 read five probes at securityLevel "strict" and found
  // <foreignObject> on every one with ZERO <text> elements, then ran both
  // candidate transforms against the delivered bytes — decodeAuthorText agreed
  // with the canvas on all seven author-text constructs and decodePlaceholders
  // disagreed on two, on BOTH label kinds. `ticket` and `assigned` were
  // measured SEPARATELY in this session, 18 September 2026, because the label
  // answer does not transfer — block's edge labels needed the same separate
  // reading. Five sources, one construct each, the SAME construct written into
  // BOTH fields inside the `@{ }` block: `Tom &amp; Jerry`, `a #quot;b#quot;
  // pair`, `less than &lt; here`, `a bare & here` and `apostrophe &#39; here`.
  // decodeAuthorText reproduced the canvas on 5 of 5 in both fields;
  // decodePlaceholders disagreed on the two HTML-entity constructs. So kanban
  // is in the block / flowchart / ER / class family and is the OPPOSITE of c4
  // and git-graph. None of the five was rejected by the YAML-ish `@{ }` block,
  // including the one carrying `#`.
  //
  // `priority` TAKES decodeAuthorText TOO, SINCE 21 SEPTEMBER 2026, AND FOR
  // THREE SESSIONS IT TOOK NO TRANSFORM AT ALL. The reversal is ruling KS9,
  // which amends KS3 of 18 September 2026. KS3 reasoned that the field is
  // never drawn as text — the canvas encodes it as a 4px vertical <line> at
  // the card's left edge and in NO other way — so there is no drawn string for
  // a transform to agree with, and delivered the db's bytes. THE REASONING IS
  // SOUND AND THE PREMISE UNDER IT WAS FALSE: the db does not hold the
  // author's string either. It holds Mermaid's parse-time encoding, in which
  // `#quot;` is already a private sentinel and `&amp;` is undecoded. Before
  // Matthew's ruling MR1 an undrawn priority was silent and those bytes never
  // reached anybody; MR1 made the field spoken, and what was being spoken was
  // machine tokens. So the alternative to agreeing with the canvas is not
  // "deliver the raw bytes" but "deliver what the author wrote", which is what
  // the sibling fields in the same `@{ }` block already do. Finding F1 of
  // docs/mermaid-item-88-sweep-6-2026-09-21.md.
  //
  // WHICH LEAVES THE DRAWN/UNDRAWN TEST WITHOUT A STRING TO READ, and that is
  // why `priorityDrawn` is delivered beside it. THE RENDERER COMPARES THE RAW
  // BYTES, measured 21 September 2026 (M1): a priority authored `H#105;gh`
  // decodes to the exact string `High` and draws a line whose COMPUTED stroke
  // is `none`, while a plain `High` card in the same source draws
  // `rgb(255, 165, 0)`. Three entity spellings, one fresh browser context
  // each, that control beside every one. So the decoded string cannot answer
  // the question and the two keys are not redundant.
  //
  // Two consequences worth knowing before narrating any of it: the channel is
  // HUE ALONE — no shape, dash or width difference and no text — so a
  // description is the ONLY non-colour route to a card's priority; and
  // `Default` and an undocumented value such as `Urgent` BOTH draw a
  // `stroke: none` line, so the canvas cannot distinguish a value it
  // understood from an author's typo while the db can (census § Q5,
  // CONTRADICTION 2). Measured in the surface session on the census's P03:
  // High orange, Very High red, Low blue, Very Low light blue, Urgent none.
  //
  // A NUMBER OR A BOOLEAN IS DELIVERED AS ITS String() FORM, since the same
  // day and ruling KS10, which amends KS4. See kanbanMetadata for what can
  // actually arrive and which of its arms are defences; the short of it is
  // that Mermaid drops every FALSY value on all three keys, coerces a truthy
  // one to a string on `ticket` and `assigned`, and does NOT coerce on
  // `priority` — so `priority` is the only key this arm has ever fired on, and
  // an author who wrote `@{ priority: 1 }` was previously told nothing while
  // the canvas recorded that they had declared one. Finding F2 of the same
  // sweep.
  //
  // THE COLUMN-OR-CARD DISCRIMINATOR IS `shape`, NEVER `isGroup`. The census's
  // CONTRADICTION 1 measured `isGroup` as `true` on a column through
  // `getData()` and `false` on the SAME column through `getSections()`, in one
  // parse, on six probes, with no flag on either. `false` is an ordinary value
  // for a boolean, so a surface built on it reports every column as an item
  // and tells a reader the board has no columns at all. `level` encodes the
  // same distinction a third time and is not read either — it is the only one
  // of the three that survives a third indentation level, which is exactly why
  // it must not be used to decide what something IS.
  //
  // THE DB IS A SHARED SINGLETON AND IT CARRIES NO SCALAR HALF WHATEVER, so
  // this is the register item 21 hazard in its strongest form — stronger than
  // block's, because block at least has nothing to lose beyond payload and
  // this type has nothing BUT payload. Census § Q8 measured `dbA === dbB` true
  // across two parses with the first handle's accessors afterwards returning
  // the SECOND diagram's columns and cards. Every read below therefore happens
  // inside this parse's own queue slot and is copied into this adapter's own
  // objects in the same tick. A lost race here loses everything rather than
  // degrading, which is what concurrency row CK1 exists to see.
  //
  // `getData()` IS A BUILDER, NOT AN ACCESSOR — it returns fresh objects on
  // every call, and a render adds NO keys to the objects already handed out
  // (census § Q8, the opposite of block, whose render attaches a pixel `size`
  // and a live d3 selection). So no structured clone is needed. The copy below
  // is still key by key, for the reason the block surface gives: a closed key
  // list cannot be made to carry a field a later Mermaid build starts adding.
  //
  // THE ID FILTER IS THE DELIVERY RULE AND A POSITIONAL WALK IS NOT, AND THE
  // TWO DISAGREE ON REAL SOURCES. A column's cards are EVERY card node whose
  // `parentId` equals that column's id — a filter by id, never "the cards that
  // follow this column in the flat list". Measured 18 September 2026 across
  // five sources, canvas against both predictions, one fresh browser context
  // each: on a duplicate column id the id filter reproduced the canvas
  // EXACTLY and the positional walk did not. Two columns sharing an id, with
  // three cards declared between them, deliver six card nodes and draw six
  // cards IN EACH COLUMN; three columns sharing an id deliver nine and draw
  // nine in each. THE DB ITSELF MULTIPLIES THE CARDS BY THE NUMBER OF
  // COLLIDING COLUMNS, in every parse — proved not to be accumulation by four
  // sequential parses per source reading an identical figure each time, with a
  // non-duplicate control in the same shape. The id filter tracks that
  // multiplication and the positional walk halves it.
  //
  // SO THE CENSUS'S CONTRADICTION 4 IS CORRECTED HERE, having been an artefact
  // of the positional reading rather than a fault in the db. It recorded that a
  // duplicate column id makes the db "UNDER-REPORT the canvas by half" — six
  // nodes delivered against eight cards drawn. Both digits were reproduced
  // exactly in this session, on a source declaring ONE card per column, and
  // the per-column arithmetic was then taken both ways: the id filter answers
  // FOUR cards per column and the canvas draws FOUR, while the positional walk
  // answers two. The db and the canvas AGREE; it is the positional reading
  // that disagrees with both. A generator built on this surface therefore
  // states a card count a sighted reader can confirm.
  //
  // WHAT IS DELIBERATELY NOT DELIVERED, each for a measured reason:
  //   `icon` — `::icon(fa fa-book)` reaches the db and the canvas draws no
  //     <i>, <use> or <image> of any kind, proved by control in the same page
  //     (the identical construct on a MINDMAP renders an <i>). Delivering it
  //     would hand a generator something to narrate that no sighted reader is
  //     given. Census § Q10.
  //   `isGroup`, `level`, `look`, `rx`, `ry`, `cssStyles`, `shape` spellings,
  //     `width`, `padding` — layout, or the same distinction triplicated. The
  //     three mindmap card shapes draw byte-identically, so narrating one
  //     would describe something no sighted reader can see.
  //   `edges` and `other` — `Array(0)` and `{}` on every probe in the census
  //     and every source in this session. There are no relationships on a
  //     board and nothing has ever populated `other`.
  //   a `cardCount` field — the count is `cards.length`, computed once by the
  //     consumer. Two computations of one fact are how defects hide. Ruling
  //     KS7.
  //
  // THE BUILT TICKET URL IS DELIVERED, SINCE 20 SEPTEMBER 2026, AND FOR THREE
  // SESSIONS IT WAS NOT. The reversal is ruling KS8, which enacts Matthew's
  // review ruling MR2 — where the picture draws a ticket as a hyperlink, the
  // description carries a working hyperlink — and it SUPERSEDES ruling KS6 of
  // 18 September 2026, whose own re-open trigger was "a ruled, measured way to
  // carry an author URL into the description panel". Both halves of that
  // trigger are now measured, and the two records are
  // docs/mermaid-item-88-gold-3c-2026-09-20.md (the panel, the export routes,
  // the build rule and the hostile bases) and
  // docs/mermaid-item-88-gold-3d-2026-09-20.md (the route, the contamination
  // readings and the slot order).
  //
  // WHAT HELD IT UP FOR THREE SESSIONS WAS NOT THE RULING BUT THE READING. Six
  // routes to the base URL were measured on 20 September 2026 and every one
  // read the EMPTY STRING at parse time on every source, including sources
  // whose anchors the canvas then built correctly; the only route that ever
  // yielded a value yielded it after a RENDER, and was contaminated — an
  // unbased board read the PREVIOUS board's base. The seventh route,
  // `mermaid.parse(text)`'s own resolved `config`, is the one this surface
  // uses: it is Mermaid's own reader of the source's frontmatter and
  // `%%{init}%%` directives, it needs no render, and it is per-source by
  // construction. See readKanbanTicketBase.
  //
  // THE ALLOW-LIST IS IN ONE PLACE, buildKanbanTicketUrl, and `ticketUrl` is
  // null wherever it refuses — the ticket is then narrated as plain text, and
  // the board is never withheld for want of a link.
  //
  // `id` IS DELIVERED FOR DERIVATION CHECKS AND MUST NEVER BE NARRATED. A
  // no-id card takes its own LABEL as its id and so does a bare-text column,
  // and Mermaid permits duplicates at both kinds — this surface's own
  // self-check fixture contains two columns with one id. Ruling KS7.
  //
  // NO TRIM ON ANY LABEL. The census's `y[ ]` probe delivers a label of ONE
  // SPACE rather than the empty string, and it is delivered as one space; how
  // a narration speaks it is the gold document's question, not this file's.
  const KANBAN_SHAPE_COLUMN = "kanbanSection";
  const KANBAN_SHAPE_CARD = "kanbanItem";

  // The two keys a delivered kanban carries, in order. Named as a constant
  // because the self-check asserts the delivered key set EXACTLY against it.
  const KANBAN_DELIVERED_KEYS = Object.freeze(["diagramType", "columns"]);

  // The three keys a delivered COLUMN carries, in order.
  const KANBAN_COLUMN_KEYS = Object.freeze(["id", "label", "cards"]);

  // The seven keys a delivered CARD carries, in order. `ticketUrl` was added
  // 20 September 2026 by ruling KS8; `priorityDrawn` on 21 September 2026 by
  // ruling KS9, seated beside `priority` because the two answer one question
  // between them. The five before them are unmoved.
  const KANBAN_CARD_KEYS = Object.freeze([
    "id",
    "label",
    "ticket",
    "assigned",
    "priority",
    "priorityDrawn",
    "ticketUrl",
  ]);

  // THE FOUR PRIORITY STRINGS THE RENDERER DRAWS A VISIBLE MARK FOR, matched
  // on the RAW db string and never on the decoded one. Ruling KS9, and the
  // measurement behind it is M1 in
  // docs/mermaid-item-88-fix-7-2026-09-21.md: a priority authored
  // `H#105;gh` sits in the db as `H<sentinel>105<sentinel>gh`, decodes to the
  // exact string `High`, and the canvas draws its line with a COMPUTED
  // `stroke: none` — invisible — while a plain `High` card in the same source
  // draws `rgb(255, 165, 0)`. Three entity spellings were measured, each in
  // its own fresh browser context with that positive control beside it, and
  // every one was invisible. So the renderer compares the RAW bytes, and a
  // string that merely READS `High` after decoding is NOT drawn.
  //
  // WHY A SECOND COPY OF THIS VOCABULARY EXISTS. The generator also holds the
  // four, with the word each is spoken as, because it must say "high" rather
  // than "High". The two copies are not a duplicated computation: this one
  // decides whether the canvas DREW anything, which only the raw bytes can
  // answer, and the generator's decides what to CALL it. The generator throws
  // when it is handed `priorityDrawn: true` for a value its own list does not
  // carry, so a divergence between the two is loud rather than silent.
  const KANBAN_DRAWN_PRIORITIES = Object.freeze([
    "Very High",
    "High",
    "Low",
    "Very Low",
  ]);

  // The token the canvas substitutes the ticket into, and the ONLY two URL
  // schemes this surface will deliver. Both are named constants because the
  // self-check asserts against them and a literal in two places is a copy.
  const KANBAN_TICKET_TOKEN = "#TICKET#";
  const KANBAN_TICKET_URL_SCHEMES = Object.freeze(["http:", "https:"]);

  let kanbanMemoCode = null;
  let kanbanMemoPromise = null;
  let kanbanHealthy = null;
  let kanbanSelfCheckStarted = false;
  let kanbanSelfCheckPromise = null;

  /**
   * Read one of the three card metadata strings.
   *
   * GUARD FOR AN ABSENT KEY, NOT AN EMPTY ONE, and the distinction is measured
   * rather than defensive. On a CARD all three of `ticket`, `assigned` and
   * `priority` are OWN KEYS HOLDING undefined when the author declares none —
   * invisible to JSON.stringify, which is why the census read them with
   * Object.keys. On a COLUMN, `assigned` and `priority` are ABSENT ENTIRELY
   * while `ticket` is present and holds undefined; `parentId` is absent too.
   * So a reader that tests emptiness sees one case where there are two, and a
   * reader that dereferences a column's `parentId` throws on the first column.
   *
   * null FOR BOTH ABSENT CASES, never undefined, so a consumer has ONE absent
   * case per field. An EMPTY STRING the db really holds is delivered as "" —
   * the author wrote something and it is not this surface's business to decide
   * that it meant nothing.
   *
   * A NUMBER OR A BOOLEAN IS DELIVERED AS ITS String() FORM, per ruling KS10
   * of 21 September 2026, which amends KS4. It used to return null for
   * anything that was not a string, and that was a SILENT DROP: an author who
   * wrote `@{ priority: 1 }` had the canvas record that they declared a
   * priority — the mark is drawn, with `stroke: none` — while the words said
   * nothing at all. Matthew's ruling MR1 is that what is in the code is read
   * out, and a value is no less in the code for having been typed without
   * quotes. The generator's own `requireStringOrNull` could not catch it,
   * because by the time the field reached that guard it was already null,
   * which the guard is required to accept: the guard sat off the path the drop
   * happened on.
   *
   * WHAT CAN ACTUALLY ARRIVE HERE, measured 21 September 2026 (M2, in
   * docs/mermaid-item-88-fix-7-2026-09-21.md), on all three keys against
   * `true`, `false`, `0`, `1`, `null` and `''`:
   *
   *   Mermaid DROPS EVERY FALSY VALUE on all three keys — `false`, `0`, `null`
   *   and `''` each arrive as an own key holding `undefined`, exactly as an
   *   undeclared key does, so this function never sees them.
   *
   *   On `ticket` and `assigned` Mermaid COERCES a truthy non-string to a
   *   string itself: `1` arrives as `"1"` and `true` as `"true"`. So the
   *   coercion below is a DEFENCE on those two keys and not a live path.
   *
   *   On `priority` alone Mermaid does NOT coerce: `1` arrives as a `number`
   *   and `true` as a `boolean`. That asymmetry is UPSTREAM and not ours, and
   *   `priority` is the only key on which this arm has ever fired.
   *
   *   An ARRAY never arrives: `@{ assigned: [sam, kim] }` is flattened by
   *   Mermaid's own block reader to the string `"sam,kim"`. A MAP cannot be
   *   authored at all — `@{ assigned: { a: 1 } }` is a hard parse error. So
   *   the final null is a defence too, held because a later Mermaid build
   *   could start handing either over and a shape this surface does not
   *   understand must become an absence rather than a stringified `[object
   *   Object]`.
   *
   * ONE HELPER FOR ALL THREE KEYS, so the three cannot drift apart. KS10 asks
   * for exactly that, and the fact that two of the three can only reach the
   * defence arms is a reason to share the helper rather than to special-case
   * the one that cannot.
   *
   * @param {Object} raw - A db node object
   * @param {string} key - "ticket", "assigned" or "priority"
   * @returns {string|null} The author's value as a string, or null
   */
  function kanbanMetadata(raw, key) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, key)) {
      return null;
    }
    const value = raw[key];
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }

  /**
   * Did the canvas draw a visible priority mark for this card? - ruling KS9.
   *
   * READ OFF THE RAW DB STRING AND NOTHING ELSE. The renderer compares the
   * bytes the db holds, which carry Mermaid's own placeholder sentinels and
   * the author's undecoded entities, so a priority written `H#105;gh` is NOT
   * drawn even though it decodes to the exact string `High`. Measured in M1;
   * see KANBAN_DRAWN_PRIORITIES above for the readings.
   *
   * IT IS DELIVERED AS ITS OWN KEY RATHER THAN LEFT TO THE GENERATOR because
   * the generator is given the DECODED priority, by the same ruling, and the
   * decoded string cannot answer this question: `H#105;gh` and `High` deliver
   * the identical `priority` and differ here. A consumer that tested the
   * delivered string would narrate an invisible mark as a drawn one.
   *
   * @param {Object} raw - A db card node
   * @returns {boolean} True when the canvas draws a visible mark
   */
  function kanbanPriorityDrawn(raw) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, "priority")) {
      return false;
    }
    return KANBAN_DRAWN_PRIORITIES.indexOf(raw.priority) !== -1;
  }

  /**
   * Build the address the canvas links a ticket to, or null.
   *
   * THIS IS THE ONE PLACE THE ALLOW-LIST LIVES, per ruling KS8 of
   * 20 September 2026, which enacts Matthew's review ruling MR2: where the
   * picture draws a ticket as a hyperlink, the description carries a working
   * hyperlink. A second copy of a scheme test is how one of them goes stale.
   *
   * THE BUILD RULE IS THE CANVAS'S OWN, SCORED RATHER THAN ASSERTED. Session
   * 3c put three candidate rules against the rendered `xlink:href` on nine
   * sources — five ticket constructs at one base and four base shapes at one
   * ticket. The FIRST occurrence of `#TICKET#` replaced by
   * `decodePlaceholders(the db's RAW ticket)` scored 9 of 9; the raw db bytes
   * scored 8 and the DRAWN ticket text scored 8. The two separating rows are
   * worth knowing, because a single-candidate check could not have found
   * either: a ticket written `'A&amp;B-1'` is drawn `A&B-1` but linked
   * `A&amp;B-1`, and a ticket written `'say #quot;hi#quot;'` sits in the db as
   * Mermaid's own placeholder sentinels and is linked `say "hi"`. So the
   * DELIVERED `ticket` (decodeAuthorText) is the wrong string for a URL and
   * the raw db bytes are the wrong string too.
   *
   * A BASE WITH NO TOKEN IS USED VERBATIM and the ticket is NOT appended, so
   * every card on such a board links to the same address — measured, not
   * assumed. A base carrying the token TWICE has only its first replaced; the
   * second is left literal.
   *
   * WHY `document.baseURI` IS PASSED TO `new URL`. A relative base such as
   * `/browse/#TICKET#` is kept by the canvas and drawn as a live relative
   * href, and Matthew's rule is that a link in the picture is a link in the
   * words — so refusing it here would withhold a link a sighted reader is
   * given. Resolving it still refuses `javascript:` and `data:`, because those
   * resolve to their own protocol whatever the base is, and the canvas refuses
   * them too: at `securityLevel: "strict"` Mermaid draws the anchor carrying
   * NO href at all.
   *
   * THE DELIVERED STRING IS `built`, VERBATIM — never `url.href`, which
   * normalises, percent-encodes and resolves. A URL is never transformed by
   * this adapter; the sequence surface's link handling is the precedent. The
   * resolved URL exists only to be tested.
   *
   * @param {string|null} base - The source's own ticketBaseUrl, or null
   * @param {string|null} rawTicket - The db's RAW ticket string, or null
   * @returns {string|null} The address, or null when any clause refuses
   */
  function buildKanbanTicketUrl(base, rawTicket) {
    if (typeof rawTicket !== "string" || rawTicket.trim() === "") {
      return null;
    }
    if (typeof base !== "string" || base === "") {
      return null;
    }
    const decoded = decodePlaceholders(rawTicket);
    const at = base.indexOf(KANBAN_TICKET_TOKEN);
    const built =
      at === -1
        ? base
        : base.slice(0, at) + decoded + base.slice(at + KANBAN_TICKET_TOKEN.length);

    let resolved = null;
    try {
      resolved = new URL(built, document.baseURI);
    } catch (error) {
      logDebug(
        `Kanban ticket URL refused, unparseable: ${JSON.stringify(built)} (${error && error.message})`
      );
      return null;
    }
    if (KANBAN_TICKET_URL_SCHEMES.indexOf(resolved.protocol) === -1) {
      logDebug(
        `Kanban ticket URL refused, scheme ${JSON.stringify(resolved.protocol)} is not in the allow-list`
      );
      return null;
    }
    return built;
  }

  /**
   * Read THIS source's own `kanban.ticketBaseUrl`, through `mermaid.parse`.
   *
   * THE ROUTE, AND WHY IT IS THIS ONE. `mermaid.parse(text)` resolves to
   * `{ diagramType, config }`, where `config` holds the configuration THE
   * SOURCE ITSELF declares — frontmatter and `%%{init}%%` directives, merged
   * by Mermaid's own rule, with the directive winning where both set a value.
   * Measured 20 September 2026 on five sources, each in its own fresh browser
   * context, against the rendered `xlink:href` in a separate context: the
   * route and the canvas AGREE ON ALL FIVE, the both-set winner included.
   *
   * SIX OTHER ROUTES WERE MEASURED ON 20 SEPTEMBER 2026 AND ALL SIX FAILED,
   * which is why this one is not an obvious choice arrived at cheaply.
   * `mermaidAPI.getConfig().kanban`, `getSiteConfig().kanban`, the Diagram
   * object's own `config` and `getConfig`, `db.getConfig` and
   * `db.getData().config.kanban` all read the EMPTY STRING at parse time on
   * every source — including sources whose anchors the canvas then builds
   * correctly — because the base reaches the RENDERER and not the config the
   * db hands over. The value appears on those routes only AFTER a render, and
   * a post-render read is CONTAMINATED: a board with no base at all read the
   * PREVIOUS board's base, so a rule built on one would have linked tickets on
   * boards whose author set no link.
   *
   * THIS ROUTE IS NOT CONTAMINATED, measured in six arrangements in one page
   * each: after a based board was RENDERED, an unbased source still read no
   * kanban config; the reverse order the same; and two calls in flight at once
   * each read their own source's answer, in both issue orders. Every absence
   * was printed as an explicit marker rather than as a dropped JSON key,
   * because `JSON.stringify` discards a key holding `undefined` and an absence
   * reported by omission cannot be told from a reading never taken.
   *
   * IT RUNS INSIDE THE CALLER'S OWN QUEUE SLOT AND BEFORE
   * `getDiagramFromText`, which is the order measured to be safe. This IS a
   * parse: it clears Mermaid's shared common store and it replaces the kanban
   * db singleton's contents like any other. Running it FIRST means the db read
   * is the last thing in the slot and nothing can come between them — measured
   * with a positive control, a FOREIGN source parsed after the diagram handle
   * was taken, which replaced that handle's nodes entirely. The cost on gold
   * E6, mean of twelve runs after three warm-ups, is about 0.85ms on top of a
   * 1.16ms `getDiagramFromText`.
   *
   * IT NEVER REJECTS. A source Mermaid can diagram but this route refuses
   * yields a null base, and every card then delivers `ticketUrl: null` with
   * the rest of the board unchanged — ruling KS8. A missing link must never
   * cost the reader the description.
   *
   * @param {string} code - The Mermaid kanban source
   * @returns {Promise<string|null>} The source's own base URL, or null
   */
  function readKanbanTicketBase(code) {
    if (!window.mermaid || typeof window.mermaid.parse !== "function") {
      logDebug("mermaid.parse is unavailable; kanban ticket URLs will be null");
      return Promise.resolve(null);
    }
    return Promise.resolve()
      .then(() => window.mermaid.parse(code))
      .then((parsed) => {
        if (!parsed || typeof parsed !== "object") {
          return null;
        }
        const config = parsed.config;
        if (!config || typeof config !== "object") {
          return null;
        }
        const kanbanConfig = config.kanban;
        if (!kanbanConfig || typeof kanbanConfig !== "object") {
          return null;
        }
        const base = kanbanConfig.ticketBaseUrl;
        return typeof base === "string" ? base : null;
      })
      .catch((error) => {
        logDebug(
          `Kanban ticket base read failed, delivering null: ${error && error.message}`
        );
        return null;
      });
  }

  /**
   * Copy ONE db card into this surface's own object.
   *
   * THE KEY LIST IS CLOSED AND THAT IS THE POINT. Only the seven keys in
   * KANBAN_CARD_KEYS are produced, from the six db keys this surface reads;
   * nothing is spread, assigned wholesale or cloned, so the eight db keys this
   * surface refuses — `isGroup`, `level`, `icon`, `shape`, `rx`, `ry`,
   * `cssStyles` and `parentId` — cannot cross into the delivery, and neither
   * can a ninth a later Mermaid build adds. TWO of the seven are COMPUTED
   * rather than copied, and both are computed from a RAW db value rather than
   * from a delivered one: `ticketUrl` from the raw ticket (see
   * buildKanbanTicketUrl) and `priorityDrawn` from the raw priority (see
   * kanbanPriorityDrawn). In both cases the delivered string has been decoded
   * and the decode destroys the distinction the computation needs.
   *
   * @param {Object} raw - A db card node
   * @param {string|null} ticketBase - This source's own ticketBaseUrl, or null
   * @returns {Object} The delivered card
   */
  function copyKanbanCard(raw, ticketBase) {
    const rawTicket = kanbanMetadata(raw, "ticket");
    const id = typeof raw.id === "string" ? raw.id : "";
    // Item 82, L2 (6 October 2026, enactment 3): the label and the assignee
    // are read for the links the picture draws on them, in the same tick as
    // the rest of the snapshot. The ticket route below is untouched.
    const labelRead =
      typeof raw.label === "string"
        ? readLabelWithLinks(raw.label, KANBAN_DRAWN_MARKUP)
        : null;
    const rawAssigned = kanbanMetadata(raw, "assigned");
    const assignedRead =
      rawAssigned === null
        ? null
        : readLabelWithLinks(rawAssigned, KANBAN_DRAWN_MARKUP);
    return {
      id: id,
      // decodeAuthorText, per the ruling above. A card whose db label is absent
      // delivers the id, which is what the db itself would have put there — a
      // no-id card's id IS its label — so the fallback is a defence rather
      // than a live path.
      // ITEM 82 (2 October 2026): the card label and `assigned` are positions
      // whose canvas DRAWS a break, so they take decodeAuthorTextBreaks.
      // Markup (5 October 2026, enactment 3): and drawn formatting is read as
      // its text (KANBAN_DRAWN_MARKUP). The `priority` and the
      // `priorityDrawn` computation take neither: the picture draws a
      // priority only on a raw exact match, so a priority carrying a tag is
      // undrawn and reads as written.
      label: labelRead ? labelRead.label : id,
      ...(labelRead && labelRead.segments
        ? { segments: labelRead.segments }
        : {}),
      // The TICKET TEXT takes the same transform (measured 5 October 2026:
      // the canvas draws a typed <br> in a ticket as a break and prints the
      // escaped forms, and draws formatting and emphasis). NOTE that the URL
      // below is built from `rawTicket` and NOT from this transformed string:
      // the canvas builds its href from the raw ticket with any tags in it
      // (measured 5 October 2026, six cards, frontmatter and directive), and
      // `ticketUrl` is the address the canvas links to, verbatim, so only the
      // TEXT is read as plain.
      ticket:
        rawTicket === null
          ? null
          : decodeAuthorTextBreaks(rawTicket, KANBAN_DRAWN_MARKUP),
      assigned: assignedRead ? assignedRead.label : null,
      ...(assignedRead && assignedRead.segments
        ? { assignedSegments: assignedRead.segments }
        : {}),
      // decodeAuthorText, SINCE 21 SEPTEMBER 2026 AND RULING KS9, which
      // REVERSES the no-transform arm of KS3. That ruling reasoned that there
      // is no drawn string for a transform to agree with, which is true and
      // led to the wrong answer: the alternative to agreeing with the canvas
      // is not "deliver the raw bytes" but "deliver what the author wrote".
      // The db does NOT hold the author's string — it holds Mermaid's own
      // parse-time encoding of it, in which `#quot;` has already become a
      // private sentinel and `&amp;` has not been decoded at all — so a
      // listener was being read machine tokens. Measured as finding F1 of the
      // hostile sweep, docs/mermaid-item-88-sweep-6-2026-09-21.md, where a
      // card declaring the SAME construct in every field delivered its label,
      // ticket and assigned equal to the canvas byte for byte and its priority
      // as `P&amp;&lt;&gt;<sentinel>quot<sentinel>…`.
      priority: (() => {
        const value = kanbanMetadata(raw, "priority");
        return value === null ? null : decodeAuthorText(value);
      })(),
      // WHETHER THE CANVAS DREW A MARK, read off the RAW string. Ruling KS9.
      // It must be delivered separately because the decode above destroys the
      // distinction: `H#105;gh` and `High` deliver the identical `priority`.
      priorityDrawn: kanbanPriorityDrawn(raw),
      // THE ADDRESS THE CANVAS LINKS THIS TICKET TO, or null. Ruling KS8.
      ticketUrl: buildKanbanTicketUrl(ticketBase, rawTicket),
    };
  }

  /**
   * Normalise one Mermaid kanban board into the twelfth surface's delivery.
   *
   * EAGER SNAPSHOT (the singleton defence, census § Q8): `getData()` is called
   * ONCE here, inside the parse's own .then and behind the adapter-wide queue,
   * and every value is mapped into this adapter's own objects in the same tick.
   * Nothing in the returned object references a db-owned object, and no
   * consumer may ever go back to the db later — on this type a second parse
   * replaces the WHOLE payload, and there is no scalar half to survive it.
   *
   * `getSections()` IS NOT READ HERE, AND THAT IS A RULING. It is the other
   * payload accessor and it carries nothing a narration wants that
   * `getData()` lacks — four of its six keys are shared and the other two are
   * the layout numbers `width` and `padding`. It also disagrees with
   * `getData()` about `isGroup` on the same column in the same parse. It is
   * read in the SELF-CHECK ONLY, as a cross-check that the column count and
   * order agree, which is the one thing it can honestly corroborate.
   *
   * AN UNKNOWN `shape` IS A STOP, NOT A SILENT DROP. The vocabulary is two
   * words and a third would mean this surface no longer knows what the db is
   * handing it — so it throws, the parse rejects, and the consumer reaches the
   * honest-unsupported fallback rather than a board with things missing from
   * it. A dropped node would be invisible: a column short of a card looks
   * exactly like a column with fewer cards.
   *
   * THE TICKET BASE IS PASSED IN, NOT READ HERE, and that is deliberate. It
   * comes from `readKanbanTicketBase`, which runs earlier in the same queue
   * slot; taking it as a parameter keeps this function a pure mapping over one
   * diagram and lets the self-check exercise every arm of the allow-list
   * without needing a source per arm. It DEFAULTS to null, so a caller that
   * knows of no base delivers `ticketUrl: null` on every card rather than
   * throwing — which is also ruling KS8's fallback.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string|null} [ticketBase] - This source's own ticketBaseUrl
   * @returns {Object} The normalised kanban delivery
   * @throws {Error} When a node carries a shape this surface does not know
   */
  function normaliseKanban(diagram, ticketBase = null) {
    const db = diagram.db;

    // THE ONE READ. Everything below maps this and nothing else.
    const data = db.getData();
    const rawNodes = data && Array.isArray(data.nodes) ? data.nodes : [];

    const rawColumns = [];
    const rawCards = [];
    for (const node of rawNodes) {
      const shape = node && node.shape;
      if (shape === KANBAN_SHAPE_COLUMN) {
        rawColumns.push(node);
      } else if (shape === KANBAN_SHAPE_CARD) {
        rawCards.push(node);
      } else {
        throw new Error(
          "Kanban node carries an unknown shape " +
            JSON.stringify(shape) +
            "; this surface knows only " +
            JSON.stringify(KANBAN_SHAPE_COLUMN) +
            " and " +
            JSON.stringify(KANBAN_SHAPE_CARD) +
            ". Refusing to deliver a partial board."
        );
      }
    }

    return {
      // `diagramType` rather than `type`, matching block and c4. Kanban has no
      // per-node `type` key of its own, but the two surfaces before it settled
      // the spelling and a third name for one fact would be worse than a
      // consistent one.
      diagramType: "kanban",
      columns: rawColumns.map((rawColumn) => {
        const id = typeof rawColumn.id === "string" ? rawColumn.id : "";
        // Item 82, L2 (enactment 3): and a link the picture draws on it
        // arrives as `segments`, beside the unchanged label.
        const labelRead =
          typeof rawColumn.label === "string"
            ? readLabelWithLinks(rawColumn.label, KANBAN_DRAWN_MARKUP)
            : null;
        return {
          id: id,
          // Item 82: a column label is a break-drawing position too, and
          // (markup, 5 October 2026) reads drawn formatting as its text.
          label: labelRead ? labelRead.label : id,
          ...(labelRead && labelRead.segments
            ? { segments: labelRead.segments }
            : {}),
          // THE ID FILTER, per ruling KS2 and the measurement above. Never a
          // positional walk: the two disagree wherever two columns share an
          // id, and it is the walk that disagrees with the canvas.
          cards: rawCards
            .filter((rawCard) => rawCard.parentId === id)
            .map((rawCard) => copyKanbanCard(rawCard, ticketBase)),
        };
      }),
    };
  }

  /**
   * Parse a kanban board and deliver the normalised shape.
   *
   * Same contract as the other eleven surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every
   * db read happens inside this call's own queue slot. On this type the queue
   * is load-bearing for the whole delivery — the db is a singleton with no
   * per-instance half at all.
   *
   * @param {string} code - The Mermaid kanban source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseKanban(code) {
    if (!kanbanSelfCheckStarted) {
      runKanbanSelfCheck();
    }

    if (code === kanbanMemoCode && kanbanMemoPromise) {
      logDebug("Returning memoised kanban parse for identical code string");
      return kanbanMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(`Kanban parse entering its queue slot, ${code.length} characters`);
      // THE BASE READ COMES FIRST, INSIDE THIS SAME SLOT. `mermaid.parse` is
      // itself a parse — it replaces this singleton db's contents — so taking
      // it BEFORE `getDiagramFromText` leaves the db read last, with nothing
      // able to come between the handle and the read. Measured 20 September
      // 2026; the reverse order also delivered correctly on the same source,
      // and this one is chosen because it does not depend on that.
      return readKanbanTicketBase(code)
        .then((ticketBase) => {
          logDebug(
            `Kanban ticket base for this source: ${JSON.stringify(ticketBase)}`
          );
          return window.mermaid.mermaidAPI
            .getDiagramFromText(code)
            .then((diagram) => ({ diagram, ticketBase }));
        })
        .then(({ diagram, ticketBase }) => {
          logDebug(
            `Kanban parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const kanban = normaliseKanban(diagram, ticketBase);
          const cardTotal = kanban.columns.reduce(
            (total, column) => total + column.cards.length,
            0
          );
          logDebug(
            `Kanban parse delivered after ${Math.round(performance.now() - startedAt)}ms: ` +
              `${kanban.columns.length} column(s), ${cardTotal} card(s)`
          );
          return kanban;
        })
        .catch((error) => {
          logDebug(
            `Kanban parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    kanbanMemoCode = code;
    kanbanMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: two ordinary columns, an EMPTY column between them, a
   * card carrying all three metadata keys, a card carrying none, an HTML
   * entity in a column label, and a DUPLICATE COLUMN ID pair at the end.
   *
   * THE DUPLICATE PAIR IS THE POINT, and without it this fixture would pass
   * whether the delivery used the id filter or a positional walk — the two
   * rules agree on every source where no two columns share an id, which is
   * every ordinary board. Measured 18 September 2026: the pair delivers FOUR
   * card nodes all pointing at `scDup`, the canvas draws FOUR cards in EACH of
   * the two columns, the id filter answers four and a positional walk answers
   * two. The collision is LOCAL — `scTodo`, `scEmpty` and `scDone` are
   * unaffected by it — which is what makes it safe to carry in a fixture whose
   * other assertions are about ordinary columns.
   *
   * THE EMPTY COLUMN IS THE SECOND POINT. The canvas draws it, with its own
   * rect and its own heading, so a delivery that omitted it would withhold
   * something a sighted reader is given; and an empty `cards` array is the one
   * shape a consumer must never have to test for absence.
   *
   * ASCII only, every string distinctive and prefixed SelfCheck, so a
   * cross-delivery from another diagram NAMES ITS SOURCE rather than merely
   * looking wrong.
   */
  const KANBAN_SELF_CHECK_FIXTURE = [
    "kanban",
    "    scTodo[SelfCheck todo &amp; more]",
    "        scOne[SelfCheck one]@{ ticket: 'SC-1', assigned: 'scsam', priority: 'High' }",
    "        scTwo[SelfCheck two]",
    "    scEmpty[SelfCheck empty]",
    "    scDone[SelfCheck done]",
    "        scThree[SelfCheck three]",
    "    scDup[SelfCheck dup first]",
    "        scFour[SelfCheck four]",
    "    scDup[SelfCheck dup second]",
    "        scFive[SelfCheck five]",
  ].join("\n");

  // Item 82: a SEPARATE source, because the concurrency lane quotes the one
  // above verbatim. A typed break and an author-escaped one on all three
  // kanban positions whose canvas draws a break: a column label, a card label
  // and an assigned.
  const KANBAN_BREAK_SELF_CHECK_FIXTURE = [
    "kanban",
    "    scbTyped[one<br>two]",
    "        scbTypedCard[three<br>four]@{ assigned: 'five<br>six' }",
    "    scbEscaped[seven&lt;br&gt;eight]",
    "        scbEscapedCard[nine&lt;br&gt;ten]@{ assigned: 'eleven&lt;br&gt;twelve' }",
  ].join("\n");

  // Item 82, markup (5 October 2026): a THIRD source for the markup rows,
  // parsed after the break source, for the same reason that one is separate.
  // Four columns, one per reading: a typed tag, an author-escaped tag, a
  // tag-only label and emphasis (which kanban DRAWS), each on the column, the
  // card label, the ticket and the assigned. The ticket carries its tags into
  // the address on purpose: the canvas builds its href from the raw ticket.
  const KANBAN_MARKUP_SELF_CHECK_FIXTURE = [
    "kanban",
    '    scmTyp["<b>one</b>"]',
    "        scmTypCard[\"<i>two</i>\"]@{ ticket: 'T<b>3</b>', assigned: '<u>four</u>' }",
    '    scmEsc["&lt;b&gt;five&lt;/b&gt;"]',
    "        scmEscCard[\"&lt;i&gt;six&lt;/i&gt;\"]@{ ticket: '&lt;b&gt;seven&lt;/b&gt;', assigned: '&lt;u&gt;eight&lt;/u&gt;' }",
    '    scmNil["<b></b>"]',
    "        scmNilCard[\"<i></i>\"]@{ ticket: '<b></b>', assigned: '<u></u>' }",
    '    scmEmp["**nine**"]',
    "        scmEmpCard[\"**ten**\"]@{ ticket: '**eleven**', assigned: '_twelve_' }",
  ].join("\n");
  const KANBAN_MARKUP_SELF_CHECK_BASE =
    "https://selfcheck.example.org/browse/#TICKET#";

  /**
   * The SECOND self-check fixture, added 20 September 2026 with ruling KS8.
   *
   * IT IS A SEPARATE SOURCE RATHER THAN A FRONTMATTER BLOCK ON THE FIRST ONE,
   * for two reasons. The concurrency lane quotes the first fixture VERBATIM to
   * settle the surface before CK2, so a change to it is a change in two files
   * and the copy would drift. And a base URL is a property of a SOURCE, so the
   * only honest way to exercise the real route is to parse a source that
   * declares one — a synthetic base handed to `normaliseKanban` would prove
   * the allow-list and say nothing whatever about whether the base is
   * READABLE, which is the half three sessions could not previously obtain.
   *
   * THE THREE CARDS ARE THE THREE ARMS THIS SOURCE CAN REACH: a ticket that
   * links, a WHITESPACE-ONLY ticket that must not, and a card with no ticket
   * at all. The allow-list's refusing arms are exercised below through
   * `normaliseKanban` directly, because a `javascript:` base cannot be told
   * from a working one by looking at the board.
   */
  const KANBAN_SELF_CHECK_URL_FIXTURE = [
    "---",
    "config:",
    "  kanban:",
    "    ticketBaseUrl: 'https://selfcheck.example.org/browse/#TICKET#'",
    "---",
    "kanban",
    "    scuCol[SelfCheck url column]",
    "        scuOne[SelfCheck url one]@{ ticket: 'SCU-1' }",
    "        scuTwo[SelfCheck url two]@{ ticket: ' ' }",
    "        scuThree[SelfCheck url three]",
  ].join("\n");

  // Item 82, L2 (6 October 2026, enactment 3): the kanban link rows. A source
  // of its own, parsed in its own queue slot after the others, so every
  // existing fixture and every count asserted against it stays as it was (the
  // concurrency lane quotes the main one verbatim). Each link form is the
  // measurement's (docs/mermaid-item-82-l2-measure-2026-10-05.md section 1); a
  // column label, a card label and an assignee are the three positions that
  // can carry one. It carries a ticket base so a card can hold a label link
  // AND a ticket link at once.
  const KANBAN_LINK_SELF_CHECK_FIXTURE = [
    "---",
    "config:",
    "  kanban:",
    "    ticketBaseUrl: 'https://selfcheck.example.org/browse/#TICKET#'",
    "---",
    "kanban",
    "    lkC1[\"Zq <a href='https://example.org/a b?x=1&y=2'>text</a>\"]",
    "        lkK1[\"<a href='https://example.org'>one</a> and <a href='https://example.net'>two</a>\"]",
    "        lkK2[\"<a href='https://example.org'><b>bold link</b></a>\"]",
    "        lkK3[\"<a href='https://example.org'>dup</a> and dup\"]",
    "        lkK4[\"<a href='https://example.org/a&quot;b'>quote in href</a>\"]@{ assigned: \"<a href='https://example.org/a&quot;b'>quote</a>\" }",
    "    lkC2[\"<a href='/relative'>r</a> <a href='//example.org/p'>p</a> <a href='HTTPS://EXAMPLE.ORG/X'>upper</a>\"]",
    "        lkK5[\"<a href='javascript:alert(1)'>j</a> <a href='mailto:a@example.org'>m</a> <a>none</a> <a href='https://example.org'></a>.\"]@{ assigned: \"<a href='mailto:a@example.org'>Kim</a> <a>Sam</a>\" }",
    "        lkK6[\"Fix <a href='https://example.org/bug'>bug</a>\"]@{ ticket: 'T1', assigned: \"<a href='https://example.org/sam'>Sam</a>\" }",
    "        lkK7[Plain]@{ ticket: 'T2' }",
    "    lkC3[\"<a href='https://example.org'></a>\"]",
  ].join("\n");

  /**
   * The link rows of the kanban self-check, over the delivered link fixture.
   * @param {Object} delivery - The normalised kanban link fixture
   * @returns {Array} Assertion rows
   */
  function kanbanLinkAssertions(delivery) {
    const same = (actual, expected) =>
      JSON.stringify(actual) === JSON.stringify(expected);
    const column = (id) => delivery.columns.find((c) => c.id === id);
    const card = (id) => {
      for (const c of delivery.columns) {
        const found = c.cards.find((k) => k.id === id);
        if (found) {
          return found;
        }
      }
      return undefined;
    };
    const cards = delivery.columns.flatMap((c) => c.cards);
    const labelled = [].concat(delivery.columns, cards).filter((e) => e.segments);
    const assigned = cards.filter((k) => k.assignedSegments);
    return [
      [
        "link: a column label's link, its & decoded once and its space kept (m6)",
        !!column("lkC1") &&
          column("lkC1").label === "Zq text" &&
          same(column("lkC1").segments, [
            { text: "Zq " },
            { text: "text", href: "https://example.org/a b?x=1&y=2" },
          ]),
      ],
      [
        "link: two links in one card label, in order (l1)",
        !!card("lkK1") &&
          same(card("lkK1").segments, [
            { text: "one", href: "https://example.org" },
            { text: " and " },
            { text: "two", href: "https://example.net" },
          ]),
      ],
      [
        "link: a nested bold link reads as 'bold link' (l2)",
        !!card("lkK2") &&
          card("lkK2").label === "bold link" &&
          same(card("lkK2").segments, [
            { text: "bold link", href: "https://example.org" },
          ]),
      ],
      [
        "link: the first of two identical words is the linked one (l3)",
        !!card("lkK3") &&
          same(card("lkK3").segments, [
            { text: "dup", href: "https://example.org" },
            { text: " and dup" },
          ]),
      ],
      [
        "link: the quote entity in an href is decoded once, on a card label " +
          "and on an assignee (l7)",
        !!card("lkK4") &&
          same(card("lkK4").segments, [
            { text: "quote in href", href: 'https://example.org/a"b' },
          ]) &&
          same(card("lkK4").assignedSegments, [
            { text: "quote", href: 'https://example.org/a"b' },
          ]),
      ],
      [
        "link: relative, protocol-relative and upper-case-scheme hrefs are " +
          "admitted as written (m9, l6, l4)",
        !!column("lkC2") &&
          same(column("lkC2").segments, [
            { text: "r", href: "/relative" },
            { text: " " },
            { text: "p", href: "//example.org/p" },
            { text: " " },
            { text: "upper", href: "HTTPS://EXAMPLE.ORG/X" },
          ]),
      ],
      [
        "link: javascript:, mailto:, no href and an empty link are plain " +
          "text on a card label and an assignee (m7, m8, l8, m10)",
        !!card("lkK5") &&
          card("lkK5").label === "j m none ." &&
          same(card("lkK5").segments, [{ text: "j m none ." }]) &&
          card("lkK5").assigned === "Kim Sam" &&
          same(card("lkK5").assignedSegments, [{ text: "Kim Sam" }]),
      ],
      [
        "link: a card with a label link, an assignee link and a ticket under " +
          "a base delivers all three and none alters another",
        !!card("lkK6") &&
          card("lkK6").label === "Fix bug" &&
          card("lkK6").ticket === "T1" &&
          card("lkK6").ticketUrl === "https://selfcheck.example.org/browse/T1" &&
          same(card("lkK6").segments, [
            { text: "Fix " },
            { text: "bug", href: "https://example.org/bug" },
          ]) &&
          same(card("lkK6").assignedSegments, [
            { text: "Sam", href: "https://example.org/sam" },
          ]) &&
          !!card("lkK7") &&
          card("lkK7").ticketUrl === "https://selfcheck.example.org/browse/T2" &&
          card("lkK7").segments === undefined &&
          card("lkK7").assignedSegments === undefined,
      ],
      [
        "link: a column label that is only an empty link is empty text with " +
          "no linked segment (m10)",
        !!column("lkC3") &&
          column("lkC3").label === "" &&
          same(column("lkC3").segments, []),
      ],
      [
        "link: the segment texts join to the delivered label and assignee, " +
          "everywhere",
        labelled.length === 9 &&
          assigned.length === 3 &&
          labelled.every((e) => e.segments.map((s) => s.text).join("") === e.label) &&
          assigned.every(
            (k) => k.assignedSegments.map((s) => s.text).join("") === k.assigned
          ),
      ],
    ];
  }

  /**
   * Parse the kanban link fixture in its own queue slot and return its rows.
   * Read the ticket base the way the real route does, so the ticket anchor's
   * address is the delivered one. A rejection is one failing row, not a throw.
   * @returns {Promise<Array>} Assertion rows
   */
  function runKanbanLinkRows() {
    const run = () =>
      readKanbanTicketBase(KANBAN_LINK_SELF_CHECK_FIXTURE).then((base) =>
        window.mermaid.mermaidAPI
          .getDiagramFromText(KANBAN_LINK_SELF_CHECK_FIXTURE)
          .then((diagram) => kanbanLinkAssertions(normaliseKanban(diagram, base)))
      );
    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued.catch((error) => [
      [`kanban link fixture parses (rejected: ${error && error.message})`, false],
    ]);
  }

  /**
   * The THIRD self-check fixture, added 21 September 2026 with rulings KS9 and
   * KS10.
   *
   * IT IS A REAL PARSE RATHER THAN A STUB, for the reason the URL fixture
   * gives: a synthetic sentinel string handed to `normaliseKanban` would prove
   * the decode and say nothing whatever about whether Mermaid really encodes
   * `#105;` that way, and a synthetic `1` would say nothing about whether the
   * db really hands a NUMBER over on this key. Both halves are the premise the
   * two rulings rest on, and both were false in the rulings they replace.
   *
   * THE FIVE CARDS ARE THE FIVE ARMS. `scpDrawn` and `scpEntity` are the pair
   * that matters: they deliver the IDENTICAL `priority` string `High` and
   * DIFFER on `priorityDrawn`, which is the whole of KS9 in one row and cannot
   * be shown by either card alone. `scpNumber` and `scpBoolean` are KS10's
   * live arm, the only key on which Mermaid declines to coerce. `scpEscapable`
   * is finding F1's own source, cut to one card.
   *
   * It is a SEPARATE source rather than cards added to the first fixture,
   * because the concurrency lane quotes that one VERBATIM and a change to it
   * is a change in two files.
   */
  const KANBAN_SELF_CHECK_PRIORITY_FIXTURE = [
    "kanban",
    "    scpCol[SelfCheck priority column]",
    "        scpDrawn[SelfCheck priority drawn]@{ priority: 'High' }",
    "        scpEntity[SelfCheck priority entity]@{ priority: 'H#105;gh' }",
    "        scpNumber[SelfCheck priority number]@{ priority: 1 }",
    "        scpBoolean[SelfCheck priority boolean]@{ priority: true }",
    "        scpEscapable[SelfCheck priority escapable]@{ priority: 'A&amp;B #quot;c#quot; &lt;d&gt;' }",
  ].join("\n");

  /**
   * A minimal synthetic diagram carrying ONE card with one ticket, for the
   * allow-list rows. It is deliberately not a parse: the arms it exercises
   * differ only in the BASE, and a source per arm would make the rows about
   * Mermaid's config handling rather than about this surface's allow-list.
   *
   * @param {string} ticket - The raw ticket string
   * @returns {Object} A stand-in with the one accessor normaliseKanban reads
   */
  function kanbanStubDiagram(ticket) {
    return {
      db: {
        getData: () => ({
          nodes: [
            { id: "stubCol", label: "Stub", shape: KANBAN_SHAPE_COLUMN },
            {
              id: "stubCard",
              label: "Stub card",
              shape: KANBAN_SHAPE_CARD,
              parentId: "stubCol",
              ticket: ticket,
            },
          ],
        }),
      },
    };
  }

  /**
   * The delivered ticketUrl for one base, through the REAL delivery path.
   * @param {string|null} base - The base under test
   * @param {string} [ticket] - The raw ticket string
   * @returns {string|null} The delivered ticketUrl
   */
  function kanbanStubTicketUrl(base, ticket = "ABC-1") {
    return normaliseKanban(kanbanStubDiagram(ticket), base).columns[0].cards[0]
      .ticketUrl;
  }

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the kanban surface unhealthy, and
   * resolves false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the kanban health verdict
   */
  function runKanbanSelfCheck() {
    if (kanbanSelfCheckPromise) {
      return kanbanSelfCheckPromise;
    }
    kanbanSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          // THE URL FIXTURE RUNS FIRST AND IS READ TO COMPLETION BEFORE THE
          // MAIN FIXTURE IS PARSED. The db is a singleton, so the second parse
          // replaces the first's nodes entirely; the delivery is copied into
          // this adapter's own objects by normaliseKanban, so it survives.
          return readKanbanTicketBase(KANBAN_SELF_CHECK_URL_FIXTURE).then(
            (urlBase) =>
              window.mermaid.mermaidAPI
                .getDiagramFromText(KANBAN_SELF_CHECK_URL_FIXTURE)
                .then((urlDiagram) => ({
                  urlBase: urlBase,
                  urlDelivery: normaliseKanban(urlDiagram, urlBase),
                }))
          );
        })
        .then((urlResult) =>
          // THE PRIORITY FIXTURE RUNS SECOND, on the same reasoning: it is read
          // to completion, and both its DELIVERY and the RAW db values it was
          // built from are copied out before the next parse replaces the
          // singleton. The raw values are carried because two of the rows
          // below are two-sided — they assert what Mermaid handed over AND
          // what this surface did with it, so a build where Mermaid had
          // started coercing could not satisfy them by accident.
          window.mermaid.mermaidAPI
            .getDiagramFromText(KANBAN_SELF_CHECK_PRIORITY_FIXTURE)
            .then((priDiagram) => {
              const rawPriorities = {};
              for (const node of priDiagram.db.getData().nodes || []) {
                if (node.shape === KANBAN_SHAPE_CARD) {
                  rawPriorities[node.id] = {
                    type: typeof node.priority,
                    value: node.priority,
                  };
                }
              }
              return {
                urlResult: urlResult,
                priResult: {
                  raw: rawPriorities,
                  delivery: normaliseKanban(priDiagram),
                },
              };
            })
        )
        .then(({ urlResult, priResult }) =>
          window.mermaid.mermaidAPI
            .getDiagramFromText(KANBAN_SELF_CHECK_FIXTURE)
            .then((diagram) => ({
              diagram: diagram,
              urlResult: urlResult,
              priResult: priResult,
            }))
        )
        .then(({ diagram, urlResult, priResult }) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getData === "function" &&
            typeof db.getSections === "function";

          // THE MEASURED ABSENCE, PINNED. The kanban db has no common trio and
          // no `getTitle` either, and this surface's decision to deliver no
          // title fields rests on that together with the directives being
          // drawn as columns. A Mermaid upgrade that ADDS any of the four
          // should fail here loudly, because it reopens the decision.
          const trioStillAbsent =
            typeof db.getDiagramTitle === "undefined" &&
            typeof db.getAccTitle === "undefined" &&
            typeof db.getAccDescription === "undefined" &&
            typeof db.getTitle === "undefined";

          // Raw reads, taken in this same slot, for the structural facts the
          // delivery cannot itself expose.
          const rawData = db.getData();
          const rawNodes = Array.isArray(rawData.nodes) ? rawData.nodes : [];
          const rawColumns = rawNodes.filter(
            (n) => n.shape === KANBAN_SHAPE_COLUMN
          );
          const rawCards = rawNodes.filter((n) => n.shape === KANBAN_SHAPE_CARD);
          const rawTwo = rawCards.find((n) => n.id === "scTwo");

          // The ABSENCE pattern this surface guards for, read on both kinds so
          // a db that started handing out every key on every node could not
          // satisfy the delivered half by accident.
          const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
          const absenceShapeHolds =
            rawColumns.every(
              (c) =>
                !has(c, "parentId") &&
                !has(c, "assigned") &&
                !has(c, "priority") &&
                has(c, "ticket") &&
                c.ticket === undefined
            ) &&
            !!rawTwo &&
            has(rawTwo, "ticket") &&
            has(rawTwo, "assigned") &&
            has(rawTwo, "priority") &&
            rawTwo.ticket === undefined &&
            rawTwo.assigned === undefined &&
            rawTwo.priority === undefined;

          // `isGroup` DISAGREES BETWEEN THE TWO ACCESSORS, which is why this
          // surface reads `shape`. Pinned so an upgrade that reconciled them
          // — or that changed which one lies — is visible here rather than
          // being discovered by a generator narrating a board with no columns.
          const rawSections = db.getSections();
          const isGroupStillDisagrees =
            Array.isArray(rawSections) &&
            rawSections.length > 0 &&
            rawSections.every((s) => s.isGroup === false) &&
            rawColumns.every((c) => c.isGroup === true);

          // THE POSITIONAL WALK, computed here so the id-filter assertion below
          // is a COMPARISON rather than a restatement of the delivery.
          const positionalCounts = [];
          for (const node of rawNodes) {
            if (node.shape === KANBAN_SHAPE_COLUMN) {
              positionalCounts.push(0);
            } else if (
              node.shape === KANBAN_SHAPE_CARD &&
              positionalCounts.length > 0
            ) {
              positionalCounts[positionalCounts.length - 1] += 1;
            }
          }

          const delivery = normaliseKanban(diagram);
          const [todo, empty, done, dupOne, dupTwo] = delivery.columns;
          const one = todo && todo.cards ? todo.cards[0] : null;
          const two = todo && todo.cards ? todo.cards[1] : null;
          const keysOf = (o) => (o ? Object.keys(o).join(",") : "");
          const expectedTop = KANBAN_DELIVERED_KEYS.join(",");
          const expectedColumn = KANBAN_COLUMN_KEYS.join(",");
          const expectedCard = KANBAN_CARD_KEYS.join(",");

          const baseAssertions = [
            [
              "the two db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "the kanban db still carries NO getDiagramTitle, getAccTitle, " +
                "getAccDescription or getTitle — the measured absence this " +
                "surface's missing title fields rest on",
              trioStillAbsent,
            ],
            [
              "`isGroup` still disagrees between getSections() (false) and " +
                "getData() (true) on the SAME columns, which is why this " +
                "surface discriminates on `shape` — pinned so a reconciliation " +
                "upstream is seen here rather than by a reader",
              isGroupStillDisagrees,
            ],
            [
              "the delivery carries EXACTLY the two documented top-level keys " +
                "and names its type",
              keysOf(delivery) === expectedTop && delivery.diagramType === "kanban",
            ],
            [
              "five columns in DECLARATION ORDER with the author's own ids, " +
                "the two duplicates included rather than collapsed",
              delivery.columns.length === 5 &&
                todo.id === "scTodo" &&
                empty.id === "scEmpty" &&
                done.id === "scDone" &&
                dupOne.id === "scDup" &&
                dupTwo.id === "scDup",
            ],
            [
              "every delivered column carries EXACTLY the three documented " +
                "keys, and every delivered card EXACTLY the seven",
              keysOf(todo) === expectedColumn &&
                keysOf(empty) === expectedColumn &&
                keysOf(dupOne) === expectedColumn &&
                keysOf(one) === expectedCard &&
                keysOf(two) === expectedCard,
            ],
            [
              "labels are decoded with decodeAuthorText on BOTH kinds — the " +
                "column's `&amp;` arrives as the character the canvas draws",
              todo.label === "SelfCheck todo & more" &&
                empty.label === "SelfCheck empty" &&
                one.label === "SelfCheck one" &&
                two.label === "SelfCheck two",
            ],
            [
              "a card declaring all three metadata keys carries the author's " +
                "own strings, and a DRAWN priority carries priorityDrawn true",
              one.ticket === "SC-1" &&
                one.assigned === "scsam" &&
                one.priority === "High" &&
                one.priorityDrawn === true,
            ],
            [
              "a card declaring NONE of the three carries null on all three " +
                "rather than undefined, and the db really does hand out those " +
                "keys holding undefined — asserted on both halves, so a db " +
                "that stopped delivering them could not satisfy it by accident",
              two.ticket === null &&
                two.assigned === null &&
                two.priority === null &&
                two.priorityDrawn === false &&
                absenceShapeHolds,
            ],
            [
              "RULING KS9, THE PAIR THAT IS THE WHOLE OF IT: a priority " +
                "written `H#105;gh` and one written `High` deliver the " +
                "IDENTICAL `priority` string and DIFFER on `priorityDrawn` — " +
                "so the decode is applied and the drawn test is NOT taken on " +
                "the decoded string. Two-sided on the db as well as on the " +
                "delivery: the entity card's RAW db value must still carry " +
                "Mermaid's sentinels, or a build that had stopped encoding " +
                "them would satisfy this row while proving nothing",
              (() => {
                const cards = priResult.delivery.columns[0].cards;
                const drawn = cards.find((c) => c.id === "scpDrawn");
                const entity = cards.find((c) => c.id === "scpEntity");
                const rawEntity = priResult.raw.scpEntity;
                return (
                  !!drawn &&
                  !!entity &&
                  drawn.priority === "High" &&
                  entity.priority === "High" &&
                  drawn.priorityDrawn === true &&
                  entity.priorityDrawn === false &&
                  rawEntity.type === "string" &&
                  rawEntity.value !== "High" &&
                  rawEntity.value.indexOf("#105;") === -1
                );
              })(),
            ],
            [
              "RULING KS9, THE ESCAPABLE VALUE: finding F1's own construct " +
                "delivers the characters the author typed rather than " +
                "Mermaid's placeholder sentinels and undecoded entities, and " +
                "is not drawn",
              (() => {
                const card = priResult.delivery.columns[0].cards.find(
                  (c) => c.id === "scpEscapable"
                );
                return (
                  !!card &&
                  card.priority === 'A&B "c" <d>' &&
                  card.priorityDrawn === false
                );
              })(),
            ],
            [
              "RULING KS10: a NUMBER and a BOOLEAN priority are delivered as " +
                "their String() forms rather than silently dropped, and both " +
                "are undrawn. Two-sided on the db: Mermaid must still be " +
                "handing over a real `number` and a real `boolean` here, " +
                "because if it started coercing them itself this row would " +
                "pass while KS10's arm had gone dead",
              (() => {
                const cards = priResult.delivery.columns[0].cards;
                const num = cards.find((c) => c.id === "scpNumber");
                const bool = cards.find((c) => c.id === "scpBoolean");
                return (
                  !!num &&
                  !!bool &&
                  priResult.raw.scpNumber.type === "number" &&
                  priResult.raw.scpBoolean.type === "boolean" &&
                  num.priority === "1" &&
                  bool.priority === "true" &&
                  num.priorityDrawn === false &&
                  bool.priorityDrawn === false
                );
              })(),
            ],
            [
              "RULING KS10's DEFENCE ARMS, which no authorable source can " +
                "reach and which are therefore asserted through a stub: an " +
                "ARRAY and an OBJECT deliver null rather than a stringified " +
                "`sam,kim` or `[object Object]`, while a string and a number " +
                "in the same run do not — the two-sided form, so a build that " +
                "returned null for everything could not satisfy it. Measured " +
                "21 September 2026: a source CANNOT produce either shape, " +
                "because Mermaid flattens `[sam, kim]` to a string before this " +
                "surface sees it and a nested map is a hard parse error",
              (() => {
                const at = (value) =>
                  kanbanMetadata({ assigned: value }, "assigned");
                return (
                  at(["sam", "kim"]) === null &&
                  at({ a: 1 }) === null &&
                  at(undefined) === null &&
                  at("scsam") === "scsam" &&
                  at(7) === "7" &&
                  at(true) === "true"
                );
              })(),
            ],
            [
              "the DRAWN vocabulary is exactly the four strings the renderer " +
                "marks, matched on the RAW bytes and never re-cased or " +
                "trimmed — asserted in both directions, so a build that " +
                "matched loosely could not satisfy it",
              (() => {
                const drawn = (value) => kanbanPriorityDrawn({ priority: value });
                return (
                  KANBAN_DRAWN_PRIORITIES.length === 4 &&
                  KANBAN_DRAWN_PRIORITIES.every((v) => drawn(v)) &&
                  !drawn("high") &&
                  !drawn("HIGH") &&
                  !drawn("Very High ") &&
                  !drawn("Urgent") &&
                  !drawn(1) &&
                  !drawn(true) &&
                  kanbanPriorityDrawn({}) === false
                );
              })(),
            ],
            [
              "the EMPTY column delivers an empty cards array rather than no " +
                "key, and the two ordinary columns deliver their own cards",
              Array.isArray(empty.cards) &&
                empty.cards.length === 0 &&
                todo.cards.length === 2 &&
                done.cards.length === 1 &&
                done.cards[0].label === "SelfCheck three",
            ],
            [
              "a column's cards come from the ID FILTER and not from a " +
                "positional walk: the two duplicate `scDup` columns each " +
                "deliver all FOUR cards pointing at that id, where the walk " +
                "would answer two — the assertion no ordinary board can make",
              rawCards.filter((c) => c.parentId === "scDup").length === 4 &&
                dupOne.cards.length === 4 &&
                dupTwo.cards.length === 4 &&
                positionalCounts.length === 5 &&
                positionalCounts[3] === 2 &&
                positionalCounts[4] === 2 &&
                dupOne.cards.map((c) => c.label).join(",") ===
                  "SelfCheck four,SelfCheck five,SelfCheck four,SelfCheck five",
            ],
            [
              "getSections() corroborates the column COUNT and ORDER — the one " +
                "thing it can honestly confirm, and the only reason this " +
                "surface calls it at all",
              Array.isArray(rawSections) &&
                rawSections.length === delivery.columns.length &&
                rawSections.every((s, i) => s.id === delivery.columns[i].id),
            ],
            [
              "THE BASE URL IS READABLE AT PARSE TIME, through mermaid.parse's " +
                "own resolved config, and it is THIS source's base — the " +
                "reading six other routes could not deliver, and the whole " +
                "precondition ruling KS8 rests on",
              urlResult.urlBase ===
                "https://selfcheck.example.org/browse/#TICKET#",
            ],
            [
              "a card whose ticket links delivers the EXACT address the canvas " +
                "links it to, built by the canvas's own first-token rule, and " +
                "delivered VERBATIM rather than as a resolved URL",
              (() => {
                const cards = urlResult.urlDelivery.columns[0].cards;
                return (
                  cards.length === 3 &&
                  cards[0].ticket === "SCU-1" &&
                  cards[0].ticketUrl ===
                    "https://selfcheck.example.org/browse/SCU-1"
                );
              })(),
            ],
            [
              "a WHITESPACE-ONLY ticket delivers a null ticketUrl while the " +
                "ticket itself is delivered untrimmed, and a card with NO " +
                "ticket delivers null on both — the two absent cases kept " +
                "apart, on a source with a working base beside them",
              (() => {
                const cards = urlResult.urlDelivery.columns[0].cards;
                return (
                  cards[1].ticket === " " &&
                  cards[1].ticketUrl === null &&
                  cards[2].ticket === null &&
                  cards[2].ticketUrl === null
                );
              })(),
            ],
            [
              "the ticket-URL allow-list refuses `javascript:` and `data:` and " +
                "admits `http:`, `https:` and a RELATIVE base the canvas draws " +
                "— asserted in BOTH directions, so a build that refused " +
                "everything could not satisfy it",
              kanbanStubTicketUrl("javascript:alert(1)//#TICKET#") === null &&
                kanbanStubTicketUrl("data:text/html,#TICKET#") === null &&
                kanbanStubTicketUrl("https://example.org/browse/#TICKET#") ===
                  "https://example.org/browse/ABC-1" &&
                kanbanStubTicketUrl("http://example.org/browse/#TICKET#") ===
                  "http://example.org/browse/ABC-1" &&
                kanbanStubTicketUrl("/browse/#TICKET#") === "/browse/ABC-1",
            ],
            [
              "NO base delivers null, an EMPTY base delivers null, a base with " +
                "no #TICKET# token is used VERBATIM with the ticket NOT " +
                "appended, and a base carrying the token TWICE replaces only " +
                "the first — every one of them the canvas's measured behaviour",
              kanbanStubTicketUrl(null) === null &&
                kanbanStubTicketUrl("") === null &&
                kanbanStubTicketUrl("https://example.org/browse/") ===
                  "https://example.org/browse/" &&
                kanbanStubTicketUrl(
                  "https://example.org/#TICKET#/also/#TICKET#"
                ) === "https://example.org/ABC-1/also/#TICKET#",
            ],
            [
              "the URL is built from the RAW db ticket through " +
                "decodePlaceholders and NOT from the DELIVERED `ticket`, on " +
                "the construct that separates the two decoders: a ticket " +
                "written `A&amp;B-1` is DRAWN `A&B-1` and LINKED `A&amp;B-1`, " +
                "so a build that reused the delivered string would link to the " +
                "wrong address — asserted with the disagreement itself as a " +
                "canary, so a build where the two decoders agreed could not " +
                "satisfy this row by accident",
              (() => {
                const rawTicket = "A&amp;B-1";
                return (
                  decodeAuthorText(rawTicket) !== decodePlaceholders(rawTicket) &&
                  decodeAuthorText(rawTicket) === "A&B-1" &&
                  kanbanStubTicketUrl(
                    "https://example.org/#TICKET#",
                    rawTicket
                  ) === "https://example.org/A&amp;B-1"
                );
              })(),
            ],
            [
              "an unknown `shape` is a STOP rather than a silent drop, so a " +
                "board is never delivered short of a card",
              (() => {
                try {
                  normaliseKanban({
                    db: {
                      getData: () => ({
                        nodes: [{ id: "x", label: "x", shape: "kanbanUnknown" }],
                      }),
                    },
                  });
                  return false;
                } catch (e) {
                  return /unknown shape/.test((e && e.message) || "");
                }
              })(),
            ],
          ];

          // Item 82: the break source is parsed AFTER every predicate above
          // has been evaluated, because on this type a second parse replaces
          // the WHOLE db payload. Delivered through normaliseKanban itself,
          // so the rows test the transform on the path a consumer reads. The
          // priority route is deliberately absent from these rows: it takes
          // neither the break nor the markup transform. The markup source is
          // parsed after this one, and this delivery is copied out first.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(KANBAN_BREAK_SELF_CHECK_FIXTURE)
            .then((breakDiagram) => {
              const breakDelivery = normaliseKanban(breakDiagram);
              return window.mermaid.mermaidAPI
                .getDiagramFromText(KANBAN_MARKUP_SELF_CHECK_FIXTURE)
                .then((markupDiagram) => ({
                  breakDelivery: breakDelivery,
                  markupDelivery: normaliseKanban(
                    markupDiagram,
                    KANBAN_MARKUP_SELF_CHECK_BASE
                  ),
                }));
            })
            .then(({ breakDelivery, markupDelivery }) => {
              const typedColumn = breakDelivery.columns[0];
              const escapedColumn = breakDelivery.columns[1];
              const typedCard = typedColumn && typedColumn.cards[0];
              const escapedCard = escapedColumn && escapedColumn.cards[0];
              const markupCard = (index) =>
                markupDelivery.columns[index] &&
                markupDelivery.columns[index].cards[0];
              return baseAssertions.concat([
                [
                  "a typed break reads as one space on a column label, a " +
                    "card label and an assigned (item 82)",
                  !!typedColumn &&
                    typedColumn.label === "one two" &&
                    !!typedCard &&
                    typedCard.label === "three four" &&
                    typedCard.assigned === "five six",
                ],
                [
                  "an author-escaped break is kept as the characters <br> on " +
                    "a column label, a card label and an assigned (item 82)",
                  !!escapedColumn &&
                    escapedColumn.label === "seven<br>eight" &&
                    !!escapedCard &&
                    escapedCard.label === "nine<br>ten" &&
                    escapedCard.assigned === "eleven<br>twelve",
                ],
                [
                  "a typed formatting tag reads as its text on a column " +
                    "label, a card label, a ticket and an assigned (item 82)",
                  !!markupCard(0) &&
                    markupDelivery.columns[0].label === "one" &&
                    markupCard(0).label === "two" &&
                    markupCard(0).ticket === "T3" &&
                    markupCard(0).assigned === "four",
                ],
                [
                  "an author-escaped formatting tag is kept as the " +
                    "characters <b> on a column label, a card label, a " +
                    "ticket and an assigned (item 82)",
                  !!markupCard(1) &&
                    markupDelivery.columns[1].label === "<b>five</b>" &&
                    markupCard(1).label === "<i>six</i>" &&
                    markupCard(1).ticket === "<b>seven</b>" &&
                    markupCard(1).assigned === "<u>eight</u>",
                ],
                [
                  "a tag-only label is delivered empty on a column label, a " +
                    "card label, a ticket and an assigned (item 82)",
                  !!markupCard(2) &&
                    markupDelivery.columns[2].label === "" &&
                    markupCard(2).label === "" &&
                    markupCard(2).ticket === "" &&
                    markupCard(2).assigned === "",
                ],
                [
                  "markdown emphasis reads as its text on a column label, a " +
                    "card label, a ticket and an assigned, because kanban " +
                    "draws it (item 82)",
                  !!markupCard(3) &&
                    markupDelivery.columns[3].label === "nine" &&
                    markupCard(3).label === "ten" &&
                    markupCard(3).ticket === "eleven" &&
                    markupCard(3).assigned === "twelve",
                ],
                [
                  "a tagged ticket's ticketUrl is still the address the " +
                    "canvas links to, built from the RAW ticket with its " +
                    "tags in it, while only the ticket TEXT is read as " +
                    "plain (item 82)",
                  !!markupCard(0) &&
                    markupCard(0).ticket === "T3" &&
                    markupCard(0).ticketUrl ===
                      "https://selfcheck.example.org/browse/T<b>3</b>",
                ],
              ]);
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    kanbanSelfCheckPromise = queued
      // Item 82, L2: the link rows read a fixture of their own, parsed after
      // the others, so every predicate above has already been evaluated.
      .then((assertions) =>
        runKanbanLinkRows().then((linkRows) => assertions.concat(linkRows))
      )
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Kanban self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's kanban internals no longer " +
              "match the 18 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust kanban adapter output."
          );
          kanbanHealthy = false;
          return false;
        }

        logInfo(
          "Kanban self-check passed: accessor, absent-trio, isGroup-disagreement, " +
            "key-set, decode, metadata-null, priority-decode-pair, " +
            "priority-escapable, priority-number-and-boolean, " +
            "metadata-defence-arms, drawn-vocabulary, empty-column, " +
            "id-filter, section-cross-check, ticket-base-readable, " +
            "ticket-URL-exact, ticket-URL-absent-cases, allow-list, " +
            "base-shapes, raw-decoder and unknown-shape assertions all hold"
        );
        kanbanHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Kanban self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        kanbanHealthy = false;
        return false;
      });

    return kanbanSelfCheckPromise;
  }

  /**
   * Report the kanban surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the kanban self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isKanbanHealthy() {
    return kanbanHealthy;
  }

  // RADAR — the thirteenth surface, and the sixth read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE. The db delivers the AUTHOR'S OWN
  // NUMBERS, in AXIS ORDER, whichever of the two curve forms the author used:
  // `curve x{ c: 30, a: 10, b: 20 }` against `axis a, b, c` delivers
  // `entries: [10, 20, 30]`, re-ordered to the axis declaration order rather
  // than to the writing order (census
  // docs/mermaid-item-93-census-1-2026-09-22.md § Q2, source G39). So this is
  // the SEQUENCE, BLOCK, C4 and KANBAN answer and NOT the quadrant one: there
  // are no pixels to undo and no ordering to recover. Ruling RS1.
  //
  // NO getConfig() READ, AND THAT IS A RULING RATHER THAN AN OMISSION. Radar's
  // db carries a `getConfig()` beside `getOptions()`, and it is WRONG TWICE
  // OVER (census § Q7, four arms, each in its own fresh context). It NEVER
  // sees its own source's frontmatter — a source declaring
  // `config.radar.axisScaleFactor: 0.5` reads back the build default `1`, byte
  // identical to a virgin control. And it LEAKS the previously RENDERED
  // source's frontmatter, which is the kanban `ticketBaseUrl` leak exactly. A
  // surface reading it would therefore deliver a confident wrong answer about
  // the chart in front of it, and would sometimes deliver another chart's. The
  // clean per-source route measured on this type is `mermaid.parse(source)`'s
  // own resolved `config` — the KS8 route kanban uses — and NOTHING THIS
  // SURFACE DELIVERS NEEDS IT, so it is not called. Ruling RS8.
  //
  // THE TRIO IS DELIVERED, AND THE CONDITION ON IT WAS DISCHARGED BY
  // MEASUREMENT RATHER THAN ASSUMED. The dispatch made `title`, `accTitle` and
  // `accDescr` conditional on the shared store being CLEARED per parse, on the
  // c4 precedent where it is not and a late read FABRICATES another diagram's
  // words. The census asked it directly, with a positive control in the same
  // page: a flowchart carrying `accTitle: FOREIGN TITLE` really did set the
  // store, and a radar parse afterwards read `""`, `""`, `""`. Every parse and
  // every render clears it. So on radar the failure mode is LOSS and never
  // fabrication, and the trio may be delivered. Ruling RS4.
  //
  // BUT THE TRIO AND THE PAYLOAD COME FROM TWO DIFFERENT STORES WITH DIFFERENT
  // LIFETIMES, which is the sequence shape rather than the block one. After a
  // FOREIGN parse, a live radar handle's `getDiagramTitle`, `getAccTitle` and
  // `getAccDescription` all read `""` while its `getAxes()` and `getCurves()`
  // are UNCHANGED (census § Q5). So both halves are read here, in ONE queue
  // slot, in the same tick — and concurrency rows CR1 and CR2 assert BOTH,
  // because a lane asserting only the scalars would miss a payload
  // cross-delivery and one asserting only the payload would pass while the
  // titles crossed.
  //
  // THE DECODE IS decodePlaceholders, AND THIS IS THE OPPOSITE OF KANBAN.
  // Census § Q4 ran seven author-text constructs in FIVE positions — the
  // title, an axis label, a curve label, `accTitle:` and `accDescr:` — with
  // the `Tom &amp; Jerry` calibration firing in every one of the 35 readings
  // to prove the two decoders had not collapsed into each other.
  // `decodePlaceholders` reproduced the canvas on 35 of 35 and
  // `decodeAuthorText` on 25 of 35, disagreeing on exactly the two
  // pre-escaped-entity constructs in all five positions. That is the SVG-TEXT
  // answer, and § Q3 supplies its mechanism: ZERO `foreignObject` on every
  // radar render taken, six `<text>` elements on the canonical source. An
  // author's `&amp;` is DRAWN as the five characters `&amp;`, so a surface
  // that decoded it to `&` would narrate something no sighted reader is shown.
  // Ruling RS3. It is easy to inherit kanban's answer here and it is wrong.
  //
  // accTitle AND accDescr TAKE NO TRANSFORM, which is the standing carve-out
  // and NOT an inconsistency with the paragraph above. Ruling RS9, 23
  // September 2026, overruling the census's recommendation that
  // decodePlaceholders apply to all three. The reason is the same one the
  // sequence surface records at ruling R11 and gantt repeats: clause X3 owns
  // the author override, it reads the RAW DIAGRAM SOURCE rather than this db,
  // and THAT is the text a reader actually hears (census § Q8, measured on
  // four sources through capture.mjs). A transform applied here would describe
  // a string nobody is given. `title` is different and IS decoded, because it
  // is drawn on the canvas as `<text class="radarTitle">` and a narration of
  // it is a narration of drawn text.
  //
  // THE IDS ARE DELIVERED FOR DERIVATION CHECKS AND MUST NEVER BE NARRATED,
  // on both kinds. `axes[i].id` and `curves[i].id` are the db's `name`, and
  // they are delivered VERBATIM — no decode of any kind — because they are
  // identifiers rather than author prose. Mermaid permits DUPLICATES on both
  // (census § Q1, G33 and G34, both accepted and both drawn), and a curve or
  // axis written with no quoted label takes its own id AS its label (G37), so
  // an id is neither unique nor distinguishable from a label. Ruling RS8.
  //
  // `drawn` IS COMPUTED ONCE, HERE, AND IT ANSWERS THE LARGEST DIVERGENCE THIS
  // TYPE HAS. A curve whose value count differs from the axis count is
  // DELIVERED IN FULL by the db, NAMED AND COLOUR-SWATCHED IN THE LEGEND, and
  // ABSENT FROM THE PLOT. Census § Q3 reproduced it three independent ways —
  // a class-prefix scan, a `.radarCurve-<i>` selector and a shape-tag count —
  // with an exact-length control in the same cell that DREW, and row C4 shows
  // the failure is PER CURVE rather than per chart: a short curve is omitted
  // while a sound one beside it is drawn, and the legend advertises both. This
  // is the MR1 class one size larger — a whole series rather than a field —
  // and WHAT THE GOLD DOES WITH IT IS NOT DECIDED HERE. What is decided is
  // that the fact is computed in ONE place, from the two lengths the db
  // already carries, so a generator cannot re-derive it and disagree. Ruling
  // RS7a: `drawn === (values.length === axes.length)`, so a curve on a chart
  // with NO axes is `drawn: false`.
  //
  // AMENDED TO RS7b, 29 September 2026 (gold ruling RR21 on the item 93
  // sweep's RO-3): `drawn === (values.length === axes.length && axes.length
  // >= 2)`. A series on ONE axis has one vertex, and the renderer's closed
  // curve through one point is a zero-length path: the sweep's pixel test
  // found the chart PIXEL-IDENTICAL to the same chart with no curve, in both
  // grid modes, against a two-axis control that differed. So a one-axis series
  // is not in the picture, and `drawn` now says so. The spoke and its label
  // ARE drawn, which is why this changes the curve's fact and not the axes.
  //
  // THE SCALE IS THE ONE PLACE THIS SURFACE COMPUTES A NUMBER THE DB DOES NOT
  // HOLD, and the rule was MEASURED before it was written. `getOptions().max`
  // is `null` whenever the author declares none — four of the five options are
  // defaulted by the db and that one is not — while the RENDERER derives a
  // maximum from the data and draws to it, so a narration reading the db alone
  // would report "no maximum" for a picture drawn against a real one. Six
  // sources were rendered on 23 September 2026, each with a control, geometry
  // read off the drawn vertex radius against the outermost graticule ring in
  // SCREEN space (so the reading does not depend on which group a coordinate
  // belongs to), and the derivation is
  //     scaleMax = min + (value - min) * outerRadius / vertexRadius .
  // The readings:
  //   (a) two drawn curves, the largest value 90 on the SECOND — derived 90.0,
  //       control peaking at 60 derived 60.0. So the scale is the maximum over
  //       ALL curves, not over the first one.
  //   (b) an UNDRAWN curve (two values on three axes) holding 200 beside a
  //       drawn curve peaking at 90 — derived 200.0, control without it
  //       derived 90.0. SO A CURVE THE PICTURE DOES NOT DRAW STILL SETS THE
  //       SCALE THE PICTURE IS DRAWN AGAINST.
  //   (c) a curve with FOUR values on three axes whose fourth is 500 — derived
  //       500.0, control whose fourth is 4 derived 90.0. SO AN ENTRY BEYOND
  //       THE AXIS COUNT COUNTS TOO.
  //   (d) author `max 50` with values 10, 50 and 90 — the three vertices land
  //       at radii 60, 300 and 300 against an outer ring of 300, so the author's
  //       number IS the scale and the 90 is CLIPPED AT THE OUTER RING rather
  //       than drawn past it or growing the scale. Control with no max drew
  //       33.33 / 166.67 / 300.
  //   (e) all values 0 and no max — the derived maximum is 0, and the renderer
  //       emits a curve path reading `MNaN,NaN C…`, so NOTHING IS DRAWN while
  //       the legend still names the curve. With `max 10` the same curve draws
  //       a degenerate point at the centre (`M0,0 C0,0 …`). Recorded; the
  //       surface delivers the derived 0 rather than inventing a fallback.
  //   (f) a FRONTMATTER `title:` — see the contradiction below.
  // EVERY ROW FITS ONE SENTENCE: the scale is the author's `max` when they
  // declared one, and otherwise the maximum over the values of EVERY curve the
  // db delivers — drawn or not, and including entries beyond the axis count.
  // Ruling RS6a. `min` is db-delivered throughout and defaults to 0, so only
  // the maximum was ever in question.
  //
  // SO THREE KEYS SIT WHERE ONE DID. `max` is the author's number or null,
  // exactly as the db hands it over; `scaleMax` is the number the renderer
  // draws to; `scaleMaxSource` is `"author"` or `"data"` and says which. A
  // consumer that wants to narrate a declared maximum reads `max`, one that
  // wants to narrate the picture's own scale reads `scaleMax`, and neither has
  // to know the derivation. There is deliberately no fourth key for "the
  // author declared one", because `scaleMaxSource === "author"` already is it.
  //
  // TWO EDGES WHERE THE DELIVERED scaleMax IS NOT WHAT THE PICTURE DREW, both
  // named rather than smoothed over:
  //   AN INVERTED PAIR. `min 100` with `max 0` parses and the db delivers both
  //     verbatim (census § Q1, G35). Measured 23 September 2026 with values
  //     10, 20 and 30: every vertex lands at the OUTER RING, radius 300 of
  //     300, which fits no simple reading of a 100..0 domain — 0.9, 0.8 and
  //     0.7 of the radius would be 270, 240 and 210. THE MECHANISM WAS NOT
  //     ISOLATED and nothing here should be read as one. The surface delivers
  //     the author's 0 with source `"author"`, which is ruling RS6a applied
  //     unchanged; that it disagrees with the geometry on this pathological
  //     source is recorded, not repaired.
  //   NO VALUES AT ALL. A chart with axes and no curve, or `radar-beta` and
  //     nothing else, has nothing to derive from, so `scaleMax` is null with
  //     source `"data"`. Null here says "the picture has no scale because it
  //     plots nothing", which is true of exactly that chart.
  //
  // A FRONTMATTER `title:` REACHES THE CANVAS AND NOT THIS SURFACE, and the
  // census marked the question OWED. Measured here, 23 September 2026, with
  // the body `title` keyword as the control: a source whose only title is a
  // frontmatter one draws `<text class="radarTitle">Frontmatter radar
  // title</text>` while `getDiagramTitle()` reads `""`, so this surface
  // delivers `title: null` for a chart that visibly carries one. The control
  // delivered `Body radar title` through both routes. THIS IS NOT REPAIRED
  // HERE: the only per-source route to it is a non-db read, which ruling RS8
  // and this session's dispatch both exclude, and the disposition belongs with
  // register item 77, which already carries the frontmatter-title question for
  // other types. It is recorded so a later reader does not discover it as a
  // surface defect.
  //
  // THE DB IS A SHARED SINGLETON, so this is the register item 21 hazard in
  // the kanban shape. Census § Q5 measured `dbA === dbB` true across two
  // parses, with the first handle's accessors afterwards returning the SECOND
  // source's axes, curves, options and title — there is no per-parse payload
  // on radar. And § Q5 measured one thing kanban's did not: A RENDER OF AN
  // UNRELATED SOURCE CLOBBERS A LIVE HANDLE, a handle holding axes `a, b, c`
  // reading back `b1, b2, b3` afterwards. So every read below happens inside
  // this parse's own queue slot and is copied into this adapter's own objects
  // in the same tick, and NOTHING MAY RENDER BETWEEN THE HANDLE AND THE READ.
  //
  // A RENDER ADDS NO KEYS, which is the kanban answer and the opposite of
  // block's. Census § Q6 took `Object.keys` in page, before any stringify, on
  // the db, the diagram wrapper, the first axis, the first curve and the
  // options object, before and after a render of the same source: every key
  // set identical, every option value identical. So no structured clone is
  // needed. The copy below is still key by key, for the reason the block
  // surface gives — a closed key list cannot be made to carry a field a later
  // Mermaid build starts adding. Note the second identity reading in the same
  // census: `getAxes()` returns the SAME array object on repeated calls within
  // one parse, and that reference does NOT survive a render. Hold no reference
  // across one.
  //
  // A NON-NUMBER VALUE IS A STOP, AND SO IS A MISSING KEY ON ANY DB OBJECT
  // THIS SURFACE READS. The census measured `entries` holding `number`s per
  // element rather than assuming it, the grammar REJECTS a negative outright
  // (G23/G27) and an empty value list with it (G29), and every axis carries
  // exactly `name` and `label` while every curve carries exactly `name`,
  // `label` and `entries`. A silent coercion would put a string into a scale
  // derivation and produce a confident wrong maximum; a silently dropped axis
  // or curve would be invisible, because a chart short of an axis looks
  // exactly like a chart with fewer axes. So both throw, the parse rejects,
  // and the consumer reaches the honest-unsupported fallback — which on THIS
  // type gives advice that is actually true, radar accepting `accTitle:`,
  // `accDescr:` and the `accDescr { }` block as first-class grammar (census
  // § Q1 and § Q8, and register item 81's fourth case does not arise here).
  //
  // WHAT IS DELIBERATELY NOT DELIVERED, each for a measured reason:
  //   `getConfig()`'s whole object — wrong about its own source and leaky
  //     (§ Q7). See above.
  //   a `curveCount` or `axisCount` field — the counts are `curves.length` and
  //     `axes.length`, computed once by the consumer. Two computations of one
  //     fact are how defects hide; kanban's ruling KS7 applied unchanged.
  //   any geometry — no radius, no vertex, no colour. The census measured the
  //     three curves of an exemplar distinguished by HUE AND NOTHING ELSE in
  //     18 of 18 theme cells, and in six of those cells two or three curves
  //     share one colour outright. That is a theming finding and a rule 24
  //     question, and a surface delivering paint would invite a narration to
  //     name colours a reader cannot see.
  //
  // NO TRIM ON ANY LABEL, and no trim on the title. What the db holds is what
  // is delivered, decoded; how a narration speaks a label that is one space is
  // the gold document's question and not this file's.
  const RADAR_SCALE_MAX_AUTHOR = "author";
  const RADAR_SCALE_MAX_DATA = "data";

  // The fewest axes on which a curve is drawn at all — ruling RS7b. One axis
  // gives one vertex and a zero-length path, measured pixel-identical to no
  // curve (item 93 sweep, F4).
  const RADAR_MIN_DRAWN_AXES = 2;

  // The seven keys a delivered radar carries, in order. Named as a constant
  // because the self-check asserts the delivered key set EXACTLY against it.
  const RADAR_DELIVERED_KEYS = Object.freeze([
    "diagramType",
    "title",
    "accTitle",
    "accDescr",
    "axes",
    "curves",
    "options",
  ]);

  // The two keys a delivered AXIS carries, in order.
  const RADAR_AXIS_KEYS = Object.freeze(["id", "label"]);

  // The four keys a delivered CURVE carries, in order. `drawn` is COMPUTED
  // rather than copied — see ruling RS7a above.
  const RADAR_CURVE_KEYS = Object.freeze(["id", "label", "values", "drawn"]);

  // The seven keys a delivered OPTIONS object carries, in order. Five are the
  // db's own; `scaleMax` and `scaleMaxSource` are computed, ruling RS6a.
  const RADAR_OPTION_KEYS = Object.freeze([
    "showLegend",
    "ticks",
    "graticule",
    "min",
    "max",
    "scaleMax",
    "scaleMaxSource",
  ]);

  // The db-side key sets the census recorded, pinned so a build that changed
  // any of them STOPS here rather than delivering a chart with something
  // missing from it.
  const RADAR_DB_AXIS_KEYS = Object.freeze(["name", "label"]);
  const RADAR_DB_CURVE_KEYS = Object.freeze(["name", "label", "entries"]);
  const RADAR_DB_OPTION_KEYS = Object.freeze([
    "showLegend",
    "ticks",
    "max",
    "min",
    "graticule",
  ]);

  let radarMemoCode = null;
  let radarMemoPromise = null;
  let radarHealthy = null;
  let radarSelfCheckStarted = false;
  let radarSelfCheckPromise = null;

  /**
   * Assert that a db object carries every key the census recorded on its kind.
   *
   * A MISSING KEY IS A STOP rather than a null, and the distinction matters
   * here in a way it does not on kanban. There, three metadata keys are OWN
   * KEYS HOLDING undefined when the author declares none, so absence is an
   * ordinary state with a delivered meaning. On radar the census found NO
   * member delivered as undefined at all — the in-page sweep over every axis
   * key, every curve key and every option key returned zero — so an absent key
   * is not a state this type has, and meeting one means the db is no longer
   * the db this surface was measured against.
   *
   * @param {Object} raw - The db object
   * @param {ReadonlyArray<string>} keys - The keys the census recorded
   * @param {string} kind - The word used in the message: axis, curve, options
   * @param {number|null} index - Position, for the message; null where the
   *   kind is a singleton and a position would be noise
   * @throws {Error} When the object is not an object or a key is absent
   */
  function radarRequireDbKeys(raw, keys, kind, index) {
    const where = "Radar " + kind + (index === null ? "" : " at index " + index);
    if (!raw || typeof raw !== "object") {
      throw new Error(
        where + " is not an object. Refusing to deliver a partial chart."
      );
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) {
        throw new Error(
          where +
            " carries no `" +
            key +
            "` key; this surface was measured against a db that carries " +
            JSON.stringify(keys) +
            ". Refusing to deliver a partial chart."
        );
      }
    }
  }

  /**
   * Copy ONE db axis into this surface's own object.
   *
   * @param {Object} raw - A db axis
   * @param {number} index - Declaration position
   * @returns {Object} The delivered axis
   * @throws {Error} When the axis is missing a key the census recorded
   */
  function copyRadarAxis(raw, index) {
    radarRequireDbKeys(raw, RADAR_DB_AXIS_KEYS, "axis", index);
    const id = typeof raw.name === "string" ? raw.name : "";
    return {
      id: id,
      // decodePlaceholders, per ruling RS3. An axis whose db label is not a
      // string delivers the id, which is what the db itself would have put
      // there — a label-less axis's label IS its id (census G37) — so the
      // fallback is a defence rather than a live path.
      label: typeof raw.label === "string" ? decodePlaceholders(raw.label) : id,
    };
  }

  /**
   * Copy ONE db curve into this surface's own object.
   *
   * THE VALUES ARE ALREADY IN AXIS ORDER and are not re-ordered here (ruling
   * RS2). `drawn` is computed from the two lengths and nowhere else.
   *
   * @param {Object} raw - A db curve
   * @param {number} index - Declaration position
   * @param {number} axisCount - How many axes this chart declares
   * @returns {Object} The delivered curve
   * @throws {Error} When a key is missing or a value is not a finite number
   */
  function copyRadarCurve(raw, index, axisCount) {
    radarRequireDbKeys(raw, RADAR_DB_CURVE_KEYS, "curve", index);
    if (!Array.isArray(raw.entries)) {
      throw new Error(
        "Radar curve at index " +
          index +
          " carries an `entries` that is not an array. Refusing to deliver a " +
          "partial chart."
      );
    }

    const values = [];
    for (let i = 0; i < raw.entries.length; i++) {
      const value = raw.entries[i];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          "Radar curve at index " +
            index +
            " carries a non-numeric value at position " +
            i +
            " (" +
            JSON.stringify(value) +
            "). A silent coercion would feed the scale derivation a string " +
            "and produce a confident wrong maximum. Refusing to deliver."
        );
      }
      values.push(value);
    }

    const id = typeof raw.name === "string" ? raw.name : "";
    return {
      id: id,
      label: typeof raw.label === "string" ? decodePlaceholders(raw.label) : id,
      values: values,
      // RULING RS7b (RS7a amended by RR21). A curve with no axes is `drawn:
      // false`, which is what the canvas does with it (census § Q3, row C5),
      // and so is a curve on ONE axis, which the canvas draws as nothing.
      drawn: values.length === axisCount && axisCount >= RADAR_MIN_DRAWN_AXES,
    };
  }

  /**
   * Derive the scale the renderer draws to.
   *
   * MEASURED, NOT INFERRED — the six rows are in the surface note above. The
   * author's `max` wins whenever they declared one, INCLUDING a zero and
   * including a max below the data, which the renderer honours by CLIPPING
   * the over-range vertices at the outer ring. Otherwise it is the maximum
   * over the values of every curve the db delivers: an undrawn curve counts,
   * and so does an entry beyond the axis count.
   *
   * IT READS THE DELIVERED CURVES, not the db's, so every value it sees has
   * already been through copyRadarCurve's numeric STOP.
   *
   * @param {Object} rawOptions - The db's own options object
   * @param {Array<Object>} curves - The delivered curves
   * @returns {{scaleMax: number|null, scaleMaxSource: string}} The scale
   */
  function radarScale(rawOptions, curves) {
    if (typeof rawOptions.max === "number" && Number.isFinite(rawOptions.max)) {
      return {
        scaleMax: rawOptions.max,
        scaleMaxSource: RADAR_SCALE_MAX_AUTHOR,
      };
    }

    let derived = null;
    for (const curve of curves) {
      for (const value of curve.values) {
        if (derived === null || value > derived) {
          derived = value;
        }
      }
    }
    return { scaleMax: derived, scaleMaxSource: RADAR_SCALE_MAX_DATA };
  }

  /**
   * Copy the db's options and seat the two computed scale keys beside them.
   *
   * EVERY TYPE IS CHECKED AND A WRONG ONE IS A STOP, on the reasoning the
   * missing-key guard gives: the census measured all five with their types,
   * none of them ever undefined, so a departure means this is no longer the
   * db that was measured. `max` is the one key whose null is a real state.
   *
   * @param {Object} raw - The db's options object
   * @param {Array<Object>} curves - The delivered curves
   * @returns {Object} The delivered options
   * @throws {Error} When a key is missing or carries an unexpected type
   */
  function copyRadarOptions(raw, curves) {
    radarRequireDbKeys(raw, RADAR_DB_OPTION_KEYS, "options", null);

    const wrong = [];
    if (typeof raw.showLegend !== "boolean") wrong.push("showLegend");
    if (typeof raw.ticks !== "number" || !Number.isFinite(raw.ticks)) {
      wrong.push("ticks");
    }
    if (typeof raw.graticule !== "string") wrong.push("graticule");
    if (typeof raw.min !== "number" || !Number.isFinite(raw.min)) {
      wrong.push("min");
    }
    if (
      raw.max !== null &&
      (typeof raw.max !== "number" || !Number.isFinite(raw.max))
    ) {
      wrong.push("max");
    }
    if (wrong.length) {
      throw new Error(
        "Radar options carry an unexpected type on " +
          JSON.stringify(wrong) +
          "; this surface was measured against showLegend boolean, ticks " +
          "number, graticule string, min number and max number-or-null. " +
          "Refusing to deliver."
      );
    }

    const scale = radarScale(raw, curves);
    return {
      showLegend: raw.showLegend,
      ticks: raw.ticks,
      graticule: raw.graticule,
      min: raw.min,
      // The AUTHOR'S number or null, exactly as the db delivers it. Ruling
      // RS6a — this key is never quietly replaced by the derived one.
      max: raw.max,
      scaleMax: scale.scaleMax,
      scaleMaxSource: scale.scaleMaxSource,
    };
  }

  /**
   * Normalise one Mermaid radar chart into the thirteenth surface's delivery.
   *
   * EAGER SNAPSHOT (the singleton defence, census § Q5 and § Q6): all six
   * accessors are called ONCE here, inside the parse's own .then and behind
   * the adapter-wide queue, and every value is mapped into this adapter's own
   * objects in the same tick. Nothing in the returned object references a
   * db-owned object, and no consumer may go back to the db later — a second
   * parse replaces the whole payload and a RENDER of an unrelated source
   * clobbers a live handle.
   *
   * THE TWO STORES ARE READ TOGETHER, FIRST. The trio comes from the one
   * module-scoped store every diagram type shares and the payload from radar's
   * own module scope; they have different lifetimes and only a single slot
   * makes reading both safe.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised radar delivery
   * @throws {Error} When the db hands over a shape this surface does not know
   */
  function normaliseRadar(diagram) {
    const db = diagram.db;

    // THE SIX READS, together, before anything else can yield.
    const rawTitle = db.getDiagramTitle();
    const rawAccTitle = db.getAccTitle();
    const rawAccDescr = db.getAccDescription();
    const rawAxes = db.getAxes();
    const rawCurves = db.getCurves();
    const rawOptions = db.getOptions();

    if (!Array.isArray(rawAxes) || !Array.isArray(rawCurves)) {
      throw new Error(
        "Radar getAxes() and getCurves() must both return arrays; this build " +
          "returned " +
          Object.prototype.toString.call(rawAxes) +
          " and " +
          Object.prototype.toString.call(rawCurves) +
          ". Refusing to deliver."
      );
    }

    const axes = rawAxes.map(copyRadarAxis);
    const curves = rawCurves.map((raw, index) =>
      copyRadarCurve(raw, index, axes.length)
    );

    return {
      // `diagramType` rather than `type`, matching block, c4 and kanban.
      diagramType: "radar",
      // decodePlaceholders, ruling RS3: the title is drawn as
      // `<text class="radarTitle">` and a narration of it narrates drawn text.
      // The db delivers "" and never null when the author wrote none (census
      // § Q2), and "" is collapsed to null here so a consumer has ONE absent
      // case. NOTE the measured divergence recorded above: a FRONTMATTER
      // title draws on the canvas and never reaches this accessor.
      title: rawTitle === "" || typeof rawTitle !== "string"
        ? null
        : decodePlaceholders(rawTitle),
      // NO TRANSFORM on either, ruling RS9 and the standing carve-out: clause
      // X3 owns author override and reads the raw source, which is the text a
      // reader actually receives.
      accTitle:
        rawAccTitle === "" || typeof rawAccTitle !== "string"
          ? null
          : rawAccTitle,
      accDescr:
        rawAccDescr === "" || typeof rawAccDescr !== "string"
          ? null
          : rawAccDescr,
      axes: axes,
      curves: curves,
      options: copyRadarOptions(rawOptions, curves),
    };
  }

  /**
   * Parse a radar chart and deliver the normalised shape.
   *
   * Same contract as the other twelve surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every
   * db read happens inside this call's own queue slot. On this type the queue
   * is load-bearing for the whole delivery — the payload half has no
   * per-instance store, and the trio half is the one every diagram type
   * shares.
   *
   * @param {string} code - The Mermaid radar source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseRadar(code) {
    if (!radarSelfCheckStarted) {
      runRadarSelfCheck();
    }

    if (code === radarMemoCode && radarMemoPromise) {
      logDebug("Returning memoised radar parse for identical code string");
      return radarMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(`Radar parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Radar parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const radar = normaliseRadar(diagram);
          const drawnCount = radar.curves.filter((c) => c.drawn).length;
          logDebug(
            `Radar parse delivered after ${Math.round(performance.now() - startedAt)}ms: ` +
              `${radar.axes.length} axis/axes, ${radar.curves.length} curve(s), ` +
              `${drawnCount} drawn, scaleMax ${JSON.stringify(radar.options.scaleMax)} ` +
              `from the ${radar.options.scaleMaxSource}`
          );
          return radar;
        })
        .catch((error) => {
          logDebug(
            `Radar parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    radarMemoCode = code;
    radarMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: three axes, two curves, all five options, the common
   * trio, the axis:value curve form written OUT OF ORDER, and a curve whose
   * value count is SHORT of the axis count.
   *
   * THE OUT-OF-ORDER CURVE IS THE POINT, and without it this fixture would
   * pass whether or not the db resolved the axis:value form — the bare list
   * form delivers in writing order, which for that form IS axis order, so it
   * cannot tell the two apart. `{ scC: 30, scA: 10, scB: 20 }` against
   * `axis scA, scB, scC` must deliver `[10, 20, 30]`.
   *
   * THE SHORT CURVE IS THE SECOND POINT. It is the only way `drawn` gets a
   * FALSE beside a TRUE in one delivery, which is the whole of ruling RS7a in
   * one row and cannot be shown by either curve alone. It is written in the
   * BARE LIST form deliberately: the axis:value form with an axis missing is a
   * HARD PARSE REJECTION (census G07), so a short curve can only be authored
   * this way.
   *
   * THE `&amp;` IN AN AXIS LABEL AND THE `#quot;` IN THE TITLE ARE THE THIRD.
   * They are the pair that separates the two decoders: `#quot;` is a
   * placeholder both resolve, while `&amp;` is the construct on which
   * decodePlaceholders agrees with the canvas and decodeAuthorText does not.
   * The row below asserts the disagreement itself as a canary, so a build
   * where the two decoders had collapsed into each other could not satisfy it
   * by accident.
   *
   * ASCII only, every string distinctive and prefixed SelfCheck, so a
   * cross-delivery from another diagram NAMES ITS SOURCE rather than merely
   * looking wrong.
   */
  const RADAR_SELF_CHECK_FIXTURE = [
    "radar-beta",
    "  title SelfCheck radar #quot;title#quot;",
    "  accTitle: SelfCheck radar acc title",
    "  accDescr: SelfCheck radar acc descr",
    "  showLegend true",
    "  min 0",
    "  max 100",
    "  ticks 4",
    "  graticule polygon",
    '  axis scA["SelfCheck axis &amp; one"], scB["SelfCheck axis two"], scC["SelfCheck axis three"]',
    '  curve scX["SelfCheck curve one"]{ scC: 30, scA: 10, scB: 20 }',
    '  curve scY["SelfCheck curve two"]{40, 50}',
  ].join("\n");

  /**
   * The SECOND self-check fixture: no `max`, no trio, no quoted labels.
   *
   * IT IS A SEPARATE SOURCE rather than a second reading of the first, because
   * `scaleMaxSource` has exactly two values and one source can only ever
   * exercise one of them. A one-sided row here would pass on a build that
   * hard-coded either answer.
   *
   * IT ALSO CARRIES THE "" → null ARM. The db returns the EMPTY STRING and
   * never null for an absent title, accTitle or accDescr (census § Q2), and
   * the surface collapses all three to null; this is the only fixture where
   * that is visible, the first one declaring all three.
   */
  const RADAR_SELF_CHECK_NO_MAX_FIXTURE = [
    "radar-beta",
    "  axis scnA, scnB, scnC",
    "  curve scnX{10, 20, 90}",
  ].join("\n");

  /**
   * A minimal synthetic diagram, for the scale-derivation arms and the STOP
   * arms. It is deliberately NOT a parse: the derivation rows differ only in
   * which curves exist, and the STOP rows exercise shapes the GRAMMAR CANNOT
   * PRODUCE at all — a negative is rejected at parse (census G23/G27) and no
   * source can make the db hand over a string in `entries` or drop a key off
   * an axis. A source per arm would be testing Mermaid rather than this
   * surface, and for three of the arms no such source exists.
   *
   * THE OPTIONS ARE OVERRIDDEN BY MERGE AND REPLACED WHOLESALE BY A SECOND
   * PARAMETER, and the two are not interchangeable. A merge can only ever set
   * a key, so `{ graticule: undefined }` leaves the key PRESENT holding
   * undefined and `hasOwnProperty` still answers true — which would make the
   * missing-option-key row pass without the guard ever firing. `rawOptions`
   * replaces the object outright, so a key can genuinely be absent.
   *
   * @param {Array<Object>} axes - Stand-in db axes
   * @param {Array<Object>} curves - Stand-in db curves
   * @param {Object} [options] - Option overrides merged onto the db defaults
   * @param {Object} [rawOptions] - An options object used VERBATIM instead
   * @returns {Object} A stand-in with the six accessors normaliseRadar reads
   */
  function radarStubDiagram(axes, curves, options, rawOptions) {
    const base = {
      showLegend: true,
      ticks: 5,
      max: null,
      min: 0,
      graticule: "circle",
    };
    const resolved = rawOptions || Object.assign({}, base, options || {});
    return {
      db: {
        getDiagramTitle: () => "",
        getAccTitle: () => "",
        getAccDescription: () => "",
        getAxes: () => axes,
        getCurves: () => curves,
        getOptions: () => resolved,
      },
    };
  }

  /**
   * Three stand-in axes, for the stub rows.
   * @returns {Array<Object>} Db-shaped axes
   */
  function radarStubAxes() {
    return [
      { name: "sA", label: "sA" },
      { name: "sB", label: "sB" },
      { name: "sC", label: "sC" },
    ];
  }

  /**
   * The delivered scale for one stub arrangement, through the REAL delivery
   * path rather than by calling radarScale directly.
   *
   * @param {Array<Object>} curves - Db-shaped curves
   * @param {Object} [options] - Option overrides
   * @returns {Object} The delivered options object
   */
  function radarStubOptions(curves, options) {
    return normaliseRadar(radarStubDiagram(radarStubAxes(), curves, options))
      .options;
  }

  /**
   * The delivered options for a VERBATIM options object, so a row can present
   * one with a key genuinely absent.
   *
   * @param {Object} rawOptions - The options object, used as-is
   * @returns {Object} The delivered options object
   */
  function radarStubRawOptions(rawOptions) {
    return normaliseRadar(
      radarStubDiagram(
        radarStubAxes(),
        [{ name: "c", label: "c", entries: [1, 2, 3] }],
        null,
        rawOptions
      )
    ).options;
  }

  /**
   * True when normaliseRadar refuses the given stub, with a message matching
   * the pattern. Used by the STOP rows, so a refusal for the WRONG reason
   * cannot satisfy them.
   *
   * @param {Function} thunk - A call that must refuse
   * @param {RegExp} pattern - What the refusal must say
   * @returns {boolean} Whether it refused, for that reason
   */
  function radarRefuses(thunk, pattern) {
    try {
      thunk();
      return false;
    } catch (e) {
      return pattern.test((e && e.message) || "");
    }
  }

  /**
   * True when normaliseRadar refuses a stub built from these axes and curves.
   *
   * @param {Array<Object>} axes - Db-shaped axes
   * @param {Array<Object>} curves - Db-shaped curves
   * @param {RegExp} pattern - What the refusal must say
   * @param {Object} [options] - Option overrides merged onto the defaults
   * @returns {boolean} Whether it refused, for that reason
   */
  function radarStubRefuses(axes, curves, pattern, options) {
    return radarRefuses(
      () => normaliseRadar(radarStubDiagram(axes, curves, options)),
      pattern
    );
  }

  /**
   * Parse the embedded fixtures and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the radar surface unhealthy, and
   * resolves false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the radar health verdict
   */
  function runRadarSelfCheck() {
    if (radarSelfCheckPromise) {
      return radarSelfCheckPromise;
    }
    radarSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          // THE NO-MAX FIXTURE RUNS FIRST AND IS READ TO COMPLETION BEFORE THE
          // MAIN FIXTURE IS PARSED. The db is a singleton, so the second parse
          // replaces the first's axes, curves, options AND trio entirely; the
          // delivery is copied into this adapter's own objects by
          // normaliseRadar, so it survives.
          return window.mermaid.mermaidAPI
            .getDiagramFromText(RADAR_SELF_CHECK_NO_MAX_FIXTURE)
            .then((noMaxDiagram) => normaliseRadar(noMaxDiagram));
        })
        .then((noMax) =>
          window.mermaid.mermaidAPI
            .getDiagramFromText(RADAR_SELF_CHECK_FIXTURE)
            .then((diagram) => ({ diagram: diagram, noMax: noMax }))
        )
        .then(({ diagram, noMax }) => {
          const db = diagram.db;

          // The six accessors this surface reads, by name — and the SEVENTH
          // the dispatch expected and the census refuted. `getTitle` is the
          // spelling c4 uses and the one a reader copying another surface
          // would reach for; on radar it is undefined and would deliver no
          // title at all, with no throw. Pinned in BOTH directions so a build
          // that ADDED it is seen here rather than by a reader.
          const accessorsPresent =
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function" &&
            typeof db.getAxes === "function" &&
            typeof db.getCurves === "function" &&
            typeof db.getOptions === "function";
          const noGetTitle = typeof db.getTitle === "undefined";

          // Raw reads, in this same slot, so the rows below are COMPARISONS
          // rather than restatements of the delivery.
          const rawAxes = db.getAxes();
          const rawCurves = db.getCurves();
          const rawOptions = db.getOptions();
          const rawFirstLabel = rawAxes[0] && rawAxes[0].label;
          const rawTitle = db.getDiagramTitle();

          const delivery = normaliseRadar(diagram);
          const [axisOne, axisTwo, axisThree] = delivery.axes;
          const [curveOne, curveTwo] = delivery.curves;
          const keysOf = (o) => (o ? Object.keys(o).join(",") : "");
          const sameList = (a, b) =>
            Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

          return [
            [
              "the six db accessors this surface reads exist by name, and " +
                "there is still NO getTitle — the spelling c4 uses, which on " +
                "this db would deliver undefined with no throw",
              accessorsPresent && noGetTitle,
            ],
            [
              "the delivery carries EXACTLY the seven documented top-level " +
                "keys, in order, and names its type",
              keysOf(delivery) === RADAR_DELIVERED_KEYS.join(",") &&
                delivery.diagramType === "radar",
            ],
            [
              "three axes in DECLARATION ORDER with the author's own ids, and " +
                "every delivered axis carries EXACTLY the two documented keys",
              delivery.axes.length === 3 &&
                axisOne.id === "scA" &&
                axisTwo.id === "scB" &&
                axisThree.id === "scC" &&
                keysOf(axisOne) === RADAR_AXIS_KEYS.join(",") &&
                keysOf(axisTwo) === RADAR_AXIS_KEYS.join(",") &&
                keysOf(axisThree) === RADAR_AXIS_KEYS.join(","),
            ],
            [
              "labels are decoded with decodePlaceholders and NOT with " +
                "decodeAuthorText — the axis label's `&amp;` is delivered as " +
                "the five characters the canvas draws, asserted with the two " +
                "decoders' DISAGREEMENT as a canary so a build where they had " +
                "collapsed could not satisfy this row",
              typeof rawFirstLabel === "string" &&
                decodeAuthorText(rawFirstLabel) !==
                  decodePlaceholders(rawFirstLabel) &&
                decodeAuthorText(rawFirstLabel) === "SelfCheck axis & one" &&
                axisOne.label === "SelfCheck axis &amp; one" &&
                axisTwo.label === "SelfCheck axis two" &&
                curveOne.label === "SelfCheck curve one" &&
                curveTwo.label === "SelfCheck curve two",
            ],
            [
              "the title is DECODED — a `#quot;` pair the db holds as private " +
                "sentinels is delivered as the real quote characters the " +
                "canvas draws, with the undecoded db string as the canary",
              rawTitle !== 'SelfCheck radar "title"' &&
                delivery.title === 'SelfCheck radar "title"',
            ],
            [
              "accTitle and accDescr take NO transform and are delivered " +
                "verbatim — ruling RS9, the standing carve-out, because " +
                "clause X3 reads the RAW SOURCE and that is what a reader hears",
              delivery.accTitle === "SelfCheck radar acc title" &&
                delivery.accDescr === "SelfCheck radar acc descr" &&
                delivery.accTitle === db.getAccTitle() &&
                delivery.accDescr === db.getAccDescription(),
            ],
            [
              "curve values arrive in AXIS ORDER from the axis:value form — " +
                "`{ scC: 30, scA: 10, scB: 20 }` against `axis scA, scB, scC` " +
                "delivers [10, 20, 30] — asserted against the db's own " +
                "entries so this row compares rather than restates",
              sameList(curveOne.values, [10, 20, 30]) &&
                sameList(rawCurves[0].entries, [10, 20, 30]) &&
                sameList(curveTwo.values, [40, 50]),
            ],
            [
              "`drawn` is TRUE on the exact-length curve and FALSE on the " +
                "short one in the SAME delivery — the per-curve divergence the " +
                "canvas makes, where the legend names both and the plot draws " +
                "one — and every delivered curve carries EXACTLY the four " +
                "documented keys",
              curveOne.drawn === true &&
                curveTwo.drawn === false &&
                keysOf(curveOne) === RADAR_CURVE_KEYS.join(",") &&
                keysOf(curveTwo) === RADAR_CURVE_KEYS.join(","),
            ],
            [
              "ruling RS7b: a curve on ONE axis is `drawn: false` even though " +
                "its value count equals the axis count — the canvas draws it " +
                "as a zero-length path, pixel-identical to no curve — asserted " +
                "beside a TWO-axis exact-length control that must stay drawn, " +
                "so a build that dropped the axis floor, or refused every " +
                "short chart, fails on one arm and not the other",
              (() => {
                const oneAxis = normaliseRadar(
                  radarStubDiagram(
                    [{ name: "sOne", label: "sOne" }],
                    [{ name: "c", label: "c", entries: [5] }]
                  )
                ).curves[0];
                const twoAxes = normaliseRadar(
                  radarStubDiagram(
                    [
                      { name: "sA", label: "sA" },
                      { name: "sB", label: "sB" },
                    ],
                    [{ name: "c", label: "c", entries: [5, 8] }]
                  )
                ).curves[0];
                return (
                  !!oneAxis &&
                  oneAxis.values.length === 1 &&
                  oneAxis.drawn === false &&
                  !!twoAxes &&
                  twoAxes.drawn === true
                );
              })(),
            ],
            [
              "the options object carries EXACTLY the seven documented keys, " +
                "the five db values as the author declared them, and a " +
                "scaleMax taken from the AUTHOR's own max",
              keysOf(delivery.options) === RADAR_OPTION_KEYS.join(",") &&
                delivery.options.showLegend === true &&
                delivery.options.ticks === 4 &&
                delivery.options.graticule === "polygon" &&
                delivery.options.min === 0 &&
                delivery.options.max === 100 &&
                delivery.options.scaleMax === 100 &&
                delivery.options.scaleMaxSource === RADAR_SCALE_MAX_AUTHOR &&
                rawOptions.max === 100,
            ],
            [
              "on a source declaring NO max the db reports `max: null` and " +
                "the surface derives the DATA maximum instead — the reading " +
                "the renderer's own geometry gave, and the other half of a " +
                "key that has exactly two sources",
              !!noMax &&
                noMax.options.max === null &&
                noMax.options.scaleMax === 90 &&
                noMax.options.scaleMaxSource === RADAR_SCALE_MAX_DATA &&
                noMax.options.min === 0 &&
                noMax.options.ticks === 5 &&
                noMax.options.graticule === "circle",
            ],
            [
              "the db's EMPTY STRING for an absent title, accTitle and " +
                "accDescr is delivered as null, so a consumer has ONE absent " +
                "case — with the titled fixture's three strings beside it, so " +
                "a build that nulled everything could not satisfy both rows",
              !!noMax &&
                noMax.title === null &&
                noMax.accTitle === null &&
                noMax.accDescr === null &&
                delivery.title !== null &&
                delivery.accTitle !== null &&
                delivery.accDescr !== null,
            ],
            [
              "the derived maximum counts a curve the picture does NOT DRAW " +
                "and an entry BEYOND THE AXIS COUNT — both measured off the " +
                "rendered geometry on 23 September 2026 — asserted against a " +
                "control arrangement without them, so a build ignoring either " +
                "fails on one arm and not the other",
              (() => {
                const drawnOnly = [
                  { name: "a", label: "a", entries: [10, 20, 90] },
                ];
                const withUndrawn = [
                  { name: "a", label: "a", entries: [10, 20, 90] },
                  { name: "b", label: "b", entries: [5, 200] },
                ];
                const withSurplus = [
                  { name: "a", label: "a", entries: [10, 20, 90] },
                  { name: "b", label: "b", entries: [1, 2, 3, 500] },
                ];
                const control = radarStubOptions(drawnOnly);
                const undrawn = radarStubOptions(withUndrawn);
                const surplus = radarStubOptions(withSurplus);
                const noValues = radarStubOptions([]);
                const authored = radarStubOptions(drawnOnly, { max: 50 });
                return (
                  control.scaleMax === 90 &&
                  control.scaleMaxSource === RADAR_SCALE_MAX_DATA &&
                  undrawn.scaleMax === 200 &&
                  surplus.scaleMax === 500 &&
                  // No curve at all: nothing to derive from, so null with the
                  // DATA source — "this picture plots nothing".
                  noValues.scaleMax === null &&
                  noValues.scaleMaxSource === RADAR_SCALE_MAX_DATA &&
                  // An author max BELOW the data still wins, which is what the
                  // renderer does: it clips the over-range vertices at the
                  // outer ring rather than growing the scale.
                  authored.scaleMax === 50 &&
                  authored.scaleMaxSource === RADAR_SCALE_MAX_AUTHOR
                );
              })(),
            ],
            [
              "a NON-NUMERIC value is a STOP rather than a silent coercion, " +
                "and so is a non-finite one — a coerced string would feed the " +
                "scale derivation and produce a confident wrong maximum",
              radarStubRefuses(
                radarStubAxes(),
                [{ name: "a", label: "a", entries: [1, "2", 3] }],
                /non-numeric value/
              ) &&
                radarStubRefuses(
                  radarStubAxes(),
                  [{ name: "a", label: "a", entries: [1, Infinity, 3] }],
                  /non-numeric value/
                ) &&
                radarStubRefuses(
                  radarStubAxes(),
                  [{ name: "a", label: "a", entries: "10,20,30" }],
                  /not an array/
                ),
            ],
            [
              "a db object MISSING a key the census recorded is a STOP on " +
                "every kind — an axis, a curve and the options — because a " +
                "chart short of an axis looks exactly like a chart with fewer " +
                "axes, and a dropped option would be invisible",
              radarStubRefuses(
                [{ name: "a" }],
                [{ name: "c", label: "c", entries: [1, 2, 3] }],
                /axis at index 0 carries no `label`/
              ) &&
                radarStubRefuses(
                  radarStubAxes(),
                  [{ name: "c", label: "c" }],
                  /curve at index 0 carries no `entries`/
                ) &&
                radarRefuses(
                  () =>
                    radarStubRawOptions({
                      showLegend: true,
                      ticks: 5,
                      max: null,
                      min: 0,
                    }),
                  /options carries no `graticule`/
                ),
            ],
            [
              "an option of the WRONG TYPE is a STOP, and `max: null` is not " +
                "one — the one key whose null is a real state, asserted in " +
                "both directions so a build refusing every null could not pass",
              radarStubRefuses(
                radarStubAxes(),
                [{ name: "c", label: "c", entries: [1, 2, 3] }],
                /unexpected type on \["ticks"\]/,
                { ticks: "5" }
              ) &&
                radarStubRefuses(
                  radarStubAxes(),
                  [{ name: "c", label: "c", entries: [1, 2, 3] }],
                  /unexpected type on \["showLegend"\]/,
                  { showLegend: "true" }
                ) &&
                radarStubOptions([{ name: "c", label: "c", entries: [1, 2, 3] }], {
                  max: null,
                }).max === null,
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    radarSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Radar self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's radar internals no longer " +
              "match the 22 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust radar adapter output."
          );
          radarHealthy = false;
          return false;
        }

        logInfo(
          "Radar self-check passed: accessor-and-no-getTitle, key-set, " +
            "axis-order, decode-pair, title-decode, trio-verbatim, " +
            "axis-value-ordering, drawn-pair, one-axis-undrawn, options-author-scale, " +
            "options-data-scale, empty-to-null, derivation-arms, " +
            "non-numeric-stop, missing-key-stop and option-type-stop " +
            "assertions all hold"
        );
        radarHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Radar self-check FAILED at assertion: the fixtures parse and " +
            `read. The fixture run rejected: ${error && error.message}`
        );
        radarHealthy = false;
        return false;
      });

    return radarSelfCheckPromise;
  }

  /**
   * Report the radar surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the radar self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isRadarHealthy() {
    return radarHealthy;
  }

  return {
    parse: parse,
    runSelfCheck: runSelfCheck,
    isHealthy: isHealthy,
    parseEr: parseEr,
    runErSelfCheck: runErSelfCheck,
    isErHealthy: isErHealthy,
    parseClass: parseClass,
    runClassSelfCheck: runClassSelfCheck,
    isClassHealthy: isClassHealthy,
    parseGit: parseGit,
    runGitSelfCheck: runGitSelfCheck,
    isGitHealthy: isGitHealthy,
    parseSankey: parseSankey,
    runSankeySelfCheck: runSankeySelfCheck,
    isSankeyHealthy: isSankeyHealthy,
    parseXychart: parseXychart,
    runXychartSelfCheck: runXychartSelfCheck,
    isXychartHealthy: isXychartHealthy,
    parseGantt: parseGantt,
    runGanttSelfCheck: runGanttSelfCheck,
    isGanttHealthy: isGanttHealthy,
    parseQuadrant: parseQuadrant,
    runQuadrantSelfCheck: runQuadrantSelfCheck,
    isQuadrantHealthy: isQuadrantHealthy,
    parseSequence: parseSequence,
    runSequenceSelfCheck: runSequenceSelfCheck,
    isSequenceHealthy: isSequenceHealthy,
    parseBlock: parseBlock,
    runBlockSelfCheck: runBlockSelfCheck,
    isBlockHealthy: isBlockHealthy,
    parseC4: parseC4,
    runC4SelfCheck: runC4SelfCheck,
    isC4Healthy: isC4Healthy,
    parseKanban: parseKanban,
    runKanbanSelfCheck: runKanbanSelfCheck,
    isKanbanHealthy: isKanbanHealthy,
    parseRadar: parseRadar,
    runRadarSelfCheck: runRadarSelfCheck,
    isRadarHealthy: isRadarHealthy,
    // Register item 78: a decoder for the core's author-override route, which
    // reads the raw diagram source. (It read "the ONE decoder exported from
    // this module" until 6 October 2026, when the fourth entry point below
    // joined it; the timeline event reads through this one too, from then.)
    decodeSourcePlaceholders: decodeSourcePlaceholders,
    // Item 82, entity slice enactment 1 (6 October 2026): the fourth entry
    // point, for the source-reading modules whose canvas draws the full decode
    // (mindmap, state). Resolved off window AT CALL TIME, as the rules below.
    decodeAuthorTextFromSource: decodeAuthorTextFromSource,
    resolveC4CanvasEntities: resolveC4CanvasEntities,
    // Item 82, enactment 5: the shared break rule, for the modules that read
    // the diagram SOURCE and have no adapter surface (timeline, architecture,
    // mindmap, state). A module resolves both off window AT CALL TIME.
    replaceTypedLineBreaks: replaceTypedLineBreaks,
    LINE_BREAK_FORMS: LINE_BREAK_FORMS,
    // Item 82, markup (5 October 2026): the shared markup rule, exported the
    // same way for the source-reading modules. No module calls it yet.
    replaceDrawnMarkup: replaceDrawnMarkup,
    // Item 82, L2 enactment 4 (6 October 2026): the link-segment reader, for
    // the two modules that read SOURCE (mindmap, state). Resolved off window
    // AT CALL TIME, as the two rules above are.
    readLabelWithLinks: readLabelWithLinks,
    // Register item 24: the global enableAllLog() cannot reach this module's
    // level, so the control is exported here as MermaidThemes and
    // MermaidControls already do. Without it the per-parse trace above is
    // unreachable from outside and every adapter investigation needs its own
    // scratch instrumentation.
    setLogLevel: setLogLevel,
  };
})();
