/**
 * @fileoverview PDF Engine Parameter Control
 *
 * js/modules/parameters/controls/parameter-pdf-engine.js
 *
 * Manages PDF processing engine selection with smart defaults and cost information
 */

import { ParameterBase } from "../base/parameter-base.js";
import { CONFIG } from "../../../config.js";

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
 * PDF Engine parameter control with smart selection and cost awareness
 */
export class PDFEngineParameter extends ParameterBase {
  constructor() {
    super({
      id: "pdf-engine",
      name: "PDF Processing Engine",
      description:
        "Choose how PDF files are processed. Auto-selection recommended.",
      validation: {
        allowed: ["auto", "native", "pdf-text", "mistral-ocr"],
      },
      defaultValue: "auto",
    });

    this.currentFile = null;
    this.costEstimates = new Map();

    logInfo("PDF Engine parameter control initialised");
  }

  /**
   * Render the parameter template
   */
  async render() {
    logDebug("Rendering PDF engine parameter control");

    if (!this.elements.wrapper) {
      logError("Wrapper element not found for PDF engine parameter");
      throw new Error("Wrapper element required for rendering");
    }

    // Create control structure
    this.elements.wrapper.innerHTML = "";
    this.elements.wrapper.className = "parameter-control pdf-engine-control";
    this.elements.wrapper.style.display = "none"; // Hidden until file is uploaded

    // Create label
    const label = document.createElement("label");
    label.id = `${this.id}-label`;
    label.htmlFor = this.id;
    label.textContent = this.name;
    label.className = "parameter-label";

    // Create select element
    const select = document.createElement("select");
    select.id = this.id;
    select.name = this.id;
    select.className = "parameter-input";
    select.setAttribute("aria-describedby", `${this.id}-help`);

    // Add options based on configuration
    this.addEngineOptions(select);

    // Create help text
    const helpText = document.createElement("div");
    helpText.id = `${this.id}-help`;
    helpText.className = "parameter-help";
    helpText.textContent = this.description;

    // Create cost info display
    const costInfo = document.createElement("div");
    costInfo.id = `${this.id}-cost`;
    costInfo.className = "engine-cost-info";
    costInfo.setAttribute("role", "status");
    costInfo.setAttribute("aria-live", "polite");

    // Assemble elements
    this.elements.wrapper.appendChild(label);
    this.elements.wrapper.appendChild(select);
    this.elements.wrapper.appendChild(helpText);
    this.elements.wrapper.appendChild(costInfo);

    // Store element references
    this.elements.control = select;
    this.elements.description = helpText;
    this.costElement = costInfo;

    logInfo("PDF engine parameter rendered successfully");
  }

  /**
   * Add engine options to select element
   * @param {HTMLSelectElement} select - Select element to populate
   */
  addEngineOptions(select) {
    const engines = [
      {
        value: "auto",
        label: "Smart Selection (Recommended)",
        cost: "Variable",
      },
      {
        value: "native",
        label: "Native (Best Performance)",
        cost: "Token-based",
      },
      { value: "pdf-text", label: "Text Extraction (Free)", cost: "Free" },
      { value: "mistral-ocr", label: "OCR Processing", cost: "£2/1000 pages" },
    ];

    engines.forEach((engine) => {
      const option = document.createElement("option");
      option.value = engine.value;
      option.textContent = `${engine.label} - ${engine.cost}`;
      select.appendChild(option);
    });

    logDebug("Added PDF engine options", { engineCount: engines.length });
  }

  /**
   * Set up event listeners for the parameter
   */
  setupEventListeners() {
    super.setupEventListeners();

    if (this.elements.control) {
      this.elements.control.addEventListener("change", (e) => {
        this.handleValueChange(e.target.value);
      });
    }
  }

  /**
   * Handle value changes
   * @param {string} value - New engine value
   */
  handleValueChange(value) {
    this.setValue(value);
    this.updateCostDisplay();

    // Emit event for other components
    if (this.elements.wrapper) {
      this.elements.wrapper.dispatchEvent(
        new CustomEvent("pdf-engine-changed", {
          detail: { engine: value, file: this.currentFile },
          bubbles: true,
        })
      );
    }

    logInfo("PDF engine selection changed", { engine: value });
  }

  /**
   * Update control when a file is selected
   * @param {File|null} file - Selected file or null if removed
   */
  updateForFile(file) {
    this.currentFile = file;

    if (file && file.type === "application/pdf") {
      this.show();
      this.updateRecommendations(file);
      this.updateCostEstimates(file);
    } else {
      this.hide();
    }

    logDebug("Updated PDF engine control for file", {
      hasFile: !!file,
      isPDF: file?.type === "application/pdf",
    });
  }

  /**
   * Update engine recommendations based on file characteristics
   * @param {File} file - PDF file to analyse
   */
  updateRecommendations(file) {
    const recommended = CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file);
    const isLikelyScanned = CONFIG.FILE_UPLOAD_UTILS.isPDFLikelyScanned(
      file.size
    );
    const estimatedPages = CONFIG.FILE_UPLOAD_UTILS.estimatePDFPages(file.size);

    // Update help text with specific recommendations
    let helpText = this.description;

    if (isLikelyScanned) {
      helpText = `Large file (${CONFIG.FILE_UPLOAD_UTILS.formatFileSize(
        file.size
      )}) - likely scanned. OCR processing recommended.`;
    } else {
      helpText = `Text-based PDF (${CONFIG.FILE_UPLOAD_UTILS.formatFileSize(
        file.size
      )}, ~${estimatedPages} pages) - Native processing recommended.`;
    }

    if (this.elements.description) {
      this.elements.description.textContent = helpText;
    }

