/**
 * Mermaid Accessibility - Flowchart Module
 * Generates accessible descriptions for flowchart diagrams
 * Enhanced to properly handle complex flowcharts with labeled edges
 */
const FlowchartModule = (function () {
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
      console.error(`[Flowchart][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Flowchart][ERROR][${context}] ${message}`);
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
      console.warn(`[Flowchart][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Flowchart][WARN][${context}] ${message}`);
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
      console.log(`[Flowchart][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][INFO][${context}] ${message}`);
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
      console.log(`[Flowchart][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // Shared prose layer (loads before every diagram module — knowledge base
  // § 2): narrationNumber, labelFullStop, formatList, capitalize.
  const Common = window.MermaidAccessibilityCommon;

  // Direction phrases for the short description. The adapter has already
  // collapsed the TD synonym to TB, so only these four keys can arrive.
  const DIRECTION_PHRASES = Object.freeze({
    TB: "top to bottom",
    BT: "bottom to top",
    LR: "left to right",
    RL: "right to left",
  });

  // A flowchart where more than this share of nodes are decision diamonds
  // is described as a "decision flowchart". Same threshold as the retired
  // source-text heuristic in mermaid-diagram-detection.js (isDecisionDiagram),
  // now measured against the parsed graph's real shapes.
  const DECISION_NODE_RATIO = 0.3;

  /**
   * Generate a short description for a flowchart
   *
   * Async since stage 2 of the flowchart rewrite: the values come from the
   * parse adapter's normalised graph, not from the SVG or a source-text
   * scan. A parse rejection is deliberately NOT caught here — the core's
   * catch turns it into the generation-failed fallback. Accepted interim
   * behaviour: while the detailed tier is still on the old path, a parse
   * rejection forfeits the whole description including a detailed that
   * might have been produced; this is by design until stage 3, and
   * unreachable in practice for a diagram that has already rendered.
   *
   * @param {HTMLElement} svgElement - Unused since stage 2; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to an object with HTML and plain text versions of the description
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const graph = await window.MermaidParseAdapter.parse(code);
    if (window.MermaidParseAdapter.isHealthy() === false) {
      throw new Error(
        "Parse adapter failed its self-check; refusing to narrate an unverified graph"
      );
    }

    const orientation = DIRECTION_PHRASES[graph.direction] || "";
    logDebug("Orientation", orientation || "None");

    const nodeCount = graph.nodes.length;
    logDebug("Node Count", nodeCount);

    // Is this a decision-heavy flowchart? Judged on real diamond shapes.
    const diamondCount = graph.nodes.filter(
      (node) => node.shape === "diamond"
    ).length;
    const isDecision =
      nodeCount > 0 && diamondCount / nodeCount > DECISION_NODE_RATIO;
    logDebug("Is Decision Diagram", isDecision);

    let complexityDesc = "";

    if (nodeCount > 20) {
      complexityDesc = "complex ";
    } else if (nodeCount > 10) {
      complexityDesc = "moderate ";
    }

    // Construct description with appropriate classes
    let htmlDescription = `A ${complexityDesc}flowchart`;

    // Plain text version for screen readers and textContent scenarios
    let plainTextDescription = `A ${complexityDesc}flowchart`;

    if (isDecision) {
      htmlDescription = `A ${complexityDesc}decision flowchart`;
      plainTextDescription = `A ${complexityDesc}decision flowchart`;
    }

    // No title branch: measured 2 August 2026 (stage 2, step 0), a
    // frontmatter title does not surface through the adapter's
    // getDiagramTitle-backed field on the pinned Mermaid build
    // (graph.title came back empty), so there is nothing reliable to say.

    if (orientation) {
      htmlDescription += ` flowing ${orientation}`;
      plainTextDescription += ` flowing ${orientation}`;
    }

    if (nodeCount > 0) {
      const stepNoun = nodeCount === 1 ? "step" : "steps";
      htmlDescription += ` with <span class="diagram-count">${nodeCount}</span> ${stepNoun}`;
      plainTextDescription += ` with ${nodeCount} ${stepNoun}`;
    }

    htmlDescription += ".";
    plainTextDescription += ".";

    logDebug("Final Short Description", plainTextDescription);

    return {
      html: htmlDescription,
      text: plainTextDescription,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused since stage 2; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }


  // ---------------------------------------------------------------------
  // Stage 3: the detailed tier on the parse adapter — traversal + narration
  // ---------------------------------------------------------------------

  // Edge kinds that impose order, start to end (stage 0 M2). Open links
  // (arrow_open) connect two steps without direction: they count for
  // connectivity and the "also linked to" narration, never for numbering.
  const ORDERING_EDGE_KINDS = Object.freeze([
    "arrow_point",
    "arrow_circle",
    "arrow_cross",
    "double_arrow_point",
  ]);

  // Numbers policy (approved in design): step references and descriptive
  // counts are words for one to nine and digits from 10; the overview's
  // step total is always digits. Implemented by Common.narrationNumber;
  // Oxford-comma joining, label full stops and capitalisation also come
  // from the shared prose layer since the helper promotion (register
  // item: shared narration helpers).

  /**
   * Traverse the normalised graph: weakly-connected components over ALL
   * edges, then a Kahn topological numbering per component over ordering
   * edges only, tie-broken by source first-mention order. When cycles
   * block the queue the earliest-mention unnumbered node is forced, and
   * any ordering edge whose target is numbered at or before its source is
   * a cycle edge ("go back to").
   *
   * @param {Object} graph - The parse adapter's normalised graph
   * @returns {Object} The traversal model the renderer consumes
   */
  function buildFlowchartTraversal(graph) {
    const mention = new Map();
    const nodeById = new Map();
    graph.nodes.forEach((node, index) => {
      mention.set(node.id, index);
      nodeById.set(node.id, node);
    });

    const isOrdering = (edge) =>
      ORDERING_EDGE_KINDS.includes(edge.kind) && edge.from !== edge.to;

    // Per-node edge lists, all in graph.edges (source) order.
    const orderingOut = new Map(graph.nodes.map((n) => [n.id, []]));
    const selfLoops = new Map(graph.nodes.map((n) => [n.id, []]));
    const openFrom = new Map(graph.nodes.map((n) => [n.id, []]));
    const touched = new Set();
    const neighbours = new Map(graph.nodes.map((n) => [n.id, new Set()]));

    for (const edge of graph.edges) {
      touched.add(edge.from);
      touched.add(edge.to);
      if (edge.from === edge.to) {
        selfLoops.get(edge.from).push(edge);
        continue;
      }
      neighbours.get(edge.from).add(edge.to);
      neighbours.get(edge.to).add(edge.from);
      if (isOrdering(edge)) {
        orderingOut.get(edge.from).push(edge);
      } else if (edge.kind === "arrow_open") {
        openFrom.get(edge.from).push(edge);
      }
    }

    // Isolated nodes: no incident edges at all. Excluded from the steps
    // list and declared in a paragraph after it.
    const isolated = graph.nodes
      .filter((node) => !touched.has(node.id))
      .map((node) => node.id);
    const isolatedSet = new Set(isolated);

    // In-degree and out-degree over ordering edges, self-loops ignored.
    const inDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    const outDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        inDegree.set(edge.to, inDegree.get(edge.to) + 1);
        outDegree.set(edge.from, outDegree.get(edge.from) + 1);
      }
    }

    // Weakly-connected components among non-isolated nodes, over all edges.
    const componentOf = new Map();
    const components = [];
    for (const node of graph.nodes) {
      if (isolatedSet.has(node.id) || componentOf.has(node.id)) continue;
      const members = [];
      const queue = [node.id];
      componentOf.set(node.id, components.length);
      while (queue.length) {
        const id = queue.shift();
        members.push(id);
        for (const next of neighbours.get(id)) {
          if (!componentOf.has(next) && !isolatedSet.has(next)) {
            componentOf.set(next, components.length);
            queue.push(next);
          }
        }
      }
      components.push({ members, stepIds: [] });
    }

    // Order components by their start's first mention (earliest member
    // where no start node exists — the loop case).
    for (const component of components) {
      const starts = component.members.filter((id) => inDegree.get(id) === 0);
      const pool = starts.length ? starts : component.members;
      component.startMention = Math.min(...pool.map((id) => mention.get(id)));
    }
    components.sort((a, b) => a.startMention - b.startMention);

    // Kahn numbering, continuous across components.
    const numberOf = new Map();
    const stepsInOrder = [];
    let counter = 0;
    for (const component of components) {
      const remaining = new Set(component.members);
      const localIn = new Map(
        component.members.map((id) => [id, inDegree.get(id)])
      );
      while (remaining.size) {
        let candidates = [...remaining].filter((id) => localIn.get(id) === 0);
        if (candidates.length === 0) {
          // A cycle blocks the queue: force the earliest-mention node.
          candidates = [...remaining];
        }
        candidates.sort((a, b) => mention.get(a) - mention.get(b));
        const id = candidates[0];
        remaining.delete(id);
        counter += 1;
        numberOf.set(id, counter);
        stepsInOrder.push(id);
        component.stepIds.push(id);
        for (const edge of orderingOut.get(id)) {
          if (remaining.has(edge.to)) {
            localIn.set(edge.to, localIn.get(edge.to) - 1);
          }
        }
      }
    }

    // Cycle edges: ordering edges pointing at an already-numbered node.
    const cycleEdges = new Set();
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        if (numberOf.get(edge.to) <= numberOf.get(edge.from)) {
          cycleEdges.add(edge);
        }
      }
    }

    // Start points exclude cycle edges (stage 3.1 amendment A): a
    // back-edge does not stop a node being where reading begins, but it
    // does mean the process continues from that node — so end points keep
    // counting cycle edges. Every edge into a component's first-numbered
    // node is a cycle edge by construction, so each component contributes
    // at least one start point.
    const nonCycleInDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        if (cycleEdges.has(edge)) continue;
        nonCycleInDegree.set(edge.to, nonCycleInDegree.get(edge.to) + 1);
      }
    }

    const nonIsolated = graph.nodes.filter((n) => !isolatedSet.has(n.id));
    return {
      nodeById,
      orderingOut,
      selfLoops,
      openFrom,
      isolated,
      components,
      numberOf,
      stepsInOrder,
      cycleEdges,
      startCount: nonIsolated.filter((n) => nonCycleInDegree.get(n.id) === 0)
        .length,
      endCount: nonIsolated.filter((n) => outDegree.get(n.id) === 0).length,
      diamondCount: graph.nodes.filter((n) => n.shape === "diamond").length,
    };
  }

  /**
   * Render one step's list item from the traversal model.
   * @param {string} id - The node id
   * @param {Object} t - The traversal model
   * @returns {string} An <li> fragment
   */
  function renderStepItem(id, t) {
    const node = t.nodeById.get(id);
    const label = node.label;

    // Diagram-source text is escaped once, here, where it enters an HTML
    // string. Everything downstream of this point is generator-authored
    // markup and must never be escaped. labelFullStop still reads the RAW
    // label: it is a text-level test for trailing sentence punctuation.
    const safeLabel = Common.escapeHtml(label);

    const out = t.orderingOut.get(id);
    const loops = t.selfLoops.get(id);
    const opens = t.openFrom.get(id);
    const isDiamond = node.shape === "diamond";

    // A labelled self-loop is narrated as a nested item, so it forces the
    // nested form too.
    const nestedForm =
      isDiamond ||
      out.length >= 2 ||
      out.some((edge) => edge.label) ||
      loops.some((edge) => edge.label);

    // The reference phrase for one ordering edge, lowercase.
    const referencePhrase = (edge) => {
      const word = Common.narrationNumber(t.numberOf.get(edge.to));
      if (edge.kind === "double_arrow_point") {
        return `connects both ways with step ${word}`;
      }
      return t.cycleEdges.has(edge)
        ? `go back to step ${word}`
        : `go to step ${word}`;
    };

    let main;
    const nestedItems = [];

    if (nestedForm) {
      main = isDiamond
        ? `Decision: <span class="diagram-decision">${safeLabel}</span>${Common.labelFullStop(label)}`
        : `<span class="diagram-action">${safeLabel}</span>${Common.labelFullStop(label)}`;
      for (const edge of out) {
        nestedItems.push(
          edge.label
            ? `<li>If ${Common.escapeHtml(edge.label)}, ${referencePhrase(edge)}.</li>`
            : `<li>${Common.capitalize(referencePhrase(edge))}.</li>`
        );
      }
      for (const edge of loops) {
        if (edge.label) {
          nestedItems.push(
            `<li>If ${Common.escapeHtml(edge.label)}, this step repeats.</li>`
          );
        }
      }
    } else if (out.length === 1) {
      const edge = out[0];
      const word = Common.narrationNumber(t.numberOf.get(edge.to));
      let sentence;
      if (edge.kind === "double_arrow_point") {
        sentence = `Connects both ways with step ${word}.`;
      } else if (t.cycleEdges.has(edge)) {
        sentence = `Go back to step ${word}.`;
      } else {
        sentence = `Proceed to step ${word}.`;
      }
      main = `<span class="diagram-action">${safeLabel}</span>${Common.labelFullStop(label)} ${sentence}`;
    } else {
      main = `<span class="diagram-node">${safeLabel}</span>${Common.labelFullStop(label)} This is the end of the process.`;
    }

    // Appended sentences: unlabelled self-loops, then open links (narrated
    // on the edge's start-side step only).
    let appendix = "";
    if (loops.some((edge) => !edge.label)) {
      appendix += " This step can repeat itself.";
    }
    for (const edge of opens) {
      const other = t.nodeById.get(edge.to);
      appendix += ` It is also linked to ${Common.escapeHtml(other.label)}.`;
    }

    // Newlines between elements keep text-content extraction readable:
    // without them, block and list boundaries concatenate with no space.
    if (nestedItems.length) {
      return `<li>${main}${appendix}\n<ul class="decision-paths">\n${nestedItems.join("\n")}\n</ul>\n</li>`;
    }
    return `<li>${main}${appendix}</li>`;
  }

  /**
   * Generate a detailed description for a flowchart
   *
   * Async since stage 3 of the flowchart rewrite: the narration is built
   * from the parse adapter's normalised graph — order by flow, never by
   * alphabet — to contract clauses D1 to D6. A parse rejection or a failed
   * adapter self-check propagates; the core's catch produces the honest
   * generation-failed statement (pinned by fault-pie/generator-throws).
   * Never catch and narrate anyway.
   *
   * @param {HTMLElement} svgElement - Unused since stage 3; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating flowchart description");

    const graph = await window.MermaidParseAdapter.parse(code);
    if (window.MermaidParseAdapter.isHealthy() === false) {
      throw new Error(
        "Parse adapter failed its self-check; refusing to narrate an unverified graph"
      );
    }

    const t = buildFlowchartTraversal(graph);
    // The step total counts ALL nodes, isolated ones included (stage 3.1
    // amendment B); the overview then says how many are unconnected.
    const totalSteps = graph.nodes.length;

    // --- Overview -------------------------------------------------------
    const sentences = [];

    const directionPhrase = DIRECTION_PHRASES[graph.direction] || "";
    let flowSentence = directionPhrase
      ? `This flowchart flows from ${directionPhrase} through ${totalSteps} step${totalSteps === 1 ? "" : "s"}`
      : `This flowchart flows through ${totalSteps} step${totalSteps === 1 ? "" : "s"}`;
    if (t.diamondCount > 0) {
      flowSentence += `, including ${Common.narrationNumber(t.diamondCount)} decision point${t.diamondCount === 1 ? "" : "s"}`;
    }
    if (t.isolated.length > 0) {
      flowSentence +=
        t.isolated.length === 1
          ? `, one of which is not connected to the others`
          : `, ${Common.narrationNumber(t.isolated.length)} of which are not connected to the others`;
    }
    sentences.push(`${flowSentence}.`);

    const startWord = Common.narrationNumber(t.startCount);
    const endWord = Common.narrationNumber(t.endCount);
    if (t.startCount > 0 && t.endCount > 0) {
      sentences.push(
        `It has ${startWord} start point${t.startCount === 1 ? "" : "s"} and ${endWord} end point${t.endCount === 1 ? "" : "s"}.`
      );
    } else if (t.startCount > 0) {
      // The loop sentence below carries the loop information alone
      // (stage 3.1 amendment C), so no "; the flow forms a loop" tail here.
      sentences.push(
        `It has ${startWord} start point${t.startCount === 1 ? "" : "s"} and no distinct end point.`
      );
    }
    // A zero start count is unreachable (stage 3.1 amendment A): every
    // edge into a component's first-numbered node is a cycle edge, so
    // each component contributes at least one start point. A diagram with
    // no numbered steps at all simply skips this sentence.

    if (t.components.length > 1) {
      sentences.push(
        `The diagram contains ${Common.narrationNumber(t.components.length)} separate flows.`
      );
    }

    if (graph.subgraphs.length > 0) {
      sentences.push(
        `The steps are organised into ${Common.narrationNumber(graph.subgraphs.length)} group${graph.subgraphs.length === 1 ? "" : "s"}, described below.`
      );
    }

    const cycleList = [...t.cycleEdges];
    if (cycleList.length === 1) {
      const edge = cycleList[0];
      sentences.push(
        `The flow contains a loop: step ${Common.narrationNumber(t.numberOf.get(edge.from))} can return to step ${Common.narrationNumber(t.numberOf.get(edge.to))}.`
      );
    } else if (cycleList.length > 1) {
      sentences.push(`The flow contains loops, noted in the steps below.`);
    }

    // --- Assembly ---------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);
    parts.push(`<h4 class="mermaid-details-heading">Steps</h4>`);

    if (t.components.length > 1) {
      t.components.forEach((component, index) => {
        parts.push(
          `<h5 class="flow-heading">Flow ${Common.narrationNumber(index + 1)}</h5>`
        );
        parts.push(
          `<ol class="flowchart-steps" start="${t.numberOf.get(component.stepIds[0])}">`
        );
        for (const id of component.stepIds) {
          parts.push(renderStepItem(id, t));
        }
        parts.push(`</ol>`);
      });
    } else {
      parts.push(`<ol class="flowchart-steps">`);
      for (const id of t.stepsInOrder) {
        parts.push(renderStepItem(id, t));
      }
      parts.push(`</ol>`);
    }

    if (t.isolated.length > 0) {
      // Each label is escaped BEFORE the list is formatted — formatList
      // inserts its own commas and "and", which must not be escaped.
      const labels = t.isolated.map((id) =>
        Common.escapeHtml(t.nodeById.get(id).label)
      );
      const countWord = Common.capitalize(Common.narrationNumber(t.isolated.length));
      const noun = t.isolated.length === 1 ? "step" : "steps";
      const verb = t.isolated.length === 1 ? "is" : "are";
      parts.push(
        `<p>${countWord} ${noun}, ${Common.formatList(labels)}, ${verb} not connected to the others.</p>`
      );
    }

    if (graph.subgraphs.length > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Groups</h4>`);
      parts.push(`<ul>`);
      for (const sub of graph.subgraphs) {
        const title = Common.escapeHtml(sub.title || sub.id);
        const stepWords = sub.nodeIds
          .map((id) => t.numberOf.get(id))
          .filter((n) => typeof n === "number")
          .sort((a, b) => a - b)
          .map(Common.narrationNumber);
        const stepsPhrase =
          stepWords.length === 1
            ? `step ${stepWords[0]}`
            : `steps ${Common.formatList(stepWords)}`;
        if (sub.childSubgraphIds.length > 0) {
          // Escaped per title, before formatList joins them, for the same
          // reason as the isolated-step list above.
          const childTitles = sub.childSubgraphIds.map((childId) => {
            const child = graph.subgraphs.find((s) => s.id === childId);
            return Common.escapeHtml(
              child ? child.title || child.id : childId
            );
          });
          const groupPhrase =
            childTitles.length === 1
              ? `the group ${childTitles[0]}`
              : `the groups ${Common.formatList(childTitles)}`;
          parts.push(
            `<li>${title} contains ${groupPhrase}${stepWords.length ? ` and ${stepsPhrase}` : ""}.</li>`
          );
        } else {
          parts.push(`<li>${title} contains ${stepsPhrase}.</li>`);
        }
      }
      parts.push(`</ul>`);
    }

    parts.push(`</section>`);
    // Newline-joined for the same text-extraction reason as the list items.
    return parts.join("\n");
  }


  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("flowchart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
    // Add a flag to help with CSS class application
    diagramType: "flowchart",
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
    "Flowchart Module",
    "Flowchart module loaded and registered with enhanced parsing for complex diagrams"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = FlowchartModule;
} else {
  window.FlowchartModule = FlowchartModule;
}
