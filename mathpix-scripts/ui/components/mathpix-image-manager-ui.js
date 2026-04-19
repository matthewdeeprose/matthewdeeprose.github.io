/**
 * @fileoverview MathPix Image Manager UI — Phase 8H.1
 * @module MathPixImageManagerUI
 * @version 1.0.0
 * @since Phase 8H.1
 *
 * @description
 * Modal-based UI for managing images in restored OCR documents.
 * Allows users to view, replace (swap), add, and delete images
 * via a thumbnail grid. Integrates with MathPixImageRegistry and
 * MathPixSessionRestorer.
 *
 * Architecture:
 * - IIFE with class pattern (matches image-registry, display-layer, ai-enhancer)
 * - Uses UniversalModal.Modal for modal lifecycle
 * - onclick handlers on buttons for simplicity
 * - Icons via data-icon attribute (auto-populated by icon-library.js)
 *
 * @see mathpix-image-registry.js — Registry API
 * @see mathpix-mmd-display-layer.js — Display layer API
 * @see mathpix-session-restorer.js — Integration target
 * @see mathpix-ai-enhancer.js — Modal pattern reference
 */

const MathPixImageManagerUI = (function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[ImageManagerUI ERROR]: ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageManagerUI WARN]: ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageManagerUI INFO]: ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageManagerUI DEBUG]: ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const STATUS_LABELS = {
    "cdn-linked": "OCR original",
    downloaded: "Downloaded",
    "user-replaced": "Replaced",
    "user-added": "Added by user",
    "data-uri": "Embedded",
    missing: "Missing",
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Format file size in human-readable form
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  function formatFileSize(bytes) {
    if (bytes == null || bytes < 0) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get MIME type label
   * @param {string} mimeType - MIME type string
   * @returns {string} Short label (e.g. "JPEG")
   */
  function getMimeLabel(mimeType) {
    if (!mimeType) return "";
    const map = {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
    };
    return map[mimeType] || mimeType;
  }

  // ============================================================================
  // CLASS: MathPixImageManagerUI
  // ============================================================================

  class MathPixImageManagerUI {
    /**
     * @param {Object} restorer - MathPixSessionRestorer instance
     */
    constructor(restorer) {
      if (!restorer) {
        logError("Constructor requires a MathPixSessionRestorer instance");
        return;
      }

      /** @type {Object} Reference to the session restorer */
      this.restorer = restorer;

      /** @type {UniversalModal.Modal|null} Current modal instance */
      this.currentModal = null;

      /** @type {string|null} Pending action context for file input */
      this._pendingAction = null;

      /** @type {string|null} Image ID for pending swap action */
      this._pendingSwapId = null;

      /** @type {HTMLElement|null} Trigger button for focus return */
      this._triggerButton = null;

      logInfo("MathPixImageManagerUI constructed");
    }

    // ========================================================================
    // MODAL LIFECYCLE
    // ========================================================================

    /**
     * Open the image manager modal.
     * Populates the grid from the registry.
     */
    open() {
      logInfo("Opening image manager modal");

      this._triggerButton = document.getElementById("resume-manage-images-btn");

      const content = this._buildModalContent();

      try {
        this.currentModal = new UniversalModal.Modal({
          title: "Manage Images",
          content: content,
          size: "fullscreen",
          className: "image-manager-modal-wrapper",
          closeOnOverlayClick: true,
          onClose: () => {
            this._returnFocus();
          },
        });

        this.currentModal.open();

        // After modal opens, populate the grid and set up file input listener
        requestAnimationFrame(() => {
          this.refresh();
          this._attachFileInputListener();

          // Populate data-icon attributes for dynamically added content
          if (typeof populateIcons === "function") {
            const modal = document.querySelector(
              "dialog[open].universal-modal",
            );
            if (modal) {
              populateIcons(modal);
            }
          }
        });

        logDebug("Image manager modal opened");
      } catch (error) {
        logError("Failed to open modal:", error);
      }
    }

    /**
     * Close the image manager modal.
     * Returns focus to the trigger button.
     */
    close() {
      logInfo("Closing image manager modal");

      if (this.currentModal) {
        this.currentModal.close();
        this.currentModal = null;
      }

      this._returnFocus();
    }

    /**
     * Return focus to the trigger button
     * @private
     */
    _returnFocus() {
      if (
        this._triggerButton &&
        typeof this._triggerButton.focus === "function"
      ) {
        this._triggerButton.focus();
        logDebug("Focus returned to manage images button");
      }
      this._triggerButton = null;
    }

    // ========================================================================
    // CONTENT BUILDING
    // ========================================================================

    /**
     * Build the inner HTML content for the modal body.
     * The toolbar and grid container are static; cards are populated by refresh().
     * @returns {string} HTML string
     * @private
     */
    _buildModalContent() {
      return `
        <div class="image-manager-toolbar">
          <button
            type="button"
            id="image-manager-add-btn"
            class="image-manager-action-btn"
            onclick="addImageToDocument()"
          >
            <span aria-hidden="true" data-icon="plus"></span>
            Add Image
          </button>
          <span id="image-manager-count" class="image-manager-count" aria-live="polite"></span>
        </div>

<ul
          id="image-manager-grid"
          class="image-manager-grid"
          aria-label="Document images"
        >
        </ul>

        <p id="image-manager-empty" class="image-manager-empty" hidden>
          No images in this document.
        </p>

        <input type="file" id="image-manager-file-input" accept="image/jpeg,image/png,image/webp" hidden />
      `;
    }

    /**
     * Build an image card HTML string from a registry entry.
     * @param {Object} entry - Image registry entry
     * @param {number} index - 0-based index
     * @param {number} total - Total image count
     * @returns {string} HTML string
     * @private
     */
    _buildImageCard(entry, index, total) {
      const imgSrc = this._getImageSrc(entry);
      const sizeLabel = formatFileSize(entry.fileSize);
      const mimeLabel = getMimeLabel(entry.mimeType);
      const sizeDisplay = [sizeLabel, mimeLabel].filter(Boolean).join(" · ");
      const statusLabel =
        STATUS_LABELS[entry.status] || entry.status || "Unknown";
      const safeId = this._escapeAttr(entry.id);
      const idAttr = `image-card-label-${safeId}`;

      // Build meaningful alt text: prefer user/OCR alt text, fall back to identifiable description
      const altText = entry.altText
        ? `Image ${index + 1} of ${total}: ${entry.altText}`
        : `Image ${index + 1} of ${total} (${safeId}, ${sizeDisplay})`;

      // Look up friendly filename from the ZIP's filenameMap (if available)
      const filenameMap = this.restorer.imageFilenameMap || {};
      const mapEntry = filenameMap[entry.id];
      let friendlyName = mapEntry?.filename || null;

      // If the image was replaced by the user, show the replacement filename
      // instead of the stale ZIP filename (which refers to the original OCR image)
      if (entry.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }

      // Group label for screen readers — used by aria-labelledby on the card
      // and to give context to the Replace/Remove buttons within it
      const displayName = friendlyName || safeId;
      const groupLabel = entry.altText
        ? `${entry.altText} — ${sizeDisplay}`
        : `${displayName} — ${sizeDisplay}`;

      return `
        <li class="image-manager-card"
            data-image-id="${safeId}">
          <div role="group" aria-labelledby="${idAttr}">
          <div class="image-manager-thumbnail">
${
  imgSrc
    ? `<img src="${this._escapeAttr(imgSrc)}" alt="${this._escapeAttr(altText)}" loading="lazy" data-image-id="${safeId}" onerror="_handleThumbnailError(this)" />`
    : `<span class="image-manager-no-preview">No preview available</span>`
}
          </div>
          <dl class="image-manager-meta">
<dt class="visually-hidden">Image name</dt>
            <dd class="image-manager-id" id="${idAttr}">${this._escapeHTML(friendlyName || entry.id)}</dd>
            <dt class="visually-hidden">File details</dt>
            <dd class="image-manager-size">${this._escapeHTML(sizeDisplay)}</dd>
            <dt class="visually-hidden">Status</dt>
            <dd class="image-manager-status" data-status="${this._escapeAttr(entry.status)}">${this._escapeHTML(statusLabel)}</dd>
          </dl>
          <div class="image-manager-actions">
            <button type="button" class="image-manager-btn image-manager-swap-btn"
                    onclick="swapImage('${safeId}')"
aria-label="Replace image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="refresh"></span> Replace
            </button>
            <button type="button" class="image-manager-btn image-manager-delete-btn"
                    onclick="deleteImage('${safeId}')"
aria-label="Remove image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="trash"></span> Remove
            </button>
</div>
          </div>
        </li>
      `;
    }

    /**
     * Get the best available image source URL for display.
     * Prefers blob URL, then data URI, then original URL.
     * @param {Object} entry - Image registry entry
     * @returns {string|null} URL string or null
     * @private
     */
    _getImageSrc(entry) {
      // For OCR images: check the blob URL map on the restorer
      if (entry.originalUrl && this.restorer.imageBlobUrlMap) {
        const blobUrl = this.restorer.imageBlobUrlMap.get(entry.originalUrl);
        if (blobUrl) return blobUrl;
      }

      // For user-added images: originalUrl IS the blob URL
      if (entry.originalUrl && entry.originalUrl.startsWith("blob:")) {
        return entry.originalUrl;
      }

      // Fallback to data URI
      if (entry.dataUri) return entry.dataUri;

      // Fallback to original URL (CDN — may not load if offline)
      if (entry.originalUrl) return entry.originalUrl;

      return null;
    }

    // ========================================================================
    // GRID POPULATION
    // ========================================================================

    /**
     * Refresh the thumbnail grid from the current registry state.
     */
    refresh() {
      logDebug("Refreshing image manager grid");

      const grid = document.getElementById("image-manager-grid");
      const emptyMsg = document.getElementById("image-manager-empty");
      const countEl = document.getElementById("image-manager-count");

      if (!grid) {
        logWarn("Grid element not found — modal may not be open");
        return;
      }

      const registry = this.restorer.imageRegistry;
      if (!registry) {
        logWarn("No image registry on restorer");
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "";
        return;
      }

      const images = registry.getAllImages();
      const total = images.length;

      if (total === 0) {
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "0 images";
        return;
      }

      if (emptyMsg) emptyMsg.hidden = true;
      if (countEl) {
        countEl.textContent = `${total} image${total !== 1 ? "s" : ""}`;
      }

      const cardsHTML = images
        .map((entry, i) => this._buildImageCard(entry, i, total))
        .join("");

      grid.innerHTML = cardsHTML;

      // Populate data-icon attributes in the newly added cards
      if (typeof populateIcons === "function") {
        populateIcons(grid);
      }

      logDebug(`Grid refreshed with ${total} image(s)`);
    }

    // ========================================================================
    // FILE INPUT HANDLING
    // ========================================================================

    /**
     * Attach the change listener to the hidden file input.
     * @private
     */
    _attachFileInputListener() {
      const fileInput = document.getElementById("image-manager-file-input");
      if (!fileInput) {
        logWarn("File input not found in modal");
        return;
      }

      // Remove any previous listener by replacing the element
      const clone = fileInput.cloneNode(true);
      fileInput.parentNode.replaceChild(clone, fileInput);

      clone.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        clone.value = "";

        try {
          await this._handleFileSelected(file);
        } catch (error) {
          logError("File handling error:", error);
          this._showStatus(`Error: ${error.message}`, "error");
        }
      });

      logDebug("File input listener attached");
    }

    /**
     * Handle a file selected from the file picker.
     * Routes to swap or add based on pending action.
     * @param {File} file - Selected file
     * @private
     */
    async _handleFileSelected(file) {
      // Validate
      const validation = this.validateFile(file);
      if (!validation.valid) {
        this._showStatus(validation.message, "error");
        return;
      }

      // Process file
      this._showStatus("Processing image…", "loading");
      const fileData = await this.processFile(file);

      if (this._pendingAction === "swap" && this._pendingSwapId) {
        await this._executeSwap(this._pendingSwapId, fileData);
      } else if (this._pendingAction === "add") {
        await this._executeAdd(fileData);
      }

      this._pendingAction = null;
      this._pendingSwapId = null;
    }

    // ========================================================================
    // SWAP (REPLACE) FLOW
    // ========================================================================

    /**
     * Initiate the swap flow for a specific image.
     * Opens the file picker; completion handled by file input listener.
     * @param {string} imageId - Registry image ID
     */
    handleSwap(imageId) {
      logInfo(`Swap initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      this._pendingAction = "swap";
      this._pendingSwapId = imageId;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the swap after file is processed.
     * @param {string} imageId - Registry image ID
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeSwap(imageId, fileData) {
      logInfo(`Executing swap for ${imageId}`);

      try {
        await this.restorer.swapImage(imageId, fileData);

        // Update the filenameMap so the card shows the new file's name
        const filenameMap = this.restorer.imageFilenameMap || {};
        if (filenameMap[imageId] && fileData.originalFilename) {
          filenameMap[imageId].replacedWithFilename = fileData.originalFilename;
        }

        this._showStatus("Image replaced successfully", "success");
        this.refresh();
      } catch (error) {
        logError("Swap failed:", error);
        this._showStatus(`Replace failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // ADD FLOW
    // ========================================================================

    /**
     * Initiate the add-image flow.
     * Opens the file picker; completion handled by file input listener.
     */
    handleAdd() {
      logInfo("Add image initiated");

      this._pendingAction = "add";
      this._pendingSwapId = null;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the add after file is processed.
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeAdd(fileData) {
      logInfo("Executing add image");

      try {
        await this.restorer.addImageToDocument(fileData);
        this._showStatus("Image added to document", "success");
        this.refresh();
      } catch (error) {
        logError("Add failed:", error);
        this._showStatus(`Add failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // DELETE FLOW
    // ========================================================================

    /**
     * Initiate the delete flow for a specific image.
     * Shows confirmation dialog, then removes if confirmed.
     * @param {string} imageId - Registry image ID
     */
    async handleDelete(imageId) {
      logInfo(`Delete initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      // Close the current modal temporarily so safeConfirm is visible
      // (safeConfirm creates its own modal which would conflict)
      const confirmed = await this._confirmDelete();

      if (!confirmed) {
        logDebug("Delete cancelled by user");
        return;
      }

      try {
        await this.restorer.deleteImage(imageId);
        this._showStatus("Image removed from document", "success");
        this.refresh();

        // If no images remain, close the modal after a short delay.
        // Delay is necessary because safeConfirm's modal close uses a 200ms
        // animation timeout — resolve() fires before finishClose() removes it
        // from activeModals. Without this delay, getCurrentModalId() returns
        // the confirm modal's ID instead of ours, so our close() is misdirected.
        if (registry.getCount() === 0) {
          setTimeout(() => this.close(), 300);
        }
      } catch (error) {
        logError("Delete failed:", error);
        this._showStatus(`Remove failed: ${error.message}`, "error");
      }
    }

    /**
     * Show confirmation dialog for delete.
     * @returns {Promise<boolean>} True if confirmed
     * @private
     */
    async _confirmDelete() {
      if (typeof safeConfirm === "function") {
        return await safeConfirm(
          "Remove this image from the document?",
          "Remove Image",
        );
      }
      // Fallback
      return confirm("Remove this image from the document?");
    }

    // ========================================================================
    // FILE VALIDATION & PROCESSING
    // ========================================================================

    /**
     * Validate a file for upload.
     * Checks type (JPEG, PNG, WebP) and size (<10 MB).
     * @param {File} file - File to validate
     * @returns {{ valid: boolean, message: string }}
     */
    validateFile(file) {
      if (!file) {
        return { valid: false, message: "No file selected" };
      }

      if (!SUPPORTED_TYPES.includes(file.type)) {
        return {
          valid: false,
          message: `Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, or WebP.`,
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          message: `File too large (${formatFileSize(file.size)}). Maximum is 10 MB.`,
        };
      }

      return { valid: true, message: "OK" };
    }

    /**
     * Process a file into the data structure needed for registry operations.
     * Reads as data URI and gets dimensions.
     * @param {File} file - File to process
     * @returns {Promise<Object>} { blob, blobUrl, dataUri, mimeType, fileSize, dimensions }
     */
    async processFile(file) {
      const blob = file;
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = file.type;
      const fileSize = file.size;
      const originalFilename = file.name || null;

      // Read as data URI (base64)
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Get dimensions
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });

      logDebug("File processed:", {
        originalFilename,
        mimeType,
        fileSize: formatFileSize(fileSize),
        dimensions,
      });

      return {
        blob,
        blobUrl,
        dataUri,
        mimeType,
        fileSize,
        dimensions,
        originalFilename,
      };
    }
    // ========================================================================
    // STATUS MESSAGES
    // ========================================================================

    /**
     * Show a status message in the modal.
     * Uses UniversalModal.showStatus if available, else logs.
     * @param {string} message - Message text
     * @param {string} type - "info" | "success" | "error" | "loading"
     * @private
     */
    _showStatus(message, type) {
      if (typeof UniversalModal !== "undefined" && UniversalModal.showStatus) {
        UniversalModal.showStatus(message, type);

        // Auto-hide success/info after 3 seconds
        if (type === "success" || type === "info") {
          setTimeout(() => {
            if (typeof UniversalModal.hideStatus === "function") {
              UniversalModal.hideStatus();
            }
          }, 3000);
        }
      } else {
        logInfo(`[${type}] ${message}`);
      }
    }

    // ========================================================================
    // UTILITY: ESCAPING
    // ========================================================================

    /**
     * Escape HTML entities
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeHTML(str) {
      if (!str) return "";
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Escape for use in HTML attributes
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeAttr(str) {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  // ============================================================================
  // THUMBNAIL ERROR RECOVERY
  // ============================================================================

  /**
   * Handle thumbnail load failure by falling back to dataUri or CDN URL.
   * Called via inline onerror on <img> elements in the image grid.
   * @param {HTMLImageElement} imgEl - The <img> element that failed to load
   */
  function handleThumbnailError(imgEl) {
    // Prevent infinite error loops
    imgEl.onerror = null;

    const imageId = imgEl.dataset.imageId;
    if (!imageId) {
      logWarn("Thumbnail error: no data-image-id on <img>");
      return;
    }

    // Get or create the singleton instance
    const mgr = getInstance();
    if (!mgr?.restorer?.imageRegistry) {
      logWarn(`Thumbnail error for ${imageId}: no registry available`);
      return;
    }

    const entry = mgr.restorer.imageRegistry.getImage(imageId);
    if (!entry) {
      logWarn(`Thumbnail error for ${imageId}: not found in registry`);
      return;
    }

    // Try dataUri first (works offline, always available for user-added)
    if (entry.dataUri) {
      logInfo(`Thumbnail fallback for ${imageId}: using dataUri`);
      imgEl.src = entry.dataUri;
      return;
    }

    // Try CDN URL (requires network, only for OCR images)
    if (entry.originalUrl && entry.originalUrl.startsWith("http")) {
      logInfo(`Thumbnail fallback for ${imageId}: using CDN URL`);
      imgEl.src = entry.originalUrl;
      return;
    }

    logWarn(
      `Thumbnail fallback exhausted for ${imageId}: no displayable source`,
    );
  }

  // Expose globally for inline onerror handlers
  window._handleThumbnailError = handleThumbnailError;

  // ============================================================================
  // SINGLETON & GLOBAL EXPOSURE
  // ============================================================================

  /** @type {MathPixImageManagerUI|null} Singleton instance */
  let instance = null;

  /**
   * Get or create the singleton instance.
   * @returns {MathPixImageManagerUI|null}
   */
  function getInstance() {
    if (instance) return instance;

    // Try to get the restorer via its getter function
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;

    if (!restorer) {
      logWarn("Cannot create instance: session restorer not available");
      return null;
    }

    instance = new MathPixImageManagerUI(restorer);
    return instance;
  }

  // ============================================================================
  // GLOBAL ONCLICK WRAPPERS
  // ============================================================================

  window.openImageManager = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.open();
    } else {
      logError("Image manager could not be initialised");
    }
  };

  window.closeImageManager = function () {
    if (instance) {
      instance.close();
    }
  };

  window.swapImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleSwap(imageId);
    }
  };

  window.addImageToDocument = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleAdd();
    }
  };

  window.deleteImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleDelete(imageId);
    }
  };

  // ============================================================================
  // CONSOLE TESTS
  // ============================================================================

  /**
   * Test image manager UI functionality
   * @returns {Object} Test results
   */
  window.testImageManagerUI = function () {
    console.log("=== Image Manager UI Tests ===\n");
    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log(`  ✓ ${name}`);
        passed++;
      } else {
        console.error(`  ✗ ${name}`);
        failed++;
      }
    }

    // Test 1: Class exists
    assert(
      "MathPixImageManagerUI class exists",
      typeof MathPixImageManagerUI === "function",
    );

    // Test 2: Global functions exist
    assert(
      "openImageManager exists",
      typeof window.openImageManager === "function",
    );
    assert(
      "closeImageManager exists",
      typeof window.closeImageManager === "function",
    );
    assert("swapImage exists", typeof window.swapImage === "function");
    assert(
      "addImageToDocument exists",
      typeof window.addImageToDocument === "function",
    );
    assert("deleteImage exists", typeof window.deleteImage === "function");

    // Test 3: getInstance
    const mgr = getInstance();
    const hasRestorer = !!window.mathPixSessionRestorer;
    if (hasRestorer) {
      assert("getInstance returns instance when restorer available", !!mgr);
      assert("Instance has open method", typeof mgr?.open === "function");
      assert("Instance has close method", typeof mgr?.close === "function");
      assert("Instance has refresh method", typeof mgr?.refresh === "function");
      assert(
        "Instance has handleSwap method",
        typeof mgr?.handleSwap === "function",
      );
      assert(
        "Instance has handleAdd method",
        typeof mgr?.handleAdd === "function",
      );
      assert(
        "Instance has handleDelete method",
        typeof mgr?.handleDelete === "function",
      );
      assert(
        "Instance has validateFile method",
        typeof mgr?.validateFile === "function",
      );
      assert(
        "Instance has processFile method",
        typeof mgr?.processFile === "function",
      );
    } else {
      console.log("  ⚠ Skipping instance tests — no restorer available");
    }

    // Test 4: File validation
    if (mgr) {
      const fakeJPEG = new File(["data"], "test.jpg", { type: "image/jpeg" });
      const validResult = mgr.validateFile(fakeJPEG);
      assert("Valid JPEG passes validation", validResult.valid === true);

      const fakePDF = new File(["data"], "test.pdf", {
        type: "application/pdf",
      });
      const invalidResult = mgr.validateFile(fakePDF);
      assert("PDF fails validation", invalidResult.valid === false);

      const noFile = mgr.validateFile(null);
      assert("null file fails validation", noFile.valid === false);
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    return { passed, failed };
  };

  // Return public API
  return {
    MathPixImageManagerUI,
    getInstance,
  };
})();

// Export for external access
window.MathPixImageManagerUI = MathPixImageManagerUI;
