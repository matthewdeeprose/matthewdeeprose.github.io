/**
 * @fileoverview MathPix ZIP Parser - Phase 8.1 Implementation
 * @module MathPixZIPParser
 * @version 1.0.0
 * @since 8.1.0
 *
 * @description
 * Parser module that extracts session data from MathPix ZIP archives to enable
 * session restoration. Reads archives created by MathPixTotalDownloader and
 * returns a structured result object with source files, results, edits, and metadata.
 *
 * Key Features:
 * - Validates ZIP structure and required files
 * - Extracts source files as Blobs with MIME type detection
 * - Parses all result formats (MMD, HTML, DOCX, etc.)
 * - Handles user edits with timestamp parsing
 * - Extracts metadata and lines data for confidence visualisation
 * - Comprehensive error/warning classification
 *
 * Dependencies:
 * - JSZip (loaded globally in project)
 * - No other external dependencies
 *
 * Integration:
 * - Standalone module (no imports from other MathPix modules)
 * - Exposed globally via window.MathPixZIPParser
 * - Test commands available via window.testZIPParser(), etc.
 *
 * @accessibility
 * - WCAG 2.2 AA compliant messaging
 * - Screen reader friendly error descriptions
 *
 * @author MathPix Development Team
 */

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if a message should be logged based on current configuration
 * @param {number} level - The log level to check
 * @returns {boolean} True if the message should be logged
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages if error logging is enabled
 * @param {string} message - The error message to log
 * @param {...any} args - Additional arguments
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[ZIPParser] ${message}`, ...args);
}

/**
 * Logs warning messages if warning logging is enabled
 * @param {string} message - The warning message to log
 * @param {...any} args - Additional arguments
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ZIPParser] ${message}`, ...args);
}

/**
 * Logs informational messages if info logging is enabled
 * @param {string} message - The info message to log
 * @param {...any} args - Additional arguments
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ZIPParser] ${message}`, ...args);
}

/**
 * Logs debug messages if debug logging is enabled
 * @param {string} message - The debug message to log
 * @param {...any} args - Additional arguments
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ZIPParser] ${message}`, ...args);
}

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} ZIPParseResult
 * @property {boolean} valid - Whether ZIP meets minimum requirements
 * @property {string} version - Archive version (default "1.0")
 * @property {Array<string>} errors - Fatal errors preventing restore
 * @property {Array<string>} warnings - Non-fatal issues
 *
 * @property {Object} source - Source file information
 * @property {string} source.filename - Original filename
 * @property {Blob} source.blob - File content as Blob
 * @property {string} source.type - MIME type
 * @property {boolean} source.isPDF - Whether source is PDF
 *
 * @property {Object} results - MathPix output results
 * @property {string} results.mmd - MMD content (required)
 * @property {string} [results.html] - HTML content
 * @property {string} [results.md] - Markdown content
 * @property {Blob} [results.docx] - DOCX blob
 * @property {Blob} [results.pptx] - PPTX blob
 * @property {Blob} [results.pdf] - Rendered PDF blob
 * @property {Object} results.archives - Nested ZIP archives as Blobs
 *
 * @property {Object} edits - User edit information
 * @property {boolean} edits.hasEdits - Whether edits exist
 * @property {Array<Object>} edits.files - Array of edit files
 * @property {string} edits.files[].filename - Edit filename
 * @property {string} edits.files[].content - MMD content
 * @property {Date} edits.files[].timestamp - Edit timestamp
 * @property {Object|null} edits.mostRecent - Most recent edit (default selection)
 *
 * @property {Object|null} metadata - From metadata.json
 * @property {Object|null} linesData - From lines.json (PDF only)
 *
 * @property {Object} converted - Previously converted files (info only)
 * @property {boolean} converted.hasConverted - Whether converted files exist
 * @property {Array<string>} converted.filenames - List of converted filenames
 */

/**
 * @typedef {Object} EditFile
 * @property {string} filename - The edit filename
 * @property {string} content - The MMD content
 * @property {Date|null} timestamp - Parsed timestamp from filename
 */

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Directory names matching MathPixTotalDownloader structure
 * @constant {Object}
 */
const DIRECTORIES = {
  SOURCE: "source",
  RESULTS: "results",
  DATA: "data",
  EDITS: "edits",
  CONVERTED: "converted",
};

/**
 * MIME type mappings for file extensions
 * @constant {Object}
 */
