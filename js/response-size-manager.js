/**
 * @fileoverview Response Size Manager - Phase 4.5 Implementation
 * Handles large AI responses with embedded base64 content
 * Provides UI controls for viewing summaries, full content, or downloading
 * Integrates with ResultsManager for content filtering and display
 */

import { CONFIG } from "./config.js";

// Logging configuration (Phase 4.3+ standard pattern)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(msg, ...args) {
  if (shouldLog(0)) console.error(`[ResponseSizeManager] ${msg}`, ...args);
}
function logWarn(msg, ...args) {
  if (shouldLog(1)) console.warn(`[ResponseSizeManager] ${msg}`, ...args);
}
function logInfo(msg, ...args) {
  if (shouldLog(2)) console.log(`[ResponseSizeManager] ${msg}`, ...args);
}
function logDebug(msg, ...args) {
  if (shouldLog(3)) console.log(`[ResponseSizeManager] ${msg}`, ...args);
}

export class ResponseSizeManager {
  constructor() {
    this.currentResponse = null;
    this.displayMode = "summary"; // 'summary' | 'full'
    this.isInitialised = false;

    // DOM elements
    this.container = null;
    this.sizeValue = null;
    this.summaryBtn = null;
    this.fullBtn = null;
    this.downloadBtn = null;
    this.previewArea = null;
    this.previewStatus = null;

    // Thresholds from config (defensive programming)
    this.sizeThreshold = CONFIG?.FILE_UPLOAD?.RESPONSE_SIZE_WARNING || 1048576; // 1MB
    this.maxDisplay = CONFIG?.FILE_UPLOAD?.MAX_RESPONSE_DISPLAY || 5242880; // 5MB

    logInfo("Initialised with thresholds", {
      warning: this.formatSize(this.sizeThreshold),
      max: this.formatSize(this.maxDisplay),
    });
  }

  /**
   * Initialise the response size manager
   * @returns {boolean} Success status
   */
  initialise() {
    logDebug("Starting initialisation");

    try {
      // Find DOM elements (defensive)
      this.container = document.getElementById("response-management");
      this.sizeValue = document.getElementById("response-size-value");
      this.summaryBtn = document.getElementById("btn-show-summary");
      this.fullBtn = document.getElementById("btn-show-full");
      this.downloadBtn = document.getElementById("btn-download-response");
      this.previewArea = document.getElementById("response-preview");
      this.previewStatus = document.getElementById("preview-status");

      if (!this.container) {
        logError("Required DOM elements not found");
        return false;
      }

      // Set up event listeners
      this.setupEventListeners();

      // Listen for large response events from ResultsManager
      window.addEventListener("large-response-detected", (event) => {
        this.handleLargeResponse(event.detail);
      });

      // Listen for full response requests
      window.addEventListener("request-full-response", (event) => {
        this.handleFullResponseRequest(event.detail);
      });

      this.isInitialised = true;
      logInfo("Initialisation complete");
      return true;
    } catch (error) {
      logError("Initialisation failed:", error);
      return false;
    }
  }

