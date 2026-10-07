/**
 * @fileoverview MathPix Convert UI Controller
 * @module MathPixConvertUI
 * @requires mathpix-convert-api-client.js
 * @version 1.0.0
 * @since 6.2.0
 *
 * @description
 * Manages the Convert section UI in PDF results, providing format selection,
 * conversion progress display, and download functionality for converted documents.
 *
 * Key Features:
 * - Accessible format selection checkboxes with fieldset grouping
 * - Real-time progress tracking during conversion
 * - Download buttons for completed conversions
 * - Error display with recovery suggestions
 * - Integration with MMD Editor for edited content
 * - WCAG 2.2 AA compliance throughout
 *
 * Integration:
 * - Uses Phase 6.1 Convert API Client for conversions
 * - Reads MMD content from Editor (5.1), Persistence (5.2), or DOM fallback
 * - Integrates with existing notification system
 * - Coordinates with PDF Result Renderer for visibility
 *
 * @accessibility
 * - Full keyboard navigation support
 * - Screen reader compatible with ARIA live regions
 * - Focus management for modal-like interactions
 * - High contrast and reduced motion support
 */

// ============================================================================
// Logging Configuration
// ============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if logging should occur based on configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should proceed
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages with module prefix
 * @param {string} message - Error message
 * @param {...*} args - Additional arguments
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[ConvertUI] ${message}`, ...args);
}

/**
 * Logs warning messages with module prefix
 * @param {string} message - Warning message
 * @param {...*} args - Additional arguments
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ConvertUI] ${message}`, ...args);
}

/**
 * Logs informational messages with module prefix
 * @param {string} message - Info message
 * @param {...*} args - Additional arguments
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ConvertUI] ${message}`, ...args);
}

/**
 * Logs debug messages with module prefix
 * @param {string} message - Debug message
 * @param {...*} args - Additional arguments
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ConvertUI] ${message}`, ...args);
}

// ============================================================================
// SVG Icons (from the shared icon library, icon-library.js)
// ============================================================================

/**
 * Convert UI icon names that the icon library holds under another name; the
 * drawings are the same. "box" is not aliased: it takes the library's own
 * box, which draws differently (MathPix polish parcel 9d).
 * @constant {Object.<string, string>}
 */
const LIBRARY_NAME_FOR = Object.freeze({
  docx: "document",
  latexPdf: "calculator",
  markdown: "windowContent",
  pptx: "projector",
  inbox: "tray",
});

let libraryMissingWarned = false;

/**
 * Get an SVG icon by name with accessibility attributes
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} [options] - Options
 * @param {string} [options.className] - Additional CSS class
 * @returns {string} SVG HTML string with aria-hidden
 */
function getIcon(name, options = {}) {
  // icon-library.js can load after this file, so look it up per call, never at load.
  const library = window.IconLibrary;
  if (!library || typeof library.getIcon !== "function") {
    if (!libraryMissingWarned) {
      logWarn("Icon library (window.IconLibrary) is not loaded; icons render empty");
      libraryMissingWarned = true;
    }
    return "";
  }

  return library.getIcon(LIBRARY_NAME_FOR[name] || name, options);
}

/**
 * Get format icon for download buttons
 * @param {string} format - Format key (e.g., 'docx', 'pdf', 'tex.zip')
 * @returns {string} SVG icon HTML
 */
