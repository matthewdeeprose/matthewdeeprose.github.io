// conversion-engine.js
// LaTeX to HTML Conversion Engine Module
// Handles Pandoc conversion and MathJax rendering integration
// ENHANCED: Now includes robust error handling for complex mathematical documents

const ConversionEngine = (function () {
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
      console.error("[CONVERSION]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[CONVERSION]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[CONVERSION]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[CONVERSION]", message, ...args);
  }

  // ===========================================================================================
  // ENHANCED CONVERSION ENGINE IMPLEMENTATION
  // ===========================================================================================

  /**
   * Enhanced Conversion Engine Manager Class
   * Now includes robust error handling, complexity assessment, and chunked processing
   */
  class ConversionEngineManager {
    constructor() {
      this.pandocFunction = null;
      this.isReady = false;
      this.inputTextarea = null;
      this.outputDiv = null;
      this.argumentsInput = null;
      this.isInitialised = false;
      this.conversionInProgress = false;

      // ENHANCED: Complexity assessment thresholds
      this.maxComplexityScore = 50; // Threshold for chunked processing
      this.maxDocumentLength = 10000; // Characters threshold
      this.defaultTimeout = 10000; // 10 second default timeout
    }

    /**
     * Initialise the conversion engine
     */
    initialise() {
      logInfo("Initialising Enhanced Conversion Engine Manager...");

      try {
        // Get DOM elements
        this.inputTextarea =
          window.appElements?.inputTextarea || document.getElementById("input");
        this.outputDiv =
          window.appElements?.outputDiv || document.getElementById("output");
        this.argumentsInput =
          window.appElements?.argumentsInput ||
          document.getElementById("arguments");

        if (!this.inputTextarea || !this.outputDiv || !this.argumentsInput) {
          throw new Error("Required conversion engine DOM elements not found");
        }

        // Setup event listeners
        this.setupEventListeners();

        this.isInitialised = true;
        logInfo("✅ Enhanced Conversion Engine initialised successfully");

        return true;
      } catch (error) {
        logError("Failed to initialise Enhanced Conversion Engine:", error);
        this.isInitialised = false;
        return false;
      }
    }

    /**
     * Setup event listeners for conversion triggers
     */
    setupEventListeners() {
      logInfo("Setting up conversion engine event listeners...");

      // Input change handler with debouncing
      if (this.inputTextarea) {
        let conversionTimeout;
        this.inputTextarea.addEventListener("input", () => {
          clearTimeout(conversionTimeout);
          conversionTimeout = setTimeout(() => {
            this.convertInput();
          }, 300); // 300ms debounce
        });
      }

      // Arguments change handler
      if (this.argumentsInput) {
        this.argumentsInput.addEventListener("input", () => {
          this.convertInput();
        });
      }

      logInfo("✅ Conversion engine event listeners setup complete");
    }

    /**
     * Set the Pandoc function (called after Pandoc initialisation)
     */
    setPandocFunction(pandocFn) {
      logInfo("Setting Pandoc function...");
      this.pandocFunction = pandocFn;
      this.isReady = true;

      // Enable interface
      if (this.inputTextarea) {
        this.inputTextarea.readOnly = false;
        this.inputTextarea.placeholder =
          "Enter your LaTeX mathematical expressions here...";
      }

      logInfo("✅ Pandoc function set, enhanced conversion engine ready");
    }

    // ===========================================================================================
    // ENHANCED ERROR HANDLING AND COMPLEXITY ASSESSMENT METHODS
    // ===========================================================================================

    /**
     * Assess document complexity to determine processing strategy
     */
    assessDocumentComplexity(content) {
      try {
        const indicators = {
          equations:
            (content.match(/\$.*?\$/g) || []).length +
            (content.match(/\\\[[\s\S]*?\\\]/g) || []).length,
          displayMath: (content.match(/\$\$[\s\S]*?\$\$/g) || []).length,
          matrices: (content.match(/\\begin\{.*?matrix.*?\}/g) || []).length,
          environments: (content.match(/\\begin\{.*?\}/g) || []).length,
          sections:
            (content.match(/\\section\{/g) || []).length +
            (content.match(/\\subsection\{/g) || []).length,
          tables: (content.match(/\\begin\{table.*?\}/g) || []).length,
          figures: (content.match(/\\begin\{figure.*?\}/g) || []).length,
          commands: (content.match(/\\[a-zA-Z]+/g) || []).length,
          length: content.length,
          lineCount: content.split("\n").length,
        };

        // Calculate complexity score with weighted factors
        const complexityScore =
          indicators.equations * 1 +
          indicators.displayMath * 2 +
          indicators.matrices * 5 +
          indicators.environments * 2 +
          indicators.sections * 3 +
          indicators.tables * 3 +
          indicators.figures * 2 +
          indicators.commands * 0.1 +
          Math.floor(indicators.length / 1000) +
          Math.floor(indicators.lineCount / 100);

        const level =
          complexityScore < 10
            ? "basic"
            : complexityScore < 30
            ? "intermediate"
            : complexityScore < 70
            ? "advanced"
            : "complex";

        logInfo(
          `Document complexity assessment: ${level} (score: ${complexityScore.toFixed(
            1
          )})`
        );
        logDebug("Complexity indicators:", indicators);

        return {
          score: complexityScore,
          level: level,
          requiresChunking:
            complexityScore > this.maxComplexityScore ||
            indicators.length > this.maxDocumentLength,
          indicators: indicators,
          estimatedProcessingTime: Math.min(complexityScore * 100, 15000), // ms
        };
      } catch (error) {
        logError("Error assessing document complexity:", error);
        return {
          score: 0,
          level: "unknown",
          requiresChunking: false,
          indicators: {},
          estimatedProcessingTime: 2000,
        };
      }
    }

    /**
     * Handle WebAssembly and Pandoc-specific errors with graceful fallback
     */
    async handleConversionError(error, inputText, argumentsText, attempt = 1) {
      logError(`Conversion error (attempt ${attempt}):`, error);

      const errorMessage = error.message || error.toString();
      const isMemoryError =
        errorMessage.includes("out of memory") ||
        errorMessage.includes("Stack space overflow") ||
        errorMessage.includes("Maximum call stack");
      const isWasmError =
        errorMessage.includes("wasm") ||
        errorMessage.includes("WebAssembly") ||
        errorMessage.includes("trap");
      const isTimeoutError =
        errorMessage.includes("timeout") || errorMessage.includes("Timeout");

      // Attempt recovery strategies
      if (isMemoryError && attempt === 1) {
        logWarn("Memory error detected - attempting chunked processing");
        return await this.processInChunks(inputText, argumentsText);
      }

      if (isWasmError && attempt === 1) {
        logWarn("WebAssembly error detected - attempting simplified arguments");
        const simplifiedArgs = "--from latex --to html5 --mathml";
        return await this.attemptSimplifiedConversion(
          inputText,
          simplifiedArgs
        );
      }

      if (isTimeoutError) {
        logWarn("Timeout error detected - document may be too complex");
      }

      // Generate user-friendly error message
      const userMessage = this.generateUserFriendlyErrorMessage(
        error,
        errorMessage
      );

      this.setErrorOutput(new Error(userMessage));

      if (window.StatusManager) {
        window.StatusManager.setError(`Conversion failed: ${userMessage}`);
      }

      // Announce error to screen readers
      this.announceErrorToScreenReader(userMessage);

      return false;
    }

    /**
     * Generate user-friendly error messages for different error types
     */
    generateUserFriendlyErrorMessage(originalError, errorMessage) {
      if (
        errorMessage.includes("out of memory") ||
        errorMessage.includes("Stack space overflow")
      ) {
        return "Document too complex for processing. Try reducing mathematical content or splitting into smaller sections.";
      }

      if (
        errorMessage.includes("wasm") ||
        errorMessage.includes("WebAssembly")
      ) {
        return "Mathematical processing engine error. Please check LaTeX syntax and try again.";
      }

      if (errorMessage.includes("timeout")) {
        return "Document processing timed out. Document may be too large or complex.";
      }

      if (errorMessage.includes("syntax") || errorMessage.includes("parse")) {
        return "LaTeX syntax error detected. Please check mathematical expressions and commands.";
      }

      if (
        errorMessage.includes("Unknown command") ||
        errorMessage.includes("Undefined control sequence")
      ) {
        return "Unknown LaTeX command found. Please check mathematical expressions and package requirements.";
      }

      return "Conversion failed. Please check LaTeX syntax and try again.";
    }

    /**
     * Process large documents in chunks by sections
     */
    async processInChunks(inputText, argumentsText) {
      logInfo("Processing document in chunks due to complexity");

      try {
        if (window.StatusManager) {
          window.StatusManager.setLoading(
            "Processing complex document in sections...",
            10
          );
        }

        // Split document into logical chunks (by sections)
        const chunks = this.splitDocumentIntoChunks(inputText);
        logInfo(`Document split into ${chunks.length} chunks`);

        const processedChunks = [];
        const totalChunks = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const progress = Math.floor(((i + 1) / totalChunks) * 70) + 15;

          if (window.StatusManager) {
            window.StatusManager.setLoading(
              `Processing section ${i + 1} of ${totalChunks}...`,
              progress
            );
          }

          try {
            // Process chunk with shorter timeout
            const chunkTimeout = 5000; // 5 seconds per chunk
            const chunkPromise = new Promise((resolve, reject) => {
              try {
                const chunkOutput = this.pandocFunction(
                  argumentsText,
                  chunk.content
                );
                resolve(chunkOutput);
              } catch (chunkError) {
                reject(chunkError);
              }
            });

            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Chunk ${i + 1} processing timeout`));
              }, chunkTimeout);
            });

            const chunkOutput = await Promise.race([
              chunkPromise,
              timeoutPromise,
            ]);

            processedChunks.push({
              ...chunk,
              output: this.cleanPandocOutput(chunkOutput),
            });

            // Small delay to prevent overwhelming the system
            await new Promise((resolve) => setTimeout(resolve, 50));
          } catch (chunkError) {
            logWarn(
              `Error processing chunk ${i + 1} (${chunk.title}):`,
              chunkError
            );
            // Include error in output for user awareness
            processedChunks.push({
              ...chunk,
              output: `<div class="error-message"><strong>Error processing section "${
                chunk.title
              }":</strong> ${this.generateUserFriendlyErrorMessage(
                chunkError,
                chunkError.message
              )}</div>`,
            });
          }
        }

        if (window.StatusManager) {
          window.StatusManager.setLoading(
            "Combining processed sections...",
            85
          );
        }

        // Combine processed chunks
        const combinedOutput = processedChunks
          .map((chunk) => chunk.output)
          .join("\n\n");

        if (this.outputDiv) {
          this.outputDiv.innerHTML = combinedOutput;
        }

        if (window.StatusManager) {
          window.StatusManager.setLoading(
            "Rendering mathematical expressions...",
            90
          );
        }

        // Re-render MathJax for combined content
        await this.renderMathJax();

        if (window.StatusManager) {
          window.StatusManager.setReady(
            "Complex document processed successfully!"
          );
        }

        logInfo("✅ Chunked processing completed successfully");
        return true;
      } catch (error) {
        logError("Error in chunked processing:", error);
        return await this.handleConversionError(
          error,
          inputText,
          argumentsText,
          2
        );
      }
    }

    /**
     * Split document into logical chunks for processing with proper LaTeX structure
     */
    splitDocumentIntoChunks(content) {
      try {
        // Extract document preamble (everything before \begin{document})
        const documentMatch = content.match(
          /([\s\S]*?)\\begin\{document\}([\s\S]*?)\\end\{document\}/
        );

        let preamble = "";
        let documentBody = content;
        let hasFullDocument = false;

        if (documentMatch) {
          preamble = documentMatch[1];
          documentBody = documentMatch[2];
          hasFullDocument = true;
          logDebug("Detected full LaTeX document with preamble");
        } else {
          // No full document structure - create minimal preamble
          preamble =
            "\\documentclass{article}\n\\usepackage{amsmath,amssymb,amsthm}\n\\usepackage{geometry}\n";
          logDebug("Creating minimal document preamble for fragments");
        }

        const chunks = [];

        // Try to split by sections first
        const sectionSplits = documentBody.split(/\\section\{/);

        if (sectionSplits.length > 1) {
          // Document has sections - split by sections
          if (sectionSplits[0].trim()) {
            chunks.push({
              type: "preamble",
              content: this.wrapContentInDocument(
                preamble,
                sectionSplits[0],
                true
              ), // Mark as first chunk - INCLUDES title metadata
              title: "Document Introduction",
              rawContent: sectionSplits[0],
            });
          }

          for (let i = 1; i < sectionSplits.length; i++) {
            const sectionContent = "\\section{" + sectionSplits[i];
            const titleMatch = sectionContent.match(/\\section\{([^}]+)\}/);
            const title = titleMatch ? titleMatch[1] : `Section ${i}`;

            const wrappedContent = this.wrapContentInDocument(
              preamble,
              sectionContent,
              false // NOT first chunk - EXCLUDES title metadata
            );

            chunks.push({
              type: "section",
              content: wrappedContent,
              title: title.slice(0, 50),
              rawContent: sectionContent,
            });
          }
        } else {
          // Try to split by subsections
          const subsectionSplits = documentBody.split(/\\subsection\{/);

          if (subsectionSplits.length > 1) {
            if (subsectionSplits[0].trim()) {
              const wrappedContent = this.wrapContentInDocument(
                preamble,
                subsectionSplits[0],
                true // First chunk - INCLUDES title metadata
              );
              chunks.push({
                type: "introduction",
                content: wrappedContent,
                title: "Introduction",
                rawContent: subsectionSplits[0],
              });
            }

            for (let i = 1; i < subsectionSplits.length; i++) {
              const subsectionContent = "\\subsection{" + subsectionSplits[i];
              const titleMatch = subsectionContent.match(
                /\\subsection\{([^}]+)\}/
              );
              const title = titleMatch ? titleMatch[1] : `Subsection ${i}`;

              const wrappedContent = this.wrapContentInDocument(
                preamble,
                subsectionContent,
                false // NOT first chunk - EXCLUDES title metadata
              );

              chunks.push({
                type: "subsection",
                content: wrappedContent,
                title: title.slice(0, 50),
                rawContent: subsectionContent,
              });
            }
          } else {
            // No sections - split by approximate size
            const maxChunkSize = 3000; // characters
            let currentPos = 0;
            let chunkNum = 1;

            while (currentPos < documentBody.length) {
              const chunkEnd = Math.min(
                currentPos + maxChunkSize,
                documentBody.length
              );

              // Try to find a good breaking point (end of paragraph)
              let actualEnd = chunkEnd;
              if (chunkEnd < documentBody.length) {
                const nextParagraphBreak = documentBody.indexOf(
                  "\n\n",
                  chunkEnd - 200
                );
                if (
                  nextParagraphBreak > chunkEnd - 200 &&
                  nextParagraphBreak < chunkEnd + 200
                ) {
                  actualEnd = nextParagraphBreak + 2;
                }
              }

              const chunkContent = documentBody.slice(currentPos, actualEnd);
              const wrappedContent = this.wrapContentInDocument(
                preamble,
                chunkContent,
                chunkNum === 1 // Only first fragment gets title metadata
              );

              chunks.push({
                type: "fragment",
                content: wrappedContent,
                title: `Fragment ${chunkNum}`,
                rawContent: chunkContent,
              });

              currentPos = actualEnd;
              chunkNum++;
            }
          }
        }

        logInfo(
          `Document split strategy: ${chunks[0]?.type}, ${chunks.length} chunks created with proper LaTeX structure`
        );
        return chunks;
      } catch (error) {
        logError("Error splitting document into chunks:", error);
        // Fallback: return entire content as single chunk
        const fallbackContent = this.wrapContentInDocument(
          "\\documentclass{article}\n\\usepackage{amsmath,amssymb,amsthm}\n",
          content,
          true // Fallback is treated as first/only chunk
        );
        return [
          {
            type: "fallback",
            content: fallbackContent,
            title: "Complete Document",
            rawContent: content,
          },
        ];
      }
    }

    /**
     * Wrap content chunk in proper LaTeX document structure
     */
    wrapContentInDocument(preamble, content, isFirstChunk = false) {
      try {
        // Clean the preamble to ensure it doesn't have \begin{document}
        let cleanPreamble = preamble
          .replace(/\\begin\{document\}[\s\S]*$/, "")
          .trim();

        // Remove title metadata from preamble for non-first chunks
        if (!isFirstChunk) {
          cleanPreamble = cleanPreamble
            .replace(/\\title\{[^}]*\}/g, "")
            .replace(/\\author\{[^}]*\}/g, "")
            .replace(/\\date\{[^}]*\}/g, "")
            .replace(/\\maketitle/g, "");
        }

        // Ensure we have a document class
        if (!cleanPreamble.includes("\\documentclass")) {
          cleanPreamble = "\\documentclass{article}\n" + cleanPreamble;
        }

        // Ensure we have essential packages for mathematical content
        if (!cleanPreamble.includes("amsmath")) {
          cleanPreamble += "\n\\usepackage{amsmath,amssymb,amsthm}";
        }

        // Clean the content to remove any document structure commands
        let cleanContent = content
          .replace(/\\documentclass\{[^}]+\}/g, "")
          .replace(/\\usepackage\{[^}]*\}/g, "")
          .replace(/\\begin\{document\}/g, "")
          .replace(/\\end\{document\}/g, "")
          .trim();

        // Remove title commands from content for non-first chunks
        if (!isFirstChunk) {
          cleanContent = cleanContent
            .replace(/\\title\{[^}]*\}/g, "")
            .replace(/\\author\{[^}]*\}/g, "")
            .replace(/\\date\{[^}]*\}/g, "")
            .replace(/\\maketitle/g, "");
        }

        // Wrap in complete document structure
        const wrappedDocument =
          cleanPreamble +
          "\n" +
          "\\begin{document}\n" +
          cleanContent +
          "\n" +
          "\\end{document}";

        return wrappedDocument;
      } catch (error) {
        logError("Error wrapping content in document structure:", error);
        // Return minimal wrapped content as fallback
        return (
          "\\documentclass{article}\n\\usepackage{amsmath,amssymb,amsthm}\n\\begin{document}\n" +
          content +
          "\n\\end{document}"
        );
      }
    }
    /**
     * Attempt simplified conversion with reduced arguments
     */
    async attemptSimplifiedConversion(inputText, simplifiedArgs) {
      logInfo("Attempting simplified conversion with reduced arguments");

      try {
        if (window.StatusManager) {
          window.StatusManager.setLoading(
            "Retrying with simplified processing...",
            50
          );
        }

        // Try with timeout
        const simplifiedPromise = new Promise((resolve, reject) => {
          try {
            const output = this.pandocFunction(simplifiedArgs, inputText);
            resolve(output);
          } catch (simplifiedError) {
            reject(simplifiedError);
          }
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Simplified conversion timeout"));
          }, 8000);
        });

        const output = await Promise.race([simplifiedPromise, timeoutPromise]);
        const cleanOutput = this.cleanPandocOutput(output);

        if (this.outputDiv) {
          this.outputDiv.innerHTML = cleanOutput;
        }

        await this.renderMathJax();

        if (window.StatusManager) {
          window.StatusManager.setReady("✅ Simplified conversion completed");
        }

        logInfo("✅ Simplified conversion successful");
        return true;
      } catch (simplifiedError) {
        logError("Simplified conversion also failed:", simplifiedError);
        return false;
      }
    }

    /**
     * Announce error to screen readers for accessibility
     */
    announceErrorToScreenReader(message) {
      try {
        const announcement = document.createElement("div");
        announcement.className = "sr-only";
        announcement.setAttribute("role", "alert");
        announcement.setAttribute("aria-live", "assertive");
        announcement.textContent = `Conversion error: ${message}`;

        document.body.appendChild(announcement);
        setTimeout(() => {
          if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
          }
        }, 3000);

        logDebug("Error announced to screen readers");
      } catch (error) {
        logError("Failed to announce error to screen readers:", error);
      }
    }

    // ===========================================================================================
    // MAIN CONVERSION METHODS (ENHANCED)
    // ===========================================================================================

    // ===========================================================================================
    // 🧪 PANDOC INVESTIGATION METHODS
    // ===========================================================================================

    /**
     * INVESTIGATION: Enhanced Pandoc argument generation
     * Tests different Pandoc argument combinations to improve HTML output
     */
    generateEnhancedPandocArgs(baseArgs) {
      try {
        const preset = document.getElementById(
          "pandoc-enhancement-preset"
        )?.value;

        if (!preset || preset === "") {
          logDebug("No preset selected, using base arguments");
          return baseArgs;
        }

        const enhancements = this.getEnhancementsByPreset(preset);
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
     * INVESTIGATION: Get enhancement arguments by preset
     * Different presets test various Pandoc capabilities
     */
    getEnhancementsByPreset(preset) {
      const presets = {
        semantic: ["--section-divs", "--html-q-tags", "--wrap=preserve"],
        accessibility: [
          "--section-divs",
          "--id-prefix=content-",
          "--html-q-tags",
          "--number-sections",
        ],
        structure: [
          "--section-divs",
          "--wrap=preserve",
          "--standalone",
          "--toc",
        ],
        theorem: [
          "--section-divs",
          "--wrap=preserve",
          "--html-q-tags",
          "--from=latex+fancy_lists",
        ],
        custom: this.getCustomArguments(),
      };

      const selectedPreset = presets[preset] || presets.semantic;
      logDebug(
        `Selected enhancement preset: ${preset} → ${selectedPreset.join(", ")}`
      );

      return selectedPreset;
    }

    /**
     * INVESTIGATION: Get custom arguments from textarea
     */
    getCustomArguments() {
      try {
        const customArgsTextarea =
          document.getElementById("custom-pandoc-args");
        if (!customArgsTextarea || !customArgsTextarea.value.trim()) {
          logDebug("No custom arguments provided, using default custom preset");
          return [
            "--from=latex+tex_math_dollars+fancy_lists",
            "--section-divs",
            "--html-q-tags",
          ];
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

    /**
     * INVESTIGATION: Handle comparison mode for side-by-side analysis
     * Runs both standard and enhanced conversion for comparison
     */
    async handleComparisonMode(inputText, baseArgumentsText) {
      const showComparison = document.getElementById(
        "pandoc-comparison-mode"
      )?.checked;

      if (!showComparison) {
        logDebug("Comparison mode disabled, using single conversion");
        return null; // Signal to use normal conversion
      }

      logInfo("🔬 Running comparison mode: standard vs enhanced conversion");

      try {
        // Update status for comparison
        if (window.StatusManager) {
          window.StatusManager.setLoading("Running comparison analysis...", 30);
        }

        // Run standard conversion
        logInfo("🧪 Running standard conversion...");
        const standardOutput = this.pandocFunction(
          baseArgumentsText,
          inputText
        );

        // Run enhanced conversion
        logInfo("🧪 Running enhanced conversion...");
        const enhancedArgs = this.generateEnhancedPandocArgs(baseArgumentsText);
        const enhancedOutput = this.pandocFunction(enhancedArgs, inputText);

        // Display comparison
        this.displayComparisonResults(
          standardOutput,
          enhancedOutput,
          baseArgumentsText,
          enhancedArgs
        );

        if (window.StatusManager) {
          window.StatusManager.setReady("🔬 Comparison analysis complete");
        }

        return true; // Signal that comparison was handled
      } catch (error) {
        logError("Error in comparison mode:", error);
        if (window.StatusManager) {
          window.StatusManager.setError("Comparison analysis failed");
        }
        return false;
      }
    }

    /**
     * INVESTIGATION: Display comparison results in enhanced format
     * Shows side-by-side standard vs enhanced output with analysis
     */
    displayComparisonResults(
      standardOutput,
      enhancedOutput,
      standardArgs,
      enhancedArgs
    ) {
      if (!this.outputDiv) return;

      logInfo("📊 Displaying comparison results");

      // Clean both outputs for display
      const cleanStandardOutput = this.cleanPandocOutput(standardOutput);
      const cleanEnhancedOutput = this.cleanPandocOutput(enhancedOutput);

      // Generate analysis
      const analysis = this.generateComparisonAnalysis(
        cleanStandardOutput,
        cleanEnhancedOutput
      );

      this.outputDiv.innerHTML = `
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
                ${this.escapeHtml(standardArgs)}
              </div>
              <div style="border: 1px solid var(--sidebar-border); padding: 1rem; border-radius: 6px; max-height: 400px; overflow-y: auto; background: var(--body-bg);">
                ${cleanStandardOutput}
              </div>
            </div>
            
            <div>
              <h4 style="color: var(--link-color); margin: 0 0 0.75rem 0; font-size: 1rem; border-bottom: 1px solid var(--link-color); padding-bottom: 0.25rem;">
                ✨ Enhanced Conversion
              </h4>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: monospace; background: var(--surface-color); padding: 0.4rem; border-radius: 3px;">
                ${this.escapeHtml(enhancedArgs)}
              </div>
              <div style="border: 2px solid var(--link-color); padding: 1rem; border-radius: 6px; max-height: 400px; overflow-y: auto; background: var(--body-bg);">
                ${cleanEnhancedOutput}
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

      // Re-render MathJax for both outputs
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([this.outputDiv]).catch((error) => {
            logWarn("MathJax rendering failed in comparison view:", error);
          });
        }
      }, 100);
    }

    /**
     * INVESTIGATION: Generate analysis of differences between outputs
     */
    generateComparisonAnalysis(standardOutput, enhancedOutput) {
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
        const direction =
          enhancedLength > standardLength ? "larger" : "smaller";
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
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Convert input using Pandoc with robust error handling and complexity assessment
     * ENHANCED: Now includes memory management, chunked processing, and WebAssembly trap handling
     */
    async convertInput() {
      if (!this.isReady || !this.pandocFunction || this.conversionInProgress) {
        logDebug(
          "Conversion skipped - engine not ready or conversion in progress"
        );
        return;
      }

      const inputText = this.inputTextarea?.value?.trim() || "";
      const argumentsText = this.argumentsInput?.value?.trim() || "";

      logInfo("=== ENHANCED CONVERSION START ===");

      if (!inputText) {
        this.setEmptyOutput();
        return;
      }

      try {
        this.conversionInProgress = true;

        // ENHANCEMENT: Assess document complexity before processing
        const complexity = this.assessDocumentComplexity(inputText);
        logInfo(
          `Document complexity: ${
            complexity.level
          } (score: ${complexity.score.toFixed(1)})`
        );

        // Update status with complexity information
        if (window.StatusManager) {
          const complexityMessage = complexity.requiresChunking
            ? `Processing complex ${complexity.level} document...`
            : `Converting ${complexity.level} document...`;
          window.StatusManager.updateConversionStatus("CONVERT_START", 10);
          window.StatusManager.setLoading(complexityMessage, 15);
        }

        // Small delay to allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 🧪 INVESTIGATION: Check for comparison mode first
        const comparisonResult = await this.handleComparisonMode(
          inputText,
          argumentsText
        );

        if (comparisonResult !== null) {
          // Comparison mode handled the conversion
          logInfo("✅ Comparison mode conversion completed");
          return;
        }

        // ENHANCEMENT: Choose processing strategy based on complexity
        let conversionResult;

        if (complexity.requiresChunking) {
          logInfo("Document requires chunked processing due to complexity");
          conversionResult = await this.processInChunks(
            inputText,
            argumentsText
          );
        } else {
          // Standard processing with enhanced error handling (now supports investigation)
          conversionResult = await this.performStandardConversion(
            inputText,
            argumentsText,
            complexity
          );
        }

        if (conversionResult) {
          logInfo("✅ Enhanced conversion completed successfully");
        }
      } catch (error) {
        logError("Enhanced conversion error:", error);
        await this.handleConversionError(error, inputText, argumentsText);
      } finally {
        this.conversionInProgress = false;
      }
    }

    /**
     * Perform standard conversion with enhanced monitoring and error detection
     * ENHANCED: Now supports investigation mode with enhanced Pandoc arguments
     */
    async performStandardConversion(inputText, baseArgumentsText, complexity) {
      try {
        // 🧪 INVESTIGATION: Check if we should use enhanced arguments
        const finalArgumentsText =
          this.generateEnhancedPandocArgs(baseArgumentsText);

        // Set up timeout based on estimated processing time
        const timeoutMs = Math.max(complexity.estimatedProcessingTime, 5000);
        logDebug(`Setting conversion timeout to ${timeoutMs}ms`);

        if (window.StatusManager) {
          window.StatusManager.updateConversionStatus("CONVERT_MATH", 40);
        }

        // ENHANCEMENT: Wrap Pandoc call with timeout and memory monitoring
        const conversionPromise = new Promise((resolve, reject) => {
          try {
            logInfo("About to call pandocFunction with enhanced monitoring...");
            const startTime = performance.now();

            const output = this.pandocFunction(finalArgumentsText, inputText);

            const endTime = performance.now();
            const processingTime = Math.round(endTime - startTime);
            logInfo(
              `Pandoc conversion complete in ${processingTime}ms, output length: ${output.length}`
            );

            resolve(output);
          } catch (pandocError) {
            logError("Pandoc function error:", pandocError);
            reject(pandocError);
          }
        });

        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Conversion timeout after ${timeoutMs}ms - document may be too complex`
              )
            );
          }, timeoutMs);
        });

        const output = await Promise.race([conversionPromise, timeoutPromise]);

        if (window.StatusManager) {
          window.StatusManager.updateConversionStatus("CONVERT_CLEAN", 70);
        }

        // Clean and process output
        const cleanOutput = this.cleanPandocOutput(output);

        // Set output content
        if (this.outputDiv) {
          this.outputDiv.innerHTML = cleanOutput;
        }

        if (window.StatusManager) {
          window.StatusManager.updateConversionStatus("CONVERT_MATHJAX", 85);
        }

        // Re-render MathJax
        await this.renderMathJax();

        // Final success status
        if (window.StatusManager) {
          const enhancedMode = document.getElementById(
            "pandoc-enhanced-mode"
          )?.checked;
          const successMessage = enhancedMode
            ? `🧪 Enhanced ${complexity.level} document converted! Check output for improvements.`
            : complexity.level === "basic"
            ? " Conversion complete! Ready for export."
            : ` ${complexity.level} document converted successfully! Ready for export.`;
          window.StatusManager.setReady(successMessage);
        }

        return true;
      } catch (standardError) {
        logError("Standard conversion failed:", standardError);
        throw standardError; // Will be caught by main convertInput method
      }
    }

    // ===========================================================================================
    // EXISTING UTILITY METHODS (PRESERVED)
    // ===========================================================================================

    /**
     * Clean Pandoc output for display
     * ENHANCED: Now removes duplicate title blocks from chunked processing
     */
    cleanPandocOutput(output) {
      let cleanOutput = output;

      // Extract only the body content if Pandoc generated a complete HTML document
      if (output.includes("<html") && output.includes("<body")) {
        const bodyMatch = output.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          cleanOutput = bodyMatch[1];
          logInfo("Extracted body content from complete HTML document");
        }
      } else if (output.includes("<head>") || output.includes("<meta")) {
        // Remove any head elements that might have been included
        cleanOutput = output
          .replace(/<head[\s\S]*?<\/head>/gi, "")
          .replace(/<meta[^>]*>/gi, "")
          .replace(/<link[^>]*>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "");
        logInfo("Cleaned HTML output of head elements");
      }

      // ENHANCEMENT: Remove duplicate title blocks (fixes chunked processing issue)
      const titleBlockRegex =
        /<header id="title-block-header">[\s\S]*?<\/header>/g;
      const titleBlocks = cleanOutput.match(titleBlockRegex);

      if (titleBlocks && titleBlocks.length > 1) {
        logInfo(
          `Removing ${
            titleBlocks.length - 1
          } duplicate title blocks from chunked processing`
        );

        // Keep the first title block, remove all others
        const firstTitleBlock = titleBlocks[0];
        cleanOutput = cleanOutput.replace(titleBlockRegex, "");

        // Add the first title block back at the beginning
        cleanOutput = firstTitleBlock + "\n" + cleanOutput;

        logInfo("✅ Duplicate title blocks removed successfully");
      }

      return cleanOutput.trim();
    }

    /**
     * Render MathJax on the output
     */
    async renderMathJax() {
      if (
        !window.MathJax ||
        !window.MathJax.typesetPromise ||
        !this.outputDiv
      ) {
        logWarn("MathJax not available for rendering");
        return;
      }

      try {
        logInfo("Starting MathJax typeset...");

        if (window.StatusManager) {
          window.StatusManager.updateConversionStatus("CONVERT_MATHJAX", 90);
        }

        await window.MathJax.typesetPromise([this.outputDiv]);
        logInfo("✅ MathJax typeset complete");
      } catch (error) {
        logError("MathJax rendering error:", error);
        // Don't throw - conversion can continue without MathJax
      }
    }

    /**
     * Set empty output message
     */
    setEmptyOutput() {
      if (this.outputDiv) {
        this.outputDiv.innerHTML =
          "<p><em>Enter some LaTeX content to see the conversion...</em></p>";
      }
    }

    /**
     * Set error output
     */
    setErrorOutput(error) {
      if (this.outputDiv) {
        this.outputDiv.innerHTML = `
          <div class="error-message">
            <strong>Conversion Error:</strong> ${error.message || error}
          </div>`;
      }
    }

    // ===========================================================================================
    // PUBLIC API METHODS (PRESERVED)
    // ===========================================================================================

    /**
     * Get current output content
     */
    getCurrentOutput() {
      return this.outputDiv?.innerHTML || "";
    }

    /**
     * Get current input content
     */
    getCurrentInput() {
      return this.inputTextarea?.value || "";
    }

    /**
     * Set input content (programmatically)
     */
    setInputContent(content) {
      if (this.inputTextarea) {
        this.inputTextarea.value = content;
        // Trigger conversion
        this.convertInput();
      }
    }

    /**
     * Clear all content
     */
    clearContent() {
      if (this.inputTextarea) {
        this.inputTextarea.value = "";
      }
      this.setEmptyOutput();
    }

    /**
     * Check if conversion engine is ready
     */
    isEngineReady() {
      return this.isReady && this.pandocFunction !== null;
    }

    /**
     * Get conversion engine status with enhanced information
     */
    getEngineStatus() {
      return {
        initialised: this.isInitialised,
        ready: this.isReady,
        pandocAvailable: !!this.pandocFunction,
        conversionInProgress: this.conversionInProgress,
        hasInput: !!this.inputTextarea?.value?.trim(),
        hasOutput: !!this.outputDiv?.innerHTML?.trim(),
        enhancedErrorHandling: true, // New feature flag
        complexityAssessment: true, // New feature flag
        chunkedProcessing: true, // New feature flag
      };
    }
  }

  // ===========================================================================================
  // CONVERSION ENGINE INSTANCE MANAGEMENT
  // ===========================================================================================

  // Create single instance
  const conversionManager = new ConversionEngineManager();

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Enhanced test conversion engine functionality
   */
  function testConversionEngine() {
    logInfo("🧪 Testing Enhanced Conversion Engine...");

    const tests = {
      managerExists: () => !!conversionManager,

      initialisation: () => conversionManager.isInitialised,

      domElementsConnected: () => {
        return (
          !!document.getElementById("input") &&
          !!document.getElementById("output") &&
          !!document.getElementById("arguments")
        );
      },

      pandocFunction: () => !!conversionManager.pandocFunction,

      engineReady: () => conversionManager.isEngineReady(),

      inputOutput: () => {
        const input = conversionManager.getCurrentInput();
        const output = conversionManager.getCurrentOutput();
        return typeof input === "string" && typeof output === "string";
      },

      contentManagement: () => {
        const originalInput = conversionManager.getCurrentInput();
        conversionManager.setInputContent("Test content");
        const newInput = conversionManager.getCurrentInput();
        conversionManager.setInputContent(originalInput); // Restore
        return newInput === "Test content";
      },

      // ENHANCED TESTS: New functionality validation
      complexityAssessment: () => {
        const testContent = "Test content with $x = 1$ and $$y = 2$$";
        const complexity =
          conversionManager.assessDocumentComplexity(testContent);
        return (
          complexity && typeof complexity.score === "number" && complexity.level
        );
      },

      errorHandling: () => {
        const errorMessage = conversionManager.generateUserFriendlyErrorMessage(
          new Error("out of memory"),
          "out of memory"
        );
        return errorMessage.includes("too complex");
      },

      enhancedStatus: () => {
        const status = conversionManager.getEngineStatus();
        return status.enhancedErrorHandling && status.complexityAssessment;
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 Enhanced Conversion Engine: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      status: conversionManager.getEngineStatus(),
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Manager instance
    manager: conversionManager,

    // Core functionality
    initialise() {
      return conversionManager.initialise();
    },

    setPandocFunction(pandocFn) {
      return conversionManager.setPandocFunction(pandocFn);
    },

    convertInput() {
      return conversionManager.convertInput();
    },

    // Content management
    getCurrentOutput() {
      return conversionManager.getCurrentOutput();
    },

    getCurrentInput() {
      return conversionManager.getCurrentInput();
    },

    setInputContent(content) {
      return conversionManager.setInputContent(content);
    },

    clearContent() {
      return conversionManager.clearContent();
    },

    // Status
    isEngineReady() {
      return conversionManager.isEngineReady();
    },

    getEngineStatus() {
      return conversionManager.getEngineStatus();
    },

    // ENHANCED: New API methods
    assessDocumentComplexity(content) {
      return conversionManager.assessDocumentComplexity(content);
    },

    // 🧪 INVESTIGATION: Enhanced Pandoc methods for export integration
    generateEnhancedPandocArgs(baseArgs) {
      return conversionManager.generateEnhancedPandocArgs(baseArgs);
    },

    getEnhancementsByPreset(preset) {
      return conversionManager.getEnhancementsByPreset(preset);
    },

    cleanPandocOutput(output) {
      return conversionManager.cleanPandocOutput(output);
    },

    // Direct Pandoc function access for enhanced exports
    pandocFunction(args, input) {
      if (!conversionManager.pandocFunction) {
        throw new Error(
          "Pandoc function not available - WebAssembly not initialized"
        );
      }
      return conversionManager.pandocFunction(args, input);
    },

    // Testing
    testConversionEngine,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.ConversionEngine = ConversionEngine;
