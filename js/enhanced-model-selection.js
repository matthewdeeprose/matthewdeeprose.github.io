/**
 * Enhanced Model Selection Integration - Complete Version with Standard Logging
 * Provides advanced filtering for OpenRouter's AI models with accurate registry integration
 *
 * Features:
 * - Accurate free model detection from registry data
 * - Disabled model exclusion
 * - Search, provider, capability, and cost range filtering
 * - Full WCAG 2.2 AA accessibility compliance
 * - British spelling throughout
 * - Configurable logging levels
 *
 * File: js/enhanced-model-selection.js
 */

const EnhancedModelSelection = (function () {
  // ============================================================================
  // LOGGING CONFIGURATION (IIFE scope)
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  let currentLogLevel = LOG_LEVELS.WARN; // ✅ Changed from const to let
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel; // ✅ Use currentLogLevel instead of DEFAULT_LOG_LEVEL
  }

  // Initialization state tracking (Fix for undefined variables - Stage 4 Fix 2)
  let initializationComplete = false;
  let isInitializing = false;

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[EnhancedModelSelection] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EnhancedModelSelection] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EnhancedModelSelection] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EnhancedModelSelection] ${message}`, ...args);
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // State management
  let currentFilters = {
    search: "",
    freeOnly: false,
    costRange: "",
    capabilities: [],
    provider: "",
    sortByCost: false,
  };

  let allModels = [];
  let filteredModels = [];
  let elements = {};
  let isInitialised = false;
  let modelRegistryRef = null;
  let modelManagerRef = null;
  let isUpdatingSelect = false; // Flag to prevent recursive updates

  // ============================================================================
  // MODEL REGISTRY DETECTION AND LOADING
  // ============================================================================

  /**
   * Detect and connect to your model registry system
   */
  function detectModelRegistry() {
    // Strategy 1: Check for your specific model-definitions export
    try {
      if (window.modelRegistry) {
        logInfo("Found modelRegistry from model-definitions.js");
        return { type: "model-definitions", registry: window.modelRegistry };
      }
    } catch (error) {
      logDebug("Could not access window.modelRegistry:", error);
    }

    // Strategy 2: Check if it's available through module imports
    try {
      if (typeof modelRegistry !== "undefined") {
        logInfo("Found modelRegistry via module scope");
        return { type: "module-scope", registry: modelRegistry };
      }
    } catch (error) {
      logDebug("modelRegistry not in module scope:", error);
    }

    // Strategy 3: Check if UI controller has access
    if (window.uiController && window.uiController.modelManager) {
      logInfo(
        "Found modelManager via uiController - will try to access registry"
      );
      return {
        type: "model-manager",
        manager: window.uiController.modelManager,
      };
    }

    logInfo("No model registry found, will parse from existing select element");
    return { type: "fallback", registry: null };
  }

  /**
   * Load models from registry with proper disabled model exclusion
   */
  function loadModelsFromRegistry() {
    const detection = detectModelRegistry();

    try {
      switch (detection.type) {
        case "model-definitions":
        case "module-scope":
          return loadFromYourModelRegistry(detection.registry);

        case "model-manager":
          return loadViaModelManager(detection.manager);

        case "fallback":
        default:
          return loadModelsFromExistingSelectWithCarefulDetection();
      }
    } catch (error) {
      logError(
        "Error loading models from registry, falling back to careful select parsing",
        error
      );
      return loadModelsFromExistingSelectWithCarefulDetection();
    }
  }

  /**
   * Enhanced loadFromYourModelRegistry with proper default model handling
   */
  function loadFromYourModelRegistry(registry) {
    try {
      if (!registry || typeof registry.getAllModels !== "function") {
        logWarn("Registry found but getAllModels method not available");
        return false;
      }

      const allRegistryModels = registry.getAllModels();

      // Filter out disabled models BEFORE processing
      const enabledModels = allRegistryModels.filter(
        (model) => !model.disabled
      );
      const disabledCount = allRegistryModels.length - enabledModels.length;

      // Use the EXACT data from your registry - INCLUDING isDefault property!
      allModels = enabledModels.map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        category: model.category,
        description: model.description,
        isFree: model.isFree,
        isDefault: model.isDefault || false, // ← IMPORTANT: Preserve isDefault
        costs: model.costs,
        capabilities: model.capabilities || ["text"],
        disabled: false, // All models in this array are enabled
      }));

      modelRegistryRef = registry;

      // Log detailed analysis including default model detection
      const freeModels = allModels.filter((m) => m.isFree);
      const paidModels = allModels.filter((m) => !m.isFree);
      const defaultModels = allModels.filter((m) => m.isDefault);

      logInfo(
        "Successfully loaded models from YOUR model registry with accurate data (disabled models excluded)",
        {
          totalRegistryModels: allRegistryModels.length,
          disabledModels: disabledCount,
          enabledModels: allModels.length,
          freeModels: freeModels.length,
          paidModels: paidModels.length,
          defaultModels: defaultModels.length,
          defaultModelIds: defaultModels.map((m) => m.id),
          exclusionRate:
            disabledCount > 0
              ? `${((disabledCount / allRegistryModels.length) * 100).toFixed(
                  1
                )}% excluded`
              : "No disabled models",
        }
      );

      return true;
    } catch (error) {
      logError("Error loading from your model registry", error);
      return false;
    }
  }

  /**
   * Try to access registry through model manager
   */
  function loadViaModelManager(manager) {
    try {
      // Look for registry reference in the manager
      let registryRef = null;

      // Check various possible locations
      if (manager.modelRegistry) {
        registryRef = manager.modelRegistry;
      } else if (manager.registry) {
        registryRef = manager.registry;
      } else if (window.modelRegistry) {
        // Manager exists but maybe registry is global
        registryRef = window.modelRegistry;
      }

      if (registryRef) {
        logInfo("Found registry reference through model manager");
        return loadFromYourModelRegistry(registryRef);
      }

      // If no registry access, try to read from populated select but cross-reference
      logInfo(
        "No direct registry access via manager, attempting enhanced select parsing"
      );
      return loadModelsFromExistingSelectWithRegistryLookup();
    } catch (error) {
      logError("Error loading via ModelManager", error);
      return false;
    }
  }

  /**
   * Enhanced select parsing that tries to look up each model in registry for accurate data
   */
  function loadModelsFromExistingSelectWithRegistryLookup() {
    const existingSelect = document.querySelector("#model-select");
    if (!existingSelect || existingSelect.options.length <= 1) {
      return false;
    }

    allModels = [];
    let registryLookupCount = 0;
    let patternDetectionCount = 0;
    let disabledExcludedCount = 0;

    const optgroups = existingSelect.querySelectorAll("optgroup");

    optgroups.forEach((optgroup) => {
      const category = optgroup.label || "Unknown";
      const options = optgroup.querySelectorAll("option[value]");

      options.forEach((option) => {
        if (!option.value) return;

        const modelText = option.textContent.trim();
        const modelId = option.value;

        const match = modelText.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (!match) return;

        const [, name, provider] = match;

        // Try to look up this specific model in registry
        let modelData = null;
        let isDisabled = false;

        // Try multiple ways to access registry
        const registryRefs = [
          window.modelRegistry,
          window.uiController?.modelManager?.modelRegistry,
          window.uiController?.modelManager?.registry,
        ].filter(Boolean);

        for (const registryRef of registryRefs) {
          try {
            if (typeof registryRef.getModel === "function") {
              const registryModel = registryRef.getModel(modelId, true); // silent
              if (registryModel) {
                // Check if model is disabled
                if (registryModel.disabled) {
                  isDisabled = true;
                  disabledExcludedCount++;
                  logDebug(`Excluding disabled model: ${modelId}`);
                  break; // Don't process disabled models
                }

                modelData = {
                  id: modelId,
                  name: registryModel.name,
                  provider: registryModel.provider,
                  category: category.replace(/[^a-zA-Z0-9]/g, ""),
                  description: registryModel.description,
                  isFree: registryModel.isFree, // ← ACCURATE DATA
                  costs: registryModel.costs, // ← ACCURATE DATA
                  capabilities: registryModel.capabilities || ["text"],
                  disabled: false, // Only enabled models reach here
                };
                registryLookupCount++;
                logDebug(
                  `Found accurate registry data for ${modelId}: isFree=${registryModel.isFree}, disabled=false`
                );
                break;
              }
            }
          } catch (error) {
            // Continue to next registry or fallback
          }
        }

        // Skip disabled models entirely
        if (isDisabled) {
          return;
        }

        // If no registry data found, use conservative fallback (assuming enabled)
        if (!modelData) {
          modelData = {
            id: modelId,
            name: name.trim(),
            provider: provider.toLowerCase().trim(),
            category: category.replace(/[^a-zA-Z0-9]/g, ""),
            description: `${name} from ${provider}`,
            isFree: isExplicitlyFreeFromId(modelId, name, category),
            costs: isExplicitlyFreeFromId(modelId, name, category)
              ? { input: 0, output: 0 }
              : estimateCostsFromName(name),
            capabilities: inferCapabilitiesFromCategory(category, name),
            disabled: false, // Assume enabled if not in registry
          };
          patternDetectionCount++;
        }

        allModels.push(modelData);
      });
    });

    logInfo("Enhanced select parsing complete with disabled model exclusion", {
      totalModels: allModels.length,
      registryLookups: registryLookupCount,
      patternDetections: patternDetectionCount,
      disabledExcluded: disabledExcludedCount,
      freeModels: allModels.filter((m) => m.isFree).length,
      accuracy:
        registryLookupCount > 0
          ? "High (registry data with disabled exclusion)"
          : "Medium (pattern detection)",
    });

    return allModels.length > 0;
  }

  /**
   * Fallback for when no registry access is possible
   */
  function loadModelsFromExistingSelectWithCarefulDetection() {
    logWarn(
      "Using careful pattern detection - disabled models cannot be detected"
    );
    logWarn(
      "For complete disabled model exclusion, ensure modelRegistry is globally accessible"
    );

    const existingSelect = document.querySelector("#model-select");
    if (!existingSelect || existingSelect.options.length <= 1) {
      return false;
    }

    allModels = [];
    const optgroups = existingSelect.querySelectorAll("optgroup");

    optgroups.forEach((optgroup) => {
      const category = optgroup.label || "Unknown";
      const options = optgroup.querySelectorAll("option[value]");

      options.forEach((option) => {
        if (!option.value) return;

        const modelText = option.textContent.trim();
        const modelId = option.value;

        const match = modelText.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (!match) return;

        const [, name, provider] = match;

        const isFree = isExplicitlyFreeFromId(modelId, name, category);

        // NOTE: In fallback mode, we cannot detect disabled models
        // All models from the select are assumed to be enabled
        allModels.push({
          id: modelId,
          name: name.trim(),
          provider: provider.toLowerCase().trim(),
          category: category.replace(/[^a-zA-Z0-9]/g, ""),
          description: `${name} from ${provider}`,
          isFree: isFree,
          costs: isFree ? { input: 0, output: 0 } : estimateCostsFromName(name),
          capabilities: inferCapabilitiesFromCategory(category, name),
          disabled: false, // Cannot detect in fallback mode
        });
      });
    });

    logWarn(
      "Careful pattern detection complete - disabled model exclusion not available in fallback mode",
      {
        totalModels: allModels.length,
        conservativeFreeCount: allModels.filter((m) => m.isFree).length,
        warning:
          "Disabled models may be included - registry access recommended",
      }
    );

    return allModels.length > 0;
  }

  /**
   * Format cost information for display in dropdown options
   * @param {Object} model - Model with cost data
   * @returns {string} Formatted cost text
   */
  function formatCostForDisplay(model) {
    if (!model) return "";

    // Handle free models
    if (model.isFree || !model.costs) {
      return " - Free";
    }

    // Handle models with cost data
    if (model.costs.input !== undefined && model.costs.output !== undefined) {
      return ` - $${model.costs.input}/$${model.costs.output}`;
    }

    // Handle partial cost data
    if (model.costs.input !== undefined) {
      return ` - $${model.costs.input} input`;
    }

    if (model.costs.output !== undefined) {
      return ` - $${model.costs.output} output`;
    }

    // Fallback for unknown cost structure
    return " - Pricing available";
  }

  /**
   * Get cost value for sorting (uses input cost as primary sort key)
   * @param {Object} model - Model with cost data
   * @returns {number} Cost value for sorting (0 for free models)
   */
  function getCostSortValue(model) {
    if (!model) return Infinity;

    // Free models get 0 to appear first
    if (model.isFree || !model.costs) {
      return 0;
    }

    // Use input cost as primary sort key
    if (model.costs.input !== undefined) {
      return parseFloat(model.costs.input);
    }

    // Fallback to output cost if input not available
    if (model.costs.output !== undefined) {
      return parseFloat(model.costs.output);
    }

    // Unknown cost structure - sort to end
    return Infinity;
  }

  /**
   * Sort models by cost (free first, then by input cost ascending)
   * @param {Array} models - Array of models to sort
   * @returns {Array} Sorted models
   */
  function sortModelsByCost(models) {
    return [...models].sort((a, b) => {
      const costA = getCostSortValue(a);
      const costB = getCostSortValue(b);

      // If costs are equal, sort alphabetically by name
      if (costA === costB) {
        return a.name.localeCompare(b.name);
      }

      return costA - costB;
    });
  }

  /**
   * Generate option text with cost information
   * @param {Object} model - Model data
   * @param {boolean} showCosts - Whether to show cost information
   * @returns {string} Formatted option text
   */
  function generateOptionText(model, showCosts = true) {
    if (!model) return "";

    // Base format: "Model Name (provider)"
    let optionText = `${model.name} (${model.provider})`;

    // Add cost information if enabled
    if (showCosts) {
      const costDisplay = formatCostForDisplay(model);
      optionText += costDisplay;
    }

    // Handle very long text (mobile considerations)
    if (optionText.length > 80) {
      logWarn("Long option text detected:", optionText.length, "characters");
      // Could implement truncation here if needed
    }

    return optionText;
  }

  // ============================================================================
  // PATTERN DETECTION HELPERS
  // ============================================================================

  /**
   * Very conservative free model detection - only flag as free if explicitly indicated
   */
  function isExplicitlyFreeFromId(modelId, name, category) {
    // Only return true if we have explicit indicators

    // 1. Explicit free indicators
    if (
      modelId.includes(":free") ||
      name.toLowerCase().includes("free") ||
      name.toLowerCase().includes("(free)") ||
      category.toLowerCase().includes("free")
    ) {
      return true;
    }

    // 2. Known free tier patterns - be very specific
    const nameLower = name.toLowerCase();

    // Only flag as free if model ID explicitly indicates free tier
    if (modelId.includes(":free")) {
      return true;
    }

    // OpenChat and Undi95 are generally free providers
    if (modelId.startsWith("openchat/") || modelId.startsWith("undi95/")) {
      return true;
    }

    // Specific known free models (add more as needed)
    const knownFreeModels = [
      "meta-llama/llama-3.2-1b-instruct",
      "meta-llama/llama-3.2-3b-instruct",
      "mistralai/mistral-7b-instruct",
      "microsoft/phi-3-mini-128k-instruct",
    ];

    if (knownFreeModels.includes(modelId)) {
      return true;
    }

    // Default to NOT free unless explicitly indicated
    return false;
  }

  /**
   * Infer capabilities from category and name
   */
  function inferCapabilitiesFromCategory(category, name = "") {
    const capabilities = ["text"]; // All models have text capability

    const categoryLower = category.toLowerCase();
    const nameLower = name.toLowerCase();

    // Vision capabilities
    if (
      categoryLower.includes("vision") ||
      categoryLower.includes("multimodal") ||
      nameLower.includes("vision") ||
      nameLower.includes("multimodal")
    ) {
      capabilities.push("vision");
    }

    // Code capabilities
    if (
      categoryLower.includes("code") ||
      categoryLower.includes("coding") ||
      categoryLower.includes("technical") ||
      nameLower.includes("code") ||
      nameLower.includes("codestral") ||
      nameLower.includes("deepseek") ||
      nameLower.includes("copilot")
    ) {
      capabilities.push("code");
    }

    // Reasoning capabilities
    if (
      categoryLower.includes("reasoning") ||
      nameLower.includes("reasoning") ||
      nameLower.includes("r1") ||
      nameLower.includes("o1") ||
      nameLower.includes("claude") ||
      nameLower.includes("maestro") ||
      nameLower.includes("magistral")
    ) {
      capabilities.push("reasoning");
    }

    // Tool calling capabilities - most modern models support this
    if (
      !nameLower.includes("7b") &&
      !nameLower.includes("3b") &&
      !nameLower.includes("1b")
    ) {
      capabilities.push("tools");
    }

    return capabilities;
  }

  /**
   * Estimate costs from model name
   */
  function estimateCostsFromName(name) {
    const nameLower = name.toLowerCase();

    // Mini/Small models
    if (
      nameLower.includes("mini") ||
      nameLower.includes("nano") ||
      nameLower.includes("7b") ||
      nameLower.includes("3b") ||
      nameLower.includes("small")
    ) {
      return { input: 0.5, output: 1.5 };
    }

    // Large/Opus models
    if (
      nameLower.includes("large") ||
      nameLower.includes("opus") ||
      nameLower.includes("70b") ||
      nameLower.includes("405b")
    ) {
      return { input: 15.0, output: 75.0 };
    }

    // Medium models
    if (
      nameLower.includes("medium") ||
      nameLower.includes("sonnet") ||
      nameLower.includes("32b")
    ) {
      return { input: 3.0, output: 15.0 };
    }

    // Default
    return { input: 2.0, output: 10.0 };
  }

  /**
   * Find the appropriate default model to select
   */
  function findDefaultModel(models = filteredModels) {
    if (!models || models.length === 0) {
      logDebug("No models available to find default");
      return null;
    }

    // Strategy 1: Look for a model explicitly marked as default
    const explicitDefault = models.find((model) => model.isDefault === true);
    if (explicitDefault) {
      logDebug("Found explicit default model:", explicitDefault.id);
      return explicitDefault;
    }

    // Strategy 2: Check what's currently selected in the DOM (ModelManager's choice)
    const modelSelect =
      elements.modelSelect || document.getElementById("model-select");
    if (modelSelect && modelSelect.value) {
      const currentlySelected = models.find(
        (model) => model.id === modelSelect.value
      );
      if (currentlySelected) {
        logDebug(
          "Using currently selected model as default:",
          currentlySelected.id
        );
        return currentlySelected;
      }
    }

    // Strategy 3: Fall back to first available model
    logDebug("No explicit default found, using first available:", models[0].id);
    return models[0];
  }

  /**
   * Enhanced initialization that respects default model selection
   */
  function init() {
    if (isInitialised) {
      logInfo("Already initialised");
      return true;
    }

    logInfo("Starting enhanced model selection initialization...");

    // Check for model registry access first
    const registryAccess = detectModelRegistry();
    if (!registryAccess || registryAccess.type === "fallback") {
      logDebug(
        "Model registry not found or not ready, initialization incomplete"
      );
      return false;
    }

    // Load models
    const modelsLoaded = loadModelsFromRegistry();
    if (!modelsLoaded || allModels.length === 0) {
      logDebug("Models not loaded yet, initialization incomplete");
      return false;
    }

    // Cache DOM elements
    if (!cacheElements()) {
      logError("Failed to cache required elements");
      return false;
    }

    // Set up event listeners
    setupEventListeners();

    // Initialize UI
    populateProviderOptions();
    applyFilters();
    updateFilterSummary();

    // ★ CRITICAL: Ensure default model is properly selected and model info is updated
    ensureDefaultModelSelection();

    isInitialised = true;
    logInfo("Initialization complete", {
      modelCount: allModels.length,
      categories: [...new Set(allModels.map((m) => m.category))].length,
      providers: [...new Set(allModels.map((m) => m.provider))].length,
      freeModels: allModels.filter((m) => m.isFree).length,
      defaultModels: allModels.filter((m) => m.isDefault).length,
    });

    return true;
  }

  /**
   * Ensure the correct default model is selected and model info is updated
   */
  function ensureDefaultModelSelection() {
    if (!elements.modelSelect || filteredModels.length === 0) {
      logWarn("Cannot ensure default selection - no select element or models");
      return;
    }

    const currentSelection = elements.modelSelect.value;
    const defaultModel = findDefaultModel(filteredModels);

    if (!defaultModel) {
      logWarn("No suitable default model found");
      return;
    }

    logInfo("Ensuring default model selection", {
      currentSelection: currentSelection,
      defaultModelId: defaultModel.id,
      defaultModelName: defaultModel.name,
      shouldUpdate: currentSelection !== defaultModel.id,
    });

    // If the current selection doesn't match our default model, update it
    if (currentSelection !== defaultModel.id) {
      logInfo(
        `Updating selection from ${currentSelection} to ${defaultModel.id}`
      );
      elements.modelSelect.value = defaultModel.id;
    }

    // Always update model info to ensure it matches the selected model
    // Use multiple strategies and delays to ensure it works
    setTimeout(() => {
      const finalSelectedModel = elements.modelSelect.value;
      logDebug("Updating model info for final selection:", finalSelectedModel);
      updateModelInfoDisplay(finalSelectedModel);
    }, 50);

    // Backup attempt with longer delay
    setTimeout(() => {
      const finalSelectedModel = elements.modelSelect.value;
      logDebug("Backup model info update for:", finalSelectedModel);
      updateModelInfoDisplay(finalSelectedModel);
    }, 200);
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  /**
   * Enhanced initialisation
   */
  function init() {
    if (isInitialised) {
      logWarn("Already initialised");
      return true;
    }

    logInfo("Starting initialisation...");

    // Check if required elements exist
    if (!document.getElementById("model-select")) {
      logError("Required model-select element not found");
      return false;
    }

    // Load models
    const modelsLoaded = loadModelsFromRegistry();

    if (!modelsLoaded || allModels.length === 0) {
      logDebug("Models not loaded yet, initialisation incomplete");
      return false;
    }

    // Cache DOM elements
    if (!cacheElements()) {
      logError("Failed to cache required elements");
      return false;
    }

    // Set up event listeners
    setupEventListeners();

    // Initialise UI
    populateProviderOptions();
    applyFilters();
    updateFilterSummary(); // ADD this line

    isInitialised = true;
    logInfo("Initialisation complete", {
      modelCount: allModels.length,
      categories: [...new Set(allModels.map((m) => m.category))].length,
      providers: [...new Set(allModels.map((m) => m.provider))].length,
      freeModels: allModels.filter((m) => m.isFree).length,
    });

    return true;
  }

  // ============================================================================
  // ENHANCED INITIALIZATION RELIABILITY SYSTEM
  // ============================================================================

  /**
   * Enhanced initialization system with multiple detection triggers
   */
  function setupReliableInitialization() {
    logInfo("Setting up reliable initialization system with multiple triggers");

    let initializationAttempts = 0;
    let isWatching = true;
    const maxWatchTime = 30000; // 30 seconds maximum watch time

    // Strategy 1: Enhanced MutationObserver with smarter thresholds
    const setupSmartObserver = () => {
      const modelSelect = document.getElementById("model-select");
      if (!modelSelect) return null;

      let lastStableCheck = 0;
      let stableCount = 0;
      const requiredStableChecks = 3; // Must be stable for 3 consecutive checks

      const observer = new MutationObserver((mutations) => {
        if (!isWatching || initializationComplete) return;

        const currentState = {
          optionCount: modelSelect.options.length,
          optgroupCount: modelSelect.querySelectorAll("optgroup").length,
          hasContent: Array.from(modelSelect.options).some(
            (opt) => opt.value && opt.textContent.includes("(")
          ),
          timestamp: Date.now(),
        };

        // Check if state is stable and meets criteria
        const isStable = currentState.timestamp - lastStableCheck > 500; // 500ms gap
        const meetsThreshold =
          currentState.optionCount > 30 && currentState.optgroupCount > 0;

        if (isStable && meetsThreshold) {
          stableCount++;
          lastStableCheck = currentState.timestamp;

          logDebug(
            `Smart observer check ${stableCount}/${requiredStableChecks}:`,
            currentState
          );

          if (stableCount >= requiredStableChecks) {
            logInfo("Smart observer detected stable population completion");
            attemptInitialization("smart-observer");
          }
        } else {
          stableCount = 0; // Reset if not stable
        }
      });

      observer.observe(modelSelect, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"],
      });

      return observer;
    };

    // Strategy 2: Periodic Smart Polling
    const setupSmartPolling = () => {
      let pollCount = 0;
      const maxPolls = 60; // 30 seconds at 500ms intervals

      const poll = () => {
        if (!isWatching || initializationComplete) return;

        pollCount++;
        const success = attemptInitialization("smart-polling");

        if (!success && pollCount < maxPolls) {
          setTimeout(poll, 500);
        } else if (pollCount >= maxPolls) {
          logWarn(
            "Smart polling reached maximum attempts, trying forced initialization"
          );
          attemptInitialization("forced-fallback");
        }
      };

      setTimeout(poll, 1000); // Start after 1 second
    };

    // Strategy 3: Event-driven Detection
    const setupEventDetection = () => {
      // Listen for custom events that might indicate model population
      const eventTypes = [
        "modelRegistryReady",
        "modelManagerInitialized",
        "modelsPopulated",
        "uiControllerReady",
      ];

      eventTypes.forEach((eventType) => {
        window.addEventListener(eventType, () => {
          logDebug(`Event-driven trigger received: ${eventType}`);
          setTimeout(() => attemptInitialization("event-driven"), 200);
        });
      });

      // Listen for select changes that might indicate population
      const modelSelect = document.getElementById("model-select");
      if (modelSelect) {
        let changeCount = 0;
        const changeHandler = () => {
          changeCount++;
          if (changeCount >= 2) {
            // Multiple changes suggest population
            logDebug(
              "Multiple select changes detected, attempting initialization"
            );
            setTimeout(() => attemptInitialization("select-changes"), 100);
            modelSelect.removeEventListener("change", changeHandler);
          }
        };

        modelSelect.addEventListener("change", changeHandler);
      }
    };

    // Strategy 4: Global State Monitoring
    const setupGlobalStateMonitoring = () => {
      let checkCount = 0;
      const maxChecks = 40;

      const checkGlobalState = () => {
        if (!isWatching || initializationComplete) return;

        checkCount++;

        // Check for various global readiness indicators
        const indicators = {
          modelRegistry: !!window.modelRegistry,
          uiController: !!window.uiController,
          modelManager: !!(
            window.uiController && window.uiController.modelManager
          ),
          modelsLoaded: !!window.modelRegistry?.getAllModels,
          selectPopulated:
            document.getElementById("model-select")?.options?.length > 30,
        };

        const readyCount = Object.values(indicators).filter(Boolean).length;

        logDebug(
          `Global state check ${checkCount}: ${readyCount}/5 indicators ready`,
          indicators
        );

        if (readyCount >= 4) {
          // Most indicators are ready
          logInfo("Global state monitoring detected system readiness");
          attemptInitialization("global-state");
        } else if (checkCount < maxChecks) {
          setTimeout(checkGlobalState, 750);
        }
      };

      setTimeout(checkGlobalState, 500);
    };

    // Unified initialization attempt function
    const attemptInitialization = (source) => {
      if (initializationComplete || isInitializing) return false;

      isInitializing = true; // Set initializing flag
      initializationAttempts++;
      logInfo(
        `Initialization attempt ${initializationAttempts} from ${source}`
      );

      const success = init(); // Call the main init function

      if (success) {
        initializationComplete = true;
        isInitializing = false; // Clear initializing flag on success
        isWatching = false;
        logInfo(
          `✅ Initialization successful via ${source} on attempt ${initializationAttempts}`
        );

        // Announce success
        announceFilterChange("Advanced model filters are now available");

        return true;
      }

      isInitializing = false; // Clear initializing flag when initialization fails
      return false;
    };

    // Start all detection strategies
    const observer = setupSmartObserver();
    setupSmartPolling();
    setupEventDetection();
    setupGlobalStateMonitoring();

    // Safety timeout
    setTimeout(() => {
      if (!initializationComplete) {
        isWatching = false;
        logWarn(
          "Reliable initialization timeout reached, attempting final forced initialization"
        );
        attemptInitialization("timeout-forced");
      }

      if (observer) observer.disconnect();
    }, maxWatchTime);

    logInfo(
      "Reliable initialization system activated with multiple detection strategies"
    );
  }

  // Update the main initialization to use the new system
  function initWithEnhancedReliability() {
    logInfo("Starting enhanced reliability initialization system");

    // Try immediate initialization first
    if (init()) {
      logInfo("✅ Immediate initialization successful");
      return true;
    }

    // Set up reliable detection system
    setupReliableInitialization();

    return false;
  }

  function setupDisclosureHandlers() {
    const disclosure = document.getElementById("model-filters-disclosure");
    if (!disclosure) return;

    disclosure.addEventListener("toggle", function () {
      const isOpen = disclosure.open;
      logDebug(`Filter disclosure ${isOpen ? "opened" : "closed"}`);

      // Announce state change to screen readers
      const announcement = isOpen
        ? "Advanced filters expanded"
        : "Advanced filters collapsed";
      announceFilterChange(announcement);
    });
  }
  /**
   * Cache DOM elements
   */
  function cacheElements() {
    elements = {
      searchInput: document.getElementById("model-search"),
      freeOnlyCheckbox: document.getElementById("filter-free-only"),
      costRangeSelect: document.getElementById("cost-range-select"),
      sortByCostCheckbox: document.getElementById("filter-sort-by-cost"), // ← ADD this line
      providerSelect: document.getElementById("provider-select"),
      capabilityCheckboxes: {
        vision: document.getElementById("filter-vision"),
        code: document.getElementById("filter-code"),
        reasoning: document.getElementById("filter-reasoning"),
        tools: document.getElementById("filter-tools"),
      },
      modelSelect: document.getElementById("model-select"),
      modelCount: document.getElementById("model-count"),
      resetButton: document.getElementById("reset-filters"),
    };

    return !!elements.modelSelect;
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Search input
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", handleSearchChange);
    }

    // Free only checkbox
    if (elements.freeOnlyCheckbox) {
      elements.freeOnlyCheckbox.addEventListener(
        "change",
        handleFreeOnlyChange
      );
    }

    // Cost range select
    if (elements.costRangeSelect) {
      elements.costRangeSelect.addEventListener(
        "change",
        handleCostRangeChange
      );
    }

    // Cost sorting checkbox
    if (elements.sortByCostCheckbox) {
      elements.sortByCostCheckbox.addEventListener(
        "change",
        handleSortByCostChange
      );
    }

    // Provider select
    if (elements.providerSelect) {
      elements.providerSelect.addEventListener("change", handleProviderChange);
    }

    // Capability checkboxes
    Object.values(elements.capabilityCheckboxes).forEach((checkbox) => {
      if (checkbox) {
        checkbox.addEventListener("change", handleCapabilityChange);
      }
    });

    // Reset filters button
    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", resetAllFilters);
      elements.resetButton.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          resetAllFilters();
        }
      });
    }

    // ADD disclosure handlers
    setupDisclosureHandlers();

    logDebug("Event listeners set up successfully");
  }

  // ADD this helper function for smart disclosure management
  window.toggleModelFilters = function () {
    const disclosure = document.getElementById("model-filters-disclosure");
    if (disclosure) {
      disclosure.open = !disclosure.open;
      return disclosure.open;
    }
    return false;
  };

  // ADD this helper function to open filters with a specific filter pre-set
  window.openFiltersWithFreeOnly = function () {
    const disclosure = document.getElementById("model-filters-disclosure");
    const freeCheckbox = document.getElementById("filter-free-only");
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleSearchChange(event) {
    currentFilters.search = event.target.value.toLowerCase().trim();

    logDebug("Search filter changed:", {
      searchTerm: currentFilters.search,
      searchLength: currentFilters.search.length,
      originalValue: event.target.value,
    });

    applyFilters();
    announceFilterChange(
      `Search updated: ${currentFilters.search || "cleared"}`
    );
  }

  function handleFreeOnlyChange(event) {
    currentFilters.freeOnly = event.target.checked;
    logInfo(`Free only filter changed to: ${currentFilters.freeOnly}`);
    applyFilters();
    announceFilterChange(
      `Free models only: ${currentFilters.freeOnly ? "enabled" : "disabled"}`
    );
  }

  function handleCostRangeChange(event) {
    currentFilters.costRange = event.target.value;
    applyFilters();
    const rangeText =
      event.target.selectedOptions[0]?.textContent || "any cost";
    announceFilterChange(`Cost range: ${rangeText}`);
  }

  function handleProviderChange(event) {
    currentFilters.provider = event.target.value;
    applyFilters();
    const providerText =
      event.target.selectedOptions[0]?.textContent || "all providers";
    announceFilterChange(`Provider: ${providerText}`);
  }

  function handleCapabilityChange(event) {
    const capability = event.target.value;
    if (event.target.checked) {
      if (!currentFilters.capabilities.includes(capability)) {
        currentFilters.capabilities.push(capability);
      }
    } else {
      currentFilters.capabilities = currentFilters.capabilities.filter(
        (cap) => cap !== capability
      );
    }
    applyFilters();
    announceFilterChange(
      `Capability filter updated: ${capability} ${
        event.target.checked ? "added" : "removed"
      }`
    );
  }

  function resetAllFilters() {
    logInfo("Resetting all filters");

    currentFilters = {
      search: "",
      freeOnly: false,
      costRange: "",
      capabilities: [],
      provider: "",
      sortByCost: false, // ← ADD this line
    };

    // Reset UI elements
    if (elements.searchInput) elements.searchInput.value = "";
    if (elements.freeOnlyCheckbox) elements.freeOnlyCheckbox.checked = false;
    if (elements.costRangeSelect) elements.costRangeSelect.value = "";
    if (elements.sortByCostCheckbox)
      elements.sortByCostCheckbox.checked = false; // ← ADD this line
    if (elements.providerSelect) elements.providerSelect.value = "";

    Object.values(elements.capabilityCheckboxes).forEach((checkbox) => {
      if (checkbox) checkbox.checked = false;
    });

    applyFilters();
    announceFilterChange("All filters reset");
    updateFilterSummary();

    if (elements.searchInput) elements.searchInput.focus();
  }

  function handleSortByCostChange(event) {
    currentFilters.sortByCost = event.target.checked;
    logInfo(`Cost sorting changed to: ${currentFilters.sortByCost}`);
    applyFilters();
    announceFilterChange(
      `Sort by cost: ${currentFilters.sortByCost ? "enabled" : "disabled"}`
    );
  }

  // ============================================================================
  // FILTERING LOGIC
  // ============================================================================

  function applyFilters() {
    logDebug("Applying filters with current state:", currentFilters);

    filteredModels = allModels.filter((model) => {
      // Search filter with enhanced logging
      if (currentFilters.search) {
        const searchLower = currentFilters.search;
        const modelName = model.name.toLowerCase();
        const modelProvider = model.provider.toLowerCase();
        const modelDescription = model.description.toLowerCase();

        const matchesSearch =
          modelName.includes(searchLower) ||
          modelProvider.includes(searchLower) ||
          modelDescription.includes(searchLower);

        logDebug(`Search check for "${model.name}":`, {
          searchTerm: searchLower,
          modelName,
          modelProvider,
          matchesName: modelName.includes(searchLower),
          matchesProvider: modelProvider.includes(searchLower),
          matchesDescription: modelDescription.includes(searchLower),
          overallMatch: matchesSearch,
        });

        if (!matchesSearch) return false;
      }

      // Free only filter
      if (currentFilters.freeOnly && !model.isFree) {
        logDebug(`Free filter excluded: ${model.name} (not free)`);
        return false;
      }

      // Cost range filter
      if (
        currentFilters.costRange &&
        !matchesCostRange(model, currentFilters.costRange)
      ) {
        logDebug(
          `Cost filter excluded: ${model.name} (cost: ${
            model.costs?.input || "unknown"
          })`
        );
        return false;
      }

      // Provider filter
      if (
        currentFilters.provider &&
        model.provider !== currentFilters.provider
      ) {
        logDebug(
          `Provider filter excluded: ${model.name} (provider: ${model.provider})`
        );
        return false;
      }

      // Capability filter
      if (currentFilters.capabilities.length > 0) {
        const hasRequiredCapabilities = currentFilters.capabilities.every(
          (capability) => model.capabilities.includes(capability)
        );
        if (!hasRequiredCapabilities) {
          logDebug(
            `Capability filter excluded: ${
              model.name
            } (missing capabilities: ${currentFilters.capabilities
              .filter((cap) => !model.capabilities.includes(cap))
              .join(", ")})`
          );
          return false;
        }
      }

      return true;
    });

    // Apply cost sorting if enabled
    if (currentFilters.sortByCost) {
      logDebug("Applying cost-based sorting...");
      filteredModels = sortModelsByCost(filteredModels);
    }

    logInfo("Filters applied", {
      totalModels: allModels.length,
      filteredCount: filteredModels.length,
      activeFilters: getActiveFiltersCount(),
      currentFilters: currentFilters,
      sortedByCost: currentFilters.sortByCost,
    });

    updateModelSelect();
    updateModelCount();
    updateFilterSummary();
  }

  function getActiveFiltersCount() {
    let count = 0;
    if (currentFilters.search) count++;
    if (currentFilters.freeOnly) count++;
    if (currentFilters.costRange) count++;
    if (currentFilters.sortByCost) count++;
    if (currentFilters.provider) count++;
    if (currentFilters.capabilities.length > 0) count++;
    return count;
  }

  /**
   * Check if a model matches the selected cost range
   * Free models are excluded from all cost ranges
   */
  function matchesCostRange(model, costRange) {
    // Free models are excluded from all cost range filters
    if (model.isFree) return false;

    // If no cost range specified, show all non-free models
    if (!costRange) return true;

    const inputCost = model.costs.input;

    switch (costRange) {
      case "0-1":
        return inputCost >= 0.00000000000001 && inputCost <= 1.0;
      case "1-5":
        return inputCost >= 1.01 && inputCost <= 5.0;
      case "5-10":
        return inputCost >= 5.01 && inputCost <= 10.0;
      case "10-20":
        return inputCost >= 10.01 && inputCost <= 20.0;
      case "20-50":
        return inputCost >= 20.01 && inputCost <= 50.0;
      case "50+":
        return inputCost >= 50.01;
      default:
        return true;
    }
  }

  // ============================================================================
  // UI UPDATES
  // ============================================================================

  // ============================================================================
  // ENHANCED MODEL INFO UPDATE SYSTEM
  // ============================================================================

  /**
   * Improved model info update system that works with multiple access methods
   */
  function updateModelInfoDisplay(modelId) {
    if (!modelId) {
      logDebug("No model ID provided for info update");
      return;
    }

    logDebug("Attempting to update model info display for:", modelId);

    // Strategy 1: Try direct ModelManager reference
    if (
      modelManagerRef &&
      typeof modelManagerRef.updateModelInfo === "function"
    ) {
      try {
        modelManagerRef.updateModelInfo(modelId);
        logDebug("Model info updated via direct ModelManager reference");
        return;
      } catch (error) {
        logWarn("Error updating model info via direct reference:", error);
      }
    }

    // Strategy 2: Try via global uiController
    if (window.uiController?.modelManager?.updateModelInfo) {
      try {
        window.uiController.modelManager.updateModelInfo(modelId);
        logDebug("Model info updated via global uiController");
        return;
      } catch (error) {
        logWarn("Error updating model info via uiController:", error);
      }
    }

    // Strategy 3: Try triggering the model select change event manually
    if (elements.modelSelect) {
      try {
        // Create and dispatch a change event to trigger any existing handlers
        const changeEvent = new Event("change", {
          bubbles: true,
          cancelable: true,
        });
        elements.modelSelect.dispatchEvent(changeEvent);
        logDebug("Triggered model select change event to update info");
        return;
      } catch (error) {
        logWarn("Error triggering model select change event:", error);
      }
    }

    // Strategy 4: Try direct DOM manipulation if we can find the model data
    if (allModels.length > 0) {
      try {
        updateModelInfoDOM(modelId);
        logDebug("Model info updated via direct DOM manipulation");
        return;
      } catch (error) {
        logWarn("Error updating model info via DOM manipulation:", error);
      }
    }

    logWarn("Could not update model info display - no working method found");
  }

  /**
   * Direct DOM manipulation fallback for updating model info
   */
  function updateModelInfoDOM(modelId) {
    const model = allModels.find((m) => m.id === modelId);
    if (!model) {
      logWarn("Model not found in allModels array:", modelId);
      return;
    }

    const modelInfoContainer = document.querySelector(".model-info");
    if (!modelInfoContainer) {
      logWarn("Model info container not found in DOM");
      return;
    }

    // Update the model info content
    const modelDetailsSummary = modelInfoContainer.querySelector(
      ".modelDetailsSummary"
    );
    if (modelDetailsSummary) {
      modelDetailsSummary.textContent = `More information about ${model.name}`;
    }

    // Update the model description
    const modelP = modelInfoContainer.querySelector(".modelP");
    if (modelP && model.description) {
      modelP.textContent = model.description;
      modelP.style.display = "block";
    }

    // Update the model heading
    const modelHeading = modelInfoContainer.querySelector(".genAIGPTHeading");
    if (modelHeading) {
      modelHeading.textContent = `About ${model.name}`;
    }

    // Update cost information if available
    const costSection = modelInfoContainer.querySelector("#modelCostings");
    if (costSection && model.costs) {
      const costHeading = costSection.querySelector(".genAIGPTHeading");
      if (costHeading) {
        costHeading.textContent = `${model.name} Costs`;
      }

      const inputCostDD = costSection.querySelector("dd.modelCostDD");
      if (inputCostDD && model.costs.input !== undefined) {
        inputCostDD.innerHTML = model.isFree
          ? "<strong>Free</strong>"
          : `<strong>$${model.costs.input.toFixed(3)} per 1M tokens</strong>`;
      }

      const outputCostDD = costSection.querySelectorAll("dd.modelCostDD")[1];
      if (outputCostDD && model.costs.output !== undefined) {
        outputCostDD.innerHTML = model.isFree
          ? "<strong>Free</strong>"
          : `<strong>$${model.costs.output.toFixed(3)} per 1M tokens</strong>`;
      }
    }

    // Update supported parameters if available
    const parametersSection = modelInfoContainer.querySelector(
      ".supportedParameters"
    );
    if (parametersSection && model.capabilities) {
      parametersSection.innerHTML = "";
      model.capabilities.forEach((capability) => {
        const li = document.createElement("li");
        li.textContent = capability;
        parametersSection.appendChild(li);
      });
    }

    // Announce the change to screen readers
    announceModelInfoUpdate(model.name);
  }

  /**
   * Announce model info update to screen readers
   */
  function announceModelInfoUpdate(modelName) {
    try {
      const announcement = `Model information updated for ${modelName}`;

      // Create temporary announcement element
      const announcer = document.createElement("div");
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      announcer.style.position = "absolute";
      announcer.style.left = "-10000px";
      announcer.style.width = "1px";
      announcer.style.height = "1px";
      announcer.style.overflow = "hidden";

      document.body.appendChild(announcer);

      setTimeout(() => {
        announcer.textContent = announcement;

        // Remove after announcement
        setTimeout(() => {
          if (announcer.parentNode) {
            document.body.removeChild(announcer);
          }
        }, 1000);
      }, 100);
    } catch (error) {
      logWarn("Error announcing model info update:", error);
    }
  }

  /**
   * Enhanced updateModelSelect function with improved model info updating
   */
  function updateModelSelect() {
    if (!elements.modelSelect) return;

    const modelSelect = elements.modelSelect;
    const currentSelection = modelSelect.value;

    // Set flag to prevent recursive updates
    isUpdatingSelect = true;

    // ============================================================================
    // NEW: Determine if cost information should be displayed
    // ============================================================================
    const shouldShowCosts =
      currentFilters.sortByCost || currentFilters.costRange !== "";

    logDebug("Updating model select", {
      currentSelection,
      filteredCount: filteredModels.length,
      totalCount: allModels.length,
      sortByCost: currentFilters.sortByCost,
      costRange: currentFilters.costRange,
      shouldShowCosts: shouldShowCosts, // ← NEW: Debug info for cost display logic
    });

    // Store the original change handler
    const originalHandler = modelSelect.onchange;
    modelSelect.onchange = null; // Temporarily disable to prevent cascading events

    // Clear all options
    modelSelect.innerHTML = "";

    // Add placeholder option
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "Please select a model...";
    modelSelect.appendChild(placeholderOption);

    // ============================================================================
    // CONDITIONAL LOGIC FOR GLOBAL COST SORTING VS CATEGORY GROUPING
    // ============================================================================

    if (currentFilters.sortByCost) {
      // GLOBAL COST SORTING: Create flat list without category grouping
      logDebug("Creating flat list with global cost sorting");

      // Models are already sorted by cost in applyFilters()
      filteredModels.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        // ← UPDATED: Use shouldShowCosts parameter
        option.textContent = generateOptionText(model, shouldShowCosts);

        // Add accessibility attributes like the original does
        option.setAttribute("data-provider", model.provider);
        option.setAttribute("data-category", model.category);
        if (model.isFree) {
          option.setAttribute("data-free", "true");
        }
        if (model.isDefault) {
          option.setAttribute("data-default", "true");
        }

        // Cost information in ARIA label for screen readers (always include for accessibility)
        const costInfo = formatCostForDisplay(model);
        option.setAttribute(
          "aria-label",
          `${model.name} from ${model.provider}${costInfo}`
        );

        // Add directly to select (no optgroup)
        modelSelect.appendChild(option);
      });

      logInfo("Global cost sorting applied", {
        modelsCount: filteredModels.length,
        flatList: true,
        sortedByCost: true,
        costsVisible: shouldShowCosts,
      });
    } else {
      // CATEGORY GROUPING: Use existing category-based organization
      logDebug("Creating category-grouped list");

      // Group models by category (existing logic)
      const modelsByCategory = groupModelsByCategory(filteredModels);

      // Add models to select with same structure as original
      Object.entries(modelsByCategory).forEach(([category, models]) => {
        if (models.length === 0) return;

        const optgroup = document.createElement("optgroup");
        optgroup.label = formatCategoryName(category);

        // Sort models alphabetically like ModelManager does
        const sortedModels = [...models].sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );

        sortedModels.forEach((model) => {
          const option = document.createElement("option");
          option.value = model.id;
          // ← UPDATED: Use shouldShowCosts parameter
          option.textContent = generateOptionText(model, shouldShowCosts);

          // Add accessibility attributes like ModelManager does
          option.setAttribute("data-provider", model.provider);
          option.setAttribute("data-category", model.category);
          if (model.isFree) {
            option.setAttribute("data-free", "true");
          }
          if (model.isDefault) {
            option.setAttribute("data-default", "true");
          }

          // Cost information in ARIA label for screen readers (always include for accessibility)
          const costInfo = formatCostForDisplay(model);
          option.setAttribute(
            "aria-label",
            `${model.name} from ${model.provider}${costInfo}`
          );

          optgroup.appendChild(option);
        });

        modelSelect.appendChild(optgroup);
      });

      logInfo("Category grouping applied", {
        categoriesCount: Object.keys(modelsByCategory).length,
        modelsCount: filteredModels.length,
        groupedByCategory: true,
        costsVisible: shouldShowCosts,
      });
    }

    // ============================================================================
    // SELECTION RESTORATION (unchanged from original)
    // ============================================================================

    // Determine what model should be selected with improved logic
    let newSelection = null;
    let selectionChanged = false;

    // First, try to restore the previous selection if it's still available
    if (
      currentSelection &&
      filteredModels.some((model) => model.id === currentSelection)
    ) {
      newSelection = currentSelection;
      logDebug("Restored previous selection:", currentSelection);
    } else {
      // If previous selection not available, find the best default
      const defaultModel = findDefaultModel(filteredModels);
      if (defaultModel) {
        newSelection = defaultModel.id;
        selectionChanged = true;
        logDebug(
          "Selected default model:",
          defaultModel.id,
          "Name:",
          defaultModel.name
        );
      } else if (filteredModels.length > 0) {
        // Fallback to first available
        newSelection = filteredModels[0].id;
        selectionChanged = true;
        logDebug("Selected first available model:", filteredModels[0].id);
      } else {
        // No models available
        newSelection = "";
        selectionChanged = true;
        logDebug("No models available, cleared selection");
      }
    }

    // Set the selection
    modelSelect.value = newSelection;

    // Restore the original change handler
    modelSelect.onchange = originalHandler;

    // Clear the updating flag
    isUpdatingSelect = false;

    // Update model info if we have a selection and it changed
    if (newSelection && (selectionChanged || !currentSelection)) {
      // Use multiple timeouts to ensure updates happen after all DOM changes
      setTimeout(() => {
        updateModelInfoDisplay(newSelection);
      }, 10);

      // Backup attempt with longer delay
      setTimeout(() => {
        updateModelInfoDisplay(newSelection);
      }, 50);
    }

    logInfo("Model select updated successfully", {
      optionCount: modelSelect.options.length,
      selectedValue: modelSelect.value,
      filteredModels: filteredModels.length,
      selectionChanged: selectionChanged,
      costSorting: currentFilters.sortByCost,
      costRange: currentFilters.costRange,
      costsDisplayed: shouldShowCosts, // ← NEW: Debug info
      displayMode: currentFilters.sortByCost
        ? "flat-cost-sorted"
        : "category-grouped",
    });
  }

  function groupModelsByCategory(models) {
    return models.reduce((acc, model) => {
      if (!acc[model.category]) {
        acc[model.category] = [];
      }
      acc[model.category].push(model);
      return acc;
    }, {});
  }

  function formatCategoryName(category) {
    // Convert from your category format back to display format
    const categoryMap = {
      GeneralPurpose: "General Purpose",
      FreeTier: "Free Tier",
      Vision: "Vision Models",
      VisionModels: "Vision Models",
      Code: "Code & Technical",
      CodeTechnical: "Code & Technical",
      LargeContext: "Large Context",
      Specialised: "Specialised",
      Chat: "Chat",
      ResearchAssistant: "Research Assistant",
      Research: "Research",
      ReasoningModels: "Reasoning Models",
      MultimodalVision: "Multimodal Vision",
      Creative: "Creative",
      CreativeWriting: "Creative Writing",
      SearchSpecialist: "Search Specialist",
      AdvancedModel: "Advanced Model",
      CodeGeneration: "Code Generation",
      SpecialisedModels: "Specialised Models",
      Multimodal: "Multimodal",
      Advanced: "Advanced",
      EfficientModels: "Efficient Models",
      MultiModal: "Multi Modal",
      EnterpriseGrade: "Enterprise Grade",
      Coding: "Coding",
      Mathematics: "Mathematics",
      PremiumModels: "Premium Models",
      CodeSpecialist: "Code Specialist",
      AIAssistant: "AI Assistant",
      PremiumMoE: "Premium MoE",
      Reasoning: "Reasoning",
      VisionLanguage: "Vision Language",
      ToolCallingSpecialist: "Tool Calling Specialist",
      Programming: "Programming",
    };

    return categoryMap[category] || category.replace(/([A-Z])/g, " $1").trim();
  }

  function updateModelCount() {
    if (!elements.modelCount) return;

    const count = filteredModels.length;
    const total = allModels.length;

    let countText;
    if (count === total) {
      countText = `Showing all ${total} models`;
    } else {
      countText = `Showing ${count} of ${total} models`;
    }

    elements.modelCount.textContent = countText;
  }

  function populateProviderOptions() {
    if (!elements.providerSelect) return;

    const providers = [
      ...new Set(allModels.map((model) => model.provider)),
    ].sort();
    const providerSelect = elements.providerSelect;

    // Clear existing options except the first one
    while (providerSelect.children.length > 1) {
      providerSelect.removeChild(providerSelect.lastChild);
    }

    providers.forEach((provider) => {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
      providerSelect.appendChild(option);
    });

    logDebug("Provider options populated", { providers });
  }

  function announceFilterChange(message) {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("role", "status");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 3000);
  }

  // ============================================================================
  // TESTING AND DEBUG FUNCTIONS
  // ============================================================================

  function testDisabledModelsExclusion() {
    logInfo("Testing disabled model exclusion...");

    // Get all models from registry (including disabled)
    let allRegistryModels = [];
    let disabledModels = [];

    try {
      allRegistryModels = modelRegistryRef
        ? modelRegistryRef.getAllModels()
        : window.modelRegistry.getAllModels();
      disabledModels = allRegistryModels.filter((m) => m.disabled);
    } catch (error) {
      logError("Cannot access model registry for disabled model test", error);
      return {
        success: false,
        error: "Registry not accessible",
      };
    }

    // Get models from Enhanced Model Selection (should exclude disabled)
    const enhancedModelIds = new Set(allModels.map((m) => m.id));

    // Check if any disabled models leaked through
    const leakedDisabled = disabledModels.filter((disabled) =>
      enhancedModelIds.has(disabled.id)
    );

    const results = {
      totalRegistryModels: allRegistryModels.length,
      disabledInRegistry: disabledModels.length,
      enhancedModelsShown: allModels.length,
      expectedShown: allRegistryModels.length - disabledModels.length,
      correctExclusion:
        allModels.length === allRegistryModels.length - disabledModels.length,
      leakedDisabled: leakedDisabled.length,
      exclusionWorking: leakedDisabled.length === 0,
      status: leakedDisabled.length === 0 ? "Perfect" : "Failed",
    };

    logInfo("Disabled model exclusion test results:", results);

    if (leakedDisabled.length > 0) {
      logError(
        "DISABLED MODELS LEAKED THROUGH:",
        leakedDisabled.map((m) => ({ id: m.id, name: m.name }))
      );
    } else {
      logInfo("PERFECT EXCLUSION: No disabled models in enhanced selection");
    }

    // Show disabled models that were correctly excluded
    if (disabledModels.length > 0) {
      logDebug(
        "Disabled models correctly excluded:",
        disabledModels.map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          reason: "disabled: true",
        }))
      );
    }

    return results;
  }

  function initWithRetry(maxRetries = 5, retryDelay = 500) {
    let attempts = 0;

    function attemptInit() {
      attempts++;
      logInfo(`Initialisation attempt ${attempts}/${maxRetries}`);

      if (init()) {
        logInfo("✅ Initialisation successful");
        return true;
      }

      if (attempts < maxRetries) {
        logInfo(
          `⏳ Initialisation failed, retrying in ${retryDelay}ms... (waiting for ModelManager)`
        );
        setTimeout(attemptInit, retryDelay);
        return false;
      } else {
        logError("❌ Initialisation failed after all retries");
        return false;
      }
    }

    return attemptInit();
  }

  function updateFilterSummary() {
    const modelsCountElement = document.querySelector(".models-count");
    const activeFiltersElement = document.getElementById(
      "active-filters-indicator"
    );

    if (!modelsCountElement || !activeFiltersElement) return;

    const count = filteredModels.length;
    const total = allModels.length;
    const activeFiltersCount = getActiveFiltersCount();

    // Update models count text
    let countText;
    if (count === total) {
      countText = `Showing all ${total} models`;
    } else {
      countText = `Showing ${count} of ${total} models`;
    }
    modelsCountElement.textContent = countText;

    // Update active filters indicator
    let filtersText = "";
    if (activeFiltersCount > 0) {
      const filterDetails = [];

      if (currentFilters.search) {
        filterDetails.push(`Search: "${currentFilters.search}"`);
      }
      if (currentFilters.freeOnly) {
        filterDetails.push("Free only");
      }
      if (currentFilters.costRange) {
        const costSelect = document.getElementById("cost-range-select");
        const costText =
          costSelect?.selectedOptions[0]?.textContent ||
          currentFilters.costRange;
        filterDetails.push(`Cost: ${costText}`);
      }
      if (currentFilters.provider) {
        const providerSelect = document.getElementById("provider-select");
        const providerText =
          providerSelect?.selectedOptions[0]?.textContent ||
          currentFilters.provider;
        filterDetails.push(`Provider: ${providerText}`);
      }
      if (currentFilters.capabilities.length > 0) {
        filterDetails.push(
          `Capabilities: ${currentFilters.capabilities.join(", ")}`
        );
      }
      if (currentFilters.sortByCost) {
        filterDetails.push("Sorted by cost");
      }

      const pluralFilters = activeFiltersCount === 1 ? "filter" : "filters";
      filtersText = `${activeFiltersCount} ${pluralFilters} active: ${filterDetails.join(
        ", "
      )}`;
    }

    activeFiltersElement.textContent = filtersText;

    // Update ARIA label for the summary
    const summary = document.querySelector(".filters-summary");
    if (summary) {
      let ariaLabel = "Advanced Model Filters. ";
      ariaLabel += countText + ". ";
      if (activeFiltersCount > 0) {
        ariaLabel += filtersText + ". ";
      }
      ariaLabel += "Click to expand filter options.";
      summary.setAttribute("aria-label", ariaLabel);
    }
  }

  // ============================================================================
  // LOGGING CONTROL FUNCTIONS
  // ============================================================================

  /**
   * Set the logging level
   * @param {number|string} level - Log level (number or string)
   */
  function setLogLevel(level) {
    let newLevel;

    if (typeof level === "string") {
      const levelMap = {
        ERROR: LOG_LEVELS.ERROR,
        WARN: LOG_LEVELS.WARN,
        INFO: LOG_LEVELS.INFO,
        DEBUG: LOG_LEVELS.DEBUG,
      };
      newLevel = levelMap[level.toUpperCase()];
    } else {
      newLevel = level;
    }

    if (
      newLevel !== undefined &&
      Object.values(LOG_LEVELS).includes(newLevel)
    ) {
      currentLogLevel = newLevel; // ✅ Fixed: assign to currentLogLevel instead of DEFAULT_LOG_LEVEL
      const levelName = Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === newLevel
      );
      logInfo(`Logging level set to: ${levelName} (${newLevel})`);
      return true;
    } else {
      logWarn(
        `Invalid log level: ${level}. Valid levels: ERROR(0), WARN(1), INFO(2), DEBUG(3)`
      );
      return false;
    }
  }

  /**
   * Get the current logging level
   * @returns {number} Current log level
   */
  function getLogLevel() {
    return currentLogLevel; // ✅ Fixed: return currentLogLevel instead of DEFAULT_LOG_LEVEL
  }

  /**
   * Get logging level information
   * @returns {Object} Logging level details
   */
  function getLogLevelInfo() {
    const levelName = Object.keys(LOG_LEVELS).find(
      (key) => LOG_LEVELS[key] === currentLogLevel
    );
    return {
      current: currentLogLevel, // ✅ Fixed: use currentLogLevel
      name: levelName,
      levels: LOG_LEVELS,
      isDebugEnabled: currentLogLevel >= LOG_LEVELS.DEBUG,
      isInfoEnabled: currentLogLevel >= LOG_LEVELS.INFO,
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    init,
    initWithRetry,
    initWithEnhancedReliability,
    resetAllFilters,
    getCurrentFilters: () => ({ ...currentFilters }),
    getFilteredModels: () => [...filteredModels],
    getAllModels: () => [...allModels],
    refreshModels: () => {
      logInfo("Refreshing models...");
      loadModelsFromRegistry();
      populateProviderOptions();
      applyFilters();
    },
    isInitialised: () => isInitialised,
    testDisabledModelsExclusion,

    // Integration helpers
    getModelRegistry: () => modelRegistryRef,
    getModelManager: () => modelManagerRef,

    // Cost display helpers
    formatCostForDisplay,
    getCostSortValue,
    sortModelsByCost,
    generateOptionText,

    // Logging control functions
    setLogLevel,
    getLogLevel,
    getLogLevelInfo,

    // Debug helpers
    debugInfo: () => ({
      isInitialised,
      modelCount: allModels.length,
      filteredCount: filteredModels.length,
      activeFilters: getActiveFiltersCount(),
      currentFilters: { ...currentFilters },
      hasModelRegistry: !!modelRegistryRef,
      hasModelManager: !!modelManagerRef,
      freeModels: allModels.filter((m) => m.isFree).length,
      loggingLevel: getLogLevelInfo(),
      elements: Object.keys(elements).reduce((acc, key) => {
        acc[key] = !!elements[key];
        return acc;
      }, {}),
      registryDetection: detectModelRegistry(),
      sampleModels: allModels.slice(0, 3).map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        isFree: m.isFree,
      })),
      sampleFreeModels: allModels
        .filter((m) => m.isFree)
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
        })),
    }),

    // ← ADD this new debug helper:
    debugCostSorting: () => {
      const models = allModels;
      const sorted = sortModelsByCost(models);

      logDebug("Cost sorting debug:", {
        totalModels: models.length,
        freeModels: sorted.filter((m) => m.isFree).length,
        sortedSample: sorted.slice(0, 10).map((m) => ({
          name: m.name,
          cost: getCostSortValue(m),
          display: formatCostForDisplay(m),
        })),
      });

      return sorted;
    },
  };
})();

// ============================================================================
// GLOBAL EXPORTS AND TEST FUNCTIONS
// ============================================================================

// Export for different environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = EnhancedModelSelection;
} else {
  window.EnhancedModelSelection = EnhancedModelSelection;
}

// Global test functions for debugging
window.testDisabledModelsExclusion = function () {
  console.log("🚫 Testing disabled model exclusion...");

  if (!EnhancedModelSelection.isInitialised()) {
    console.log("❌ Enhanced Model Selection not initialised yet");
    return false;
  }

  const results = EnhancedModelSelection.testDisabledModelsExclusion();

  console.log("📊 Disabled Model Exclusion Test Results:", {
    totalRegistryModels: results.totalRegistryModels,
    disabledInRegistry: results.disabledInRegistry,
    enhancedModelsShown: results.enhancedModelsShown,
    expectedShown: results.expectedShown,
    correctExclusion: results.correctExclusion ? "✅ Perfect" : "❌ Failed",
    exclusionStatus: results.status,
  });

  if (results.disabledInRegistry > 0) {
    console.log(
      `🚫 ${results.disabledInRegistry} disabled models correctly excluded from selection`
    );
  } else {
    console.log("ℹ️ No disabled models found in registry");
  }

  return results.exclusionWorking;
};

window.debugEnhancedModelSelection = function () {
  console.log("=== Enhanced Model Selection Debug Info ===");
  const debugInfo = EnhancedModelSelection.debugInfo();
  console.log("Debug Info:", debugInfo);

  // Additional debugging
  const modelSelect = document.getElementById("model-select");
  console.log("Model Select Element:", {
    exists: !!modelSelect,
    optionCount: modelSelect ? modelSelect.options.length : 0,
    hasOptgroups: modelSelect
      ? modelSelect.querySelectorAll("optgroup").length
      : 0,
    value: modelSelect ? modelSelect.value : null,
    innerHTML: modelSelect
      ? modelSelect.innerHTML.substring(0, 200) + "..."
      : null,
  });

  // Check for global objects
  console.log("Global Objects:", {
    modelRegistry: !!window.modelRegistry,
    uiController: !!window.uiController,
    modelManager: !!window.modelManager,
    uiControllerModelManager: !!(
      window.uiController && window.uiController.modelManager
    ),
  });

  // Test free model detection
  const allModels = EnhancedModelSelection.getAllModels();
  const freeModels = allModels.filter((m) => m.isFree);
  console.log("Free Model Detection:", {
    totalModels: allModels.length,
    freeModels: freeModels.length,
    freeModelSamples: freeModels
      .slice(0, 5)
      .map((m) => `${m.name} (${m.provider})`),
  });

  return debugInfo;
};

window.forceEnhancedModelSelectionInit = function () {
  console.log("[EnhancedModelSelection] 🔧 Forcing initialisation...");
  const result = EnhancedModelSelection.init();
  console.log("Force init result:", result);
  return result;
};

window.testEnhancedModelSelection = function () {
  console.log("[EnhancedModelSelection] 🧪 Running test...");

  if (!EnhancedModelSelection.isInitialised()) {
    console.log("❌ Not initialised yet");
    return false;
  }

  const allModels = EnhancedModelSelection.getAllModels();
  const filteredModels = EnhancedModelSelection.getFilteredModels();
  const freeModels = allModels.filter((m) => m.isFree);

  console.log("✅ Test Results:", {
    totalModels: allModels.length,
    filteredModels: filteredModels.length,
    freeModels: freeModels.length,
    sampleModels: allModels.slice(0, 3).map((m) => `${m.name} (${m.provider})`),
    sampleFreeModels: freeModels
      .slice(0, 3)
      .map((m) => `${m.name} (${m.provider})`),
    isWorking: allModels.length > 0,
  });

  return allModels.length > 0;
};
// ============================================================================
// GLOBAL LOGGING CONTROL FUNCTIONS
// ============================================================================

// Make logging functions globally accessible
window.setEnhancedModelSelectionLogLevel = function (level) {
  if (EnhancedModelSelection.setLogLevel) {
    return EnhancedModelSelection.setLogLevel(level);
  } else {
    console.warn(
      "Enhanced Model Selection not initialised or logging not available"
    );
    return false;
  }
};

window.getEnhancedModelSelectionLogLevel = function () {
  if (EnhancedModelSelection.getLogLevel) {
    return EnhancedModelSelection.getLogLevelInfo();
  } else {
    console.warn(
      "Enhanced Model Selection not initialised or logging not available"
    );
    return null;
  }
};

window.testCostSorting = function () {
  console.log("🧪 Testing cost sorting functionality...");

  if (!EnhancedModelSelection.isInitialised()) {
    console.log("❌ Enhanced Model Selection not initialised yet");
    return false;
  }

  try {
    const sorted = EnhancedModelSelection.debugCostSorting();
    const freeModels = sorted.filter((m) => m.isFree);
    const paidModels = sorted.filter((m) => !m.isFree);

    console.log("✅ Cost Sorting Test Results:", {
      totalModels: sorted.length,
      freeModels: freeModels.length,
      paidModels: paidModels.length,
      firstFreeModel: freeModels[0]?.name || "None",
      firstPaidModel: paidModels[0]?.name || "None",
      cheapestPaidCost: paidModels[0]
        ? EnhancedModelSelection.getCostSortValue(paidModels[0])
        : "N/A",
      sampleSorting: sorted.slice(0, 5).map((m) => ({
        name: m.name,
        cost: EnhancedModelSelection.getCostSortValue(m),
        display: EnhancedModelSelection.formatCostForDisplay(m),
      })),
    });

    return true;
  } catch (error) {
    console.error("❌ Cost sorting test failed:", error);
    return false;
  }
};
