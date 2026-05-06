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
  const helpers = internals.helpers;
  if (!helpers) {
    logError("helpers not exposed — descriptions.js must load first");
    return;
  }

  const FEATURE_FLAGS = internals.featureFlags;
  const _formatFormulaUnicode = internals.formatFormulaUnicode;

  const BOND_NAMES = { "-": "single", "=": "double", "#": "triple" };
  const SIZE_WORDS = { 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };
  const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  const ALKYL_NAMES = ["", "methyl", "ethyl", "propyl", "butyl", "pentyl", "hexyl", "heptyl", "octyl"];

  // === Helper functions ===

  function _elem(vertex) { return vertex?.value?.element || "C"; }
  function _elementName(symbol) { return helpers.elementNames[symbol] || symbol.toLowerCase(); }
  function _aOrAnElement(elemName) { return /^[aeiou]/i.test(elemName) ? "an" : "a"; }
  function _ordinal(n) { return ORDINALS[n] || String(n) + "th"; }

  function _implicitHydrogens(element, vertexId, adjacency) {
    const valences = { C: 4, N: 3, O: 2, S: 2 };
    const maxValence = valences[element];
    if (!maxValence) return 0;
    const neighbours = adjacency.get(vertexId) || [];
    let bondOrderSum = 0;
    for (const n of neighbours) {
      const bt = n.edge.bondType;
      bondOrderSum += bt === "=" ? 2 : bt === "#" ? 3 : 1;
    }
    return Math.max(0, maxValence - bondOrderSum);
  }

  // Phase 11-2c: sort locant labels (e.g. "C8", "N1", "N7") for the tail
  // prose so heteroatoms read first, mirroring the bucket-list element sort
  // ("two N–H, and one C–H₂"). N before O before C, then by locant number.
  function _locantOrder(label) {
    const elementPriority = { N: 0, O: 1, C: 2 };
    const m = /^([NCO])([0-9]+)$/.exec(label);
    if (!m) return 9999;
    return (elementPriority[m[1]] ?? 9) * 1000 + Number(m[2]);
  }

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

  /**
   * Identify common named fused ring systems (Phase 8C-CT-3a B4).
   *
   * Phase 10-4 (G3 + G4): delegates to the shared helper in
   * mathpix-chemistry-descriptions.js so the standard tier and the
   * comprehensive tier produce identical labels. The shared helper adds
   * xanthine recognition (purine + two exocyclic C=O on the six-ring) when
   * graphData and adjacency are supplied — callers that can't supply them
   * still get the baseline "naphthalene" / "indole" / "quinoline" / "purine"
   * labels.
   */
  function _identifyFusedSystemName(rings, graphData, adjacency) {
    return helpers.identifyFusedSystemName
      ? helpers.identifyFusedSystemName(rings, graphData, adjacency)
      : null;
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
    return parts.join(" ");
  }

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

  // === Assembly ===

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

  // Phase 9-4 (CT-4h): _enumerateRingBranchPoints relocated to
  // mathpix-chemistry-descriptions.js so both tiers share the same ring-branch
  // position primitive. Access via helpers.enumerateRingBranchPoints.

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

    // Phase 8C-CT-3a B1: multiple non-fused rings joined by bonds (e.g. biphenyl)
    const hasMultipleNonFusedRings = rings.length > 1 && !rings.some(r => r.isFused);

    if (scaffoldType === "fused-rings") {
      intro.push(_describeFusedRingSystem(rings, _graphData, _adjacency));
      const allRingMembers = new Set();
      for (const ring of rings) for (const id of ring.memberVertexIds) allRingMembers.add(id);
      const branchPoints = helpers.enumerateRingBranchPoints(allRingMembers, _adjacency);
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

    if (hasMultipleNonFusedRings) {
      intro.push(_describeJoinedRingSystem(rings, _graphData, _adjacency));
      const allRingMembers = new Set();
      for (const ring of rings) for (const id of ring.memberVertexIds) allRingMembers.add(id);
      const branchPoints = helpers.enumerateRingBranchPoints(allRingMembers, _adjacency);
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
      // Phase 11-2c: joined non-fused rings have no locant table key — pass
      // null so mapAtomToLocant short-circuits and the legacy bucket prose
      // is preserved.
      const tail = _buildImplicitHydrogenTail(allRingMembers, substitutedPos, _graphData, _adjacency, null, rings);
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

      const branchPoints = helpers.enumerateRingBranchPoints(ringMembers, _adjacency);
      if (branchPoints.length > 0) {
        // `[ring]` is a 1-element array, so ringIdx is 0 for every branch
        // and the sort degenerates to angle-only around the one ring's
        // centroid.
        const sorted = helpers.sortBranchPointsByRingAndAngle(branchPoints, [ring], _graphData);
        if (sorted.length === 2 && ring.size === 6) {
          const pattern = helpers.detectSubstitutionPattern(ring, sorted, _graphData);
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
        const namedSystemSingle = helpers.identifyPyrimidinePattern
          ? (helpers.identifyPyrimidinePattern(ring, _graphData, _adjacency)
             || (helpers.identifyPyridinonePattern
                  ? helpers.identifyPyridinonePattern(ring, _graphData, _adjacency)
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

  // === Public API ===

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

  utils.generateComprehensiveDescription = generateComprehensiveDescription;
  utils.generateComprehensiveDescriptionForAria = generateComprehensiveDescriptionForAria;
  utils.generateComprehensiveDescriptionHTML = generateComprehensiveDescriptionHTML;

  logInfo("MathPixChemistryComprehensive initialised (Phase 8C-CT-3e)");
})();
