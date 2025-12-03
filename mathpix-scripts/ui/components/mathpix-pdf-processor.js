/**
 * @fileoverview MathPix PDF Processor - Complete PDF processing workflow orchestration
 * @module MathPixPDFProcessor
 * @requires MathPixBaseModule
 * @requires MATHPIX_CONFIG
 * @author MathPix Development Team
 * @version 2.1.0
 * @since 2.1.0
 *
 * @description
 * Orchestrates the complete PDF document processing workflow including processing initiation,
 * status polling with exponential backoff, progress tracking, error recovery, and result coordination.
 *
 * Key Features:
 * - PDF processing initiation with configurable options
 * - Intelligent status polling with exponential backoff
 * - Real-time progress tracking with user feedback
 * - Comprehensive error handling and recovery strategies
 * - Results coordination with display components
 * - Processing timeout management with user control
 *
 * Integration:
 * - Extends MathPixBaseModule for shared functionality
 * - Coordinates with MathPixAPIClient for PDF processing operations
 * - Works with MathPixPDFHandler for progress updates
 * - Triggers MathPixPDFResultRenderer for results display
 * - Integrates with notification system for user feedback
 *
 * Processing Workflow:
 * PDF Upload → Processing Initiation → Status Polling → Progress Updates →
 * Result Coordination → Error Recovery → Completion Handling
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant progress reporting
 * - Screen reader compatible status announcements
 * - Keyboard navigation support for user interactions
 * - Clear error messaging with suggested actions
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if logging should occur based on configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should proceed
 * @private
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error-level messages when appropriate
 * @param {string} message - Primary error message
 * @param {...*} args - Additional arguments for detailed error context
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning-level messages when appropriate
 * @param {string} message - Primary warning message
 * @param {...*} args - Additional arguments for warning context
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when appropriate
 * @param {string} message - Primary information message
 * @param {...*} args - Additional arguments for information context
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug-level messages when appropriate
 * @param {string} message - Primary debug message
 * @param {...*} args - Additional arguments for debug context
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MathPixBaseModule from "../../core/mathpix-base-module.js";
import MATHPIX_CONFIG from "../../core/mathpix-config.js";

/**
 * @class MathPixPDFProcessor
 * @extends MathPixBaseModule
 * @description Manages comprehensive PDF document processing workflow orchestration
 *
 * This class coordinates the complete PDF processing lifecycle from initiation through
 * completion, managing status polling, progress tracking, error recovery, and result
 * coordination. It implements intelligent polling strategies with exponential backoff
 * and provides comprehensive error handling with user-friendly recovery options.
 *
 * Key Features:
 * - Processing workflow orchestration with configurable options
 * - Intelligent status polling with exponential backoff algorithms
 * - Real-time progress tracking with estimated completion times
 * - Comprehensive error handling with recovery strategies
 * - Processing timeout management with user control options
 * - Results coordination with display and export components
 *
 * Processing States:
 * - IDLE: Ready for new processing request
 * - UPLOADING: Document upload in progress
 * - PROCESSING: Document processing in progress with polling
 * - COMPLETED: Processing completed successfully with results
 * - ERROR: Processing failed with error details
 * - TIMEOUT: Processing timed out with user options
 *
 * @example
 * const processor = new MathPixPDFProcessor(controller);
 * const results = await processor.processPDFDocument(pdfFile, {
 *   page_range: "1-10",
 *   formats: ["mmd", "html", "latex"]
 * }, progressCallback);
 *
 * @see {@link MathPixBaseModule} for inherited functionality
 * @see {@link MathPixAPIClient} for PDF processing API methods
 * @since 2.1.0
 */
class MathPixPDFProcessor extends MathPixBaseModule {
  /**
   * @constructor
   * @description Initialises the PDF processor with processing state management
   * @param {MathPixController} controller - Parent controller for API access and coordination
   * @throws {Error} If controller is not provided or invalid
   *
   * @example
   * const controller = getMathPixController();
   * const pdfProcessor = new MathPixPDFProcessor(controller);
   *
   * @accessibility Ensures all processing feedback supports screen reader announcements
   * @since 2.1.0
   */
  constructor(controller) {
    super(controller);

    this.processingState = "IDLE";
    this.currentPdfId = null;
    this.processingOptions = null;
    this.processingStartTime = 0;
    this.pollCount = 0;
    this.processingAbortController = null;

    // Phase 3.3: Debug data capture for debug panel
    this.lastDebugData = null;

    // Phase 3.4: Status polling metadata storage
    this.lastProcessingModel = null;
    this.lastPageCount = null;

    this.isInitialised = true;

    logInfo("MathPix PDF Processor initialised", {
      maxPolls: MATHPIX_CONFIG.PDF_PROCESSING.MAX_STATUS_POLLS,
      pollInterval: MATHPIX_CONFIG.PDF_PROCESSING.STATUS_POLL_INTERVAL,
      timeout: MATHPIX_CONFIG.PDF_PROCESSING.PDF_TIMEOUT,
    });
  }

