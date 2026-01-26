/**
 * @fileoverview Ally Statement Preview - Main Controller Module
 * @module AllyStatementPreview
 * @requires ALLY_CONFIG
 * @requires ALLY_API_CLIENT
 * @requires ALLY_UI_MANAGER
 * @requires ALLY_STATEMENT_PREVIEW_CONFIG
 * @requires ALLY_STATEMENT_PREVIEW_SEARCH
 * @version 1.0.0
 * @since Phase 7B
 *
 * @description
 * Main controller for the Accessibility Statement Preview feature.
 * Fetches Issues API data and renders student-facing accessibility warnings.
 *
 * Key Features:
 * - Course selection handling
 * - Issues API integration
 * - Conditional theme rendering (only shows themes with issues)
 * - Disclosure widget functionality (Read more/Read less)
 * - Data freshness warning
 * - Success state for zero issues
 * - Course metadata in collapsible details section
 *
 * @example
 * ALLY_STATEMENT_PREVIEW.initialise();
 * ALLY_STATEMENT_PREVIEW.generatePreview();
 */

const ALLY_STATEMENT_PREVIEW = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error("[AllyStatementPreview] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementPreview] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementPreview] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementPreview] " + message, ...args);
  }

  // ========================================================================
  // Private State
  // ========================================================================

  let initialised = false;
  let listenersAttached = false;
  let selectedCourse = null;
  let lastPreviewData = null;

  // Cache integration state
  let backgroundRefreshInProgress = false;
  let currentCacheKey = null;

  // Cached DOM elements
  const elements = {
    executeButton: null,
    progressSection: null,
    progressFill: null,
    progressMessage: null,
    resultsContainer: null,
    courseDetails: null,
    courseMetadata: null,
  };
  // ========================================================================
  // DOM Utilities
  // ========================================================================

  /**
   * Caches DOM element references
   * @returns {boolean} True if all required elements found
   */
  function cacheElements() {
    elements.executeButton = document.getElementById("ally-sp-execute");
    elements.progressSection = document.getElementById("ally-sp-progress");
    elements.progressFill = document.getElementById("ally-sp-progress-fill");
    elements.progressMessage = document.getElementById(
      "ally-sp-progress-message",
    );
    elements.resultsContainer = document.getElementById("ally-sp-results");
    elements.courseDetails = document.getElementById("ally-sp-course-details");
    elements.courseMetadata = document.getElementById(
      "ally-sp-course-metadata",
    );

    const allFound =
      elements.executeButton &&
      elements.progressSection &&
      elements.resultsContainer;

    if (!allFound) {
      logWarn("Some Statement Preview elements not found");
      logDebug("Elements found:", {
        executeButton: !!elements.executeButton,
        progressSection: !!elements.progressSection,
        progressFill: !!elements.progressFill,
        progressMessage: !!elements.progressMessage,
        resultsContainer: !!elements.resultsContainer,
        courseDetails: !!elements.courseDetails,
        courseMetadata: !!elements.courseMetadata,
      });
    }

    return allFound;
  }

  /**
   * Creates an HTML element with attributes
   * @param {string} tag - Element tag name
   * @param {Object} attrs - Attributes to set
   * @param {string|Array|Node} children - Text content, child elements, or single node
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);

    if (attrs) {
      for (const key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          if (key === "className") {
            el.className = attrs[key];
          } else if (key === "dataset") {
            for (const dataKey in attrs[key]) {
              if (Object.prototype.hasOwnProperty.call(attrs[key], dataKey)) {
                el.dataset[dataKey] = attrs[key][dataKey];
              }
            }
          } else if (key.startsWith("aria")) {
            // Convert camelCase to kebab-case for ARIA attributes
            const ariaAttr = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            el.setAttribute(ariaAttr, attrs[key]);
          } else if (key === "onclick" || key === "onkeydown") {
            // Event handlers
            el[key] = attrs[key];
          } else {
            el.setAttribute(key, attrs[key]);
          }
        }
      }
    }

    if (children !== undefined && children !== null) {
      if (typeof children === "string") {
        el.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (child) {
          if (child) {
            if (typeof child === "string") {
              el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
              el.appendChild(child);
            }
          }
        });
      } else if (children instanceof Node) {
        el.appendChild(children);
      }
    }

    return el;
  }

  /**
   * Escapes HTML entities for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================================================
  // Progress Management
  // ========================================================================

  /**
   * Shows progress indicator
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage (0-100)
   */
  function showProgress(message, percent) {
    if (!elements.progressSection) return;

    elements.progressSection.hidden = false;

    if (elements.progressMessage) {
      elements.progressMessage.textContent = message;
    }

    if (elements.progressFill) {
      elements.progressFill.style.width = percent + "%";
    }

    const progressBar = elements.progressFill
      ? elements.progressFill.parentElement
      : null;
    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", percent);
    }
  }

  /**
   * Hides progress indicator
   */
  function hideProgress() {
    if (elements.progressSection) {
      elements.progressSection.hidden = true;
    }
  }

  // ========================================================================
  // Course Selection Handler
  // ========================================================================

  /**
   * Handles course selection changes from search module
   * @param {Object|null} course - Selected course or null if cleared
   */
  function handleCourseSelectionChange(course) {
    var previousCourse = selectedCourse;
    selectedCourse = course;
    logDebug("Course selection changed:", course ? course.name : "none");

    // Enable/disable execute button
    if (elements.executeButton) {
      elements.executeButton.disabled = !course;
    }

    // Only clear results when selecting a DIFFERENT course (not when clearing)
    // This preserves the statement when user clicks Clear button
    if (course && previousCourse && course.id !== previousCourse.id) {
      if (elements.resultsContainer) {
        elements.resultsContainer.hidden = true;
        elements.resultsContainer.innerHTML = "";
      }

      if (elements.courseDetails) {
        elements.courseDetails.hidden = true;
      }
    }

    // Announce to screen readers
    if (course && typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce(
        "Course selected: " +
          course.name +
          ". Press Generate Statement Preview button to view accessibility information.",
      );
    }
  }

  // ========================================================================
  // Disclosure Widget
  // ========================================================================

  /**
   * Toggles disclosure expanded/collapsed state
   *
   * IMPORTANT: This function physically moves the button in the DOM to ensure
   * focus order matches visual order (WCAG 2.4.3 Focus Order compliance).
   *
   * When expanded: button moves AFTER content (so Tab moves through content first)
   * When collapsed: button moves BEFORE content (standard disclosure position)
   *
   * @param {HTMLButtonElement} button - The disclosure button
   */
  function toggleDisclosure(button) {
    const expanded = button.getAttribute("aria-expanded") === "true";
    const targetId = button.getAttribute("aria-controls");
    const targetContent = document.getElementById(targetId);

    if (!targetContent) {
      logError("Target content not found:", targetId);
      return;
    }

    const newState = !expanded;
    button.setAttribute("aria-expanded", String(newState));

    // Toggle content visibility AND move button in DOM for correct focus order
    // This ensures visual order = DOM order = focus order (WCAG 2.4.3)
    const wrapper = targetContent.parentNode;

    if (newState) {
      // Expanding: show content and move button after content
      targetContent.removeAttribute("hidden");
      wrapper.appendChild(button);
    } else {
      // Collapsing: hide content and move button before content
      targetContent.setAttribute("hidden", "");
      wrapper.insertBefore(button, targetContent);
      // Restore focus to button after DOM move (focus is lost when element moves)
      button.focus();
    }

    // Update button text (Read more ↔ Read less)
    const buttonTextSpan = button.querySelector(".ally-sp-disclosure-text");
    if (buttonTextSpan) {
      const currentText = buttonTextSpan.textContent;
      if (newState) {
        buttonTextSpan.textContent = currentText.replace(
          /Read more about/,
          "Read less about",
        );
      } else {
        buttonTextSpan.textContent = currentText.replace(
          /Read less about/,
          "Read more about",
        );
      }
    }

    logDebug(
      "Disclosure toggled:",
      targetId,
      newState ? "expanded" : "collapsed",
    );
  }
  // ========================================================================
  // Rendering Functions
  // ========================================================================

  /**
   * Formats a date string for display
   * @param {string} dateString - ISO date string or date string from API
   * @returns {string} Formatted date string
   */
  function formatDate(dateString) {
    if (!dateString) return "Unknown";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  }

  /**
   * Renders the data freshness warning
   * @param {string} lastCheckedOn - Date string from API
   * @returns {HTMLElement} Warning element
   */
  function renderDataFreshnessWarning(lastCheckedOn) {
    var warning = createElement("div", {
      className: "ally-sp-freshness-warning",
      role: "note",
      ariaLabel: "Data freshness notice",
    });

    // Icon
    warning.appendChild(
      createElement("span", {
        ariaHidden: "true",
        className: "ally-sp-warning-icon",
        dataset: { icon: "warning" },
      }),
    );

    // Content wrapper
    var content = createElement("div", {
      className: "ally-sp-warning-content",
    });

    var heading = createElement("strong", {}, "Data freshness: ");
    content.appendChild(heading);

    // Calculate age of data
    var ageText = "";
    if (lastCheckedOn) {
      var lastChecked = new Date(lastCheckedOn);
      var now = new Date();
      var diffMs = now - lastChecked;
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        ageText = "today";
      } else if (diffDays === 1) {
        ageText = "yesterday";
      } else if (diffDays < 7) {
        ageText = diffDays + " days ago";
      } else if (diffDays < 30) {
        var weeks = Math.floor(diffDays / 7);
        ageText = weeks === 1 ? "1 week ago" : weeks + " weeks ago";
      } else {
        var months = Math.floor(diffDays / 30);
        ageText = months === 1 ? "1 month ago" : months + " months ago";
      }
    }

    // Build message with semantic <time> element
    var messageText = "This information was last updated ";
    if (lastCheckedOn) {
      var timeEl = createElement(
        "time",
        {
          datetime: lastCheckedOn,
        },
        formatDate(lastCheckedOn),
      );

      var span = document.createElement("span");
      span.appendChild(document.createTextNode(messageText));
      span.appendChild(timeEl);
      if (ageText) {
        span.appendChild(document.createTextNode(" (" + ageText + ")"));
      }
      span.appendChild(
        document.createTextNode(
          ". The actual accessibility status may have changed since then.",
        ),
      );
      content.appendChild(span);
    } else {
      content.appendChild(
        document.createTextNode(
          messageText +
            "at an unknown time. The actual accessibility status may have changed since then.",
        ),
      );
    }

    warning.appendChild(content);

    return warning;
  }

  /**
   * Renders the introduction section
   * @param {string} lastCheckedOn - For data freshness
   * @returns {HTMLElement} Intro section
   */
  function renderIntroSection(lastCheckedOn) {
    const config = ALLY_STATEMENT_PREVIEW_CONFIG.INTRO;

    const section = createElement("section", { className: "ally-sp-intro" });

    // Heading
    section.appendChild(createElement("h3", null, config.heading));

    // Paragraphs
    config.paragraphs.forEach(function (para) {
      section.appendChild(createElement("p", null, para));
    });

    // Bullet points
    const ul = createElement("ul");
    config.bulletPoints.forEach(function (item) {
      ul.appendChild(createElement("li", null, item));
    });
    section.appendChild(ul);

    // Data freshness warning
    if (lastCheckedOn) {
      section.appendChild(renderDataFreshnessWarning(lastCheckedOn));
    }

    return section;
  }

  /**
   * Renders list items, handling nested lists
   * @param {Array} items - Array of strings or {text, nested} objects
   * @returns {HTMLElement} UL element
   */
  function renderListItems(items) {
    const ul = createElement("ul");

    items.forEach(function (item) {
      const li = createElement("li");

      if (typeof item === "string") {
        // Allow HTML in content (for links)
        li.innerHTML = item;
      } else if (item && item.text) {
        li.innerHTML = item.text;
        if (item.nested && item.nested.length > 0) {
          li.appendChild(renderListItems(item.nested));
        }
      }

      ul.appendChild(li);
    });

    return ul;
  }

  /**
   * Renders a single accessibility warning section
   * @param {Object} theme - Theme configuration from ALLY_STATEMENT_PREVIEW_CONFIG
   * @returns {HTMLElement} Warning section
   */
  function renderWarningSection(theme) {
    const section = createElement("section", { className: "ally-sp-warning" });

    // Header with icon and title
    const header = createElement(
      "div",
      { className: "ally-sp-warning-header" },
      [
        createElement("span", {
          className: "ally-sp-warning-icon",
          ariaHidden: "true",
          dataset: { icon: theme.icon },
        }),
        createElement("h3", null, theme.title),
      ],
    );
    section.appendChild(header);

    // Summary paragraph(s)
    section.appendChild(createElement("p", null, theme.summary));
    if (theme.summaryExtra) {
      section.appendChild(createElement("p", null, theme.summaryExtra));
    }

    // Disclosure wrapper
    const disclosureWrapper = createElement("div", {
      className: "ally-sp-disclosure-wrapper",
    });

    // Disclosure button
    const disclosureButton = createElement(
      "button",
      {
        type: "button",
        ariaExpanded: "false",
        ariaControls: theme.disclosureId,
        className: "ally-sp-disclosure-button",
      },
      [
        createElement(
          "span",
          { className: "ally-sp-disclosure-text" },
          "Read more about " + theme.title.toLowerCase(),
        ),
        createElement(
          "span",
          { className: "ally-sp-chevron", ariaHidden: "true" },
          " ▼",
        ),
      ],
    );

    // Add click handler
    disclosureButton.addEventListener("click", function () {
      toggleDisclosure(this);
    });

    disclosureWrapper.appendChild(disclosureButton);

    // Expandable content
    const expandableContent = createElement("div", {
      id: theme.disclosureId,
      className: "ally-sp-expandable-content",
      hidden: "hidden",
    });

    // What this means
    expandableContent.appendChild(createElement("h4", null, "What this means"));
    expandableContent.appendChild(renderListItems(theme.whatThisMeans));

    // Suggestions
    expandableContent.appendChild(
      createElement(
        "h4",
        null,
        "Suggestions for when you encounter " + theme.title.toLowerCase(),
      ),
    );
    expandableContent.appendChild(renderListItems(theme.suggestions));

    disclosureWrapper.appendChild(expandableContent);
    section.appendChild(disclosureWrapper);

    return section;
  }

  /**
   * Renders success state (no issues found)
   * @returns {HTMLElement} Success section
   */
  function renderSuccessState() {
    const config = ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS;

    const section = createElement("section", { className: "ally-sp-success" }, [
      createElement("div", { className: "ally-sp-success-header" }, [
        createElement("span", {
          className: "ally-sp-success-icon",
          ariaHidden: "true",
          dataset: { icon: config.icon },
        }),
        createElement("h3", null, config.title),
      ]),
      createElement("p", null, config.message),
    ]);

    return section;
  }

  /**
   * Renders error state
   * @param {string} message - Error message
   * @returns {HTMLElement} Error section
   */
  function renderErrorState(message) {
    const section = createElement("section", { className: "ally-sp-error" }, [
      createElement("div", { className: "ally-sp-error-header" }, [
        createElement("span", {
          className: "ally-sp-error-icon",
          ariaHidden: "true",
          dataset: { icon: "warning" },
        }),
        createElement("h3", null, "Unable to generate statement preview"),
      ]),
      createElement("p", null, message),
    ]);

    return section;
  }

  /**
   * Renders course metadata in details section
   * @param {Object} data - API response data
   */
  function renderCourseMetadata(data) {
    if (!elements.courseMetadata || !elements.courseDetails) return;

    elements.courseMetadata.innerHTML = "";

    const metadataItems = [
      { label: "Course Name", value: data.courseName },
      { label: "Course Code", value: data.courseCode },
      { label: "Term", value: data.termName || data.termId },
      { label: "Department", value: data.departmentName || data.departmentId },
      { label: "Total Files", value: data.filesCount },
      { label: "Last Checked", value: formatDate(data.lastCheckedOn) },
    ];

    metadataItems.forEach(function (item) {
      if (
        item.value !== undefined &&
        item.value !== null &&
        item.value !== ""
      ) {
        const dt = createElement("dt", null, item.label);
        const dd = createElement("dd", null, String(item.value));
        elements.courseMetadata.appendChild(dt);
        elements.courseMetadata.appendChild(dd);
      }
    });

    elements.courseDetails.hidden = false;
  }

  /**
   * Renders the theme breakdown details section
   * Shows raw issue counts for each displayed theme
   * @param {Array} activeThemes - Array of {theme, count} objects
   * @param {Object} issueData - API response data with field values
   */
  function renderThemeBreakdown(activeThemes, issueData) {
    // Remove existing breakdown if present
    const existingBreakdown = document.getElementById(
      "ally-sp-theme-breakdown",
    );
    if (existingBreakdown) {
      existingBreakdown.remove();
    }

    // Don't show if no active themes
    if (!activeThemes || activeThemes.length === 0) {
      return;
    }

    // Create details element
    const details = createElement("details", {
      id: "ally-sp-theme-breakdown",
      className: "ally-sp-course-details ally-sp-theme-breakdown",
    });

    // Create summary
    const summary = document.createElement("summary");
    summary.textContent = "Issue counts by category";
    details.appendChild(summary);

    // Create content container
    const content = createElement("div", {
      className: "ally-sp-breakdown-content",
    });

    // Render each active theme's breakdown
    activeThemes.forEach(function (item) {
      const theme = item.theme;

      // Theme section
      const section = createElement("section", {
        className: "ally-sp-breakdown-section",
      });

      // Theme heading with total
      const heading = createElement(
        "h4",
        { className: "ally-sp-breakdown-heading" },
        theme.title + " (" + item.count + " total)",
      );
      section.appendChild(heading);

      // Create definition list for field breakdown
      const dl = createElement("dl", {
        className: "ally-sp-breakdown-list",
      });

      // Add each field with its value
      theme.fields.forEach(function (field) {
        const value = issueData[field];
        const displayValue = typeof value === "number" ? value : 0;

        const dt = createElement(
          "dt",
          { className: "ally-sp-breakdown-field" },
          field,
        );
        const dd = createElement(
          "dd",
          {
            className:
              "ally-sp-breakdown-value" +
              (displayValue > 0 ? " ally-sp-breakdown-value-nonzero" : ""),
          },
          String(displayValue),
        );

        dl.appendChild(dt);
        dl.appendChild(dd);
      });

      section.appendChild(dl);
      content.appendChild(section);
    });

    details.appendChild(content);

    // Insert after course details
    if (elements.courseDetails && elements.courseDetails.parentNode) {
      elements.courseDetails.parentNode.insertBefore(
        details,
        elements.courseDetails.nextSibling,
      );
    }
  }

  // ========================================================================
  // Main Render Function
  // ========================================================================

  /**
   * Renders the complete statement preview
   * @param {Object} issueData - API response from Issues endpoint
   */
  function renderPreview(issueData) {
    const container = elements.resultsContainer;
    if (!container) {
      logError("Results container not found");
      return;
    }

    container.innerHTML = "";

    // Get active themes (issues > 0)
    const activeThemes =
      ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(issueData);

    logInfo("Rendering preview with " + activeThemes.length + " active themes");

    // Render intro
    container.appendChild(renderIntroSection(issueData.lastCheckedOn));

    if (activeThemes.length === 0) {
      // No issues - show success state
      container.appendChild(renderSuccessState());
    } else {
      // Render each warning section
      activeThemes.forEach(function (item) {
        container.appendChild(renderWarningSection(item.theme));
      });
    }

    // Populate icons if IconLibrary is available
    if (typeof IconLibrary !== "undefined" && IconLibrary.populateIcons) {
      IconLibrary.populateIcons();
    }

    // Show results
    container.hidden = false;

    // Render course metadata
    renderCourseMetadata(issueData);

    // Render theme breakdown (after course details)
    renderThemeBreakdown(activeThemes, issueData);

    // Announce to screen readers
    const message =
      activeThemes.length === 0
        ? "Statement preview generated. No known accessibility issues found."
        : "Statement preview generated with " +
          activeThemes.length +
          " accessibility categories.";

    if (typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce(message);
    }

    logInfo("Preview rendered successfully");
  }

  // ========================================================================
  // API Integration
  // ========================================================================

  /**
   * Updates the debug panel with request/response data
   * @param {Object} debugData - Debug data object
   */
  function updateDebugPanel(debugData) {
    try {
      // Endpoint
      const endpointEl = document.getElementById("ally-debug-endpoint");
      if (endpointEl) {
        endpointEl.textContent = "Issues (Statement Preview)";
      }

      // Region
      const regionEl = document.getElementById("ally-debug-region");
      if (regionEl) {
        regionEl.textContent = debugData.region || "Not configured";
      }

      // Timing
      const timingEl = document.getElementById("ally-debug-timing");
      if (timingEl) {
        if (debugData.timing) {
          timingEl.textContent = debugData.timing + "ms";
        } else {
          timingEl.textContent = "—";
        }
      }

      // Record count
      const recordCountEl = document.getElementById("ally-debug-record-count");
      if (recordCountEl) {
        const count = debugData.recordCount || 0;
        recordCountEl.textContent =
          count + " issue record" + (count !== 1 ? "s" : "");
      }

      // Status
      const statusEl = document.getElementById("ally-debug-status");
      if (statusEl) {
        // Remove any existing status classes
        statusEl.classList.remove(
          "ally-debug-status-success",
          "ally-debug-status-error",
          "ally-debug-status-pending",
        );

        if (debugData.status === "success") {
          statusEl.textContent = "✓ Success";
          statusEl.classList.add("ally-debug-status-success");
        } else if (debugData.status === "error") {
          statusEl.textContent = "✗ Error";
          statusEl.classList.add("ally-debug-status-error");
        } else {
          statusEl.textContent = "Pending...";
          statusEl.classList.add("ally-debug-status-pending");
        }
      }

      // Request data
      const requestDataEl = document.getElementById("ally-debug-request-data");
      if (requestDataEl) {
        const requestObj = {
          statementPreview: true,
          course: debugData.courseName || "Unknown",
          request: debugData.request || null,
        };
        requestDataEl.textContent = JSON.stringify(requestObj, null, 2);

        // Apply syntax highlighting if Prism is available
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(requestDataEl);
        }
      }

      // Response data
      const responseDataEl = document.getElementById(
        "ally-debug-response-data",
      );
      if (responseDataEl) {
        const responseObj = {
          statementPreview: true,
          timing: debugData.timing ? debugData.timing + "ms" : null,
          response: debugData.response || null,
        };
        responseDataEl.textContent = JSON.stringify(responseObj, null, 2);

        // Apply syntax highlighting if Prism is available
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(responseDataEl);
        }
      }

      logDebug("Debug panel updated for Statement Preview");
    } catch (error) {
      logWarn("Failed to update debug panel:", error.message);
    }
  }

  // ========================================================================
  // Cache Integration Helpers
  // ========================================================================

  /**
   * Checks if cached and fresh data are meaningfully different
   * @param {Object} oldData - Cached issue data
   * @param {Object} newData - Fresh issue data
   * @returns {boolean} True if data has meaningfully changed
   */
  function dataHasChanged(oldData, newData) {
    if (!oldData || !newData) return true;

    // Compare key issue counts
    const issueFields = [
      "alternativeText2",
      "htmlImageAlt2",
      "htmlBrokenLink2",
      "contrast2",
      "htmlColorContrast2",
      "scanned1",
      "ocred2",
      "tagged2",
      "imageSeizure1",
      "tableHeaders2",
      "headingsPresence2",
    ];

    for (let i = 0; i < issueFields.length; i++) {
      const field = issueFields[i];
      const oldVal = oldData[field] || 0;
      const newVal = newData[field] || 0;
      if (oldVal !== newVal) return true;
    }

    // Compare files count
    if (oldData.filesCount !== newData.filesCount) return true;

    return false;
  }

  /**
   * Renders the preview from data (extracted for reuse)
   * @param {Object} issueData - Issue data to render
   */
  function renderPreviewFromData(issueData) {
    if (!issueData || !elements.resultsContainer) {
      logWarn("Cannot render: missing data or container");
      return;
    }

    // Use the existing renderPreview function
    renderPreview(issueData);
  }

  /**
   * Fetches fresh data from API (extracted for reuse in background refresh)
   * @returns {Promise<Object>} Issue data from API
   */
  async function fetchPreviewData() {
    const filters = {
      allyEnabled: "true",
      courseName: "eq:" + selectedCourse.name,
    };

    const response = await ALLY_API_CLIENT.fetchIssues({
      limit: 1,
      filters: filters,
      onProgress: function () {
        // Silent progress for background refresh
      },
    });

    if (response.data && response.data.length > 0) {
      const data = response.data[0];

      // Enrich with course info if not present
      if (!data.courseName && selectedCourse.name) {
        data.courseName = selectedCourse.name;
      }
      if (!data.courseCode && selectedCourse.code) {
        data.courseCode = selectedCourse.code;
      }
      if (!data.termName && selectedCourse.termName) {
        data.termName = selectedCourse.termName;
      }

      return data;
    }

    // Return empty data structure
    return {
      courseName: selectedCourse.name,
      courseCode: selectedCourse.code,
      termName: selectedCourse.termName,
    };
  }

  /**
   * Refreshes data in background without blocking UI
   * @param {string} cacheKey - The cache key
   * @param {Object} cachedEntry - The current cached entry
   */
  function refreshInBackground(cacheKey, cachedEntry) {
    if (backgroundRefreshInProgress) {
      logDebug("Background refresh already in progress");
      return;
    }

    backgroundRefreshInProgress = true;
    logInfo("Starting background refresh for:", cacheKey);

    fetchPreviewData()
      .then(function (freshData) {
        backgroundRefreshInProgress = false;

        // Check if data has changed
        if (dataHasChanged(cachedEntry.data, freshData)) {
          logInfo("Fresh data differs from cache");

          // Update cache with fresh data
          const newEntry = {
            type: "statement-preview",
            courseId: cachedEntry.courseId,
            courseName: cachedEntry.courseName,
            courseCode: cachedEntry.courseCode,
            termName: cachedEntry.termName,
            data: freshData,
          };
          ALLY_CACHE.set(cacheKey, newEntry);

          // Show update banner
          ALLY_CACHE_UI.showUpdateBanner(
            elements.resultsContainer,
            function () {
              // Apply update callback
              lastPreviewData = freshData;
              renderPreviewFromData(freshData);
              ALLY_CACHE_UI.hideUpdateBanner(elements.resultsContainer);

              // Announce to screen readers
              if (typeof ALLY_UI_MANAGER !== "undefined") {
                ALLY_UI_MANAGER.announce(
                  "Statement preview updated with latest data",
                );
              }
            },
          );
        } else {
          logInfo("Fresh data matches cache, updating timestamp only");

          // Data is same - just update the timestamp silently
          const updatedEntry = Object.assign({}, cachedEntry, {
            timestamp: Date.now(),
            accessedAt: Date.now(),
          });
          ALLY_CACHE.set(cacheKey, updatedEntry);

          // Hide the "checking for updates" banner
          ALLY_CACHE_UI.hideCachedBanner(elements.resultsContainer);
        }
      })
      .catch(function (error) {
        backgroundRefreshInProgress = false;
        logWarn("Background refresh failed:", error.message);

        // Update banner text to indicate we couldn't check
        const banner = elements.resultsContainer.querySelector(
          "#ally-cache-data-banner",
        );
        if (banner) {
          const textSpan = banner.querySelector(".ally-cache-banner-text");
          if (textSpan) {
            const age = ALLY_CACHE.formatAge(cachedEntry.timestamp);
            textSpan.innerHTML =
              'Showing cached data from <span class="ally-cache-banner-age">' +
              age +
              "</span>. Unable to check for updates.";
          }
        }
      });
  }

  /**
   * Generates the statement preview for selected course
   * @returns {Promise<void>}
   */
  async function generatePreview() {
    if (!selectedCourse) {
      logWarn("No course selected");
      return;
    }

    logInfo("Generating preview for:", selectedCourse.name);

    // ====== Check Cache First ======
    let cacheKey = null;
    let cached = null;

    if (typeof ALLY_CACHE !== "undefined") {
      cacheKey = ALLY_CACHE.statementPreviewKey(selectedCourse.id);
      currentCacheKey = cacheKey;
      cached = ALLY_CACHE.get(cacheKey);
    }

    if (cached && cached.data) {
      logInfo("Cache hit for statement preview:", selectedCourse.id);

      // Show cached data immediately (no loading spinner)
      lastPreviewData = cached.data;

      // Clear previous results first
      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
      }

      renderPreviewFromData(cached.data);

      // Show cached banner
      if (typeof ALLY_CACHE_UI !== "undefined") {
        ALLY_CACHE_UI.showCachedBanner(
          resultsContainer,
          cachedEntry.timestamp,
          false,
          false,
        );
      }

      // Announce to screen readers
      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce(
          "Showing cached accessibility statement. Checking for updates.",
        );
      }

      // Start background refresh if API is likely available
      if (
        typeof ALLY_API_CLIENT !== "undefined" &&
        ALLY_API_CLIENT.hasCredentials()
      ) {
        if (typeof ALLY_MAIN_CONTROLLER !== "undefined") {
          const apiState = ALLY_MAIN_CONTROLLER.getApiState();
          if (apiState !== "ERROR" && apiState !== "UNKNOWN") {
            refreshInBackground(cacheKey, cached);
          } else {
            // API not ready - update banner
            const banner = elements.resultsContainer.querySelector(
              "#ally-cache-data-banner",
            );
            if (banner) {
              const textSpan = banner.querySelector(".ally-cache-banner-text");
              if (textSpan) {
                const age = ALLY_CACHE.formatAge(cached.timestamp);
                textSpan.innerHTML =
                  'Showing cached data from <span class="ally-cache-banner-age">' +
                  age +
                  "</span>. API not available to check for updates.";
              }
            }
          }
        } else {
          // ALLY_MAIN_CONTROLLER not available - try refresh anyway
          refreshInBackground(cacheKey, cached);
        }
      }

      return; // Don't proceed with normal API call
    }

    // ====== No cache - proceed with normal API call ======
    logInfo("Cache miss for statement preview:", selectedCourse.id);

    // Check API credentials
    if (
      typeof ALLY_API_CLIENT === "undefined" ||
      !ALLY_API_CLIENT.hasCredentials()
    ) {
      hideProgress();
      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
        elements.resultsContainer.appendChild(
          renderErrorState(
            "API credentials not configured. Please enter your API token and Client ID in the configuration section.",
          ),
        );
        elements.resultsContainer.hidden = false;
      }
      return;
    }

    // Debug tracking
    const startTime = Date.now();
    const credentials = ALLY_API_CLIENT.getCredentials();
    const debugData = {
      region: credentials.region || "Unknown",
      courseName: selectedCourse.name,
      status: "pending",
      timing: null,
      recordCount: 0,
      request: null,
      response: null,
    };

    // Build request info for debug
    const filters = {
      allyEnabled: "true",
      courseName: "eq:" + selectedCourse.name,
    };

    debugData.request = {
      endpoint: "ISSUES",
      region: debugData.region,
      options: {
        limit: 1,
        filters: filters,
      },
      headers: {
        Authorization: "Bearer [REDACTED]",
        Accept: "application/json",
      },
      timestamp: new Date().toISOString(),
    };

    showProgress("Fetching accessibility data...", 10);
    updateDebugPanel(debugData);

    try {
      showProgress("Querying Issues API...", 30);

      const response = await ALLY_API_CLIENT.fetchIssues({
        limit: 1,
        filters: filters,
        onProgress: function (info) {
          if (info && info.message) {
            showProgress(info.message, info.percent || 50);
          }
        },
      });

      // Update debug data with response
      debugData.timing = Date.now() - startTime;
      debugData.recordCount = response.data ? response.data.length : 0;
      debugData.status = "success";
      debugData.response = {
        status: 200,
        statusText: "OK",
        metadata: response.metadata || null,
        recordCount: debugData.recordCount,
        dataSample:
          response.data && response.data.length > 0 ? [response.data[0]] : [],
        timestamp: new Date().toISOString(),
      };

      updateDebugPanel(debugData);

      showProgress("Processing data...", 80);

      if (response.data && response.data.length > 0) {
        lastPreviewData = response.data[0];

        // Enrich with course info if not present
        if (!lastPreviewData.courseName && selectedCourse.name) {
          lastPreviewData.courseName = selectedCourse.name;
        }
        if (!lastPreviewData.courseCode && selectedCourse.code) {
          lastPreviewData.courseCode = selectedCourse.code;
        }
        if (!lastPreviewData.termName && selectedCourse.termName) {
          lastPreviewData.termName = selectedCourse.termName;
        }

        // Cache the result
        if (typeof ALLY_CACHE !== "undefined" && currentCacheKey) {
          const cacheEntry = {
            type: "statement-preview",
            courseId: selectedCourse.id,
            courseName: selectedCourse.name,
            courseCode: selectedCourse.code,
            termName: selectedCourse.termName || "",
            data: lastPreviewData,
          };
          ALLY_CACHE.set(currentCacheKey, cacheEntry);
          logInfo("Cached statement preview:", currentCacheKey);
        }

        hideProgress();
        renderPreview(lastPreviewData);
      } else {
        logWarn("No data returned for course");
        hideProgress();
        // Render with empty data - will show success state
        lastPreviewData = {
          courseName: selectedCourse.name,
          courseCode: selectedCourse.code,
          termName: selectedCourse.termName,
        };

        // Cache the empty result too
        if (typeof ALLY_CACHE !== "undefined" && currentCacheKey) {
          const cacheEntry = {
            type: "statement-preview",
            courseId: selectedCourse.id,
            courseName: selectedCourse.name,
            courseCode: selectedCourse.code,
            termName: selectedCourse.termName || "",
            data: lastPreviewData,
          };
          ALLY_CACHE.set(currentCacheKey, cacheEntry);
          logInfo("Cached empty statement preview:", currentCacheKey);
        }

        renderPreview(lastPreviewData);
      }
    } catch (error) {
      // Update debug data with error
      debugData.timing = Date.now() - startTime;
      debugData.status = "error";
      debugData.response = {
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      updateDebugPanel(debugData);

      hideProgress();
      logError("Failed to generate preview:", error);

      // Try to fallback to cache
      if (currentCacheKey && typeof ALLY_CACHE !== "undefined") {
        const cachedFallback = ALLY_CACHE.get(currentCacheKey);
        if (cachedFallback && cachedFallback.data) {
          logInfo("Falling back to cached data due to API error");

          lastPreviewData = cachedFallback.data;
          renderPreviewFromData(cachedFallback.data);

          // Show error variant of cached banner
          if (typeof ALLY_CACHE_UI !== "undefined") {
            ALLY_CACHE_UI.showCachedBanner(
              elements.resultsContainer,
              cachedFallback.timestamp,
              true, // isError = true
            );
          }

          if (typeof ALLY_UI_MANAGER !== "undefined") {
            ALLY_UI_MANAGER.announce(
              "Connection error. Showing cached data from " +
                ALLY_CACHE.formatAge(cachedFallback.timestamp),
            );
          }

          return; // Exit without showing error UI
        }
      }

      // No cache fallback - show error
      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
        elements.resultsContainer.appendChild(
          renderErrorState(
            "Failed to fetch accessibility data. " +
              (error.message || "Please try again."),
          ),
        );
        elements.resultsContainer.hidden = false;
      }

      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce("Error generating statement preview.");
      }
    }
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  /**
   * Sets up event listeners
   */
  function setupEventListeners() {
    // Guard against duplicate listener attachment during force reinitialisation
    if (listenersAttached) {
      logDebug("Event listeners already attached, skipping");
      return;
    }

    // Execute button click
    if (elements.executeButton) {
      elements.executeButton.addEventListener("click", function () {
        generatePreview();
      });
    }

    // Listen for course selection changes
    if (typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined") {
      ALLY_STATEMENT_PREVIEW_SEARCH.onSelectionChange(
        handleCourseSelectionChange,
      );
    }

    listenersAttached = true;
    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the statement preview module
     * @param {boolean} force - Force reinitialisation
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function (force) {
      if (initialised && !force) {
        logWarn("Already initialised");
        return true;
      }

      if (force) {
        initialised = false;
        logInfo("Forcing reinitialisation...");
      }

      logInfo("Initialising Statement Preview...");

      // Check dependencies
      if (typeof ALLY_STATEMENT_PREVIEW_CONFIG === "undefined") {
        logError("ALLY_STATEMENT_PREVIEW_CONFIG not available");
        return false;
      }

      if (typeof ALLY_API_CLIENT === "undefined") {
        logWarn("ALLY_API_CLIENT not available - API calls will fail");
      }

      // Cache elements
      if (!cacheElements()) {
        logError("Required elements not found - initialisation failed");
        return false;
      }

      // Set up event listeners
      setupEventListeners();

      // Initial state
      hideProgress();

      // Only hide results if empty (preserve existing results during reinit)
      if (elements.resultsContainer) {
        var hasExistingContent =
          elements.resultsContainer.innerHTML.trim().length > 0;
        if (!hasExistingContent) {
          elements.resultsContainer.hidden = true;
        }
        // If has content, leave visibility as-is (visible from previous generation)
      }

      // Only hide course details if empty (preserve existing during reinit)
      if (elements.courseDetails) {
        var hasExistingDetails =
          elements.courseMetadata &&
          elements.courseMetadata.innerHTML.trim().length > 0;
        if (!hasExistingDetails) {
          elements.courseDetails.hidden = true;
        }
      }

      initialised = true;
      logInfo("Statement Preview initialised successfully");

      return true;
    },

    /**
     * Checks if the module has been initialised
     * @returns {boolean}
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Generates the statement preview
     * @returns {Promise<void>}
     */
    generatePreview: generatePreview,

    /**
     * Gets the last preview data
     * @returns {Object|null}
     */
    getLastPreviewData: function () {
      return lastPreviewData;
    },

    /**
     * Gets the currently selected course
     * @returns {Object|null}
     */
    getSelectedCourse: function () {
      return selectedCourse;
    },

    /**
     * Resets the module to initial state
     */
    reset: function () {
      selectedCourse = null;
      lastPreviewData = null;

      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
        elements.resultsContainer.hidden = true;
      }

      if (elements.courseDetails) {
        elements.courseDetails.hidden = true;
      }

      hideProgress();

      if (typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined") {
        ALLY_STATEMENT_PREVIEW_SEARCH.reset();
      }

      logDebug("Module reset");
    },

    /**
     * Toggles a disclosure widget (exposed for testing)
     * @param {HTMLButtonElement} button - The disclosure button
     */
    toggleDisclosure: toggleDisclosure,

    /**
     * Expands all disclosure widgets
     */
    expandAll: function () {
      const buttons = document.querySelectorAll(".ally-sp-disclosure-button");
      buttons.forEach(function (btn) {
        if (btn.getAttribute("aria-expanded") === "false") {
          toggleDisclosure(btn);
        }
      });
    },

    /**
     * Collapses all disclosure widgets
     */
    collapseAll: function () {
      const buttons = document.querySelectorAll(".ally-sp-disclosure-button");
      buttons.forEach(function (btn) {
        if (btn.getAttribute("aria-expanded") === "true") {
          toggleDisclosure(btn);
        }
      });
    },

    /**
     * Gets debug information
     * @returns {Object} Debug info
     */
    getDebugInfo: function () {
      return {
        initialised: initialised,
        selectedCourse: selectedCourse,
        hasPreviewData: lastPreviewData !== null,
        elementsFound: {
          executeButton: !!elements.executeButton,
          progressSection: !!elements.progressSection,
          resultsContainer: !!elements.resultsContainer,
          courseDetails: !!elements.courseDetails,
        },
        configAvailable: typeof ALLY_STATEMENT_PREVIEW_CONFIG !== "undefined",
        searchAvailable: typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined",
        apiClientAvailable: typeof ALLY_API_CLIENT !== "undefined",
        cacheAvailable: typeof ALLY_CACHE !== "undefined",
        currentCacheKey: currentCacheKey,
        backgroundRefreshInProgress: backgroundRefreshInProgress,
      };
    },

    /**
     * Renders a preview from a cached entry (for cache browser integration)
     * @param {Object} cachedEntry - The cached entry from ALLY_CACHE
     * @returns {boolean} True if rendering succeeded
     */
    renderFromCache: function (cachedEntry) {
      if (!cachedEntry || !cachedEntry.data) {
        logWarn("Invalid cached entry for renderFromCache");
        return false;
      }

      // Set the selected course from cache
      selectedCourse = {
        id: cachedEntry.courseId,
        name: cachedEntry.courseName,
        code: cachedEntry.courseCode,
        termName: cachedEntry.termName,
      };

      // Update the search display if available
      if (typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined") {
        ALLY_STATEMENT_PREVIEW_SEARCH.setSelectedCourse(selectedCourse);
      }

      // Store the data
      lastPreviewData = cachedEntry.data;
      currentCacheKey = ALLY_CACHE.statementPreviewKey(cachedEntry.courseId);

      // Render the preview
      renderPreviewFromData(cachedEntry.data);

      // Show cached banner
      if (typeof ALLY_CACHE_UI !== "undefined") {
        ALLY_CACHE_UI.showCachedBanner(
          elements.resultsContainer,
          cachedEntry.timestamp,
          false,
        );
      }

      logInfo("Rendered preview from cache:", currentCacheKey);
      return true;
    },
  };

  return publicAPI;
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyStatementPreview = function () {
  console.group("ALLY_STATEMENT_PREVIEW Tests");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence tests
  test(
    "ALLY_STATEMENT_PREVIEW exists",
    typeof ALLY_STATEMENT_PREVIEW === "object",
  );
  test(
    "has initialise method",
    typeof ALLY_STATEMENT_PREVIEW.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_STATEMENT_PREVIEW.isInitialised === "function",
  );
  test(
    "has generatePreview method",
    typeof ALLY_STATEMENT_PREVIEW.generatePreview === "function",
  );
  test(
    "has getLastPreviewData method",
    typeof ALLY_STATEMENT_PREVIEW.getLastPreviewData === "function",
  );
  test(
    "has getSelectedCourse method",
    typeof ALLY_STATEMENT_PREVIEW.getSelectedCourse === "function",
  );
  test("has reset method", typeof ALLY_STATEMENT_PREVIEW.reset === "function");
  test(
    "has toggleDisclosure method",
    typeof ALLY_STATEMENT_PREVIEW.toggleDisclosure === "function",
  );
  test(
    "has expandAll method",
    typeof ALLY_STATEMENT_PREVIEW.expandAll === "function",
  );
  test(
    "has collapseAll method",
    typeof ALLY_STATEMENT_PREVIEW.collapseAll === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_STATEMENT_PREVIEW.getDebugInfo === "function",
  );

  // Dependency tests
  test(
    "ALLY_STATEMENT_PREVIEW_CONFIG available",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG !== "undefined",
  );
  test(
    "ALLY_STATEMENT_PREVIEW_SEARCH available",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined",
  );

  // Initialisation test
  if (!ALLY_STATEMENT_PREVIEW.isInitialised()) {
    ALLY_STATEMENT_PREVIEW.initialise(true);
  }
  test(
    "isInitialised returns true after init",
    ALLY_STATEMENT_PREVIEW.isInitialised() === true,
  );

  // Debug info tests
  const debugInfo = ALLY_STATEMENT_PREVIEW.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", "initialised" in debugInfo);
  test("debugInfo has elementsFound property", "elementsFound" in debugInfo);
  test("debugInfo.configAvailable is true", debugInfo.configAvailable === true);
  test("debugInfo.searchAvailable is true", debugInfo.searchAvailable === true);

  // State tests
  test(
    "getLastPreviewData returns null initially",
    ALLY_STATEMENT_PREVIEW.getLastPreviewData() === null,
  );

  // Element tests
  const executeBtn = document.getElementById("ally-sp-execute");
  const resultsContainer = document.getElementById("ally-sp-results");
  const progressSection = document.getElementById("ally-sp-progress");

  test("Execute button exists", executeBtn !== null);
  test("Results container exists", resultsContainer !== null);
  test("Progress section exists", progressSection !== null);

  if (executeBtn) {
    test("Execute button is disabled initially", executeBtn.disabled === true);
  }

  if (resultsContainer) {
    test(
      "Results container is hidden initially",
      resultsContainer.hidden === true,
    );
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};

/**
 * Full integration test for Statement Preview
 */
window.testAllyStatementPreviewIntegration = function () {
  console.group("ALLY_STATEMENT_PREVIEW Integration Tests");

  // Test with mock data
  const mockIssueData = {
    courseId: "test-123",
    courseName: "Test Course for Integration",
    courseCode: "TEST101",
    termName: "2023-24",
    lastCheckedOn: "2024-01-15T10:30:00Z",
    filesCount: 45,
    // Add some issues to trigger theme display
    alternativeText2: 5,
    htmlImageAlt2: 3,
    htmlBrokenLink2: 2,
    contrast2: 0,
    scanned1: 1,
  };

  console.log("Testing with mock data:", mockIssueData);

  // Get active themes
  const activeThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(mockIssueData);
  console.log(
    "Active themes:",
    activeThemes.map(function (t) {
      return t.theme.title + " (" + t.count + ")";
    }),
  );

  console.log("\nTo test full rendering, run:");
  console.log("1. Select a course using the search");
  console.log('2. Click "Generate Statement Preview"');
  console.log("3. Verify the warning sections appear correctly");
  console.log("4. Test disclosure widgets with expandAll()/collapseAll()");

  console.groupEnd();
};
