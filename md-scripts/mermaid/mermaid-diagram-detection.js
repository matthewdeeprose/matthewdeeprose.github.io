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

    // Run detection with more detailed logging
    return detectDiagramTypeFromCleanCode(cleanCode);
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

  /**
   * Extract the orientation from a flowchart diagram code
   * @param {string} code - The mermaid diagram code
   * @returns {string|null} The detected orientation (TB, BT, LR, RL) or null if not found
   */
  function detectOrientation(code) {
    if (!code) return null;

    // Check if code contains graph/flowchart with orientation
    const graphMatch = code.match(/graph\s+(TB|BT|LR|RL)/i);
    const flowchartMatch = code.match(/flowchart\s+(TB|BT|LR|RL)/i);

    if (graphMatch) return graphMatch[1].toUpperCase();
    if (flowchartMatch) return flowchartMatch[1].toUpperCase();

    return null;
  }

  /**
   * Check if diagram type supports orientation changes
   * @param {string} code - The mermaid diagram code
   * @returns {boolean} True if orientation changes are supported
   */
  function supportsOrientation(code) {
    if (!code) return false;

    // Clean up code to remove whitespace and normalise
    const cleanCode = code.trim();

    // Check if this is a graph or flowchart (which support orientation)
    // Look for graph/flowchart at the beginning of the string with any orientation (TB|BT|LR|RL)
    const graphRegex = /^(?:graph|flowchart)\s+(TB|BT|LR|RL)/i;
    const isGraphOrFlowchart = graphRegex.test(cleanCode);

    return isGraphOrFlowchart;
  }

  /**
   * Check if the diagram is a decision diagram (with many decision nodes)
   * @param {string} code - The mermaid diagram code
   * @returns {boolean} True if it's likely a decision-focused diagram
   */
  function isDecisionDiagram(code) {
    if (!code) return false;

    // Count decision nodes (diamond shapes)
    const decisionNodeCount = (code.match(/\{\{([^}]+)\}\}/g) || []).length;

    // Count rhombus nodes
    const rhombusNodeCount = (code.match(/\[\{([^}]+)\}\]/g) || []).length;

    // Count question marks in node texts (common for decision nodes)
    const questionNodeCount = (code.match(/\[[^\]]*\?[^\]]*\]/g) || []).length;

    // Calculate total potential decision nodes
    const totalDecisionNodes =
      decisionNodeCount + rhombusNodeCount + questionNodeCount;

    // Count total nodes
    const totalNodesMatch =
      code.match(/\[[^\]]+\]|\([^\)]+\)|\{\{[^}]+\}\}|\[\{[^}]+\}\]/g) || [];
    const totalNodes = totalNodesMatch.length;

    // If more than 30% of nodes are decision nodes, consider it a decision diagram
    return totalNodes > 0 && totalDecisionNodes / totalNodes > 0.3;
  }

  // Inform that the module has been initialised
  logInfo("[Mermaid Accessibility] Diagram detection module loaded");

  // Public API
  return {
    detectDiagramType: detectDiagramType,
    detectOrientation: detectOrientation,
    supportsOrientation: supportsOrientation,
    isDecisionDiagram: isDecisionDiagram,
  };
})();
