/**
 * Markdown Examples Loader
 * Loads and manages markdown example content for the editor
 */
const MarkdownExamplesLoader = (function () {
  // Logging configuration (scoped within IIFE)
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
      console.error("[MarkdownExamples]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MarkdownExamples]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MarkdownExamples]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MarkdownExamples]", message, ...args);
  }
  // State
  let examples = [];
  let isInitialised = false;
  let isLoading = false;

  // Configuration
  const CONFIG = {
    EXAMPLES_PATH: "presets/markdown-examples.json",
    SELECT_ID: "markdownExampleSelect",
    LOAD_BUTTON_ID: "loadExampleButton",
    CLEAR_BUTTON_ID: "clearExampleButton",
  };

  /**
   * Initialise the examples loader
   * @returns {Promise<boolean>} Success status
   */
  async function initialise() {
    if (isInitialised) {
      logWarn("Already initialised");
      return true;
    }

    try {
      logInfo("Initialising markdown examples loader");

      // Load examples from JSON
      await loadExamples();

      // Set up UI event listeners
      setupEventListeners();

      isInitialised = true;
      logInfo("Markdown examples loader initialised successfully");
      return true;
    } catch (error) {
      logError("Failed to initialise markdown examples loader:", error);
      return false;
    }
  }

  /**
   * Load examples from JSON file
   * @returns {Promise<void>}
   */
  async function loadExamples() {
    if (isLoading) {
      logWarn("Already loading examples");
      return;
    }

    isLoading = true;

    try {
      logInfo(`Loading examples from ${CONFIG.EXAMPLES_PATH}`);

      const response = await fetch(CONFIG.EXAMPLES_PATH);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.examples || !Array.isArray(data.examples)) {
        throw new Error("Invalid JSON structure: missing examples array");
      }

      examples = data.examples;

      logInfo(`Loaded ${examples.length} example(s)`);

      // Populate the select dropdown
      populateSelectDropdown();
    } catch (error) {
      logError("Failed to load examples:", error);
      showErrorNotification("Failed to load markdown examples");
      examples = [];
    } finally {
      isLoading = false;
    }
  }

  /**
   * Populate the select dropdown with examples
   */
  function populateSelectDropdown() {
    const selectElement = document.getElementById(CONFIG.SELECT_ID);

    if (!selectElement) {
      logError("Select element not found");
      return;
    }

    // Clear existing options except the first (placeholder)
    while (selectElement.options.length > 1) {
      selectElement.remove(1);
    }

    // Group examples by category
    const groupedExamples = groupByCategory(examples);

    // Add options to select
    Object.keys(groupedExamples)
      .sort()
      .forEach((category) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = capitaliseCategory(category);

        groupedExamples[category].forEach((example) => {
          const option = document.createElement("option");
          option.value = example.id;
          option.textContent = `${example.title} (${example.difficulty})`;
          optgroup.appendChild(option);
        });

        selectElement.appendChild(optgroup);
      });

    logDebug("Populated select dropdown with examples");
  }

  /**
   * Group examples by category
   * @param {Array} examplesList - List of examples
   * @returns {Object} Grouped examples
   */
  function groupByCategory(examplesList) {
    return examplesList.reduce((groups, example) => {
      const category = example.category || "general";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(example);
      return groups;
    }, {});
  }

  /**
   * Capitalise category name
   * @param {string} category - Category name
   * @returns {string} Capitalised category
   */
  function capitaliseCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Set up event listeners for UI controls
   */
  function setupEventListeners() {
    const loadButton = document.getElementById(CONFIG.LOAD_BUTTON_ID);
    const clearButton = document.getElementById(CONFIG.CLEAR_BUTTON_ID);
    const selectElement = document.getElementById(CONFIG.SELECT_ID);

    if (loadButton) {
      loadButton.addEventListener("click", handleLoadExample);
    } else {
      logWarn("Load button not found");
    }

    if (clearButton) {
      clearButton.addEventListener("click", handleClearExample);
    } else {
      logWarn("Clear button not found");
    }

    if (selectElement) {
      selectElement.addEventListener("change", handleSelectChange);
    } else {
      logWarn("Select element not found");
    }

    logDebug("Event listeners set up");
  }

  /**
   * Handle select change event
   */
  function handleSelectChange() {
    const selectElement = document.getElementById(CONFIG.SELECT_ID);
    const loadButton = document.getElementById(CONFIG.LOAD_BUTTON_ID);

    if (!selectElement || !loadButton) return;

    // Enable/disable load button based on selection
    loadButton.disabled = selectElement.value === "";
  }

  /**
   * Handle load example button click
   */
  function handleLoadExample() {
    const selectElement = document.getElementById(CONFIG.SELECT_ID);

    if (!selectElement) {
      logError("Select element not found");
      return;
    }

    const selectedId = selectElement.value;

    if (!selectedId) {
      logWarn("No example selected");
      return;
    }

    loadExampleById(selectedId);
  }

  /**
   * Handle clear example button click
   */
  function handleClearExample() {
    if (typeof window.clearMarkdownEditor === "function") {
      window.clearMarkdownEditor();
      logInfo("Cleared markdown editor");

      // Show notification
      if (typeof notifyInfo === "function") {
        notifyInfo("Editor cleared");
      }
    } else {
      logError("clearMarkdownEditor function not available");
    }
  }

  /**
   * Load example by ID into the markdown editor
   * @param {string} exampleId - Example ID
   */
  function loadExampleById(exampleId) {
    const example = examples.find((ex) => ex.id === exampleId);

    if (!example) {
      logError(`Example not found: ${exampleId}`);
      showErrorNotification("Example not found");
      return;
    }

    try {
      logInfo(`Loading example: ${example.title}`);

      // Check if markdown editor is available
      if (typeof window.loadMarkdownContent !== "function") {
        throw new Error("Markdown editor not available");
      }

      // Load content into editor
      window.loadMarkdownContent(example.markdown);

      // Update live editor if available
      if (
        window.markdownLiveEditor &&
        window.markdownLiveEditor.isInitialised
      ) {
        window.markdownLiveEditor.setContent(example.markdown);
        logDebug("Updated live editor with example content");
      } else {
        logDebug("Live editor not available or not initialised");
      }

      // Show success notification
      showSuccessNotification(`Loaded: ${example.title}`);

      logInfo(`Successfully loaded example: ${example.title}`);
    } catch (error) {
      logError("Failed to load example:", error);
      showErrorNotification("Failed to load example");
    }
  }

  /**
   * Get example by ID
   * @param {string} exampleId - Example ID
   * @returns {Object|null} Example object or null
   */
  function getExampleById(exampleId) {
    return examples.find((ex) => ex.id === exampleId) || null;
  }

  /**
   * Get all examples
   * @returns {Array} All examples
   */
  function getAllExamples() {
    return [...examples];
  }

  /**
   * Get examples by category
   * @param {string} category - Category name
   * @returns {Array} Examples in category
   */
  function getExamplesByCategory(category) {
    return examples.filter((ex) => ex.category === category);
  }

  /**
   * Show success notification
   * @param {string} message - Message to display
   */
  function showSuccessNotification(message) {
    if (typeof notifySuccess === "function") {
      notifySuccess(message);
    } else {
      logWarn("notifySuccess not available, using console");
      console.log(`✓ ${message}`);
    }
  }

  /**
   * Show error notification
   * @param {string} message - Message to display
   */
  function showErrorNotification(message) {
    if (typeof notifyError === "function") {
      notifyError(message);
    } else {
      logWarn("notifyError not available, using console");
      console.error(`✗ ${message}`);
    }
  }

  // Public API
  return {
    initialise,
    loadExampleById,
    getExampleById,
    getAllExamples,
    getExamplesByCategory,
    isInitialised: () => isInitialised,
    isLoading: () => isLoading,
  };
})();

// Export for ES6 modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = MarkdownExamplesLoader;
}

// Global exposure for testing
window.MarkdownExamplesLoader = MarkdownExamplesLoader;
