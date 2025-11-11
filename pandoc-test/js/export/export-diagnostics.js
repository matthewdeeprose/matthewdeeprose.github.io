// export-diagnostics.js
// Comprehensive Export Diagnostic Tool
// Analyzes exported HTML for mathematical content, custom macros, and accessibility

const ExportDiagnostics = (function () {
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
      console.error("[EXPORT-DIAG]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[EXPORT-DIAG]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[EXPORT-DIAG]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[EXPORT-DIAG]", message, ...args);
  }

  // ===========================================================================================
  // DIAGNOSTIC UTILITIES
  // ===========================================================================================

  /**
   * Extract MathJax configuration from HTML string
   * @param {string} html - HTML content to analyze
   * @returns {Object} Parsed MathJax configuration
   */
  function extractMathJaxConfig(html) {
    const configMatch = html.match(/window\.MathJax\s*=\s*\{[\s\S]*?\};/);
    if (!configMatch) {
      return { found: false, error: "No MathJax configuration found" };
    }

    try {
      // Extract just the config object
      const configStr = configMatch[0].replace(/window\.MathJax\s*=\s*/, "");
      // Use Function constructor to safely evaluate (better than eval)
      const config = new Function("return " + configStr)();

      return {
        found: true,
        config: config,
        macros: config.tex?.macros || {},
        packages: config.tex?.packages || {},
        extensions: config.loader?.load || [],
      };
    } catch (error) {
      return {
        found: true,
        error: `Failed to parse config: ${error.message}`,
      };
    }
  }

  /**
   * Check for custom macro definitions in MathJax config
   * @param {Object} config - Extracted MathJax configuration
   * @param {Array<string>} expectedMacros - List of macro names to check for
   * @returns {Object} Macro analysis results
   */
  function analyzeMacros(config, expectedMacros = []) {
    if (!config.found || config.error) {
      return {
        success: false,
        error: config.error || "Config not found",
        found: [],
        missing: expectedMacros,
      };
    }

    const macros = config.macros || {};
    const found = [];
    const missing = [];

    for (const macroName of expectedMacros) {
      if (macros[macroName]) {
        found.push({
          name: macroName,
          definition: macros[macroName],
        });
      } else {
        missing.push(macroName);
      }
    }

    return {
      success: true,
      totalMacros: Object.keys(macros).length,
      expectedCount: expectedMacros.length,
      foundCount: found.length,
      missingCount: missing.length,
      found: found,
      missing: missing,
      allMacros: macros,
    };
  }

  /**
   * Check for LaTeX package features in HTML
   * @param {string} html - HTML content to analyze
   * @returns {Object} Package feature analysis
   */
  function analyzePackageFeatures(html) {
    const features = {
      cancel: {
        enabled: false,
        patterns: ["\\cancel{", "\\bcancel{", "\\xcancel{", "\\cancelto{"],
        found: [],
      },
      color: {
        enabled: false,
        patterns: ["\\color{", "\\textcolor{"],
        found: [],
      },
      mathtools: {
        enabled: false,
        patterns: ["\\coloneqq", "\\eqqcolon"],
        found: [],
      },
      ams: {
        enabled: false,
        patterns: ["\\mathbb{", "\\DeclareMathOperator"],
        found: [],
      },
    };

    // Check for package loading in config
    const configMatch = html.match(/packages:\s*\{[^}]+\}/);
    if (configMatch) {
      const packagesStr = configMatch[0];
      if (packagesStr.includes("cancel")) features.cancel.enabled = true;
      if (packagesStr.includes("color")) features.color.enabled = true;
      if (packagesStr.includes("mathtools")) features.mathtools.enabled = true;
      if (packagesStr.includes("ams")) features.ams.enabled = true;
    }

    // Check for actual usage in content
    for (const [packageName, packageInfo] of Object.entries(features)) {
      for (const pattern of packageInfo.patterns) {
        if (html.includes(pattern)) {
          packageInfo.found.push(pattern);
        }
      }
    }

    return features;
  }

  /**
   * Analyze multi-line equation environments
   * @param {string} html - HTML content to analyze
   * @returns {Object} Environment analysis
   */
  function analyzeEnvironments(html) {
    const environments = {
      align: {
        count: (html.match(/\\begin\{align\}/g) || []).length,
        warnings: (html.match(/Misplaced.*align/gi) || []).length,
      },
      gather: {
        count: (html.match(/\\begin\{gather\}/g) || []).length,
        warnings: (html.match(/Misplaced.*gather/gi) || []).length,
      },
      equation: {
        count: (html.match(/\\begin\{equation\}/g) || []).length,
        warnings: 0,
      },
      displayMath: {
        count: (html.match(/\\\[[\s\S]*?\\\]/g) || []).length,
        warnings: 0,
      },
    };

    // Check for yellow warning boxes
    const warningBoxes = (
      html.match(
        /<div[^>]*background[^>]*yellow[^>]*>|<span[^>]*color[^>]*yellow[^>]*>/gi
      ) || []
    ).length;

    return {
      environments: environments,
      totalWarnings: warningBoxes,
      hasEnvironmentIssues:
        environments.align.warnings > 0 || environments.gather.warnings > 0,
    };
  }

  /**
   * Analyze mathematical expressions in rendered output
   * @param {string} html - HTML content to analyze
   * @returns {Object} Expression analysis
   */
  function analyzeExpressions(html) {
    return {
      inlineMath: (html.match(/\$[^$]+\$/g) || []).length,
      displayMath: (html.match(/\$\$[\s\S]+?\$\$/g) || []).length,
      mjxContainers: (html.match(/<mjx-container/g) || []).length,
      mathElements: (html.match(/<math/g) || []).length,
    };
  }

  // ===========================================================================================
  // MAIN DIAGNOSTIC FUNCTIONS
  // ===========================================================================================

  /**
   * Comprehensive diagnostic report for exported HTML
   * @param {string} html - HTML content to analyze
   * @param {Object} options - Diagnostic options
   * @param {Array<string>} options.expectedMacros - List of expected custom macros
   * @param {boolean} options.verbose - Include detailed output
   * @returns {Object} Comprehensive diagnostic report
   */
  function diagnoseExport(html, options = {}) {
    const {
      expectedMacros = ["R", "Q", "C", "N", "Z", "abs", "ds", "supp"],
      verbose = true,
    } = options;

    logInfo("=== EXPORT DIAGNOSTIC ANALYSIS START ===");
    logInfo(`Analyzing ${html.length} characters of HTML content`);

    // Extract MathJax configuration
    const config = extractMathJaxConfig(html);

    // Analyze custom macros
    const macros = analyzeMacros(config, expectedMacros);

    // Analyze package features
    const packages = analyzePackageFeatures(html);

    // Analyze environments
    const environments = analyzeEnvironments(html);

    // Analyze expressions
    const expressions = analyzeExpressions(html);

    // Compile report
    const report = {
      timestamp: new Date().toISOString(),
      htmlSize: html.length,
      mathJaxConfig: {
        found: config.found,
        error: config.error,
        extensionCount: config.extensions?.length || 0,
        extensions: config.extensions || [],
      },
      customMacros: {
        success: macros.success,
        total: macros.totalMacros,
        expected: macros.expectedCount,
        found: macros.foundCount,
        missing: macros.missingCount,
        macroList: macros.found,
        missingList: macros.missing,
      },
      packages: packages,
      environments: environments,
      expressions: expressions,
      overallStatus: {
        mathJaxLoaded: config.found,
        macrosWorking: macros.success && macros.missingCount === 0,
        packagesLoaded:
          packages.cancel.enabled &&
          packages.color.enabled &&
          packages.mathtools.enabled,
        environmentsWorking: !environments.hasEnvironmentIssues,
      },
    };

    // Generate human-readable summary
    if (verbose) {
      printDiagnosticReport(report);
    }

    return report;
  }

  /**
   * Print formatted diagnostic report to console
   * @param {Object} report - Diagnostic report object
   */
  function printDiagnosticReport(report) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 EXPORT DIAGNOSTIC REPORT");
    console.log("=".repeat(80));

    // Overall Status
    console.log("\n🎯 OVERALL STATUS:");
    const status = report.overallStatus;
    console.log(
      `   ${status.mathJaxLoaded ? "✅" : "❌"} MathJax Configuration: ${
        status.mathJaxLoaded ? "FOUND" : "NOT FOUND"
      }`
    );
    console.log(
      `   ${status.macrosWorking ? "✅" : "❌"} Custom Macros: ${
        status.macrosWorking ? "ALL WORKING" : "ISSUES DETECTED"
      }`
    );
    console.log(
      `   ${status.packagesLoaded ? "✅" : "⚠️"} Packages: ${
        status.packagesLoaded ? "ALL LOADED" : "SOME MISSING"
      }`
    );
    console.log(
      `   ${status.environmentsWorking ? "✅" : "⚠️"} Environments: ${
        status.environmentsWorking ? "NO WARNINGS" : "WARNINGS DETECTED"
      }`
    );

    // Custom Macros Detail
    console.log("\n📐 CUSTOM MACROS:");
    console.log(`   Total in config: ${report.customMacros.total}`);
    console.log(`   Expected: ${report.customMacros.expected}`);
    console.log(
      `   ${report.customMacros.found > 0 ? "✅" : "❌"} Found: ${
        report.customMacros.found
      }`
    );

    if (report.customMacros.macroList.length > 0) {
      console.log("   Injected macros:");
      for (const macro of report.customMacros.macroList) {
        console.log(
          `      ✅ ${macro.name}: ${JSON.stringify(macro.definition)}`
        );
      }
    }

    if (report.customMacros.missingList.length > 0) {
      console.log(
        `   ${report.customMacros.missing > 0 ? "❌" : ""} Missing: ${
          report.customMacros.missing
        }`
      );
      for (const macroName of report.customMacros.missingList) {
        console.log(`      ❌ ${macroName}`);
      }
    }

    // Package Features
    console.log("\n📦 PACKAGE FEATURES:");
    for (const [packageName, packageInfo] of Object.entries(report.packages)) {
      const icon = packageInfo.enabled ? "✅" : "❌";
      const usage =
        packageInfo.found.length > 0
          ? `(${packageInfo.found.length} uses found)`
          : "(not used)";
      console.log(`   ${icon} ${packageName}: ${usage}`);
    }

    // Extensions
    console.log("\n🔌 MATHJAX EXTENSIONS:");
    console.log(`   Loaded: ${report.mathJaxConfig.extensionCount} extensions`);
    if (report.mathJaxConfig.extensions.length > 0) {
      for (const ext of report.mathJaxConfig.extensions) {
        console.log(`      ✅ ${ext}`);
      }
    }

    // Environments
    console.log("\n📊 EQUATION ENVIRONMENTS:");
    const envs = report.environments.environments;
    console.log(
      `   ${envs.align.warnings === 0 ? "✅" : "⚠️"} align: ${
        envs.align.count
      } found, ${envs.align.warnings} warnings`
    );
    console.log(
      `   ${envs.gather.warnings === 0 ? "✅" : "⚠️"} gather: ${
        envs.gather.count
      } found, ${envs.gather.warnings} warnings`
    );
    console.log(
      `   ✅ equation: ${envs.equation.count} found, ${envs.equation.warnings} warnings`
    );
    console.log(`   ✅ display math: ${envs.displayMath.count} found`);

    if (report.environments.totalWarnings > 0) {
      console.log(
        `   ⚠️ Total warning boxes detected: ${report.environments.totalWarnings}`
      );
    }

    // Mathematical Expressions
    console.log("\n🔢 MATHEMATICAL EXPRESSIONS:");
    console.log(`   Inline math: ${report.expressions.inlineMath}`);
    console.log(`   Display math: ${report.expressions.displayMath}`);
    console.log(`   MathJax containers: ${report.expressions.mjxContainers}`);
    console.log(`   Math elements: ${report.expressions.mathElements}`);

    // File Info
    console.log("\n📄 FILE INFORMATION:");
    console.log(`   HTML size: ${report.htmlSize.toLocaleString()} characters`);
    console.log(`   Timestamp: ${report.timestamp}`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ DIAGNOSTIC ANALYSIS COMPLETE");
    console.log("=".repeat(80) + "\n");
  }

  /**
   * Quick diagnostic check for current playground state
   * @returns {Object} Quick diagnostic results
   */
  function quickCheck() {
    logInfo("Running quick diagnostic check...");

    // Check if we have a last export
    const lastExport = window.lastGeneratedHTML || window.__lastExportHTML;

    if (!lastExport) {
      console.warn("⚠️ No exported HTML found in memory");
      console.log(
        "💡 Tip: Export a document first, then run quickCheck() again"
      );
      return {
        success: false,
        error: "No export data available",
      };
    }

    return diagnoseExport(lastExport);
  }

  /**
   * Diagnostic check from HTML file or string
   * @param {string} htmlSource - HTML string or file content
   * @returns {Object} Diagnostic results
   */
  function checkHTML(htmlSource) {
    if (!htmlSource || typeof htmlSource !== "string") {
      console.error("❌ Invalid HTML source provided");
      return {
        success: false,
        error: "Invalid HTML source",
      };
    }

    return diagnoseExport(htmlSource);
  }

  /**
   * Compare two exports (before/after analysis)
   * @param {string} beforeHTML - HTML before changes
   * @param {string} afterHTML - HTML after changes
   * @returns {Object} Comparison results
   */
  function compareExports(beforeHTML, afterHTML) {
    logInfo("Comparing two exports...");

    const before = diagnoseExport(beforeHTML, { verbose: false });
    const after = diagnoseExport(afterHTML, { verbose: false });

    const comparison = {
      macros: {
        before: before.customMacros.found,
        after: after.customMacros.found,
        improved: after.customMacros.found > before.customMacros.found,
        change: after.customMacros.found - before.customMacros.found,
      },
      packages: {
        before: Object.values(before.packages).filter((p) => p.enabled).length,
        after: Object.values(after.packages).filter((p) => p.enabled).length,
        improved:
          Object.values(after.packages).filter((p) => p.enabled).length >
          Object.values(before.packages).filter((p) => p.enabled).length,
      },
      warnings: {
        before: before.environments.totalWarnings,
        after: after.environments.totalWarnings,
        improved:
          after.environments.totalWarnings < before.environments.totalWarnings,
        change:
          after.environments.totalWarnings - before.environments.totalWarnings,
      },
      overallImprovement:
        after.customMacros.found > before.customMacros.found ||
        after.environments.totalWarnings < before.environments.totalWarnings,
    };

    // Print comparison
    console.log("\n" + "=".repeat(80));
    console.log("📊 EXPORT COMPARISON REPORT");
    console.log("=".repeat(80));

    console.log("\n📐 CUSTOM MACROS:");
    console.log(
      `   Before: ${comparison.macros.before} | After: ${comparison.macros.after}`
    );
    console.log(
      `   ${comparison.macros.improved ? "✅ IMPROVED" : "⚠️ NO CHANGE"} (${
        comparison.macros.change > 0 ? "+" : ""
      }${comparison.macros.change})`
    );

    console.log("\n⚠️ WARNINGS:");
    console.log(
      `   Before: ${comparison.warnings.before} | After: ${comparison.warnings.after}`
    );
    console.log(
      `   ${comparison.warnings.improved ? "✅ IMPROVED" : "⚠️ NO CHANGE"} (${
        comparison.warnings.change > 0 ? "+" : ""
      }${comparison.warnings.change})`
    );

    console.log("\n🎯 OVERALL:");
    console.log(
      `   ${
        comparison.overallImprovement ? "✅ IMPROVED" : "⚠️ NO IMPROVEMENT"
      }`
    );

    console.log("=".repeat(80) + "\n");

    return comparison;
  }

  // ===========================================================================================
  // CONVENIENCE FUNCTIONS
  // ===========================================================================================

  /**
   * Store current export for later analysis
   * @param {string} html - HTML content to store
   */
  function storeExport(html) {
    window.__lastExportHTML = html;
    window.__lastExportTimestamp = Date.now();
    logInfo("Export stored for diagnostic analysis");
  }

  /**
   * Get stored export
   * @returns {string|null} Stored HTML or null
   */
  function getStoredExport() {
    return window.__lastExportHTML || null;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main diagnostic functions
    diagnoseExport,
    quickCheck,
    checkHTML,
    compareExports,

    // Storage utilities
    storeExport,
    getStoredExport,

    // Low-level utilities (for advanced users)
    extractMathJaxConfig,
    analyzeMacros,
    analyzePackageFeatures,
    analyzeEnvironments,
    analyzeExpressions,
    printDiagnosticReport,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.ExportDiagnostics = ExportDiagnostics;

// Convenience shortcuts with unique names
window.exportCheck = ExportDiagnostics.quickCheck;
window.diagnoseLastExport = ExportDiagnostics.quickCheck; // Alias
window.analyzeExport = ExportDiagnostics.diagnoseExport;
window.validateExportHTML = ExportDiagnostics.checkHTML;
window.compareExportVersions = ExportDiagnostics.compareExports;

console.log(
  "✅ Export Diagnostics module loaded - Use exportCheck() or diagnoseLastExport() to analyze exports"
);
