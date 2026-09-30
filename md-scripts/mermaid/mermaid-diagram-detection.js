/**
 * Mermaid Diagram Detection
 * Detects diagram types from Mermaid code for accessibility features
 */
window.MermaidDiagramDetection = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message);
    }
  }

  /**
   * Detect the type of mermaid diagram from its code
   * @param {string} code - The mermaid diagram code
   * @returns {string} The diagram type (e.g., 'flowchart', 'sequenceDiagram')
   */
  function detectDiagramType(code) {
    if (!code) {
      logInfo(
        "[Mermaid Accessibility] No code provided, defaulting to flowchart"
      );
      return "flowchart";
    }

    // Clean the code to remove whitespace and normalise
    let cleanCode = code.trim();

    logDebug(
      `[Mermaid Accessibility] Original code starts with: "${cleanCode.substring(
        0,
        50
      )}..."`
    );

    // Try multiple approaches to remove theme initialisation directives

    // Approach 1: Remove %{init:...}% format (multiline with /s flag)
    cleanCode = cleanCode.replace(/^\s*%{init:[\s\S]*?}%\s*/m, "");

    // Approach 2: Try removing JSON-like init block
    cleanCode = cleanCode.replace(/^\s*%{init:.*?\s*{.*?}.*?}%\s*/ms, "");

    // Approach 3: If all else fails, find the first line that seems like a diagram type
    const lines = cleanCode.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines and lines that look like theme settings
      if (
        line === "" ||
        line.includes("%{init:") ||
        line.includes("themeVariables")
      ) {
        continue;
      }

      // If we found a non-empty, non-theme line, use that for detection
      cleanCode = lines.slice(i).join("\n");
      break;
    }

    logDebug(
      `[Mermaid Accessibility] After removing init directives: "${cleanCode.substring(
        0,
        50
      )}..."`
    );

    // PREFERRED: ask Mermaid itself. Falls back to the keyword scan below when
    // the library is absent or refuses the input.
    const fromMermaid = detectViaMermaid(cleanCode);
    if (fromMermaid) {
      return fromMermaid;
    }

    // Run detection with more detailed logging
    return detectDiagramTypeFromCleanCode(cleanCode);
  }

  /**
   * Map a Mermaid diagram type to the generator key this project registers.
   *
   * Two naming traps live in here, both measured on Mermaid 11.6.0 rather than
   * assumed: `flowchart TD` reports "flowchart-v2" while `graph TB` reports
   * "flowchart", and bare `stateDiagram` reports "state" while `stateDiagram-v2`
   * reports "stateDiagram". Each pair must collapse to a single key.
   *
   * Anything absent from this map has no generator, so it resolves to an
   * `unsupported:` key and the core produces an honest "no description
   * available" instead of describing it as a flowchart.
   */
  const MERMAID_TYPE_TO_KEY = Object.freeze({
    flowchart: "flowchart",
    "flowchart-v2": "flowchart",
    "flowchart-elk": "flowchart",
    sequence: "sequenceDiagram",
    state: "stateDiagram",
    stateDiagram: "stateDiagram",
    "stateDiagram-v2": "stateDiagram",
    journey: "userJourney",
    gantt: "gantt",
    pie: "pieChart",
    quadrantChart: "quadrantChart",
    mindmap: "mindmap",
    timeline: "timeline",
    architecture: "architecture-beta",
    er: "entityRelationshipDiagram",
    // Both class spellings are live: `classDiagram` reports "class" and
    // `classDiagram-v2` reports "classDiagram" (class stage 0 § M1) — the
    // same counter-intuitive shape as the state pair above. One entry alone
    // would leave the other spelling on the unsupported fallback.
    class: "classDiagram",
    classDiagram: "classDiagram",
    // Git graph has a single live name: detectType returns "gitGraph" for
    // every opener — plain, orientation forms, frontmatter, directives (git
    // graph stage 0 § M1). No -v2-style pair exists, so one entry suffices.
    gitGraph: "gitGraph",
    // Sankey has a single live name: detectType returns "sankey" for
    // sankey-beta and throws UnknownDiagramError on bare "sankey" (sankey
    // stage 0 § S1). One entry suffices, and unlike ER, class and git graph
    // there is no scan-key coincidence to check — the legacy keyword scan's
    // sankey branch cannot match a real sankey diagram at all.
    sankey: "sankey",
    // XY chart has a single live name: detectType returns "xychart" for
    // `xychart-beta` (xychart grounding § 2, measured on all six gold
    // exemplars). No -v2-style pair exists, so one entry suffices.
    //
    // UNCHANGED BY THIS ENTRY, and deliberately so: a bare `xychart` without
    // `-beta` makes detectType THROW, which returns null and falls through to
    // the legacy keyword scan below — and that scan has no xychart branch at
    // all, so it answers `flowchart` and a chart is described as a flowchart
    // (grounding § 2). This map cannot reach that path, because it is only
    // consulted for a type Mermaid's own detector produced. The misroute is
    // registered as outstanding rather than fixed here.
    xychart: "xychart",
    // Item 80: detectType returns "block" for block-beta; one entry suffices.
    block: "block",
    // Item 84: ONE ROW FOR FIVE DIAGRAM KINDS. detectType returns "c4" for
    // C4Context, C4Container, C4Component, C4Dynamic AND C4Deployment alike
    // (census § Q1, measured on all five), so one entry routes every one of
    // them to the single c4 generator, which recovers the kind from
    // db.getC4Type() because no detection key can supply it. A second row
    // would be unreachable: there is no other live name to add.
    c4: "c4",
    // Item 88, 21 September 2026: detectType returns "kanban" for a `kanban`
    // opener; one entry suffices, and there is no -v2-style second spelling to
    // add. Same pattern as the c4 row above and for the same reason — without
    // this row the kanban generator registers and is never called, because the
    // core resolves a generator by the key this map produces and a kanban
    // source would resolve to `unsupported:kanban` and reach the honest
    // fallback instead.
    //
    // UNCHANGED BY THIS ENTRY, and recorded rather than widened: the legacy
    // keyword scan below carries a per-type branch list and has NO kanban
    // branch, so a source reaching that scan — which happens only when Mermaid
    // itself is absent or its detector throws — still answers `flowchart` and a
    // board would be described as one. This map cannot reach that path, being
    // consulted only for a type Mermaid's own detector produced. The misroute
    // is the same one the xychart row records above, and is left as found.
    kanban: "kanban",
    // Item 93, 28 September 2026: detectType returns "radar" for a
    // `radar-beta` opener; one entry suffices. Same reason as the kanban row
    // above — without it the radar generator registers and is never called,
    // and a radar source resolves to `unsupported:radar`. The legacy keyword
    // scan below has no radar branch either, and is left as found.
    radar: "radar",
    // Item 96, 29 September 2026: detectType returns "info" for an `info`
    // opener; one entry suffices. Same reason as the radar row above. The
    // legacy keyword scan has no info branch either, and is left as found: an
    // upper-case `INFO` makes detectType throw, the scan answers `flowchart`,
    // and that misroute is register item 97's, not this row's.
    info: "info",
  });

  /** Prefix marking a diagram type we can detect but cannot describe. */
  const UNSUPPORTED_PREFIX = "unsupported:";

  /**
   * Detect the diagram type using Mermaid's own detector.
   *
   * Measured 1 August 2026: `mermaid.detectType` is synchronous, resolves all 22
   * Mermaid 11.6.0 diagram types, and throws a catchable UnknownDiagramError on
   * input it cannot type. It is also immune to the body-line misrouting that the
   * keyword scan below suffers from, because it reads the opening declaration
   * rather than scanning every line.
   *
   * @param {string} cleanCode - Mermaid source, init directives already stripped
   * @returns {string|null} A generator key, an `unsupported:` key, or null to
   *                        signal "fall back to the keyword scan"
   */
  function detectViaMermaid(cleanCode) {
    if (!window.mermaid || typeof window.mermaid.detectType !== "function") {
      logDebug(
        "[Mermaid Accessibility] mermaid.detectType unavailable, using keyword scan"
      );
      return null;
    }

    let mermaidType;
    try {
      mermaidType = window.mermaid.detectType(cleanCode);
    } catch (error) {
      // UnknownDiagramError for unrecognised input, TypeError for null. Either
      // way the keyword scan is the more forgiving second opinion.
      logDebug(
        `[Mermaid Accessibility] mermaid.detectType rejected the input (${error.name}), using keyword scan`
      );
      return null;
    }

    if (!mermaidType) {
      return null;
    }

    const key = MERMAID_TYPE_TO_KEY[mermaidType];
    if (key) {
      logDebug(
        `[Mermaid Accessibility] mermaid.detectType reported "${mermaidType}" -> "${key}"`
      );
      return key;
    }

    const unsupported = `${UNSUPPORTED_PREFIX}${mermaidType}`;
    logInfo(
      `[Mermaid Accessibility] No generator for Mermaid type "${mermaidType}" -> "${unsupported}"`
    );
    return unsupported;
  }

  /**
   * Detect diagram type from cleaned code
   * @param {string} cleanCode - The cleaned mermaid code (without init directives)
   * @returns {string} The detected diagram type
   */
  function detectDiagramTypeFromCleanCode(cleanCode) {
    // Let's dump the full code for debugging in case we're still having issues
    logDebug(
      `[Mermaid Accessibility] Full cleaned code for analysis: ${cleanCode.substring(
        0,
        100
      )}...`
    );

    // Specific checks for each diagram type with detailed regex patterns

    // Quadrant chart check - look for "quadrantChart" at the beginning
    const quadrantMatch = /^(?:.*\n)*?\s*quadrantChart(\s+|$)/i.exec(cleanCode);
    if (quadrantMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected quadrant chart, matched: "${quadrantMatch[0].trim()}"`
      );
      return "quadrantChart";
    }

    // Architecture diagram check - look for "architecture-beta" at the beginning
    const architectureMatch = /^(?:.*\n)*?\s*architecture-beta(\s+|$)/i.exec(
      cleanCode
    );
    if (architectureMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected architecture diagram, matched: "${architectureMatch[0].trim()}"`
      );
      return "architecture-beta";
    }

    // Gantt chart check - look for "gantt" at the beginning of a line
    const ganttMatch = /^(?:.*\n)*?\s*gantt(\s+|$)/i.exec(cleanCode);
    if (ganttMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected Gantt chart, matched: "${ganttMatch[0].trim()}"`
      );
      return "gantt";
    }

    // Pie chart check - look for "pie" at the beginning of a line or entire string
    const pieMatch = /^(?:.*\n)*?\s*pie(\s+|$)/i.exec(cleanCode);
    if (pieMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected pie chart, matched: "${pieMatch[0].trim()}"`
      );
      return "pieChart";
    }

    // Sequence diagram check
    const sequenceMatch = /^(?:.*\n)*?\s*sequenceDiagram(\s+|$)/i.exec(
      cleanCode
    );
    if (sequenceMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected sequence diagram, matched: "${sequenceMatch[0].trim()}"`
      );
      return "sequenceDiagram";
    }

    // Class diagram check
    const classMatch = /^(?:.*\n)*?\s*classDiagram(\s+|$)/i.exec(cleanCode);
    if (classMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected class diagram, matched: "${classMatch[0].trim()}"`
      );
      return "classDiagram";
    }

    // State diagram check
    const stateMatch = /^(?:.*\n)*?\s*stateDiagram(-v2)?(\s+|$)/i.exec(
      cleanCode
    );
    if (stateMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected state diagram, matched: "${stateMatch[0].trim()}"`
      );
      return "stateDiagram";
    }

    // Entity-relationship diagram check
    const erMatch = /^(?:.*\n)*?\s*erDiagram(\s+|$)/i.exec(cleanCode);
    if (erMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected ER diagram, matched: "${erMatch[0].trim()}"`
      );
      return "entityRelationshipDiagram";
    }

    // User journey check
    const journeyMatch = /^(?:.*\n)*?\s*journey(\s+|$)/i.exec(cleanCode);
    if (journeyMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected user journey, matched: "${journeyMatch[0].trim()}"`
      );
      return "userJourney";
    }

    // Mindmap check
    const mindmapMatch = /^(?:.*\n)*?\s*mindmap(\s+|$)/i.exec(cleanCode);
    if (mindmapMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected mindmap, matched: "${mindmapMatch[0].trim()}"`
      );
      return "mindmap";
    }

    // Timeline check
    const timelineMatch = /^(?:.*\n)*?\s*timeline(\s+|$)/i.exec(cleanCode);
    if (timelineMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected timeline, matched: "${timelineMatch[0].trim()}"`
      );
      return "timeline";
    }

    // Git graph check
    const gitGraphMatch = /^(?:.*\n)*?\s*gitGraph(\s+|$)/i.exec(cleanCode);
    if (gitGraphMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected git graph, matched: "${gitGraphMatch[0].trim()}"`
      );
      return "gitGraph";
    }

    // Sankey diagram check
    const sankeyMatch = /^(?:.*\n)*?\s*sankey(\s+|$)/i.exec(cleanCode);
    if (sankeyMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected sankey diagram, matched: "${sankeyMatch[0].trim()}"`
      );
      return "sankey";
    }

    // Flowchart check (including both flowchart and graph syntax)
    const flowchartMatch = /^(?:.*\n)*?\s*(flowchart|graph)\s+/i.exec(
      cleanCode
    );
    if (flowchartMatch) {
      logDebug(
        `[Mermaid Accessibility] Detected flowchart, matched: "${flowchartMatch[0].trim()}"`
      );
      return "flowchart";
    }

    // Default fallback
    logWarn(
      `[Mermaid Accessibility] No diagram type detected, defaulting to flowchart`
    );
    return "flowchart";
  }

  // Inform that the module has been initialised
  logInfo("[Mermaid Accessibility] Diagram detection module loaded");

  // Public API
  return {
    detectDiagramType: detectDiagramType,
  };
})();
