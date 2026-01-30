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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
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
      ATTACHING: { text: "Attaching PDF document...", progress: 25 },
      ANALYSING: { text: "Analysing document...", progress: 40 },
      ENHANCING: { text: "Enhancing MMD content...", progress: 70 },
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

      this.elements.enhanceBtn = document.getElementById(
        "resume-ai-enhance-btn",
      );

      if (!this.elements.enhanceBtn) {
        logWarn("AI Enhance button not found in DOM");
      } else {
        logDebug("AI Enhance button cached");
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
    // BUTTON STATE MANAGEMENT
    // ==========================================================================

    /**
     * Check if AI enhancement is available for current session
     *
     * Requirements:
     * - Session restorer is initialised
     * - Session has PDF source (isPDF === true)
     * - Source file is available
     * - MMD content exists
     *
     * @returns {boolean} True if enhancement can be performed
     */
    isEnhancementAvailable() {
      const restorer = this.getSessionRestorer();

      if (!restorer) {
        logDebug("Enhancement unavailable: No session restorer");
        return false;
      }

      if (!restorer.isInitialised) {
        logDebug("Enhancement unavailable: Session restorer not initialised");
        return false;
      }

      const session = restorer.restoredSession;

      if (!session) {
        logDebug("Enhancement unavailable: No restored session");
        return false;
      }

      if (!session.isPDF) {
        logDebug("Enhancement unavailable: Not a PDF source");
        return false;
      }

      if (!session.source?.blob) {
        logDebug("Enhancement unavailable: No source PDF blob");
        return false;
      }

      const mmdContent = this.getCurrentMMD();
      if (!mmdContent || mmdContent.trim().length === 0) {
        logDebug("Enhancement unavailable: No MMD content");
        return false;
      }

      logDebug("Enhancement available");
      return true;
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
    // SESSION RESTORER ACCESS
    // ==========================================================================

    /**
     * Get reference to session restorer (lazy loaded)
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
     * Get current MMD content from session
     *
     * @returns {string} Current MMD content or empty string
     */
    getCurrentMMD() {
      const restorer = this.getSessionRestorer();

      // Try session restorer's textarea first
      const textarea = restorer?.elements?.mmdEditorTextarea;
      if (textarea?.value) {
        return textarea.value;
      }

      // Fallback to restoredSession
      return restorer?.restoredSession?.currentMMD || "";
    }

    /**
     * Get source PDF file from session
     *
     * @returns {Blob|null} PDF blob or null
     */
    getSourcePDF() {
      const restorer = this.getSessionRestorer();
      return restorer?.restoredSession?.source?.blob || null;
    }

    /**
     * Get source filename from session
     *
     * @returns {string} Filename or 'Unknown'
     */
    getSourceFilename() {
      const restorer = this.getSessionRestorer();
      return restorer?.restoredSession?.source?.filename || "Unknown";
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

        <!-- Model Selection -->
        <fieldset class="ai-model-selection">
          <legend>Select AI Model</legend>
          <div class="model-options" role="radiogroup" aria-label="AI model selection">
            ${this.buildModelOptions()}
          </div>
        </fieldset>

        <!-- Cost Estimate -->
        <div class="ai-cost-estimate" role="region" aria-label="Cost estimate">
          <div class="ai-cost-estimate-label">Estimated cost:</div>
          <div class="ai-cost-estimate-value" id="ai-cost-value">
            ${this.formatCost(this.calculateCost(this.selectedModel, estimatedTokens))}
          </div>
          <div class="ai-cost-estimate-note">
            Actual cost may vary based on response length.
          </div>
        </div>
      </div>
    `;
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
     * Handle model selection change
     *
     * @param {string} modelId - Selected model ID
     */
    handleModelChange(modelId) {
      logDebug("Model changed:", modelId);
      this.selectedModel = modelId;
      this.updateCostDisplay();
    }

    /**
     * Update cost display in modal
     */
    updateCostDisplay() {
      const costElement = document.getElementById("ai-cost-value");
      if (!costElement) return;

      const estimatedTokens = Math.ceil(
        this.originalMMD.length / AI_ENHANCER_CONFIG.CHARS_PER_TOKEN,
      );
      const cost = this.calculateCost(this.selectedModel, estimatedTokens);

      costElement.textContent = this.formatCost(cost);
    }

    /**
     * Calculate estimated cost for enhancement
     *
     * @param {string} modelId - Model ID
     * @param {number} inputTokens - Estimated input tokens
     * @returns {number} Estimated cost in GBP
     */
    calculateCost(modelId, inputTokens) {
      const model = Object.values(this.models || {}).find(
        (m) => m.id === modelId,
      );

      if (!model) {
        logWarn("Model not found for cost calculation:", modelId);
        return 0;
      }

      // Estimate output tokens as similar to input (MMD in, MMD out)
      const outputTokens = inputTokens;

      // Add system prompt tokens (rough estimate)
      const systemPromptTokens = 500;

      const totalInputTokens = inputTokens + systemPromptTokens;

      const inputCost = (totalInputTokens / 1000) * model.costPer1kInput;
      const outputCost = (outputTokens / 1000) * model.costPer1kOutput;

      return inputCost + outputCost;
    }

    /**
     * Format cost for display
     *
     * @param {number} cost - Cost in GBP
     * @returns {string} Formatted cost
     */
    formatCost(cost) {
      if (cost < 0.01) return "< £0.01";
      if (cost < 0.1) return `~£${cost.toFixed(3)}`;
      return `~£${cost.toFixed(2)}`;
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

      const parts = [
        this.prompts.role,
        "",
        "TASK:",
        this.prompts.task,
        "",
        "GUIDELINES:",
        ...this.prompts.guidelines.map((g) => `- ${g}`),
        "",
        "COMMON OCR ERRORS TO CHECK:",
        ...this.prompts.commonErrors.map((e) => `- ${e}`),
        "",
        "OUTPUT FORMAT:",
        this.prompts.outputFormat,
      ];

      return parts.join("\n");
    }

    /**
     * Build the user prompt for enhancement
     *
     * @param {string} mmdContent - Current MMD content
     * @returns {string} User prompt
     */
    buildUserPrompt(mmdContent) {
      return `Please review and correct any OCR errors in the following MMD document. The attached PDF is the source document - use it to verify mathematical notation.

CURRENT MMD CONTENT:
\`\`\`mmd
${mmdContent}
\`\`\`

Return ONLY the corrected MMD content, with no additional explanation or markdown formatting around it.`;
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

      // Create embed instance
      this.embed = new OpenRouterEmbed({
        containerId: "ai-enhance-embed-container",
        model: this.selectedModel,
        systemPrompt: this.buildSystemPrompt(),
        temperature: 0.3, // Lower temperature for more consistent corrections
        max_tokens: AI_ENHANCER_CONFIG.MAX_OUTPUT_TOKENS,
        top_p: 0.9,
        showNotifications: false, // We handle notifications ourselves
        enableLogging: true,
      });

      logInfo("OpenRouter Embed initialised", {
        model: this.selectedModel,
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

      // Read file to base64
      const base64Data = await this.readFileAsBase64(pdfBlob);

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

      logInfo("PDF attached", {
        filename,
        size: file.size,
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

      try {
        // Show processing state
        this.showProcessingState();

        // Stage 1: Prepare
        this.updateProgress("PREPARING");
        await this.initialiseEmbed();

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Stage 2: Attach PDF
        this.updateProgress("ATTACHING");
        const pdfBlob = this.getSourcePDF();
        if (!pdfBlob) {
          throw new Error("Source PDF not available");
        }
        await this.attachPDF(pdfBlob);

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Stage 3: Analyse
        this.updateProgress("ANALYSING");

        // Stage 4: Send request
        this.updateProgress("ENHANCING");

        const userPrompt = this.buildUserPrompt(this.originalMMD);

        // Send non-streaming request (we need the complete response)
        const response = await this.embed.sendRequest(userPrompt);

        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error("Cancelled");
        }

        // Stage 5: Validate
        this.updateProgress("VALIDATING");

        // Process response
        this.enhancedMMD = this.processResponse(response);

        if (!this.enhancedMMD || this.enhancedMMD.trim().length === 0) {
          throw new Error("Empty response from AI");
        }

        // Stage 6: Complete
        this.updateProgress("COMPLETE");

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
        <div class="processing-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Enhancement progress">
          <div class="progress-fill" id="ai-progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;

      this.currentModal.setContent(content);
      this.updateFooterButtons("processing");

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
     * Process API response to extract MMD content
     *
     * @param {Object} response - API response
     * @returns {string} Extracted MMD content
     */
    processResponse(response) {
      logDebug("Processing response...", response);

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

      // Load saved column preferences
      const prefs = this.loadColumnPreferences();

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
        </fieldset>

        <!-- 4-Column Comparison Grid -->
        <div class="ai-comparison-grid">
          <!-- Column 1: Original MMD -->
          <div class="ai-comparison-column" id="ai-col-original" ${prefs.original ? "" : "hidden"}>
            <h4>Original MMD</h4>
            <div class="column-content mmd-code" id="ai-original-content">${this.escapeHtml(this.originalMMD)}</div>
          </div>

          <!-- Column 2: Enhanced MMD -->
          <div class="ai-comparison-column" id="ai-col-enhanced" ${prefs.enhanced ? "" : "hidden"}>
            <h4>Enhanced MMD</h4>
            <div class="column-content mmd-code" id="ai-enhanced-content">${this.escapeHtml(this.enhancedMMD)}</div>
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
      </div>
    `;

      this.currentModal.setContent(content);
      this.updateFooterButtons("results");

      // Render preview after content is in DOM
      await this.renderPreview();

      // Render PDF if column is visible
      if (prefs.pdf) {
        await this.renderSourcePDF();
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
      };

      try {
        localStorage.setItem("ai-enhance-column-prefs", JSON.stringify(prefs));
        logDebug("Column preferences saved:", prefs);
      } catch (error) {
        logWarn("Failed to save column preferences:", error);
      }
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
     * Apply enhanced content to editor
     */
    async applyEnhancement() {
      logInfo("Applying enhancement to editor...");

      if (!this.enhancedMMD) {
        logWarn("No enhanced content to apply");
        return;
      }

      const restorer = this.getSessionRestorer();
      if (!restorer) {
        logError("Session restorer not available");
        if (window.notifyError) {
          window.notifyError("Cannot apply changes: editor not available");
        }
        return;
      }

      try {
        // Store current content for undo
        const currentContent = this.getCurrentMMD();

        // Push to undo stack (if available)
        if (restorer.undoStack && restorer.pushUndo) {
          restorer.pushUndo(currentContent);
        } else if (Array.isArray(restorer.undoStack)) {
          restorer.undoStack.push(currentContent);
          // Clear redo stack
          if (Array.isArray(restorer.redoStack)) {
            restorer.redoStack.length = 0;
          }
        }

        // Update textarea
        const textarea = restorer.elements?.mmdEditorTextarea;
        if (textarea) {
          textarea.value = this.enhancedMMD;

          // Trigger input event for change detection
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Update session
        if (restorer.restoredSession) {
          restorer.restoredSession.currentMMD = this.enhancedMMD;
        }

        // Mark as having unsaved changes
        if (typeof restorer.markUnsavedChanges === "function") {
          restorer.markUnsavedChanges();
        } else {
          restorer.hasUnsavedChanges = true;
        }

        // Refresh preview if available
        if (typeof restorer.updatePreview === "function") {
          await restorer.updatePreview(this.enhancedMMD);
        }

        // Close modal
        this.closeModal();

        // Notify success
        if (window.notifySuccess) {
          window.notifySuccess("AI enhancement applied! Use Ctrl+Z to undo.");
        }

        logInfo("Enhancement applied successfully");
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
  // Global action functions for onclick handlers
  window.openAIEnhancementModal = () => enhancerInstance?.openModal();
  window.startAIEnhancement = () => enhancerInstance?.startEnhancement();
  window.cancelAIEnhancement = () => enhancerInstance?.cancelEnhancement();
  window.applyAIEnhancement = () => enhancerInstance?.applyEnhancement();
  window.toggleAIColumn = (columnId) =>
    enhancerInstance?.toggleColumn(columnId);

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
})();
