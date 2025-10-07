/**
 * Mermaid Accessibility - Flowchart Module
 * Generates accessible descriptions for flowchart diagrams
 * Enhanced to properly handle complex flowcharts with labeled edges
 */
const FlowchartModule = (function () {
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

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[Flowchart][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Flowchart][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[Flowchart][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Flowchart][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[Flowchart][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[Flowchart][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // Configuration for debugging (deprecated - use logging levels instead)
  const DEBUG = false; // Toggle for verbose logging

  /**
   * Enhanced logging function that respects debug mode (legacy support)
   * @param {string} context - The context for the log
   * @param {any} data - The data to log
   */
  function debugLog(context, data) {
    if (!DEBUG) return;
    logDebug(context, data);
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;

  /**
   * Generate a short description for a flowchart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {Object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    // Extract title if available
    let title = Utils.extractTitleFromSVG(svgElement);
    logDebug("Title", title || "No title found");

    // Try to get orientation for more specific description
    let orientation = "";
    if (
      window.MermaidDiagramDetection &&
      typeof window.MermaidDiagramDetection.detectOrientation === "function"
    ) {
      const detectedOrientation =
        window.MermaidDiagramDetection.detectOrientation(code);
      logDebug("Detected Orientation", detectedOrientation || "None detected");

      if (detectedOrientation) {
        switch (detectedOrientation) {
          case "TB":
            orientation = "top to bottom";
            break;
          case "BT":
            orientation = "bottom to top";
            break;
          case "LR":
            orientation = "left to right";
            break;
          case "RL":
            orientation = "right to left";
            break;
        }
      }
    }

    // Is this a decision-heavy flowchart?
    let isDecision = false;
    if (
      window.MermaidDiagramDetection &&
      typeof window.MermaidDiagramDetection.isDecisionDiagram === "function"
    ) {
      isDecision = window.MermaidDiagramDetection.isDecisionDiagram(code);
      logDebug("Is Decision Diagram", isDecision);
    }

    // Count nodes for size description
    const nodeCount = countNodes(svgElement, code);
    logDebug("Node Count", nodeCount);

    let complexityDesc = "";

    if (nodeCount > 20) {
      complexityDesc = "complex ";
    } else if (nodeCount > 10) {
      complexityDesc = "moderate ";
    }

    // Construct description with appropriate classes
    let htmlDescription = `A ${complexityDesc}flowchart`;

    // Plain text version for screen readers and textContent scenarios
    let plainTextDescription = `A ${complexityDesc}flowchart`;

    if (isDecision) {
      htmlDescription = `A ${complexityDesc}decision flowchart`;
      plainTextDescription = `A ${complexityDesc}decision flowchart`;
    }

    if (orientation) {
      htmlDescription += ` flowing ${orientation}`;
      plainTextDescription += ` flowing ${orientation}`;
    }

    if (title) {
      htmlDescription += ` showing <span class="diagram-title">${title}</span>`;
      plainTextDescription += ` showing ${title}`;
    }

    if (nodeCount > 0) {
      htmlDescription += ` with <span class="diagram-count">${nodeCount}</span> steps`;
      plainTextDescription += ` with ${nodeCount} steps`;
    }

    htmlDescription += ".";
    plainTextDescription += ".";

    logDebug("Final Short Description", plainTextDescription);

    return {
      html: htmlDescription,
      text: plainTextDescription,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The plain text description for backwards compatibility
   */
  function shortDescriptionWrapper(svgElement, code) {
    const descriptions = generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }

  /**
   * Count the number of nodes in the flowchart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {number} The number of nodes
   */
  function countNodes(svgElement, code) {
    logDebug("countNodes", "Counting flowchart nodes");

    // First try to count from the SVG (most reliable if rendered)
    const nodes = svgElement.querySelectorAll(".node");
    if (nodes.length > 0) {
      logDebug("Node Count from SVG", nodes.length);
      return nodes.length;
    }

    // Fallback to code analysis
    // This regex looks for node definitions in the code
    const nodeMatches = code.match(/\s*[A-Za-z0-9_-]+\s*(\[|\(|\{)/g);
    const count = nodeMatches ? nodeMatches.length : 0;
    logDebug("Node Count from Code", count);
    return count;
  }

  /**
   * Clean node text to remove Mermaid formatting characters
   * @param {string} text - The node text with formatting
   * @returns {string} Cleaned text
   */
  function cleanNodeText(text) {
    if (!text) return "";

    // Remove Mermaid formatting characters for different node types
    const cleaned = text
      .replace(/^\[\[|\]\]$/g, "") // Remove [[ and ]] (subprocess)
      .replace(/^\[\/?|\/?\]$/g, "") // Remove [, /, and ] (process and I/O nodes)
      .replace(/^\(\[|\]\)$/g, "") // Remove ([ and ]) (start/end nodes)
      .replace(/^\{|\}$/g, ""); // Remove { and } (decision nodes)

    logDebug("Cleaned Node Text", `"${text}" -> "${cleaned}"`);
    return cleaned;
  }

  /**
   * Find logical start nodes for a flowchart, especially when dealing with cycles
   * @param {Object} graph - The flowchart graph object
   * @param {Set} hasIncoming - Set of nodes with incoming connections
   */
  function findLogicalStartNodes(graph, hasIncoming) {
    logDebug(
      "findLogicalStartNodes",
      "Finding logical start nodes for flowchart"
    );

    // Clear any existing start nodes
    graph.startNodes.clear();

    // First try to find nodes that explicitly match logical start criteria
    let potentialStartNodes = [];

    // Look for node A as the highest priority
    if (graph.nodes.has("A")) {
      logDebug("Found Primary Start Node", "A");
      potentialStartNodes.push({ node: "A", priority: 1 });
    }

    // Find nodes without incoming connections as second priority
    for (const [nodeId] of graph.nodes) {
      if (!hasIncoming.has(nodeId)) {
        // If this is node A, we already added it
        if (nodeId === "A") continue;

        // If the node ID starts with A (like A1), give it higher priority
        const priority = nodeId.startsWith("A") ? 2 : 3;
        potentialStartNodes.push({ node: nodeId, priority: priority });
        logDebug("No Incoming Node", nodeId);
      }
    }

    // Sort by priority (lower is better)
    potentialStartNodes.sort((a, b) => a.priority - b.priority);

    // If we found any start nodes, use them
    if (potentialStartNodes.length > 0) {
      // First add node A if it exists to ensure it's the primary start
      const aNode = potentialStartNodes.find((n) => n.node === "A");
      if (aNode) {
        graph.startNodes.add(aNode.node);
        logDebug("Added Primary Start Node", aNode.node);
      }

      // Then add other start nodes
      for (const { node } of potentialStartNodes) {
        if (node !== "A") {
          graph.startNodes.add(node);
          logDebug("Added Start Node", node);
        }
      }
    }
    // If we couldn't find any start nodes, try to find a logical starting point
    else {
      // Look for a node with "start", "begin", or "appointment" in its text
      for (const [nodeId, node] of graph.nodes) {
        if (
          node.text.toLowerCase().includes("start") ||
          node.text.toLowerCase().includes("begin") ||
          node.text.toLowerCase().includes("appointment")
        ) {
          graph.startNodes.add(nodeId);
          logDebug("Using Logical Start Node (by text)", nodeId);
          break;
        }
      }

      // If still no start nodes, use node A or first alphabetically
      if (graph.startNodes.size === 0) {
        if (graph.nodes.has("A")) {
          graph.startNodes.add("A");
          logDebug("Fallback to Node A", "A");
        } else {
          // Sort node IDs alphabetically and take the first one
          const firstNode = [...graph.nodes.keys()].sort()[0];
          graph.startNodes.add(firstNode);
          logDebug("Fallback to First Alphabetical Node", firstNode);
        }
      }
    }

    logDebug("Final Start Nodes", [...graph.startNodes]);
  }

  /**
   * Parse complete flowchart structure from mermaid code
   * @param {string} code - The mermaid diagram code
   * @returns {Object} Complete graph with nodes, connections and metadata
   */
  function parseFullFlowchart(code) {
    logInfo("parseFullFlowchart", "Starting to parse flowchart");
    logDebug(
      "Code Input",
      code.substring(0, 200) + (code.length > 200 ? "..." : "")
    );

    const graph = {
      nodes: new Map(),
      startNodes: new Set(),
    };

    const lines = code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    logDebug("Parsed Lines", `${lines.length} lines found`);

    // Step 1: Extract node definitions
    logDebug("Node Extraction", "Starting to extract nodes");
    const nodeRegex =
      /\s*([A-Za-z0-9_-]+)(?:\[\[([^\]]+)\]\]|\[\/?([^\/\]]+)\/?\]|\(\[([^\]]+)\]\)|\{([^}]+)\})/g;

    let nodeCount = 0;
    let decisionNodeCount = 0;

    for (const line of lines) {
      for (const match of line.matchAll(nodeRegex)) {
        nodeCount++;
        const id = match[1];

        // Get text from any of the possible bracket groups
        const text = match[2] || match[3] || match[4] || match[5] || id;

        // Clean the text to remove formatting characters
        const cleanedText = cleanNodeText(text);

        // Determine if this is a decision node (has {} syntax or contains a question mark)
        const isDecision = line.includes(`${id}{`) || cleanedText.includes("?");
        if (isDecision) decisionNodeCount++;

        graph.nodes.set(id, {
          id,
          text: cleanedText,
          isDecision,
          outEdges: [],
        });

        logDebug(
          "Node Found",
          `ID: ${id}, Text: "${cleanedText}", Decision: ${isDecision}`
        );
      }
    }

    logInfo(
      "Node Summary",
      `Found ${nodeCount} nodes (${decisionNodeCount} decision nodes)`
    );

    // Step 2: Extract connections
    logDebug("Connection Extraction", "Starting to extract connections");

    // Track nodes with incoming connections
    const hasIncoming = new Set();
    let connectionCount = 0;

    // Process connections from various syntax types
    for (const line of lines) {
      // Pattern 1: Labeled connections with pipe syntax: A -->|Yes| B
      const labeledPipeConnMatch = line.match(
        /\s*([A-Za-z0-9_-]+)\s*(?:-->|==>|-\.->)\|([^|]+)\|\s*([A-Za-z0-9_-]+)/
      );
      if (labeledPipeConnMatch) {
        const sourceId = labeledPipeConnMatch[1];
        const label = labeledPipeConnMatch[2].trim();
        const targetId = labeledPipeConnMatch[3];

        if (processConnection(sourceId, targetId, label, graph, hasIncoming)) {
          connectionCount++;
          logDebug(
            "Labeled Pipe Connection",
            `${sourceId} --[${label}]--> ${targetId}`
          );
        }
        continue;
      }

      // Pattern 2: Text label connections: A -- Yes --> B
      const textLabelConnMatch = line.match(
        /\s*([A-Za-z0-9_-]+)\s*--\s*([^-]+?)\s*-->\s*([A-Za-z0-9_-]+)/
      );
      if (textLabelConnMatch) {
        const sourceId = textLabelConnMatch[1];
        const label = textLabelConnMatch[2].trim();
        const targetId = textLabelConnMatch[3];

        if (processConnection(sourceId, targetId, label, graph, hasIncoming)) {
          connectionCount++;
          logDebug(
            "Text Labeled Connection",
            `${sourceId} --[${label}]--> ${targetId}`
          );
        }
        continue;
      }

      // Pattern 3: Standard connections: A --> B
      const standardConnMatch = line.match(
        /\s*([A-Za-z0-9_-]+)\s*(?:-->|==>|-\.->)\s*([A-Za-z0-9_-]+)/
      );
      if (standardConnMatch) {
        const sourceId = standardConnMatch[1];
        const targetId = standardConnMatch[2];

        // Skip if this is part of a labeled connection we've already processed
        if (
          line.includes(`${sourceId} -->|`) &&
          line.includes(`| ${targetId}`)
        ) {
          logDebug("Skipping Already Processed", `${sourceId} --> ${targetId}`);
          continue;
        }
        if (
          line.includes(`${sourceId} --`) &&
          line.includes(`--> ${targetId}`)
        ) {
          logDebug("Skipping Labeled Edge", `${sourceId} --> ${targetId}`);
          continue;
        }

        if (processConnection(sourceId, targetId, "", graph, hasIncoming)) {
          connectionCount++;
          logDebug("Standard Connection", `${sourceId} --> ${targetId}`);
        }
      }
    }

    logInfo("Connection Summary", `Found ${connectionCount} connections`);

    // Step 3: Identify potential decision nodes based on outgoing edges
    // Some decision nodes might not be explicitly marked with {} but have multiple outgoing edges
    for (const [nodeId, node] of graph.nodes.entries()) {
      if (!node.isDecision && node.outEdges.length > 1) {
        const allLabeled = node.outEdges.every((edge) => edge.label);

        // If all outgoing edges have labels, this is likely a decision node
        if (allLabeled) {
          logDebug(
            "Decision Node Detection",
            `Node ${nodeId} reclassified as decision node based on labeled outgoing edges`
          );
          node.isDecision = true;
        }
      }
    }

    // Step 4: Find the logical starting point
    findLogicalStartNodes(graph, hasIncoming);

    logInfo("Graph Structure Finalised", "Final graph structure:");
    logDebug("Node Count", graph.nodes.size);
    logDebug("Start Nodes", [...graph.startNodes]);

    // Log a sample of nodes with their connections
    let sampleNodes = [];
    let i = 0;
    for (const [id, node] of graph.nodes) {
      if (i++ < 5) {
        // Log first 5 nodes as sample
        sampleNodes.push({
          id: node.id,
          text: node.text,
          isDecision: node.isDecision,
          outEdges: node.outEdges,
        });
      }
    }
    logDebug("Sample Nodes", sampleNodes);

    return graph;
  }

  /**
   * Helper function to process a connection between nodes
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {string} label - Connection label
   * @param {Object} graph - The graph object
   * @param {Set} hasIncoming - Set to track nodes with incoming connections
   * @returns {boolean} True if connection was processed
   */
  function processConnection(sourceId, targetId, label, graph, hasIncoming) {
    // Skip invalid IDs to prevent treating edge labels as nodes
    if (
      sourceId === "Yes" ||
      sourceId === "No" ||
      targetId === "Yes" ||
      targetId === "No"
    ) {
      logWarn(
        "Invalid Node ID",
        `Skipping edge label as node: ${sourceId} -> ${targetId}`
      );
      return false;
    }

    // Skip if either node ID is empty
    if (!sourceId.trim() || !targetId.trim()) {
      return false;
    }

    // Create nodes if they don't exist
    if (!graph.nodes.has(sourceId)) {
      graph.nodes.set(sourceId, {
        id: sourceId,
        text: sourceId,
        isDecision: false,
        outEdges: [],
      });
      logDebug("Created Missing Source Node", sourceId);
    }

    if (!graph.nodes.has(targetId)) {
      graph.nodes.set(targetId, {
        id: targetId,
        text: targetId,
        isDecision: false,
        outEdges: [],
      });
      logDebug("Created Missing Target Node", targetId);
    }

    // Add the edge to the source node
    const sourceNode = graph.nodes.get(sourceId);
    sourceNode.outEdges.push({ targetId, label });

    // Mark that the target has an incoming connection
    hasIncoming.add(targetId);

    return true;
  }

  /**
   * Determine logical order of nodes for the description
   * @param {Object} graph - Complete flowchart graph structure
   * @returns {Object} Ordered nodes and map of node IDs to step numbers
   */
  function determineNodeOrder(graph) {
    logDebug("determineNodeOrder", "Determining node order");

    const orderedNodes = [];
    const nodeToStep = new Map();
    const visited = new Set();

    // Prioritize node A as the starting point if present
    let startNodesList = [...graph.startNodes];

    // Re-sort start nodes to ensure A comes first
    startNodesList.sort((a, b) => {
      if (a === "A") return -1;
      if (b === "A") return 1;
      return a.localeCompare(b);
    });

    logDebug("Prioritised Start Nodes", startNodesList);

    // Start traversal from prioritized start nodes
    const queue = [...startNodesList];

    // Keep track of missing edges for cycle detection
    const processedEdges = new Set();

    let iterations = 0;
    while (queue.length > 0 && iterations < 1000) {
      // Prevent infinite loops
      iterations++;
      const nodeId = queue.shift();

      if (visited.has(nodeId)) {
        logDebug("Skip Node", `Node ${nodeId} already visited`);
        continue;
      }

      const node = graph.nodes.get(nodeId);
      if (!node) {
        logWarn("Missing Node", `Node ${nodeId} not found in graph`);
        continue;
      }

      // Add node to the ordered list and mark as visited
      visited.add(nodeId);
      orderedNodes.push(node);
      logDebug(
        "Add to Order",
        `Added node ${nodeId} (${node.text}) to position ${orderedNodes.length}`
      );

      // Process outgoing edges
      if (node.outEdges.length > 0) {
        logDebug(
          "Node Edges",
          `Node ${nodeId} has ${node.outEdges.length} edges`
        );

        // Sort edges to ensure consistent ordering
        const sortedEdges = [...node.outEdges];
        sortedEdges.sort((a, b) => {
          // Prioritise edges by label: Empty, then No, then Yes, then others alphabetically
          if (a.label === "" && b.label !== "") return -1;
          if (a.label !== "" && b.label === "") return 1;
          if (a.label === "No" && b.label !== "No") return -1;
          if (a.label !== "No" && b.label === "No") return 1;
          if (a.label === "Yes" && b.label !== "Yes") return -1;
          if (a.label !== "Yes" && b.label === "Yes") return 1;
          return a.targetId.localeCompare(b.targetId);
        });

        // Add each target to the queue if not visited
        sortedEdges.forEach((edge) => {
          const edgeSignature = `${nodeId}->${edge.targetId}`;
          processedEdges.add(edgeSignature);

          logDebug(
            "Edge",
            `${nodeId} -> ${edge.targetId}${
              edge.label ? ` (${edge.label})` : ""
            }`
          );

          if (!visited.has(edge.targetId)) {
            queue.push(edge.targetId);
            logDebug("Queue Add", `Added ${edge.targetId} to queue`);
          } else {
            logDebug("Skip Edge", `${edge.targetId} already visited`);
          }
        });
      }
    }

    // Check for nodes that weren't visited (disconnected parts of the graph)
    const unvisitedNodes = [...graph.nodes.keys()].filter(
      (id) => !visited.has(id)
    );
    if (unvisitedNodes.length > 0) {
      logWarn(
        "Graph Completeness",
        `Found ${unvisitedNodes.length} unvisited nodes`
      );

      // Add them to the end of the ordered list
      unvisitedNodes.forEach((nodeId) => {
        const node = graph.nodes.get(nodeId);
        if (node) {
          orderedNodes.push(node);
          visited.add(nodeId);
          logDebug(
            "Add Unvisited",
            `Added unvisited node ${nodeId} to position ${orderedNodes.length}`
          );
        }
      });
    }

    // Assign step numbers to all nodes
    orderedNodes.forEach((node, index) => {
      nodeToStep.set(node.id, index + 1);
    });

    logInfo("Node Order Complete", `${orderedNodes.length} nodes ordered`);

    // Log the first few ordered nodes for verification
    logDebug(
      "Ordered Nodes Sample",
      orderedNodes.slice(0, 5).map((n) => ({
        id: n.id,
        text: n.text,
        isDecision: n.isDecision,
        step: nodeToStep.get(n.id),
      }))
    );

    return { orderedNodes, nodeToStep };
  }

  /**
   * Check if a string is a valid node ID (not a label or keyword)
   * @param {string} id - The ID to check
   * @returns {boolean} True if it's a valid node ID
   */
  function isValidNodeId(id) {
    const invalidIds = ["Yes", "No", "Otherwise", "true", "false"];
    return !invalidIds.includes(id);
  }

  /**
   * Build a complete map of all connections between nodes
   * @param {Object} graph - The graph object
   * @param {string} code - The original mermaid code
   * @returns {Map} Map of node IDs to arrays of their connections
   */
  function buildCompleteConnectionMap(graph, code) {
    const connectionMap = new Map();

    // First add existing connections from our graph
    for (const [nodeId, node] of graph.nodes) {
      connectionMap.set(nodeId, [...(node.outEdges || [])]);
    }

    // Extract all connections from the original code
    const lines = code.split("\n");

    // Process all connection types from the mermaid code
    for (const line of lines) {
      // Skip non-connection lines
      if (!line.includes("-->") && !line.includes("--")) continue;

      // Log the line we're processing for debugging
      logDebug("Processing Line", line.trim());

      // Improved regex for standard connections with better handling of brackets
      // This handles various formats like:
      // A --> B
      // A[Label] --> B[Label]
      // A([Label]) --> B([Label])
      // A{Label} --> B{Label}
      // A((Label)) --> B((Label))
      const standardMatch = line.match(
        /\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}|\(\([^\)]*\)\)|\[\{[^\}]*\}\])?\s*-->\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}|\(\([^\)]*\)\)|\[\{[^\}]*\}\])?/
      );

      // Make sure this isn't a labeled connection (which we handle separately)
      const isLabeledConnection =
        line.includes("--|") || line.includes("-- ") || line.includes("-->|");

      if (standardMatch && !isLabeledConnection) {
        const sourceId = standardMatch[1];
        const targetId = standardMatch[2];

        logDebug("Found Standard Connection", `${sourceId} --> ${targetId}`);

        // Skip invalid node IDs
        if (!isValidNodeId(sourceId) || !isValidNodeId(targetId)) {
          logWarn(
            "Invalid Node",
            `Skipping invalid node ID: ${sourceId} or ${targetId}`
          );
          continue;
        }

        // Ensure the nodes exist in our graph
        if (graph.nodes.has(sourceId) && graph.nodes.has(targetId)) {
          if (!connectionMap.has(sourceId)) {
            connectionMap.set(sourceId, []);
          }

          // Add if not already present
          if (
            !connectionMap
              .get(sourceId)
              .some((conn) => conn.targetId === targetId)
          ) {
            connectionMap.get(sourceId).push({ targetId, label: "" });
            logDebug(
              "Added Standard Connection",
              `${sourceId} --> ${targetId}`
            );
          }
        } else {
          logWarn(
            "Missing Node",
            `Source: ${sourceId} (exists: ${graph.nodes.has(
              sourceId
            )}) or Target: ${targetId} (exists: ${graph.nodes.has(targetId)})`
          );
        }
      }

      // Also handle labeled connections more specifically
      if (isLabeledConnection) {
        // Handle "A -- Yes --> B" format
        const textLabelMatch = line.match(
          /\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\})?\s*--\s*([^-]+?)\s*-->\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\})?/
        );

        if (textLabelMatch) {
          const sourceId = textLabelMatch[1];
          const label = textLabelMatch[2].trim();
          const targetId = textLabelMatch[3];

          logDebug(
            "Found Text Label Connection",
            `${sourceId} --[${label}]--> ${targetId}`
          );

          if (
            isValidNodeId(sourceId) &&
            isValidNodeId(targetId) &&
            graph.nodes.has(sourceId) &&
            graph.nodes.has(targetId)
          ) {
            if (!connectionMap.has(sourceId)) {
              connectionMap.set(sourceId, []);
            }

            if (
              !connectionMap
                .get(sourceId)
                .some((conn) => conn.targetId === targetId)
            ) {
              connectionMap.get(sourceId).push({ targetId, label });
              logDebug(
                "Added Labelled Connection",
                `${sourceId} --[${label}]--> ${targetId}`
              );
            }
          }
        }

        // Handle "A -->|Yes| B" format
        const pipeConnMatch = line.match(
          /\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\})?\s*(?:-->|==>|-\.->)\|([^|]+)\|\s*([A-Za-z0-9_-]+)(?:\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\})?/
        );

        if (pipeConnMatch) {
          const sourceId = pipeConnMatch[1];
          const label = pipeConnMatch[2].trim();
          const targetId = pipeConnMatch[3];

          logDebug(
            "Found Pipe Label Connection",
            `${sourceId} -->|${label}| ${targetId}`
          );

          if (
            isValidNodeId(sourceId) &&
            isValidNodeId(targetId) &&
            graph.nodes.has(sourceId) &&
            graph.nodes.has(targetId)
          ) {
            if (!connectionMap.has(sourceId)) {
              connectionMap.set(sourceId, []);
            }

            if (
              !connectionMap
                .get(sourceId)
                .some((conn) => conn.targetId === targetId)
            ) {
              connectionMap.get(sourceId).push({ targetId, label });
              logDebug(
                "Added Pipe Labelled Connection",
                `${sourceId} -->|${label}| ${targetId}`
              );
            }
          }
        }
      }
    }

    return connectionMap;
  }

  function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating flowchart description");

    // Add a local formatList utility function if the Common module's isn't available
    const formatList = function (items) {
      if (!items || items.length === 0) return "";
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} and ${items[1]}`;

      // For 3 or more items, use Oxford comma
      const lastItem = items[items.length - 1];
      const otherItems = items.slice(0, -1);
      return `${otherItems.join(", ")}, and ${lastItem}`;
    };

    // Try to use the Common module's formatList if available
    const formatStepsList =
      window.MermaidAccessibilityCommon &&
      typeof window.MermaidAccessibilityCommon.formatList === "function"
        ? window.MermaidAccessibilityCommon.formatList
        : formatList;

    // Parse the flowchart structure from the code
    const graph = parseFullFlowchart(code);

    // Get ordered nodes and step numbers
    const { orderedNodes, nodeToStep } = determineNodeOrder(graph);

    logInfo(
      "Description Generation",
      `Building description for ${orderedNodes.length} nodes`
    );

    // Build a complete map of connections for every node
    const fullConnections = buildCompleteConnectionMap(graph, code);

    // Log some statistics about the nodes
    const decisionNodes = orderedNodes.filter((n) => n.isDecision).length;
    const terminalNodes = orderedNodes.filter((n) => {
      // Improved terminal node detection
      const connections = fullConnections.get(n.id) || [];

      // Enhanced check for connections in code
      const hasConnectionsInCode = (function () {
        // Check for various connection patterns
        const patterns = [
          // Standard connection patterns (with or without spaces)
          new RegExp(`${n.id}\\s*-->`, "i"),
          new RegExp(`${n.id}\\[.*?\\]\\s*-->`, "i"),
          new RegExp(`${n.id}\\(.*?\\)\\s*-->`, "i"),
          new RegExp(`${n.id}\\{.*?\\}\\s*-->`, "i"),

          // Label connection patterns
          new RegExp(`${n.id}\\s*--\\s+.*?\\s*-->`, "i"),
          new RegExp(`${n.id}\\[.*?\\]\\s*--\\s+.*?\\s*-->`, "i"),

          // Pipe label connection patterns
          new RegExp(`${n.id}\\s*-->\\|`, "i"),
          new RegExp(`${n.id}\\[.*?\\]\\s*-->\\|`, "i"),
        ];

        // Check each pattern against the code
        return patterns.some((pattern) => pattern.test(code));
      })();

      return connections.length === 0 && !hasConnectionsInCode;
    }).length;

    logDebug(
      "Node Statistics",
      `Decision nodes: ${decisionNodes}, Terminal nodes: ${terminalNodes}`
    );

    // Build the HTML description
    let description = "<ol class='flowchart-steps'>";

    // Generate the description with proper step numbers
    for (let i = 0; i < orderedNodes.length; i++) {
      const node = orderedNodes[i];
      const stepNumber = i + 1;

      if (node.isDecision) {
        // Decision node with multiple paths
        description += `<li><span class="diagram-decision">${node.text}</span>`;

        const connections = fullConnections.get(node.id) || [];
        if (connections.length > 0) {
          description += "\n<ul class='decision-paths'>";

          // Sort connections by label: 'Yes' first, then 'No', then others alphabetically
          connections.sort((a, b) => {
            if (a.label === "Yes" && b.label !== "Yes") return -1;
            if (a.label !== "Yes" && b.label === "Yes") return 1;
            if (a.label === "No" && b.label !== "No") return -1;
            if (a.label !== "No" && b.label === "No") return 1;
            return a.label.localeCompare(b.label);
          });

          for (const connection of connections) {
            const targetStep = nodeToStep.get(connection.targetId);
            if (targetStep) {
              const condition = connection.label || "Otherwise";
              const targetStepText = formatStepNumber(targetStep);

              description += `<li>If ${condition}, go to step ${targetStepText}.</li>`;

              logDebug(
                "Decision Path",
                `If ${condition}, go to step ${targetStepText}`
              );
            }
          }

          description += "</ul>";
        }

        description += "</li>";
      } else {
        // Check if this is a terminal node - a node with no outgoing connections
        const connections = fullConnections.get(node.id) || [];

        // Enhanced check for connections in code
        const hasConnectionsInCode = (function () {
          // Check for various connection patterns
          const patterns = [
            // Standard connection patterns (with or without spaces)
            new RegExp(`${node.id}\\s*-->`, "i"),
            new RegExp(`${node.id}\\[.*?\\]\\s*-->`, "i"),
            new RegExp(`${node.id}\\(.*?\\)\\s*-->`, "i"),
            new RegExp(`${node.id}\\{.*?\\}\\s*-->`, "i"),

            // Label connection patterns
            new RegExp(`${node.id}\\s*--\\s+.*?\\s*-->`, "i"),
            new RegExp(`${node.id}\\[.*?\\]\\s*--\\s+.*?\\s*-->`, "i"),

            // Pipe label connection patterns
            new RegExp(`${node.id}\\s*-->\\|`, "i"),
            new RegExp(`${node.id}\\[.*?\\]\\s*-->\\|`, "i"),
          ];

          // Additional debug to help troubleshoot
          if (node.id === "D") {
            patterns.forEach((pattern) => {
              logDebug(
                "Pattern Test for D",
                `Pattern: ${pattern.toString()}, Result: ${pattern.test(code)}`
              );
            });

            // Extract the relevant part of the code that might contain D's connection
            const relevantCode = code
              .split("\n")
              .filter((line) => line.includes(node.id))
              .join("\n");
            logDebug("Relevant Code for D", relevantCode);
          }

          // Check each pattern against the code
          return patterns.some((pattern) => pattern.test(code));
        })();

        const isTerminal = connections.length === 0 && !hasConnectionsInCode;

        if (isTerminal) {
          // Terminal node (no outgoing edges)
          description += `<li class="terminal-node"><span class="diagram-node">${node.text}</span></li>`;
          logDebug("Terminal Node", `${node.text} (end of path)`);
        } else if (connections.length === 1) {
          // Single outgoing edge - show destination
          const targetStep = nodeToStep.get(connections[0].targetId);
          if (targetStep) {
            const targetStepText = formatStepNumber(targetStep);

            description += `<li><span class="diagram-action">${node.text}</span>. Proceed to step ${targetStepText}.</li>`;

            logDebug(
              "Action Node (Single Path)",
              `${node.text} -> step ${targetStepText}`
            );
          } else {
            // In case target step isn't found, show as a regular node
            description += `<li><span class="diagram-node">${node.text}</span></li>`;
            logWarn(
              "Missing Target",
              `${node.text} -> ${connections[0].targetId} (not found)`
            );
          }
        } else if (connections.length > 1) {
          // Multiple outgoing edges without being a decision node
          const validTargetSteps = connections
            .map((conn) => nodeToStep.get(conn.targetId))
            .filter((step) => !!step);

          if (validTargetSteps.length > 0) {
            const uniqueTargetSteps = [...new Set(validTargetSteps)].sort(
              (a, b) => a - b
            );

            // Format step numbers as words
            const formattedSteps = uniqueTargetSteps.map((step) =>
              formatStepNumber(step)
            );

            // Use our formatStepsList function that's guaranteed to be available
            const stepsText = formatStepsList(formattedSteps);

            description += `<li><span class="diagram-action">${node.text}</span>. Proceed to steps ${stepsText}.</li>`;

            logDebug(
              "Action Node (Multiple Paths)",
              `${node.text} -> steps ${stepsText}`
            );
          } else {
            // In case no valid target steps are found but the code shows connections
            description += `<li><span class="diagram-node">${node.text}</span></li>`;
            logWarn("No Valid Targets", `${node.text} (no valid targets)`);
          }
        } else if (hasConnectionsInCode) {
          // Node has connections in original code but they weren't detected in our graph
          // Let's try to infer the target node from the code
          const potentialTargets = findPotentialTargetsInCode(code, node.id);

          if (potentialTargets.length > 0) {
            const targetSteps = potentialTargets
              .map((targetId) => nodeToStep.get(targetId))
              .filter((step) => !!step);

            if (targetSteps.length > 0) {
              const targetStep = targetSteps[0]; // Use the first target found
              const targetStepText = formatStepNumber(targetStep);

              description += `<li><span class="diagram-action">${node.text}</span> then to step ${targetStepText}</li>`;
              logDebug(
                "Inferred Connection",
                `${node.text} -> step ${targetStepText}`
              );
            } else {
              // Fallback - just show as action node
              description += `<li><span class="diagram-action">${node.text}</span></li>`;
              logDebug(
                "Action Node (Inferred)",
                `${node.text} (no target steps found)`
              );
            }
          } else {
            description += `<li><span class="diagram-action">${node.text}</span></li>`;
            logDebug(
              "Hidden Connections",
              `${node.text} (has connections in code, none detected in graph)`
            );
          }
        } else {
          // Fallback for any other node
          description += `<li><span class="diagram-node">${node.text}</span></li>`;
          logDebug("Fallback Node", `${node.text}`);
        }
      }
    }

    description += "</ol>";

    logInfo(
      "Description Complete",
      `Generated description of length ${description.length}`
    );

    return description;
  }

  /**
   * Try to find potential target nodes from a node in the original code
   * @param {string} code - The mermaid code
   * @param {string} nodeId - The source node ID
   * @returns {string[]} Array of potential target node IDs
   */
  function findPotentialTargetsInCode(code, nodeId) {
    const potentialTargets = [];

    // Different patterns to find connections
    const patterns = [
      // Basic pattern: nodeId --> targetId
      new RegExp(`${nodeId}\\s*-->\\s*([A-Za-z0-9_-]+)`, "g"),

      // With brackets: nodeId[Label] --> targetId[Label]
      new RegExp(`${nodeId}\\[.*?\\]\\s*-->\\s*([A-Za-z0-9_-]+)(?:\\[|$)`, "g"),

      // With labeled arrows: nodeId -- Label --> targetId
      new RegExp(
        `${nodeId}(?:\\[.*?\\])?\\s*--\\s+.*?\\s*-->\\s*([A-Za-z0-9_-]+)`,
        "g"
      ),

      // With pipe labels: nodeId -->|Label| targetId
      new RegExp(
        `${nodeId}(?:\\[.*?\\])?\\s*-->\\|.*?\\|\\s*([A-Za-z0-9_-]+)`,
        "g"
      ),
    ];

    // Extract all matches from each pattern
    patterns.forEach((pattern) => {
      let match;
      const codeToSearch = code.replace(/\n/g, " "); // Replace newlines for multiline matching

      while ((match = pattern.exec(codeToSearch)) !== null) {
        if (match[1] && !potentialTargets.includes(match[1])) {
          potentialTargets.push(match[1]);
        }
      }
    });

    logDebug(
      "Potential Targets",
      `For node ${nodeId}: ${potentialTargets.join(", ")}`
    );
    return potentialTargets;
  }

  /**
   * Format step numbers according to British English guidelines:
   * - Numbers 0-9 as words
   * - Numbers 10+ as numerals
   * @param {number} step - The step number
   * @returns {string} Formatted step number
   */
  function formatStepNumber(step) {
    const numberWords = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];

    if (step >= 0 && step <= 9) {
      return numberWords[step];
    }

    return step.toString();
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("flowchart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
    // Add a flag to help with CSS class application
    diagramType: "flowchart",
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "Flowchart Module",
    "Flowchart module loaded and registered with enhanced parsing for complex diagrams"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = FlowchartModule;
} else {
  window.FlowchartModule = FlowchartModule;
}
