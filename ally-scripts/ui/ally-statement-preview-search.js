/**
 * @fileoverview Ally Statement Preview - Course Search Module
 * @module AllyStatementPreviewSearch
 * @requires ALLY_COURSES
 * @requires ALLY_LOOKUP
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since Phase 7B
 *
 * @description
 * Provides autocomplete course search functionality specifically for the Statement Preview section.
 * This is adapted from ALLY_COURSE_REPORT_SEARCH with ally-sp- prefixed element IDs
 * to allow independent operation.
 *
 * Key Features:
 * - Autocomplete search with debouncing
 * - Searches both course name and course code
 * - Keyboard navigation for results
 * - Performance optimised for large datasets
 * - Full accessibility support (ARIA combobox pattern)
 * - Isolated from other course search components
 *
 * @example
 * ALLY_STATEMENT_PREVIEW_SEARCH.initialise();
 * const selected = ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse();
 */

const ALLY_STATEMENT_PREVIEW_SEARCH = (function () {
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
      console.error("[AllySPSearch] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllySPSearch] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllySPSearch] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllySPSearch] " + message, ...args);
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

  // Element ID prefix for Statement Preview (avoids conflicts with other searches)
  const ID_PREFIX = "ally-sp-";

  // ========================================================================
  // Private State
  // ========================================================================

  let initialised = false;
  let listenersAttached = false;
  let debounceTimer = null;
  let selectedCourse = null;
  let activeIndex = -1;
  let currentResults = [];

  // Callbacks for external integration
  let onSelectionChangeCallback = null;

  const elements = {
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

  /**
   * Caches DOM element references
   * @returns {boolean} True if all required elements found
   */
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
    const allFound =
      elements.searchInput && elements.resultsContainer && elements.resultsList;

    if (!allFound) {
      logWarn("Some statement preview search elements not found in DOM");
      logDebug("Elements found:", {
        searchInput: !!elements.searchInput,
        resultsContainer: !!elements.resultsContainer,
        resultsList: !!elements.resultsList,
        selectedDisplay: !!elements.selectedDisplay,
        clearButton: !!elements.clearButton,
        statusMessage: !!elements.statusMessage,
        searchIcon: !!elements.searchIcon,
        executeButton: !!elements.executeButton,
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

    const normalised = query.toLowerCase().trim();
    const results = [];
    const seenIds = new Set();

    // First, try the built-in code search (fast, indexed)
    if (typeof ALLY_COURSES.searchCoursesByCode === "function") {
      const codeMatches = ALLY_COURSES.searchCoursesByCode(query);
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
      const courseIds = Object.keys(ALLY_COURSES.courses);

      for (let i = 0; i < courseIds.length; i++) {
        const id = courseIds[i];
        const course = ALLY_COURSES.courses[id];

        // Skip if already found via code search
        if (seenIds.has(id)) continue;

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
   * Calculates relevance score for a search result
   * Higher score = better match
   * @param {Object} result - Course result object
   * @param {string} query - Original search query (normalised)
   * @returns {number} Relevance score
   */
  function calculateRelevanceScore(result, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const codeLower = (result.code || "").toLowerCase();
    const nameLower = (result.name || "").toLowerCase();

    // Extract base code (e.g., "FEEG1003" from "FEEG1003-29852-25-26")
    const baseCode = codeLower.split("-")[0];

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

    const normalised = (query || "").toLowerCase().trim();

    return results.slice().sort(function (a, b) {
      // Primary: Relevance score (descending)
      const relevanceA = calculateRelevanceScore(a, normalised);
      const relevanceB = calculateRelevanceScore(b, normalised);
      if (relevanceB !== relevanceA) {
        return relevanceB - relevanceA;
      }

      // Secondary: Term recency (descending - most recent first)
      const sortOrderA = getTermSortOrder(a.termId);
      const sortOrderB = getTermSortOrder(b.termId);
      if (sortOrderB !== sortOrderA) {
        return sortOrderB - sortOrderA;
      }

      // Tertiary: Code alphabetically (ascending)
      const codeA = (a.code || "").toLowerCase();
      const codeB = (b.code || "").toLowerCase();
      return codeA.localeCompare(codeB);
    });
  }

  // ========================================================================
  // Private Methods - Results Display
  // ========================================================================

  /**
   * Shows search results in the dropdown
   * @param {Array} results - Search results
   * @param {string} query - Original search query for highlighting
   */
  function showResults(results, query) {
    if (!elements.resultsList || !elements.resultsContainer) return;

    currentResults = results;
    activeIndex = -1;

    // Clear existing results
    elements.resultsList.innerHTML = "";

    if (results.length === 0) {
      elements.resultsContainer.hidden = true;
      updateStatus("No courses found");
      return;
    }

    // Build result items
    results.forEach(function (course, index) {
      const li = document.createElement("li");
      li.id = ID_PREFIX + "option-" + index;
      li.className = "ally-course-search-option";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.index = index;

      // Create content with highlighting
      const codeSpan = document.createElement("span");
      codeSpan.className = "ally-course-code";
      codeSpan.innerHTML = highlightMatch(course.code, query);

      const nameSpan = document.createElement("span");
      nameSpan.className = "ally-course-name";
      nameSpan.innerHTML = highlightMatch(course.name, query);

      li.appendChild(codeSpan);
      li.appendChild(document.createTextNode(" "));
      li.appendChild(nameSpan);

      // Add term name if available
      if (course.termName) {
        const termSpan = document.createElement("span");
        termSpan.className = "ally-course-term";
        termSpan.textContent = " (" + course.termName + ")";
        li.appendChild(termSpan);
      }

      // Click handler
      li.addEventListener("click", function () {
        selectCourse(course);
      });

      elements.resultsList.appendChild(li);
    });

    // Show results and update ARIA
    elements.resultsContainer.hidden = false;
    if (elements.searchInput) {
      elements.searchInput.setAttribute("aria-expanded", "true");
    }

    updateStatus(
      results.length + " courses found. Use arrow keys to navigate.",
    );
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
   * Highlights matching text in a string
   * @param {string} text - Text to highlight
   * @param {string} query - Query to highlight
   * @returns {string} HTML with highlighted matches
   */
  function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || "");

    const escaped = escapeHtml(text);
    const queryEscaped = escapeHtml(query);
    const regex = new RegExp("(" + escapeRegex(queryEscaped) + ")", "gi");

    return escaped.replace(
      regex,
      '<mark class="' + CONFIG.HIGHLIGHT_CLASS + '">$1</mark>',
    );
  }

  /**
   * Escapes HTML entities
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escapes special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Updates the screen reader status message
   * @param {string} message - Message to announce
   */
  function updateStatus(message) {
    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
  }

  // ========================================================================
  // Private Methods - Selection
  // ========================================================================

  /**
   * Selects a course
   * @param {Object} course - Course to select
   */
  function selectCourse(course) {
    selectedCourse = course;
    logInfo("Course selected:", course.name);

    // Update input value
    if (elements.searchInput) {
      elements.searchInput.value = course.code + " - " + course.name;
    }

    // Hide results
    hideResults();

    // Update selected display
    updateSelectedDisplay();

    // Update execute button
    updateExecuteButton();

    // Show clear button
    if (elements.clearButton) {
      elements.clearButton.hidden = false;
    }

    // Announce selection
    updateStatus("Selected: " + course.name);

    // Trigger callback
    if (typeof onSelectionChangeCallback === "function") {
      onSelectionChangeCallback(course);
    }
  }

  /**
   * Updates the selected course display with semantic structure
   */
  function updateSelectedDisplay() {
    if (!elements.selectedDisplay) return;

    if (selectedCourse) {
      let html = '<dl class="ally-selected-course-dl">';

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
    } else {
      elements.selectedDisplay.innerHTML = "";
      elements.selectedDisplay.hidden = true;
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
          "Select a module first to enable this button";
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
   * Clears the current selection
   */
  function handleClear() {
    selectedCourse = null;

    if (elements.searchInput) {
      elements.searchInput.value = "";
      elements.searchInput.focus();
    }

    if (elements.clearButton) {
      elements.clearButton.hidden = true;
    }

    hideResults();
    updateSelectedDisplay();
    updateSearchIconVisibility();
    updateExecuteButton();
    updateStatus("Selection cleared");

    // Announce to screen readers
    if (
      typeof ALLY_UI_MANAGER !== "undefined" &&
      typeof ALLY_UI_MANAGER.announce === "function"
    ) {
      ALLY_UI_MANAGER.announce("Course selection cleared");
    }

    logDebug("Selection cleared");

    // Trigger callback
    if (typeof onSelectionChangeCallback === "function") {
      onSelectionChangeCallback(null);
    }
  }
  // ========================================================================
  // Private Methods - Keyboard Navigation
  // ========================================================================

  /**
   * Handles keyboard navigation in the results list
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleKeydown(event) {
    if (!currentResults.length && event.key !== "Escape") return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        navigateResults(1);
        break;

      case "ArrowUp":
        event.preventDefault();
        navigateResults(-1);
        break;

      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          selectCourse(currentResults[activeIndex]);
        }
        break;

      case "Escape":
        event.preventDefault();
        hideResults();
        break;

      case "Tab":
        hideResults();
        break;
    }
  }

  /**
   * Navigates through results list
   * @param {number} direction - 1 for down, -1 for up
   */
  function navigateResults(direction) {
    if (!currentResults.length) return;

    // Calculate new index
    let newIndex = activeIndex + direction;

    // Wrap around
    if (newIndex < 0) {
      newIndex = currentResults.length - 1;
    } else if (newIndex >= currentResults.length) {
      newIndex = 0;
    }

    // Update active index
    activeIndex = newIndex;

    // Update visual state
    const options = elements.resultsList.querySelectorAll('[role="option"]');
    options.forEach(function (option, index) {
      if (index === activeIndex) {
        option.classList.add("ally-course-search-option-active");
        option.setAttribute("aria-selected", "true");
        option.scrollIntoView({ block: "nearest" });

        // Update aria-activedescendant
        if (elements.searchInput) {
          elements.searchInput.setAttribute("aria-activedescendant", option.id);
        }
      } else {
        option.classList.remove("ally-course-search-option-active");
        option.setAttribute("aria-selected", "false");
      }
    });
  }

  // ========================================================================
  // Private Methods - Event Handling
  // ========================================================================

  /**
   * Handles input changes with debouncing
   * @param {Event} event - Input event
   */
  function handleInput(event) {
    const query = event.target.value.trim();

    // Clear any existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Show/hide clear button
    if (elements.clearButton) {
      elements.clearButton.hidden = !query;
    }

    // Update search icon visibility
    updateSearchIconVisibility();

    // Debounce the search
    debounceTimer = setTimeout(function () {
      if (query.length >= CONFIG.MIN_SEARCH_LENGTH) {
        const results = searchCourses(query);
        showResults(results, query);
      } else {
        hideResults();
        if (query.length > 0) {
          updateStatus(
            "Type at least " +
              CONFIG.MIN_SEARCH_LENGTH +
              " characters to search",
          );
        }
      }
    }, CONFIG.DEBOUNCE_MS);
  }

  /**
   * Sets up all event listeners
   */
  function setupEventListeners() {
    // Guard against duplicate listener attachment during force reinitialisation
    if (listenersAttached) {
      logDebug("Event listeners already attached, skipping");
      return;
    }

    if (!elements.searchInput) {
      logError("Cannot set up events - search input not found");
      return;
    }

    // Input handler
    elements.searchInput.addEventListener("input", handleInput);

    // Keyboard navigation
    elements.searchInput.addEventListener("keydown", handleKeydown);

    // Focus handler - show results if there's a query, update icon
    elements.searchInput.addEventListener("focus", function () {
      updateSearchIconVisibility();
      const query = elements.searchInput.value.trim();
      if (
        query.length >= CONFIG.MIN_SEARCH_LENGTH &&
        currentResults.length > 0
      ) {
        elements.resultsContainer.hidden = false;
        elements.searchInput.setAttribute("aria-expanded", "true");
      }
    });

    // Blur handler - update icon visibility
    elements.searchInput.addEventListener("blur", function () {
      updateSearchIconVisibility();
    });

    // Clear button
    if (elements.clearButton) {
      elements.clearButton.addEventListener("click", handleClear);
    }

    // Close on outside click
    document.addEventListener("click", function (event) {
      const container = document.getElementById(ID_PREFIX + "search-container");
      if (container && !container.contains(event.target)) {
        hideResults();
      }
    });

    listenersAttached = true;
    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the statement preview search module
     * @param {boolean} force - Force reinitialisation even if already initialised
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function (force) {
      if (initialised && !force) {
        logWarn("Already initialised");
        return true;
      }

      // Preserve existing selection during force reinitialisation
      var preservedCourse = selectedCourse;

      // Reset transient state if forcing reinitialisation (but NOT selectedCourse)
      if (force) {
        initialised = false;
        activeIndex = -1;
        currentResults = [];
        logInfo("Forcing reinitialisation (preserving selected course)...");
      }

      logInfo("Initialising Statement Preview Search...");

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

      // Restore preserved course if we had one
      if (force && preservedCourse) {
        selectedCourse = preservedCourse;
        logDebug("Restored preserved course:", preservedCourse.name);
      }

      // Initial state - only update display if no existing content to preserve
      hideResults();

      if (elements.selectedDisplay) {
        var hasExistingContent =
          elements.selectedDisplay.innerHTML.trim().length > 0;
        if (!hasExistingContent) {
          updateSelectedDisplay();
        }
        // If has content, leave it as-is (preserved from previous session)
      }

      updateExecuteButton();

      initialised = true;
      logInfo("Statement Preview Search initialised successfully");

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
          elements.searchInput.value = course.code + " - " + course.name;
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
     * Resets the module to initial state
     */
    reset: function () {
      handleClear();
      logDebug("Module reset");
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

window.testAllyStatementPreviewSearch = function () {
  console.group("ALLY_STATEMENT_PREVIEW_SEARCH Tests");

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
    "ALLY_STATEMENT_PREVIEW_SEARCH exists",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH === "object",
  );
  test(
    "has initialise method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.isInitialised === "function",
  );
  test(
    "has getSelectedCourse method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse === "function",
  );
  test(
    "has clearSelection method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.clearSelection === "function",
  );
  test(
    "has setSelectedCourse method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.setSelectedCourse === "function",
  );
  test(
    "has search method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.search === "function",
  );
  test(
    "has onSelectionChange method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.onSelectionChange === "function",
  );
  test(
    "has reset method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.reset === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH.getDebugInfo === "function",
  );

  // Initialisation test
  if (!ALLY_STATEMENT_PREVIEW_SEARCH.isInitialised()) {
    ALLY_STATEMENT_PREVIEW_SEARCH.initialise();
  }
  test(
    "isInitialised returns true after init",
    ALLY_STATEMENT_PREVIEW_SEARCH.isInitialised() === true,
  );

  // Selection tests
  test(
    "getSelectedCourse returns null initially",
    ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse() === null,
  );

  // Search test (if ALLY_COURSES available)
  if (typeof ALLY_COURSES !== "undefined") {
    const results = ALLY_STATEMENT_PREVIEW_SEARCH.search("test");
    test("search returns array", Array.isArray(results));

    // Test with a known course code pattern
    const codeResults = ALLY_STATEMENT_PREVIEW_SEARCH.search("FEEG");
    test(
      "search by code prefix returns results",
      Array.isArray(codeResults) && codeResults.length >= 0,
    );
  } else {
    console.warn("ALLY_COURSES not available - skipping search tests");
  }

  // Debug info test
  const debugInfo = ALLY_STATEMENT_PREVIEW_SEARCH.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", "initialised" in debugInfo);
  test("debugInfo has elementsFound property", "elementsFound" in debugInfo);

  // Element isolation test (verify using ally-sp- prefix)
  const spInput = document.getElementById("ally-sp-search-input");
  const crInput = document.getElementById("ally-cr-search-input");
  test(
    "Statement Preview search input exists (ally-sp-search-input)",
    spInput !== null,
  );
  test(
    "Both search inputs are different elements",
    spInput !== crInput || (spInput === null && crInput === null),
  );

  // Programmatic selection test
  const mockCourse = {
    id: "test-123",
    name: "Test Course",
    code: "TEST101",
    termId: "202401",
  };

  ALLY_STATEMENT_PREVIEW_SEARCH.setSelectedCourse(mockCourse);
  const selected = ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse();
  test(
    "setSelectedCourse works correctly",
    selected !== null && selected.id === "test-123",
  );

  // Clear selection test
  ALLY_STATEMENT_PREVIEW_SEARCH.clearSelection();
  test(
    "clearSelection works correctly",
    ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse() === null,
  );

  // Callback test
  let callbackFired = false;
  ALLY_STATEMENT_PREVIEW_SEARCH.onSelectionChange(function (course) {
    callbackFired = true;
  });
  ALLY_STATEMENT_PREVIEW_SEARCH.setSelectedCourse(mockCourse);
  test("onSelectionChange callback fires", callbackFired === true);

  // Clean up
  ALLY_STATEMENT_PREVIEW_SEARCH.clearSelection();

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
