/**
 * @fileoverview Timing Handler Module
 * Manages precise timing for request operations with accessible reporting.
 * Tracks duration of different phases in the request lifecycle and provides
 * formatted timing information for display and screen readers.
 */

import { a11y } from "../accessibility-helpers.js";

// Logging configuration (module scope)
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

// Logging helper functions
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
    console.info(message, ...args);
  }
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(message, ...args);
  }
}

// Configuration function for external control
function setLogLevel(level) {
  if (Object.values(LOG_LEVELS).includes(level)) {
    currentLogLevel = level;
    logInfo(`TimingHandler: Log level set to ${getLogLevelName(level)}`);
  } else {
    logWarn(`TimingHandler: Invalid log level ${level}`);
  }
}

function getLogLevelName(level) {
  return (
    Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === level) ||
    "UNKNOWN"
  );
}

export class TimingHandler {
  constructor() {
    this.startTime = null;
    this.endTime = null;
    this.phases = {};
    this.isRunning = false;
    this.updateInterval = null;
    this.elapsedTimeElement = document.getElementById("elapsed-time");
    this.timingStatusElement = document.getElementById("timing-status");
    this.timingDetailsElement = document.getElementById("timing-details");

    // Log initialisation
    logInfo("TimingHandler: Initialised");
  }

