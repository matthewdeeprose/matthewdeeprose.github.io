/**
 * @file mathpix-context-ai.js
 * @module MathPixContextAI
 * @description
 * Phase 2 Stage 1 — Context auto-fill: pure prompt/parse/coerce logic.
 *
 * Three side-effect-free functions that bridge the MathPix Context tab schema
 * (owned by {@link MathPixContextManager}) and an LLM round-trip:
 *
 *   - `buildPrompt(mmd, schema)`  — assemble the system + user prompt pair that
 *     asks a model to propose education-metadata values for one document.
 *   - `parseResponse(text, schema)` — recover each field's value from the model's
 *     labelled-block reply, tolerant of surrounding prose and truncation.
 *   - `coerceSelects(obj, schema)` — normalise the two restricted-vocabulary
 *     fields (audienceLevel, documentType) onto canonical option values.
 *
 * NO DOM, NO network, NO embed instance lives here. The transport and wiring
 * arrive in later parcels; this module is the testable core they call. Every
 * function is pure: same inputs → same outputs, and none mutates its arguments.
 *
 * @see mathpix-scripts/core/mathpix-context-manager.js (the schema owner)
 * @see mathpix-scripts/docs/alt-text/phase-2-stage-1-implementation-plan.md
 */

const MathPixContextAI = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[MathPixContextAI] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixContextAI] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixContextAI] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixContextAI] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // The two restricted-vocabulary fields. These — and only these — carry a
  // fixed `options` list in the schema, so they are the only fields buildPrompt
  // constrains and the only ones coerceSelects normalises.
  // ---------------------------------------------------------------------------

  const SELECT_KEYS = ["audienceLevel", "documentType"];

  // ---------------------------------------------------------------------------
  // Internal helpers (pure)
  // ---------------------------------------------------------------------------

  /**
   * The schema field for a key, or null. Tolerant of a missing / malformed
   * schema so the public functions never throw on bad input.
   * @param {Array<Object>} fields
   * @param {string} key
   * @returns {Object|null}
   */
  function findField(fields, key) {
    if (!Array.isArray(fields)) return null;
    return fields.find((field) => field && field.key === key) || null;
  }

  /**
   * The {value, label} option list for a select field, or []. Always an array.
   * @param {Array<Object>} fields
   * @param {string} key
   * @returns {Array<{value: string, label: string}>}
   */
  function optionsFor(fields, key) {
    const field = findField(fields, key);
    return field && Array.isArray(field.options) ? field.options : [];
  }

  // ---------------------------------------------------------------------------
  // buildPrompt — assemble { systemPrompt, userPrompt }
  // ---------------------------------------------------------------------------

  /**
   * Build the system + user prompt pair for the context auto-fill round-trip.
   *
   * The system prompt sets the task: read the document and propose values for
   * the listed education-metadata fields, grounded strictly in the source. The
   * user prompt folds the MMD into a fenced block and instructs the model to
   * return ONLY labelled blocks — one `<KEY>value</KEY>` per schema key — to
   * leave a block empty when the value is unknown, and to use one of the listed
   * allowed values for the two restricted selects.
   *
   * Pure: no DOM, no network. `mmd` and `schema` are read, never mutated.
   *
   * @param {string} mmd — the document in Mathpix Markdown form.
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  function buildPrompt(mmd, schema) {
    const fields = Array.isArray(schema) ? schema : [];
    const mmdText = typeof mmd === "string" ? mmd : "";

    if (!Array.isArray(schema)) {
      logWarn("buildPrompt called without an array schema; using no fields.");
    }

    // One bullet per field — the camelCase tag the model must emit, plus the
    // human label so it understands what each field means.
    const fieldList = fields
      .filter((field) => field && typeof field.key === "string")
      .map((field) => `- <${field.key}> — ${field.label || field.key}`)
      .join("\n");

    // Allowed-value lists for the two restricted selects, drawn live from the
    // schema (audienceLevel from the config projection, documentType fixed).
    function allowedValues(key) {
      return optionsFor(fields, key)
        .map((option) => `${option.value} (${option.label})`)
        .join(", ");
    }
    const audienceValues = allowedValues("audienceLevel");
    const documentValues = allowedValues("documentType");

    // The empty-block skeleton the model fills in — one block per field.
    const blockTemplate = fields
      .filter((field) => field && typeof field.key === "string")
      .map((field) => `<${field.key}></${field.key}>`)
      .join("\n");

    const systemPrompt =
      "You are an expert academic-document analyst working within a UK " +
      "higher-education accessibility tool. You are given a document in Mathpix " +
      "Markdown (MMD) form. Your task is to read the document and propose values " +
      "for a fixed set of education-metadata fields that describe it — its " +
      "subject area, specific topic, intended audience, document type, and " +
      "similar descriptive metadata. Base every proposed value strictly on " +
      "evidence within the document. Where the document does not support a " +
      "confident value, leave that field empty rather than guessing. Never " +
      "invent module names, module codes, or any detail not present in the " +
      "source. Use British spelling throughout.";

    const userPrompt =
      "Read the document below and propose values for these education-metadata " +
      "fields:\n\n" +
      fieldList +
      "\n\nTwo fields are restricted to a fixed list of allowed values.\n" +
      "For <audienceLevel>, the value must be exactly one of: " +
      audienceValues +
      ".\nFor <documentType>, the value must be exactly one of: " +
      documentValues +
      ".\n\nDocument (Mathpix Markdown):\n\n" +
      "```mmd\n" +
      mmdText +
      "\n```\n\n" +
      "Return ONLY labelled blocks — one per field — in exactly this form, and " +
      "nothing else:\n\n" +
      blockTemplate +
      "\n\nPlace each proposed value between the opening and closing tag for its " +
      "field. Leave a field's block empty if the document does not tell you its " +
      "value. For <audienceLevel> and <documentType>, use one of the allowed " +
      "values listed above. Do not add any commentary, explanation, or text " +
      "outside these blocks.";

    logDebug("buildPrompt assembled", {
      fields: fields.length,
      mmdLength: mmdText.length,
    });

    return { systemPrompt, userPrompt };
  }

  // ---------------------------------------------------------------------------
  // parseResponse — recover each field's value from the labelled-block reply
  // ---------------------------------------------------------------------------

  /**
   * Extract one value per schema key from a model reply of `<KEY>value</KEY>`
   * blocks. For each key, the content runs from just after its `<KEY>` opening
   * tag up to the NEXT `<` character (which covers the field's own `</KEY>`, the
   * next field's opening tag, or — for a truncated reply — end of string). The
   * content is trimmed; a missing or empty block yields "". Any text outside the
   * blocks is ignored. Never throws.
   *
   * Reading to the next `<` (rather than insisting on a matching `</KEY>`) is
   * what lets a reply truncated mid-field still surrender every earlier field.
   *
   * @param {string} text — the raw model reply.
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @returns {Object<string, string>} one trimmed string per schema key.
   */
  function parseResponse(text, schema) {
    const fields = Array.isArray(schema) ? schema : [];
    const source = typeof text === "string" ? text : "";
    const result = {};

    for (const field of fields) {
      if (!field || typeof field.key !== "string") continue;
      const key = field.key;
      result[key] = "";

      const openTag = `<${key}>`;
      const openIndex = source.indexOf(openTag);
      if (openIndex === -1) {
        // No block for this key at all → leave the seeded "".
        continue;
      }

      const valueStart = openIndex + openTag.length;
      // The value ends at the next "<" — closing tag, next opening tag, or, when
      // the reply is truncated, there is none and we read to end of string.
      let valueEnd = source.indexOf("<", valueStart);
      if (valueEnd === -1) valueEnd = source.length;

      result[key] = source.slice(valueStart, valueEnd).trim();
    }

    if (!Array.isArray(schema)) {
      logWarn("parseResponse called without an array schema; returning {}.");
    }

    logDebug("parseResponse extracted", result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // coerceSelects — normalise the two restricted-vocabulary fields
  // ---------------------------------------------------------------------------

  /**
   * Normalise the audienceLevel and documentType fields onto canonical option
   * values. Each is matched case-folded against every option's `value` first,
   * then every option's `label`; a match sets the option's `value`, no match
   * sets "". The other six fields are copied through untouched.
   *
   * Pure: returns a new object; the input `obj` is never mutated.
   *
   * @param {Object<string, string>} obj — parsed field values (e.g. parseResponse output).
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @returns {Object<string, string>}
   */
  function coerceSelects(obj, schema) {
    const source =
      obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    const fields = Array.isArray(schema) ? schema : [];

    // Copy every field through; only the two selects are then overwritten.
    const result = {};
    for (const key of Object.keys(source)) {
      result[key] = source[key];
    }

    for (const key of SELECT_KEYS) {
      const options = optionsFor(fields, key);
      const raw = typeof source[key] === "string" ? source[key] : "";
      const folded = raw.trim().toLowerCase();

      let matched = "";
      if (folded !== "") {
        // Try option values first, then option labels.
        let option = options.find(
          (opt) => opt && String(opt.value).toLowerCase() === folded
        );
        if (!option) {
          option = options.find(
            (opt) => opt && String(opt.label).toLowerCase() === folded
          );
        }
        if (option) matched = option.value;
      }

      result[key] = matched;
      logDebug(`coerceSelects ${key}: "${raw}" → "${matched}"`);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  logInfo("MathPixContextAI loaded (pure prompt/parse/coerce core).");

  return {
    buildPrompt,
    parseResponse,
    coerceSelects,
  };
})();

// Expose globally (IIFE module pattern, no ES6 import/export).
window.MathPixContextAI = MathPixContextAI;
