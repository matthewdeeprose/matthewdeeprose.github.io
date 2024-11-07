import { ColorValidator } from "../utils/colorValidation.js";

class ColorTextHandler {
  /**
   * Creates a new ColorTextHandler instance
   * @param {Object} options Configuration options
   * @param {ColorStorage} options.colorStorage Reference to ColorStorage instance
   * @param {UIManager} options.uiManager Reference to UIManager instance
   */
  constructor(options) {
    this.colorStorage = options.colorStorage;
    this.uiManager = options.uiManager;
    this.textarea = document.getElementById("colorTextInput");
    this.errorDiv = document.getElementById("colorInputError");
    this.submitButton = document.querySelector(".submit-button");
    this.clearButton = document.querySelector(".clear-button");
    this.sampleButton = document.querySelector(".sample-button");

    this.initializeEventListeners();
  }

  /**
   * Set up event listeners for the text input functionality
   */
  initializeEventListeners() {
    // Add colors when submit button is clicked
    this.submitButton?.addEventListener("click", () => this.processInput());

    // Clear input when clear button is clicked
    this.clearButton?.addEventListener("click", () => this.clearInput());

    // Insert sample colors when sample button is clicked
    this.sampleButton?.addEventListener("click", () =>
      this.insertSampleColors()
    );

    // Real-time validation as user types
    this.textarea?.addEventListener("input", () => this.validateInput());

    // Handle keyboard shortcuts
    this.textarea?.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + Enter to submit
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.processInput();
      }
    });
  }

  /**
   * Validate and process the text input
   * @returns {Array} Array of processed color objects
   */
  async processInput() {
    console.log("Starting processInput...");
    const text = this.textarea?.value.trim();
    if (!text) {
      this.showError("Please enter some colours");
      return;
    }

    try {
      const colors = this.parseColors(text);
      console.log("Parsed colors:", colors);

      if (colors.length === 0) {
        this.showError("No valid colours found");
        return;
      }

      if (!this.colorStorage) {
        throw new Error("Color storage not initialized");
      }

      // Load colors into storage
      console.log("Loading colors into storage...");
      const initialStats = this.colorStorage.loadColors(colors);
      console.log("Initial stats:", initialStats);

      // Initialize active colors
      console.log("Initializing active colors...");
      const activeStats = this.colorStorage.initActiveColors();
      console.log("Active stats:", activeStats);

      // Pre-validate combinations
      console.log("Pre-validating combinations...");
      const validationStats = this.colorStorage.preValidateColorCombinations();
      console.log("Validation stats:", validationStats);

      if (this.uiManager) {
        console.log("Updating UI...");
        this.uiManager.clearError();

        // Verify UIManager has the method
        console.log("UIManager methods:", Object.keys(this.uiManager));
        console.log(
          "displayUploadStats exists:",
          !!this.uiManager.displayUploadStats
        );

        // Try to update stats
        try {
          console.log("Calling displayUploadStats...");
          this.uiManager.displayUploadStats(validationStats);
          console.log("displayUploadStats completed");
        } catch (error) {
          console.error("Error in displayUploadStats:", error);
        }

        // Update color management UI
        console.log("Updating color management UI...");
        this.uiManager.updateColorManagementUI(
          this.colorStorage.colors,
          this.colorStorage.activeColors,
          (colorHex) => {
            const stats = this.colorStorage.toggleColor(colorHex);
            this.uiManager.displayUploadStats(stats);
          },
          (active) => {
            const stats = this.colorStorage.toggleAllColors(active);
            this.uiManager.displayUploadStats(stats);
          }
        );
        console.log("Color management UI updated");
      } else {
        console.warn("UIManager not available");
      }

      // Clear input after successful processing
      this.clearInput();

      // Announce success to screen readers
      this.showError(
        `Successfully added ${colors.length} colours. ${validationStats.validBackgrounds} valid background colours available.`,
        "success"
      );

      return colors;
    } catch (error) {
      console.error("Error in processInput:", error);
      this.showError(error.message);
      return [];
    }
  }
  /**
   * Parse color input text into color objects
   * @param {string} text Input text to parse
   * @returns {Array} Array of color objects
   */
  parseColors(text) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    const colors = [];
    const usedHexCodes = new Set();
    let autoNameCounter = 1;

    for (let [index, line] of lines.entries()) {
      try {
        let name, hexCode;

        // Try comma-separated format
        let parts = line.split(",").map((part) => part.trim());

        // If not comma-separated, try colon-separated
        if (parts.length === 1) {
          parts = line.split(":").map((part) => part.trim());
        }

        // Handle different formats
        if (parts.length === 2) {
          // Name and hex provided
          [name, hexCode] = parts;
        } else if (parts.length === 1 && parts[0].startsWith("#")) {
          // Only hex provided
          hexCode = parts[0];
          name = `Colour ${autoNameCounter++}`;
        } else {
          throw new Error(`Invalid format in line ${index + 1}`);
        }

        // Validate hex code - Changed to use imported ColorValidator
        hexCode = ColorValidator.validateHex(hexCode);

        // Check for duplicates
        if (usedHexCodes.has(hexCode)) {
          throw new Error(`Duplicate colour ${hexCode} in line ${index + 1}`);
        }

        usedHexCodes.add(hexCode);
        colors.push({ colourHex: hexCode, name: name });
      } catch (error) {
        throw new Error(`Line ${index + 1}: ${error.message}`);
      }
    }

    return colors;
  }

  /**
   * Display error message
   * @param {string} message Error message to display
   * @param {string} type Type of message ('error' or 'success')
   */
  showError(message, type = "error") {
    if (this.errorDiv) {
      this.errorDiv.textContent = message;
      this.errorDiv.className = `error-message ${type}`;
      this.errorDiv.setAttribute("role", "alert");
    }
  }

  /**
   * Clear the input and error message
   */
  clearInput() {
    if (this.textarea) {
      this.textarea.value = "";
    }
    if (this.errorDiv) {
      this.errorDiv.textContent = "";
      this.errorDiv.removeAttribute("role");
    }
  }

  /**
   * Insert sample colors into the textarea
   */
  insertSampleColors() {
    const sampleColors =
      "White, #FFFFFF\n" +
      "Black, #000000\n" +
      "Sky Blue: #87CEEB\n" +
      "#FF0000";

    if (this.textarea) {
      this.textarea.value = sampleColors;
      this.textarea.focus();
      this.validateInput();
    }
  }

  /**
   * Validate input as user types
   */
  validateInput() {
    const text = this.textarea?.value.trim();
    if (!text) {
      this.showError("");
      return;
    }

    try {
      const colors = this.parseColors(text);
      if (colors.length > 0) {
        this.showError(`${colors.length} valid colours found`, "success");
      } else {
        this.showError("No valid colours found");
      }
    } catch (error) {
      this.showError(error.message);
    }
  }
}

export { ColorTextHandler };
