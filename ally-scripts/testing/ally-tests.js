/**
 * @fileoverview Ally Accessibility Reporting Tool - Test Suite
 * @module AllyTests
 * @requires ALLY_CONFIG
 * @requires ALLY_LOOKUP
 * @requires ALLY_API_CLIENT
 * @requires ALLY_UI_MANAGER
 * @requires ALLY_MAIN_CONTROLLER
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Consolidated test suite for all Ally Reporting Tool modules.
 * Provides individual module tests and a comprehensive test runner.
 *
 * Usage:
 * - testAllyConfig()        - Test configuration module
 * - testAllyUIManager()     - Test UI manager module
 * - testAllyMainController() - Test main controller module
 * - testAllyUI()            - Run all UI-related tests (Phase 3 acceptance)
 * - testAllyAll()           - Run complete test suite
 */

(function () {
  "use strict";

  // ========================================================================
  // Test Utilities
  // ========================================================================

  /**
   * Creates a test runner with pass/fail tracking
   * @param {string} suiteName - Name of the test suite
   * @returns {Object} Test runner object
   */
  function createTestRunner(suiteName) {
    let passed = 0;
    let failed = 0;

    return {
      /**
       * Runs a single test
       * @param {string} name - Test name
       * @param {boolean} condition - Test condition (true = pass)
       */
      test: function (name, condition) {
        if (condition) {
          console.log("✓ " + name);
          passed++;
        } else {
          console.error("✗ " + name);
          failed++;
        }
      },

      /**
       * Starts the test suite (opens console group)
       */
      start: function () {
        console.group(suiteName);
      },

      /**
       * Ends the test suite and returns results
       * @returns {boolean} True if all tests passed
       */
      end: function () {
        console.log("\n" + passed + " passed, " + failed + " failed");
        console.groupEnd();
        return failed === 0;
      },

      /**
       * Gets current results
       * @returns {{passed: number, failed: number}}
       */
      getResults: function () {
        return { passed: passed, failed: failed };
      },
    };
  }

  // ========================================================================
  // ALLY_CONFIG Tests
  // ========================================================================

  /**
   * Tests ALLY_CONFIG functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyConfig() {
    const runner = createTestRunner("ALLY_CONFIG Tests");
    runner.start();

    // Test 1: Config exists
    runner.test("ALLY_CONFIG exists", typeof ALLY_CONFIG === "object");

    // Test 2: Regions accessible
    runner.test(
      "REGIONS.EU.baseUrl correct",
      ALLY_CONFIG.REGIONS.EU.baseUrl === "https://prod-eu-central-1.ally.ac",
    );

    // Test 3: Polling config
    runner.test(
      "POLLING.MAX_ATTEMPTS is 30",
      ALLY_CONFIG.POLLING.MAX_ATTEMPTS === 30,
    );

    // Test 4: getApiUrl works
    const testUrl = ALLY_CONFIG.getApiUrl("OVERALL", "test-client", "EU");
    runner.test(
      "getApiUrl returns correct URL",
      testUrl ===
        "https://prod-eu-central-1.ally.ac/api/v2/clients/test-client/reports/overall",
    );

    // Test 5: getApiUrl with invalid region returns null
    runner.test(
      "getApiUrl with invalid region returns null",
      ALLY_CONFIG.getApiUrl("OVERALL", "test-client", "INVALID") === null,
    );

    // Test 6: getScoreColourClass works
    runner.test(
      "getScoreColourClass(0.95) returns score-excellent",
      ALLY_CONFIG.getScoreColourClass(0.95) === "score-excellent",
    );

    runner.test(
      "getScoreColourClass(0.85) returns score-good",
      ALLY_CONFIG.getScoreColourClass(0.85) === "score-good",
    );

    runner.test(
      "getScoreColourClass(0.55) returns score-fair",
      ALLY_CONFIG.getScoreColourClass(0.55) === "score-fair",
    );

    runner.test(
      "getScoreColourClass(0.35) returns score-poor",
      ALLY_CONFIG.getScoreColourClass(0.35) === "score-poor",
    );

    runner.test(
      "getScoreColourClass(0.15) returns score-very-poor",
      ALLY_CONFIG.getScoreColourClass(0.15) === "score-very-poor",
    );

    runner.test(
      "getScoreColourClass(null) returns score-unknown",
      ALLY_CONFIG.getScoreColourClass(null) === "score-unknown",
    );

    // Test 7: formatScoreAsPercentage works
    runner.test(
      'formatScoreAsPercentage(0.856) returns "85.6%"',
      ALLY_CONFIG.formatScoreAsPercentage(0.856) === "85.6%",
    );

    runner.test(
      'formatScoreAsPercentage(0.856, 2) returns "85.60%"',
      ALLY_CONFIG.formatScoreAsPercentage(0.856, 2) === "85.60%",
    );

    runner.test(
      'formatScoreAsPercentage(null) returns "N/A"',
      ALLY_CONFIG.formatScoreAsPercentage(null) === "N/A",
    );

    // Test 8: getPollingMessage works
    runner.test(
      "getPollingMessage(5) contains attempt count",
      ALLY_CONFIG.getPollingMessage(5).includes("5/30"),
    );

    // Test 9: isValidRegion works
    runner.test(
      'isValidRegion("EU") returns true',
      ALLY_CONFIG.isValidRegion("EU") === true,
    );

    runner.test(
      'isValidRegion("XX") returns false',
      ALLY_CONFIG.isValidRegion("XX") === false,
    );

    // Test 10: getAvailableRegions returns array
    const regions = ALLY_CONFIG.getAvailableRegions();
    runner.test(
      "getAvailableRegions returns 5 regions",
      Array.isArray(regions) && regions.length === 5,
    );

    // Test 11: getOperatorsForField works
    const numberOps = ALLY_CONFIG.getOperatorsForField("overallScore");
    runner.test(
      "getOperatorsForField for number field returns operators",
      Array.isArray(numberOps) && numberOps.length > 0,
    );

    // Test 11b: Number operators include 'ne' (API requirement)
    const hasNumberNe = numberOps.some(function (op) {
      return op.value === "ne";
    });
    runner.test(
      "Number operators include 'ne' (not equal)",
      hasNumberNe === true,
    );

    const stringOps = ALLY_CONFIG.getOperatorsForField("courseName");
    runner.test(
      "getOperatorsForField for string field returns operators",
      Array.isArray(stringOps) && stringOps.length > 0,
    );

    // Test 11c: Boolean operators include 'ne' (API requirement)
    const boolOps = ALLY_CONFIG.getOperatorsForField("allyEnabled");
    const hasBoolNe = boolOps.some(function (op) {
      return op.value === "ne";
    });
    runner.test(
      "Boolean operators include 'ne' (not equal)",
      hasBoolNe === true,
    );

    // Test 12: validateConfiguration works
    const validation = ALLY_CONFIG.validateConfiguration();
    runner.test(
      "validateConfiguration returns valid",
      validation.valid === true,
    );

    // Test 13: Filter fields exist (API-valid fields)
    runner.test(
      "FILTER_FIELDS contains overallScore",
      ALLY_CONFIG.FILTER_FIELDS.overallScore !== undefined,
    );

    runner.test(
      "FILTER_FIELDS contains courseName (courseId removed as not user-friendly)",
      ALLY_CONFIG.FILTER_FIELDS.courseName !== undefined,
    );

    runner.test(
      "FILTER_FIELDS contains departmentName (departmentId removed as not user-friendly)",
      ALLY_CONFIG.FILTER_FIELDS.departmentName !== undefined,
    );

    runner.test(
      "FILTER_FIELDS contains wysiwygScore (LMS feature)",
      ALLY_CONFIG.FILTER_FIELDS.wysiwygScore !== undefined,
    );

    // Test 14: isScoreField works
    runner.test(
      'isScoreField("overallScore") returns true',
      ALLY_CONFIG.isScoreField("overallScore") === true,
    );

    runner.test(
      'isScoreField("wysiwygScore") returns true',
      ALLY_CONFIG.isScoreField("wysiwygScore") === true,
    );

    runner.test(
      'isScoreField("courseName") returns false',
      ALLY_CONFIG.isScoreField("courseName") === false,
    );

    // Test 15: Storage keys exist
    runner.test(
      "STORAGE_KEYS.TOKEN exists",
      ALLY_CONFIG.STORAGE_KEYS.TOKEN === "ally-api-token",
    );

    return runner.end();
  }

  // ========================================================================
  // ALLY_UI_MANAGER Tests
  // ========================================================================

  /**
   * Tests ALLY_UI_MANAGER functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyUIManager() {
    const runner = createTestRunner("ALLY_UI_MANAGER Tests");
    runner.start();

    // Test 1: Module exists
    runner.test("ALLY_UI_MANAGER exists", typeof ALLY_UI_MANAGER === "object");

    // Test 2: Has required methods
    runner.test(
      "has initialise method",
      typeof ALLY_UI_MANAGER.initialise === "function",
    );
    runner.test(
      "has isInitialised method",
      typeof ALLY_UI_MANAGER.isInitialised === "function",
    );
    runner.test(
      "has getElement method",
      typeof ALLY_UI_MANAGER.getElement === "function",
    );
    runner.test(
      "has populateTermDropdown method",
      typeof ALLY_UI_MANAGER.populateTermDropdown === "function",
    );
    runner.test(
      "has populateDepartmentDropdown method",
      typeof ALLY_UI_MANAGER.populateDepartmentDropdown === "function",
    );
    runner.test(
      "has showProgress method",
      typeof ALLY_UI_MANAGER.showProgress === "function",
    );
    runner.test(
      "has showResults method",
      typeof ALLY_UI_MANAGER.showResults === "function",
    );
    runner.test(
      "has updateProgress method",
      typeof ALLY_UI_MANAGER.updateProgress === "function",
    );
    runner.test(
      "has announce method",
      typeof ALLY_UI_MANAGER.announce === "function",
    );

    // Test 3: Initialisation (if not already done)
    if (!ALLY_UI_MANAGER.isInitialised()) {
      ALLY_UI_MANAGER.initialise();
    }
    runner.test(
      "isInitialised returns true after init",
      ALLY_UI_MANAGER.isInitialised() === true,
    );

    // Test 4: Element access
    runner.test(
      "getElement returns client-id input",
      ALLY_UI_MANAGER.getElement("ally-client-id") !== null,
    );
    runner.test(
      "getElement returns api-token input",
      ALLY_UI_MANAGER.getElement("ally-api-token") !== null,
    );
    runner.test(
      "getElement returns region-select",
      ALLY_UI_MANAGER.getElement("ally-region-select") !== null,
    );

    // Test 5: Dropdowns populated
    const termSelect = document.getElementById("ally-term-select");
    const deptSelect = document.getElementById("ally-department-select");
    runner.test(
      "Term dropdown has options",
      termSelect && termSelect.options.length > 1,
    );
    runner.test(
      "Department dropdown has options",
      deptSelect && deptSelect.options.length > 1,
    );

    // Test 6: getFormValues returns object
    const formValues = ALLY_UI_MANAGER.getFormValues();
    runner.test("getFormValues returns object", typeof formValues === "object");
    runner.test(
      "getFormValues has region property",
      formValues.hasOwnProperty("region"),
    );
    runner.test(
      "getFormValues has clientId property",
      formValues.hasOwnProperty("clientId"),
    );
    runner.test(
      "getFormValues has token property",
      formValues.hasOwnProperty("token"),
    );

    // Test 7: Progress functionality
    ALLY_UI_MANAGER.showProgress(true);
    const progressSection = document.getElementById("ally-progress-section");
    runner.test(
      "showProgress(true) shows section",
      progressSection && !progressSection.hidden,
    );

    ALLY_UI_MANAGER.updateProgress(50, "Test message");
    const progressFill = document.getElementById("ally-progress-fill");
    runner.test(
      "updateProgress sets fill width",
      progressFill && progressFill.style.width === "50%",
    );

    ALLY_UI_MANAGER.showProgress(false);
    runner.test(
      "showProgress(false) hides section",
      progressSection && progressSection.hidden,
    );

    return runner.end();
  }

  // ========================================================================
  // ALLY_MAIN_CONTROLLER Tests
  // ========================================================================

  /**
   * Tests ALLY_MAIN_CONTROLLER functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyMainController() {
    const runner = createTestRunner("ALLY_MAIN_CONTROLLER Tests");
    runner.start();

    // Test 1: Module exists
    runner.test(
      "ALLY_MAIN_CONTROLLER exists",
      typeof ALLY_MAIN_CONTROLLER === "object",
    );

    // Test 2: Has required methods
    runner.test(
      "has initialise method",
      typeof ALLY_MAIN_CONTROLLER.initialise === "function",
    );
    runner.test(
      "has isInitialised method",
      typeof ALLY_MAIN_CONTROLLER.isInitialised === "function",
    );
    runner.test(
      "has testConnection method",
      typeof ALLY_MAIN_CONTROLLER.testConnection === "function",
    );
    runner.test(
      "has executeQuery method",
      typeof ALLY_MAIN_CONTROLLER.executeQuery === "function",
    );
    runner.test(
      "has cancelQuery method",
      typeof ALLY_MAIN_CONTROLLER.cancelQuery === "function",
    );
    runner.test(
      "has clearFilters method",
      typeof ALLY_MAIN_CONTROLLER.clearFilters === "function",
    );

    // Test 3: Initialisation (if not already done)
    if (!ALLY_MAIN_CONTROLLER.isInitialised()) {
      ALLY_MAIN_CONTROLLER.initialise();
    }
    runner.test(
      "isInitialised returns true after init",
      ALLY_MAIN_CONTROLLER.isInitialised() === true,
    );

    return runner.end();
  }

  // ========================================================================
  // ALLY_API_CLIENT Tests
  // ========================================================================

  /**
   * Tests ALLY_API_CLIENT functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyApiClient() {
    const runner = createTestRunner("ALLY_API_CLIENT Tests");
    runner.start();

    // Test 1: Module exists
    runner.test("ALLY_API_CLIENT exists", typeof ALLY_API_CLIENT === "object");

    // Test 2: Required methods exist
    runner.test(
      "setCredentials method exists",
      typeof ALLY_API_CLIENT.setCredentials === "function",
    );
    runner.test(
      "getCredentials method exists",
      typeof ALLY_API_CLIENT.getCredentials === "function",
    );
    runner.test(
      "clearCredentials method exists",
      typeof ALLY_API_CLIENT.clearCredentials === "function",
    );
    runner.test(
      "loadSavedCredentials method exists",
      typeof ALLY_API_CLIENT.loadSavedCredentials === "function",
    );
    runner.test(
      "saveCredentials method exists",
      typeof ALLY_API_CLIENT.saveCredentials === "function",
    );
    runner.test(
      "hasCredentials method exists",
      typeof ALLY_API_CLIENT.hasCredentials === "function",
    );

    // Test 3: Region methods exist
    runner.test(
      "setRegion method exists",
      typeof ALLY_API_CLIENT.setRegion === "function",
    );
    runner.test(
      "getRegion method exists",
      typeof ALLY_API_CLIENT.getRegion === "function",
    );
    runner.test(
      "getRegionInfo method exists",
      typeof ALLY_API_CLIENT.getRegionInfo === "function",
    );

    // Test 4: API methods exist
    runner.test(
      "fetchOverall method exists",
      typeof ALLY_API_CLIENT.fetchOverall === "function",
    );
    runner.test(
      "fetchIssues method exists",
      typeof ALLY_API_CLIENT.fetchIssues === "function",
    );
    runner.test(
      "testConnection method exists",
      typeof ALLY_API_CLIENT.testConnection === "function",
    );

    // Test 5: Control methods exist
    runner.test(
      "cancelRequest method exists",
      typeof ALLY_API_CLIENT.cancelRequest === "function",
    );
    runner.test(
      "isRequestInProgress method exists",
      typeof ALLY_API_CLIENT.isRequestInProgress === "function",
    );

    // Test 6: ERROR_TYPES exposed
    runner.test(
      "ERROR_TYPES exists",
      typeof ALLY_API_CLIENT.ERROR_TYPES === "object",
    );
    runner.test(
      "ERROR_TYPES.AUTH exists",
      ALLY_API_CLIENT.ERROR_TYPES.AUTH === "auth",
    );

    // Test 7: Credential management
    ALLY_API_CLIENT.clearCredentials();
    runner.test(
      "hasCredentials returns false when no credentials",
      ALLY_API_CLIENT.hasCredentials() === false,
    );

    const setResult = ALLY_API_CLIENT.setCredentials("test-token-12345", "577");
    runner.test(
      "setCredentials returns true for valid input",
      setResult === true,
    );
    runner.test(
      "hasCredentials returns true after setting",
      ALLY_API_CLIENT.hasCredentials() === true,
    );

    const creds = ALLY_API_CLIENT.getCredentials();
    runner.test(
      "getCredentials returns masked token",
      creds.token.includes("..."),
    );
    runner.test("getCredentials returns clientId", creds.clientId === "577");

    ALLY_API_CLIENT.clearCredentials();
    runner.test(
      "clearCredentials clears credentials",
      ALLY_API_CLIENT.hasCredentials() === false,
    );

    // Test 8: Invalid credential handling
    const badTokenResult = ALLY_API_CLIENT.setCredentials("", "valid");
    runner.test("setCredentials rejects empty token", badTokenResult === false);

    const badClientResult = ALLY_API_CLIENT.setCredentials("valid", "");
    runner.test(
      "setCredentials rejects empty clientId",
      badClientResult === false,
    );

    // Test 9: Region management
    runner.test(
      "getRegion returns default EU",
      ALLY_API_CLIENT.getRegion() === "EU",
    );

    const regionResult = ALLY_API_CLIENT.setRegion("US");
    runner.test(
      "setRegion returns true for valid region",
      regionResult === true,
    );
    runner.test(
      "getRegion returns US after setting",
      ALLY_API_CLIENT.getRegion() === "US",
    );

    const invalidRegionResult = ALLY_API_CLIENT.setRegion("INVALID");
    runner.test(
      "setRegion returns false for invalid region",
      invalidRegionResult === false,
    );
    runner.test(
      "getRegion still returns US after invalid attempt",
      ALLY_API_CLIENT.getRegion() === "US",
    );

    ALLY_API_CLIENT.setRegion("EU"); // Reset to default

    const regionInfo = ALLY_API_CLIENT.getRegionInfo();
    runner.test(
      "getRegionInfo returns region object",
      regionInfo && regionInfo.name === "European Union",
    );

    // Test 10: Request state
    runner.test(
      "isRequestInProgress returns false initially",
      ALLY_API_CLIENT.isRequestInProgress() === false,
    );
    runner.test(
      "cancelRequest returns false when no request",
      ALLY_API_CLIENT.cancelRequest() === false,
    );

    return runner.end();
  }

  // ========================================================================
  // API Client Helper Functions (require credentials)
  // ========================================================================

  /**
   * Tests API connection with current credentials
   * @returns {Promise<boolean>} True if connection successful
   */
  async function testAllyConnection() {
    console.group("Ally Connection Test");

    if (!ALLY_API_CLIENT.hasCredentials()) {
      console.error(
        "✗ No credentials set. Use ALLY_API_CLIENT.setCredentials(token, clientId) first.",
      );
      console.groupEnd();
      return false;
    }

    const creds = ALLY_API_CLIENT.getCredentials();
    console.log("Testing connection with:");
    console.log("  Client ID:", creds.clientId);
    console.log("  Region:", creds.region);
    console.log("  Token:", creds.token);

    try {
      const result = await ALLY_API_CLIENT.testConnection();
      if (result) {
        console.log("✓ Connection successful!");
      } else {
        console.error("✗ Connection failed");
      }
      console.groupEnd();
      return result;
    } catch (error) {
      console.error("✗ Connection error:", error.message);
      console.groupEnd();
      return false;
    }
  }

  /**
   * Runs a test query with specified limit
   * @param {number} [limit=5] - Number of results to fetch
   * @returns {Promise<Object|null>} Query result or null on error
   */
  async function testAllyQuery(limit) {
    limit = limit || 5;

    console.group("Ally Test Query (limit: " + limit + ")");

    if (!ALLY_API_CLIENT.hasCredentials()) {
      console.error(
        "✗ No credentials set. Use ALLY_API_CLIENT.setCredentials(token, clientId) first.",
      );
      console.groupEnd();
      return null;
    }

    const creds = ALLY_API_CLIENT.getCredentials();
    console.log("Querying with:");
    console.log("  Client ID:", creds.clientId);
    console.log("  Region:", creds.region);
    console.log("  Limit:", limit);

    try {
      const result = await ALLY_API_CLIENT.fetchOverall({
        limit: limit,
        onProgress: function (progress) {
          console.log("  Progress:", progress.message);
        },
      });

      console.log("✓ Query successful!");
      console.log("  Total records:", result.metadata?.total);
      console.log("  Filtered total:", result.metadata?.filteredTotal);
      console.log(
        "  Results returned:",
        result.data?.length,
        "(from",
        result.metadata?.from,
        "to",
        result.metadata?.to + ")",
      );

      if (result.data && result.data.length > 0) {
        console.log("  First result:", result.data[0]);
      }

      console.groupEnd();
      return result;
    } catch (error) {
      console.error("✗ Query failed:", error.message);
      console.error("  Error type:", error.type);
      console.groupEnd();
      return null;
    }
  }

  /**
   * Cancels any in-progress request (for testing cancellation)
   * @returns {boolean} True if a request was cancelled
   */
  function cancelAllyRequest() {
    const cancelled = ALLY_API_CLIENT.cancelRequest();
    if (cancelled) {
      console.log("✓ Request cancelled");
    } else {
      console.log("No request to cancel");
    }
    return cancelled;
  }

  // ========================================================================
  // Combined Test Suites
  // ========================================================================

  /**
   * Phase 3 acceptance test - tests UI components
   * @returns {boolean} True if all tests pass
   */
  function testAllyUI() {
    console.group("Ally UI Tests (Phase 3 Acceptance)");

    let allPassed = true;

    // Test UI Manager
    if (!testAllyUIManager()) {
      allPassed = false;
    }

    // Test Main Controller
    if (typeof ALLY_MAIN_CONTROLLER !== "undefined") {
      if (!testAllyMainController()) {
        allPassed = false;
      }
    } else {
      console.warn(
        "ALLY_MAIN_CONTROLLER not loaded - skipping controller tests",
      );
    }

    console.log(
      "\n" +
        (allPassed ? "✓ All Phase 3 tests passed!" : "✗ Some tests failed"),
    );
    console.groupEnd();

    return allPassed;
  }

  /**
   * Tests ALLY_FILTER_BUILDER functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyFilterBuilder() {
    const runner = createTestRunner("ALLY_FILTER_BUILDER Tests");
    runner.start();

    // Module existence tests
    runner.test(
      "ALLY_FILTER_BUILDER exists",
      typeof ALLY_FILTER_BUILDER === "object",
    );
    runner.test(
      "has initialise method",
      typeof ALLY_FILTER_BUILDER.initialise === "function",
    );
    runner.test(
      "has isInitialised method",
      typeof ALLY_FILTER_BUILDER.isInitialised === "function",
    );
    runner.test(
      "has addFilterRow method",
      typeof ALLY_FILTER_BUILDER.addFilterRow === "function",
    );
    runner.test(
      "has getFilters method",
      typeof ALLY_FILTER_BUILDER.getFilters === "function",
    );
    runner.test(
      "has serialiseFilters method",
      typeof ALLY_FILTER_BUILDER.serialiseFilters === "function",
    );
    runner.test(
      "has clearFilters method",
      typeof ALLY_FILTER_BUILDER.clearFilters === "function",
    );
    runner.test(
      "has getFilterCount method",
      typeof ALLY_FILTER_BUILDER.getFilterCount === "function",
    );

    // Initialisation test
    if (!ALLY_FILTER_BUILDER.isInitialised()) {
      ALLY_FILTER_BUILDER.initialise();
    }
    runner.test(
      "isInitialised returns true after init",
      ALLY_FILTER_BUILDER.isInitialised() === true,
    );

    // Clear any existing filters first
    ALLY_FILTER_BUILDER.clearFilters();
    runner.test(
      "clearFilters resets count to 0",
      ALLY_FILTER_BUILDER.getFilterCount() === 0,
    );

    // Test serialisation (core functionality)
    const testFilters = [
      { field: "termName", operator: "co", value: "2024" },
      { field: "overallScore", operator: "lt", value: "0.7" },
    ];
    const serialised = ALLY_FILTER_BUILDER.serialiseFilters(testFilters);
    runner.test(
      "serialiseFilters produces correct output",
      serialised === "termName=co:2024&overallScore=lt:0.7",
    );

    // Test empty serialisation
    runner.test(
      "serialiseFilters with empty array returns empty string",
      ALLY_FILTER_BUILDER.serialiseFilters([]) === "",
    );

    // Test single filter serialisation
    const singleFilter = [
      { field: "courseName", operator: "eq", value: "Test" },
    ];
    runner.test(
      "serialiseFilters single filter works",
      ALLY_FILTER_BUILDER.serialiseFilters(singleFilter) ===
        "courseName=eq:Test",
    );

    return runner.end();
  }

  /**
   * Runs complete test suite for all Ally modules
   * @returns {boolean} True if all tests pass
   */
  function testAllyAll() {
    console.group("Ally Complete Test Suite");

    let allPassed = true;
    const results = {
      config: false,
      apiClient: false,
      uiManager: false,
      mainController: false,
      filterBuilder: false,
    };

    // Test Config
    if (typeof ALLY_CONFIG !== "undefined") {
      results.config = testAllyConfig();
      if (!results.config) allPassed = false;
    } else {
      console.warn("ALLY_CONFIG not loaded - skipping config tests");
    }

    // Test API Client
    if (typeof ALLY_API_CLIENT !== "undefined") {
      results.apiClient = testAllyApiClient();
      if (!results.apiClient) allPassed = false;
    } else {
      console.warn("ALLY_API_CLIENT not loaded - skipping API client tests");
    }

    // Test UI Manager
    if (typeof ALLY_UI_MANAGER !== "undefined") {
      results.uiManager = testAllyUIManager();
      if (!results.uiManager) allPassed = false;
    } else {
      console.warn("ALLY_UI_MANAGER not loaded - skipping UI manager tests");
    }

    // Test Main Controller
    if (typeof ALLY_MAIN_CONTROLLER !== "undefined") {
      results.mainController = testAllyMainController();
      if (!results.mainController) allPassed = false;
    } else {
      console.warn(
        "ALLY_MAIN_CONTROLLER not loaded - skipping controller tests",
      );
    }

    // Test Filter Builder
    if (typeof ALLY_FILTER_BUILDER !== "undefined") {
      results.filterBuilder = testAllyFilterBuilder();
      if (!results.filterBuilder) allPassed = false;
    } else {
      console.warn(
        "ALLY_FILTER_BUILDER not loaded - skipping filter builder tests",
      );
    }

    // Summary
    console.log("\n=== Test Summary ===");
    console.log(
      "Config:          " + (results.config ? "✓ PASS" : "✗ FAIL/SKIP"),
    );
    console.log(
      "API Client:      " + (results.apiClient ? "✓ PASS" : "✗ FAIL/SKIP"),
    );
    console.log(
      "UI Manager:      " + (results.uiManager ? "✓ PASS" : "✗ FAIL/SKIP"),
    );
    console.log(
      "Main Controller: " + (results.mainController ? "✓ PASS" : "✗ FAIL/SKIP"),
    );
    console.log(
      "Filter Builder:  " + (results.filterBuilder ? "✓ PASS" : "✗ FAIL/SKIP"),
    );
    console.log(
      "\n" + (allPassed ? "✓ All tests passed!" : "✗ Some tests failed"),
    );
    console.groupEnd();

    return allPassed;
  }

  // ========================================================================
  // ALLY_CACHE Tests
  // ========================================================================

  /**
   * Tests ALLY_CACHE functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyCache() {
    var runner = createTestRunner("ALLY_CACHE Tests");
    runner.start();

    // ====== Module Existence ======
    runner.test("ALLY_CACHE exists", typeof ALLY_CACHE === "object");
    runner.test(
      "has courseReportKey",
      typeof ALLY_CACHE.courseReportKey === "function",
    );
    runner.test(
      "has statementPreviewKey",
      typeof ALLY_CACHE.statementPreviewKey === "function",
    );
    runner.test(
      "has reportBuilderKey",
      typeof ALLY_CACHE.reportBuilderKey === "function",
    );
    runner.test("has get", typeof ALLY_CACHE.get === "function");
    runner.test("has set", typeof ALLY_CACHE.set === "function");
    runner.test("has remove", typeof ALLY_CACHE.remove === "function");
    runner.test("has clear", typeof ALLY_CACHE.clear === "function");
    runner.test("has has", typeof ALLY_CACHE.has === "function");
    runner.test(
      "has getEntriesByType",
      typeof ALLY_CACHE.getEntriesByType === "function",
    );
    runner.test(
      "has getAllEntries",
      typeof ALLY_CACHE.getAllEntries === "function",
    );
    runner.test("has getStats", typeof ALLY_CACHE.getStats === "function");
    runner.test("has getAge", typeof ALLY_CACHE.getAge === "function");
    runner.test("has formatSize", typeof ALLY_CACHE.formatSize === "function");
    runner.test("has formatAge", typeof ALLY_CACHE.formatAge === "function");
    runner.test("has onChange", typeof ALLY_CACHE.onChange === "function");
    runner.test(
      "has getDebugInfo",
      typeof ALLY_CACHE.getDebugInfo === "function",
    );
    runner.test(
      "has MAX_SIZE_BYTES constant",
      typeof ALLY_CACHE.MAX_SIZE_BYTES === "number",
    );
    runner.test(
      "has MAX_ENTRIES constant",
      typeof ALLY_CACHE.MAX_ENTRIES === "number",
    );

    // ====== Key Generation ======
    runner.test(
      "courseReportKey generates correct format",
      ALLY_CACHE.courseReportKey("_12345_1") === "ally-cache-cr-_12345_1",
    );
    runner.test(
      "statementPreviewKey generates correct format",
      ALLY_CACHE.statementPreviewKey("_12345_1") === "ally-cache-sp-_12345_1",
    );
    runner.test(
      "reportBuilderKey starts with correct prefix",
      ALLY_CACHE.reportBuilderKey("overall", {}, "", "asc", 100).indexOf(
        "ally-cache-rb-",
      ) === 0,
    );

    // Same params produce same hash
    var rbKey1 = ALLY_CACHE.reportBuilderKey(
      "overall",
      { termId: "_344_1" },
      "overallScore",
      "asc",
      100,
    );
    var rbKey2 = ALLY_CACHE.reportBuilderKey(
      "overall",
      { termId: "_344_1" },
      "overallScore",
      "asc",
      100,
    );
    runner.test("reportBuilderKey same params = same key", rbKey1 === rbKey2);

    // Different params produce different hash
    var rbKey3 = ALLY_CACHE.reportBuilderKey(
      "overall",
      { termId: "_345_1" },
      "overallScore",
      "asc",
      100,
    );
    runner.test(
      "reportBuilderKey different params = different key",
      rbKey1 !== rbKey3,
    );

    // ====== Core Operations ======
    var testKey = "ally-cache-test-" + Date.now();
    var testEntry = {
      type: "course-report",
      courseId: "_test_1",
      courseName: "Test Course",
      courseCode: "TEST101",
      termName: "Test Term",
      data: { overall: { overallScore: 0.85 }, issues: {} },
    };

    // Set
    ALLY_CACHE.set(testKey, testEntry);
    runner.test("set stores entry", ALLY_CACHE.has(testKey) === true);

    // Get
    var retrieved = ALLY_CACHE.get(testKey);
    runner.test("get retrieves entry", retrieved !== null);
    runner.test(
      "get returns correct courseName",
      retrieved && retrieved.courseName === "Test Course",
    );
    runner.test(
      "get returns correct type",
      retrieved && retrieved.type === "course-report",
    );
    runner.test(
      "get entry has timestamp",
      retrieved && typeof retrieved.timestamp === "number",
    );
    runner.test(
      "get entry has accessedAt",
      retrieved && typeof retrieved.accessedAt === "number",
    );
    runner.test(
      "get entry has size",
      retrieved && typeof retrieved.size === "number",
    );

    // Has
    runner.test(
      "has returns true for existing",
      ALLY_CACHE.has(testKey) === true,
    );
    runner.test(
      "has returns false for non-existing",
      ALLY_CACHE.has("nonexistent-key") === false,
    );

    // Remove
    ALLY_CACHE.remove(testKey);
    runner.test("remove deletes entry", ALLY_CACHE.has(testKey) === false);
    runner.test(
      "get returns null after remove",
      ALLY_CACHE.get(testKey) === null,
    );

    // ====== Query Methods ======
    // Add test entries
    ALLY_CACHE.set("ally-cache-cr-_test1_1", {
      type: "course-report",
      courseId: "_test1_1",
      courseName: "CR Test 1",
      data: {},
    });
    ALLY_CACHE.set("ally-cache-sp-_test1_1", {
      type: "statement-preview",
      courseId: "_test1_1",
      courseName: "SP Test 1",
      data: {},
    });
    ALLY_CACHE.set("ally-cache-rb-test1", {
      type: "report-builder",
      queryDescription: "RB Test 1",
      data: {},
    });

    var crEntries = ALLY_CACHE.getEntriesByType("course-report");
    runner.test("getEntriesByType returns array", Array.isArray(crEntries));
    runner.test(
      "getEntriesByType finds course-report entries",
      crEntries.length >= 1,
    );

    var allEntries = ALLY_CACHE.getAllEntries();
    runner.test("getAllEntries returns array", Array.isArray(allEntries));
    runner.test(
      "getAllEntries returns objects with key and entry",
      allEntries.length > 0 && allEntries[0].key && allEntries[0].entry,
    );

    // Clean up test entries
    ALLY_CACHE.remove("ally-cache-cr-_test1_1");
    ALLY_CACHE.remove("ally-cache-sp-_test1_1");
    ALLY_CACHE.remove("ally-cache-rb-test1");

    // ====== Stats ======
    var stats = ALLY_CACHE.getStats();
    runner.test("getStats returns object", typeof stats === "object");
    runner.test("getStats has totalSize", typeof stats.totalSize === "number");
    runner.test(
      "getStats has entryCount",
      typeof stats.entryCount === "number",
    );
    runner.test("getStats has maxSize", typeof stats.maxSize === "number");
    runner.test(
      "getStats has maxEntries",
      typeof stats.maxEntries === "number",
    );
    runner.test(
      "getStats has usagePercent",
      typeof stats.usagePercent === "number",
    );

    // ====== Utilities ======
    runner.test(
      "formatSize handles bytes",
      ALLY_CACHE.formatSize(500) === "500 B",
    );
    runner.test(
      "formatSize handles KB",
      ALLY_CACHE.formatSize(1024) === "1.0 KB",
    );
    runner.test(
      "formatSize handles KB decimals",
      ALLY_CACHE.formatSize(1536) === "1.5 KB",
    );
    runner.test(
      "formatSize handles MB",
      ALLY_CACHE.formatSize(1048576) === "1.0 MB",
    );
    runner.test("formatSize handles 0", ALLY_CACHE.formatSize(0) === "0 B");

    var oneHourAgo = Date.now() - 60 * 60 * 1000;
    var oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    var justNow = Date.now() - 5000;

    runner.test(
      "formatAge returns string",
      typeof ALLY_CACHE.formatAge(oneHourAgo) === "string",
    );
    runner.test(
      "formatAge handles just now",
      ALLY_CACHE.formatAge(justNow) === "just now",
    );
    runner.test(
      "formatAge handles hours",
      ALLY_CACHE.formatAge(oneHourAgo).indexOf("hour") !== -1,
    );
    runner.test(
      "formatAge handles days",
      ALLY_CACHE.formatAge(oneDayAgo).indexOf("day") !== -1,
    );

    // ====== Age Method ======
    var ageTestKey = "ally-cache-age-test";
    ALLY_CACHE.set(ageTestKey, {
      type: "course-report",
      courseId: "test",
      data: {},
    });
    var ageInfo = ALLY_CACHE.getAge(ageTestKey);
    runner.test("getAge returns object", typeof ageInfo === "object");
    runner.test(
      "getAge has timestamp",
      ageInfo && typeof ageInfo.timestamp === "number",
    );
    runner.test(
      "getAge has ageMs",
      ageInfo && typeof ageInfo.ageMs === "number",
    );
    runner.test(
      "getAge has ageText",
      ageInfo && typeof ageInfo.ageText === "string",
    );
    runner.test(
      "getAge returns null for missing key",
      ALLY_CACHE.getAge("nonexistent") === null,
    );
    ALLY_CACHE.remove(ageTestKey);

    // ====== Change Callback ======
    var callbackFired = false;
    var callbackData = null;

    ALLY_CACHE.onChange(function (event) {
      callbackFired = true;
      callbackData = event;
    });

    ALLY_CACHE.set("ally-cache-callback-test", {
      type: "course-report",
      data: {},
    });
    runner.test("onChange callback fires on set", callbackFired === true);
    runner.test(
      "onChange receives action",
      callbackData && callbackData.action === "set",
    );
    runner.test(
      "onChange receives key",
      callbackData && callbackData.key === "ally-cache-callback-test",
    );
    runner.test(
      "onChange receives stats",
      callbackData && typeof callbackData.stats === "object",
    );

    ALLY_CACHE.remove("ally-cache-callback-test");

    // ====== Debug Info ======
    var debugInfo = ALLY_CACHE.getDebugInfo();
    runner.test("getDebugInfo returns object", typeof debugInfo === "object");
    runner.test(
      "getDebugInfo has stats",
      debugInfo && typeof debugInfo.stats === "object",
    );
    runner.test(
      "getDebugInfo has constants",
      debugInfo && typeof debugInfo.constants === "object",
    );
    runner.test(
      "getDebugInfo has entriesByType",
      debugInfo && typeof debugInfo.entriesByType === "object",
    );

    return runner.end();
  }

  // ========================================================================
  // ALLY_CACHE_UI Tests
  // ========================================================================

  /**
   * Tests ALLY_CACHE_UI functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyCacheUI() {
    var runner = createTestRunner("ALLY_CACHE_UI Tests");
    runner.start();

    // ====== Module Existence ======
    runner.test("ALLY_CACHE_UI exists", typeof ALLY_CACHE_UI === "object");
    runner.test(
      "has initialise",
      typeof ALLY_CACHE_UI.initialise === "function",
    );
    runner.test(
      "has isInitialised",
      typeof ALLY_CACHE_UI.isInitialised === "function",
    );
    runner.test(
      "has updateStatusIndicator",
      typeof ALLY_CACHE_UI.updateStatusIndicator === "function",
    );
    runner.test(
      "has toggleManagerPanel",
      typeof ALLY_CACHE_UI.toggleManagerPanel === "function",
    );
    runner.test(
      "has openManagerPanel",
      typeof ALLY_CACHE_UI.openManagerPanel === "function",
    );
    runner.test(
      "has closeManagerPanel",
      typeof ALLY_CACHE_UI.closeManagerPanel === "function",
    );
    runner.test(
      "has showCachedBanner",
      typeof ALLY_CACHE_UI.showCachedBanner === "function",
    );
    runner.test(
      "has hideCachedBanner",
      typeof ALLY_CACHE_UI.hideCachedBanner === "function",
    );
    runner.test(
      "has showUpdateBanner",
      typeof ALLY_CACHE_UI.showUpdateBanner === "function",
    );
    runner.test(
      "has hideUpdateBanner",
      typeof ALLY_CACHE_UI.hideUpdateBanner === "function",
    );
    runner.test(
      "has showOfflineBanner",
      typeof ALLY_CACHE_UI.showOfflineBanner === "function",
    );
    runner.test(
      "has hideOfflineBanner",
      typeof ALLY_CACHE_UI.hideOfflineBanner === "function",
    );
    runner.test(
      "has showCacheBrowser",
      typeof ALLY_CACHE_UI.showCacheBrowser === "function",
    );
    runner.test(
      "has hideCacheBrowser",
      typeof ALLY_CACHE_UI.hideCacheBrowser === "function",
    );
    runner.test(
      "has getDebugInfo",
      typeof ALLY_CACHE_UI.getDebugInfo === "function",
    );

    // ====== DOM Elements ======
    var statusBtn = document.getElementById("ally-cache-status-btn");
    var managerPanel = document.getElementById("ally-cache-manager-panel");
    var offlineBanner = document.getElementById("ally-cache-offline-banner");
    var cacheBrowser = document.getElementById("ally-cache-browser");

    runner.test("Status button element exists", statusBtn !== null);
    runner.test("Manager panel element exists", managerPanel !== null);
    runner.test("Offline banner element exists", offlineBanner !== null);
    runner.test("Cache browser element exists", cacheBrowser !== null);

    // ====== Accessibility ======
    runner.test(
      "Status button has aria-expanded",
      statusBtn && statusBtn.hasAttribute("aria-expanded"),
    );
    runner.test(
      "Status button has aria-controls",
      statusBtn &&
        statusBtn.getAttribute("aria-controls") === "ally-cache-manager-panel",
    );
    runner.test(
      "Manager panel has role=region",
      managerPanel && managerPanel.getAttribute("role") === "region",
    );
    runner.test(
      "Cache browser has role=dialog",
      cacheBrowser && cacheBrowser.getAttribute("role") === "dialog",
    );
    runner.test(
      "Offline banner has role=alert",
      offlineBanner && offlineBanner.getAttribute("role") === "alert",
    );

    // ====== Initialisation ======
    ALLY_CACHE_UI.initialise();
    runner.test(
      "isInitialised returns true after init",
      ALLY_CACHE_UI.isInitialised() === true,
    );

    // ====== Debug Info ======
    var debugInfo = ALLY_CACHE_UI.getDebugInfo();
    runner.test("getDebugInfo returns object", typeof debugInfo === "object");
    runner.test("debugInfo has initialised", debugInfo.initialised === true);
    runner.test(
      "debugInfo has elementsFound",
      typeof debugInfo.elementsFound === "object",
    );

    // ====== Manager Panel Toggle ======
    // Open
    ALLY_CACHE_UI.openManagerPanel();
    runner.test(
      "openManagerPanel shows panel",
      managerPanel && !managerPanel.hidden,
    );
    runner.test(
      "openManagerPanel sets aria-expanded true",
      statusBtn && statusBtn.getAttribute("aria-expanded") === "true",
    );

    // Close
    ALLY_CACHE_UI.closeManagerPanel();
    runner.test(
      "closeManagerPanel hides panel",
      managerPanel && managerPanel.hidden,
    );
    runner.test(
      "closeManagerPanel sets aria-expanded false",
      statusBtn && statusBtn.getAttribute("aria-expanded") === "false",
    );

    // ====== Offline Banner ======
    ALLY_CACHE_UI.showOfflineBanner();
    runner.test(
      "showOfflineBanner shows banner",
      offlineBanner && !offlineBanner.hidden,
    );

    ALLY_CACHE_UI.hideOfflineBanner();
    runner.test(
      "hideOfflineBanner hides banner",
      offlineBanner && offlineBanner.hidden,
    );

    // ====== Cache Browser ======
    ALLY_CACHE_UI.showCacheBrowser(function () {});
    runner.test(
      "showCacheBrowser shows browser",
      cacheBrowser && !cacheBrowser.hidden,
    );

    ALLY_CACHE_UI.hideCacheBrowser();
    runner.test(
      "hideCacheBrowser hides browser",
      cacheBrowser && cacheBrowser.hidden,
    );

    // ====== Cached Banner (test with mock container) ======
    var testContainer = document.createElement("div");
    testContainer.id = "ally-cache-banner-test";
    document.body.appendChild(testContainer);

    ALLY_CACHE_UI.showCachedBanner(testContainer, Date.now() - 3600000, false);
    var banner = testContainer.querySelector("#ally-cache-data-banner");
    runner.test("showCachedBanner creates banner element", banner !== null);
    runner.test(
      "showCachedBanner banner has cached class",
      banner && banner.classList.contains("ally-cache-banner-cached"),
    );

    ALLY_CACHE_UI.hideCachedBanner(testContainer);
    banner = testContainer.querySelector("#ally-cache-data-banner");
    runner.test("hideCachedBanner removes banner", banner === null);

    // Test error variant
    ALLY_CACHE_UI.showCachedBanner(testContainer, Date.now() - 3600000, true);
    banner = testContainer.querySelector("#ally-cache-data-banner");
    runner.test(
      "showCachedBanner error variant has error class",
      banner && banner.classList.contains("ally-cache-banner-error"),
    );

    ALLY_CACHE_UI.hideCachedBanner(testContainer);

    // ====== Update Banner ======
    var applyClicked = false;
    ALLY_CACHE_UI.showUpdateBanner(testContainer, function () {
      applyClicked = true;
    });
    var updateBanner = testContainer.querySelector("#ally-cache-update-banner");
    runner.test(
      "showUpdateBanner creates banner element",
      updateBanner !== null,
    );
    runner.test(
      "showUpdateBanner banner has update class",
      updateBanner &&
        updateBanner.classList.contains("ally-cache-banner-update"),
    );

    // Test apply button
    var applyBtn = testContainer.querySelector("#ally-cache-apply-btn");
    runner.test("showUpdateBanner creates apply button", applyBtn !== null);
    if (applyBtn) {
      applyBtn.click();
      runner.test("Apply button calls callback", applyClicked === true);
    }

    ALLY_CACHE_UI.hideUpdateBanner(testContainer);
    updateBanner = testContainer.querySelector("#ally-cache-update-banner");
    runner.test("hideUpdateBanner removes banner", updateBanner === null);

    // Cleanup
    document.body.removeChild(testContainer);

    return runner.end();
  }

  // ========================================================================
  // Expose Test Functions Globally
  // ========================================================================

  if (typeof window !== "undefined") {
    window.testAllyConfig = testAllyConfig;
    window.testAllyApiClient = testAllyApiClient;
    window.testAllyUIManager = testAllyUIManager;
    window.testAllyMainController = testAllyMainController;
    window.testAllyFilterBuilder = testAllyFilterBuilder;
    window.testAllyUI = testAllyUI;
    window.testAllyAll = testAllyAll;
    window.testAllyCache = testAllyCache;
    window.testAllyCacheUI = testAllyCacheUI;
    // Helper functions (require credentials)
    window.testAllyConnection = testAllyConnection;
    window.testAllyQuery = testAllyQuery;
    window.cancelAllyRequest = cancelAllyRequest;
  }
})();
// ========================================================================
// ALLY_RESULT_RENDERER Tests
// ========================================================================

/**
 * Tests the Ally Result Renderer
 * @returns {Object} Test results
 */
function testAllyResultRenderer() {
  console.log("=== Ally Result Renderer Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Test 1: Module exists
  test(
    "ALLY_RESULT_RENDERER exists",
    typeof ALLY_RESULT_RENDERER !== "undefined",
  );

  // Test 2: Has required methods
  test("Has render method", typeof ALLY_RESULT_RENDERER.render === "function");
  test(
    "Has exportCSV method",
    typeof ALLY_RESULT_RENDERER.exportCSV === "function",
  );
  test(
    "Has exportJSON method",
    typeof ALLY_RESULT_RENDERER.exportJSON === "function",
  );
  test(
    "Has setView method",
    typeof ALLY_RESULT_RENDERER.setView === "function",
  );
  test(
    "Has toggleColumn method",
    typeof ALLY_RESULT_RENDERER.toggleColumn === "function",
  );
  test(
    "Has showMoreRows method",
    typeof ALLY_RESULT_RENDERER.showMoreRows === "function",
  );
  test(
    "Has getState method",
    typeof ALLY_RESULT_RENDERER.getState === "function",
  );

  // Test 3: Column definitions exist
  var overallCols = ALLY_RESULT_RENDERER.getColumnDefinitions("overall");
  var issuesCols = ALLY_RESULT_RENDERER.getColumnDefinitions("issues");
  test("Overall column definitions exist", Object.keys(overallCols).length > 0);
  test("Issues column definitions exist", Object.keys(issuesCols).length > 0);

  // Test 4: Default columns exist
  var defaultOverall = ALLY_RESULT_RENDERER.getDefaultColumns("overall");
  var defaultIssues = ALLY_RESULT_RENDERER.getDefaultColumns("issues");
  test("Default overall columns exist", defaultOverall.length > 0);
  test("Default issues columns exist", defaultIssues.length > 0);

  // Test 5: Key columns present in Overall
  test(
    "Overall has courseName column",
    overallCols.hasOwnProperty("courseName"),
  );
  test(
    "Overall has overallScore column",
    overallCols.hasOwnProperty("overallScore"),
  );
  test(
    "Overall has WYSIWYGScore column (capital W)",
    overallCols.hasOwnProperty("WYSIWYGScore"),
  );

  // Test 6: Key columns present in Issues
  test("Issues has scanned1 column", issuesCols.hasOwnProperty("scanned1"));
  test(
    "Issues has alternativeText2 column",
    issuesCols.hasOwnProperty("alternativeText2"),
  );
  test("Issues has title3 column", issuesCols.hasOwnProperty("title3"));

  // Test 7: Initialisation
  test("Initialises successfully", ALLY_RESULT_RENDERER.initialise());
  test("Reports initialised", ALLY_RESULT_RENDERER.isInitialised());

  // Test 8: State structure
  var state = ALLY_RESULT_RENDERER.getState();
  test("State has currentEndpoint", state.hasOwnProperty("currentEndpoint"));
  test("State has visibleColumns", state.hasOwnProperty("visibleColumns"));
  test("State has displayedRows", state.hasOwnProperty("displayedRows"));

  // Summary
  console.log(
    "\n=== Results: " +
      results.passed +
      "/" +
      (results.passed + results.failed) +
      " passed ===",
  );

  return results;
}

/**
 * Tests Result Renderer with sample data
 * @returns {Object} Test results
 */
function testAllyResultRendererWithData() {
  console.log("=== Ally Result Renderer Data Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Sample data for testing
  var sampleOverallResult = {
    metadata: { status: "Successful", total: 100, filteredTotal: 50 },
    data: [
      {
        courseId: "_100_1",
        courseCode: "TEST101",
        courseName: "Test Course",
        courseUrl: "https://example.com/course",
        termId: "_24_1",
        termName: "2010-11",
        departmentId: "",
        departmentName: "",
        overallScore: 0.85,
        filesScore: 0.75,
        WYSIWYGScore: 0.95,
        totalFiles: 100,
        totalWYSIWYG: 50,
        numberOfStudents: 25,
        allyEnabled: true,
        lastCheckedOn: "2025-01-15",
      },
    ],
  };

  var sampleIssuesResult = {
    metadata: { status: "Successful", total: 50, filteredTotal: 25 },
    data: [
      {
        courseId: "_100_1",
        courseCode: "TEST101",
        courseName: "Test Course",
        courseUrl: "https://example.com/course",
        termId: "_24_1",
        termName: "2010-11",
        scanned1: 5,
        security1: 0,
        parsable1: 2,
        alternativeText2: 15,
        contrast2: 8,
        headingsPresence2: 12,
        tableHeaders2: 3,
        title3: 7,
        languagePresence3: 4,
      },
    ],
  };

  // Test rendering with Overall data
  try {
    ALLY_RESULT_RENDERER.render(sampleOverallResult, "overall");
    var state = ALLY_RESULT_RENDERER.getState();
    test("Renders overall data", state.dataLength === 1);
    test("Sets endpoint to overall", state.currentEndpoint === "overall");
    test("Has visible columns", state.visibleColumns.length > 0);
  } catch (e) {
    test("Renders overall data (error: " + e.message + ")", false);
  }

  // Test rendering with Issues data
  try {
    ALLY_RESULT_RENDERER.render(sampleIssuesResult, "issues");
    var state = ALLY_RESULT_RENDERER.getState();
    test("Renders issues data", state.dataLength === 1);
    test("Sets endpoint to issues", state.currentEndpoint === "issues");
  } catch (e) {
    test("Renders issues data (error: " + e.message + ")", false);
  }

  // Test column toggling
  try {
    var initialColumns = ALLY_RESULT_RENDERER.getVisibleColumns().length;
    ALLY_RESULT_RENDERER.toggleColumn("courseCode");
    var afterToggle = ALLY_RESULT_RENDERER.getVisibleColumns().length;
    test("Toggle column changes count", initialColumns !== afterToggle);
  } catch (e) {
    test("Toggle column (error: " + e.message + ")", false);
  }

  // Summary
  console.log(
    "\n=== Results: " +
      results.passed +
      "/" +
      (results.passed + results.failed) +
      " passed ===",
  );

  return results;
}

// Expose tests to window
if (typeof window !== "undefined") {
  window.testAllyResultRenderer = testAllyResultRenderer;
  window.testAllyResultRendererWithData = testAllyResultRendererWithData;
}
// ========================================================================
// ALLY_CHART_RENDERER Tests (Phase 6)
// ========================================================================

/**
 * Tests the Ally Chart Renderer
 * @returns {Object} Test results
 */
function testAllyChartRenderer() {
  console.log("=== Ally Chart Renderer Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Test 1: Module exists
  test(
    "ALLY_CHART_RENDERER exists",
    typeof ALLY_CHART_RENDERER !== "undefined",
  );

  // Test 2: Has required methods
  test("Has render method", typeof ALLY_CHART_RENDERER.render === "function");
  test("Has destroy method", typeof ALLY_CHART_RENDERER.destroy === "function");
  test(
    "Has getActiveChartCount method",
    typeof ALLY_CHART_RENDERER.getActiveChartCount === "function",
  );

  // Test 3: Has data processing methods
  test(
    "Has calculateScoreDistribution method",
    typeof ALLY_CHART_RENDERER.calculateScoreDistribution === "function",
  );
  test(
    "Has calculateAverageScores method",
    typeof ALLY_CHART_RENDERER.calculateAverageScores === "function",
  );
  test(
    "Has calculateIssueSeverityTotals method",
    typeof ALLY_CHART_RENDERER.calculateIssueSeverityTotals === "function",
  );
  test(
    "Has getTopIssues method",
    typeof ALLY_CHART_RENDERER.getTopIssues === "function",
  );
  test(
    "Has getApplicableCharts method",
    typeof ALLY_CHART_RENDERER.getApplicableCharts === "function",
  );

  // Test 4: Dependencies available
  test("ChartBuilder available", typeof ChartBuilder !== "undefined");
  test("ChartControls available", typeof ChartControls !== "undefined");
  test("Chart.js available", typeof Chart !== "undefined");

  // Summary
  console.log(
    "\n=== Results: " +
      results.passed +
      "/" +
      (results.passed + results.failed) +
      " passed ===",
  );

  return results;
}

/**
 * Tests Chart Renderer data processing functions
 * @returns {Object} Test results
 */
function testAllyChartDataProcessing() {
  console.log("=== Ally Chart Data Processing Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Sample test data
  var sampleScoreData = [
    { overallScore: 0.95, filesScore: 0.88, WYSIWYGScore: 0.92 },
    { overallScore: 0.72, filesScore: 0.65, WYSIWYGScore: 0.8 },
    { overallScore: 0.45, filesScore: 0.4, WYSIWYGScore: 0.55 },
    { overallScore: 0.25, filesScore: 0.2, WYSIWYGScore: 0.3 },
    { overallScore: 0.88, filesScore: 0.92, WYSIWYGScore: 0.85 },
  ];

  var sampleIssuesData = [
    {
      scanned1: 5,
      security1: 0,
      parsable1: 2,
      alternativeText2: 15,
      contrast2: 8,
      title3: 4,
    },
    {
      scanned1: 3,
      security1: 1,
      parsable1: 0,
      alternativeText2: 10,
      contrast2: 5,
      title3: 2,
    },
  ];

  // Test score distribution
  var distribution = ALLY_CHART_RENDERER.calculateScoreDistribution(
    sampleScoreData,
    "overallScore",
  );
  test(
    "Score distribution returns 5 bins",
    distribution.labels.length === 5 && distribution.counts.length === 5,
  );
  test("Score distribution total is 5", distribution.total === 5);
  test(
    "Score distribution has excellent courses",
    distribution.counts[4] === 1,
  ); // 0.95 is excellent

  // Test average scores
  var averages = ALLY_CHART_RENDERER.calculateAverageScores(sampleScoreData);
  test("Average overall is calculated", averages.overall !== null);
  test("Average files is calculated", averages.files !== null);
  test("Average wysiwyg is calculated", averages.wysiwyg !== null);

  // Test severity totals
  var severityTotals =
    ALLY_CHART_RENDERER.calculateIssueSeverityTotals(sampleIssuesData);
  test("Severity totals has severe", severityTotals.severe > 0);
  test("Severity totals has major", severityTotals.major > 0);
  test("Severity totals has minor", severityTotals.minor > 0);
  test(
    "Severity total is sum",
    severityTotals.total ===
      severityTotals.severe + severityTotals.major + severityTotals.minor,
  );

  // Test top issues
  var topIssues = ALLY_CHART_RENDERER.getTopIssues(sampleIssuesData, 5);
  test("Top issues returns array", Array.isArray(topIssues));
  test("Top issues has items", topIssues.length > 0);
  test("Top issues sorted by count", topIssues[0].count >= topIssues[1].count);

  // Test applicable charts for overall endpoint
  var overallCharts = ALLY_CHART_RENDERER.getApplicableCharts(
    { data: sampleScoreData },
    "overall",
  );
  test(
    "Overall endpoint has scoreDistribution chart",
    overallCharts.includes("scoreDistribution"),
  );
  test(
    "Overall endpoint has scoreComparison chart",
    overallCharts.includes("scoreComparison"),
  );

  // Test applicable charts for issues endpoint
  var issuesCharts = ALLY_CHART_RENDERER.getApplicableCharts(
    { data: sampleIssuesData },
    "issues",
  );
  test(
    "Issues endpoint has severityBreakdown chart",
    issuesCharts.includes("severityBreakdown"),
  );
  test(
    "Issues endpoint has topIssues chart",
    issuesCharts.includes("topIssues"),
  );

  // Summary
  console.log(
    "\n=== Results: " +
      results.passed +
      "/" +
      (results.passed + results.failed) +
      " passed ===",
  );

  return results;
}

/**
 * Tests Chart Renderer with sample data rendering
 * @returns {Promise<Object>} Test results
 */
async function testAllyChartWithData() {
  console.log("=== Ally Chart Rendering Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  var sampleResult = {
    data: [
      {
        courseName: "Test Course 1",
        overallScore: 0.95,
        filesScore: 0.88,
        WYSIWYGScore: 0.92,
      },
      {
        courseName: "Test Course 2",
        overallScore: 0.72,
        filesScore: 0.65,
        WYSIWYGScore: 0.8,
      },
      {
        courseName: "Test Course 3",
        overallScore: 0.45,
        filesScore: 0.4,
        WYSIWYGScore: 0.55,
      },
      {
        courseName: "Test Course 4",
        overallScore: 0.88,
        filesScore: 0.92,
        WYSIWYGScore: 0.85,
      },
    ],
    metadata: { total: 4 },
  };

  // Test rendering
  try {
    await ALLY_CHART_RENDERER.render(sampleResult, "overall");
    var chartCount = ALLY_CHART_RENDERER.getActiveChartCount();
    test("Charts rendered successfully", chartCount > 0);
    test("Expected number of charts", chartCount === 2); // scoreDistribution + scoreComparison
  } catch (e) {
    test("Charts rendered (error: " + e.message + ")", false);
  }

  // Test destroy
  try {
    ALLY_CHART_RENDERER.destroy();
    test("Charts destroyed", ALLY_CHART_RENDERER.getActiveChartCount() === 0);
  } catch (e) {
    test("Charts destroyed (error: " + e.message + ")", false);
  }

  // Summary
  console.log(
    "\n=== Results: " +
      results.passed +
      "/" +
      (results.passed + results.failed) +
      " passed ===",
  );

  return results;
}

// Expose chart tests to window
if (typeof window !== "undefined") {
  window.testAllyChartRenderer = testAllyChartRenderer;
  window.testAllyChartDataProcessing = testAllyChartDataProcessing;
  window.testAllyChartWithData = testAllyChartWithData;
}
/**
 * Tests for ALLY_COURSE_REPORT_CONFIG module (Phase 7A.2)
 * @returns {Object} Test results
 */
function testAllyCourseReportConfig() {
  console.log("=== Testing ALLY_COURSE_REPORT_CONFIG ===");
  var passed = 0;
  var failed = 0;
  var results = [];

  function test(name, condition) {
    if (condition) {
      passed++;
      results.push({ name: name, status: "PASSED" });
      console.log("✓ " + name);
    } else {
      failed++;
      results.push({ name: name, status: "FAILED" });
      console.error("✗ " + name);
    }
  }

  // Module availability
  test("Module exists", typeof ALLY_COURSE_REPORT_CONFIG !== "undefined");

  // Data mappings
  test(
    "FILE_TYPE_MAPPING exists",
    !!ALLY_COURSE_REPORT_CONFIG.FILE_TYPE_MAPPING,
  );
  test("ISSUE_CATEGORIES exists", !!ALLY_COURSE_REPORT_CONFIG.ISSUE_CATEGORIES);
  test(
    "ISSUE_DESCRIPTIONS exists",
    !!ALLY_COURSE_REPORT_CONFIG.ISSUE_DESCRIPTIONS,
  );
  test("SEVERITY_LEVELS exists", !!ALLY_COURSE_REPORT_CONFIG.SEVERITY_LEVELS);
  test(
    "EXCLUDED_ISSUES exists",
    Array.isArray(ALLY_COURSE_REPORT_CONFIG.EXCLUDED_ISSUES),
  );

  // File type mapping structure
  test(
    "External files category exists",
    !!ALLY_COURSE_REPORT_CONFIG.FILE_TYPE_MAPPING.external,
  );
  test(
    "Blackboard content category exists",
    !!ALLY_COURSE_REPORT_CONFIG.FILE_TYPE_MAPPING.blackboard,
  );
  test(
    "PDF type defined",
    !!ALLY_COURSE_REPORT_CONFIG.FILE_TYPE_MAPPING.external.types.pdf,
  );

  // Issue categories structure
  test(
    "Alternative Text category exists",
    !!ALLY_COURSE_REPORT_CONFIG.ISSUE_CATEGORIES["Alternative Text"],
  );
  test(
    "Colour Contrast category exists",
    !!ALLY_COURSE_REPORT_CONFIG.ISSUE_CATEGORIES["Colour Contrast"],
  );
  test(
    "Headings category exists",
    !!ALLY_COURSE_REPORT_CONFIG.ISSUE_CATEGORIES["Headings"],
  );

  // Severity extraction
  test(
    "getSeverityFromField severe (1)",
    ALLY_COURSE_REPORT_CONFIG.getSeverityFromField("scanned1") === 1,
  );
  test(
    "getSeverityFromField major (2)",
    ALLY_COURSE_REPORT_CONFIG.getSeverityFromField("contrast2") === 2,
  );
  test(
    "getSeverityFromField minor (3)",
    ALLY_COURSE_REPORT_CONFIG.getSeverityFromField("title3") === 3,
  );
  test(
    "getSeverityFromField default",
    ALLY_COURSE_REPORT_CONFIG.getSeverityFromField("unknown") === 2,
  );

  // Issue descriptions
  test(
    "getIssueDescription returns description",
    ALLY_COURSE_REPORT_CONFIG.getIssueDescription("alternativeText2").length >
      10,
  );
  test(
    "getIssueDescription handles unknown",
    ALLY_COURSE_REPORT_CONFIG.getIssueDescription("unknownField123").length > 0,
  );

  // Category lookup
  test(
    "getCategoryForIssue finds category",
    ALLY_COURSE_REPORT_CONFIG.getCategoryForIssue("contrast2") ===
      "Colour Contrast",
  );
  test(
    "getCategoryForIssue returns null for unknown",
    ALLY_COURSE_REPORT_CONFIG.getCategoryForIssue("unknownField") === null,
  );
  test(
    "getCategoryForIssue returns null for excluded",
    ALLY_COURSE_REPORT_CONFIG.getCategoryForIssue("libraryReference") === null,
  );

  // Severity level lookup
  test(
    "getSeverityLevel returns severe",
    ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(1).label === "Severe",
  );
  test(
    "getSeverityLevel returns major",
    ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(2).label === "Major",
  );
  test(
    "getSeverityLevel returns minor",
    ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(3).label === "Minor",
  );
  test(
    "getSeverityLevel returns null for invalid",
    ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(5) === null,
  );

  // Score rating
  test(
    "getScoreRating excellent",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(0.95).label === "Excellent",
  );
  test(
    "getScoreRating good",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(0.75).label === "Good",
  );
  test(
    "getScoreRating fair",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(0.55).label === "Fair",
  );
  test(
    "getScoreRating poor",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(0.35).label === "Poor",
  );
  test(
    "getScoreRating very poor",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(0.15).label === "Very Poor",
  );
  test(
    "getScoreRating unknown for NaN",
    ALLY_COURSE_REPORT_CONFIG.getScoreRating(NaN).label === "Unknown",
  );

  // Excluded issues
  test(
    "isExcludedIssue true for libraryReference",
    ALLY_COURSE_REPORT_CONFIG.isExcludedIssue("libraryReference") === true,
  );
  test(
    "isExcludedIssue false for normal issue",
    ALLY_COURSE_REPORT_CONFIG.isExcludedIssue("contrast2") === false,
  );

  // File type info
  test(
    "getFileTypeInfo finds PDF",
    ALLY_COURSE_REPORT_CONFIG.getFileTypeInfo("pdf").label === "PDF Documents",
  );
  test(
    "getFileTypeInfo returns null for unknown",
    ALLY_COURSE_REPORT_CONFIG.getFileTypeInfo("unknownType") === null,
  );

  // Category names
  var categoryNames = ALLY_COURSE_REPORT_CONFIG.getCategoryNames();
  test("getCategoryNames returns array", Array.isArray(categoryNames));
  test("getCategoryNames has expected count", categoryNames.length === 11);

  // Issues by severity
  var severeIssues = ALLY_COURSE_REPORT_CONFIG.getIssuesBySeverity(1);
  test("getIssuesBySeverity returns array", Array.isArray(severeIssues));
  test(
    "getIssuesBySeverity includes scanned1",
    severeIssues.indexOf("scanned1") !== -1,
  );

  // Calculation functions - mock data
  var mockIssuesData = {
    scanned1: 1,
    alternativeText2: 62,
    contrast2: 16,
    title3: 32,
    libraryReference: 74,
  };

  var severityTotals =
    ALLY_COURSE_REPORT_CONFIG.calculateSeverityTotals(mockIssuesData);
  test("calculateSeverityTotals severe count", severityTotals.severe === 1);
  test("calculateSeverityTotals major count", severityTotals.major === 78);
  test("calculateSeverityTotals minor count", severityTotals.minor === 32);
  test(
    "calculateSeverityTotals total excludes libraryReference",
    severityTotals.total === 111,
  );

  var categoryIssueCounts =
    ALLY_COURSE_REPORT_CONFIG.calculateCategoryIssueCounts(mockIssuesData);
  test(
    "calculateCategoryIssueCounts returns object",
    typeof categoryIssueCounts === "object",
  );
  test(
    "calculateCategoryIssueCounts has Colour Contrast",
    categoryIssueCounts["Colour Contrast"].total === 16,
  );

  var mockOverallData = {
    pdf: 36,
    document: 38,
    image: 7,
    "application/x-link-web": 3,
  };

  var fileTypeCounts =
    ALLY_COURSE_REPORT_CONFIG.calculateFileTypeCounts(mockOverallData);
  test(
    "calculateFileTypeCounts external total",
    fileTypeCounts.external.total === 81,
  );
  test(
    "calculateFileTypeCounts blackboard total",
    fileTypeCounts.blackboard.total === 3,
  );

  // Validation
  var validation = ALLY_COURSE_REPORT_CONFIG.validateConfiguration();
  test("Configuration validates", validation.valid === true);

  // Debug info
  var debugInfo = ALLY_COURSE_REPORT_CONFIG.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test(
    "getDebugInfo has issueDescriptionCount",
    debugInfo.issueDescriptionCount > 30,
  );

  console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
  return { passed: passed, failed: failed, results: results };
}

// Expose test function globally
if (typeof window !== "undefined") {
  window.testAllyCourseReportConfig = testAllyCourseReportConfig;
}
/**
 * Tests for ALLY_COURSE_REPORT module (Phase 7A.3)
 * @returns {Object} Test results
 */
function testAllyCourseReportController() {
  console.log("=== Testing ALLY_COURSE_REPORT ===");
  var passed = 0;
  var failed = 0;
  var results = [];

  function test(name, condition) {
    if (condition) {
      passed++;
      results.push({ name: name, status: "PASSED" });
      console.log("✓ " + name);
    } else {
      failed++;
      results.push({ name: name, status: "FAILED" });
      console.error("✗ " + name);
    }
  }

  // Module availability
  test("Module exists", typeof ALLY_COURSE_REPORT !== "undefined");

  // Public API
  test(
    "has initialise method",
    typeof ALLY_COURSE_REPORT.initialise === "function",
  );
  test(
    "has isInitialised method",
    typeof ALLY_COURSE_REPORT.isInitialised === "function",
  );
  test(
    "has generateReport method",
    typeof ALLY_COURSE_REPORT.generateReport === "function",
  );
  test(
    "has getSelectedCourse method",
    typeof ALLY_COURSE_REPORT.getSelectedCourse === "function",
  );
  test(
    "has getLastReportData method",
    typeof ALLY_COURSE_REPORT.getLastReportData === "function",
  );
  test(
    "has isGenerating method",
    typeof ALLY_COURSE_REPORT.isGenerating === "function",
  );
  test(
    "has exportHTML method",
    typeof ALLY_COURSE_REPORT.exportHTML === "function",
  );
  test(
    "has exportCSV method",
    typeof ALLY_COURSE_REPORT.exportCSV === "function",
  );
  test(
    "has printReport method",
    typeof ALLY_COURSE_REPORT.printReport === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_COURSE_REPORT.getDebugInfo === "function",
  );

  // Initialisation state
  test("is initialised", ALLY_COURSE_REPORT.isInitialised() === true);

  // Initial state
  test(
    "getSelectedCourse returns null initially",
    ALLY_COURSE_REPORT.getSelectedCourse() === null,
  );
  test(
    "getLastReportData returns null initially",
    ALLY_COURSE_REPORT.getLastReportData() === null,
  );
  test(
    "isGenerating returns false initially",
    ALLY_COURSE_REPORT.isGenerating() === false,
  );

  // Debug info
  var debugInfo = ALLY_COURSE_REPORT.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", debugInfo.initialised === true);
  test("debugInfo has selectedCourse property", "selectedCourse" in debugInfo);
  test("debugInfo has isGenerating property", "isGenerating" in debugInfo);
  test(
    "debugInfo has elementsFound property",
    typeof debugInfo.elementsFound === "object",
  );
  test(
    "debugInfo has dependencies property",
    typeof debugInfo.dependencies === "object",
  );

  // Check dependencies
  test(
    "dependency ALLY_CONFIG available",
    debugInfo.dependencies.ALLY_CONFIG === true,
  );
  test(
    "dependency ALLY_API_CLIENT available",
    debugInfo.dependencies.ALLY_API_CLIENT === true,
  );
  test(
    "dependency ALLY_UI_MANAGER available",
    debugInfo.dependencies.ALLY_UI_MANAGER === true,
  );
  test(
    "dependency ALLY_COURSE_REPORT_SEARCH available",
    debugInfo.dependencies.ALLY_COURSE_REPORT_SEARCH === true,
  );
  test(
    "dependency ALLY_COURSE_REPORT_CONFIG available",
    debugInfo.dependencies.ALLY_COURSE_REPORT_CONFIG === true,
  );

  // Check DOM elements found
  test(
    "executeButton element found",
    debugInfo.elementsFound.executeButton === true,
  );
  test(
    "progressSection element found",
    debugInfo.elementsFound.progressSection === true,
  );
  test(
    "resultsContainer element found",
    debugInfo.elementsFound.resultsContainer === true,
  );

  console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
  return { passed: passed, failed: failed, results: results };
}

/**
 * Combined test for all Course Report modules (Phase 7A)
 * @returns {Object} Combined test results
 */
function testAllyCourseReport() {
  console.log("=== Testing All Course Report Modules ===\n");

  var configResults = testAllyCourseReportConfig();
  console.log("");

  var searchResults = testAllyCourseReportSearch();
  console.log("");

  var controllerResults = testAllyCourseReportController();
  console.log("");

  var totalPassed =
    configResults.passed + searchResults.passed + controllerResults.passed;
  var totalFailed =
    configResults.failed + searchResults.failed + controllerResults.failed;

  console.log(
    "=== TOTAL: " + totalPassed + " passed, " + totalFailed + " failed ===",
  );

  return {
    config: configResults,
    search: searchResults,
    controller: controllerResults,
    total: { passed: totalPassed, failed: totalFailed },
  };
}

// ========================================================================
// Statement Preview Tests (Phase 7B)
// ========================================================================

/**
 * Tests ALLY_STATEMENT_PREVIEW_CONFIG functionality
 * @returns {Object} Test results {passed, failed}
 */
function testAllyStatementPreviewConfig() {
  console.log("=== ALLY_STATEMENT_PREVIEW_CONFIG Tests ===");

  let passed = 0;
  let failed = 0;
  const results = [];

  function test(name, condition) {
    results.push({ name: name, passed: condition });
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence
  test(
    "ALLY_STATEMENT_PREVIEW_CONFIG exists",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG === "object",
  );

  // THEMES array
  test("has THEMES array", Array.isArray(ALLY_STATEMENT_PREVIEW_CONFIG.THEMES));
  test(
    "THEMES has 9 entries",
    ALLY_STATEMENT_PREVIEW_CONFIG.THEMES &&
      ALLY_STATEMENT_PREVIEW_CONFIG.THEMES.length === 9,
  );

  // Theme structure validation
  if (ALLY_STATEMENT_PREVIEW_CONFIG.THEMES) {
    const firstTheme = ALLY_STATEMENT_PREVIEW_CONFIG.THEMES[0];
    test("theme has id property", typeof firstTheme.id === "string");
    test("theme has fields array", Array.isArray(firstTheme.fields));
    test("theme has icon property", typeof firstTheme.icon === "string");
    test("theme has title property", typeof firstTheme.title === "string");
    test("theme has summary property", typeof firstTheme.summary === "string");
    test(
      "theme has disclosureId property",
      typeof firstTheme.disclosureId === "string",
    );
    test(
      "theme has whatThisMeans array",
      Array.isArray(firstTheme.whatThisMeans),
    );
    test("theme has suggestions array", Array.isArray(firstTheme.suggestions));
  }

  // INTRO object
  test(
    "has INTRO object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.INTRO === "object",
  );
  if (ALLY_STATEMENT_PREVIEW_CONFIG.INTRO) {
    test(
      "INTRO has heading",
      typeof ALLY_STATEMENT_PREVIEW_CONFIG.INTRO.heading === "string",
    );
    test(
      "INTRO has paragraphs array",
      Array.isArray(ALLY_STATEMENT_PREVIEW_CONFIG.INTRO.paragraphs),
    );
    test(
      "INTRO has bulletPoints array",
      Array.isArray(ALLY_STATEMENT_PREVIEW_CONFIG.INTRO.bulletPoints),
    );
  }

  // SUCCESS object
  test(
    "has SUCCESS object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS === "object",
  );
  if (ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS) {
    test(
      "SUCCESS has icon",
      typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS.icon === "string",
    );
    test(
      "SUCCESS has title",
      typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS.title === "string",
    );
    test(
      "SUCCESS has message",
      typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS.message === "string",
    );
  }

  // Method tests
  test(
    "has getTheme method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getTheme === "function",
  );
  test(
    "has calculateThemeIssues method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues === "function",
  );
  test(
    "has getActiveThemes method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes === "function",
  );
  test(
    "has getAllFields method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields === "function",
  );

  // getTheme functionality
  const missingAltTheme = ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("missing-alt");
  test("getTheme returns valid theme", missingAltTheme !== null);
  test(
    "getTheme returns correct theme",
    missingAltTheme && missingAltTheme.title === "Missing image descriptions",
  );
  test(
    "getTheme returns null for unknown",
    ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("nonexistent") === null,
  );

  // calculateThemeIssues functionality
  const mockData = { alternativeText2: 5, htmlImageAlt2: 3 };
  const issueCount = ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues(
    missingAltTheme,
    mockData,
  );
  test("calculateThemeIssues sums correctly", issueCount === 8);

  // getActiveThemes functionality
  const activeThemes = ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(mockData);
  test("getActiveThemes returns array", Array.isArray(activeThemes));
  test(
    "getActiveThemes finds themes with issues",
    activeThemes.length > 0 && activeThemes[0].count > 0,
  );

  // getAllFields functionality
  const allFields = ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields();
  test("getAllFields returns array", Array.isArray(allFields));
  test(
    "getAllFields contains expected field",
    allFields.includes("alternativeText2"),
  );

  console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
  return { passed: passed, failed: failed, results: results };
}

/**
 * Tests ALLY_STATEMENT_PREVIEW_SEARCH functionality
 * @returns {Object} Test results {passed, failed}
 */
function testAllyStatementPreviewSearch() {
  console.log("=== ALLY_STATEMENT_PREVIEW_SEARCH Tests ===");

  let passed = 0;
  let failed = 0;
  const results = [];

  function test(name, condition) {
    results.push({ name: name, passed: condition });
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence
  test(
    "ALLY_STATEMENT_PREVIEW_SEARCH exists",
    typeof ALLY_STATEMENT_PREVIEW_SEARCH === "object",
  );

  // Method existence
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

  // Initialisation (force to ensure elements are cached if section is visible)
  ALLY_STATEMENT_PREVIEW_SEARCH.initialise(true);
  test(
    "isInitialised returns true after init",
    ALLY_STATEMENT_PREVIEW_SEARCH.isInitialised() === true,
  );

  // Debug info structure
  const debugInfo = ALLY_STATEMENT_PREVIEW_SEARCH.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", "initialised" in debugInfo);
  test("debugInfo has selectedCourse property", "selectedCourse" in debugInfo);
  test("debugInfo has elementsFound property", "elementsFound" in debugInfo);

  // Search functionality (if ALLY_COURSES available)
  if (typeof ALLY_COURSES !== "undefined") {
    const searchResults = ALLY_STATEMENT_PREVIEW_SEARCH.search("FEEG");
    test("search returns array", Array.isArray(searchResults));
    test("search finds results for valid query", searchResults.length > 0);

    // Check result structure
    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      test("search result has id", typeof firstResult.id === "string");
      test("search result has name", typeof firstResult.name === "string");
      test("search result has code", typeof firstResult.code === "string");
    }
  }

  // Selection functionality
  const mockCourse = { id: "test-123", name: "Test Course", code: "TEST101" };
  ALLY_STATEMENT_PREVIEW_SEARCH.setSelectedCourse(mockCourse);
  const selected = ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse();
  test(
    "setSelectedCourse works",
    selected !== null && selected.id === "test-123",
  );

  // Clear functionality
  ALLY_STATEMENT_PREVIEW_SEARCH.clearSelection();
  test(
    "clearSelection works",
    ALLY_STATEMENT_PREVIEW_SEARCH.getSelectedCourse() === null,
  );

  // Element isolation (verify ally-sp- prefix)
  const spInput = document.getElementById("ally-sp-search-input");
  const crInput = document.getElementById("ally-cr-search-input");
  test("ally-sp-search-input element exists", spInput !== null);
  test("search inputs are isolated (different elements)", spInput !== crInput);

  console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
  return { passed: passed, failed: failed, results: results };
}

/**
 * Tests ALLY_STATEMENT_PREVIEW (main controller) functionality
 * @returns {Object} Test results {passed, failed}
 */
function testAllyStatementPreviewController() {
  console.log("=== ALLY_STATEMENT_PREVIEW Controller Tests ===");

  let passed = 0;
  let failed = 0;
  const results = [];

  function test(name, condition) {
    results.push({ name: name, passed: condition });
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence
  test(
    "ALLY_STATEMENT_PREVIEW exists",
    typeof ALLY_STATEMENT_PREVIEW === "object",
  );

  // Method existence
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

  // Initialisation
  ALLY_STATEMENT_PREVIEW.initialise(true);
  test(
    "isInitialised returns true after init",
    ALLY_STATEMENT_PREVIEW.isInitialised() === true,
  );

  // Debug info structure
  const debugInfo = ALLY_STATEMENT_PREVIEW.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has initialised property", "initialised" in debugInfo);
  test("debugInfo has elementsFound property", "elementsFound" in debugInfo);
  test(
    "debugInfo has configAvailable property",
    "configAvailable" in debugInfo,
  );
  test(
    "debugInfo has searchAvailable property",
    "searchAvailable" in debugInfo,
  );
  test(
    "debugInfo has apiClientAvailable property",
    "apiClientAvailable" in debugInfo,
  );

  // Dependency availability
  test("config dependency available", debugInfo.configAvailable === true);
  test("search dependency available", debugInfo.searchAvailable === true);

  // Element caching
  test(
    "executeButton element found",
    debugInfo.elementsFound.executeButton === true,
  );
  test(
    "progressSection element found",
    debugInfo.elementsFound.progressSection === true,
  );
  test(
    "resultsContainer element found",
    debugInfo.elementsFound.resultsContainer === true,
  );

  // DOM element tests
  const executeBtn = document.getElementById("ally-sp-execute");
  const resultsContainer = document.getElementById("ally-sp-results");
  const progressSection = document.getElementById("ally-sp-progress");
  const courseDetails = document.getElementById("ally-sp-course-details");

  test("ally-sp-execute element exists", executeBtn !== null);
  test("ally-sp-results element exists", resultsContainer !== null);
  test("ally-sp-progress element exists", progressSection !== null);
  test("ally-sp-course-details element exists", courseDetails !== null);

  // Initial state
  test(
    "getLastPreviewData returns null initially",
    ALLY_STATEMENT_PREVIEW.getLastPreviewData() === null,
  );

  // Reset functionality
  ALLY_STATEMENT_PREVIEW.reset();
  test(
    "reset clears preview data",
    ALLY_STATEMENT_PREVIEW.getLastPreviewData() === null,
  );

  console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
  return { passed: passed, failed: failed, results: results };
}

/**
 * Combined test for all Statement Preview modules (Phase 7B)
 * @returns {Object} Combined test results
 */
function testAllyStatementPreview() {
  console.log("=== Testing All Statement Preview Modules (Phase 7B) ===\n");

  const configResults = testAllyStatementPreviewConfig();
  console.log("");

  const searchResults = testAllyStatementPreviewSearch();
  console.log("");

  const controllerResults = testAllyStatementPreviewController();
  console.log("");

  const totalPassed =
    configResults.passed + searchResults.passed + controllerResults.passed;
  const totalFailed =
    configResults.failed + searchResults.failed + controllerResults.failed;

  console.log(
    "=== TOTAL: " + totalPassed + " passed, " + totalFailed + " failed ===",
  );

  return {
    config: configResults,
    search: searchResults,
    controller: controllerResults,
    total: { passed: totalPassed, failed: totalFailed },
  };
}

/**
 * Integration test for Statement Preview with mock data
 * Tests rendering without making API calls
 * @returns {Object} Test results
 */
function testAllyStatementPreviewRendering() {
  console.log("=== Statement Preview Rendering Tests ===");

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

  // Mock issue data with various themes
  const mockIssueData = {
    courseId: "test-123",
    courseName: "Test Course for Rendering",
    courseCode: "TEST101",
    termName: "2023-24",
    lastCheckedOn: "2024-01-15T10:30:00Z",
    filesCount: 45,
    // Issues to trigger theme display
    alternativeText2: 5,
    htmlImageAlt2: 3,
    htmlBrokenLink2: 2,
    contrast2: 1,
    scanned1: 0, // Zero - should not appear
  };

  // Get active themes
  const activeThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(mockIssueData);
  test("getActiveThemes finds 3 themes with issues", activeThemes.length === 3);

  // Verify correct themes identified
  const themeIds = activeThemes.map(function (t) {
    return t.theme.id;
  });
  test("missing-alt theme identified", themeIds.includes("missing-alt"));
  test("broken-links theme identified", themeIds.includes("broken-links"));
  test(
    "colour-contrast theme identified",
    themeIds.includes("colour-contrast"),
  );
  test(
    "scanned theme NOT identified (zero issues)",
    !themeIds.includes("scanned"),
  );

  // Verify issue counts
  const missingAltEntry = activeThemes.find(function (t) {
    return t.theme.id === "missing-alt";
  });
  test(
    "missing-alt count is 8 (5+3)",
    missingAltEntry && missingAltEntry.count === 8,
  );

  console.log("\nTo test full rendering:");
  console.log('1. Select a course and click "Generate Statement Preview"');
  console.log("2. Verify warning sections appear for themes with issues");
  console.log("3. Test disclosure widgets: ALLY_STATEMENT_PREVIEW.expandAll()");
  console.log("4. Test collapse: ALLY_STATEMENT_PREVIEW.collapseAll()");

  console.log(
    "\n=== Results: " + passed + " passed, " + failed + " failed ===",
  );
  return { passed: passed, failed: failed };
}

// ========================================================================
// API Warm-Up UX Tests (Stage 1: Progress Bar)
// ========================================================================

/**
 * Tests API warm-up progress bar functionality
 * @returns {Object} Test results with passed/failed counts
 */
function testAllyWarmUpProgress() {
  console.log("=== API Warm-Up Progress Bar Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Test 1: Progress container element exists
  test(
    "Progress container element exists",
    !!document.getElementById("ally-api-progress-container"),
  );

  // Test 2: Progress bar element exists
  test(
    "Progress bar element exists",
    !!document.getElementById("ally-api-progress-bar"),
  );

  // Test 3: Progress fill element exists
  test(
    "Progress fill element exists",
    !!document.getElementById("ally-api-progress-fill"),
  );

  // Test 4: Hint element exists
  test(
    "Hint element exists",
    !!document.getElementById("ally-api-status-hint"),
  );

  // Test 5: Progress bar has correct ARIA attributes
  var progressBar = document.getElementById("ally-api-progress-bar");
  test(
    "Progress bar has role=progressbar",
    progressBar && progressBar.getAttribute("role") === "progressbar",
  );

  test(
    "Progress bar has aria-valuemin",
    progressBar && progressBar.hasAttribute("aria-valuemin"),
  );

  test(
    "Progress bar has aria-valuemax",
    progressBar && progressBar.hasAttribute("aria-valuemax"),
  );

  test(
    "Progress bar has aria-label",
    progressBar && progressBar.hasAttribute("aria-label"),
  );

  // Test 6: Progress container is initially hidden
  var progressContainer = document.getElementById(
    "ally-api-progress-container",
  );
  test(
    "Progress container is initially hidden",
    progressContainer && progressContainer.hidden === true,
  );

  // Test 7: UI Manager has cached progress elements
  if (typeof ALLY_UI_MANAGER !== "undefined") {
    test(
      "UI Manager cached ally-api-progress-container",
      !!ALLY_UI_MANAGER.getElement("ally-api-progress-container"),
    );
    test(
      "UI Manager cached ally-api-progress-bar",
      !!ALLY_UI_MANAGER.getElement("ally-api-progress-bar"),
    );
    test(
      "UI Manager cached ally-api-progress-fill",
      !!ALLY_UI_MANAGER.getElement("ally-api-progress-fill"),
    );
    test(
      "UI Manager cached ally-api-status-hint",
      !!ALLY_UI_MANAGER.getElement("ally-api-status-hint"),
    );
  }

  // Summary
  console.log("\n" + results.passed + " passed, " + results.failed + " failed");

  return results;
}

// ========================================================================
// API Warm-Up UX Tests (Stage 2: Button State Management)
// ========================================================================

/**
 * Tests execute button state management functionality
 * @returns {Object} Test results with passed/failed counts
 */
function testAllyButtonStates() {
  console.log("=== Execute Button State Management Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Test 1: Course Report button has data-api-required
  var crButton = document.getElementById("ally-cr-execute");
  test(
    "Course Report button has data-api-required",
    crButton && crButton.getAttribute("data-api-required") === "true",
  );

  // Test 2: Course Report button has data-requires-course
  test(
    "Course Report button has data-requires-course",
    crButton && crButton.getAttribute("data-requires-course") === "true",
  );

  // Test 3: Statement Preview button has data-api-required
  var spButton = document.getElementById("ally-sp-execute");
  test(
    "Statement Preview button has data-api-required",
    spButton && spButton.getAttribute("data-api-required") === "true",
  );

  // Test 4: Statement Preview button has data-requires-course
  test(
    "Statement Preview button has data-requires-course",
    spButton && spButton.getAttribute("data-requires-course") === "true",
  );

  // Test 5: Report Builder button has data-api-required
  var rbButton = document.getElementById("ally-execute-query");
  test(
    "Report Builder button has data-api-required",
    rbButton && rbButton.getAttribute("data-api-required") === "true",
  );

  // Test 6: Report Builder does NOT have data-requires-course
  test(
    "Report Builder does NOT have data-requires-course",
    rbButton && rbButton.getAttribute("data-requires-course") !== "true",
  );

  // Test 7: Buttons have aria-describedby
  test(
    "Course Report button has aria-describedby",
    crButton && crButton.hasAttribute("aria-describedby"),
  );

  test(
    "Statement Preview button has aria-describedby",
    spButton && spButton.hasAttribute("aria-describedby"),
  );

  test(
    "Report Builder button has aria-describedby",
    rbButton && rbButton.hasAttribute("aria-describedby"),
  );

  // Test 8: Help text elements exist
  test(
    "Course Report help text exists",
    !!document.getElementById("ally-cr-execute-help"),
  );

  test(
    "Statement Preview help text exists",
    !!document.getElementById("ally-sp-execute-help"),
  );

  test(
    "Report Builder help text exists",
    !!document.getElementById("ally-execute-query-help"),
  );

  // Test 9: Button states reflect API state
  if (typeof ALLY_MAIN_CONTROLLER !== "undefined") {
    var currentState = ALLY_MAIN_CONTROLLER.getApiState();

    if (currentState === "READY") {
      // When API is ready, Report Builder should be enabled (no course requirement)
      test(
        "Report Builder enabled when API READY",
        rbButton && !rbButton.disabled,
      );
      test(
        "Report Builder has no api-not-ready indicator when READY",
        rbButton && rbButton.getAttribute("data-api-not-ready") !== "true",
      );
    } else {
      // When API not ready, Report Builder should be disabled
      test(
        "Report Builder disabled when API not READY (state: " +
          currentState +
          ")",
        rbButton && rbButton.disabled,
      );
      test(
        "Report Builder has api-not-ready indicator when not READY",
        rbButton && rbButton.getAttribute("data-api-not-ready") === "true",
      );
    }
  }

  // Summary
  console.log("\n" + results.passed + " passed, " + results.failed + " failed");

  return results;
}
// ========================================================================
// API Warm-Up UX Tests (Stage 3: Credentials Section Auto-Focus)
// ========================================================================

/**
 * Tests credentials section auto-focus functionality
 * @returns {Object} Test results with passed/failed counts
 */
function testAllyCredentialsFocus() {
  console.log("=== Credentials Section Auto-Focus Tests ===");

  var results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      results.tests.push({ name: name, passed: true });
      console.log("✓ " + name);
    } else {
      results.failed++;
      results.tests.push({ name: name, passed: false });
      console.error("✗ " + name);
    }
  }

  // Test 1: Credentials details element exists
  var detailsEl = document.getElementById("ally-credentials-details");
  test("Credentials details element exists", !!detailsEl);

  // Test 2: Client ID input exists
  var clientIdEl = document.getElementById("ally-client-id");
  test("Client ID input exists", !!clientIdEl);

  // Test 3: API Token input exists
  var tokenEl = document.getElementById("ally-api-token");
  test("API Token input exists", !!tokenEl);

  // Test 4: Test Connection button exists
  var testBtn = document.getElementById("ally-test-connection");
  test("Test Connection button exists", !!testBtn);

  // Test 5: CSS highlight class can be added/removed
  if (detailsEl) {
    detailsEl.classList.add("ally-credentials-highlight");
    test(
      "Highlight class can be added",
      detailsEl.classList.contains("ally-credentials-highlight"),
    );
    detailsEl.classList.remove("ally-credentials-highlight");
    test(
      "Highlight class can be removed",
      !detailsEl.classList.contains("ally-credentials-highlight"),
    );
  } else {
    test("Highlight class can be added", false);
    test("Highlight class can be removed", false);
  }

  // Test 6: CTA class can be added/removed from test button
  if (testBtn) {
    testBtn.classList.add("ally-test-connection-cta");
    test(
      "CTA class can be added to Test Connection button",
      testBtn.classList.contains("ally-test-connection-cta"),
    );
    testBtn.classList.remove("ally-test-connection-cta");
    test(
      "CTA class can be removed from Test Connection button",
      !testBtn.classList.contains("ally-test-connection-cta"),
    );
  } else {
    test("CTA class can be added to Test Connection button", false);
    test("CTA class can be removed from Test Connection button", false);
  }

  // Test 7: Details can be opened programmatically
  if (detailsEl) {
    var wasOpen = detailsEl.open;
    detailsEl.open = true;
    test("Details can be opened programmatically", detailsEl.open === true);
    detailsEl.open = wasOpen; // Restore original state
  } else {
    test("Details can be opened programmatically", false);
  }

  // Test 8: UI Manager has cached credential elements
  if (typeof ALLY_UI_MANAGER !== "undefined") {
    test(
      "UI Manager cached ally-client-id",
      !!ALLY_UI_MANAGER.getElement("ally-client-id"),
    );
    test(
      "UI Manager cached ally-api-token",
      !!ALLY_UI_MANAGER.getElement("ally-api-token"),
    );
    test(
      "UI Manager cached ally-test-connection",
      !!ALLY_UI_MANAGER.getElement("ally-test-connection"),
    );
  }

  // Summary
  console.log("\n" + results.passed + " passed, " + results.failed + " failed");

  return results;
}

/**
 * Runs all warm-up UX tests (Stage 1 + Stage 2 + Stage 3)
 * @returns {Object} Combined test results
 */
function testAllyWarmUpUX() {
  console.log("=== All Warm-Up UX Tests ===\n");

  var progressResults = testAllyWarmUpProgress();
  var buttonResults = testAllyButtonStates();
  var credentialsResults = testAllyCredentialsFocus();

  var totalPassed =
    progressResults.passed + buttonResults.passed + credentialsResults.passed;
  var totalFailed =
    progressResults.failed + buttonResults.failed + credentialsResults.failed;

  console.log("\n=== Warm-Up UX Summary ===");
  console.log(
    "Progress Bar: " +
      progressResults.passed +
      "/" +
      (progressResults.passed + progressResults.failed) +
      " passed",
  );
  console.log(
    "Button States: " +
      buttonResults.passed +
      "/" +
      (buttonResults.passed + buttonResults.failed) +
      " passed",
  );
  console.log(
    "Credentials Focus: " +
      credentialsResults.passed +
      "/" +
      (credentialsResults.passed + credentialsResults.failed) +
      " passed",
  );
  console.log("Total: " + totalPassed + " passed, " + totalFailed + " failed");

  return {
    passed: totalPassed,
    failed: totalFailed,
    progressBar: progressResults,
    buttonStates: buttonResults,
    credentialsFocus: credentialsResults,
  };
}

// ========================================================================
// Cache Integration Tests - Course Report
// ========================================================================

/**
 * Tests cache integration with Course Report module
 * @returns {boolean} True if all tests pass
 */
function testAllyCacheIntegrationCR() {
  console.group("Cache Integration - Course Report");

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

  // Module existence
  test("ALLY_COURSE_REPORT exists", typeof ALLY_COURSE_REPORT === "object");
  test("ALLY_CACHE exists", typeof ALLY_CACHE === "object");
  test("ALLY_CACHE_UI exists", typeof ALLY_CACHE_UI === "object");

  // Key generation
  var testKey = ALLY_CACHE.courseReportKey("_12345_1");
  test(
    "courseReportKey generates valid key",
    testKey === "ally-cache-cr-_12345_1",
  );

  // renderFromCache method exists
  test(
    "ALLY_COURSE_REPORT has renderFromCache",
    typeof ALLY_COURSE_REPORT.renderFromCache === "function",
  );

  // Results container exists
  var resultsContainer = document.getElementById("ally-cr-results");
  test("Course Report results container exists", resultsContainer !== null);

  // Test renderFromCache with invalid input
  var invalidResult = ALLY_COURSE_REPORT.renderFromCache(null);
  test("renderFromCache returns false for null input", invalidResult === false);

  var emptyResult = ALLY_COURSE_REPORT.renderFromCache({});
  test("renderFromCache returns false for empty object", emptyResult === false);

  // Test debug info includes cache state
  var debugInfo = ALLY_COURSE_REPORT.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
}

// ========================================================================
// Cache Integration Tests - Statement Preview
// ========================================================================

/**
 * Tests cache integration with Statement Preview module
 * @returns {boolean} True if all tests pass
 */
function testAllyCacheIntegrationSP() {
  console.group("Cache Integration - Statement Preview");

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

  // Module existence
  test(
    "ALLY_STATEMENT_PREVIEW exists",
    typeof ALLY_STATEMENT_PREVIEW === "object",
  );
  test("ALLY_CACHE exists", typeof ALLY_CACHE === "object");
  test("ALLY_CACHE_UI exists", typeof ALLY_CACHE_UI === "object");

  // Key generation
  var testKey = ALLY_CACHE.statementPreviewKey("_12345_1");
  test(
    "statementPreviewKey generates valid key",
    testKey === "ally-cache-sp-_12345_1",
  );

  // renderFromCache method exists
  test(
    "ALLY_STATEMENT_PREVIEW has renderFromCache",
    typeof ALLY_STATEMENT_PREVIEW.renderFromCache === "function",
  );

  // Results container exists
  var resultsContainer = document.getElementById("ally-sp-results");
  test("Statement Preview results container exists", resultsContainer !== null);

  // Test renderFromCache with invalid input
  var invalidResult = ALLY_STATEMENT_PREVIEW.renderFromCache(null);
  test("renderFromCache returns false for null input", invalidResult === false);

  var emptyResult = ALLY_STATEMENT_PREVIEW.renderFromCache({});
  test("renderFromCache returns false for empty object", emptyResult === false);

  // Test debug info includes cache state
  var debugInfo = ALLY_STATEMENT_PREVIEW.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test(
    "getDebugInfo includes cacheAvailable",
    typeof debugInfo.cacheAvailable === "boolean",
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
}

// ========================================================================
// Combined Cache Integration Tests
// ========================================================================

/**
 * Runs all cache integration tests
 * @returns {Object} Combined test results
 */
function testAllyCacheIntegration() {
  console.log("=== All Cache Integration Tests ===\n");

  var crResults = testAllyCacheIntegrationCR();
  var spResults = testAllyCacheIntegrationSP();

  console.log("\n=== Cache Integration Summary ===");
  console.log("Course Report: " + (crResults ? "PASSED" : "FAILED"));
  console.log("Statement Preview: " + (spResults ? "PASSED" : "FAILED"));

  return {
    courseReport: crResults,
    statementPreview: spResults,
    allPassed: crResults && spResults,
  };
}

// ========================================================================
// Cache Integration Tests - Report Builder (Stage 4)
// ========================================================================

/**
 * Tests cache integration with Report Builder
 * @returns {boolean} True if all tests pass
 */
function testAllyCacheIntegrationRB() {
  console.group("Cache Integration - Report Builder");

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

  // Module existence
  test("ALLY_MAIN_CONTROLLER exists", typeof ALLY_MAIN_CONTROLLER === "object");
  test("ALLY_CACHE exists", typeof ALLY_CACHE === "object");
  test("ALLY_CACHE_UI exists", typeof ALLY_CACHE_UI === "object");

  // Key generation
  var testKey = ALLY_CACHE.reportBuilderKey(
    "overall",
    { termId: "_344_1" },
    "overallScore",
    "asc",
    100,
  );
  test(
    "reportBuilderKey generates key",
    testKey && testKey.indexOf("ally-cache-rb-") === 0,
  );

  // Same params produce same key
  var testKey2 = ALLY_CACHE.reportBuilderKey(
    "overall",
    { termId: "_344_1" },
    "overallScore",
    "asc",
    100,
  );
  test("reportBuilderKey is deterministic", testKey === testKey2);

  // Different params produce different key
  var testKey3 = ALLY_CACHE.reportBuilderKey(
    "issues",
    { termId: "_344_1" },
    "overallScore",
    "asc",
    100,
  );
  test("reportBuilderKey differs for different endpoint", testKey !== testKey3);

  // Different filters produce different key
  var testKey4 = ALLY_CACHE.reportBuilderKey(
    "overall",
    { termId: "_345_1" },
    "overallScore",
    "asc",
    100,
  );
  test("reportBuilderKey differs for different filters", testKey !== testKey4);

  // Results container exists
  var resultsContainer = document.getElementById("ally-results-section");
  test("Report Builder results container exists", resultsContainer !== null);

  // Handler method exists
  test(
    "handleCacheBrowserSelect exists",
    typeof ALLY_MAIN_CONTROLLER.handleCacheBrowserSelect === "function",
  );

  // Render from cache method exists
  test(
    "renderReportBuilderFromCache exists",
    typeof ALLY_MAIN_CONTROLLER.renderReportBuilderFromCache === "function",
  );

  // Test renderFromCache with invalid input
  var invalidResult = ALLY_MAIN_CONTROLLER.renderReportBuilderFromCache(null);
  test(
    "renderReportBuilderFromCache returns false for null",
    invalidResult === false,
  );

  var emptyResult = ALLY_MAIN_CONTROLLER.renderReportBuilderFromCache({});
  test(
    "renderReportBuilderFromCache returns false for empty object",
    emptyResult === false,
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
}

// ========================================================================
// Cache Offline Handling Tests (Stage 4)
// ========================================================================

/**
 * Tests cache offline handling functionality
 * @returns {boolean} True if all tests pass
 */
function testAllyCacheOffline() {
  console.group("Cache Offline Handling");

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

  // Offline banner elements
  var offlineBanner = document.getElementById("ally-cache-offline-banner");
  test("Offline banner element exists", offlineBanner !== null);
  test(
    "Offline banner has role=alert",
    offlineBanner && offlineBanner.getAttribute("role") === "alert",
  );
  test(
    "Offline banner is initially hidden",
    offlineBanner && offlineBanner.hidden === true,
  );

  var offlineCount = document.getElementById("ally-cache-offline-count");
  test("Offline count element exists", offlineCount !== null);

  var browseBtn = document.getElementById("ally-cache-offline-browse");
  test("Browse cached button exists", browseBtn !== null);

  var retryBtn = document.getElementById("ally-cache-offline-retry");
  test("Retry API button exists", retryBtn !== null);

  // Cache browser elements
  var cacheBrowser = document.getElementById("ally-cache-browser");
  test("Cache browser element exists", cacheBrowser !== null);
  test(
    "Cache browser has role=dialog",
    cacheBrowser && cacheBrowser.getAttribute("role") === "dialog",
  );
  test(
    "Cache browser is initially hidden",
    cacheBrowser && cacheBrowser.hidden === true,
  );

  var browserOptions = document.getElementById("ally-cache-browser-options");
  test("Browser options container exists", browserOptions !== null);

  var loadBtn = document.getElementById("ally-cache-browser-load");
  test("Load button exists", loadBtn !== null);

  var cancelBtn = document.getElementById("ally-cache-browser-cancel");
  test("Cancel button exists", cancelBtn !== null);

  // UI methods exist
  test(
    "showOfflineBanner method exists",
    typeof ALLY_CACHE_UI.showOfflineBanner === "function",
  );
  test(
    "hideOfflineBanner method exists",
    typeof ALLY_CACHE_UI.hideOfflineBanner === "function",
  );
  test(
    "showCacheBrowser method exists",
    typeof ALLY_CACHE_UI.showCacheBrowser === "function",
  );
  test(
    "hideCacheBrowser method exists",
    typeof ALLY_CACHE_UI.hideCacheBrowser === "function",
  );

  // Test show/hide offline banner
  ALLY_CACHE_UI.showOfflineBanner();
  test(
    "showOfflineBanner shows banner",
    offlineBanner && offlineBanner.hidden === false,
  );

  ALLY_CACHE_UI.hideOfflineBanner();
  test(
    "hideOfflineBanner hides banner",
    offlineBanner && offlineBanner.hidden === true,
  );

  // Test show/hide cache browser
  var selectCalled = false;
  ALLY_CACHE_UI.showCacheBrowser(function (key, entry) {
    selectCalled = true;
  });
  test(
    "showCacheBrowser shows browser",
    cacheBrowser && cacheBrowser.hidden === false,
  );

  ALLY_CACHE_UI.hideCacheBrowser();
  test(
    "hideCacheBrowser hides browser",
    cacheBrowser && cacheBrowser.hidden === true,
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
}

// ========================================================================
// Combined Cache Tests (Stage 4)
// ========================================================================

/**
 * Runs all cache tests (core + UI + integrations)
 * @returns {boolean} True if all tests pass
 */
function testAllyCacheAll() {
  console.log("=== All Cache Tests ===\n");

  var results = [];

  // Core module tests
  if (typeof testAllyCache === "function") {
    results.push({ name: "Core Module", passed: testAllyCache() });
  }

  // UI component tests
  if (typeof testAllyCacheUI === "function") {
    results.push({ name: "UI Components", passed: testAllyCacheUI() });
  }

  // Integration tests
  results.push({
    name: "Course Report Integration",
    passed: testAllyCacheIntegrationCR(),
  });
  results.push({
    name: "Statement Preview Integration",
    passed: testAllyCacheIntegrationSP(),
  });
  results.push({
    name: "Report Builder Integration",
    passed: testAllyCacheIntegrationRB(),
  });
  results.push({ name: "Offline Handling", passed: testAllyCacheOffline() });

  var allPassed = results.every(function (r) {
    return r.passed;
  });

  console.log("\n=== Cache Test Summary ===");
  results.forEach(function (r) {
    console.log(r.name + ": " + (r.passed ? "✓ PASSED" : "✗ FAILED"));
  });
  console.log(
    "\n" +
      (allPassed ? "✓ ALL CACHE TESTS PASSED" : "✗ SOME CACHE TESTS FAILED"),
  );

  return allPassed;
}

// Expose test functions globally
if (typeof window !== "undefined") {
  window.testAllyCourseReportController = testAllyCourseReportController;
  window.testAllyCourseReport = testAllyCourseReport;

  // Statement Preview tests (Phase 7B)
  window.testAllyStatementPreviewConfig = testAllyStatementPreviewConfig;
  window.testAllyStatementPreviewSearch = testAllyStatementPreviewSearch;
  window.testAllyStatementPreviewController =
    testAllyStatementPreviewController;
  window.testAllyStatementPreview = testAllyStatementPreview;
  window.testAllyStatementPreviewRendering = testAllyStatementPreviewRendering;

  // Warm-Up UX tests (Stage 1 + Stage 2 + Stage 3)
  window.testAllyWarmUpProgress = testAllyWarmUpProgress;
  window.testAllyButtonStates = testAllyButtonStates;
  window.testAllyCredentialsFocus = testAllyCredentialsFocus;
  window.testAllyWarmUpUX = testAllyWarmUpUX;

  // Cache Integration tests (Stage 3)
  window.testAllyCacheIntegrationCR = testAllyCacheIntegrationCR;
  window.testAllyCacheIntegrationSP = testAllyCacheIntegrationSP;
  window.testAllyCacheIntegration = testAllyCacheIntegration;

  // Cache Integration tests (Stage 4)
  window.testAllyCacheIntegrationRB = testAllyCacheIntegrationRB;
  window.testAllyCacheOffline = testAllyCacheOffline;
  window.testAllyCacheAll = testAllyCacheAll;
}
