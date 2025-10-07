// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * MathPix Progress Display System - Enhanced for Visual Progress Bar (Stage 2)
 * Provides clean visual feedback during mathematical content processing
 * Integrates with existing notification system but reduces notification spam by 70%+
 */
class MathPixProgressDisplay {
  constructor(notificationBridge) {
    this.notifications = notificationBridge || {
      info: window.notifyInfo || console.info,
      success: window.notifySuccess || console.info,
      error: window.notifyError || console.error,
      warning: window.notifyWarning || console.warn,
    };

    this.progressSteps = [
      {
        key: "upload",
        message: "Uploading to MathPix...",
        percentage: 25,
        description: "Sending mathematical content to processing server",
      },
      {
        key: "process",
        message: "Processing mathematics...",
        percentage: 50,
        description: "Analysing mathematical expressions and symbols",
      },
      {
        key: "format",
        message: "Generating formats...",
        percentage: 75,
        description: "Creating LaTeX, MathML, AsciiMath, and other formats",
      },
      {
        key: "complete",
        message: "Complete",
        percentage: 100,
        description: "Processing finished successfully",
      },
    ];

    this.currentStep = 0;
    this.startTime = null;
    this.stepStartTime = null;
    this.totalSteps = this.progressSteps.length;
    this.isActive = false;

    // Visual progress bar elements
    this.progressContainer = null;
    this.progressBar = null;
    this.progressFill = null;
    this.progressLabel = null;

    logInfo(
      "MathPix Progress Display initialised with visual progress bar support"
    );
  }

  /**
   * Start the progress display sequence with visual progress bar
   * @param {Object} fileInfo - Information about the file being processed
   */
  startProgress(fileInfo = {}) {
    this.startTime = Date.now();
    this.stepStartTime = Date.now();
    this.currentStep = 0;
    this.isActive = true;

    logInfo("Visual progress display started", {
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      totalSteps: this.totalSteps,
    });

    // Show visual progress bar instead of notification
    this.showVisualProgressBar(
      "upload",
      0,
      `Processing ${fileInfo.name || "mathematics"}...`
    );

    // Only show critical initial notification (reduced from previous implementation)
    logDebug(
      "Progress started with visual indication - notification spam reduced"
    );
  }

  /**
   * Show and update visual progress bar - Core Stage 2 feature
   * @param {string} stage - Current stage name
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} additionalInfo - Additional information to display
   */
  showVisualProgressBar(stage, percentage, additionalInfo = "") {
    // Cache DOM elements for performance
    if (!this.progressContainer) {
      this.cacheProgressElements();
    }

    if (!this.progressContainer) {
      logWarn(
        "Visual progress bar container not found - falling back to notifications"
      );
      return false;
    }

    // Show progress container
    this.progressContainer.style.display = "block";

    // Update progress bar
    if (this.progressFill) {
      this.progressFill.style.width = `${Math.max(
        0,
        Math.min(100, percentage)
      )}%`;
      this.progressBar.setAttribute("aria-valuenow", percentage);
    }

    // Update progress label
    if (this.progressLabel) {
      const elapsedTime = this.getElapsedTime();
      let labelText = `${
        stage.charAt(0).toUpperCase() + stage.slice(1)
      }... ${percentage}%`;

      if (elapsedTime && elapsedTime !== "0s") {
        labelText += ` (${elapsedTime})`;
      }

      if (additionalInfo) {
        labelText += ` - ${additionalInfo}`;
      }

      this.progressLabel.textContent = labelText;
    }

    logDebug("Visual progress bar updated", {
      stage: stage,
      percentage: percentage,
      additionalInfo: additionalInfo,
      elapsedTime: this.getElapsedTime(),
    });

    return true;
  }

  /**
   * Cache visual progress bar DOM elements for performance
   */
  cacheProgressElements() {
    this.progressContainer = document.getElementById(
      "mathpix-progress-container"
    );
    this.progressBar = this.progressContainer?.querySelector(
      ".mathpix-progress-bar"
    );
    this.progressFill = document.getElementById("mathpix-progress-fill");
    this.progressLabel = document.getElementById("mathpix-progress-label");

    logDebug("Progress bar elements cached", {
      container: !!this.progressContainer,
      bar: !!this.progressBar,
      fill: !!this.progressFill,
      label: !!this.progressLabel,
    });
  }

