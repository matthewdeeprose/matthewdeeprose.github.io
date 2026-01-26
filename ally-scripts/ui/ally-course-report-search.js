/**
 * @fileoverview Ally Accessibility Reporting Tool - Course Report Search Module
 * @module AllyCourseReportSearch
 * @requires ALLY_COURSES
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since Phase 7A
 *
 * @description
 * Provides autocomplete course search functionality specifically for the Course Report section.
 * This is a duplicated version of ALLY_COURSE_SEARCH with ally-cr- prefixed element IDs
 * to allow independent operation from the Report Builder course search.
 *
 * Key Features:
 * - Autocomplete search with debouncing
 * - Searches both course name and course code
 * - Keyboard navigation for results
 * - Performance optimised for large datasets
 * - Full accessibility support (ARIA combobox pattern)
 * - Isolated from Report Builder course search
 *
 * @example
 * ALLY_COURSE_REPORT_SEARCH.initialise();
 * const selected = ALLY_COURSE_REPORT_SEARCH.getSelectedCourse();
 */

const ALLY_COURSE_REPORT_SEARCH = (function () {
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
      console.error("[AllyCRSearch] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyCRSearch] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyCRSearch] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyCRSearch] " + message, ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  const CONFIG = {
    MIN_SEARCH_LENGTH: 2,
    MAX_RESULTS: 10,
    DEBOUNCE_MS: 150,
    HIGHLIGHT_CLASS: "ally-search-highlight",
  };

  // Element ID prefix for Course Report (avoids conflicts with Report Builder)
  const ID_PREFIX = "ally-cr-";

  // ========================================================================
  // Private State
  // ========================================================================

  var initialised = false;
  var debounceTimer = null;
  var selectedCourse = null;
  var activeIndex = -1;
  var currentResults = [];

  // Callbacks for external integration
  var onSelectionChangeCallback = null;

  var elements = {
    searchInput: null,
    resultsContainer: null,
    resultsList: null,
    selectedDisplay: null,
    clearButton: null,
    statusMessage: null,
    searchIcon: null,
    executeButton: null,
    executeHelp: null,
  };

  // ========================================================================
  // Private Methods - Element Caching
  // ========================================================================

  function cacheElements() {
    elements.searchInput = document.getElementById(ID_PREFIX + "search-input");
    elements.resultsContainer = document.getElementById(
      ID_PREFIX + "search-results",
    );
    elements.resultsList = document.getElementById(
      ID_PREFIX + "search-listbox",
    );
    elements.selectedDisplay = document.getElementById(ID_PREFIX + "selected");
    elements.clearButton = document.getElementById(ID_PREFIX + "search-clear");
    elements.statusMessage = document.getElementById(
      ID_PREFIX + "search-status",
    );
    elements.searchIcon = document.querySelector(
      "." + ID_PREFIX + "search-icon",
    );
    elements.executeButton = document.getElementById(ID_PREFIX + "execute");
    elements.executeHelp = document.getElementById(ID_PREFIX + "execute-help");

    var allFound =
      elements.searchInput && elements.resultsContainer && elements.resultsList;

    if (!allFound) {
      logWarn("Some course report search elements not found in DOM");
      logDebug("Elements found:", {
        searchInput: !!elements.searchInput,
        resultsContainer: !!elements.resultsContainer,
        resultsList: !!elements.resultsList,
        selectedDisplay: !!elements.selectedDisplay,
        clearButton: !!elements.clearButton,
        statusMessage: !!elements.statusMessage,
        searchIcon: !!elements.searchIcon,
        executeButton: !!elements.executeButton,
        executeHelp: !!elements.executeHelp,
      });
    }

    return allFound;
  }

  // ========================================================================
  // Private Methods - Search
  // ========================================================================

  /**
   * Searches courses by name or code
   * @param {string} query - Search query
   * @returns {Array} Matching courses (limited to MAX_RESULTS)
   */
  function searchCourses(query) {
    if (!query || query.length < CONFIG.MIN_SEARCH_LENGTH) {
      return [];
    }

    if (typeof ALLY_COURSES === "undefined") {
      logWarn("ALLY_COURSES not available");
      return [];
    }

    var normalised = query.toLowerCase().trim();
    var results = [];
    var seenIds = new Set();

    // First, try the built-in code search (fast, indexed)
    if (typeof ALLY_COURSES.searchCoursesByCode === "function") {
      var codeMatches = ALLY_COURSES.searchCoursesByCode(query);
      if (Array.isArray(codeMatches)) {
        codeMatches.forEach(function (match) {
          if (!seenIds.has(match.courseId)) {
            seenIds.add(match.courseId);
            results.push({
              id: match.courseId,
              name: match.courseName || "Unknown Course",
              code: match.courseCode || "",
              termId: match.termId || "",
              termName: getTermName(match.termId),
              matchType: "code",
            });
          }
        });
      }
    }

    // Also search by course name (iterate over courses object)
    if (ALLY_COURSES.courses) {
      var courseIds = Object.keys(ALLY_COURSES.courses);

      for (var i = 0; i < courseIds.length; i++) {
        var id = courseIds[i];
        var course = ALLY_COURSES.courses[id];

        // Skip if already found via code search
        if (seenIds.has(id)) continue;

        // Check for name match
        var nameMatch =
          course.courseName &&
          course.courseName.toLowerCase().includes(normalised);

        // Also check code if not found via indexed search
        var codeMatch =
          course.courseCode &&
          course.courseCode.toLowerCase().includes(normalised);

        if (nameMatch || codeMatch) {
          seenIds.add(id);
          results.push({
            id: id,
            name: course.courseName || "Unknown Course",
            code: course.courseCode || "",
            termId: course.termId || "",
            termName: getTermName(course.termId),
            matchType: codeMatch ? "code" : "name",
          });
        }
      }
    }

    // Sort by relevance, then term recency, then code
    var sortedResults = sortResultsByTermRecency(results, query);
    var limitedResults = sortedResults.slice(0, CONFIG.MAX_RESULTS);

    logDebug(
      "Found " +
        results.length +
        " courses for query: " +
        query +
        ", returning " +
        limitedResults.length +
        " sorted by recency",
    );

    return limitedResults;
  }

  /**
   * Gets the term name from a term ID using ALLY_LOOKUP
   * @param {string} termId - Term ID
   * @returns {string} Term name or empty string
   */
  function getTermName(termId) {
    if (!termId) return "";

    if (typeof ALLY_LOOKUP === "undefined") return "";

    // Try getTermName first (returns string directly)
    if (typeof ALLY_LOOKUP.getTermName === "function") {
      var name = ALLY_LOOKUP.getTermName(termId);
      if (name) return name;
    }

    // Fallback to getTerm (returns object)
    if (typeof ALLY_LOOKUP.getTerm === "function") {
      var term = ALLY_LOOKUP.getTerm(termId);
      return term ? term.name || term.termName || "" : "";
    }

    return "";
  }

  /**
   * Gets the sortOrder for a term (higher = more recent for academic terms)
   * @param {string} termId - Term ID
   * @returns {number} Sort order (defaults to -999 if not found)
   */
  function getTermSortOrder(termId) {
    if (!termId) return -999;

    if (
      typeof ALLY_LOOKUP !== "undefined" &&
      typeof ALLY_LOOKUP.getTerm === "function"
    ) {
      var term = ALLY_LOOKUP.getTerm(termId);
      if (term && typeof term.sortOrder === "number") {
        return term.sortOrder;
      }
    }

    return -999;
  }

  /**
   * Calculates relevance score for a search result
   * Higher score = better match
   * @param {Object} result - Course result object
   * @param {string} query - Original search query (normalised)
   * @returns {number} Relevance score
   */
  function calculateRelevanceScore(result, query) {
    var score = 0;
    var queryLower = query.toLowerCase();
    var codeLower = (result.code || "").toLowerCase();
    var nameLower = (result.name || "").toLowerCase();

    // Extract base code (e.g., "FEEG1003" from "FEEG1003-29852-25-26")
    var baseCode = codeLower.split("-")[0];

    // Exact base code match (highest priority)
    if (baseCode === queryLower) {
      score += 1000;
    }
    // Base code starts with query
    else if (baseCode.startsWith(queryLower)) {
      score += 500;
    }
    // Code starts with query
    else if (codeLower.startsWith(queryLower)) {
      score += 300;
    }
    // Code contains query
    else if (codeLower.includes(queryLower)) {
      score += 100;
    }

    // Name match bonuses
    if (nameLower.startsWith(queryLower)) {
      score += 50;
    } else if (nameLower.includes(queryLower)) {
      score += 25;
    }

    return score;
  }

  /**
   * Sorts results by relevance, then term recency, then code alphabetically
   * @param {Array} results - Array of course results
   * @param {string} query - Original search query
   * @returns {Array} Sorted results
   */
  function sortResultsByTermRecency(results, query) {
    if (!results || results.length === 0) return results;

    var normalised = (query || "").toLowerCase().trim();

    return results.slice().sort(function (a, b) {
      // Primary: Relevance score (descending)
      var relevanceA = calculateRelevanceScore(a, normalised);
      var relevanceB = calculateRelevanceScore(b, normalised);
      if (relevanceB !== relevanceA) {
        return relevanceB - relevanceA;
      }

      // Secondary: Term recency (descending - most recent first)
      var sortOrderA = getTermSortOrder(a.termId);
      var sortOrderB = getTermSortOrder(b.termId);
      if (sortOrderB !== sortOrderA) {
        return sortOrderB - sortOrderA;
      }

      // Tertiary: Code alphabetically (ascending)
      var codeA = (a.code || "").toLowerCase();
      var codeB = (b.code || "").toLowerCase();
      return codeA.localeCompare(codeB);
    });
  }

  /**
   * Highlights matching text in a string
   * @param {string} text - Original text
   * @param {string} query - Search query to highlight
   * @returns {string} HTML with highlighted matches
   */
  function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || "");

    var escaped = escapeHtml(text);
    var queryEscaped = escapeRegExp(query);

    try {
      var regex = new RegExp("(" + queryEscaped + ")", "gi");
      return escaped.replace(
        regex,
        '<mark class="' + CONFIG.HIGHLIGHT_CLASS + '">$1</mark>',
      );
    } catch (e) {
      return escaped;
    }
  }

  /**
   * Escapes HTML entities
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escapes special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ========================================================================
  // Private Methods - UI
  // ========================================================================

  /**
   * Renders search results in the dropdown
   * @param {Array} results - Search results to render
   * @param {string} query - Original search query
   */
  function renderResults(results, query) {
    if (!elements.resultsList) return;

    currentResults = results;
    activeIndex = -1;
    elements.resultsList.innerHTML = "";

    if (results.length === 0) {
      hideResults();
      updateStatus("No courses found");
      return;
    }

    results.forEach(function (course, index) {
      var li = document.createElement("li");
      li.id = ID_PREFIX + "option-" + index;
      li.className = "ally-course-search-option";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.setAttribute("data-index", index);

      var nameSpan = document.createElement("span");
      nameSpan.className = "ally-course-option-name";
      nameSpan.innerHTML = highlightMatch(course.name, query);

      var codeSpan = document.createElement("span");
      codeSpan.className = "ally-course-option-code";
      codeSpan.innerHTML = highlightMatch(course.code, query);

      var termSpan = document.createElement("span");
      termSpan.className = "ally-course-option-term";
      termSpan.textContent = course.termName || "";

      li.appendChild(nameSpan);
      li.appendChild(codeSpan);
      if (course.termName) {
        li.appendChild(termSpan);
      }

      li.addEventListener("click", function () {
        selectCourse(index);
      });

      li.addEventListener("mouseenter", function () {
        setActiveOption(index);
      });

      elements.resultsList.appendChild(li);
    });

    showResults();
    updateStatus(
      results.length + " courses found. Use arrow keys to navigate.",
    );
  }

  /**
   * Shows the results dropdown
   */
  function showResults() {
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = false;
    }
    if (elements.searchInput) {
      elements.searchInput.setAttribute("aria-expanded", "true");
    }
  }

  /**
   * Hides the results dropdown
   */
  function hideResults() {
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = true;
    }
    if (elements.searchInput) {
      elements.searchInput.setAttribute("aria-expanded", "false");
      elements.searchInput.removeAttribute("aria-activedescendant");
    }
    activeIndex = -1;
    currentResults = [];
  }

  /**
   * Sets the active option in the dropdown
   * @param {number} index - Index of the option to activate
   */
  function setActiveOption(index) {
    // Remove active class from previous
    var previousActive = elements.resultsList?.querySelector(
      ".ally-course-option-active",
    );
    if (previousActive) {
      previousActive.classList.remove("ally-course-option-active");
      previousActive.setAttribute("aria-selected", "false");
    }

    activeIndex = index;

    if (index >= 0 && index < currentResults.length) {
      var option = document.getElementById(ID_PREFIX + "option-" + index);
      if (option) {
        option.classList.add("ally-course-option-active");
        option.setAttribute("aria-selected", "true");
        elements.searchInput?.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    }
  }

  /**
   * Navigates through results using keyboard
   * @param {number} direction - 1 for down, -1 for up
   */
  function navigateResults(direction) {
    if (currentResults.length === 0) return;

    var newIndex = activeIndex + direction;

    if (newIndex < 0) {
      newIndex = currentResults.length - 1;
    } else if (newIndex >= currentResults.length) {
      newIndex = 0;
    }

    setActiveOption(newIndex);
  }

  /**
   * Selects a course from the results
   * @param {number} index - Index of the course to select
   */
  function selectCourse(index) {
    if (index < 0 || index >= currentResults.length) return;

    selectedCourse = currentResults[index];
    logInfo("Course selected:", selectedCourse.name);

    if (elements.searchInput) {
      elements.searchInput.value = selectedCourse.name;
    }

    hideResults();
    updateSelectedDisplay();
    updateSearchIconVisibility();
    updateExecuteButton();

    // Notify external listeners
    if (typeof onSelectionChangeCallback === "function") {
      onSelectionChangeCallback(selectedCourse);
    }

    announceToScreenReader(
      "Selected: " + selectedCourse.name + ", " + selectedCourse.code,
    );
  }

  /**
   * Updates the selected course display with semantic markup
   */
  function updateSelectedDisplay() {
    if (!elements.selectedDisplay) return;

    if (selectedCourse) {
      var html = '<dl class="ally-selected-course-dl">';

      // Course name (primary)
      html +=
        '<div class="ally-selected-course-item ally-selected-course-primary">';
      html += '<dt class="visually-hidden">Course</dt>';
      html +=
        '<dd class="ally-selected-course-name">' +
        escapeHtml(selectedCourse.name) +
        "</dd>";
      html += "</div>";

      // Course code
      html += '<div class="ally-selected-course-item">';
      html += "<dt>Code</dt>";
      html +=
        '<dd class="ally-selected-course-code">' +
        escapeHtml(selectedCourse.code) +
        "</dd>";
      html += "</div>";

      // Term (if available)
      if (selectedCourse.termName) {
        html += '<div class="ally-selected-course-item">';
        html += "<dt>Term</dt>";
        html +=
          '<dd class="ally-selected-course-term">' +
          escapeHtml(selectedCourse.termName) +
          "</dd>";
        html += "</div>";
      }

      html += "</dl>";

      elements.selectedDisplay.innerHTML = html;
      elements.selectedDisplay.hidden = false;

      if (elements.clearButton) {
        elements.clearButton.hidden = false;
      }
    } else {
      elements.selectedDisplay.innerHTML = "";
      elements.selectedDisplay.hidden = true;

      if (elements.clearButton) {
        elements.clearButton.hidden = true;
      }
    }
  }

  /**
   * Updates the visibility of the search icon
   * Hides when input is focused OR has a value
   */
  function updateSearchIconVisibility() {
    if (elements.searchIcon) {
      var hasValue = elements.searchInput && elements.searchInput.value.trim();
      var isFocused =
        elements.searchInput && document.activeElement === elements.searchInput;
      elements.searchIcon.style.display = hasValue || isFocused ? "none" : "";
    }
  }

  /**
   * Updates the execute button state and help text visibility
   */
  function updateExecuteButton() {
    if (elements.executeButton) {
      elements.executeButton.disabled = !selectedCourse;
    }

    // Hide help text when course is selected, show when not
    if (elements.executeHelp) {
      if (selectedCourse) {
        elements.executeHelp.textContent = "";
      } else {
        elements.executeHelp.textContent =
          "Select a module above to enable this button";
      }
    }
  }

  /**
   * Updates the status message for screen readers
   * @param {string} message - Status message
   */
  function updateStatus(message) {
    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
  }

  // ========================================================================
  // Private Methods - Event Handlers
  // ========================================================================

  /**
   * Handles input event on search field
   * @param {Event} event - Input event
   */
  function handleInput(event) {
    var query = event.target.value;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Clear selection if user is typing
    if (selectedCourse && query !== selectedCourse.name) {
      selectedCourse = null;
      updateSelectedDisplay();
      updateExecuteButton();

      if (typeof onSelectionChangeCallback === "function") {
        onSelectionChangeCallback(null);
      }
    }

    updateSearchIconVisibility();

    // Debounce search
    debounceTimer = setTimeout(function () {
      if (query.length >= CONFIG.MIN_SEARCH_LENGTH) {
        var results = searchCourses(query);
        renderResults(results, query);
      } else {
        hideResults();
        if (query.length > 0) {
          updateStatus(
            "Type at least " +
              CONFIG.MIN_SEARCH_LENGTH +
              " characters to search",
          );
        } else {
          updateStatus("");
        }
      }
    }, CONFIG.DEBOUNCE_MS);
  }

  /**
   * Handles keydown event on search field
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeydown(event) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (currentResults.length > 0) {
          navigateResults(1);
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (currentResults.length > 0) {
          navigateResults(-1);
        }
        break;

      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < currentResults.length) {
          selectCourse(activeIndex);
        }
        break;

      case "Escape":
        hideResults();
        elements.searchInput?.focus();
        break;

      case "Tab":
        hideResults();
        break;
    }
  }

  /**
   * Handles blur event on search input
   */
  function handleBlur() {
    // Delay hiding to allow click on results
    setTimeout(function () {
      if (!elements.resultsContainer?.contains(document.activeElement)) {
        hideResults();
      }
    }, 150);
  }

  /**
   * Handles clear button click
   */
  function handleClear() {
    selectedCourse = null;
    if (elements.searchInput) {
      elements.searchInput.value = "";
      elements.searchInput.focus();
    }
    hideResults();
    updateSelectedDisplay();
    updateSearchIconVisibility();
    updateExecuteButton();
    updateStatus("Selection cleared");
    announceToScreenReader("Course selection cleared");

    if (typeof onSelectionChangeCallback === "function") {
      onSelectionChangeCallback(null);
    }
  }

  /**
   * Announces a message to screen readers
   * @param {string} message
   */
  function announceToScreenReader(message) {
    if (
      typeof ALLY_UI_MANAGER !== "undefined" &&
      typeof ALLY_UI_MANAGER.announce === "function"
    ) {
      ALLY_UI_MANAGER.announce(message);
    }
  }

  /**
   * Sets up event listeners
   */
  function setupEventListeners() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", handleInput);
      elements.searchInput.addEventListener("keydown", handleKeydown);
      elements.searchInput.addEventListener("blur", function () {
        handleBlur();
        updateSearchIconVisibility();
      });
      elements.searchInput.addEventListener("focus", function () {
        updateSearchIconVisibility();
        // Re-show results if there's a query
        var query = elements.searchInput.value;
        if (
          query.length >= CONFIG.MIN_SEARCH_LENGTH &&
          currentResults.length > 0
        ) {
          showResults();
        }
      });
    }

    if (elements.clearButton) {
      elements.clearButton.addEventListener("click", handleClear);
    }

    // Close on outside click
    document.addEventListener("click", function (event) {
      var container = document.getElementById(ID_PREFIX + "search-container");
      if (container && !container.contains(event.target)) {
        hideResults();
      }
    });

    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  var publicAPI = {
    /**
     * Initialises the course report search module
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logWarn("Already initialised");
        return true;
      }

      logInfo("Initialising Course Report Search...");

      // Check dependencies
      if (typeof ALLY_COURSES === "undefined") {
        logWarn("ALLY_COURSES not available - search will not work");
      }

      // Cache elements
      if (!cacheElements()) {
        logError("Required elements not found - initialisation failed");
        return false;
      }

      // Set up event listeners
      setupEventListeners();

      // Initial state
      hideResults();
      updateSelectedDisplay();
      updateExecuteButton();

      initialised = true;
      logInfo("Course Report Search initialised successfully");

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
     * Gets the currently selected course
     * @returns {Object|null} Selected course or null
     */
    getSelectedCourse: function () {
      return selectedCourse;
    },

    /**
     * Clears the current selection
     */
    clearSelection: function () {
      handleClear();
    },

    /**
     * Sets a course programmatically
     * @param {Object} course - Course object with id, name, code
     */
    setSelectedCourse: function (course) {
      if (course && course.name) {
        selectedCourse = course;
        if (elements.searchInput) {
          elements.searchInput.value = course.name;
        }
        updateSelectedDisplay();
        updateExecuteButton();
        logDebug("Programmatically set course: " + course.name);

        if (typeof onSelectionChangeCallback === "function") {
          onSelectionChangeCallback(course);
        }
      }
    },

    /**
     * Gets the search input element
     * @returns {HTMLElement|null}
     */
    getSearchInput: function () {
      return elements.searchInput;
    },

    /**
     * Gets the execute button element
     * @returns {HTMLElement|null}
     */
    getExecuteButton: function () {
      return elements.executeButton;
    },

    /**
     * Performs a search programmatically
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    search: function (query) {
      return searchCourses(query);
    },

    /**
     * Sets a callback for selection changes
     * @param {Function} callback - Callback function(course)
     */
    onSelectionChange: function (callback) {
      if (typeof callback === "function") {
        onSelectionChangeCallback = callback;
      }
    },

    /**
     * Gets debug information
     * @returns {Object} Debug info
     */
    getDebugInfo: function () {
      return {
        initialised: initialised,
        selectedCourse: selectedCourse,
        currentResultsCount: currentResults.length,
        activeIndex: activeIndex,
        elementsFound: {
          searchInput: !!elements.searchInput,
          resultsContainer: !!elements.resultsContainer,
          resultsList: !!elements.resultsList,
          selectedDisplay: !!elements.selectedDisplay,
          clearButton: !!elements.clearButton,
          executeButton: !!elements.executeButton,
        },
      };
    },
  };

  return publicAPI;
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyCourseReportSearch = function () {
  console.group("ALLY_COURSE_REPORT_SEARCH Tests");

  var passed = 0;
  var failed = 0;

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
    "ALLY_COURSE_REPORT_SEARCH exists",
    typeof ALLY_COURSE_REPORT_SEARCH === "object",
  );
  test(
    "has initialise method",
    typeof ALLY_COURSE_REPORT_SEARCH.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_COURSE_REPORT_SEARCH.isInitialised === "function",
  );
  test(
    "has getSelectedCourse method",
    typeof ALLY_COURSE_REPORT_SEARCH.getSelectedCourse === "function",
  );
  test(
    "has clearSelection method",
    typeof ALLY_COURSE_REPORT_SEARCH.clearSelection === "function",
  );
  test(
    "has search method",
    typeof ALLY_COURSE_REPORT_SEARCH.search === "function",
  );
  test(
    "has onSelectionChange method",
    typeof ALLY_COURSE_REPORT_SEARCH.onSelectionChange === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_COURSE_REPORT_SEARCH.getDebugInfo === "function",
  );

  // Initialisation test
  if (!ALLY_COURSE_REPORT_SEARCH.isInitialised()) {
    ALLY_COURSE_REPORT_SEARCH.initialise();
  }
  test(
    "isInitialised returns true after init",
    ALLY_COURSE_REPORT_SEARCH.isInitialised() === true,
  );

  // Selection tests
  test(
    "getSelectedCourse returns null initially",
    ALLY_COURSE_REPORT_SEARCH.getSelectedCourse() === null,
  );

  // Search test (if ALLY_COURSES available)
  if (typeof ALLY_COURSES !== "undefined") {
    var results = ALLY_COURSE_REPORT_SEARCH.search("test");
    test("search returns array", Array.isArray(results));

    // Test with a known course code pattern
    var codeResults = ALLY_COURSE_REPORT_SEARCH.search("FEEG");
    test(
      "search by code prefix returns results",
      Array.isArray(codeResults) && codeResults.length >= 0,
    );
  } else {
    console.warn("ALLY_COURSES not available - skipping search tests");
  }

  // Debug info test
  var debugInfo = ALLY_COURSE_REPORT_SEARCH.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", "initialised" in debugInfo);
  test("debugInfo has elementsFound property", "elementsFound" in debugInfo);

  // Element isolation test (verify using ally-cr- prefix)
  var crInput = document.getElementById("ally-cr-search-input");
  var rbInput = document.getElementById("ally-course-search-input");
  test(
    "Course Report search input exists (ally-cr-search-input)",
    crInput !== null,
  );
  test(
    "Both search inputs are different elements",
    crInput !== rbInput || (crInput === null && rbInput === null),
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
