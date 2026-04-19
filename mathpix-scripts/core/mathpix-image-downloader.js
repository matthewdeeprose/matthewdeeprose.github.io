/**
 * @fileoverview MathPix Image Downloader — CDN Image Download Orchestrator
 * @module MathPixImageDownloader
 * @requires MathPixImageRegistry (window.MathPixImageRegistry)
 * @version 1.0.0
 * @since Phase 8E (Conv AG)
 *
 * @description
 * Downloads CDN-linked images detected by the image registry, stores blobs
 * in the registry via attachBlob(), and provides filename mapping for ZIP
 * inclusion. Handles parallel downloads with concurrency limiting, timeouts,
 * CORS errors, and graceful degradation.
 *
 * Architecture:
 * - IIFE with class pattern (matches mathpix-image-registry.js)
 * - Zero DOM dependencies — pure data/network operations
 * - Defensive coding: never throws from public methods, returns result objects
 * - Concurrency-limited parallel download via batch processing
 *
 * Integration:
 * - Called by mathpix-total-downloader.js during createArchive()
 * - Populates registry via attachBlob() — registry handles status transitions
 * - Provides filenameMap for ZIP /images/ folder naming
 *
 * @see mathpix-image-registry.js — Registry module (buildFromMMD, attachBlob, toJSON)
 * @see mathpix-total-downloader.js — ZIP creation (createArchive)
 * @see phase-8-bible-v1-4.md — Architecture specification
 */

