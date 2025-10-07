/**
 * Mermaid Accessibility - Architecture Module (Improved)
 * Generates accessible descriptions for architecture diagrams
 */
const MermaidAccessibilityArchitecture = (function () {
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

  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data
   */
  function logError(message, data) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      if (data) {
        console.error(`[Mermaid Accessibility] ${message}`, data);
      } else {
        console.error(`[Mermaid Accessibility] ${message}`);
      }
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data
   */
  function logWarn(message, data) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      if (data) {
        console.warn(`[Mermaid Accessibility] ${message}`, data);
      } else {
        console.warn(`[Mermaid Accessibility] ${message}`);
      }
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data
   */
  function logInfo(message, data) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      if (data) {
        console.log(`[Mermaid Accessibility] ${message}`, data);
      } else {
        console.log(`[Mermaid Accessibility] ${message}`);
      }
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data
   */
  function logDebug(message, data) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      if (data) {
        console.debug(`[Mermaid Accessibility] ${message}`, data);
      } else {
        console.debug(`[Mermaid Accessibility] ${message}`);
      }
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;
  const Common = window.MermaidAccessibilityCommon;

  /**
   * Generate a short description for an architecture diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {Object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    try {
      logDebug("Generating short description for architecture diagram");

      // Parse the architecture structure
      const architecture = parseArchitecture(code, svgElement);

      // Extract title (if it exists)
      const title = architecture.title || null;

      // Count groups, services, edges, and junctions
      const groupCount = architecture.groups.length;
      const serviceCount = architecture.services.length;
      const edgeCount = architecture.edges.length;
      const junctionCount = architecture.junctions.length;

      logDebug(
        `Architecture parsed - Services: ${serviceCount}, Groups: ${groupCount}, Edges: ${edgeCount}, Junctions: ${junctionCount}`
      );

      // Determine top-level groups (those without parents)
      const topLevelGroups = architecture.groups.filter(
        (group) => !group.parentId
      );

      // Build HTML description
      let htmlDescription = `An architecture diagram`;

      // Only include title if it's explicitly provided
      if (title) {
        htmlDescription += ` titled "<span class="diagram-title">${title}</span>"`;
      }

      // Add counts of key elements with proper singular/plural forms
      htmlDescription += ` containing <span class="diagram-count">${serviceCount}</span>`;

      // Only include the spelled-out version, not the digit again
      if (serviceCount === 1) {
        htmlDescription += " service";
      } else {
        htmlDescription += " services";
      }

      if (groupCount > 0) {
        htmlDescription += ` organised into <span class="diagram-count">${groupCount}</span>`;
        htmlDescription += groupCount === 1 ? " group" : " groups";
      }

      if (edgeCount > 0) {
        htmlDescription += ` with <span class="diagram-count">${edgeCount}</span>`;
        htmlDescription += edgeCount === 1 ? " connection" : " connections";
      }

      if (junctionCount > 0) {
        htmlDescription += ` and <span class="diagram-count">${junctionCount}</span>`;
        htmlDescription += junctionCount === 1 ? " junction" : " junctions";
      }

      // Add main groups if there aren't too many
      if (topLevelGroups.length > 0 && topLevelGroups.length <= 5) {
        htmlDescription += `. The main ${
          topLevelGroups.length === 1 ? "group is" : "groups are"
        }: <span class="architecture-main-groups">`;

        const groupNames = topLevelGroups
          .map(
            (group) =>
              `<span class="architecture-group-name">${group.title}</span>`
          )
          .join(", ");

        htmlDescription += groupNames;
        htmlDescription += `</span>`;
      }

      htmlDescription += `.`;

      // Plain text version (without HTML tags)
      let plainTextDescription = htmlDescription.replace(/<[^>]*>/g, "");

      logDebug("Short description generated successfully");

      return {
        html: htmlDescription,
        text: plainTextDescription,
      };
    } catch (error) {
      logError("Error generating short description:", error);
      return {
        html: `An architecture diagram.`,
        text: `An architecture diagram.`,
      };
    }
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The plain text description for backwards compatibility
   */
  function shortDescriptionWrapper(svgElement, code) {
    const descriptions = generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Parse architecture diagram structure from mermaid code
   * @param {string} code - The mermaid code
   * @param {HTMLElement} svgElement - The SVG element (fallback)
   * @returns {Object} Parsed diagram data
   */
  function parseArchitecture(code, svgElement) {
    logDebug("Starting architecture parsing");

    // Initialize result structure
    const result = {
      title: null,
      groups: [],
      services: [],
      edges: [],
      junctions: [],
      // Maps for quick lookups
      groupMap: new Map(),
      serviceMap: new Map(),
      junctionMap: new Map(),
    };

    try {
      // Clean the code
      const cleanCode = code.replace(/%%\{init:[\s\S]*?\}%%/g, "").trim();

      // Skip the 'architecture-beta' declaration if present
      const lines = cleanCode
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.match(/^architecture-beta$/i));

      logDebug(`Processing ${lines.length} lines of mermaid code`);

      // First pass: Extract groups, services, and junctions
      for (const line of lines) {
        // Extract title if present
        const titleMatch = line.match(/title\s+([^\n]+)/i);
        if (titleMatch) {
          result.title = titleMatch[1].trim();
          logDebug(`Found title: ${result.title}`);
          continue;
        }

        // Extract groups
        const groupMatch = line.match(
          /group\s+(\w+)(?:\(([^)]+)\))?(?:\[([^\]]+)\])?\s*(?:in\s+(\w+))?/
        );
        if (groupMatch) {
          const [_, id, icon, title, parentId] = groupMatch;
          const group = {
            id,
            icon: icon || null,
            title: title || id,
            parentId: parentId || null,
            children: [],
          };

          result.groups.push(group);
          result.groupMap.set(id, group);
          logDebug(`Added group: ${group.title} (${group.id})`);
          continue;
        }

        // Extract services
        const serviceMatch = line.match(
          /service\s+(\w+)(?:\(([^)]+)\))?(?:\[([^\]]+)\])?\s*(?:in\s+(\w+))?/
        );
        if (serviceMatch) {
          const [_, id, icon, title, parentId] = serviceMatch;
          const service = {
            id,
            icon: icon || null,
            title: title || id,
            parentId: parentId || null,
          };

          result.services.push(service);
          result.serviceMap.set(id, service);
          logDebug(`Added service: ${service.title} (${service.id})`);
          continue;
        }

        // Extract junctions
        const junctionMatch = line.match(/junction\s+(\w+)(?:\s+in\s+(\w+))?/);
        if (junctionMatch) {
          const [_, id, parentId] = junctionMatch;
          const junction = {
            id,
            parentId: parentId || null,
          };

          result.junctions.push(junction);
          result.junctionMap.set(id, junction);
          logDebug(`Added junction: ${junction.id}`);
          continue;
        }

        // Extract edges
        const edgeMatch = line.match(
          /(\w+)(?:\{group\})?:([TBLR])\s+(<?-+>?)\s+([TBLR]):(\w+)(?:\{group\})?/
        );
        if (edgeMatch) {
          const [_, sourceId, sourceSide, connection, targetSide, targetId] =
            edgeMatch;

          const edge = {
            sourceId,
            sourceSide,
            targetId,
            targetSide,
            hasLeftArrow: connection.startsWith("<"),
            hasRightArrow: connection.endsWith(">"),
            sourceIsGroup: line.includes(`${sourceId}{group}`),
            targetIsGroup: line.includes(`${targetId}{group}`),
          };

          result.edges.push(edge);
          logDebug(`Added edge: ${sourceId} -> ${targetId}`);
        }
      }

      // Second pass: Build the hierarchy (assign children to parents)
      result.groups.forEach((group) => {
        if (group.parentId) {
          const parent = result.groupMap.get(group.parentId);
          if (parent) {
            // Add this group as a child of its parent
            if (!parent.children) parent.children = [];
            parent.children.push({
              type: "group",
              id: group.id,
            });
            logDebug(`Added group ${group.id} as child of ${parent.id}`);
          }
        }
      });

      result.services.forEach((service) => {
        if (service.parentId) {
          const parent = result.groupMap.get(service.parentId);
          if (parent) {
            // Add this service as a child of its parent group
            if (!parent.children) parent.children = [];
            parent.children.push({
              type: "service",
              id: service.id,
            });
            logDebug(`Added service ${service.id} as child of ${parent.id}`);
          }
        }
      });

      result.junctions.forEach((junction) => {
        if (junction.parentId) {
          const parent = result.groupMap.get(junction.parentId);
          if (parent) {
            // Add this junction as a child of its parent group
            if (!parent.children) parent.children = [];
            parent.children.push({
              type: "junction",
              id: junction.id,
            });
            logDebug(`Added junction ${junction.id} as child of ${parent.id}`);
          }
        }
      });

      logInfo(
        `Architecture parsing completed - ${result.groups.length} groups, ${result.services.length} services, ${result.edges.length} edges`
      );
      return result;
    } catch (error) {
      logError("Error parsing architecture diagram:", error);
      return result;
    }
  }

  /**
   * Generate a detailed description for an architecture diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("Generating architecture description");

    try {
      // Parse the architecture diagram
      const architecture = parseArchitecture(code, svgElement);

      // Extract title (only if explicitly provided)
      const title = architecture.title || null;

      // Prepare the detailed description sections

      // 1. Overview section stats
      const stats = {
        elementCount: architecture.services.length,
        elementName: "services",
        groupCount: architecture.groups.length,
        groupName: "groups",
      };

      // 2. Structure section (groups and their hierarchy)
      const structureSection = generateStructureSection(architecture);

      // 3. Services section (details about services and their icons)
      const servicesSection = generateServicesSection(architecture);

      // 4. Connections section (details about edges and their directions)
      const connectionsSection = generateConnectionsSection(architecture);

      // 5. Insights section
      const insights = generateInsights(architecture);

      // 6. Visual representation notes
      const visualNotes = generateVisualNotes(architecture);

      // Build overview content based on presence of title
      let overviewContent = `<p>This architecture diagram`;

      if (title) {
        overviewContent += ` titled "<span class="diagram-title">${title}</span>"`;
      }

      overviewContent += ` contains <span class="diagram-count">${stats.elementCount}</span>`;

      // Proper singular/plural format
      overviewContent += ` ${
        stats.elementCount === 1 ? "service" : "services"
      }.`;

      const overviewSection = Common.createSection(
        "overview",
        "architecture",
        "Architecture Overview",
        overviewContent
      );

      // Combine all sections to create the complete description
      let description = `<div class="architecture-description">`;
      description += overviewSection;
      description += structureSection;
      description += servicesSection;
      description += connectionsSection;

      if (insights && insights.length > 0) {
        description += Common.createInsightsSection("architecture", insights);
      }

      if (visualNotes) {
        description += Common.createSection(
          "visual-notes",
          "architecture",
          "Visual Representation",
          `<p>${visualNotes}</p>`
        );
      }

      description += `</div>`;

      logInfo("Detailed description generated successfully");
      return description;
    } catch (error) {
      return Common.handleParsingError(error, "architecture");
    }
  }

  /**
   * Generate a structure section describing the groups and hierarchy
   * @param {Object} architecture - Parsed architecture data
   * @returns {string} HTML section
   */
  function generateStructureSection(architecture) {
    logDebug("Generating structure section");

    // Skip if no groups
    if (architecture.groups.length === 0) {
      return Common.createSection(
        "structure",
        "architecture",
        "System Structure",
        `<p>This architecture diagram does not define any specific groups. All services are at the top level.</p>`,
        { role: "region" }
      );
    }

    // Find top-level groups
    const topLevelGroups = architecture.groups.filter(
      (group) => !group.parentId
    );

    // Fix redundant numbers issue
    let content = `<p>This architecture is organised into <span class="diagram-count">${architecture.groups.length}</span>`;

    // Proper singular/plural format
    content += architecture.groups.length === 1 ? " group" : " groups";

    if (hasNestedGroups(architecture)) {
      content += ` with nested hierarchy`;
    }

    content += `.</p>`;

    // Create a hierarchical list of groups
    content += `<ul class="architecture-groups-list">`;

    // Add each top-level group with its children
    topLevelGroups.forEach((group) => {
      content += renderGroupHierarchy(group, architecture);
    });

    content += `</ul>`;

    return Common.createSection(
      "structure",
      "architecture",
      "System Structure",
      content,
      { role: "region" }
    );
  }

  /**
   * Check if the architecture has nested groups
   * @param {Object} architecture - Parsed architecture data
   * @returns {boolean} True if there are nested groups
   */
  function hasNestedGroups(architecture) {
    return architecture.groups.some((group) => group.parentId);
  }

  /**
   * Render a group and its children as HTML
   * @param {Object} group - The group to render
   * @param {Object} architecture - The complete architecture data
   * @returns {string} HTML representation of the group hierarchy
   */
  function renderGroupHierarchy(group, architecture) {
    logDebug(`Rendering hierarchy for group: ${group.title}`);

    let html = `<li class="architecture-group">
      <span class="architecture-group-name">${group.title}</span>`;

    // Add icon information if present
    if (group.icon) {
      html += ` <span class="architecture-icon-info">(represented by ${group.icon} icon)</span>`;
    }

    // Get direct children
    const children = group.children || [];

    if (children.length > 0) {
      html += `<ul class="architecture-children">`;

      // Process each child
      children.forEach((child) => {
        if (child.type === "group") {
          // Recursively render nested group
          const childGroup = architecture.groupMap.get(child.id);
          if (childGroup) {
            html += renderGroupHierarchy(childGroup, architecture);
          }
        } else if (child.type === "service") {
          // Add service as list item
          const service = architecture.serviceMap.get(child.id);
          if (service) {
            html += `<li class="architecture-service">
              <span class="architecture-service-name">${service.title}</span>`;

            // Add icon information if present
            if (service.icon) {
              html += ` <span class="architecture-icon-info">(${service.icon} icon)</span>`;
            }

            html += `</li>`;
          }
        } else if (child.type === "junction") {
          // Add junction as list item
          const junction = architecture.junctionMap.get(child.id);
          if (junction) {
            html += `<li class="architecture-junction">
              Junction point <span class="architecture-junction-id">${junction.id}</span>
            </li>`;
          }
        }
      });

      html += `</ul>`;
    }

    html += `</li>`;
    return html;
  }

  /**
   * Generate a section about services and their functions
   * @param {Object} architecture - Parsed architecture data
   * @returns {string} HTML section
   */
  function generateServicesSection(architecture) {
    logDebug("Generating services section");

    // Skip if no services
    if (architecture.services.length === 0) {
      return Common.createSection(
        "services",
        "architecture",
        "Services",
        `<p>This architecture diagram does not contain any services.</p>`,
        { role: "region" }
      );
    }

    // Fix redundant numbers issue
    let content = `<p>The architecture includes <span class="diagram-count">${architecture.services.length}</span>`;

    // Proper singular/plural format
    content += architecture.services.length === 1 ? " service" : " services";
    content += `:</p>`;

    // List all services with their icons and parent groups
    content += `<ul class="architecture-services-list">`;

    architecture.services.forEach((service) => {
      content += `<li class="architecture-service-item">
    <span class="architecture-service-name">${service.title}</span>`;

      // Add icon information
      if (service.icon) {
        content += ` <span class="architecture-service-icon">(${getIconDescription(
          service.icon
        )})</span>`;
      }

      // Add parent group information
      if (service.parentId) {
        const parentGroup = architecture.groupMap.get(service.parentId);
        if (parentGroup) {
          content += ` in <span class="architecture-parent-group">${parentGroup.title}</span>`;
        }
      }

      content += `</li>`;
    });

    content += `</ul>`;

    return Common.createSection(
      "services",
      "architecture",
      "Services",
      content,
      { role: "region" }
    );
  }

  /**
   * Get a human-readable description of an icon
   * @param {string} iconName - The icon identifier
   * @returns {string} Human-readable description
   */
  function getIconDescription(iconName) {
    // Handle built-in icons with better descriptions
    const iconDescriptions = {
      cloud: "cloud service",
      database: "database",
      disk: "storage/disk",
      internet: "internet/gateway",
      server: "server",
    };

    // Check if it's one of our known icons
    if (iconDescriptions[iconName]) {
      return iconDescriptions[iconName];
    }

    // Handle custom icons from iconify.design
    if (iconName.includes(":")) {
      const [pack, name] = iconName.split(":");
      return `${name.replace(/-/g, " ")} icon from ${pack}`;
    }

    // Default case
    return iconName.replace(/-/g, " ");
  }

  /**
   * Generate a section describing connections between services
   * @param {Object} architecture - Parsed architecture data
   * @returns {string} HTML section
   */
  function generateConnectionsSection(architecture) {
    logDebug("Generating connections section");

    // Skip if no edges
    if (architecture.edges.length === 0) {
      return Common.createSection(
        "connections",
        "architecture",
        "Connections",
        `<p>This architecture diagram does not show any connections between services.</p>`,
        { role: "region" }
      );
    }

    // Fixed to avoid redundancy in number formatting
    let content = `<p>The architecture diagram shows <span class="diagram-count">${architecture.edges.length}</span>`;
    content += architecture.edges.length === 1 ? " connection" : " connections";
    content += ` between components:</p>`;

    // Create a more intuitive description of the connection structure
    if (architecture.junctions.length > 0) {
      content += `<h5>Hub and Spoke Structure</h5>`;
      content += `<p>The diagram uses a ${
        architecture.junctions.length === 1
          ? "central hub"
          : "hub-and-spoke pattern"
      } with ${architecture.junctions.length} junction ${
        architecture.junctions.length === 1 ? "point" : "points"
      }:</p>`;

      // Create a map to organize connections by junction
      const junctionConnections = new Map();

      // Initialize junction connections
      architecture.junctions.forEach((junction) => {
        junctionConnections.set(junction.id, []);
      });

      // Group edges by junction
      architecture.edges.forEach((edge) => {
        if (architecture.junctionMap.has(edge.sourceId)) {
          junctionConnections.get(edge.sourceId).push({
            ...edge,
            isOutgoing: true,
          });
        }

        if (architecture.junctionMap.has(edge.targetId)) {
          junctionConnections.get(edge.targetId).push({
            ...edge,
            isOutgoing: false,
          });
        }
      });

      // Process junction by junction
      architecture.junctions.forEach((junction, index) => {
        const junctionEdges = junctionConnections.get(junction.id);

        if (junctionEdges.length > 0) {
          content += `<div class="architecture-junction-group">`;
          content += `<h6>${index === 0 ? "Primary" : "Secondary"} Junction (${
            junction.id
          })</h6>`;
          content += `<p>This junction connects:</p>`;
          content += `<ul class="architecture-connections-list">`;

          // Filter out junction-to-junction connections for now
          const serviceConnections = junctionEdges.filter((edge) => {
            const otherNodeId = edge.isOutgoing ? edge.targetId : edge.sourceId;
            return !architecture.junctionMap.has(otherNodeId);
          });

          serviceConnections.forEach((edge) => {
            const serviceId = edge.isOutgoing ? edge.targetId : edge.sourceId;
            const service = architecture.serviceMap.get(serviceId);

            if (service) {
              content += `<li class="architecture-connection">`;
              content += `<span class="architecture-service-name">${service.title}</span>`;

              if (service.icon) {
                content += ` (${getIconDescription(service.icon)})`;
              }

              const direction = edge.isOutgoing
                ? `from ${getDirectionDescription(
                    edge.sourceSide
                  )} of the junction to ${getDirectionDescription(
                    edge.targetSide
                  )} of the service`
                : `from ${getDirectionDescription(
                    edge.sourceSide
                  )} of the service to ${getDirectionDescription(
                    edge.targetSide
                  )} of the junction`;

              content += ` - connected ${direction}`;
              content += `</li>`;
            }
          });

          content += `</ul>`;
          content += `</div>`;
        }
      });

      // Junction-to-junction connections
      const junctionToJunction = architecture.edges.filter(
        (edge) =>
          architecture.junctionMap.has(edge.sourceId) &&
          architecture.junctionMap.has(edge.targetId)
      );

      if (junctionToJunction.length > 0) {
        content += `<div class="architecture-junction-connections">`;
        content += `<h6>Junction Connections</h6>`;
        content += `<ul class="architecture-connections-list">`;

        junctionToJunction.forEach((edge) => {
          const sourceJunction = architecture.junctionMap.get(edge.sourceId);
          const targetJunction = architecture.junctionMap.get(edge.targetId);

          content += `<li class="architecture-connection">`;
          content += `Junction <span class="architecture-junction-id">${sourceJunction.id}</span> connects to junction `;
          content += `<span class="architecture-junction-id">${targetJunction.id}</span>`;
          content += ` (from ${getDirectionDescription(
            edge.sourceSide
          )} to ${getDirectionDescription(edge.targetSide)})`;
          content += `</li>`;
        });

        content += `</ul>`;
        content += `</div>`;
      }
    } else {
      // Direct connections (no junctions)
      content += `<ul class="architecture-connections-list">`;

      architecture.edges.forEach((edge) => {
        const sourceElement = getEdgeElement(
          edge.sourceId,
          edge.sourceIsGroup,
          architecture
        );
        const targetElement = getEdgeElement(
          edge.targetId,
          edge.targetIsGroup,
          architecture
        );

        if (sourceElement && targetElement) {
          content += `<li class="architecture-connection">`;
          content += `<span class="architecture-source">${sourceElement.title}</span>`;

          if (edge.hasLeftArrow && edge.hasRightArrow) {
            content += ` connects bidirectionally with `;
          } else if (edge.hasRightArrow) {
            content += ` connects to `;
          } else if (edge.hasLeftArrow) {
            content += ` receives from `;
          } else {
            content += ` connects with `;
          }

          content += `<span class="architecture-target">${targetElement.title}</span>`;
          content += ` (from ${getDirectionDescription(
            edge.sourceSide
          )} to ${getDirectionDescription(edge.targetSide)})`;
          content += `</li>`;
        }
      });

      content += `</ul>`;
    }

    return Common.createSection(
      "connections",
      "architecture",
      "Connections",
      content,
      { role: "region" }
    );
  }

  /**
   * Convert a direction letter to a human-readable description
   * @param {string} direction - The direction (T, B, L, R)
   * @returns {string} Human-readable direction
   */
  function getDirectionDescription(direction) {
    const directions = {
      T: "the top",
      B: "the bottom",
      L: "the left side",
      R: "the right side",
    };

    return directions[direction] || "an unknown connection point";
  }

  /**
   * Get an element (service or group) for an edge connection
   * @param {string} id - The element ID
   * @param {boolean} isGroup - Whether the element is a group
   * @param {Object} architecture - The architecture data
   * @returns {Object|null} The element or null if not found
   */
  function getEdgeElement(id, isGroup, architecture) {
    if (isGroup) {
      return architecture.groupMap.get(id);
    } else {
      const service = architecture.serviceMap.get(id);
      if (service) return service;

      const junction = architecture.junctionMap.get(id);
      if (junction)
        return {
          id: junction.id,
          title: `Junction ${junction.id}`,
        };
    }
    return null;
  }

  /**
   * Generate insights about the architecture
   * @param {Object} architecture - Parsed architecture data
   * @returns {Array} Array of insight strings
   */
  function generateInsights(architecture) {
    logDebug("Generating insights");

    const insights = [];

    // Insight about hierarchical depth
    const maxDepth = calculateMaxDepth(architecture);
    if (maxDepth > 1) {
      insights.push(
        `The architecture has a depth of <span class="diagram-count">${maxDepth}</span> ${
          maxDepth === 1 ? "level" : "levels"
        } of nesting, indicating a ${
          maxDepth > 2 ? "complex" : "structured"
        } hierarchical organisation.`
      );
    }

    // Insight about connection patterns
    if (architecture.edges.length > 0) {
      const connectionPatterns = analyzeConnectionPatterns(architecture);
      if (connectionPatterns.hasCentralServices) {
        insights.push(
          `The architecture shows a centralised pattern with key services having multiple connections.`
        );
      }

      if (connectionPatterns.hasDirectionalFlow) {
        insights.push(
          `The diagram indicates a clear directional flow of data or requests through the system.`
        );
      }
    }

    // Insight about service types - fixed redundant number issue
    const iconCounts = countServiceIcons(architecture);
    if (Object.keys(iconCounts).length > 1) {
      // Find the most common icon
      let maxCount = 0;
      let mostCommonIcon = "";

      for (const [icon, count] of Object.entries(iconCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonIcon = icon;
        }
      }

      if (mostCommonIcon && maxCount > 1) {
        insights.push(
          `The most common service type is ${getIconDescription(
            mostCommonIcon
          )}, used for <span class="diagram-count">${maxCount}</span> ${
            maxCount === 1 ? "service" : "services"
          }.`
        );
      }
    }

    logDebug(`Generated ${insights.length} insights`);
    return insights;
  }

  /**
   * Calculate the maximum depth of nesting in the architecture
   * @param {Object} architecture - Parsed architecture data
   * @returns {number} Maximum depth
   */
  function calculateMaxDepth(architecture) {
    let maxDepth = 1; // Start with 1 for top-level

    // Helper function to traverse the hierarchy
    function traverseDepth(groupId, currentDepth) {
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }

      // Get the group
      const group = architecture.groupMap.get(groupId);
      if (!group || !group.children) return;

      // Check children for nested groups
      for (const child of group.children) {
        if (child.type === "group") {
          traverseDepth(child.id, currentDepth + 1);
        }
      }
    }

    // Start traversal from top-level groups
    architecture.groups
      .filter((group) => !group.parentId)
      .forEach((group) => traverseDepth(group.id, 1));

    return maxDepth;
  }

  /**
   * Analyze connection patterns in the architecture
   * @param {Object} architecture - Parsed architecture data
   * @returns {Object} Analysis results
   */
  function analyzeConnectionPatterns(architecture) {
    const result = {
      hasCentralServices: false,
      hasDirectionalFlow: false,
    };

    // Count connections per service
    const connectionCounts = {};

    architecture.edges.forEach((edge) => {
      // Skip group edges for this analysis
      if (edge.sourceIsGroup || edge.targetIsGroup) return;

      // Count connections for source and target
      connectionCounts[edge.sourceId] =
        (connectionCounts[edge.sourceId] || 0) + 1;
      connectionCounts[edge.targetId] =
        (connectionCounts[edge.targetId] || 0) + 1;
    });

    // Check for central services (with 3+ connections)
    const highConnectionServices = Object.entries(connectionCounts).filter(
      ([_, count]) => count >= 3
    ).length;

    result.hasCentralServices = highConnectionServices > 0;

    // Check for directional flow (more arrows in one direction)
    const rightArrows = architecture.edges.filter(
      (edge) => edge.hasRightArrow
    ).length;
    const leftArrows = architecture.edges.filter(
      (edge) => edge.hasLeftArrow
    ).length;
    const totalArrows = rightArrows + leftArrows;

    if (totalArrows > 0) {
      // If 66% of arrows are in one direction, consider it a directional flow
      const rightRatio = rightArrows / totalArrows;
      const leftRatio = leftArrows / totalArrows;

      result.hasDirectionalFlow = rightRatio > 0.66 || leftRatio > 0.66;
    }

    return result;
  }

  /**
   * Count the frequency of service icons
   * @param {Object} architecture - Parsed architecture data
   * @returns {Object} Icon count mapping
   */
  function countServiceIcons(architecture) {
    const iconCounts = {};

    architecture.services.forEach((service) => {
      if (service.icon) {
        iconCounts[service.icon] = (iconCounts[service.icon] || 0) + 1;
      }
    });

    return iconCounts;
  }

  /**
   * Generate notes about visual representation
   * @param {Object} architecture - Parsed architecture data
   * @returns {string} Visual notes
   */
  function generateVisualNotes(architecture) {
    const notes = [];

    // Basic diagram description
    notes.push(
      "In the visual diagram, services are represented by icons with labels, showing their function in the system."
    );

    // Group visualization
    if (architecture.groups.length > 0) {
      notes.push(
        "Groups are shown as containers that visually enclose the services they contain, using icon and label to identify their purpose."
      );
    }

    // Connection visualization
    if (architecture.edges.length > 0) {
      notes.push(
        "Connections between services are shown as lines, with optional arrows indicating the direction of data flow or dependency."
      );
    }

    // Junction visualization
    if (architecture.junctions.length > 0) {
      notes.push(
        "Junction points are used where complex connections meet, acting as routing nodes for multiple connections."
      );
    }

    // Icon usage
    if (hasMultipleIconTypes(architecture)) {
      notes.push(
        "Different icons visually represent the type and function of each service (database, storage, server, etc.)."
      );
    }

    return notes.join(" ");
  }

  /**
   * Check if the architecture uses multiple icon types
   * @param {Object} architecture - Parsed architecture data
   * @returns {boolean} True if multiple icon types are used
   */
  function hasMultipleIconTypes(architecture) {
    const iconSet = new Set();

    architecture.services.forEach((service) => {
      if (service.icon) {
        iconSet.add(service.icon);
      }
    });

    return iconSet.size > 1;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator(
    "architecture-beta",
    {
      generateShort: shortDescriptionWrapper,
      generateDetailed: generateDetailedDescription,
      // Add HTML-formatted short description
      generateShortHTML: function (svgElement, code) {
        return generateShortDescription(svgElement, code).html;
      },
    }
  );

  logInfo("Architecture module initialised and registered");

  return {
    // Expose logging configuration for potential external adjustment
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo(`Log level changed to ${getLogLevelName(level)}`);
      } else {
        logWarn(`Invalid log level: ${level}. Must be 0-3.`);
      }
    },
    getLogLevel: function () {
      return currentLogLevel;
    },
    LOG_LEVELS: Object.freeze({ ...LOG_LEVELS }),
  };

  /**
   * Get human-readable log level name
   * @param {number} level - The log level number
   * @returns {string} The log level name
   */
  function getLogLevelName(level) {
    const names = ["ERROR", "WARN", "INFO", "DEBUG"];
    return names[level] || "UNKNOWN";
  }
})();

// Export logic (keep outside IIFE)
if (typeof module !== "undefined" && module.exports) {
  module.exports = MermaidAccessibilityArchitecture;
} else {
  window.MermaidAccessibilityArchitecture = MermaidAccessibilityArchitecture;
}
