/**
 * @fileoverview Validation utilities for the model registry system.
 * Provides validation for model configurations, fallbacks, and other aspects.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { DEFAULT_CONFIG } from "./model-registry-config.js";
import { ModelValidationError } from "./model-registry-errors.js";

/**
 * The two unit strings a `costs.meters` entry may carry.
 *
 * PINNED IN TWO PLACES ON PURPOSE, AND A PROOF ROW HOLDS THEM TOGETHER. The capture side
 * lives in .claude/model-add/pricing.mjs (METER_UNIT), an ES module in a tool directory the
 * shipped app must never import; this file is a shipped ES module the tool cannot import
 * either, because it pulls in the whole registry. Two copies of a vocabulary is two chances
 * for it to drift, so prove-modality.mjs reads the literal strings out of BOTH files and
 * reddens when they disagree — a cross-file pin, the prove-wcag22-criteria.mjs arrangement.
 */
const KNOWN_METER_UNITS = ["usd-per-million-tokens", "usd-per-request"];

/** The only two cost keys any validator has ever enforced, and the only two every consumer reads. */
const VALIDATED_COST_KEYS = ["input", "output"];

/**
 * Cost keys that exist in the registry today and are knowingly tolerated: `image` has one
 * user-visible reader (js/modules/model-manager.js), `video` is a hard-coded 0 on 150 entries
 * that nothing reads, and `meters` is validated above. Everything else is reported.
 */
const REPORTED_COST_KEYS = ["image", "video", "meters"];

/**
 * PROVIDER STREAMS — the rule `findBestFallbackMatch` is held to, and where this set comes from.
 *
 * Foundry and OpenRouter are two separate POPULATIONS OF USERS, not two routes to one
 * catalogue (owner's ruling, 14 September 2026, register item 107). A Foundry entry never
 * falls back to an OpenRouter model, and the reverse. That is a fact about how the product is
 * used; it is written nowhere else in the source, which is why reading the code alone has
 * twice produced the opposite answer.
 *
 * `model.provider` IS NOT THE STREAM. js/foundry-model-definitions.js sets
 * `provider: upstreamProvider` — the upstream VENDOR — so a Foundry GPT-5 and an OpenRouter
 * `openai/gpt-5` both read `provider: "openai"`. The transport lives at
 * `metadata.routing.provider` on Foundry entries and does not exist at all on OpenRouter
 * ones, so it cannot be compared across the two. The stream is derivable only from the id
 * prefix, and a filter keyed on `model.provider` would compile, run, look right and refuse
 * nothing.
 *
 * SECOND COPY, DELIBERATE AND PINNED. The tree's one other id-prefix resolver is
 * RESERVED_PROVIDER_PREFIXES in openrouter-embed/providers/_lookup.js. That file is
 * Integration-layer, an IIFE `window` global loaded by a plain <script> tag; this file is
 * Foundation and an ES module whose validate call runs at module-evaluation time, so reaching
 * for it would invert the layering AND depend on a load order that is not guaranteed. The KEYS
 * below must therefore stay identical to that Set, and
 * .claude/foundry-catalogue/prove-fallback-matcher.mjs reads the literal prefixes out of BOTH
 * files and reddens when they diverge — the same cross-file pin arrangement KNOWN_METER_UNITS
 * above uses.
 *
 * The VALUES are this file's own policy and are NOT in _lookup.js: the two Foundry API
 * surfaces `azure-openai` and `azure-responses` are one user-facing provider with one
 * credential (openrouter-embed/provider-switcher.js:81-90, :114-115), so a fallback across
 * them does not cross the streams.
 */
const RESERVED_STREAM_PREFIXES = Object.freeze({
  openrouter: "openrouter",
  "azure-openai": "foundry",
  "azure-responses": "foundry",
  "azure-inference": "foundry",
  "anthropic-foundry": "foundry",
  local: "local",
});

/**
 * An id with no prefix, or with an unrecognised one, is an OpenRouter id. This is _lookup.js's
 * documented rule and not a guess: a bare name and an unknown prefix both resolve to the
 * default provider there.
 */
const DEFAULT_STREAM = "openrouter";

