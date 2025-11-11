// test-latex-processor-enhanced.js
// Comprehensive tests for LaTeXProcessorEnhanced module
// STAGE 4: Tests for enhanced processor using original source method

const TestLaTeXProcessorEnhanced = (function () {
  "use strict";

  /**
   * Main test suite for LaTeXProcessorEnhanced
   * Tests all storage, extraction, conversion, and processing functions
   */
  function testLaTeXProcessorEnhanced() {
    console.log("\n" + "=".repeat(80));
    console.log("TESTING: LaTeX Processor Enhanced");
    console.log("=".repeat(80) + "\n");

    const tests = {
      moduleExists: testModuleExists,
      hasRequiredMethods: testRequiredMethods,
      storageOperations: testStorageOperations,
      preambleExtraction: testPreambleExtraction,
      macroConversion: testMacroConversion,
      fullProcessing: testFullProcessing,
      errorHandling: testErrorHandling,
      integrationReadiness: testIntegrationReadiness,
    };

    return TestUtilities.runTestSuite("LaTeX Processor Enhanced", tests);
  }

  /**
   * Test 1: Module existence
   */
  function testModuleExists() {
    // Direct check - if we can access methods, module is loaded
    if (typeof LaTeXProcessorEnhanced === "undefined") {
      throw new Error("LaTeXProcessorEnhanced module not loaded");
    }

    if (typeof LaTeXProcessorEnhanced !== "object") {
      throw new Error(
        `LaTeXProcessorEnhanced should be object, got ${typeof LaTeXProcessorEnhanced}`
      );
    }

    if (!LaTeXProcessorEnhanced) {
      throw new Error("LaTeXProcessorEnhanced is null or falsy");
    }

    return true;
  }

  /**
   * Test 2: Required methods exist
   */
  function testRequiredMethods() {
    const requiredMethods = [
      "process",
      "storeOriginalLatex",
      "getOriginalLatex",
      "clearOriginalLatex",
      "extractPreambleCommands",
      "convertCommandsToMacros",
      "validateOriginalLatex",
      "getDiagnostics",
    ];

    requiredMethods.forEach((method) => {
      if (typeof LaTeXProcessorEnhanced[method] !== "function") {
        throw new Error(`Missing or invalid method: ${method}`);
      }
    });

    return true;
  }

  /**
   * Test 3: Storage operations
   */
  function testStorageOperations() {
    // Clear any existing storage first
    LaTeXProcessorEnhanced.clearOriginalLatex();

    // Test 1: Store valid LaTeX
    const testLatex =
      "\\newcommand{\\R}{\\mathbb{R}}\n$\\R$ is the real numbers";
    const storeResult = LaTeXProcessorEnhanced.storeOriginalLatex(testLatex);

    if (storeResult !== true) {
      throw new Error("Failed to store valid LaTeX");
    }

    // Test 2: Retrieve stored LaTeX
    const retrieved = LaTeXProcessorEnhanced.getOriginalLatex();

    if (retrieved !== testLatex) {
      throw new Error(
        `Retrieved LaTeX doesn't match stored. Got: ${retrieved}`
      );
    }

    // Test 3: Validation shows stored state
    const validation = LaTeXProcessorEnhanced.validateOriginalLatex();

    if (!validation.hasLatex) {
      throw new Error("Validation should show LaTeX is stored");
    }

    if (!validation.hasTimestamp) {
      throw new Error("Validation should show timestamp exists");
    }

    if (validation.length !== testLatex.length) {
      throw new Error(
        `Validation length mismatch: expected ${testLatex.length}, got ${validation.length}`
      );
    }

    // Test 4: Clear storage
    const clearResult = LaTeXProcessorEnhanced.clearOriginalLatex();

    if (clearResult !== true) {
      throw new Error("Failed to clear storage");
    }

    // Test 5: Verify cleared
    const afterClear = LaTeXProcessorEnhanced.getOriginalLatex();

    if (afterClear !== null) {
      throw new Error("Storage should be null after clearing");
    }

    // Test 6: Reject invalid input
    const invalidResult1 = LaTeXProcessorEnhanced.storeOriginalLatex(null);
    if (invalidResult1 === true) {
      throw new Error("Should reject null LaTeX");
    }

    const invalidResult2 = LaTeXProcessorEnhanced.storeOriginalLatex("");
    if (invalidResult2 === true) {
      throw new Error("Should reject empty string");
    }

    const invalidResult3 = LaTeXProcessorEnhanced.storeOriginalLatex("   ");
    if (invalidResult3 === true) {
      throw new Error("Should reject whitespace-only string");
    }

    return true;
  }

  /**
   * Test 4: Preamble command extraction
   */
  function testPreambleExtraction() {
    const testCases = [
      {
        name: "newcommand without args",
        latex: "\\newcommand{\\R}{\\mathbb{R}}",
        expected: { name: "R", args: 0, definition: "\\mathbb{R}" },
      },
      {
        name: "newcommand with args",
        latex: "\\newcommand{\\vec}[1]{\\mathbf{#1}}",
        expected: { name: "vec", args: 1, definition: "\\mathbf{#1}" },
      },
      {
        name: "renewcommand without args",
        latex: "\\renewcommand{\\C}{\\mathbb{C}}",
        expected: { name: "C", args: 0, definition: "\\mathbb{C}" },
      },
      {
        name: "renewcommand with args",
        latex: "\\renewcommand{\\norm}[1]{\\|#1\\|}",
        expected: { name: "norm", args: 1, definition: "\\|#1\\|" },
      },
    ];

    // PHASE 1D: Add new test cases for \def and \providecommand
    const phase1dTestCases = [
      {
        name: "TeX primitive \\def without args",
        latex: "\\def\\Q{\\mathbb{Q}}",
        expected: { name: "Q", args: 0, definition: "\\mathbb{Q}" },
      },
      {
        name: "providecommand without args",
        latex: "\\providecommand{\\C}{\\mathbb{C}}",
        expected: { name: "C", args: 0, definition: "\\mathbb{C}" },
      },
      {
        name: "providecommand with args",
        latex: "\\providecommand{\\abs}[1]{\\left|#1\\right|}",
        expected: { name: "abs", args: 1, definition: "\\left|#1\\right|" },
      },
      {
        name: "providecommand with optional args",
        latex: "\\providecommand{\\deriv}[2][x]{\\frac{d#2}{d#1}}",
        expected: {
          name: "deriv",
          args: 2,
          defaultArg: "x",
          definition: "\\frac{d#2}{d#1}",
        },
      },
    ];

    // Combine original and Phase 1D test cases
    const allTestCases = [...testCases, ...phase1dTestCases];

    allTestCases.forEach((testCase) => {
      const commands = LaTeXProcessorEnhanced.extractPreambleCommands(
        testCase.latex
      );

      if (commands.length !== 1) {
        throw new Error(
          `${testCase.name}: Expected 1 command, got ${commands.length}`
        );
      }

      const cmd = commands[0];

      if (cmd.name !== testCase.expected.name) {
        throw new Error(
          `${testCase.name}: Expected name '${testCase.expected.name}', got '${cmd.name}'`
        );
      }

      if (cmd.args !== testCase.expected.args) {
        throw new Error(
          `${testCase.name}: Expected ${testCase.expected.args} args, got ${cmd.args}`
        );
      }

      if (cmd.definition !== testCase.expected.definition) {
        throw new Error(`${testCase.name}: Definition mismatch`);
      }

      // Check optional defaultArg if expected
      if (testCase.expected.defaultArg !== undefined) {
        if (cmd.defaultArg !== testCase.expected.defaultArg) {
          throw new Error(
            `${testCase.name}: Expected defaultArg '${testCase.expected.defaultArg}', got '${cmd.defaultArg}'`
          );
        }
      }
    });

    // Test multiple commands
    const multiLatex = `
      \\newcommand{\\R}{\\mathbb{R}}
      \\newcommand{\\N}{\\mathbb{N}}
      \\newcommand{\\vec}[1]{\\mathbf{#1}}
    `;

    const multiCommands =
      LaTeXProcessorEnhanced.extractPreambleCommands(multiLatex);

    if (multiCommands.length !== 3) {
      throw new Error(
        `Multiple commands: Expected 3, got ${multiCommands.length}`
      );
    }

    // Test empty input
    const emptyCommands = LaTeXProcessorEnhanced.extractPreambleCommands("");

    if (emptyCommands.length !== 0) {
      throw new Error("Empty input should return empty array");
    }

    return true;
  }

  /**
   * Test 5: Macro conversion
   */
  function testMacroConversion() {
    const testCommands = [
      { name: "R", args: 0, definition: "\\mathbb{R}" },
      { name: "N", args: 0, definition: "\\mathbb{N}" },
      { name: "vec", args: 1, definition: "\\mathbf{#1}" },
    ];

    const macros = LaTeXProcessorEnhanced.convertCommandsToMacros(testCommands);

    // Check count
    if (Object.keys(macros).length !== 3) {
      throw new Error(`Expected 3 macros, got ${Object.keys(macros).length}`);
    }

    // Check format
    if (!Array.isArray(macros.R)) {
      throw new Error("Macro should be array");
    }

    if (macros.R.length !== 2) {
      throw new Error("Macro array should have 2 elements");
    }

    // Check values
    if (macros.R[0] !== "\\mathbb{R}") {
      throw new Error(`R macro definition incorrect: ${macros.R[0]}`);
    }

    if (macros.R[1] !== 0) {
      throw new Error(`R macro args incorrect: ${macros.R[1]}`);
    }

    if (macros.vec[1] !== 1) {
      throw new Error(`vec macro should have 1 arg, got ${macros.vec[1]}`);
    }

    // Test empty input
    const emptyMacros = LaTeXProcessorEnhanced.convertCommandsToMacros([]);

    if (Object.keys(emptyMacros).length !== 0) {
      throw new Error("Empty input should return empty object");
    }

    return true;
  }

  /**
   * Test 6: Full processing pipeline
   */
  function testFullProcessing() {
    // Clear storage first
    LaTeXProcessorEnhanced.clearOriginalLatex();

    // Test 1: Processing without stored LaTeX should return null
    const resultNoLatex = LaTeXProcessorEnhanced.process("<div>Test</div>");

    if (resultNoLatex !== null) {
      throw new Error("Processing without stored LaTeX should return null");
    }

    // Test 2: Store LaTeX and process
    const testLatex = `
      \\newcommand{\\R}{\\mathbb{R}}
      \\newcommand{\\N}{\\mathbb{N}}
      $\\R$ and $\\N$
    `;

    LaTeXProcessorEnhanced.storeOriginalLatex(testLatex);
    const result = LaTeXProcessorEnhanced.process("<div>Content</div>");

    if (result === null) {
      throw new Error(
        "Processing with stored LaTeX should return result object"
      );
    }

    // Check result structure
    if (!result.processedContent) {
      throw new Error("Result missing processedContent");
    }

    if (!result.customMacros) {
      throw new Error("Result missing customMacros");
    }

    if (!result.metadata) {
      throw new Error("Result missing metadata");
    }

    // Check metadata
    if (result.metadata.method !== "enhanced") {
      throw new Error(
        `Expected method 'enhanced', got '${result.metadata.method}'`
      );
    }

    if (result.metadata.macroCount !== 2) {
      throw new Error(`Expected 2 macros, got ${result.metadata.macroCount}`);
    }

    if (result.metadata.commandCount !== 2) {
      throw new Error(
        `Expected 2 commands, got ${result.metadata.commandCount}`
      );
    }

    // Check macros were extracted
    if (!result.customMacros.R) {
      throw new Error("Custom macros should include R");
    }

    if (!result.customMacros.N) {
      throw new Error("Custom macros should include N");
    }

    return true;
  }

  /**
   * Test 7: Error handling
   */
  function testErrorHandling() {
    // Test 1: Extracting from invalid input
    const invalidExtract = LaTeXProcessorEnhanced.extractPreambleCommands(null);

    if (!Array.isArray(invalidExtract)) {
      throw new Error("Invalid extraction should return empty array");
    }

    if (invalidExtract.length !== 0) {
      throw new Error("Invalid extraction should return empty array");
    }

    // Test 2: Converting invalid commands
    const invalidConvert = LaTeXProcessorEnhanced.convertCommandsToMacros(null);

    if (typeof invalidConvert !== "object") {
      throw new Error("Invalid conversion should return empty object");
    }

    if (Object.keys(invalidConvert).length !== 0) {
      throw new Error("Invalid conversion should return empty object");
    }

    // Test 3: Processing with error should return null
    LaTeXProcessorEnhanced.clearOriginalLatex();
    const errorResult = LaTeXProcessorEnhanced.process("<div>Test</div>");

    if (errorResult !== null) {
      throw new Error("Processing errors should return null for fallback");
    }

    return true;
  }

  /**
   * Test 8: Integration readiness
   */
  function testIntegrationReadiness() {
    const diagnostics = LaTeXProcessorEnhanced.getDiagnostics();

    // Check diagnostics structure
    if (!diagnostics.module) {
      throw new Error("Diagnostics missing module name");
    }

    if (!diagnostics.capabilities) {
      throw new Error("Diagnostics missing capabilities");
    }

    if (!diagnostics.storage) {
      throw new Error("Diagnostics missing storage info");
    }

    // Check all capabilities are present and true
    const requiredCapabilities = [
      "storeLatex",
      "getLatex",
      "clearLatex",
      "extractCommands",
      "convertMacros",
      "processExport",
      "validate",
    ];

    requiredCapabilities.forEach((capability) => {
      if (diagnostics.capabilities[capability] !== true) {
        throw new Error(`Capability '${capability}' not ready`);
      }
    });

    // Check status
    if (diagnostics.status !== "operational") {
      throw new Error(
        `Expected status 'operational', got '${diagnostics.status}'`
      );
    }

    return true;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testLaTeXProcessorEnhanced: testLaTeXProcessorEnhanced,
  };
})();

// Auto-register with TestRegistry if available
if (window.TestRegistry) {
  TestRegistry.registerTest({
    name: "LaTeX Processor Enhanced",
    category: "individual",
    fn: TestLaTeXProcessorEnhanced.testLaTeXProcessorEnhanced,
    module: "LaTeXProcessorEnhanced",
  });
}
// Make globally available
window.TestLaTeXProcessorEnhanced = TestLaTeXProcessorEnhanced;

// Make the function directly accessible
window.testLaTeXProcessorEnhanced =
  TestLaTeXProcessorEnhanced.testLaTeXProcessorEnhanced;
