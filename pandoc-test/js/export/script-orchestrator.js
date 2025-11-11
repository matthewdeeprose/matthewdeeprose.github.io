// script-orchestrator.js
// Script Coordination and Orchestration Module
// Coordinates JavaScript template loading and generation for exported documents
// Extracted from export-manager.js during Phase 3 refactoring

const ScriptOrchestrator = (function () {
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
      console.error("[SCRIPT-ORCH]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[SCRIPT-ORCH]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[SCRIPT-ORCH]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[SCRIPT-ORCH]", message, ...args);
  }

  // ===========================================================================================
  // TEMPLATE LOADER HELPER FUNCTIONS
  // ===========================================================================================

  /**
   * Generate MathJax controls JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateMathJaxControlsJS(accessibilityLevel = 1) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateMathJaxControlsJS(accessibilityLevel);
    }
    throw new Error("Template system required for MathJax controls generation");
  }

  /**
   * Generate Reading Tools Setup JavaScript for exported documents
   * ✅ PHASE 2A STEP 2: Now uses external JavaScript template
   */
  async function generateReadingToolsSetupJS(accessibilityLevel = 1) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateReadingToolsSetupJS(accessibilityLevel);
    }
    throw new Error(
      "Template system required for reading tools setup generation"
    );
  }

  /**
   * Generate focus tracking utility for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateFocusTrackingJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateFocusTrackingJS(options);
    }
    throw new Error("Template system required for focus tracking generation");
  }

  /**
   * Generate Theme Management JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateThemeManagementJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateThemeManagementJS(options);
    }
    throw new Error("Template system required for theme management generation");
  }

  /**
   * Generate form initialization JavaScript for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateFormInitializationJS(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateFormInitializationJS(options);
    }
    throw new Error(
      "Template system required for form initialization generation"
    );
  }

  /**
   * Generate ReadingAccessibilityManager class for exported documents
   * ✅ MIGRATED: Now uses external JavaScript template
   */
  async function generateReadingAccessibilityManagerClass(options = {}) {
    if (window.TemplateSystem) {
      const generator = window.TemplateSystem.createGenerator();
      return await generator.generateReadingAccessibilityManagerClassJS(
        options
      );
    }
    throw new Error(
      "Template system required for reading accessibility manager class generation"
    );
  }

  /**
   * Load document save functionality template
   */
  async function generateDocumentSaveFunctionalityJS() {
    logDebug("Loading document save functionality template...");
    try {
      const generator = window.TemplateSystem.createGenerator();
      const template = await generator.loadJavaScriptTemplate(
        "document-save-functionality.js"
      );
      logInfo("✅ Document save functionality template loaded");
      return template;
    } catch (error) {
      logError("Failed to load document save functionality template:", error);
      return "// Document save functionality template failed to load\n";
    }
  }

  /**
   * Load save verification template
   */
  async function generateSaveVerificationJS() {
    logDebug("Loading save verification template...");
    try {
      const generator = window.TemplateSystem.createGenerator();
      const template = await generator.loadJavaScriptTemplate(
        "save-verification.js"
      );
      logInfo("✅ Save verification template loaded");
      return template;
    } catch (error) {
      logError("Failed to load save verification template:", error);
      return "// Save verification template failed to load\n";
    }
  }

  /**
   * Load content storage handler template
   */
  async function generateContentStorageHandlerJS() {
    logDebug("Loading content storage handler template...");
    try {
      const generator = window.TemplateSystem.createGenerator();
      const template = await generator.loadJavaScriptTemplate(
        "content-storage-handler.js"
      );
      logInfo("✅ Content storage handler template loaded");
      return template;
    } catch (error) {
      logError("Failed to load content storage handler template:", error);
      return "// Content storage handler template failed to load\n";
    }
  }

  // ===========================================================================================
  // MAIN SCRIPT ORCHESTRATION FUNCTIONS
  // ===========================================================================================

  /**
   * Generate enhanced JavaScript with reading accessibility features and MathJax controls
   * Now uses template system for initialization JavaScript
   * ENHANCED: Embeds clean HTML for reliable save functionality
   */
  async function generateEnhancedJavaScript(
    accessibilityLevel,
    cleanHTMLContent = null
  ) {
    logInfo(
      "Generating enhanced JavaScript with complete accessibility functionality"
    );

    let html = "";
    html +=
      "    <!-- Enhanced Script with Reading Controls, Theme Toggle, Focus Tracking, and MathJax Controls -->\n";

    // ✅ NEW: Embed clean HTML content as Base64 for save functionality
    if (cleanHTMLContent) {
      html += `    <script id="original-content-data" type="application/x-original-html-base64">\n`;
      // Convert to Base64 (handling Unicode properly)
      const base64Content = btoa(
        unescape(encodeURIComponent(cleanHTMLContent))
      );
      html += base64Content;
      html += `\n    </script>\n`;
      logInfo(
        `✅ Embedded clean HTML content (${base64Content.length} Base64 characters)`
      );
    }

    html += "    <script>\n";

    // ✅ FIXED: Generate ReadingAccessibilityManager class separately with proper template processing
    const accessibilityDefaults =
      window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
    html += await generateReadingAccessibilityManagerClass({
      defaultFontSize: accessibilityDefaults.defaultFontSize || 1.0, // ✅ Number
      defaultFontFamily:
        accessibilityDefaults.defaultFontFamily || "Verdana, sans-serif",
      defaultReadingWidth:
        accessibilityDefaults.defaultReadingWidth || "narrow",
      defaultLineHeight: accessibilityDefaults.defaultLineHeight || 1.6, // ✅ Number
      defaultParagraphSpacing:
        accessibilityDefaults.defaultParagraphSpacing || 1.0, // ✅ Number
      enableAdvancedControls: accessibilityLevel >= 2,
    });

    // Generate theme management functionality
    html += await generateThemeManagementJS();

    // Generate document save functionality (from external template)
    html += await generateDocumentSaveFunctionalityJS();

    // Generate save verification (from external template)
    html += await generateSaveVerificationJS();

    // Generate content storage handler (from external template)
    html += await generateContentStorageHandlerJS();

    // Generate form initialization (from external template) - Using centralised defaults
    html += await generateFormInitializationJS({
      defaultFontSize: accessibilityDefaults.defaultFontSize || "1.0",
      defaultFontSizePercent:
        accessibilityDefaults.defaultFontSizePercent || "100%",
      defaultLineHeight: accessibilityDefaults.defaultLineHeight || "1.6",
      defaultWordSpacing: accessibilityDefaults.defaultWordSpacing || "0",
      defaultReadingWidth:
        accessibilityDefaults.defaultReadingWidth || "narrow", // ✅ FIXED
      defaultZoomLevel: accessibilityDefaults.defaultZoomLevel || "1.0",
      enableValidation: accessibilityDefaults.enableValidation !== false,
      enableAccessibility: accessibilityDefaults.enableAccessibility !== false,
      enablePreferences: accessibilityDefaults.enablePreferences !== false,
    });

    // Include focus tracking with console commands
    html += await generateFocusTrackingJS({
      enableConsoleCommands: true,
      commandsDelayMs: 100,
    });

    // Include MathJax controls
    html += await generateMathJaxControlsJS(accessibilityLevel);

    // ✅ CRITICAL FIX: Include MathJax Manager for sophisticated refresh dialog logic
    html += await generateMathJaxManagerJS();

    // Add source viewer JavaScript for syntax highlighting
    if (window.SourceViewer) {
      html += "\n        // Source Viewer - Prism.js Syntax Highlighting\n";
      const prismJS = await window.SourceViewer.getPrismJS();
      html += "        " + prismJS.split("\n").join("\n        ") + "\n";

      // Add accessibility enhancements
      html += `
        
        // Source Viewer - Accessibility Enhancements
        document.addEventListener('DOMContentLoaded', function() {
          if (window.SourceViewer && window.SourceViewer.enhanceAccessibility) {
            window.SourceViewer.enhanceAccessibility();
          }
        });
`;
    }

    // ✅ PHASE 1 MIGRATION: Use template system for initialization
    try {
      if (window.TemplateSystem) {
        const generator = window.TemplateSystem.createGenerator();
        const initializationJS = await generator.generateInitializationJS();
        html += "\n        // Initialization (from external template)\n";
        html += initializationJS;
        logDebug("✅ Using external template for initialization JavaScript");
      } else {
        throw new Error("TemplateSystem not available");
      }
    } catch (error) {
      logWarn(
        "Template system not available, using fallback initialization:",
        error.message
      );

      // Fallback initialization (original hardcoded version)
      html += "\n        // Fallback removed\n";
    }

    // ✅ CRITICAL FIX: Create Dynamic MathJax Manager instance for sophisticated controls
    html += `
        // Create Dynamic MathJax Manager instance for sophisticated controls
        setTimeout(() => {
            if (!window.dynamicMathJaxManager && window.MathJaxManager) {
                try {
                    window.dynamicMathJaxManager = window.MathJaxManager.createManager();
                    window.dynamicMathJaxManager.initialise();
                    console.log('✅ Dynamic MathJax Manager instance created and initialised in exported document');
                } catch (error) {
                    console.error('❌ Failed to create Dynamic MathJax Manager in exported document:', error);
                }
            } else if (!window.MathJaxManager) {
                console.warn('⚠️ MathJaxManager module not available in exported document');
            } else if (window.dynamicMathJaxManager) {
                console.log('ℹ️ Dynamic MathJax Manager already exists in exported document');
            }
        }, 500);
`;

    html += "    </script>\n";

    return html;
  }

  /**
   * Generate MathJax Manager JavaScript for exported documents
   * ✅ CRITICAL FIX: Include sophisticated refresh dialog logic
   */
  async function generateMathJaxManagerJS() {
    logInfo(
      "Including MathJax Manager for sophisticated accessibility controls"
    );

    try {
      // Read the mathjax-manager.js file content
      const response = await fetch("./js/export/mathjax-manager.js");

      if (!response.ok) {
        throw new Error(
          `Failed to load mathjax-manager.js: ${response.status}`
        );
      }

      const mathJaxManagerContent = await response.text();

      logDebug("✅ MathJax Manager content loaded successfully");

      // Return with proper formatting and comments
      return (
        "\n        // MathJax Manager (sophisticated refresh dialog logic)\n" +
        "        " +
        mathJaxManagerContent.split("\n").join("\n        ") +
        "\n"
      );
    } catch (error) {
      logError("Failed to load MathJax Manager:", error);

      // Return minimal fallback that at least provides the module structure
      return `
        // MathJax Manager (fallback - sophisticated features unavailable)
        window.MathJaxManager = {
          createManager: function() {
            console.warn('⚠️ MathJax Manager fallback - sophisticated features unavailable');
            return {
              getCurrentSettings: () => ({}),
              initialise: () => console.log('MathJax Manager fallback initialized')
            };
          }
        };
`;
    }
  }

  // ===========================================================================================
  // VALIDATION AND TESTING
  // ===========================================================================================

  /**
   * Validate script orchestrator dependencies
   */
  function validateDependencies() {
    logInfo("🧪 Validating script orchestrator dependencies...");

    const requiredModules = ["TemplateSystem", "AppConfig"];

    const checks = {};
    requiredModules.forEach((moduleName) => {
      checks[moduleName] = !!window[moduleName];
    });

    const passed = Object.values(checks).filter(Boolean).length;
    const total = requiredModules.length;

    logInfo(`📊 Dependency validation: ${passed}/${total} modules available`);

    if (passed === total) {
      logInfo("✅ All dependencies satisfied");
    } else {
      logError(
        "❌ Missing dependencies:",
        Object.entries(checks)
          .filter(([key, value]) => !value)
          .map(([key]) => key)
      );
    }

    return {
      passed: passed,
      total: total,
      success: passed === total,
      missing: Object.entries(checks)
        .filter(([key, value]) => !value)
        .map(([key]) => key),
    };
  }

  /**
   * Test script generation without full export
   */
  async function testScriptGeneration() {
    logInfo("🧪 Testing script generation...");

    try {
      const testScript = await generateEnhancedJavaScript(2, null);

      const success =
        testScript.length > 1000 &&
        testScript.includes("<script>") &&
        testScript.includes("ReadingAccessibilityManager");

      if (success) {
        logInfo(
          `✅ Script generation test passed (${testScript.length} characters)`
        );
      } else {
        logError("❌ Script generation test failed");
        logDebug("Script preview:", testScript.substring(0, 200) + "...");
      }

      return {
        success: success,
        size: testScript.length,
        hasScriptTag: testScript.includes("<script>"),
        hasAccessibilityManager: testScript.includes(
          "ReadingAccessibilityManager"
        ),
        hasMathJaxManager: testScript.includes("MathJaxManager"),
      };
    } catch (error) {
      logError("Script generation test failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main orchestration functions
    generateEnhancedJavaScript,
    generateMathJaxManagerJS,

    // Template loader functions
    generateMathJaxControlsJS,
    generateReadingToolsSetupJS,
    generateFocusTrackingJS,
    generateThemeManagementJS,
    generateFormInitializationJS,
    generateReadingAccessibilityManagerClass,
    generateDocumentSaveFunctionalityJS,
    generateSaveVerificationJS,
    generateContentStorageHandlerJS,

    // Testing and validation
    validateDependencies,
    testScriptGeneration,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.ScriptOrchestrator = ScriptOrchestrator;

// Log module registration
if (window.ScriptOrchestrator) {
  console.log("✅ ScriptOrchestrator module registered successfully");
} else {
  console.error("❌ Failed to register ScriptOrchestrator module");
}
