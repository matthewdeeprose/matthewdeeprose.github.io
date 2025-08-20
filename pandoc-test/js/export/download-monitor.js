// download-monitor.js
// Download Monitoring and Duplicate Detection System
// Detects duplicate downloads and provides debug information

const DownloadMonitor = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

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
      console.error("[DOWNLOAD-MONITOR]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[DOWNLOAD-MONITOR]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[DOWNLOAD-MONITOR]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[DOWNLOAD-MONITOR]", message, ...args);
  }

  // ===========================================================================================
  // DOWNLOAD MONITORING CONFIGURATION
  // ===========================================================================================

  const MONITOR_CONFIG = {
    // Enable/disable monitoring (can be toggled at runtime)
    enabled: true,

    // Time window to consider downloads as duplicates (milliseconds)
    duplicateTimeWindow: 5000, // 5 seconds

    // Maximum number of download records to keep
    maxHistorySize: 50,

    // Enable developer debug modals
    showDebugModals: true,

    // Log level for duplicate detection
    duplicateLogLevel: LOG_LEVELS.WARN,
  };

  // ===========================================================================================
  // DOWNLOAD TRACKING SYSTEM
  // ===========================================================================================

  /**
   * Download Monitor Manager Class
   */
  class DownloadMonitorManager {
    constructor() {
      this.downloadHistory = [];
      this.isInitialised = false;
      this.currentSession = null;
      this.duplicateCallbacks = new Set();
    }

    /**
     * Initialise the download monitor
     */
    initialise() {
      if (this.isInitialised) return;

      logInfo("Initialising Download Monitor System...");

      // Start a new monitoring session
      this.currentSession = {
        sessionId: this.generateSessionId(),
        startTime: Date.now(),
        downloads: [],
        duplicatesDetected: 0,
      };

      this.isInitialised = true;
      logInfo("✅ Download Monitor System initialised", {
        sessionId: this.currentSession.sessionId,
        enabled: MONITOR_CONFIG.enabled,
      });
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId() {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Record a download attempt
     * @param {Object} downloadData - Download information
     */
    recordDownload(downloadData) {
      if (!MONITOR_CONFIG.enabled || !this.isInitialised) return;

      const timestamp = Date.now();
      const stackTrace = this.captureStackTrace();

      const downloadRecord = {
        id: this.generateDownloadId(),
        timestamp,
        filename: downloadData.filename,
        type: downloadData.type || "unknown",
        size: downloadData.size || 0,
        source: downloadData.source || "unknown",
        buttonStates: this.captureButtonStates(),
        stackTrace,
        sessionId: this.currentSession.sessionId,
        metadata: downloadData.metadata || {},
      };

      // Add to history
      this.downloadHistory.push(downloadRecord);
      this.currentSession.downloads.push(downloadRecord);

      // Cleanup old records
      if (this.downloadHistory.length > MONITOR_CONFIG.maxHistorySize) {
        this.downloadHistory.shift();
      }

      logDebug(
        "Download recorded:",
        downloadRecord.filename,
        downloadRecord.id
      );

      // Check for duplicates
      this.checkForDuplicates(downloadRecord);
    }

    /**
     * Generate unique download ID
     */
    generateDownloadId() {
      return `download_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 6)}`;
    }

    /**
     * Capture current stack trace
     */
    captureStackTrace() {
      try {
        throw new Error();
      } catch (e) {
        const stack = e.stack || "";
        return stack.split("\n").slice(2, 8).join("\n"); // Skip first 2 lines, keep relevant 6
      }
    }

    /**
     * Capture current button states for debugging
     */
    captureButtonStates() {
      const states = {};

      try {
        // Export button state
        const exportBtn = document.getElementById("exportButton");
        if (exportBtn) {
          states.exportButton = {
            disabled: exportBtn.disabled,
            innerHTML: exportBtn.innerHTML,
            hasInitFlag: exportBtn.hasAttribute("data-export-initialized"),
            initFlagValue: exportBtn.getAttribute("data-export-initialized"),
          };
        }

        // SCORM button state
        const scormBtn = document.getElementById("scormExportButton");
        if (scormBtn) {
          states.scormButton = {
            disabled: scormBtn.disabled,
            innerHTML: scormBtn.innerHTML,
            hasInitFlag: scormBtn.hasAttribute("data-scorm-initialized"),
            initFlagValue: scormBtn.getAttribute("data-scorm-initialized"),
          };
        }

        // Global export state
        states.globalExportState = {
          exportInProgress: window.exportGenerationInProgress || false,
          timestamp: Date.now(),
        };
      } catch (error) {
        states.captureError = error.message;
      }

      return states;
    }

    /**
     * Check for duplicate downloads
     * @param {Object} newDownload - The newly recorded download
     */
    checkForDuplicates(newDownload) {
      const duplicates = this.downloadHistory.filter((download) => {
        // Same filename
        const sameFilename = download.filename === newDownload.filename;

        // Within time window
        const timeDiff = newDownload.timestamp - download.timestamp;
        const withinTimeWindow =
          timeDiff <= MONITOR_CONFIG.duplicateTimeWindow && timeDiff > 0;

        // Different download ID (not the same record)
        const differentId = download.id !== newDownload.id;

        return sameFilename && withinTimeWindow && differentId;
      });

      if (duplicates.length > 0) {
        logWarn(`🚨 DUPLICATE DOWNLOAD DETECTED: ${newDownload.filename}`);
        logWarn(
          `Found ${duplicates.length} duplicate(s) within ${MONITOR_CONFIG.duplicateTimeWindow}ms`
        );

        this.currentSession.duplicatesDetected++;

        // Trigger duplicate callbacks
        this.duplicateCallbacks.forEach((callback) => {
          try {
            callback(newDownload, duplicates);
          } catch (error) {
            logError("Error in duplicate callback:", error);
          }
        });

        // Show debug modal if enabled
        if (MONITOR_CONFIG.showDebugModals) {
          this.showDuplicateDebugModal(newDownload, duplicates);
        }
      }
    }

    /**
     * Show debug modal with duplicate download information
     * @param {Object} newDownload - The duplicate download
     * @param {Array} duplicates - Array of previous duplicate downloads
     */
    showDuplicateDebugModal(newDownload, duplicates) {
      logInfo("Attempting to show duplicate debug modal...");

      if (typeof UniversalModal === "undefined") {
        logWarn("UniversalModal not available, skipping debug modal");
        // Fallback: log to console
        console.group("🚨 DUPLICATE DOWNLOAD DEBUG INFO");
        console.log("New Download:", newDownload);
        console.log("Previous Duplicates:", duplicates);
        console.log(
          "Debug Text:",
          this.generateDebugText(newDownload, duplicates)
        );
        console.groupEnd();
        return;
      }

      try {
        const debugContent = this.generateDebugContent(newDownload, duplicates);
        logInfo("Generated debug content, showing modal...");

        UniversalModal.custom(debugContent, {
          title: "🚨 Duplicate Download Detected - Debug Information",
          type: "warning",
          size: "large",
          buttons: [
            {
              text: "Copy Debug Info",
              type: "primary",
              action: async () => {
                try {
                  const debugText = this.generateDebugText(
                    newDownload,
                    duplicates
                  );
                  await navigator.clipboard.writeText(debugText);

                  if (typeof UniversalNotifications !== "undefined") {
                    UniversalNotifications.success(
                      "Debug information copied to clipboard!"
                    );
                  }
                } catch (error) {
                  console.log(
                    "📋 DEBUG INFO (Copy Failed):\n",
                    this.generateDebugText(newDownload, duplicates)
                  );
                  alert("Copy failed - debug info has been logged to console");
                }
                return false; // Don't close modal
              },
            },
            {
              text: "Disable Monitor",
              type: "secondary",
              action: () => {
                MONITOR_CONFIG.enabled = false;
                logInfo("Download monitoring disabled by user");
                if (typeof UniversalNotifications !== "undefined") {
                  UniversalNotifications.info("Download monitoring disabled");
                }
                return true; // Close modal
              },
            },
            {
              text: "Close",
              type: "secondary",
              action: "close",
            },
          ],
          allowBackgroundClose: true,
        });

        logInfo("✅ Debug modal displayed successfully");
      } catch (error) {
        logError("Failed to show debug modal:", error);

        // Fallback: log to console
        console.group("🚨 DUPLICATE DOWNLOAD DEBUG INFO (Modal Failed)");
        console.log("New Download:", newDownload);
        console.log("Previous Duplicates:", duplicates);
        console.log("Modal Error:", error);
        console.log(
          "Debug Text:",
          this.generateDebugText(newDownload, duplicates)
        );
        console.groupEnd();

        // Show simple alert as last resort
        alert(
          `🚨 Duplicate Download Detected: ${newDownload.filename}\n\nCheck console for detailed debug information.\n\nError: ${error.message}`
        );
      }
    }

    /**
     * Generate HTML content for debug modal
     * @param {Object} newDownload - The duplicate download
     * @param {Array} duplicates - Array of previous duplicate downloads
     */
    generateDebugContent(newDownload, duplicates) {
      const timeDiff =
        duplicates.length > 0
          ? newDownload.timestamp - duplicates[0].timestamp
          : 0;

      return `
          <div class="download-debug-info">
            <div class="debug-summary" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--warning-bg, #fff3cd); border-radius: 4px; border-left: 4px solid var(--warning-color, #f0ad4e);">
              <h4 style="margin: 0 0 0.5rem 0; color: var(--warning-color, #856404);">
                <span aria-hidden="true">⚠️</span> Duplicate Download Alert
              </h4>
              <p style="margin: 0;">
                <strong>File:</strong> <code>${this.escapeHtml(
                  newDownload.filename
                )}</code><br>
                <strong>Duplicates:</strong> ${
                  duplicates.length
                } within ${timeDiff}ms<br>
                <strong>Time Window:</strong> ${
                  MONITOR_CONFIG.duplicateTimeWindow
                }ms
              </p>
            </div>
  
            <div class="debug-sections">
              <details style="margin-bottom: 1rem;" open>
                <summary style="font-weight: bold; cursor: pointer; padding: 0.5rem; background: var(--surface-color, #f8f9fa); border-radius: 4px;">
                  📊 Download Comparison
                </summary>
                <div style="padding: 1rem; border: 1px solid var(--border-color, #dee2e6); margin-top: 0.5rem; border-radius: 4px;">
                  ${this.generateDownloadComparisonTable(
                    newDownload,
                    duplicates
                  )}
                </div>
              </details>
  
              <details style="margin-bottom: 1rem;">
                <summary style="font-weight: bold; cursor: pointer; padding: 0.5rem; background: var(--surface-color, #f8f9fa); border-radius: 4px;">
                  🔘 Button States Analysis
                </summary>
                <div style="padding: 1rem; border: 1px solid var(--border-color, #dee2e6); margin-top: 0.5rem; border-radius: 4px;">
                  ${this.generateButtonStatesAnalysis(newDownload, duplicates)}
                </div>
              </details>
  
              <details style="margin-bottom: 1rem;">
                <summary style="font-weight: bold; cursor: pointer; padding: 0.5rem; background: var(--surface-color, #f8f9fa); border-radius: 4px;">
                  📋 Stack Trace Comparison
                </summary>
                <div style="padding: 1rem; border: 1px solid var(--border-color, #dee2e6); margin-top: 0.5rem; border-radius: 4px;">
                  ${this.generateStackTraceComparison(newDownload, duplicates)}
                </div>
              </details>
  
              <details style="margin-bottom: 1rem;">
                <summary style="font-weight: bold; cursor: pointer; padding: 0.5rem; background: var(--surface-color, #f8f9fa); border-radius: 4px;">
                  🔧 Debugging Recommendations
                </summary>
                <div style="padding: 1rem; border: 1px solid var(--border-color, #dee2e6); margin-top: 0.5rem; border-radius: 4px;">
                  ${this.generateDebuggingRecommendations(
                    newDownload,
                    duplicates
                  )}
                </div>
              </details>
            </div>
          </div>
        `;
    }

    /**
     * Generate download comparison table
     */
    generateDownloadComparisonTable(newDownload, duplicates) {
      let table = `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
              <tr style="background: var(--surface-color, #f8f9fa);">
                <th style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6); text-align: left;">Property</th>
                <th style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6); text-align: left;">New Download</th>
                <th style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6); text-align: left;">Previous Download</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><strong>Filename</strong></td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><code>${this.escapeHtml(
                  newDownload.filename
                )}</code></td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><code>${this.escapeHtml(
                  duplicates[0].filename
                )}</code></td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><strong>Timestamp</strong></td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${new Date(
                  newDownload.timestamp
                ).toISOString()}</td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${new Date(
                  duplicates[0].timestamp
                ).toISOString()}</td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><strong>Time Difference</strong></td>
                <td colspan="2" style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6); text-align: center; background: var(--warning-bg, #fff3cd);">
                  ${newDownload.timestamp - duplicates[0].timestamp}ms
                </td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><strong>Type</strong></td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${
                  newDownload.type
                }</td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${
                  duplicates[0].type
                }</td>
              </tr>
              <tr>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);"><strong>Source</strong></td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${
                  newDownload.source
                }</td>
                <td style="padding: 0.5rem; border: 1px solid var(--border-color, #dee2e6);">${
                  duplicates[0].source
                }</td>
              </tr>
            </tbody>
          </table>
        `;
      return table;
    }

    /**
     * Generate button states analysis
     */
    generateButtonStatesAnalysis(newDownload, duplicates) {
      const newStates = newDownload.buttonStates || {};
      const oldStates = duplicates[0].buttonStates || {};

      let analysis =
        '<div style="font-family: monospace; font-size: 0.875rem;">';

      // Export button analysis
      if (newStates.exportButton || oldStates.exportButton) {
        analysis += "<h5>Export Button:</h5>";
        analysis += this.compareButtonState(
          "exportButton",
          newStates.exportButton,
          oldStates.exportButton
        );
      }

      // SCORM button analysis
      if (newStates.scormButton || oldStates.scormButton) {
        analysis += "<h5>SCORM Button:</h5>";
        analysis += this.compareButtonState(
          "scormButton",
          newStates.scormButton,
          oldStates.scormButton
        );
      }

      // Global state analysis
      analysis += "<h5>Global Export State:</h5>";
      analysis += this.compareGlobalState(
        newStates.globalExportState,
        oldStates.globalExportState
      );

      analysis += "</div>";
      return analysis;
    }

    /**
     * Compare button state between downloads
     */
    compareButtonState(buttonName, newState, oldState) {
      if (!newState && !oldState) return "<p>No state captured</p>";

      const newS = newState || {};
      const oldS = oldState || {};

      return `
          <table style="width: 100%; margin-bottom: 1rem; border-collapse: collapse; font-size: 0.8rem;">
            <tr>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 30%;"><strong>Disabled:</strong></td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 35%;">${
                newS.disabled
              }</td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 35%;">${
                oldS.disabled
              }</td>
            </tr>
            <tr>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);"><strong>Has Init Flag:</strong></td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);">${
                newS.hasInitFlag
              }</td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);">${
                oldS.hasInitFlag
              }</td>
            </tr>
            <tr>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);"><strong>Init Flag Value:</strong></td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);">${
                newS.initFlagValue || "null"
              }</td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc);">${
                oldS.initFlagValue || "null"
              }</td>
            </tr>
          </table>
        `;
    }

    /**
     * Compare global export state
     */
    compareGlobalState(newState, oldState) {
      const newS = newState || {};
      const oldS = oldState || {};

      return `
          <table style="width: 100%; margin-bottom: 1rem; border-collapse: collapse; font-size: 0.8rem;">
            <tr>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 30%;"><strong>Export In Progress:</strong></td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 35%;">${newS.exportInProgress}</td>
              <td style="padding: 0.25rem; border: 1px solid var(--border-color, #ccc); width: 35%;">${oldS.exportInProgress}</td>
            </tr>
          </table>
        `;
    }

    /**
     * Generate stack trace comparison
     */
    generateStackTraceComparison(newDownload, duplicates) {
      return `
          <div style="font-family: monospace; font-size: 0.75rem;">
            <h5>New Download Stack Trace:</h5>
            <pre style="background: var(--surface-color, #f8f9fa); padding: 0.5rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${this.escapeHtml(
              newDownload.stackTrace || "No stack trace"
            )}</pre>
            
            <h5>Previous Download Stack Trace:</h5>
            <pre style="background: var(--surface-color, #f8f9fa); padding: 0.5rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${this.escapeHtml(
              duplicates[0].stackTrace || "No stack trace"
            )}</pre>
          </div>
        `;
    }

    /**
     * Generate debugging recommendations
     */
    generateDebuggingRecommendations(newDownload, duplicates) {
      const recommendations = [];

      // Check button states
      const newStates = newDownload.buttonStates || {};
      const oldStates = duplicates[0].buttonStates || {};

      // Check for missing initialization flags
      if (newStates.exportButton && !newStates.exportButton.hasInitFlag) {
        recommendations.push(
          "🔴 Export button missing initialization flag - check setupEnhancedExportHandlers()"
        );
      }

      if (newStates.scormButton && !newStates.scormButton.hasInitFlag) {
        recommendations.push(
          "🔴 SCORM button missing initialization flag - check setupSCORMExportHandlers()"
        );
      }

      // Check for global state issues
      if (
        newStates.globalExportState &&
        newStates.globalExportState.exportInProgress &&
        oldStates.globalExportState &&
        oldStates.globalExportState.exportInProgress
      ) {
        recommendations.push(
          "🔴 Export already in progress - check exportGenerationInProgress flag management"
        );
      }

      // Check time gap
      const timeDiff = newDownload.timestamp - duplicates[0].timestamp;
      if (timeDiff < 100) {
        recommendations.push(
          "🔴 Very short time gap (" +
            timeDiff +
            "ms) suggests rapid-fire event handlers"
        );
      }

      // Check file type patterns
      if (newDownload.type !== duplicates[0].type) {
        recommendations.push(
          "🟡 Different download types - may be legitimate different exports"
        );
      }

      // Stack trace analysis
      if (newDownload.stackTrace === duplicates[0].stackTrace) {
        recommendations.push(
          "🔴 Identical stack traces - likely duplicate event handler"
        );
      }

      if (recommendations.length === 0) {
        recommendations.push(
          "✅ No obvious issues detected - may be legitimate user behaviour"
        );
      }

      return `
          <ul style="margin: 0; padding-left: 1.5rem;">
            ${recommendations
              .map((rec) => `<li style="margin-bottom: 0.5rem;">${rec}</li>`)
              .join("")}
          </ul>
          
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--info-bg, #cce5ff); border-radius: 4px;">
            <strong>Next Steps:</strong>
            <ol style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
              <li>Check if event listeners are being added multiple times</li>
              <li>Verify initialization flags are correctly set/checked</li>
              <li>Look for missing return statements or preventDefault() calls</li>
              <li>Test with testAllSafe() to ensure no regression</li>
            </ol>
          </div>
        `;
    }

    /**
     * Generate plain text debug information for copying
     */
    generateDebugText(newDownload, duplicates) {
      const timeDiff =
        duplicates.length > 0
          ? newDownload.timestamp - duplicates[0].timestamp
          : 0;

      return `
  🚨 DUPLICATE DOWNLOAD DETECTED - DEBUG REPORT
  ==============================================
  
  SUMMARY:
  - File: ${newDownload.filename}
  - Duplicates: ${duplicates.length} within ${timeDiff}ms
  - Session: ${newDownload.sessionId}
  - Detection Time: ${new Date().toISOString()}
  
  DOWNLOAD COMPARISON:
  - New Download ID: ${newDownload.id}
  - Previous Download ID: ${duplicates[0].id}
  - Time Difference: ${timeDiff}ms
  - New Type: ${newDownload.type}
  - Previous Type: ${duplicates[0].type}
  
  BUTTON STATES:
  ${JSON.stringify(newDownload.buttonStates, null, 2)}
  
  STACK TRACE (New):
  ${newDownload.stackTrace}
  
  STACK TRACE (Previous):
  ${duplicates[0].stackTrace}
  
  RECOMMENDATIONS:
  ${this.generateDebuggingRecommendations(newDownload, duplicates).replace(
    /<[^>]*>/g,
    ""
  )}
  
  Generated by Enhanced Pandoc-WASM Mathematical Playground
  Download Monitor System v1.0
        `.trim();
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Register a callback for duplicate detection
     * @param {Function} callback - Callback function (newDownload, duplicates) => void
     */
    onDuplicateDetected(callback) {
      this.duplicateCallbacks.add(callback);
    }

    /**
     * Remove a duplicate detection callback
     * @param {Function} callback - Callback to remove
     */
    removeDuplicateCallback(callback) {
      this.duplicateCallbacks.delete(callback);
    }

    /**
     * Get current monitoring status
     */
    getStatus() {
      return {
        enabled: MONITOR_CONFIG.enabled,
        initialised: this.isInitialised,
        currentSession: this.currentSession?.sessionId,
        totalDownloads: this.downloadHistory.length,
        sessionDownloads: this.currentSession?.downloads.length || 0,
        duplicatesDetected: this.currentSession?.duplicatesDetected || 0,
        configuration: { ...MONITOR_CONFIG },
      };
    }

    /**
     * Get download history
     */
    getHistory() {
      return [...this.downloadHistory];
    }

    /**
     * Clear download history
     */
    clearHistory() {
      this.downloadHistory = [];
      if (this.currentSession) {
        this.currentSession.downloads = [];
        this.currentSession.duplicatesDetected = 0;
      }
      logInfo("Download history cleared");
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
      MONITOR_CONFIG.enabled = !!enabled;
      logInfo(`Download monitoring ${enabled ? "enabled" : "disabled"}`);
    }

    /**
     * Configure monitoring settings
     */
    configure(config) {
      Object.assign(MONITOR_CONFIG, config);
      logInfo("Download monitor configuration updated:", config);
    }
  }

  // ===========================================================================================
  // SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
  // ===========================================================================================

  // Create singleton instance
  const monitor = new DownloadMonitorManager();

  /**
   * Convenience function to record a download
   * @param {string} filename - Downloaded filename
   * @param {Object} options - Additional options
   */
  function recordDownload(filename, options = {}) {
    if (!monitor.isInitialised) {
      monitor.initialise();
    }

    const downloadData = {
      filename,
      type: options.type || "html",
      size: options.size || 0,
      source: options.source || "export-system",
      metadata: options.metadata || {},
    };

    monitor.recordDownload(downloadData);
  }

  /**
   * Test the monitoring system
   */
  function testMonitoring() {
    logInfo("🧪 Testing Download Monitor System...");

    const tests = {
      instanceExists: () => !!monitor,
      canInitialise: () => {
        monitor.initialise();
        return monitor.isInitialised;
      },
      canRecordDownload: () => {
        const before = monitor.downloadHistory.length;
        recordDownload("test-file.html", {
          type: "test",
          source: "test-system",
        });
        return monitor.downloadHistory.length === before + 1;
      },
      canDetectDuplicates: () => {
        // Record two downloads with same filename quickly
        recordDownload("duplicate-test.html", {
          type: "test",
          source: "test-system",
        });
        recordDownload("duplicate-test.html", {
          type: "test",
          source: "test-system",
        });
        return monitor.currentSession.duplicatesDetected > 0;
      },
      hasCorrectStatus: () => {
        const status = monitor.getStatus();
        return status.enabled && status.initialised;
      },
    };

    const results = {};
    Object.entries(tests).forEach(([testName, testFn]) => {
      try {
        results[testName] = testFn();
      } catch (error) {
        results[testName] = false;
        logError(`Test ${testName} failed:`, error);
      }
    });

    const allPassed = Object.values(results).every((result) => result === true);

    logInfo(
      allPassed
        ? "✅ All download monitor tests passed"
        : "❌ Some download monitor tests failed"
    );
    logInfo("Test results:", results);

    return {
      success: allPassed,
      results,
      status: monitor.getStatus(),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main functions
    recordDownload,

    // Monitor instance access
    getInstance: () => monitor,

    // Configuration
    configure: (config) => monitor.configure(config),
    setEnabled: (enabled) => monitor.setEnabled(enabled),

    // Status and history
    getStatus: () => monitor.getStatus(),
    getHistory: () => monitor.getHistory(),
    clearHistory: () => monitor.clearHistory(),

    // Event handling
    onDuplicateDetected: (callback) => monitor.onDuplicateDetected(callback),
    removeDuplicateCallback: (callback) =>
      monitor.removeDuplicateCallback(callback),

    // Testing
    test: testMonitoring,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.DownloadMonitor = DownloadMonitor;

// Auto-initialise when script loads
DownloadMonitor.getInstance().initialise();
