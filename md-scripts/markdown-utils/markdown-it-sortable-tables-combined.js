/**
 * markdown-it-sortable-tables-combined.js
 *
 * Enhanced sortable table functionality for markdown-it with improved accessibility.
 * Uses a modern class-based approach with better responsive design and ARIA compliance.
 *
 * Features:
 * - Class-based table management with AccessibleSortableTable
 * - Full ARIA compliance and screen reader support
 * - Responsive design with mobile-friendly layouts
 * - Automatic detection and enhancement of markdown tables
 * - Keyboard navigation support
 * - Multiple data type sorting (text, numbers, dates)
 * - Prefixed CSS classes to avoid conflicts
 * - Configurable logging levels for reduced verbosity
 *
 * Dependencies:
 * - markdown-it
 * - sortable-table-enhanced.css (new CSS file you'll create)
 */

(function () {
  // =========================================================================
  // LOGGING CONFIGURATION
  // =========================================================================

  // Logging levels (lower numbers = higher priority)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  // Configuration settings
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN; // Only warnings and errors by default
  const ENABLE_ALL_LOGGING = false; // Override to enable all logging
  const DISABLE_ALL_LOGGING = false; // Override to disable all logging

  // Current logging level (can be modified at runtime)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} - Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Set the current logging level
   * @param {number} level - The new logging level
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
    }
  }

  /**
   * Get the current logging level
   * @returns {number} - The current logging level
   */
  function getLogLevel() {
    return currentLogLevel;
  }

  // =========================================================================
  // BROWSER ENVIRONMENT CHECK
  // =========================================================================

  if (typeof window === "undefined") {
    // This is an error level message, so it will show even with default settings
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(
        "[Sortable Tables Enhanced] markdown-it-sortable-tables requires a browser environment"
      );
    }
    return;
  }

  // =========================================================================
  // CONFIGURATION AND CONSTANTS
  // =========================================================================

  const CONFIG = {
    // CSS class prefixes to avoid conflicts
    PREFIX: "mdSortableTable",

    // Row display configuration
    ROW_DISPLAY: {
      DEFAULT_VISIBLE: 10,
      SHOW_MORE_INCREMENT: 20,
      SCROLL_THRESHOLD: 20, // Show top scrollbar if more than this many visible rows
    },

    // Class names (will be prefixed)
    CLASSES: {
      TABLE: "data-table",
      CONTAINER: "table-container",
      WRAPPER: "table-wrapper",
      SORT_BUTTON: "sort-button",
      SORT_ICON: "sort-icon",
      SR_ONLY: "sr-only",
      DEMO_BUTTON: "demo-button",
      "preview-control-row": "preview-control-row",
      "preview-controls": "preview-controls",
      "preview-status": "preview-status",
      "preview-actions": "preview-actions",
      "show-more-button": "show-more-button",
      "show-all-button": "show-all-button",
      "show-less-button": "show-less-button",
    },

    // ARIA and accessibility settings
    ARIA: {
      LIVE_REGION_ID: "sortable-table-announcements",
      SORT_ANNOUNCEMENT_DELAY: 100,
    },

    // Sorting configuration
    SORT: {
      DIRECTIONS: ["none", "ascending", "descending"],
      ICONS: {
        none: "↕",
        ascending: "↑",
        descending: "↓",
      },
    },
  };

  // Helper function to get prefixed class name
  function getClassName(className) {
    return `${CONFIG.PREFIX}-${CONFIG.CLASSES[className] || className}`;
  }

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  /**
   * Log messages with consistent formatting and level control
   * @param {string} message - The message to log
   * @param {number} level - The logging level (LOG_LEVELS.ERROR, LOG_LEVELS.WARN, etc.)
   */
  function log(message, level = LOG_LEVELS.INFO) {
    if (!shouldLog(level)) return;

    const prefix = "[Sortable Tables Enhanced]";
    const fullMessage = `${prefix} ${message}`;

    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(fullMessage);
        break;
      case LOG_LEVELS.WARN:
        console.warn(fullMessage);
        break;
      case LOG_LEVELS.INFO:
        console.info(fullMessage);
        break;
      case LOG_LEVELS.DEBUG:
        console.log(fullMessage);
        break;
      default:
        console.log(fullMessage);
    }
  }

  /**
   * Convenience logging methods
   */
  function logError(message) {
    log(message, LOG_LEVELS.ERROR);
  }

  function logWarn(message) {
    log(message, LOG_LEVELS.WARN);
  }

  function logInfo(message) {
    log(message, LOG_LEVELS.INFO);
  }

  function logDebug(message) {
    log(message, LOG_LEVELS.DEBUG);
  }

  /**
   * Create screen reader announcement element if it doesn't exist
   */
  function ensureAnnouncementElement() {
    let announcer = document.getElementById(CONFIG.ARIA.LIVE_REGION_ID);

    if (!announcer) {
      announcer = document.createElement("div");
      announcer.id = CONFIG.ARIA.LIVE_REGION_ID;
      announcer.className = getClassName("SR_ONLY");
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");

      // Add screen reader only styles
      announcer.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      `;

      document.body.appendChild(announcer);
      logInfo("Created screen reader announcement element");
    }

    return announcer;
  }

  /**
   * Extract table data from DOM table element
   */
  function extractTableData(table) {
    const headers = [];
    const rows = [];

    // Get headers
    const headerCells = table.querySelectorAll("thead th");
    headerCells.forEach((th) => {
      headers.push(th.textContent.trim());
    });

    // Get row data
    const dataRows = table.querySelectorAll("tbody tr");
    dataRows.forEach((tr, rowIndex) => {
      const rowData = {};
      const cells = tr.querySelectorAll("td");

      cells.forEach((td, cellIndex) => {
        if (headers[cellIndex]) {
          rowData[headers[cellIndex]] = td.textContent.trim();
        }
      });

      rowData._originalIndex = rowIndex;
      rows.push(rowData);
    });

    return { headers, rows };
  }

  // =========================================================================
  // ACCESSIBLE SORTABLE TABLE CLASS
  // =========================================================================

  class AccessibleSortableTable {
    constructor(tableElement) {
      this.originalTable = tableElement;
      this.container = null;
      this.table = null;
      this.tbody = null;
      this.thead = null;
      this.tfoot = null;
      this.announcement = ensureAnnouncementElement();
      this.data = [];
      this.headers = [];
      this.currentSort = { column: null, direction: "none" };

      // Row display state
      this.visibleRows = CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE;
      this.totalRows = 0;

      // Extract data from the original table
      const extracted = extractTableData(this.originalTable);
      this.headers = extracted.headers;
      this.data = extracted.rows;

      // Initialise the enhanced table
      this.init();
    }

    init() {
      try {
        logInfo(
          `Initialising accessible table with ${this.headers.length} columns and ${this.data.length} rows`
        );

        // Create the enhanced table structure
        this.createEnhancedTable();

        // Replace the original table
        this.replaceOriginalTable();

        // Set up event listeners
        this.setupEventListeners();

        logInfo("Accessible table initialisation complete");
      } catch (error) {
        logError(`Error initialising table: ${error.message}`);
      }
    }

    createEnhancedTable() {
      // Create container structure
      this.container = document.createElement("div");
      this.container.className = getClassName("CONTAINER");

      // Store total rows
      this.totalRows = this.data.length;

      // Calculate initial visible rows for setup decisions
      const initialVisibleRows = Math.min(
        this.totalRows,
        CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE
      );

      // Always add the has-many-rows class initially if we have a large dataset
      // We'll control visibility through the scroll sync elements themselves
      if (this.totalRows > CONFIG.ROW_DISPLAY.SCROLL_THRESHOLD) {
        this.container.classList.add("has-many-rows");
      }

      // Create top scrollbar for large tables
      const topScroll = document.createElement("div");
      topScroll.className = getClassName("top-scroll");

      const topScrollContent = document.createElement("div");
      topScrollContent.className = getClassName("top-scroll-content");
      topScroll.appendChild(topScrollContent);

      const wrapper = document.createElement("div");
      wrapper.className = getClassName("WRAPPER");

      // Create the new table
      this.table = document.createElement("table");
      this.table.className = getClassName("TABLE");
      this.table.setAttribute("role", "table");

      // Create caption from original table caption or generate one
      const originalCaption = this.originalTable.querySelector("caption");
      const caption = document.createElement("caption");
      caption.className = getClassName("SR_ONLY"); // Add sr-only class

      if (originalCaption) {
        caption.textContent = originalCaption.textContent;
      } else {
        caption.textContent = `Table with ${this.data.length} rows and ${this.headers.length} columns, sortable by selecting column headers`;
      }

      this.table.appendChild(caption);

      // Create table structure
      this.createHeaders();
      this.createBody();
      this.renderRows();

      // Assemble the structure
      wrapper.appendChild(this.table);
      this.container.appendChild(topScroll);
      this.container.appendChild(wrapper);

      // Always set up scroll synchronisation for tables that might need it
      if (this.totalRows > CONFIG.ROW_DISPLAY.SCROLL_THRESHOLD) {
        this.setupScrollSync(topScroll, wrapper);

        // Initially hide the top scroll if not needed
        if (initialVisibleRows <= CONFIG.ROW_DISPLAY.SCROLL_THRESHOLD) {
          topScroll.style.display = "none";
        }
      }
    }

    setupScrollSync(topScroll, mainWrapper) {
      // Set the width of the top scroll content to match table width
      const updateTopScrollWidth = () => {
        const table = this.table;
        const topScrollContent = topScroll.querySelector(
          `.${getClassName("top-scroll-content")}`
        );
        if (table && topScrollContent) {
          topScrollContent.style.width = table.scrollWidth + "px";
        }
      };

      // Store the update function for later use
      this.updateTopScrollWidth = updateTopScrollWidth;

      // Initial setup
      setTimeout(updateTopScrollWidth, 100);

      // Sync scrolling between top and main scrollbars
      let isTopScrolling = false;
      let isMainScrolling = false;

      topScroll.addEventListener("scroll", () => {
        if (!isMainScrolling) {
          isTopScrolling = true;
          mainWrapper.scrollLeft = topScroll.scrollLeft;
          setTimeout(() => {
            isTopScrolling = false;
          }, 10);
        }
      });

      mainWrapper.addEventListener("scroll", () => {
        if (!isTopScrolling) {
          isMainScrolling = true;
          topScroll.scrollLeft = mainWrapper.scrollLeft;
          setTimeout(() => {
            isMainScrolling = false;
          }, 10);
        }
      });

      // Update top scroll width when window resizes
      window.addEventListener("resize", updateTopScrollWidth);

      // Update when table content changes
      const resizeObserver = new ResizeObserver(updateTopScrollWidth);
      resizeObserver.observe(this.table);

      logDebug("Scroll synchronisation set up for large table");
    }

    createHeaders() {
      this.thead = document.createElement("thead");
      this.thead.setAttribute("role", "rowgroup");

      const headerRow = document.createElement("tr");
      headerRow.setAttribute("role", "row");

      this.headers.forEach((header, index) => {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.setAttribute("role", "columnheader");
        th.setAttribute("aria-sort", "none");

        const button = document.createElement("button");
        button.className = getClassName("SORT_BUTTON");
        button.setAttribute("data-column", index);
        button.setAttribute("type", "button");

        const span = document.createElement("span");
        span.textContent = header;

        const icon = document.createElement("span");
        icon.className = getClassName("SORT_ICON");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = CONFIG.SORT.ICONS.none;

        const srText = document.createElement("span");
        srText.className = getClassName("SR_ONLY");
        srText.textContent = ", sortable column, currently not sorted";

        button.appendChild(span);
        button.appendChild(icon);
        button.appendChild(srText);
        th.appendChild(button);
        headerRow.appendChild(th);
      });

      this.thead.appendChild(headerRow);
      this.table.appendChild(this.thead);
    }

    createBody() {
      this.tbody = document.createElement("tbody");
      this.tbody.setAttribute("role", "rowgroup");
      this.table.appendChild(this.tbody);

      // Create footer for row controls if needed
      if (this.totalRows > CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE) {
        this.createFooter();
      }
    }

    createFooter() {
      this.tfoot = document.createElement("tfoot");
      this.tfoot.setAttribute("role", "rowgroup");
      this.table.appendChild(this.tfoot);
    }

    renderRows() {
      this.tbody.innerHTML = "";

      // Get the rows to display (limited by visibleRows)
      const rowsToShow = this.data.slice(0, this.visibleRows);

      rowsToShow.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tr.setAttribute("tabindex", "0");
        tr.setAttribute("role", "row");

        this.headers.forEach((header, cellIndex) => {
          const td = document.createElement("td");
          td.setAttribute("role", "cell");
          td.setAttribute("data-label", header);
          td.textContent = row[header] || "";
          tr.appendChild(td);
        });

        this.tbody.appendChild(tr);
      });

      // Update footer controls if they exist
      this.updateFooterControls();

      // Update scroll synchronisation based on visible rows
      this.updateScrollSync();

      // Update caption to reflect current state
      this.updateCaption();
    }

    updateFooterControls() {
      if (!this.tfoot || this.totalRows <= CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE) {
        return;
      }

      // Clear existing footer content
      this.tfoot.innerHTML = "";

      // Create control row
      const controlRow = document.createElement("tr");
      controlRow.className = getClassName("preview-control-row");

      const controlCell = document.createElement("td");
      controlCell.setAttribute("colspan", this.headers.length.toString());
      controlCell.className = getClassName("preview-controls");

      // Create status text
      const statusDiv = document.createElement("div");
      statusDiv.className = getClassName("preview-status");
      statusDiv.textContent = `Showing ${this.getVisibleRowCount()} of ${
        this.totalRows
      } rows`;

      // Create actions container
      const actionsDiv = document.createElement("div");
      actionsDiv.className = getClassName("preview-actions");

      // Show more button (if applicable)
      if (this.visibleRows < this.totalRows) {
        const showMoreButton = document.createElement("button");
        showMoreButton.type = "button";
        showMoreButton.className = getClassName("show-more-button");

        const remainingRows = this.totalRows - this.visibleRows;
        const increment = Math.min(
          CONFIG.ROW_DISPLAY.SHOW_MORE_INCREMENT,
          remainingRows
        );

        showMoreButton.textContent = `Show ${increment} more rows`;
        showMoreButton.setAttribute(
          "aria-label",
          `Show ${increment} more rows`
        );
        showMoreButton.addEventListener("click", () => this.showMoreRows());

        actionsDiv.appendChild(showMoreButton);

        // Show all button
        const showAllButton = document.createElement("button");
        showAllButton.type = "button";
        showAllButton.className = getClassName("show-all-button");
        showAllButton.textContent = `Show all (${this.totalRows})`;
        showAllButton.setAttribute(
          "aria-label",
          `Show all ${this.totalRows} rows`
        );
        showAllButton.addEventListener("click", () => this.showAllRows());

        actionsDiv.appendChild(showAllButton);
      } else {
        // Show less button when all rows are visible
        const showLessButton = document.createElement("button");
        showLessButton.type = "button";
        showLessButton.className = getClassName("show-less-button");
        showLessButton.textContent = `Show fewer rows`;
        showLessButton.setAttribute(
          "aria-label",
          `Show only first ${CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE} rows`
        );
        showLessButton.addEventListener("click", () => this.showDefaultRows());

        actionsDiv.appendChild(showLessButton);
      }

      controlCell.appendChild(statusDiv);
      controlCell.appendChild(actionsDiv);
      controlRow.appendChild(controlCell);
      this.tfoot.appendChild(controlRow);
    }

    getVisibleRowCount() {
      return Math.min(this.visibleRows, this.totalRows);
    }

    showMoreRows() {
      const increment = CONFIG.ROW_DISPLAY.SHOW_MORE_INCREMENT;
      this.visibleRows = Math.min(this.visibleRows + increment, this.totalRows);
      this.renderRows();

      // Update scroll sync after DOM has updated
      setTimeout(() => {
        this.updateScrollSync();
      }, 50);

      // Announce to screen readers
      const announcement = `Now showing ${this.getVisibleRowCount()} of ${
        this.totalRows
      } rows`;
      setTimeout(() => {
        this.announcement.textContent = announcement;
      }, 100);
    }

    showAllRows() {
      this.visibleRows = this.totalRows;
      this.renderRows();

      // Update scroll sync after DOM has updated
      setTimeout(() => {
        this.updateScrollSync();
      }, 50);

      // Announce to screen readers
      const announcement = `Now showing all ${this.totalRows} rows`;
      setTimeout(() => {
        this.announcement.textContent = announcement;
      }, 100);
    }

    showDefaultRows() {
      this.visibleRows = CONFIG.ROW_DISPLAY.DEFAULT_VISIBLE;
      this.renderRows();

      // Update scroll sync after DOM has updated
      setTimeout(() => {
        this.updateScrollSync();
      }, 50);

      // Announce to screen readers
      const announcement = `Now showing ${this.getVisibleRowCount()} of ${
        this.totalRows
      } rows`;
      setTimeout(() => {
        this.announcement.textContent = announcement;
      }, 100);
    }

    updateCaption() {
      const caption = this.table.querySelector("caption");
      if (caption) {
        const visibleCount = this.getVisibleRowCount();
        let captionText = `Table with ${this.totalRows} rows and ${this.headers.length} columns, sortable by selecting column headers`;

        if (visibleCount < this.totalRows) {
          captionText += `. ${visibleCount} rows currently shown`;
        }

        caption.textContent = captionText;
      }
    }

    updateScrollSync() {
      // Update scroll sync based on current visible rows
      const shouldHaveScrollSync =
        this.getVisibleRowCount() > CONFIG.ROW_DISPLAY.SCROLL_THRESHOLD;

      // Find the top scroll element
      const topScroll = this.container.querySelector(
        `.${getClassName("top-scroll")}`
      );

      if (shouldHaveScrollSync) {
        this.container.classList.add("has-many-rows");
        if (topScroll) {
          topScroll.style.display = "block";
          // Update the scroll content width
          this.updateTopScrollWidth();
        }
      } else {
        this.container.classList.remove("has-many-rows");
        if (topScroll) {
          topScroll.style.display = "none";
        }
      }
    }

    updateTopScrollWidth() {
      const topScrollContent = this.container.querySelector(
        `.${getClassName("top-scroll-content")}`
      );
      if (this.table && topScrollContent) {
        topScrollContent.style.width = this.table.scrollWidth + "px";
      }
    }

    replaceOriginalTable() {
      // Insert the new table before the original
      this.originalTable.parentNode.insertBefore(
        this.container,
        this.originalTable
      );

      // Remove the original table
      this.originalTable.remove();

      logInfo("Original table replaced with enhanced version");
    }

    setupEventListeners() {
      // Add click event listeners to sort buttons
      const sortButtons = this.thead.querySelectorAll(
        `.${getClassName("SORT_BUTTON")}`
      );

      sortButtons.forEach((button) => {
        button.addEventListener("click", (e) => this.handleSort(e));
        button.addEventListener("keydown", (e) => this.handleKeydown(e));
      });

      logDebug(`Added event listeners to ${sortButtons.length} sort buttons`);
    }

    handleSort(event) {
      const button = event.target.closest(`.${getClassName("SORT_BUTTON")}`);
      const th = button.closest("th");
      const columnIndex = parseInt(button.getAttribute("data-column"));
      const currentSort = th.getAttribute("aria-sort");

      logDebug(
        `Sort requested for column ${columnIndex}, current sort: ${currentSort}`
      );

      // Reset all other columns
      this.thead.querySelectorAll("th").forEach((header) => {
        if (header !== th) {
          header.setAttribute("aria-sort", "none");
          const btn = header.querySelector(`.${getClassName("SORT_BUTTON")}`);
          const icon = btn.querySelector(`.${getClassName("SORT_ICON")}`);
          icon.textContent = CONFIG.SORT.ICONS.none;
          const srText = btn.querySelector(`.${getClassName("SR_ONLY")}`);
          srText.textContent = ", sortable column, currently not sorted";
        }
      });

      // Determine new sort direction
      let newDirection;
      const currentIndex = CONFIG.SORT.DIRECTIONS.indexOf(currentSort);
      const nextIndex = (currentIndex + 1) % CONFIG.SORT.DIRECTIONS.length;
      newDirection = CONFIG.SORT.DIRECTIONS[nextIndex];

      logDebug(
        `Changing sort direction from ${currentSort} to ${newDirection}`
      );

      // Update this column's sort state
      th.setAttribute("aria-sort", newDirection);

      const icon = button.querySelector(`.${getClassName("SORT_ICON")}`);
      icon.textContent = CONFIG.SORT.ICONS[newDirection];

      const srText = button.querySelector(`.${getClassName("SR_ONLY")}`);
      const columnName = button.querySelector("span:first-child").textContent;

      if (newDirection === "none") {
        srText.textContent = ", sortable column, currently not sorted";
      } else {
        srText.textContent = `, sortable column, currently sorted ${newDirection}`;
      }

      // Perform the sort if not 'none'
      if (newDirection !== "none") {
        this.sortData(columnIndex, newDirection);
        this.renderRows();
      } else {
        // Restore original order
        this.data.sort((a, b) => a._originalIndex - b._originalIndex);
        this.renderRows();
      }

      // Announce to screen readers
      const announcement =
        newDirection === "none"
          ? `Table sort cleared for ${columnName}`
          : `Table sorted by ${columnName} in ${newDirection} order`;

      setTimeout(() => {
        this.announcement.textContent = announcement;
      }, CONFIG.ARIA.SORT_ANNOUNCEMENT_DELAY);

      this.currentSort = { column: columnIndex, direction: newDirection };
    }

    sortData(columnIndex, direction) {
      const columnHeader = this.headers[columnIndex];

      this.data.sort((a, b) => {
        let aVal = a[columnHeader];
        let bVal = b[columnHeader];

        // Handle different data types

        // Try numeric comparison first
        const aNum = this.parseNumber(aVal);
        const bNum = this.parseNumber(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return direction === "ascending" ? aNum - bNum : bNum - aNum;
        }

        // Try date comparison
        const aDate = this.parseDate(aVal);
        const bDate = this.parseDate(bVal);

        if (aDate && bDate) {
          return direction === "ascending" ? aDate - bDate : bDate - aDate;
        }

        // Default to string comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();

        if (direction === "ascending") {
          return aVal.localeCompare(bVal);
        } else {
          return bVal.localeCompare(aVal);
        }
      });

      logDebug(`Data sorted by ${columnHeader} in ${direction} order`);
    }

    parseNumber(value) {
      // Remove common formatting characters
      const cleaned = String(value).replace(/[£$,\s%]/g, "");
      return parseFloat(cleaned);
    }

    parseDate(value) {
      // Try common date formats
      const dateStr = String(value).trim();

      // DD/MM/YYYY or DD-MM-YYYY
      const ukFormat = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ukFormat) {
        return new Date(ukFormat[3], ukFormat[2] - 1, ukFormat[1]);
      }

      // ISO format or standard date parsing
      const standardDate = new Date(dateStr);
      return isNaN(standardDate) ? null : standardDate;
    }

    handleKeydown(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.handleSort(event);
      }
    }
  }

  // =========================================================================
  // MARKDOWN-IT PLUGIN
  // =========================================================================

  /**
   * Simple markdown-it plugin to add base class to tables
   */
  function markdownItSortableTablesPlugin(md) {
    if (!md || !md.renderer) {
      logError("Invalid markdown-it instance provided");
      return;
    }

    logInfo("Initialising markdown-it plugin for sortable tables");

    // Store original table renderer
    const originalTableOpen =
      md.renderer.rules.table_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    // Override table_open to add sortable class
    md.renderer.rules.table_open = function (tokens, idx, options, env, self) {
      const token = tokens[idx];

      // Add the sortable class that will be detected later
      token.attrJoin("class", "sortable-table");

      return originalTableOpen(tokens, idx, options, env, self);
    };

    logInfo("Markdown-it plugin initialised");
  }

  // =========================================================================
  // TABLE DETECTION AND INITIALISATION
  // =========================================================================

  /**
   * Initialise all sortable tables on the page
   */
  function initSortableTables(container = document) {
    try {
      // Find tables with the sortable-table class that haven't been enhanced yet
      const tables = container.querySelectorAll(
        'table.sortable-table:not([data-enhanced="true"])'
      );

      if (tables.length === 0) {
        logInfo("No sortable tables found to enhance");
        return;
      }

      logInfo(`Found ${tables.length} table(s) to enhance`);

      tables.forEach((table, index) => {
        // Skip tables that are already enhanced or don't have proper structure
        if (table.getAttribute("data-enhanced") === "true") {
          return;
        }

        // Check if table has proper structure
        const thead = table.querySelector("thead");
        const tbody = table.querySelector("tbody");

        if (!thead || !tbody) {
          logWarn(`Skipping table ${index + 1}: missing thead or tbody`);
          return;
        }

        // Mark as being processed to avoid double-processing
        table.setAttribute("data-enhanced", "true");

        try {
          // Create the enhanced table
          new AccessibleSortableTable(table);
          logInfo(`Successfully enhanced table ${index + 1}`);
        } catch (error) {
          logError(`Error enhancing table ${index + 1}: ${error.message}`);
          // Remove the marker so it can be retried later
          table.removeAttribute("data-enhanced");
        }
      });
    } catch (error) {
      logError(`Error in initSortableTables: ${error.message}`);
    }
  }

  /**
   * Set up mutation observer to detect new tables
   */
  function setupTableObserver() {
    const observer = new MutationObserver(function (mutations) {
      let tablesAdded = false;

      mutations.forEach(function (mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Element node
              // Check if the node is a table or contains tables
              if (
                node.tagName === "TABLE" &&
                node.classList.contains("sortable-table")
              ) {
                tablesAdded = true;
              } else if (node.querySelectorAll) {
                const tables = node.querySelectorAll("table.sortable-table");
                if (tables.length > 0) {
                  tablesAdded = true;
                }
              }
            }
          });
        }
      });

      if (tablesAdded) {
        logDebug("New tables detected, initialising...");
        // Small delay to ensure DOM is stable
        setTimeout(() => initSortableTables(), 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    logInfo("Table mutation observer initialised");
  }

  // =========================================================================
  // INITIALISATION AND PUBLIC API
  // =========================================================================

  /**
   * Initialise the enhanced sortable tables system
   */
  function init() {
    logInfo("Initialising enhanced sortable tables system");

    // Set up the markdown-it plugin if available
    if (window.markdownit) {
      // Note: This assumes a global markdown-it instance
      // You may need to adjust this based on your setup
      logInfo("Markdown-it detected, plugin will be available");
    } else {
      logWarn("Markdown-it not found, plugin not initialised");
    }

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setupTableObserver();
        initSortableTables();
      });
    } else {
      setupTableObserver();
      initSortableTables();
    }
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  // Create the public API
  const sortableTablesAPI = {
    // Core functionality
    init: init,
    initSortableTables: initSortableTables,

    // Classes and utilities
    AccessibleSortableTable: AccessibleSortableTable,
    markdownItPlugin: markdownItSortableTablesPlugin,

    // Configuration
    config: CONFIG,

    // Logging controls
    LOG_LEVELS: LOG_LEVELS,
    setLogLevel: setLogLevel,
    getLogLevel: getLogLevel,
    shouldLog: shouldLog,

    // Utilities
    getClassName: getClassName,
    extractTableData: extractTableData,

    // Backward compatibility
    addTableARIA: function () {
      logWarn("addTableARIA is deprecated - ARIA is now handled automatically");
    },
    addBreakAtSpaceToTableHeaders: function () {
      logWarn("addBreakAtSpaceToTableHeaders is deprecated - handled by CSS");
    },
  };

  // Expose to global scope
  window.sortableTablesEnhanced = sortableTablesAPI;

  // Maintain backward compatibility
  window.sortableTables = sortableTablesAPI;
  window.initSortableTables = initSortableTables;
  window.addTableARIA = sortableTablesAPI.addTableARIA;
  window.addBreakAtSpaceToTableHeaders =
    sortableTablesAPI.addBreakAtSpaceToTableHeaders;

  // Auto-initialise
  init();

  logInfo("Enhanced sortable tables system loaded");
})();
