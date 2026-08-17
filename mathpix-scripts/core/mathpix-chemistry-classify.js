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
 *   22-fixture migration harness. Byte-identical baseline = zero regression
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
  // Phase 17-2a/2b: SMARTS functional-group catalogue.
  //
  // LIVE CODE since the Phase 17-3b switchover. analyseStructure calls
  // runCatalogue (below) as its functional-group detector; the legacy
  // _detectFunctionalGroupsFromGraph is retained (never deleted) as both the
  // one-line rollback anchor and the empty-result fallback that fires when
  // RDKit is unavailable or the SMILES is invalid. The equivalence harness
  // (window.testCatalogueEquivalence) still compares the two detectors.
  //
  // Batch 1 seeds the six Q2-class-(a) "pure-SMARTS, atoms-exact" passes from
  // phase17-2-investigation-findings.md § 3: carboxylic acid, aldehyde,
  // hydroxyl, thiol, nitrile, halogen. Each row reproduces the legacy pass's
  // record shape field-for-field (name / shortName / shorthand / atoms /
  // attachmentVertexId). For all six the SMARTS-match atom order coincides
  // with the legacy `atoms` order (acid C(=O)[OH] → [C,=O,OH]; aldehyde
  // [CX3H1]=O → [C,=O]; nitrile [CX2]#[NX1] → [C,N]; single-atom rows
  // otherwise), so no role-remap is needed in this batch (§ 2.4 corollary 1).
  //
  // Row order encodes the subset of the § 3.2 priority chain that touches
  // these six: carboxylic acid runs BEFORE hydroxyl so the acid's –OH oxygen
  // is claimed first and never re-emitted as a stray hydroxyl (the only
  // intra-batch claim interaction — verified across the 35 migration+tier-1
  // fixtures). The remaining four rows are element-/H-disjoint from each other
  // and from the acid/hydroxyl pair.
  //
  // SMARTS authority note (surfaced at Gate 0): findings § 3 lists the thiol
  // pattern as [SX1H1]; that form matches NOTHING on the pinned RDKit build
  // because X (total connectivity) counts implicit H, so a terminal –SH sulfur
  // is X2 — exactly like the validated hydroxyl row [OX2H1]. The equivalence-
  // preserving form is [SX2H1] (live-probe-confirmed: propanethiol CCCS →
  // [[3]], byte-identical to the legacy thiol record). This is a one-token
  // correction of an internal inconsistency in the findings (their hydroxyl
  // row already uses X2 for the same terminal-heteroatom+1H shape), not a
  // re-derivation.
  //
  // halogen.shorthand is null in the table and computed per-match from the
  // matched atom's element ("–F" / "–Cl" / "–Br" / "–I"), matching the legacy
  // pass's `"–" + el`.
  //
  // Batch 2 (Phase 17-2b) adds the first Q2-class-(b) rows: the S-cluster
  // (sulphonic acid / sulphonamide, then sulphoxide). A class-(b) row carries a
  // `refine(matchAtoms, ctx)` hook IN ADDITION to its SMARTS. The SMARTS only
  // NARROWS the candidate atoms (matches the sulphur anchor); `refine`
  // reproduces the legacy detection predicate verbatim from the graph adjacency
  // — confirming, sub-typing, or REJECTING the match — and returns the legacy
  // group record ({ name, shortName, shorthand, atoms }) or null. Because the
  // refine re-derives `atoms` from adjacency exactly as the legacy pass does
  // (NOT from SMARTS-match order), the record is byte-identical to the legacy
  // pass's by construction, including atom ordering (§ 2.4 corollary 1) and the
  // claim-subset (corollary 2: sulphoxide claims only [S, =O], not its carbons).
  // ctx = { vertices, adjacency, claimed }; the refine consults `claimed` for
  // its own !claimed guards, mirroring the legacy per-atom checks.
  //
  // ORDER (load-bearing — and where this batch deviates from the 17-2b dispatch
  // § 3's "they append, no ordering surgery"): the sulphonic-acid row CLAIMS the
  // S–OH oxygen, which the landed hydroxyl row [OX2H1] would otherwise match
  // (the –OH on sulphur is OX2H1, just like an alcohol). The legacy cascade runs
  // sulphonic/sulphonamide (pass "4") BEFORE hydroxyl (pass "7") so that oxygen
  // is claimed first; the catalogue must preserve that. The two S rows are
  // therefore INSERTED after `acid` and before `hydroxyl` (giving the exact
  // legacy priority order acid < sulphonyl < sulphoxide < aldehyde < hydroxyl <
  // …), per findings § 3.2's priority chain — not appended. The full-record
  // comparator (testCatalogueEquivalence) is the backstop: a wrong placement
  // surfaces as a spurious hydroxyl + missing sulphonic on methanesulphonic acid.
  // sulphonic/sulphonamide is placed before sulphoxide per § 3 / findings Q4
  // (2 =O vs 1 =O; mutually exclusive per S atom, so emission order only).
  const FUNCTIONAL_GROUPS = [
    { id: "acid",     smarts: "C(=O)[OH]",      name: "carboxylic acid", shortName: "acid",     shorthand: "–COOH" },
    // --- batch 7 (Phase 17-4b): the two senior principals, class (a) —
    //     pure-SMARTS, atoms-exact. Inserted immediately after `acid` at
    //     positions 2 and 3, in PCG_CASCADE order (acid < anhydride < acid
    //     chloride), which is IUPAC P-41 seniority.
    //
    //     ORDER IS LOAD-BEARING on both rows, and for different reasons:
    //       • anhydride MUST sit above `ester` (row 6). The ester pattern
    //         [#6](=O)[OX2][#6] matches a symmetric anhydride and claims its
    //         bridging O first, so an anhydride row placed below ester can
    //         never fire — the root cause recorded at KD-20, where acetic
    //         anhydride was described as "an ester group (–OCOCH₃)".
    //       • acid chloride MUST sit above `halogen` (row 16), which would
    //         otherwise claim the chlorine on its own and leave the carbonyl
    //         undescribed — KD-21, where acetyl chloride read "a halogen
    //         (–Cl)" with no carbonyl at all.
    //     Both rows claim their WHOLE motif (F3's ruling), so no atom is left
    //     for a lower row to mislabel: anhydride claims [C,=O,O,C,=O] and acid
    //     chloride claims [C,=O,Cl].
    //
    //     Neither pattern matches any of the 22 baseline fixtures (measured at
    //     this unit's pre-flight, 22/22 no-match for both), so the insertion
    //     disturbs no landed claim. Aspirin is the only baseline fixture the
    //     `ester` row matches, and the anhydride pattern declines it.
    //
    //     PATTERN NARROWED FROM THE PROBED CANDIDATE (validated, not copied):
    //     the recon probed acid chloride as [CX3](=O)[F,Cl,Br,I], which also
    //     matches acyl fluorides, bromides and iodides. The shortName sealed at
    //     17-4a is the specific string "acid chloride", so the broad form would
    //     emit a FALSE claim on CC(=O)F ("an acid chloride group (–COCl)") —
    //     the same shape of defect as KD-19's non-existent hydroxyl, introduced
    //     while closing two others. Narrowed to [Cl] so the emitted name is
    //     always true of the structure; the acyl fluoride/bromide/iodide cases
    //     stay on the halogen row, which is less specific but not false (L46 —
    //     a narrowing predicate fails closed). Also makes the fixed –COCl
    //     shorthand correct by construction, as 17-4a's display-map comment
    //     already anticipated.
    { id: "anhydride",      smarts: "[CX3](=O)[OX2][CX3]=O", name: "anhydride",      shortName: "anhydride",      shorthand: "–CO–O–CO–" },
    { id: "acid chloride",  smarts: "[CX3](=O)[Cl]",         name: "acid chloride",  shortName: "acid chloride",  shorthand: "–COCl" },
    // --- end batch 7 ---
    // --- batch 2: S-cluster, class (b) — SMARTS + refine (DEAD CODE) ---
    {
      id: "sulphonyl",
      smarts: "[SX4](=O)(=O)[OX2,NX3]",
      // name/shortName/shorthand are emitted by refine (branch on O vs N).
      name: null, shortName: null, shorthand: null,
      // Reproduces legacy pass "4" (Sulphonic acids/sulphonamides): S with two
      // =O and one single-bonded -O (sulphonic acid) or -N (sulphonamide).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const sVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => el(v) === "S");
        if (!sVertex || claimed.has(sVertex.id)) return null;
        const neighbours = adjacency.get(sVertex.id) || [];
        const doubleOs = neighbours.filter(
          (n) => el(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
        );
        if (doubleOs.length < 2) return null;
        const singleOorN = neighbours.find(
          (n) => (el(n.vertex) === "O" || el(n.vertex) === "N") && n.edge.bondType === "-" && !claimed.has(n.vertex.id),
        );
        if (!singleOorN) return null;
        const isSulphonamide = el(singleOorN.vertex) === "N";
        return {
          name: isSulphonamide ? "sulphonamide" : "sulphonic acid",
          shortName: isSulphonamide ? "sulphonamide" : "sulphonic acid",
          shorthand: isSulphonamide ? "–SO₂NH₂" : "–SO₃H",
          atoms: [sVertex.id, ...doubleOs.map((d) => d.vertex.id), singleOorN.vertex.id],
        };
      },
    },
    {
      id: "sulphoxide",
      smarts: "[SX3](=O)([#6])[#6]",
      name: null, shortName: null, shorthand: null,
      // Reproduces legacy pass "4.5" (Sulphoxides, Phase 15-2c LOCK 2 + R2):
      // non-ring S with EXACTLY ONE =O and exactly two single-bonded C. The
      // exact-1 =O test rejects a sulphone (two =O). Claim-subset [S, =O].
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        const sVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => el(v) === "S");
        if (!sVertex || claimed.has(sVertex.id) || inRing(sVertex)) return null;
        const neighbours = adjacency.get(sVertex.id) || [];
        if (neighbours.length !== 3) return null;
        const doubleOs = neighbours.filter(
          (n) => el(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
        );
        if (doubleOs.length !== 1) return null; // R2: rejects sulphone (=O count 2)
        const singleCs = neighbours.filter(
          (n) => el(n.vertex) === "C" && n.edge.bondType === "-" && !claimed.has(n.vertex.id),
        );
        if (singleCs.length !== 2) return null;
        return {
          name: "sulphoxide group",
          shortName: "sulphoxide",
          shorthand: "S=O",
          atoms: [sVertex.id, doubleOs[0].vertex.id],
        };
      },
    },
    // --- end batch 2 ---
    // --- batch 3 (Phase 17-2c): the carbonyl-C family, class (b) — SMARTS +
    //     refine (DEAD CODE). Inserted immediately before the landed `aldehyde`
    //     row so the hard claim-precedence chain ring-internal < amide <
    //     aldehyde holds (findings Q4.5 / dispatch § 3). The only two
    //     atom-sharing pairs in the whole family:
    //       • a ring amide's carbonyl matches BOTH the ring-internal SMARTS and
    //         the amide SMARTS → the ring-internal row claims first (it runs
    //         earlier, claiming [ringC, =O]; the amide refine then sees the
    //         carbonyl already claimed and returns null);
    //       • formamide H–C(=O)–N is CX3H1 AND N-bearing → matches BOTH the
    //         amide SMARTS and the landed aldehyde SMARTS → the amide row claims
    //         first (runs before aldehyde).
    //     ester and ketone are atom-disjoint from every row → claim-free
    //     position; placed in legacy-emission order for legibility (the
    //     comparator keys records by sorted-atom set, so row order is never
    //     compared). Each refine reproduces its legacy pass byte-for-byte:
    //     ester = pass "2", ring-internal = pass "3 (Phase 9-3)", amide =
    //     pass "3", ketone = pass "5"; the refine re-derives `atoms` from
    //     adjacency in legacy order (NOT SMARTS-match order), so the record is
    //     byte-identical by construction. The ring-internal rows additionally
    //     return `flanking` and an explicit `attachmentVertexId` (= the ring
    //     carbon), both honoured by the widened runCatalogue refine push.
    {
      id: "ester",
      smarts: "[#6](=O)[OX2][#6]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "2": a non-ring O bridging two single-bonded C, one of
      // which carries a =O. Claim-subset [O_bridge, C, =O]. The !inRing guard
      // on the bridging O preserves the legacy behaviour that a cyclic ester
      // (lactone) is NOT matched (findings Q3.1) — [OX2] alone does not exclude
      // a ring O.
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        // The bridging O: non-ring, degree 2, exactly two single-bonded C.
        const oVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => {
            if (!v || el(v) !== "O" || inRing(v)) return false;
            const nb = adjacency.get(v.id) || [];
            if (nb.length !== 2) return false;
            return nb.filter((n) => el(n.vertex) === "C" && n.edge.bondType === "-").length === 2;
          });
        if (!oVertex || claimed.has(oVertex.id)) return null;
        const carbonNeighbours = (adjacency.get(oVertex.id) || []).filter(
          (n) => el(n.vertex) === "C" && n.edge.bondType === "-",
        );
        for (const cn of carbonNeighbours) {
          const cNeighbours = adjacency.get(cn.vertex.id) || [];
          const doubleOVertex = cNeighbours.find(
            (n) => el(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
          );
          if (!doubleOVertex) continue;
          const atoms = [oVertex.id, cn.vertex.id, doubleOVertex.vertex.id];
          // R-group sniff (legacy 650–662): terminal-methyl acyl → –OCOCH₃.
          let esterShorthand = "–OCOR";
          const rNeighbours = (adjacency.get(cn.vertex.id) || []).filter(
            (n) => n.vertex.id !== oVertex.id && n.vertex.id !== doubleOVertex.vertex.id,
          );
          if (rNeighbours.length === 1 && el(rNeighbours[0].vertex) === "C") {
            const rCarbonNeighbours = (adjacency.get(rNeighbours[0].vertex.id) || []).filter(
              (n) => el(n.vertex) === "C" && n.vertex.id !== cn.vertex.id,
            );
            if (rCarbonNeighbours.length === 0) esterShorthand = "–OCOCH₃";
          }
          return { name: "ester", shortName: "ester", shorthand: esterShorthand, atoms };
        }
        return null;
      },
    },
    {
      id: "ring-internal-carbonyl",
      smarts: "[#6;R](=[OX1])",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "3 (Phase 9-3)": ring-internal carbonyls — urea linkages and
      // lactams. The SMARTS over-matches (also a ring ketone and a ring carbonyl
      // whose flankers give kind:null); the refine delegates to
      // _classifyRingInternalCarbonyl and returns null for those, so they fall
      // through to the ketone row (the null return is load-bearing — findings
      // Q3.2/Q4). Claim-subset [ringC, =O]. Carries `flanking` and an explicit
      // `attachmentVertexId` (= ringCId) — the widened refine push honours both.
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const cVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "C");
        if (!cVertex || claimed.has(cVertex.id)) return null;
        const result = _classifyRingInternalCarbonyl(cVertex, adjacency);
        if (!result || !result.kind) return null;
        const atoms = [result.ringCId, result.oId];
        if (result.kind === "urea") {
          return {
            name: "urea linkage", shortName: "urea", shorthand: null,
            atoms, attachmentVertexId: result.ringCId, flanking: result.flanking,
          };
        }
        return {
          name: "lactam", shortName: "lactam", shorthand: "cyclic amide",
          atoms, attachmentVertexId: result.ringCId, flanking: result.flanking,
        };
      },
    },
    {
      id: "amide",
      smarts: "[CX3](=[OX1])[NX3]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "3" (exocyclic amides). Runs AFTER the ring-internal row so a
      // ring amide's carbonyl is already claimed (refine returns null here), and
      // BEFORE the landed aldehyde row so formamide H–C(=O)–N claims as an amide,
      // not an aldehyde (findings Q4.5). Subtype by the nitrogen's carbon-
      // neighbour count: 0 → amide (–CONH₂), 1 → secondary amide (–CONHR),
      // 2 → tertiary amide (–CONR₂). Claim-subset [C, =O, N].
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const cVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "C");
        if (!cVertex || claimed.has(cVertex.id)) return null;
        const neighbours = adjacency.get(cVertex.id) || [];
        let doubleO = null, singleN = null;
        for (const n of neighbours) {
          if (el(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id)) doubleO = n.vertex;
          if (el(n.vertex) === "N" && n.edge.bondType === "-" && !claimed.has(n.vertex.id)) singleN = n.vertex;
        }
        if (!doubleO || !singleN) return null;
        const atoms = [cVertex.id, doubleO.id, singleN.id];
        const nCarbonNeighbours = (adjacency.get(singleN.id) || []).filter(
          (n) => n.vertex.id !== cVertex.id && el(n.vertex) === "C",
        );
        let amideName, amideShorthand;
        if (nCarbonNeighbours.length === 0) { amideName = "amide"; amideShorthand = "–CONH₂"; }
        else if (nCarbonNeighbours.length === 1) { amideName = "secondary amide"; amideShorthand = "–CONHR"; }
        else { amideName = "tertiary amide"; amideShorthand = "–CONR₂"; }
        return { name: amideName, shortName: amideName, shorthand: amideShorthand, atoms };
      },
    },
    {
      id: "ketone",
      smarts: "[CX3](=O)([#6])[#6]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "5" (ketones): a residual (unclaimed) C=O with two carbon
      // neighbours. Fires on the residual =O after acid/ester/ring-internal/
      // amide have claimed, exactly as legacy. Claim-subset [C, =O] only — the
      // neighbour carbons stay free for the future alkyl walker (findings Q3.4).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const candidates = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .filter((v) => v && el(v) === "C" && !claimed.has(v.id));
        for (const cVertex of candidates) {
          const neighbours = adjacency.get(cVertex.id) || [];
          const doubleO = neighbours.find(
            (n) => el(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
          );
          if (!doubleO) continue;
          const carbonNeighbours = neighbours.filter((n) => el(n.vertex) === "C");
          if (carbonNeighbours.length < 2) continue;
          return { name: "ketone", shortName: "ketone", shorthand: "C=O", atoms: [cVertex.id, doubleO.vertex.id] };
        }
        return null;
      },
    },
    // --- end batch 3 ---
    { id: "aldehyde", smarts: "[CX3H1]=O",      name: "aldehyde",        shortName: "aldehyde", shorthand: "–CHO" },
    { id: "hydroxyl", smarts: "[OX2H1]",        name: "hydroxyl",        shortName: "hydroxyl", shorthand: "–OH" },
    // --- batch 4 (Phase 17-2d): the O-bridge family, class (b) — SMARTS +
    //     refine (DEAD CODE). methoxy then acyclic ether, inserted immediately
    //     after the landed `hydroxyl` row in legacy-emission order (legacy
    //     passes 8, 8.5). The one hard intra-batch claim constraint is
    //     methoxy < ether: ether's SMARTS [OX2]([#6])[#6] also matches a
    //     methoxy O (ring-C–O–CH₃), so methoxy MUST claim first or ether
    //     mis-reads it and emits a wrong record. ester (landed far ahead in
    //     batch 3) already claims the acetate bridging O, so ester < ether
    //     auto-holds — an aspirin ester O the ether SMARTS also matches is
    //     already in `claimed` when the ether row runs. hydroxyl is disjoint:
    //     [OX2H1] needs an H-bearing O, but a methoxy/ether O carries no H, so
    //     the two never share an atom (findings § 4). Each refine reproduces
    //     its legacy pass byte-for-byte and re-derives `atoms` from adjacency
    //     in legacy order, so the record is byte-identical by construction.
    //     methoxy supplies `attachmentVertexId` explicitly (= the ring atom,
    //     matching the ring-internal precedent) via the existing refine-push
    //     guard; no runCatalogue change. ether omits it — the generic
    //     _catalogueFindRingAttachment reproduces the legacy
    //     findRingAttachment([O]) value.
    {
      id: "methoxy",
      smarts: "[c,C;R][OX2][CH3]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "8" (Phase 11-1f): a ring-attached –O–CH₃. The bridging O
      // is a ring branch-point O (single-bonded to the ring), degree 2, whose
      // other neighbour is a non-ring methyl C via a single bond, and that
      // methyl has no onward unclaimed non-ring heavy neighbour (onward-guard).
      // Claim-subset [O, methylC]. attachmentVertexId = the ring atom (explicit).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        const oVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "O" && !claimed.has(v.id));
        if (!oVertex) return null;
        const oNeighbours = adjacency.get(oVertex.id) || [];
        if (oNeighbours.length !== 2) return null;
        // Ring attachment (single-bonded ring neighbour) + the methyl neighbour.
        const ringNb = oNeighbours.find(
          (n) => inRing(n.vertex) && n.edge.bondType === "-",
        );
        if (!ringNb) return null;
        const methylEdge = oNeighbours.find((n) => n.vertex.id !== ringNb.vertex.id);
        if (!methylEdge || methylEdge.edge.bondType !== "-") return null;
        const methylVertex = methylEdge.vertex;
        if (el(methylVertex) !== "C" || inRing(methylVertex) || claimed.has(methylVertex.id)) return null;
        const methylNeighbours = adjacency.get(methylVertex.id) || [];
        const onward = methylNeighbours.filter(
          (n) => n.vertex.id !== oVertex.id && !claimed.has(n.vertex.id) && !inRing(n.vertex),
        );
        if (onward.length > 0) return null;
        return {
          name: "methoxy group",
          shortName: "methoxy",
          shorthand: "–OCH₃",
          atoms: [oVertex.id, methylVertex.id],
          attachmentVertexId: ringNb.vertex.id,
        };
      },
    },
    {
      id: "ether",
      smarts: "[OX2]([#6])[#6]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "8.5" (Phase 15-2c): a non-ring O with degree 2 and exactly
      // two single-bonded C neighbours. Fires only on the residual R–O–R' after
      // ester (pass 2) and methoxy (pass 8, the row above) have claimed their
      // O's — the shared `claimed` Set + row order reproduce that. Claim-subset
      // [O] only. attachmentVertexId omitted → the generic
      // _catalogueFindRingAttachment supplies the legacy findRingAttachment([O]).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        const oVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "O" && !inRing(v) && !claimed.has(v.id));
        if (!oVertex) return null;
        const neighbours = adjacency.get(oVertex.id) || [];
        if (neighbours.length !== 2) return null;
        const singleCs = neighbours.filter(
          (n) => el(n.vertex) === "C" && n.edge.bondType === "-",
        );
        if (singleCs.length !== 2) return null;
        return {
          name: "ether",
          shortName: "ether",
          shorthand: null,
          atoms: [oVertex.id],
        };
      },
    },
    // --- end batch 4 ---
    // --- batch 5 (Phase 17-2e): the N cluster, class (b) — SMARTS + refine
    //     (DEAD CODE). amine then imine, inserted after the O-bridge rows in
    //     legacy-emission order (legacy passes 9, 9.5). Placement is
    //     correctness-free relative to the landed rows: the amide row (batch 3,
    //     far ahead) already claims the amide N, so amide < amine auto-holds and
    //     amine's !claimed guard skips it; amine ⊥ imine by construction
    //     (amine's all-single-bond guard rejects imine's =N, so the two can
    //     never claim the same N), making amine < imine legibility-only. The
    //     landed thiol/nitrile/halogen rows are element-disjoint from N, so this
    //     block may sit before them with no correctness effect. Each refine
    //     reproduces its legacy pass byte-for-byte, re-deriving `atoms` from
    //     adjacency in legacy order, so the record is byte-identical by
    //     construction. amine supplies the subtype payload (subtype /
    //     nSubstituents / nHydrogenCount) via the widened refine-push guards;
    //     imine fits the existing refine-push shape.
    {
      id: "amine",
      smarts: "[NX3;!$([NX3]=*);!$([NX3]#*)]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "9" (Phase 15-2c LOCK 3): a non-ring N whose every edge is a
      // single bond (rules out nitrile # and imine = by construction), with
      // heavy-degree 1..3. subtype = heavyDegree drives the shorthand glyph
      // (1° –NH₂, 2° –NH–, 3° null) and the H-count: bracket.hcount when the
      // translator supplied it, else (3 − heavyDegree). On any NX3-matched atom
      // the two H-count sources agree by construction (X3 ⟹ heavy + H = 3), so
      // the divergence a wrong `3 − heavyDegree` refine could introduce is not
      // reachable through this SMARTS — the check is defence-in-depth (Phase
      // 17-2e Gate-0 finding). Claim-subset [N]. attachmentVertexId supplied
      // explicitly via _catalogueFindRingAttachment (= legacy findRingAttachment).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        const nVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "N" && !inRing(v) && !claimed.has(v.id));
        if (!nVertex) return null;
        const neighbours = adjacency.get(nVertex.id) || [];
        // All neighbour edges must be single bonds — rules out nitrile/imine.
        if (!neighbours.every((n) => n.edge.bondType === "-")) return null;
        const heavyDegree = neighbours.length;
        if (heavyDegree < 1 || heavyDegree > 3) return null;
        const hcount = nVertex.value?.bracket?.hcount ?? (3 - heavyDegree);
        const subtype = heavyDegree; // 1 | 2 | 3
        const shorthandForSubtype =
          subtype === 1 ? "–NH₂" : subtype === 2 ? "–NH–" : null;
        const nSubstituents = neighbours.map((n) => n.vertex.id);
        return {
          name: "amine",
          shortName: "amine",
          shorthand: shorthandForSubtype,
          atoms: [nVertex.id],
          attachmentVertexId: _catalogueFindRingAttachment([nVertex.id], adjacency),
          subtype,
          nSubstituents,
          nHydrogenCount: hcount,
        };
      },
    },
    // --- batch 8 (Phase 17-4c): the three prefix-only groups, class (a) —
    //     pure-SMARTS, atoms-exact. Inserted IMMEDIATELY ABOVE `imine`, in the
    //     order nitro < diazo < azide.
    //
    //     WHY ABOVE `imine`, and it is the only position that is not a bet:
    //     diazo overlaps imine at the PATTERN level on diazomethane
    //     (C=[N+]=[N-]). It does not bite today only because imine's refine
    //     rejects the molecule — it requires the N's sole heavy neighbour to be
    //     a carbon, and diazomethane's terminal N sees a nitrogen. THAT LAST
    //     CLAIM IS READ FROM THE PREDICATE'S SOURCE (the imine refine's
    //     `el(n0.vertex) !== "C"` guard, a few rows below), NOT probed — imine
    //     was never run against diazomethane to watch it decline. Sitting above
    //     imine resolves the overlap BY CONSTRUCTION rather than by depending on
    //     a refine predicate continuing to behave as it does now.
    //
    //     None of the three collides with `amine` (row 14, directly above):
    //     amine's pattern is [NX3;!$([NX3]=*);!$([NX3]#*)], which excludes any
    //     nitrogen carrying a double or triple bond. Nitro's N is NX3 but
    //     double-bonded to an oxygen; diazo's and azide's nitrogens are NX2/NX1.
    //     Confirmed against the live amine row, not assumed.
    //
    //     ALL THREE CLAIM THEIR OWN HETEROATOMS AND NOTHING ELSE (fork F3, and
    //     one ruling beyond it). The recon probed nitro and azide as recursive
    //     SINGLE-ATOM queries, which claim the nitrogen and leave the oxygens
    //     free for a lower row — and an unclaimed nitro oxygen is exactly the
    //     atom the retained legacy detector reads as a hydroxyl (KD-19). A
    //     single-atom row would have reintroduced the defect it was added to
    //     remove. Widened so nitro claims [N, O, O] and azide claims [N, N, N].
    //     Diazo goes the other way from the recon's candidate: it claims its two
    //     nitrogens and NOT the carbon, which the pattern requires as
    //     environment only ($(*=[#6])). Claiming a skeleton carbon removes it
    //     from the chain descriptor — the defect shape recorded at KD-22 — and
    //     minting a second instance of that while closing KD-19 is a poor trade.
    //     Diazomethane's COMP is the named gate on it: the carbon must survive.
    //
    //     azide vs diazo is the pair to watch, since both motifs contain an
    //     [N+]=[N-] fragment. BOTH directions were measured at this unit's
    //     pre-flight, and both are recorded here because one negative would
    //     leave the other half of the guarantee unevidenced: (a) the diazo
    //     pattern does NOT match methyl azide (CN=[N+]=[N-]) — the cationic N
    //     there is double-bonded to two nitrogens, never to a carbon, so
    //     $(*=[#6]) declines it; (b) the azide pattern does NOT match
    //     diazomethane (C=[N+]=[N-]) — [NX2]=[NX2+]=[NX1-] requires three
    //     nitrogens and diazomethane has two. The two rows are therefore
    //     disjoint on both molecules, on two measurements rather than one.
    //     A seat widening EITHER pattern must re-test BOTH, not just the one
    //     it is touching.
    //
    //     Measured over the full 27-fixture corpus at pre-flight: none of the
    //     three matches any existing fixture, so the insertion disturbs no
    //     landed claim and the only prose that moves is nitrobenzene's — which
    //     had no fixture and was reaching the empty-catalogue legacy fallback.
    //
    //     PENTAVALENT NITRO IS COVERED, and the MECHANISM is probed, not
    //     inferred from the match. RDKit normalises c1ccccc1N(=O)=O at
    //     sanitisation, so [NX3+](=O)[O-] matches both writings (both giving
    //     N + 2 O) and both yield byte-identical prose. Read back from RDKit's
    //     own output for the pentavalent input: get_smiles() returns the
    //     charge-separated O=[N+]([O-])c1ccccc1, the InChI is identical for the
    //     two writings, and the formal charges are +1 on N / -1 on an O by two
    //     independent readings (get_json chg fields and the molblock M CHG
    //     block) — i.e. present BEFORE any match is attempted. The competing
    //     explanation (a matcher lenient about charge terms) is refuted by
    //     control: [O-] does NOT match ethanol's neutral oxygen and [N+0] does
    //     NOT match this nitrogen, while the positive control [OX2H1] does
    //     match CCO, so the probe was live. No second pattern needed.
    { id: "nitro", smarts: "[NX3+](=O)[O-]",           name: "nitro", shortName: "nitro", shorthand: "–NO₂" },
    { id: "diazo", smarts: "[NX2+;$(*=[#6])]=[NX1-]",  name: "diazo", shortName: "diazo", shorthand: "=N₂" },
    { id: "azide", smarts: "[NX2]=[NX2+]=[NX1-]",      name: "azide", shortName: "azide", shorthand: "–N₃" },
    // --- end batch 8 ---
    {
      id: "imine",
      smarts: "[NX2;!R]=[CX3]",
      name: null, shortName: null, shorthand: null,
      // Legacy pass "9.5" (Phase 16-3, additive): the residual non-ring =N the
      // amine pass rejects — a heavy-degree-1 N whose sole edge is a double bond
      // to an sp² (CX3) carbon. Degree-1 is load-bearing (ring/heavier C=N is
      // rejected). Strictly additive: the amine pass already claimed the
      // single-bonded amine N's, so this re-claims nothing. Claim-subset [N].
      // attachmentVertexId omitted → the generic _catalogueFindRingAttachment
      // reproduces the legacy findRingAttachment([N]).
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const inRing = (v) => !!(v && v.value && v.value.rings && v.value.rings.length > 0);
        const nVertex = matchAtoms
          .map((id) => vertices.find((x) => x.id === id))
          .find((v) => v && el(v) === "N" && !inRing(v) && !claimed.has(v.id));
        if (!nVertex) return null;
        const neighbours = adjacency.get(nVertex.id) || [];
        if (neighbours.length !== 1) return null; // heavy-degree 1
        const n0 = neighbours[0];
        if (n0.edge.bondType !== "=" || el(n0.vertex) !== "C") return null;
        // C-side CX3: the imine carbon is sp² with heavy-atom degree 3.
        const cNeighbours = adjacency.get(n0.vertex.id) || [];
        if (cNeighbours.length !== 3) return null;
        return {
          name: "imine",
          shortName: "imine",
          shorthand: "=N–",
          atoms: [nVertex.id],
        };
      },
    },
    // --- end batch 5 ---
    { id: "thiol",    smarts: "[SX2H1]",        name: "thiol group",     shortName: "thiol",    shorthand: "–SH" },
    { id: "nitrile",  smarts: "[CX2]#[NX1]",    name: "nitrile",         shortName: "nitrile",  shorthand: "–CN" },
    { id: "halogen",  smarts: "[F,Cl,Br,I;X1]", name: "halogen",         shortName: "halogen",  shorthand: null },
    // --- batch 6 (Phase 17-2f): the alkene/alkyne pair, class (b) — SMARTS +
    //     refine (DEAD CODE). alkene then alkyne, appended after `halogen` in
    //     legacy-emission order (legacy pass 12). This is the LAST SMARTS-portable
    //     family — it closes the migrate-first port (17-2). Both rows are
    //     atom-disjoint from every landed row by construction: the legacy pass
    //     requires BOTH edge ends to be carbon, while every landed row that could
    //     share a carbon anchors on a heteroatom or a C=O / C#N / C=N motif that
    //     the C=C / C#C SMARTS never matches (findings § 4.1). So placement is
    //     correctness-free (legibility only) and no landed row moves.
    //
    //     The one real constraint is the aromatic exclusion — the alkene row must
    //     NOT claim a benzene ring's bonds. The uppercase (aliphatic) `C` in the
    //     SMARTS already excludes aromatic ring bonds (SmilesDrawer's
    //     isPartOfAromaticRing and RDKit's aromaticity model agree on every probed
    //     fixture — findings § 4.2, exact on benzene/Naproxen/styrene); the refine
    //     additionally re-checks the graph edge's isPartOfAromaticRing for
    //     byte-exact legacy parity in any hypothetical model divergence.
    //
    //     Each refine re-derives `atoms` as the legacy [edge.sourceId,
    //     edge.targetId] pair (NOT SMARTS-match order — the pattern is symmetric,
    //     so match order is not guaranteed) and reproduces the legacy
    //     skip-iff-BOTH-ends-claimed gate (`&&`, not the generic class-(a)
    //     any-claimed skip; the distinction is unreachable in practice —
    //     findings § 4.3 — but the refine reproduces it faithfully). Bond order is
    //     expressed by the SMARTS itself (= vs #), so no bond-order-branching
    //     refine. attachmentVertexId is omitted → the generic
    //     _catalogueFindRingAttachment(atoms) reproduces the legacy
    //     findRingAttachment([source, target]) value (byte-identical helper). No
    //     new refine-push field (the record uses only name / shortName /
    //     shorthand / atoms / attachmentVertexId — findings § 3.2). No
    //     runCatalogue change.
    {
      id: "alkene",
      smarts: "C=C",
      name: null, shortName: null, shorthand: null,
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        // The two matched carbons (aliphatic `C` SMARTS → both ends carbon).
        const cIds = matchAtoms.filter((id) => {
          const v = vertices.find((x) => x.id === id);
          return v && el(v) === "C";
        });
        if (cIds.length < 2) return null;
        // Locate the graph edge between the two carbons (legacy iterates edges);
        // the double bond IS the alkene edge. edge.sourceId/targetId give the
        // legacy [source, target] atom order regardless of SMARTS-match order.
        const nb = (adjacency.get(cIds[0]) || []).find(
          (n) => n.vertex.id === cIds[1] && n.edge.bondType === "=",
        );
        if (!nb) return null;
        const edge = nb.edge;
        // (i) aromatic exclusion — defensive re-check of the legacy gate.
        if (edge.isPartOfAromaticRing) return null;
        // (iii) skip iff BOTH ends already claimed (&&, not ||).
        if (claimed.has(edge.sourceId) && claimed.has(edge.targetId)) return null;
        return { name: "alkene", shortName: "alkene", shorthand: "C=C", atoms: [edge.sourceId, edge.targetId] };
      },
    },
    {
      id: "alkyne",
      smarts: "C#C",
      name: null, shortName: null, shorthand: null,
      refine: function (matchAtoms, ctx) {
        const vertices = ctx.vertices, adjacency = ctx.adjacency, claimed = ctx.claimed;
        const el = (v) => (v && v.value && v.value.element) || "";
        const cIds = matchAtoms.filter((id) => {
          const v = vertices.find((x) => x.id === id);
          return v && el(v) === "C";
        });
        if (cIds.length < 2) return null;
        const nb = (adjacency.get(cIds[0]) || []).find(
          (n) => n.vertex.id === cIds[1] && n.edge.bondType === "#",
        );
        if (!nb) return null;
        const edge = nb.edge;
        if (edge.isPartOfAromaticRing) return null;
        if (claimed.has(edge.sourceId) && claimed.has(edge.targetId)) return null;
        return { name: "alkyne", shortName: "alkyne", shorthand: "C≡C", atoms: [edge.sourceId, edge.targetId] };
      },
    },
    // --- end batch 6 ---
  ];

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
   * Phase 17-5b: do a ring's two heteroatoms sit at adjacent ring positions?
   *
   * Distinguishes the 1,2- from the 1,3-isomer of a two-heteroatom five-ring,
   * which the size/aromaticity/multiset predicates below cannot: pyrazole and
   * imidazole share a heteroatom multiset and differ only in placement, as do
   * isothiazole/thiazole and isoxazole/oxazole. Positions come from the ordered
   * ring walk the classifier already retains, so no extra graph data is needed.
   *
   * Fail-soft: returns null rather than throwing whenever the question does not
   * apply (missing data, or a heteroatom count other than two), so a caller
   * matching on `=== true` / `=== false` falls through to its generic arm.
   *
   * @param {number[]} memberVertexIds - Ordered ring-traversal vertex ids
   * @param {Object} graphData - { graph, rings } from _extractGraphFromDrawer
   * @returns {boolean|null} true if adjacent (1,2), false if separated (1,3+),
   *   null if the ring does not hold exactly two heteroatoms
   * @private
   */
  function _areRingHeteroatomsAdjacent(memberVertexIds, graphData) {
    if (!Array.isArray(memberVertexIds) || !graphData?.graph?.vertices) return null;

    // Ring positions of the non-carbon members, in traversal order. Same
    // element lookup as _classifyRing's heteroatom loop, which is unchanged.
    const heteroIndices = [];
    for (let i = 0; i < memberVertexIds.length; i++) {
      const vertex = graphData.graph.vertices.find(v => v.id === memberVertexIds[i]);
      const element = vertex?.value?.element;
      if (element && element !== "C") heteroIndices.push(i);
    }
    if (heteroIndices.length !== 2) return null;

    // Cyclic index distance, as _detectSubstitutionPattern computes it.
    const raw = Math.abs(heteroIndices[1] - heteroIndices[0]);
    const dist = Math.min(raw, memberVertexIds.length - raw);
    return dist === 1;
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

    // Phase 17-5b: where the heteroatoms sit, for the two-heteroatom five-ring
    // arms below. null unless the ring holds exactly two, so an arm testing
    // `=== true` / `=== false` is skipped rather than matched on bad input.
    const heteroAdjacent = _areRingHeteroatomsAdjacent(memberIds, graphData);

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
    // Phase 17-5b (KD-26): the two-heteroatom five-rings are distinguished by
    // heteroatom PLACEMENT, not multiset — so each arm below tests adjacency.
    // 1,2 → pyrazole; 1,3 → imidazole. The pre-17-5b predicate was
    // adjacency-blind and named every two-N five-ring "imidazole", so pyrazole
    // was confidently mis-named at all three tiers.
    } else if (
      size === 5 && aromatic && heteroatoms.length === 2 &&
      heteroatoms.every(h => h === "N") && heteroAdjacent === true
    ) {
      type = "pyrazole";
    } else if (
      size === 5 && aromatic && heteroatoms.length === 2 &&
      heteroatoms.every(h => h === "N") && heteroAdjacent === false
    ) {
      type = "imidazole";
    // The mixed-pair arms admit the 1,3-isomers ONLY. Their 1,2-siblings —
    // isothiazole and isoxazole — deliberately match no arm and fall through to
    // the generic size noun: vague-but-true prose beats a confident wrong name.
    } else if (
      size === 5 && aromatic && heteroatoms.length === 2 &&
      heteroatoms.includes("N") && heteroatoms.includes("S") && heteroAdjacent === false
    ) {
      type = "thiazole";
    } else if (
      size === 5 && aromatic && heteroatoms.length === 2 &&
      heteroatoms.includes("N") && heteroatoms.includes("O") && heteroAdjacent === false
    ) {
      type = "oxazole";
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

    // 4.5 Sulphoxides — Phase 15-2c (LOCK 2 + R2). S with EXACTLY ONE =O
    // and exactly two single-bonded C neighbours; non-ring. R2 precision:
    // =O count must be exactly 1 (rejects sulphone, which has 2). Element
    // disjoint from ketone/aldehyde Pass 5/6 (S, not C) — no cross-claim.
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "S" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length !== 3) continue;
      const doubleOs = neighbours.filter(
        n => elem(n.vertex) === "O" && n.edge.bondType === "=" && !claimed.has(n.vertex.id),
      );
      if (doubleOs.length !== 1) continue; // R2: rejects sulphone (=O count 2)
      const singleCs = neighbours.filter(
        n => elem(n.vertex) === "C" && n.edge.bondType === "-" && !claimed.has(n.vertex.id),
      );
      if (singleCs.length !== 2) continue;
      const oVertex = doubleOs[0].vertex;
      const atoms = [v.id, oVertex.id];
      atoms.forEach(a => claimed.add(a));
      groups.push({
        name: "sulphoxide group",
        shortName: "sulphoxide",
        shorthand: "S=O",
        atoms,
        attachmentVertexId: findRingAttachment(atoms),
      });
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

    // 7.5 Thiols — Phase 15-2c (LOCK 2). Terminal -SH: S with degree 1,
    // bracket hcount=1, neighbour C via single bond. Parallel to hydroxyl
    // in shape (terminal heteroatom + 1 H), element-disjoint by S.
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "S" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length !== 1) continue;
      const n0 = neighbours[0];
      if (n0.edge.bondType !== "-" || elem(n0.vertex) !== "C") continue;
      const hcount = v.value?.bracket?.hcount;
      if (hcount !== 1) continue; // distinguishes from sulphide/disulphide
      const atoms = [v.id];
      claimed.add(v.id);
      groups.push({
        name: "thiol group",
        shortName: "thiol",
        shorthand: "–SH",
        atoms,
        attachmentVertexId: findRingAttachment(atoms),
      });
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

    // 8.5 Acyclic ethers — Phase 15-2c (LOCK 2). Non-ring O with degree 2,
    // both neighbours C via single bonds. Ester O (Pass 2) and methoxy O
    // (Pass 8) are already claimed, so this fires only on the residual
    // acyclic R-O-R' case (e.g. diethyl ether).
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "O" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length !== 2) continue;
      const singleCs = neighbours.filter(
        n => elem(n.vertex) === "C" && n.edge.bondType === "-",
      );
      if (singleCs.length !== 2) continue;
      const atoms = [v.id];
      claimed.add(v.id);
      groups.push({
        name: "ether",
        shortName: "ether",
        shorthand: null, // no compact glyph per findings § 7
        atoms,
        attachmentVertexId: findRingAttachment(atoms),
      });
    }

    // 9. Amines — N, non-ring, all neighbour edges single-bonded.
    // Phase 15-2c (LOCK 3 + LOCK 4 + R1): rewritten from element-only to
    // bond-order-aware + topology-aware. Excludes nitrile [NX1] (any # edge)
    // and imine [NX2] (any = edge) by construction (KD-8 fix-by-construction
    // per findings § 3.5). Emits subtype-tagged objects so prose can render
    // primary/secondary/tertiary + correct H-glyph (KD-3 fix surface).
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "N" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      // All neighbour edges must be single bonds — rules out nitrile, imine,
      // enamine (tier-1 boundary per R1: imine/enamine not in corpus yet).
      if (!neighbours.every(n => n.edge.bondType === "-")) continue;
      const heavyDegree = neighbours.length;
      if (heavyDegree < 1 || heavyDegree > 3) continue;
      // H-count: prefer translator-supplied bracket.hcount, fall back to
      // (3 − heavyDegree) for neutral trivalent N (per LOCK 3 R1 — both
      // sources agree for tier-1 amines).
      const hcount = v.value?.bracket?.hcount ?? (3 - heavyDegree);
      const subtype = heavyDegree; // 1 / 2 / 3 — also equal to (3 - hcount)
      // Shorthand parametrised on subtype: 1° -NH₂, 2° -NH-, 3° no glyph.
      const shorthandForSubtype =
        subtype === 1 ? "–NH₂" : subtype === 2 ? "–NH–" : null;
      const nSubstituents = neighbours.map(n => n.vertex.id);
      const atoms = [v.id];
      claimed.add(v.id);
      groups.push({
        name: "amine",
        shortName: "amine",
        shorthand: shorthandForSubtype,
        atoms,
        attachmentVertexId: findRingAttachment(atoms),
        // Phase 15-2c subtype payload — consumed by prose layer at Commit C.
        subtype,
        nSubstituents,
        nHydrogenCount: hcount,
      });
    }

    // 9.5 Imines — Phase 16-3 (KD-9). Additive pass: claims the residual
    // non-ring N that the amine pass (Pass 9) rejects by construction — a
    // heavy-degree-1 N whose sole edge is a double bond to an sp² (CX3)
    // carbon, i.e. [NX2;!R]=[CX3]. Degree-1 is the load-bearing guard: ring
    // C=N nitrogens (e.g. paraxanthine's surviving Kekulé C=N, heavy-degree
    // 2) are rejected. !inRing is defence-in-depth + parity with the amine
    // pass (functionally redundant on this corpus). The `claimed` guard makes
    // this strictly additive — Pass 9 already claimed the two amine N's, so
    // this re-claims nothing and adds only the previously-unclaimed =N. See
    // phase16-3-investigation-findings.md §§ 2-3 (over-claim probe: guanidine
    // is the sole match across all 20 migration fixtures).
    for (const v of vertices) {
      if (claimed.has(v.id) || elem(v) !== "N" || inRing(v)) continue;
      const neighbours = adjacency.get(v.id) || [];
      if (neighbours.length !== 1) continue; // heavy-degree 1
      const n0 = neighbours[0];
      if (n0.edge.bondType !== "=" || elem(n0.vertex) !== "C") continue;
      // C-side CX3: the imine carbon is sp² with heavy-atom degree 3.
      const cNeighbours = adjacency.get(n0.vertex.id) || [];
      if (cNeighbours.length !== 3) continue;
      const atoms = [v.id];
      claimed.add(v.id);
      groups.push({
        name: "imine",
        shortName: "imine",
        shorthand: "=N–",
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

    // 13 (Phase 10-3 — CT-4e-alkyl). Simple-alkyl ring substituents — runs LAST
    // on the residual `claimed` Set. Phase 17-3a: extracted to the module-level
    // _detectAlkylRingSubstituents so the SMARTS catalogue (runCatalogue) can
    // invoke the same genuinely-not-SMARTS pass; the classification-gate
    // documentation now lives in that helper's JSDoc. Same last position, same
    // shared `claimed` Set the passes above populated.
    groups.push(..._detectAlkylRingSubstituents(vertices, adjacency, claimed));

    return groups;
  }

  /**
   * Phase 17-3a: alkyl ring-substituent walker (legacy pass 13 / detector #18,
   * class (c) — the one genuinely not-SMARTS pass). Extracted verbatim from
   * _detectFunctionalGroupsFromGraph so both the legacy detector and the SMARTS
   * catalogue (runCatalogue) invoke the same pass. Surfaces bare alkyl branches
   * (methyl, ethyl, …) attached to ring atoms so the standard and short tiers
   * can report substituent counts rather than silently dropping them —
   * caffeine's three N-methyls and theobromine's two N-methyls never reached
   * either tier before.
   *
   * Runs LAST so any atom already claimed by a specific functional group is
   * never misclassified as a plain alkyl. Classification gates:
   *   • branch root is NOT in `claimed` (so methyls inside an ester, amide,
   *     etc. stay with those groups)
   *   • attachment bond and every subsequent walk bond is a single bond
   *     (rules out vinyl / allyl / alkynyl)
   *   • every atom along the branch is carbon (rules out methoxy etc.)
   *   • the branch has no sub-branches (rules out isopropyl / tert-butyl)
   *   • length within ALKYL_NAMES range (methyl–octyl); longer chains stay
   *     labelled generically by the comprehensive tier's existing walk
   *
   * The attachment atom's element drives the shortName: "methyl" on a ring
   * carbon, "N-methyl" on a ring nitrogen, etc. This preserves the semantic
   * signal a chemist would want ("three N-methyls" ≠ "three C-methyls") while
   * still letting the downstream collapse logic count them together.
   *
   * DUAL EFFECT (preserved from the inline block): returns the walker records
   * AND mutates the shared `claimed` Set passed in — it consumes `claimed`
   * mid-walk (skip-if-claimed gates) and adds each chain atom before emitting.
   * `atoms` is ROOT-FIRST walk order (chainAtoms.slice()), NOT sorted; this is
   * load-bearing for the equivalence comparator's order-sensitive atoms check.
   *
   * NOTE: this is NOT _walkAlkylSubstituent (the Phase 15-2c LOCK-5 tier-1
   * substituent prose namer) — a different, separately-consumed helper.
   *
   * @param {Array} vertices - graphData.graph.vertices
   * @param {Map} adjacency - adjacency map from _buildAdjacencyMap()
   * @param {Set<number>} claimed - shared claimed-atoms Set (consumed AND mutated)
   * @returns {Object[]} walker records { name, shortName, shorthand, atoms, attachmentVertexId }
   * @private
   */
  function _detectAlkylRingSubstituents(vertices, adjacency, claimed) {
    const groups = [];

    /** Check if a vertex is in any ring */
    function inRing(v) {
      return v.value?.rings?.length > 0;
    }
    /** Get element symbol for a vertex */
    function elem(v) {
      return v.value?.element || "";
    }

    const ringMembers = new Set();
    for (const v of vertices) {
      if (inRing(v)) ringMembers.add(v.id);
    }
    if (ringMembers.size === 0) return groups;

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
    return groups;
  }

  /**
   * Phase 17-2a: standalone ring-attachment finder for the SMARTS-catalogue
   * runner. Byte-identical in behaviour to the `findRingAttachment` closure
   * inside _detectFunctionalGroupsFromGraph — for each atom in the group,
   * return the first neighbour that is a ring member and not itself part of
   * the group, else null. Reproduced (not shared) because the original is a
   * private closure over `adjacency`/`inRing`; the equivalence harness
   * (window.testCatalogueEquivalence) proves the two stay in lockstep.
   *
   * @param {number[]} atomIds
   * @param {Map} adjacency
   * @returns {number|null}
   * @private
   */
  function _catalogueFindRingAttachment(atomIds, adjacency) {
    for (const id of atomIds) {
      const neighbours = adjacency.get(id) || [];
      for (const n of neighbours) {
        const isRing = (n.vertex.value?.rings?.length || 0) > 0;
        if (isRing && !atomIds.includes(n.vertex.id)) {
          return n.vertex.id;
        }
      }
    }
    return null;
  }

  /**
   * Phase 17-2a/2b: SMARTS-catalogue functional-group runner (LIVE since 17-3b).
   *
   * Matches every FUNCTIONAL_GROUPS row against the molecule and reconstructs
   * the legacy group records they correspond to. Class-(a) rows (batch 1) are
   * pure-SMARTS, atoms-exact; class-(b) rows (batch 2: the S-cluster) carry a
   * `refine` hook that reproduces the legacy graph-predicate and returns the
   * legacy record (or null to reject). Called from analyseStructure since the
   * Phase 17-3b switchover — this is the live functional-group detector. The
   * legacy _detectFunctionalGroupsFromGraph is retained (never deleted) as the
   * one-line rollback anchor and the empty-result fallback; the equivalence
   * harness (window.testCatalogueEquivalence) still compares the two.
   *
   * Q1 index alignment (findings § 2 / § 4): matchSmarts MUST run on the same
   * canonical SMILES the cached graph was extracted from, else the returned
   * atom indices reference a different basis than graphData's vertex ids.
   * graphData._smiles is that canonical string (the get_smiles path on the
   * pinned RDKit build); the runner threads it. The raw `smiles` arg is a
   * defensive fallback only (logged if used) — present so the signature reads
   * runCatalogue(smiles, graphData, adjacency) per the dispatch.
   *
   * Claiming: a shared `claimed` Set, with rows processed in FUNCTIONAL_GROUPS
   * order, reproduces the legacy passes' relative claiming for these six (acid
   * before hydroxyl). A match any of whose atoms are already claimed is skipped
   * — equivalent to the legacy per-atom `!claimed` guard for this batch, where
   * each row claims exactly the atoms it matches.
   *
   * The whole catalogue's patterns go to matchSmarts in ONE call, so the mol is
   * parsed once per structure (no cache — caching is 17-3).
   *
   * @param {string} smiles - fallback SMILES (graphData._smiles is preferred).
   * @param {Object} graphData - cached graph ({ graph, _smiles, ... }).
   * @param {Map} adjacency - from _buildAdjacencyMap(graphData.graph).
   * @returns {Object[]} group records matching the legacy detector's shape.
   */
  function runCatalogue(smiles, graphData, adjacency) {
    const groups = [];
    if (!graphData || !graphData.graph) {
      logWarn("runCatalogue: missing graphData.graph");
      return groups;
    }
    const canonicalSmiles = graphData._smiles || smiles;
    if (!canonicalSmiles) {
      logWarn("runCatalogue: no SMILES available (graphData._smiles absent and no fallback arg)");
      return groups;
    }
    if (!graphData._smiles) {
      logWarn("runCatalogue: graphData._smiles absent — using raw arg; atom indices may diverge from the cached graph");
    }
    if (typeof utils.matchSmarts !== "function") {
      logError("runCatalogue: MathPixChemistryUtils.matchSmarts unavailable — check load order");
      return groups;
    }

    const vertices = graphData.graph.vertices;
    const patterns = FUNCTIONAL_GROUPS.map(r => r.smarts);
    const matchMap = utils.matchSmarts(canonicalSmiles, patterns);
    if (!matchMap) {
      logWarn("runCatalogue: matchSmarts returned null (invalid SMILES)", { canonicalSmiles });
      return groups;
    }

    const claimed = new Set();
    for (const row of FUNCTIONAL_GROUPS) {
      const matches = matchMap[row.smarts] || [];
      for (const atomIdxs of matches) {
        if (!Array.isArray(atomIdxs) || atomIdxs.length === 0) continue;

        // Class (b): SMARTS narrows candidate atoms; refine reproduces the
        // legacy predicate (confirm / subtype / reject) and returns the legacy
        // record (atoms = legacy-ordered claim-subset) or null. The !claimed
        // guards live INSIDE refine (mirroring the legacy per-atom checks), so
        // the generic full-match claim-guard below is skipped for these rows —
        // a refine row claims only the subset it returns (e.g. sulphoxide
        // claims [S, =O], leaving its carbons free for downstream passes).
        if (typeof row.refine === "function") {
          const rec = row.refine(atomIdxs, { vertices, adjacency, claimed });
          if (!rec) continue;
          rec.atoms.forEach(a => claimed.add(a));
          // Phase 17-2c contract widening (additive — the landed S-cluster rows
          // return neither field, so their emitted record stays byte-identical):
          //   • honour a refine-supplied attachmentVertexId — the ring-internal
          //     urea/lactam rows set it to the ring carbon itself (= atoms[0]),
          //     which the generic _catalogueFindRingAttachment would NOT return
          //     (it returns the first flanking ring neighbour). Guard on
          //     `!= null` so a legitimate id of 0 is honoured, not treated falsy.
          //   • copy a refine-supplied `flanking` array (urea/lactam only) so
          //     the prose-consumed flanking[].element survives the catalogue
          //     path; absent on every other row (key simply not added).
          const emitted = {
            name: rec.name,
            shortName: rec.shortName,
            shorthand: rec.shorthand,
            atoms: rec.atoms.slice(),
            attachmentVertexId:
              rec.attachmentVertexId !== undefined && rec.attachmentVertexId !== null
                ? rec.attachmentVertexId
                : _catalogueFindRingAttachment(rec.atoms, adjacency),
          };
          if (rec.flanking !== undefined) emitted.flanking = rec.flanking;
          // Phase 17-2e contract widening (additive — landed rows return none of
          // these, so the guards leave their emitted record byte-identical). The
          // amine (pass 9) subtype payload: `subtype` (1|2|3, never 0),
          // `nSubstituents` (an array of neighbour vertex ids), and
          // `nHydrogenCount`. The nHydrogenCount guard MUST be `!== undefined`
          // (never a truthy check): a tertiary amine has a legitimate
          // nHydrogenCount === 0 that a falsy guard would silently drop (L32
          // valid-zero nuance). subtype/nSubstituents use the same guard for
          // consistency. Key order (name…attachmentVertexId, subtype,
          // nSubstituents, nHydrogenCount) matches the legacy amine record, so
          // the runner's whole-object JSON.stringify cross-checks stay equal.
          if (rec.subtype !== undefined) emitted.subtype = rec.subtype;
          if (rec.nSubstituents !== undefined) emitted.nSubstituents = rec.nSubstituents;
          if (rec.nHydrogenCount !== undefined) emitted.nHydrogenCount = rec.nHydrogenCount;
          groups.push(emitted);
          continue;
        }

        // Class (a): pure-SMARTS, atoms-exact (batch 1).
        if (atomIdxs.some(a => claimed.has(a))) continue;
        atomIdxs.forEach(a => claimed.add(a));
        let shorthand = row.shorthand;
        if (row.id === "halogen") {
          const v = vertices.find(x => x.id === atomIdxs[0]);
          shorthand = "–" + (v?.value?.element || "");
        }
        groups.push({
          name: row.name,
          shortName: row.shortName,
          shorthand,
          atoms: atomIdxs.slice(),
          attachmentVertexId: _catalogueFindRingAttachment(atomIdxs, adjacency),
        });
      }
    }

    // Phase 17-3a: the final imperative step — the class-(c) alkyl ring-
    // substituent walker, appended after the 18 SMARTS/refine rows against the
    // fully-populated `claimed` Set (mirroring the legacy detector's last
    // position). This makes the catalogue self-complete: runCatalogue now
    // reproduces every legacy _detectFunctionalGroupsFromGraph output. Still
    // dead code — analyseStructure consumes the legacy detector (the switchover
    // is 17-3b).
    groups.push(..._detectAlkylRingSubstituents(vertices, adjacency, claimed));

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
  //   _countExocyclicCarbonyls, _hasFusionAdjacentFiveRingNitrogen,
  //   _classifySixRingNitrogenPosition, _identifyTricyclicSystemName,
  //   _identifyFusedSystemName, _identifyPyrimidinePattern,
  //   _identifyPyridinonePattern, _selectNamedSystemLabel
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
   * Phase 17 (KD-13): teaching-facing ring aromaticity. Returns true when the
   * ring is perceived aromatic AND carries fewer than two exocyclic ring
   * carbonyls. This is a NARROWING of the perceived flag: it can only ever
   * withhold the "aromatic" claim, never grant it — a ring RDKit does not
   * perceive aromatic returns false here too.
   *
   * Basis (not conclusion): in the pyrimidine-2,4-/2,6-diones two ring carbons
   * are carbonyl carbons contributing no pi-electron to a ring sextet, so the
   * ring reads as a cyclic diamide (bis-lactam) whose nitrogen lone pairs
   * delocalise into the adjacent carbonyls rather than around the ring — by
   * standard undergraduate teaching, not aromatic. The two-carbonyl threshold
   * is what makes the narrowing safe: the witnesses either side of it are
   * cytosine and 2-pyridone (one ring carbonyl → still taught-aromatic) and
   * uracil (two ring carbonyls → taught-non-aromatic).
   *
   * `ring.aromatic` (RDKit's perception) is deliberately NOT changed by this
   * predicate; every classification gate keeps reading it. Only the description
   * tiers consume this teaching-facing view. See the JSDoc correction on
   * _identifyPyrimidinePattern below and KD-13 in the defects ledger.
   *
   * The input guards fail closed — a missing ring.memberVertexIds, graphData or
   * adjacency returns false (claim withheld) rather than letting the carbonyl
   * count default to zero and silently re-assert aromaticity, because a false
   * aromatic claim is worse than a withheld one.
   *
   * @param {Object} ring - classified ring with memberVertexIds
   * @param {Object} graphData - { graph, rings }
   * @param {Map} adjacency - from _buildAdjacencyMap
   * @returns {boolean} true when the ring is aromatic for teaching purposes
   * @private
   */
  function _isTaughtAromatic(ring, graphData, adjacency) {
    if (!ring || ring.aromatic !== true) return false;
    if (!ring.memberVertexIds || !graphData || !adjacency) return false;
    return _countExocyclicCarbonyls(ring, graphData, adjacency) < 2;
  }

  /**
   * Phase 17-5c (KD-27): is the five-ring's nitrogen bonded to a fusion-edge
   * atom? This is what separates indole from isoindole. The two are identical
   * on every test the fused detector previously applied — two aromatic rings,
   * sizes 5 and 6, exactly one nitrogen — and their perceived `memberVertexIds`
   * are identical as well (measured: six-ring [0,8,7,3,2,1], five-ring
   * [4,3,7,6,5], shared edge {3,7} for both), so the discriminator can only
   * come from the graph.
   *
   * In indole the nitrogen is N1, directly bonded to the fusion-edge carbon
   * C7a. In isoindole it is N2, flanked by two carbons and bonded to neither
   * shared atom. Adjacent to a shared vertex → indole; otherwise not indole.
   *
   * Fail-soft by design: every unresolvable input returns false, so the caller
   * withholds the name rather than emitting one on unverified position. A
   * confident wrong molecule identity is a worse outcome for a blind reader
   * than a generic-but-true description.
   *
   * A nitrogen sitting ON the fusion edge (indolizine's bridgehead) is excluded
   * from selection, so it cannot satisfy the test as its own neighbour. That
   * case does not reach here today — the caller's heteroatom concatenation
   * double-counts a bridgehead atom, giving `heteros.length === 2` — but the
   * exclusion is stated here rather than inherited, so indolizine's measured
   * no-name outcome does not depend on a guard in a different expression.
   *
   * @param {Object[]} rings - the two classified fused rings (sizes 5 and 6)
   * @param {Object} [graphData] - { graph, rings }
   * @param {Map} [adjacency] - from _buildAdjacencyMap
   * @returns {boolean} true only when the position is resolved AND adjacent
   * @private
   */
  function _hasFusionAdjacentFiveRingNitrogen(rings, graphData, adjacency) {
    if (!graphData?.graph?.vertices || !adjacency) return false;

    const fiveRing = rings.find(r => r.size === 5);
    const sixRing = rings.find(r => r.size === 6);
    if (!fiveRing?.memberVertexIds || !sixRing?.memberVertexIds) return false;

    // Shared edge by set-intersection of memberVertexIds — the idiom already
    // used by _findBridgeIds in mathpix-chemistry-locants.js.
    const sixSet = new Set(sixRing.memberVertexIds);
    const sharedSet = new Set(fiveRing.memberVertexIds.filter(id => sixSet.has(id)));
    if (sharedSet.size === 0) return false;

    // The five-ring's nitrogen, excluding any that is itself a fusion-edge atom.
    const nitrogenIds = fiveRing.memberVertexIds.filter(id => {
      if (sharedSet.has(id)) return false;
      const vertex = graphData.graph.vertices.find(v => v.id === id);
      return (vertex?.value?.element || "") === "N";
    });
    if (nitrogenIds.length !== 1) return false;

    const neighbours = adjacency.get(nitrogenIds[0]) || [];
    return neighbours.some(n => sharedSet.has(n.vertex.id));
  }

  /**
   * Phase 17-3a (KD-31): the positional classes a single ring nitrogen can
   * occupy in an aromatic 6+6 fused system, named rather than left as bare
   * strings so the dispatch below cannot turn a typo into a silent decline.
   * UNRESOLVED is the fail-soft outcome, not a position.
   */
  const SIX_RING_NITROGEN_CLASS = Object.freeze({
    UNRESOLVED: "unresolved",
    BRIDGEHEAD: "bridgehead",
    ADJACENT: "adjacent",
    REMOTE: "remote",
  });

  /**
   * Phase 17-3a (KD-31): where does the ring nitrogen of an aromatic 6+6 fused
   * system sit, relative to the fusion edge? This is what separates quinoline
   * from isoquinoline. The two are identical on every test the fused detector
   * previously applied — two aromatic rings, both size 6, exactly one nitrogen —
   * and their perceived `memberVertexIds` are identical as well (measured:
   * [0,9,8,3,2,1] and [4,5,6,7,8,3], shared edge {8,3} for both), so the
   * discriminator can only come from the graph.
   *
   * This is the SIX-ring sibling of _hasFusionAdjacentFiveRingNitrogen, not an
   * extension of it: that helper selects `rings.find(r => r.size === 5)` and
   * short-circuits when there is none, so calling it from a 6+6 arm would
   * decline quinoline as well as isoquinoline. It is left untouched, and the
   * general part of its shape — shared edge by set-intersection, exactly-one-
   * nitrogen guard, neighbour test against the shared set, fail-soft posture —
   * is mirrored here rather than parameterised, so sealed 17-5c behaviour stays
   * off this unit's regression surface.
   *
   * Two differences from the five-ring helper are deliberate. Neither ring is
   * privileged, because in a 6+6 system there is no smaller ring to search; and
   * a nitrogen ON the fusion edge is CLASSIFIED (BRIDGEHEAD) rather than
   * excluded from selection, because a bridgehead nitrogen means the system is
   * neither isomer — a quinolizinium-type skeleton — and the caller must decline
   * the name rather than pick one. That case does not reach here through the
   * current caller: its heteroatom concatenation double-counts a bridgehead
   * atom, giving `heteros.length === 2`, so the arm's own guard filters it out
   * first. The class is stated here rather than inherited from that accident,
   * so the refusal does not depend on a guard in a different expression.
   *
   * Fail-soft by design: every unresolvable input returns UNRESOLVED and the
   * caller withholds the name, exactly as the five-ring helper's `false` does.
   * A confident wrong molecule identity is a worse outcome for a blind reader
   * than a generic-but-true description — which is the whole of KD-31.
   *
   * @param {Object[]} rings - the two classified fused rings (both size 6)
   * @param {Object} [graphData] - { graph, rings }
   * @param {Map} [adjacency] - from _buildAdjacencyMap
   * @returns {string} one of SIX_RING_NITROGEN_CLASS
   * @private
   */
  function _classifySixRingNitrogenPosition(rings, graphData, adjacency) {
    if (!graphData?.graph?.vertices || !adjacency) return SIX_RING_NITROGEN_CLASS.UNRESOLVED;

    const [ringA, ringB] = rings;
    if (!ringA?.memberVertexIds || !ringB?.memberVertexIds) return SIX_RING_NITROGEN_CLASS.UNRESOLVED;

    // Shared edge by set-intersection of memberVertexIds — the idiom already
    // used by _findBridgeIds in mathpix-chemistry-locants.js.
    const ringBSet = new Set(ringB.memberVertexIds);
    const sharedSet = new Set(ringA.memberVertexIds.filter(id => ringBSet.has(id)));
    if (sharedSet.size === 0) return SIX_RING_NITROGEN_CLASS.UNRESOLVED;

    // The system's ring nitrogen, across both rings. De-duplicated, so a
    // bridgehead atom counts once here however the caller counted it.
    const memberIds = [...new Set([...ringA.memberVertexIds, ...ringB.memberVertexIds])];
    const nitrogenIds = memberIds.filter(id => {
      const vertex = graphData.graph.vertices.find(v => v.id === id);
      return (vertex?.value?.element || "") === "N";
    });
    if (nitrogenIds.length !== 1) return SIX_RING_NITROGEN_CLASS.UNRESOLVED;

    const nitrogenId = nitrogenIds[0];
    if (sharedSet.has(nitrogenId)) return SIX_RING_NITROGEN_CLASS.BRIDGEHEAD;

    const neighbours = adjacency.get(nitrogenId) || [];
    const nitrogenClass = neighbours.some(n => sharedSet.has(n.vertex.id))
      ? SIX_RING_NITROGEN_CLASS.ADJACENT
      : SIX_RING_NITROGEN_CLASS.REMOTE;

    logDebug("_classifySixRingNitrogenPosition: resolved", {
      nitrogenId,
      sharedIds: [...sharedSet],
      nitrogenClass,
    });

    return nitrogenClass;
  }

  /**
   * Phase 17-s3b: identify a named THREE-ring fused system — anthracene,
   * phenanthrene or carbazole. A sibling of _identifyFusedSystemName, which
   * hard-gated on exactly two rings and so left every tricyclic on the
   * true-but-unspecific generic prose at all three tiers.
   *
   * Two design rulings shape this helper, and both are load-bearing.
   *
   * FIRST — anthracene and phenanthrene are told apart by BOND ADJACENCY, never
   * by member-order index distance. They are identical on every other test this
   * file can apply: three aromatic six-membered rings, no heteroatom, fourteen
   * ring atoms. They differ only in whether the central ring's two fusion edges
   * are contiguous (angular → phenanthrene) or separated by one CH on each side
   * (linear → anthracene). The index gap between edge atoms in
   * `memberVertexIds` would answer that too, and is deliberately NOT read: that
   * intra-ring ordering is inherited from RDKit's
   * `extensions.rdkitRepresentation.atomRings` with no stated contract — copied
   * by `.slice()`, never walked, never sorted, and asserted cyclic only in our
   * own comments. No measurement has ever contradicted it, so it is a latent
   * dependency rather than a defect; but no NEW code should rest on it, so this
   * helper reads only set intersections and the adjacency map.
   *
   * SECOND — carbazole is named here rather than through the sealed 5+6
   * machinery. No call site anywhere constructs or passes a sub-pair of rings,
   * so feeding _hasFusionAdjacentFiveRingNitrogen a two-ring slice would be new
   * plumbing for no reach. That helper and _classifySixRingNitrogenPosition are
   * neither edited nor called from here, which keeps sealed 17-5c and 17-3a
   * behaviour off this unit's regression surface.
   *
   * Fail-soft by design: every unresolvable topology, census or position returns
   * null and the caller falls through to the generic fused prose. A confident
   * wrong molecule identity is the KD-26/27/31 class and the catastrophic
   * failure for a blind reader — vaguer-and-true beats specific-and-wrong.
   *
   * @param {Object[]} rings - the three classified fused rings
   * @param {Object} [graphData] - { graph, rings }
   * @param {Map} [adjacency] - from _buildAdjacencyMap
   * @returns {string|null} "anthracene" | "phenanthrene" | "carbazole" | null
   * @private
   */
  function _identifyTricyclicSystemName(rings, graphData, adjacency) {
    if (!Array.isArray(rings) || rings.length !== 3) return null;
    if (!graphData?.graph?.vertices || !adjacency) return null;
    if (!rings.every(r => Array.isArray(r?.memberVertexIds) && r.aromatic === true)) return null;

    // Pairwise shared sets by set-intersection of memberVertexIds — the idiom
    // already used by _findBridgeIds in mathpix-chemistry-locants.js, and by
    // both sealed positional helpers above.
    const RING_PAIRS = [[0, 1], [0, 2], [1, 2]];
    const sharedSets = RING_PAIRS.map(([a, b]) => {
      const bSet = new Set(rings[b].memberVertexIds);
      return new Set(rings[a].memberVertexIds.filter(id => bSet.has(id)));
    });

    // Topology gate: exactly two pairs fused across exactly two atoms, and the
    // third pair disjoint. A shared count of 1 (spiro), 3 or more (bridged),
    // three fused pairs, or fewer than two fusions is not a chain of three
    // edge-fused rings, and declines.
    const fusedPairIndices = [];
    let disjointPairCount = 0;
    sharedSets.forEach((shared, i) => {
      if (shared.size === 2) fusedPairIndices.push(i);
      else if (shared.size === 0) disjointPairCount += 1;
    });
    if (fusedPairIndices.length !== 2 || disjointPairCount !== 1) return null;

    // The central ring is the one present in BOTH fused pairs; its two fusion
    // edges are those pairs' shared sets.
    const [firstFusedPair, secondFusedPair] = fusedPairIndices.map(i => RING_PAIRS[i]);
    const centralIndex = firstFusedPair.find(i => secondFusedPair.includes(i));
    if (centralIndex === undefined) return null;

    const edgeA = sharedSets[fusedPairIndices[0]];
    const edgeB = sharedSets[fusedPairIndices[1]];
    // Fusion edges sharing a vertex are an ortho- and peri-fused skeleton
    // (acenaphthylene-type), not the three edge-separated rings named here.
    if ([...edgeA].some(id => edgeB.has(id))) return null;

    const centralRing = rings[centralIndex];
    const outerRings = rings.filter((_, i) => i !== centralIndex);

    // Heteroatom census over the DE-DUPLICATED member union — never a
    // concatenation of the per-ring lists, which double-counts every fusion
    // atom (the trap on the record at 17-3a). An unresolvable member vertex
    // means the census cannot be trusted, so the helper declines rather than
    // reading a missing vertex as carbon.
    const memberIds = [...new Set(rings.flatMap(r => r.memberVertexIds))];
    const memberElements = new Map();
    for (const id of memberIds) {
      const element = graphData.graph.vertices.find(v => v.id === id)?.value?.element || "";
      if (element === "") return null;
      memberElements.set(id, element);
    }
    const heteroIds = memberIds.filter(id => memberElements.get(id) !== "C");

    // Arm 1 — the carbocyclic pair. Three six-rings, no heteroatom: the only
    // remaining question is whether the two fusion edges are bonded to one
    // another, read from the adjacency map rather than from member order.
    if (heteroIds.length === 0 && rings.every(r => r.size === 6)) {
      const edgesBonded = [...edgeA].some(id =>
        (adjacency.get(id) || []).some(n => edgeB.has(n.vertex.id)),
      );
      const carbocyclicName = edgesBonded ? "phenanthrene" : "anthracene";

      logDebug("_identifyTricyclicSystemName: resolved", {
        centralIndex,
        edgeA: [...edgeA],
        edgeB: [...edgeB],
        edgesBonded,
        name: carbocyclicName,
      });

      return carbocyclicName;
    }

    // Arm 2 — carbazole. A five-membered central ring between two six-rings,
    // one heteroatom in the whole system, and it is a nitrogen sitting in the
    // central ring off both fusion edges. Any other placement declines: a
    // bridgehead or outer-ring nitrogen is a different skeleton entirely.
    if (
      centralRing.size === 5 &&
      outerRings.every(r => r.size === 6) &&
      heteroIds.length === 1 &&
      memberElements.get(heteroIds[0]) === "N"
    ) {
      const nitrogenId = heteroIds[0];
      const nitrogenPlaced =
        centralRing.memberVertexIds.includes(nitrogenId) &&
        !edgeA.has(nitrogenId) &&
        !edgeB.has(nitrogenId);
      if (!nitrogenPlaced) return null;

      logDebug("_identifyTricyclicSystemName: resolved", {
        centralIndex,
        nitrogenId,
        edgeA: [...edgeA],
        edgeB: [...edgeB],
        name: "carbazole",
      });

      return "carbazole";
    }

    return null;
  }

  /**
   * Phase 10-4 (CT-4d-named): identify common named fused ring systems.
   * Returns the common name (e.g. "naphthalene", "indole", "quinoline",
   * "isoquinoline", "purine", "xanthine") or null. Xanthine = purine + two
   * exocyclic C=O on the six-ring (purine-2,6-dione), so `graphData` and
   * `adjacency` are required for that refinement — without them the xanthine
   * check is skipped and a purine skeleton still returns "purine".
   *
   * Phase 17-5c (KD-27): the indole arm now needs those two parameters as
   * well, to test WHERE the five-ring nitrogen sits rather than only how many
   * heteroatoms there are. Without them the arm cannot resolve the position
   * and declines the name — see _hasFusionAdjacentFiveRingNitrogen. Every
   * live caller passes both, so this is belt-and-braces rather than a
   * behaviour change for any path in use.
   *
   * Phase 17-3a (KD-31): the 6+6 one-nitrogen arm now needs them for the same
   * reason, one ring size up — see _classifySixRingNitrogenPosition. It gains a
   * name rather than losing one: quinoline and isoquinoline are told apart by
   * the nitrogen's position, so both are named, and a bridgehead nitrogen (a
   * quinolizinium-type system, neither isomer) declines to the generic fused
   * prose.
   *
   * Phase 17-s3b: three-ring systems are DELEGATED from the opening guard to
   * _identifyTricyclicSystemName, which names anthracene, phenanthrene and
   * carbazole. Two-ring behaviour below is byte-identical by construction, and
   * 0, 1 and 4-or-more rings still return null exactly as before.
   *
   * Relocated from mathpix-chemistry-comprehensive.js so both the standard
   * tier (`_assembleDescription`) and the comprehensive tier can call it
   * through the same primitive — previously only the comprehensive tier
   * invoked this helper, leaving the standard tier with the generic
   * "N-atom fused ring system" opener even when the name was known (G4).
   *
   * @param {Object[]} rings - classified rings
   * @param {Object} [graphData] - enables the xanthine refinement and the
   *   indole position test
   * @param {Map} [adjacency] - enables the xanthine refinement and the indole
   *   position test
   * @returns {string|null}
   * @private
   */
  function _identifyFusedSystemName(rings, graphData, adjacency) {
    if (!rings) return null;
    if (rings.length === 3) return _identifyTricyclicSystemName(rings, graphData, adjacency);
    if (rings.length !== 2) return null;
    const sizes = rings.map(r => r.size).sort();
    const aromatic = rings.every(r => r.aromatic);
    const heteros = [...rings[0].heteroatoms, ...rings[1].heteroatoms].sort();
    if (aromatic && sizes[0] === 6 && sizes[1] === 6 && heteros.length === 0) return "naphthalene";
    // Phase 17-5c (KD-27): the heteroatom count alone is not enough — isoindole
    // satisfies every other test in this arm identically. Only a fusion-edge-
    // adjacent five-ring nitrogen takes the name; anything else falls through
    // to the unnamed fused path below.
    if (aromatic && sizes[0] === 5 && sizes[1] === 6 && heteros.length === 1 && heteros[0] === "N" &&
        _hasFusionAdjacentFiveRingNitrogen(rings, graphData, adjacency)) return "indole";
    // Phase 17-3a (KD-31): the heteroatom count alone is not enough — isoquinoline
    // satisfies every other test in this arm identically, down to the same
    // memberVertexIds and the same shared edge. Only the nitrogen's position
    // against the fusion edge separates them, so the arm dispatches on it, and
    // only a RESOLVED position grants a name.
    if (aromatic && sizes[0] === 6 && sizes[1] === 6 && heteros.length === 1 && heteros[0] === "N") {
      const nitrogenClass = _classifySixRingNitrogenPosition(rings, graphData, adjacency);
      if (nitrogenClass === SIX_RING_NITROGEN_CLASS.ADJACENT) return "quinoline";
      if (nitrogenClass === SIX_RING_NITROGEN_CLASS.REMOTE) return "isoquinoline";
      return null;
    }
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
   * Phase 17 (KD-13) correction — the aromaticity aside above no longer holds
   * on its stated basis. It blessed SmilesDrawer's `isPartOfAromaticRing`
   * flag, but the engine moved to the RDKit translator at Phase 12-2a, so that
   * library no longer supplies the flag this pattern reads. RDKit's own default
   * aromaticity model ALSO perceives these dione six-rings aromatic (verified
   * per-fixture in phase17-kd13-investigation-findings.md § 1), which disagrees
   * with standard teaching: a pyrimidine-2,4-/2,6-dione is a cyclic diamide and
   * is taught non-aromatic. This gate nonetheless STILL reads `ring.aromatic`
   * deliberately — the pattern labels ("pyrimidine-2,4-dione" etc.) are
   * constitutionally correct regardless of aromaticity, and the locant tables
   * key off those labels, so the perceived flag is the right precondition here.
   * The teaching-facing aromaticity claim is carried separately by
   * `_isTaughtAromatic` (above), which only the description tiers consume; the
   * Phase 10-4 "strictly additive, no classification change" decision stands.
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
      // Phase 15-2b: expose chain atom set so _findPrincipalFGAnchor + prose
      // consumers (STD/SHORT/COMP via _orderChainAtoms + _chainLocantSuffix)
      // can resolve group-to-chain attachment without rebuilding the filter.
      _atomSet: new Set(carbonIds),
    };
  }

  /**
   * Classify the overall molecular scaffold from ring + group analysis.
   *
   * Phase 15-2c (LOCK 5 + R3): acyclic scaffolds may now resolve to two new
   * topology-only types parallel to the 15-1a `"joined-rings"` precedent —
   * `"central-heteroatom"` (a heteroatom bearing ≥2 carbon substituents,
   * zero C–C bonds — serves #10 DMSO / #13 dimethylamine / #14 trimethylamine)
   * and `"bridged-acyclic"` (two carbon substructures bridged by a non-ring
   * heteroatom — serves #11 diethyl ether). Types are element-agnostic at
   * the scaffold layer; prose dispatches on the FG (sulphoxide vs amine
   * subtype) for element-specific phrasing.
   *
   * R3 methylamine boundary: #12 methylamine has 1 C on N (amine subtype=1),
   * so `_hasCentralHeteroatomGroup` returns false → stays on `"chain"`.
   *
   * @param {Object[]} rings - Array from _classifyRing()
   * @param {Object[]} [groups] - functional groups from _detectFunctionalGroupsFromGraph();
   *   omitting the parameter (legacy callers) keeps the pre-15-2c behaviour
   *   intact since the new arms gate on group presence.
   * @returns {string} "aromatic-ring", "ring", "fused-rings", "joined-rings",
   *   "central-heteroatom", "bridged-acyclic", or "chain"
   * @private
   */
  function _classifyScaffold(rings, groups) {
    if (rings.length === 0) {
      // Phase 15-2c (LOCK 5): acyclic central-heteroatom + bridged-acyclic
      // arms checked BEFORE the chain fallback. Arms gate on FG presence,
      // so pre-15-2c chain fixtures (acetone, ethanol, urea, guanidine, …)
      // still resolve to "chain" — no behaviour change for any existing
      // migration fixture (all 20 verified at the Commit B gate).
      if (_hasCentralHeteroatomGroup(groups)) return "central-heteroatom";
      if (_hasBridgingGroup(groups)) return "bridged-acyclic";
      return "chain";
    }
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

  /**
   * Phase 15-2c (LOCK 5): central-heteroatom predicate. Matches sulphoxide
   * (S centre with 2 -C neighbours by Pass 4.5 construction) and amine with
   * subtype ≥ 2 (N centre with 2-or-3 -C neighbours — R3 boundary excludes
   * subtype 1 / methylamine). Defensive against undefined `groups`.
   *
   * @param {Object[]} [groups]
   * @returns {boolean}
   * @private
   */
  function _hasCentralHeteroatomGroup(groups) {
    if (!groups || groups.length === 0) return false;
    return groups.some(g =>
      g.shortName === "sulphoxide" ||
      (g.shortName === "amine" && typeof g.subtype === "number" && g.subtype >= 2),
    );
  }

  /**
   * Phase 15-2c (LOCK 5): bridged-acyclic predicate. Matches acyclic ether
   * (Pass 8.5: non-ring O with 2 -C neighbours). Defensive against undefined
   * `groups`.
   *
   * @param {Object[]} [groups]
   * @returns {boolean}
   * @private
   */
  function _hasBridgingGroup(groups) {
    if (!groups || groups.length === 0) return false;
    return groups.some(g => g.shortName === "ether");
  }

  /**
   * Phase 15-2c (LOCK 5): walk a single alkyl-style substituent from the
   * given carbon root outward. Stops at branching, at non-C, at non-single-
   * bond, or when no onward C remains. Returns the in-walk atom-id sequence
   * (root first) and the alkyl descriptor (methyl/ethyl/...). Tier-1 expects
   * methyl (length 1) for central-heteroatom substituents and ethyl
   * (length 2) for bridged-acyclic substituents.
   *
   * @param {number} startId - the first C off the centre (NOT the centre itself)
   * @param {number} prevId - the centre atom id (used as visited-seed)
   * @param {Map} adjacency
   * @param {Object} graphData
   * @returns {{ atomIds: number[], descriptor: string|null } | null}
   * @private
   */
  function _walkAlkylSubstituent(startId, prevId, adjacency, graphData) {
    const atomIds = [];
    const visited = new Set([prevId]);
    let currentId = startId;
    // Length capped at ALKYL_NAMES.length-1 (=8); longer substituents land
    // null descriptor and the prose layer falls through to a generic walk.
    while (atomIds.length < ALKYL_NAMES.length - 1) {
      if (visited.has(currentId)) break;
      const cVertex = graphData.graph.vertices.find(v => v.id === currentId);
      if (!cVertex || (cVertex.value?.element || "") !== "C") break;
      visited.add(currentId);
      atomIds.push(currentId);
      const neighbours = adjacency.get(currentId) || [];
      const onward = neighbours.filter(
        n => !visited.has(n.vertex.id)
          && (n.vertex.value?.element || "") === "C"
          && n.edge.bondType === "-",
      );
      if (onward.length === 0) break; // terminal C — valid alkyl
      if (onward.length > 1) break;   // branched — stop at first branch for tier-1
      currentId = onward[0].vertex.id;
    }
    if (atomIds.length === 0) return null;
    return { atomIds, descriptor: ALKYL_NAMES[atomIds.length] || null };
  }

  /**
   * Phase 15-2c (LOCK 5): analyse a central-heteroatom scaffold. The centre
   * is the sulphoxide S or amine N (subtype ≥ 2). Substituents are the C
   * neighbours walked as alkyl chains (terminal-methyl for tier-1). The
   * centre's own group atoms (e.g. DMSO's =O, claimed by sulphoxide Pass 4.5)
   * are NOT counted as substituents — they're recorded as multiBondAtoms so
   * prose can mention them separately (e.g. "double-bonded to an oxygen").
   *
   * Return shape per [phase15-2c-investigation-findings.md § 4.3].
   *
   * @param {Object[]} groups
   * @param {Object} graphData
   * @param {Map} adjacency
   * @returns {{ atomId:number, element:string,
   *            substituents:Array<{atomIds:number[],descriptor:string|null}>,
   *            multiBondAtoms:Array<{atomId:number,element:string,bondType:string}> } | null}
   * @private
   */
  function _analyseCentralHeteroatom(groups, graphData, adjacency) {
    if (!groups || groups.length === 0) return null;
    // Centre selection: sulphoxide wins over amine when both present (tier-1
    // has neither in combination; defensive ordering).
    let centreGroup = groups.find(g => g.shortName === "sulphoxide");
    if (!centreGroup) {
      centreGroup = groups.find(
        g => g.shortName === "amine" && typeof g.subtype === "number" && g.subtype >= 2,
      );
    }
    if (!centreGroup || !centreGroup.atoms || centreGroup.atoms.length === 0) return null;
    const centreAtomId = centreGroup.atoms[0];
    const centreVertex = graphData.graph.vertices.find(v => v.id === centreAtomId);
    if (!centreVertex) return null;
    const centreElement = centreVertex.value?.element || "";
    const groupAtomSet = new Set(centreGroup.atoms);

    const substituents = [];
    const multiBondAtoms = [];
    const neighbours = adjacency.get(centreAtomId) || [];
    for (const n of neighbours) {
      const nbVertex = n.vertex;
      const bondType = n.edge.bondType;
      // Atoms claimed by the centre's own group (e.g. DMSO =O) are recorded
      // as multi-bond atoms when reached via = or # — NOT as substituents.
      if (groupAtomSet.has(nbVertex.id)) {
        if (bondType === "=" || bondType === "#") {
          multiBondAtoms.push({
            atomId: nbVertex.id,
            element: nbVertex.value?.element || "",
            bondType,
          });
        }
        continue;
      }
      // Substituent: walk it as alkyl (tier-1 → methyl).
      const sub = _walkAlkylSubstituent(nbVertex.id, centreAtomId, adjacency, graphData);
      if (sub) substituents.push(sub);
    }
    return {
      atomId: centreAtomId,
      element: centreElement,
      substituents,
      multiBondAtoms,
    };
  }

  /**
   * Phase 15-2c (LOCK 5): analyse a bridged-acyclic scaffold. The bridge is
   * the ether O (Pass 8.5); left/right substructures are the alkyl chains
   * on either side. Convention for continuous prose numbering across the
   * bridge: `leftSubstructure.atomIds[0]` is the OUTERMOST atom of the left
   * chain (furthest from the bridge); `rightSubstructure.atomIds[0]` is the
   * INNERMOST atom of the right chain (closest to the bridge). For diethyl
   * ether `CCOCC` this yields atomIds = [C0, C1] / [C3, C4] so prose can
   * walk "first carbon (C0) → second carbon (C1) → bridge → third carbon
   * (C3) → fourth carbon (C4)" matching the § 7.4 COMP target.
   *
   * Return shape per [phase15-2c-investigation-findings.md § 4.3].
   *
   * @param {Object[]} groups
   * @param {Object} graphData
   * @param {Map} adjacency
   * @returns {{ bridgeAtomId:number, bridgeElement:string,
   *            leftSubstructure:{atomIds:number[],descriptor:string|null}|null,
   *            rightSubstructure:{atomIds:number[],descriptor:string|null}|null } | null}
   * @private
   */
  function _analyseBridgedAcyclic(groups, graphData, adjacency) {
    if (!groups || groups.length === 0) return null;
    const bridgeGroup = groups.find(g => g.shortName === "ether");
    if (!bridgeGroup || !bridgeGroup.atoms || bridgeGroup.atoms.length === 0) return null;
    const bridgeAtomId = bridgeGroup.atoms[0];
    const bridgeVertex = graphData.graph.vertices.find(v => v.id === bridgeAtomId);
    if (!bridgeVertex) return null;
    const bridgeElement = bridgeVertex.value?.element || "";
    const neighbours = adjacency.get(bridgeAtomId) || [];
    if (neighbours.length !== 2) return null;

    const leftRoot = neighbours[0].vertex.id;
    const rightRoot = neighbours[1].vertex.id;
    const leftWalk = _walkAlkylSubstituent(leftRoot, bridgeAtomId, adjacency, graphData);
    const rightWalk = _walkAlkylSubstituent(rightRoot, bridgeAtomId, adjacency, graphData);

    return {
      bridgeAtomId,
      bridgeElement,
      // Reverse leftWalk so the outermost atom comes first (continuous
      // prose numbering across the bridge — see function doc).
      leftSubstructure: leftWalk
        ? { atomIds: leftWalk.atomIds.slice().reverse(), descriptor: leftWalk.descriptor }
        : null,
      rightSubstructure: rightWalk,
    };
  }

  // Phase 15-2a: bundled atom-CIP + bond-E/Z stereo emission classifier.
  // Phase 16-2a (KD-4): bond E/Z now prefers the CIP-resolved
  // edge._rdkit.bondCipCode ("E"/"Z") over the raw edge._rdkit.stereo
  // ("cis"/"trans"), which is retained as a fallback. Reads the translator-
  // supplied flat shapes (vertex.value._rdkit.cipCode now sourced from
  // get_stereo_tags() CIP_atoms); emits structured
  // collections consumed by prose's _deriveStereoPrefix for opener-position
  // prefix injection. Bond filter `e.bondType === "="` is sound for tier-1
  // — non-stereo C=O / etc. have null _rdkit.stereo so the && guard skips
  // them (§ 2.2). Acetone (#15) sanity canary returns {atomCIP:[],bondEZ:[]}.
  function _classifyStereoEmission(graphData) {
    const atomCIP = [];
    const bondEZ = [];
    for (const v of graphData.graph.vertices) {
      const cip = v.value?._rdkit?.cipCode;
      if (cip) atomCIP.push({ atomId: v.id, code: cip });
    }
    for (const e of graphData.graph.edges) {
      if (e.bondType !== "=") continue;
      // Phase 16-2a (KD-4): prefer the CIP-resolved E/Z descriptor
      // (utils.js get_stereo_tags() → _rdkit.bondCipCode, "E"/"Z"); fall
      // back to the raw cis/trans stereo-pair perception when no CIP code is
      // present so a descriptor previously rendered is never lost (lock 4).
      const cip = e._rdkit?.bondCipCode;
      const raw = e._rdkit?.stereo;
      const code = cip || raw;
      if (code) {
        bondEZ.push({ bondId: e.id, sourceId: e.sourceId, targetId: e.targetId, code });
      }
    }
    return { atomCIP, bondEZ };
  }

  // Phase 15-2b: principal-characteristic-group cascade per IUPAC P-43.1, narrowed
  // to tier-1 fixture coverage (investigation § 7.1). Future tier phases extend
  // this cascade (esters > amides > acid halides > sulphonic acids > acids ...).
  // Phase 16-1 (KD-10): thiol added below hydroxyl — IUPAC P-41 suffix seniority
  // places thiols (chalcogen analogue of alcohols) just below alcohols/phenols and
  // above amines. Without it, thiol-bearing chains returned principalFGAnchor: null
  // and numbered in SMILES-atom order (propane-1-thiol mislocated to C3 not C1).
  // Phase 17-4a: anhydride and acid chloride inserted between acid and nitrile —
  // IUPAC P-41 orders the families carboxylic acid > anhydride > ester > acid
  // halide > amide > nitrile, so anhydride precedes acid chloride and both sit
  // above nitrile. The ester and amide gaps that KD-16 records fall between and
  // around them and change no pairwise ordering among the entries already
  // present. Landed INERT: no catalogue row emits either name yet (17-4b adds
  // the rows). Ranking reads this array only by relative index, so the insertion
  // shifts absolute indices without changing any ordering decision.
  const PCG_CASCADE = ["acid", "anhydride", "acid chloride", "nitrile", "aldehyde", "ketone", "hydroxyl", "thiol", "amine"];

  // Phase 15-2b: identify the chain-attachment carbon of the highest-priority
  // PCG group, per IUPAC P-14.5 lowest-locant rule. Returned anchor atom-id
  // is consumed by prose's _orderChainAtoms (IUPAC-aware endpoint picker) and
  // _chainLocantSuffix (STD/SHORT scope-guarded suffix). Returns null when no
  // PCG-cascade group is present (e.g. ethers, thioethers, sulfoxides).
  function _findPrincipalFGAnchor(groups, chainAtomSet, adjacency) {
    if (!chainAtomSet || !groups || groups.length === 0) return null;
    let pcg = null, bestPri = Infinity;
    for (const g of groups) {
      const pri = PCG_CASCADE.indexOf(g.shortName);
      if (pri >= 0 && pri < bestPri) { bestPri = pri; pcg = g; }
    }
    if (!pcg) return null;
    for (const a of pcg.atoms || []) {
      if (chainAtomSet.has(a)) return a;
    }
    for (const a of pcg.atoms || []) {
      const cn = (adjacency.get(a) || []).find(n => chainAtomSet.has(n.vertex.id));
      if (cn) return cn.vertex.id;
    }
    return null;
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
    // Phase 17-3b (the switchover): the live path now calls the SMARTS/RDKit
    // catalogue (runCatalogue) instead of the legacy graph-walk detector. The
    // legacy _detectFunctionalGroupsFromGraph is retained (never deleted) as
    // both the one-line rollback anchor and the fallback immediately below.
    let groups = runCatalogue(smiles, graphData, adjacency);
    // RDKit-unavailable / invalid-SMILES guard (findings Q3): runCatalogue
    // early-returns [] when matchSmarts is unavailable or the SMILES is
    // invalid, but the SmilesDrawer graph is cached independently of RDKit — so
    // there is a window where a valid cached graph yields an empty catalogue
    // result. In that window, fall back to the RDKit-free legacy detector so a
    // student never receives a silently-emptied description. Fires ONLY on an
    // empty catalogue result (genuine no-functional-group molecules or the
    // failure window), so it adds no cost to the normal path. Catalogue empty
    // AND legacy non-empty → use legacy; catalogue empty AND legacy empty →
    // genuinely no groups, keep the empty result.
    if (groups.length === 0) {
      const legacyGroups = _detectFunctionalGroupsFromGraph(graphData, adjacency);
      if (legacyGroups.length > 0) {
        logWarn(
          "analyseStructure: catalogue returned empty where legacy found groups — using legacy fallback (likely RDKit-unavailable)",
          { smiles },
        );
        groups = legacyGroups;
      }
    }
    const chain = rings.length === 0 ? _analyseChainFromGraph(graphData, adjacency) : null;

    // Phase 15-2b: attach principal-FG anchor for IUPAC P-14.5 lowest-locant
    // chain ordering. Gate on chain.length > 1 — single-carbon chains (urea,
    // guanidine, methanol) take dedicated single-carbon prose branches that
    // never reach the chain-walker.
    if (chain && chain.length > 1) {
      chain.principalFGAnchor = _findPrincipalFGAnchor(groups, chain._atomSet, adjacency);
    }

    // Phase 15-2c (LOCK 5): scaffold type now FG-aware (acyclic central-
    // heteroatom + bridged-acyclic). Compute first; conditionally attach
    // the matching analysis blob so prose at Commit C can dispatch without
    // re-running predicate logic. Both blobs default null when their
    // scaffold arm is not taken — safe to add to the return shape (no
    // existing destructure consumer reads them; verified at the Commit B
    // read-side sweep).
    const scaffoldType = _classifyScaffold(rings, groups);
    const centralHeteroatom = scaffoldType === "central-heteroatom"
      ? _analyseCentralHeteroatom(groups, graphData, adjacency)
      : null;
    const bridgedAcyclic = scaffoldType === "bridged-acyclic"
      ? _analyseBridgedAcyclic(groups, graphData, adjacency)
      : null;

    return {
      rings,
      functionalGroups: groups,
      chain,
      heavyAtomCount: graphData.graph.vertices.length,
      scaffoldType,
      stereoEmission: _classifyStereoEmission(graphData), // Phase 15-2a: atom-CIP + bond-E/Z
      centralHeteroatom, // Phase 15-2c (LOCK 5): null unless scaffoldType === "central-heteroatom"
      bridgedAcyclic,    // Phase 15-2c (LOCK 5): null unless scaffoldType === "bridged-acyclic"
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
        // Phase 17-2a/2b: SMARTS-catalogue runner + table (DEAD CODE).
        // Exposed so window.testCatalogueEquivalence can prove record-for-record
        // equivalence vs the legacy passes. NOT wired into analyseStructure —
        // the consumption switchover is a later 17-2 sub-stage.
        runCatalogue: runCatalogue,
        functionalGroupsCatalogue: FUNCTIONAL_GROUPS,
        // Phase 10-4 (CT-4d-named): shared fused-system + pyrimidine-dione
        // naming so the standard tier (G4) and the comprehensive tier derive
        // the label from the same primitive. Xanthine detection needs graphData
        // and adjacency to look at exocyclic carbonyls — both callers already
        // have these in scope.
        identifyFusedSystemName: _identifyFusedSystemName,
        identifyPyrimidinePattern: _identifyPyrimidinePattern,
        // Phase 15-2a: classifier-routed stereo emission helper.
        classifyStereoEmission: _classifyStereoEmission,
        // Phase 11-2d (N-post10-5): 2-pyridone classifier — sibling of the
        // pyrimidine pattern, fires on aromatic 6-rings with 1 N + 1 exocyclic
        // C=O. Returns "pyridin-2(1H)-one". Consumed by the COMP single-ring
        // path's namedSystemSingle fall-through and by auditPositionalLabels.
        identifyPyridinonePattern: _identifyPyridinonePattern,
        countExocyclicCarbonyls: _countExocyclicCarbonyls,
        // Phase 17 (KD-13): teaching-facing ring aromaticity (perceived aromatic
        // AND < 2 exocyclic ring carbonyls). Narrowing only — consumed by the
        // prose tiers so a taught-non-aromatic dione ring drops the "aromatic"
        // claim while `ring.aromatic` (and every gate keyed on it) is untouched.
        isTaughtAromatic: _isTaughtAromatic,
        selectNamedSystemLabel: _selectNamedSystemLabel,
        analyseChainFromGraph: _analyseChainFromGraph,
        classifyScaffold: _classifyScaffold,
        // Phase 15-2b: principal-FG anchor primitive for chain-locant flow.
        findPrincipalFGAnchor: _findPrincipalFGAnchor,
        // Phase 17 (KD-14): expose the principal-characteristic-group seniority
        // cascade so the prose tier's shared seniority comparator
        // (_orderGroupsBySeniority) ranks from the SAME source of truth the
        // COMP chain-anchor already uses (_findPrincipalFGAnchor). Exposed, not
        // forked, per CLAUDE.md § 148 (classify.js is the ranking authority).
        pcgCascade: PCG_CASCADE,
        // Phase 15-2c (LOCK 5): acyclic central-heteroatom + bridged-acyclic
        // scaffold helpers + alkyl-substituent walker. Mirrors the
        // analyseChainFromGraph / classifyScaffold publishing pattern.
        hasCentralHeteroatomGroup: _hasCentralHeteroatomGroup,
        hasBridgingGroup: _hasBridgingGroup,
        walkAlkylSubstituent: _walkAlkylSubstituent,
        analyseCentralHeteroatom: _analyseCentralHeteroatom,
        analyseBridgedAcyclic: _analyseBridgedAcyclic,
      },
    },
  };

  logInfo("MathPixChemistryClassify initialised (Phase 14-1c)");
})();
