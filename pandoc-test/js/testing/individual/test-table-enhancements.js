const TestTableEnhancements = (function () {
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
      console.error(`[TestTableEnhancements] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestTableEnhancements] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestTableEnhancements] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestTableEnhancements] ${message}`, ...args);
  }

  // ===========================================================================================
  // TEST UTILITIES
  // ===========================================================================================

  /**
   * Create a test table in DOM for testing purposes
   */
  function createTestTable() {
    const testHTML = `
        <table id="test-table">
          <caption>Test Table</caption>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Department</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Alice Johnson</td>
              <td>28</td>
              <td>Engineering</td>
              <td>£45,000</td>
            </tr>
            <tr>
              <td>Bob Smith</td>
              <td>34</td>
              <td>Marketing</td>
              <td>£38,000</td>
            </tr>
          </tbody>
        </table>
      `;

    const container = document.createElement("div");
    container.innerHTML = testHTML;
    document.body.appendChild(container);

    return document.getElementById("test-table");
  }

  /**
   * Remove test table from DOM
   */
  function removeTestTable() {
    const table = document.getElementById("test-table");
    if (table) {
      table.parentElement.remove();
    }
  }

  // ===========================================================================================
  // TABLE ENHANCEMENT TESTING
  // ===========================================================================================

  /**
   * Test table enhancement module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testTableEnhancements() {
    logInfo("Starting Table Enhancements module tests");

    try {
      if (!window.ContentGenerator) {
        throw new Error("ContentGenerator module not available");
      }

      const tests = {
        // Test basic module availability
        moduleExists: () => !!window.ContentGenerator,

        // Test CSS generation functions exist
        hasTableCSSFunctions: () => {
          const requiredFunctions = [
            "generateTableCSS",
            "generateAdvancedTableCSS",
            "generateResponsiveTableCSS",
            "generateTableAccessibilityCSS",
            "generateTablePrintCSS",
          ];
          return requiredFunctions.every(
            (func) => typeof window.ContentGenerator[func] === "function"
          );
        },

        // Test ARIA enhancement functions exist
        hasARIAFunctions: () => {
          const ariaFunctions = [
            "addTableARIA",
            "enhanceTableDataLabels",
            "addTableNavigationHelp",
            "addTableDescriptions",
            "enhanceTableAccessibility",
          ];
          return ariaFunctions.every(
            (func) => typeof window.ContentGenerator[func] === "function"
          );
        },

// Test table CSS generation
        generateTableCSS: async () => {
          try {
            const css = await window.ContentGenerator.generateTableCSS();
            return (
              css &&
              css.length > 1000 &&
              css.includes("table {") &&
              css.includes("@media (max-width: 768px)") &&
              css.includes('role="table"') &&
              css.includes("data-label")
            );
          } catch (error) {
            logError("CSS generation test failed:", error);
            return false;
          }
        },

// Test advanced table CSS features
        advancedTableCSS: async () => {
          try {
            const css = await window.ContentGenerator.generateAdvancedTableCSS();
            return (
              css &&
              css.includes("linear-gradient") &&
              css.includes("position: sticky") &&
              css.includes("zebra striping") &&
              css.includes("font-variant-numeric")
            );
          } catch (error) {
            logError("Advanced CSS test failed:", error);
            return false;
          }
        },

// Test responsive table CSS
        responsiveTableCSS: async () => {
          try {
            const css = await window.ContentGenerator.generateResponsiveTableCSS();
            return (
              css &&
              css.includes("card layout") &&
              css.includes("attr(data-label)") &&
              css.includes("@media (max-width: 768px)") &&
              css.includes("flex")
            );
          } catch (error) {
            logError("Responsive CSS test failed:", error);
            return false;
          }
        },

// Test table accessibility CSS
        accessibilityCSS: async () => {
          try {
            const css = await window.ContentGenerator.generateTableAccessibilityCSS();
            return (
              css &&
              css.includes("focus") &&
              css.includes("prefers-contrast") &&
              css.includes("prefers-reduced-motion") &&
              css.includes("screen reader")
            );
          } catch (error) {
            logError("Accessibility CSS test failed:", error);
            return false;
          }
        },

        // Test ARIA enhancement with real DOM
        ariaEnhancementWorks: () => {
          try {
            // Create test table
            const table = createTestTable();

            // Apply ARIA enhancements
            const result = window.ContentGenerator.addTableARIA();

            // Check ARIA attributes were added
            const hasTableRole = table.getAttribute("role") === "table";
            const hasHeaderRoles =
              table.querySelectorAll('th[role="columnheader"]').length > 0;
            const hasCellRoles =
              table.querySelectorAll('td[role="cell"]').length > 0;
            const hasRowRoles =
              table.querySelectorAll('tr[role="row"]').length > 0;

            // Clean up
            removeTestTable();

            return (
              hasTableRole &&
              hasHeaderRoles &&
              hasCellRoles &&
              hasRowRoles &&
              result > 0
            );
          } catch (error) {
            logError("ARIA enhancement test failed:", error);
            removeTestTable(); // Ensure cleanup
            return false;
          }
        },

        // Test data label enhancement
        dataLabelEnhancement: () => {
          try {
            // Create test table
            const table = createTestTable();

            // Apply data label enhancements
            const result = window.ContentGenerator.enhanceTableDataLabels();

            // Check data-label attributes were added
            const dataCells = table.querySelectorAll("tbody td[data-label]");
            const hasDataLabels = dataCells.length > 0;
            const hasCorrectLabel = Array.from(dataCells).some(
              (cell) =>
                cell.getAttribute("data-label") === "Name" ||
                cell.getAttribute("data-label") === "Age"
            );

            // Clean up
            removeTestTable();

            return hasDataLabels && hasCorrectLabel && result > 0;
          } catch (error) {
            logError("Data label enhancement test failed:", error);
            removeTestTable(); // Ensure cleanup
            return false;
          }
        },

        // Test comprehensive enhancement
        comprehensiveEnhancement: () => {
          try {
            // Create test table
            createTestTable();

            // Apply comprehensive enhancement
            const results = window.ContentGenerator.enhanceTableAccessibility();

            // Check results structure
            const hasValidResults =
              results &&
              typeof results.ariaCount === "number" &&
              typeof results.dataLabelsCount === "number" &&
              results.ariaCount > 0;

            // Clean up
            removeTestTable();

            return hasValidResults;
          } catch (error) {
            logError("Comprehensive enhancement test failed:", error);
            removeTestTable(); // Ensure cleanup
            return false;
          }
        },

// Test integration with design system
        designSystemIntegration: async () => {
          try {
            const css = await window.ContentGenerator.generateTableCSS();
            return (
              css &&
              css.includes("var(--surface-color)") &&
              css.includes("var(--border-color)") &&
              css.includes("var(--focus-bg)") &&
              css.includes("var(--heading-color)")
            );
          } catch (error) {
            logError("Design system integration test failed:", error);
            return false;
          }
        },

// Test print CSS compatibility
        printCSS: async () => {
          try {
            const css = await window.ContentGenerator.generateTablePrintCSS();
            return (
              css &&
              css.includes("@media print") &&
              css.includes("all: unset !important") &&
              css.includes("page-break-inside") &&
              css.includes("border-collapse: collapse")
            );
          } catch (error) {
            logError("Print CSS test failed:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runTestSuite (proven working pattern)
      return TestUtilities.runTestSuite("TableEnhancements", tests);
    } catch (error) {
      logError("Test failed:", error);
      removeTestTable(); // Ensure cleanup on error
      return { success: false, error: error.message };
    }
  }

  return { testTableEnhancements };
})();

// Export to global scope
window.TestTableEnhancements = TestTableEnhancements;
window.testTableEnhancements = TestTableEnhancements.testTableEnhancements;
