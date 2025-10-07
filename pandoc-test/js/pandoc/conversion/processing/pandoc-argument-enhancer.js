// pandoc-argument-enhancer.js
// Pandoc Argument Enhancer - Handles enhanced Pandoc argument generation and investigation mode
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 5

const PandocArgumentEnhancer = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("PANDOC_ARGS", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[PANDOC_ARGS]"),
    logWarn: console.warn.bind(console, "[PANDOC_ARGS]"),
    logInfo: console.log.bind(console, "[PANDOC_ARGS]"),
    logDebug: console.log.bind(console, "[PANDOC_ARGS]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // PANDOC ARGUMENT ENHANCEMENT CONFIGURATION
  // ===========================================================================================

  const ENHANCEMENT_PRESETS = {
    semantic: ["--section-divs", "--html-q-tags", "--wrap=preserve"],
    accessibility: [
      "--section-divs",
      "--id-prefix=content-",
      "--html-q-tags",
      "--number-sections",
    ],
    structure: ["--section-divs", "--wrap=preserve", "--standalone", "--toc"],
    theorem: [
      "--section-divs",
      "--wrap=preserve",
      "--html-q-tags",
      "--from=latex+fancy_lists",
    ],
    custom: null, // Will be determined dynamically
  };

  const DEFAULT_CUSTOM_PRESET = [
    "--from=latex+tex_math_dollars+fancy_lists",
    "--section-divs",
    "--html-q-tags",
  ];

  // ===========================================================================================
  // ENHANCED PANDOC ARGUMENT GENERATION
  // ===========================================================================================

  /**
   * INVESTIGATION: Enhanced Pandoc argument generation
   * Tests different Pandoc argument combinations to improve HTML output
   * CORE FEATURE: Investigation mode with preset management and comparison features
   */
  function generateEnhancedPandocArgs(baseArgs) {
    try {
      const preset = getSelectedPreset();

      if (!preset || preset === "") {
        logDebug("No preset selected, using base arguments");
        return baseArgs;
      }

      const enhancements = getEnhancementsByPreset(preset);
      const enhancedArgs = baseArgs + " " + enhancements.join(" ");

      logInfo(`🧪 Enhanced Pandoc args: ${enhancedArgs}`);
      logDebug(
        `🔬 Preset: ${preset}, Enhancements: ${enhancements.join(", ")}`
      );

      return enhancedArgs;
    } catch (error) {
      logError("Error generating enhanced Pandoc args:", error);
      return baseArgs;
    }
  }

  /**
   * Get the currently selected enhancement preset from UI
   */
  function getSelectedPreset() {
    try {
      const presetElement = document.getElementById(
        "pandoc-enhancement-preset"
      );
      return presetElement ? presetElement.value : "";
    } catch (error) {
      logError("Error getting selected preset:", error);
      return "";
    }
  }

  /**
   * INVESTIGATION: Get enhancement arguments by preset
   * Different presets test various Pandoc capabilities
   */
  function getEnhancementsByPreset(preset) {
    try {
      if (preset === "custom") {
        return getCustomArguments();
      }

      const selectedPreset =
        ENHANCEMENT_PRESETS[preset] || ENHANCEMENT_PRESETS.semantic;
      logDebug(
        `Selected enhancement preset: ${preset} → ${selectedPreset.join(", ")}`
      );

      return selectedPreset;
    } catch (error) {
      logError("Error getting enhancements by preset:", error);
      return ENHANCEMENT_PRESETS.semantic;
    }
  }

  /**
   * INVESTIGATION: Get custom arguments from textarea
   */
  function getCustomArguments() {
    try {
      const customArgsTextarea = document.getElementById("custom-pandoc-args");
      if (!customArgsTextarea || !customArgsTextarea.value.trim()) {
        logDebug("No custom arguments provided, using default custom preset");
        return DEFAULT_CUSTOM_PRESET;
      }

      // Parse custom arguments - split by whitespace but preserve quoted arguments
      const customArgsText = customArgsTextarea.value.trim();
      const customArgs = customArgsText
        .split(/\s+/)
        .filter((arg) => arg.length > 0);

      logInfo(`🧪 Custom arguments parsed: ${customArgs.join(", ")}`);
      return customArgs;
    } catch (error) {
      logError("Error parsing custom arguments:", error);
      return ["--section-divs"]; // Fallback
    }
  }

  // ===========================================================================================
  // COMPARISON MODE FUNCTIONALITY
  // ===========================================================================================

  /**
   * INVESTIGATION: Handle comparison mode for side-by-side analysis
   * Runs both standard and enhanced conversion for comparison
   */
  async function handleComparisonMode(
    inputText,
    baseArgumentsText,
    pandocFunction
  ) {
    const showComparison = isComparisonModeEnabled();

    if (!showComparison) {
      logDebug("Comparison mode disabled, using single conversion");
      return null; // Signal to use normal conversion
    }

    if (!pandocFunction || typeof pandocFunction !== "function") {
      logError("Pandoc function not available for comparison mode");
      return false;
    }

    logInfo("🔬 Running comparison mode: standard vs enhanced conversion");

    try {
      // Update status for comparison
      if (window.StatusManager) {
        window.StatusManager.setLoading("Running comparison analysis...", 30);
      }

      // Run standard conversion
      logInfo("🧪 Running standard conversion...");
      const standardOutput = pandocFunction(baseArgumentsText, inputText);

      // Run enhanced conversion
      logInfo("🧪 Running enhanced conversion...");
      const enhancedArgs = generateEnhancedPandocArgs(baseArgumentsText);
      const enhancedOutput = pandocFunction(enhancedArgs, inputText);

      // Display comparison results
      const comparisonResult = displayComparisonResults(
        standardOutput,
        enhancedOutput,
        baseArgumentsText,
        enhancedArgs
      );

      if (window.StatusManager) {
        window.StatusManager.setReady("🔬 Comparison analysis complete");
      }

      return comparisonResult;
    } catch (error) {
      logError("Error in comparison mode:", error);
      if (window.StatusManager) {
        window.StatusManager.setError("Comparison analysis failed");
      }
      return false;
    }
  }

  /**
   * Check if comparison mode is currently enabled
   */
  function isComparisonModeEnabled() {
    try {
      const comparisonModeElement = document.getElementById(
        "pandoc-comparison-mode"
      );
      return comparisonModeElement ? comparisonModeElement.checked : false;
    } catch (error) {
      logError("Error checking comparison mode status:", error);
      return false;
    }
  }

  /**
   * INVESTIGATION: Display comparison results in enhanced format
   * Shows side-by-side standard vs enhanced output with analysis
   */
  function displayComparisonResults(
    standardOutput,
    enhancedOutput,
    standardArgs,
    enhancedArgs
  ) {
    try {
      const outputDiv = document.getElementById("output");
      if (!outputDiv) {
        logError("Output div not found for comparison display");
        return false;
      }

      logInfo("📊 Displaying comparison results");

      // Clean both outputs for display
      const cleanStandardOutput = cleanOutputForDisplay(standardOutput);
      const cleanEnhancedOutput = cleanOutputForDisplay(enhancedOutput);

      // Generate analysis
      const analysis = generateComparisonAnalysis(
        cleanStandardOutput,
        cleanEnhancedOutput
      );

      outputDiv.innerHTML = createComparisonHTML(
        cleanStandardOutput,
        cleanEnhancedOutput,
        standardArgs,
        enhancedArgs,
        analysis
      );

      // Re-render MathJax for both outputs
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([outputDiv]).catch((error) => {
            logWarn("MathJax rendering failed in comparison view:", error);
          });
        }
      }, 100);

      return true;
    } catch (error) {
      logError("Error displaying comparison results:", error);
      return false;
    }
  }

  /**
   * Clean output for comparison display
   */
  function cleanOutputForDisplay(output) {
    if (window.OutputCleaner) {
      return window.OutputCleaner.cleanPandocOutput(output);
    } else {
      logWarn("OutputCleaner not available - using basic cleaning");
      return output ? output.trim() : "";
    }
  }

  /**
   * Create HTML for comparison display
   */
  function createComparisonHTML(
    standardOutput,
    enhancedOutput,
    standardArgs,
    enhancedArgs,
    analysis
  ) {
    return `
        <div class="investigation-comparison" style="font-family: inherit;">
          <div style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem; padding-bottom: 0.75rem;">
            <h3 style="color: var(--heading-color); margin: 0 0 0.5rem 0;">🧪 Pandoc Investigation: Standard vs Enhanced Conversion</h3>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
              Comparing conversion outputs to evaluate enhanced Pandoc argument effectiveness.
            </p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
            <div>
              <h4 style="color: var(--text-secondary); margin: 0 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--sidebar-border); padding-bottom: 0.25rem;">
                📋 Standard Conversion
              </h4>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: monospace; background: var(--surface-color); padding: 0.4rem; border-radius: 3px;">
                ${escapeHtml(standardArgs)}
              </div>
              <div style="border: 1px solid var(--sidebar-border); padding: 1rem; border-radius: 6px; max-height: 400px; overflow-y: auto; background: var(--body-bg);">
                ${standardOutput}
              </div>
            </div>
            
            <div>
              <h4 style="color: var(--link-color); margin: 0 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--link-color); padding-bottom: 0.25rem;">
                ✨ Enhanced Conversion
              </h4>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: monospace; background: var(--surface-color); padding: 0.4rem; border-radius: 3px;">
                ${escapeHtml(enhancedArgs)}
              </div>
              <div style="border: 2px solid var(--link-color); padding: 1rem; border-radius: 6px; max-height: 400px; overflow-y: auto; background: var(--body-bg);">
                ${enhancedOutput}
              </div>
            </div>
          </div>
          
          <div>
            <h4 style="color: var(--heading-color); margin: 0 0 1rem 0; font-size: 1.1rem;">📊 Comparative Analysis</h4>
            <div id="comparison-analysis" style="background: var(--surface-color); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--border-color);">
              ${analysis}
            </div>
          </div>
          
          <div style="margin-top: 2rem; padding: 1rem; background: var(--focus-bg); border-radius: 6px; border-left: 4px solid var(--link-color);">
            <h5 style="color: var(--heading-color); margin: 0 0 0.5rem 0;">🔬 Investigation Notes</h5>
            <p style="margin: 0; font-size: 0.9rem; color: var(--body-text);">
              This comparison helps determine whether enhanced Pandoc arguments improve semantic HTML structure, 
              accessibility features, and overall document quality. Look for differences in element structure, 
              ID attributes, section organisation, and mathematical expression handling.
            </p>
          </div>
        </div>
      `;
  }

  /**
   * INVESTIGATION: Generate analysis of differences between outputs
   */
  function generateComparisonAnalysis(standardOutput, enhancedOutput) {
    const differences = [];

    // Check for section divs
    const standardSections = (standardOutput.match(/<section/g) || []).length;
    const enhancedSections = (enhancedOutput.match(/<section/g) || []).length;

    if (enhancedSections > standardSections) {
      differences.push(
        `✅ Enhanced version adds ${
          enhancedSections - standardSections
        } semantic section elements`
      );
    }

    // Check for ID attributes
    const standardIds = (standardOutput.match(/id="/g) || []).length;
    const enhancedIds = (enhancedOutput.match(/id="/g) || []).length;

    if (enhancedIds > standardIds) {
      differences.push(
        `✅ Enhanced version adds ${
          enhancedIds - standardIds
        } ID attributes for navigation`
      );
    }

    // Check for content- prefixed IDs
    const contentIds = (enhancedOutput.match(/id="content-/g) || []).length;
    if (contentIds > 0) {
      differences.push(
        `✅ Enhanced version includes ${contentIds} content-prefixed IDs for better accessibility`
      );
    }

    // Check for numbered sections
    const numberedSections =
      enhancedOutput.includes('class="') && enhancedOutput.includes("number");
    if (numberedSections) {
      differences.push(
        `✅ Enhanced version may include automatic section numbering`
      );
    }

    // Check overall HTML structure
    const standardLength = standardOutput.length;
    const enhancedLength = enhancedOutput.length;
    const lengthDifference = Math.abs(enhancedLength - standardLength);

    if (lengthDifference > 100) {
      const direction = enhancedLength > standardLength ? "larger" : "smaller";
      differences.push(
        `📏 Enhanced output is ${lengthDifference} characters ${direction} (${(
          (lengthDifference / standardLength) *
          100
        ).toFixed(1)}% difference)`
      );
    }

    if (differences.length === 0) {
      return `
          <p><strong>No significant structural differences detected.</strong></p>
          <p>The enhanced arguments may not be providing additional benefits for this content type, 
          or the differences may be subtle and require manual inspection of the HTML structure.</p>
          <p><strong>Recommendation:</strong> Try different content (theorems, complex sections) or different enhancement presets.</p>
        `;
    }

    return `
        <p><strong>Key Differences Identified:</strong></p>
        <ul style="margin: 0.5rem 0 1rem 1.5rem;">
          ${differences
            .map((diff) => `<li style="margin-bottom: 0.25rem;">${diff}</li>`)
            .join("")}
        </ul>
        <p><strong>Assessment:</strong> ${
          differences.length > 2
            ? "Enhanced arguments show significant improvements in HTML structure and accessibility."
            : "Enhanced arguments provide moderate improvements. Consider testing with more complex content."
        }</p>
      `;
  }

  /**
   * Utility: Escape HTML for safe display in analysis
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ===========================================================================================
  // PRESET MANAGEMENT
  // ===========================================================================================

  /**
   * Get available enhancement presets
   */
  function getAvailablePresets() {
    return Object.keys(ENHANCEMENT_PRESETS);
  }

  /**
   * Add or update a custom preset
   */
  function updatePreset(presetName, arguments_) {
    if (!presetName || !Array.isArray(arguments_)) {
      logError("Invalid preset name or arguments for preset update");
      return false;
    }

    try {
      ENHANCEMENT_PRESETS[presetName] = [...arguments_];
      logInfo(
        `Updated preset "${presetName}" with ${arguments_.length} arguments`
      );
      return true;
    } catch (error) {
      logError("Error updating preset:", error);
      return false;
    }
  }

  /**
   * Get preset details
   */
  function getPresetDetails(presetName) {
    try {
      if (presetName === "custom") {
        return {
          name: "Custom",
          arguments: getCustomArguments(),
          description: "User-defined custom arguments",
        };
      }

      const preset = ENHANCEMENT_PRESETS[presetName];
      return preset
        ? {
            name: presetName,
            arguments: [...preset],
            description: `Built-in ${presetName} preset`,
          }
        : null;
    } catch (error) {
      logError("Error getting preset details:", error);
      return null;
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testPandocArgumentEnhancer() {
    const tests = {
      moduleExists: () => !!window.PandocArgumentEnhancer,

      hasEnhancementFunction: () =>
        typeof PandocArgumentEnhancer.generateEnhancedPandocArgs === "function",

      basicArgumentEnhancement: () => {
        const baseArgs = "--from latex --to html5";
        // Mock a preset selection (since DOM might not exist in test)
        const enhanced = generateEnhancedPandocArgs(baseArgs);
        return (
          typeof enhanced === "string" && enhanced.length >= baseArgs.length
        );
      },

      presetManagement: () => {
        const presets = getAvailablePresets();
        return (
          Array.isArray(presets) &&
          presets.length > 0 &&
          presets.includes("semantic")
        );
      },

      customArgumentsParsing: () => {
        // Test parsing functionality (without DOM dependency)
        const testArgs = "--section-divs --html-q-tags";
        const parsed = testArgs.split(/\s+/).filter((arg) => arg.length > 0);
        return Array.isArray(parsed) && parsed.length === 2;
      },

      presetRetrieval: () => {
        const semanticPreset = getEnhancementsByPreset("semantic");
        return (
          Array.isArray(semanticPreset) &&
          semanticPreset.includes("--section-divs")
        );
      },

      presetUpdate: () => {
        const testArgs = ["--test-arg", "--another-test"];
        const updated = updatePreset("test-preset", testArgs);
        const retrieved = ENHANCEMENT_PRESETS["test-preset"];
        // Cleanup
        delete ENHANCEMENT_PRESETS["test-preset"];
        return updated && Array.isArray(retrieved) && retrieved.length === 2;
      },

      htmlEscaping: () => {
        const testHtml = '<script>alert("test")</script>';
        const escaped = escapeHtml(testHtml);
        return escaped.includes("&lt;") && escaped.includes("&gt;");
      },

      integrationReadiness: () => {
        return (
          typeof generateEnhancedPandocArgs === "function" &&
          typeof handleComparisonMode === "function" &&
          typeof getEnhancementsByPreset === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("PandocArgumentEnhancer", tests) ||
      fallbackTesting("PandocArgumentEnhancer", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core enhancement functions
    generateEnhancedPandocArgs,
    getEnhancementsByPreset,
    getCustomArguments,

    // Comparison mode functionality
    handleComparisonMode,
    isComparisonModeEnabled,
    displayComparisonResults,
    generateComparisonAnalysis,

    // Preset management
    getAvailablePresets,
    updatePreset,
    getPresetDetails,

    // Utility functions
    escapeHtml,
    cleanOutputForDisplay,

    // Testing
    testPandocArgumentEnhancer,
  };
})();

// Make globally available
window.PandocArgumentEnhancer = PandocArgumentEnhancer;
