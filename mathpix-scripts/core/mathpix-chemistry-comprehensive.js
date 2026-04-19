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

  // === Helper functions ===

  /** Get element symbol for a vertex. */
  function _elem(vertex) {
    return vertex?.value?.element || "C";
  }

  /** Get the English name for an element symbol. */
  function _elementName(symbol) {
    return helpers.elementNames[symbol] || symbol.toLowerCase();
  }

  /** Return "a" or "an" for an element name based on vowel-sound start. */
  function _aOrAnElement(elemName) {
    return /^[aeiou]/i.test(elemName) ? "an" : "a";
  }

  /**
   * Compute a plain English compass direction from one vertex to another.
   * Canvas coordinates: y increases downward, so dy is inverted.
   */
  function _relativeDirection(fromVertex, toVertex) {
    if (!fromVertex?.position || !toVertex?.position) return "";
    const dx = toVertex.position.x - fromVertex.position.x;
    const dy = toVertex.position.y - fromVertex.position.y;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5) return "to the right";
    if (angle >= 22.5 && angle < 67.5) return "to the upper right";
    if (angle >= 67.5 && angle < 112.5) return "above";
    if (angle >= 112.5 && angle < 157.5) return "to the upper left";
    if (angle >= 157.5 || angle < -157.5) return "to the left";
    if (angle >= -157.5 && angle < -112.5) return "to the lower left";
    if (angle >= -112.5 && angle < -67.5) return "below";
    if (angle >= -67.5 && angle < -22.5) return "to the lower right";
    return "";
  }

  /** Calculate implicit hydrogen count for an atom using bond-order sum. */
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

  /** Describe heteroatoms as prose, e.g. "two nitrogen atoms". */
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

  /** Describe a single ring's topology. */
  function _describeRingTopology(classifiedRing) {
    const sizeWord = SIZE_WORDS[classifiedRing.size] || String(classifiedRing.size);
    const namedAromatics = {
      benzene: "a six-membered aromatic ring (benzene)",
      pyridine: "a six-membered aromatic ring (pyridine)",
      pyrimidine: "a six-membered aromatic ring (pyrimidine)",
      pyrrole: "a five-membered aromatic ring (pyrrole)",
      furan: "a five-membered aromatic ring (furan)",
      thiophene: "a five-membered aromatic ring (thiophene)",
      imidazole: "a five-membered aromatic ring (imidazole)",
    };
    if (namedAromatics[classifiedRing.type]) return namedAromatics[classifiedRing.type];
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

  /** Describe a fused ring system (2+ rings sharing edges). */
  function _describeFusedRingSystem(rings, graphData) {
    const parts = [];
    const ringDescs = rings.map(r => "a " + (SIZE_WORDS[r.size] || String(r.size)) + "-membered ring");

    // Shared vertices between first two rings
    let sharingPhrase = "";
    if (rings.length === 2) {
      const set0 = new Set(rings[0].memberVertexIds);
      const sharedCount = rings[1].memberVertexIds.filter(id => set0.has(id)).length;
      sharingPhrase = sharedCount === 2 ? " sharing an edge" : " sharing " + helpers.numberWord(sharedCount) + " atoms";
      parts.push("The structure is built on two fused rings" + sharingPhrase + ": " + ringDescs[0] + " and " + ringDescs[1] + ".");
    } else {
      parts.push("The structure is built on " + helpers.numberWord(rings.length) + " fused rings: " + helpers.formatList(ringDescs) + ".");
    }

    // Describe each ring's atom composition
    for (const ring of rings) {
      const sizeWord = SIZE_WORDS[ring.size] || String(ring.size);
      const heteroCount = ring.heteroatoms.length;
      const carbonCount = ring.size - heteroCount;
      let ringDesc = "The " + sizeWord + "-membered ring contains ";
      if (heteroCount === 0) {
        ringDesc += helpers.numberWord(carbonCount) + " carbon atoms";
      } else {
        ringDesc += helpers.formatList([
          _describeHeteroatoms(ring.heteroatoms),
          helpers.numberWord(carbonCount) + " carbon atom" + (carbonCount !== 1 ? "s" : ""),
        ]);
      }
      parts.push(ringDesc + ".");
    }
    return parts.join(" ");
  }

  /**
   * DFS walk from a ring/chain attachment point outward through the graph.
   * Returns array of { vertexId, element, bondType, direction }.
   */
  function _walkBranch(startVertexId, parentVertexId, graphData, adjacency, visited) {
    const steps = [];
    let currentId = startVertexId;
    let prevId = parentVertexId;
    while (true) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const currentVertex = graphData.graph.vertices.find(v => v.id === currentId);
      const prevVertex = graphData.graph.vertices.find(v => v.id === prevId);
      if (!currentVertex) break;
      const neighbours = adjacency.get(currentId) || [];
      const parentN = neighbours.find(n => n.vertex.id === prevId);
      steps.push({
        vertexId: currentId,
        element: _elem(currentVertex),
        bondType: parentN ? parentN.edge.bondType : "-",
        direction: _relativeDirection(prevVertex, currentVertex),
      });
      const nextN = neighbours.filter(n => n.vertex.id !== prevId && !visited.has(n.vertex.id));
      if (nextN.length === 0) break;
      if (nextN.length === 1) { prevId = currentId; currentId = nextN[0].vertex.id; }
      else break; // Branch point — caller handles sub-branches
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
      const dirPhrase = step.direction ? ", " + step.direction : "";
      if (i === 0 && steps.length === 1) {
        let s = article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom is attached to the ring" + dirPhrase;
        const implicitH = _implicitHydrogens(step.element, step.vertexId, adjacency);
        if (implicitH > 0) {
          s += " (bonded to " + (implicitH === 1 ? "one hydrogen" : helpers.numberWord(implicitH) + " hydrogens") + ")";
        }
        sentences.push(s);
      } else if (i === 0) {
        sentences.push("From the ring" + dirPhrase + ", a " + bondName + " bond connects to " + article + " " + elemName + " atom");
      } else {
        sentences.push("From this " + _elementName(steps[i - 1].element) + ", a " + bondName + " bond connects to " + article + " " + elemName + " atom" + dirPhrase);
      }
    }
    let result = sentences.join(". ") + ".";
    if (groupName) result += " This forms " + groupName + ".";
    return result;
  }

  /** Sort substituent groups by angular position around a ring centre. */
  function _sortByPosition(substituents, graphData, ringMemberIds) {
    const ringVertices = ringMemberIds.map(id => graphData.graph.vertices.find(v => v.id === id)).filter(Boolean);
    if (ringVertices.length === 0) return substituents;
    const cx = ringVertices.reduce((s, v) => s + v.position.x, 0) / ringVertices.length;
    const cy = ringVertices.reduce((s, v) => s + v.position.y, 0) / ringVertices.length;
    return [...substituents].sort((a, b) => {
      const va = graphData.graph.vertices.find(v => v.id === a.attachmentVertexId);
      const vb = graphData.graph.vertices.find(v => v.id === b.attachmentVertexId);
      if (!va || !vb) return 0;
      return Math.atan2(va.position.y - cy, va.position.x - cx) - Math.atan2(vb.position.y - cy, vb.position.x - cx);
    });
  }

  /**
   * Describe sub-branches from a branch point (vertex with 2+ unvisited neighbours).
   * Returns prose like: "From this carbon, a double bond connects to an oxygen atom,
   * and a single bond connects to an oxygen atom (bonded to one hydrogen)."
   */
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
      const dirPhrase = step.direction ? " " + step.direction : "";
      let desc = "a " + bondName + " bond connects" + dirPhrase + " to " + article + " " + subElem + " atom";
      // For terminal atoms, note implicit hydrogens
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

  /** Build the opener sentence: name, formula, weight. */
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

  /** Walk and describe branches from ring attachment points. */
  function _walkAndDescribeBranches(groups, graphData, adjacency, ringMembers, asFused) {
    const parts = [];
    const ringGroups = groups.filter(g => g.attachmentVertexId != null && ringMembers.has(g.attachmentVertexId));
    if (ringGroups.length === 0) return parts;

    for (let i = 0; i < ringGroups.length; i++) {
      const group = ringGroups[i];
      const attachId = group.attachmentVertexId;
      const neighbours = adjacency.get(attachId) || [];
      const outward = neighbours.filter(n => !ringMembers.has(n.vertex.id));
      if (outward.length === 0) continue;

      const visited = new Set(ringMembers);
      const branchSentences = [];
      for (const out of outward) {
        const steps = _walkBranch(out.vertex.id, attachId, graphData, adjacency, visited);
        if (steps.length === 0) continue;
        let desc = _describeBranch(steps, null, adjacency);
        // Walk sub-branches from the last step if it was a branch point
        const lastStep = steps[steps.length - 1];
        const subDesc = _describeSubBranches(lastStep.vertexId, lastStep.element, graphData, adjacency, visited);
        if (subDesc) desc = desc.replace(/\.\s*$/, ". " + subDesc);
        branchSentences.push(desc);
      }
      if (branchSentences.length === 0) continue;

      const groupDisplayName = helpers.groupDisplayName(group);
      if (asFused) {
        const attachVertex = graphData.graph.vertices.find(v => v.id === attachId);
        const elemName = _elementName(_elem(attachVertex));
        const joined = branchSentences.join(" ");
        parts.push("From a " + elemName + " atom in the ring, " +
          joined.charAt(0).toLowerCase() + joined.slice(1) +
          " This forms " + groupDisplayName + ".");
      } else {
        parts.push("Branch " + (i + 1) + ": " + branchSentences.join(" ") + " This forms " + groupDisplayName + ".");
      }
    }
    return parts;
  }

  /**
   * Assemble a comprehensive structural description from analysis data.
   * Narrates the molecular diagram's topology — scaffold, then branches.
   */
  function _assembleComprehensiveDescription(analysis, pubchemData) {
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData, _adjacency } = analysis;
    const groups = functionalGroups || [];
    const parts = [];

    const opener = _buildOpener(pubchemData);
    if (opener) parts.push(opener);

    // Complexity cutoff
    if (heavyAtomCount > 40) {
      parts.push("A complex molecule with " + heavyAtomCount + " heavy atoms. The structure is too large for a detailed diagram walkthrough.");
      return parts.join(" ").replace(/\.\./g, ".").trim();
    }

    if (scaffoldType === "fused-rings") {
      parts.push(_describeFusedRingSystem(rings, _graphData));
      const allRingMembers = new Set();
      for (const ring of rings) for (const id of ring.memberVertexIds) allRingMembers.add(id);
      const branchParts = _walkAndDescribeBranches(groups, _graphData, _adjacency, allRingMembers, true);
      parts.push(...branchParts);

    } else if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      const ring = rings[0];
      const ringDesc = _describeRingTopology(ring);
      const ringMembers = new Set(ring.memberVertexIds);

      if (ring.heteroatoms.length === 0) {
        const sw = SIZE_WORDS[ring.size] || String(ring.size);
        parts.push("The structure is centred on " + ringDesc + ", with all " + sw + " corners occupied by carbon atoms.");
      } else {
        parts.push("The structure is centred on " + ringDesc + ".");
      }

      const ringSubstituents = groups.filter(g => g.attachmentVertexId != null && ringMembers.has(g.attachmentVertexId));
      if (ringSubstituents.length > 0) {
        const sorted = _sortByPosition(ringSubstituents, _graphData, ring.memberVertexIds);
        // Header for branches
        if (sorted.length === 2 && ring.size === 6) {
          const pattern = helpers.detectSubstitutionPattern(ring, sorted, _graphData);
          parts.push(pattern ? "Two branches extend from the ring, " + pattern + ":" : "Two branches extend from the ring:");
        } else if (sorted.length === 1) {
          parts.push("One branch extends from the ring:");
        } else {
          const nw = helpers.numberWord(sorted.length);
          parts.push(nw.charAt(0).toUpperCase() + nw.slice(1) + " branches extend from the ring:");
        }
        // Walk each branch
        const branchParts = _walkAndDescribeBranches(sorted, _graphData, _adjacency, ringMembers, false);
        parts.push(...branchParts);
        // Implicit hydrogens on remaining ring positions
        const substitutedPos = new Set(sorted.map(g => g.attachmentVertexId));
        const unsubCount = ring.memberVertexIds.filter(
          id => !substitutedPos.has(id) && _elem(_graphData.graph.vertices.find(v => v.id === id)) === "C"
        ).length;
        if (unsubCount > 0) {
          const pw = unsubCount === 1 ? "position carries" : "positions each carry";
          parts.push("The remaining " + helpers.numberWord(unsubCount) + " ring " + pw + " an implicit hydrogen atom.");
        }
      } else {
        const carbonCount = ring.memberVertexIds.filter(id => _elem(_graphData.graph.vertices.find(v => v.id === id)) === "C").length;
        if (carbonCount > 0) parts.push("Each carbon carries one implicit hydrogen atom.");
      }

    } else if (chain) {
      const chainWord = helpers.numberWord(chain.length);
      parts.push("The structure is a " + chainWord + "-carbon chain. The first carbon is bonded to the second carbon by a single bond.");

      // Describe each functional group with connectivity
      for (const group of groups) {
        const groupAtoms = group.atoms || [];
        if (groupAtoms.length === 0) continue;
        const firstAtom = _graphData.graph.vertices.find(v => v.id === groupAtoms[0]);
        if (!firstAtom) continue;
        const elemName = _elementName(_elem(firstAtom));
        const article = _aOrAnElement(elemName);

        if (groupAtoms.length === 1) {
          // Single-atom group (e.g. hydroxyl, amine)
          const neighbours = _adjacency.get(firstAtom.id) || [];
          const attachedTo = neighbours.find(n => _elem(n.vertex) === "C");
          if (attachedTo) {
            const dir = _relativeDirection(attachedTo.vertex, firstAtom);
            const dirPhrase = dir ? ", " + dir : "";
            parts.push(article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom is bonded to a carbon" + dirPhrase + " (" + helpers.groupDisplayName(group) + ").");
          } else {
            parts.push(article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom forms " + helpers.groupDisplayName(group) + ".");
          }
        } else {
          // Multi-atom group — walk the group atoms
          const visited = new Set();
          const steps = _walkBranch(groupAtoms[0], -1, _graphData, _adjacency, visited);
          if (steps.length > 0) {
            let desc = _describeBranch(steps, null, _adjacency);
            const lastStep = steps[steps.length - 1];
            const subDesc = _describeSubBranches(lastStep.vertexId, lastStep.element, _graphData, _adjacency, visited);
            if (subDesc) desc = desc.replace(/\.\s*$/, ". " + subDesc);
            desc += " This forms " + helpers.groupDisplayName(group) + ".";
            parts.push(desc.replace(/to the ring/g, "to the chain"));
          } else {
            parts.push(article.charAt(0).toUpperCase() + article.slice(1) + " " + elemName + " atom forms " + helpers.groupDisplayName(group) + ".");
          }
        }
      }

      parts.push("Each carbon carries implicit hydrogen atoms.");
    }

    return parts.join(" ").replace(/\.\./g, ".").trim();
  }

  // === Public API ===

  /** Generate a comprehensive structural description of a SMILES molecule. */
  function generateComprehensiveDescription(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) return "";
    return _assembleComprehensiveDescription(analysis, pubchemData);
  }

  /** Generate a screen-reader-optimised comprehensive description. */
  function generateComprehensiveDescriptionForAria(smiles, pubchemData) {
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return "";
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) return "";
    const desc = _assembleComprehensiveDescription(analysis, pubchemData);
    if (!desc) return "";
    const formula = pubchemData?.inchi ? utils.parseInChIFormula(pubchemData.inchi) : null;
    if (formula) {
      const unicodeFormula = _formatFormulaUnicode(formula.raw);
      const srFormula = utils.formatFormulaForScreenReader(formula.raw);
      return helpers.toAriaText(desc, unicodeFormula, srFormula);
    }
    return desc;
  }

  // Wire onto utils
  utils.generateComprehensiveDescription = generateComprehensiveDescription;
  utils.generateComprehensiveDescriptionForAria = generateComprehensiveDescriptionForAria;

  logInfo("MathPixChemistryComprehensive initialised (Phase 8C-CT)");
})();
