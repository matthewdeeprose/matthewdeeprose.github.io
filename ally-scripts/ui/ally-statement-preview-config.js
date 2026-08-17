/**
 * @fileoverview Ally Statement Preview Configuration - IIFE Module
 * @module AllyStatementPreviewConfig
 * @version 2.0.0
 * @since Phase 7B
 *
 * @description
 * Thin adapter over the content library (`window.ALLY_SP_CONTENT`, published by
 * `ally-statement-preview-content.js`, which MUST load first). All
 * student-facing text now lives in the content library; this module derives its
 * legacy public surface (THEMES, INTRO, SUCCESS, getTheme, getActiveThemes,
 * getAllFields, getThemeForField, getTokens, getEnvironments, resolve*) from it,
 * returning the same shapes existing consumers and tests expect.
 *
 * Key Features:
 * - Theme-to-API-field mappings for conditional display (derived from content)
 * - Complete disclosure content (What this means / Suggestions)
 * - Icon mappings for each theme
 * - Success/empty state messages
 * - Master-settings environment / token resolution (projection, never mutation)
 *
 * The derived locals are token-bearing projections of the content library —
 * literal `{token}` strings are preserved; resolution happens via the resolve
 * helpers / applyTokensDeep at render time and never mutates the raw content.
 *
 * @example
 * const themes = ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(issueData);
 * const theme = ALLY_STATEMENT_PREVIEW_CONFIG.getTheme('missing-alt');
 */