/**
 * The capabilities a substitute must not silently drop, from the rule parcel 4 applied by hand
 * to all 43 Foundry registrations (register item 107). A fallback that cannot do what the user
 * picked is worse than no fallback, so these are a SUPERSET test, not an overlap score —
 * `calculateCapabilityOverlap` is symmetric and therefore rewards similarity rather than
 * sufficiency.
 *
 * EACH ENTRY CARRIES TWO NAMES, AND THE PAIRING IS THE WHOLE POINT OF THIS SHAPE.
 * `concept` is the key js/model-capabilities.js resolves; `literal` is the registry spelling
 * this file matched on its own before that resolver existed, and is still what the degraded
 * path below matches. They differ in exactly one row, and that row is the reason the pairs are
 * written out rather than inferred: the concept is `tools` while the registry spelling is
 * `tool_calling`. Handing `tool_calling` to `modelHasConcept` would NOT throw and would NOT
 * log — the resolver FAILS CLOSED on an unknown concept and matches it literally — so the one
 * capability register item 111 was opened about would silently keep the behaviour being
 * repaired, with every proof row still green. `isKnownConcept` is checked per guard below for
 * the same reason.
 *
 * THE LIMIT THIS REPLACES, AND WHY IT IS NO LONGER A LIMIT. This comment used to record that
 * the four names were matched LITERALLY, so a source spelling tool calling `tool_use` did not
 * require tool calling of its candidate — a permissive failure, bounded only by the stream and
 * context constraints beside it. Measured 16 September 2026 over the 514 loaded entries, 51 of
 * them are invisible on at least one guarded concept under literal matching (`tool_calling` 35,
 * `vision` 12, `pdf` 6, `reasoning` 4). Routing the test through the shared resolver closes it.
 *
 * NOTE THE DIRECTION OF TRAVEL, BECAUSE IT IS NOT THE OBVIOUS ONE. Concept resolution TIGHTENS
 * the source side — a source spelling it `tool_use` now genuinely requires the capability — and
 * LOOSENS the candidate side, because a candidate spelling it `tool_use` now counts as
 * providing it. Measured over the eligible (source, candidate) pairs `findBestFallbackMatch`
 * actually considers, the aggregate RISES, 15,195 to 15,392, while 16 individual sources see
 * their pool shrink. Anyone reading this as "the matcher gets stricter" will predict the wrong
 * failures.
 */
const FALLBACK_GUARDED_CAPABILITIES = Object.freeze([
  Object.freeze({ concept: "vision", literal: "vision" }),
  Object.freeze({ concept: "pdf", literal: "pdf" }),
  Object.freeze({ concept: "reasoning", literal: "reasoning" }),
  Object.freeze({ concept: "tools", literal: "tool_calling" }),
]);

/**
 * Set once, so an absent resolver is announced ONCE per page load rather than once per
 * candidate considered.
 */
let capabilityResolverAbsenceReported = false;

/**
 * The shared capability resolver, or `null` where it is not loaded.
 *
 * RESOLVED AT CALL TIME AND NEVER CACHED AT MODULE SCOPE. This file is a deferred ES module
 * and the resolver is a plain `<script>`; a module-scope capture would freeze whatever the
 * global held at evaluation time, which is the failure mode AGENTS.md records for
 * `window.a11y`. Measured in a headless browser on 16 September 2026 rather than inferred:
 * the resolver is assigned at 735.3ms and `window.modelRegistry` at 965.3ms, 230.0ms later,
 * and `js/config.js` calls `validateAllFallbacks()` only after that import completes — so the
 * resolver is in place well before this file asks for it. That is a measurement of today's
 * document, not a guarantee, which is why the degraded path below exists at all.
 *
 * AND WHY THE DEGRADED PATH IS LOUD. Silently reverting to literal matching would restore the
 * exact permissive behaviour this routing repairs, while every proof row stayed green — the
 * defect class this whole programme exists to close. So it is announced, once.
 *
 * IT IS THE ONE PLACE IN THIS FILE THAT DOES NOT USE `logger`, AND THAT IS DELIBERATE.
 * When this was written, on 16 September 2026, `model-registry-logger.js` built its exported
 * singleton with `enabled: LOGGING_ENABLED` and that const was `false` — which silenced not
 * merely every `logger.warn` in the registry, as this comment used to say, but EVERY LEVEL
 * INCLUDING `error`, because `_shouldLog` returns on that flag ahead of any severity
 * comparison. A degradation notice routed through it would have been a guard installed off
 * the path it protects, which AGENTS.md § Testing records as reading exactly like a working
 * one.
 *
 * THE CHANNEL IS LIVE AGAIN SINCE 22 SEPTEMBER 2026 (parcel 32, register item 117), AND THE
 * CALL BELOW STILL DOES NOT USE IT. That is not an oversight left over from the repair. The
 * reason has never been that the logger was dead; it is that a notice saying the guarded
 * capability test has degraded must not be silenceable by a setting that has nothing to do
 * with it — and `LOGGING_ENABLED` and `LOG_LEVEL` are exactly such settings, one edit away
 * from being turned down again. `console.warn` is used directly for that reason, and it fires
 * at most once per page load. Do not "tidy" it onto the logger; row R8 of
 * `.claude/measurements/p32-dead-diagnostic-channel/prove-p32.mjs` pins it, bound by
 * INV-ROUTE-THROUGH-LOGGER.
 *
 * The message deliberately does NOT name the global. A proof row asserting that this file
 * references the resolver is satisfied by any occurrence of the name, and a string literal is
 * code, so comment-stripping cannot help — parcel 7 shipped a row that was green for exactly
 * that reason.
 *
 * @returns {Object|null} The resolver, or null where it is unavailable
 */
