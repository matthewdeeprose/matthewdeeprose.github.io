/**
 * Mermaid Accessibility - Gantt Chart Module
 * Generates accessible descriptions for Gantt charts
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

  // Helper functions for logging level checks
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  // Logging helper methods
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

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;
  const DateUtils = Utils.DateUtils;

  /**
   * Generate a short description for a Gantt chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    // Extract title from code
    const titleMatch = code.match(/title\s+([^\n]+)/i);
    const title = titleMatch ? titleMatch[1].trim() : "Gantt Chart";

    // Parse sections, tasks, and exclusions
    const { sections, excludesWeekends, excludedDates, weekendConfig } =
      parseGanttChart(code);

    // Count tasks and milestones
    let taskCount = 0;
    let milestoneCount = 0;

    sections.forEach((section) => {
      section.tasks.forEach((task) => {
        if (task.isMilestone) {
          milestoneCount++;
        } else {
          taskCount++;
        }
      });
    });

    // Build a concise description - HTML version
    let htmlDescription = `A Gantt chart titled "<span class="diagram-title">${title}</span>" showing `;

    if (sections.length > 0) {
      htmlDescription += `<span class="diagram-section-count">${sections.length}</span> project `;
      htmlDescription += sections.length === 1 ? "phase" : "phases";
    }

    if (taskCount > 0) {
      htmlDescription += ` with <span class="diagram-task-count">${taskCount}</span> `;
      htmlDescription += taskCount === 1 ? "task" : "tasks";
    }

    if (milestoneCount > 0) {
      htmlDescription += ` and <span class="diagram-milestone-count">${milestoneCount}</span> `;
      htmlDescription += milestoneCount === 1 ? "milestone" : "milestones";
    }

    // Add exclusion information if present
    if (excludesWeekends || (excludedDates && excludedDates.length > 0)) {
      htmlDescription += ". The schedule excludes ";

      if (excludesWeekends) {
        htmlDescription += `<span class="diagram-excludes-weekends">weekends`;
        if (weekendConfig) {
          htmlDescription += ` (${
            weekendConfig === "friday" ? "Friday-Saturday" : "Saturday-Sunday"
          })`;
        }
        htmlDescription += "</span>";

        if (excludedDates && excludedDates.length > 0) {
          htmlDescription += " and ";
        }
      }

      if (excludedDates && excludedDates.length > 0) {
        htmlDescription += `<span class="diagram-excludes-dates">${excludedDates.length} specific `;
        htmlDescription += excludedDates.length === 1 ? "date" : "dates";
        htmlDescription += "</span>";
      }
    }

    htmlDescription += ".";

    // Plain text version (without HTML tags)
    let plainTextDescription = `A Gantt chart titled "${title}" showing `;

    if (sections.length > 0) {
      plainTextDescription += `${sections.length} project `;
      plainTextDescription += sections.length === 1 ? "phase" : "phases";
    }

    if (taskCount > 0) {
      plainTextDescription += ` with ${taskCount} `;
      plainTextDescription += taskCount === 1 ? "task" : "tasks";
    }

    if (milestoneCount > 0) {
      plainTextDescription += ` and ${milestoneCount} `;
      plainTextDescription += milestoneCount === 1 ? "milestone" : "milestones";
    }

    // Add exclusion information if present
    if (excludesWeekends || (excludedDates && excludedDates.length > 0)) {
      plainTextDescription += ". The schedule excludes ";

      if (excludesWeekends) {
        plainTextDescription += `weekends`;
        if (weekendConfig) {
          plainTextDescription += ` (${
            weekendConfig === "friday" ? "Friday-Saturday" : "Saturday-Sunday"
          })`;
        }

        if (excludedDates && excludedDates.length > 0) {
          plainTextDescription += " and ";
        }
      }

      if (excludedDates && excludedDates.length > 0) {
        plainTextDescription += `${excludedDates.length} specific `;
        plainTextDescription += excludedDates.length === 1 ? "date" : "dates";
      }
    }

    plainTextDescription += ".";

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

    // Return text version for backwards compatibility with existing code
    return descriptions.text;
  }
  /**
   * Parse Gantt chart code to extract sections, tasks and configuration
   * @param {string} code - The Mermaid diagram code
   * @returns {Object} Parsed Gantt chart elements
   */
  function parseGanttChart(code) {
    // Initialise result object
    const result = {
      sections: [],
      excludesWeekends: false,
      excludedDates: [],
      weekendConfig: "sunday", // Default weekend config
      dateFormat: "YYYY-MM-DD", // Default date format
    };

    const lines = code.split("\n");
    let currentSection = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for date format
      const dateFormatMatch = trimmedLine.match(/dateFormat\s+([^\n]+)/i);
      if (dateFormatMatch) {
        result.dateFormat = dateFormatMatch[1].trim();
        continue;
      }

      // Check for exclusions
      const excludesMatch = trimmedLine.match(/excludes\s+([^\n]+)/i);
      if (excludesMatch) {
        const exclusions = excludesMatch[1].trim().toLowerCase();

        if (exclusions.includes("weekend")) {
          result.excludesWeekends = true;
        } else {
          // Extract specific dates
          const dates = exclusions.split(",").map((date) => date.trim());
          dates.forEach((date) => {
            if (date.match(/\d{4}-\d{2}-\d{2}/)) {
              result.excludedDates.push(DateUtils.parseDate(date));
            }
          });
        }

        continue;
      }

      // Check for weekend configuration
      const weekendMatch = trimmedLine.match(/weekend\s+([^\n]+)/i);
      if (weekendMatch) {
        const weekendDay = weekendMatch[1].trim().toLowerCase();
        if (weekendDay === "friday" || weekendDay === "saturday") {
          result.weekendConfig = weekendDay;
        }
        continue;
      }

      // Section detection
      const sectionMatch = trimmedLine.match(/section\s+(.+)/i);
      if (sectionMatch) {
        currentSection = {
          name: sectionMatch[1].trim(),
          tasks: [],
        };
        result.sections.push(currentSection);
        continue;
      }

      // Task detection (only process if we have a current section)
      if (
        currentSection &&
        trimmedLine &&
        !trimmedLine.startsWith("title") &&
        !trimmedLine.startsWith("dateFormat") &&
        !trimmedLine.startsWith("gantt") &&
        !trimmedLine.startsWith("excludes") &&
        !trimmedLine.startsWith("weekend") &&
        !trimmedLine.startsWith("%%")
      ) {
        parseTaskLine(trimmedLine, currentSection);
      }
    }

    return result;
  }

  /**
   * Parse a task line and add it to the current section
   * @param {string} line - The task line from Gantt chart
   * @param {Object} currentSection - The current section object
   */
  function parseTaskLine(line, currentSection) {
    // Check for task metadata - handle various formats
    // Skip comments that might have been missed in parseGanttChart
    if (line.trim().startsWith("%%")) {
      return;
    }

    // Complex task with multiple pieces of metadata (id, dates, etc)
    // Format: "Task name :id, start/dependency, end/duration"
    const complexTaskMatch = line.match(
      /(.+?)\s*:([^,]+)(?:,\s*(.+?))?(?:,\s*(.+))?$/
    );

    if (complexTaskMatch) {
      const taskName = complexTaskMatch[1].trim();
      const firstMeta = complexTaskMatch[2].trim();
      const secondMeta = complexTaskMatch[3]
        ? complexTaskMatch[3].trim()
        : null;
      const thirdMeta = complexTaskMatch[4] ? complexTaskMatch[4].trim() : null;

      // Process task status and ID
      const { id, taskStatus } = parseTaskIdAndStatus(firstMeta);

      // Create task object
      const task = {
        name: taskName,
        id: id,
        ...taskStatus,
      };

      // Process dependencies and timing
      if (secondMeta) {
        // Check if it's a dependency ("after X")
        if (secondMeta.toLowerCase().startsWith("after ")) {
          // Multiple dependencies: "after task1 task2 task3"
          const dependencies = secondMeta.substring(6).trim().split(/\s+/);
          task.dependsOn =
            dependencies.length === 1 ? dependencies[0] : dependencies;
        }
        // Check if it's an "until" dependency
        else if (secondMeta.toLowerCase().startsWith("until ")) {
          const untilTaskId = secondMeta.substring(6).trim();
          task.untilTaskId = untilTaskId;
        }
        // Otherwise it's a start date
        else {
          task.timing = secondMeta;
          if (secondMeta.match(/\d{4}-\d{2}-\d{2}/)) {
            task.startDate = DateUtils.parseDate(secondMeta);
          }
        }
      }

      // Process duration or end date
      if (thirdMeta) {
        // Check if it's milestone
        if (thirdMeta.toLowerCase() === "milestone") {
          task.isMilestone = true;
          task.duration = "0d";
        }
        // Check if it's an "until" dependency
        else if (thirdMeta.toLowerCase().startsWith("until ")) {
          const untilTaskId = thirdMeta.substring(6).trim();
          task.untilTaskId = untilTaskId;
        }
        // Check if it's a duration (like "5d", "2w", "48h")
        else if (thirdMeta.match(/^\d+[dwhmM]$/)) {
          task.duration = thirdMeta;
        }
        // Otherwise, assume it's an end date
        else if (thirdMeta.match(/\d{4}-\d{2}-\d{2}/)) {
          task.endDate = DateUtils.parseDate(thirdMeta);
        }
      }

      currentSection.tasks.push(task);
    }
    // Simple task format (just name and possibly duration)
    else {
      const simpleTaskMatch = line.match(/(.+?)(?:\s*:\s*(.+))?$/);
      if (simpleTaskMatch) {
        const taskName = simpleTaskMatch[1].trim();
        const duration = simpleTaskMatch[2]
          ? simpleTaskMatch[2].trim()
          : "unspecified";

        currentSection.tasks.push({
          name: taskName,
          duration: duration,
          isMilestone: duration.toLowerCase() === "milestone",
        });
      }
    }
  }

  /**
   * Parse task ID and status flags from first metadata item
   * @param {string} metaString - The metadata string
   * @returns {Object} Task ID and status object
   */
  function parseTaskIdAndStatus(metaString) {
    const result = {
      id: null,
      taskStatus: {
        isDone: false,
        isActive: false,
        isCritical: false,
        isMilestone: false,
      },
    };

    // Split string by spaces to find status flags
    const parts = metaString.split(/\s+/);
    let idFound = false;

    for (const part of parts) {
      const lowerPart = part.toLowerCase();

      // Check for status flags
      if (lowerPart === "done") {
        result.taskStatus.isDone = true;
      } else if (lowerPart === "active") {
        result.taskStatus.isActive = true;
      } else if (lowerPart === "crit") {
        result.taskStatus.isCritical = true;
      } else if (lowerPart === "milestone") {
        result.taskStatus.isMilestone = true;
      }
      // If not a status flag, it's the ID
      else if (!idFound) {
        result.id = part;
        idFound = true;
      }
    }

    return result;
  }
  /**
   * Enhanced duration conversions for all format types
   * @param {string} duration - Duration string (e.g., "5d", "2w", "12h", "3m")
   * @returns {number} Number of days
   */
  function durationToDays(duration) {
    if (!duration) return 0;
    if (duration === "milestone" || duration === "0d") return 0;
    if (duration === "unspecified") return 1; // Default to 1 day if unspecified

    // Match number and unit
    const match = duration.match(/(\d+)([dwhmM])/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case "d":
        return value; // days
      case "w":
        return value * 7; // weeks
      case "m":
        if (match[2] === "m") {
          return Math.ceil(value / 24); // hours (rounded up to days)
        } else {
          return value * 30; // months (approximate)
        }
      case "h":
        return Math.ceil(value / 24); // hours (rounded up to days)
      default:
        return 0;
    }
  }

  /**
   * Calculate task dates accounting for excluded dates
   * @param {Array} sections - Array of sections with tasks
   * @param {Array} excludedDates - Array of excluded dates
   * @param {boolean} excludesWeekends - Whether weekends are excluded
   * @param {string} weekendConfig - Weekend configuration ('friday' or 'sunday')
   * @returns {Object} Object with updated sections, project start and end dates
   */
  function calculateTaskDatesWithExclusions(
    sections,
    excludedDates = [],
    excludesWeekends = false,
    weekendConfig = "sunday"
  ) {
    // Make a deep copy to avoid modifying the original
    const sectionsCopy = JSON.parse(JSON.stringify(sections));

    // Convert sections to a flat array of tasks with IDs for easier processing
    const allTasks = {};
    sectionsCopy.forEach((section) => {
      section.tasks.forEach((task) => {
        if (task.id) {
          allTasks[task.id] = { ...task, section: section.name };
        }
      });
    });

    // First, set dates for tasks with explicit start dates
    let projectStart = null;
    let projectEnd = null;

    // Process tasks with explicit dates
    Object.values(allTasks).forEach((task) => {
      if (task.startDate) {
        // Update project start date
        if (!projectStart || task.startDate < projectStart) {
          projectStart = new Date(task.startDate);
        }

        // Calculate end date for non-milestones
        if (!task.isMilestone && task.duration) {
          // Calculate end date accounting for exclusions
          const endDate = calculateEndDateWithExclusions(
            task.startDate,
            task.duration,
            excludedDates,
            excludesWeekends,
            weekendConfig
          );

          task.endDate = endDate;

          // Update project end date
          if (!projectEnd || endDate > projectEnd) {
            projectEnd = new Date(endDate);
          }
        } else if (task.isMilestone) {
          task.endDate = new Date(task.startDate);

          // Update project end date for milestone
          if (!projectEnd || task.endDate > projectEnd) {
            projectEnd = new Date(task.endDate);
          }
        }
      }
    });

    // Resolve dependencies
    resolveDependencies(
      Object.values(allTasks),
      excludedDates,
      excludesWeekends,
      weekendConfig,
      projectStart,
      projectEnd
    );

    // Update tasks in original sections
    sectionsCopy.forEach((section) => {
      section.tasks.forEach((task) => {
        if (task.id && allTasks[task.id]) {
          task.startDate = allTasks[task.id].startDate;
          task.endDate = allTasks[task.id].endDate;
          task.dependsOnTaskName = allTasks[task.id].dependsOnTaskName;
          task.untilTaskName = allTasks[task.id].untilTaskName;
        }
      });
    });

    // Calculate section date ranges
    sectionsCopy.forEach((section) => {
      if (section.tasks.length > 0) {
        let sectionStart = null;
        let sectionEnd = null;

        section.tasks.forEach((task) => {
          if (task.startDate) {
            if (!sectionStart || task.startDate < sectionStart) {
              sectionStart = new Date(task.startDate);
            }
          }

          if (task.endDate) {
            if (!sectionEnd || task.endDate > sectionEnd) {
              sectionEnd = new Date(task.endDate);
            }
          }
        });

        if (sectionStart) section.startDate = sectionStart;
        if (sectionEnd) section.endDate = sectionEnd;
      }
    });

    // Calculate project duration
    let projectDuration = null;
    if (projectStart && projectEnd) {
      const durationDays = DateUtils.differenceInDays(
        DateUtils.addDays(projectEnd, 1), // Add 1 day for inclusive end date
        projectStart
      );

      projectDuration = {
        days: durationDays,
        formatted: DateUtils.formatDurationInWeeksAndDays(durationDays),
      };
    }

    return {
      projectStart,
      projectEnd,
      projectDuration,
      updatedSections: sectionsCopy,
    };
  }

  /**
   * Calculate end date accounting for excluded dates
   * @param {Date} startDate - Task start date
   * @param {string} duration - Duration string
   * @param {Array} excludedDates - Array of excluded dates
   * @param {boolean} excludesWeekends - Whether weekends are excluded
   * @param {string} weekendConfig - Weekend configuration ('friday' or 'sunday')
   * @returns {Date} Calculated end date
   */
  function calculateEndDateWithExclusions(
    startDate,
    duration,
    excludedDates,
    excludesWeekends,
    weekendConfig
  ) {
    // Convert duration to days
    const durationDays =
      typeof duration === "string" ? durationToDays(duration) : duration;

    if (durationDays <= 0) return new Date(startDate);

    logDebug(
      `[Mermaid Accessibility] Calculating end date for ${durationDays} days from ${DateUtils.formatDate(
        startDate
      )}`
    );
    logDebug(
      `[Mermaid Accessibility] Exclusions: weekends=${excludesWeekends}, weekendConfig=${weekendConfig}, excludedDates=${
        excludedDates ? excludedDates.length : 0
      }`
    );

    let currentDate = new Date(startDate);
    let daysAdded = 0;
    let skippedDays = 0;

    while (daysAdded < durationDays) {
      currentDate = DateUtils.addDays(currentDate, 1);

      // Skip excluded dates
      if (
        !isExcludedDate(
          currentDate,
          excludedDates,
          excludesWeekends,
          weekendConfig
        )
      ) {
        daysAdded++;
      } else {
        skippedDays++;
        logDebug(
          `[Mermaid Accessibility] Skipping excluded date: ${DateUtils.formatDate(
            currentDate
          )}`
        );
      }
    }

    logDebug(
      `[Mermaid Accessibility] Total calendar days: ${
        daysAdded + skippedDays
      }, Working days: ${daysAdded}, Skipped days: ${skippedDays}`
    );
    logDebug(
      `[Mermaid Accessibility] End date: ${DateUtils.formatDate(currentDate)}`
    );

    // Subtract 1 day as end date is inclusive
    return DateUtils.addDays(currentDate, -1);
  }

  /**
   * Check if a date is excluded
   * @param {Date} date - Date to check
   * @param {Array} excludedDates - Array of excluded dates
   * @param {boolean} excludesWeekends - Whether weekends are excluded
   * @param {string} weekendConfig - Weekend configuration ('friday' or 'sunday')
   * @returns {boolean} True if date is excluded
   */
  function isExcludedDate(
    date,
    excludedDates,
    excludesWeekends,
    weekendConfig
  ) {
    // Check explicit excluded dates
    if (excludedDates && excludedDates.length > 0) {
      for (const excludedDate of excludedDates) {
        if (DateUtils.formatDate(date) === DateUtils.formatDate(excludedDate)) {
          return true;
        }
      }
    }

    // Check weekends
    if (excludesWeekends) {
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

      if (weekendConfig === "friday") {
        // Friday-Saturday weekend
        return day === 5 || day === 6; // 5 = Friday, 6 = Saturday
      } else {
        // Saturday-Sunday weekend (default)
        return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
      }
    }

    return false;
  }
  /**
   * Resolve dependencies between tasks
   * @param {Array} tasks - Array of task objects
   * @param {Array} excludedDates - Array of excluded dates
   * @param {boolean} excludesWeekends - Whether weekends are excluded
   * @param {string} weekendConfig - Weekend configuration
   * @param {Date} projectStart - Project start date
   * @param {Date} projectEnd - Project end date
   */
  function resolveDependencies(
    tasks,
    excludedDates,
    excludesWeekends,
    weekendConfig,
    projectStart,
    projectEnd
  ) {
    // Create a map of task IDs to tasks for easier lookup
    const tasksById = {};
    tasks.forEach((task) => {
      if (task.id) {
        tasksById[task.id] = task;
      }
    });

    // Iterate until no more changes are made
    let progress = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety limit

    while (progress && iterations < MAX_ITERATIONS) {
      progress = false;
      iterations++;

      for (const task of tasks) {
        // Skip tasks that already have both start and end dates
        if (task.startDate && task.endDate) continue;

        // Handle "after" dependencies
        if (task.dependsOn && !task.startDate) {
          const dependencies = Array.isArray(task.dependsOn)
            ? task.dependsOn
            : [task.dependsOn];

          let allDependenciesResolved = true;
          let latestEndDate = null;
          let dependencyNames = [];

          for (const depId of dependencies) {
            const dependency = tasksById[depId];
            if (!dependency || !dependency.endDate) {
              allDependenciesResolved = false;
              break;
            }

            if (!latestEndDate || dependency.endDate > latestEndDate) {
              latestEndDate = new Date(dependency.endDate);
            }

            dependencyNames.push(dependency.name);
          }

          if (allDependenciesResolved) {
            // Start date is day after latest dependency ends
            const startDate = DateUtils.addDays(latestEndDate, 1);
            task.startDate = startDate;
            task.dependsOnTaskName = dependencyNames.join(" and ");

            // Calculate end date if duration is known
            if (task.duration && !task.isMilestone) {
              task.endDate = calculateEndDateWithExclusions(
                startDate,
                task.duration,
                excludedDates,
                excludesWeekends,
                weekendConfig
              );
            } else if (task.isMilestone) {
              task.endDate = new Date(startDate);
            }

            progress = true;
          }
        }

        // Handle "until" dependencies
        if (task.untilTaskId && task.startDate && !task.endDate) {
          const untilTask = tasksById[task.untilTaskId];
          if (untilTask && untilTask.startDate) {
            // End date is the day before the until task starts
            task.endDate = DateUtils.addDays(untilTask.startDate, -1);
            task.untilTaskName = untilTask.name;

            // Override duration to match the calculated dates
            if (task.startDate && task.endDate) {
              const calculatedDuration = DateUtils.differenceInDays(
                DateUtils.addDays(task.endDate, 1),
                task.startDate
              );
              task.calculatedDuration = calculatedDuration;
            }

            progress = true;
          }
        }

        // Update project bounds
        if (
          task.startDate &&
          (!projectStart || task.startDate < projectStart)
        ) {
          projectStart = new Date(task.startDate);
        }

        if (task.endDate && (!projectEnd || task.endDate > projectEnd)) {
          projectEnd = new Date(task.endDate);
        }
      }
    }

    // Check for unresolved tasks and provide useful diagnostics
    const unresolvedTasks = tasks.filter(
      (task) => !task.startDate || !task.endDate
    );
    if (unresolvedTasks.length > 0) {
      logWarn(
        "[Mermaid Accessibility] Some tasks could not be resolved:",
        unresolvedTasks
      );

      // For each unresolved task, check if dependencies exist
      unresolvedTasks.forEach((task) => {
        if (task.dependsOn) {
          const dependencies = Array.isArray(task.dependsOn)
            ? task.dependsOn
            : [task.dependsOn];

          dependencies.forEach((depId) => {
            if (!tasksById[depId]) {
              logWarn(
                `[Mermaid Accessibility] Task "${task.name}" depends on non-existent task "${depId}"`
              );
            } else if (!tasksById[depId].endDate) {
              logWarn(
                `[Mermaid Accessibility] Task "${task.name}" depends on unresolved task "${tasksById[depId].name}"`
              );
            }
          });
        }

        if (task.untilTaskId) {
          if (!tasksById[task.untilTaskId]) {
            logWarn(
              `[Mermaid Accessibility] Task "${task.name}" runs until non-existent task "${task.untilTaskId}"`
            );
          } else if (!tasksById[task.untilTaskId].startDate) {
            logWarn(
              `[Mermaid Accessibility] Task "${
                task.name
              }" runs until unresolved task "${
                tasksById[task.untilTaskId].name
              }"`
            );
          }
        }
      });
    }

    // Handle circular dependencies
    if (iterations >= MAX_ITERATIONS) {
      logError(
        "[Mermaid Accessibility] Possible circular dependencies detected in Gantt chart"
      );
    }
  }

  /**
   * Calculate the critical path of a project
   * @param {Array} sections - Array of sections with tasks
   * @returns {Array} Array of task IDs on the critical path
   */
  function calculateCriticalPath(sections) {
    // Flatten all tasks for processing
    const allTasks = [];
    const tasksById = {};

    sections.forEach((section) => {
      section.tasks.forEach((task) => {
        if (task.id) {
          allTasks.push(task);
          tasksById[task.id] = task;
        }
      });
    });

    // Verify tasks have required dates
    const validTasks = allTasks.filter(
      (task) => task.startDate && task.endDate
    );
    if (validTasks.length === 0) return [];

    // Find project end date and tasks ending on that date
    let projectEndDate = null;
    validTasks.forEach((task) => {
      if (!projectEndDate || task.endDate > projectEndDate) {
        projectEndDate = new Date(task.endDate);
      }
    });

    // Get tasks that end on the project end date
    let endTasks = validTasks.filter(
      (task) =>
        DateUtils.formatDate(task.endDate) ===
        DateUtils.formatDate(projectEndDate)
    );

    // If no tasks end on project end date, take the latest task
    if (endTasks.length === 0) {
      let latestTask = validTasks[0];
      validTasks.forEach((task) => {
        if (task.endDate > latestTask.endDate) {
          latestTask = task;
        }
      });
      endTasks = [latestTask];
    }

    // Work backwards from end tasks
    const criticalPath = [];
    const processedTaskIds = new Set();

    // Process each end task (there could be multiple)
    endTasks.forEach((endTask) => {
      const taskPath = [endTask.id];
      let currentTask = endTask;

      // Add to processed set to avoid duplicate processing
      processedTaskIds.add(endTask.id);

      // Trace backwards through dependencies
      while (true) {
        // Find predecessor tasks
        let predecessors = [];

        if (currentTask.dependsOn) {
          const dependencies = Array.isArray(currentTask.dependsOn)
            ? currentTask.dependsOn
            : [currentTask.dependsOn];

          // Find all valid predecessor tasks
          dependencies.forEach((depId) => {
            const dep = tasksById[depId];
            if (dep && dep.endDate) {
              predecessors.push(dep);
            }
          });
        }

        // If no predecessors, break the loop
        if (predecessors.length === 0) break;

        // Find the latest ending predecessor
        let latestPredecessor = predecessors[0];
        predecessors.forEach((pred) => {
          if (pred.endDate > latestPredecessor.endDate) {
            latestPredecessor = pred;
          }
        });

        // Add to path if not already processed
        if (!processedTaskIds.has(latestPredecessor.id)) {
          taskPath.unshift(latestPredecessor.id);
          processedTaskIds.add(latestPredecessor.id);
          currentTask = latestPredecessor;
        } else {
          // Already processed this task, stop here
          break;
        }
      }

      // Add this path to the critical path
      criticalPath.push(...taskPath.filter((id) => !criticalPath.includes(id)));
    });

    return criticalPath;
  }
  /**
   * Generate a detailed description for a Gantt chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A detailed HTML description
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Gantt chart description");

    // Extract title from code
    const titleMatch = code.match(/title\s+([^\n]+)/i);
    const title = titleMatch ? titleMatch[1].trim() : "Gantt Chart";

    // Extract date format if present
    const dateFormatMatch = code.match(/dateFormat\s+([^\n]+)/i);
    const dateFormat = dateFormatMatch
      ? dateFormatMatch[1].trim()
      : "YYYY-MM-DD";

    // Parse the Gantt chart
    const { sections, excludesWeekends, excludedDates, weekendConfig } =
      parseGanttChart(code);

    // Calculate dates and durations with exclusions
    const { projectStart, projectEnd, projectDuration, updatedSections } =
      calculateTaskDatesWithExclusions(
        sections,
        excludedDates,
        excludesWeekends,
        weekendConfig
      );

    // Identify parallel work streams
    const parallelWork = identifyParallelTasks(updatedSections);

    // Calculate critical path
    const criticalPath = calculateCriticalPath(updatedSections);

    // Identify potential resource constraints
    const resourceConstraints = identifyResourceConstraints(parallelWork);

    // Check for schedule risks
    const riskAreas = identifySchedulingRisks(updatedSections);

    // Identify phase transitions
    const phaseTransitions = identifyPhaseTransitions(updatedSections);

    // Start building the description
    let description = `<div class="gantt-description">`;

    // Overview section
    description += `<div class="gantt-overview">
        <p class="gantt-title">This Gantt chart titled "${title}" shows a project timeline with ${
      sections.length
    } ${sections.length === 1 ? "section" : "sections"}.</p>
        <p class="gantt-date-format">Dates are displayed in ${dateFormat} format.</p>`;

    // Project duration
    if (projectStart && projectEnd && projectDuration) {
      description += `<p class="gantt-project-duration">The project starts on ${DateUtils.formatDate(
        projectStart
      )} and is scheduled to complete on ${DateUtils.formatDate(
        projectEnd
      )}, spanning approximately ${projectDuration.formatted}.</p>`;
    }

    // Calculate total calendar days and working days for clarity
    const totalCalendarDays =
      projectStart && projectEnd
        ? DateUtils.differenceInDays(
            DateUtils.addDays(projectEnd, 1),
            projectStart
          )
        : 0;

    // Only add this section if there are exclusions
    if (
      (excludesWeekends || (excludedDates && excludedDates.length > 0)) &&
      projectDuration &&
      totalCalendarDays > projectDuration.days
    ) {
      const excludedDaysCount = totalCalendarDays - projectDuration.days;

      // Add to overview after the project duration
      description = description.replace(
        /<\/p>\s*<\/div>/,
        `</p><p class="gantt-exclusion-impact">The project spans ${totalCalendarDays} calendar days, with ${excludedDaysCount} excluded days (${(
          (excludedDaysCount / totalCalendarDays) *
          100
        ).toFixed(1)}% of the timeline).</p></div>`
      );
    }

    description += `</div>`;

    // Add exclusions section if present
    if (excludesWeekends || (excludedDates && excludedDates.length > 0)) {
      description += `<div class="gantt-exclusions">
    <h4 class="gantt-exclusions-heading">Schedule Exclusions</h4>
    <p>This schedule excludes:`;

      if (excludesWeekends) {
        description += ` <span class="gantt-exclusion-weekends">weekends (${
          weekendConfig === "friday" ? "Friday-Saturday" : "Saturday-Sunday"
        })</span>`;

        if (excludedDates && excludedDates.length > 0) {
          description += " and";
        }
      }

      if (excludedDates && excludedDates.length > 0) {
        description += ` <span class="gantt-exclusion-dates">specific dates: ${excludedDates
          .map((d) => DateUtils.formatDate(d))
          .join(", ")}</span>`;
      }

      description += `.</p>
    <p class="gantt-exclusion-note">These excluded dates are not counted in task durations. For example, a 10-day task may span more than 10 calendar days if it includes excluded dates.</p>
  </div>`;
    }

    // Sections and tasks
    description += `<div class="gantt-sections">
        <p class="gantt-sections-intro">The project is organised into the following ${
          sections.length === 1 ? "section" : "sections"
        }:</p>
        <ul class="gantt-section-list">`;

    updatedSections.forEach((section) => {
      description += `<li class="gantt-section">
            <div class="gantt-section-header">
                <strong class="gantt-section-name">${section.name}</strong>`;

      if (section.startDate && section.endDate) {
        const sectionDuration = DateUtils.differenceInDays(
          DateUtils.addDays(section.endDate, 1), // Add 1 for inclusive end date
          section.startDate
        );
        description += ` <span class="gantt-section-dates">(${DateUtils.formatDate(
          section.startDate
        )} to ${DateUtils.formatDate(
          section.endDate
        )}, ${DateUtils.formatDurationInWeeksAndDays(sectionDuration)})</span>`;
      }
      description += `</div>`;

      if (section.tasks.length > 0) {
        description += `<ul class="gantt-task-list">`;

        section.tasks.forEach((task) => {
          // Add appropriate class for task type
          let taskClass = "gantt-task";
          if (task.isMilestone) taskClass += " gantt-milestone";
          if (task.isDone) taskClass += " gantt-done";
          if (task.isActive) taskClass += " gantt-active";
          if (task.isCritical) taskClass += " gantt-critical";
          if (criticalPath && task.id && criticalPath.includes(task.id))
            taskClass += " gantt-critical-path";

          description += `<li class="${taskClass}">`;

          // Task name with status
          let taskDescription = `<span class="gantt-task-name">${task.name}</span>`;

          // Add status text
          let statusText = "";
          if (task.isDone) statusText = " (completed)";
          if (task.isActive) statusText = " (in progress)";
          if (task.isCritical) statusText = " (critical)";

          if (statusText) {
            taskDescription += `<span class="gantt-task-status">${statusText}</span>`;
          }

          // Add timing information
          if (task.startDate) {
            taskDescription += `, which starts on <span class="gantt-task-start-date">${DateUtils.formatDate(
              task.startDate
            )}</span>`;

            if (task.dependsOnTaskName) {
              taskDescription += ` after the completion of <span class="gantt-task-dependency">${task.dependsOnTaskName}</span>`;
            }
          }

          // Add duration information
          if (task.isMilestone) {
            taskDescription += ` <span class="gantt-task-type">(milestone event)</span>`;
          } else if (task.duration && task.duration !== "unspecified") {
            // Convert abbreviated durations to full words
            const durationDays =
              task.calculatedDuration || durationToDays(task.duration);

            taskDescription += ` with a duration of <span class="gantt-task-duration">${DateUtils.formatDurationInWeeksAndDays(
              durationDays
            )}</span>`;
          }

          // Add "until" relationship if present
          if (task.untilTaskName) {
            taskDescription += `, running until <span class="gantt-task-until">${task.untilTaskName}</span> begins`;
          }
          // Add end date if available
          else if (task.endDate && !task.isMilestone) {
            taskDescription += `, ending on <span class="gantt-task-end-date">${DateUtils.formatDate(
              task.endDate
            )}</span>`;
          }

          description += taskDescription + `</li>`;
        });

        description += `</ul>`;
      }

      description += `</li>`;
    });

    description += `</ul></div>`;

    // Milestones section
    const milestones = updatedSections.flatMap((section) =>
      section.tasks.filter((task) => task.isMilestone)
    );

    if (milestones.length > 0) {
      description += `<div class="gantt-milestones">
            <h4 class="gantt-milestones-heading">Project Milestones</h4>
            <p class="gantt-milestones-intro">The project includes ${
              milestones.length
            } milestone${milestones.length > 1 ? "s" : ""}:</p>
            <ul class="gantt-milestone-list">`;

      milestones.forEach((milestone) => {
        let milestoneDesc = `<span class="gantt-milestone-name">${milestone.name}</span>`;
        if (milestone.startDate) {
          milestoneDesc += ` <span class="gantt-milestone-date">(${DateUtils.formatDate(
            milestone.startDate
          )})</span>`;

          if (milestone.dependsOnTaskName) {
            milestoneDesc += ` after completion of ${milestone.dependsOnTaskName}`;
          }
        }
        description += `<li class="gantt-milestone-item">${milestoneDesc}</li>`;
      });

      description += `</ul></div>`;
    }

    // Parallel work section
    if (parallelWork.length > 0) {
      description += `<div class="gantt-parallel-work">
            <h4 class="gantt-parallel-heading">Parallel Work</h4>
            <p class="gantt-parallel-intro">The project includes ${
              parallelWork.length
            } instance${
        parallelWork.length > 1 ? "s" : ""
      } of parallel work:</p>
            <ul class="gantt-parallel-list">`;

      parallelWork.forEach((parallel) => {
        const taskNames = parallel.tasks.map((t) => t.name).join(" and ");
        description += `<li class="gantt-parallel-item">On <span class="gantt-parallel-date">${parallel.date}</span>, <span class="gantt-parallel-tasks">${taskNames}</span> begin simultaneously`;

        // Add resource insight if available
        if (resourceConstraints && resourceConstraints[parallel.date]) {
          description += ` <span class="gantt-resource-note">(Note: May require careful resource allocation)</span>`;
        }

        description += `</li>`;
      });

      description += `</ul></div>`;
    }

    // Critical path section
    if (criticalPath && criticalPath.length > 0) {
      description += `<div class="gantt-critical-path-section">
            <h4 class="gantt-critical-path-heading">Critical Path</h4>
            <p class="gantt-critical-path-intro">The critical path (tasks that directly affect the project end date) includes:</p>
            <ol class="gantt-critical-path-list">`;

      criticalPath.forEach((taskId) => {
        const task = findTaskById(updatedSections, taskId);
        if (task) {
          description += `<li class="gantt-critical-path-item">
                    <span class="gantt-critical-task-name">${task.name}</span>`;
          if (task.duration && !task.isMilestone) {
            description += ` <span class="gantt-critical-task-duration">(${task.duration})</span>`;
          }
          description += `</li>`;
        }
      });

      description += `</ol>
            <p class="gantt-critical-path-note">Delays to these tasks will directly impact the overall project completion date.</p>
        </div>`;
    }

    // Risk areas section
    if (riskAreas && riskAreas.length > 0) {
      description += `<div class="gantt-risk-areas">
            <h4 class="gantt-risk-heading">Potential Schedule Risks</h4>
            <ul class="gantt-risk-list">`;

      riskAreas.forEach((risk) => {
        description += `<li class="gantt-risk-item">${risk}</li>`;
      });

      description += `</ul>
        </div>`;
    }

    // Phase transitions section
    if (phaseTransitions && phaseTransitions.length > 0) {
      description += `<div class="gantt-phase-transitions">
            <h4 class="gantt-transitions-heading">Key Phase Transitions</h4>
            <ul class="gantt-transitions-list">`;

      phaseTransitions.forEach((transition) => {
        description += `<li class="gantt-transition-item">
                Transition from <span class="gantt-from-phase">${
                  transition.fromPhase
                }</span> to 
                <span class="gantt-to-phase">${
                  transition.toPhase
                }</span> occurs on 
                <span class="gantt-transition-date">${DateUtils.formatDate(
                  transition.date
                )}</span>
            </li>`;
      });

      description += `</ul>
        </div>`;
    }

    // General dependencies note
    description += `<div class="gantt-dependencies-note">
        <p>The chart shows task dependencies, with successor tasks starting after their prerequisite tasks complete.</p>
    </div>`;

    description += `</div>`;

    return description;
  }
  /**
   * Identify potential scheduling risks in the project
   * @param {Array} sections - Array of sections with tasks
   * @returns {Array} Array of risk descriptions
   */
  function identifySchedulingRisks(sections) {
    const risks = [];

    // Flatten all tasks for easier processing
    const allTasks = [];
    sections.forEach((section) => {
      section.tasks.forEach((task) => {
        allTasks.push({
          ...task,
          section: section.name,
        });
      });
    });

    // Check for tight dependencies (end and start on same day)
    allTasks.forEach((task) => {
      if (task.endDate) {
        // Find tasks that start the day this task ends
        const dependentTasks = allTasks.filter(
          (t) =>
            t.startDate &&
            DateUtils.formatDate(t.startDate) ===
              DateUtils.formatDate(task.endDate) &&
            t.dependsOn === task.id
        );

        if (dependentTasks.length > 0) {
          dependentTasks.forEach((depTask) => {
            risks.push(
              `Tight dependency: "${task.name}" directly transitions to "${depTask.name}" on the same day with no buffer`
            );
          });
        }
      }
    });

    // Check for long-duration tasks (potential risk)
    const longTasks = allTasks.filter((task) => {
      if (!task.duration || task.isMilestone) return false;
      const days = task.calculatedDuration || durationToDays(task.duration);
      return days > 10; // Consider tasks longer than 2 weeks as potentially risky
    });

    longTasks.forEach((task) => {
      risks.push(
        `Long-duration task: "${task.name}" has a ${task.duration} duration, which may be difficult to estimate accurately`
      );
    });

    // Check for "until" dependencies (can be risky if the target task moves)
    const untilTasks = allTasks.filter((task) => task.untilTaskName);

    untilTasks.forEach((task) => {
      risks.push(
        `Flexible end date: "${task.name}" runs until "${task.untilTaskName}" begins, which creates uncertainty in scheduling`
      );
    });

    return risks;
  }

  /**
   * Identify phase transitions in the project
   * @param {Array} sections - Array of sections with tasks
   * @returns {Array} Array of transition objects
   */
  function identifyPhaseTransitions(sections) {
    const transitions = [];

    // Find where one section ends and another begins
    for (let i = 0; i < sections.length - 1; i++) {
      const currentSection = sections[i];
      const nextSection = sections[i + 1];

      if (currentSection.endDate && nextSection.startDate) {
        // Check if there's a gap or overlap
        const endDate = DateUtils.formatDate(currentSection.endDate);
        const startDate = DateUtils.formatDate(nextSection.startDate);

        let transitionType = "immediate";
        if (
          DateUtils.differenceInDays(
            nextSection.startDate,
            currentSection.endDate
          ) > 1
        ) {
          transitionType = "gap";
        } else if (endDate === startDate) {
          transitionType = "same-day";
        }

        transitions.push({
          fromPhase: currentSection.name,
          toPhase: nextSection.name,
          date: nextSection.startDate,
          type: transitionType,
        });
      }
    }

    return transitions;
  }

  /**
   * Find a task by ID
   * @param {Array} sections - Array of sections with tasks
   * @param {string} taskId - ID of the task to find
   * @returns {Object|null} The task object or null
   */
  function findTaskById(sections, taskId) {
    for (const section of sections) {
      for (const task of section.tasks) {
        if (task.id === taskId) {
          return task;
        }
      }
    }
    return null;
  }

  /**
   * Identify potential resource constraints from parallel tasks
   * @param {Array} parallelWork - Array of parallel work instances
   * @returns {Object} Map of dates to resource constraint flags
   */
  function identifyResourceConstraints(parallelWork) {
    const constraints = {};

    // For now, simply flag days with 2+ parallel tasks as potentially constrained
    parallelWork.forEach((parallel) => {
      if (parallel.tasks.length >= 2) {
        constraints[parallel.date] = true;
      }
    });

    return constraints;
  }

  /**
   * Enhanced version of the existing identifyParallelTasks function
   * @param {Array} sections - Array of sections with tasks
   * @returns {Array} Array of parallel work instances with additional context
   */
  function identifyParallelTasks(sections) {
    const datesMap = new Map();
    const tasksByDate = {};

    // Group tasks by start date
    sections.forEach((section) => {
      section.tasks.forEach((task) => {
        if (task.startDate) {
          const dateKey = DateUtils.formatDate(task.startDate);
          if (!datesMap.has(dateKey)) {
            datesMap.set(dateKey, []);
            tasksByDate[dateKey] = [];
          }
          datesMap.get(dateKey).push({
            name: task.name,
            section: section.name,
            id: task.id,
          });
          tasksByDate[dateKey].push(task);
        }
      });
    });

    // Find dates with multiple tasks starting
    const parallelWorkStreams = [];
    datesMap.forEach((tasks, date) => {
      if (tasks.length > 1) {
        // Calculate the combined workload for this parallel set
        const combinedDuration = tasksByDate[date].reduce((total, task) => {
          if (!task.isMilestone && task.duration) {
            return (
              total + (task.calculatedDuration || durationToDays(task.duration))
            );
          }
          return total;
        }, 0);

        parallelWorkStreams.push({
          date,
          tasks,
          combinedDuration,
          potentialResourceImpact: tasks.length > 2 ? "high" : "moderate",
        });
      }
    });

    // Sort by date for chronological presentation
    parallelWorkStreams.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    return parallelWorkStreams;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("gantt", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
  });

  logInfo("[Mermaid Accessibility] Gantt chart module loaded and registered");
})();
