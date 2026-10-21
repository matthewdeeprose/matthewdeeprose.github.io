/**
 * MathPix PDF Preview - Accessibility Module
 * Phase 3.4 - WCAG 2.2 AA Compliance
 *
 * Purpose: Ensure full accessibility for PDF preview features including
 * screen reader announcements and keyboard navigation support.
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
    console.error(`[PDFPreviewAccessibility] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[PDFPreviewAccessibility] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[PDFPreviewAccessibility] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[PDFPreviewAccessibility] ${message}`, ...args);
}

/**
 * PDF Preview Accessibility Class
 * Manages screen reader announcements and focus management
 */
export class PDFPreviewAccessibility {
  constructor() {
    this.liveRegion = null;
    this.initialise();

    logInfo("PDFPreviewAccessibility initialised");
  }

  /**
   * Initialise accessibility features
   */
  initialise() {
    this.liveRegion = this.createLiveRegion();
    logDebug("Live region created");
  }

  /**
   * Create or get ARIA live region for announcements
   * @returns {HTMLElement} Live region element
   */
  createLiveRegion() {
    let region = document.getElementById("pdf-preview-announcements");

    if (!region) {
      region = document.createElement("div");
      region.id = "pdf-preview-announcements";
      region.className = "sr-only";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.appendChild(region);

      logDebug("Created new live region");
    } else {
      logDebug("Using existing live region");
    }

    return region;
  }

  /**
   * Announce upload verification preview to screen readers
   * @param {string} filename - Name of uploaded file
   * @param {number} pages - Number of pages detected
   */
  announceUploadVerification(filename, pages) {
    const pageText = pages === 1 ? "page" : "pages";
    const announcement = `
      PDF upload preview ready. 
      File: ${filename}. 
      ${pages} ${pageText} detected. 
      Please verify this is the correct file before processing.
    `
      .trim()
      .replace(/\s+/g, " ");

    this.announce(announcement);
    logDebug("Announced upload verification", { filename, pages });
  }

  /**
   * Announce page change to screen readers
   * @param {number} pageNumber - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {Object} stats - Page statistics
   */
  announcePageChange(pageNumber, totalPages, stats) {
    const announcement = `
      Page ${pageNumber} of ${totalPages}. 
      ${stats.mathElements || 0} equations, 
      ${stats.tables || 0} tables, 
      ${stats.handwritten || 0} handwritten elements detected.
      Average confidence ${((stats.confidence || 0) * 100).toFixed(0)} percent.
    `
      .trim()
      .replace(/\s+/g, " ");

    this.announce(announcement);
    logDebug("Announced page change", { pageNumber, totalPages, stats });
  }

  /**
   * Announce overlay toggle to screen readers
   * @param {boolean} visible - Whether overlays are visible
   */
  announceOverlayToggle(visible) {
    const announcement = visible
      ? "Content overlays shown"
      : "Content overlays hidden";

    this.announce(announcement);
    logDebug("Announced overlay toggle", { visible });
  }

  /**
   * Announce zoom change to screen readers
   * @param {number} scale - New zoom scale (e.g., 1.5)
   */
  announceZoomChange(scale) {
    const percentage = Math.round(scale * 100);
    const announcement = `Zoom level ${percentage} percent`;

    this.announce(announcement);
    logDebug("Announced zoom change", { scale, percentage });
  }

  /**
   * Generic announcement method
   * @param {string} message - Message to announce
   */
  announce(message) {
    if (!this.liveRegion) {
      logWarn("Cannot announce: live region not available");
      return;
    }

    // Clear and set new message
    this.liveRegion.textContent = "";

    // Small delay to ensure screen readers pick up the change
    setTimeout(() => {
      this.liveRegion.textContent = message;
      logDebug("Announced", message);
    }, 100);
  }

  /**
   * Manage focus for an element
   * @param {HTMLElement} element - Element to focus
   */
  manageFocus(element) {
    if (!element) {
      logWarn("Cannot manage focus: element is null");
      return;
    }

    element.focus();
    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    });

    logDebug("Focus managed for element", element.id || element.className);
  }

  /**
   * Clean up accessibility resources
   */
  cleanup() {
    if (this.liveRegion) {
      this.liveRegion.textContent = "";
    }
    logDebug("Accessibility resources cleaned up");
  }
}

// Export for testing
if (typeof window !== "undefined") {
  window.PDFPreviewAccessibility = PDFPreviewAccessibility;
}
