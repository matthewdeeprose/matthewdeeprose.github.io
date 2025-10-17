/**
 * MathPix Download Manager - UI Integration
 * Phase 5: User Experience & Real Integration
 *
 * Manages download button visibility and coordinates with MathPixTotalDownloader
 * to create comprehensive ZIP archives of MathPix API interactions.
 */

// Logging configuration
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
    console.error(`[DownloadManager] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[DownloadManager] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[DownloadManager] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[DownloadManager] ${message}`, ...args);
}

// Imports
import MathPixBaseModule from "../../core/mathpix-base-module.js";
import MathPixTotalDownloader from "../../core/mathpix-total-downloader.js";

/**
 * MathPix Download Manager
 * Handles UI integration for Total Downloader functionality
 */
class MathPixDownloadManager extends MathPixBaseModule {
  constructor(controller) {
    super(controller);

    logInfo("Initialising Download Manager...");

    // State management
    this.downloader = null;
    this.isDownloading = false;
    this.currentApiType = null; // 'pdf', 'text', or 'strokes'

    // UI elements (dual-button architecture)
    this.buttonElements = {
      // PDF Results button
      pdfSection: null,
      pdfButton: null,
      pdfProgressDiv: null,
      pdfStatusSpan: null,

      // Text/Strokes Results button
      textSection: null,
      textButton: null,
      textProgressDiv: null,
      textStatusSpan: null,
    };
  }

  /**
   * Initialise the download manager
   * Sets up UI elements and event listeners
   */
  initialize() {
    logInfo("Initialization starting...");

    try {
      // Cache DOM elements for both button locations
      this.cacheElements();

      // Verify elements were found
      if (!this.verifyElements()) {
        logError("Failed to cache required DOM elements");
        return false;
      }

      // Setup event listeners
      this.attachEventListeners();

      // NEW: Create TotalDownloader instance
      this.downloader = new MathPixTotalDownloader(this.controller);
      const initSuccess = this.downloader.initialize();

      if (!initSuccess) {
        logError("TotalDownloader initialization failed");
        return false;
      }

      logInfo("Initialization complete");
      return true;
    } catch (error) {
      logError("Initialization failed:", error);
      return false;
    }
  }

  /**
   * Cache DOM elements for both button locations
   */
  cacheElements() {
    logDebug("Caching DOM elements...");

    // PDF Results button elements
    this.buttonElements.pdfSection = document.getElementById(
      "mathpix-download-section-pdf"
    );
    this.buttonElements.pdfButton = document.getElementById(
      "mathpix-download-all-btn-pdf"
    );
    this.buttonElements.pdfProgressDiv = document.getElementById(
      "mathpix-download-progress-pdf"
    );
    this.buttonElements.pdfStatusSpan = document.getElementById(
      "mathpix-download-status-pdf"
    );

    // Text/Strokes Results button elements
    this.buttonElements.textSection = document.getElementById(
      "mathpix-download-section-text"
    );
    this.buttonElements.textButton = document.getElementById(
      "mathpix-download-all-btn-text"
    );
    this.buttonElements.textProgressDiv = document.getElementById(
      "mathpix-download-progress-text"
    );
    this.buttonElements.textStatusSpan = document.getElementById(
      "mathpix-download-status-text"
    );

    logDebug("Element caching complete");
  }

  /**
   * Verify all required elements were found
   */
  verifyElements() {
    const pdfElementsValid =
      this.buttonElements.pdfSection &&
      this.buttonElements.pdfButton &&
      this.buttonElements.pdfProgressDiv &&
      this.buttonElements.pdfStatusSpan;

    const textElementsValid =
      this.buttonElements.textSection &&
      this.buttonElements.textButton &&
      this.buttonElements.textProgressDiv &&
      this.buttonElements.textStatusSpan;

    if (!pdfElementsValid) {
      logWarn("PDF button elements not found");
    }

    if (!textElementsValid) {
      logWarn("Text/Strokes button elements not found");
    }

    const allValid = pdfElementsValid && textElementsValid;
    logDebug("Element verification:", allValid ? "PASS" : "FAIL");

    return allValid;
  }

  /**
   * Attach event listeners to buttons
   */
  attachEventListeners() {
    logDebug("Attaching event listeners...");

    if (this.buttonElements.pdfButton) {
      this.buttonElements.pdfButton.addEventListener("click", () =>
        this.handleDownloadClick("pdf")
      );
      logDebug("PDF button listener attached");
    }

    if (this.buttonElements.textButton) {
      this.buttonElements.textButton.addEventListener("click", () =>
        this.handleDownloadClick("text")
      );
      logDebug("Text/Strokes button listener attached");
    }
  }

