/**
 * Enhanced Language Detection System
 * Comprehensive mapping between Pandoc input formats and Prism.js syntax highlighting
 * Based on official Pandoc and Prism.js language support lists
 */

/**
 * Comprehensive Pandoc → Prism.js language mapping
 * Covers all major Pandoc input formats with intelligent fallbacks
 */
const PANDOC_TO_PRISM_MAPPING = {
  // ===========================================================================================
  // MARKUP LANGUAGES (Primary formats)
  // ===========================================================================================
  
  // LaTeX variants
  "latex": { prism: "latex", display: "LaTeX", category: "markup" },
  "tex": { prism: "latex", display: "TeX", category: "markup" },
  
  // Markdown variants (extensive support)
  "markdown": { prism: "markdown", display: "Markdown", category: "markup" },
  "markdown_strict": { prism: "markdown", display: "Markdown (Strict)", category: "markup" },
  "markdown_phpextra": { prism: "markdown", display: "Markdown (PHP Extra)", category: "markup" },
  "markdown_github": { prism: "markdown", display: "Markdown (GitHub)", category: "markup" },
  "markdown_mmd": { prism: "markdown", display: "MultiMarkdown", category: "markup" },
  "gfm": { prism: "markdown", display: "GitHub Flavoured Markdown", category: "markup" },
  "commonmark": { prism: "markdown", display: "CommonMark", category: "markup" },
  "commonmark_x": { prism: "markdown", display: "CommonMark (Extended)", category: "markup" },
  
  // HTML and XML variants
  "html": { prism: "markup", display: "HTML", category: "markup" },
  "xml": { prism: "markup", display: "XML", category: "markup" },
  "docbook": { prism: "markup", display: "DocBook XML", category: "markup" },
  "jats": { prism: "markup", display: "JATS XML", category: "markup" },
  
  // reStructuredText
  "rst": { prism: "rest", display: "reStructuredText", category: "markup" },
  
  // Wiki markup formats
  "mediawiki": { prism: "wiki", display: "MediaWiki", category: "markup", fallback: "markup" },
  "dokuwiki": { prism: "markup", display: "DokuWiki", category: "markup" },
  "tikiwiki": { prism: "markup", display: "TikiWiki", category: "markup" },
  "twiki": { prism: "markup", display: "TWiki", category: "markup" },
  "jira": { prism: "markup", display: "Jira/Confluence", category: "markup" },
  
  // Other markup formats
  "textile": { prism: "textile", display: "Textile", category: "markup" },
  "org": { prism: "markup", display: "Emacs Org Mode", category: "markup" },
  "creole": { prism: "markup", display: "Creole", category: "markup" },
  "muse": { prism: "markup", display: "Muse", category: "markup" },
  "djot": { prism: "markup", display: "Djot", category: "markup" },
  "t2t": { prism: "markup", display: "txt2tags", category: "markup" },
  "vimwiki": { prism: "markup", display: "Vimwiki", category: "markup" },
  "haddock": { prism: "markup", display: "Haddock", category: "markup" },
  
  // ===========================================================================================
  // PROGRAMMING LANGUAGES
  // ===========================================================================================
  
  // Web technologies
  "css": { prism: "css", display: "CSS", category: "style" },
  "javascript": { prism: "javascript", display: "JavaScript", category: "programming" },
  "typescript": { prism: "typescript", display: "TypeScript", category: "programming" },
  
  // Systems programming
  "c": { prism: "c", display: "C", category: "programming" },
  "cpp": { prism: "cpp", display: "C++", category: "programming" },
  "rust": { prism: "rust", display: "Rust", category: "programming" },
  "go": { prism: "go", display: "Go", category: "programming" },
  
  // High-level languages
  "python": { prism: "python", display: "Python", category: "programming" },
  "java": { prism: "java", display: "Java", category: "programming" },
  "csharp": { prism: "csharp", display: "C#", category: "programming" },
  "php": { prism: "php", display: "PHP", category: "programming" },
  "ruby": { prism: "ruby", display: "Ruby", category: "programming" },
  "perl": { prism: "perl", display: "Perl", category: "programming" },
  "lua": { prism: "lua", display: "Lua", category: "programming" },
  
  // Functional languages
  "haskell": { prism: "haskell", display: "Haskell", category: "programming" },
  "scala": { prism: "scala", display: "Scala", category: "programming" },
  "swift": { prism: "swift", display: "Swift", category: "programming" },
  "kotlin": { prism: "kotlin", display: "Kotlin", category: "programming" },
  
  // Statistical and scientific
  "r": { prism: "r", display: "R", category: "programming" },
  "julia": { prism: "julia", display: "Julia", category: "programming" },
  "matlab": { prism: "matlab", display: "MATLAB", category: "programming" },
  
  // Scripting
  "bash": { prism: "bash", display: "Bash", category: "scripting" },
  "powershell": { prism: "powershell", display: "PowerShell", category: "scripting" },
  
  // ===========================================================================================
  // DATA FORMATS
  // ===========================================================================================
  
  // Structured data
  "json": { prism: "json", display: "JSON", category: "data" },
  "yaml": { prism: "yaml", display: "YAML", category: "data" },
  "csv": { prism: "csv", display: "CSV", category: "data" },
  "tsv": { prism: "csv", display: "TSV", category: "data" }, // Use CSV highlighter for TSV
  "xml": { prism: "markup", display: "XML", category: "data" },
  
  // Notebook formats
  "ipynb": { prism: "json", display: "Jupyter Notebook", category: "data" },
  
  // Bibliography formats (LaTeX-like)
  "bibtex": { prism: "latex", display: "BibTeX", category: "bibliography" },
  "biblatex": { prism: "latex", display: "BibLaTeX", category: "bibliography" },
  "csljson": { prism: "json", display: "CSL JSON", category: "bibliography" },
  "endnotexml": { prism: "markup", display: "EndNote XML", category: "bibliography" },
  "ris": { prism: "markup", display: "RIS", category: "bibliography" },
  
  // ===========================================================================================
  // DOCUMENT FORMATS
  // ===========================================================================================
  
  // Rich document formats (binary/complex - limited highlighting)
  "docx": { prism: "none", display: "Microsoft Word", category: "document" },
  "odt": { prism: "none", display: "OpenDocument Text", category: "document" },
  "epub": { prism: "none", display: "EPUB", category: "document" },
  "fb2": { prism: "markup", display: "FictionBook2", category: "document" },
  "rtf": { prism: "none", display: "Rich Text Format", category: "document" },
  
  // Manual/documentation formats
  "man": { prism: "markup", display: "roff man", category: "documentation" },
  "mdoc": { prism: "markup", display: "mdoc", category: "documentation" },
  "pod": { prism: "markup", display: "Perl POD", category: "documentation" },
  
  // ===========================================================================================
  // SPECIALIZED FORMATS
  // ===========================================================================================
  
  // Plain text
  "plain": { prism: "none", display: "Plain Text", category: "text" },
  "txt": { prism: "none", display: "Plain Text", category: "text" },
  
  // Native/internal formats
  "native": { prism: "haskell", display: "Pandoc Native (Haskell)", category: "internal" },
  
  // Other specialized formats
  "opml": { prism: "markup", display: "OPML", category: "data" },
  "typst": { prism: "markup", display: "Typst", category: "markup" },
  "bits": { prism: "markup", display: "BITS XML", category: "markup" }
};

