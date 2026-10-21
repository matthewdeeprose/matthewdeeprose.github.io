/**
 * Mermaid Accessibility - Packet Diagram Module
 *
 * Generates accessible descriptions for `packet` / `packet-beta` sources from
 * the shared parse adapter's PACKET surface (mermaid-parse-adapter.js,
 * `parsePacket`), never from the SVG and never from the diagram source.
 * The twenty-second description generator (register item 114) and the
 * fifteenth surface's consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-packet-gold-targets-2026-10-14.md - rules PK1 to PK12, rulings
 * PR1 to PR13 and Matthew's rulings MR1 (Fields as a table) and MR2 (Summary
 * last), VERSION 1 FROZEN 15 October 2026, amended the same day so a tie in
 * the Summary reads as a comma list with "and" before the last name. A
 * mismatch between this module's output and a target is a STOP that goes back
 * to the design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface, so THIS MODULE NEVER
 * DECODES; it only escapes, once, at the HTML sink. A packet diagram has no
 * link syntax, so markup in a name reads as written.
 *
 * THERE IS NO accTitle OR accDescr NARRATION HERE (clause X3 is the core's).
 *
 * ONE BUILDER PER FACT: `count` is the only place a number becomes a count
 * word, `plural` the only place a noun agrees with it, `bitsOf` the only
 * place a bit total or width is written, and `fieldName` the only place a
 * field is named, so the Overview, the Fields table, the Rows list and the
 * Summary cannot disagree about the same field.
 *
 * KNOWN DEPARTURE, PR12: the title is read from the DELIVERY, so a "<" or "&"
 * the author typed in a title reads as the picture prints it. Reading the raw
 * title is a surface change and belongs to the fixtures session.
 */
