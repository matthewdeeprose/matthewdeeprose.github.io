/**
 * Mermaid Accessibility - Sequence Diagram Module
 * Generates accessible descriptions for sequence diagrams
 */
(function () {
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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;

  /**
   * Generate a short description for a sequence diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {Object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    // Parse sequence diagram
    const sequence = parseSequenceDiagram(code);

    // Try to get a meaningful flow name first
    let flowName = "Message Exchange Process"; // Default fallback

    // Try to infer a more specific name from the messages
    if (sequence.allMessages && sequence.allMessages.length > 0) {
      flowName = inferFlowName(sequence.allMessages, sequence);
    }

    // Extract title from SVG or code as fallback
    const fallbackTitle =
      Utils.extractTitleFromSVG(svgElement) ||
      sequence.title ||
      "Sequence Diagram";

    // Only use explicit titles or proper inferred titles, never use notes as titles
    const displayTitle =
      sequence.title ||
      (flowName && flowName !== "Message Exchange Process"
        ? flowName
        : inferTitleFromContent(sequence) || "Sequence Diagram");

    // Total participant count (actors + participants)
    const totalParticipantCount =
      sequence.actors.length + sequence.participants.length;

    // Define hasGroups variable
    const hasGroups = sequence.groups && sequence.groups.length > 0;

    // Determine what special features we have to mention
    const specialFeatures = [];
    if (sequence.hasLoops) specialFeatures.push("loops");
    if (sequence.hasAlts) specialFeatures.push("conditional branches");
    if (sequence.hasOpts) specialFeatures.push("optional paths");
    if (sequence.hasNotes) specialFeatures.push("explanatory notes");
    if (sequence.hasActivations) specialFeatures.push("component activations");
    if (sequence.hasParallel) specialFeatures.push("parallel actions");
    if (sequence.hasCritical) specialFeatures.push("critical actions");
    // Add this line:
    if (sequence.hasBreaks) specialFeatures.push("break conditions");
    if (sequence.allMessages.some((m) => m.isBidirectional))
      specialFeatures.push("bidirectional messaging");
    if (sequence.creationEvents.length > 0)
      specialFeatures.push("participant creation");
    if (sequence.destructionEvents.length > 0)
      specialFeatures.push("participant destruction");

    // Format the special features text
    let specialFeaturesText = "";
    if (specialFeatures.length > 0) {
      specialFeaturesText = ` with ${formatList(specialFeatures)}`;
    }

    // Ensure proper pluralization
    const messagePlural = sequence.messageCount === 1 ? "message" : "messages";
    const participantPlural =
      totalParticipantCount === 1 ? "participant" : "participants";

    // Basic description without formatting numbers yet
    let htmlDescriptionRaw = `A sequence diagram showing `;

    // Only add title if it comes from an explicit title declaration in the diagram
    if (sequence.title) {
      htmlDescriptionRaw += `a <span class="diagram-title">${sequence.title}</span> process`;
    } else {
      // Use a more generic description without potentially misleading title
      htmlDescriptionRaw += `a message exchange process`;
    }

    htmlDescriptionRaw += ` illustrating the interaction between ${totalParticipantCount} `;

    if (sequence.actors.length > 0 && sequence.participants.length > 0) {
      htmlDescriptionRaw += `entities (${sequence.actors.length} ${
        sequence.actors.length === 1 ? "actor" : "actors"
      } and ${sequence.participants.length} ${
        sequence.participants.length === 1 ? "system" : "systems"
      })`;
    } else if (sequence.actors.length > 0) {
      htmlDescriptionRaw += `${
        sequence.actors.length === 1 ? "actor" : "actors"
      }`;
    } else {
      htmlDescriptionRaw += `${
        sequence.participants.length === 1 ? "participant" : "participants"
      }`;
    }

    // Add mention of groups if present
    if (hasGroups) {
      htmlDescriptionRaw += ` in ${sequence.groups.length} ${
        sequence.groups.length === 1 ? "group" : "groups"
      }`;
    }

    htmlDescriptionRaw += `. The diagram contains ${sequence.messageCount} ${messagePlural}${specialFeaturesText}.`;

    // Plain text version with proper pluralization
    let plainTextDescriptionRaw = `A sequence diagram showing `;

    // Only add title if it comes from an explicit title declaration in the diagram
    if (sequence.title) {
      plainTextDescriptionRaw += `a ${sequence.title} process`;
    } else {
      // Use a more generic description without potentially misleading title
      plainTextDescriptionRaw += `a message exchange process`;
    }

    plainTextDescriptionRaw += ` illustrating the interaction between ${totalParticipantCount} `;

    if (sequence.actors.length > 0 && sequence.participants.length > 0) {
      plainTextDescriptionRaw += `entities (${sequence.actors.length} ${
        sequence.actors.length === 1 ? "actor" : "actors"
      } and ${sequence.participants.length} ${
        sequence.participants.length === 1 ? "system" : "systems"
      })`;
    } else if (sequence.actors.length > 0) {
      plainTextDescriptionRaw += `${
        sequence.actors.length === 1 ? "actor" : "actors"
      }`;
    } else {
      plainTextDescriptionRaw += `${participantPlural}`;
    }

    // Add mention of groups if present
    if (hasGroups) {
      plainTextDescriptionRaw += ` in ${sequence.groups.length} ${
        sequence.groups.length === 1 ? "group" : "groups"
      }`;
    }

    plainTextDescriptionRaw += `. The diagram contains ${sequence.messageCount} ${messagePlural}${specialFeaturesText}.`;

    // After building the basic description, add info about notes
    if (sequence.notes && sequence.notes.length > 0) {
      const noteWord = sequence.notes.length === 1 ? "note" : "notes";
      // Don't repeat note info if already mentioned in the main description
      if (!htmlDescriptionRaw.includes("explanatory notes")) {
        htmlDescriptionRaw += ` It includes ${sequence.notes.length} explanatory ${noteWord}.`;
        plainTextDescriptionRaw += ` It includes ${sequence.notes.length} explanatory ${noteWord}.`;
      }
    }

    // Now apply number formatting to both text versions
    let htmlDescription = Utils.formatNumbersInText(htmlDescriptionRaw);
    let plainTextDescription = Utils.formatNumbersInText(
      plainTextDescriptionRaw
    );

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
    return descriptions.text;
  }

  /**
   * Format a list of items with proper grammar
   * @param {Array} items - Array of item strings
   * @returns {string} Formatted list
   */
  function formatList(items) {
    if (!items || items.length === 0) return "";

    if (items.length === 1) return items[0];

    if (items.length === 2) return `${items[0]} and ${items[1]}`;

    // For 3 or more items, use commas and "and" before the last one
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1);
    return `${otherItems.join(", ")}, and ${lastItem}`;
  }

  /**
   * Format a list of participants with proper grammar
   * @param {Array} participants - Array of participant names
   * @returns {string} Formatted list (e.g., "Alice and Bob" or "Alice, Bob, and Charlie")
   */
  function formatParticipantsList(participants) {
    return formatList(participants);
  }

  /**
   * Try to infer a descriptive title from diagram content
   * @param {Object} sequence - The parsed sequence diagram data
   * @returns {string|null} An inferred title or null
   */
  function inferTitleFromContent(sequence) {
    // First check for explicit title in the diagram
    if (sequence.title) {
      return sequence.title;
    }

    // Look for common patterns that might indicate the purpose of the diagram

    // Look for secure communication patterns
    const hasSecurityTerms = sequence.allMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("secure") ||
          msg.content.toLowerCase().includes("encrypt") ||
          msg.content.toLowerCase().includes("key") ||
          msg.content.toLowerCase().includes("certificate"))
    );

    // Look for authentication/login messages
    const hasLogin = sequence.allMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("login") ||
          msg.content.toLowerCase().includes("auth") ||
          msg.content.toLowerCase().includes("sign in"))
    );

    // Look for registration messages
    const hasRegistration = sequence.allMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("register") ||
          msg.content.toLowerCase().includes("sign up") ||
          msg.content.toLowerCase().includes("create account"))
    );

    // Look for checkout/payment messages
    const hasCheckout = sequence.allMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("payment") ||
          msg.content.toLowerCase().includes("checkout") ||
          msg.content.toLowerCase().includes("purchase"))
    );

    // Determine if there are API calls
    const hasApi = sequence.participants.some(
      (p) =>
        p.toLowerCase().includes("api") || p.toLowerCase().includes("service")
    );

    // Look for database interactions
    const hasDatabase = sequence.participants.some(
      (p) =>
        p.toLowerCase().includes("database") || p.toLowerCase().includes("db")
    );

    // Build an inferred title based on the content
    if (hasSecurityTerms) {
      return "Secure Communication Protocol";
    } else if (hasLogin && hasRegistration) {
      return "User Authentication and Registration Process";
    } else if (hasLogin) {
      return "User Authentication Process";
    } else if (hasRegistration) {
      return "User Registration Process";
    } else if (hasCheckout) {
      return "Checkout Process";
    } else if (hasApi && hasDatabase) {
      return "API and Database Interaction";
    } else if (hasApi) {
      return "API Interaction Flow";
    } else if (hasDatabase) {
      return "Database Transaction Process";
    }

    // If we couldn't infer anything specific
    return "Message Exchange Sequence";
  }

  /**
   * Check if a string looks like a colour definition
   * @param {string} str - The string to check
   * @returns {boolean} True if the string appears to be a colour
   */
  function isColourDefinition(str) {
    if (!str) return false;

    // Check for common RGB/RGBA patterns
    if (str.match(/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i)) return true;
    if (str.match(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i))
      return true;
    if (str.match(/^#[0-9A-F]{3,8}$/i)) return true;

    // Check for a small set of common colour names
    const commonColours = [
      "black",
      "white",
      "red",
      "green",
      "blue",
      "yellow",
      "purple",
      "orange",
      "pink",
      "brown",
      "gray",
      "grey",
      "cyan",
      "magenta",
      "aqua",
      "lime",
      "teal",
      "navy",
      "gold",
      "silver",
    ];

    return commonColours.includes(str.toLowerCase());
  }
  /**
   * Parse sequence diagram structure from the code
   * @param {string} code - The original mermaid code
   * @returns {Object} Structured sequence diagram data
   */
  function parseSequenceDiagram(code) {
    const sequence = {
      title: "",
      actors: [],
      participants: [],
      messages: [],
      allMessages: [], // All messages including those in alt/loop blocks
      messageCount: 0,
      hasLoops: false,
      hasAlts: false,
      hasOpts: false,
      hasNotes: false,
      hasBoxes: false,
      hasActivations: false,
      hasParallel: false, // Track if diagram has parallel blocks
      hasCritical: false, // Track if diagram has critical blocks
      hasBreaks: false, // Track if diagram has break blocks
      blocks: [], // For alt, loop, opt blocks
      parallelBlocks: [], // For tracking parallel blocks
      notes: [], // Store notes for better descriptions
      activations: [], // Track activations for component lifecycles
      aliasMap: {}, // Map from IDs to display names
      creationEvents: [], // Track when participants/actors are created
      destructionEvents: [], // Track when participants/actors are destroyed
      groups: [], // Track group boxes
      participantGroups: {}, // Map participants to their groups
      comments: [], // Add array to store comments
    };

    // Split the code into lines
    const lines = code
      .split("\n")
      .map((line) => line.trim())
      // MODIFY THIS LINE to preserve comments for analysis instead of filtering them out
      // .filter((line) => line && !line.startsWith("%%"));
      .filter((line) => line);

    // Extract comments from lines
    lines.forEach((line, lineIndex) => {
      // Skip theme initialisation directives
      if (line.includes("%%{init:") || line.includes("%{init:")) {
        return;
      }

      // Look for inline comments
      const commentIndex = line.indexOf("%%");
      if (commentIndex !== -1) {
        const messageContent = line.substring(0, commentIndex).trim();
        const commentContent = line.substring(commentIndex + 2).trim();

        // Skip empty comments
        if (!commentContent) return;

        // Store the comment with context information
        sequence.comments.push({
          lineIndex: lineIndex,
          content: commentContent,
          isInline: messageContent.length > 0,
          messageContent: messageContent.length > 0 ? messageContent : null,
          // Track if this is a standalone comment (for placement in sequence)
          isStandalone: messageContent.length === 0,
        });
      }
    });

    // Extract title if explicitly defined
    const titleMatch = code.match(/^\s*title\s+(.+)$/im);
    if (titleMatch) {
      sequence.title = titleMatch[1].trim();
    }

    // First pass: extract boxes/groups
    let currentGroup = null;
    let currentGroupMembers = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for box start
      const boxMatch = line.match(/^\s*box\s+(.+)$/i);
      if (boxMatch) {
        sequence.hasBoxes = true;
        let boxContent = boxMatch[1].trim();

        // Extract the group name, handling the case with colour
        let groupName = boxContent;

        // Handle colour names or RGB values at the beginning
        // Common colours or transparent keyword before the actual name
        const colourKeywords = [
          "transparent",
          "aqua",
          "black",
          "blue",
          "fuchsia",
          "gray",
          "green",
          "lime",
          "maroon",
          "navy",
          "olive",
          "orange",
          "purple",
          "red",
          "silver",
          "teal",
          "white",
          "yellow",
        ];

        // Check for RGB/RGBA pattern
        const rgbMatch = boxContent.match(
          /^(rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|\s*rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d\.]+\s*\))\s+(.+)$/i
        );

        if (rgbMatch) {
          // If we have RGB/RGBA format followed by a name
          groupName = rgbMatch[2].trim();
        } else {
          // Check for colour keyword followed by a name
          for (const colour of colourKeywords) {
            if (
              boxContent.toLowerCase().startsWith(colour.toLowerCase() + " ")
            ) {
              // Found a colour keyword at the start, extract the remaining content as the name
              groupName = boxContent.substring(colour.length).trim();
              break;
            }
          }
        }

        currentGroup = groupName;
        currentGroupMembers = [];
      }

      // Check for box end
      else if (line.match(/^\s*end\s*$/i) && currentGroup) {
        // Add the group to the sequence
        sequence.groups.push({
          name: currentGroup,
          members: [...currentGroupMembers], // Create a copy of the members array
        });

        // Add each member to the participantGroups mapping
        currentGroupMembers.forEach((member) => {
          sequence.participantGroups[member] = currentGroup;
        });

        // Reset current group context
        currentGroup = null;
        currentGroupMembers = [];
      }

      // Check for participants or actors within a group
      else if (currentGroup) {
        const participantMatch = line.match(
          /^\s*(?:participant|actor)\s+([A-Za-z0-9_-]+)(?:\s+as\s+(.+))?$/i
        );
        if (participantMatch) {
          const id = participantMatch[1];
          currentGroupMembers.push(id);
        }
      }
    }

    // FIRST: Extract all explicit actor and participant declarations
    // This ensures we only consider properly declared entities
    const actorRegex =
      /^\s*(?:participant|actor)\s+([A-Za-z0-9_-]+)(?:\s+as\s+(.+))?$/i;
    // New regex for create participant/actor commands
    const createRegex =
      /^\s*create\s+(participant|actor)\s+([A-Za-z0-9_-]+)(?:\s+as\s+(.+))?$/i;
    // New regex for destroy commands
    const destroyRegex = /^\s*destroy\s+([A-Za-z0-9_-]+)\s*$/i;

    lines.forEach((line, lineIndex) => {
      // Check for standard participant/actor declarations with potential "as" alias
      const participantMatch = line.match(actorRegex);
      if (participantMatch) {
        const id = participantMatch[1];
        let displayName = participantMatch[2] || id;

        // Process potential HTML in alias (like <br/>)
        if (displayName.includes("<br/>")) {
          displayName = displayName.replace(/<br\/>/g, " ");
        }

        // Store the alias mapping
        sequence.aliasMap[id] = displayName;

        // Determine if this is an actor or participant
        const isActor = line.toLowerCase().startsWith("actor");

        if (isActor) {
          if (!sequence.actors.includes(displayName)) {
            sequence.actors.push(displayName);
          }
        } else {
          if (!sequence.participants.includes(displayName)) {
            sequence.participants.push(displayName);
          }
        }
      }

      // Check for create participant/actor commands
      const createMatch = line.match(createRegex);
      if (createMatch) {
        const type = createMatch[1].toLowerCase(); // 'participant' or 'actor'
        const id = createMatch[2];
        let displayName = createMatch[3] || id;

        // Process potential HTML in alias
        if (displayName.includes("<br/>")) {
          displayName = displayName.replace(/<br\/>/g, " ");
        }

        // Store the alias mapping
        sequence.aliasMap[id] = displayName;

        // Add the entity to the appropriate list
        if (type === "actor") {
          if (!sequence.actors.includes(displayName)) {
            sequence.actors.push(displayName);
          }
        } else {
          if (!sequence.participants.includes(displayName)) {
            sequence.participants.push(displayName);
          }
        }

        // Record the creation event
        sequence.creationEvents.push({
          lineIndex,
          entityId: id,
          displayName,
          type,
        });
      }

      // Check for destroy commands
      const destroyMatch = line.match(destroyRegex);
      if (destroyMatch) {
        const id = destroyMatch[1];
        const displayName = sequence.aliasMap[id] || id;

        // Record the destruction event
        sequence.destructionEvents.push({
          lineIndex,
          entityId: id,
          displayName,
        });
      }

      // Check for notes
      const noteMatch = line.match(
        /^\s*Note\s+(right|left|over)\s+(of\s+)?(?:([A-Za-z0-9_-]+)(?:\s*,\s*([A-Za-z0-9_-]+))?)?:\s*(.+)$/i
      );
      if (noteMatch) {
        sequence.hasNotes = true;
        const position = noteMatch[1].toLowerCase();
        // Shift indices if 'of' is present
        const hasOf = noteMatch[2] !== undefined;
        const participant1 = hasOf ? noteMatch[3] : noteMatch[3];
        const participant2 = hasOf ? noteMatch[4] : noteMatch[4];
        let content = noteMatch[5] ? noteMatch[5].trim() : "";

        // Handle line breaks in note content
        content = content.replace(/<br\s*\/?>/gi, " ");

        // Determine line index for proper placement of the note in the sequence
        const noteLineIndex = lineIndex;

        // Make sure we have a valid participant array, even for right/left notes
        const participantArray = [];
        if (participant1) participantArray.push(participant1);
        if (participant2) participantArray.push(participant2);

        sequence.notes.push({
          lineIndex: noteLineIndex,
          position,
          participants: participantArray,
          content,
          // Track whether this is a spanning note (over multiple participants)
          isSpanning: position === "over" && participant2 !== undefined,
        });

        logDebug(
          `[Mermaid Accessibility] Note detected: ${content} (${position} of ${participantArray.join(
            ", "
          )})`
        );
      }

      // Check for activations
      if (line.match(/^\s*activate\s+/i)) {
        sequence.hasActivations = true;
        const activateMatch = line.match(/^\s*activate\s+([A-Za-z0-9_-]+)/i);
        if (activateMatch) {
          const participant = activateMatch[1];
          sequence.activations.push({
            lineIndex,
            participant,
            type: "activate",
          });
        }
      }

      // Check for deactivations
      if (line.match(/^\s*deactivate\s+/i)) {
        sequence.hasActivations = true;
        const deactivateMatch = line.match(
          /^\s*deactivate\s+([A-Za-z0-9_-]+)/i
        );
        if (deactivateMatch) {
          const participant = deactivateMatch[1];
          sequence.activations.push({
            lineIndex,
            participant,
            type: "deactivate",
          });
        }
      }
    });
    // SECOND: Process blocks and messages
    // Track alt/loop/opt blocks
    let currentBlock = null;
    let currentBlockIndent = 0;
    let blockId = 0;

    // Track current parallel block
    let currentParallelBlock = null;
    let currentParallelBranch = null;
    let parallelBlockStack = []; // For nested parallel blocks

    // Updated message regex to handle the +/- activation/deactivation shortcuts
    // Improved to handle more message types and activation shortcuts
    const messageRegex =
      /^\s*([A-Za-z0-9_-]+)\s*(->>|-->|->|-->>|--x|-x|--\)|-\))(\+|-)?(?:\s*([\w-]+))?(?:\s*(->>|-->|->|-->>|--x|-x|--\)|-\))(\+|-)?)?(?:\s*([A-Za-z0-9_-]+))?(?::\s*(.+))?$/i;

    lines.forEach((line, lineIndex) => {
      // Check for critical blocks
      const criticalMatch = line.match(/^\s*critical\s*(.*?)$/i);
      if (criticalMatch) {
        const label = criticalMatch[1].trim();
        sequence.hasCritical = true;

        // Create a new critical block
        currentBlock = {
          type: "critical",
          id: `block-${++blockId}`,
          label: label,
          options: [],
          messages: [],
          currentOption: -1, // No current option yet
        };
        sequence.blocks.push(currentBlock);

        logDebug(`[Mermaid Accessibility] Detected critical block: ${label}`);
      }

      // Check for option blocks (within critical blocks)
      const optionMatch = line.match(/^\s*option\s*(.*?)$/i);
      if (optionMatch && currentBlock && currentBlock.type === "critical") {
        const condition = optionMatch[1].trim();

        // Add a new option to the critical block
        currentBlock.options.push({
          condition: condition,
          messages: [],
        });

        // Set current option index
        currentBlock.currentOption = currentBlock.options.length - 1;

        logDebug(
          `[Mermaid Accessibility] Detected option in critical block: ${condition}`
        );
      }

      // Check for parallel blocks
      const parMatch = line.match(/^\s*par\s+(.*?)$/i);
      if (parMatch) {
        // Carefully sanitise the label to avoid capturing unrelated content
        const rawLabel = parMatch[1].trim();

        // Check if this is actually a participant declaration mistakenly matched
        const isParticipantDeclaration = /^participant|actor\s+/i.test(
          rawLabel
        );

        // Use a sanitised label or default if it looks suspicious
        const label = isParticipantDeclaration ? "Parallel actions" : rawLabel;

        sequence.hasParallel = true;

        // Create a new parallel block with the sanitised label
        const newParallelBlock = {
          type: "parallel",
          id: `parallel-${++blockId}`,
          label: label,
          branches: [
            {
              label: label,
              messages: [],
            },
          ],
          currentBranch: 0,
          parentBlock: currentParallelBlock, // For nested parallels
        };

        // If we're already in a parallel block, store the current one to return to it later
        if (currentParallelBlock) {
          parallelBlockStack.push(currentParallelBlock);
        }

        sequence.parallelBlocks.push(newParallelBlock);
        currentParallelBlock = newParallelBlock;
        currentParallelBranch = 0;

        logDebug(`[Mermaid Accessibility] Detected parallel block: ${label}`);
      }

      // Check for parallel branch
      const andMatch = line.match(/^\s*and\s*(.*?)$/i);
      if (andMatch && currentParallelBlock) {
        const label = andMatch[1].trim();

        // Add new branch to current parallel block
        currentParallelBlock.branches.push({
          label: label,
          messages: [],
        });

        currentParallelBlock.currentBranch =
          currentParallelBlock.branches.length - 1;
        currentParallelBranch = currentParallelBlock.currentBranch;

        logDebug(`[Mermaid Accessibility] Detected parallel branch: ${label}`);
      }

      // Check for alt blocks
      const altMatch = line.match(/^\s*(alt|else)\s*(.*?)$/i);
      if (altMatch) {
        const altType = altMatch[1].toLowerCase();
        const condition = altMatch[2].trim();

        if (altType === "alt") {
          // Start a new alt block
          sequence.hasAlts = true;
          currentBlock = {
            type: "alt",
            id: `block-${++blockId}`,
            condition: condition,
            branches: [
              {
                condition: condition,
                messages: [],
              },
            ],
            currentBranch: 0,
          };
          sequence.blocks.push(currentBlock);
        } else if (
          altType === "else" &&
          currentBlock &&
          currentBlock.type === "alt"
        ) {
          // Add else branch to current alt block
          currentBlock.branches.push({
            condition: condition || "otherwise",
            messages: [],
          });
          currentBlock.currentBranch = currentBlock.branches.length - 1;
        }
      }

      // Check for opt blocks
      const optMatch = line.match(/^\s*opt\s*(.*?)$/i);
      if (optMatch && (!currentBlock || currentBlock.type !== "critical")) {
        const condition = optMatch[1].trim();
        sequence.hasOpts = true;
        currentBlock = {
          type: "opt",
          id: `block-${++blockId}`,
          condition: condition,
          messages: [],
        };
        sequence.blocks.push(currentBlock);
      }

      // Check for loop blocks
      const loopMatch = line.match(/^\s*loop\s*(.*?)$/i);
      if (loopMatch) {
        const label = loopMatch[1].trim();
        sequence.hasLoops = true;
        currentBlock = {
          type: "loop",
          id: `block-${++blockId}`,
          label: label,
          messages: [],
        };
        sequence.blocks.push(currentBlock);
      }

      // Check for break blocks - add this after the loop block check
      // Check for break blocks
      const breakMatch = line.match(/^\s*break\s*(.*?)$/i);
      if (breakMatch) {
        const condition = breakMatch[1].trim();
        sequence.hasBreaks = true;
        logDebug(
          `[Mermaid Accessibility] Found break block with condition: "${condition}" at line ${lineIndex}`
        );
        currentBlock = {
          type: "break",
          id: `block-${++blockId}`,
          condition: condition,
          messages: [],
          lineIndex: lineIndex, // Store the line index where break starts
        };
        sequence.blocks.push(currentBlock);
        logDebug(
          `[Mermaid Accessibility] Added break block to blocks array. Total blocks: ${sequence.blocks.length}`
        );
      }

      // Check for end of blocks - handle both parallel and other blocks
      if (line.match(/^\s*end\s*$/i)) {
        logDebug(
          `[Mermaid Accessibility] Found end marker. Current block type: ${
            currentBlock ? currentBlock.type : "none"
          }`
        );

        if (currentParallelBlock) {
          // If we have a stack of parallel blocks, pop the last one
          if (parallelBlockStack.length > 0) {
            currentParallelBlock = parallelBlockStack.pop();
            currentParallelBranch = currentParallelBlock.currentBranch;
          } else {
            currentParallelBlock = null;
            currentParallelBranch = null;
          }
        } else if (currentBlock) {
          // Store the end line index for break blocks
          if (currentBlock.type === "break") {
            currentBlock.endLineIndex = lineIndex;
            logDebug(
              `[Mermaid Accessibility] Closing break block with ${currentBlock.messages.length} messages and range ${currentBlock.lineIndex}-${currentBlock.endLineIndex}`
            );
          }
          currentBlock = null;
        }
      }

      // Check for messages with activation markers
      const msgMatch = line.match(messageRegex);
      if (msgMatch) {
        // Extract matched groups
        // [0] = full match
        // [1] = sender
        // [2] = arrow type (->>, -->, etc.)
        // [3] = activation marker (+ or -) for sender-side activation
        // [4] = optional intermediate node (for more complex messages)
        // [5] = optional second arrow type for multi-part messages
        // [6] = activation marker (+ or -) for receiver-side activation
        // [7] = receiver
        // [8] = message content

        const sender = msgMatch[1];
        const arrowType = msgMatch[2];
        const activationMarker = msgMatch[3] || ""; // '+' or '-' or ''
        const receiver = msgMatch[7] || msgMatch[4] || ""; // Get receiver from either position
        let content = msgMatch[8] ? msgMatch[8].trim() : "";

        // Handle activation markers
        if (activationMarker === "+") {
          sequence.hasActivations = true;
          sequence.activations.push({
            lineIndex,
            participant: receiver,
            type: "activate",
          });
        } else if (activationMarker === "-") {
          sequence.hasActivations = true;
          sequence.activations.push({
            lineIndex,
            participant: sender,
            type: "deactivate",
          });
        }

        // Check if this is a bidirectional message
        const isBidirectional = arrowType === "<<-->>" || arrowType === "<->";

        // Extract message number if present (e.g., "1. Enter login credentials")
        let messageNumber = null;
        const numberMatch = content.match(/^(\d+)\.?\s+(.+)$/);
        if (numberMatch) {
          messageNumber = parseInt(numberMatch[1], 10);
          content = numberMatch[2].trim();
        }

        // Create message object
        const message = {
          sender,
          type: arrowType,
          receiver,
          content,
          messageNumber,
          lineIndex,
          isResponse: arrowType.includes("--") && !isBidirectional,
          isBidirectional: isBidirectional,
          isAsync: arrowType.includes(")"),
          isError: arrowType.includes("x"),
          activationMarker: activationMarker,
        };

        // Add to all messages list
        sequence.allMessages.push(message);
        sequence.messageCount++;

        // Add to the current block or parallel block
        if (currentParallelBlock) {
          currentParallelBlock.branches[
            currentParallelBlock.currentBranch
          ].messages.push(message);
          logDebug(
            `[Mermaid Accessibility] Added message "${content}" to parallel block`
          );
        } else if (currentBlock) {
          logDebug(
            `[Mermaid Accessibility] Current block type: ${currentBlock.type}`
          );
          if (currentBlock.type === "alt") {
            currentBlock.branches[currentBlock.currentBranch].messages.push(
              message
            );
          } else if (currentBlock.type === "critical") {
            if (currentBlock.currentOption >= 0) {
              // Add to current option within critical block
              currentBlock.options[currentBlock.currentOption].messages.push(
                message
              );
            } else {
              // Add to main critical block messages
              currentBlock.messages.push(message);
            }
          } else if (
            currentBlock.type === "loop" ||
            currentBlock.type === "opt" ||
            currentBlock.type === "break" // Make sure break is included here
          ) {
            // Add to the block messages
            currentBlock.messages.push(message);
            logDebug(
              `[Mermaid Accessibility] Added message "${content}" to ${currentBlock.type} block, now has ${currentBlock.messages.length} messages`
            );
          }
        } else {
          // Add to main message list
          sequence.messages.push(message);
        }
      }
    });
    // THIRD: For any message entities that weren't explicitly declared,
    // add them to the appropriate category (actors or participants)
    const allEntities = new Set();

    // Collect all entities used in messages
    sequence.allMessages.forEach((message) => {
      if (message.sender) allEntities.add(message.sender);
      if (message.receiver) allEntities.add(message.receiver);
    });

    // For each entity, if not already classified, make a best guess
    allEntities.forEach((entity) => {
      // Remove any activation markers
      let cleanEntity = entity;
      if (cleanEntity && cleanEntity.endsWith("+")) {
        cleanEntity = cleanEntity.slice(0, -1);
      }
      if (cleanEntity && cleanEntity.endsWith("-")) {
        cleanEntity = cleanEntity.slice(0, -1);
      }

      // Skip empty entities
      if (!cleanEntity) return;

      // Check if this entity ID already has an alias mapping
      if (!sequence.aliasMap[cleanEntity]) {
        sequence.aliasMap[cleanEntity] = cleanEntity; // Default to using the ID as display name
      }

      // Check if this entity is already classified
      const displayName = sequence.aliasMap[cleanEntity];
      const isClassified =
        sequence.actors.includes(displayName) ||
        sequence.participants.includes(displayName);

      if (!isClassified) {
        // Check if this looks like an actor (convention check)
        if (
          cleanEntity.toLowerCase() === "user" ||
          cleanEntity.toLowerCase().includes("customer") ||
          cleanEntity.toLowerCase().includes("client") ||
          cleanEntity.toLowerCase() === "alice" || // Common names in examples
          cleanEntity.toLowerCase() === "bob" ||
          cleanEntity.toLowerCase() === "john"
        ) {
          sequence.actors.push(displayName);
        } else {
          // Add as a participant
          sequence.participants.push(displayName);
        }
      }
    });

    return sequence;
  }

  // Add this function just before generateDetailedDescription around line ~1500
  /**
   * Organise developer comments into categories for better presentation
   * @param {Object} sequence - The sequence diagram data
   * @returns {Object} Comments organised by category
   */
  function organiseComments(sequence) {
    if (!sequence.comments || sequence.comments.length === 0)
      return {
        structure: [],
        flow: [],
        functionality: [],
        other: [],
      };

    // Group comments by category
    const categories = {
      structure: [],
      flow: [],
      functionality: [],
      other: [],
    };

    sequence.comments.forEach((comment) => {
      const content = comment.content.toLowerCase();

      if (
        content.includes("box") ||
        content.includes("group") ||
        content.includes("title")
      ) {
        categories.structure.push(comment);
      } else if (
        content.includes("flow") ||
        content.includes("block") ||
        content.includes("note")
      ) {
        categories.flow.push(comment);
      } else if (
        content.includes("activation") ||
        content.includes("create") ||
        content.includes("destroy")
      ) {
        categories.functionality.push(comment);
      } else {
        categories.other.push(comment);
      }
    });

    return categories;
  }

  /**
   * Generate a detailed description for a sequence diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating sequence diagram description");

    // Initialise the description variable at the very beginning
    let description = "";

    // Parse sequence diagram structure
    const sequence = parseSequenceDiagram(code);
    logDebug(
      `[Mermaid Accessibility] Parse Results: hasBreaks=${sequence.hasBreaks}, blocks=${sequence.blocks.length}`
    );
    logDebug(
      `[Mermaid Accessibility] All messages:`,
      sequence.allMessages.map((m) => m.content)
    );

    // Add comments tracking for description
    const hasComments = sequence.comments && sequence.comments.length > 0;

    // Check if break messages are properly assigned to break blocks
    if (sequence.blocks && sequence.blocks.length > 0) {
      sequence.blocks.forEach((block, i) => {
        if (block.type === "break") {
          logDebug(
            `[Mermaid Accessibility] Break block ${i} condition: ${block.condition}`
          );
          logDebug(
            `[Mermaid Accessibility] Break block ${i} messages:`,
            block.messages.map((m) => m.content)
          );
        }
      });
    }
    /**
     * Identify messages that should be part of break blocks based on their position in the code
     */
    function identifyMessagesInBreaks() {
      // Track which messages are inside break blocks
      const breakMessages = new Map();

      // No break blocks found? Return empty map
      if (
        !sequence.hasBreaks ||
        !sequence.blocks ||
        sequence.blocks.length === 0
      ) {
        return breakMessages;
      }

      // Reset the messages in all break blocks
      sequence.blocks.forEach((block) => {
        if (block.type === "break") {
          block.messages = [];
        }
      });

      // Go through break blocks and find messages that fall between the break and end lines
      sequence.blocks.forEach((block) => {
        if (block.type === "break" && block.lineIndex && block.endLineIndex) {
          const breakLineIndex = block.lineIndex;
          const endLineIndex = block.endLineIndex;

          logDebug(
            `[Mermaid Accessibility] Looking for messages between lines ${breakLineIndex} and ${endLineIndex}`
          );

          // Consider messages that are within this line range to be part of the break block
          sequence.allMessages.forEach((message) => {
            if (
              message.lineIndex > breakLineIndex &&
              message.lineIndex < endLineIndex
            ) {
              logDebug(
                `[Mermaid Accessibility] Identified message "${message.content}" as part of break condition "${block.condition}" (line ${message.lineIndex})`
              );
              breakMessages.set(message, block);
              block.messages.push(message);
            }
          });

          logDebug(
            `[Mermaid Accessibility] Break block now has ${block.messages.length} messages`
          );
        }
      });

      return breakMessages;
    }

    // Identify break messages
    const breakMessages = identifyMessagesInBreaks();
    logDebug(
      `[Mermaid Accessibility] Identified ${breakMessages.size} messages in break blocks`
    );

    // Try to extract logical flows (group of messages that relate to specific functionality)
    const logicalFlows = extractLogicalFlows(sequence);
    // When no logical flows are found, try to get the same flow name used in the short description
    if (
      logicalFlows.length === 0 &&
      sequence.allMessages &&
      sequence.allMessages.length > 0
    ) {
      const flowName = inferFlowName(sequence.allMessages, sequence);
      const flowDescription = generateFlowDescription(
        flowName,
        sequence.allMessages,
        sequence
      );

      logicalFlows.push({
        name: flowName,
        description: flowDescription,
        messages: sequence.allMessages,
        blocks: sequence.blocks,
      });
    }

    // 1. Overview section - diagram description
    description += `<section class="mermaid-section sequence-overview" aria-labelledby="diagram-description">
<h4 class="mermaid-section-heading" id="diagram-description">Diagram Overview</h4>
<p>This sequence diagram`;

    // Use title if available, otherwise try to infer one
    if (sequence.title) {
      description += ` titled "<span class="diagram-title">${sequence.title}</span>"`;
    } else {
      const inferredTitle = inferTitleFromContent(sequence);
      if (inferredTitle) {
        description += ` showing <span class="diagram-title">${inferredTitle}</span>`;
      }
    }

    // Total participant count (actors + participants)
    const totalParticipantCount =
      sequence.actors.length + sequence.participants.length;

    description += ` illustrates the interaction between ${totalParticipantCount} `;

    if (sequence.actors.length > 0 && sequence.participants.length > 0) {
      description += `entities (${sequence.actors.length} ${
        sequence.actors.length === 1 ? "actor" : "actors"
      } and ${sequence.participants.length} ${
        sequence.participants.length === 1 ? "system" : "systems"
      })`;
    } else if (sequence.actors.length > 0) {
      description += `${sequence.actors.length === 1 ? "actor" : "actors"}`;
    } else {
      description += `${
        sequence.participants.length === 1 ? "participant" : "participants"
      }`;
    }

    description += `. The diagram contains ${sequence.messageCount} messages`;

    // Add information about special structures
    const specialFeatures = [];
    if (sequence.hasLoops) specialFeatures.push("repeated message loops");
    if (sequence.hasAlts) specialFeatures.push("conditional paths");
    if (sequence.hasOpts) specialFeatures.push("optional sequences");
    if (sequence.hasNotes) specialFeatures.push("explanatory notes");
    if (sequence.hasActivations) specialFeatures.push("component activations");
    if (sequence.hasParallel) specialFeatures.push("parallel actions");
    if (sequence.hasCritical) specialFeatures.push("critical actions");
    if (hasComments) specialFeatures.push("developer comments");

    if (specialFeatures.length > 0) {
      description += ` and includes ${formatList(specialFeatures)}`;
    }

    description += `.</p>`;
    // Add a summary of any notes if present
    if (sequence.notes && sequence.notes.length > 0) {
      description += `<p class="notes-summary">The diagram includes ${
        sequence.notes.length
      } explanatory ${sequence.notes.length === 1 ? "note" : "notes"}:`;
      description += `<ul class="notes-list">`;

      // Show ALL notes, not just the first one
      sequence.notes.forEach((note) => {
        // Include participants in note description
        let participantsText = "";
        if (note.participants && note.participants.length > 0) {
          const participantNames = note.participants.map(
            (id) => sequence.aliasMap[id] || id
          );

          if (note.position === "over" && participantNames.length > 1) {
            participantsText = ` (spanning ${formatParticipantsList(
              participantNames
            )})`;
          } else if (note.position === "right") {
            participantsText = ` (right of ${participantNames[0]})`;
          } else if (note.position === "left") {
            participantsText = ` (left of ${participantNames[0]})`;
          } else if (
            note.position === "over" &&
            participantNames.length === 1
          ) {
            participantsText = ` (over ${participantNames[0]})`;
          }
        }

        description += `<li class="note-item">${note.content}${participantsText}</li>`;
      });

      description += `</ul></p>`;
    }

    description += `</section>`;

    // 2. Actors section (if any)
    if (sequence.actors.length > 0) {
      description += `<section class="mermaid-section sequence-actors" aria-labelledby="sequence-actors-heading">
    <h4 class="mermaid-section-heading" id="sequence-actors-heading">Actors</h4>
    <ul class="actor-list">`;

      sequence.actors.forEach((actor) => {
        // Get the group for this actor if it exists
        let actorId = Object.keys(sequence.aliasMap).find(
          (key) => sequence.aliasMap[key] === actor
        );
        let group = actorId ? sequence.participantGroups[actorId] : null;

        description += `<li class="actor-item"><span class="actor-name">${actor}</span>`;

        if (group) {
          description += ` <span class="actor-group">(in group ${group})</span>`;
        }

        description += `</li>`;
      });

      description += `</ul></section>`;
    }

    // 3. Participants section with group information
    if (sequence.participants.length > 0) {
      description += `<section class="mermaid-section sequence-participants" aria-labelledby="sequence-participants-heading">
    <h4 class="mermaid-section-heading" id="sequence-participants-heading">Participants</h4>
    <ul class="participant-list">`;

      sequence.participants.forEach((participant) => {
        // Get the group for this participant if it exists
        let participantId = Object.keys(sequence.aliasMap).find(
          (key) => sequence.aliasMap[key] === participant
        );
        let group = participantId
          ? sequence.participantGroups[participantId]
          : null;

        description += `<li class="participant-item"><span class="participant-name">${participant}</span>`;

        if (group) {
          description += ` <span class="participant-group">(in group ${group})</span>`;
        }

        description += `</li>`;
      });

      description += `</ul></section>`;
    }
    // Insert Groups section if we have groups
    if (sequence.groups && sequence.groups.length > 0) {
      description += `<section class="mermaid-section sequence-groups" aria-labelledby="sequence-groups-heading">
      <h4 class="mermaid-section-heading" id="sequence-groups-heading">Groups</h4>
      <ul class="group-list">`;

      sequence.groups.forEach((group) => {
        const memberDisplayNames = group.members.map(
          (memberId) => sequence.aliasMap[memberId] || memberId
        );

        description += `<li class="group-item">
        <span class="group-name">${group.name}</span>
        <span class="group-members">contains ${memberDisplayNames.length} ${
          memberDisplayNames.length === 1 ? "participant" : "participants"
        }: ${memberDisplayNames.join(", ")}</span>
      </li>`;
      });

      description += `</ul></section>`;
    }

    // 4. Process Flows section with step-by-step description
    description += `<section class="mermaid-section sequence-processes" aria-labelledby="sequence-processes-heading">
<h4 class="mermaid-section-heading" id="sequence-processes-heading">Process Flows</h4>`;
    if (logicalFlows.length > 0) {
      logicalFlows.forEach((flow, flowIndex) => {
        description += `<div class="logical-flow">
  <h5 class="flow-heading" id="flow-${flowIndex + 1}">${flow.name}</h5>
  <p class="flow-description">${flow.description}</p>
  <ol class="message-list">`;

        let stepNumber = 1;

        // Create a combined timeline of all events
        const timelineEvents = [];

        // Map to associate comments with the messages they follow
        const commentsByPrecedingMessage = new Map();

        // First, process messages and build a mapping of line indices to messages
        const messagesByLineIndex = new Map();
        flow.messages.forEach((message) => {
          timelineEvents.push({
            type: "message",
            data: message,
            lineIndex: message.lineIndex,
          });
          messagesByLineIndex.set(message.lineIndex, message);
        });

        // Next, associate comments with the messages that precede them in the code
        if (sequence.comments && sequence.comments.length > 0) {
          sequence.comments.forEach((comment) => {
            // Find the message with the highest line index that's still less than the comment's line index
            let closestPrecedingMessageLineIndex = -1;
            let closestMessage = null;

            for (const [lineIndex, message] of messagesByLineIndex.entries()) {
              if (
                lineIndex < comment.lineIndex &&
                lineIndex > closestPrecedingMessageLineIndex
              ) {
                closestPrecedingMessageLineIndex = lineIndex;
                closestMessage = message;
              }
            }

            // Add comment to the timeline with a reference to its preceding message
            timelineEvents.push({
              type: "comment",
              data: comment,
              lineIndex: comment.lineIndex || 0,
              precedingMessageLineIndex: closestPrecedingMessageLineIndex,
            });

            // Also store in the map for easier lookup
            if (closestMessage) {
              if (!commentsByPrecedingMessage.has(closestMessage)) {
                commentsByPrecedingMessage.set(closestMessage, []);
              }
              commentsByPrecedingMessage.get(closestMessage).push(comment);
            }
          });
        }
        // Add notes to the timeline
        sequence.notes.forEach((note) => {
          timelineEvents.push({
            type: "note",
            data: note,
            lineIndex: note.lineIndex || 0,
          });
        });

        // Add creation events that are relevant to this flow
        sequence.creationEvents.forEach((event) => {
          // Only include creations that are within the flow's line range
          const flowFirstLine =
            flow.messages.length > 0
              ? Math.min(...flow.messages.map((m) => m.lineIndex))
              : Infinity;
          const flowLastLine =
            flow.messages.length > 0
              ? Math.max(...flow.messages.map((m) => m.lineIndex))
              : -Infinity;

          if (
            event.lineIndex >= flowFirstLine - 3 &&
            event.lineIndex <= flowLastLine + 3
          ) {
            timelineEvents.push({
              type: "creation",
              data: event,
              lineIndex: event.lineIndex,
            });
          }
        });

        // Add destruction events that are relevant to this flow
        sequence.destructionEvents.forEach((event) => {
          // Only include destructions that are within the flow's line range
          const flowFirstLine =
            flow.messages.length > 0
              ? Math.min(...flow.messages.map((m) => m.lineIndex))
              : Infinity;
          const flowLastLine =
            flow.messages.length > 0
              ? Math.max(...flow.messages.map((m) => m.lineIndex))
              : -Infinity;

          if (
            event.lineIndex >= flowFirstLine - 3 &&
            event.lineIndex <= flowLastLine + 3
          ) {
            timelineEvents.push({
              type: "destruction",
              data: event,
              lineIndex: event.lineIndex,
            });
          }
        });

        // Add activation events that are relevant to this flow
        sequence.activations.forEach((event) => {
          // Only include activations that are within the flow's line range
          const flowFirstLine =
            flow.messages.length > 0
              ? Math.min(...flow.messages.map((m) => m.lineIndex))
              : Infinity;
          const flowLastLine =
            flow.messages.length > 0
              ? Math.max(...flow.messages.map((m) => m.lineIndex))
              : -Infinity;

          if (
            event.lineIndex >= flowFirstLine - 3 &&
            event.lineIndex <= flowLastLine + 3
          ) {
            timelineEvents.push({
              type: "activation",
              data: event,
              lineIndex: event.lineIndex,
            });
          }
        });

        // Sort the timeline by line number
        timelineEvents.sort((a, b) => a.lineIndex - b.lineIndex);
        // Process the timeline to generate step-by-step description
        let index = 0;

        while (index < timelineEvents.length) {
          const event = timelineEvents[index];

          // Skip comment events - we'll add them with their associated messages
          if (event.type === "comment") {
            index++;
            continue;
          }

          if (event.type === "message") {
            const message = event.data;

            // Check if this message belongs to a parallel block
            const parallelBlockForMessage = findParallelBlockForMessage(
              message,
              sequence.parallelBlocks
            );

            if (parallelBlockForMessage) {
              // Handle the start of a parallel block
              description += generateParallelBlockHTML(
                parallelBlockForMessage,
                stepNumber,
                sequence
              );

              // Skip past all messages in this parallel block
              const messagesInBlock = countMessagesInParallelBlock(
                parallelBlockForMessage
              );
              index += messagesInBlock;
              stepNumber++; // The entire parallel block counts as one logical step
            } else if (findBlockForMessage(message, sequence.blocks)) {
              // Handle the start of a conditional block
              const blockForMessage = findBlockForMessage(
                message,
                sequence.blocks
              );

              // Check specifically for break blocks and use improved display
              if (blockForMessage.type === "break") {
                description += generateConditionalBlockHTML(
                  blockForMessage,
                  stepNumber,
                  sequence
                );

                // Skip past all messages in this block
                const messagesInBlock = countMessagesInBlock(blockForMessage);
                index += messagesInBlock;
                stepNumber++; // The entire block counts as one logical step
              } else {
                // Handle other conditional blocks
                description += generateConditionalBlockHTML(
                  blockForMessage,
                  stepNumber,
                  sequence
                );

                // Skip past all messages in this block
                const messagesInBlock = countMessagesInBlock(blockForMessage);
                index += messagesInBlock;
                stepNumber++; // The entire block counts as one logical step
              }
            } else {
              // Regular message
              const correctedSender = getCorrectEntityName(
                message.sender,
                message.isResponse,
                sequence
              );
              const correctedReceiver = getCorrectEntityName(
                message.receiver,
                message.isResponse,
                sequence
              );

              // Include message number if available
              let messageNumberHtml = "";
              if (message.messageNumber) {
                messageNumberHtml = `<span class="message-number original-number">${message.messageNumber}.</span> `;
              } else {
                messageNumberHtml = `<span class="step-index">(Step ${stepNumber})</span> `;
              }
              // Update the message list item generation to maintain original message numbers
              description += `<li class="process-step">
          <span class="step-number">`;

              // Add this conditional to include both step number and original message number when available
              if (message.messageNumber) {
                description += `<span class="original-message-number">Message ${message.messageNumber}</span> (Step ${stepNumber}):`;
              } else {
                description += `Step ${stepNumber}:`;
              }

              description += `</span>
          <span class="message-sender ${
            sequence.actors.includes(correctedSender) ? "actor" : "participant"
          }">${correctedSender}</span>
          <span class="message-type">${formatMessageType(message.type)}</span>
          <span class="message-receiver ${
            sequence.actors.includes(correctedReceiver)
              ? "actor"
              : "participant"
          }">${correctedReceiver}</span>`;

              if (message.content) {
                // Display content without duplicating the message number since we now show it in the step number
                const contentWithoutNumber = message.messageNumber
                  ? message.content.replace(/^\d+\.\s*/, "") // Remove leading numbers like "1. "
                  : message.content;
                description += `: <span class="message-content">${contentWithoutNumber}</span>`;
              }

              // Add comments associated with this message
              if (commentsByPrecedingMessage.has(message)) {
                commentsByPrecedingMessage.get(message).forEach((comment) => {
                  description += `
            <div class="message-comment associated-comment">
                <span class="comment-prefix">- </span>
                <span class="comment-icon" aria-hidden="true">💬</span>
                <span class="comment-label">Developer comment: </span>
                <span class="comment-content">${comment.content}</span>
            </div>`;
                });
              }

              description += `</li>`;

              index++;
              stepNumber++;
            }
          } else if (event.type === "creation") {
            // Handle creation event
            const creationEvent = event.data;
            const displayName = creationEvent.displayName;
            const entityType =
              creationEvent.type === "actor" ? "actor" : "participant";

            description += `<li class="process-step lifecycle-step creation-step">
          <span class="step-number">Step ${stepNumber}:</span>
          <span class="lifecycle-event">New ${entityType} <span class="${entityType}-name">${displayName}</span> is created</span>
          </li>`;

            index++;
            stepNumber++;
          } else if (event.type === "destruction") {
            // Handle destruction event
            const destructionEvent = event.data;
            const displayName = destructionEvent.displayName;
            const entityType = sequence.actors.includes(displayName)
              ? "actor"
              : "participant";

            description += `<li class="process-step lifecycle-step destruction-step">
          <span class="step-number">Step ${stepNumber}:</span>
          <span class="lifecycle-event">${entityType} <span class="${entityType}-name">${displayName}</span> is removed from the interaction</span>
          </li>`;

            index++;
            stepNumber++;
          } else if (event.type === "note") {
            // Handle note event
            const note = event.data;

            // Format participant names with proper display
            const participantDisplayNames = note.participants.map((id) => {
              const displayName = getCorrectEntityName(id, false, sequence);
              return displayName;
            });

            // Create a description based on the note position
            let noteDescription = "";
            if (note.isSpanning) {
              noteDescription = `Note spanning ${formatParticipantsList(
                participantDisplayNames
              )}`;
            } else if (note.position === "left") {
              noteDescription = `Note to the left of ${participantDisplayNames[0]}`;
            } else if (note.position === "right") {
              noteDescription = `Note to the right of ${participantDisplayNames[0]}`;
            } else {
              noteDescription = `Note regarding ${formatParticipantsList(
                participantDisplayNames
              )}`;
            }

            description += `<li class="process-step note-step">
            <span class="step-number">Step ${stepNumber}:</span>
            <span class="note-indicator">${noteDescription}:</span>
            <span class="note-content">"${note.content}"</span>
          </li>`;

            index++;
            stepNumber++;
          } else if (event.type === "activation") {
            // Handle activation event
            const activationEvent = event.data;
            const participant = getCorrectEntityName(
              activationEvent.participant,
              false,
              sequence
            );
            const entityType = sequence.actors.includes(participant)
              ? "actor"
              : "participant";
            const actionType =
              activationEvent.type === "activate" ? "activated" : "deactivated";

            description += `<li class="process-step lifecycle-step ${activationEvent.type}-step">
          <span class="step-number">Step ${stepNumber}:</span>
          <span class="lifecycle-event">${entityType} <span class="${entityType}-name">${participant}</span> is ${actionType}</span>
          </li>`;

            index++;
            stepNumber++;
          } else {
            // Unknown event type, skip it
            index++;
          }
        }

        // Process any remaining standalone comments
        const standaloneComments = timelineEvents.filter(
          (e) => e.type === "comment" && e.precedingMessageLineIndex === -1
        );

        if (standaloneComments.length > 0) {
          description += `<li class="process-note">
        <div class="standalone-comment-container">
          <span class="note-prefix">Additional notes: </span>`;

          standaloneComments.forEach((event) => {
            description += `
        <div class="message-comment standalone-comment">
            <span class="comment-icon" aria-hidden="true">💬</span>
            <span class="comment-label">Developer comment: </span>
            <span class="comment-content">${event.data.content}</span>
        </div>`;
          });

          description += `</div></li>`;
        }

        description += `</ol></div>`;
      });
    } else {
      // Fallback if no logical flows were identified
      description += `<div class="logical-flow">
      <h5 class="flow-heading">Message Sequence</h5>
      <p class="flow-description">This sequence diagram shows the exchange of messages between participants.</p>
      <ol class="message-list">
        <li class="process-step">
          <span class="step-number">Step 1:</span>
          <span class="message-text">No detailed sequence information available.</span>
        </li>
      </ol>
    </div>`;
    }

    description += `</section>`;

    // 5. Explanation section with improved explanation and summary
    description += `<section class="mermaid-section sequence-explanation" aria-labelledby="sequence-explanation-heading">
  <h4 class="mermaid-section-heading" id="sequence-explanation-heading">Understanding the Diagram</h4>
  <div class="explanation">`;

    // Generate explanation based on diagram features
    if (logicalFlows.length > 1) {
      description += `<p>This sequence diagram depicts ${logicalFlows.length} main processes:</p>
<ol>`;

      logicalFlows.forEach((flow) => {
        description += `<li><strong>${flow.name}</strong> - ${flow.description}</li>`;
      });

      description += `</ol>`;
    } else if (logicalFlows.length === 1) {
      description += `<p>This sequence diagram depicts a single process: <strong>${logicalFlows[0].name}</strong>.</p>
<p>${logicalFlows[0].description}</p>`;
    }
    // Add a summary of key paths through the system
    description += `<h5 class="sequence-summary-heading">Key Paths Through the System</h5>
<ul class="sequence-paths">`;

    // Process successful path
    description += `<li class="sequence-path success-path">
<strong>Happy Path:</strong> The main successful flow through the system where all validations pass</li>`;

    // Look for conditional blocks to explain alternative paths
    if (sequence.hasAlts || sequence.hasOpts || sequence.hasCritical) {
      description += `<li class="sequence-path alternative-path">
    <strong>Alternative Paths:</strong> The diagram shows ${extractConditionalCount(
      sequence
    )} different conditional branches where the flow changes based on:
    <ul>`;

      // List the key conditions from conditional blocks
      if (sequence.blocks && sequence.blocks.length > 0) {
        sequence.blocks.forEach((block) => {
          if (block.type === "alt") {
            description += `<li class="condition-point"><strong>${
              block.condition || "Condition check"
            }</strong> - Leading to different paths based on the outcome</li>`;
          } else if (block.type === "opt") {
            description += `<li class="condition-point"><strong>${
              block.condition || "Optional step"
            }</strong> - Only executed under specific conditions</li>`;
          } else if (block.type === "critical") {
            description += `<li class="condition-point"><strong>${
              block.label || "Critical action"
            }</strong> - A critical action that must be performed with handling for possible circumstances</li>`;

            // List the options if present
            if (block.options && block.options.length > 0) {
              description += `<ul>`;
              block.options.forEach((option) => {
                description += `<li><strong>${
                  option.condition || "Alternative circumstance"
                }</strong> - An alternative flow for the critical action</li>`;
              });
              description += `</ul>`;
            }
          }
        });
      }

      description += `</ul></li>`;
    }

    // Add break conditions if they exist - properly structured inside the paths list
    if (sequence.hasBreaks) {
      description += `<li class="sequence-path break-path">
    <strong>Break Path:</strong> The diagram shows ${extractBreakConditionsCount(
      sequence
    )} break condition(s) where the sequence will stop early:
    <ul>`;

      // List the key break conditions
      if (sequence.blocks && sequence.blocks.length > 0) {
        sequence.blocks.forEach((block) => {
          if (block.type === "break") {
            description += `<li class="condition-point"><strong>${
              block.condition || "Break condition"
            }</strong> - When this condition occurs, execution stops at this point and subsequent messages are not processed</li>`;
          }
        });
      }

      description += `</ul></li>`;
    }

    // Close the list
    description += `</ul>`;

    // Add explanation about notation with improved arrow type descriptions
    description += `<h5 class="diagram-notation-heading">Diagram Notation</h5>
<ul class="notation-list">
  <li><strong>Solid arrows (<span aria-hidden="true">→</span><span class="sr-only">represented by a right-pointing arrow</span>)</strong> represent synchronous messages or requests from one participant to another</li>
  <li><strong>Dashed arrows (<span aria-hidden="true">--→</span><span class="sr-only">represented by a dashed right-pointing arrow</span>)</strong> represent return messages or responses to previous requests</li>`;

    if (sequence.allMessages.some((m) => m.isAsync)) {
      description += `<li><strong>Asynchronous arrows (<span aria-hidden="true">-)</span><span class="sr-only">represented by a half arrow</span>)</strong> represent asynchronous messages that don't wait for a response</li>`;
    }

    if (sequence.allMessages.some((m) => m.isError)) {
      description += `<li><strong>Error arrows (<span aria-hidden="true">-x</span><span class="sr-only">represented by an arrow with an X</span>)</strong> represent error messages or failed operations</li>`;
    }

    // Add a new list item for break blocks when they exist
    if (sequence.hasBreaks) {
      description += `<li><strong>Break blocks</strong> indicate conditional exit points in the sequence - when the specified condition occurs, the flow stops immediately and subsequent messages are not executed (typically used for error handling or exception cases)</li>`;
    }

    if (sequence.allMessages.some((m) => m.isBidirectional)) {
      description += `<li><strong>Bidirectional arrows (<span aria-hidden="true">←→</span><span class="sr-only">represented by arrows pointing in both directions</span>)</strong> represent two-way communication between participants</li>`;
    }

    if (sequence.hasActivations) {
      description += `<li><strong>Activation boxes</strong> show when a participant is active and processing a request</li>`;
    }

    if (sequence.hasAlts) {
      description += `<li><strong>Alternative paths (alt/else)</strong> show different possible flows based on conditions, similar to if/else logic in programming</li>`;
    }

    if (sequence.hasOpts) {
      description += `<li><strong>Optional paths (opt)</strong> show sequences that may not always execute, similar to if statements without an else clause</li>`;
    }

    if (sequence.hasCritical) {
      description += `<li><strong>Critical blocks (critical/option/end)</strong> indicate actions that must be performed with conditional handling of different circumstances</li>`;
    }

    if (sequence.hasLoops) {
      description += `<li><strong>Loops</strong> show repeating sequences of messages, similar to while or for loops in programming</li>`;
    }

    if (sequence.hasParallel) {
      description += `<li><strong>Parallel blocks (par/and)</strong> show actions that happen simultaneously or concurrently</li>`;
    }

    if (sequence.hasNotes) {
      description += `<li><strong>Notes</strong> provide additional context or explanation for specific parts of the diagram</li>`;
    }

    if (hasComments) {
      description += `<li><strong>Developer comments</strong> (prefixed with %%) provide additional technical context that doesn't appear in the visual diagram</li>`;
    }

    description += `</ul>`;

    // Add information about comments if present
    // Replace the entire comments section with this improved version
    if (hasComments && sequence.comments.length > 0) {
      // Filter out init directives in case they somehow got through
      const filteredComments = sequence.comments.filter(
        (comment) =>
          !comment.content.includes("{init:") &&
          !comment.content.includes("themeVariables")
      );

      if (filteredComments.length > 0) {
        const commentCategories = organiseComments({
          comments: filteredComments,
        });

        description += `
        <h5 class="comments-explanation-heading">Developer Comments</h5>
        <p>This diagram contains ${filteredComments.length} developer ${
          filteredComments.length === 1 ? "comment" : "comments"
        } that provide additional context about implementation and design decisions.</p>`;

        if (commentCategories.structure.length > 0) {
          description += `<h6 class="comment-category">Diagram Structure</h6><ul class="comments-list structure-comments">`;
          commentCategories.structure.forEach((comment) => {
            description += `<li class="comment-item">
          <span class="comment-content">${comment.content}</span>`;
            if (comment.isInline && comment.messageContent) {
              description += ` <span class="comment-context">(associated with message: "${comment.messageContent}")</span>`;
            }
            description += `</li>`;
          });
          description += `</ul>`;
        }

        if (commentCategories.flow.length > 0) {
          description += `<h6 class="comment-category">Flow Control</h6><ul class="comments-list flow-comments">`;
          commentCategories.flow.forEach((comment) => {
            description += `<li class="comment-item">
          <span class="comment-content">${comment.content}</span>`;
            if (comment.isInline && comment.messageContent) {
              description += ` <span class="comment-context">(associated with message: "${comment.messageContent}")</span>`;
            }
            description += `</li>`;
          });
          description += `</ul>`;
        }

        if (commentCategories.functionality.length > 0) {
          description += `<h6 class="comment-category">Participant Lifecycle</h6><ul class="comments-list functionality-comments">`;
          commentCategories.functionality.forEach((comment) => {
            description += `<li class="comment-item">
          <span class="comment-content">${comment.content}</span>`;
            if (comment.isInline && comment.messageContent) {
              description += ` <span class="comment-context">(associated with message: "${comment.messageContent}")</span>`;
            }
            description += `</li>`;
          });
          description += `</ul>`;
        }

        if (commentCategories.other.length > 0) {
          description += `<h6 class="comment-category">Other Notes</h6><ul class="comments-list other-comments">`;
          commentCategories.other.forEach((comment) => {
            description += `<li class="comment-item">
          <span class="comment-content">${comment.content}</span>`;
            if (comment.isInline && comment.messageContent) {
              description += ` <span class="comment-context">(associated with message: "${comment.messageContent}")</span>`;
            }
            description += `</li>`;
          });
          description += `</ul>`;
        }
      }
    }
    description += `
    <h5 class="sequence-reading-heading">How to Read This Diagram</h5>
    <p>Sequence diagrams are read from top to bottom, with time flowing downward. Each vertical line represents a participant's timeline, and horizontal arrows show messages passed between participants. The diagram shows both the chronological order of interactions and the organisational relationships between components.</p>
    </div></section>`;

    // Helper function to count break conditions
    function extractBreakConditionsCount(sequence) {
      let count = 0;
      if (sequence.blocks) {
        sequence.blocks.forEach((block) => {
          if (block.type === "break") {
            count++;
          }
        });
      }
      return count;
    }

    // Helper function to count conditions
    function extractConditionalCount(sequence) {
      let count = 0;
      if (sequence.blocks) {
        sequence.blocks.forEach((block) => {
          if (block.type === "alt") {
            // Count branches in alt blocks
            count += block.branches.length;
          } else if (block.type === "opt") {
            // Count opt blocks
            count += 1;
          } else if (block.type === "critical") {
            // Count critical blocks and their options
            count += 1;
            if (block.options) {
              count += block.options.length;
            }
          }
        });
      }
      return count;
    }

    return description;
  }

  /**
   * Find the conditional block that a message belongs to
   * @param {Object} message - The message to check
   * @param {Array} blocks - Array of conditional blocks
   * @returns {Object|null} The block if found, or null
   */
  function findBlockForMessage(message, blocks) {
    logDebug(
      `[Mermaid Accessibility] Checking for block containing message: ${message.content}`
    );
    logDebug(`[Mermaid Accessibility] Total blocks to check: ${blocks.length}`);

    for (const block of blocks) {
      logDebug(`[Mermaid Accessibility] Checking block type: ${block.type}`);

      if (block.type === "alt") {
        for (const branch of block.branches) {
          if (branch.messages.some((m) => m === message)) {
            logDebug(`[Mermaid Accessibility] Found message in alt branch`);
            return block;
          }
        }
      } else if (block.type === "critical") {
        // Check main critical block messages
        if (block.messages.some((m) => m === message)) {
          logDebug(`[Mermaid Accessibility] Found message in critical block`);
          return block;
        }

        // Check option messages
        if (block.options) {
          for (const option of block.options) {
            if (option.messages.some((m) => m === message)) {
              logDebug(
                `[Mermaid Accessibility] Found message in critical option`
              );
              return block;
            }
          }
        }
      } else if (block.type === "break") {
        // Added specific logging for break blocks
        const found = block.messages.some((m) => m === message);
        logDebug(
          `[Mermaid Accessibility] Checking break block messages. Found: ${found}`
        );
        if (found) {
          logDebug(
            `[Mermaid Accessibility] Found message in break block: ${message.content}`
          );
          return block;
        }
      } else if (block.messages.some((m) => m === message)) {
        logDebug(
          `[Mermaid Accessibility] Found message in ${block.type} block`
        );
        return block;
      }
    }
    logDebug(
      `[Mermaid Accessibility] No block found for message: ${message.content}`
    );
    return null;
  }
  /**
   * Identify messages that are inside a break block
   * @param {Object} sequence - The sequence diagram data
   * @returns {Object} Map of message contents to their containing break block
   */
  function identifyBreakMessages(sequence) {
    const breakMessageMap = new Map();

    if (sequence.blocks) {
      sequence.blocks.forEach((block) => {
        if (block.type === "break" && block.messages) {
          block.messages.forEach((message) => {
            if (message.content) {
              breakMessageMap.set(message.content, block);
            }
          });
        }
      });
    }

    logDebug(
      `[Mermaid Accessibility] Identified ${breakMessageMap.size} break messages`
    );
    return breakMessageMap;
  }
  /**
   * Find the parallel block that a message belongs to
   * @param {Object} message - The message to check
   * @param {Array} parallelBlocks - Array of parallel blocks
   * @returns {Object|null} The parallel block if found, or null
   */
  function findParallelBlockForMessage(message, parallelBlocks) {
    for (const block of parallelBlocks) {
      for (const branch of block.branches) {
        if (branch.messages.some((m) => m === message)) {
          return block;
        }
      }
    }
    return null;
  }

  /**
   * Count the total number of messages in a block
   * @param {Object} block - The conditional block
   * @returns {number} Total message count
   */
  function countMessagesInBlock(block) {
    if (block.type === "alt") {
      return block.branches.reduce(
        (count, branch) => count + branch.messages.length,
        0
      );
    } else if (block.type === "critical") {
      let count = block.messages.length;

      // Add messages from each option
      if (block.options) {
        count += block.options.reduce(
          (subCount, option) => subCount + option.messages.length,
          0
        );
      }

      return count;
    } else {
      return block.messages.length;
    }
  }

  /**
   * Count the total number of messages in a parallel block
   * @param {Object} block - The parallel block
   * @returns {number} Total message count
   */
  function countMessagesInParallelBlock(block) {
    return block.branches.reduce(
      (count, branch) => count + branch.messages.length,
      0
    );
  }

  /**
   * Generate HTML for a conditional block
   * @param {Object} block - The conditional block
   * @param {number} stepNumber - The current step number
   * @param {Object} sequenceData - The sequence diagram data
   * @returns {string} HTML for the conditional block
   */
  function generateConditionalBlockHTML(block, stepNumber, sequenceData) {
    let html = "";

    // Special case for break blocks with completely different layout
    if (block.type === "break") {
      html = `<li class="process-step conditional-step break-step" aria-labelledby="step-${stepNumber}-title">
      <span class="step-number" id="step-${stepNumber}-title">Step ${stepNumber}:</span>
      <div class="break-container">
        <div class="break-condition-header">
          <span class="break-icon" aria-hidden="true">⚠️</span>
          <span>Exit Condition: ${block.condition || "Break condition"}</span>
        </div>
        <div class="break-explanation">If this condition occurs, the following action will execute and the sequence will terminate immediately:</div>
        <ol class="break-action-list">`;

      block.messages.forEach((message) => {
        // Get entity names
        const correctedSender = getCorrectEntityName(
          message.sender,
          message.isResponse,
          sequenceData
        );
        const correctedReceiver = getCorrectEntityName(
          message.receiver,
          message.isResponse,
          sequenceData
        );

        html += `<li class="break-action-item">
        <span class="message-sender ${
          sequenceData.actors.includes(correctedSender)
            ? "actor"
            : "participant"
        }">${correctedSender}</span>
        <span class="message-type">${formatMessageType(message.type)}</span>
        <span class="message-receiver ${
          sequenceData.actors.includes(correctedReceiver)
            ? "actor"
            : "participant"
        }">${correctedReceiver}</span>`;

        if (message.content) {
          html += `: <span class="message-content">${message.content}</span>`;
        }

        html += `</li>`;
      });

      html += `</ol>
        <div class="break-subsequent-note">All subsequent messages in the diagram will not be executed if this condition occurs.</div>
      </div>
    </li>`;
    } else {
      // Start with context explanation of what this conditional block represents
      let contextExplanation = "";

      if (block.type === "alt") {
        contextExplanation = `<div class="conditional-context">This step branches based on ${
          block.condition || "different conditions"
        }.</div>`;
      } else if (block.type === "opt") {
        contextExplanation = `<div class="conditional-context">This step only executes when ${
          block.condition || "the condition is met"
        }.</div>`;
      } else if (block.type === "loop") {
        contextExplanation = `<div class="conditional-context">This step repeats ${
          block.label ? "for " + block.label : "multiple times"
        }.</div>`;
      } else if (block.type === "critical") {
        contextExplanation = `<div class="conditional-context">This is a critical action that must be performed: ${
          block.label || "Critical Action"
        }.</div>`;
      }

      html = `<li class="process-step conditional-step ${
        block.type
      }-step" aria-labelledby="step-${stepNumber}-title step-${stepNumber}-context">
    <span class="step-number" id="step-${stepNumber}-title">Step ${stepNumber}:</span>
    ${contextExplanation}
    <div class="branch-container">
      <div class="branch-title" id="step-${stepNumber}-context">${
        block.type === "alt"
          ? "Conditional paths"
          : block.type === "opt"
          ? `Optional path: ${block.condition}`
          : block.type === "critical"
          ? `Critical action: ${block.label}`
          : `Loop: ${block.label || "Repeated sequence"}`
      }</div>`;

      if (block.type === "alt") {
        // Handle alt/else blocks
        block.branches.forEach((branch, index) => {
          // Add outcome summary for each branch
          const branchOutcome = determineBranchOutcome(branch);

          html += `<div class="branch">
              <div class="branch-condition" id="branch-${stepNumber}-${index}-condition">${
            branch.condition || "Otherwise"
          }:</div>
              <div class="branch-outcome">${branchOutcome}</div>
              <ol class="branch-messages" aria-labelledby="branch-${stepNumber}-${index}-condition">`;

          branch.messages.forEach((message) => {
            // Determine if this is a response message by checking the type
            const isResponse = message.type && message.type.includes("--");

            // Apply corrections to entity names
            const correctedSender = getCorrectEntityName(
              message.sender,
              isResponse,
              sequenceData
            );
            const correctedReceiver = getCorrectEntityName(
              message.receiver,
              isResponse,
              sequenceData
            );

            html += `<li class="message-item">
                <span class="message-sender ${
                  sequenceData.actors.includes(correctedSender)
                    ? "actor"
                    : "participant"
                }">${correctedSender}</span>
                <span class="message-type">${formatMessageType(
                  message.type
                )}</span>
                <span class="message-receiver ${
                  sequenceData.actors.includes(correctedReceiver)
                    ? "actor"
                    : "participant"
                }">${correctedReceiver}</span>`;

            if (message.content) {
              html += `: <span class="message-content">${message.content}</span>`;
            }

            html += `</li>`;
          });

          html += `</ol></div>`;
        });
      } else if (
        block.type === "opt" ||
        block.type === "loop" ||
        block.type === "critical"
      ) {
        // Handle optional and loop blocks
        html += `<ol class="branch-messages">`;

        block.messages.forEach((message) => {
          // Determine if this is a response message by checking the type
          const isResponse = message.type && message.type.includes("--");

          // Apply corrections to entity names
          const correctedSender = getCorrectEntityName(
            message.sender,
            isResponse,
            sequenceData
          );
          const correctedReceiver = getCorrectEntityName(
            message.receiver,
            isResponse,
            sequenceData
          );

          html += `<li class="message-item">
          <span class="message-sender ${
            sequenceData.actors.includes(correctedSender)
              ? "actor"
              : "participant"
          }">${correctedSender}</span>
          <span class="message-type">${formatMessageType(message.type)}</span>
          <span class="message-receiver ${
            sequenceData.actors.includes(correctedReceiver)
              ? "actor"
              : "participant"
          }">${correctedReceiver}</span>`;

          if (message.content) {
            html += `: <span class="message-content">${message.content}</span>`;
          }

          html += `</li>`;
        });

        html += `</ol>`;
      }

      html += `</div></li>`;
    }

    return html;
  }
  /**
   * Generate HTML for a parallel block
   * @param {Object} block - The parallel block
   * @param {number} stepNumber - The current step number
   * @param {Object} sequenceData - The sequence diagram data
   * @returns {string} HTML for the parallel block
   */
  function generateParallelBlockHTML(block, stepNumber, sequenceData) {
    // Modify the branch title line
    let html = `<li class="process-step parallel-step" aria-labelledby="step-${stepNumber}-title step-${stepNumber}-context">
        <span class="step-number" id="step-${stepNumber}-title">Step ${stepNumber}:</span>
        <div class="conditional-context">This step contains actions that happen in parallel.</div>
        <div class="branch-container">
          <div class="branch-title" id="step-${stepNumber}-context">${
      block.label && block.label !== "Parallel actions"
        ? `Parallel actions: ${block.label}`
        : "Parallel actions"
    }</div>`;

    // Handle parallel branches
    block.branches.forEach((branch, index) => {
      html += `<div class="branch">
                <div class="branch-condition" id="branch-${stepNumber}-${index}-condition">${
        branch.label || `Parallel path ${index + 1}`
      }:</div>
                <ol class="branch-messages" aria-labelledby="branch-${stepNumber}-${index}-condition">`;

      branch.messages.forEach((message) => {
        // Determine if this is a response message by checking the type
        const isResponse = message.type && message.type.includes("--");

        // Apply corrections to entity names
        const correctedSender = getCorrectEntityName(
          message.sender,
          isResponse,
          sequenceData
        );
        const correctedReceiver = getCorrectEntityName(
          message.receiver,
          isResponse,
          sequenceData
        );

        html += `<li class="message-item">
                    <span class="message-sender ${
                      sequenceData.actors.includes(correctedSender)
                        ? "actor"
                        : "participant"
                    }">${correctedSender}</span>
                    <span class="message-type">${formatMessageType(
                      message.type
                    )}</span>
                    <span class="message-receiver ${
                      sequenceData.actors.includes(correctedReceiver)
                        ? "actor"
                        : "participant"
                    }">${correctedReceiver}</span>`;

        if (message.content) {
          html += `: <span class="message-content">${message.content}</span>`;
        }

        html += `</li>`;
      });

      html += `</ol></div>`;
    });

    html += `</div></li>`;

    return html;
  }

  // Helper function to determine the outcome summary of a branch
  function determineBranchOutcome(branch) {
    // Look for final messages in the branch to determine the outcome
    if (branch.messages.length === 0) return "";

    // Check the last few messages to determine outcome
    const lastMessages = branch.messages.slice(-2);

    // Look for success/error indicators in content
    const hasSuccess = lastMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("success") ||
          msg.content.toLowerCase().includes("dashboard") ||
          msg.content.toLowerCase().includes("complete") ||
          msg.content.toLowerCase().includes("display") ||
          msg.content.toLowerCase().includes("show "))
    );

    const hasError = lastMessages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("error") ||
          msg.content.toLowerCase().includes("fail") ||
          msg.content.toLowerCase().includes("reject") ||
          msg.content.toLowerCase().includes("denied"))
    );

    if (hasSuccess) {
      return "Outcome: Success path - process completes successfully";
    } else if (hasError) {
      return "Outcome: Error path - process handles failure condition";
    }

    // Generic outcome if we can't determine specifics
    return "Outcome: Process continues with specific logic for this condition";
  }

  /**
   * Group messages into logical flows based on content analysis with improved phase detection
   * @param {Object} sequence - The parsed sequence diagram data
   * @returns {Array} Array of logical flow objects
   */
  function extractLogicalFlows(sequence) {
    // For diagrams with a title, prefer to keep everything as a single coherent flow
    if (sequence.title || sequence.allMessages.length < 15) {
      const flowName =
        sequence.title || inferFlowName(sequence.allMessages, sequence);
      return [
        {
          name: flowName,
          description: generateFlowDescription(
            flowName,
            sequence.allMessages,
            sequence
          ),
          messages: sequence.allMessages,
          blocks: sequence.blocks,
        },
      ];
    }

    // Define key phases to look for in the diagram
    const phases = [
      {
        name: "Authentication Phase",
        startKeywords: ["login", "authenticate", "credentials"],
        endKeywords: ["welcome", "dashboard", "invalid login"],
      },
      {
        name: "Password Reset Phase",
        startKeywords: ["forgot password", "reset password"],
        endKeywords: ["check your email", "reset sent", "password reset"],
      },
      {
        name: "Payment Processing Phase",
        startKeywords: ["purchase", "payment", "order"],
        endKeywords: [
          "payment completed",
          "payment failed",
          "transaction recorded",
        ],
      },
      {
        name: "Order Tracking Phase",
        startKeywords: ["check status", "track order"],
        endKeywords: ["status display", "current status"],
      },
    ];

    // Try to identify phase boundaries based on the content of messages
    const phaseStartIndices = [];
    const phaseEndIndices = [];
    const phaseNames = [];

    // Scan through messages to identify phase boundaries
    sequence.allMessages.forEach((message, index) => {
      if (!message.content) return;

      const content = message.content.toLowerCase();

      // Check if this message starts a new phase
      for (const phase of phases) {
        if (phase.startKeywords.some((keyword) => content.includes(keyword))) {
          // Check if the phase hasn't already started
          if (!phaseNames.includes(phase.name)) {
            phaseStartIndices.push(index);
            phaseNames.push(phase.name);
            break;
          }
        }
      }

      // Check if this message ends a phase
      const currentPhase = phaseNames[phaseNames.length - 1];
      if (currentPhase) {
        const phaseData = phases.find((p) => p.name === currentPhase);
        if (
          phaseData &&
          phaseData.endKeywords.some((keyword) => content.includes(keyword))
        ) {
          phaseEndIndices.push(index);
        }
      }
    });

    // If we couldn't identify clear phases, return a single flow
    if (phaseStartIndices.length === 0) {
      const flowName =
        sequence.title || inferFlowName(sequence.allMessages, sequence);
      return [
        {
          name: flowName,
          description: generateFlowDescription(
            flowName,
            sequence.allMessages,
            sequence
          ),
          messages: sequence.allMessages,
          blocks: sequence.blocks,
        },
      ];
    }

    // Add ending index for the last phase if needed
    if (phaseEndIndices.length < phaseStartIndices.length) {
      phaseEndIndices.push(sequence.allMessages.length - 1);
    }

    // Create flows based on the identified phases
    const flows = [];

    // Handle pre-phase messages if any
    if (phaseStartIndices[0] > 0) {
      const initialMessages = sequence.allMessages.slice(
        0,
        phaseStartIndices[0]
      );
      const initialName = "Initial Setup";
      flows.push({
        name: initialName,
        description: generateFlowDescription(
          initialName,
          initialMessages,
          sequence
        ),
        messages: initialMessages,
        blocks: getBlocksForMessages(initialMessages, sequence.blocks),
      });
    }

    // Create phase-based flows
    for (let i = 0; i < phaseStartIndices.length; i++) {
      const startIdx = phaseStartIndices[i];
      const endIdx = phaseEndIndices[i] || sequence.allMessages.length - 1;
      const phaseName = phaseNames[i];

      if (startIdx <= endIdx) {
        const phaseMessages = sequence.allMessages.slice(startIdx, endIdx + 1);
        flows.push({
          name: phaseName,
          description: generateFlowDescription(
            phaseName,
            phaseMessages,
            sequence
          ),
          messages: phaseMessages,
          blocks: getBlocksForMessages(phaseMessages, sequence.blocks),
        });
      }
    }

    // If we ended up with nothing, fall back to a single flow
    if (flows.length === 0) {
      const flowName =
        sequence.title || inferFlowName(sequence.allMessages, sequence);
      return [
        {
          name: flowName,
          description: generateFlowDescription(
            flowName,
            sequence.allMessages,
            sequence
          ),
          messages: sequence.allMessages,
          blocks: sequence.blocks,
        },
      ];
    }

    return flows;
  }

  /**
   * Get blocks that contain the given messages
   * @param {Array} messages - Array of messages
   * @param {Array} allBlocks - All blocks in the sequence
   * @returns {Array} Blocks containing these messages
   */
  function getBlocksForMessages(messages, allBlocks) {
    if (!allBlocks || allBlocks.length === 0) return [];

    return allBlocks.filter((block) => {
      // Check if any message in this block is in our messages array
      if (
        block.messages &&
        block.messages.some((msg) => messages.includes(msg))
      ) {
        return true;
      }

      // Check alt blocks with branches
      if (block.type === "alt" && block.branches) {
        return block.branches.some(
          (branch) =>
            branch.messages &&
            branch.messages.some((msg) => messages.includes(msg))
        );
      }

      // Check critical blocks with options
      if (block.type === "critical" && block.options) {
        return block.options.some(
          (option) =>
            option.messages &&
            option.messages.some((msg) => messages.includes(msg))
        );
      }

      return false;
    });
  }

  /**
   * Infer a name for a logical flow based on its messages
   * @param {Array} messages - The messages in the flow
   * @param {Object} sequence - The sequence diagram data
   * @returns {string} An inferred flow name
   */
  function inferFlowName(messages, sequence) {
    // First check for explicit title in the diagram
    if (sequence.title) {
      return sequence.title;
    }

    // Look for common patterns that might indicate the purpose of the diagram

    // Look for secure communication patterns
    const hasSecurityTerms = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("secure") ||
          msg.content.toLowerCase().includes("encrypt") ||
          msg.content.toLowerCase().includes("key exchange"))
    );

    // Check for login/authentication
    const hasLogin = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("login") ||
          msg.content.toLowerCase().includes("auth") ||
          msg.content.toLowerCase().includes("sign in") ||
          msg.content.toLowerCase().includes("credentials"))
    );

    // Check for registration
    const hasRegistration = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("register") ||
          msg.content.toLowerCase().includes("sign up") ||
          msg.content.toLowerCase().includes("create account"))
    );

    // Check for profile-related actions
    const hasProfile = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("profile") ||
          msg.content.toLowerCase().includes("user data") ||
          msg.content.toLowerCase().includes("account info"))
    );

    // Check for checkout/payment
    const hasCheckout = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("payment") ||
          msg.content.toLowerCase().includes("checkout") ||
          msg.content.toLowerCase().includes("purchase"))
    );

    // Check for search/query
    const hasSearch = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("search") ||
          msg.content.toLowerCase().includes("query") ||
          msg.content.toLowerCase().includes("find"))
    );

    // Check for data operations
    const hasDataOps = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("query") ||
          msg.content.toLowerCase().includes("fetch") ||
          msg.content.toLowerCase().includes("get") ||
          msg.content.toLowerCase().includes("retrieve"))
    );

    // Check for initialisation or setup
    const hasInit = messages.some(
      (msg) =>
        msg.content &&
        (msg.content.toLowerCase().includes("initialise") ||
          msg.content.toLowerCase().includes("setup") ||
          msg.content.toLowerCase().includes("establish"))
    );

    // Return an appropriate flow name based on message content
    if (hasSecurityTerms) return "Secure Communication Setup";
    if (hasLogin && hasRegistration) return "Authentication and Registration";
    if (hasLogin) return "User Authentication";
    if (hasRegistration) return "User Registration";
    if (hasProfile) return "Profile Management";
    if (hasCheckout) return "Checkout Process";
    if (hasSearch) return "Search Functionality";
    if (hasDataOps) return "Data Retrieval";
    if (hasInit) return "Initialisation and Setup";

    // If no specific flow type was detected, create a generic name
    // based on the participants
    const uniqueParticipantIds = [
      ...new Set(
        messages.map((m) => m.sender).concat(messages.map((m) => m.receiver))
      ),
    ];

    // Convert IDs to display names
    const uniqueParticipants = uniqueParticipantIds.map((id) =>
      getCorrectEntityName(id, false, sequence)
    );

    // Check if "User" is one of the participants (by display name or ID)
    if (uniqueParticipants.some((p) => p && p.toLowerCase().includes("user"))) {
      return "User Interaction";
    } else if (
      uniqueParticipants.some(
        (p) => p && p.toLowerCase().includes("frontend")
      ) &&
      uniqueParticipants.some((p) => p && p.toLowerCase().includes("api"))
    ) {
      return "Frontend-Backend Communication";
    } else if (
      uniqueParticipants.some(
        (p) =>
          (p && p.toLowerCase().includes("database")) ||
          (p && p.toLowerCase().includes("db"))
      )
    ) {
      return "Database Operations";
    } else {
      // Default name
      return "Message Exchange Process";
    }
  }

  /**
   * Generate a description for a logical flow
   * @param {string} flowName - The name of the flow
   * @param {Array} messages - The messages in the flow
   * @param {Object} sequence - The complete sequence diagram data
   * @returns {string} A description of the flow
   */
  function generateFlowDescription(flowName, messages, sequence) {
    // Remove "process" from flowName if it already contains it to avoid duplication
    let processText = flowName.toLowerCase().includes("process")
      ? ""
      : " process";

    description = `This flow illustrates the ${flowName.toLowerCase()}${processText}`;

    // Add information about participants
    const uniqueParticipantIds = [
      ...new Set(
        messages.map((m) => m.sender).concat(messages.map((m) => m.receiver))
      ),
    ];

    // Convert IDs to display names using aliasMap and ensure uniqueness
    const displayNameMap = {};
    uniqueParticipantIds.forEach((id) => {
      const displayName = getCorrectEntityName(id, false, sequence);
      if (displayName) {
        displayNameMap[displayName] = true;
      }
    });

    // Get unique display names
    const uniqueParticipants = Object.keys(displayNameMap);

    // Separate actors and system participants
    const actors = uniqueParticipants.filter((p) =>
      sequence.actors.includes(p)
    );
    const systems = uniqueParticipants.filter((p) =>
      sequence.participants.includes(p)
    );

    if (actors.length > 0 && systems.length > 0) {
      description += ` involving ${formatList(
        actors
      )} interacting with ${formatList(systems)}`;
    } else if (actors.length > 0) {
      description += ` involving ${formatList(actors)}`;
    } else if (systems.length > 0) {
      description += ` involving ${formatList(systems)}`;
    }

    // Add information about message types
    const hasSolidArrows = messages.some((m) => !m.isResponse);
    const hasDashedArrows = messages.some((m) => m.isResponse);

    if (hasSolidArrows && hasDashedArrows) {
      description += `. It shows both requests (solid arrows) and responses (dashed arrows)`;
    } else if (hasSolidArrows) {
      description += `. It primarily shows requests or commands`;
    } else if (hasDashedArrows) {
      description += `. It primarily shows responses or return messages`;
    }

    // Look for conditional logic
    const hasConditions = messages.some((m) => {
      // Check if the message is part of a conditional block
      for (const block of sequence.blocks) {
        if (block.type === "alt") {
          for (const branch of block.branches) {
            if (branch.messages.includes(m)) {
              return true;
            }
          }
        } else if (block.type === "opt" || block.type === "critical") {
          if (block.messages.includes(m)) {
            return true;
          }
          // For critical blocks, also check options
          if (block.type === "critical" && block.options) {
            for (const option of block.options) {
              if (option.messages.includes(m)) {
                return true;
              }
            }
          }
        }
      }
      return false;
    });

    if (hasConditions) {
      description += `. The flow includes conditional paths based on different criteria`;
    }

    // Add information about break conditions if present
    const hasBreaks = sequence.blocks.some((block) => block.type === "break");
    if (hasBreaks) {
      description += `. This flow includes break condition(s) where the sequence will stop if specific criteria are met, preventing subsequent messages from being processed`;
    }

    // Add flow-specific descriptions
    if (flowName === "User Authentication") {
      description += `. The flow illustrates how user login credentials are validated and how the system responds based on their validity.`;
    } else if (flowName === "Profile Management") {
      description += `. The flow shows how user profile data is requested and delivered between system components.`;
    }

    // Ensure description ends with a period
    if (!description.endsWith(".")) {
      description += ".";
    }

    return description;
  }

  /**
   * Format message type for human-readable description
   * @param {string} type - The message type symbol
   * @returns {string} Human-readable description
   */
  function formatMessageType(type) {
    // Handle bidirectional arrows
    if (type === "<<-->>" || type === "<->") {
      return "communicates bidirectionally with";
    }

    // Use clearer detection for response messages
    const isResponse = type && type.includes("--");
    const isAsync = type && type.includes(")");
    const isError = type && type.includes("x");

    if (isResponse) {
      // Response messages (dashed arrows)
      if (isError) {
        return "returns error to";
      } else if (isAsync) {
        return "sends async response to";
      } else {
        return "responds to";
      }
    } else {
      // Request messages (solid arrows)
      if (isError) {
        return "sends error to";
      } else if (isAsync) {
        return "sends async message to";
      } else {
        return "sends to";
      }
    }
  }

  /**
   * Get the correct entity name for display, accounting for activation markers and aliases
   * @param {string} name - The entity ID from the message
   * @param {boolean} isResponse - Whether this is a response message
   * @param {Object} sequence - The sequence diagram data with aliasMap
   * @returns {string} The corrected entity display name
   */
  function getCorrectEntityName(name, isResponse, sequence) {
    // Skip for undefined or null names
    if (!name) return "";

    // Remove any +/- activation markers from the name
    let cleanName = name;
    if (cleanName.endsWith("+")) {
      cleanName = cleanName.slice(0, -1);
    }
    if (cleanName.endsWith("-")) {
      cleanName = cleanName.slice(0, -1);
    }

    // Use the alias mapping if available
    return sequence && sequence.aliasMap[cleanName]
      ? sequence.aliasMap[cleanName]
      : cleanName;
  }

  /**
   * Log message details for debugging
   * @param {Object} message - The message object
   * @param {Object} sequence - The sequence data with aliasMap
   */
  function logMessageDetails(message, sequence) {
    logDebug("------ Message Details ------");
    logDebug("Sender:", message.sender);
    logDebug("Type:", message.type);
    logDebug("Receiver:", message.receiver);
    logDebug("Content:", message.content);
    logDebug("IsResponse:", message.type && message.type.includes("--"));
    logDebug(
      "Corrected Sender:",
      getCorrectEntityName(
        message.sender,
        message.type && message.type.includes("--"),
        sequence
      )
    );
    logDebug(
      "Corrected Receiver:",
      getCorrectEntityName(
        message.receiver,
        message.type && message.type.includes("--"),
        sequence
      )
    );
    logDebug("-------------------------");
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("sequenceDiagram", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Sequence diagram module loaded and registered"
  );
})();