const ALLY_STATEMENT_PREVIEW_CONFIG = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyStatementConfig] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementConfig] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementConfig] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementConfig] " + message, ...args);
  }

  // ========================================================================
  // Content library source (published by ally-statement-preview-content.js)
  // ========================================================================

  const CONTENT = window.ALLY_SP_CONTENT;
  if (!CONTENT || !CONTENT.entries) {
    logError(
      "window.ALLY_SP_CONTENT is missing — ensure " +
        "ally-statement-preview-content.js loads BEFORE this config module.",
    );
  }

  const CONTENT_ENTRIES = (CONTENT && CONTENT.entries) || {};

  // ========================================================================
  // Derived locals — projections of the content library (never mutated)
  // ========================================================================
  //
  // Each accessor below reads these locals, so deriving them from the content
  // library re-points the entire public surface at the single source of truth
  // while preserving the exact legacy shapes. Theme order follows the content
  // library's entry insertion order (stable for non-numeric string keys).

  /**
   * Projects a `kind: "theme"` content entry into the legacy theme shape:
   * { id (== legacyId), fields, icon, title, summary, [summaryExtra],
   *   disclosureId, whatThisMeans, suggestions }. The content-library metadata
   *   (content id / kind / legacyId) is dropped. Nested arrays are shared by
   *   reference (as before) — resolve* deep-copies at render, so raw content is
   *   never mutated.
   * @param {Object} entry
   * @returns {Object}
   */
  function projectTheme(entry) {
    const theme = {
      id: entry.legacyId,
      fields: entry.fields,
      icon: entry.icon,
      title: entry.title,
      summary: entry.summary,
      disclosureId: entry.disclosureId,
      whatThisMeans: entry.whatThisMeans,
      suggestions: entry.suggestions,
    };
    if (Object.prototype.hasOwnProperty.call(entry, "summaryExtra")) {
      theme.summaryExtra = entry.summaryExtra;
    }
    return theme;
  }

  /**
   * Derives the ordered THEMES array from the content library's theme entries.
   * @returns {Array}
   */
  const ACCESSIBILITY_THEMES = (function () {
    const themes = [];
    Object.keys(CONTENT_ENTRIES).forEach(function (key) {
      const entry = CONTENT_ENTRIES[key];
      if (entry && entry.kind === "theme") {
        themes.push(projectTheme(entry));
      }
    });
    return themes;
  })();

  /**
   * Maps a theme's legacy id (e.g. "missing-alt") back to its stable content
   * id (e.g. "theme:missing-alt"), so override lookup — which is keyed by
   * content id — can find a projected legacy theme's overrides.
   * @type {Object.<string,string>}
   */
  const themeContentIdByLegacy = (function () {
    const map = {};
    Object.keys(CONTENT_ENTRIES).forEach(function (key) {
      const entry = CONTENT_ENTRIES[key];
      if (entry && entry.kind === "theme" && typeof entry.legacyId === "string") {
        map[entry.legacyId] = key;
      }
    });
    return map;
  })();

  /**
   * Introduction section content — projected to the legacy INTRO shape
   * { heading, subHeading, paragraphs, bulletPoints }. `subHeading` is the
   * "Introduction" h5 sub-heading inside the info-box restyle; it is optional
   * (older content without it simply omits the sub-heading).
   */
  const INTRO_TEXT = (function () {
    const e = CONTENT_ENTRIES.intro || {};
    return {
      heading: e.heading,
      subHeading: e.subHeading,
      paragraphs: e.paragraphs,
      bulletPoints: e.bulletPoints,
    };
  })();

  /**
   * Success state content (shown when no issues found) — projected to the
   * legacy SUCCESS shape { icon, title, message }.
   */
  const SUCCESS_STATE = (function () {
    const e = CONTENT_ENTRIES.success || {};
    return { icon: e.icon, title: e.title, message: e.message };
  })();

  /**
   * Authored (static / config-driven) sections appended to every statement,
   * rendered via the section registry (ALLY_STATEMENT_PREVIEW_SECTIONS). Each
   * entry is a section spec (type: info | video | group | linkButtons |
   * courseInfo) plus an optional `placement`:
   *   - "before-issues" — rendered after the intro, before the warnings
   *   - "after-issues"  — rendered after the warnings/success (default)
   * Sourced from the content library (empty by default until authored).
   * @type {Array}
   */
  const AUTHORED_SECTIONS = (CONTENT && CONTENT.authoredSections) || [];

  // ========================================================================
  // Master-settings environments (institution / VLE wording profiles)
  // ========================================================================

  /**
   * Named profiles selectable by the master-settings switch. Each maps the
   * content tokens ({vle}, {contentOwner}, {institution}, {institutionShort},
   * {library}, {courseNoun}) embedded in the theme / intro / success / authored
   * content to environment-appropriate wording. Sourced from the content
   * library; the DEFAULT (soton-blackboard) profile reproduces the original
   * hand-written wording.
   * @type {Object.<string, {label: string, tokens: Object.<string,string>}>}
   */
  const ENVIRONMENTS = (CONTENT && CONTENT.environments) || {};

  const DEFAULT_ENVIRONMENT =
    (CONTENT && CONTENT.defaultEnvironment) || "soton-blackboard";

  /**
   * Returns the override partial for a content id under an environment, or
   * undefined. Keyed by content id (theme content id, "intro", "success", or an
   * authored section id).
   * @param {string} envId
   * @param {string} contentId
   * @returns {Object|undefined}
   */
  function getEnvOverride(envId, contentId) {
    if (!envId || !contentId) return undefined;
    const env = ENVIRONMENTS[envId];
    if (!env || !env.overrides) return undefined;
    return Object.prototype.hasOwnProperty.call(env.overrides, contentId)
      ? env.overrides[contentId]
      : undefined;
  }

  /**
   * Validates every environment's override keys at load: each must name a known
   * content id (a content-library entry or an authored section id). Unknown
   * keys are warned about and otherwise ignored (they simply never apply — no
   * crash). Runs once; purely diagnostic.
   */
  (function validateOverrides() {
    const validIds = {};
    Object.keys(CONTENT_ENTRIES).forEach(function (id) {
      validIds[id] = true;
    });
    AUTHORED_SECTIONS.forEach(function (spec) {
      if (spec && typeof spec.id === "string") validIds[spec.id] = true;
    });
    Object.keys(ENVIRONMENTS).forEach(function (envId) {
      const overrides = ENVIRONMENTS[envId] && ENVIRONMENTS[envId].overrides;
      if (!overrides) return;
      Object.keys(overrides).forEach(function (key) {
        if (!validIds[key]) {
          logWarn(
            "Environment '" +
              envId +
              "' has an override for unknown content id '" +
              key +
              "' — it will be ignored.",
          );
        }
      });
    });
  })();

  /**
   * Substitutes {token} placeholders in a single string. Only known keys (those
   * present in `tokens`) are replaced; an unknown {placeholder} is left intact
   * and debug-logged, so a stray literal brace never silently vanishes.
   * @param {string} str
   * @param {Object.<string,string>} tokens
   * @returns {string}
   */
  function applyTokens(str, tokens) {
    if (typeof str !== "string" || !tokens) return str;
    return str.replace(/\{(\w+)\}/g, function (match, key) {
      if (Object.prototype.hasOwnProperty.call(tokens, key)) {
        return tokens[key];
      }
      logDebug("Unknown token left intact: " + match);
      return match;
    });
  }

  /**
   * Deep-applies token substitution to a value (string / array / plain object),
   * returning a NEW structure (never mutates the source). Used to project the
   * token-bearing raw content into resolved content at render time.
   * @param {*} value
   * @param {Object.<string,string>} tokens
   * @returns {*}
   */
  function applyTokensDeep(value, tokens) {
    if (typeof value === "string") return applyTokens(value, tokens);
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return applyTokensDeep(item, tokens);
      });
    }
    if (value && typeof value === "object") {
      const out = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          out[key] = applyTokensDeep(value[key], tokens);
        }
      }
      return out;
    }
    return value;
  }

  /**
   * Deep-merges an override value over a base value, returning a NEW structure
   * (never mutates either). Merge semantics (Stage 4):
   *   - plain objects merge recursively (override keys win; base-only keys kept)
   *   - arrays are replaced WHOLESALE by the override array (no per-index merge)
   *   - primitives / strings: the override value wins
   *   - `override === undefined` returns the base unchanged
   * Applied to token-BEARING content, BEFORE token substitution, so an override
   * may itself contain {tokens}.
   * @param {*} base
   * @param {*} override
   * @returns {*}
   */
  function deepMerge(base, override) {
    if (override === undefined) return base;
    if (Array.isArray(base) || Array.isArray(override)) return override;
    if (
      base &&
      typeof base === "object" &&
      override &&
      typeof override === "object"
    ) {
      const out = {};
      for (const bk in base) {
        if (Object.prototype.hasOwnProperty.call(base, bk)) out[bk] = base[bk];
      }
      for (const ok in override) {
        if (Object.prototype.hasOwnProperty.call(override, ok)) {
          out[ok] = deepMerge(base ? base[ok] : undefined, override[ok]);
        }
      }
      return out;
    }
    return override;
  }

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Creates a lookup map for quick theme retrieval by ID
   */
  const themeMap = (function () {
    const map = {};
    ACCESSIBILITY_THEMES.forEach(function (theme) {
      map[theme.id] = theme;
    });
    return map;
  })();

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    /**
     * All accessibility themes
     * @type {Array}
     */
    THEMES: ACCESSIBILITY_THEMES,

    /**
     * Introduction text configuration
     * @type {Object}
     */
    INTRO: INTRO_TEXT,

    /**
     * Success state configuration
     * @type {Object}
     */
    SUCCESS: SUCCESS_STATE,

    /**
     * Authored static sections appended to every statement
     * @type {Array}
     */
    AUTHORED_SECTIONS: AUTHORED_SECTIONS,

    /**
     * Returns the authored static sections (section specs). Currently the raw
     * array; a later phase resolves master-settings tokens over a deep copy.
     * @returns {Array}
     */
    getAuthoredSections: function () {
      return AUTHORED_SECTIONS;
    },

    // --------------------------------------------------------------------
    // Master-settings environment API (additive; raw THEMES/INTRO/SUCCESS
    // above still expose token-bearing content, so existing consumers/tests
    // are unaffected — resolution is a projection, not a mutation).
    // --------------------------------------------------------------------

    /**
     * All environment profiles as an array of { id, label }.
     * @returns {Array.<{id: string, label: string}>}
     */
    getEnvironments: function () {
      return Object.keys(ENVIRONMENTS).map(function (id) {
        return { id: id, label: ENVIRONMENTS[id].label };
      });
    },

    /**
     * A single environment profile by id, or null.
     * @param {string} id
     * @returns {{label: string, tokens: Object}|null}
     */
    getEnvironment: function (id) {
      return ENVIRONMENTS[id] || null;
    },

    /**
     * The default environment id.
     * @returns {string}
     */
    getDefaultEnvironment: function () {
      return DEFAULT_ENVIRONMENT;
    },

    /**
     * The token map for an environment id (falls back to the default).
     * @param {string} id
     * @returns {Object.<string,string>}
     */
    getTokens: function (id) {
      const env = ENVIRONMENTS[id] || ENVIRONMENTS[DEFAULT_ENVIRONMENT];
      return env ? env.tokens : {};
    },

    /**
     * The ordered layout for an environment id, or null when the environment
     * declares no layout (the controller then uses its legacy placement path).
     * Each entry is a content id string or an object `{ id, showWhen? }`. The
     * `@issues` sentinel marks where the accessibility-issue block injects.
     * Returns the raw array (not a copy) — the controller treats it read-only.
     * @param {string} id
     * @returns {Array.<(string|Object)>|null}
     */
    getLayout: function (id) {
      const env = ENVIRONMENTS[id];
      return env && Array.isArray(env.layout) ? env.layout : null;
    },

    /**
     * Substitutes tokens in a single string (exposed for tests / reuse).
     */
    applyTokens: applyTokens,

    /**
     * Returns a deep copy of a theme with any environment override applied
     * (Stage 4), then tokens resolved. Raw THEMES are unchanged. Passing no
     * `envId` skips overrides (identical to the pre-Stage-4 behaviour).
     * @param {Object} theme
     * @param {Object} tokens
     * @param {string} [envId]
     * @returns {Object}
     */
    resolveTheme: function (theme, tokens, envId) {
      const contentId = theme && themeContentIdByLegacy[theme.id];
      const merged = deepMerge(theme, getEnvOverride(envId, contentId));
      return applyTokensDeep(merged, tokens);
    },

    /**
     * Returns a deep copy of the intro content with any override applied, then
     * tokens resolved.
     * @param {Object} tokens
     * @param {string} [envId]
     * @returns {Object}
     */
    resolveIntro: function (tokens, envId) {
      const merged = deepMerge(INTRO_TEXT, getEnvOverride(envId, "intro"));
      return applyTokensDeep(merged, tokens);
    },

    /**
     * Returns a deep copy of the success content with any override applied, then
     * tokens resolved.
     * @param {Object} tokens
     * @param {string} [envId]
     * @returns {Object}
     */
    resolveSuccess: function (tokens, envId) {
      const merged = deepMerge(SUCCESS_STATE, getEnvOverride(envId, "success"));
      return applyTokensDeep(merged, tokens);
    },

    /**
     * Returns a deep copy of an array of section specs with any per-id override
     * applied, then tokens resolved. Each spec's override is keyed by `spec.id`.
     * @param {Array} specs
     * @param {Object} tokens
     * @param {string} [envId]
     * @returns {Array}
     */
    resolveSections: function (specs, tokens, envId) {
      return (specs || []).map(function (spec) {
        const merged =
          spec && typeof spec.id === "string"
            ? deepMerge(spec, getEnvOverride(envId, spec.id))
            : spec;
        return applyTokensDeep(merged, tokens);
      });
    },

    /**
     * Gets a theme by its ID
     * @param {string} id - Theme ID (e.g., 'missing-alt', 'broken-links')
     * @returns {Object|null} Theme configuration or null if not found
     */
    getTheme: function (id) {
      const theme = themeMap[id] || null;
      if (!theme) {
        logWarn("Theme not found: " + id);
      }
      return theme;
    },

    /**
     * Calculates the total issue count for a theme from API data
     * @param {Object} theme - Theme configuration object
     * @param {Object} issueData - API response data containing issue counts
     * @returns {number} Total issues for this theme (sum of all mapped fields)
     */
    calculateThemeIssues: function (theme, issueData) {
      if (!theme || !theme.fields || !issueData) {
        return 0;
      }

      let total = 0;
      theme.fields.forEach(function (field) {
        const value = issueData[field];
        if (typeof value === "number" && !isNaN(value)) {
          total += value;
        }
      });

      logDebug(
        "Theme '" + theme.id + "' has " + total + " issues from fields:",
        theme.fields,
      );
      return total;
    },

    /**
     * Gets themes that have issues (count > 0)
     * @param {Object} issueData - API response data containing issue counts
     * @returns {Array} Array of {theme, count} objects for themes with issues
     */
    getActiveThemes: function (issueData) {
      const self = this;
      const active = [];

      if (!issueData) {
        logWarn("No issue data provided to getActiveThemes");
        return active;
      }

      ACCESSIBILITY_THEMES.forEach(function (theme) {
        const count = self.calculateThemeIssues(theme, issueData);
        if (count > 0) {
          active.push({ theme: theme, count: count });
        }
      });

      logInfo(
        "Found " +
          active.length +
          " active themes out of " +
          ACCESSIBILITY_THEMES.length +
          " total",
      );
      return active;
    },

    /**
     * Gets all field names used across all themes
     * @returns {Array} Array of unique field names
     */
    getAllFields: function () {
      const fields = new Set();
      ACCESSIBILITY_THEMES.forEach(function (theme) {
        theme.fields.forEach(function (field) {
          fields.add(field);
        });
      });
      return Array.from(fields);
    },

    /**
     * Gets the theme ID for a given field name
     * @param {string} fieldName - API field name
     * @returns {string|null} Theme ID or null if field not found
     */
    getThemeForField: function (fieldName) {
      for (let i = 0; i < ACCESSIBILITY_THEMES.length; i++) {
        const theme = ACCESSIBILITY_THEMES[i];
        if (theme.fields.indexOf(fieldName) !== -1) {
          return theme.id;
        }
      }
      return null;
    },

    /**
     * Gets debug information about the configuration
     * @returns {Object} Debug information
     */
    getDebugInfo: function () {
      return {
        themeCount: ACCESSIBILITY_THEMES.length,
        themes: ACCESSIBILITY_THEMES.map(function (t) {
          return {
            id: t.id,
            title: t.title,
            fieldCount: t.fields.length,
          };
        }),
        totalFields: this.getAllFields().length,
      };
    },
  };
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyStatementPreviewConfig = function () {
  console.group("ALLY_STATEMENT_PREVIEW_CONFIG Tests");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence tests
  test(
    "ALLY_STATEMENT_PREVIEW_CONFIG exists",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG === "object",
  );
  test("has THEMES array", Array.isArray(ALLY_STATEMENT_PREVIEW_CONFIG.THEMES));
  test(
    "has INTRO object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.INTRO === "object",
  );
  test(
    "has SUCCESS object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS === "object",
  );

  // Method existence tests
  test(
    "has getTheme method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getTheme === "function",
  );
  test(
    "has calculateThemeIssues method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues === "function",
  );
  test(
    "has getActiveThemes method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes === "function",
  );
  test(
    "has getAllFields method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields === "function",
  );
  test(
    "has getThemeForField method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getDebugInfo === "function",
  );

  // Theme structure tests
  const themes = ALLY_STATEMENT_PREVIEW_CONFIG.THEMES;
  test("has 9 themes", themes.length === 9);

  const firstTheme = themes[0];
  test("first theme has id", typeof firstTheme.id === "string");
  test("first theme has fields array", Array.isArray(firstTheme.fields));
  test("first theme has icon", typeof firstTheme.icon === "string");
  test("first theme has title", typeof firstTheme.title === "string");
  test("first theme has summary", typeof firstTheme.summary === "string");
  test(
    "first theme has disclosureId",
    typeof firstTheme.disclosureId === "string",
  );
  test(
    "first theme has whatThisMeans array",
    Array.isArray(firstTheme.whatThisMeans),
  );
  test(
    "first theme has suggestions array",
    Array.isArray(firstTheme.suggestions),
  );

  // getTheme tests
  const missingAltTheme = ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("missing-alt");
  test("getTheme returns correct theme", missingAltTheme !== null);
  test(
    "getTheme returns theme with correct title",
    missingAltTheme && missingAltTheme.title === "Missing image descriptions",
  );
  test(
    "getTheme returns null for unknown theme",
    ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("unknown-theme") === null,
  );

  // calculateThemeIssues tests
  const mockIssueData = {
    alternativeText2: 5,
    htmlImageAlt2: 3,
    htmlObjectAlt2: 0,
    imageDescription2: 2,
  };
  const issueCount = ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues(
    missingAltTheme,
    mockIssueData,
  );
  test("calculateThemeIssues returns correct count", issueCount === 10);
  test(
    "calculateThemeIssues handles null data",
    ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues(
      missingAltTheme,
      null,
    ) === 0,
  );

  // getActiveThemes tests
  const activeThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(mockIssueData);
  test("getActiveThemes returns array", Array.isArray(activeThemes));
  test(
    "getActiveThemes returns themes with issues",
    activeThemes.length > 0 && activeThemes[0].count > 0,
  );

  // getActiveThemes with no issues
  const emptyData = {};
  const noActiveThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(emptyData);
  test(
    "getActiveThemes returns empty array for no issues",
    noActiveThemes.length === 0,
  );

  // getAllFields tests
  const allFields = ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields();
  test("getAllFields returns array", Array.isArray(allFields));
  test("getAllFields has reasonable count", allFields.length > 10);
  test(
    "getAllFields includes known field",
    allFields.indexOf("alternativeText2") !== -1,
  );

  // getThemeForField tests
  const themeForField =
    ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField("alternativeText2");
  test(
    "getThemeForField returns correct theme",
    themeForField === "missing-alt",
  );
  test(
    "getThemeForField returns null for unknown field",
    ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField("unknownField123") === null,
  );

  // INTRO structure tests
  const intro = ALLY_STATEMENT_PREVIEW_CONFIG.INTRO;
  test("INTRO has heading", typeof intro.heading === "string");
  test("INTRO has paragraphs array", Array.isArray(intro.paragraphs));
  test("INTRO has bulletPoints array", Array.isArray(intro.bulletPoints));

  // SUCCESS structure tests
  const success = ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS;
  test("SUCCESS has icon", typeof success.icon === "string");
  test("SUCCESS has title", typeof success.title === "string");
  test("SUCCESS has message", typeof success.message === "string");

  // Debug info test
  const debugInfo = ALLY_STATEMENT_PREVIEW_CONFIG.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has themeCount", typeof debugInfo.themeCount === "number");
  test("debugInfo has themes array", Array.isArray(debugInfo.themes));

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