  /**
   * @method processPDFDocument
   * @description Orchestrates complete PDF processing workflow from upload to completion
   *
   * Manages the entire PDF processing lifecycle including upload initiation, status polling,
   * progress tracking, error recovery, and results coordination. Provides comprehensive
   * error handling and user feedback throughout the processing workflow.
   *
   * @param {File} pdfFile - PDF document file to process
   * @param {Object} options - Processing configuration options
   * @param {string} [options.page_range="all"] - Page range to process ("all", "1-10", etc.)
   * @param {Array<string>} [options.formats=["mmd", "html"]] - Output formats to generate
   * @param {Object|null} [progressCallback=null] - Progress tracking callback functions
   * @param {Function} [progressCallback.nextStep] - Next step notification callback
   * @param {Function} [progressCallback.updateTiming] - Timing update callback
   * @param {Function} [progressCallback.handleError] - Error handling callback
   *
   * @returns {Promise<Object>} Processing results containing all requested formats
   *
   * @throws {Error} When processing initiation fails or critical errors occur
   *
   * @example
   * const results = await processor.processPDFDocument(pdfFile, {
   *   page_range: "1-5",
   *   formats: ["mmd", "html", "latex"]
   * }, {
   *   nextStep: () => console.log("Next step"),
   *   updateTiming: (msg) => console.log("Progress:", msg),
   *   handleError: (err, ctx) => console.error("Error:", err, ctx)
   * });
   *
   * @accessibility Provides screen reader compatible progress announcements
   * @since 2.1.0
   */
  async processPDFDocument(pdfFile, options = {}, progressCallback = null) {
    logInfo("Starting PDF document processing workflow", {
      fileName: pdfFile.name,
      size: pdfFile.size,
      options,
    });

    // Reset processing state
    this.resetProcessingState();
    this.processingState = "UPLOADING";
    this.processingOptions = options;
    this.processingStartTime = Date.now();
    this.processingAbortController = new AbortController();

    try {
      // PHASE 3: Update progress with upload status
      const requestedFormatCount = options.formats?.length || 0;
      const requestedFormatWord =
        requestedFormatCount === 1 ? "format" : "formats";
      const fileSize =
        this.controller.progressDisplay?.formatFileSize(pdfFile.size) ||
        `${(pdfFile.size / 1024 / 1024).toFixed(1)}MB`;

      if (this.controller?.progressDisplay) {
        this.controller.progressDisplay.updateStatusDetail(
          `Uploading PDF document (${fileSize})...`
        );
        this.controller.progressDisplay.updateTimingDetail(
          `Preparing to process ${requestedFormatCount} ${requestedFormatWord}`
        );
      }

      // Step 1: Initiate PDF processing (upload and queue)
      logInfo("Step 1: Initiating PDF processing upload");
      this.currentPdfId = await this.controller.apiClient.processPDF(
        pdfFile,
        options,
        progressCallback
      );

      if (!this.currentPdfId) {
        throw new Error(
          "PDF processing initiation failed - no processing ID received"
        );
      }

      // PHASE 3: Update progress after successful upload
      const uploadTime = Date.now() - this.processingStartTime;
      const uploadSeconds = (uploadTime / 1000).toFixed(1);

      if (this.controller?.progressDisplay) {
        this.controller.progressDisplay.updateStatusDetail(
          "✓ PDF uploaded successfully - Processing queued..."
        );
        this.controller.progressDisplay.updateTimingDetail(
          `Upload completed in ${uploadSeconds}s`
        );
      }

      logInfo("PDF processing initiated successfully", {
        pdfId: this.currentPdfId,
        uploadTime: Date.now() - this.processingStartTime,
      });

      // Step 2: Begin status polling workflow
      this.processingState = "PROCESSING";

      logInfo("Step 2: Starting status polling workflow");
      const results = await this.pollProcessingStatus(
        this.currentPdfId,
        progressCallback
      );

      // Step 3: Handle successful completion
      await this.handleProcessingCompletion(results);

      // PHASE 3: Calculate final statistics
      const totalProcessingTime = Date.now() - this.processingStartTime;
      const availableFormats = Object.keys(results).filter(
        (key) =>
          results[key] &&
          typeof results[key] === "string" &&
          results[key].trim()
      );
      const formatCount = availableFormats.length;
      const formatWord = formatCount === 1 ? "format" : "formats";

      // PHASE 3: Update progress with final completion statistics
      if (this.controller?.progressDisplay) {
        this.controller.progressDisplay.updateStatusDetail(
          `✓ Processing complete - ${formatCount} ${formatWord} ready for download`
        );
        this.controller.progressDisplay.updateTimingDetail(
          `Total time: ${this.controller.progressDisplay.formatTimeEstimate(
            totalProcessingTime
          )} (${this.pollCount} status ${
            this.pollCount === 1 ? "check" : "checks"
          })`
        );
      }

      // Step 3.5: Capture debug data for debug panel (Phase 3.3)
      this.captureDebugData({
        pdfId: this.currentPdfId,
        options: this.processingOptions,
        results: results,
        totalTime: totalProcessingTime,
        pollCount: this.pollCount,
        status: "completed",
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
      });

      logDebug("PDF debug data captured after successful completion", {
        pdfId: this.currentPdfId,
        hasDebugData: !!this.lastDebugData,
      });

      // Step 3.6: Update debug panel with PDF transaction data (Phase 3.3)
      if (
        this.controller &&
        typeof this.controller.updateDebugPanel === "function"
      ) {
        this.controller.updateDebugPanel();
        logDebug("Debug panel updated with PDF processing data");
      } else {
        logWarn(
          "Unable to update debug panel - controller method not available"
        );
      }

      // Step 4: Connect processor completion to UI display
      console.log("Triggering PDF results display with:", Object.keys(results));
      if (
        this.controller.pdfHandler &&
        typeof this.controller.pdfHandler.displayPDFResults === "function"
      ) {
        // CRITICAL FIX: Pass PDF ID to handler for DOCX downloads
        this.controller.pdfHandler.setCurrentPDFId(this.currentPdfId);
        this.controller.pdfHandler.displayPDFResults(results);
        console.log("PDF results display triggered successfully", {
          pdfId: this.currentPdfId,
        });

        // Step 4.5: Fetch lines.json data for confidence visualisation (Phase 3.2)
        // Non-blocking fetch - visualiser feature remains optional
        if (
          this.controller.pdfResultRenderer &&
          typeof this.controller.pdfResultRenderer.fetchAndStoreLinesData ===
            "function"
        ) {
          this.controller.pdfResultRenderer
            .fetchAndStoreLinesData(this.currentPdfId)
            .then((linesData) => {
              if (linesData) {
                logInfo("Lines data fetched for confidence visualisation", {
                  pdfId: this.currentPdfId,
                  pageCount: linesData.pages?.length || 0,
                });
              }
            })
            .catch((error) => {
              logWarn("Lines data fetch failed (non-blocking)", {
                pdfId: this.currentPdfId,
                error: error.message,
              });
            });
        }
      } else {
        console.error(
          "PDF handler not available or displayPDFResults method missing"
        );
        // Fallback: show notification
        this.showNotification(
          "Processing completed! Results retrieved but display failed.",
          "warning"
        );
      }

      this.processingState = "COMPLETED";

      logInfo("PDF document processing completed successfully", {
        pdfId: this.currentPdfId,
        totalTime: totalProcessingTime,
        totalPolls: this.pollCount,
        availableFormats: availableFormats,
      });

      // PHASE 3: Brief delay to show final statistics before hiding progress
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Hide enhanced progress interface after completion
      if (
        this.controller.pdfHandler &&
        typeof this.controller.pdfHandler.hideEnhancedProgress === "function"
      ) {
        this.controller.pdfHandler.hideEnhancedProgress();
        logDebug("Enhanced progress hidden after successful completion");
      }

      return results;
    } catch (error) {
      // Handle processing errors with comprehensive error management
      this.processingState = "ERROR";

      // PHASE 3: Update progress with error information
      if (this.controller?.progressDisplay) {
        this.controller.progressDisplay.updateStatusDetail(
          `❌ Processing failed: ${error.message}`
        );
        const processingTime = Date.now() - this.processingStartTime;
        this.controller.progressDisplay.updateTimingDetail(
          `Failed after ${this.controller.progressDisplay.formatTimeEstimate(
            processingTime
          )}`
        );
      }

      logError("PDF document processing failed", {
        pdfId: this.currentPdfId,
        error: error.message,
        processingTime: Date.now() - this.processingStartTime,
        pollCount: this.pollCount,
      });

      this.handleProcessingError(error, "during PDF document processing");
      throw error;
    } finally {
      // Cleanup processing resources
      if (this.processingAbortController) {
        this.processingAbortController.abort();
        this.processingAbortController = null;
      }
    }
  }