(function () {
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

  // Helper functions for logging level checks
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  // Logging helper methods
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  /** The surface's own row cap: the grid stops at 10,000 rows (census P12b). */
  const ROW_CAP = 10000;

  /** PK12: the byte count is stated only when the bit total divides by this. */
  const BITS_PER_BYTE = 8;

  // ---------------------------------------------------------------------
  // The shared prose layer, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------

  /**
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink. The caller escapes,
   * exactly once, where the field enters the HTML; generator furniture is
   * never escaped and the PLAIN short is never escaped at all.
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  // ---------------------------------------------------------------------
  // Counts and agreement (PK1)
  // ---------------------------------------------------------------------

  /**
   * A count as words to nine and digits from 10; zero reads "no".
   * @param {number} n - The count
   * @returns {string} The count word
   */
  function count(n) {
    return n === 0 ? "no" : common().narrationNumber(n);
  }

  /**
   * @param {number} n - The count
   * @param {string} one - The singular noun
   * @param {string} many - The plural noun
   * @returns {string} The noun that agrees with n
   */
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /**
   * A bit total or a width: the author's number as digits, with agreement.
   * @param {number} n - The number of bits
   * @returns {string} "1 bit" or "N bits"
   */
  function bitsOf(n) {
    return `${n} ${plural(n, "bit", "bits")}`;
  }

  /**
   * PK6: a name that draws nothing (empty, or spaces only) is unnamed.
   * @param {*} name - A delivered field name or title
   * @returns {boolean} True when nothing is drawn
   */
  function isBlank(name) {
    return name === null || name === undefined || String(name).trim() === "";
  }

  // ---------------------------------------------------------------------
  // Measured facts (PK3, PK4)
  // ---------------------------------------------------------------------

  /**
   * @param {number} bit - A bit number
   * @param {Object} delivery - The adapter's delivery
   * @returns {number} The one-based row the bit falls in
   */
  function rowOf(bit, delivery) {
    return Math.floor(bit / delivery.bitsPerRow) + 1;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {number} The total number of bits, to the end of the last field
   *   the picture draws (R9)
   */
  function totalBits(delivery) {
    const drawn = drawnFieldIndices(delivery);
    return delivery.fields[drawn[drawn.length - 1]].end + 1;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {boolean} True when the grid stopped at the row cap (PR7)
   */
  function isTruncated(delivery) {
    return !!(delivery.crossCheck && delivery.crossCheck.gridTruncated);
  }

  /** R9: what the Row cell says of a field the picture draws no row for. */
  const UNDRAWN_NOTE = "(written in the code, not drawn in the picture)";

  /** One delivery is read many times per description; compute its drawn set once. */
  const drawnFieldCache = new WeakMap();

  /**
   * ITEM 114 FIX 6B, R9 (16 October 2026). The fields the PICTURE draws: those
   * with at least one segment in the delivered rows. Past the 10000-row cap a
   * field can have none (sweep 6, F7: a field wholly past the cap read "rows
   * 10002 to 10000" and was counted and summarised as drawn). A field the cap
   * cuts part-way IS drawn, as before (PR7). An undrawn field is left out of
   * every count and the Summary and is disclosed in its own Fields row.
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<number>} The drawn fields' indices, in declaration order
   */
  function drawnFieldIndices(delivery) {
    if (drawnFieldCache.has(delivery)) {
      return drawnFieldCache.get(delivery);
    }
    const seen = new Set();
    delivery.rows.forEach((row) => {
      row.segments.forEach((segment) => seen.add(segment.fieldIndex));
    });
    const drawn = delivery.fields
      .map((field, index) => index)
      .filter((i) => seen.has(i));
    drawnFieldCache.set(delivery, drawn);
    return drawn;
  }

  /**
   * PK1: the one sentence. The title is passed through `esc`: identity for
   * the plain short, the HTML escape for the detailed Overview.
   * @param {Object} delivery - The adapter's delivery
   * @param {Function} esc - How the title enters this string
   * @returns {string} The sentence
   */
  function buildSentence(delivery, esc) {
    const title = isBlank(delivery.title) ? "" : ` titled "${esc(delivery.title)}"`;
    if (delivery.fields.length === 0) {
      return `A packet diagram${title} with no fields.`;
    }
    const n = drawnFieldIndices(delivery).length;
    const r = delivery.rows.length;
    return (
      `A packet diagram${title} with ${count(n)} ${plural(n, "field", "fields")} ` +
      `over ${bitsOf(totalBits(delivery))} in ${count(r)} ${plural(r, "row", "rows")} ` +
      `of ${bitsOf(delivery.bitsPerRow)}.`
    );
  }

  // ---------------------------------------------------------------------
  // Names (PK6, PK8)
  // ---------------------------------------------------------------------

  /**
   * The only place a field is named. An unnamed field reads "Unnamed field N"
   * at the head of an item and "unnamed field N" inside a sentence.
   * @param {Object} delivery - The adapter's delivery
   * @param {number} index - Zero-based field index
   * @param {boolean} atHead - True when the name opens an item or a value
   * @returns {string} The name, author text escaped once
   */
  function fieldName(delivery, index, atHead) {
    const name = delivery.fields[index].name;
    if (isBlank(name)) {
      return `${atHead ? "Unnamed" : "unnamed"} field ${index + 1}`;
    }
    return `"${escapeText(name)}"`;
  }

  /**
   * @param {number} start - First bit
   * @param {number} end - Last bit
   * @returns {string} "bit S" or "bits S to E"
   */
  function bitRange(start, end) {
    return start === end ? `bit ${start}` : `bits ${start} to ${end}`;
  }

  // ---------------------------------------------------------------------
  // The Fields table (MR1, PK11)
  // ---------------------------------------------------------------------

  const FIELDS_TABLE_HEAD = Object.freeze([
    "<table>",
    "<caption>Fields</caption>",
    "<thead>",
    '<tr><th scope="col">Field</th><th scope="col">Bits</th><th scope="col">Width</th><th scope="col">Row</th></tr>',
    "</thead>",
    "<tbody>",
  ]);

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {number} index - Zero-based field index
   * @returns {string} One <tr>, cells on one line
   */
  function renderFieldRow(delivery, index) {
    const field = delivery.fields[index];
    if (!drawnFieldIndices(delivery).includes(index)) {
      const undrawn = [
        fieldName(delivery, index, true),
        bitRange(field.start, field.end),
        bitsOf(field.end - field.start + 1),
        UNDRAWN_NOTE,
      ];
      return `<tr>${undrawn.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    }
    const firstRow = rowOf(field.start, delivery);
    // PR7: past the cap the picture draws no row, so name the drawn rows.
    const lastRow = isTruncated(delivery)
      ? Math.min(rowOf(field.end, delivery), delivery.rows.length)
      : rowOf(field.end, delivery);
    const where =
      firstRow === lastRow
        ? `row ${count(firstRow)}`
        : `rows ${count(firstRow)} to ${count(lastRow)}`;
    const cells = [
      fieldName(delivery, index, true),
      bitRange(field.start, field.end),
      bitsOf(field.end - field.start + 1),
      where,
    ];
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }

  // ---------------------------------------------------------------------
  // The Rows list (PK4)
  // ---------------------------------------------------------------------

  /**
   * PR3: a piece that continues from the row above and/or into the row below.
   * @param {boolean} continued - Continues from the row above
   * @param {boolean} continues - Continues into the row below
   * @returns {string} The marker, with its leading space, or ""
   */
  function continuationMarker(continued, continues) {
    if (continued && continues) return " (continued and continues)";
    if (continued) return " (continued)";
    if (continues) return " (continues)";
    return "";
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} row - One delivered row
   * @returns {string} One <li>
   */
  function renderRowItem(delivery, row) {
    const pieces = row.segments.map((segment) => {
      const continued = segment.start > delivery.fields[segment.fieldIndex].start;
      return (
        fieldName(delivery, segment.fieldIndex, false) +
        continuationMarker(continued, segment.continues)
      );
    });
    return `<li>Row ${count(row.index + 1)}, ${bitRange(row.startBit, row.endBit)}: ${pieces.join(", ")}.</li>`;
  }

  // ---------------------------------------------------------------------
  // The Summary (MR2, PK12 as amended 15 October 2026)
  // ---------------------------------------------------------------------

  /**
   * PK12 as amended: fields tied on width read as a comma list with "and"
   * before the last name, in declaration order. A tie of two reads "A" and
   * "B"; of three, "A", "B" and "C". An unnamed field is capitalised only at
   * the head of the value.
   * @param {Object} delivery - The adapter's delivery
   * @param {Array<number>} indices - Tied field indices, declaration order
   * @returns {string} The joined names
   */
  function joinTie(delivery, indices) {
    const names = indices.map((fieldIndex, position) =>
      fieldName(delivery, fieldIndex, position === 0)
    );
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {string} label - "Widest field" or "Narrowest field"
   * @param {Function} pick - Math.max or Math.min
   * @returns {string} One <dt><dd> line
   */
  function renderExtremeLine(delivery, label, pick) {
    const drawn = drawnFieldIndices(delivery);
    const widths = drawn.map((i) => delivery.fields[i].end - delivery.fields[i].start + 1);
    const target = pick(...widths);
    const indices = [];
    widths.forEach((width, position) => {
      if (width === target) indices.push(drawn[position]);
    });
    return `<dt>${label}</dt><dd>${joinTie(delivery, indices)}, ${bitsOf(target)}</dd>`;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(delivery) {
    const total = totalBits(delivery);
    const bytes =
      total % BITS_PER_BYTE === 0
        ? ` (${total / BITS_PER_BYTE} ${plural(total / BITS_PER_BYTE, "byte", "bytes")})`
        : "";
    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Length</dt><dd>${bitsOf(total)}${bytes}</dd>`,
      renderExtremeLine(delivery, "Widest field", Math.max),
      renderExtremeLine(delivery, "Narrowest field", Math.min),
      "</dl>",
    ];
  }

  // ---------------------------------------------------------------------
  // The generators
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. THE GUARD RUNS AFTER THE
   * PARSE and tests for `false`, never falsiness: `parsePacket` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised packet delivery
   */
  async function readPacket(code) {
    const delivery = await window.MermaidParseAdapter.parsePacket(code);
    if (window.MermaidParseAdapter.isPacketHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Packet self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its packet self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Packet delivery: ${delivery.fields.length} field(s), ${delivery.rows.length} row(s)`
    );
    return delivery;
  }

  /**
   * Generate the short description - rule PK1. The plain string is verbatim;
   * the HTML short is the escape of that one string.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Packet short description");

    const delivery = await readPacket(code);
    const text = buildSentence(delivery, (title) => title);
    logDebug(`[Mermaid Accessibility] Packet short: ${text}`);

    return { html: escapeText(text), text: text };
  }

  /**
   * Wrapper returning the plain tier.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Generate the detailed description - rules PK2 to PK12.
   *
   * Overview, Fields (table), Rows, Summary. A packet with no fields gets the
   * Overview alone (PK2). Newline-joined so text-content extraction stays
   * readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Packet detailed description");

    const delivery = await readPacket(code);
    const hasFields = delivery.fields.length > 0;

    let overview = buildSentence(delivery, escapeText);
    if (hasFields) {
      // PK7 / PR7: say whether the picture prints bit numbers, and when the
      // grid stops at the row cap. PR13: nothing is said for an empty packet.
      overview += delivery.showBits
        ? " Bit numbers are shown."
        : " Bit numbers are not shown.";
      if (isTruncated(delivery)) {
        overview += ` Only the first ${ROW_CAP} rows are drawn.`;
      }
    }
    const parts = ["<h4>Overview</h4>", `<p>${overview}</p>`];

    if (hasFields) {
      parts.push("<h4>Fields</h4>", ...FIELDS_TABLE_HEAD);
      delivery.fields.forEach((field, index) => {
        parts.push(renderFieldRow(delivery, index));
      });
      parts.push("</tbody>", "</table>", "<h4>Rows</h4>", "<ol>");
      delivery.rows.forEach((row) => {
        parts.push(renderRowItem(delivery, row));
      });
      parts.push("</ol>", ...renderSummary(delivery));
    }

    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "packet", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("packet", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Packet diagram module loaded and registered on the parse adapter's packet surface"
  );
})();