(function () {
  "use strict";

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

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImageDownloader] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageDownloader] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageDownloader] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageDownloader] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** Default concurrency limit for parallel downloads */
  const DEFAULT_CONCURRENCY = 3;

  /** Default timeout per image download (milliseconds) */
  const DEFAULT_TIMEOUT_MS = 30000;

  /** MIME type fallback when Content-Type header is unavailable */
  const FALLBACK_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Infer file extension from a MIME type string.
   *
   * @param {string} mimeType - MIME type (e.g. "image/jpeg")
   * @returns {string} File extension including dot (e.g. ".jpg")
   */
  function extensionFromMime(mimeType) {
    const map = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/bmp": ".bmp",
      "image/tiff": ".tiff",
    };
    return map[mimeType] || ".jpg";
  }

  /**
   * Infer file extension from a URL's path (ignoring query parameters).
   *
   * @param {string} url - Full URL
   * @returns {string} File extension including dot, or ".jpg" as fallback
   */
  function extensionFromUrl(url) {
    if (!url || typeof url !== "string") return ".jpg";
    try {
      const pathname = new URL(url).pathname;
      const dotIndex = pathname.lastIndexOf(".");
      if (dotIndex === -1) return ".jpg";
      const ext = pathname.substring(dotIndex).toLowerCase();
      // Only return known image extensions
      if (FALLBACK_MIME_MAP[ext]) return ext;
      return ".jpg";
    } catch {
      // URL parsing failed — try simple extraction
      const clean = url.split("?")[0].split("#")[0];
      const dotIndex = clean.lastIndexOf(".");
      if (dotIndex === -1) return ".jpg";
      const ext = clean.substring(dotIndex).toLowerCase();
      if (FALLBACK_MIME_MAP[ext]) return ext;
      return ".jpg";
    }
  }

  /**
   * Convert a CDN URL to the expected filename inside MathPix's mmd.zip.
   *
   * CDN URL pattern:
   *   https://cdn.mathpix.com/cropped/{pdfId}-{page}.jpg?height=H&width=W&top_left_y=Y&top_left_x=X
   *
   * ZIP filename pattern:
   *   {pdfId}-{page}_{H}_{W}_{Y}_{X}.jpg
   *
   * @param {string} cdnUrl - Full CDN image URL
   * @returns {string|null} Expected ZIP filename (without folder prefix), or null
   */
  function cdnUrlToZipFilename(cdnUrl) {
    if (!cdnUrl || typeof cdnUrl !== "string") return null;
    try {
      const url = new URL(cdnUrl);
      const pathname = url.pathname;
      const base = pathname.split("/").pop(); // e.g. "abc-1.jpg"
      if (!base) return null;

      const dotIdx = base.lastIndexOf(".");
      const ext = dotIdx !== -1 ? base.substring(dotIdx) : ".jpg";
      const name = dotIdx !== -1 ? base.substring(0, dotIdx) : base;

      const height = url.searchParams.get("height");
      const width = url.searchParams.get("width");
      const topLeftY = url.searchParams.get("top_left_y");
      const topLeftX = url.searchParams.get("top_left_x");

      if (height && width && topLeftY && topLeftX) {
        return `${name}_${height}_${width}_${topLeftY}_${topLeftX}${ext}`;
      }
      // Fallback: base filename without query params
      return base;
    } catch {
      return null;
    }
  }

  /**
   * Sanitise a string for use in filenames.
   * Removes unsafe characters, replaces spaces with hyphens.
   *
   * @param {string} name - Raw name string
   * @returns {string} Sanitised filename-safe string
   */
  function sanitiseForFilename(name) {
    if (!name || typeof name !== "string") return "document";
    return (
      name
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/[<>:"/\\|?*]/g, "-") // Replace unsafe chars
        .replace(/\s+/g, "-") // Replace spaces
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-|-$/g, "") // Trim leading/trailing hyphens
        .substring(0, 100) || // Limit length
      "document"
    );
  }

  // ============================================================================
  // MAIN CLASS
  // ============================================================================

  /**
   * MathPixImageDownloader — Downloads CDN images and prepares them for ZIP.
   *
   * Usage:
   *   const downloader = new MathPixImageDownloader();
   *   const result = await downloader.downloadAll(registry, 'my-document');
   *   // result.filenameMap maps registry IDs to ZIP filenames
   *   // registry entries now have blobs attached (for successful downloads)
   */
  class MathPixImageDownloader {
    constructor(options = {}) {
      /** @type {number} Maximum concurrent downloads */
      this.concurrency = options.concurrency || DEFAULT_CONCURRENCY;

      /** @type {number} Timeout per download in milliseconds */
      this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

      /** @type {Function|null} Progress callback: (completed, total) => void */
      this.onProgress = options.onProgress || null;

      logDebug("MathPixImageDownloader instance created", {
        concurrency: this.concurrency,
        timeoutMs: this.timeoutMs,
      });
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Download all CDN-linked images from the registry.
     *
     * Filters for images with status "cdn-linked", downloads in parallel
     * (respecting concurrency limit), attaches blobs to registry entries,
     * and returns a filename map for ZIP inclusion.
     *
     * Duplicate URLs (same URL at different lines) are downloaded once and
     * the blob is shared between entries. The ZIP gets one file, but the
     * filenameMap maps both IDs to the same filename.
     *
     * @param {MathPixImageRegistry} registry - Populated image registry
     * @param {string} [baseName="document"] - Base name for image filenames
     * @returns {Promise<Object>} Download result object
     */
    async downloadAll(registry, baseName = "document") {
      const startTime = performance.now();
      const safeName = sanitiseForFilename(baseName);

      logInfo("Starting image download...", { baseName: safeName });

      // Validate registry
      if (!registry || typeof registry.getAllImages !== "function") {
        logError("downloadAll() called with invalid registry");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      // Get CDN-linked images only
      const allImages = registry.getAllImages();
      const cdnImages = allImages.filter(
        (img) =>
          img.status === "cdn-linked" &&
          img.originalUrl &&
          img.originalUrl.startsWith("http"),
      );

      if (cdnImages.length === 0) {
        logInfo("No CDN-linked images to download");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      logInfo(`Found ${cdnImages.length} CDN-linked images to download`);

      // Deduplicate by URL — same URL at different lines should download once
      const urlToEntries = new Map();
      for (const img of cdnImages) {
        const key = img.originalUrl;
        if (!urlToEntries.has(key)) {
          urlToEntries.set(key, []);
        }
        urlToEntries.get(key).push(img);
      }

      const uniqueUrls = Array.from(urlToEntries.keys());
      logInfo(
        `Unique URLs to download: ${uniqueUrls.length} (from ${cdnImages.length} entries)`,
      );

      // Assign filenames — sequential numbering across all entries
      const filenameMap = {};
      let imageNumber = 1;
      for (const img of cdnImages) {
        // Only assign a new filename if this URL hasn't been assigned yet
        const existingEntry = Object.values(filenameMap).find(
          (entry) => entry.url === img.originalUrl,
        );

        if (existingEntry) {
          // Share the same filename for duplicate URLs
          filenameMap[img.id] = {
            filename: existingEntry.filename,
            url: img.originalUrl,
            shared: true,
          };
        } else {
          const ext = extensionFromUrl(img.originalUrl);
          const filename = `${safeName}-image-${imageNumber}${ext}`;
          filenameMap[img.id] = {
            filename,
            url: img.originalUrl,
            shared: false,
          };
          imageNumber++;
        }
      }

      // Download unique URLs in batches
      let succeeded = 0;
      let failed = 0;
      let completed = 0;
      const total = uniqueUrls.length;
      const downloadedBlobs = new Map(); // url → Blob

      for (let i = 0; i < uniqueUrls.length; i += this.concurrency) {
        const batch = uniqueUrls.slice(i, i + this.concurrency);

        const results = await Promise.allSettled(
          batch.map((url) => this._downloadSingle(url)),
        );

        for (let j = 0; j < results.length; j++) {
          const url = batch[j];
          const result = results[j];

          if (result.status === "fulfilled" && result.value) {
            downloadedBlobs.set(url, result.value);
            succeeded++;
          } else {
            const reason =
              result.status === "rejected"
                ? result.reason?.message || "Unknown error"
                : "No blob returned";
            logWarn(
              `Failed to download: ${url.substring(0, 80)}... — ${reason}`,
            );
            failed++;
          }

          completed++;
          if (this.onProgress) {
            try {
              this.onProgress(completed, total);
            } catch (progressError) {
              logDebug("Progress callback error:", progressError);
            }
          }
        }
      }

      // Attach blobs to registry entries
      let attachedCount = 0;
      for (const [url, blob] of downloadedBlobs) {
        const entries = urlToEntries.get(url);
        if (!entries) continue;

        for (const entry of entries) {
          const attached = registry.attachBlob(entry.id, blob);
          if (attached) {
            attachedCount++;
            logDebug(`Blob attached to ${entry.id} (${blob.size} bytes)`);
          }
        }
      }

      // Update filenameMap with download status
      for (const id of Object.keys(filenameMap)) {
        const entry = filenameMap[id];
        entry.downloaded = downloadedBlobs.has(entry.url);
      }

      const elapsed = (performance.now() - startTime).toFixed(0);
      logInfo(
        `Download complete in ${elapsed}ms: ${succeeded}/${total} URLs succeeded, ${attachedCount} blobs attached`,
      );

      return this._createResult(
        safeName,
        total,
        succeeded,
        failed,
        filenameMap,
        startTime,
      );
    }

    /**
     * Download images via MathPix API's mmd.zip endpoint.
     *
     * This is the preferred strategy: fetches the authenticated mmd.zip from the
     * API (which includes all document images), extracts them, and maps them to
     * registry entries. Bypasses CDN CORS restrictions entirely.
     *
     * @param {MathPixImageRegistry} registry - Populated image registry
     * @param {string} pdfId - MathPix PDF processing ID
     * @param {Object} credentials - { appId, appKey, apiBase }
     * @param {string} [baseName="document"] - Base name for image filenames
     * @returns {Promise<Object>} Download result object (same shape as downloadAll)
     */
    async downloadFromMmdZip(
      registry,
      pdfId,
      credentials,
      baseName = "document",
    ) {
      const startTime = performance.now();
      const safeName = sanitiseForFilename(baseName);

      logInfo("Starting mmd.zip image extraction...", {
        pdfId,
        baseName: safeName,
      });

      // Validate inputs
      if (!registry || typeof registry.getAllImages !== "function") {
        logError("downloadFromMmdZip() called with invalid registry");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      if (!pdfId || typeof pdfId !== "string") {
        logError("downloadFromMmdZip() called without valid pdfId");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      if (!credentials?.appId || !credentials?.appKey) {
        logError("downloadFromMmdZip() called without valid credentials");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      // Get CDN-linked images from registry
      const allImages = registry.getAllImages();
      const cdnImages = allImages.filter(
        (img) =>
          img.status === "cdn-linked" &&
          img.originalUrl &&
          img.originalUrl.startsWith("http"),
      );

      if (cdnImages.length === 0) {
        logInfo("No CDN-linked images to extract");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      logInfo(`Registry has ${cdnImages.length} CDN-linked images`);

      // Progress: step 1 — fetching ZIP
      if (this.onProgress) {
        try {
          this.onProgress(0, cdnImages.length, "fetching");
        } catch {
          /* skip */
        }
      }

      // Fetch mmd.zip from API
      const apiBase =
        credentials.apiBase || "https://eu-central-1.api.mathpix.com/v3";
      const zipUrl = `${apiBase}/pdf/${pdfId}.mmd.zip`;

      let zipBlob;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for ZIP

        const response = await fetch(zipUrl, {
          method: "GET",
          headers: {
            app_id: credentials.appId,
            app_key: credentials.appKey,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `API returned ${response.status} ${response.statusText}`,
          );
        }

        zipBlob = await response.blob();
        logInfo(`mmd.zip received: ${(zipBlob.size / 1024).toFixed(1)} KB`);
      } catch (fetchError) {
        logWarn("Failed to fetch mmd.zip:", fetchError.message);
        logInfo("Falling back to direct CDN download...");
        return this.downloadAll(registry, baseName);
      }

      // Extract images from ZIP
      if (typeof JSZip === "undefined") {
        logError("JSZip not available — cannot extract mmd.zip");
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      let zip;
      try {
        zip = await JSZip.loadAsync(zipBlob);
      } catch (zipError) {
        logError("Failed to parse mmd.zip:", zipError.message);
        return this._createResult(safeName, 0, 0, 0, {}, startTime);
      }

      // Build lookup map: expected ZIP filename → ZIP file entry
      const zipImageMap = new Map(); // normalised filename → { path, file }
      const imageExtensions = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
      ];

      for (const [filepath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        const ext = filepath.split(".").pop().toLowerCase();
        if (!imageExtensions.includes(ext)) continue;

        // Store by just the filename (without folder prefix)
        const filename = filepath.split("/").pop();
        zipImageMap.set(filename, { path: filepath, file });
      }

      logInfo(`Found ${zipImageMap.size} images in mmd.zip`);

      // Match registry entries to ZIP images
      const filenameMap = {};
      let succeeded = 0;
      let failed = 0;
      let imageNumber = 1;
      const processedZipFiles = new Set(); // Track which ZIP files we've extracted

      for (const img of cdnImages) {
        const expectedZipName = cdnUrlToZipFilename(img.originalUrl);
        const zipEntry = expectedZipName
          ? zipImageMap.get(expectedZipName)
          : null;

        // Determine output filename for our ZIP
        const ext = extensionFromUrl(img.originalUrl);
        const outputFilename = `${safeName}-image-${imageNumber}${ext}`;
        imageNumber++;

        if (zipEntry) {
          try {
            const blob = await zipEntry.file.async("blob");

            if (blob && blob.size > 0) {
              registry.attachBlob(img.id, blob);
              filenameMap[img.id] = {
                filename: outputFilename,
                url: img.originalUrl,
                downloaded: true,
                shared: false,
                sourceZipPath: zipEntry.path,
              };
              processedZipFiles.add(expectedZipName);
              succeeded++;
              logDebug(
                `Matched: ${img.id} → ${zipEntry.path} (${blob.size} bytes)`,
              );
            } else {
              throw new Error("Empty blob from ZIP");
            }
          } catch (extractError) {
            logWarn(
              `Failed to extract ${expectedZipName}:`,
              extractError.message,
            );
            filenameMap[img.id] = {
              filename: outputFilename,
              url: img.originalUrl,
              downloaded: false,
              shared: false,
            };
            failed++;
          }
        } else {
          logWarn(`No ZIP match for: ${img.id} (expected: ${expectedZipName})`);
          filenameMap[img.id] = {
            filename: outputFilename,
            url: img.originalUrl,
            downloaded: false,
            shared: false,
          };
          failed++;
        }

        // Progress callback
        if (this.onProgress) {
          try {
            this.onProgress(succeeded + failed, cdnImages.length, "extracting");
          } catch {
            /* skip */
          }
        }
      }

      // Log any ZIP images not matched to registry entries
      const unmatchedZip = [];
      for (const [filename] of zipImageMap) {
        if (!processedZipFiles.has(filename)) {
          unmatchedZip.push(filename);
        }
      }
      if (unmatchedZip.length > 0) {
        logDebug(
          `${unmatchedZip.length} ZIP images not in registry (deduplicated or extra):`,
          unmatchedZip,
        );
      }

      const elapsed = (performance.now() - startTime).toFixed(0);
      logInfo(
        `mmd.zip extraction complete in ${elapsed}ms: ${succeeded}/${cdnImages.length} matched, ${failed} failed`,
      );

      return this._createResult(
        safeName,
        cdnImages.length,
        succeeded,
        failed,
        filenameMap,
        startTime,
      );
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    /**
     * Download a single image URL with timeout and error handling.
     *
     * @private
     * @param {string} url - Image URL to download
     * @returns {Promise<Blob|null>} Image blob or null on failure
     */
    async _downloadSingle(url) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        logDebug(`Downloading: ${url.substring(0, 80)}...`);

        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          // No credentials — CDN images are public
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        if (!blob || blob.size === 0) {
          throw new Error("Empty response body");
        }

        logDebug(
          `Downloaded: ${blob.size} bytes, type: ${blob.type || "unknown"}`,
        );
        return blob;
      } catch (error) {
        if (error.name === "AbortError") {
          logWarn(
            `Timeout after ${this.timeoutMs}ms: ${url.substring(0, 80)}...`,
          );
          throw new Error(`Timeout after ${this.timeoutMs}ms`);
        }

        // CORS errors show as TypeError with "Failed to fetch"
        if (
          error instanceof TypeError &&
          error.message.includes("Failed to fetch")
        ) {
          logWarn(`CORS or network error: ${url.substring(0, 80)}...`);
          throw new Error(
            "CORS or network error — CDN may not allow cross-origin requests",
          );
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    /**
     * Create a standardised result object.
     *
     * @private
     * @param {string} baseName - Sanitised base filename
     * @param {number} total - Total unique URLs attempted
     * @param {number} succeeded - Successfully downloaded count
     * @param {number} failed - Failed download count
     * @param {Object} filenameMap - ID → { filename, url, downloaded, shared }
     * @param {number} startTime - performance.now() at start
     * @returns {Object} Result object
     */
    _createResult(baseName, total, succeeded, failed, filenameMap, startTime) {
      const elapsed = performance.now() - startTime;
      return {
        baseName,
        total,
        succeeded,
        failed,
        skipped: total - succeeded - failed,
        allSucceeded: total > 0 && failed === 0,
        noneSucceeded: total > 0 && succeeded === 0,
        hasImages: total > 0,
        filenameMap,
        elapsedMs: Math.round(elapsed),
      };
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixImageDownloader = MathPixImageDownloader;

  // ============================================================================
  // TEST SUITE
  // ============================================================================

  /**
   * Comprehensive test suite for MathPixImageDownloader.
   * Self-contained — run via window.testImageDownloader() in browser console.
   *
   * Tests cover:
   * - Construction and configuration
   * - Filename generation and sanitisation
   * - Duplicate URL handling
   * - Download result structure
   * - Registry integration (attachBlob via real registry)
   * - Error handling (CORS, timeout, 404)
   * - Zero-image edge case
   * - Filename map correctness
   */
  window.testImageDownloader = async function () {
    console.log("=== MathPix Image Downloader Test Suite ===\n");

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(testName, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${testName}`);
      } else {
        failed++;
        const msg = detail ? `${testName} — ${detail}` : testName;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    // Check prerequisites
    if (typeof MathPixImageRegistry === "undefined") {
      console.error("❌ MathPixImageRegistry not loaded. Cannot run tests.");
      return { passed: 0, failed: 1, total: 1 };
    }

    if (typeof MathPixImageDownloader === "undefined") {
      console.error("❌ MathPixImageDownloader not loaded. Cannot run tests.");
      return { passed: 0, failed: 1, total: 1 };
    }

    // ========================================================================
    // GROUP 1: CONSTRUCTION
    // ========================================================================
    console.log("--- 1. Construction ---");

    {
      const dl = new MathPixImageDownloader();
      assert("Default concurrency is 3", dl.concurrency === 3);
      assert("Default timeout is 30000ms", dl.timeoutMs === 30000);
      assert("Default onProgress is null", dl.onProgress === null);
    }

    {
      const dl = new MathPixImageDownloader({
        concurrency: 5,
        timeoutMs: 10000,
        onProgress: () => {},
      });
      assert("Custom concurrency", dl.concurrency === 5);
      assert("Custom timeout", dl.timeoutMs === 10000);
      assert("Custom onProgress set", typeof dl.onProgress === "function");
    }

    // ========================================================================
    // GROUP 2: INVALID REGISTRY HANDLING
    // ========================================================================
    console.log("\n--- 2. Invalid Registry ---");

    {
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(null, "test");
      assert("Null registry: total = 0", result.total === 0);
      assert("Null registry: hasImages = false", result.hasImages === false);
      assert(
        "Null registry: filenameMap is empty",
        Object.keys(result.filenameMap).length === 0,
      );
    }

    {
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll({}, "test");
      assert("Invalid registry: total = 0", result.total === 0);
    }

    // ========================================================================
    // GROUP 3: ZERO IMAGES
    // ========================================================================
    console.log("\n--- 3. Zero Images ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD("No images here, just text.\nMore text.");
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "empty-doc");
      assert("No images: total = 0", result.total === 0);
      assert("No images: succeeded = 0", result.succeeded === 0);
      assert("No images: hasImages = false", result.hasImages === false);
      assert("No images: baseName correct", result.baseName === "empty-doc");
    }

    // ========================================================================
    // GROUP 4: DATA-URI ONLY (no CDN downloads needed)
    // ========================================================================
    console.log("\n--- 4. Data URI Only ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD("![chart](data:image/png;base64,iVBORw0KGgo=)");
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "base64-doc");
      assert("Data URI only: total = 0", result.total === 0);
      assert(
        "Data URI only: hasImages = false (no CDN images)",
        result.hasImages === false,
      );
    }

    // ========================================================================
    // GROUP 5: FILENAME MAP GENERATION
    // ========================================================================
    console.log("\n--- 5. Filename Map ---");

    {
      const mmd = [
        "![](https://cdn.mathpix.com/cropped/abc-1.jpg?height=100)",
        "![](https://cdn.mathpix.com/cropped/abc-2.png?height=200)",
        "![](https://cdn.mathpix.com/cropped/abc-3.jpg?height=300)",
      ].join("\n");

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "FEEG1050-exam.pdf");

      assert(
        "Filename map has 3 entries",
        Object.keys(result.filenameMap).length === 3,
      );

      const filenames = Object.values(result.filenameMap).map(
        (e) => e.filename,
      );
      assert(
        "First filename correct",
        filenames.includes("FEEG1050-exam-image-1.jpg"),
        `Got: ${filenames[0]}`,
      );
      assert(
        "Second filename correct",
        filenames.includes("FEEG1050-exam-image-2.png"),
        `Got: ${filenames[1]}`,
      );
      assert(
        "Third filename correct",
        filenames.includes("FEEG1050-exam-image-3.jpg"),
        `Got: ${filenames[2]}`,
      );
      assert("BaseName sanitised", result.baseName === "FEEG1050-exam");
    }

    // ========================================================================
    // GROUP 6: DUPLICATE URL HANDLING
    // ========================================================================
    console.log("\n--- 6. Duplicate URLs ---");

    {
      const mmd = [
        "![](https://cdn.mathpix.com/cropped/same.jpg?h=100)",
        "Text between",
        "![](https://cdn.mathpix.com/cropped/same.jpg?h=100)",
        "![](https://cdn.mathpix.com/cropped/different.png?h=200)",
      ].join("\n");

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "dup-test");

      // 3 registry entries but only 2 unique URLs
      assert(
        "Duplicate: 2 unique URLs to download",
        result.total === 2,
        `Got ${result.total}`,
      );
      assert(
        "Duplicate: 3 entries in filename map",
        Object.keys(result.filenameMap).length === 3,
      );

      // The two entries with same URL should share a filename
      const entries = Object.values(result.filenameMap);
      const sharedEntries = entries.filter((e) => e.shared === true);
      assert(
        "Duplicate: one entry marked as shared",
        sharedEntries.length === 1,
        `Got ${sharedEntries.length} shared`,
      );

      // Shared entry has same filename as the non-shared entry with same URL
      if (sharedEntries.length === 1) {
        const original = entries.find(
          (e) => e.url === sharedEntries[0].url && !e.shared,
        );
        assert(
          "Duplicate: shared filename matches original",
          sharedEntries[0].filename === original?.filename,
        );
      }
    }

    // ========================================================================
    // GROUP 7: FILENAME SANITISATION
    // ========================================================================
    console.log("\n--- 7. Filename Sanitisation ---");

    {
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD("![](https://cdn.mathpix.com/cropped/x.jpg?h=1)");
      const dl = new MathPixImageDownloader();

      const r1 = await dl.downloadAll(reg, "My Document (2024).pdf");
      assert(
        "Sanitise: spaces and parens",
        r1.baseName === "My-Document-(2024)",
        `Got: "${r1.baseName}"`,
      );

      const r2 = await dl.downloadAll(reg, 'test<>:"/\\|?*.pdf');
      assert(
        "Sanitise: unsafe chars removed",
        !r2.baseName.includes("<") && !r2.baseName.includes(">"),
      );

      const r3 = await dl.downloadAll(reg, "");
      assert("Sanitise: empty → 'document'", r3.baseName === "document");

      const r4 = await dl.downloadAll(reg, null);
      assert("Sanitise: null → 'document'", r4.baseName === "document");
    }

    // ========================================================================
    // GROUP 8: RESULT STRUCTURE
    // ========================================================================
    console.log("\n--- 8. Result Structure ---");

    {
      const mmd =
        "![](https://cdn.mathpix.com/cropped/test.jpg?h=100)\n![](https://cdn.mathpix.com/cropped/test2.png?h=200)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "structure-test");

      assert("Result has baseName", typeof result.baseName === "string");
      assert("Result has total", typeof result.total === "number");
      assert("Result has succeeded", typeof result.succeeded === "number");
      assert("Result has failed", typeof result.failed === "number");
      assert("Result has skipped", typeof result.skipped === "number");
      assert(
        "Result has allSucceeded",
        typeof result.allSucceeded === "boolean",
      );
      assert(
        "Result has noneSucceeded",
        typeof result.noneSucceeded === "boolean",
      );
      assert("Result has hasImages", typeof result.hasImages === "boolean");
      assert("Result has filenameMap", typeof result.filenameMap === "object");
      assert("Result has elapsedMs", typeof result.elapsedMs === "number");
      assert("Total = 2", result.total === 2);
      assert("hasImages = true", result.hasImages === true);
    }

    // ========================================================================
    // GROUP 9: CORS / NETWORK ERRORS (real CDN test)
    // ========================================================================
    console.log("\n--- 9. CORS / Network Errors (live) ---");

    {
      const mmd =
        "![](https://cdn.mathpix.com/cropped/17cb4da8-test-1.jpg?height=100&width=100)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "cors-test");

      // From localhost, this will likely fail due to CORS
      assert("CORS test: completed without throwing", true);
      assert("CORS test: total = 1", result.total === 1);
      assert(
        "CORS test: failed = 1 (expected from localhost)",
        result.failed === 1,
        `succeeded=${result.succeeded}, failed=${result.failed}`,
      );
      assert("CORS test: noneSucceeded = true", result.noneSucceeded === true);
    }

    // ========================================================================
    // GROUP 10: 404 ERROR HANDLING
    // ========================================================================
    console.log("\n--- 10. 404 Handling ---");

    {
      const mmd = "![](https://httpstat.us/404)";
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "error-test");

      assert("404 test: completed without throwing", true);
      assert("404 test: failed >= 0", result.failed >= 0);
      // Note: httpstat.us might also be blocked by CORS, so we just check it didn't crash
    }

    // ========================================================================
    // GROUP 11: PROGRESS CALLBACK
    // ========================================================================
    console.log("\n--- 11. Progress Callback ---");

    {
      const progressCalls = [];
      const mmd = [
        "![](https://cdn.mathpix.com/cropped/p1.jpg?h=1)",
        "![](https://cdn.mathpix.com/cropped/p2.jpg?h=2)",
        "![](https://cdn.mathpix.com/cropped/p3.jpg?h=3)",
      ].join("\n");

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader({
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });
      await dl.downloadAll(reg, "progress-test");

      assert(
        "Progress: callbacks received",
        progressCalls.length > 0,
        `Got ${progressCalls.length} calls`,
      );
      assert(
        "Progress: total consistent",
        progressCalls.every((p) => p.total === 3),
        `Totals: ${progressCalls.map((p) => p.total)}`,
      );
      assert(
        "Progress: completed increments",
        progressCalls.length >= 1 &&
          progressCalls[progressCalls.length - 1].completed === 3,
        `Last completed: ${progressCalls[progressCalls.length - 1]?.completed}`,
      );
    }

    // ========================================================================
    // GROUP 12: REGISTRY INTEGRATION — attachBlob
    // ========================================================================
    console.log("\n--- 12. Registry Integration ---");

    {
      // Create a registry with a mock "downloadable" image
      // Since real CDN URLs fail from localhost, we test the flow with a synthetic blob
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(
        "![](https://cdn.mathpix.com/cropped/test-attach.jpg?h=1)",
      );
      const images = reg.getAllImages();
      assert("Registry has 1 image", images.length === 1);
      assert(
        "Registry image starts as cdn-linked",
        images[0].status === "cdn-linked",
      );

      // Simulate what downloadAll does: manually attachBlob
      const mockBlob = new Blob(["fake image data"], { type: "image/jpeg" });
      const attached = reg.attachBlob(images[0].id, mockBlob);
      assert("attachBlob returns true", attached === true);

      const updated = reg.getImage(images[0].id);
      assert(
        "After attachBlob: status = downloaded",
        updated?.status === "downloaded",
      );
      assert(
        "After attachBlob: fileSize set",
        updated?.fileSize === mockBlob.size,
      );
      assert(
        "After attachBlob: mimeType set",
        updated?.mimeType === "image/jpeg",
      );
      assert("After attachBlob: downloadedAt set", !!updated?.downloadedAt);

      // Check toJSON includes hadBlob flag
      const json = reg.toJSON();
      const jsonImg = json.images[0];
      assert("toJSON: hadBlob = true", jsonImg?.hadBlob === true);
      assert("toJSON: blob is null (excluded)", jsonImg?.blob === null);
    }

    // ========================================================================
    // GROUP 13: EXTENSION INFERENCE
    // ========================================================================
    console.log("\n--- 13. Extension Inference ---");

    {
      const mmd = [
        "![](https://cdn.mathpix.com/cropped/a.jpg?h=1)",
        "![](https://cdn.mathpix.com/cropped/b.png?h=2)",
        "![](https://cdn.mathpix.com/cropped/c.webp?h=3)",
        "![](https://cdn.mathpix.com/cropped/d?h=4)",
      ].join("\n");

      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(mmd);
      const dl = new MathPixImageDownloader();
      const result = await dl.downloadAll(reg, "ext-test");

      const filenames = Object.values(result.filenameMap).map(
        (e) => e.filename,
      );
      assert(
        "Extension: .jpg preserved",
        filenames.some((f) => f.endsWith(".jpg")),
      );
      assert(
        "Extension: .png preserved",
        filenames.some((f) => f.endsWith(".png")),
      );
      assert(
        "Extension: .webp preserved",
        filenames.some((f) => f.endsWith(".webp")),
      );
      assert(
        "Extension: no-ext defaults to .jpg",
        filenames[3]?.endsWith(".jpg"),
        `Got: ${filenames[3]}`,
      );
    }

    // ========================================================================
    // GROUP 14: TIMEOUT CONFIGURATION
    // ========================================================================
    console.log("\n--- 14. Timeout ---");

    {
      const dl = new MathPixImageDownloader({ timeoutMs: 1 }); // 1ms timeout
      const reg = new MathPixImageRegistry();
      reg.buildFromMMD(
        "![](https://cdn.mathpix.com/cropped/timeout-test.jpg?h=1)",
      );
      const result = await dl.downloadAll(reg, "timeout");

      assert("Timeout: completed without hanging", true);
      assert("Timeout: has result", result.total === 1);
      // Should fail (either CORS or timeout)
      assert("Timeout: failed", result.failed === 1);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log("\n" + "=".repeat(60));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`,
    );

    if (failed > 0) {
      console.log("Failed tests:");
      results
        .filter((r) => r.startsWith("❌"))
        .forEach((r) => console.log(`  ${r}`));
    }

    console.log("\n=== Image Downloader Test Suite Complete ===");

    return { passed, failed, total: passed + failed, results };
  };

  /**
   * Quick validation test for mmd.zip strategy.
   * Run after processing a PDF: window.testMmdZipDownload()
   */
  window.testMmdZipDownload = async function () {
    console.log("=== mmd.zip Download Strategy Test ===\n");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ Switch to MathPix mode first.");
      return;
    }

    // Get pdf_id
    const pdfId = controller.pdfProcessor?.currentPdfId;
    if (!pdfId) {
      console.error("❌ No pdf_id found. Process a PDF first.");
      return;
    }
    console.log(`pdf_id: ${pdfId}`);

    // Get credentials from API client (DOM inputs may contain OpenRouter key)
    const appId = controller.apiClient?.appId;
    const appKey = controller.apiClient?.apiKey;
    if (!appId || !appKey) {
      console.error("❌ API credentials not found on API client.");
      return;
    }
    console.log("Credentials: ✅");

    // Build registry from current MMD
    const mmdEl = document.querySelector("#mathpix-pdf-content-mmd");
    const mmdContent = mmdEl?.textContent || mmdEl?.innerText;
    if (!mmdContent || mmdContent.length < 50) {
      console.error("❌ No MMD content found.");
      return;
    }

    const registry = new MathPixImageRegistry();
    const count = registry.buildFromMMD(mmdContent);
    console.log(`Registry: ${count} images\n`);

    // Run download
    const downloader = new MathPixImageDownloader({
      onProgress: (done, total, stage) => {
        console.log(`  Progress: ${done}/${total} (${stage})`);
      },
    });

    const result = await downloader.downloadFromMmdZip(
      registry,
      pdfId,
      { appId, appKey },
      "test-document",
    );

    console.log("\n--- Result ---");
    console.log(`  Total:     ${result.total}`);
    console.log(`  Succeeded: ${result.succeeded}`);
    console.log(`  Failed:    ${result.failed}`);
    console.log(`  Time:      ${result.elapsedMs}ms`);
    console.log(`  All OK:    ${result.allSucceeded ? "✅" : "❌"}`);

    // Verify blobs in registry
    const allImages = registry.getAllImages();
    const withBlobs = allImages.filter((img) => img.status === "downloaded");
    console.log(
      `\n  Registry entries with blobs: ${withBlobs.length}/${allImages.length}`,
    );

    if (withBlobs.length > 0) {
      const first = withBlobs[0];
      console.log(`  First blob: ${first.fileSize} bytes, ${first.mimeType}`);
    }

    // Verify filenames
    const filenames = Object.values(result.filenameMap);
    console.log(`\n  Filename map (${filenames.length} entries):`);
    filenames.forEach((f) => {
      console.log(
        `    ${f.filename} — ${f.downloaded ? "✅" : "❌"} ${f.sourceZipPath || ""}`,
      );
    });

    console.log("\n=== Test Complete ===");
    return result;
  };

  logInfo("MathPixImageDownloader module loaded");
})();
