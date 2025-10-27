/**
 * @fileoverview Canvas drawing interface for MathPix handwriting recognition
 * @module MathPixStrokesCanvas
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides canvas-based drawing interface for capturing handwritten mathematics.
 * Handles mouse and touch input, stroke capture, coordinate management, and
 * formatting for the MathPix Strokes API.
 *
 * Key Features:
 * - Mouse and touch drawing support
 * - Stroke capture with coordinate arrays
 * - Canvas clearing and undo functionality
 * - API-ready stroke formatting
 * - Button state management
 * - WCAG 2.2 AA accessibility foundation
 *
 * Integration:
 * - Extends MathPixBaseModule for controller integration
 * - Coordinates with MathPixModeSwitcher for mode management
 * - Provides stroke data to MathPixStrokesAPIClient
 *
 * Accessibility:
 * - Alternative input method available (Upload mode)
 * - Clear aria labels and instructions
 * - Keyboard-accessible controls
 */

import MathPixBaseModule from "./mathpix-base-module.js";

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if logging should occur at the specified level
 * @private
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should occur
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * Logs warning messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * Logs informational messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * Logs debug messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * Theme-based stroke colours
 * @const {Object}
 * @property {string} light - Dark pen colour for light backgrounds
 * @property {string} dark - Light pen colour for dark backgrounds
 */
const THEME_STROKE_COLORS = {
  light: "#00131D", // Dark pen on light background
  dark: "#E1E8EC", // Light pen on dark background
};

/**
 * Gets the appropriate stroke colour based on current theme
 * @returns {string} Hex colour code for stroke
 * @description
 * Reads theme preference from localStorage (set by boilerplate.html theme toggle)
 * and returns the corresponding stroke colour for optimal visibility.
 */
function getThemeAwareStrokeColor() {
  const themePref = localStorage.getItem("theme");

  // If theme is explicitly set to "Dark", use light pen colour
  if (themePref === "Dark") {
    logDebug(
      "Using light stroke colour for dark theme:",
      THEME_STROKE_COLORS.dark
    );
    return THEME_STROKE_COLORS.dark;
  }

  // Default to dark pen colour for light theme
  logDebug(
    "Using dark stroke colour for light theme:",
    THEME_STROKE_COLORS.light
  );
  return THEME_STROKE_COLORS.light;
}

/**
 * Drawing configuration constants
 * @const {Object}
 * @property {Function} getStrokeColor - Function returning theme-aware stroke colour
 * @property {number} lineWidth - Width of drawn lines in pixels
 * @property {string} lineCap - Line ending style for smooth appearance
 * @property {string} lineJoin - Line joining style for smooth corners
 */
const DRAWING_CONFIG = {
  getStrokeColor: getThemeAwareStrokeColor,
  lineWidth: 3,
  lineCap: "round",
  lineJoin: "round",
};

/**
 * Canvas size presets
 * @const {Object}
 * @property {Object} small - Small canvas size (400×200px)
 * @property {Object} medium - Medium canvas size (600×300px)
 * @property {Object} large - Large canvas size (800×400px) - default
 * @property {Object} xlarge - Extra large canvas size (1000×500px)
 */
const CANVAS_SIZES = {
  small: { width: 400, height: 200, label: "Small" },
  medium: { width: 600, height: 300, label: "Medium" },
  large: { width: 800, height: 400, label: "Large" },
  xlarge: { width: 1000, height: 500, label: "Extra Large" },
};

/**
 * Gets default canvas size based on viewport dimensions
 *
 * @returns {string} Default size name
 *
 * @description
 * Provides viewport-based fallback when DOM buttons aren't available.
 * Considers both width and height to ensure canvas fits comfortably.
 *
 * Size Selection Logic:
 * - xlarge (1000×500): Viewport ≥1400px wide AND ≥700px tall
 * - large (800×400): Viewport ≥1100px wide AND ≥600px tall
 * - medium (600×300): Viewport ≥700px wide AND ≥500px tall
 * - small (400×200): All other cases
 *
 * @since 1.0.0
 * @updated Phase 2A - Added height constraints
 */
function getDefaultSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // xlarge: 1000×500 needs ~1400px width and ~700px height
  if (viewportWidth >= 1400 && viewportHeight >= 700) {
    return "xlarge";
  }

  // large: 800×400 needs ~1100px width and ~600px height
  if (viewportWidth >= 1100 && viewportHeight >= 600) {
    return "large";
  }

  // medium: 600×300 needs ~700px width and ~500px height
  if (viewportWidth >= 700 && viewportHeight >= 500) {
    return "medium";
  }

  // small: 400×200 - fallback for all other cases
  return "small";
}

/**
 * Static fallback canvas size (used as last resort)
 * @const {string}
 */
const DEFAULT_SIZE = "large";

// localStorage removed - always use responsive defaults based on viewport

/**
 * @class MathPixStrokesCanvas
 * @extends MathPixBaseModule
 * @description
 * Canvas drawing interface for capturing handwritten mathematics input.
 * Manages stroke capture, coordinate tracking, and formatting for the
 * MathPix Strokes API.
 *
 * Implements mouse and touch event handling with proper coordinate conversion,
 * provides undo/clear functionality, and maintains button state based on
 * stroke availability.
 *
 * @example
 * const canvas = new MathPixStrokesCanvas(controller);
 * await canvas.initialise(canvasElement);
 * canvas.attachEventListeners();
 *
 * // After drawing
 * const apiData = canvas.formatForAPI();
 *
 * @since 1.0.0
 */
class MathPixStrokesCanvas extends MathPixBaseModule {
  /**
   * Creates a new strokes canvas instance
   *
   * @param {Object} controller - Main MathPix controller instance
   * @throws {Error} When controller reference is not provided
   *
   * @since 1.0.0
   */
  constructor(controller) {
    super(controller);

    /**
     * Canvas DOM element reference
     * @type {HTMLCanvasElement|null}
     */
    this.canvas = null;

    /**
     * 2D drawing context
     * @type {CanvasRenderingContext2D|null}
     */
    this.context = null;

    /**
     * Array of captured strokes
     * Each stroke is an object with x and y coordinate arrays
     * @type {Array<{x: number[], y: number[]}>}
     */
    this.strokes = [];

    /**
     * Currently active stroke being drawn
     * @type {{x: number[], y: number[]}|null}
     */
    this.currentStroke = null;

    /**
     * Flag indicating if currently drawing
     * @type {boolean}
     */
    this.isDrawing = false;

    /**
     * Last drawn point for continuous line drawing
     * @type {{x: number, y: number}|null}
     */
    this.lastPoint = null;

    /**
     * Flag indicating if event listeners are attached
     * @type {boolean}
     */
    this.hasEventListeners = false;

    /**
     * Current canvas size preset name
     * @type {string}
     */
    this.currentSize = DEFAULT_SIZE;

    /**
     * ResizeObserver instance for detecting container size changes
     * @type {ResizeObserver|null}
     */
    this.resizeObserver = null;

    /**
     * Flag to allow container resize responses
     * Disabled during init to prevent override of responsive defaults
     * @type {boolean}
     * @since Phase 2A
     */
    this.allowContainerResize = false;

    logDebug("MathPixStrokesCanvas instance created");
  }

