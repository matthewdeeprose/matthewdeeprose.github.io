// mathjax-manager.js
// Dynamic MathJax Configuration Manager Module
// Phase 2.3: Assistive MathML and Tab Navigation Controls with Working Context Menus

const MathJaxManager = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[MATHJAX]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[MATHJAX]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[MATHJAX]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[MATHJAX]", message, ...args);
  }

  // ===========================================================================================
  // DYNAMIC MATHJAX CONFIGURATION SYSTEM
  // ===========================================================================================

  /**
   * Dynamic MathJax Configuration Manager for Phase 2.3
   * Implements zoom trigger, scale controls, and screen reader accessibility
   */
  class DynamicMathJaxManager {
    constructor() {
      this.currentSettings = {
        zoomTrigger: "Click",
        zoomScale: "200%",
        assistiveMml: true,
        inTabOrder: false,
        renderer: "CHTML",
        mathScale: 1.0,
        explorer: false,
        collapsible: false,
      };
      this.isUpdating = false;
      this.updateQueue = [];
    }

    /**
     * CRITICAL: Initialise dynamic configuration after MathJax is loaded
     */
    initialise() {
      logInfo("Initialising Dynamic MathJax Configuration Manager...");

      try {
        // Wait for MathJax to be ready
        if (window.MathJax && window.MathJax.startup) {
          window.MathJax.startup.promise.then(() => {
            this.setupEventHandlers();
            this.detectCurrentSettings();
            logInfo("✅ Dynamic MathJax Manager initialised successfully");
          });
        } else {
          logWarn("MathJax not available - retrying in 500ms");
          setTimeout(() => this.initialise(), 500);
        }
      } catch (error) {
        logError("Error initialising Dynamic MathJax Manager:", error);
      }
    }

    /**
     * Setup event handlers for all form controls
     */
    setupEventHandlers() {
      logInfo("Setting up dynamic configuration event handlers...");

      // TASK 2.2: Zoom Configuration Controls
      this.setupZoomTriggerControls();
      this.setupZoomScaleControl();

      // PHASE 2.3: Screen Reader Accessibility Controls
      this.setupScreenReaderControls();

      logInfo("✅ Event handlers setup complete");
    }

    /**
     * TASK 2.2: Setup zoom trigger radio button controls
     */
    setupZoomTriggerControls() {
      logInfo("Setting up zoom trigger controls...");

      const zoomTriggerRadios = document.querySelectorAll(
        'input[name="zoom-trigger"]'
      );

      if (zoomTriggerRadios.length === 0) {
        logWarn("Zoom trigger radio buttons not found");
        return;
      }

      zoomTriggerRadios.forEach((radio) => {
        radio.addEventListener("change", (event) => {
          if (event.target.checked) {
            const newTrigger = event.target.value; // 'Click', 'DoubleClick', 'NoZoom'
            logInfo(`🎯 Zoom trigger changed to: ${newTrigger}`);
            this.updateZoomTrigger(newTrigger);
          }
        });
      });

      logInfo(
        `✅ Zoom trigger controls setup complete (${zoomTriggerRadios.length} radio buttons)`
      );
    }

    /**
     * TASK 2.2: Setup zoom scale slider control
     */
    setupZoomScaleControl() {
      logInfo("Setting up zoom scale control...");

      const zoomScaleSlider = document.getElementById("zoom-scale");
      const zoomScaleValue = document.getElementById("zoom-scale-value");

      if (!zoomScaleSlider) {
        logWarn("Zoom scale slider not found");
        return;
      }

      // Update display value as user drags
      zoomScaleSlider.addEventListener("input", (event) => {
        const scalePercent = event.target.value + "%";
        if (zoomScaleValue) {
          zoomScaleValue.textContent = scalePercent;
        }
        logDebug(`🔍 Zoom scale preview: ${scalePercent}`);
      });

      // Apply changes when user finishes dragging
      zoomScaleSlider.addEventListener("change", (event) => {
        const scalePercent = event.target.value + "%";
        logInfo(`🔍 Zoom scale changed to: ${scalePercent}`);
        this.updateZoomScale(scalePercent);
      });

      logInfo("✅ Zoom scale control setup complete");
    }

    /**
     * Setup screen reader accessibility controls
     */
    setupScreenReaderControls() {
      logInfo("Setting up enhanced screen reader accessibility controls...");

      // ✅ ENHANCED: Assistive MathML with special handling
      this.setupAssistiveMathMLControl();

      // ✅ ENHANCED: Tab navigation with default ON
      this.setupTabNavigationControl();

      logInfo("✅ Enhanced screen reader controls setup complete");
    }

    /**
     * Setup assistive MathML checkbox control
     */
    setupAssistiveMathMLControl() {
      logInfo("Setting up enhanced assistive MathML control...");

      const assistiveMathMLCheckbox =
        document.getElementById("assistive-mathml");

      if (!assistiveMathMLCheckbox) {
        logWarn("Assistive MathML checkbox not found");
        return;
      }

      // Set default to checked (should be enabled by default)
      assistiveMathMLCheckbox.checked = true;

      assistiveMathMLCheckbox.addEventListener("change", (event) => {
        const enabled = event.target.checked;
        logInfo(`🔧 Assistive MathML control: ${enabled}`);

        if (!enabled) {
          // Disabling works immediately
          this.updateAssistiveMathML(false);
          this.showRefreshWarning("assistive-mathml-disable");
        } else {
          // Re-enabling requires page refresh
          this.showRefreshRequiredDialog(event.target);
        }
      });

      logInfo("✅ Enhanced assistive MathML control setup complete");
    }

    /**
     * Setup tab navigation checkbox control
     */
    setupTabNavigationControl() {
      logInfo("Setting up enhanced tab navigation control...");

      const tabNavigationCheckbox = document.getElementById("tab-navigation");

      if (!tabNavigationCheckbox) {
        logWarn("Tab navigation checkbox not found");
        return;
      }

      // Set default to checked (more accessible default)
      tabNavigationCheckbox.checked = true;
      this.currentSettings.inTabOrder = true;

      tabNavigationCheckbox.addEventListener("change", (event) => {
        const enabled = event.target.checked;
        logInfo(`⌨️ Enhanced tab navigation: ${enabled}`);
        this.updateTabNavigation(enabled);
      });

      logInfo("✅ Enhanced tab navigation control setup complete");
    }

    /**
     * TASK 2.2: Update zoom trigger setting
     */
    async updateZoomTrigger(newTrigger) {
      if (this.isUpdating) {
        this.updateQueue.push(() => this.updateZoomTrigger(newTrigger));
        return;
      }

      try {
        this.isUpdating = true;
        this.currentSettings.zoomTrigger = newTrigger;

        logInfo(`Updating MathJax zoom trigger to: ${newTrigger}`);

        // Approach 1: Try to update menu settings directly (MathJax 3.2)
        const success = await this.updateMathJaxMenuSettings({
          zoom: newTrigger,
        });

        if (!success) {
          // Approach 2: Fallback to full re-render
          logInfo("Direct menu update failed, using re-render approach");
          await this.reRenderMathematics();
        }

        // Announce change to screen reader
        this.announceSettingChange(`Zoom trigger changed to ${newTrigger}`);

        logInfo(`✅ Zoom trigger update complete: ${newTrigger}`);
      } catch (error) {
        logError("Error updating zoom trigger:", error);
        this.announceSettingChange("Error updating zoom settings");
      } finally {
        this.isUpdating = false;
        this.processUpdateQueue();
      }
    }

    /**
     * TASK 2.2: Update zoom scale setting
     */
    async updateZoomScale(newScale) {
      if (this.isUpdating) {
        this.updateQueue.push(() => this.updateZoomScale(newScale));
        return;
      }

      try {
        this.isUpdating = true;
        this.currentSettings.zoomScale = newScale;

        logInfo(`Updating MathJax zoom scale to: ${newScale}`);

        // Approach 1: Try to update menu settings directly
        const success = await this.updateMathJaxMenuSettings({
          zscale: newScale,
        });

        if (!success) {
          // Approach 2: Fallback to full re-render
          logInfo("Direct menu update failed, using re-render approach");
          await this.reRenderMathematics();
        }

        // Announce change to screen reader
        this.announceSettingChange(`Zoom scale changed to ${newScale}`);

        logInfo(`✅ Zoom scale update complete: ${newScale}`);
      } catch (error) {
        logError("Error updating zoom scale:", error);
        this.announceSettingChange("Error updating zoom scale");
      } finally {
        this.isUpdating = false;
        this.processUpdateQueue();
      }
    }

    /**
     * TASK 2.3.1: Update assistive MathML setting
     */
    async updateAssistiveMathML(enabled) {
      if (this.isUpdating) {
        this.updateQueue.push(() => this.updateAssistiveMathML(enabled));
        return;
      }

      try {
        this.isUpdating = true;
        this.currentSettings.assistiveMml = enabled;

        logInfo(`🔧 Updating assistive MathML to: ${enabled}`);

        if (!window.MathJax?.startup?.document?.menu?.settings) {
          logError("MathJax API not available for assistive MathML update");
          throw new Error("MathJax API not available");
        }

        // Update MathJax setting
        window.MathJax.startup.document.menu.settings.assistiveMml = enabled;
        logInfo(`MathJax assistiveMml setting updated to: ${enabled}`);

        // Show user feedback
        this.showUpdateFeedback("Updating mathematical accessibility...");

        if (!enabled) {
          // Disable: Direct DOM removal
          const assistiveElements =
            document.querySelectorAll("mjx-assistive-mml");
          assistiveElements.forEach((element) => element.remove());
        } else {
          // Enable: MathJax regeneration
          window.MathJax.typesetClear();
          await new Promise((resolve) => setTimeout(resolve, 100));
          await window.MathJax.typesetPromise();
        }

        this.hideUpdateFeedback();

        const finalCount =
          document.querySelectorAll("mjx-assistive-mml").length;
        const announcement = enabled
          ? `Assistive MathML enabled. ${finalCount} mathematical expressions enhanced for screen readers.`
          : "Assistive MathML disabled. Screen reader optimisation removed for performance.";

        this.announceAccessibilityChange(
          "Assistive MathML",
          enabled,
          announcement
        );

        logInfo(
          `✅ Assistive MathML update complete: ${enabled} (${finalCount} elements)`
        );
      } catch (error) {
        logError("Error updating assistive MathML:", error);
        this.announceSettingChange("Error updating assistive MathML settings");
      } finally {
        this.isUpdating = false;
        this.processUpdateQueue();
      }
    }

    /**
     * TASK 2.3.2: Update tab navigation setting
     */
    async updateTabNavigation(enabled) {
      if (this.isUpdating) {
        this.updateQueue.push(() => this.updateTabNavigation(enabled));
        return;
      }

      try {
        this.isUpdating = true;
        this.currentSettings.inTabOrder = enabled;

        logInfo(`Updating MathJax tab navigation to: ${enabled}`);

        // Update existing math elements immediately
        this.updateMathElementTabOrder(enabled);

        // Enhanced screen reader announcement
        const announcement = enabled
          ? "Tab navigation enabled. Mathematical expressions included in keyboard tab order."
          : "Tab navigation disabled. Mathematical expressions excluded from keyboard navigation.";

        this.announceAccessibilityChange(
          "Tab Navigation",
          enabled,
          announcement
        );

        logInfo(`✅ Tab navigation update complete: ${enabled}`);
      } catch (error) {
        logError("Error updating tab navigation:", error);
        this.announceSettingChange("Error updating tab navigation settings");
      } finally {
        this.isUpdating = false;
        this.processUpdateQueue();
      }
    }

    /**
     * APPROACH 1: Try to update MathJax menu settings directly
     */
    async updateMathJaxMenuSettings(newSettings) {
      try {
        if (!window.MathJax || !window.MathJax.startup) {
          logWarn("MathJax not available for direct menu update");
          return false;
        }

        const document = window.MathJax.startup.document;
        if (document && document.menu && document.menu.settings) {
          logInfo("Attempting direct menu settings update...");
          Object.assign(document.menu.settings, newSettings);
          logInfo("✅ Direct menu settings update successful");
          return true;
        } else {
          logInfo("Menu settings not accessible for direct update");
          return false;
        }
      } catch (error) {
        logWarn("Direct menu update failed:", error);
        return false;
      }
    }

    /**
     * APPROACH 2: Re-render mathematics with new configuration
     */
    async reRenderMathematics() {
      try {
        if (!window.MathJax || !window.MathJax.typesetPromise) {
          logError("MathJax typesetPromise not available");
          return;
        }

        logInfo("Re-rendering mathematics with new settings...");
        this.showUpdateFeedback("Updating mathematics...");

        const mathElements = document.querySelectorAll("mjx-container, .math");
        logInfo(`Found ${mathElements.length} mathematical elements to update`);

        if (mathElements.length > 0) {
          if (window.MathJax.typesetClear) {
            window.MathJax.typesetClear();
          }
          await window.MathJax.typesetPromise();
          logInfo("✅ Mathematics re-rendering complete");
        }

        this.hideUpdateFeedback();
      } catch (error) {
        logError("Error re-rendering mathematics:", error);
        this.hideUpdateFeedback();
        throw error;
      }
    }

    /**
     * TASK 2.3.2: Update tab order for existing math elements
     */
    updateMathElementTabOrder(enabled) {
      try {
        const mathElements = document.querySelectorAll("mjx-container");
        logInfo(
          `Updating tab order for ${mathElements.length} mathematical elements`
        );

        mathElements.forEach((element, index) => {
          if (enabled) {
            element.setAttribute("tabindex", "0");

            // Add enhanced keyboard event handling
            if (!element.hasAttribute("data-keyboard-enhanced")) {
              element.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  const contextMenuEvent = new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                    clientX: element.getBoundingClientRect().left,
                    clientY: element.getBoundingClientRect().top,
                  });
                  element.dispatchEvent(contextMenuEvent);
                }
              });

              element.addEventListener("focus", () => {
                this.announceSettingChange(
                  `Mathematical expression ${
                    index + 1
                  }. Press Enter or Space for options.`
                );
              });

              element.setAttribute("data-keyboard-enhanced", "true");
            }
          } else {
            element.removeAttribute("tabindex");
          }
        });

        logInfo(
          `✅ Tab order updated: ${enabled ? "included" : "excluded"} ${
            mathElements.length
          } elements`
        );
      } catch (error) {
        logError("Error updating math element tab order:", error);
      }
    }

    /**
     * Show visual feedback during updates
     */
    showUpdateFeedback(message) {
      let feedback = document.getElementById("mathjax-update-feedback");
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = "mathjax-update-feedback";
        feedback.style.cssText = `
          position: fixed; top: 20px; right: 20px; background: var(--primary-color, #2563eb);
          color: white; padding: 12px 20px; border-radius: 6px; font-size: 14px; z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s ease;
        `;
        document.body.appendChild(feedback);
      }
      feedback.textContent = message;
      feedback.style.opacity = "1";
    }

    /**
     * Hide visual feedback
     */
    hideUpdateFeedback() {
      const feedback = document.getElementById("mathjax-update-feedback");
      if (feedback) {
        feedback.style.opacity = "0";
        setTimeout(() => {
          if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
          }
        }, 300);
      }
    }

    /**
     * Announce setting changes to screen readers
     */
    announceSettingChange(message) {
      try {
        const announcement = document.createElement("div");
        announcement.className = "sr-only";
        announcement.setAttribute("role", "status");
        announcement.setAttribute("aria-live", "polite");
        announcement.textContent = message;

        document.body.appendChild(announcement);
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 1000);

        logDebug("Screen reader announcement:", message);
      } catch (error) {
        logError("Error making screen reader announcement:", error);
      }
    }

    /**
     * PHASE 2.3: Enhanced accessibility change announcements
     */
    announceAccessibilityChange(feature, enabled, additionalInfo = "") {
      try {
        const status = enabled ? "enabled" : "disabled";
        const message = `${feature} ${status}. ${additionalInfo}`.trim();

        const announcement = document.createElement("div");
        announcement.className = "sr-only";
        announcement.setAttribute("role", "status");
        announcement.setAttribute("aria-live", "assertive");
        announcement.textContent = message;

        document.body.appendChild(announcement);
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 2000);

        logInfo(`Accessibility announcement: ${message}`);
      } catch (error) {
        logError("Error making accessibility announcement:", error);
      }
    }

    /**
     * Detect current MathJax settings on startup
     */
    detectCurrentSettings() {
      try {
        if (window.MathJax?.startup?.document?.menu?.settings) {
          const settings = window.MathJax.startup.document.menu.settings;

          if (settings.zoom) this.currentSettings.zoomTrigger = settings.zoom;
          if (settings.zscale) this.currentSettings.zoomScale = settings.zscale;
          if (settings.assistiveMml !== undefined)
            this.currentSettings.assistiveMml = settings.assistiveMml;
          if (settings.inTabOrder !== undefined)
            this.currentSettings.inTabOrder = settings.inTabOrder;

          logInfo(
            "✅ Current MathJax settings detected:",
            this.currentSettings
          );
          return;
        }
        logInfo("Using default settings (MathJax menu not accessible)");
      } catch (error) {
        logWarn("Error detecting current settings:", error);
      }
    }

    /**
     * Process queued updates
     */
    processUpdateQueue() {
      if (this.updateQueue.length > 0 && !this.isUpdating) {
        const nextUpdate = this.updateQueue.shift();
        setTimeout(nextUpdate, 100);
      }
    }

    /**
     * Get current settings for export
     */
    getCurrentSettings() {
      return { ...this.currentSettings };
    }

    /**
     * Update settings from exported document
     */
    applySettings(settings) {
      Object.assign(this.currentSettings, settings);
      logInfo("Applied settings:", this.currentSettings);
    }

    /**
     * Show refresh required dialog for assistive MathML re-enabling
     */
    showRefreshRequiredDialog(checkbox) {
      const shouldRefresh = confirm(
        "Re-enabling assistive MathML requires refreshing the page to reload MathJax components.\n\n" +
          "Would you like to refresh now? (Any unsaved changes will be lost)"
      );

      if (shouldRefresh) {
        window.location.reload();
      } else {
        // Revert checkbox state
        checkbox.checked = false;
        this.announceAccessibilityChange(
          "Assistive MathML",
          false,
          "Re-enabling cancelled. Page refresh required to re-enable assistive MathML."
        );
      }
    }

    /**
     * Show refresh warning for assistive MathML disabling
     */
    showRefreshWarning(feature) {
      this.announceAccessibilityChange(
        "Assistive MathML",
        false,
        "Assistive MathML disabled. To re-enable, check the box and refresh the page."
      );
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    DynamicMathJaxManager,

    // Utility functions for external use
    createManager() {
      return new DynamicMathJaxManager();
    },
  };
})();

// Make globally available for other modules
window.MathJaxManager = MathJaxManager;
