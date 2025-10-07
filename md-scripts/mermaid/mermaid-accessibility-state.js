/**
 * Mermaid Accessibility - State Diagram Module
 * Generates accessible descriptions for state diagrams
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

  // Current logging level - can be modified at runtime if needed
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
   * Generate a short description for a state diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A short description
   */
  function generateShortDescription(svgElement, code) {
    logDebug(
      "[Mermaid Accessibility] Generating short state diagram description"
    );

    // Parse the state diagram
    const parsedData = parseStateDiagram(code);

    // Extract title if available
    let title = Utils.extractTitleFromSVG(svgElement);

    // Count states (excluding initial/final markers)
    const regularStates = parsedData.allStates.filter(
      (state) => state !== "[*]"
    );

    // Build a concise description
    let description = `A state diagram`;

    if (title) {
      description += ` titled "${title}"`;
    }

    description += ` showing a lifecycle with ${regularStates.length} state${
      regularStates.length !== 1 ? "s" : ""
    }`;

    if (parsedData.initialStates.length > 0) {
      description += `, starting from ${
        parsedData.initialStates.length === 1 ? "the" : ""
      } ${formatStateList(parsedData.initialStates)} state${
        parsedData.initialStates.length !== 1 ? "s" : ""
      }`;
    }

    if (parsedData.finalStates.length > 0) {
      description += ` and ending at ${
        parsedData.finalStates.length === 1 ? "the" : ""
      } ${formatStateList(parsedData.finalStates)} state${
        parsedData.finalStates.length !== 1 ? "s" : ""
      }`;
    }

    description += ".";

    logDebug(
      "[Mermaid Accessibility] Short description generated:",
      description
    );
    return description;
  }

  /**
   * Format a list of states for readable output
   * @param {Array} states - Array of state names
   * @returns {string} Formatted list of states
   */
  function formatStateList(states) {
    // Handle special case for initial/final markers
    const formattedStates = states.map((state) =>
      state === "[*]" ? "initial/final" : state
    );

    if (formattedStates.length === 1) {
      return formattedStates[0];
    } else if (formattedStates.length === 2) {
      return `${formattedStates[0]} and ${formattedStates[1]}`;
    } else {
      const lastState = formattedStates.pop();
      return `${formattedStates.join(", ")}, and ${lastState}`;
    }
  }

  /**
   * Clean state name to handle quoted strings and special formats
   * @param {string} stateName - The raw state name from the diagram
   * @returns {string} Cleaned state name
   */
  function cleanStateName(stateName) {
    if (!stateName) return "";

    // Handle quoted state names
    if (
      (stateName.startsWith('"') && stateName.endsWith('"')) ||
      (stateName.startsWith("'") && stateName.endsWith("'"))
    ) {
      return stateName.substring(1, stateName.length - 1);
    }

    // Handle state with description format "State: Description"
    if (stateName.includes('": ')) {
      // Extract just the state name part
      return stateName.replace(/^"([^"]+)":\s.*$/, "$1");
    }

    return stateName;
  }

  /**
   * Parse state diagram from mermaid code
   * @param {string} code - The mermaid diagram code
   * @returns {Object} Parsed diagram data
   */
  function parseStateDiagram(code) {
    logDebug("[Mermaid Accessibility] Parsing state diagram code");

    const stateTransitions = {};
    const initialStates = [];
    const finalStates = [];
    const allStates = new Set();
    const compositeStates = {};

    // Parse line by line
    const lines = code.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines, the stateDiagram declaration, and comments
      if (
        !trimmedLine ||
        trimmedLine.startsWith("stateDiagram") ||
        trimmedLine.startsWith("%")
      ) {
        continue;
      }

      // Handle composite state definitions - state StateName { ... }
      if (trimmedLine.match(/^state\s+"?[^"{}]+"?\s*{/)) {
        const match = trimmedLine.match(/^state\s+"?([^"{}]+)"?\s*{/);
        if (match) {
          const compositeName = cleanStateName(match[1]);
          compositeStates[compositeName] = true;
          allStates.add(compositeName);
          logDebug(
            "[Mermaid Accessibility] Found composite state:",
            compositeName
          );
        }
        continue;
      }

      // Handle state definitions with descriptions - state "Name" as Description
      if (trimmedLine.match(/^state\s+(?:"[^"]+"|'[^']+'|\S+)\s+as\s+/)) {
        const match = trimmedLine.match(/^state\s+("?[^"\s]+"?|\S+)/);
        if (match) {
          const stateName = cleanStateName(match[1]);
          allStates.add(stateName);
          logDebug(
            "[Mermaid Accessibility] Found state with description:",
            stateName
          );
        }
        continue;
      }

      // Handle simple state definitions - state StateName
      if (trimmedLine.match(/^state\s+(?:"[^"]+"|'[^']+'|\S+)$/)) {
        const match = trimmedLine.match(
          /^state\s+(?:"([^"]+)"|'([^']+)'|(\S+))$/
        );
        if (match) {
          const stateName = match[1] || match[2] || match[3];
          allStates.add(stateName);
          logDebug("[Mermaid Accessibility] Found simple state:", stateName);
        }
        continue;
      }

      // Handle note attachments - note right of/left of/on StateName
      if (
        trimmedLine.match(/^note\s+(right|left|top|bottom)\s+of\s+/) ||
        trimmedLine.match(/^note\s+on\s+/)
      ) {
        // Extract state name from note definition
        const match = trimmedLine.match(
          /^note\s+(?:(?:right|left|top|bottom)\s+of|on)\s+(\S+)/
        );
        if (match) {
          allStates.add(cleanStateName(match[1]));
        }
        continue;
      }

      // Handle forks and joins
      if (
        trimmedLine.match(/^state\s+(?:fork|join)\s+<<\s*(?:fork|join)\s*>>/)
      ) {
        const match = trimmedLine.match(/^state\s+(fork|join)/);
        if (match) {
          allStates.add(match[1]);
          logDebug("[Mermaid Accessibility] Found fork/join state:", match[1]);
        }
        continue;
      }

      // Handle choice states
      if (trimmedLine.match(/^state\s+"?[^"{}]+"?\s*<<\s*choice\s*>>/)) {
        const match = trimmedLine.match(/^state\s+("?[^"{}]+"?)/);
        if (match) {
          allStates.add(cleanStateName(match[1]));
          logDebug(
            "[Mermaid Accessibility] Found choice state:",
            cleanStateName(match[1])
          );
        }
        continue;
      }

      // Extract states and transitions
      if (trimmedLine.includes("-->")) {
        // Split by arrow to get source and target+label
        const parts = trimmedLine.split("-->");
        if (parts.length !== 2) continue;

        const sourceState = cleanStateName(parts[0].trim());

        // Extract target state and transition label
        let targetState = parts[1].trim();
        let transitionLabel = "";

        if (targetState.includes(":")) {
          const targetParts = targetState.split(":");
          targetState = cleanStateName(targetParts[0].trim());
          transitionLabel = targetParts.slice(1).join(":").trim();
        } else {
          targetState = cleanStateName(targetState);
        }

        // Add to allStates
        allStates.add(sourceState);
        allStates.add(targetState);

        // Check for initial state
        if (sourceState === "[*]") {
          initialStates.push(targetState);
          logDebug("[Mermaid Accessibility] Found initial state:", targetState);
        }

        // Check for final state
        if (targetState === "[*]") {
          finalStates.push(sourceState);
          logDebug("[Mermaid Accessibility] Found final state:", sourceState);
        }

        // Add to transitions
        if (!stateTransitions[sourceState]) {
          stateTransitions[sourceState] = [];
        }

        stateTransitions[sourceState].push({
          target: targetState,
          label: transitionLabel,
        });

        logDebug(
          "[Mermaid Accessibility] Found transition:",
          sourceState,
          "->",
          targetState,
          transitionLabel ? `(${transitionLabel})` : ""
        );
      }
    }

    const parsedResult = {
      stateTransitions,
      initialStates,
      finalStates,
      allStates: Array.from(allStates),
      compositeStates,
    };

    logDebug(
      "[Mermaid Accessibility] Parsing complete. Found",
      parsedResult.allStates.length,
      "states,",
      initialStates.length,
      "initial states,",
      finalStates.length,
      "final states"
    );

    return parsedResult;
  }

  /**
   * Generate a detailed description for a state diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A detailed HTML description
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo(
      "[Mermaid Accessibility] Generating detailed state diagram description"
    );

    // Parse the state diagram
    const parsedData = parseStateDiagram(code);

    // Get additional information sections
    const processOverview = generateProcessOverview(parsedData);
    const happyPath = identifyHappyPath(parsedData);
    const cycles = identifyCycles(parsedData);

    logDebug(
      "[Mermaid Accessibility] Generated process overview, happy path, and cycle analysis"
    );

    // Create HTML structure with proper sections - using the chart description pattern
    let html = `<div class="state-diagram-description">`;

    // Detailed description section
    html += `<section class="state-detailed-description-section">`;

    // Process overview section
    html += `    <section class="state-section state-overview-section">`;
    html += `      <section class="state-process-overview">`;
    html += `        <h4 class="mermaid-details-heading state-details-heading">Process Overview</h4>`;
    html += `        <p class="process-overview">${processOverview}</p>`;
    html += `      </section>`;

    // Main flow section (if available)
    if (happyPath) {
      html += `      <section class="state-process-flow">`;
      html += `        <p class="process-flow"><strong>Main flow:</strong> ${happyPath}</p>`;
      html += `      </section>`;
    }

    // Cycles section (if available)
    if (cycles) {
      html += `      <section class="state-process-cycles">`;
      html += `        <p class="process-cycles"><strong>Cycles:</strong> ${cycles}</p>`;
      html += `      </section>`;
    }
    html += `    </section>\n\n`;

    // States and Transitions section
    html += `    <section class="state-section state-transitions-section">`;
    html += `      <h4 class="mermaid-details-heading state-details-heading">States and Transitions</h4>`;
    html += `      <dl>\n`;

    // Add initial states
    if (parsedData.initialStates.length > 0) {
      html += `        <dt>Initial State</dt>\n`;
      html += `        <dd>\n`;

      if (parsedData.initialStates.length === 1) {
        html += `          The process starts in the <strong><span class="diagram-state">${parsedData.initialStates[0]}</span></strong> state.\n`;
      } else {
        html += `          The process can start in any of these states:\n          <ul>\n`;
        parsedData.initialStates.forEach((state) => {
          html += `            <li><strong><span class="diagram-state">${state}</span></strong></li>\n`;
        });
        html += `          </ul>\n`;
      }

      html += `        </dd>\n\n`;
    }

    // Group states functionally - first collect information about each state
    const stateGroups = groupStatesFunctionally(parsedData);

    logDebug(
      "[Mermaid Accessibility] Grouped states into",
      Object.keys(stateGroups).length,
      "functional groups"
    );

    // Process states by functional groups
    Object.keys(stateGroups).forEach((groupName) => {
      // Add group header if there are multiple groups
      if (Object.keys(stateGroups).length > 1) {
        html += `        <dt class="state-group-heading">${groupName}</dt>\n`;
        html += `        <dd class="state-group-description">\n`;
        html += `          <p>${stateGroups[groupName].description}</p>\n`;
        html += `        </dd>\n\n`;
      }

      // Add the states in this group
      const statesToProcess = stateGroups[groupName].states;

      // Process states in this group
      const processedStates = new Set();
      processStates(statesToProcess, processedStates);
    });

    // Function to process states - same as before but now used by group processing
    function processStates(statesToProcess, processedStates) {
      statesToProcess.forEach((state) => {
        if (state === "[*]" || processedStates.has(state)) return;
        processedStates.add(state);

        html += `        <dt><span class="diagram-state">${state}</span></dt>\n`;
        html += `        <dd>\n`;

        // Note if this is a composite state
        if (parsedData.compositeStates[state]) {
          html += `          <p><strong>Composite state</strong> containing nested states.</p>\n`;
        }

        const outgoingTransitions = parsedData.stateTransitions[state] || [];
        if (outgoingTransitions.length > 0) {
          html += `          <ul>\n`;
          outgoingTransitions.forEach((transition) => {
            // Add semantic class for error transitions
            const isErrorTransition =
              transition.label &&
              (transition.label.toLowerCase().includes("error") ||
                transition.target.toLowerCase().includes("error"));

            const transitionClass = isErrorTransition
              ? ' class="error-transition"'
              : "";

            // Create more natural transition phrasing
            let transitionPhrase = "";
            if (transition.label) {
              const label = transition.label.trim();

              // Format transition label with proper capitalisation and grammar
              if (label.toLowerCase().endsWith("s")) {
                // For verbs ending in 's', like "occurs", use "when"
                transitionPhrase = ` when the <span class="diagram-label">${
                  label.charAt(0).toLowerCase() + label.slice(1)
                }</span>`;
              } else if (label.match(/^[A-Z][a-z]*$/)) {
                // For simple event names like "Start", use different wording
                transitionPhrase = ` after <span class="diagram-label">${label.toLowerCase()}</span>`;
              } else if (label.match(/^(?:if|when|after).+$/i)) {
                // If label already has a condition word, use as-is
                transitionPhrase = ` <span class="diagram-label">${
                  label.charAt(0).toLowerCase() + label.slice(1)
                }</span>`;
              } else {
                // Default format for other labels
                transitionPhrase = ` when the <span class="diagram-label">${
                  label.charAt(0).toLowerCase() + label.slice(1)
                }</span>`;
              }
            }

            if (transition.target === "[*]") {
              html += `            <li${transitionClass}>Transitions to the <strong>final state</strong>${transitionPhrase}.</li>\n`;
            } else {
              html += `            <li${transitionClass}>Transitions to the <strong><span class="diagram-state">${transition.target}</span></strong> state${transitionPhrase}.</li>\n`;
            }
          });
          html += `          </ul>\n`;
        } else {
          html += `          <p>No outgoing transitions from this state.</p>\n`;
        }

        html += `        </dd>\n\n`;
      });
    }

    // Add final states section
    if (parsedData.finalStates.length > 0) {
      html += `        <dt>Final States</dt>\n`;
      html += `        <dd>\n`;
      html += `          The process can end from these states:\n          <ul>\n`;
      parsedData.finalStates.forEach((state) => {
        html += `            <li><strong><span class="diagram-state">${state}</span></strong></li>\n`;
      });
      html += `          </ul>\n`;
      html += `        </dd>\n`;
    }

    html += `      </dl>\n`;
    html += `    </section>\n`;

    // Close the detailed description div
    html += `</div>`;

    logInfo(
      "[Mermaid Accessibility] Detailed description generated successfully"
    );
    return html;
  }

  /**
   * Generate an overview description of the process flow
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Overview description
   */
  function generateProcessOverview(parsedData) {
    logDebug("[Mermaid Accessibility] Generating process overview");

    // Start with initial states
    let overview = "";

    if (parsedData.initialStates.length > 0) {
      // Find first state after initial
      const initialState = parsedData.initialStates[0];
      overview += `This diagram shows a process that begins in the <span class="diagram-state">${initialState}</span> state`;

      // Try to describe the first few transitions
      const outgoingFromInitial =
        parsedData.stateTransitions[initialState] || [];
      if (outgoingFromInitial.length > 0) {
        const firstTransition = outgoingFromInitial[0];

        // Format the transition label for better readability
        let transitionPhrase = "";
        if (firstTransition.label) {
          const label = firstTransition.label.trim();
          // Format based on the label type
          if (label.toLowerCase().endsWith("s")) {
            transitionPhrase = ` when the <span class="diagram-label">${
              label.charAt(0).toLowerCase() + label.slice(1)
            }</span>`;
          } else if (label.match(/^[A-Z][a-z]*$/)) {
            transitionPhrase = ` after <span class="diagram-label">${label.toLowerCase()}</span>`;
          } else {
            transitionPhrase = ` when the <span class="diagram-label">${
              label.charAt(0).toLowerCase() + label.slice(1)
            }</span>`;
          }
        }

        overview += `, proceeds to the <span class="diagram-state">${firstTransition.target}</span> state${transitionPhrase}`;

        // Try to describe the next level of transitions
        const secondLevelTransitions =
          parsedData.stateTransitions[firstTransition.target] || [];
        if (secondLevelTransitions.length > 0) {
          if (secondLevelTransitions.length === 1) {
            const stTransition = secondLevelTransitions[0];
            let stPhrase = "";

            if (stTransition.label) {
              const label = stTransition.label.trim();
              if (label.toLowerCase().endsWith("s")) {
                stPhrase = ` when the <span class="diagram-label">${
                  label.charAt(0).toLowerCase() + label.slice(1)
                }</span>`;
              } else if (label.match(/^[A-Z][a-z]*$/)) {
                stPhrase = ` after <span class="diagram-label">${label.toLowerCase()}</span>`;
              } else {
                stPhrase = ` when the <span class="diagram-label">${
                  label.charAt(0).toLowerCase() + label.slice(1)
                }</span>`;
              }
            }

            if (stTransition.target === "[*]") {
              overview += `, and then to completion${stPhrase}`;
            } else {
              overview += `, and then to the <span class="diagram-state">${stTransition.target}</span> state${stPhrase}`;
            }
          } else if (secondLevelTransitions.length === 2) {
            // Format for branches with two options
            const options = secondLevelTransitions.map((transition) => {
              let targetDesc =
                transition.target === "[*]"
                  ? "completion"
                  : `the <span class="diagram-state">${transition.target}</span> state`;

              let conditionPhrase = "";
              if (transition.label) {
                const label = transition.label.trim();
                if (label.toLowerCase().endsWith("s")) {
                  conditionPhrase = ` when the <span class="diagram-label">${
                    label.charAt(0).toLowerCase() + label.slice(1)
                  }</span>`;
                } else if (label.match(/^[A-Z][a-z]*$/)) {
                  conditionPhrase = ` after <span class="diagram-label">${label.toLowerCase()}</span>`;
                } else {
                  conditionPhrase = ` when the <span class="diagram-label">${
                    label.charAt(0).toLowerCase() + label.slice(1)
                  }</span>`;
                }
              }

              return `${targetDesc}${conditionPhrase}`;
            });

            overview += `, and then either to ${options[0]} or to ${options[1]}`;
          } else {
            overview += `, and then to one of ${secondLevelTransitions.length} possible states depending on conditions`;
          }
        }
      }
    } else {
      overview += `This diagram shows a process with multiple states and transitions`;
    }

    // Describe final states if they exist
    if (parsedData.finalStates.length > 0) {
      if (parsedData.finalStates.length === 1) {
        overview += `. The process can end from the <span class="diagram-state">${parsedData.finalStates[0]}</span> state.`;
      } else {
        const formattedStates = parsedData.finalStates
          .map(
            (state) => `the <span class="diagram-state">${state}</span> state`
          )
          .join(" or ");
        overview += `. The process can end from ${formattedStates}.`;
      }
    } else {
      overview += `.`;
    }

    logDebug("[Mermaid Accessibility] Process overview generated");
    return overview;
  }

  /**
   * Identify the main/happy path through the system
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Description of happy path or null if can't be determined
   */
  function identifyHappyPath(parsedData) {
    logDebug(
      "[Mermaid Accessibility] Identifying happy path through the process"
    );

    // If no initial states, return null
    if (parsedData.initialStates.length === 0) return null;

    // Start from the first initial state
    const initialState = parsedData.initialStates[0];
    const path = [initialState];
    let currentState = initialState;

    // Follow transitions, preferring ones that don't have "error" in their labels
    // and avoiding cycles where possible
    while (true) {
      const transitions = parsedData.stateTransitions[currentState] || [];
      if (transitions.length === 0) break;

      // Try to find a transition that doesn't lead to an already visited state
      // and doesn't have "error" in the label
      let nextTransition = null;

      // First look for transitions without "error" in the label or target
      for (const transition of transitions) {
        if (transition.target === "[*]") {
          // Found a final state transition
          const hasSuccess =
            transition.label &&
            (transition.label.toLowerCase().includes("success") ||
              transition.label.toLowerCase().includes("complet"));

          // Prioritise "success" exits over others
          if (hasSuccess) {
            nextTransition = transition;
            break;
          } else if (!nextTransition) {
            nextTransition = transition;
            // Keep looking for better transitions if this isn't a success exit
          }
        }

        if (
          !path.includes(transition.target) &&
          (!transition.label ||
            !transition.label.toLowerCase().includes("error")) &&
          !transition.target.toLowerCase().includes("error")
        ) {
          // Prioritise transitions with "success" in the label
          const hasSuccess =
            transition.label &&
            (transition.label.toLowerCase().includes("success") ||
              transition.label.toLowerCase().includes("complet"));

          if (hasSuccess) {
            nextTransition = transition;
            break;
          } else if (
            !nextTransition ||
            (nextTransition.target === "[*]" && !hasSuccess)
          ) {
            nextTransition = transition;
            // Keep looking for better transitions
          }
        }
      }

      // If no suitable transition found, take the first non-error one as fallback
      if (!nextTransition && transitions.length > 0) {
        // Avoid error transitions and cycles if possible
        nextTransition =
          transitions.find(
            (t) =>
              !path.includes(t.target) &&
              (!t.label || !t.label.toLowerCase().includes("error")) &&
              !t.target.toLowerCase().includes("error")
          ) ||
          transitions.find((t) => !path.includes(t.target)) ||
          transitions[0];
      }

      if (!nextTransition) {
        break;
      } else if (nextTransition.target === "[*]") {
        // Use a more descriptive term than just "Exit"
        path.push("completion");
        break;
      }

      // Add the next state to the path
      path.push(nextTransition.target);
      currentState = nextTransition.target;

      // Safety check to prevent infinite loops
      if (path.length > 10) break;
    }

    // If path is just initial state, it's not useful
    if (path.length <= 1) return null;

    // Return the path as a string with proper formatting and state classes
    const formattedPath = path
      .map((state) => {
        if (state === "completion") {
          return "completion";
        } else {
          return `<span class="diagram-state">${state}</span>`;
        }
      })
      .join(" → ");

    logDebug("[Mermaid Accessibility] Happy path identified:", formattedPath);
    return formattedPath;
  }

  /**
   * Identify cycles in the state diagram
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Description of cycles or null if none found
   */
  function identifyCycles(parsedData) {
    logDebug("[Mermaid Accessibility] Identifying cycles in the process");

    // Track states that form cycles
    const cycleStates = new Map();

    // Look for states that can transition back to an earlier state
    for (const state in parsedData.stateTransitions) {
      if (state === "[*]") continue;

      const transitions = parsedData.stateTransitions[state] || [];
      for (const transition of transitions) {
        // Skip final state transitions
        if (transition.target === "[*]") continue;

        // Check if this transition creates a potential cycle to initial states
        if (parsedData.initialStates.includes(transition.target)) {
          // Store the mechanism of the cycle
          if (!cycleStates.has(state)) {
            cycleStates.set(state, transition.label || "a transition");
          }
        }
      }
    }

    // If we found cycles, describe them clearly
    if (cycleStates.size > 0) {
      const stateList = Array.from(cycleStates.keys());

      if (stateList.length === 1) {
        const state = stateList[0];
        const action = cycleStates.get(state);
        logDebug(
          "[Mermaid Accessibility] Found single cycle from state:",
          state
        );
        return `The <span class="diagram-state">${state}</span> state can return to the initial state${
          action
            ? ` via the <span class="diagram-label">${action.toLowerCase()}</span> action`
            : ""
        }, allowing the process to restart.`;
      } else if (stateList.length === 2) {
        logDebug(
          "[Mermaid Accessibility] Found cycles from two states:",
          stateList
        );
        return `Both the <span class="diagram-state">${stateList[0]}</span> and <span class="diagram-state">${stateList[1]}</span> states can return to the initial state, creating cycles that allow the process to restart.`;
      } else {
        // Format a list of all states with cycles
        const lastState = stateList.pop();
        const stateListFormatted = stateList
          .map((s) => `<span class="diagram-state">${s}</span>`)
          .join(", ");
        logDebug(
          "[Mermaid Accessibility] Found cycles from multiple states:",
          stateList.length + 1
        );
        return `Multiple states (${stateListFormatted}, and <span class="diagram-state">${lastState}</span>) can return to earlier states, creating cycles in the process flow.`;
      }
    }

    logDebug("[Mermaid Accessibility] No cycles found in the process");
    return "";
  }

  /**
   * Group states functionally based on their role in the process
   * @param {Object} parsedData - Parsed diagram data
   * @returns {Object} Groups of states with descriptions
   */
  function groupStatesFunctionally(parsedData) {
    logDebug("[Mermaid Accessibility] Grouping states functionally");

    const groups = {};

    // Initial states go in "Starting States" group
    if (parsedData.initialStates.length > 0) {
      groups["Starting States"] = {
        states: parsedData.initialStates,
        description: "States where the process begins.",
      };
    }

    // Look for processing/operational states
    const processingStates = [];
    const errorStates = [];
    const completionStates = [];

    // Track which states we've already categorised to prevent duplicates
    const categorisedStates = new Set();

    // Add initial states to categorised set
    parsedData.initialStates.forEach((state) => categorisedStates.add(state));

    // Categorise remaining states
    for (const state of parsedData.allStates) {
      if (state === "[*]" || categorisedStates.has(state)) {
        continue; // Skip initial/final markers and already categorised states
      }

      // Check if this is an error state
      if (
        state.toLowerCase().includes("error") ||
        state.toLowerCase().includes("fail")
      ) {
        errorStates.push(state);
        categorisedStates.add(state);
      }
      // Check if this is a completion state
      else if (
        state.toLowerCase().includes("complet") ||
        state.toLowerCase().includes("done") ||
        state.toLowerCase().includes("finish") ||
        state.toLowerCase().includes("success")
      ) {
        completionStates.push(state);
        categorisedStates.add(state);
      }
      // Otherwise it's a processing state
      else {
        processingStates.push(state);
        categorisedStates.add(state);
      }
    }

    // Add groups if they have states
    if (processingStates.length > 0) {
      groups["Operational States"] = {
        states: processingStates,
        description: "States representing active processing or operations.",
      };
    }

    if (completionStates.length > 0) {
      groups["Completion States"] = {
        states: completionStates,
        description:
          "States representing successful completion of the process.",
      };
    }

    if (errorStates.length > 0) {
      groups["Error States"] = {
        states: errorStates,
        description: "States representing error conditions or failures.",
      };
    }

    // If we didn't categorise any states, create a single "States" group with all states
    if (
      Object.keys(groups).length === 0 ||
      (Object.keys(groups).length === 1 && groups["Starting States"])
    ) {
      const remainingStates = parsedData.allStates.filter(
        (state) => state !== "[*]" && !categorisedStates.has(state)
      );

      if (remainingStates.length > 0) {
        groups["Process States"] = {
          states: remainingStates,
          description: "States in the process flow.",
        };
      }
    }

    // We'll avoid adding Terminal States as a separate group to prevent duplicates
    // Instead we'll mention which states can lead to termination in the Final States section

    logDebug(
      "[Mermaid Accessibility] Created",
      Object.keys(groups).length,
      "functional groups"
    );
    return groups;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("stateDiagram", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
  });

  // Also register for stateDiagram-v2 as they're fundamentally the same
  window.MermaidAccessibility.registerDescriptionGenerator("stateDiagram-v2", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
  });

  logInfo("[Mermaid Accessibility] State diagram module loaded and registered");
})();
