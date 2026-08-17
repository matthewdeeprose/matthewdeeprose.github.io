/**
 * Mermaid Accessibility - Sankey Module
 *
 * Generates accessible descriptions for sankey diagrams from the shared parse
 * adapter's sankey surface (mermaid-parse-adapter.js), never from the SVG or a
 * source-text scan. Stage 2 of the sankey work, and the fourth and last of the
 * four new generator modules in register item 4: before this module existed,
 * sankey diagrams received the core's honest "no description available"
 * fallback.
 *
 * The adapter hands over exactly { type, nodes: [{name}], links:
 * [{from, to, value}] } — no title, no accessibility scalars and no config, by
 * design, because sankey has no syntax that populates the first two and the
 * third is leak-corrupted on the render-then-narrate path
 * (docs/mermaid-sankey-stage1-adapter-report-2026-08-03.md). Nothing is
 * pre-computed: every total, role and loop below is this module's own work
 * over the flat link list. Parses are serialised inside the adapter, so this
 * module needs no queue of its own.
 */
const SankeyModule = (function () {
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

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[Sankey][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Sankey][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[Sankey][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Sankey][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[Sankey][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Sankey][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[Sankey][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Sankey][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // Shared prose layer (loads before every diagram module — knowledge base
  // § 2): narrationNumber, formatList, capitalize.
  const Common = window.MermaidAccessibilityCommon;

  // Rounding denominator for spoken values: six decimal places, matching the
  // smallest legal value measured in stage 0 K3 (0.000001).
  const VALUE_PRECISION = 1e6;

  /**
   * Format one value for speech.
   *
   * Every spoken number on this surface goes through here, and the rounding is
   * not cosmetic. Node totals are floating-point SUMS, so a diagram whose flows
   * are 0.1 and 0.2 would otherwise be narrated as receiving
   * 0.30000000000000004. Six decimal places match the smallest value measured
   * as legal (stage 0 K3), so nothing an author can legitimately write is lost;
   * for plain values such as 80 and 20.5 the transform is the identity.
   *
   * Only ever called on a finite value — nonFinite() gates every call site.
   *
   * @param {number} value - A finite link value or node total
   * @returns {string} The value as spoken
   */
  function formatValue(value) {
    return String(Math.round(value * VALUE_PRECISION) / VALUE_PRECISION);
  }

  /**
   * Whether a value cannot be spoken or arithmetic'd.
   *
   * Covers NaN and both Infinities uniformly, which is the whole set of
   * non-finite outcomes the parser produces: "abc" parses silently to NaN and
   * "Infinity" to a real Infinity, both with typeof "number" (stage 0 K3).
   *
   * THIS IS NEVER A TRUTHINESS TEST, here or anywhere else in this module: 0
   * is a legal link value and is falsy, so `if (link.value)` would silently
   * drop every zero-value flow.
   *
   * @param {number} value - The raw link value from the adapter
   * @returns {boolean} True when the value cannot be used
   */
  function nonFinite(value) {
    return !Number.isFinite(value);
  }

  /**
   * The narrated form of one node name.
   *
   * A node name may legitimately be the EMPTY STRING — a name that sanitises
   * away, for example one starting with "<", yields an id of "" (stage 0
   * K10a). Speaking the empty quotes would produce a silent gap in the middle
   * of a sentence, so those nodes get a phrase instead.
   *
   * @param {string} name - The node name as the adapter supplies it
   * @returns {string} The name as spoken, quoted, or the unnamed phrase
   */
  function spokenName(name) {
    // The quotation marks and the unnamed phrase are furniture; only the
    // author's name is escaped. Every node name in the narration reaches the
    // HTML through this one function, so this is the module's single site.
    return name === "" ? "an unnamed node" : `"${Common.escapeHtml(name)}"`;
  }

  /**
   * Count phrases with digits always ("2 nodes", "1 flow"). Both plurals are
   * spelled out by the caller, matching the git module's helper.
   * @param {number} count - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} e.g. "8 flows"
   */
  function countPhrase(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  /**
   * Build the empty per-node tally.
   * @returns {Object} A fresh tally
   */
  function emptyTally() {
    return {
      receives: 0,
      sends: 0,
      hasInflow: false,
      hasOutflow: false,
      inflowUnknown: false,
      outflowUnknown: false,
    };
  }

  /**
   * Total what each node receives and sends, over the flat link list.
   *
   * Nothing is pre-computed on the adapter surface, so this is where a sankey's
   * arithmetic happens. Three rules, each measured:
   *
   *   - Duplicate source/target pairs are preserved by the parser as separate
   *     links (stage 0 K4), so they simply both add: the Flows list keeps the
   *     two bands apart while the totals here sum them.
   *   - A side poisoned by ANY non-finite link is unknown as a whole, rather
   *     than reporting a partial sum that reads like a complete one.
   *   - A self-link counts on BOTH sides of its own node (stage 0 K5), which
   *     falls out of handling `from` and `to` independently.
   *
   * Roles are recorded by LINK EXISTENCE (hasInflow / hasOutflow), never by a
   * total being non-zero: a zero-value link is still a link (K3).
   *
   * @param {Array<Object>} nodes - The adapter's nodes, in first-mention order
   * @param {Array<Object>} links - The adapter's links, in source order
   * @returns {Map<string, Object>} Node name to its tally
   */
  function computeTotals(nodes, links) {
    const totals = new Map();
    nodes.forEach((node) => {
      totals.set(node.name, emptyTally());
    });

    // A link endpoint always corresponds to a node — every node arrives via a
    // link — but the tally is created on demand so a shape change cannot throw.
    const tallyFor = (name) => {
      if (!totals.has(name)) {
        logWarn("computeTotals", `Link endpoint "${name}" is not a known node`);
        totals.set(name, emptyTally());
      }
      return totals.get(name);
    };

    links.forEach((link) => {
      const unreadable = nonFinite(link.value);

      const source = tallyFor(link.from);
      source.hasOutflow = true;
      if (unreadable) {
        source.outflowUnknown = true;
      } else {
        source.sends += link.value;
      }

      const target = tallyFor(link.to);
      target.hasInflow = true;
      if (unreadable) {
        target.inflowUnknown = true;
      } else {
        target.receives += link.value;
      }
    });

    return totals;
  }

  /**
   * Whether the flows contain a directed cycle of length two or more.
   *
   * SELF-LINKS ARE DELIBERATELY EXCLUDED. A node flowing into itself parses
   * cleanly (stage 0 K5) and is already evident from its own line in the Flows
   * list, so counting it as "a loop" would report the obvious as a discovery.
   * Only links whose from and to differ contribute an edge here.
   *
   * The search is an ITERATIVE colour-marked depth-first walk with an explicit
   * frame stack — white unvisited, grey on the current path, black finished —
   * so a long chain of flows cannot overflow the call stack. A grey neighbour
   * is a back edge, which is a cycle.
   *
   * @param {Array<Object>} nodes - The adapter's nodes
   * @param {Array<Object>} links - The adapter's links
   * @returns {boolean} True when a cycle of length two or more exists
   */
  function hasCycle(nodes, links) {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;

    const adjacency = new Map();
    const ensure = (name) => {
      if (!adjacency.has(name)) {
        adjacency.set(name, []);
      }
      return adjacency.get(name);
    };

    nodes.forEach((node) => {
      ensure(node.name);
    });

    links.forEach((link) => {
      if (link.from === link.to) {
        return;
      }
      ensure(link.to);
      ensure(link.from).push(link.to);
    });

    const colour = new Map();
    adjacency.forEach((_, name) => {
      colour.set(name, WHITE);
    });

    for (const start of adjacency.keys()) {
      if (colour.get(start) !== WHITE) {
        continue;
      }

      colour.set(start, GREY);
      const stack = [{ name: start, index: 0 }];

      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        const neighbours = adjacency.get(frame.name) || [];

        if (frame.index >= neighbours.length) {
          colour.set(frame.name, BLACK);
          stack.pop();
          continue;
        }

        const next = neighbours[frame.index];
        frame.index += 1;

        const state = colour.get(next);
        if (state === GREY) {
          logDebug("hasCycle", `Back edge from "${frame.name}" to "${next}"`);
          return true;
        }
        if (state === WHITE) {
          colour.set(next, GREY);
          stack.push({ name: next, index: 0 });
        }
      }
    }

    return false;
  }

  /**
   * Render one link as a flow list item. The source name starts the sentence,
   * so it is capitalised — a no-op for a quoted name, where the first
   * character is the quote, and load-bearing for "An unnamed node".
   * @param {Object} link - An adapter link object
   * @returns {string} An <li> fragment
   */
  function renderFlowItem(link) {
    const from = Common.capitalize(spokenName(link.from));
    const to = spokenName(link.to);
    const value = nonFinite(link.value)
      ? "value unknown"
      : formatValue(link.value);
    return `<li>${from} to ${to}: ${value}.</li>`;
  }

  /**
   * Render one node as a node list item, with its role decided by which sides
   * carry links rather than by the size of either total.
   * @param {Object} node - An adapter node object
   * @param {Map<string, Object>} totals - The tallies from computeTotals
   * @returns {string} An <li> fragment
   */
  function renderNodeItem(node, totals) {
    const name = Common.capitalize(spokenName(node.name));
    const tally = totals.get(node.name) || emptyTally();

    const received = tally.inflowUnknown
      ? "an unknown total"
      : formatValue(tally.receives);
    const sent = tally.outflowUnknown
      ? "an unknown total"
      : formatValue(tally.sends);

    if (tally.hasInflow && tally.hasOutflow) {
      return `<li>${name}: receives ${received}, sends ${sent}.</li>`;
    }
    if (tally.hasOutflow) {
      return `<li>${name}: sends ${sent}.</li>`;
    }
    // A node with no links at all cannot exist — every node arrives via a
    // link (stage 0 K1) — so the remaining arm is inflow-only.
    return `<li>${name}: receives ${received}.</li>`;
  }

  /**
   * Parse the code through the adapter's sankey surface and refuse to narrate
   * an unverified graph.
   *
   * A parse rejection is deliberately NOT caught here — the core's catch turns
   * it into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to the adapter's sankey graph
   */
  async function parseVerified(code) {
    const graph = await window.MermaidParseAdapter.parseSankey(code);
    if (window.MermaidParseAdapter.isSankeyHealthy() === false) {
      throw new Error(
        "Parse adapter failed its sankey self-check; refusing to narrate an unverified graph"
      );
    }
    return graph;
  }

  /**
   * Generate a short description for a sankey diagram.
   *
   * There is no zero variant: an empty sankey cannot parse at all (stage 0
   * K10), so a graph that reaches here always has at least one flow.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to an object with HTML and plain text versions of the description
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const graph = await parseVerified(code);

    const nodeCount = graph.nodes.length;
    const linkCount = graph.links.length;
    logDebug("Counts", `${nodeCount} nodes, ${linkCount} flows`);

    const description = `A sankey diagram with ${countPhrase(nodeCount, "node", "nodes")} and ${countPhrase(linkCount, "flow", "flows")}.`;

    logDebug("Final Short Description", description);

    // The short tier carries no markup, so both forms are the same string.
    return {
      html: description,
      text: description,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }

  /**
   * Generate a detailed description for a sankey diagram.
   *
   * One section with three headings, always all three: an Overview paragraph,
   * the Flows in the adapter's source order (duplicates as separate items), and
   * the Nodes in the adapter's first-mention order (stage 0 K8). A parsed
   * sankey always has at least one link and two ends, so none of the three can
   * be empty and none is conditional.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating sankey description");

    const graph = await parseVerified(code);

    const nodeCount = graph.nodes.length;
    const linkCount = graph.links.length;

    const totals = computeTotals(graph.nodes, graph.links);

    // --- Overview -------------------------------------------------------
    const sentences = [];

    sentences.push(
      `This sankey diagram contains ${countPhrase(nodeCount, "node", "nodes")} and ${countPhrase(linkCount, "flow", "flows")}.`
    );

    // Unreadable values are reported once, as a count, rather than left for
    // the reader to discover among the flow lines.
    const unreadableCount = graph.links.filter((link) =>
      nonFinite(link.value)
    ).length;
    if (unreadableCount > 0) {
      const countWord = Common.capitalize(
        Common.narrationNumber(unreadableCount)
      );
      const noun = unreadableCount === 1 ? "value" : "values";
      sentences.push(`${countWord} flow ${noun} could not be read.`);
    }

    if (hasCycle(graph.nodes, graph.links)) {
      sentences.push("The flows include a loop.");
    }

    // --- Assembly -------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);

    parts.push(`<h4 class="mermaid-details-heading">Flows</h4>`);
    parts.push(`<ul class="sankey-flows">`);
    for (const link of graph.links) {
      parts.push(renderFlowItem(link));
    }
    parts.push(`</ul>`);

    parts.push(`<h4 class="mermaid-details-heading">Nodes</h4>`);
    parts.push(`<ul class="sankey-nodes">`);
    for (const node of graph.nodes) {
      parts.push(renderNodeItem(node, totals));
    }
    parts.push(`</ul>`);

    parts.push(`</section>`);

    // Newline-joined so text-content extraction keeps list boundaries apart.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption — the {html, text} object is the tier's own return shape,
  // reached through this wrapper exactly as the ER, class and git modules do.
  // Registering the object tier directly puts [object Object] in the
  // figcaption, which the harness cannot catch (ER stage 2 report, delta 2).
  window.MermaidAccessibility.registerDescriptionGenerator("sankey", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "Sankey Module",
    "Sankey module loaded and registered on the parse adapter's sankey surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = SankeyModule;
} else {
  window.SankeyModule = SankeyModule;
}