  /**
   * Show download button for specific API type
   * @param {string} apiType - 'pdf', 'text', or 'strokes'
   */
  showDownloadButton(apiType) {
    logInfo("Showing download button for:", apiType);

    this.currentApiType = apiType;

    if (apiType === "pdf") {
      // Show PDF button, hide Text/Strokes button
      if (this.buttonElements.pdfSection) {
        this.buttonElements.pdfSection.style.display = "block";
      }
      if (this.buttonElements.textSection) {
        this.buttonElements.textSection.style.display = "none";
      }
    } else {
      // Show Text/Strokes button, hide PDF button
      if (this.buttonElements.textSection) {
        this.buttonElements.textSection.style.display = "block";
      }
      if (this.buttonElements.pdfSection) {
        this.buttonElements.pdfSection.style.display = "none";
      }
    }
  }

  /**
   * Hide all download buttons
   */
  hideDownloadButton() {
    logInfo("Hiding all download buttons");

    if (this.buttonElements.pdfSection) {
      this.buttonElements.pdfSection.style.display = "none";
    }

    if (this.buttonElements.textSection) {
      this.buttonElements.textSection.style.display = "none";
    }

    this.currentApiType = null;
  }

  /**
   * Disable download button (during processing)
   */
  disableDownloadButton() {
    logDebug("Disabling download buttons");

    if (this.buttonElements.pdfButton) {
      this.buttonElements.pdfButton.disabled = true;
    }

    if (this.buttonElements.textButton) {
      this.buttonElements.textButton.disabled = true;
    }
  }

  /**
   * Enable download button
   */
  enableDownloadButton() {
    logDebug("Enabling download buttons");

    if (this.buttonElements.pdfButton) {
      this.buttonElements.pdfButton.disabled = false;
    }

    if (this.buttonElements.textButton) {
      this.buttonElements.textButton.disabled = false;
    }
  }

  /**
   * Handle download button click - Create and download ZIP archive
   * @param {string} apiType - Which button was clicked ('pdf' or 'text')
   */
  async handleDownloadClick(apiType) {
    logInfo("Download initiated for:", apiType);

    if (this.isDownloading) {
      logWarn("Download already in progress");
      return;
    }

    this.isDownloading = true;
    this.disableDownloadButton();

    try {
      // Show initial progress
      this.updateProgress("Preparing download...", apiType);

      // Collect real data from controller
      logInfo("Collecting data from controller...");

      const sourceState = this.downloader.getRealSourceState(this.controller);
      const response = this.downloader.getRealResponse(this.controller);
      const request = this.downloader.getRealRequest(this.controller);
      const debugData = this.downloader.getRealDebugData(this.controller);

      // Validate collected data
      if (!response) {
        throw new Error(
          "No API response available. Please process an image first."
        );
      }

      // Update progress
      this.updateProgress("Creating archive...", apiType);

      // Create the archive
      logInfo("Calling TotalDownloader.createArchive()...");
      await this.downloader.createArchive({
        sourceState,
        response,
        request,
        debugData,
      });

      // Success!
      this.hideProgress(apiType);

      if (typeof notifySuccess === "function") {
        notifySuccess("Archive downloaded successfully!");
      }

      logInfo("✓ Download complete");
    } catch (error) {
      logError("Download failed:", error);

      this.hideProgress(apiType);

      if (typeof notifyError === "function") {
        notifyError(`Download failed: ${error.message}`);
      } else {
        alert(`Download failed: ${error.message}`);
      }
    } finally {
      this.isDownloading = false;
      this.enableDownloadButton();
    }
  }
  /**
   * Update progress message
   * @param {string} message - Progress message
   * @param {string} apiType - Which progress indicator to update
   */
  updateProgress(message, apiType) {
    logInfo("Progress:", message);

    const progressDiv =
      apiType === "pdf"
        ? this.buttonElements.pdfProgressDiv
        : this.buttonElements.textProgressDiv;
    const statusSpan =
      apiType === "pdf"
        ? this.buttonElements.pdfStatusSpan
        : this.buttonElements.textStatusSpan;

    if (progressDiv && statusSpan) {
      progressDiv.style.display = "block";
      statusSpan.textContent = message;
    }
  }

  /**
   * Hide progress display
   * @param {string} apiType - Which progress indicator to hide
   */
  hideProgress(apiType) {
    const progressDiv =
      apiType === "pdf"
        ? this.buttonElements.pdfProgressDiv
        : this.buttonElements.textProgressDiv;

    if (progressDiv) {
      progressDiv.style.display = "none";
    }
  }
}

// Global exposure for testing
window.MathPixDownloadManager = MathPixDownloadManager;

export default MathPixDownloadManager;