function getCapabilityResolver() {
  const resolver =
    typeof window !== "undefined" && window ? window.ModelCapabilities : null;

  if (
    resolver &&
    typeof resolver.modelHasConcept === "function" &&
    typeof resolver.isKnownConcept === "function"
  ) {
    return resolver;
  }

  if (!capabilityResolverAbsenceReported) {
    capabilityResolverAbsenceReported = true;
    console.warn(
      "[ModelRegistry] The shared capability resolver is unavailable, so the " +
        "guarded-capability test has DEGRADED TO LITERAL MATCHING. A source that spells " +
        "tool calling any way but tool_calling will not require tool calling of its " +
        "substitute. This is the permissive behaviour register item 111 was opened for; " +
        "fallbacks elected on this page load should not be trusted."
    );
  }

  return null;
}

/**
 * Does `model` express one guarded capability?
 *
 * Concept-resolved where the resolver is present AND knows the concept; literal otherwise.
 * The `isKnownConcept` check is not defensive padding — without it a concept the resolver has
 * dropped would reach `modelHasConcept`, which matches an unknown key literally against the
 * raw array, and `tools` matched literally is a different and much smaller set than
 * `tool_calling`. Failing to the `literal` name is the honest degradation; failing to the
 * concept KEY would be a third behaviour nobody chose.
 *
 * @param {Object|null} resolver - From `getCapabilityResolver`
 * @param {Object} model - Anything carrying a `capabilities` array
 * @param {{concept: string, literal: string}} guard - One FALLBACK_GUARDED_CAPABILITIES entry
 * @returns {boolean}
 */
function expressesGuardedCapability(resolver, model, guard) {
  if (resolver && resolver.isKnownConcept(guard.concept)) {
    return resolver.modelHasConcept(model, guard.concept);
  }
  const declared = Array.isArray(model && model.capabilities) ? model.capabilities : [];
  return declared.includes(guard.literal);
}

/**
 * Absolute ceiling on how far the chain walk in `validateAllFallbacks` follows one
 * fallback chain.
 *
 * IT IS NOT THE TERMINATION GUARANTEE, and reading it as one would be the mistake.
 * The walk terminates on its own the moment it revisits an id, which bounds it by the
 * number of distinct models however the data is shaped. This ceiling is the guard
 * against the one case that bound cannot cover — a `getModel` that hands back a fresh
 * object on every call and therefore never repeats. The walk runs at
 * module-evaluation time on every page load, before anything renders, so a walk that
 * can hang is worse than no walk at all.
 */
const MAX_FALLBACK_CHAIN_HOPS = 1000;

/**
 * Rotate a ring so it begins at its lexicographically smallest member.
 *
 * One ring reached from N entry points must have ONE identity, or the report prints
 * the same defect once per source — which is the 411-warnings failure this walk exists
 * to avoid. Rotation rather than sorting, so the printed member order is still the
 * order a reader would follow at runtime.
 *
 * @param {string[]} members - Ring members in traversal order
 * @returns {string[]} The same ring, rotated to a canonical starting point
 */
