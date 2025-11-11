// chunked-processing-engine.js
// Chunked Processing Engine - Handles complex document processing via document splitting and chunk coordination
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 5

const ChunkedProcessingEngine = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger(
    "CHUNKED_PROCESSING",
    {
      level: window.LoggingSystem.LOG_LEVELS.INFO,
    }
  ) || {
    logError: console.error.bind(console, "[CHUNKED_PROCESSING]"),
    logWarn: console.warn.bind(console, "[CHUNKED_PROCESSING]"),
    logInfo: console.log.bind(console, "[CHUNKED_PROCESSING]"),
    logDebug: console.log.bind(console, "[CHUNKED_PROCESSING]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // CHUNKED PROCESSING CONFIGURATION
  // ===========================================================================================

  const CHUNKED_CONFIG = {
    maxChunkSize: 3000, // characters per chunk for size-based splitting
    chunkTimeout: 5000, // 5 seconds per chunk
    processingDelay: 50, // ms delay between chunks to prevent system overwhelming

    // Document structure detection patterns
    patterns: {
      sections: /\\section\{/g,
      subsections: /\\subsection\{/g,
      documentBegin: /\\begin\{document\}/,
      documentEnd: /\\end\{document\}/,
      preambleEnd: /([\s\S]*?)\\begin\{document\}([\s\S]*?)\\end\{document\}/,
      paragraphBreak: /\n\n/g,
    },
  };

  // ===========================================================================================
  // MAIN CHUNKED PROCESSING METHOD
  // ===========================================================================================

  /**
   * Process large or complex documents in chunks to avoid timeouts
   * ENHANCED: Now includes LaTeX preservation for chunked processing
   * CORE FEATURE: Complex document processing with LaTeX preservation integration
   */
  async function processInChunks(
    inputText,
    argumentsText,
    pandocFunction,
    options = {}
  ) {
    try {
      logInfo("Starting chunked processing for complex document...");

      if (!pandocFunction || typeof pandocFunction !== "function") {
        throw new Error("Pandoc function not provided for chunked processing");
      }

      // Set chunked processing flag to optimize cross-reference timing
      window.ChunkedProcessingEngine.isProcessing = true;

      // PHASE 1F PART C: Reset MathJax equation counter BEFORE processing
      // This ensures numbering starts from (1) for each new document
      if (window.MathJaxManagerInstance?.resetEquationCounter) {
        try {
          window.MathJaxManagerInstance.resetEquationCounter();
          logInfo("✅ Reset MathJax equation counter for new document");
        } catch (resetError) {
          logWarn("⚠️ Failed to reset equation counter:", resetError);
        }
      } else {
        logDebug("MathJax counter reset not available");
      }

      // PHASE 1F PART C: Register environments BEFORE processing
      // This ensures the registry has data for environment restoration
      if (window.MathJaxManagerInstance?.registerSourceEnvironments) {
        try {
          const envCount =
            window.MathJaxManagerInstance.registerSourceEnvironments(inputText);
          logInfo(
            `✅ Registered ${envCount} environments before chunked processing`
          );
        } catch (registryError) {
          logWarn("⚠️ Failed to register environments:", registryError);
        }
      } else {
        logDebug("Environment registration not available");
      }

      // Update status if StatusManager available
      if (window.StatusManager) {
        window.StatusManager.setLoading("Analysing document structure...", 25);
      }

      // BREAKTHROUGH: Extract and preserve original LaTeX for chunked processing
      logInfo(
        "🔍 Extracting original LaTeX expressions for chunked processing..."
      );
      const originalLatexMap = extractLatexForChunkedProcessing(inputText);
      const orderedExpressions = orderLatexExpressions(originalLatexMap);

      // Store in global registries using LatexRegistryManager
      storeLatexInGlobalRegistries(originalLatexMap, orderedExpressions);

      logInfo(
        `✅ Preserved ${orderedExpressions.length} original LaTeX expressions for chunked processing`
      );

      // Split document into logical chunks
      const chunks = splitDocumentIntoChunks(inputText);
      logInfo(`Document split into ${chunks.length} chunks for processing`);

      const processedChunks = [];
      const totalChunks = chunks.length;

      // Process each chunk with timeout and error handling
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
          const processedChunk = await processIndividualChunk(
            chunk,
            argumentsText,
            pandocFunction,
            i + 1
          );
          processedChunks.push(processedChunk);

          // Small delay to prevent overwhelming the system
          await new Promise((resolve) =>
            setTimeout(resolve, CHUNKED_CONFIG.processingDelay)
          );
        } catch (chunkError) {
          logWarn(
            `Error processing chunk ${i + 1} (${chunk.title}):`,
            chunkError
          );

          // Include error in output for user awareness
          const errorChunk = createErrorChunk(chunk, chunkError, i + 1);
          processedChunks.push(errorChunk);
        }
      }

      if (window.StatusManager) {
        window.StatusManager.setLoading("Combining processed sections...", 85);
      }

      // Combine processed chunks
      let combinedOutput = combineProcessedChunks(
        processedChunks,
        argumentsText,
        inputText
      );

      // PHASE 1F PART B FIX: Restore environment wrappers after combining chunks
      // Pandoc converts align->aligned, gather->gathered which prevents numbering
      // This restoration ensures MathJax can number equations correctly
      if (window.MathJaxManagerInstance?.restoreEnvironmentWrappersInHTML) {
        try {
          const restoredOutput =
            window.MathJaxManagerInstance.restoreEnvironmentWrappersInHTML(
              combinedOutput
            );
          logInfo(
            "✅ Restored environment wrappers in chunked output for playground numbering"
          );
          combinedOutput = restoredOutput;
        } catch (restoreError) {
          logWarn(
            "⚠️ Failed to restore environment wrappers in chunked output:",
            restoreError
          );
          // Non-critical - use original combined output
        }
      } else {
        logDebug(
          "Environment restoration not available - numbering may not work"
        );
      }

      logInfo("✅ Chunked processing completed successfully");
      return {
        success: true,
        output: combinedOutput,
        chunksProcessed: totalChunks,
        chunksSucceeded: processedChunks.filter((chunk) => !chunk.hasError)
          .length,
        chunksFailed: processedChunks.filter((chunk) => chunk.hasError).length,
      };
    } catch (error) {
      logError("Error in chunked processing:", error);
      return {
        success: false,
        error: error.message,
        output: null,
      };
    }
  }

  // ===========================================================================================
  // DOCUMENT SPLITTING METHODS
  // ===========================================================================================

  /**
   * Split document into logical chunks for processing with proper LaTeX structure
   * CORE FEATURE: Intelligent document structure analysis and splitting
   */
  function splitDocumentIntoChunks(content) {
    try {
      logDebug("Splitting document into processing chunks...");

      // Extract document preamble (everything before \begin{document})
      const documentMatch = content.match(CHUNKED_CONFIG.patterns.preambleEnd);

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

      // Strategy 1: Try to split by sections
      const sectionSplits = documentBody.split(
        CHUNKED_CONFIG.patterns.sections
      );

      if (sectionSplits.length > 1) {
        chunks.push(...createSectionBasedChunks(sectionSplits, preamble));
      } else {
        // Strategy 2: Try to split by subsections
        const subsectionSplits = documentBody.split(
          CHUNKED_CONFIG.patterns.subsections
        );

        if (subsectionSplits.length > 1) {
          chunks.push(
            ...createSubsectionBasedChunks(subsectionSplits, preamble)
          );
        } else {
          // Strategy 3: Split by approximate size
          chunks.push(...createSizeBasedChunks(documentBody, preamble));
        }
      }

      logInfo(
        `Document splitting strategy: ${chunks[0]?.type}, ${chunks.length} chunks created`
      );
      return chunks;
    } catch (error) {
      logError("Error splitting document into chunks:", error);
      // Fallback: return entire content as single chunk
      return createFallbackChunk(content);
    }
  }

  /**
   * Create chunks based on section divisions
   */
  function createSectionBasedChunks(sectionSplits, preamble) {
    const chunks = [];

    // Handle content before first section
    if (sectionSplits[0].trim()) {
      const introChunk = {
        type: "preamble",
        content: wrapContentInDocument(preamble, sectionSplits[0], true), // First chunk includes title metadata
        title: "Document Introduction",
        rawContent: sectionSplits[0],
      };
      chunks.push(introChunk);
    }

    // Process each section
    for (let i = 1; i < sectionSplits.length; i++) {
      const sectionContent = "\\section{" + sectionSplits[i];
      const titleMatch = sectionContent.match(/\\section\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : `Section ${i}`;

      const sectionChunk = {
        type: "section",
        content: wrapContentInDocument(preamble, sectionContent, false), // Not first chunk
        title: title.slice(0, 50), // Truncate long titles
        rawContent: sectionContent,
      };
      chunks.push(sectionChunk);
    }

    return chunks;
  }

  /**
   * Create chunks based on subsection divisions
   */
  function createSubsectionBasedChunks(subsectionSplits, preamble) {
    const chunks = [];

    // Handle content before first subsection
    if (subsectionSplits[0].trim()) {
      const introChunk = {
        type: "introduction",
        content: wrapContentInDocument(preamble, subsectionSplits[0], true), // First chunk
        title: "Introduction",
        rawContent: subsectionSplits[0],
      };
      chunks.push(introChunk);
    }

    // Process each subsection
    for (let i = 1; i < subsectionSplits.length; i++) {
      const subsectionContent = "\\subsection{" + subsectionSplits[i];
      const titleMatch = subsectionContent.match(/\\subsection\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : `Subsection ${i}`;

      const subsectionChunk = {
        type: "subsection",
        content: wrapContentInDocument(preamble, subsectionContent, false), // Not first chunk
        title: title.slice(0, 50),
        rawContent: subsectionContent,
      };
      chunks.push(subsectionChunk);
    }

    return chunks;
  }

  /**
   * Create chunks based on document size
   */
  function createSizeBasedChunks(documentBody, preamble) {
    const chunks = [];
    let currentPos = 0;
    let chunkNum = 1;

    while (currentPos < documentBody.length) {
      const chunkEnd = Math.min(
        currentPos + CHUNKED_CONFIG.maxChunkSize,
        documentBody.length
      );

      // Try to find a good breaking point (end of paragraph)
      let actualEnd = chunkEnd;
      if (chunkEnd < documentBody.length) {
        const nextParagraphBreak = documentBody.indexOf("\n\n", chunkEnd - 200);
        if (
          nextParagraphBreak > chunkEnd - 200 &&
          nextParagraphBreak < chunkEnd + 200
        ) {
          actualEnd = nextParagraphBreak + 2;
        }
      }

      const chunkContent = documentBody.slice(currentPos, actualEnd);
      const sizeChunk = {
        type: "fragment",
        content: wrapContentInDocument(preamble, chunkContent, chunkNum === 1), // Only first fragment gets title
        title: `Fragment ${chunkNum}`,
        rawContent: chunkContent,
      };
      chunks.push(sizeChunk);

      currentPos = actualEnd;
      chunkNum++;
    }

    return chunks;
  }

  /**
   * Create fallback chunk for error cases
   */
  function createFallbackChunk(content) {
    const fallbackContent = wrapContentInDocument(
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

  // ===========================================================================================
  // CHUNK PROCESSING METHODS
  // ===========================================================================================

  /**
   * Process an individual chunk with timeout and error handling
   */
  async function processIndividualChunk(
    chunk,
    argumentsText,
    pandocFunction,
    chunkNumber
  ) {
    try {
      logDebug(`Processing chunk ${chunkNumber}: ${chunk.title}`);

      // SECTION NUMBERING FIX: Remove --number-sections from individual chunks
      // We'll add numbering after combining all chunks
      const chunkArgs = argumentsText.includes("--number-sections")
        ? argumentsText.replace(/--number-sections\s*/g, "").trim()
        : argumentsText;

      // Create timeout-wrapped processing promise
      const chunkPromise = new Promise((resolve, reject) => {
        try {
          const chunkOutput = pandocFunction(chunkArgs, chunk.content);
          resolve(chunkOutput);
        } catch (chunkError) {
          reject(chunkError);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Chunk ${chunkNumber} processing timeout`));
        }, CHUNKED_CONFIG.chunkTimeout);
      });

      const chunkOutput = await Promise.race([chunkPromise, timeoutPromise]);

      // Clean output using OutputCleaner utility if available
      const cleanedOutput = window.OutputCleaner
        ? window.OutputCleaner.cleanPandocOutput(chunkOutput)
        : chunkOutput.trim();

      return {
        ...chunk,
        output: cleanedOutput,
        hasError: false,
        processedAt: Date.now(),
      };
    } catch (chunkError) {
      logError(`Error processing individual chunk ${chunkNumber}:`, chunkError);
      throw chunkError; // Re-throw to be handled by main processing loop
    }
  }

  /**
   * Create error chunk for failed processing
   */
  function createErrorChunk(chunk, error, chunkNumber) {
    const userFriendlyError = generateUserFriendlyChunkError(
      error,
      chunkNumber
    );

    return {
      ...chunk,
      output: `<div class="error-message"><strong>Error processing section "${chunk.title}":</strong> ${userFriendlyError}</div>`,
      hasError: true,
      error: error.message,
      processedAt: Date.now(),
    };
  }

  /**
   * Generate user-friendly error messages for chunk processing failures
   */
  function generateUserFriendlyChunkError(error, chunkNumber) {
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes("timeout")) {
      return `Section ${chunkNumber} processing timed out. This section may be too complex.`;
    }

    if (
      errorMessage.includes("memory") ||
      errorMessage.includes("Stack space")
    ) {
      return `Section ${chunkNumber} requires too much memory. Try simplifying mathematical expressions.`;
    }

    if (errorMessage.includes("syntax") || errorMessage.includes("parse")) {
      return `LaTeX syntax error in section ${chunkNumber}. Please check mathematical expressions.`;
    }

    return `Processing error in section ${chunkNumber}. Please check content and try again.`;
  }

  // ===========================================================================================
  // CHUNK COMBINATION METHODS
  // ===========================================================================================

  /**
   * Combine processed chunks into final output
   */
  function combineProcessedChunks(
    processedChunks,
    argumentsText,
    originalLatexInput
  ) {
    try {
      logDebug("Combining processed chunks...");

      // Extract outputs from successful chunks
      let combinedOutput = processedChunks
        .map((chunk) => chunk.output)
        .join("\n\n");

      // SECTION NUMBERING FIX: Add sequential numbering after combining chunks
      if (argumentsText.includes("--number-sections")) {
        combinedOutput = addSequentialSectionNumbering(combinedOutput);
        logInfo("✅ Applied sequential section numbering to combined chunks");
      }

      // OPTIMIZATION: Clear chunked processing flag before cross-reference fixing
      window.ChunkedProcessingEngine.isProcessing = false;

      // POST-ASSEMBLY CROSS-REFERENCE FIXING: Now fix all cross-references after chunks are combined
      if (window.OutputCleaner) {
        logInfo("🔗 Performing post-assembly cross-reference fixing...");
        const finalOutput = window.OutputCleaner.cleanPandocOutput(
          combinedOutput,
          originalLatexInput
        );

        if (finalOutput !== combinedOutput) {
          logInfo(
            "✅ Post-assembly cross-reference fixing completed successfully"
          );
          return finalOutput;
        } else {
          logDebug("No cross-references needed fixing in combined document");
        }
      }

      return combinedOutput;
    } catch (error) {
      logError("Error combining processed chunks:", error);
      // Ensure processing flag is cleared even on error
      window.ChunkedProcessingEngine.isProcessing = false;
      // Fallback: join with basic separator
      return processedChunks
        .map(
          (chunk) => chunk.output || `<p>Error processing: ${chunk.title}</p>`
        )
        .join("\n\n");
    }
  }

  /**
   * Add sequential section numbering to combined HTML output
   * This fixes numbering when chunks were processed separately
   */
  function addSequentialSectionNumbering(htmlContent) {
    try {
      logDebug("Adding sequential section numbering...");

      // Create a temporary div to parse and manipulate the HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;

      // Find all heading elements (h1-h6)
      const headings = tempDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");

      // Track section numbers at each level
      const sectionNumbers = [0, 0, 0, 0, 0, 0]; // h1, h2, h3, h4, h5, h6

      let foundFirstTitle = false;

      headings.forEach((heading) => {
        const level = parseInt(heading.tagName.charAt(1)) - 1; // h1=0, h2=1, etc.

        // Skip only the very first h1 if it appears to be a document title
        if (level === 0 && !foundFirstTitle) {
          const headingText = heading.textContent.trim();
          // Check if this looks like a document title vs a section
          const looksLikeTitle =
            headingText.length > 30 ||
            headingText.toLowerCase().includes("test") ||
            headingText.toLowerCase().includes("document") ||
            headingText.toLowerCase().includes("manual") ||
            headingText.toLowerCase().includes("guide");

          if (looksLikeTitle) {
            foundFirstTitle = true;
            return; // Skip numbering this one
          }
        }

        // Increment current level and reset deeper levels
        sectionNumbers[level]++;
        for (let i = level + 1; i < 6; i++) {
          sectionNumbers[i] = 0;
        }

        // Build the section number string
        let numberString = "";
        for (let i = 0; i <= level; i++) {
          if (sectionNumbers[i] > 0) {
            numberString += (numberString ? "." : "") + sectionNumbers[i];
          }
        }

        // Remove any existing numbering from the heading text
        let cleanText = heading.textContent.replace(/^[\d\.\s]+/, "").trim();

        // Add the new numbering
        if (numberString) {
          heading.textContent = numberString + " " + cleanText;
        }
      });

      return tempDiv.innerHTML;
    } catch (error) {
      logError("Error adding sequential section numbering:", error);
      return htmlContent; // Return original on error
    }
  }

  // ===========================================================================================
  // LATEX PRESERVATION FOR CHUNKED PROCESSING
  // ===========================================================================================

  /**
   * Extract LaTeX expressions for chunked processing preservation
   */
  function extractLatexForChunkedProcessing(inputText) {
    if (window.LatexPreservationEngine) {
      return window.LatexPreservationEngine.extractAndMapLatexExpressions(
        inputText
      );
    } else {
      logWarn(
        "LatexPreservationEngine not available - using fallback extraction for chunked processing"
      );
      return fallbackLatexExtraction(inputText);
    }
  }

  /**
   * Order LaTeX expressions by position
   */
  function orderLatexExpressions(latexMap) {
    if (window.LatexExpressionMapper) {
      return window.LatexExpressionMapper.orderExpressionsByPosition(latexMap);
    } else {
      logWarn("LatexExpressionMapper not available - using fallback ordering");
      return Object.values(latexMap).sort((a, b) => a.position - b.position);
    }
  }

  /**
   * Store LaTeX in global registries
   */
  function storeLatexInGlobalRegistries(latexMap, orderedExpressions) {
    if (window.LatexRegistryManager) {
      window.LatexRegistryManager.storeInGlobalRegistries(
        latexMap,
        orderedExpressions
      );
    } else {
      logWarn(
        "LatexRegistryManager not available - using fallback registry storage"
      );
      window.originalLatexRegistry = latexMap;
      window.originalLatexByPosition = orderedExpressions.map(
        (expr) => expr.latex
      );
    }
  }

  /**
   * Fallback LaTeX extraction for chunked processing
   */
  function fallbackLatexExtraction(content) {
    logWarn("Using fallback LaTeX extraction for chunked processing");

    const latexMap = {};
    let globalIndex = 0;

    try {
      // Extract display math expressions
      content.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex, offset) => {
        const cleanLatex = latex.trim();
        if (cleanLatex) {
          latexMap[globalIndex] = {
            latex: cleanLatex,
            type: "display",
            pattern: "$$",
            position: offset,
            index: globalIndex,
          };
          globalIndex++;
        }
        return match;
      });

      logDebug(
        `Fallback chunked processing extraction found ${globalIndex} expressions`
      );
      return latexMap;
    } catch (error) {
      logError(
        "Fallback LaTeX extraction failed for chunked processing:",
        error
      );
      return {};
    }
  }

  // ===========================================================================================
  // DOCUMENT WRAPPING UTILITY
  // ===========================================================================================

  /**
   * Wrap content chunk in proper LaTeX document structure
   * CORE FEATURE: LaTeX document structure management for chunks
   */
  function wrapContentInDocument(preamble, content, isFirstChunk = false) {
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

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testChunkedProcessingEngine() {
    const tests = {
      moduleExists: () => !!window.ChunkedProcessingEngine,

      hasSplittingFunction: () =>
        typeof ChunkedProcessingEngine.splitDocumentIntoChunks === "function",

      hasProcessingFunction: () =>
        typeof ChunkedProcessingEngine.processInChunks === "function",

      basicDocumentSplitting: () => {
        const simpleDoc = "\\section{One} Content 1 \\section{Two} Content 2";
        const chunks = splitDocumentIntoChunks(simpleDoc);
        return chunks && chunks.length >= 2 && chunks[0].type === "section";
      },

      documentWrapping: () => {
        const preamble = "\\documentclass{article}\\usepackage{amsmath}";
        const content = "Test content with $x = 1$";
        const wrapped = wrapContentInDocument(preamble, content, true);
        return (
          wrapped.includes("\\begin{document}") &&
          wrapped.includes("\\end{document}")
        );
      },

      sectionNumbering: () => {
        const testHtml =
          "<h1>Title</h1><h2>Section</h2><h2>Another Section</h2>";
        const numbered = addSequentialSectionNumbering(testHtml);
        return numbered.includes("1 Section") && numbered.includes("2 Another");
      },

      errorHandling: () => {
        try {
          const errorChunk = createErrorChunk(
            { title: "Test Section", type: "test" },
            new Error("timeout"),
            1
          );
          return (
            errorChunk &&
            errorChunk.hasError &&
            errorChunk.output.includes("timed out")
          );
        } catch (error) {
          return false;
        }
      },

      chunkCombination: () => {
        const chunks = [
          { output: "<p>Chunk 1</p>", hasError: false },
          { output: "<p>Chunk 2</p>", hasError: false },
        ];
        const combined = combineProcessedChunks(chunks, "");
        return combined.includes("Chunk 1") && combined.includes("Chunk 2");
      },

      integrationReadiness: () => {
        return (
          typeof processInChunks === "function" &&
          typeof splitDocumentIntoChunks === "function" &&
          typeof wrapContentInDocument === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ChunkedProcessingEngine", tests) ||
      fallbackTesting("ChunkedProcessingEngine", tests)
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
    // Core chunked processing functions
    processInChunks,
    splitDocumentIntoChunks,
    wrapContentInDocument,
    addSequentialSectionNumbering,

    // Chunk processing utilities
    processIndividualChunk,
    combineProcessedChunks,
    createErrorChunk,

    // Configuration access
    getChunkedConfig: () => ({ ...CHUNKED_CONFIG }),
    updateChunkedConfig: (newConfig) =>
      Object.assign(CHUNKED_CONFIG, newConfig),

    // Testing
    testChunkedProcessingEngine,
  };
})();

// Make globally available
window.ChunkedProcessingEngine = ChunkedProcessingEngine;
