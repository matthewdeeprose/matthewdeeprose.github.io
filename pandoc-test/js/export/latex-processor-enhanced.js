// latex-processor-enhanced.js
// Enhanced LaTeX Processor - Original Source Method
// STAGE 4: Processes original LaTeX source instead of annotations
// Fixes: Custom commands, align environments, gather environments

const LaTeXProcessorEnhanced = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[LATEX-ENHANCED]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LATEX-ENHANCED]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LATEX-ENHANCED]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LATEX-ENHANCED]", message, ...args);
  }

  // ===========================================================================================
  // MODULE INITIALISATION
  // ===========================================================================================

  logInfo("=== LaTeX Processor Enhanced Module Loading ===");
  logInfo("Enhanced export method ready - processes original source");

  // ===========================================================================================
  // STORAGE FUNCTIONS
  // ===========================================================================================
  // Store and retrieve original LaTeX source for enhanced export

  /**
   * Store original LaTeX source for enhanced export
   * Called by ConversionEngine after successful conversion
   *
   * @param {string} latexSource - Original LaTeX from textarea
   * @returns {boolean} - Success status
   */
  function storeOriginalLatex(latexSource) {
    logDebug("storeOriginalLatex() called");

    try {
      if (!latexSource || typeof latexSource !== "string") {
        logWarn(
          "Invalid LaTeX source provided for storage - must be non-empty string"
        );
        return false;
      }

      if (latexSource.trim().length === 0) {
        logWarn("Empty LaTeX source provided for storage");
        return false;
      }

      // Use protected storage manager if available, fallback to legacy
      if (window.LatexStorageManager) {
        const stored = window.LatexStorageManager.store(latexSource);
        if (stored) {
          logInfo(
            `✅ Stored ${latexSource.length} characters in protected storage`
          );
        } else {
          logWarn(
            "⚠️  Protected storage refused - may be locked or export in progress"
          );
          logWarn("   Falling back to legacy storage");
          // Fallback to legacy storage
          window.lastConvertedLatex = latexSource;
          window.lastConvertedTimestamp = Date.now();
        }
        return stored;
      } else {
        // Legacy fallback if LatexStorageManager not available
        logDebug("LatexStorageManager not available - using legacy storage");
        window.lastConvertedLatex = latexSource;
        window.lastConvertedTimestamp = Date.now();
        logInfo(
          `Stored ${latexSource.length} characters of original LaTeX (legacy)`
        );
        return true;
      }
    } catch (error) {
      logError("Failed to store original LaTeX:", error);
      return false;
    }
  }

  /**
   * Retrieve stored original LaTeX source
   *
   * @returns {string|null} - Stored LaTeX source or null if unavailable
   */
  function getOriginalLatex() {
    logDebug("getOriginalLatex() called");

    try {
      // Use protected storage manager if available
      if (window.LatexStorageManager) {
        const storedLatex = window.LatexStorageManager.get(10); // Max 10 minutes old

        if (!storedLatex) {
          // Check if legacy storage has data as fallback
          if (window.lastConvertedLatex) {
            logWarn(
              "⚠️  Protected storage empty, using legacy storage as fallback"
            );
            const ageSeconds = Math.floor(
              (Date.now() - window.lastConvertedTimestamp) / 1000
            );
            const ageMinutes = Math.floor(ageSeconds / 60);

            if (ageMinutes > 10) {
              logError(
                `❌ Legacy storage is ${ageMinutes} minutes old - too stale to use`
              );
              return null;
            }

            if (ageMinutes > 5) {
              logWarn(
                `⚠️  Legacy storage is ${ageMinutes} minutes old - approaching stale`
              );
            }

            return window.lastConvertedLatex;
          }

          logWarn("No original LaTeX found in storage (protected or legacy)");
          return null;
        }

        return storedLatex;
      } else {
        // Legacy fallback if LatexStorageManager not available
        logDebug("LatexStorageManager not available - using legacy retrieval");

        if (!window.lastConvertedLatex) {
          logWarn("No original LaTeX found in legacy storage");
          return null;
        }

        const storedLatex = window.lastConvertedLatex;
        const timestamp = window.lastConvertedTimestamp;

        if (timestamp) {
          const ageSeconds = Math.floor((Date.now() - timestamp) / 1000);
          const ageMinutes = Math.floor(ageSeconds / 60);
          logDebug(`Retrieved LaTeX stored ${ageSeconds} seconds ago`);

          // Enforce freshness even in legacy mode
          if (ageMinutes > 10) {
            logError(
              `❌ Stored LaTeX is ${ageMinutes} minutes old - too stale to use`
            );
            return null;
          }

          // Warn if approaching stale
          if (ageMinutes > 5) {
            logWarn(
              `⚠️  Stored LaTeX is ${ageMinutes} minutes old - approaching stale threshold`
            );
          }
        }

        logInfo(
          `Retrieved ${storedLatex.length} characters of original LaTeX (legacy)`
        );
        return storedLatex;
      }
    } catch (error) {
      logError("Failed to retrieve original LaTeX:", error);
      return null;
    }
  }
  /**
   * Clear stored original LaTeX source
   * Useful for testing or manual cleanup
   *
   * @returns {boolean} - Success status
   */
  function clearOriginalLatex() {
    logDebug("clearOriginalLatex() called");

    try {
      let clearedCount = 0;

      // Clear protected storage if available
      if (window.LatexStorageManager) {
        const status = window.LatexStorageManager.getStatus();
        if (status.hasData) {
          window.LatexStorageManager.clear(
            "Manual clear via clearOriginalLatex()"
          );
          clearedCount++;
        }
      }

      // Also clear legacy storage
      const hadLegacyLatex = !!window.lastConvertedLatex;
      if (hadLegacyLatex) {
        window.lastConvertedLatex = null;
        window.lastConvertedTimestamp = null;
        clearedCount++;
      }

      if (clearedCount > 0) {
        logInfo(
          `Cleared stored LaTeX source (${clearedCount} storage location${
            clearedCount > 1 ? "s" : ""
          })`
        );
      } else {
        logDebug("No stored LaTeX to clear");
      }

      return true;
    } catch (error) {
      logError("Failed to clear original LaTeX:", error);
      return false;
    }
  }

  /**
   * Validate stored LaTeX and report status
   * Useful for debugging and diagnostics
   * Now checks protected storage first, falls back to legacy
   *
   * @returns {Object} - Validation result with details
   */
  function validateOriginalLatex() {
    logDebug("validateOriginalLatex() called");

    const validation = {
      hasLatex: false,
      hasTimestamp: false,
      length: 0,
      ageSeconds: null,
      isStale: false,
      errors: [],
    };

    try {
      // ✅ NEW: Check protected storage first
      if (window.LatexStorageManager) {
        const status = window.LatexStorageManager.getStatus();

        if (status.hasData) {
          validation.hasLatex = true;
          validation.hasTimestamp = true;
          validation.length = status.contentSize;
          validation.ageSeconds = status.ageSeconds;
          validation.isStale = status.isStale;

          if (status.isStale) {
            validation.errors.push(
              `Protected storage is stale (${status.ageMinutes} minutes old)`
            );
          }

          const statusText = validation.isStale
            ? "❌ INVALID (stale)"
            : "✅ VALID";
          logInfo(`LaTeX validation (protected): ${statusText}`, validation);

          return validation;
        } else {
          logDebug("Protected storage available but no data - checking legacy");
        }
      }

      // Fallback to legacy storage validation
      if (window.lastConvertedLatex) {
        validation.hasLatex = true;
        validation.length = window.lastConvertedLatex.length;
      } else {
        validation.errors.push(
          "No LaTeX source stored (checked both protected and legacy)"
        );
      }

      if (window.lastConvertedTimestamp) {
        validation.hasTimestamp = true;
        validation.ageSeconds = Math.floor(
          (Date.now() - window.lastConvertedTimestamp) / 1000
        );
        validation.isStale = validation.ageSeconds > 300; // 5 minutes

        if (validation.isStale) {
          validation.errors.push(
            `Legacy storage is stale (${Math.floor(
              validation.ageSeconds / 60
            )} minutes old)`
          );
        }
      } else if (validation.hasLatex) {
        validation.errors.push("LaTeX stored but no timestamp");
      }

      const status =
        validation.hasLatex && !validation.isStale ? "✅ VALID" : "❌ INVALID";
      logInfo(`LaTeX validation (legacy): ${status}`, validation);

      return validation;
    } catch (error) {
      logError("Validation failed:", error);
      validation.errors.push(error.message);
      return validation;
    }
  }

  // ===========================================================================================
  // PREAMBLE EXTRACTION
  // ===========================================================================================
  // Extract \newcommand and \renewcommand definitions from LaTeX preamble

  /**
   * Extract \newcommand and \renewcommand definitions from LaTeX preamble
   *
   * Patterns matched:
   * - \newcommand{\R}{\mathbb{R}}
   * - \newcommand{\R}[0]{\mathbb{R}}
   * - \renewcommand{\vec}[1]{\mathbf{#1}}
   *
   * @param {string} latexSource - Original LaTeX source
   * @returns {Array<Object>} - Array of {name, args, definition}
   */
  function extractPreambleCommands(latexSource) {
    logDebug("extractPreambleCommands() called");

    const commands = [];

    try {
      if (!latexSource || typeof latexSource !== "string") {
        logWarn("Invalid LaTeX source provided for command extraction");
        return commands;
      }

      /**
       * Helper function to extract balanced braces content
       * Handles nested braces like \mathbb{R}
       */
      function extractBalancedBraces(str, startPos) {
        let depth = 0;
        let start = -1;

        for (let i = startPos; i < str.length; i++) {
          if (str[i] === "{") {
            if (depth === 0) start = i + 1; // Start after opening brace
            depth++;
          } else if (str[i] === "}") {
            depth--;
            if (depth === 0) {
              return { content: str.substring(start, i), endPos: i };
            }
          }
        }

        return null; // Unbalanced braces
      }

      // Pattern 1: \newcommand{\name}{definition} (no args)
      // Use negative lookahead to avoid matching when [args] follows
      const pattern1 = /\\newcommand\{\\([a-zA-Z]+)\}(?!\[)/g;
      let match;

      while ((match = pattern1.exec(latexSource)) !== null) {
        const name = match[1];
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: 0,
            definition: def.content,
          });
          logDebug(`Found command: \\${name} (0 args) -> ${def.content}`);
        }
      }

      // Pattern 2: \newcommand{\name}[args]{definition}
      const pattern2 = /\\newcommand\{\\([a-zA-Z]+)\}\[(\d+)\]/g;

      while ((match = pattern2.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            definition: def.content,
          });
          logDebug(`Found command: \\${name} (${args} args) -> ${def.content}`);
        }
      }

      // Pattern 3: \newcommand{\name}[args][default]{definition} (optional argument)
      const pattern3 = /\\newcommand\{\\([a-zA-Z]+)\}\[(\d+)\]\[([^\]]+)\]/g;

      while ((match = pattern3.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const defaultArg = match[3]; // Default value for first argument
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            defaultArg: defaultArg,
            definition: def.content,
          });
          logDebug(
            `Found command: \\${name} (${args} args, default: ${defaultArg}) -> ${def.content}`
          );
        }
      }

      // Pattern 4: \renewcommand{\name}{definition} (no args)
      // Use negative lookahead to avoid matching when [args] follows
      const pattern4 = /\\renewcommand\{\\([a-zA-Z]+)\}(?!\[)/g;

      while ((match = pattern4.exec(latexSource)) !== null) {
        const name = match[1];
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: 0,
            definition: def.content,
          });
          logDebug(`Found renewcommand: \\${name} (0 args) -> ${def.content}`);
        }
      }

      // Pattern 5: \renewcommand{\name}[args]{definition}
      const pattern5 = /\\renewcommand\{\\([a-zA-Z]+)\}\[(\d+)\]/g;

      while ((match = pattern5.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            definition: def.content,
          });
          logDebug(
            `Found renewcommand: \\${name} (${args} args) -> ${def.content}`
          );
        }
      }

      // Pattern 6: \renewcommand{\name}[args][default]{definition} (optional argument)
      const pattern6 = /\\renewcommand\{\\([a-zA-Z]+)\}\[(\d+)\]\[([^\]]+)\]/g;

      while ((match = pattern6.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const defaultArg = match[3]; // Default value for first argument
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            defaultArg: defaultArg,
            definition: def.content,
          });
          logDebug(
            `Found renewcommand: \\${name} (${args} args, default: ${defaultArg}) -> ${def.content}`
          );
        }
      }

      // Pattern 7: \DeclareMathOperator{\name}{text}
      // Math operators render in upright text with proper spacing
      const pattern7 = /\\DeclareMathOperator\{\\([a-zA-Z]+)\}\{([^}]+)\}/g;

      while ((match = pattern7.exec(latexSource)) !== null) {
        const name = match[1]; // e.g., "supp"
        const operatorText = match[2]; // e.g., "supp"

        commands.push({
          name: name,
          operator: operatorText, // Mark as operator type
          definition: `\\operatorname{${operatorText}}`,
          args: 0, // Operators don't take arguments in the definition
        });

        logDebug(
          `Found math operator: \\${name} -> \\operatorname{${operatorText}}`
        );
      }

      // Pattern 8: \def\name{definition} (TeX primitive)
      // TeX primitive command definition - common in older LaTeX documents
      const pattern8 = /\\def\\([a-zA-Z]+)/g;

      while ((match = pattern8.exec(latexSource)) !== null) {
        const name = match[1];
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: 0,
            definition: def.content,
          });
          logDebug(`Found TeX primitive: \\${name} (0 args) -> ${def.content}`);
        }
      }

      // Pattern 9: \providecommand{\name}{definition} (no args)
      // Safer version of \newcommand - won't overwrite existing commands
      const pattern9 = /\\providecommand\{\\([a-zA-Z]+)\}(?!\[)/g;

      while ((match = pattern9.exec(latexSource)) !== null) {
        const name = match[1];
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: 0,
            definition: def.content,
          });
          logDebug(
            `Found providecommand: \\${name} (0 args) -> ${def.content}`
          );
        }
      }

      // Pattern 10: \providecommand{\name}[args]{definition}
      // Use negative lookahead to avoid matching when [default] follows
      const pattern10 = /\\providecommand\{\\([a-zA-Z]+)\}\[(\d+)\](?!\[)/g;

      while ((match = pattern10.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            definition: def.content,
          });
          logDebug(
            `Found providecommand: \\${name} (${args} args) -> ${def.content}`
          );
        }
      }

      // Pattern 11: \providecommand{\name}[args][default]{definition} (optional argument)
      const pattern11 =
        /\\providecommand\{\\([a-zA-Z]+)\}\[(\d+)\]\[([^\]]+)\]/g;

      while ((match = pattern11.exec(latexSource)) !== null) {
        const name = match[1];
        const args = parseInt(match[2], 10);
        const defaultArg = match[3];
        const afterMatch = match.index + match[0].length;
        const def = extractBalancedBraces(latexSource, afterMatch);

        if (def) {
          commands.push({
            name: name,
            args: args,
            defaultArg: defaultArg,
            definition: def.content,
          });
          logDebug(
            `Found providecommand: \\${name} (${args} args, default: ${defaultArg}) -> ${def.content}`
          );
        }
      }

      // ===========================================================================================
      // DETECTION PATTERNS (Log but don't convert)
      // ===========================================================================================
      // These commands are detected for user information but not converted to MathJax macros
      // because they define environments, styling, or layout that Pandoc/HTML handles differently

      const detectionStats = {
        theorems: 0,
        styles: 0,
        layout: 0,
        packages: 0,
      };

      // Detect \newtheorem{name}{text} - Environment definitions
      // Example: \newtheorem{theorem}{Theorem}
      const patternTheorem = /\\newtheorem\{([^}]+)\}/g;
      while ((match = patternTheorem.exec(latexSource)) !== null) {
        detectionStats.theorems++;
        logDebug(`Detected theorem environment: ${match[1]} (not converted)`);
      }

      // Detect \theoremstyle{style} - Theorem styling
      // Example: \theoremstyle{remark}
      const patternStyle = /\\theoremstyle\{([^}]+)\}/g;
      while ((match = patternStyle.exec(latexSource)) !== null) {
        detectionStats.styles++;
        logDebug(`Detected theorem style: ${match[1]} (not converted)`);
      }

      // Detect \allowdisplaybreaks - Layout directives
      // Example: \allowdisplaybreaks[1]
      const patternLayout = /\\allowdisplaybreaks/g;
      while ((match = patternLayout.exec(latexSource)) !== null) {
        detectionStats.layout++;
        logDebug(
          `Detected layout directive: allowdisplaybreaks (not converted)`
        );
      }

      // Detect \usepackage{name} - Package loading
      // Example: \usepackage{amsmath}
      const patternPackage = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
      while ((match = patternPackage.exec(latexSource)) !== null) {
        detectionStats.packages++;
        logDebug(`Detected package: ${match[1]} (not converted)`);
      }

      // Log detection summary
      const totalDetected =
        detectionStats.theorems +
        detectionStats.styles +
        detectionStats.layout +
        detectionStats.packages;

      if (totalDetected > 0) {
        logInfo(
          `Detected ${totalDetected} non-convertible command(s): ` +
            `${detectionStats.theorems} theorem(s), ` +
            `${detectionStats.styles} style(s), ` +
            `${detectionStats.layout} layout directive(s), ` +
            `${detectionStats.packages} package(s)`
        );
      }

      logInfo(
        `Extracted ${commands.length} preamble command(s) from LaTeX source`
      );

      return commands;
    } catch (error) {
      logError("Failed to extract preamble commands:", error);
      return commands;
    }
  }

  // ===========================================================================================
  // MACRO CONVERSION
  // ===========================================================================================
  // Convert \newcommand definitions to MathJax macro format

  /**
   * Convert \newcommand definitions to MathJax macro format
   *
   * Input: {name: 'R', args: 0, definition: '\\mathbb{R}'}
   * Output: {R: ['\\mathbb{R}', 0]}
   *
   * @param {Array<Object>} commands - Extracted commands
   * @returns {Object} - MathJax macros object
   */
  function convertCommandsToMacros(commands) {
    logDebug("convertCommandsToMacros() called");

    const macros = {};

    try {
      if (!Array.isArray(commands)) {
        logWarn("Invalid commands array provided for macro conversion");
        return macros;
      }

      commands.forEach((cmd, index) => {
        if (!cmd.name || cmd.definition === undefined) {
          logWarn(`Skipping invalid command at index ${index}:`, cmd);
          return;
        }

        // MathJax macro format:
        // - Math operators: name: [definition] (no argument count needed)
        // - With optional: name: [definition, argCount, defaultValue]
        // - Standard: name: [definition, argCount]
        if (cmd.operator !== undefined) {
          // Math operators: name: ['\\operatorname{text}']
          macros[cmd.name] = [cmd.definition];
          logDebug(
            `Converted operator: \\${cmd.name} -> MathJax macro`,
            macros[cmd.name]
          );
        } else if (cmd.defaultArg !== undefined) {
          // With optional argument: name: [definition, argCount, defaultValue]
          macros[cmd.name] = [cmd.definition, cmd.args || 0, cmd.defaultArg];
          logDebug(
            `Converted: \\${cmd.name} (with default) -> MathJax macro`,
            macros[cmd.name]
          );
        } else {
          // Standard macros: name: [definition, argCount]
          macros[cmd.name] = [cmd.definition, cmd.args || 0];
          logDebug(
            `Converted: \\${cmd.name} -> MathJax macro`,
            macros[cmd.name]
          );
        }
      });

      logInfo(
        `Converted ${Object.keys(macros).length} command(s) to MathJax macros`
      );

      return macros;
    } catch (error) {
      logError("Failed to convert commands to macros:", error);
      return macros;
    }
  }

  // ===========================================================================================
  // MAIN PROCESSING FUNCTION
  // ===========================================================================================
  // Main enhanced processing - replaces LaTeXProcessorLegacy.process()

  /**
   * Main enhanced processing function
   * Replaces LaTeXProcessorLegacy.convertMathJaxToLatex()
   *
   * Process:
   * 1. Get original LaTeX source
   * 2. Extract preamble commands
   * 3. Convert to MathJax macros
   * 4. Process content (annotation-based fallback for now)
   * 5. Return enhanced config with custom macros
   *
   * @param {string} content - HTML content with MathJax
   * @returns {Object|null} - {processedContent, customMacros, metadata} or null on error
   */
  function processForEnhancedExport(content) {
    logInfo("=== ENHANCED EXPORT PROCESSING START ===");

    try {
      // Step 1: Get original source
      const originalLatex = getOriginalLatex();

      if (!originalLatex) {
        logWarn("No original LaTeX found - cannot use enhanced method");
        logWarn("Enhanced export requires stored original LaTeX");
        return null; // Trigger fallback to legacy method
      }

      logInfo("Original LaTeX retrieved successfully");

      // Step 2: Extract preamble commands
      const commands = extractPreambleCommands(originalLatex);

      // ✅ NEW: Validate extraction
      if (commands.length === 0) {
        logInfo("No preamble commands found - no custom macros to inject");
      } else {
        const commandNames = commands.map((cmd) => `\\${cmd.name}`).join(", ");
        logInfo(`Extracted commands: ${commandNames}`);

        // ✅ Check for extraction errors
        const invalidCommands = commands.filter(
          (cmd) => !cmd.name || cmd.definition === undefined
        );
        if (invalidCommands.length > 0) {
          logError(
            `Found ${invalidCommands.length} invalid command(s) - skipping enhanced export`
          );
          logError("Invalid commands:", invalidCommands);
          return null; // Fallback to legacy
        }
      }

      // Step 3: Convert to MathJax macros
      const customMacros = convertCommandsToMacros(commands);

      // ✅ NEW: Validate conversion
      const conversionRate =
        commands.length > 0
          ? (Object.keys(customMacros).length / commands.length) * 100
          : 100;

      if (commands.length > 0 && conversionRate < 100) {
        logWarn(
          `⚠️  Conversion incomplete: ${conversionRate.toFixed(1)}% success`
        );
        logWarn(
          `   Expected ${commands.length} macros, got ${
            Object.keys(customMacros).length
          }`
        );

        // Find which commands failed
        const convertedNames = new Set(Object.keys(customMacros));
        const failedCommands = commands
          .filter((cmd) => !convertedNames.has(cmd.name))
          .map((cmd) => `\\${cmd.name}`);

        if (failedCommands.length > 0) {
          logError(`❌ Failed to convert: ${failedCommands.join(", ")}`);
        }
      }

      // ✅ NEW: Log final macro list for debugging
      if (Object.keys(customMacros).length > 0) {
        logInfo(
          `✅ Successfully converted ${
            Object.keys(customMacros).length
          } MathJax macro(s) for export`
        );
        logDebug("Macro details:", customMacros);

        // Detailed logging of each macro
        Object.keys(customMacros).forEach((name) => {
          logDebug(`   \\${name}: ${JSON.stringify(customMacros[name])}`);
        });
      }

      // Step 4: Convert Pandoc HTML with rendered MathJax back to raw LaTeX delimiters
      // CRITICAL: The 'content' parameter is Pandoc-converted HTML with MathJax SVG
      // We need to convert it back to raw LaTeX so MathJax can re-render with interactivity
      logDebug(
        "Converting Pandoc HTML with rendered MathJax to raw LaTeX delimiters"
      );

      let processedContent = content;

      // Use legacy processor's conversion method to extract LaTeX from rendered MathJax
      if (
        window.LaTeXProcessorLegacy &&
        typeof window.LaTeXProcessorLegacy.convertMathJaxToLatex === "function"
      ) {
        // Clean the Pandoc HTML first
        const cleanedContent = window.LaTeXProcessor.cleanLatexContent(content);

        // Convert rendered MathJax SVG back to raw LaTeX delimiters \(...\) and \[...\]
        processedContent =
          window.LaTeXProcessorLegacy.convertMathJaxToLatex(cleanedContent);

        logInfo(
          `✅ Converted Pandoc HTML to raw LaTeX delimiters: ${processedContent.length} chars`
        );
      } else {
        logWarn(
          "⚠️ LaTeXProcessorLegacy not available - using Pandoc HTML as-is"
        );
        logWarn("MathJax interactivity may not work in exported file");
      }

      // Step 5: Return result with custom macros
      const result = {
        processedContent: processedContent, // Pandoc HTML with raw LaTeX delimiters
        customMacros: customMacros, // Custom macros for MathJax config
        metadata: {
          commandCount: commands.length,
          macroCount: Object.keys(customMacros).length,
          sourceLength: originalLatex.length,
          timestamp: Date.now(),
          method: "enhanced",
        },
      };

      logInfo("=== ENHANCED EXPORT PROCESSING COMPLETE ===");
      logInfo(`Processed with ${result.metadata.macroCount} custom macro(s)`);
      logDebug("Processing result:", result.metadata);

      return result;
    } catch (error) {
      logError("Enhanced processing failed:", error);
      logError("Returning null to trigger fallback to legacy method");
      return null;
    }
  }

  // ===========================================================================================
  // DIAGNOSTICS
  // ===========================================================================================
  // Diagnostic functions for testing and debugging

  /**
   * Get comprehensive diagnostics about module state
   *
   * @returns {Object} - Diagnostic information
   */
  function getDiagnostics() {
    logDebug("getDiagnostics() called");

    const diagnostics = {
      module: "LaTeXProcessorEnhanced",
      version: "1.0.0-stage4b",
      timestamp: new Date().toISOString(),
      capabilities: {
        storeLatex: typeof storeOriginalLatex === "function",
        getLatex: typeof getOriginalLatex === "function",
        clearLatex: typeof clearOriginalLatex === "function",
        extractCommands: typeof extractPreambleCommands === "function",
        convertMacros: typeof convertCommandsToMacros === "function",
        processExport: typeof processForEnhancedExport === "function",
        validate: typeof validateOriginalLatex === "function",
      },
      storage: validateOriginalLatex(),
      status: "operational",
    };

    // Determine overall status
    const allCapabilitiesReady = Object.values(diagnostics.capabilities).every(
      (v) => v === true
    );
    diagnostics.status = allCapabilitiesReady ? "operational" : "degraded";

    logInfo("Diagnostics retrieved:", diagnostics.status.toUpperCase());

    return diagnostics;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  logInfo("Enhanced processor module loaded successfully");

  return {
    // Main processing function (replaces convertMathJaxToLatex)
    process: processForEnhancedExport,

    // Storage functions
    storeOriginalLatex: storeOriginalLatex,
    getOriginalLatex: getOriginalLatex,
    clearOriginalLatex: clearOriginalLatex,

    // Utility functions
    extractPreambleCommands: extractPreambleCommands,
    convertCommandsToMacros: convertCommandsToMacros,

    // Testing/debugging
    validateOriginalLatex: validateOriginalLatex,
    getDiagnostics: getDiagnostics,
  };
})();

// Make globally available for other modules
window.LaTeXProcessorEnhanced = LaTeXProcessorEnhanced;

// Export for module systems (if available)
if (typeof module !== "undefined" && module.exports) {
  module.exports = LaTeXProcessorEnhanced;
}
