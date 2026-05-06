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
  // the raw Map from this consumer file.
  const _getCachedGraph = internals.getCachedGraph;
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

  // Phase 10-3 (CT-4e-alkyl): bare-alkyl ring-substituent tables. Lengths 1–8
  // cover methyl through octyl; beyond that the detection pass short-circuits
  // so the comprehensive tier's generic "hydrocarbon chain" label still
  // applies. Shorthands mirror the "(–CH₃)" convention already used for other
  // functional groups. Prefix variants ("N-methyl", "O-methyl", "S-methyl") are
  // generated at detection time from the attachment atom's element.
  const ALKYL_NAMES = ["", "methyl", "ethyl", "propyl", "butyl", "pentyl", "hexyl", "heptyl", "octyl"];
  const ALKYL_SHORTHANDS = {
    methyl: "–CH₃",
    ethyl: "–C₂H₅",
    propyl: "–C₃H₇",
    butyl: "–C₄H₉",
    pentyl: "–C₅H₁₁",
    hexyl: "–C₆H₁₃",
    heptyl: "–C₇H₁₅",
    octyl: "–C₈H₁₇",
  };
  const ALKYL_BASE_SET = new Set(ALKYL_NAMES.slice(1));
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
   * Phase 9-3: Count implicit hydrogens on a heavy atom from bond-order sum.
   * Local copy of the comprehensive tier's helper so the classifier below is
   * self-contained in this file. Both tiers use the same valence table.
   *
   * @param {string} element - "C", "N", "O", "S", etc.
   * @param {number} vertexId
   * @param {Map} adjacency
   * @returns {number} implicit hydrogen count (>= 0)
   * @private
   */
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

  /**
   * Phase 9-3 (CT-4ac): Detect and classify a ring-internal carbonyl at a
   * candidate C vertex. A ring-internal C=O is a ring-member carbon whose
   * =O neighbour lies outside the ring.
   *
   * Classification by flanking ring neighbours (the ring atoms adjacent to v
   * within any ring v belongs to):
   *   - Two N flankers (any classification)        → "urea"
   *   - One amide-type N + one non-N ring atom     → "lactam"
   *   - Otherwise                                  → kind: null
   *     (caller falls through to the existing amide/ketone code paths)
   *
   * Phase 11-3a (N-post11-2): the urea dispatch was widened from
   * "two amide-type N flankers" to "two N flankers (any classification)".
   * Cytosine's C2 carbonyl is flanked by N1 (amide-type, [nH]) and N3
   * (aromatic n with no H bracket → currently "pyridinic"); by topology
   * N–C(=O)–N is a urea linkage regardless of which tautomer carries the
   * proton. Pre-fix the engine emitted a self-contradicting "lactam (cyclic
   * amide, N–C(=O)–N)" because the suffix used the topology-correct
   * flanking[].element triple but the shortName came from the amide-N count.
   * The dispatch is now on flanker element count, matching the existing
   * COMP-tier suffix derivation in mathpix-chemistry-comprehensive.js.
   *
   * A nitrogen is "amide-type" if it has an implicit H, or an exocyclic
   * single-bond C substituent (e.g. N-methyl). Otherwise it is "pyridinic".
   * The amide-type/pyridinic distinction is retained for the lactam dispatch
   * (which still requires an amide-type N to avoid mis-labelling pyridine-N
   * adjacent to a ring carbonyl) and for downstream consumers that need it.
   *
   * @param {Object} v - vertex (candidate ring-internal C)
   * @param {Map} adjacency
   * @returns {Object|null}
   *   null  — v is not a ring-internal C=O
   *   { kind, ringCId, oId, flanking }  — ring-internal C=O with classification
   *     kind: "urea" | "lactam" | null
   *     ringCId: vertex id of the ring carbon (v.id)
   *     oId: vertex id of the exocyclic =O
   *     flanking: [{ vertexId, element, classification }, ...] (length 2)
   *       classification: "amide-type" | "pyridinic" | "non-N"
   * @private
   */
  function _classifyRingInternalCarbonyl(v, adjacency) {
    if (!v || v.value?.element !== "C") return null;
    const ringIds = v.value?.rings || [];
    if (ringIds.length === 0) return null;
    const ringSet = new Set(ringIds);

    const neighbours = adjacency.get(v.id) || [];

    // Require a =O neighbour whose O is NOT in any of v's rings
    let oVertex = null;
    for (const n of neighbours) {
      if (n.vertex.value?.element !== "O") continue;
      if (n.edge.bondType !== "=") continue;
      const nRings = n.vertex.value?.rings || [];
      if (nRings.some(r => ringSet.has(r))) continue;
      oVertex = n.vertex;
      break;
    }
    if (!oVertex) return null;

    // Ring-bonded neighbours: those sharing at least one ring with v
    const ringNeighbours = neighbours.filter(n => {
      const nRings = n.vertex.value?.rings || [];
      return nRings.some(r => ringSet.has(r));
    });
    if (ringNeighbours.length < 2) return null;

    // Classify each flanking atom. If v has >2 ring neighbours (fused node),
    // the first two from adjacency order suffice — v is the carbonyl carbon
    // and isn't typically a fusion atom, so this is a rare edge case.
    //
    // Amide-type N signals (any one is sufficient):
    //   (a) SMILES bracket carries explicit H, e.g. [nH] → value.bracket.hcount > 0
    //   (b) N has an exocyclic single-bond C substituent, e.g. N-methyl
    //   (c) Non-aromatic ring N whose bond-order sum is below valence (bare N
    //       in a saturated ring such as barbituric acid's N-H)
    //
    // Aromatic ring bonds come through as bondType "-" regardless of Kekulé,
    // so the generic _implicitHydrogens is unreliable for aromatic N — we
    // only fall through to a bond-order tally when no ring bond is aromatic.
    const flanking = ringNeighbours.slice(0, 2).map(n => {
      const elem = n.vertex.value?.element || "";
      let classification;
      if (elem === "N") {
        const nRings = new Set(n.vertex.value?.rings || []);
        const nNeighbours = adjacency.get(n.vertex.id) || [];
        const hasBracketH = (n.vertex.value?.bracket?.hcount || 0) > 0;
        const hasExocyclicC = nNeighbours.some(nn => {
          if (nn.vertex.value?.element !== "C") return false;
          if (nn.edge.bondType !== "-") return false;
          const nnRings = nn.vertex.value?.rings || [];
          return !nnRings.some(r => nRings.has(r));
        });
        let hasNonAromaticImplicitH = false;
        const anyAromaticBond = nNeighbours.some(nn => nn.edge.isPartOfAromaticRing === true);
        if (!anyAromaticBond) {
          let bondOrderSum = 0;
          for (const nn of nNeighbours) {
            const bt = nn.edge.bondType;
            bondOrderSum += bt === "=" ? 2 : bt === "#" ? 3 : 1;
          }
          if (bondOrderSum < 3) hasNonAromaticImplicitH = true;
        }
        classification = (hasBracketH || hasExocyclicC || hasNonAromaticImplicitH)
          ? "amide-type"
          : "pyridinic";
      } else {
        classification = "non-N";
      }
      return { vertexId: n.vertex.id, element: elem, classification };
    });

    const amideNCount = flanking.filter(
      f => f.element === "N" && f.classification === "amide-type"
    ).length;
    const pyridinicNCount = flanking.filter(
      f => f.element === "N" && f.classification === "pyridinic"
    ).length;
    const nonNCount = flanking.filter(f => f.classification === "non-N").length;
    const totalNCount = amideNCount + pyridinicNCount;

    let kind = null;
    if (totalNCount === 2) {
      kind = "urea";
    } else if (amideNCount === 1 && nonNCount === 1) {
      kind = "lactam";
    }

    return { kind, ringCId: v.id, oId: oVertex.id, flanking };
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

    /**
     * Convenience lookup: find a ring atom this (typically exocyclic) group
     * is bonded to, for the group-record `attachmentVertexId` field.
     *
     * Phase 9-4 (CT-4h): this field is consumed only for downstream
     * filtering (e.g. "is this group attached to THIS ring?"). Position
     * detection (ortho / meta / para) uses `_enumerateRingBranchPoints`
     * since 9-4, so `findRingAttachment` is no longer on that hot path.
     * Do NOT reintroduce it for position detection — it returns meaningless
     * values for ring-internal groups (see G17 in
     * chemistry-description-plan-review.md).
     */
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

    // 3 (Phase 9-3 — CT-4ac). Ring-internal carbonyls — urea linkages and
    // lactams. Runs BEFORE the exocyclic amide pass so the exocyclic code
    // path (aspirin, benzaldehyde, acetone, …) stays byte-identical.
    // Only the ring carbonyl C and its exocyclic =O are claimed — the
    // flanking ring atoms remain available (a polycarbonyl ring such as
    // barbituric acid has multiple ring-internal C=O that share a flanking N).
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "C") continue;
      const result = _classifyRingInternalCarbonyl(v, adjacency);
      if (!result || !result.kind) continue;
      const atoms = [result.ringCId, result.oId];
      atoms.forEach(a => claimed.add(a));
      if (result.kind === "urea") {
        groups.push({
          name: "urea linkage",
          shortName: "urea",
          shorthand: null,
          atoms,
          attachmentVertexId: result.ringCId,
          flanking: result.flanking,
        });
      } else if (result.kind === "lactam") {
        groups.push({
          name: "lactam",
          shortName: "lactam",
          shorthand: "cyclic amide",
          atoms,
          attachmentVertexId: result.ringCId,
          flanking: result.flanking,
        });
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

    // 8. Methoxy (Phase 11-1f, N-post10-10). Ring-attached –O–CH₃ that
    // isn't already claimed by an ester (acetate methyl-O) or a hydroxyl.
    // Emitted as a named functional group so STD surfaces it in the
    // "Functional groups: …" clause alongside acid / ester / amide / OH —
    // and so single-ring STD / SHORT paths see a substituent to describe
    // (anisole pre-11-1f emitted just "A benzene ring.", no substituent).
    //
    // Runs after hydroxyl (#7) — terminal -OH has 1 neighbour, methoxy's
    // O has 2, so the two detectors are mutually exclusive regardless of
    // order. Runs before the alkyl detector (#13) so the methyl-C is
    // claimed and can't be misread as a ring-attached methyl. Ester's
    // acetate O is already claimed by detector #2 (aspirin), so the
    // methyl-O-C=O pattern is never re-captured as methoxy. Chain-rooted
    // methoxies (e.g. dimethyl ether CH3-O-CH3) are out of scope — 11-1f
    // targets ring-attached naproxen methoxy only.
    //
    // Pre-11-1f, STD dropped methoxy silently; COMP described it via a
    // consumer-level fallback at mathpix-chemistry-comprehensive.js:586,
    // retained as defence-in-depth (becomes unreachable for
    // classifier-matched branches post-11-1f, harmless if left in place).
    {
      const ringMembers = new Set();
      for (const v of vertices) if (inRing(v)) ringMembers.add(v.id);
      if (ringMembers.size > 0) {
        const branchPoints = _enumerateRingBranchPoints(ringMembers, adjacency);
        for (const bp of branchPoints) {
          if (bp.bondType !== "-") continue;
          if (claimed.has(bp.branchRootId)) continue;
          const oVertex = vertices.find(v => v.id === bp.branchRootId);
          if (!oVertex || elem(oVertex) !== "O") continue;
          const oNeighbours = adjacency.get(oVertex.id) || [];
          if (oNeighbours.length !== 2) continue;
          const methylEdge = oNeighbours.find(
            n => n.vertex.id !== bp.attachmentVertexId,
          );
          if (!methylEdge || methylEdge.edge.bondType !== "-") continue;
          const methylVertex = methylEdge.vertex;
          if (elem(methylVertex) !== "C") continue;
          if (ringMembers.has(methylVertex.id)) continue;
          if (claimed.has(methylVertex.id)) continue;
          const methylNeighbours = adjacency.get(methylVertex.id) || [];
          const onward = methylNeighbours.filter(
            n => n.vertex.id !== oVertex.id &&
                 !claimed.has(n.vertex.id) &&
                 !ringMembers.has(n.vertex.id),
          );
          if (onward.length > 0) continue;
          const atoms = [oVertex.id, methylVertex.id];
          atoms.forEach(a => claimed.add(a));
          groups.push({
            name: "methoxy group",
            shortName: "methoxy",
            shorthand: "–OCH₃",
            atoms,
            attachmentVertexId: bp.attachmentVertexId,
          });
        }
      }
    }

    // 9. Amines — N not claimed by amide, not in a ring
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

    // 10. Nitriles — C with triple bond to N
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

    // 11. Halogens — terminal F, Cl, Br, I atoms
    for (const v of vertices) {
      if (claimed.has(v.id)) continue;
      const el = elem(v);
      if (["F", "Cl", "Br", "I"].includes(el)) {
        const neighbours = adjacency.get(v.id) || [];
        if (neighbours.length === 1) {
          const atoms = [v.id];
          claimed.add(v.id);
          groups.push({
            name: "halogen",
            shortName: "halogen",
            shorthand: "–" + el,
            atoms,
            attachmentVertexId: findRingAttachment(atoms),
          });
        }
      }
    }

    // 12. Alkenes/alkynes — C=C or C≡C not in aromatic ring
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

    // 13 (Phase 10-3 — CT-4e-alkyl). Simple-alkyl ring substituents.
    // Surfaces bare alkyl branches (methyl, ethyl, …) attached to ring atoms
    // so the standard and short tiers can report substituent counts rather
    // than silently dropping them — caffeine's three N-methyls and
    // theobromine's two N-methyls never reached either tier before.
    //
    // Runs LAST so any atom already claimed by a specific functional group is
    // never misclassified as a plain alkyl. Classification gates:
    //   • branch root is NOT in `claimed` (so methyls inside an ester, amide,
    //     etc. stay with those groups)
    //   • attachment bond and every subsequent walk bond is a single bond
    //     (rules out vinyl / allyl / alkynyl)
    //   • every atom along the branch is carbon (rules out methoxy etc.)
    //   • the branch has no sub-branches (rules out isopropyl / tert-butyl)
    //   • length within ALKYL_NAMES range (methyl–octyl); longer chains stay
    //     labelled generically by the comprehensive tier's existing walk
    //
    // The attachment atom's element drives the shortName: "methyl" on a ring
    // carbon, "N-methyl" on a ring nitrogen, etc. This preserves the semantic
    // signal a chemist would want ("three N-methyls" ≠ "three C-methyls")
    // while still letting the downstream collapse logic count them together.
    const ringMembers = new Set();
    for (const v of vertices) {
      if (inRing(v)) ringMembers.add(v.id);
    }
    if (ringMembers.size > 0) {
      const branchPoints = _enumerateRingBranchPoints(ringMembers, adjacency);
      for (const bp of branchPoints) {
        if (bp.bondType !== "-") continue;
        if (claimed.has(bp.branchRootId)) continue;

        const chainAtoms = [];
        const walkSeen = new Set([bp.attachmentVertexId]);
        let prevId = bp.attachmentVertexId;
        let currentId = bp.branchRootId;
        let currentBond = bp.bondType;
        let valid = true;

        while (valid) {
          if (walkSeen.has(currentId) || ringMembers.has(currentId) || claimed.has(currentId)) {
            valid = false; break;
          }
          walkSeen.add(currentId);
          const cVertex = vertices.find(v => v.id === currentId);
          if (!cVertex || elem(cVertex) !== "C" || currentBond !== "-") {
            valid = false; break;
          }
          chainAtoms.push(currentId);
          if (chainAtoms.length >= ALKYL_NAMES.length) { valid = false; break; }

          const neighbours = adjacency.get(currentId) || [];
          const onward = neighbours.filter(
            n => n.vertex.id !== prevId && !walkSeen.has(n.vertex.id) && !ringMembers.has(n.vertex.id),
          );
          if (onward.length === 0) break; // terminal carbon — valid alkyl
          if (onward.length > 1) { valid = false; break; } // sub-branch

          prevId = currentId;
          currentId = onward[0].vertex.id;
          currentBond = onward[0].edge.bondType;
        }

        if (!valid || chainAtoms.length === 0) continue;
        const baseName = ALKYL_NAMES[chainAtoms.length];
        if (!baseName) continue;

        const attachVertex = vertices.find(v => v.id === bp.attachmentVertexId);
        const attachElement = elem(attachVertex);
        const shortName = attachElement && attachElement !== "C"
          ? attachElement + "-" + baseName
          : baseName;

        chainAtoms.forEach(a => claimed.add(a));
        groups.push({
          name: shortName + " group",
          shortName,
          shorthand: ALKYL_SHORTHANDS[baseName] || null,
          atoms: chainAtoms.slice(),
          attachmentVertexId: bp.attachmentVertexId,
        });
      }
    }

    return groups;
  }

  /**
   * Enumerate ALL ring-outward branch roots (not just those attached to
   * recognised functional groups). Each item has the shape
   * { attachmentVertexId, branchRootId, bondType } — attachmentVertexId is
   * the ring atom, branchRootId is the first outward atom.
   *
   * Phase 9-4: relocated from mathpix-chemistry-comprehensive.js so both
   * tiers derive ring-branch positions from the same primitive. Exposed via
   * internals.helpers.enumerateRingBranchPoints for the comprehensive tier.
   *
   * @param {Set<number>} ringMembers - Set of ring atom vertex IDs
   * @param {Map} adjacency - Adjacency map from _buildAdjacencyMap()
   * @returns {Array<{attachmentVertexId:number, branchRootId:number, bondType:string}>}
   * @private
   */
  function _enumerateRingBranchPoints(ringMembers, adjacency) {
    const out = [];
    const seen = new Set();
    for (const ringAtomId of ringMembers) {
      const neighbours = adjacency.get(ringAtomId) || [];
      for (const n of neighbours) {
        if (!ringMembers.has(n.vertex.id) && !seen.has(n.vertex.id)) {
          seen.add(n.vertex.id);
          out.push({
            attachmentVertexId: ringAtomId,
            branchRootId: n.vertex.id,
            bondType: n.edge.bondType,
          });
        }
      }
    }
    return out;
  }

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
   * Phase 10-4 (CT-4d-named): count exocyclic =O neighbours on ring-C atoms.
   * Used by both the fused-system xanthine detector and the single-ring
   * pyrimidine-dione detector. Only counts C=O where the O is NOT itself a
   * ring member, i.e. the carbonyl is external to the ring.
   *
   * @param {Object} ring - classified ring with memberVertexIds
   * @param {Object} graphData - { graph, rings }
   * @param {Map} adjacency - from _buildAdjacencyMap
   * @returns {number} count of ring-C atoms bearing at least one exocyclic =O
   * @private
   */
  function _countExocyclicCarbonyls(ring, graphData, adjacency) {
    if (!ring?.memberVertexIds || !graphData || !adjacency) return 0;
    const ringSet = new Set(ring.memberVertexIds);
    let count = 0;
    for (const vId of ring.memberVertexIds) {
      const vertex = graphData.graph.vertices.find(v => v.id === vId);
      if (!vertex || (vertex.value?.element || "") !== "C") continue;
      const neighbours = adjacency.get(vId) || [];
      for (const n of neighbours) {
        if ((n.vertex.value?.element || "") === "O" &&
            n.edge.bondType === "=" &&
            !ringSet.has(n.vertex.id)) {
          count += 1;
          break; // at most one C=O counted per ring carbon
        }
      }
    }
    return count;
  }

  /**
   * Phase 10-4 (CT-4d-named): identify common named fused ring systems.
   * Returns the common name (e.g. "naphthalene", "indole", "quinoline",
   * "purine", "xanthine") or null. Xanthine = purine + two exocyclic C=O on
   * the six-ring (purine-2,6-dione), so `graphData` and `adjacency` are
   * required for that refinement — without them the xanthine check is
   * skipped and a purine skeleton still returns "purine".
   *
   * Relocated from mathpix-chemistry-comprehensive.js so both the standard
   * tier (`_assembleDescription`) and the comprehensive tier can call it
   * through the same primitive — previously only the comprehensive tier
   * invoked this helper, leaving the standard tier with the generic
   * "N-atom fused ring system" opener even when the name was known (G4).
   *
   * @param {Object[]} rings - classified rings
   * @param {Object} [graphData] - enables xanthine refinement
   * @param {Map} [adjacency] - enables xanthine refinement
   * @returns {string|null}
   * @private
   */
  function _identifyFusedSystemName(rings, graphData, adjacency) {
    if (!rings || rings.length !== 2) return null;
    const sizes = rings.map(r => r.size).sort();
    const aromatic = rings.every(r => r.aromatic);
    const heteros = [...rings[0].heteroatoms, ...rings[1].heteroatoms].sort();
    if (aromatic && sizes[0] === 6 && sizes[1] === 6 && heteros.length === 0) return "naphthalene";
    if (aromatic && sizes[0] === 5 && sizes[1] === 6 && heteros.length === 1 && heteros[0] === "N") return "indole";
    if (aromatic && sizes[0] === 6 && sizes[1] === 6 && heteros.length === 1 && heteros[0] === "N") return "quinoline";
    if (aromatic && sizes[0] === 5 && sizes[1] === 6 && heteros.length === 4 && heteros.every(h => h === "N")) {
      if (graphData && adjacency) {
        const sixRing = rings.find(r => r.size === 6);
        if (sixRing && _countExocyclicCarbonyls(sixRing, graphData, adjacency) === 2) {
          return "xanthine";
        }
      }
      return "purine";
    }
    return null;
  }

  /**
   * Phase 10-4 (CT-4d-named, G8-revised): identify an aromatic-pyrimidine
   * ring bearing exocyclic carbonyls — the uracil / thymine / cytosine
   * scaffold family. Returns a named pattern label ("pyrimidine-2,4-dione"
   * or "pyrimidin-2(1H)-one") or null when the ring is plain pyrimidine.
   *
   * SmilesDrawer's `isPartOfAromaticRing` flag is already correct for these
   * skeletons (the retracted A2 analysis was wrong about aromaticity), so
   * this is strictly additive labelling — no changes to ring classification.
   *
   * Phase 11-2d (N-post10-5): the 1-carbonyl branch (cytosine) was renamed
   * from the non-IUPAC "pyrimidine-4-one" to the IUPAC-canonical
   * "pyrimidin-2(1H)-one" — carbonyl at position 2, not 4. The locant
   * module's _normaliseNamedSystem aliases the new key back to the existing
   * "pyrimidine-4-one" locant table so locant lookups continue to resolve.
   *
   * @param {Object} ring - classified ring (expects single ring from rings[0])
   * @param {Object} graphData
   * @param {Map} adjacency
   * @returns {string|null}
   * @private
   */
  function _identifyPyrimidinePattern(ring, graphData, adjacency) {
    if (!ring || !ring.aromatic || ring.size !== 6) return null;
    if (!ring.heteroatoms || ring.heteroatoms.length !== 2) return null;
    if (!ring.heteroatoms.every(h => h === "N")) return null;
    const count = _countExocyclicCarbonyls(ring, graphData, adjacency);
    if (count === 2) return "pyrimidine-2,4-dione";
    if (count === 1) return "pyrimidin-2(1H)-one";
    return null;
  }

  /**
   * Phase 11-2d (N-post10-5): identify the 2-pyridone scaffold — an aromatic
   * 6-ring with exactly 1 N and 1 exocyclic carbonyl. Pre-11-2d the carbonyl
   * was described as a separate "lactam" substituent on a plain "pyridine
   * ring", which used a third naming approach for what is structurally the
   * same family of N-containing 6-rings as cytosine (pyrimidin-2(1H)-one).
   * This sibling classifier folds the carbonyl into the ring name as
   * "pyridin-2(1H)-one", aligning the four pyrimidine-/pyridine-class
   * ring-system names on a single IUPAC-canonical convention across the
   * description tiers (audit § 3 N-post10-5).
   *
   * Mirrors _identifyPyrimidinePattern's shape exactly. The 1-N guard means
   * pyrimidines (2 N) and naked pyridines (no exocyclic C=O) both fall
   * through; the 1-carbonyl guard means hypothetical 2-pyridone-N-dione
   * variants (none in the fixture set) do not match.
   *
   * @param {Object} ring - classified ring (expects single ring from rings[0])
   * @param {Object} graphData
   * @param {Map} adjacency
   * @returns {string|null}
   * @private
   */
  function _identifyPyridinonePattern(ring, graphData, adjacency) {
    if (!ring || !ring.aromatic || ring.size !== 6) return null;
    if (!ring.heteroatoms || ring.heteroatoms.length !== 1) return null;
    if (ring.heteroatoms[0] !== "N") return null;
    const count = _countExocyclicCarbonyls(ring, graphData, adjacency);
    if (count === 1) return "pyridin-2(1H)-one";
    return null;
  }

  /**
   * Phase 12-5b-3: select a named-system label for the engine-side
   * IUPAC fallback path. Used by _assembleDescription and
   * _assembleShortDescription when PubChem returns no recognised common
   * name AND iupacName looks IUPAC-syntactic — the engine prefers its
   * own named-system label over the raw IUPAC string for screen-reader
   * readability (parenthetical-locant clusters read awkwardly).
   *
   * Try order is chemistry-specific:
   *   - Multi-ring → fused-system label (naphthalene, indole, quinoline,
   *     purine, xanthine).
   *   - Single ring → carbonyl-bearing pattern detectors first
   *     (pyrimidine-2,4-dione / pyrimidin-2(1H)-one / pyridin-2(1H)-one),
   *     then bare aromatic ring.type fallback. Specific carbonyl-bearing
   *     patterns must be tried before bare ring.type because a dione/
   *     lactam ring's ring.type is the bare aromatic name and a
   *     bare-first lookup would discard the more-specific label.
   *
   * The bare-aromatic ring lookup is delegated to
   * `utils.getNamedAromaticLabel` (Phase 12-5c-3, D3 = A). The single source
   * of truth lives in `mathpix-chemistry-utils.js`'s `NAMED_AROMATIC_RINGS`
   * map; comprehensive.js's `_describeRingTopology` reads the same map via
   * `utils.getNamedAromaticPhrase`. New entries (e.g. thiazole) land in
   * utils.js only — neither this file nor comprehensive.js needs touching.
   *
   * @param {Object[]} rings - classified rings from analyseStructure()
   * @param {Object} [graphData] - enables xanthine + carbonyl-pattern detection
   * @param {Map} [adjacency]   - enables xanthine + carbonyl-pattern detection
   * @returns {string|null}
   * @private
   */
  function _selectNamedSystemLabel(rings, graphData, adjacency) {
    if (!rings || rings.length === 0) return null;

    // Multi-ring fused systems
    if (rings.length > 1) {
      return _identifyFusedSystemName(rings, graphData, adjacency);
    }

    // Single ring: specific carbonyl-bearing patterns before bare aromatic.
    const ring = rings[0];
    const pyrimidine = _identifyPyrimidinePattern(ring, graphData, adjacency);
    if (pyrimidine) return pyrimidine;
    const pyridinone = _identifyPyridinonePattern(ring, graphData, adjacency);
    if (pyridinone) return pyridinone;

    // Phase 12-5c-3 (D3 = A): single source in mathpix-chemistry-utils.js.
    return utils.getNamedAromaticLabel(ring.type);
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

    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
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
    if (scaffoldType === "aromatic-ring" || scaffoldType === "ring") {
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
    const graphData = _getCachedGraph(smiles);
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
  // Phase 11-2a: locant helper stub. No call sites yet — 11-2b wires
  // consumers in _walkAndDescribeBranches / _buildComprehensiveSections.
  // =========================================================================
  const _locants = window.MathPixChemistryLocants || null;
  function _getLocant(ringMemberSet, atomId, namedSystem, graphData) {
    if (!_locants) return null;
    return _locants.mapAtomToLocant(ringMemberSet, atomId, namedSystem, graphData);
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
    // Phase 9-3 (CT-4ac): shared with comprehensive tier for ring-internal C=O
    classifyRingInternalCarbonyl: _classifyRingInternalCarbonyl,
    // Phase 9-4 (CT-4h): shared ring-branch position primitive
    enumerateRingBranchPoints: _enumerateRingBranchPoints,
    // Phase 10-8 (CT-4f-order): shared branch ordering primitive. Both tiers
    // sort ring-branch points by (ringIdx, angle-around-that-ring) so G21
    // (fused-ring branch ordering) and N5 (tier-order inversion) resolve
    // from a single sort key.
    sortBranchPointsByRingAndAngle: _sortBranchPointsByRingAndAngle,
    // Phase 10-4 (CT-4d-named): shared fused-system + pyrimidine-dione
    // naming so the standard tier (G4) and the comprehensive tier derive
    // the label from the same primitive. Xanthine detection needs graphData
    // and adjacency to look at exocyclic carbonyls — both callers already
    // have these in scope.
    identifyFusedSystemName: _identifyFusedSystemName,
    identifyPyrimidinePattern: _identifyPyrimidinePattern,
    // Phase 11-2d (N-post10-5): 2-pyridone classifier — sibling of the
    // pyrimidine pattern, fires on aromatic 6-rings with 1 N + 1 exocyclic
    // C=O. Returns "pyridin-2(1H)-one". Consumed by the COMP single-ring
    // path's namedSystemSingle fall-through and by auditPositionalLabels.
    identifyPyridinonePattern: _identifyPyridinonePattern,
    countExocyclicCarbonyls: _countExocyclicCarbonyls,
    // Phase 10-6 (CT-4g-collapse): shared duplicate-group collapse so both
    // tiers converge on one implementation. Used by the standard-tier
    // single-ring / fused-rings / chain branches and by the comprehensive-
    // tier chain + single-carbon (10-5) branches.
    collapseGroupList: _collapseGroupList,
    // Phase 11-1c (N-post10-7): short-tier sibling of the collapse helper —
    // consumed by _assembleShortDescription's single-ring and chain branches
    // so SHORT's group list collapses on the same key (shortName) as STD.
    collapseGroupListShort: _collapseGroupListShort,
  };

  logInfo("MathPixChemistryDescriptions initialised (Phase 8C-ST)");
})();
