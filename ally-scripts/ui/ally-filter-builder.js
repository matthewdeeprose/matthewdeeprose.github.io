/**
 * @fileoverview Ally Accessibility Reporting Tool - Filter Builder Module
 * @module AllyFilterBuilder
 * @requires ALLY_CONFIG
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Dynamic filter construction UI for advanced query building. Allows users to
 * create multiple filter conditions with field selection, operators, and values.
 * Supports string, number, and boolean field types with appropriate inputs.
 *
 * Key Features:
 * - Dynamic filter row creation and removal
 * - Field-type aware operator selection
 * - Appropriate input types for different field types
 * - Filter serialisation for API queries
 * - Full keyboard accessibility
 * - Screen reader support
 *
 * Integration:
 * - Requires ally-config.js for field definitions and operators
 * - Used by ally-main-controller.js for query building
 * - Available globally via ALLY_FILTER_BUILDER
 *
 * @example
 * // Initialise the filter builder
 * ALLY_FILTER_BUILDER.initialise();
 *
 * // Add a filter row
 * ALLY_FILTER_BUILDER.addFilterRow();
 *
 * // Get filters as array
 * const filters = ALLY_FILTER_BUILDER.getFilters();
 *
 * // Serialise for API
 * const queryParams = ALLY_FILTER_BUILDER.serialiseFilters(filters);
 */