  /**
   * @method pollProcessingStatus
   * @description Manages PDF processing status polling with intelligent backoff strategies
   *
   * Continuously monitors PDF processing status using exponential backoff algorithms
   * to optimise API usage whilst providing timely status updates. Handles various
   * processing states and provides comprehensive error recovery strategies.
   *
   * @param {string} pdfId - PDF processing ID to monitor
   * @param {Object|null} [progressCallback=null] - Progress tracking callback functions
   *
   * @returns {Promise<Object>} Final processing results when completed
   *
   * @throws {Error} When polling times out or processing fails
   *
   * @example
   * const results = await processor.pollProcessingStatus(pdfId, {
   *   updateTiming: (message) => updateProgressBar(message),
   *   handleError: (error, context) => showErrorDialog(error)
   * });
   *
   * @private
   * @since 2.1.0
   */
  async pollProcessingStatus(pdfId, progressCallback = null) {
    const startTime = Date.now();
    this.pollCount = 0;
    const maxPolls = MATHPIX_CONFIG.PDF_PROCESSING.MAX_STATUS_POLLS;
    const basePollInterval = MATHPIX_CONFIG.PDF_PROCESSING.STATUS_POLL_INTERVAL;

    logInfo("Starting PDF status polling workflow", {
      pdfId,
      maxPolls,
      basePollInterval,
      estimatedMaxTime: (maxPolls * basePollInterval) / 1000 / 60 + " minutes",
    });

    // PHASE 3: Initial polling status
    if (this.controller?.progressDisplay) {
      this.controller.progressDisplay.updateStatusDetail(
        "Processing document - checking status..."
      );
      this.controller.progressDisplay.updateTimingDetail(
        "Waiting for processing to begin..."
      );
    }

    while (this.pollCount < maxPolls) {
      try {
        // Check for processing cancellation
        if (this.processingAbortController?.signal.aborted) {
          throw new Error("PDF processing was cancelled by user");
        }

        const statusResult = await this.controller.apiClient.checkPDFStatus(
          pdfId
        );
        this.pollCount++;

        const elapsedTime = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsedTime / 60000);
        const elapsedSeconds = Math.floor((elapsedTime % 60000) / 1000);

        logDebug("PDF status poll result", {
          pdfId,
          pollCount: this.pollCount,
          status: statusResult.status,
          elapsedTime: `${elapsedMinutes}:${elapsedSeconds
            .toString()
            .padStart(2, "0")}`,
          estimatedTimeRemaining: this.calculateEstimatedTime(
            this.pollCount,
            elapsedTime
          ),
        });

        // Phase 3.4: Capture status polling metadata for debug panel
        if (statusResult.version && !this.lastProcessingModel) {
          this.lastProcessingModel = statusResult.version;
          logDebug("Captured processing model from status", {
            model: this.lastProcessingModel,
          });
        }
        if (statusResult.num_pages && !this.lastPageCount) {
          this.lastPageCount = statusResult.num_pages;
          logDebug("Captured page count from status", {
            pages: this.lastPageCount,
          });
        }

        // PHASE 3: Update progress with current processing status
        if (this.controller?.progressDisplay) {
          const statusMessage = this.getStatusMessage(
            statusResult.status,
            statusResult.num_pages
          );
          const timingMessage = this.getTimingMessage(
            elapsedMinutes,
            elapsedSeconds,
            this.pollCount
          );

          this.controller.progressDisplay.updateStatusDetail(statusMessage);
          this.controller.progressDisplay.updateTimingDetail(timingMessage);
        }

        // Provide progress updates to callback
        if (
          progressCallback &&
          typeof progressCallback.updateTiming === "function"
        ) {
          const progressMessage = this.formatProgressUpdate(
            statusResult.status,
            elapsedMinutes,
            elapsedSeconds,
            this.calculateEstimatedTime(this.pollCount, elapsedTime)
          );
          progressCallback.updateTiming(progressMessage);
        }

        // Handle different processing states
        switch (statusResult.status) {
          case "completed":
            logInfo("PDF processing completed successfully", {
              pdfId,
              totalTime: `${elapsedTime}ms`,
              totalPolls: this.pollCount,
            });

            // PHASE 3: Update progress - processing complete, starting downloads
            const requestedFormats = this.processingOptions.formats || [];
            const totalFormats = requestedFormats.length;
            const formatWord = totalFormats === 1 ? "format" : "formats";

            if (this.controller?.progressDisplay) {
              this.controller.progressDisplay.updateStatusDetail(
                `✓ Processing complete - Downloading ${totalFormats} ${formatWord}...`
              );
              this.controller.progressDisplay.updateTimingDetail(
                `Total processing time: ${this.controller.progressDisplay.formatTimeEstimate(
                  elapsedTime
                )}`
              );
            }

            // Fetch actual results from API endpoints
            const results = {};
            let downloadedCount = 0;

            // Always get MMD (default format - always available)
            try {
              // PHASE 3: Update progress for MMD download
              if (this.controller?.progressDisplay) {
                this.controller.progressDisplay.updateStatusDetail(
                  `Downloading format 1 of ${totalFormats}: MMD...`
                );
              }

              results.mmd = await this.controller.apiClient.downloadPDFFormat(
                pdfId,
                "mmd"
              );
              downloadedCount++;

              // PHASE 3: Track download for statistics
              if (this.controller?.progressDisplay && results.mmd) {
                const size = results.mmd.length || results.mmd.size || 0;
                this.controller.progressDisplay.trackDownload("MMD", size);
              }

              logInfo("Successfully fetched MMD results", {
                pdfId,
                length: results.mmd.length,
              });
            } catch (error) {
              logWarn("Failed to fetch MMD format", error);
            }

            // Get requested conversion formats with proper mapping
            const FORMAT_MAPPING = {
              mmd: "mmd",
              html: "html",
              latex: "tex.zip", // Map UI "latex" to result key "tex.zip"
              docx: "docx",
            };

            for (const uiFormat of requestedFormats) {
              if (uiFormat !== "mmd") {
                // Skip MMD - already fetched
                downloadedCount++;
                const resultKey = FORMAT_MAPPING[uiFormat] || uiFormat;

                // PHASE 3: Update progress for each format download
                if (this.controller?.progressDisplay) {
                  this.controller.progressDisplay.updateStatusDetail(
                    `Downloading format ${downloadedCount} of ${totalFormats}: ${uiFormat.toUpperCase()}...`
                  );
                }

                try {
                  results[resultKey] =
                    await this.controller.apiClient.downloadPDFFormat(
                      pdfId,
                      uiFormat
                    );

                  // PHASE 3: Track download for statistics
                  if (this.controller?.progressDisplay && results[resultKey]) {
                    const size =
                      results[resultKey].length || results[resultKey].size || 0;
                    this.controller.progressDisplay.trackDownload(
                      uiFormat.toUpperCase(),
                      size
                    );
                  }

                  console.log(
                    `✅ Downloaded ${uiFormat}: ${
                      results[resultKey]?.length ||
                      results[resultKey]?.size ||
                      "unknown"
                    } chars/bytes`
                  );

                  logInfo(`Successfully fetched ${uiFormat} results`, {
                    pdfId,
                    uiFormat,
                    resultKey,
                    type: typeof results[resultKey],
                    size:
                      results[resultKey]?.length ||
                      results[resultKey]?.size ||
                      "unknown",
                  });
                } catch (error) {
                  logWarn(`Failed to fetch ${uiFormat} format`, error);
                }
              }
            }

            // PHASE 3: Final download completion status
            const downloadSummary =
              this.controller?.progressDisplay?.getDownloadSummary();
            if (this.controller?.progressDisplay && downloadSummary) {
              this.controller.progressDisplay.updateStatusDetail(
                `✓ All formats downloaded - ${downloadSummary.count} ${
                  downloadSummary.count === 1 ? "format" : "formats"
                } ready (${downloadSummary.totalSize})`
              );
            }

            // Ensure we have at least MMD results
            if (!results.mmd) {
              throw new Error(
                "Failed to retrieve any results from completed PDF processing"
              );
            }

            logInfo("PDF results retrieval completed", {
              pdfId,
              availableFormats: Object.keys(results).filter(
                (key) => results[key]
              ),
              totalFormats: Object.keys(results).length,
            });

            return results;

          case "error":
            const errorMessage =
              statusResult.error || "PDF processing failed with unknown error";
            logError("PDF processing failed with API error", {
              pdfId,
              error: errorMessage,
              pollCount: this.pollCount,
            });
            throw new Error(`Processing failed: ${errorMessage}`);

          case "processing":
          case "queued":
          case "received":
          case "loaded":
          case "split":
            // Continue polling - these are normal interim states
            logDebug("PDF processing continuing", {
              status: statusResult.status,
              pollCount: this.pollCount,
            });
            break;

          default:
            logWarn("Unknown PDF processing status encountered", {
              pdfId,
              status: statusResult.status,
              pollCount: this.pollCount,
            });
            // Continue polling for unknown states as they may be interim
            break;
        }

        // Calculate intelligent wait time with exponential backoff
        const waitTime = this.calculateNextPollInterval(
          this.pollCount,
          basePollInterval
        );

        logDebug("Waiting before next status poll", {
          waitTime,
          nextPollCount: this.pollCount + 1,
        });

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } catch (error) {
        logError("PDF status polling error occurred", {
          pdfId,
          pollCount: this.pollCount,
          error: error.message,
        });

        // Notify progress callback of error
        if (
          progressCallback &&
          typeof progressCallback.handleError === "function"
        ) {
          progressCallback.handleError(
            error,
            `during status polling (poll ${this.pollCount})`
          );
        }

        throw new Error(`Status polling failed: ${error.message}`);
      }
    }

