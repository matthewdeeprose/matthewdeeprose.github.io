/**
 * OpenRouter Embed API - Progress Indicators Module (Stage 5 Phase 2)
 *
 * Provides visual progress tracking for streaming requests with:
 * - Real-time chunk counting (chunks mode)
 * - Weighted progress stages (stages mode) with icons and messages
 * - Token estimation
 * - Elapsed time tracking with formatted output
 * - Optional progress bar with ARIA attributes
 * - Completion time display
 * - Configurable positioning and styling
 * - Full WCAG 2.2 AA accessibility
 *
 * @version 2.0.0 (Stage 5 Phase 2)
 * @date 29 November 2025
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
      console.error(`[EmbedProgress] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedProgress] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedProgress] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedProgress] ${message}`, ...args);
  }

  // ============================================================================
  // DEFAULT PROGRESS STAGES (Phase 2)
  // ============================================================================

  const DEFAULT_PROGRESS_STAGES = {
    VALIDATING: { message: "Validating...", icon: "🔍", weight: 5 },
    PREPARING: { message: "Preparing request...", icon: "📤", weight: 10 },
    GENERATING: { message: "Generating response...", icon: "✨", weight: 80 },
    FINALISING: { message: "Finalising...", icon: "✅", weight: 5 },
  };
  // ============================================================================
  // PROGRESS INDICATOR CLASS
  // ============================================================================

  class EmbedProgressIndicator {
    /**
     * Create progress indicator
     *
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element for progress display
     * @param {string} [options.position='top'] - Position: 'top', 'bottom', 'inline'
     * @param {string} [options.style='detailed'] - Style: 'minimal', 'detailed'
     * @param {boolean} [options.enabled=true] - Whether progress is enabled
     * @param {boolean} [options.showTokens=true] - Show token estimation
     * @param {boolean} [options.showTime=true] - Show elapsed time
     * @param {boolean} [options.showChunks=true] - Show chunk count
     * @param {number} [options.avgCharsPerToken=4] - Average characters per token for estimation
     * @param {string} [options.progressMode='chunks'] - Mode: 'chunks' or 'stages'
     * @param {Object} [options.progressStages] - Custom stage definitions (stages mode)
     * @param {boolean} [options.showProgressBar=false] - Show visual progress bar (stages mode)
     * @param {boolean} [options.showCompletionTime=true] - Show final elapsed time
     * @param {boolean} [options.showStageIcon=true] - Show emoji icons in stages mode
     */
    constructor(options = {}) {
      this.container = options.container;
      this.position = options.position || "top";
      this.style = options.style || "detailed";
      this.enabled = options.enabled !== false;
      this.showTokens = options.showTokens !== false;
      this.showTime = options.showTime !== false;
      this.showChunks = options.showChunks !== false;
      this.avgCharsPerToken = options.avgCharsPerToken || 4;

      // Phase 2: Stages mode configuration
      this.progressMode = options.progressMode || "chunks";
      this.progressStages = options.progressStages || {
        ...DEFAULT_PROGRESS_STAGES,
      };
      this.showProgressBar = options.showProgressBar === true;
      this.showCompletionTime = options.showCompletionTime !== false;
      this.showStageIcon = options.showStageIcon !== false;

      // Tracking state (chunks mode)
      this.isActive = false;
      this.startTime = null;
      this.chunksReceived = 0;
      this.totalCharacters = 0;
      this.lastUpdateTime = null;
      this.updateInterval = 100; // Update every 100ms minimum

      // Phase 2: Stages mode tracking
      this.currentStage = null;
      this.stageOrder = Object.keys(this.progressStages);
      this.completedStages = [];

      // DOM elements
      this.progressElement = null;
      this.liveRegion = null;
      this.progressBarElement = null;
      this.completionTimeElement = null;

      logInfo("Progress indicator initialised", {
        enabled: this.enabled,
        position: this.position,
        style: this.style,
        progressMode: this.progressMode,
      });
    }

    /**
     * Start progress tracking
     *
     * @returns {void}
     */
    start() {
      if (!this.enabled) {
        logDebug("Progress indicator disabled, skipping start");
        return;
      }

      if (this.isActive) {
        logWarn("Progress indicator already active");
        return;
      }

      logInfo("Starting progress indicator", { mode: this.progressMode });

      // Reset tracking state (chunks mode)
      this.isActive = true;
      this.startTime = Date.now();
      this.chunksReceived = 0;
      this.totalCharacters = 0;
      this.lastUpdateTime = Date.now();

      // Reset stages mode state
      this.currentStage = null;
      this.completedStages = [];

      // Create progress UI
      this.createProgressUI();

      // Initial display
      this.updateDisplay();
    }

    /**
     * Update progress with new chunk data
     *
     * @param {Object} data - Chunk data
     * @param {string} data.text - Chunk text
     * @param {string} data.fullText - Full accumulated text
     */
    update(data) {
      if (!this.enabled || !this.isActive) {
        return;
      }

      // Update tracking
      this.chunksReceived++;
      this.totalCharacters = data.fullText?.length || 0;

      // Throttle updates (only update every 100ms minimum)
      const now = Date.now();
      if (now - this.lastUpdateTime < this.updateInterval) {
        return;
      }
      this.lastUpdateTime = now;

      logDebug("Updating progress", {
        chunks: this.chunksReceived,
        chars: this.totalCharacters,
      });

      // Update display
      this.updateDisplay();
    }

    /**
     * Complete progress tracking
     *
     * @param {Object} [finalData] - Final data
     */
    complete(finalData = {}) {
      if (!this.enabled || !this.isActive) {
        return;
      }

      logInfo("Completing progress indicator", {
        chunks: this.chunksReceived,
        duration: Date.now() - this.startTime,
      });

      // Final update
      this.updateDisplay(true);

      // Cleanup after brief delay
      setTimeout(() => {
        this.cleanup();
      }, 1000);
    }

    /**
     * Cancel/cleanup progress tracking
     */
    cleanup() {
      if (!this.isActive) {
        return;
      }

      logDebug("Cleaning up progress indicator");

      // Remove UI elements
      if (this.progressElement) {
        this.progressElement.remove();
        this.progressElement = null;
      }

      if (this.liveRegion) {
        this.liveRegion.remove();
        this.liveRegion = null;
      }

      if (this.progressBarElement) {
        this.progressBarElement.remove();
        this.progressBarElement = null;
      }

      if (this.completionTimeElement) {
        this.completionTimeElement.remove();
        this.completionTimeElement = null;
      }

      // Reset chunks mode state
      this.isActive = false;
      this.startTime = null;
      this.chunksReceived = 0;
      this.totalCharacters = 0;

      // Reset stages mode state
      this.currentStage = null;
      this.completedStages = [];
    }

    /**
     * Create progress UI elements
     *
     * @private
     */
    createProgressUI() {
      if (!this.container) {
        logWarn("No container available for progress UI");
        return;
      }

      // Create progress container
      this.progressElement = document.createElement("div");
      this.progressElement.id = "embed-progress-indicator"; // Add ID for querySelector
      this.progressElement.className = "embed-progress-indicator";
      this.progressElement.setAttribute("role", "status");
      this.progressElement.setAttribute("aria-live", "polite");
      this.progressElement.setAttribute("aria-atomic", "true");

      // Apply styling based on style preference
      this.applyProgressStyling();

      // Position the progress indicator
      this.positionProgressUI();

      // Create ARIA live region for screen reader updates (separate from visual)
      this.liveRegion = document.createElement("div");
      this.liveRegion.className = "embed-progress-live-region";
      this.liveRegion.setAttribute("role", "status");
      this.liveRegion.setAttribute("aria-live", "polite");
      this.liveRegion.setAttribute("aria-atomic", "true");
      this.liveRegion.style.cssText =
        "position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;";

      document.body.appendChild(this.liveRegion);

      logDebug("Progress UI created");
    }

    /**
     * Apply styling to progress element
     *
     * @private
     */
    applyProgressStyling() {
      // Base styles (always applied)
      const baseStyles = `
        padding: 0.75rem 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 0.5rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 0.875rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
      `;

      // Minimal style
      if (this.style === "minimal") {
        this.progressElement.style.cssText =
          baseStyles +
          `
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
        `;
      }
      // Detailed style (default)
      else {
        this.progressElement.style.cssText =
          baseStyles +
          `
          min-width: 300px;
          line-height: 1.5;
        `;
      }
    }

    /**
     * Position progress UI based on position setting
     *
     * @private
     */
    positionProgressUI() {
      const container = this.container;

      switch (this.position) {
        case "top":
          this.progressElement.style.cssText += `
            margin-bottom: 1rem;
          `;
          container.insertBefore(this.progressElement, container.firstChild);
          break;

        case "bottom":
          this.progressElement.style.cssText += `
            margin-top: 1rem;
          `;
          container.appendChild(this.progressElement);
          break;

        case "inline":
        default:
          // Inline - just prepend to container
          container.insertBefore(this.progressElement, container.firstChild);
          break;
      }
    }

    /**
     * Update progress display
     *
     * @param {boolean} [isComplete=false] - Whether this is the final update
     * @private
     */
    updateDisplay(isComplete = false) {
      if (!this.progressElement) {
        return;
      }

      // Stages mode display
      if (this.progressMode === "stages") {
        this.updateStagesDisplay(isComplete);
        return;
      }

      // Chunks mode display (existing behaviour)
      const elapsedTime = this.getElapsedTime();
      const estimatedTokens = this.getEstimatedTokens();

      // Build display content
      let content = "";
      let screenReaderText = "";

      if (isComplete) {
        content = this.buildCompleteContent(elapsedTime, estimatedTokens);
        screenReaderText = `Streaming complete. ${this.chunksReceived} chunks received in ${elapsedTime}.`;
      } else {
        content = this.buildStreamingContent(elapsedTime, estimatedTokens);
        screenReaderText = `Streaming in progress. ${this.chunksReceived} chunks received.`;
      }

      // Update visual display
      this.progressElement.innerHTML = content;

      // Update screen reader (throttled to avoid spam)
      if (this.liveRegion && this.chunksReceived % 5 === 0) {
        this.liveRegion.textContent = screenReaderText;
      }
    }

    /**
     * Build streaming content display
     *
     * @param {string} elapsedTime - Formatted elapsed time
     * @param {number} estimatedTokens - Estimated token count
     * @returns {string} HTML content
     * @private
     */
    buildStreamingContent(elapsedTime, estimatedTokens) {
      if (this.style === "minimal") {
        return `
          <span aria-hidden="true">🌊</span>
          <strong>Streaming...</strong>
          ${this.showChunks ? `${this.chunksReceived} chunks` : ""}
          ${this.showTime ? `· ${elapsedTime}` : ""}
        `;
      }
      // Detailed style
      let content = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span aria-hidden="true" style="font-size: 1.25rem;">🌊</span>
          <strong>Streaming response...</strong>
        </div>
      `;

      const details = [];
      if (this.showChunks) {
        details.push(`<strong>${this.chunksReceived}</strong> chunks received`);
      }
      if (this.showTokens) {
        details.push(`~<strong>${estimatedTokens}</strong> tokens estimated`);
      }
      if (this.showTime) {
        details.push(`<strong>${elapsedTime}</strong> elapsed`);
      }

      if (details.length > 0) {
        content += `
          <div style="font-size: 0.8125rem; opacity: 0.9; margin-top: 0.25rem;">
            ${details.join(" · ")}
          </div>
        `;
      }

      return content;
    }

    /**
     * Build complete content display
     *
     * @param {string} elapsedTime - Formatted elapsed time
     * @param {number} estimatedTokens - Estimated token count
     * @returns {string} HTML content
     * @private
     */
    buildCompleteContent(elapsedTime, estimatedTokens) {
      if (this.style === "minimal") {
        return `
          <span aria-hidden="true">✅</span>
          <strong>Complete!</strong>
          ${this.showChunks ? `${this.chunksReceived} chunks` : ""}
          ${this.showTime ? `· ${elapsedTime}` : ""}
        `;
      }

      // Detailed style with success gradient
      this.progressElement.style.background =
        "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";

      let content = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span aria-hidden="true" style="font-size: 1.25rem;">✅</span>
          <strong>Streaming complete!</strong>
        </div>
      `;

      const details = [];
      if (this.showChunks) {
        details.push(
          `<strong>${this.chunksReceived}</strong> chunks processed`
        );
      }
      if (this.showTokens) {
        details.push(`~<strong>${estimatedTokens}</strong> tokens`);
      }
      if (this.showTime) {
        details.push(`Completed in <strong>${elapsedTime}</strong>`);
      }

      if (details.length > 0) {
        content += `
          <div style="font-size: 0.8125rem; opacity: 0.9; margin-top: 0.25rem;">
            ${details.join(" · ")}
          </div>
        `;
      }

      return content;
    }

    /**
     * Get elapsed time formatted
     *
     * @returns {string} Formatted elapsed time
     * @private
     */
    getElapsedTime() {
      if (!this.startTime) return "0.0s";

      const elapsed = Date.now() - this.startTime;
      const seconds = (elapsed / 1000).toFixed(1);

      return `${seconds}s`;
    }

    /**
     * Get estimated token count
     *
     * @returns {number} Estimated tokens
     * @private
     */
    getEstimatedTokens() {
      if (this.totalCharacters === 0) return 0;

      return Math.ceil(this.totalCharacters / this.avgCharsPerToken);
    }

    /**
     * Get current progress data
     *
     * @returns {Object} Progress data
     */
    getProgressData() {
      return {
        isActive: this.isActive,
        chunksReceived: this.chunksReceived,
        totalCharacters: this.totalCharacters,
        elapsedTime: this.startTime ? Date.now() - this.startTime : 0,
        estimatedTokens: this.getEstimatedTokens(),
        startTime: this.startTime,
      };
    }

    /**
     * Update configuration
     *
     * @param {Object} options - New configuration options
     */
    updateConfig(options = {}) {
      logDebug("Updating progress indicator configuration", options);

      // Chunks mode options
      if (options.enabled !== undefined) this.enabled = options.enabled;
      if (options.position) this.position = options.position;
      if (options.style) this.style = options.style;
      if (options.showTokens !== undefined)
        this.showTokens = options.showTokens;
      if (options.showTime !== undefined) this.showTime = options.showTime;
      if (options.showChunks !== undefined)
        this.showChunks = options.showChunks;

      // Stages mode options (Phase 2)
      if (options.progressMode) {
        this.progressMode = options.progressMode;
      }
      if (options.progressStages) {
        this.progressStages = options.progressStages;
        this.stageOrder = Object.keys(this.progressStages);
      }
      if (options.showProgressBar !== undefined) {
        this.showProgressBar = options.showProgressBar;
      }
      if (options.showCompletionTime !== undefined) {
        this.showCompletionTime = options.showCompletionTime;
      }
      if (options.showStageIcon !== undefined) {
        this.showStageIcon = options.showStageIcon;
      }

      // If active, update display with new config
      if (this.isActive) {
        this.updateDisplay();
      }
    }

    // ========================================================================
    // STAGES MODE METHODS (Phase 2)
    // ========================================================================

    /**
     * Set current stage (stages mode only)
     *
     * @param {string} stageKey - Stage key from progressStages
     * @returns {boolean} True if stage was set successfully
     */
    setStage(stageKey) {
      if (this.progressMode !== "stages") {
        logWarn("setStage() called but progressMode is not 'stages'");
        return false;
      }

      if (!this.progressStages[stageKey]) {
        logError(`Unknown stage key: ${stageKey}`);
        return false;
      }

      // Track completed stages
      if (
        this.currentStage &&
        !this.completedStages.includes(this.currentStage)
      ) {
        this.completedStages.push(this.currentStage);
      }

      this.currentStage = stageKey;
      logDebug(`Stage set to: ${stageKey}`, this.progressStages[stageKey]);

      // Update display
      if (this.isActive) {
        this.updateDisplay();
      }

      return true;
    }

    /**
     * Get cumulative percentage based on completed stages and current stage weights
     *
     * @returns {number} Percentage (0-100)
     */
    getStagePercentage() {
      if (this.progressMode !== "stages" || !this.currentStage) {
        return 0;
      }

      let cumulativeWeight = 0;

      // Add weights of completed stages
      for (const stageKey of this.completedStages) {
        const stage = this.progressStages[stageKey];
        if (stage) {
          cumulativeWeight += stage.weight || 0;
        }
      }

      // Add current stage weight
      const currentStageData = this.progressStages[this.currentStage];
      if (currentStageData) {
        cumulativeWeight += currentStageData.weight || 0;
      }

      // Cap at 100
      return Math.min(cumulativeWeight, 100);
    }

    /**
     * Get elapsed seconds since start
     *
     * @returns {number} Elapsed seconds
     */
    getElapsedSeconds() {
      if (!this.startTime) return 0;
      return (Date.now() - this.startTime) / 1000;
    }

    /**
     * Format elapsed time as "Xm Ys" or "Xs"
     *
     * @param {number} seconds - Seconds to format
     * @returns {string} Formatted time string
     */
    formatElapsedTime(seconds) {
      if (typeof seconds !== "number" || seconds < 0) {
        return "0s";
      }

      const roundedSeconds = Math.round(seconds);

      if (roundedSeconds < 60) {
        return `${roundedSeconds}s`;
      }

      const minutes = Math.floor(roundedSeconds / 60);
      const remainingSeconds = roundedSeconds % 60;

      return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Show completion time display
     *
     * @param {number} seconds - Completion time in seconds
     */
    showCompletionTimeDisplay(seconds) {
      if (!this.showCompletionTime || !this.container) {
        return;
      }

      // Remove existing completion time element if present
      this.hideCompletionTimeDisplay();

      // Create completion time element
      this.completionTimeElement = document.createElement("div");
      this.completionTimeElement.className = "embed-progress-completion-time";
      this.completionTimeElement.setAttribute("role", "status");
      this.completionTimeElement.setAttribute("aria-live", "polite");
      this.completionTimeElement.style.cssText = `
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: inherit;
        opacity: 0.8;
        margin-top: 0.5rem;
      `;
      this.completionTimeElement.innerHTML = `
        <span aria-hidden="true">⏱️</span> Completed in ${this.formatElapsedTime(
          seconds
        )}
      `;

      // Insert after progress element or at end of container
      if (
        this.progressElement &&
        this.progressElement.parentNode === this.container
      ) {
        this.progressElement.insertAdjacentElement(
          "afterend",
          this.completionTimeElement
        );
      } else {
        this.container.appendChild(this.completionTimeElement);
      }

      logDebug("Completion time displayed", {
        seconds,
        formatted: this.formatElapsedTime(seconds),
      });
    }

    /**
     * Hide completion time display
     */
    hideCompletionTimeDisplay() {
      if (this.completionTimeElement) {
        this.completionTimeElement.remove();
        this.completionTimeElement = null;
      }
    }

    /**
     * Update stages mode display
     *
     * @param {boolean} [isComplete=false] - Whether this is the final update
     * @private
     */
    updateStagesDisplay(isComplete = false) {
      if (!this.progressElement) {
        return;
      }

      const stageData = this.currentStage
        ? this.progressStages[this.currentStage]
        : null;
      const percentage = this.getStagePercentage();

      // Build stages mode content
      let content = "";

      if (isComplete) {
        content = this.buildStagesCompleteContent();
      } else if (stageData) {
        content = this.buildStagesContent(stageData, percentage);
      } else {
        content = this.buildStagesInitialContent();
      }

      // Update visual display
      this.progressElement.innerHTML = content;

      // Update progress bar if enabled
      if (this.showProgressBar) {
        this.updateProgressBar(percentage, isComplete);
      }

      // Update screen reader
      if (this.liveRegion) {
        const screenReaderText = isComplete
          ? `Operation complete.`
          : stageData
          ? `${stageData.message} ${percentage}% complete.`
          : "Preparing...";
        this.liveRegion.textContent = screenReaderText;
      }
    }

    /**
     * Build stages mode initial content (before any stage is set)
     *
     * @returns {string} HTML content
     * @private
     */
    buildStagesInitialContent() {
      const iconHtml = this.showStageIcon
        ? '<span aria-hidden="true" style="margin-right: 0.5rem;">⏳</span>'
        : "";

      if (this.style === "minimal") {
        return `${iconHtml}<strong>Preparing...</strong>`;
      }

      return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${
            iconHtml
              ? `<span aria-hidden="true" style="font-size: 1.25rem;">⏳</span>`
              : ""
          }
          <strong>Preparing...</strong>
        </div>
      `;
    }

    /**
     * Build stages mode content
     *
     * @param {Object} stageData - Current stage data
     * @param {number} percentage - Current percentage
     * @returns {string} HTML content
     * @private
     */
    buildStagesContent(stageData, percentage) {
      const iconHtml =
        this.showStageIcon && stageData.icon
          ? `<span aria-hidden="true" style="margin-right: 0.5rem;">${stageData.icon}</span>`
          : "";

      if (this.style === "minimal") {
        return `${iconHtml}<strong>${stageData.message}</strong> ${percentage}%`;
      }

      return `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          ${
            this.showStageIcon && stageData.icon
              ? `<span aria-hidden="true" style="font-size: 1.25rem;">${stageData.icon}</span>`
              : ""
          }
          <strong>${stageData.message}</strong>
        </div>
        <div style="font-size: 0.8125rem; opacity: 0.9; margin-top: 0.25rem;">
          ${percentage}% complete
        </div>
      `;
    }

    /**
     * Build stages mode complete content
     *
     * @returns {string} HTML content
     * @private
     */
    buildStagesCompleteContent() {
      // Change to success gradient
      this.progressElement.style.background =
        "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";

      const iconHtml = this.showStageIcon
        ? '<span aria-hidden="true" style="margin-right: 0.5rem;">✅</span>'
        : "";

      if (this.style === "minimal") {
        return `${iconHtml}<strong>Complete!</strong>`;
      }

      return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${
            this.showStageIcon
              ? `<span aria-hidden="true" style="font-size: 1.25rem;">✅</span>`
              : ""
          }
          <strong>Complete!</strong>
        </div>
      `;
    }

    /**
     * Update or create progress bar
     *
     * @param {number} percentage - Current percentage (0-100)
     * @param {boolean} [isComplete=false] - Whether operation is complete
     * @private
     */
    updateProgressBar(percentage, isComplete = false) {
      if (!this.container) return;

      // Create progress bar if it doesn't exist
      if (!this.progressBarElement) {
        this.progressBarElement = document.createElement("div");
        this.progressBarElement.className = "embed-progress-bar-container";
        this.progressBarElement.setAttribute("role", "progressbar");
        this.progressBarElement.setAttribute("aria-valuemin", "0");
        this.progressBarElement.setAttribute("aria-valuemax", "100");
        this.progressBarElement.setAttribute(
          "aria-label",
          "Operation progress"
        );
        this.progressBarElement.style.cssText = `
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          margin-top: 0.5rem;
          overflow: hidden;
        `;

        // Create inner progress bar
        const innerBar = document.createElement("div");
        innerBar.className = "embed-progress-bar-fill";
        innerBar.style.cssText = `
          height: 100%;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 4px;
          transition: width 0.3s ease;
          width: 0%;
        `;
        this.progressBarElement.appendChild(innerBar);

        // Insert after progress element
        if (this.progressElement && this.progressElement.parentNode) {
          this.progressElement.insertAdjacentElement(
            "afterend",
            this.progressBarElement
          );
        }
      }

      // Update progress bar value
      this.progressBarElement.setAttribute("aria-valuenow", String(percentage));
      const innerBar = this.progressBarElement.querySelector(
        ".embed-progress-bar-fill"
      );
      if (innerBar) {
        innerBar.style.width = `${percentage}%`;
        if (isComplete) {
          innerBar.style.background = "rgba(255, 255, 255, 1)";
        }
      }
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.EmbedProgressIndicator = EmbedProgressIndicator;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Progress Indicators (Stage 5 Phase 2) loaded");
  logInfo("Available class: EmbedProgressIndicator");
  logInfo("Supported modes: chunks (default), stages");
})();
