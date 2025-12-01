/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER
 * ═══════════════════════════════════════════════════════════════
 *
 * Main controller for the Image Describer tool.
 * Integrates with OpenRouter Embed API for AI-powered image descriptions.
 *
 * Features:
 * - Image upload with preview
 * - Form-based context collection
 * - Modular prompt system
 * - Streaming and non-streaming modes
 * - Reduced motion support
 * - Full accessibility compliance
 *
 * VERSION: 1.0.0
 * DATE: 24 November 2025
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
        error.message
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
  // PROGRESS STAGES (Phase 2A)
  // ============================================================================

  const PROGRESS_STAGES = {
    VALIDATING: {
      message: "Validating image...",
      icon: "🔍",
      weight: 5,
    },
    COMPRESSING: {
      message: "Optimising image...",
      icon: "📦",
      weight: 10,
    },
    PREPARING: {
      message: "Preparing request...",
      icon: "📤",
      weight: 5,
    },
    GENERATING: {
      message: "Generating description...",
      icon: "✨",
      weight: 75,
    },
    FINALISING: {
      message: "Finalising...",
      icon: "✅",
      weight: 5,
    },
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

    // Progress state (Phase 2A)
    progressStartTime: null,
    progressTimer: null,
    abortController: null,
    currentStage: null,
    lastElapsedTime: null, // Stores final time for display after completion

    // Memory management
    previewBlobUrls: new Set(), // Track blob URLs for cleanup

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

        // Bind event listeners
        this.bindEvents();

        // Bind clipboard paste handler (Phase 2E)
        this.bindClipboardPaste();

        // Set initial button states
        this.updateButtonStates();

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
        styleOptions: document.getElementById("imgdesc-style-options"),
        checkboxOptions: document.getElementById("imgdesc-checkbox-options"),

        // Layout panels (Phase 2B.2)
        configPanel: document.getElementById("imgdesc-config-panel"),
        generateArea: document.getElementById("imgdesc-generate-area"),

        // Generation
        generateBtn: document.getElementById("imgdesc-generate"),
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
        newImageBtn: document.getElementById("imgdesc-new"),

        // Debug panel elements (Phase 2C)
        debugPanel: document.getElementById("imgdesc-debug-panel"),
        debugElements: {
          // Request details
          model: document.getElementById("imgdesc-debug-model"),
          temperature: document.getElementById("imgdesc-debug-temperature"),
          maxTokens: document.getElementById("imgdesc-debug-max-tokens"),
          systemLength: document.getElementById("imgdesc-debug-system-length"),
          userLength: document.getElementById("imgdesc-debug-user-length"),
          streaming: document.getElementById("imgdesc-debug-streaming"),

          // File details
          filename: document.getElementById("imgdesc-debug-filename"),
          originalSize: document.getElementById("imgdesc-debug-original-size"),
          compressedSize: document.getElementById(
            "imgdesc-debug-compressed-size"
          ),
          compressionSavings: document.getElementById(
            "imgdesc-debug-compression-savings"
          ),
          format: document.getElementById("imgdesc-debug-format"),
          dimensionsOriginal: document.getElementById(
            "imgdesc-debug-dimensions-original"
          ),
          dimensionsCompressed: document.getElementById(
            "imgdesc-debug-dimensions-compressed"
          ),

          // Response details
          promptTokens: document.getElementById("imgdesc-debug-prompt-tokens"),
          completionTokens: document.getElementById(
            "imgdesc-debug-completion-tokens"
          ),
          totalTokens: document.getElementById("imgdesc-debug-total-tokens"),
          processingTime: document.getElementById(
            "imgdesc-debug-processing-time"
          ),
          responseLength: document.getElementById(
            "imgdesc-debug-response-length"
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
            "imgdesc-debug-system-char-count"
          ),
          userCharCount: document.getElementById(
            "imgdesc-debug-user-char-count"
          ),
        },
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
              outputSection
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

      // Generate button
      if (this.elements.generateBtn) {
        this.elements.generateBtn.addEventListener("click", () => {
          this.generate();
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

      // New Image button (Phase 2B.2)
      if (this.elements.newImageBtn) {
        this.elements.newImageBtn.addEventListener("click", () => {
          this.resetForNewImage();
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
        ".imgdesc-debug-copy-btn"
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
    // FILE HANDLING
    // ========================================================================

    /**
     * Handle file selection
     * @param {File} file - The selected file
     */
    async handleFileSelect(file) {
      logInfo("File selected:", file.name);

      try {
        // Validate file type only (size checked after compression in embed API)
        if (!CONTROLLER_CONFIG.acceptedTypes.includes(file.type)) {
          throw new Error(
            `Invalid file type: ${file.type}. Please upload a JPEG, PNG, or WebP image.`
          );
        }

        // Show info for large files (compression will be applied)
        const fileMB = file.size / (1024 * 1024);
        if (fileMB > 5) {
          logInfo(
            `Large file detected (${fileMB.toFixed(
              1
            )}MB) - will be compressed before processing`
          );

          // Show user feedback for large files
          if (window.notifyInfo) {
            window.notifyInfo(
              `Large image (${fileMB.toFixed(
                1
              )}MB) - will be optimised automatically`
            );
          }
        }

        // Store file reference
        this.currentFile = file;

        // Convert to base64 for preview only (original file, not compressed)
        this.currentBase64 = await this.fileToBase64(file);

        // Show preview
        this.showPreview(file);

        // Update button states
        this.updateButtonStates();

        // Announce to screen reader
        this.announceStatus(`Image loaded: ${file.name}`);

        logInfo("File processed successfully", {
          name: file.name,
          sizeMB: fileMB.toFixed(2),
          type: file.type,
        });
      } catch (error) {
        logError("File handling error:", error);
        this.showError(error.message);
        this.currentFile = null;
        this.currentBase64 = null;
      }
    },

    /**
     * Convert file to base64 string
     * @param {File} file - The file to convert
     * @returns {Promise<string>} Base64 encoded string (without data URI prefix)
     */
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          // Remove data URI prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsDataURL(file);
      });
    },

    /**
     * Show image preview with memory tracking
     * @param {File} file - The file to preview
     */
    showPreview(file) {
      if (!this.elements.preview) return;

      const url = URL.createObjectURL(file);

      // Track the blob URL for cleanup
      this.previewBlobUrls.add(url);

      // Track memory
      if (MemoryMonitor) {
        MemoryMonitor.track("ImageDescriber_showPreview", {
          fileName: file.name,
          fileSize: file.size,
        });
      }

      this.elements.preview.innerHTML = `
      <img 
        src="${url}" 
        alt="Preview of ${this.escapeHtml(file.name)}"
        class="imgdesc-preview-image"
      />
      <div class="imgdesc-preview-actions">
        <p class="imgdesc-file-info">
          ${this.escapeHtml(file.name)} (${(file.size / 1024).toFixed(0)} KB)
        </p>
        <button 
          type="button" 
          class="imgdesc-fullscreen-btn secondary-button" 
          id="imgdesc-fullscreen-btn"
          aria-label="View image fullscreen">
          <span aria-hidden="true">⛶</span> Fullscreen
        </button>
      </div>
    `;

      this.elements.preview.hidden = false;

      // Clean up object URL when image loads
      const img = this.elements.preview.querySelector("img");
      if (img) {
        img.onload = () => {
          URL.revokeObjectURL(url);
          this.previewBlobUrls.delete(url);
          logDebug("Preview blob URL revoked");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          this.previewBlobUrls.delete(url);
          logDebug("Preview blob URL revoked (error)");
        };
      }

      // Bind fullscreen button click handler (Phase 2E)
      const fullscreenBtn = this.elements.preview.querySelector(
        "#imgdesc-fullscreen-btn"
      );
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
          this.showFullscreenImage();
        });
        logDebug("Fullscreen button handler bound");
      }
    },

    /**
     * Clear file and preview with memory cleanup
     */
    clearFile() {
      logDebug("Clearing file with memory cleanup");

      // Clean up blob URLs
      if (this.previewBlobUrls.size > 0) {
        logDebug(`Revoking ${this.previewBlobUrls.size} preview blob URLs`);
        this.previewBlobUrls.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            logDebug("Blob URL cleanup warning:", e.message);
          }
        });
        this.previewBlobUrls.clear();
      }

      // Clean up preview images
      if (this.elements.preview) {
        const previewImages = this.elements.preview.querySelectorAll("img");
        previewImages.forEach((img) => {
          img.src = "";
          img.onload = null;
          img.onerror = null;
        });

        this.elements.preview.innerHTML = "";
        this.elements.preview.hidden = true;
      }

      // Clear file data
      this.currentFile = null;
      this.currentBase64 = null;

      if (this.elements.fileInput) {
        this.elements.fileInput.value = "";
      }

      // Track memory after cleanup
      if (MemoryMonitor) {
        MemoryMonitor.track("ImageDescriber_clearFile", {
          cleaned: true,
        });
      }

      this.updateButtonStates();

      logDebug("File cleared with memory cleanup complete");
    },

    /**
     * Show image in fullscreen view (Phase 2E)
     * Uses Universal Modal if available, falls back gracefully
     */
    showFullscreenImage() {
      logDebug("Opening fullscreen image view");

      // Check if we have image data
      if (!this.currentFile || !this.currentBase64) {
        logWarn("No image data available for fullscreen view");
        if (window.notifyError) {
          window.notifyError("No image available to view");
        }
        return;
      }

      // Build data URL from base64
      const imgSrc = `data:${this.currentFile.type};base64,${this.currentBase64}`;

      // Use extracted alt text if available, otherwise use filename
      const imgAlt =
        this.extractedAltText || `Preview of ${this.currentFile.name}`;
      const fileName = this.currentFile.name;
      const fileSizeKB = (this.currentFile.size / 1024).toFixed(1);

      // Create modal content
      const content = `
    <div class="imgdesc-fullscreen-content">
      <img 
        src="${imgSrc}" 
        alt="Fullscreen view of ${this.escapeHtml(imgAlt)}" 
        class="imgdesc-fullscreen-image"
      />
      <p class="imgdesc-fullscreen-caption">
        ${this.escapeHtml(fileName)} (${fileSizeKB} KB)
      </p>
    </div>
  `;

      // Use Universal Modal if available
      if (window.UniversalModal?.create) {
        try {
          const modal = window.UniversalModal.create({
            title: "Image Preview",
            content: content,
            size: "large",
            className: "imgdesc-fullscreen-modal",
            closeOnEscape: true,
            closeOnOverlayClick: true,
            onOpen: function (modalInstance) {
              // Ensure proper sizing after modal opens
              logDebug("Fullscreen modal opened");
            },
          });

          modal.open();
          logInfo("Fullscreen image modal opened");
        } catch (error) {
          logError("Failed to open fullscreen modal:", error);
          if (window.notifyError) {
            window.notifyError("Failed to open fullscreen view");
          }
        }
      } else {
        // Fallback: inform user
        logWarn("Universal Modal not available");
        if (window.notifyError) {
          window.notifyError("Fullscreen view not available");
        }
      }
    },

    // ========================================================================
    // PROMPT BUILDING
    // ========================================================================

    /**
     * Check if prompts are loaded and ready
     * @returns {boolean}
     */
    arePromptsReady() {
      return !!(
        window.PROMPT_MARKDOWN &&
        window.PROMPT_WRITING_GUIDE &&
        window.PROMPT_IMAGE_DESCRIPTION
      );
    },

    /**
     * Wait for prompts to be loaded
     * @returns {Promise<boolean>}
     */
    async waitForPrompts() {
      // If already loaded, return immediately
      if (this.arePromptsReady()) {
        return true;
      }

      // Wait for the prompt loader
      if (window.ImageDescriberPrompts?.ready) {
        try {
          await window.ImageDescriberPrompts.ready;
          return this.arePromptsReady();
        } catch (error) {
          logError("Prompt loading failed:", error);
          return false;
        }
      }

      logWarn("Prompt loader not available");
      return false;
    },

    /**
     * Build the system prompt from modular prompt files
     * @returns {string} Combined system prompt
     */
    buildSystemPrompt() {
      const parts = [];

      // Add markdown formatting instructions
      if (window.PROMPT_MARKDOWN) {
        parts.push(window.PROMPT_MARKDOWN.trim());
      } else {
        logWarn("PROMPT_MARKDOWN not loaded");
      }

      // Add writing guide
      if (window.PROMPT_WRITING_GUIDE) {
        parts.push(window.PROMPT_WRITING_GUIDE.trim());
      } else {
        logWarn("PROMPT_WRITING_GUIDE not loaded");
      }

      // Add image description instructions
      if (window.PROMPT_IMAGE_DESCRIPTION) {
        parts.push(window.PROMPT_IMAGE_DESCRIPTION.trim());
      } else {
        logWarn("PROMPT_IMAGE_DESCRIPTION not loaded");
      }

      const systemPrompt = parts.join("\n\n---\n\n");

      logDebug("System prompt built", {
        parts: parts.length,
        length: systemPrompt.length,
      });

      return systemPrompt;
    },

    /**
     * Build the user prompt from form data
     * @returns {string} User prompt with context
     */
    buildUserPrompt() {
      const parts = [];

      // Basic context
      parts.push(
        "Please describe the attached image for accessibility purposes."
      );
      parts.push("");

      // Subject area
      const subject = this.elements.subject?.value?.trim();
      if (subject) {
        parts.push(`**Subject Area:** ${subject}`);
      }

      // Specific topic
      const topic = this.elements.topic?.value?.trim();
      if (topic) {
        parts.push(`**Topic:** ${topic}`);
      }

      // Learning objective
      const objective = this.elements.objective?.value?.trim();
      if (objective) {
        parts.push(`**Learning Objective:** ${objective}`);
      }

      // Additional context
      const context = this.elements.context?.value?.trim();
      if (context) {
        parts.push(`**Additional Context:** ${context}`);
      }

      // Module code
      const module = this.elements.module?.value?.trim();
      if (module) {
        parts.push(`**Module:** ${module}`);
      }

      // Audience level (with prompt modifier from config)
      const audienceValue = this.elements.audience?.value;
      if (audienceValue && this.config?.audienceLevels) {
        const audienceConfig = this.config.audienceLevels.find(
          (a) => a.value === audienceValue
        );
        if (audienceConfig?.promptModifier) {
          parts.push("");
          parts.push(audienceConfig.promptModifier);
        }
      }

      // Description style
      const styleRadio = this.elements.styleOptions?.querySelector(
        'input[name="imgdesc-style"]:checked'
      );
      if (styleRadio?.value && this.config?.descriptionStyles) {
        const styleConfig = this.config.descriptionStyles.find(
          (s) => s.value === styleRadio.value
        );
        if (styleConfig) {
          parts.push("");
          parts.push(
            `Please provide a **${styleConfig.label.toLowerCase()}** description.`
          );
        }
      }

      // Checkbox options (with prompt modifiers from config)
      if (this.config?.checkboxOptions) {
        const activeModifiers = [];

        this.config.checkboxOptions.forEach((opt) => {
          const checkbox = document.getElementById(`imgdesc-${opt.id}`);
          if (checkbox?.checked && opt.promptModifier) {
            activeModifiers.push(opt.promptModifier);
          }
        });

        if (activeModifiers.length > 0) {
          parts.push("");
          parts.push("**Additional Instructions:**");
          activeModifiers.forEach((mod) => {
            parts.push(`- ${mod}`);
          });
        }
      }

      const userPrompt = parts.join("\n");

      logDebug("User prompt built", { length: userPrompt.length });

      return userPrompt;
    },

    // ========================================================================
    // PROGRESS MANAGEMENT (Phase 2A)
    // ========================================================================

    /**
     * Show progress indicator and start timer
     * @param {string} stage - Stage key from PROGRESS_STAGES
     */
    showProgress(stage) {
      const config = PROGRESS_STAGES[stage];
      if (!config) {
        logWarn("Unknown progress stage:", stage);
        return;
      }

      this.currentStage = stage;

      // Hide completion time from previous run
      this.hideCompletionTime();

      // Show progress container
      if (this.elements.progress) {
        this.elements.progress.hidden = false;
      }

      // Update stage text with icon
      if (this.elements.progressStage) {
        this.elements.progressStage.innerHTML = `<span aria-hidden="true">${config.icon}</span> ${config.message}`;
      }

      // Update progress bar
      const percentage = this.calculateProgressPercentage(stage);
      this.updateProgressBar(percentage);

      // Start timer if not already running
      if (!this.progressTimer) {
        this.progressStartTime = Date.now();
        this.progressTimer = setInterval(() => this.updateProgressTime(), 1000);
      }

      logDebug("Progress updated:", stage, percentage + "%");
    },

    /**
     * Calculate cumulative progress percentage for a stage
     * @param {string} stage - Current stage key
     * @returns {number} Percentage (0-100)
     */
    calculateProgressPercentage(stage) {
      const stages = Object.keys(PROGRESS_STAGES);
      const currentIndex = stages.indexOf(stage);

      if (currentIndex === -1) return 0;

      let progress = 0;
      for (let i = 0; i <= currentIndex; i++) {
        progress += PROGRESS_STAGES[stages[i]].weight;
      }

      return Math.min(progress, 100);
    },

    /**
     * Update the visual progress bar
     * @param {number} percentage - Percentage complete (0-100)
     */
    updateProgressBar(percentage) {
      if (this.elements.progressFill) {
        this.elements.progressFill.style.width = `${percentage}%`;
      }

      if (this.elements.progressBar) {
        this.elements.progressBar.setAttribute("aria-valuenow", percentage);
      }
    },

    /**
     * Update elapsed time display
     */
    updateProgressTime() {
      if (!this.progressStartTime || !this.elements.progressTime) return;

      const elapsed = Math.floor((Date.now() - this.progressStartTime) / 1000);
      this.elements.progressTime.textContent = `${elapsed}s`;
    },

    /**
     * Get current elapsed time in seconds
     * @returns {number} Elapsed seconds
     */
    getElapsedSeconds() {
      if (!this.progressStartTime) return 0;
      return Math.floor((Date.now() - this.progressStartTime) / 1000);
    },

    /**
     * Format elapsed time for display
     * @param {number} seconds - Elapsed seconds
     * @returns {string} Formatted time string
     */
    formatElapsedTime(seconds) {
      if (seconds < 60) {
        return `${seconds}s`;
      }
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    },

    /**
     * Show completion time after successful generation
     * @param {number} seconds - Total elapsed seconds
     */
    showCompletionTime(seconds) {
      this.lastElapsedTime = seconds;

      if (this.elements.finalTime) {
        this.elements.finalTime.textContent = this.formatElapsedTime(seconds);
      }

      if (this.elements.completionTime) {
        this.elements.completionTime.hidden = false;
      }

      logDebug("Completion time displayed:", this.formatElapsedTime(seconds));
    },

    /**
     * Show configuration UI, hide output (Phase 2B.2)
     * Used when starting fresh or resetting
     */
    showConfigurationUI() {
      logDebug("Showing configuration UI");

      // Remove output mode class from layout for two-column styling
      const layout = document.querySelector(".imgdesc-layout");
      if (layout) {
        layout.classList.remove("imgdesc-output-mode");
      }

      // Show config panel
      if (this.elements.configPanel) {
        this.elements.configPanel.hidden = false;
      }

      // Show upload area
      if (this.elements.uploadArea) {
        this.elements.uploadArea.style.display = "";
      }

      // Show generate button area
      if (this.elements.generateArea) {
        this.elements.generateArea.hidden = false;
      }

      // Show the "Upload Image" heading
      const uploadHeading = document.querySelector(
        ".imgdesc-input-column .imgdesc-section h2"
      );
      if (uploadHeading) {
        uploadHeading.style.display = "";
      }

      // Move preview back to upload section
      const uploadSection = document.querySelector(
        ".imgdesc-input-column .imgdesc-section"
      );
      if (this.elements.preview && uploadSection) {
        // Insert after upload area, before clear button
        const clearBtn = this.elements.clearBtn;
        if (clearBtn) {
          uploadSection.insertBefore(this.elements.preview, clearBtn);
        } else {
          uploadSection.appendChild(this.elements.preview);
        }
        logDebug("Preview moved back to upload section");
      }

      // Hide output section
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "none";
      }

      // Clear status
      if (this.elements.status) {
        this.elements.status.textContent = "";
        this.elements.status.className = "imgdesc-status";
      }
    },
    /**
     * Show output UI, hide configuration (Phase 2B.2)
     * Used during and after generation
     */
    showOutputUI() {
      logDebug("Showing output UI");

      // Add output mode class to layout for single-column styling
      const layout = document.querySelector(".imgdesc-layout");
      if (layout) {
        layout.classList.add("imgdesc-output-mode");
      }

      // Hide config panel
      if (this.elements.configPanel) {
        this.elements.configPanel.hidden = true;
      }

      // Hide upload area (keep preview visible)
      if (this.elements.uploadArea) {
        this.elements.uploadArea.style.display = "none";
      }

      // Hide generate button area
      if (this.elements.generateArea) {
        this.elements.generateArea.hidden = true;
      }

      // Hide the "Upload Image" heading
      const uploadHeading = document.querySelector(
        ".imgdesc-input-column .imgdesc-section h2"
      );
      if (uploadHeading) {
        uploadHeading.style.display = "none";
      }

      // Move preview into output section (before the output div, not inside it)
      if (this.elements.preview && this.elements.output) {
        this.elements.output.parentElement.insertBefore(
          this.elements.preview,
          this.elements.output
        );
        logDebug("Preview moved into output section");
      }

      // Show output section
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "";
      }
    },

    /**
     * Reset the tool for describing a new image (Phase 2B.2)
     */
    resetForNewImage() {
      logInfo("Resetting for new image");

      // Clear file state
      this.currentFile = null;
      this.compressedFile = null;
      this.compressionInfo = null;

      // Clear file input
      if (this.elements.fileInput) {
        this.elements.fileInput.value = "";
      }

      // Clear preview
      if (this.elements.preview) {
        this.elements.preview.innerHTML = "";
      }

      // Hide clear button
      if (this.elements.clearBtn) {
        this.elements.clearBtn.style.display = "none";
      }

      // Clear output
      if (this.elements.output) {
        this.elements.output.innerHTML = "";
      }

      // Clear form fields (optional - you may want to keep context for similar images)
      // Uncomment the following if you want to clear all fields:
      /*
      if (this.elements.subject) this.elements.subject.value = '';
      if (this.elements.topic) this.elements.topic.value = '';
      if (this.elements.objective) this.elements.objective.value = '';
      if (this.elements.context) this.elements.context.value = '';
      if (this.elements.module) this.elements.module.value = '';
      */

      // Hide completion time
      this.hideCompletionTime();

      // Clear debug panel (Phase 2C)
      this.clearDebugPanel();

      // Show configuration UI
      this.showConfigurationUI();

      // Update button states
      this.updateButtonStates();

      // Focus on file input for accessibility
      if (this.elements.fileInput) {
        this.elements.fileInput.focus();
      }

      logInfo("Reset complete - ready for new image");
    },

    /**
     * Hide completion time display
     */
    hideCompletionTime() {
      if (this.elements.completionTime) {
        this.elements.completionTime.hidden = true;
      }
    },

    /**
     * Hide progress indicator and clean up
     * @param {boolean} showFinalTime - Whether to display completion time
     */
    hideProgress(showFinalTime = false) {
      // Capture final elapsed time before clearing
      const finalSeconds = this.getElapsedSeconds();

      // Hide progress container
      if (this.elements.progress) {
        this.elements.progress.hidden = true;
      }

      // Clear timer
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }

      // Show completion time if requested
      if (showFinalTime && finalSeconds > 0) {
        this.showCompletionTime(finalSeconds);
      }

      // Reset state
      this.progressStartTime = null;
      this.currentStage = null;

      // Reset progress bar
      this.updateProgressBar(0);

      logDebug("Progress hidden, showFinalTime:", showFinalTime);
    },

    /**
     * Cancel the current generation
     */
    cancelGeneration() {
      logInfo("Generation cancelled by user");

      // Abort any in-flight request
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      // Hide progress (don't show completion time for cancellation)
      this.hideProgress(false);

      // Reset generating state
      this.isGenerating = false;
      this.updateButtonStates();

      // Show feedback
      this.showStatus("Generation cancelled", "info");

      if (window.notifyInfo) {
        window.notifyInfo("Generation cancelled");
      }

      // Announce to screen reader
      this.announceStatus("Generation cancelled");
    },

    // ========================================================================
    // GENERATION
    // ========================================================================

    /**
     * Check if reduced motion is preferred
     * @returns {boolean}
     */
    prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },

    /**
     * Generate image description
     */
    async generate() {
      if (this.isGenerating) {
        logWarn("Generation already in progress");
        return;
      }

      if (!this.currentFile || !this.currentBase64) {
        this.showError("Please upload an image first.");
        return;
      }

      logInfo("Starting generation...");
      this.isGenerating = true;

      try {
        // Create abort controller for cancellation
        this.abortController = new AbortController();

        // Stage 1: Validating
        this.showProgress("VALIDATING");
        this.updateButtonStates();

        // Wait for prompts to be ready
        const promptsReady = await this.waitForPrompts();
        if (!promptsReady) {
          throw new Error("Prompts failed to load. Please refresh the page.");
        }

        // Stage 2: Compressing (for large files)
        // Note: compression happens inside attachFile(), but we show the stage
        const fileSizeKB = this.currentFile.size / 1024;
        if (fileSizeKB > 200) {
          // Match compression threshold
          this.showProgress("COMPRESSING");
          // Small delay to ensure user sees stage
          await new Promise((r) => setTimeout(r, 100));
        }

        // Stage 3: Preparing
        this.showProgress("PREPARING");

        // Switch to output UI (Phase 2B.2)
        this.showOutputUI();

        // Build prompts
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt();

        logDebug("Prompts ready", {
          systemLength: systemPrompt.length,
          userLength: userPrompt.length,
        });

        // Create or get OpenRouter Embed instance
        const embed = this.getOrCreateEmbed();

        // Update system prompt
        embed.systemPrompt = systemPrompt;

        // Attach the image (compression happens here for large files)
        await embed.attachFile(this.currentFile);

        // Stage 4: Generating
        this.showProgress("GENERATING");

        // Check reduced motion preference
        const useStreaming = !this.prefersReducedMotion();

        // Show output section BEFORE streaming
        this.showOutputSection();

        let response;

        if (useStreaming) {
          logInfo("Using streaming mode");
          response = await embed.sendStreamingRequest({
            userPrompt: userPrompt,
            onChunk: (chunk) => {
              logDebug("Chunk received", { length: chunk.text?.length });
            },
            onComplete: (resp) => {
              logInfo("Streaming complete");
            },
            onError: (error) => {
              logError("Streaming error:", error);
            },
          });
        } else {
          logInfo("Using non-streaming mode (reduced motion)");
          response = await embed.sendRequest(userPrompt);
        }

        // Stage 5: Finalising
        this.showProgress("FINALISING");

        // Store raw markdown for plain text copying (preserves original markdown with H1)
        this.lastRawOutput = response.text;

        // Store original HTML before heading adjustment (Phase 2B.3)
        // This preserves H1 headings for Copy Formatted and Copy HTML
        this.lastRawHTML = this.elements.output.innerHTML;

        // Adjust heading levels in rendered output for accessibility (Phase 2B.3)
        // This shifts all headings down by 2 (H1→H3, H2→H4, etc.) in the displayed HTML
        // to maintain proper hierarchy after the H2 "Generated Description" heading
        this.adjustHeadingLevels(this.elements.output);

        // Extract and apply alt text to images (Phase 2E)
        this.extractAndApplyAltText();

        // Brief delay to show final stage
        await new Promise((r) => setTimeout(r, 200));

        // Get final elapsed time before hiding progress
        const finalTime = this.getElapsedSeconds();

        // Hide progress and show completion time
        this.hideProgress(true); // true = show completion time

        // Show success status with time
        this.showStatus(
          `Description generated successfully in ${this.formatElapsedTime(
            finalTime
          )}!`,
          "success"
        );

        // Announce to screen reader
        this.announceStatus(
          `Image description generated successfully in ${this.formatElapsedTime(
            finalTime
          )}`
        );

        logInfo("Generation complete in", this.formatElapsedTime(finalTime));

        // Update debug panel with generation details (Phase 2C)
        this.updateDebugPanel({
          model: CONTROLLER_CONFIG.model,
          temperature: CONTROLLER_CONFIG.temperature,
          maxTokens: CONTROLLER_CONFIG.maxTokens,
          systemPrompt: systemPrompt,
          userPrompt: userPrompt,
          useStreaming: useStreaming,
          compression: embed.currentFileAnalysis?.compressionMetrics,
          response: response,
          estimatedCost: this.calculateEstimatedCost(response),
        });
      } catch (error) {
        // Hide progress on error (don't show completion time)
        this.hideProgress(false);

        // Check if it was a cancellation
        if (error.name === "AbortError") {
          logInfo("Generation was cancelled");
          return;
        }

        logError("Generation failed:", error);
        this.showError(`Generation failed: ${error.message}`);
        this.showStatus("Generation failed", "error");
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.updateButtonStates();
      }
    },

    /**
     * Get or create OpenRouter Embed instance
     * @returns {OpenRouterEmbed}
     */
    getOrCreateEmbed() {
      if (this.embedInstance) {
        return this.embedInstance;
      }

      if (!window.OpenRouterEmbed) {
        throw new Error(
          "OpenRouterEmbed not available. Ensure embed scripts are loaded."
        );
      }

      logInfo("Creating OpenRouter Embed instance with compression...");

      this.embedInstance = new window.OpenRouterEmbed({
        containerId: "imgdesc-output",
        model: CONTROLLER_CONFIG.model,
        temperature: CONTROLLER_CONFIG.temperature,
        max_tokens: CONTROLLER_CONFIG.maxTokens,
        showNotifications: true,
        showStreamingProgress: false, // Disabled - we have Phase 2A progress indicator
        progressStyle: "minimal", // Minimal style as fallback

        // 🆕 COMPRESSION CONFIGURATION
        // Based on performance testing: 92.17 ms/KB latency
        // Enable automatic image compression for optimal performance
        enableCompression: true,
        compressionThreshold: 200 * 1024, // 200KB (images below this perform acceptably)
        compressionMaxWidth: 1200, // Max dimensions for AI analysis
        compressionMaxHeight: 900,
        compressionQuality: 0.7, // 70% JPEG quality (optimal from testing)
      });

      logInfo("OpenRouter Embed instance created with compression enabled");

      return this.embedInstance;
    },

    // ========================================================================
    // OUTPUT DISPLAY
    // ========================================================================

    /**
     * Show the output section
     */
    showOutputSection() {
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "";
        this.elements.outputSection.hidden = false;
      }
    },

    /**
     * Hide the output section
     */
    hideOutputSection() {
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "none";
        this.elements.outputSection.hidden = true;
      }
    },

    /**
     * Adjust heading levels in rendered output (Phase 2B.3)
     * Shifts all headings down by TWO levels (h1→h3, h2→h4, etc.)
     * This ensures proper heading hierarchy after the H2 "Generated Description" section heading
     * Does NOT affect the raw markdown/HTML stored for clipboard
     * @param {HTMLElement} container - The container with rendered content
     */
    adjustHeadingLevels(container) {
      if (!container) {
        logWarn("No container provided for heading adjustment");
        return;
      }

      // Process in reverse order (h4→h6 first) to avoid double-shifting
      for (let level = 4; level >= 1; level--) {
        const headings = container.querySelectorAll(`h${level}`);
        headings.forEach((heading) => {
          const newLevel = Math.min(level + 2, 6); // Shift by 2, cap at h6
          const newHeading = document.createElement(`h${newLevel}`);

          // Copy all attributes
          Array.from(heading.attributes).forEach((attr) => {
            newHeading.setAttribute(attr.name, attr.value);
          });

          // Copy content
          newHeading.innerHTML = heading.innerHTML;

          // Replace original
          heading.replaceWith(newHeading);
        });
      }

      logDebug("Heading levels adjusted for accessibility (shifted by 2)");
    },

    /**
     * Extract alt text from generated description (Phase 2E)
     * Looks for <h4>Alt Text</h4> and extracts the following text
     */
    extractAndApplyAltText() {
      if (!this.elements.output) {
        logDebug("No output element to extract alt text from");
        return;
      }

      try {
        // Find the "Alt Text" heading (H4 after adjustment)
        const headings = this.elements.output.querySelectorAll("h4");
        let altTextHeading = null;

        for (const heading of headings) {
          if (heading.textContent.trim() === "Alt Text") {
            altTextHeading = heading;
            break;
          }
        }

        if (!altTextHeading) {
          logDebug("No 'Alt Text' heading found in output");
          return;
        }

        // Extract text after the heading until next heading or end
        let altText = "";
        let currentNode = altTextHeading.nextElementSibling;

        while (currentNode) {
          // Stop at next heading
          if (currentNode.tagName.match(/^H[1-6]$/)) {
            break;
          }

          // Accumulate text content
          const text = currentNode.textContent.trim();
          if (text) {
            altText += (altText ? " " : "") + text;
          }

          currentNode = currentNode.nextElementSibling;
        }

        if (!altText) {
          logDebug("No alt text content found after 'Alt Text' heading");
          return;
        }

        // Clean up the alt text
        altText = altText.trim();

        // Store for later use
        this.extractedAltText = altText;

        // Update preview image alt text
        const previewImg = this.elements.preview?.querySelector("img");
        if (previewImg) {
          previewImg.alt = altText;
          logInfo("Preview image alt text updated");
        }

        // Update fullscreen button for accessibility
        const fullscreenBtn = this.elements.preview?.querySelector(
          "#imgdesc-fullscreen-btn"
        );
        if (fullscreenBtn) {
          fullscreenBtn.setAttribute(
            "aria-label",
            `View image fullscreen. Image description: ${altText.substring(
              0,
              100
            )}${altText.length > 100 ? "..." : ""}`
          );
        }

        logInfo(
          "Alt text extracted and applied:",
          altText.substring(0, 50) + "..."
        );
      } catch (error) {
        logError("Failed to extract alt text:", error);
      }
    },

    /**
     * Copy output to clipboard (Phase 2B.3 - updated)
     * Copies the original markdown with original heading structure
     */
    async copyToClipboard() {
      if (!this.lastRawOutput) {
        this.showError("No content to copy");
        return;
      }

      try {
        await navigator.clipboard.writeText(this.lastRawOutput);

        // Show success feedback
        this.showCopyFeedback("imgdesc-copy", "Text copied!");

        logInfo("Plain text copied to clipboard");
      } catch (error) {
        logError("Copy failed:", error);
        this.showError("Failed to copy to clipboard");
      }
    },

    /**
     * Copy formatted text to clipboard (Phase 2B.3)
     * Preserves bold, headings, lists when pasted into Word/Google Docs
     * Uses original HTML (with H1 headings) for standalone context
     */
    async copyFormattedText() {
      if (!this.lastRawHTML && !this.elements.output) {
        this.showError("No content to copy");
        return;
      }

      try {
        // Use original HTML (before heading adjustment) so H1 is preserved
        const html = this.lastRawHTML || this.elements.output.innerHTML;

        // Also create plain text fallback
        const text = this.lastRawOutput || this.elements.output.innerText;

        // Create blobs for both formats
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([text], { type: "text/plain" });

        // Write both formats to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);

        this.showCopyFeedback(
          "imgdesc-copy-formatted",
          "Formatted text copied!"
        );
        logInfo(
          "Formatted text copied to clipboard (with original H1 headings)"
        );
      } catch (error) {
        logError("Failed to copy formatted text:", error);
        // Fallback to plain text if ClipboardItem not supported
        try {
          await navigator.clipboard.writeText(
            this.lastRawOutput || this.elements.output.innerText
          );
          this.showCopyFeedback(
            "imgdesc-copy-formatted",
            "Text copied (plain)"
          );
          logWarn("ClipboardItem not supported, fell back to plain text");
        } catch (fallbackError) {
          this.showError("Failed to copy");
        }
      }
    },

    /**
     * Copy HTML source to clipboard (Phase 2B.3)
     * For pasting into web pages, CMS, code editors, etc.
     * Uses original HTML (with H1 headings) for standalone context
     */
    async copyAsHTML() {
      if (!this.lastRawHTML && !this.elements.output) {
        this.showError("No content to copy");
        return;
      }

      try {
        // Use original HTML (before heading adjustment) so H1 is preserved
        const html = this.lastRawHTML || this.elements.output.innerHTML;

        // Copy as plain text (the HTML source code itself)
        await navigator.clipboard.writeText(html);

        this.showCopyFeedback("imgdesc-copy-html", "HTML copied!");
        logInfo("HTML source copied to clipboard (with original H1 headings)");
      } catch (error) {
        logError("Failed to copy HTML:", error);
        this.showError("Failed to copy HTML");
      }
    },

    /**
     * Show visual feedback on copy button (Phase 2B.3)
     * @param {string} buttonId - ID of the button to show feedback on
     * @param {string} message - Success message
     */
    showCopyFeedback(buttonId, message) {
      const button = document.getElementById(buttonId);
      if (!button) return;

      const originalHTML = button.innerHTML;
      button.innerHTML = `<span aria-hidden="true">✓</span> ${message}`;
      button.classList.add("imgdesc-copy-success");

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove("imgdesc-copy-success");
      }, 2000);

      // Also show notification for better feedback
      if (window.notifySuccess) {
        window.notifySuccess(message);
      }

      logDebug("Copy feedback shown:", message);
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

      // Generate button
      if (this.elements.generateBtn) {
        this.elements.generateBtn.disabled = !hasFile || this.isGenerating;
      }

      // Clear button
      if (this.elements.clearBtn) {
        this.elements.clearBtn.hidden = !hasFile;
      }

      // Copy button
      if (this.elements.copyBtn) {
        this.elements.copyBtn.disabled = !hasOutput || this.isGenerating;
      }

      // Regenerate button
      if (this.elements.regenerateBtn) {
        this.elements.regenerateBtn.disabled = !hasFile || this.isGenerating;
      }

      logDebug("Button states updated", {
        hasFile,
        hasOutput,
        isGenerating: this.isGenerating,
      });
    },

    // ========================================================================
    // CLEAR / RESET
    // ========================================================================

    /**
     * Clear all state and reset form with memory cleanup
     */
    clear() {
      logInfo("Clearing state with memory cleanup...");

      // Track memory before cleanup
      if (MemoryMonitor) {
        MemoryMonitor.track("ImageDescriber_clear_start", {
          hadFile: !!this.currentFile,
          hadOutput: !!this.lastRawOutput,
        });
      }

      // Clear file (includes memory cleanup)
      this.clearFile();

      // Clear output
      this.lastRawOutput = null;
      this.lastRawHTML = null;
      if (this.elements.output) {
        this.elements.output.innerHTML = "";
      }
      this.hideOutputSection();

      // Hide status
      this.hideStatus();

      // Clear debug panel (Phase 2C)
      this.clearDebugPanel();

      // Update button states
      this.updateButtonStates();

      // Announce to screen reader
      this.announceStatus("Form cleared");

      // Track memory after cleanup
      if (MemoryMonitor) {
        MemoryMonitor.track("ImageDescriber_clear_complete", {
          cleaned: true,
        });
      }

      // Suggest garbage collection
      if (window.gc) {
        window.gc();
        logDebug("Garbage collection suggested");
      }

      logInfo("State cleared with memory cleanup complete");
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

    // ========================================================================
    // DEBUG PANEL METHODS (Phase 2C)
    // ========================================================================

    /**
     * Calculate estimated cost based on token usage (Phase 2C)
     * @param {Object} response - API response with token metadata
     * @returns {string} Formatted cost estimate
     */
    calculateEstimatedCost(response) {
      if (!response?.metadata?.tokens) {
        return "Not available";
      }

      const tokens = response.metadata.tokens;
      // Handle both streaming and non-streaming token structures
      const promptTokens = tokens.prompt || tokens.prompt_tokens || 0;
      const completionTokens =
        tokens.completion || tokens.completion_tokens || 0;

      // Claude Haiku 4.5 pricing (as of Nov 2025)
      // Input: $0.80 per million tokens
      // Output: $4.00 per million tokens
      const inputCostPerMillion = 0.8;
      const outputCostPerMillion = 4.0;

      const inputCost = (promptTokens / 1000000) * inputCostPerMillion;
      const outputCost = (completionTokens / 1000000) * outputCostPerMillion;
      const totalCost = inputCost + outputCost;

      // Format in appropriate currency
      if (totalCost < 0.01) {
        return `< $0.01 (${(totalCost * 100).toFixed(4)}¢)`;
      } else {
        return `$${totalCost.toFixed(4)}`;
      }
    },

    /**
     * Update debug panel with generation data (Phase 2C)
     * @param {Object} data - Debug data object
     */
    updateDebugPanel(data) {
      if (!this.elements.debugElements) {
        logWarn("Debug elements not cached");
        return;
      }

      const d = this.elements.debugElements;

      // Helper to safely set text content
      const setText = (el, val) => {
        if (el) el.textContent = val || "-";
      };

      // Request details
      setText(d.model, data.model || CONTROLLER_CONFIG.model);
      setText(d.temperature, data.temperature || CONTROLLER_CONFIG.temperature);
      setText(d.maxTokens, data.maxTokens || CONTROLLER_CONFIG.maxTokens);
      setText(
        d.systemLength,
        data.systemPrompt ? `${data.systemPrompt.length} chars` : "-"
      );
      setText(
        d.userLength,
        data.userPrompt ? `${data.userPrompt.length} chars` : "-"
      );
      setText(d.streaming, data.useStreaming ? "Yes" : "No (reduced motion)");

      // File details
      if (this.currentFile) {
        setText(d.filename, this.currentFile.name);

        // Always show original size
        setText(
          d.originalSize,
          `${(this.currentFile.size / 1024).toFixed(1)} KB`
        );
      }

      // Compression details (only if file was compressed)
      if (data.compression) {
        const c = data.compression;

        setText(
          d.compressedSize,
          c.compressedSize ? `${(c.compressedSize / 1024).toFixed(1)} KB` : "-"
        );
        setText(d.compressionSavings, c.savings ? `${c.savings}%` : "-");

        if (c.formatConversion) {
          setText(
            d.format,
            `${c.formatConversion.from} → ${c.formatConversion.to}`
          );
        }

        if (c.dimensions?.original && c.dimensions?.compressed) {
          setText(
            d.dimensionsOriginal,
            `${c.dimensions.original.width}×${c.dimensions.original.height}`
          );
          setText(
            d.dimensionsCompressed,
            `${c.dimensions.compressed.width}×${c.dimensions.compressed.height}`
          );
        }
      } else if (this.currentFile) {
        // No compression (file too small) - show that explicitly
        setText(
          d.compressedSize,
          `${(this.currentFile.size / 1024).toFixed(1)} KB (not compressed)`
        );
        setText(d.compressionSavings, "0% (not needed)");
        setText(d.format, "No conversion");

        // Try to get dimensions if it's an image
        if (this.currentFile.type.startsWith("image/")) {
          // Note: Dimensions would require reading the image
          // For now, indicate they're the same as original
          setText(d.dimensionsOriginal, "Same as uploaded");
          setText(d.dimensionsCompressed, "Same as uploaded");
        }
      }

      // Response details
      if (data.response) {
        const r = data.response;

        // Handle both streaming and non-streaming token structures
        // Try multiple possible locations for token data
        const tokens = r.metadata?.tokens || r.raw?.usage || {};

        // Prompt tokens (with fallback to estimate)
        const promptTokens = tokens.prompt || tokens.prompt_tokens;
        if (promptTokens) {
          setText(d.promptTokens, Math.round(promptTokens));
        } else if (data.systemPrompt && data.userPrompt) {
          // Estimate if not provided: ~0.25 tokens per character
          const estimate = Math.round(
            (data.systemPrompt.length + data.userPrompt.length) * 0.25
          );
          setText(d.promptTokens, `~${estimate} (estimated)`);
        } else {
          setText(d.promptTokens, "-");
        }

        // Completion tokens
        const completionTokens = tokens.completion || tokens.completion_tokens;
        if (completionTokens) {
          setText(d.completionTokens, Math.round(completionTokens));
        } else if (r.text) {
          // Estimate if not provided
          const estimate = Math.round(r.text.length * 0.25);
          setText(d.completionTokens, `~${estimate} (estimated)`);
        } else {
          setText(d.completionTokens, "-");
        }

        // Total tokens - always calculate from individual values for accuracy
        // (API sometimes returns incomplete token data)
        let totalCalculated = 0;
        let hasIndividualValues = false;

        if (promptTokens) {
          totalCalculated += promptTokens;
          hasIndividualValues = true;
        } else if (data.systemPrompt && data.userPrompt) {
          totalCalculated += Math.round(
            (data.systemPrompt.length + data.userPrompt.length) * 0.25
          );
          hasIndividualValues = true;
        }

        if (completionTokens) {
          totalCalculated += completionTokens;
          hasIndividualValues = true;
        } else if (r.text) {
          totalCalculated += Math.round(r.text.length * 0.25);
          hasIndividualValues = true;
        }

        if (hasIndividualValues) {
          // Use calculated total (more reliable than API's total)
          const hasEstimates = !promptTokens || !completionTokens;
          if (hasEstimates) {
            setText(
              d.totalTokens,
              `~${Math.round(totalCalculated)} (estimated)`
            );
          } else {
            setText(d.totalTokens, Math.round(totalCalculated));
          }
        } else {
          // Fallback to API's total if no individual values
          const apiTotal = tokens.total || tokens.total_tokens;
          setText(d.totalTokens, apiTotal ? Math.round(apiTotal) : "-");
        }

        setText(d.responseLength, r.text ? `${r.text.length} chars` : "-");

        // Use Phase 2A timing if available
        if (this.lastElapsedTime) {
          setText(
            d.processingTime,
            this.formatElapsedTime(this.lastElapsedTime)
          );
        } else if (r.metadata?.processingTime) {
          setText(d.processingTime, `${r.metadata.processingTime}ms`);
        }

        setText(d.cost, data.estimatedCost || "Not available");
      }
      // Context applied
      setText(d.subject, this.elements.subject?.value || "Not specified");
      setText(d.topic, this.elements.topic?.value || "Not specified");
      setText(d.objective, this.elements.objective?.value || "Not specified");
      setText(d.module, this.elements.module?.value || "Not specified");

      // Description style
      const styleRadio = this.elements.styleOptions?.querySelector(
        'input[name="imgdesc-style"]:checked'
      );
      setText(
        d.style,
        styleRadio?.nextElementSibling?.textContent || "Not specified"
      );

      // Audience level
      const audienceRadio = this.elements.styleOptions?.querySelector(
        'input[name="imgdesc-audience"]:checked'
      );
      setText(
        d.audience,
        audienceRadio?.nextElementSibling?.textContent || "Not specified"
      );

      // Checkbox options
      const checkboxes = this.elements.checkboxOptions?.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      if (checkboxes && checkboxes.length > 0) {
        const labels = Array.from(checkboxes).map(
          (cb) => cb.nextElementSibling?.textContent || cb.value
        );
        setText(d.checkboxes, labels.join(", "));
      } else {
        setText(d.checkboxes, "None selected");
      }

      // Full prompts
      if (data.systemPrompt) {
        setText(d.systemPrompt, data.systemPrompt);
        setText(d.systemCharCount, data.systemPrompt.length);
      }

      if (data.userPrompt) {
        setText(d.userPrompt, data.userPrompt);
        setText(d.userCharCount, data.userPrompt.length);
      }

      logDebug("Debug panel updated");
    },

    /**
     * Clear debug panel (Phase 2C)
     */
    clearDebugPanel() {
      if (!this.elements.debugElements) return;

      const d = this.elements.debugElements;

      // Reset all fields to '-'
      Object.values(d).forEach((el) => {
        if (el && el.textContent !== undefined) {
          el.textContent = "-";
        }
      });

      // Reset character counts
      if (d.systemCharCount) d.systemCharCount.textContent = "0";
      if (d.userCharCount) d.userCharCount.textContent = "0";

      logDebug("Debug panel cleared");
    },

    /**
     * Copy debug content to clipboard (Phase 2C)
     * @param {HTMLElement} targetElement - Element containing text to copy
     * @param {HTMLButtonElement} button - Button that was clicked
     */
    async copyDebugContent(targetElement, button) {
      if (!targetElement) return;

      try {
        const text = targetElement.textContent;
        await navigator.clipboard.writeText(text);

        // Show success feedback
        const originalText = button.innerHTML;
        button.innerHTML = '<span aria-hidden="true">✓</span> Copied!';

        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);

        logInfo("Debug content copied to clipboard");
      } catch (error) {
        logError("Failed to copy debug content:", error);
        if (window.notifyError) {
          window.notifyError("Failed to copy debug content");
        }
      }
    },
  };

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

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
    "Image Describer Controller loaded (call initImageDescriber() to initialise)"
  );
})();
