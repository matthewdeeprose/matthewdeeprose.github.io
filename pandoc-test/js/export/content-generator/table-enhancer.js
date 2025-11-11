// table-enhancer.js
// Table Accessibility Enhancement Module
// Implements Adrian Roselli methods for comprehensive table accessibility

const TableEnhancer = (function () {
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
      console.error("[TABLE-ENHANCER]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TABLE-ENHANCER]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TABLE-ENHANCER]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TABLE-ENHANCER]", message, ...args);
  }

  // ===========================================================================================
  // TABLE ACCESSIBILITY ENHANCEMENT FUNCTIONS
  // ===========================================================================================

  /**
   * Add comprehensive ARIA attributes to tables (Adrian Roselli method)
   * This function enhances table accessibility for screen readers
   * @returns {number} Number of tables enhanced
   */
  function addTableARIA() {
    try {
      logInfo("Adding comprehensive ARIA attributes to tables");
      let enhancedCount = 0;

      // Enhance all tables with role="table"
      const allTables = document.querySelectorAll("table");
      for (let i = 0; i < allTables.length; i++) {
        allTables[i].setAttribute("role", "table");
        enhancedCount++;
      }

      // Enhance captions
      const allCaptions = document.querySelectorAll("caption");
      for (let i = 0; i < allCaptions.length; i++) {
        allCaptions[i].setAttribute("role", "caption");
      }

      // Enhance row groups (thead, tbody, tfoot)
      const allRowGroups = document.querySelectorAll("thead, tbody, tfoot");
      for (let i = 0; i < allRowGroups.length; i++) {
        allRowGroups[i].setAttribute("role", "rowgroup");
      }

      // Enhance all rows
      const allRows = document.querySelectorAll("tr");
      for (let i = 0; i < allRows.length; i++) {
        allRows[i].setAttribute("role", "row");
      }

      // Enhance data cells
      const allCells = document.querySelectorAll("td");
      for (let i = 0; i < allCells.length; i++) {
        allCells[i].setAttribute("role", "cell");
      }

      // Enhance header cells
      const allHeaders = document.querySelectorAll("th");
      for (let i = 0; i < allHeaders.length; i++) {
        allHeaders[i].setAttribute("role", "columnheader");
      }

      // Handle scoped row headers
      const allRowHeaders = document.querySelectorAll("th[scope=row]");
      for (let i = 0; i < allRowHeaders.length; i++) {
        allRowHeaders[i].setAttribute("role", "rowheader");
      }

      logInfo(`✅ ARIA attributes added to ${enhancedCount} tables`);
      return enhancedCount;
    } catch (error) {
      logError("Error adding table ARIA attributes:", error);
      return 0;
    }
  }

  /**
   * Generate data-label attributes for responsive table cards
   * This enables the mobile card layout to show column headers
   * @returns {number} Number of tables processed
   */
  function enhanceTableDataLabels() {
    try {
      logInfo("Generating data-label attributes for responsive tables");
      let processedTables = 0;

      document.querySelectorAll("table").forEach((table) => {
        // Get headers from the first row
        const headerRow = table.querySelector("thead tr, tr:first-child");
        if (!headerRow) return;

        const headers = Array.from(headerRow.querySelectorAll("th, td")).map(
          (header) => header.textContent.trim()
        );

        if (headers.length === 0) return;

        // Add data-label to all data cells
        const dataRows = table.querySelectorAll(
          "tbody tr, tr:not(:first-child)"
        );
        dataRows.forEach((row) => {
          const cells = row.querySelectorAll("td, th");
          cells.forEach((cell, index) => {
            if (headers[index] && headers[index] !== "") {
              cell.setAttribute("data-label", headers[index]);
            } else {
              cell.setAttribute("data-label", `Column ${index + 1}`);
            }
          });
        });

        processedTables++;
      });

      logInfo(`✅ Data labels generated for ${processedTables} tables`);
      return processedTables;
    } catch (error) {
      logError("Error generating table data labels:", error);
      return 0;
    }
  }

  /**
   * Add table navigation help for screen readers
   * @returns {number} Number of tables with help added
   */
  function addTableNavigationHelp() {
    try {
      logInfo("Adding table navigation help for screen readers");
      let helpAdded = 0;

      document.querySelectorAll("table").forEach((table) => {
        // Check if help already exists
        if (table.querySelector(".table-nav-help")) return;

        // Create navigation help element
        const helpElement = document.createElement("div");
        helpElement.className = "table-nav-help";
        helpElement.setAttribute("tabindex", "0");
        helpElement.setAttribute("role", "region");
        helpElement.setAttribute("aria-label", "Table navigation help");
        helpElement.innerHTML = `
          <p><strong>Table Navigation Help:</strong></p>
          <ul>
            <li>Use <kbd>Ctrl + Alt + Arrow Keys</kbd> to navigate between cells</li>
            <li>Use <kbd>Ctrl + Alt + Home</kbd> to go to the first cell</li>
            <li>Use <kbd>Ctrl + Alt + End</kbd> to go to the last cell</li>
            <li>Press <kbd>Enter</kbd> on this help to dismiss it</li>
          </ul>
        `;

        // Add event listener to hide help
        helpElement.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            helpElement.style.display = "none";
          }
        });

        // Insert before the table
        table.parentNode.insertBefore(helpElement, table);
        helpAdded++;
      });

      logInfo(`✅ Navigation help added to ${helpAdded} tables`);
      return helpAdded;
    } catch (error) {
      logError("Error adding table navigation help:", error);
      return 0;
    }
  }

  /**
   * Add table descriptions for better context
   * @returns {number} Number of descriptions added
   */
  function addTableDescriptions() {
    try {
      logInfo("Adding table descriptions for accessibility");
      let descriptionsAdded = 0;

      document.querySelectorAll("table").forEach((table, index) => {
        // Skip if description already exists
        if (
          table.previousElementSibling?.classList.contains("table-description")
        ) {
          return;
        }

        // Get table dimensions for description
        const rows = table.querySelectorAll("tr").length;
        const headerRow = table.querySelector("thead tr, tr:first-child");
        const columns = headerRow
          ? headerRow.querySelectorAll("th, td").length
          : 0;

        // Create description
        const description = document.createElement("div");
        description.className = "table-description";
        description.setAttribute("id", `table-desc-${index + 1}`);

        let descriptionText = `Table ${index + 1}: `;
        if (rows > 0 && columns > 0) {
          descriptionText += `${rows} rows by ${columns} columns`;
          if (table.querySelector("caption")) {
            descriptionText += ` with caption`;
          }
        } else {
          descriptionText += `Data table`;
        }

        description.textContent = descriptionText;

        // Link table to description
        table.setAttribute("aria-describedby", `table-desc-${index + 1}`);

        // Insert before table
        table.parentNode.insertBefore(description, table);
        descriptionsAdded++;
      });

      logInfo(`✅ Descriptions added to ${descriptionsAdded} tables`);
      return descriptionsAdded;
    } catch (error) {
      logError("Error adding table descriptions:", error);
      return 0;
    }
  }

  /**
   * Comprehensive table accessibility enhancement
   * This is the main orchestrator function that calls all enhancement functions
   * @returns {Object} Results with counts for each enhancement type
   */
  function enhanceTableAccessibility() {
    try {
      logInfo("Starting comprehensive table accessibility enhancement");

      const results = {
        ariaCount: addTableARIA(),
        dataLabelsCount: enhanceTableDataLabels(),
        navigationHelpCount: addTableNavigationHelp(),
        descriptionsCount: addTableDescriptions(),
      };

      const totalTables = document.querySelectorAll("table").length;

      logInfo("✅ Table accessibility enhancement complete:", {
        totalTables,
        ariaEnhanced: results.ariaCount,
        dataLabelsAdded: results.dataLabelsCount,
        navigationHelp: results.navigationHelpCount,
        descriptions: results.descriptionsCount,
      });

      // Screen reader announcement
      if (window.AppConfig && window.AppConfig.announceToScreenReader) {
        window.AppConfig.announceToScreenReader(
          `${totalTables} tables enhanced for accessibility with ARIA labels, responsive data labels, and navigation help.`
        );
      }

      return results;
    } catch (error) {
      logError(
        "Error in comprehensive table accessibility enhancement:",
        error
      );
      return null;
    }
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  logInfo("TableEnhancer module initialised");

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Individual enhancement functions
    addTableARIA,
    enhanceTableDataLabels,
    addTableNavigationHelp,
    addTableDescriptions,

    // Orchestrator function
    enhanceTableAccessibility,

    // Logging (for debugging)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.TableEnhancer = TableEnhancer;