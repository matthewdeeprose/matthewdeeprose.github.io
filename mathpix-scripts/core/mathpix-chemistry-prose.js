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

  // Phase 14-1d Step 5: classify.js helper consumed by Step 5 movers.
  // _assembleDescription + _assembleShortDescription use this for named-
  // system label selection on fused-ring + chain hosts.
  const _selectNamedSystemLabel = classifyHelpers.selectNamedSystemLabel;

  // Phase 14-1d Step 5: derived constant. classifyHelpers.alkylNames is the
  // canonical alkyl-name array (Step 3 binding ALKYL_NAMES); .slice(1) drops
  // the empty-string slot at index 0 to form a Set of bare alkyl bases for
  // _isAlkylShortName's substituent-recognition path.
  const ALKYL_BASE_SET = new Set(ALKYL_NAMES.slice(1));

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
  function _describeRingTopology(classifiedRing) {
    const sizeWord = SIZE_WORDS[classifiedRing.size] || String(classifiedRing.size);
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
    const sigOf = r => r.size + "|" + r.aromatic + "|" + r.heteroatoms.slice().sort().join(",");
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
      const aromaticPrefix = sample.aromatic ? "aromatic " : "";
      opening = "The structure is built on " + countWord + " fused " + aromaticPrefix + sizeWord + "-membered rings" + sharingPhrase;
    } else {
      const ringDescs = rings.map(r => {
        const sizeWord = SIZE_WORDS[r.size] || String(r.size);
        const aromaticPrefix = r.aromatic ? "aromatic " : "";
        return "a" + (r.aromatic ? "n " : " ") + aromaticPrefix + sizeWord + "-membered ring";
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
      const aromaticPrefix = sample.aromatic ? "aromatic " : "";
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
    const sigOf = r => r.size + "|" + r.aromatic + "|" + r.heteroatoms.slice().sort().join(",");
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
      const aromaticPrefix = sample.aromatic ? "aromatic " : "";
      let ringDesc = countWord + " " + aromaticPrefix + sizeWord + "-membered rings";
      // Benzene special case
      if (sample.size === 6 && sample.aromatic && sample.heteroatoms.length === 0) {
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
        const aromaticPrefix = r.aromatic ? "aromatic " : "";
        return "a" + (r.aromatic ? "n " : " ") + aromaticPrefix + sizeWord + "-membered ring";
      });
      parts.push("The structure consists of " + helpers.formatList(ringDescs) + " joined by " + bondPhrase + ".");
      for (const r of rings) {
        const sizeWord = SIZE_WORDS[r.size] || String(r.size);
        const aromaticPrefix = r.aromatic ? "aromatic " : "";
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

  function _buildOpener(pubchemData) {
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    const name = commonName || iupacName || null;
    const formula = pubchemData?.inchi ? utils.parseInChIFormula(pubchemData.inchi) : null;
    const weight = pubchemData?.molecularWeight;
    const formulaUnicode = formula ? _formatFormulaUnicode(formula.raw) : null;
    let opener = "";
    if (name) opener = name.charAt(0).toUpperCase() + name.slice(1);
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

  /** Convert walk steps into plain English prose. */
  function _describeBranch(steps, groupName, adjacency) {
    if (steps.length === 0) return "";
    const sentences = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const elemName = _elementName(step.element);
      const article = _aOrAnElement(elemName);
      const bondName = BOND_NAMES[step.bondType] || "single";
      if (i === 0 && steps.length === 1) {
        let s = article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom is attached to the ring";
        const implicitH = _implicitHydrogens(step.element, step.vertexId, adjacency);
        if (implicitH > 0) {
          s += " (bonded to " + (implicitH === 1 ? "one hydrogen" : helpers.numberWord(implicitH) + " hydrogens") + ")";
        }
        sentences.push(s);
      } else if (i === 0) {
        sentences.push("From the ring, a " + bondName + " bond connects to " + article + " " + elemName + " atom");
      } else {
        sentences.push("From this " + _elementName(steps[i - 1].element) + ", a " + bondName + " bond connects to " + article + " " + elemName + " atom");
      }
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
        const implicitH = _implicitHydrogens(step.element, step.vertexId, adjacency);
        if (implicitH > 0) {
          desc += " (bonded to " + (implicitH === 1 ? "one hydrogen" : helpers.numberWord(implicitH) + " hydrogens") + ")";
        }
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

  /** Phase 8C-CT-3a B6: order non-ring carbon chain atoms so ordinals can be assigned. */
  function _orderChainAtoms(chainAtomSet, adjacency) {
    const endpoints = [];
    for (const id of chainAtomSet) {
      const chainNeighbours = (adjacency.get(id) || []).filter(n => chainAtomSet.has(n.vertex.id));
      if (chainNeighbours.length <= 1) endpoints.push(id);
    }
    if (endpoints.length === 0) return Array.from(chainAtomSet);
    const start = Math.min(...endpoints);
    const order = [start];
    let prev = null;
    let current = start;
    while (true) {
      const next = (adjacency.get(current) || []).find(
        n => chainAtomSet.has(n.vertex.id) && n.vertex.id !== prev && !order.includes(n.vertex.id),
      );
      if (!next) break;
      prev = current;
      current = next.vertex.id;
      order.push(current);
    }
    return order;
  }

  /** Phase 8C-CT-3a B5: count stereocenters from SMILES. Each "[C@H]" or "[C@@H]" contributes one. */
  function _countStereocenters(smiles) {
    if (!smiles || typeof smiles !== "string") return 0;
    const matches = smiles.match(/@+/g);
    return matches ? matches.length : 0;
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
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData, _adjacency } = analysis;
    const groups = functionalGroups || [];
    const opener = _buildOpener(pubchemData);
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
      const branchEntries = _walkAndDescribeBranches(sortedBranchPoints, groups, _graphData, _adjacency, allRingMembers, true, namedSystem, rings);
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
      const branchEntries = _walkAndDescribeBranches(sortedSubstituentBranches, groups, _graphData, _adjacency, allRingMembers, true, null, rings);
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

    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      const ring = rings[0];
      const ringDesc = _describeRingTopology(ring);
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
        const branchEntries = _walkAndDescribeBranches(sorted, groups, _graphData, _adjacency, ringMembers, false, namedSystemSingle, [ring]);
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
        intro.push("The carbon is a urea linkage (H₂N–CO–NH₂).");
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
          const groupLabels = helpers.collapseGroupList
            ? helpers.collapseGroupList(groups)
            : groups.map(g => helpers.groupDisplayName(g));
          intro.push("A single carbon bearing " + helpers.formatList(groupLabels) + ".");
        }
        return { singleParagraph: intro };
      }

      // Phase 8C-CT-3a B6: describe chain atoms with ordinals so terminal-group
      // branches attach cleanly instead of introducing a phantom extra carbon.
      const chainAtomSet = new Set();
      for (const v of _graphData.graph.vertices) {
        if (_elem(v) === "C" && !(v.value?.rings?.length > 0)) chainAtomSet.add(v.id);
      }
      const chainOrder = _orderChainAtoms(chainAtomSet, _adjacency);
      const chainWord = helpers.numberWord(chain.length);
      intro.push("The structure is a " + chainWord + "-carbon chain.");
      if (chain.length >= 2 && chainOrder.length >= 2) {
        intro.push("The first carbon is bonded to the second carbon by a single bond.");
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
  //   _aOrAn, _numberWord, _isAlkylShortName, _alkylArticle,
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
      alkene: "a carbon-carbon double bond",
      alkyne: "a carbon-carbon triple bond",
      sulphonamide: "a sulphonamide group",
      "sulphonic acid": "a sulphonic acid group",
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
      baseName = "a " + group.shortName + " group";
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
      alkene: "a double bond",
      alkyne: "a triple bond",
      sulphonamide: "a sulphonamide",
      "sulphonic acid": "a sulphonic acid",
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
    return "a " + group.shortName;
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
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData, _adjacency } = analysis;
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
      opener = name.charAt(0).toUpperCase() + name.slice(1);
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
      parts.push("A methyl group bonded to " + _groupDisplayName(groups[0]) + ".");
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
      const ringPhrase = namedRingPattern
        ? ring.type + " ring (" + namedRingPattern + ")"
        : ring.type + " ring";

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
        parts.push(_aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. A " + ringPhrase + ".");
      } else if (ringSubstituents.length === 1) {
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ringPhrase +
          ". One substituent: " + _groupDisplayName(ringSubstituents[0]) + "."
        );
      } else if (ringSubstituents.length === 2 && ring.size === 6) {
        // Use substitution pattern for 2 substituents on a 6-membered ring
        const pattern = _detectSubstitutionPattern(ring, ringSubstituents, _graphData);
        const posPhrase = pattern ? " " + pattern : "";
        // Phase 10-6 (N6): collapse duplicates (e.g. disubstituted benzene
        // with two hydroxyls → "two hydroxyl groups (–OH)"); two-unique
        // cases fall through to the same display strings as before.
        const groupNames = _collapseGroupList(ringSubstituents);
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ringPhrase +
          ". Two substituents" + posPhrase +
          ": " + _formatList(groupNames) + "."
        );
      } else {
        // Phase 10-6 (N6): collapse duplicates so barbituric acid's three
        // ring-internal carbonyls read "two lactams (cyclic amide), and a
        // urea linkage." instead of "a lactam, a lactam, and a urea linkage."
        const groupNames = _collapseGroupList(ringSubstituents);
        const countWord = _numberWord(ringSubstituents.length);
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ringPhrase +
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
      const { alkylGroups, otherGroups } = _partitionAlkylGroups(sortedGroups);
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
          if (isUreaMolecule) {
            parts.push("A single carbon bearing a urea linkage (H₂N–CO–NH₂).");
          } else if (groups.length === 0) {
            parts.push("A single carbon atom.");
          } else {
            parts.push("A single carbon bearing " + _formatList(_collapseGroupList(groups)) + ".");
          }
        } else if (chain.branched) {
          parts.push(
            _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom, branched carbon chain with " + _numberWord(chain.length) +
            " carbons in the longest path"
          );
        } else {
          parts.push(_aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom, " + _numberWord(chain.length) + "-carbon chain");
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
            const displayItems = _collapseGroupList(groups);
            parts[parts.length - 1] += " with " + _formatList(displayItems) + ".";
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
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData, _adjacency } = analysis;
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
      opener = name.charAt(0).toUpperCase() + name.slice(1);
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

      let scaffold;
      if (!name && heavyAtomCount > 0) {
        // No name — include atom count for context; capitalise if sentence start
        scaffold = _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom " + ring.type + " ring";
      } else {
        scaffold = (ring.type === "benzene" ? "A benzene" : "A " + ring.type) + " ring";
      }
      if (pyrimidinePatternShort) scaffold += " (" + pyrimidinePatternShort + ")";

      if (ringSubstituents.length === 0) {
        parts.push(scaffold + ".");
      } else if (ringSubstituents.length <= 3) {
        // Phase 11-1c (N-post10-7): collapse duplicate short-form names via
        // the short-tier sibling of _collapseGroupList so barbituric acid's
        // two lactams surface as "two lactams" rather than "a lactam, and
        // a lactam" — matching STD's already-collapsed behaviour.
        const groupNames = _collapseGroupListShort(ringSubstituents);
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
      const { alkylGroups, otherGroups } = _partitionAlkylGroups(groups);
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
          const groupNames = _collapseGroupListShort(groups);
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
          parts.push(scaffold + " with " + _shortGroupName(groups[0]) + ".");
        } else if (groups.length <= 3) {
          // Phase 11-1c (N-post10-7): collapse duplicate short-form names so
          // guanidine's three amines surface as "three amines" rather than
          // "an amine, an amine, and an amine" — matching STD's already-
          // collapsed behaviour.
          const groupNames = _collapseGroupListShort(groups);
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
