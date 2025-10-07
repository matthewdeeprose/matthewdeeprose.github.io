/**
 * Mermaid Accessibility - User Journey Module
 * Generates accessible descriptions for user journey diagrams
 */
const MermaidAccessibilityUserJourney = (function () {
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

  // Helper logging functions
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Accessibility - User Journey] ERROR: ${message}`);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Accessibility - User Journey] WARN: ${message}`);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Accessibility - User Journey] INFO: ${message}`);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Accessibility - User Journey] DEBUG: ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Core module not loaded!");
    return;
  }

  logInfo("Initialising User Journey module");

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;

  /**
   * Format a list of actors with proper grammar
   * @param {Array} actors - Array of actor names
   * @returns {string} Formatted list (e.g., "Me and Cat" or "Me, Cat, and Dog")
   */
  function formatActorsList(actors) {
    logDebug(`Formatting actors list: ${actors}`);

    if (!actors || actors.length === 0) {
      logDebug("No actors provided, returning empty string");
      return "";
    }

    if (actors.length === 1) {
      logDebug(`Single actor: ${actors[0]}`);
      return actors[0];
    }

    if (actors.length === 2) {
      const result = `${actors[0]} and ${actors[1]}`;
      logDebug(`Two actors formatted: ${result}`);
      return result;
    }

    // For 3 or more actors, use commas and "and" before the last one
    const lastActor = actors[actors.length - 1];
    const otherActors = actors.slice(0, -1);
    const result = `${otherActors.join(", ")}, and ${lastActor}`;
    logDebug(`Multiple actors formatted: ${result}`);
    return result;
  }

  /**
   * Generate a visual indicator for satisfaction scores
   * @param {number} score - The satisfaction score
   * @param {number} maxScore - The maximum possible score
   * @returns {string} HTML for the visual indicator
   */
  function generateSatisfactionIndicator(score, maxScore) {
    logDebug(
      `Generating satisfaction indicator for score ${score}/${maxScore}`
    );

    // Skip for invalid scores
    if (!score || score < 1) {
      logDebug("Invalid score provided, returning empty indicator");
      return "";
    }

    const percentage = Math.round((score / maxScore) * 100);
    let description = "";

    // Verbal description of satisfaction level
    if (percentage >= 80) description = "Very High";
    else if (percentage >= 60) description = "High";
    else if (percentage >= 40) description = "Medium";
    else if (percentage >= 20) description = "Low";
    else description = "Very Low";

    logDebug(`Satisfaction level determined: ${description} (${percentage}%)`);

    return `<span class="satisfaction-indicator" 
      aria-label="${description} satisfaction (${score} out of ${maxScore})">
      <span class="satisfaction-bar" style="width: ${percentage}%" 
        data-level="${description.toLowerCase().replace(" ", "-")}"></span>
    </span>`;
  }

  /**
   * Generate a short description for a user journey
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {Object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    logInfo("Generating short description for user journey");

    // Parse journey structure
    const journey = parseUserJourney(code);

    // Default title if not found
    const title = journey.title || "User Journey";
    logDebug(`Journey title: ${title}`);

    // Count tasks
    let totalTasks = 0;
    journey.sections.forEach((section) => {
      totalTasks += section.tasks.length;
    });

    logDebug(
      `Total tasks counted: ${totalTasks} across ${journey.sections.length} sections`
    );

    // Convert actors to array for easy handling
    const actors = Array.from(journey.actors);
    logDebug(`Actors involved: ${actors.join(", ")}`);

    // Determine score description
    let scoreDescription = "";
    if (journey.minScore !== journey.maxScore) {
      scoreDescription = ` with satisfaction scores ranging from ${journey.minScore} to ${journey.maxScore}`;
    } else if (journey.minScore > 0) {
      scoreDescription = ` with a satisfaction score of ${journey.minScore}`;
    }

    logDebug(`Score description: ${scoreDescription}`);

    // Build HTML description
    let htmlDescription = `A user journey diagram titled "<span class="diagram-title">${title}</span>"`;
    htmlDescription += ` showing <span class="diagram-count">${totalTasks}</span> tasks`;
    htmlDescription += ` across <span class="diagram-count">${journey.sections.length}</span> sections`;

    // Add actors if not too many
    if (actors.length > 0 && actors.length <= 5) {
      htmlDescription += ` involving <span class="diagram-actors">${formatActorsList(
        actors
      )}</span>`;
    } else if (actors.length > 5) {
      htmlDescription += ` involving <span class="diagram-actors">${actors.length} different actors</span>`;
      logDebug(
        `Large number of actors (${actors.length}), using count instead of names`
      );
    }

    // Add score description
    htmlDescription += `<span class="diagram-scores">${scoreDescription}</span>.`;

    // Plain text version
    let plainTextDescription = `A user journey diagram titled "${title}"`;
    plainTextDescription += ` showing ${totalTasks} tasks`;
    plainTextDescription += ` across ${journey.sections.length} sections`;

    if (actors.length > 0 && actors.length <= 5) {
      plainTextDescription += ` involving ${formatActorsList(actors)}`;
    } else if (actors.length > 5) {
      plainTextDescription += ` involving ${actors.length} different actors`;
    }

    plainTextDescription += `${scoreDescription}.`;

    logInfo("Short description generated successfully");

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
    logDebug("Generating backward-compatible short description");
    const descriptions = generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Parse user journey structure from the code
   * @param {string} code - The original mermaid code
   * @returns {Object} Structured user journey data
   */
  function parseUserJourney(code) {
    logInfo("Parsing user journey structure from mermaid code");

    const journey = {
      title: "",
      sections: [],
      actors: new Set(),
      minScore: Infinity,
      maxScore: -Infinity,
    };

    // Split the code into lines
    const lines = code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    logDebug(`Processing ${lines.length} lines of mermaid code`);

    // Flag to track if we're in a section
    let currentSection = null;

    // Process each line
    lines.forEach((line, index) => {
      logDebug(`Processing line ${index + 1}: ${line}`);

      // Extract title
      const titleMatch = line.match(/^\s*title\s+(.+)$/i);
      if (titleMatch) {
        journey.title = titleMatch[1].trim();
        logDebug(`Title found: ${journey.title}`);
        return;
      }

      // Extract section
      const sectionMatch = line.match(/^\s*section\s+(.+)$/i);
      if (sectionMatch) {
        currentSection = {
          name: sectionMatch[1].trim(),
          tasks: [],
        };
        journey.sections.push(currentSection);
        logDebug(`New section started: ${currentSection.name}`);
        return;
      }

      // Extract task (only if we're in a section)
      if (currentSection) {
        const taskMatch = line.match(/^\s*(.+?):\s*(\d+):\s*(.+)$/);
        if (taskMatch) {
          const taskName = taskMatch[1].trim();
          const score = parseInt(taskMatch[2], 10);
          const actorsList = taskMatch[3]
            .split(",")
            .map((actor) => actor.trim());

          logDebug(
            `Task found: "${taskName}" with score ${score} and actors [${actorsList.join(
              ", "
            )}]`
          );

          // Update journey stats
          journey.minScore = Math.min(journey.minScore, score);
          journey.maxScore = Math.max(journey.maxScore, score);

          // Add actors to the set
          actorsList.forEach((actor) => journey.actors.add(actor));

          // Add task to current section
          currentSection.tasks.push({
            name: taskName,
            score: score,
            actors: actorsList,
          });
        }
      }
    });

    // Ensure min/max scores have reasonable defaults if no tasks were found
    if (journey.minScore === Infinity) journey.minScore = 0;
    if (journey.maxScore === -Infinity) journey.maxScore = 0;

    logInfo(
      `Journey parsed successfully: ${journey.sections.length} sections, ${
        Array.from(journey.actors).length
      } actors, score range ${journey.minScore}-${journey.maxScore}`
    );

    return journey;
  }

  /**
   * Generate a detailed description for a user journey
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("Generating detailed description for user journey");

    // Parse journey structure
    const journey = parseUserJourney(code);

    // Create structured description
    let description = "";

    // 1. Overview Section
    description += `<section class="mermaid-section journey-overview">
        <h4 class="mermaid-section-heading">Journey Overview</h4>
        <p>This user journey diagram`;

    if (journey.title) {
      description += ` titled "<span class="diagram-title">${journey.title}</span>"`;
    }

    // Count total tasks
    let totalTasks = 0;
    journey.sections.forEach((section) => {
      totalTasks += section.tasks.length;
    });

    description += ` shows the steps taken to complete a process with <span class="diagram-count">${totalTasks}</span> tasks`;
    description += ` organised into <span class="diagram-count">${journey.sections.length}</span> sections.`;

    // Score range description
    if (journey.minScore !== journey.maxScore) {
      description += ` Tasks are rated on a satisfaction scale from ${journey.minScore} (lowest) to ${journey.maxScore} (highest).`;
      logDebug(
        `Score range described: ${journey.minScore} to ${journey.maxScore}`
      );
    } else if (journey.maxScore > 0) {
      description += ` All tasks have a satisfaction rating of ${journey.maxScore}.`;
      logDebug(`Uniform score described: ${journey.maxScore}`);
    }

    // Actors involved
    const actors = Array.from(journey.actors);
    if (actors.length > 0) {
      description += ` The journey involves `;
      if (actors.length === 1) {
        description += `<span class="diagram-actor">${actors[0]}</span>`;
      } else {
        description += `<span class="diagram-actors">${actors.length}</span> actors: `;
        description += actors
          .map((actor) => `<span class="diagram-actor">${actor}</span>`)
          .join(", ");
      }
      description += `.`;
      logDebug(`Actors section added with ${actors.length} actors`);
    }

    description += `</p></section>`;

    // 2. Sections Breakdown
    description += `<section class="mermaid-section journey-details">
        <h4 class="mermaid-section-heading">Journey Details</h4>`;

    // List all sections with their tasks
    journey.sections.forEach((section, sectionIndex) => {
      logDebug(
        `Processing section ${sectionIndex + 1}: ${section.name} with ${
          section.tasks.length
        } tasks`
      );

      description += `<div class="journey-section">
          <h5 class="journey-section-name">Section ${sectionIndex + 1}: ${
        section.name
      }</h5>
          <ol class="journey-tasks">`;

      section.tasks.forEach((task) => {
        description += `<li class="journey-task">
            <div class="task-header">
              <span class="task-name">${task.name}</span>
            </div>
            <ul class="task-details">
              <li class="task-detail">
                <span class="detail-label">Satisfaction:</span> 
                <span class="score-value score-${task.score}">${
          task.score
        }</span>
                ${generateSatisfactionIndicator(task.score, journey.maxScore)}
              </li>
              <li class="task-detail">
                <span class="detail-label">Actors:</span> 
                <span class="actor-list">${formatActorsList(task.actors)}</span>
              </li>
            </ul>
          </li>`;
      });

      description += `</ol></div>`;
    });

    description += `</section>`;

    // 3. Journey Analysis
    description += generateJourneyAnalysis(journey);

    // 4. Visual Representation
    description += `<section class="mermaid-section journey-visual">
        <h4 class="mermaid-section-heading">Visual Representation</h4>
        <p>In the diagram, each task is represented as a step within its section. 
        Tasks are colour-coded according to their satisfaction score, with higher scores typically shown in deeper/brighter colours.
        The actors involved in each task are listed alongside the task name.</p>
      </section>`;

    logInfo("Detailed description generated successfully");

    return description;
  }

  /**
   * Generate a journey analysis section with insights
   * @param {Object} journey - The parsed journey data
   * @returns {string} HTML for the analysis section
   */
  function generateJourneyAnalysis(journey) {
    logInfo("Generating journey analysis insights");

    // Prepare data for analysis
    const highScoreTasks = [];
    const lowScoreTasks = [];
    const actorFrequency = {};

    journey.sections.forEach((section) => {
      section.tasks.forEach((task) => {
        // Track high/low score tasks
        if (task.score === journey.maxScore) {
          highScoreTasks.push({ section: section.name, ...task });
        }
        if (
          task.score === journey.minScore &&
          journey.minScore !== journey.maxScore
        ) {
          lowScoreTasks.push({ section: section.name, ...task });
        }

        // Track actor frequency
        task.actors.forEach((actor) => {
          actorFrequency[actor] = (actorFrequency[actor] || 0) + 1;
        });
      });
    });

    logDebug(
      `Analysis data: ${highScoreTasks.length} high-score tasks, ${lowScoreTasks.length} low-score tasks`
    );

    // Find most active actor
    let mostActiveActor = null;
    let maxFrequency = 0;
    for (const [actor, frequency] of Object.entries(actorFrequency)) {
      if (frequency > maxFrequency) {
        mostActiveActor = actor;
        maxFrequency = frequency;
      }
    }

    if (mostActiveActor) {
      logDebug(`Most active actor: ${mostActiveActor} (${maxFrequency} tasks)`);
    }

    // Build analysis HTML
    let analysis = `<section class="mermaid-section journey-analysis">
        <h4 class="mermaid-section-heading">Journey Analysis</h4>
        <ul class="journey-insights">`;

    // Insight: High satisfaction tasks
    if (highScoreTasks.length > 0) {
      analysis += `<li class="journey-insight high-satisfaction">
          <strong class="insight-title">High Satisfaction:</strong> 
          ${highScoreTasks.length} task${
        highScoreTasks.length !== 1 ? "s" : ""
      } received the highest score (${journey.maxScore}): 
          <ul class="insight-details">
            ${highScoreTasks
              .map((task) => `<li>"${task.name}" in ${task.section}</li>`)
              .join("")}
          </ul>
        </li>`;

      logDebug(
        `Added high satisfaction insight for ${highScoreTasks.length} tasks`
      );
    }

    // Insight: Low satisfaction tasks
    if (lowScoreTasks.length > 0 && journey.minScore !== journey.maxScore) {
      analysis += `<li class="journey-insight low-satisfaction">
          <strong class="insight-title">Areas for Improvement:</strong> 
          ${lowScoreTasks.length} task${
        lowScoreTasks.length !== 1 ? "s" : ""
      } received the lowest score (${journey.minScore}): 
          <ul class="insight-details">
            ${lowScoreTasks
              .map((task) => `<li>"${task.name}" in ${task.section}</li>`)
              .join("")}
          </ul>
        </li>`;

      logDebug(
        `Added low satisfaction insight for ${lowScoreTasks.length} tasks`
      );
    }

    // Insight: Most active actor
    if (mostActiveActor && maxFrequency > 1) {
      const actorTasks = (
        (maxFrequency /
          journey.sections.reduce(
            (sum, section) => sum + section.tasks.length,
            0
          )) *
        100
      ).toFixed(0);
      analysis += `<li class="journey-insight key-participant">
          <strong class="insight-title">Key Participant:</strong> 
          <span class="key-actor">"${mostActiveActor}"</span> is involved in ${maxFrequency} tasks (${actorTasks}% of the journey).
        </li>`;

      logDebug(`Added key participant insight for ${mostActiveActor}`);
    }

    // Insight: Section with most tasks
    const sectionCounts = journey.sections.map((section) => ({
      name: section.name,
      count: section.tasks.length,
    }));
    sectionCounts.sort((a, b) => b.count - a.count);

    if (sectionCounts.length > 0 && sectionCounts[0].count > 0) {
      analysis += `<li class="journey-insight complex-stage">
          <strong class="insight-title">Most Complex Stage:</strong> 
          The "<span class="stage-name">${
            sectionCounts[0].name
          }</span>" section has the most steps with ${
        sectionCounts[0].count
      } task${sectionCounts[0].count !== 1 ? "s" : ""}.
        </li>`;

      logDebug(
        `Added complex stage insight for section "${sectionCounts[0].name}"`
      );
    }

    analysis += `</ul></section>`;

    logInfo("Journey analysis completed successfully");

    return analysis;
  }

  // Register with the core module
  try {
    window.MermaidAccessibility.registerDescriptionGenerator("userJourney", {
      generateShort: shortDescriptionWrapper,
      generateDetailed: generateDetailedDescription,
      // Add a new property for HTML-formatted short description
      generateShortHTML: function (svgElement, code) {
        return generateShortDescription(svgElement, code).html;
      },
    });

    logInfo("User Journey module successfully registered with core module");
  } catch (error) {
    logError(`Failed to register module: ${error.message}`);
  }

  logInfo("User Journey module loaded and initialised successfully");

  // Return public API for configuration if needed
  return {
    setLogLevel: function (level) {
      if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
        currentLogLevel = level;
        logInfo(`Log level changed to: ${Object.keys(LOG_LEVELS)[level]}`);
      } else {
        logWarn(`Invalid log level: ${level}. Valid levels are 0-3.`);
      }
    },
    getLogLevel: function () {
      return currentLogLevel;
    },
    LOG_LEVELS: LOG_LEVELS,
  };
})();

// Export logic (keep outside the IIFE)
if (typeof module !== "undefined" && module.exports) {
  module.exports = MermaidAccessibilityUserJourney;
} else if (typeof window !== "undefined") {
  window.MermaidAccessibilityUserJourney = MermaidAccessibilityUserJourney;
}
