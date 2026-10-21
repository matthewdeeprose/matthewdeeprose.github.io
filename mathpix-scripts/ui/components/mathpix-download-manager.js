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

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
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

// S6-1e: the sentence that says where the person now is
const RESUME_OPENED_SENTENCE = "Your document is now open in Resume mode.";

// SV-1 (SV-D1): the decision shown after a successful hand-over
const ARCHIVE_SAVE_TITLE = "Open in Resume mode";
const ARCHIVE_UNSAVED_SENTENCE =
  "It has not been saved. Download the ZIP now so you can come back later without running MathPix again.";
const ARCHIVE_SAVE_NOW_TEXT = "Download ZIP now";
const ARCHIVE_SAVE_LATER_TEXT = "Not now";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * S6-1e: the Health Check finding as one sentence (the dialog's finding without
 * its question), for the Upload-to-Resume line.
 * @param {{expected: number, actualInZip: number}} health
 * @returns {string}
 */
function composeHealthSentence(health) {
  const missing = health.expected - health.actualInZip;
  const noun = health.expected === 1 ? "picture" : "pictures";
  return `${missing} of ${health.expected} ${noun} with saved data did not reach the archive.`;
}

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
      "mathpix-download-section-pdf",
    );
    this.buttonElements.pdfButton = document.getElementById(
      "mathpix-download-all-btn-pdf",
    );
    this.buttonElements.pdfProgressDiv = document.getElementById(
      "mathpix-download-progress-pdf",
    );
    this.buttonElements.pdfStatusSpan = document.getElementById(
      "mathpix-download-status-pdf",
    );

    // Text/Strokes Results button elements
    this.buttonElements.textSection = document.getElementById(
      "mathpix-download-section-text",
    );
    this.buttonElements.textButton = document.getElementById(
      "mathpix-download-all-btn-text",
    );
    this.buttonElements.textProgressDiv = document.getElementById(
      "mathpix-download-progress-text",
    );
    this.buttonElements.textStatusSpan = document.getElementById(
      "mathpix-download-status-text",
    );

    // S6-1e: the Open in Resume mode control beside the PDF download-all.
    // S6-1g: the text section has none, because a Text or Strokes result holds no .mmd.
    this.resumeButtons = [
      document.getElementById("mathpix-open-in-resume-btn-pdf"),
    ].filter(Boolean);

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
   * CRITICAL FIX: Uses data attribute guard to prevent duplicate listeners
   * when init() is called multiple times (e.g., repeated tool switching).
   * Each button tracks whether a listener is already attached via
   * data-download-listener-attached, ensuring only ONE handler exists
   * regardless of how many MathPixDownloadManager instances are created.
   */
  attachEventListeners() {
    logDebug("Attaching event listeners...");

    if (this.buttonElements.pdfButton) {
      if (this.buttonElements.pdfButton.dataset.downloadListenerAttached) {
        logDebug("PDF button listener already attached, skipping");
      } else {
        this.buttonElements.pdfButton.addEventListener("click", () =>
          this.handleDownloadClick("pdf"),
        );
        this.buttonElements.pdfButton.dataset.downloadListenerAttached = "true";
        logDebug("PDF button listener attached");
      }
    }

    if (this.buttonElements.textButton) {
      if (this.buttonElements.textButton.dataset.downloadListenerAttached) {
        logDebug("Text/Strokes button listener already attached, skipping");
      } else {
        this.buttonElements.textButton.addEventListener("click", () =>
          this.handleDownloadClick("text"),
        );
        this.buttonElements.textButton.dataset.downloadListenerAttached =
          "true";
        logDebug("Text/Strokes button listener attached");
      }
    }

    // S6-1e: same guard, so repeated init() never stacks a second handler
    (this.resumeButtons || []).forEach((button) => {
      if (button.dataset.resumeListenerAttached) return;
      button.addEventListener("click", () => this.handleOpenInResumeClick());
      button.dataset.resumeListenerAttached = "true";
    });
  }

  /**
   * S6-1e (B-D2): hand the Upload result to Resume mode from a control, never
   * automatically. Raises ONE line through the notification system (which
   * speaks it once through the shared announcer), then moves focus to the
   * Resume heading, because the Manage images button is disabled until the
   * restore settles. The bridge itself raises nothing.
   */
  async handleOpenInResumeClick() {
    const buttons = this.resumeButtons || [];
    // The disabled control IS the guard: a press while the hand-over runs does nothing
    if (buttons.some((b) => b.disabled)) return;
    buttons.forEach((b) => {
      b.disabled = true;
    });

    const modeSwitcher = this.controller?.modeSwitcher;
    let line = "";
    let severity = "success";
    let moved = false;
    let built = null; // SV-1: the archive the bridge built, held for the save decision

    try {
      const restorer = window.getMathPixSessionRestorer?.();
      if (!restorer?.bridgeUploadResultToResume) {
        throw new Error("Resume mode is not ready yet.");
      }
      const { report, health, restored, blob, filename } = await restorer.bridgeUploadResultToResume();

      if (!restored || restored.outcome === "error" || restored.outcome === "refused") {
        // The error line only, and the person stays where they were
        line = (restored && restored.line) || "The document could not be opened in Resume mode.";
        severity = "error";
      } else if (restored.outcome === "choice-required") {
        line = restored.line;
        severity = "warning";
      } else {
        const parts = [restored.line, RESUME_OPENED_SENTENCE];
        if (report && report.missing && report.missing.length > 0) {
          parts.push(this.downloader.composePictureLossSentence(report));
          severity = "warning";
        }
        if (health) {
          parts.push(composeHealthSentence(health));
          severity = "warning";
        }
        line = parts.join(" ");
        moved = true;
        built = { blob, filename };
      }
    } catch (error) {
      logError("Open in Resume mode failed:", error);
      line = error && error.message ? error.message : "The document could not be opened in Resume mode.";
      severity = "error";
    } finally {
      buttons.forEach((b) => {
        b.disabled = false;
      });
    }

    // On any failure the person must still be in Upload mode
    if (severity === "error" && modeSwitcher?.getCurrentMode?.() !== "upload") {
      modeSwitcher?.switchToUploadMode?.({ quiet: true });
    }

    // SV-1 (SV-D1): a successful hand-over ends in a decision, not a toast. The
    // composed outcome rides in the dialog, which a person has to answer, so no
    // polite line is raised beside it (placement contract C10, E1).
    if (moved) {
      await this.offerArchiveSave({ line, blob: built.blob, filename: built.filename });
      return;
    }

    // ONE raise. A warning a person has to read stays until dismissed.
    if (severity === "error") window.notifyError?.(line);
    else if (severity === "warning") window.notifyWarning?.(line, { duration: 0 });
    else window.notifySuccess?.(line);

    if (document.activeElement === document.body) {
      // the pressed button was disabled while focused, so focus fell to body
      buttons.find((b) => b.offsetParent !== null)?.focus();
    }
  }

  /**
   * SV-1 (SV-D1): after a successful hand-over the archive exists only in
   * memory. Ask whether to download the ZIP now; "Not now" leaves the visible
   * unsaved notice and the leave-page prompt in place. Focus is set explicitly
   * after the dialog has closed, in BOTH branches, because the control that
   * opened it sits in the now-hidden Upload panel and the dialog's own focus
   * return lands on the main region.
   * @param {{line: string, blob: Blob, filename: string}} outcome
   */
  async offerArchiveSave({ line, blob, filename }) {
    const restorer = window.getMathPixSessionRestorer?.();
    let saveNow = false;

    try {
      const body = `<p>${escapeHtml(line)}</p><p>${ARCHIVE_UNSAVED_SENTENCE}</p>`;
      const answer = await window.UniversalModal.custom(body, {
        title: ARCHIVE_SAVE_TITLE,
        buttons: [
          { text: ARCHIVE_SAVE_NOW_TEXT, type: "primary", action: "confirm" },
          { text: ARCHIVE_SAVE_LATER_TEXT, type: "secondary", action: "cancel" },
        ],
        allowBackgroundClose: false,
      });
      saveNow = answer === true;
    } catch (error) {
      logError("The save decision could not be shown:", error);
    }

    // the dialog's own promise resolves after its close has finished, so this lands last
    await Promise.resolve();

    // SV-3 (SV-D2): on success the outcome is carried by the element focus lands on,
    // with no polite raise. A raise 4 ms before a focus move was dropped (SV-2).
    let focusTarget = document.getElementById("resume-working-heading");

    if (saveNow) {
      try {
        this.downloader.triggerDownload(blob, filename);
        restorer?.setArchiveUnsaved(false);
        const status = document.getElementById("resume-save-status");
        if (status) {
          status.textContent = `ZIP downloaded as ${filename}.`;
          status.hidden = false;
          focusTarget = status;
        } else {
          window.notifySuccess?.(`ZIP downloaded as ${filename}.`);
        }
      } catch (error) {
        logError("The ZIP could not be downloaded:", error);
        restorer?.showUnsavedNotice();
        window.notifyError?.("The ZIP could not be downloaded. Use Download ZIP in the notice below the heading to try again.");
      }
    } else {
      restorer?.showUnsavedNotice();
    }

    focusTarget?.focus();
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

      // Collect lines data for confidence visualisation (Phase 3.2)
      let linesData = null;
      if (
        apiType === "pdf" &&
        this.controller.pdfResultRenderer?.getLinesData
      ) {
        linesData = this.controller.pdfResultRenderer.getLinesData();
        if (linesData) {
          logInfo("Lines data collected for archive", {
            pageCount: linesData.pages?.length || 0,
          });
        }
      }

      // Validate collected data
      if (!response) {
        throw new Error(
          "No API response available. Please process an image first.",
        );
      }

      // Update progress
      this.updateProgress("Creating archive...", apiType);

      // Create the archive
      logInfo("Calling TotalDownloader.createArchive()...");
      // F-L Phase 2 — createArchive now returns:
      //   - { filename, imageCount } on success
      //   - null when the user cancels at the Document Health Check modal
      //     (incomplete-archive confirmation)
      const archiveResult = await this.downloader.createArchive({
        sourceState,
        response,
        request,
        debugData,
        linesData, // Include lines data for confidence visualisation
      });

      this.hideProgress(apiType);

      if (archiveResult === null) {
        // User declined to save an incomplete archive via the Health Check
        // modal. createArchive already fired notifyInfo("Download cancelled.")
        // — nothing more to surface here.
        logInfo("✓ Download cancelled by user");
        return;
      }

      // F-L Phase 2 — createArchive now fires its own positive
      // notifySuccess with image count ("Saved successfully — includes N
      // image(s)" or "Saved successfully"). The generic "Archive downloaded
      // successfully!" toast that used to fire here is removed to avoid a
      // double-notification.
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