    // Polling timeout reached
    this.processingState = "TIMEOUT";
    const timeoutMessage = `PDF processing timed out after ${maxPolls} status checks (${Math.floor(
      (Date.now() - startTime) / 60000
    )} minutes)`;

    logError("PDF processing timeout", {
      pdfId,
      pollCount: this.pollCount,
      totalTime: Date.now() - startTime,
      maxPolls,
    });

    throw new Error(timeoutMessage);
  }

  /**
   * @method getStatusMessage
   * @description Generates user-friendly status message based on processing state
   *
   * @param {string} status - Current processing status from API
   * @param {number|null} pageCount - Number of pages (if available)
   * @returns {string} User-friendly status message
   * @private
   * @since Phase 3
   */
  getStatusMessage(status, pageCount = null) {
    const pageInfo = pageCount ? ` (${pageCount} pages)` : "";

    switch (status) {
      case "queued":
        return `Processing queued${pageInfo}...`;
      case "received":
        return `Document received${pageInfo} - preparing...`;
      case "loaded":
        return `Document loaded${pageInfo} - starting processing...`;
      case "split":
        return `Splitting document${pageInfo} into pages...`;
      case "processing":
        return `Processing document${pageInfo}...`;
      case "completed":
        return `✓ Processing complete${pageInfo}`;
      case "error":
        return "❌ Processing error detected";
      default:
        return `Processing status: ${status}${pageInfo}`;
    }
  }

  /**
   * @method getTimingMessage
   * @description Generates timing information message
   *
   * @param {number} minutes - Elapsed minutes
   * @param {number} seconds - Elapsed seconds
   * @param {number} pollCount - Number of status polls completed
   * @returns {string} Timing message
   * @private
   * @since Phase 3
   */
  getTimingMessage(minutes, seconds, pollCount) {
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    return `Processing time: ${timeStr} (check ${pollCount})`;
  }

  /**
   * @method handleProcessingCompletion
   * @description Manages successful PDF processing completion workflow
   *
   * Coordinates post-processing activities including results validation,
   * component notifications, and preparation for result display. Ensures
   * all processing artifacts are properly managed and cleaned up.
   *
   * @param {Object} results - Processing results from MathPix API
   *
   * @returns {Promise<void>}
   *
   * @example
   * await processor.handleProcessingCompletion({
   *   mmd: "# Document Title\nContent...",
   *   html: "<h1>Document Title</h1><p>Content...</p>",
   *   latex: "\\documentclass{article}..."
   * });
   *
   * @private
   * @since 2.1.0
   */
  async handleProcessingCompletion(results) {
    logInfo("Handling PDF processing completion", {
      pdfId: this.currentPdfId,
      availableFormats: Object.keys(results).filter(
        (key) =>
          results[key] &&
          typeof results[key] === "string" &&
          results[key].trim()
      ),
      processingTime: Date.now() - this.processingStartTime,
    });

    try {
      // Validate results contain expected content
      const hasContent = Object.keys(results).some(
        (key) =>
          results[key] &&
          typeof results[key] === "string" &&
          results[key].trim()
      );

      if (!hasContent) {
        logWarn("PDF processing completed but no content found in results", {
          pdfId: this.currentPdfId,
          resultKeys: Object.keys(results),
        });
        this.showNotification(
          "Processing completed but no content was generated. Please try with different settings.",
          "warning"
        );
        return;
      }

      // Add processing metadata to results
      results.processingMetadata = {
        pdfId: this.currentPdfId,
        options: this.processingOptions,
        totalTime: Date.now() - this.processingStartTime,
        pollCount: this.pollCount,
        completedAt: new Date().toISOString(),
      };

      logInfo("PDF processing completion handled successfully", {
        pdfId: this.currentPdfId,
        contentFormats: Object.keys(results).filter(
          (key) => key !== "processingMetadata" && results[key]
        ),
      });
    } catch (error) {
      logError("Error during processing completion handling", error);
      this.showNotification(
        `Processing completed but there was an issue preparing results: ${error.message}`,
        "warning"
      );
    }
  }

  /**
   * @method handleProcessingError
   * @description Provides comprehensive error handling for PDF processing failures
   *
   * Manages error classification, user notification, recovery suggestions,
   * and cleanup operations when PDF processing encounters failures.
   *
   * @param {Error} error - Error that occurred during processing
   * @param {string} context - Context description where error occurred
   *
   * @returns {void}
   *
   * @example
   * processor.handleProcessingError(error, "during status polling");
   *
   * @since 2.1.0
   */
  handleProcessingError(error, context) {
    logError("Handling PDF processing error", {
      error: error.message,
      context,
      pdfId: this.currentPdfId,
      processingState: this.processingState,
      pollCount: this.pollCount,
    });

    // Classify error types for appropriate user messaging
    let userMessage = "PDF processing failed";
    let errorType = "error";
    let suggestedActions = [];

    if (
      error.message.includes("timeout") ||
      error.message.includes("timed out")
    ) {
      userMessage = "PDF processing took longer than expected";
      errorType = "warning";
      suggestedActions = [
        "The document may be complex or large",
        "Consider processing fewer pages or selecting specific page ranges",
        "Try again - processing times can vary",
      ];
    } else if (
      error.message.includes("network") ||
      error.message.includes("fetch")
    ) {
      userMessage = "Network connection issue during processing";
      errorType = "warning";
      suggestedActions = [
        "Check your internet connection",
        "Try processing again",
        "Consider using fewer output formats if the connection is slow",
      ];
    } else if (
      error.message.includes("credentials") ||
      error.message.includes("API")
    ) {
      userMessage = "API configuration issue";
      errorType = "error";
      suggestedActions = [
        "Check your MathPix API credentials",
        "Ensure your account has PDF processing access",
        "Contact support if the issue persists",
      ];
    } else if (
      error.message.includes("file") ||
      error.message.includes("PDF")
    ) {
      userMessage = "Issue with the PDF document";
      errorType = "warning";
      suggestedActions = [
        "Ensure the PDF contains mathematical content",
        "Try with a different PDF document",
        "Check that the PDF is not corrupted or password protected",
      ];
    }

    // Show user-friendly error notification
    const fullMessage =
      suggestedActions.length > 0
        ? `${userMessage}. ${suggestedActions[0]}.`
        : `${userMessage}: ${error.message}`;

    this.showNotification(fullMessage, errorType);

    // Log additional context for debugging
    logWarn("PDF processing error handling completed", {
      errorType,
      userMessage,
      suggestedActionsCount: suggestedActions.length,
      context,
    });
  }

  /**
   * @method calculateEstimatedTime
   * @description Calculates estimated remaining processing time based on polling history
   *
   * Uses polling history and average processing times to estimate completion time.
   * Provides users with realistic time expectations for long-running processing.
   *
   * @param {number} pollCount - Current number of polls completed
   * @param {number} elapsedTime - Elapsed processing time in milliseconds
   *
   * @returns {string} Human-readable estimated time remaining
   *
   * @example
   * const estimate = processor.calculateEstimatedTime(25, 60000);
   * // Returns: "2-3 minutes remaining"
   *
   * @private
   * @since 2.1.0
   */
  calculateEstimatedTime(pollCount, elapsedTime) {
    const avgPollTime = elapsedTime / pollCount;
    const maxPolls = MATHPIX_CONFIG.PDF_PROCESSING.MAX_STATUS_POLLS;
    const remainingPolls = maxPolls - pollCount;

    // Estimate based on exponential backoff and typical completion patterns
    let estimatedRemainingTime;

    if (pollCount < 10) {
      // Early stage - fast polling
      estimatedRemainingTime = remainingPolls * avgPollTime * 0.8;
    } else if (pollCount < 30) {
      // Mid stage - moderate polling
      estimatedRemainingTime = remainingPolls * avgPollTime * 1.2;
    } else {
      // Late stage - slower polling with backoff
      estimatedRemainingTime = remainingPolls * avgPollTime * 1.8;
    }

    const estimatedMinutes = Math.floor(estimatedRemainingTime / 60000);
    const estimatedSeconds = Math.floor(
      (estimatedRemainingTime % 60000) / 1000
    );

    if (estimatedMinutes > 0) {
      return `approximately ${estimatedMinutes}-${
        estimatedMinutes + 1
      } minutes remaining`;
    } else {
      return `approximately ${Math.max(
        30,
        estimatedSeconds
      )} seconds remaining`;
    }
  }

  /**
   * @method formatProgressUpdate
   * @description Formats user-friendly progress messages with timing and status information
   *
   * Creates accessible progress messages that provide clear status information
   * and time estimates for screen readers and visual display.
   *
   * @param {string} status - Current processing status from API
   * @param {number} elapsedMinutes - Elapsed processing minutes
   * @param {number} elapsedSeconds - Elapsed processing seconds
   * @param {string} estimatedTime - Estimated remaining time
   *
   * @returns {string} Formatted progress message
   *
   * @example
   * const message = processor.formatProgressUpdate("processing", 2, 30, "1-2 minutes remaining");
   * // Returns: "Converting document formats... (2:30 elapsed, 1-2 minutes remaining)"
   *
   * @private
   * @since 2.1.0
   */
  formatProgressUpdate(status, elapsedMinutes, elapsedSeconds, estimatedTime) {
    const timeString = `${elapsedMinutes}:${elapsedSeconds
      .toString()
      .padStart(2, "0")}`;

    let statusMessage;
    switch (status) {
      case "queued":
        statusMessage = "Document queued for processing";
        break;
      case "processing":
        statusMessage = "Converting document formats";
        break;
      default:
        statusMessage = `Processing status: ${status}`;
        break;
    }

    return `${statusMessage}... (${timeString} elapsed, ${estimatedTime})`;
  }

  /**
   * @method calculateNextPollInterval
   * @description Calculates intelligent polling intervals with exponential backoff
   *
   * Implements exponential backoff strategy to reduce API calls whilst maintaining
   * responsive status updates. Adjusts intervals based on processing duration.
   *
   * @param {number} pollCount - Current poll count
   * @param {number} baseInterval - Base polling interval in milliseconds
   *
   * @returns {number} Next polling interval in milliseconds
   *
   * @private
   * @since 2.1.0
   */
  calculateNextPollInterval(pollCount, baseInterval) {
    if (pollCount <= 10) {
      // Fast polling for first 20 seconds
      return baseInterval;
    } else if (pollCount <= 30) {
      // Moderate backoff for next minute
      return baseInterval * 1.5;
    } else {
      // Slower polling for long-running processes
      return baseInterval * 2.5;
    }
  }

  /**
   * @method resetProcessingState
   * @description Resets processing state for new processing operations
   *
   * Clears all processing state variables and prepares for new processing workflow.
   * Ensures clean state between processing operations.
   *
   * @returns {void}
   *
   * @private
   * @since 2.1.0
   */
  resetProcessingState() {
    this.processingState = "IDLE";
    this.currentPdfId = null;
    this.processingOptions = null;
    this.processingStartTime = 0;
    this.pollCount = 0;

    // Phase 3.4: Reset status polling metadata
    this.lastProcessingModel = null;
    this.lastPageCount = null;

    if (this.processingAbortController) {
      this.processingAbortController.abort();
      this.processingAbortController = null;
    }

    logDebug("PDF processor state reset for new processing operation");
  }

  /**
   * @method cancelProcessing
   * @description Cancels ongoing PDF processing operation
   *
   * Provides user control to cancel long-running processing operations.
   * Cleans up resources and notifies user of cancellation.
   *
   * @returns {void}
   *
   * @example
   * processor.cancelProcessing();
   *
   * @since 2.1.0
   */
  cancelProcessing() {
    if (this.processingState === "IDLE") {
      logWarn("Cannot cancel processing - no active processing operation");
      return;
    }

    logInfo("Cancelling PDF processing operation", {
      pdfId: this.currentPdfId,
      processingState: this.processingState,
      pollCount: this.pollCount,
    });

    if (this.processingAbortController) {
      this.processingAbortController.abort();
    }

    this.processingState = "IDLE";
    this.showNotification("PDF processing cancelled by user", "info");
  }

  /**
   * @method getProcessingStatus
   * @description Gets current processing status information
   *
   * Returns comprehensive status information for monitoring and display purposes.
   * Useful for UI components that need to display processing state.
   *
   * @returns {Object} Processing status information
   * @returns {string} returns.state - Current processing state
   * @returns {string|null} returns.pdfId - Current PDF processing ID
   * @returns {number} returns.pollCount - Number of polls completed
   * @returns {number} returns.elapsedTime - Elapsed processing time in milliseconds
   *
   * @example
   * const status = processor.getProcessingStatus();
   * console.log("Processing state:", status.state);
   *
   * @since 2.1.0
   */
  getProcessingStatus() {
    return {
      state: this.processingState,
      pdfId: this.currentPdfId,
      pollCount: this.pollCount,
      elapsedTime:
        this.processingStartTime > 0
          ? Date.now() - this.processingStartTime
          : 0,
      options: this.processingOptions,
    };
  }

  /**
   * @method validate
   * @description Validates PDF processor configuration and dependencies
   *
   * Extends base validation to check PDF-specific requirements including
   * API client availability and configuration validity.
   *
   * @returns {boolean} True if processor is properly configured
   *
   * @override
   * @since 2.1.0
   */
  validate() {
    if (!super.validate()) {
      return false;
    }

    // Check API client availability
    if (!this.controller.apiClient) {
      logError("PDF processor validation failed - API client not available");
      return false;
    }

    // Check PDF processing configuration
    if (!MATHPIX_CONFIG.PDF_PROCESSING) {
      logError(
        "PDF processor validation failed - PDF processing configuration missing"
      );
      return false;
    }

    return true;
  }

  /**
   * @method getDebugInfo
   * @description Gets comprehensive debug information for PDF processor
   *
   * Extends base debug info with PDF-specific processing state and configuration.
   *
   * @returns {Object} Extended debug information including PDF processing details
   *
   * @override
   * @since 2.1.0
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();

    return {
      ...baseInfo,
      processingState: this.processingState,
      currentPdfId: this.currentPdfId,
      pollCount: this.pollCount,
      processingOptions: this.processingOptions,
      hasAbortController: !!this.processingAbortController,
      pdfConfig: {
        maxPolls: MATHPIX_CONFIG.PDF_PROCESSING?.MAX_STATUS_POLLS,
        pollInterval: MATHPIX_CONFIG.PDF_PROCESSING?.STATUS_POLL_INTERVAL,
        timeout: MATHPIX_CONFIG.PDF_PROCESSING?.PDF_TIMEOUT,
      },
    };
  }

  /**
   * @method captureDebugData
   * @description Captures debug data from PDF processing workflow for debug panel
   *
   * Records comprehensive transaction information including request details,
   * response data, timing metrics, and processing metadata. Supports the debug
   * panel's visibility into PDF processing operations.
   *
   * @param {Object} processingData - Processing workflow data to capture
   * @param {string} processingData.pdfId - PDF processing ID
   * @param {Object} processingData.options - Processing options used
   * @param {Object} processingData.results - Final processing results
   * @param {number} processingData.totalTime - Total processing time in milliseconds
   * @param {number} processingData.pollCount - Number of status polls performed
   * @param {string} processingData.status - Final processing status
   *
   * @returns {void}
   *
   * @example
   * this.captureDebugData({
   *   pdfId: "abc123",
   *   options: { page_range: "1-10", formats: ["mmd", "html"] },
   *   results: { mmd: "...", html: "..." },
   *   totalTime: 45000,
   *   pollCount: 23,
   *   status: "completed"
   * });
   *
   * @private
   * @since Phase 3.3
   */
  captureDebugData(processingData) {
    try {
      const endpoint = this.controller.apiClient?.apiBase
        ? `${this.controller.apiClient.apiBase}/pdf`
        : "https://api.mathpix.com/v3/pdf";

      // Mask API credentials for security
      const maskedAppKey = this.controller.apiClient?.apiKey
        ? `****${this.controller.apiClient.apiKey.slice(-4)}`
        : "Not configured";

      this.lastDebugData = {
        timestamp: new Date().toISOString(),
        operation: "processPDF",
        endpoint: endpoint,

        request: {
          headers: {
            app_id: this.controller.apiClient?.appId || "Not configured",
            app_key: maskedAppKey,
          },
          pdfId: processingData.pdfId,
          options: processingData.options || {},
          fileName: processingData.fileName || "Unknown",
          fileSize: processingData.fileSize || 0,
        },

        response: {
          status: processingData.status === "completed" ? 200 : 500,
          statusText:
            processingData.status === "completed" ? "OK" : "Processing Error",
          pdfId: processingData.pdfId,
          finalStatus: processingData.status,
          availableFormats: processingData.results
            ? Object.keys(processingData.results).filter(
                (key) =>
                  key !== "processingMetadata" && processingData.results[key]
              )
            : [],
          contentType: "pdf-document",
          confidence: null, // Will be updated by Lines API callback (Phase 3.4)
          data: {
            request_id: processingData.pdfId,
            version: this.lastProcessingModel || "v3", // Phase 3.4: Use captured model
            confidence_rate: null, // Will be updated by Lines API callback (Phase 3.4)
            results: processingData.results || {},
          },
        },

        timing: {
          total: processingData.totalTime || 0,
          api: processingData.totalTime || 0, // PDF is mostly API time
          processing: 0, // No client-side processing for PDFs
        },

        metadata: {
          pollCount: processingData.pollCount || 0,
          processingState: processingData.status,
          pageRange: processingData.options?.page_range || "all",
          requestedFormats: processingData.options?.formats || [],
          completedFormats: processingData.results
            ? Object.keys(processingData.results).filter(
                (key) =>
                  key !== "processingMetadata" && processingData.results[key]
              )
            : [],
          // Phase 3.4: Include status polling metadata
          processingModel: this.lastProcessingModel,
          pageCount: this.lastPageCount,
        },
      };

      logDebug("PDF debug data captured", {
        pdfId: processingData.pdfId,
        timestamp: this.lastDebugData.timestamp,
        totalTime: processingData.totalTime,
        formats: this.lastDebugData.metadata.completedFormats,
      });
    } catch (error) {
      logError("Failed to capture PDF debug data", {
        error: error.message,
        processingData,
      });
    }
  }

  /**
   * @method updateDebugDataWithLinesAPI
   * @description Updates debug data with Lines API confidence data
   *
   * Called after Lines API data is fetched to enrich debug information with
   * average confidence data. This is a two-stage capture process since Lines
   * API data is fetched after initial processing completion.
   *
   * @param {Object} linesData - Lines API analysis data
   * @param {number} [linesData.averageConfidence] - Average confidence (0-1)
   * @param {number} [linesData.totalPages] - Total pages analyzed
   * @param {number} [linesData.mathElements] - Math elements found
   * @param {number} [linesData.tableCount] - Tables found
   *
   * @returns {void}
   *
   * @example
   * processor.updateDebugDataWithLinesAPI({
   *   averageConfidence: 0.95,
   *   totalPages: 10,
   *   mathElements: 45
   * });
   *
   * @since Phase 3.4
   */
  updateDebugDataWithLinesAPI(linesData) {
    if (!this.lastDebugData) {
      logWarn("Cannot update debug data - no existing debug data found");
      return;
    }

    try {
      // Update confidence data from Lines API
      if (linesData.averageConfidence !== undefined) {
        this.lastDebugData.response.confidence = linesData.averageConfidence;
        this.lastDebugData.response.data.confidence_rate =
          linesData.averageConfidence;
      }

      // Add Lines API metadata
      if (!this.lastDebugData.metadata.linesAPI) {
        this.lastDebugData.metadata.linesAPI = {};
      }

      this.lastDebugData.metadata.linesAPI = {
        averageConfidence: linesData.averageConfidence,
        totalPages: linesData.totalPages,
        mathElements: linesData.mathElements,
        tableCount: linesData.tableCount,
        updatedAt: new Date().toISOString(),
      };

      logDebug("Debug data updated with Lines API data", {
        confidence: linesData.averageConfidence,
        pages: linesData.totalPages,
        mathElements: linesData.mathElements,
      });

      // Trigger debug panel refresh if controller method available
      if (
        this.controller &&
        typeof this.controller.updateDebugPanel === "function"
      ) {
        this.controller.updateDebugPanel();
        logDebug("Debug panel refreshed after Lines API update");
      }
    } catch (error) {
      logError("Failed to update debug data with Lines API data", {
        error: error.message,
        linesData,
      });
    }
  }

  /**
   * @method getLastDebugData
   * @description Retrieves last captured debug data for debug panel display
   *
   * Returns the most recent PDF processing transaction data in a format
   * compatible with the debug panel's display requirements. Matches the
   * structure used by image and strokes API clients for consistency.
   *
   * @returns {Object|null} Last debug data or null if no data captured
   *
   * @example
   * const debugData = processor.getLastDebugData();
   * if (debugData) {
   *   console.log('Last PDF operation:', debugData.operation);
   *   console.log('Processing time:', debugData.timing.total);
   * }
   *
   * @since Phase 3.3
   */
  getLastDebugData() {
    return this.lastDebugData;
  }
}

