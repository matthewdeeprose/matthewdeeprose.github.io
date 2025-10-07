/**
 * Sortable Table JavaScript
 *
 * sortable-table.js
 *
 * This script adds sorting functionality to tables with the class "sortable-table".
 * It provides accessible sorting with keyboard support and screen reader announcements.
 * It also applies appropriate ARIA attributes to improve table accessibility.
 */

// Add this code to your existing JavaScript file

// Create a function to initialize the MutationObserver
function initTableObserver() {
  // Set up a MutationObserver to watch for dynamically added tables
  const tableObserver = new MutationObserver(function (mutations) {
    let tablesAdded = false;

    mutations.forEach(function (mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Check if any of the added nodes are tables or contain tables
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            // Element node
            // If the node itself is a table
            if (node.tagName === "TABLE") {
              tablesAdded = true;
            }
            // If the node contains tables
            const tables = node.querySelectorAll("table");
            if (tables.length > 0) {
              tablesAdded = true;
            }
          }
        });
      }
    });

    // Only call addTableARIA if tables were actually added
    if (tablesAdded) {
      console.log("Table nodes detected - applying ARIA attributes");
      addTableARIA();

      // Also initialize sortable tables if they're part of the new content
      // initSortableTables();
    }
  });

  // Start observing the document with the configured parameters
  tableObserver.observe(document.body, {
    childList: true, // Watch for nodes being added or removed
    subtree: true, // Watch changes to the subtree (not just direct children)
  });

  console.log("Table mutation observer initialized");
}

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the mutation observer
  initTableObserver();

  // Initialize sortable tables
  initSortableTables();

  // Add break at space to table headers
  addBreakAtSpaceToTableHeaders();

  // Add ARIA attributes to all tables
  addTableARIA();
});

/**
 * Initialize all sortable tables on the page
 */
function initSortableTables() {
  // Find all sortable tables
  const tables = document.querySelectorAll(".sortable-table");

  if (tables.length === 0) {
    console.log("No sortable tables found on the page");
    return;
  }

  console.log(`Initializing ${tables.length} sortable table(s)`);

  // Process each table
  tables.forEach((table, tableIndex) => {
    // Find all sort buttons in this table
    const sortButtons = table.querySelectorAll(".sort-button");

    if (sortButtons.length === 0) {
      console.log(`No sort buttons found in table ${tableIndex + 1}`);
      return;
    }

    console.log(
      `Added sorting to ${sortButtons.length} columns in table ${
        tableIndex + 1
      }`
    );

    // Add click event listeners to each button
    sortButtons.forEach((button) => {
      // Add click event listener
      button.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("Sort button clicked via mouse");
        console.log(
          `Button details: Column index ${this.getAttribute(
            "data-column-index"
          )}, Current direction: ${
            this.getAttribute("data-sort-direction") || "none"
          }`
        );
        sortTableByColumn(table, this);
      });

      // Add keyboard event listeners for accessibility
      button.addEventListener("keydown", function (e) {
        // Activate on Enter or Space
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          console.log("Sort button activated via keyboard");
          console.log(
            `Button details: Column index ${this.getAttribute(
              "data-column-index"
            )}, Current direction: ${
              this.getAttribute("data-sort-direction") || "none"
            }`
          );
          sortTableByColumn(table, this);
        }
      });
    });
  });
}

/**
 * Sort table by column
 * @param {HTMLElement} table - The table element
 * @param {HTMLElement} button - The button that was clicked
 */