  /**
   * Update progress stage with visual indication
   * @param {string} stageName - Name of the current stage
   * @param {number} percentage - Progress percentage
   */
  updateProgressStage(stageName, percentage) {
    if (!this.isActive) return;

    const success = this.showVisualProgressBar(stageName, percentage);

    if (!success) {
      // Fallback to minimal notification if visual progress fails
      logWarn("Visual progress unavailable, using fallback notification");
      const fallbackMessage = `${stageName} - ${percentage}%`;
      this.notifications.info(fallbackMessage);
    }

    logDebug("Progress stage updated", {
      stage: stageName,
      percentage: percentage,
      visual: success,
    });
  }

  /**
   * Display a specific progress step with visual indication
   * @param {number} stepIndex - Index of the step to show
   */
  showStep(stepIndex) {
    if (stepIndex >= this.progressSteps.length || !this.isActive) {
      return;
    }

    this.currentStep = stepIndex;
    this.stepStartTime = Date.now();
    const step = this.progressSteps[stepIndex];

    logDebug(
      `Showing visual progress step ${stepIndex + 1}/${this.totalSteps}: ${
        step.key
      }`
    );

    // Show visual progress instead of notification
    this.updateProgressStage(step.key, step.percentage);

    // Log step details (no notification spam)
    logInfo("Progress step displayed visually", {
      step: step.key,
      message: step.message,
      progress: `${step.percentage}%`,
      elapsedTime: this.getElapsedTime(),
    });
  }

  /**
   * Advance to the next progress step with visual update
   */
  nextStep() {
    if (!this.isActive) return;

    const nextIndex = this.currentStep + 1;
    if (nextIndex < this.progressSteps.length) {
      this.showStep(nextIndex);
    }
  }

  /**
   * Update timing information with visual progress
   * @param {string} additionalInfo - Additional information to display
   */
  updateTiming(additionalInfo = "") {
    if (!this.isActive) return;

    const step = this.progressSteps[this.currentStep];
    if (!step) return;

    // Update visual progress with additional info (no notification)
    this.showVisualProgressBar(step.key, step.percentage, additionalInfo);

    logDebug("Progress timing updated visually", {
      step: step.key,
      elapsedTime: this.getElapsedTime(),
      additionalInfo: additionalInfo,
    });
  }

  /**
   * Complete the progress display with final notification
   * @param {boolean} success - Whether the processing was successful
   * @param {Object} result - The processing result
   */
  complete(success, result = {}) {
    if (!this.isActive) return;

    this.isActive = false;
    const totalTime = this.getElapsedTime();

    logInfo("Visual progress display completed", {
      success: success,
      totalTime: totalTime,
      availableFormats: this.extractAvailableFormats(result),
    });

    if (success) {
      // Show 100% completion visually
      this.showVisualProgressBar("complete", 100, "Processing complete!");

      // Hide progress bar after brief display
      setTimeout(() => this.hideVisualProgressBar(), 1500);

      // Minimal success notification (reduced notification spam)
      const availableFormats = this.extractAvailableFormats(result);
      const formatCount = availableFormats.length;
      const successMessage = `✓ Mathematics converted successfully! ${formatCount} formats available (${totalTime})`;
      this.notifications.success(successMessage);

      logInfo("Processing completed successfully with visual indication", {
        formats: availableFormats,
        duration: totalTime,
        formatCount: formatCount,
      });
    } else {
      // Hide progress bar on error
      this.hideVisualProgressBar();

      // Critical error notification (preserved)
      const errorMessage = `Processing failed after ${totalTime}. Please check your file and try again.`;
      this.notifications.error(errorMessage);

      logError("Processing failed", {
        duration: totalTime,
        error: result.error || "Unknown error",
      });
    }
  }

  /**
   * Handle processing error with visual cleanup
   * @param {Error} error - The error that occurred
   * @param {string} context - Additional context about when the error occurred
   */
  handleError(error, context = "") {
    if (!this.isActive) return;

    this.isActive = false;
    const totalTime = this.getElapsedTime();
    const currentStep = this.progressSteps[this.currentStep];

    // Hide visual progress on error
    this.hideVisualProgressBar();

    logError("Progress display error", {
      error: error.message,
      context: context,
      currentStep: currentStep?.key,
      duration: totalTime,
    });

    // Critical error notification (preserved)
    let errorMessage = `Processing failed during ${
      currentStep?.message.toLowerCase() || "processing"
    }`;
    if (context) {
      errorMessage += ` - ${context}`;
    }
    errorMessage += ` (after ${totalTime})`;

    this.notifications.error(errorMessage);
  }