  /**
   * Set up event listeners for buttons
   */
  setupEventListeners() {
    if (!this.summaryBtn || !this.fullBtn || !this.downloadBtn) {
      logWarn("Some buttons not found for event listeners");
      return;
    }

    // Summary button
    this.summaryBtn.addEventListener("click", () => {
      this.setDisplayMode("summary");
    });

    // Full response button
    this.fullBtn.addEventListener("click", () => {
      this.setDisplayMode("full");
    });

    // Download button
    this.downloadBtn.addEventListener("click", () => {
      this.downloadResponse();
    });

    // Keyboard navigation
    this.container?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hide();
      }
    });

    logDebug("Event listeners set up successfully");
  }

  /**
   * Handle large response detection
   * @param {Object} responseData - Response data from ResultsManager
   */
  handleLargeResponse(responseData) {
    logInfo("Handling large response", {
      size: responseData?.size,
      hasEmbedded: responseData?.hasEmbeddedContent,
      truncated: responseData?.truncated,
    });

    // Defensive validation
    if (!responseData || typeof responseData !== "object") {
      logWarn("Invalid response data received");
      return;
    }

    this.currentResponse = responseData;
    this.show();
    this.updateDisplay();
  }

  /**
   * Show the response management controls
   */
  show() {
    if (!this.container) {
      logWarn("Cannot show - container not available");
      return;
    }

    this.container.hidden = false;

    // Update size display
    if (this.sizeValue && this.currentResponse) {
      this.sizeValue.textContent = `(${this.formatSize(
        this.currentResponse.size
      )})`;
    }

    // Announce to screen readers
    if (window.notifyInfo) {
      window.notifyInfo(
        "Large response detected. Options available for viewing."
      );
    }

    logDebug("Response management UI shown");
  }

  /**
   * Hide the response management controls
   */
  hide() {
    if (this.container) {
      this.container.hidden = true;
      logDebug("Response management UI hidden");
    }
  }

  /**
   * Set display mode (summary or full)
   * @param {string} mode - 'summary' or 'full'
   */
  setDisplayMode(mode) {
    if (!["summary", "full"].includes(mode)) {
      logWarn("Invalid display mode:", mode);
      return;
    }

    this.displayMode = mode;

    // Update button states (defensive)
    this.summaryBtn?.setAttribute("aria-pressed", mode === "summary");
    this.fullBtn?.setAttribute("aria-pressed", mode === "full");

    // Update display
    this.updateDisplay();

    // Notify user
    const message =
      mode === "summary" ? "Showing response summary" : "Showing full response";

    if (window.notifyInfo) {
      window.notifyInfo(message);
    }

    logDebug("Display mode changed", { mode });
  }

  /**
   * Update the response display based on current mode
   */
  updateDisplay() {
    if (!this.currentResponse) {
      logWarn("No current response to display");
      return;
    }

    const resultsContent = document.querySelector(".results-content");
    if (!resultsContent) {
      logWarn("Results content area not found");
      return;
    }

    if (this.displayMode === "summary") {
      // Show filtered/truncated content
      resultsContent.innerHTML = this.currentResponse.content || "";

      // Show preview info
      if (this.previewArea && this.currentResponse.summary) {
        this.previewArea.hidden = false;
        this.previewStatus.textContent = this.currentResponse.summary;
      }

      logDebug("Summary display updated");
    } else {
      // Show full content (with warning)
      const warning = this.currentResponse.size > this.maxDisplay;

      if (warning && window.notifyWarning) {
        window.notifyWarning(
          "Displaying large response may affect performance"
        );
      }

      // Request full content from ResultsManager
      window.dispatchEvent(
        new CustomEvent("request-full-response", {
          detail: { responseId: this.currentResponse.id },
        })
      );

      logDebug("Full response requested");
    }
  }

  /**
   * Handle full response request
   * @param {Object} detail - Request details
   */
  handleFullResponseRequest(detail) {
    logDebug("Handling full response request:", detail);

    if (this.currentResponse?.originalContent) {
      const resultsContent = document.querySelector(".results-content");
      if (resultsContent) {
        resultsContent.innerHTML = this.currentResponse.originalContent;
      }
    }
  }

  /**
   * Download the response as a file
   */
  downloadResponse() {
    if (!this.currentResponse) {
      logWarn("No current response to download");
      return;
    }

    logInfo("Downloading response");

    try {
      // Get content for download (prefer original)
      const content =
        this.currentResponse.originalContent ||
        this.currentResponse.content ||
        "No content available";

      // Create blob from response content
      const blob = new Blob([content], { type: "text/plain" });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai_response_${Date.now()}.txt`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      if (window.notifyInfo) {
        window.notifyInfo("Response downloaded successfully");
      }
    } catch (error) {
      logError("Download failed:", error);
      if (window.notifyWarning) {
        window.notifyWarning("Download failed. Please try again.");
      }
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    if (!bytes || typeof bytes !== "number") return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Create test interface for console debugging
   */
  createTestInterface() {
    // Test function for checking manager state
    window.testResponseManager = () => {
      const tests = {
        initialised: this.isInitialised,
        domElements: {
          container: !!this.container,
          buttons: !!(this.summaryBtn && this.fullBtn && this.downloadBtn),
          preview: !!this.previewArea,
          sizeValue: !!this.sizeValue,
        },
        currentState: {
          hasResponse: !!this.currentResponse,
          displayMode: this.displayMode,
          responseSize: this.currentResponse?.size,
          containerVisible: this.container ? !this.container.hidden : false,
        },
        thresholds: {
          warning: this.formatSize(this.sizeThreshold),
          max: this.formatSize(this.maxDisplay),
        },
      };

      console.log("Response Manager Tests:", tests);
      return tests;
    };

    // Simulate large response for testing
    window.simulateLargeResponse = (sizeMB = 2) => {
      const size = sizeMB * 1024 * 1024;
      const mockResponse = {
        size,
        content: `[Filtered content - ${this.formatSize(
          size
        )}]\n\nThis is a simulated large response that has been filtered to remove embedded content.`,
        originalContent:
          "A".repeat(Math.min(size, 1000)) +
          `\n\n[Simulated content totaling ${this.formatSize(size)}]`,
        hasEmbeddedContent: true,
        truncated: true,
        summary: `Response contains simulated large content (${this.formatSize(
          size
        )})`,
        id: Date.now(),
      };

      this.handleLargeResponse(mockResponse);
      console.log("Simulated large response:", {
        size: this.formatSize(mockResponse.size),
        truncated: mockResponse.truncated,
        hasEmbedded: mockResponse.hasEmbeddedContent,
      });

      return mockResponse;
    };

    // Test display mode switching
    window.testDisplayModes = () => {
      console.log("Testing display mode: summary");
      this.setDisplayMode("summary");

      setTimeout(() => {
        console.log("Testing display mode: full");
        this.setDisplayMode("full");
      }, 2000);
    };

    // Check current response state
    window.checkResponseState = () => {
      const state = {
        hasResponse: !!this.currentResponse,
        displayMode: this.displayMode,
        containerVisible: this.container ? !this.container.hidden : false,
        buttonStates: {
          summaryPressed: this.summaryBtn?.getAttribute("aria-pressed"),
          fullPressed: this.fullBtn?.getAttribute("aria-pressed"),
        },
      };

      console.log("Current Response State:", state);
      return state;
    };

    logInfo(
      "Test interface created - use testResponseManager(), simulateLargeResponse(), testDisplayModes(), checkResponseState()"
    );
  }
}

// Export singleton instance following project pattern
export const responseSizeManager = new ResponseSizeManager();
