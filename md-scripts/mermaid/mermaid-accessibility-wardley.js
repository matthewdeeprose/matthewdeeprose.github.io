/**
 * Mermaid Accessibility - Wardley Module
 *
 * Generates accessible descriptions for `wardley-beta` sources from the shared
 * parse adapter's WARDLEY surface (mermaid-parse-adapter.js, `parseWardley`),
 * never from the SVG and never from the diagram source. The twenty-seventh
 * description generator (register item 130) and the twentieth surface's
 * consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-wardley-gold-targets-2026-10-27.md - rules WD1 to WD16 and
 * rulings MQ1 to MQ8 and O1 to O12 - VERSION 1 FROZEN 28 October 2026. A
 * mismatch between this module's output and a target is a STOP that goes back
 * to the design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX ON AUTHOR TEXT, NO db READ, NO DOM READ AND NO
 * SOURCE READ. Every author string arrives already decoded by the surface, so
 * THIS MODULE NEVER DECODES; it only escapes, once, at the HTML sink.
 *
 * THE SURFACE'S CHOKE POINTS ARE NOT RE-DERIVED: a node's drawn position
 * (`drawnEvolution`, `drawnVisibility`), whether a link is drawn (`drawn`),
 * the stage names and bands (`stages`) and the axis labels (`axes`) are read
 * as delivered. Only a position the picture COMPUTES (a pipeline parent's) is
 * rounded here, to the nearest whole number (O7).
 *
 * ONE DECISION PER FACT: `count` is the only place a number becomes a count
 * word, `cell` the only place a table number is written, `quoted` the only
 * place an author string is escaped and quoted.
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

  /** WD11, O3: the disclosure for a link or a stage label the picture does not draw (Matthew, 20 September 2026). */
  const NOT_DRAWN = "(written in the code, not drawn in the picture)";

  /** WF4: a computed place that lies off the 0 to 100 scale the picture is drawn on. */
  const OUTSIDE_SCALE = "(drawn outside the scale)";

  /** WF5: the direction word for an evolve arrow that points to the left of where it starts. */
  const MOVING_LEFT = "moving left";

  /** WF2: the words for a component or anchor whose name draws nothing, counted separately per kind. */
  const UNLABELLED_COMPONENT = "Unlabelled component";
  const UNLABELLED_ANCHOR = "Unlabelled anchor";

  /** WF6: the Kind cell for an anchor that also carries a pipeline (the picture draws both). */
  const KIND_ANCHOR_PIPELINE = "anchor, pipeline";

  /** WD14: at most this many names in a Summary row or the Overview's pipelines item; above it a count. */
  const NAME_LIST_MAX = 5;

  /** MQ1: positions are trimmed to this many significant digits (55.00000000000001 reads 55). */
  const POSITION_SIGNIFICANT_DIGITS = 12;

  /** MQ4: the visibility axis's default label, and the gloss written only while the axis keeps it. */
  const DEFAULT_VISIBILITY_LABEL = "Visibility";
  const VISIBILITY_GLOSS = ": the higher a component, the more visible it is to the user";

  /** WD14: the strategy words in the order the Summary reads them. */
  const STRATEGY_ORDER = Object.freeze(["build", "buy", "outsource", "market"]);

  /** WD4: the Components table's columns. */
  const TABLE_COLUMNS = Object.freeze([
    "Component",
    "Kind",
    "Stage",
    "Evolution",
    "Visibility",
    "Sourcing",
    "Inertia",
    "Evolves to",
  ]);

  /** The delivered stage-label midpoint range that lies on the picture (O3). */
  const PICTURE_MIN = 0;
  const PICTURE_MAX = 100;

  /** O12: two band widths closer than this are equal. */
  const BAND_WIDTH_TOLERANCE = 1e-6;

  // A label of white space and Unicode format characters draws nothing (as on ishikawa, IR6a). A TEST only.
  const NOTHING_DRAWN = /^[\s\p{Cf}]*$/u;

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
   * Escape one string of AUTHOR TEXT for an HTML sink, exactly once, where the
   * field enters the HTML. Generator furniture is never escaped and the PLAIN
   * short is never escaped at all.
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * @param {string} text - Author text
   * @returns {string} The text escaped once and inside quotation marks
   */
  function quoted(text) {
    return `"${escapeText(text)}"`;
  }

  /**
   * @param {string} message - What the delivery held that this module cannot narrate
   * @returns {Error} The STOP that reaches the core's honest fallback
   */
  function wardleyStop(message) {
    return new Error("Wardley narration: " + message);
  }

  /**
   * @param {*} text - A delivered label
   * @returns {boolean} True when nothing is drawn
   */
  function isBlank(text) {
    return text === null || text === undefined || NOTHING_DRAWN.test(String(text));
  }

  // ---------------------------------------------------------------------
  // Counts, agreement and numbers (WD1, WD13)
  // ---------------------------------------------------------------------

  /**
   * A count as words to nine and digits from 10, through the shared writer.
   * @param {number} n - The count
   * @returns {string} The count word ("no" for zero)
   */
  function count(n) {
    return n === 0 ? "no" : common().narrationNumber(n);
  }

  /**
   * @param {number} n - A count
   * @returns {string} "none" for zero, else the count word
   */
  function countOrNone(n) {
    return n === 0 ? "none" : count(n);
  }

  /**
   * "no links", "one link", "seven links": a count with its agreeing noun.
   * @param {number} n - The count
   * @param {string} one - The singular noun
   * @param {string} many - The plural noun
   * @returns {string} The phrase
   */
  function countPhrase(n, one, many) {
    if (n === 0) return `no ${many}`;
    return n === 1 ? `one ${one}` : `${count(n)} ${many}`;
  }

  /**
   * @param {string} text - A sentence start
   * @returns {string} The text with its first letter capitalised
   */
  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Items written as a comma list with "and" before the last (no serial comma).
   * @param {Array<string>} items - The already-written items
   * @returns {string} The joined items
   */
  function commaAnd(items) {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /**
   * MQ1: a position trimmed to twelve significant digits.
   * @param {number} n - A delivered position
   * @returns {number} The trimmed position
   */
  function trimmed(n) {
    return Number(Number(n).toPrecision(POSITION_SIGNIFICANT_DIGITS));
  }

  /**
   * O6: a number in a TABLE CELL is digits at every magnitude, so a column reads uniformly.
   * @param {number} n - A position
   * @returns {string} The digits
   */
  function cell(n) {
    return common().positionalDigits(trimmed(n));
  }

  /**
   * MQ1, WD13: a position inside a sentence, words to nine and digits from 10.
   * @param {number} n - A position
   * @returns {string} The position
   */
  function position(n) {
    const value = trimmed(n);
    return Number.isInteger(value) && value >= 0 && value <= 9
      ? common().narrationNumber(value)
      : common().positionalDigits(value);
  }

  // ---------------------------------------------------------------------
  // The delivery and its model
  // ---------------------------------------------------------------------

  /**
   * Check the delivery's shape. An unknown shape is a STOP to the honest
   * fallback, never a silent drop.
   * @param {Object} delivery - The adapter's wardley delivery
   */
  function verifyDelivery(delivery) {
    if (!delivery || delivery.diagramType !== "wardley") {
      throw wardleyStop("the delivery is not a wardley delivery");
    }
    const lists = ["components", "links", "trends", "pipelines", "notes", "annotations", "accelerators", "deaccelerators", "stages"];
    lists.forEach((key) => {
      if (!Array.isArray(delivery[key])) throw wardleyStop(`the delivery has no ${key} list`);
    });
    if (!delivery.axes || typeof delivery.axes.x !== "string" || typeof delivery.axes.y !== "string") {
      throw wardleyStop("the delivery has no axis labels");
    }
    if (delivery.stages.length === 0) throw wardleyStop("the delivery has no stages");
  }

  /**
   * Build the one model every section reads.
   * @param {Object} delivery - The adapter's wardley delivery
   * @returns {Object} The model
   */
  function buildModel(delivery) {
    const components = delivery.components.slice().sort((a, b) => a.authorIndex - b.authorIndex);
    const byId = new Map(components.map((c) => [c.id, c]));
    const anchors = components.filter((c) => c.kind === "anchor");
    const others = components.filter((c) => c.kind !== "anchor");
    const drawnLinks = delivery.links.filter((link) => link.drawn);
    const undrawnLinks = delivery.links.filter((link) => !link.drawn);
    const pipelines = delivery.pipelines
      .map((pipeline) => ({
        parent: byId.get(pipeline.nodeId),
        variants: pipeline.componentIds.map((id) => byId.get(id)).filter(Boolean),
      }))
      .filter((pipeline) => pipeline.parent);
    const trendsOf = (id) => delivery.trends.filter((trend) => trend.nodeId === id);

    // WF2: a name that draws nothing reads "Unlabelled component N" / "Unlabelled anchor N", counted per kind in table order.
    const unlabelled = new Map();
    let unlabelledAnchors = 0;
    let unlabelledComponents = 0;
    components.forEach((c) => {
      if (!isBlank(c.name)) return;
      if (c.kind === "anchor") {
        unlabelledAnchors += 1;
        unlabelled.set(c.id, `${UNLABELLED_ANCHOR} ${unlabelledAnchors}`);
      } else {
        unlabelledComponents += 1;
        unlabelled.set(c.id, `${UNLABELLED_COMPONENT} ${unlabelledComponents}`);
      }
    });
    return {
      unlabelled: unlabelled,
      components: components,
      byId: byId,
      anchors: anchors,
      others: others,
      drawnLinks: drawnLinks,
      undrawnLinks: undrawnLinks,
      pipelines: pipelines,
      trendsOf: trendsOf,
      evolving: components.filter((c) => trendsOf(c.id).length > 0),
      titled: !isBlank(delivery.title),
    };
  }

  /**
   * WD1: "one anchor, five components and two links"; a zero kind is left out
   * except components.
   * @param {Object} model - The model
   * @returns {string} The count list, without a full stop
   */
  function countList(model) {
    const parts = [];
    if (model.anchors.length > 0) parts.push(countPhrase(model.anchors.length, "anchor", "anchors"));
    parts.push(countPhrase(model.others.length, "component", "components"));
    if (model.drawnLinks.length > 0) parts.push(countPhrase(model.drawnLinks.length, "link", "links"));
    return commaAnd(parts);
  }

  /**
   * WF2: how a component is named in every section.
   * @param {Object} model - The model
   * @param {Object} component - A delivered component
   * @returns {string} The name in quotation marks (escaped once), or "Unlabelled component N" for a blank one
   */
  function shown(model, component) {
    return model.unlabelled.has(component.id) ? model.unlabelled.get(component.id) : quoted(component.name);
  }

  /**
   * @param {Object} model - The model
   * @param {string} id - A node id
   * @returns {string} The node as `shown` writes it, or the id in quotation marks when the db cannot resolve it
   */
  function shownById(model, id) {
    return model.byId.has(id) ? shown(model, model.byId.get(id)) : quoted(id);
  }

  /**
   * WD5, WF6: the kind word. An anchor that carries a pipeline is drawn as both.
   * @param {Object} component - A delivered component
   * @returns {string} anchor, anchor with its pipeline, pipeline, pipeline variant or component
   */
  function kindWord(component) {
    if (component.kind === "anchor") return component.isPipelineParent ? KIND_ANCHOR_PIPELINE : "anchor";
    if (component.kind === "pipeline-component") return "pipeline variant";
    return component.isPipelineParent ? "pipeline" : "component";
  }

  /**
   * WD6: the stage whose band holds a drawn evolution. A value on a boundary
   * belongs to the later stage, and the last stage takes the rest (O2).
   * @param {Array<Object>} stages - The delivered stages
   * @param {number} evolution - A drawn evolution
   * @returns {Object} The stage
   */
  function stageOf(stages, evolution) {
    for (let i = 0; i < stages.length - 1; i += 1) {
      if (evolution < stages[i].end) return stages[i];
    }
    return stages[stages.length - 1];
  }

  /**
   * O3: a stage label is drawn at the midpoint of its band, so it is on the
   * picture only when that midpoint is 0 to 100.
   * @param {Object} stage - A delivered stage
   * @returns {boolean} True when the label is on the picture
   */
  function stageDrawn(stage) {
    const midpoint = (stage.start + stage.end) / 2;
    return midpoint >= PICTURE_MIN && midpoint <= PICTURE_MAX;
  }

  /**
   * O12: bands of one width read "equal".
   * @param {Array<Object>} stages - The delivered stages
   * @returns {boolean} True when every band has the first band's width
   */
  function bandsEqual(stages) {
    const first = stages[0].end - stages[0].start;
    return stages.length > 1 && stages.every((s) => Math.abs(s.end - s.start - first) < BAND_WIDTH_TOLERANCE);
  }

  // ---------------------------------------------------------------------
  // WD1: the short
  // ---------------------------------------------------------------------

  /**
   * The PLAIN short: the title is the delivered text, never escaped. The HTML
   * short is derived from this string.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The plain sentence
   */
  function buildSentence(delivery, model) {
    const title = model.titled ? ` titled "${delivery.title}"` : "";
    return `A Wardley map${title} with ${countList(model)}.`;
  }

  // ---------------------------------------------------------------------
  // WD2: the Overview
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {Array<string>} The Overview section's lines
   */
  function renderOverview(delivery, model) {
    const lines = ["<h4>Overview</h4>"];
    if (model.titled) lines.push(`<p>This Wardley map is titled ${quoted(delivery.title)}.</p>`);

    // MQ8: with no title there is no sentence before the list for "It" to point to.
    lines.push("<ul>", `<li>${model.titled ? "It" : "This Wardley map"} has ${countList(model)}.</li>`);
    lines.push(
      `<li>Its axes are labelled ${quoted(delivery.axes.x)} and ${quoted(delivery.axes.y)}, and positions on both run from 0 to 100.</li>`
    );

    // MQ2, MQ4, O12, O3: evolution as drawn, with a nested list of the stages.
    const stages = delivery.stages;
    const offPicture = stages.filter((s) => !stageDrawn(s));
    const allOff = offPicture.length === stages.length;
    const stageWord = stages.length === 1 ? "stage" : "stages";
    lines.push(
      `<li>${escapeText(delivery.axes.x)} runs from 0 on the left to 100 on the right, through ${count(stages.length)} ${
        bandsEqual(stages) ? "equal " : ""
      }${stageWord}${allOff ? ` ${NOT_DRAWN}` : ""}:`,
      "<ol>"
    );
    stages.forEach((stage, index) => {
      const last = index === stages.length - 1;
      const note = !allOff && !stageDrawn(stage) ? ` ${NOT_DRAWN}` : "";
      lines.push(
        `<li>${quoted(stage.name)}, from ${cell(stage.start)} ${last ? "" : "up "}to ${cell(stage.end)}${note}.</li>`
      );
    });
    lines.push("</ol>", "</li>");

    // MQ4: visibility; the gloss only while the axis keeps its default label.
    lines.push(
      `<li>${escapeText(delivery.axes.y)} runs from 0 at the bottom to 100 at the top${
        delivery.axes.y === DEFAULT_VISIBILITY_LABEL ? VISIBILITY_GLOSS : ""
      }.</li>`
    );

    // MQ5: pipelines named when five or fewer, else the count.
    const pipes = model.pipelines;
    const variantTotal = pipes.reduce((total, pipe) => total + pipe.variants.length, 0);
    if (pipes.length > 0 && pipes.length <= NAME_LIST_MAX) {
      const named = pipes.map(
        (pipe) => `${shown(model, pipe.parent)}, with ${countPhrase(pipe.variants.length, "variant", "variants")}`
      );
      const joined =
        named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")}, and ${named[named.length - 1]}`;
      lines.push(`<li>The components include ${countPhrase(pipes.length, "pipeline", "pipelines")}, ${joined}.</li>`);
    } else if (pipes.length > 0) {
      const tail = variantTotal === 0 ? "" : ` and their ${countPhrase(variantTotal, "variant", "variants")}`;
      lines.push(`<li>The components include ${countPhrase(pipes.length, "pipeline", "pipelines")}${tail}.</li>`);
    }

    if (model.evolving.length > 0) {
      lines.push(
        `<li>${
          model.evolving.length === 1 ? "One component evolves." : `${capitalise(count(model.evolving.length))} components evolve.`
        }</li>`
      );
    }

    // MQ6, WD11: links the picture does not draw, counted once and not in the count list.
    const undrawn = model.undrawnLinks.length;
    if (undrawn > 0) {
      lines.push(
        `<li>${
          undrawn === 1
            ? "One more link is written in the code, not drawn in the picture."
            : `${capitalise(count(undrawn))} more links are written in the code, not drawn in the picture.`
        }</li>`
      );
    }
    lines.push("</ul>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // WD4 to WD10: the Components table
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {Array<string>} The Components section's lines
   */
  function renderComponents(delivery, model) {
    const lines = [
      "<h4>Components</h4>",
      "<table>",
      "<caption>Components</caption>",
      "<thead>",
      `<tr>${TABLE_COLUMNS.map((name) => `<th scope="col">${name}</th>`).join("")}</tr>`,
      "</thead>",
      "<tbody>",
    ];
    model.components.forEach((component) => {
      const stage = stageOf(delivery.stages, component.drawnEvolution);
      // WF5: an arrow that points to the left of where it starts says so; the same place and to the right read as before.
      const evolves = model
        .trendsOf(component.id)
        .map((trend) =>
          trimmed(trend.targetX) < trimmed(component.drawnEvolution)
            ? `evolution ${cell(trend.targetX)}, ${MOVING_LEFT}`
            : `evolution ${cell(trend.targetX)}`
        );
      // O7: a pipeline parent's place is computed by the picture, so it is rounded; an author's own numbers are read as typed.
      // WF4: a place off the 0 to 100 scale is read as drawn and says so.
      const place = (n) => {
        const value = component.isPipelineParent ? Math.round(n) : trimmed(n);
        return value < PICTURE_MIN || value > PICTURE_MAX ? `${cell(value)} ${OUTSIDE_SCALE}` : cell(value);
      };
      const cells = [
        shown(model, component),
        kindWord(component),
        escapeText(stage.name),
        place(component.drawnEvolution),
        place(component.drawnVisibility),
        component.sourceStrategy || "none",
        component.inertia ? "yes" : "no",
        evolves.length > 0 ? evolves.join(" and ") : "none",
      ];
      lines.push(`<tr>${cells.map((value) => `<td>${value}</td>`).join("")}</tr>`);
    });
    lines.push("</tbody>", "</table>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // WD11: the Links
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {Array<string>} The Links section's lines
   */
  function renderLinks(delivery, model) {
    const lines = ["<h4>Links</h4>", "<ol>"];
    delivery.links.forEach((link) => {
      const source = shownById(model, link.source);
      const target = shownById(model, link.target);
      const headed = link.flow === "forward" || link.flow === "backward" || link.flow === "bidirectional";
      let item;
      if (link.source === link.target) item = `${source} ${headed ? "points to" : "is joined to"} itself`;
      else if (link.flow === "forward") item = `${source} points to ${target}`;
      else if (link.flow === "backward") item = `${target} points to ${source}`;
      else if (link.flow === "bidirectional") item = `${source} and ${target} point to each other`;
      else item = `${source} is joined to ${target}`;
      if (link.dashed) item += ", on a dashed line";
      if (link.label !== null && link.label !== "") item += `, labelled ${quoted(link.label)}`;
      if (!link.drawn) item += ` ${NOT_DRAWN}`;
      lines.push(`<li>${item}.</li>`);
    });
    lines.push("</ol>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // WD7: the Pipelines
  // ---------------------------------------------------------------------

  /**
   * @param {Object} model - The model
   * @returns {Array<string>} The Pipelines section's lines
   */
  function renderPipelines(model) {
    const lines = ["<h4>Pipelines</h4>", "<ol>"];
    model.pipelines.forEach((pipe) => {
      const parent = shown(model, pipe.parent);
      const evolutions = pipe.variants.map((variant) => variant.drawnEvolution);
      if (pipe.variants.length === 0) {
        lines.push(`<li>Pipeline ${parent} has no variants.</li>`);
      } else if (pipe.variants.length === 1) {
        lines.push(
          `<li>Pipeline ${parent} has one variant, ${shown(model, pipe.variants[0])}, at evolution ${position(evolutions[0])}.</li>`
        );
      } else {
        lines.push(
          `<li>Pipeline ${parent} spans its variants from evolution ${position(Math.min(...evolutions))} to evolution ${position(
            Math.max(...evolutions)
          )}: ${commaAnd(pipe.variants.map((variant) => shown(model, variant)))}.</li>`
        );
      }
    });
    lines.push("</ol>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // WD15: the Notes
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Notes section's lines
   */
  function renderNotes(delivery) {
    const at = (x, y) => `at evolution ${position(x)}, visibility ${position(y)}`;
    const lines = ["<h4>Notes</h4>", "<ul>"];
    delivery.notes.forEach((note) => lines.push(`<li>Note ${quoted(note.text)}, ${at(note.x, note.y)}.</li>`));
    delivery.annotations.forEach((annotation) => {
      const text = annotation.text ? `, ${quoted(annotation.text)}` : "";
      const places = annotation.coordinates.map((point) => at(point.x, point.y)).join(" and ");
      lines.push(`<li>Annotation ${common().positionalDigits(annotation.number)}${text}, ${places}.</li>`);
    });
    delivery.accelerators.forEach((marker) =>
      lines.push(`<li>Accelerator ${quoted(marker.name)}, ${at(marker.x, marker.y)}.</li>`)
    );
    delivery.deaccelerators.forEach((marker) =>
      lines.push(`<li>Deaccelerator ${quoted(marker.name)}, ${at(marker.x, marker.y)}.</li>`)
    );
    lines.push("</ul>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // WD14: the Summary
  // ---------------------------------------------------------------------

  /**
   * @param {Object} model - The model
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(model) {
    const names = (list, noun) =>
      list.length > NAME_LIST_MAX ? `${count(list.length)} ${noun}` : commaAnd(list.map((c) => shown(model, c)));

    // Most linked: DRAWN links, a link from a node to itself counting once; anchors and components tie together.
    const degree = new Map(model.components.map((c) => [c.id, 0]));
    model.drawnLinks.forEach((link) => {
      degree.set(link.source, degree.get(link.source) + 1);
      if (link.target !== link.source) degree.set(link.target, degree.get(link.target) + 1);
    });
    const most = Math.max(0, ...degree.values());
    const tied = model.components.filter((c) => degree.get(c.id) === most);
    const who = tied.length > NAME_LIST_MAX ? count(tied.length) : commaAnd(tied.map((c) => shown(model, c)));
    const mostText = most === 0 ? "none" : `${who}, with ${countPhrase(most, "link", "links")}${tied.length > 1 ? " each" : ""}`;

    const sourcing = STRATEGY_ORDER.map((strategy) => [
      strategy,
      model.components.filter((c) => c.sourceStrategy === strategy).length,
    ]).filter(([, total]) => total > 0);

    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Anchors</dt><dd>${countOrNone(model.anchors.length)}</dd>`,
      `<dt>Components</dt><dd>${countOrNone(model.others.length)}</dd>`,
      `<dt>Links</dt><dd>${countOrNone(model.drawnLinks.length)}</dd>`,
      `<dt>Pipelines</dt><dd>${countOrNone(model.pipelines.length)}</dd>`,
      `<dt>Evolving components</dt><dd>${model.evolving.length === 0 ? "none" : names(model.evolving, "components")}</dd>`,
      `<dt>Most linked</dt><dd>${mostText}</dd>`,
      `<dt>Sourcing</dt><dd>${
        sourcing.length === 0 ? "none" : sourcing.map(([strategy, total]) => `${strategy} ${count(total)}`).join(", ")
      }</dd>`,
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
   * PARSE and tests for `false`, never falsiness: `parseWardley` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<{delivery: Object, model: Object}>} The delivery and its model
   */
  async function readWardley(code) {
    const delivery = await window.MermaidParseAdapter.parseWardley(code);
    if (window.MermaidParseAdapter.isWardleyHealthy() === false) {
      logWarn("[Mermaid Accessibility] Wardley self-check failed; refusing to narrate");
      throw new Error(
        "Parse adapter failed its wardley self-check; refusing to narrate an unverified diagram"
      );
    }
    verifyDelivery(delivery);
    const model = buildModel(delivery);
    logDebug(
      `[Mermaid Accessibility] Wardley delivery: ${model.anchors.length} anchor(s), ${model.others.length} component(s), ${model.drawnLinks.length} drawn link(s)`
    );
    return { delivery, model };
  }

  /**
   * Generate the short description - rule WD1. The plain string is verbatim;
   * the HTML short is the escape of that one string, derived and never
   * composed a second time.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating wardley short description");

    const { delivery, model } = await readWardley(code);
    const text = buildSentence(delivery, model);
    logDebug(`[Mermaid Accessibility] Wardley short: ${text}`);

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
   * Generate the detailed description - rules WD2 to WD15.
   *
   * Overview, Components (only with nodes), Links (only with links),
   * Pipelines and Notes (only when present), then Summary (always).
   * Newline-joined so text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating wardley detailed description");

    const { delivery, model } = await readWardley(code);
    const parts = renderOverview(delivery, model);
    if (model.components.length > 0) parts.push(...renderComponents(delivery, model));
    if (delivery.links.length > 0) parts.push(...renderLinks(delivery, model));
    if (model.pipelines.length > 0) parts.push(...renderPipelines(model));
    if (delivery.notes.length + delivery.annotations.length + delivery.accelerators.length + delivery.deaccelerators.length > 0) {
      parts.push(...renderNotes(delivery));
    }
    parts.push(...renderSummary(model));
    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "wardley", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("wardley", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Wardley module loaded and registered on the parse adapter's wardley surface"
  );
})();
