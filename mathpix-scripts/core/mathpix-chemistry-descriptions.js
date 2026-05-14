/**
 * MathPix Chemistry Descriptions — Structural description engine.
 *
 * Augments window.MathPixChemistryUtils with:
 *   analyseStructure(smiles)
 *   generateStructuralDescription(smiles, pubchemData)
 *   generateStructuralDescriptionForAria(smiles, pubchemData)
 *   generateShortDescription(smiles, pubchemData)
 *   generateShortDescriptionForAria(smiles, pubchemData)
 *
 * Must load AFTER mathpix-chemistry-utils.js.
 *
 * @author Matthew Deeprose, University of Southampton
 */
(function () {
  "use strict";

  // =========================================================================
  // Logging configuration
  // =========================================================================
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
      console.error("[ChemDescriptions]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ChemDescriptions]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ChemDescriptions]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ChemDescriptions]", message, ...args);
  }

  // =========================================================================
  // Dependency check
  // =========================================================================
  const utils = window.MathPixChemistryUtils;
  if (!utils) {
    logError("MathPixChemistryDescriptions: MathPixChemistryUtils not found — check script load order");
    return;
  }
  const internals = utils._descriptionInternals;
  if (!internals) {
    logError("MathPixChemistryDescriptions: _descriptionInternals not exposed — utils version mismatch");
    return;
  }

  // Destructure shared dependencies
  // Phase 12-5c-2 (D2 = C): consume _getCachedGraph rather than _graphCache
  // directly — chokepoint guarantees canonicalised key lookup, no path to
  // the raw Map from this consumer file. (Binding trimmed at Phase 14-1d
  // Step 5 — vestigial post-move; see Rule A summary below.)
  // Phase 14-1d Step 6 Rule A trim: FEATURE_FLAGS + _formatFormulaUnicode
  // destructures retired — sole consumers (the 4 public wrappers) moved to
  // prose.js at Step 6. Each symbol remains available via internals.X for
  // any 14-3 hygiene or future re-binding (internals.featureFlags,
  // internals.formatFormulaUnicode).

  // Phase 14-1c: classify.js shared helpers (loaded BEFORE descriptions.js;
  // see tools.html script ordering). Symbols moved out of descriptions.js
  // into classify.js are sourced from this contract. Failing loud if absent
  // surfaces script-load-order errors at page load rather than at first call.
  const classifyHelpers = window.MathpixChemistryClassify?.internals?.helpers;
  if (!classifyHelpers) {
    logError("MathpixChemistryClassify.internals.helpers not exposed — check script load order (classify.js must precede descriptions.js)");
    return;
  }
  // Phase 14-1d Steps 5-6 Rule A trim summary — destructure bindings removed
  // from descriptions.js's preamble because their sole consumers moved out
  // (analyseStructure body to classify.js at 14-1c; STD/SHORT prose helpers
  // and assemblers to prose.js at 14-1d Step 5; 4 public wrappers to prose.js
  // at 14-1d Step 6). Each symbol remains available via classifyHelpers.X
  // or internals.X for any 14-3 hygiene or future re-binding:
  //
  //   classifyHelpers (6 — Step 5 movers' direct dependencies):
  //     _enumerateRingBranchPoints, _detectSubstitutionPattern,
  //     _identifyFusedSystemName, _identifyPyrimidinePattern,
  //     _identifyPyridinonePattern, _selectNamedSystemLabel
  //   classifyHelpers (1 — Step 5 dependency dead post-move):
  //     ALKYL_NAMES (only consumer was the ALKYL_BASE_SET derivation,
  //     edit-trimmed at Step 5; ALKYL_BASE_SET re-derived in prose.js
  //     using prose.js's existing ALKYL_NAMES Step 3 binding)
  //   classifyHelpers (6 vestigial — pre-existing 14-3 hygiene candidates,
  //     orphaned at 14-1c when the analyseStructure body relocated to
  //     classify.js; cleaned up opportunistically with the Step 5 pass):
  //     _buildAdjacencyMap, _classifyRing, _classifyRingInternalCarbonyl,
  //     _detectFunctionalGroupsFromGraph, _analyseChainFromGraph,
  //     _classifyScaffold
  //   internals (1 vestigial — pre-existing 14-3 hygiene candidate,
  //     orphaned at 14-1c when the analyseStructure body relocated to
  //     classify.js; cleaned up opportunistically with the Step 5 pass):
  //     _getCachedGraph (binding consumed by the relocated analyseStructure
  //     body; the descriptions.js forwarding stub at line ~149 just
  //     delegates to MathpixChemistryClassify.analyseStructure with no
  //     graph-cache access of its own)
  //   internals (2 — Step 6 trims; consumers all moved to prose.js):
  //     featureFlags (was FEATURE_FLAGS, consumed by 4 public wrappers'
  //     gate-checks); formatFormulaUnicode (was _formatFormulaUnicode,
  //     consumed by the 2 *ForAria wrappers' unicode→spaced-formula
  //     screen-reader rewrite). Both rebound at prose.js:Step-6-preamble.
  //
  // Surviving descriptions.js preamble infrastructure:
  //   - utils, internals (source bindings)
  //   - classifyHelpers source binding (load-order canary; null-check guard
  //     above is the only consumer post-Step-6)


  // =========================================================================
  // Section A: Graph Analysis (graph → structured data)
  // =========================================================================
  // Post-Phase-14-1c: all graph-analysis functions migrated to classify.js
  // (_buildAdjacencyMap, _classifyRing, _detectFunctionalGroupsFromGraph,
  // _detectSubstitutionPattern, _analyseChainFromGraph, _classifyScaffold).
  // Section preserved as architectural anchor; empty post-cleave.
  //
  // Future growth: new motif/group detectors that belong topologically here
  // (rather than in classify.js) land in this section. If none arrive, the
  // section is a candidate for removal at Phase 15+ hygiene.


  // =========================================================================
  // Section B: Description Assembly (structured data → text)
  // =========================================================================
  // Post-Phase-14-1d Step 5: _numberWord, _groupDisplayName, _formatList,
  // and _toAriaText migrated to prose.js's internals.helpers Table 2 (see
  // namespace export block below for the Table 1 retirement note).
  // _assembleDescription remains in this section as the survivor and is the
  // load-bearing assembly path for the SHORT and STD tiers.
  //
  // Future growth: short/comprehensive tier branches inside
  // _assembleDescription or new _assembleShortDescription /
  // _assembleComprehensiveDescription functions land here.














  // Section C: Forwarding stubs (post-cleave)
  // =========================================================================
  // Five forwarding stubs preserve the legacy
  // MathPixChemistryUtils.{analyseStructure, generate*Description*}
  // names. Full implementations live in:
  //   - analyseStructure → mathpix-chemistry-classify.js (Phase 14-1c)
  //   - generate{Structural,Short}Description{,ForAria} → mathpix-chemistry-prose.js
  //     (Phase 14-1d Step 6)
  // The 3 generateComprehensive* stubs live in mathpix-chemistry-comprehensive.js
  // following the same pattern (also relocated to prose.js at Step 6).

  // Phase 14-1c step 5: forwarding stub. analyseStructure body relocated to
  // mathpix-chemistry-classify.js (full JSDoc lives there). This stub
  // preserves the legacy MathPixChemistryUtils.analyseStructure name so
  // tests + migration harness continue to resolve without edits.
  function analyseStructure() {
    return MathpixChemistryClassify.analyseStructure.apply(null, arguments);
  }

  // Phase 14-1d Step 6: local forwarding stubs. The 4 public wrappers
  // (generateStructuralDescription, generateStructuralDescriptionForAria,
  // generateShortDescription, generateShortDescriptionForAria) relocated to
  // prose.js at Step 6. These stubs preserve the legacy
  // MathPixChemistryUtils.generate*Description* names so tests + migration
  // harness + downstream UI consumers continue to resolve without edits.
  // Load-order safe per the analyseStructure stub above: bodies access
  // window.MathpixChemistryProse at call-time (not IIFE-load), by which
  // point prose.js has loaded. The retired Step 5 stubs (_assembleDescription,
  // _toAriaText) orphaned when their callers moved out; their publish
  // entries STAY in prose.js's helpers contract per transit-STAY (cleave
  // manifest § 2.3).
  function generateStructuralDescription() {
    return MathpixChemistryProse.internals.helpers.generateStructuralDescription.apply(null, arguments);
  }
  function generateStructuralDescriptionForAria() {
    return MathpixChemistryProse.internals.helpers.generateStructuralDescriptionForAria.apply(null, arguments);
  }
  function generateShortDescription() {
    return MathpixChemistryProse.internals.helpers.generateShortDescription.apply(null, arguments);
  }
  function generateShortDescriptionForAria() {
    return MathpixChemistryProse.internals.helpers.generateShortDescriptionForAria.apply(null, arguments);
  }


  // =========================================================================
  // Attach to parent utils object
  // =========================================================================
  utils.analyseStructure = analyseStructure;
  utils.generateStructuralDescription = generateStructuralDescription;
  utils.generateStructuralDescriptionForAria = generateStructuralDescriptionForAria;
  utils.generateShortDescription = generateShortDescription;
  utils.generateShortDescriptionForAria = generateShortDescriptionForAria;

  // Phase 14-1d Step 5: Table 1 retired. The 9 entries (numberWord,
  // formatList, aOrAn, groupDisplayName, toAriaText, elementNames,
  // sortBranchPointsByRingAndAngle, collapseGroupList, collapseGroupListShort)
  // migrated to prose.js's internals.helpers (now Table 2, the prose-tier
  // primary publish surface). prose.js's Step 5 helpers-rebind activation
  // flips its local `helpers` reference to its own table; comprehensive.js's
  // helpers source binding rewires to window.MathpixChemistryProse at the
  // same step. Empty literal preserved here as defensive existence guard
  // (prevents prose.js's preamble null-check from firing on intermediate
  // load-order state during page boot).
  internals.helpers = {};

  logInfo("MathPixChemistryDescriptions initialised");
})();