function canonicaliseRing(members) {
  let start = 0;
  for (let i = 1; i < members.length; i += 1) {
    if (members[i] < members[start]) start = i;
  }
  return members.slice(start).concat(members.slice(0, start));
}



/**
 * ModelRegistryValidator class for validating model registry data
 */
export class ModelRegistryValidator {
  /**
   * Validate model configuration
   * @param {Object} config - Model configuration to validate
   * @returns {Object} Validation result with isValid and issues properties
   */
  validateModelConfig(config) {
    const result = {
      isValid: true,
      issues: [],
      // Non-fatal findings. `issues` sets isValid:false and makes registerModel throw;
      // a warning must never do that, because the things worth reporting here are on
      // hundreds of entries that predate any gate.
      warnings: [],
    };

    // Check for required fields
    const missingFields = utils.getMissingProperties(
      config,
      DEFAULT_CONFIG.requiredModelFields
    );

    if (missingFields.length > 0) {
      result.isValid = false;
      result.issues.push({
        type: "missing_fields",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        fields: missingFields,
      });
    }

    // Validate capabilities
    if (
      !Array.isArray(config.capabilities) ||
      config.capabilities.length === 0
    ) {
      result.isValid = false;
      result.issues.push({
        type: "invalid_capabilities",
        message: "Model must have at least one capability",
        field: "capabilities",
      });
    }

    // Validate costs for non-free models
    if (!config.isFree) {
      if (
        !config.costs ||
        typeof config.costs.input !== "number" ||
        typeof config.costs.output !== "number"
      ) {
        result.isValid = false;
        result.issues.push({
          type: "invalid_costs",
          message: "Non-free model must have valid cost configuration",
          field: "costs",
        });
      }
    }

    // Validate the unit-tagged meter block, and REPORT any cost key nothing validates.
    //
    // WHY EVERY FATAL CHECK BELOW IS GUARDED ON `meters` BEING PRESENT. `registerModel` in
    // model-registry-core.js THROWS a ModelValidationError when this returns isValid:false,
    // and js/model-definitions.js is 478 top-level registerModel calls in one module — so a
    // rule that rejected a single existing entry would abort the module and take the entire
    // registry, and the app, with it. No entry in the file carries `costs.meters` today, so
    // the fatal path is reachable only by an entry written after this check existed.
    //
    // THE UNRECOGNISED-KEY PATH IS DELIBERATELY NOT FATAL, for the same reason. Measured
    // 11 September 2026, `costs` across the registry carries sixteen distinct key names —
    // input, output, image, video, audio, webSearch, requests, file, request, additionalCosts,
    // images, imageInput, imageOutput, cacheRead, cacheCreation, pdf — of which exactly TWO
    // are validated and exactly THREE are read by any consumer. Refusing the other thirteen
    // would refuse 204 entries. They are reported instead, which is what turns "absorbed
    // silently" into "visible", and that was the hole: a camelCase `imageOutput`, a
    // "// Per million seconds" comment on a per-token figure, and three `audio: 0.0` entries
    // all arrived without a single gate objecting.
    if (config.costs && typeof config.costs === "object") {
      const meters = config.costs.meters;

      if (meters !== undefined) {
        if (meters === null || typeof meters !== "object" || Array.isArray(meters)) {
          result.isValid = false;
          result.issues.push({
            type: "invalid_cost_meters",
            message: "costs.meters must be an object keyed by the catalogue's own meter name",
            field: "costs.meters",
          });
        } else {
          for (const [meterName, meter] of Object.entries(meters)) {
            // A BARE NUMBER IS REFUSED, not coerced. The whole point of this block is that a
            // figure carries its unit; accepting `audio: 100` here would recreate the field
            // whose unit had to be guessed from a comment that was wrong.
            if (!meter || typeof meter !== "object" || Array.isArray(meter)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter",
                message: `costs.meters.${meterName} must be an object of the form { value, unit }`,
                field: `costs.meters.${meterName}`,
              });
              continue;
            }
            if (typeof meter.value !== "number" || !Number.isFinite(meter.value)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter_value",
                message: `costs.meters.${meterName}.value must be a finite number`,
                field: `costs.meters.${meterName}.value`,
              });
            }
            if (!KNOWN_METER_UNITS.includes(meter.unit)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter_unit",
                message: `costs.meters.${meterName}.unit must be one of ${KNOWN_METER_UNITS.join(", ")} — got ${JSON.stringify(meter.unit)}`,
                field: `costs.meters.${meterName}.unit`,
              });
            }
          }
        }
      }

      const unrecognised = Object.keys(config.costs).filter(
        (k) => !VALIDATED_COST_KEYS.includes(k) && !REPORTED_COST_KEYS.includes(k)
      );
      if (unrecognised.length > 0) {
        result.warnings.push({
          type: "unrecognised_cost_keys",
          message: `costs carries key(s) nothing validates or renders: ${unrecognised.join(", ")}. A cost key with no reader and no unit is free data.`,
          field: "costs",
          keys: unrecognised,
        });
      }
    }

    // Validate maxContext
    if (typeof config.maxContext !== "number" || config.maxContext <= 0) {
      result.isValid = false;
      result.issues.push({
        type: "invalid_max_context",
        message: "Model must have valid maxContext value",
        field: "maxContext",
      });
    }

    // Validate parameter support
    if (config.parameterSupport) {
      if (!Array.isArray(config.parameterSupport.supported)) {
        result.isValid = false;
        result.issues.push({
          type: "invalid_parameter_support",
          message: "Invalid parameter support configuration",
          field: "parameterSupport.supported",
        });
      }
    }

    // Validate fallback if specified
    if (config.fallbackTo && typeof config.fallbackTo !== "string") {
      result.isValid = false;
      result.issues.push({
        type: "invalid_fallback",
        message: "Fallback model must be specified as a string ID",
        field: "fallbackTo",
      });
    }

    return result;
  }

  /**
   * Validate category configuration
   * @param {Object} config - Category configuration to validate
   * @returns {Object} Validation result with isValid and issues properties
   */
  validateCategoryConfig(config) {
    const result = {
      isValid: true,
      issues: [],
    };

    // Check for required fields
    const missingFields = utils.getMissingProperties(
      config,
      DEFAULT_CONFIG.requiredCategoryFields
    );

    if (missingFields.length > 0) {
      result.isValid = false;
      result.issues.push({
        type: "missing_fields",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        fields: missingFields,
      });
    }

    return result;
  }

  /**
   * Validate model fallbacks.
   *
   * TWO SEPARATE QUESTIONS, DELIBERATELY NOT MERGED.
   *
   * (1) THE THREE-CONDITION CHECK, unchanged: is this entry's own `fallbackTo`
   *     missing, disabled, or itself? Each lands in `invalidFallbacks`, which
   *     model-registry-core.js hands to the AUTO-CORRECTOR — so anything placed in
   *     that map is something the runtime will silently rewrite on every page load.
   *
   * (2) THE CHAIN WALK, added 14 September 2026 (register item 108). A fallback is
   *     FOLLOWED at runtime, so a ring whose every link resolves to an enabled,
   *     distinct model passes (1) completely and still never terminates. That is not
   *     hypothetical: parcel 5 measured 411 chains reaching a three-node ring while
   *     this function reported the registry clean.
   *
   * CYCLE MEMBERS ARE REPORTED AND ARE NOT ENROLLED FOR CORRECTION. A decision, not an
   * oversight, and the sharp end of this change. Everything in `invalidFallbacks` is
   * passed to `findBestFallbackMatch` — the mechanism that elected a 30-second
   * music-clip generator as the fallback for 349 chains before parcel 5 constrained
   * it. That matcher has never been exercised on a cycle, and an N-member ring would
   * hand it N simultaneous rewrites whose combined effect no row has ever measured.
   * Reporting is sufficient to make the defect visible, which was the whole
   * complaint; enrolling it would arm an untested repair on a class of defect it has
   * never seen. `isValid` therefore keys on `invalidFallbacks` ALONE, so the
   * correction path is unchanged BY CONSTRUCTION rather than by care — and a proof
   * row asserts that a seeded ring reaches the map not at all.
   *
   * A SELF-LOOP IS NOT A CYCLE HERE. `a -> a` is already `self_reference` above and
   * already correctable; reporting it a second time under a second name would
   * double-count one defect and invite two different repairs. Rings of length 1 are
   * skipped by the walk, and proof rows hold the two apart in BOTH directions —
   * collapsing them is the easy bug, because they are adjacent.
   *
   * THE RING IS REPORTED, NOT THE ENTRY POINT. 411 sources reaching one ring is one
   * defect; a per-source report prints it 411 times and buries it. Each distinct ring
   * appears once, with its members, and the number of sources that reach it is
   * carried separately.
   *
   * @param {Function} getModel - Function to get a model by ID
   * @param {Array} models - Array of models to validate fallbacks for
   * @returns {Object} `{ isValid, invalidFallbacks, cycles, cyclicSourceCount }`
   */
  validateAllFallbacks(getModel, models) {
    const invalidFallbacks = new Map();

    models.forEach((model) => {
      if (model.fallbackTo) {
        const fallbackModel = getModel(model.fallbackTo, true);
        if (!fallbackModel) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "not_found",
            message: `Fallback model not found: ${model.fallbackTo}`,
          });
        } else if (fallbackModel.disabled) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "disabled",
            message: `Fallback model is disabled: ${model.fallbackTo}`,
          });
        } else if (fallbackModel.id === model.id) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "self_reference",
            message: `Model cannot fallback to itself: ${model.id}`,
          });
        }
      }
    });

    const { cycles, cyclicSourceCount } = this.findFallbackCycles(
      getModel,
      models
    );

    return {
      // DELIBERATELY KEYED ON `invalidFallbacks` ALONE — see the note above. A cycle
      // must not open the auto-correction path, and the cheapest way to guarantee
      // that is for the flag the caller branches on never to have heard of cycles.
      isValid: invalidFallbacks.size === 0,
      invalidFallbacks,
      cycles,
      cyclicSourceCount,
    };
  }

  /**
   * Walk every fallback chain and report each distinct RING once.
   *
   * Terminates on four shapes, each of which has its own proof row: a self-loop, a
   * ring, a chain that walks into a model the registry does not have, and a chain
   * that walks into a disabled one. The per-source `positionOf` map is what
   * guarantees it — the walk stops the first time it revisits an id, so it cannot run
   * longer than the number of distinct models — and MAX_FALLBACK_CHAIN_HOPS is the
   * separate guard described where it is declared.
   *
   * A DISABLED MODEL DOES NOT END THE WALK. The walk asks a structural question about
   * the authored graph, and a ring that happens to contain a disabled member is still
   * a ring; whether the runtime would stop there is a different question, answered by
   * the `disabled` reason above.
   *
   * @param {Function} getModel - Function to get a model by ID
   * @param {Array} models - Array of models to walk from
   * @returns {Object} `{ cycles, cyclicSourceCount }` — distinct rings, and the total
   *                   number of source models whose chain reaches any of them
   */
  findFallbackCycles(getModel, models) {
    const rings = new Map();
    let cyclicSourceCount = 0;

    models.forEach((model) => {
      // Insertion-ordered, so the slice below recovers the ring in traversal order.
      const positionOf = new Map();
      let current = model.id;
      let hops = 0;

      while (current && hops <= MAX_FALLBACK_CHAIN_HOPS) {
        if (positionOf.has(current)) {
          const members = [...positionOf.keys()].slice(positionOf.get(current));

          // Length 1 is `a -> a`, which is `self_reference` and already reported.
          if (members.length > 1) {
            const canonical = canonicaliseRing(members);
            const key = canonical.join("|");

            if (!rings.has(key)) {
              rings.set(key, {
                reason: "cycle",
                members: canonical,
                sources: 0,
                message: `Fallback chain never terminates: ${canonical.join(
                  " -> "
                )} -> ${canonical[0]}`,
              });
            }

            rings.get(key).sources += 1;
            cyclicSourceCount += 1;
          }

          break;
        }

        positionOf.set(current, positionOf.size);

        const node = getModel(current, true);
        if (!node || !node.fallbackTo) break;

        current = node.fallbackTo;
        hops += 1;
      }
    });

    return { cycles: [...rings.values()], cyclicSourceCount };
  }

  /**
   * Calculate capability overlap between two models
   * @param {Object} modelA - First model
   * @param {Object} modelB - Second model
   * @returns {number} Overlap score (0-1)
   */
  calculateCapabilityOverlap(modelA, modelB) {
    return utils.calculateSetOverlap(modelA.capabilities, modelB.capabilities);
  }


  /**
   * Resolve a model id to its PROVIDER STREAM.
   *
   * Prefix-keyed, per RESERVED_STREAM_PREFIXES above: a reserved prefix resolves to its
   * stream, and anything else — a bare name, an unrecognised prefix, a non-string — is an
   * OpenRouter id. `hasOwnProperty` rather than a bare lookup, so an id such as
   * `constructor/foo` cannot return something off Object.prototype.
   *
   * @param {string} modelId - Model identifier
   * @returns {string} Stream identifier ("openrouter", "foundry" or "local")
   */
  resolveStream(modelId) {
    if (typeof modelId !== "string" || !modelId.trim()) return DEFAULT_STREAM;

    const trimmed = modelId.trim();
    const slashIndex = trimmed.indexOf("/");
    if (slashIndex <= 0) return DEFAULT_STREAM;

    const prefix = trimmed.slice(0, slashIndex);
    return Object.prototype.hasOwnProperty.call(RESERVED_STREAM_PREFIXES, prefix)
      ? RESERVED_STREAM_PREFIXES[prefix]
      : DEFAULT_STREAM;
  }

  /**
   * Whether `candidate` may stand in for `model` as an automatic fallback.
   *
   * The three constraints a human was required to apply by hand to every Foundry entry in
   * parcel 4, so the runtime corrector is held to the same rule it writes into the same field:
   * same stream, a superset of the guarded capabilities, and a context window at or above the
   * source's. Refusing everything is a first-class answer — the caller writes `null` and the
   * app carries no fallback, which is better than a substitute that cannot do the job.
   *
   * @param {Object} model - The model needing a fallback
   * @param {Object} candidate - A candidate substitute
   * @returns {boolean} Whether the candidate is eligible
   */
  isFallbackCandidateEligible(model, candidate) {
    if (!model || !candidate) return false;

    // 1. Never cross the streams (register item 107).
    if (this.resolveStream(candidate.id) !== this.resolveStream(model.id)) {
      return false;
    }

    // 2. Capability superset over the guarded set, not overlap — resolved by CONCEPT,
    //    so a source spelling tool calling `tool_use` requires tool calling of its
    //    substitute, and a candidate spelling it `tool_use` counts as providing it.
    //    Both sides go through the same helper, so the two can never be tested by
    //    different rules; the shape here before 16 September 2026 read the source with
    //    `includes` and the candidate through a Set, and both were literal.
    const resolver = getCapabilityResolver();
    for (const guard of FALLBACK_GUARDED_CAPABILITIES) {
      if (
        expressesGuardedCapability(resolver, model, guard) &&
        !expressesGuardedCapability(resolver, candidate, guard)
      ) {
        return false;
      }
    }

    // 3. Context floor. Where the source declares no usable maxContext there is no floor to
    // meet; where it does, a candidate with no usable value cannot be shown to meet it.
    const floor = Number(model.maxContext);
    if (Number.isFinite(floor)) {
      const available = Number(candidate.maxContext);
      if (!Number.isFinite(available) || available < floor) return false;
    }

    return true;
  }

  /**
   * Find best fallback match for a model
   * @param {Object} model - Model configuration
   * @param {Array} candidates - Array of candidate models
   * @returns {string|null} Best matching model ID or null
   */
  findBestFallbackMatch(model, candidates) {
    // Skip if model is already free tier
    if (model.isFree) return null;

    const validCandidates = candidates.filter(
      (m) =>
        m.id !== model.id &&
        !m.disabled &&
        // Prioritize models in same category
        (m.category === model.category || m.isFree) &&
        // Item 108: same stream, capability superset, context floor. Without these three
        // the sort below elects the first free model it can find, whatever it is.
        this.isFallbackCandidateEligible(model, m)
    );

    if (validCandidates.length === 0) return null;

    // Sort candidates by:
    // 1. Same category preference
    // 2. Capability overlap
    // 3. Free tier preference
    //
    // ITEM 108: `isFree` WAS THE FIRST KEY AND THAT IS WHAT ELECTED A MUSIC MODEL.
    // Measured on a loaded page at HEAD, 14 September 2026: the corrector fired on three
    // entries and chose `google/lyria-3-clip-preview` for all three, including
    // `anthropic/claude-haiku-4.5`, the terminus of 349 of 471 chains. Lyria generates
    // 30-second audio clips; it won because it is the registry's only free GeneralPurpose
    // entry, beating `openai/gpt-5.4` at a capability overlap of 1.000.
    //
    // With the eligibility constraints above in force every survivor is already
    // same-stream, capability-sufficient and context-sufficient, so `isFree` no longer
    // protects anyone from anything — it is a cost preference, and it belongs last.
    // Note this still differs from .claude/model-health/check-models.mjs `pickFallback`,
    // which ranks by nearest input cost then largest context; that one re-points a DEAD
    // model under human review, this one substitutes a live one at load, and neither
    // knew about the other until item 108.
    return (
      validCandidates
        .map((candidate) => ({
          id: candidate.id,
          score: this.calculateCapabilityOverlap(model, candidate),
          isFree: candidate.isFree,
          sameCategory: candidate.category === model.category,
        }))
        .sort((a, b) => {
          // Same category first
          if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
          // Then capability overlap
          if (b.score !== a.score) return b.score - a.score;
          // Then free tier, as a cost tiebreak between equally suitable candidates
          if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
          return 0;
        })[0]?.id || null
    );
  }

  /**
   * Validate policy URLs for a model
   * @param {Object} policyLinks - Policy links to validate
   * @returns {Object} Validation results
   */
  validatePolicyUrls(policyLinks) {
    if (!policyLinks) {
      return {
        valid: true,
        message: "No policy links to validate",
        issues: [],
        checkedUrls: [],
      };
    }

    const validation = {
      valid: true,
      issues: [],
      checkedUrls: [],
    };

    // Check each link
    Object.entries(policyLinks).forEach(([type, url]) => {
      if (url && typeof url === "string" && type !== "lastUpdated") {
        try {
          const parsedUrl = new URL(url);
          validation.checkedUrls.push({
            type,
            url: parsedUrl.href,
          });
        } catch (e) {
          validation.valid = false;
          validation.issues.push({
            type,
            url,
            error: "Invalid URL format",
          });
        }
      }
    });

    return validation;
  }

  /**
   * Validate parameter values against constraints
   * @param {Object} parameters - Parameter values to validate
   * @param {Array} supportedParameters - Array of supported parameter names
   * @returns {Object} Validation results
   */
  validateParameterValues(parameters, supportedParameters) {
    const result = {
      isValid: true,
      issues: [],
    };

    if (!parameters || typeof parameters !== "object") {
      result.isValid = false;
      result.issues.push({
        type: "invalid_parameters",
        message: "Parameters must be an object",
      });
      return result;
    }

    // Check for unsupported parameters
    const unsupportedParams = Object.keys(parameters).filter(
      (param) => !supportedParameters.includes(param)
    );

    if (unsupportedParams.length > 0) {
      result.issues.push({
        type: "unsupported_parameters",
        message: `Unsupported parameters: ${unsupportedParams.join(", ")}`,
        parameters: unsupportedParams,
      });
      // This is a warning, not an error
    }

    // Validate parameter values against constraints
    Object.entries(parameters).forEach(([param, value]) => {
      if (!supportedParameters.includes(param)) {
        // Already handled above
        return;
      }

      const constraints = DEFAULT_CONFIG.parameterConstraints[param];
      if (!constraints) {
        // No constraints defined for this parameter
        return;
      }

      if (typeof value !== "number") {
        result.isValid = false;
        result.issues.push({
          type: "invalid_parameter_type",
          message: `Parameter ${param} must be a number`,
          parameter: param,
          value,
        });
        return;
      }

      if (value < constraints.min || value > constraints.max) {
        result.isValid = false;
        result.issues.push({
          type: "parameter_out_of_range",
          message: `Parameter ${param} must be between ${constraints.min} and ${constraints.max}`,
          parameter: param,
          value,
          min: constraints.min,
          max: constraints.max,
        });
      }
    });

    return result;
  }
}

// Create and export a singleton instance
export const validator = new ModelRegistryValidator();
