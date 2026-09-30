/**
 * js/model-capabilities.js
 *
 * ONE implementation of "does this model do X?", where X is one of the four capability
 * CONCEPTS the product actually asks about — vision, code, reasoning and tool calling —
 * plus pdf, which the fallback matcher guards.
 *
 * WHY IT EXISTS. The registry's capability vocabulary is free text and uncontrolled.
 * Measured 16 September 2026 over the 514 registrations `window.modelRegistry.getAllModels()`
 * returns (last registration per id, which is what the runtime keeps): 295 distinct tokens,
 * 200 of them used by exactly one entry. Tool calling alone is spelled seven ways —
 * `tool_calling` 297, `function_calling` 17, `tools` 16, `tool_use` 10, `function-calling` 3,
 * `Tool Use` 1, `tool_calls` 1.
 *
 * THE DEFECT THAT PAID FOR THIS FILE. The model picker's capability checkboxes matched a
 * model's array with a raw `includes()` against the checkbox's `value`. The box labelled
 * "Tool calling/Function calling" carries `value="tools"`, and only 7 enabled models spell it
 * that way, so ticking it showed 7 models out of the 252 that can call tools. It hid 245.
 * Nothing announced it: a filter returning seven real, correctly-described models looks
 * exactly like a filter that is working, which is why it survived. An empty result gets
 * investigated; a short one gets believed.
 *
 * WHY IT IS A PLAIN SCRIPT ON `window`, AND WHY THAT IS NOT A SECOND COPY. Three consumers
 * need this answer and they are in three different module styles: the picker
 * (js/enhanced-model-selection.js, a plain-script IIFE), the embed's CAPABILITY_MAPPING
 * (openrouter-embed/openrouter-embed-model-selector.js, another IIFE) and
 * FALLBACK_GUARDED_CAPABILITIES in js/model-registry/model-registry-validator.js (Foundation,
 * an ES module). A plain script published on `window` and loaded ahead of all three is
 * reachable by every one of them, because deferred ES modules always run after plain scripts.
 * This is the arrangement js/pricing-display.js already uses for exactly the same reason, and
 * its position in tools.html is chosen on the same grounds. The alternative — a pinned second
 * copy with a cross-file proof row, as RESERVED_STREAM_PREFIXES uses — was rejected here
 * because it is only worth its cost when the layering genuinely forbids a shared file, and
 * here it does not.
 *
 * MEASURED, NOT ASSUMED, on the load-order question: the picker's classic <script> evaluates
 * at ~890ms with `window.modelRegistry` still undefined, and the registry module assigns it
 * ~166ms later. So a vocabulary published by a deferred module would NOT be readable at the
 * picker's evaluation time. This file is a plain script for that reason.
 *
 * HOW A SPELLING JOINS A CONCEPT. Three kinds of variation were measured and only the first
 * two are mechanical, so only the first two are handled by rule:
 *
 *   1. SEPARATOR — `chain-of-thought` against `chain_of_thought`. 57 tokens carry `-`,
 *      136 carry `_`, and 22 pairs differ by nothing else.
 *   2. CASE — `Reasoning`, `Coding`, `Tool Use`, `Logical Reasoning`.
 *   3. GENUINE SYNONYMY — `tools` against `tool_calling`. Not mechanical, so it is listed.
 *
 * `normaliseToken` folds case, whitespace and separators; the tables below then need to carry
 * only real synonyms. That is why `function-calling` and `Tool Use` do not appear in them.
 *
 * THE INCLUSION RULE, AND WHAT IT DELIBERATELY LEAVES OUT. A spelling joins a concept only
 * where it ENTAILS that concept. Everything ambiguous stays out and stays free text, and the
 * cost of each exclusion was measured rather than assumed:
 *
 *   - `image_generation` is an OUTPUT capability, not image input. Excluded. Its one holder,
 *     `openai/gpt-5-image-mini`, already declares `vision`, so the exclusion hides nothing.
 *   - `ocr` likewise: its one holder, `z-ai/glm-4.5v`, already declares both `vision` and
 *     `image`.
 *   - `agentic_workflows` (17), `agent_workflows` (4) and the rest of the `agent*` tail are a
 *     different claim from tool-calling support. Excluded — and every holder measured also
 *     declares `tool_calling` or `tools`, so the exclusion costs no model either.
 *   - Domain-qualified reasoning — `spatial_reasoning`, `repository_reasoning`,
 *     `document_reasoning`, `visual-reasoning`, `mathematical-reasoning` — is not the
 *     general "advanced reasoning" the checkbox offers. Excluded.
 *
 * THE pdf CONCEPT HAS NO SYNONYMS, AND THAT IS A MEASUREMENT RATHER THAN AN OVERSIGHT.
 * This list carried `document_analysis` and `document_parsing` from the day it was written
 * until 16 September 2026. Nothing had ever exercised it — the picker carries four
 * checkboxes (vision, code, reasoning, tools) and NO pdf checkbox — so the only consumer
 * that would ever ask a pdf question is the fallback matcher in
 * js/model-registry/model-registry-validator.js, and routing it here would have made an
 * untested list load-bearing on its first use.
 *
 * The inclusion rule above asks whether a spelling ENTAILS the concept. The matcher's
 * `pdf` means the model accepts PDF FILE INPUT. "Document analysis" is a different claim —
 * plausibly a vision model reading a picture of a page — so it was measured against
 * OpenRouter's own catalogue (GET https://openrouter.ai/api/v1/models, unauthenticated;
 * `architecture.input_modalities` carrying `file` is the evidence).
 *
 * Exactly six registrations declare one of those two spellings WITHOUT the literal token,
 * and four of the six are in the live catalogue:
 *
 *     amazon/nova-lite-v1          document-analysis   ["text","image"]           no file
 *     amazon/nova-pro-v1           document-analysis   ["text","image"]           no file
 *     z-ai/glm-4.5v                document_parsing    ["text","image"]           no file
 *     openai/gpt-4.1               document_analysis   ["image","text","file"]    file
 *
 * THREE OF THE FOUR ACCEPT NO FILE INPUT AT ALL, so the spellings do not entail the
 * concept; `openai/gpt-4.1` accepts files for reasons its token does not predict. (The
 * other two holders, `mistralai/pixtral-12b` and `qwen/qwen-2-vl-72b-instruct`, have been
 * retired from the catalogue and cannot be checked either way.) Controls taken in the same
 * request: `openai/gpt-4o`, `anthropic/claude-haiku-4.5` and `google/gemini-2.5-pro` all
 * carry `file`, and 169 of the 443 catalogue entries do, so a `no` here is a reading and
 * not a missing field.
 *
 * WHY THE ASYMMETRY MATTERS MORE THAN THE FOUR ROWS. Over-inclusion is harmless in a
 * picker — a filter shows one model too many — and load-bearing in a matcher, where it
 * lets a source REQUIRE of its substitute a capability the source does not actually have,
 * and so refuses good substitutes. Measured over the registry with the two spellings still
 * in the list, that cost `openai/gpt-4.1` and `z-ai/glm-4.5v` their entire candidate pool
 * and made three authored fallbacks read as defects. With the list narrowed, all of it
 * evaporates. The other four concepts are unaffected: they were measured on the picker,
 * which is the consumer they were written for.
 *
 * `image-input` and `vision-language` ARE included, and they are the one place inclusion
 * changes an answer rather than merely confirming it: `meta-llama/llama-4-maverick` declares
 * both and declares none of `vision`, `image` or `multimodal`, so it was invisible to the
 * vision filter.
 *
 * SCOPE, STATED SO IT IS NOT MISREAD AS COVERAGE. This file normalises FIVE CONCEPTS. The
 * other ~280 tokens remain free text and nothing here controls them. It is a resolver, not a
 * vocabulary, and a model that spells a concept in a way nobody has seen is still missed —
 * which is why `.claude/foundry-catalogue/prove-capability-vocabulary.mjs` proves both sides:
 * that a seeded model declaring a listed synonym IS matched, and that a seeded model
 * declaring none of them is NOT.
 *
 * Publishes window.ModelCapabilities. Loads before its consumers; no dependencies.
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError() {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ModelCapabilities]");
      console.error.apply(console, args);
    }
  }

  function logWarn() {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ModelCapabilities]");
      console.warn.apply(console, args);
    }
  }

  function logInfo() {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ModelCapabilities]");
      console.log.apply(console, args);
    }
  }

  function logDebug() {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ModelCapabilities]");
      console.log.apply(console, args);
    }
  }

  /**
   * Fold the two MECHANICAL kinds of variation — case, and whitespace/hyphen against
   * underscore — so the tables below carry only genuine synonyms.
   *
   * This is why `function-calling`, `Tool Use` and `chain-of-thought` are absent from
   * CONCEPT_SYNONYMS: each normalises onto an entry that is already there.
   */
  function normaliseToken(token) {
    if (typeof token !== "string") return "";
    return token.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  }

  /**
   * concept key -> the NORMALISED spellings that entail it.
   *
   * The keys are the four values the picker's capability checkboxes carry in tools.html
   * (`vision`, `code`, `reasoning`, `tools`) plus `pdf`, which the fallback matcher guards.
   * Each key is a member of its own set, so a checkbox value is always resolvable and the
   * select-parsing fallback path in js/enhanced-model-selection.js — which synthesises
   * exactly these four literal tokens — keeps working unchanged.
   */
  const CONCEPT_SYNONYMS = Object.freeze({
    vision: Object.freeze([
      "vision",
      "image",
      "images",
      "image_input",
      "image_analysis",
      "image_understanding",
      "image_text_comprehension",
      "image_captioning",
      "visual_qa",
      "visual_understanding",
      "visual_recognition",
      "vision_language",
      "multimodal",
      "multimodal_understanding",
    ]),
    code: Object.freeze([
      "code",
      "coding",
      "programming",
      "code_generation",
      "code_processing",
    ]),
    reasoning: Object.freeze([
      "reasoning",
      "extended_thinking",
      "hybrid_reasoning",
      "chain_of_thought",
      "tree_of_thoughts",
      "thinking",
      "thinking_mode",
      "thinking_traces",
      "structured_reasoning",
      "structured_thinking",
      "multi_step_reasoning",
      "step_by_step_reasoning",
      "logical_reasoning",
      "common_sense_reasoning",
    ]),
    tools: Object.freeze([
      "tool_calling",
      "tools",
      "tool_use",
      "tool_calls",
      "function_calling",
    ]),
    pdf: Object.freeze([
      // ONE MEMBER, DELIBERATELY. See "THE pdf CONCEPT HAS NO SYNONYMS" above.
      "pdf",
    ]),
  });

  const CONCEPT_KEYS = Object.freeze(Object.keys(CONCEPT_SYNONYMS));

  // Built once: normalised spelling -> concept key. Lookup is then a single map read per
  // token rather than a scan of five arrays.
  const SPELLING_TO_CONCEPT = (function buildIndex() {
    const index = new Map();
    for (const concept of CONCEPT_KEYS) {
      for (const spelling of CONCEPT_SYNONYMS[concept]) {
        const key = normaliseToken(spelling);
        if (index.has(key) && index.get(key) !== concept) {
          // A spelling claimed by two concepts would make the answer depend on table order.
          logError(
            `Spelling "${key}" is claimed by both "${index.get(key)}" and "${concept}" — ` +
              "the tables are ambiguous and the first claim is being kept."
          );
          continue;
        }
        index.set(key, concept);
      }
    }
    return index;
  })();

  /**
   * Is `concept` one this file knows about?
   * @param {string} concept
   * @returns {boolean}
   */
  function isKnownConcept(concept) {
    return Object.prototype.hasOwnProperty.call(
      CONCEPT_SYNONYMS,
      normaliseToken(concept)
    );
  }

  /**
   * Which concept, if any, does a single raw capability token express?
   * @param {string} token a capability string as written in the registry
   * @returns {string|null} the concept key, or null where the token is free text
   */
  function conceptForToken(token) {
    return SPELLING_TO_CONCEPT.get(normaliseToken(token)) || null;
  }

  /**
   * Does this model express `concept`?
   *
   * FAILS CLOSED ON AN UNKNOWN CONCEPT rather than matching everything: an unknown key falls
   * back to an exact match against the raw array, which is the behaviour that existed before
   * this file and is the conservative answer. A caller asking about a concept the tables do
   * not carry gets the old result, not a widened one.
   *
   * @param {Object} model a registry model, or anything carrying a `capabilities` array
   * @param {string} concept a concept key, or a raw capability token
   * @returns {boolean}
   */
  function modelHasConcept(model, concept) {
    const declared = model && Array.isArray(model.capabilities) ? model.capabilities : [];
    const key = normaliseToken(concept);

    if (!Object.prototype.hasOwnProperty.call(CONCEPT_SYNONYMS, key)) {
      logDebug(`"${concept}" is not a known concept; matching it literally.`);
      return declared.indexOf(concept) !== -1;
    }

    for (const token of declared) {
      if (SPELLING_TO_CONCEPT.get(normaliseToken(token)) === key) return true;
    }
    return false;
  }

  /**
   * Does this model express EVERY concept in the list? An empty list matches every model,
   * which is what "no capability filter is applied" means at the call site.
   * @param {Object} model
   * @param {string[]} concepts
   * @returns {boolean}
   */
  function modelHasAllConcepts(model, concepts) {
    if (!Array.isArray(concepts) || concepts.length === 0) return true;
    for (const concept of concepts) {
      if (!modelHasConcept(model, concept)) return false;
    }
    return true;
  }

  /**
   * Which of `concepts` does this model NOT express? For logging at a call site that has
   * just rejected a model, so the reason is readable.
   * @param {Object} model
   * @param {string[]} concepts
   * @returns {string[]}
   */
  function missingConcepts(model, concepts) {
    if (!Array.isArray(concepts)) return [];
    return concepts.filter((concept) => !modelHasConcept(model, concept));
  }

  window.ModelCapabilities = {
    CONCEPT_SYNONYMS,
    CONCEPT_KEYS,
    normaliseToken,
    isKnownConcept,
    conceptForToken,
    modelHasConcept,
    modelHasAllConcepts,
    missingConcepts,
  };

  logInfo(`Capability resolver ready for ${CONCEPT_KEYS.length} concepts`);
})();
