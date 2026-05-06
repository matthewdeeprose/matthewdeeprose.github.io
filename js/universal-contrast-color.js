/**
 * Universal Contrast Colour
 * Centralised brand/theme token manager with automatic contrast companion
 * variables.
 *
 * Provides:
 *   - A single source of truth for brand CSS custom properties
 *   - Auto-maintained companion variable for contrast-safe foreground
 *     (works everywhere, not just in browsers that support contrast-color())
 *   - Optional localStorage persistence
 *   - Change listeners for reactive updates
 *   - Matching logging convention used across our projects
 *
 * USAGE
 * -----
 *   // 1. Register one or more tokens on page load.
 *   UniversalContrastColor.init({
 *     tokens: {
 *       '--brand':  '#6c1afb',
 *       '--accent': '#00a86b'
 *     }
 *   });
 *
 *   // 2. Change a token later. The companion contrast variable auto-updates.
 *   UniversalContrastColor.set('--brand', '#ffcc00');
 *
 *   // 3. In your CSS, use either approach:
 *   //    a) Native contrast-color() in supporting browsers:
 *   //       .btn { background: var(--brand); color: contrast-color(var(--brand)); }
 *   //    b) The companion variable for universal browser support:
 *   //       .btn { background: var(--brand); color: var(--brand-contrast); }
 *
 *   // 4. React to changes anywhere in your app.
 *   const unsubscribe = UniversalContrastColor.onChange(({ name, value, contrast }) => {
 *     // ...
 *   });
 *
 * @version 1.0.0
 */