    // Update auto-selection to show recommended engine
    const autoOption = this.elements.control?.querySelector(
      'option[value="auto"]'
    );
    if (autoOption) {
      autoOption.textContent = `Smart Selection (${recommended}) - Recommended`;
    }

    logInfo("Updated PDF engine recommendations", {
      recommended,
      isLikelyScanned,
      estimatedPages,
    });
  }

  /**
   * Update cost estimates for different engines
   * @param {File} file - PDF file to estimate costs for
   */
  updateCostEstimates(file) {
    const estimatedPages = CONFIG.FILE_UPLOAD_UTILS.estimatePDFPages(file.size);
    const costs = CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS;

    // Calculate cost estimates
    const estimates = {
      "pdf-text": { cost: 0, display: "Free" },
      "mistral-ocr": {
        cost: (estimatedPages / 1000) * costs["mistral-ocr"],
        display: `£${((estimatedPages / 1000) * costs["mistral-ocr"]).toFixed(
          3
        )} (~${estimatedPages} pages)`,
      },
      native: { cost: "variable", display: "Token-based (usually lowest)" },
    };

    this.costEstimates.set(file.name, estimates);

    // Update current cost display
    this.updateCostDisplay();

    logDebug("Updated cost estimates", { estimates, estimatedPages });
  }

  /**
   * Update cost display based on current selection
   */
  updateCostDisplay() {
    if (!this.currentFile || !this.costElement) return;

    const selectedEngine = this.getValue();
    const estimates = this.costEstimates.get(this.currentFile.name);

    if (!estimates) return;

    let costText = "";
    if (selectedEngine === "auto") {
      const recommended = CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(
        this.currentFile
      );
      costText = `Estimated cost: ${
        estimates[recommended]?.display || "Variable"
      }`;
    } else if (estimates[selectedEngine]) {
      costText = `Estimated cost: ${estimates[selectedEngine].display}`;
    }

    this.costElement.textContent = costText;
    this.costElement.className = `engine-cost-info cost-${this.getCostLevel(
      selectedEngine
    )}`;

    logDebug("Updated cost display", { selectedEngine, costText });
  }

  /**
   * Get cost warning level for selected engine
   * @param {string} engine - Selected engine
   * @returns {string} Cost level: 'low', 'medium', 'high'
   */
  getCostLevel(engine) {
    if (!this.currentFile) return "low";

    const estimates = this.costEstimates.get(this.currentFile.name);
    if (!estimates || !estimates[engine]) return "low";

    const estimate = estimates[engine];
    if (estimate.cost === 0) return "low";
    if (typeof estimate.cost === "number") {
      if (estimate.cost >= 2.0) return "high";
      if (estimate.cost >= 0.5) return "medium";
    }

    return "low";
  }

  /**
   * Get the effective engine (resolve 'auto' to actual engine)
   * @returns {string} Actual engine that will be used
   */
  getEffectiveEngine() {
    const selected = this.getValue();
    if (selected === "auto" && this.currentFile) {
      return CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(this.currentFile);
    }
    return selected;
  }

  /**
   * Show the control
   */
  show() {
    if (this.elements.wrapper) {
      this.elements.wrapper.style.display = "block";
      this.elements.wrapper.setAttribute("aria-hidden", "false");
    }
  }

  /**
   * Hide the control
   */
  hide() {
    if (this.elements.wrapper) {
      this.elements.wrapper.style.display = "none";
      this.elements.wrapper.setAttribute("aria-hidden", "true");
    }
  }

  /**
   * Reset the control
   */
  setValue(value) {
    super.setValue(value);
    if (this.elements.control) {
      this.elements.control.value = value;
    }
  }

  /**
   * Get value description (required by ParameterBase)
   * @param {string} value - Current value
   * @returns {string} Description
   */
  getValueDescription(value) {
    const engines = {
      auto: "Smart selection based on file analysis",
      native: "Native processing for best performance",
      "pdf-text": "Text extraction (free)",
      "mistral-ocr": "OCR processing for scanned documents",
    };

    return engines[value] || "Unknown engine";
  }

  /**
   * Override validateValue to handle string-based validation (Stage 3.4 fix)
   * Applies defensive validation pattern from Stages 3.1-3.3
   * @param {any} value - Value to validate
   * @returns {string} Validated string value
   */
  validateValue(value) {
    logDebug("PDF engine parameter validating value:", {
      value,
      type: typeof value,
    });

    const allowedValues = ["auto", "native", "pdf-text", "mistral-ocr"];

    // Handle null/undefined gracefully (Stage 3.1 defensive pattern)
    if (!value) {
      const defaultValue = this.defaultValue || "auto";
      logDebug(
        "PDF engine parameter: null/undefined value, using default:",
        defaultValue
      );
      return defaultValue;
    }

    // Ensure string type and validate against allowed values
    const stringValue = String(value);
    const isValid = allowedValues.includes(stringValue);

    if (isValid) {
      logDebug("PDF engine parameter: valid value accepted:", stringValue);
      return stringValue;
    } else {
      const defaultValue = this.defaultValue || "auto";
      logWarn("PDF engine parameter: invalid value, using default:", {
        invalid: stringValue,
        default: defaultValue,
        allowed: allowedValues,
      });
      return defaultValue;
    }
  }

  /**
   * Override getType to specify string type (Stage 3.4 fix)
   * Prevents base class numeric validation warnings
   * @returns {string} Parameter type
   */
  getType() {
    return "string";
  }

  /**
   * Reset the control
   */
  reset() {
    this.currentFile = null;
    this.costEstimates.clear();
    this.setValue(this.defaultValue);
    this.hide();

    if (this.costElement) {
      this.costElement.textContent = "";
    }

    logInfo("PDF engine control reset");
  }
}
