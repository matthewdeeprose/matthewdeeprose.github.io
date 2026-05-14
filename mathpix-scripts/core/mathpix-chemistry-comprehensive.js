/**
 * MathPix Chemistry Comprehensive — Detailed structural diagram walkthrough.
 * Augments MathPixChemistryUtils with generateComprehensiveDescription(smiles, pubchemData)
 * and generateComprehensiveDescriptionForAria(smiles, pubchemData).
 * Must load AFTER mathpix-chemistry-descriptions.js.
 * @author Matthew Deeprose, University of Southampton
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ChemComprehensive]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ChemComprehensive]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[ChemComprehensive]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ChemComprehensive]", message, ...args);
  }

  // Dependency check
  const utils = window.MathPixChemistryUtils;
  if (!utils) {
    logError("MathPixChemistryUtils not found — check script load order");
    return;
  }
  const internals = utils._descriptionInternals;
  if (!internals) {
    logError("_descriptionInternals not exposed — utils version mismatch");
    return;
  }
  // Phase 14-1c: classify.js shared helpers (loaded BEFORE comprehensive.js;
  // see tools.html script ordering). Post-Step-6 this is purely a load-order
  // canary — all destructure consumers retired (Step 3 trimmed ALKYL_NAMES;
  // Step 4 trimmed 5 classify helpers; Step 6 trimmed helpers + proseHelpers
  // + the 2 Step 4 transit bindings as the 3 public wrappers moved to
  // prose.js). Failing loud if absent surfaces script-load-order errors at
  // page load rather than at first call.
  const classifyHelpers = window.MathpixChemistryClassify?.internals?.helpers;
  if (!classifyHelpers) {
    logError("MathpixChemistryClassify.internals.helpers not exposed — check script load order (classify.js must precede comprehensive.js)");
    return;
  }

  // Phase 14-1d Steps 1-6 Rule A trim summary — destructure bindings removed
  // from comprehensive.js's preamble because their sole consumers moved to
  // prose.js. Each symbol remains available via its source namespace
  // (classifyHelpers.X / proseHelpers.X / internals.X) for any 14-3 hygiene
  // or Phase 15 needs:
  //
  //   classifyHelpers (5 trimmed at Step 4):
  //     _implicitHydrogens, _enumerateRingBranchPoints,
  //     _detectSubstitutionPattern, _identifyPyrimidinePattern,
  //     _identifyPyridinonePattern
  //   classifyHelpers (1 trimmed at Step 3):
  //     ALKYL_NAMES (consumer was _walkAndDescribeBranches)
  //   proseHelpers (9 Step 1 destructures, all trimmed at Step 4):
  //     _elem, _elementName, _aOrAnElement, _ordinal, _locantOrder,
  //     _describeHeteroatoms, _ringComposition, BOND_NAMES, SIZE_WORDS
  //   proseHelpers (5 Step 2 destructures, all trimmed at Step 4):
  //     _buildOpener, _buildImplicitHydrogenTail, _describeRingTopology,
  //     _describeFusedRingSystem, _describeJoinedRingSystem
  //   proseHelpers (1 Step 3 destructure, trimmed at Step 4):
  //     _walkAndDescribeBranches
  //   proseHelpers (1 Step 1 never-bound per Rule A, kept in publish):
  //     ORDINALS
  //   helpers + proseHelpers (Step 6 dual-canary consolidation):
  //     `helpers` (rewired at Step 5 to prose.js, sole consumer was
  //     generateComprehensiveDescriptionForAria via helpers.toAriaText —
  //     orphaned when wrapper moved to prose.js); `proseHelpers` (load-order
  //     canary, sole consumer was the 2 Step 4 transit bindings below —
  //     orphaned when those trimmed). Both retired at Step 6.
  //   proseHelpers (2 Step 4 transit bindings, trimmed at Step 6):
  //     _assembleComprehensiveDescription, _assembleComprehensiveDescriptionHTML
  //     (consumers were 3 public wrappers, all moved to prose.js at Step 6)
  //   internals (2 trimmed at Step 6):
  //     featureFlags (was FEATURE_FLAGS, consumed by 3 public wrappers'
  //     gate-checks); formatFormulaUnicode (was _formatFormulaUnicode,
  //     consumed by generateComprehensiveDescriptionForAria's
  //     unicode→spaced-formula screen-reader rewrite). Both rebound at
  //     prose.js:Step-6-preamble.
  //
  // Surviving comprehensive.js preamble infrastructure:
  //   - utils, internals (source bindings)
  //   - classifyHelpers source binding (load-order canary; null-check guard
  //     above is the only consumer post-Step-6)


  // === Helper functions ===













  // === Assembly ===


  // Phase 9-4 (CT-4h): _enumerateRingBranchPoints relocated to
  // mathpix-chemistry-descriptions.js so both tiers share the same ring-branch
  // position primitive. Access via helpers.enumerateRingBranchPoints.









  // === Public API ===

  // Phase 14-1d Step 6: local forwarding stubs. The 3 public wrappers
  // (generateComprehensiveDescription, generateComprehensiveDescriptionForAria,
  // generateComprehensiveDescriptionHTML) relocated to prose.js at Step 6.
  // These stubs preserve the legacy
  // MathPixChemistryUtils.generateComprehensiveDescription* names so tests +
  // migration harness + downstream UI consumers continue to resolve without
  // edits. Load-order safe: bodies access window.MathpixChemistryProse at
  // call-time (not IIFE-load), by which point prose.js has loaded.
  function generateComprehensiveDescription() {
    return MathpixChemistryProse.internals.helpers.generateComprehensiveDescription.apply(null, arguments);
  }
  function generateComprehensiveDescriptionForAria() {
    return MathpixChemistryProse.internals.helpers.generateComprehensiveDescriptionForAria.apply(null, arguments);
  }
  function generateComprehensiveDescriptionHTML() {
    return MathpixChemistryProse.internals.helpers.generateComprehensiveDescriptionHTML.apply(null, arguments);
  }

  utils.generateComprehensiveDescription = generateComprehensiveDescription;
  utils.generateComprehensiveDescriptionForAria = generateComprehensiveDescriptionForAria;
  utils.generateComprehensiveDescriptionHTML = generateComprehensiveDescriptionHTML;

  logInfo("MathPixChemistryComprehensive initialised");
})();