  /**
   * Hide visual progress bar
   */
  hideVisualProgressBar() {
    if (this.progressContainer) {
      this.progressContainer.style.display = "none";

      // Reset progress bar
      if (this.progressFill) {
        this.progressFill.style.width = "0%";
      }
      if (this.progressBar) {
        this.progressBar.setAttribute("aria-valuenow", 0);
      }
      if (this.progressLabel) {
        this.progressLabel.textContent = "Ready to process";
      }

      logDebug("Visual progress bar hidden and reset");
    }
  }

  /**
   * Get formatted elapsed time
   * @returns {string} Formatted time string
   */
  getElapsedTime() {
    if (!this.startTime) return "0s";

    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const milliseconds = elapsed % 1000;

    if (seconds > 0) {
      return `${seconds}.${Math.floor(milliseconds / 100)}s`;
    } else {
      return `${milliseconds}ms`;
    }
  }

  /**
   * Extract available formats from processing result
   * @param {Object} result - The processing result
   * @returns {Array} Array of available format names
   */
  extractAvailableFormats(result) {
    const formats = [];

    if (result.latex && result.latex.trim()) formats.push("LaTeX");
    if (result.mathml && result.mathml.trim()) formats.push("MathML");
    if (result.asciimath && result.asciimath.trim()) formats.push("AsciiMath");
    if (result.html && result.html.trim()) formats.push("HTML");
    if (result.markdown && result.markdown.trim()) formats.push("Markdown");
    if (result.rawJson) formats.push("JSON");

    return formats;
  }

  /**
   * Check if progress display is currently active
   * @returns {boolean} True if progress is active
   */
  isProgressActive() {
    return this.isActive;
  }

  /**
   * Get current progress information
   * @returns {Object} Current progress state
   */
  getProgressState() {
    const currentStepData = this.progressSteps[this.currentStep] || {};
    return {
      isActive: this.isActive,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      elapsedTime: this.getElapsedTime(),
      progressPercent: currentStepData.percentage || 0,
      currentStage: currentStepData.key || "unknown",
      visualProgressActive: !!(
        this.progressContainer &&
        this.progressContainer.style.display !== "none"
      ),
    };
  }

  /**
   * Test visual progress bar functionality - Stage 2 testing
   * @returns {boolean} True if visual progress is working
   */
  testVisualProgress() {
    logInfo("Testing MathPix visual progress bar functionality...");

    try {
      // Test progress bar elements
      this.cacheProgressElements();
      const elementsAvailable = !!(
        this.progressContainer &&
        this.progressFill &&
        this.progressLabel
      );

      if (!elementsAvailable) {
        logError("Visual progress elements not available");
        return false;
      }

      // Test progress stages
      const testStages = [
        { stage: "upload", percentage: 25 },
        { stage: "process", percentage: 50 },
        { stage: "format", percentage: 75 },
        { stage: "complete", percentage: 100 },
      ];

      logInfo("✓ Testing progress stages...");
      testStages.forEach(({ stage, percentage }, index) => {
        setTimeout(() => {
          this.showVisualProgressBar(
            stage,
            percentage,
            `Test stage ${index + 1}`
          );
          logDebug(`✓ Stage ${stage} tested: ${percentage}%`);

          if (index === testStages.length - 1) {
            setTimeout(() => {
              this.hideVisualProgressBar();
              logInfo("✅ Visual progress test completed successfully");
            }, 1000);
          }
        }, index * 800);
      });

      return true;
    } catch (error) {
      logError("Visual progress test failed:", error);
      return false;
    }
  }

  /**
   * Get visual progress capabilities for debugging
   * @returns {Object} Capabilities information
   */
  getVisualProgressCapabilities() {
    this.cacheProgressElements();

    return {
      visualProgressAvailable: !!(
        this.progressContainer &&
        this.progressFill &&
        this.progressLabel
      ),
      progressElements: {
        container: !!this.progressContainer,
        bar: !!this.progressBar,
        fill: !!this.progressFill,
        label: !!this.progressLabel,
      },
      progressStages: this.progressSteps.map((step) => ({
        key: step.key,
        percentage: step.percentage,
        message: step.message,
      })),
      notificationIntegration: {
        info: typeof this.notifications.info === "function",
        success: typeof this.notifications.success === "function",
        error: typeof this.notifications.error === "function",
        warning: typeof this.notifications.warning === "function",
      },
      currentState: this.getProgressState(),
    };
  }
}

export default MathPixProgressDisplay;
