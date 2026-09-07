/**
 * @fileoverview Ally Accessibility Reporting Tool - Ally CSV export parser
 * @module AllyCsvParser
 *
 * @description
 * Reads an Ally CSV export - courses.csv, terms.csv and departments_years.csv
 * - into the compact shapes ALLY_DATA_RUNTIME installs. Lifted out of
 * ally-scripts/core/convert-ally-csv.html at multi-tenancy Stage 4 so that the
 * converter page and the application parse an export with ONE implementation.
 * Two copies of a parser is exactly the drift Stage 2a spent a stage closing.
 *
 * Nothing here touches the DOM. The converter keeps the code generation and
 * its UI; the application (ally-tenant-data.js) keeps the storage. Both call
 * into this file.
 *
 * Lifted verbatim, with ONE fix: takeRecords now returns the quote state at
 * the start of the remainder rather than the end of the buffer. See the
 * comment on its return value for the measurement.
 *
 * WHICH SIDE IS CANONICAL: the Node builder at
 * .claude/ally-course-data/build.mjs carries its own copy of these functions
 * for the command line, and it is canonical. The drift check between the two
 * is a byte diff of the builder's output against the converter's on the same
 * input (.claude/ally-course-data/README.md), plus the rows in prove-build.mjs
 * that run THIS file against the fixture and compare the rehydrated maps.
 *
 * Load order: standalone. It reads no other global. The converter loads it
 * with a relative <script src="ally-csv-parser.js">; tools.html loads it
 * beside the other Ally scripts.
 */

