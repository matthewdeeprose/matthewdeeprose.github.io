/**
 * MathPix Chemistry Classify — Structural classification primitives.
 *
 * Phase 14-1c — extracted from mathpix-chemistry-descriptions.js
 * Source attribution: cleave manifest § 2.
 *   - Manifest commit a2fbd1c (manifest update recording 14-1c dispatch baseline);
 *     resolves via `git log --oneline a2fbd1c -1`.
 *   - Dispatch HEAD dba8a52 (baseline against which all line ranges in the
 *     manifest are anchored); resolves via `git log --oneline dba8a52 -1`.
 *
 * Owns: structural classification primitives — graph adjacency, ring
 *   classification, functional-group detection, named-system identification,
 *   scaffold determination.
 *
 * Public surface: window.MathpixChemistryClassify.analyseStructure
 *   + .internals.helpers (per cleave manifest § 2.3). A backwards-compat
 *   forwarding stub in mathpix-chemistry-descriptions.js (added at Step 5)
 *   preserves the legacy MathPixChemistryUtils.analyseStructure name (no
 *   consumer changes required for tests + harness).
 *
 * Tier-consistency: classify.js produces classification shape; prose.js
 *   consumes. Cleave is pure relocation; behaviour preservation gated by
 *   20-fixture migration harness. Byte-identical baseline = zero regression
 *   in screen-reader output.
 *
 * Must load AFTER mathpix-chemistry-utils.js, BEFORE mathpix-chemistry-
 *   descriptions.js (descriptions.js destructures from classify.js's
 *   helpers table for symbols moved out of descriptions.js).
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
      console.error("[ChemClassify]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ChemClassify]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ChemClassify]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ChemClassify]", message, ...args);
  }

  // =========================================================================
  // Dependency check
  // =========================================================================
  const utils = window.MathPixChemistryUtils;
  if (!utils) {
    logError("MathPixChemistryClassify: MathPixChemistryUtils not found — check script load order");
    return;
  }
  const internals = utils._descriptionInternals;
  if (!internals) {
    logError("MathPixChemistryClassify: _descriptionInternals not exposed — utils version mismatch");
    return;
  }

  // Phase 14-1c step 5: shared dependencies needed by analyseStructure
  // (relocated from descriptions.js's IIFE preamble). Sourced from internals
  // (set up by mathpix-chemistry-utils.js); same destructure shape as the
  // descriptions.js binding — that file retains its own bindings for the
  // four generate*Description public-API functions which still reside there
  // until 14-1d.
  const _getCachedGraph = internals.getCachedGraph;
  const FEATURE_FLAGS = internals.featureFlags;

  // =========================================================================
  // Constants
  // =========================================================================

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

  // =========================================================================
  // Leaf primitives (Step 1)
  // =========================================================================

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

  // =========================================================================
  // Detection passes (Step 2)
  //   _classifyRingInternalCarbonyl, _detectFunctionalGroupsFromGraph,
  //   _detectSubstitutionPattern
  // =========================================================================

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

  // =========================================================================
  // Named-system identifiers (Step 3)
  //   _countExocyclicCarbonyls, _identifyFusedSystemName,
  //   _identifyPyrimidinePattern, _identifyPyridinonePattern,
  //   _selectNamedSystemLabel
  // =========================================================================

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

  // =========================================================================
  // Analysers (Step 4)
  //   _analyseChainFromGraph, _classifyScaffold
  // =========================================================================

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
   * @returns {string} "aromatic-ring", "ring", "fused-rings", "joined-rings", or "chain"
   * @private
   */
  function _classifyScaffold(rings) {
    if (rings.length === 0) return "chain";
    if (rings.some(r => r.isFused)) return "fused-rings";
    // Phase 15-1a (KD-1 + KD-2): multi-ring non-fused systems (e.g. biphenyl,
    // SMILES c1ccc(-c2ccccc2)cc1). Tested AFTER fused-rings (so the
    // `rings.length > 1` check here is equivalent to
    // `rings.length > 1 && !rings.some(r => r.isFused)`) and BEFORE
    // aromatic-ring fallback (which previously silently absorbed biphenyl-
    // class scaffolds into the single-ring template via rings[0]). The
    // dedicated value lets STD/SHORT/COMP assemblers in prose.js share a
    // single scaffoldType-based dispatch arm; tier-consistency by
    // construction (CLAUDE.md description-engine tier consistency invariant).
    if (rings.length > 1) return "joined-rings";
    if (rings.some(r => r.aromatic)) return "aromatic-ring";
    return "ring";
  }

  // =========================================================================
  // Public surface (Step 5)
  //   analyseStructure relocates here from descriptions.js at Step 5.
  //   Step 5 also replaces the namespace export's `analyseStructure: undefined`
  //   with the relocated function reference.
  // =========================================================================

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

  // =========================================================================
  // internals.helpers contract
  //
  // Populated incrementally per cleave manifest § 2.3 across Steps 1–4.
  // At Step 1 commit point this holds the 5 leaf-primitive entries.
  // =========================================================================
  window.MathpixChemistryClassify = {
    analyseStructure,
    internals: {
      helpers: {
        buildAdjacencyMap: _buildAdjacencyMap,
        classifyRing: _classifyRing,
        implicitHydrogens: _implicitHydrogens,
        // Phase 9-4 (CT-4h): shared ring-branch position primitive
        enumerateRingBranchPoints: _enumerateRingBranchPoints,
        alkylNames: ALKYL_NAMES,
        alkylShorthands: ALKYL_SHORTHANDS,
        detectSubstitutionPattern: _detectSubstitutionPattern,
        // Phase 9-3 (CT-4ac): shared with comprehensive tier for ring-internal C=O
        classifyRingInternalCarbonyl: _classifyRingInternalCarbonyl,
        detectFunctionalGroupsFromGraph: _detectFunctionalGroupsFromGraph,
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
        selectNamedSystemLabel: _selectNamedSystemLabel,
        analyseChainFromGraph: _analyseChainFromGraph,
        classifyScaffold: _classifyScaffold,
      },
    },
  };

  logInfo("MathPixChemistryClassify initialised (Phase 14-1c)");
})();
