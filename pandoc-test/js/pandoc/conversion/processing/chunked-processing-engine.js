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
      level: window.LoggingSystem.LOG_LEVELS.DEBUG,
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

      // ===========================================================================================
      // CRITICAL FIX: Apply cross-reference preprocessing BEFORE chunking
      // ===========================================================================================
      // The preprocessor must run on the FULL document before splitting into chunks
      // This ensures all \label{} commands get anchor injections: \label{x}[]{#content-x}
      // Without this, only the last chunk gets preprocessed (180 labels → 16 labels bug)

      let preprocessedInput = inputText;
const hasAnchorMarkers = inputText.includes("[]{#content-") || inputText.includes("\\hypertarget{content-");
      const inputLength = inputText.length;

      // DIAGNOSTIC: Log what we received
      logInfo(`📊 Chunked processing input diagnostics:`);
      logInfo(`   - Input length: ${inputLength.toLocaleString()} characters`);
      logInfo(
        `   - Contains anchor markers: ${hasAnchorMarkers ? "YES ✅" : "NO ❌"}`
      );

      // Check registry status BEFORE any processing
      if (window.CrossReferencePreprocessor) {
        const beforeStatus =
          window.CrossReferencePreprocessor.getRegistryStatus();
        logInfo(
          `   - Registry BEFORE chunking: ${beforeStatus.labels} labels, ${beforeStatus.references} references`
        );
      }

      const needsPreprocessing = !hasAnchorMarkers;

      if (needsPreprocessing && window.CrossReferencePreprocessor) {
        logInfo(
          "🔧 Applying cross-reference preprocessing to full document before chunking..."
        );

        try {
          const preprocessResult =
            window.CrossReferencePreprocessor.preprocessLatex(inputText);

          if (preprocessResult.success) {
            preprocessedInput = preprocessResult.latex;
            const stats = preprocessResult.statistics;
            logInfo(
              `✅ Preprocessing complete: ${stats.anchorsInjected} anchors injected ` +
                `(${stats.labelsFound} labels, ${stats.referencesFound} references)`
            );

// DIAGNOSTIC: Verify preprocessing worked
            const markdownAnchorCount = (
              preprocessedInput.match(/\[\]\{#content-/g) || []
            ).length;
            const latexHypertargetCount = (
              preprocessedInput.match(/\\hypertarget\{/g) || []
            ).length;
            const totalAnchorCount = markdownAnchorCount + latexHypertargetCount;
            logInfo(
              `   - Verification: Found ${totalAnchorCount} anchor markers (${latexHypertargetCount} LaTeX hypertargets, ${markdownAnchorCount} Markdown anchors)`
            );

            if (
              stats.orphanedReferences &&
              stats.orphanedReferences.length > 0
            ) {
              logWarn(
                `⚠️ Found ${stats.orphanedReferences.length} orphaned references: ` +
                  stats.orphanedReferences.join(", ")
              );
            }
          } else {
            logWarn(
              "⚠️ Cross-reference preprocessing failed, continuing with original LaTeX:",
              preprocessResult.error
            );
            // Continue with original inputText if preprocessing fails
          }
        } catch (preprocessError) {
          logError("❌ Cross-reference preprocessing error:", preprocessError);
          // Continue with original inputText if preprocessing throws
        }
      } else if (!window.CrossReferencePreprocessor) {
        logWarn(
          "⚠️ Cross-reference preprocessor NOT AVAILABLE - this will cause cross-reference issues!"
        );
      } else {
        logInfo(
          "✅ Input already preprocessed by orchestrator (contains anchor markers)"
        );
        logInfo("   - Skipping duplicate preprocessing to preserve registry");
        // Input is already preprocessed, use it as-is
        preprocessedInput = inputText;
      }

// DIAGNOSTIC: Verify we're using preprocessed input
      const finalHasMarkdown = preprocessedInput.includes("[]{#content-");
      const finalHasLatex = preprocessedInput.includes("\\hypertarget{");
      const finalHasAnchors = finalHasMarkdown || finalHasLatex;
      const finalLatexCount = (
        preprocessedInput.match(/\\hypertarget\{/g) || []
      ).length;
      const finalMarkdownCount = (
        preprocessedInput.match(/\[\]\{#content-/g) || []
      ).length;
      logInfo(`🔍 Final input verification before chunking:`);
      logInfo(`   - Contains anchors: ${finalHasAnchors ? "YES ✅" : "NO ❌"}`);
      logInfo(`   - LaTeX hypertargets: ${finalLatexCount}`);
      logInfo(`   - Markdown anchors: ${finalMarkdownCount}`);

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
      // OPTIMIZATION: Add guard to prevent duplicate registration
      if (window.MathJaxManagerInstance?.registerSourceEnvironments) {
        try {
          // Check if environments already registered for this content
          const contentHash = preprocessedInput.substring(0, 100); // Simple content fingerprint

          if (
            !window._lastRegisteredContent ||
            window._lastRegisteredContent !== contentHash
          ) {
            const envCount =
              window.MathJaxManagerInstance.registerSourceEnvironments(
                preprocessedInput
              );
            logInfo(
              `✅ Registered ${envCount} environments before chunked processing`
            );
            window._lastRegisteredContent = contentHash; // Mark as registered
          } else {
            logInfo(
              "⭐ Skipping duplicate environment registration (already registered)"
            );
          }
        } catch (registryError) {
          logWarn("⚠️ Failed to register environments:", registryError);
        }
      } else {
        logDebug("Environment registration not available");
      }
      // Update status if StatusManager available
      if (window.StatusManager) {
        window.StatusManager.setLoading("Analysing document structure...", 10);
      }

      // BREAKTHROUGH: Extract and preserve original LaTeX for chunked processing
      // CRITICAL: Use preprocessedInput (with anchor injections) instead of original inputText
      logInfo(
        "🔍 Extracting original LaTeX expressions for chunked processing..."
      );
      const originalLatexMap =
        extractLatexForChunkedProcessing(preprocessedInput);
      const orderedExpressions = orderLatexExpressions(originalLatexMap);

      // Store in global registries using LatexRegistryManager
      storeLatexInGlobalRegistries(originalLatexMap, orderedExpressions);

      logInfo(
        `✅ Preserved ${orderedExpressions.length} original LaTeX expressions for chunked processing`
      );

      // Split document into logical chunks
      // CRITICAL: Use preprocessedInput so all chunks contain anchor injections
      const chunks = splitDocumentIntoChunks(preprocessedInput);
      logInfo(`Document split into ${chunks.length} chunks for processing`);

      // BUGFIX: Calculate expression indices for each chunk to preserve text-math pairing
      let globalExpressionIndex = 0;
      chunks.forEach((chunk, chunkIndex) => {
        // Count math expressions in this chunk
        const mathPatterns = [
          /\$\$[\s\S]*?\$\$/g,
          /\\\[[\s\S]*?\\\]/g,
          /\$[^$]+?\$/g,
          /\\\([\s\S]*?\\\)/g,
        ];

        let chunkExpressionCount = 0;
        mathPatterns.forEach((pattern) => {
          const matches = chunk.content?.match(pattern) || [];
          chunkExpressionCount += matches.length;
        });

        // Store starting index for this chunk
        chunk.startExpressionIndex = globalExpressionIndex;
        chunk.expressionCount = chunkExpressionCount;
        chunk.endExpressionIndex = globalExpressionIndex + chunkExpressionCount;

        logDebug(
          `Chunk ${chunkIndex + 1}: expressions ${chunk.startExpressionIndex}-${
            chunk.endExpressionIndex - 1
          } (count: ${chunkExpressionCount})`
        );

        globalExpressionIndex += chunkExpressionCount;
      });

      const processedChunks = [];
      const totalChunks = chunks.length;

      // Process each chunk with timeout and error handling
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // TIME-BASED PROGRESS: Chunking is only 9.5% of work, so allocate 10% of bar
        const progress = Math.floor(((i + 1) / totalChunks) * 10) + 10; // 10-20%

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
        window.StatusManager.setLoading("Combining processed sections...", 20);
      }

// Combine processed chunks
      // CRITICAL FIX: Pass preprocessedInput (with \hypertarget{} injections) instead of original inputText
      // This allows cross-reference fixer to properly match anchors to links
      let combinedOutput = combineProcessedChunks(
        processedChunks,
        argumentsText,
        preprocessedInput
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

          // CRITICAL: Wrap restored environments in \[...\] delimiters for MathJax
          if (
            window.MathJaxManagerInstance?.wrapRestoredEnvironmentsForMathJax
          ) {
            combinedOutput =
              window.MathJaxManagerInstance.wrapRestoredEnvironmentsForMathJax(
                combinedOutput
              );
            logInfo(
              "✅ Wrapped restored environments in delimiters for MathJax processing (chunked)"
            );
          }
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
   * Balance math environments in a chunk to prevent Pandoc parse errors
   * Fixes issues where section splitting breaks align/gather/equation environments
   * 
   * STRATEGY (REVISED):
   * - Orphan \end{env}: REMOVE it entirely (it's from a previous chunk)
   * - Orphan \begin{env}: REMOVE it entirely (its \end{} is in the next chunk)
   * 
   * Previous strategy of inserting empty \begin{env}\end{env} pairs caused
   * Pandoc parse errors because empty math environments are invalid.
   * 
   * NOTE: This function is called BEFORE document wrapper is added,
   * so content will NOT have \begin{document} or \end{document}
   * 
   * @param {string} content - The chunk content (without document wrapper)
   * @returns {string} - Content with orphan environment tags removed
   */
function balanceMathEnvironments(content) {
    // DYNAMIC ENVIRONMENT DETECTION: Instead of hardcoding environment names,
    // scan the content to find ALL environments actually used, then balance them.
    // This handles custom environment names like 'ex', 'thm', 'defn', etc.
    
    let balancedContent = content;
    let totalFixes = 0;
    
    // Strip LaTeX comments for accurate counting (% starts a comment to end of line)
    // This prevents counting commented-out \begin{} and \end{} tags
    const contentWithoutComments = content
      .split('\n')
      .map(line => line.replace(/%[^\n]*/, ''))  // Remove % and everything after it (except newline)
      .join('\n');
    
    // Dynamically discover ALL environment names used in this chunk
    const beginEnvRegex = /\\begin\{([^}]+)\}/g;
    const endEnvRegex = /\\end\{([^}]+)\}/g;
    const allEnvNames = new Set();
    
    let match;
    while ((match = beginEnvRegex.exec(contentWithoutComments)) !== null) {
      allEnvNames.add(match[1]);
    }
    while ((match = endEnvRegex.exec(contentWithoutComments)) !== null) {
      allEnvNames.add(match[1]);
    }
    
    // Skip 'document' environment - that's handled separately by the wrapper
    allEnvNames.delete('document');
    
    // Math environments that should have orphans removed (not theorem-like environments)
    // Theorem-like environments (theorem, lemma, definition, etc.) should NOT have orphans removed
    // because they contain text content that should be preserved
    const mathEnvNames = new Set([
      'equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*',
      'gather', 'gather*', 'multline', 'multline*', 'split', 'flalign', 'flalign*',
      'eqnarray', 'eqnarray*', 'math', 'displaymath'
    ]);
    
    // Process each discovered environment
    allEnvNames.forEach(env => {
      // Escape special regex characters (especially * for starred environments)
      const escapedEnv = env.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const beginPattern = new RegExp(`\\\\begin\\{${escapedEnv}\\}`, 'g');
      const endPattern = new RegExp(`\\\\end\\{${escapedEnv}\\}`, 'g');
      
      // Count ONLY non-commented occurrences
      const beginMatches = (contentWithoutComments.match(beginPattern) || []).length;
      const endMatches = (contentWithoutComments.match(endPattern) || []).length;
      
      // Only process math environments - leave theorem-like environments alone
      const isMathEnv = mathEnvNames.has(env);
      
      // Handle orphan \end{env} tags (more ends than begins)
      // REVISED: Remove orphan \end{env} tags instead of inserting empty \begin{env}
      if (endMatches > beginMatches) {
        const orphanCount = endMatches - beginMatches;
        
        if (isMathEnv) {
          // For math environments: remove the orphan \end{} tags
          // They're fragments from the previous chunk and contain no useful content
          const endRemovalPattern = new RegExp(`\\n?\\\\end\\{${escapedEnv}\\}`, 'g');
          
          // Find all \end{env} positions
          const allEndMatches = [...balancedContent.matchAll(new RegExp(`\\n?\\\\end\\{${escapedEnv}\\}`, 'g'))];
          
          // Remove the FIRST N orphan occurrences (those without matching \begin{})
          let removedCount = 0;
          for (let i = 0; i < allEndMatches.length && removedCount < orphanCount; i++) {
            // Check if this \end{} has a matching \begin{} before it
            const endPos = allEndMatches[i].index;
            const contentBefore = balancedContent.substring(0, endPos);
            const beginsBeforeThis = (contentBefore.match(beginPattern) || []).length;
            const endsBeforeThis = i; // Count of \end{} we've seen so far
            
            // If there are more \end{} than \begin{} at this point, this is an orphan
            if (endsBeforeThis >= beginsBeforeThis) {
              // Mark for removal by replacing with empty string
              // We'll do actual removal after the loop
              removedCount++;
            }
          }
          
          // Simple approach: remove first N occurrences of \end{env}
          let tempContent = balancedContent;
          for (let i = 0; i < orphanCount; i++) {
            tempContent = tempContent.replace(new RegExp(`\\n?\\\\end\\{${escapedEnv}\\}`), '');
          }
          balancedContent = tempContent;
          
          totalFixes += orphanCount;
          logInfo(`🔧 Environment balancing: Removed ${orphanCount} orphan \\end{${env}} (math environment)`);
        } else {
          // For non-math environments (theorem, definition, etc.): leave them alone
          // These contain text content and shouldn't be removed
          logDebug(`⏭️ Skipping orphan \\end{${env}} - not a math environment`);
        }
      }
      
      // Handle orphan \begin{env} tags (more begins than ends)
      // REVISED: Remove orphan \begin{env} tags instead of appending \end{env}
      if (beginMatches > endMatches) {
        const orphanCount = beginMatches - endMatches;
        
        if (isMathEnv) {
          // For math environments: remove the orphan \begin{} tags from the END
          // They're fragments that continue into the next chunk
          
          // Find all \begin{env} positions
          const allBeginMatches = [...balancedContent.matchAll(new RegExp(`\\\\begin\\{${escapedEnv}\\}[\\s\\S]*?$`, 'g'))];
          
          // Simple approach: remove last N occurrences of \begin{env} and everything after
          // Actually, we need to be more careful - just remove the \begin{} itself if it's at the end
          
          // Find positions of all \begin{env}
          const beginFinder = new RegExp(`\\\\begin\\{${escapedEnv}\\}`, 'g');
          const positions = [];
          let m;
          while ((m = beginFinder.exec(balancedContent)) !== null) {
            positions.push({ index: m.index, length: m[0].length });
          }
          
          // Remove the LAST N \begin{env} tags (they're the orphans)
          const positionsToRemove = positions.slice(-orphanCount);
          
          // Work backwards so removals don't shift indices
          for (let i = positionsToRemove.length - 1; i >= 0; i--) {
            const pos = positionsToRemove[i];
            // Remove the \begin{env} and any trailing whitespace/content until end or next structure
            const beforeBegin = balancedContent.substring(0, pos.index);
            const afterBegin = balancedContent.substring(pos.index + pos.length);
            
            // If this \begin{} is near the end with no matching \end{}, remove it and trailing content
            // But be careful not to remove too much - just remove until next \section or end
            const nextStructure = afterBegin.search(/\\section\{|\\subsection\{|$/);
            const contentToKeep = afterBegin.substring(nextStructure);
            
            balancedContent = beforeBegin + contentToKeep;
          }
          
          totalFixes += orphanCount;
          logInfo(`🔧 Environment balancing: Removed ${orphanCount} orphan \\begin{${env}} (math environment)`);
        } else {
          // For non-math environments: leave them alone
          logDebug(`⏭️ Skipping orphan \\begin{${env}} - not a math environment`);
        }
      }
    });
    
    if (totalFixes > 0) {
      logInfo(`✅ Environment balancing complete: ${totalFixes} orphan tags removed across ${allEnvNames.size} environment types`);
    }
    
    return balancedContent;
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
   * Strip \hypertarget{}{} commands from LaTeX content before Pandoc processing
   * Returns the stripped content and a list of hypertarget labels for later HTML injection
   * 
   * @param {string} content - LaTeX content with hypertargets
   * @returns {object} { strippedContent, hypertargetLabels }
   */
  function stripHypertargetsForPandoc(content) {
    const hypertargetLabels = [];
    
    // Match \hypertarget{labelname}{} - captures the label name
    // Handles optional whitespace and newlines around the command
    const hypertargetRegex = /\n?\\hypertarget\{([^}]+)\}\{\}/g;
    
    let match;
    while ((match = hypertargetRegex.exec(content)) !== null) {
      hypertargetLabels.push(match[1]);
    }
    
    // Remove all hypertarget commands
    const strippedContent = content.replace(hypertargetRegex, '');
    
    if (hypertargetLabels.length > 0) {
      logInfo(`🔧 Stripped ${hypertargetLabels.length} hypertarget commands for Pandoc processing`);
    }
    
    return {
      strippedContent,
      hypertargetLabels
    };
  }

  /**
   * Inject HTML anchor spans for hypertarget labels after Pandoc conversion
   * Creates <span id="content-labelname" class="cross-ref-anchor"></span> elements
   * 
   * @param {string} htmlOutput - HTML output from Pandoc
   * @param {string[]} hypertargetLabels - Labels that need anchors
   * @returns {string} HTML with injected anchors
   */
  function injectHtmlAnchorsForHypertargets(htmlOutput, hypertargetLabels) {
    if (!hypertargetLabels || hypertargetLabels.length === 0) {
      return htmlOutput;
    }
    
    let modifiedHtml = htmlOutput;
    let injectedCount = 0;
    
    hypertargetLabels.forEach(label => {
      // Check if anchor already exists (Pandoc may have created it from \label{})
      const anchorId = `content-${label}`;
      const existingAnchorRegex = new RegExp(`id=["']${anchorId}["']`, 'i');
      
      if (existingAnchorRegex.test(modifiedHtml)) {
        logDebug(`Anchor already exists for ${label}, skipping injection`);
        return;
      }
      
      // Create the anchor span
      const anchorSpan = `<span id="${anchorId}" class="cross-ref-anchor"></span>`;
      
      // Strategy: Inject anchor at the start of the first content element
      // This ensures the anchor is present even if we can't find the exact location
      // The cross-reference fixer will handle proper linking later
      
      // Try to inject after the first heading or at start of body content
      const bodyMatch = modifiedHtml.match(/<body[^>]*>/i);
      if (bodyMatch) {
        // Inject after opening body tag
        const insertPos = bodyMatch.index + bodyMatch[0].length;
        modifiedHtml = modifiedHtml.slice(0, insertPos) + '\n' + anchorSpan + modifiedHtml.slice(insertPos);
        injectedCount++;
      } else {
        // No body tag (fragment), inject at the very start
        modifiedHtml = anchorSpan + '\n' + modifiedHtml;
        injectedCount++;
      }
    });
    
    if (injectedCount > 0) {
      logInfo(`✅ Injected ${injectedCount} HTML anchors for stripped hypertargets`);
    }
    
    return modifiedHtml;
  }

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

      // ===========================================================================================
      // CRITICAL FIX: Strip hypertargets before Pandoc to prevent parse errors
      // ===========================================================================================
      // Pandoc's LaTeX parser fails on \hypertarget{}{} commands in certain nested contexts
      // (e.g., inside theorem environments after math blocks). We strip them here and
      // inject HTML anchors after conversion.
      
      const { strippedContent, hypertargetLabels } = stripHypertargetsForPandoc(chunk.content);
      
      const hypertargetCount = hypertargetLabels.length;
      logInfo(`[CHUNK ${chunkNumber}] Title: ${chunk.title}, Content: ${chunk.content.length} chars, Hypertargets stripped: ${hypertargetCount}`);
      
      // Use stripped content for Pandoc processing
      const contentForPandoc = strippedContent;

      // Create timeout-wrapped processing promise
      const chunkPromise = new Promise((resolve, reject) => {
        try {
          const chunkOutput = pandocFunction(chunkArgs, contentForPandoc);
          resolve(chunkOutput);
        } catch (chunkError) {
          logError(`[CHUNK ${chunkNumber}] ❌ Pandoc failed: ${chunkError.message}`);
          reject(chunkError);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Chunk ${chunkNumber} processing timeout`));
        }, CHUNKED_CONFIG.chunkTimeout);
      });

      const chunkOutput = await Promise.race([chunkPromise, timeoutPromise]);

      logInfo(`[CHUNK ${chunkNumber}] ✅ Pandoc conversion successful`);

      // ===========================================================================================
      // POST-PANDOC: Inject HTML anchors for the stripped hypertargets
      // ===========================================================================================
      const outputWithAnchors = injectHtmlAnchorsForHypertargets(chunkOutput, hypertargetLabels);

      // Clean output using OutputCleaner utility if available
      const cleanedOutput = window.OutputCleaner
        ? window.OutputCleaner.cleanPandocOutput(outputWithAnchors)
        : outputWithAnchors.trim();

      return {
        ...chunk,
        output: cleanedOutput,
        hasError: false,
        processedAt: Date.now(),
        hypertargetLabels: hypertargetLabels, // Store for debugging/verification
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

      // BUGFIX: Preserve HTML structure when combining chunks
      // Create a temporary container to properly parse and combine HTML
      const tempContainer = document.createElement("div");

      // Process each chunk's HTML carefully
      processedChunks.forEach((chunk, index) => {
        if (!chunk.output) return;

        // Create a wrapper for this chunk to preserve its structure
        const chunkWrapper = document.createElement("div");
        chunkWrapper.className = `chunk-content chunk-${index}`;
        chunkWrapper.setAttribute("data-chunk-index", index);
        chunkWrapper.setAttribute(
          "data-expression-range",
          `${chunk.startExpressionIndex || 0}-${chunk.endExpressionIndex || 0}`
        );
        chunkWrapper.innerHTML = chunk.output;

        tempContainer.appendChild(chunkWrapper);
      });

      // Extract combined HTML from container
      let combinedOutput = tempContainer.innerHTML;

      // Remove chunk wrapper divs but preserve their content order
      combinedOutput = combinedOutput.replace(
        /<div class="chunk-content[^"]*"[^>]*>/g,
        ""
      );
      combinedOutput = combinedOutput.replace(/<\/div>/g, "");

      logInfo("✅ Combined chunks with structure preservation");

      // SECTION NUMBERING FIX: Add sequential numbering after combining chunks
      if (argumentsText.includes("--number-sections")) {
        combinedOutput = addSequentialSectionNumbering(combinedOutput);
        logInfo("✅ Applied sequential section numbering to combined chunks");
      }

      // OPTIMIZATION: Clear chunked processing flag before cross-reference fixing
      window.ChunkedProcessingEngine.isProcessing = false;

      // POST-ASSEMBLY ANCHOR DEDUPLICATION: Remove duplicate IDs before fixing
      logInfo("🔍 Deduplicating anchors before cross-reference fixing...");
      const deduplicatedOutput = deduplicateAnchors(combinedOutput);
      const dedupeStats = deduplicatedOutput.stats;

      if (dedupeStats.duplicatesRemoved > 0) {
        logInfo(
          `✅ Removed ${dedupeStats.duplicatesRemoved} duplicate hypertarget anchors ` +
            `(${dedupeStats.uniqueHypertargets} unique, ${dedupeStats.structuralElementsPreserved} structural elements preserved)`
        );
      } else {
        logDebug("No duplicate anchors found");
      }

      // POST-ASSEMBLY CROSS-REFERENCE FIXING: Now fix all cross-references after chunks are combined
      if (window.OutputCleaner) {
        logInfo("🔗 Performing post-assembly cross-reference fixing...");
        const finalOutput = window.OutputCleaner.cleanPandocOutput(
          deduplicatedOutput.html,
          originalLatexInput,
          { isChunkedProcessing: false } // Signal that chunking is complete
        );

        if (finalOutput !== deduplicatedOutput.html) {
          logInfo(
            "✅ Post-assembly cross-reference fixing completed successfully"
          );
          return finalOutput;
        } else {
          logDebug("No cross-references needed fixing in combined document");
        }
      }

      return deduplicatedOutput.html;
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
   * Validate that chunk recombination preserved text-math pairing
   * This helps detect the text-shuffling bug in chunked processing
   */
  function validateChunkCombination(combinedHTML, processedChunks) {
    try {
      logDebug("Validating chunk combination integrity...");

      // Create temporary DOM to analyze combined output
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;

      // Count math containers in combined output
      const mathContainers = tempDiv.querySelectorAll(
        'span.math, mjx-container, [class*="math"]'
      );
      const totalMathInOutput = mathContainers.length;

      // Count expected math expressions from chunks
      const totalExpectedMath = processedChunks.reduce((sum, chunk) => {
        return sum + (chunk.expressionCount || 0);
      }, 0);

      // Validation 1: Math container count matches
      if (totalMathInOutput !== totalExpectedMath) {
        logWarn(
          `⚠️¸ Math container mismatch: found ${totalMathInOutput}, expected ${totalExpectedMath}`
        );
        return false;
      }

      // Validation 2: Check for repeated text patterns (indicates shuffling)
      const paragraphs = tempDiv.querySelectorAll("p");
      const textBlocks = Array.from(paragraphs).map((p) =>
        p.textContent.trim()
      );

      // Look for suspicious patterns like "Let x" instead of "Let A=B=R"
      const suspiciousPatterns = [
        /Let\s+x\s*\.\s*The function/i, // Should be "Let A=B=R. The function"
        /formula\s+f\(x\)\s+is even/i, // Should be "formula f(x)=x² is even"
      ];

      let hasSuspiciousPattern = false;
      textBlocks.forEach((text, idx) => {
        suspiciousPatterns.forEach((pattern) => {
          if (pattern.test(text)) {
            logWarn(
              `⚠️¸ Suspicious text pattern in paragraph ${idx}: "${text.substring(
                0,
                100
              )}..."`
            );
            hasSuspiciousPattern = true;
          }
        });
      });

      if (hasSuspiciousPattern) {
        logError(
          "✓ Text-shuffling bug detected: math expressions paired with wrong text"
        );
        return false;
      }

      logInfo("✓… Chunk combination validation passed");
      return true;
    } catch (error) {
      logError("Error validating chunk combination:", error);
      return false;
    }
  }

  /**
   * Smart deduplication: Remove chunk-duplicated anchors while preserving Pandoc structure
   * Only removes empty SPAN elements (hypertargets) that are true chunk duplicates
   * Preserves structural elements (H1-H6, DIV) even if they share IDs
   * @param {string} htmlContent - Combined HTML from all chunks
   * @returns {object} { html: string, stats: object }
   */
  function deduplicateAnchors(htmlContent) {
    try {
      logDebug("Starting smart anchor deduplication...");

      // Parse HTML into temporary DOM
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;

      // Track seen IDs for hypertarget spans only
      const seenHypertargetIds = new Set();
      const elementsToRemove = [];
      let duplicatesRemoved = 0;
      let totalProcessed = 0;

      // Find all elements with content- prefix IDs
      const allAnchors = tempDiv.querySelectorAll('[id^="content-"]');

      allAnchors.forEach((element) => {
        const id = element.id;
        const isHypertarget =
          element.tagName === "SPAN" &&
          element.innerHTML.trim() === "" &&
          !element.hasAttribute("data-original-label");

        totalProcessed++;

        // ONLY deduplicate empty SPAN hypertarget anchors
        if (isHypertarget) {
          if (seenHypertargetIds.has(id)) {
            // Duplicate hypertarget found - mark for removal
            elementsToRemove.push(element);
            duplicatesRemoved++;
            logDebug(
              `Duplicate hypertarget anchor found: ${id} (will be removed)`
            );
          } else {
            // First occurrence - keep it
            seenHypertargetIds.add(id);
          }
        } else {
          // Structural element (H1-H6, DIV, etc.) - always keep
          // These may share IDs with hypertargets but serve different purposes
          logDebug(
            `Preserving structural element: <${element.tagName} id="${id}">`
          );
        }
      });

      // Remove duplicate hypertarget elements
      elementsToRemove.forEach((element) => {
        element.remove();
      });

      const stats = {
        duplicatesRemoved: duplicatesRemoved,
        uniqueHypertargets: seenHypertargetIds.size,
        totalProcessed: totalProcessed,
        structuralElementsPreserved:
          totalProcessed - seenHypertargetIds.size * 2,
      };

      logDebug(
        `Smart deduplication complete: ${stats.duplicatesRemoved} duplicate hypertargets removed, ` +
          `${stats.uniqueHypertargets} unique hypertargets preserved, ` +
          `${stats.structuralElementsPreserved} structural elements preserved`
      );

      return {
        html: tempDiv.innerHTML,
        stats: stats,
      };
    } catch (error) {
      logError("Error deduplicating anchors:", error);
      // Return original HTML if deduplication fails
      return {
        html: htmlContent,
        stats: {
          duplicatesRemoved: 0,
          uniqueHypertargets: 0,
          totalProcessed: 0,
        },
      };
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
        // BUGFIX: Only remove actual section numbers (e.g. "1.2.3 "), not notation like "1-1"
        let cleanText = heading.textContent
          .replace(/^(?:\d+\.)*\d+\s+/, "")
          .trim();

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

      // CRITICAL FIX: Balance math environments to prevent Pandoc parse errors
      // This handles cases where section splitting breaks align/gather environments
      cleanContent = balanceMathEnvironments(cleanContent);

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

  /**
   * Diagnostic function to test math environment balancing
   * Run: ChunkedProcessingEngine.testMathBalancing()
   */
  function testMathBalancing() {
    console.log("🧪 Testing math environment balancing...\n");
    
    const testCases = [
      {
        name: "Orphan \\end{align}",
        input: "Some text\n\\end{align}\nMore text",
        expectedContains: "\\begin{align}\\end{align}",
        expectedNotContains: null
      },
      {
        name: "Orphan \\begin{align}",
        input: "\\begin{align}\nSome equation\nMore text",
        expectedContains: "\\end{align}",
        expectedNotContains: null
      },
      {
        name: "Multiple orphan ends",
        input: "Text\n\\end{gather}\nMiddle\n\\end{gather}\nEnd",
        expectedContains: "\\begin{gather}\\end{gather}",
        expectedNotContains: null
      },
      {
        name: "Starred environment",
        input: "Content\n\\end{align*}\nMore",
        expectedContains: "\\begin{align*}\\end{align*}",
        expectedNotContains: null
      },
      {
        name: "Already balanced",
        input: "\\begin{equation}\nx = 1\n\\end{equation}",
        expectedContains: "\\begin{equation}",
        expectedNotContains: "\\begin{equation}\\end{equation}\\begin{equation}"
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach((test, index) => {
      const result = balanceMathEnvironments(test.input);
      let success = true;
      let failReason = "";
      
      if (test.expectedContains && !result.includes(test.expectedContains)) {
        success = false;
        failReason = `Missing expected: "${test.expectedContains}"`;
      }
      
      if (test.expectedNotContains && result.includes(test.expectedNotContains)) {
        success = false;
        failReason = `Contains unwanted: "${test.expectedNotContains}"`;
      }
      
      if (success) {
        console.log(`  ✅ Test ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`  ❌ Test ${index + 1}: ${test.name}`);
        console.log(`     Reason: ${failReason}`);
        console.log(`     Input: ${test.input.substring(0, 50)}...`);
        console.log(`     Output: ${result.substring(0, 80)}...`);
        failed++;
      }
    });
    
    console.log(`\n📊 Math balancing tests: ${passed}/${passed + failed} passed`);
    
    return {
      success: failed === 0,
      passed: passed,
      failed: failed,
      total: passed + failed
    };
  }

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
    testMathBalancing,
  };
})();

// Make globally available
window.ChunkedProcessingEngine = ChunkedProcessingEngine;