/**
 * Language categories for intelligent fallbacks
 */
const LANGUAGE_CATEGORIES = {
  markup: { fallback: "markup", description: "Markup languages" },
  programming: { fallback: "clike", description: "Programming languages" },
  scripting: { fallback: "bash", description: "Scripting languages" },
  data: { fallback: "json", description: "Data formats" },
  style: { fallback: "css", description: "Styling languages" },
  bibliography: { fallback: "latex", description: "Bibliography formats" },
  document: { fallback: "none", description: "Document formats" },
  documentation: { fallback: "markup", description: "Documentation formats" },
  text: { fallback: "none", description: "Plain text" },
  internal: { fallback: "none", description: "Internal formats" }
};

/**
 * Enhanced language detection with comprehensive Pandoc → Prism.js mapping
 * @param {string} pandocArgs - Pandoc arguments string
 * @returns {Object} Enhanced language information
 */
function detectSourceLanguageEnhanced(pandocArgs) {
  try {
    logDebug("Detecting source language from Pandoc args:", pandocArgs);

    // Default fallback
    const defaultResult = {
      pandocLanguage: "latex",
      prismLanguage: "latex",
      displayName: "LaTeX",
      category: "markup",
      confidence: "default"
    };

    if (!pandocArgs || typeof pandocArgs !== "string") {
      logWarn("No valid Pandoc arguments provided, using default LaTeX");
      return defaultResult;
    }

    // Parse --from parameter with improved regex
    const fromMatch = pandocArgs.match(/--from[=\s]+([^\s]+)/i);
    if (!fromMatch) {
      logDebug("No --from parameter found, using default LaTeX");
      return defaultResult;
    }

    const fromValue = fromMatch[1].toLowerCase().trim();
    logDebug("Found --from parameter:", fromValue);

    // Handle extensions (e.g., latex+fancy_lists+citations)
    const baseFormat = fromValue.split('+')[0];
    const extensions = fromValue.includes('+') ? fromValue.split('+').slice(1) : [];

    // Look up base format in comprehensive mapping
    let languageInfo = PANDOC_TO_PRISM_MAPPING[baseFormat];
    
    if (!languageInfo) {
      // Try partial matches for complex format names
      const partialMatch = Object.keys(PANDOC_TO_PRISM_MAPPING).find(key => 
        baseFormat.includes(key) || key.includes(baseFormat)
      );
      
      if (partialMatch) {
        languageInfo = PANDOC_TO_PRISM_MAPPING[partialMatch];
        logDebug("Found partial match:", partialMatch);
      }
    }

    if (languageInfo) {
      const result = {
        pandocLanguage: fromValue,
        prismLanguage: languageInfo.prism,
        displayName: languageInfo.display,
        category: languageInfo.category,
        confidence: "direct"
      };

      // Add extension information to display name
      if (extensions.length > 0) {
        result.displayName += ` (with ${extensions.join(', ')})`;
        result.extensions = extensions;
      }

      // Handle fallback if primary language not available
      if (languageInfo.fallback && !isPrismLanguageAvailable(languageInfo.prism)) {
        logWarn(`Primary language ${languageInfo.prism} not available, using fallback: ${languageInfo.fallback}`);
        result.prismLanguage = languageInfo.fallback;
        result.confidence = "fallback";
      }

      logInfo("Detected source language:", result);
      return result;

    } else {
      // Unknown format - use intelligent fallback based on common patterns
      const intelligentFallback = getIntelligentFallback(baseFormat);
      logWarn(`Unknown source format: ${baseFormat}, using intelligent fallback:`, intelligentFallback);
      
      return {
        pandocLanguage: fromValue,
        prismLanguage: intelligentFallback.prism,
        displayName: intelligentFallback.display,
        category: intelligentFallback.category,
        confidence: "intelligent_fallback",
        extensions: extensions.length > 0 ? extensions : undefined
      };
    }

  } catch (error) {
    logError("Error detecting source language:", error);
    return {
      pandocLanguage: "latex",
      prismLanguage: "latex", 
      displayName: "LaTeX",
      category: "markup",
      confidence: "error_fallback"
    };
  }
}

