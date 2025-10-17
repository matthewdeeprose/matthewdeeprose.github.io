/**
 * Markdown Code Copy
 * Adds copy buttons to code blocks rendered by markdown-it with accessibility features
 */
const MarkdownCodeCopy = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Markdown Code Copy] ${message}`);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Markdown Code Copy] ${message}`);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Markdown Code Copy] ${message}`);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Markdown Code Copy] [DEBUG] ${message}`);
    }
  }

  // Configuration
  const config = {
    buttonText: "Copy",
    successText: "Copied",
    failText: "Failed to copy",
    successDuration: 2000, // Time in ms to show success message
    ariaLiveRegionId: "sr-announcer",
    buttonClass: "code-copy-button",
  };

  /**
   * Initialize copy buttons on all code blocks
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      logWarn("No container provided");
      return;
    }

    // Find all code blocks
    const codeBlocks = container.querySelectorAll("pre code");
    if (codeBlocks.length === 0) {
      logDebug("No code blocks found in container");
      return;
    }

    logInfo(`Adding copy buttons to ${codeBlocks.length} code blocks`);

    // Add copy button to each code block
    codeBlocks.forEach((block, index) => {
      addCopyButton(block, index);
    });
  }

  /**
   * Add copy button to a code block
   * @param {HTMLElement} codeBlock - The code block element
   * @param {number} index - Index for unique IDs
   */
  function addCopyButton(codeBlock, index) {
    // Get parent pre element
    const preElement = codeBlock.parentElement;
    if (!preElement || preElement.tagName !== "PRE") {
      logDebug(`Skipping code block at index ${index} - no valid pre parent`);
      return;
    }

    // Skip if this code block is inside the MathPix debug panel
    // Debug panel has its own specialized copy functionality
    const debugPanel = preElement.closest("#mathpix-debug-panel");
    if (debugPanel) {
      logDebug(
        `Skipping code block at index ${index} - inside MathPix debug panel`
      );
      return;
    }

    // Skip if already processed
    if (preElement.querySelector(`.${config.buttonClass}`)) {
      logDebug(`Skipping code block at index ${index} - already processed`);
      return;
    }

    // Add necessary attributes and classes
    preElement.classList.add("code-block-container");

    // Generate unique IDs if not present
    if (!codeBlock.id) {
      codeBlock.id = `code-block-${index}-${Date.now()}`;
    }

    if (!preElement.id) {
      preElement.id = `pre-block-${index}-${Date.now()}`;
    }

    // Store original code (unprocessed content)
    preElement.dataset.originalCode = codeBlock.textContent;

    // Create copy button
    const copyButton = document.createElement("button");
    copyButton.className = config.buttonClass;
    copyButton.innerHTML = `${getCopyButtonIcon()} ${config.buttonText}`;
    copyButton.setAttribute("aria-label", "Copy code to clipboard");
    copyButton.setAttribute("type", "button");

    // Add event listener
    copyButton.addEventListener("click", function () {
      copyCodeToClipboard(preElement, copyButton);
    });

    // Append button to pre element
    preElement.appendChild(copyButton);

    logDebug(`Added copy button to code block ${index}`);
  }

  /**
   * Get SVG icon for copy button
   * @returns {string} SVG icon HTML
   */
  function getCopyButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }

  /**
   * Copy code to clipboard
   * @param {HTMLElement} preElement - Pre element containing code
   * @param {HTMLElement} button - Copy button element
   */
  function copyCodeToClipboard(preElement, button) {
    const code = preElement.dataset.originalCode;
    if (!code) {
      logWarn("No code content found to copy");
      return;
    }

    logDebug("Attempting to copy code to clipboard");

    // Try to focus the document first to help with Clipboard API permissions
    try {
      if (document.hasFocus && !document.hasFocus()) {
        window.focus();
      }
    } catch (e) {
      // Ignore focus errors
      logDebug("Could not focus document for clipboard access");
    }

    // Use Clipboard API if available
    if (navigator.clipboard) {
      logDebug("Using Clipboard API");
      navigator.clipboard
        .writeText(code)
        .then(() => {
          logDebug("Clipboard API copy successful");
          updateButtonStatus(button, true);
        })
        .catch((error) => {
          // Don't log errors in browser-sync environment to avoid console noise
          if (!window.___browserSync___ && error.name !== "NotAllowedError") {
            logWarn(
              `Clipboard API failed, using fallback method: ${error.name}`
            );
          }
          fallbackCopyToClipboard(code, button);
        });
    } else {
      logDebug("Clipboard API not available, using fallback method");
      fallbackCopyToClipboard(code, button);
    }
  }

  /**
   * Fallback method for copying to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Copy button element
   */
  function fallbackCopyToClipboard(text, button) {
    try {
      logDebug("Executing fallback copy method");
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      logDebug(`Fallback copy method ${successful ? "succeeded" : "failed"}`);
      updateButtonStatus(button, successful);
    } catch (error) {
      logError(`Error in fallback copy method: ${error.message}`);
      updateButtonStatus(button, false);
    }
  }

  /**
   * Update button status after copy attempt
   * @param {HTMLElement} button - Copy button element
   * @param {boolean} success - Whether copy was successful
   */
  function updateButtonStatus(button, success) {
    const originalContent = button.innerHTML;

    if (success) {
      button.innerHTML = `${getCopyButtonIcon()} ${config.successText}`;
      announceToScreenReader("Code snippet copied to clipboard");
      logDebug("Copy operation successful, updated button status");
    } else {
      button.innerHTML = `${getCopyButtonIcon()} ${config.failText}`;
      announceToScreenReader("Failed to copy code snippet");
      logWarn("Copy operation failed, updated button status");
    }

    // Reset button after a delay
    setTimeout(() => {
      button.innerHTML = originalContent;
      logDebug("Reset button to original state");
    }, config.successDuration);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    // Find or create screen reader announcer
    let announcer = document.getElementById(config.ariaLiveRegionId);

    if (!announcer) {
      logDebug("Creating screen reader announcer element");
      // Create screen reader announcer element
      announcer = document.createElement("div");
      announcer.id = config.ariaLiveRegionId;
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);

      // Add necessary CSS if not already present
      if (!document.getElementById("sr-styles")) {
        logDebug("Adding screen reader CSS styles");
        const style = document.createElement("style");
        style.id = "sr-styles";
        style.textContent = `
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                `;
        document.head.appendChild(style);
      }
    }

    // Set the message to be announced
    announcer.textContent = message;
    logDebug(`Announced to screen reader: ${message}`);
  }

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    logInfo("DOM content loaded, initialising Markdown Code Copy");
    MarkdownCodeCopy.init();

    // Also observe changes to the output div to handle dynamically added code blocks
    const outputElement = document.getElementById("output");
    if (outputElement) {
      logInfo("Setting up mutation observer for dynamic content");
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === "childList") {
            logDebug(
              "DOM mutation detected, re-initialising on output element"
            );
            MarkdownCodeCopy.init(outputElement);
          }
        });
      });

      observer.observe(outputElement, {
        childList: true,
        subtree: true,
      });
    } else {
      logWarn("Output element not found, dynamic content observation disabled");
    }
  });

  // Public API
  return {
    init: init,
    addCopyButton: addCopyButton,
  };
})();
