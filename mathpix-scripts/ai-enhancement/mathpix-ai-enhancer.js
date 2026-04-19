/**
 * @fileoverview MathPix AI Enhancer - LLM Integration for OCR Enhancement
 * @module MathPixAIEnhancer
 * @version 1.0.0
 * @since Phase 7.1
 *
 * Integrates OpenRouter AI capabilities to enhance MathPix OCR output
 * by comparing source PDF with generated MMD and fixing recognition errors.
 *
 * @requires OpenRouterEmbed - Core API client (from openrouter-embed-core.js)
 * @requires EmbedFileUtils - File attachment utilities (from openrouter-embed-file.js)
 * @requires MathPixMMDPreview - MMD rendering for validation
 * @requires MathPixSessionRestorer - Session context access
 * @requires UniversalModal - Modal dialog system
 *
 * @accessibility WCAG 2.2 AA compliant
 */

(function () {
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
      console.error(`[AIEnhancer] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AIEnhancer] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AIEnhancer] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AIEnhancer] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION CONSTANTS
  // ============================================================================

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * AI Enhancer configuration constants
   */
  const AI_ENHANCER_CONFIG = {
    /**
     * Processing stages with progress percentages
     */
    PROCESSING_STAGES: {
      PREPARING: { text: "Preparing enhancement...", progress: 10 },
      ATTACHING: { text: "Attaching PDF document...", progress: 20 },
      ANALYSING: { text: "Analysing document...", progress: 35 },
      ENHANCING: { text: "Enhancing MMD content...", progress: 55 },
      VERIFYING: { text: "Verifying corrections...", progress: 75 },
      VALIDATING: { text: "Validating results...", progress: 90 },
      COMPLETE: { text: "Enhancement complete!", progress: 100 },
    },
    /**
     * Token estimation (approximate chars per token for MMD)
     */
    CHARS_PER_TOKEN: 4,

    /**
     * Path to prompts configuration file
     */
    PROMPTS_PATH: "mathpix-scripts/ai-enhancement/mathpix-ai-prompts.json",

    /**
     * Fallback model if config loading fails
     * Note: When config loads successfully, the model with "recommended": true
     * in mathpix-ai-prompts.json takes precedence (currently Sonnet 4.5)
     */
    FALLBACK_MODEL: "anthropic/claude-haiku-4.5",

    /**
     * Maximum output tokens for API response
     * Referenced by initialiseEmbed() — was previously undefined
     */
    MAX_OUTPUT_TOKENS: 8192,

    /**
     * Maximum PDF size for AI enhancement (bytes)
     * 20MB PDF → ~27MB base64 — within OpenRouter's 25MB upload limit
     * Bottleneck fixes in embed-core/client-stream/client-display
     * prevent browser freeze for payloads of this size
     */
    MAX_PDF_SIZE_FOR_ENHANCEMENT: 20 * 1024 * 1024, // 20MB

    /**
     * API request timeout in milliseconds
     * Large PDFs (10MB+) can take 2–3 minutes via native engine
     */
    API_TIMEOUT_MS: 300000, // 5 minutes

    /**
     * PDF processing engine for OpenRouter file-parser plugin
     *
     * Options:
     *   "auto"        – Let OpenRouter choose (no plugin sent)
     *   "native"      – Model processes PDF directly (token-based cost, free plugin)
     *   "mistral-ocr" — Mistral OCR ($2/1000 pages, best for scanned documents)
     *
     * NOTE: "pdf-text" was removed — it produces empty content for
     * mathematical/scientific PDFs, causing API errors.
     *
     */
    PDF_ENGINE: "native",

    /**
     * API parameters
     */
    API_PARAMS: {
      temperature: 0.3, // Low temperature for accuracy
      max_tokens: 8192, // Allow lengthy responses for full documents
    },
  };

  // ============================================================================
  // MAIN CLASS
  // ============================================================================

  /**
   * MathPix AI Enhancer - LLM-powered OCR enhancement
   *
   * @class MathPixAIEnhancer
   * @since Phase 7.1
   *
   * @example
   * const enhancer = getMathPixAIEnhancer();
   * enhancer.openModal();
   */
  class MathPixAIEnhancer {
    /**
     * Create a new MathPixAIEnhancer instance
     */
    constructor() {
      logInfo("Creating MathPixAIEnhancer instance...");

      /**
       * Timing log for Phase 7.3 research - captures processing stage timestamps
       * @type {Array<Object>}
       */
      this.timingLog = [];

      /**
       * Flag indicating initialisation state
       * @type {boolean}
       */
      this.isInitialised = false;

      /**
       * Flag indicating processing state
       * @type {boolean}
       */
      this.isProcessing = false;

      /**
       * Reference to session restorer (lazy loaded)
       * @type {Object|null}
       */
      this.sessionRestorer = null;

      /**
       * Active data provider (Phase 8A)
       * Set explicitly via setDataProvider() or auto-created as resume provider
       * @type {Object|null}
       */
      this.dataProvider = null;

      /**
       * OpenRouter Embed instance (created per request)
       * @type {Object|null}
       */
      this.embed = null;

      /**
       * Current modal ID (for UniversalModal)
       * @type {string|null}
       */
      this.currentModalId = null;

      /**
       * Current modal instance reference
       * @type {Object|null}
       */
      this.currentModal = null;

      /**
       * Abort controller for cancellation
       * @type {AbortController|null}
       */
      this.abortController = null;

      // Enhancement state
      /**
       * Original MMD content before enhancement
       * @type {string}
       */
      this.originalMMD = "";

      /**
       * Enhanced MMD content from LLM
       * @type {string}
       */
      this.enhancedMMD = "";

      /**
       * Currently selected model ID
       * @type {string}
       */
      this.selectedModel = "anthropic/claude-sonnet-4";

      /**
       * Selected PDF processing engine (Phase 7.4)
       * @type {'native'|'mistral-ocr'}
       */
      this.selectedEngine = "native";

      /**
       * Whether extended thinking / reasoning is enabled
       * @type {boolean}
       */
      this.reasoningEnabled = false;

      /**
       * Whether multi-pass verification is enabled (Phase 7.5H1/2)
       * When true, Pass 1 output is reviewed by a second API call
       * @type {boolean}
       */
      this.multiPassEnabled = false;

      /**
       * localStorage key for model + engine preferences (Phase 7.4)
       * @type {string}
       */
      this.enhancerPrefsKey = "ai-enhance-preferences";

      /**
       * Cached DOM elements
       * @type {Object}
       */
      this.elements = {
        enhanceBtn: null,
      };

      /**
       * Loaded prompt configuration from JSON
       * @type {Object|null}
       */
      this.prompts = null;

      /**
       * Model configurations from JSON
       * @type {Object|null}
       */
      this.models = null;

      /**
       * Last error message for display
       * @type {string|null}
       */
      this.lastError = null;

      /**
       * Current processing stage
       * @type {string}
       */
      this.currentStage = "";

      /**
       * Current progress percentage
       * @type {number}
       */
      this.currentProgress = 0;

      /**
       * Elapsed time interval ID (Phase 7.3J)
       * @type {number|null}
       */
      this.elapsedInterval = null;

      /**
       * Elapsed time start timestamp (Phase 7.3J)
       * @type {number|null}
       */
      this.elapsedStartTime = null;

      /**
       * Flag indicating if PDF has been rendered in results view
       * Used for lazy-loading PDF column
       * @type {boolean}
       */
      this.pdfRendered = false;

      /**
       * PDF.js document reference for zoom/navigation
       * @type {Object|null}
       */
      this.pdfDocument = null;

      /**
       * Current PDF zoom scale
       * @type {number}
       */
      this.currentPdfScale = 1;

      /**
       * Enhancement statistics (timing, tokens, cost)
       * @type {Object|null}
       */
      this.stats = null;

      /**
       * Diff statistics (lines changed, etc.)
       * @type {Object|null}
       */
      this.diffStats = null;

      /**
       * Whether to show diff highlighting in MMD columns (Phase 7.2E)
       * @type {boolean}
       */
      this.showDiff = true;

      /**
       * Whether scroll sync is enabled between Original and Enhanced columns (Phase 7.3K)
       * @type {boolean}
       */
      this.syncScrollEnabled = false;

      /**
       * Flag to prevent scroll event loops during sync (Phase 7.3K)
       * @type {boolean}
       */
      this.isSyncingScroll = false;

      /**
       * Bound scroll handler references for cleanup (Phase 7.3K, extended 7.3L)
       * @type {{ original: Function|null, enhanced: Function|null, preview: Function|null }}
       */
      this.scrollHandlers = { original: null, enhanced: null, preview: null };

      /**
       * Scroll sync mode (Phase 7.3L)
       * 'mmd' = Original + Enhanced only; 'all' = Original + Enhanced + Preview
       * @type {'mmd'|'all'}
       */
      this.scrollSyncMode = "mmd";

      /**
       * Cached structural analysis from MMD Analyser (Phase 7.5F)
       * Populated during buildUserPrompt() for UI display
       * @type {Object|null}
       */
      this.lastStructuralAnalysis = null;

      /**
       * Cached semantic analysis from Lines.json Mapper (Phase 7.5F)
       * Populated during buildUserPrompt() for UI display
       * @type {Object|null}
       */
      this.lastSemanticAnalysis = null;

      /**
       * Validation warnings from post-enhancement checks (Phase 7.5F)
       * Array of { severity, message, detail } objects
       * @type {Array<Object>}
       */
      this.validationWarnings = [];

      /**
       * Extracted uncertainty metadata from %% AI: comments (Phase 7.5L)
       * Populated by extractUncertaintyMetadata() after LLM response
       * @type {Array<{lineNumber: number, comment: string, contextLine: string}>}
       */
      this.uncertaintyMetadata = [];
    }

    // ==========================================================================
    // TIMING LOGGING (Phase 7.3 Research)
    // ==========================================================================

    /**
     * Log a timing event for Phase 7.3 research data collection
     * Records timestamps and elapsed time for performance analysis
     *
     * @param {string} stage - Name of the processing stage
     * @param {Object} [details={}] - Additional details to log
     */
    logTiming(stage, details = {}) {
      const entry = {
        stage,
        timestamp: Date.now(),
        elapsed:
          this.timingLog.length > 0
            ? Date.now() - this.timingLog[0].timestamp
            : 0,
        ...details,
      };
      this.timingLog.push(entry);
      console.log(`[AI-TIMING] ${stage}:`, JSON.stringify(entry));
    }

    // ==========================================================================
    // ELAPSED TIMER (Phase 7.3J)
    // ==========================================================================

    /**
     * Start the elapsed time counter display
     * Updates every second showing "Xs elapsed" in the processing UI
     */
    startElapsedTimer() {
      this.stopElapsedTimer(); // safety: clear any previous
      this.elapsedStartTime = Date.now();
      logDebug("Elapsed timer started");

      this.elapsedInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - this.elapsedStartTime) / 1000);
        const display = document.getElementById("ai-elapsed-display");
        if (display) {
          display.textContent = `${seconds}s elapsed`;
        }
      }, 1000);
    }

    /**
     * Stop the elapsed time counter
     * Safe to call multiple times (idempotent)
     */
    stopElapsedTimer() {
      if (this.elapsedInterval) {
        clearInterval(this.elapsedInterval);
        this.elapsedInterval = null;
        logDebug("Elapsed timer stopped");
      }
    }

    // ==========================================================================
    // INITIALISATION
    // ==========================================================================

    /**
     * Initialise the AI Enhancer module
     * Caches elements and loads configuration
     *
     * @returns {Promise<boolean>} True if initialised successfully
     */
    async init() {
      if (this.isInitialised) {
        logDebug("Already initialised");
        return true;
      }

      logInfo("Initialising AI Enhancer...");

      try {
        // Cache DOM elements
        this.cacheElements();

        // Load prompt configuration
        await this.loadPromptConfig();

        // Set initial button state
        this.updateButtonState();

        this.isInitialised = true;
        logInfo("AI Enhancer initialised successfully");

        return true;
      } catch (error) {
        logError("Failed to initialise AI Enhancer:", error);
        return false;
      }
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
      logDebug("Caching DOM elements...");

      // Resume mode button
      this.elements.enhanceBtn = document.getElementById(
        "resume-ai-enhance-btn",
      );

      if (!this.elements.enhanceBtn) {
        logDebug(
          "Resume AI Enhance button not found in DOM (may not be in resume mode)",
        );
      } else {
        logDebug("Resume AI Enhance button cached");
      }

      // Upload mode button (Phase 8 - Conv AD)
      this.elements.uploadEnhanceBtn = document.getElementById(
        "upload-ai-enhance-btn",
      );

      if (this.elements.uploadEnhanceBtn) {
        logDebug("Upload AI Enhance button cached");
      }
    }

    /**
     * Load prompt configuration from JSON file
     *
     * @returns {Promise<void>}
     */
    async loadPromptConfig() {
      logDebug("Loading prompt configuration...");

      try {
        const response = await fetch(AI_ENHANCER_CONFIG.PROMPTS_PATH);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const config = await response.json();

        this.prompts = config.systemPrompt;
        this.models = config.models;

        // Set default model to recommended one
        const recommendedModel = Object.entries(this.models).find(
          ([, model]) => model.recommended,
        );
        if (recommendedModel) {
          this.selectedModel = recommendedModel[1].id;
        }

        logInfo("Prompt configuration loaded", {
          modelsCount: Object.keys(this.models).length,
          defaultModel: this.selectedModel,
        });
      } catch (error) {
        logError("Failed to load prompt configuration:", error);

        // Set fallback defaults
        this.prompts = {
          role: "You are an expert mathematical document reviewer.",
          task: "Correct OCR errors in the provided MMD document.",
          principles: [],
          domainContext: null,
          guidelines: ["Focus on mathematical notation accuracy"],
          commonErrors: [],
          outputFormat: "Return the complete corrected MMD document.",
        };

        this.models = {
          sonnet: {
            id: "anthropic/claude-sonnet-4",
            name: "Claude Sonnet 4",
            description: "Balanced performance",
            costPer1kInput: 0.003,
            costPer1kOutput: 0.015,
            maxTokens: 8192,
            recommended: true,
          },
        };
      }
    }

    // ==========================================================================
    // ENHANCER PREFERENCE PERSISTENCE (Phase 7.4)
    // ==========================================================================

    /**
     * Load model and engine preferences from localStorage
     * Validates that saved model exists in prompts.json or registry,
     * and that saved engine is a valid option
     */
    loadEnhancerPreferences() {
      try {
        const stored = localStorage.getItem(this.enhancerPrefsKey);
        if (!stored) return;

        const prefs = JSON.parse(stored);
        logDebug("Loading enhancer preferences:", prefs);

        // Validate and apply model preference
        if (prefs.model) {
          const inPrompts = Object.values(this.models || {}).some(
            (m) => m.id === prefs.model,
          );
          const inRegistry =
            window.modelRegistry &&
            typeof window.modelRegistry.getAllModels === "function" &&
            window.modelRegistry
              .getAllModels()
              .some((m) => m.id === prefs.model);

          if (inPrompts || inRegistry) {
            this.selectedModel = prefs.model;
            logDebug("Restored model preference:", prefs.model);
          } else {
            logWarn("Saved model no longer available:", prefs.model);
          }
        }

        // Validate and apply engine preference
        const validEngines = ["native", "mistral-ocr"];
        if (prefs.engine && validEngines.includes(prefs.engine)) {
          this.selectedEngine = prefs.engine;
          logDebug("Restored engine preference:", prefs.engine);
        }

        // Restore reasoning preference
        if (typeof prefs.reasoning === "boolean") {
          this.reasoningEnabled = prefs.reasoning;
          logDebug("Restored reasoning preference:", prefs.reasoning);
        }

        // Restore multi-pass preference (Phase 7.5H1/2)
        if (typeof prefs.multiPass === "boolean") {
          this.multiPassEnabled = prefs.multiPass;
          logDebug("Restored multi-pass preference:", prefs.multiPass);
        }
      } catch (error) {
        logWarn("Failed to load enhancer preferences:", error);
      }
    }

    /**
     * Save current model and engine preferences to localStorage
     */
    saveEnhancerPreferences() {
      try {
        const prefs = {
          model: this.selectedModel,
          engine: this.selectedEngine,
          reasoning: this.reasoningEnabled,
          multiPass: this.multiPassEnabled,
        };
        localStorage.setItem(this.enhancerPrefsKey, JSON.stringify(prefs));
        logDebug("Saved enhancer preferences:", prefs);
      } catch (error) {
        logWarn("Failed to save enhancer preferences:", error);
      }
    }

    // ==========================================================================
    // BUTTON STATE MANAGEMENT
    // ==========================================================================

    /**
     * Check if AI enhancement is available
     *
     * Delegates to the active data provider (Phase 8A).
     * Auto-creates a resume provider if none is set (backwards compatibility).
     *
     * @returns {boolean} True if enhancement can be performed
     */
    isEnhancementAvailable() {
      const provider = this.ensureDataProvider();

      if (!provider) {
        logDebug("Enhancement unavailable: No data provider");
        return false;
      }

      return provider.isAvailable();
    }

    /**
     * Update the enhance button's enabled/disabled state
     *
     * Called when:
     * - Module initialises
     * - Session is restored
     * - Session changes
     */
    updateButtonState() {
      if (!this.elements.enhanceBtn) {
        this.cacheElements();
      }

      if (!this.elements.enhanceBtn) {
        logWarn("Cannot update button state: button not found");
        return;
      }

      const available = this.isEnhancementAvailable();
      const wasDisabled = this.elements.enhanceBtn.disabled;

      this.elements.enhanceBtn.disabled = !available || this.isProcessing;

      // Update ARIA attributes
      if (this.isProcessing) {
        this.elements.enhanceBtn.setAttribute("aria-busy", "true");
      } else {
        this.elements.enhanceBtn.removeAttribute("aria-busy");
      }

      if (wasDisabled !== this.elements.enhanceBtn.disabled) {
        logDebug("Button state updated", {
          available,
          disabled: this.elements.enhanceBtn.disabled,
          processing: this.isProcessing,
        });
      }
    }

    // ==========================================================================
    // DATA PROVIDER & SESSION RESTORER ACCESS (Phase 8A)
    // ==========================================================================

    /**
     * Set the active data provider explicitly.
     *
     * Called by upload mode (Conv AD) to wire the upload provider.
     * Resume mode uses auto-detection via ensureDataProvider().
     *
     * @param {Object|null} provider - Data provider or null to clear
     */
    setDataProvider(provider) {
      if (provider && !window.isValidDataProvider(provider)) {
        logError("setDataProvider: Invalid data provider — ignoring");
        return;
      }
      this.dataProvider = provider;
      logInfo(
        `Data provider ${provider ? "set: " + provider.mode : "cleared"}`,
      );
    }

    /**
     * Get the active data provider, auto-creating a resume provider
     * if none is set (backwards compatibility).
     *
     * @returns {Object|null} Active data provider or null
     */
    ensureDataProvider() {
      if (this.dataProvider) {
        return this.dataProvider;
      }

      // Auto-create resume provider for backwards compatibility
      const restorer = this.getSessionRestorer();
      if (restorer) {
        this.dataProvider = window.createResumeDataProvider(() =>
          this.getSessionRestorer(),
        );
        logDebug("Auto-created resume data provider");
        return this.dataProvider;
      }

      return null;
    }

    /**
     * Get reference to session restorer (lazy loaded)
     *
     * Retained for resume provider auto-creation and any direct
     * restorer access still needed outside data methods.
     *
     * @returns {Object|null} Session restorer instance
     */
    getSessionRestorer() {
      if (!this.sessionRestorer) {
        this.sessionRestorer = window.getMathPixSessionRestorer?.();
      }
      return this.sessionRestorer;
    }

    /**
     * Get current MMD content
     * Delegates to active data provider (Phase 8A)
     *
     * @returns {string} Current MMD content or empty string
     */
    getCurrentMMD() {
      const provider = this.ensureDataProvider();
      if (provider) {
        return provider.getMMDContent();
      }
      return "";
    }

    /**
     * Get source PDF file
     * Delegates to active data provider (Phase 8A)
     *
     * @returns {Blob|null} PDF blob or null
     */
    getSourcePDF() {
      const provider = this.ensureDataProvider();
      if (provider) {
        return provider.getSourcePDF();
      }
      return null;
    }

    /**
     * Get source filename
     * Delegates to active data provider (Phase 8A)
     *
     * @returns {string} Filename or 'Unknown'
     */
    getSourceFilename() {
      const provider = this.ensureDataProvider();
      if (provider) {
        return provider.getSourceFilename();
      }
      return "Unknown";
    }

    /**
     * Get lines.json data (Phase 7.5F)
     * Delegates to active data provider (Phase 8A)
     *
     * @returns {Object|null} Lines data object or null if unavailable
     */
    getLinesData() {
      const provider = this.ensureDataProvider();
      if (provider) {
        return provider.getLinesData();
      }
      return null;
    }

    // ==========================================================================
    // MODAL MANAGEMENT
    // ==========================================================================

    /**
     * Open the AI Enhancement modal
     *
     * Uses UniversalModal.Modal class for persistent control -
     * the modal stays open through configuration, processing, and results states.
     */
    async openModal() {
      logInfo("Opening AI Enhancement modal...");

      // Close any existing modal first (for "Try Again" flow)
      if (this.currentModal) {
        this.currentModal.close();
        this.currentModal = null;
        // Small delay to ensure DOM cleanup
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!this.isEnhancementAvailable()) {
        logWarn("Cannot open modal: enhancement not available");
        if (window.notifyWarning) {
          window.notifyWarning(
            "AI Enhancement requires a PDF source with MMD content.",
          );
        }
        return;
      }

      // Store original MMD for comparison
      this.originalMMD = this.getCurrentMMD();
      this.enhancedMMD = "";
      this.lastError = null;
      this.pdfRendered = false;
      this.pdfDocument = null;
      this.currentPdfScale = 1;
      this.uncertaintyMetadata = [];

      // Build modal content (without buttons - they go in footer)
      const content = this.buildConfigurationContent();

      try {
        // Create modal using Modal class for persistent control
        this.currentModal = new UniversalModal.Modal({
          title: "Enhance MMD with AI",
          content: content,
          size: "fullscreen",
          className: "ai-enhancement-modal",
          closeOnOverlayClick: false,
          onClose: () => {
            if (this.isProcessing) {
              this.cancelEnhancement();
            }
          },
        });

        this.currentModal.open();

        // Inject footer buttons after modal is open
        this.updateFooterButtons("configuration");

        // Attach prompt preview toggle listener (lazy population)
        const previewDetails = document.querySelector(".ai-prompt-preview");
        if (previewDetails) {
          previewDetails.addEventListener("toggle", () => {
            if (previewDetails.open) {
              this.populatePromptPreview();
            }
          });
        }

        logDebug("Modal opened with persistent control");
      } catch (error) {
        logError("Modal error:", error);
      }
    }

    /**
     * Update footer buttons based on current state
     * @param {string} state - Current modal state: 'configuration', 'processing', 'results', 'error'
     */
    updateFooterButtons(state) {
      if (!this.currentModal) return;

      // Find the open modal dialog - more reliable than custom class
      const modalElement = document.querySelector(
        "dialog[open].universal-modal",
      );
      if (!modalElement) {
        logWarn("Could not find open modal element");
        return;
      }

      // Find the modal container (where header and body are)
      const modalContainer = modalElement.querySelector(
        ".universal-modal-container",
      );
      if (!modalContainer) {
        logWarn("Could not find modal container");
        return;
      }

      let footer = modalContainer.querySelector(".universal-modal-footer");

      // Create footer if it doesn't exist
      if (!footer) {
        footer = document.createElement("div");
        footer.className = "universal-modal-footer";
        // Insert after the status element, or at end of container
        const statusElement = modalContainer.querySelector(
          ".universal-modal-status",
        );
        if (statusElement) {
          modalContainer.insertBefore(footer, statusElement);
        } else {
          modalContainer.appendChild(footer);
        }
        logDebug("Created footer element");
      }

      // Define buttons for each state
      const buttonConfigs = {
        configuration: [
          { text: "Cancel", type: "secondary", action: "cancelAIEnhancement" },
          {
            text: "Start Enhancement",
            type: "primary",
            action: "startAIEnhancement",
          },
        ],
        processing: [
          { text: "Cancel", type: "secondary", action: "cancelAIEnhancement" },
        ],
        results: [
          { text: "Discard", type: "secondary", action: "cancelAIEnhancement" },
          {
            text: "Try Again",
            type: "secondary",
            action: "openAIEnhancementModal",
          },
          {
            text: "Apply Changes",
            type: "primary",
            action: "applyAIEnhancement",
          },
        ],
        error: [
          { text: "Close", type: "secondary", action: "cancelAIEnhancement" },
          {
            text: "Try Again",
            type: "primary",
            action: "openAIEnhancementModal",
          },
        ],
      };

      const buttons = buttonConfigs[state] || buttonConfigs.configuration;

      // Build footer HTML
      footer.innerHTML = buttons
        .map(
          (btn) => `
        <button type="button" 
                class="universal-modal-button universal-modal-button-${btn.type}"
                onclick="window.${btn.action}()">
          ${btn.text}
        </button>
      `,
        )
        .join("");

      logDebug(`Footer buttons updated for state: ${state}`);
    }

    /**
     * Handle modal button actions
     *
     * @param {string|boolean} result - Modal action result
     */
    async handleModalAction(result) {
      logDebug("Modal action:", result);

      switch (result) {
        case "start":
          await this.startEnhancement();
          break;

        case "apply":
          await this.applyEnhancement();
          break;

        case "retry":
          // Re-open modal for another attempt
          this.openModal();
          break;

        case "cancel":
        case false:
        case "background":
        case "escape":
          this.cancelEnhancement();
          break;

        default:
          logDebug("Unhandled modal action:", result);
      }
    }

    /**
     * Build configuration state content for modal
     * @returns {string} HTML content
     */
    buildConfigurationContent() {
      const filename = this.getSourceFilename();
      const mmdLength = this.originalMMD.length;
      const lineCount = this.originalMMD.split("\n").length;
      const estimatedTokens = Math.ceil(
        mmdLength / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );

      // Load saved preferences before building UI
      this.loadEnhancerPreferences();

      const costValue = this.calculateCost(this.selectedModel, estimatedTokens);
      const costDisplay =
        costValue !== null
          ? this.formatCost(costValue)
          : "Cost data unavailable";

      return `
      <div class="ai-enhance-configuration" data-state="configuration">
        <!-- Description -->
        <p class="ai-enhance-description">
          AI will analyse your source PDF and correct OCR errors in the MMD output.
          This process uses the source document to verify mathematical notation.
        </p>

        <!-- Document Info -->
        <div class="ai-document-info" role="region" aria-label="Document information">
          <dl>
            <dt>Source file</dt>
            <dd id="ai-doc-filename">${this.escapeHtml(filename)}</dd>
            <dt>MMD lines</dt>
            <dd id="ai-doc-lines">${lineCount.toLocaleString()}</dd>
            <dt>Estimated tokens</dt>
            <dd id="ai-doc-tokens">~${estimatedTokens.toLocaleString()}</dd>
          </dl>
        </div>

        <!-- Model Selection (radio buttons for recommended models) -->
        <fieldset class="ai-model-selection">
          <legend>Select AI Model</legend>
          <div class="model-options" role="radiogroup" aria-label="AI model selection">
            ${this.buildModelOptions()}
          </div>
        </fieldset>

        <!-- Advanced Options: override model + engine (Phase 7.4) -->
        ${this.buildAdvancedOptions()}

        <!-- Cost Estimate -->
        <div class="ai-cost-estimate" role="region" aria-label="Cost estimate">
          <div class="ai-cost-estimate-label">Estimated cost:</div>
          <div class="ai-cost-estimate-value" id="ai-cost-value" role="status" aria-live="polite">
            ${costDisplay}
          </div>
          <div class="ai-cost-estimate-note">
            Actual cost may vary based on response length.
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Get vision-capable models from the model registry, grouped by cost tier
     * Excludes models already in the recommended list (this.models)
     * Phase 7.4
     *
     * @returns {{ low: Array, medium: Array, high: Array }} Models grouped by cost tier
     */
    getRegistryModels() {
      if (
        !window.modelRegistry ||
        typeof window.modelRegistry.getAllModels !== "function"
      ) {
        logDebug("Model registry not available");
        return { low: [], medium: [], high: [] };
      }

      try {
        const allModels = window.modelRegistry.getAllModels();

        // Known vision-capable models (same list as image-describer-controller)
        const KNOWN_VISION_MODELS = [
          "anthropic/claude-sonnet-4.6",

          "anthropic/claude-opus-4.6",

          "anthropic/claude-haiku-4.5",
          "openai/gpt-4-vision-preview",
          "openai/gpt-4o",
          "openai/gpt-4o-mini",
          "openai/gpt-4-turbo",
          "google/gemini-pro-vision",
          "google/gemini-1.5-pro",
          "google/gemini-1.5-flash",
          "google/gemini-2.0-flash-001",
          "google/gemini-2.5-pro-preview",
          "google/gemini-2.5-flash-preview",
        ];

        // Filter for vision-capable models
        const visionModels = allModels.filter((model) => {
          if (KNOWN_VISION_MODELS.includes(model.id)) return true;
          if (model.supportsImages === true) return true;
          if (model.capabilities?.includes("vision")) return true;
          if (model.capabilities?.includes("image")) return true;
          const id = (model.id || "").toLowerCase();
          if (id.includes("vision") || id.includes("-v")) return true;
          return false;
        });

        // Deduplicate against recommended models
        const recommendedIds = new Set(
          Object.values(this.models || {}).map((m) => m.id),
        );
        const deduplicated = visionModels.filter(
          (m) => !recommendedIds.has(m.id),
        );

        // Group by cost tier
        const grouped = { low: [], medium: [], high: [] };
        deduplicated.forEach((model) => {
          const inputCost = model.costs?.input || 0;
          const outputCost = model.costs?.output || 0;
          const avgCost = (inputCost + outputCost * 2) / 3;

          const LOW_MAX = 1.0;
          const MEDIUM_MAX = 10.0;

          if (model.isFree === true || avgCost < LOW_MAX) {
            grouped.low.push(model);
          } else if (avgCost < MEDIUM_MAX) {
            grouped.medium.push(model);
          } else {
            grouped.high.push(model);
          }
        });

        // Sort alphabetically within each group
        const sortByName = (a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id);
        grouped.low.sort(sortByName);
        grouped.medium.sort(sortByName);
        grouped.high.sort(sortByName);

        logDebug("Registry models fetched:", {
          total: visionModels.length,
          deduplicated: deduplicated.length,
          low: grouped.low.length,
          medium: grouped.medium.length,
          high: grouped.high.length,
        });

        return grouped;
      } catch (error) {
        logWarn("Failed to get registry models:", error);
        return { low: [], medium: [], high: [] };
      }
    }

    /**
     * Build model selection radio options
     *
     * @returns {string} HTML for model options
     */
    buildModelOptions() {
      if (!this.models) {
        return "<p>Model configuration not loaded.</p>";
      }

      return Object.entries(this.models)
        .map(([key, model]) => {
          const isChecked = model.id === this.selectedModel;
          const recommendedBadge = model.recommended
            ? ' <span class="model-badge">(Recommended)</span>'
            : "";

          return `
          <label class="model-option">
            <input
              type="radio"
              name="ai-model"
              value="${model.id}"
              ${isChecked ? "checked" : ""}
              onchange="window.getMathPixAIEnhancer?.().handleModelChange('${model.id}')"
            />
            <span class="model-option-content">
              <span class="model-option-name">${this.escapeHtml(model.name)}${recommendedBadge}</span>
              <span class="model-option-description">${this.escapeHtml(model.description)}</span>
              <span class="model-option-cost">Input: £${model.costPer1kInput}/1K tokens | Output: £${model.costPer1kOutput}/1K tokens</span>
            </span>
          </label>
        `;
        })
        .join("");
    }

    /**
     * Build Advanced Options disclosure containing:
     * - Override model <select> (registry models by cost tier)
     * - PDF engine <select>
     * Phase 7.4
     *
     * @returns {string} HTML for <details> disclosure
     */
    buildAdvancedOptions() {
      // Determine if current model is from the recommended set or the registry
      const isRecommendedModel = Object.values(this.models || {}).some(
        (m) => m.id === this.selectedModel,
      );

      // --- Registry model <select> ---
      const registry = this.getRegistryModels();
      const hasRegistryModels =
        registry.low.length > 0 ||
        registry.medium.length > 0 ||
        registry.high.length > 0;

      let modelSelectHTML = "";

      if (hasRegistryModels) {
        const placeholderSelected = isRecommendedModel ? " selected" : "";

        const tiers = [
          {
            key: "low",
            label: "\uD83D\uDCB0 Low Cost",
            models: registry.low,
          },
          {
            key: "medium",
            label: "\u2696\uFE0F Medium Cost",
            models: registry.medium,
          },
          {
            key: "high",
            label: "\uD83D\uDE80 High Cost",
            models: registry.high,
          },
        ];

        let optgroupsHTML = "";
        tiers.forEach((tier) => {
          if (tier.models.length === 0) return;

          const options = tier.models
            .map((model) => {
              const selected =
                !isRecommendedModel && model.id === this.selectedModel
                  ? " selected"
                  : "";
              const provider = model.id.split("/")[0] || "";
              return `<option value="${model.id}"${selected}>${this.escapeHtml(model.name || model.id)} (${provider})</option>`;
            })
            .join("\n              ");

          optgroupsHTML += `
            <optgroup label="${tier.label}">
              ${options}
            </optgroup>`;
        });

        modelSelectHTML = `
          <div class="ai-advanced-model-selection">
            <label for="ai-advanced-model-select">Override model</label>
            <select id="ai-advanced-model-select"
                    onchange="window.handleAIAdvancedModelChange(this.value)"
                    aria-describedby="ai-advanced-model-help">
              <option value=""${placeholderSelected}>\u2014 Use recommended model above \u2014</option>
              ${optgroupsHTML}
            </select>
            <p id="ai-advanced-model-help" class="ai-advanced-help">
              Choose a different vision-capable model from the registry.
            </p>
          </div>`;
      }

      // --- Engine <select> ---
      const engines = [
        {
          value: "native",
          label: "Native \u2014 model reads PDF directly (token-based cost)",
        },
        {
          value: "mistral-ocr",
          label: "Mistral OCR \u2014 best quality (\u00A32/1000 pages)",
        },
      ];

      const engineOptions = engines
        .map((engine) => {
          const selected =
            engine.value === this.selectedEngine ? " selected" : "";
          return `<option value="${engine.value}"${selected}>${engine.label}</option>`;
        })
        .join("\n            ");

      const engineSelectHTML = `
        <div class="ai-engine-selection">
          <label for="ai-engine-select">PDF Processing Engine</label>
          <select id="ai-engine-select"
                  onchange="window.handleAIEngineChange(this.value)"
                  aria-describedby="ai-engine-help">
            ${engineOptions}
          </select>
<p id="ai-engine-help" class="ai-engine-help">
Native is recommended for mathematics documents. Mistral OCR suits scanned documents.
          </p>
          <p id="ai-engine-warning" class="ai-engine-warning" role="alert" hidden>
            <span aria-hidden="true" data-icon="warning"></span> Haiku + mistral-OCR is not recommended — this combination caused critical errors in testing. Consider using native engine with Haiku, or switch to Opus for mistral-OCR.
          </p>
        </div>`;

      // --- Reasoning checkbox ---
      const reasoningChecked = this.reasoningEnabled ? " checked" : "";
      const reasoningHelpText = this.getReasoningHelpText(this.selectedModel);

      const reasoningHTML = `
        <div class="ai-reasoning-selection">
          <label class="ai-reasoning-label">
            <input type="checkbox"
                   id="ai-reasoning-checkbox"
                   ${reasoningChecked}
                   onchange="window.handleAIReasoningChange(this.checked)"
                   aria-describedby="ai-reasoning-help" />
            Enable extended thinking
          </label>
          <p id="ai-reasoning-help" class="ai-reasoning-help">
            ${reasoningHelpText}
          </p>
        </div>`;

      // --- Multi-pass verification checkbox (Phase 7.5H1/2) ---
      const multiPassChecked = this.multiPassEnabled ? " checked" : "";

      const multiPassHTML = `
        <div class="ai-multipass-selection">
          <label class="ai-multipass-label">
            <input type="checkbox"
                   id="ai-multipass-checkbox"
                   ${multiPassChecked}
                   onchange="window.handleAIMultiPassChange(this.checked)"
                   aria-describedby="ai-multipass-help" />
            Enable verification pass
          </label>
          <p id="ai-multipass-help" class="ai-multipass-help">
            Runs a second review to catch regressions and missed corrections. Adds ~50% processing time.
          </p>
        </div>`;

      return `
        <details class="ai-advanced-options">
          <summary>Advanced options</summary>
          <div class="ai-advanced-content">
            ${modelSelectHTML}
            ${engineSelectHTML}
            <div class="ai-toggles-row">
              ${reasoningHTML}
              ${multiPassHTML}
            </div>
            ${this.buildPromptPreview()}
          </div>
        </details>`;
    }

    /**
     * Build the prompt preview disclosure HTML skeleton
     * Content is populated lazily when toggled open
     *
     * @returns {string} HTML for nested <details> element
     * @private
     */
    buildPromptPreview() {
      return `
        <details class="ai-prompt-preview">
<summary>
            <span class="ai-prompt-preview-label">Preview prompt</span>
            <span class="ai-prompt-token-badge" id="ai-prompt-token-badge"
                  aria-label="estimated total tokens"></span>
          </summary>
          <div class="ai-prompt-preview-content" role="region" aria-label="Prompt preview">

            <div class="ai-prompt-file-attachment" role="region" aria-label="File attachment details">
              <h4 class="ai-prompt-file-heading">File attachment</h4>
              <dl id="ai-preview-file-info">
                <dt>Status</dt>
                <dd id="ai-preview-file-status">\u2014</dd>
              </dl>
            </div>

            <div class="ai-prompt-token-summary">
              <dl>
                <dt>System prompt</dt>
                <dd id="ai-preview-system-tokens">\u2014</dd>
                <dt>User prompt</dt>
                <dd id="ai-preview-user-tokens">\u2014</dd>
                <dt>Structural metadata (STEP 2)</dt>
                <dd id="ai-preview-structural-tokens">\u2014</dd>
                <dt>Semantic metadata (STEP 3)</dt>
                <dd id="ai-preview-semantic-tokens">\u2014</dd>
                <dt>Total (text only)</dt>
                <dd id="ai-preview-total-tokens">\u2014</dd>
              </dl>
            </div>

            <details class="ai-prompt-section">
              <summary>System prompt</summary>
              <pre class="ai-prompt-text" id="ai-preview-system" tabindex="0"><code></code></pre>
            </details>

            <details class="ai-prompt-section" open>
              <summary>User prompt</summary>
              <pre class="ai-prompt-text" id="ai-preview-user" tabindex="0"><code></code></pre>
            </details>

            <div class="ai-prompt-actions">
              <button type="button"
                      class="ai-prompt-refresh-btn"
                      onclick="window.refreshPromptPreview()"
                      aria-label="Regenerate prompt preview">
                ${window.getIcon?.("refresh") || ""} Refresh preview
              </button>
              <button type="button"
                      class="ai-prompt-copy-btn"
                      onclick="window.copyPromptPreview()"
                      aria-label="Copy full prompt to clipboard">
                ${window.getIcon?.("clipboard") || ""} Copy prompt
              </button>
            </div>
          </div>
        </details>`;
    }

    /**
     * Populate the prompt preview with actual prompt content
     * Called lazily when the preview <details> is toggled open
     *
     * @private
     */
    populatePromptPreview() {
      logDebug("Populating prompt preview...");

      // 1. Build the actual prompts using existing methods
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(this.originalMMD);

      // 2. Calculate token estimates
      const systemTokens = Math.ceil(
        systemPrompt.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      const userTokens = Math.ceil(
        userPrompt.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );

      // 3. Get metadata token breakdown from cached analysis
      const structuralTokens = this.lastStructuralAnalysis
        ? Math.ceil(
            (window
              .getMathPixMMDAnalyser?.()
              ?.formatForPrompt(this.lastStructuralAnalysis)?.length || 0) /
              AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
          )
        : 0;

      const semanticTokens = this.lastSemanticAnalysis
        ? Math.ceil(
            (window
              .getMathPixSemanticMapper?.()
              ?.formatForPrompt(this.lastSemanticAnalysis)?.length || 0) /
              AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
          )
        : 0;

      const totalTokens = systemTokens + userTokens;

      // 4. Populate token summary
      const ids = {
        systemTokens: document.getElementById("ai-preview-system-tokens"),
        userTokens: document.getElementById("ai-preview-user-tokens"),
        structuralTokens: document.getElementById(
          "ai-preview-structural-tokens",
        ),
        semanticTokens: document.getElementById("ai-preview-semantic-tokens"),
        totalTokens: document.getElementById("ai-preview-total-tokens"),
        badge: document.getElementById("ai-prompt-token-badge"),
      };

      if (ids.systemTokens)
        ids.systemTokens.textContent = `~${systemTokens.toLocaleString()}`;
      if (ids.userTokens)
        ids.userTokens.textContent = `~${userTokens.toLocaleString()}`;
      if (ids.structuralTokens) {
        ids.structuralTokens.textContent =
          structuralTokens > 0
            ? `~${structuralTokens.toLocaleString()}`
            : "Not available";
      }
      if (ids.semanticTokens) {
        ids.semanticTokens.textContent =
          semanticTokens > 0
            ? `~${semanticTokens.toLocaleString()}`
            : "Not available";
      }
      if (ids.totalTokens)
        ids.totalTokens.textContent = `~${totalTokens.toLocaleString()}`;
      if (ids.badge)
        ids.badge.textContent = `~${totalTokens.toLocaleString()} tokens`;

      // 5. Populate prompt text (textContent for XSS safety)
      const systemCodeEl = document.querySelector("#ai-preview-system code");
      const userCodeEl = document.querySelector("#ai-preview-user code");

      if (systemCodeEl) systemCodeEl.textContent = systemPrompt;
      if (userCodeEl) {
        userCodeEl.textContent = userPrompt;

        // 6. Apply STEP highlighting (post-process innerHTML after textContent set)
        userCodeEl.innerHTML = userCodeEl.innerHTML.replace(
          /(STEP \d[^<\n]*)/g,
          '<mark class="ai-prompt-step-marker">$1</mark>',
        );
      }

      // 7. Populate file attachment info
      this.populateFileAttachmentInfo();

      // 8. Store prompts for copy functionality
      this._lastPreviewSystemPrompt = systemPrompt;
      this._lastPreviewUserPrompt = userPrompt;

      logDebug(`Prompt preview populated: ~${totalTokens} total tokens`);
    }

    /**
     * Populate the file attachment details in the prompt preview
     * Shows what file will be sent with the API request
     *
     * @private
     */
    populateFileAttachmentInfo() {
      const fileInfoDl = document.getElementById("ai-preview-file-info");
      if (!fileInfoDl) return;

      const pdfBlob = this.getSourcePDF();
      const filename = this.getSourceFilename();
      const engine = this.selectedEngine;

      if (!pdfBlob) {
        fileInfoDl.innerHTML = `
          <dt>Status</dt>
          <dd>No PDF available</dd>`;
        return;
      }

      const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (
        AI_ENHANCER_CONFIG.MAX_PDF_SIZE_FOR_ENHANCEMENT /
        (1024 * 1024)
      ).toFixed(0);
      const withinLimit =
        pdfBlob.size <= AI_ENHANCER_CONFIG.MAX_PDF_SIZE_FOR_ENHANCEMENT;
      const estimatedBase64MB = ((pdfBlob.size * 1.37) / (1024 * 1024)).toFixed(
        2,
      );

      const engineLabels = {
        native: "Native (model reads PDF directly)",
        "mistral-ocr": "Mistral OCR (best for scanned documents)",
      };

      const statusText = withinLimit
        ? "Will be attached"
        : `Exceeds ${maxSizeMB} MB limit`;

      fileInfoDl.innerHTML = `
        <dt>File</dt>
        <dd>${this.escapeHtml(filename)}</dd>
        <dt>Size</dt>
        <dd>${sizeMB} MB (${estimatedBase64MB} MB as base64)</dd>
        <dt>Processing engine</dt>
        <dd>${this.escapeHtml(engineLabels[engine] || engine)}</dd>
        <dt>Status</dt>
        <dd class="${withinLimit ? "" : "ai-preview-file-warning"}">${statusText}</dd>`;
    }

    /**
     * Copy full prompt (system + user) to clipboard
     * Uses stored prompts from last populatePromptPreview() call
     *
     * @private
     */
    async copyPromptToClipboard() {
      const systemPrompt = this._lastPreviewSystemPrompt || "";
      const userPrompt = this._lastPreviewUserPrompt || "";

      if (!systemPrompt && !userPrompt) {
        if (window.notifyWarning) {
          window.notifyWarning(
            "No prompt content to copy. Open the preview first.",
          );
        }
        return;
      }

      const fullPrompt = `=== SYSTEM PROMPT ===\n\n${systemPrompt}\n\n=== USER PROMPT ===\n\n${userPrompt}`;

      try {
        await navigator.clipboard.writeText(fullPrompt);
        // Update button text briefly to confirm
        const btn = document.querySelector(".ai-prompt-copy-btn");
        if (btn) {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `${window.getIcon?.("checkCircle") || ""} Copied!`;
          btn.setAttribute("aria-label", "Prompt copied to clipboard");
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.setAttribute("aria-label", "Copy full prompt to clipboard");
          }, 2000);
        }
        logDebug("Prompt copied to clipboard");
      } catch (err) {
        logError("Failed to copy prompt:", err);
        if (window.notifyError) {
          window.notifyError("Failed to copy to clipboard.");
        }
      }
    }

    /**
     * Handle model selection change
     *
     * @param {string} modelId - Selected model ID
     */
    handleModelChange(modelId) {
      logDebug("Model changed (radio):", modelId);
      this.selectedModel = modelId;

      // Reset the advanced model select back to placeholder (Phase 7.4)
      const advancedSelect = document.getElementById(
        "ai-advanced-model-select",
      );
      if (advancedSelect) {
        advancedSelect.selectedIndex = 0;
      }

      this.updateCostDisplay();
      this.updateReasoningHelpText();
      this.updateEngineWarning();
      this.saveEnhancerPreferences();
    }

    /**
     * Handle advanced model override selection (Phase 7.4)
     * Called when user picks a model from the registry <select>
     *
     * @param {string} modelId - Selected model ID or empty string for placeholder
     */
    handleAdvancedModelChange(modelId) {
      // Placeholder selected — revert to whichever radio was last active
      if (!modelId) {
        logDebug("Advanced model reset to placeholder");
        return;
      }

      logDebug("Model changed (advanced):", modelId);
      this.selectedModel = modelId;

      // Uncheck all recommended radio buttons
      const radios = document.querySelectorAll('input[name="ai-model"]');
      radios.forEach((radio) => {
        radio.checked = false;
      });

      this.updateCostDisplay();
      this.updateReasoningHelpText();
      this.updateEngineWarning();
      this.saveEnhancerPreferences();
    }

    /**
     * Handle engine selection change (Phase 7.4)
     *
     * @param {string} engine - Selected engine value
     */
    handleEngineChange(engine) {
      const validEngines = ["native", "mistral-ocr"];
      if (!validEngines.includes(engine)) {
        logWarn("Invalid engine value:", engine);
        return;
      }
      logDebug("Engine changed:", engine);
      this.selectedEngine = engine;
      this.updateEngineWarning();
      this.updateCostDisplay();
      this.saveEnhancerPreferences();
    }

    /**
     * Show or hide the Haiku + mistral-OCR warning (ME-4, Phase 7.5J)
     * This combination caused critical failures on 3/4 documents in 7.5I testing.
     */
    updateEngineWarning() {
      const warningEl = document.getElementById("ai-engine-warning");
      if (!warningEl) return;

      const modelKey = this.getModelKeyById(this.selectedModel);
      const isDangerous =
        modelKey === "haiku" && this.selectedEngine === "mistral-ocr";

      warningEl.hidden = !isDangerous;
    }

    /**
     * Handle reasoning checkbox toggle
     *
     * @param {boolean} enabled - Whether reasoning is enabled
     */
    handleReasoningChange(enabled) {
      logDebug("Reasoning changed:", enabled);
      this.reasoningEnabled = enabled;
      this.updateCostDisplay();
      this.saveEnhancerPreferences();

      // Update the help text to reflect current model + reasoning state
      this.updateReasoningHelpText();
    }

    /**
     * Handle multi-pass verification toggle change (Phase 7.5H1/2)
     *
     * @param {boolean} enabled - Whether multi-pass is enabled
     */
    handleMultiPassChange(enabled) {
      logDebug("Multi-pass changed:", enabled);
      this.multiPassEnabled = enabled;
      this.updateCostDisplay();
      this.saveEnhancerPreferences();
    }

    /**
     * Get reasoning help text based on the selected model
     *
     * @param {string} modelId - Currently selected model ID
     * @returns {string} Help text for the reasoning checkbox
     */
    getReasoningHelpText(modelId) {
      const modelKey = this.getModelKeyById(modelId);
      const modelDef = modelKey ? this.models?.[modelKey] : null;

      if (modelDef?.reasoningMode === "adaptive") {
        return (
          "Adaptive mode \u2014 the model decides how deeply to think. " +
          "Recommended for complex mathematical OCR correction. " +
          "Reasoning tokens are billed separately and may increase costs."
        );
      }

      if (modelDef?.reasoningMode === "effort") {
        return (
          "Effort-based reasoning with high effort \u2014 " +
          "the model thinks more carefully before responding. " +
          "Reasoning tokens are billed separately and may increase costs."
        );
      }

      if (modelDef && !modelDef.supportsReasoning) {
        return (
          "This model does not support extended thinking. " +
          "The parameter will be sent safely but will have no effect."
        );
      }

      // Registry model or unknown — generic message
      return (
        "Enables the model to reason through problems before responding. " +
        "Reasoning tokens are billed separately and may increase costs. " +
        "Not all models support this feature."
      );
    }

    /**
     * Find the model key (haiku/sonnet/opus) from a model ID
     *
     * @param {string} modelId - Model ID string
     * @returns {string|null} Model key or null
     * @private
     */
    getModelKeyById(modelId) {
      if (!this.models) return null;
      for (const [key, model] of Object.entries(this.models)) {
        if (model.id === modelId) return key;
      }
      return null;
    }

    /**
     * Update the reasoning help text in the DOM
     * Called when model selection changes
     */
    updateReasoningHelpText() {
      const helpEl = document.getElementById("ai-reasoning-help");
      if (helpEl) {
        helpEl.textContent = this.getReasoningHelpText(this.selectedModel);
      }
    }

    /**
     * Build the reasoning configuration object for OpenRouterEmbed
     *
     * @returns {Object} Reasoning config for the embed constructor
     */
    buildReasoningConfig() {
      if (!this.reasoningEnabled) {
        return { enabled: false };
      }

      const modelKey = this.getModelKeyById(this.selectedModel);
      const modelDef = modelKey ? this.models?.[modelKey] : null;

      // Opus 4.6: adaptive mode (no effort, no max_tokens)
      if (modelDef?.reasoningMode === "adaptive") {
        logInfo("Reasoning: adaptive mode for", this.selectedModel);
        return { enabled: true };
      }

      // Sonnet 4.5 and effort-based models: high effort for OCR correction
      if (modelDef?.reasoningMode === "effort") {
        logInfo("Reasoning: effort-based (high) for", this.selectedModel);
        return { enabled: true, effort: "high" };
      }

      // Unknown/registry model — send enabled, let API decide
      logInfo("Reasoning: generic enabled for", this.selectedModel);
      return { enabled: true };
    }

    /**
     * Update cost display in modal
     * Handles both prompts.json models and registry models (Phase 7.4)
     */
    updateCostDisplay() {
      const costElement = document.getElementById("ai-cost-value");
      if (!costElement) return;

      const estimatedTokens = Math.ceil(
        this.originalMMD.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      let cost = this.calculateCost(this.selectedModel, estimatedTokens);

      if (cost !== null) {
        // Add Mistral OCR engine surcharge (£2 per 1000 pages, estimate 1 page minimum)
        if (this.selectedEngine === "mistral-ocr") {
          const estimatedPages = Math.max(
            1,
            Math.ceil(this.originalMMD.split("\n").length / 60),
          );
          cost += (estimatedPages / 1000) * 2.0;
        }

        // Multi-pass doubles the LLM cost (Pass 2 uses same model)
        if (this.multiPassEnabled) {
          cost *= 1.5;
        }

        // Reasoning adds ~30% token overhead (billed separately)
        if (this.reasoningEnabled) {
          cost *= 1.3;
        }
      }

      costElement.textContent =
        cost !== null ? this.formatCost(cost) : "Cost data unavailable";
    }
    /**
     * Calculate estimated cost for enhancement
     * Checks prompts.json models first, then falls back to registry (Phase 7.4)
     *
     * NOTE: prompts.json costs are per 1K tokens;
     *       registry model.costs are per 1M tokens — conversion applied
     *
     * @param {string} modelId - Model ID
     * @param {number} inputTokens - Estimated input tokens
     * @returns {number|null} Estimated cost in GBP, or null if no cost data
     */
    calculateCost(modelId, inputTokens) {
      // Try prompts.json models first
      const promptsModel = Object.values(this.models || {}).find(
        (m) => m.id === modelId,
      );

      if (promptsModel) {
        const outputTokens = inputTokens;
        const systemPromptTokens = 500;
        const totalInputTokens = inputTokens + systemPromptTokens;
        const inputCost =
          (totalInputTokens / 1000) * promptsModel.costPer1kInput;
        const outputCost = (outputTokens / 1000) * promptsModel.costPer1kOutput;
        return inputCost + outputCost;
      }

      // Try registry models (costs are per 1M tokens)
      if (
        window.modelRegistry &&
        typeof window.modelRegistry.getAllModels === "function"
      ) {
        const registryModel = window.modelRegistry
          .getAllModels()
          .find((m) => m.id === modelId);

        if (registryModel?.costs) {
          const outputTokens = inputTokens;
          const systemPromptTokens = 500;
          const totalInputTokens = inputTokens + systemPromptTokens;
          const inputCost =
            (totalInputTokens / 1_000_000) * (registryModel.costs.input || 0);
          const outputCost =
            (outputTokens / 1_000_000) * (registryModel.costs.output || 0);
          return inputCost + outputCost;
        }
      }

      logWarn("No cost data for model:", modelId);
      return null;
    }

    /**
     * Calculate actual cost based on token usage (Phase 7.2)
     *
     * @returns {number} Actual cost in GBP
     */
    calculateActualCost() {
      if (!this.stats || !this.models) {
        logWarn("Cannot calculate cost: missing stats or models");
        return 0;
      }

      // Find the model config by ID
      const model = Object.values(this.models).find(
        (m) => m.id === this.stats.model,
      );

      if (!model) {
        logWarn("Model not found for cost calculation:", this.stats.model);
        return 0;
      }

      const inputCost = (this.stats.inputTokens / 1000) * model.costPer1kInput;
      const outputCost =
        (this.stats.outputTokens / 1000) * model.costPer1kOutput;

      this.stats.actualCost = inputCost + outputCost;

      logDebug("Actual cost calculated:", {
        inputTokens: this.stats.inputTokens,
        outputTokens: this.stats.outputTokens,
        inputCost,
        outputCost,
        total: this.stats.actualCost,
      });

      return this.stats.actualCost;
    }

    /**
     * Calculate diff between original and enhanced MMD (Phase 7.2)
     *
     * @returns {Object|null} Diff statistics or null if unavailable
     */
    calculateDiff() {
      // Check if Diff library is available
      if (typeof Diff === "undefined") {
        logWarn("Diff library not loaded - cannot calculate diff");
        return null;
      }

      if (!this.originalMMD || !this.enhancedMMD) {
        logWarn("Missing MMD content for diff calculation");
        return null;
      }

      try {
        // Calculate line-level diff
        const lineDiff = Diff.diffLines(this.originalMMD, this.enhancedMMD);

        let addedLines = 0;
        let removedLines = 0;

        lineDiff.forEach((part) => {
          if (part.added) {
            addedLines += part.count || 1;
          }
          if (part.removed) {
            removedLines += part.count || 1;
          }
        });

        const totalLines = this.originalMMD.split("\n").length;
        const changedLines = Math.max(addedLines, removedLines);
        const changePercent =
          totalLines > 0 ? Math.round((changedLines / totalLines) * 100) : 0;

        this.diffStats = {
          lineDiff,
          addedLines,
          removedLines,
          changedLines,
          totalLines,
          changePercent,
        };

        // Update stats object if exists
        if (this.stats) {
          this.stats.linesChanged = changedLines;
          this.stats.totalLines = totalLines;
        }

        logDebug("Diff calculated:", {
          added: addedLines,
          removed: removedLines,
          changed: changedLines,
          total: totalLines,
          percent: changePercent,
        });

        return this.diffStats;
      } catch (error) {
        logError("Diff calculation failed:", error);
        return null;
      }
    }

    // ==========================================================================
    // DIFF HIGHLIGHTING (Phase 7.2E)
    // ==========================================================================

    /**
     * Render diff-highlighted content in a column
     * Shows line numbers and highlights added/removed lines
     *
     * @param {HTMLElement} container - Target container element
     * @param {'original' | 'enhanced'} mode - Which side to render
     */
    renderDiffHighlighted(container, mode) {
      if (!container) {
        logWarn("renderDiffHighlighted: no container provided");
        return;
      }

      // Ensure diff is calculated
      if (!this.diffStats?.lineDiff) {
        this.calculateDiff();
      }

      // If diff calculation failed, fall back to plain text
      if (!this.diffStats?.lineDiff) {
        logWarn("Diff not available, falling back to plain content");
        const content =
          mode === "original" ? this.originalMMD : this.enhancedMMD;
        this.renderPlainContent(container, content);
        return;
      }

      const fragment = document.createDocumentFragment();
      let lineNumber = 1;

      // Create list wrapper for accessible diff structure
      const listWrapper = document.createElement("div");
      listWrapper.setAttribute("role", "list");
      listWrapper.setAttribute(
        "aria-label",
        mode === "original"
          ? "Original content with removed lines highlighted"
          : "Enhanced content with added lines highlighted",
      );

      this.diffStats.lineDiff.forEach((part) => {
        // Skip parts not relevant to this mode
        // Original: show removed lines (skip added)
        // Enhanced: show added lines (skip removed)
        if (mode === "original" && part.added) return;
        if (mode === "enhanced" && part.removed) return;

        const lines = part.value.split("\n");
        // Remove trailing empty string from split (if value ends with \n)
        if (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }

        lines.forEach((lineText) => {
          const lineEl = document.createElement("div");
          lineEl.className = "diff-line";
          // All lines are list items for consistent structure
          lineEl.setAttribute("role", "listitem");

          // Apply diff styling and accessible labels
          if (part.removed) {
            lineEl.classList.add("diff-removed");
            lineEl.setAttribute("aria-label", `Line ${lineNumber}, removed`);
          } else if (part.added) {
            lineEl.classList.add("diff-added");
            lineEl.setAttribute("aria-label", `Line ${lineNumber}, added`);
          }

          // Line number (decorative)
          const numEl = document.createElement("span");
          numEl.className = "diff-line-number";
          numEl.textContent = lineNumber++;
          numEl.setAttribute("aria-hidden", "true");

          // Line content
          const contentEl = document.createElement("code");
          contentEl.className = "diff-line-content";
          contentEl.textContent = lineText || " "; // Preserve empty lines visually

          lineEl.appendChild(numEl);
          lineEl.appendChild(contentEl);
          listWrapper.appendChild(lineEl);
        });
      });

      fragment.appendChild(listWrapper);
      container.innerHTML = "";
      container.appendChild(fragment);

      logDebug(`renderDiffHighlighted complete for ${mode}`, {
        lineCount: lineNumber - 1,
      });
    }

    /**
     * Render plain content without diff highlighting (but with line numbers)
     *
     * @param {HTMLElement} container - Target container element
     * @param {string} content - MMD content to display
     */
    renderPlainContent(container, content) {
      if (!container) {
        logWarn("renderPlainContent: no container provided");
        return;
      }

      if (!content) {
        container.textContent = "";
        return;
      }

      const fragment = document.createDocumentFragment();
      const lines = content.split("\n");

      lines.forEach((lineText, index) => {
        const lineEl = document.createElement("div");
        lineEl.className = "diff-line";

        // Line number (decorative)
        const numEl = document.createElement("span");
        numEl.className = "diff-line-number";
        numEl.textContent = index + 1;
        numEl.setAttribute("aria-hidden", "true");

        // Line content
        const contentEl = document.createElement("code");
        contentEl.className = "diff-line-content";
        contentEl.textContent = lineText || " "; // Preserve empty lines visually

        lineEl.appendChild(numEl);
        lineEl.appendChild(contentEl);
        fragment.appendChild(lineEl);
      });

      container.innerHTML = "";
      container.appendChild(fragment);

      logDebug("renderPlainContent complete", { lineCount: lines.length });
    }

    /**
     * Toggle diff highlighting on/off
     * Called when "Show changes" checkbox is toggled
     */
    toggleDiff() {
      const checkbox = document.getElementById("toggle-diff");
      this.showDiff = checkbox?.checked ?? !this.showDiff;

      const originalContainer = document.getElementById("ai-original-content");
      const enhancedContainer = document.getElementById("ai-enhanced-content");

      if (this.showDiff) {
        // Re-render with diff highlighting
        if (originalContainer) {
          this.renderDiffHighlighted(originalContainer, "original");
        }
        if (enhancedContainer) {
          this.renderDiffHighlighted(enhancedContainer, "enhanced");
        }
      } else {
        // Render plain content (line numbers but no highlighting)
        if (originalContainer) {
          this.renderPlainContent(originalContainer, this.originalMMD);
        }
        if (enhancedContainer) {
          this.renderPlainContent(enhancedContainer, this.enhancedMMD);
        }
      }

      logDebug("Diff highlighting toggled:", this.showDiff);
    }

    /**
     * Build statistics disclosure HTML (Phase 7.2)
     *
     * @returns {string} HTML string for statistics section
     */
    buildStatisticsHTML() {
      const stats = this.stats || {};
      const diff = this.diffStats || {};

      const addedLines = diff.addedLines || 0;
      const removedLines = diff.removedLines || 0;
      const totalLines = diff.totalLines || 0;
      const enhancedLines = totalLines - removedLines + addedLines;

      const totalTokens = (stats.inputTokens || 0) + (stats.outputTokens || 0);

      const actualCost = this.formatCost(stats.actualCost || 0);
      const processingTime = stats.processingTime || "0";

      // Get friendly model name
      const modelConfig = Object.values(this.models || {}).find(
        (m) => m.id === this.selectedModel,
      );
      const modelName = modelConfig?.name || this.selectedModel || "Unknown";

      // Build concise summary for the collapsed state
      const summaryParts = [];
      if (addedLines > 0) summaryParts.push(`+${addedLines}`);
      if (removedLines > 0) summaryParts.push(`−${removedLines}`);
      const summaryBrief =
        summaryParts.length > 0
          ? `${summaryParts.join(", ")} lines`
          : "No changes";

      // Build detailed breakdown for the expanded state
      const detailParts = [];
      if (addedLines > 0) detailParts.push(`${addedLines} added`);
      if (removedLines > 0) detailParts.push(`${removedLines} removed`);
      const linesDetail =
        detailParts.length > 0
          ? `${totalLines} → ${enhancedLines} lines (${detailParts.join(", ")})`
          : `${totalLines} lines (no changes)`;

      return `
        <details class="ai-enhancement-stats">
<summary>
            <span class="stats-summary-icon" aria-hidden="true" data-icon="chart"></span>
            <span class="stats-summary-label">Enhancement Statistics</span>
            <span class="stats-summary-brief">${summaryBrief}</span>
          </summary>
          <dl class="stats-grid">
            <div class="stat-item">
              <dt>Lines</dt>
              <dd>${linesDetail}</dd>
            </div>
            <div class="stat-item">
              <dt>Tokens</dt>
              <dd>~${totalTokens.toLocaleString()}</dd>
            </div>
            <div class="stat-item">
              <dt>Estimated cost</dt>
              <dd>${actualCost}</dd>
            </div>
<div class="stat-item">
              <dt>Model</dt>
              <dd>${this.escapeHtml(modelName)}</dd>
            </div>
            <div class="stat-item">
              <dt>Engine</dt>
              <dd>${this.escapeHtml(this.getEngineDisplayName())}</dd>
            </div>
<div class="stat-item">
              <dt>Processing time</dt>
              <dd>${processingTime}s</dd>
            </div>
          </dl>
          ${this.buildValidationHTML()}
        </details>
      `;
    }

    /**
     * Build validation warnings HTML for the statistics section (Phase 7.5F)
     *
     * @returns {string} HTML string for validation warnings display
     */
    buildValidationHTML() {
      const warnings = this.validationWarnings || [];

      if (warnings.length === 0) {
        return `<p class="ai-validation-ok"><span aria-hidden="true" data-icon="checkCircle"></span> No validation issues detected</p>`;
      }

      const hasCritical = warnings.some((w) => w.severity === "critical");
      const summaryIcon = hasCritical ? "error" : "warning";
      const summaryText = hasCritical
        ? `Critical: ${warnings.length} validation issue(s)`
        : `${warnings.length} validation warning(s)`;

      const warningItems = warnings
        .map((w) => {
          const sevIcon = w.severity === "critical" ? "error" : "warning";
          return `<li class="ai-validation-item ai-validation-${this.escapeHtml(w.severity)}">
          <span aria-hidden="true" data-icon="${sevIcon}"></span>
          <strong>${this.escapeHtml(w.message)}</strong>
          <span class="ai-validation-detail">${this.escapeHtml(w.detail)}</span>
        </li>`;
        })
        .join("");

      return `
        <details class="ai-validation-warnings">
          <summary>
            <span aria-hidden="true" data-icon="${summaryIcon}"></span>
            <span>${summaryText}</span>
          </summary>
          <ul class="ai-validation-list">
            ${warningItems}
          </ul>
        </details>
`;
    }

    /**
     * Extract %% AI: uncertainty comments from enhanced MMD into structured
     * metadata, then remove the comment lines from the MMD output. (Phase 7.5L, L.6)
     *
     * Matches lines starting with %% AI: (with optional whitespace).
     * Each annotation is stored with its line number and the preceding context line.
     *
     * Called after blank line normalisation but before validation, so the
     * line numbers correspond to the final output.
     */
    extractUncertaintyMetadata() {
      if (!this.enhancedMMD) {
        this.uncertaintyMetadata = [];
        return;
      }

      const lines = this.enhancedMMD.split("\n");
      const metadata = [];
      const cleanedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^%%\s*AI:\s*(.+)$/);
        if (match) {
          metadata.push({
            lineNumber: i + 1,
            comment: match[1].trim(),
            contextLine: i > 0 ? lines[i - 1] : "(start of document)",
          });
          // Do not include this line in the cleaned output
        } else {
          cleanedLines.push(lines[i]);
        }
      }

      this.uncertaintyMetadata = metadata;

      if (metadata.length > 0) {
        logInfo(
          `Extracted ${metadata.length} uncertainty annotation(s) from enhanced MMD`,
        );
        // Replace enhancedMMD with the cleaned version (comments removed)
        this.enhancedMMD = cleanedLines.join("\n");
      }
    }

    /**
     * Build the uncertainty annotations panel HTML for the results view. (Phase 7.5L, L.7)
     *
     * Shows a collapsible panel with a count badge and each annotation
     * displaying its context line and the AI's uncertainty comment.
     *
     * @returns {string} HTML string for the uncertainty panel
     */
    buildUncertaintyHTML() {
      const annotations = this.uncertaintyMetadata || [];

      if (annotations.length === 0) {
        return "";
      }

      const itemsHTML = annotations
        .map((a, index) => {
          const safeContext = this.escapeHtml(a.contextLine);
          const safeComment = this.escapeHtml(a.comment);
          return `
          <li class="ai-uncertainty-item">
            <span class="ai-uncertainty-index" aria-hidden="true">${index + 1}</span>
            <div class="ai-uncertainty-detail">
              <code class="ai-uncertainty-context">${safeContext}</code>
              <span class="ai-uncertainty-comment">${safeComment}</span>
            </div>
          </li>`;
        })
        .join("");

      const countText =
        annotations.length === 1
          ? "1 uncertain region"
          : `${annotations.length} uncertain regions`;

      return `
        <details class="ai-uncertainty-panel">
          <summary>
            <span class="ai-uncertainty-badge" aria-hidden="true">${annotations.length}</span>
            <span class="ai-uncertainty-label">${countText}</span>
          </summary>
          <ol class="ai-uncertainty-list" aria-label="AI uncertainty annotations">
            ${itemsHTML}
          </ol>
        </details>
      `;
    }

    /**
     * Get human-readable display name for the selected engine (Phase 7.4)
     *
     * @returns {string} Display name
     */
    getEngineDisplayName() {
      const engineNames = {
        native: "Native",
        "mistral-ocr": "Mistral OCR",
      };
      return (
        engineNames[this.selectedEngine] || this.selectedEngine || "Unknown"
      );
    }

    /**
     * Format cost for display
     *
     * @param {number|null} cost - Cost in GBP, or null if unavailable
     * @returns {string} Formatted cost
     */
    formatCost(cost) {
      if (cost === null || cost === undefined) return "Cost data unavailable";
      if (cost < 0.01) return "< \u00A30.01";
      if (cost < 0.1) return `~\u00A3${cost.toFixed(3)}`;
      return `~\u00A3${cost.toFixed(2)}`;
    }

    // ==========================================================================
    // OPENROUTER INTEGRATION
    // ==========================================================================

    /**
     * Build the system prompt for enhancement
     *
     * @returns {string} Complete system prompt
     */
    buildSystemPrompt() {
      if (!this.prompts) {
        return "You are an expert at correcting OCR errors in mathematical documents. Return only the corrected MMD content.";
      }

      const parts = [this.prompts.role, "", "TASK:", this.prompts.task];

      // Phase 7.5B: Principles section (general heuristics)
      if (this.prompts.principles?.length > 0) {
        parts.push(
          "",
          "PRINCIPLES:",
          ...this.prompts.principles.map((p) => `- ${p}`),
        );
      }

      // Phase 7.5B: Domain context section (document type awareness)
      if (this.prompts.domainContext) {
        parts.push(
          "",
          "DOCUMENT CONTEXT:",
          `Document types: ${this.prompts.domainContext.documentTypes}`,
        );
        if (this.prompts.domainContext.commonFeatures?.length > 0) {
          parts.push(
            "Common features to be aware of:",
            ...this.prompts.domainContext.commonFeatures.map((f) => `- ${f}`),
          );
        }
      }

      // Phase 7.5F: Metadata usage instructions
      if (this.prompts.metadataUsage) {
        parts.push(
          "",
          "USING DOCUMENT METADATA:",
          ...this.prompts.metadataUsage.map((m) => `- ${m}`),
        );
      }

      parts.push(
        "",
        "GUIDELINES:",
        ...this.prompts.guidelines.map((g) => `- ${g}`),
        "",
        "COMMON OCR ERRORS TO CHECK:",
        ...this.prompts.commonErrors.map((e) => `- ${e}`),
        "",
        "OUTPUT FORMAT:",
        this.prompts.outputFormat,
      );

      return parts.join("\n");
    }

    /**
     * Build the user prompt for enhancement (Phase 7.5F: chain-of-thought)
     *
     * Assembles a structured prompt with four steps:
     * 1. Document understanding — asks LLM to identify document type/subject
     * 2. Structural inventory — from MMD Analyser (environments, headings, etc.)
     * 3. Semantic context — from Lines.json Mapper (regions, low-confidence, diagrams)
     * 4. Correction — editing instructions + MMD content
     *
     * @param {string} mmdContent - Current MMD content
     * @returns {string} Complete chain-of-thought user prompt
     */
    buildUserPrompt(mmdContent) {
      const parts = [];

      // Phase H.3: Add page range context for partial processing
      const pageRangeContext = this.getPageRangeContext();
      if (pageRangeContext) {
        parts.push(pageRangeContext);
      }

      // STEP 1 — Document understanding
      parts.push(
        `STEP 1 — DOCUMENT UNDERSTANDING (think about this before making corrections):`,
        `Based on the source PDF and the metadata below, identify:`,
        `- What type of document is this? (exam, solution sheet, textbook, reference table, etc.)`,
        `- What subject area and level? (e.g. undergraduate number theory, A-level physics)`,
        `- What types of mathematics are involved? (logic, algebra, calculus, statistics, etc.)`,
        `- Are there handwritten sections? What is their quality?`,
        ``,
        `This context should inform your corrections — for example:`,
        `- In a logic proof, ∪ is likely ∨ (disjunction), not set union`,
        `- In a thermofluids document, η is likely efficiency, not the letter 'n'`,
        `- In a solution sheet, [3] in margins means "3 marks", not a citation`,
      );

      // STEP 2 — Structural inventory from MMD Analyser
      let structuralText = "";
      try {
        const analyser = window.getMathPixMMDAnalyser?.();
        if (analyser) {
          const structuralAnalysis = analyser.analyse(mmdContent);
          this.lastStructuralAnalysis = structuralAnalysis;
          structuralText = analyser.formatForPrompt(structuralAnalysis) || "";
        }
      } catch (err) {
        logWarn(
          "MMD Analyser failed, continuing without structural data:",
          err.message,
        );
      }

      if (structuralText) {
        parts.push(
          ``,
          `STEP 2 — STRUCTURAL INVENTORY (preserve all of these exactly):`,
          structuralText,
        );
      } else {
        this.lastStructuralAnalysis = null;
      }

      // STEP 3 — Semantic context from Lines.json Mapper
      let semanticText = "";
      try {
        const mapper = window.getMathPixSemanticMapper?.();
        if (mapper) {
          const linesData = this.getLinesData();
          const semanticAnalysis = mapper.analyse(linesData);
          this.lastSemanticAnalysis = semanticAnalysis;
          semanticText = mapper.formatForPrompt(semanticAnalysis) || "";
        }
      } catch (err) {
        logWarn(
          "Semantic Mapper failed, continuing without semantic data:",
          err.message,
        );
      }

      if (semanticText) {
        parts.push(
          ``,
          `STEP 3 — SEMANTIC CONTEXT (from OCR engine):`,
          semanticText,
        );
      } else {
        this.lastSemanticAnalysis = null;
      }

      // STEP 4 — Correction instructions + MMD content
      parts.push(
        ``,
        `STEP 4 — CORRECTION:`,
        `Now correct OCR errors in the MMD content below. Follow all guidelines in the system prompt.`,
        `Remember: you are EDITING, not REWRITING. Change only what is wrong.`,
        ``,
        `CURRENT MMD CONTENT:`,
        `\`\`\`mmd`,
        mmdContent,
        `\`\`\``,
        ``,
        `Return ONLY the corrected MMD content, with no additional explanation or markdown formatting around it.`,
      );

      return parts.join("\n");
    }

    /**
     * Get page range context for partial PDF processing
     * Phase H.3: Informs AI when only certain pages were OCR'd
     * Delegates to active data provider (Phase 8A)
     *
     * @returns {string} Context string or empty if full document
     */
    getPageRangeContext() {
      const provider = this.ensureDataProvider();
      if (provider) {
        return provider.getPageRangeContext();
      }
      return "";
    }

    // ==========================================================================
    // DYNAMIC MAX TOKENS (Phase 7.4.1)
    // ==========================================================================

    /**
     * Look up the maximum output tokens for a given model
     *
     * Checks three sources in order:
     * 1. Recommended models from prompts.json (this.models)
     * 2. Registry models from OpenRouter API (window.modelRegistry)
     * 3. Falls back to AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS (8192)
     *
     * @param {string} modelId - The model ID to look up
     * @returns {number} Maximum output tokens for the model
     */
    getModelMaxOutput(modelId) {
      // 1. Check prompts.json models
      const promptsModel = Object.values(this.models || {}).find(
        (m) => m.id === modelId,
      );
      if (promptsModel?.maxTokens) {
        logDebug("Model max output from prompts.json:", {
          modelId,
          maxTokens: promptsModel.maxTokens,
        });
        return promptsModel.maxTokens;
      }

      // 2. Check registry models
      if (
        window.modelRegistry &&
        typeof window.modelRegistry.getAllModels === "function"
      ) {
        const registryModel = window.modelRegistry
          .getAllModels()
          .find((m) => m.id === modelId);

        if (registryModel) {
          // Try known field names for max output tokens
          const maxOutput =
            registryModel.top_provider?.max_completion_tokens ||
            registryModel.max_completion_tokens ||
            registryModel.maxOutput ||
            null;

          logDebug("Registry model fields inspected:", {
            modelId,
            hasTopProvider: !!registryModel.top_provider,
            topProviderMaxCompletion:
              registryModel.top_provider?.max_completion_tokens || "absent",
            maxCompletionTokens:
              registryModel.max_completion_tokens || "absent",
            maxOutput: registryModel.maxOutput || "absent",
            maxContext: registryModel.maxContext || "absent",
            context_length: registryModel.context_length || "absent",
            resolved: maxOutput,
          });

          if (maxOutput && maxOutput > 0) {
            return maxOutput;
          }
        }
      }

      // 3. Safe default
      logDebug("Using default MAX_OUTPUT_TOKENS for model:", {
        modelId,
        fallback: AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS,
      });
      return AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS;
    }

    /**
     * Initialise OpenRouter Embed instance for this request
     *
     * @returns {Promise<Object>} Configured embed instance
     */
    async initialiseEmbed() {
      logDebug("Initialising OpenRouter Embed...");

      // Check dependencies
      if (typeof OpenRouterEmbed === "undefined") {
        throw new Error("OpenRouterEmbed not available");
      }

      if (typeof EmbedFileUtils === "undefined") {
        throw new Error("EmbedFileUtils not available");
      }

      // Create a container for the embed (we don't display output, but it's required)
      let container = document.getElementById("ai-enhance-embed-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "ai-enhance-embed-container";
        container.style.display = "none";
        container.setAttribute("aria-hidden", "true");
        document.body.appendChild(container);
      }

      // Phase 7.4.1: Calculate dynamic max_tokens based on MMD input size
      const mmdTokens = Math.ceil(
        this.originalMMD.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      const modelMaxOutput = this.getModelMaxOutput(this.selectedModel);
      const scaledTokens = Math.ceil(mmdTokens * 1.3);
      const dynamicMaxTokens = Math.min(
        Math.max(scaledTokens, AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS),
        modelMaxOutput,
      );

      // Store for diagnostic access
      this.calculatedMaxTokens = dynamicMaxTokens;

      logInfo("Phase 7.4.1: Dynamic max_tokens calculated", {
        mmdChars: this.originalMMD.length,
        mmdTokens,
        scaledTokens,
        floor: AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS,
        modelCap: modelMaxOutput,
        result: dynamicMaxTokens,
      });

      // Build reasoning configuration based on model and user preference
      const reasoningConfig = this.buildReasoningConfig();

      // Create embed instance
      this.embed = new OpenRouterEmbed({
        containerId: "ai-enhance-embed-container",
        model: this.selectedModel,
        systemPrompt: this.buildSystemPrompt(),
        temperature: 0.3, // Lower temperature for more consistent corrections
        max_tokens: dynamicMaxTokens, // Phase 7.4.1: dynamically scaled
        top_p: 0.9,
        reasoning: reasoningConfig,
        showNotifications: false, // We handle notifications ourselves
        enableLogging: true,
      });

      logInfo("OpenRouter Embed initialised", {
        model: this.selectedModel,
        maxTokens: dynamicMaxTokens,
        reasoning: reasoningConfig,
      });

      return this.embed;
    }

    /**
     * Attach PDF file to embed instance
     *
     * @param {Blob} pdfBlob - PDF blob to attach
     * @returns {Promise<void>}
     */
    async attachPDF(pdfBlob) {
      logDebug("Attaching PDF to embed...");

      if (!this.embed) {
        throw new Error("Embed not initialised");
      }

      if (!this.embed.fileUtils) {
        throw new Error("File utilities not available");
      }

      // Create File object from blob
      const filename = this.getSourceFilename();
      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      // Read file to base64 with timing
      const b64Start = performance.now();
      const base64Data = await this.readFileAsBase64(pdfBlob);
      const b64Duration = Math.round(performance.now() - b64Start);

      this.logTiming("BASE64_CONVERSION", {
        pdfSizeBytes: pdfBlob.size,
        pdfSizeMB: (pdfBlob.size / (1024 * 1024)).toFixed(2),
        base64Length: base64Data.length,
        base64SizeMB: (base64Data.length / (1024 * 1024)).toFixed(2),
        conversionTimeMs: b64Duration,
        expansionRatio: (base64Data.length / pdfBlob.size).toFixed(2),
      });

      // Store on embed instance
      this.embed.currentFile = file;
      this.embed.currentFileBase64 = base64Data;

      // Get file analysis
      try {
        this.embed.currentFileAnalysis =
          await this.embed.fileUtils.analyzeFile(file);
      } catch (error) {
        logWarn("File analysis failed, using defaults:", error);
        this.embed.currentFileAnalysis = {
          pages: 1,
          engine: "native",
          cost: 0,
        };
      }

      // Override engine with user-selected value (Phase 7.4)
      // Falls back to config default if no user selection
      // The fileUtils analysis picks "pdf-text" for large PDFs, which
      // fails on scanned/mathematical documents. Use selected engine instead.
      const configuredEngine =
        this.selectedEngine || AI_ENHANCER_CONFIG.PDF_ENGINE;
      if (configuredEngine && this.embed.currentFileAnalysis) {
        const originalEngine = this.embed.currentFileAnalysis.engine;
        this.embed.currentFileAnalysis.engine = configuredEngine;
        logInfo("PDF engine set", {
          selected: configuredEngine,
          originalFromAnalysis: originalEngine,
        });
      }

      this.logTiming("PDF_ATTACHED", {
        filename,
        size: file.size,
        engine: this.selectedEngine,
        analysisEngine: this.embed.currentFileAnalysis?.engine,
      });

      logInfo("PDF attached", {
        filename,
        size: file.size,
        engine: this.selectedEngine,
        analysis: this.embed.currentFileAnalysis,
      });
    }

    /**
     * Read blob as base64 string
     *
     * @param {Blob} blob - Blob to read
     * @returns {Promise<string>} Base64 data (without data URL prefix)
     */
    readFileAsBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          // Extract base64 data from data URL
          const dataUrl = reader.result;
          const base64 = dataUrl.split(",")[1];
          resolve(base64);
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsDataURL(blob);
      });
    }

    /**
     * Send API request with timeout protection
     * Prevents indefinite hangs for large PDFs
     *
     * @param {string} userPrompt - The prompt to send
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} API response
     * @throws {Error} If request times out or fails
     */
    async sendRequestWithTimeout(userPrompt, timeoutMs) {
      logDebug("Sending request with timeout protection", {
        timeoutMs,
        timeoutMinutes: (timeoutMs / 60000).toFixed(1),
      });

      // Use AbortSignal.timeout() instead of setTimeout.
      // Chrome throttles setTimeout in background tabs to ≤1/min,
      // so a setTimeout-based timeout can fire 25+ seconds late
      // (or never, if the tab stays backgrounded).
      // AbortSignal.timeout() fires at the browser level, unaffected
      // by tab throttling — it fires on time even in background tabs.
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      let settled = false;

      return new Promise((resolve, reject) => {
        // Timeout handler — fires reliably even in background tabs
        timeoutSignal.addEventListener("abort", () => {
          if (settled) return;
          settled = true;

          logError("API call timeout reached", {
            timeoutMs,
            embedProcessing: this.embed?.processing,
            embedStreaming: this.embed?.isStreaming,
          });

          // CRITICAL: Reject FIRST to guarantee the promise settles
          reject(
            new Error(
              `AI enhancement timed out after ${Math.round(timeoutMs / 1000)} seconds. ` +
                `The PDF may be too large or complex for the selected model. ` +
                `Try a smaller document, fewer pages, or a faster model (e.g. Haiku).`,
            ),
          );

          // THEN attempt cleanup — wrapped in try/catch so it cannot
          // interfere with the rejection above
          try {
            if (this.embed && typeof this.embed.cancelRequest === "function") {
              this.embed.cancelRequest("Enhancement timed out");
              logDebug("Embed request cancelled after timeout");
            }
          } catch (cancelError) {
            logWarn(
              "Failed to cancel embed request after timeout:",
              cancelError,
            );
          }

          // Also abort via our own controller
          try {
            if (this.abortController && !this.abortController.signal.aborted) {
              this.abortController.abort();
              logDebug("Abort controller triggered after timeout");
            }
          } catch (abortError) {
            logWarn("Failed to abort after timeout:", abortError);
          }
        });

        // Clear timeout signal listener if abort controller fires first
        // (user cancellation via the Cancel button)
        if (this.abortController) {
          this.abortController.signal.addEventListener("abort", () => {
            if (settled) return;
            settled = true;
            logDebug("Request cancelled by user (abort controller)");
            reject(new Error("Cancelled"));
          });
        }

        // Start the actual request
        this.embed
          .sendRequest(userPrompt)
          .then((response) => {
            if (settled) return;
            settled = true;
            resolve(response);
          })
          .catch((error) => {
            if (settled) return;
            settled = true;
            logError("API request failed", {
              error: error.message,
              isTimeout: false,
              embedProcessing: this.embed?.processing,
              embedStreaming: this.embed?.isStreaming,
              embedLastError: this.embed?.lastError?.message,
              base64Length: this.embed?.currentFileBase64?.length,
            });
            reject(error);
          });
      });
    }

    // ==========================================================================
    // ENHANCEMENT WORKFLOW
    // ==========================================================================

    /**
     * Start the enhancement process
     *
     * @returns {Promise<void>}
     */
    async startEnhancement() {
      logInfo("Starting AI enhancement...");

      if (this.isProcessing) {
        logWarn("Enhancement already in progress");
        return;
      }

      this.isProcessing = true;
      this.abortController = new AbortController();
      this.updateButtonState();

      // Phase 7.3: Reset timing log for research data collection
      this.timingLog = [];
      // Phase 7.4.1: Include dynamic max_tokens calculation preview in START
      const estimatedTokens = Math.ceil(
        this.originalMMD.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      const scaledPreview = Math.ceil(estimatedTokens * 1.3);
      const modelCapPreview = this.getModelMaxOutput(this.selectedModel);
      const maxTokensPreview = Math.min(
        Math.max(scaledPreview, AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS),
        modelCapPreview,
      );

      this.logTiming("START", {
        mmdLines: this.originalMMD.split("\n").length,
        mmdChars: this.originalMMD.length,
        estimatedTokens,
        model: this.selectedModel,
        calculatedMaxTokens: maxTokensPreview,
        reasoning: this.buildReasoningConfig(),
      });

      // Phase 7.2: Initialise statistics tracking
      this.stats = {
        startTime: performance.now(),
        endTime: null,
        processingTime: null,
        inputTokens: 0,
        outputTokens: 0,
        actualCost: 0,
        model: this.selectedModel,
        linesChanged: 0,
        totalLines: 0,
      };
      this.diffStats = null;

      try {
        // Show processing state
        this.showProcessingState();

        // Yield to event loop — let the browser paint the processing UI
        await new Promise((r) => setTimeout(r, 0));

        // Phase 7.3J: Start elapsed timer after UI has painted
        this.startElapsedTimer();

        // Stage 1: Prepare
        this.updateProgress("PREPARING");
        await this.initialiseEmbed();

        // Yield — let progress update render
        await new Promise((r) => setTimeout(r, 0));

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Stage 2: Attach PDF
        this.updateProgress("ATTACHING");

        // Yield — let "Attaching..." text render before potentially slow work
        await new Promise((r) => setTimeout(r, 0));

        const pdfBlob = this.getSourcePDF();
        if (!pdfBlob) {
          throw new Error("Source PDF not available");
        }

        // Pre-flight: Check PDF size before expensive base64 conversion
        const maxSize = AI_ENHANCER_CONFIG.MAX_PDF_SIZE_FOR_ENHANCEMENT;
        if (pdfBlob.size > maxSize) {
          const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(1);
          const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
          throw new Error(
            `PDF too large for AI enhancement: ${sizeMB}MB (maximum ${maxMB}MB). ` +
              `Large PDFs can cause timeouts. Try processing a smaller document or fewer pages.`,
          );
        }

        this.logTiming("SIZE_CHECK_PASSED", {
          pdfSize: pdfBlob.size,
          pdfSizeMB: (pdfBlob.size / (1024 * 1024)).toFixed(2),
          maxSizeMB: (maxSize / (1024 * 1024)).toFixed(0),
        });

        await this.attachPDF(pdfBlob);
        // Note: PDF_ATTACHED timing is logged inside attachPDF() (Phase 7.4)

        // Yield — let browser breathe after base64 conversion
        await new Promise((r) => setTimeout(r, 0));

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Stage 3: Analyse
        this.updateProgress("ANALYSING");

        // Yield — let "Analysing..." text render
        await new Promise((r) => setTimeout(r, 0));

        // Stage 4: Send request
        this.updateProgress("ENHANCING");

        // Yield — CRITICAL: let "Enhancing..." render before the API call
        await new Promise((r) => setTimeout(r, 0));

        const userPrompt = this.buildUserPrompt(this.originalMMD);

        // Phase 7.3: Log before API call with full diagnostic dump
        // This auto-logs BEFORE the potentially blocking call so data is
        // already in the console if the browser becomes unresponsive
        // Phase 7.5F: Calculate metadata token overhead for diagnostics
        const structuralTokens = this.lastStructuralAnalysis
          ? Math.ceil(
              (window
                .getMathPixMMDAnalyser?.()
                ?.formatForPrompt(this.lastStructuralAnalysis)?.length || 0) /
                AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
            )
          : 0;
        const semanticTokens = this.lastSemanticAnalysis
          ? Math.ceil(
              (window
                .getMathPixSemanticMapper?.()
                ?.formatForPrompt(this.lastSemanticAnalysis)?.length || 0) /
                AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
            )
          : 0;

        this.logTiming("API_CALL_START", {
          base64Length: this.embed.currentFileBase64?.length || 0,
          base64SizeMB: this.embed.currentFileBase64
            ? (this.embed.currentFileBase64.length / (1024 * 1024)).toFixed(2)
            : "0",
          userPromptLength: userPrompt.length,
          estimatedPayloadMB: (
            ((this.embed.currentFileBase64?.length || 0) +
              userPrompt.length +
              (this.systemPrompt?.length || 0)) /
            (1024 * 1024)
          ).toFixed(2),
          engine: this.selectedEngine,
          timeoutMs: AI_ENHANCER_CONFIG.API_TIMEOUT_MS,
          calculatedMaxTokens: this.calculatedMaxTokens || "unknown",
          metadataTokenOverhead: structuralTokens + semanticTokens,
          structuralTokens,
          semanticTokens,
        });

        // Pre-flight diagnostic dump — visible in console before any freeze
        console.log(
          "[AI-DIAGNOSTIC] Pre-API-call state:",
          JSON.stringify(
            {
              model: this.selectedModel,
              pdfSizeMB: (pdfBlob.size / (1024 * 1024)).toFixed(2),
              base64SizeMB: this.embed.currentFileBase64
                ? (this.embed.currentFileBase64.length / (1024 * 1024)).toFixed(
                    2,
                  )
                : "0",
              mmdLines: this.originalMMD.split("\n").length,
              mmdChars: this.originalMMD.length,
              userPromptChars: userPrompt.length,
              engine: this.selectedEngine,
              timeoutSeconds: Math.round(
                AI_ENHANCER_CONFIG.API_TIMEOUT_MS / 1000,
              ),
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );

        // Send request with timeout protection
        const timeoutMs = AI_ENHANCER_CONFIG.API_TIMEOUT_MS;
        const response = await this.sendRequestWithTimeout(
          userPrompt,
          timeoutMs,
        );

        // Phase 7.3: Log after API response
        this.logTiming("API_CALL_END", {
          responseLength:
            typeof response === "string"
              ? response.length
              : response?.text?.length || 0,
        });

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Yield — let browser recover after long API call
        await new Promise((r) => setTimeout(r, 0));

        // Stage 5: Validate
        this.updateProgress("VALIDATING");

        // Process response
        this.enhancedMMD = this.processResponse(response);

        if (!this.enhancedMMD || this.enhancedMMD.trim().length === 0) {
          throw new Error("Empty response from AI");
        }

        // Phase 7.5H1/2: Multi-pass verification
        if (this.multiPassEnabled && window.MathPixMultiPass) {
          // Check for cancellation before starting Pass 2
          if (!this.abortController.signal.aborted) {
            this.updateProgress("VERIFYING");

            // Yield — let "Verifying..." text render before API call
            await new Promise((r) => setTimeout(r, 0));

            const verifiedMMD = await window.MathPixMultiPass.orchestrate(this);
            if (verifiedMMD) {
              logInfo("Pass 2 verification applied — replacing Pass 1 output");
              this.enhancedMMD = verifiedMMD;
            } else {
              logInfo("Pass 2 returned null — keeping Pass 1 output");
            }
          }
        }

        // Phase 7.5G′: Normalise blank lines in both original and enhanced
        // Collapses runs of 2+ consecutive blank lines to exactly 1
        // Applied to both sides for fair comparison in diff view
        const origLinesBefore = this.originalMMD.split("\n").length;
        const enhLinesBefore = this.enhancedMMD.split("\n").length;

        this.originalMMD = this.normaliseBlankLines(this.originalMMD);
        this.enhancedMMD = this.normaliseBlankLines(this.enhancedMMD);

        // Track normaliser effect in stats for timing log
        if (this.stats) {
          this.stats.normaliser = {
            originalBefore: origLinesBefore,
            originalAfter: this.originalMMD.split("\n").length,
            enhancedBefore: enhLinesBefore,
            enhancedAfter: this.enhancedMMD.split("\n").length,
          };
          this.stats.normaliser.originalRemoved =
            this.stats.normaliser.originalBefore -
            this.stats.normaliser.originalAfter;
          this.stats.normaliser.enhancedRemoved =
            this.stats.normaliser.enhancedBefore -
            this.stats.normaliser.enhancedAfter;
        }

        // Phase 7.5L: Extract %% AI: uncertainty annotations into structured
        // metadata and remove them from the MMD output (before validation)
        this.extractUncertaintyMetadata();

        // Phase 7.5F: Run output validation checks
        this.validationWarnings = this.validateEnhancement(
          this.originalMMD,
          this.enhancedMMD,
        );

        // Phase 7.2: Capture end time and calculate processing duration
        if (this.stats) {
          this.stats.endTime = performance.now();
          this.stats.processingTime = (
            (this.stats.endTime - this.stats.startTime) /
            1000
          ).toFixed(1);
          logDebug("Processing time:", this.stats.processingTime + "s");
        }

        // Phase 7.2: Calculate diff early so timing log has accurate data
        // (Previously this ran inside showResults(), after the timing log was written,
        // causing linesChanged to always report 0 — see Phase 7.5A evaluation bug)
        this.calculateDiff();

        // Stage 6: Complete
        // Phase 7.3J: Skip updateProgress("COMPLETE") — showResults() immediately
        // replaces the modal content, so the "Enhancement complete!" stage text
        // is never visible. Announcing it via role="status" would only create
        // a redundant screen reader announcement before the results notification.

        // Phase 7.3: Log completion with full timing data
        this.logTiming("COMPLETE", {
          totalTimeMs:
            this.timingLog.length > 0
              ? Date.now() - this.timingLog[0].timestamp
              : 0,
          linesChanged: this.diffStats?.changedLines || 0,
          normaliser: this.stats?.normaliser || null,
        });
        console.log(
          "[AI-TIMING] Full log:",
          JSON.stringify(this.timingLog, null, 2),
        );
        // Phase 7.3J: Stop elapsed timer before switching to results view
        this.stopElapsedTimer();

        // Show results
        await this.showResults();
      } catch (error) {
        if (error.message === "Cancelled") {
          logInfo("Enhancement cancelled by user");
          this.closeModal();
        } else {
          logError("Enhancement failed:", error);
          this.showError(error.message || "Enhancement failed");
        }
      } finally {
        this.isProcessing = false;
        this.updateButtonState();
        this.cleanup();
      }
    }

    /**
     * Show processing state in modal
     */
    showProcessingState() {
      if (!this.currentModal) {
        logWarn("No modal to update");
        return;
      }

      const content = `
      <div class="ai-processing-display" data-state="processing">
        <div class="processing-spinner" aria-hidden="true"></div>
        <p class="processing-stage" id="ai-processing-stage" role="status">Preparing... please wait</p>
        <p class="processing-elapsed" id="ai-elapsed-display" aria-live="off"></p>
        <p class="processing-metrics" id="ai-processing-metrics"></p>
        <p class="processing-hint" id="ai-processing-hint"></p>
        <div class="processing-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Enhancement progress">
          <div class="progress-fill" id="ai-progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;

      this.currentModal.setContent(content);
      this.updateFooterButtons("processing");

      // Phase 7.3J: Populate document metrics
      const lines = this.originalMMD.split("\n").length;
      const tokens = Math.ceil(
        this.originalMMD.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      const modelConfig = Object.values(this.models || {}).find(
        (m) => m.id === this.selectedModel,
      );
      const modelName =
        modelConfig?.name || this.selectedModel.split("/").pop();

      const metricsEl = document.getElementById("ai-processing-metrics");
      if (metricsEl) {
        metricsEl.textContent = `${lines} lines · ~${tokens.toLocaleString()} tokens · ${modelName}`;
      }

      // Phase 7.3J: Populate typical range hint
      const hintEl = document.getElementById("ai-processing-hint");
      if (hintEl) {
        hintEl.textContent = "Usually takes 15\u201360 seconds";
      }

      // Use notification system to announce start - reliable for screen readers
      if (window.notifyInfo) {
        window.notifyInfo("AI enhancement started. Preparing... please wait.");
      }

      logDebug("Modal updated to processing state");
    }
    /**
     * Update progress display during processing
     *
     * @param {string} stageKey - Key from AI_ENHANCER_CONFIG.PROCESSING_STAGES
     */
    updateProgress(stageKey) {
      const stages = AI_ENHANCER_CONFIG?.PROCESSING_STAGES;
      if (!stages) {
        logError("PROCESSING_STAGES not defined in AI_ENHANCER_CONFIG");
        return;
      }
      const stageInfo = stages[stageKey];
      if (!stageInfo) {
        logWarn("Unknown processing stage:", stageKey);
        return;
      }

      logDebug(`Progress update: ${stageKey} ${stageInfo.progress}%`);

      // Update progress bar
      const progressFill = document.getElementById("ai-progress-fill");
      if (progressFill) {
        progressFill.style.width = `${stageInfo.progress}%`;
        const progressBar = progressFill.closest(".processing-progress");
        if (progressBar) {
          progressBar.setAttribute("aria-valuenow", stageInfo.progress);

          // Phase 7.3J: Toggle indeterminate pulse during API call stage
          if (stageKey === "ENHANCING") {
            progressBar.classList.add("indeterminate");
          } else {
            progressBar.classList.remove("indeterminate");
          }
        }
      }

      // Update stage text (aria-live region will announce changes)
      const stageText = document.getElementById("ai-processing-stage");
      if (stageText) {
        stageText.textContent = stageInfo.text;
      }

      // Note: Screen reader announcements handled by aria-live="polite" on
      // .ai-processing-display container - no need for duplicate UniversalModal.showStatus
    }

    /**
     * Normalise blank lines by collapsing consecutive blank lines to single blank line
     * Phase 7.5G′: Deterministic post-processing to reduce line drift
     *
     * In MMD/markdown, a single blank line is semantically meaningful (paragraph break).
     * However, runs of 2+ consecutive blank lines serve no purpose and are typically
     * LLM-inserted "readability" whitespace that inflates line drift metrics.
     *
     * @param {string} content - MMD content to normalise
     * @returns {string} Content with consecutive blank lines collapsed
     */
    normaliseBlankLines(content) {
      if (!content) return content;

      const before = content.split("\n").length;

      // Replace runs of 2+ consecutive blank lines (lines containing only whitespace)
      // with a single blank line
      const normalised = content.replace(/(\n\s*\n)(\s*\n)+/g, "\n\n");

      const after = normalised.split("\n").length;
      const removed = before - after;

      if (removed > 0) {
        logWarn(
          `Blank line normalisation: ${before} → ${after} lines (${removed} removed)`,
        );
      }

      return normalised;
    }

    /**
     * Process API response to extract MMD content
     *
     * @param {Object} response - API response
     * @returns {string} Extracted MMD content
     */
    processResponse(response) {
      logDebug("Processing response...", response);

      // Phase 7.2: Extract token usage from API response
      // OpenRouterEmbed wraps the raw response and provides estimated token counts
      // Note: These are character-based estimates, not actual API usage values
      if (this.stats && response) {
        const usage =
          response.raw?.usage || response.metadata?.tokens || response.usage;

        if (usage) {
          // Round to integers (OpenRouterEmbed provides decimal estimates)
          this.stats.inputTokens = Math.round(usage.prompt_tokens || 0);
          this.stats.outputTokens = Math.round(usage.completion_tokens || 0);
          logDebug("Token usage extracted (estimates):", {
            input: this.stats.inputTokens,
            output: this.stats.outputTokens,
          });
        } else {
          logWarn("No usage data found in response");
        }
      }

      let content = "";

      // Handle different response formats
      if (typeof response === "string") {
        content = response;
      } else if (response?.text) {
        content = response.text;
      } else if (response?.content) {
        content = response.content;
      } else if (response?.choices?.[0]?.message?.content) {
        content = response.choices[0].message.content;
      }

      // Clean up response
      content = content.trim();

      // Remove markdown code fences if present
      if (content.startsWith("```mmd") || content.startsWith("```")) {
        content = content.replace(/^```(?:mmd)?\n?/, "").replace(/\n?```$/, "");
      }

      logInfo("Response processed", {
        length: content.length,
        lines: content.split("\n").length,
      });

      return content;
    }

    // ==========================================================================
    // OUTPUT VALIDATION (Phase 7.5F)
    // ==========================================================================

    /**
     * Validate enhancement output against original MMD (Phase 7.5F)
     *
     * Performs lightweight checks to detect potential regressions:
     * 1. Image reference count — flags if enhanced has fewer ![  references
     * 3. LaTeX environment preservation — flags if \begin{}/\end{} pairs decreased
     *
     * @param {string} originalMMD - Original MMD content
     * @param {string} enhancedMMD - Enhanced MMD content
     * @returns {Array<{severity: string, message: string, detail: string}>} Validation warnings
     */
    validateEnhancement(originalMMD, enhancedMMD) {
      const warnings = [];

      if (!originalMMD || !enhancedMMD) {
        return warnings;
      }

      // Check 1: Image reference count
      const countImages = (text) => {
        const matches = text.match(/!\[/g);
        return matches ? matches.length : 0;
      };

      const originalImages = countImages(originalMMD);
      const enhancedImages = countImages(enhancedMMD);

      if (originalImages > 0 && enhancedImages < originalImages) {
        const removed = originalImages - enhancedImages;
        const severity = enhancedImages === 0 ? "critical" : "warning";
        warnings.push({
          severity,
          message:
            severity === "critical"
              ? "Critical: All image references removed"
              : `Image references reduced`,
          detail: `Original: ${originalImages} image(s), Enhanced: ${enhancedImages} image(s) (${removed} removed)`,
        });
      }

      // Check 3: LaTeX environment preservation
      const countEnvs = (text, marker) => {
        const regex = new RegExp(
          marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g",
        );
        const matches = text.match(regex);
        return matches ? matches.length : 0;
      };

      const originalBegins = countEnvs(originalMMD, "\\begin{");
      const enhancedBegins = countEnvs(enhancedMMD, "\\begin{");
      const originalEnds = countEnvs(originalMMD, "\\end{");
      const enhancedEnds = countEnvs(enhancedMMD, "\\end{");

      if (originalBegins > 0 && enhancedBegins < originalBegins) {
        const removed = originalBegins - enhancedBegins;
        warnings.push({
          severity: "warning",
          message: "LaTeX environments reduced",
          detail: `Original: ${originalBegins} \\begin{} (${originalEnds} \\end{}), Enhanced: ${enhancedBegins} \\begin{} (${enhancedEnds} \\end{}) — ${removed} environment(s) may have been removed`,
        });
      }

      logInfo("Validation complete:", {
        imageCheck: `${originalImages} → ${enhancedImages}`,
        envCheck: `${originalBegins}/${originalEnds} → ${enhancedBegins}/${enhancedEnds}`,
        warningCount: warnings.length,
      });

      return warnings;
    }

    // ==========================================================================
    // RESULTS DISPLAY
    // ==========================================================================

    /**
     * Show enhancement results in modal with 4-column comparison view
     * Columns: Original MMD | Enhanced MMD | Preview | Source PDF
     * Default visibility: Enhanced + Preview shown, Original + PDF hidden
     */
    async showResults() {
      logInfo("Showing enhancement results...");

      // Hide any lingering status notification
      UniversalModal.hideStatus();

      if (!this.currentModal) {
        logWarn("No modal to update");
        return;
      }

      // Phase 7.2: Calculate diff (skip if already calculated in startEnhancement)
      // and actual cost
      if (!this.diffStats) {
        this.calculateDiff();
      }
      this.calculateActualCost();

      // Load saved column preferences
      const prefs = this.loadColumnPreferences();

      // Phase 7.3K: Restore sync scroll state from preferences
      this.syncScrollEnabled = prefs.syncScroll ?? false;
      // Phase 7.3L: Restore sync mode ('mmd' or 'all')
      this.scrollSyncMode = prefs.scrollSyncMode ?? "mmd";

      // Build statistics HTML (Phase 7.2)
      const statsHTML = this.buildStatisticsHTML();

      const content = `
      <div class="ai-results-display" data-state="results">
        <!-- Column Toggles -->
        <fieldset class="ai-column-toggles">
          <legend>Show/hide comparison columns</legend>
          <label>
            <input type="checkbox" id="toggle-original" 
                   ${prefs.original ? "checked" : ""} 
                   onchange="window.toggleAIColumn('original')">
            Original MMD
          </label>
          <label>
            <input type="checkbox" id="toggle-enhanced" 
                   ${prefs.enhanced ? "checked" : ""} 
                   onchange="window.toggleAIColumn('enhanced')">
            Enhanced MMD
          </label>
          <label>
            <input type="checkbox" id="toggle-preview" 
                   ${prefs.preview ? "checked" : ""} 
                   onchange="window.toggleAIColumn('preview')">
            Preview
          </label>
<label>
            <input type="checkbox" id="toggle-pdf" 
                   ${prefs.pdf ? "checked" : ""} 
                   onchange="window.toggleAIColumn('pdf')">
            Source PDF
          </label>
          <span class="toggle-separator" aria-hidden="true"></span>
<label>
            <input type="checkbox" id="toggle-diff" 
                   ${this.showDiff ? "checked" : ""} 
                   onchange="window.toggleAIDiff()">
            Show changes
          </label>
<label>
            <input type="checkbox" id="toggle-sync" 
                   ${this.syncScrollEnabled ? "checked" : ""} 
                   onchange="window.toggleAISync()">
            Sync scrolling
          </label>
          <select id="sync-mode-select" 
                  aria-label="Scroll sync scope"
                  onchange="window.setAISyncMode(this.value)"
                  ${this.syncScrollEnabled ? "" : "hidden"}>
            <option value="mmd" ${this.scrollSyncMode === "mmd" ? "selected" : ""}>MMD only</option>
            <option value="all" ${this.scrollSyncMode === "all" ? "selected" : ""}>MMD and preview</option>
          </select>
        </fieldset>

        <!-- 4-Column Comparison Grid -->
        <div class="ai-comparison-grid">
<!-- Column 1: Original MMD -->
          <div class="ai-comparison-column" id="ai-col-original" ${prefs.original ? "" : "hidden"}>
            <h4>Original MMD</h4>
            <div class="column-content mmd-code" id="ai-original-content" tabindex="0" aria-label="Original MMD content - scrollable region"></div>
          </div>

          <!-- Column 2: Enhanced MMD -->
          <div class="ai-comparison-column" id="ai-col-enhanced" ${prefs.enhanced ? "" : "hidden"}>
            <h4>Enhanced MMD</h4>
            <div class="column-content mmd-code" id="ai-enhanced-content" tabindex="0" aria-label="Enhanced MMD content - scrollable region"></div>
          </div>

<!-- Column 3: Preview (Enhanced) -->
          <div class="ai-comparison-column" id="ai-col-preview" ${prefs.preview ? "" : "hidden"}>
            <h4>Preview (Enhanced)</h4>
            <div class="column-content mmd-preview">
              <a href="#ai-preview-skip-target" class="skip-link" id="ai-preview-skip" onclick="window.aiPreviewSkip(event)">Skip preview content</a>
              <div id="ai-preview-content" tabindex="0" aria-label="Enhanced MMD preview - scrollable region"></div>
              <span id="ai-preview-skip-target" tabindex="-1"></span>
            </div>
          </div>

<!-- Column 4: Source PDF -->
          <div class="ai-comparison-column" id="ai-col-pdf" ${prefs.pdf ? "" : "hidden"}>
            <h4>Source PDF</h4>
            <div class="column-content pdf-viewer" id="ai-pdf-content">
              <div class="ai-pdf-loading" role="status" aria-live="polite">
                <div class="ai-pdf-loading-spinner" aria-hidden="true"></div>
                <p>PDF will load when column is shown</p>
              </div>
            </div>
          </div>
        </div>

<!-- Phase 7.2: Enhancement Statistics -->
        ${statsHTML}

        <!-- Phase 7.5L: Uncertainty Annotations -->
        ${this.buildUncertaintyHTML()}
      </div>
    `;

      this.currentModal.setContent(content);
      this.updateFooterButtons("results");

      // Populate SVG icons in the modal content
      if (window.IconLibrary?.populateIcons) {
        window.IconLibrary.populateIcons();
      }

      // Render diff-highlighted content in MMD columns (Phase 7.2E)
      const originalContainer = document.getElementById("ai-original-content");
      const enhancedContainer = document.getElementById("ai-enhanced-content");

      if (this.showDiff) {
        if (originalContainer)
          this.renderDiffHighlighted(originalContainer, "original");
        if (enhancedContainer)
          this.renderDiffHighlighted(enhancedContainer, "enhanced");
      } else {
        if (originalContainer)
          this.renderPlainContent(originalContainer, this.originalMMD);
        if (enhancedContainer)
          this.renderPlainContent(enhancedContainer, this.enhancedMMD);
      }

      // Render preview after content is in DOM
      await this.renderPreview();

      // Render PDF if column is visible
      if (prefs.pdf) {
        await this.renderSourcePDF();
      }

      // Phase 7.3K: Set up scroll sync if enabled (deferred to ensure layout is complete)
      if (this.syncScrollEnabled) {
        requestAnimationFrame(() => this.setupScrollSync());
      }

      // Announce completion to screen reader users
      if (window.notifySuccess) {
        window.notifySuccess(
          "Enhancement complete. Review the results and choose Apply Changes or Discard.",
        );
      }

      logDebug("Modal updated to results state with 4-column view");
    }

    /**
     * Render preview of enhanced content using MathPixMMDPreview
     * Uses the same rendering system as the main MMD preview for consistency
     * @returns {Promise<void>}
     */
    async renderPreview() {
      const previewElement = document.getElementById("ai-preview-content");
      if (!previewElement) {
        logWarn("Preview element not found");
        return;
      }

      if (!this.enhancedMMD) {
        previewElement.innerHTML =
          '<p class="ai-preview-empty">No enhanced content to preview</p>';
        return;
      }

      try {
        // Get or create the MMD Preview instance
        const mmdPreview = window.getMathPixMMDPreview?.();

        if (mmdPreview) {
          // Ensure library is loaded
          await mmdPreview.loadLibrary();

          if (mmdPreview.isReady()) {
            // Use the proper render method which handles MathJax
            await mmdPreview.render(this.enhancedMMD, previewElement);
            logDebug("Preview rendered using MathPixMMDPreview");
            return;
          }
        }

        // Fallback: Try using window.markdownToHTML directly (CDN function)
        if (typeof window.markdownToHTML === "function") {
          const html = window.markdownToHTML(this.enhancedMMD);
          previewElement.innerHTML = html;

          // Trigger MathJax if available
          if (window.MathJax?.typesetPromise) {
            try {
              await window.MathJax.typesetPromise([previewElement]);
            } catch (mathError) {
              logWarn(
                "MathJax typeset failed (content still displayed)",
                mathError,
              );
            }
          }
          logDebug("Preview rendered using markdownToHTML fallback");
          return;
        }

        // Last resort: Show as preformatted text
        logWarn("No MMD renderer available, showing raw content");
        previewElement.innerHTML = `<pre class="ai-preview-raw">${this.escapeHtml(this.enhancedMMD)}</pre>`;
      } catch (error) {
        logError("Preview render failed:", error);
        previewElement.innerHTML = `
        <div class="ai-preview-error">
          <p>Preview rendering failed</p>
          <pre>${this.escapeHtml(this.enhancedMMD)}</pre>
        </div>
      `;
      }
    }

    // ==========================================================================
    // COLUMN VISIBILITY MANAGEMENT (Phase 7.1C)
    // ==========================================================================

    /**
     * Toggle visibility of a comparison column
     * @param {string} columnId - Column identifier: 'original', 'enhanced', 'preview', 'pdf'
     */
    async toggleColumn(columnId) {
      logDebug("Toggling column:", columnId);

      const column = document.getElementById(`ai-col-${columnId}`);
      const checkbox = document.getElementById(`toggle-${columnId}`);

      if (!column) {
        logWarn("Column not found:", columnId);
        return;
      }

      const isChecked = checkbox?.checked ?? false;

      if (isChecked) {
        column.hidden = false;

        // Lazy-load PDF when first shown
        if (columnId === "pdf" && !this.pdfRendered) {
          await this.renderSourcePDF();
        }

        // Phase 7.3L: Re-sync scroll position when unhiding a synced column
        const isSyncedColumn =
          columnId === "original" ||
          columnId === "enhanced" ||
          (columnId === "preview" && this.scrollSyncMode === "all");

        if (this.syncScrollEnabled && isSyncedColumn) {
          const original = document.getElementById("ai-original-content");
          const enhanced = document.getElementById("ai-enhanced-content");
          const previewInner = document.getElementById("ai-preview-content");
          const preview = previewInner?.closest(".column-content") || null;

          // Map column IDs to their scroll elements (mode-dependent)
          const columnMap = { original, enhanced };
          if (this.scrollSyncMode === "all" && preview) {
            columnMap.preview = preview;
          }
          const target = columnMap[columnId];

          if (target) {
            // Find the first visible source column (not the one being unhidden)
            const sourceKeys = Object.keys(columnMap).filter(
              (k) => k !== columnId,
            );
            let source = null;
            for (const key of sourceKeys) {
              const el = columnMap[key];
              if (el && el.offsetParent !== null) {
                source = el;
                break;
              }
            }

            if (source) {
              // Defer to let browser reflow the newly-visible column
              requestAnimationFrame(() => {
                const maxSource = source.scrollHeight - source.clientHeight;
                if (maxSource > 0) {
                  const percent = source.scrollTop / maxSource;
                  const maxTarget = target.scrollHeight - target.clientHeight;
                  if (maxTarget > 0) {
                    target.scrollTop = percent * maxTarget;
                  }
                }
              });
            }
          }
        }
      } else {
        column.hidden = true;
      }

      // Save preferences
      this.saveColumnPreferences();

      logDebug("Column visibility updated", { columnId, visible: isChecked });
    }

    /**
     * Load column visibility preferences from localStorage
     * @returns {Object} Column visibility preferences
     */
    loadColumnPreferences() {
      const defaults = {
        original: false,
        enhanced: true,
        preview: true,
        pdf: false,
        syncScroll: false, // Phase 7.3K: opt-in, unchecked by default
        scrollSyncMode: "mmd", // Phase 7.3L: 'mmd' or 'all'
      };

      try {
        const saved = localStorage.getItem("ai-enhance-column-prefs");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Merge with defaults to handle new columns
          return { ...defaults, ...parsed };
        }
      } catch (error) {
        logWarn("Failed to load column preferences:", error);
      }

      return defaults;
    }

    /**
     * Save column visibility preferences to localStorage
     */
    saveColumnPreferences() {
      const prefs = {
        original: document.getElementById("toggle-original")?.checked ?? false,
        enhanced: document.getElementById("toggle-enhanced")?.checked ?? true,
        preview: document.getElementById("toggle-preview")?.checked ?? true,
        pdf: document.getElementById("toggle-pdf")?.checked ?? false,
        syncScroll: document.getElementById("toggle-sync")?.checked ?? false, // Phase 7.3K
        scrollSyncMode: this.scrollSyncMode, // Phase 7.3L: no UI — set programmatically
      };

      try {
        localStorage.setItem("ai-enhance-column-prefs", JSON.stringify(prefs));
        logDebug("Column preferences saved:", prefs);
      } catch (error) {
        logWarn("Failed to save column preferences:", error);
      }
    }

    // ==========================================================================
    // SCROLL SYNC (Phase 7.3K)
    // ==========================================================================

    /**
     * Toggle scroll sync between Original and Enhanced columns
     * Called when "Sync scrolling" checkbox is toggled
     */
    toggleScrollSync() {
      const checkbox = document.getElementById("toggle-sync");
      this.syncScrollEnabled = checkbox?.checked ?? !this.syncScrollEnabled;

      if (this.syncScrollEnabled) {
        this.setupScrollSync();
      } else {
        this.teardownScrollSync();
      }

      // Show/hide mode selector (Phase 7.3L)
      const modeSelect = document.getElementById("sync-mode-select");
      if (modeSelect) {
        modeSelect.hidden = !this.syncScrollEnabled;
      }

      // Persist preference
      this.saveColumnPreferences();

      logDebug("Scroll sync toggled:", this.syncScrollEnabled);
    }

    /**
     * Set up multi-column scroll sync between Original, Enhanced, and Preview columns (Phase 7.3L)
     * Uses percentage-based sync with loop prevention via isSyncingScroll flag.
     * Preview scroll container is the .column-content wrapper (has overflow-y: auto),
     * not #ai-preview-content itself.
     */
    setupScrollSync() {
      // Clean up any existing listeners first
      this.teardownScrollSync();

      const original = document.getElementById("ai-original-content");
      const enhanced = document.getElementById("ai-enhanced-content");
      // Preview: #ai-preview-content is a child; the scrolling wrapper is its .column-content parent
      const previewInner = document.getElementById("ai-preview-content");
      const preview = previewInner?.closest(".column-content") || null;

      // Build array of available synced columns (Phase 7.3L: mode-dependent)
      const columns = [];
      if (original) columns.push({ key: "original", el: original });
      if (enhanced) columns.push({ key: "enhanced", el: enhanced });
      if (preview && this.scrollSyncMode === "all") {
        columns.push({ key: "preview", el: preview });
      }

      if (columns.length < 2) {
        logWarn(
          "Cannot set up scroll sync — fewer than 2 column containers found",
        );
        return;
      }

      /**
       * Sync scroll position from source to all other visible synced columns using percentage
       * @param {HTMLElement} source - The element being scrolled by the user
       * @param {Array<{key: string, el: HTMLElement}>} targets - Other columns to sync
       */
      const syncScroll = (source, targets) => {
        if (this.isSyncingScroll || !this.syncScrollEnabled) return;

        const maxScroll = source.scrollHeight - source.clientHeight;
        if (maxScroll <= 0) return; // Guard: no scrollable content

        this.isSyncingScroll = true;

        const scrollPercent = source.scrollTop / maxScroll;

        for (const { el } of targets) {
          // Only sync columns that are currently visible (not hidden)
          if (el.offsetParent === null) continue;
          const targetMax = el.scrollHeight - el.clientHeight;
          if (targetMax > 0) {
            el.scrollTop = scrollPercent * targetMax;
          }
        }

        // Release lock after browser has painted the scroll
        requestAnimationFrame(() => {
          this.isSyncingScroll = false;
        });
      };

      // Create handler for each column that syncs to all others
      for (const col of columns) {
        const targets = columns.filter((c) => c.key !== col.key);
        this.scrollHandlers[col.key] = () => syncScroll(col.el, targets);
        col.el.addEventListener("scroll", this.scrollHandlers[col.key], {
          passive: true,
        });
      }

      logDebug(
        "Scroll sync listeners attached for columns:",
        columns.map((c) => c.key),
      );
    }

    /**
     * Remove scroll sync listeners
     * Safe to call when listeners don't exist (idempotent)
     */
    teardownScrollSync() {
      const original = document.getElementById("ai-original-content");
      const enhanced = document.getElementById("ai-enhanced-content");
      const previewInner = document.getElementById("ai-preview-content");
      const preview = previewInner?.closest(".column-content") || null;

      if (original && this.scrollHandlers.original) {
        original.removeEventListener("scroll", this.scrollHandlers.original);
      }
      if (enhanced && this.scrollHandlers.enhanced) {
        enhanced.removeEventListener("scroll", this.scrollHandlers.enhanced);
      }
      if (preview && this.scrollHandlers.preview) {
        preview.removeEventListener("scroll", this.scrollHandlers.preview);
      }

      this.scrollHandlers = { original: null, enhanced: null, preview: null };
      this.isSyncingScroll = false;

      logDebug("Scroll sync listeners removed");
    }

    /**
     * Render source PDF in the PDF column with controls
     * Uses PDF.js to render all pages with zoom and navigation
     * @returns {Promise<void>}
     */
    async renderSourcePDF() {
      const pdfContainer = document.getElementById("ai-pdf-content");
      if (!pdfContainer) {
        logWarn("PDF container not found");
        return;
      }

      // Get PDF blob from session
      const pdfBlob = this.getSourcePDF();
      if (!pdfBlob) {
        pdfContainer.innerHTML = `
          <div class="ai-pdf-error" role="alert">
            <p>Source PDF not available</p>
          </div>
        `;
        return;
      }

      // Show loading state
      pdfContainer.innerHTML = `
        <div class="ai-pdf-loading" role="status" aria-live="polite">
          <div class="ai-pdf-loading-spinner" aria-hidden="true"></div>
          <p>Loading PDF...</p>
        </div>
      `;

      try {
        // Ensure PDF.js is loaded
        await this.ensurePDFJSLoaded();

        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
          throw new Error("PDF.js library not available");
        }

        // Load PDF document
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        this.pdfDocument = await loadingTask.promise;

        const totalPages = this.pdfDocument.numPages;
        logInfo("PDF loaded for comparison", { numPages: totalPages });

        // Build PDF viewer HTML with controls at bottom
        pdfContainer.innerHTML = `
<div class="ai-pdf-scroll-container" id="ai-pdf-scroll-container" tabindex="0" aria-label="PDF document viewer - scrollable region">
            <div class="ai-pdf-pages-container" id="ai-pdf-pages-container"></div>
          </div>
          <div class="ai-pdf-controls">
            <div class="ai-pdf-navigation">
              <label for="ai-pdf-page-input" class="sr-only">Go to page</label>
              <input type="number" 
                     id="ai-pdf-page-input" 
                     class="ai-pdf-page-input" 
                     min="1" 
                     max="${totalPages}"
                     value="1" 
                     aria-label="Page number"
                     onchange="window.aiPdfGoToPage(this.value)">
              <span class="ai-pdf-page-total">/ <span id="ai-pdf-total-pages">${totalPages}</span></span>
            </div>
            <div class="ai-pdf-zoom">
              <button type="button" 
                      class="ai-pdf-zoom-btn" 
                      aria-label="Zoom out"
                      onclick="window.aiPdfZoom('out')">
                <span aria-hidden="true" data-icon="zoomOut">
                  <svg aria-hidden="true" class="icon" height="16" viewBox="0 0 21 21" width="16" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
                      <circle cx="5.5" cy="5.5" r="5"></circle>
                      <path d="m7.5 5.5h-4z"></path>
                      <path d="m14.571 14.5-5.45-5.381"></path>
                    </g>
                  </svg>
                </span>
              </button>
              <span id="ai-pdf-zoom-level" class="ai-pdf-zoom-level">100%</span>
              <button type="button" 
                      class="ai-pdf-zoom-btn" 
                      aria-label="Zoom in"
                      onclick="window.aiPdfZoom('in')">
                <span aria-hidden="true" data-icon="zoomIn">
                  <svg aria-hidden="true" class="icon" height="16" viewBox="0 0 21 21" width="16" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
                      <circle cx="5.5" cy="5.5" r="5"></circle>
                      <path d="m7.5 5.5h-4zm-2 2v-4z"></path>
                      <path d="m14.5 14.5-5.367-5.367"></path>
                    </g>
                  </svg>
                </span>
              </button>
              <button type="button" 
                      class="ai-pdf-zoom-btn" 
                      aria-label="Fit to width"
                      onclick="window.aiPdfZoom('fit')">
                <span aria-hidden="true" data-icon="fit">
                  <svg aria-hidden="true" class="icon" height="16" viewBox="0 0 21 21" width="16" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(1.228 .814)">
                      <path d="m14.279 13.701 4-4-4-4.015"></path>
                      <path d="m4.279 13.701-4-4 4-4.015"></path>
                      <path d="m15.636 3.322-12.728 12.728" transform="matrix(.70710678 .70710678 -.70710678 .70710678 9.564742 -3.71933)"></path>
                    </g>
                  </svg>
                </span>
                Fit
              </button>
            </div>
          </div>
        `;

        // Get references
        const scrollContainer = document.getElementById(
          "ai-pdf-scroll-container",
        );
        const pagesContainer = document.getElementById(
          "ai-pdf-pages-container",
        );

        // Calculate initial scale to fit width
        const containerWidth = scrollContainer?.clientWidth || 280;
        const firstPage = await this.pdfDocument.getPage(1);
        const unscaledViewport = firstPage.getViewport({ scale: 1 });
        this.currentPdfScale = (containerWidth - 20) / unscaledViewport.width;

        // Render all pages
        await this.renderPdfPages(pagesContainer);

        // Update zoom display
        this.updatePdfZoomDisplay();

        // Mark as rendered
        this.pdfRendered = true;

        logInfo("PDF comparison rendering complete", { totalPages });
      } catch (error) {
        logError("Failed to render PDF:", error);
        pdfContainer.innerHTML = `
          <div class="ai-pdf-error" role="alert">
            <p>Failed to load PDF: ${this.escapeHtml(error.message)}</p>
          </div>
        `;
      }
    }

    /**
     * Render all PDF pages at current scale
     * @param {HTMLElement} container - Container for pages
     * @returns {Promise<void>}
     */
    async renderPdfPages(container) {
      if (!this.pdfDocument || !container) return;

      const totalPages = this.pdfDocument.numPages;
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Clear existing pages
      container.innerHTML = "";

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({
          scale: this.currentPdfScale * devicePixelRatio,
        });

        // Create page wrapper with img role for accessibility
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "ai-pdf-page";
        pageWrapper.setAttribute("data-page", pageNum);
        pageWrapper.setAttribute("role", "img");
        pageWrapper.setAttribute(
          "aria-label",
          `PDF page ${pageNum} of ${totalPages}`,
        );

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        // Render page to canvas
        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        logDebug(`Rendered PDF page ${pageNum}/${totalPages}`);
      }
    }

    /**
     * Handle PDF zoom
     * @param {string} direction - 'in', 'out', or 'fit'
     */
    async handlePdfZoom(direction) {
      if (!this.pdfDocument) return;

      const scrollContainer = document.getElementById(
        "ai-pdf-scroll-container",
      );
      const pagesContainer = document.getElementById("ai-pdf-pages-container");
      if (!scrollContainer || !pagesContainer) return;

      // Store scroll position ratio
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight || 1;
      const scrollRatio = scrollTop / scrollHeight;

      // Calculate new scale
      const zoomStep = 0.25;
      const minScale = 0.25;
      const maxScale = 3;

      switch (direction) {
        case "in":
          this.currentPdfScale = Math.min(
            maxScale,
            this.currentPdfScale + zoomStep,
          );
          break;
        case "out":
          this.currentPdfScale = Math.max(
            minScale,
            this.currentPdfScale - zoomStep,
          );
          break;
        case "fit":
          const containerWidth = scrollContainer.clientWidth || 280;
          const firstPage = await this.pdfDocument.getPage(1);
          const unscaledViewport = firstPage.getViewport({ scale: 1 });
          this.currentPdfScale = (containerWidth - 20) / unscaledViewport.width;
          break;
      }

      // Re-render pages
      await this.renderPdfPages(pagesContainer);

      // Update zoom display
      this.updatePdfZoomDisplay();

      // Restore scroll position
      scrollContainer.scrollTop = scrollRatio * scrollContainer.scrollHeight;

      logDebug("PDF zoom updated", { direction, scale: this.currentPdfScale });
    }

    /**
     * Navigate to a specific PDF page
     * @param {number|string} pageNum - Page number to navigate to
     */
    goToPdfPage(pageNum) {
      const page = parseInt(pageNum, 10);
      if (!this.pdfDocument || isNaN(page)) return;

      const totalPages = this.pdfDocument.numPages;
      const validPage = Math.max(1, Math.min(page, totalPages));

      // Update input value
      const pageInput = document.getElementById("ai-pdf-page-input");
      if (pageInput) {
        pageInput.value = validPage;
      }

      // Scroll to page
      const scrollContainer = document.getElementById(
        "ai-pdf-scroll-container",
      );
      const pageElement = scrollContainer?.querySelector(
        `[data-page="${validPage}"]`,
      );

      if (pageElement && scrollContainer) {
        pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      logDebug("PDF navigated to page", { page: validPage });
    }

    /**
     * Update the PDF zoom level display
     */
    updatePdfZoomDisplay() {
      const zoomLevelEl = document.getElementById("ai-pdf-zoom-level");
      if (zoomLevelEl) {
        zoomLevelEl.textContent = `${Math.round(this.currentPdfScale * 100)}%`;
      }
    }

    /**
     * Ensure PDF.js library is loaded from CDN
     * @returns {Promise<void>}
     * @private
     */
    async ensurePDFJSLoaded() {
      // Check if already loaded
      if (window.pdfjsLib) {
        logDebug("PDF.js already available");
        return;
      }

      logInfo("Loading PDF.js library from CDN");

      // PDF.js CDN URLs (same version as used elsewhere in project)
      const PDFJS_VERSION = "3.11.174";
      const LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
      const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

      // Load the main library
      await this.loadScript(LIB_URL);

      // Verify it loaded
      if (!window.pdfjsLib) {
        throw new Error("PDF.js library not available after script load");
      }

      // Configure worker
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

      logInfo("PDF.js loaded successfully", { version: PDFJS_VERSION });
    }

    /**
     * Load a script from URL
     * @param {string} url - Script URL
     * @returns {Promise<void>}
     * @private
     */
    loadScript(url) {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) {
          logDebug("Script already loaded:", url);
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = url;
        script.async = true;

        const timeout = setTimeout(() => {
          reject(new Error(`Script load timeout: ${url}`));
        }, 15000);

        script.onload = () => {
          clearTimeout(timeout);
          logDebug("Script loaded:", url);
          resolve();
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`Failed to load script: ${url}`));
        };

        document.head.appendChild(script);
      });
    }

    /**
     * Show error state in modal
     *
     * @param {string} message - Error message
     */
    showError(message) {
      // Phase 7.3J: Stop elapsed timer before showing error
      this.stopElapsedTimer();

      logError("Showing error:", message);
      this.lastError = message;

      if (!this.currentModal) {
        // Modal not open, use notification
        if (window.notifyError) {
          window.notifyError(`Enhancement failed: ${message}`);
        }
        return;
      }

      const content = `
      <div class="ai-error-display" data-state="error">
        <div class="error-icon" aria-hidden="true">⚠</div>
        <h3>Enhancement Failed</h3>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;

      this.currentModal.setContent(content);
      this.updateFooterButtons("error");

      // Announce error to screen reader users
      if (window.notifyError) {
        window.notifyError(
          `Enhancement failed: ${message}. You can try again or close the dialog.`,
        );
      }

      logDebug("Modal updated to error state");
    }

    // ==========================================================================
    // APPLY / CANCEL
    // ==========================================================================

    /**
     * Apply enhanced content to the appropriate target via data provider.
     * Phase 8A: Delegates write-back to the active provider so both
     * resume mode and upload mode work without conditional logic here.
     */
    async applyEnhancement() {
      logInfo("Applying enhancement...");

      if (!this.enhancedMMD) {
        logWarn("No enhanced content to apply");
        return;
      }

      const provider = this.ensureDataProvider();
      if (!provider) {
        logError("No data provider available for apply");
        if (window.notifyError) {
          window.notifyError("Cannot apply changes: no data provider");
        }
        return;
      }

      try {
        // Build AI enhancement metadata for session tracking
        // Enables: AI sparkle icon in session loader, special ZIP filename
        const aiMetadata = {
          appliedAt: Date.now(),
          model: this.selectedModel || "unknown",
          linesAdded: this.diffStats?.addedLines || 0,
          linesRemoved: this.diffStats?.removedLines || 0,
          linesChanged: this.diffStats?.changedLines || 0,
          totalLines: this.diffStats?.totalLines || 0,
          cost: this.stats?.actualCost || 0,
          uncertaintyAnnotations: this.uncertaintyMetadata || [],
        };

        // Delegate write-back to provider
        await provider.applyEnhancedMMD(this.enhancedMMD, aiMetadata);

        // Close modal
        this.closeModal();

        // Notify success — message varies by provider mode
        if (window.notifySuccess) {
          const message =
            provider.mode === "resume"
              ? "AI enhancement applied! Use Ctrl+Z to undo."
              : "AI enhancement applied! Use the toggle to compare versions.";
          window.notifySuccess(message);
        }

        logInfo(
          "Enhancement applied successfully via " + provider.mode + " provider",
        );
      } catch (error) {
        logError("Failed to apply enhancement:", error);
        if (window.notifyError) {
          window.notifyError("Failed to apply changes: " + error.message);
        }
      }
    }

    /**
     * Cancel ongoing enhancement or close modal
     */
    cancelEnhancement() {
      logInfo("Cancelling enhancement...");

      // Phase 7.3J: Stop elapsed timer immediately
      this.stopElapsedTimer();

      // Abort any in-progress request
      if (this.abortController) {
        this.abortController.abort();
      }

      // Cancel embed request if active
      if (this.embed && this.embed.cancelRequest) {
        this.embed.cancelRequest();
      }

      // Reset state
      this.isProcessing = false;
      this.updateButtonState();

      // Close modal
      this.closeModal();
    }

    /**
     * Close the current modal
     */
    closeModal() {
      if (this.currentModal) {
        this.currentModal.close();
        this.currentModal = null;
      }
    }

    // ==========================================================================
    // DOCUMENT ANALYSIS TAB (Phase 7.5F)
    // ==========================================================================

    /**
     * Populate the Document Analysis tab in resume mode (Phase 7.5F)
     *
     * Uses cached analysis from the last enhancement run if available,
     * otherwise runs fresh analysis on current MMD content and lines data.
     * Renders results into the pre-built HTML containers in tools.html.
     */
    populateDocumentAnalysisTab() {
      logInfo("Populating Document Analysis tab");

      const placeholder = document.getElementById(
        "resume-analysis-placeholder",
      );
      const structuralSection = document.getElementById(
        "resume-analysis-structural",
      );
      const semanticSection = document.getElementById(
        "resume-analysis-semantic",
      );
      const combinedSection = document.getElementById(
        "resume-analysis-combined",
      );

      if (!structuralSection || !semanticSection || !combinedSection) {
        logWarn("Document Analysis tab elements not found");
        return;
      }

      // Get or run structural analysis
      let structuralDisplay = null;
      try {
        const analyser = window.getMathPixMMDAnalyser?.();
        if (analyser) {
          const analysis =
            this.lastStructuralAnalysis ||
            analyser.analyse(this.getCurrentMMD());
          if (!this.lastStructuralAnalysis && analysis) {
            this.lastStructuralAnalysis = analysis;
          }
          structuralDisplay = analyser.formatForDisplay(analysis);
        }
      } catch (err) {
        logWarn("Structural analysis failed:", err.message);
      }

      // Get or run semantic analysis
      let semanticDisplay = null;
      try {
        const mapper = window.getMathPixSemanticMapper?.();
        if (mapper) {
          const linesData = this.getLinesData();
          const analysis =
            this.lastSemanticAnalysis || mapper.analyse(linesData);
          if (!this.lastSemanticAnalysis && analysis) {
            this.lastSemanticAnalysis = analysis;
          }
          semanticDisplay = mapper.formatForDisplay(analysis);
        }
      } catch (err) {
        logWarn("Semantic analysis failed:", err.message);
      }

      // Hide placeholder if we have any data
      const hasStructural = structuralDisplay?.summary?.totalLines > 0;
      const hasSemantic = semanticDisplay?.summary?.totalPages > 0;

      if (placeholder) {
        placeholder.hidden = hasStructural || hasSemantic;
      }

      // Populate structural section
      if (hasStructural) {
        structuralSection.hidden = false;
        const dl = document.getElementById("resume-analysis-structural-data");
        if (dl) {
          dl.innerHTML = this.buildStructuralDL(structuralDisplay.summary);
        }
      }

      // Populate semantic section
      if (hasSemantic) {
        semanticSection.hidden = false;
        const dl = document.getElementById("resume-analysis-semantic-data");
        if (dl) {
          dl.innerHTML = this.buildSemanticDL(semanticDisplay.summary);
        }
      }

      // Populate combined statistics
      if (hasStructural || hasSemantic) {
        combinedSection.hidden = false;
        const dl = document.getElementById("resume-analysis-combined-data");
        if (dl) {
          dl.innerHTML = this.buildCombinedDL(
            structuralDisplay,
            semanticDisplay,
          );
        }
      }

      // Populate SVG icons in the newly rendered content
      if (window.IconLibrary?.populateIcons) {
        window.IconLibrary.populateIcons();
      }
    }

    /**
     * Build definition list HTML for structural analysis data
     * @param {Object} summary - From analyser.formatForDisplay().summary
     * @returns {string} HTML for <dl> contents
     * @private
     */
    buildStructuralDL(summary) {
      const items = [];

      items.push(this.dlItem("Total lines", summary.totalLines));
      items.push(this.dlItem("Blank lines", summary.blankLines));

      if (summary.environments?.total > 0) {
        const envDetail = Object.entries(summary.environments.types || {})
          .map(([type, count]) => `${type} (${count})`)
          .join(", ");
        items.push(
          this.dlItem(
            "LaTeX environments",
            `${summary.environments.total}: ${envDetail}`,
          ),
        );
      } else {
        items.push(this.dlItem("LaTeX environments", "0"));
      }

      if (summary.headings?.total > 0) {
        const hdDetail = Object.entries(summary.headings.types || {})
          .map(([type, count]) => `${type} (${count})`)
          .join(", ");
        items.push(
          this.dlItem("Headings", `${summary.headings.total}: ${hdDetail}`),
        );
      } else {
        items.push(this.dlItem("Headings", "0"));
      }

      items.push(this.dlItem("Display math blocks", summary.displayMath || 0));
      items.push(
        this.dlItem("Inline math expressions", summary.inlineMath || 0),
      );

      const imgTotal = summary.images?.total || 0;
      if (imgTotal > 0) {
        items.push(
          this.dlItem(
            "Images",
            `${imgTotal} (${summary.images.withAlt} with alt text, ${summary.images.withoutAlt} without)`,
          ),
        );
      } else {
        items.push(this.dlItem("Images", "0"));
      }

      const latexTbl = summary.tables?.latex || 0;
      const mdTbl = summary.tables?.markdown || 0;
      if (latexTbl + mdTbl > 0) {
        items.push(
          this.dlItem(
            "Tables",
            `${latexTbl + mdTbl} (${latexTbl} LaTeX, ${mdTbl} markdown)`,
          ),
        );
      } else {
        items.push(this.dlItem("Tables", "0"));
      }

      if (summary.notationVariants > 0) {
        items.push(this.dlItem("Notation variants", summary.notationVariants));
      }
      if (summary.greekVariants > 0) {
        items.push(this.dlItem("Greek letter variants", summary.greekVariants));
      }
      if (summary.chemistry > 0) {
        items.push(this.dlItem("Chemistry constructs", summary.chemistry));
      }

      return items.join("");
    }

    /**
     * Build definition list HTML for semantic analysis data
     * @param {Object} summary - From mapper.formatForDisplay().summary
     * @returns {string} HTML for <dl> contents
     * @private
     */
    buildSemanticDL(summary) {
      const items = [];

      items.push(this.dlItem("Pages analysed", summary.totalPages));
      items.push(this.dlItem("Total OCR lines", summary.totalLines));

      const writingParts = [];
      if (summary.handwrittenPages > 0)
        writingParts.push(`${summary.handwrittenPages} handwritten`);
      if (summary.printedPages > 0)
        writingParts.push(`${summary.printedPages} printed`);
      if (summary.mixedPages > 0)
        writingParts.push(`${summary.mixedPages} mixed`);
      if (writingParts.length > 0) {
        items.push(this.dlItem("Page types", writingParts.join(", ")));
      }

      if (
        summary.meanConfidence !== null &&
        summary.meanConfidence !== undefined
      ) {
        const pct = (summary.meanConfidence * 100).toFixed(1);
        items.push(this.dlItem("Mean OCR confidence", `${pct}%`));
      }

      if (summary.lowConfidenceRegions > 0) {
        items.push(
          this.dlItem("Low-confidence regions", summary.lowConfidenceRegions),
        );
      }

      if (summary.diagramCount > 0) {
        items.push(this.dlItem("Diagrams detected", summary.diagramCount));
      }

      if (summary.tableCount > 0) {
        items.push(this.dlItem("Tables detected (OCR)", summary.tableCount));
      }

      return items.join("");
    }

    /**
     * Build definition list HTML for combined statistics
     * @param {Object|null} structuralDisplay - From analyser.formatForDisplay()
     * @param {Object|null} semanticDisplay - From mapper.formatForDisplay()
     * @returns {string} HTML for <dl> contents
     * @private
     */
    buildCombinedDL(structuralDisplay, semanticDisplay) {
      const items = [];

      // Count total features detected
      let featureCount = 0;
      const sSummary = structuralDisplay?.summary;
      const mSummary = semanticDisplay?.summary;

      if (sSummary) {
        featureCount += sSummary.environments?.total || 0;
        featureCount += sSummary.headings?.total || 0;
        featureCount += sSummary.images?.total || 0;
        featureCount += sSummary.displayMath || 0;
        featureCount += sSummary.inlineMath || 0;
        featureCount +=
          (sSummary.tables?.latex || 0) + (sSummary.tables?.markdown || 0);
        featureCount += sSummary.notationVariants || 0;
        featureCount += sSummary.chemistry || 0;
      }
      items.push(this.dlItem("Total structural features", featureCount));

      if (mSummary) {
        const semanticFeatures =
          (mSummary.lowConfidenceRegions || 0) +
          (mSummary.diagramCount || 0) +
          (mSummary.tableCount || 0);
        items.push(this.dlItem("Semantic features", semanticFeatures));
      }

      // Estimate token overhead
      let tokenOverhead = 0;
      try {
        const analyser = window.getMathPixMMDAnalyser?.();
        if (analyser && this.lastStructuralAnalysis) {
          const text =
            analyser.formatForPrompt(this.lastStructuralAnalysis) || "";
          tokenOverhead += Math.ceil(
            text.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
          );
        }
        const mapper = window.getMathPixSemanticMapper?.();
        if (mapper && this.lastSemanticAnalysis) {
          const text = mapper.formatForPrompt(this.lastSemanticAnalysis) || "";
          tokenOverhead += Math.ceil(
            text.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
          );
        }
      } catch (err) {
        logWarn("Token overhead calculation failed:", err.message);
      }
      items.push(
        this.dlItem(
          "Estimated prompt token overhead",
          `~${tokenOverhead} tokens`,
        ),
      );

      return items.join("");
    }

    /**
     * Build a single definition list item
     * @param {string} term - The <dt> text
     * @param {string|number} definition - The <dd> text
     * @returns {string} HTML for one <div class="stat-item"><dt>...<dd>...</div>
     * @private
     */
    dlItem(term, definition) {
      return `<div class="stat-item"><dt>${this.escapeHtml(String(term))}</dt><dd>${this.escapeHtml(String(definition))}</dd></div>`;
    }

    // ==========================================================================
    // UTILITIES
    // ==========================================================================

    /**
     * Escape HTML for safe display
     *
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Cleanup after enhancement (success or failure)
     */
    cleanup() {
      logDebug("Cleaning up...");

      // Phase 7.3K: Remove scroll sync listeners
      this.teardownScrollSync();

      // Phase 7.3J: Safety net — ensure elapsed timer is cleared
      this.stopElapsedTimer();

      // Clear embed instance
      if (this.embed) {
        if (this.embed.currentFile) {
          this.embed.currentFile = null;
          this.embed.currentFileBase64 = null;
          this.embed.currentFileAnalysis = null;
        }
        this.embed = null;
      }

      // Clear abort controller
      this.abortController = null;
    }

    /**
     * Load system prompt (for testing)
     *
     * @returns {Promise<string>} System prompt
     */
    async loadSystemPrompt() {
      if (!this.prompts) {
        await this.loadPromptConfig();
      }
      return this.buildSystemPrompt();
    }
  }

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  let enhancerInstance = null;

  /**
   * Get or create singleton instance of MathPixAIEnhancer
   *
   * @returns {MathPixAIEnhancer} Singleton instance
   */
  function getMathPixAIEnhancer() {
    if (!enhancerInstance) {
      logDebug("Creating new MathPixAIEnhancer singleton instance");
      enhancerInstance = new MathPixAIEnhancer();

      // Initialise asynchronously
      enhancerInstance.init().catch((error) => {
        logError("Failed to initialise AI Enhancer:", error);
      });
    }
    return enhancerInstance;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixAIEnhancer = MathPixAIEnhancer;
  window.getMathPixAIEnhancer = getMathPixAIEnhancer;

  // Global action functions for onclick handlers
  window.openAIEnhancementModal = () => {
    // Clear any stale upload provider so resume mode auto-detects correctly
    if (enhancerInstance?.dataProvider?.mode === "upload") {
      enhancerInstance.setDataProvider(null);
    }
    enhancerInstance?.openModal();
  };
  window.startAIEnhancement = () => enhancerInstance?.startEnhancement();
  window.cancelAIEnhancement = () => enhancerInstance?.cancelEnhancement();
  window.applyAIEnhancement = () => enhancerInstance?.applyEnhancement();
  window.toggleAIColumn = (columnId) =>
    enhancerInstance?.toggleColumn(columnId);

  // Phase 8A: Data provider management
  window.setAIDataProvider = (provider) =>
    enhancerInstance?.setDataProvider(provider);
  window.getAIDataProvider = () => enhancerInstance?.dataProvider || null;

  /**
   * Phase 8 (Conv AD): Open AI Enhancement modal from upload mode.
   *
   * Creates an upload data provider from the current controller state,
   * sets it on the enhancer, and opens the modal.
   *
   * Called by onclick on the #upload-ai-enhance-btn button.
   */
  window.openUploadAIEnhancementModal = async function () {
    logInfo("Opening AI Enhancement modal from upload mode");

    const controller = window.getMathPixController?.();
    if (!controller) {
      logError("Cannot open upload AI modal: MathPix controller not available");
      if (window.notifyError) {
        window.notifyError(
          "MathPix controller not available. Please try again.",
        );
      }
      return;
    }

    // Ensure enhancer singleton exists and is initialised
    const enhancer = getMathPixAIEnhancer();
    if (!enhancer) {
      logError("Cannot open upload AI modal: AI Enhancer not available");
      if (window.notifyError) {
        window.notifyError(
          "AI Enhancer failed to initialise. Please try again.",
        );
      }
      return;
    }

    // Await initialisation to ensure models are loaded
    try {
      await enhancer.init();
    } catch (initError) {
      logWarn("Enhancer init warning (may already be initialised):", initError);
    }

    // Create upload provider and set it
    try {
      const provider = window.createUploadDataProvider(controller);
      if (!provider || !window.isValidDataProvider(provider)) {
        logError("Failed to create valid upload data provider");
        if (window.notifyError) {
          window.notifyError("Failed to create data provider for upload mode.");
        }
        return;
      }

      enhancer.setDataProvider(provider);
      logInfo("Upload data provider set, opening modal");

      // Open the modal
      enhancer.openModal();
    } catch (error) {
      logError("Error opening upload AI Enhancement modal:", error);
      if (window.notifyError) {
        window.notifyError(`Failed to open AI Enhancement: ${error.message}`);
      }
    }
  };

  /**
   * Phase 8A: Integration test — verifies the enhancer delegates to the
   * data provider correctly in resume mode.
   *
   * Usage: window.testAIDataProviderIntegration()
   */
  window.testAIDataProviderIntegration = function () {
    const results = { passed: 0, failed: 0, errors: [] };

    function assert(condition, label) {
      if (condition) {
        results.passed++;
        console.log(`  \u2713 ${label}`);
      } else {
        results.failed++;
        results.errors.push(label);
        console.error(`  \u2717 ${label}`);
      }
    }

    console.log("=== AI DATA PROVIDER INTEGRATION TESTS ===\n");

    const e = enhancerInstance || getMathPixAIEnhancer();
    if (!e) {
      console.error("AI Enhancer not available. Switch to MathPix mode first.");
      return results;
    }

    // -----------------------------------------------------------------
    // 1. Provider infrastructure on enhancer
    // -----------------------------------------------------------------
    console.log("--- 1. Provider Infrastructure ---");

    assert("dataProvider" in e, "1.1 enhancer has dataProvider property");
    assert(
      typeof e.setDataProvider === "function",
      "1.2 enhancer has setDataProvider method",
    );
    assert(
      typeof e.ensureDataProvider === "function",
      "1.3 enhancer has ensureDataProvider method",
    );

    // -----------------------------------------------------------------
    // 2. Data method delegation
    // -----------------------------------------------------------------
    console.log("\n--- 2. Data Method Delegation ---");

    // Create a mock provider
    const mockProvider = {
      mode: "test",
      getMMDContent: () => "mock MMD from test provider",
      getSourcePDF: () => new Blob(["test"], { type: "application/pdf" }),
      getSourceFilename: () => "mock-test.pdf",
      getLinesData: () => ({ testPages: true }),
      getPageRangeContext: () => "mock page range context",
      isAvailable: () => true,
      applyEnhancedMMD: async () => {},
    };

    // Save current state
    const savedProvider = e.dataProvider;
    const savedRestorer = e.sessionRestorer;

    // Set mock provider
    e.setDataProvider(mockProvider);
    assert(
      e.dataProvider === mockProvider,
      "2.1 setDataProvider stores the provider",
    );
    assert(e.dataProvider.mode === "test", "2.2 Provider mode is 'test'");

    // Test delegation
    assert(
      e.getCurrentMMD() === "mock MMD from test provider",
      "2.3 getCurrentMMD delegates to provider",
    );
    assert(
      e.getSourcePDF() instanceof Blob,
      "2.4 getSourcePDF delegates to provider",
    );
    assert(
      e.getSourceFilename() === "mock-test.pdf",
      "2.5 getSourceFilename delegates to provider",
    );
    assert(
      e.getLinesData()?.testPages === true,
      "2.6 getLinesData delegates to provider",
    );
    assert(
      e.getPageRangeContext() === "mock page range context",
      "2.7 getPageRangeContext delegates to provider",
    );
    assert(
      e.isEnhancementAvailable() === true,
      "2.8 isEnhancementAvailable delegates to provider",
    );

    // -----------------------------------------------------------------
    // 3. Invalid provider rejection
    // -----------------------------------------------------------------
    console.log("\n--- 3. Invalid Provider Rejection ---");

    e.setDataProvider(mockProvider); // Reset to valid
    e.setDataProvider({ mode: "bad" }); // Invalid — should be rejected
    assert(
      e.dataProvider === mockProvider,
      "3.1 Invalid provider is rejected, previous provider retained",
    );

    // -----------------------------------------------------------------
    // 4. Provider clearing
    // -----------------------------------------------------------------
    console.log("\n--- 4. Provider Clearing ---");

    e.setDataProvider(null);
    assert(
      e.dataProvider === null,
      "4.1 setDataProvider(null) clears the provider",
    );

    // -----------------------------------------------------------------
    // 5. Auto-detect resume provider
    // -----------------------------------------------------------------
    console.log("\n--- 5. Auto-detect Resume Provider ---");

    e.dataProvider = null;
    e.sessionRestorer = null;

    // If getMathPixSessionRestorer is available, auto-detect should work
    const restorerAvailable =
      typeof window.getMathPixSessionRestorer === "function";
    const autoProvider = e.ensureDataProvider();

    if (restorerAvailable && autoProvider) {
      assert(
        autoProvider.mode === "resume",
        "5.1 Auto-detected provider is resume mode",
      );
      assert(
        e.dataProvider === autoProvider,
        "5.2 Auto-detected provider is cached on instance",
      );
    } else {
      console.log(
        "  \u2014 Skipping auto-detect tests (session restorer not available)",
      );
    }

    // -----------------------------------------------------------------
    // 6. Global access
    // -----------------------------------------------------------------
    console.log("\n--- 6. Global Access ---");

    e.setDataProvider(mockProvider);
    assert(
      typeof window.setAIDataProvider === "function",
      "6.1 window.setAIDataProvider exists",
    );
    assert(
      typeof window.getAIDataProvider === "function",
      "6.2 window.getAIDataProvider exists",
    );
    assert(
      window.getAIDataProvider() === mockProvider,
      "6.3 window.getAIDataProvider returns active provider",
    );

    // Restore original state
    e.dataProvider = savedProvider;
    e.sessionRestorer = savedRestorer;

    // -----------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------
    console.log(
      `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`,
    );
    if (results.errors.length > 0) {
      console.log("Failures:", results.errors);
    }
    return results;
  };

  // Diff toggle function (Phase 7.2E)
  window.toggleAIDiff = () => enhancerInstance?.toggleDiff();
  // Phase 7.5G: Prompt preview refresh and copy
  window.refreshPromptPreview = () => enhancerInstance?.populatePromptPreview();
  window.copyPromptPreview = () => enhancerInstance?.copyPromptToClipboard();
  // Scroll sync toggle function (Phase 7.3K)
  window.toggleAISync = () => enhancerInstance?.toggleScrollSync();

  // Phase 7.4: Model, advanced model, and engine change handlers
  window.handleAIModelChange = (modelId) =>
    enhancerInstance?.handleModelChange(modelId);
  window.handleAIAdvancedModelChange = (modelId) =>
    enhancerInstance?.handleAdvancedModelChange(modelId);
  window.handleAIEngineChange = (engine) =>
    enhancerInstance?.handleEngineChange(engine);
  window.handleAIReasoningChange = (enabled) =>
    enhancerInstance?.handleReasoningChange(enabled);
  window.handleAIMultiPassChange = (enabled) =>
    enhancerInstance?.handleMultiPassChange(enabled);

  // PDF control functions
  window.aiPdfZoom = (direction) => enhancerInstance?.handlePdfZoom(direction);
  window.aiPdfGoToPage = (page) => enhancerInstance?.goToPdfPage(page);

  // Preview skip link handler
  window.aiPreviewSkip = (event) => {
    event.preventDefault();
    const target = document.getElementById("ai-preview-skip-target");
    if (target) {
      target.focus();
    }
  };

  /**
   * Set scroll sync mode programmatically (Phase 7.3L)
   * @param {'mmd'|'all'} mode - 'mmd' for Original+Enhanced only, 'all' to include Preview
   */
  window.setAISyncMode = (mode) => {
    if (mode !== "mmd" && mode !== "all") {
      console.error("Invalid mode. Use 'mmd' or 'all'.");
      return;
    }
    const e = enhancerInstance;
    if (!e) {
      console.error("AI Enhancer not initialised");
      return;
    }
    e.scrollSyncMode = mode;
    // Re-attach listeners with new column set if sync is active
    if (e.syncScrollEnabled) {
      e.setupScrollSync();
    }
    e.saveColumnPreferences();
    console.log(`Scroll sync mode set to '${mode}'`);
  };

  // Diagnostic function for debugging freezes and large PDF issues
  window.diagnoseAIEnhancer = () => {
    const e = enhancerInstance;
    if (!e) {
      console.log("AI Enhancer not initialised yet");
      return;
    }

    const pdfBlob = e.getSourcePDF();
    const maxSize = AI_ENHANCER_CONFIG.MAX_PDF_SIZE_FOR_ENHANCEMENT;

    console.log("=== AI ENHANCER DIAGNOSIS ===");
    // Phase 7.4.1: Calculate what dynamic max_tokens would be for current MMD
    const currentMMD = e.getCurrentMMD();
    const currentMmdTokens = Math.ceil(
      (currentMMD?.length || 0) / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
    );
    const currentModelCap = e.getModelMaxOutput(e.selectedModel);
    const currentScaled = Math.ceil(currentMmdTokens * 1.3);
    const currentDynamic = Math.min(
      Math.max(currentScaled, AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS),
      currentModelCap,
    );

    console.log("Config:", {
      MAX_OUTPUT_TOKENS_DEFAULT: AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS,
      dynamicMaxTokens: currentDynamic,
      dynamicReason:
        currentScaled > AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS
          ? `Scaled (${currentMmdTokens} × 1.3 = ${currentScaled})`
          : `Floor applied (${currentScaled} < ${AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS})`,
      modelOutputCap: currentModelCap,
      MAX_PDF_SIZE_MB: (maxSize / (1024 * 1024)).toFixed(0),
      API_TIMEOUT_MS: AI_ENHANCER_CONFIG.API_TIMEOUT_MS,
      API_TIMEOUT_MINUTES: (AI_ENHANCER_CONFIG.API_TIMEOUT_MS / 60000).toFixed(
        1,
      ),
      PDF_ENGINE: AI_ENHANCER_CONFIG.PDF_ENGINE,
    });
    console.log("State:", {
      isInitialised: e.isInitialised,
      isProcessing: e.isProcessing,
      currentStage: e.currentStage,
      selectedModel: e.selectedModel,
      selectedEngine: e.selectedEngine,
      lastError: e.lastError,
    });
    console.log("PDF Source:", {
      available: !!pdfBlob,
      sizeBytes: pdfBlob?.size || 0,
      sizeMB: pdfBlob ? (pdfBlob.size / (1024 * 1024)).toFixed(2) : "N/A",
      withinLimit: pdfBlob ? pdfBlob.size <= maxSize : "N/A",
      estimatedBase64MB: pdfBlob
        ? ((pdfBlob.size * 1.37) / (1024 * 1024)).toFixed(2)
        : "N/A",
    });
    console.log("MMD Content:", {
      available: !!e.getCurrentMMD(),
      lines: e.getCurrentMMD()?.split("\n").length || 0,
      chars: e.getCurrentMMD()?.length || 0,
      estimatedTokens: Math.ceil(
        (e.getCurrentMMD()?.length || 0) / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      ),
    });
    console.log("Embed:", {
      exists: !!e.embed,
      processing: e.embed?.processing,
      isStreaming: e.embed?.isStreaming,
      hasFile: !!e.embed?.currentFile,
      base64Length: e.embed?.currentFileBase64?.length || 0,
      base64MB: e.embed?.currentFileBase64
        ? (e.embed.currentFileBase64.length / (1024 * 1024)).toFixed(2)
        : "N/A",
      lastError: e.embed?.lastError?.message || null,
    });
    console.log("Abort Controller:", {
      active: !!e.abortController,
      aborted: e.abortController?.signal?.aborted || false,
    });
    console.log("Timing Log:", JSON.stringify(e.timingLog, null, 2));
    console.log("Stats:", JSON.stringify(e.stats, null, 2));
    console.log("=== END DIAGNOSIS ===");
  };

  // ==========================================================================
  // REASONING TESTS
  // ==========================================================================

  /**
   * Test AI Enhancer reasoning configuration
   * Part 1: Synthetic tests (no API call, instant)
   * Part 2: E2E test (sends a real lightweight request)
   *
   * Usage: await window.testAIEnhancerReasoning()
   */
  window.testAIEnhancerReasoning = async function () {
    const results = { passed: 0, failed: 0, errors: [] };

    function assert(condition, label) {
      if (condition) {
        results.passed++;
        console.log(`  ✓ ${label}`);
      } else {
        results.failed++;
        results.errors.push(label);
        console.error(`  ✗ ${label}`);
      }
    }

    // Ensure enhancer is available
    const e = enhancerInstance || getMathPixAIEnhancer();
    if (!e) {
      console.error("AI Enhancer not available. Switch to MathPix mode first.");
      return;
    }

    // Wait for init if needed
    if (!e.isInitialised) {
      console.log("Waiting for AI Enhancer to initialise...");
      await e.init().catch(() => {});
    }

    console.log("=== AI ENHANCER REASONING TESTS ===\n");

    // ------------------------------------------------------------------
    // PART 1: Synthetic tests (no API call)
    // ------------------------------------------------------------------
    console.log("--- Part 1: Configuration Tests ---");

    // 1.1 Constructor default
    assert(
      e.reasoningEnabled === false || e.reasoningEnabled === true,
      "1.1 reasoningEnabled property exists on instance",
    );

    // 1.2 buildReasoningConfig — disabled
    const savedState = e.reasoningEnabled;
    const savedModel = e.selectedModel;

    e.reasoningEnabled = false;
    const disabledConfig = e.buildReasoningConfig();
    assert(
      disabledConfig.enabled === false,
      "1.2 buildReasoningConfig returns { enabled: false } when reasoning off",
    );

    // 1.3 buildReasoningConfig — Opus 4.6 (adaptive)
    e.reasoningEnabled = true;
    e.selectedModel = "anthropic/claude-opus-4.6";
    const opusConfig = e.buildReasoningConfig();
    assert(opusConfig.enabled === true, "1.3a Opus 4.6: reasoning enabled");
    assert(
      opusConfig.effort === undefined || opusConfig.effort === null,
      "1.3b Opus 4.6: no effort (adaptive mode)",
    );
    assert(
      opusConfig.max_tokens === undefined || opusConfig.max_tokens === null,
      "1.3c Opus 4.6: no max_tokens (adaptive mode)",
    );

    // 1.4 buildReasoningConfig — Sonnet 4.5 (effort-based)
    e.selectedModel = "anthropic/claude-sonnet-4.5";
    const sonnetConfig = e.buildReasoningConfig();
    assert(sonnetConfig.enabled === true, "1.4a Sonnet 4.5: reasoning enabled");
    assert(sonnetConfig.effort === "high", "1.4b Sonnet 4.5: effort is 'high'");

    // 1.5 buildReasoningConfig — Haiku (effort-based)
    e.selectedModel = "anthropic/claude-haiku-4.5";
    const haikuConfig = e.buildReasoningConfig();
    assert(
      haikuConfig.enabled === true && haikuConfig.effort === "high",
      "1.5 Haiku: reasoning enabled with effort 'high'",
    );

    // 1.6 getReasoningHelpText — model-aware
    const opusHelp = e.getReasoningHelpText("anthropic/claude-opus-4.6");
    assert(
      opusHelp.toLowerCase().includes("adaptive"),
      "1.6a Help text for Opus mentions 'adaptive'",
    );

    const sonnetHelp = e.getReasoningHelpText("anthropic/claude-sonnet-4.5");
    assert(
      sonnetHelp.toLowerCase().includes("effort"),
      "1.6b Help text for Sonnet mentions 'effort'",
    );

    const haikuHelp = e.getReasoningHelpText("anthropic/claude-haiku-4.5");
    assert(
      haikuHelp.toLowerCase().includes("effort"),
      "1.6c Help text for Haiku mentions 'effort'",
    );

    // 1.7 getModelKeyById helper
    assert(
      e.getModelKeyById("anthropic/claude-opus-4.6") === "opus",
      "1.7a getModelKeyById finds 'opus'",
    );
    assert(
      e.getModelKeyById("anthropic/claude-haiku-4.5") === "haiku",
      "1.7b getModelKeyById finds 'haiku'",
    );
    assert(
      e.getModelKeyById("unknown/model-xyz") === null,
      "1.7c getModelKeyById returns null for unknown model",
    );

    // 1.8 Preferences round-trip
    e.reasoningEnabled = true;
    e.saveEnhancerPreferences();
    const savedPrefs = JSON.parse(
      localStorage.getItem(e.enhancerPrefsKey) || "{}",
    );
    assert(
      savedPrefs.reasoning === true,
      "1.8a Preferences save includes reasoning: true",
    );

    e.reasoningEnabled = false;
    e.loadEnhancerPreferences();
    assert(
      e.reasoningEnabled === true,
      "1.8b Preferences load restores reasoning: true",
    );

    // 1.9 JSON model definitions include reasoning fields
    const opusDef = e.models?.opus;
    assert(
      opusDef?.supportsReasoning === true,
      "1.9a opus model definition has supportsReasoning: true",
    );
    assert(
      opusDef?.reasoningMode === "adaptive",
      "1.9b opus model definition has reasoningMode: 'adaptive'",
    );

    const sonnetDef = e.models?.sonnet;
    assert(
      sonnetDef?.supportsReasoning === true,
      "1.9c sonnet model definition has supportsReasoning: true",
    );
    assert(
      sonnetDef?.reasoningMode === "effort",
      "1.9d sonnet model definition has reasoningMode: 'effort'",
    );

    const haikuDef = e.models?.haiku;
    assert(
      haikuDef?.supportsReasoning === true,
      "1.9e haiku model definition has supportsReasoning: true",
    );
    assert(
      haikuDef?.reasoningMode === "effort",
      "1.9f haiku model definition has reasoningMode: 'effort'",
    );

    // Restore original state
    e.reasoningEnabled = savedState;
    e.selectedModel = savedModel;
    e.saveEnhancerPreferences();

    // ------------------------------------------------------------------
    // PART 2: E2E test — real API request with reasoning
    // ------------------------------------------------------------------
    console.log("\n--- Part 2: E2E Reasoning Request ---");
    console.log("Sending a lightweight request to verify reasoning is sent...");

    // Check OpenRouterEmbed is available
    if (typeof OpenRouterEmbed === "undefined") {
      console.warn("⚠ OpenRouterEmbed not loaded — skipping E2E test.");
      console.log(
        `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed (E2E skipped) ===`,
      );
      if (results.errors.length > 0) {
        console.log("Failures:", results.errors);
      }
      return results;
    }

    // Create a temporary container
    const tempContainer = document.createElement("div");
    tempContainer.id = "ai-reasoning-test-" + Date.now();
    tempContainer.style.display = "none";
    tempContainer.setAttribute("aria-hidden", "true");
    document.body.appendChild(tempContainer);

    try {
      // Use Sonnet for the E2E test — it supports effort-based reasoning
      // and is cheaper than Opus
      const testEmbed = new OpenRouterEmbed({
        containerId: tempContainer.id,
        model: "anthropic/claude-sonnet-4.5",
        max_tokens: 100,
        temperature: 0,
        reasoning: { enabled: true, effort: "high" },
        showNotifications: false,
      });

      // 2.1 Verify reasoning was configured on the embed instance
      assert(
        testEmbed.isReasoningEnabled() === true,
        "2.1 Embed instance reports reasoning enabled",
      );

      const embedConfig = testEmbed.getReasoningConfig();
      assert(
        embedConfig.enabled === true && embedConfig.effort === "high",
        "2.2 Embed reasoning config: enabled=true, effort=high",
      );

      // 2.3 Send a minimal request
      console.log(
        "  → Sending request with reasoning: { enabled: true, effort: 'high' }...",
      );
      const response = await testEmbed.sendRequest(
        "What is 2 + 2? Reply with just the number.",
      );

      assert(
        response && response.text,
        "2.3 Response received with text content",
      );
      console.log(
        `  → Response: "${(response.text || "").trim().substring(0, 80)}"`,
      );

      // 2.4 Verify reasoning was still active on embed after request completed
      // (Debug payload doesn't expose the reasoning param directly,
      //  so we verify the embed's own state survived the request lifecycle)
      assert(
        testEmbed.isReasoningEnabled() === true,
        "2.4 Reasoning still enabled on embed after request completed",
      );

      // 2.5 Check token usage (reasoning tokens may appear separately)
      const tokens = response.metadata?.tokens || {};
      console.log("  → Token usage:", tokens);
      const totalTokens = tokens.total_tokens || tokens.total || 0;
      assert(totalTokens > 0, "2.5 Token usage reported (total_tokens > 0)");
    } catch (error) {
      results.failed++;
      results.errors.push("E2E request: " + error.message);
      console.error("  ✗ E2E request failed:", error.message);
    } finally {
      tempContainer.remove();
    }

    // ------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------
    console.log(
      `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`,
    );
    if (results.errors.length > 0) {
      console.log("Failures:", results.errors);
    }
    return results;
  };
})();