function sortTableByColumn(table, button) {
  try {
    // Log button click event
    console.log(
      `Sort button clicked: Column index ${button.getAttribute(
        "data-column-index"
      )}`
    );

    // Get column index and current sort direction
    const columnIndex = parseInt(button.getAttribute("data-column-index"));
    const currentDirection =
      button.getAttribute("data-sort-direction") || "none";

    // Log current state
    console.log(
      `Current sort state: Column ${columnIndex}, Direction: ${currentDirection}`
    );

    // Get the table header cell
    const th = button.closest("th");
    const columnName = th ? th.textContent.trim() : `Column ${columnIndex}`;

    // Determine expected next direction based on current direction
    let expectedNextDirection;
    if (currentDirection === "none") {
      expectedNextDirection = "ascending";
    } else if (currentDirection === "ascending") {
      expectedNextDirection = "descending";
    } else {
      expectedNextDirection = "none";
    }

    console.log(`Expected next direction: ${expectedNextDirection}`);

    // Reset all buttons in this table
    const allButtons = table.querySelectorAll(".sort-button");
    allButtons.forEach((btn) => {
      btn.setAttribute("data-sort-direction", "none");
      const btnTh = btn.closest("th");
      if (btnTh) {
        btnTh.removeAttribute("aria-sort");
      }
    });

    // Determine new sort direction (fix the cycle)
    let newDirection;
    if (currentDirection === "none") {
      newDirection = "ascending";
    } else if (currentDirection === "ascending") {
      newDirection = "descending";
    } else {
      newDirection = "none";
    }

    // Log if the direction is changing
    if (newDirection !== currentDirection) {
      console.log(
        `Changing sort direction from ${currentDirection} to ${newDirection}`
      );
    } else {
      console.log(`Sort direction remains ${newDirection} (no change)`);
    }

    button.setAttribute("data-sort-direction", newDirection);

    // Update ARIA attributes
    if (th) {
      if (newDirection === "none") {
        th.removeAttribute("aria-sort");
      } else {
        th.setAttribute("aria-sort", newDirection);
      }
    }

    // If the new direction is "none", we don't need to sort
    if (newDirection === "none") {
      console.log(`Sort direction is "none" - no sorting needed`);
      return;
    }

    // Get the tbody and rows
    const tbody = table.querySelector("tbody");
    if (!tbody) {
      console.error("No tbody found in table");
      return;
    }

    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) {
      console.log("No rows found in table");
      return;
    }

    console.log(
      `Sorting ${rows.length} rows by column ${columnIndex} (${columnName}) in ${newDirection} order`
    );

    // Measure sort time
    const startTime = performance.now();

    // Sort the rows
    rows.sort((rowA, rowB) => {
      // Get cells to compare
      const cellA = rowA.cells[columnIndex];
      const cellB = rowB.cells[columnIndex];

      if (!cellA || !cellB) return 0;

      // Get text content for comparison
      let valueA = cellA.textContent.trim();
      let valueB = cellB.textContent.trim();

      // Try to detect and compare numbers
      const numA = parseFloat(valueA.replace(/[^0-9.-]+/g, ""));
      const numB = parseFloat(valueB.replace(/[^0-9.-]+/g, ""));

      if (!isNaN(numA) && !isNaN(numB)) {
        console.log(`Sorting as numbers: ${numA} vs ${numB}`);
        return newDirection === "ascending" ? numA - numB : numB - numA;
      }

      // Try to detect and compare dates
      const dateA = new Date(valueA);
      const dateB = new Date(valueB);

      if (!isNaN(dateA) && !isNaN(dateB)) {
        console.log(
          `Sorting as dates: ${dateA.toISOString()} vs ${dateB.toISOString()}`
        );
        return newDirection === "ascending" ? dateA - dateB : dateB - dateA;
      }

      // Default to string comparison
      console.log(`Sorting as strings: "${valueA}" vs "${valueB}"`);
      return newDirection === "ascending"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });

    // Calculate sort time
    const endTime = performance.now();
    const sortTime = endTime - startTime;
    console.log(`Sort operation completed in ${sortTime.toFixed(2)}ms`);

    // Log sample of sorted data (first 3 rows)
    if (rows.length > 0) {
      console.log("Sample of sorted data (first 3 rows):");
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const cell = rows[i].cells[columnIndex];
        console.log(
          `  Row ${i + 1}: ${cell ? cell.textContent.trim() : "N/A"}`
        );
      }
    }

    // Update the DOM
    console.log("Updating DOM with sorted rows");
    rows.forEach((row) => {
      tbody.appendChild(row);
    });

    // Announce sort to screen readers
    announceSort(button, newDirection);

    console.log(
      `Sort operation complete: Column ${columnIndex} (${columnName}), Direction: ${newDirection}`
    );
  } catch (error) {
    console.error("Error sorting table:", error);
  }
}

/**
 * Announce sort change to screen readers
 * @param {HTMLElement} button - The button that was clicked
 * @param {string} direction - The new sort direction
 */
function announceSort(button, direction) {
  try {
    // Get column name from button's aria-label
    const columnName =
      button.getAttribute("aria-label")?.replace("Sort by ", "") || "column";

    // Log announcement details
    console.log(
      `Announcing sort: Column "${columnName}", Direction: ${direction}`
    );

    // Create announcement element
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.className = "sr-only";

    // Set announcement text
    announcement.textContent = `Table sorted by ${columnName} in ${direction} order`;

    // Add to document
    document.body.appendChild(announcement);

    console.log(`Announced: ${announcement.textContent}`);

    // Remove after it's been read
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
        console.log("Removed announcement element from DOM");
      }
    }, 3000);
  } catch (error) {
    console.error("Error announcing sort:", error);
  }
}

/**
 * Add break-at-space class to table headers
 */
function addBreakAtSpaceToTableHeaders() {
  // Select all th elements within thead across all tables
  const tableHeaders = document.querySelectorAll("thead th");

  // Add the class to each header cell
  tableHeaders.forEach((header) => {
    header.classList.add("break-at-space");
  });

  console.log("Added break-at-space class to all table headers");
}

/**
 * Add ARIA attributes to table elements for improved accessibility
 */
function addTableARIA() {
  try {
    // Use a more specific selector if possible
    const allTables = document.querySelectorAll("table.sortable-table");
    console.log(`Found ${allTables.length} sortable tables to apply ARIA to`);

    allTables.forEach((table, index) => {
      console.log(`Applying ARIA to table ${index + 1}`);

      // Apply table role if not already applied
      if (!table.hasAttribute("role")) {
        table.setAttribute("role", "table");
      }

      // Apply rowgroup roles to thead, tbody, tfoot
      const rowGroups = table.querySelectorAll("thead, tbody, tfoot");
      rowGroups.forEach((group) => {
        if (!group.hasAttribute("role")) {
          group.setAttribute("role", "rowgroup");
        }
      });

      // Apply row roles to tr elements
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        if (!row.hasAttribute("role")) {
          row.setAttribute("role", "row");
        }
      });

      // Apply cell roles to td elements
      const cells = table.querySelectorAll("td");
      cells.forEach((cell) => {
        if (!cell.hasAttribute("role")) {
          cell.setAttribute("role", "cell");
        }
      });

      // Apply columnheader roles to th elements
      const headers = table.querySelectorAll("th:not([scope=row])");
      headers.forEach((header) => {
        if (!header.hasAttribute("role")) {
          header.setAttribute("role", "columnheader");
        }
      });

      // Apply rowheader roles to th elements with scope="row"
      const rowHeaders = table.querySelectorAll("th[scope=row]");
      rowHeaders.forEach((header) => {
        if (!header.hasAttribute("role")) {
          header.setAttribute("role", "rowheader");
        }
      });
    });

    console.log("ARIA attributes applied to all tables");
  } catch (error) {
    console.error("Error in addTableARIA():", error);
  }
}
