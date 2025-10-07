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
 * Drawing configuration constants
 * @const {Object}
 * @property {string} strokeColor - Colour for drawn strokes (always black for visibility)
 * @property {number} lineWidth - Width of drawn lines in pixels
 * @property {string} lineCap - Line ending style for smooth appearance
 * @property {string} lineJoin - Line joining style for smooth corners
 */
const DRAWING_CONFIG = {
  strokeColor: "#000000",
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
 * Gets default canvas size based on viewport width
 * @returns {string} Default size name
 */
function getDefaultSize() {
  const viewportWidth = window.innerWidth;

  if (viewportWidth < 768) {
    return "small"; // Mobile: 400×200
  } else if (viewportWidth < 1024) {
    return "medium"; // Tablet: 600×300
  } else if (viewportWidth < 1400) {
    return "large"; // Desktop: 800×400
  } else {
    return "xlarge"; // Large desktop: 1000×500
  }
}

/**
 * Default canvas size (viewport-responsive)
 * @const {string}
 */
const DEFAULT_SIZE = getDefaultSize();

/**
 * localStorage key for canvas size preference
 * @const {string}
 */
const CANVAS_SIZE_STORAGE_KEY = "mathpix-canvas-size";

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

      // Set up resize observer to detect when user resizes container
      this.setupResizeObserver();

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
    this.context.strokeStyle = DRAWING_CONFIG.strokeColor;
    this.context.lineWidth = DRAWING_CONFIG.lineWidth;
    this.context.lineCap = DRAWING_CONFIG.lineCap;
    this.context.lineJoin = DRAWING_CONFIG.lineJoin;
    logDebug("Drawing style configured");
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
        this.resizeCanvas(DEFAULT_SIZE, false);
        logDebug(`Applied default canvas size: ${DEFAULT_SIZE}`);
      }
    } catch (error) {
      logWarn("Could not load canvas size preference:", error);
      this.resizeCanvas(DEFAULT_SIZE, false);
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

    // Save preference if requested
    if (savePreference) {
      this.saveCanvasSizePreference(sizeName);
    }

    // Update size button states
    this.updateSizeButtonStates();

    logInfo(
      `Canvas resized to ${sizeName} (${newSize.width}×${newSize.height})`
    );
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
   * visual feedback for users.
   *
   * @accessibility Updates aria-pressed state for screen readers
   *
   * @since 1.0.0
   */
  updateSizeButtonStates() {
    const sizeButtons = document.querySelectorAll(".mathpix-size-btn");

    sizeButtons.forEach((button) => {
      const buttonSize = button.dataset.size;
      const isActive = buttonSize === this.currentSize;

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive.toString());
    });

    logDebug(`Size button states updated: active=${this.currentSize}`);
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
    if (!this.canvas) return;

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
