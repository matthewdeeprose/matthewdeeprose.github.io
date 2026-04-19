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
  const _graphCache = internals.graphCache;
  const FEATURE_FLAGS = internals.featureFlags;
  const _formatFormulaUnicode = internals.formatFormulaUnicode;

  // =========================================================================
  // Constants
  // =========================================================================

  // Phase 8C: Unicode subscript digits for formula display
  const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

  // Phase 8C-2: Element symbol → British English name mapping
  const ELEMENT_NAMES = {
    C: "carbon", H: "hydrogen", O: "oxygen", N: "nitrogen",
    S: "sulphur", P: "phosphorus", F: "fluorine", Cl: "chlorine",
    Br: "bromine", I: "iodine", B: "boron", Si: "silicon",
    Se: "selenium", Fe: "iron", Cu: "copper", Zn: "zinc",
  };

  // =========================================================================
  // Section A: Graph Analysis (graph → structured data)
  // =========================================================================
  // _buildAdjacencyMap, _classifyRing, _detectFunctionalGroupsFromGraph,
  // _detectSubstitutionPattern, _analyseChainFromGraph, _classifyScaffold
  //
  // Future growth: new motif/group detectors go here.
  // When this section exceeds ~300 lines, extract to
  // mathpix-chemistry-analysis.js (same augmentation IIFE pattern).

  /**
   * Build an adjacency map from graph edges for efficient neighbour lookups.
   * Returns Map<vertexId, Array<{ vertex, edge }>>.
   *
   * @param {Object} graph - Graph object from the preprocessor
   * @returns {Map<number, Array<{ vertex: Object, edge: Object }>>}
   * @private
   */
  function _buildAdjacencyMap(graph) {
    const adj = new Map();
    for (const v of graph.vertices) {
      adj.set(v.id, []);
    }
    for (const edge of graph.edges) {
      const sourceVertex = graph.vertices.find(v => v.id === edge.sourceId);
      const targetVertex = graph.vertices.find(v => v.id === edge.targetId);
      if (sourceVertex && targetVertex) {
        adj.get(edge.sourceId).push({ vertex: targetVertex, edge });
        adj.get(edge.targetId).push({ vertex: sourceVertex, edge });
      }
    }
    return adj;
  }

  /**
   * Classify a ring by examining its member atoms and edge aromaticity.
   *
   * @param {Object} ring - Ring object from preprocessor.rings
   * @param {Object} graphData - { graph, rings } from _extractGraphFromDrawer
   * @returns {Object} { size, type, aromatic, heteroatoms, isFused, isBridged, isSpiro, memberVertexIds }
   * @private
   */
  function _classifyRing(ring, graphData) {
    const memberIds = ring.members || [];
    const size = memberIds.length;

    // Find heteroatoms among ring members
    const heteroatoms = [];
    for (const vId of memberIds) {
      const vertex = graphData.graph.vertices.find(v => v.id === vId);
      if (vertex) {
        const element = vertex.value?.element;
        if (element && element !== "C") {
          heteroatoms.push(element);
        }
      }
    }

    // Check aromaticity: find edges whose source and target are both ring
    // members, then verify all such edges have isPartOfAromaticRing === true.
    // (ring.edges is often empty in SmilesDrawer v2.1.7, so we look up directly.)
    const memberSet = new Set(memberIds);
    const ringEdges = graphData.graph.edges.filter(
      e => memberSet.has(e.sourceId) && memberSet.has(e.targetId),
    );
    let aromatic = false;
    if (ringEdges.length > 0) {
      aromatic = ringEdges.every(e => e.isPartOfAromaticRing === true);
    }

    // Classify ring type
    let type;
    if (size === 6 && aromatic && heteroatoms.length === 0) {
      type = "benzene";
    } else if (size === 6 && aromatic && heteroatoms.length === 1 && heteroatoms[0] === "N") {
      type = "pyridine";
    } else if (size === 6 && aromatic && heteroatoms.length === 2 && heteroatoms.every(h => h === "N")) {
      type = "pyrimidine";
    } else if (size === 5 && aromatic && heteroatoms.length === 1 && heteroatoms[0] === "N") {
      type = "pyrrole";
    } else if (size === 5 && aromatic && heteroatoms.length === 1 && heteroatoms[0] === "O") {
      type = "furan";
    } else if (size === 5 && aromatic && heteroatoms.length === 1 && heteroatoms[0] === "S") {
      type = "thiophene";
    } else if (size === 5 && aromatic && heteroatoms.length === 2 && heteroatoms.every(h => h === "N")) {
      type = "imidazole";
    } else if (size === 6 && !aromatic && heteroatoms.length === 0) {
      type = "cyclohexane";
    } else {
      const sizeWords = {
        3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight",
      };
      type = (sizeWords[size] || String(size)) + "-membered";
    }

    return {
      size,
      type,
      aromatic,
      heteroatoms,
      isFused: !!ring.isFused,
      isBridged: !!ring.isBridged,
      isSpiro: !!ring.isSpiro,
      memberVertexIds: memberIds,
    };
  }

  /**
   * Detect functional groups from the molecular graph.
   * Ten ordered detection passes — specific groups before general to prevent
   * double-counting via a claimed atoms Set.
   *
   * @param {Object} graphData - { graph, rings } from _extractGraphFromDrawer
   * @param {Map} adjacency - Adjacency map from _buildAdjacencyMap()
   * @returns {Object[]} Array of { name, shortName, atoms, attachmentVertexId }
   * @private
   */
  function _detectFunctionalGroupsFromGraph(graphData, adjacency) {
    const groups = [];
    const claimed = new Set();
    const vertices = graphData.graph.vertices;

    /** Check if a vertex is in any ring */
    function inRing(v) {
      return v.value?.rings?.length > 0;
    }

    /** Get element symbol for a vertex */
    function elem(v) {
      return v.value?.element || "";
    }

    /** Find the ring member vertex this group is bonded to (if any) */
    function findRingAttachment(atomIds) {
      for (const id of atomIds) {
        const neighbours = adjacency.get(id) || [];
        for (const n of neighbours) {
          if (inRing(n.vertex) && !atomIds.includes(n.vertex.id)) {
            return n.vertex.id;
          }
        }
      }
      return null;
    }

    // 1. Carboxylic acids — C with =O and -O(H) terminal
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const neighbours = adjacency.get(v.id) || [];
      let doubleO = null;
      let singleO = null;
      for (const n of neighbours) {
        if (elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id)) {
          doubleO = n.vertex;
        }
        if (elem(n.vertex) === "O" && n.edge.bondType === "-" && !claimed.has(n.vertex.id)) {
          // Terminal oxygen: only 1 heavy-atom neighbour
          const oNeighbours = (adjacency.get(n.vertex.id) || []);
          if (oNeighbours.length === 1) {
            singleO = n.vertex;
          }
        }
      }
      if (doubleO && singleO) {
        const atoms = [v.id, doubleO.id, singleO.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "carboxylic acid",
          shortName: "acid",
          shorthand: "–COOH",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 2. Esters — O bridging two C, one of which has =O
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "O" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length !== 2) continue;
      const carbonNeighbours = neighbours.filter(n => elem(n.vertex) === "C" && n.edge.bondType === "-");
      if (carbonNeighbours.length !== 2) continue;
      // One of the carbons must have a =O
      for (const cn of carbonNeighbours) {
        const cNeighbours = adjacency.get(cn.vertex.id) || [];
        const hasDoubleO = cNeighbours.some(
          n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
        );
        if (hasDoubleO) {
          const doubleOVertex = cNeighbours.find(
            n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
          );
          const atoms = [v.id, cn.vertex.id, doubleOVertex.vertex.id];
          atoms.forEach(a => claimed.add(a));
          // Identify the R-group on the carbonyl carbon for specific shorthand
          let esterShorthand = "–OCOR";
          const rNeighbours = (adjacency.get(cn.vertex.id) || []).filter(
            n => n.vertex.id !== v.id && n.vertex.id !== doubleOVertex.vertex.id
          );
          if (rNeighbours.length === 1 && elem(rNeighbours[0].vertex) === "C") {
            const rCarbonNeighbours = (adjacency.get(rNeighbours[0].vertex.id) || []).filter(
              n => elem(n.vertex) === "C" && n.vertex.id !== cn.vertex.id
            );
            if (rCarbonNeighbours.length === 0) {
              esterShorthand = "–OCOCH₃";
            }
          }
          groups.push({
            name: "ester",
            shortName: "ester",
            shorthand: esterShorthand,
            atoms,
            attachmentVertexId: findRingAttachment(atoms),
          });
          break;
        }
      }
    }

    // 3. Amides — C with =O and -N
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const neighbours = adjacency.get(v.id) || [];
      let doubleO = null;
      let singleN = null;
      for (const n of neighbours) {
        if (elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id)) {
          doubleO = n.vertex;
        }
        if (elem(n.vertex) === "N" && n.edge.bondType === "-" && !claimed.has(n.vertex.id)) {
          singleN = n.vertex;
        }
      }
      if (doubleO && singleN) {
        const atoms = [v.id, doubleO.id, singleN.id];
        atoms.forEach(a => claimed.add(a));
        // Classify amide as primary, secondary, or tertiary based on nitrogen's other neighbours
        const nNeighbours = (adjacency.get(singleN.id) || []).filter(
          n => n.vertex.id !== v.id
        );
        const nCarbonNeighbours = nNeighbours.filter(n => elem(n.vertex) === "C");
        let amideName, amideShorthand;
        if (nCarbonNeighbours.length === 0) {
          amideName = "amide";
          amideShorthand = "–CONH₂";
        } else if (nCarbonNeighbours.length === 1) {
          amideName = "secondary amide";
          amideShorthand = "–CONHR";
        } else {
          amideName = "tertiary amide";
          amideShorthand = "–CONR₂";
        }
        groups.push({
          name: amideName,
          shortName: amideName,
          shorthand: amideShorthand,
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 4. Sulphonic acids/sulphonamides — S with two =O and -O or -N
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "S") continue;
      const neighbours = adjacency.get(v.id) || [];
      const doubleOs = neighbours.filter(
        n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
      );
      if (doubleOs.length < 2) continue;
      const singleOorN = neighbours.find(
        n => (elem(n.vertex) === "O" || elem(n.vertex) === "N") && n.edge.bondType === "-" && !claimed.has(n.vertex.id),
      );
      if (singleOorN) {
        const atoms = [v.id, ...doubleOs.map(d => d.vertex.id), singleOorN.vertex.id];
        atoms.forEach(a => claimed.add(a));
        const isSulphonamide = elem(singleOorN.vertex) === "N";
        groups.push({
          name: isSulphonamide ? "sulphonamide" : "sulphonic acid",
          shortName: isSulphonamide ? "sulphonamide" : "sulphonic acid",
          shorthand: isSulphonamide ? "–SO₂NH₂" : "–SO₃H",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 5. Ketones — remaining C with =O, having 2+ carbon neighbours
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const neighbours = adjacency.get(v.id) || [];
      const doubleO = neighbours.find(
        n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
      );
      if (!doubleO) continue;
      const carbonNeighbours = neighbours.filter(n => elem(n.vertex) === "C");
      if (carbonNeighbours.length >= 2) {
        const atoms = [v.id, doubleO.vertex.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "ketone",
          shortName: "ketone",
          shorthand: "C=O",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 6. Aldehydes — remaining C with =O, having <=1 carbon neighbour
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const neighbours = adjacency.get(v.id) || [];
      const doubleO = neighbours.find(
        n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
      );
      if (!doubleO) continue;
      const carbonNeighbours = neighbours.filter(n => elem(n.vertex) === "C");
      if (carbonNeighbours.length <= 1) {
        const atoms = [v.id, doubleO.vertex.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "aldehyde",
          shortName: "aldehyde",
          shorthand: "–CHO",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 7. Hydroxyls — remaining terminal O with single bond, not in ring
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "O" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length === 1 && neighbours[0].edge.bondType === "-") {
        const atoms = [v.id];
        claimed.add(v.id);
        groups.push({
          name: "hydroxyl",
          shortName: "hydroxyl",
          shorthand: "–OH",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 8. Amines — N not claimed by amide, not in a ring
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "N" || inRing(v)) continue;
      const atoms = [v.id];
      claimed.add(v.id);
      groups.push({
        name: "amine",
        shortName: "amine",
        shorthand: "–NH₂",
        atoms,
        attachmentVertexId: findRingAttachment(atoms),
      });
    }

    // 9. Nitriles — C with triple bond to N
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const neighbours = adjacency.get(v.id) || [];
      const tripleN = neighbours.find(
        n => elem(n.vertex) === "N" && n.edge.bondType === "#" && !claimed.has(n.vertex.id),
      );
      if (tripleN) {
        const atoms = [v.id, tripleN.vertex.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "nitrile",
          shortName: "nitrile",
          shorthand: "–CN",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    // 10. Halogens — terminal F, Cl, Br, I atoms
    for (const v of vertices) {
      if (claimed.has(v.id)) continue;
      const el = elem(v);
      if (["F", "Cl", "Br", "I"].includes(el)) {
        const neighbours = adjacency.get(v.id) || [];
        if (neighbours.length === 1) {
          const atoms = [v.id];
          claimed.add(v.id);
          groups.push({
            name: "halogen (" + el + ")",
            shortName: "halogen",
            shorthand: "–" + el,
            atoms,
            attachmentVertexId: findRingAttachment(atoms),
          });
        }
      }
    }

    // 11. Alkenes/alkynes — C=C or C≡C not in aromatic ring
    for (const edge of graphData.graph.edges) {
      if (edge.isPartOfAromaticRing) continue;
      const source = vertices.find(v => v.id === edge.sourceId);
      const target = vertices.find(v => v.id === edge.targetId);
      if (!source || !target) continue;
      if (elem(source) !== "C" || elem(target) !== "C") continue;
      if (claimed.has(source.id) && claimed.has(target.id)) continue;
      if (edge.bondType === "=") {
        const atoms = [source.id, target.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "alkene",
          shortName: "alkene",
          shorthand: "C=C",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      } else if (edge.bondType === "#") {
        const atoms = [source.id, target.id];
        atoms.forEach(a => claimed.add(a));
        groups.push({
          name: "alkyne",
          shortName: "alkyne",
          shorthand: "C≡C",
          atoms,
          attachmentVertexId: findRingAttachment(atoms),
        });
      }
    }

    return groups;
  }

  /**
   * Detect substitution pattern for a disubstituted 6-membered ring.
   *
   * @param {Object} classifiedRing - Ring from _classifyRing()
   * @param {Object[]} substituents - Functional groups with attachmentVertexId on this ring
   * @param {Object} graphData - Graph data
   * @returns {string|null} "at adjacent (ortho) positions", "at meta positions",
   *   "at opposite (para) positions", or null
   * @private
   */
  function _detectSubstitutionPattern(classifiedRing, substituents, graphData) {
    if (classifiedRing.size !== 6 || substituents.length !== 2) return null;

    const members = classifiedRing.memberVertexIds;
    const points = substituents.map(s => s.attachmentVertexId);
    if (points.some(p => p == null)) return null;

    const idx0 = members.indexOf(points[0]);
    const idx1 = members.indexOf(points[1]);
    if (idx0 === -1 || idx1 === -1) return null;

    const dist = Math.min(
      Math.abs(idx1 - idx0),
      members.length - Math.abs(idx1 - idx0),
    );

    if (dist === 1) return "at adjacent (ortho) positions";
    if (dist === 2) return "at meta positions";
    if (dist === 3) return "at opposite (para) positions";
    return null;
  }

  /**
   * Analyse the carbon chain for molecules without rings.
   * Finds the longest continuous carbon path.
   *
   * @param {Object} graphData - Graph data
   * @param {Map} adjacency - Adjacency map from _buildAdjacencyMap()
   * @returns {Object|null} { length, branched } or null
   * @private
   */
  function _analyseChainFromGraph(graphData, adjacency) {
    // Collect non-ring carbon vertices
    const carbonIds = [];
    for (const v of graphData.graph.vertices) {
      if ((v.value?.element || "") === "C" && !(v.value?.rings?.length > 0)) {
        carbonIds.push(v.id);
      }
    }
    if (carbonIds.length === 0) return null;

    const carbonSet = new Set(carbonIds);

    // DFS from each carbon to find longest path
    let longestPath = 0;
    let branched = false;

    for (const startId of carbonIds) {
      const visited = new Set();
      function dfs(currentId) {
        visited.add(currentId);
        let maxDepth = 0;
        const neighbours = adjacency.get(currentId) || [];
        const carbonNeighbours = neighbours.filter(
          n => carbonSet.has(n.vertex.id) && !visited.has(n.vertex.id),
        );
        for (const n of carbonNeighbours) {
          const depth = dfs(n.vertex.id);
          maxDepth = Math.max(maxDepth, depth);
        }
        visited.delete(currentId);
        return 1 + maxDepth;
      }
      const pathLen = dfs(startId);
      longestPath = Math.max(longestPath, pathLen);
    }

    // Check branching: any carbon with more than 2 carbon neighbours
    for (const cId of carbonIds) {
      const neighbours = adjacency.get(cId) || [];
      const carbonNeighbourCount = neighbours.filter(n => carbonSet.has(n.vertex.id)).length;
      if (carbonNeighbourCount > 2) {
        branched = true;
        break;
      }
    }

    return {
      length: longestPath,
      branched,
    };
  }

  /**
   * Classify the overall molecular scaffold from ring analysis.
   *
   * @param {Object[]} rings - Array from _classifyRing()
   * @returns {string} "aromatic-ring", "ring", "fused-rings", or "chain"
   * @private
   */
  function _classifyScaffold(rings) {
    if (rings.length === 0) return "chain";
    if (rings.some(r => r.isFused)) return "fused-rings";
    if (rings.some(r => r.aromatic)) return "aromatic-ring";
    return "ring";
  }

  // =========================================================================
  // Section B: Description Assembly (structured data → text)
  // =========================================================================
  // _numberWord, _groupDisplayName, _formatList, _toAriaText,
  // _assembleDescription
  //
  // Future growth: short/comprehensive tiers add branches inside
  // _assembleDescription or new _assembleShortDescription /
  // _assembleComprehensiveDescription functions here.

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
    } else {
      baseName = names[group.shortName] || "a " + group.shortName + " group";
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
      ketone: "a ketone",
      aldehyde: "an aldehyde",
      hydroxyl: "a hydroxyl group",
      amine: "an amine",
      nitrile: "a nitrile",
      alkene: "a double bond",
      alkyne: "a triple bond",
      sulphonamide: "a sulphonamide",
      "sulphonic acid": "a sulphonic acid",
    };
    if (group.shortName === "halogen") {
      return "a " + group.name;
    }
    return names[group.shortName] || "a " + group.shortName;
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
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData } = analysis;
    const groups = functionalGroups || [];

    // Short tier — delegate to dedicated assembler
    if (detail === "short") {
      return _assembleShortDescription(analysis, pubchemData);
    }
    const parts = [];

    // --- 1. Compound name with formula/weight opener (Phase 8C-1) ---
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    const name = commonName || iupacName || null;

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

    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      // Single ring
      const ring = rings[0];
      const ringName = ring.type.charAt(0).toUpperCase() + ring.type.slice(1);

      // Determine ring substituents
      const ringSubstituents = groups.filter(
        g => g.attachmentVertexId != null && ring.memberVertexIds.includes(g.attachmentVertexId)
      );

      if (ringSubstituents.length === 0) {
        parts.push(_aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule. A " + ring.type + " ring.");
      } else if (ringSubstituents.length === 1) {
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ring.type +
          " ring. One substituent: " + _groupDisplayName(ringSubstituents[0]) + "."
        );
      } else if (ringSubstituents.length === 2 && ring.size === 6) {
        // Use substitution pattern for 2 substituents on a 6-membered ring
        const pattern = _detectSubstitutionPattern(ring, ringSubstituents, _graphData);
        const posPhrase = pattern ? " " + pattern : "";
        const groupNames = ringSubstituents.map(g => _groupDisplayName(g));
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ring.type +
          " ring. Two substituents" + posPhrase +
          ": " + _formatList(groupNames) + "."
        );
      } else {
        const groupNames = ringSubstituents.map(g => _groupDisplayName(g));
        const countWord = _numberWord(ringSubstituents.length);
        parts.push(
          _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom molecule built on a " + ring.type +
          " ring. " + countWord.charAt(0).toUpperCase() + countWord.slice(1) +
          " substituents: " + _formatList(groupNames) + "."
        );
      }
    } else if (scaffoldType === "fused-rings") {
      // Fused ring system — describe each ring by size
      const ringDescs = rings.map(r => "a " + _numberWord(r.size) + "-membered ring");
      parts.push(
        _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom fused ring system with " + _formatList(ringDescs) + "."
      );
      // Functional groups on fused ring systems
      if (groups.length > 0) {
        const countByShort = {};
        for (const g of groups) {
          countByShort[g.shortName] = (countByShort[g.shortName] || 0) + 1;
        }
        const displayItems = [];
        const seen = new Set();
        for (const g of groups) {
          if (countByShort[g.shortName] > 1 && !seen.has(g.shortName)) {
            seen.add(g.shortName);
            const base = _groupDisplayName(g).replace(/^an? /, "");
            const plural = base.includes(" (") ? base.replace(" (", "s (") : base + "s";
            displayItems.push(_numberWord(countByShort[g.shortName]) + " " + plural);
          } else if (countByShort[g.shortName] === 1) {
            displayItems.push(_groupDisplayName(g));
          }
        }
        if (displayItems.length > 0) {
          parts.push("Functional groups: " + _formatList(displayItems) + ".");
        }
      }
    } else {
      // Chain scaffold
      if (chain) {
        if (chain.branched) {
          parts.push(
            _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom, branched carbon chain with " + _numberWord(chain.length) +
            " carbons in the longest path"
          );
        } else {
          parts.push(_aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom, " + _numberWord(chain.length) + "-carbon chain");
        }

        // --- 4. Chain decorations ---
        if (groups.length > 0) {
          // Collapse multiple identical groups (e.g. multiple hydroxyls)
          const countByShort = {};
          for (const g of groups) {
            countByShort[g.shortName] = (countByShort[g.shortName] || 0) + 1;
          }

          const shortNames = Object.keys(countByShort);
          if (shortNames.length === 1 && countByShort[shortNames[0]] > 1) {
            // All groups are the same type, collapse
            const count = countByShort[shortNames[0]];
            const sampleName = _groupDisplayName(groups[0]).replace(/^an? /, "");
            const samplePlural = sampleName.includes(" (") ? sampleName.replace(" (", "s (") : sampleName + "s";
            parts[parts.length - 1] += " with " + _numberWord(count) + " " + samplePlural + ".";
          } else if (groups.length === 1) {
            parts[parts.length - 1] += " with " + _groupDisplayName(groups[0]) + ".";
          } else {
            // Build collapsed list
            const displayItems = [];
            const seen = new Set();
            for (const g of groups) {
              if (countByShort[g.shortName] > 1 && !seen.has(g.shortName)) {
                seen.add(g.shortName);
                const base = _groupDisplayName(g).replace(/^an? /, "");
                const plural = base.includes(" (") ? base.replace(" (", "s (") : base + "s";
                displayItems.push(_numberWord(countByShort[g.shortName]) + " " + plural);
              } else if (countByShort[g.shortName] === 1) {
                displayItems.push(_groupDisplayName(g));
              }
            }
            parts[parts.length - 1] += " with " + _formatList(displayItems) + ".";
          }
        } else {
          parts[parts.length - 1] += ".";
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
    const { rings, functionalGroups, chain, heavyAtomCount, scaffoldType, _graphData } = analysis;
    const groups = functionalGroups || [];
    const parts = [];

    // --- 1. Name + formula opener (no molecular weight) ---
    const commonName = pubchemData?.commonNames?.[0];
    const iupacName = pubchemData?.iupacName;
    const name = commonName || iupacName || null;
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
    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
      const ring = rings[0];
      // Filter to ring substituents
      const ringSubstituents = groups.filter(
        g => g.attachmentVertexId != null && ring.memberVertexIds.includes(g.attachmentVertexId)
      );

      let scaffold;
      if (!name && heavyAtomCount > 0) {
        // No name — include atom count for context; capitalise if sentence start
        scaffold = _aOrAn(heavyAtomCount) + " " + heavyAtomCount + "-atom " + ring.type + " ring";
      } else {
        scaffold = (ring.type === "benzene" ? "A benzene" : "A " + ring.type) + " ring";
      }

      if (ringSubstituents.length === 0) {
        parts.push(scaffold + ".");
      } else if (ringSubstituents.length <= 3) {
        // List groups by short display name (no shorthand)
        const groupNames = ringSubstituents.map(g => _shortGroupName(g));
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
      // Build ring descriptions without _formatList to avoid Oxford comma for 2 items
      const ringDescs = rings.map(r => "a " + _numberWord(r.size) + "-membered ring");
      let ringList;
      if (ringDescs.length === 2) {
        ringList = ringDescs[0] + " and " + ringDescs[1];
      } else {
        ringList = _formatList(ringDescs);
      }
      const scaffold = "A fused ring system of " + ringList;
      parts.push(scaffold + ".");
    } else if (chain) {
      let scaffold = "A " + _numberWord(chain.length) + "-carbon chain";
      if (groups.length === 0) {
        parts.push(scaffold + ".");
      } else if (groups.length === 1) {
        parts.push(scaffold + " with " + _shortGroupName(groups[0]) + ".");
      } else if (groups.length <= 3) {
        const groupNames = groups.map(g => _shortGroupName(g));
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

    return parts.join(" ").replace(/\.\./g, ".").trim();
  }

  // =========================================================================
  // Section C: Public API
  // =========================================================================
  // analyseStructure, generateStructuralDescription,
  // generateStructuralDescriptionForAria,
  // generateShortDescription, generateShortDescriptionForAria
  //
  // Future growth: generateComprehensiveDescription entry point here.

  /**
   * Analyse a SMILES string's molecular structure using the cached SmilesDrawer graph.
   * Synchronous — returns null if no graph is cached for this SMILES.
   * The graph is automatically cached by renderStructure() and renderStructureToBlob().
   *
   * @param {string} smiles - SMILES notation
   * @returns {Object|null} analysis result
   * @returns {Array} analysis.rings — classified rings
   * @returns {Array} analysis.functionalGroups — detected groups with shorthand
   * @returns {Object|null} analysis.chain — chain analysis (null if rings dominate)
   * @returns {number} analysis.heavyAtomCount — total non-hydrogen atoms
   * @returns {string} analysis.scaffoldType — classification string
   * @returns {Object} analysis._graphData — raw SmilesDrawer graph (internal)
   *   Comprehensive descriptions will need: .vertices (atom identities/positions),
   *   .edges (bond types/connectivity), .rings (ring membership).
   *   Do not remove or restructure these fields without updating the assembly tier.
   */
  function analyseStructure(smiles) {
    if (!smiles || typeof smiles !== "string") return null;
    if (!FEATURE_FLAGS.STRUCTURAL_DESCRIPTIONS) return null;
    const graphData = _graphCache.get(smiles);
    if (!graphData) {
      logDebug("analyseStructure: no cached graph for this SMILES", { smiles });
      return null;
    }
    const adjacency = _buildAdjacencyMap(graphData.graph);
    const rings = (graphData.rings || []).map(r => _classifyRing(r, graphData));
    const groups = _detectFunctionalGroupsFromGraph(graphData, adjacency);
    const chain = rings.length === 0 ? _analyseChainFromGraph(graphData, adjacency) : null;

    return {
      rings,
      functionalGroups: groups,
      chain,
      heavyAtomCount: graphData.graph.vertices.length,
      scaffoldType: _classifyScaffold(rings),
      _graphData: graphData, // Phase 7A-4: pass through for _assembleDescription
      _adjacency: adjacency, // Phase 8C-CT: expose for comprehensive tier branch walking
    };
  }

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

  // =========================================================================
  // Attach to parent utils object
  // =========================================================================
  utils.analyseStructure = analyseStructure;
  utils.generateStructuralDescription = generateStructuralDescription;
  utils.generateStructuralDescriptionForAria = generateStructuralDescriptionForAria;
  utils.generateShortDescription = generateShortDescription;
  utils.generateShortDescriptionForAria = generateShortDescriptionForAria;

  // Phase 8C-CT: Expose description helpers for comprehensive tier (separate file)
  internals.helpers = {
    numberWord: _numberWord,
    formatList: _formatList,
    aOrAn: _aOrAn,
    groupDisplayName: _groupDisplayName,
    toAriaText: _toAriaText,
    elementNames: ELEMENT_NAMES,
    detectSubstitutionPattern: _detectSubstitutionPattern,
  };

  logInfo("MathPixChemistryDescriptions initialised (Phase 8C-ST)");
})();
