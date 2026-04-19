/**
 * Graph Builder CSV Processor
 *
 * Intelligent CSV parsing with automatic type detection,
 * delimiter detection, and column role suggestion.
 *
 * Dependencies: None (pure vanilla JavaScript)
 *
 * @version 1.0.0
 */

const GraphBuilderCSVProcessor = (function () {
  "use strict";

  // ============================================
  // LOGGING CONFIGURATION
  // ============================================

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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[GB CSV] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB CSV] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB CSV] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB CSV] " + message, ...args);
  }

  // ============================================
  // TYPE DETECTION PATTERNS
  // ============================================

  const TYPE_PATTERNS = {
    currency: /^[£$€¥₹]\s*[\d,]+(?:\.\d{2})?$/,
    percentage: /^\d+(?:\.\d+)?%$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    number: /^-?\d+(?:\.\d+)?$/,
  };

  // ============================================
  // DELIMITER DETECTION
  // ============================================

  function detectDelimiter(csvText) {
    var delimiters = [",", ";", "\t", "|"];
    var sampleLines = csvText.split(/\r?\n/).slice(0, 3);

    var scores = delimiters.map(function (d) {
      var re = new RegExp("\\" + d, "g");
      var counts = sampleLines.map(function (line) {
        return (line.match(re) || []).length;
      });
      var avg = counts.reduce(function (a, b) { return a + b; }, 0) / counts.length;
      var consistent = counts.every(function (c) { return Math.abs(c - avg) <= 1; });
      return { delimiter: d, score: avg * (consistent ? 2 : 1) };
    });

    scores.sort(function (a, b) { return b.score - a.score; });
    logDebug("Detected delimiter: " + JSON.stringify(scores[0].delimiter));
    return scores[0].delimiter;
  }

  // ============================================
  // LINE PARSING (handles quoted fields)
  // ============================================

  function parseLine(line, delimiter) {
    var values = [];
    var current = "";
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var next = line[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  }

  // ============================================
  // COLUMN TYPE DETECTION
  // ============================================

  function detectColumnType(values) {
    if (!values || values.length === 0) {
      return { type: "text", confidence: 0.5, reason: "No data available" };
    }

    var typeKeys = Object.keys(TYPE_PATTERNS);
    var results = typeKeys.map(function (type) {
      var matches = values.filter(function (v) {
        return TYPE_PATTERNS[type].test(v);
      }).length;
      return { type: type, confidence: matches / values.length, matches: matches };
    });

    results.sort(function (a, b) { return b.confidence - a.confidence; });
    var best = results[0];

    if (best.confidence < 0.6) {
      return { type: "text", confidence: 0.8, reason: "Defaulting to text type" };
    }

    return {
      type: best.type,
      confidence: best.confidence,
      reason: best.matches + "/" + values.length + " values match " + best.type + " pattern",
    };
  }

  // ============================================
  // COLUMN ROLE SUGGESTION
  // ============================================

  function suggestColumnRole(columnName, dataType, index) {
    var name = columnName.toLowerCase();

    if (name.includes("name") || name.includes("category") ||
        name.includes("label") || name.includes("date") || index === 0) {
      return { role: "label", confidence: 0.7 };
    }

    if (name.includes("value") || name.includes("amount") ||
        name.includes("price") || name.includes("count")) {
      return { role: "value", confidence: 0.8 };
    }

    if (dataType === "text") {
      return { role: "label", confidence: 0.6 };
    }

    return { role: "value", confidence: 0.7 };
  }

  // ============================================
  // MAIN PROCESSOR
  // ============================================

  function processCSV(csvText, options) {
    try {
      options = options || {};
      var hasHeaders = options.hasHeaders !== false;
      var delimiter = options.delimiter || "auto";

      var detectedDelimiter = delimiter === "auto"
        ? detectDelimiter(csvText)
        : delimiter;

      var lines = csvText.split(/\r?\n/).filter(function (l) {
        return l.trim().length > 0;
      });

      if (lines.length === 0) {
        throw new Error("CSV appears to be empty");
      }

      var headers = parseLine(lines[0], detectedDelimiter);
      var dataLines = hasHeaders ? lines.slice(1) : lines;
      var rows = dataLines
        .map(function (l) { return parseLine(l, detectedDelimiter); })
        .filter(function (r) { return r.length > 0; });

      // Analyse columns
      var sampleSize = Math.min(20, rows.length);
      var analysis = headers.map(function (header, idx) {
        var sampleValues = rows.slice(0, sampleSize)
          .map(function (row) { return row[idx]; })
          .filter(function (v) { return v && v.trim() !== ""; });

        var typeDetection = detectColumnType(sampleValues);
        var roleSuggestion = suggestColumnRole(header, typeDetection.type, idx);

        return {
          index: idx,
          name: header,
          typeDetection: typeDetection,
          roleSuggestion: roleSuggestion,
        };
      });

      // Generate intelligent configuration
      var intelligentColumns = analysis.map(function (col) {
        return {
          name: col.name,
          type: col.typeDetection.type,
          role: col.roleSuggestion.role,
          confidence:
            (col.typeDetection.confidence + col.roleSuggestion.confidence) / 2,
        };
      });

      var overallConfidence = intelligentColumns.reduce(function (total, col) {
        return total + col.confidence;
      }, 0) / intelligentColumns.length;

      // Generate suggestions
      var suggestions = [];
      var lowConfidence = intelligentColumns.filter(function (c) {
        return c.confidence < 0.6;
      });
      if (lowConfidence.length > 0) {
        suggestions.push({
          type: "review",
          message:
            "Review configuration for: " +
            lowConfidence.map(function (c) { return c.name; }).join(", "),
        });
      }

      logInfo(
        "Processed CSV: " + headers.length + " columns, " +
        rows.length + " rows, delimiter=" +
        JSON.stringify(detectedDelimiter)
      );

      return {
        headers: headers,
        rows: rows,
        delimiter: detectedDelimiter,
        metadata: {
          intelligentConfig: {
            columns: intelligentColumns,
            confidence: overallConfidence,
          },
          analysis: analysis,
          suggestions: suggestions,
        },
      };
    } catch (error) {
      logError("CSV processing failed:", error);
      throw error;
    }
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    processCSV: processCSV,
    detectDelimiter: detectDelimiter,
    detectColumnType: detectColumnType,
    suggestColumnRole: suggestColumnRole,
  };
})();

// Attach to window
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderCSVProcessor;
} else {
  window.GraphBuilderCSVProcessor = GraphBuilderCSVProcessor;
}
