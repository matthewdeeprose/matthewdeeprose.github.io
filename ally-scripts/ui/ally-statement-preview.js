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
  // SCORM/HTML export facade URL (captured at parse time)
  // ========================================================================

  // This module is a classic IIFE, so document.currentScript is only valid
  // during initial synchronous execution — it is null inside later callbacks.
  // Capture THIS script's own URL now and resolve the sibling ES-module export
  // facade relative to it (robust whether the app is served from the site root
  // or a project subpath, and independent of the document base URL). Mirrors the
  // Phase 1 pattern in markdown-editor.js. Guarded + degraded where null.
  const EXPORT_FACADE_URL =
    document.currentScript && document.currentScript.src
      ? new URL(
          "../../js/scorm-export/scorm-export.js",
          document.currentScript.src,
        ).href
      : null;

  // ========================================================================
  // Private State
  // ========================================================================

  let initialised = false;
  let listenersAttached = false;
  let coreRenderersRegistered = false;
  let currentEnvironment = null;
  let selectedCourse = null;
  let lastPreviewData = null;

  // Per-render context for the per-child `shouldShow` hook (Stage A). Populated
  // at the top of renderByLayout and read by the closure supplied in renderSpec,
  // which has no activeThemes/answers in its own scope. `currentAnswers` is the
  // authored inclusion-questionnaire map for the selected course; used by the
  // `answer:<id>` show-rule to toggle the "inclusive-design" cards.
  let currentActiveThemes = [];
  let currentAnswers = {};

  // Cache integration state
  let backgroundRefreshInProgress = false;
  let currentCacheKey = null;

  // Cached DOM elements
  const elements = {
    executeButton: null,
    inclusionButton: null,
    inclusionButtonHelp: null,
    progressSection: null,
    progressFill: null,
    progressMessage: null,
    resultsContainer: null,
    courseDetails: null,
    courseMetadata: null,
    copyButtons: null,
    copyTextBtn: null,
    copyFormattedBtn: null,
    copyHtmlBtn: null,
    downloadWordBtn: null,
    exportScormBtn: null,
    exportHtmlBtn: null,
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
    // Inclusion-questions wizard trigger (optional; enabled on course select).
    elements.inclusionButton = document.getElementById(
      "ally-sp-answer-questions",
    );
    elements.inclusionButtonHelp = document.getElementById(
      "ally-sp-answer-questions-help",
    );
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

    // Copy buttons are optional - their absence must not fail initialisation
    elements.copyButtons = document.getElementById("ally-sp-copy-buttons");
    elements.copyTextBtn = document.getElementById("ally-sp-copy-text");
    elements.copyFormattedBtn = document.getElementById(
      "ally-sp-copy-formatted",
    );
    elements.copyHtmlBtn = document.getElementById("ally-sp-copy-html");
    elements.downloadWordBtn = document.getElementById("ally-sp-download-word");
    // Export buttons are JS-injected into the copy-button group on init, so on a
    // first cacheElements() call they are absent (injectExportButtons sets these
    // directly). On a force re-init they already exist and are re-cached here.
    elements.exportScormBtn = document.getElementById("ally-sp-export-scorm");
    elements.exportHtmlBtn = document.getElementById("ally-sp-export-html");

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

    // Enable/disable the inclusion-questions wizard trigger (needs a course, but
    // not the API). Clear its help text when enabled, restore it when not.
    if (elements.inclusionButton) {
      elements.inclusionButton.disabled = !course;
      if (elements.inclusionButtonHelp) {
        elements.inclusionButtonHelp.textContent = course
          ? ""
          : "Select a module first to enable this button";
      }
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

      if (elements.copyButtons) {
        elements.copyButtons.hidden = true;
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
      // Export marker: the freshness notice is in-page only, dropped from copy
      // and Word export (replaces the old by-name .ally-sp-freshness-warning
      // removal in buildCopyFragment).
      dataset: { spExport: "omit" },
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
  function renderIntroSection(lastCheckedOn, level) {
    const hLevel = level || 3;
    const subLevel = Math.min(6, hLevel + 1);
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    const config =
      typeof CFG.resolveIntro === "function"
        ? CFG.resolveIntro(currentTokens(), currentEnvironmentId())
        : CFG.INTRO;

    // The intro renders as an .ally-sp-info-style box: the main "Accessibility
    // data" heading (hLevel) sits beside the magnifyingGlassChart icon in the
    // shared left gutter, and the "Introduction" sub-heading (subLevel) plus the
    // body / list / freshness warning sit in the indented content column. Reusing
    // the .ally-sp-info-* classes inherits the box chrome, --sp-gutter model, both
    // themes' colours, and the ≤600px icon-hide for free.
    const section = createElement("section", {
      className: "ally-sp-intro ally-sp-info",
      ariaLabelledby: "ally-sp-intro-heading",
      // spCategory: the intro opens the per-course "data" section (see the
      // taxonomy in markExportable). Stamped here too so the registry-absent
      // direct-dispatch fallback still carries it, mirroring spSection/spExport.
      dataset: { spSection: "intro", spExport: "include", spCategory: "data" },
    });

    // Header: icon in the gutter + the "Accessibility data" heading (carries the
    // section's accessible name).
    section.appendChild(
      createElement("div", { className: "ally-sp-info-header" }, [
        createElement("span", {
          className: "ally-sp-info-icon",
          ariaHidden: "true",
          dataset: { icon: "magnifyingGlassChart" },
        }),
        createElement(
          "h" + hLevel,
          { id: "ally-sp-intro-heading" },
          config.heading,
        ),
      ]),
    );

    // Body column (indented under the heading by --sp-gutter).
    const col = createElement("div", { className: "ally-sp-info-col" });

    // "Introduction" sub-heading (no id — the header heading names the section).
    if (config.subHeading) {
      col.appendChild(createElement("h" + subLevel, null, config.subHeading));
    }

    // Paragraphs
    config.paragraphs.forEach(function (para) {
      col.appendChild(createElement("p", null, para));
    });

    // Bullet points
    const ul = createElement("ul");
    config.bulletPoints.forEach(function (item) {
      ul.appendChild(createElement("li", null, item));
    });
    col.appendChild(ul);

    // Data freshness warning (unchanged; stays data-sp-export="omit").
    if (lastCheckedOn) {
      col.appendChild(renderDataFreshnessWarning(lastCheckedOn));
    }

    section.appendChild(
      createElement("div", { className: "ally-sp-info-body" }, col),
    );

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
  function renderWarningSection(theme, level) {
    const hLevel = level || 3;
    const headingId = "ally-sp-" + theme.id + "-heading";
    const section = createElement("section", {
      className: "ally-sp-warning",
      ariaLabelledby: headingId,
      // spCategory: issue cards belong to the per-course "data" section (see the
      // taxonomy in markExportable). Stamped here too for the registry-absent
      // direct-dispatch fallback, mirroring spSection/spExport.
      dataset: { spSection: "warning", spExport: "include", spCategory: "data" },
    });

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
        createElement("h" + hLevel, { id: headingId }, theme.title),
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
        // Export marker: the interactive control is dropped from copy/export
        // (replaces the old by-name .ally-sp-disclosure-button removal).
        dataset: { spExport: "omit" },
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
      // Export marker: revealed in the export clone (replaces the old by-name
      // .ally-sp-expandable-content reveal in buildCopyFragment).
      dataset: { spExport: "expand" },
    });

    // What this means
    expandableContent.appendChild(
      createElement("h" + (hLevel + 1), null, "What this means"),
    );
    expandableContent.appendChild(renderListItems(theme.whatThisMeans));

    // Suggestions
    expandableContent.appendChild(
      createElement(
        "h" + (hLevel + 1),
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
  function renderSuccessState(level) {
    const hLevel = level || 3;
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    const config =
      typeof CFG.resolveSuccess === "function"
        ? CFG.resolveSuccess(currentTokens(), currentEnvironmentId())
        : CFG.SUCCESS;

    const section = createElement(
      "section",
      {
        className: "ally-sp-success",
        // spCategory: the success box replaces the issue cards, so it is still
        // the per-course "data" section (see the taxonomy in markExportable).
        // Stamped here too for the registry-absent fallback.
        dataset: { spSection: "success", spExport: "include", spCategory: "data" },
      },
      [
      createElement("div", { className: "ally-sp-success-header" }, [
        createElement("span", {
          className: "ally-sp-success-icon",
          ariaHidden: "true",
          dataset: { icon: config.icon },
        }),
        createElement("h" + hLevel, null, config.title),
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
  function renderErrorState(message, level) {
    const hLevel = level || 3;
    const section = createElement("section", { className: "ally-sp-error" }, [
      createElement("div", { className: "ally-sp-error-header" }, [
        createElement("span", {
          className: "ally-sp-error-icon",
          ariaHidden: "true",
          dataset: { icon: "warning" },
        }),
        createElement("h" + hLevel, null, "Unable to generate statement preview"),
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
  // Copy to Clipboard
  // ========================================================================

  /**
   * Recursively serialises a DOM node to structured plain text.
   *
   * Unlike `innerText`, this works on a DETACHED (unrendered) node — it derives
   * line breaks from the element structure rather than from layout, so the
   * copy payload keeps its shape even though `wrapper` is never attached to the
   * DOM. Mirrors the structure built by `renderListItems`.
   *
   *  - h3 / h4 / p  → own line, blank line after
   *  - li           → "- " prefix, two-space indent per nesting level
   *  - a            → link text followed by " (url)" when an href is present
   *  - icons / SVG  → skipped (aria-hidden / data-icon / <svg>)
   *
   * @param {Node} node - The node to serialise
   * @param {number} depth - Current list nesting depth (0 at top level)
   * @returns {string} Plain text (normalised once by the caller)
   */
  function serialiseToText(node, depth) {
    // Text node: collapse internal whitespace, no per-node trim
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\s+/g, " ");
    }

    // Only elements beyond this point
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    // Skip icons and decorative SVG
    if (
      node.getAttribute("aria-hidden") === "true" ||
      node.hasAttribute("data-icon") ||
      node.tagName.toLowerCase() === "svg"
    ) {
      return "";
    }

    const tag = node.tagName.toLowerCase();

    // Export-text fallback: for primitives that cannot be represented as text
    // (chiefly a video embed), emit the provided fallback text (with the href
    // when present) and do NOT descend. Honoured identically by the docx export.
    if (node.hasAttribute("data-export-text")) {
      const exportText = (node.getAttribute("data-export-text") || "")
        .replace(/\s+/g, " ")
        .trim();
      const exportHref = node.getAttribute("data-export-href");
      const line =
        exportHref && exportHref.trim()
          ? exportText + " (" + exportHref.trim() + ")"
          : exportText;
      return exportText ? "\n\n" + line + "\n" : "";
    }

    if (/^h[1-6]$/.test(tag) || tag === "p") {
      return "\n\n" + inlineText(node) + "\n";
    }

    // Definition list: one "<dt>: <dd>" line per pair. Also fixes the
    // course-metadata flatten-to-"Label Value" that plain recursion produced.
    if (tag === "dl") {
      const lines = [];
      let currentDt = "";
      node.childNodes.forEach(function (child) {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const childTag = child.tagName.toLowerCase();
        if (childTag === "dt") {
          currentDt = inlineText(child);
        } else if (childTag === "dd") {
          lines.push((currentDt ? currentDt + ": " : "") + inlineText(child));
        }
      });
      return lines.length ? "\n\n" + lines.join("\n") + "\n" : "";
    }

    if (tag === "li") {
      let out = "\n" + "  ".repeat(depth) + "- " + inlineText(node);
      // Nested lists live inside the <li> (see renderListItems)
      node.childNodes.forEach(function (child) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child.tagName.toLowerCase() === "ul" ||
            child.tagName.toLowerCase() === "ol")
        ) {
          out += serialiseToText(child, depth + 1);
        }
      });
      return out;
    }

    if (tag === "ul" || tag === "ol") {
      let out = "";
      node.childNodes.forEach(function (child) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          child.tagName.toLowerCase() === "li"
        ) {
          out += serialiseToText(child, depth);
        }
      });
      return out;
    }

    if (tag === "a") {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      const href = node.getAttribute("href");
      return href && href.trim() ? text + " (" + href.trim() + ")" : text;
    }

    // Default (div, section, span, strong, …): recurse over children
    let out = "";
    node.childNodes.forEach(function (child) {
      out += serialiseToText(child, depth);
    });
    return out;
  }

  /**
   * Serialises the inline content of a block element (heading, paragraph, or
   * the label portion of a list item). Inline elements pass through as text;
   * block children (nested ul/ol) are stopped so the li branch can handle them.
   * Skip guards (icons / SVG) still apply via the `a` and default handling.
   *
   * @param {Element} el - Block element whose inline text is wanted
   * @returns {string} Inline text
   */
  function inlineText(el) {
    let out = "";
    el.childNodes.forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += (child.textContent || "").replace(/\s+/g, " ");
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const childTag = child.tagName.toLowerCase();
      // Stop at block-level children — the li branch serialises nested lists
      if (childTag === "ul" || childTag === "ol") return;

      // Reuse serialiseToText for inline handling: it skips icons/SVG, renders
      // links as "text (url)", and recurses other inline wrappers (span, strong…)
      out += serialiseToText(child, 0);
    });
    return out;
  }

  /**
   * Clones the currently-rendered statement into a detached fragment, the
   * shared source of truth for all copy/export paths (plain text, HTML, and
   * the Word .docx export).
   *
   * Scope = "statement only": the intro paragraph (minus the data-freshness
   * notice) plus each accessibility warning section (or the success message).
   * The data-freshness notice, module-information details, issue-count
   * breakdown, cache banners and the copy buttons themselves are excluded.
   *
   * Disclosures are always expanded: the "What this means" / "Suggestions"
   * lists are revealed and the interactive "Read more" controls dropped, so
   * exported content is complete and static.
   *
   * @returns {HTMLElement|null} The detached wrapper node, or null if there
   *   is nothing to export.
   */
  /**
   * Prepares each interactive "Read more" disclosure for the EXPORT: keeps the
   * real <button> + .ally-sp-expandable-content (rather than flattening them, as
   * copy/Word do, or nativising to <details>), so the injected end-of-body script
   * can reproduce the in-app toggle — relocate the toggle below the content on
   * expand, flip Read more ↔ Read less, rotate the chevron, and manage focus.
   * Called only on the export path, BEFORE the omit-drop in cloneStatementSections.
   *
   * The disclosure button carries data-sp-export="omit" (dropped from copy/Word);
   * here we clear that marker so the button SURVIVES into the export. The content
   * keeps data-sp-export="expand", so the caller's reveal step makes it visible in
   * the raw HTML — readable with JS off; the injected script collapses it on load.
   *
   * @param {HTMLElement} root - detached clone to mutate in place
   */
  function prepareExportDisclosures(root) {
    root
      .querySelectorAll('.ally-sp-disclosure-button[data-sp-export="omit"]')
      .forEach(function (button) {
        button.removeAttribute("data-sp-export");
        // Drop the in-app Unicode " ▼" chevron span — the export CSS draws a
        // border caret via ::after instead. (A lone symbol character trips axe's
        // "nonBmp" contrast check, which surfaces as a false-positive violation.)
        const chevron = button.querySelector(".ally-sp-chevron");
        if (chevron) chevron.remove();
      });
  }

  // Matches an 11-char YouTube video id in any common URL shape.
  const YOUTUBE_ID_RE =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/;

  /**
   * Extracts an 11-char YouTube id from a wrapper's <lite-youtube videoid> child
   * (most reliable — set by buildVideoEmbed) or from its data-export-href URL.
   * @param {HTMLElement} wrapper
   * @param {string} href
   * @returns {string} the id, or "" if none is found.
   */
  function extractYouTubeId(wrapper, href) {
    const lite = wrapper.querySelector("lite-youtube[videoid]");
    const fromAttr = lite ? (lite.getAttribute("videoid") || "").trim() : "";
    if (/^[A-Za-z0-9_-]{11}$/.test(fromAttr)) return fromAttr;
    const m = (href || "").match(YOUTUBE_ID_RE);
    return m ? m[1] : "";
  }

  /**
   * Transforms script-hydrated media embeds for the static export. The
   * lite-youtube custom element is NOT present in the SCORM/HTML output, so each
   * .videoWrapper is replaced by a standard, responsive YouTube <iframe> (the
   * privacy-enhanced youtube-nocookie domain, with the required title — the one
   * ARIA exception). A non-YouTube embed, or one whose id can't be read, degrades
   * to a plain link using the data-export-text / data-export-href contract.
   * Export path only. Without this the exported statement would show an empty box.
   *
   * @param {HTMLElement} root - detached clone to mutate in place
   */
  function embedExportMedia(root) {
    const nodes = root.querySelectorAll("[data-export-text]");
    nodes.forEach(function (node) {
      const label = (node.getAttribute("data-export-text") || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!label) return;

      const href = (node.getAttribute("data-export-href") || "").trim();
      const youTubeId = extractYouTubeId(node, href);

      let replacement;
      if (youTubeId) {
        // Standard responsive YouTube embed. The iframe REQUIRES a title; derive
        // it from the play label ("Play video: X" -> "X (YouTube video)").
        const base = label.replace(/^\s*play video:\s*/i, "").trim() || "Video";
        replacement = document.createElement("div");
        replacement.className = "ally-sp-video-embed";

        const iframe = document.createElement("iframe");
        iframe.setAttribute(
          "src",
          "https://www.youtube-nocookie.com/embed/" + youTubeId,
        );
        iframe.setAttribute("title", base + " (YouTube video)");
        iframe.setAttribute("loading", "lazy");
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        );
        iframe.setAttribute(
          "referrerpolicy",
          "strict-origin-when-cross-origin",
        );
        iframe.setAttribute("allowfullscreen", "");
        replacement.appendChild(iframe);
      } else {
        // Fallback: a plain link (non-YouTube href, or unreadable id).
        replacement = document.createElement("p");
        replacement.className = "ally-sp-export-media-link";
        if (href) {
          const a = document.createElement("a");
          a.setAttribute("href", href);
          a.setAttribute("rel", "noopener");
          a.textContent = label;
          replacement.appendChild(a);
        } else {
          replacement.textContent = label;
        }
      }

      node.parentNode.replaceChild(replacement, node);
    });
  }

  /**
   * Clones the rendered statement's top-level exportable sections into a detached
   * wrapper — the shared core behind copy, Word and SCORM/HTML export. Drops
   * descendants marked omit and reveals those marked expand.
   *
   * @param {{ nativiseDisclosures?: boolean, sourceContainer?: HTMLElement }} [options]
   *   - nativiseDisclosures: EXPORT MODE (flag name retained for the existing
   *     callers). When true, the interactive disclosure button is KEPT (its omit
   *     marker cleared BEFORE the omit-drop) and media embeds become real iframes,
   *     so the injected end-of-body script can drive the disclosures; the content
   *     is revealed (visible in the raw HTML, so it is readable with JS off). When
   *     false/omitted (copy + Word), the button is dropped and the content revealed
   *     inline — byte-identical to the pre-refactor behaviour.
   *   - sourceContainer: the element whose top-level sections are cloned. Defaults
   *     to the live results container (copy/Word/export). The Phase 3 refresh-island
   *     builder passes an off-screen container holding a single freshly-rendered
   *     section, so it can run every export fragment through this identical cleanup.
   * @returns {HTMLElement|null} the detached wrapper, or null if nothing to clone.
   */
  function cloneStatementSections(options) {
    const opts = options || {};
    const container = opts.sourceContainer || elements.resultsContainer;
    if (!container) return null;

    const wrapper = document.createElement("div");

    // Iterate the OUTERMOST exportable sections in DOM order. Every section
    // renderer stamps its root with data-sp-section (iteration hook) and
    // data-sp-export ("include" | "omit"). Only direct children of the results
    // container are top-level sections, so a nested `group` section is cloned
    // once as a whole (its children ride inside the clone) rather than twice.
    // Non-section nodes (cache banners, etc.) have no marker and are skipped.
    const sections = Array.prototype.filter.call(
      container.children,
      function (node) {
        return (
          node.nodeType === Node.ELEMENT_NODE &&
          node.hasAttribute("data-sp-section") &&
          node.getAttribute("data-sp-export") !== "omit" &&
          // Respect the "Show" section-visibility toggles: a section hidden on
          // screen is excluded from every export (this is the single chokepoint
          // for copy, Word/docx and SCORM/HTML).
          !node.hidden
        );
      },
    );

    sections.forEach(function (section) {
      const clone = section.cloneNode(true);

      // Export path only: keep the interactive disclosure button (clear its omit
      // marker BEFORE the omit-drop) so the injected script can drive it, and turn
      // media embeds into real iframes (lite-youtube is absent from the output).
      if (opts.nativiseDisclosures) {
        prepareExportDisclosures(clone);
        embedExportMedia(clone);
      }

      // Drop descendants marked omit (freshness notice, disclosure buttons,
      // chevrons, video embeds…) - useless or inert in pasted content.
      clone.querySelectorAll('[data-sp-export="omit"]').forEach(function (el) {
        el.remove();
      });

      // Reveal descendants marked expand (the "What this means" / "Suggestions"
      // disclosure content) so exported content is complete and static.
      clone
        .querySelectorAll('[data-sp-export="expand"]')
        .forEach(function (el) {
          el.removeAttribute("hidden");
          el.removeAttribute("aria-hidden");
        });

      wrapper.appendChild(clone);
    });

    if (!wrapper.firstChild) {
      return null;
    }

    return wrapper;
  }

  /**
   * Builds the copy/Word clone fragment — the interactive disclosures are
   * flattened (button dropped, content revealed inline). Thin wrapper over
   * cloneStatementSections; kept as a named function because copy, Word and the
   * public API all reference it.
   *
   * @returns {HTMLElement|null} The detached wrapper node, or null if there
   *   is nothing to export.
   */
  function buildCopyFragment() {
    return cloneStatementSections({ nativiseDisclosures: false });
  }

  /**
   * Promotes the headings in a detached copy fragment so the exported content
   * starts at <h1>. The statement renders in-page at <h3>/<h4> (beneath the
   * page's own <h2>); for standalone copy/paste those become <h1>/<h2>. This
   * mirrors the Word export, which maps the same h3/h4 to Heading 1/2.
   * Operates in place on a throwaway clone — never on the live DOM.
   * @param {HTMLElement} root - Detached wrapper to mutate
   */
  function promoteHeadings(root) {
    const SHIFT = 2; // h3 -> h1, h4 -> h2
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      const level = parseInt(h.tagName.charAt(1), 10);
      const newLevel = Math.max(1, level - SHIFT);
      if (newLevel === level) return;
      const replacement = document.createElement("h" + newLevel);
      for (let i = 0; i < h.attributes.length; i++) {
        replacement.setAttribute(h.attributes[i].name, h.attributes[i].value);
      }
      while (h.firstChild) replacement.appendChild(h.firstChild);
      h.parentNode.replaceChild(replacement, h);
    });
  }

  /**
   * Builds the copy payload (plain text + HTML) from the rendered statement.
   * Shares the cloned fragment with the Word export via buildCopyFragment().
   *
   * @returns {{text: string, html: string}|null} Copy payload, or null if
   *   there is nothing to copy.
   */
  function buildCopyContent() {
    const wrapper = buildCopyFragment();
    if (!wrapper) {
      return null;
    }

    // Shift headings so the copied statement starts at <h1> (h3 -> h1,
    // h4 -> h2), matching the Word export. Safe: wrapper is a throwaway clone.
    promoteHeadings(wrapper);

    // Derive plain text from the structure (not innerText — wrapper is detached
    // and unrendered, so innerText would collapse every block into one line).
    const text = serialiseToText(wrapper, 0)
      .replace(/[ \t]+\n/g, "\n") // strip trailing per-line spaces
      .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs
      .trim();

    return {
      text: text,
      html: wrapper.innerHTML,
    };
  }

  /**
   * Shows visual feedback on a copy button and announces success.
   * The button label briefly becomes a tick + message, then restores.
   * @param {HTMLButtonElement} button - The button that was clicked
   * @param {string} message - Success message
   */
  function showCopyFeedback(button, message) {
    if (button) {
      const originalHTML = button.innerHTML;
      button.innerHTML = '<span aria-hidden="true">✓</span> ' + message;
      button.classList.add("ally-sp-copy-success");

      setTimeout(function () {
        button.innerHTML = originalHTML;
        button.classList.remove("ally-sp-copy-success");
      }, 2000);
    }

    // The toast is the announcement: every notify* call speaks through the
    // shared announcer, so a second private-announcer write here carrying the
    // same string would be heard twice. (An earlier comment justified one on
    // the grounds that the copy buttons sit outside the aria-live results
    // container — true once, irrelevant now the toast itself is the voice.)
    if (typeof window.notifySuccess === "function") {
      window.notifySuccess(message);
    }

    logDebug("Copy feedback shown:", message);
  }

  /**
   * Reports a copy failure to the user.
   * @param {string} message - Error message
   */
  function showCopyError(message) {
    // Toast only — it announces through the shared announcer already.
    if (typeof window.notifyError === "function") {
      window.notifyError(message);
    }
  }

  /**
   * Copies the statement as plain text.
   */
  async function copyAsText() {
    const content = buildCopyContent();
    if (!content) {
      showCopyError("No content to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(content.text);
      showCopyFeedback(elements.copyTextBtn, "Text copied!");
      logInfo("Statement copied as plain text");
    } catch (error) {
      logError("Copy failed:", error);
      showCopyError("Failed to copy to clipboard");
    }
  }

  /**
   * Copies the statement as formatted (rich) content, preserving headings
   * and lists when pasted into Word / Google Docs. Falls back to plain text
   * if ClipboardItem is unsupported.
   */
  async function copyAsFormatted() {
    const content = buildCopyContent();
    if (!content) {
      showCopyError("No content to copy");
      return;
    }

    try {
      // Wrap the fragment in a minimal HTML document so Word maps <h3>/<h4>
      // to its built-in heading styles (a bare fragment pastes as Normal).
      const html =
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
        content.html +
        "</body></html>";

      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([content.text], { type: "text/plain" });

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);

      showCopyFeedback(elements.copyFormattedBtn, "Formatted text copied!");
      logInfo("Statement copied as formatted text");
    } catch (error) {
      logError("Failed to copy formatted text:", error);
      // Fallback to plain text if ClipboardItem is not supported
      try {
        await navigator.clipboard.writeText(content.text);
        showCopyFeedback(elements.copyFormattedBtn, "Text copied (plain)");
        logWarn("ClipboardItem not supported, fell back to plain text");
      } catch (fallbackError) {
        showCopyError("Failed to copy");
      }
    }
  }

  /**
   * Copies the statement as HTML source.
   */
  async function copyAsHtml() {
    const content = buildCopyContent();
    if (!content) {
      showCopyError("No content to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(content.html);
      showCopyFeedback(elements.copyHtmlBtn, "HTML copied!");
      logInfo("Statement copied as HTML source");
    } catch (error) {
      logError("Failed to copy HTML:", error);
      showCopyError("Failed to copy HTML");
    }
  }

  /**
   * Downloads the statement as a Word document (.docx) with genuine Word
   * heading styles. Delegates to the ALLY_STATEMENT_PREVIEW_DOCX module,
   * which lazy-loads the docx library on first use.
   */
  async function downloadAsWord() {
    if (typeof ALLY_STATEMENT_PREVIEW_DOCX === "undefined") {
      logError("ALLY_STATEMENT_PREVIEW_DOCX module not available");
      showCopyError("Word export is not available");
      return;
    }

    const fragment = buildCopyFragment();
    if (!fragment) {
      showCopyError("No content to download");
      return;
    }

    const meta = {
      courseName:
        (selectedCourse && selectedCourse.name) ||
        (lastPreviewData && lastPreviewData.courseName) ||
        "",
      courseCode:
        (selectedCourse && selectedCourse.code) ||
        (lastPreviewData && lastPreviewData.courseCode) ||
        "",
    };

    // Toast only — it announces through the shared announcer. The trailing
    // U+2026 is kept deliberately: it does visual work (an operation is under
    // way), and at NVDA's default punctuation level it is EXPECTED not to be
    // voiced. That expectation is untested — a listen is owed here and at the
    // matching site in downloadAsExport, because deleting the announcer moved
    // the spoken text from a full stop to an ellipsis.
    if (typeof window.notifyInfo === "function") {
      window.notifyInfo("Preparing Word document…");
    }

    try {
      await ALLY_STATEMENT_PREVIEW_DOCX.download(fragment, meta);
      // "ready", not "downloaded". Nothing here can observe whether a file was
      // actually saved: a programmatic `<a download>` click has no completion
      // event by design, and the helper it goes through
      // (ally-statement-preview-docx.js triggerDownload) has no error path. A
      // browser that refuses the download — the automatic-downloads permission
      // is the known case — is indistinguishable from one that accepted it, so
      // the old wording asserted, to the screen reader as well as on screen, a
      // fact the code cannot know. Claim only what is true: the file was built
      // and handed to the browser.
      // Kept short because showCopyFeedback swaps this into the button's own
      // label for 2 seconds; a long string would overflow a small control.
      showCopyFeedback(elements.downloadWordBtn, "Word document ready");
      logInfo("Statement handed to the browser as a Word document");
    } catch (error) {
      logError("Failed to generate Word document:", error);
      showCopyError("Failed to create the Word document");
    }
  }

  // ========================================================================
  // SCORM / standalone-HTML export
  // ========================================================================

  /**
   * Injects the two export buttons ("SCORM package", "Web page (HTML)") into the
   * copy-button group, matching the existing .secondary-button + data-icon +
   * aria-describedby="ally-sp-copy-label" pattern. They reveal and hide with the
   * group (no extra wiring). Idempotent: safe to call on initialise(force) — a
   * second call finds the existing buttons, re-caches them, and returns.
   *
   * data-icon spans are populated explicitly (scoped to the group): the library's
   * one-shot auto-populator runs at DOMContentLoaded, long before this injection.
   */
  function injectExportButtons() {
    const group = elements.copyButtons;
    if (!group) return; // optional group absent — nothing to inject into

    // Idempotency guard: never inject twice.
    const existing = document.getElementById("ally-sp-export-scorm");
    if (existing) {
      elements.exportScormBtn = existing;
      elements.exportHtmlBtn = document.getElementById("ally-sp-export-html");
      return;
    }

    const scormBtn = createElement(
      "button",
      {
        type: "button",
        id: "ally-sp-export-scorm",
        className: "secondary-button",
        ariaDescribedby: "ally-sp-copy-label",
      },
      [
        createElement("span", {
          ariaHidden: "true",
          dataset: { icon: "archive" },
        }),
        document.createTextNode(" SCORM package"),
      ],
    );

    const htmlBtn = createElement(
      "button",
      {
        type: "button",
        id: "ally-sp-export-html",
        className: "secondary-button",
        ariaDescribedby: "ally-sp-copy-label",
      },
      [
        createElement("span", {
          ariaHidden: "true",
          dataset: { icon: "globe" },
        }),
        document.createTextNode(" Web page (HTML)"),
      ],
    );

    group.appendChild(scormBtn);
    group.appendChild(htmlBtn);

    elements.exportScormBtn = scormBtn;
    elements.exportHtmlBtn = htmlBtn;

    // Resolve the data-icon spans → SVG (scoped to the group).
    if (
      window.IconLibrary &&
      typeof window.IconLibrary.populateIcons === "function"
    ) {
      window.IconLibrary.populateIcons(group);
    }

    logDebug("Export buttons injected into copy-button group");
  }

  /**
   * Derives the export document title / package name from the course metadata:
   * "{code} {name} — Accessibility statement", collapsing to just the parts that
   * are present, with a plain "Accessibility statement" fallback when neither is.
   * Shared by the prepended <h1> and the facade `title` so the two always match.
   * @param {{courseCode?: string, courseName?: string}} meta
   * @returns {string}
   */
  function deriveExportTitle(meta) {
    const code = (meta && meta.courseCode) || "";
    const name = (meta && meta.courseName) || "";
    const combined = (code + " " + name).replace(/\s+/g, " ").trim();
    return combined
      ? combined + " — Accessibility statement"
      : "Accessibility statement";
  }

  /**
   * Normalises the headings in a detached export fragment DOWN by one level
   * (h3→h2, h4→h3, …), clamped at h2 so nothing becomes a second <h1>. The
   * statement renders in-page at h3/h4 (beneath the page's own <h2>); the export
   * prepends its own single <h1> title, so the body headings shift to h2/h3 for a
   * clean, non-skipping h1→h2→h3 outline. Operates in place on a throwaway clone.
   * @param {HTMLElement} root - Detached wrapper to mutate
   */
  function normaliseExportHeadings(root) {
    const SHIFT = 1;
    const FLOOR = 2; // never produce another <h1>; the prepended title is the only h1
    root.querySelectorAll("h2, h3, h4, h5, h6").forEach(function (h) {
      const level = parseInt(h.tagName.charAt(1), 10);
      const newLevel = Math.max(FLOOR, level - SHIFT);
      if (newLevel === level) return;
      const replacement = document.createElement("h" + newLevel);
      for (let i = 0; i < h.attributes.length; i++) {
        replacement.setAttribute(h.attributes[i].name, h.attributes[i].value);
      }
      while (h.firstChild) replacement.appendChild(h.firstChild);
      h.parentNode.replaceChild(replacement, h);
    });
  }

  /**
   * Returns the statement-header section's heading element (the document title),
   * or null when the statement has no header section. The header is the single
   * section stamped data-sp-category="header"; its heading is its aria-labelledby
   * target — i.e. the first heading inside it.
   * @param {HTMLElement} root - detached export wrapper
   * @returns {HTMLElement|null}
   */
  function findHeaderHeading(root) {
    const section = root.querySelector('[data-sp-category="header"]');
    return section ? section.querySelector("h1, h2, h3, h4, h5, h6") : null;
  }

  /**
   * Promotes (shifts UP) every heading in a detached export fragment by `shift`
   * levels, clamped at h1. Used to lift the statement's own header heading to the
   * document <h1> while preserving the relative hierarchy: a title-led statement
   * renders the header at h3 and the body at h4/h5, so a shift of 2 gives a clean
   * h1 → h2 → h3. Operates in place on a throwaway clone.
   * @param {HTMLElement} root - detached wrapper to mutate
   * @param {number} shift - number of levels to promote (no-op when <= 0)
   */
  function promoteHeadingsBy(root, shift) {
    if (!(shift > 0)) return;
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      const level = parseInt(h.tagName.charAt(1), 10);
      const newLevel = Math.max(1, level - shift);
      if (newLevel === level) return;
      const replacement = document.createElement("h" + newLevel);
      for (let i = 0; i < h.attributes.length; i++) {
        replacement.setAttribute(h.attributes[i].name, h.attributes[i].value);
      }
      while (h.firstChild) replacement.appendChild(h.firstChild);
      h.parentNode.replaceChild(replacement, h);
    });
  }

  // localStorage key prefix for the per-course refresh snapshot. Stage 5 stores
  // {v, counts, lastCheckedOn, refreshedAt} under REFRESH_STORAGE_PREFIX + courseId.
  const REFRESH_STORAGE_PREFIX = "ally-sp-refresh:";

  // The deployed Ally-issues proxy Worker endpoint baked into every export's
  // island (Stage 4). No token ships — the Worker holds the read-only Ally token
  // as a server-side secret, so the ~1-year rotation touches only the Worker and
  // already-distributed exports keep working. Override per-export via meta.workerUrl.
  const REFRESH_WORKER_URL =
    "https://ally-issues-proxy.matthewdeeprose.workers.dev/issues";

  /**
   * Resolves the configured proxy Worker's /issues ENDPOINT for baking into an
   * export, from the BASE url the user configured in Set Up or on the Ally page.
   * Returns "" when ALLY_CONFIG is unavailable or resolves nothing, so callers
   * fall back to REFRESH_WORKER_URL and exports keep working regardless.
   * @returns {string} Full /issues endpoint URL, or "" if unresolvable
   */
  function resolveConfiguredIssuesEndpoint() {
    if (
      typeof ALLY_CONFIG === "undefined" ||
      typeof ALLY_CONFIG.getWorkerEndpointUrl !== "function"
    ) {
      return "";
    }

    try {
      return ALLY_CONFIG.getWorkerEndpointUrl("ISSUES") || "";
    } catch (e) {
      logWarn("Could not resolve configured worker URL:", e.message);
      return "";
    }
  }

  /**
   * Reads the live Ally client id / region from the API client, best-effort.
   * @returns {{clientId: string, region: string}}
   */
  function currentAllyCredentials() {
    let clientId = "";
    let region = "";
    if (typeof ALLY_API_CLIENT !== "undefined") {
      try {
        const creds = ALLY_API_CLIENT.getCredentials();
        clientId = (creds && creds.clientId) || "";
      } catch (e) {
        logWarn("Could not read Ally clientId:", e.message);
      }
      if (typeof ALLY_API_CLIENT.getRegion === "function") {
        region = ALLY_API_CLIENT.getRegion() || "";
      }
    }
    return { clientId: clientId, region: region };
  }

  /**
   * Renders one statement section element to its final export HTML string,
   * running it through the SAME cleanup the real export uses: the
   * cloneStatementSections nativise/omit/expand pass, the export heading
   * transform, and icon population. Guarantees each baked fragment is
   * byte-identical to how that section would appear in a fresh export.
   * @param {HTMLElement} sectionEl - a freshly rendered <section> (never live-inserted)
   * @param {function(HTMLElement):void} applyHeadingTransform - the same heading
   *   transform buildExportFragment applies (promote-up when a header exists,
   *   else down-shift), computed once by the caller so every fragment matches.
   * @returns {string|null} the export innerHTML, or null if cleanup produced nothing
   */
  function sectionToExportHtml(sectionEl, applyHeadingTransform) {
    if (!sectionEl) return null;
    const temp = document.createElement("div");
    temp.appendChild(sectionEl);
    const wrapper = cloneStatementSections({
      nativiseDisclosures: true,
      sourceContainer: temp,
    });
    if (!wrapper) return null;
    if (typeof applyHeadingTransform === "function") {
      applyHeadingTransform(wrapper);
    }
    if (
      window.IconLibrary &&
      typeof window.IconLibrary.populateIcons === "function"
    ) {
      window.IconLibrary.populateIcons(wrapper);
    }
    return wrapper.innerHTML;
  }

  /**
   * Determines whether the intro precedes the accessibility-issue block in the
   * current environment's layout, so the refresh bundle re-assembles the data
   * section in the right order. Legacy (layout-less) render places the intro
   * first; a layout that omits @issues appends it at the end (intro still first).
   * @param {Array|null} layout
   * @returns {boolean}
   */
  function introPrecedesIssues(layout) {
    if (!Array.isArray(layout)) return true;
    let introIdx = -1;
    let issuesIdx = -1;
    for (let i = 0; i < layout.length; i++) {
      const entry = normaliseLayoutEntry(layout[i]);
      if (!entry || !entry.id) continue;
      if (entry.id === "intro" && introIdx === -1) introIdx = i;
      if (entry.id === "@issues" && issuesIdx === -1) issuesIdx = i;
    }
    if (introIdx === -1) return false; // no intro in the layout
    if (issuesIdx === -1) return true; // issues appended at end by the fail-safe
    return introIdx < issuesIdx;
  }

  /**
   * Builds the Phase 3 refresh data island: a self-contained, JSON-serialisable
   * description of the accessibility-data section for THIS course + environment,
   * from which the bundled refresh script re-renders the section against fresh
   * Ally counts WITHOUT the app's render engine.
   *
   * Every one of the 9 themes plus the intro and success blocks is pre-rendered
   * through the real section renderers and the real export cleanup, so a
   * refreshed section is byte-identical to a fresh export (parity by
   * construction). The field->theme map, order, heading level and intro
   * placement are baked so the bundle never re-derives layout logic.
   *
   * @param {{clientId?: string, courseId?: string, region?: string, workerUrl?: string}} [meta]
   *   Optional overrides; when omitted the client id / region are read from the
   *   Ally API client and the course id from the current selection. workerUrl is
   *   baked in verbatim when supplied (Stage 4 wires it).
   * @returns {Object|null} the island object, or null if the config, the icon
   *   library, or a course id is unavailable (the export then degrades to a
   *   static snapshot with no refresh).
   */
  function buildRefreshDataIsland(meta) {
    const options = meta || {};
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;

    // Guard: without the config's themes there is nothing to bake.
    if (typeof CFG === "undefined" || !Array.isArray(CFG.THEMES)) {
      logWarn(
        "buildRefreshDataIsland: config/THEMES unavailable — skipping island",
      );
      return null;
    }

    // Guard: the fragments must ship with inlined SVGs (the lite-populate step is
    // absent from the export), so the icon library is required for parity.
    if (
      !window.IconLibrary ||
      typeof window.IconLibrary.populateIcons !== "function"
    ) {
      logWarn(
        "buildRefreshDataIsland: IconLibrary unavailable — skipping island",
      );
      return null;
    }

    // Course id keys the snapshot and the refresh query; without it we cannot refresh.
    const creds = currentAllyCredentials();
    const courseId =
      options.courseId ||
      (selectedCourse && selectedCourse.id) ||
      (lastPreviewData && lastPreviewData.courseId) ||
      "";
    if (!courseId) {
      logWarn("buildRefreshDataIsland: no course id — skipping island");
      return null;
    }
    const clientId = options.clientId || creds.clientId || "";
    const region = options.region || creds.region || "";

    // Fragments render at the current layout's content level; the export then
    // transforms the whole outline. Match buildExportFragment EXACTLY so the baked
    // fragments are byte-identical: when the statement has a header section the
    // export promotes every heading up by (headerLevel - 1) to lift the header to
    // <h1>; otherwise it prepends a synthetic <h1> and shifts the body down one.
    // We read the header level from the live rendered statement (the same element
    // buildExportFragment clones), then apply the same transform per fragment.
    const layout = getActiveLayout();
    const contentLevel = layout && layoutLeadsWithTitleSection(layout) ? 4 : 3;

    const liveHeader =
      elements && elements.resultsContainer
        ? findHeaderHeading(elements.resultsContainer)
        : null;
    let applyHeadingTransform;
    let headingLevel;
    if (liveHeader) {
      const shift = parseInt(liveHeader.tagName.charAt(1), 10) - 1;
      applyHeadingTransform = function (w) {
        promoteHeadingsBy(w, shift);
      };
      headingLevel = Math.max(1, contentLevel - shift);
    } else {
      applyHeadingTransform = function (w) {
        normaliseExportHeadings(w);
      };
      headingLevel = Math.max(2, contentLevel - 1);
    }

    // Pre-render every theme (regardless of current count) + intro + success.
    const warnings = {};
    const fieldMap = {};
    const themeOrder = [];
    let ok = true;

    CFG.THEMES.forEach(function (theme) {
      if (!theme || !theme.id) return;
      themeOrder.push(theme.id);
      fieldMap[theme.id] = Array.isArray(theme.fields)
        ? theme.fields.slice()
        : [];
      // Resolve the theme's {tokens} against the active environment BEFORE
      // rendering. The live warning renderer does the same (registerCoreRenderers);
      // renderWarningSection itself does NOT resolve (unlike intro/success, which
      // call CFG.resolveIntro/resolveSuccess internally), so skipping this leaves
      // literal {courseNoun}-style tokens and breaks export parity.
      const resolvedTheme =
        typeof CFG.resolveTheme === "function"
          ? CFG.resolveTheme(theme, currentTokens(), currentEnvironmentId())
          : theme;
      const html = sectionToExportHtml(
        renderWarningSection(resolvedTheme, contentLevel),
        applyHeadingTransform,
      );
      if (html === null) {
        ok = false;
      } else {
        warnings[theme.id] = html;
      }
    });

    // Intro: pass no lastCheckedOn so the omit-marked freshness warning is not
    // rendered (the freshness indicator is the header <time>, Stage 3).
    const introHtml = sectionToExportHtml(
      renderIntroSection(null, contentLevel),
      applyHeadingTransform,
    );
    const successHtml = sectionToExportHtml(
      renderSuccessState(contentLevel),
      applyHeadingTransform,
    );

    if (!ok || introHtml === null || successHtml === null) {
      logWarn(
        "buildRefreshDataIsland: a fragment failed to render — skipping island",
      );
      return null;
    }

    const island = {
      v: 1,
      clientId: clientId,
      courseId: courseId,
      region: region,
      storageKey: REFRESH_STORAGE_PREFIX + courseId,
      headingLevel: headingLevel,
      introFirst: introPrecedesIssues(layout),
      themeOrder: themeOrder,
      fieldMap: fieldMap,
      fragments: {
        warnings: warnings,
        intro: introHtml,
        success: successHtml,
      },
    };

    // Bake the Worker endpoint (no token) so the embed can refresh. Precedence:
    // an explicit per-export override (e.g. staging), then the user's configured
    // worker URL, then the built-in default. The island needs the full /issues
    // ENDPOINT — already-distributed exports POST to that exact path — so derive
    // it from the configured BASE rather than storing an endpoint URL.
    island.workerUrl =
      options.workerUrl ||
      resolveConfiguredIssuesEndpoint() ||
      REFRESH_WORKER_URL;

    logInfo(
      "buildRefreshDataIsland: baked " +
        themeOrder.length +
        " themes + intro + success for course " +
        courseId,
    );
    return island;
  }

  /**
   * Builds the export payload (an HTML string) from the rendered statement.
   * Clones the same "statement only" scope as copy/Word via cloneStatementSections,
   * but with disclosures nativised to static <details>/<summary>, then:
   *   - makes the statement's OWN header heading the single document <h1> (by
   *     promoting the whole outline up by headerLevel-1), so there is no duplicate
   *     synthetic title; falls back to a prepended synthetic <h1> if the statement
   *     has no header section,
   *   - defensively populates any still-empty data-icon spans in the clone.
   * @param {{courseCode?: string, courseName?: string}} meta
   * @returns {string|null} innerHTML for the facade, or null if nothing to export
   */
  function buildExportFragment(meta) {
    // Export path: nativise disclosures to static <details>/<summary> (copy/Word
    // keep the flattened form via buildCopyFragment()).
    const wrapper = cloneStatementSections({ nativiseDisclosures: true });
    if (!wrapper) return null;

    // Heading outline. Prefer the statement's own header heading as the single
    // document <h1> (the header section carries data-sp-category="header") so we
    // don't emit a near-duplicate synthetic title beside it. Promoting the whole
    // outline by (headerLevel - 1) lifts the header (h3 in a title-led layout) to
    // <h1> and carries the body up with it (h4/h5 → h2/h3) — a clean, non-skipping
    // h1 → h2 → h3. When the statement has no header section, fall back to a
    // prepended synthetic <h1> + the down-shift so there is still exactly one <h1>.
    const headerHeading = findHeaderHeading(wrapper);
    if (headerHeading) {
      const headerLevel = parseInt(headerHeading.tagName.charAt(1), 10);
      promoteHeadingsBy(wrapper, headerLevel - 1);
    } else {
      const h1 = document.createElement("h1");
      h1.textContent = deriveExportTitle(meta);
      wrapper.insertBefore(h1, wrapper.firstChild);
      normaliseExportHeadings(wrapper);
    }

    // Defensive: the clone comes from the live (already-populated) DOM, so its
    // SVGs ride along — but if any data-icon span was still empty, populate it.
    if (
      window.IconLibrary &&
      typeof window.IconLibrary.populateIcons === "function"
    ) {
      window.IconLibrary.populateIcons(wrapper);
    }

    // Export-path only: promote the marked "last refreshed" <time> to a stable
    // id so the Phase 3 refresh embed's updateFreshness() can target it. Done
    // here (not in buildLiveTokens) so the in-app render carries only the inert
    // marker, never the id.
    const freshnessEl = wrapper.querySelector(
      '[data-sp-freshness="last-refreshed"]',
    );
    if (freshnessEl) {
      freshnessEl.id = "ally-sp-last-refreshed";
    }

    return wrapper.innerHTML;
  }

  /**
   * Exports the rendered statement to a SCORM package or standalone HTML file via
   * the Phase 1 export facade (dynamic-imported from the parse-time URL). Derives
   * title/metadata from selectedCourse/lastPreviewData, mirroring downloadAsWord.
   * Degrades with a user-facing error when the facade URL is unavailable.
   * @param {"scorm"|"html"} target - output kind
   * @param {HTMLButtonElement} button - the button that was clicked (for feedback)
   * @returns {Promise<void>}
   */
  async function downloadAsExport(target, button) {
    const label = target === "scorm" ? "SCORM package" : "HTML page";

    if (!EXPORT_FACADE_URL) {
      logError("EXPORT_FACADE_URL is null — export facade cannot be resolved");
      showCopyError("Export is not available");
      return;
    }

    const meta = {
      courseName:
        (selectedCourse && selectedCourse.name) ||
        (lastPreviewData && lastPreviewData.courseName) ||
        "",
      courseCode:
        (selectedCourse && selectedCourse.code) ||
        (lastPreviewData && lastPreviewData.courseCode) ||
        "",
    };

    const content = buildExportFragment(meta);
    if (!content) {
      showCopyError("No content to export");
      return;
    }

    const title = deriveExportTitle(meta);
    const metadata = {
      description:
        "Accessibility statement" +
        (meta.courseName ? " for " + meta.courseName : ""),
    };

    // Toast only — it announces through the shared announcer. Trailing U+2026
    // kept, as at the Word export above.
    if (typeof window.notifyInfo === "function") {
      window.notifyInfo("Preparing " + label + "…");
    }

    try {
      const facade = await import(EXPORT_FACADE_URL);

      // bodyEnd always carries the interactive-disclosure toggle script. Phase 3
      // (flag-gated at EXPORT time): when statement refresh is enabled AND the data
      // island builds, append the island + the refresh embed AFTER the disclosure
      // script (which must run first so its collapse hook exists for the swap).
      // Flag off, or the island can't build → export exactly as today (static
      // snapshot: no island, no embed, no refresh button, no worker calls).
      let bodyEnd = facade.ALLY_STATEMENT_EXPORT_SCRIPT;
      const refreshEnabled =
        typeof ALLY_CONFIG !== "undefined" &&
        typeof ALLY_CONFIG.isStatementRefreshEnabled === "function" &&
        ALLY_CONFIG.isStatementRefreshEnabled() &&
        // No data section in the export → nothing to refresh, so skip the island
        // even when the flag is on ("Ally data" toggled off).
        sectionVisibility.data !== false;
      if (refreshEnabled) {
        const island = buildRefreshDataIsland();
        if (island) {
          // Escape "</" so the JSON can never close its own <script> tag.
          const islandJson = JSON.stringify(island).replace(/<\//g, "<\\/");
          const islandScript =
            '<script type="application/json" id="ally-sp-refresh-island">' +
            islandJson +
            "</script>";
          bodyEnd =
            facade.ALLY_STATEMENT_EXPORT_SCRIPT +
            islandScript +
            facade.ALLY_STATEMENT_REFRESH_EMBED;
          logInfo("Statement refresh enabled — island + embed injected into export.");
        } else {
          logWarn(
            "Statement refresh enabled but the island could not be built — exporting a static snapshot.",
          );
        }
      }

      // Focus mode is read LIVE from the Exports-group checkbox at export time
      // (its checked state is the single source of truth). Absent element -> false,
      // so the export is unchanged until the toggle is present and ticked. When on,
      // the exported statement opens in focus mode (sidebar + TOC hidden).
      const focusToggle = document.getElementById("ally-sp-focus-toggle");
      const focusMode = !!(focusToggle && focusToggle.checked);

      // options.head injects the ally section styling into the exported <head>
      // (AFTER the library CSS, so author CSS wins); options.bodyEnd injects the
      // disclosure toggle script (+ the Phase 3 island + embed when enabled) at
      // end-of-body, running after the statement has parsed. The facade re-exports
      // all three constants, so one import() yields everything.
      await facade.exportContent({
        content: content,
        format: "html",
        target: target,
        title: title,
        metadata: metadata,
        focusMode: focusMode,
        download: true,
        options: {
          head: facade.ALLY_STATEMENT_EXPORT_CSS,
          bodyEnd: bodyEnd,
        },
      });
      // "ready", not "downloaded" — see the note in downloadAsWord. The library's
      // download() returns a filename unconditionally and has no error path, so a
      // refused download resolves exactly like an accepted one.
      showCopyFeedback(button, label + " ready");
      logInfo("Statement handed to the browser as " + target);
    } catch (error) {
      logError("Failed to export statement (" + target + "):", error);
      showCopyError("Failed to create the " + label);
    }
  }

  // ========================================================================
  // Section dispatch (registry-first, direct fallback)
  // ========================================================================

  /**
   * Returns the resolved master-settings token map for the current environment.
   * Falls back to the config default when no environment has been selected or
   * the config API is unavailable. Single seam so renderers receive tokens
   * without every call site knowing about them.
   * @returns {Object|null}
   */
  function currentTokens() {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    if (CFG && typeof CFG.getTokens === "function") {
      return CFG.getTokens(currentEnvironmentId());
    }
    return null;
  }

  /**
   * The active environment id (the persisted selection, or the config default).
   * Passed to the config resolve* helpers so per-environment wording overrides
   * (Stage 4) are applied.
   * @returns {string|null}
   */
  function currentEnvironmentId() {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    return (
      currentEnvironment ||
      (CFG && typeof CFG.getDefaultEnvironment === "function"
        ? CFG.getDefaultEnvironment()
        : null)
    );
  }

  /**
   * Registers the core section renderers (intro / warning / success / error)
   * with the section registry, as closures over the controller's private
   * render functions. This keeps the disclosure logic (toggleDisclosure) and
   * renderListItems in the controller while still routing every section through
   * one uniform ALLY_STATEMENT_PREVIEW_SECTIONS.render dispatch. New authored
   * types (info / video / group / linkButtons / courseInfo) live in the
   * sections module itself. Idempotent.
   */
  function registerCoreRenderers() {
    if (coreRenderersRegistered) return;
    if (typeof ALLY_STATEMENT_PREVIEW_SECTIONS === "undefined") {
      logWarn("Section registry unavailable - using direct render fallback");
      return;
    }

    const S = ALLY_STATEMENT_PREVIEW_SECTIONS;
    S.registerRenderer("intro", function (spec) {
      return renderIntroSection(spec.lastCheckedOn, spec.headingLevel);
    });
    S.registerRenderer("warning", function (spec) {
      const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
      const theme =
        CFG && typeof CFG.resolveTheme === "function"
          ? CFG.resolveTheme(spec.theme, currentTokens(), currentEnvironmentId())
          : spec.theme;
      return renderWarningSection(theme, spec.headingLevel);
    });
    S.registerRenderer("success", function (spec) {
      return renderSuccessState(spec.headingLevel);
    });
    S.registerRenderer("error", function (spec) {
      return renderErrorState(spec.message, spec.headingLevel);
    });

    coreRenderersRegistered = true;
    logDebug("Core section renderers registered");
  }

  /**
   * Renders a section spec to an element. Registry-first: if the registry has a
   * renderer for spec.type it is used (stamping export markers); otherwise a
   * direct dispatch to the controller's own render functions is the fallback,
   * so rendering never depends on the registry being present. Returns null for
   * an unknown type.
   * @param {Object} spec - Section spec ({ type, ... })
   * @returns {HTMLElement|null}
   */
  function renderSpec(spec) {
    if (!spec || typeof spec.type !== "string") return null;

    if (
      typeof ALLY_STATEMENT_PREVIEW_SECTIONS !== "undefined" &&
      ALLY_STATEMENT_PREVIEW_SECTIONS.has(spec.type)
    ) {
      const el = ALLY_STATEMENT_PREVIEW_SECTIONS.render(spec, {
        createElement: createElement,
        tokens: currentTokens(),
        // Per-child visibility hook honoured by renderGroup: a group child with
        // a `showWhen` is skipped when its rule fails, and a group left with no
        // visible children self-collapses (heading included). Reads the render
        // context published by renderByLayout.
        shouldShow: function (childSpec) {
          return evaluateShowRule((childSpec && childSpec.showWhen) || "always", {
            activeThemes: currentActiveThemes,
            answers: currentAnswers,
          });
        },
      });
      if (el) return el;
    }

    // Fallback: direct dispatch (covers registry-absent or renderer failure).
    switch (spec.type) {
      case "intro":
        return renderIntroSection(spec.lastCheckedOn, spec.headingLevel);
      case "warning":
        return renderWarningSection(spec.theme, spec.headingLevel);
      case "success":
        return renderSuccessState(spec.headingLevel);
      case "error":
        return renderErrorState(spec.message, spec.headingLevel);
      default:
        return null;
    }
  }

  /**
   * Renders the authored static sections for a given placement, appending each
   * to the container via the section registry. Placement is per-spec:
   * "before-issues" (after the intro) or "after-issues" (default; after the
   * warnings/success). No-op when there are no authored sections.
   * @param {HTMLElement} container
   * @param {string} placement - "before-issues" | "after-issues"
   */
  function renderAuthoredSections(container, placement, issueData) {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    if (typeof CFG === "undefined") return;
    const rawList =
      typeof CFG.getAuthoredSections === "function"
        ? CFG.getAuthoredSections()
        : [];
    // Resolve master-settings tokens (plus live per-course tokens) over a deep
    // copy so authored content reflects the environment wording and the live
    // course.
    const mergedTokens = Object.assign(
      {},
      currentTokens(),
      buildLiveTokens(issueData),
    );
    const list =
      typeof CFG.resolveSections === "function"
        ? CFG.resolveSections(rawList, mergedTokens, currentEnvironmentId())
        : rawList;

    (list || []).forEach(function (spec) {
      if (!spec) return;
      const specPlacement = spec.placement || "after-issues";
      if (specPlacement !== placement) return;
      const el = renderSpec(spec);
      if (el) container.appendChild(el);
    });
  }

  // ========================================================================
  // Layout model (Stage 2) — per-environment ordered id list
  // ========================================================================

  /**
   * The ordered layout for the active environment, or null when the
   * environment declares none (the caller then uses the legacy placement path).
   * @returns {Array.<(string|Object)>|null}
   */
  function getActiveLayout() {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    if (typeof CFG === "undefined" || typeof CFG.getLayout !== "function") {
      return null;
    }
    const envId =
      currentEnvironment ||
      (typeof CFG.getDefaultEnvironment === "function"
        ? CFG.getDefaultEnvironment()
        : null);
    return CFG.getLayout(envId);
  }

  /**
   * Normalises a layout entry to `{ id, ... }`. Bare strings become `{ id }`;
   * objects with a string `id` pass through (carrying any `showWhen`, which
   * Stage 3 will honour). Anything else is ignored with a warning.
   * @param {(string|Object)} rawEntry
   * @returns {Object|null}
   */
  function normaliseLayoutEntry(rawEntry) {
    if (typeof rawEntry === "string") return { id: rawEntry };
    if (
      rawEntry &&
      typeof rawEntry === "object" &&
      typeof rawEntry.id === "string"
    ) {
      return rawEntry;
    }
    logWarn("Invalid layout entry ignored: " + JSON.stringify(rawEntry));
    return null;
  }

  /**
   * Builds an id -> spec map of the authored sections, resolved against the
   * current environment tokens, for layout lookup by id.
   * @returns {Object.<string, Object>}
   */
  function buildAuthoredById(extraTokens) {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    const map = {};
    if (typeof CFG === "undefined") return map;
    const rawList =
      typeof CFG.getAuthoredSections === "function"
        ? CFG.getAuthoredSections()
        : [];
    // Live per-course tokens ({courseName}, {courseCode}, …) are merged OVER the
    // environment tokens so authored content can reference the live course.
    const mergedTokens = Object.assign({}, currentTokens(), extraTokens || {});
    const list =
      typeof CFG.resolveSections === "function"
        ? CFG.resolveSections(rawList, mergedTokens, currentEnvironmentId())
        : rawList;
    (list || []).forEach(function (spec) {
      if (spec && typeof spec.id === "string") map[spec.id] = spec;
    });
    return map;
  }

  /**
   * Minimal HTML escape for values placed into an innerHTML (note) context.
   * @param {*} value
   * @returns {string}
   */
  function escapeHtmlValue(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  // Base aria-level for the SHALLOWEST message heading (markdown `#`). The card's
  // own heading renders at <h5> in the Soton layout (group h4 -> demoteHeadings(+2)),
  // so a message heading must sit one level below it. `#` -> aria-level 6, `##` -> 7,
  // etc. Hardcoded for this fixed Soton-only card — revisit if the card's heading
  // level changes. aria-level is clamped so it never drops back above the card.
  const INCLUSION_HEADING_BASE_LEVEL = 6;

  // Lazy singleton — a dedicated, restricted markdown-it instance for USER text.
  // The editor/bridge instances use html:true and there is no DOMPurify, so they
  // are unsafe here; this one is html:false and disables everything outside the
  // confirmed scope (headings incl. sub-headings, numbered + bulleted lists, bold,
  // and http(s)/mailto links).
  let inclusionMarkdownRenderer;
  let inclusionMarkdownRendererBuilt = false;

  /**
   * Builds (once) and returns the restricted markdown-it renderer for the
   * module-lead message, or null when window.markdownit is unavailable (the
   * caller then falls back to the escaped-<br> path). Scope: ATX headings
   * (rendered as role="heading" + aria-level so sub-headings work under the
   * card's <h5> without hitting the native h6 ceiling), ordered/unordered
   * lists, BOLD, and inline `[text](url)` links (http(s)/mailto only, title
   * attribute stripped, same tab). Italic is neutralised (em renders empty);
   * images, code, blockquote, hr, raw HTML are all disabled or escaped.
   * @returns {Object|null} a markdown-it instance, or null if unavailable
   */
  function getInclusionMarkdownRenderer() {
    if (inclusionMarkdownRendererBuilt) return inclusionMarkdownRenderer;
    inclusionMarkdownRendererBuilt = true;

    if (typeof window.markdownit !== "function") {
      logWarn(
        "[Inclusion] window.markdownit unavailable — module-lead message falls back to escaped plain text",
      );
      inclusionMarkdownRenderer = null;
      return null;
    }

    const md = window.markdownit({
      html: false, // escape raw HTML in the author's text (no sanitiser here)
      linkify: false,
      breaks: true, // single newline -> <br> inside a paragraph
      typographer: false,
    });

    // Disable everything outside scope. The ignore-invalid flag (2nd arg true)
    // keeps this resilient if a rule name changes across markdown-it versions.
    md.disable(
      ["blockquote", "code", "fence", "hr", "html_block", "lheading", "reference"],
      true,
    );
    // `link` stays ENABLED for `[text](url)` (see validateLink + link_open below);
    // image/autolink/backticks/html_inline stay off, and `reference` (block list
    // above) + the constructor's linkify:false keep it to explicit inline links.
    md.disable(["image", "autolink", "backticks", "html_inline"], true);

    // Bold only: the `emphasis` rule stays enabled so `**bold**` -> <strong>,
    // but italic markers render to nothing (`*italic*` -> plain "italic").
    md.renderer.rules.em_open = function () {
      return "";
    };
    md.renderer.rules.em_close = function () {
      return "";
    };

    // Headings -> <div role="heading" aria-level="N"> so sub-headings nest under
    // the card's <h5> without exceeding the native <h6> ceiling. depth is the
    // markdown level (1-6 from the token tag); N = base + (depth - 1).
    md.renderer.rules.heading_open = function (tokens, idx) {
      const depth = parseInt(String(tokens[idx].tag).slice(1), 10) || 1;
      const level = INCLUSION_HEADING_BASE_LEVEL + (depth - 1);
      return (
        '<div role="heading" aria-level="' +
        level +
        '" class="ally-sp-md-heading ally-sp-md-heading-' +
        depth +
        '">'
      );
    };
    md.renderer.rules.heading_close = function () {
      return "</div>";
    };

    // Links: allow only http(s) and mailto. markdown-it's default validateLink
    // already blocks javascript:/vbscript:/file:/data:; this tightens it to an
    // explicit allowlist, so a disallowed URL makes the link rule fail to match
    // and `[x](javascript:…)` renders as literal text — never an <a>. (Relative /
    // anchor URLs are also excluded; statement authors write full URLs.)
    md.validateLink = function (url) {
      const str = String(url).trim().toLowerCase();
      return /^(https?:|mailto:)/.test(str);
    };

    // Strip the title attribute markdown-it emits for `[text](url "title")` — the
    // project forbids title (AGENTS.md; screen readers/keyboard/touch can't reach
    // it). Keep href; same-tab links, so no target/rel is added (matching the
    // authored {links} block, which sets neither).
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const titleIdx = token.attrIndex("title");
      if (titleIdx >= 0) token.attrs.splice(titleIdx, 1);
      return self.renderToken(tokens, idx, options);
    };

    inclusionMarkdownRenderer = md;
    return md;
  }

  /**
   * Renders the author's free-text "module lead message" for the {inclusionMessage}
   * token as real Markdown (Stage D). Uses the dedicated restricted markdown-it
   * renderer (html:false, scope = headings/lists/bold; see
   * getInclusionMarkdownRenderer). When that renderer is unavailable or throws,
   * falls back to the Stage B escaped-<br> logic — valid inline HTML inside the
   * new {html} <div>, so it degrades gracefully. Returns "" for empty/blank input
   * (card 6 is answer-gated, so it never shows then).
   * @param {*} raw
   * @returns {string} Block-level HTML safe to place inside a <div> (the {html} block)
   */
  function buildInclusionMessageHtml(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return "";
    const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const md = getInclusionMarkdownRenderer();
    if (md) {
      try {
        return md.render(normalised);
      } catch (error) {
        logWarn(
          "[Inclusion] Markdown render failed — falling back to escaped plain text",
          error,
        );
      }
    }

    return escapeHtmlValue(normalised)
      .replace(/\n{2,}/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  /**
   * Builds the live per-render tokens merged over the environment tokens when
   * resolving authored sections. Sourced from the issue data, falling back to
   * the selected course. `{lastRefreshed}` is a ready-built <time> element
   * string (used only inside a note/innerHTML context); `{academicYear}` is the
   * leading YYYY-YY range parsed out of the term name, or "" when unparseable
   * (the authored item then shows its placeholder). `{inclusionMessage}` is the
   * author's free-text module-lead message (escaped inline HTML, or "" when
   * unanswered), consumed by the `inclusive-design-module-lead-message` card.
   *
   * Module-lead contact tokens (from the wizard's contact step answers):
   * `{moduleLead}` / `{moduleLeadEmail}` are the PLAIN trimmed name/email, or
   * "" when unanswered — for courseInfo item value/email contexts, where an
   * empty string falls through to the item's placeholder. `{moduleLeadHtml}`
   * and `{statementLastEdited}` are for innerHTML contexts (the header note,
   * the accountability line), so they carry their own placeholder-span
   * fallback; `{statementLastEdited}` is a ready-built <time> element from the
   * answers store's per-module updatedAt (the date any answer was last saved).
   * @param {Object} issueData
   * @returns {{courseName:string, courseCode:string, academicYear:string, lastRefreshed:string, inclusionMessage:string, moduleLead:string, moduleLeadEmail:string, moduleLeadHtml:string, statementLastEdited:string}}
   */
  function buildLiveTokens(issueData) {
    const data = issueData || {};
    const course = selectedCourse || {};
    const termName = data.termName || course.termName || "";
    const yearMatch = /\b\d{4}-\d{2}\b/.exec(termName);
    const lastCheckedOn = data.lastCheckedOn || data.timestamp || null;

    let lastRefreshed = "an unknown time";
    if (lastCheckedOn) {
      const d = new Date(lastCheckedOn);
      if (!isNaN(d.getTime())) {
        // data-sp-freshness marks THIS <time> (not {statementLastEdited}'s) so
        // the export path can promote it to id="ally-sp-last-refreshed" for the
        // Phase 3 refresh embed to target. Inert in-app (no CSS/behaviour), like
        // the other data-sp-* export markers — the in-app render is unchanged.
        lastRefreshed =
          '<time datetime="' +
          escapeHtmlValue(d.toISOString()) +
          '" data-sp-freshness="last-refreshed">' +
          escapeHtmlValue(formatDate(lastCheckedOn)) +
          "</time>";
      }
    }

    // Placeholder-span fallbacks for the innerHTML-context module-lead tokens —
    // they must match the authored placeholder wording so an unanswered wizard
    // renders exactly what the static content used to show.
    const MODULE_LEAD_PLACEHOLDER =
      '<span class="ally-sp-placeholder">[Add module lead]</span>';
    const EDITED_DATE_PLACEHOLDER =
      '<span class="ally-sp-placeholder">[add date]</span>';

    let inclusionMessage = "";
    let moduleLead = "";
    let moduleLeadEmail = "";
    let statementLastEdited = EDITED_DATE_PLACEHOLDER;
    if (typeof ALLY_INCLUSION_ANSWERS !== "undefined" && selectedCourse) {
      const key = ALLY_INCLUSION_ANSWERS.courseKey(selectedCourse);
      inclusionMessage = buildInclusionMessageHtml(
        ALLY_INCLUSION_ANSWERS.getAnswer(key, "additional-information"),
      );

      // Module-lead contact step (name/email stored under their field ids).
      moduleLead = String(
        ALLY_INCLUSION_ANSWERS.getAnswer(key, "module-lead-name") || "",
      ).trim();
      moduleLeadEmail = String(
        ALLY_INCLUSION_ANSWERS.getAnswer(key, "module-lead-email") || "",
      ).trim();

      // "Statement last edited" = the store's per-module updatedAt (any answer
      // save), rendered as a <time> element like {lastRefreshed}.
      const editedAt = ALLY_INCLUSION_ANSWERS.updatedAt
        ? ALLY_INCLUSION_ANSWERS.updatedAt(key)
        : null;
      if (editedAt) {
        const editedDate = new Date(editedAt);
        if (!isNaN(editedDate.getTime())) {
          statementLastEdited =
            '<time datetime="' +
            escapeHtmlValue(editedDate.toISOString()) +
            '">' +
            escapeHtmlValue(formatDate(editedAt)) +
            "</time>";
        }
      }
    }

    return {
      courseName: data.courseName || course.name || "",
      courseCode: data.courseCode || course.code || "",
      academicYear: yearMatch ? yearMatch[0] : "",
      lastRefreshed: lastRefreshed,
      inclusionMessage: inclusionMessage,
      moduleLead: moduleLead,
      moduleLeadEmail: moduleLeadEmail,
      moduleLeadHtml: moduleLead
        ? escapeHtmlValue(moduleLead)
        : MODULE_LEAD_PLACEHOLDER,
      statementLastEdited: statementLastEdited,
    };
  }

  /**
   * True when the layout leads with an authored section (anything that is not
   * the intro or the @issues sentinel). That leading section is the statement
   * title (rendered <h3>), so the remaining shared content (intro / warnings /
   * success) drops one heading level beneath it. When the layout leads with the
   * intro instead, the content keeps its original top level.
   * @param {Array.<(string|Object)>} layout
   * @returns {boolean}
   */
  function layoutLeadsWithTitleSection(layout) {
    if (!Array.isArray(layout)) return false;
    for (let i = 0; i < layout.length; i++) {
      const entry = normaliseLayoutEntry(layout[i]);
      if (!entry || !entry.id) continue;
      return entry.id !== "intro" && entry.id !== "@issues";
    }
    return false;
  }

  /**
   * Evaluates a layout entry's show-rule against the render context (Stage 3).
   * Vocabulary (strings, extensible):
   *   - `always`            (default) — always visible
   *   - `hasAnyIssues`      — visible only when >= 1 active theme
   *   - `noIssues`          — visible only when 0 active themes
   *   - `hasIssue:<themeId>`— visible only when that theme (legacy id) is active
   *   - `answer:<questionId>`— visible only when the author's inclusion-question
   *                            answer is truthy: a Yes/No answer of "yes", or a
   *                            non-empty free-text answer (drives the
   *                            "inclusive-design" cards; see ALLY_INCLUSION_ANSWERS)
   * An unknown rule fails OPEN: the section is shown and one warning logged, so
   * an authoring typo never silently hides content. NOTE the `answer:*` rule is
   * the deliberate exception — an UNANSWERED question fails CLOSED (hidden), so
   * a card only ever appears when the author has affirmatively opted in.
   * @param {string} rule
   * @param {{activeThemes: Array, answers: Object}} ctx
   * @returns {boolean}
   */
  function evaluateShowRule(rule, ctx) {
    if (!rule || rule === "always") return true;
    const active = (ctx && ctx.activeThemes) || [];
    if (rule === "hasAnyIssues") return active.length > 0;
    if (rule === "noIssues") return active.length === 0;
    if (rule.indexOf("hasIssue:") === 0) {
      const themeId = rule.slice("hasIssue:".length);
      return active.some(function (item) {
        return item.theme && item.theme.id === themeId;
      });
    }
    if (rule.indexOf("answer:") === 0) {
      const questionId = rule.slice("answer:".length);
      const answers = (ctx && ctx.answers) || {};
      const value = answers[questionId];
      if (typeof value !== "string") return false; // unanswered → hidden
      const trimmed = value.trim();
      // Yes/No questions store "yes"/"no"; free-text stores markdown. A card
      // shows on an affirmative Yes/No or any non-empty free-text answer.
      if (trimmed === "") return false;
      if (trimmed.toLowerCase() === "no") return false;
      return true;
    }
    logWarn("Unknown show-rule '" + rule + "' — showing section (fail-open)");
    return true;
  }

  /**
   * Renders the accessibility-issue block: each active theme as a warning, or
   * the success entry when there are none. Shared by the layout walk (the
   * `@issues` sentinel) and the legacy placement path.
   * @param {HTMLElement} container
   * @param {Array} activeThemes
   */
  function renderIssuesBlock(container, activeThemes, level) {
    if (activeThemes.length === 0) {
      const successEl = renderSpec({
        type: "success",
        category: "data",
        headingLevel: level,
      });
      if (successEl) container.appendChild(successEl);
    } else {
      activeThemes.forEach(function (item) {
        const warningEl = renderSpec({
          type: "warning",
          category: "data",
          theme: item.theme,
          headingLevel: level,
        });
        if (warningEl) container.appendChild(warningEl);
      });
    }
  }

  /**
   * Walks an environment layout, appending each section to the container in
   * array order. Recognised ids: `intro` (the intro section), `@issues` (the
   * accessibility-issue block sentinel), and authored-section ids (looked up by
   * `spec.id`). Unknown ids are skipped with a warning. If the layout omits
   * `@issues` entirely, the issue block is appended at the end so it can never
   * silently vanish.
   * @param {HTMLElement} container
   * @param {Array.<(string|Object)>} layout
   * @param {Object} issueData
   * @param {Array} activeThemes
   */
  function renderByLayout(container, layout, issueData, activeThemes) {
    const authoredById = buildAuthoredById(buildLiveTokens(issueData));
    // Publish the per-render context the `shouldShow` closure (in renderSpec)
    // reads. renderSpec builds its own ctx and has neither activeThemes nor the
    // authored answers in scope, so we stash both at module level here.
    currentActiveThemes = activeThemes || [];
    currentAnswers =
      typeof ALLY_INCLUSION_ANSWERS !== "undefined" && selectedCourse
        ? ALLY_INCLUSION_ANSWERS.get(
            ALLY_INCLUSION_ANSWERS.courseKey(selectedCourse),
          )
        : {};
    const ctx = { activeThemes: activeThemes, answers: currentAnswers };
    // A leading authored section is the statement title; the shared content
    // then renders one heading level lower (see layoutLeadsWithTitleSection).
    const contentLevel = layoutLeadsWithTitleSection(layout) ? 4 : 3;
    let issuesSeen = false;

    layout.forEach(function (rawEntry) {
      const entry = normaliseLayoutEntry(rawEntry);
      if (!entry || !entry.id) return;
      const id = entry.id;
      const visible = evaluateShowRule(entry.showWhen || "always", ctx);

      if (id === "@issues") {
        // Seen regardless of the rule so the fail-safe below only fires when a
        // layout OMITS @issues entirely, never when a rule intentionally hides
        // it.
        issuesSeen = true;
        if (visible) renderIssuesBlock(container, activeThemes, contentLevel);
        return;
      }

      if (!visible) return;

      if (id === "intro") {
        const introEl = renderSpec({
          type: "intro",
          category: "data",
          lastCheckedOn: issueData.lastCheckedOn,
          headingLevel: contentLevel,
        });
        if (introEl) container.appendChild(introEl);
        return;
      }

      const spec = authoredById[id];
      if (!spec) {
        logWarn("Layout id has no matching content, skipping: " + id);
        return;
      }
      // Thread the layout's content level into authored sections, mirroring the
      // shared intro/issue content. Renderers that honour `headingLevel` (info)
      // then nest at h4/h5 under the h3 statement title; those that ignore it
      // (courseInfo title, etc.) render unchanged.
      const el = renderSpec(
        Object.assign({}, spec, { headingLevel: contentLevel }),
      );
      if (el) container.appendChild(el);
    });

    if (!issuesSeen) {
      logWarn(
        "Layout omitted '@issues' sentinel; appending issue block at end",
      );
      renderIssuesBlock(container, activeThemes, contentLevel);
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

    // Body sections: layout-driven when the active environment declares a
    // `layout` (Stage 2); otherwise the legacy placement path (kept for one
    // release so a layout-less environment renders identically to before).
    const layout = getActiveLayout();
    if (layout) {
      renderByLayout(container, layout, issueData, activeThemes);
    } else {
      // Render intro (via the section registry; direct fallback if absent)
      const introEl = renderSpec({
        type: "intro",
        category: "data",
        lastCheckedOn: issueData.lastCheckedOn,
      });
      if (introEl) container.appendChild(introEl);

      // Authored sections placed before the issues (after the intro)
      renderAuthoredSections(container, "before-issues", issueData);

      // Accessibility-issue block (warnings, or success when none)
      renderIssuesBlock(container, activeThemes);

      // Authored sections placed after the issues (default placement)
      renderAuthoredSections(container, "after-issues", issueData);
    }

    // Populate icons if IconLibrary is available
    if (typeof IconLibrary !== "undefined" && IconLibrary.populateIcons) {
      IconLibrary.populateIcons();
    }

    // Show results
    container.hidden = false;

    // Reveal the copy buttons now that there is a statement to copy
    if (elements.copyButtons) {
      elements.copyButtons.hidden = false;
    }

    // Render course metadata
    renderCourseMetadata(issueData);

    // Render theme breakdown (after course details)
    renderThemeBreakdown(activeThemes, issueData);

    // Honour the "Show" section-visibility toggles on this fresh render (a
    // re-render rebuilds the DOM, so the current toggle state must be reapplied).
    applySectionVisibility();

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
    // Filter by the unique courseId so name-duplicate courses cannot return the
    // wrong record. Fall back to courseName only if the id is somehow absent.
    const filters = selectedCourse.id
      ? { allyEnabled: "true", courseId: selectedCourse.id }
      : { allyEnabled: "true", courseName: "eq:" + selectedCourse.name };

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
          elements.resultsContainer,
          cached.timestamp,
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
    // Filter by the unique courseId so name-duplicate courses cannot return the
    // wrong record. Fall back to courseName only if the id is somehow absent.
    const filters = selectedCourse.id
      ? { allyEnabled: "true", courseId: selectedCourse.id }
      : { allyEnabled: "true", courseName: "eq:" + selectedCourse.name };

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

      // No cache fallback - show error. Add guidance that matches the real
      // cause so a server-side fault (502/503/504) or network problem is not
      // read as a credentials issue.
      const TYPES =
        (typeof ALLY_API_CLIENT !== "undefined" &&
          ALLY_API_CLIENT.ERROR_TYPES) ||
        {};
      let guidance = "";
      if (error && (error.type === TYPES.SERVER || error.type === TYPES.TIMEOUT)) {
        guidance =
          " This looks like a temporary problem at Ally's end, not your credentials — please wait a few minutes and try again.";
      } else if (error && error.type === TYPES.NETWORK) {
        guidance = " Check your internet connection and try again.";
      }
      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
        elements.resultsContainer.appendChild(
          renderErrorState(
            "Failed to fetch accessibility data. " +
              (error.message || "Please try again.") +
              guidance,
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

    // Inclusion-questions wizard trigger
    if (elements.inclusionButton) {
      elements.inclusionButton.addEventListener("click", function () {
        if (
          typeof ALLY_INCLUSION_QUESTIONS !== "undefined" &&
          typeof ALLY_INCLUSION_QUESTIONS.open === "function"
        ) {
          ALLY_INCLUSION_QUESTIONS.open();
        } else {
          logWarn("Inclusion-questions wizard not available");
        }
      });
    }

    // Listen for course selection changes
    if (typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined") {
      ALLY_STATEMENT_PREVIEW_SEARCH.onSelectionChange(
        handleCourseSelectionChange,
      );
    }

    // Copy buttons (optional - guard each)
    if (elements.copyTextBtn) {
      elements.copyTextBtn.addEventListener("click", copyAsText);
    }
    if (elements.copyFormattedBtn) {
      elements.copyFormattedBtn.addEventListener("click", copyAsFormatted);
    }
    if (elements.copyHtmlBtn) {
      elements.copyHtmlBtn.addEventListener("click", copyAsHtml);
    }
    if (elements.downloadWordBtn) {
      elements.downloadWordBtn.addEventListener("click", downloadAsWord);
    }

    // Inject + wire the SCORM / standalone-HTML export buttons. Injection is
    // idempotent, and this whole function is guarded by listenersAttached, so the
    // buttons and their handlers are created exactly once.
    injectExportButtons();
    if (elements.exportScormBtn) {
      elements.exportScormBtn.addEventListener("click", function () {
        downloadAsExport("scorm", elements.exportScormBtn);
      });
    }
    if (elements.exportHtmlBtn) {
      elements.exportHtmlBtn.addEventListener("click", function () {
        downloadAsExport("html", elements.exportHtmlBtn);
      });
    }

    listenersAttached = true;
    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Master-settings environment switch
  // ========================================================================

  /**
   * localStorage key for the persisted environment id.
   * @returns {string}
   */
  function getEnvStorageKey() {
    return (
      (typeof ALLY_CONFIG !== "undefined" &&
        ALLY_CONFIG.STORAGE_KEYS &&
        ALLY_CONFIG.STORAGE_KEYS.STATEMENT_ENVIRONMENT) ||
      "ally-statement-environment"
    );
  }

  /**
   * Reads the persisted environment id, validated against the config; null if
   * absent/invalid/unreadable.
   * @returns {string|null}
   */
  function loadPersistedEnvironment() {
    try {
      const value = window.localStorage.getItem(getEnvStorageKey());
      if (
        value &&
        typeof ALLY_STATEMENT_PREVIEW_CONFIG.getEnvironment === "function" &&
        ALLY_STATEMENT_PREVIEW_CONFIG.getEnvironment(value)
      ) {
        return value;
      }
    } catch (e) {
      logWarn("Could not read persisted environment:", e.message);
    }
    return null;
  }

  /**
   * Persists the environment id (best-effort).
   * @param {string} id
   */
  function persistEnvironment(id) {
    try {
      window.localStorage.setItem(getEnvStorageKey(), id);
    } catch (e) {
      logWarn("Could not persist environment:", e.message);
    }
  }

  /**
   * Applies a new environment: updates state, persists, re-renders any showing
   * statement (so wording + copy/export reflect the new profile), and announces
   * the change outside the aria-live results container.
   * @param {string} id
   */
  function handleEnvironmentChange(id) {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    const env = CFG.getEnvironment(id);
    if (!env) {
      logWarn("Unknown environment: " + id);
      return;
    }

    currentEnvironment = id;
    persistEnvironment(id);
    logInfo("Environment changed to: " + id);

    if (lastPreviewData) {
      renderPreviewFromData(lastPreviewData);
    }

    if (typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce(
        "Environment set to " +
          env.label +
          ". The statement wording has been updated.",
      );
    }
  }

  /**
   * Populates the environment radio group from the config and wires selection.
   * Hydrates the active environment from persistence (falling back to the
   * current value, then the config default). Idempotent — rebuilds the radios
   * on each call, so force-reinitialisation cannot duplicate listeners.
   */
  function initEnvironmentSwitch() {
    const CFG = ALLY_STATEMENT_PREVIEW_CONFIG;
    if (typeof CFG === "undefined" || typeof CFG.getEnvironments !== "function") {
      return;
    }

    const container = document.getElementById("ally-sp-environment-options");
    if (!container) {
      logDebug("Environment options container not found");
      return;
    }

    // Active environment: persisted > current > default
    const persisted = loadPersistedEnvironment();
    currentEnvironment =
      persisted ||
      currentEnvironment ||
      (typeof CFG.getDefaultEnvironment === "function"
        ? CFG.getDefaultEnvironment()
        : null);

    container.innerHTML = "";

    CFG.getEnvironments().forEach(function (env) {
      const label = document.createElement("label");
      label.className = "ally-sp-settings-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "ally-sp-environment";
      input.id = "ally-sp-env-" + env.id;
      input.value = env.id;
      if (env.id === currentEnvironment) {
        input.checked = true;
      }
      input.addEventListener("change", function () {
        if (this.checked) {
          handleEnvironmentChange(this.value);
        }
      });

      const span = document.createElement("span");
      span.className = "ally-sp-settings-option-label";
      span.textContent = env.label;

      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
    });

    logDebug("Environment switch initialised: " + currentEnvironment);
  }

  // ========================================================================
  // Statement-refresh feature flag toggle (Phase 3, Stage 0b)
  // ========================================================================

  /**
   * localStorage key for the per-browser statement-refresh override.
   * @returns {string}
   */
  function getRefreshFlagStorageKey() {
    return (
      (typeof ALLY_CONFIG !== "undefined" &&
        ALLY_CONFIG.STORAGE_KEYS &&
        ALLY_CONFIG.STORAGE_KEYS.STATEMENT_REFRESH_ENABLED) ||
      "ally-statement-refresh-enabled"
    );
  }

  /**
   * Persists the statement-refresh override (best-effort). Writes the exact
   * string "true"/"false" so ALLY_CONFIG.isStatementRefreshEnabled() honours it.
   * @param {boolean} enabled
   */
  function persistRefreshFlag(enabled) {
    try {
      window.localStorage.setItem(
        getRefreshFlagStorageKey(),
        enabled ? "true" : "false",
      );
    } catch (e) {
      logWarn("Could not persist statement-refresh override:", e.message);
    }
  }

  // ------------------------------------------------------------------------
  // Section-visibility toggles ("Show" checkboxes)
  // ------------------------------------------------------------------------
  //
  // Each checkbox maps to a data-sp-category so a whole section role can be
  // shown/hidden on screen AND in every export — the export clone
  // (cloneStatementSections) honours the .hidden flag, so one live toggle
  // filters copy, Word, docx and SCORM/HTML alike. The statement header
  // (category "header") and the uncategorised error box carry no toggle and are
  // always kept. Default is all-visible, reset each page load (no persistence).
  const SECTION_VISIBILITY_TOGGLES = [
    { id: "ally-sp-show-boilerplate", category: "boilerplate", label: "Boilerplate" },
    { id: "ally-sp-show-lead-answers", category: "inclusive-design", label: "Lead answers" },
    { id: "ally-sp-show-ally-data", category: "data", label: "Ally data" },
  ];
  const sectionVisibility = {
    boilerplate: true,
    "inclusive-design": true,
    data: true,
  };

  /**
   * Applies the current section-visibility state to the rendered statement by
   * toggling the `hidden` attribute on every section carrying a managed
   * data-sp-category. Only touches sections already in the DOM, so show-rule
   * omissions (a collapsed group, absent warnings) are unaffected. Called on
   * every render and on every checkbox change.
   */
  function applySectionVisibility() {
    const container = elements.resultsContainer;
    if (!container) return;
    SECTION_VISIBILITY_TOGGLES.forEach(function (toggle) {
      const visible = sectionVisibility[toggle.category] !== false;
      container
        .querySelectorAll('[data-sp-category="' + toggle.category + '"]')
        .forEach(function (section) {
          section.hidden = !visible;
        });
    });
  }

  /**
   * Seeds the visibility state from the "Show" checkboxes (checked = visible)
   * and wires each to re-apply visibility + announce on change. Idempotent —
   * assigns onchange (not addEventListener) so a re-init cannot stack listeners.
   */
  function initSectionVisibilityToggles() {
    SECTION_VISIBILITY_TOGGLES.forEach(function (toggle) {
      const checkbox = document.getElementById(toggle.id);
      if (!checkbox) {
        logDebug("Section-visibility toggle not found: " + toggle.id);
        return;
      }
      sectionVisibility[toggle.category] = checkbox.checked;
      checkbox.onchange = function () {
        sectionVisibility[toggle.category] = this.checked;
        applySectionVisibility();
        logInfo(
          toggle.label + " sections " + (this.checked ? "shown" : "hidden"),
        );
        if (typeof ALLY_UI_MANAGER !== "undefined") {
          ALLY_UI_MANAGER.announce(
            toggle.label +
              " sections " +
              (this.checked ? "shown" : "hidden") +
              " in the preview and exports.",
          );
        }
      };
    });
    applySectionVisibility();
    logDebug("Section-visibility toggles initialised");
  }

  /**
   * Hydrates the refresh toggle from the effective flag state
   * (ALLY_CONFIG.isStatementRefreshEnabled(): localStorage override over the
   * code default) and wires it to persist a per-browser override on change.
   * Idempotent — assigns onchange (not addEventListener) so a re-init cannot
   * stack listeners. Nothing else is wired to the flag yet (Stage 0b).
   */
  function initRefreshToggle() {
    const checkbox = document.getElementById("ally-sp-refresh-toggle");
    if (!checkbox) {
      logDebug("Refresh toggle not found");
      return;
    }

    const effective =
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.isStatementRefreshEnabled === "function"
        ? ALLY_CONFIG.isStatementRefreshEnabled()
        : false;
    checkbox.checked = effective;

    checkbox.onchange = function () {
      persistRefreshFlag(this.checked);
      logInfo("Statement refresh " + (this.checked ? "enabled" : "disabled"));
      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce(
          this.checked
            ? "Live accessibility-data refresh enabled. Statements you export from now on will include the update button."
            : "Live accessibility-data refresh disabled. Statements you export from now on will be a fixed snapshot.",
        );
      }
    };

    logDebug("Refresh toggle initialised: " + effective);
  }

  /**
   * Wires the "Open exports in focus mode" checkbox in the Exports settings
   * group. The checkbox's checked state is the single source of truth, read live
   * at export time by downloadAsExport(); this init only adds a polite change
   * announcement, mirroring the sibling refresh toggle. Default is off (unchecked
   * in the markup) with no persistence — a per-export preference, reset each load.
   * Idempotent — assigns onchange (not addEventListener) so a re-init cannot stack
   * listeners.
   */
  function initFocusModeToggle() {
    const checkbox = document.getElementById("ally-sp-focus-toggle");
    if (!checkbox) {
      logDebug("Focus-mode toggle not found");
      return;
    }

    checkbox.onchange = function () {
      logInfo("Export focus mode " + (this.checked ? "enabled" : "disabled"));
      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce(
          this.checked
            ? "Focus mode enabled. Statements you export from now on will open in focus mode, with the sidebar and contents hidden."
            : "Focus mode disabled. Statements you export from now on will open normally.",
        );
      }
    };

    logDebug("Focus-mode toggle initialised");
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

      // Establish the active master-settings environment (default until the
      // switch UI updates it in a later phase)
      if (
        !currentEnvironment &&
        typeof ALLY_STATEMENT_PREVIEW_CONFIG.getDefaultEnvironment === "function"
      ) {
        currentEnvironment =
          ALLY_STATEMENT_PREVIEW_CONFIG.getDefaultEnvironment();
      }

      // Register core section renderers with the registry (idempotent)
      registerCoreRenderers();

      // Cache elements
      if (!cacheElements()) {
        logError("Required elements not found - initialisation failed");
        return false;
      }

      // Set up event listeners
      setupEventListeners();

      // Populate + wire the institution/environment switch
      initEnvironmentSwitch();

      // Hydrate + wire the statement-refresh feature-flag toggle (Phase 3)
      initRefreshToggle();

      // Wire the "Open exports in focus mode" checkbox (default off, read live)
      initFocusModeToggle();

      // Wire the "Show" section-visibility checkboxes (default all on)
      initSectionVisibilityToggles();

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

      if (elements.copyButtons) {
        elements.copyButtons.hidden = true;
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
     * Builds the copy payload from the rendered statement (exposed for testing)
     * @returns {{text: string, html: string}|null}
     */
    buildCopyContent: buildCopyContent,

    /**
     * Builds the detached statement fragment shared by all export paths
     * (exposed for testing / Word export)
     * @returns {HTMLElement|null}
     */
    buildCopyFragment: buildCopyFragment,

    /**
     * Clones the exportable statement sections (shared core of copy / Word /
     * SCORM-HTML export). Pass { nativiseDisclosures: true } for the export path
     * (keeps the interactive disclosure button + media iframes for the injected
     * script); omit / false for the flattened copy/Word form.
     * (exposed for testing / the regression guard)
     * @param {{ nativiseDisclosures?: boolean }} [options]
     * @returns {HTMLElement|null}
     */
    cloneStatementSections: cloneStatementSections,

    /**
     * Downloads the rendered statement as a Word document (exposed for testing)
     * @returns {Promise<void>}
     */
    downloadAsWord: downloadAsWord,

    /**
     * Builds the export payload (HTML string, single <h1> + normalised outline)
     * from the rendered statement (exposed for testing)
     * @param {{courseCode?: string, courseName?: string}} meta
     * @returns {string|null}
     */
    buildExportFragment: buildExportFragment,

    /**
     * Builds the Phase 3 refresh data island (all 9 theme fragments + intro +
     * success + fieldMap/themeOrder/headingLevel/introFirst + course identifiers)
     * for the current render, or null when refresh cannot be supported. Wired to
     * nothing yet (Stage 7 injects it); exposed for testing.
     * @param {{clientId?: string, courseId?: string, region?: string, workerUrl?: string}} [meta]
     * @returns {Object|null}
     */
    buildRefreshDataIsland: buildRefreshDataIsland,

    /**
     * Exports the rendered statement to a SCORM package or standalone HTML file
     * via the Phase 1 facade (exposed for testing)
     * @param {"scorm"|"html"} target
     * @param {HTMLButtonElement} [button]
     * @returns {Promise<void>}
     */
    downloadAsExport: downloadAsExport,

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
     * Re-renders the current preview from the already-loaded data — a LIGHT
     * re-render with no Ally API call. Used after the inclusion-questions wizard
     * closes so the inclusive-design cards reflect the new answers immediately.
     * No-op (returns false) when no preview has been generated yet.
     * @returns {boolean} True if a re-render happened
     */
    rerender: function () {
      if (!lastPreviewData) {
        logDebug("rerender: no preview data yet — nothing to re-render");
        return false;
      }
      renderPreviewFromData(lastPreviewData);
      logInfo("Preview re-rendered from existing data (no API call)");
      return true;
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

  // Copy button tests
  test(
    "has buildCopyContent method",
    typeof ALLY_STATEMENT_PREVIEW.buildCopyContent === "function",
  );

  const copyGroup = document.getElementById("ally-sp-copy-buttons");
  const copyTextBtn = document.getElementById("ally-sp-copy-text");
  const copyFormattedBtn = document.getElementById("ally-sp-copy-formatted");
  const copyHtmlBtn = document.getElementById("ally-sp-copy-html");

  test("Copy button group exists", copyGroup !== null);
  test("Copy Text button exists", copyTextBtn !== null);
  test("Copy Formatted button exists", copyFormattedBtn !== null);
  test("Copy HTML button exists", copyHtmlBtn !== null);

  if (copyGroup) {
    test("Copy button group is hidden initially", copyGroup.hidden === true);
    test(
      "Copy button group is outside the aria-live results container",
      !!resultsContainer && !resultsContainer.contains(copyGroup),
    );
  }
  if (copyTextBtn) {
    test(
      "Copy Text button has accessible name",
      copyTextBtn.textContent.trim().length > 0,
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

/**
 * Copy-button test: renders mock data, then verifies the copy payload honours
 * the "statement only" scope and the "disclosures always expanded" rule.
 * NOTE: this renders into the live Statement Preview DOM.
 */
window.testAllyStatementPreviewCopy = function () {
  console.group("ALLY_STATEMENT_PREVIEW Copy Tests");

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

  if (!ALLY_STATEMENT_PREVIEW.isInitialised()) {
    ALLY_STATEMENT_PREVIEW.initialise(true);
  }

  // Render a statement with issues + a freshness date via the cache render path
  const mockEntry = {
    courseId: "copy-test-123",
    courseName: "Copy Test Module",
    courseCode: "COPY101",
    termName: "2023-24",
    timestamp: Date.now(),
    data: {
      courseName: "Copy Test Module",
      courseCode: "COPY101",
      termName: "2023-24",
      lastCheckedOn: "2024-01-15T10:30:00Z",
      filesCount: 45,
      alternativeText2: 5,
      htmlImageAlt2: 3,
      htmlBrokenLink2: 2,
    },
  };

  ALLY_STATEMENT_PREVIEW.renderFromCache(mockEntry);

  const copyGroup = document.getElementById("ally-sp-copy-buttons");
  test(
    "Copy button group visible after render",
    !!copyGroup && copyGroup.hidden === false,
  );

  const freshnessRendered = !!document.querySelector(
    "#ally-sp-results .ally-sp-freshness-warning",
  );
  test("Freshness notice present in rendered statement", freshnessRendered);

  const content = ALLY_STATEMENT_PREVIEW.buildCopyContent();
  test("buildCopyContent returns an object", content && typeof content === "object");

  if (content) {
    test("Copy payload has non-empty text", content.text.trim().length > 0);
    test("Copy payload has non-empty html", content.html.trim().length > 0);
    test(
      "Copy payload EXCLUDES the freshness notice",
      content.html.indexOf("ally-sp-freshness-warning") === -1 &&
        content.text.indexOf("last updated") === -1,
    );
    test(
      "Copy payload INCLUDES expanded disclosure content",
      content.text.indexOf("What this means") !== -1,
    );
    test(
      "Copy payload DROPS the Read more disclosure buttons",
      content.html.indexOf("ally-sp-disclosure-button") === -1,
    );
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.log(
    "Note: this rendered mock data into the live preview. Reset with ALLY_STATEMENT_PREVIEW.reset().",
  );
  console.groupEnd();

  return failed === 0;
};

// ------------------------------------------------------------------------
// Phase 2 export-seam test: exercises the marker convention and the new
// serialiser primitives (dl, data-export-text) directly, by injecting a
// synthetic marked-up statement into #ally-sp-results and reading the copy
// payload back. Restores the container afterwards.
// ------------------------------------------------------------------------
window.testAllyStatementPreviewExport = function () {
  console.group("ALLY_STATEMENT_PREVIEW Export-Seam Tests");

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

  if (!ALLY_STATEMENT_PREVIEW.isInitialised()) {
    ALLY_STATEMENT_PREVIEW.initialise(true);
  }

  const container = document.getElementById("ally-sp-results");
  if (!container) {
    console.error("✗ #ally-sp-results not found");
    console.groupEnd();
    return false;
  }

  const prevHtml = container.innerHTML;
  const prevHidden = container.hidden;

  container.hidden = false;
  container.innerHTML =
    '<section class="ally-sp-intro" data-sp-section="intro" data-sp-export="include">' +
    "<h3>Intro heading</h3><p>Intro body text.</p>" +
    '<div class="ally-sp-freshness-warning" data-sp-export="omit">' +
    "<p>This information was last updated yesterday.</p></div>" +
    "</section>" +
    '<section class="ally-sp-courseinfo" data-sp-section="courseInfo" data-sp-export="include">' +
    "<h3>Course information</h3>" +
    "<dl><dt>Module lead</dt><dd>Dr Smith</dd>" +
    '<dt>Email</dt><dd><a href="mailto:lead@example.com">lead@example.com</a></dd></dl>' +
    "</section>" +
    '<section class="ally-sp-video" data-sp-section="video" data-sp-export="include">' +
    "<h3>Watch the overview</h3>" +
    '<div class="videoWrapper" data-export-text="Play video: Overview" ' +
    'data-export-href="https://youtu.be/abc123"></div>' +
    "</section>" +
    '<section data-sp-section="omitme" data-sp-export="omit">' +
    "<h3>Should not appear</h3><p>Excluded top-level section.</p></section>" +
    '<div class="ally-cache-banner">Cache banner (no marker, excluded)</div>';

  const content = ALLY_STATEMENT_PREVIEW.buildCopyContent();
  test("buildCopyContent returns an object", !!content && typeof content === "object");

  if (content) {
    const t = content.text;
    const h = content.html;

    // Included content
    test("text includes intro heading", t.indexOf("Intro heading") !== -1);
    test("text includes intro body", t.indexOf("Intro body text.") !== -1);
    test("text includes course heading", t.indexOf("Course information") !== -1);

    // dl primitive → "label: value" per pair
    test(
      "dl serialises as 'Module lead: Dr Smith'",
      t.indexOf("Module lead: Dr Smith") !== -1,
    );
    test(
      "dl serialises email pair with mailto url",
      t.indexOf("Email: lead@example.com (mailto:lead@example.com)") !== -1,
    );

    // data-export-text primitive → titled link, embed never dead
    test(
      "data-export-text serialises as titled link",
      t.indexOf("Play video: Overview (https://youtu.be/abc123)") !== -1,
    );

    // Omitted / unmarked content excluded
    test(
      "omit descendant (freshness) excluded from text",
      t.indexOf("last updated") === -1,
    );
    test(
      "omit descendant (freshness) excluded from html",
      h.indexOf("ally-sp-freshness-warning") === -1,
    );
    test(
      "omit top-level section excluded from text",
      t.indexOf("Should not appear") === -1,
    );
    test(
      "unmarked node (cache banner) excluded from html",
      h.indexOf("ally-cache-banner") === -1,
    );
  }

  // Restore the live container
  container.innerHTML = prevHtml;
  container.hidden = prevHidden;

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