  /**
   * Initialises the canvas with a DOM element
   *
   * @param {HTMLCanvasElement} canvasElement - Canvas element to initialise
   * @returns {Promise<boolean>} True if initialisation successful
   * @throws {Error} When canvas element is invalid or 2D context unavailable
   *
   * @description
   * Sets up the canvas for drawing by obtaining the 2D context, configuring
   * drawing style, and preparing for event listener attachment.
   * Intelligently selects largest visible canvas size based on CSS media queries.
   *
   * @example
   * const canvasElement = document.getElementById('mathDrawCanvas');
   * await canvas.initialise(canvasElement);
   *
   * @since 1.0.0
   */
  async initialise(canvasElement) {
    logInfo("Initialising strokes canvas...");

    try {
      if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
        throw new Error("Valid canvas element required");
      }

      this.canvas = canvasElement;
      this.context = canvasElement.getContext("2d");

      if (!this.context) {
        throw new Error("Canvas 2D context not available");
      }

      this.configureDrawingStyle();

      // Intelligently select largest visible canvas size
      const intelligentSize = this.selectLargestVisibleSize();

      if (intelligentSize === null) {
        // Viewport too small for presets - use auto-fit instead
        logInfo(
          `Canvas initialising with auto-fit mode (${window.innerWidth}×${window.innerHeight}px viewport too small for presets)`
        );

        // Use fitToViewport if available, otherwise fallback to smallest preset
        if (typeof this.fitToViewport === "function") {
          // Temporarily set a minimal size first, then fit to viewport
          this.canvas.width = 300;
          this.canvas.height = 150;
          this.configureDrawingStyle();

          // Use setTimeout to ensure DOM is ready
          setTimeout(() => {
            const fitSuccess = this.fitToViewport();
            if (fitSuccess) {
              logInfo(
                "Auto-fit successful - canvas optimised for constrained viewport"
              );
            } else {
              logWarn("Auto-fit failed - using minimal fallback size");
              this.resizeCanvas("small", false);
            }
          }, 50);
        } else {
          // fitToViewport not available - use smallest preset
          logWarn(
            "fitToViewport method not available - using small preset as fallback"
          );
          this.resizeCanvas("small", false);
        }
      } else {
        // Normal preset-based sizing
        this.resizeCanvas(intelligentSize, false);
        logInfo(
          `Canvas initialised with intelligent size selection: ${intelligentSize} (${window.innerWidth}×${window.innerHeight}px viewport)`
        );
      }

      // Set up resize observer to detect when user resizes container
      this.setupResizeObserver();

      // Enable container resizing now that initialisation is complete
      this.allowContainerResize = true;
      logDebug("Container resize enabled after initialisation");

      this.isInitialised = true;

      logInfo("Strokes canvas initialised successfully");
      return true;
    } catch (error) {
      logError("Canvas initialisation failed:", error);
      this.showNotification(
        "Drawing canvas unavailable. Please try Upload mode.",
        "error"
      );
      throw error;
    }
  }
  /**
   * Configures the 2D context drawing style
   *
   * @private
   * @returns {void}
   *
   * @description
   * Applies standard drawing configuration for consistent stroke appearance.
   *
   * @since 1.0.0
   */
  configureDrawingStyle() {
    this.context.strokeStyle = DRAWING_CONFIG.getStrokeColor();
    this.context.lineWidth = DRAWING_CONFIG.lineWidth;
    this.context.lineCap = DRAWING_CONFIG.lineCap;
    this.context.lineJoin = DRAWING_CONFIG.lineJoin;
    logDebug("Drawing style configured with theme-aware stroke colour");
  }

  /**
   * Updates stroke colour based on current theme
   *
   * @returns {void}
   *
   * @description
   * Call this method if the theme changes whilst the canvas is active.
   * Updates the stroke colour and redraws all existing strokes with the new colour.
   *
   * @example
   * // After user toggles theme in boilerplate.html
   * canvasInstance.updateStrokeColorForTheme();
   *
   * @since 1.0.0
   */
  updateStrokeColorForTheme() {
    if (!this.context) {
      logWarn("Cannot update stroke colour - context not available");
      return;
    }

    // Reconfigure drawing style with new theme colour
    this.configureDrawingStyle();

    // Redraw all existing strokes with new colour
    if (this.strokes.length > 0) {
      this.redrawAllStrokes();
      logInfo(
        `Updated stroke colour for theme change and redrawn ${this.strokes.length} strokes`
      );
    } else {
      logInfo("Updated stroke colour for theme change");
    }
  }

  /**
   * Attaches mouse and touch event listeners to canvas
   *
   * @returns {void}
   *
   * @description
   * Sets up event listeners for both mouse and touch input, enabling
   * drawing on desktop and mobile devices.
   *
   * @accessibility Touch events configured with preventDefault to avoid scrolling
   *
   * @since 1.0.0
   */
  attachEventListeners() {
    if (this.hasEventListeners) {
      logWarn("Event listeners already attached");
      return;
    }

    // Mouse events
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener(
      "mouseleave",
      this.handleMouseLeave.bind(this)
    );

    // Touch events (with passive: false to allow preventDefault)
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: false }
    );
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this), {
      passive: false,
    });

    this.hasEventListeners = true;
    logDebug("Event listeners attached");
  }

  /**
   * Handles mouse down event - starts new stroke
   *
   * @private
   * @param {MouseEvent} event - Mouse event
   * @returns {void}
   *
   * @since 1.0.0
   */
  handleMouseDown(event) {
    const coords = this.getCanvasCoordinates(event);
    this.startStroke(coords.x, coords.y);
  }

  /**
   * Handles mouse move event - continues stroke
   *
   * @private
   * @param {MouseEvent} event - Mouse event
   * @returns {void}
   *
   * @since 1.0.0
   */
  handleMouseMove(event) {
    if (!this.isDrawing) return;

    const coords = this.getCanvasCoordinates(event);
    this.continueStroke(coords.x, coords.y);
  }

  /**
   * Handles mouse up event - finishes stroke
   *
   * @private
   * @param {MouseEvent} event - Mouse event
   * @returns {void}
   *
   * @since 1.0.0
   */
  handleMouseUp(event) {
    if (this.isDrawing) {
      this.finishStroke();
    }
  }

  /**
   * Handles mouse leave event - finishes stroke if drawing
   *
   * @private
   * @param {MouseEvent} event - Mouse event
   * @returns {void}
   *
   * @since 1.0.0
   */
  handleMouseLeave(event) {
    if (this.isDrawing) {
      this.finishStroke();
    }
  }

  /**
   * Handles touch start event - starts new stroke
   *
   * @private
   * @param {TouchEvent} event - Touch event
   * @returns {void}
   *
   * @accessibility Prevents default to avoid page scrolling during drawing
   *
   * @since 1.0.0
   */
  handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const coords = this.getCanvasCoordinates(touch);
    this.startStroke(coords.x, coords.y);
  }

  /**
   * Handles touch move event - continues stroke
   *
   * @private
   * @param {TouchEvent} event - Touch event
   * @returns {void}
   *
   * @accessibility Prevents default to avoid page scrolling during drawing
   *
   * @since 1.0.0
   */
  handleTouchMove(event) {
    event.preventDefault();
    if (!this.isDrawing) return;

    const touch = event.touches[0];
    const coords = this.getCanvasCoordinates(touch);
    this.continueStroke(coords.x, coords.y);
  }

  /**
   * Handles touch end event - finishes stroke
   *
   * @private
   * @param {TouchEvent} event - Touch event
   * @returns {void}
   *
   * @accessibility Prevents default to maintain consistent behaviour
   *
   * @since 1.0.0
   */
  handleTouchEnd(event) {
    event.preventDefault();
    if (this.isDrawing) {
      this.finishStroke();
    }
  }

  /**
   * Starts a new stroke at the specified coordinates
   *
   * @private
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {void}
   *
   * @since 1.0.0
   */
  startStroke(x, y) {
    this.isDrawing = true;
    this.currentStroke = { x: [x], y: [y] };
    this.lastPoint = { x, y };
    logDebug(`Started stroke at (${x}, ${y})`);
  }

  /**
   * Continues current stroke with new point
   *
   * @private
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {void}
   *
   * @since 1.0.0
   */
  continueStroke(x, y) {
    if (!this.currentStroke || !this.lastPoint) return;

    // Add point to current stroke
    this.currentStroke.x.push(x);
    this.currentStroke.y.push(y);

    // Draw line from last point to current point
    this.drawLine(this.lastPoint, { x, y });

    // Update last point
    this.lastPoint = { x, y };
  }

  /**
   * Finishes current stroke and adds to strokes array
   *
   * @private
   * @returns {void}
   *
   * @description
   * Completes the current stroke, adds it to the strokes array,
   * resets drawing state, and updates button states.
   *
   * @since 1.0.0
   */
  finishStroke() {
    if (!this.currentStroke) return;

    // Only save strokes with multiple points
    if (this.currentStroke.x.length > 1) {
      this.strokes.push(this.currentStroke);
      logDebug(
        `Finished stroke with ${this.currentStroke.x.length} points. Total strokes: ${this.strokes.length}`
      );
    } else {
      logDebug("Stroke discarded (single point)");
    }

    // Reset drawing state
    this.isDrawing = false;
    this.currentStroke = null;
    this.lastPoint = null;

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Converts mouse/touch event coordinates to canvas coordinates
   *
   * @private
   * @param {MouseEvent|Touch} event - Event with client coordinates
   * @returns {{x: number, y: number}} Canvas coordinates
   *
   * @description
   * Converts screen coordinates to canvas coordinates using getBoundingClientRect
   * to account for canvas position and size.
   *
   * @since 1.0.0
   */
  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    };
  }

  /**
   * Draws a line between two points on canvas
   *
   * @private
   * @param {{x: number, y: number}} from - Starting point
   * @param {{x: number, y: number}} to - Ending point
   * @returns {void}
   *
   * @since 1.0.0
   */
  drawLine(from, to) {
    this.context.beginPath();
    this.context.moveTo(from.x, from.y);
    this.context.lineTo(to.x, to.y);
    this.context.stroke();
  }

  /**
   * Removes the last stroke and redraws canvas
   *
   * @returns {void}
   *
   * @description
   * Removes the most recent stroke from the array, clears the canvas,
   * and redraws all remaining strokes. Updates button states.
   *
   * @example
   * canvas.undoLastStroke();
   *
   * @since 1.0.0
   */
  undoLastStroke() {
    if (this.strokes.length === 0) {
      logWarn("No strokes to undo");
      return;
    }

    this.strokes.pop();
    logDebug(`Undo performed. Remaining strokes: ${this.strokes.length}`);

    // Only redraw if canvas is initialized
    if (this.canvas && this.context) {
      this.redrawAllStrokes();
    }
    this.updateButtonStates();
  }

  /**
   * Clears all strokes and canvas
   *
   * @returns {void}
   *
   * @description
   * Removes all strokes from the array, clears the canvas completely,
   * and updates button states.
   *
   * @example
   * canvas.clearAllStrokes();
   *
   * @since 1.0.0
   */
  clearAllStrokes() {
    this.strokes = [];

    // Only clear canvas if initialized
    if (this.canvas && this.context) {
      this.clearCanvas();
    }

    this.updateButtonStates();
    logDebug("All strokes cleared");
  }

  /**
   * Clears the canvas drawing surface
   *
   * @private
   * @returns {void}
   *
   * @since 1.0.0
   */
  clearCanvas() {
    if (!this.canvas || !this.context) {
      logWarn("Cannot clear canvas - not initialized");
      return;
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Redraws all saved strokes on canvas
   *
   * @private
   * @returns {void}
   *
   * @description
   * Clears canvas and redraws all strokes from the strokes array.
   * Used after undo operations.
   *
   * @since 1.0.0
   */
  redrawAllStrokes() {
    if (!this.canvas || !this.context) {
      logWarn("Cannot redraw strokes - canvas not initialized");
      return;
    }

    this.clearCanvas();

    for (const stroke of this.strokes) {
      this.drawStroke(stroke);
    }

    logDebug(`Redrawn ${this.strokes.length} strokes`);
  }

  /**
   * Draws a complete stroke on canvas
   *
   * @private
   * @param {{x: number[], y: number[]}} stroke - Stroke with coordinate arrays
   * @returns {void}
   *
   * @since 1.0.0
   */
  drawStroke(stroke) {
    if (!stroke || stroke.x.length < 2) return;

    this.context.beginPath();
    this.context.moveTo(stroke.x[0], stroke.y[0]);

    for (let i = 1; i < stroke.x.length; i++) {
      this.context.lineTo(stroke.x[i], stroke.y[i]);
    }

    this.context.stroke();
  }

  /**
   * Formats captured strokes for MathPix API
   *
   * @returns {Object} Formatted stroke data for API submission
   * @returns {Object} returns.strokes - Stroke data container
   * @returns {Object} returns.strokes.strokes - Nested strokes object
   * @returns {Array<number[]>} returns.strokes.strokes.x - X coordinate arrays
   * @returns {Array<number[]>} returns.strokes.strokes.y - Y coordinate arrays
   *
   * @description
   * Transforms internal stroke format to MathPix API expected format.
   * Internal format: Array of {x: [], y: []} objects
   * API format: {strokes: {strokes: {x: [[]], y: [[]]}}}
   *
   * @example
   * const apiData = canvas.formatForAPI();
   * // Returns: {strokes: {strokes: {x: [[...], [...]], y: [[...], [...]]}}}
   *
   * @since 1.0.0
   */
  formatForAPI() {
    const formatted = {
      strokes: {
        strokes: {
          x: this.strokes.map((stroke) => stroke.x),
          y: this.strokes.map((stroke) => stroke.y),
        },
      },
    };

    logDebug("Formatted strokes for API:", {
      strokeCount: this.strokes.length,
      totalPoints: this.strokes.reduce((sum, s) => sum + s.x.length, 0),
    });

    return formatted;
  }

  /**
   * Updates button states based on stroke availability
   *
   * @private
   * @returns {void}
   *
   * @description
   * Enables/disables undo, clear, and submit buttons based on whether
   * strokes are available.
   *
   * @accessibility Ensures buttons are appropriately disabled for keyboard users
   *
   * @since 1.0.0
   */
  updateButtonStates() {
    const hasStrokes = this.hasStrokes();

    const undoBtn = document.getElementById("mathpix-undo-stroke-btn");
    const clearBtn = document.getElementById("mathpix-clear-canvas-btn");
    const submitBtn = document.getElementById("mathpix-submit-strokes-btn");

    if (undoBtn) undoBtn.disabled = !hasStrokes;
    if (clearBtn) clearBtn.disabled = !hasStrokes;
    if (submitBtn) submitBtn.disabled = !hasStrokes;

    logDebug(`Button states updated: ${hasStrokes ? "enabled" : "disabled"}`);
  }

  /**
   * Checks if canvas has any strokes
   *
   * @returns {boolean} True if strokes exist
   *
   * @example
   * if (canvas.hasStrokes()) {
   *   canvas.formatForAPI();
   * }
   *
   * @since 1.0.0
   */
  hasStrokes() {
    return this.strokes.length > 0;
  }

  /**
   * Gets the number of captured strokes
   *
   * @returns {number} Number of strokes
   *
   * @example
   * console.log(`Captured ${canvas.getStrokeCount()} strokes`);
   *
   * @since 1.0.0
   */
  getStrokeCount() {
    return this.strokes.length;
  }

  /**
   * Gets total number of points across all strokes
   *
   * @returns {number} Total point count
   *
   * @since 1.0.0
   */
  getTotalPoints() {
    return this.strokes.reduce((sum, stroke) => sum + stroke.x.length, 0);
  }

  /**
   * Loads canvas size preference from localStorage
   *
   * @private
   * @returns {void}
   *
   * @description
   * Retrieves saved canvas size preference and applies it to the canvas.
   * Falls back to default size if no preference saved or invalid size.
   *
   * @since 1.0.0
   */
  loadCanvasSizePreference() {
    try {
      const savedSize = localStorage.getItem(CANVAS_SIZE_STORAGE_KEY);

      if (savedSize && CANVAS_SIZES[savedSize]) {
        this.resizeCanvas(savedSize, false); // Don't save during load
        logDebug(`Loaded canvas size preference: ${savedSize}`);
      } else {
        // No saved preference - use responsive default based on current viewport
        const responsiveDefault = getDefaultSize();
        this.resizeCanvas(responsiveDefault, false);
        logDebug(
          `Applied responsive default canvas size: ${responsiveDefault} for viewport ${window.innerWidth}px`
        );
      }
    } catch (error) {
      logWarn("Could not load canvas size preference:", error);
      // Use responsive default as fallback
      const responsiveDefault = getDefaultSize();
      this.resizeCanvas(responsiveDefault, false);
    }
  }

  /**
   * Saves canvas size preference to localStorage
   *
   * @private
   * @param {string} sizeName - Size preset name to save
   * @returns {void}
   *
   * @since 1.0.0
   */
  saveCanvasSizePreference(sizeName) {
    try {
      localStorage.setItem(CANVAS_SIZE_STORAGE_KEY, sizeName);
      logDebug(`Saved canvas size preference: ${sizeName}`);
    } catch (error) {
      logWarn("Could not save canvas size preference:", error);
    }
  }

  /**
   * Resizes the canvas to specified preset size
   *
   * @param {string} sizeName - Size preset name ('small', 'medium', 'large', 'xlarge')
   * @param {boolean} [savePreference=true] - Whether to save size to localStorage
   * @returns {boolean} True if resize successful
   *
   * @description
   * Resizes canvas while preserving existing strokes by scaling coordinates.
   * Updates canvas dimensions, scales all stroke coordinates proportionally,
   * and redraws everything.
   *
   * @example
   * canvas.resizeCanvas('xlarge'); // Resize to extra large with save
   * canvas.resizeCanvas('small', false); // Resize without saving preference
   *
   * @since 1.0.0
   */
  resizeCanvas(sizeName, savePreference = true) {
    if (!CANVAS_SIZES[sizeName]) {
      logError(`Invalid canvas size: ${sizeName}`);
      return false;
    }

    if (!this.canvas) {
      logError("Cannot resize - canvas not initialised");
      return false;
    }

    const newSize = CANVAS_SIZES[sizeName];
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;

    logInfo(
      `Resizing canvas from ${oldWidth}×${oldHeight} to ${newSize.width}×${newSize.height}`
    );

    // Calculate scaling factors
    const scaleX = newSize.width / oldWidth;
    const scaleY = newSize.height / oldHeight;

    // Scale all existing strokes
    if (this.strokes.length > 0) {
      this.scaleStrokes(scaleX, scaleY);
      logDebug(`Scaled ${this.strokes.length} strokes`);
    }

    // Update canvas dimensions
    this.canvas.width = newSize.width;
    this.canvas.height = newSize.height;

    // Reconfigure drawing style (context settings reset after size change)
    this.configureDrawingStyle();

    // Redraw all strokes with new dimensions
    if (this.strokes.length > 0) {
      this.redrawAllStrokes();
    }

    // Update current size tracking
    this.currentSize = sizeName;

    // No localStorage saving - responsive defaults only

    // Update size button states
    this.updateSizeButtonStates();

    logInfo(
      `Canvas resized to ${sizeName} (${newSize.width}×${newSize.height})`
    );
    return true;
  }

  /**
   * Fits canvas to available container width whilst maintaining aspect ratio
   *
   * @returns {boolean} True if resize successful, false if constraints prevent resize
   *
   * @description
   * Calculates maximum available width in canvas container, determines proportional
   * height based on current canvas aspect ratio, applies intelligent height constraints
   * to prevent vertical overflow, and resizes canvas whilst preserving all existing strokes.
   *
   * Particularly valuable for:
   * - Ultrawide monitors (21:9, 32:9 aspect ratios)
   * - Split-screen browser configurations
   * - Custom window sizes in tiling window managers
   * - Maximising workspace for complex mathematical expressions
   *
   * Height Constraint Logic:
   * - Calculates available viewport height minus controls (400px buffer)
   * - If proportional height exceeds safe maximum, caps height and recalculates width
   * - Ensures canvas never pushes essential controls below viewport
   *
   * @example
   * // User clicks "Fit to Width" button
   * canvas.fitToWidth();
   * // Canvas expands from 800×400 to 2400×1200 on ultrawide monitor
   *
   * @since Phase 2B.1
   */
  fitToWidth() {
    if (!this.canvas) {
      logError("Cannot fit to width - canvas not initialised");
      return false;
    }

    logInfo("Calculating fit-to-width dimensions...");

    try {
      // Get wrapper boundaries for enforcement
      const wrapper = this.canvas.closest(".mathpix-canvas-wrapper");
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : null;
      const wrapperMaxWidth = wrapperRect
        ? Math.floor(wrapperRect.width - 50)
        : null;

      // Get available container width (accounting for padding/margins)
      const availableWidth = this.calculateAvailableWidth();

      if (availableWidth < 200) {
        logWarn("Available width too small for fit-to-width operation");
        this.showNotification(
          "Canvas cannot be expanded - container width insufficient",
          "warning"
        );
        return false;
      }

      // STRATEGY: Maximize width whilst preserving current height
      // CRITICAL: Cap width to wrapper boundaries
      let targetWidth = Math.round(availableWidth); // Safety margin already included in calculation

      // Enforce wrapper boundary constraint
      if (wrapperMaxWidth && targetWidth > wrapperMaxWidth) {
        logWarn(
          `Calculated width ${targetWidth}px exceeds wrapper maximum ${wrapperMaxWidth}px - capping to safe value`
        );
        targetWidth = wrapperMaxWidth;
      }

      const targetHeight = this.canvas.height; // Keep current height unchanged

      logDebug(
        `Fit-to-width strategy: maximize width (${targetWidth}px), preserve height at ${targetHeight}px`
      );

      // Validate final dimensions
      if (targetWidth < 200 || targetHeight < 100) {
        logWarn(
          `Calculated dimensions too small: ${targetWidth}×${targetHeight}`
        );
        this.showNotification(
          "Canvas cannot be resized - viewport too small",
          "warning"
        );
        return false;
      }

      // Check if width is meaningfully different from current
      const widthDiff = Math.abs(targetWidth - this.canvas.width);

      if (widthDiff < 10) {
        logInfo("Canvas already near optimal fit-to-width size");
        this.showNotification(
          "Canvas is already maximised for available width",
          "info"
        );
        return true; // Not an error, just already optimal
      }

      logInfo(
        `Applying fit-to-width: ${this.canvas.width}×${this.canvas.height} → ${targetWidth}×${targetHeight} (width expanded, height preserved, wrapper boundary enforced)`
      );

      // Use helper method to apply custom dimensions with stroke preservation
      const success = this.resizeToCustomDimensions(targetWidth, targetHeight);

      if (success) {
        // Post-resize validation
        const canvasRect = this.canvas.getBoundingClientRect();
        if (wrapperRect && canvasRect.right > wrapperRect.right) {
          logWarn(
            `Canvas overflow detected after resize: canvas right=${canvasRect.right.toFixed(
              1
            )}px exceeds wrapper right=${wrapperRect.right.toFixed(1)}px`
          );
        }

        this.showNotification(
          `Canvas fitted to width: ${targetWidth}×${targetHeight}px`,
          "success"
        );
      }

      return success;
    } catch (error) {
      logError("Fit-to-width operation failed:", error);
      this.showNotification(
        "Canvas resize failed. Please try a preset size.",
        "error"
      );
      return false;
    }
  }

  /**
   * Fits canvas to maximum browser viewport space whilst maintaining aspect ratio
   *
   * @returns {boolean} True if resize successful
   *
   * @description
   * Maximises canvas size using full browser viewport width rather than being
   * constrained by container limitations. Provides significantly larger canvas
   * area compared to fit-to-width operation.
   *
   * Features:
   * - Uses viewport width instead of container width (850px vs 304px typical)
   * - Maintains current aspect ratio (height/width)
   * - Applies intelligent height constraint (viewport - 400px buffer)
   * - Validates dimensions before applying
   * - Checks if already near-optimal (< 10px difference)
   * - Preserves all existing strokes via coordinate scaling
   * - Provides user feedback via notifications
   *
   * Comparison with fitToWidth():
   * - fitToWidth(): Constrained by container (typically ~304px)
   * - fitToViewport(): Uses full viewport (typically ~850px)
   * - Provides 2.8× more width for drawing
   *
   * @example
   * // Maximise canvas to viewport
   * canvas.fitToViewport();
   *
   * @since Phase 2B.2
   */
  fitToViewport() {
    if (!this.canvas) {
      logError("Cannot fit to viewport - canvas not initialised");
      return false;
    }

    logInfo("Calculating fit-to-viewport dimensions...");

    try {
      // CRITICAL: Viewport fit must respect wrapper boundaries
      // Get wrapper boundaries for enforcement
      const wrapper = this.canvas.closest(".mathpix-canvas-wrapper");
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : null;
      const wrapperMaxWidth = wrapperRect
        ? Math.floor(wrapperRect.width - 50)
        : null;

      // Get maximum usable viewport space (accounting for margins/padding)
      const viewportSpace = this.calculateViewportSpace();

      if (viewportSpace.width < 200) {
        logWarn("Viewport width too small for fit-to-viewport operation");
        this.showNotification(
          "Canvas cannot be expanded - viewport too small",
          "warning"
        );
        return false;
      }

      // STRATEGY: Maximize width using available space, but cap to wrapper boundaries
      // This prevents overflow whilst providing maximum drawing space
      let targetWidth = Math.round(viewportSpace.width); // Safety margin already included in calculation

      // CRITICAL: Enforce wrapper boundary constraint
      if (wrapperMaxWidth && targetWidth > wrapperMaxWidth) {
        logWarn(
          `Calculated width ${targetWidth}px exceeds wrapper maximum ${wrapperMaxWidth}px - capping to wrapper boundary`
        );
        targetWidth = wrapperMaxWidth;
      }

      const targetHeight = this.canvas.height; // Keep current height unchanged

      logDebug(
        `Fit-to-viewport strategy: maximize width (${targetWidth}px, capped to wrapper), preserve height at ${targetHeight}px`
      );

      // Validate final dimensions
      if (targetWidth < 200 || targetHeight < 100) {
        logWarn(
          `Calculated dimensions too small: ${targetWidth}×${targetHeight}`
        );
        this.showNotification(
          "Canvas cannot be resized - viewport too small",
          "warning"
        );
        return false;
      }

      // Check if width is meaningfully different from current
      const widthDiff = Math.abs(targetWidth - this.canvas.width);

      if (widthDiff < 10) {
        logInfo("Canvas already near optimal fit-to-viewport size");
        this.showNotification(
          "Canvas is already maximised for available space",
          "info"
        );
        return true; // Not an error, just already optimal
      }

      logInfo(
        `Applying fit-to-viewport: ${this.canvas.width}×${this.canvas.height} → ${targetWidth}×${targetHeight} (width maximised to available space, height preserved, wrapper boundary enforced)`
      );
      logDebug(
        `Space utilisation: ${targetWidth}px (viewport max: ${viewportSpace.width}px, wrapper max: ${wrapperMaxWidth}px)`
      );

      // Use helper method to apply custom dimensions with stroke preservation
      const success = this.resizeToCustomDimensions(targetWidth, targetHeight);

      if (success) {
        // Post-resize validation
        const canvasRect = this.canvas.getBoundingClientRect();
        if (wrapperRect && canvasRect.right > wrapperRect.right) {
          logWarn(
            `Canvas overflow detected after resize: canvas right=${canvasRect.right.toFixed(
              1
            )}px exceeds wrapper right=${wrapperRect.right.toFixed(1)}px`
          );
        }

        this.showNotification(
          `Canvas fitted to maximum available space: ${targetWidth}×${targetHeight}px`,
          "success"
        );
      }

      return success;
    } catch (error) {
      logError("Fit-to-viewport operation failed:", error);
      this.showNotification(
        "Canvas resize failed. Please try a preset size.",
        "error"
      );
      return false;
    }
  }

  /**
   * Calculates usable viewport space for canvas expansion
   *
   * @private
   * @returns {{width: number, height: number}} Usable viewport dimensions in pixels
   *
   * @description
   * Determines maximum available space in the browser viewport for canvas expansion.
   * Accounts for typical page margins, padding, and layout constraints to calculate
   * safe maximum dimensions.
   *
   * Calculation Strategy:
   * - Width: viewport width - conservative margin (50px)
   * - Height: viewport height - controls buffer (400px)
   *
   * This provides significantly more space than container-based calculations
   * (typically 850px vs 304px width), enabling larger drawing areas.
   *
   * @example
   * const space = canvas.calculateViewportSpace();
   * console.log(`Available: ${space.width}×${space.height}px`);
   *
   * @since Phase 2B.2
   */
  calculateViewportSpace() {
    // Get raw viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get wrapper dimensions for boundary enforcement
    const wrapper = this.canvas
      ? this.canvas.closest(".mathpix-canvas-wrapper")
      : null;
    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : null;
    const wrapperWidth = wrapperRect ? wrapperRect.width : viewportWidth;

    // Apply conservative margins to prevent edge overflow
    const marginBuffer = 80; // Horizontal margins/padding across page layout
    const controlsBuffer = 400; // Vertical space for controls, buttons, UI elements

    // Calculate usable space from viewport
    const viewportUsableWidth = Math.max(200, viewportWidth - marginBuffer);
    const usableHeight = Math.max(100, viewportHeight - controlsBuffer);

    // CRITICAL: Cap to wrapper width to prevent overflow
    // The viewport calculation can exceed wrapper boundaries
    const usableWidth = Math.min(viewportUsableWidth, wrapperWidth - 50);

    logDebug(
      `Viewport space calculation: viewport=${viewportWidth}×${viewportHeight}px, ` +
        `wrapper=${wrapperWidth.toFixed(1)}px, ` +
        `viewportUsable=${viewportUsableWidth}px, ` +
        `finalUsable=${usableWidth.toFixed(1)}×${usableHeight}px ` +
        `(capped to wrapper boundary for overflow prevention)`
    );

    return {
      width: usableWidth,
      height: usableHeight,
    };
  }

  /**
   * Calculates available width in canvas container
   *
   * @private
   * @returns {number} Available width in pixels (accounting for padding/margins)
   *
   * @description
   * Measures the canvas container's client width and subtracts horizontal padding
   * to determine actual usable space for canvas expansion.
   *
   * Calculation: clientWidth - (paddingLeft + paddingRight)
   *
   * @since Phase 2B.1
   */
  calculateAvailableWidth() {
    // Target the wrapper element (wider container) instead of immediate parent
    // This allows expansion beyond the canvas-container's artificial constraints
    const wrapper = this.canvas.closest(".mathpix-canvas-wrapper");
    const container = wrapper || this.canvas.parentElement;

    if (!container) {
      logError("Canvas container not found");
      return 0;
    }

    // Use getBoundingClientRect() for accurate rendered dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Get computed styles to read padding, border, and margin values
    const containerStyle = window.getComputedStyle(container);
    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
    const borderLeft = parseFloat(containerStyle.borderLeftWidth) || 0;
    const borderRight = parseFloat(containerStyle.borderRightWidth) || 0;

    // Calculate total horizontal space used by padding and borders
    const horizontalSpace =
      paddingLeft + paddingRight + borderLeft + borderRight;

    // Increased safety margin to prevent overflow (was 30px, now 50px)
    const safetyMargin = 50; // Extra space to ensure canvas stays within bounds

    // Calculate available width using accurate boundary
    const calculatedWidth = containerWidth - horizontalSpace - safetyMargin;

    // Ensure result doesn't exceed wrapper boundaries
    const maxSafeWidth = Math.floor(containerWidth - safetyMargin);
    const availableWidth = Math.min(calculatedWidth, maxSafeWidth);

    logDebug(
      `Available width calculation: element=${container.className}, ` +
        `boundingWidth=${containerWidth.toFixed(1)}px, ` +
        `padding=${paddingLeft + paddingRight}px, ` +
        `borders=${borderLeft + borderRight}px, ` +
        `safety=${safetyMargin}px, ` +
        `calculated=${calculatedWidth.toFixed(1)}px, ` +
        `maxSafe=${maxSafeWidth}px, ` +
        `available=${availableWidth.toFixed(1)}px`
    );

    return Math.max(200, Math.floor(availableWidth)); // Ensure minimum usable width and integer result
  }

  /**
   * Resizes canvas to arbitrary custom dimensions
   *
   * @param {number} width - Target width in pixels
   * @param {number} height - Target height in pixels
   * @returns {boolean} True if resize successful
   *
   * @description
   * Applies custom dimensions to canvas whilst preserving existing strokes
   * through proportional coordinate scaling. Similar to preset size resizing
   * but accepts arbitrary dimensions rather than named presets.
   *
   * Process:
   * 1. Calculate scaling factors (newDimension / oldDimension)
   * 2. Scale all existing stroke coordinates
   * 3. Apply new canvas dimensions
   * 4. Reconfigure drawing style (reset by dimension change)
   * 5. Redraw all strokes at scaled coordinates
   *
   * @example
   * // Resize to specific dimensions
   * canvas.resizeToCustomDimensions(1200, 600);
   *
   * @since Phase 2B.1
   */
  resizeToCustomDimensions(width, height) {
    if (!this.canvas || !this.context) {
      logError("Cannot resize - canvas not initialised");
      return false;
    }

    // Validate dimensions
    if (width < 100 || height < 50 || width > 5000 || height > 5000) {
      logError(`Invalid dimensions: ${width}×${height}`);
      return false;
    }

    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;

    logInfo(
      `Resizing canvas from ${oldWidth}×${oldHeight} to ${width}×${height}`
    );

    // Calculate scaling factors for stroke coordinate transformation
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;

    logDebug(`Scaling factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);

    // Scale existing strokes if any present
    if (this.strokes.length > 0) {
      this.scaleStrokes(scaleX, scaleY);
      logDebug(`Scaled ${this.strokes.length} strokes to new dimensions`);
    }

    // Apply new canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;

    // Reconfigure drawing style (canvas context resets after dimension change)
    this.configureDrawingStyle();

    // Redraw all strokes with scaled coordinates
    if (this.strokes.length > 0) {
      this.redrawAllStrokes();
    }

    // Update current size tracking (no longer matches preset)
    this.currentSize = "custom"; // Indicates non-preset dimensions

    // Update size button states (deactivate all presets)
    this.updateSizeButtonStates();

    logInfo(`Canvas resized successfully to ${width}×${height}`);
    return true;
  }

  /**
   * Scales all stroke coordinates by given factors
   *
   * @private
   * @param {number} scaleX - X-axis scaling factor
   * @param {number} scaleY - Y-axis scaling factor
   * @returns {void}
   *
   * @description
   * Multiplies all stroke coordinates by scaling factors to preserve
   * drawing proportions when canvas size changes.
   *
   * @since 1.0.0
   */
  scaleStrokes(scaleX, scaleY) {
    for (const stroke of this.strokes) {
      stroke.x = stroke.x.map((x) => Math.round(x * scaleX));
      stroke.y = stroke.y.map((y) => Math.round(y * scaleY));
    }
    logDebug(
      `Scaled strokes by factors: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(
        2
      )}`
    );
  }

  /**
   * Updates size button states based on current canvas size
   *
   * @private
   * @returns {void}
   *
   * @description
   * Marks the currently active size button and ensures proper
   * visual feedback for users. Enhanced to handle custom dimensions
   * from fit-to-width and manual resize operations.
   *
   * @accessibility Updates aria-pressed state for screen readers
   *
   * @since 1.0.0
   * @updated Phase 2B.1 - Added custom size support & fit-to-width button
   * @updated Phase 2B.2 - Added fit-to-viewport button support
   */
  updateSizeButtonStates() {
    // Handle preset size buttons (small, medium, large, xlarge)
    const sizeButtons = document.querySelectorAll(".mathpix-size-btn");
    const isCustomSize = this.currentSize === "custom";

    sizeButtons.forEach((button) => {
      const buttonSize = button.dataset.size;

      // Skip fit buttons - they're handled separately below
      if (
        button.id === "mathpix-fit-to-width-btn" ||
        button.id === "mathpix-fit-to-viewport-btn"
      ) {
        return;
      }

      // Only activate preset buttons if we're not in custom mode
      const isActive = !isCustomSize && buttonSize === this.currentSize;

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive.toString());
    });

    // Handle fit buttons (Phase 2B.1 & 2B.2)
    // Note: We cannot distinguish between fit-to-width and fit-to-viewport results
    // since both create custom dimensions. For now, keep both inactive when
    // not immediately after a fit operation, or make both active in custom mode.
    // Better UX: Only the most recently clicked fit button should be active.

    const fitToWidthButton = document.getElementById(
      "mathpix-fit-to-width-btn"
    );
    const fitToViewportButton = document.getElementById(
      "mathpix-fit-to-viewport-btn"
    );

    if (fitToWidthButton) {
      // Fit buttons are "active" when in custom mode (fit operations create custom sizes)
      const isFitActive = isCustomSize;
      fitToWidthButton.classList.toggle("active", isFitActive);
      fitToWidthButton.setAttribute("aria-pressed", isFitActive.toString());

      logDebug(
        `Fit to width button state: ${isFitActive ? "active" : "inactive"}`
      );
    }

    if (fitToViewportButton) {
      // Fit buttons are "active" when in custom mode (fit operations create custom sizes)
      const isFitActive = isCustomSize;
      fitToViewportButton.classList.toggle("active", isFitActive);
      fitToViewportButton.setAttribute("aria-pressed", isFitActive.toString());

      logDebug(
        `Fit to viewport button state: ${isFitActive ? "active" : "inactive"}`
      );
    }

    logDebug(
      `Size button states updated: active=${this.currentSize}, custom=${isCustomSize}`
    );
  }
  /**
   * Gets current canvas size preset name
   *
   * @returns {string} Current size name ('small', 'medium', 'large', 'xlarge')
   *
   * @example
   * console.log(`Current canvas size: ${canvas.getCurrentSize()}`);
   *
   * @since 1.0.0
   */
  getCurrentSize() {
    return this.currentSize;
  }

  /**
   * Gets current canvas dimensions
   *
   * @returns {{width: number, height: number}} Current dimensions in pixels
   *
   * @since 1.0.0
   */
  getCurrentDimensions() {
    return {
      width: this.canvas ? this.canvas.width : 0,
      height: this.canvas ? this.canvas.height : 0,
    };
  }

  /**
   * Gets available canvas size presets
   *
   * @returns {Object} Size presets object
   *
   * @since 1.0.0
   */
  getAvailableSizes() {
    return CANVAS_SIZES;
  }

  /**
   * Intelligently selects the largest visible canvas size option
   *
   * @returns {string|null} Size name of largest visible option, or null if auto-fit needed
   *
   * @description
   * Queries all canvas size buttons and determines which are visible
   * based on CSS media queries. Returns the largest visible size to
   * ensure users always get an appropriate default for their viewport.
   *
   * **Auto-Fit Activation:**
   * If viewport is too small for even the 400×200 preset (< 500px width or < 400px height),
   * returns null to signal that fitToViewport() should be used instead.
   *
   * Falls back through size hierarchy if no buttons are visible:
   * xlarge → large → medium → small → auto-fit
   *
   * @example
   * const bestSize = canvas.selectLargestVisibleSize();
   * if (bestSize === null) {
   *   // Viewport too small - use fitToViewport()
   * }
   *
   * @since Phase 2A
   * @updated Phase 2B - Added auto-fit detection for extremely small viewports
   */
  selectLargestVisibleSize() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if viewport is too small for even the smallest preset (400×200)
    // Thresholds: 500px width (allows 400px + chrome), 400px height (allows 200px + controls)
    if (viewportWidth < 500 || viewportHeight < 400) {
      logInfo(
        `Viewport extremely constrained (${viewportWidth}×${viewportHeight}px) - ` +
          `will use auto-fit instead of presets`
      );
      return null; // Signal to use fitToViewport() instead
    }

    // Size priority order (largest to smallest)
    const sizeHierarchy = ["xlarge", "large", "medium", "small"];

    // Query all canvas size buttons
    const sizeButtons = document.querySelectorAll(
      ".mathpix-size-btn[data-size]"
    );

    if (sizeButtons.length === 0) {
      logWarn("No canvas size buttons found in DOM - using fallback hierarchy");
      // Fallback: use viewport-based selection
      return getDefaultSize();
    }

    // Find all visible buttons (not hidden by CSS media queries)
    const visibleSizes = Array.from(sizeButtons)
      .filter((button) => {
        const computed = window.getComputedStyle(button);
        return computed.display !== "none" && computed.visibility !== "hidden";
      })
      .map((button) => button.dataset.size);

    if (visibleSizes.length === 0) {
      logWarn("No visible canvas size buttons - checking if auto-fit needed");
      // Check viewport constraints again before falling back
      if (viewportWidth < 500 || viewportHeight < 400) {
        logInfo("Auto-fit mode activated due to no visible size options");
        return null; // Use fitToViewport()
      }
      // Ultimate fallback: smallest size
      return "small";
    }

    // Find largest size that's both in hierarchy and visible
    for (const size of sizeHierarchy) {
      if (visibleSizes.includes(size)) {
        logInfo(
          `Selected largest visible canvas size: ${size} (visible options: ${visibleSizes.join(
            ", "
          )})`
        );
        return size;
      }
    }

    // Should never reach here, but provide safe fallback
    logWarn(`Fallback: Using first visible size ${visibleSizes[0]}`);
    return visibleSizes[0];
  }

  /**
   * Intelligently selects the largest visible canvas size option
   *
   * @returns {string} Size name of largest visible option
   *
   * @description
   * Queries all canvas size buttons and determines which are visible
   * based on CSS media queries. Returns the largest visible size to
   * ensure users always get an appropriate default for their viewport.
   *
   * Falls back through size hierarchy if no buttons are visible:
   * xlarge → large → medium → small
   *
   * @example
   * const bestSize = canvas.selectLargestVisibleSize();
   * // Returns: 'large' (if xlarge is hidden by media query)
   *
   * @since Phase 2A
   */
  selectLargestVisibleSize() {
    // Size priority order (largest to smallest)
    const sizeHierarchy = ["xlarge", "large", "medium", "small"];

    // Query all canvas size buttons
    const sizeButtons = document.querySelectorAll(
      ".mathpix-size-btn[data-size]"
    );

    if (sizeButtons.length === 0) {
      logWarn("No canvas size buttons found in DOM - using fallback hierarchy");
      // Fallback: use viewport-based selection
      return getDefaultSize();
    }

    // Find all visible buttons (not hidden by CSS media queries)
    const visibleSizes = Array.from(sizeButtons)
      .filter((button) => {
        const computed = window.getComputedStyle(button);
        return computed.display !== "none" && computed.visibility !== "hidden";
      })
      .map((button) => button.dataset.size);

    if (visibleSizes.length === 0) {
      logWarn(
        "No visible canvas size buttons - viewport may be extremely small"
      );
      // Ultimate fallback: smallest size that should always work
      return "small";
    }

    // Find largest size that's both in hierarchy and visible
    for (const size of sizeHierarchy) {
      if (visibleSizes.includes(size)) {
        logInfo(
          `Selected largest visible canvas size: ${size} (visible options: ${visibleSizes.join(
            ", "
          )})`
        );
        return size;
      }
    }

    // Should never reach here, but provide safe fallback
    logWarn(`Fallback: Using first visible size ${visibleSizes[0]}`);
    return visibleSizes[0];
  }

  /**
   * Sets up ResizeObserver to detect container size changes
   *
   * @private
   * @returns {void}
   *
   * @description
   * Creates a ResizeObserver to monitor the canvas wrapper element.
   * When user finishes resizing (via CSS resize handle), this automatically
   * scales the canvas and preserves strokes.
   *
   * @since 1.0.0
   */
  setupResizeObserver() {
    const canvasWrapper = this.canvas.parentElement;

    if (!canvasWrapper) {
      logWarn("Canvas wrapper not found - resize detection unavailable");
      return;
    }

    // Track last known size to detect actual changes
    let lastWidth = this.canvas.width;
    let lastHeight = this.canvas.height;

    // Create resize observer
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Get new container dimensions
        const newWidth = Math.round(entry.contentRect.width);
        const newHeight = Math.round(entry.contentRect.height);

        // Only resize if dimensions actually changed
        if (newWidth !== lastWidth || newHeight !== lastHeight) {
          logDebug(`Container resized to ${newWidth}×${newHeight}`);
          this.handleContainerResize(newWidth, newHeight);
          lastWidth = newWidth;
          lastHeight = newHeight;
        }
      }
    });

    // Start observing the canvas wrapper
    this.resizeObserver.observe(canvasWrapper);
    logDebug("ResizeObserver attached to canvas wrapper");
  }

  /**
   * Handles container resize event
   *
   * @private
   * @param {number} newWidth - New container width in pixels
   * @param {number} newHeight - New container height in pixels
   * @returns {void}
   *
   * @description
   * Called when user finishes resizing the container. Scales canvas
   * and all strokes to match new dimensions.
   *
   * @since 1.0.0
   */
  handleContainerResize(newWidth, newHeight) {
    // Ignore resize events during initialization
    if (!this.allowContainerResize) {
      logDebug(
        `Container resize ignored during initialization: ${newWidth}×${newHeight}`
      );
      return;
    }

    if (!this.canvas) return;

    // Ignore invalid dimensions (container hidden or not rendered)
    if (newWidth < 100 || newHeight < 100) {
      logDebug(
        `Ignoring invalid container dimensions: ${newWidth}×${newHeight}`
      );
      return;
    }

    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;

    // Don't resize if dimensions haven't meaningfully changed
    if (
      Math.abs(newWidth - oldWidth) < 5 &&
      Math.abs(newHeight - oldHeight) < 5
    ) {
      return;
    }

    // Calculate scaling factors
    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;

    logInfo(
      `Resizing canvas from ${oldWidth}×${oldHeight} to ${newWidth}×${newHeight}`
    );

    // Scale existing strokes if any
    if (this.strokes.length > 0) {
      this.scaleStrokes(scaleX, scaleY);
      logDebug(`Scaled ${this.strokes.length} strokes`);
    }

    // Update canvas dimensions
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    // Reconfigure drawing style (reset after size change)
    this.configureDrawingStyle();

    // Redraw all strokes
    if (this.strokes.length > 0) {
      this.redrawAllStrokes();
    }

    logInfo(`Canvas resized to ${newWidth}×${newHeight}`);
  }

  /**
   * Validates canvas state
   *
   * @returns {boolean} True if canvas is properly configured
   *
   * @description
   * Extends base validation to check canvas-specific requirements.
   *
   * @since 1.0.0
   */
  validate() {
    return (
      super.validate() && !!(this.canvas && this.context && this.isInitialised)
    );
  }

  /**
   * Cleans up canvas resources
   *
   * @returns {void}
   *
   * @description
   * Clears strokes, resets state, disconnects resize observer,
   * and calls parent cleanup.
   *
   * @since 1.0.0
   */
  cleanup() {
    this.clearAllStrokes();
    this.isDrawing = false;
    this.currentStroke = null;
    this.lastPoint = null;

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
      logDebug("ResizeObserver disconnected");
    }

    super.cleanup();
  }

  /**
   * Gets canvas debug information
   *
   * @returns {Object} Debug information including stroke and point counts
   *
   * @since 1.0.0
   */
  getDebugInfo() {
    return {
      ...super.getDebugInfo(),
      strokeCount: this.strokes.length,
      totalPoints: this.getTotalPoints(),
      isDrawing: this.isDrawing,
      hasCanvas: !!this.canvas,
      hasContext: !!this.context,
      hasEventListeners: this.hasEventListeners,
    };
  }
}

export default MathPixStrokesCanvas;