  /**
   * Start the timing process
   * @param {string} [initialPhase='prepare'] - Initial phase name
   */
  start(initialPhase = "prepare") {
    try {
      // Use performance.now() with Date.now() fallback
      this.startTime = window.performance ? performance.now() : Date.now();
      this.isRunning = true;
      this.phases = {};

      // Record start of initial phase
      this.startPhase(initialPhase);

      // Update the displayed time every 50ms
      this.updateInterval = setInterval(() => {
        this.updateElapsedTime();
      }, 50);

      // Update status display
      if (this.timingStatusElement) {
        this.timingStatusElement.textContent = "Running";
        this.timingStatusElement.classList.add("running");
      }

      // Announce start for screen readers
      a11y.announceStatus("Request timing started", "polite");

      logInfo(
        `TimingHandler: Started timing with initial phase '${initialPhase}'`
      );
    } catch (error) {
      logError("TimingHandler: Error starting timer", error);
      // Ensure we don't leave interval running if there's an error
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  }

  /**
   * Stop the timing process
   */
  stop() {
    try {
      this.endTime = window.performance ? performance.now() : Date.now();
      this.isRunning = false;

      // Clear the update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      // End the current phase if any is active
      this.endCurrentPhase();

      // Final update of the displayed time
      this.updateElapsedTime();

      // Update status display
      if (this.timingStatusElement) {
        this.timingStatusElement.textContent = "Complete";
        this.timingStatusElement.classList.remove("running");
        this.timingStatusElement.classList.add("complete");
      }

      // Announce completion for screen readers
      const totalTime = this.formatTime(this.getTotalTime());
      a11y.announceStatus(`Request completed in ${totalTime}`, "polite");

      // Show detailed timing breakdown
      this.showTimingDetails();

      logInfo(
        `TimingHandler: Stopped timing. Total time: ${this.formatTime(
          this.getTotalTime()
        )}`
      );
    } catch (error) {
      logError("TimingHandler: Error stopping timer", error);
    }
  }

  /**
   * Start timing a specific phase
   * @param {string} phaseName - Name of the phase to start
   */
  startPhase(phaseName) {
    try {
      if (!phaseName) {
        logWarn("TimingHandler: Attempted to start phase with empty name");
        return;
      }

      // End the current phase if one is active
      this.endCurrentPhase();

      // Start the new phase
      const now = window.performance ? performance.now() : Date.now();
      this.phases[phaseName] = {
        start: now,
        end: null,
        duration: null,
      };

      // Update status to indicate current phase
      if (this.timingStatusElement) {
        this.timingStatusElement.textContent = `${this.capitalizePhase(
          phaseName
        )}...`;
      }

      logDebug(`TimingHandler: Started phase '${phaseName}'`);
    } catch (error) {
      logError(`TimingHandler: Error starting phase '${phaseName}'`, error);
    }
  }

  /**
   * End the current active phase
   */
  endCurrentPhase() {
    try {
      // Find the active phase (the one without an end time)
      const activePhase = Object.keys(this.phases).find(
        (phase) => this.phases[phase].end === null
      );

      if (activePhase) {
        const now = window.performance ? performance.now() : Date.now();
        this.phases[activePhase].end = now;
        this.phases[activePhase].duration =
          now - this.phases[activePhase].start;

        logDebug(
          `TimingHandler: Ended phase '${activePhase}' with duration ${this.formatTime(
            this.phases[activePhase].duration,
            true
          )}`
        );
      }
    } catch (error) {
      logError("TimingHandler: Error ending current phase", error);
    }
  }

  /**
   * Update the displayed elapsed time
   */
  updateElapsedTime() {
    if (!this.elapsedTimeElement) return;

    try {
      const now = window.performance ? performance.now() : Date.now();
      const elapsed = this.isRunning
        ? now - this.startTime
        : this.endTime - this.startTime;

      this.elapsedTimeElement.textContent = this.formatTime(elapsed);

      // Set appropriate ARIA attributes for accessibility
      this.elapsedTimeElement.setAttribute(
        "aria-label",
        `Elapsed time: ${this.formatTime(elapsed)}`
      );

      logDebug(
        `TimingHandler: Updated elapsed time display: ${this.formatTime(
          elapsed
        )}`
      );
    } catch (error) {
      logError("TimingHandler: Error updating elapsed time", error);
    }
  }

  /**
   * Show detailed timing information for all phases
   */
  showTimingDetails() {
    if (!this.timingDetailsElement) return;

    try {
      // Clear previous content
      this.timingDetailsElement.innerHTML = "";

      // Create a details summary for timing breakdown
      const details = document.createElement("details");
      details.setAttribute("open", "");

      const summary = document.createElement("summary");
      summary.textContent = `Total Time: ${this.formatTime(
        this.getTotalTime()
      )}`;
      details.appendChild(summary);

      // Add horizontal rule
      const hr = document.createElement("hr");
      hr.className = "timing-separator";
      details.appendChild(hr);

      // Add a list of phase timings
      const list = document.createElement("dl");
      list.className = "timing-phase-list";

      Object.keys(this.phases).forEach((phase) => {
        const duration = this.phases[phase].duration;
        if (duration !== null) {
          // Term (phase name)
          const dt = document.createElement("dt");
          dt.textContent = this.capitalizePhase(phase) + ":";
          list.appendChild(dt);

          // Definition (duration)
          const dd = document.createElement("dd");
          dd.textContent = this.formatTime(duration, true);
          list.appendChild(dd);
        }
      });

      details.appendChild(list);
      this.timingDetailsElement.appendChild(details);

      // Make sure the timing details are announced to screen readers
      this.timingDetailsElement.setAttribute("aria-live", "polite");

      logInfo("TimingHandler: Displayed timing details");
    } catch (error) {
      logError("TimingHandler: Error showing timing details", error);
    }
  }

  /**
   * Get the total time elapsed
   * @returns {number} Total milliseconds elapsed
   */
  getTotalTime() {
    return this.endTime ? this.endTime - this.startTime : 0;
  }

  /**
   * Format time in a human-readable format
   * @param {number} milliseconds - Time in milliseconds
   * @param {boolean} [compact=false] - Whether to use compact format
   * @returns {string} Formatted time string
   */
  formatTime(milliseconds, compact = false) {
    try {
      if (milliseconds < 1000) {
        return compact
          ? `${Math.round(milliseconds)}ms`
          : `00:00.${String(Math.floor(milliseconds)).padStart(3, "0")}`;
      }

      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const ms = Math.floor(milliseconds % 1000);

      if (compact) {
        if (minutes > 0) {
          return `${minutes}m ${seconds}.${String(ms).substring(0, 1)}s`;
        } else {
          return `${seconds}.${String(ms).substring(0, 2)}s`;
        }
      } else {
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
          2,
          "0"
        )}.${String(ms).padStart(3, "0")}`;
      }
    } catch (error) {
      logError("TimingHandler: Error formatting time", error);
      return "00:00.000"; // Fallback
    }
  }

  /**
   * Capitalise the first letter of a phase name
   * @param {string} phaseName - Phase name to capitalise
   * @returns {string} Capitalised phase name
   */
  capitalizePhase(phaseName) {
    if (!phaseName) return "";
    return phaseName.charAt(0).toUpperCase() + phaseName.slice(1);
  }

  /**
   * Reset the timer and clear all phases
   */
  reset() {
    try {
      this.startTime = null;
      this.endTime = null;
      this.phases = {};
      this.isRunning = false;

      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      // Reset displays
      if (this.elapsedTimeElement) {
        this.elapsedTimeElement.textContent = "00:00.000";
      }

      if (this.timingStatusElement) {
        this.timingStatusElement.textContent = "Ready";
        this.timingStatusElement.classList.remove("running", "complete");
      }

      if (this.timingDetailsElement) {
        this.timingDetailsElement.innerHTML = "";
      }

      logInfo("TimingHandler: Reset timer and cleared all phases");
    } catch (error) {
      logError("TimingHandler: Error resetting timer", error);
    }
  }

  /**
   * Set the logging level for this module
   * @param {number} level - Log level (0-3)
   */
  setLogLevel(level) {
    setLogLevel(level);
  }

  /**
   * Get current logging level
   * @returns {number} Current log level
   */
  getLogLevel() {
    return currentLogLevel;
  }

  /**
   * Get available log levels for reference
   * @returns {Object} Log levels object
   */
  static getLogLevels() {
    return { ...LOG_LEVELS };
  }
}

// Export singleton instance
export const timingHandler = new TimingHandler();

// Export logging configuration for external access
export { LOG_LEVELS, setLogLevel };
