/**
 * Mermaid Accessibility - Class Diagram Module
 *
 * Generates accessible descriptions for class diagrams from the shared parse
 * adapter's class surface (mermaid-parse-adapter.js), never from the SVG or a
 * source-text scan. Stage 2 of the class work: before this module existed,
 * class diagrams received the core's honest "no description available"
 * fallback.
 *
 * The three-field relation decode (type1, type2, lineType) is already done by
 * the adapter, which hands over a `kind` and a `markerAt` saying WHICH END
 * carries the marker. That end is the parent, whole, aggregate or target —
 * measured across four mirrored probes in
 * docs/mermaid-class-stage0-measurements-2026-08-02.md § C2 — and every
 * sentence below is built from it rather than from the raw codes.
 */
const ClassDiagramModule = (function () {
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
      console.error(`[Class][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Class][ERROR][${context}] ${message}`);
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
      console.warn(`[Class][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Class][WARN][${context}] ${message}`);
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
      console.log(`[Class][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Class][INFO][${context}] ${message}`);
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
      console.log(`[Class][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Class][DEBUG][${context}] ${message}`);
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

  // Visibility markers, expanded for narration. An empty marker is omitted
  // rather than guessed at (stage 0 C5: a member with no marker gets "").
  const VISIBILITY_WORDS = Object.freeze({
    "+": "public",
    "-": "private",
    "#": "protected",
    "~": "package",
  });

  // The classifier field carries static and abstract (stage 0 C5) — a field
  // B4 never named, and the only place either fact appears.
  const CLASSIFIER_WORDS = Object.freeze({
    $: "static",
    "*": "abstract",
  });

  // Multiplicity phrases, matched exactly. `plural` says which number the
  // generator's own noun takes; the author's class name is never inflected
  // (register item 26, decided 12 August 2026). Anything unrecognised is
  // spoken verbatim rather than reshaped, because the source string is the
  // only evidence of what the author meant.
  const MULTIPLICITY_PHRASES = Object.freeze({
    "1": { phrase: "exactly one", plural: false },
    "0..1": { phrase: "zero or one", plural: false },
    "*": { phrase: "zero or more", plural: true },
    "0..*": { phrase: "zero or more", plural: true },
    "1..*": { phrase: "one or more", plural: true },
  });

  // The noun the plural attaches to, so the author's name never has to carry
  // it. A class diagram narrates its objects as instances.
  const CLASS_NOUN = Object.freeze({ singular: "instance", plural: "instances" });

  // Core sentence per relation kind. `first` and `second` name the slots in
  // the order the template speaks them, where "marker" is the end carrying
  // the marker (parent / whole / aggregate / target, per C2) and "other" is
  // the far end. The slot order matters beyond the wording: a
  // self-relationship replaces whichever name is spoken SECOND with
  // "itself".
  const RELATION_TEMPLATES = Object.freeze({
    inheritance: { first: "other", second: "marker", template: "{first} inherits from {second}" },
    realisation: { first: "other", second: "marker", template: "{first} implements {second}" },
    composition: { first: "marker", second: "other", template: "{first} is composed of {second}" },
    aggregation: { first: "marker", second: "other", template: "{first} aggregates {second}" },
    association: { first: "other", second: "marker", template: "{first} is associated with {second}" },
    dependency: { first: "other", second: "marker", template: "{first} depends on {second}" },
    link: { first: "from", second: "to", template: "{first} is linked to {second}" },
  });

  // Two-headed relations (markerAt "both") carry the same code at each end,
  // so no end is the parent and the directed templates above cannot be used.
  const SYMMETRIC_TEMPLATES = Object.freeze({
    inheritance: "{a} and {b} inherit from each other",
    realisation: "{a} and {b} implement each other",
    composition: "{a} and {b} are composed of each other",
    aggregation: "{a} and {b} aggregate each other",
    association: "{a} and {b} are associated both ways",
    link: "{a} and {b} are linked",
  });

  /**
   * Render Mermaid's tilde generic syntax as prose: List~int~ becomes
   * "List of int", Rack~Item~ becomes "Rack of Item".
   *
   * Applied to every name, declaration, parameter list and return type,
   * because the adapter hands these over in their tilde form (stage 0 C6) —
   * the HTML-escaped `text` field, which Mermaid renders from, is
   * deliberately never read.
   *
   * @param {string} value - A name or signature fragment
   * @returns {string} The same text with generics spoken
   */
  function convertGenerics(value) {
    return String(value === undefined || value === null ? "" : value).replace(
      /~([^~]+)~/g,
      " of $1"
    );
  }

  /**
   * The narrated name of one class: its display name, generics spoken, with
   * the class-level generic parameter appended when it has one.
   * @param {Object} cls - An adapter class object
   * @returns {string} e.g. "Rack of Item"
   */
  function classDisplayName(cls) {
    const base = convertGenerics(cls.displayName);
    return cls.genericType ? `${base} of ${convertGenerics(cls.genericType)}` : base;
  }

  /**
   * The visibility and classifier prefix shared by attributes and methods.
   * Either part is omitted when absent rather than filled with a guess.
   * @param {Object} entry - An adapter member or method
   * @returns {string} e.g. "public abstract " or ""
   */
  function memberPrefix(entry) {
    const parts = [];

    const visibility = VISIBILITY_WORDS[entry.visibility];
    if (visibility) {
      parts.push(visibility);
    }

    const classifier = CLASSIFIER_WORDS[entry.classifier];
    if (classifier) {
      parts.push(classifier);
    }

    return parts.length ? `${parts.join(" ")} ` : "";
  }

  /**
   * The multiplicity clause fragment for one end: the phrase, the class name
   * verbatim, and the generator's noun in the number the phrase calls for.
   * The author's name is never inflected.
   * @param {string} multiplicity - The raw multiplicity string
   * @param {string} name - The other class's narrated name
   * @returns {string} e.g. "zero or more Wheel instances"
   */
  function multiplicityClause(multiplicity, name) {
    const spec = MULTIPLICITY_PHRASES[multiplicity];
    if (!spec) {
      // An unrecognised multiplicity is spoken as written; the plural noun is
      // the safer default, since bare "1" is the only spelling that is
      // certainly singular and it is already in the map. The risk that made
      // that choice awkward is gone — the plural now lands on our own noun.
      return `${Common.escapeHtml(multiplicity)} ${Common.escapeHtml(name)} ${CLASS_NOUN.plural}`;
    }
    // The name is author text and is escaped; the noun is generator furniture
    // and is never escaped separately.
    const noun = spec.plural ? CLASS_NOUN.plural : CLASS_NOUN.singular;
    return `${spec.phrase} ${Common.escapeHtml(name)} ${noun}`;
  }

  /**
   * Render one attribute as a list item.
   * @param {Object} member - An adapter member {visibility, classifier, declaration}
   * @returns {string} An <li> fragment
   */
  function renderMemberItem(member) {
    // memberPrefix is furniture (word lookups); the declaration is author
    // text, so generics are spoken first and the result is escaped.
    return `<li>${memberPrefix(member)}${Common.escapeHtml(convertGenerics(member.declaration))}.</li>`;
  }

  /**
   * Render one method as a list item.
   * @param {Object} method - An adapter method
   * @returns {string} An <li> fragment
   */
  function renderMethodItem(method) {
    // The parentheses and " returns " are furniture; the three author-text
    // parts are each transformed, then escaped as they enter the string.
    const signature = `${Common.escapeHtml(convertGenerics(method.name))}(${Common.escapeHtml(convertGenerics(method.parameters))})`;
    const returns = method.returnType
      ? ` returns ${Common.escapeHtml(convertGenerics(method.returnType))}`
      : "";
    return `<li>${memberPrefix(method)}${signature}${returns}.</li>`;
  }

  /**
   * Render one class as a list item, with its members nested beneath it.
   * @param {Object} cls - An adapter class object
   * @returns {string} An <li> fragment, possibly multi-line
   */
  function renderClassItem(cls) {
    const members = cls.members || [];
    const methods = cls.methods || [];
    const annotations = cls.annotations || [];

    // Both halves are author text; the parentheses and separator are not.
    const heading =
      Common.escapeHtml(classDisplayName(cls)) +
      (annotations.length
        ? ` (${annotations.map((a) => Common.escapeHtml(a)).join(", ")})`
        : "");

    const attributePhrase = `${Common.narrationNumber(members.length)} attribute${members.length === 1 ? "" : "s"}`;
    const methodPhrase = `${Common.narrationNumber(methods.length)} method${methods.length === 1 ? "" : "s"}`;

    let summary;
    if (members.length && methods.length) {
      summary = `${attributePhrase} and ${methodPhrase}.`;
    } else if (members.length) {
      summary = `${attributePhrase}.`;
    } else if (methods.length) {
      summary = `${methodPhrase}.`;
    } else {
      return `<li>${heading}: no attributes or methods listed.</li>`;
    }

    // Newlines between elements keep text-content extraction readable:
    // without them, list boundaries concatenate with no space.
    return [
      `<li>${heading}: ${summary}`,
      `<ul class="class-members">`,
      ...members.map(renderMemberItem),
      ...methods.map(renderMethodItem),
      `</ul>`,
      `</li>`,
    ].join("\n");
  }

  /**
   * Recover the names a lollipop relation loses.
   *
   * A lollipop rewrites one endpoint to a synthesised id (`interface0`) and
   * removes the class named in the source from getClasses() entirely (stage
   * 0 C3) — but the name survives in getData().nodes as that node's label
   * (stage 1 probe B).
   *
   * getData() DECORATES the objects it walks (stage 0 M2e), so this runs on
   * its OWN parse of the same source: the graph being narrated is never the
   * graph getData() touched. A fresh db per parse is measured (M2f), so the
   * two cannot interfere. Called only when a lollipop is actually present.
   *
   * Never throws: an unrecoverable name degrades to the unnamed wording.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Map<string, string>>} Synthesised id to label
   */
  async function recoverInterfaceNames(code) {
    const names = new Map();

    try {
      const diagram = await window.mermaid.mermaidAPI.getDiagramFromText(code);
      const data = diagram.db.getData();
      for (const node of (data && data.nodes) || []) {
        if (node && typeof node.id === "string" && typeof node.label === "string") {
          names.set(node.id, node.label);
        }
      }
    } catch (error) {
      logWarn(
        "recoverInterfaceNames",
        `Could not recover lollipop interface names: ${error && error.message}`
      );
    }

    return names;
  }

  /**
   * Render one relationship as a list item.
   * @param {Object} relationship - An adapter relationship
   * @param {Map<string, string>} displayNames - Class name to narrated name
   * @param {Map<string, string>} interfaceNames - Synthesised id to label
   * @returns {string} An <li> fragment
   */
  function renderRelationshipItem(relationship, displayNames, interfaceNames) {
    // An endpoint may not resolve — the lollipop case is measured and
    // legitimate — so the raw id is the fallback rather than an error.
    const fromName =
      displayNames.get(relationship.from) || relationship.from;
    const toName = displayNames.get(relationship.to) || relationship.to;
    const isSelf = relationship.from === relationship.to;

    // fromName/toName stay RAW for multiplicityClause, which escapes the name
    // itself. Everything entering the sentence uses these.
    const safeFrom = Common.escapeHtml(fromName);
    const safeTo = Common.escapeHtml(toName);

    // The marker end is the parent, whole, aggregate or target (C2).
    const markerName = relationship.markerAt === "to" ? safeTo : safeFrom;
    const otherName = relationship.markerAt === "to" ? safeFrom : safeTo;

    let sentence;

    if (relationship.kind === "lollipop") {
      // The marker end is the synthesised interface; the far end is the
      // real class that provides it.
      const markerId =
        relationship.markerAt === "to" ? relationship.to : relationship.from;
      const interfaceName = interfaceNames.get(markerId);
      sentence = interfaceName
        ? `${otherName} provides the interface ${Common.escapeHtml(convertGenerics(interfaceName))}`
        : `${otherName} provides an interface`;
    } else if (relationship.markerAt === "both") {
      const template =
        SYMMETRIC_TEMPLATES[relationship.kind] || SYMMETRIC_TEMPLATES.link;
      sentence = template
        .replace("{a}", safeFrom)
        .replace("{b}", isSelf ? "itself" : safeTo);
    } else {
      const spec = RELATION_TEMPLATES[relationship.kind] || RELATION_TEMPLATES.link;
      const slot = (which) => {
        if (which === "marker") return markerName;
        if (which === "other") return otherName;
        return which === "from" ? safeFrom : safeTo;
      };
      sentence = spec.template
        .replace("{first}", slot(spec.first))
        .replace("{second}", isSelf ? "itself" : slot(spec.second));
    }

    let text = `${sentence}.`;

    if (relationship.label) {
      // The quotation marks are furniture; only the label is escaped.
      text += ` Labelled "${Common.escapeHtml(relationship.label)}".`;
    }

    // Multiplicities read as a clause pair, because one end alone never
    // states the whole relationship. Where only one end carries a
    // multiplicity, only that clause is spoken.
    const hasFrom = Boolean(relationship.multiplicityFrom);
    const hasTo = Boolean(relationship.multiplicityTo);
    if (hasFrom && hasTo) {
      text +=
        ` Each ${safeFrom} relates to ${multiplicityClause(relationship.multiplicityTo, toName)};` +
        ` each ${safeTo} relates to ${multiplicityClause(relationship.multiplicityFrom, fromName)}.`;
    } else if (hasTo) {
      text += ` Each ${safeFrom} relates to ${multiplicityClause(relationship.multiplicityTo, toName)}.`;
    } else if (hasFrom) {
      text += ` Each ${safeTo} relates to ${multiplicityClause(relationship.multiplicityFrom, fromName)}.`;
    }

    return `<li>${text}</li>`;
  }

  /**
   * Generate a short description for a class diagram.
   *
   * A parse rejection is deliberately NOT caught here — the core's catch
   * turns it into the honest generation-failed fallback. A failed adapter
   * self-check throws for the same reason: never narrate an unverified graph.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to an object with HTML and plain text versions of the description
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const graph = await window.MermaidParseAdapter.parseClass(code);
    if (window.MermaidParseAdapter.isClassHealthy() === false) {
      throw new Error(
        "Parse adapter failed its class self-check; refusing to narrate an unverified graph"
      );
    }

    const classCount = graph.classes.length;
    const relationshipCount = graph.relationships.length;
    logDebug("Counts", `${classCount} classes, ${relationshipCount} relationships`);

    const classPhrase = `${classCount} ${classCount === 1 ? "class" : "classes"}`;
    const description =
      relationshipCount === 0
        ? `A class diagram with ${classPhrase} and no relationships.`
        : `A class diagram with ${classPhrase} and ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}.`;

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
   * Generate a detailed description for a class diagram.
   *
   * One section: an Overview paragraph, the Classes list in the diagram's
   * own first-mention order (stage 0 C13), the Relationships list in source
   * order with duplicates narrated separately (C11), then Namespaces and
   * Notes where they exist. A parse rejection or a failed adapter self-check
   * propagates; the core's catch produces the honest generation-failed
   * statement. Never catch and narrate anyway.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating class description");

    const graph = await window.MermaidParseAdapter.parseClass(code);
    if (window.MermaidParseAdapter.isClassHealthy() === false) {
      throw new Error(
        "Parse adapter failed its class self-check; refusing to narrate an unverified graph"
      );
    }

    const classCount = graph.classes.length;
    const relationshipCount = graph.relationships.length;

    // Relationship endpoints are raw class ids; narration uses display
    // names, which differ wherever a bracket label or a generic was declared.
    const displayNames = new Map(
      graph.classes.map((cls) => [cls.name, classDisplayName(cls)])
    );

    // Only pay for the extra parse when a lollipop is actually present.
    const hasLollipop = graph.relationships.some((r) => r.kind === "lollipop");
    const interfaceNames = hasLollipop
      ? await recoverInterfaceNames(code)
      : new Map();

    // --- Overview -------------------------------------------------------
    const sentences = [];

    const classPhrase = `${classCount} ${classCount === 1 ? "class" : "classes"}`;
    sentences.push(
      relationshipCount === 0
        ? `This class diagram contains ${classPhrase} and no relationships.`
        : `This class diagram contains ${classPhrase} connected by ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}.`
    );

    // A class outside every relationship is worth flagging — but only when
    // there are relationships to stand outside of.
    if (relationshipCount > 0) {
      const connected = new Set();
      for (const relationship of graph.relationships) {
        connected.add(relationship.from);
        connected.add(relationship.to);
      }

      const unconnected = graph.classes.filter(
        (cls) => !connected.has(cls.name)
      );

      if (unconnected.length > 0) {
        const countWord = Common.capitalize(
          Common.narrationNumber(unconnected.length)
        );
        const noun = unconnected.length === 1 ? "class" : "classes";
        const verb = unconnected.length === 1 ? "is" : "are";
        // Plain display names here, without the generic decoration used in
        // the Classes list: this is a roll-call, not a declaration.
        const names = Common.formatList(
          unconnected.map((cls) =>
            Common.escapeHtml(convertGenerics(cls.displayName))
          )
        );
        sentences.push(
          `${countWord} ${noun}, ${names}, ${verb} not part of any relationship.`
        );
      }
    }

    if (graph.namespaces.length > 0) {
      sentences.push(
        `The classes are organised into ${Common.narrationNumber(graph.namespaces.length)} namespace${graph.namespaces.length === 1 ? "" : "s"}, described below.`
      );
    }

    if (graph.notes.length > 0) {
      sentences.push(
        `The diagram also includes ${Common.narrationNumber(graph.notes.length)} note${graph.notes.length === 1 ? "" : "s"}, listed below.`
      );
    }

    // --- Assembly -------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);

    if (classCount > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Classes</h4>`);
      parts.push(`<ul class="class-list">`);
      for (const cls of graph.classes) {
        parts.push(renderClassItem(cls));
      }
      parts.push(`</ul>`);
    }

    if (relationshipCount > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Relationships</h4>`);
      parts.push(`<ul class="class-relationships">`);
      for (const relationship of graph.relationships) {
        parts.push(
          renderRelationshipItem(relationship, displayNames, interfaceNames)
        );
      }
      parts.push(`</ul>`);
    }

    if (graph.namespaces.length > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Namespaces</h4>`);
      parts.push(`<ul class="class-namespaces">`);
      for (const namespace of graph.namespaces) {
        parts.push(
          `<li>${Common.escapeHtml(namespace.name)}: contains ${Common.formatList(namespace.classNames.map((n) => Common.escapeHtml(n)))}.</li>`
        );
      }
      parts.push(`</ul>`);
    }

    if (graph.notes.length > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Notes</h4>`);
      parts.push(`<ul class="class-notes">`);
      for (const note of graph.notes) {
        if (note.attachedTo) {
          // The attachment may name a class that does not exist (C10), so
          // the raw id stands in rather than the lookup failing.
          const target = displayNames.get(note.attachedTo) || note.attachedTo;
          parts.push(
            `<li>A note on ${Common.escapeHtml(target)} reads: ${Common.escapeHtml(note.text)}.</li>`
          );
        } else {
          parts.push(
            `<li>A note reads: ${Common.escapeHtml(note.text)}.</li>`
          );
        }
      }
      parts.push(`</ul>`);
    }

    parts.push(`</section>`);

    // Newline-joined for the same text-extraction reason as the list items.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption — the {html, text} object is the tier's own return shape,
  // reached through this wrapper exactly as the ER and flowchart modules do.
  window.MermaidAccessibility.registerDescriptionGenerator("classDiagram", {
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
    "Class Diagram Module",
    "Class diagram module loaded and registered on the parse adapter's class surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = ClassDiagramModule;
} else {
  window.ClassDiagramModule = ClassDiagramModule;
}