const MIME_TYPES = {
  // Documents
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  // Text formats
  mmd: "text/x-mmd",
  md: "text/markdown",
  html: "text/html",
  json: "application/json",
  txt: "text/plain",
  tex: "text/x-latex",
  // Archives
  zip: "application/zip",
};

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * Parser for MathPix ZIP archives
 *
 * Extracts session data from ZIP archives created by MathPixTotalDownloader,
 * enabling session restoration with full state recovery.
 *
 * @class MathPixZIPParser
 * @since 8.1.0
 *
 * @example
 * const parser = getMathPixZIPParser();
 * const result = await parser.parse(zipFile);
 * if (result.valid) {
 *   // Restore session from result
 * }
 */
class MathPixZIPParser {
  /**
   * Create a new MathPixZIPParser instance
   */
  constructor() {
    logInfo("Initialising MathPix ZIP Parser...");
    this.version = "1.0.0";
  }

  // =========================================================================
  // MAIN ENTRY POINT
  // =========================================================================

  /**
   * Parse a MathPix ZIP archive and extract session data
   *
   * @param {File|Blob} zipFile - The ZIP file to parse
   * @returns {Promise<ZIPParseResult>} Parsed session data
   *
   * @example
   * const result = await parser.parse(uploadedZipFile);
   * if (result.valid) {
   *   console.log('Source file:', result.source.filename);
   *   console.log('MMD content:', result.results.mmd);
   * } else {
   *   console.error('Parse failed:', result.errors);
   * }
   */
  async parse(zipFile) {
    logInfo("Starting ZIP parse...");

    // Initialise result structure
    const result = this.createEmptyResult();

    // Check JSZip availability
    if (typeof JSZip === "undefined") {
      const error = "JSZip library not loaded. Cannot parse ZIP archives.";
      logError(error);
      result.errors.push(error);
      return result;
    }

    // Validate input
    if (!zipFile) {
      const error = "No ZIP file provided for parsing.";
      logError(error);
      result.errors.push(error);
      return result;
    }

    try {
      // Load ZIP file
      logDebug("Loading ZIP file...");
      const zip = await JSZip.loadAsync(zipFile);
      logDebug("ZIP loaded successfully", {
        fileCount: Object.keys(zip.files).length,
      });

      // Validate structure (checks for required files)
      const structureValidation = this.validateStructure(zip);
      result.errors.push(...structureValidation.errors);
      result.warnings.push(...structureValidation.warnings);

      // If fatal errors, return early
      if (result.errors.length > 0) {
        logError("Structure validation failed:", result.errors);
        return result;
      }

      // Extract all components
      logInfo("Extracting archive contents...");

      // Extract source file (required)
      const sourceResult = await this.extractSource(zip);
      if (sourceResult.error) {
        result.errors.push(sourceResult.error);
        return result;
      }
      result.source = sourceResult;

      // Extract results (MMD required)
      const resultsResult = await this.extractResults(zip);
      if (resultsResult.error) {
        result.errors.push(resultsResult.error);
        return result;
      }
      result.results = resultsResult;

      // Extract edits (optional)
      result.edits = await this.extractEdits(zip);

      // Extract metadata (optional)
      result.metadata = await this.extractMetadata(zip);
      if (!result.metadata) {
        result.warnings.push("metadata.json not found in archive");
      }

      // Extract lines data (optional, PDF only)
      result.linesData = await this.extractLinesData(zip);
      if (result.source.isPDF && !result.linesData) {
        result.warnings.push(
          "lines.json not found (confidence visualisation unavailable)"
        );
      }

      // Extract converted file info (optional)
      result.converted = await this.extractConvertedInfo(zip);

      // Mark as valid
      result.valid = true;
      logInfo("ZIP parse completed successfully");

      return result;
    } catch (error) {
      const errorMsg = `Failed to parse ZIP archive: ${error.message}`;
      logError(errorMsg, error);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Create an empty result structure with default values
   * @returns {ZIPParseResult} Empty result structure
   * @private
   */
  createEmptyResult() {
    return {
      valid: false,
      version: "1.0",
      errors: [],
      warnings: [],
      source: {
        filename: null,
        blob: null,
        type: null,
        isPDF: false,
      },
      results: {
        mmd: null,
        html: null,
        md: null,
        docx: null,
        pptx: null,
        pdf: null,
        archives: {},
      },
      edits: {
        hasEdits: false,
        files: [],
        mostRecent: null,
      },
      metadata: null,
      linesData: null,
      converted: {
        hasConverted: false,
        filenames: [],
      },
    };
  }

  // =========================================================================
  // STRUCTURE VALIDATION
  // =========================================================================

  /**
   * Validate ZIP structure has required files
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Object} Validation result with errors and warnings arrays
   */
  validateStructure(zip) {
    logDebug("Validating ZIP structure...");

    const validation = {
      errors: [],
      warnings: [],
    };

    const files = Object.keys(zip.files);
    logDebug("Files in archive:", files);

    // Check for source directory with at least one file
    const sourceFiles = files.filter(
      (f) => f.startsWith(`${DIRECTORIES.SOURCE}/`) && !f.endsWith("/")
    );
    if (sourceFiles.length === 0) {
      validation.errors.push(
        `Required source file not found. Archive must contain a file in /${DIRECTORIES.SOURCE}/ directory.`
      );
    }

    // Check for .mmd file in results directory
    const mmdFiles = files.filter(
      (f) => f.startsWith(`${DIRECTORIES.RESULTS}/`) && f.endsWith(".mmd")
    );
    if (mmdFiles.length === 0) {
      validation.errors.push(
        `Required MMD file not found. Archive must contain a .mmd file in /${DIRECTORIES.RESULTS}/ directory.`
      );
    }

    // Check for optional but valuable files
    const hasMetadata = files.some(
      (f) => f === `${DIRECTORIES.DATA}/metadata.json`
    );
    const hasLinesData = files.some(
      (f) => f === `${DIRECTORIES.DATA}/lines.json`
    );

    if (!hasMetadata) {
      logDebug("metadata.json not found in archive");
    }

    if (!hasLinesData) {
      logDebug("lines.json not found in archive");
    }

    logDebug("Structure validation complete:", validation);
    return validation;
  }

  // =========================================================================
  // SOURCE EXTRACTION
  // =========================================================================

  /**
   * Extract source file from ZIP archive
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object>} Source file info with blob
   */
  async extractSource(zip) {
    logDebug("Extracting source file...");

    const files = Object.keys(zip.files);
    const sourceFiles = files.filter(
      (f) => f.startsWith(`${DIRECTORIES.SOURCE}/`) && !f.endsWith("/")
    );

    if (sourceFiles.length === 0) {
      return { error: "No source file found in archive" };
    }

    // Use the first source file (should typically be only one)
    const sourcePath = sourceFiles[0];
    const filename = sourcePath.split("/").pop();

    try {
      const fileData = await zip.files[sourcePath].async("blob");
      const mimeType = this.detectMimeType(filename);

      logDebug("Source file extracted:", {
        filename,
        mimeType,
        size: fileData.size,
      });

      return {
        filename: filename,
        blob: fileData,
        type: mimeType,
        isPDF: mimeType === "application/pdf",
      };
    } catch (error) {
      logError("Failed to extract source file:", error);
      return { error: `Failed to extract source file: ${error.message}` };
    }
  }

  // =========================================================================
  // RESULTS EXTRACTION
  // =========================================================================

  /**
   * Extract all result formats from ZIP archive
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object>} Results object with all formats
   */
  async extractResults(zip) {
    logDebug("Extracting results...");

    const results = {
      mmd: null,
      html: null,
      md: null,
      docx: null,
      pptx: null,
      pdf: null,
      archives: {},
    };

    const files = Object.keys(zip.files);
    const resultFiles = files.filter(
      (f) => f.startsWith(`${DIRECTORIES.RESULTS}/`) && !f.endsWith("/")
    );

    for (const filePath of resultFiles) {
      const filename = filePath.split("/").pop();
      const ext = filename.split(".").pop().toLowerCase();

      try {
        // Handle different file types
        if (filename.endsWith(".mmd")) {
          results.mmd = await zip.files[filePath].async("string");
          logDebug("Extracted MMD content:", { length: results.mmd.length });
        } else if (filename.endsWith(".html") && !filename.endsWith(".zip")) {
          results.html = await zip.files[filePath].async("string");
          logDebug("Extracted HTML content");
        } else if (filename.endsWith(".md") && !filename.includes(".zip")) {
          results.md = await zip.files[filePath].async("string");
          logDebug("Extracted Markdown content");
        } else if (filename.endsWith(".docx")) {
          results.docx = await zip.files[filePath].async("blob");
          logDebug("Extracted DOCX blob");
        } else if (filename.endsWith(".pptx")) {
          results.pptx = await zip.files[filePath].async("blob");
          logDebug("Extracted PPTX blob");
        } else if (filename.endsWith(".pdf") && !filename.includes("latex")) {
          // Rendered PDF (not source)
          results.pdf = await zip.files[filePath].async("blob");
          logDebug("Extracted rendered PDF blob");
        } else if (filename.endsWith(".zip")) {
          // Nested ZIP archive (latex.zip, mmd.zip, etc.)
          const archiveName = filename.replace(".zip", "");
          results.archives[archiveName] = await zip.files[filePath].async(
            "blob"
          );
          logDebug("Extracted nested archive:", archiveName);
        }
      } catch (error) {
        logWarn(`Failed to extract ${filename}:`, error.message);
      }
    }

    // Validate MMD was extracted
    if (!results.mmd) {
      return { error: "Failed to extract required MMD content from archive" };
    }

    return results;
  }

  // =========================================================================
  // EDITS EXTRACTION
  // =========================================================================

  /**
   * Extract user edits from ZIP archive with timestamp parsing
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object>} Edits object with files and most recent
   */
  async extractEdits(zip) {
    logDebug("Extracting edits...");

    const edits = {
      hasEdits: false,
      files: [],
      mostRecent: null,
    };

    const files = Object.keys(zip.files);
    const editFiles = files.filter(
      (f) =>
        f.startsWith(`${DIRECTORIES.EDITS}/`) &&
        f.endsWith(".mmd") &&
        !f.endsWith("/")
    );

    if (editFiles.length === 0) {
      logDebug("No edit files found");
      return edits;
    }

    edits.hasEdits = true;

    // Extract each edit file
    for (const filePath of editFiles) {
      const filename = filePath.split("/").pop();

      try {
        const content = await zip.files[filePath].async("string");
        const timestamp = this.parseEditTimestamp(filename);

        const editFile = {
          filename: filename,
          content: content,
          timestamp: timestamp,
        };

        edits.files.push(editFile);
        logDebug("Extracted edit:", {
          filename,
          timestamp,
          contentLength: content.length,
        });
      } catch (error) {
        logWarn(`Failed to extract edit ${filename}:`, error.message);
      }
    }

    // Sort by timestamp (newest first) and set most recent
    if (edits.files.length > 0) {
      edits.files.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      edits.mostRecent = edits.files[0];
      logDebug("Most recent edit:", edits.mostRecent.filename);
    }

    return edits;
  }

  /**
   * Parse timestamp from edit filename
   *
   * Edit filenames follow patterns:
   * - {basename}-{YYYY}-{MM}-{DD}-{HH}-{mm}.mmd (5-part, minutes precision)
   * - {basename}-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.mmd (6-part, seconds precision)
   * - {basename}-imported-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.mmd (imported file)
   *
   * @param {string} filename - Edit filename to parse
   * @param {boolean} [returnMetadata=false] - If true, return object with date and metadata
   * @returns {Date|Object|null} Parsed date, or object with {date, isImported} if returnMetadata=true
   *
   * @example
   * parseEditTimestamp("document-2025-12-22-09-16.mmd")
   * // Returns: Date for 2025-12-22 09:16:00
   *
   * parseEditTimestamp("my-test-2026-01-11-19-47-56.mmd")
   * // Returns: Date for 2026-01-11 19:47:56
   *
   * parseEditTimestamp("Test-imported-2026-01-11-19-47-56.mmd", true)
   * // Returns: { date: Date, isImported: true }
   */
  parseEditTimestamp(filename, returnMetadata = false) {
    // Helper to return result in appropriate format
    const makeResult = (date, isImported = false) => {
      if (returnMetadata) {
        return { date, isImported };
      }
      return date;
    };

    // Try imported pattern first (most specific)
    // Pattern: {basename}-imported-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.mmd
    const matchImported = filename.match(
      /-imported-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.mmd$/
    );

    if (matchImported) {
      const [, year, month, day, hour, minute, second] = matchImported;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1, // Month is 0-indexed
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      );
      logDebug("Parsed imported timestamp:", {
        filename,
        date: date.toISOString(),
        isImported: true,
      });
      return makeResult(date, true);
    }

    // Try 6-part pattern (with seconds)
    const match6 = filename.match(
      /-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.mmd$/
    );

    if (match6) {
      const [, year, month, day, hour, minute, second] = match6;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1, // Month is 0-indexed
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      );
      logDebug("Parsed 6-part timestamp:", {
        filename,
        date: date.toISOString(),
      });
      return makeResult(date, false);
    }

    // Try 5-part pattern (without seconds)
    const match5 = filename.match(
      /-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.mmd$/
    );

    if (match5) {
      const [, year, month, day, hour, minute] = match5;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1, // Month is 0-indexed
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10)
      );
      logDebug("Parsed 5-part timestamp:", {
        filename,
        date: date.toISOString(),
      });
      return makeResult(date, false);
    }

    logDebug("Could not parse timestamp from filename:", filename);
    return returnMetadata ? { date: null, isImported: false } : null;
  }

  // =========================================================================
  // METADATA EXTRACTION
  // =========================================================================

  /**
   * Extract metadata.json from ZIP archive
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object|null>} Parsed metadata or null
   */
  async extractMetadata(zip) {
    logDebug("Extracting metadata...");

    const metadataPath = `${DIRECTORIES.DATA}/metadata.json`;

    if (!zip.files[metadataPath]) {
      logDebug("metadata.json not found");
      return null;
    }

    try {
      const content = await zip.files[metadataPath].async("string");
      const metadata = JSON.parse(content);
      logDebug("Metadata extracted:", { keys: Object.keys(metadata) });
      return metadata;
    } catch (error) {
      logWarn("Failed to parse metadata.json:", error.message);
      return null;
    }
  }

  /**
   * Extract lines.json from ZIP archive (PDF confidence data)
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object|null>} Parsed lines data or null
   */
  async extractLinesData(zip) {
    logDebug("Extracting lines data...");

    const linesPath = `${DIRECTORIES.DATA}/lines.json`;

    if (!zip.files[linesPath]) {
      logDebug("lines.json not found");
      return null;
    }

    try {
      const content = await zip.files[linesPath].async("string");
      const linesData = JSON.parse(content);
      logDebug("Lines data extracted:", {
        hasPages: Array.isArray(linesData?.pages),
        pageCount: linesData?.pages?.length || 0,
      });
      return linesData;
    } catch (error) {
      logWarn("Failed to parse lines.json:", error.message);
      return null;
    }
  }

  // =========================================================================
  // CONVERTED FILES EXTRACTION
  // =========================================================================

  /**
   * Extract information about previously converted files
   *
   * @param {JSZip} zip - Loaded JSZip instance
   * @returns {Promise<Object>} Converted files info
   */
  async extractConvertedInfo(zip) {
    logDebug("Extracting converted file info...");

    const converted = {
      hasConverted: false,
      filenames: [],
    };

    const files = Object.keys(zip.files);
    const convertedFiles = files.filter(
      (f) => f.startsWith(`${DIRECTORIES.CONVERTED}/`) && !f.endsWith("/")
    );

    if (convertedFiles.length > 0) {
      converted.hasConverted = true;
      converted.filenames = convertedFiles.map((f) => f.split("/").pop());
      logDebug("Converted files found:", converted.filenames);
    }

    return converted;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Detect MIME type from filename extension
   *
   * @param {string} filename - Filename to detect type for
   * @returns {string} MIME type or 'application/octet-stream' for unknown
   *
   * @example
   * detectMimeType("document.pdf") // Returns: "application/pdf"
   * detectMimeType("image.png")    // Returns: "image/png"
   * detectMimeType("unknown.xyz")  // Returns: "application/octet-stream"
   */
  detectMimeType(filename) {
    if (!filename) return "application/octet-stream";

    const ext = filename.split(".").pop().toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
  }
}

