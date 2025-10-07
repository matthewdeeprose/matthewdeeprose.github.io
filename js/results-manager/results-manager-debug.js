/**
 * @module DebugManager
 * @description Manages debug functionality with formatted content display toggle
 */
import { ResultsManagerUtils } from "./results-manager-utils.js";

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

export class DebugManager {
  /**
   * Create a new DebugManager instance
   */
  constructor() {
    this.debugMode = false;
    this.showFormattedContent = false; // NEW: Default to false to prevent duplicate rendering
    this.lastFormattedContent = ""; // NEW: Store last formatted content for toggle functionality
    this.utils = new ResultsManagerUtils();

    // Initialise logging configuration
    this.currentLogLevel = DEFAULT_LOG_LEVEL;
    this.loggingEnabled = !DISABLE_ALL_LOGGING;
    this.allLoggingEnabled = ENABLE_ALL_LOGGING;

    this.logInfo("Debug manager initialised");

    // Ensure debug container is hidden on initialisation
    this.hideDebugContainer();
  }

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  shouldLog(level) {
    if (!this.loggingEnabled) return false;
    if (this.allLoggingEnabled) return true;
    return level <= this.currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to include
   */
  logError(message, data = {}) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[DEBUG MANAGER ERROR] ${message}`, data);
      this.utils.log(message, data, "error");
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to include
   */
  logWarn(message, data = {}) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[DEBUG MANAGER WARN] ${message}`, data);
      this.utils.log(message, data, "warn");
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to include
   */
  logInfo(message, data = {}) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[DEBUG MANAGER INFO] ${message}`, data);
      this.utils.log(message, data);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to include
   */
  logDebug(message, data = {}) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[DEBUG MANAGER DEBUG] ${message}`, data);
      this.utils.log(message, data);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - The new logging level
   */
  setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      this.currentLogLevel = level;
      this.logInfo(`Logging level set to ${Object.keys(LOG_LEVELS)[level]}`);
    } else {
      this.logWarn(`Invalid logging level: ${level}`);
    }
  }

  /**
   * Enable or disable all logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setLoggingEnabled(enabled) {
    this.loggingEnabled = enabled;
    if (enabled) {
      this.logInfo("Logging enabled");
    }
  }

  /**
   * Toggle formatted content display
   * @param {boolean} enabled - Whether to show formatted content
   */
  setFormattedContentDisplay(enabled) {
    this.logDebug(`Setting formatted content display to ${enabled}`);
    this.showFormattedContent = enabled;

    // Update the formatted content panel visibility
    const formattedPanel = document.querySelector(
      ".debug-panel.formatted-panel"
    );
    if (formattedPanel) {
      formattedPanel.style.display = enabled ? "block" : "none";
      this.logDebug(`Formatted content panel ${enabled ? "shown" : "hidden"}`);
    }

    // Update the toggle button state if it exists
    const formattedToggle = document.getElementById("formatted-content-toggle");
    if (formattedToggle) {
      formattedToggle.checked = enabled;
    }

    // FIXED: Re-render the formatted content immediately if we have stored content
    if (enabled && this.debugMode) {
      const formattedElement = document.getElementById("formatted-response");
      if (formattedElement && this.lastFormattedContent) {
        this.logDebug("Re-rendering stored formatted content");
        formattedElement.innerHTML = this.lastFormattedContent;
        this.logInfo("Formatted content display enabled and content rendered");
      } else if (formattedElement) {
        // If no stored content, show the message
        formattedElement.innerHTML =
          '<div class="debug-message" style="padding: 1rem; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; color: #666;"><p>No formatted content available yet. Content will appear when next response is processed.</p></div>';
        this.logDebug("No stored formatted content available");
      }
    } else if (!enabled && this.debugMode) {
      // Re-apply the disabled message
      const formattedElement = document.getElementById("formatted-response");
      if (formattedElement) {
        formattedElement.innerHTML =
          '<div class="debug-message" style="padding: 1rem; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; color: #666;"><p>Formatted content display is disabled to prevent duplicate rendering of graphs and diagrams.</p><p>Enable "Show formatted content" to view the processed HTML.</p></div>';
        this.logDebug("Re-applied disabled message");
      }
    }

    return enabled;
  }

  /**
   * Hide the debug container and its contents
   */
  hideDebugContainer() {
    // Get the debug container
    const debugContainer = document.getElementById("response-debug-container");
    if (debugContainer) {
      // Force hide the container with !important
      debugContainer.style.cssText =
        "display: none !important; visibility: hidden !important;";

      // Explicitly hide the toggle button too
      const toggleButton = debugContainer.querySelector(".debug-toggle-button");
      if (toggleButton) {
        toggleButton.style.cssText =
          "display: none !important; visibility: hidden !important;";
        this.logDebug("Debug toggle button explicitly hidden");
      } else {
        this.logDebug("Debug toggle button not found");
      }

      this.logDebug("Debug container hidden on initialisation with !important");

      // Add a delayed check to verify the container and button remain hidden
      setTimeout(() => {
        const containerCheck = document.getElementById(
          "response-debug-container"
        );
        const buttonCheck = containerCheck?.querySelector(
          ".debug-toggle-button"
        );

        this.logDebug("Delayed check - Container visibility", {
          container: containerCheck
            ? getComputedStyle(containerCheck).display
            : "not found",
          button: buttonCheck
            ? getComputedStyle(buttonCheck).display
            : "not found",
        });

        // If still visible, try hiding again with a different approach
        if (
          containerCheck &&
          getComputedStyle(containerCheck).display !== "none"
        ) {
          containerCheck.style.cssText =
            "display: none !important; visibility: hidden !important;";
          this.logDebug("Container still visible, forced hide again");
        }

        if (buttonCheck && getComputedStyle(buttonCheck).display !== "none") {
          buttonCheck.style.cssText =
            "display: none !important; visibility: hidden !important;";
          this.logDebug("Button still visible, forced hide again");
        }
      }, 100);
    } else {
      this.logDebug("Debug container not found during initialisation");
    }
  }

  /**
   * Enable debugging mode for response formatting
   * @param {boolean} enabled - Whether debugging mode is enabled
   */
  setDebugMode(enabled = false) {
    this.debugMode = enabled;
    this.logInfo(`Debug mode ${enabled ? "enabled" : "disabled"}`);

    // Show or hide debug container based on enabled state
    this.updateDebugContainer();

    // Verify debug container visibility was updated as expected
    const container = document.getElementById("response-debug-container");
    this.logDebug(
      `Debug container ${
        container && container.style.display !== "none" ? "visible" : "hidden"
      } after updateDebugContainer call`
    );

    if (enabled && (!container || container.style.display === "none")) {
      this.logError(
        "Failed to show debug container even though debug mode is enabled"
      );
    }

    return enabled; // Return the state for confirmation
  }

  /**
   * Show or hide the debug container based on debug mode
   */
  updateDebugContainer() {
    this.logDebug("updateDebugContainer called", {
      debugMode: this.debugMode,
    });

    // Get the existing debug container
    const debugContainer = document.getElementById("response-debug-container");
    if (!debugContainer) {
      this.logError("Debug container not found in the DOM");
      return;
    }

    // Remove existing debug container if it exists
    if (debugContainer) {
      // If debug mode is not enabled, hide the container
      if (!this.debugMode) {
        this.logDebug("Debug mode not enabled, hiding container");
        debugContainer.style.display = "none";
        return;
      }

      // If debug mode is enabled, show the container and toggle button
      this.logDebug("Debug mode enabled, showing container and toggle button");
      debugContainer.style.cssText =
        "display: flex !important; visibility: visible !important;";

      // Explicitly show the toggle button
      const toggleButton = debugContainer.querySelector(".debug-toggle-button");
      if (toggleButton) {
        toggleButton.style.cssText =
          "display: block !important; visibility: visible !important;";
        this.logDebug("Debug toggle button explicitly shown");
      } else {
        this.logDebug("Debug toggle button not found");
      }
    }

    // Add event listeners if they haven't been added yet
    this.addEventListeners();

    // Verify the container was successfully shown/hidden
    const containerCheck = document.getElementById("response-debug-container");
    if (containerCheck) {
      this.logDebug("Debug container successfully updated", {
        id: containerCheck.id,
        className: containerCheck.className,
        display: containerCheck.style.display,
        childElementCount: containerCheck.childElementCount,
      });

      // Check if the debug elements exist
      const rawElement = document.getElementById("raw-response");
      const formattedElement = document.getElementById("formatted-response");
      const semanticElement = document.getElementById("semantic-analysis");

      this.logDebug("Debug elements found", {
        rawElement: !!rawElement,
        formattedElement: !!formattedElement,
        semanticElement: !!semanticElement,
      });

      this.logInfo("Debug container updated successfully");
    } else {
      this.logError(
        "Failed to update debug container - not found in DOM after update"
      );

      // Try to diagnose the issue
      this.logDebug("Document body children count", {
        count: document.body.childElementCount,
        lastChildTag: document.body.lastElementChild?.tagName,
      });
    }
  }

  /**
   * Add event listeners to the debug panel buttons
   */
  addEventListeners() {
    // Get the toggle button and content container
    const toggleButton = document.querySelector(".debug-toggle-button");
    const debugContent = document.getElementById("debug-content");

    if (!toggleButton || !debugContent) {
      this.logError("Toggle button or debug content not found");
      return;
    }

    // Only add the event listener if it hasn't been added yet
    if (!toggleButton._hasClickListener) {
      toggleButton.addEventListener("click", () => {
        const isExpanded =
          toggleButton.getAttribute("aria-expanded") === "true";
        const newExpandedState = !isExpanded;
        toggleButton.setAttribute("aria-expanded", newExpandedState);

        // Set display style based on expanded state
        debugContent.style.display = newExpandedState ? "flex" : "none";

        this.logDebug(
          `Toggle button clicked, debug content is now ${
            newExpandedState ? "visible" : "hidden"
          }`,
          {
            isExpanded: newExpandedState,
            display: debugContent.style.display,
          }
        );

        // If expanding, make sure we have content to show
        if (newExpandedState) {
          const rawElement = document.getElementById("raw-response");
          const formattedElement =
            document.getElementById("formatted-response");

          if (rawElement && formattedElement) {
            // Check if we have content
            const hasRawContent =
              rawElement.textContent &&
              rawElement.textContent.trim().length > 0;
            const hasFormattedContent =
              formattedElement.innerHTML &&
              formattedElement.innerHTML.trim().length > 0;

            this.logDebug("Debug content check on toggle", {
              hasRawContent,
              hasFormattedContent,
              rawContentLength: rawElement.textContent?.length || 0,
              formattedContentLength: formattedElement.innerHTML?.length || 0,
            });
          }
        }
      });

      // Mark that we've added the listener to avoid duplicates
      toggleButton._hasClickListener = true;
    }

    // Add download button event listeners
    this.addDownloadListeners();

    // Add formatted content toggle listener
    this.addFormattedContentToggleListener();
  }

  /**
   * Add event listener for formatted content toggle
   */
  addFormattedContentToggleListener() {
    const formattedToggle = document.getElementById("formatted-content-toggle");
    if (formattedToggle && !formattedToggle._hasChangeListener) {
      formattedToggle.addEventListener("change", (e) => {
        this.setFormattedContentDisplay(e.target.checked);
      });

      formattedToggle._hasChangeListener = true;
      this.logDebug("Formatted content toggle listener added");
    }
  }

  /**
   * Add event listeners to download buttons and create copy buttons
   */
  addDownloadListeners() {
    this.logDebug("addDownloadListeners called");

    const downloadRawBtn = document.getElementById("download-raw");
    const downloadFormattedBtn = document.getElementById("download-formatted");
    const downloadSemanticBtn = document.getElementById("download-semantic");

    this.logDebug("Download buttons found", {
      rawBtn: !!downloadRawBtn,
      formattedBtn: !!downloadFormattedBtn,
      semanticBtn: !!downloadSemanticBtn,
    });

    // Add event listeners with null checks and create copy buttons
    if (downloadRawBtn) {
      if (!downloadRawBtn._hasClickListener) {
        downloadRawBtn.addEventListener("click", () => {
          this.downloadContent("raw-response", "markdown");
        });
        downloadRawBtn._hasClickListener = true;
        this.logDebug("Added click listener to raw download button");
      }
      this.createCopyButtonInline(downloadRawBtn, "raw-response", "markdown");
    } else {
      this.logWarn("download-raw button not found");
    }

    if (downloadFormattedBtn) {
      if (!downloadFormattedBtn._hasClickListener) {
        downloadFormattedBtn.addEventListener("click", () => {
          this.downloadContent("formatted-response", "html");
        });
        downloadFormattedBtn._hasClickListener = true;
        this.logDebug("Added click listener to formatted download button");
      }
      this.createCopyButtonInline(
        downloadFormattedBtn,
        "formatted-response",
        "html"
      );
    } else {
      this.logWarn("download-formatted button not found");
    }

    if (downloadSemanticBtn) {
      if (!downloadSemanticBtn._hasClickListener) {
        downloadSemanticBtn.addEventListener("click", () => {
          this.downloadContent("semantic-analysis", "json");
        });
        downloadSemanticBtn._hasClickListener = true;
        this.logDebug("Added click listener to semantic download button");
      }
      this.createCopyButtonInline(
        downloadSemanticBtn,
        "semantic-analysis",
        "json"
      );
    } else {
      this.logWarn("download-semantic button not found");
    }
  }

  /**
   * Create copy button inline with integrated UniversalNotifications
   */
  createCopyButtonInline(downloadButton, elementId, type) {
    try {
      this.logDebug(`Creating copy button inline for ${elementId}`, { type });

      if (!downloadButton) {
        this.logError(
          `Cannot add copy button: download button is null for ${elementId}`
        );
        return;
      }

      // Check if copy button already exists
      const copyButtonId = `copy-${elementId}-btn`;
      let existingCopyBtn = document.getElementById(copyButtonId);

      if (existingCopyBtn) {
        this.logDebug(`Copy button already exists for ${elementId}`);
        return;
      }

      // Create copy button
      const copyButton = document.createElement("button");
      copyButton.id = copyButtonId;
      copyButton.className = "copy-button";
      copyButton.setAttribute(
        "aria-label",
        `Copy ${type} content to clipboard`
      );
      copyButton.setAttribute("title", `Copy ${type} content to clipboard`);
      copyButton.innerHTML = '<span class="copy-icon">📋</span> Copy';

      // Add styling
      copyButton.style.cssText = `
      margin-left: 8px;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;

      // Add click event listener
      copyButton.addEventListener("click", async () => {
        try {
          this.logInfo(`Copying ${type} content from ${elementId}`);

          const element = document.getElementById(elementId);
          if (!element) {
            this.logError(`Element not found: ${elementId}`);

            // Use UniversalNotifications for warnings if available
            if (window.notifyWarning) {
              window.notifyWarning(
                "Content not found. Please ensure debug mode is enabled."
              );
            } else if (window.UniversalNotifications) {
              window.UniversalNotifications.warning(
                "Content not found. Please ensure debug mode is enabled."
              );
            } else {
              alert("Content not found. Please ensure debug mode is enabled.");
            }
            return;
          }

          let content = "";

          // Get content based on type
          switch (type) {
            case "markdown":
              content = element.textContent || "";
              break;
            case "html":
              // UPDATED: Check if formatted content is being shown
              if (
                !this.showFormattedContent &&
                elementId === "formatted-response"
              ) {
                if (window.notifyWarning) {
                  window.notifyWarning(
                    "Formatted content display is disabled. Enable 'Show formatted content' to copy HTML."
                  );
                } else if (window.UniversalNotifications) {
                  window.UniversalNotifications.warning(
                    "Formatted content display is disabled. Enable 'Show formatted content' to copy HTML."
                  );
                } else {
                  alert(
                    "Formatted content display is disabled. Enable 'Show formatted content' to copy HTML."
                  );
                }
                return;
              }
              content = element.innerHTML || "";
              break;
            case "json":
              const jsonElement = element.querySelector(".semantic-json pre");
              if (jsonElement) {
                content = jsonElement.textContent || "";
                try {
                  const jsonObj = JSON.parse(content);
                  content = JSON.stringify(jsonObj, null, 2);
                } catch (e) {
                  // Use raw content if JSON parsing fails
                }
              } else {
                content = element.textContent || "";
              }
              break;
            default:
              content = element.textContent || "";
          }

          if (!content.trim()) {
            this.logWarn(`No content to copy for ${elementId}`);

            // Use UniversalNotifications for warnings if available
            if (window.notifyWarning) {
              window.notifyWarning(
                "No content available to copy. Try viewing a response first."
              );
            } else if (window.UniversalNotifications) {
              window.UniversalNotifications.warning(
                "No content available to copy. Try viewing a response first."
              );
            } else {
              alert(
                "No content available to copy. Try viewing a response first."
              );
            }
            return;
          }

          // Copy to clipboard
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(content);
            this.logInfo(`Successfully copied ${type} content`, {
              contentLength: content.length,
            });

            // Use UniversalNotifications if available
            if (window.notifySuccess) {
              window.notifySuccess(
                `${
                  type.charAt(0).toUpperCase() + type.slice(1)
                } content copied to clipboard!`
              );
            } else if (window.UniversalNotifications) {
              window.UniversalNotifications.success(
                `${
                  type.charAt(0).toUpperCase() + type.slice(1)
                } content copied to clipboard!`
              );
            } else {
              this.showSimpleFeedback(
                `${
                  type.charAt(0).toUpperCase() + type.slice(1)
                } content copied!`,
                "success"
              );
            }
          } else {
            // Fallback method
            const textArea = document.createElement("textarea");
            textArea.value = content;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.setAttribute("aria-hidden", "true");

            document.body.appendChild(textArea);
            textArea.select();

            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);

            if (successful) {
              this.logInfo(
                `Successfully copied ${type} content using fallback`
              );

              // Use UniversalNotifications if available
              if (window.notifySuccess) {
                window.notifySuccess(
                  `${
                    type.charAt(0).toUpperCase() + type.slice(1)
                  } content copied to clipboard!`
                );
              } else if (window.UniversalNotifications) {
                window.UniversalNotifications.success(
                  `${
                    type.charAt(0).toUpperCase() + type.slice(1)
                  } content copied to clipboard!`
                );
              } else {
                this.showSimpleFeedback(
                  `${
                    type.charAt(0).toUpperCase() + type.slice(1)
                  } content copied!`,
                  "success"
                );
              }
            } else {
              throw new Error("Copy operation failed");
            }
          }
        } catch (error) {
          this.logError(`Error copying ${type} content`, { error });

          // Use UniversalNotifications for errors if available
          if (window.notifyError) {
            window.notifyError(`Failed to copy content: ${error.message}`);
          } else if (window.UniversalNotifications) {
            window.UniversalNotifications.error(
              `Failed to copy content: ${error.message}`
            );
          } else {
            alert(`Failed to copy content: ${error.message}`);
          }
        }
      });

      // Insert copy button after download button
      if (downloadButton.parentNode) {
        downloadButton.parentNode.insertBefore(
          copyButton,
          downloadButton.nextSibling
        );
        this.logInfo(`Copy button successfully added for ${elementId}`, {
          type,
        });
      } else {
        this.logError(
          `Cannot insert copy button: download button has no parent node for ${elementId}`
        );
      }
    } catch (error) {
      this.logError(`Error creating copy button for ${elementId}`, {
        error,
        type,
      });
    }
  }

  /**
   * Show simple feedback to user
   */
  showSimpleFeedback(message, type = "info") {
    try {
      // Create simple feedback element
      const feedback = document.createElement("div");
      feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        background: ${type === "success" ? "#10b981" : "#3b82f6"};
        color: white;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;
      feedback.textContent = message;
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");

      document.body.appendChild(feedback);

      // Remove after 3 seconds
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 3000);
    } catch (error) {
      this.logError("Error showing feedback", { error });
      alert(message);
    }
  }

  /**
   * Download content from a debug panel
   * @param {string} elementId - ID of the element containing content to download
   * @param {string} type - Type of content ('markdown', 'html', or 'json')
   */
  downloadContent(elementId, type) {
    try {
      this.logInfo(`Starting download of ${type} content from ${elementId}`);

      const element = document.getElementById(elementId);
      if (!element) {
        this.logError(`Element with ID "${elementId}" not found for download`);
        alert(
          `Cannot download: Debug panel element not found. Make sure debug mode is enabled.`
        );
        return;
      }

      let content = "";
      let filename = "";
      let mimeType = "";

      // Get content based on element type and format
      switch (type) {
        case "markdown":
          content = element.textContent || "";
          if (!content.trim()) {
            this.logWarn("No markdown content to download");
            alert(
              "No content available to download. Try viewing a response first."
            );
            return;
          }
          filename = `response-${Date.now()}.md`;
          mimeType = "text/markdown";
          this.logDebug("Prepared markdown content for download", {
            contentLength: content.length,
          });
          break;

        case "html":
          // For HTML, we need to get the actual HTML content
          if (elementId === "formatted-response") {
            // UPDATED: Check if formatted content is being shown
            if (!this.showFormattedContent) {
              alert(
                "Formatted content display is disabled. Enable 'Show formatted content' in debug settings to download HTML content."
              );
              return;
            }

            // Clone the element to avoid modifying the displayed content
            const clone = element.cloneNode(true);

            if (!clone.innerHTML.trim()) {
              this.logWarn("No HTML content to download");
              alert(
                "No formatted content available to download. Try viewing a response first."
              );
              return;
            }

            // Create a basic HTML document structure
            content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formatted Response</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin: 1em 0; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow: auto; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`;
          } else {
            content = element.innerHTML || "";
            if (!content.trim()) {
              this.logWarn("No HTML content to download");
              alert(
                "No HTML content available to download. Try viewing a response first."
              );
              return;
            }
          }
          filename = `response-${Date.now()}.html`;
          mimeType = "text/html";
          this.logDebug("Prepared HTML content for download", {
            contentLength: content.length,
          });
          break;

        case "json":
          // For JSON, extract the machine-readable part
          const jsonElement = element.querySelector(".semantic-json pre");
          if (jsonElement && jsonElement.textContent.trim()) {
            content = jsonElement.textContent || "";
            try {
              // Pretty-print the JSON
              const jsonObj = JSON.parse(content);
              content = JSON.stringify(jsonObj, null, 2);
              this.logDebug(
                "Successfully parsed and formatted JSON for download"
              );
            } catch (e) {
              this.logWarn("Failed to parse JSON for pretty-printing", {
                error: e,
              });
              // Continue with the raw content
            }
          } else {
            content = element.textContent || "";
            if (!content.trim()) {
              this.logWarn("No JSON content to download");
              alert(
                "No semantic analysis available to download. Try viewing a response first."
              );
              return;
            }
          }
          filename = `semantic-analysis-${Date.now()}.json`;
          mimeType = "application/json";
          this.logDebug("Prepared JSON content for download", {
            contentLength: content.length,
          });
          break;

        default:
          content = element.textContent || "";
          if (!content.trim()) {
            this.logWarn("No content to download");
            alert(
              "No content available to download. Try viewing a response first."
            );
            return;
          }
          filename = `content-${Date.now()}.txt`;
          mimeType = "text/plain";
          this.logDebug("Prepared text content for download", {
            contentLength: content.length,
          });
      }

      // Final validation before creating blob
      if (!content || content.length === 0) {
        this.logError("Empty content detected before download", {
          type,
          elementId,
        });
        alert(
          "Cannot download empty content. Please ensure there is content to download."
        );
        return;
      }

      // Create a Blob with the content
      const blob = new Blob([content], { type: mimeType });
      this.logDebug(`Created blob for download`, {
        size: blob.size,
        type: blob.type,
      });

      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;

      // Trigger the download
      document.body.appendChild(link);
      link.click();
      this.logDebug(`Triggered download for ${filename}`);

      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
        this.logDebug("Download cleanup completed");
      }, 100);

      this.logInfo(`Downloaded ${type} content as ${filename}`, {
        contentLength: content.length,
        mimeType,
      });
    } catch (error) {
      this.logError(`Error downloading ${type} content`, { error });
      alert(`Failed to download content: ${error.message}`);
    }
  }

  /**
   * Update debug view with current raw and formatted content
   * @param {string} rawContent - Raw content before processing
   * @param {string} formattedContent - Formatted content after processing
   */
  updateDebugView(rawContent, formattedContent) {
    this.logDebug("updateDebugView called", {
      debugMode: this.debugMode,
      showFormattedContent: this.showFormattedContent,
      rawContentLength: rawContent?.length || 0,
      formattedContentLength: formattedContent?.length || 0,
      rawContentType: typeof rawContent,
      formattedContentType: typeof formattedContent,
    });

    if (!this.debugMode) {
      this.logDebug("Debug mode is disabled, not updating debug view");
      return;
    }

    try {
      // Validate inputs
      if (rawContent === undefined || rawContent === null) {
        this.logWarn("Invalid raw content provided to debug view", {
          rawContent: typeof rawContent,
        });
        rawContent = ""; // Use empty string as fallback
      }

      if (formattedContent === undefined || formattedContent === null) {
        this.logWarn("Invalid formatted content provided to debug view", {
          formattedContent: typeof formattedContent,
        });
        formattedContent = ""; // Use empty string as fallback
      }

      // Ensure we're working with strings
      const rawString = String(rawContent);
      const formattedString = String(formattedContent);

      // STORE the formatted content for toggle functionality
      this.lastFormattedContent = formattedString;

      this.logDebug("Content prepared for debug view", {
        rawStringLength: rawString.length,
        formattedStringLength: formattedString.length,
        rawStringPreview:
          rawString.substring(0, 50) + (rawString.length > 50 ? "..." : ""),
        formattedStringPreview:
          formattedString.substring(0, 50) +
          (formattedString.length > 50 ? "..." : ""),
      });

      // Check if debug container exists, if not show it
      const debugContainer = document.getElementById(
        "response-debug-container"
      );
      if (!debugContainer) {
        this.logWarn("Debug container not found, cannot update debug view");
        return;
      } else if (debugContainer.style.display === "none") {
        debugContainer.style.display = "flex";
        this.logDebug("Debug container was hidden, now shown");
      }

      const rawElement = document.getElementById("raw-response");
      const formattedElement = document.getElementById("formatted-response");
      const semanticElement = document.getElementById("semantic-analysis");

      // Log what elements were found
      this.logDebug("Debug elements found", {
        rawElement: !!rawElement,
        formattedElement: !!formattedElement,
        semanticElement: !!semanticElement,
      });

      // Check if required elements exist
      if (!rawElement || !formattedElement) {
        this.logWarn("Required debug elements not found", {
          rawElement: !!rawElement,
          formattedElement: !!formattedElement,
        });
        return;
      }

      // Update raw content (escaped for display)
      rawElement.textContent = rawString;
      this.logDebug("Updated raw element with content", {
        contentLength: rawString.length,
      });

      // UPDATE FORMATTED CONTENT CONDITIONALLY
      if (this.showFormattedContent) {
        // Update formatted content (as HTML) - ONLY if enabled
        formattedElement.innerHTML = formattedString;
        this.logDebug("Updated formatted element with content", {
          contentLength: formattedString.length,
        });
      } else {
        // Clear formatted content and show message instead
        formattedElement.innerHTML =
          '<div class="debug-message" style="padding: 1rem; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; color: #666;"><p>Formatted content display is disabled to prevent duplicate rendering of graphs and diagrams.</p><p>Enable "Show formatted content" in debug settings to view the processed HTML.</p></div>';
        this.logDebug(
          "Formatted content display disabled, showing message instead"
        );
      }

      // Generate and update semantic analysis if the element exists
      if (semanticElement) {
        try {
          this.logDebug("Generating semantic analysis");
          const semanticAnalysis =
            this.analyzeSemanticElements(formattedString);
          semanticElement.innerHTML = semanticAnalysis;

          this.logInfo("Debug view updated with semantic analysis", {
            rawLength: rawString.length,
            formattedLength: formattedString.length,
            formattedContentShown: this.showFormattedContent,
            semanticElements:
              semanticAnalysis.match(/<span class="semantic-tag/g)?.length || 0,
          });
        } catch (semanticError) {
          this.logError("Error generating semantic analysis", {
            error: semanticError,
          });
          semanticElement.innerHTML = `<div class="error">Error analysing semantic elements: ${semanticError.message}</div>`;
        }
      } else {
        this.logInfo("Debug view updated without semantic analysis", {
          rawLength: rawString.length,
          formattedLength: formattedString.length,
          formattedContentShown: this.showFormattedContent,
        });
      }
    } catch (error) {
      this.logError("Error updating debug view", { error });
    }
  }

  /**
   * Analyse formatted content to identify semantic elements
   * @param {string} formattedContent - Formatted HTML content
   * @returns {string} HTML representation of semantic analysis
   */
  analyzeSemanticElements(formattedContent) {
    try {
      // Create a temporary DOM element to parse the HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = formattedContent;

      // Initialise result
      let result = "";

      // Add summary section
      result += '<div class="semantic-summary">';
      result += "<h4>Element Summary</h4>";

      // Count elements by type
      const elementCounts = {};
      const elementTypes = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "ul",
        "ol",
        "li",
        "code",
        "blockquote",
        "table",
      ];

      elementTypes.forEach((type) => {
        const count = tempDiv.querySelectorAll(type).length;
        if (count > 0) {
          elementCounts[type] = count;
          result += `<span class="semantic-tag semantic-tag-${type}">${type}: ${count}</span> `;
        }
      });

      // Count other elements
      const allElements = tempDiv.querySelectorAll("*");
      const otherCount =
        allElements.length -
        Object.values(elementCounts).reduce((a, b) => a + b, 0);
      if (otherCount > 0) {
        result += `<span class="semantic-tag semantic-tag-other">other: ${otherCount}</span>`;
      }

      result += "</div>";

      // Add detailed analysis section
      result += '<div class="semantic-details">';
      result += "<h4>Element Details</h4>";

      // Function to recursively analyse elements
      const analyzeElement = (element, depth = 0) => {
        const indent = "  ".repeat(depth);
        const tagName = element.tagName.toLowerCase();
        const classes = Array.from(element.classList).join(" ");
        const id = element.id ? `id="${element.id}"` : "";

        // Get element attributes that might be relevant for accessibility
        const ariaAttrs = Array.from(element.attributes)
          .filter(
            (attr) =>
              attr.name.startsWith("aria-") ||
              attr.name === "role" ||
              attr.name === "tabindex"
          )
          .map((attr) => `${attr.name}="${attr.value}"`)
          .join(" ");

        // Create element representation
        let elementInfo = `${indent}<span class="semantic-tag semantic-tag-${tagName}">${tagName}</span>`;
        if (id) elementInfo += ` ${id}`;
        if (classes) elementInfo += ` class="${classes}"`;
        if (ariaAttrs) elementInfo += ` ${ariaAttrs}`;

        // Add text content preview for text nodes
        if (
          element.childNodes.length === 1 &&
          element.childNodes[0].nodeType === 3
        ) {
          const text = element.textContent.trim();
          if (text) {
            const preview =
              text.length > 30 ? text.substring(0, 27) + "..." : text;
            elementInfo += ` "${preview}"`;
          }
        }

        result += elementInfo + "<br>";

        // Recursively process child elements
        Array.from(element.children).forEach((child) => {
          analyzeElement(child, depth + 1);
        });
      };

      // Start analysis from the root element
      Array.from(tempDiv.children).forEach((child) => {
        analyzeElement(child);
      });

      result += "</div>";

      // Add machine-readable JSON format for LLM analysis
      result += '<div class="semantic-json">';
      result += "<h4>Machine-Readable Format (for LLM)</h4>";

      // Create a simplified structure for LLM consumption
      const simplifiedStructure = {
        elementCounts,
        headingStructure: this.analyzeHeadingStructure(tempDiv),
        accessibilityIssues: this.detectAccessibilityIssues(tempDiv),
      };

      result += `<pre>${JSON.stringify(simplifiedStructure, null, 2)}</pre>`;
      result += "</div>";

      return result;
    } catch (error) {
      this.logError("Error analysing semantic elements", { error });
      return `<div class="error">Error analysing semantic elements: ${error.message}</div>`;
    }
  }

  /**
   * Analyse heading structure to detect hierarchy issues
   * @param {HTMLElement} container - Container element with formatted content
   * @returns {Object} Analysis of heading structure
   */
  analyzeHeadingStructure(container) {
    const headings = [];
    const issues = [];

    // Collect all headings
    for (let i = 1; i <= 6; i++) {
      const elements = container.querySelectorAll(`h${i}`);
      elements.forEach((el) => {
        headings.push({
          level: i,
          text: el.textContent.trim(),
          id: el.id || null,
        });
      });
    }

    // Sort headings by their appearance in the document
    headings.sort((a, b) => {
      const aIndex = Array.from(container.querySelectorAll("*")).indexOf(
        container.querySelector(`h${a.level}[id="${a.id}"]`)
      );
      const bIndex = Array.from(container.querySelectorAll("*")).indexOf(
        container.querySelector(`h${b.level}[id="${b.id}"]`)
      );
      return aIndex - bIndex;
    });

    // Check for hierarchy issues
    let lastLevel = 0;
    headings.forEach((heading) => {
      if (heading.level > lastLevel + 1 && lastLevel > 0) {
        issues.push(
          `Heading level jumped from h${lastLevel} to h${heading.level} (skipped levels)`
        );
      }
      lastLevel = heading.level;
    });

    return {
      headings,
      issues,
      hasValidHierarchy: issues.length === 0,
    };
  }

  /**
   * Detect basic accessibility issues in the formatted content
   * @param {HTMLElement} container - Container element with formatted content
   * @returns {Array} List of detected accessibility issues
   */
  detectAccessibilityIssues(container) {
    const issues = [];

    // Check for images without alt text
    const images = container.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.hasAttribute("alt")) {
        issues.push("Image missing alt attribute");
      }
    });

    // Check for empty headings
    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((heading) => {
      if (!heading.textContent.trim()) {
        issues.push(`Empty heading (${heading.tagName.toLowerCase()})`);
      }
    });

    // Check for links without text
    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      if (!link.textContent.trim() && !link.querySelector("img[alt]")) {
        issues.push("Link has no text content");
      }
    });

    return issues;
  }

  /**
   * Add debug mode toggle to developer settings panel
   * @param {HTMLElement} devPanel - The developer settings panel element
   */
  addDebugModeToggle(devPanel) {
    if (!devPanel) {
      this.logWarn(
        "Cannot add debug mode toggle: developer panel not provided"
      );
      return;
    }

    // Create debug mode section
    const debugSection = document.createElement("div");
    debugSection.className = "settings-section";

    // Create section heading
    const sectionHeading = document.createElement("h3");
    sectionHeading.textContent = "Response Debugging";
    debugSection.appendChild(sectionHeading);

    // Create main debug toggle container
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "setting-item";

    // Create label for main debug toggle
    const label = document.createElement("label");
    label.htmlFor = "debug-mode-toggle";
    label.textContent = "Enable response debug mode";

    // Create main debug toggle switch
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = "debug-mode-toggle";
    toggle.checked = this.debugMode || false;

    // Add event listener for main debug toggle
    toggle.addEventListener("change", (e) => {
      this.setDebugMode(e.target.checked);
    });

    // Add description for main debug toggle
    const description = document.createElement("p");
    description.className = "setting-description";
    description.textContent =
      "Shows a debug panel to compare raw and formatted responses, helpful for troubleshooting header formatting issues.";

    // Assemble main toggle container
    toggleContainer.appendChild(label);
    toggleContainer.appendChild(toggle);
    debugSection.appendChild(toggleContainer);
    debugSection.appendChild(description);

    // CREATE FORMATTED CONTENT TOGGLE
    const formattedToggleContainer = document.createElement("div");
    formattedToggleContainer.className = "setting-item";
    formattedToggleContainer.style.marginLeft = "1.5rem"; // Indent to show it's a sub-option

    // Create label for formatted content toggle
    const formattedLabel = document.createElement("label");
    formattedLabel.htmlFor = "formatted-content-toggle";
    formattedLabel.textContent = "Show formatted content in debug panel";

    // Create formatted content toggle switch
    const formattedToggle = document.createElement("input");
    formattedToggle.type = "checkbox";
    formattedToggle.id = "formatted-content-toggle";
    formattedToggle.checked = this.showFormattedContent || false;

    // Add event listener for formatted content toggle
    formattedToggle.addEventListener("change", (e) => {
      this.setFormattedContentDisplay(e.target.checked);
    });

    // Add description for formatted content toggle
    const formattedDescription = document.createElement("p");
    formattedDescription.className = "setting-description";
    formattedDescription.textContent =
      "When disabled (recommended), prevents duplicate rendering of graphs and diagrams in the debug panel, reducing log confusion.";

    // Assemble formatted content toggle container
    formattedToggleContainer.appendChild(formattedLabel);
    formattedToggleContainer.appendChild(formattedToggle);
    debugSection.appendChild(formattedToggleContainer);
    debugSection.appendChild(formattedDescription);

    // Add to developer panel
    devPanel.appendChild(debugSection);

    this.logInfo(
      "Debug mode toggle and formatted content toggle added to developer settings"
    );
  }
}
