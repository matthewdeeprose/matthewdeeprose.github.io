/**
 * MathPix Chemistry Prose — Description-engine prose tier (alt-text, captions,
 *   comprehensive walkthrough).
 *
 * Phase 14-1d — extracted from mathpix-chemistry-descriptions.js +
 *   mathpix-chemistry-comprehensive.js
 * Source attribution: cleave manifest § 3 (move list) + § 1.1 (ownership locks).
 *   - Manifest: mathpix-scripts/docs/phase14-1b-cleave-manifest.md
 *   - Predecessor: 14-1c sealed at d32842c (chemistry-classify.js extraction);
 *     resolves via `git log --oneline d32842c -1`.
 *   - Pre-flight bind audit: clean — zero prose-tier helper references in
 *     classify.js's IIFE (verified at 14-1d Step 0).
 *
 * Owns: prose-tier shape — leaf utilities, body helpers, branch family,
 *   orchestrator, standard-tier prose helpers, STD/SHORT/COMP assemblers,
 *   public generate*Description* wrappers.
 *
 * Public surface: window.MathpixChemistryProse with seven generate*Description*
 *   functions + .internals.helpers (the 9-entry contract migrated from
 *   descriptions.js per cleave manifest § 4.2, plus transit entries during
 *   the cleave). Backwards-compat forwarding stubs in
 *   mathpix-chemistry-descriptions.js (4 stubs) and
 *   mathpix-chemistry-comprehensive.js (3 stubs) preserve the legacy
 *   MathPixChemistryUtils.generate*Description* names — tests + harness require
 *   zero updates.
 *
 * Tier-consistency invariant: STD (caption), SHORT (alt-text/aria-label),
 *   COMP (expandable walkthrough) share data sources but have independent
 *   assembly paths. Any change to prose-order, collapse, scaffold phrase, or
 *   word list of one tier must include an audit of the other two tiers (see
 *   CLAUDE.md "Description-engine tier consistency invariant").
 *
 * Must load AFTER mathpix-chemistry-descriptions.js. This is a load-time
 *   dependency — descriptions.js populates internals.helpers inside its IIFE
 *   body; prose.js reads internals.helpers at IIFE-load time (late-bound to
 *   support Step 5 helpers-table transition). Run-time forwarding stubs in
 *   descriptions.js + comprehensive.js call MathpixChemistryProse.X.apply at
 *   call-time, by which point both IIFEs have loaded.
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
      console.error("[ChemProse]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ChemProse]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ChemProse]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ChemProse]", message, ...args);
  }

  // =========================================================================
  // Dependency check
  // =========================================================================
  const utils = window.MathPixChemistryUtils;
  if (!utils) {
    logError("MathpixChemistryProse: MathPixChemistryUtils not found — check script load order");
    return;
  }
  const internals = utils._descriptionInternals;
  if (!internals) {
    logError("MathpixChemistryProse: _descriptionInternals not exposed — utils version mismatch");
    return;
  }

  // Phase 14-1d: classify.js shared helpers (loaded BEFORE descriptions.js
  // BEFORE prose.js; see tools.html script ordering). Failing loud surfaces
  // script-load-order errors at page load rather than at first call.
  // Per Rule A: classifyHelpers destructures land per-step as callers arrive:
  // Step 2 binds implicitHydrogens + identifyFusedSystemName; Step 3 binds
  // alkylNames; Step 4 binds enumerateRingBranchPoints +
  // detectSubstitutionPattern + identifyPyrimidinePattern +
  // identifyPyridinonePattern; Step 5 binds selectNamedSystemLabel.
  // (Step 6's analyseStructure binding is namespace-level via
  // window.MathpixChemistryClassify.analyseStructure — co-located with
  // the public wrappers; not part of the classifyHelpers destructure chain.)
  const classifyHelpers = window.MathpixChemistryClassify?.internals?.helpers;
  if (!classifyHelpers) {
    logError("MathpixChemistryClassify.internals.helpers not exposed — check script load order (classify.js must precede prose.js)");
    return;
  }

  // Phase 14-1d Step 2: classify.js helpers consumed by Step 2 moves.
  const _implicitHydrogens = classifyHelpers.implicitHydrogens;
  const _identifyFusedSystemName = classifyHelpers.identifyFusedSystemName;

  // Phase 14-1d Step 2: internals direct destructure (consumed by _buildOpener).
  const _formatFormulaUnicode = internals.formatFormulaUnicode;

  // Phase 14-1d Step 3: classify.js helpers consumed by Step 3 moves
  // (ALKYL_NAMES used by _walkAndDescribeBranches for n-carbon-chain labels).
  const ALKYL_NAMES = classifyHelpers.alkylNames;

  // Phase 14-1d Step 4: classify.js helpers consumed by Step 4 moves
  // (all four are residual users inside _buildComprehensiveSections —
  // ring-branch enumeration, substitution-pattern detection, and named
  // heteroaromatic-ring identification).
  const _enumerateRingBranchPoints = classifyHelpers.enumerateRingBranchPoints;
  const _detectSubstitutionPattern = classifyHelpers.detectSubstitutionPattern;
  const _identifyPyrimidinePattern = classifyHelpers.identifyPyrimidinePattern;
  const _identifyPyridinonePattern = classifyHelpers.identifyPyridinonePattern;
  // Phase 17 (KD-13): teaching-facing ring aromaticity — perceived aromatic AND
  // < 2 exocyclic ring carbonyls. The description tiers consume this instead of
  // the raw ring.aromatic so a taught-non-aromatic dione ring drops the
  // "aromatic" claim; ring.aromatic and every classification gate keyed on it
  // are left untouched.
  const _isTaughtAromatic = classifyHelpers.isTaughtAromatic;

  // Phase 14-1d Step 5: classify.js helper consumed by Step 5 movers.
  // _assembleDescription + _assembleShortDescription use this for named-
  // system label selection on fused-ring + chain hosts.
  const _selectNamedSystemLabel = classifyHelpers.selectNamedSystemLabel;

  // Phase 14-1d Step 5: derived constant. classifyHelpers.alkylNames is the
  // canonical alkyl-name array (Step 3 binding ALKYL_NAMES); .slice(1) drops
  // the empty-string slot at index 0 to form a Set of bare alkyl bases for
  // _isAlkylShortName's substituent-recognition path.
  const ALKYL_BASE_SET = new Set(ALKYL_NAMES.slice(1));

  // Phase 17 (KD-14): principal-characteristic-group seniority cascade, read
  // live from classify.js's internals (the ranking source of truth per
  // CLAUDE.md § 148 — NOT forked here). Consumed by the shared seniority
  // comparator _orderGroupsBySeniority below. Fall back to an empty array if
  // the classify export is older than this field, so the comparator's deferral
  // guard degrades safely to "defer everything" (order untouched) rather than
  // throwing.
  const PCG_CASCADE = Array.isArray(classifyHelpers.pcgCascade)
    ? classifyHelpers.pcgCascade
    : [];
  if (!Array.isArray(classifyHelpers.pcgCascade)) {
    logWarn("classifyHelpers.pcgCascade not exposed — KD-14 seniority ordering will defer on every list (order untouched)");
  }

  // Phase 14-1d: late-bound helpers reference. Pre-Step-5 this resolves to
  // descriptions.js's internals.helpers table (the 9 prose-tier entries that
  // descriptions.js still owns at Steps 1-4). Post-Step-5 rebound to prose.js's
  // own internals.helpers table after the 9 entries move + prose.js's namespace
  // export publishes the table. Function bodies capture `helpers` by closure,
  // so the Step 5 rebind is visible to all subsequent calls without any
  // semantic change to moved bodies. `let` (not `const`) supports the rebind.
  let helpers = internals.helpers;
  if (!helpers) {
    logError("internals.helpers not exposed — descriptions.js must load before prose.js");
    return;
  }

  // =========================================================================
  // Constants
  //   Step 1 native (relocated from comprehensive.js): BOND_NAMES,
  //     SIZE_WORDS, ORDINALS.
  //   Step 5 (relocated from descriptions.js): ELEMENT_NAMES,
  //     ALKYL_VOWEL_SOUND_PREFIXES, FUSED_SYSTEM_SYSTEMATIC. Plus ALKYL_BASE_SET
  //     re-derived in the preamble above from classifyHelpers.alkylNames.
  //   ALKYL_SHORTHANDS canonicalised in classify.js per fix-commit 2a1bc4a;
  //     prose.js can consume via classifyHelpers.alkylShorthands if a
  //     future consumer arrives.
  // =========================================================================

  const BOND_NAMES = { "-": "single", "=": "double", "#": "triple" };
  const SIZE_WORDS = { 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };
  const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

  // Phase 8C-2: Element symbol → British English name mapping
  const ELEMENT_NAMES = {
    C: "carbon", H: "hydrogen", O: "oxygen", N: "nitrogen",
    S: "sulphur", P: "phosphorus", F: "fluorine", Cl: "chlorine",
    Br: "bromine", I: "iodine", B: "boron", Si: "silicon",
    Se: "selenium", Fe: "iron", Cu: "copper", Zn: "zinc",
  };

  // Attachment elements whose single-letter name begins with a vowel sound
  // ("en", "oh", "ess") — used to pick "a" vs "an" for prefixed alkyl labels.
  const ALKYL_VOWEL_SOUND_PREFIXES = new Set(["N", "O", "S", "F", "H"]);

  // Phase 10-4 (CT-4d-named): systematic-name parentheticals for named fused
  // systems whose common name is not self-explanatory. "Xanthine" means little
  // without "(purine-2,6-dione)"; "naphthalene" / "indole" / "quinoline" /
  // "purine" stand on their own, so no parenthetical is emitted for them.
  const FUSED_SYSTEM_SYSTEMATIC = {
    xanthine: "purine-2,6-dione",
  };

  // Phase 15-2c (LOCK 3): amine subtype labels. Emitted at sites that
  // already know the molecule context warrants subtype emission (e.g. the
  // simple-molecule shortcut for methylamine, the central-heteroatom
  // dispatch arms for dimethylamine / trimethylamine). NOT spliced into
  // _groupDisplayName / _shortGroupName because guanidine + urea also
  // carry subtype=1 amine groups and their corrected baselines emit the
  // bare "amine" label — propagating the subtype label there would
  // regress those migration fixtures (post-baseline-correction).
  const AMINE_SUBTYPE_NAMES = { 1: "primary amine", 2: "secondary amine", 3: "tertiary amine" };

  // =========================================================================
  // Comprehensive-tier leaf utilities (Step 1)
  //   _elem, _elementName, _aOrAnElement, _ordinal,
  //   _locantOrder, _describeHeteroatoms, _ringComposition
  // =========================================================================

  function _elem(vertex) { return vertex?.value?.element || "C"; }
  function _elementName(symbol) { return helpers.elementNames[symbol] || symbol.toLowerCase(); }
  function _aOrAnElement(elemName) { return /^[aeiou]/i.test(elemName) ? "an" : "a"; }
  function _ordinal(n) { return ORDINALS[n] || String(n) + "th"; }

  // Phase 11-2c: sort locant labels (e.g. "C8", "N1", "N7") for the tail
  // prose so heteroatoms read first, mirroring the bucket-list element sort
  // ("two N–H, and one C–H₂"). N before O before C, then by locant number.
  function _locantOrder(label) {
    const elementPriority = { N: 0, O: 1, C: 2 };
    const m = /^([NCO])([0-9]+)$/.exec(label);
    if (!m) return 9999;
    return (elementPriority[m[1]] ?? 9) * 1000 + Number(m[2]);
  }

  function _describeHeteroatoms(heteroatoms) {
    const counts = {};
    for (const h of heteroatoms) counts[h] = (counts[h] || 0) + 1;
    const parts = [];
    for (const [sym, count] of Object.entries(counts)) {
      const name = _elementName(sym);
      parts.push((count === 1 ? "one " : helpers.numberWord(count) + " ") + name + " atom" + (count !== 1 ? "s" : ""));
    }
    return helpers.formatList(parts);
  }

  /** Build a ring composition clause, e.g. "one nitrogen atom, and five carbon atoms". */
  function _ringComposition(ring) {
    const heteroCount = ring.heteroatoms.length;
    const carbonCount = ring.size - heteroCount;
    if (heteroCount === 0) {
      return helpers.numberWord(carbonCount) + " carbon atoms";
    }
    return helpers.formatList([
      _describeHeteroatoms(ring.heteroatoms),
      helpers.numberWord(carbonCount) + " carbon atom" + (carbonCount !== 1 ? "s" : ""),
    ]);
  }

  // =========================================================================
  // Comprehensive-tier body helpers (Step 2)
  //   _buildOpener, _buildImplicitHydrogenTail, _describeRingTopology,
  //   _describeFusedRingSystem, _describeJoinedRingSystem
  //   ⚠ KD-1 + KD-2 ride through unchanged BY DESIGN — Phase 15 closes;
  //   biphenyl baseline pins the defective sentences as regression bytes.
  // =========================================================================

  /**
   * Phase 10-2: unified implicit-hydrogen tail for single-ring, fused-ring,
   * and joined-ring systems. Replaces the single-ring-only, element-filtered,
   * one-H-per-atom logic that missed G5 (fused rings), G15 (N-H/O-H ring
   * atoms), G20 (fused-ring tail entirely), and N7 (per-atom H count for
   * sp³ ring members such as barbituric acid C5).
   *
   * Iterates all ring atoms not claimed by a branch, tallies per-atom
   * implicit H's via _implicitHydrogens, and emits:
   *   - compact "each carry an implicit hydrogen atom" prose when every
   *     qualifying atom is C with count 1 (preserves aspirin/benzaldehyde/
   *     naphthalene phrasing)
   *   - bucket-list "carry implicit hydrogens: two N–H and one C–H₂" prose
   *     otherwise (uracil, cytosine, thymine, theobromine, barbituric acid)
   *
   * Phase 11-2c: optionally substitutes per-atom locants into the prose when
   * `namedSystem` resolves to a system in the locant table AND every entry
   * has count === 1 (sub-option (i): bucket fallback preserves the Phase 10-2
   * (CH₂) notation for sp³ ring carbons such as barbituric acid C5).
   *
   * @param {Iterable<number>} ringMemberIds all ring atom vertex IDs
   * @param {Set<number>} excludedIds       atoms already described by branches
   * @param {Object} graphData              _graphData (vertex lookup)
   * @param {Map} adjacency                 _adjacency (bond info)
   * @param {string|null} namedSystem       e.g. "xanthine", "purine",
   *                                         "pyrimidine-2,4-dione" — null
   *                                         when the host system has no
   *                                         locant table key
   * @param {Array|null} rings              ring objects for the host system
   *                                         (forwarded to mapAtomToLocant)
   * @returns {Array<string>}               tail sentence(s), or [] if none
   * @private
   */
  function _buildImplicitHydrogenTail(ringMemberIds, excludedIds, graphData, adjacency, namedSystem, rings) {
    const entries = [];
    for (const id of ringMemberIds) {
      if (excludedIds.has(id)) continue;
      const vertex = graphData.graph.vertices.find(v => v.id === id);
      if (!vertex) continue;
      const count = _implicitHydrogens(_elem(vertex), id, adjacency);
      if (count > 0) entries.push({ element: _elem(vertex), count, atomId: id });
    }
    if (entries.length === 0) return [];

    const totalAtoms = entries.length;
    const allCarbon = entries.every(e => e.element === "C");
    const uniformCount1 = entries.every(e => e.count === 1);

    // Phase 11-2c: attempt per-atom locant resolution. Gated by uniformCount1
    // so multi-H ring atoms (barbituric acid C5 → CH₂) fall back to the
    // bucket branch and keep their (CH₂) notation per Phase 10-2.
    let locantList = null;
    if (uniformCount1 && namedSystem && rings && window.MathPixChemistryLocants) {
      const ringMemberSet = new Set(ringMemberIds);
      const graphDataLike = { graph: graphData.graph, rings };
      const resolved = entries.map(e => ({
        atomId: e.atomId,
        locant: window.MathPixChemistryLocants.mapAtomToLocant(
          ringMemberSet, e.atomId, namedSystem, graphDataLike),
      }));
      // All-or-nothing: if any atom fails to resolve, fall back to bucket
      // prose so partial-resolution prose ("N1, ?, and C8") is impossible.
      if (resolved.every(r => r.locant)) {
        resolved.sort((a, b) => _locantOrder(a.locant.locant) - _locantOrder(b.locant.locant));
        locantList = resolved.map(r => r.locant.locant);
      }
    }

    if (allCarbon && uniformCount1) {
      // Use "bonded to" rather than "carries" so the compact phrasing includes
      // connectivity language. Naphthalene has no branches to contribute
      // "bond"/"connected"/"attached" elsewhere, and an implicit-H tail that
      // crossed the 8C-CT ≥30-word threshold would otherwise fail the
      // connectivity-language assertion. Drops the awkward "one" when a
      // single ring position remains (caffeine), matching how a chemist
      // would naturally describe a single site.
      if (totalAtoms === 1) {
        if (locantList) {
          return ["The remaining ring position, " + locantList[0] +
            ", is bonded to an implicit hydrogen atom."];
        }
        return ["The remaining ring position is bonded to an implicit hydrogen atom."];
      }
      return ["The remaining " + helpers.numberWord(totalAtoms) +
        " ring positions are each bonded to an implicit hydrogen atom."];
    }

    if (locantList) {
      const positionsWord = totalAtoms === 1 ? "position" : "positions";
      return ["The remaining " + helpers.numberWord(totalAtoms) + " ring " + positionsWord +
        " carry implicit hydrogens: " + helpers.formatList(locantList) + "."];
    }

    const subscripts = { 1: "", 2: "₂", 3: "₃", 4: "₄" };
    const buckets = new Map();
    for (const e of entries) {
      const key = e.element + ":" + e.count;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    // Sort heteroatom buckets before carbon so prose reads "two N–H and one
    // C–H₂", which matches how a chemist would describe the ring — ties
    // broken alphabetically by element then by H count.
    const sortedKeys = [...buckets.keys()].sort((a, b) => {
      const [ea, ha] = a.split(":");
      const [eb, hb] = b.split(":");
      if (ea === "C" && eb !== "C") return 1;
      if (eb === "C" && ea !== "C") return -1;
      if (ea !== eb) return ea < eb ? -1 : 1;
      return Number(ha) - Number(hb);
    });
    const parts = [];
    for (const key of sortedKeys) {
      const [element, countStr] = key.split(":");
      const hCount = Number(countStr);
      const atomCount = buckets.get(key);
      parts.push(helpers.numberWord(atomCount) + " " + element + "–H" + (subscripts[hCount] || ""));
    }
    const positionsWord = totalAtoms === 1 ? "position" : "positions";
    return ["The remaining " + helpers.numberWord(totalAtoms) + " ring " + positionsWord +
      " carry implicit hydrogens: " + helpers.formatList(parts) + "."];
  }

  /** Describe a single ring's topology (Phase 8C-CT-3a B7: append composition for named heteroatom rings). */
  function _describeRingTopology(classifiedRing, graphData, adjacency) {
    const sizeWord = SIZE_WORDS[classifiedRing.size] || String(classifiedRing.size);
    // Phase 17 (KD-13): a taught-non-aromatic ring (perceived aromatic but
    // carrying two ring carbonyls) that resolves to a systematic dione/lactam
    // name is described by size + that name — no "aromatic" claim and no
    // aromatic-parent noun. Falls through pyrimidine→pyridinone exactly as the
    // STD/SHORT tiers do; the composition tail is unchanged. Otherwise the
    // existing named-aromatic path below runs untouched.
    if (!_isTaughtAromatic(classifiedRing, graphData, adjacency)) {
      const systematic = _identifyPyrimidinePattern(classifiedRing, graphData, adjacency)
        || _identifyPyridinonePattern(classifiedRing, graphData, adjacency);
      if (systematic) {
        let desc = "a " + sizeWord + "-membered ring (" + systematic + ")";
        if (classifiedRing.heteroatoms.length > 0) {
          desc += ", containing " + _ringComposition(classifiedRing);
        }
        return desc;
      }
    }
    // Phase 12-5c-3 (D3 = A): named-aromatic phrase from utils helper. Single
    // source in mathpix-chemistry-utils.js's `NAMED_AROMATIC_RINGS` map.
    const namedPhrase = utils.getNamedAromaticPhrase(classifiedRing.type);
    if (namedPhrase) {
      let desc = namedPhrase;
      if (classifiedRing.heteroatoms.length > 0) {
        desc += ", containing " + _ringComposition(classifiedRing);
      }
      return desc;
    }
    if (classifiedRing.aromatic) {
      let desc = "a " + sizeWord + "-membered aromatic ring";
      if (classifiedRing.heteroatoms.length > 0) desc += " containing " + _describeHeteroatoms(classifiedRing.heteroatoms);
      return desc;
    }
    let desc = "a " + sizeWord + "-membered ring";
    if (classifiedRing.heteroatoms.length > 0) {
      desc += " containing " + _describeHeteroatoms(classifiedRing.heteroatoms);
    } else {
      desc += " with all " + sizeWord + " positions occupied by carbon atoms";
    }
    return desc;
  }

  /** Describe a fused ring system (Phase 8C-CT-3a B4: aggregation + aromaticity + named systems). */
  function _describeFusedRingSystem(rings, graphData, adjacency) {
    const parts = [];
    const namedSystem = _identifyFusedSystemName(rings, graphData, adjacency);
    // Phase 17 (KD-13): describe teaching-facing aromaticity, not RDKit's raw
    // perception — a dione six-ring loses the "aromatic" prefix (and its "an"
    // article) while a genuinely-aromatic fused ring keeps both. Grouping derives
    // from the same predicate so the prefix and the signature agree.
    const taughtAromatic = r => _isTaughtAromatic(r, graphData, adjacency);
    const sigOf = r => r.size + "|" + taughtAromatic(r) + "|" + r.heteroatoms.slice().sort().join(",");
    const allIdentical = rings.every(r => sigOf(r) === sigOf(rings[0]));

    let sharingPhrase = " sharing edges";
    if (rings.length === 2) {
      const set0 = new Set(rings[0].memberVertexIds);
      const sharedCount = rings[1].memberVertexIds.filter(id => set0.has(id)).length;
      sharingPhrase = sharedCount === 2 ? " sharing an edge" : " sharing " + helpers.numberWord(sharedCount) + " atoms";
    }

    const countWord = helpers.numberWord(rings.length);
    let opening;
    if (allIdentical) {
      const sample = rings[0];
      const sizeWord = SIZE_WORDS[sample.size] || String(sample.size);
      const aromaticPrefix = taughtAromatic(sample) ? "aromatic " : "";
      opening = "The structure is built on " + countWord + " fused " + aromaticPrefix + sizeWord + "-membered rings" + sharingPhrase;
    } else {
      const ringDescs = rings.map(r => {
        const sizeWord = SIZE_WORDS[r.size] || String(r.size);
        const aromaticPrefix = taughtAromatic(r) ? "aromatic " : "";
        return "a" + (taughtAromatic(r) ? "n " : " ") + aromaticPrefix + sizeWord + "-membered ring";
      });
      if (rings.length === 2) {
        opening = "The structure is built on two fused rings" + sharingPhrase + ": " + ringDescs[0] + " and " + ringDescs[1];
      } else {
        opening = "The structure is built on " + countWord + " fused rings: " + helpers.formatList(ringDescs);
      }
    }
    if (namedSystem) opening += " (" + namedSystem + ")";
    parts.push(opening + ".");

    // Composition: aggregate by signature
    const bySig = new Map();
    const sigOrder = [];
    for (const r of rings) {
      const s = sigOf(r);
      if (!bySig.has(s)) { bySig.set(s, []); sigOrder.push(s); }
      bySig.get(s).push(r);
    }
    for (const s of sigOrder) {
      const group = bySig.get(s);
      const sample = group[0];
      const sizeWord = SIZE_WORDS[sample.size] || String(sample.size);
      const aromaticPrefix = taughtAromatic(sample) ? "aromatic " : "";
      const compDesc = _ringComposition(sample);
      let subject;
      if (group.length === rings.length && rings.length > 1) {
        subject = "Each ring contains ";
      } else if (group.length > 1) {
        subject = "Each " + aromaticPrefix + sizeWord + "-membered ring contains ";
      } else {
        subject = "The " + aromaticPrefix + sizeWord + "-membered ring contains ";
      }
      parts.push(subject + compDesc + ".");
    }
    return parts.join(" ");
  }

  /** Phase 8C-CT-3a B1: describe multiple rings joined by bonds (not fused). */
  function _describeJoinedRingSystem(rings, graphData, adjacency) {
    const parts = [];
    // Phase 17 (KD-13): teaching-facing aromaticity for the joined-ring prose,
    // matching _describeFusedRingSystem — grouping and prefix share the predicate.
    const taughtAromatic = r => _isTaughtAromatic(r, graphData, adjacency);
    const sigOf = r => r.size + "|" + taughtAromatic(r) + "|" + r.heteroatoms.slice().sort().join(",");
    const allIdentical = rings.every(r => sigOf(r) === sigOf(rings[0]));
    const countWord = helpers.numberWord(rings.length);

    // Find connecting bonds between distinct rings
    const connectingBonds = [];
    for (let i = 0; i < rings.length; i++) {
      const setI = new Set(rings[i].memberVertexIds);
      for (let j = i + 1; j < rings.length; j++) {
        const setJ = new Set(rings[j].memberVertexIds);
        for (const aI of rings[i].memberVertexIds) {
          for (const n of (adjacency.get(aI) || [])) {
            if (setJ.has(n.vertex.id) && !setI.has(n.vertex.id)) {
              connectingBonds.push({ bondType: n.edge.bondType });
            }
          }
        }
      }
    }
    const bondCount = connectingBonds.length;
    const bondTypes = [...new Set(connectingBonds.map(b => b.bondType))];
    let bondPhrase = "bonds";
    if (bondCount === 1) {
      bondPhrase = "a " + (BOND_NAMES[connectingBonds[0].bondType] || "single") + " bond";
    } else if (bondCount > 1 && bondTypes.length === 1) {
      bondPhrase = helpers.numberWord(bondCount) + " " + (BOND_NAMES[bondTypes[0]] || "single") + " bonds";
    }

    // Phase 15-1a (KD-2): track whether this function emitted the special-
    // case sentence that already accounts for per-ring implicit H atoms +
    // inter-ring connectivity. The caller in _buildComprehensiveSections
    // uses this flag to skip _buildImplicitHydrogenTail and avoid the
    // duplicate "The remaining N ring positions..." sentence. False unless
    // the simple-identical-rings branch fires below.
    let coversImplicitHydrogens = false;
    if (allIdentical) {
      const sample = rings[0];
      const sizeWord = SIZE_WORDS[sample.size] || String(sample.size);
      const aromaticPrefix = taughtAromatic(sample) ? "aromatic " : "";
      let ringDesc = countWord + " " + aromaticPrefix + sizeWord + "-membered rings";
      // Benzene special case
      if (sample.size === 6 && taughtAromatic(sample) && sample.heteroatoms.length === 0) {
        ringDesc += " (benzenes)";
      }
      parts.push("The structure consists of " + ringDesc + " joined by " + bondPhrase + ".");
      // Position/implicit hydrogen detail for simple identical rings
      if (rings.length === 2 && sample.heteroatoms.length === 0 && bondCount === 1) {
        const implicitCount = sample.size - 1;
        parts.push("Each ring has " + helpers.numberWord(implicitCount) + " carbon atoms carrying implicit hydrogens; the remaining position of each ring connects to the other ring.");
        coversImplicitHydrogens = true;
      } else {
        parts.push("Each ring contains " + _ringComposition(sample) + ".");
      }
    } else {
      const ringDescs = rings.map(r => {
        const sizeWord = SIZE_WORDS[r.size] || String(r.size);
        const aromaticPrefix = taughtAromatic(r) ? "aromatic " : "";
        return "a" + (taughtAromatic(r) ? "n " : " ") + aromaticPrefix + sizeWord + "-membered ring";
      });
      parts.push("The structure consists of " + helpers.formatList(ringDescs) + " joined by " + bondPhrase + ".");
      for (const r of rings) {
        const sizeWord = SIZE_WORDS[r.size] || String(r.size);
        const aromaticPrefix = taughtAromatic(r) ? "aromatic " : "";
        parts.push("The " + aromaticPrefix + sizeWord + "-membered ring contains " + _ringComposition(r) + ".");
      }
    }
    return { text: parts.join(" "), coversImplicitHydrogens };
  }

  /**
   * Phase 15-1a (KD-1): short-form scaffold sentence for joined non-fused
   * ring systems. Companion to _describeJoinedRingSystem (COMP-tier formality);
   * emits terser STD/SHORT-tier prose:
   *
   *   biphenyl → "Two benzene rings joined by a single bond"
   *
   * Used by both _assembleDescription (STD) and _assembleShortDescription
   * (SHORT) so the two tiers agree on scaffold phrasing (description-engine
   * tier consistency invariant). No terminating period; caller adds.
   *
   * Returns null when rings are non-identical so callers can fall through to
   * a generic shape. Phase 15-1a fixture coverage is biphenyl (identical
   * rings) only; non-identical joined-ring molecules carry-forward to Phase
   * 15+ — when a fixture is added that exercises that path, surface a STD/
   * SHORT silent-no-op finding and design a fallback template.
   *
   * @param {Object[]} rings - classified rings (length > 1)
   * @param {Object} graphData - SmilesDrawer graph
   * @param {Map} adjacency - precomputed adjacency map
   * @returns {string|null}
   * @private
   */
  function _describeJoinedRingScaffoldShort(rings, graphData, adjacency) {
    // Identical-rings check — mirrors _describeJoinedRingSystem's sigOf gate.
    const sigOf = r => r.size + "|" + r.aromatic + "|" + r.heteroatoms.slice().sort().join(",");
    if (!rings.every(r => sigOf(r) === sigOf(rings[0]))) return null;
    const sample = rings[0];
    // Compute connecting bonds — mirrors _describeJoinedRingSystem's bond-
    // phrase logic exactly so COMP "joined by a single bond" and STD/SHORT
    // "joined by a single bond" agree byte-for-byte for identical molecules.
    const connectingBonds = [];
    for (let i = 0; i < rings.length; i++) {
      const setI = new Set(rings[i].memberVertexIds);
      for (let j = i + 1; j < rings.length; j++) {
        const setJ = new Set(rings[j].memberVertexIds);
        for (const aI of rings[i].memberVertexIds) {
          for (const n of (adjacency.get(aI) || [])) {
            if (setJ.has(n.vertex.id) && !setI.has(n.vertex.id)) {
              connectingBonds.push({ bondType: n.edge.bondType });
            }
          }
        }
      }
    }
    const bondCount = connectingBonds.length;
    const bondTypes = [...new Set(connectingBonds.map(b => b.bondType))];
    let bondPhrase = "bonds";
    if (bondCount === 1) {
      bondPhrase = "a " + (BOND_NAMES[connectingBonds[0].bondType] || "single") + " bond";
    } else if (bondCount > 1 && bondTypes.length === 1) {
      bondPhrase = helpers.numberWord(bondCount) + " " + (BOND_NAMES[bondTypes[0]] || "single") + " bonds";
    }
    const countWord = helpers.numberWord(rings.length);
    const capitalised = countWord.charAt(0).toUpperCase() + countWord.slice(1);
    return capitalised + " " + sample.type + " rings joined by " + bondPhrase;
  }

  // Phase 15-2a: L15 lexical-suppression stereo prefix derivation. Consumes
  // analysis.stereoEmission (from classifier _classifyStereoEmission) + the
  // PubChem display name. Suppresses prefix when name already lexically
  // carries a stereo descriptor.
  //
  // Phase 16-2a (KD-4 + KD-7):
  //   • L15 broadened to also match locant-prefixed combined descriptors
  //     (e.g. "(2S,3E)-") so a name already carrying them is not double-
  //     emitted; the original "(R)-"/"(S)-"/"(E)-"/"(Z)-"/cis-/trans- set
  //     is preserved (the new pattern is a strict superset).
  //   • Locant-prefixed ascending-locant concatenation: bond E/Z and any
  //     combined atom+bond case render "(2E)-" / "(2S,3E)-", with locants
  //     drawn from the IUPAC-ordered chain (anchored on the principal FG —
  //     matches the name's own suffix numbering).
  //   • A lone atom-CIP stereocentre keeps the legacy un-locanted "(R)-"/
  //     "(S)-" form (preserves the 15-2a tier-1 #1/#4 openers; KD-6 owns
  //     the later redundant-CIP suppression).
  // chain + adjacency are optional — when absent (ring stereo, out of tier
  // scope) the descriptors render without locants rather than not at all.
  function _deriveStereoPrefix(stereoEmission, name, chain, adjacency) {
    if (!stereoEmission || !name) return "";
    const { atomCIP = [], bondEZ = [] } = stereoEmission;
    if (atomCIP.length === 0 && bondEZ.length === 0) return "";

    // KD-6 (Phase 16-2b): Fischer-convention-aware suppression, BEFORE the L15
    // lexical match. When the PubChem name already leads with a capital Fischer
    // descriptor (e.g. "L-alanine", "D-glucose"), that authoritative name
    // already encodes the stereochemistry in the convention the curriculum
    // teaches for amino acids/sugars. Emit nothing so the opener shows the name
    // verbatim ("L-alanine"), not the redundant double-described "(S)-L-alanine".
    //
    // Suppress-don't-map: nothing is converted between conventions — there is no
    // L→S / D→R table and (deliberately) no cysteine carve-out. The name is
    // shown as-is and the computed CIP descriptor is dropped; that is the whole
    // behaviour change.
    //
    // Case-sensitive (/^[LD]-/, NO `i` flag) is the over-suppression guard: only
    // a capital L-/D- triggers suppression. A lowercase or non-Fischer leading
    // letter falls through to the L15 match below, so a non-Fischer name with a
    // computed stereocentre keeps its prefix. Racemic "DL-" names do not match
    // /^[LD]-/ (the second char is "L", not "-") and correctly fall through.
    if (/^[LD]-/.test(name)) return "";

    if (/^(\(\d*[srez](,\d*[srez])*\)|cis|trans)-/i.test(name)) return "";

    // Lone atom-CIP stereocentre → legacy un-locanted form (tier-1 #1/#4).
    if (atomCIP.length === 1 && bondEZ.length === 0) {
      return "(" + atomCIP[0].code + ")-";
    }

    // Resolve chain locants once (null for non-chain scaffolds).
    let chainOrder = null;
    if (chain && chain._atomSet && adjacency) {
      chainOrder = _orderChainAtoms(chain._atomSet, adjacency, chain.principalFGAnchor);
    }
    const locantOf = (atomId) => {
      if (!chainOrder) return null;
      const pos = chainOrder.indexOf(atomId);
      return pos >= 0 ? pos + 1 : null;
    };

    const descriptors = [];
    for (const a of atomCIP) {
      descriptors.push({ locant: locantOf(a.atomId), code: a.code });
    }
    for (const b of bondEZ) {
      const l1 = locantOf(b.sourceId);
      const l2 = locantOf(b.targetId);
      const locant =
        l1 != null && l2 != null ? Math.min(l1, l2) : l1 != null ? l1 : l2;
      descriptors.push({ locant, code: b.code });
    }
    if (descriptors.length === 0) return "";

    // KD-7: ascending-locant ordering; un-locanted entries sort last (stable).
    descriptors.sort((x, y) => {
      if (x.locant == null && y.locant == null) return 0;
      if (x.locant == null) return 1;
      if (y.locant == null) return -1;
      return x.locant - y.locant;
    });

    const inner = descriptors
      .map((d) => (d.locant != null ? d.locant : "") + d.code)
      .join(",");
    return "(" + inner + ")-";
  }

  // Phase 16-2c (P-14.5.2): leading italicised affixes stay lower-case.
  //
  // The three opener handlers capitalise the opener via
  // displayName.charAt(0).toUpperCase(). When displayName (a name, or a
  // stereo-prefixed name) begins with an italicised P-14.5.2 affix, that wrongly
  // emits "Tert-butanol" / "Cis-2-butene" / "Trans-2-butene". IUPAC P-14.5.2
  // keeps the affix lower-case. Minimal rule: if displayName begins with an
  // affix from the set, leave it exactly as given (affix lower-case, the rest
  // keeps its own casing — no stem rewrite, per the 15-3 ruling); otherwise
  // capitalise the first character as before.
  //
  // Case-sensitive, leading-token match. The n-/N- distinction is load-bearing:
  // lower-case "n-" (normal-, a structural affix) matches; capital "N-" (a
  // nitrogen-substituent locant) is a legitimately different affix and MUST keep
  // its capital. The set therefore holds lower-case "n-" only and startsWith is
  // case-sensitive, so "N-methyl…" never matches.
  //
  // Deferred (no fixture exercises them; the single-letter forms risk false
  // matches): o-/m-/p-/ortho-/meta-/para-. Extend the constant when needed.
  //
  // One shared helper called at all three opener sites → tier-consistent by
  // construction (L11), matching the stereo-prefix three-site pattern.
  const P1452_ITALIC_AFFIXES = ["tert-", "sec-", "n-", "cis-", "trans-"];

  function _capitaliseOpener(displayName) {
    if (!displayName) return displayName;
    for (const affix of P1452_ITALIC_AFFIXES) {
      if (displayName.startsWith(affix)) return displayName;
    }
    return displayName.charAt(0).toUpperCase() + displayName.slice(1);
  }

  function _buildOpener(pubchemData, stereoEmission, chain, adjacency) {
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    const name = commonName || iupacName || null;
    const formula = pubchemData?.inchi ? utils.parseInChIFormula(pubchemData.inchi) : null;
    const weight = pubchemData?.molecularWeight;
    const formulaUnicode = formula ? _formatFormulaUnicode(formula.raw) : null;
    let opener = "";
    if (name) {
      // Phase 16-2a: chain + adjacency feed locant-prefixed stereo (KD-4/KD-7).
      const stereoPrefix = _deriveStereoPrefix(stereoEmission, name, chain, adjacency);
      const displayName = stereoPrefix + name;
      opener = _capitaliseOpener(displayName); // P-14.5.2 affix-aware (16-2c)
    }
    if (formulaUnicode && weight) {
      const p = "(" + formulaUnicode + ", molecular weight " + weight + ")";
      opener = opener ? opener + " " + p : p;
    } else if (formulaUnicode) {
      const p = "(" + formulaUnicode + ")";
      opener = opener ? opener + " " + p : p;
    }
    return opener ? opener + "." : "";
  }

  // =========================================================================
  // Comprehensive-tier branch family (Step 3)
  //   _walkBranch, _describeBranch, _describeSubBranches,
  //   _walkAndDescribeBranches (largest move — 177 lines)
  // =========================================================================

  /** DFS walk from a ring/chain attachment point outward through the graph. */
  function _walkBranch(startVertexId, parentVertexId, graphData, adjacency, visited) {
    const steps = [];
    let currentId = startVertexId;
    let prevId = parentVertexId;
    while (true) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const currentVertex = graphData.graph.vertices.find(v => v.id === currentId);
      if (!currentVertex) break;
      const neighbours = adjacency.get(currentId) || [];
      const parentN = neighbours.find(n => n.vertex.id === prevId);
      steps.push({
        vertexId: currentId,
        element: _elem(currentVertex),
        bondType: parentN ? parentN.edge.bondType : "-",
      });
      const nextN = neighbours.filter(n => n.vertex.id !== prevId && !visited.has(n.vertex.id));
      if (nextN.length === 0) break;
      if (nextN.length === 1) { prevId = currentId; currentId = nextN[0].vertex.id; }
      else break;
    }
    return steps;
  }

  /**
   * Phase 17 (KD-15): the parenthetical implicit-hydrogen annotation for one
   * walked atom, or "" when it carries none — so call sites append it
   * unconditionally and the wording lives in exactly one place.
   */
  function _hydrogenAnnotation(step, adjacency) {
    const implicitH = _implicitHydrogens(step.element, step.vertexId, adjacency);
    if (implicitH === 0) return "";
    const count = implicitH === 1 ? "one hydrogen" : helpers.numberWord(implicitH) + " hydrogens";
    return " (bonded to " + count + ")";
  }

  /**
   * Phase 17 (KD-23): dedicated COMPREHENSIVE walk for single-carbon
   * scaffolds. The multi-carbon walker reads oddly for one carbon (the
   * Phase 10-5 finding), and the previous single-carbon branch computed
   * STANDARD's own expression over the same helpers, so COMP collapsed onto
   * STD by construction on every group-bearing single-carbon fixture.
   * Emits the walker-voice account instead: a structure sentence, one
   * attachment sentence over the shared display-name helpers (group
   * formulas stay byte-identical with STANDARD's), and an unconditional
   * hydrogen sentence stating the measured implicit-hydrogen count —
   * "no hydrogens" for a fully substituted carbon (chemistry-gate ruling:
   * an explicit zero is content STANDARD never states, and asserting
   * hydrogens that do not exist is the KD-24 falsehood class).
   */
  function _buildSingleCarbonWalk(groupLabels, graphData, adjacency) {
    const sentences = ["The structure is a single carbon."];
    if (groupLabels.length > 0) {
      sentences.push("The carbon bears " + helpers.formatList(groupLabels) + ".");
    }
    const carbon = graphData.graph.vertices.find(v => _elem(v) === "C");
    const hCount = carbon ? _implicitHydrogens("C", carbon.id, adjacency) : 0;
    const hPhrase = hCount === 0
      ? "no hydrogens"
      : hCount === 1
        ? "one hydrogen"
        : helpers.numberWord(hCount) + " hydrogens";
    sentences.push("The carbon carries " + hPhrase + ".");
    return sentences;
  }

  /** Convert walk steps into plain English prose. */
  function _describeBranch(steps, groupName, adjacency) {
    if (steps.length === 0) return "";
    const sentences = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const elemName = _elementName(step.element);
      const article = _aOrAnElement(elemName);
      const bondName = BOND_NAMES[step.bondType] || "single";
      let sentence;
      if (i === 0 && steps.length === 1) {
        sentence = article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom is attached to the ring";
      } else if (i === 0) {
        sentence = "From the ring, a " + bondName + " bond connects to " + article + " " + elemName + " atom";
      } else {
        sentence = "From this " + _elementName(steps[i - 1].element) + ", a " + bondName + " bond connects to " + article + " " + elemName + " atom";
      }

      // Phase 17 (KD-15): annotate every atom in the walk, not just a
      // single-step branch's terminal one. The gap was positional, not
      // elemental — a secondary amide's N–H and a methoxy CH₃ were both
      // silently dropped purely because their branch ran to two steps.
      // One annotation site per atom, so nothing is annotated twice.
      sentences.push(sentence + _hydrogenAnnotation(step, adjacency));
    }
    let result = sentences.join(". ") + ".";
    if (groupName) result += " This forms " + groupName + ".";
    return result;
  }

  /** Describe sub-branches from a branch point (vertex with 2+ unvisited neighbours). */
  function _describeSubBranches(vertexId, element, graphData, adjacency, visited) {
    const neighbours = (adjacency.get(vertexId) || []).filter(n => !visited.has(n.vertex.id));
    if (neighbours.length === 0) return "";
    const elemName = _elementName(element);
    const subDescs = [];
    for (const n of neighbours) {
      const subSteps = _walkBranch(n.vertex.id, vertexId, graphData, adjacency, visited);
      if (subSteps.length === 0) continue;
      const step = subSteps[0];
      const subElem = _elementName(step.element);
      const article = _aOrAnElement(subElem);
      const bondName = BOND_NAMES[step.bondType] || "single";
      let desc = "a " + bondName + " bond connects to " + article + " " + subElem + " atom";
      if (subSteps.length === 1) {
        desc += _hydrogenAnnotation(step, adjacency);
      }
      subDescs.push(desc);
    }
    if (subDescs.length === 0) return "";
    if (subDescs.length === 1) return "From this " + elemName + ", " + subDescs[0] + ".";
    return "From this " + elemName + ", " + subDescs.slice(0, -1).join(", ") + ", and " + subDescs[subDescs.length - 1] + ".";
  }

  /**
   * Walk each ring-outward branch and emit prose. If the branch reaches a
   * recognised functional group, append "This forms …"; otherwise fall back
   * to a plain methyl / methoxy / alkyl label.
   */
  function _walkAndDescribeBranches(branches, allGroups, graphData, adjacency, ringMembers, asFused, namedSystem, rings) {
    const parts = [];
    const atomToGroup = new Map();
    for (const g of (allGroups || [])) {
      for (const a of (g.atoms || [])) atomToGroup.set(a, g);
    }
    const visitedGlobal = new Set(ringMembers);

    for (let i = 0; i < branches.length; i++) {
      const br = branches[i];
      if (visitedGlobal.has(br.branchRootId)) continue;

      // Phase 9-3 (CT-4ac): intercept ring-internal C=O branches before the
      // generic walk hits them. The branch's attachment is the ring carbon
      // and the branch root is the exocyclic =O. Emit prose that preserves
      // the bond type (resolving C1 for this path) and names the motif via
      // the "This forms …" suffix, matching the existing template family.
      // The "From a … in the ring," / "From the ring," prefixes keep the
      // per-branch count machinery in sync with the HTML <li> form.
      const ringGroupAtAttach = atomToGroup.get(br.attachmentVertexId);
      if (ringGroupAtAttach &&
          (ringGroupAtAttach.shortName === "urea" || ringGroupAtAttach.shortName === "lactam")) {
        const rootVertex = graphData.graph.vertices.find(v => v.id === br.branchRootId);
        if (rootVertex && _elem(rootVertex) === "O" &&
            ringGroupAtAttach.atoms.includes(br.branchRootId)) {
          // Phase 10-7 (N4): derive flank suffix from the classifier's
          // flanking[].element array rather than a fixed per-kind string.
          // Cytosine C2 has two N flanks → "N–C(=O)–N"; uracil / thymine /
          // caffeine / barbituric acid lactams have one N + one C →
          // "N–C(=O)–C". Sort amide-type N first to preserve the existing
          // urea "N–C(=O)–N" / lactam "N–C(=O)–C" ordering convention.
          const flankElements = Array.isArray(ringGroupAtAttach.flanking)
            ? ringGroupAtAttach.flanking.map(f => f && f.element).filter(Boolean)
            : [];
          let flankA = "N";
          let flankB = ringGroupAtAttach.shortName === "urea" ? "N" : "C";
          if (flankElements.length >= 2) {
            const sorted = flankElements.slice(0, 2).sort((a, b) => {
              if (a === b) return 0;
              return a === "N" ? -1 : b === "N" ? 1 : 0;
            });
            flankA = sorted[0];
            flankB = sorted[1];
          }
          const bondTriple = flankA + "–C(=O)–" + flankB;
          const groupSuffix = ringGroupAtAttach.shortName === "urea"
            ? "a urea linkage (" + bondTriple + ")"
            : "a lactam (cyclic amide, " + bondTriple + ")";
          visitedGlobal.add(br.branchRootId);
          // Phase 10-7 (N8): single intro phrase for both fused and single-ring
          // hosts. The caller's per-ring "Ring A has …" scaffold disambiguates
          // which ring the C=O sits on; the prose doesn't need to repeat that.
          // asFused still drives plainLine vs htmlBody formatting.
          const intro = "From the ring, a double bond connects to an oxygen atom. This forms " + groupSuffix + ".";
          if (asFused) {
            parts.push({ plainLine: intro, htmlBody: intro });
          } else {
            parts.push({
              plainLine: "Branch " + (parts.length + 1) + ": " + intro,
              htmlBody: intro,
            });
          }
          continue;
        }
      }

      const visited = new Set(visitedGlobal);
      const steps = _walkBranch(br.branchRootId, br.attachmentVertexId, graphData, adjacency, visited);
      if (steps.length === 0) continue;

      let associatedGroup = null;
      for (const s of steps) {
        if (atomToGroup.has(s.vertexId)) { associatedGroup = atomToGroup.get(s.vertexId); break; }
      }
      const lastStep = steps[steps.length - 1];
      const subNeighbours = (adjacency.get(lastStep.vertexId) || []).filter(n => !visited.has(n.vertex.id));
      if (!associatedGroup) {
        for (const n of subNeighbours) {
          if (atomToGroup.has(n.vertex.id)) { associatedGroup = atomToGroup.get(n.vertex.id); break; }
        }
      }

      let desc = _describeBranch(steps, null, adjacency);
      const subDesc = _describeSubBranches(lastStep.vertexId, lastStep.element, graphData, adjacency, visited);
      if (subDesc) desc = desc.replace(/\.\s*$/, ". " + subDesc);

      // Attach a group label. Prefer a detected functional group; fall back to
      // plain hydrocarbon / methoxy naming so substituents are never silent.
      if (associatedGroup) {
        desc += " This forms " + helpers.groupDisplayName(associatedGroup) + ".";
      } else if (steps.length === 1 && steps[0].element === "C" && subNeighbours.length === 0) {
        desc += " This forms a methyl group (–CH₃).";
      } else if (steps.length === 2 && steps[0].element === "O" && steps[1].element === "C" && subNeighbours.length === 0) {
        desc += " This forms a methoxy group (–OCH₃).";
      } else if (steps.every(s => s.element === "C") && subNeighbours.length === 0 && steps.length >= 2) {
        const name = ALKYL_NAMES[steps.length];
        if (name) desc += " This forms " + _aOrAnElement(name) + " " + name + " group.";
      } else if (steps.every(s => s.element === "C") && steps.length >= 4) {
        desc += " This forms a hydrocarbon chain.";
      }

      for (const v of visited) visitedGlobal.add(v);

      // Phase 8C-CT-3e: produce both plain-text and HTML <li> body forms.
      // plainLine keeps today's byte-identical output; htmlBody strips the
      // "Branch N:" prefix for single-ring (the <ol> marker carries the
      // number) but retains the "From a [element] atom in the ring," prefix
      // for fused/joined rings (which conveys chemistry the marker cannot).
      if (asFused) {
        const attachVertex = graphData.graph.vertices.find(v => v.id === br.attachmentVertexId);
        const elemName = _elementName(_elem(attachVertex));
        let body = desc.charAt(0).toLowerCase() + desc.slice(1);
        // Phase 11-1e (N-post10-9): when _describeBranch emits the bond-first
        // opener ("From the ring, a single bond connects to…") for a
        // multi-step branch on a fused host, its lowercased form survives the
        // prepend below and produces a double-opener ("From a carbon atom in
        // the ring, from the ring, …"). Strip the leading "from the ring, "
        // so the fused-host prefix replaces it. Atom-first openers ("A carbon
        // atom is attached to the ring…") start with the article, not "from",
        // and are unaffected.
        if (body.startsWith("from the ring, ")) {
          body = body.slice("from the ring, ".length);
        }
        // Phase 11-2b: when the named-system locant table resolves the
        // attachment atom, substitute the positional opener ("From N3 of the
        // ring, ...") for the legacy element-only opener. mapAtomToLocant
        // returns null for atoms outside the table or for named systems
        // without a locant table — fall back to the legacy prefix in that
        // case (graceful degradation per 11-2a's defensive null guard).
        const locant = (namedSystem && rings && window.MathPixChemistryLocants)
          ? window.MathPixChemistryLocants.mapAtomToLocant(
              ringMembers,
              br.attachmentVertexId,
              namedSystem,
              { graph: graphData.graph, rings })
          : null;
        const prefix = locant
          ? "From " + locant.locant + " of the ring, "
          : "From a " + elemName + " atom in the ring, ";
        const line = prefix + body;
        parts.push({ plainLine: line, htmlBody: line });
      } else {
        // Phase 12-3c (N-post11-3): when the single-ring named-system locant
        // table resolves the attachment atom, inject "From [locant] of the
        // ring," between the "Branch N: " enumeration and the lowercased
        // branch body. Mirrors the fused-host pattern at lines 673-684.
        // Per (3c-3) the "Branch N: " enumeration prefix is preserved
        // (Phase 13 is the convergence trigger for opener-style harmonisation).
        // Per (3c-2) the C=O intercept path at lines 596-606 is unchanged
        // (positionless C=O branches on cytosine/uracil/thymine/2-pyridone).
        // htmlBody mirrors the existing single-ring fallback's convention —
        // the "Branch N: " prefix is omitted because the consumer wraps
        // single-ring branches in an <ol> whose <li> markers carry the
        // number; the locant prefix reaches htmlBody so the rendered
        // <li> reads "From C4 of the ring, a nitrogen atom...".
        const locant = (namedSystem && rings && window.MathPixChemistryLocants)
          ? window.MathPixChemistryLocants.mapAtomToLocant(
              ringMembers,
              br.attachmentVertexId,
              namedSystem,
              { graph: graphData.graph, rings })
          : null;
        if (locant) {
          let body = desc.charAt(0).toLowerCase() + desc.slice(1);
          if (body.startsWith("from the ring, ")) {
            body = body.slice("from the ring, ".length);
          }
          const htmlBody = "From " + locant.locant + " of the ring, " + body;
          const plainLine = "Branch " + (parts.length + 1) + ": " + htmlBody;
          parts.push({ plainLine: plainLine, htmlBody: htmlBody });
        } else {
          parts.push({ plainLine: "Branch " + (parts.length + 1) + ": " + desc, htmlBody: desc });
        }
      }
    }
    return parts;
  }

  // =========================================================================
  // Comprehensive-tier orchestrator + chain/stereo (Step 4)
  //   _orderChainAtoms, _countStereocenters, _buildComprehensiveSections,
  //   _assembleComprehensiveDescription, _assembleComprehensiveDescriptionHTML,
  //   _escapeHtml, _finaliseDescription
  // =========================================================================

  /**
   * Phase 8C-CT-3a B6: order non-ring carbon chain atoms so ordinals can be assigned.
   * Phase 15-2b: optional anchor parameter applies IUPAC P-14.5 lowest-locant rule —
   * picks the endpoint that gives the anchor atom the lowest position. Math.min
   * endpoint tie-break preserves symmetric-canary direction (#7 tert-butanol,
   * #15 acetone) byte-identically against the legacy `Math.min(...endpoints)` start.
   */
  function _orderChainAtoms(chainAtomSet, adjacency, anchorAtomId = null) {
    const endpoints = [];
    for (const id of chainAtomSet) {
      const chainNeighbours = (adjacency.get(id) || []).filter(n => chainAtomSet.has(n.vertex.id));
      if (chainNeighbours.length <= 1) endpoints.push(id);
    }
    if (endpoints.length === 0) return Array.from(chainAtomSet);
    function walkFrom(start) {
      const order = [start];
      let prev = null, current = start;
      while (true) {
        const next = (adjacency.get(current) || []).find(
          n => chainAtomSet.has(n.vertex.id) && n.vertex.id !== prev && !order.includes(n.vertex.id),
        );
        if (!next) break;
        prev = current; current = next.vertex.id; order.push(current);
      }
      return order;
    }
    if (anchorAtomId == null || endpoints.length === 1) {
      return walkFrom(Math.min(...endpoints));
    }
    let bestOrder = null, bestPos = Infinity, bestEp = Infinity;
    for (const ep of endpoints) {
      const order = walkFrom(ep);
      const pos = order.indexOf(anchorAtomId) + 1;
      if (pos > 0 && (pos < bestPos || (pos === bestPos && ep < bestEp))) {
        bestPos = pos; bestOrder = order; bestEp = ep;
      }
    }
    return bestOrder || walkFrom(Math.min(...endpoints));
  }

  // Phase 15-2b: compute locant string ("at C{N}") for a group on the
  // IUPAC-ordered chain. Scope guard (per Step 2 side-assist refinement):
  //   (1) group must be hydroxyl — restricts emission to the chain-locant
  //       cluster (#5/#6/#7); excludes #15 acetone ketone (symmetric STD/SHORT
  //       canary) and out-of-cluster cascade groups (#8 nitrile,
  //       #12/#13/#14 amines).
  //   (2) no active stereo descriptors — when atomCIP or bondEZ is present,
  //       the 15-2a opener-prefix carries the disambiguation; an inline
  //       locant suffix would break STD/SHORT byte-identical PREFIX
  //       preservation for #1–#4 (15-2a SEAL invariant). #4 specifically
  //       exercises this branch.
  // COMP behaviour intentionally not gated by stereo — _orderChainAtoms
  // chain-direction flip is the cross-sub-stage primitive for #1/#4 COMP
  // refinement (investigation § 6.1 Sequence Option A).
  function _chainLocantSuffix(group, chain, stereoEmission, graphData, adjacency) {
    if (!chain || !chain._atomSet || chain.principalFGAnchor == null) return "";
    if (group.shortName !== "hydroxyl") return "";
    if (stereoEmission && (stereoEmission.atomCIP?.length > 0 || stereoEmission.bondEZ?.length > 0)) return "";
    const chainOrder = _orderChainAtoms(chain._atomSet, adjacency, chain.principalFGAnchor);
    const atoms = group.atoms || [];
    let attach = atoms.find(a => chain._atomSet.has(a));
    if (attach == null) {
      for (const a of atoms) {
        const cn = (adjacency.get(a) || []).find(n => chain._atomSet.has(n.vertex.id));
        if (cn) { attach = cn.vertex.id; break; }
      }
    }
    const pos = attach != null ? chainOrder.indexOf(attach) + 1 : 0;
    return pos > 0 ? " at C" + pos : "";
  }

  /** Phase 8C-CT-3a B5: count stereocenters from SMILES. Each "[C@H]" or "[C@@H]" contributes one. */
  function _countStereocenters(smiles) {
    if (!smiles || typeof smiles !== "string") return 0;
    const matches = smiles.match(/@+/g);
    return matches ? matches.length : 0;
  }

  // Phase 16-2a (KD-4): match an alkene functional group to its bond-E/Z
  // descriptor by atom set, returning the CIP code ("E"/"Z") only — a raw
  // cis/trans code (the get_stereo_tags-absent fallback) returns null so it
  // is not promoted into comprehensive prose.
  function _matchBondEZ(group, stereoEmission) {
    if (!group || !stereoEmission || !Array.isArray(stereoEmission.bondEZ)) return null;
    const atoms = group.atoms || [];
    if (atoms.length < 2) return null;
    const atomSet = new Set(atoms);
    for (const b of stereoEmission.bondEZ) {
      if (atomSet.has(b.sourceId) && atomSet.has(b.targetId)) {
        return b.code === "E" || b.code === "Z" ? b.code : null;
      }
    }
    return null;
  }

  /**
   * Phase 8C-CT-3e: build the comprehensive description as an intermediate
   * structure so both the plain-text and HTML public APIs can consume it.
   *
   * Return shape:
   *   { singleParagraph: [strings] }                                   // chain, large molecule, unsubstituted rings
   *   { intro: [strings], branches: [{plainLine, htmlBody}], tail: [strings] }  // ring/fused/joined with branches
   *
   * Stereocentre count is NOT appended here — `_finaliseDescription`
   * handles it for the plain path, and `_assembleComprehensiveDescriptionHTML`
   * appends it to the tail paragraph.
   */
  function _buildComprehensiveSections(analysis, pubchemData) {
    // Phase 15-2c (LOCK 5): centralHeteroatom + bridgedAcyclic added.
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, stereoEmission,
            centralHeteroatom, bridgedAcyclic, _graphData, _adjacency } = analysis;
    const groups = functionalGroups || [];
    const opener = _buildOpener(pubchemData, stereoEmission, chain, _adjacency); // Phase 15-2a: stereo-aware; 16-2a: locant-prefixed
    const intro = [];
    if (opener) intro.push(opener);

    if (heavyAtomCount > 40) {
      intro.push("A complex molecule with " + heavyAtomCount + " heavy atoms. The structure is too large for a detailed diagram walkthrough.");
      return { singleParagraph: intro };
    }

    // Phase 15-1a: the legacy inline predicate
    //   const hasMultipleNonFusedRings = rings.length > 1 && !rings.some(r => r.isFused);
    // retired. _classifyScaffold now returns "joined-rings" for the same
    // condition (classify.js:1223+); STD/SHORT/COMP assemblers all branch on
    // scaffoldType === "joined-rings" — single source of truth, tier-
    // consistency by construction (CLAUDE.md description-engine tier
    // consistency invariant).

    if (scaffoldType === "fused-rings") {
      intro.push(_describeFusedRingSystem(rings, _graphData, _adjacency));
      const allRingMembers = new Set();
      for (const ring of rings) for (const id of ring.memberVertexIds) allRingMembers.add(id);
      const branchPoints = _enumerateRingBranchPoints(allRingMembers, _adjacency);
      // Phase 10-8 (G21): sort by ring-index then by angle around each
      // branch's own ring centroid. Previously the fused-rings path iterated
      // branchPoints in SMILES-parser vertex order, interleaving methyls
      // and ring-internal C=O on caffeine/theobromine.
      const sortedBranchPoints = helpers.sortBranchPointsByRingAndAngle(branchPoints, rings, _graphData);
      // Phase 11-2b: derive namedSystem so the locant table can substitute
      // positional openers ("From N3 of the ring") for the legacy element-
      // only form on xanthine / purine fused systems.
      const namedSystem = _identifyFusedSystemName(rings, _graphData, _adjacency);
      // Phase 17 (KD-14): reorder the branch walk by cascade seniority for
      // in-cascade lists (naproxen: acid branch before methoxy branch) so COMP
      // agrees with STD/SHORT. Each branch's locant is atom-derived, not
      // walk-position-derived, so this changes only emission order. Defers on
      // the xanthine class → geometry order (and its N1/N3/N7 walk) preserved.
      const orderedBranchPoints = _orderBranchPointsBySeniority(sortedBranchPoints, groups, allRingMembers, _graphData, _adjacency);
      const branchEntries = _walkAndDescribeBranches(orderedBranchPoints, groups, _graphData, _adjacency, allRingMembers, true, namedSystem, rings);
      const substitutedPos = new Set(branchPoints.map(b => b.attachmentVertexId));
      // Phase 11-2c: forward namedSystem + rings so the tail can substitute
      // per-atom locants ("N1, and C8") for the legacy bucket prose.
      const tail = _buildImplicitHydrogenTail(allRingMembers, substitutedPos, _graphData, _adjacency, namedSystem, rings);
      if (branchEntries.length === 0 && tail.length === 0) return { singleParagraph: intro };
      return { intro, branches: branchEntries, tail };
    }

    if (scaffoldType === "joined-rings") {
      // Phase 15-1a: was `if (hasMultipleNonFusedRings)`; now branches on the
      // classifier finding directly (classify.js:1223+).
      const joined = _describeJoinedRingSystem(rings, _graphData, _adjacency);
      intro.push(joined.text);
      const allRingMembers = new Set();
      for (const ring of rings) for (const id of ring.memberVertexIds) allRingMembers.add(id);
      const branchPoints = _enumerateRingBranchPoints(allRingMembers, _adjacency);
      // Strip branches that are connections to other rings (ring-to-ring bonds)
      const substituentBranches = branchPoints.filter(b => !allRingMembers.has(b.branchRootId));
      // Phase 10-8 (G21): sort substituent branches using the shared helper
      // for symmetry with the fused-rings path. Joined-ring substrates
      // (biphenyl etc.) aren't in the audit fixture set, but respecting the
      // same ordering primitive here future-proofs.
      const sortedSubstituentBranches = helpers.sortBranchPointsByRingAndAngle(substituentBranches, rings, _graphData);
      // Phase 11-2b: joined non-fused rings (biphenyl etc.) have no locant
      // table key — pass null so mapAtomToLocant short-circuits and the
      // legacy element-only opener is preserved.
      // Phase 17 (KD-14): route through the shared seniority reorder for the
      // same tier-consistency reason as the fused path. INERT on the current
      // fixture set (no joined-ring substrate is pinned, so this is not gate-
      // verified) — kept uniform to prevent a partial landing when a joined-
      // ring fixture with an in-cascade substituent pair eventually arrives.
      const orderedSubstituentBranches = _orderBranchPointsBySeniority(sortedSubstituentBranches, groups, allRingMembers, _graphData, _adjacency);
      const branchEntries = _walkAndDescribeBranches(orderedSubstituentBranches, groups, _graphData, _adjacency, allRingMembers, true, null, rings);
      // Phase 10-2: ring-to-ring linkage atoms and exocyclic-substituent
      // attachments both count as "substituted" for tail purposes. Use the
      // full branchPoints (not the stripped list) so biphenyl's inter-ring
      // carbons are excluded from the implicit-H tally.
      const substitutedPos = new Set(branchPoints.map(b => b.attachmentVertexId));
      // Phase 15-1a (KD-2): skip _buildImplicitHydrogenTail when
      // _describeJoinedRingSystem's simple-identical-rings branch already
      // emitted the per-ring implicit-H sentence ("Each ring has N carbon
      // atoms carrying implicit hydrogens..."). For unsubstituted biphenyl
      // this prevents the duplicate trailing sentence "The remaining 10 ring
      // positions are each bonded to an implicit hydrogen atom." Substituted
      // joined-ring molecules (no current fixture; Phase 15+ carry-forward)
      // fall to the else branch in _describeJoinedRingSystem and still
      // receive their across-rings H tally via _buildImplicitHydrogenTail.
      // Phase 11-2c: joined non-fused rings have no locant table key — pass
      // null so mapAtomToLocant short-circuits and the legacy bucket prose
      // is preserved.
      const tail = joined.coversImplicitHydrogens
        ? []
        : _buildImplicitHydrogenTail(allRingMembers, substitutedPos, _graphData, _adjacency, null, rings);
      if (branchEntries.length === 0 && tail.length === 0) return { singleParagraph: intro };
      return { intro, branches: branchEntries, tail };
    }

    if (scaffoldType === "central-heteroatom") {
      // Phase 15-2c (LOCK 5): acyclic central-heteroatom COMP prose.
      // Dispatches on FG element-specifier; targets per § 7 verbatim.
      // CHEMISTRY-CRITICAL invariants enforced inline:
      //   - #14 trimethylamine (subtype 3) emits NO H-bearing-N glyph;
      //     COMP explicitly says "bears no hydrogens" (curriculum-load-
      //     bearing distinction: 3° vs 1°/2° characterised partly by N–H
      //     absence — findings § 7.7).
      //   - #13 dimethylamine (subtype 2) uses (–NH–) at STD; COMP says
      //     "bears one implicit hydrogen". No (–NH₂) glyph anywhere.
      const sulphoxideGroup = groups.find(g => g.shortName === "sulphoxide");
      if (sulphoxideGroup && centralHeteroatom) {
        // § 7.3 COMP target:
        //   "The structure is a sulphoxide. The central sulphur atom is
        //    double-bonded to an oxygen and single-bonded to two methyl
        //    carbons (forming a sulphoxide group, S=O). Each methyl carbon
        //    carries three implicit hydrogens."
        const elemWord = _elementName(centralHeteroatom.element); // "sulphur"
        const subCount = centralHeteroatom.substituents.length;
        intro.push("The structure is a sulphoxide.");
        intro.push(
          "The central " + elemWord + " atom is double-bonded to an oxygen and single-bonded to " +
          _numberWord(subCount) + " methyl carbons (forming a sulphoxide group, S=O)."
        );
        intro.push("Each methyl carbon carries three implicit hydrogens.");
        return { singleParagraph: intro };
      }
      const amineGroup = groups.find(g => g.shortName === "amine" && typeof g.subtype === "number" && g.subtype >= 2);
      if (amineGroup && centralHeteroatom) {
        const subtypeName = AMINE_SUBTYPE_NAMES[amineGroup.subtype]; // "secondary amine" / "tertiary amine"
        const subCount = centralHeteroatom.substituents.length;
        const hcount = amineGroup.nHydrogenCount;
        const hPhrase = hcount === 0
          ? "no hydrogens"
          : hcount === 1
            ? "one implicit hydrogen"
            : _numberWord(hcount) + " implicit hydrogens";
        if (amineGroup.subtype === 3) {
          // § 7.7 COMP: "The structure is a tertiary amine, N(CH₃)₃. ..."
          intro.push("The structure is a " + subtypeName + ", N(CH₃)₃.");
        } else {
          // § 7.6 COMP: "The structure is a secondary amine. ..."
          intro.push("The structure is a " + subtypeName + ".");
        }
        intro.push(
          "The nitrogen atom bears " + hPhrase + " and is bonded to " +
          _numberWord(subCount) + " methyl carbons, characteristic of a " + subtypeName + "."
        );
        return { singleParagraph: intro };
      }
      // Defensive: scaffoldType claimed central-heteroatom but no centre
      // FG found — fall through to other arms (should not fire in tier-1).
    }

    if (scaffoldType === "bridged-acyclic") {
      // Phase 15-2c (LOCK 5): acyclic bridged-heteroatom COMP prose.
      // Walks leftSubstructure.atomIds in ARRAY ORDER (outermost-first per
      // _analyseBridgedAcyclic convention), then bridge, then
      // rightSubstructure.atomIds in ARRAY ORDER (innermost-first). MUST
      // NOT normalise the two arrays to match — the continuous ordinal
      // walk depends on the helper's deliberate left/right asymmetry.
      // For diethyl ether (#11): left=[C0,C1], right=[C3,C4] → "first"
      // (C0) → "second" (C1) → bridge → "third" (C3) → "fourth" (C4).
      if (bridgedAcyclic && bridgedAcyclic.leftSubstructure && bridgedAcyclic.rightSubstructure) {
        const left = bridgedAcyclic.leftSubstructure;
        const right = bridgedAcyclic.rightSubstructure;
        const leftLen = left.atomIds.length;
        const rightLen = right.atomIds.length;
        const leftDesc = left.descriptor || "alkyl";
        const rightDesc = right.descriptor || "alkyl";
        const bridgeElem = _elementName(bridgedAcyclic.bridgeElement);

        intro.push("The structure is an ether.");
        intro.push("Two " + leftDesc + " groups are bridged by " + _aOrAnElement(bridgeElem) + " " + bridgeElem + " atom.");
        // Left side: outermost-first walk. First sentence carries the
        // "The first <descriptor>:" prefix to mark the substructure start.
        if (leftLen >= 2) {
          intro.push(
            "The first " + leftDesc + ": the " + _ordinal(1) +
            " carbon is bonded to the " + _ordinal(2) + " carbon by a single bond."
          );
          for (let i = 1; i < leftLen - 1; i++) {
            intro.push(
              "The " + _ordinal(i + 1) + " carbon is bonded to the " +
              _ordinal(i + 2) + " carbon by a single bond."
            );
          }
        }
        // Bridge transition.
        intro.push("The " + _ordinal(leftLen) + " carbon is bonded to the bridging " + bridgeElem + ".");
        intro.push("The " + bridgeElem + " is bonded to the start of a second " + rightDesc + " group.");
        // Right side: innermost-first walk; ordinals continue from leftLen+1.
        const rightStart = leftLen + 1;
        for (let i = 0; i < rightLen - 1; i++) {
          intro.push(
            "The " + _ordinal(rightStart + i) + " carbon is bonded to the " +
            _ordinal(rightStart + i + 1) + " carbon by a single bond."
          );
        }
        intro.push("Each carbon carries implicit hydrogens.");
        return { singleParagraph: intro };
      }
    }

    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      const ring = rings[0];
      const ringDesc = _describeRingTopology(ring, _graphData, _adjacency);
      const ringMembers = new Set(ring.memberVertexIds);

      if (ring.heteroatoms.length === 0) {
        const sw = SIZE_WORDS[ring.size] || String(ring.size);
        intro.push("The structure is centred on " + ringDesc + ", with all " + sw + " ring positions occupied by carbon atoms.");
      } else {
        intro.push("The structure is centred on " + ringDesc + ".");
      }

      const branchPoints = _enumerateRingBranchPoints(ringMembers, _adjacency);
      if (branchPoints.length > 0) {
        // `[ring]` is a 1-element array, so ringIdx is 0 for every branch
        // and the sort degenerates to angle-only around the one ring's
        // centroid.
        const sorted = helpers.sortBranchPointsByRingAndAngle(branchPoints, [ring], _graphData);
        if (sorted.length === 2 && ring.size === 6) {
          const pattern = _detectSubstitutionPattern(ring, sorted, _graphData);
          intro.push(pattern ? "Two branches extend from the ring, " + pattern + ":" : "Two branches extend from the ring:");
        } else if (sorted.length === 1) {
          intro.push("One branch extends from the ring:");
        } else {
          const nw = helpers.numberWord(sorted.length);
          intro.push(nw.charAt(0).toUpperCase() + nw.slice(1) + " branches extend from the ring:");
        }
        // Phase 11-2b: derive namedSystem for single-ring pyrimidines
        // (uracil / thymine / cytosine etc.). The single-ring branch path
        // emits "Branch N: ..." and does not yet substitute locants — the
        // single-ring opener template change is deferred to a later
        // sub-phase. Threading namedSystem here is forward-compatible.
        // Phase 11-2d (N-post10-5): fall through to identifyPyridinonePattern
        // for 2-pyridone (pyridin-2(1H)-one) so the COMP tail-builder picks
        // up locants via the same machinery as the cytosine path.
        const namedSystemSingle = _identifyPyrimidinePattern
          ? (_identifyPyrimidinePattern(ring, _graphData, _adjacency)
             || (_identifyPyridinonePattern
                  ? _identifyPyridinonePattern(ring, _graphData, _adjacency)
                  : null))
          : null;
        // Phase 17 (KD-14): seniority-order the single-ring branch walk for
        // tier-consistency with STD/SHORT. All current single-ring fixtures are
        // out-of-cascade → the guard defers → geometry walk preserved.
        const orderedSorted = _orderBranchPointsBySeniority(sorted, groups, ringMembers, _graphData, _adjacency);
        const branchEntries = _walkAndDescribeBranches(orderedSorted, groups, _graphData, _adjacency, ringMembers, false, namedSystemSingle, [ring]);
        const substitutedPos = new Set(sorted.map(b => b.attachmentVertexId));
        // Phase 11-2c: forward namedSystemSingle + [ring] so single-ring
        // pyrimidines (uracil / thymine / cytosine) get locant-bearing tail
        // prose ("N1, N3, and C8") when mapAtomToLocant resolves.
        const tail = _buildImplicitHydrogenTail(ring.memberVertexIds, substitutedPos, _graphData, _adjacency, namedSystemSingle, [ring]);
        return { intro, branches: branchEntries, tail };
      }
      // No branches — unsubstituted ring (benzene, pyrrolidine, pyridine)
      const carbonCount = ring.memberVertexIds.filter(id => _elem(_graphData.graph.vertices.find(v => v.id === id)) === "C").length;
      if (carbonCount > 0) intro.push("Each carbon carries one implicit hydrogen atom.");
      return { singleParagraph: intro };
    }

    if (chain) {
      // Phase 9-3 (CT-4ac): urea-molecule special case. The standalone
      // molecule H₂N–C(=O)–NH₂ currently emits three chain sentences
      // ("one-carbon chain" + amide + amine); replace with one dedicated
      // sentence naming the real motif. Signature is tight enough that
      // guanidine (3 amines, no amide), phosgene (aldehyde + halogens),
      // and carbonic acid (acid + hydroxyl) all skip this branch.
      const isUreaMolecule = chain.length === 1 &&
        heavyAtomCount === 4 &&
        groups.length === 2 &&
        groups.some(g => g.shortName === "amide" && g.shorthand === "–CONH₂") &&
        groups.some(g => g.shortName === "amine");
      if (isUreaMolecule) {
        // Phase 17 (KD-23): route urea through the shared single-carbon walk
        // with its chemistry-canonical urea-linkage label (Phase 9-3 wording).
        // The previous hard-coded COMP literal was shorter than STANDARD.
        intro.push(..._buildSingleCarbonWalk(["a urea linkage (H₂N–CO–NH₂)"], _graphData, _adjacency));
        return { singleParagraph: intro };
      }

      // Phase 10-5 (CT-4g-small): single-carbon scaffolds read oddly as "a
      // one-carbon chain". Emit "A single carbon bearing …" prose with the
      // group list (display names already carry shorthand like "–CHO" / "–OH").
      // Urea is handled by the isUreaMolecule carve-out above; guanidine,
      // formaldehyde, methanol, phosgene reach this branch.
      if (chain.length === 1) {
        if (groups.length === 0) {
          intro.push("The structure is a single carbon atom.");
        } else {
          // Phase 15-2c (LOCK 3): subtype-aware amine display for methylamine
          // (#12). Inline rather than via _groupDisplayName so guanidine /
          // urea's collapsed amine paths stay on "amine groups" (baseline).
          // Trigger: exactly one subtype-tagged amine in the group list.
          const singleSubtypeAmine = groups.length === 1
            && groups[0].shortName === "amine"
            && typeof groups[0].subtype === "number";
          if (singleSubtypeAmine) {
            const g = groups[0];
            const subWord = AMINE_SUBTYPE_NAMES[g.subtype] || "amine";
            const display = "a " + subWord + " group" + (g.shorthand ? " (" + g.shorthand + ")" : "");
            intro.push("A single carbon bearing " + helpers.formatList([display]) + ".");
          } else {
            // Phase 17 (KD-14): seniority-order the single-carbon COMP group
            // list to stay tier-consistent with the STD/SHORT single-carbon
            // paths. All current single-carbon fixtures (urea, guanidine, …)
            // are out-of-cascade → the guard defers → byte-identical.
            // Phase 17 (KD-23): the group-bearing arm routes through the
            // dedicated single-carbon walk — previously it computed STANDARD's
            // own expression, so COMP collapsed onto STD by construction.
            const orderedGroups = _orderGroupsBySeniority(groups);
            const groupLabels = helpers.collapseGroupList
              ? helpers.collapseGroupList(orderedGroups)
              : orderedGroups.map(g => helpers.groupDisplayName(g));
            intro.push(..._buildSingleCarbonWalk(groupLabels, _graphData, _adjacency));
          }
          // Phase 15-2c (LOCK 3): append H-count characterisation clause
          // for subtype-tagged amine. § 7.5 COMP for methylamine:
          //   "The nitrogen bears two implicit hydrogens, characteristic of
          //    a primary amine."
          if (singleSubtypeAmine) {
            const g = groups[0];
            const subWord = AMINE_SUBTYPE_NAMES[g.subtype];
            const hcount = g.nHydrogenCount;
            const hPhrase = hcount === 0
              ? "no implicit hydrogens"
              : hcount === 1
                ? "one implicit hydrogen"
                : _numberWord(hcount) + " implicit hydrogens";
            intro.push("The nitrogen bears " + hPhrase + ", characteristic of a " + subWord + ".");
          }
        }
        return { singleParagraph: intro };
      }

      // Phase 8C-CT-3a B6: describe chain atoms with ordinals so terminal-group
      // branches attach cleanly instead of introducing a phantom extra carbon.
      const chainAtomSet = new Set();
      for (const v of _graphData.graph.vertices) {
        if (_elem(v) === "C" && !(v.value?.rings?.length > 0)) chainAtomSet.add(v.id);
      }
      // Phase 15-2b: pass principal-FG anchor for IUPAC-aware endpoint pick
      // (chain-direction flip for #1/#4/#5/#6; preserves #7/#15 symmetric
      // canaries via Math.min tie-break inside _orderChainAtoms).
      const chainOrder = _orderChainAtoms(chainAtomSet, _adjacency, chain.principalFGAnchor);
      const chainWord = helpers.numberWord(chain.length);
      intro.push("The structure is a " + chainWord + "-carbon chain.");
      if (chain.length >= 2 && chainOrder.length >= 2) {
        // KD-5 fix (tail of 17-2): emit the actual bond order between the first
        // two chain carbons via BOND_NAMES instead of hard-coding "single",
        // mirroring the later chain-bond sentences (e.g. lines 775/806). A
        // 1-alkene (C=CCC) / 1-alkyne (C#CCC) now reads "double"/"triple";
        // a single first bond is unchanged.
        const firstBondN = (_adjacency.get(chainOrder[0]) || []).find(
          (n) => n.vertex.id === chainOrder[1]
        );
        const firstBondName =
          (firstBondN && BOND_NAMES[firstBondN.edge.bondType]) || "single";
        intro.push(
          "The first carbon is bonded to the second carbon by a " +
            firstBondName +
            " bond."
        );
      }

      // Phase 10-6 (G10): group functional groups by their chain attachment
      // position first, then emit one sentence per position with a collapsed
      // list. Previously this loop emitted one sentence per group, so a
      // same-carbon multi-group case produced "The first carbon bears X.
      // The first carbon bears Y." — repetitive. The grouping also lets
      // helpers.collapseGroupList pluralise same-shortName duplicates.
      const byChainIdx = new Map();
      for (const group of groups) {
        const groupAtoms = group.atoms || [];
        if (groupAtoms.length === 0) continue;
        let chainIdx = -1;
        // If the group's root atom IS a chain atom, it attaches at that position.
        if (chainAtomSet.has(groupAtoms[0])) {
          chainIdx = chainOrder.indexOf(groupAtoms[0]);
        } else {
          // Otherwise find which chain carbon the group is bonded to.
          for (const a of groupAtoms) {
            const neighbours = _adjacency.get(a) || [];
            const cn = neighbours.find(n => chainAtomSet.has(n.vertex.id) && !groupAtoms.includes(n.vertex.id));
            if (cn) { chainIdx = chainOrder.indexOf(cn.vertex.id); break; }
          }
        }
        if (!byChainIdx.has(chainIdx)) byChainIdx.set(chainIdx, []);
        byChainIdx.get(chainIdx).push(group);
      }
      // Emit in chain order; unresolved (-1) goes last as "The chain also bears …".
      const orderedKeys = [...byChainIdx.keys()].sort((a, b) => {
        if (a === -1) return 1;
        if (b === -1) return -1;
        return a - b;
      });
      for (const idx of orderedKeys) {
        const bucket = byChainIdx.get(idx);
        // Phase 15-2c (LOCK 2 / § 7.1): chemistry-accurate nitrile COMP
        // sentence — surfaces the triple-bond C≡N geometry rather than
        // generic "bears a nitrile group". For #8 propionitrile (CCC#N):
        //   "The third carbon is triple-bonded to a nitrogen atom
        //    (forming a nitrile group, –CN)."
        // Falls through to the generic "Nth carbon bears X" template when
        // the bucket is not a lone nitrile (preserves all other behaviours
        // including the #15 acetone canary "second carbon bears a ketone
        // group (C=O)" emission).
        if (bucket.length === 1 && bucket[0].shortName === "nitrile" && idx >= 0) {
          intro.push(
            "The " + _ordinal(idx + 1) + " carbon is triple-bonded to a nitrogen atom" +
            " (forming a nitrile group, –CN)."
          );
          continue;
        }
        // Phase 16-2a (KD-4, lock 5): a stereo-defined C=C surfaces its
        // CIP (E)/(Z) descriptor inline at the double-bond mention — the
        // COMP render site tier-consistent with the opener prefix. Only a
        // CIP-resolved code is promoted (raw cis/trans is not surfaced in
        // COMP prose); falls through to the generic template otherwise, so
        // builds without get_stereo_tags keep the plain sentence.
        if (bucket.length === 1 && bucket[0].shortName === "alkene" && idx >= 0) {
          const ez = _matchBondEZ(bucket[0], stereoEmission);
          if (ez === "E" || ez === "Z") {
            // Article by spoken letter sound: "an (E)" (ee), "a (Z)" (zed).
            const article = ez === "E" ? "an" : "a";
            intro.push(
              "The " + _ordinal(idx + 1) + " carbon bears " + article + " (" + ez +
              ")-configured carbon-carbon double bond (C=C)."
            );
            continue;
          }
        }
        // Phase 17 (KD-14) tier-audit exemption: `bucket` holds only the groups
        // sharing ONE chain carbon, so it is deliberately NOT routed through
        // _orderGroupsBySeniority (which orders across the whole chain and would
        // fight the positional walk). This is the documented exemption cited in
        // CLAUDE.md's tier-consistency invariant. It is safe for the CURRENT
        // fixture set, NOT unconditionally:
        //   - Every in-scope bucket is single-group (cysteamine's thiol and
        //     amine land on separate carbons → two single-group buckets), so
        //     no bucket collapse ever orders ≥2 groups.
        //   - Intra-bucket order is classifier order (_collapseGroupList emits
        //     first-seen order), with no seniority sort; and the across-carbon
        //     order is chain.principalFGAnchor's C1 anchor THEN positional —
        //     i.e. NOT full cascade seniority beyond C1.
        // Two latent shapes this exemption does not cover (no fixture exercises
        // either today; both are out of KD-14's cysteamine+naproxen scope —
        // recon § 2.2 R2): a ≥2-group bucket from a geminal in-cascade pair on
        // one chain carbon, e.g. 1-aminoethan-1-ol CC(O)N (hydroxyl+amine on
        // C1), and the positional tail beyond C1, e.g. serine (COMP amine@C2
        // before hydroxyl@C3 though hydroxyl is senior). If a fixture of either
        // shape lands, this site must be revisited alongside the R2 regime.
        const items = helpers.collapseGroupList
          ? helpers.collapseGroupList(bucket)
          : bucket.map(g => helpers.groupDisplayName(g));
        const list = helpers.formatList(items);
        if (idx >= 0) {
          intro.push("The " + _ordinal(idx + 1) + " carbon bears " + list + ".");
        } else {
          intro.push("The chain also bears " + list + ".");
        }
      }
      // Phase 9-2 (G11): only emit when at least one chain carbon actually
      // has implicit H. Urea, guanidine, phosgene, carbonic acid all have a
      // central C with no implicit H, so the unconditional claim was false.
      // chainAtomSet members are already filtered to element "C" at build time.
      let anyImplicitH = false;
      for (const cid of chainOrder) {
        if (_implicitHydrogens("C", cid, _adjacency) > 0) { anyImplicitH = true; break; }
      }
      if (anyImplicitH) intro.push("Each carbon carries implicit hydrogens.");
      return { singleParagraph: intro };
    }

    return { singleParagraph: intro };
  }

  function _assembleComprehensiveDescription(analysis, pubchemData, smiles) {
    const sections = _buildComprehensiveSections(analysis, pubchemData);
    if (sections.singleParagraph) return _finaliseDescription(sections.singleParagraph, smiles);
    const flat = [
      ...sections.intro,
      ...sections.branches.map(b => b.plainLine),
      ...sections.tail,
    ];
    return _finaliseDescription(flat, smiles);
  }

  /**
   * Phase 8C-CT-3e: HTML form — `<p>` intro + `<ol>` branches + `<p>` tail
   * for ring / fused-ring / joined-ring scaffolds with at least one branch.
   * Everything else returns a single `<p>` wrapping the plain-text output.
   *
   * Defence: `<li>` bodies are built via `document.createElement` +
   * `textContent` (masterplan § 4e) so any future engine additions cannot
   * inject markup. The `<p>` wrappers escape via `_escapeHtml` (order:
   * `&` first, then `<`, `>`, `"`, `'`).
   */
  function _assembleComprehensiveDescriptionHTML(analysis, pubchemData, smiles) {
    const sections = _buildComprehensiveSections(analysis, pubchemData);

    if (sections.singleParagraph) {
      const plain = _finaliseDescription(sections.singleParagraph, smiles);
      return plain ? "<p>" + _escapeHtml(plain) + "</p>" : "";
    }

    const stereoCount = _countStereocenters(smiles);
    const tail = sections.tail.slice();
    if (stereoCount > 0) {
      tail.push("Contains " + helpers.numberWord(stereoCount) +
        " defined stereocenter" + (stereoCount !== 1 ? "s" : "") + ".");
    }

    const html = [];
    if (sections.intro.length > 0) {
      html.push("<p>" + _escapeHtml(sections.intro.join(" ")) + "</p>");
    }
    if (sections.branches.length > 0) {
      html.push("<ol>");
      for (const b of sections.branches) {
        if (typeof document !== "undefined" && document.createElement) {
          const li = document.createElement("li");
          li.textContent = b.htmlBody;
          html.push(li.outerHTML);
        } else {
          html.push("<li>" + _escapeHtml(b.htmlBody) + "</li>");
        }
      }
      html.push("</ol>");
    }
    if (tail.length > 0) {
      html.push("<p>" + _escapeHtml(tail.join(" ")) + "</p>");
    }
    return html.join("");
  }

  /** Phase 8C-CT-3e: minimal entity-escape for safe interpolation into `<p>` bodies. */
  function _escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Phase 8C-CT-3a B5: append stereocenter count and final cleanup. */
  function _finaliseDescription(parts, smiles) {
    const stereoCount = _countStereocenters(smiles);
    if (stereoCount > 0) {
      parts.push("Contains " + helpers.numberWord(stereoCount) + " defined stereocenter" + (stereoCount !== 1 ? "s" : "") + ".");
    }
    return parts.join(" ").replace(/\.\./g, ".").trim();
  }

  // =========================================================================
  // Standard-tier prose helpers (Step 5)
  //   _aOrAn, _aOrAnWord, _aOrAnWordCapitalised,
  //   _numberWord, _isAlkylShortName, _alkylArticle,
  //   _groupDisplayName, _shortGroupName, _formatList,
  //   _collapseGroupList, _collapseGroupListShort,
  //   _partitionAlkylGroups, _buildAlkylScaffoldClause,
  //   _toAriaText, _sortBranchPointsByRingAndAngle
  //   Plus deferred constants from Step 1: ELEMENT_NAMES,
  //   FUSED_SYSTEM_SYSTEMATIC, ALKYL_VOWEL_SOUND_PREFIXES.
  // =========================================================================

  /**
   * Phase 10-8 (CT-4f-order): shared branch ordering primitive used by both
   * tiers. Sorts ring-branch points primarily by the index of the ring their
   * attachment atom belongs to, secondarily by a within-ring ordering key.
   *
   * Phase 12-2b: the ordering key is angular position around the ring's
   * centroid when 2D coordinates are available (SmilesDrawer-era graph), and
   * falls back to the ring-member traversal index when they aren't (RDKit-
   * translated graph carries topology only — no `vertex.position`). Both keys
   * produce a deterministic cyclic ordering; under RDKit the diffs vs the
   * angular order are part of the harness gate triage.
   *
   * For single-ring inputs `ringIdx` is 0 for every branch and the sort
   * degenerates to within-ring-only. For fused-ring inputs, branches group
   * by ring before the within-ring key applies, which eliminates the
   * interleaved methyl/C=O sequences seen on caffeine and theobromine pre-10-8.
   *
   * Fallback: a branch whose attachmentVertexId is not in any supplied
   * ring (shouldn't happen for real ring substrates, but defensive) gets
   * ringIdx = Infinity and sorts to the end rather than throwing.
   *
   * Both tiers consume this via internals.helpers.sortBranchPointsByRingAndAngle.
   *
   * @param {Array<{attachmentVertexId:number, branchRootId:number, bondType:string}>} branchPoints
   * @param {Array<{memberVertexIds:number[]}>} rings - ring objects to sort against
   * @param {Object} graphData - { graph: { vertices: [{id, position?:{x,y}}, ...] } }
   * @returns {Array} new sorted array (does not mutate input)
   * @private
   */
  function _sortBranchPointsByRingAndAngle(branchPoints, rings, graphData) {
    if (!Array.isArray(branchPoints) || branchPoints.length <= 1) return branchPoints;
    if (!Array.isArray(rings) || rings.length === 0 || !graphData?.graph?.vertices) {
      return branchPoints;
    }
    const decorated = branchPoints.map((bp, inputIdx) => {
      const ringIdx = rings.findIndex(
        r => Array.isArray(r?.memberVertexIds) && r.memberVertexIds.includes(bp.attachmentVertexId),
      );
      let secondaryKey = 0;
      if (ringIdx >= 0) {
        const ring = rings[ringIdx];
        const ringVertices = ring.memberVertexIds
          .map(id => graphData.graph.vertices.find(v => v.id === id))
          .filter(Boolean);
        const attachVertex = graphData.graph.vertices.find(v => v.id === bp.attachmentVertexId);
        const haveCoords =
          ringVertices.length > 0 &&
          ringVertices.every(v => v && v.position) &&
          attachVertex &&
          attachVertex.position;
        if (haveCoords) {
          const cx = ringVertices.reduce((s, v) => s + v.position.x, 0) / ringVertices.length;
          const cy = ringVertices.reduce((s, v) => s + v.position.y, 0) / ringVertices.length;
          secondaryKey = Math.atan2(
            attachVertex.position.y - cy,
            attachVertex.position.x - cx,
          );
        } else {
          // Phase 12-2b: positions absent (RDKit pipeline) — fall back to the
          // attachment atom's index in the ring's member list. This is a
          // topology-only deterministic ordering; both pipelines emit ring
          // members in stable atom-index order so the result is reproducible.
          secondaryKey = ring.memberVertexIds.indexOf(bp.attachmentVertexId);
        }
      }
      return { bp, ringIdx: ringIdx >= 0 ? ringIdx : Infinity, secondaryKey, inputIdx };
    });
    decorated.sort((a, b) => {
      if (a.ringIdx !== b.ringIdx) return a.ringIdx - b.ringIdx;
      if (a.secondaryKey !== b.secondaryKey) return a.secondaryKey - b.secondaryKey;
      return a.inputIdx - b.inputIdx;
    });
    return decorated.map(d => d.bp);
  }

  /**
   * Return "A" or "An" for a number, based on English vowel-sound rules.
   * Relevant range for atom counts: 1–40 (>40 hits complexity cutoff).
   * "An" is needed for 8 ("eight"), 11 ("eleven"), 18 ("eighteen"), 80–89 ("eighty-x").
   * @param {number} n
   * @returns {string} "A" or "An"
   * @private
   */
  function _aOrAn(n) {
    if (n === 8 || n === 11 || n === 18 || n === 80 || (n >= 81 && n <= 89)) return "An";
    return "A";
  }

  /**
   * Phase 17-5b (KD-29): indefinite article for a WORD, by first letter.
   *
   * The ring-noun sites hard-coded "A "/"a ", which read "A imidazole ring"
   * once the classifier began naming vowel-initial rings. `_aOrAn` above is
   * number-keyed and does not fit; `_aOrAnElement` carries the same first-letter
   * rule but is contracted to element names, so this is its ring-noun sibling.
   *
   * @param {string} word - the noun the article precedes
   * @returns {string} "a" or "an"
   * @private
   */
  function _aOrAnWord(word) { return /^[aeiou]/i.test(word) ? "an" : "a"; }

  /**
   * Sentence-initial form of `_aOrAnWord`, derived from it so one rule governs.
   *
   * @param {string} word - the noun the article precedes
   * @returns {string} "A" or "An"
   * @private
   */
  function _aOrAnWordCapitalised(word) { return _aOrAnWord(word) === "an" ? "An" : "A"; }

  /**
   * Convert a number (1–8) to its English word; 9+ returns the digit string.
   * @param {number} n
   * @returns {string}
   * @private
   */
  function _numberWord(n) {
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
    return n < words.length ? words[n] : String(n);
  }

  /**
   * Phase 10-3: is this shortName one of the bare-alkyl substituent labels
   * (methyl, ethyl, … with optional "N-" / "O-" / "S-" prefix)?
   * Callers use this to partition alkyls out of the generic functional-group
   * list so they can join the scaffold sentence instead.
   * @param {string} shortName
   * @returns {boolean}
   * @private
   */
  function _isAlkylShortName(shortName) {
    if (!shortName) return false;
    const dashIdx = shortName.indexOf("-");
    const base = dashIdx === 1 ? shortName.slice(2) : shortName;
    return ALKYL_BASE_SET.has(base);
  }

  /**
   * Phase 10-3: pick "a" / "an" for an alkyl-style shortName. Covers the bare
   * base names ("ethyl" vowel-initial; "methyl"/"propyl" consonant-initial)
   * and prefix variants where the prefix letter is pronounced as a vowel
   * sound ("N-methyl" → "en" → "an N-methyl").
   * @param {string} shortName
   * @returns {string} "a" or "an"
   * @private
   */
  function _alkylArticle(shortName) {
    if (!shortName) return "a";
    if (shortName.length >= 2 && shortName[1] === "-") {
      return ALKYL_VOWEL_SOUND_PREFIXES.has(shortName[0]) ? "an" : "a";
    }
    return /^[aeiouAEIOU]/.test(shortName) ? "an" : "a";
  }

  /**
   * Map a functional-group object to a human-readable English phrase.
   * @param {Object} group - { name, shortName, atoms, attachmentVertexId }
   * @returns {string} e.g. "a carboxylic acid group (–COOH)"
   * @private
   */
  function _groupDisplayName(group) {
    const names = {
      acid: "a carboxylic acid group",
      ester: "an ester group",
      amide: "an amide group",
      "secondary amide": "a secondary amide group",
      "tertiary amide": "a tertiary amide group",
      // Phase 9-3 (CT-4ac): ring-internal carbonyl labels. Urea carries no
      // shorthand (the motif is a bridge, not a terminal substituent) so
      // _groupDisplayName returns "a urea linkage" with no parenthetical.
      // Lactam uses shorthand "cyclic amide" → "a lactam (cyclic amide)".
      urea: "a urea linkage",
      lactam: "a lactam",
      ketone: "a ketone group",
      aldehyde: "an aldehyde group",
      hydroxyl: "a hydroxyl group",
      amine: "an amine group",
      nitrile: "a nitrile group",
      // Phase 16-3 (KD-9): imine. Explicit entry required — the generic
      // fallback ("a " + shortName) emits the ungrammatical "a imine group".
      // Carries the "=N–" shorthand via the parenthetical mechanism (COMP/STD).
      imine: "an imine group",
      alkene: "a carbon-carbon double bond",
      alkyne: "a carbon-carbon triple bond",
      sulphonamide: "a sulphonamide group",
      "sulphonic acid": "a sulphonic acid group",
      // Phase 15-2c (LOCK 2): new tier-1 FG entries. Subtype-aware "primary
      // amine" / "secondary amine" / "tertiary amine" prose is composed
      // INLINE at the prose dispatch sites (simple-molecule shortcut,
      // central-heteroatom dispatch arm) — NOT here — so guanidine/urea's
      // subtype=1 amines continue to read as plain "amine groups" via
      // _collapseGroupList per the corrected migration baseline (f91362e).
      thiol: "a thiol group",
      sulphoxide: "a sulphoxide group",
      ether: "an ether group",
      // Phase 17-4a: the five names 17-4b's catalogue rows will emit, landed
      // ahead of the rows so no row ever emits through the article fallback.
      // "an acid chloride" / "an anhydride" / "an azide" are the three the
      // recon measured the fallback mis-articling as "a acid chloride" etc.
      // Shorthands travel on the catalogue ROW (group.shorthand), not here,
      // and are appended below — 17-4b supplies –COCl, –CO–O–CO–, –NO₂, =N₂
      // and –N₃ respectively. INERT until those rows land.
      "acid chloride": "an acid chloride group",
      anhydride: "an anhydride group",
      nitro: "a nitro group",
      diazo: "a diazo group",
      azide: "an azide group",
    };
    let baseName;
    if (group.shortName === "halogen") {
      baseName = "a " + group.name;
    } else if (names[group.shortName]) {
      baseName = names[group.shortName];
    } else if (_isAlkylShortName(group.shortName)) {
      // Phase 10-3: alkyl ring substituents — "a methyl group", "an ethyl
      // group", "an N-methyl group", etc. Article picked from the shortName's
      // first letter (or prefix) rather than hardcoded mappings.
      baseName = _alkylArticle(group.shortName) + " " + group.shortName + " group";
    } else {
      // Phase 17-4a: pick the article from the name's first letter rather than
      // hardcoding "a", which mis-emitted "a ester"-shaped prose for any name
      // with no map entry. Reuses _alkylArticle rather than adding a second
      // mechanism — its rule is purely orthographic (vowel-initial, or a
      // one-character prefix whose letter is pronounced as a vowel), with
      // nothing alkyl-specific in it. Fixes the CLASS of defect, not the five
      // instances. NO-OP OVER THE MEASURED CORPUS ONLY: every one of the 13
      // out-of-cascade shortNames has a map entry, so nothing reaches here
      // today — but a molecule outside the fixture set still could.
      baseName = _alkylArticle(group.shortName) + " " + group.shortName + " group";
    }
    // Phase 8C-4: append shorthand formula when available
    if (group.shorthand) {
      return baseName + " (" + group.shorthand + ")";
    }
    return baseName;
  }

  /**
   * Return a group's display name without shorthand notation.
   * Used by the short description tier for brevity.
   * @param {Object} group - functional group object
   * @returns {string} e.g. "a carboxylic acid" (not "a carboxylic acid group (–COOH)")
   * @private
   */
  function _shortGroupName(group) {
    const names = {
      acid: "a carboxylic acid",
      ester: "an ester",
      amide: "an amide",
      "secondary amide": "an amide",
      "tertiary amide": "an amide",
      // Phase 9-3 (CT-4ac): ring-internal carbonyl short labels for alt text
      urea: "a urea linkage",
      lactam: "a lactam",
      ketone: "a ketone",
      aldehyde: "an aldehyde",
      hydroxyl: "a hydroxyl group",
      // Phase 11-1f (N-post10-10): explicit "group"-suffixed entry so the
      // collapse pluralisation rule produces "methoxy groups" on veratrole
      // rather than the ugly bare-"s" form "methoxys". Mirrors hydroxyl's
      // precedent — the SHORT tier intentionally mixes "group"-suffixed
      // and bare labels (see block comment at ~line 1263).
      methoxy: "a methoxy group",
      amine: "an amine",
      nitrile: "a nitrile",
      // Phase 16-3 (KD-9): imine SHORT entry. Drops the shorthand per the
      // SHORT convention; "an" article (fallback would mis-emit "a imine").
      imine: "an imine",
      alkene: "a double bond",
      alkyne: "a triple bond",
      sulphonamide: "a sulphonamide",
      "sulphonic acid": "a sulphonic acid",
      // Phase 15-2c (LOCK 2): new tier-1 SHORT entries. "an ether" article
      // explicit (fallback "a " + shortName would mis-emit "a ether").
      // Subtype-aware amine SHORT is inlined at the chain branch single-
      // group case — NOT here — for the same reason as _groupDisplayName.
      thiol: "a thiol",
      sulphoxide: "a sulphoxide",
      ether: "an ether",
      // Phase 17-4a: SHORT twins of the _groupDisplayName entries above, per
      // the tier-consistency invariant (AGENTS.md § Description-engine tier
      // consistency) — separate maps, both need the entry. Shorthand dropped
      // per the SHORT convention. "nitro" and "diazo" keep the "group" suffix
      // because they are ADJECTIVAL: the collapse pluralises by appending "s",
      // so a bare label would emit the recon-measured "two nitros" / "two
      // diazos" rather than "two nitro groups". Same reason hydroxyl and
      // methoxy carry it. INERT until 17-4b's rows land.
      "acid chloride": "an acid chloride",
      anhydride: "an anhydride",
      nitro: "a nitro group",
      diazo: "a diazo group",
      azide: "an azide",
    };
    if (group.shortName === "halogen") {
      return "a halogen" + (group.shorthand ? " (" + group.shorthand + ")" : "");
    }
    if (names[group.shortName]) return names[group.shortName];
    // Phase 10-3: bare alkyl substituents — keep the "group" suffix so the
    // phrasing reads naturally alongside "a hydroxyl group" (the short tier
    // already mixes "group"-suffixed and bare labels).
    if (_isAlkylShortName(group.shortName)) {
      return _alkylArticle(group.shortName) + " " + group.shortName + " group";
    }
    // Phase 17-4a: SHORT twin of the _groupDisplayName article fallback — same
    // reuse of _alkylArticle, same bound. No-op over the measured corpus only.
    return _alkylArticle(group.shortName) + " " + group.shortName;
  }

  /**
   * Format a list of display-name strings into an English list with Oxford comma.
   * @param {string[]} items
   * @returns {string}
   * @private
   */
  function _formatList(items) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ", and " + items[1];
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
  }

  /**
   * Phase 10-6 (CT-4g-collapse): collapse a list of functional-group objects
   * into an Oxford-comma-ready array of display-name strings, pluralising
   * duplicates keyed by shortName. Replaces the open-coded countByShort /
   * seen-Set pattern that was duplicated between the fused-rings branch of
   * _assembleDescription and the standard-tier chain branch; now called from
   * both of those plus the single-ring branch (N6), the comprehensive-tier
   * chain branch (G10), and Phase 10-5's single-carbon branch.
   *
   * Pluralisation preserves the shorthand parenthetical as the fused-rings
   * reference implementation did: " (" is replaced with "s (", so a
   * "lactam (cyclic amide)" becomes "lactams (cyclic amide)" — the outer
   * English label pluralises, the parenthetical shorthand stays singular.
   * Emits counts in the order groups are first seen so caller-chosen
   * ordering (e.g. branch ring-order) is preserved.
   *
   * @param {Object[]} groups  array of { name, shortName, shorthand, … }
   * @returns {string[]}       Oxford-comma-ready list of display names
   * @private
   */
  function _collapseGroupList(groups) {
    if (!groups || groups.length === 0) return [];
    const countByShort = {};
    for (const g of groups) {
      countByShort[g.shortName] = (countByShort[g.shortName] || 0) + 1;
    }
    const out = [];
    const seen = new Set();
    for (const g of groups) {
      const n = countByShort[g.shortName];
      if (n > 1 && !seen.has(g.shortName)) {
        seen.add(g.shortName);
        const base = _groupDisplayName(g).replace(/^an? /, "");
        const plural = base.includes(" (") ? base.replace(" (", "s (") : base + "s";
        out.push(_numberWord(n) + " " + plural);
      } else if (n === 1) {
        out.push(_groupDisplayName(g));
      }
    }
    return out;
  }

  /**
   * Phase 11-1c (N-post10-7): short-tier sibling of _collapseGroupList.
   * Mirrors the count-by-shortName + seen-Set logic but uses _shortGroupName
   * (bare label, no shorthand parenthetical) rather than _groupDisplayName.
   * Needed because _assembleShortDescription's single-ring and chain
   * scaffold branches previously emitted duplicates verbatim ("a lactam,
   * and a lactam"; "an amine, an amine, and an amine") while STD consumed
   * _collapseGroupList and collapsed them.
   *
   * _collapseGroupList is not reused directly because it returns
   * _groupDisplayName output (e.g. "a lactam (cyclic amide)"), which is
   * STD-shaped; SHORT wants "a lactam". The helpers diverge only on the
   * name function; pluralisation rules (outer label plural, parenthetical
   * shorthand singular via " (" → "s (") are identical, so halogen-style
   * short names ("a halogen (Cl)") collapse to "two halogens (Cl)"
   * consistently with STD's "two halogens (Cl) (–Cl)" shape.
   *
   * @param {Object[]} groups  array of { name, shortName, shorthand, … }
   * @returns {string[]}       Oxford-comma-ready list of short-form names
   * @private
   */
  function _collapseGroupListShort(groups) {
    if (!groups || groups.length === 0) return [];
    const countByShort = {};
    for (const g of groups) {
      countByShort[g.shortName] = (countByShort[g.shortName] || 0) + 1;
    }
    const out = [];
    const seen = new Set();
    for (const g of groups) {
      const n = countByShort[g.shortName];
      if (n > 1 && !seen.has(g.shortName)) {
        seen.add(g.shortName);
        const base = _shortGroupName(g).replace(/^an? /, "");
        const plural = base.includes(" (") ? base.replace(" (", "s (") : base + "s";
        out.push(_numberWord(n) + " " + plural);
      } else if (n === 1) {
        out.push(_shortGroupName(g));
      }
    }
    return out;
  }

  // =========================================================================
  // Phase 17 (KD-14): shared functional-group seniority comparator.
  //
  // Normalises cross-tier group order to IUPAC principal-characteristic-group
  // seniority (PCG_CASCADE, P-43.1, principal group first), so STD / SHORT /
  // COMP agree on the order in which groups are listed. One ranking, reached by
  // every ≥2-group emission site (chain + ring, all three tiers); COMP's chain
  // walk is the sole documented exemption (already seniority-anchored via
  // chain.principalFGAnchor). See CLAUDE.md "Description-engine tier-consistency
  // invariant" and phase17-kd14-investigation-findings.md.
  //
  // Deferral guard: the cascade is deliberately narrowed to tier-1 coverage and
  // omits ester/amide/lactam/urea/imine (classify.js:2412-2419). When a list
  // contains a principal characteristic group OUTSIDE the cascade, ordering it
  // would be a guess, so the comparator returns the list UNCHANGED — leaving
  // aspirin (acid+ester), cytosine (urea+amine) and the xanthines
  // (lactam+urea+N-methyl) exactly as they are today. That gap is a separate
  // (deferred) KD, not this unit.
  // =========================================================================

  /**
   * Is this shortName a PREFIX-ONLY group rather than a suffix-eligible
   * principal characteristic group? Prefix substituents never trigger the
   * deferral guard and always sort AFTER every principal group. The set is
   * closed against the live classifier vocabulary (classify.js shortNames):
   * alkyls via _isAlkylShortName, plus "halogen" and "methoxy" (the only
   * alkoxy shortName the catalogue emits), plus "nitro", "diazo" and "azide".
   *
   * Phase 17-4a widened both the set and this description. The set holds
   * prefix-only groups — those IUPAC never lets lead a name and which are
   * never suffix-eligible — of which alkyls, alkoxy and halo are the carbon
   * and halogen cases. Nitro, diazo and azide are the same kind of thing and
   * belong here on that reading; the earlier "detachable carbon/halogen
   * substituent" wording described the members that happened to be present,
   * not the predicate. Landed INERT: no catalogue row emits the three new
   * names yet (17-4b adds the rows).
   * @param {string} shortName
   * @returns {boolean}
   * @private
   */
  function _isPrefixSubstituent(shortName) {
    if (!shortName) return false;
    return _isAlkylShortName(shortName)
      || shortName === "halogen"
      || shortName === "methoxy"
      || shortName === "nitro"
      || shortName === "diazo"
      || shortName === "azide";
  }

  /**
   * Should group ordering be deferred (left untouched) for this list? True iff
   * any member is a principal characteristic group NOT in PCG_CASCADE — i.e.
   * not a prefix substituent and not a rankable in-cascade principal. Deferring
   * on the whole list (rather than sorting the known part) preserves the
   * caller's existing order byte-for-byte, which is what keeps the out-of-
   * cascade fixtures unchanged.
   * @param {Object[]} groups
   * @returns {boolean}
   * @private
   */
  function _shouldDeferGroupOrder(groups) {
    for (const g of groups || []) {
      const sn = g && g.shortName;
      if (_isPrefixSubstituent(sn)) continue;
      if (PCG_CASCADE.indexOf(sn) >= 0) continue;
      return true; // out-of-cascade principal group → defer
    }
    return false;
  }

  /**
   * Seniority rank for a single group: its PCG_CASCADE index (0 = most senior)
   * for an in-cascade principal, or a sentinel AFTER all principals for a
   * prefix substituent. Only meaningful when _shouldDeferGroupOrder is false
   * (i.e. no out-of-cascade principals remain), so an unranked non-prefix
   * shortName cannot reach here in practice; it is sorted last defensively.
   * @param {Object} group
   * @returns {number}
   * @private
   */
  function _seniorityRank(group) {
    const sn = group && group.shortName;
    const idx = PCG_CASCADE.indexOf(sn);
    if (idx >= 0) return idx;
    return PCG_CASCADE.length + 1; // prefixes + defensive tail after principals
  }

  /**
   * Phase 17 (KD-14): order a functional-group list by cascade seniority.
   * Principal groups first (PCG_CASCADE order), then prefix substituents;
   * STABLE for equal rank so nothing else shifts. Returns the list UNCHANGED
   * when the deferral guard fires or fewer than two groups are present. This is
   * the group-list entry point; ring branch-walks use the sibling
   * _orderBranchPointsBySeniority, which shares the same guard and rank.
   * @param {Object[]} groups
   * @returns {Object[]} a new array (or the input when unchanged/deferred)
   * @private
   */
  function _orderGroupsBySeniority(groups) {
    if (!Array.isArray(groups) || groups.length < 2) return groups;
    if (_shouldDeferGroupOrder(groups)) {
      logDebug("_orderGroupsBySeniority: deferring (out-of-cascade principal present)",
        { order: groups.map(g => g && g.shortName) });
      return groups;
    }
    const before = groups.map(g => g && g.shortName);
    const ordered = groups
      .map((g, i) => ({ g, i }))
      .sort((a, b) => (_seniorityRank(a.g) - _seniorityRank(b.g)) || (a.i - b.i))
      .map(x => x.g);
    logDebug("_orderGroupsBySeniority", { before, after: ordered.map(g => g && g.shortName) });
    return ordered;
  }

  /**
   * Phase 17 (KD-14): resolve the functional group a ring branch leads to,
   * mirroring _walkAndDescribeBranches's own `associatedGroup` computation
   * (steps-first, then the last step's sub-neighbours) so the ordering key
   * matches the group the walk will actually name. A fresh visited set seeded
   * with ringMembers is used per branch — accurate for the independent-branch
   * substrates this reorder ever runs on (the deferral guard blocks the
   * shared-atom xanthine class). Ring-internal urea/lactam carbonyls map via
   * the attachment atom, matching the walk's interception; those are
   * out-of-cascade and never reach the sort anyway.
   * @private
   */
  function _branchAssociatedGroup(bp, atomToGroup, ringMembers, graphData, adjacency) {
    const atAttach = atomToGroup.get(bp.attachmentVertexId);
    if (atAttach && (atAttach.shortName === "urea" || atAttach.shortName === "lactam")) {
      return atAttach;
    }
    const visited = new Set(ringMembers);
    const steps = _walkBranch(bp.branchRootId, bp.attachmentVertexId, graphData, adjacency, visited);
    for (const s of steps) {
      if (atomToGroup.has(s.vertexId)) return atomToGroup.get(s.vertexId);
    }
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      const subNeighbours = (adjacency.get(lastStep.vertexId) || []).filter(n => !visited.has(n.vertex.id));
      for (const n of subNeighbours) {
        if (atomToGroup.has(n.vertex.id)) return atomToGroup.get(n.vertex.id);
      }
    }
    return null;
  }

  /**
   * Phase 17 (KD-14): the COMP ring branch-walk sibling of
   * _orderGroupsBySeniority. COMP describes ring substituents by walking
   * branch points (geometry order), not a flat group list, so this adapter
   * reorders the branch-point array by the seniority of each branch's
   * associated group — reusing the SAME guard and rank (no forked ranking).
   * Each branch's locant is derived from its own attachment atom, independent
   * of walk position (see _walkAndDescribeBranches), so reordering changes only
   * the order sentences are emitted. Deferral is decided on the FULL group
   * list, so the out-of-cascade fixtures (caffeine, uracil, …) keep their
   * geometry order untouched and only naproxen-shaped in-cascade lists reorder.
   * @param {Object[]} branchPoints  entries with { branchRootId, attachmentVertexId }
   * @param {Object[]} groups        the full functionalGroups list for the molecule
   * @param {Set|Iterable} ringMembers  ring member vertex ids (walk boundary)
   * @param {Object} graphData
   * @param {Map} adjacency
   * @returns {Object[]} a new array (or the input when unchanged/deferred)
   * @private
   */
  function _orderBranchPointsBySeniority(branchPoints, groups, ringMembers, graphData, adjacency) {
    if (!Array.isArray(branchPoints) || branchPoints.length < 2) return branchPoints;
    if (_shouldDeferGroupOrder(groups)) return branchPoints;
    const atomToGroup = new Map();
    for (const g of groups || []) for (const a of (g.atoms || [])) atomToGroup.set(a, g);
    const rankOfBp = (bp) => _seniorityRank(
      _branchAssociatedGroup(bp, atomToGroup, ringMembers, graphData, adjacency)
    );
    const before = branchPoints.map(bp => bp.branchRootId);
    const ordered = branchPoints
      .map((bp, i) => ({ bp, i }))
      .sort((a, b) => (rankOfBp(a.bp) - rankOfBp(b.bp)) || (a.i - b.i))
      .map(x => x.bp);
    logDebug("_orderBranchPointsBySeniority", { before, after: ordered.map(bp => bp.branchRootId) });
    return ordered;
  }

  /**
   * Phase 10-3: split a group list into bare-alkyl substituents vs everything
   * else, so the scaffold sentence can surface alkyl counts ("with three
   * N-methyl groups") while the "Functional groups: …" clause stays focused
   * on named chemical motifs (lactams, ureas, acids, etc.).
   * @param {Object[]} groups
   * @returns {{alkylGroups: Object[], otherGroups: Object[]}}
   * @private
   */
  function _partitionAlkylGroups(groups) {
    const alkylGroups = [];
    const otherGroups = [];
    for (const g of groups || []) {
      if (_isAlkylShortName(g.shortName)) alkylGroups.push(g);
      else otherGroups.push(g);
    }
    return { alkylGroups, otherGroups };
  }

  /**
   * Phase 10-3: build the trailing "with three N-methyl groups" clause for a
   * scaffold sentence. Collapses multiple alkyls of the same shortName into a
   * count, and formats mixed shortNames as an Oxford-comma list.
   * Returns "" if no alkyls.
   * @param {Object[]} alkylGroups
   * @returns {string}
   * @private
   */
  function _buildAlkylScaffoldClause(alkylGroups) {
    if (!alkylGroups || alkylGroups.length === 0) return "";
    const countByShort = {};
    const orderedShorts = [];
    for (const g of alkylGroups) {
      if (countByShort[g.shortName] == null) {
        countByShort[g.shortName] = 0;
        orderedShorts.push(g.shortName);
      }
      countByShort[g.shortName] += 1;
    }
    const items = [];
    for (const sn of orderedShorts) {
      const count = countByShort[sn];
      // Use "one methyl group" (not "a methyl group") so the scaffold clause
      // reads consistently with the multi-count cases ("two N-methyl groups",
      // "three N-methyl groups"). All entries in the clause then lead with a
      // count word, which reads uniformly across singular and plural cases.
      const suffix = count === 1 ? " group" : " groups";
      items.push(_numberWord(count) + " " + sn + suffix);
    }
    return "with " + _formatList(items);
  }

  /**
   * Replace Unicode subscript formula with screen-reader-friendly spaced format.
   * @param {string} description — description text containing Unicode formula
   * @param {string} unicodeFormula — e.g. "C₉H₈O₄"
   * @param {string} srFormula — e.g. "C 9, H 8, O 4"
   * @returns {string}
   * @private
   */
  function _toAriaText(description, unicodeFormula, srFormula) {
    if (!unicodeFormula || !srFormula) return description;
    return description.replace(unicodeFormula, srFormula);
  }

  // =========================================================================
  // Assemblers (Step 5)
  //   _assembleDescription (STD), _assembleShortDescription (SHORT)
  // =========================================================================

  /**
   * Assemble a natural-language structural description from analysis data.
   *
   * @param {Object} analysis - from analyseStructure()
   * @param {Object} [pubchemData] - optional PubChem lookup result
   * @param {Object} [options] - description options
   * @param {string} [options.detail="standard"] - "short", "standard", or "comprehensive"
   * @param {number} [options.maxWords=150] - word limit (ignored for "comprehensive")
   * @returns {string} Plain English description
   * @private
   */
  function _assembleDescription(analysis, pubchemData, options) {
    const detail = options?.detail ?? "standard";
    const maxWords = options?.maxWords ?? 150;
    // Phase 15-2c (LOCK 5): centralHeteroatom + bridgedAcyclic added to
    // destructure; populated only when scaffoldType matches their respective
    // arm, null otherwise (analyseStructure return-shape is purely additive).
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, stereoEmission,
            centralHeteroatom, bridgedAcyclic, _graphData, _adjacency } = analysis;
    const groups = functionalGroups || [];

    // Short tier — delegate to dedicated assembler
    if (detail === "short") {
      return _assembleShortDescription(analysis, pubchemData);
    }
    const parts = [];

    // --- 1. Compound name with formula/weight opener (Phase 8C-1) ---
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    // Phase 12-5b-3: prefer engine-supplied named-system label over a
    // parenthetical-locant-laden iupacName when commonNames is empty.
    // looksLikeIupacSyntax requires BOTH parens AND a digit-hyphen
    // cluster — this lets readable locant-prefixed names like
    // "1-methylnaphthalene" through and only fires on genuinely-awkward
    // parenthetical-locant cases like "pyridin-2(1H)-one".
    const namedSystemLabel = _selectNamedSystemLabel(rings, _graphData, _adjacency);
    const looksLikeIupacSyntax = !!iupacName
      && /[(),]/.test(iupacName)
      && /\d-|-\d/.test(iupacName);
    const name = commonName
      || (looksLikeIupacSyntax && namedSystemLabel ? namedSystemLabel : null)
      || iupacName
      || null;

    // Parse formula and weight from pubchemData
    const formula = pubchemData?.inchi
      ? utils.parseInChIFormula(pubchemData.inchi)
      : null;
    const weight = pubchemData?.molecularWeight;

    // Build opener: "Name (formula, molecular weight X)."
    const formulaUnicode = formula ? _formatFormulaUnicode(formula.raw) : null;
    let opener = "";
    if (name) {
      // Phase 15-2a: stereo prefix injection (atom-CIP + bond-E/Z) with
      // L15 lexical suppression. Tier-consistent with SHORT + COMP openers.
      // Phase 16-2a: chain + adjacency feed locant-prefixed stereo (KD-4/KD-7).
      const stereoPrefix = _deriveStereoPrefix(stereoEmission, name, chain, _adjacency);
      const displayName = stereoPrefix + name;
      opener = _capitaliseOpener(displayName); // P-14.5.2 affix-aware (16-2c)
    }
    if (formulaUnicode && weight) {
      const parenthetical = "(" + formulaUnicode + ", molecular weight " + weight + ")";
      opener = opener ? opener + " " + parenthetical : parenthetical;
    } else if (formulaUnicode) {
      const parenthetical = "(" + formulaUnicode + ")";
      opener = opener ? opener + " " + parenthetical : parenthetical;
    }
    if (opener) {
      parts.push(opener + ".");
    }

    // --- 5. Complexity cutoff ---
    if (heavyAtomCount > 40) {
      const seen = new Set();
      const unique = [];
      for (const g of groups) {
        if (!seen.has(g.shortName)) {
          seen.add(g.shortName);
          unique.push(_groupDisplayName(g));
          if (unique.length >= 4) break;
        }
      }
      const groupList = unique.length > 0 ? ", featuring " + _formatList(unique) : "";
      parts.push(
        "A complex molecule with " + heavyAtomCount + " heavy atoms" +
        groupList + ". Use the AI description for a full analysis."
      );
      return parts.join(" ").replace(/\.\./g, ".").trim();
    }

    // --- 2. Scaffold sentence + substituents/decorations ---

    // Simple molecule shortcut: ≤2 heavy atoms, exactly 1 group, no rings
    if (heavyAtomCount <= 2 && groups.length === 1 && rings.length === 0) {
      // Phase 15-2c (LOCK 3): subtype-aware amine display for methylamine
      // (#12). Inline here rather than via _groupDisplayName so guanidine /
      // urea continue to read as plain "amine" in their collapsed-list paths.
      const g = groups[0];
      let display;
      if (g.shortName === "amine" && typeof g.subtype === "number") {
        const subWord = AMINE_SUBTYPE_NAMES[g.subtype] || "amine";
        display = "a " + subWord + " group" + (g.shorthand ? " (" + g.shorthand + ")" : "");
      } else {
        display = _groupDisplayName(g);
      }
      parts.push("A methyl group bonded to " + display + ".");
      return parts.join(" ").replace(/\.\./g, ".").trim();
    }

    if (scaffoldType === "joined-rings") {
      // Phase 15-1a (KD-1 STD): joined non-fused rings (e.g. biphenyl).
      // Pre-15-1a this case fell into the `scaffoldType === "aromatic-ring"`
      // branch below and used `rings[0]` only, emitting the misleading
      // "A 12-atom molecule. A benzene ring." for biphenyl. The new short-
      // form helper emits a scaffold sentence covering ring count + ring
      // type + junction; the atom-count opener matches the convention for
      // other STD entries.
      const scaffoldSentence = _describeJoinedRingScaffoldShort(rings, _graphData, _adjacency);
      if (scaffoldSentence) {
        parts.push(_aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. " + scaffoldSentence + ".");
      }
      // Helper returns null for non-identical-ring scaffolds (Phase 15+
      // carry-forward). No current fixture exercises that path; if a future
      // joined-non-fused fixture has non-identical rings, surface the
      // silent-no-op as a finding and design a fallback template.
    } else if (scaffoldType === "central-heteroatom") {
      // Phase 15-2c (LOCK 5): acyclic central-heteroatom STD prose. Dispatches
      // on FG element-specifier: sulphoxide (S centre) vs amine subtype>=2
      // (N centre). Per § 7 verbatim targets — DMSO #10, dimethylamine #13,
      // trimethylamine #14.
      const sulphoxideGroup = groups.find(g => g.shortName === "sulphoxide");
      if (sulphoxideGroup && centralHeteroatom) {
        // § 7.3 STD: "A 4-atom molecule. A sulphoxide group (S=O) with two methyl substituents."
        const subCount = centralHeteroatom.substituents.length;
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. " +
          "A sulphoxide group (S=O) with " + _numberWord(subCount) + " methyl substituents."
        );
      } else {
        const amineGroup = groups.find(g => g.shortName === "amine" && typeof g.subtype === "number" && g.subtype >= 2);
        if (amineGroup && centralHeteroatom) {
          const subCount = centralHeteroatom.substituents.length;
          const countWord = _numberWord(subCount);
          const cap = countWord.charAt(0).toUpperCase() + countWord.slice(1);
          if (amineGroup.subtype === 2) {
            // § 7.6 STD: "Two methyl groups bonded to a secondary amine (–NH–)."
            parts.push(cap + " methyl groups bonded to a secondary amine (–NH–).");
          } else if (amineGroup.subtype === 3) {
            // § 7.7 STD: "Three methyl groups bonded to a tertiary amine nitrogen, N(CH₃)₃."
            // CHEMISTRY-CRITICAL: no H-bearing-N glyph (no –NH₂, no –NH–, no >NH).
            parts.push(cap + " methyl groups bonded to a tertiary amine nitrogen, N(CH₃)₃.");
          }
        }
      }
    } else if (scaffoldType === "bridged-acyclic") {
      // Phase 15-2c (LOCK 5): acyclic bridged-heteroatom STD prose. Tier-1
      // is diethyl ether (#11); generic on substituent descriptor + bridge
      // element word for future fixtures.
      if (bridgedAcyclic && bridgedAcyclic.leftSubstructure) {
        const desc = bridgedAcyclic.leftSubstructure.descriptor || "alkyl";
        const bridgeElem = _elementName(bridgedAcyclic.bridgeElement);
        // § 7.4 STD: "A 5-atom molecule. Two ethyl groups bridged by an oxygen (an ether linkage)."
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. " +
          "Two " + desc + " groups bridged by " + _aOrAnElement(bridgeElem) + " " + bridgeElem +
          " (an ether linkage)."
        );
      }
    } else if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      // Single ring
      const ring = rings[0];
      const ringName = ring.type.charAt(0).toUpperCase() + ring.type.slice(1);

      // Phase 10-4 (G8-revised): label pyrimidine rings carrying exocyclic
      // carbonyls as "pyrimidine-2,4-dione" (uracil / thymine scaffold) or
      // "pyrimidin-2(1H)-one" (cytosine scaffold). This is additive labelling
      // — the pattern is appended as a parenthetical after the ring type so
      // the existing substituent enumeration still runs.
      // Phase 11-2d (N-post10-5): fall through to _identifyPyridinonePattern
      // for 2-pyridone (1 N + 1 exocyclic C=O) → "pyridin-2(1H)-one", so the
      // four pyrimidine-/pyridine-class ring systems share the same
      // IUPAC-canonical labelling pattern.
      const pyrimidinePattern = _identifyPyrimidinePattern(ring, _graphData, _adjacency);
      const pyridinonePattern = !pyrimidinePattern
        ? _identifyPyridinonePattern(ring, _graphData, _adjacency)
        : null;
      const namedRingPattern = pyrimidinePattern || pyridinonePattern;
      // Phase 17 (KD-13): a taught-non-aromatic dione ring is named by size, not
      // by its aromatic-parent ring type — but only when the systematic
      // parenthetical resolves to carry the ring's identity, so the noun is never
      // left bare. Cytosine / 2-pyridone (one carbonyl, taught-aromatic) and
      // barbituric acid (no pattern) keep ring.type.
      const ringNoun = (namedRingPattern && !_isTaughtAromatic(ring, _graphData, _adjacency))
        ? (SIZE_WORDS[ring.size] || String(ring.size)) + "-membered ring"
        : ring.type + " ring";
      const ringPhrase = namedRingPattern
        ? ringNoun + " (" + namedRingPattern + ")"
        : ringNoun;

      // Phase 17-5b (KD-29): the article before ringPhrase was hard-coded at all
      // four pushes below ("A " once, "built on a " three times), so a
      // vowel-initial ring noun read "A imidazole ring" / "built on a oxazole
      // ring". Both forms now come from the phrase's own first letter.
      const ringArticle = _aOrAnWord(ringPhrase);
      const ringArticleCapitalised = _aOrAnWordCapitalised(ringPhrase);

      // Phase 9-4 (CT-4h): derive ring substituents from the shared
      // _enumerateRingBranchPoints primitive so position detection matches
      // the comprehensive tier (G18). Each branch is tagged with its
      // functional group via atomToGroup; branches without a recognised
      // group (bare alkyls) are filtered out, preserving the prior scope
      // of "list functional-group substituents only". Spreading the group
      // onto the entry and overriding attachmentVertexId with the
      // branch-point value keeps _detectSubstitutionPattern and
      // _groupDisplayName callers byte-identical downstream.
      const ringMemberSet = new Set(ring.memberVertexIds);
      const branchPoints = _enumerateRingBranchPoints(ringMemberSet, _adjacency);
      // Phase 10-8 (N5): sort branch points via the shared helper so the
      // standard tier's substituent order agrees with the comprehensive
      // tier's branch order. Pre-10-8 this enumeration followed
      // vertex-iteration order, which produced mirror-image orderings vs
      // the comprehensive tier's angular-sorted walk for aspirin / uracil /
      // cytosine / thymine.
      const sortedBranchPoints = _sortBranchPointsByRingAndAngle(branchPoints, [ring], _graphData);
      const atomToGroup = new Map();
      for (const g of groups) for (const a of (g.atoms || [])) atomToGroup.set(a, g);
      const ringSubstituents = sortedBranchPoints
        .map(bp => {
          const group = atomToGroup.get(bp.branchRootId);
          return group ? { ...group, attachmentVertexId: bp.attachmentVertexId } : null;
        })
        .filter(s => s != null);

      if (ringSubstituents.length === 0) {
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. " +
          ringArticleCapitalised + " " + ringPhrase + "."
        );
      } else if (ringSubstituents.length === 1) {
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on " +
          ringArticle + " " + ringPhrase +
          ". One substituent: " + _groupDisplayName(ringSubstituents[0]) + "."
        );
      } else if (ringSubstituents.length === 2 && ring.size === 6) {
        // Use substitution pattern for 2 substituents on a 6-membered ring
        const pattern = _detectSubstitutionPattern(ring, ringSubstituents, _graphData);
        const posPhrase = pattern ? " " + pattern : "";
        // Phase 10-6 (N6): collapse duplicates (e.g. disubstituted benzene
        // with two hydroxyls → "two hydroxyl groups (–OH)"); two-unique
        // cases fall through to the same display strings as before.
        const groupNames = _collapseGroupList(_orderGroupsBySeniority(ringSubstituents));
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on " +
          ringArticle + " " + ringPhrase +
          ". Two substituents" + posPhrase +
          ": " + _formatList(groupNames) + "."
        );
      } else {
        // Phase 10-6 (N6): collapse duplicates so barbituric acid's three
        // ring-internal carbonyls read "two lactams (cyclic amide), and a
        // urea linkage." instead of "a lactam, a lactam, and a urea linkage."
        const groupNames = _collapseGroupList(_orderGroupsBySeniority(ringSubstituents));
        const countWord = _numberWord(ringSubstituents.length);
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on " +
          ringArticle + " " + ringPhrase +
          ". " + countWord.charAt(0).toUpperCase() + countWord.slice(1) +
          " substituents: " + _formatList(groupNames) + "."
        );
      }
    } else if (scaffoldType === "fused-rings") {
      // Fused ring system — describe each ring by size
      const ringDescs = rings.map(r => "a " + _numberWord(r.size) + "-membered ring");
      // Phase 9-1: ring-system atom count is the union of ring member vertex IDs
      // (m + n − k for two fused rings; generalises to arbitrary fusion counts).
      // heavyAtomCount would include exocyclic substituents and is therefore wrong.
      const ringSystemAtomIds = new Set();
      for (const r of rings) for (const id of r.memberVertexIds) ringSystemAtomIds.add(id);
      const ringSystemAtomCount = ringSystemAtomIds.size;

      // Phase 11-1a (N-post10-2): sort functional groups through the shared
      // _sortBranchPointsByRingAndAngle helper so this STD fused-rings list
      // agrees with the COMP tier's branch-walk order. Pre-11-1a, groups[]
      // was consumed in detection order — for theobromine and theophylline
      // the lactam C=O had a lower atom index than the urea C=O, so STD
      // emitted "lactam, urea" while COMP walked urea-then-lactam. 10-8
      // wired the single-ring STD path above and the SHORT tier but left
      // this fused-rings STD call-site on detection order because it does
      // not call _enumerateRingBranchPoints — it consumed groups[] directly.
      const fusedBranchPoints = _enumerateRingBranchPoints(ringSystemAtomIds, _adjacency);
      const fusedSortedBranchPoints = _sortBranchPointsByRingAndAngle(fusedBranchPoints, rings, _graphData);
      const fusedAtomToGroup = new Map();
      for (const g of groups) for (const a of (g.atoms || [])) fusedAtomToGroup.set(a, g);
      const sortedGroups = [];
      const fusedSeenGroups = new Set();
      for (const bp of fusedSortedBranchPoints) {
        const group = fusedAtomToGroup.get(bp.branchRootId);
        if (group && !fusedSeenGroups.has(group)) {
          fusedSeenGroups.add(group);
          sortedGroups.push(group);
        }
      }
      // Defensive tail: any group not reachable via ring-branch enumeration
      // retains its original position. Not expected to fire on xanthine-
      // class substrates; prevents silent loss on future fixtures.
      for (const g of groups) {
        if (!fusedSeenGroups.has(g)) sortedGroups.push(g);
      }

      // Phase 10-3: partition alkyl substituents out of the functional-group
      // list so they join the scaffold sentence ("with three N-methyl groups")
      // rather than being filed under "Functional groups: …" alongside named
      // motifs like lactams. Without this, caffeine would read "Functional
      // groups: a lactam, a urea linkage, and three N-methyl groups", which
      // mis-classifies methyls as functional groups.
      // Phase 17 (KD-14): replace the ring-branch geometry order with cascade
      // seniority for in-cascade lists (naproxen: acid > methoxy) so STD agrees
      // with SHORT/COMP. Defers on out-of-cascade fixtures (caffeine,
      // theobromine, theophylline, paraxanthine) → geometry order preserved
      // byte-for-byte. Subsumes the recon's unwired-SHORT-arm "fourth fork" but
      // corrects to seniority rather than matching a wrong geometry order.
      const seniorityOrderedGroups = _orderGroupsBySeniority(sortedGroups);
      const { alkylGroups, otherGroups } = _partitionAlkylGroups(seniorityOrderedGroups);
      const alkylClause = _buildAlkylScaffoldClause(alkylGroups);

      // Phase 10-4 (G3 + G4): if this is a recognised named fused system
      // (naphthalene, indole, quinoline, purine, xanthine), surface the
      // common name as a parenthetical on the "N-atom fused ring system"
      // opener — xanthine additionally carries the "purine-2,6-dione"
      // systematic label. Keeping the "fused ring system" prose preserves
      // the connectivity vocabulary the 8C-CT suite expects to find, and
      // still closes G4 by exposing the named label that the standard tier
      // previously discarded.
      const namedSystem = _identifyFusedSystemName(rings, _graphData, _adjacency);
      let scaffoldSentence =
        _aOrAn(ringSystemAtomCount) + " " + ringSystemAtomCount +
        "-atom fused ring system";
      if (namedSystem) {
        const systematic = FUSED_SYSTEM_SYSTEMATIC[namedSystem];
        const parenLabel = systematic ? namedSystem + ", " + systematic : namedSystem;
        scaffoldSentence += " (" + parenLabel + ")";
        if (alkylClause) scaffoldSentence += " " + alkylClause;
      } else {
        scaffoldSentence += " with " + _formatList(ringDescs);
        if (alkylClause) scaffoldSentence += ", " + alkylClause;
      }
      parts.push(scaffoldSentence + ".");

      // Functional groups on fused ring systems (excluding alkyls, handled above)
      if (otherGroups.length > 0) {
        // Phase 10-6: collapse via shared helper; previously this branch
        // carried the reference countByShort/seen-Set implementation inline.
        const displayItems = _collapseGroupList(otherGroups);
        if (displayItems.length > 0) {
          parts.push("Functional groups: " + _formatList(displayItems) + ".");
        }
      }
    } else {
      // Chain scaffold
      if (chain) {
        if (chain.length === 1) {
          // Phase 11-1d (N-post10-8, Part A): thread 10-5's single-carbon
          // scaffold through STD so urea, guanidine, phosgene, carbonic acid
          // all agree on scaffold with COMP (mathpix-chemistry-comprehensive.js:772).
          // Part B: detect urea inline and emit the chemistry-canonical
          // "urea linkage" phrasing in place of the amide+amine decomposition
          // (Option ii — see prompt-phase11-1d.md). Predicate mirrors
          // _buildComprehensiveSections's isUreaMolecule (9-3 design);
          // duplicated here rather than cross-file exposed to keep
          // comprehensive.js untouched this stage.
          const isUreaMolecule = heavyAtomCount === 4 && groups.length === 2 &&
            groups.some(g => g.shortName === "amide" && g.shorthand === "–CONH₂") &&
            groups.some(g => g.shortName === "amine");
          // Phase 17 (KD-23): this was the only arm in _assembleDescription
          // emitting no atom count — and the five fixtures lacking it were
          // exactly the five KD-23 collision fixtures. Prefix the same
          // "N-atom molecule." opener the branched/unbranched arms below
          // emit (user decision: uniform audible opening across all 30
          // STANDARDs). Urea's STD == SHORT collision closes as a
          // consequence, its SHORT untouched.
          const atomCountOpener = _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. ";
          if (isUreaMolecule) {
            parts.push(atomCountOpener + "A single carbon bearing a urea linkage (H₂N–CO–NH₂).");
          } else if (groups.length === 0) {
            parts.push(atomCountOpener + "A single carbon atom.");
          } else {
            parts.push(atomCountOpener + "A single carbon bearing " + _formatList(_collapseGroupList(_orderGroupsBySeniority(groups))) + ".");
          }
        } else if (chain.branched) {
          // Phase 17 (KD-12): relocate the molecular heavy-atom count off the
          // chain noun and onto "molecule", matching the ring and joined-rings
          // arms above ("A N-atom molecule. <scaffold>."). Grafted onto the
          // chain it read as though the chain itself carried N atoms,
          // contradicting the carbon count in the same phrase. The chain noun
          // phrase matches SHORT's existing wording.
          parts.push(
            _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. A branched carbon chain with " +
            _numberWord(chain.length) + " carbons in the longest path"
          );
        } else {
          // Phase 17 (KD-12): same relocation as the branched arm above.
          parts.push(
            _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. A " +
            _numberWord(chain.length) + "-carbon chain"
          );
        }

        // --- 4. Chain decorations ---
        // Phase 11-1d: skip decoration for chain.length === 1 — the
        // single-carbon branch above emits a complete sentence already.
        if (chain.length !== 1) {
          if (groups.length > 0) {
            // Phase 10-6: converge on the shared collapse helper so all
            // tier branches use one implementation. Previously carried an
            // inline countByShort/seen-Set duplicate with a special "all-
            // same-type" single-phrase path; the helper produces the same
            // collapsed strings and _formatList handles the single-item
            // case cleanly.
            // Phase 17 (KD-14): normalise group order to cascade seniority so
            // STD agrees with COMP (which is already anchored) on inverting
            // pairs like cysteamine (thiol > amine). Defers on out-of-cascade
            // lists — see _orderGroupsBySeniority.
            const displayItems = _collapseGroupList(_orderGroupsBySeniority(groups));
            // Phase 15-2b: emit "at C{N}" suffix when single hydroxyl group
            // + no stereo descriptors active (guard inside _chainLocantSuffix).
            const locantSuffix = groups.length === 1
              ? _chainLocantSuffix(groups[0], chain, stereoEmission, _graphData, _adjacency)
              : "";
            parts[parts.length - 1] += " with " + _formatList(displayItems) + locantSuffix + ".";
          } else {
            parts[parts.length - 1] += ".";
          }
        }
      }
    }

    // --- 6. Element list (Phase 8C-2) ---
    if (formula && formula.elements) {
      const elementNames = Object.keys(formula.elements)
        .map(sym => ELEMENT_NAMES[sym] || sym.toLowerCase())
        .filter(Boolean);
      if (elementNames.length > 0) {
        parts.push("Contains " + _formatList(elementNames) + ".");
      }
    }

    // --- 7. Final assembly + word count guard ---
    const assembled = parts.join(" ").replace(/\.\./g, ".").trim();
    const wordCount = assembled.split(/\s+/).length;
    if (wordCount > maxWords) {
      logWarn("Structural description exceeds " + maxWords + "-word limit", { wordCount, description: assembled });
    }
    return assembled;
  }

  /**
   * Assemble a short (1–2 sentence) structural description for alt text.
   * Omits molecular weight, element list, atom count, and shorthand notation.
   *
   * @param {Object} analysis - from analyseStructure()
   * @param {Object} [pubchemData] - optional PubChem lookup result
   * @returns {string} Short plain English description
   * @private
   */
  function _assembleShortDescription(analysis, pubchemData) {
    // Phase 15-2c (LOCK 5): centralHeteroatom + bridgedAcyclic added (matches
    // _assembleDescription's destructure for tier-consistency).
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, stereoEmission,
            centralHeteroatom, bridgedAcyclic, _graphData, _adjacency } = analysis;
    const groups = functionalGroups || [];
    const parts = [];

    // --- 1. Name + formula opener (no molecular weight) ---
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    // Phase 12-5b-3: prefer engine-supplied named-system label over a
    // parenthetical-locant-laden iupacName when commonNames is empty.
    // Same fallback shape as _assembleDescription's name-selection — both
    // tiers must converge on the same opener-name to keep SHORT/STD
    // alignment intact (description-engine tier consistency invariant).
    const namedSystemLabel = _selectNamedSystemLabel(rings, _graphData, _adjacency);
    const looksLikeIupacSyntax = !!iupacName
      && /[(),]/.test(iupacName)
      && /\d-|-\d/.test(iupacName);
    const name = commonName
      || (looksLikeIupacSyntax && namedSystemLabel ? namedSystemLabel : null)
      || iupacName
      || null;
    const formula = pubchemData?.inchi
      ? utils.parseInChIFormula(pubchemData.inchi)
      : null;
    const formulaUnicode = formula ? _formatFormulaUnicode(formula.raw) : null;

    let opener = "";
    if (name) {
      // Phase 15-2a: stereo prefix injection (atom-CIP + bond-E/Z) with
      // L15 lexical suppression. Tier-consistent with STD + COMP openers.
      // Phase 16-2a: chain + adjacency feed locant-prefixed stereo (KD-4/KD-7).
      const stereoPrefix = _deriveStereoPrefix(stereoEmission, name, chain, _adjacency);
      const displayName = stereoPrefix + name;
      opener = _capitaliseOpener(displayName); // P-14.5.2 affix-aware (16-2c)
      if (formulaUnicode) {
        opener += " (" + formulaUnicode + ")";
      }
      opener += ".";
      parts.push(opener);
    }

    // --- 2. Scaffold + groups sentence ---
    if (scaffoldType === "joined-rings") {
      // Phase 15-1a (KD-1 SHORT): joined non-fused rings (e.g. biphenyl).
      // Pre-15-1a this case fell into the `scaffoldType === "aromatic-ring"`
      // branch below and emitted the misleading "A 12-atom benzene ring."
      // for biphenyl. The new short-form helper conveys ring count + ring
      // type + junction in the alt-text terseness budget (~43 chars for
      // biphenyl, well under the 125-char cap). No atom-count opener —
      // matches SHORT-tier conventions (e.g. caffeine SHORT doesn't lead
      // with atom count either).
      const scaffoldSentence = _describeJoinedRingScaffoldShort(rings, _graphData, _adjacency);
      if (scaffoldSentence) {
        parts.push(scaffoldSentence + ".");
      }
      // Helper returns null for non-identical-ring scaffolds (Phase 15+
      // carry-forward; see _assembleDescription's matching note).
    } else if (scaffoldType === "central-heteroatom") {
      // Phase 15-2c (LOCK 5): acyclic central-heteroatom SHORT prose.
      // Dispatches on FG element-specifier; targets per § 7 verbatim.
      const sulphoxideGroup = groups.find(g => g.shortName === "sulphoxide");
      if (sulphoxideGroup && centralHeteroatom) {
        // § 7.3 SHORT: "A sulphoxide group flanked by two methyl groups."
        const subCount = centralHeteroatom.substituents.length;
        parts.push("A sulphoxide group flanked by " + _numberWord(subCount) + " methyl groups.");
      } else {
        const amineGroup = groups.find(g => g.shortName === "amine" && typeof g.subtype === "number" && g.subtype >= 2);
        if (amineGroup && centralHeteroatom) {
          const subCount = centralHeteroatom.substituents.length;
          const subtypeName = AMINE_SUBTYPE_NAMES[amineGroup.subtype] || "amine";
          // § 7.6 SHORT: "A secondary amine with two methyl substituents."
          // § 7.7 SHORT: "A tertiary amine with three methyl substituents."
          parts.push("A " + subtypeName + " with " + _numberWord(subCount) + " methyl substituents.");
        }
      }
    } else if (scaffoldType === "bridged-acyclic") {
      // Phase 15-2c (LOCK 5): acyclic bridged-heteroatom SHORT prose.
      if (bridgedAcyclic && bridgedAcyclic.leftSubstructure) {
        const desc = bridgedAcyclic.leftSubstructure.descriptor || "alkyl";
        const bridgeElem = _elementName(bridgedAcyclic.bridgeElement);
        // § 7.4 SHORT: "Two ethyl groups bridged by an oxygen."
        parts.push("Two " + desc + " groups bridged by " + _aOrAnElement(bridgeElem) + " " + bridgeElem + ".");
      }
    } else if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      const ring = rings[0];
      // Phase 9-4 (CT-4h): share the _enumerateRingBranchPoints primitive
      // with the standard and comprehensive tiers so position detection is
      // tier-consistent (G18). See _assembleDescription for the rationale.
      const ringMemberSet = new Set(ring.memberVertexIds);
      const branchPoints = _enumerateRingBranchPoints(ringMemberSet, _adjacency);
      // Phase 10-8 (N5): sort via the shared helper for tier-consistency
      // with the standard tier. If the STD tier sorts but the SHORT tier
      // doesn't, the aria-label (SHORT) and visible description (STD) would
      // diverge on order — a new N5-style inconsistency that didn't exist
      // pre-10-8. One helper, one ordering, all three tiers.
      const sortedBranchPoints = _sortBranchPointsByRingAndAngle(branchPoints, [ring], _graphData);
      const atomToGroup = new Map();
      for (const g of groups) for (const a of (g.atoms || [])) atomToGroup.set(a, g);
      const ringSubstituents = sortedBranchPoints
        .map(bp => {
          const group = atomToGroup.get(bp.branchRootId);
          return group ? { ...group, attachmentVertexId: bp.attachmentVertexId } : null;
        })
        .filter(s => s != null);

      // Phase 10-4 (G8-revised): pyrimidine-dione pattern label at the short
      // tier too — uracil / thymine / cytosine scaffolds carry the parenthetical
      // alongside the ring type so the short alt-text identifies them.
      // Phase 11-2d (N-post10-5): fall through to _identifyPyridinonePattern
      // for 2-pyridone (1 N + 1 exocyclic C=O) → "pyridin-2(1H)-one".
      const pyrimidinePatternShort = _identifyPyrimidinePattern(ring, _graphData, _adjacency)
        || _identifyPyridinonePattern(ring, _graphData, _adjacency);

      // Phase 17 (KD-12): the unnamed path used to graft the molecular heavy-atom
      // count onto the ring noun ("A 13-atom benzene ring"), which reads as though
      // the ring itself held 13 atoms. Both paths now emit the scaffold noun the
      // named path already produced; STD keeps the count on "molecule", where it
      // is unambiguous.
      // Phase 17 (KD-13): a taught-non-aromatic dione ring drops the aromatic-
      // parent noun for its size, keeping the systematic parenthetical (appended
      // below) so its identity is never lost. Conditional on the parenthetical
      // resolving — a bare size noun is never emitted.
      let ringNoun;
      if (pyrimidinePatternShort && !_isTaughtAromatic(ring, _graphData, _adjacency)) {
        ringNoun = "A " + (SIZE_WORDS[ring.size] || String(ring.size)) + "-membered ring";
      } else {
        // Phase 17-5b (KD-29): article from the ring noun's first letter, so a
        // vowel-initial type reads "An imidazole ring". The redundant benzene
        // branch is an inert observation recorded on KD-29 and left as-is.
        ringNoun = ring.type === "benzene"
          ? "A benzene ring"
          : _aOrAnWordCapitalised(ring.type) + " " + ring.type + " ring";
      }
      let scaffold = ringNoun;
      if (pyrimidinePatternShort) scaffold += " (" + pyrimidinePatternShort + ")";

      if (ringSubstituents.length === 0) {
        parts.push(scaffold + ".");
      } else if (ringSubstituents.length <= 3) {
        // Phase 11-1c (N-post10-7): collapse duplicate short-form names via
        // the short-tier sibling of _collapseGroupList so barbituric acid's
        // two lactams surface as "two lactams" rather than "a lactam, and
        // a lactam" — matching STD's already-collapsed behaviour.
        // Phase 17 (KD-14): seniority-order the single-ring substituent list so
        // SHORT stays tier-consistent with STD/COMP. All current single-ring
        // fixtures are out-of-cascade (aspirin, cytosine, uracil, thymine,
        // barbituric acid) → the guard defers → geometry order preserved.
        const groupNames = _collapseGroupListShort(_orderGroupsBySeniority(ringSubstituents));
        let groupList;
        if (groupNames.length === 2) {
          groupList = groupNames[0] + " and " + groupNames[1];
        } else {
          groupList = _formatList(groupNames);
        }
        let suffix = "";
        if (ringSubstituents.length === 2 && ring.size === 6) {
          const pattern = _detectSubstitutionPattern(ring, ringSubstituents, _graphData);
          if (pattern) suffix = " " + pattern;
        }
        parts.push(scaffold + " with " + groupList + suffix + ".");
      } else {
        parts.push(scaffold + " with " + _numberWord(ringSubstituents.length) + " functional groups.");
      }
    } else if (scaffoldType === "fused-rings") {
      // Phase 10-3: surface alkyl substituents so caffeine (three N-methyls)
      // and theobromine (two N-methyls) become distinguishable at short tier.
      // Phase 12-3b (N-post11-4): when no alkyls are present, also surface
      // non-alkyl substituents so adenine SHORT emits its amine and naproxen
      // SHORT emits its methoxy + COOH. The alkyls-only-when-alkyls-present
      // rule preserves the xanthine SHORT byte-identity guarantee (caffeine /
      // theobromine / theophylline are alkyls-only fixtures); see (3b-2) = (c)
      // in prompt-phase12-3b.md.
      // Phase 17 (KD-14): normalise to cascade seniority so SHORT fused-rings
      // agrees with STD/COMP on in-cascade lists (naproxen already acid >
      // methoxy here, so it stays put); defers on the xanthine class.
      const { alkylGroups, otherGroups } = _partitionAlkylGroups(_orderGroupsBySeniority(groups));
      const alkylClause = _buildAlkylScaffoldClause(alkylGroups);

      let nonAlkylClause = "";
      if (!alkylClause && otherGroups.length > 0) {
        // Mirrors the single-ring branch's pattern at lines 2076-2096:
        // _collapseGroupListShort handles duplicate pluralisation; 2-item
        // lists drop the Oxford comma; 3-item lists keep it; 4+ collapses
        // to "<count> functional groups".
        const groupNames = _collapseGroupListShort(otherGroups);
        let groupList = "";
        if (groupNames.length === 1) {
          groupList = groupNames[0];
        } else if (groupNames.length === 2) {
          groupList = groupNames[0] + " and " + groupNames[1];
        } else if (groupNames.length <= 3) {
          groupList = _formatList(groupNames);
        } else {
          groupList = _numberWord(otherGroups.length) + " functional groups";
        }
        if (groupList) nonAlkylClause = "with " + groupList;
      }

      // Phase 10-4 (G3 + G4): surface the named fused system as a short
      // parenthetical on "A fused ring system …" so both alt-text and the
      // standard tier share the "fused ring system" vocabulary. For caffeine
      // / theobromine this becomes "A fused ring system (xanthine,
      // purine-2,6-dione) with three N-methyl groups." — comfortably under
      // the 125-char cap and differentiating the two compounds.
      const namedSystem = _identifyFusedSystemName(rings, _graphData, _adjacency);
      let scaffold;
      if (namedSystem) {
        const systematic = FUSED_SYSTEM_SYSTEMATIC[namedSystem];
        const parenLabel = systematic ? namedSystem + ", " + systematic : namedSystem;
        scaffold = "A fused ring system (" + parenLabel + ")";
      } else {
        const ringDescs = rings.map(r => "a " + _numberWord(r.size) + "-membered ring");
        let ringList;
        if (ringDescs.length === 2) {
          ringList = ringDescs[0] + " and " + ringDescs[1];
        } else {
          ringList = _formatList(ringDescs);
        }
        scaffold = "A fused ring system of " + ringList;
      }
      let suffix = "";
      if (alkylClause) suffix = " " + alkylClause;
      else if (nonAlkylClause) suffix = " " + nonAlkylClause;
      parts.push(scaffold + suffix + ".");
    } else if (chain) {
      // Phase 11-1d (N-post10-8): single-carbon short-circuit, gated on
      // heavyAtomCount > 2 to keep methanol (C + O) on its existing
      // "A one-carbon chain with …" prose. The gate mirrors STD's early-
      // return at line ~1508 ("A methyl group bonded to …" for
      // heavyAtomCount <= 2 && groups.length === 1 && rings.length === 0)
      // in polarity: SHORT skips single-carbon rephrasing when STD takes
      // its alkyl-style shortcut. Methanol tier alignment is explicitly
      // deferred — see Phase 11 backlog.
      if (chain.length === 1 && heavyAtomCount > 2) {
        const isUreaMolecule = heavyAtomCount === 4 && groups.length === 2 &&
          groups.some(g => g.shortName === "amide" && g.shorthand === "–CONH₂") &&
          groups.some(g => g.shortName === "amine");
        if (isUreaMolecule) {
          parts.push("A single carbon bearing a urea linkage (H₂N–CO–NH₂).");
        } else if (groups.length === 0) {
          parts.push("A single carbon atom.");
        } else {
          // Phase 17 (KD-14): seniority-ordered to stay tier-consistent with STD/COMP.
          const groupNames = _collapseGroupListShort(_orderGroupsBySeniority(groups));
          const groupList = groupNames.length === 2
            ? groupNames[0] + " and " + groupNames[1]
            : _formatList(groupNames);
          parts.push("A single carbon bearing " + groupList + ".");
        }
      } else {
        let scaffold = "A " + _numberWord(chain.length) + "-carbon chain";
        if (groups.length === 0) {
          parts.push(scaffold + ".");
        } else if (groups.length === 1) {
          // Phase 15-2b: locant suffix per scope guard (hydroxyl + no stereo).
          const locantSuffix = _chainLocantSuffix(groups[0], chain, stereoEmission, _graphData, _adjacency);
          // Phase 15-2c (LOCK 3): subtype-aware amine SHORT for methylamine
          // (#12). Inline rather than via _shortGroupName so guanidine's
          // collapsed 2-amine SHORT path stays on "two amines" (baseline).
          const g = groups[0];
          let shortName;
          if (g.shortName === "amine" && typeof g.subtype === "number") {
            shortName = "a " + (AMINE_SUBTYPE_NAMES[g.subtype] || "amine");
          } else {
            shortName = _shortGroupName(g);
          }
          parts.push(scaffold + " with " + shortName + locantSuffix + ".");
        } else if (groups.length <= 3) {
          // Phase 11-1c (N-post10-7): collapse duplicate short-form names so
          // guanidine's three amines surface as "three amines" rather than
          // "an amine, an amine, and an amine" — matching STD's already-
          // collapsed behaviour.
          // Phase 17 (KD-14): normalise to cascade seniority so SHORT agrees
          // with STD/COMP on inverting pairs (cysteamine thiol > amine).
          const groupNames = _collapseGroupListShort(_orderGroupsBySeniority(groups));
          let groupList;
          if (groupNames.length === 2) {
            groupList = groupNames[0] + " and " + groupNames[1];
          } else {
            groupList = _formatList(groupNames);
          }
          parts.push(scaffold + " with " + groupList + ".");
        } else {
          parts.push(scaffold + " with " + _numberWord(groups.length) + " functional groups.");
        }
      }
    }

    return parts.join(" ").replace(/\.\./g, ".").trim();
  }

  // =========================================================================

  // =========================================================================
  // Public surface
  //   generateStructuralDescription / *ForAria,
  //   generateShortDescription / *ForAria,
  //   generateComprehensiveDescription / *ForAria / *HTML
  // =========================================================================

  // Phase 14-1d Step 6: Public-wrapper preamble bindings.
  //   FEATURE_FLAGS — gates all 7 wrappers (early return on disabled flag).
  //   analyseStructure — namespace-level binding into classify.js's relocated
  //     analyseStructure (Phase 14-1c). Bound here per Rule A — only callers
  //     are the 4 desc.js public wrappers (now relocated). comp.js's 3
  //     public wrappers use utils.analyseStructure which self-resolves via
  //     the existing utils binding above.
  const FEATURE_FLAGS = internals.featureFlags;
  const analyseStructure = window.MathpixChemistryClassify.analyseStructure;

  /**
   * Generate a natural-language structural description of a SMILES molecule.
   * Synchronous — returns empty string if no cached graph is available.
   * The graph is automatically cached by renderStructure() and renderStructureToBlob().
   *
   * @param {string} smiles - SMILES notation
   * @param {Object} [pubchemData] - PubChem lookup result (optional)
   * @param {string[]} [pubchemData.commonNames] - Common names (e.g. ["aspirin"])
   * @param {string} [pubchemData.iupacName] - IUPAC name
   * @returns {string} Natural English description, or empty string
   */
  function generateStructuralDescription(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = analyseStructure(smiles);
    if (!analysis) return "";
    return _assembleDescription(analysis, pubchemData);
  }

  /**
   * Generate a screen-reader-optimised structural description.
   * Same as generateStructuralDescription but uses spaced-out formula
   * format (e.g. "C 9, H 8, O 4") instead of Unicode subscripts.
   *
   * @param {string} smiles - SMILES notation
   * @param {Object} [pubchemData] - PubChem lookup result (optional)
   * @returns {string} Screen-reader-friendly description, or empty string
   */
  function generateStructuralDescriptionForAria(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = analyseStructure(smiles);
    if (!analysis) return "";
    const desc = _assembleDescription(analysis, pubchemData);
    if (!desc) return "";
    // Replace Unicode subscript formula with screen-reader-friendly format
    const formula = pubchemData?.inchi
      ? utils.parseInChIFormula(pubchemData.inchi)
      : null;
    if (formula) {
      const unicodeFormula = _formatFormulaUnicode(formula.raw);
      const srFormula = utils.formatFormulaForScreenReader(formula.raw);
      return _toAriaText(desc, unicodeFormula, srFormula);
    }
    return desc;
  }

  /**
   * Generate a short (1–2 sentence) structural description for alt text.
   * Synchronous — returns empty string if no cached graph is available.
   *
   * @param {string} smiles - SMILES notation
   * @param {Object} [pubchemData] - PubChem lookup result (optional)
   * @returns {string} Short description, or empty string
   */
  function generateShortDescription(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = analyseStructure(smiles);
    if (!analysis) return "";
    return _assembleDescription(analysis, pubchemData, { detail: "short" });
  }

  // Build a short "Name (formula)" caption from PubChem data only. Because it
  // draws on PubChem alone — and not the parsed structure — a compound with no
  // common name and a locant-heavy IUPAC name will show the raw IUPAC name here,
  // whereas the prose opener can prefer a structural label because it also has
  // the parsed structure to hand. Fallback rule intended: name and formula,
  // else name alone, else formula alone, else null.
  function generateChemistryCaption(pubchemData) {
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    const name = commonName || iupacName || null;
    const formula = pubchemData?.inchi ? utils.parseInChIFormula(pubchemData.inchi) : null;
    const formulaUnicode = formula ? _formatFormulaUnicode(formula.raw) : null;
    const capitalisedName = name ? _capitaliseOpener(name) : null;
    if (capitalisedName && formulaUnicode) return capitalisedName + " (" + formulaUnicode + ")";
    if (capitalisedName) return capitalisedName;
    if (formulaUnicode) return formulaUnicode;
    logDebug("generateChemistryCaption: no name and no formula — returning null");
    return null;
  }

  /**
   * Generate a screen-reader-optimised short description.
   * Same as generateShortDescription but with spaced-out formula format.
   *
   * @param {string} smiles - SMILES notation
   * @param {Object} [pubchemData] - PubChem lookup result (optional)
   * @returns {string} Screen-reader-friendly short description, or empty string
   */
  function generateShortDescriptionForAria(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = analyseStructure(smiles);
    if (!analysis) return "";
    const desc = _assembleDescription(analysis, pubchemData, { detail: "short" });
    if (!desc) return "";
    const formula = pubchemData?.inchi
      ? utils.parseInChIFormula(pubchemData.inchi)
      : null;
    if (formula) {
      const unicodeFormula = _formatFormulaUnicode(formula.raw);
      const srFormula = utils.formatFormulaForScreenReader(formula.raw);
      return _toAriaText(desc, unicodeFormula, srFormula);
    }
    return desc;
  }

  function generateComprehensiveDescription(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) return "";
    return _assembleComprehensiveDescription(analysis, pubchemData, smiles);
  }

  function generateComprehensiveDescriptionForAria(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) return "";
    const desc = _assembleComprehensiveDescription(analysis, pubchemData, smiles);
    if (!desc) return "";
    const formula = pubchemData?.inchi ? utils.parseInChIFormula(pubchemData.inchi) : null;
    if (formula) {
      const unicodeFormula = _formatFormulaUnicode(formula.raw);
      const srFormula = utils.formatFormulaForScreenReader(formula.raw);
      return helpers.toAriaText(desc, unicodeFormula, srFormula);
    }
    return desc;
  }

  /**
   * Phase 8C-CT-3e: HTML form of the comprehensive description for the
   * `<details>` panel. Plain-text API is unchanged.
   */
  function generateComprehensiveDescriptionHTML(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) return "";
    return _assembleComprehensiveDescriptionHTML(analysis, pubchemData, smiles);
  }

  // =========================================================================
  // internals.helpers contract
  //   prose.js owns at Step 6 final state (44 entries):
  //     - 26 transit entries from Steps 1-4 (consumed by comprehensive.js's
  //       residual destructure bindings during the cleave; STAY per
  //       transit-STAY pattern even when destructure-side trims at Step 4
  //       and Step 6 — see cleave manifest § 2.3).
  //     - 11 prose-tier publish entries from Step 5 (9 migrated from
  //       descriptions.js's Table 1 + 2 forwarding-stub publish entries
  //       assembleDescription / assembleShortDescription).
  //     - 7 wrapper publish entries from Step 6 (the 7 generate*Description*
  //       wrappers, consumed by the 7 forwarding stubs in desc.js + comp.js
  //       via MathpixChemistryProse.internals.helpers.X.apply at call-time).
  //   Per transit-STAY (cleave manifest § 2.3): publish surface stays
  //   defensively even when its consumers retire (e.g. desc.js's Step 5
  //   _assembleDescription / _toAriaText stubs were retired at Step 6 but
  //   their publish entries assembleDescription / assembleShortDescription
  //   stay for future consumers). Cleanup belongs to 14-3 hygiene.
  //   Lesson seed (Step 6 closure): transit-STAY scope clarification —
  //   applies to published namespace surface, not just destructure-side
  //   bindings.
  // =========================================================================

  // =========================================================================
  // Namespace export
  // =========================================================================
  window.MathpixChemistryProse = {
    // Phase 14-1d Step 6: public wrappers exposed at namespace level. Per
    // prose.js header — "window.MathpixChemistryProse with seven
    // generate*Description* functions". Forwarding stubs in desc.js + comp.js
    // route through internals.helpers (per Surface 4 stub-target form);
    // these namespace-level fields preserve the cleave-manifest contract.
    generateStructuralDescription: generateStructuralDescription,
    generateStructuralDescriptionForAria: generateStructuralDescriptionForAria,
    generateShortDescription: generateShortDescription,
    generateShortDescriptionForAria: generateShortDescriptionForAria,
    generateComprehensiveDescription: generateComprehensiveDescription,
    generateComprehensiveDescriptionForAria: generateComprehensiveDescriptionForAria,
    generateComprehensiveDescriptionHTML: generateComprehensiveDescriptionHTML,
    internals: {
      helpers: {
        // Phase 14-1d Step 1 transit entries (7 functions + 3 constants).
        // Consumed by comprehensive.js's residual code via the proseHelpers
        // destructure block in its IIFE preamble. Trim or keep per
        // transit-STAY pattern when consumers vacate (Steps 2-4).
        elem: _elem,
        elementName: _elementName,
        aOrAnElement: _aOrAnElement,
        ordinal: _ordinal,
        locantOrder: _locantOrder,
        describeHeteroatoms: _describeHeteroatoms,
        ringComposition: _ringComposition,
        bondNames: BOND_NAMES,
        sizeWords: SIZE_WORDS,
        ordinals: ORDINALS,
        // Phase 14-1d Step 2 transit entries — comprehensive-tier body
        // helpers sourced via comprehensive.js's proseHelpers destructure
        // block. Per transit-STAY pattern (cleave manifest § 2.3): publish
        // surface stays even when destructure-side trims at Step 4.
        buildOpener: _buildOpener,
        buildImplicitHydrogenTail: _buildImplicitHydrogenTail,
        describeRingTopology: _describeRingTopology,
        describeFusedRingSystem: _describeFusedRingSystem,
        describeJoinedRingSystem: _describeJoinedRingSystem,
        // Phase 14-1d Step 3 transit entries — comprehensive-tier branch
        // family. Only walkAndDescribeBranches has a destructure binding in
        // comprehensive.js (3 residual callers in _buildComprehensiveSections,
        // a Step 4 mover); the other 3 are publish-only per transit-STAY
        // (their callers all co-moved with them at Step 3).
        walkBranch: _walkBranch,
        describeBranch: _describeBranch,
        describeSubBranches: _describeSubBranches,
        walkAndDescribeBranches: _walkAndDescribeBranches,
        // Phase 14-1d Step 4 transit entries — comprehensive-tier orchestrator
        // + chain/stereo. Only assembleComprehensiveDescription and
        // assembleComprehensiveDescriptionHTML have destructure bindings in
        // comprehensive.js (consumed by the 3 public wrappers, Step 6 movers);
        // the other 5 are publish-only per transit-STAY (their callers all
        // co-moved with them at Step 4 — the orchestrator
        // _buildComprehensiveSections retired all proseHelpers destructure
        // residuals on its way out).
        orderChainAtoms: _orderChainAtoms,
        countStereocenters: _countStereocenters,
        buildComprehensiveSections: _buildComprehensiveSections,
        assembleComprehensiveDescription: _assembleComprehensiveDescription,
        assembleComprehensiveDescriptionHTML: _assembleComprehensiveDescriptionHTML,
        escapeHtml: _escapeHtml,
        finaliseDescription: _finaliseDescription,
        // Phase 14-1d Step 5 prose-tier publish entries — the 9 entries
        // migrated from descriptions.js's internals.helpers Table 1.
        // Together with Step 5's helpers-rebind activation (post-namespace-
        // export below), prose.js now owns the prose-tier publish surface
        // for both descriptions.js's 4 public wrappers (Step 6 movers, via
        // local forwarding stubs) and comprehensive.js's helpers source
        // (rewired at Step 5). Per transit-STAY (cleave manifest § 2.3):
        // these entries are now PRIMARY publish surface, not transit.
        numberWord: _numberWord,
        formatList: _formatList,
        aOrAn: _aOrAn,
        groupDisplayName: _groupDisplayName,
        toAriaText: _toAriaText,
        elementNames: ELEMENT_NAMES,
        sortBranchPointsByRingAndAngle: _sortBranchPointsByRingAndAngle,
        collapseGroupList: _collapseGroupList,
        collapseGroupListShort: _collapseGroupListShort,
        // Phase 14-1d Step 5 forwarding-stub publish entries — required by
        // descriptions.js's local forwarding stubs (_assembleDescription,
        // _toAriaText) for call-time resolution via
        // MathpixChemistryProse.internals.helpers.X.apply(null, arguments).
        // _assembleDescription is NEW publish surface (was internal-only in
        // pre-Step-5 descriptions.js); _toAriaText was already published
        // above (Table 1 migrant). _assembleShortDescription published
        // alongside for symmetry + future-consumer defence. Caught at
        // Step 5 harness gate via "Cannot read properties of undefined
        // (reading 'apply')" — Surface 4 (forwarding-stub publish coverage)
        // formalised as discipline carry-forward.
        // Total post-Step-5: 37 entries (26 transit + 11 prose-tier publish).
        assembleDescription: _assembleDescription,
        assembleShortDescription: _assembleShortDescription,
        // Phase 14-1d Step 6 wrapper publish entries — consumed by the 7
        // forwarding stubs in descriptions.js (4 stubs) + comprehensive.js
        // (3 stubs) for call-time resolution via
        // MathpixChemistryProse.internals.helpers.X.apply(null, arguments).
        // Per Surface 4 discipline (formalised at Step 5 closure): every
        // forwarding stub MUST have a matching publish entry in this contract.
        // Total post-Step-6: 44 entries (26 transit + 11 Step 5 prose-tier
        // publish + 7 Step 6 wrapper publish).
        generateStructuralDescription: generateStructuralDescription,
        generateStructuralDescriptionForAria: generateStructuralDescriptionForAria,
        generateShortDescription: generateShortDescription,
        generateChemistryCaption: generateChemistryCaption,
        generateShortDescriptionForAria: generateShortDescriptionForAria,
        generateComprehensiveDescription: generateComprehensiveDescription,
        generateComprehensiveDescriptionForAria: generateComprehensiveDescriptionForAria,
        generateComprehensiveDescriptionHTML: generateComprehensiveDescriptionHTML,
      },
    },
  };

  // =========================================================================
  // Step 5 — helpers rebind (load-bearing per IIFE preamble spec point 4a)
  //   After Step 5's atomic commit:
  //     1. The 9 prose-tier helpers are defined above
  //     2. The namespace export's helpers literal above is augmented with
  //        the 9 entries
  //     3. The rebind line below activates, flipping the local `helpers`
  //        variable from descriptions.js's (now-empty) table to prose.js's
  //        own (now-populated) table
  //   Function bodies' bare helpers.X callsites continue to resolve — the
  //   binding source flips, the syntax is unchanged. Position-after-namespace-
  //   export is mandatory: the rebind reads window.MathpixChemistryProse,
  //   which is undefined until the namespace-export statement above runs.
  // =========================================================================

  // Phase 14-1d Step 5: helpers rebind activation (load-bearing per IIFE
  // preamble spec point 4a). Flips the local `helpers` variable from
  // descriptions.js's (now-empty) Table 1 to prose.js's own (now-populated)
  // Table 2. Position-after-namespace-export is mandatory: the right-hand
  // side reads window.MathpixChemistryProse, which is undefined until the
  // namespace-export statement above runs.
  helpers = window.MathpixChemistryProse.internals.helpers;

  logInfo("MathpixChemistryProse initialised (Phase 14-1d Step 1)");
})();