// ============================================================================
// SINGLETON & GLOBAL EXPOSURE
// ============================================================================

let parserInstance = null;

/**
 * Get the singleton MathPixZIPParser instance
 *
 * @returns {MathPixZIPParser} Parser instance
 *
 * @example
 * const parser = getMathPixZIPParser();
 * const result = await parser.parse(zipFile);
 */
function getMathPixZIPParser() {
  if (!parserInstance) {
    parserInstance = new MathPixZIPParser();
  }
  return parserInstance;
}

// Global exposure for testing and integration
window.MathPixZIPParser = MathPixZIPParser;
window.getMathPixZIPParser = getMathPixZIPParser;

// ============================================================================
// TEST COMMANDS
// ============================================================================

/**
 * Unit tests for ZIP parser
 * @returns {Promise<boolean>} True if all tests pass
 */
window.testZIPParser = async function () {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   MathPix ZIP Parser - Unit Test Suite           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const parser = getMathPixZIPParser();
  let passCount = 0;
  let failCount = 0;

  const test = (name, condition) => {
    if (condition) {
      console.log(`✓ ${name}`);
      passCount++;
    } else {
      console.log(`✗ ${name}`);
      failCount++;
    }
    return condition;
  };

  // Test 1: Instance creation
  test("Parser instance created", parser instanceof MathPixZIPParser);

  // Test 2: Version property
  test("Version property exists", parser.version === "1.0.0");

  // Test 3: MIME type detection
  test(
    "MIME detection: PDF",
    parser.detectMimeType("document.pdf") === "application/pdf"
  );
  test(
    "MIME detection: PNG",
    parser.detectMimeType("image.png") === "image/png"
  );
  test(
    "MIME detection: JPEG",
    parser.detectMimeType("photo.jpg") === "image/jpeg"
  );
  test(
    "MIME detection: MMD",
    parser.detectMimeType("output.mmd") === "text/x-mmd"
  );
  test(
    "MIME detection: DOCX",
    parser.detectMimeType("document.docx") ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  test(
    "MIME detection: Unknown",
    parser.detectMimeType("file.xyz") === "application/octet-stream"
  );

  // Test 4: Timestamp parsing
  const ts1 = parser.parseEditTimestamp("document-2025-12-22-09-16.mmd");
  test("Timestamp parse: valid filename", ts1 instanceof Date);
  test("Timestamp parse: correct year", ts1 && ts1.getFullYear() === 2025);
  test(
    "Timestamp parse: correct month",
    ts1 && ts1.getMonth() === 11 // December (0-indexed)
  );
  test("Timestamp parse: correct day", ts1 && ts1.getDate() === 22);
  test("Timestamp parse: correct hour", ts1 && ts1.getHours() === 9);
  test("Timestamp parse: correct minute", ts1 && ts1.getMinutes() === 16);

  const ts2 = parser.parseEditTimestamp("no-timestamp.mmd");
  test("Timestamp parse: invalid returns null", ts2 === null);

  // Test 5: Empty result structure
  const emptyResult = parser.createEmptyResult();
  test("Empty result: valid is false", emptyResult.valid === false);
  test(
    "Empty result: errors is empty array",
    Array.isArray(emptyResult.errors) && emptyResult.errors.length === 0
  );
  test(
    "Empty result: source object exists",
    typeof emptyResult.source === "object"
  );
  test(
    "Empty result: results object exists",
    typeof emptyResult.results === "object"
  );
  test(
    "Empty result: edits object exists",
    typeof emptyResult.edits === "object"
  );

  // Test 6: JSZip availability check
  test("JSZip is available", typeof JSZip !== "undefined");

  // Test 7: Parse with null input
  const nullResult = await parser.parse(null);
  test("Parse null: returns error", nullResult.errors.length > 0);
  test("Parse null: valid is false", nullResult.valid === false);

  // Summary
  console.log("\n─────────────────────────────────────────────────────");
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log("─────────────────────────────────────────────────────\n");

  return failCount === 0;
};

/**
 * Quick validation for Phase 8.1
 * @returns {boolean} True if validation passes
 */
window.validatePhase81 = function () {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Phase 8.1 Quick Validation                     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const checks = [];

  // Check 1: Parser class available
  checks.push({
    name: "MathPixZIPParser class available",
    pass: typeof window.MathPixZIPParser === "function",
  });

  // Check 2: Getter function available
  checks.push({
    name: "getMathPixZIPParser function available",
    pass: typeof window.getMathPixZIPParser === "function",
  });

  // Check 3: Can create instance
  let parser = null;
  try {
    parser = getMathPixZIPParser();
    checks.push({
      name: "Can create parser instance",
      pass: parser instanceof MathPixZIPParser,
    });
  } catch (e) {
    checks.push({ name: "Can create parser instance", pass: false });
  }

  // Check 4: Required methods exist
  const requiredMethods = [
    "parse",
    "validateStructure",
    "extractSource",
    "extractResults",
    "extractEdits",
    "extractMetadata",
    "extractLinesData",
    "extractConvertedInfo",
    "parseEditTimestamp",
    "detectMimeType",
  ];

  requiredMethods.forEach((method) => {
    checks.push({
      name: `Method exists: ${method}`,
      pass: parser && typeof parser[method] === "function",
    });
  });

  // Check 5: JSZip available
  checks.push({
    name: "JSZip library loaded",
    pass: typeof JSZip !== "undefined",
  });

  // Check 6: Test commands available
  checks.push({
    name: "testZIPParser command available",
    pass: typeof window.testZIPParser === "function",
  });
  checks.push({
    name: "testZIPParseLive command available",
    pass: typeof window.testZIPParseLive === "function",
  });
  checks.push({
    name: "createTestZIPForResume command available",
    pass: typeof window.createTestZIPForResume === "function",
  });

  // Display results
  let passCount = 0;
  checks.forEach((check) => {
    if (check.pass) {
      console.log(`✓ ${check.name}`);
      passCount++;
    } else {
      console.log(`✗ ${check.name}`);
    }
  });

  const allPassed = passCount === checks.length;

  console.log("\n─────────────────────────────────────────────────────");
  console.log(`Phase 8.1 Validation: ${allPassed ? "PASSED" : "FAILED"}`);
  console.log(`(${passCount}/${checks.length} checks passed)`);
  console.log("─────────────────────────────────────────────────────\n");

  return allPassed;
};

/**
 * Test parsing with a real ZIP file
 *
 * @param {File} file - ZIP file to parse
 * @returns {Promise<ZIPParseResult>} Parse result
 *
 * @example
 * // In browser console after selecting file:
 * const input = document.createElement('input');
 * input.type = 'file';
 * input.accept = '.zip';
 * input.onchange = async (e) => {
 *   const result = await testZIPParseLive(e.target.files[0]);
 *   console.log('Parse result:', result);
 * };
 * input.click();
 */
window.testZIPParseLive = async function (file) {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   MathPix ZIP Parser - Live Test                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (!file) {
    console.log("No file provided. Usage: testZIPParseLive(zipFile)");
    console.log("\nTo test with file picker:");
    console.log("  const input = document.createElement('input');");
    console.log("  input.type = 'file';");
    console.log("  input.accept = '.zip';");
    console.log(
      "  input.onchange = (e) => testZIPParseLive(e.target.files[0]);"
    );
    console.log("  input.click();");
    return null;
  }

  console.log("Parsing:", file.name, `(${(file.size / 1024).toFixed(1)} KB)`);

  const parser = getMathPixZIPParser();
  const result = await parser.parse(file);

  console.log("\n─────────────────────────────────────────────────────");
  console.log("Parse Result:");
  console.log("─────────────────────────────────────────────────────");
  console.log(`  Valid: ${result.valid}`);
  console.log(`  Version: ${result.version}`);

  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`    ✗ ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n  Warnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
  }

  if (result.valid) {
    console.log("\n  Source:");
    console.log(`    Filename: ${result.source.filename}`);
    console.log(`    Type: ${result.source.type}`);
    console.log(`    Size: ${(result.source.blob?.size / 1024).toFixed(1)} KB`);
    console.log(`    Is PDF: ${result.source.isPDF}`);

    console.log("\n  Results:");
    console.log(
      `    MMD: ${
        result.results.mmd ? `${result.results.mmd.length} chars` : "Not found"
      }`
    );
    console.log(`    HTML: ${result.results.html ? "Present" : "Not found"}`);
    console.log(`    MD: ${result.results.md ? "Present" : "Not found"}`);
    console.log(`    DOCX: ${result.results.docx ? "Present" : "Not found"}`);
    console.log(`    PPTX: ${result.results.pptx ? "Present" : "Not found"}`);
    console.log(`    PDF: ${result.results.pdf ? "Present" : "Not found"}`);
    console.log(
      `    Archives: ${
        Object.keys(result.results.archives).join(", ") || "None"
      }`
    );

    console.log("\n  Edits:");
    console.log(`    Has Edits: ${result.edits.hasEdits}`);
    console.log(`    Count: ${result.edits.files.length}`);
    if (result.edits.mostRecent) {
      console.log(`    Most Recent: ${result.edits.mostRecent.filename}`);
    }

    console.log("\n  Metadata:", result.metadata ? "Present" : "Not found");
    console.log("  Lines Data:", result.linesData ? "Present" : "Not found");

    console.log("\n  Converted:");
    console.log(`    Has Converted: ${result.converted.hasConverted}`);
    if (result.converted.filenames.length > 0) {
      console.log(`    Files: ${result.converted.filenames.join(", ")}`);
    }
  }

  console.log("\n─────────────────────────────────────────────────────\n");

  return result;
};

/**
 * Create a test ZIP file for resume testing
 *
 * @returns {Promise<Blob>} Test ZIP file as Blob
 *
 * @example
 * const zipBlob = await createTestZIPForResume();
 * const result = await testZIPParseLive(new File([zipBlob], 'test.zip'));
 */
window.createTestZIPForResume = async function () {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Creating Test ZIP for Resume                   ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (typeof JSZip === "undefined") {
    console.error("✗ JSZip not available");
    return null;
  }

  const zip = new JSZip();

  // Create source folder with test file
  const sourceFolder = zip.folder("source");
  const testImageData = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG header
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xde,
    0x00,
    0x00,
    0x00,
    0x0c,
    0x49,
    0x44,
    0x41,
    0x54,
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xff,
    0xff,
    0x3f,
    0x00,
    0x05,
    0xfe,
    0x02,
    0xfe,
    0xdc,
    0xcc,
    0x59,
    0xe7,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82,
  ]);
  sourceFolder.file("test-image.png", testImageData);
  console.log("✓ Created source/test-image.png");

  // Create results folder with MMD and other formats
  const resultsFolder = zip.folder("results");
  const mmdContent = `# Test Document

This is a test MMD document for resume testing.

## Mathematics

Inline maths: $E = mc^2$

Display maths:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Table

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
`;
  resultsFolder.file("test-document.mmd", mmdContent);
  console.log("✓ Created results/test-document.mmd");

  resultsFolder.file(
    "test-document.html",
    "<html><body><h1>Test</h1></body></html>"
  );
  console.log("✓ Created results/test-document.html");

  resultsFolder.file("test-document.md", "# Test Markdown\n\nContent here.");
  console.log("✓ Created results/test-document.md");

  // Create data folder with metadata
  const dataFolder = zip.folder("data");
  const metadata = {
    version: "1.0",
    created: new Date().toISOString(),
    source: {
      filename: "test-image.png",
      type: "image/png",
    },
    processing: {
      apiType: "text",
      duration: 1500,
    },
  };
  dataFolder.file("metadata.json", JSON.stringify(metadata, null, 2));
  console.log("✓ Created data/metadata.json");

  // Create edits folder with timestamped edit
  const editsFolder = zip.folder("edits");
  const editContent = mmdContent + "\n\n## User Edit\n\nAdded this section.";
  editsFolder.file("test-document-2025-12-22-10-30.mmd", editContent);
  console.log("✓ Created edits/test-document-2025-12-22-10-30.mmd");

  // Create README
  zip.file(
    "README.txt",
    `MathPix Test Archive
====================

Created for Phase 8.1 ZIP Parser testing.
Generated: ${new Date().toISOString()}

Contents:
- source/test-image.png (test image)
- results/test-document.mmd (MMD output)
- results/test-document.html (HTML output)
- results/test-document.md (Markdown output)
- data/metadata.json (processing metadata)
- edits/test-document-2025-12-22-10-30.mmd (user edit)
`
  );
  console.log("✓ Created README.txt");

  // Generate ZIP
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  console.log(`\n✓ Test ZIP created (${(blob.size / 1024).toFixed(1)} KB)`);
  console.log("\nTo test the parser:");
  console.log("  const blob = await createTestZIPForResume();");
  console.log(
    "  const file = new File([blob], 'test.zip', { type: 'application/zip' });"
  );
  console.log("  const result = await testZIPParseLive(file);");
  console.log("─────────────────────────────────────────────────────\n");

  return blob;
};

// ============================================================================
// INITIALISATION
// ============================================================================

logInfo("MathPix ZIP Parser loaded (Phase 8.1)");
logInfo("Available commands:");
logInfo("  window.validatePhase81() - Quick validation");
logInfo("  window.testZIPParser() - Unit tests");
logInfo("  window.testZIPParseLive(file) - Test with real ZIP");
logInfo("  window.createTestZIPForResume() - Create test ZIP");

// Export for ES6 modules
export { MathPixZIPParser, getMathPixZIPParser };
export default MathPixZIPParser;
