/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER
 * ═══════════════════════════════════════════════════════════════
 *
 * Core controller: initialisation, DOM caching, event binding, reliability,
 * status display, and utilities. Analysis, camera, UI, generation, model,
 * and debug methods are in dedicated sub-modules mixed in via Object.assign.
 *
 * VERSION: 1.3.0
 * DATE: 31 March 2026
 * PHASE: Refactor — analysis and camera sections extracted
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // MEMORY MANAGEMENT UTILITIES (Lightweight Integration)
  // ============================================================================

  // Memory management utilities (loaded dynamically)
  let MemoryMonitor, ResourceTracker;

  // Dynamic import with graceful fallback
  (async () => {
    try {
      const memoryModule = await import("../js/utilities/memory-manager.js");
      MemoryMonitor = memoryModule.MemoryMonitor;
      ResourceTracker = memoryModule.ResourceTracker;
      console.log("[ImageDescriber] Memory management utilities loaded");
    } catch (error) {
      console.warn(
        "[ImageDescriber] Memory management utilities not available:",
        error.message,
      );
      // Create no-op fallbacks
      MemoryMonitor = {
        track: () => {},
        getMemoryInfo: () => ({ unavailable: true }),
      };
      ResourceTracker = {
        track: () => {},
        release: () => {},
      };
    }
  })();

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
      console.error(`[ImageDescriber] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageDescriber] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageDescriber] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageDescriber] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONTROLLER_CONFIG = {
    // AI model to use
    model: "anthropic/claude-haiku-4.5",

    // Token limits
    maxTokens: 4000,

    // Temperature for creativity
    temperature: 0.3,

    // Supported file types
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],

    // Maximum file size (10MB)
    maxFileSize: 10 * 1024 * 1024,
  };

  // ============================================================================
  // IMAGE DESCRIBER CONTROLLER
  // ============================================================================

  const ImageDescriberController = {
    // State
    currentFile: null,
    currentBase64: null,
    isGenerating: false,
    config: null,
    embedInstance: null,
    lastRawOutput: null,
    lastRawHTML: null,
    _initialized: false,
    _florenceRanThisSession: false,
    _florenceOCRRunning: false,
    _florenceOCRLoading: false,
    _florenceOCRStartTime: null,

    // Progress state (Phase 2A)
    progressStartTime: null,
    progressTimer: null,
    abortController: null,
    currentStage: null,
    lastElapsedTime: null, // Stores final time for display after completion

    // Cost estimation state (Stage 3)
    lastEstimatedCost: null, // Stores last calculated cost for debug panel

    // Memory management
    previewBlobUrls: new Set(), // Track blob URLs for cleanup

    // Local analysis state (Phase 2 — Local Analysis)
    lastAnalysis: null, // Most recent ImageAnalysisResult from analyser
    _analysisPending: null, // Background analysis promise (started on image load)
    currentFileHash: null, // SHA-256 hash of current file (Phase 9B cache key)
    _cacheHit: false, // Whether current analysis came from cache
    _immediateResult: null, // Stores analyseImmediate() output between phases (Phase 15B)
    _immediateCanvasData: null, // Canvas data from analyseImmediate() for gated phase (Phase 15B)

    // Visual verification state (Two-Pass)
    verificationEmbedInstance: null, // Separate embed instance for verification
    lastVerificationOutput: null, // Raw verification result textnull, // Raw verification result text
    verificationStartTime: null, // Timing for verification pass

    // Camera capture state (Phase 2E.2)
    cameraInstance: null, // UniversalCameraCapture instance
    cameraInitialised: false, // Whether camera has been set up
    capturedPhotoFile: null, // Raw File from camera (before transforms)
    capturedPhotoUrl: null, // Object URL for camera preview
    postCaptureRotation: 0, // 0, 90, 180, 270
    postCaptureFlipped: false, // Horizontal flip state

    // Cached DOM elements
    elements: {},

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    /**
     * Initialise the Image Describer controller
     * Waits for prompts to load before completing initialisation
     */
    async init() {
      // Prevent double initialisation
      if (this._initialized) {
        logDebug("Already initialised - skipping");
        return;
      }

      logInfo("Initialising Image Describer controller...");

      try {
        // Cache DOM elements
        this.cacheElements();

        // Config should already be set by initImageDescriber()
        if (!this.config) {
          this.config = window.imageDescriberConfig;
        }

        if (!this.config) {
          logWarn("Config not loaded - some features may be limited");
        } else {
          logInfo("Config loaded successfully");
        }

        // Wait for prompts to load (from prompt-loader.js)
        if (window.promptsLoaded) {
          logInfo("Waiting for prompts to load...");
          const promptResult = await window.promptsLoaded;

          if (promptResult.success) {
            logInfo("All prompts loaded successfully");
          } else {
            logWarn("Some prompts failed to load:", promptResult.errors);
          }
        } else {
          logWarn("Prompt loader not available - prompts may not be loaded");
        }

        // Populate model selector (Stage 2)
        this.populateModelSelector();

        // Enhance model selector keyboard navigation (Stage 6)
        this.enhanceModelSelectorKeyboard();

        // Bind event listeners
        this.bindEvents();

        // Bind clipboard paste (Phase 2E)
        this.bindClipboardPaste();

        // Bind verification events and populate selector (Two-Pass)
        this.bindVerificationEvents();
        this.populateVerificationModelSelector();

        // Bind remember checkbox (Stage 4)
        this.bindRememberCheckbox();

        // Bind show all models checkbox
        this.bindShowAllModelsCheckbox();

        // Set initial button states
        this.updateButtonStates();

        // Set initial generate area model info subtitles (Phase 2D)
        this.updateGenerateAreaInfo();

        // Listen for local model state changes to update generate area info
        if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.on === "function") {
          window.EmbedEventEmitter.on("model:stateChange", () => {
            this.updateGenerateAreaInfo();
          });
        }

        // Position generate button based on viewport (Phase 2B.2)
        this.positionGenerateButton();

        // Re-position on resize
        window.addEventListener("resize", () => {
          this.positionGenerateButton();
        });

        // Mark as initialised
        this._initialized = true;

        logInfo("Image Describer controller initialised successfully");
      } catch (error) {
        logError("Failed to initialise controller:", error);
      }
    },

    /**
     * Cache all required DOM elements
     */
    cacheElements() {
      this.elements = {
        // File upload
        fileInput: document.getElementById("imgdesc-file-input"),
        uploadArea: document.getElementById("imgdesc-upload-area"),
        preview: document.getElementById("imgdesc-preview"),
        clearBtn: document.getElementById("imgdesc-clear"),

        // Form fields
        subject: document.getElementById("imgdesc-subject"),
        topic: document.getElementById("imgdesc-topic"),
        objective: document.getElementById("imgdesc-objective"),
        context: document.getElementById("imgdesc-context"),
        audience: document.getElementById("imgdesc-audience"),
        module: document.getElementById("imgdesc-module"),
        checkboxOptions: document.getElementById("imgdesc-checkbox-options"),

        // Model selection (Stage 1)
        modelSection: document.getElementById("imgdesc-model-section"),
        modelSelector: document.getElementById("imgdesc-model"),
        costEstimate: document.getElementById("imgdesc-cost-estimate"),
        rememberModel: document.getElementById("imgdesc-remember-model"),
        showAllModels: document.getElementById("imgdesc-show-all-models"),

        // Layout panels (Phase 2B.2)
        configPanel: document.getElementById("imgdesc-config-panel"),
        generateArea: document.getElementById("imgdesc-generate-area"),

        // Generate area model info (Phase 2D)
        cloudModelInfo: document.getElementById("imgdesc-cloud-model-info"),
        cloudModelName: document.getElementById("imgdesc-cloud-model-name"),
        localModelInfo: document.getElementById("imgdesc-local-model-info"),
        localModelStatus: document.getElementById("imgdesc-local-model-status"),
        changeCloudModelBtn: document.getElementById("imgdesc-change-cloud-model"),
        changeLocalModelBtn: document.getElementById("imgdesc-change-local-model"),
        modelManagerPanel: document.getElementById("imgdesc-model-manager-panel"),

        // Streaming follow-mode toggle (WCAG 2.1.1 / Local Chat parity)
        streamFollowToggle: document.getElementById(
          "imgdesc-stream-follow-toggle",
        ),

        // Generation
        generateBtn: document.getElementById("imgdesc-generate"),
        generateLocalBtn: document.getElementById("imgdesc-generate-local"),
        localModelSelect: document.getElementById("imgdesc-local-model"),
        preGenerationWarning: document.getElementById(
          "imgdesc-pre-generation-warning",
        ),
        outputAccuracyWarning: document.getElementById(
          "imgdesc-output-accuracy-warning",
        ),
        status: document.getElementById("imgdesc-status"),

        // Progress elements (Phase 2A)
        progress: document.getElementById("imgdesc-progress"),
        progressBar: document.querySelector(".imgdesc-progress-bar"),
        progressFill: document.querySelector(".imgdesc-progress-fill"),
        progressStage: document.getElementById("imgdesc-progress-stage"),
        progressTime: document.getElementById("imgdesc-progress-time"),
        cancelBtn: document.getElementById("imgdesc-cancel"),
        completionTime: document.getElementById("imgdesc-completion-time"),
        finalTime: document.getElementById("imgdesc-final-time"),

        // Output
        outputSection: document.getElementById("imgdesc-output-section"),
        output: document.getElementById("imgdesc-output"),
        copyBtn: document.getElementById("imgdesc-copy"),
        copyFormattedBtn: document.getElementById("imgdesc-copy-formatted"),
        copyHtmlBtn: document.getElementById("imgdesc-copy-html"),
        regenerateBtn: document.getElementById("imgdesc-regenerate"),
        redescribeBtn: document.getElementById("imgdesc-redescribe"),
        newImageBtn: document.getElementById("imgdesc-new"),

        // Debug panel elements (Phase 2C)
        debugPanel: document.getElementById("imgdesc-debug-panel"),
        debugElements: {
          // Request details
          model: document.getElementById("imgdesc-debug-model"),
          selectedModel: document.getElementById(
            "imgdesc-debug-selected-model",
          ),
          modelCost: document.getElementById("imgdesc-debug-model-cost"),
          temperature: document.getElementById("imgdesc-debug-temperature"),
          maxTokens: document.getElementById("imgdesc-debug-max-tokens"),
          systemLength: document.getElementById("imgdesc-debug-system-length"),
          userLength: document.getElementById("imgdesc-debug-user-length"),
          streaming: document.getElementById("imgdesc-debug-streaming"),

          // File details
          filename: document.getElementById("imgdesc-debug-filename"),
          originalSize: document.getElementById("imgdesc-debug-original-size"),
          compressedSize: document.getElementById(
            "imgdesc-debug-compressed-size",
          ),
          compressionSavings: document.getElementById(
            "imgdesc-debug-compression-savings",
          ),
          format: document.getElementById("imgdesc-debug-format"),
          dimensionsOriginal: document.getElementById(
            "imgdesc-debug-dimensions-original",
          ),
          dimensionsCompressed: document.getElementById(
            "imgdesc-debug-dimensions-compressed",
          ),

          // Response details
          promptTokens: document.getElementById("imgdesc-debug-prompt-tokens"),
          completionTokens: document.getElementById(
            "imgdesc-debug-completion-tokens",
          ),
          totalTokens: document.getElementById("imgdesc-debug-total-tokens"),
          processingTime: document.getElementById(
            "imgdesc-debug-processing-time",
          ),
          responseLength: document.getElementById(
            "imgdesc-debug-response-length",
          ),
          cost: document.getElementById("imgdesc-debug-cost"),

          // Context applied
          subject: document.getElementById("imgdesc-debug-subject"),
          topic: document.getElementById("imgdesc-debug-topic"),
          objective: document.getElementById("imgdesc-debug-objective"),
          module: document.getElementById("imgdesc-debug-module"),
          style: document.getElementById("imgdesc-debug-style"),
          audience: document.getElementById("imgdesc-debug-audience"),
          checkboxes: document.getElementById("imgdesc-debug-checkboxes"),

          // Prompts
          systemPrompt: document.getElementById("imgdesc-debug-system-prompt"),
          userPrompt: document.getElementById("imgdesc-debug-user-prompt"),
          systemCharCount: document.getElementById(
            "imgdesc-debug-system-char-count",
          ),
          userCharCount: document.getElementById(
            "imgdesc-debug-user-char-count",
          ),
          // Pre-analysis details (Local Analysis)
          analysisProfile: document.getElementById(
            "imgdesc-debug-analysis-profile",
          ),
          classification: document.getElementById(
            "imgdesc-debug-classification",
          ),
          clip: document.getElementById("imgdesc-debug-clip"),
          ocrLabels: document.getElementById("imgdesc-debug-ocr-labels"),
          ocrTime: document.getElementById("imgdesc-debug-ocr-time"),
          noiseSuppression: document.getElementById(
            "imgdesc-debug-noise-suppression",
          ),
          colourAnalysis: document.getElementById(
            "imgdesc-debug-colour-analysis",
          ),
          analysisTime: document.getElementById("imgdesc-debug-analysis-time"),
        },

        // Verification elements (Two-Pass)
        verifySection: document.getElementById("imgdesc-verify-section"),
        verifyEnabled: document.getElementById("imgdesc-verify-enabled"),
        verifyModelGroup: document.getElementById("imgdesc-verify-model-group"),
        verifyModel: document.getElementById("imgdesc-verify-model"),
        verifyCostHint: document.getElementById("imgdesc-verify-cost-hint"),
        verifyPanel: document.getElementById("imgdesc-verification-panel"),
        verifyOutput: document.getElementById("imgdesc-verification-output"),
        verifyBadge: document.getElementById("imgdesc-verify-badge"),

        // Verification debug elements
        debugVerifySection: document.getElementById(
          "imgdesc-debug-verify-section",
        ),
        debugVerifyEnabled: document.getElementById(
          "imgdesc-debug-verify-enabled",
        ),
        debugVerifyModel: document.getElementById("imgdesc-debug-verify-model"),
        debugVerifyTokens: document.getElementById(
          "imgdesc-debug-verify-tokens",
        ),
        debugVerifyTime: document.getElementById("imgdesc-debug-verify-time"),
        debugVerifyCorrections: document.getElementById(
          "imgdesc-debug-verify-corrections",
        ),

        // Health indicator (Stage 7 - optional)
        healthIndicator: document.getElementById("imgdesc-health-indicator"),

        // Cache recall banner (Phase 11D)
        cacheRecallBanner: document.getElementById(
          "imgdesc-cache-recall-banner",
        ),
        cacheRecallText: document.getElementById("imgdesc-cache-recall-text"),
        reanalyseBtn: document.getElementById("imgdesc-reanalyse-btn"),

        // Expert mode (Phase 4A)
        expertSection: document.getElementById("imgdesc-expert-section"),
        expertPanel: document.getElementById("imgdesc-expert-panel"),
        expertLibraryStatus: document.getElementById(
          "imgdesc-expert-library-status",
        ),
        expertProfile: document.getElementById("imgdesc-expert-profile"),

        // Camera capture elements (Phase 2E.2)
        cameraSection: document.getElementById("imgdesc-camera-section"),
        cameraVideo: document.getElementById("imgdesc-camera-video"),
        cameraCaptured: document.getElementById("imgdesc-camera-captured"),
        cameraStatus: document.getElementById("imgdesc-camera-status"),
        cameraStatusText: document.getElementById("imgdesc-camera-status-text"),
        cameraControls: document.getElementById("imgdesc-camera-controls"),
        cameraStartBtn: document.getElementById("imgdesc-camera-start"),
        cameraStartText: document.getElementById("imgdesc-camera-start-text"),
        cameraCaptureBtn: document.getElementById("imgdesc-camera-capture"),
        cameraMirrorBtn: document.getElementById("imgdesc-camera-mirror"),
        cameraSwitchBtn: document.getElementById("imgdesc-camera-switch"),
        cameraAdjust: document.getElementById("imgdesc-camera-adjust"),
        cameraRotateBtn: document.getElementById("imgdesc-camera-rotate"),
        cameraFlipBtn: document.getElementById("imgdesc-camera-flip"),
        cameraConfirmBtn: document.getElementById("imgdesc-camera-confirm"),
        cameraRetakeBtn: document.getElementById("imgdesc-camera-retake"),
        cameraUnavailable: document.getElementById(
          "imgdesc-camera-unavailable",
        ),
        cameraInfo: document.getElementById("imgdesc-camera-info"),
      };

      // Validate critical elements
      const critical = ["fileInput", "generateBtn", "output", "status"];
      const missing = critical.filter((key) => !this.elements[key]);

      if (missing.length > 0) {
        logError("Missing critical DOM elements:", missing);
      } else {
        logDebug("All DOM elements cached successfully");
      }
    },

    // ========================================================================
    // RELIABILITY FEATURES (Stage 7)
    // ========================================================================

    /**
     * Handle retry attempts (Stage 7)
     * Shows user feedback during retry operations
     * Gracefully degrades if notification system unavailable
     * @param {number} attempt - Current retry attempt (1-based)
     * @param {number} delay - Delay before next retry in ms
     * @param {Error} error - Error that triggered retry
     */
    handleRetryAttempt(attempt, delay, error) {
      const delaySeconds = Math.round(delay / 1000);
      const errorMessage = error?.message || "Unknown error";

      logWarn(`Retry attempt ${attempt} after error: ${errorMessage}`);
      logDebug(`Retrying in ${delaySeconds}s...`);

      // Update progress message if in generation phase
      if (this.isGenerating && this.elements.progressStage) {
        this.elements.progressStage.innerHTML = `<span aria-hidden="true">🔄</span> Retrying (attempt ${attempt})...`;
      }

      // Show notification for first retry (user awareness)
      if (attempt === 1 && typeof window.notifyWarning === "function") {
        window.notifyWarning(
          `Request failed, retrying automatically... (${delaySeconds}s delay)`,
        );
      }

      // Show notification for final retry attempt
      if (attempt === 3 && typeof window.notifyWarning === "function") {
        window.notifyWarning(`Final retry attempt in ${delaySeconds}s...`);
      }

      // Log to debug panel if available
      if (this.elements.debugElements?.model) {
        const debugLog = document.getElementById("imgdesc-debug-retry-log");
        if (debugLog) {
          const timestamp = new Date().toLocaleTimeString();
          debugLog.textContent = `${timestamp}: Retry ${attempt} (${errorMessage})`;
        }
      }
    },

    /**
     * Handle health status changes (Stage 7)
     * Provides user feedback about connection quality
     * Gracefully degrades if health monitor unavailable
     * @param {Object} status - Health status object with status, previousStatus, timestamp
     */
    /**
     * Handle health status changes from the embed instance (Stage 7)
     * Updates the health indicator UI and notifies user of significant changes
     * @param {string} status - New health status ('healthy', 'degraded', 'unhealthy')
     */
    handleHealthStatusChange(status) {
      const previousStatus = this._lastHealthStatus;
      this._lastHealthStatus = status;

      const statusValue = typeof status === "object" ? status.status : status;
      const prevValue =
        typeof previousStatus === "object"
          ? previousStatus?.status
          : previousStatus;
      logInfo(`Health status changed: ${prevValue} → ${statusValue}`);

      // Update health indicator UI
      if (this.elements.healthIndicator) {
        this.updateHealthIndicator(this.elements.healthIndicator, status);
        logDebug("Health indicator updated:", status);
      }

      // Only notify on SIGNIFICANT transitions (not initial check)
      // Skip notification if previous status was undefined (first check)
      if (previousStatus === undefined) {
        logDebug("Skipping notification for initial health check");
        return;
      }

      // Notify user of significant status changes
      if (status === "degraded" && previousStatus === "healthy") {
        if (window.notifyWarning) {
          window.notifyWarning(
            "Connection to AI is experiencing issues. Requests may be slower.",
          );
        }
      } else if (status === "unhealthy" && previousStatus !== "unhealthy") {
        if (window.notifyError) {
          window.notifyError(
            "Connection to AI lost. Will retry automatically.",
          );
        }
      } else if (status === "healthy" && previousStatus === "unhealthy") {
        // Only notify restoration if we were previously unhealthy
        if (window.notifySuccess) {
          window.notifySuccess("Connection to AI restored.");
        }
      }

      // Log to debug panel if available
      if (this.elements.debugPanel && this.logToDebugPanel) {
        this.logToDebugPanel(`Health: ${status}`);
      }
    },

    /**
     * Update health indicator UI element (Stage 7)
     * Updates visual appearance and ARIA attributes
     * @param {HTMLElement} indicator - Health indicator element
     * @param {Object} status - Health status object
     */
    updateHealthIndicator(indicator, status) {
      if (!indicator) return;

      const { status: currentStatus } = status;

      // Remove existing status classes
      indicator.classList.remove(
        "health-healthy",
        "health-degraded",
        "health-unhealthy",
        "health-unknown",
      );

      // Status configuration
      const statusConfig = {
        healthy: {
          class: "health-healthy",
          icon: "🟢",
          text: "Connection: Good",
          ariaLabel: "Connection status: Good",
        },
        degraded: {
          class: "health-degraded",
          icon: "🟡",
          text: "Connection: Slow",
          ariaLabel: "Connection status: Degraded - requests may be slower",
        },
        unhealthy: {
          class: "health-unhealthy",
          icon: "🔴",
          text: "Connection: Issues",
          ariaLabel: "Connection status: Unstable - requests may fail",
        },
        unknown: {
          class: "health-unknown",
          icon: "⚪",
          text: "Connection: Checking...",
          ariaLabel: "Connection status: Checking",
        },
      };

      const config = statusConfig[currentStatus] || statusConfig.unknown;

      // Apply new status
      indicator.classList.add(config.class);
      indicator.setAttribute("aria-label", config.ariaLabel);

      // Update content
      const iconSpan = indicator.querySelector("[aria-hidden]");
      const textSpan = indicator.querySelector(".imgdesc-health-text");

      if (iconSpan) {
        iconSpan.textContent = config.icon;
      }
      if (textSpan) {
        textSpan.textContent = config.text;
      }

      logDebug(`Health indicator updated: ${currentStatus}`);
    },

    /**
     * Position generate button based on viewport (Phase 2B.2)
     * Desktop: Below image upload/preview in left column
     * Mobile: Below options in right column
     */
    positionGenerateButton() {
      if (!this.elements.generateArea) {
        logWarn("Generate area not found for positioning");
        return;
      }

      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const inputColumn = document.querySelector(".imgdesc-input-column");
      const configPanel = this.elements.configPanel;

      if (isDesktop && inputColumn) {
        // Desktop: Place at end of left column (after upload section)
        const uploadSection = inputColumn.querySelector(".imgdesc-section");
        if (
          uploadSection &&
          this.elements.generateArea.parentElement !== uploadSection
        ) {
          uploadSection.appendChild(this.elements.generateArea);
          logDebug("Generate button moved to left column (desktop)");
        }
      } else if (configPanel) {
        // Mobile: Place after config panel (at end of right column content)
        const outputColumn = document.querySelector(".imgdesc-output-column");
        if (
          outputColumn &&
          this.elements.generateArea.parentElement !== outputColumn
        ) {
          // Insert after config panel but before output section
          const outputSection = this.elements.outputSection;
          if (outputSection) {
            outputColumn.insertBefore(
              this.elements.generateArea,
              outputSection,
            );
          } else {
            outputColumn.appendChild(this.elements.generateArea);
          }
          logDebug("Generate button moved to right column (mobile)");
        }
      }
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
      // File input change
      if (this.elements.fileInput) {
        this.elements.fileInput.addEventListener("change", (e) => {
          if (e.target.files?.length > 0) {
            // Stop camera if active — upload takes precedence (Phase 2E.2)
            if (this.cameraInstance?.isCameraActive) {
              this.cleanupCamera();
              if (this.elements.cameraSection) {
                this.elements.cameraSection.open = false;
              }
            }
            this.handleFileSelect(e.target.files[0]);
          }
        });
      }

      // Drag and drop on upload area
      if (this.elements.uploadArea) {
        this.elements.uploadArea.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.elements.uploadArea.classList.add("imgdesc-drag-over");
        });

        this.elements.uploadArea.addEventListener("dragleave", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.elements.uploadArea.classList.remove("imgdesc-drag-over");
        });

        this.elements.uploadArea.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.elements.uploadArea.classList.remove("imgdesc-drag-over");

          if (e.dataTransfer.files?.length > 0) {
            // Stop camera if active — upload takes precedence (Phase 2E.2)
            if (this.cameraInstance?.isCameraActive) {
              this.cleanupCamera();
              if (this.elements.cameraSection) {
                this.elements.cameraSection.open = false;
              }
            }
            this.handleFileSelect(e.dataTransfer.files[0]);
          }
        });
      }

      // Clear button
      if (this.elements.clearBtn) {
        this.elements.clearBtn.addEventListener("click", () => {
          this.clear();
        });
      }

      // Generate button (cloud)
      if (this.elements.generateBtn) {
        this.elements.generateBtn.addEventListener("click", () => {
          this.generate();
        });
      }

      // Generate Locally button (Phase 13C-1)
      if (this.elements.generateLocalBtn) {
        this.elements.generateLocalBtn.addEventListener("click", () => {
          this.generateLocally();
        });
      }

      // Local model selector — toggle pre-generation warning (Phase 14D)
      if (this.elements.localModelSelect) {
        this.elements.localModelSelect.addEventListener("change", () => {
          const isQwen = this.elements.localModelSelect.value === "qwen35";
          if (this.elements.preGenerationWarning) {
            this.elements.preGenerationWarning.hidden = !isQwen;
          }
          this.updateGenerateAreaInfo();
        });
      }

      // Change model links in generate area (Phase 2D)
      if (this.elements.changeCloudModelBtn) {
        this.elements.changeCloudModelBtn.addEventListener("click", () => {
          this.openModelManagerPanel(this.elements.modelSelector);
        });
      }
      if (this.elements.changeLocalModelBtn) {
        this.elements.changeLocalModelBtn.addEventListener("click", () => {
          this.openModelManagerPanel(this.elements.localModelSelect);
        });
      }

      // Copy button
      if (this.elements.copyBtn) {
        this.elements.copyBtn.addEventListener("click", () => {
          this.copyToClipboard();
        });
      }

      // Copy Formatted button (Phase 2B.3)
      if (this.elements.copyFormattedBtn) {
        this.elements.copyFormattedBtn.addEventListener("click", () => {
          this.copyFormattedText();
        });
      }

      // Copy HTML button (Phase 2B.3)
      if (this.elements.copyHtmlBtn) {
        this.elements.copyHtmlBtn.addEventListener("click", () => {
          this.copyAsHTML();
        });
      }

      // Regenerate button
      if (this.elements.regenerateBtn) {
        this.elements.regenerateBtn.addEventListener("click", () => {
          this.generate();
        });
      }

      // Redescribe button — keep image, return to options
      if (this.elements.redescribeBtn) {
        this.elements.redescribeBtn.addEventListener("click", () => {
          this.redescribeWithNewOptions();
        });
      }

      // New Image button (Phase 2B.2)
      if (this.elements.newImageBtn) {
        this.elements.newImageBtn.addEventListener("click", () => {
          this.resetForNewImage();
        });
      }

      // Streaming follow-mode toggle — persist to localStorage and, if a
      // stream has already finished, drop the scrollable class so the output
      // reverts to static layout on the next generation immediately.
      if (this.elements.streamFollowToggle) {
        try {
          const stored = localStorage.getItem("imgdesc-stream-follow");
          this.elements.streamFollowToggle.checked = stored !== "false";
        } catch (e) {}
        this.elements.streamFollowToggle.addEventListener("change", () => {
          const on = this.elements.streamFollowToggle.checked;
          try {
            localStorage.setItem("imgdesc-stream-follow", on ? "true" : "false");
          } catch (e) {}
          if (!on && this.elements.output) {
            if (typeof this._teardownFollowObserver === "function") {
              this._teardownFollowObserver();
            }
            this.elements.output.classList.remove("imgdesc-output--follow");
            this.elements.output.setAttribute("tabindex", "-1");
          }
        });
      }

      // Cancel button (Phase 2A)
      if (this.elements.cancelBtn) {
        this.elements.cancelBtn.addEventListener("click", () => {
          this.cancelGeneration();
        });
      }

      // Debug panel copy buttons (Phase 2C)
      const debugCopyButtons = document.querySelectorAll(
        ".imgdesc-debug-copy-btn",
      );
      debugCopyButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
          const targetId = button.getAttribute("data-copy-target");
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            this.copyDebugContent(targetElement, button);
          }
        });
      });

      // Camera <details> toggle — lazy initialisation (Phase 2E.2)
      if (this.elements.cameraSection) {
        this.elements.cameraSection.addEventListener("toggle", () => {
          if (this.elements.cameraSection.open && !this.cameraInitialised) {
            this.initCamera();
          }
        });
      }

      // Expert panel state persistence (Phase 4A)
      if (this.elements.expertPanel) {
        // Restore saved open/closed state
        try {
          const savedState = localStorage.getItem("imgdesc-expert-open");
          if (savedState === "true") {
            this.elements.expertPanel.open = true;
          }
        } catch (e) {
          logWarn("Could not restore expert panel state:", e);
        }

        // Save state on toggle
        this.elements.expertPanel.addEventListener("toggle", () => {
          try {
            localStorage.setItem(
              "imgdesc-expert-open",
              this.elements.expertPanel.open,
            );
          } catch (e) {
            logWarn("Could not save expert panel state:", e);
          }
        });
      }

      // Library status events (Phase 4B)
      if (window.EmbedEventEmitter) {
        window.EmbedEventEmitter.on("library:status", (data) => {
          if (!data || !data.library || !data.status) return;

          const options = {};

          if (data.status === "ready" && data.elapsed) {
            options.hint = data.cached
              ? `Cached (${data.elapsed}s)`
              : `Loaded in ${data.elapsed}s`;
          }

          if (data.status === "error" && data.error) {
            options.hint = data.error;
          }

          this.updateLibraryStatus(data.library, data.status, options);

          // Phase 10C-fix: update Florence-2 opt-in button state
          if (data.library === "florence2") {
            this._updateFlorenceOptinState();
          }
        });
        logDebug("Subscribed to library:status events");

        // Analysis stage events (Phase 6A)
        window.EmbedEventEmitter.on("analysis:stage", (data) => {
          if (!data || !data.stage || !data.status) return;
          this._updateAnalysisStatus(data.stage, data.status, data);
        });
        logDebug("Subscribed to analysis:stage events");
      }

      // Profile selection change handler (Phase 4C)
      const profileRadios = document.querySelectorAll(
        'input[name="imgdesc-profile"]',
      );
      profileRadios.forEach((radio) => {
        radio.addEventListener("change", (e) => {
          this.handleProfileChange(e.target.value);
        });
      });

      // Skip-OCR checkbox — hide/show Florence-2 OCR prompt (Phase 14J)
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      if (skipOCRCheckbox) {
        skipOCRCheckbox.addEventListener("change", () => {
          this._updateFlorenceOCRPrompt();
        });
      }

      logDebug("Event listeners bound");
    },

    /**
     * Bind clipboard paste handler (Phase 2E)
     * Allows users to paste images directly from clipboard
     */
    bindClipboardPaste() {
      logDebug("Binding clipboard paste handler");

      // Helper: Check if Image Describer tool is currently visible
      const isToolVisible = () => {
        const article = document.getElementById("image-describe-app");
        return (
          article &&
          window.getComputedStyle(article).display !== "none" &&
          article.getAttribute("aria-hidden") !== "true"
        );
      };

      // Helper: Check if focus is in an input field
      const isFocusInInputField = () => {
        const activeEl = document.activeElement;
        return (
          activeEl &&
          (activeEl.matches("input, textarea") || activeEl.isContentEditable)
        );
      };

      // Document-level paste listener with guards
      document.addEventListener("paste", async (e) => {
        // Guard 1: Only handle if this tool is active
        if (!isToolVisible()) {
          logDebug("Paste ignored - Image Describer not visible");
          return;
        }

        // Guard 2: Only handle if not typing in input field
        if (isFocusInInputField()) {
          logDebug("Paste ignored - focus in input field");
          return;
        }

        // Extract clipboard items
        const items = e.clipboardData?.items;
        if (!items) {
          logDebug("Paste ignored - no clipboard items");
          return;
        }

        // Look for image in clipboard
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            logInfo("Image detected in clipboard:", item.type);

            try {
              const file = item.getAsFile();
              if (!file) {
                throw new Error("Could not extract image from clipboard");
              }

              // Process the image using existing file handler
              await this.handleFileSelect(file);

              // Provide feedback
              this.announceStatus("Image pasted from clipboard");
              if (window.notifySuccess) {
                window.notifySuccess("Image pasted from clipboard");
              }

              logInfo("Clipboard image processed successfully");
            } catch (error) {
              logError("Clipboard paste error:", error);
              this.showError("Failed to paste image. Please try again.");
              if (window.notifyError) {
                window.notifyError("Failed to paste image");
              }
            }

            return; // Only process first image found
          }
        }

        // No image found in clipboard
        logDebug("Paste ignored - no image in clipboard");
      });

      logDebug("Clipboard paste handler bound successfully");
    },

    // ========================================================================
    // STATUS AND ERRORS
    // ========================================================================

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Status type: 'processing', 'success', 'error'
     */
    showStatus(message, type = "info") {
      if (!this.elements.status) return;

      this.elements.status.textContent = message;
      this.elements.status.className = `imgdesc-status imgdesc-status-${type}`;
      this.elements.status.hidden = false;

      logDebug("Status updated:", message, type);
    },

    /**
     * Hide status message
     */
    hideStatus() {
      if (this.elements.status) {
        this.elements.status.hidden = true;
      }
    },

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
      this.showStatus(message, "error");

      if (window.notifyError) {
        window.notifyError(message);
      }
    },

    /**
     * Announce status to screen readers
     * @param {string} message - Message to announce
     */
    announceStatus(message) {
      // The status element has aria-live, so updating it announces automatically
      logDebug("Screen reader announcement:", message);
    },

    // ========================================================================
    // BUTTON STATES
    // ========================================================================

    /**
     * Update button states based on current state
     */
    updateButtonStates() {
      const hasFile = !!this.currentFile;
      const hasOutput = !!this.lastRawOutput;

      // Generate button (cloud)
      if (this.elements.generateBtn) {
        this.elements.generateBtn.disabled = !hasFile || this.isGenerating;
      }

      // Generate Locally button (Phase 13C-1)
      if (this.elements.generateLocalBtn) {
        this.elements.generateLocalBtn.disabled = !hasFile || this.isGenerating;
      }

      // Clear button
      if (this.elements.clearBtn) {
        this.elements.clearBtn.hidden = !hasFile;
      }

      // Copy button
      if (this.elements.copyBtn) {
        this.elements.copyBtn.disabled = !hasOutput || this.isGenerating;
      }

      // Copy Formatted / Copy HTML buttons — same rules as plain Copy
      if (this.elements.copyFormattedBtn) {
        this.elements.copyFormattedBtn.disabled =
          !hasOutput || this.isGenerating;
      }
      if (this.elements.copyHtmlBtn) {
        this.elements.copyHtmlBtn.disabled = !hasOutput || this.isGenerating;
      }

      // Regenerate button
      if (this.elements.regenerateBtn) {
        this.elements.regenerateBtn.disabled = !hasFile || this.isGenerating;
      }

      // Redescribe button
      if (this.elements.redescribeBtn) {
        this.elements.redescribeBtn.disabled = !hasFile || this.isGenerating;
      }

      // Nudge the Read Aloud module — it normally refreshes via a
      // MutationObserver on #imgdesc-output, but the isGenerating → false
      // transition after streaming completes is not a DOM mutation, so it
      // wouldn't otherwise re-evaluate.
      if (window.TTSReadAloud && typeof window.TTSReadAloud.refresh === "function") {
        window.TTSReadAloud.refresh();
      }

      logDebug("Button states updated", {
        hasFile,
        hasOutput,
        isGenerating: this.isGenerating,
      });
    },

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },
  };

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

  // Expose config constants for sub-modules (scoped const not accessible outside IIFE)
  ImageDescriberController._controllerConfig = CONTROLLER_CONFIG;

  // Expose memory utilities for sub-modules (loaded dynamically, scoped let)
  ImageDescriberController._memoryUtils = { MemoryMonitor, ResourceTracker };

  window.ImageDescriberController = ImageDescriberController;

  // ============================================================================
  // LAZY INITIALISATION (called when tool is shown)
  // ============================================================================

  /**
   * Initialise controller when tool becomes visible
   * Called by showImgDesc() in boilerplate.html
   * Safe to call multiple times - only initialises once
   */
  window.initImageDescriber = async function () {
    if (ImageDescriberController._initialized) {
      logDebug("Already initialised - skipping");
      return;
    }

    // Wait a tick for config to be available
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Try to get config
    ImageDescriberController.config = window.imageDescriberConfig;

    if (!ImageDescriberController.config) {
      logWarn("Config not yet loaded - will retry");
      // Retry after a short delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      ImageDescriberController.config = window.imageDescriberConfig;
    }

    await ImageDescriberController.init();
    ImageDescriberController._initialized = true;
  };

  logInfo(
    "Image Describer Controller loaded (call initImageDescriber() to initialise)",
  );
})();
