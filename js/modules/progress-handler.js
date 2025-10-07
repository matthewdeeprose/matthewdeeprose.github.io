// js/modules/progress-handler.js

import { a11y } from "../accessibility-helpers.js";
import { timingHandler } from "./timing-handler.js"; // Add this import

const progressHandlerModule = (function () {
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

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`ProgressHandler [ERROR]: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`ProgressHandler [WARN]: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`ProgressHandler [INFO]: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`ProgressHandler [DEBUG]: ${message}`, ...args);
    }
  }

  // Set logging level function
  function setLogLevel(level) {
    if (
      typeof level === "string" &&
      LOG_LEVELS[level.toUpperCase()] !== undefined
    ) {
      currentLogLevel = LOG_LEVELS[level.toUpperCase()];
    } else if (typeof level === "number" && level >= 0 && level <= 3) {
      currentLogLevel = level;
    } else {
      logWarn("Invalid log level provided, keeping current level");
    }
  }

  // Main ProgressHandler class implementation
  class ProgressHandlerImpl {
    constructor() {
      this.progressBar = document.getElementById("progress-indicator");
      this.progressFill = null;
      this.progressStatus = document.getElementById("progress-status");
      this.progressSteps = null;
      this.currentStep = null;
      this.timingHandler = timingHandler; // Add reference to timing handler
      this.initialise();

      logInfo("Initialised with timing handler integration");
    }

    initialise() {
      if (!this.progressBar) {
        logError("Progress bar element not found");
        return;
      }

      logDebug("Initialising progress bar elements");

      // Get or create progress fill element
      this.progressFill = this.progressBar.querySelector(".progress-fill");
      if (!this.progressFill) {
        this.progressFill = document.createElement("div");
        this.progressFill.className = "progress-fill";
        this.progressBar.appendChild(this.progressFill);
        logDebug("Created progress fill element");
      }

      // Initialise steps
      this.progressSteps = document.querySelector(".progress-steps");
      if (this.progressSteps) {
        logDebug("Setting up progress steps");
        // Add keyboard navigation for steps
        // this.progressSteps.setAttribute("role", "tablist");
        const steps = this.progressSteps.querySelectorAll(".step");
        steps.forEach((step, index) => {
          // step.setAttribute("role", "tab");
          // step.setAttribute("aria-selected", "false");
          // step.setAttribute("tabindex", "-1");
          step.id = `progress-step-${index}`;
        });
      }

      // Set initial state
      this.reset();
      logDebug("Progress handler initialisation completed");
    }

    /**
     * Update progress bar value and message
     * @param {number} value - Progress value (0-100)
     * @param {string} message - Status message to display
     * @param {string} [step] - Current step identifier
     */
    update(value, message, step = null) {
      if (!this.progressBar || !this.progressFill) {
        logWarn("Cannot update progress: required elements not available");
        return;
      }

      // Validate progress value
      const progressValue = Math.max(0, Math.min(100, value));

      // Show progress bar
      this.progressBar.style.display = "block";
      this.progressBar.setAttribute("aria-valuenow", progressValue);
      this.progressFill.style.width = `${progressValue}%`;

      // Update aria-busy state
      this.progressBar.setAttribute(
        "aria-busy",
        progressValue < 100 ? "true" : "false"
      );

      // Update status message if provided
      if (message && this.progressStatus) {
        this.progressStatus.textContent = message;
        // Announce status to screen readers
        a11y.announceStatus(
          message,
          this.getAnnouncementPriority(progressValue)
        );
      }

      // Update active step if provided
      if (step) {
        this.updateStep(step);
      }

      // Auto-hide when complete
      // if (progressValue >= 100) {
      //   setTimeout(() => {
      //     this.hide();
      //   }, 1000);
      // }

      // Log progress update
      logDebug("Progress update:", { value: progressValue, message, step });
    }

    /**
     * Update active step
     * @param {string} stepId - Step identifier
     */
    updateStep(stepId) {
      if (!this.progressSteps) {
        logDebug("No progress steps available to update");
        return;
      }

      logDebug(`Updating active step to: ${stepId}`);

      const steps = this.progressSteps.querySelectorAll(".step");
      steps.forEach((step) => {
        const isActive = step.dataset.step === stepId;
        step.dataset.active = isActive;
        // step.setAttribute("aria-selected", isActive);
        // step.setAttribute("tabindex", isActive ? "0" : "-1");

        if (isActive) {
          this.currentStep = step;
          // Only focus if the step changed
          if (document.activeElement !== step) {
            step.focus();
            logDebug(`Focused on step: ${stepId}`);
          }
        }
      });
    }

    /**
     * Hide the progress bar
     */
    hide() {
      logDebug("Hiding progress bar");

      if (this.progressBar) {
        // Fade out gracefully
        this.progressBar.style.opacity = "0";
        setTimeout(() => {
          this.progressBar.style.display = "none";
          this.progressBar.style.opacity = "1";
          logDebug("Progress bar hidden");
        }, 300);
      }

      // Reset steps
      if (this.progressSteps) {
        const steps = this.progressSteps.querySelectorAll(".step");
        steps.forEach((step) => {
          step.dataset.active = false;
          // step.setAttribute("aria-selected", "false");
        });
        logDebug("Progress steps reset");
      }

      // Clear status
      if (this.progressStatus) {
        this.progressStatus.textContent = "";
      }
    }

    /**
     * Show the progress bar
     */
    show() {
      if (this.progressBar) {
        this.progressBar.style.display = "block";
        logDebug("Progress bar shown");
      }
    }

    /**
     * Reset progress bar to initial state
     */
    reset() {
      logInfo("Resetting progress and timing");

      if (this.progressBar && this.progressFill) {
        this.progressBar.style.display = "none";
        this.progressBar.setAttribute("aria-valuenow", "0");
        this.progressFill.style.width = "0%";
        this.progressBar.setAttribute("aria-busy", "false");
        logDebug("Progress bar elements reset");
      }

      if (this.progressStatus) {
        this.progressStatus.textContent = "";
      }

      // Reset steps
      if (this.progressSteps) {
        const steps = this.progressSteps.querySelectorAll(".step");
        steps.forEach((step) => {
          step.dataset.active = false;
          //  step.setAttribute("aria-selected", "false");
        });
        logDebug("Progress steps reset");
      }

      // Reset timing handler
      if (this.timingHandler && this.timingHandler.reset) {
        this.timingHandler.reset();
        logDebug("Timing handler reset");
      } else {
        logWarn("Timing handler not available or missing reset method");
      }

      this.currentStep = null;
    }

    /**
     * Determine announcement priority based on progress value
     * @param {number} value - Progress value
     * @returns {"assertive" | "polite"} Priority level
     */
    getAnnouncementPriority(value) {
      // Use assertive for important progress points
      const priority =
        value === 0 || value === 100 || value === 50 ? "assertive" : "polite";

      logDebug(`Announcement priority for value ${value}: ${priority}`);
      return priority;
    }

    /**
     * Start a new processing sequence
     * @param {string} message - Initial status message
     */
    startProcessing(message = "Starting processing...") {
      logInfo("Starting processing with timing");

      this.reset();
      this.show();
      if (this.progressFill) {
        // Remove any state-related classes
        this.progressFill.classList.remove("success", "error");
        logDebug("Removed previous state classes from progress fill");
      }

      // Start timing and track the 'prepare' phase
      if (this.timingHandler && this.timingHandler.start) {
        this.timingHandler.start("prepare");
        logDebug("Started timing handler with 'prepare' phase");
      } else {
        logWarn("Timing handler not available or missing start method");
      }

      this.update(10, message, "prepare");
    }

    /**
     * Update progress for API request phase
     * @param {string} message - Status message
     */
    updateRequestProgress(message = "Sending request to AI model...") {
      logInfo("Updating request progress, starting 'request' phase");

      // Start the 'request' timing phase
      if (this.timingHandler && this.timingHandler.startPhase) {
        this.timingHandler.startPhase("request");
        logDebug("Started 'request' timing phase");
      } else {
        logWarn("Timing handler not available or missing startPhase method");
      }

      this.update(30, message, "process");
    }

    /**
     * Update progress for response processing phase
     * @param {string} message - Status message
     */
    updateResponseProgress(message = "Processing response...") {
      logInfo("Updating response progress, starting 'processing' phase");

      // Start the 'processing' timing phase
      if (this.timingHandler && this.timingHandler.startPhase) {
        this.timingHandler.startPhase("processing");
        logDebug("Started 'processing' timing phase");
      } else {
        logWarn("Timing handler not available or missing startPhase method");
      }

      this.update(70, message, "process");
    }

    /**
     * Complete the progress sequence
     * @param {string} message - Completion message
     * @param {boolean} success - Whether the operation was successful
     */
    complete(message, success = true) {
      const completionMessage =
        message ||
        (success ? "Request completed successfully" : "Request failed");

      logInfo(
        `Completing request (success: ${success}), starting 'complete' phase`
      );

      // Start the 'complete' phase
      if (this.timingHandler && this.timingHandler.startPhase) {
        this.timingHandler.startPhase("complete");
        logDebug("Started 'complete' timing phase");
      } else {
        logWarn("Timing handler not available or missing startPhase method");
      }

      // Add a small delay before stopping to allow some processing time to be recorded
      setTimeout(() => {
        if (this.timingHandler && this.timingHandler.stop) {
          this.timingHandler.stop();
          logDebug("Stopped timing handler");
        }
      }, 50); // 50ms delay

      this.update(100, completionMessage, "complete");

      // Update visual state based on success
      if (this.progressFill) {
        this.progressFill.classList.toggle("success", success);
        this.progressFill.classList.toggle("error", !success);
        logDebug(
          `Added ${success ? "success" : "error"} class to progress fill`
        );
      }

      // Set appropriate ARIA label for screen readers
      if (this.progressBar) {
        this.progressBar.setAttribute(
          "aria-label",
          `Progress ${success ? "complete" : "failed"}: ${completionMessage}`
        );
        logDebug("Updated ARIA label for progress bar");
      }
    }

    /**
     * Set progress bar to indeterminate state
     * @param {string} message - Status message
     */
    setIndeterminate(message) {
      if (!this.progressBar) {
        logWarn("Cannot set indeterminate state: progress bar not available");
        return;
      }

      logDebug("Setting progress bar to indeterminate state");
      this.progressBar.classList.add("indeterminate");
      if (message) {
        this.update(null, message);
      }
    }

    /**
     * Remove indeterminate state
     */
    clearIndeterminate() {
      if (this.progressBar) {
        this.progressBar.classList.remove("indeterminate");
        logDebug("Cleared indeterminate state from progress bar");
      }
    }
  }

  // Return public API
  return {
    ProgressHandler: ProgressHandlerImpl,
    setLogLevel: setLogLevel,
    LOG_LEVELS: LOG_LEVELS,
  };
})();

// Simplified exports to avoid naming conflicts
export const ProgressHandler = progressHandlerModule.ProgressHandler;
export const { setLogLevel, LOG_LEVELS } = progressHandlerModule;
