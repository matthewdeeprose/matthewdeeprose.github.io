/**
 * MathPix Chemistry Locants — Phase 11-2a positional-label infrastructure.
 *
 * Augments window.MathPixChemistryLocants with:
 *   mapAtomToLocant(ringMemberSet, atomId, namedSystem, graphData)
 *     → { locant, element } | null
 *
 * Also installs window.auditPositionalLabels(smiles) for one-line console
 * probes during Phase 11-2b / 11-2c / 11-2d verification.
 *
 * Pilot named systems: xanthine, purine, pyrimidine-2,4-dione,
 * pyrimidine-4-one (aliased as pyrimidin-2(1H)-one — the IUPAC-canonical
 * key the description engine emits as of Phase 11-2d), pyridin-2(1H)-one
 * (added in Phase 11-2d for the 2-pyridone scaffold), pyrimidine (stub).
 *
 * Must load AFTER mathpix-chemistry-utils.js and AFTER
 * mathpix-chemistry-descriptions.js (depends on the helpers exposed via
 * MathPixChemistryUtils._descriptionInternals.helpers).
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
      console.error("[ChemLocants]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ChemLocants]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ChemLocants]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ChemLocants]", message, ...args);
  }

  // =========================================================================
  // Dependency check
  // =========================================================================
  // Locants loads BEFORE descriptions (so descriptions can see this module),
  // therefore internals.helpers is not yet populated at init time. Helpers
  // are looked up lazily inside auditPositionalLabels — which is only ever
  // invoked from the console after page load, when both files have run.
  const utils = window.MathPixChemistryUtils;
  if (!utils) {
    logError("MathPixChemistryUtils not found — check script load order");
    return;
  }

  function _getNamedSystemHelpers() {
    // Phase 14-1c step 3: source URL updated to classify.js's helpers table.
    // identifyFusedSystemName / identifyPyrimidinePattern / identifyPyridinonePattern
    // moved from descriptions.js's internals.helpers to
    // MathpixChemistryClassify.internals.helpers. All callsites in this file
    // (lines 459, 461, 466-467 — incl. Phase 11-2d 2-pyridone fall-through)
    // remain byte-identical: they read helpers.X via the local helpers
    // returned from this getter, and the new table exposes the same keys.
    const helpers = window.MathpixChemistryClassify?.internals?.helpers;
    if (!helpers ||
        typeof helpers.identifyFusedSystemName !== "function" ||
        typeof helpers.identifyPyrimidinePattern !== "function") {
      return null;
    }
    return helpers;
  }

  // =========================================================================
  // Locant tables — six active keys + 1 stub; pyrimidin-2(1H)-one aliases
  // pyrimidine-4-one (see _normaliseNamedSystem below).
  // =========================================================================
  // Walk sequences are conceptual labels emitted by the table — atom IDs are
  // resolved per-graph by the rule + walk functions below.
  const LOCANT_TABLES = {
    xanthine: { sixWalk: ["N1", "C2", "N3", "C4", "C5", "C6"],
                fiveWalk: ["C4", "N9", "C8", "N7", "C5"] },
    purine:   { sixWalk: ["N1", "C2", "N3", "C4", "C5", "C6"],
                fiveWalk: ["C4", "N9", "C8", "N7", "C5"] },
    "pyrimidine-2,4-dione": { sixWalk: ["N1", "C2", "N3", "C4", "C5", "C6"] },
    "pyrimidine-4-one":     { sixWalk: ["N1", "C2", "N3", "C4", "C5", "C6"] },
    // Phase 11-2d (N-post10-5): 2-pyridone — single ring N is N1, walk numeric
    // around the ring (N1 → C2(=O) → C3 → C4 → C5 → C6 → back to N1).
    "pyridin-2(1H)-one":    { sixWalk: ["N1", "C2", "C3", "C4", "C5", "C6"] },
    pyrimidine: { sixWalk: ["N1", "C2", "N3", "C4", "C5", "C6"] }, // stub
    // Phase 12-3a (11-2e narrow): naphthalene + pyridine — labelling layers
    // for the InChI-auxinfo path only. The legacy starting-atom + walk
    // machinery is NOT extended for these (per "What to avoid"); resolution
    // is via _buildLocantMapFromInchi when MATHPIX_CONFIG.RDKIT_LOCANTS=true.
    naphthalene: {
      peripheryWalk: ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"],
      bridgeAtoms:   ["C4a", "C8a"],
    },
    pyridine: { sixWalk: ["N1", "C2", "C3", "C4", "C5", "C6"] },
  };

  // =========================================================================
  // Graph utilities
  // =========================================================================
  function _buildAdjacency(graph) {
    const adj = new Map();
    for (const v of graph.vertices) adj.set(v.id, []);
    for (const edge of graph.edges) {
      const s = graph.vertices.find(v => v.id === edge.sourceId);
      const t = graph.vertices.find(v => v.id === edge.targetId);
      if (s && t) {
        adj.get(edge.sourceId).push({ vertex: t, edge });
        adj.get(edge.targetId).push({ vertex: s, edge });
      }
    }
    return adj;
  }

  function _vertexById(graph, id) {
    return graph.vertices.find(v => v.id === id);
  }

  function _hasExocyclicCarbonyl(atomId, ringSet, adjacency) {
    const neighbours = adjacency.get(atomId) || [];
    return neighbours.some(n =>
      (n.vertex.value?.element || "") === "O" &&
      n.edge.bondType === "=" &&
      !ringSet.has(n.vertex.id));
  }

  function _hasExocyclicAmine(atomId, ringSet, adjacency) {
    const neighbours = adjacency.get(atomId) || [];
    return neighbours.some(n =>
      (n.vertex.value?.element || "") === "N" &&
      n.edge.bondType === "-" &&
      !ringSet.has(n.vertex.id));
  }

  function _ringNeighbours(atomId, ringSet, adjacency) {
    const neighbours = adjacency.get(atomId) || [];
    return neighbours.filter(n => ringSet.has(n.vertex.id)).map(n => n.vertex);
  }

  function _findBridgeIds(sixRing, fiveRing) {
    const sixSet = new Set(sixRing.memberVertexIds);
    return fiveRing.memberVertexIds.filter(id => sixSet.has(id));
  }

  // =========================================================================
  // Starting-atom rules — return atomId | null (null on ambiguity)
  // =========================================================================
  function _startN1_xanthine(sixRing, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const candidates = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      if (!v || (v.value?.element || "") !== "N") return false;
      const ringNs = _ringNeighbours(id, ringSet, adjacency).filter(n => (n.value?.element || "") === "C");
      if (ringNs.length !== 2) return false;
      return ringNs.every(c => _hasExocyclicCarbonyl(c.id, ringSet, adjacency));
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function _startN1_purine(sixRing, fiveRing, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const bridgeSet = new Set(_findBridgeIds(sixRing, fiveRing));
    const candidates = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      if (!v || (v.value?.element || "") !== "N") return false;
      const ringNeigh = _ringNeighbours(id, ringSet, adjacency);
      return ringNeigh.every(n => !bridgeSet.has(n.id));
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function _startN1_pyrimidineDione(sixRing, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const candidates = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      if (!v || (v.value?.element || "") !== "N") return false;
      const ringCs = _ringNeighbours(id, ringSet, adjacency).filter(n => (n.value?.element || "") === "C");
      const carbonyls = ringCs.filter(c => _hasExocyclicCarbonyl(c.id, ringSet, adjacency)).length;
      return carbonyls === 1;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function _startN1_pyrimidineOne(sixRing, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    // Find C2 first: the carbon adjacent to BOTH 6-ring Ns.
    const ringNs = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      return v && (v.value?.element || "") === "N";
    });
    if (ringNs.length !== 2) return null;
    const c2Candidates = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      if (!v || (v.value?.element || "") !== "C") return false;
      const ringNeigh = _ringNeighbours(id, ringSet, adjacency).map(n => n.id);
      return ringNs.every(nId => ringNeigh.includes(nId));
    });
    if (c2Candidates.length !== 1) return null;
    const c2Id = c2Candidates[0];
    // N1: the N whose non-C2 6-ring neighbour is a plain CH (no exocyclic).
    const candidates = ringNs.filter(nId => {
      const ringNeigh = _ringNeighbours(nId, ringSet, adjacency).filter(n => n.id !== c2Id);
      if (ringNeigh.length !== 1) return false;
      const otherC = ringNeigh[0];
      if ((otherC.value?.element || "") !== "C") return false;
      return !_hasExocyclicCarbonyl(otherC.id, ringSet, adjacency) &&
             !_hasExocyclicAmine(otherC.id, ringSet, adjacency);
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  // Phase 11-2d (N-post10-5): 2-pyridone starting-atom rule. Single-ring
  // 6-aromatic with exactly one N and one exocyclic C=O. N1 is the unique
  // ring N adjacent to the carbonyl-bearing ring carbon. Mirrors the
  // _startN1_pyrimidineOne shape but simpler — only one N candidate exists.
  function _startN1_pyridinone(sixRing, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const ringNs = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      return v && (v.value?.element || "") === "N";
    });
    if (ringNs.length !== 1) return null;
    const nId = ringNs[0];
    // Confirm the N is adjacent to a ring-C bearing an exocyclic C=O.
    const ringCs = _ringNeighbours(nId, ringSet, adjacency).filter(n => (n.value?.element || "") === "C");
    const adjacentToCarbonyl = ringCs.some(c => _hasExocyclicCarbonyl(c.id, ringSet, adjacency));
    return adjacentToCarbonyl ? nId : null;
  }

  // =========================================================================
  // Walk helpers — return ordered atomId arrays | null
  // =========================================================================
  function _walkSixRing(sixRing, n1Id, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const ringNs = sixRing.memberVertexIds.filter(id => {
      const v = _vertexById(graph, id);
      return v && (v.value?.element || "") === "N";
    });
    if (ringNs.length !== 2) return null;
    const otherN = ringNs.find(id => id !== n1Id);
    if (otherN === undefined) return null;
    // C2 = the 6-ring neighbour of N1 that is also adjacent to otherN.
    const n1Neighbours = _ringNeighbours(n1Id, ringSet, adjacency);
    const c2Candidates = n1Neighbours.filter(c => {
      const cRingNeigh = _ringNeighbours(c.id, ringSet, adjacency).map(n => n.id);
      return cRingNeigh.includes(otherN);
    });
    if (c2Candidates.length !== 1) return null;
    const sequence = [n1Id, c2Candidates[0].id];
    let prev = n1Id;
    let curr = c2Candidates[0].id;
    while (sequence.length < 6) {
      const nextCands = _ringNeighbours(curr, ringSet, adjacency)
        .map(n => n.id)
        .filter(id => id !== prev);
      if (nextCands.length !== 1) return null;
      sequence.push(nextCands[0]);
      prev = curr;
      curr = nextCands[0];
    }
    return sequence;
  }

  // Phase 11-2d (N-post10-5): 2-pyridone six-ring walk. Sibling of
  // _walkSixRing — the pyrimidine-class walk picks C2 as "the C adjacent to
  // both Ns", which fails for 2-pyridone because the ring has only one N.
  // Here C2 is the unique ring-C neighbour of N1 that bears an exocyclic
  // C=O (the carbonyl carbon). The remaining walk is a plain numeric step
  // around the ring.
  function _walkSixRing_pyridinone(sixRing, n1Id, adjacency, graph) {
    const ringSet = new Set(sixRing.memberVertexIds);
    const n1Neighbours = _ringNeighbours(n1Id, ringSet, adjacency);
    const c2Candidates = n1Neighbours.filter(c =>
      (c.value?.element || "") === "C" &&
      _hasExocyclicCarbonyl(c.id, ringSet, adjacency));
    if (c2Candidates.length !== 1) return null;
    const sequence = [n1Id, c2Candidates[0].id];
    let prev = n1Id;
    let curr = c2Candidates[0].id;
    while (sequence.length < 6) {
      const nextCands = _ringNeighbours(curr, ringSet, adjacency)
        .map(n => n.id)
        .filter(id => id !== prev);
      if (nextCands.length !== 1) return null;
      sequence.push(nextCands[0]);
      prev = curr;
      curr = nextCands[0];
    }
    return sequence;
  }

  function _walkFiveRing(fiveRing, sixRing, n3Id, adjacency, graph) {
    const ringSet = new Set(fiveRing.memberVertexIds);
    const bridgeIds = _findBridgeIds(sixRing, fiveRing);
    if (bridgeIds.length !== 2) return null;
    const sixRingSet = new Set(sixRing.memberVertexIds);
    // C4 = the bridge atom adjacent to N3 in the 6-ring.
    const c4Candidates = bridgeIds.filter(bId => {
      const bN = _ringNeighbours(bId, sixRingSet, adjacency).map(n => n.id);
      return bN.includes(n3Id);
    });
    if (c4Candidates.length !== 1) return null;
    const c4Id = c4Candidates[0];
    const c5Id = bridgeIds.find(id => id !== c4Id);
    // Walk C4 → away from C5 → N9 → C8 → N7 → C5.
    const sequence = [c4Id];
    let prev = c5Id;
    let curr = c4Id;
    while (sequence.length < 5) {
      const nextCands = _ringNeighbours(curr, ringSet, adjacency)
        .map(n => n.id)
        .filter(id => id !== prev);
      if (nextCands.length !== 1) return null;
      sequence.push(nextCands[0]);
      prev = curr;
      curr = nextCands[0];
    }
    if (sequence[4] !== c5Id) return null; // sanity: 5-ring closes on C5
    return sequence;
  }

  // =========================================================================
  // Per-graph locant map builder
  // =========================================================================
  function _buildLocantMap(namedSystem, rings, graph, adjacency) {
    if (namedSystem === "pyrimidine") return null; // stub: no fixture yet
    const isFused = namedSystem === "xanthine" || namedSystem === "purine";
    let sixRing, fiveRing;
    if (isFused) {
      if (!rings || rings.length !== 2) return null;
      sixRing = rings.find(r => r.size === 6);
      fiveRing = rings.find(r => r.size === 5);
      if (!sixRing || !fiveRing) return null;
    } else {
      sixRing = rings && rings[0]?.size === 6 ? rings[0] : null;
      if (!sixRing) return null;
    }

    let n1Id = null;
    if (namedSystem === "xanthine") {
      n1Id = _startN1_xanthine(sixRing, adjacency, graph);
    } else if (namedSystem === "purine") {
      n1Id = _startN1_purine(sixRing, fiveRing, adjacency, graph);
    } else if (namedSystem === "pyrimidine-2,4-dione") {
      n1Id = _startN1_pyrimidineDione(sixRing, adjacency, graph);
    } else if (namedSystem === "pyrimidine-4-one") {
      n1Id = _startN1_pyrimidineOne(sixRing, adjacency, graph);
    } else if (namedSystem === "pyridin-2(1H)-one") {
      // Phase 11-2d: 2-pyridone — single-ring, 1 N, no fused 5-ring.
      n1Id = _startN1_pyridinone(sixRing, adjacency, graph);
    }
    if (n1Id === null) {
      logDebug("starting-atom rule produced ambiguous or no candidate", { namedSystem });
      return null;
    }

    // Phase 11-2d: 2-pyridone uses a different C2-picker (carbonyl-C neighbour
    // of N1) because the pyrimidine-class walker assumes 2 ring nitrogens.
    const sixWalk = namedSystem === "pyridin-2(1H)-one"
      ? _walkSixRing_pyridinone(sixRing, n1Id, adjacency, graph)
      : _walkSixRing(sixRing, n1Id, adjacency, graph);
    if (!sixWalk) {
      logDebug("6-ring walk failed", { namedSystem, n1Id });
      return null;
    }
    const map = new Map();
    const sixLocants = LOCANT_TABLES[namedSystem].sixWalk;
    for (let i = 0; i < sixWalk.length; i++) {
      const v = _vertexById(graph, sixWalk[i]);
      map.set(sixWalk[i], { locant: sixLocants[i], element: v?.value?.element || "?" });
    }

    if (isFused) {
      const n3Id = sixWalk[2];
      const fiveWalk = _walkFiveRing(fiveRing, sixRing, n3Id, adjacency, graph);
      if (!fiveWalk) {
        logDebug("5-ring walk failed", { namedSystem, n3Id });
        return null;
      }
      const fiveLocants = LOCANT_TABLES[namedSystem].fiveWalk;
      for (let i = 0; i < fiveWalk.length; i++) {
        if (map.has(fiveWalk[i])) continue; // bridge atoms already labelled
        const v = _vertexById(graph, fiveWalk[i]);
        map.set(fiveWalk[i], { locant: fiveLocants[i], element: v?.value?.element || "?" });
      }
    }
    return map;
  }

  // =========================================================================
  // Cache: one locant map per graphData reference
  // =========================================================================
  const _locantMapCache = new WeakMap();

  function _getOrBuildLocantMap(namedSystem, rings, graphData) {
    if (!graphData?.graph) return null;
    let perGraph = _locantMapCache.get(graphData);
    if (!perGraph) {
      perGraph = new Map();
      _locantMapCache.set(graphData, perGraph);
    }
    if (perGraph.has(namedSystem)) return perGraph.get(namedSystem);
    const adjacency = _buildAdjacency(graphData.graph);
    const built = _buildLocantMap(namedSystem, rings, graphData.graph, adjacency);
    perGraph.set(namedSystem, built);
    return built;
  }

  // =========================================================================
  // Public API
  // =========================================================================
  function _normaliseNamedSystem(namedSystem) {
    if (namedSystem === "pyrimidin-2(1H)-one") return "pyrimidine-4-one";
    return namedSystem;
  }

  function mapAtomToLocant(ringMemberSet, atomId, namedSystem, graphData) {
    const key = _normaliseNamedSystem(namedSystem);
    if (!key || !(key in LOCANT_TABLES)) return null;
    if (!graphData?.rings) return null;

    const locantMap = _getOrBuildLocantMap(key, graphData.rings, graphData);
    if (!locantMap) return null;
    const entry = locantMap.get(atomId);
    return entry || null;
  }

  // =========================================================================
  // Audit helper — window.auditPositionalLabels(smiles)
  // =========================================================================
  function auditPositionalLabels(smiles) {
    if (typeof utils.analyseStructure !== "function") {
      logError("MathPixChemistryUtils.analyseStructure not available");
      return null;
    }
    const helpers = _getNamedSystemHelpers();
    if (!helpers) {
      logError("named-system helpers not yet available — wait for descriptions module to load");
      return null;
    }
    const analysis = utils.analyseStructure(smiles);
    if (!analysis) {
      logWarn("no cached graph for SMILES — render it first", { smiles });
      return null;
    }
    const { rings, _graphData, _adjacency } = analysis;
    if (!rings || rings.length === 0) return [];

    let namedSystem = null;
    if (rings.length === 2) {
      namedSystem = helpers.identifyFusedSystemName(rings, _graphData, _adjacency);
    } else if (rings.length === 1) {
      namedSystem = helpers.identifyPyrimidinePattern(rings[0], _graphData, _adjacency);
      // Phase 11-2d: fall through to identifyPyridinonePattern so 2-pyridone
      // (single ring, 1 N, 1 exocyclic C=O) returns "pyridin-2(1H)-one" rather
      // than null. Keeps the audit helper consistent with the description-
      // engine call sites that already chain pyrimidine → pyridinone.
      if (!namedSystem && typeof helpers.identifyPyridinonePattern === "function") {
        namedSystem = helpers.identifyPyridinonePattern(rings[0], _graphData, _adjacency);
      }
    }
    if (!namedSystem) return [];

    const graphDataLike = {
      graph: _graphData.graph,
      rings,
      _smiles: smiles,
    };
    const key = _normaliseNamedSystem(namedSystem);
    const locantMap = _getOrBuildLocantMap(key, rings, graphDataLike);
    const rows = [];
    const seen = new Set();
    rings.forEach((ring, ringIdx) => {
      for (const atomId of ring.memberVertexIds) {
        if (seen.has(atomId)) continue;
        seen.add(atomId);
        const v = _graphData.graph.vertices.find(x => x.id === atomId);
        const element = v?.value?.element || "?";
        const entry = locantMap ? locantMap.get(atomId) : null;
        const actualLocant = entry ? entry.locant : null;
        rows.push({
          ringIdx,
          atomId,
          element,
          namedSystem,
          expectedLocant: actualLocant,
          actualLocant,
          source: smiles,
        });
      }
    });
    return rows;
  }

  // =========================================================================
  // Expose
  // =========================================================================
  window.MathPixChemistryLocants = {
    mapAtomToLocant,
    _locantTables: LOCANT_TABLES,
  };
  window.auditPositionalLabels = auditPositionalLabels;

  logInfo("MathPixChemistryLocants initialised (Phase 11-2a + 12-3a InChI dispatch)");
})();
