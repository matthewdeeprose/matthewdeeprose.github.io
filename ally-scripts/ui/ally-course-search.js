/**
 * @fileoverview Ally Accessibility Reporting Tool - Course Search Module
 * @module AllyCourseSearch
 * @requires ALLY_COURSES
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides autocomplete course search functionality using the courses lookup data.
 * Allows users to quickly find and filter by specific courses using name or code.
 *
 * Key Features:
 * - Autocomplete search with debouncing
 * - Searches both course name and course code
 * - Keyboard navigation for results
 * - Performance optimised for large datasets
 * - Full accessibility support (ARIA combobox pattern)
 *
 * @example
 * ALLY_COURSE_SEARCH.initialise();
 * const selected = ALLY_COURSE_SEARCH.getSelectedCourse();
 */

const ALLY_COURSE_SEARCH = (function () {
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
      console.error("[AllyCourseSearch] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyCourseSearch] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyCourseSearch] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyCourseSearch] " + message, ...args);
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

  // ========================================================================
  // Private State
  // ========================================================================

  let initialised = false;
  let debounceTimer = null;
  let selectedCourse = null;
  let activeIndex = -1;
  let currentResults = [];

  const elements = {
    searchInput: null,
    resultsContainer: null,
    resultsList: null,
    selectedDisplay: null,
    clearButton: null,
    statusMessage: null,
    searchIcon: null,
  };

  // ========================================================================
  // Private Methods - Element Caching
  // ========================================================================

  function cacheElements() {
    elements.searchInput = document.getElementById("ally-course-search-input");
    elements.resultsContainer = document.getElementById(
      "ally-course-search-results",
    );
    elements.resultsList = document.getElementById(
      "ally-course-search-listbox",
    );
    elements.selectedDisplay = document.getElementById("ally-course-selected");
    elements.clearButton = document.getElementById("ally-course-search-clear");
    elements.statusMessage = document.getElementById(
      "ally-course-search-status",
    );
    elements.searchIcon = document.querySelector(
      "#ally-course-search-container .ally-search-icon",
    );

    const allFound =
      elements.searchInput && elements.resultsContainer && elements.resultsList;

    if (!allFound) {
      logWarn("Some course search elements not found in DOM");
    }

    return allFound;
  }
  // ========================================================================
  // Private Methods - Search
  // ========================================================================

  /**
   * Searches courses by name or code
   * @param {string} query - Search query
   * @param {string|null} filterTermId - Optional term ID to filter results
   * @returns {Array} Matching courses (limited to MAX_RESULTS)
   */
  function searchCourses(query, filterTermId) {
    if (!query || query.length < CONFIG.MIN_SEARCH_LENGTH) {
      return [];
    }

    if (typeof ALLY_COURSES === "undefined") {
      logWarn("ALLY_COURSES not available");
      return [];
    }

    const normalised = query.toLowerCase().trim();
    const results = [];
    const seenIds = new Set();

    // First, try the built-in code search (fast, indexed)
    if (typeof ALLY_COURSES.searchCoursesByCode === "function") {
      const codeMatches = ALLY_COURSES.searchCoursesByCode(query);
      if (Array.isArray(codeMatches)) {
        codeMatches.forEach(function (match) {
          if (!seenIds.has(match.courseId)) {
            // Apply term filter if specified
            if (filterTermId && match.termId !== filterTermId) {
              return; // Skip courses not in selected term
            }

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
      const courseIds = Object.keys(ALLY_COURSES.courses);

      for (let i = 0; i < courseIds.length; i++) {
        const id = courseIds[i];
        const course = ALLY_COURSES.courses[id];

        // Skip if already found via code search
        if (seenIds.has(id)) continue;

        // Apply term filter if specified
        if (filterTermId && course.termId !== filterTermId) {
          continue; // Skip courses not in selected term
        }

        // Check for name match
        const nameMatch =
          course.courseName &&
          course.courseName.toLowerCase().includes(normalised);

        // Also check code if not found via indexed search
        const codeMatch =
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
    const sortedResults = sortResultsByTermRecency(results, query);
    const limitedResults = sortedResults.slice(0, CONFIG.MAX_RESULTS);

    logDebug(
      "Found " +
        results.length +
        " courses for query: " +
        query +
        (filterTermId ? " (filtered to term: " + filterTermId + ")" : "") +
        ", returning " +
        limitedResults.length +
        " sorted by relevance and recency",
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
      const name = ALLY_LOOKUP.getTermName(termId);
      if (name) return name;
    }

    // Fallback to getTerm (returns object)
    if (typeof ALLY_LOOKUP.getTerm === "function") {
      const term = ALLY_LOOKUP.getTerm(termId);
      return term ? term.name || term.termName || "" : "";
    }

    return "";
  }

  /**
   * Highlights matching text in a string
   * @param {string} text - Original text
   * @param {string} query - Search query to highlight
   * @returns {string} HTML with highlighted matches
   */
  function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || "");

    const escaped = escapeHtml(text);
    const queryEscaped = escapeHtml(query);
    const regex = new RegExp(
      "(" + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );

    return escaped.replace(
      regex,
      '<mark class="' + CONFIG.HIGHLIGHT_CLASS + '">$1</mark>',
    );
  }

  /**
   * Escapes HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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
      const term = ALLY_LOOKUP.getTerm(termId);
      if (term && typeof term.sortOrder === "number") {
        return term.sortOrder;
      }
    }

    return -999;
  }

  /**
   * Gets the currently selected term ID from the term dropdown
   * @returns {string|null} Selected term ID or null if "All terms" selected
   */
  function getSelectedTermFilter() {
    const termSelect = document.getElementById("ally-term-select");
    if (termSelect && termSelect.value) {
      return termSelect.value;
    }
    return null;
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

  // ========================================================================
  // Private Methods - UI Updates
  // ========================================================================

  /**
   * Renders search results in the listbox
   * @param {Array} results - Search results
   * @param {string} query - Original query for highlighting
   */
  function renderResults(results, query) {
    if (!elements.resultsList) return;

    currentResults = results;
    activeIndex = -1;

    if (results.length === 0) {
      elements.resultsList.innerHTML = "";
      hideResults();
      updateStatus("No courses found");
      return;
    }

    const html = results
      .map(function (course, index) {
        const highlightedName = highlightMatch(course.name, query);
        const highlightedCode = highlightMatch(course.code, query);

        // Build accessible label with full context
        const accessibleLabel =
          escapeHtml(course.name) +
          ", " +
          escapeHtml(course.code) +
          (course.termName ? ", " + escapeHtml(course.termName) : "");

        return (
          '<li id="ally-course-option-' +
          index +
          '" ' +
          'class="ally-course-search-option" ' +
          'role="option" ' +
          'aria-selected="false" ' +
          'aria-label="' +
          accessibleLabel +
          '" ' +
          'data-index="' +
          index +
          '">' +
          '<span class="ally-course-option-name">' +
          highlightedName +
          "</span>" +
          '<span class="ally-course-option-code">' +
          highlightedCode +
          "</span>" +
          (course.termName
            ? '<span class="ally-course-option-term">' +
              escapeHtml(course.termName) +
              "</span>"
            : "") +
          "</li>"
        );
      })
      .join("");

    elements.resultsList.innerHTML = html;
    showResults();
    updateStatus(
      results.length + " courses found. Use arrow keys to navigate.",
    );

    // Add click handlers to results
    const options = elements.resultsList.querySelectorAll(
      ".ally-course-search-option",
    );
    options.forEach(function (option) {
      option.addEventListener("click", function () {
        const index = parseInt(option.getAttribute("data-index"), 10);
        selectCourse(index);
      });
    });
  }

  /**
   * Shows the results dropdown
   */
  function showResults() {
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = false;
      elements.searchInput?.setAttribute("aria-expanded", "true");
    }
  }

  /**
   * Hides the results dropdown
   */
  function hideResults() {
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = true;
      elements.searchInput?.setAttribute("aria-expanded", "false");
      elements.searchInput?.removeAttribute("aria-activedescendant");
    }
    activeIndex = -1;
    currentResults = [];
  }

  /**
   * Updates the live status message for screen readers
   * @param {string} message - Status message
   */
  function updateStatus(message) {
    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
  }

  /**
   * Updates the selected course display
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

  // ========================================================================
  // Private Methods - Selection & Navigation
  // ========================================================================

  /**
   * Selects a course from the results
   * @param {number} index - Index in currentResults
   */
  function selectCourse(index) {
    if (index < 0 || index >= currentResults.length) return;

    selectedCourse = currentResults[index];
    logDebug("Selected course: " + selectedCourse.name);

    // Update input with selected course
    if (elements.searchInput) {
      elements.searchInput.value = selectedCourse.name;
    }

    hideResults();
    updateSelectedDisplay();
    updateStatus("Selected: " + selectedCourse.name);

    // Announce to screen reader
    announceToScreenReader(
      "Selected course: " + selectedCourse.name + ", " + selectedCourse.code,
    );
  }

  /**
   * Navigates through results with keyboard
   * @param {number} direction - 1 for down, -1 for up
   */
  function navigateResults(direction) {
    if (currentResults.length === 0) return;

    // Remove previous active state
    if (activeIndex >= 0) {
      const prevOption = document.getElementById(
        "ally-course-option-" + activeIndex,
      );
      if (prevOption) {
        prevOption.setAttribute("aria-selected", "false");
        prevOption.classList.remove("ally-course-option-active");
      }
    }

    // Calculate new index
    activeIndex += direction;
    if (activeIndex < 0) activeIndex = currentResults.length - 1;
    if (activeIndex >= currentResults.length) activeIndex = 0;

    // Set new active state
    const newOption = document.getElementById(
      "ally-course-option-" + activeIndex,
    );
    if (newOption) {
      newOption.setAttribute("aria-selected", "true");
      newOption.classList.add("ally-course-option-active");
      newOption.scrollIntoView({ block: "nearest" });

      elements.searchInput?.setAttribute(
        "aria-activedescendant",
        "ally-course-option-" + activeIndex,
      );

      // Announce current option for screen readers (position + details)
      const course = currentResults[activeIndex];
      if (course) {
        const position = activeIndex + 1 + " of " + currentResults.length;
        const announcement =
          course.name +
          ", " +
          course.code +
          (course.termName ? ", " + course.termName : "") +
          ". " +
          position;
        updateStatus(announcement);
      }
    }
  }

  // ========================================================================
  // Private Methods - Event Handlers
  // ========================================================================

  /**
   * Updates search icon visibility based on input focus and content
   * Hides icon when input is focused or has text, shows when blurred and empty
   */
  function updateSearchIconVisibility() {
    if (elements.searchIcon && elements.searchInput) {
      var hasText = elements.searchInput.value.trim();
      var isFocused = document.activeElement === elements.searchInput;
      elements.searchIcon.style.display = hasText || isFocused ? "none" : "";
    }
  }

  /**
   * Handles input in the search field
   */
  function handleInput() {
    updateSearchIconVisibility();
    const query = elements.searchInput?.value || "";

    // Clear any pending search
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (query.length < CONFIG.MIN_SEARCH_LENGTH) {
      hideResults();
      if (query.length > 0) {
        updateStatus(
          "Type at least " + CONFIG.MIN_SEARCH_LENGTH + " characters to search",
        );
      } else {
        updateStatus("");
      }
      return;
    }

    // Debounce the search
    debounceTimer = setTimeout(function () {
      // Check if term filter is active
      const filterTermId = getSelectedTermFilter();
      const results = searchCourses(query, filterTermId);
      renderResultsWithFilter(results, query, filterTermId);
    }, CONFIG.DEBOUNCE_MS);
  }

  /**
   * Renders search results with optional term filter message
   * @param {Array} results - Search results
   * @param {string} query - Original query for highlighting
   * @param {string|null} filterTermId - Term ID if filtering, null otherwise
   */
  function renderResultsWithFilter(results, query, filterTermId) {
    renderResults(results, query);

    // Update status with filter information if applicable
    if (results.length > 0 && filterTermId) {
      const termName = getTermName(filterTermId);
      updateStatus(
        results.length +
          " courses found in " +
          termName +
          ". Use arrow keys to navigate.",
      );
    }
  }

  /**
   * Handles keyboard navigation
   * @param {KeyboardEvent} event
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
    updateStatus("Selection cleared");
    announceToScreenReader("Course selection cleared");
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
        const query = elements.searchInput.value;
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
      const container = document.getElementById("ally-course-search-container");
      if (container && !container.contains(event.target)) {
        hideResults();
      }
    });

    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the course search module
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logWarn("Already initialised");
        return true;
      }

      logInfo("Initialising Course Search...");

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

      initialised = true;
      logInfo("Course Search initialised successfully");

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
        logDebug("Programmatically set course: " + course.name);
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
     * Performs a search programmatically
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    search: function (query) {
      return searchCourses(query);
    },
  };

  return publicAPI;
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyCourseSearch = function () {
  console.group("ALLY_COURSE_SEARCH Tests");

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
  test("ALLY_COURSE_SEARCH exists", typeof ALLY_COURSE_SEARCH === "object");
  test(
    "has initialise method",
    typeof ALLY_COURSE_SEARCH.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_COURSE_SEARCH.isInitialised === "function",
  );
  test(
    "has getSelectedCourse method",
    typeof ALLY_COURSE_SEARCH.getSelectedCourse === "function",
  );
  test(
    "has clearSelection method",
    typeof ALLY_COURSE_SEARCH.clearSelection === "function",
  );
  test("has search method", typeof ALLY_COURSE_SEARCH.search === "function");

  // Initialisation test
  if (!ALLY_COURSE_SEARCH.isInitialised()) {
    ALLY_COURSE_SEARCH.initialise();
  }
  test(
    "isInitialised returns true after init",
    ALLY_COURSE_SEARCH.isInitialised() === true,
  );

  // Selection tests
  test(
    "getSelectedCourse returns null initially",
    ALLY_COURSE_SEARCH.getSelectedCourse() === null,
  );

  // Search test (if ALLY_COURSES available)
  if (typeof ALLY_COURSES !== "undefined") {
    const results = ALLY_COURSE_SEARCH.search("test");
    test("search returns array", Array.isArray(results));
  } else {
    console.warn("ALLY_COURSES not available - skipping search tests");
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