const ALLY_FILTER_BUILDER = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  /**
   * Determines if a message should be logged based on current configuration
   * @param {number} level - The log level to check
   * @returns {boolean} True if the message should be logged
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  /**
   * Logs error messages if error logging is enabled
   * @param {string} message - The error message to log
   * @param {...any} args - Additional arguments to pass to console.error
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyFilterBuilder] " + message, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyFilterBuilder] " + message, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyFilterBuilder] " + message, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyFilterBuilder] " + message, ...args);
  }

  // ========================================================================
  // Private State
  // ========================================================================

  /**
   * Initialisation state flag
   * @type {boolean}
   */
  let initialised = false;

  /**
   * Counter for generating unique filter row IDs
   * @type {number}
   */
  let filterRowCounter = 0;

  /**
   * Cached element references
   * @type {Object.<string, HTMLElement|null>}
   */
  const elements = {
    filterBuilder: null,
    filterRows: null,
    addFilterBtn: null,
  };

  // ========================================================================
  // Private Methods - Element Caching
  // ========================================================================

  /**
   * Caches required DOM elements
   * @private
   * @returns {boolean} True if all required elements found
   */
  function cacheElements() {
    elements.filterBuilder = document.getElementById("ally-filter-builder");
    elements.filterRows = document.getElementById("ally-filter-rows");
    elements.addFilterBtn = document.getElementById("ally-add-filter");

    const allFound =
      elements.filterBuilder && elements.filterRows && elements.addFilterBtn;

    if (!allFound) {
      logWarn("Some filter builder elements not found in DOM");
      if (!elements.filterBuilder) logWarn("Missing: ally-filter-builder");
      if (!elements.filterRows) logWarn("Missing: ally-filter-rows");
      if (!elements.addFilterBtn) logWarn("Missing: ally-add-filter");
    }

    return allFound;
  }

  // ========================================================================
  // Private Methods - Filter Row Creation
  // ========================================================================

  /**
   * Creates the field selection dropdown
   * @private
   * @param {string} rowId - Unique ID for the filter row
   * @param {string} [endpoint] - Current endpoint ('overall' or 'issues') to filter available fields
   * @returns {HTMLSelectElement} The field select element
   */
  function createFieldSelect(rowId, endpoint) {
    const select = document.createElement("select");
    select.id = rowId + "-field";
    select.className = "ally-filter-field";
    select.setAttribute("aria-label", "Filter field");

    // Default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select field...";
    select.appendChild(defaultOption);

    // Add field options from config (filtered by endpoint if provided)
    if (typeof ALLY_CONFIG !== "undefined") {
      const fieldKeys = endpoint
        ? ALLY_CONFIG.getFilterFieldKeysForEndpoint(endpoint)
        : ALLY_CONFIG.getFilterFieldKeys();

      fieldKeys.forEach(function (key) {
        const fieldDef = ALLY_CONFIG.getFieldDefinition(key);
        if (fieldDef) {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = fieldDef.label;
          option.title = fieldDef.description || "";
          select.appendChild(option);
        }
      });
    }

    // Handle field change to update operators
    select.addEventListener("change", function () {
      handleFieldChange(rowId, select.value);
    });

    return select;
  }

  /**
   * Repopulates an existing field select dropdown with fields valid for the specified endpoint
   * Preserves the change event listener already attached
   * @private
   * @param {HTMLSelectElement} select - The field select element to repopulate
   * @param {string} [endpoint] - Current endpoint ('overall' or 'issues') to filter available fields
   */
  function repopulateFieldSelect(select, endpoint) {
    if (!select || typeof ALLY_CONFIG === "undefined") return;

    // Clear existing options
    select.innerHTML = "";

    // Default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select field...";
    select.appendChild(defaultOption);

    // Add field options from config (filtered by endpoint if provided)
    const fieldKeys = endpoint
      ? ALLY_CONFIG.getFilterFieldKeysForEndpoint(endpoint)
      : ALLY_CONFIG.getFilterFieldKeys();

    fieldKeys.forEach(function (key) {
      const fieldDef = ALLY_CONFIG.getFieldDefinition(key);
      if (fieldDef) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = fieldDef.label;
        option.title = fieldDef.description || "";
        select.appendChild(option);
      }
    });

    logDebug(
      "Repopulated field select with " +
        fieldKeys.length +
        " fields for endpoint: " +
        (endpoint || "all"),
    );
  }

  /**
   * Creates the operator selection dropdown
   * @private
   * @param {string} rowId - Unique ID for the filter row
   * @param {string} fieldType - Type of the selected field (string/number/boolean)
   * @returns {HTMLSelectElement} The operator select element
   */
  function createOperatorSelect(rowId, fieldType) {
    const select = document.createElement("select");
    select.id = rowId + "-operator";
    select.className = "ally-filter-operator";
    select.setAttribute("aria-label", "Filter operator");

    // Populate with operators for field type
    updateOperatorOptions(select, fieldType);

    return select;
  }

  /**
   * Updates operator dropdown options based on field type
   * @private
   * @param {HTMLSelectElement} select - The operator select element
   * @param {string} fieldType - Type of field (string/number/boolean)
   */
  function updateOperatorOptions(select, fieldType) {
    // Clear existing options
    select.innerHTML = "";

    // Default option if no field selected
    if (!fieldType) {
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Select operator...";
      select.appendChild(defaultOption);
      select.disabled = true;
      return;
    }

    select.disabled = false;

    // Get operators from config
    if (typeof ALLY_CONFIG !== "undefined") {
      const operators = ALLY_CONFIG.OPERATORS[fieldType] || [];
      operators.forEach(function (op) {
        const option = document.createElement("option");
        option.value = op.value;
        option.textContent = op.symbol + " " + op.label;
        select.appendChild(option);
      });
    }
  }

  /**
   * Creates the value input element based on field type
   * @private
   * @param {string} rowId - Unique ID for the filter row
   * @param {string} fieldType - Type of the selected field
   * @param {boolean} isScore - Whether the field is a score (0-1 range)
   * @returns {HTMLElement} The value input element
   */
  function createValueInput(rowId, fieldType, isScore) {
    let input;

    switch (fieldType) {
      case "boolean":
        input = document.createElement("select");
        input.id = rowId + "-value";
        input.className = "ally-filter-value ally-filter-value-boolean";
        input.setAttribute("aria-label", "Filter value");

        const trueOption = document.createElement("option");
        trueOption.value = "true";
        trueOption.textContent = "Yes";
        input.appendChild(trueOption);

        const falseOption = document.createElement("option");
        falseOption.value = "false";
        falseOption.textContent = "No";
        input.appendChild(falseOption);
        break;

      case "number":
        input = document.createElement("input");
        input.type = "number";
        input.id = rowId + "-value";
        input.className = "ally-filter-value ally-filter-value-number";
        input.setAttribute("aria-label", "Filter value");

        if (isScore) {
          // Score fields are 0-100 percentage display (but stored as 0-1)
          input.min = "0";
          input.max = "100";
          input.step = "1";
          input.placeholder = "0-100%";
          input.setAttribute("aria-describedby", rowId + "-value-hint");
        } else {
          input.placeholder = "Enter number...";
        }
        break;

      case "string":
      default:
        input = document.createElement("input");
        input.type = "text";
        input.id = rowId + "-value";
        input.className = "ally-filter-value ally-filter-value-text";
        input.setAttribute("aria-label", "Filter value");
        input.placeholder = "Enter text...";
        break;
    }

    return input;
  }

  /**
   * Creates the remove button for a filter row
   * @private
   * @param {string} rowId - Unique ID for the filter row
   * @returns {HTMLButtonElement} The remove button element
   */
  function createRemoveButton(rowId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ally-remove-filter-btn";
    button.setAttribute("aria-label", "Remove this filter");
    button.innerHTML = '<span aria-hidden="true" data-icon="close"></span>';

    button.addEventListener("click", function () {
      removeFilterRow(rowId);
    });

    return button;
  }

  /**
   * Creates a complete filter row element
   * @private
   * @param {string} [endpoint] - Current endpoint to filter available fields
   * @returns {HTMLElement} The filter row element
   */
  function createFilterRow(endpoint) {
    filterRowCounter++;
    const rowId = "ally-filter-row-" + filterRowCounter;

    const row = document.createElement("div");
    row.id = rowId;
    row.className = "ally-filter-row";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Filter condition " + filterRowCounter);

    // Create elements (pass endpoint to filter available fields)
    const fieldSelect = createFieldSelect(rowId, endpoint);
    const operatorSelect = createOperatorSelect(rowId, null);
    const valueInput = createValueInput(rowId, "string", false);
    const removeBtn = createRemoveButton(rowId);

    // Disable operator and value until field is selected
    operatorSelect.disabled = true;
    valueInput.disabled = true;

    // Create value container (for potential hint text)
    const valueContainer = document.createElement("div");
    valueContainer.className = "ally-filter-value-container";
    valueContainer.appendChild(valueInput);

    // Assemble row
    row.appendChild(fieldSelect);
    row.appendChild(operatorSelect);
    row.appendChild(valueContainer);
    row.appendChild(removeBtn);

    logDebug(
      "Created filter row: " +
        rowId +
        " (endpoint: " +
        (endpoint || "all") +
        ")",
    );
    return row;
  }

  // ========================================================================
  // Private Methods - Event Handlers
  // ========================================================================

  /**
   * Handles field selection change
   * @private
   * @param {string} rowId - The filter row ID
   * @param {string} fieldKey - The selected field key
   */
  function handleFieldChange(rowId, fieldKey) {
    const row = document.getElementById(rowId);
    if (!row) {
      logError("Filter row not found: " + rowId);
      return;
    }

    const operatorSelect = row.querySelector(".ally-filter-operator");
    const valueContainer = row.querySelector(".ally-filter-value-container");

    if (!operatorSelect || !valueContainer) {
      logError("Filter row elements not found");
      return;
    }

    // Get field definition
    let fieldDef = null;
    let fieldType = "string";
    let isScore = false;
    let noOperator = false;

    if (fieldKey && typeof ALLY_CONFIG !== "undefined") {
      fieldDef = ALLY_CONFIG.getFieldDefinition(fieldKey);
      if (fieldDef) {
        fieldType = fieldDef.type;
        isScore = !!fieldDef.isScore;
        noOperator = !!fieldDef.noOperator;
      }
    }

    // Handle fields that don't support operators (e.g., departmentId, departmentName)
    if (noOperator && fieldKey) {
      // Hide operator dropdown and set to empty value
      operatorSelect.innerHTML = "";
      const noOpOption = document.createElement("option");
      noOpOption.value = "";
      noOpOption.textContent = "(exact match)";
      operatorSelect.appendChild(noOpOption);
      operatorSelect.disabled = true;
      operatorSelect.classList.add("ally-filter-operator-hidden");
      logDebug("Field '" + fieldKey + "' does not support operators");
    } else {
      // Update operator options normally
      operatorSelect.classList.remove("ally-filter-operator-hidden");
      updateOperatorOptions(operatorSelect, fieldKey ? fieldType : null);
      operatorSelect.disabled = !fieldKey;
    }

    // Replace value input with appropriate type
    const oldInput = valueContainer.querySelector(".ally-filter-value");
    const newInput = createValueInput(rowId, fieldType, isScore);
    newInput.disabled = !fieldKey;

    // Add hint for score fields or noOperator fields
    const existingHint = valueContainer.querySelector(".ally-filter-hint");
    if (existingHint) {
      existingHint.remove();
    }

    if (fieldKey) {
      let hintText = null;
      if (isScore) {
        hintText = "Enter percentage (0-100)";
      } else if (noOperator) {
        hintText = "Exact match only";
      }

      if (hintText) {
        const hint = document.createElement("span");
        hint.id = rowId + "-value-hint";
        hint.className = "ally-filter-hint ally-help-text";
        hint.textContent = hintText;
        valueContainer.appendChild(hint);
      }
    }

    if (oldInput) {
      valueContainer.replaceChild(newInput, oldInput);
    } else {
      valueContainer.insertBefore(newInput, valueContainer.firstChild);
    }

    logDebug(
      "Field changed to: " +
        fieldKey +
        " (type: " +
        fieldType +
        ", noOperator: " +
        noOperator +
        ")",
    );
  }

  /**
   * Removes a filter row from the DOM
   * @private
   * @param {string} rowId - The filter row ID to remove
   */
  function removeFilterRow(rowId) {
    const row = document.getElementById(rowId);
    if (row && elements.filterRows) {
      row.remove();
      logDebug("Removed filter row: " + rowId);

      // Announce removal for screen readers
      announceToScreenReader("Filter removed");

      // Update row labels for remaining rows
      updateRowAriaLabels();
    }
  }

  /**
   * Updates aria-labels on remaining filter rows after removal
   * @private
   */
  function updateRowAriaLabels() {
    if (!elements.filterRows) return;

    const rows = elements.filterRows.querySelectorAll(".ally-filter-row");
    rows.forEach(function (row, index) {
      row.setAttribute("aria-label", "Filter condition " + (index + 1));
    });
  }

  /**
   * Gets the currently selected endpoint from the form
   * @private
   * @returns {string} Current endpoint ('overall' or 'issues')
   */
  function getCurrentEndpoint() {
    const checkedRadio = document.querySelector(
      'input[name="ally-endpoint"]:checked',
    );
    return checkedRadio ? checkedRadio.value : "overall";
  }

  /**
   * Sets up event listener for Add Filter button
   * @private
   */
  function setupAddFilterButton() {
    if (elements.addFilterBtn) {
      elements.addFilterBtn.addEventListener("click", function () {
        // Pass current endpoint to filter available fields
        const endpoint = getCurrentEndpoint();
        publicAPI.addFilterRow(endpoint);
      });
      logDebug("Add filter button handler bound");
    }
  }

  // ========================================================================
  // Private Methods - Utilities
  // ========================================================================

  /**
   * Announces a message to screen readers
   * @private
   * @param {string} message - The message to announce
   */
  function announceToScreenReader(message) {
    // Try to use UI Manager's announce method
    if (
      typeof ALLY_UI_MANAGER !== "undefined" &&
      typeof ALLY_UI_MANAGER.announce === "function"
    ) {
      ALLY_UI_MANAGER.announce(message);
    } else {
      // Fallback: create temporary live region
      const announcer = document.createElement("div");
      announcer.setAttribute("role", "status");
      announcer.setAttribute("aria-live", "polite");
      announcer.className = "sr-only";
      announcer.textContent = message;
      document.body.appendChild(announcer);

      setTimeout(function () {
        announcer.remove();
      }, 1000);
    }
  }

  /**
   * Populates icons if IconLibrary is available
   * @private
   */
  function populateIcons() {
    if (typeof IconLibrary !== "undefined") {
      IconLibrary.populateIcons();
    }
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the filter builder
     * Caches elements and sets up event listeners
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logWarn("Already initialised");
        return true;
      }

      logInfo("Initialising Filter Builder...");

      // Check dependencies
      if (typeof ALLY_CONFIG === "undefined") {
        logWarn("ALLY_CONFIG not available - filter fields may be limited");
      }

      // Cache elements
      if (!cacheElements()) {
        logError("Required elements not found - initialisation failed");
        return false;
      }

      // Set up event listeners
      setupAddFilterButton();

      initialised = true;
      logInfo("Filter Builder initialised successfully");

      return true;
    },

    /**
     * Checks if the filter builder has been initialised
     * @returns {boolean} True if initialised
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Adds a new filter row to the filter builder
     * @param {string} [endpoint] - Current endpoint to filter available fields ('overall' or 'issues')
     * @returns {HTMLElement|null} The created filter row, or null if failed
     */
    addFilterRow: function (endpoint) {
      if (!elements.filterRows) {
        logError("Filter rows container not found");
        return null;
      }

      const row = createFilterRow(endpoint);
      elements.filterRows.appendChild(row);

      // Populate icons in dynamically added content
      if (typeof IconLibrary !== "undefined" && IconLibrary.populateIcons) {
        IconLibrary.populateIcons();
      }

      // Focus the field select for usability
      const fieldSelect = row.querySelector(".ally-filter-field");
      if (fieldSelect) {
        fieldSelect.focus();
      }

      // Announce for screen readers
      announceToScreenReader("Filter added. Select a field.");

      logDebug("Filter row added (endpoint: " + (endpoint || "all") + ")");
      return row;
    },

    /**
     * Updates all existing filter rows when endpoint changes
     * Repopulates field dropdowns and resets invalid selections
     * @param {string} endpoint - New endpoint ('overall' or 'issues')
     */
    updateForEndpoint: function (endpoint) {
      if (!elements.filterRows || typeof ALLY_CONFIG === "undefined") return;

      const rows = elements.filterRows.querySelectorAll(".ally-filter-row");
      let resetCount = 0;

      rows.forEach(function (row) {
        const fieldSelect = row.querySelector(".ally-filter-field");
        if (!fieldSelect) return;

        // Store current selection before repopulating
        const currentValue = fieldSelect.value;
        const currentLabel = fieldSelect.value
          ? fieldSelect.options[fieldSelect.selectedIndex]?.textContent
          : null;

        // Repopulate the dropdown with fields valid for new endpoint
        repopulateFieldSelect(fieldSelect, endpoint);

        // Try to restore previous selection if still valid
        if (currentValue) {
          if (ALLY_CONFIG.isFieldValidForEndpoint(currentValue, endpoint)) {
            // Field is still valid, restore selection
            fieldSelect.value = currentValue;
          } else {
            // Field is no longer valid, reset
            fieldSelect.value = "";
            handleFieldChange(row.id, "");
            resetCount++;
            logWarn(
              "Field '" +
                currentLabel +
                "' is not available for " +
                endpoint +
                " endpoint",
            );
          }
        }
      });

      if (resetCount > 0) {
        announceToScreenReader(
          resetCount +
            " filter" +
            (resetCount > 1 ? "s were" : " was") +
            " reset because " +
            (resetCount > 1 ? "they are" : "it is") +
            " not available for the " +
            endpoint +
            " endpoint",
        );
      }

      logDebug(
        "Updated filters for endpoint: " +
          endpoint +
          " (repopulated " +
          rows.length +
          " dropdowns, reset " +
          resetCount +
          " fields)",
      );
    },

    /**
     * Gets the current number of filter rows
     * @returns {number} Number of filter rows
     */
    getFilterCount: function () {
      if (!elements.filterRows) return 0;
      return elements.filterRows.querySelectorAll(".ally-filter-row").length;
    },

    /**
     * Gets all current filters as an array of objects
     * @returns {Array<{field: string, operator: string, value: string, noOperator: boolean}>} Array of filter objects
     */
    getFilters: function () {
      const filters = [];

      if (!elements.filterRows) return filters;

      const rows = elements.filterRows.querySelectorAll(".ally-filter-row");

      rows.forEach(function (row) {
        const fieldSelect = row.querySelector(".ally-filter-field");
        const operatorSelect = row.querySelector(".ally-filter-operator");
        const valueInput = row.querySelector(".ally-filter-value");

        if (fieldSelect && valueInput) {
          const field = fieldSelect.value;
          const operator = operatorSelect ? operatorSelect.value : "";
          let value = valueInput.value;

          // Check if field supports operators
          let noOperator = false;
          if (typeof ALLY_CONFIG !== "undefined" && field) {
            const fieldDef = ALLY_CONFIG.getFieldDefinition(field);
            if (fieldDef) {
              noOperator = !!fieldDef.noOperator;

              // Convert score percentage to decimal (0-1)
              if (fieldDef.isScore) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  value = (numValue / 100).toString();
                }
              }
            }
          }

          // Include if field and value are set
          // For noOperator fields, operator can be empty
          const hasValidOperator = noOperator || operator;
          if (field && hasValidOperator && value !== "") {
            filters.push({
              field: field,
              operator: operator,
              value: value,
              noOperator: noOperator,
            });
          }
        }
      });

      logDebug("Got " + filters.length + " valid filters");
      return filters;
    },
    /**
     * Serialises filters to URL query parameter format
     * @param {Array<{field: string, operator: string, value: string}>} filters - Array of filter objects
     * @returns {string} URL query string (without leading ?)
     *
     * @example
     * // Single filter
     * serialiseFilters([{field: 'termName', operator: 'co', value: '2024'}])
     * // Returns: 'termName=co:2024'
     *
     * // Multiple filters
     * serialiseFilters([
     *   {field: 'termName', operator: 'co', value: '2024'},
     *   {field: 'overallScore', operator: 'lt', value: '0.7'}
     * ])
     * // Returns: 'termName=co:2024&overallScore=lt:0.7'
     */
    serialiseFilters: function (filters) {
      if (!Array.isArray(filters) || filters.length === 0) {
        return "";
      }

      const params = filters
        .map(function (filter) {
          if (filter.field && filter.operator && filter.value !== "") {
            // Encode value for URL safety
            const encodedValue = encodeURIComponent(filter.value);
            return (
              encodeURIComponent(filter.field) +
              "=" +
              encodeURIComponent(filter.operator) +
              ":" +
              encodedValue
            );
          }
          return null;
        })
        .filter(function (param) {
          return param !== null;
        });

      const result = params.join("&");
      logDebug("Serialised filters: " + result);
      return result;
    },

    /**
     * Clears all filter rows
     */
    clearFilters: function () {
      if (!elements.filterRows) return;

      elements.filterRows.innerHTML = "";
      filterRowCounter = 0;

      announceToScreenReader("All filters cleared");
      logInfo("Filters cleared");
    },

    /**
     * Removes a specific filter row by ID
     * @param {string} rowId - The filter row ID to remove
     */
    removeFilter: function (rowId) {
      removeFilterRow(rowId);
    },

    /**
     * Gets the filter builder container element
     * @returns {HTMLElement|null} The filter builder container
     */
    getContainer: function () {
      return elements.filterBuilder;
    },

    /**
     * Validates all current filters
     * @returns {{valid: boolean, errors: string[]}} Validation result
     */
    validateFilters: function () {
      const errors = [];

      if (!elements.filterRows) {
        return { valid: true, errors: [] };
      }

      const rows = elements.filterRows.querySelectorAll(".ally-filter-row");

      rows.forEach(function (row, index) {
        const fieldSelect = row.querySelector(".ally-filter-field");
        const operatorSelect = row.querySelector(".ally-filter-operator");
        const valueInput = row.querySelector(".ally-filter-value");

        const rowNum = index + 1;

        if (fieldSelect && fieldSelect.value) {
          // Field is selected, check other fields
          if (!operatorSelect || !operatorSelect.value) {
            errors.push("Filter " + rowNum + ": Please select an operator");
          }
          if (!valueInput || valueInput.value === "") {
            errors.push("Filter " + rowNum + ": Please enter a value");
          }

          // Validate number fields
          if (valueInput && valueInput.type === "number") {
            const numValue = parseFloat(valueInput.value);
            if (valueInput.value !== "" && isNaN(numValue)) {
              errors.push("Filter " + rowNum + ": Please enter a valid number");
            }
          }
        }
      });

      return {
        valid: errors.length === 0,
        errors: errors,
      };
    },
  };

  // Return the public API
  return publicAPI;
})();

