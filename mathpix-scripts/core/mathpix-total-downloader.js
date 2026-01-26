/**
 * MathPix Total Downloader - Core Module
 * Phase 1: Basic Infrastructure & ZIP Creation
 *
 * Purpose: Creates comprehensive ZIP archives of MathPix processing results
 * Status: Phase 1 - Basic structure with test data
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

const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO; // More verbose for Phase 1 testing
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[TotalDownloader] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[TotalDownloader] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[TotalDownloader] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[TotalDownloader] ${message}`, ...args);
}

// ============================================================================
// IMPORTS
// ============================================================================

import MathPixBaseModule from "./mathpix-base-module.js";
import MATHPIX_CONFIG from "./mathpix-config.js";

// ============================================================================
// MAIN CLASS
// ============================================================================

class MathPixTotalDownloader extends MathPixBaseModule {
  constructor(controller) {
    // Phase 1: Provide mock controller for testing if none provided
    const mockController = controller || {
      elements: {},
      showNotification: (message, type) => {
        logInfo(`[Mock Notification - ${type}] ${message}`);
      },
    };

    super(mockController);
    this.config = MATHPIX_CONFIG.TOTAL_DOWNLOADER;

    logInfo("Initialising Total Downloader...");
  }

  /**
   * Initialise the module
   */
  initialize() {
    logInfo("Initialization starting...");

    // Check JSZip availability
    if (typeof JSZip === "undefined") {
      logError("JSZip library not loaded! Total Downloader disabled.");
      return false;
    }

    logInfo("JSZip library detected");
    logInfo("Initialization complete");
    return true;
  }

  // =========================================================================
  // PHASE 1: BASIC ZIP CREATION
  // =========================================================================

  /**
   * Create test ZIP with source, results, AND data collection
   * Phase 4: Enhanced with data collection testing
   *
   * @param {string} sourceType - 'upload' | 'clipboard' | 'canvas'
   * @param {string} apiType - 'text' | 'pdf' | 'strokes'
   * @returns {Promise<void>}
   */
  async createTestZip(sourceType = "upload", apiType = "text") {
    logInfo(`Creating test ZIP with source: ${sourceType}, API: ${apiType}`);

    try {
      const zip = new JSZip();

      // Create folders
      const sourceFolder = zip.folder(this.config.DIRECTORIES.SOURCE);
      const resultsFolder = zip.folder(this.config.DIRECTORIES.RESULTS);
      const dataFolder = zip.folder(this.config.DIRECTORIES.DATA);

      // Collect source files (Phase 2)
      const mockSourceState = this.createMockState(sourceType);
      const sourceResult = await this.collectSourceFiles(
        mockSourceState,
        sourceFolder
      );
      logInfo("Source collection result:", sourceResult);

      // Collect result files (Phase 3)
      const mockResponse = this.createMockResponse(apiType);
      const resultsResult = await this.collectResultFiles(
        mockResponse,
        resultsFolder,
        sourceResult // Pass source result for filename generation in tests too
      );
      logInfo("Results collection result:", resultsResult);

      // Collect data files (Phase 4 - NEW!)
      const mockRequest = this.createMockRequest(apiType);
      const mockDebugData = this.createMockDebugData(apiType);
      const collectionData = {
        sourceResult,
        resultsResult,
        response: mockResponse,
        request: mockRequest,
        debugData: mockDebugData,
      };
      const dataResult = await this.collectDataFiles(
        collectionData,
        dataFolder
      );
      logInfo("Data collection result:", dataResult);

      // Generate production README (Phase 4 - NEW!)
      const manifest = {
        sourceResult,
        resultsResult,
        response: mockResponse,
        metadata: this.generateMetadata(
          sourceResult,
          resultsResult,
          mockResponse
        ),
      };
      const readme = this.generateProductionReadme(manifest);
      zip.file("README.txt", readme);

      // Generate ZIP
      logInfo("Generating ZIP blob...");
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Create filename
      const filename = this.generateFilename(`test-${sourceType}-${apiType}`);

      // Trigger download
      logInfo(`Triggering download: ${filename}`);
      this.triggerDownload(blob, filename);

      logInfo("Test ZIP created successfully!");

      if (typeof notifySuccess === "function") {
        notifySuccess(
          `Test ZIP (${sourceType}/${apiType}) downloaded successfully!`
        );
      }
    } catch (error) {
      logError("Failed to create test ZIP:", error);
      if (typeof notifyError === "function") {
        notifyError("Failed to create test ZIP: " + error.message);
      }
      throw error;
    }
  }
  /**
   * Generate test README content
   * Phase 3: Enhanced with API type and format information
   *
   * @param {string} sourceType - Source type for this test
   * @param {string} apiType - API type for this test
   * @returns {string}
   */
  generateTestReadme(sourceType = "unknown", apiType = "unknown") {
    return `
================================================================================
                  MathPix Total Downloader - Test Archive
================================================================================

This is a test archive generated during Phase 3 development.

Generated: ${new Date().toISOString()}
Archive Version: 1.0-phase3
Source Type: ${sourceType}
API Type: ${apiType}

================================================================================
ARCHIVE CONTENTS
================================================================================

/source/
  ${this.getSourceDescription(sourceType)}

/results/
  ${this.getResultsDescription(apiType)}

/data/
  test-metadata.json - Test metadata with collection results

================================================================================
PHASE 3 STATUS
================================================================================

✓ JSZip library integration
✓ Basic ZIP creation
✓ Folder structure creation
✓ Filename generation
✓ Download triggering
✓ Source type detection
✓ Uploaded file collection
✓ Clipboard image conversion
✓ Canvas snapshot capture
✓ Stroke data extraction
✓ API type detection
✓ Text API format collection
✓ PDF API format collection
✓ Strokes API format collection
✓ Table format handling
✓ Binary format pass-through
✓ Markdown generation

Upcoming phases:
- Phase 4: Data & debug collection
- Phase 5: UI integration
- Phase 6: Error handling
- Phase 7: Testing & validation

================================================================================
`.trim();
  }

  /**
   * Get description of source files based on type
   * Phase 2: Helper for README generation
   * Phase 5.7: Enhanced with operation type mapping
   *
   * @param {Object} sourceResult - Source result object
   * @param {Object} metadata - Metadata object with processing info
   * @returns {string} - Description
   */
  getSourceDescription(sourceResult, metadata = null) {
    // Handle legacy string input (for test methods)
    if (typeof sourceResult === "string") {
      const sourceType = sourceResult;
      switch (sourceType) {
        case "upload":
          return "test-upload.txt - Test uploaded file";
        case "clipboard":
          return "clipboard-image.jpg - Test clipboard image (converted from base64)";
        case "canvas":
          return `canvas-drawing.png - Test canvas snapshot (400x300)
  strokes-data.json - Test stroke coordinate data`;
        default:
          return "Unknown source type";
      }
    }

    // Enhanced description using metadata
    const sourceType = sourceResult?.sourceType || "unknown";
    const inputSource = metadata?.processing?.inputSource;

    switch (sourceType) {
      case "upload":
        if (inputSource === "image-upload") {
          return "Image Upload";
        } else if (inputSource === "file-upload") {
          return "File Upload";
        } else {
          return "Uploaded File";
        }
      case "clipboard":
        return "Clipboard Paste";
      case "canvas":
        return "Canvas Drawing";
      default:
        return "Unknown source type";
    }
  }

  /**
   * Get description of result files based on API type
   * Phase 3: Helper for README generation
   *
   * @param {string} apiType - API type
   * @returns {string} - Description
   */
  getResultsDescription(apiType) {
    switch (apiType) {
      case "text":
        return `latex.tex - LaTeX mathematical notation
  mathml.xml - MathML XML format
  asciimath.txt - AsciiMath plain text
  html.html - HTML with styled mathematics
  markdown.md - Markdown with LaTeX
  json-response.json - Complete API response`;

      case "pdf":
        return `mmd.mmd - MathPix Markdown format
  markdown.md - Standard Markdown
  html.html - HTML document
  document.docx - Microsoft Word format (binary)
  latex.zip - LaTeX archive (nested ZIP)`;

      case "strokes":
        return `(Same formats as Text API)
  latex.tex - LaTeX mathematical notation
  mathml.xml - MathML XML format
  asciimath.txt - AsciiMath plain text
  html.html - HTML with styled mathematics
  markdown.md - Markdown with LaTeX
  json-response.json - Complete API response`;

      default:
        return "Unknown API type";
    }
  }

  // =========================================================================
  // FILENAME GENERATION
  // =========================================================================

  /**
   * Generate filename for ZIP archive
   * Phase 1: Basic implementation with configurable template
   *
   * @param {string} [baseName] - Optional base name (e.g., original filename)
   * @returns {string} - Sanitised filename with .zip extension
   */
  generateFilename(baseName = null) {
    logDebug("Generating filename...", { baseName });

    let filename;

    if (baseName) {
      // Use provided base name (sanitised)
      const sanitised = this.sanitizeFilename(baseName);
      filename = `${sanitised}${this.config.FILENAME_SUFFIX}.zip`;
    } else {
      // Use template with timestamp
      const timestamp = this.generateTimestamp();
      filename =
        this.config.FILENAME_TEMPLATE.replace("{timestamp}", timestamp) +
        ".zip";
    }

    logDebug("Generated filename:", filename);
    return filename;
  }

  /**
   * Sanitise filename by removing special characters
   *
   * @param {string} filename - Original filename
   * @returns {string} - Sanitised filename
   */
  sanitizeFilename(filename) {
    if (!filename) return "";

    // Remove file extension if present
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Replace disallowed characters with configured replacement
    const sanitised = nameWithoutExt
      .replace(
        this.config.FILENAME_ALLOWED_CHARS,
        this.config.FILENAME_REPLACEMENT
      )
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

    logDebug("Sanitised filename:", { original: filename, sanitised });
    return sanitised || "download"; // Fallback if completely invalid
  }

  /**
   * Generate timestamp string for filename
   * Format: YYYY-MM-DD-HHMMSS
   *
   * @returns {string}
   */
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  // =========================================================================
  // PHASE 5.6: FILE SIZE UTILITIES
  // =========================================================================

  /**
   * Calculate total size of files in bytes
   * Phase 5.6: Enhanced metadata - file size statistics
   *
   * @param {Array} filesCollected - Array of collected file objects
   * @returns {number} Total size in bytes
   */
  calculateTotalSize(filesCollected) {
    if (!filesCollected || !Array.isArray(filesCollected)) {
      logWarn("Invalid filesCollected array provided to calculateTotalSize");
      return 0;
    }

    const total = filesCollected.reduce((sum, file) => {
      const fileSize = file.size || 0;
      return sum + fileSize;
    }, 0);

    logDebug("Total size calculated:", {
      fileCount: filesCollected.length,
      totalBytes: total,
      totalFormatted: this.formatFileSize(total),
    });

    return total;
  }

  /**
   * Create size breakdown by file
   * Phase 5.6: Enhanced metadata - individual file sizes
   *
   * @param {Array} filesCollected - Array of collected file objects
   * @returns {Object} Map of filename to formatted size
   */
  createFileSizeMap(filesCollected) {
    if (!filesCollected || !Array.isArray(filesCollected)) {
      logWarn("Invalid filesCollected array provided to createFileSizeMap");
      return {};
    }

    const sizeMap = {};

    filesCollected.forEach((file) => {
      const filename = file.filename || file.originalName || "unknown";
      const size = file.size || 0;
      sizeMap[filename] = this.formatFileSize(size);
    });

    logDebug("File size map created:", {
      fileCount: Object.keys(sizeMap).length,
      files: sizeMap,
    });

    return sizeMap;
  }

  /**
   * Format file size for human readability
   * Phase 5.6: Reusable utility for consistent size formatting
   *
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string (e.g., "1.2 KB", "570 KB", "2.3 MB")
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    if (!bytes || isNaN(bytes)) return "Unknown";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return parseFloat(value.toFixed(1)) + " " + sizes[i];
  }

  /**
   * Detect processing mode from source and response
   * Phase 5.6: Enhanced metadata - descriptive processing mode
   * Phase 5.7: Enhanced with operation type detection
   *
   * @param {Object} sourceResult - Source collection result
   * @param {Object} response - API response
   * @param {Object} debugData - Debug panel data (optional)
   * @returns {Object} Processing mode info { mode: string, source: string }
   */
  detectProcessingMode(sourceResult, response, debugData = null) {
    logDebug("Detecting processing mode...", {
      sourceResult,
      response,
      debugData,
    });

    let mode = "Unknown";
    let source = "unknown";

    // Detect source type
    const sourceType = sourceResult?.sourceType || "unknown";

    // Enhanced detection using debug data operation type
    const operation =
      debugData?.operation || this.extractOperationFromDebugPanel();

    switch (sourceType) {
      case "upload":
        // Check if PDF
        const isPDF = sourceResult.filesCollected?.some(
          (file) =>
            file.mimeType === "application/pdf" ||
            file.filename?.toLowerCase().endsWith(".pdf")
        );

        if (isPDF) {
          mode = "PDF Document";
          source = "file-upload";
        } else {
          // Image upload - check if handwritten or printed
          if (response?.is_handwritten || response?.isHandwritten) {
            mode = "Handwritten Math";
            source =
              operation === "processImage" ? "image-upload" : "file-upload";
          } else {
            mode = "Printed Math";
            source =
              operation === "processImage" ? "image-upload" : "file-upload";
          }
        }
        break;

      case "canvas":
        mode = "Handwritten Math";
        source = "canvas-draw";
        break;

      case "clipboard":
        // Check if handwritten or printed from response
        if (response?.is_handwritten || response?.isHandwritten) {
          mode = "Handwritten Math";
          source = "clipboard-paste";
        } else {
          mode = "Pasted Image";
          source = "clipboard-paste";
        }
        break;

      default:
        logWarn(
          "Unknown source type for processing mode detection:",
          sourceType
        );
        // Enhanced fallback using operation type
        if (operation === "processImage") {
          mode = response?.is_handwritten ? "Handwritten Math" : "Printed Math";
          source = "image-upload";
        } else {
          mode = "Unknown";
          source = "unknown";
        }
    }

    logInfo("Processing mode detected:", { mode, source, operation });

    return { mode, source };
  }

  /**
   * Extract operation type from debug panel DOM
   * Phase 5.7: Helper for operation type detection
   * @returns {string|null} Operation type or null
   */
  extractOperationFromDebugPanel() {
    try {
      const operationElement = document.getElementById("debug-operation");
      const operation = operationElement?.textContent?.trim();
      logDebug("Operation extracted from debug panel:", operation);
      return operation || null;
    } catch (error) {
      logDebug("Failed to extract operation from debug panel:", error);
      return null;
    }
  }

  /**
   * Extract endpoint from debug panel DOM
   * Phase 5.7: Helper for geographic region detection
   * @returns {string|null} Endpoint URL or null
   */
  extractEndpointFromDebugPanel() {
    try {
      const endpointElement = document.getElementById("debug-endpoint");
      const endpoint = endpointElement?.textContent?.trim();
      logDebug("Endpoint extracted from debug panel:", endpoint);
      return endpoint || null;
    } catch (error) {
      logDebug("Failed to extract endpoint from debug panel:", error);
      return null;
    }
  }

  /**
   * Detect table presence from multiple sources
   * Phase 5.7: Comprehensive table detection
   * @param {Object} response - API response
   * @param {Object} debugData - Debug panel data
   * @returns {boolean} True if table detected
   */
  detectTableFromMultipleSources(response, debugData) {
    logDebug("Detecting table from multiple sources...", {
      response,
      debugData,
    });

    // Priority 1: API response properties
    if (response.contains_table === true || response.containsTable === true) {
      logInfo("✓ Table detected from API response property");
      return true;
    }

    // Priority 2: Check debug panel content type
    try {
      const typeElement = document.getElementById("mathpix-type");
      const typeText = typeElement?.textContent?.toLowerCase() || "";
      if (typeText.includes("table")) {
        logInfo("✓ Table detected from debug panel type:", typeText);
        return true;
      }
    } catch (error) {
      logDebug("Failed to check debug panel type:", error);
    }

    // Priority 3: Check for table-related data in response
    if (response.data && Array.isArray(response.data)) {
      const hasTableData = response.data.some(
        (item) =>
          item.type === "html" && item.value && item.value.includes("<table")
      );
      if (hasTableData) {
        logInfo("✓ Table detected from response data HTML");
        return true;
      }
    }

    // Priority 4: Check result renderer table formats (if available)
    try {
      if (window.getMathPixController) {
        const controller = window.getMathPixController();
        const currentResult = controller.resultRenderer?.currentResult;
        if (
          currentResult?.tableHtml ||
          currentResult?.tableTsv ||
          currentResult?.tableMarkdown
        ) {
          logInfo("✓ Table detected from result renderer formats");
          return true;
        }
      }
    } catch (error) {
      logDebug("Failed to check result renderer:", error);
    }

    logInfo("No table detected from any source");
    return false;
  }

  /**
   * Generate enhanced timing metadata
   * Phase 5.6: Enhanced metadata - human-readable timing with British formatting
   * Phase 5.7: Enhanced with debug panel timing extraction
   *
   * @param {Object} response - API response with timing data
   * @param {Object} debugData - Debug panel data (optional)
   * @returns {Object} Enhanced timing info
   */
  generateEnhancedTiming(response, debugData = null) {
    logDebug("Generating enhanced timing metadata...");

    const now = new Date();

    // ISO timestamp
    const downloadTimestamp = now.toISOString();

    // British date format: "16 January 2025"
    const downloadDate = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Time with GMT: "15:30 GMT"
    const downloadTime =
      now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " GMT";

    // Processing duration - enhanced extraction
    let processingDuration = "Unknown";
    let processingDurationMs = 0;

    // Priority 1: Extract from debug panel timing format
    const debugTiming = debugData?.timing || this.extractTimingFromDebugPanel();
    if (debugTiming) {
      const parsedTiming = this.parseDebugTiming(debugTiming);
      if (parsedTiming.totalMs > 0) {
        processingDurationMs = parsedTiming.totalMs;
        processingDuration = `${parsedTiming.totalSeconds}s`;
        logInfo("Timing extracted from debug panel:", {
          debugTiming,
          parsedTiming,
        });
      }
    }

    // Priority 2: Fallback to response timing (original logic)
    if (processingDuration === "Unknown") {
      if (response?.processingTiming?.total) {
        processingDurationMs = response.processingTiming.total;
        const seconds = (processingDurationMs / 1000).toFixed(1);
        processingDuration = `${seconds}s`;
        logInfo("Timing extracted from response.processingTiming");
      } else if (response?.processing_time) {
        // Alternative format
        processingDurationMs = response.processing_time;
        const seconds = (processingDurationMs / 1000).toFixed(1);
        processingDuration = `${seconds}s`;
        logInfo("Timing extracted from response.processing_time");
      }
    }

    const timing = {
      downloadTimestamp,
      downloadDate,
      downloadTime,
      processingDuration,
      processingDurationMs,
    };

    logInfo("Enhanced timing generated:", timing);

    return timing;
  }

  /**
   * Extract timing from debug panel DOM
   * Phase 5.7: Helper for timing extraction
   * @returns {string|null} Timing string or null
   */
  extractTimingFromDebugPanel() {
    try {
      const timingElement = document.getElementById("debug-timing");
      const timing = timingElement?.textContent?.trim();
      logDebug("Timing extracted from debug panel:", timing);
      return timing || null;
    } catch (error) {
      logDebug("Failed to extract timing from debug panel:", error);
      return null;
    }
  }

  /**
   * Parse debug panel timing format
   * Phase 5.7: Parse "Total: 0.58s | Processing: 0.00s" format
   * @param {string} timingString - Timing string from debug panel
   * @returns {Object} Parsed timing info
   */
  parseDebugTiming(timingString) {
    const result = {
      totalSeconds: "0.0",
      totalMs: 0,
      processingSeconds: "0.0",
      processingMs: 0,
    };

    if (!timingString || typeof timingString !== "string") {
      return result;
    }

    try {
      // Parse format: "Total: 0.58s | Processing: 0.00s"
      const totalMatch = timingString.match(/Total:\s*([\d.]+)s/);
      const processingMatch = timingString.match(/Processing:\s*([\d.]+)s/);

      if (totalMatch) {
        result.totalSeconds = totalMatch[1];
        result.totalMs = Math.round(parseFloat(totalMatch[1]) * 1000);
      }

      if (processingMatch) {
        result.processingSeconds = processingMatch[1];
        result.processingMs = Math.round(parseFloat(processingMatch[1]) * 1000);
      }

      logDebug("Debug timing parsed:", { input: timingString, result });
    } catch (error) {
      logError("Failed to parse debug timing:", error);
    }

    return result;
  }

  /**
   * Endpoint to region mapping table
   * Phase 5.7: Maintainable endpoint mapping system
   * @private
   */
  static ENDPOINT_REGION_MAP = {
    // EU Endpoints
    "eu-central-1.api.mathpix.com":
      "European Union (Frankfurt) - Privacy-first processing",
    "eu-west-1.api.mathpix.com": "European Union (Ireland)",
    "eu-north-1.api.mathpix.com": "European Union (Stockholm)",

    // US Endpoints
    "us-east-1.api.mathpix.com": "United States (Virginia)",
    "us-west-1.api.mathpix.com": "United States (California)",
    "us-west-2.api.mathpix.com": "United States (Oregon)",

    // Asia Pacific Endpoints
    "ap-southeast-1.api.mathpix.com": "Asia Pacific (Singapore)",
    "ap-northeast-1.api.mathpix.com": "Asia Pacific (Tokyo)",
    "ap-south-1.api.mathpix.com": "Asia Pacific (Mumbai)",

    // Global/Legacy Endpoints
    "api.mathpix.com": "Global endpoint (USA)",
    "mathpix.com": "Global endpoint",

    // Development/Testing Endpoints
    "dev.api.mathpix.com": "Development environment",
    "staging.api.mathpix.com": "Staging environment",
    "beta.api.mathpix.com": "Beta environment",
  };

  /**
   * Extract geographic processing region from API endpoint
   * Phase 5.7: Lookup table-based region detection
   * @param {string} endpoint - API endpoint URL
   * @returns {string} Geographic region description
   */
  extractGeographicRegion(endpoint) {
    if (!endpoint || typeof endpoint !== "string") {
      logDebug("No endpoint provided for region extraction");
      return "Unknown region";
    }

    logDebug("Extracting geographic region from endpoint:", endpoint);

    // Clean the endpoint - remove protocol and path
    let cleanEndpoint = endpoint
      .replace(/^https?:\/\//, "") // Remove protocol
      .replace(/\/.*$/, ""); // Remove path and everything after

    logDebug("Cleaned endpoint for lookup:", cleanEndpoint);

    // Direct lookup in mapping table
    if (MathPixTotalDownloader.ENDPOINT_REGION_MAP[cleanEndpoint]) {
      const region = MathPixTotalDownloader.ENDPOINT_REGION_MAP[cleanEndpoint];
      logInfo("✓ Geographic region found:", region);
      return region;
    }

    // Fallback: Partial matching for known patterns
    for (const [pattern, description] of Object.entries(
      MathPixTotalDownloader.ENDPOINT_REGION_MAP
    )) {
      if (cleanEndpoint.includes(pattern.split(".")[0])) {
        // Match subdomain
        logInfo("✓ Geographic region found via pattern match:", description);
        return description;
      }
    }

    // Ultimate fallback
    logWarn("Geographic region not found for endpoint:", cleanEndpoint);
    return `Unknown region (${cleanEndpoint})`;
  }

  /**
   * Add new endpoint to region mapping
   * Phase 5.7: Runtime endpoint registration
   * @param {string} endpoint - Endpoint hostname
   * @param {string} description - Human-friendly description
   * @static
   */
  static addEndpointMapping(endpoint, description) {
    MathPixTotalDownloader.ENDPOINT_REGION_MAP[endpoint] = description;
    console.log(`✓ Added endpoint mapping: ${endpoint} → ${description}`);
  }

  /**
   * Get all registered endpoints
   * Phase 5.7: Debugging helper
   * @returns {Object} Current endpoint mappings
   * @static
   */
  static getEndpointMappings() {
    return { ...MathPixTotalDownloader.ENDPOINT_REGION_MAP };
  }

  // =========================================================================
  // DOWNLOAD UTILITIES
  // =========================================================================

  /**
   * Trigger browser download of blob
   *
   * @param {Blob} blob - File blob
   * @param {string} filename - Download filename
   */
  triggerDownload(blob, filename) {
    logInfo("Triggering browser download...", { filename, size: blob.size });

    try {
      // Create object URL
      const url = URL.createObjectURL(blob);

      // Create temporary link
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      logInfo("Download triggered successfully");
    } catch (error) {
      logError("Failed to trigger download:", error);
      throw error;
    }
  }

  // =========================================================================
  // PHASE 2: SOURCE FILE COLLECTION
  // =========================================================================

  /**
   * Detect which source type was used for this interaction
   * Phase 2: Detection logic for three source types
   *
   * @param {Object} state - Controller state or mock state data
   * @returns {string} - 'upload' | 'clipboard' | 'canvas'
   */
  detectSourceType(state) {
    logDebug("Detecting source type...", state);

    // Check for explicit sourceType property (mock data)
    if (state.sourceType) {
      logDebug("Source type from state property:", state.sourceType);
      return state.sourceType;
    }

    // Detect from available properties
    if (state.file) {
      logDebug("Detected upload source (file property present)");
      return "upload";
    }

    if (state.base64 || state.clipboardData) {
      logDebug("Detected clipboard source (base64/clipboardData present)");
      return "clipboard";
    }

    if (state.canvas || state.strokes) {
      logDebug("Detected canvas source (canvas/strokes present)");
      return "canvas";
    }

    // Fallback
    logWarn("Could not detect source type, defaulting to upload");
    return "upload";
  }

  /**
   * Create mock state data for testing
   * Phase 2: Simulate different source types
   *
   * @param {string} sourceType - 'upload' | 'clipboard' | 'canvas'
   * @returns {Object} - Mock state data
   */
  createMockState(sourceType) {
    logDebug("Creating mock state for source type:", sourceType);

    switch (sourceType) {
      case "upload":
        // Create mock File object
        const fileContent = "This is a test uploaded file";
        const blob = new Blob([fileContent], { type: "text/plain" });
        const file = new File([blob], "test-upload.txt", {
          type: "text/plain",
        });

        return {
          sourceType: "upload",
          file: file,
        };

      case "clipboard":
        // Create mock base64 image (1x1 red pixel PNG)
        const redPixelPNG =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

        return {
          sourceType: "clipboard",
          base64: `data:image/png;base64,${redPixelPNG}`,
        };

      case "canvas":
        // Create mock canvas
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");

        // Draw test content
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#000000";
        ctx.font = "24px Arial";
        ctx.fillText("Test Canvas", 150, 150);

        // Mock stroke data
        const strokes = [
          { x: [10, 20, 30], y: [10, 20, 30], t: [0, 100, 200] },
          { x: [50, 60, 70], y: [50, 60, 70], t: [300, 400, 500] },
        ];

        return {
          sourceType: "canvas",
          canvas: canvas,
          strokes: strokes,
        };

      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  }

  /**
   * Collect uploaded file
   * Phase 2: Handle file upload source type
   *
   * @param {Object} state - State containing file data
   * @param {JSZip.folder} sourceFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @returns {Promise<void>}
   */
  async collectUploadedFile(state, sourceFolder, result) {
    logInfo("Collecting uploaded file...");

    const file = state.file;
    if (!file) {
      throw new Error("No file found in state");
    }

    // Preserve extension but sanitise the filename
    const originalName = file.name;
    const extensionMatch = originalName.match(/(\.[^/.]+)$/);
    const extension = extensionMatch ? extensionMatch[0] : "";
    const baseName = originalName.replace(/\.[^/.]+$/, "");

    // Sanitise base name and reconstruct with extension
    const sanitizedBase = this.sanitizeFilename(baseName);
    const filename = (sanitizedBase || "uploaded-file") + extension;

    logDebug("Original filename:", originalName);
    logDebug("Sanitised filename:", filename);

    // Add file to ZIP
    sourceFolder.file(filename, file);

    result.filesCollected.push({
      type: "upload",
      filename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    logInfo(`✓ Uploaded file collected: ${filename} (${file.size} bytes)`);
  }

  /**
   * Convert base64 string to blob
   * Phase 2: Utility for clipboard image conversion
   *
   * @param {string} base64 - Base64 encoded data (with or without data URI prefix)
   * @param {string} mimeType - MIME type for the blob
   * @returns {Promise<Blob>} - Decoded blob
   */
  async base64ToBlob(base64, mimeType) {
    logDebug("Converting base64 to blob...", { mimeType });

    try {
      // Remove data URI prefix if present
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

      // Decode base64
      const byteString = atob(base64Data);
      const byteArray = new Uint8Array(byteString.length);

      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([byteArray], { type: mimeType });

      logDebug("Base64 conversion successful:", blob.size, "bytes");
      return blob;
    } catch (error) {
      logError("Base64 conversion failed:", error);
      throw error;
    }
  }

  /**
   * Convert clipboard base64 image to JPG and add to ZIP
   * Phase 2: Handle clipboard paste source type
   *
   * @param {Object} state - State containing base64 data
   * @param {JSZip.folder} sourceFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @returns {Promise<void>}
   */
  async collectClipboardImage(state, sourceFolder, result) {
    logInfo("Collecting clipboard image...");

    const base64Data = state.base64 || state.clipboardData;
    if (!base64Data) {
      throw new Error("No clipboard data found in state");
    }

    // Convert base64 to JPG blob
    const mimeType = "image/jpeg";
    const blob = await this.base64ToBlob(base64Data, mimeType);

    // Add to ZIP
    const filename = "clipboard-image.jpg";
    sourceFolder.file(filename, blob);

    result.filesCollected.push({
      type: "clipboard",
      filename,
      size: blob.size,
      mimeType,
    });

    logInfo(`✓ Clipboard image collected: ${filename} (${blob.size} bytes)`);
  }

  /**
   * Convert canvas to blob with specified format
   * Phase 2: Utility for canvas snapshot conversion
   *
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {string} format - MIME type (e.g., 'image/png', 'image/jpeg')
   * @param {number} quality - Quality for lossy formats (0.0-1.0)
   * @returns {Promise<Blob>} - Image blob
   */
  canvasToBlob(canvas, format = "image/png", quality = 1.0) {
    logDebug("Converting canvas to blob...", { format, quality });

    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              logDebug("Canvas conversion successful:", blob.size, "bytes");
              resolve(blob);
            } else {
              reject(new Error("Canvas toBlob returned null"));
            }
          },
          format,
          quality
        );
      } catch (error) {
        logError("Canvas conversion failed:", error);
        reject(error);
      }
    });
  }

  /**
   * Collect canvas drawing and stroke data
   * Phase 2: Handle canvas drawing source type
   *
   * @param {Object} state - State containing canvas and stroke data
   * @param {JSZip.folder} sourceFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @returns {Promise<void>}
   */
  async collectCanvasDrawing(state, sourceFolder, result) {
    logInfo("Collecting canvas drawing...");

    const canvas = state.canvas;
    const strokes = state.strokes;

    if (!canvas) {
      throw new Error("No canvas found in state");
    }

    // Convert canvas to PNG blob
    const pngBlob = await this.canvasToBlob(canvas, "image/png");
    const pngFilename = "canvas-drawing.png";

    sourceFolder.file(pngFilename, pngBlob);

    result.filesCollected.push({
      type: "canvas-image",
      filename: pngFilename,
      size: pngBlob.size,
      mimeType: "image/png",
      dimensions: {
        width: canvas.width,
        height: canvas.height,
      },
    });

    logInfo(
      `✓ Canvas snapshot collected: ${pngFilename} (${canvas.width}x${canvas.height})`
    );

    // Collect stroke data if available
    if (strokes && Array.isArray(strokes) && strokes.length > 0) {
      const strokesJson = JSON.stringify(strokes, null, 2);
      const strokesFilename = "strokes-data.json";

      sourceFolder.file(strokesFilename, strokesJson);

      result.filesCollected.push({
        type: "stroke-data",
        filename: strokesFilename,
        size: strokesJson.length,
        strokeCount: strokes.length,
      });

      logInfo(
        `✓ Stroke data collected: ${strokesFilename} (${strokes.length} strokes)`
      );
    }
  }

  /**
   * Collect all source files based on interaction type
   * Phase 2: Main orchestration method
   *
   * @param {Object} state - Controller state or mock state data
   * @param {JSZip.folder} sourceFolder - ZIP folder to add files to
   * @returns {Promise<Object>} - Collection result with success/failure details
   */
  async collectSourceFiles(state, sourceFolder) {
    logInfo("Collecting source files...");

    const sourceType = this.detectSourceType(state);
    logInfo(`Detected source type: ${sourceType}`);

    const result = {
      sourceType,
      filesCollected: [],
      errors: [],
    };

    try {
      switch (sourceType) {
        case "upload":
          await this.collectUploadedFile(state, sourceFolder, result);
          break;
        case "clipboard":
          await this.collectClipboardImage(state, sourceFolder, result);
          break;
        case "canvas":
          await this.collectCanvasDrawing(state, sourceFolder, result);
          break;
        default:
          throw new Error(`Unknown source type: ${sourceType}`);
      }

      logInfo(`Source files collected: ${result.filesCollected.length}`);
      return result;
    } catch (error) {
      logError("Failed to collect source files:", error);
      result.errors.push({ error: error.message });
      return result;
    }
  }

  // =========================================================================
  // PHASE 3: RESULTS FORMAT COLLECTION
  // =========================================================================

  /**
   * Detect which API type was used for this interaction
   * Phase 3: Detection logic for three API types
   *
   * @param {Object} response - API response object
   * @returns {string} - 'text' | 'pdf' | 'strokes'
   */
  detectApiType(response) {
    logDebug("Detecting API type...", response);

    // Check for explicit apiType property (mock data)
    if (response.apiType) {
      logDebug("API type from response property:", response.apiType);
      return response.apiType;
    }

    // Detect from response structure
    // PDF API: has pdf_id and PDF-specific formats
    if (response.pdf_id || response.mmd || response.docx) {
      logDebug("Detected PDF API (pdf_id/mmd/docx present)");
      return "pdf";
    }

    // Strokes API: has stroke_count or canvas_dimensions
    if (response.stroke_count || response.canvas_dimensions) {
      logDebug("Detected Strokes API (stroke_count/canvas_dimensions present)");
      return "strokes";
    }

    // Text API: default/fallback (has text/latex_styled)
    if (response.text || response.latex_styled || response.data) {
      logDebug("Detected Text API (default)");
      return "text";
    }

    // Fallback
    logWarn("Could not detect API type, defaulting to text");
    return "text";
  }

  /**
   * Create mock API response for testing
   * Phase 3: Simulate different API responses
   *
   * @param {string} apiType - 'text' | 'pdf' | 'strokes'
   * @returns {Object} - Mock API response
   */
  createMockResponse(apiType) {
    logDebug("Creating mock response for API type:", apiType);

    switch (apiType) {
      case "text":
        return {
          apiType: "text", // Explicit marker for testing
          request_id: "2025_10_15_test_text",
          version: "3.0",
          confidence: 0.98,
          text: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
          latex_styled: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
          html: '<div class="math">x = <span class="math-tex">\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}</span></div>',
          data: [
            {
              type: "mathml",
              value:
                '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi><mo>=</mo><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt><msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></math>',
            },
            {
              type: "asciimath",
              value: "x = (-b +- sqrt(b^2 - 4ac))/(2a)",
            },
          ],
        };

      case "pdf":
        return {
          apiType: "pdf", // Explicit marker for testing
          pdf_id: "test_pdf_123",
          version: "3.0",
          mmd: "# Test Document\n\n$$x = 2$$\n\nThis is a test PDF document.",
          md: "# Test Document\n\nx = 2\n\nThis is a test PDF document.",
          html: "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test Document</h1><p>x = 2</p></body></html>",
          docx: new Blob(["Mock DOCX content"], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          "tex.zip": new Blob(["Mock LaTeX ZIP content"], {
            type: "application/zip",
          }),
        };

      case "strokes":
        return {
          apiType: "strokes", // Explicit marker for testing
          request_id: "2025_10_15_test_strokes",
          version: "3.0",
          confidence: 0.95,
          stroke_count: 5,
          canvas_dimensions: { width: 400, height: 300 },
          text: "a^2 + b^2 = c^2",
          latex_styled: "a^2 + b^2 = c^2",
          html: '<div class="math">a² + b² = c²</div>',
          data: [
            {
              type: "mathml",
              value:
                '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup><mo>=</mo><msup><mi>c</mi><mn>2</mn></msup></math>',
            },
            {
              type: "asciimath",
              value: "a^2 + b^2 = c^2",
            },
          ],
        };

      default:
        throw new Error(`Unknown API type: ${apiType}`);
    }
  }

  /**
   * Generate Markdown from API response (client-side)
   * Phase 3: Convert LaTeX to Markdown format
   *
   * @param {Object} response - API response
   * @returns {string|null} - Markdown content or null if not available
   */
  generateMarkdownFromResponse(response) {
    logDebug("Generating Markdown from response...");

    // Get LaTeX content
    const latex = response.latex_styled || response.text;
    if (!latex) {
      logDebug("No LaTeX content available for Markdown generation");
      return null;
    }

    // Simple conversion: wrap LaTeX in $$ delimiters for display math
    const markdown = `# Mathematics Conversion\n\n$$\n${latex}\n$$\n`;

    logDebug("Markdown generated successfully");
    return markdown;
  }

  /**
   * Convert TSV table data to Markdown format
   * Phase 3: Client-side table conversion
   *
   * @param {string} tsv - Tab-separated values
   * @returns {string} - Markdown table
   */
  convertTsvToMarkdown(tsv) {
    logDebug("Converting TSV to Markdown...");

    if (!tsv || typeof tsv !== "string") {
      logWarn("Invalid TSV data provided");
      return "";
    }

    const lines = tsv.trim().split("\n");
    if (lines.length === 0) {
      logWarn("Empty TSV data");
      return "";
    }

    // Parse TSV
    const rows = lines.map((line) => line.split("\t"));

    // Build Markdown table
    let markdown = "";

    // Header row
    markdown += "| " + rows[0].join(" | ") + " |\n";

    // Separator row
    markdown += "| " + rows[0].map(() => "---").join(" | ") + " |\n";

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      markdown += "| " + rows[i].join(" | ") + " |\n";
    }

    logDebug("TSV to Markdown conversion complete");
    return markdown;
  }

  /**
   * Collect table-specific formats
   * Phase 3: Handle table data from API responses
   *
   * @param {Object} tableData - Table data from API response
   * @param {JSZip.folder} resultsFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @returns {Promise<void>}
   */
  async collectTableFormats(tableData, resultsFolder, result) {
    logInfo("Collecting table formats...");

    if (!tableData) {
      logDebug("No table data provided");
      return;
    }

    // HTML table
    if (tableData.html) {
      resultsFolder.file("table.html", tableData.html);
      result.filesCollected.push({
        type: "table-html",
        filename: "table.html",
        size: tableData.html.length,
        format: "text/html",
      });
      logInfo("✓ Table HTML collected");
    }

    // TSV table
    if (tableData.tsv) {
      resultsFolder.file("table.tsv", tableData.tsv);
      result.filesCollected.push({
        type: "table-tsv",
        filename: "table.tsv",
        size: tableData.tsv.length,
        format: "text/tab-separated-values",
      });
      logInfo("✓ Table TSV collected");
    }

    // Generate Markdown table from TSV (client-side)
    if (tableData.tsv) {
      const markdownTable = this.convertTsvToMarkdown(tableData.tsv);
      if (markdownTable) {
        resultsFolder.file("table.md", markdownTable);
        result.filesCollected.push({
          type: "table-markdown",
          filename: "table.md",
          size: markdownTable.length,
          format: "text/markdown",
        });
        logInfo("✓ Table Markdown generated");
      }
    }

    logInfo(`Table formats collected: ${result.filesCollected.length} files`);
  }

  /**
   * Collect formats from Text API response
   * Phase 3: Comprehensive format collection for Text API
   * Phase 5.5: Smart detection of format source (result renderer OR raw API response)
   *
   * @param {Object} data - Either formats from result renderer OR raw API response
   * @param {JSZip.folder} resultsFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @returns {Promise<void>}
   */
  async collectTextApiFormats(
    data,
    resultsFolder,
    result,
    baseFilename = null
  ) {
    logInfo("Collecting Text API formats...");

    // Helper function to check if format is valid (not empty/null)
    const isValidFormat = (value) =>
      value && value.trim && value.trim().length > 0;

    // SMART DETECTION: Is this result renderer formats or raw API response?
    const isResultRenderer = !!data.latex; // Result renderer has 'latex'
    const isRawResponse = !!data.latex_styled; // Raw API has 'latex_styled'

    logInfo(
      `Format source detected: ${
        isResultRenderer
          ? "Result Renderer"
          : isRawResponse
          ? "Raw API Response"
          : "Unknown"
      }`
    );

    // ========================================================================
    // COLLECT LATEX
    // ========================================================================
    let latexContent = null;
    if (isResultRenderer && isValidFormat(data.latex)) {
      latexContent = data.latex;
    } else if (isRawResponse && isValidFormat(data.latex_styled)) {
      latexContent = data.latex_styled;
    } else if (isRawResponse && isValidFormat(data.text)) {
      latexContent = data.text;
    }

    if (latexContent) {
      const latexFilename = baseFilename ? `${baseFilename}.tex` : "latex.tex";
      resultsFolder.file(latexFilename, latexContent);
      result.filesCollected.push({
        type: "latex",
        filename: "latex.tex",
        size: latexContent.length,
        format: "text/x-latex",
      });
      logInfo("✓ LaTeX collected");
    }

    // ========================================================================
    // COLLECT MATHML
    // ========================================================================
    let mathmlContent = null;
    if (isResultRenderer && isValidFormat(data.mathml)) {
      mathmlContent = data.mathml;
    } else if (isRawResponse && Array.isArray(data.data)) {
      const mathmlData = data.data.find((d) => d.type === "mathml");
      if (mathmlData && isValidFormat(mathmlData.value)) {
        mathmlContent = mathmlData.value;
      }
    }

    if (mathmlContent) {
      const mathmlFilename = baseFilename
        ? `${baseFilename}.xml`
        : "mathml.xml";
      resultsFolder.file(mathmlFilename, mathmlContent);
      result.filesCollected.push({
        type: "mathml",
        filename: "mathml.xml",
        size: mathmlContent.length,
        format: "application/mathml+xml",
      });
      logInfo("✓ MathML collected");
    }

    // ========================================================================
    // COLLECT ASCIIMATH
    // ========================================================================
    let asciimathContent = null;
    if (isResultRenderer && isValidFormat(data.asciimath)) {
      asciimathContent = data.asciimath;
    } else if (isRawResponse && Array.isArray(data.data)) {
      const asciimathData = data.data.find((d) => d.type === "asciimath");
      if (asciimathData && isValidFormat(asciimathData.value)) {
        asciimathContent = asciimathData.value;
      }
    }

    if (asciimathContent) {
      const asciimathFilename = baseFilename
        ? `${baseFilename}-asciimath.txt`
        : "asciimath.txt";
      resultsFolder.file(asciimathFilename, asciimathContent);
      result.filesCollected.push({
        type: "asciimath",
        filename: "asciimath.txt",
        size: asciimathContent.length,
        format: "text/plain",
      });
      logInfo("✓ AsciiMath collected");
    }

    // ========================================================================
    // COLLECT HTML
    // ========================================================================
    if (isValidFormat(data.html)) {
      const htmlFilename = baseFilename ? `${baseFilename}.html` : "html.html";
      resultsFolder.file(htmlFilename, data.html);
      result.filesCollected.push({
        type: "html",
        filename: "html.html",
        size: data.html.length,
        format: "text/html",
      });
      logInfo("✓ HTML collected");
    }

    // ========================================================================
    // COLLECT TABLE FORMATS
    // ========================================================================

    // Result Renderer format (already processed)
    if (isResultRenderer) {
      if (isValidFormat(data.tableHtml)) {
        resultsFolder.file("table.html", data.tableHtml);
        result.filesCollected.push({
          type: "table-html",
          filename: "table.html",
          size: data.tableHtml.length,
          format: "text/html",
        });
        logInfo("✓ Table HTML collected (result renderer)");
      }

      if (isValidFormat(data.tableTsv) || isValidFormat(data.tsv)) {
        const tsvContent = data.tableTsv || data.tsv;
        resultsFolder.file("table.tsv", tsvContent);
        result.filesCollected.push({
          type: "table-tsv",
          filename: "table.tsv",
          size: tsvContent.length,
          format: "text/tab-separated-values",
        });
        logInfo("✓ Table TSV collected (result renderer)");
      }

      if (isValidFormat(data.tableMarkdown)) {
        resultsFolder.file("table.md", data.tableMarkdown);
        result.filesCollected.push({
          type: "table-markdown",
          filename: "table.md",
          size: data.tableMarkdown.length,
          format: "text/markdown",
        });
        logInfo("✓ Table Markdown collected (result renderer)");
      }
    }

    // Raw API Response format (extract from data array)
    if (isRawResponse && Array.isArray(data.data)) {
      // Extract table HTML from data array
      const tableHtmlData = data.data.find((d) => d.type === "html");
      if (tableHtmlData && isValidFormat(tableHtmlData.value)) {
        resultsFolder.file("table.html", tableHtmlData.value);
        result.filesCollected.push({
          type: "table-html",
          filename: "table.html",
          size: tableHtmlData.value.length,
          format: "text/html",
        });
        logInfo("✓ Table HTML collected (raw API)");
      }

      // Extract TSV from data array
      const tsvData = data.data.find((d) => d.type === "tsv");
      if (tsvData && isValidFormat(tsvData.value)) {
        resultsFolder.file("table.tsv", tsvData.value);
        result.filesCollected.push({
          type: "table-tsv",
          filename: "table.tsv",
          size: tsvData.value.length,
          format: "text/tab-separated-values",
        });
        logInfo("✓ Table TSV collected (raw API)");

        // Generate Markdown table from TSV (client-side)
        const markdownTable = this.convertTsvToMarkdown(tsvData.value);
        if (markdownTable) {
          resultsFolder.file("table.md", markdownTable);
          result.filesCollected.push({
            type: "table-markdown",
            filename: "table.md",
            size: markdownTable.length,
            format: "text/markdown",
          });
          logInfo("✓ Table Markdown generated from TSV (raw API)");
        }
      }
    }
    // ========================================================================
    // COLLECT MARKDOWN
    // ========================================================================
    if (isResultRenderer && isValidFormat(data.markdown)) {
      const markdownFilename = baseFilename
        ? `${baseFilename}.md`
        : "markdown.md";
      resultsFolder.file(markdownFilename, data.markdown);
      result.filesCollected.push({
        type: "markdown",
        filename: "markdown.md",
        size: data.markdown.length,
        format: "text/markdown",
      });
      logInfo("✓ Markdown collected");
    } else if (latexContent) {
      // Generate Markdown from LaTeX if not already present
      const markdown = `# Mathematics Conversion\n\n$$\n${latexContent}\n$$\n`;
      const markdownFilename = baseFilename
        ? `${baseFilename}.md`
        : "markdown.md";
      resultsFolder.file(markdownFilename, markdown);
      result.filesCollected.push({
        type: "markdown",
        filename: "markdown.md",
        size: markdown.length,
        format: "text/markdown",
      });
      logInfo("✓ Markdown generated from LaTeX");
    }

    // ========================================================================
    // COLLECT JSON
    // ========================================================================
    if (isResultRenderer && isValidFormat(data.rawJson)) {
      const jsonFilename = baseFilename
        ? `${baseFilename}-response.json`
        : "api-response.json";
      resultsFolder.file(jsonFilename, data.rawJson);
      result.filesCollected.push({
        type: "json",
        filename: "api-response.json",
        size: data.rawJson.length,
        format: "application/json",
      });
      logInfo("✓ Raw JSON collected");
    } else if (isRawResponse) {
      // Generate JSON from raw response object
      const jsonContent = JSON.stringify(data, null, 2);
      const jsonFilename = baseFilename
        ? `${baseFilename}-response.json`
        : "api-response.json";
      resultsFolder.file(jsonFilename, jsonContent);
      result.filesCollected.push({
        type: "json",
        filename: "api-response.json",
        size: jsonContent.length,
        format: "application/json",
      });
      logInfo("✓ JSON generated from raw response");
    }

    logInfo(`Text API formats collected: ${result.filesCollected.length}`);
  }

  /**
   * Collect formats from PDF API conversion results
   * Phase 3: Handle all PDF API output formats
   * Phase 5.5 Step 2.1: Added base filename support for descriptive filenames
   *
   * @param {Object} conversionResult - PDF API conversion response
   * @param {JSZip.folder} resultsFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @param {string|null} baseFilename - Base filename from source (optional)
   * @returns {Promise<void>}
   */
  async collectPdfApiFormats(
    conversionResult,
    resultsFolder,
    result,
    baseFilename = null
  ) {
    logInfo("Collecting PDF API formats...");

    // Text formats - use descriptive filenames when available
    const textFormats = {
      mmd: {
        filename: baseFilename ? `${baseFilename}.mmd` : "mmd.mmd",
        format: "text/x-mmd",
      },
      md: {
        filename: baseFilename ? `${baseFilename}.md` : "markdown.md",
        format: "text/markdown",
      },
      html: {
        filename: baseFilename ? `${baseFilename}.html` : "html.html",
        format: "text/html",
      },
    };

    for (const [key, info] of Object.entries(textFormats)) {
      if (conversionResult[key]) {
        resultsFolder.file(info.filename, conversionResult[key]);
        result.filesCollected.push({
          type: key,
          filename: info.filename,
          size: conversionResult[key].length,
          format: info.format,
        });
        logInfo(`✓ ${key.toUpperCase()} collected`);
      }
    }

    // Binary formats (pass-through as Blobs) - use descriptive filenames when available
    const binaryFormats = {
      docx: {
        filename: baseFilename ? `${baseFilename}.docx` : "document.docx",
        format:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      pptx: {
        filename: baseFilename ? `${baseFilename}.pptx` : "presentation.pptx",
        format:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      pdf: {
        filename: baseFilename
          ? `${baseFilename}-rendered.pdf`
          : "rendered.pdf",
        format: "application/pdf",
      },
    };

    for (const [key, info] of Object.entries(binaryFormats)) {
      if (conversionResult[key] instanceof Blob) {
        resultsFolder.file(info.filename, conversionResult[key]);
        result.filesCollected.push({
          type: key,
          filename: info.filename,
          size: conversionResult[key].size,
          format: info.format,
          binary: true,
        });
        logInfo(`✓ ${key.toUpperCase()} (binary) collected`);
      }
    }

    // Nested ZIP formats (do NOT extract - add as-is) - use descriptive filenames when available
    const zipFormats = {
      "tex.zip": {
        filename: baseFilename ? `${baseFilename}-latex.zip` : "latex.zip",
      },
      "mmd.zip": {
        filename: baseFilename ? `${baseFilename}-mmd.zip` : "mmd-archive.zip",
      },
      "md.zip": {
        filename: baseFilename ? `${baseFilename}-md.zip` : "md-archive.zip",
      },
      "html.zip": {
        filename: baseFilename
          ? `${baseFilename}-html.zip`
          : "html-archive.zip",
      },
    };

    for (const [key, info] of Object.entries(zipFormats)) {
      if (conversionResult[key] instanceof Blob) {
        resultsFolder.file(info.filename, conversionResult[key]);
        result.filesCollected.push({
          type: "zip",
          filename: info.filename,
          size: conversionResult[key].size,
          format: "application/zip",
          binary: true,
          nested: true, // Flag to indicate this is a nested ZIP
        });
        logInfo(`✓ ${info.filename} (nested ZIP) collected`);
      }
    }

    logInfo(`PDF API formats collected: ${result.filesCollected.length}`);
  }

  /**
   * Collect formats from Strokes API response
   * Phase 3: Strokes API uses same structure as Text API
   * Phase 5.5 Step 2.1: Pass through base filename to Text API collector
   *
   * NOTE: Strokes API returns identical format structure to Text API,
   * just with additional stroke-related metadata (handled in Phase 4)
   *
   * @param {Object} response - Strokes API response
   * @param {JSZip.folder} resultsFolder - ZIP folder to add files to
   * @param {Object} result - Result object to populate
   * @param {string|null} baseFilename - Base filename from source (optional)
   * @returns {Promise<void>}
   */
  async collectStrokesApiFormats(
    response,
    resultsFolder,
    result,
    baseFilename = null
  ) {
    logInfo("Collecting Strokes API formats...");

    // Strokes API has same format structure as Text API - pass through base filename
    await this.collectTextApiFormats(
      response,
      resultsFolder,
      result,
      baseFilename
    );

    logInfo(`Strokes API formats collected: ${result.filesCollected.length}`);
  }

  /**
   * Collect all result files based on API type
   * Phase 3: Main orchestration method
   * Phase 5.5: Updated to accept format data (not raw response)
   * Phase 5.5 Step 2.1: Added base filename support
   *
   * @param {Object} formats - Format data from result renderer
   * @param {JSZip.folder} resultsFolder - ZIP folder to add files to
   * @param {Object} sourceResult - Source collection result for filename generation
   * @returns {Promise<Object>} - Collection result with success/failure details
   */
  async collectResultFiles(formats, resultsFolder, sourceResult) {
    logInfo("Collecting result files...");

    const apiType = this.detectApiType(formats);
    logInfo(`Detected API type: ${apiType}`);

    // Extract base filename from source for better result naming
    const baseFilename = this.extractBaseFilenameForResults(sourceResult);

    if (baseFilename) {
      logInfo(`Using base filename for results: "${baseFilename}"`);
    } else {
      logInfo("Using default filenames (no source filename available)");
    }

    const result = {
      apiType,
      filesCollected: [],
      errors: [],
    };

    try {
      switch (apiType) {
        case "text":
          await this.collectTextApiFormats(
            formats,
            resultsFolder,
            result,
            baseFilename
          );
          break;
        case "pdf":
          await this.collectPdfApiFormats(
            formats,
            resultsFolder,
            result,
            baseFilename
          );
          break;
        case "strokes":
          await this.collectStrokesApiFormats(
            formats,
            resultsFolder,
            result,
            baseFilename
          );
          break;
        default:
          throw new Error(`Unknown API type: ${apiType}`);
      }

      logInfo(`Result files collected: ${result.filesCollected.length}`);
      return result;
    } catch (error) {
      logError("Failed to collect result files:", error);
      result.errors.push({ error: error.message });
      return result;
    }
  }
  // =========================================================================
  // PHASE 4: DATA & DEBUG COLLECTION
  // =========================================================================

  /**
   * Sanitize API request by removing credentials
   * Phase 4: Critical for security - NEVER include API keys in archives
   *
   * @param {Object} request - Original API request object
   * @returns {Object} - Sanitized request safe for archival
   */
  sanitizeApiRequest(request) {
    logInfo("Sanitizing API request...");

    if (!request) {
      logWarn("No request to sanitize");
      return null;
    }

    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(request));

    // Remove ALL possible credential fields
    delete sanitized.app_id;
    delete sanitized.app_key;
    delete sanitized.app_token;
    delete sanitized.api_key;
    delete sanitized.apiKey;
    delete sanitized.authorization;
    delete sanitized.Authorization;

    // Add sanitization metadata
    sanitized._sanitized = true;
    sanitized._sanitization_date = new Date().toISOString();
    sanitized._note = "API credentials removed for security";

    logInfo("✓ API request sanitized");
    return sanitized;
  }

  /**
   * Format debug panel content as Markdown
   * Phase 4: Extract and format debug information
   *
   * For Phase 4 testing, accept mock debug data
   * For Phase 5 integration, extract from DOM
   *
   * @param {Object|string} debugData - Debug information (mock or DOM-extracted)
   * @returns {string} - Formatted Markdown content
   */
  formatDebugInfo(debugData) {
    logInfo("Formatting debug information...");

    // Phase 4: Handle mock data (string or object)
    if (typeof debugData === "string") {
      logDebug("Using provided debug string");
      return debugData;
    }

    if (debugData && typeof debugData === "object") {
      logDebug("Formatting debug object as Markdown");

      let markdown = "# Debug Information\n\n";

      // Request section
      if (debugData.request) {
        markdown += "## Request Details\n\n";
        markdown += "```json\n";
        markdown += JSON.stringify(debugData.request, null, 2);
        markdown += "\n```\n\n";
      }

      // Response section
      if (debugData.response) {
        markdown += "## Response Metadata\n\n";
        for (const [key, value] of Object.entries(debugData.response)) {
          markdown += `- **${key}**: ${value}\n`;
        }
        markdown += "\n";
      }

      // Processing section
      if (debugData.processing) {
        markdown += "## Processing Details\n\n";
        for (const [key, value] of Object.entries(debugData.processing)) {
          markdown += `- **${key}**: ${value}\n`;
        }
        markdown += "\n";
      }

      logInfo("✓ Debug information formatted");
      return markdown;
    }

    // Fallback
    logWarn("No debug data available");
    return "# Debug Information\n\nNo debug information available for this session.\n";
  }

  /**
   * Detect content type from response
   * Phase 4: Helper for metadata generation
   * Phase 5.5: Fixed to handle result renderer format structure
   *
   * @param {Object} response - Format data from result renderer
   * @returns {string} - Content type: 'math' | 'text' | 'table' | 'mixed'
   */
  detectContentType(response) {
    // Check for table formats
    if (response.tableHtml || response.tableTsv || response.tableMarkdown) {
      return "table";
    }

    // Check for mathematics (presence of LaTeX or MathML)
    const hasLatex = response.latex || response.latex_styled;
    const hasMathML = response.mathml;
    if (hasLatex || hasMathML) return "math";

    // Check for general text/html content
    if (response.html || response.text) return "text";

    // Default
    return "math"; // Most MathPix content is mathematical
  }

  /**
   * Generate comprehensive metadata.json
   * Phase 4: Create structured metadata for the archive
   * Phase 5.6: Enhanced with file sizes, processing mode, and timing
   * Phase 5.7b: Enhanced with PDF debug data integration
   *
   * @param {Object} sourceResult - Result from collectSourceFiles()
   * @param {Object} resultsResult - Result from collectResultFiles()
   * @param {Object} response - API response
   * @returns {Object} - Structured metadata object
   */
  generateMetadata(sourceResult, resultsResult, response) {
    logInfo("Generating metadata...");

    // Calculate file size statistics (Phase 5.6)
    const sourceTotalSize = this.calculateTotalSize(
      sourceResult.filesCollected
    );
    const resultsTotalSize = this.calculateTotalSize(
      resultsResult.filesCollected
    );
    const totalSize = sourceTotalSize + resultsTotalSize;

    // Create file size maps (Phase 5.6)
    const sourceFileSizes = this.createFileSizeMap(sourceResult.filesCollected);
    const resultFileSizes = this.createFileSizeMap(
      resultsResult.filesCollected
    );

    // Extract debug data for enhanced processing (Phase 5.7 + 5.7b)
    const debugData = this.getRealDebugData ? this.getRealDebugData() : null;

    // Detect processing mode (Phase 5.6 + 5.7) - now with debug data
    const processingModeInfo = this.detectProcessingMode(
      sourceResult,
      response,
      debugData
    );

    // Generate enhanced timing (Phase 5.6 + 5.7) - now with debug data
    const enhancedTiming = this.generateEnhancedTiming(response, debugData);

    // Extract source filename (Phase 5.6)
    const sourceFileName =
      sourceResult.filesCollected[0]?.originalName ||
      sourceResult.filesCollected[0]?.filename ||
      null;

    // Phase 5.7b: Parse confidence values from debug data for PDF
    const confidenceValue = this.parseConfidenceValue(
      debugData?.confidence,
      response.confidence
    );
    const confidenceRateValue = this.parseConfidenceValue(
      debugData?.confidenceRate,
      response.confidence_rate
    );

    const metadata = {
      // Download metadata
      download: {
        timestamp: new Date().toISOString(),
        archiveVersion: "1.0",
        generatedBy: "MathPix Total Downloader",
        sourceType: sourceResult.sourceType,
        apiType: resultsResult.apiType,
      },

      // Processing metadata (enhanced in Phase 5.6 + 5.7b)
      processing: {
        // Phase 5.7b: Prioritize debug panel data for PDF
        requestId:
          debugData?.requestId !== "Unknown"
            ? debugData.requestId
            : response.request_id || response.pdf_id || "unknown",
        apiVersion:
          debugData?.apiVersion !== "Unknown"
            ? debugData.apiVersion
            : response.version || "unknown",
        confidence: confidenceValue,
        confidenceRate: confidenceRateValue,
        processingModel:
          debugData?.processingModel !== "Unknown"
            ? debugData.processingModel
            : null,
        isHandwritten: response.is_handwritten || false,
        isPrinted: response.is_printed || false,
        // Phase 5.6: Processing context fields
        processingMode: processingModeInfo.mode,
        inputSource: processingModeInfo.source,
        sourceFileName: sourceFileName,
      },

      // Content analysis - Phase 5.7b: Enhanced with Lines API data
      content: {
        detectedType: this.detectContentType(response),
        // Phase 5.7b: Use Lines API line count if available (PDF), fallback to response
        lineCount:
          debugData?.linesApi?.lineCount || response.line_data?.length || 0,
        mathElements: debugData?.linesApi?.mathElements || 0,
        handwrittenLines: debugData?.linesApi?.handwrittenLines || 0,
        printedLines: debugData?.linesApi?.printedLines || 0,
        containsTable:
          response.contains_table || response.containsTable || false,
        // Phase 5.7b: Enhanced table detection using Lines API
        hasTable: this.detectTableFromMultipleSourcesEnhanced(
          response,
          debugData
        ),
      },

      // Formats included (enhanced in Phase 5.6)
      formats: {
        source: sourceResult.filesCollected.map((f) => f.type),
        results: resultsResult.filesCollected.map((f) => f.type),
        sourceCount: sourceResult.filesCollected.length,
        resultsCount: resultsResult.filesCollected.length,
        totalFiles:
          sourceResult.filesCollected.length +
          resultsResult.filesCollected.length,
        // Phase 5.6: NEW fields
        totalSize: this.formatFileSize(totalSize),
        sourceTotalSize: this.formatFileSize(sourceTotalSize),
        resultsTotalSize: this.formatFileSize(resultsTotalSize),
        sourceFileSizes: sourceFileSizes,
        resultFileSizes: resultFileSizes,
      },

      // File manifest
      files: {
        source: sourceResult.filesCollected.map((f) => ({
          filename: f.filename,
          size: f.size,
          type: f.type,
        })),
        results: resultsResult.filesCollected.map((f) => ({
          filename: f.filename,
          size: f.size,
          type: f.type,
          format: f.format,
        })),
      },

      // Phase 5.6: Timing section
      timing: enhancedTiming,
    };

    logInfo("✓ Metadata generated (Phase 5.7b enhanced with PDF debug data)");
    return metadata;
  }

  /**
   * Parse confidence value from debug panel or API response
   * Phase 5.7b: Helper for confidence extraction
   * @param {string} debugValue - Value from debug panel (e.g., "100.0%")
   * @param {number} responseValue - Value from API response (e.g., 1.0 or 0.98)
   * @returns {number|null} Normalized confidence value (0-1) or null
   */
  parseConfidenceValue(debugValue, responseValue) {
    // Try debug panel value first (PDF processing)
    if (
      debugValue &&
      debugValue !== "Unknown" &&
      typeof debugValue === "string"
    ) {
      // Parse percentage string: "100.0%" -> 1.0
      const percentMatch = debugValue.match(/([\d.]+)%/);
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        const normalized = percent / 100;
        logDebug(
          `Confidence parsed from debug panel: ${debugValue} -> ${normalized}`
        );
        return normalized;
      }
    }

    // Fallback to API response value
    if (typeof responseValue === "number") {
      logDebug(`Confidence from API response: ${responseValue}`);
      return responseValue;
    }

    return null;
  }

  /**
   * Enhanced table detection with Lines API integration
   * Phase 5.7b: Use Lines API table count for PDF processing
   * @param {Object} response - API response
   * @param {Object} debugData - Debug data with Lines API statistics
   * @returns {boolean} True if table detected
   */
  detectTableFromMultipleSourcesEnhanced(response, debugData) {
    // Phase 5.7b: Priority 1 - Lines API table count (PDF processing)
    if (debugData?.linesApi?.tableCount > 0) {
      logInfo(
        "✓ Table detected from Lines API statistics:",
        debugData.linesApi.tableCount
      );
      return true;
    }

    // Fallback to original multi-source detection
    return this.detectTableFromMultipleSources(response, debugData);
  }
  /**
   * Get confidence rating description
   * Phase 4: Helper for README generation
   *
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} - Rating description
   */
  getConfidenceRating(confidence) {
    if (!confidence) return "Unknown";
    if (confidence >= 0.95) return "Very High";
    if (confidence >= 0.85) return "High";
    if (confidence >= 0.7) return "Medium";
    return "Low";
  }

  /**
   * Format file list for README
   * Phase 4: Helper for README generation
   *
   * @param {Array} files - Array of file objects
   * @param {string} indent - Indentation string
   * @returns {string} - Formatted file list
   */
  formatFileList(files, indent = "") {
    if (!files || files.length === 0) {
      return `${indent}No files collected`;
    }

    return files
      .map((file) => {
        const size =
          file.size >= 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${file.size} bytes`;
        return `${indent}- ${file.filename} (${size})`;
      })
      .join("\n");
  }

  /**
   * Format file size list for README with descriptions
   * Phase 5.6: Enhanced README - detailed file listing
   *
   * @param {Array} filesCollected - Array of file objects
   * @param {Object} fileSizeMap - Map of filename to formatted size
   * @returns {string} - Formatted list with sizes and descriptions
   */
  formatFileSizeList(filesCollected, fileSizeMap) {
    if (!filesCollected || filesCollected.length === 0) {
      return "  No files";
    }

    return filesCollected
      .map((file) => {
        const size = fileSizeMap[file.filename] || "unknown";
        const description = file.format
          ? ` (${this.getFormatDescription(file.format)})`
          : "";
        // Pad filename to 40 characters for alignment
        const paddedName = file.filename.padEnd(40);
        return `  - ${paddedName} ${size}${description}`;
      })
      .join("\n");
  }

  /**
   * Get human-readable format description
   * Phase 5.6: Enhanced README - format descriptions
   *
   * @param {string} mimeType - MIME type
   * @returns {string} - Human-readable description
   */
  getFormatDescription(mimeType) {
    const descriptions = {
      "text/x-latex": "LaTeX source",
      "text/html": "Web format",
      "text/x-mmd": "MathPix Markdown",
      "text/markdown": "Markdown format",
      "application/mathml+xml": "MathML XML",
      "text/plain": "Plain text",
      "application/json": "JSON data",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "Microsoft Word",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "Microsoft PowerPoint",
      "application/pdf": "PDF document",
      "application/zip": "ZIP archive",
      "image/png": "PNG image",
      "image/jpeg": "JPEG image",
    };
    return descriptions[mimeType] || mimeType;
  }

  /**
   * Format format descriptions for README
   * Phase 4: Helper for README generation
   *
   * @param {string} apiType - API type
   * @returns {string} - Formatted descriptions
   */
  formatFormatDescriptions(apiType) {
    const descriptions = {
      text: `
LaTeX (.tex)
    Mathematical typesetting format for equations and formulas
    
MathML (.xml)
    XML-based mathematical markup language
    
AsciiMath (.txt)
    Plain text mathematical notation
    
HTML (.html)
    Web-compatible format with styled mathematics
    
Markdown (.md)
    Markdown format with LaTeX equations
    
JSON (.json)
    Complete API response in JSON format
`.trim(),

      pdf: `
MathPix Markdown (.mmd)
    MathPix's enhanced Markdown format with mathematics
    
Markdown (.md)
    Standard Markdown format
    
HTML (.html)
    Web-compatible HTML document
    
Microsoft Word (.docx)
    Editable Word document format (binary)
    
LaTeX Archive (.zip)
    Complete LaTeX project in nested ZIP (not extracted)
`.trim(),

      strokes: `
(Same formats as Text API - handwriting recognition)

LaTeX (.tex)
    Mathematical typesetting format for equations and formulas
    
MathML (.xml)
    XML-based mathematical markup language
    
AsciiMath (.txt)
    Plain text mathematical notation
    
HTML (.html)
    Web-compatible format with styled mathematics
    
Markdown (.md)
    Markdown format with LaTeX equations
    
JSON (.json)
    Complete API response in JSON format
`.trim(),
    };

    return descriptions[apiType] || "Format descriptions not available";
  }

  /**
   * Generate production README.txt with comprehensive documentation
   * Phase 4: Create user-facing documentation for the archive
   * Phase 5.6: Enhanced with processing summary and archive statistics
   * Phase 5.7: Enhanced with dynamic geographic processing region
   * Phase 5.7b: Enhanced with PDF-specific quality metrics display
   *
   * @param {Object} manifest - Complete manifest with all collection results
   * @param {Object} debugData - Debug panel data for endpoint extraction
   * @returns {string} - Formatted README content
   */
  generateProductionReadme(manifest, debugData = null) {
    logInfo("Generating production README...");

    const {
      sourceResult,
      resultsResult,
      editsResult,
      convertedResult,
      response,
      metadata,
    } = manifest;

    // Extract debug data if not provided
    if (!debugData) {
      debugData = this.getRealDebugData ? this.getRealDebugData() : null;
    }

    // Format timestamp (use enhanced timing from metadata - Phase 5.6)
    const timestamp =
      metadata.timing?.downloadTimestamp || new Date().toISOString();
    const displayDate =
      metadata.timing?.downloadDate && metadata.timing?.downloadTime
        ? `${metadata.timing.downloadDate} at ${metadata.timing.downloadTime}`
        : new Date().toLocaleString("en-GB", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "UTC",
          }) + " UTC";

    // Format confidence scores
    const confidencePercent = metadata.processing.confidence
      ? (metadata.processing.confidence * 100).toFixed(1)
      : "N/A";

    const confidenceRating = this.getConfidenceRating(
      metadata.processing.confidence
    );

    const confidenceRatePercent = metadata.processing.confidenceRate
      ? (metadata.processing.confidenceRate * 100).toFixed(1)
      : "N/A";

    // Phase 5.7b: Generate PDF-specific content analysis section
    const contentAnalysisSection = this.generateContentAnalysisSection(
      metadata,
      debugData
    );

    const readme = `
================================================================================
                        MathPix Processing Archive
================================================================================

Generated: ${displayDate}
Archive Version: ${metadata.download.archiveVersion}
Archive Type: Complete Processing Archive

================================================================================
INTERACTION SUMMARY
================================================================================

API Type:          ${metadata.download.apiType.toUpperCase()}
Source:            ${this.getSourceDescription(sourceResult, metadata)}
Processing Date:   ${displayDate}
Confidence Score:  ${confidencePercent}% (${confidenceRating})

Content Type:      ${metadata.content.detectedType}
Processing Mode:   ${metadata.processing.processingMode}

================================================================================
PROCESSING SUMMARY
================================================================================

Processing Date:     ${displayDate}
Processing Duration: ${metadata.timing?.processingDuration || "Unknown"}
Processing Mode:     ${metadata.processing.processingMode || "Unknown"}
Source File:         ${metadata.processing.sourceFileName || "Unknown"} (${
      metadata.formats.sourceTotalSize || "Unknown"
    })

Quality Metrics:
- Confidence Score:    ${confidencePercent}% (${confidenceRating})
- Confidence Rate:     ${confidenceRatePercent}%
- Processing Model:    ${metadata.processing.processingModel || "N/A"}
- Content Type:        ${metadata.content.detectedType}
- Processing Status:   Completed Successfully

================================================================================
ARCHIVE CONTENTS
================================================================================

This archive contains all resources from your MathPix processing session,
organised for accessibility remediation and quality assurance purposes.

/source/
  Original input materials:
${this.formatFileList(sourceResult.filesCollected, "    ")}

/results/
  Conversion outputs in multiple formats:
${this.formatFileList(resultsResult.filesCollected, "    ")}

/data/
  Processing metadata and debug information:
  - api-request.json:    Sanitized API request (credentials removed)
  - api-response.json:   Complete API response data
  - debug-info.md:       Debug information in Markdown format
  - metadata.json:       Structured processing metadata
  ${this.generateEditsSection(editsResult)}
  ${this.generateConvertedSection(convertedResult)}




README.txt
  This file - Archive documentation

================================================================================
ARCHIVE STATISTICS
================================================================================

Total Archive Size:  ${metadata.formats.totalSize || "Unknown"}
- Source Files:    ${metadata.formats.sourceTotalSize || "Unknown"} (${
      metadata.formats.sourceCount
    } file${metadata.formats.sourceCount !== 1 ? "s" : ""})
- Result Files:    ${metadata.formats.resultsTotalSize || "Unknown"} (${
      metadata.formats.resultsCount
    } file${metadata.formats.resultsCount !== 1 ? "s" : ""})

Result Files by Size:
${this.formatFileSizeList(
  resultsResult.filesCollected,
  metadata.formats.resultFileSizes
)}

Source Files:
${this.formatFileSizeList(
  sourceResult.filesCollected,
  metadata.formats.sourceFileSizes
)}

================================================================================
PROCESSING DETAILS
================================================================================

${contentAnalysisSection}

Processing Quality:
- Confidence:        ${confidencePercent}% (${confidenceRating})
- Confidence Rate:   ${confidenceRatePercent}%
- Processing Model:  ${metadata.processing.processingModel || "N/A"}
- Type:              ${metadata.processing.processingMode}

================================================================================
FORMATS INCLUDED
================================================================================

${this.formatFormatDescriptions(resultsResult.apiType)}

================================================================================
TECHNICAL INFORMATION
================================================================================

Request ID:        ${metadata.processing.requestId}
API Version:       ${metadata.processing.apiVersion}
Processing Region: ${this.extractGeographicRegion(
      debugData?.endpoint || this.extractEndpointFromDebugPanel()
    )}
Total Files:       ${metadata.formats.totalFiles} (${
      metadata.formats.sourceCount
    } source + ${metadata.formats.resultsCount} results)

For detailed processing information, see:
- /data/api-response.json for complete API response
- /data/debug-info.md for debug information
- /data/metadata.json for structured metadata

================================================================================
ACCESSIBILITY NOTES
================================================================================

This archive is designed for document remediation workflows:

1. Source materials are preserved for reference
2. Multiple format options for maximum compatibility
3. Complete metadata for quality assurance
4. Structured folder organisation for easy navigation

For accessibility remediation:
- Use HTML or DOCX formats for screen reader testing
- LaTeX provides semantic structure for mathematical content
- Metadata includes confidence scores to identify areas needing review
- Multiple formats ensure compatibility with various tools

================================================================================
SUPPORT
================================================================================

For questions about this archive or MathPix processing:
- Review /data/api-response.json for detailed processing information
- Check /data/debug-info.md for technical details
- Consult /data/metadata.json for structured data

Archive Format Version: ${metadata.download.archiveVersion}
Generated by: MathPix Total Downloader
Timestamp: ${timestamp}
================================================================================
`.trim();

    logInfo(
      "✓ Production README generated (Phase 5.7b with PDF quality metrics)"
    );
    return readme;
  }

  /**
   * Generate content analysis section for README
   * Phase 5.7b: Dynamic content analysis with PDF-specific metrics
   * @param {Object} metadata - Metadata object
   * @param {Object} debugData - Debug panel data
   * @returns {string} Formatted content analysis section
   */
  generateContentAnalysisSection(metadata, debugData) {
    const lines = [
      "Content Analysis:",
      `  - Content Type:    ${metadata.content.detectedType}`,
    ];

    // Phase 5.7b: PDF-specific Lines API statistics
    if (debugData?.linesApi) {
      lines.push(`  - Total Lines:     ${metadata.content.lineCount}`);
      lines.push(`  - Math Elements:   ${metadata.content.mathElements}`);
      lines.push(
        `  - Handwritten:     ${metadata.content.handwrittenLines} line${
          metadata.content.handwrittenLines !== 1 ? "s" : ""
        }`
      );
      lines.push(
        `  - Printed:         ${metadata.content.printedLines} line${
          metadata.content.printedLines !== 1 ? "s" : ""
        }`
      );
      lines.push(`  - Tables Detected: ${debugData.linesApi.tableCount}`);
    } else {
      // Standard format for non-PDF processing
      lines.push(`  - Text Lines:      ${metadata.content.lineCount}`);
      lines.push(
        `  - Contains at least one table: ${
          metadata.content.hasTable ? "Yes" : "No"
        }`
      );
    }

    return lines.join("\n");
  }

  /**
   * Generate edits section for README
   * Documents user's MMD edits if present in the archive
   * @param {Object} editsResult - Edits collection result
   * @returns {string} Formatted edits section or empty string
   */
  generateEditsSection(editsResult) {
    // Return empty string if no edits
    if (!editsResult?.hasEdits) {
      return "";
    }

    const charDiff = editsResult.characterDifference;
    const charDiffStr =
      charDiff >= 0 ? `+${charDiff} characters` : `${charDiff} characters`;

    return `
/edits/
  User's edited MMD content:
  - ${editsResult.filename}:  Edited version (${charDiffStr} from original)
    Original MathPix output preserved in: results/${
      editsResult.sourceFileName?.replace(/\.pdf$/i, ".mmd") || "mmd.mmd"
    }
    Last modified: ${editsResult.lastModified || "Unknown"}
`;
  }

  /**
   * Generate README section for converted files
   * Phase 6.2: Convert API integration
   * @param {Object} convertedResult - Converted files collection result
   * @returns {string} README section content
   */
  generateConvertedSection(convertedResult) {
    // Don't show section if no converted files
    if (!convertedResult?.hasConvertedFiles) {
      return "";
    }

    const fileList = convertedResult.files
      .map((file) => {
        const sizeKB = (file.size / 1024).toFixed(1);
        return `  - ${file.filename} (${sizeKB} KB)`;
      })
      .join("\n");

    return `
/converted/
  Document format conversions via MathPix Convert API:
${fileList}
`;
  }

  /**
   * Collect all data files (API request, response, debug info, metadata)
   * Phase 4: Main orchestration method for data collection
   *
   * @param {Object} collectionData - Complete collection data
   * @param {JSZip.folder} dataFolder - ZIP folder to add files to
   * @returns {Promise<Object>} - Collection result
   */
  async collectDataFiles(collectionData, dataFolder) {
    logInfo("Collecting data files...");

    const result = {
      filesCollected: [],
      errors: [],
    };

    try {
      const { sourceResult, resultsResult, response, request, debugData } =
        collectionData;

      // 1. Sanitized API request
      if (request) {
        const sanitizedRequest = this.sanitizeApiRequest(request);
        if (sanitizedRequest) {
          const requestJson = JSON.stringify(sanitizedRequest, null, 2);
          dataFolder.file("api-request.json", requestJson);
          result.filesCollected.push({
            type: "api-request",
            filename: "api-request.json",
            size: requestJson.length,
            format: "application/json",
            sanitized: true,
          });
          logInfo("✓ API request collected (sanitized)");
        }
      } else {
        logWarn("No API request available");
      }

      // 2. Complete API response
      if (response) {
        const responseJson = JSON.stringify(response, null, 2);
        dataFolder.file("api-response.json", responseJson);
        result.filesCollected.push({
          type: "api-response",
          filename: "api-response.json",
          size: responseJson.length,
          format: "application/json",
        });
        logInfo("✓ API response collected");
      } else {
        logWarn("No API response available");
      }

      // 3. Debug information
      const debugInfo = this.formatDebugInfo(debugData);
      dataFolder.file("debug-info.md", debugInfo);
      result.filesCollected.push({
        type: "debug-info",
        filename: "debug-info.md",
        size: debugInfo.length,
        format: "text/markdown",
      });
      logInfo("✓ Debug info collected");

      // 4. Metadata
      const metadata = this.generateMetadata(
        sourceResult,
        resultsResult,
        response
      );
      const metadataJson = JSON.stringify(metadata, null, 2);
      dataFolder.file("metadata.json", metadataJson);
      result.filesCollected.push({
        type: "metadata",
        filename: "metadata.json",
        size: metadataJson.length,
        format: "application/json",
      });
      logInfo("✓ Metadata collected");

      logInfo(`Data files collected: ${result.filesCollected.length}`);
      return result;
    } catch (error) {
      logError("Failed to collect data files:", error);
      result.errors.push({ error: error.message });
      return result;
    }
  }

  /**
   * Create mock API request for testing
   * Phase 4: Simulate API requests with credentials (for sanitization testing)
   *
   * @param {string} apiType - 'text' | 'pdf' | 'strokes'
   * @returns {Object} - Mock API request
   */
  createMockRequest(apiType) {
    logDebug("Creating mock request for API type:", apiType);

    const baseRequest = {
      app_id: "test_app_id_12345", // Will be removed by sanitization
      app_key: "test_app_key_secret", // Will be removed by sanitization
      timestamp: new Date().toISOString(),
      endpoint: "https://eu-central-1.api.mathpix.com/v3",
    };

    switch (apiType) {
      case "text":
        return {
          ...baseRequest,
          endpoint: baseRequest.endpoint + "/text",
          formats: ["text", "latex_styled", "data", "html"],
          data_options: {
            include_latex: true,
            include_mathml: true,
            include_asciimath: true,
            include_table_html: true,
            include_tsv: true,
          },
          enable_tables_fallback: true,
        };

      case "pdf":
        return {
          ...baseRequest,
          endpoint: baseRequest.endpoint + "/pdf",
          conversion_formats: {
            mmd: true,
            md: true,
            html: true,
            docx: true,
            "tex.zip": true,
          },
          page_ranges: "all",
        };

      case "strokes":
        return {
          ...baseRequest,
          endpoint: baseRequest.endpoint + "/strokes",
          formats: ["text", "latex_styled", "data", "html"],
          data_options: {
            include_latex: true,
            include_mathml: true,
            include_asciimath: true,
          },
          strokes: [{ x: [10, 20, 30], y: [10, 20, 30], t: [0, 100, 200] }],
        };

      default:
        return baseRequest;
    }
  }

  /**
   * Create mock debug data for testing
   * Phase 4: Simulate debug panel content
   *
   * @param {string} apiType - 'text' | 'pdf' | 'strokes'
   * @returns {Object} - Mock debug data
   */
  createMockDebugData(apiType) {
    logDebug("Creating mock debug data for API type:", apiType);

    return {
      request: {
        endpoint: `https://eu-central-1.api.mathpix.com/v3/${apiType}`,
        method: "POST",
        timestamp: new Date().toISOString(),
      },
      response: {
        "Request ID": "2025_10_15_test_" + apiType,
        "API Version": "3.0",
        Model: "SuperNet-107",
        "Processing Time": "2.3s",
        Confidence: "98%",
      },
      processing: {
        "Content Type":
          apiType === "strokes" ? "Handwritten Math" : "Printed Math",
        "Lines Detected": 5,
        "Tables Detected": 0,
        "Processing Status": "Success",
      },
    };
  }

  // =========================================================================
  // PHASE 5: REAL DATA INTEGRATION
  // =========================================================================

  /**
   * Get real source state from controller (replaces mock data)
   * Phase 5: Real data integration
   * Phase 5.5: Fixed canvas stroke data collection
   * Phase 5.5 Step 2: Added PDF handler file collection
   * @param {Object} controller - MathPix main controller
   * @returns {Object} Source state object
   */
  getRealSourceState(controller) {
    logInfo("Collecting real source state...");

    const fileHandler = controller.fileHandler;
    const pdfHandler = controller.pdfHandler;
    const canvasSystem = controller.strokesCanvas;

    // Collect stroke data if canvas exists
    let strokeData = null;
    if (canvasSystem?.strokes && Array.isArray(canvasSystem.strokes)) {
      strokeData = canvasSystem.strokes;
      logInfo("✓ Stroke data collected from canvas system", {
        strokeCount: strokeData.length,
      });
    }

    const state = {
      // Determine source type (now includes PDF handler check)
      sourceType: this.detectRealSourceType(
        fileHandler,
        canvasSystem,
        pdfHandler
      ),

      // Source data - check BOTH file handler AND PDF handler
      file:
        fileHandler?.currentUploadedFile || pdfHandler?.currentPDFFile || null,
      base64: fileHandler?.clipboardData || null,
      canvas: canvasSystem?.canvas || null,
      strokes: strokeData,
    };

    logInfo("✓ Real source state collected:", state.sourceType);

    // Log which storage location was used (for debugging)
    if (state.file) {
      const source = fileHandler?.currentUploadedFile
        ? "fileHandler"
        : "pdfHandler";
      logInfo(`✓ File collected from ${source}:`, {
        fileName: state.file.name,
        fileSize: state.file.size,
        fileType: state.file.type,
      });
    }

    return state;
  }
  /**
   * Detect real source type from controller state
   * Phase 5.5 Step 2: Added PDF handler check
   * @param {Object} fileHandler - File handler instance
   * @param {Object} canvasSystem - Canvas system instance
   * @param {Object} pdfHandler - PDF handler instance (optional)
   * @returns {string} 'upload' | 'clipboard' | 'canvas'
   */
  detectRealSourceType(fileHandler, canvasSystem, pdfHandler) {
    // Check for uploaded file (images)
    if (fileHandler?.currentUploadedFile) {
      logDebug("Source type: upload (from fileHandler)");
      return "upload";
    }

    // Check for PDF file
    if (pdfHandler?.currentPDFFile) {
      logDebug("Source type: upload (from pdfHandler - PDF)");
      return "upload";
    }

    // Check for clipboard data
    if (fileHandler?.clipboardData) {
      logDebug("Source type: clipboard");
      return "clipboard";
    }

    // Check for canvas drawing
    if (
      canvasSystem?.canvas &&
      canvasSystem?.hasStrokes &&
      canvasSystem.hasStrokes()
    ) {
      logDebug("Source type: canvas");
      return "canvas";
    }

    // Default fallback
    logWarn("Could not determine source type, defaulting to upload");
    return "upload";
  }

  /**
   * Get real API response from controller (for metadata/debug)
   * Phase 5: Real data integration
   * Phase 5.5: Returns rawResponse for metadata, not formats
   * @param {Object} controller - MathPix main controller
   * @returns {Object} Raw API response object
   */
  getRealResponse(controller) {
    logInfo("Collecting real API response for metadata...");

    // Check PDF results first (stored in result renderer)
    if (controller.pdfResultRenderer?.currentResults) {
      const response = controller.pdfResultRenderer.currentResults;
      logInfo("✓ PDF API response collected from result renderer");
      return response;
    }

    // For Text/Strokes API: Get raw response from result renderer
    if (controller.resultRenderer?.currentResult?.rawResponse) {
      const response = controller.resultRenderer.currentResult.rawResponse;
      logInfo("✓ Raw API response collected from result renderer");
      return response;
    }

    // Fallback: Check debug data
    if (controller.strokesAPIClient?.lastDebugData?.response) {
      const response = controller.strokesAPIClient.lastDebugData.response;
      logInfo("✓ Strokes API response collected from debug data (fallback)");
      return response;
    }

    if (controller.apiClient?.lastDebugData?.response) {
      const response = controller.apiClient.lastDebugData.response;
      logInfo("✓ Text API response collected from debug data (fallback)");
      return response;
    }

    logWarn("No API response found in controller");
    return null;
  }

  /**
   * Get real API request from controller
   * Phase 5: Real data integration
   * Phase 5.5: Fixed to use lastDebugData structure
   * @param {Object} controller - MathPix main controller
   * @returns {Object} API request object
   */
  getRealRequest(controller) {
    logInfo("Collecting real API request...");

    // ✅ FIXED: Check for PDF request in Text API debug data
    if (controller.apiClient?.lastDebugData?.operation === "processPDF") {
      const request = controller.apiClient.lastDebugData.request;
      logInfo("✓ PDF API request collected from Text API debug data");
      return request;
    }

    // ✅ FIXED: Check Strokes API debug data
    if (controller.strokesAPIClient?.lastDebugData?.request) {
      const request = controller.strokesAPIClient.lastDebugData.request;
      logInfo("✓ Strokes API request collected from debug data");
      return request;
    }

    // ✅ FIXED: Check Text API debug data
    if (controller.apiClient?.lastDebugData?.request) {
      const request = controller.apiClient.lastDebugData.request;
      logInfo("✓ Text API request collected from debug data");
      return request;
    }

    logWarn("No API request found in controller");
    return null;
  }

  /**
   * Get formats from result renderer (real data source)
   * Phase 5.5: Corrected data source - formats are in result renderer, not API response
   *
   * The API response.data contains metadata, not format array!
   * Actual formats are stored in controller.resultRenderer.currentResult
   *
   * @param {Object} controller - MathPix main controller
   * @returns {Object|null} Current result object with all formats
   */
  getRealFormats(controller) {
    logInfo("Collecting formats from result renderer...");

    const currentResult = controller.resultRenderer?.currentResult;

    if (!currentResult) {
      logWarn("No current result in result renderer");
      return null;
    }

    const availableFormats = Object.keys(currentResult).filter(
      (key) => currentResult[key] && currentResult[key] !== ""
    );

    logInfo("✓ Formats collected from result renderer", {
      formatCount: availableFormats.length,
      formats: availableFormats,
    });

    return currentResult;
  }

  /**
   * Get real debug data from controller/DOM
   * Phase 5: Real data integration
   * Phase 5.7b: Enhanced with PDF debug panel and Lines API statistics extraction
   * @param {Object} controller - MathPix main controller
   * @returns {Object} Debug data object with PDF-specific fields
   */
  getRealDebugData(controller) {
    logInfo("Collecting real debug data...");

    // Try to extract from debug panel in DOM
    const debugPanel = document.getElementById("mathpix-debug-panel");

    if (!debugPanel) {
      logWarn("Debug panel not found in DOM");
      return {
        endpoint: "Unknown",
        operation: "Unknown",
        timing: "Unknown",
        confidence: "Unknown",
        contentType: "Unknown",
      };
    }

    // Extract standard debug information from DOM elements
    const debugData = {
      endpoint:
        document.getElementById("debug-endpoint")?.textContent || "Unknown",
      operation:
        document.getElementById("debug-operation")?.textContent || "Unknown",
      timing: document.getElementById("debug-timing")?.textContent || "Unknown",
      confidence:
        document.getElementById("debug-confidence")?.textContent || "Unknown",
      contentType:
        document.getElementById("debug-content-type")?.textContent || "Unknown",
      requestId:
        document.getElementById("debug-request-id")?.textContent || "Unknown",

      // Phase 5.7b: PDF-specific debug panel elements
      confidenceRate:
        document.getElementById("debug-confidence-rate")?.textContent ||
        "Unknown",
      apiVersion:
        document.getElementById("debug-api-version")?.textContent || "Unknown",
      processingModel:
        document.getElementById("debug-processing-model")?.textContent ||
        "Unknown",
    };

    // Phase 5.7b: Extract Lines API statistics for PDF processing
    const linesApiStats = this.extractLinesApiStatistics();
    if (linesApiStats) {
      debugData.linesApi = linesApiStats;
      logInfo("✓ Lines API statistics extracted:", linesApiStats);
    }

    logInfo("✓ Debug data collected from DOM (including PDF-specific data)");
    return debugData;
  }

  /**
   * Extract Lines API statistics from DOM
   * Phase 5.7b: PDF-specific statistics extraction
   * @returns {Object|null} Lines API statistics or null if not available
   */
  extractLinesApiStatistics() {
    const statsContainer = document.getElementById("mathpix-page-statistics");

    if (!statsContainer) {
      logDebug(
        "Lines API statistics container not found (not a PDF processing)"
      );
      return null;
    }

    const stats = {
      lineCount: parseInt(
        document.getElementById("page-stat-lines")?.textContent || "0"
      ),
      mathElements: parseInt(
        document.getElementById("page-stat-math")?.textContent || "0"
      ),
      tableCount: parseInt(
        document.getElementById("page-stat-tables")?.textContent || "0"
      ),
      handwrittenLines: parseInt(
        document.getElementById("page-stat-handwritten")?.textContent || "0"
      ),
      printedLines: parseInt(
        document.getElementById("page-stat-printed")?.textContent || "0"
      ),
    };

    logDebug("Lines API statistics extracted:", stats);
    return stats;
  }

  // =========================================================================
  // PHASE 6.2: CONVERTED FILES COLLECTION
  // =========================================================================

  /**
   * Collect converted files from the Convert UI
   * Phase 6.2: Integration with MathPix Convert API
   *
   * @param {JSZip} convertedFolder - JSZip folder object for converted files
   * @returns {Object} Collection result with file count and details
   */
  collectConvertedFiles(convertedFolder) {
    logInfo("Collecting converted files...");

    const result = {
      fileCount: 0,
      files: [],
      hasConvertedFiles: false,
    };

    try {
      // Get the Convert UI instance
      const convertUI = window.getMathPixConvertUI?.();

      if (!convertUI) {
        logDebug("Convert UI not available - no converted files to collect");
        return result;
      }

      // Get completed downloads with filenames
      const completedDownloads =
        convertUI.getCompletedDownloadsWithFilenames?.();

      if (!completedDownloads || completedDownloads.length === 0) {
        logDebug("No converted files available");
        return result;
      }

      // Add each converted file to the folder
      completedDownloads.forEach(({ filename, blob, format }) => {
        convertedFolder.file(filename, blob);
        result.files.push({
          filename: filename,
          format: format,
          size: blob.size,
        });
        result.fileCount++;
        logDebug(`Added converted file: ${filename} (${blob.size} bytes)`);
      });

      result.hasConvertedFiles = result.fileCount > 0;
      logInfo(`Collected ${result.fileCount} converted files`);
    } catch (error) {
      logWarn("Error collecting converted files:", error);
    }

    return result;
  }

  /**
   * Check if converted files are available
   * Phase 6.2: Helper for UI state
   * @returns {boolean} True if converted files exist
   */
  hasConvertedFiles() {
    try {
      const convertUI = window.getMathPixConvertUI?.();
      if (!convertUI) return false;

      const downloads = convertUI.getCompletedDownloads?.();
      return downloads && downloads.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get converted files description for README
   * Phase 6.2: README generation helper
   * @param {Object} convertedResult - Result from collectConvertedFiles
   * @returns {string} Description for README
   */
  getConvertedDescription(convertedResult) {
    if (!convertedResult || !convertedResult.hasConvertedFiles) {
      return "No converted files in this archive";
    }

    const lines = convertedResult.files.map((file) => {
      const sizeKB = (file.size / 1024).toFixed(1);
      return `  ${file.filename} (${sizeKB} KB)`;
    });

    return lines.join("\n");
  }

  /**
   * Create archive with real data (Phase 5 entry point)
   * Phase 5.5: Updated to separate formats from response
   * @param {Object} data - Real data from controller
   * @returns {Promise<void>}
   */
  async createArchive(data) {
    logInfo("Creating archive with real data...");

    try {
      const zip = new JSZip();

      // Create folders
      const sourceFolder = zip.folder(this.config.DIRECTORIES.SOURCE);
      const resultsFolder = zip.folder(this.config.DIRECTORIES.RESULTS);
      const dataFolder = zip.folder(this.config.DIRECTORIES.DATA);
      const editsFolder = zip.folder(this.config.DIRECTORIES.EDITS);
      const convertedFolder = zip.folder(this.config.DIRECTORIES.CONVERTED);

      // Collect source files (Phase 2)
      const sourceResult = await this.collectSourceFiles(
        data.sourceState,
        sourceFolder
      );
      logInfo("Source collection result:", sourceResult);

      // Collect result files (Phase 3)
      // Phase 5.5: Use formats (from data.formats) instead of response
      // Phase 5.5 Step 2.1: Pass sourceResult for filename generation
      const resultsResult = await this.collectResultFiles(
        data.formats || data.response, // Use formats if available, fallback to response
        resultsFolder,
        sourceResult // Pass source result for base filename extraction
      );
      logInfo("Results collection result:", resultsResult);

      // Phase 8.3.1: Carry forward existing edits from resumed ZIP
      // These preserve the edit history across multiple resume sessions
      let existingEditsCount = 0;
      if (data.existingEdits && data.existingEdits.length > 0) {
        for (const edit of data.existingEdits) {
          if (edit.filename && edit.content) {
            editsFolder.file(edit.filename, edit.content);
            existingEditsCount++;
            logDebug(`Carried forward existing edit: ${edit.filename}`);
          }
        }
        logInfo(`Carried forward ${existingEditsCount} existing edits`);
      }

      // Collect NEW MMD edits from current session (if any)
      const editsResult = this.collectMMDEdits(editsFolder);

      // Phase 8.4: Include manually saved MMD versions
      let savedVersionsCount = 0;
      if (data.savedMMDVersions && data.savedMMDVersions.length > 0) {
        // Build list of all files already in edits folder
        const existingFilenames = new Set();

        // Add carried forward edits
        if (data.existingEdits) {
          data.existingEdits.forEach((edit) => {
            if (edit.filename) existingFilenames.add(edit.filename);
          });
        }

        // Add current edit filename
        if (editsResult.filename) {
          existingFilenames.add(editsResult.filename);
        }

        for (const savedVersion of data.savedMMDVersions) {
          if (savedVersion.filename && savedVersion.content) {
            // Check if filename already exists
            if (existingFilenames.has(savedVersion.filename)) {
              logDebug(
                `Skipping saved version (filename exists): ${savedVersion.filename}`
              );
              continue;
            }

            // Note: We no longer skip saved versions based on content matching current edit.
            // Users explicitly save versions as deliberate checkpoints, even if content
            // hasn't changed since. The filename deduplication above is sufficient.
            //
            // Previously this checked: savedVersion.content === persistence.session.current
            // But this incorrectly skipped intentional save points.

            editsFolder.file(savedVersion.filename, savedVersion.content);
            existingFilenames.add(savedVersion.filename);
            savedVersionsCount++;
            logDebug(`Added saved MMD version: ${savedVersion.filename}`);
          }
        }
        logInfo(
          `Added ${savedVersionsCount} manually saved MMD versions to edits folder`
        );
      }
      // Combine counts for reporting
      editsResult.existingEditsCarriedForward = existingEditsCount;
      editsResult.savedVersionsIncluded = savedVersionsCount;
      editsResult.totalEditsInArchive =
        existingEditsCount +
        (editsResult.hasEdits ? 1 : 0) +
        savedVersionsCount;
      logInfo("Edits collection result:", editsResult);

      // Phase 6.2: Collect converted files if any
      const convertedResult = this.collectConvertedFiles(convertedFolder);
      logInfo("Converted collection result:", convertedResult);

      // Phase 3.2: Add lines.json for confidence visualisation (PDF only)
      if (data.linesData && data.linesData.pages) {
        const linesContent = JSON.stringify(data.linesData, null, 2);
        dataFolder.file("lines.json", linesContent);
        logInfo("Lines data added to archive", {
          pageCount: data.linesData.pages.length,
          size: linesContent.length,
        });
      }

      // Collect data files (Phase 4)
      // Phase 5.5: Use rawResponse for metadata
      const collectionData = {
        sourceResult,
        resultsResult,
        response: data.response, // This is now rawResponse
        request: data.request,
        debugData: data.debugData,
      };
      const dataResult = await this.collectDataFiles(
        collectionData,
        dataFolder
      );
      logInfo("Data collection result:", dataResult);

      // Generate production README (Phase 4)
      // Include edits result and converted result for README generation
      const manifest = {
        sourceResult,
        resultsResult,
        editsResult,
        convertedResult, // Phase 6.2: Add converted files to manifest
        response: data.response, // rawResponse for metadata
        metadata: this.generateMetadata(
          sourceResult,
          resultsResult,
          data.response
        ),
      };
      const readme = this.generateProductionReadme(manifest);
      zip.file("README.txt", readme);

      // Generate ZIP
      logInfo("Generating ZIP blob...");
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Create filename based on source
      const baseName = this.extractBaseNameFromSource(data.sourceState);
      const filename = this.generateFilename(baseName);

      // Trigger download
      logInfo(`Triggering download: ${filename}`);
      this.triggerDownload(blob, filename);

      logInfo("✓ Archive created successfully");
    } catch (error) {
      logError("Failed to create archive:", error);
      throw error;
    }
  }

  /**
   * Extract base name from source state for filename generation
   * @param {Object} sourceState - Source state object
   * @returns {string|null} Base name or null
   */
  extractBaseNameFromSource(sourceState) {
    if (sourceState.file && sourceState.file.name) {
      // Remove extension from uploaded file name
      return sourceState.file.name.replace(/\.[^/.]+$/, "");
    }

    if (sourceState.sourceType === "clipboard") {
      return "clipboard-math";
    }

    if (sourceState.sourceType === "canvas") {
      return "handwritten-math";
    }

    return null; // Will use timestamp-based name
  }

  /**
   * Generate timestamped filename for edited MMD content
   * @param {string} sourceFileName - Original source file name
   * @returns {string} Formatted filename with timestamp
   */
  generateEditsFilename(sourceFileName) {
    // Remove .pdf extension if present
    let baseName = sourceFileName?.replace(/\.pdf$/i, "") || "mathpix-export";

    // Sanitise filename - remove unsafe characters
    baseName = baseName.replace(/[<>:"/\\|?*]/g, "-");

    // Format date: YYYY-MM-DD
    const now = new Date();
    const date = now.toISOString().split("T")[0];

    // Format time: HH-MM
    const time = now.toTimeString().slice(0, 5).replace(":", "-");

    return `${baseName}-${date}-${time}.mmd`;
  }

  /**
   * Collect MMD edits from the editor session
   * @param {JSZip.folder} editsFolder - The edits folder in the ZIP
   * @returns {Object} Collection result with edits information
   */
  collectMMDEdits(editsFolder) {
    const result = {
      hasEdits: false,
      filename: null,
      originalLength: 0,
      editedLength: 0,
      characterDifference: 0,
      sourceFileName: null,
      lastModified: null,
      errors: [],
    };

    try {
      // Access the persistence module via global function
      const persistence = window.getMathPixMMDPersistence?.();

      if (!persistence) {
        logDebug("MMD Persistence module not available");
        return result;
      }

      if (!persistence.hasSession?.()) {
        logDebug("No MMD editing session active");
        return result;
      }

      const session = persistence.session;

      // Only include if content has been modified
      if (!session.current || !session.original) {
        logDebug("Session missing current or original content");
        return result;
      }

      if (session.current === session.original) {
        logDebug("MMD content not modified, skipping edits collection");
        return result;
      }

      // Generate timestamped filename
      const filename = this.generateEditsFilename(session.sourceFileName);

      // Add edited content to ZIP
      editsFolder.file(filename, session.current);

      // Populate result
      result.hasEdits = true;
      result.filename = filename;
      result.originalLength = session.original?.length || 0;
      result.editedLength = session.current?.length || 0;
      result.characterDifference = result.editedLength - result.originalLength;
      result.sourceFileName = session.sourceFileName || "unknown";
      result.lastModified = session.lastModified
        ? new Date(session.lastModified).toISOString()
        : new Date().toISOString();

      logInfo("MMD edits collected", {
        filename: result.filename,
        originalLength: result.originalLength,
        editedLength: result.editedLength,
        characterDifference: result.characterDifference,
      });
    } catch (error) {
      logError("Failed to collect MMD edits:", error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Extract and sanitize base filename from source file
   * Phase 5.5 Step 2.1: Filename improvement
   *
   * @param {Object} sourceResult - Source collection result with file info
   * @returns {string|null} - Sanitized base filename or null
   * @private
   */
  extractBaseFilenameForResults(sourceResult) {
    if (
      !sourceResult ||
      !sourceResult.filesCollected ||
      sourceResult.filesCollected.length === 0
    ) {
      logDebug("No source files to extract base filename from");
      return null;
    }

    // Get the first collected file (primary source)
    const primaryFile = sourceResult.filesCollected[0];

    // Try to get original name (preferred) or filename
    const originalName = primaryFile.originalName || primaryFile.filename;

    if (!originalName) {
      logDebug("No filename found in source result");
      return null;
    }

    // Remove file extension (everything after last dot)
    const baseName = originalName.replace(/\.[^/.]+$/, "");

    // Sanitize (already done by collectUploadedFile, but ensure consistency)
    const sanitized = this.sanitizeFilename(baseName);

    logDebug("Extracted base filename for results", {
      original: originalName,
      base: baseName,
      sanitized: sanitized,
    });

    return sanitized || "result";
  }

  // =========================================================================
  // PHASE 1 TEST METHODS
  // =========================================================================

  /**
   * Test filename generation with various inputs
   */
  testFilenameGeneration() {
    logInfo("=== FILENAME GENERATION TESTS ===");

    const testCases = [
      { input: null, expected: /mathpix-results-\d{4}-\d{2}-\d{2}-\d{6}\.zip/ },
      { input: "my-document", expected: "my-document-mathpix.zip" },
      { input: "My Document.pdf", expected: "My-Document-mathpix.zip" },
      { input: "file with spaces", expected: "file-with-spaces-mathpix.zip" },
      { input: "special!@#$chars", expected: "special----chars-mathpix.zip" },
      {
        input: "---leading-trailing---",
        expected: "leading-trailing-mathpix.zip",
      },
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(({ input, expected }, index) => {
      const result = this.generateFilename(input);

      if (typeof expected === "string") {
        if (result === expected) {
          console.log(`✓ Test ${index + 1} PASSED:`, { input, result });
          passed++;
        } else {
          console.error(`✗ Test ${index + 1} FAILED:`, {
            input,
            expected,
            result,
          });
          failed++;
        }
      } else {
        // Regex test
        if (expected.test(result)) {
          console.log(`✓ Test ${index + 1} PASSED:`, { input, result });
          passed++;
        } else {
          console.error(`✗ Test ${index + 1} FAILED:`, {
            input,
            pattern: expected,
            result,
          });
          failed++;
        }
      }
    });

    logInfo(`Tests complete: ${passed} passed, ${failed} failed`);
    return { passed, failed, total: testCases.length };
  }

  /**
   * Test basic ZIP creation functionality
   */
  async testBasicZipCreation() {
    logInfo("=== BASIC ZIP CREATION TEST ===");

    try {
      const zip = new JSZip();

      // Add simple test file
      zip.file("test.txt", "Hello World");

      // Generate blob
      const blob = await zip.generateAsync({ type: "blob" });

      logInfo("✓ Basic ZIP creation successful:", { size: blob.size });
      return true;
    } catch (error) {
      logError("✗ Basic ZIP creation failed:", error);
      return false;
    }
  }

  /**
   * Test folder structure creation
   */
  async testFolderStructure() {
    logInfo("=== FOLDER STRUCTURE TEST ===");

    try {
      const zip = new JSZip();

      // Create folders
      const source = zip.folder(this.config.DIRECTORIES.SOURCE);
      const results = zip.folder(this.config.DIRECTORIES.RESULTS);
      const data = zip.folder(this.config.DIRECTORIES.DATA);

      // Add files to folders
      source.file("source-test.txt", "Source content");
      results.file("result-test.txt", "Result content");
      data.file("metadata-test.json", '{"test": true}');

      // Generate blob
      const blob = await zip.generateAsync({ type: "blob" });

      logInfo("✓ Folder structure creation successful:", { size: blob.size });
      return true;
    } catch (error) {
      logError("✗ Folder structure creation failed:", error);
      return false;
    }
  }
}

// ============================================================================
// GLOBAL EXPOSURE FOR TESTING
// ============================================================================

// Store class globally for console testing
window.MathPixTotalDownloader = MathPixTotalDownloader;

// ============================================================================
// CONSOLE TEST COMMANDS
// ============================================================================

/**
 * Global test commands for Phase 1 validation
 */
window.testMathPixDownloader = {
  /**
   * Run all Phase 1 tests
   */
  async runAllTests() {
    console.log("\n".repeat(2));
    console.log("═══════════════════════════════════════════════════");
    console.log("  MathPix Total Downloader - Phase 1 Test Suite");
    console.log("═══════════════════════════════════════════════════\n");

    // Check prerequisites
    if (typeof JSZip === "undefined") {
      console.error("✗ FATAL: JSZip library not loaded!");
      return false;
    }
    console.log("✓ JSZip library loaded\n");

    if (typeof MathPixBaseModule === "undefined") {
      console.error("✗ FATAL: MathPixBaseModule not available!");
      return false;
    }
    console.log("✓ MathPixBaseModule available\n");

    // Create test instance
    const downloader = new MathPixTotalDownloader(null);

    // Test 1: Initialisation
    console.log("TEST 1: Module Initialisation");
    console.log("─────────────────────────────");
    const initResult = downloader.initialize();
    if (initResult) {
      console.log("✓ Module initialised successfully\n");
    } else {
      console.error("✗ Module initialisation failed\n");
      return false;
    }

    // Test 2: Filename Generation
    console.log("TEST 2: Filename Generation");
    console.log("─────────────────────────────");
    const filenameResults = downloader.testFilenameGeneration();
    console.log(
      `\nResult: ${filenameResults.passed}/${filenameResults.total} tests passed\n`
    );

    // Test 3: Basic ZIP Creation
    console.log("TEST 3: Basic ZIP Creation");
    console.log("─────────────────────────────");
    const zipResult = await downloader.testBasicZipCreation();
    console.log("");

    // Test 4: Folder Structure
    console.log("TEST 4: Folder Structure Creation");
    console.log("─────────────────────────────────");
    const folderResult = await downloader.testFolderStructure();
    console.log("");

    // Test 5: Full Test ZIP Download
    console.log("TEST 5: Full Test ZIP Download");
    console.log("─────────────────────────────────");
    console.log("Creating and downloading test ZIP...");
    await downloader.createTestZip();
    console.log("Check your downloads folder for the ZIP file");
    console.log("Extract and verify folder structure\n");

    // Summary
    console.log("═══════════════════════════════════════════════════");
    console.log("  Phase 1 Test Suite Complete");
    console.log("═══════════════════════════════════════════════════\n");
    console.log("Next steps:");
    console.log("1. Check downloads folder for test ZIP");
    console.log("2. Extract and verify contents");
    console.log("3. Verify folder structure (source/, results/, data/)");
    console.log("4. Read README.txt in the archive\n");

    return true;
  },

  /**
   * Quick test - just create and download test ZIP
   */
  async quickTest() {
    console.log("Creating test ZIP...");
    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();
    await downloader.createTestZip();
  },

  /**
   * Test filename generation only
   */
  testFilenames() {
    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();
    return downloader.testFilenameGeneration();
  },

  /**
   * Check prerequisites
   */
  checkPrerequisites() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Prerequisites Check");
    console.log("═══════════════════════════════════════════════════\n");

    const checks = {
      "JSZip library": typeof JSZip !== "undefined",
      MathPixBaseModule: typeof MathPixBaseModule !== "undefined",
      MATHPIX_CONFIG: typeof MATHPIX_CONFIG !== "undefined",
      "MATHPIX_CONFIG.TOTAL_DOWNLOADER":
        MATHPIX_CONFIG?.TOTAL_DOWNLOADER !== undefined,
      "notifySuccess function": typeof notifySuccess === "function",
      "notifyError function": typeof notifyError === "function",
    };

    let allPass = true;
    Object.entries(checks).forEach(([name, passed]) => {
      console.log(`${passed ? "✓" : "✗"} ${name}`);
      if (!passed) allPass = false;
    });

    console.log("\n═══════════════════════════════════════════════════\n");
    console.log(
      allPass ? "✓ All prerequisites met!" : "✗ Some prerequisites missing!"
    );
    console.log("");

    return allPass;
  },

  // ==========================================================================
  // PHASE 2 TEST COMMANDS
  // ==========================================================================

  /**
   * Test upload file collection
   */
  async testUploadCollection() {
    console.log("\n=== UPLOAD FILE COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockState = downloader.createMockState("upload");
    const zip = new JSZip();
    const sourceFolder = zip.folder("source");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectUploadedFile(mockState, sourceFolder, result);

    console.log("✓ Upload collection result:", result);
    return result.filesCollected.length === 1;
  },

  /**
   * Test clipboard image conversion
   */
  async testClipboardCollection() {
    console.log("\n=== CLIPBOARD IMAGE COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockState = downloader.createMockState("clipboard");
    const zip = new JSZip();
    const sourceFolder = zip.folder("source");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectClipboardImage(mockState, sourceFolder, result);

    console.log("✓ Clipboard collection result:", result);
    return result.filesCollected.length === 1;
  },

  /**
   * Test canvas drawing and stroke data collection
   */
  async testCanvasCollection() {
    console.log("\n=== CANVAS DRAWING COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockState = downloader.createMockState("canvas");
    const zip = new JSZip();
    const sourceFolder = zip.folder("source");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectCanvasDrawing(mockState, sourceFolder, result);

    console.log("✓ Canvas collection result:", result);
    return result.filesCollected.length === 2; // PNG + JSON
  },

  /**
   * Test all three source types
   */
  async testAllSourceTypes() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 2: Source File Collection Tests");
    console.log("═══════════════════════════════════════════════════\n");

    const tests = [
      { name: "Upload", fn: this.testUploadCollection },
      { name: "Clipboard", fn: this.testClipboardCollection },
      { name: "Canvas", fn: this.testCanvasCollection },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test.fn.call(this);
        if (result) {
          console.log(`✓ ${test.name} test PASSED\n`);
          passed++;
        } else {
          console.error(`✗ ${test.name} test FAILED\n`);
          failed++;
        }
      } catch (error) {
        console.error(`✗ ${test.name} test ERROR:`, error, "\n");
        failed++;
      }
    }

    console.log("═══════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════════\n");

    return failed === 0;
  },

  /**
   * Test ZIP creation with each source type
   */
  async testPhase2ZipCreation() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 2: Complete ZIP Creation Tests");
    console.log("═══════════════════════════════════════════════════\n");

    const sourceTypes = ["upload", "clipboard", "canvas"];

    for (const sourceType of sourceTypes) {
      console.log(`Creating test ZIP for: ${sourceType}`);
      const downloader = new MathPixTotalDownloader(null);
      downloader.initialize();
      await downloader.createTestZip(sourceType);
      console.log(`✓ ${sourceType} ZIP downloaded\n`);
    }

    console.log("Check your downloads folder for three ZIP files:");
    console.log("1. test-upload-mathpix.zip");
    console.log("2. test-clipboard-mathpix.zip");
    console.log("3. test-canvas-mathpix.zip\n");

    console.log("Extract and verify:");
    console.log("- Upload ZIP should contain test-upload.txt");
    console.log("- Clipboard ZIP should contain clipboard-image.jpg");
    console.log(
      "- Canvas ZIP should contain canvas-drawing.png and strokes-data.json\n"
    );

    return true;
  },

  /**
   * Run all Phase 2 tests
   */
  async runPhase2Tests() {
    console.log("\n".repeat(2));
    console.log("═══════════════════════════════════════════════════");
    console.log("  MathPix Total Downloader - Phase 2 Test Suite");
    console.log("═══════════════════════════════════════════════════\n");

    // Prerequisites check
    const prereqsPassed = this.checkPrerequisites();
    if (!prereqsPassed) {
      console.error("Prerequisites check failed. Cannot continue.");
      return false;
    }

    console.log("");

    // Source type collection tests
    const collectionPassed = await this.testAllSourceTypes();

    // Full ZIP creation tests
    await this.testPhase2ZipCreation();

    console.log("═══════════════════════════════════════════════════");
    console.log("  Phase 2 Test Suite Complete");
    console.log("═══════════════════════════════════════════════════\n");

    return collectionPassed;
  },

  // ==========================================================================
  // PHASE 3 TEST COMMANDS
  // ==========================================================================

  /**
   * Test Text API format collection
   */
  async testTextApiCollection() {
    console.log("\n=== TEXT API FORMAT COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockResponse = downloader.createMockResponse("text");
    const zip = new JSZip();
    const resultsFolder = zip.folder("results");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectTextApiFormats(mockResponse, resultsFolder, result);

    console.log("✓ Text API collection result:", result);
    console.log("Files collected:", result.filesCollected.length);
    console.log(
      "Expected: 6 formats (LaTeX, MathML, AsciiMath, HTML, JSON, Markdown)"
    );

    return result.filesCollected.length >= 5; // At least 5 formats
  },

  /**
   * Test PDF API format collection
   */
  async testPdfApiCollection() {
    console.log("\n=== PDF API FORMAT COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockResponse = downloader.createMockResponse("pdf");
    const zip = new JSZip();
    const resultsFolder = zip.folder("results");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectPdfApiFormats(mockResponse, resultsFolder, result);

    console.log("✓ PDF API collection result:", result);
    console.log("Files collected:", result.filesCollected.length);
    console.log("Expected: 5 formats (MMD, MD, HTML, DOCX, LaTeX ZIP)");

    return result.filesCollected.length >= 4; // At least 4 formats
  },

  /**
   * Test Strokes API format collection
   */
  async testStrokesApiCollection() {
    console.log("\n=== STROKES API FORMAT COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockResponse = downloader.createMockResponse("strokes");
    const zip = new JSZip();
    const resultsFolder = zip.folder("results");
    const result = { filesCollected: [], errors: [] };

    await downloader.collectStrokesApiFormats(
      mockResponse,
      resultsFolder,
      result
    );

    console.log("✓ Strokes API collection result:", result);
    console.log("Files collected:", result.filesCollected.length);
    console.log("Expected: 6 formats (same as Text API)");

    return result.filesCollected.length >= 5; // At least 5 formats
  },

  /**
   * Test results orchestrator with all three API types
   */
  async testResultsOrchestrator() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 3: Results Collection Orchestrator Tests");
    console.log("═══════════════════════════════════════════════════\n");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const apiTypes = ["text", "pdf", "strokes"];
    let passed = 0;
    let failed = 0;

    for (const apiType of apiTypes) {
      console.log(`Testing ${apiType.toUpperCase()} API orchestrator...`);

      const mockResponse = downloader.createMockResponse(apiType);
      const zip = new JSZip();
      const resultsFolder = zip.folder("results");
      const result = await downloader.collectResultFiles(
        mockResponse,
        resultsFolder
      );

      console.log(`API type detected: ${result.apiType}`);
      console.log(`Files collected: ${result.filesCollected.length}`);
      console.log(`Errors: ${result.errors.length}`);

      const success =
        result.apiType === apiType &&
        result.filesCollected.length > 0 &&
        result.errors.length === 0;

      if (success) {
        console.log(`✓ ${apiType.toUpperCase()} API test PASSED\n`);
        passed++;
      } else {
        console.error(`✗ ${apiType.toUpperCase()} API test FAILED\n`);
        failed++;
      }
    }

    console.log("═══════════════════════════════════════════════════");
    console.log(`  Results: ${passed}/3 tests passed`);
    console.log("═══════════════════════════════════════════════════\n");

    return failed === 0;
  },

  /**
   * Test complete ZIP creation with all combinations
   */
  async testPhase3ZipCreation() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 3: Complete ZIP Creation Tests");
    console.log("═══════════════════════════════════════════════════\n");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    // Test matrix: 3 source types × 3 API types = 9 combinations
    const sourceTypes = ["upload", "clipboard", "canvas"];
    const apiTypes = ["text", "pdf", "strokes"];

    console.log("Creating 9 test ZIPs (3 source types × 3 API types)...\n");

    for (const sourceType of sourceTypes) {
      for (const apiType of apiTypes) {
        console.log(`Creating: ${sourceType} + ${apiType}`);
        await downloader.createTestZip(sourceType, apiType);
        console.log(`✓ test-${sourceType}-${apiType}-mathpix.zip downloaded\n`);
      }
    }

    console.log("Check your downloads folder for 9 ZIP files:");
    console.log("- test-upload-text-mathpix.zip");
    console.log("- test-upload-pdf-mathpix.zip");
    console.log("- test-upload-strokes-mathpix.zip");
    console.log("- test-clipboard-text-mathpix.zip");
    console.log("- test-clipboard-pdf-mathpix.zip");
    console.log("- test-clipboard-strokes-mathpix.zip");
    console.log("- test-canvas-text-mathpix.zip");
    console.log("- test-canvas-pdf-mathpix.zip");
    console.log("- test-canvas-strokes-mathpix.zip\n");

    console.log("Extract and verify:");
    console.log("- Each ZIP has source/ folder with appropriate files");
    console.log("- Each ZIP has results/ folder with API-specific formats");
    console.log("- Text API: 6 formats");
    console.log("- PDF API: 5 formats including binary files");
    console.log("- Strokes API: 6 formats (same as Text)");

    return true;
  },

  /**
   * Run all Phase 3 tests
   */
  async runPhase3Tests() {
    console.log("\n".repeat(2));
    console.log("═══════════════════════════════════════════════════");
    console.log("  MathPix Total Downloader - Phase 3 Test Suite");
    console.log("═══════════════════════════════════════════════════\n");

    // Prerequisites check
    const prereqsPassed = this.checkPrerequisites();
    if (!prereqsPassed) {
      console.error("Prerequisites check failed. Cannot continue.");
      return false;
    }

    console.log("");

    // Individual API collection tests
    console.log("STEP 1: Individual API Collection Tests");
    console.log("─────────────────────────────────────────\n");

    const textPassed = await this.testTextApiCollection();
    const pdfPassed = await this.testPdfApiCollection();
    const strokesPassed = await this.testStrokesApiCollection();

    console.log("\nStep 1 Results:");
    console.log(
      textPassed ? "✓ Text API test passed" : "✗ Text API test failed"
    );
    console.log(pdfPassed ? "✓ PDF API test passed" : "✗ PDF API test failed");
    console.log(
      strokesPassed ? "✓ Strokes API test passed" : "✗ Strokes API test failed"
    );

    // Orchestrator tests
    console.log("\n\nSTEP 2: Results Orchestrator Tests");
    console.log("─────────────────────────────────────────\n");

    const orchestratorPassed = await this.testResultsOrchestrator();

    // Full ZIP creation tests
    console.log("\n\nSTEP 3: Complete ZIP Creation Tests");
    console.log("─────────────────────────────────────────\n");

    await this.testPhase3ZipCreation();

    // Summary
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 3 Test Suite Complete");
    console.log("═══════════════════════════════════════════════════\n");

    const allPassed =
      textPassed && pdfPassed && strokesPassed && orchestratorPassed;
    console.log(allPassed ? "✓ All tests passed!" : "✗ Some tests failed");

    return allPassed;
  },

  // ==========================================================================
  // PHASE 4 TEST COMMANDS
  // ==========================================================================

  /**
   * Test API request sanitization
   */
  testApiSanitization() {
    console.log("\n=== API REQUEST SANITIZATION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    // Create request with credentials
    const mockRequest = downloader.createMockRequest("text");
    console.log("Original request has credentials:", {
      hasAppId: !!mockRequest.app_id,
      hasAppKey: !!mockRequest.app_key,
    });

    // Sanitize
    const sanitized = downloader.sanitizeApiRequest(mockRequest);
    console.log("Sanitized request:", {
      hasAppId: !!sanitized.app_id,
      hasAppKey: !!sanitized.app_key,
      hasSanitizationFlag: sanitized._sanitized === true,
      hasNote: !!sanitized._note,
    });

    const passed =
      !sanitized.app_id && !sanitized.app_key && sanitized._sanitized === true;

    console.log(
      passed ? "✓ Sanitization test PASSED" : "✗ Sanitization test FAILED"
    );
    return passed;
  },

  /**
   * Test debug info formatting
   */
  testDebugFormatting() {
    console.log("\n=== DEBUG INFO FORMATTING TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    const mockDebugData = downloader.createMockDebugData("text");
    const formatted = downloader.formatDebugInfo(mockDebugData);

    console.log("Debug info formatted:", {
      length: formatted.length,
      hasMarkdownHeaders: formatted.includes("##"),
      hasRequestSection: formatted.includes("Request Details"),
      hasResponseSection: formatted.includes("Response Metadata"),
    });

    const passed =
      formatted.length > 0 &&
      formatted.includes("##") &&
      formatted.includes("Request Details");

    console.log(
      passed
        ? "✓ Debug formatting test PASSED"
        : "✗ Debug formatting test FAILED"
    );
    return passed;
  },

  /**
   * Test metadata generation
   */
  testMetadataGeneration() {
    console.log("\n=== METADATA GENERATION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    // Create mock collection results
    const sourceResult = {
      sourceType: "upload",
      filesCollected: [{ type: "upload", filename: "test.txt", size: 100 }],
      errors: [],
    };

    const resultsResult = {
      apiType: "text",
      filesCollected: [
        {
          type: "latex",
          filename: "latex.tex",
          size: 50,
          format: "text/x-latex",
        },
        { type: "html", filename: "html.html", size: 100, format: "text/html" },
      ],
      errors: [],
    };

    const mockResponse = downloader.createMockResponse("text");

    // Generate metadata
    const metadata = downloader.generateMetadata(
      sourceResult,
      resultsResult,
      mockResponse
    );

    console.log("Metadata generated:", {
      hasDownloadSection: !!metadata.download,
      hasProcessingSection: !!metadata.processing,
      hasContentSection: !!metadata.content,
      hasFormatsSection: !!metadata.formats,
      sourceType: metadata.download.sourceType,
      apiType: metadata.download.apiType,
      totalFiles: metadata.formats.totalFiles,
    });

    const passed =
      metadata.download &&
      metadata.processing &&
      metadata.content &&
      metadata.formats &&
      metadata.formats.totalFiles === 3;

    console.log(
      passed
        ? "✓ Metadata generation test PASSED"
        : "✗ Metadata generation test FAILED"
    );
    return passed;
  },

  /**
   * Test production README generation
   */
  testReadmeGeneration() {
    console.log("\n=== PRODUCTION README GENERATION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    // Create mock manifest
    const sourceResult = {
      sourceType: "upload",
      filesCollected: [{ type: "upload", filename: "test.txt", size: 100 }],
      errors: [],
    };

    const resultsResult = {
      apiType: "text",
      filesCollected: [
        {
          type: "latex",
          filename: "latex.tex",
          size: 50,
          format: "text/x-latex",
        },
      ],
      errors: [],
    };

    const mockResponse = downloader.createMockResponse("text");
    const metadata = downloader.generateMetadata(
      sourceResult,
      resultsResult,
      mockResponse
    );

    const manifest = {
      sourceResult,
      resultsResult,
      response: mockResponse,
      metadata,
    };

    // Generate README
    const readme = downloader.generateProductionReadme(manifest);

    console.log("README generated:", {
      length: readme.length,
      hasHeader: readme.includes("MathPix Processing Archive"),
      hasSummary: readme.includes("INTERACTION SUMMARY"),
      hasContents: readme.includes("ARCHIVE CONTENTS"),
      hasFormats: readme.includes("FORMATS INCLUDED"),
      hasTechnical: readme.includes("TECHNICAL INFORMATION"),
    });

    const passed =
      readme.length > 1000 &&
      readme.includes("MathPix Processing Archive") &&
      readme.includes("INTERACTION SUMMARY");

    console.log(
      passed
        ? "✓ README generation test PASSED"
        : "✗ README generation test FAILED"
    );
    return passed;
  },

  /**
   * Test data collection orchestrator
   */
  async testDataCollection() {
    console.log("\n=== DATA COLLECTION TEST ===");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    // Create mock data
    const sourceResult = {
      sourceType: "upload",
      filesCollected: [{ type: "upload", filename: "test.txt", size: 100 }],
      errors: [],
    };

    const resultsResult = {
      apiType: "text",
      filesCollected: [
        {
          type: "latex",
          filename: "latex.tex",
          size: 50,
          format: "text/x-latex",
        },
      ],
      errors: [],
    };

    const mockResponse = downloader.createMockResponse("text");
    const mockRequest = downloader.createMockRequest("text");
    const mockDebugData = downloader.createMockDebugData("text");

    const collectionData = {
      sourceResult,
      resultsResult,
      response: mockResponse,
      request: mockRequest,
      debugData: mockDebugData,
    };

    // Create ZIP and collect data
    const zip = new JSZip();
    const dataFolder = zip.folder("data");
    const result = await downloader.collectDataFiles(
      collectionData,
      dataFolder
    );

    console.log("Data collection result:", result);
    console.log("Files collected:", result.filesCollected.length);
    console.log(
      "Expected: 4 files (api-request, api-response, debug-info, metadata)"
    );

    // Verify each file
    result.filesCollected.forEach((file) => {
      console.log(`✓ ${file.type}: ${file.filename} (${file.size} bytes)`);
    });

    const passed =
      result.filesCollected.length === 4 && result.errors.length === 0;

    console.log(
      passed ? "✓ Data collection test PASSED" : "✗ Data collection test FAILED"
    );
    return passed;
  },

  /**
   * Test complete Phase 4 ZIP creation
   */
  async testPhase4ZipCreation() {
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 4: Complete ZIP Creation Test");
    console.log("═══════════════════════════════════════════════════\n");

    const downloader = new MathPixTotalDownloader(null);
    downloader.initialize();

    console.log("Creating test ZIP with complete Phase 4 data collection...");
    await downloader.createTestZip("upload", "text");
    console.log("✓ test-upload-text-mathpix.zip downloaded\n");

    console.log("Extract and verify:");
    console.log("- /source/ folder with test-upload.txt");
    console.log("- /results/ folder with 6 format files");
    console.log("- /data/ folder with 4 data files:");
    console.log("  - api-request.json (sanitized - no credentials)");
    console.log("  - api-response.json (complete response)");
    console.log("  - debug-info.md (formatted debug info)");
    console.log("  - metadata.json (comprehensive metadata)");
    console.log("- README.txt (production README with processing details)\n");

    return true;
  },

  /**
   * Run all Phase 4 tests
   */
  async runPhase4Tests() {
    console.log("\n".repeat(2));
    console.log("═══════════════════════════════════════════════════");
    console.log("  MathPix Total Downloader - Phase 4 Test Suite");
    console.log("═══════════════════════════════════════════════════\n");

    // Prerequisites check
    const prereqsPassed = this.checkPrerequisites();
    if (!prereqsPassed) {
      console.error("Prerequisites check failed. Cannot continue.");
      return false;
    }

    console.log("");

    // Individual component tests
    console.log("STEP 1: Component Tests");
    console.log("─────────────────────────────────────────\n");

    const sanitizationPassed = this.testApiSanitization();
    const debugPassed = this.testDebugFormatting();
    const metadataPassed = this.testMetadataGeneration();
    const readmePassed = this.testReadmeGeneration();

    console.log("\nStep 1 Results:");
    console.log(
      sanitizationPassed
        ? "✓ Sanitization test passed"
        : "✗ Sanitization test failed"
    );
    console.log(
      debugPassed
        ? "✓ Debug formatting test passed"
        : "✗ Debug formatting test failed"
    );
    console.log(
      metadataPassed
        ? "✓ Metadata generation test passed"
        : "✗ Metadata generation test failed"
    );
    console.log(
      readmePassed
        ? "✓ README generation test passed"
        : "✗ README generation test failed"
    );

    // Data collection test
    console.log("\n\nSTEP 2: Data Collection Test");
    console.log("─────────────────────────────────────────\n");

    const collectionPassed = await this.testDataCollection();

    // Full ZIP creation test
    console.log("\n\nSTEP 3: Complete ZIP Creation Test");
    console.log("─────────────────────────────────────────\n");

    await this.testPhase4ZipCreation();

    // Summary
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Phase 4 Test Suite Complete");
    console.log("═══════════════════════════════════════════════════\n");

    const allPassed =
      sanitizationPassed &&
      debugPassed &&
      metadataPassed &&
      readmePassed &&
      collectionPassed;
    console.log(allPassed ? "✓ All tests passed!" : "✗ Some tests failed");

    return allPassed;
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

logInfo("MathPix Total Downloader loaded (Phase 4 Complete)");
logInfo("✓ Source file collection (Phase 2)");
logInfo("✓ Results format collection (Phase 3)");
logInfo("✓ Data & debug collection (Phase 4)");
logInfo("Ready for Phase 5: UI Integration");

export default MathPixTotalDownloader;