/**
 * Intelligent fallback system for unknown formats
 * @param {string} format - Unknown format string
 * @returns {Object} Fallback language info
 */
function getIntelligentFallback(format) {
  // Pattern-based detection for unknown formats
  const patterns = [
    { pattern: /^(.*md|.*markdown)$/i, result: { prism: "markdown", display: "Markdown (variant)", category: "markup" }},
    { pattern: /^(.*tex|.*latex)$/i, result: { prism: "latex", display: "LaTeX (variant)", category: "markup" }},
    { pattern: /^(.*html|.*xml)$/i, result: { prism: "markup", display: "Markup (variant)", category: "markup" }},
    { pattern: /^(.*json)$/i, result: { prism: "json", display: "JSON (variant)", category: "data" }},
    { pattern: /^(.*yaml|.*yml)$/i, result: { prism: "yaml", display: "YAML (variant)", category: "data" }},
    { pattern: /^(.*csv|.*tsv)$/i, result: { prism: "csv", display: "Tabular data", category: "data" }},
    { pattern: /^(.*wiki)$/i, result: { prism: "markup", display: "Wiki markup", category: "markup" }},
    { pattern: /^(.*script|.*sh|.*bash)$/i, result: { prism: "bash", display: "Script", category: "scripting" }},
  ];

  for (const { pattern, result } of patterns) {
    if (pattern.test(format)) {
      return result;
    }
  }

  // Ultimate fallback
  return { prism: "none", display: `Unknown format (${format})`, category: "unknown" };
}

/**
 * Check if a Prism.js language is available
 * @param {string} language - Prism.js language identifier
 * @returns {boolean} Whether the language is available
 */
