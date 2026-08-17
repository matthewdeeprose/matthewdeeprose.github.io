/**
 * Mermaid Accessibility - Entity Relationship Module
 *
 * Generates accessible descriptions for entity relationship diagrams from the
 * shared parse adapter's ER surface (mermaid-parse-adapter.js), never from the
 * SVG or a source-text scan. Stage 2 of the ER work: before this module
 * existed, ER diagrams received the core's honest "no description available"
 * fallback.
 *
 * The crossed cardinality convention is already resolved by the adapter —
 * `toPerFrom` is how many `to` entities each `from` entity has, `fromPerTo`
 * the reverse — so nothing here reads Mermaid's cardA/cardB. See
 * docs/mermaid-er-stage0-measurements-2026-08-02.md § M3 E1-E3 and the JSDoc
 * on normaliseEr.
 */
const EntityRelationshipModule = (function () {
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
      console.error(`[ER][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[ER][ERROR][${context}] ${message}`);
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
      console.warn(`[ER][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[ER][WARN][${context}] ${message}`);
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
      console.log(`[ER][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[ER][INFO][${context}] ${message}`);
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
      console.log(`[ER][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[ER][DEBUG][${context}] ${message}`);
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

  // Cardinality narration. `plural` says which number the generator's own
  // noun takes: "exactly one ORDER record" but "zero or more ORDER records".
  // The author's entity name is never inflected (register item 26, decided
  // 12 August 2026) — author text is data, and the words around it are ours.
  // Four enums are reachable from ER source (stage 0 E3); the fifth,
  // MD_PARENT, is declared by Mermaid but was never produced by any probe
  // (M2a), so the defensive arm below is what would narrate it.
  const CARDINALITY_PHRASES = Object.freeze({
    ZERO_OR_ONE: { phrase: "zero or one", plural: false },
    ONLY_ONE: { phrase: "exactly one", plural: false },
    ZERO_OR_MORE: { phrase: "zero or more", plural: true },
    ONE_OR_MORE: { phrase: "one or more", plural: true },
  });

  const UNSPECIFIED_CARDINALITY = Object.freeze({
    phrase: "an unspecified number of",
    plural: true,
  });

  // The noun the plural attaches to, so the author's name never has to carry
  // it. ER narrates entity instances as records.
  const ENTITY_NOUN = Object.freeze({ singular: "record", plural: "records" });

  // Attribute key abbreviations, expanded for narration. Anything else is
  // spoken verbatim rather than guessed at.
  const KEY_PHRASES = Object.freeze({
    PK: "primary key",
    FK: "foreign key",
    UK: "unique key",
  });

  // Identifying relationships are the ER default and are never mentioned;
  // only the non-identifying case earns a sentence.
  const NON_IDENTIFYING = "NON_IDENTIFYING";

  /**
   * The cardinality clause for one end of a relationship: the phrase, the
   * entity name verbatim, and the generator's noun in the number the phrase
   * calls for. The author's name is never inflected.
   * @param {string} cardinality - A Mermaid cardinality enum value
   * @param {string} name - The other entity's display name
   * @returns {string} e.g. "zero or more ORDER records"
   */
  function cardinalityClause(cardinality, name) {
    const spec = CARDINALITY_PHRASES[cardinality] || UNSPECIFIED_CARDINALITY;
    if (!CARDINALITY_PHRASES[cardinality]) {
      logWarn(
        "cardinalityClause",
        `Unrecognised cardinality "${cardinality}"; narrating it as unspecified`
      );
    }
    // The name is author text and is escaped; the noun is generator furniture
    // and is never escaped separately.
    const noun = spec.plural ? ENTITY_NOUN.plural : ENTITY_NOUN.singular;
    return `${spec.phrase} ${Common.escapeHtml(name)} ${noun}`;
  }

  /**
   * Render one attribute as a list item.
   * @param {Object} attribute - An adapter attribute {type, name, keys, comment}
   * @returns {string} An <li> fragment
   */
  function renderAttributeItem(attribute) {
    let sentence = `${Common.escapeHtml(attribute.name)}: ${Common.escapeHtml(attribute.type)}.`;

    if (Array.isArray(attribute.keys) && attribute.keys.length > 0) {
      // KEY_PHRASES values are furniture; only the unrecognised-key fallback
      // is author text, so only that arm is escaped.
      const phrases = attribute.keys.map(
        (key) => KEY_PHRASES[key] || Common.escapeHtml(key)
      );
      sentence += ` ${Common.capitalize(Common.formatList(phrases))}.`;
    }

    if (attribute.comment) {
      sentence += ` Comment: ${Common.escapeHtml(attribute.comment)}.`;
    }

    return `<li>${sentence}</li>`;
  }

  /**
   * Render one entity as a list item, with its attributes nested beneath it.
   * @param {Object} entity - An adapter entity {name, displayName, attributes}
   * @returns {string} An <li> fragment, possibly multi-line
   */
  function renderEntityItem(entity) {
    const attributes = entity.attributes || [];

    const safeName = Common.escapeHtml(entity.displayName);

    if (attributes.length === 0) {
      return `<li>${safeName}: no attributes listed.</li>`;
    }

    const countWord = Common.narrationNumber(attributes.length);
    const noun = attributes.length === 1 ? "attribute" : "attributes";

    // Newlines between elements keep text-content extraction readable:
    // without them, list boundaries concatenate with no space.
    return [
      `<li>${safeName}: ${countWord} ${noun}.`,
      `<ul class="er-attributes">`,
      ...attributes.map(renderAttributeItem),
      `</ul>`,
      `</li>`,
    ].join("\n");
  }

  /**
   * Render one relationship as a list item.
   *
   * Two clauses, one per direction, because a single cardinality never states
   * the whole relationship. The forward clause uses `toPerFrom` and the
   * reverse uses `fromPerTo` — the adapter has already un-crossed Mermaid's
   * cardA/cardB, so both read the way they are named. Direction (TB, LR) is
   * never narrated: it is a layout property, not a fact about the data.
   *
   * @param {Object} relationship - An adapter relationship
   * @param {Map<string, string>} displayNames - Entity name to display name
   * @returns {string} An <li> fragment
   */
  function renderRelationshipItem(relationship, displayNames) {
    const fromName =
      displayNames.get(relationship.from) || relationship.from;
    const toName = displayNames.get(relationship.to) || relationship.to;

    // cardinalityClause is handed the RAW names — it escapes the name itself.
    // These two are for the direct interpolations only.
    const safeFrom = Common.escapeHtml(fromName);
    const safeTo = Common.escapeHtml(toName);

    // An empty role is legal — an empty quoted label parses (stage 0 E6) —
    // so the neutral verb carries the sentence when there is no verb to use.
    const forward = relationship.role
      ? `each ${safeFrom} ${Common.escapeHtml(relationship.role)} ${cardinalityClause(relationship.toPerFrom, toName)}`
      : `each ${safeFrom} is linked to ${cardinalityClause(relationship.toPerFrom, toName)}`;

    const reverse = `each ${safeTo} is linked to ${cardinalityClause(relationship.fromPerTo, fromName)}`;

    // A self-relationship is announced, because "each EMPLOYEE ... each
    // EMPLOYEE" otherwise reads as two different entities.
    let sentence =
      relationship.from === relationship.to
        ? `A self-relationship: ${forward}; ${reverse}.`
        : `${Common.capitalize(forward)}; ${reverse}.`;

    if (relationship.relType === NON_IDENTIFYING) {
      sentence += " This relationship is non-identifying.";
    }

    return `<li>${sentence}</li>`;
  }

  /**
   * Generate a short description for an entity relationship diagram.
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

    const graph = await window.MermaidParseAdapter.parseEr(code);
    if (window.MermaidParseAdapter.isErHealthy() === false) {
      throw new Error(
        "Parse adapter failed its ER self-check; refusing to narrate an unverified graph"
      );
    }

    const entityCount = graph.entities.length;
    const relationshipCount = graph.relationships.length;
    logDebug("Counts", `${entityCount} entities, ${relationshipCount} relationships`);

    const entityPhrase = `${entityCount} ${entityCount === 1 ? "entity" : "entities"}`;
    const description =
      relationshipCount === 0
        ? `An entity relationship diagram with ${entityPhrase} and no relationships.`
        : `An entity relationship diagram with ${entityPhrase} and ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}.`;

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
   * Generate a detailed description for an entity relationship diagram.
   *
   * One section: an Overview paragraph, the Entities list in the diagram's
   * own first-mention order (stage 0 E11), and the Relationships list in
   * source order with duplicates narrated separately (E9). A parse rejection
   * or a failed adapter self-check propagates; the core's catch produces the
   * honest generation-failed statement. Never catch and narrate anyway.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating ER description");

    const graph = await window.MermaidParseAdapter.parseEr(code);
    if (window.MermaidParseAdapter.isErHealthy() === false) {
      throw new Error(
        "Parse adapter failed its ER self-check; refusing to narrate an unverified graph"
      );
    }

    const entityCount = graph.entities.length;
    const relationshipCount = graph.relationships.length;

    // Endpoints are entity names; the narration uses display names, which
    // differ wherever an alias was declared (stage 0 E5).
    const displayNames = new Map(
      graph.entities.map((entity) => [entity.name, entity.displayName])
    );

    // --- Overview -------------------------------------------------------
    const sentences = [];

    const entityPhrase = `${entityCount} ${entityCount === 1 ? "entity" : "entities"}`;
    sentences.push(
      relationshipCount === 0
        ? `This entity relationship diagram contains ${entityPhrase} and no relationships.`
        : `This entity relationship diagram contains ${entityPhrase} connected by ${relationshipCount} ${relationshipCount === 1 ? "relationship" : "relationships"}.`
    );

    // An entity outside every relationship is worth flagging — but only when
    // there are relationships to stand outside of.
    if (relationshipCount > 0) {
      const connected = new Set();
      for (const relationship of graph.relationships) {
        connected.add(relationship.from);
        connected.add(relationship.to);
      }

      const unconnected = graph.entities.filter(
        (entity) => !connected.has(entity.name)
      );

      if (unconnected.length > 0) {
        const countWord = Common.capitalize(
          Common.narrationNumber(unconnected.length)
        );
        const noun = unconnected.length === 1 ? "entity" : "entities";
        const verb = unconnected.length === 1 ? "is" : "are";
        const names = Common.formatList(
          unconnected.map((entity) => Common.escapeHtml(entity.displayName))
        );
        sentences.push(
          `${countWord} ${noun}, ${names}, ${verb} not part of any relationship.`
        );
      }
    }

    // --- Assembly -------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);

    if (entityCount > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Entities</h4>`);
      parts.push(`<ul class="er-entities">`);
      for (const entity of graph.entities) {
        parts.push(renderEntityItem(entity));
      }
      parts.push(`</ul>`);
    }

    if (relationshipCount > 0) {
      parts.push(`<h4 class="mermaid-details-heading">Relationships</h4>`);
      parts.push(`<ul class="er-relationships">`);
      for (const relationship of graph.relationships) {
        parts.push(renderRelationshipItem(relationship, displayNames));
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
  // reached through this wrapper exactly as the flowchart module does.
  window.MermaidAccessibility.registerDescriptionGenerator(
    "entityRelationshipDiagram",
    {
      generateShort: shortDescriptionWrapper,
      generateDetailed: generateDetailedDescription,
    }
  );

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
    "Entity Relationship Module",
    "Entity relationship module loaded and registered on the parse adapter's ER surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = EntityRelationshipModule;
} else {
  window.EntityRelationshipModule = EntityRelationshipModule;
}