const UniversalContrastColor = (function () {
  "use strict";

  // ====== LOGGING (matches UniversalNotifications convention) ======
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Universal Contrast Colour] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Universal Contrast Colour] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Universal Contrast Colour] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Universal Contrast Colour] DEBUG: ${message}`, ...args);
    }
  }

  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to: ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level,
        )}`,
      );
    } else {
      logWarn(`Invalid logging level: ${level}`);
    }
  }

  /**
   * Contrast Colour Manager
   * Owns the token registry and applies variables to :root.
   */
  class ContrastColorManager {
    constructor() {
      this.tokens = new Map(); // token name -> current value
      this.defaults = new Map(); // token name -> default value (for reset)
      this.listeners = new Set();

      // Configurable via init()
      this.contrastSuffix = "-contrast";
      this.persist = false;
      this.storageKey = "ucc-theme";

      this.initialised = false;

      // Cached canvas context for robust colour parsing.
      this._parseCtx = null;

      logInfo("Contrast colour manager created (awaiting init).");
    }

    /**
     * Initialise the manager. Can be called more than once; later calls merge
     * additional tokens rather than replacing existing ones.
     *
     * @param {Object} options
     * @param {Object<string,string>} [options.tokens]           Map of custom property name to initial value.
     * @param {string}                [options.contrastSuffix]    Suffix appended to each token to form its contrast companion (default '-contrast').
     * @param {boolean}               [options.persist]           If true, persist set values to localStorage.
     * @param {string}                [options.storageKey]        localStorage key (default 'ucc-theme').
     */
    init(options = {}) {
      if (this.initialised) {
        logWarn("init() called more than once; merging new tokens.");
      }

      const {
        tokens = {},
        contrastSuffix = this.contrastSuffix,
        persist = this.persist,
        storageKey = this.storageKey,
      } = options;

      if (typeof contrastSuffix !== "string" || contrastSuffix.length === 0) {
        logError(
          `contrastSuffix must be a non-empty string; got "${contrastSuffix}". Keeping previous value "${this.contrastSuffix}".`,
        );
      } else {
        this.contrastSuffix = contrastSuffix;
      }

      this.persist = !!persist;
      this.storageKey = storageKey;

      // Register each supplied token with its initial value as the default.
      Object.entries(tokens).forEach(([name, value]) => {
        this.register(name, value);
      });

      // If persistence is enabled, any previously-saved values override
      // the newly-registered defaults.
      if (this.persist) {
        this.loadPersisted();
      }

      this.initialised = true;
      logInfo(`Initialised with ${this.tokens.size} token(s).`);
    }

    /**
     * Register a new token with its default value. Also applies it immediately.
     * Safe to call after init() to add further tokens.
     */
    register(name, value) {
      if (!this.isValidTokenName(name)) {
        logError(
          `Invalid token name "${name}". Must start with "--" and contain only valid custom property characters.`,
        );
        return false;
      }

      this.defaults.set(name, value);
      const applied = this.applyToken(name, value);
      if (applied) {
        logDebug(`Registered token ${name} = ${value}`);
      }
      return applied;
    }

    /**
     * Update a token's current value. If the token wasn't previously
     * registered, it's auto-registered (with a warning).
     */
    set(name, value) {
      if (!this.isValidTokenName(name)) {
        logError(`Invalid token name "${name}".`);
        return false;
      }

      if (!this.defaults.has(name)) {
        logWarn(
          `Token "${name}" was not registered via init() or register(); auto-registering with current value as the default.`,
        );
        this.defaults.set(name, value);
      }

      const applied = this.applyToken(name, value);
      if (applied && this.persist) {
        this.persistTokens();
      }
      return applied;
    }

    /**
     * Read the current value of a token.
     */
    get(name) {
      return this.tokens.get(name);
    }

    /**
     * List all registered token names.
     */
    list() {
      return Array.from(this.tokens.keys());
    }

    /**
     * Reset a single token to its default, or (with no argument) reset all
     * tokens and clear persistence.
     */
    reset(name) {
      if (name === undefined) {
        this.defaults.forEach((defaultValue, tokenName) => {
          this.applyToken(tokenName, defaultValue);
        });
        if (this.persist) {
          this.clearPersisted();
        }
        logInfo("All tokens reset to defaults.");
        return true;
      }

      const defaultValue = this.defaults.get(name);
      if (defaultValue === undefined) {
        logWarn(`Cannot reset unknown token "${name}".`);
        return false;
      }

      const applied = this.applyToken(name, defaultValue);
      if (applied && this.persist) {
        this.persistTokens();
      }
      logInfo(`Token ${name} reset to default.`);
      return applied;
    }

    /**
     * Subscribe to token-change events.
     * @param {Function} callback Receives { name, value, contrast } on each change.
     * @returns {Function} An unsubscribe function.
     */
    onChange(callback) {
      if (typeof callback !== "function") {
        logError("onChange requires a function.");
        return () => {};
      }
      this.listeners.add(callback);
      logDebug(`Listener added (${this.listeners.size} total).`);
      return () => {
        this.listeners.delete(callback);
        logDebug(`Listener removed (${this.listeners.size} total).`);
      };
    }

    /**
     * Remove every registered listener. Useful in test teardown.
     */
    clearListeners() {
      this.listeners.clear();
      logDebug("All listeners cleared.");
    }

    /**
     * Public contrast-compute utility. Works for any CSS colour string.
     * Returns '#ffffff' or '#000000'. Ties go to white, matching the
     * behaviour specified for the CSS contrast-color() function.
     */
    computeContrastFor(colour) {
      const rgb = this.parseColour(colour);
      if (!rgb) {
        logWarn(
          `Could not parse colour "${colour}"; defaulting contrast to white.`,
        );
        return "#ffffff";
      }
      return this.computeContrast(rgb);
    }

    // ====== Internal helpers ======

    isValidTokenName(name) {
      return (
        typeof name === "string" &&
        /^--[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)
      );
    }

    /**
     * Apply a token value: sets both the primary variable and its contrast
     * companion on :root, updates internal state, notifies listeners.
     */
    applyToken(name, value) {
      const rgb = this.parseColour(value);
      if (!rgb) {
        logError(`Invalid colour value "${value}" for token ${name}.`);
        return false;
      }

      const contrastValue = this.computeContrast(rgb);
      const contrastName = name + this.contrastSuffix;

      this.tokens.set(name, value);

      // documentElement is always present, even before DOMContentLoaded,
      // so it's safe to setProperty() from anywhere in the page lifecycle.
      const root = document.documentElement;
      if (root) {
        root.style.setProperty(name, value);
        root.style.setProperty(contrastName, contrastValue);
      } else {
        logWarn(
          "documentElement is not available; variables were tracked internally but not applied to the DOM.",
        );
      }

      this.notifyListeners({ name, value, contrast: contrastValue });
      logDebug(
        `Applied ${name} = ${value} (contrast ${contrastValue} -> ${contrastName}).`,
      );
      return true;
    }

    notifyListeners(change) {
      this.listeners.forEach((callback) => {
        try {
          callback(change);
        } catch (error) {
          logError(`Listener threw an error: ${error.message}`);
        }
      });
    }

    /**
     * Normalise any valid CSS colour string to {r, g, b} in 0–255.
     * Uses a canvas 2D context which natively parses every supported
     * colour syntax (hex, rgb(), hsl(), named colours, oklch(), etc.).
     * Returns null for invalid input.
     */
    parseColour(input) {
      if (typeof input !== "string" || !input.trim()) return null;

      // Lazily create and reuse the canvas context to keep the cost low.
      if (!this._parseCtx) {
        try {
          this._parseCtx = document
            .createElement("canvas")
            .getContext("2d");
        } catch (error) {
          logError(`Could not create canvas for colour parsing: ${error.message}`);
          return null;
        }
      }

      // Set a sentinel first. If `input` is invalid, the canvas silently
      // ignores the assignment and fillStyle keeps the sentinel value —
      // that's how we detect failure.
      const sentinel = "#f1f1f0";
      this._parseCtx.fillStyle = sentinel;
      try {
        this._parseCtx.fillStyle = input.trim();
      } catch (error) {
        return null;
      }

      const normalised = this._parseCtx.fillStyle;
      if (
        normalised === sentinel &&
        input.trim().toLowerCase() !== sentinel
      ) {
        return null;
      }

      // Canvas normalises to either '#rrggbb' (opaque) or 'rgba(r, g, b, a)'
      // (with alpha). Both are easy to parse.
      if (normalised.startsWith("#")) {
        return {
          r: parseInt(normalised.slice(1, 3), 16),
          g: parseInt(normalised.slice(3, 5), 16),
          b: parseInt(normalised.slice(5, 7), 16),
        };
      }

      const match = normalised.match(/rgba?\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(",").map((s) => parseFloat(s.trim()));
        if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
          return { r: parts[0], g: parts[1], b: parts[2] };
        }
      }

      return null;
    }

    /**
     * WCAG 2 relative luminance for an sRGB colour in {r, g, b} 0–255.
     * https://www.w3.org/WAI/GL/wiki/Relative_luminance
     */
    relativeLuminance(rgb) {
      const toLinear = (channel) => {
        const c = channel / 255;
        return c <= 0.03928
          ? c / 12.92
          : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return (
        0.2126 * toLinear(rgb.r) +
        0.7152 * toLinear(rgb.g) +
        0.0722 * toLinear(rgb.b)
      );
    }

    contrastRatio(L1, L2) {
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Pick whichever of white or black has the higher WCAG 2 contrast ratio
     * against the given colour. Ties favour white, matching contrast-color().
     */
    computeContrast(rgb) {
      const L = this.relativeLuminance(rgb);
      const whiteContrast = this.contrastRatio(L, 1);
      const blackContrast = this.contrastRatio(L, 0);
      return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
    }

    // ====== Persistence ======

    persistTokens() {
      if (typeof localStorage === "undefined") {
        logDebug("localStorage not available; skipping persistence.");
        return;
      }
      try {
        const data = {};
        this.tokens.forEach((value, name) => {
          data[name] = value;
        });
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        logDebug(`Persisted ${Object.keys(data).length} token(s).`);
      } catch (error) {
        logWarn(`Could not persist tokens: ${error.message}`);
      }
    }

    loadPersisted() {
      if (typeof localStorage === "undefined") return;
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        let loaded = 0;
        Object.entries(data).forEach(([name, value]) => {
          // Only load tokens that were registered via init/register, to
          // avoid silently resurrecting stale entries from old versions.
          if (this.defaults.has(name)) {
            if (this.applyToken(name, value)) loaded += 1;
          }
        });
        if (loaded > 0) {
          logInfo(`Loaded ${loaded} persisted token(s) from localStorage.`);
        }
      } catch (error) {
        logWarn(`Could not load persisted tokens: ${error.message}`);
      }
    }

    clearPersisted() {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(this.storageKey);
        logDebug("Persisted tokens cleared.");
      } catch (error) {
        logWarn(`Could not clear persisted tokens: ${error.message}`);
      }
    }
  }

  // Singleton instance
  const manager = new ContrastColorManager();

  /**
   * Native feature detection for the CSS contrast-color() function.
   * Useful if your CSS branches on @supports but you also want to know
   * at runtime.
   */
  function isSupported() {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("color", "contrast-color(white)")
    );
  }

  // ====== PUBLIC API ======
  const api = {
    // Core
    init: (options) => manager.init(options),
    register: (name, value) => manager.register(name, value),
    set: (name, value) => manager.set(name, value),
    get: (name) => manager.get(name),
    reset: (name) => manager.reset(name),
    list: () => manager.list(),

    // Utilities
    contrast: (colour) => manager.computeContrastFor(colour),
    isSupported,

    // Events
    onChange: (callback) => manager.onChange(callback),
    clearListeners: () => manager.clearListeners(),

    // Logging control
    setLogLevel,
    getLogLevel: () => currentLogLevel,
    LOG_LEVELS,

    // For debugging / advanced use
    _manager: manager,
  };

  logInfo(
    `Universal Contrast Colour module loaded (native contrast-color() ${
      isSupported() ? "supported" : "not supported"
    }).`,
  );

  return api;
})();

// ====== MODULE EXPORT ======
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalContrastColor;
}

// ====== GLOBALS ======
window.UniversalContrastColor = UniversalContrastColor;

// British-spelling alias for consistency with the rest of our codebase.
window.UniversalContrastColour = UniversalContrastColor;

// Handy one-liner for computing a contrast-safe foreground anywhere, without
// needing to register the colour as a token first.
window.contrastFor = UniversalContrastColor.contrast;

console.log(
  "🎨 Universal Contrast Colour system ready",
);
