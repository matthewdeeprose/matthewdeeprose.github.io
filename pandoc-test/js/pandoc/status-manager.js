// status-manager.js
// Status Management System Module
// Handles status bar updates, progress indicators, and visual feedback

const StatusManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[STATUS]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[STATUS]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[STATUS]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[STATUS]", message, ...args);
  }

  // ===========================================================================================
  // STATUS MANAGEMENT IMPLEMENTATION
  // ===========================================================================================

  /**
   * Status Manager Class
   * Handles modern status indicators with progress feedback
   */
  class StatusSystemManager {
    constructor() {
      this.statusIcon = null;
      this.statusText = null;
      this.statusProgress = null;
      this.statusProgressBar = null;
      this.currentStatus = "loading";
      this.isInitialised = false;
    }

    /**
     * Initialise the status system
     */
    initialise() {
      logInfo("Initialising Status System Manager...");

      try {
        // Get DOM elements
        this.statusIcon = document.getElementById("statusDot");
        this.statusText = document.getElementById("statusText");
        this.statusProgress = document.getElementById("statusProgress");
        this.statusProgressBar = document.getElementById("statusProgressBar");

        if (!this.statusIcon || !this.statusText) {
          throw new Error("Required status system DOM elements not found");
        }

        // FIXED: Set initialised flag BEFORE calling updateStatus to prevent warning
        this.isInitialised = true;

        // Set initial status
        this.updateStatus("loading", "Initialising application...", 0);

        logInfo("✅ Status System initialised successfully");

        return true;
      } catch (error) {
        logError("Failed to initialise Status System:", error);
        this.isInitialised = false;
        return false;
      }
    }

    /**
     * Update status with modern UI feedback
     * @param {string} status - 'loading', 'ready', 'error'
     * @param {string} message - Status message to display
     * @param {number} progress - Progress percentage (0-100)
     */
    updateStatus(status, message, progress = 0) {
      if (!this.isInitialised) {
        logWarn("Status system not initialised, attempting update anyway");
      }

      logInfo(`Status update: ${status} - ${message} (${progress}%)`);

      // Store current status
      this.currentStatus = status;

      // Update status icon
      if (this.statusIcon) {
        // Remove all status classes
        this.statusIcon.classList.remove("loading", "ready", "error");
        // Add new status class
        this.statusIcon.classList.add(status);
      }

      // Update status text
      if (this.statusText) {
        this.statusText.textContent = message;
      }

      // Handle progress bar
      this.updateProgress(status, progress);

      // Emit status change event for other modules
      this.emitStatusChange(status, message, progress);
    }

    /**
     * Update status with HTML content for icons
     * @param {string} status - 'loading', 'ready', 'error'
     * @param {string} htmlContent - HTML content to display
     * @param {number} progress - Progress percentage (0-100)
     */
    updateStatusWithHTML(status, htmlContent, progress = 0) {
      if (!this.isInitialised) {
        logWarn("Status system not initialised, attempting update anyway");
      }

      logInfo(`Status HTML update: ${status} - ${progress}%`);

      // Store current status
      this.currentStatus = status;

      // Update status icon
      if (this.statusIcon) {
        // Remove all status classes
        this.statusIcon.classList.remove("loading", "ready", "error");
        // Add new status class
        this.statusIcon.classList.add(status);
      }

      // Update status text with HTML content
      if (this.statusText) {
        this.statusText.innerHTML = htmlContent;
      }

      // Update progress bar
      if (this.statusProgressBar) {
        this.statusProgressBar.style.width = `${progress}%`;
      }

      // Show/hide progress bar based on status
      if (this.statusProgress) {
        if (status === "loading" && progress > 0 && progress < 100) {
          this.statusProgress.classList.add("visible");
        } else {
          this.statusProgress.classList.remove("visible");
        }
      }

      logDebug(`Status HTML updated successfully: ${status}`);
    }

    /**
     * Update progress bar based on status and progress
     */
    updateProgress(status, progress) {
      if (!this.statusProgress || !this.statusProgressBar) {
        return;
      }

      if (status === "loading" && progress > 0) {
        this.statusProgress.classList.add("visible");
        this.statusProgressBar.style.width = progress + "%";
      } else if (status === "ready") {
        this.statusProgress.classList.add("visible");
        this.statusProgressBar.style.width = "100%";
        // Hide progress bar after completion animation
        setTimeout(() => {
          this.statusProgress.classList.remove("visible");
          this.statusProgressBar.style.width = "0%";
        }, 1000);
      } else if (status === "error") {
        this.statusProgress.classList.remove("visible");
        this.statusProgressBar.style.width = "0%";
      }
    }

    /**
     * Emit status change event for other modules to listen to
     */
    emitStatusChange(status, message, progress) {
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("statusChange", {
              detail: { status, message, progress },
            })
          );
        }
      } catch (error) {
        logError("Error emitting status change event:", error);
      }
    }

    /**
     * Set loading status with progress updates
     */
    setLoading(message, progress = 0) {
      this.updateStatus("loading", message, progress);
    }

    /**
     * Set ready status with automatic success icon for achievements
     */
    setReady(message = "Ready! Start creating mathematical documents...") {
      // Check if this is a success/completion message that should get trophy icon
      const isSuccessMessage =
        message.includes("successfully") ||
        message.includes("complete") ||
        message.includes("processed") ||
        message.includes("Ready for export");

      if (isSuccessMessage) {
        const successMessage = `
      <svg class="action-icon trophy-icon" height="24" width="24" viewBox="0 0 21 21" aria-hidden="true">
        <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
          <path d="m4.5.5h6c.5522847 0 1 .44771525 1 1v5c0 2.209139-1.790861 4-4 4s-4-1.790861-4-4v-5c0-.55228475.44771525-1 1-1z"/>
          <path d="m7.5 10.5v3"/>
          <path d="m4.5 13.5h6c.5522847 0 1 .4477153 1 1s-.4477153 1-1 1h-6c-.55228475 0-1-.4477153-1-1s.44771525-1 1-1zm7-11h2c.5522847 0 1 .44771525 1 1v1c0 1.1045695-.8954305 2-2 2h-1zm-8 0h-2c-.55228475 0-1 .44771525-1 1v1c0 1.1045695.8954305 2 2 2h1z"/>
        </g>
      </svg>
      ${message}
    `;
        this.updateStatusWithHTML("ready", successMessage, 100);
      } else {
        this.updateStatus("ready", message, 100);
      }
    }

    /**
     * Set error status
     */
    setError(message) {
      this.updateStatus("error", message, 0);
    }

    /**
     * Show temporary feedback message
     */
    showTemporaryStatus(message, duration = 3000) {
      if (!this.isInitialised) {
        logWarn("Cannot show temporary status - system not initialised");
        return;
      }

      const originalStatus = this.currentStatus;
      const originalMessage = this.statusText?.textContent || "";

      // Show temporary message
      if (this.statusText) {
        this.statusText.textContent = message;
      }

      // Revert after duration
      setTimeout(() => {
        if (this.statusText) {
          this.statusText.textContent = originalMessage;
        }
      }, duration);

      logDebug(`Temporary status shown: ${message} (${duration}ms)`);
    }

    /**
     * Get current status information
     */
    getCurrentStatus() {
      return {
        status: this.currentStatus,
        message: this.statusText?.textContent || "",
        isInitialised: this.isInitialised,
      };
    }

    /**
     * Reset status to initial loading state
     */
    reset() {
      logInfo("Resetting status system...");
      this.updateStatus("loading", "Initialising application...", 0);
    }

    /**
     * Show processing indicator for operations
     */
    showProcessing(message = "Processing...") {
      this.setLoading(message, 50);
    }

    /**
     * Hide processing indicator
     */
    hideProcessing() {
      this.setReady();
    }
  }

  // ===========================================================================================
  // STATUS SYSTEM INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const statusManager = new StatusSystemManager();

  // ===========================================================================================
  // PREDEFINED STATUS MESSAGES
  // ===========================================================================================

  const STATUS_MESSAGES = {
    INIT_START: "Initialising application...",
    INIT_WASI: "Initialising WebAssembly environment...",
    INIT_DOWNLOAD: "Downloading Pandoc WebAssembly module...",
    INIT_RUNTIME: "Setting up Haskell runtime environment...",
    INIT_MEMORY: "Configuring memory management...",
    INIT_PANDOC: "Initialising Pandoc converter...",
    INIT_FINALISE: "Finalising setup...",
    READY: "Ready! Start creating mathematical documents...",
    CONVERT_START: "Converting LaTeX to HTML...",
    CONVERT_MATH: "Processing mathematical expressions...",
    CONVERT_CLEAN: "Cleaning and formatting output...",
    CONVERT_MATHJAX: "Rendering mathematical expressions...",
    CONVERT_COMPLETE: "Conversion complete! Ready for export.",
    ERROR_INIT: "Initialisation failed",
    ERROR_CONVERT: "Conversion failed",
    ERROR_NETWORK: "Network connection error",
    ERROR_WASM: "WebAssembly loading failed",
  };

  // ===========================================================================================
  // CONVENIENCE METHODS FOR COMMON OPERATIONS
  // ===========================================================================================

  /**
   * Update status for Pandoc initialisation sequence
   */
  function updateInitialisationStatus(step, progress) {
    const message = STATUS_MESSAGES[step] || "Processing...";
    statusManager.setLoading(message, progress);
  }

  /**
   * Update status for conversion sequence
   */
  function updateConversionStatus(step, progress) {
    const message = STATUS_MESSAGES[step] || "Converting...";

    // Special handling for conversion complete - should transition to ready
    if (step === "CONVERT_COMPLETE") {
      statusManager.setReady(message);
    } else {
      statusManager.setLoading(message, progress);
    }
  }

  /**
   * Show error with specific context
   */
  function showError(context, error) {
    const message = `${STATUS_MESSAGES[context] || "Error"}: ${
      error.message || error
    }`;
    statusManager.setError(message);
  }

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test status system functionality
   */
  function testStatusSystem() {
    logInfo("🧪 Testing Status System...");

    const tests = {
      managerExists: () => !!statusManager,

      initialisation: () => statusManager.isInitialised,

      domElementsConnected: () => {
        return (
          !!document.getElementById("statusDot") &&
          !!document.getElementById("statusText")
        );
      },

      statusUpdate: () => {
        const oldStatus = statusManager.getCurrentStatus();
        statusManager.setLoading("Test message", 50);
        const newStatus = statusManager.getCurrentStatus();
        return (
          newStatus.message === "Test message" && newStatus.status === "loading"
        );
      },

      progressUpdate: () => {
        statusManager.setLoading("Progress test", 75);
        const progressBar = document.getElementById("statusProgressBar");
        return progressBar && progressBar.style.width === "75%";
      },

      readyStatus: () => {
        statusManager.setReady("Test ready");
        const status = statusManager.getCurrentStatus();
        return status.status === "ready";
      },

      errorStatus: () => {
        statusManager.setError("Test error");
        const status = statusManager.getCurrentStatus();
        return status.status === "error";
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    // Reset to ready state after testing
    statusManager.setReady();

    const success = passed === total;
    logInfo(`📊 Status System: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      currentStatus: statusManager.getCurrentStatus(),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main manager instance
    manager: statusManager,

    // Core functionality
    initialise() {
      return statusManager.initialise();
    },

    updateStatus(status, message, progress) {
      return statusManager.updateStatus(status, message, progress);
    },

    // Convenience methods
    setLoading(message, progress) {
      return statusManager.setLoading(message, progress);
    },

    setReady(message) {
      return statusManager.setReady(message);
    },

    setError(message) {
      return statusManager.setError(message);
    },

    showTemporaryStatus(message, duration) {
      return statusManager.showTemporaryStatus(message, duration);
    },

    showProcessing(message) {
      return statusManager.showProcessing(message);
    },

    hideProcessing() {
      return statusManager.hideProcessing();
    },

    // Predefined sequences
    updateInitialisationStatus,
    updateConversionStatus,
    showError,

    // Status information
    getCurrentStatus() {
      return statusManager.getCurrentStatus();
    },

    isReady() {
      return statusManager.getCurrentStatus().status === "ready";
    },

    reset() {
      return statusManager.reset();
    },

    // Constants
    STATUS_MESSAGES,

    // Testing
    testStatusSystem,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.StatusManager = StatusManager;
