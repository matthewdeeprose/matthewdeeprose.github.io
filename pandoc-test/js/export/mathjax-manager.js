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
        // PHASE 1F PART B: Enhanced initialization checks
        // Check if MathJax is available and has startup promise
        if (
          window.MathJax &&
          window.MathJax.startup &&
          window.MathJax.startup.promise
        ) {
          window.MathJax.startup.promise
            .then(() => {
              this.setupEventHandlers();
              this.detectCurrentSettings();
              this.setupEnvironmentTracking(); // PHASE 1F PART B: Setup environment detection
              logInfo("✅ Dynamic MathJax Manager initialised successfully");
            })
            .catch((error) => {
              logError("Error in MathJax startup promise:", error);
              // Retry initialization
              setTimeout(() => this.initialise(), 500);
            });
        } else if (window.MathJax && window.MathJax.startup) {
          // MathJax exists but promise not ready yet - retry
          logInfo("MathJax startup promise not ready - retrying in 500ms");
          setTimeout(() => this.initialise(), 500);
        } else {
          logWarn("MathJax not available - retrying in 500ms");
          setTimeout(() => this.initialise(), 500);
        }
      } catch (error) {
        logError("Error initialising Dynamic MathJax Manager:", error);
        // Retry on error
        setTimeout(() => this.initialise(), 500);
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
        // ✅ FIX: Use setTimeout to ensure we get the updated checked value
        setTimeout(() => {
          const enabled = event.target.checked;
          logInfo(`🔧 Assistive MathML control: ${enabled}`);

          if (!enabled) {
            // Disabling works immediately
            this.updateAssistiveMathML(false);
            this.showRefreshWarning("assistive-mathml-disable");
          } else {
            // ✅ IMPROVED UX: Show accessible message instead of disruptive dialog
            this.showRefreshRequiredMessage(event.target);
          }
        }, 10);
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
      // ✅ REDIRECT: Let mathjax-controls.js handle tab order
      logInfo("Tab order managed by mathjax-controls.js, delegating...");
      if (
        window.dynamicMathJaxManager &&
        window.dynamicMathJaxManager.updateMathElementTabOrderImmediate
      ) {
        window.dynamicMathJaxManager.updateMathElementTabOrderImmediate(
          enabled
        );
      }
      return;
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
     * PHASE 1F PART B: Parse source LaTeX to extract environment information
     * This captures environment types BEFORE Pandoc strips them
     *
     * @param {string} sourceLatex - The source LaTeX content
     * @returns {Array} - Array of {env, content, normalized} objects
     */
    /**
     * PHASE 1F PART B: Parse LaTeX source to extract math environments
     * FIXED: Now strips document structure and only matches math environments
     *
     * This captures environment types BEFORE Pandoc processes them.
     * The key improvements:
     * 1. Strips \begin{document}...\end{document} wrapper to prevent greedy matching
     * 2. Only matches MATH environments (align, gather, equation, etc.)
     * 3. Ignores structural environments (document, section, figure, etc.)
     *
     * @param {string} sourceLatex - The source LaTeX content
     * @returns {Array} - Array of {env, content, normalized} objects
     */
    parseSourceEnvironments(sourceLatex) {
      const environments = [];

      try {
        // DIAGNOSTIC: Log call stack to find duplicate callers
        const callStack = new Error().stack;
        logInfo(
          "=== parseSourceEnvironments: Starting environment detection ==="
        );
        logDebug(
          "Called from stack:",
          callStack.split("\n").slice(1, 4).join("\n")
        );
        // STEP 1: Strip document structure (preamble and document wrapper)
        // This prevents the regex from matching \begin{document}...\end{document}
        let cleanLatex = sourceLatex;

        // Extract content between \begin{document} and \end{document} if present
        const docMatch = sourceLatex.match(
          /\\begin\{document\}([\s\S]*?)\\end\{document\}/
        );
        if (docMatch) {
          cleanLatex = docMatch[1];
          logDebug("✅ Stripped document wrapper, processing body only");
          logDebug(`   Document body length: ${cleanLatex.length} characters`);
        } else {
          logDebug("ℹ️  No document wrapper found, processing entire input");
        }

        // STEP 2: Match ONLY math environments (not document/section/figure/etc)
        // Supported: align, align*, gather, gather*, equation, equation*, multline, flalign, alignat
        // CRITICAL FIX: Added \*? to equation to match equation*
        const mathEnvPattern =
          /\\begin\{(align\*?|gather\*?|equation\*?|multline\*?|flalign\*?|alignat\*?)\}([\s\S]*?)\\end\{\1\}/g;

        logDebug("🔍 Scanning for math environments with pattern:");
        logDebug(
          "   align|align*|gather|gather*|equation|equation*|multline|multline*|flalign|flalign*|alignat|alignat*"
        );

        let match;
        let matchCount = 0;
        while ((match = mathEnvPattern.exec(cleanLatex)) !== null) {
          matchCount++;
          const envName = match[1]; // e.g., 'align', 'align*', 'equation*'
          const content = match[2].trim(); // Inner content

          // Enhanced normalization for reliable matching
          // This handles variations in whitespace and newlines
          const normalized = content
            .replace(/\\\\/g, "\\\\") // Normalize double backslashes
            .replace(/\s+/g, " ") // Collapse all whitespace
            .trim(); // Remove leading/trailing

          environments.push({
            env: envName,
            content: content,
            normalized: normalized,
          });

          const isNumbered = !envName.endsWith("*");
          const numberStatus = isNumbered ? "NUMBERED" : "UNNUMBERED";

          logDebug(
            `✅ Match ${matchCount}: ${envName} (${numberStatus}) - content length: ${content.length}`
          );
          logDebug(`   Content preview: "${content.substring(0, 50)}..."`);
        }

        // Summary logging
        const numbered = environments.filter(
          (e) => !e.env.endsWith("*")
        ).length;
        const unnumbered = environments.filter((e) =>
          e.env.endsWith("*")
        ).length;

        logInfo(
          `✅ Parsed ${environments.length} math environment(s) from source LaTeX`
        );
        logInfo(`   - ${numbered} numbered environments`);
        logInfo(`   - ${unnumbered} unnumbered (starred) environments`);

        if (environments.length === 0) {
          logWarn("⚠️  No math environments found in source LaTeX");
        }

        logDebug("=== parseSourceEnvironments: Complete ===");

        return environments;
      } catch (error) {
        logError("Error parsing source environments:", error);
        return [];
      }
    }

    /**
     * PHASE 1F PART D: Registry to store parsed environments with metadata
     * Maps normalized content to environment objects containing name and numbering status
     */
    environmentRegistry = new Map();

    /**
     * PHASE 1F PART D: Determine if environment is numbered
     * Starred environments (*) are unnumbered, others are numbered
     *
     * @param {string} envName - Environment name (e.g., 'align', 'align*', 'equation')
     * @returns {boolean} - true if environment should be numbered
     */
    isNumberedEnvironment(envName) {
      // Starred environments are always unnumbered
      if (envName.endsWith("*")) {
        return false;
      }

      // Known numbered environments
      const numberedEnvs = [
        "equation",
        "align",
        "gather",
        "multline",
        "flalign",
        "alignat",
      ];

      return numberedEnvs.includes(envName);
    }

    /**
     * PHASE 1F PART D: Register environments from source LaTeX with metadata
     * Call this before conversion to build the registry
     *
     * @param {string} sourceLatex - The source LaTeX content
     */
    registerSourceEnvironments(sourceLatex) {
      this.environmentRegistry.clear();

      const environments = this.parseSourceEnvironments(sourceLatex);

      environments.forEach(({ env, content, normalized }) => {
        // Store environment metadata (not just name)
        const envData = {
          name: env,
          numbered: this.isNumberedEnvironment(env),
        };

        this.environmentRegistry.set(normalized, envData);

        const numberStatus = envData.numbered ? "numbered" : "unnumbered";
        logDebug(
          `🔍 Registered ${numberStatus}: "${normalized.substring(
            0,
            30
          )}..." → ${env}`
        );
      });

      logInfo(`✅ Registered ${this.environmentRegistry.size} environments`);
      return this.environmentRegistry.size;
    }

    /**
     * PHASE 1F PART D: Look up environment data from content
     * Matches container content to registry and returns full metadata
     *
     * @param {string} content - The annotation content from container
     * @returns {Object|null} - Environment data {name, numbered} or null
     */
    lookupEnvironment(content) {
      const normalized = content.replace(/\s+/g, " ").trim();
      return this.environmentRegistry.get(normalized) || null;
    }

    /**
     * PHASE 1F PART B: Restore environment wrappers in HTML for playground numbering
     *
     * Pandoc converts LaTeX environments in ways that prevent MathJax numbering:
     * - \begin{align} → \[\begin{aligned}...\end{aligned}\]  (unnumbered)
     * - \begin{gather} → \[\begin{gathered}...\end{gathered}\]  (unnumbered)
     *
     * This function:
     * 1. Parses the HTML to find math display spans
     * 2. Looks up original environment from registry
     * 3. Restores correct wrapper: \begin{align}...\end{align} (numbered!)
     *
     * @param {string} html - HTML output from Pandoc
     * @returns {string} - HTML with restored environment wrappers
     */
    restoreEnvironmentWrappersInHTML(html) {
      // Only process if we have registered environments
      if (!this.environmentRegistry || this.environmentRegistry.size === 0) {
        logDebug("No registered environments, skipping wrapper restoration");
        return html;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find all math display spans
        const mathSpans = doc.querySelectorAll("span.math.display");
        let restoredCount = 0;

        mathSpans.forEach((span) => {
          const originalContent = span.textContent;

          // Pandoc wraps in \[...\] which we need to check
          const unwrappedMatch = originalContent.match(/^\\\[([\s\S]*)\\\]$/);

          if (!unwrappedMatch) {
            return; // Not wrapped, skip
          }

          const innerContent = unwrappedMatch[1].trim();

          // CASE 1: Pandoc-converted environments (align → aligned, gather → gathered)
          const pandocEnvMatch = innerContent.match(
            /^\\begin\{(aligned|gathered)\}([\s\S]*)\\end\{\1\}$/
          );

          if (pandocEnvMatch) {
            const pandocEnvName = pandocEnvMatch[1]; // 'aligned' or 'gathered'
            const mathContent = pandocEnvMatch[2].trim();

            // Decode HTML entities ONLY for registry lookup
            // DO NOT use decoded version for final output
            const decodedForLookup = mathContent
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");

            // Normalize for registry lookup
            const normalized = decodedForLookup
              .replace(/\\\\/g, "\\\\")
              .replace(/\s+/g, " ")
              .trim();

            // Look up original environment from registry
            const envData = this.environmentRegistry.get(normalized);

            if (envData) {
              const originalEnv = envData.name;

              // CRITICAL FIX: Use ORIGINAL mathContent (with HTML entities) for output
              // This preserves proper escaping (< stays as &lt;, > stays as &gt;)
              const restoredContent = `\\begin{${originalEnv}}\n${mathContent}\n\\end{${originalEnv}}`;
              span.textContent = restoredContent;

              // CRITICAL: Only add numbered-env class for numbered environments
              if (envData.numbered) {
                span.classList.remove("display");
                span.classList.add("numbered-env");
                logDebug(
                  `✅ Restored NUMBERED ${originalEnv} wrapper (Pandoc used ${pandocEnvName})`
                );
              } else {
                // Keep as display for unnumbered environments
                span.classList.add("display");
                span.classList.remove("numbered-env");
                logDebug(
                  `✅ Restored UNNUMBERED ${originalEnv} wrapper (Pandoc used ${pandocEnvName})`
                );
              }

              span.setAttribute("data-math-env", originalEnv);
              span.setAttribute("data-numbered", envData.numbered.toString());

              restoredCount++;
              return; // Done with this span
            }
          }

          // CASE 2: Pandoc-stripped environments (equation → bare content in \[...\])
          // For these, Pandoc removes the environment wrapper completely
          // We need to check if the content matches something in our registry

          // Decode HTML entities ONLY for registry lookup
          const decodedForLookup = innerContent
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          // Normalize for registry lookup
          const normalizedInner = decodedForLookup
            .replace(/\\\\/g, "\\\\")
            .replace(/\s+/g, " ")
            .trim();

          // Try to find this content in the registry
          const envData = this.environmentRegistry.get(normalizedInner);

          if (envData) {
            const registeredEnv = envData.name;

            // CRITICAL FIX: Use ORIGINAL innerContent (with HTML entities) for output
            // This preserves proper escaping throughout the export pipeline
            const restoredContent = `\\begin{${registeredEnv}}\n${innerContent}\n\\end{${registeredEnv}}`;
            span.textContent = restoredContent;

            // CRITICAL: Only add numbered-env class for numbered environments
            if (envData.numbered) {
              span.classList.remove("display");
              span.classList.add("numbered-env");
              logDebug(
                `✅ Restored NUMBERED ${registeredEnv} wrapper (Pandoc stripped environment)`
              );
            } else {
              // Keep as display for unnumbered environments
              span.classList.add("display");
              span.classList.remove("numbered-env");
              logDebug(
                `✅ Restored UNNUMBERED ${registeredEnv} wrapper (Pandoc stripped environment)`
              );
            }

            span.setAttribute("data-math-env", registeredEnv);
            span.setAttribute("data-numbered", envData.numbered.toString());

            restoredCount++;
          } else {
            logDebug(
              `⚠️ No registry entry for content: "${normalizedInner.substring(
                0,
                30
              )}..."`
            );
          }
        });

        if (restoredCount > 0) {
          logInfo(
            `✅ Restored ${restoredCount} environment wrapper(s) for numbering`
          );
        }

        return doc.body.innerHTML;
      } catch (error) {
        logError("Error restoring environment wrappers:", error);
        return html; // Return original on error
      }
    }

    /**
     * Wrap restored environment content in MathJax delimiters
     * After restoreEnvironmentWrappersInHTML puts \begin{equation}...\end{equation} in spans,
     * this method wraps them in \[...\] so MathJax will process them.
     * This enables MathJax to render the underbrace and other LaTeX commands inside.
     *
     * @param {string} html - HTML with restored environments
     * @returns {string} - HTML with delimited content
     */
    wrapRestoredEnvironmentsForMathJax(html) {
      if (!this.environmentRegistry || this.environmentRegistry.size === 0) {
        logDebug("No registered environments, skipping delimiter wrapping");
        return html;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find all numbered-env spans (these have restored environments)
        const numberedEnvSpans = doc.querySelectorAll("span.math.numbered-env");
        let wrappedCount = 0;

        numberedEnvSpans.forEach((span) => {
          const content = span.textContent;

          // Check if content starts with \begin{ and ends with \end{
          if (
            content.trim().startsWith("\\begin{") &&
            content.trim().includes("\\end{")
          ) {
            // Wrap in display math delimiters for MathJax processing
            span.textContent = `\\[${content}\\]`;
            wrappedCount++;
            logDebug(
              `Wrapped environment in delimiters for MathJax processing`
            );
          }
        });

        if (wrappedCount > 0) {
          logInfo(
            `✅ Wrapped ${wrappedCount} restored environment(s) in \\[...\\] delimiters for MathJax`
          );
        }

        return doc.body.innerHTML;
      } catch (error) {
        logError("Error wrapping restored environments:", error);
        return html; // Return original on error
      }
    }

    /**
     * PHASE 1F PART B: Reset MathJax equation counter
     * Called before each render to ensure equation numbering starts from (1)
     * This prevents counter persistence between playground conversions
     */
    resetEquationCounter() {
      try {
        if (window.MathJax?.texReset) {
          window.MathJax.texReset();
          logInfo("✅ MathJax equation counter reset");
          return true;
        }

        // Alternative reset method for older MathJax versions
        if (window.MathJax?.config?.tex?.tags) {
          // Force re-initialisation of tag counter
          const tagConfig = window.MathJax.config.tex.tags;
          if (typeof tagConfig === "object") {
            logInfo("✅ MathJax equation counter reset (alternative method)");
            return true;
          }
        }

        logWarn("⚠️ MathJax counter reset not available");
        return false;
      } catch (error) {
        logError("Error resetting equation counter:", error);
        return false;
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
     * PHASE 1F PART B: Setup environment tracking using DOM observation
     * Watches for new MathJax containers and tags them with environment info
     * This approach works with the playground's Pandoc → MathJax workflow
     */
    setupEnvironmentTracking() {
      logInfo(
        "Setting up DOM-based environment tracking for Phase 1F Part B..."
      );

      try {
        // Initial scan of existing containers
        this.scanAndTagContainers();

        // Setup MutationObserver to catch newly rendered math
        this.setupContainerObserver();

        // Expose manual tagging function for external use
        window.tagMathEnvironments = () => this.scanAndTagContainers();

        logInfo("✅ Environment tracking setup complete");
        logInfo("   Use tagMathEnvironments() to manually tag containers");
        return true;
      } catch (error) {
        logError("Error setting up environment tracking:", error);
        return false;
      }
    }

    /**
     * PHASE 1F PART B: Setup MutationObserver to watch for new containers
     * Automatically tags containers as they're added to the DOM
     */
    setupContainerObserver() {
      if (this.containerObserver) {
        logDebug("Container observer already active");
        return;
      }

      try {
        this.containerObserver = new MutationObserver((mutations) => {
          let newContainersFound = false;

          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              // Check if the added node is or contains mjx-container (both cases)
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if node itself is a container (try both cases)
                const isContainerLower =
                  node.matches && node.matches("mjx-container");
                const isContainerUpper =
                  node.matches && node.matches("MJX-CONTAINER");

                if (isContainerLower || isContainerUpper) {
                  this.tagSingleContainer(node);
                  newContainersFound = true;
                } else if (node.querySelectorAll) {
                  // Check for containers inside the node (both cases)
                  const containersLower =
                    node.querySelectorAll("mjx-container");
                  const containersUpper =
                    node.querySelectorAll("MJX-CONTAINER");

                  if (containersLower.length > 0) {
                    containersLower.forEach((c) => this.tagSingleContainer(c));
                    newContainersFound = true;
                  }
                  if (containersUpper.length > 0) {
                    containersUpper.forEach((c) => this.tagSingleContainer(c));
                    newContainersFound = true;
                  }
                }
              }
            });
          });

          if (newContainersFound) {
            logDebug("✅ New containers detected and tagged");
          }
        });

        // Observe the output area (confirmed to exist from diagnostics)
        const outputArea = document.getElementById("output");

        if (outputArea) {
          this.containerObserver.observe(outputArea, {
            childList: true,
            subtree: true,
          });
          logInfo("✅ Observing output area for new containers");
        }

        // Also observe the document body as fallback
        this.containerObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });

        logInfo("✅ Container observer active");
      } catch (error) {
        logError("Error setting up container observer:", error);
      }
    }

    /**
     * PHASE 1F PART B: Scan DOM and tag all existing containers
     * Can be called manually after conversions
     */
    scanAndTagContainers() {
      try {
        // Try both case variations since MathJax uses uppercase custom elements
        const containersLower = document.querySelectorAll("mjx-container");
        const containersUpper = document.querySelectorAll("MJX-CONTAINER");

        // Combine results (use Set to avoid duplicates)
        const allContainers = new Set([...containersLower, ...containersUpper]);
        let taggedCount = 0;

        allContainers.forEach((container) => {
          if (this.tagSingleContainer(container)) {
            taggedCount++;
          }
        });

        logInfo(`✅ Scanned and tagged ${taggedCount} containers`);
        return taggedCount;
      } catch (error) {
        logError("Error scanning containers:", error);
        return 0;
      }
    }

    /**
     * PHASE 1F PART B: Tag a single container with environment data
     * Uses registry lookup to match content to environment names
     *
     * @param {HTMLElement} container - The mjx-container element to tag
     * @returns {boolean} - True if successfully tagged
     */
    tagSingleContainer(container) {
      try {
        // Skip if already tagged
        if (container.hasAttribute("data-latex-env")) {
          return false;
        }

        // Get the LaTeX annotation content
        const mathML = container.querySelector("mjx-assistive-mml math");
        if (!mathML) return false;

        const annotation = mathML.querySelector(
          'annotation[encoding="application/x-tex"]'
        );
        if (!annotation) return false;

        const latex = annotation.textContent.trim();
        if (!latex) return false;

        // Look up environment from registry based on content
        // CRITICAL FIX: lookupEnvironment returns object {name, numbered}, not string
        const envData = this.lookupEnvironment(latex);

        if (envData) {
          // Extract environment name from returned object
          const envName = envData.name;
          container.setAttribute("data-latex-env", envName);

          // Also store numbering status for potential future use
          container.setAttribute("data-numbered", envData.numbered.toString());

          logDebug(
            `✅ Tagged container with environment: ${envName} (${
              envData.numbered ? "numbered" : "unnumbered"
            }) from registry`
          );
          return true;
        } else {
          // Fallback: Detect from content patterns (heuristic)
          const detectedEnv = this.detectEnvironmentFromContent(latex);
          if (detectedEnv) {
            container.setAttribute("data-latex-env", detectedEnv);
            logDebug(
              `✅ Tagged container with environment: ${detectedEnv} (from heuristic)`
            );
            return true;
          }
        }

        return false;
      } catch (error) {
        logWarn("Error tagging single container:", error);
        return false;
      }
    }

    /**
     * PHASE 1F PART B: Heuristic fallback for environment detection
     * Used when registry lookup fails
     * Note: Cannot distinguish align vs align* - defaults to starred (unnumbered)
     *
     * @param {string} latex - The LaTeX content
     * @returns {string|null} - Detected environment name or null
     */
    detectEnvironmentFromContent(latex) {
      const hasAlignment = latex.includes("&");
      const hasLineBreaks = latex.includes("\\\\") || latex.includes("\\\n");

      if (hasAlignment && hasLineBreaks) {
        return "align*"; // Default to unnumbered (matches playground behavior)
      } else if (hasLineBreaks && !hasAlignment) {
        return "gather*"; // Default to unnumbered
      }

      return null; // Not a multi-line environment
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
     * Show accessible refresh required message (replaces disruptive confirm dialog)
     */
    showRefreshRequiredMessage(checkbox) {
      // Create or find the message container
      let messageContainer = document.getElementById(
        "assistive-mathml-message"
      );
      if (!messageContainer) {
        messageContainer = document.createElement("div");
        messageContainer.id = "assistive-mathml-message";
        messageContainer.setAttribute("role", "status");
        messageContainer.setAttribute("aria-live", "polite");
        messageContainer.className = "assistive-mathml-message warning";
        messageContainer.setAttribute("role", "status");
        messageContainer.setAttribute("aria-live", "polite");

        // Insert after the checkbox's parent form group
        const formGroup = checkbox.closest(".form-group");
        if (formGroup && formGroup.parentNode) {
          formGroup.parentNode.insertBefore(
            messageContainer,
            formGroup.nextSibling
          );
        } else {
          // Fallback: insert after checkbox
          checkbox.parentNode.insertBefore(
            messageContainer,
            checkbox.nextSibling
          );
        }
      }

      // Update classes for warning state
      messageContainer.className = "assistive-mathml-message warning";

      // Show the message with CSS classes
      messageContainer.innerHTML = `
    <div class="message-content">
      <span class="message-icon" aria-hidden="true">⚠️</span>
      <div class="message-text">
        <strong>Page refresh required</strong><br>
        Re-enabling assistive MathML requires refreshing the page to reload MathJax components.
        <div class="message-buttons">
          <button class="message-button primary" onclick="window.location.reload();">
            Refresh Now
          </button>
          <button class="message-button secondary" onclick="this.closest('#assistive-mathml-message').style.display='none'; document.getElementById('assistive-mathml').checked=false;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

      // Make container visible
      messageContainer.style.display = "block";

      // Announce to screen readers
      this.announceAccessibilityChange(
        "Assistive MathML",
        false,
        "Re-enabling requires page refresh. Use the refresh button below or refresh manually."
      );

      logInfo("✅ Refresh required message displayed with accessible controls");
    }

    /**
     * Show refresh warning for assistive MathML disabling
     */
    showRefreshWarning(feature) {
      // Get the checkbox to disable it
      const assistiveMathMLCheckbox =
        document.getElementById("assistive-mathml");

      // Disable the checkbox to prevent immediate re-enabling
      if (assistiveMathMLCheckbox) {
        assistiveMathMLCheckbox.disabled = true;
      }

      // Create or find the message container
      let messageContainer = document.getElementById(
        "assistive-mathml-message"
      );
      if (!messageContainer) {
        messageContainer = document.createElement("div");
        messageContainer.id = "assistive-mathml-message";
        messageContainer.className = "assistive-mathml-message success";
        messageContainer.setAttribute("role", "status");
        messageContainer.setAttribute("aria-live", "polite");

        // Insert after the checkbox's parent form group
        const formGroup = assistiveMathMLCheckbox?.closest(".form-group");
        if (formGroup && formGroup.parentNode) {
          formGroup.parentNode.insertBefore(
            messageContainer,
            formGroup.nextSibling
          );
        } else if (assistiveMathMLCheckbox) {
          // Fallback: insert after checkbox
          assistiveMathMLCheckbox.parentNode.insertBefore(
            messageContainer,
            assistiveMathMLCheckbox.nextSibling
          );
        }
      }

      // Update classes for success state
      messageContainer.className = "assistive-mathml-message success";

      // Show the disabled message with CSS classes
      messageContainer.innerHTML = `
    <div class="message-content">
      <span class="message-icon" aria-hidden="true">✅</span>
      <div class="message-text">
        <strong>Assistive MathML disabled</strong><br>
        Screen reader optimisation removed for performance. To re-enable, use the button below (requires page refresh).
        <div class="message-buttons">
          <button class="message-button primary" onclick="
            const checkbox = document.getElementById('assistive-mathml');
            checkbox.disabled = false;
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
          ">
            Re-enable Assistive MathML
          </button>
          <button class="message-button secondary" onclick="this.closest('#assistive-mathml-message').style.display='none';">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  `;

      // Make container visible
      messageContainer.style.display = "block";

      // Screen reader announcement
      this.announceAccessibilityChange(
        "Assistive MathML",
        false,
        "Assistive MathML disabled. Screen reader optimisation removed. Use the re-enable button to restore functionality."
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

    // PHASE 1F PART B: Environment detection and counter management
    resetEquationCounter() {
      if (window.MathJaxManagerInstance) {
        return window.MathJaxManagerInstance.resetEquationCounter();
      }
      logWarn("MathJax Manager instance not available");
      return false;
    },

    detectEnvironmentFromMath(mathItem) {
      if (window.MathJaxManagerInstance) {
        return window.MathJaxManagerInstance.detectEnvironmentFromMath(
          mathItem
        );
      }
      return null;
    },
  };
})();

// Make globally available for other modules
window.MathJaxManager = MathJaxManager;

// PHASE 1F PART B: Create and store global manager instance
// This allows the public API functions to access the manager
if (!window.MathJaxManagerInstance) {
  window.MathJaxManagerInstance = MathJaxManager.createManager();

  // PHASE 1F PART B: Delayed initialization to ensure MathJax is loaded
  // Wait for both DOM ready AND MathJax to be available
  function initializeWhenReady() {
    if (document.readyState === "loading") {
      // DOM still loading - wait for it
      document.addEventListener("DOMContentLoaded", () => {
        // DOM ready, now wait a bit for MathJax
        setTimeout(() => {
          window.MathJaxManagerInstance.initialise();
        }, 100);
      });
    } else {
      // DOM already loaded, wait a bit for MathJax to initialize
      setTimeout(() => {
        window.MathJaxManagerInstance.initialise();
      }, 100);
    }
  }

  initializeWhenReady();
}

// PHASE 1F PART B: Expose testing commands
window.testEnvironmentDetection = function () {
  console.log("🧪 Testing environment detection...");
  console.log("MathJax Manager Instance:", !!window.MathJaxManagerInstance);
  console.log(
    "Reset Counter Function:",
    typeof MathJaxManager.resetEquationCounter
  );

  // Try resetting counter
  const resetResult = MathJaxManager.resetEquationCounter();
  console.log("Counter reset:", resetResult ? "✅ Success" : "❌ Failed");

  // Try manual tagging first
  if (window.tagMathEnvironments) {
    console.log("Running manual environment scan...");
    const taggedCount = window.tagMathEnvironments();
    console.log(`Tagged ${taggedCount} containers`);
  }

  // Check for environment-tagged containers (try both cases)
  const containersLower = document.querySelectorAll(
    "mjx-container[data-latex-env]"
  );
  const containersUpper = document.querySelectorAll(
    "MJX-CONTAINER[data-latex-env]"
  );
  const containers = [...containersLower, ...containersUpper];
  console.log(`Found ${containers.length} containers with environment data`);

  containers.forEach((container, index) => {
    const env = container.getAttribute("data-latex-env");
    const latex = container
      .querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent.substring(0, 50);
    console.log(`  Container ${index + 1}: ${env} - ${latex}...`);
  });

  if (containers.length === 0) {
    console.log("ℹ️ No environments detected yet. Render some math first.");
    console.log(
      "ℹ️ Try: Convert a document with \\begin{align}...\\end{align}"
    );
    console.log("ℹ️ After conversion, run: tagMathEnvironments()");
  }

  return {
    managerAvailable: !!window.MathJaxManagerInstance,
    counterReset: resetResult,
    containersFound: containers.length,
  };
};

console.log("🎯 Phase 1F Part B testing commands available:");
console.log("  - testEnvironmentDetection() - Test environment tracking");
console.log("  - tagMathEnvironments() - Manually scan and tag all containers");
console.log(
  "  - MathJaxManager.resetEquationCounter() - Reset equation counter"
);

// PHASE 1F PART B: Registry management commands
window.registerEnvironments = function (sourceLatex) {
  if (!sourceLatex) {
    console.log("Usage: registerEnvironments(sourceLatex)");
    console.log(
      "Example: registerEnvironments(document.getElementById('latex-input').value)"
    );
    return 0;
  }

  if (window.MathJaxManagerInstance) {
    const count =
      window.MathJaxManagerInstance.registerSourceEnvironments(sourceLatex);
    console.log(`✅ Registered ${count} environments`);
    return count;
  }
  return 0;
};

window.showRegistry = function () {
  if (
    window.MathJaxManagerInstance &&
    window.MathJaxManagerInstance.environmentRegistry
  ) {
    console.log("📚 Environment Registry:");
    window.MathJaxManagerInstance.environmentRegistry.forEach(
      (env, content) => {
        console.log(`  "${content.substring(0, 40)}..." → ${env}`);
      }
    );
    console.log(
      `Total: ${window.MathJaxManagerInstance.environmentRegistry.size} entries`
    );
  } else {
    console.log("Registry not available");
  }
};

console.log("📚 Phase 1F Part B registry commands:");
console.log(
  "  - registerEnvironments(latex) - Parse and register environments"
);
console.log("  - showRegistry() - View current registry");
