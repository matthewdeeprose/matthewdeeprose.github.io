// js/testing/individual/test-mathjax-accessibility-diagnostics.js
// Enhanced MathJax Accessibility Module Loading Diagnostic System
// Critical educational accessibility infrastructure debugging

const TestMathJaxAccessibilityDiagnostics = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
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
      console.error("[MATHJAX-DIAGNOSTICS]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MATHJAX-DIAGNOSTICS]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MATHJAX-DIAGNOSTICS]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MATHJAX-DIAGNOSTICS]", message, ...args);
  }

  // ===========================================================================================
  // COMPREHENSIVE SYSTEM ENVIRONMENT ANALYSIS
  // ===========================================================================================

  /**
   * Phase 1: System Environment Analysis
   * Identifies browser, network, and security configuration differences
   */
  function diagnosticSystemEnvironment() {
    console.log("=".repeat(80));
    console.log("🔍 MATHJAX ACCESSIBILITY MODULE LOADING DIAGNOSTIC");
    console.log("=".repeat(80));

    console.log("\n📊 PHASE 1: SYSTEM ENVIRONMENT ANALYSIS");
    console.log("-".repeat(50));

    const environmentData = {
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        vendor: navigator.vendor || "Unknown",
        appVersion: navigator.appVersion,
      },
      storage: {
        localStorage: typeof localStorage !== "undefined",
        sessionStorage: typeof sessionStorage !== "undefined",
        cookieLength: document.cookie.length,
      },
      webFeatures: {
        webGL: !!window.WebGLRenderingContext,
        webWorkers: typeof Worker !== "undefined",
        serviceWorkers: "serviceWorker" in navigator,
        indexedDB: "indexedDB" in window,
      },
      timing: {
        timestamp: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcOffset: new Date().getTimezoneOffset(),
      },
    };

    console.log("🌐 Browser Information:");
    console.log(`   User Agent: ${environmentData.browser.userAgent}`);
    console.log(`   Platform: ${environmentData.browser.platform}`);
    console.log(`   Language: ${environmentData.browser.language}`);
    console.log(`   Vendor: ${environmentData.browser.vendor}`);
    console.log(`   Online Status: ${environmentData.browser.onLine}`);
    console.log(`   Cookies Enabled: ${environmentData.browser.cookieEnabled}`);

    console.log("\n💾 Storage Capabilities:");
    console.log(`   Local Storage: ${environmentData.storage.localStorage}`);
    console.log(
      `   Session Storage: ${environmentData.storage.sessionStorage}`
    );
    console.log(
      `   Cookie Data: ${environmentData.storage.cookieLength} characters`
    );

    console.log("\n🔧 Web Features:");
    console.log(`   WebGL: ${environmentData.webFeatures.webGL}`);
    console.log(`   Web Workers: ${environmentData.webFeatures.webWorkers}`);
    console.log(
      `   Service Workers: ${environmentData.webFeatures.serviceWorkers}`
    );
    console.log(`   IndexedDB: ${environmentData.webFeatures.indexedDB}`);

    return environmentData;
  }

  /**
   * Phase 2: Network Connectivity and CDN Analysis
   * Tests network access to MathJax CDN and related resources
   */
  async function diagnosticNetworkConnectivity() {
    console.log("\n📡 PHASE 2: NETWORK CONNECTIVITY ANALYSIS");
    console.log("-".repeat(50));

    const networkTests = [
      {
        name: "MathJax CDN Core",
        url: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js",
        critical: true,
      },
      {
        name: "MathJax A11Y Semantic Enrich",
        url: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/a11y/semantic-enrich.js",
        critical: true,
      },
      {
        name: "MathJax A11Y SRE",
        url: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/a11y/sre.js",
        critical: true,
      },
      {
        name: "MathJax A11Y Explorer",
        url: "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/a11y/explorer.js",
        critical: true,
      },
      {
        name: "General CDN Test",
        url: "https://cdnjs.cloudflare.com/",
        critical: false,
      },
      {
        name: "Basic Connectivity",
        url: "https://www.google.com/favicon.ico",
        critical: false,
      },
    ];

    const networkResults = [];

    for (const test of networkTests) {
      try {
        console.log(`🔗 Testing: ${test.name}`);
        const startTime = performance.now();

        const response = await fetch(test.url, {
          method: "HEAD",
          cache: "no-cache",
          timeout: 10000,
        });

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const result = {
          name: test.name,
          url: test.url,
          success: response.ok,
          status: response.status,
          duration: duration,
          critical: test.critical,
          headers: {
            contentType: response.headers.get("content-type"),
            contentLength: response.headers.get("content-length"),
            cacheControl: response.headers.get("cache-control"),
          },
        };

        networkResults.push(result);

        const statusIcon = response.ok ? "✅" : "❌";
        console.log(
          `   ${statusIcon} Status: ${response.status} (${duration}ms)`
        );
        if (test.critical && !response.ok) {
          console.log(
            `   ⚠️  CRITICAL FAILURE: This may prevent accessibility modules from loading`
          );
        }
      } catch (error) {
        const result = {
          name: test.name,
          url: test.url,
          success: false,
          error: error.message,
          critical: test.critical,
        };

        networkResults.push(result);
        console.log(`   ❌ Error: ${error.message}`);
        if (test.critical) {
          console.log(`   🚨 CRITICAL NETWORK FAILURE: ${test.name}`);
        }
      }
    }

    const criticalFailures = networkResults.filter(
      (r) => r.critical && !r.success
    );

    console.log(`\n📊 Network Test Summary:`);
    console.log(`   Total Tests: ${networkResults.length}`);
    console.log(
      `   Successful: ${networkResults.filter((r) => r.success).length}`
    );
    console.log(
      `   Failed: ${networkResults.filter((r) => !r.success).length}`
    );
    console.log(`   Critical Failures: ${criticalFailures.length}`);

    if (criticalFailures.length > 0) {
      console.log(`\n🚨 CRITICAL NETWORK ISSUES DETECTED:`);
      criticalFailures.forEach((failure) => {
        console.log(
          `   • ${failure.name}: ${failure.error || `Status ${failure.status}`}`
        );
      });
    }

    return networkResults;
  }

  /**
   * Phase 3: MathJax Loading State Analysis
   * Deep analysis of MathJax object structure and loading state
   */
  function diagnosticMathJaxLoadingState() {
    console.log("\n🔬 PHASE 3: MATHJAX LOADING STATE ANALYSIS");
    console.log("-".repeat(50));

    const mathJaxState = {
      core: {
        mathJaxExists: !!window.MathJax,
        version: window.MathJax?.version || "Unknown",
        startupState: window.MathJax?.startup?.document?.state?.() || "Unknown",
        configured: !!window.MathJax?.config,
      },
      loader: {
        loaderExists: !!window.MathJax?.loader,
        failedLoads: window.MathJax?.loader?.failed || [],
        loadedPackages: Object.keys(
          window.MathJax?.loader?.require?.cache || {}
        ),
        loaderReady: window.MathJax?.loader?.ready || false,
      },
      accessibility: {
        a11yObject: !!window.MathJax?._?.a11y,
        availableModules: Object.keys(window.MathJax?._?.a11y || {}),
        assistiveMml: !!window.MathJax?._?.a11y?.["assistive-mml"],
        sre: !!window.MathJax?._?.a11y?.sre,
        semanticEnrich: !!window.MathJax?._?.a11y?.["semantic-enrich"],
        explorerTs: !!window.MathJax?._?.a11y?.explorer_ts,
        explorer: !!window.MathJax?._?.a11y?.explorer,
      },
      configuration: {
        enableAssistiveMml: window.MathJax?.config?.options?.enableAssistiveMml,
        menuSettings: window.MathJax?.startup?.document?.menu?.settings || {},
        a11yOptions: window.MathJax?.config?.a11y || {},
      },
    };

    console.log("🏗️ MathJax Core State:");
    console.log(
      `   MathJax Object: ${mathJaxState.core.mathJaxExists ? "✅" : "❌"}`
    );
    console.log(`   Version: ${mathJaxState.core.version}`);
    console.log(`   Startup State: ${mathJaxState.core.startupState}`);
    console.log(`   Configured: ${mathJaxState.core.configured ? "✅" : "❌"}`);

    console.log("\n📦 Loader State:");
    console.log(
      `   Loader Available: ${mathJaxState.loader.loaderExists ? "✅" : "❌"}`
    );
    console.log(`   Failed Loads: ${mathJaxState.loader.failedLoads.length}`);
    if (mathJaxState.loader.failedLoads.length > 0) {
      console.log(
        `   Failed Components: ${mathJaxState.loader.failedLoads.join(", ")}`
      );
    }
    console.log(
      `   Loaded Packages: ${mathJaxState.loader.loadedPackages.length}`
    );
    console.log(`   Loaded: ${mathJaxState.loader.loadedPackages.join(", ")}`);

    console.log("\n♿ Accessibility Module Status:");
    console.log(
      `   A11Y Object: ${mathJaxState.accessibility.a11yObject ? "✅" : "❌"}`
    );
    console.log(
      `   Available Modules: ${mathJaxState.accessibility.availableModules.length}`
    );
    console.log(
      `   Modules: ${mathJaxState.accessibility.availableModules.join(", ")}`
    );

    const targetModules = [
      "assistive-mml",
      "sre",
      "semantic-enrich",
      "explorer_ts",
      "explorer",
    ];
    const moduleStatus = targetModules.map((module) => {
      const loaded =
        mathJaxState.accessibility.availableModules.includes(module);
      return { module, loaded };
    });

    console.log(`\n📋 Target Module Loading Status:`);
    moduleStatus.forEach(({ module, loaded }) => {
      console.log(`   ${loaded ? "✅" : "❌"} ${module}`);
    });

    const loadedCount = moduleStatus.filter((m) => m.loaded).length;
    const totalCount = moduleStatus.length;

    console.log(`\n📊 Module Loading Summary:`);
    console.log(
      `   Loaded: ${loadedCount}/${totalCount} (${(
        (loadedCount / totalCount) *
        100
      ).toFixed(1)}%)`
    );

    if (loadedCount < totalCount) {
      const missing = moduleStatus
        .filter((m) => !m.loaded)
        .map((m) => m.module);
      console.log(`   Missing: ${missing.join(", ")}`);
      console.log(`   🚨 CRITICAL: Educational accessibility compromised`);
    }

    return mathJaxState;
  }

  /**
   * Phase 4: Configuration Analysis
   * Analyzes MathJax configuration for accessibility settings
   */
  function diagnosticMathJaxConfiguration() {
    console.log("\n⚙️ PHASE 4: MATHJAX CONFIGURATION ANALYSIS");
    console.log("-".repeat(50));

    if (!window.MathJax) {
      console.log("❌ MathJax not available for configuration analysis");
      return null;
    }

    const configAnalysis = {
      rawConfig: window.MathJax.config || {},
      startupSettings: window.MathJax?.startup?.document?.menu?.settings || {},
      a11yConfig: window.MathJax?.config?.a11y || {},
      loaderConfig: window.MathJax?.config?.loader || {},
      optionsConfig: window.MathJax?.config?.options || {},
    };

    console.log("🔧 Core Configuration:");
    console.log(
      `   Config Object: ${!!configAnalysis.rawConfig ? "✅" : "❌"}`
    );
    console.log(
      `   Configuration Keys: ${Object.keys(configAnalysis.rawConfig).join(
        ", "
      )}`
    );

    console.log("\n♿ Accessibility Configuration:");
    console.log(`   A11Y Config: ${!!configAnalysis.a11yConfig ? "✅" : "❌"}`);
    console.log(
      `   Enable Assistive MML: ${configAnalysis.optionsConfig.enableAssistiveMml}`
    );
    console.log(
      `   A11Y Options: ${JSON.stringify(configAnalysis.a11yConfig, null, 2)}`
    );

    console.log("\n📦 Loader Configuration:");
    console.log(
      `   Loader Config: ${!!configAnalysis.loaderConfig ? "✅" : "❌"}`
    );
    console.log(
      `   Loader Options: ${JSON.stringify(
        configAnalysis.loaderConfig,
        null,
        2
      )}`
    );

    console.log("\n🎛️ Menu Settings:");
    console.log(
      `   Settings Available: ${!!configAnalysis.startupSettings ? "✅" : "❌"}`
    );
    console.log(
      `   Settings: ${JSON.stringify(configAnalysis.startupSettings, null, 2)}`
    );

    return configAnalysis;
  }

  /**
   * Phase 5: DOM Scripts Analysis
   * Analyzes loaded script elements for MathJax sources
   */
  function diagnosticScriptLoading() {
    console.log("\n📜 PHASE 5: SCRIPT LOADING ANALYSIS");
    console.log("-".repeat(50));

    const scripts = Array.from(document.scripts);
    const mathJaxScripts = scripts.filter(
      (script) => script.src && script.src.toLowerCase().includes("mathjax")
    );

    console.log(`📊 Script Loading Summary:`);
    console.log(`   Total Scripts: ${scripts.length}`);
    console.log(`   MathJax Scripts: ${mathJaxScripts.length}`);

    if (mathJaxScripts.length > 0) {
      console.log(`\n📋 MathJax Script Sources:`);
      mathJaxScripts.forEach((script, index) => {
        console.log(`   ${index + 1}. ${script.src}`);
        console.log(`      Load State: ${script.readyState || "unknown"}`);
        console.log(`      Async: ${script.async}`);
        console.log(`      Defer: ${script.defer}`);
      });
    } else {
      console.log(`   ⚠️  No MathJax scripts detected in DOM`);
    }

    // Check for specific accessibility scripts
    const a11yScripts = mathJaxScripts.filter(
      (script) =>
        script.src.includes("a11y") ||
        script.src.includes("semantic") ||
        script.src.includes("sre")
    );

    console.log(`\n♿ Accessibility Scripts:`);
    console.log(`   A11Y Scripts Found: ${a11yScripts.length}`);

    if (a11yScripts.length > 0) {
      a11yScripts.forEach((script, index) => {
        console.log(`   ${index + 1}. ${script.src}`);
      });
    } else {
      console.log(
        `   🚨 No accessibility scripts detected - this may explain module loading failures`
      );
    }

    return {
      totalScripts: scripts.length,
      mathJaxScripts: mathJaxScripts.length,
      a11yScripts: a11yScripts.length,
      scriptSources: mathJaxScripts.map((s) => s.src),
    };
  }

  /**
   * Phase 6: Force Loading Attempt
   * Attempts to force load missing accessibility modules
   */
  async function diagnosticForceLoading() {
    console.log("\n🔄 PHASE 6: FORCE LOADING ATTEMPT");
    console.log("-".repeat(50));

    if (!window.MathJax?.loader) {
      console.log("❌ MathJax loader not available for force loading attempt");
      return null;
    }

    const targetModules = [
      "[a11y]/semantic-enrich",
      "[a11y]/sre",
      "[a11y]/explorer",
      "[a11y]/assistive-mml",
    ];

    console.log(`🔄 Attempting to force load accessibility modules...`);
    console.log(`   Target modules: ${targetModules.join(", ")}`);

    try {
      const loadPromise = window.MathJax.loader.load(targetModules);
      await loadPromise;

      console.log(`✅ Force loading completed successfully`);

      // Re-check module availability
      const newModules = Object.keys(window.MathJax._?.a11y || {});
      console.log(`   Modules now available: ${newModules.join(", ")}`);

      return {
        success: true,
        loadedModules: newModules,
        attemptedModules: targetModules,
      };
    } catch (error) {
      console.log(`❌ Force loading failed: ${error.message}`);
      console.log(`   This indicates a fundamental loading issue`);

      return {
        success: false,
        error: error.message,
        attemptedModules: targetModules,
      };
    }
  }

  /**
   * Phase 7: Comprehensive Diagnostic Report
   * Generates final diagnostic report with recommendations
   */
  function generateDiagnosticReport(
    systemEnv,
    networkResults,
    mathJaxState,
    configAnalysis,
    scriptAnalysis,
    forceLoadResult
  ) {
    console.log("\n📋 PHASE 7: COMPREHENSIVE DIAGNOSTIC REPORT");
    console.log("=".repeat(80));

    const report = {
      timestamp: new Date().toISOString(),
      systemEnvironment: systemEnv,
      networkConnectivity: networkResults,
      mathJaxState: mathJaxState,
      configuration: configAnalysis,
      scriptLoading: scriptAnalysis,
      forceLoadingAttempt: forceLoadResult,
      diagnosis: {},
      recommendations: [],
    };

    // Generate diagnosis
    const loadedModules =
      mathJaxState?.accessibility?.availableModules?.length || 0;
    const criticalNetworkFailures =
      networkResults?.filter((r) => r.critical && !r.success)?.length || 0;
    const a11yScriptsFound = scriptAnalysis?.a11yScripts || 0;

    console.log(`🔍 DIAGNOSTIC ANALYSIS:`);
    console.log(`   Loaded A11Y Modules: ${loadedModules}/5`);
    console.log(`   Critical Network Failures: ${criticalNetworkFailures}`);
    console.log(`   A11Y Scripts Found: ${a11yScriptsFound}`);
    console.log(
      `   Force Loading Success: ${forceLoadResult?.success || false}`
    );

    // Determine primary issue
    if (criticalNetworkFailures > 0) {
      report.diagnosis.primaryIssue = "NETWORK_CONNECTIVITY";
      report.diagnosis.severity = "CRITICAL";
      report.diagnosis.description =
        "Critical network connectivity issues prevent accessibility module loading";

      report.recommendations.push(
        "Check corporate firewall settings for CDN access"
      );
      report.recommendations.push(
        "Test from different network (mobile hotspot)"
      );
      report.recommendations.push(
        "Verify DNS resolution for cdnjs.cloudflare.com"
      );
    } else if (a11yScriptsFound === 0) {
      report.diagnosis.primaryIssue = "MISSING_A11Y_SCRIPTS";
      report.diagnosis.severity = "CRITICAL";
      report.diagnosis.description = "No accessibility scripts loaded in DOM";

      report.recommendations.push(
        "Check MathJax configuration for accessibility module inclusion"
      );
      report.recommendations.push(
        "Verify script loading order and dependencies"
      );
      report.recommendations.push(
        "Test with explicit accessibility module loading"
      );
    } else if (loadedModules < 5 && !forceLoadResult?.success) {
      report.diagnosis.primaryIssue = "MODULE_LOADING_FAILURE";
      report.diagnosis.severity = "HIGH";
      report.diagnosis.description =
        "Accessibility modules fail to load despite network access";

      report.recommendations.push(
        "Check browser extension interference (test in incognito mode)"
      );
      report.recommendations.push("Clear browser cache and cookies");
      report.recommendations.push("Update browser to latest version");
    } else if (loadedModules === 5) {
      report.diagnosis.primaryIssue = "SYSTEM_WORKING";
      report.diagnosis.severity = "INFO";
      report.diagnosis.description =
        "All accessibility modules loaded successfully";

      report.recommendations.push("System is functioning correctly");
      report.recommendations.push(
        "Use this environment as reference for debugging other systems"
      );
    }

    console.log(`\n🎯 PRIMARY DIAGNOSIS: ${report.diagnosis.primaryIssue}`);
    console.log(`   Severity: ${report.diagnosis.severity}`);
    console.log(`   Description: ${report.diagnosis.description}`);

    console.log(`\n💡 RECOMMENDATIONS:`);
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log(`\n🔗 NEXT STEPS:`);
    if (report.diagnosis.primaryIssue === "NETWORK_CONNECTIVITY") {
      console.log(`   1. Run diagnostic from different network environment`);
      console.log(`   2. Contact IT department about CDN access restrictions`);
      console.log(`   3. Consider local MathJax hosting as fallback`);
    } else if (report.diagnosis.primaryIssue === "MISSING_A11Y_SCRIPTS") {
      console.log(`   1. Review MathJax configuration in latex-processor.js`);
      console.log(
        `   2. Verify accessibility module inclusion in configuration`
      );
      console.log(`   3. Test with minimal MathJax configuration`);
    } else {
      console.log(`   1. Test in incognito/private browsing mode`);
      console.log(`   2. Systematically disable browser extensions`);
      console.log(`   3. Clear all browser data and retry`);
    }

    return report;
  }

  /**
   * Master diagnostic function - runs complete analysis
   */
  async function runCompleteDiagnostic() {
    console.log(
      "🚀 Starting comprehensive MathJax accessibility diagnostic..."
    );

    try {
      // Phase 1: System Environment
      const systemEnv = diagnosticSystemEnvironment();

      // Phase 2: Network Connectivity
      const networkResults = await diagnosticNetworkConnectivity();

      // Phase 3: MathJax State
      const mathJaxState = diagnosticMathJaxLoadingState();

      // Phase 4: Configuration
      const configAnalysis = diagnosticMathJaxConfiguration();

      // Phase 5: Script Loading
      const scriptAnalysis = diagnosticScriptLoading();

      // Phase 6: Force Loading
      const forceLoadResult = await diagnosticForceLoading();

      // Phase 7: Generate Report
      const report = generateDiagnosticReport(
        systemEnv,
        networkResults,
        mathJaxState,
        configAnalysis,
        scriptAnalysis,
        forceLoadResult
      );

      console.log("\n✅ DIAGNOSTIC COMPLETE");
      console.log("=".repeat(80));

      return report;
    } catch (error) {
      console.error("❌ Diagnostic failed:", error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ===========================================================================================
  // TESTING FRAMEWORK INTEGRATION
  // ===========================================================================================

  function testMathJaxAccessibilityDiagnostics() {
    const tests = {
      systemEnvironmentExtraction: () => {
        const env = diagnosticSystemEnvironment();
        return !!env.browser && !!env.storage && !!env.webFeatures;
      },

      mathJaxStateAnalysis: () => {
        const state = diagnosticMathJaxLoadingState();
        return !!state.core && !!state.accessibility;
      },

      scriptAnalysisFunction: () => {
        const scripts = diagnosticScriptLoading();
        return typeof scripts.totalScripts === "number";
      },

      diagnosticReportGeneration: () => {
        // Test with mock data
        const mockReport = generateDiagnosticReport({}, [], {}, {}, {}, {});
        return !!mockReport.timestamp && !!mockReport.diagnosis;
      },

      completeDiagnosticAvailable: () => {
        return typeof runCompleteDiagnostic === "function";
      },
    };

    return TestUtilities.runTestSuite(
      "MathJax Accessibility Diagnostics",
      tests
    );
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testMathJaxAccessibilityDiagnostics,
    runCompleteDiagnostic,
    diagnosticSystemEnvironment,
    diagnosticNetworkConnectivity,
    diagnosticMathJaxLoadingState,
    diagnosticMathJaxConfiguration,
    diagnosticScriptLoading,
    diagnosticForceLoading,
  };
})();

// Global diagnostic function for easy access
window.runMathJaxDiagnostic =
  TestMathJaxAccessibilityDiagnostics.runCompleteDiagnostic;
