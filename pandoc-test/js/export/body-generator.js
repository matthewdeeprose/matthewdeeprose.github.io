// body-generator.js
// HTML Body Generation Module
// Generates complete HTML <body> sections with integrated sidebar and footer

const BodyGenerator = (function () {
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
      console.error("[BODY-GEN]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[BODY-GEN]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[BODY-GEN]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[BODY-GEN]", message, ...args);
  }

  // ===========================================================================================
  // SIDEBAR GENERATION FUNCTIONS
  // ===========================================================================================

  /**
   * Generate fallback sidebar HTML when templates fail to load
   */
  function generateFallbackSidebar() {
    return `
        <aside id="document-sidebar" class="document-sidebar" aria-label="Document Tools">
          <div class="sidebar-content">
            <p>Reading tools temporarily unavailable</p>
          </div>
        </aside>
      `;
  }

  /**
   * Ensure template system is loaded and ready
   * Waits up to 2 seconds with retries
   * @returns {Promise<boolean>} True if templates loaded successfully
   */
  async function ensureTemplatesLoaded() {
    logDebug("Ensuring templates are loaded...");

    const loadResults =
      await window.TemplateSystem.GlobalTemplateCache.ensureTemplatesLoaded();
    logDebug("Template load results:", loadResults);

    let cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
    let retries = 0;
    const maxRetries = 20;
    const retryDelay = 100; // milliseconds

    while (!cacheStatus.isLoaded && retries < maxRetries) {
      logDebug(`Waiting for templates to load (retry ${retries + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
      retries++;
    }

    if (!cacheStatus.isLoaded) {
      logWarn(
        `Templates failed to load after ${maxRetries} retries (${
          maxRetries * retryDelay
        }ms)`
      );
      return false;
    }

    logInfo("✅ Templates loaded successfully");
    return true;
  }

  /**
   * Generate integrated sidebar using template system
   * @param {Object} metadata - Document metadata
   * @returns {Promise<string>} Sidebar HTML or fallback
   */
  async function generateIntegratedSidebar(metadata) {
    logDebug("Generating integrated sidebar...");

    // Ensure templates are loaded
    const templatesLoaded = await ensureTemplatesLoaded();

    if (!templatesLoaded) {
      logWarn("Templates failed to load, using fallback sidebar");
      return generateFallbackSidebar();
    }

    try {
      // Create template generator and initialise from global cache
      const templateGenerator =
        new window.TemplateSystem.EnhancedHTMLGenerator();
      await templateGenerator.engine.initializeFromGlobalCache();

      // Render integrated sidebar template
      const integratedSidebar = templateGenerator.renderTemplate(
        "integratedDocumentSidebar",
        metadata
      );

      // Check if template was found
      if (
        integratedSidebar.includes("<!-- Template") &&
        integratedSidebar.includes("not found")
      ) {
        logWarn("Template 'integratedDocumentSidebar' not found, using fallback");
        return generateFallbackSidebar();
      }

      logInfo("✅ Successfully rendered integrated sidebar with templates");
      return integratedSidebar;
    } catch (error) {
      logError("Error generating integrated sidebar:", error);
      return generateFallbackSidebar();
    }
  }

  // ===========================================================================================
  // BODY GENERATION FUNCTIONS
  // ===========================================================================================

  /**
   * Generate complete document body with content, sidebar, and footer
   * @param {string} enhancedContent - The main document content (already processed)
   * @param {Object} metadata - Document metadata
   * @param {string} footerHTML - Pre-generated footer HTML
   * @returns {Promise<string>} Complete body HTML
   */
  async function generateDocumentBody(enhancedContent, metadata, footerHTML) {
    logInfo("Generating document body...");

    const bodyComponents = [];

    // Body opening tag
    bodyComponents.push("<body>");

    // Main document content
    bodyComponents.push(enhancedContent);

    // Generate and add integrated sidebar
    const sidebarHTML = await generateIntegratedSidebar(metadata);
    bodyComponents.push(sidebarHTML);

    // Add document footer
    bodyComponents.push(footerHTML);

    // Close document-wrapper div
    bodyComponents.push("</div>");

    logInfo("✅ Document body generated successfully");
    return bodyComponents.join("\n");
  }

  /**
   * Generate document body for minimal processing mode
   * (Includes additional logging for convergence tracking)
   * @param {string} enhancedContent - The main document content
   * @param {Object} metadata - Document metadata
   * @param {string} footerHTML - Pre-generated footer HTML
   * @returns {Promise<string>} Complete body HTML
   */
  async function generateDocumentBodyMinimal(
    enhancedContent,
    metadata,
    footerHTML
  ) {
    logInfo("Generating document body (minimal processing mode)...");

    const bodyComponents = [];

    // Body opening tag
    bodyComponents.push("<body>");

    // Main document content with complete structure
    bodyComponents.push(enhancedContent);

    // Add complete integrated sidebar using template system (ALL sections)
    // 🎯 CRITICAL FIX: Ensure external templates are loaded first and force sync
    logDebug("Loading templates for minimal processing mode...");
    const sidebarHTML = await generateIntegratedSidebar(metadata);
    bodyComponents.push(sidebarHTML);

    // Add document footer
    bodyComponents.push(footerHTML);

    // Close document-wrapper div
    bodyComponents.push("</div>");

    logInfo("✅ Document body (minimal processing) generated successfully");
    return bodyComponents.join("\n");
  }

  // ===========================================================================================
  // VALIDATION FUNCTIONS
  // ===========================================================================================

  /**
   * Validate that all required dependencies are available
   * @returns {Object} Validation result with status and missing dependencies
   */
  function validateDependencies() {
    const validation = {
      isValid: true,
      missing: [],
      warnings: [],
    };

    // Check for TemplateSystem
    if (!window.TemplateSystem) {
      validation.isValid = false;
      validation.missing.push("TemplateSystem");
    } else {
      // Check for required TemplateSystem methods
      if (!window.TemplateSystem.GlobalTemplateCache) {
        validation.isValid = false;
        validation.missing.push("TemplateSystem.GlobalTemplateCache");
      }
      if (!window.TemplateSystem.EnhancedHTMLGenerator) {
        validation.isValid = false;
        validation.missing.push("TemplateSystem.EnhancedHTMLGenerator");
      }
      if (!window.TemplateSystem.getGlobalCacheStatus) {
        validation.isValid = false;
        validation.missing.push("TemplateSystem.getGlobalCacheStatus");
      }
    }

    // Log validation results
    if (!validation.isValid) {
      logError("Dependency validation failed:", validation.missing);
    } else {
      logInfo("✅ All dependencies validated successfully");
    }

    return validation;
  }

  /**
   * Validate body generation parameters
   * @param {string} content - The main content
   * @param {Object} metadata - Document metadata
   * @param {string} footer - Footer HTML
   * @returns {Object} Validation result
   */
  function validateBodyParameters(content, metadata, footer) {
    const validation = {
      isValid: true,
      errors: [],
    };

    if (!content || typeof content !== "string") {
      validation.isValid = false;
      validation.errors.push("Content must be a non-empty string");
    }

    if (!metadata || typeof metadata !== "object") {
      validation.isValid = false;
      validation.errors.push("Metadata must be an object");
    }

    if (!footer || typeof footer !== "string") {
      validation.isValid = false;
      validation.errors.push("Footer must be a non-empty string");
    }

    if (!validation.isValid) {
      logError("Parameter validation failed:", validation.errors);
    }

    return validation;
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  logInfo("BodyGenerator module initialised");

  // Validate dependencies on load
  const dependencyValidation = validateDependencies();
  if (!dependencyValidation.isValid) {
    logWarn(
      "BodyGenerator loaded with missing dependencies:",
      dependencyValidation.missing
    );
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main generation functions
    generateDocumentBody,
    generateDocumentBodyMinimal,
    generateIntegratedSidebar,

    // Utility functions (exposed for testing)
    generateFallbackSidebar,
    ensureTemplatesLoaded,

    // Validation functions (exposed for testing)
    validateDependencies,
    validateBodyParameters,

    // Logging (exposed for testing)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.BodyGenerator = BodyGenerator;