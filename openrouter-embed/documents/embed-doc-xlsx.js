/**
 * OpenRouter Embed API - Excel format module
 *
 * Registers window.EmbedDocumentFormats.xlsx for openrouter-embed-documents.js.
 * Reads each sheet with SheetJS and turns it into CSV (each formula's cached
 * value, which is what a person sees). Hidden and very hidden sheets are
 * included and labelled "(hidden)". Cell comments are never read.
 *
 * Privacy: document content is never logged (sizes and counts only), and
 * comments, document properties and file paths are never read into the text.
 *
 * Library (vendored, same origin, never fetched from a CDN):
 *   SheetJS Community Edition 0.20.3, MINI build
 *   source   %LOCALAPPDATA%\claude-a11y-sr\sheetjs-0.20.3\package\dist\xlsx.mini.min.js
 *   tarball  xlsx-0.20.3.tgz  SHA-256 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8
 *   file     vendor/xlsx-0.20.3.mini.min.js  279,523 bytes
 *            SHA-256 0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939
 *   licence  vendor/LICENSE-sheetjs.txt (Apache-2.0, from the package's LICENSE)
 *            SHA-256 4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64
 *
 * Parcel P2-xlsx: adopted nowhere beyond Chat's existing routing of an .xlsx
 * to the reader.
 *
 * @version 1.0.0 (P2-xlsx)
 * @date 23 October 2026
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
      console.error(`[EmbedDocXlsx ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocXlsx WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocXlsx INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocXlsx DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const DOC_TYPE = "xlsx";
  const ERROR_UNREADABLE = "unreadable";
  const ERROR_TOO_LARGE = "too-large";
  const NUMBER_LOCALE = "en-GB";

  // Same host and file tools.html already loads (tools.html:21502). No new host.
  const JSZIP_URL = "https://matthewdeeprose.github.io/scripts/jszip.min.js";
  const SHEETJS_PATH = "../vendor/xlsx-0.20.3.mini.min.js";

  // SheetJS Workbook.Sheets[i].Hidden: 0 visible, 1 hidden, 2 very hidden.
  const HIDDEN_STATES = Object.freeze([1, 2]);

  const HEADER_PREFIX = "Sheet: ";
  const HIDDEN_SUFFIX = " (hidden)";
  const BLOCK_SEPARATOR = "\n\n";

  // Captured at load. document.currentScript is null once the script has run,
  // so this must be read here and not inside a function called later.
  const SCRIPT_BASE = (function () {
    const current = document.currentScript;
    if (current && current.src) return current.src;
    logWarn("document.currentScript unavailable; falling back to the page base");
    return new URL("openrouter-embed/documents/embed-doc-xlsx.js", document.baseURI)
      .href;
  })();

  // ============================================================================
  // HELPERS
  // ============================================================================

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    error.docType = DOC_TYPE;
    return error;
  }

  async function ensureSheetjs(ctx) {
    if (!window.XLSX) {
      try {
        await ctx.loadScript(new URL(SHEETJS_PATH, SCRIPT_BASE).href);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.XLSX) throw fail(ERROR_UNREADABLE);
    return window.XLSX;
  }

  async function ensureJszip(ctx) {
    if (!window.JSZip) {
      try {
        await ctx.loadScript(JSZIP_URL);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.JSZip) throw fail(ERROR_UNREADABLE);
    return window.JSZip;
  }

  /**
   * Adds up the sizes the zip's entries CLAIM to have when inflated, without
   * inflating any of them. JSZip keeps each entry's central-directory size on
   * its private _data. A file that is not a zip (including an encrypted
   * workbook, which is an OLE container) cannot be opened and is unreadable.
   */
  async function declaredUncompressedBytes(data, ctx) {
    const JSZip = await ensureJszip(ctx);
    let zip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch (error) {
      throw fail(ERROR_UNREADABLE);
    }

    let total = 0;
    for (const name of Object.keys(zip.files)) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      const size = entry._data && entry._data.uncompressedSize;
      // Fail closed: a size we cannot read is a size we cannot cap.
      if (typeof size !== "number" || !isFinite(size)) throw fail(ERROR_UNREADABLE);
      total += size;
    }
    return total;
  }

  function isHiddenSheet(workbook, index) {
    const flags = (workbook.Workbook && workbook.Workbook.Sheets) || [];
    const flag = flags[index];
    return !!flag && HIDDEN_STATES.includes(flag.Hidden);
  }

  /**
   * CSV for one sheet, cut to maxRows rows of the sheet's own range.
   * @returns {{csv: string, rows: number, cut: boolean}}
   */
  function sheetToCsv(XLSX, sheet, maxRows) {
    const ref = sheet["!ref"];
    if (!ref) return { csv: "", rows: 0, cut: false };

    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    if (rows <= maxRows) return { csv: csvOf(XLSX, sheet), rows, cut: false };

    // A shallow copy with a shorter range, so no row past the cap is rendered.
    const capped = Object.assign({}, sheet, {
      "!ref": XLSX.utils.encode_range({
        s: range.s,
        e: { r: range.s.r + maxRows - 1, c: range.e.c },
      }),
    });
    return { csv: csvOf(XLSX, capped), rows, cut: true };
  }

  /** Each formula's cached value, as a person sees it. Comments live on .c and never reach this. */
  function csvOf(XLSX, sheet) {
    return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  }

  // ============================================================================
  // FORMAT MODULE
  // ============================================================================

  async function read(file, ctx) {
    let data;
    try {
      data = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      ctx.log("Workbook could not be read", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    // The size cap comes first: SheetJS must never see an over-large archive.
    const declared = await declaredUncompressedBytes(data, ctx);
    if (declared > ctx.caps.MAX_ZIP_UNCOMPRESSED_BYTES) {
      ctx.log("Workbook too large", { bytes: file.size, declaredBytes: declared });
      throw fail(ERROR_TOO_LARGE);
    }

    const XLSX = await ensureSheetjs(ctx);

    let workbook;
    try {
      workbook = XLSX.read(data, { type: "array" });
    } catch (error) {
      // Never log error.message: it can name content.
      ctx.log("Workbook could not be opened", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    try {
      const maxRows = ctx.caps.MAX_SHEET_ROWS;
      const blocks = [];
      let hiddenCount = 0;
      let cutSheets = 0;

      workbook.SheetNames.forEach((name, index) => {
        const hidden = isHiddenSheet(workbook, index);
        if (hidden) hiddenCount++;

        const { csv, rows, cut } = sheetToCsv(XLSX, workbook.Sheets[name], maxRows);
        const header = HEADER_PREFIX + name + (hidden ? HIDDEN_SUFFIX : "");
        let block = `${header}\n${csv}`;
        if (cut) {
          cutSheets++;
          const keptLabel = maxRows.toLocaleString(NUMBER_LOCALE);
          const totalLabel = rows.toLocaleString(NUMBER_LOCALE);
          block += `\n[Sheet cut short: the first ${keptLabel} rows of ${totalLabel} are included.]`;
        }
        blocks.push(block);
      });

      const sheets = workbook.SheetNames.length;
      ctx.log("Workbook read", { bytes: file.size, sheets, hiddenCount, cutSheets });

      return {
        text: blocks.join(BLOCK_SEPARATOR),
        images: [],
        meta: { sheets, hiddenCount, cutSheets },
      };
    } catch (error) {
      if (error && error.code) throw error;
      ctx.log("Workbook sheet read failed", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
  window.EmbedDocumentFormats[DOC_TYPE] = { read };

  logInfo("Excel format module loaded");
})();