function isPrismLanguageAvailable(language) {
  // This function should check if the language is included in the current Prism.js build
  // For now, assume all mapped languages are available
  // In a real implementation, this would check window.Prism?.languages?.[language]
  
  if (typeof window !== 'undefined' && window.Prism && window.Prism.languages) {
    return !!window.Prism.languages[language];
  }
  
  // Fallback: assume common languages are available
  const commonLanguages = [
    'markup', 'html', 'xml', 'svg', 'mathml',
    'css', 'javascript', 'js', 'json',
    'markdown', 'latex', 'tex',
    'python', 'java', 'c', 'cpp', 'csharp',
    'php', 'ruby', 'go', 'rust', 'swift',
    'bash', 'powershell', 'yaml', 'csv',
    'none'
  ];
  
  return commonLanguages.includes(language);
}

/**
 * Get language statistics and mapping coverage
 * @returns {Object} Statistics about language support
 */
function getLanguageMappingStats() {
  const totalMappings = Object.keys(PANDOC_TO_PRISM_MAPPING).length;
  const categoryStats = {};
  
  Object.values(PANDOC_TO_PRISM_MAPPING).forEach(lang => {
    if (!categoryStats[lang.category]) {
      categoryStats[lang.category] = 0;
    }
    categoryStats[lang.category]++;
  });

  return {
    totalMappings,
    categoryStats,
    categories: Object.keys(LANGUAGE_CATEGORIES),
    supportedPandocFormats: Object.keys(PANDOC_TO_PRISM_MAPPING),
    version: "2.0.0-enhanced"
  };
}

/**
 * Test the enhanced language detection system
 * @returns {Object} Test results
 */
function testEnhancedLanguageDetection() {
  const testCases = [
    // Basic formats
    { args: "--from latex --to html5", expected: { prism: "latex", category: "markup" }},
    { args: "--from markdown --to html5", expected: { prism: "markdown", category: "markup" }},
    { args: "--from gfm --to html5", expected: { prism: "markdown", category: "markup" }},
    
    // With extensions
    { args: "--from latex+fancy_lists+citations --to html5", expected: { prism: "latex", category: "markup" }},
    { args: "--from markdown_github+smart --to html5", expected: { prism: "markdown", category: "markup" }},
    
    // Programming languages
    { args: "--from python --to html5", expected: { prism: "python", category: "programming" }},
    { args: "--from javascript --to html5", expected: { prism: "javascript", category: "programming" }},
    
    // Data formats
    { args: "--from json --to html5", expected: { prism: "json", category: "data" }},
    { args: "--from csv --to html5", expected: { prism: "csv", category: "data" }},
    { args: "--from yaml --to html5", expected: { prism: "yaml", category: "data" }},
    
    // Wiki formats
    { args: "--from mediawiki --to html5", expected: { prism: "wiki", category: "markup" }},
    { args: "--from dokuwiki --to html5", expected: { prism: "markup", category: "markup" }},
    
    // Bibliography
    { args: "--from bibtex --to html5", expected: { prism: "latex", category: "bibliography" }},
    { args: "--from biblatex --to html5", expected: { prism: "latex", category: "bibliography" }},
    
    // Document formats
    { args: "--from docx --to html5", expected: { prism: "none", category: "document" }},
    { args: "--from epub --to html5", expected: { prism: "none", category: "document" }},
    
    // Edge cases
    { args: "--to html5", expected: { prism: "latex", category: "markup" }}, // No --from
    { args: "", expected: { prism: "latex", category: "markup" }}, // Empty
    { args: "--from unknownformat --to html5", expected: { confidence: "intelligent_fallback" }}, // Unknown
  ];

  const results = {
    passed: 0,
    total: testCases.length,
    failures: []
  };

  testCases.forEach((testCase, index) => {
    try {
      const result = detectSourceLanguageEnhanced(testCase.args);
      
      let passed = true;
      if (testCase.expected.prism && result.prismLanguage !== testCase.expected.prism) {
        passed = false;
      }
      if (testCase.expected.category && result.category !== testCase.expected.category) {
        passed = false;
      }
      if (testCase.expected.confidence && result.confidence !== testCase.expected.confidence) {
        passed = false;
      }

      if (passed) {
        results.passed++;
      } else {
        results.failures.push({
          index,
          args: testCase.args,
          expected: testCase.expected,
          actual: result
        });
      }
    } catch (error) {
      results.failures.push({
        index,
        args: testCase.args,
        error: error.message
      });
    }
  });

  return {
    success: results.passed === results.total,
    ...results,
    stats: getLanguageMappingStats()
  };
}

// Export for use in Source Viewer module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectSourceLanguageEnhanced,
    getIntelligentFallback,
    isPrismLanguageAvailable,
    getLanguageMappingStats,
    testEnhancedLanguageDetection,
    PANDOC_TO_PRISM_MAPPING,
    LANGUAGE_CATEGORIES
  };
}