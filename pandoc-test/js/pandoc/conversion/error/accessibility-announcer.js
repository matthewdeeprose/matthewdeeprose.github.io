// accessibility-announcer.js
// Accessibility Error Announcer - Screen reader error announcements and accessibility support
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 6

const AccessibilityAnnouncer = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger(
    "ACCESSIBILITY_ANNOUNCER",
    {
      level: window.LoggingSystem.LOG_LEVELS.WARN,
    }
  ) || {
    logError: console.error.bind(console, "[ACCESSIBILITY_ANNOUNCER]"),
    logWarn: console.warn.bind(console, "[ACCESSIBILITY_ANNOUNCER]"),
    logInfo: console.log.bind(console, "[ACCESSIBILITY_ANNOUNCER]"),
    logDebug: console.log.bind(console, "[ACCESSIBILITY_ANNOUNCER]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // ACCESSIBILITY ANNOUNCER IMPLEMENTATION
  // ===========================================================================================

  /**
   * Announce error to screen readers for accessibility
   * Creates accessible announcements that work with assistive technologies
   * @param {string} message - The error message to announce
   * @param {Object} options - Announcement options
   * @returns {Promise<boolean>} - Success/failure of announcement
   */
  async function announceErrorToScreenReader(message, options = {}) {
    if (!message || typeof message !== "string") {
      logWarn("No valid message provided for screen reader announcement");
      return false;
    }

    const config = {
      role: options.role || "alert",
      ariaLive: options.ariaLive || "assertive",
      timeout: options.timeout || 3000,
      prefix: options.prefix || "Conversion error: ",
      priority: options.priority || "high",
      ...options,
    };

    try {
      logDebug(`Announcing error to screen readers: ${message}`);

      // Create announcement element with proper ARIA attributes
      const announcement = document.createElement("div");
      announcement.className = "sr-only";
      announcement.setAttribute("role", config.role);
      announcement.setAttribute("aria-live", config.ariaLive);
      announcement.setAttribute("aria-atomic", "true");

      // Add priority-specific attributes
      if (config.priority === "high") {
        announcement.setAttribute("aria-relevant", "all");
      }

      // Set the announcement text
      const fullMessage = config.prefix + message;
      announcement.textContent = fullMessage;

      // Add to DOM for screen reader detection
      document.body.appendChild(announcement);

      // For high priority errors, also try alternative announcement methods
      if (config.priority === "high") {
        await tryAlternativeAnnouncements(fullMessage, config);
      }

      // Remove announcement after timeout
      setTimeout(() => {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      }, config.timeout);

      logDebug("Screen reader error announcement completed");
      return true;
    } catch (error) {
      logError("Failed to announce error to screen readers:", error);
      return false;
    }
  }

  /**
   * Try alternative announcement methods for high priority errors
   * Uses multiple techniques to ensure screen reader compatibility
   * @param {string} message - The message to announce
   * @param {Object} config - Announcement configuration
   */
  async function tryAlternativeAnnouncements(message, config) {
    try {
      // Method 1: Use aria-describedby pattern
      await announceViaAriaDescribedBy(message, config);

      // Method 2: Use status role for broader compatibility
      await announceViaStatusRole(message, config);

      // Method 3: Focus management for immediate attention
      if (config.priority === "high") {
        await announceViaFocusManagement(message, config);
      }
    } catch (error) {
      logWarn("Alternative announcement methods failed:", error);
    }
  }

  /**
   * Announce via aria-describedby pattern
   * Creates a describedby relationship for enhanced screen reader support
   * @param {string} message - The message to announce
   * @param {Object} config - Announcement configuration
   */
  async function announceViaAriaDescribedBy(message, config) {
    try {
      const descriptionId = `error-description-${Date.now()}`;

      // Create description element
      const description = document.createElement("div");
      description.id = descriptionId;
      description.className = "sr-only";
      description.textContent = message;
      document.body.appendChild(description);

      // Find a focusable element to associate with
      const focusableElement = document.querySelector(
        "input, button, textarea, select, [tabindex]"
      );
      if (focusableElement) {
        const existingDescribedBy =
          focusableElement.getAttribute("aria-describedby");
        const newDescribedBy = existingDescribedBy
          ? `${existingDescribedBy} ${descriptionId}`
          : descriptionId;

        focusableElement.setAttribute("aria-describedby", newDescribedBy);

        // Clean up after timeout
        setTimeout(() => {
          if (document.body.contains(description)) {
            document.body.removeChild(description);
          }
          if (
            focusableElement.getAttribute("aria-describedby") === newDescribedBy
          ) {
            if (existingDescribedBy) {
              focusableElement.setAttribute(
                "aria-describedby",
                existingDescribedBy
              );
            } else {
              focusableElement.removeAttribute("aria-describedby");
            }
          }
        }, config.timeout);
      }

      logDebug("aria-describedby announcement method completed");
    } catch (error) {
      logWarn("aria-describedby announcement failed:", error);
    }
  }

  /**
   * Announce via status role
   * Uses status role for broader screen reader compatibility
   * @param {string} message - The message to announce
   * @param {Object} config - Announcement configuration
   */
  async function announceViaStatusRole(message, config) {
    try {
      const statusElement = document.createElement("div");
      statusElement.className = "sr-only";
      statusElement.setAttribute("role", "status");
      statusElement.setAttribute("aria-live", "polite");
      statusElement.setAttribute("aria-atomic", "true");
      statusElement.textContent = message;

      document.body.appendChild(statusElement);

      setTimeout(() => {
        if (document.body.contains(statusElement)) {
          document.body.removeChild(statusElement);
        }
      }, config.timeout);

      logDebug("Status role announcement method completed");
    } catch (error) {
      logWarn("Status role announcement failed:", error);
    }
  }

  /**
   * Announce via focus management
   * Uses focus management for immediate screen reader attention
   * @param {string} message - The message to announce
   * @param {Object} config - Announcement configuration
   */
  async function announceViaFocusManagement(message, config) {
    try {
      // Create a focusable announcement element
      const focusableAnnouncement = document.createElement("button");
      focusableAnnouncement.className = "sr-only";
      focusableAnnouncement.textContent = `Error: ${message}. Press Escape to dismiss.`;
      focusableAnnouncement.setAttribute("aria-live", "assertive");
      focusableAnnouncement.setAttribute("role", "alert");

      // Handle keyboard interaction
      focusableAnnouncement.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          if (document.body.contains(focusableAnnouncement)) {
            document.body.removeChild(focusableAnnouncement);
          }
        }
      });

      document.body.appendChild(focusableAnnouncement);

      // Brief delay before focusing
      setTimeout(() => {
        if (document.body.contains(focusableAnnouncement)) {
          focusableAnnouncement.focus();
        }
      }, 100);

      // Auto-remove after timeout
      setTimeout(() => {
        if (document.body.contains(focusableAnnouncement)) {
          document.body.removeChild(focusableAnnouncement);
        }
      }, config.timeout);

      logDebug("Focus management announcement method completed");
    } catch (error) {
      logWarn("Focus management announcement failed:", error);
    }
  }

  /**
   * Announce success message to screen readers
   * Provides positive feedback for successful operations
   * @param {string} message - The success message to announce
   * @param {Object} options - Announcement options
   * @returns {Promise<boolean>} - Success/failure of announcement
   */
  async function announceSuccessToScreenReader(message, options = {}) {
    const successOptions = {
      role: "status",
      ariaLive: "polite",
      prefix: "Success: ",
      priority: "medium",
      ...options,
    };

    return await announceErrorToScreenReader(message, successOptions);
  }

  /**
   * Announce progress update to screen readers
   * Provides progress feedback during long operations
   * @param {string} message - The progress message to announce
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} options - Announcement options
   * @returns {Promise<boolean>} - Success/failure of announcement
   */
  async function announceProgressToScreenReader(
    message,
    percentage = null,
    options = {}
  ) {
    let progressMessage = message;
    if (percentage !== null && !isNaN(percentage)) {
      progressMessage = `${message} ${Math.round(percentage)}% complete`;
    }

    const progressOptions = {
      role: "status",
      ariaLive: "polite",
      prefix: "Progress: ",
      priority: "low",
      timeout: 2000, // Shorter timeout for progress updates
      ...options,
    };

    return await announceErrorToScreenReader(progressMessage, progressOptions);
  }

  /**
   * Create accessible error display
   * Creates visual error display that's also accessible to screen readers
   * @param {string} message - The error message
   * @param {string} containerId - ID of container element
   * @returns {HTMLElement|null} - Created error element or null
   */
  function createAccessibleErrorDisplay(message, containerId = "output") {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        logWarn(
          `Container ${containerId} not found for accessible error display`
        );
        return null;
      }

      const errorDisplay = document.createElement("div");
      errorDisplay.className = "error-message";
      errorDisplay.setAttribute("role", "alert");
      errorDisplay.setAttribute("aria-live", "assertive");
      errorDisplay.setAttribute("tabindex", "0"); // Make focusable

      const errorTitle = document.createElement("strong");
      errorTitle.textContent = "Conversion Error:";

      const errorText = document.createElement("span");
      errorText.textContent = ` ${message}`;

      errorDisplay.appendChild(errorTitle);
      errorDisplay.appendChild(errorText);

      // Clear existing content and add error
      container.innerHTML = "";
      container.appendChild(errorDisplay);

      // Focus the error for immediate screen reader attention
      setTimeout(() => {
        errorDisplay.focus();
      }, 100);

      logDebug("Accessible error display created");
      return errorDisplay;
    } catch (error) {
      logError("Failed to create accessible error display:", error);
      return null;
    }
  }

  /**
   * Test screen reader announcement functionality
   * Provides testing capabilities for accessibility features
   * @returns {Promise<boolean>} - Success of test announcements
   */
  async function testScreenReaderAnnouncements() {
    try {
      logInfo("Testing screen reader announcement functionality...");

      // Test basic error announcement
      const errorTest = await announceErrorToScreenReader(
        "Test error message for screen reader"
      );

      // Test success announcement
      const successTest = await announceSuccessToScreenReader(
        "Test success message"
      );

      // Test progress announcement
      const progressTest = await announceProgressToScreenReader(
        "Processing document",
        50
      );

      const allPassed = errorTest && successTest && progressTest;
      logInfo(
        `Screen reader announcement test ${allPassed ? "PASSED" : "FAILED"}`
      );

      return allPassed;
    } catch (error) {
      logError("Screen reader announcement test failed:", error);
      return false;
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testAccessibilityAnnouncer() {
    const tests = {
      moduleExists: () => !!window.AccessibilityAnnouncer,

      hasMainFunction: () => typeof announceErrorToScreenReader === "function",

      hasSuccessFunction: () =>
        typeof announceSuccessToScreenReader === "function",

      hasProgressFunction: () =>
        typeof announceProgressToScreenReader === "function",

      basicErrorAnnouncement: async () => {
        try {
          const result = await announceErrorToScreenReader(
            "Test error message"
          );
          return result === true;
        } catch (error) {
          return false;
        }
      },

      successAnnouncement: async () => {
        try {
          const result = await announceSuccessToScreenReader(
            "Test success message"
          );
          return result === true;
        } catch (error) {
          return false;
        }
      },

      progressAnnouncement: async () => {
        try {
          const result = await announceProgressToScreenReader("Processing", 75);
          return result === true;
        } catch (error) {
          return false;
        }
      },

      accessibleErrorDisplay: () => {
        // Create a test container
        const testContainer = document.createElement("div");
        testContainer.id = "test-container";
        document.body.appendChild(testContainer);

        const errorElement = createAccessibleErrorDisplay(
          "Test error",
          "test-container"
        );
        const success =
          errorElement && errorElement.getAttribute("role") === "alert";

        // Cleanup
        document.body.removeChild(testContainer);

        return success;
      },

      emptyMessageHandling: async () => {
        try {
          const result = await announceErrorToScreenReader("");
          return result === false; // Should return false for empty message
        } catch (error) {
          return false;
        }
      },

      customOptionsHandling: async () => {
        try {
          const result = await announceErrorToScreenReader("Test", {
            role: "status",
            ariaLive: "polite",
            priority: "low",
          });
          return result === true;
        } catch (error) {
          return false;
        }
      },

      integrationReadiness: () => {
        return (
          typeof announceErrorToScreenReader === "function" &&
          typeof announceSuccessToScreenReader === "function" &&
          typeof announceProgressToScreenReader === "function" &&
          typeof createAccessibleErrorDisplay === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("AccessibilityAnnouncer", tests) ||
      fallbackTesting("AccessibilityAnnouncer", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core announcement functions
    announceErrorToScreenReader,
    announceSuccessToScreenReader,
    announceProgressToScreenReader,

    // Accessibility utilities
    createAccessibleErrorDisplay,
    testScreenReaderAnnouncements,

    // Testing
    testAccessibilityAnnouncer,
  };
})();

// Make globally available
window.AccessibilityAnnouncer = AccessibilityAnnouncer;