/**
 * @function monitorPDFProgressUpdates
 * @description Real-time monitoring of PDF progress updates during processing
 * @global
 * @returns {Object} Monitor control object
 * @since Phase 3
 *
 * @example
 * // Start monitoring BEFORE uploading a PDF
 * const monitor = window.monitorPDFProgressUpdates();
 * // Then upload and process your PDF
 * // Watch console for real-time progress updates
 * // Stop monitoring with: monitor.stop()
 */
window.monitorPDFProgressUpdates = function () {
  console.log("🔍 PDF Progress Update Monitor Started");
  console.log("=====================================");
  console.log("Monitoring progress detail lines for updates...\n");

  const progressDisplay = window.getMathPixController()?.progressDisplay;

  if (!progressDisplay) {
    console.error("❌ Progress display not found - cannot monitor");
    return null;
  }

  // Get the detail line elements
  const statusElement = document.getElementById("mathpix-pdf-status");
  const timingElement = document.getElementById("mathpix-pdf-timing");

  console.log("📍 Monitoring Elements:");
  console.log(
    "Status line element:",
    statusElement ? "✅ Found" : "❌ Not found"
  );
  console.log(
    "Timing line element:",
    timingElement ? "✅ Found" : "❌ Not found"
  );

  if (!statusElement || !timingElement) {
    console.error("❌ Cannot find detail line elements in DOM");
    console.log("Looking for: #mathpix-pdf-status and #mathpix-pdf-timing");
    return null;
  }

  // Store previous values
  let lastStatus = statusElement.textContent;
  let lastTiming = timingElement.textContent;
  let updateCount = 0;

  console.log("\n📊 Initial Values:");
  console.log("Status:", lastStatus);
  console.log("Timing:", lastTiming);
  console.log("\n⏳ Waiting for updates...\n");

  // Monitor for changes
  const monitorInterval = setInterval(() => {
    const currentStatus = statusElement.textContent;
    const currentTiming = timingElement.textContent;

    // Check for status line changes
    if (currentStatus !== lastStatus) {
      updateCount++;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] 📝 Status Update #${updateCount}:`);
      console.log(`   From: "${lastStatus}"`);
      console.log(`   To:   "${currentStatus}"`);
      lastStatus = currentStatus;
    }

    // Check for timing line changes
    if (currentTiming !== lastTiming) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ⏱️  Timing Update:`);
      console.log(`   From: "${lastTiming}"`);
      console.log(`   To:   "${currentTiming}"`);
      lastTiming = currentTiming;
    }
  }, 100); // Check every 100ms

  // Return control object
  return {
    stop: () => {
      clearInterval(monitorInterval);
      console.log("\n=====================================");
      console.log("🛑 Monitor Stopped");
      console.log(`Total status updates captured: ${updateCount}`);
      console.log("=====================================");
    },
    getStats: () => {
      return {
        updateCount,
        currentStatus: statusElement.textContent,
        currentTiming: timingElement.textContent,
      };
    },
  };
};

/**
 * @function inspectPDFProgressElements
 * @description Inspects current state of PDF progress elements
 * @global
 * @since Phase 3
 *
 * @example
 * window.inspectPDFProgressElements()
 */
window.inspectPDFProgressElements = function () {
  console.log("🔍 PDF Progress Elements Inspector");
  console.log("===================================\n");

  // Check for progress display system
  const progressDisplay = window.getMathPixController()?.progressDisplay;
  console.log("📦 Progress Display System:");
  console.log("   Available:", !!progressDisplay);

  if (progressDisplay) {
    console.log("   Methods:");
    console.log(
      "   - updateStatusDetail:",
      typeof progressDisplay.updateStatusDetail === "function" ? "✅" : "❌"
    );
    console.log(
      "   - updateTimingDetail:",
      typeof progressDisplay.updateTimingDetail === "function" ? "✅" : "❌"
    );
    console.log("   - Element cache:", {
      statusDetailElement: !!progressDisplay.statusDetailElement,
      timingDetailElement: !!progressDisplay.timingDetailElement,
    });
  }

  // Check for DOM elements
  console.log("\n📍 DOM Elements:");

  const elements = {
    "Enhanced Progress Container": "pdf-progress-enhanced",
    "Status Detail Line": "mathpix-pdf-status",
    "Timing Detail Line": "mathpix-pdf-timing",
    "Progress Bar": "pdf-progress-bar-enhanced",
    "Progress Fill": "pdf-progress-fill-enhanced",
    "Progress Text": "pdf-progress-text-enhanced",
  };

  Object.entries(elements).forEach(([name, id]) => {
    const element = document.getElementById(id);
    console.log(`   ${name}:`, element ? "✅ Found" : "❌ Not found");
    if (element) {
      console.log(`      ID: #${id}`);
      console.log(
        `      Visible: ${element.offsetParent !== null ? "Yes" : "No"}`
      );
      console.log(
        `      Content: "${element.textContent?.trim()?.substring(0, 50)}${
          element.textContent?.length > 50 ? "..." : ""
        }"`
      );
    }
  });

  // Check specifically for detail lines
  console.log("\n📝 Detail Lines Inspection:");
  const statusLine = document.getElementById("mathpix-pdf-status");
  const timingLine = document.getElementById("mathpix-pdf-timing");

  if (statusLine) {
    console.log("   Status Line (#mathpix-pdf-status):");
    console.log("      Current text:", `"${statusLine.textContent}"`);
    console.log(
      "      Parent:",
      statusLine.parentElement?.className || "unknown"
    );
  } else {
    console.log("   ❌ Status line not found in DOM");
  }

  if (timingLine) {
    console.log("   Timing Line (#mathpix-pdf-timing):");
    console.log("      Current text:", `"${timingLine.textContent}"`);
    console.log(
      "      Parent:",
      timingLine.parentElement?.className || "unknown"
    );
  } else {
    console.log("   ❌ Timing line not found in DOM");
  }

  // Manual update test
  console.log("\n🧪 Manual Update Test:");
  if (progressDisplay && statusLine && timingLine) {
    console.log("   Testing updateStatusDetail...");
    progressDisplay.updateStatusDetail("TEST: This is a status update");
    console.log("   Status line now shows:", `"${statusLine.textContent}"`);

    console.log("   Testing updateTimingDetail...");
    progressDisplay.updateTimingDetail("TEST: This is a timing update");
    console.log("   Timing line now shows:", `"${timingLine.textContent}"`);

    console.log("   ✅ Manual update test complete");
  } else {
    console.log("   ❌ Cannot test - missing components");
  }

  console.log("\n===================================");
};

export default MathPixPDFProcessor;
