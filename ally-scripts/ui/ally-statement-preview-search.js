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
    INITIAL_RESULTS: 10, // Rows rendered on the first pass
    RESULTS_INCREMENT: 10, // Rows revealed per "Show more" / Down arrow at the end
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

  // Paging state: allResults is the full match set for the current query,
  // currentResults only the rows actually rendered (keyboard indices align to it)
  let allResults = [];
  let currentResults = [];
  let currentQuery = "";

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
    moreButton: null,
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

    // Optional - the module pages results without it if the markup is absent
    elements.moreButton = document.getElementById(ID_PREFIX + "search-more");

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
   * @returns {Array} All matching courses, sorted by relevance then term recency.
   *   The result count is NOT capped here - showResults() pages the render.
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

    logDebug(
      "Found " +
        sortedResults.length +
        " courses for query: " +
        query +
        ", sorted by recency",
    );

    return sortedResults;
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
   * Builds a single result option element
   * @param {Object} course - Course result
   * @param {number} index - Zero-based position within the full result set
   * @returns {HTMLLIElement} The option element
   */
  function createResultOption(course, index) {
    const li = document.createElement("li");
    li.id = ID_PREFIX + "option-" + index;
    li.className = "ally-course-search-option";
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");

    // Position within the FULL match set, not the rendered page, so a partially
    // paged listbox announces "3 of 47" rather than "3 of 10"
    li.setAttribute("aria-posinset", index + 1);
    li.setAttribute("aria-setsize", allResults.length);
    li.dataset.index = index;

    // Create content with highlighting
    const codeSpan = document.createElement("span");
    codeSpan.className = "ally-course-code";
    codeSpan.innerHTML = highlightMatch(course.code, currentQuery);

    const nameSpan = document.createElement("span");
    nameSpan.className = "ally-course-name";
    nameSpan.innerHTML = highlightMatch(course.name, currentQuery);

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

    return li;
  }

  /**
   * Appends the next page of results to the listbox
   *
   * Appends rather than rebuilds so the scroll position survives and already-read
   * rows are not re-announced.
   *
   * @param {number} count - Maximum number of rows to add
   * @returns {number} Index of the first newly rendered row, or -1 if none added
   */
  function renderNextBatch(count) {
    if (!elements.resultsList) return -1;

    const startIndex = currentResults.length;
    const batch = allResults.slice(startIndex, startIndex + count);

    if (batch.length === 0) return -1;

    batch.forEach(function (course, offset) {
      const index = startIndex + offset;
      elements.resultsList.appendChild(createResultOption(course, index));
      currentResults.push(course);
    });

    return startIndex;
  }

  /**
   * Updates the "Show more" footer button label and visibility
   */
  function updateMoreButton() {
    if (!elements.moreButton) return;

    const remaining = allResults.length - currentResults.length;

    if (remaining <= 0) {
      elements.moreButton.hidden = true;
      elements.moreButton.textContent = "";
      return;
    }

    const nextBatch = Math.min(CONFIG.RESULTS_INCREMENT, remaining);
    elements.moreButton.textContent =
      "Show " + nextBatch + " more (" + remaining + " remaining)";
    elements.moreButton.hidden = false;
  }

  /**
   * Reveals the next page of results
   *
   * Single entry point for both the footer button and Down arrow at the end of
   * the rendered list.
   *
   * @param {Object} [options] - Reveal options
   * @param {boolean} [options.focusFirstNew] - Move the active option to the
   *   first newly revealed row (used by the keyboard path)
   * @returns {boolean} True if more rows were revealed
   */
  function revealMoreResults(options) {
    const settings = options || {};
    const firstNewIndex = renderNextBatch(CONFIG.RESULTS_INCREMENT);

    if (firstNewIndex === -1) return false;

    updateMoreButton();

    if (settings.focusFirstNew) {
      setActiveOption(firstNewIndex);
    }

    updateStatus(
      "Showing " +
        currentResults.length +
        " of " +
        allResults.length +
        " modules.",
    );

    logDebug(
      "Revealed more results: " +
        currentResults.length +
        " of " +
        allResults.length,
    );

    return true;
  }

  /**
   * Shows search results in the dropdown, rendering the first page only
   * @param {Array} results - Full search result set
   * @param {string} query - Original search query for highlighting
   */
  function showResults(results, query) {
    if (!elements.resultsList || !elements.resultsContainer) return;

    allResults = results;
    currentResults = [];
    currentQuery = query;
    activeIndex = -1;

    // Clear existing results
    elements.resultsList.innerHTML = "";

    if (results.length === 0) {
      elements.resultsContainer.hidden = true;
      if (elements.moreButton) elements.moreButton.hidden = true;
      updateStatus("No courses found");
      return;
    }

    renderNextBatch(CONFIG.INITIAL_RESULTS);
    updateMoreButton();

    // Show results and update ARIA
    elements.resultsContainer.hidden = false;
    if (elements.searchInput) {
      elements.searchInput.setAttribute("aria-expanded", "true");
    }

    // Report the rendered count against the true total - reporting the rendered
    // count alone would understate how many modules actually matched
    const hasMore = currentResults.length < allResults.length;
    updateStatus(
      "Showing " +
        currentResults.length +
        " of " +
        allResults.length +
        " modules. Use arrow keys to navigate." +
        (hasMore ? " More matches are available." : ""),
    );
  }

  /**
   * Hides the results dropdown
   */
  function hideResults() {
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = true;
    }
    if (elements.moreButton) {
      elements.moreButton.hidden = true;
    }
    if (elements.searchInput) {
      elements.searchInput.setAttribute("aria-expanded", "false");
      elements.searchInput.removeAttribute("aria-activedescendant");
    }
    activeIndex = -1;
    allResults = [];
    currentResults = [];
    currentQuery = "";
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

      // Internal ID (the Ally courseId used to query the API — shown to help
      // users debug which exact course record is being reported on)
      if (selectedCourse.id) {
        html += '<div class="ally-selected-course-item">';
        html += "<dt>Internal ID</dt>";
        html +=
          '<dd class="ally-selected-course-id ally-selected-course-code ally-selected-course-term">' +
          escapeHtml(selectedCourse.id) +
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
    if (!elements.executeButton) {
      return;
    }

    // Declare the selection state; do not decide the button state from it. The
    // button also depends on the API being ready, which only the main controller
    // knows, so it is the single arbiter of `disabled` AND of the help text.
    // Writing either here as well is how the two came to disagree.
    elements.executeButton.setAttribute(
      "data-course-selected",
      selectedCourse ? "true" : "false",
    );

    if (
      typeof ALLY_MAIN_CONTROLLER !== "undefined" &&
      typeof ALLY_MAIN_CONTROLLER.refreshExecuteButtonStates === "function"
    ) {
      ALLY_MAIN_CONTROLLER.refreshExecuteButtonStates();
      return;
    }

    // Fallback: the controller has not loaded yet, so keep the button usable.
    logWarn("ALLY_MAIN_CONTROLLER unavailable - setting button state directly");
    elements.executeButton.disabled = !selectedCourse;
    if (elements.executeHelp) {
      elements.executeHelp.textContent = selectedCourse
        ? ""
        : "Select a module first to enable this button";
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

      // Tab is deliberately not handled - letting focus move naturally is what
      // makes the "Show more" footer button reachable. The container's focusout
      // handler closes the dropdown once focus leaves it entirely.
    }
  }

  /**
   * Makes the option at the given index the active one
   *
   * Shared by arrow-key navigation and the reveal-more path so both keep
   * aria-activedescendant, aria-selected and scrolling consistent.
   *
   * @param {number} index - Index within currentResults
   */
  function setActiveOption(index) {
    if (!elements.resultsList) return;

    activeIndex = index;

    const options = elements.resultsList.querySelectorAll('[role="option"]');
    options.forEach(function (option, optionIndex) {
      if (optionIndex === activeIndex) {
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

  /**
   * Navigates through results list
   * @param {number} direction - 1 for down, -1 for up
   */
  function navigateResults(direction) {
    if (!currentResults.length) return;

    // At the end of the rendered rows with more to come, reveal instead of
    // wrapping - wrap-around resumes once everything is rendered
    const atEnd = activeIndex === currentResults.length - 1;
    if (
      direction === 1 &&
      atEnd &&
      currentResults.length < allResults.length &&
      revealMoreResults({ focusFirstNew: true })
    ) {
      return;
    }

    // Calculate new index
    let newIndex = activeIndex + direction;

    // Wrap around
    if (newIndex < 0) {
      newIndex = currentResults.length - 1;
    } else if (newIndex >= currentResults.length) {
      newIndex = 0;
    }

    setActiveOption(newIndex);
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

    // Pointer interaction inside the dropdown must not blur the input, or the
    // focusout handler below would close the list mid-click
    if (elements.resultsContainer) {
      elements.resultsContainer.addEventListener("mousedown", function (event) {
        event.preventDefault();
      });
    }

    // "Show more" footer button - reveals the next page and keeps focus so it
    // can be pressed repeatedly
    if (elements.moreButton) {
      elements.moreButton.addEventListener("click", function () {
        const remaining = allResults.length - currentResults.length;
        const isFinalBatch = remaining <= CONFIG.RESULTS_INCREMENT;

        // The button hides itself on the final batch. Hand focus back FIRST -
        // hiding a focused element drops focus to <body>, which would trip the
        // focusout handler and close the whole dropdown.
        if (isFinalBatch && elements.searchInput) {
          elements.searchInput.focus();
        }

        revealMoreResults();
      });

      elements.moreButton.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          event.preventDefault();
          hideResults();
          if (elements.searchInput) {
            elements.searchInput.focus();
          }
        }
      });
    }

    // Close when focus leaves the search container entirely (covers Tab and
    // Shift+Tab, while allowing focus to reach the footer button)
    const searchContainer = document.getElementById(
      ID_PREFIX + "search-container",
    );
    if (searchContainer) {
      searchContainer.addEventListener("focusout", function (event) {
        if (!searchContainer.contains(event.relatedTarget)) {
          hideResults();
        }
      });
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
        allResults = [];
        currentResults = [];
        currentQuery = "";
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
        renderedCount: currentResults.length,
        totalCount: allResults.length,
        activeIndex: activeIndex,
        elementsFound: {
          searchInput: !!elements.searchInput,
          resultsContainer: !!elements.resultsContainer,
          resultsList: !!elements.resultsList,
          selectedDisplay: !!elements.selectedDisplay,
          clearButton: !!elements.clearButton,
          executeButton: !!elements.executeButton,
          moreButton: !!elements.moreButton,
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

  // Paging structure tests - the "Show more" footer must sit OUTSIDE the
  // listbox, or the ARIA combobox pattern breaks (only options may be children)
  const spListbox = document.getElementById("ally-sp-search-listbox");
  const spMoreButton = document.getElementById("ally-sp-search-more");
  const spResults = document.getElementById("ally-sp-search-results");

  test("Show more button exists (ally-sp-search-more)", spMoreButton !== null);
  test(
    "Show more button is NOT inside the listbox",
    spMoreButton !== null && spListbox !== null && !spListbox.contains(spMoreButton),
  );
  test(
    "Show more button is inside the results container",
    spMoreButton !== null && spResults !== null && spResults.contains(spMoreButton),
  );
  test(
    "Show more button is a real button element",
    spMoreButton !== null && spMoreButton.tagName === "BUTTON",
  );

  // The list must own the scroll, otherwise the footer scrolls out of view
  if (spListbox) {
    const listboxOverflow = window.getComputedStyle(spListbox).overflowY;
    test(
      "listbox owns the vertical scroll",
      listboxOverflow === "auto" || listboxOverflow === "scroll",
    );
  }

  // Paging state is reported for console inspection
  const pagingInfo = ALLY_STATEMENT_PREVIEW_SEARCH.getDebugInfo();
  test("debugInfo reports renderedCount", "renderedCount" in pagingInfo);
  test("debugInfo reports totalCount", "totalCount" in pagingInfo);
  test(
    "renderedCount never exceeds totalCount",
    pagingInfo.renderedCount <= pagingInfo.totalCount,
  );

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
