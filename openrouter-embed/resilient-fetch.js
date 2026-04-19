/**
 * Resilient Fetch Module
 *
 * Downloads large files from HuggingFace CDN in chunks using HTTP Range
 * requests, with per-chunk retry and exponential backoff. Discovers the
 * true file size from the first chunk's Content-Range header (HEAD is
 * unreliable on the Xet bridge CDN).
 *
 * Usage:
 *   const rf = ResilientFetch.create({ chunkSizeMB: 50 });
 *   const response = await rf('https://huggingface.co/.../model.onnx');
 *
 *   await ResilientFetch.testRangeSupport('HuggingFaceTB/SmolLM3-3B-ONNX');
 *
 * Diagnostics (call from browser console):
 *   ResilientFetch.printDiagnostics()   — formatted summary of all downloads
 *   ResilientFetch.getDiagnostics()     — raw diagnostic object
 *
 * @author Matthew Deeprose
 * @version 1.2.0
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // Logging configuration
  // ═══════════════════════════════════════════════════════════════════

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[ResilientFetch]', message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[ResilientFetch]', message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[ResilientFetch]', message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[ResilientFetch]', message, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════

  const HF_BASE = 'https://huggingface.co';
  const BYTES_PER_MB = 1024 * 1024;

  // ═══════════════════════════════════════════════════════════════════
  // Diagnostic tracker — queryable from console via ResilientFetch.getDiagnostics()
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // Global progress listeners (Stage 1 — progress API)
  // ═══════════════════════════════════════════════════════════════════

  const progressListeners = [];

  /**
   * Fire all registered progress listeners with a progress event.
   * Each listener is wrapped in try/catch so a faulty listener
   * cannot break the download.
   */
  function fireProgressListeners(event) {
    for (var j = 0; j < progressListeners.length; j++) {
      try {
        progressListeners[j](event);
      } catch (listenerErr) {
        logWarn('Progress listener threw:', listenerErr.message || listenerErr);
      }
    }
  }

  const diagnostics = {
    totalIntercepted: 0,
    totalPassthrough: 0,
    activeDownloads: {},   // keyed by URL — tracks in-progress downloads
    completedDownloads: [], // finished downloads (pass or fail)
    errors: [],            // all errors with timestamps
  };

  function trackStart(url, totalSize) {
    diagnostics.totalIntercepted++;
    const filename = filenameFromUrl(url);
    diagnostics.activeDownloads[filename] = {
      url: url,
      filename: filename,
      totalSize: totalSize,
      totalSizeMB: totalSize ? toMB(totalSize) : '?',
      chunksCompleted: 0,
      chunksTotal: totalSize ? Math.ceil(totalSize / (50 * BYTES_PER_MB)) : '?',
      bytesDownloaded: 0,
      retries: 0,
      startTime: performance.now(),
      lastChunkTime: performance.now(),
      status: 'downloading',
    };
    return filename;
  }

  function trackChunk(filename, chunkNum, chunkBytes) {
    const d = diagnostics.activeDownloads[filename];
    if (!d) return;
    d.chunksCompleted = chunkNum;
    d.bytesDownloaded += chunkBytes;
    d.lastChunkTime = performance.now();
  }

  function trackRetry(filename, chunkNum, attempt, error) {
    const d = diagnostics.activeDownloads[filename];
    if (d) d.retries++;
    diagnostics.errors.push({
      time: new Date().toISOString(),
      filename: filename,
      chunk: chunkNum,
      attempt: attempt,
      error: error,
    });
  }

  function trackComplete(filename, status, error) {
    const d = diagnostics.activeDownloads[filename];
    if (d) {
      d.status = status;
      d.elapsedSec = ((performance.now() - d.startTime) / 1000).toFixed(1);
      if (error) d.error = error;
      diagnostics.completedDownloads.push(Object.assign({}, d));
      delete diagnostics.activeDownloads[filename];
    }
  }

  function trackPassthrough(url) {
    diagnostics.totalPassthrough++;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Extract filename from a URL for log messages.
   */
  function filenameFromUrl(url) {
    try {
      return new URL(url).pathname.split('/').pop() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Parse the total file size from a Content-Range header.
   * Format: bytes 0-52428799/1876543210
   * Returns the total size (number after /) or null if unparseable.
   */
  function parseTotalSize(contentRange) {
    if (!contentRange) return null;
    const match = contentRange.match(/\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Format bytes as a human-readable MB string.
   */
  function toMB(bytes) {
    return (bytes / BYTES_PER_MB).toFixed(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Core: resilientFetch
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fetch a single chunk with retry and exponential backoff.
   */
  async function fetchChunkWithRetry(url, start, end, signal, maxRetries, retryBaseDelayMs, delegateFetch) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal && signal.aborted) {
        throw new DOMException('Download aborted by user', 'AbortError');
      }

      try {
        const fetchOptions = {
          headers: { 'Range': 'bytes=' + start + '-' + end }
        };
        if (signal) fetchOptions.signal = signal;

        const response = await delegateFetch(url, fetchOptions);

        if (response.status === 206) {
          return response;
        }

        // Unexpected status — treat as failure
        throw new Error('Expected 206 but received ' + response.status);
      } catch (err) {
        // Don't retry abort errors
        if (err.name === 'AbortError') throw err;

        if (attempt < maxRetries) {
          const delay = retryBaseDelayMs * Math.pow(2, attempt);
          logWarn('Chunk bytes=' + start + '-' + end + ' failed (attempt ' + (attempt + 1) + '/' + (maxRetries + 1) + '): ' + err.message + ' — retrying in ' + delay + 'ms');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error('Chunk bytes=' + start + '-' + end + ' failed after ' + (maxRetries + 1) + ' attempts: ' + err.message);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Factory: create(options)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a fetch-compatible function that uses Range requests for
   * large HuggingFace downloads.
   *
   * @param {Object} options
   * @returns {function(string, Object=): Promise<Response>}
   */
  function create(options) {
    const opts = Object.assign({
      originalFetch: globalThis.fetch.bind(globalThis),
      sizeThresholdMB: 100,
      chunkSizeMB: 50,
      maxRetries: 5,
      retryBaseDelayMs: 2000,
      onChunkComplete: null
    }, options || {});

    const chunkSize = opts.chunkSizeMB * BYTES_PER_MB;
    const sizeThreshold = opts.sizeThresholdMB * BYTES_PER_MB;

    /**
     * Fetch-compatible function with resilient chunked download.
     */
    return async function resilientFetch(url, fetchOptions) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const signal = (fetchOptions && fetchOptions.signal) || null;

      // Step 1: URL filter — only intercept HuggingFace URLs
      if (!urlStr.includes('huggingface.co')) {
        trackPassthrough(urlStr);
        logDebug('Passthrough (non-HF): ' + filenameFromUrl(urlStr));
        return opts.originalFetch(url, fetchOptions);
      }

      logInfo('Intercepted HF fetch: ' + filenameFromUrl(urlStr) + ' (' + urlStr.substring(0, 120) + ')');

      const filename = filenameFromUrl(urlStr);
      const downloadStart = performance.now();

      // Step 2: First chunk fetch (with retry — the initial probe is just as vulnerable to network drops)
      let firstResponse;
      for (let firstAttempt = 0; firstAttempt <= opts.maxRetries; firstAttempt++) {
        try {
          const firstFetchOptions = {
            headers: { 'Range': 'bytes=0-' + (chunkSize - 1) }
          };
          if (signal) firstFetchOptions.signal = signal;

          logDebug('First chunk fetch attempt ' + (firstAttempt + 1) + ' for ' + filename);
          firstResponse = await opts.originalFetch(urlStr, firstFetchOptions);
          break; // success
        } catch (firstErr) {
          if (firstErr.name === 'AbortError') throw firstErr;
          logError('First chunk fetch failed for ' + filename + ' (attempt ' + (firstAttempt + 1) + '/' + (opts.maxRetries + 1) + '): ' + firstErr.message);
          diagnostics.errors.push({
            time: new Date().toISOString(),
            filename: filename,
            chunk: 'first-probe',
            attempt: firstAttempt + 1,
            error: firstErr.message,
          });
          if (firstAttempt < opts.maxRetries) {
            const delay = opts.retryBaseDelayMs * Math.pow(2, firstAttempt);
            logWarn('Retrying first chunk in ' + delay + 'ms...');
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            const msg = 'First chunk fetch for ' + filename + ' failed after ' + (opts.maxRetries + 1) + ' attempts: ' + firstErr.message;
            logError(msg);
            trackComplete(filename, 'FAILED', msg);
            throw new Error(msg);
          }
        }
      }

      // Step 3: If 200, server ignored Range — passthrough
      if (firstResponse.status === 200) {
        logWarn('Passthrough (server ignored Range, returned 200): ' + filename + ' — this file will download via plain fetch without retry protection');
        trackPassthrough(urlStr);
        return firstResponse;
      }

      // Step 4: Parse Content-Range for true total size
      if (firstResponse.status !== 206) {
        logWarn('Unexpected status ' + firstResponse.status + ' for Range request on ' + filename + ' — returning as-is');
        return firstResponse;
      }

      const contentRange = firstResponse.headers.get('Content-Range');
      const totalSize = parseTotalSize(contentRange);

      if (totalSize === null) {
        logWarn('Content-Range missing or unparseable for ' + filename + ' — returning first chunk response as-is');
        return firstResponse;
      }

      const contentType = firstResponse.headers.get('Content-Type');
      logInfo('File: ' + filename + ' — total size: ' + toMB(totalSize) + 'MB, Content-Type: ' + (contentType || 'unknown'));

      let firstBuffer;
      try {
        firstBuffer = await firstResponse.arrayBuffer();
        logDebug('First chunk body read OK: ' + toMB(firstBuffer.byteLength) + 'MB');
      } catch (bodyErr) {
        const msg = 'Failed to read first chunk body for ' + filename + ': ' + bodyErr.message;
        logError(msg);
        diagnostics.errors.push({ time: new Date().toISOString(), filename: filename, chunk: 'first-body-read', error: bodyErr.message });
        throw new Error(msg);
      }
      let totalRetries = 0;

      // Step 5: Small file — fetch remainder in one go
      if (totalSize < sizeThreshold) {
        logInfo('Small file (' + toMB(totalSize) + 'MB), fetching remainder');

        if (firstBuffer.byteLength >= totalSize) {
          // First chunk covers entire file
          const blob = new Blob([firstBuffer], { type: contentType || 'application/octet-stream' });
          return new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Length': String(totalSize),
              'Content-Type': contentType || 'application/octet-stream'
            }
          });
        }

        const remainderOptions = {
          headers: { 'Range': 'bytes=' + chunkSize + '-' + (totalSize - 1) }
        };
        if (signal) remainderOptions.signal = signal;

        const remainderResponse = await opts.originalFetch(urlStr, remainderOptions);
        const remainderBuffer = await remainderResponse.arrayBuffer();

        const blob = new Blob([firstBuffer, remainderBuffer], { type: contentType || 'application/octet-stream' });
        return new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Length': String(totalSize),
            'Content-Type': contentType || 'application/octet-stream'
          }
        });
      }

      // Step 6: Large file — chunked download
      const totalChunks = Math.ceil(totalSize / chunkSize);
      logInfo('Resilient download: ' + filename + ' (' + toMB(totalSize) + 'MB in ' + totalChunks + ' chunks of ' + opts.chunkSizeMB + 'MB)');

      const trackId = trackStart(urlStr, totalSize);
      // Update chunk count now we know the real total
      if (diagnostics.activeDownloads[trackId]) {
        diagnostics.activeDownloads[trackId].chunksTotal = totalChunks;
      }

      const arrayBuffers = [firstBuffer];
      let bytesDownloaded = firstBuffer.byteLength;
      trackChunk(trackId, 1, firstBuffer.byteLength);

      if (opts.onChunkComplete) {
        opts.onChunkComplete(1, totalChunks, bytesDownloaded, totalSize);
      }
      fireProgressListeners({
        filename: filename,
        url: urlStr,
        loaded: bytesDownloaded,
        total: totalSize,
        chunks: { current: 1, total: totalChunks }
      });

      for (let i = 2; i <= totalChunks; i++) {
        if (signal && signal.aborted) {
          throw new DOMException('Download aborted by user', 'AbortError');
        }

        const start = (i - 1) * chunkSize;
        const end = Math.min(i * chunkSize - 1, totalSize - 1);
        const chunkStart = performance.now();

        const retriesBefore = totalRetries;
        let response;

        // Fetch chunk with retry
        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
          if (signal && signal.aborted) {
            throw new DOMException('Download aborted by user', 'AbortError');
          }

          try {
            const chunkFetchOptions = {
              headers: { 'Range': 'bytes=' + start + '-' + end }
            };
            if (signal) chunkFetchOptions.signal = signal;

            response = await opts.originalFetch(urlStr, chunkFetchOptions);

            if (response.status === 206) break;
            throw new Error('Expected 206 but received ' + response.status);
          } catch (err) {
            if (err.name === 'AbortError') throw err;

            if (attempt < opts.maxRetries) {
              totalRetries++;
              const delay = opts.retryBaseDelayMs * Math.pow(2, attempt);
              logWarn('Chunk ' + i + '/' + totalChunks + ' failed (attempt ' + (attempt + 1) + '/' + (opts.maxRetries + 1) + '): ' + err.message + ' — retrying in ' + delay + 'ms');
              trackRetry(trackId, i, attempt + 1, err.message);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              const finalErr = 'Chunk ' + i + '/' + totalChunks + ' (bytes=' + start + '-' + end + ') failed after ' + (opts.maxRetries + 1) + ' attempts: ' + err.message;
              logError(finalErr);
              trackRetry(trackId, i, attempt + 1, err.message);
              trackComplete(trackId, 'FAILED', finalErr);
              throw new Error(finalErr);
            }
          }
        }

        let buffer;
        try {
          buffer = await response.arrayBuffer();
        } catch (bodyErr) {
          const msg = 'Chunk ' + i + '/' + totalChunks + ' body read failed for ' + filename + ': ' + bodyErr.message;
          logError(msg);
          trackRetry(trackId, i, 'body-read', bodyErr.message);
          trackComplete(trackId, 'FAILED', msg);
          throw new Error(msg);
        }
        arrayBuffers.push(buffer);
        bytesDownloaded += buffer.byteLength;

        const chunkTime = ((performance.now() - chunkStart) / 1000).toFixed(1);
        const speedMBps = (buffer.byteLength / BYTES_PER_MB / (parseFloat(chunkTime) || 1)).toFixed(1);
        logInfo('Chunk ' + i + '/' + totalChunks + ': bytes ' + start + '-' + end + ' — 206 OK (' + toMB(buffer.byteLength) + 'MB, ' + chunkTime + 's, ' + speedMBps + ' MB/s)');
        trackChunk(trackId, i, buffer.byteLength);

        if (opts.onChunkComplete) {
          opts.onChunkComplete(i, totalChunks, bytesDownloaded, totalSize);
        }
        fireProgressListeners({
          filename: filename,
          url: urlStr,
          loaded: bytesDownloaded,
          total: totalSize,
          chunks: { current: i, total: totalChunks }
        });
      }

      // Step 7: Assembly
      const blob = new Blob(arrayBuffers, { type: contentType || 'application/octet-stream' });
      const totalTime = ((performance.now() - downloadStart) / 1000).toFixed(1);

      // Step 8: Final log
      const speedTotal = (totalSize / BYTES_PER_MB / (parseFloat(totalTime) || 1)).toFixed(1);
      logInfo('Download complete: ' + filename + ' (' + toMB(totalSize) + 'MB, ' + totalChunks + ' chunks, ' + totalRetries + ' retries, ' + totalTime + 's total, ' + speedTotal + ' MB/s avg)');
      trackComplete(trackId, 'OK');

      return new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Length': String(totalSize),
          'Content-Type': contentType || 'application/octet-stream'
        }
      });
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Probe: testRangeSupport(modelId)
  // ═══════════════════════════════════════════════════════════════════

  // Xet pointer files are typically tiny manifests (<1MB) that reference
  // content-addressable chunks. If Content-Range reports a file this small
  // for a model expected to be hundreds of MB, it is likely a Xet pointer,
  // not the real ONNX weights.
  const XET_POINTER_THRESHOLD = 1 * BYTES_PER_MB;

  /**
   * Probe whether Range requests work for a model's ONNX file and
   * discover the TRUE file size from Content-Range.
   *
   * @param {string} modelId  e.g. 'onnx-community/Qwen2.5-0.5B-Instruct'
   * @param {string} [onnxPath='onnx/model_q4.onnx']  Path within the repo
   * @returns {Promise<Object>}
   */
  async function testRangeSupport(modelId, onnxPath) {
    const filePath = onnxPath || 'onnx/model_q4.onnx';
    const url = HF_BASE + '/' + modelId + '/resolve/main/' + filePath;
    logInfo('Testing Range support for: ' + url);

    const result = {
      supported: false,
      totalSize: null,
      totalSizeMB: null,
      rangeStatus: null,
      receivedBytes: null,
      xetPointerSuspected: false,
      error: null
    };

    try {
      const response = await fetch(url, {
        headers: { 'Range': 'bytes=0-1023' }
      });

      result.rangeStatus = response.status;

      if (response.status === 200) {
        result.supported = false;
        const buffer = await response.arrayBuffer();
        result.receivedBytes = buffer.byteLength;
        logWarn('Range NOT supported — server returned 200 (received ' + result.receivedBytes + ' bytes)');
      } else if (response.status === 206) {
        result.supported = true;
        const contentRange = response.headers.get('Content-Range');
        result.totalSize = parseTotalSize(contentRange);
        result.totalSizeMB = result.totalSize !== null ? toMB(result.totalSize) : null;

        const buffer = await response.arrayBuffer();
        result.receivedBytes = buffer.byteLength;

        logInfo('Range supported — 206 Partial Content');
        logInfo('Content-Range: ' + (contentRange || '(missing)'));
        logInfo('Reported file size: ' + (result.totalSize !== null ? result.totalSizeMB + 'MB (' + result.totalSize + ' bytes)' : 'unknown'));
        logInfo('Received bytes: ' + result.receivedBytes);

        // Warn if size looks like a Xet pointer/manifest
        if (result.totalSize !== null && result.totalSize < XET_POINTER_THRESHOLD) {
          result.xetPointerSuspected = true;
          logWarn('Size is suspiciously small (<1MB) — this may be a Xet pointer file, not the real ONNX weights');
        } else {
          result.xetPointerSuspected = false;
        }
      } else {
        result.error = 'Unexpected status: ' + response.status;
        logError(result.error);
      }
    } catch (err) {
      result.error = err.message;
      logError('Probe failed: ' + err.message);
    }

    logInfo('Probe result:', result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════

  window.ResilientFetch = {
    create,
    testRangeSupport,
    /**
     * Subscribe to global download progress events.
     * Listener receives: { filename, url, loaded, total, chunks: { current, total } }
     */
    onProgress: function (callback) {
      if (typeof callback === 'function') progressListeners.push(callback);
    },
    /**
     * Unsubscribe a previously registered progress listener.
     */
    offProgress: function (callback) {
      var idx = progressListeners.indexOf(callback);
      if (idx >= 0) progressListeners.splice(idx, 1);
    },
    /**
     * Get diagnostic data for all downloads. Call from console:
     *   ResilientFetch.getDiagnostics()        — full object
     *   ResilientFetch.printDiagnostics()       — formatted console.table
     */
    getDiagnostics: function () { return diagnostics; },
    printDiagnostics: function () {
      console.log('=== ResilientFetch Diagnostics ===');
      console.log('Intercepted: ' + diagnostics.totalIntercepted + ' | Passthrough: ' + diagnostics.totalPassthrough);

      if (Object.keys(diagnostics.activeDownloads).length > 0) {
        console.log('\n--- Active Downloads ---');
        const active = {};
        for (var key in diagnostics.activeDownloads) {
          var d = diagnostics.activeDownloads[key];
          active[key] = {
            'Size (MB)': d.totalSizeMB,
            'Chunks': d.chunksCompleted + '/' + d.chunksTotal,
            'Downloaded (MB)': toMB(d.bytesDownloaded),
            'Retries': d.retries,
            'Elapsed (s)': ((performance.now() - d.startTime) / 1000).toFixed(1),
            'Since last chunk (s)': ((performance.now() - d.lastChunkTime) / 1000).toFixed(1),
          };
        }
        console.table(active);
      }

      if (diagnostics.completedDownloads.length > 0) {
        console.log('\n--- Completed Downloads ---');
        var completed = {};
        diagnostics.completedDownloads.forEach(function (d) {
          completed[d.filename] = {
            'Status': d.status,
            'Size (MB)': d.totalSizeMB,
            'Chunks': d.chunksCompleted + '/' + d.chunksTotal,
            'Retries': d.retries,
            'Time (s)': d.elapsedSec,
            'Error': d.error ? d.error.substring(0, 60) : '',
          };
        });
        console.table(completed);
      }

      if (diagnostics.errors.length > 0) {
        console.log('\n--- Errors (' + diagnostics.errors.length + ') ---');
        console.table(diagnostics.errors);
      }

      if (diagnostics.totalIntercepted === 0 && diagnostics.totalPassthrough === 0) {
        console.log('No downloads recorded yet. Is resilient-fetch wired into env.fetch?');
      }

      return diagnostics;
    },
  };

  logInfo('Module loaded');
})();