function getFormatIcon(format) {
  const formatIconMap = {
    docx: "docx",
    pdf: "pdf",
    "tex.zip": "box",
    "latex.pdf": "latexPdf",
    html: "html",
    md: "markdown",
    pptx: "pptx",
    "mmd.zip": "box",
    "md.zip": "box",
    "html.zip": "box",
  };

  const iconName = formatIconMap[format] || "inbox";
  return getIcon(iconName);
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * MathPix Convert UI Controller
 * @class MathPixConvertUI
 * @description Manages the convert section UI for exporting MMD to various formats
 */
class MathPixConvertUI {
  /**
   * Creates a new MathPixConvertUI instance
   * @constructor
   */
  constructor() {
    /**
     * Cached DOM element references
     * @type {Object}
     */
    this.elements = {};

    /**
     * Flag indicating if elements have been cached
     * @type {boolean}
     */
    this.elementsCached = false;

    /**
     * Flag indicating if UI has been initialised
     * @type {boolean}
     */
    this.isInitialised = false;

    /**
     * Flag indicating if conversion is in progress
     * @type {boolean}
     */
    this.isConverting = false;

    /**
     * Active conversion ID for cancellation
     * @type {string|null}
     */
    this.activeConversionId = null;

    /**
     * Completed download blobs
     * @type {Map<string, Blob>}
     */
    this.completedDownloads = new Map();

    /**
     * Original filename for downloads
     * @type {string}
     */
    this.baseFilename = "document";

    logDebug("MathPixConvertUI instance created");
  }

  /**
   * Initialise the UI controller
   * @returns {boolean} True if initialisation successful
   */
  init() {
    if (this.isInitialised) {
      logDebug("Already initialised");
      return true;
    }

    try {
      this.cacheElements();

      if (!this.elementsCached) {
        logError("Failed to cache elements");
        return false;
      }

      this.attachEventListeners();
      this.isInitialised = true;
      logInfo("MathPixConvertUI initialised successfully");
      return true;
    } catch (error) {
      logError("Initialisation failed:", error);
      return false;
    }
  }

  /**
   * Cache DOM element references (lazy initialisation)
   * @private
   */
  cacheElements() {
    const elementIds = [
      "mathpix-convert-section",
      "mathpix-convert-btn",
      "mathpix-convert-cancel-btn",
      "convert-status",
      "mathpix-convert-progress",
      "mathpix-convert-progress-list",
      "mathpix-convert-downloads",
      "mathpix-download-buttons",
      "mathpix-convert-errors",
      "mathpix-convert-error-list",
    ];

    let allFound = true;

    elementIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      } else {
        logWarn(`Element not found: ${id}`);
        allFound = false;
      }
    });

    // Cache the format checkboxes
    this.elements.formatCheckboxes = document.querySelectorAll(
      'input[name="convert-format"]',
    );

    if (this.elements.formatCheckboxes.length === 0) {
      logWarn("No format checkboxes found");
      allFound = false;
    }

    this.elementsCached = allFound;
    logDebug("Elements cached:", {
      count: Object.keys(this.elements).length,
      allFound,
    });
  }

  /**
   * Attach event listeners to cached elements
   * @private
   */
  attachEventListeners() {
    // Select All checkbox functionality
    const selectAllCheckbox = document.getElementById(
      "convert-select-all-formats",
    );

    if (selectAllCheckbox) {
      // Handle Select All checkbox change
      selectAllCheckbox.addEventListener("change", () => {
        this.elements.formatCheckboxes?.forEach((checkbox) => {
          checkbox.checked = selectAllCheckbox.checked;
        });
        this.updateConvertButtonState();
      });
    }

    // Format checkbox change events
    this.elements.formatCheckboxes?.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        // Update Select All state based on individual checkboxes
        if (selectAllCheckbox) {
          const allChecked = Array.from(this.elements.formatCheckboxes).every(
            (cb) => cb.checked,
          );
          const someChecked = Array.from(this.elements.formatCheckboxes).some(
            (cb) => cb.checked,
          );
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }
        this.updateConvertButtonState();
      });
    });

    logDebug("Event listeners attached");
  }

  /**
   * Show the convert section
   * Called when MMD content becomes available
   */
  show() {
    if (!this.isInitialised) {
      this.init();
    }

    const section = this.elements["mathpix-convert-section"];
    if (section) {
      section.hidden = false;
      logInfo("Convert section shown");
    }
  }

  /**
   * Hide the convert section
   */
  hide() {
    const section = this.elements["mathpix-convert-section"];
    if (section) {
      section.hidden = true;
      logInfo("Convert section hidden");
    }
  }

  /**
   * Reset the UI to initial state
   */
  reset() {
    // Clear selections
    this.elements.formatCheckboxes?.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // Reset button states
    this.updateConvertButtonState();

    // Hide progress and downloads
    this.hideProgress();
    this.hideDownloads();
    this.hideErrors();

    // Clear status
    this.updateStatus("");

    // Reset state
    this.isConverting = false;
    this.activeConversionId = null;
    this.completedDownloads.clear();

    // Show/hide buttons
    const convertBtn = this.elements["mathpix-convert-btn"];
    const cancelBtn = this.elements["mathpix-convert-cancel-btn"];
    if (convertBtn) convertBtn.hidden = false;
    if (cancelBtn) cancelBtn.hidden = true;

    logInfo("Convert UI reset");
  }

  /**
   * Clear the previous document's converted files and their on-screen
   * status, keeping the ticked formats (parcel 10c). Unlike reset(), this
   * leaves the person's format choices alone and does not touch a
   * conversion in flight. It leaves the Convert button alone too: after
   * Process Another there is no MMD yet, so recomputing here disabled the
   * button, and nothing re-enables it when the new document arrives.
   */
  clearResults() {
    // Parcel O-04: a run still going belongs to the document being replaced.
    this._abandonRun();
    this.hideProgress();
    this.hideDownloads();
    this.hideErrors();
    this.updateStatus("");
    this.completedDownloads.clear();
    logInfo("Convert UI results cleared for a new document");
  }

  /**
   * Get currently selected format keys
   * @returns {string[]} Array of format keys
   */
  getSelectedFormats() {
    const selected = [];
    this.elements.formatCheckboxes?.forEach((checkbox) => {
      if (checkbox.checked) {
        selected.push(checkbox.value);
      }
    });
    return selected;
  }

  /**
   * Update convert button enabled state based on selection
   * @private
   */
  updateConvertButtonState() {
    const convertBtn = this.elements["mathpix-convert-btn"];
    if (!convertBtn) return;

    const selectedFormats = this.getSelectedFormats();
    const hasSelection = selectedFormats.length > 0;
    const hasMMD = !!this.getCurrentMMD();

    convertBtn.disabled = !hasSelection || !hasMMD || this.isConverting;

    logDebug("Button state updated:", {
      hasSelection,
      hasMMD,
      isConverting: this.isConverting,
      disabled: convertBtn.disabled,
    });
  }

  /**
   * Get current MMD content from editor or original source
   * @returns {string|null} MMD content or null if unavailable
   */
  getCurrentMMD() {
    // Priority 1: Try editor (Phase 5.1)
    try {
      const editor = window.getMathPixMMDEditor?.();
      if (editor?.hasContent?.()) {
        const content = editor.getContent();
        if (content && content.trim().length > 0) {
          logDebug("MMD content from editor:", content.length, "chars");
          return content;
        }
      }
    } catch (e) {
      logDebug("Editor not available:", e.message);
    }

    // Priority 2: Try persistence session (Phase 5.2)
    try {
      const persistence = window.getMathPixMMDPersistence?.();
      if (persistence?.hasSession?.()) {
        const content = persistence.session?.current;
        if (content && content.trim().length > 0) {
          logDebug("MMD content from persistence:", content.length, "chars");
          return content;
        }
      }
    } catch (e) {
      logDebug("Persistence not available:", e.message);
    }

    // Priority 3: Fallback to original MMD display element
    try {
      const mmdElement = document.getElementById("mathpix-pdf-content-mmd");
      const content = mmdElement?.textContent;
      if (content && content.trim().length > 0) {
        logDebug("MMD content from DOM:", content.length, "chars");
        return content;
      }
    } catch (e) {
      logDebug("DOM fallback failed:", e.message);
    }

    logWarn("No MMD content available");
    return null;
  }

  /**
   * Set base filename for downloads (from source document)
   * @param {string} filename - Original filename (may include extension)
   */
  setBaseFilename(filename) {
    if (filename && typeof filename === "string") {
      // Remove file extension (everything after last dot)
      let baseName = filename.replace(/\.[^/.]+$/, "");

      // Sanitise filename - remove unsafe characters but preserve readability
      baseName = baseName
        .replace(/[<>:"/\\|?*]/g, "-") // Replace unsafe chars
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens

      this.baseFilename = baseName || "document";
      logDebug("Base filename set:", this.baseFilename);
    }
  }

  /**
   * Start the conversion process
   * Main entry point called by button click
   */
  async startConversion() {
    if (this.isConverting) {
      logWarn("Conversion already in progress");
      return;
    }

    const selectedFormats = this.getSelectedFormats();
    if (selectedFormats.length === 0) {
      this.showError("Please select at least one format to convert to.");
      return;
    }

    const mmdContent = this.getCurrentMMD();
    if (!mmdContent) {
      this.showError("No MMD content available for conversion.");
      return;
    }

    // Get the API client
    const client = window.getMathPixConvertClient?.();
    if (!client) {
      this.showError(
        "Convert API client not available. Please refresh the page.",
      );
      return;
    }

    // Validate MMD content
    const validation = client.validateMMD(mmdContent);
    if (!validation.valid) {
      this.showError(validation.error);
      return;
    }

    // Start conversion
    this.isConverting = true;
    this.completedDownloads.clear();
    // Parcel O-04: this run's token; an abandoned run finds it out of date.
    this._runToken = (this._runToken || 0) + 1;
    const runToken = this._runToken;
    const isCurrentRun = () => this._runToken === runToken;

    // Parcel 10k: note focus before updateConvertButtonState() disables
    // the button, so the Cancel swap below can carry it.
    const convertHadFocus =
      document.activeElement === this.elements["mathpix-convert-btn"];

    // Update UI
    this.updateConvertButtonState();
    this.showCancelButton({ takeFocus: convertHadFocus });
    this.hideErrors();
    this.hideDownloads();
    this.showProgress(selectedFormats);
    this.updateStatus("Starting conversion...");

    logInfo("Starting conversion for formats:", selectedFormats);

    try {
      const results = await client.convertAndDownload(
        mmdContent,
        selectedFormats,
        {
          onStart: (conversionId) => {
            // Parcel O-04: abandoned before its id existed; stop it now.
            if (!isCurrentRun()) {
              client.cancelConversion(conversionId);
              return;
            }
            this.activeConversionId = conversionId;
            logDebug("Conversion started:", conversionId);
          },
          onProgress: (status) => {
            if (!isCurrentRun()) return; // Parcel O-04
            this.updateProgress(status);
          },
          onFormatComplete: async (format, blob) => {
            if (!isCurrentRun()) return; // Parcel O-04
            // Rename ZIP contents if applicable
            const processedBlob = await this.renameZipContents(blob, format);
            if (!isCurrentRun()) return; // Parcel O-04: abandoned during the rename
            this.onFormatComplete(format, processedBlob);
          },
          onComplete: (completionResult) => {
            if (!isCurrentRun()) return; // Parcel O-04
            this.onConversionComplete(completionResult);
          },
          onError: (error) => {
            logWarn("Format error:", error.message);
          },
        },
      );

      // Parcel O-04: an abandoned run stores, shows and says nothing.
      if (!isCurrentRun()) return;

      // Store results (also process ZIPs)
      for (const [format, blob] of results) {
        const processedBlob = await this.renameZipContents(blob, format);
        if (!isCurrentRun()) return; // Parcel O-04
        this.completedDownloads.set(format, processedBlob);
      }

      // Show downloads if any succeeded
      if (this.completedDownloads.size > 0) {
        this.showDownloads(this.completedDownloads);
      }
    } catch (error) {
      logError("Conversion failed:", error);
      // Parcel 10l: a Cancel is not a failure. Parcel O-04: nor is an abandon.
      if (error?.code !== "CANCELLED" && isCurrentRun()) {
        this.showError(`Conversion failed: ${error.message}`);
      }
    } finally {
      // Parcel O-04: an abandoned run leaves the page as the abandon left it,
      // and must not reset a newer run's state.
      if (isCurrentRun()) {
        this.isConverting = false;
        this.activeConversionId = null;
        this.updateConvertButtonState();
        this.hideCancelButton();
        this.hideProgress();
      }
    }
  }

  /**
   * Parcel O-04: abandon a conversion still running because its document has
   * been replaced. Stops the client polling (as Cancel does), puts the controls
   * back to idle and writes no status or toast; the new document's own load
   * already speaks. A late return finds its token out of date.
   * @private
   */
  _abandonRun() {
    if (!this.isConverting) return;
    this._runToken = (this._runToken || 0) + 1;

    const client = window.getMathPixConvertClient?.();
    if (client && this.activeConversionId) {
      client.cancelConversion(this.activeConversionId);
    }
    this.activeConversionId = null;
    this.isConverting = false;
    this.hideCancelButton();
    this.hideProgress();
    this.updateConvertButtonState();
    logInfo("Conversion abandoned: its document was replaced");
  }

  /**
   * Rename files inside a ZIP archive to use our preferred naming
   * @param {Blob} zipBlob - Original ZIP blob from API
   * @param {string} format - Format key (e.g., 'mmd.zip')
   * @returns {Promise<Blob>} - New ZIP blob with renamed contents
   * @private
   */
  async renameZipContents(zipBlob, format) {
    // Only process ZIP formats
    if (!format.endsWith(".zip")) {
      return zipBlob;
    }

    // Check JSZip availability
    if (typeof JSZip === "undefined") {
      logWarn("JSZip not available for ZIP content renaming");
      return zipBlob;
    }

    try {
      // Load the original ZIP
      const originalZip = await JSZip.loadAsync(zipBlob);
      const newZip = new JSZip();

      // Get the inner format extension (e.g., 'mmd' from 'mmd.zip')
      const innerFormat = format.replace(".zip", "");

      // Define which extensions are "main content" files to rename
      const mainContentExtensions = [".mmd", ".md", ".html", ".htm", ".tex"];

      // Process each file in the ZIP
      const filePromises = [];
      originalZip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const promise = zipEntry.async("blob").then((content) => {
            // Check if this is a main content file
            const ext = relativePath
              .substring(relativePath.lastIndexOf("."))
              .toLowerCase();
            const isMainContent = mainContentExtensions.includes(ext);

            let newFilename;
            if (isMainContent) {
              // Main content file - use our preferred name
              newFilename = `${this.baseFilename}-edit-converted${ext}`;
              logDebug(`Renamed ZIP content: ${relativePath} → ${newFilename}`);
            } else {
              // Keep other files (images, css, etc.) with original names
              newFilename = relativePath;
            }
            newZip.file(newFilename, content);
          });
          filePromises.push(promise);
        }
      });

      await Promise.all(filePromises);

      // Generate new ZIP
      const renamedZip = await newZip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      logInfo(`ZIP contents renamed for format: ${format}`);
      return renamedZip;
    } catch (error) {
      logWarn("Failed to rename ZIP contents, using original:", error);
      return zipBlob;
    }
  }

  /**
   * Cancel the active conversion
   */
  cancelConversion() {
    if (!this.isConverting || !this.activeConversionId) {
      logWarn("No active conversion to cancel");
      return;
    }

    const client = window.getMathPixConvertClient?.();
    if (client) {
      client.cancelConversion(this.activeConversionId);
    }

    this.isConverting = false;
    this.activeConversionId = null;
    this.updateStatus("Conversion cancelled");
    this.hideProgress();
    this.hideCancelButton();
    this.updateConvertButtonState();

    logInfo("Conversion cancelled");
  }

  /**
   * Show progress UI for selected formats
   * @param {string[]} formats - Format keys being converted
   * @private
   */
  showProgress(formats) {
    const progressContainer = this.elements["mathpix-convert-progress"];
    const progressList = this.elements["mathpix-convert-progress-list"];

    if (!progressContainer || !progressList) return;

    // Clear existing items
    progressList.innerHTML = "";

    // Create progress item for each format
    formats.forEach((format) => {
      const formatInfo = this.getFormatInfo(format);
      const item = document.createElement("div");
      item.className = "mathpix-progress-item";
      item.dataset.format = format;
      item.dataset.status = "pending";

      item.innerHTML = `
        <span class="mathpix-progress-icon" aria-hidden="true"></span>
        <span class="mathpix-progress-label">${formatInfo.label}</span>
        <span class="mathpix-progress-status">Waiting...</span>
      `;

      progressList.appendChild(item);
    });

    progressContainer.hidden = false;
    logDebug("Progress UI shown for formats:", formats);
  }

  /**
   * Hide progress section
   * @private
   */
  hideProgress() {
    const progressContainer = this.elements["mathpix-convert-progress"];
    if (progressContainer) {
      progressContainer.hidden = true;
    }
  }

  /**
   * Update progress display for a format
   * @param {Object} status - Status object from API client
   * @private
   */
  updateProgress(status) {
    if (!status) return;

    // Update overall status
    if (status.completed && status.total) {
      this.updateStatus(
        `Converting: ${status.completed}/${status.total} formats complete...`,
      );
    }

    // Update individual format items
    if (status.formatStatuses) {
      Object.entries(status.formatStatuses).forEach(
        ([format, formatStatus]) => {
          const item = document.querySelector(
            `.mathpix-progress-item[data-format="${format}"]`,
          );
          if (item) {
            item.dataset.status = formatStatus.status || "processing";
            const statusEl = item.querySelector(".mathpix-progress-status");
            if (statusEl) {
              statusEl.textContent = this.getStatusText(formatStatus.status);
            }
          }
        },
      );
    }
  }

  /**
   * Get human-readable status text
   * @param {string} status - Status code
   * @returns {string} Human-readable status
   * @private
   */
  getStatusText(status) {
    const statusTexts = {
      pending: "Waiting...",
      processing: "Converting...",
      completed: "Complete!",
      error: "Failed",
    };
    return statusTexts[status] || status;
  }

  /**
   * Handle successful format conversion
   * @param {string} format - Format key
   * @param {Blob} blob - Downloaded blob
   * @private
   */
  onFormatComplete(format, blob) {
    logInfo(`Format complete: ${format} (${blob.size} bytes)`);

    // Update progress item
    const item = document.querySelector(
      `.mathpix-progress-item[data-format="${format}"]`,
    );
    if (item) {
      item.dataset.status = "completed";
      const statusEl = item.querySelector(".mathpix-progress-status");
      if (statusEl) {
        statusEl.textContent = "Complete!";
      }
    }
  }

  /**
   * Handle conversion workflow completion
   * @param {Object} result - Completion result from API
   * @private
   */
  onConversionComplete(result) {
    logInfo("Conversion workflow complete:", {
      completed: result.completed?.length || 0,
      failed: result.failed?.length || 0,
    });

    // Parcel O-03: the status line the mode already speaks carries each
    // failed format's name and reason.
    let statusMessage = "Conversion complete!";

    // Show any errors
    if (result.failed && result.failed.length > 0) {
      // Parcel T-01: a failed format's row says so, whatever the poll last
      // reported (a download can fail after MathPix reported it complete).
      // T01-UPLOAD-ROWS-BEGIN
      result.failed.forEach((format) => {
        const item = document.querySelector(
          `.mathpix-progress-item[data-format="${format}"]`,
        );
        if (!item) return;
        item.dataset.status = "error";
        const statusEl = item.querySelector(".mathpix-progress-status");
        if (statusEl) statusEl.textContent = this.getStatusText("error");
      });

      const errorMessages = result.failed.map((format) => {
        const formatInfo = this.getFormatInfo(format);
        const error = result.errors?.[format];
        return `${formatInfo.label}: ${error || "Unknown error"}`;
      });
      this.showErrors(errorMessages);

      // Parcel T-01: the closing stop is added only when the reason has none.
      const stopped = (reason) =>
        /[.!?]$/.test(reason) ? reason : `${reason}.`;
      const failures = result.failed
        .map((format) => {
          const error = result.errors?.[format];
          return `${this.getFormatInfo(format).label} failed: ${stopped(error || "Unknown error")}`;
        })
        .join(" ");
      const anyCompleted = (result.completed?.length || 0) > 0;
      statusMessage = anyCompleted
        ? `Conversion complete! ${failures}`
        : `Conversion failed. ${failures}`;
    }

    this.updateStatus(statusMessage);
  }

  /**
   * Show downloads section with completed conversions
   * @param {Map<string, Blob>} results - Format to Blob map
   * @private
   */
  showDownloads(results) {
    const downloadsContainer = this.elements["mathpix-convert-downloads"];
    const buttonsContainer = this.elements["mathpix-download-buttons"];

    if (!downloadsContainer || !buttonsContainer) return;

    // Clear existing buttons
    buttonsContainer.innerHTML = "";

    // Create download button for each result
    results.forEach((blob, format) => {
      const button = this.createDownloadButton(format, blob);
      buttonsContainer.appendChild(button);
    });

    downloadsContainer.hidden = false;
    logDebug("Downloads shown:", results.size);
  }

  /**
   * Hide downloads section
   * @private
   */
  hideDownloads() {
    const downloadsContainer = this.elements["mathpix-convert-downloads"];
    if (downloadsContainer) {
      downloadsContainer.hidden = true;
    }
  }

  /**
   * Create download button for a format
   * @param {string} format - Format key
   * @param {Blob} blob - File blob
   * @returns {HTMLButtonElement}
   * @private
   */
  createDownloadButton(format, blob) {
    const formatInfo = this.getFormatInfo(format);
    const iconHtml = getFormatIcon(format);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mathpix-convert-download-btn";
    button.innerHTML = `${iconHtml} ${formatInfo.label}`;

    // Generate filename with -edit-converted suffix
    const filename = `${this.baseFilename}-edit-converted${formatInfo.extension}`;

    button.addEventListener("click", () => {
      this.triggerDownload(blob, filename);
    });

    return button;
  }

  /**
   * Trigger download for a blob
   * @param {Blob} blob - File blob
   * @param {string} filename - Suggested filename
   * @private
   */
  triggerDownload(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL after short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      logInfo("Download triggered:", filename);
    } catch (error) {
      logError("Download failed:", error);
      this.showError(`Failed to download ${filename}: ${error.message}`);
    }
  }

  /**
   * Get format info from config
   * @param {string} format - Format key
   * @returns {Object} Format info with label and extension
   * @private
   */
  getFormatInfo(format) {
    // Try to get from config
    if (
      typeof MATHPIX_CONFIG !== "undefined" &&
      MATHPIX_CONFIG.CONVERT?.FORMATS?.[format]
    ) {
      return MATHPIX_CONFIG.CONVERT.FORMATS[format];
    }

    // Fallback defaults
    const defaults = {
      docx: { label: "Word Document", extension: ".docx" },
      pdf: { label: "PDF", extension: "-html.pdf" }, // Parcel O-01
      "tex.zip": { label: "LaTeX (ZIP)", extension: ".tex.zip" },
      "latex.pdf": { label: "LaTeX PDF", extension: "-latex.pdf" }, // Parcel O-01
      html: { label: "HTML", extension: ".html" },
      md: { label: "Markdown", extension: ".md" },
      pptx: { label: "PowerPoint", extension: ".pptx" },
      "mmd.zip": { label: "MMD (ZIP)", extension: ".mmd.zip" },
      "md.zip": { label: "Markdown (ZIP)", extension: ".md.zip" },
      "html.zip": { label: "HTML (ZIP)", extension: ".html.zip" },
    };

    return defaults[format] || { label: format, extension: `.${format}` };
  }

  /**
   * Show error message to user
   * @param {string} message - Error message
   * @private
   */
  showError(message) {
    this.showErrors([message]);
  }

  /**
   * Show multiple error messages
   * @param {string[]} messages - Error messages
   * @private
   */
  showErrors(messages) {
    const errorsContainer = this.elements["mathpix-convert-errors"];
    const errorList = this.elements["mathpix-convert-error-list"];

    if (!errorsContainer || !errorList) {
      // Fallback to console
      messages.forEach((msg) => logError(msg));
      return;
    }

    // Clear and populate error list
    errorList.innerHTML = "";
    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      errorList.appendChild(li);
    });

    errorsContainer.hidden = false;
    logDebug("Errors shown:", messages.length);
  }

  /**
   * Hide errors section
   * @private
   */
  hideErrors() {
    const errorsContainer = this.elements["mathpix-convert-errors"];
    if (errorsContainer) {
      errorsContainer.hidden = true;
    }
  }

  /**
   * Update status text (aria-live region)
   * @param {string} message - Status message
   * @private
   */
  updateStatus(message) {
    const statusEl = this.elements["convert-status"];
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  /**
   * Show cancel button
   * @param {Object} [options]
   * @param {boolean} [options.takeFocus] - Move focus to Cancel (parcel 10k)
   * @private
   */
  showCancelButton({ takeFocus = false } = {}) {
    const convertBtn = this.elements["mathpix-convert-btn"];
    const cancelBtn = this.elements["mathpix-convert-cancel-btn"];
    if (convertBtn) convertBtn.hidden = true;
    if (cancelBtn) cancelBtn.hidden = false;
    if (takeFocus && cancelBtn) cancelBtn.focus();
  }

  /**
   * Hide cancel button
   * @private
   */
  hideCancelButton() {
    const convertBtn = this.elements["mathpix-convert-btn"];
    const cancelBtn = this.elements["mathpix-convert-cancel-btn"];

    // Parcel 10k: if Cancel has focus, hand it back to Convert Selected,
    // enabled first: cancelConversion() hides Cancel before re-enabling.
    const cancelHadFocus = cancelBtn && document.activeElement === cancelBtn;
    if (cancelHadFocus) this.updateConvertButtonState();

    if (convertBtn) convertBtn.hidden = false;
    if (cancelBtn) cancelBtn.hidden = true;
    if (cancelHadFocus && convertBtn) convertBtn.focus();
  }

  /**
   * Check if convert section is visible
   * @returns {boolean} True if visible
   */
  isVisible() {
    const section = this.elements["mathpix-convert-section"];
    return section && !section.hidden;
  }

  /**
   * Download all results including converted files via Total Downloader
   * Phase 6.2: Integration with Total Downloader for unified ZIP
   * @returns {Promise<void>}
   */
  async downloadAllAsZip() {
    if (this.completedDownloads.size === 0) {
      logWarn("No converted files available for download");
      return;
    }

    // Try to use Total Downloader for unified experience
    try {
      const controller = window.getMathPixController?.();

      if (controller) {
        logInfo("Using Total Downloader for unified ZIP archive");

        // Use the download manager's click handler which orchestrates everything
        const downloadManager = controller.downloadManager;
        if (downloadManager?.handleDownloadClick) {
          // Determine API type from current state
          const apiType = controller.pdfResultRenderer?.currentResults
            ? "pdf"
            : "text";
          await downloadManager.handleDownloadClick(apiType);
          return;
        }

        // Alternative: Direct total downloader method if available
        if (controller.downloadAllResults) {
          await controller.downloadAllResults();
          return;
        }
      }
    } catch (error) {
      logWarn(
        "Total Downloader not available, falling back to standalone ZIP:",
        error,
      );
    }

    // Fallback: Create standalone converted-only ZIP
    await this.downloadConvertedOnlyZip();
  }

  /**
   * Fallback: Download only converted files as ZIP (when Total Downloader unavailable)
   * @returns {Promise<void>}
   * @private
   */
  async downloadConvertedOnlyZip() {
    // Check if JSZip is available
    if (typeof JSZip === "undefined") {
      logError("JSZip not available for ZIP creation");
      this.showError(
        "ZIP download not available. Please download files individually.",
      );
      return;
    }

    try {
      const zip = new JSZip();
      const convertedFolder = zip.folder("converted");

      // Add each converted file to the ZIP
      this.completedDownloads.forEach((blob, format) => {
        const formatInfo = this.getFormatInfo(format);
        const filename = `${this.baseFilename}-converted${formatInfo.extension}`;
        convertedFolder.file(filename, blob);
      });

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Trigger download
      const zipFilename = `${this.baseFilename}-converted-files.zip`;
      this.triggerDownload(zipBlob, zipFilename);

      logInfo("Downloaded converted files as standalone ZIP:", zipFilename);
    } catch (error) {
      logError("Failed to create ZIP:", error);
      this.showError(`Failed to create ZIP archive: ${error.message}`);
    }
  }

  /**
   * Get all completed downloads for integration with total downloader
   * @returns {Map<string, Blob>} Map of format key to Blob
   */
  getCompletedDownloads() {
    return new Map(this.completedDownloads);
  }

  /**
   * Get completed downloads with filenames for ZIP integration
   * @returns {Array<{filename: string, blob: Blob, format: string}>}
   */
  getCompletedDownloadsWithFilenames() {
    const files = [];
    this.completedDownloads.forEach((blob, format) => {
      const formatInfo = this.getFormatInfo(format);
      files.push({
        filename: `${this.baseFilename}-edit-converted${formatInfo.extension}`,
        blob: blob,
        format: format,
      });
    });
    return files;
  }

  /**
   * Get current state for debugging
   * @returns {Object} Current state
   */
  getState() {
    return {
      isInitialised: this.isInitialised,
      isConverting: this.isConverting,
      activeConversionId: this.activeConversionId,
      selectedFormats: this.getSelectedFormats(),
      completedDownloads: this.completedDownloads.size,
      hasMMD: !!this.getCurrentMMD(),
      isVisible: this.isVisible(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let convertUIInstance = null;

/**
 * Gets the singleton MathPixConvertUI instance
 * @function getMathPixConvertUI
 * @returns {MathPixConvertUI} The UI controller instance
 */
function getMathPixConvertUI() {
  if (!convertUIInstance) {
    convertUIInstance = new MathPixConvertUI();
  }
  return convertUIInstance;
}

// ============================================================================
// Global Functions (called by onclick handlers)
// ============================================================================

/**
 * Global function called by Convert button onclick
 * @function startMMDConversion
 */
function startMMDConversion() {
  const ui = getMathPixConvertUI();
  ui.startConversion();
}

/**
 * Global function called by Cancel button onclick
 * @function cancelMMDConversion
 */
function cancelMMDConversion() {
  const ui = getMathPixConvertUI();
  ui.cancelConversion();
}

/**
 * Show the convert section (integration hook)
 * @function showConvertSection
 */
function showConvertSection() {
  const ui = getMathPixConvertUI();
  ui.show();
}

/**
 * Hide the convert section (integration hook)
 * @function hideConvertSection
 */
function hideConvertSection() {
  const ui = getMathPixConvertUI();
  ui.hide();
}

/**
 * Reset the convert section (integration hook)
 * @function resetConvertSection
 */
function resetConvertSection() {
  const ui = getMathPixConvertUI();
  ui.reset();
}

/**
 * Global function called by Download All Converted button onclick
 * @function downloadAllConverted
 */
function downloadAllConverted() {
  const ui = getMathPixConvertUI();
  ui.downloadAllAsZip();
}

// ============================================================================
// Global Exposure for Console Testing
// ============================================================================

window.getMathPixConvertUI = getMathPixConvertUI;
window.MathPixConvertUI = MathPixConvertUI;
window.startMMDConversion = startMMDConversion;
window.cancelMMDConversion = cancelMMDConversion;
window.showConvertSection = showConvertSection;
window.hideConvertSection = hideConvertSection;
window.resetConvertSection = resetConvertSection;
window.downloadAllConverted = downloadAllConverted;

// ============================================================================
// Export (ES6 Module Support)
// ============================================================================

export { MathPixConvertUI, getMathPixConvertUI };
export default MathPixConvertUI;