// ========================================================================
// Console Test Function
// ========================================================================

/**
 * Tests ALLY_FILTER_BUILDER functionality
 * @returns {boolean} True if all tests pass
 */
window.testAllyFilterBuilder = function () {
  console.group("ALLY_FILTER_BUILDER Tests");

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
  test("ALLY_FILTER_BUILDER exists", typeof ALLY_FILTER_BUILDER === "object");
  test(
    "has initialise method",
    typeof ALLY_FILTER_BUILDER.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_FILTER_BUILDER.isInitialised === "function",
  );
  test(
    "has addFilterRow method",
    typeof ALLY_FILTER_BUILDER.addFilterRow === "function",
  );
  test(
    "has getFilters method",
    typeof ALLY_FILTER_BUILDER.getFilters === "function",
  );
  test(
    "has serialiseFilters method",
    typeof ALLY_FILTER_BUILDER.serialiseFilters === "function",
  );
  test(
    "has clearFilters method",
    typeof ALLY_FILTER_BUILDER.clearFilters === "function",
  );
  test(
    "has getFilterCount method",
    typeof ALLY_FILTER_BUILDER.getFilterCount === "function",
  );
  test(
    "has validateFilters method",
    typeof ALLY_FILTER_BUILDER.validateFilters === "function",
  );

  // Initialisation test
  if (!ALLY_FILTER_BUILDER.isInitialised()) {
    ALLY_FILTER_BUILDER.initialise();
  }
  test(
    "isInitialised returns true after init",
    ALLY_FILTER_BUILDER.isInitialised() === true,
  );

  // Clear any existing filters first
  ALLY_FILTER_BUILDER.clearFilters();
  test(
    "clearFilters resets count to 0",
    ALLY_FILTER_BUILDER.getFilterCount() === 0,
  );

  // Test adding filter rows
  const row1 = ALLY_FILTER_BUILDER.addFilterRow();
  test("addFilterRow returns element", row1 !== null);
  test(
    "getFilterCount returns 1 after adding",
    ALLY_FILTER_BUILDER.getFilterCount() === 1,
  );

  ALLY_FILTER_BUILDER.addFilterRow();
  test(
    "getFilterCount returns 2 after second add",
    ALLY_FILTER_BUILDER.getFilterCount() === 2,
  );

  // Test serialisation
  const testFilters = [
    { field: "termName", operator: "co", value: "2024" },
    { field: "overallScore", operator: "lt", value: "0.7" },
  ];
  const serialised = ALLY_FILTER_BUILDER.serialiseFilters(testFilters);
  test(
    "serialiseFilters produces correct output",
    serialised === "termName=co:2024&overallScore=lt:0.7",
  );

  // Test empty serialisation
  test(
    "serialiseFilters with empty array returns empty string",
    ALLY_FILTER_BUILDER.serialiseFilters([]) === "",
  );

  // Test single filter serialisation
  const singleFilter = [{ field: "courseName", operator: "eq", value: "Test" }];
  test(
    "serialiseFilters single filter works",
    ALLY_FILTER_BUILDER.serialiseFilters(singleFilter) === "courseName=eq:Test",
  );

  // Clean up
  ALLY_FILTER_BUILDER.clearFilters();
  test(
    "clearFilters works after tests",
    ALLY_FILTER_BUILDER.getFilterCount() === 0,
  );

  // Test validation on empty state
  const emptyValidation = ALLY_FILTER_BUILDER.validateFilters();
  test(
    "validateFilters on empty returns valid",
    emptyValidation.valid === true,
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