const ALLY_CSV_PARSER = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AllyCsvParser] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AllyCsvParser] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AllyCsvParser] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AllyCsvParser] " + message, ...args);
  }

  // ========================================================================
  // Tuning
  // ========================================================================

  /** Decoded bytes between progress updates during the streaming parse. */
  const PROGRESS_INTERVAL_BYTES = 2 * 1024 * 1024;

  /** Text chunk size for the non-streaming fallback path. */
  const FALLBACK_CHUNK_CHARS = 1024 * 1024;

  /**
   * Milliseconds of work between yields during the parse.
   *
   * This exists because `await reader.read()` is NOT a yield: when the data
   * is already buffered the promise resolves as a microtask, which runs in
   * the same task and never lets the browser paint. Measured before this
   * was added, the whole parse ran as a single 1,673ms task.
   */
  const YIELD_INTERVAL_MS = 50;

  // ========================================================================
  // CSV Parsing
  // ========================================================================

  /**
   * Parses a CSV string into an array of objects
   * @param {string} csvText - Raw CSV content
   * @returns {Array<Object>} Array of row objects
   */
  function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parses a single CSV line, handling quoted values
   * @param {string} line - CSV line
   * @returns {Array<string>} Array of values
   */
  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  }

  /**
   * Reads a file as text
   * @param {File} file - File object
   * @returns {Promise<string>} File content
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
      reader.readAsText(file);
    });
  }

  // ========================================================================
  // Streaming CSV (for files too large to hold twice in memory)
  // ========================================================================

  /**
   * Column aliases accepted for each field the courses output needs.
   * Order matters - it reproduces the fallback precedence the previous
   * row-object lookup used (row['Course id'] || row['course_id'] || ...).
   */
  const COURSE_COLUMN_ALIASES = Object.freeze({
    courseId: ['Course id', 'course_id', 'CourseId'],
    courseCode: ['Course code', 'course_code', 'CourseCode'],
    courseName: ['Course name', 'course_name', 'CourseName'],
    termId: ['Term id', 'term_id', 'TermId'],
    overallScore: ['Overall score', 'overall_score', 'OverallScore']
  });

  /**
   * Marks a course as archived.
   *
   * Deliberately NOT anchored to the end and NOT case-sensitive: measured
   * against a real 143,468-row export, 4 courses carry the marker in
   * another position or another case, and an anchored test would keep them.
   */
  const ARCHIVED_NAME_PATTERN = /\[archived\]/i;

  /**
   * Resolves the wanted fields to column indexes, once, from the header row.
   *
   * This is the change that removes most of the memory cost: the previous
   * parseCSV built one object per row carrying a key for EVERY column (71 in
   * a real Ally export) and processCourses then kept five of them.
   *
   * @param {Array<string>} headerValues - Parsed header cells
   * @param {Object} aliases - Field name to candidate header names
   * @returns {Object} Field name to column index, -1 where absent
   */
  function resolveColumnIndexes(headerValues, aliases) {
    const headers = headerValues.map(function(value) { return value.trim(); });
    const indexes = {};

    Object.keys(aliases).forEach(function(field) {
      let found = -1;

      aliases[field].some(function(name) {
        const at = headers.indexOf(name);
        if (at === -1) return false;
        found = at;
        return true;
      });

      indexes[field] = found;
    });

    return indexes;
  }

  /**
   * Reads one cell, matching the previous behaviour where a missing or
   * empty value became an empty string and everything else was trimmed.
   * @param {Array<string>} values - Parsed row values
   * @param {number} index - Column index, or -1 when the column is absent
   * @returns {string} Cell value
   */
  function readCell(values, index) {
    if (index < 0) return '';
    const value = values[index];
    return value ? value.trim() : '';
  }

  /**
   * Splits complete records out of a buffer, tracking quote state so a
   * record straddling two read chunks is not torn in half. Tracking quotes
   * is what a chunked reader needs to be correct at all; it also means a
   * newline inside a quoted field no longer splits a record, which the
   * previous whole-file line split got wrong.
   *
   * @param {string} buffer - Accumulated text
   * @param {boolean} inQuotes - Whether the buffer opens inside a quoted field
   * @returns {{records: Array<string>, remainder: string, inQuotes: boolean}}
   */
  function takeRecords(buffer, inQuotes) {
    const records = [];
    let start = 0;
    let quoted = inQuotes;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      // A doubled quote toggles twice and so lands back in the same state,
      // which is exactly the escape behaviour parseCSVLine expects.
      if (char === '"') {
        quoted = !quoted;
        continue;
      }

      if (quoted || char !== '\n') continue;

      let end = i;
      if (end > start && buffer[end - 1] === '\r') end--;
      records.push(buffer.slice(start, end));
      start = i + 1;
    }

    return {
      records: records,
      remainder: buffer.slice(start),
      // The quote state at the START of the remainder - which is what the
      // caller needs, because it prepends the remainder to the next chunk and
      // rescans it. A record boundary is only taken outside quotes, so after
      // any record the remainder starts unquoted; with no record taken the
      // remainder is the whole buffer and starts where the buffer started.
      //
      // FIXED AT STAGE 4. The converter returned the state at the END of the
      // buffer, so the remainder's own quotes were counted twice: a chunk
      // boundary inside a quoted field inverted the state for every byte
      // after it and the rest of the file was silently read as one record.
      // Measured 5 September 2026 in Node with a boundary forced inside a
      // quoted field: ZERO rows out, and the header-row refusal thrown. The
      // Stage 2a byte-diff on the real export passed because no chunk
      // boundary happened to land inside a quoted field; the fault is in
      // the chunking, not the data, so that pass was luck.
      inQuotes: records.length === 0 ? inQuotes : false
    };
  }

  /**
   * Yields decoded text chunks from a File. Prefers the streaming API, so
   * the whole file is never resident as one string; falls back to a single
   * read walked in slices with a yield between each.
   * @param {File} file - File to read
   * @returns {AsyncGenerator<{text: string, bytes: number}>}
   */
  async function* readTextChunks(file) {
    if (typeof file.stream === 'function') {
      const decoder = new TextDecoder('utf-8');
      const reader = file.stream().getReader();

      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        yield {
          text: decoder.decode(step.value, { stream: true }),
          bytes: step.value.byteLength
        };
      }

      const tail = decoder.decode();
      if (tail) yield { text: tail, bytes: 0 };
      return;
    }

    // Fallback: progress is measured in characters rather than bytes here,
    // so the percentage is approximate for non-ASCII content.
    const text = await readFileAsText(file);

    for (let at = 0; at < text.length; at += FALLBACK_CHUNK_CHARS) {
      const slice = text.slice(at, at + FALLBACK_CHUNK_CHARS);
      yield { text: slice, bytes: slice.length };
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    }
  }

  /**
   * Reads a courses CSV and builds both output maps in a single streaming
   * pass, handing the main thread back between chunks so the page stays
   * responsive and the status panel can actually paint.
   *
   * Rows are kept in a compact
   * `[courseId, courseCode, courseName, termIndex, scorePerMille]` form
   * with term ids interned, because that is the shape emitted. The
   * generated module rebuilds the object map consumers expect at load.
   *
   * @param {File} file - The courses CSV
   * @param {Function} onProgress - Called with (bytesRead, totalBytes, rowCount)
   * @param {Object} options - { excludeArchived: boolean }
   * @returns {Promise<{byId: Object, termIds: Array<string>, rowCount: number, archivedSkipped: number}>}
   */
  async function streamCourses(file, onProgress, options) {
    const excludeArchived = !!(options && options.excludeArchived);

    // Keyed by course id so a repeated id overwrites, exactly as the
    // previous object-keyed build did. Values are the compact row arrays.
    const byId = {};
    const termIds = [];
    const termIndex = {};

    let archivedSkipped = 0;
    let columns = null;
    let buffer = '';
    let inQuotes = false;
    let bytesRead = 0;
    let rowCount = 0;
    let lastReported = 0;
    let lastYield = performance.now();

    function consume(records) {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (!record.trim()) continue;

        if (!columns) {
          columns = resolveColumnIndexes(parseCSVLine(record), COURSE_COLUMN_ALIASES);
          continue;
        }

        const values = parseCSVLine(record);
        const courseId = readCell(values, columns.courseId);
        const courseCode = readCell(values, columns.courseCode);
        rowCount++;

        if (!courseId || !courseCode) continue;

        const courseName = readCell(values, columns.courseName);

        // Filtered here rather than after the parse, so excluded courses
        // never occupy memory at all.
        if (excludeArchived && ARCHIVED_NAME_PATTERN.test(courseName)) {
          archivedSkipped++;
          continue;
        }

        const termId = readCell(values, columns.termId);
        if (!(termId in termIndex)) {
          termIndex[termId] = termIds.length;
          termIds.push(termId);
        }

        // Score as an integer per mille, or null when the course has no
        // scanned files. NULL IS NOT ZERO: 36% of live courses have no
        // score, and showing them as 0% would brand them the worst
        // content in the institution. One more readCell from an index
        // resolved once from the header - no per-row object is rebuilt.
        const rawScore = readCell(values, columns.overallScore);
        const score = rawScore === '' ? null : Math.round(Number(rawScore) * 1000);

        byId[courseId] = [
          courseId,
          courseCode,
          courseName,
          termIndex[termId],
          Number.isFinite(score) ? score : null
        ];
      }
    }

    for await (const chunk of readTextChunks(file)) {
      bytesRead += chunk.bytes;
      buffer += chunk.text;

      const taken = takeRecords(buffer, inQuotes);
      buffer = taken.remainder;
      inQuotes = taken.inQuotes;
      consume(taken.records);

      if (bytesRead - lastReported >= PROGRESS_INTERVAL_BYTES) {
        lastReported = bytesRead;
        onProgress(bytesRead, file.size, rowCount);
      }

      // See YIELD_INTERVAL_MS: a timer is what actually hands the main
      // thread back, so the progress readout can paint and the page stays
      // responsive to input while a large file is read.
      if (performance.now() - lastYield < YIELD_INTERVAL_MS) continue;
      lastYield = performance.now();
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    }

    // Flush whatever trailed the last newline. An empty buffer yields one
    // empty record here, which consume() skips.
    consume(takeRecords(buffer + '\n', inQuotes).records);
    onProgress(file.size, file.size, rowCount);

    if (!columns || rowCount === 0) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    return {
      byId: byId,
      termIds: termIds,
      rowCount: rowCount,
      archivedSkipped: archivedSkipped
    };
  }

  // ========================================================================
  // Data Processing
  // ========================================================================

  /**
   * Processes terms CSV data
   * @param {Array<Object>} rows - Parsed CSV rows
   * @returns {Object} Processed terms object
   */
  function processTerms(rows) {
    const terms = {};

    rows.forEach(row => {
      const termId = row['Term id'] || row['term_id'] || row['TermId'];
      const termName = row['Term name'] || row['term_name'] || row['TermName'];

      if (!termId) return;

      // Extract sort order from year if present (e.g., "2024-25 Modules" -> 24)
      let sortOrder = -99;
      let type = 'system';

      const yearMatch = termName.match(/^(\d{4})-(\d{2})/);
      if (yearMatch) {
        sortOrder = parseInt(yearMatch[1].slice(2), 10);
        type = 'academic';
      } else if (termName.toLowerCase().includes('sandbox')) {
        sortOrder = -2;
        type = 'system';
      } else if (termName.toLowerCase().includes('archive')) {
        sortOrder = -1;
        type = 'system';
      }

      terms[termId] = {
        name: termName,
        type: type,
        sortOrder: sortOrder
      };
    });

    return terms;
  }

  /**
   * Processes departments CSV data, extracting unique base departments
   * @param {Array<Object>} rows - Parsed CSV rows
   * @returns {Object} Processed departments object
   */
  function processDepartments(rows) {
    const departments = {};
    const systemTags = ['ultra', 'original'];

    rows.forEach(row => {
      const deptIdStr = row['Department id'] || row['department_id'] || row['DepartmentId'];
      const deptNameStr = row['Department name'] || row['department_name'] || row['DepartmentName'];

      if (!deptIdStr) return;

      // Handle combined department IDs (e.g., "_267_1; _120_1")
      const deptIds = deptIdStr.split(';').map(id => id.trim());
      const deptNames = deptNameStr.split(';').map(name => name.trim());

      // The faculty a department sits under. Only meaningful on a single-id
      // row: a combined "_267_1; _120_1" cell has one parent for two children
      // and attributing it to either would be a guess.
      const singleId = deptIds.length === 1;
      const parentId = singleId ? (row['Parent Department id'] || '').trim() : '';
      const parentName = singleId ? (row['Parent Department name'] || '').trim() : '';

      deptIds.forEach((deptId, index) => {
        if (departments[deptId]) return; // Already processed

        const deptName = deptNames[index] || deptNames[0] || '';
        const isSystemTag = systemTags.some(tag =>
          deptName.toLowerCase() === tag
        );

        // Extract short code from name if present (e.g., "School of Psychology (JW)" -> "JW")
        let shortCode = null;
        const shortCodeMatch = deptName.match(/\(([A-Z]{2,4})\)$/);
        if (shortCodeMatch) {
          shortCode = shortCodeMatch[1];
        }

        departments[deptId] = {
          name: deptName,
          shortCode: shortCode,
          isSystemTag: isSystemTag,
          parentId: parentId || null,
          parentName: parentName || null
        };
      });
    });

    return departments;
  }

  // ========================================================================
  // Consistency
  // ========================================================================

  /**
   * Lists the term ids the surviving courses use that the terms map lacks.
   *
   * The same gate the Node builder applies before writing (build.mjs refuses
   * with exit 2). Courses and lookup are a SET: ALLY_LOOKUP.getTermName
   * returns the raw id for an unknown term, so a course naming a term the
   * lookup has never heard of prints "_465_1" where a term name belongs. An
   * empty term id is not counted - a course can legitimately have no term.
   *
   * The converter page does not call this; it never refused on it before the
   * lift and its output is held byte-identical to the builder's. The
   * application does, because it installs what it parses.
   *
   * @param {{byId: Object, termIds: Array<string>}} coursesData - streamCourses output
   * @param {Object} terms - processTerms output
   * @returns {Array<string>} Missing term ids, in first-seen order; empty when consistent
   */
  function findMissingTerms(coursesData, terms) {
    const known = terms || {};
    const seen = {};
    const missing = [];

    Object.keys(coursesData.byId).forEach(function(id) {
      const termId = coursesData.termIds[coursesData.byId[id][3]];
      if (!termId || seen[termId]) return;
      seen[termId] = true;
      if (!(termId in known)) missing.push(termId);
    });

    return missing;
  }

  // ========================================================================
  // Trends: the aggregate CSVs (multi-tenancy Stage 7)
  // ========================================================================
  // Ported from .claude/ally-course-data/build.mjs, which stays canonical.
  // splitRecords, parseAggregate, compactAggregate and buildTrends are the
  // builder's own functions character-for-character where its code is
  // browser-safe; buildTrends takes TEXT the caller has already read from a
  // File where the builder reads from fs. The drift check between the two is
  // the byte-diff of the emitted ally-trends-data.js on the same export
  // (.claude/ally-course-data/README.md), plus the rows in prove-build.mjs
  // that run THIS pipeline against the fixture inside a VM and compare every
  // dataset with the builder's.
  //
  // The four data traps - a no-files period scoring ~98%, the trailing
  // period, null-not-zero, the severity-suffix rule - live in
  // ally-data-runtime.js and run on whatever payload is installed. This
  // file owes the DATA SHAPE only.

  /** The five aggregate files the trends need, keyed by slot. */
  const TREND_INPUTS = Object.freeze({
    years: 'years.csv',
    terms: 'terms.csv',
    months: 'months.csv',
    departments: 'departments_years.csv',
    departmentTerms: 'departments_terms.csv'
  });

  /**
   * The three of the five an upload does not already require: terms.csv and
   * departments_years.csv serve the lookup as well, and carry the same 60
   * metrics after their dimension prefix. Trends are all-or-nothing on
   * these three.
   */
  const TREND_ONLY_INPUTS = Object.freeze({
    years: 'years.csv',
    months: 'months.csv',
    departmentTerms: 'departments_terms.csv'
  });

  /**
   * Dimension columns preceding the metrics in each aggregate file.
   *
   * All five carry the SAME 60 metrics in the same order after their dimension
   * prefix - verified, and the compact encoding depends on it, so the builder
   * refuses if that ever stops being true.
   */
  const TREND_DIMENSIONS = Object.freeze({
    years: ["Academic year"],
    terms: ["Term id", "Term name"],
    months: ["Month"],
    departments: [
      "Academic year",
      "Department id",
      "Department name",
      "Parent Department id",
      "Parent Department name",
    ],
    departmentTerms: [
      "Term id",
      "Term name",
      "Department id",
      "Department name",
      "Parent Department id",
      "Parent Department name",
    ],
  });

  /**
   * Minimum files for a period to be worth charting.
   *
   * Measured: the University's 2006-07 to 2009-10 rows report ~98.6% overall on
   * ZERO files, because with no files the overall score collapses to the
   * WYSIWYG score. Charted raw they make accessibility look as though it fell
   * off a cliff in 2010. 100 is comfortably above every empty period and
   * comfortably below every real one.
   */
  const MIN_FILES_FOR_TREND = 100;

  /**
   * Splits text into records, respecting quotes so a newline inside a quoted
   * field does not split a record.
   * @param {string} text - Whole file text
   * @returns {Array<string>} Records
   */
  function splitRecords(text) {
    const records = [];
    let start = 0;
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (quoted || char !== "\n") continue;

      let end = i;
      if (end > start && text[end - 1] === "\r") end--;
      records.push(text.slice(start, end));
      start = i + 1;
    }

    if (start < text.length) records.push(text.slice(start));

    return records.filter((r) => r.trim());
  }

  /**
   * Parses one aggregate CSV into { metrics, rows } with the dimension prefix
   * kept and every metric coerced to a number (empty cells become null, which
   * is NOT the same as zero and must not be charted as zero).
   *
   * @param {string} text - CSV text
   * @param {Array<string>} dimensions - Expected leading columns
   * @param {string} label - File name, for error messages
   * @returns {{metrics: Array<string>, rows: Array<Array>}}
   */
  function parseAggregate(text, dimensions, label) {
    const records = splitRecords(text);
    if (records.length < 2) throw new Error(`${label} has no data rows`);

    const header = parseCSVLine(records[0]).map((value) => value.trim());
    const leading = header.slice(0, dimensions.length);

    if (JSON.stringify(leading) !== JSON.stringify(dimensions)) {
      throw new Error(
        `${label} does not start with the expected columns.\n` +
          `    expected: ${dimensions.join(", ")}\n` +
          `    found:    ${leading.join(", ")}`,
      );
    }

    const metrics = header.slice(dimensions.length);
    const rows = [];

    for (let i = 1; i < records.length; i++) {
      const values = parseCSVLine(records[i]);
      const row = [];

      for (let d = 0; d < dimensions.length; d++) row.push((values[d] || "").trim());

      for (let m = 0; m < metrics.length; m++) {
        const cell = (values[dimensions.length + m] || "").trim();
        // Empty means "not measured", which is not zero. Preserving the
        // difference is what stops an unscored period plotting as 0%.
        row.push(cell === "" ? null : Number(cell));
      }

      rows.push(row);
    }

    return { metrics, rows };
  }

  /**
   * Reduces an aggregate to the compact row shape the module ships:
   * institution rows become [period, ...metrics], department rows become
   * [period, departmentId, ...metrics].
   *
   * @param {Object} parsed - Result of parseAggregate
   * @param {Object} spec - { periodAt, departmentAt }
   * @returns {Array<Array>} Compact rows
   */
  function compactAggregate(parsed, spec) {
    const dimensionCount = parsed.rows.length
      ? parsed.rows[0].length - parsed.metrics.length
      : 0;

    return parsed.rows
      .map((row) => {
        const metrics = row.slice(dimensionCount);
        const period = row[spec.periodAt];

        if (spec.departmentAt === undefined) return [period, ...metrics];

        const departmentId = row[spec.departmentAt];
        // Combined ids ("_267_1; _120_1") are a course-level artefact and do not
        // belong in a per-department rollup.
        if (!departmentId || departmentId.includes(";")) return null;
        return [period, departmentId, ...metrics];
      })
      .filter(Boolean);
  }

  /**
   * Parses every aggregate file's text and returns the trends datasets.
   *
   * The builder's buildTrends reads each file from disk; this one is handed
   * the text, keyed by the slots in TREND_INPUTS, and is otherwise the same
   * function. Throws - as the builder refuses - on a missing text, a file
   * whose leading columns are wrong, or a file whose metric list differs
   * from years.csv's.
   *
   * @param {Object} texts - { years, terms, months, departments, departmentTerms } as strings
   * @returns {Object} { metrics, byYear, byTerm, byMonth, byDepartmentYear, byDepartmentTerm }
   */
  function buildTrends(texts) {
    const read = (key, dimensions, name) => {
      if (!texts || typeof texts[key] !== 'string') {
        throw new Error(name + ' was not provided, so no trends can be built');
      }
      return parseAggregate(texts[key], dimensions, name);
    };

    const years = read("years", TREND_DIMENSIONS.years, "years.csv");
    const terms = read("terms", TREND_DIMENSIONS.terms, "terms.csv");
    const months = read("months", TREND_DIMENSIONS.months, "months.csv");
    const deptYears = read("departments", TREND_DIMENSIONS.departments, "departments_years.csv");
    const deptTerms = read("departmentTerms", TREND_DIMENSIONS.departmentTerms, "departments_terms.csv");

    // The shared metric list is the whole basis of the compact encoding.
    const reference = JSON.stringify(years.metrics);
    for (const [name, parsed] of [
      ["terms.csv", terms],
      ["months.csv", months],
      ["departments_years.csv", deptYears],
      ["departments_terms.csv", deptTerms],
    ]) {
      if (JSON.stringify(parsed.metrics) !== reference) {
        throw new Error(
          `${name} carries different metrics from years.csv, so they cannot share one metric list`,
        );
      }
    }

    // Chronological order is what a line chart depends on, and the CSVs are not
    // guaranteed to provide it.
    const byPeriod = (a, b) => String(a[0]).localeCompare(String(b[0]));

    return {
      metrics: years.metrics,
      byYear: compactAggregate(years, { periodAt: 0 }).sort(byPeriod),
      byTerm: compactAggregate(terms, { periodAt: 1 }).sort(byPeriod),
      byMonth: compactAggregate(months, { periodAt: 0 }).sort(byPeriod),
      byDepartmentYear: compactAggregate(deptYears, { periodAt: 0, departmentAt: 1 }).sort(byPeriod),
      byDepartmentTerm: compactAggregate(deptTerms, { periodAt: 1, departmentAt: 2 }).sort(byPeriod),
    };
  }

  /**
   * The trends sub-object of the payload: what ally-trends-data.js hands
   * ALLY_DATA_RUNTIME.installTrends, key for key, so a JSON install and a
   * script install build the same ALLY_TRENDS.
   *
   * @param {Object} trends - buildTrends output
   * @param {string} generatedOn - ISO timestamp of the export
   * @returns {Object} The installTrends payload
   */
  function buildTrendsPayload(trends, generatedOn) {
    return {
      generatedOn: generatedOn,
      minFiles: MIN_FILES_FOR_TREND,
      metrics: trends.metrics,
      byYear: trends.byYear,
      byTerm: trends.byTerm,
      byMonth: trends.byMonth,
      byDepartmentYear: trends.byDepartmentYear,
      byDepartmentTerm: trends.byDepartmentTerm
    };
  }

  // ========================================================================
  // The course payload (multi-tenancy Stage 6)
  // ========================================================================

  /**
   * Discriminator on the JSON course payload the converter emits and the
   * application fetches from a URL. Required on fetch: a file that does not
   * carry it is refused rather than installed, since a wrong URL usually
   * resolves to SOMETHING (an HTML error page, a directory listing).
   * @type {string}
   */
  const PAYLOAD_KIND = 'ally-course-payload';

  /**
   * Schema version of the payload. Bump it only for a change an older reader
   * could MISREAD; the fetch refuses a version it does not know.
   * @type {number}
   */
  const PAYLOAD_VERSION = 1;

  /**
   * Returns a copy of an object with its keys in ascending order.
   *
   * Kept character-for-character in step with build.mjs's sortByKey, which
   * is the canonical implementation. The converter sorts to match the
   * builder, never the reverse; it binds THIS copy so the two generated
   * modules and the JSON payload sort the lookup the same way.
   *
   * @param {Object} obj - Source object
   * @returns {Object} Same entries, keys ascending
   */
  function sortByKey(obj) {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
    return sorted;
  }

  /**
   * Builds the course payload from parsed export data.
   *
   * ONE builder for three consumers, so they cannot drift: the converter
   * serialises this object as ally-course-payload.json; ally-tenant-data.js
   * takes `courses` and `lookup` from it when it stores an upload; and a
   * fetched payload is installed through the same installers with those two
   * sub-objects UNCHANGED. `courses` is exactly what the generated
   * ally-courses-data.js hands ALLY_DATA_RUNTIME.installCourses, and `lookup`
   * exactly what ally-lookup-data.js hands installLookup, sorted the same
   * way - which is what makes a JSON install and a script install produce
   * the same maps in the same key order.
   *
   * `excludesArchived` mirrors the converter's own expression, so the search
   * UI's "archived courses are not included" message cannot say something
   * the payload did not do.
   *
   * Since Stage 7 the payload carries an OPTIONAL `trends` sub-object - the
   * buildTrends result plus `generatedOn` and `minFiles`, exactly what
   * ally-trends-data.js hands installTrends - when the export supplied the
   * aggregate files. Absent otherwise; an older reader ignores it, which is
   * why PAYLOAD_VERSION stays 1. `generatedAt` can be supplied so the
   * converter stamps its four outputs with ONE timestamp.
   *
   * @param {{byId: Object, termIds: Array<string>, archivedSkipped: number}} coursesData - streamCourses output
   * @param {Object} terms - processTerms output
   * @param {Object} departments - processDepartments output
   * @param {Object} [options] - { trends: buildTrends output, generatedAt: ISO string }
   * @returns {{kind: string, version: number, generatedAt: string, courses: Object, lookup: Object, trends?: Object}}
   */
  function buildCoursePayload(coursesData, terms, departments, options) {
    const opts = options || {};
    const rows = Object.keys(coursesData.byId).map(function(id) {
      return coursesData.byId[id];
    });
    const archivedSkipped = coursesData.archivedSkipped || 0;
    const generatedAt =
      typeof opts.generatedAt === 'string' && opts.generatedAt
        ? opts.generatedAt
        : new Date().toISOString();

    const payload = {
      kind: PAYLOAD_KIND,
      version: PAYLOAD_VERSION,
      generatedAt: generatedAt,
      courses: {
        termIds: coursesData.termIds,
        rows: rows,
        excludesArchived: archivedSkipped > 0,
        archivedExcluded: archivedSkipped
      },
      lookup: {
        terms: sortByKey(terms || {}),
        departments: sortByKey(departments || {})
      }
    };

    // Trends share the payload's timestamp: the converter's module and its
    // JSON then agree on generatedOn, which the parity check compares.
    if (opts.trends) payload.trends = buildTrendsPayload(opts.trends, generatedAt);

    return payload;
  }

  /**
   * The keys a trends sub-object must carry, in the order installTrends
   * reads them. Exposed so a fetched payload can be checked before storing.
   */
  const TRENDS_PAYLOAD_KEYS = Object.freeze([
    'generatedOn', 'minFiles', 'metrics',
    'byYear', 'byTerm', 'byMonth', 'byDepartmentYear', 'byDepartmentTerm'
  ]);

  /**
   * Whether a value has the shape installTrends expects: a string date, a
   * numeric minimum, a non-empty metrics array, and five row arrays. Empty
   * datasets are allowed - a small institution may have no department rows.
   * @param {*} trends - The payload's trends sub-object
   * @returns {boolean}
   */
  function isTrendsPayload(trends) {
    if (!trends || typeof trends !== 'object' || Array.isArray(trends)) return false;
    if (typeof trends.generatedOn !== 'string') return false;
    if (typeof trends.minFiles !== 'number') return false;
    if (!Array.isArray(trends.metrics) || trends.metrics.length === 0) return false;
    return ['byYear', 'byTerm', 'byMonth', 'byDepartmentYear', 'byDepartmentTerm'].every(
      function(key) {
        return Array.isArray(trends[key]) && trends[key].every(Array.isArray);
      }
    );
  }

  logDebug('parser loaded');

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    // Whole-file parsing (terms.csv, departments_years.csv)
    parseCSV: parseCSV,
    parseCSVLine: parseCSVLine,
    readFileAsText: readFileAsText,

    // Streaming parsing (courses.csv)
    resolveColumnIndexes: resolveColumnIndexes,
    readCell: readCell,
    takeRecords: takeRecords,
    readTextChunks: readTextChunks,
    streamCourses: streamCourses,

    // Processing into the runtime's payload shapes
    processTerms: processTerms,
    processDepartments: processDepartments,
    findMissingTerms: findMissingTerms,

    // Trends from the aggregate CSVs (Stage 7): the builder's pipeline,
    // ported, feeding the converter's fourth output and the payload
    splitRecords: splitRecords,
    parseAggregate: parseAggregate,
    compactAggregate: compactAggregate,
    buildTrends: buildTrends,
    buildTrendsPayload: buildTrendsPayload,
    isTrendsPayload: isTrendsPayload,
    TREND_INPUTS: TREND_INPUTS,
    TREND_ONLY_INPUTS: TREND_ONLY_INPUTS,
    TREND_DIMENSIONS: TREND_DIMENSIONS,
    MIN_FILES_FOR_TREND: MIN_FILES_FOR_TREND,
    TRENDS_PAYLOAD_KEYS: TRENDS_PAYLOAD_KEYS,

    // The course payload (Stage 6): one builder for the converter's JSON,
    // the stored upload record and the fetched install
    buildCoursePayload: buildCoursePayload,
    sortByKey: sortByKey,
    PAYLOAD_KIND: PAYLOAD_KIND,
    PAYLOAD_VERSION: PAYLOAD_VERSION,

    // Exposed for tests and for callers that need the same column rules
    COURSE_COLUMN_ALIASES: COURSE_COLUMN_ALIASES,
    ARCHIVED_NAME_PATTERN: ARCHIVED_NAME_PATTERN,
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_CSV_PARSER = ALLY_CSV_PARSER;
}
