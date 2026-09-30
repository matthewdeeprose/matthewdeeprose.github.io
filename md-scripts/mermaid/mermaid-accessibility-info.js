/**
 * Mermaid Accessibility - Info Panel Module
 *
 * Generates accessible descriptions for `info` diagrams. The twentieth
 * description generator. Register item 96.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-info-gold-targets-2026-09-30.md - rules IN1 to IN4 and the
 * seat's rulings IS1 to IS5 (VERSION 1) - and its one byte-exact target plus
 * one ruled edge. A mismatch between this module's output and the target is a
 * STOP that goes back to the design seat; it is never a reason to edit the
 * target or a fixture.
 *
 * WHAT THE PICTURE IS. An info diagram draws exactly one SVG text, class
 * "version", reading "v" followed by the Mermaid version, and nothing the
 * author can write changes a drawn byte (census Q3). So the description has
 * one fact to report.
 *
 * THE ONE READ IS THE RENDERED SVG, NOT THE db - ruling IS1, route (c). The
 * census (docs/mermaid-item-96-census-1-2026-09-30.md § Q4) proved by
 * disable-and-remeasure that the canvas does NOT draw from the info db's
 * `getVersion()`: patching that getter moved the db reading and left the
 * picture unchanged. Reading the drawn `text.version` of the SVG every
 * generator is already handed describes exactly what the picture shows, and
 * takes no parse and no queue slot. There is no shared-store read here, so no
 * adapter surface, no concurrency lane and no field-manifest rows: sankey's
 * "immune by rejection" precedent.
 *
 * IF THE TEXT IS ABSENT OR EMPTY WHEN THE GENERATOR RUNS, IT THROWS, and the
 * core routes the throw to its generation-failed fallback. A reader is told
 * plainly that no description could be generated, never an invented version.
 *
 * NO AUTHOR TEXT IS NARRATED (IN3, IN4, IS5). `showInfo`, a body `title`,
 * `accTitle`, `accDescr`, frontmatter and comments are accepted by the grammar
 * and draw nothing. The core's clause X3 route still carries the author's own
 * accTitle and accDescr to the reader, above this module's output.
 *
 * THE VERSION IS ESCAPED ONCE, AT ENTRY TO THE DETAILED (IS3). The PLAIN short
 * takes it verbatim, because it reaches text sinks; the HTML short is derived
 * as escapeHtml(plain short), so the two short tiers cannot disagree.
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

  /**
   * The shared prose layer (escapeHtml), resolved AT CALL TIME and never
   * cached, on the kanban and radar precedent: a module-scope capture would
   * hold `undefined` permanently if this file ever lost the load race.
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  // ---------------------------------------------------------------------
  // The vocabulary, closed and frozen
  // ---------------------------------------------------------------------

  /** The one drawn element this module reads, by the renderer's own class. */
  const VERSION_TEXT_SELECTOR = "text.version";

  /**
   * The prefix the renderer's template writes, `v${version}`. Stripped for
   * narration; a drawn text without it is narrated as drawn (IN2).
   */
  const DRAWN_VERSION_PREFIX = "v";

  // ---------------------------------------------------------------------
  // The one read
  // ---------------------------------------------------------------------

  /**
   * Read the version the picture draws - ruling IS1, route (c).
   *
   * Throws when the SVG is missing, when it carries no `text.version`, or when
   * that text is empty. A version reduced to nothing by stripping the prefix is
   * empty as well: narrating "Mermaid version ." would be a sentence about a
   * picture nobody is looking at.
   *
   * @param {Element|null} svgElement - The rendered SVG the core hands over
   * @returns {string} The version, without its drawn leading "v"
   */
  function readDrawnVersion(svgElement) {
    const textElement =
      svgElement && typeof svgElement.querySelector === "function"
        ? svgElement.querySelector(VERSION_TEXT_SELECTOR)
        : null;

    if (!textElement) {
      logWarn(
        "[Mermaid Accessibility] Info panel: no drawn version text; refusing to narrate"
      );
      throw new Error(
        "Info panel draws no version text; refusing to narrate an undrawn version"
      );
    }

    const drawn = textElement.textContent || "";
    const version = drawn.startsWith(DRAWN_VERSION_PREFIX)
      ? drawn.slice(DRAWN_VERSION_PREFIX.length)
      : drawn;

    if (version.trim() === "") {
      logWarn(
        "[Mermaid Accessibility] Info panel: the drawn version text is empty; refusing to narrate"
      );
      throw new Error(
        "Info panel version text is empty; refusing to narrate an undrawn version"
      );
    }

    logDebug(`[Mermaid Accessibility] Info panel drawn version: ${version}`);
    return version;
  }

  // ---------------------------------------------------------------------
  // The tiers
  // ---------------------------------------------------------------------

  /**
   * The plain short tier - rule IN1. Never escaped: it reaches the figcaption's
   * text sink and the SVG's `aria-label`, where an entity would be announced
   * literally.
   * @param {Element|null} svgElement - The rendered SVG
   * @returns {string} The plain short description
   */
  function generateShortDescription(svgElement) {
    logInfo("[Mermaid Accessibility] Generating info panel short description");
    const version = readDrawnVersion(svgElement);
    return `A Mermaid information panel showing Mermaid version ${version}.`;
  }

  /**
   * The HTML short tier - DERIVED as escapeHtml(plain short), ruling IS3, so
   * the two short tiers cannot say different things.
   * @param {Element|null} svgElement - The rendered SVG
   * @returns {string} The escaped short description
   */
  function generateShortHTML(svgElement) {
    return common().escapeHtml(generateShortDescription(svgElement));
  }

  /**
   * The detailed tier - rule IN2. The version is escaped once, at entry; the
   * generator's own furniture is never escaped.
   * @param {Element|null} svgElement - The rendered SVG
   * @returns {string} The detailed HTML fragment
   */
  function generateDetailedDescription(svgElement) {
    logInfo(
      "[Mermaid Accessibility] Generating info panel detailed description"
    );
    const version = common().escapeHtml(readDrawnVersion(svgElement));
    return (
      "<h4>Overview</h4>" +
      `<p>This Mermaid information panel draws one line of text, the Mermaid version ${version}, and nothing else.</p>`
    );
  }

  // Register with the core module.
  //
  // THE KEY IS "info", AND THE DETECTOR ROW THAT ROUTES TO IT LANDS IN THE SAME
  // CHANGE AS THIS FILE'S SCRIPT TAG. Without the MERMAID_TYPE_TO_KEY row an
  // info source resolves to `unsupported:info` and this generator registers
  // and is never called.
  //
  // SYNCHRONOUS ON PURPOSE. Every caller was read before choosing: the core's
  // getDiagramDescriptions awaits all three tiers inside one try/catch, the
  // panel builder in mermaid-accessibility-utils.js accepts a plain value or a
  // thenable from generateShortHTML inside its own try/catch, and the harness
  // CAPTURE awaits each tier in its own try/catch. A synchronous throw reaches
  // the generation-failed fallback on every one of them, and there is nothing
  // here to await.
  window.MermaidAccessibility.registerDescriptionGenerator("info", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: generateShortHTML,
  });

  logInfo(
    "[Mermaid Accessibility] Info panel module loaded and registered; it reads the drawn version text"
  );
})();
