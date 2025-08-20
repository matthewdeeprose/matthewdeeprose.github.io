// template-system.js
// Enhanced Template Engine Module - Pure Vanilla JavaScript
// Replaces string concatenation with maintainable templates
// WCAG 2.2 AA compliant with British spelling

const TemplateSystem = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
  // ===========================================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error("[TEMPLATE-ENGINE]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TEMPLATE-ENGINE]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TEMPLATE-ENGINE]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TEMPLATE-ENGINE]", message, ...args);
  }

  // ===========================================================================================
  // PERFORMANCE MONITORING
  // ===========================================================================================

  const performanceMetrics = {
    renderCount: 0,
    totalRenderTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  function measurePerformance(fn, name) {
    return function (...args) {
      const start = window.performance.now();
      try {
        return fn.apply(this, args);
      } finally {
        const duration = window.performance.now() - start;
        performanceMetrics.totalRenderTime += duration;
        performanceMetrics.renderCount++;
        if (duration > 10) {
          logWarn(
            `Slow template render for "${name}": ${duration.toFixed(2)}ms`
          );
        }
      }
    };
  }

  // ===========================================================================================
  // GLOBAL TEMPLATE CACHE SINGLETON
  // ===========================================================================================

  // Global singleton cache to prevent duplicate template loading
  const GlobalTemplateCache = {
    templates: new Map(),
    loadingPromise: null,
    isLoaded: false,
    loadAttempted: false,

    async ensureTemplatesLoaded() {
      // If already loaded, return immediately
      if (this.isLoaded) {
        logDebug("✅ Templates already loaded from global cache");
        return { loaded: Array.from(this.templates.keys()), failed: [] };
      }

      // If currently loading, wait for existing promise
      if (this.loadingPromise) {
        logDebug("⏳ Waiting for existing template loading operation...");
        try {
          const results = await this.loadingPromise;
          return results;
        } catch (error) {
          logWarn("Error waiting for existing promise:", error.message);
          this.loadingPromise = null; // Reset on error
          return { loaded: [], failed: [] };
        }
      }

      // Mark as attempted and start loading
      this.loadAttempted = true;
      this.loadingPromise = this.loadExternalTemplates();

      try {
        const results = await this.loadingPromise;
        this.isLoaded = results.loaded.length > 0;

        // 🎯 CRITICAL FIX: Always reset promise regardless of success/failure
        this.loadingPromise = null;
        logDebug("🔄 Global cache loading promise reset to null");

        return results;
      } catch (error) {
        logWarn("Global template loading failed:", error.message);
        this.loadingPromise = null; // Ensure reset on error
        this.isLoaded = false; // Reset loading state
        return { loaded: [], failed: [] };
      }
    },
    async loadExternalTemplates() {
      logInfo("🚀 GLOBAL: Loading external templates (singleton)...");

      // List of external template files to load
      const externalTemplateFiles = [
        "reading-tools-section.html",
        "theme-toggle-section.html",
        "print-button-section.html",
        "reset-controls-section.html",
        "mathjax-accessibility-controls.html",
        "integrated-document-sidebar.html",
        "table-of-contents.html",
        "embedded-fonts.html",
        "partials/font-option.html",
        "partials/width-option.html",
        "partials/zoom-option.html",
        "prism-css.html",
        "prism-js.html",
        "credits-acknowledgements.html",
      ];

      const results = { loaded: [], failed: [] };

      for (const fileName of externalTemplateFiles) {
        try {
          const response = await fetch(`templates/${fileName}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const content = await response.text();
          const templateName = this.mapExternalFilenameToTemplateName(fileName);

          this.templates.set(templateName, content);
          results.loaded.push(templateName);
          logDebug(`✅ GLOBAL: Loaded ${templateName} from ${fileName}`);
        } catch (error) {
          results.failed.push({ file: fileName, error: error.message });
          logWarn(`⚠️ GLOBAL: Failed to load ${fileName}:`, error.message);
        }
      }

      logInfo(
        `✅ GLOBAL: Template loading complete: ${results.loaded.length}/${externalTemplateFiles.length} loaded`
      );
      return results;
    },

    mapExternalFilenameToTemplateName(fileName) {
      const mappings = {
        "reading-tools-section.html": "readingToolsSection",
        "theme-toggle-section.html": "themeToggleSection",
        "print-button-section.html": "printButtonSection",
        "reset-controls-section.html": "resetControlsSection",
        "mathjax-accessibility-controls.html": "mathJaxAccessibilityControls",
        "integrated-document-sidebar.html": "integratedDocumentSidebar",
        "table-of-contents.html": "tableOfContents",
        "embedded-fonts.html": "embedded-fonts",
        "partials/font-option.html": "fontOption",
        "partials/width-option.html": "widthOption",
        "partials/zoom-option.html": "zoomOption",
        "prism-css.html": "prismCSS",
        "prism-js.html": "prismJS",
        "credits-acknowledgements.html": "creditsAcknowledgements",
      };
      return mappings[fileName] || fileName.replace(/\.html$/, "");
    },

    getTemplate(templateName) {
      return this.templates.get(templateName);
    },

    hasTemplate(templateName) {
      return this.templates.has(templateName);
    },

    getAllTemplates() {
      return new Map(this.templates);
    },

    // Memory cleanup method
    clearCache() {
      logWarn("🧹 Clearing global template cache...");
      this.templates.clear();
      this.loadingPromise = null;
      this.isLoaded = false;
      this.loadAttempted = false;
    },
  };

  // ===========================================================================================
  // LIGHTWEIGHT TEMPLATE ENGINE WITH GLOBAL CACHING
  // ===========================================================================================

  class EnhancedTemplateEngine {
    constructor() {
      this.templates = new Map();
      this.compiledTemplates = new Map(); // Cache for compiled templates
      this.partials = new Map();
      this.helpers = new Map();
      this.filters = new Map();
      this.isInitializing = false; // Prevent duplicate initialization

      this.setupDefaultHelpers();
      this.setupDefaultFilters();

      // 🎯 FIX: Synchronous initialization with async upgrade
      this.initializeTemplatesSync();

      logDebug("Template engine initialised with synchronized initialization");
    }

    /**
     * 🎯 PHASE 5.6: Streamlined template initialization with race condition fix
     */
    initializeTemplatesSync() {
      // Prevent duplicate initialization
      if (this.isInitializing) {
        logDebug("Template initialization already in progress, skipping");
        return;
      }

      this.isInitializing = true;

      // Check if global cache is already loaded
      if (GlobalTemplateCache.isLoaded) {
        logDebug("🚀 Using existing global cache for template initialization");
        // Synchronously copy from already-loaded global cache
        this.copyFromGlobalCache();
        this.isInitializing = false;
      } else {
        logDebug(
          "📋 Initialising external templates only - no inline fallbacks"
        );
        // ✅ PHASE 5.6: Handle async initialization properly with race condition fix
        this.initializeExternalTemplatesOnlySync();
      }
    }

    /**
     * 🎯 PHASE 5.6: Synchronous wrapper for async template initialization
     */
    initializeExternalTemplatesOnlySync() {
      // Start async loading and handle completion
      this.initializeExternalTemplatesOnly()
        .then(() => {
          logDebug("✅ Async template initialization completed successfully");
          this.isInitializing = false;
        })
        .catch((error) => {
          logError(
            "❌ Failed to initialize external templates:",
            error.message
          );
          this.isInitializing = false;
          // Don't throw here to prevent breaking the sync initialization
        });
    }

    /**
     * 🎯 PHASE 5.6: Initialize external templates only - SYNCHRONOUS loading to fix race condition
     */
    async initializeExternalTemplatesOnly() {
      try {
        logInfo(
          "Initialising external templates only - no fallbacks available"
        );

        // ✅ PHASE 5.6 FIX: Wait for external templates to load synchronously
        logDebug(
          "⏳ Loading external templates synchronously to avoid race condition..."
        );
        const results = await GlobalTemplateCache.ensureTemplatesLoaded();

        if (results.loaded.length > 0) {
          // Copy templates from global cache immediately
          this.copyFromGlobalCache();
          logInfo(
            `✅ Successfully loaded ${results.loaded.length} external templates synchronously`
          );
          logDebug(
            "Template system initialized with external-only mode and templates loaded"
          );
        } else {
          logWarn(
            "⚠️ No external templates loaded - template rendering may fail"
          );
          logError(
            "💡 Please ensure templates/ directory is accessible and contains required files"
          );
        }

        // Validate template loading success
        if (this.templates.size === 0) {
          throw new Error(
            "Failed to load any external templates - template system unusable"
          );
        } else {
          logDebug(
            `✅ Template engine ready with ${this.templates.size} templates loaded`
          );
        }
      } catch (error) {
        logError("❌ External template initialization failed:", error.message);
        logError(
          "💡 Please ensure templates/ directory is accessible and contains required files"
        );
        throw new Error(
          "Template system initialization failed - external templates required"
        );
      }
    }
    /**
     * 🎯 PHASE 5.5: Copy templates from global cache - external templates only
     */
    copyFromGlobalCache() {
      const globalTemplates = GlobalTemplateCache.getAllTemplates();
      if (globalTemplates.size > 0) {
        // ✅ PHASE 5.5: No inline template preservation - all templates from external files
        globalTemplates.forEach((content, templateName) => {
          this.templates.set(templateName, content);
          logDebug(`📋 Loaded external template: ${templateName}`);
        });
        // 🎯 FIX: Use debug level to reduce duplicate messages
        logDebug(
          `✅ Template engine loaded ${globalTemplates.size} external templates from global cache`
        );
        this.compiledTemplates.clear(); // Clear cache for fresh templates
      }
    }

    /**
     * 🎯 FIX: Schedule async upgrade without causing race conditions
     */
    scheduleGlobalCacheUpgrade() {
      // Only upgrade if not already upgraded and global cache becomes available
      setTimeout(async () => {
        // Check if upgrade is still needed (templates not already loaded)
        if (this.templates.size >= 10) {
          logDebug("Templates already loaded, skipping upgrade");
          return;
        }

        // Check if global cache is loading or loaded
        if (GlobalTemplateCache.isLoaded) {
          // Cache is ready, copy templates
          this.copyFromGlobalCache();
          logDebug("🔄 Upgraded from already-loaded global cache");
          return;
        }

        // Check if another engine is already loading the cache
        if (GlobalTemplateCache.loadingPromise) {
          logDebug("Another engine is loading templates, waiting...");
          try {
            await GlobalTemplateCache.loadingPromise;
            if (GlobalTemplateCache.isLoaded) {
              this.copyFromGlobalCache();
              logDebug("🔄 Upgraded after waiting for global cache");
            }
          } catch (error) {
            logDebug("Global cache loading failed, keeping inline templates");
          }
          return;
        }

        // We're the first engine to attempt loading
        if (!GlobalTemplateCache.loadAttempted) {
          try {
            logInfo("📋 First engine initiating global template load");
            const results = await GlobalTemplateCache.ensureTemplatesLoaded();
            if (results.loaded.length > 0) {
              this.copyFromGlobalCache();
              logInfo(
                `✅ Successfully loaded ${results.loaded.length} external templates`
              );
            }
          } catch (error) {
            logWarn("Failed to load external templates:", error.message);
          }
        }
      }, 100); // Small delay to prevent race conditions
    }

    // ===========================================================================================
    // PHASE 4B: TEMPLATE INHERITANCE SYSTEM
    // ===========================================================================================

    /**
     * Parse template inheritance directives
     * @param {string} templateContent - Raw template content
     * @returns {Object} Inheritance information
     */
    parseInheritance(templateContent) {
      const inheritance = {
        parent: null,
        blocks: new Map(),
      };

      // Parse {{#extend "parent-template"}}
      const extendMatch = templateContent.match(/\{\{#extend\s+"([^"]+)"\}\}/);
      if (extendMatch) {
        inheritance.parent = extendMatch[1];
        logDebug(`[TEMPLATE-ENGINE] Template extends: ${extendMatch[1]}`);
      }

      // NEW: Parse blocks with proper nesting support
      this.parseBlocksWithNesting(templateContent, inheritance.blocks);

      return inheritance;
    }

    /**
     * Parse blocks handling nested block structures correctly
     * @param {string} templateContent - Template content to parse
     * @param {Map} blocksMap - Map to store found blocks
     */
    parseBlocksWithNesting(templateContent, blocksMap) {
      const blockStartRegex = /\{\{#block\s+"([^"]+)"\}\}/g;
      let match;

      while ((match = blockStartRegex.exec(templateContent)) !== null) {
        const blockName = match[1];
        const startPos = match.index;
        const startTag = match[0];

        // Find the matching end tag by counting depth
        let depth = 1;
        let currentPos = startPos + startTag.length;
        let endPos = -1;

        while (depth > 0 && currentPos < templateContent.length) {
          // Look for next block start or end
          const nextBlockStart = templateContent.indexOf(
            "{{#block",
            currentPos
          );
          const nextBlockEnd = templateContent.indexOf(
            "{{/block}}",
            currentPos
          );

          if (nextBlockEnd === -1) {
            // No closing tag found - invalid template
            logWarn(
              `[TEMPLATE-ENGINE] No closing tag found for block "${blockName}"`
            );
            break;
          }

          // If we find another opening tag before the closing tag, increase depth
          if (nextBlockStart !== -1 && nextBlockStart < nextBlockEnd) {
            depth++;
            currentPos = nextBlockStart + 8; // Move past '{{#block'
          } else {
            // Found a closing tag
            depth--;
            if (depth === 0) {
              // This is our matching closing tag
              endPos = nextBlockEnd;
            }
            currentPos = nextBlockEnd + 10; // Move past '{{/block}}'
          }
        }

        if (endPos !== -1) {
          // Extract the content between the tags
          const blockContent = templateContent.substring(
            startPos + startTag.length,
            endPos
          );
          blocksMap.set(blockName, blockContent);
          logDebug(
            `[TEMPLATE-ENGINE] Found block "${blockName}" with ${blockContent.length} chars`
          );

          // Check if this block contains nested blocks for debugging
          if (blockContent.includes("{{#block")) {
            logDebug(
              `[TEMPLATE-ENGINE] Block "${blockName}" contains nested blocks`
            );
          }
        } else {
          logError(
            `[TEMPLATE-ENGINE] Failed to parse block "${blockName}" - no matching end tag`
          );
        }
      }

      logDebug(`[TEMPLATE-ENGINE] Parsed ${blocksMap.size} blocks total`);
    }

    /**
     * Process template with inheritance using proper chain collection
     * @param {string} templateName - Template to process
     * @param {Set} processedTemplates - Circular dependency prevention
     * @returns {string} Processed template content
     */
    processInheritance(templateName, processedTemplates = new Set()) {
      // Prevent circular inheritance
      if (processedTemplates.has(templateName)) {
        logWarn(
          `[TEMPLATE-ENGINE] Circular inheritance detected for template: ${templateName}`
        );
        return this.templates.get(templateName) || "";
      }

      const template = this.templates.get(templateName);
      if (!template) {
        logError(
          `[TEMPLATE-ENGINE] Template not found for inheritance: ${templateName}`
        );
        return "";
      }

      const inheritance = this.parseInheritance(template);

      if (!inheritance.parent) {
        // No inheritance - clean up any orphaned block directives
        let result = template;
        result = result.replace(/\{\{#extend\s+"[^"]+"\}\}/g, "");
        result = result.replace(/\{\{\/extend\}\}/g, "");
        // Clean orphaned blocks by keeping their content
        result = result.replace(
          /\{\{#block\s+"[^"]+"\}\}([\s\S]*?)\{\{\/block\}\}/g,
          (match, blockContent) => blockContent.trim()
        );
        return result;
      }

      // NEW APPROACH: Walk entire inheritance chain and collect all blocks
      try {
        // Add current template to processed set to prevent circular deps
        processedTemplates.add(templateName);

        // Walk the chain from child to base
        const chain = this.walkInheritanceChain(
          templateName,
          processedTemplates
        );

        // Collect all blocks with proper precedence
        const allBlocks = this.collectAllBlocks(chain);

        // Get the base template (first in chain)
        const baseTemplate = chain[0];

        logDebug(
          `[TEMPLATE-ENGINE] Processing inheritance chain: ${chain
            .map((t) => t.templateName)
            .join(" → ")}`
        );
        logDebug(
          `[TEMPLATE-ENGINE] Collected ${allBlocks.size} unique blocks from chain`
        );

        // Process the base template with all collected blocks
        return this.processTemplateWithBlocks(baseTemplate.content, allBlocks);
      } catch (error) {
        logError(
          `[TEMPLATE-ENGINE] Error processing inheritance chain for ${templateName}:`,
          error
        );
        // Fallback to the original template with cleanup
        let result = template;
        result = result.replace(/\{\{#extend\s+"[^"]+"\}\}/g, "");
        result = result.replace(/\{\{\/extend\}\}/g, "");
        result = result.replace(
          /\{\{#block\s+"[^"]+"\}\}([\s\S]*?)\{\{\/block\}\}/g,
          (match, blockContent) => blockContent.trim()
        );
        return result;
      }
    }

    /**
     * Walk the inheritance chain from child to base
     * @param {string} templateName - Starting template name
     * @param {Set} processedTemplates - Circular dependency prevention
     * @returns {Array} Array of {templateName, content} from base to child
     */
    walkInheritanceChain(templateName, processedTemplates = new Set()) {
      const chain = [];
      let currentTemplate = templateName;

      // Walk up the chain to collect all templates
      while (currentTemplate) {
        if (chain.some((item) => item.templateName === currentTemplate)) {
          throw new Error(`Circular inheritance detected: ${currentTemplate}`);
        }

        const content = this.templates.get(currentTemplate);
        if (!content) {
          throw new Error(`Template not found: ${currentTemplate}`);
        }

        // Add to beginning to maintain base->child order
        chain.unshift({ templateName: currentTemplate, content });

        // Parse to find parent
        const inheritance = this.parseInheritance(content);
        currentTemplate = inheritance.parent;
      }

      logDebug(
        `[TEMPLATE-ENGINE] Built inheritance chain: ${chain
          .map((t) => t.templateName)
          .join(" → ")}`
      );
      return chain;
    }

    /**
     * Collect all blocks from inheritance chain with proper precedence
     * @param {Array} chain - Inheritance chain from base to child
     * @returns {Map} Map of blockName -> content (child overrides parent)
     */
    collectAllBlocks(chain) {
      const allBlocks = new Map();

      // Process from base to child - later templates override earlier ones
      chain.forEach(({ templateName, content }) => {
        const inheritance = this.parseInheritance(content);
        inheritance.blocks.forEach((blockContent, blockName) => {
          allBlocks.set(blockName, blockContent);
          logDebug(
            `[TEMPLATE-ENGINE] Block "${blockName}" defined/overridden by ${templateName}`
          );
        });
      });

      return allBlocks;
    }

    /**
     * Process base template with all collected blocks
     * @param {string} baseTemplate - The root template content
     * @param {Map} allBlocks - All blocks collected from inheritance chain
     * @returns {string} Fully processed template
     */
    processTemplateWithBlocks(baseTemplate, allBlocks) {
      let result = baseTemplate;

      // Remove extend directives first (shouldn't be in base, but be safe)
      result = result.replace(/\{\{#extend\s+"[^"]+"\}\}/g, "");
      result = result.replace(/\{\{\/extend\}\}/g, "");

      // Multi-pass processing to handle nested blocks
      let hasChanges = true;
      let iterations = 0;
      const maxIterations = 10;

      while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;

        logDebug(`[TEMPLATE-ENGINE] Block processing iteration ${iterations}`);

        // Process blocks one at a time to handle nested structures
        for (const [blockName, blockContent] of allBlocks) {
          const blockRegex = new RegExp(
            `\\{\\{#block\\s+"${blockName}"\\}\\}[\\s\\S]*?\\{\\{\\/block\\}\\}`,
            "g"
          );

          const beforeReplace = result;

          // Replace all occurrences of this block
          result = result.replace(blockRegex, blockContent.trim());

          if (result !== beforeReplace) {
            hasChanges = true;
            logDebug(
              `[TEMPLATE-ENGINE] Iteration ${iterations}: Applied block "${blockName}"`
            );
          }
        }

        // If no specific block replacements, clean orphaned blocks
        if (!hasChanges) {
          const beforeCleanup = result;
          result = result.replace(
            /\{\{#block\s+"[^"]+"\}\}([\s\S]*?)\{\{\/block\}\}/g,
            (match, blockContent) => {
              logDebug(`[TEMPLATE-ENGINE] Cleaning orphaned block directive`);
              return blockContent.trim();
            }
          );

          if (result !== beforeCleanup) {
            hasChanges = true;
          }
        }
      }

      if (iterations >= maxIterations) {
        logWarn("[TEMPLATE-ENGINE] Max iterations reached in block processing");
      }

      // Final verification
      const hasRemainingDirectives =
        result.includes("{{#block") ||
        result.includes("{{/block}}") ||
        result.includes("{{#extend") ||
        result.includes("{{/extend}}");

      if (hasRemainingDirectives) {
        logWarn(
          "[TEMPLATE-ENGINE] Some template directives remain after processing"
        );
        logDebug("Remaining content sample:", result.substring(0, 300));
      } else {
        logDebug(
          "[TEMPLATE-ENGINE] Template inheritance processing complete - all directives resolved"
        );
      }

      return result;
    }

    /**
     * Find all blocks in a template with their content
     * @param {string} template - Template to analyze
     * @returns {Array} Array of {name, content, startPos, endPos}
     */
    findAllBlocks(template) {
      const blocks = [];
      const regex = /\{\{#block\s+"([^"]+)"\}\}/g;
      let match;

      while ((match = regex.exec(template)) !== null) {
        const blockName = match[1];
        const startPos = match.index;
        const startTag = match[0];

        // Find matching end tag
        let depth = 1;
        let currentPos = startPos + startTag.length;
        let endPos = -1;

        while (depth > 0 && currentPos < template.length) {
          const nextOpen = template.indexOf("{{#block", currentPos);
          const nextClose = template.indexOf("{{/block}}", currentPos);

          if (nextClose === -1) break;

          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++;
            currentPos = nextOpen + 8;
          } else {
            depth--;
            currentPos = nextClose + 10;
            if (depth === 0) {
              endPos = nextClose + 10;
            }
          }
        }

        if (endPos !== -1) {
          const fullBlock = template.substring(startPos, endPos);
          const content = template.substring(
            startPos + startTag.length,
            endPos - 10
          );
          blocks.push({
            name: blockName,
            content: content,
            fullBlock: fullBlock,
            startPos: startPos,
            endPos: endPos,
          });
        }
      }

      return blocks;
    }

    /**
     * Analyze block dependencies (which blocks contain other blocks)
     * @param {string} template - Template content
     * @param {Map} allBlocks - All available blocks
     * @returns {Object} Dependency information
     */
    analyzeBlockDependencies(template, allBlocks) {
      const dependencies = {};

      // Check each block's content for nested blocks
      allBlocks.forEach((content, blockName) => {
        const nestedBlocks = this.findAllBlocks(content);
        if (nestedBlocks.length > 0) {
          dependencies[blockName] = nestedBlocks.map((b) => b.name);
        } else {
          dependencies[blockName] = [];
        }
      });

      return dependencies;
    }

    /**
     * Find all block positions in template with depth information
     * @param {string} template - Template content
     * @returns {Array} Array of block information with position and depth
     */
    findBlockPositions(template) {
      const blocks = [];
      const regex = /\{\{#block\s+"([^"]+)"\}\}/g;
      let match;

      while ((match = regex.exec(template)) !== null) {
        const blockName = match[1];
        const startPos = match.index;
        const endTag = `{{/block}}`;

        // Find the corresponding end tag
        let depth = 1;
        let currentPos = startPos + match[0].length;
        let endPos = -1;

        while (depth > 0 && currentPos < template.length) {
          // Look for next block start or end
          const nextBlockStart = template.indexOf("{{#block", currentPos);
          const nextBlockEnd = template.indexOf(endTag, currentPos);

          if (nextBlockEnd === -1) {
            // No closing tag found
            break;
          }

          if (nextBlockStart !== -1 && nextBlockStart < nextBlockEnd) {
            // Found a nested block start
            depth++;
            currentPos = nextBlockStart + 8; // Skip past {{#block
          } else {
            // Found a block end
            depth--;
            if (depth === 0) {
              endPos = nextBlockEnd + endTag.length;
            }
            currentPos = nextBlockEnd + endTag.length;
          }
        }

        if (endPos !== -1) {
          blocks.push({
            name: blockName,
            startPos: startPos,
            endPos: endPos,
            fullMatch: template.substring(startPos, endPos),
            depth: this.calculateBlockDepth(template, startPos),
          });
        }
      }

      return blocks;
    }

    /**
     * Calculate the nesting depth of a block
     * @param {string} template - Template content
     * @param {number} position - Position of the block
     * @returns {number} Nesting depth (0 = top level)
     */
    calculateBlockDepth(template, position) {
      let depth = 0;
      const beforeBlock = template.substring(0, position);

      // Count unclosed block starts before this position
      const blockStarts = (beforeBlock.match(/\{\{#block\s+"[^"]+"\}\}/g) || [])
        .length;
      const blockEnds = (beforeBlock.match(/\{\{\/block\}\}/g) || []).length;

      depth = blockStarts - blockEnds;
      return Math.max(0, depth);
    }

    /**
     * Sort blocks by depth (deepest first)
     * @param {Array} blocks - Array of block information
     * @returns {Array} Sorted array
     */
    sortBlocksByDepth(blocks) {
      return blocks.sort((a, b) => b.depth - a.depth);
    }

    /**
     * Replace a specific block at its exact position
     * @param {string} template - Template content
     * @param {Object} blockInfo - Block position information
     * @param {string} replacement - Replacement content
     * @returns {string} Updated template
     */
    replaceBlockAtPosition(template, blockInfo, replacement) {
      return (
        template.substring(0, blockInfo.startPos) +
        replacement +
        template.substring(blockInfo.endPos)
      );
    }

    /**
     * Initialize templates from global cache (non-blocking)
     */
    async initializeFromGlobalCache() {
      try {
        const results = await GlobalTemplateCache.ensureTemplatesLoaded();

        // Copy external templates from global cache to instance
        const globalTemplates = GlobalTemplateCache.getAllTemplates();
        globalTemplates.forEach((content, templateName) => {
          this.templates.set(templateName, content);
          logDebug(`📋 Copied ${templateName} from global cache`);
        });

        logInfo(
          `✅ Template engine loaded ${globalTemplates.size} external templates from global cache`
        );

        // Clear compiled cache to ensure fresh templates
        this.compiledTemplates.clear();

        return results;
      } catch (error) {
        logWarn(
          "Failed to load from global cache, using inline templates:",
          error.message
        );
        return { loaded: [], failed: [] };
      }
    }

    /**
     * Main render method with caching and automatic default data
     * PHASE 4B: Enhanced with template inheritance support
     */
    render(templateName, userData = {}) {
      // Automatically merge default data
      const defaultData = this.getDefaultTemplateData(templateName);
      const data = { ...defaultData, ...userData };

      logDebug(`Rendering "${templateName}" with merged data:`, data);

      // PHASE 4B: Process inheritance first
      const processedTemplate = this.processInheritance(templateName);
      if (!processedTemplate) {
        logError(`Template "${templateName}" not found`);
        return `<!-- Template "${templateName}" not found -->`;
      }

      try {
        // Create cache key that includes inheritance processing
        const cacheKey = `${templateName}_inheritance`;

        // Check cache first
        let compiledTemplate = this.compiledTemplates.get(cacheKey);
        if (!compiledTemplate) {
          performanceMetrics.cacheMisses++;
          logDebug(
            `Cache MISS for template: ${templateName} (misses: ${performanceMetrics.cacheMisses})`
          );
          // Compile the processed template (with inheritance resolved)
          compiledTemplate = this.compileTemplate(processedTemplate);
          this.compiledTemplates.set(cacheKey, compiledTemplate);
          logDebug(
            `Compiled and cached template with inheritance: ${templateName}`
          );
        } else {
          performanceMetrics.cacheHits++;
          logDebug(
            `Cache HIT for template: ${templateName} (hits: ${performanceMetrics.cacheHits})`
          );
        }

        return compiledTemplate(data);
      } catch (error) {
        logError(`Error rendering template "${templateName}":`, error);
        return `<!-- Error rendering template "${templateName}": ${error.message} -->`;
      }
    }

    renderPartial(partialName, data, parentData) {
      const template = this.templates.get(partialName);
      if (!template) {
        logWarn(`Partial "${partialName}" not found`);
        return "";
      }

      // Get default data for this partial
      const defaultData = this.getDefaultTemplateData(partialName);

      // Merge in this order: defaults -> parent data -> specific data
      const mergedData = { ...defaultData, ...parentData, ...data };

      logDebug(
        `Rendering partial "${partialName}" with merged data:`,
        mergedData
      );

      // ✅ FIX: Use compileTemplate and direct processing instead of recursive renderTemplate
      try {
        const compiledTemplate = this.compileTemplate(template);
        return compiledTemplate(mergedData);
      } catch (error) {
        logError(`Error rendering partial "${partialName}":`, error);
        return `<!-- Error rendering partial "${partialName}": ${error.message} -->`;
      }
    }

    /**
     * Compile template to function for better performance
     */
    compileTemplate(template) {
      const self = this; // Capture 'this' for use in nested function

      const processTemplate = measurePerformance(function (tpl, data) {
        let result = tpl;

        // Process {{#each}} loops with @index, @first, @last support
        // CRITICAL: Process loops BEFORE partials so partials have access to item context
        result = result.replace(
          /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
          (match, arrayPath, content) => {
            const array = self.getNestedValue(data, arrayPath.trim());
            if (!Array.isArray(array)) return "";

            return array
              .map((item, index) => {
                const itemContext =
                  typeof item === "object"
                    ? {
                        ...data,
                        ...item,
                        "@index": index,
                        "@first": index === 0,
                        "@last": index === array.length - 1,
                      }
                    : {
                        ...data,
                        this: item,
                        "@index": index,
                        "@first": index === 0,
                        "@last": index === array.length - 1,
                      };
                return processTemplate(content, itemContext);
              })
              .join("");
          }
        );

        // Process partials {{> partialName}}
        // Now partials can access individual item context from loops processed above
        result = result.replace(
          /\{\{>\s*([^}]+)\}\}/g,
          (match, partialName) => {
            const cleanPartialName = partialName.trim();
            const partial =
              self.partials.get(cleanPartialName) ||
              self.templates.get(cleanPartialName);
            if (!partial) {
              logWarn(`Partial "${cleanPartialName}" not found`);
              return `<!-- Partial "${cleanPartialName}" not found -->`;
            }

            // ✅ FIX: Merge default data for the partial with current data
            const partialDefaults =
              self.getDefaultTemplateData(cleanPartialName);
            const mergedPartialData = { ...partialDefaults, ...data };

            logDebug(
              `Processing partial "${cleanPartialName}" with merged data:`,
              mergedPartialData
            );

            // Recursively process the partial with merged data
            return processTemplate(partial, mergedPartialData);
          }
        );

        // Process {{#if}} conditionals with else support
        result = result.replace(
          /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
          (match, condition, truthy, falsy = "") => {
            const value = self.evaluateCondition(condition.trim(), data);
            return value
              ? processTemplate(truthy, data)
              : processTemplate(falsy, data);
          }
        );

        // PHASE 4B: Process {{#block}} directives - extract content only
        result = result.replace(
          /\{\{#block\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/block\}\}/g,
          (match, blockName, content) => {
            // For final rendering, we just want the content inside the block
            logDebug(
              `[TEMPLATE-ENGINE] Processing block directive: ${blockName}`
            );
            return processTemplate(content.trim(), data);
          }
        );

        // Process {{{raw}}} unescaped content
        result = result.replace(/\{\{\{([^}]+)\}\}\}/g, (match, expression) => {
          const value = self.getNestedValue(data, expression.trim());
          return value != null ? String(value) : "";
        });

        // Process {{variable}} substitutions with filters AND {{helper}} calls
        result = result.replace(/\{\{([^}#\/]+)\}\}/g, (match, expression) => {
          // Clean the expression
          const cleanExpression = expression.trim();

          logDebug("Processing expression:", {
            expression: cleanExpression,
            match,
          });

          // Check for helper functions (contains spaces and not just filter syntax)
          if (cleanExpression.includes(" ") && !cleanExpression.includes("|")) {
            logDebug("Detected helper call:", cleanExpression);
            return self.processHelper(cleanExpression, data);
          }

          // Handle variable with filters: variable | filter1 | filter2
          const [variable, ...filters] = cleanExpression
            .split("|")
            .map((s) => s.trim());

          logDebug("Processing variable:", {
            variable,
            filters,
            expression: cleanExpression,
          });

          // Check if the variable part (before any filters) is a helper call
          if (variable.includes(" ")) {
            logDebug("Variable part is helper call:", variable);
            let helperResult = self.processHelper(variable, data);

            // Apply filters to helper result
            for (const filter of filters) {
              const [filterName, ...args] = filter
                .split(":")
                .map((s) => s.trim());
              const filterFn = self.filters.get(filterName);
              if (filterFn) {
                logDebug(
                  "Applying filter to helper result:",
                  filterName,
                  "with args:",
                  args
                );
                helperResult = filterFn(helperResult, ...args);
                logDebug("Value after filter:", helperResult);
              } else {
                logWarn(`Filter "${filterName}" not found`);
              }
            }

            return self.escapeHtml(helperResult);
          }

          // Handle simple variable lookup
          let value = self.getNestedValue(data, variable);
          logDebug("Initial value:", value);

          // Apply filters to variable value
          for (const filter of filters) {
            const [filterName, ...args] = filter
              .split(":")
              .map((s) => s.trim());
            const filterFn = self.filters.get(filterName);
            if (filterFn) {
              logDebug("Applying filter:", filterName, "with args:", args);
              value = filterFn(value, ...args);
              logDebug("Value after filter:", value);
            } else {
              logWarn(`Filter "${filterName}" not found`);
            }
          }

          const escaped = self.escapeHtml(value);
          logDebug("Final escaped value:", escaped);
          return escaped;
        });

        return result;
      }, "processTemplate");

      return (data) => processTemplate(template, data);
    }

    /**
     * Improved condition evaluation
     */
    evaluateCondition(condition, data) {
      // Handle not operator
      if (condition.startsWith("!")) {
        return !this.evaluateCondition(condition.slice(1), data);
      }

      // Handle equality: variable == 'value' or variable === 'value'
      const equalityMatch = condition.match(
        /^(\S+)\s*(===?)\s*['"]([^'"]+)['"]$/
      );
      if (equalityMatch) {
        const [, variable, operator, value] = equalityMatch;
        const varValue = this.getNestedValue(data, variable);
        return operator === "===" ? varValue === value : varValue == value;
      }

      // Handle inequality: variable != 'value'
      const inequalityMatch = condition.match(
        /^(\S+)\s*!==?\s*['"]([^'"]+)['"]$/
      );
      if (inequalityMatch) {
        const [, variable, value] = inequalityMatch;
        return this.getNestedValue(data, variable) !== value;
      }

      // Handle comparisons: variable > 5, variable <= 10
      const comparisonMatch = condition.match(/^(\S+)\s*([<>]=?)\s*(\d+)$/);
      if (comparisonMatch) {
        const [, variable, operator, value] = comparisonMatch;
        const varValue = Number(this.getNestedValue(data, variable));
        const numValue = Number(value);

        switch (operator) {
          case ">":
            return varValue > numValue;
          case ">=":
            return varValue >= numValue;
          case "<":
            return varValue < numValue;
          case "<=":
            return varValue <= numValue;
        }
      }

      // Simple truthiness
      return !!this.getNestedValue(data, condition);
    }

    /**
     * Enhanced helper processing with improved argument parsing
     */
    processHelper(expression, data) {
      // Enhanced parsing to handle quoted arguments correctly
      const parts = [];
      let current = "";
      let inQuotes = false;
      let quoteChar = "";

      for (let i = 0; i < expression.length; i++) {
        const char = expression[i];

        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
          current += char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = "";
          current += char;
        } else if (char === " " && !inQuotes) {
          if (current.trim()) {
            parts.push(current.trim());
            current = "";
          }
        } else {
          current += char;
        }
      }

      if (current.trim()) {
        parts.push(current.trim());
      }

      const helperName = parts[0];
      const args = parts.slice(1);

      logDebug("Processing helper:", { helperName, args, expression, parts });

      const helper = this.helpers.get(helperName);
      if (!helper) {
        logWarn(`Helper "${helperName}" not found`);
        return `<!-- Helper "${helperName}" not found -->`;
      }

      try {
        const values = args.map((arg) => {
          // Handle quoted strings
          if (
            (arg.startsWith('"') && arg.endsWith('"')) ||
            (arg.startsWith("'") && arg.endsWith("'"))
          ) {
            return arg.slice(1, -1);
          }
          // Handle numbers
          if (!isNaN(arg) && arg !== "" && arg !== "0") {
            return Number(arg);
          }
          // Handle zero specifically
          if (arg === "0") {
            return 0;
          }
          // Handle variables
          return this.getNestedValue(data, arg);
        });

        logDebug("Helper values:", values);
        const result = helper(...values);
        logDebug("Helper result:", result);
        return String(result); // Ensure result is always a string
      } catch (error) {
        logError(`Error in helper "${helperName}":`, error);
        return `<!-- Error in helper "${helperName}" -->`;
      }
    }

    /**
     * Safe nested value retrieval with array index support and better debugging
     */
    getNestedValue(obj, path) {
      if (!path || typeof path !== "string") return "";
      if (path.startsWith("@")) return obj[path] !== undefined ? obj[path] : "";

      // Handle simple property access (no dots)
      if (!path.includes(".")) {
        const value = obj && obj[path] !== undefined ? obj[path] : "";
        logDebug(
          `Simple property access: ${path} = ${JSON.stringify(value)} from:`,
          obj
        );
        return value;
      }

      // Handle nested property access (with dots)
      const pathParts = path.split(".");
      const result = pathParts.reduce((current, part) => {
        if (current === null || current === undefined) return "";

        // Handle array index like items[0]
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayName, index] = arrayMatch;
          const array = current[arrayName];
          return Array.isArray(array) ? array[parseInt(index)] : "";
        }

        // Handle simple property access
        return current[part] !== undefined ? current[part] : "";
      }, obj);

      logDebug(`Nested property access: ${path} = ${JSON.stringify(result)}`);
      return result;
    }

    /**
     * HTML escaping for security
     */
    escapeHtml(text) {
      if (text === null || text === undefined) return "";
      if (typeof text === "boolean") return text ? "true" : "false";
      if (typeof text === "number") return String(text);

      const div = document.createElement("div");
      div.textContent = String(text);
      return div.innerHTML;
    }

    /**
     * Setup default helpers
     */
    setupDefaultHelpers() {
      // Formatting helpers
      this.helpers.set(
        "formatPercent",
        (value) => Math.round(parseFloat(value) * 100) + "%"
      );
      this.helpers.set("formatSize", (value, unit = "em") => value + unit);
      this.helpers.set("formatId", (text) =>
        String(text)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );

      // Logic helpers
      this.helpers.set("equals", (a, b) => a === b);
      this.helpers.set("notEquals", (a, b) => a !== b);
      this.helpers.set("greaterThan", (a, b) => a > b);
      this.helpers.set("lessThan", (a, b) => a < b);

      // British spelling helper
      this.helpers.set("britishSpelling", (text) => {
        return String(text)
          .replace(/color/g, "colour")
          .replace(/Color/g, "Colour")
          .replace(/ize(?![a-z])/g, "ise")
          .replace(/izing(?![a-z])/g, "ising")
          .replace(/ized(?![a-z])/g, "ised")
          .replace(/customize/g, "customise")
          .replace(/Customize/g, "Customise");
      });

      logDebug(`Registered ${this.helpers.size} default helpers`);
    }

    /**
     * Setup default filters
     */
    setupDefaultFilters() {
      this.filters.set("uppercase", (value) => String(value).toUpperCase());
      this.filters.set("lowercase", (value) => String(value).toLowerCase());
      this.filters.set(
        "capitalise",
        (value) =>
          String(value).charAt(0).toUpperCase() + String(value).slice(1)
      );
      this.filters.set("truncate", (value, length = 50) => {
        const str = String(value);
        return str.length > length ? str.slice(0, length) + "..." : str;
      });
      this.filters.set(
        "default",
        (value, defaultValue) => value || defaultValue
      );

      logDebug(`Registered ${this.filters.size} default filters`);
    }

    // ===========================================================================================
    // BACKWARD COMPATIBILITY WITH CURRENT SYSTEM
    // ===========================================================================================

    /**
     * Render templates with data (replaces current string concatenation)
     */
    renderTemplate(templateName, data = {}) {
      // Provide default data for common templates
      const defaultData = this.getDefaultTemplateData(templateName);
      const mergedData = { ...defaultData, ...data };

      logDebug(`Rendering template "${templateName}" with data:`, mergedData);

      return measurePerformance(
        () => this.render(templateName, mergedData),
        templateName
      )();
    }

    /**
     * Get default template data with British spelling
     */
    getDefaultTemplateData(templateName) {
      const defaults = {
        readingToolsSection: {
          fontOptions: [
            {
              value: "Verdana, sans-serif",
              label: "Verdana (sans-serif)",
              selected: true,
            },
            {
              value: "Arial, sans-serif",
              label: "Arial (sans-serif)",
              selected: false,
            },
            {
              value: "Tahoma, sans-serif",
              label: "Tahoma (sans-serif)",
              selected: false,
            },
            {
              value: "'Trebuchet MS', sans-serif",
              label: "Trebuchet MS (sans-serif)",
              selected: false,
            },
            {
              value: "OpenDyslexic, sans-serif",
              label: "OpenDyslexic ('dyslexia-friendly')",
              selected: false,
            },
            // ✅ VARIABLE FONT with weight options
            {
              value: "Annotation Mono, monospace",
              label: "Annotation Mono (variable monospace)",
              selected: false,
              isVariable: true, // ✅ Flag for advanced features
              weightRange: "100-1000",
              supportsItalic: true,
            },
            {
              value: "'Times New Roman', serif",
              label: "Times New Roman (serif)",
              selected: false,
            },
            {
              value: "Georgia, serif",
              label: "Georgia (serif)",
              selected: false,
            },
            {
              value: "Garamond, serif",
              label: "Garamond (serif)",
              selected: false,
            },
            {
              value: "'Courier New', monospace",
              label: "Courier New (monospace)",
              selected: false,
            },
            {
              value: "'Brush Script MT', cursive",
              label: "Brush Script MT (cursive)",
              selected: false,
            },
          ],
          // ✅ ADD: Variable font weight options
          variableFontWeights: [
            { value: "300", label: "Light" },
            { value: "400", label: "Regular" },
            { value: "500", label: "Medium" },
            { value: "600", label: "Semi-Bold" },
            { value: "700", label: "Bold" },
            { value: "800", label: "Extra Bold" },
          ],
          widthOptions: [
            { value: "full", label: "Full width", selected: false },
            { value: "wide", label: "Wide", selected: false },
            {
              value: "narrow",
              label: "Narrow",
              selected: true,
            },
            {
              value: "extra-narrow",
              label: "Extra narrow",
              selected: false,
            },
          ],
          fontSize: 1.0,
          lineHeight: 1.6,
          paragraphSpacing: 1.0,
          wordSpacing: 0,
          letterSpacing: 0,
        },
        themeToggleSection: {
          icon: "🌙",
          text: "Dark",
          ariaLabel: "Switch to dark mode",
          isDarkMode: false,
        },
        mathJaxAccessibilityControls: {
          zoomOptions: [
            {
              id: "zoom-click",
              value: "Click",
              label: "Single click to zoom",
              checked: true,
              description:
                "Click once on any equation to zoom in for better readability",
            },
            {
              id: "zoom-doubleclick",
              value: "DoubleClick",
              label: "Double click to zoom",
              checked: false,
              description:
                "Double-click on any equation to zoom in for better readability",
            },
            {
              id: "zoom-nozoom",
              value: "NoZoom",
              label: "Zoom disabled",
              checked: false,
              description:
                "Zoom functionality is disabled - equations display at normal size",
            },
          ],
          zoomScale: 200,
          assistiveMathML: true,
          tabNavigation: true,
          usageInstructions: [
            {
              type: "Right-click",
              instruction: "Access MathJax context menu for additional options",
            },
            {
              type: "Keyboard",
              instruction:
                "Use Tab to navigate between equations when tab navigation is enabled",
            },
            {
              type: "Screen readers",
              instruction:
                "Assistive MathML provides spoken mathematical content",
            },
          ],
        },
        printButtonSection: {},
        resetControlsSection: {},
        tableOfContents: {
          sections: [],
        },
        // Add missing ones
        integratedDocumentSidebar: {
          // This template uses partials, so it inherits their defaults
        },
        // Default values for controls to fix NaN issues
        fontOption: {},
        widthOption: {},
        zoomOption: {},
      };

      return defaults[templateName] || {};
    }

    // ===========================================================================================
    // VALIDATION AND DEBUGGING
    // ===========================================================================================

    /**
     * Validate template syntax
     */
    validateTemplate(templateName) {
      const template = this.templates.get(templateName);
      if (!template) {
        return { valid: false, error: `Template "${templateName}" not found` };
      }

      const errors = [];

      // Check for unclosed tags
      const openTags = (template.match(/\{\{#(if|each)[^}]*\}\}/g) || [])
        .length;
      const closeTags = (template.match(/\{\{\/(if|each)\}\}/g) || []).length;
      if (openTags !== closeTags) {
        errors.push(
          `Mismatched {{#if}} or {{#each}} tags (${openTags} open, ${closeTags} close)`
        );
      }

      // Check for invalid syntax
      const invalidSyntax = template.match(/\{\{[^}]*\{\{/g);
      if (invalidSyntax) {
        errors.push(`Invalid nested template syntax found`);
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    }

    /**
     * Debug template rendering
     */
    debugRender(templateName, data = {}) {
      logInfo(`=== Debug render for template: ${templateName} ===`);
      logInfo("Input data:", data);

      const validation = this.validateTemplate(templateName);
      if (!validation.valid) {
        logError("Template validation failed:", validation.errors);
        return null;
      }

      try {
        const result = this.render(templateName, data);
        logInfo("Render successful, length:", result.length);
        logDebug("Output preview:", result.substring(0, 200) + "...");
        return result;
      } catch (error) {
        logError("Render failed:", error);
        return null;
      }
    }

    // ===========================================================================================
    // EXTERNAL TEMPLATE LOADING (FUTURE ENHANCEMENT)
    // ===========================================================================================

    /**
     * Load templates from external files (legacy method - now uses global cache)
     */
    async loadExternalTemplates(templateFiles) {
      logInfo("🔄 Loading external templates via global cache:", templateFiles);

      // Use global cache for efficiency
      const results = await GlobalTemplateCache.ensureTemplatesLoaded();

      // Copy requested templates from global cache to instance
      const instanceResults = { loaded: [], failed: [] };

      templateFiles.forEach((fileName) => {
        const templateName =
          GlobalTemplateCache.mapExternalFilenameToTemplateName(fileName);

        if (GlobalTemplateCache.hasTemplate(templateName)) {
          const content = GlobalTemplateCache.getTemplate(templateName);
          this.templates.set(templateName, content);
          this.compiledTemplates.delete(templateName); // Clear cache
          instanceResults.loaded.push(templateName);
          logDebug(`📋 Copied ${templateName} from global cache`);
        } else {
          instanceResults.failed.push({
            file: fileName,
            error: "Not found in global cache",
          });
          logWarn(`⚠️ Template ${fileName} not found in global cache`);
        }
      });

      return instanceResults;
    }

    /**
     * Map external filenames back to internal template names (delegated to global cache)
     */
    mapExternalFilenameToTemplateName(fileName) {
      return GlobalTemplateCache.mapExternalFilenameToTemplateName(fileName);
    }

    /**
     * Map external filenames back to internal template names
     */
    mapExternalFilenameToTemplateName(fileName) {
      const mappings = {
        "reading-tools-section.html": "readingToolsSection",
        "theme-toggle-section.html": "themeToggleSection",
        "print-button-section.html": "printButtonSection",
        "reset-controls-section.html": "resetControlsSection",
        "mathjax-accessibility-controls.html": "mathJaxAccessibilityControls",
        "integrated-document-sidebar.html": "integratedDocumentSidebar",
        "table-of-contents.html": "tableOfContents",
        "embedded-fonts.html": "embedded-fonts",
        "partials/font-option.html": "fontOption",
        "partials/width-option.html": "widthOption",
        "partials/zoom-option.html": "zoomOption",
      };

      return mappings[fileName] || fileName.replace(/\.(html|hbs|tmpl)$/, "");
    }

    /**
     * Save template to external file (development helper)
     */
    saveTemplateAsFile(templateName) {
      const template = this.templates.get(templateName);
      if (!template) {
        logError(`Cannot save: template "${templateName}" not found`);
        return;
      }

      const blob = new Blob([template], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName}.html`;
      a.click();
      URL.revokeObjectURL(url);

      logInfo(`Template "${templateName}" downloaded as ${templateName}.html`);
    }

    /**
     * Load external templates using global cache
     * OPTIMIZED: Uses singleton pattern to prevent duplicate loading
     */
    async loadExternalTemplatesOnInit() {
      logDebug("🔄 Using global template cache for external templates...");
      return await this.initializeFromGlobalCache();
    }
    // ===========================================================================================
    // PERFORMANCE REPORTING
    // ===========================================================================================

    getPerformanceReport() {
      const avgRenderTime =
        performanceMetrics.renderCount > 0
          ? performanceMetrics.totalRenderTime / performanceMetrics.renderCount
          : 0;

      const cacheHitRate =
        performanceMetrics.cacheHits + performanceMetrics.cacheMisses > 0
          ? (performanceMetrics.cacheHits /
              (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) *
            100
          : 0;

      return {
        averageRenderTime: `${avgRenderTime.toFixed(2)}ms`,
        totalRenders: performanceMetrics.renderCount,
        cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
        cacheHits: performanceMetrics.cacheHits,
        cacheMisses: performanceMetrics.cacheMisses,
        templatesLoaded: this.templates.size,
        compiledTemplatesCount: this.compiledTemplates.size,
        globalCacheLoaded: GlobalTemplateCache.isLoaded,
        globalTemplatesCount: GlobalTemplateCache.templates.size,
      };
    }

    /**
     * Memory management - clear instance caches
     */
    clearInstanceCache() {
      logInfo("🧹 Clearing template engine instance cache...");
      this.compiledTemplates.clear();
      performanceMetrics.cacheHits = 0;
      performanceMetrics.cacheMisses = 0;
      performanceMetrics.totalRenderTime = 0;
      performanceMetrics.renderCount = 0;
    }

    /**
     * Full memory cleanup including global cache
     */
    static clearAllCaches() {
      logWarn("🧹 Clearing ALL template caches (global + instances)...");
      GlobalTemplateCache.clearCache();
      performanceMetrics.cacheHits = 0;
      performanceMetrics.cacheMisses = 0;
      performanceMetrics.totalRenderTime = 0;
      performanceMetrics.renderCount = 0;
    }

    // ===========================================================================================
    // COMPREHENSIVE TESTING
    // ===========================================================================================

    /**
     * Test the template engine
     */
    test() {
      logInfo("🧪 Testing Enhanced Template Engine...");

      const tests = [
        {
          name: "Basic Variable Substitution",
          test: () => {
            this.templates.set("test-var", "Hello {{name}}!");
            const result = this.render("test-var", { name: "World" });
            return result === "Hello World!";
          },
        },
        {
          name: "HTML Escaping",
          test: () => {
            this.templates.set("test-escape", "Safe: {{html}}");
            const result = this.render("test-escape", {
              html: '<script>alert("xss")</script>',
            });
            return result.includes("&lt;script&gt;");
          },
        },
        {
          name: "Raw HTML Output",
          test: () => {
            this.templates.set("test-raw", "Raw: {{{html}}}");
            const result = this.render("test-raw", {
              html: "<strong>bold</strong>",
            });
            return result === "Raw: <strong>bold</strong>";
          },
        },
        {
          name: "Each Loop",
          test: () => {
            this.templates.set(
              "test-each",
              "{{#each items}}<li>{{this}}</li>{{/each}}"
            );
            const result = this.render("test-each", { items: ["a", "b", "c"] });
            return result === "<li>a</li><li>b</li><li>c</li>";
          },
        },
        {
          name: "Each with Index",
          test: () => {
            this.templates.set(
              "test-index",
              "{{#each items}}{{@index}}: {{this}}, {{/each}}"
            );
            const result = this.render("test-index", { items: ["a", "b"] });
            return result === "0: a, 1: b, ";
          },
        },
        {
          name: "If Conditional",
          test: () => {
            this.templates.set("test-if", "{{#if show}}visible{{/if}}");
            const result1 = this.render("test-if", { show: true });
            const result2 = this.render("test-if", { show: false });
            return result1 === "visible" && result2 === "";
          },
        },
        {
          name: "If/Else Conditional",
          test: () => {
            this.templates.set("test-else", "{{#if show}}yes{{else}}no{{/if}}");
            const result1 = this.render("test-else", { show: true });
            const result2 = this.render("test-else", { show: false });
            return result1 === "yes" && result2 === "no";
          },
        },
        {
          name: "Nested Properties",
          test: () => {
            this.templates.set("test-nested", "Hello {{user.name}}!");
            const result = this.render("test-nested", {
              user: { name: "John" },
            });
            return result === "Hello John!";
          },
        },
        {
          name: "Helpers",
          test: () => {
            this.templates.set(
              "test-helper",
              'Size: {{formatSize value "px"}}'
            );
            const result = this.render("test-helper", { value: 16 });
            logDebug("Helper test result:", result);
            logDebug("Expected: Size: 16px");
            return result === "Size: 16px";
          },
        },
        {
          name: "Filters",
          test: () => {
            this.templates.set("test-filter", "{{name | uppercase}}");
            const result = this.render("test-filter", { name: "test" });
            logDebug("Filter test result:", result);
            logDebug("Expected: TEST");
            return result === "TEST";
          },
        },
        {
          name: "Partials",
          test: () => {
            this.partials.set("greeting", "Hello {{name}}!");
            this.templates.set("test-partial", "Message: {{> greeting}}");
            const result = this.render("test-partial", { name: "World" });
            return result === "Message: Hello World!";
          },
        },
        {
          name: "Reading Tools Template",
          test: () => {
            const html = this.render("readingToolsSection");
            return (
              html.includes("reading-tools-section") &&
              html.includes("Font:") &&
              html.includes("Font size:")
            );
          },
        },
        {
          name: "Theme Toggle Template",
          test: () => {
            const html = this.render("themeToggleSection");
            logDebug("Theme toggle HTML:", html);
            const hasThemeToggle = html.includes("theme-toggle");
            const hasMoon = html.includes("🌙");
            const hasDark = html.includes("Dark");
            logDebug("Theme toggle checks:", {
              hasThemeToggle,
              hasMoon,
              hasDark,
            });
            return hasThemeToggle && hasMoon && hasDark;
          },
        },
        {
          name: "MathJax Controls Template",
          test: () => {
            const html = this.render("mathJaxAccessibilityControls");
            logDebug("MathJax controls HTML length:", html.length);
            const hasMathJax = html.includes("MathJax Accessibility");
            const hasZoomClick = html.includes("zoom-click");
            const hasAssistive = html.includes("assistive-mathml");
            logDebug("MathJax checks:", {
              hasMathJax,
              hasZoomClick,
              hasAssistive,
            });
            return hasMathJax && hasZoomClick && hasAssistive;
          },
        },
        {
          name: "British Spelling Helper",
          test: () => {
            this.templates.set("test-british", "{{britishSpelling text}}");
            const result = this.render("test-british", {
              text: "color customized",
            });
            logDebug("British spelling result:", result);
            logDebug("Expected: colour customised");
            return result === "colour customised";
          },
        },
        {
          name: "Template Validation",
          test: () => {
            this.templates.set("invalid", "{{#if test}}unclosed");
            const validation = this.validateTemplate("invalid");
            return !validation.valid && validation.errors.length > 0;
          },
        },
        {
          name: "Performance Caching",
          test: () => {
            // Reset metrics
            performanceMetrics.cacheHits = 0;
            performanceMetrics.cacheMisses = 0;

            // Clear compiled template cache to ensure fresh test
            this.compiledTemplates.clear();

            // First render should miss cache
            this.render("themeToggleSection");
            const firstMisses = performanceMetrics.cacheMisses;
            logDebug(
              `After first render - misses: ${firstMisses}, hits: ${performanceMetrics.cacheHits}`
            );

            // Second render should hit cache
            this.render("themeToggleSection");
            const cacheHits = performanceMetrics.cacheHits;
            logDebug(
              `After second render - misses: ${performanceMetrics.cacheMisses}, hits: ${cacheHits}`
            );

            return (
              firstMisses >= 1 &&
              cacheHits >= 1 &&
              performanceMetrics.cacheMisses >= performanceMetrics.cacheHits
            );
          },
        },
      ];

      let passed = 0;
      const results = [];

      tests.forEach((test) => {
        try {
          const startTime = window.performance.now();
          const success = test.test();
          const duration = window.performance.now() - startTime;

          if (success) {
            logInfo(`✅ ${test.name}: PASSED (${duration.toFixed(2)}ms)`);
            passed++;
          } else {
            logError(`❌ ${test.name}: FAILED`);
          }

          results.push({ name: test.name, passed: success, duration });
        } catch (error) {
          logError(`❌ ${test.name}: ERROR - ${error.message}`);
          results.push({
            name: test.name,
            passed: false,
            error: error.message,
          });
        }
      });

      const allPassed = passed === tests.length;
      logInfo(`📊 Template Engine Tests: ${passed}/${tests.length} passed`);

      // Show performance report
      const perfReport = this.getPerformanceReport();
      logInfo("📈 Performance Report:", perfReport);

      return {
        success: allPassed,
        passed,
        total: tests.length,
        results,
        performance: perfReport,
      };
    }
  }

  // ===========================================================================================
  // BACKWARD COMPATIBILITY WRAPPER
  // ===========================================================================================

  /**
   * Legacy EnhancedHTMLGenerator class for backward compatibility
   */
  class EnhancedHTMLGenerator {
    constructor() {
      this.engine = new EnhancedTemplateEngine();
      logInfo(
        "✅ Enhanced HTML Template System initialised with caching engine"
      );
    }

    renderTemplate(templateName, data = {}) {
      return this.engine.render(templateName, data); // ✅ FIXED: Use correct method name
    }

    // Legacy methods for backward compatibility
    getFontOptions() {
      const data = this.engine.getDefaultTemplateData("readingToolsSection");
      return data.fontOptions
        .map(
          (opt) =>
            `<option value="${opt.value}"${opt.selected ? " selected" : ""}>${
              opt.label
            }</option>`
        )
        .join("\n");
    }

    getWidthOptions() {
      const data = this.engine.getDefaultTemplateData("readingToolsSection");
      return data.widthOptions
        .map(
          (opt) =>
            `<option value="${opt.value}"${opt.selected ? " selected" : ""}>${
              opt.label
            }</option>`
        )
        .join("\n");
    }

    // ===========================================================================================
    // JAVASCRIPT GENERATION METHODS (for export-manager.js integration)
    // ===========================================================================================

    /**
     * Load JavaScript from external template file
     * @param {string} filename - JavaScript filename (e.g., 'initialization.js')
     * @returns {Promise<string>} JavaScript content
     */
    async loadJavaScriptTemplate(filename) {
      try {
        const response = await fetch(`templates/js/${filename}`);
        if (!response.ok) {
          throw new Error(
            `Failed to load JavaScript template: ${filename} (HTTP ${response.status})`
          );
        }
        const content = await response.text();
        logDebug(
          `✅ Loaded JavaScript template: ${filename} (${content.length} chars)`
        );

        // Add proper indentation for HTML embedding (8 spaces)
        const indentedContent = content
          .split("\n")
          .map((line) => (line.trim() ? "        " + line : line))
          .join("\n");

        return indentedContent;
      } catch (error) {
        logError(`❌ Failed to load JavaScript template ${filename}:`, error);
        throw error; // Re-throw to allow fallback handling
      }
    }

    /**
     * Generate Initialization JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateInitializationJS() {
      // Load JavaScript from external template file - NO FALLBACK
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: initialization.js"
        );
        const javascriptContent = await this.loadJavaScriptTemplate(
          "initialization.js"
        );
        logDebug(
          "✅ JavaScript template loaded successfully, using external file"
        );
        return javascriptContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: JavaScript template loading failed - NO FALLBACK AVAILABLE:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate MathJax Controls JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateMathJaxControlsJS(accessibilityLevel = 1) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: mathjax-controls.js"
        );

        // Load the raw JavaScript template (fix: use this.loadJavaScriptTemplate, not this.engine.loadJavaScriptTemplate)
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "mathjax-controls.js"
        );

        // Apply configuration based on accessibility level
        const config = {
          zoom: "Click",
          zscale: "200%",
          assistiveMathML: true,
          tabNavigation: accessibilityLevel >= 2,
          explorerEnabled: accessibilityLevel >= 2,
        };

        // Process template variables using the engine's render method
        // First, create a temporary template name and store the content
        const tempTemplateName = "mathJaxControlsJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate Reading Tools Setup JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateReadingToolsSetupJS(accessibilityLevel = 1, options = {}) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: reading-tools-setup.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "reading-tools-setup.js"
        );

        // ✅ FIXED: Use centralized accessibility defaults with EXACT template variable names
        const defaults = window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
        const config = {
          // Template expects these EXACT variable names (without double braces)
          fontSize: options.defaultFontSize || defaults.defaultFontSize || 1.0, // ✅ Number, not string
          fontFamily:
            options.defaultFontFamily ||
            defaults.defaultFontFamily ||
            "Verdana, sans-serif",
          readingWidth:
            options.defaultReadingWidth ||
            defaults.defaultReadingWidth ||
            "narrow",
          lineHeight:
            options.defaultLineHeight || defaults.defaultLineHeight || 1.6, // ✅ Number, not string
          paragraphSpacing:
            options.defaultParagraphSpacing ||
            defaults.defaultParagraphSpacing ||
            1.0, // ✅ Number, not string
          advancedControls: accessibilityLevel >= 2,
        };
        // Process template variables using the engine's render method
        const tempTemplateName = "readingToolsSetupJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ Reading Tools Setup JavaScript template loaded and processed successfully with proper variable replacement"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: Reading Tools Setup JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate Theme Management JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateThemeManagementJS(options = {}) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: theme-management.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "theme-management.js"
        );

        // Apply configuration based on options
        const config = {
          defaultTheme: options.defaultTheme || "light",
          enableTransitions: options.enableTransitions !== false,
          respectSystemPreference: options.respectSystemPreference !== false,
        };

        // Process template variables using the engine's render method
        const tempTemplateName = "themeManagementJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ Theme Management JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: Theme Management JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate Form Initialization JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateFormInitializationJS(options = {}) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: form-initialization.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "form-initialization.js"
        );

        // ✅ FIXED: Use centralized accessibility defaults
        const defaults = window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
        const config = {
          defaultFontSize:
            options.defaultFontSize || defaults.defaultFontSize || "1.0",
          defaultFontSizePercent:
            options.defaultFontSizePercent ||
            defaults.defaultFontSizePercent ||
            "100%",
          defaultLineHeight:
            options.defaultLineHeight || defaults.defaultLineHeight || "1.6",
          defaultWordSpacing:
            options.defaultWordSpacing || defaults.defaultWordSpacing || "0",
          defaultReadingWidth:
            options.defaultReadingWidth ||
            defaults.defaultReadingWidth ||
            "narrow", // ✅ FIXED
          defaultZoomLevel:
            options.defaultZoomLevel || defaults.defaultZoomLevel || "1.0",
          enableValidation: options.enableValidation !== false,
          enableAccessibility: options.enableAccessibility !== false,
          enablePreferences: options.enablePreferences !== false,
        };
        // Process template variables using the engine's render method
        const tempTemplateName = "formInitializationJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ Form Initialization JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: Form Initialization JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate Focus Tracking JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateFocusTrackingJS(options = {}) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: focus-tracking.js"
        );

        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "focus-tracking.js"
        );

        const config = {
          enableFocusTracking: options.enableFocusTracking !== false,
          enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
          enableAccessibilityAnnouncements:
            options.enableAccessibilityAnnouncements !== false,
          enableFocusHistory: options.enableFocusHistory !== false,
          enableConsoleCommands: options.enableConsoleCommands !== false,
          commandsDelayMs: options.commandsDelayMs || 100,
        };

        // Process template variables using the engine's render method
        const tempTemplateName = "focusTrackingJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ Focus Tracking JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: Focus Tracking JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }

    /**
     * Generate embedded fonts CSS
     * @param {Object} fontData - Base64 encoded font data (optional override)
     * @returns {Promise<string>} CSS with embedded fonts
     */
    async generateEmbeddedFontsCSS(fontData = {}) {
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
        if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
      }

      function logWarn(message, ...args) {
        if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
      }

      function logInfo(message, ...args) {
        if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
      }

      function logDebug(message, ...args) {
        if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
      }

      try {
        logDebug("🔄 Loading embedded fonts template");

        // Check if template is available
        if (!this.engine.templates.has("embedded-fonts")) {
          logWarn(
            "⚠️ Embedded fonts template not found - graceful degradation"
          );
          return "";
        }

        // Load font data from external files or use provided data
        const resolvedFontData = await this.loadFontData(fontData);

        // ✅ Map AnnotationMonoVF data to template variables
        const templateData = {
          // OpenDyslexic (existing static font - direct mapping)
          base64Regular: resolvedFontData.base64Regular,
          base64Bold: resolvedFontData.base64Bold,
          base64Italic: resolvedFontData.base64Italic,
          base64BoldItalic: resolvedFontData.base64BoldItalic,

          // ✅ AnnotationMonoVF variable font mapping
          fontNameVariableBase64: resolvedFontData.base64AnnotationMonoVF,

          // ✅ Conditional flag for template
          hasFontNameVariable:
            !!resolvedFontData.base64AnnotationMonoVF &&
            resolvedFontData.base64AnnotationMonoVF !==
              "YOUR_BASE64_PLACEHOLDER",
        };

        logDebug("🎨 Template data prepared:", {
          staticFonts: 4,
          variableFonts: templateData.hasFontNameVariable ? 1 : 0,
          annotationMonoVFLength: templateData.fontNameVariableBase64
            ? templateData.fontNameVariableBase64.length
            : 0,
        });

        // Render template with mapped data
        const css = this.engine.render("embedded-fonts", templateData);

        logDebug("✅ Embedded fonts CSS generated successfully");
        logInfo(
          `🎯 Font CSS includes Annotation Mono: ${css.includes(
            "Annotation Mono"
          )}`
        );

        return css;
      } catch (error) {
        logError("❌ Failed to generate embedded fonts CSS:", error.message);
        // Return empty string if fonts fail to load (graceful degradation)
        return "";
      }
    }

    /**
     * Load OpenDyslexic font data from external files
     * @param {Object} overrideFontData - Optional font data to override defaults
     * @returns {Promise<Object>} Font data object with base64 strings
     */
    async loadFontData(overrideFontData = {}) {
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
        if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
      }

      function logWarn(message, ...args) {
        if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
      }

      function logInfo(message, ...args) {
        if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
      }

      function logDebug(message, ...args) {
        if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
      }

      // Font file mapping
      const fontFiles = {
        regular: "fonts/opendyslexic-regular.txt",
        bold: "fonts/opendyslexic-bold.txt",
        italic: "fonts/opendyslexic-italic.txt",
        boldItalic: "fonts/opendyslexic-bold-italic.txt",
        AnnotationMonoVF: "fonts/AnnotationMono-VF.txt",
      };

      const fontData = {};

      // Load each font file
      for (const [variant, filepath] of Object.entries(fontFiles)) {
        try {
          // Use override data if provided
          if (overrideFontData[variant]) {
            fontData[
              `base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`
            ] = overrideFontData[variant];
            logDebug(`✅ Using provided font data for ${variant}`);
            continue;
          }

          // Load from external file
          logDebug(`🔄 Loading font file: ${filepath}`);
          const response = await fetch(filepath);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const base64Data = (await response.text()).trim();
          fontData[
            `base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`
          ] = base64Data;

          logDebug(`✅ Loaded ${variant} font (${base64Data.length} chars)`);
        } catch (error) {
          logWarn(
            `⚠️ Failed to load ${variant} font from ${filepath}:`,
            error.message
          );
          // Fallback to placeholder
          fontData[
            `base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`
          ] = "YOUR_BASE64_PLACEHOLDER";
        }
      }

      logInfo(
        `🎨 Font data loading complete: ${
          Object.keys(fontData).length
        }/4 variants loaded`
      );
      return fontData;
    }

    /**
     * Generate Reading Accessibility Manager Class JavaScript
     * ✅ MIGRATED: Now uses external JavaScript template file
     */
    async generateReadingAccessibilityManagerClassJS(options = {}) {
      try {
        logDebug(
          "🔄 Loading JavaScript from external template: reading-accessibility-manager-class.js"
        );

        // Load the raw JavaScript template
        const rawJavascriptContent = await this.loadJavaScriptTemplate(
          "reading-accessibility-manager-class.js"
        );

        // ✅ FIXED: Use centralized accessibility defaults
        const defaults = window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS || {};
        const config = {
          defaultFontSize:
            options.defaultFontSize || defaults.defaultFontSize || "1.0",
          defaultFontFamily:
            options.defaultFontFamily ||
            defaults.defaultFontFamily ||
            "Verdana, sans-serif",
          defaultReadingWidth:
            options.defaultReadingWidth ||
            defaults.defaultReadingWidth ||
            "narrow", // ✅ FIXED
          defaultLineHeight:
            options.defaultLineHeight || defaults.defaultLineHeight || "1.6",
          defaultParagraphSpacing:
            options.defaultParagraphSpacing ||
            defaults.defaultParagraphSpacing ||
            "1.0",
          enableAdvancedControls: options.enableAdvancedControls !== false,
        };

        // Process template variables using the engine's render method
        const tempTemplateName = "readingAccessibilityManagerClassJS_temp";
        this.engine.templates.set(tempTemplateName, rawJavascriptContent);

        // Use the engine's render method to process variables
        const processedContent = this.engine.render(tempTemplateName, config);

        // Clean up temporary template
        this.engine.templates.delete(tempTemplateName);

        logDebug(
          "✅ Reading Accessibility Manager Class JavaScript template loaded and processed successfully, using external file"
        );
        return processedContent;
      } catch (error) {
        logError(
          "❌ CRITICAL: Reading Accessibility Manager Class JavaScript template loading failed - NO FALLBACK:",
          error.message
        );
        throw new Error(`External template required: ${error.message}`);
      }
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    EnhancedHTMLGenerator,
    EnhancedTemplateEngine,

    // Factory functions
    createGenerator() {
      return new EnhancedHTMLGenerator();
    },

    createEngine() {
      return new EnhancedTemplateEngine();
    },

    // Test function
    test() {
      const engine = new EnhancedTemplateEngine();
      return engine.test();
    },

    // Performance monitoring
    getPerformanceReport() {
      const engine = new EnhancedTemplateEngine();
      return engine.getPerformanceReport();
    },

    // Debug render function for testing
    debugRender(templateName, data = {}) {
      const engine = new EnhancedTemplateEngine();
      return engine.debugRender(templateName, data);
    },

    // Global cache management
    getGlobalCacheStatus() {
      return {
        isLoaded: GlobalTemplateCache.isLoaded,
        loadAttempted: GlobalTemplateCache.loadAttempted,
        templatesCount: GlobalTemplateCache.templates.size,
        templateNames: Array.from(GlobalTemplateCache.templates.keys()),
        loadingInProgress: GlobalTemplateCache.loadingPromise !== null,
      };
    },

    // Memory management
    clearAllCaches() {
      EnhancedTemplateEngine.clearAllCaches();
    },

    // Force global cache reload
    async reloadGlobalCache() {
      GlobalTemplateCache.clearCache();
      return await GlobalTemplateCache.ensureTemplatesLoaded();
    },

    // CRITICAL FIX: Expose GlobalTemplateCache for export-manager.js
    GlobalTemplateCache: GlobalTemplateCache,

    // Convenience method to ensure templates are loaded
    async ensureTemplatesLoaded() {
      return await GlobalTemplateCache.ensureTemplatesLoaded();
    },

    // ===========================================================================================
    // TEST FRAMEWORK COMPATIBILITY FUNCTIONS
    // ===========================================================================================

    /**
     * Validate template system - Test framework compatibility wrapper
     */
    validateTemplateSystem() {
      logInfo("🧪 Running template system validation...");

      try {
        const engine = new EnhancedTemplateEngine();
        const testResults = engine.test();

        const validation = {
          success: testResults.success,
          valid: testResults.success,
          errors: testResults.success
            ? []
            : testResults.results
                .filter((r) => !r.passed)
                .map((r) => r.error || `Test "${r.name}" failed`),
          warnings: [],
          templatesLoaded: engine.templates.size,
          performanceMetrics: engine.getPerformanceReport(),
        };

        logInfo(
          `✅ Template validation complete: ${
            validation.success ? "PASSED" : "FAILED"
          }`
        );
        return validation;
      } catch (error) {
        logError("❌ Template validation failed:", error);
        return {
          success: false,
          valid: false,
          errors: [error.message],
          warnings: ["Template validation encountered an error"],
        };
      }
    },

    /**
     * Measure template performance - Test framework compatibility wrapper
     */
    measureTemplatePerformance() {
      logInfo("📊 Measuring template performance...");

      try {
        const engine = new EnhancedTemplateEngine();
        const perfReport = engine.getPerformanceReport();

        // Parse average render time to get numeric duration
        const avgTimeStr = perfReport.averageRenderTime || "0ms";
        const duration = parseFloat(avgTimeStr.replace("ms", "")) || 0;

        const performanceData = {
          duration: duration,
          efficient: duration < 5.0, // Consider <5ms as efficient
          totalRenders: perfReport.totalRenders || 0,
          averageRenderTime: duration,
          cacheHitRate: parseFloat(
            (perfReport.cacheHitRate || "0%").replace("%", "")
          ),
          templatesLoaded: perfReport.templatesLoaded || 0,
          report: perfReport,
        };

        logInfo(
          `✅ Performance measurement complete: ${duration.toFixed(
            2
          )}ms average`
        );
        return performanceData;
      } catch (error) {
        logError("❌ Performance measurement failed:", error);
        return {
          duration: 999,
          efficient: false,
          error: error.message,
        };
      }
    },
  };
  // Log successful loading
  logInfo("✅ Enhanced Template System loaded successfully");
  logInfo(
    "💡 Commands: TemplateSystem.test() | TemplateSystem.getPerformanceReport()"
  );
  logInfo("📝 Templates use {{variable}} syntax with caching for performance");

  // Return the TemplateSystem for the IIFE
  return TemplateSystem;
})();

// Make globally available AFTER the IIFE completes
window.TemplateSystem = TemplateSystem;

// Also export for ES6 module compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = TemplateSystem;
}

// Auto-run tests in development - with proper template loading wait
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  console.log(
    "🚀 Development mode detected - running template engine tests..."
  );

  // ✅ PHASE 5.6 FIX: Wait for global template cache to be loaded
  async function runDevelopmentTests() {
    if (window.TemplateSystem) {
      try {
        // Wait for global template cache to be loaded
        const cacheStatus = window.TemplateSystem.getGlobalCacheStatus();
        if (!cacheStatus.isLoaded) {
          console.log("⏳ Waiting for template cache to load...");
          await window.TemplateSystem.ensureTemplatesLoaded();
        }

        // Now run tests with templates guaranteed to be loaded
        console.log("✅ Template cache loaded, running development tests...");
        window.TemplateSystem.test();
      } catch (error) {
        console.error("❌ Development test failed:", error.message);
      }
    }
  }

  // Small delay to ensure TemplateSystem is available, then wait for templates
  setTimeout(runDevelopmentTests, 1500);
}
