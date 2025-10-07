/**
 * Chart.js Controls
 * Adds export buttons to charts rendered by markdown-it
 * - Copy code to clipboard
 * - Export as PNG
 * - Palette selection with line styles and patterns
 */

/**
 *
 *  Validation routine tests
 *
 *  // Quick test all charts
 *    PngExportValidator.validateAllCharts(false);
 *
 *  // Get system status
 *  console.log(PngExportValidator.getStatusReport());
 *
 *  // Test with detailed output
 *  PngExportValidator.config.debugMode = true;
 *  PngExportValidator.validateAllCharts(false);
 */

// Add diagnostic logging
console.log("[Chart Controls] Initialising chart controls module");

// Check if debounce is already defined in global scope
if (typeof window.debounce !== "undefined") {
  console.warn(
    "[Chart Controls] Warning: debounce function already exists in global scope"
  );
}

window.ChartControls = (function () {
  // Debug Configuration - Centralised logging control
  const debugConfig = {
    // Master switch - if false, no debug output at all
    enabled: false,

    // Functional area switches
    areas: {
      init: false, // Initialisation and setup
      theme: false, // Theme and palette changes
      export: false, // PNG export functionality
      layout: false, // Container padding adjustments
      scroll: false, // Scroll observer functionality
      mutation: false, // Mutation observer (dynamic chart detection)
      validation: false, // Validation and error handling
      events: false, // Event handling (resize, click, etc.)
      performance: false, // Performance-related logging
      accessibility: false, // Accessibility-related logging
    },

    // Log level filters
    levels: {
      info: true,
      warn: true,
      error: true,
      debug: true,
    },
  };

  /**
   * Centralised debug logging function
   * @param {string} area - The functional area (must match debugConfig.areas)
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data to log
   */
  function debugLog(area, level = "info", message, data = null) {
    // Early return if debugging is disabled globally
    if (!debugConfig.enabled) return;

    // Check if this area is enabled
    if (!debugConfig.areas[area]) return;

    // Check if this level is enabled
    if (!debugConfig.levels[level]) return;

    // Format the message with area and level
    const prefix = `[Chart Controls:${area.toUpperCase()}]`;
    const fullMessage = `${prefix} ${message}`;

    // Choose appropriate console method based on level
    switch (level) {
      case "error":
        if (data) {
          console.error(fullMessage, data);
        } else {
          console.error(fullMessage);
        }
        break;
      case "warn":
        if (data) {
          console.warn(fullMessage, data);
        } else {
          console.warn(fullMessage);
        }
        break;
      case "debug":
        if (data) {
          console.debug(fullMessage, data);
        } else {
          console.debug(fullMessage);
        }
        break;
      default: // 'info'
        if (data) {
          console.log(fullMessage, data);
        } else {
          console.log(fullMessage);
        }
    }
  }

  // Configuration - make it accessible outside the closure
  const configObj = {
    buttonClasses: "chart-control-button",
    copyText: "Copy Code",
    successText: "Copied",
    failText: "Failed to copy",
    pngText: "Save as PNG",
    successDuration: 2000, // Time in ms to show success message
    ariaLiveRegionId: "chart-sr-announcer",
    controlsContainerClass: "chart-controls",
    // Theme-specific default palettes
    defaultPalettes: {
      light: "Okabe and Ito", // Default for light mode
      dark: "Paul Tol Bright", // Default for dark mode
    },
    // Legacy default palette (fallback)
    defaultPalette: "Okabe and Ito",
  };

  // Create a global reference to config
  window._chartControlsConfig = configObj;
  // Also keep a local reference for use within the module
  const config = configObj;

  // Built-in palettes
  const palettes = {
    Summer: {
      backgroundColor: [
        "rgba(255, 99, 132, 0.2)",
        "rgba(54, 162, 235, 0.2)",
        "rgba(255, 206, 86, 0.2)",
        "rgba(75, 192, 192, 0.2)",
        "rgba(153, 102, 255, 0.2)",
        "rgba(255, 159, 64, 0.2)",
      ],
      borderColor: [
        "rgba(255, 99, 132, 1)",
        "rgba(54, 162, 235, 1)",
        "rgba(255, 206, 86, 1)",
        "rgba(75, 192, 192, 1)",
        "rgba(153, 102, 255, 1)",
        "rgba(255, 159, 64, 1)",
      ],
      // Line style configurations
      borderDash: [
        [], // solid (no dash)
        [5, 5], // dashed
        [2, 2], // dotted
        [15, 3, 3, 3], // dash-dot
        [10, 5, 2, 5], // long-dash-short-dash
        [3, 3, 10, 3], // dot-dash-dot
      ],
      // Pattern types for fills
      patterns: [
        "solid", // solid fill
        "lines", // lined pattern
        "dots", // dotted pattern
        "crosses", // cross pattern
        "diagonal", // diagonal lines
        "crosshatch", // crosshatch pattern
      ],
      chartStyle: {
        backgroundColor: "#433737", // Chart background
        gridLinesColor: "#9fb1bd", // Grid lines
        axisColor: "#fffff4", // Axis lines
        textColor: "#fffff4", // Labels
        titleColor: "#fffff4", // Title
        axisTitleColor: "#fffff4", // Axis Titles
        legendTextColor: "#fffff4", // Legend text
        tooltipBackgroundColor: "#fffff4", // Tooltip background
        tooltipTextColor: "#00131D", // Tooltip text
        tooltipBorderColor: "#00131D", // Tooltip border
        subtitleColor: "#fffff4", // Subtitle text colour
        pointStyle: "circle", // Default point style for line/scatter charts
        pointRadius: 4, // Default point size
        pointHoverRadius: 6, // Hover state point size
        focusHighlightColor: "#ffdd00", // Colour for keyboard focus highlighting
        animationDuration: 1000, // Default animation duration
        reducedMotion: 400, // Animation duration when prefers-reduced-motion is set
        annotationBackground: "rgba(255, 255, 255, 0.7)", // Background for annotations
        annotationBorderColor: "#758D9A", // Border for annotations
        annotationTextColor: "#00131D", // Text colour for annotations
      },
    },
    // Colour-blind friendly palettes
    "IBM Design Library": {
      backgroundColor: [
        "rgba(91, 142, 253, 0.2)",
        "rgba(114, 93, 239, 0.2)",
        "rgba(221, 33, 125, 0.2)",
        "rgba(255, 95, 0, 0.2)",
        "rgba(255, 176, 13, 0.2)",
      ],
      borderColor: [
        "rgba(91, 142, 253, 1)",
        "rgba(114, 93, 239, 1)",
        "rgba(221, 33, 125, 1)",
        "rgba(255, 95, 0, 1)",
        "rgba(255, 176, 13, 1)",
      ],
      borderDash: [
        [], // solid
        [5, 5], // dashed
        [2, 2], // dotted
        [15, 3, 3, 3], // dash-dot
        [10, 5, 2, 5], // long-dash-short-dash
      ],
      patterns: ["solid", "lines", "dots", "diagonal", "crosses"],
      chartStyle: {
        backgroundColor: "#1F1E1E",
        gridLinesColor: "#9fb1bd", // Grid lines
        axisColor: "#fffff4", // Axis lines
        textColor: "#fffff4", // Labels
        titleColor: "#fffff4", // Title
        axisTitleColor: "#fffff4", // Axis Titles
        legendTextColor: "#fffff4", // Legend text
        tooltipBackgroundColor: "#fffff4", // Tooltip background
        tooltipTextColor: "#00131D", // Tooltip text
        tooltipBorderColor: "#00131D", // Tooltip border
        subtitleColor: "#fffff4", // Subtitle text colour
        pointStyle: "circle", // Default point style for line/scatter charts
        pointRadius: 4, // Default point size
        pointHoverRadius: 6, // Hover state point size
        focusHighlightColor: "#ffdd00", // Colour for keyboard focus highlighting
        animationDuration: 1000, // Default animation duration
        reducedMotion: 400, // Animation duration when prefers-reduced-motion is set
        annotationBackground: "rgba(255, 255, 255, 0.7)", // Background for annotations
        annotationBorderColor: "#758D9A", // Border for annotations
        annotationTextColor: "#00131D", // Text colour for annotations
      },
    },
    "Paul Tol Bright": {
      backgroundColor: [
        "rgba(238, 102, 119, 0.2)",
        "rgba(68, 119, 170, 0.2)",
        "rgba(34, 136, 51, 0.2)",
        "rgba(102, 204, 238, 0.2)",
        "rgba(204, 187, 68, 0.2)",
        "rgba(170, 51, 119, 0.2)",
        "rgba(187, 187, 187, 0.2)",
      ],
      borderColor: [
        "rgba(238, 102, 119, 1)",
        "rgba(68, 119, 170, 1)",
        "rgba(34, 136, 51, 1)",
        "rgba(102, 204, 238, 1)",
        "rgba(204, 187, 68, 1)",
        "rgba(170, 51, 119, 1)",
        "rgba(187, 187, 187, 1)",
      ],
      borderDash: [
        [], // solid
        [5, 5], // dashed
        [2, 2], // dotted
        [15, 3, 3, 3], // dash-dot
        [10, 5, 2, 5], // long-dash-short-dash
        [3, 3, 10, 3], // dot-dash-dot
      ],
      patterns: ["solid", "lines", "dots", "diagonal", "crosses", "crosshatch"],
      chartStyle: {
        backgroundColor: "#05052E", // White background
        gridLinesColor: "#9fb1bd", // Grid lines
        axisColor: "#fffff4", // Axis lines
        textColor: "#fffff4", // Labels
        titleColor: "#fffff4", // Title
        axisTitleColor: "#fffff4", // Axis Titles
        legendTextColor: "#fffff4", // Legend text
        tooltipBackgroundColor: "#fffff4", // Tooltip background
        tooltipTextColor: "#00131D", // Tooltip text
        tooltipBorderColor: "#00131D", // Tooltip border
        subtitleColor: "#fffff4", // Subtitle text colour
        pointStyle: "circle", // Default point style for line/scatter charts
        pointRadius: 4, // Default point size
        pointHoverRadius: 6, // Hover state point size
        focusHighlightColor: "#ffdd00", // Colour for keyboard focus highlighting
        animationDuration: 1000, // Default animation duration
        reducedMotion: 400, // Animation duration when prefers-reduced-motion is set
        annotationBackground: "rgba(255, 255, 255, 0.7)", // Background for annotations
        annotationBorderColor: "#758D9A", // Border for annotations
        annotationTextColor: "#00131D", // Text colour for annotations
      },
    },
    "Okabe and Ito": {
      backgroundColor: [
        "rgba(240, 228, 66, 0.2)",
        "rgba(0, 158, 115, 0.2)",
        "rgba(86, 180, 233, 0.2)",
        "rgba(230, 159, 0, 0.2)",
        "rgba(204, 121, 167, 0.2)",
        "rgba(0, 114, 178, 0.2)",
        "rgba(213, 94, 0, 0.2)",
      ],
      borderColor: [
        "rgba(240, 228, 66, 1)",
        "rgba(0, 158, 115, 1)",
        "rgba(86, 180, 233, 1)",
        "rgba(230, 159, 0, 1)",
        "rgba(204, 121, 167, 1)",
        "rgba(0, 114, 178, 1)",
        "rgba(213, 94, 0, 1)",
      ],
      borderDash: [
        [], // solid
        [5, 5], // dashed
        [2, 2], // dotted
        [15, 3, 3, 3], // dash-dot
        [10, 5, 2, 5], // long-dash-short-dash
        [3, 3, 10, 3], // dot-dash-dot
        [2, 5, 8, 5], // dot-long-dash
        [10, 2, 5, 2], // long-dash-dot-dot
      ],
      patterns: [
        "solid",
        "lines",
        "dots",
        "diagonal",
        "crosses",
        "crosshatch",
        "solid",
        "lines",
      ],
      chartStyle: {
        backgroundColor: "#2E0505", // Dark background was 2E0505, 130101
        gridLinesColor: "#9fb1bd", // Grid lines
        axisColor: "#fffff4", // Axis lines
        textColor: "#fffff4", // Labels
        titleColor: "#fffff4", // Title
        axisTitleColor: "#fffff4", // Axis Titles
        legendTextColor: "#fffff4", // Legend text
        tooltipBackgroundColor: "#fffff4", // Tooltip background
        tooltipTextColor: "#00131D", // Tooltip text
        tooltipBorderColor: "#00131D", // Tooltip border
        subtitleColor: "#fffff4", // Subtitle text colour
        pointStyle: "circle", // Default point style for line/scatter charts
        pointRadius: 4, // Default point size
        pointHoverRadius: 6, // Hover state point size
        focusHighlightColor: "#ffdd00", // Colour for keyboard focus highlighting
        animationDuration: 1000, // Default animation duration
        reducedMotion: 400, // Animation duration when prefers-reduced-motion is set
        annotationBackground: "rgba(255, 255, 255, 0.7)", // Background for annotations
        annotationBorderColor: "#758D9A", // Border for annotations
        annotationTextColor: "#00131D", // Text colour for annotations
      },
    },
  };

  // Utility functions
  const Utils = {
    /**
     * Get the default value for a preference - no longer using localStorage
     * @param {string} key - The preference key (now unused)
     * @param {*} defaultValue - Default value to return
     * @returns {*} The default value
     */
    getSavedPreference: function (key, defaultValue) {
      // Simply return the default value since we're not using localStorage
      return defaultValue;
    },

    /**
     * No-op function to replace localStorage saving - logs but does nothing
     * @param {string} key - The preference key (now unused)
     * @param {*} value - Value to "save" (now unused)
     * @returns {boolean} Always returns true
     */
    savePreference: function (key, value) {
      // Log for debugging but do nothing
      debugLog(
        "init",
        "debug",
        `Not saving preference "${key}" - localStorage disabled`
      );
      return true;
    },

    /**
     * Find chart containers without controls
     * @param {HTMLElement} rootNode - Node to search within
     * @returns {Array} Array of containers without controls
     */
    findContainersWithoutControls: function (rootNode) {
      const allContainers = rootNode.querySelectorAll(".chart-container");
      return Array.from(allContainers).filter(
        (container) => !container.querySelector(".chart-controls")
      );
    },

    /**
     * Detect if the site is currently using dark theme
     * @returns {boolean} True if dark theme is active
     */
    isDarkThemeActive: function () {
      // First check localStorage for explicit theme preference
      try {
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme) {
          const isDark = storedTheme === "Dark";
          debugLog(
            "theme",
            "info",
            `Theme detected from localStorage: ${storedTheme}`
          );
          return isDark;
        }
      } catch (e) {
        debugLog("theme", "warn", "Error accessing localStorage", e);
      }

      // Check for theme attribute on modeToggle button (if site uses that pattern)
      const modeToggle = document.getElementById("modeToggle");
      if (modeToggle && modeToggle.getAttribute("aria-pressed") === "true") {
        debugLog(
          "theme",
          "info",
          "Dark theme active based on modeToggle button"
        );
        return true;
      }

      // Fall back to system preference
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      debugLog(
        "theme",
        "info",
        `Using system preference: ${systemPrefersDark ? "dark" : "light"}`
      );
      return systemPrefersDark;
    },

    /**
     * Get the appropriate default palette based on current site theme
     * @returns {string} Palette name
     */
    getDefaultPaletteForCurrentMode: function () {
      const isDark = this.isDarkThemeActive();
      const paletteToUse = isDark
        ? config.defaultPalettes.dark
        : config.defaultPalettes.light;

      debugLog(
        "theme",
        "info",
        `Current mode is: ${isDark ? "dark" : "light"}`
      );
      debugLog(
        "theme",
        "info",
        `Default palette for this mode: ${paletteToUse}`
      );

      return paletteToUse;
    },
  };

  /**
   * Create a canvas pattern for chart fills
   * @param {string} patternType - Type of pattern to create
   * @param {string} color - Base colour for the pattern
   * @param {string|null} chartType - The type of chart (optional)
   * @returns {CanvasPattern} - Pattern object for Chart.js
   */
  function createPattern(patternType, color, chartType = null) {
    // Create a small canvas for the pattern
    const patternCanvas = document.createElement("canvas");
    const patternContext = patternCanvas.getContext("2d");

    // Adjust size based on chart type - larger sizes for better visibility
    let size = 16; // Default pattern size (matches your previous implementation)

    if (chartType === "bubble") {
      size = 12; // Smaller patterns for bubbles but not too small
    } else if (chartType === "scatter") {
      size = 20; // Larger for scatter points for better visibility
    } else if (chartType === "radar") {
      size = 18; // Slightly larger for radar areas
    } else if (chartType === "stackedLine") {
      size = 20; // Larger patterns for stacked line areas
    }

    patternCanvas.width = size;
    patternCanvas.height = size;

    // Parse the colour to extract rgba values
    let r = 0,
      g = 0,
      b = 0,
      a = 1;
    if (typeof color === "string") {
      if (color.startsWith("rgba")) {
        const parts = color.match(
          /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
        );
        if (parts) {
          r = parseInt(parts[1]);
          g = parseInt(parts[2]);
          b = parseInt(parts[3]);
          a = parseFloat(parts[4]);

          // Increase alpha for better visibility, while preserving some transparency
          a = Math.min(a * 1.5, 0.9);

          // For stacked lines, adjust opacity based on pattern type
          if (chartType === "stackedLine") {
            // Set slightly higher opacity for stacked lines to make them more distinct
            a = Math.min(a * 1.8, 0.95);
          }
        }
      } else if (color.startsWith("rgb")) {
        const parts = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (parts) {
          r = parseInt(parts[1]);
          g = parseInt(parts[2]);
          b = parseInt(parts[3]);
        }
      } else {
        // For hex and named colours, use colour parsing
        const tempDiv = document.createElement("div");
        tempDiv.style.color = color;
        document.body.appendChild(tempDiv);

        // Get computed style to extract RGB values
        const computedColor = window.getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);

        const parts = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (parts) {
          r = parseInt(parts[1]);
          g = parseInt(parts[2]);
          b = parseInt(parts[3]);
        }
      }
    }

    // Create a semi-transparent background of the same colour
    patternContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;

    // For stacked lines, use slightly more opaque background
    if (chartType === "stackedLine") {
      patternContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
    }

    patternContext.fillRect(0, 0, size, size);

    // Draw the pattern with a stronger stroke/fill
    patternContext.strokeStyle = `rgba(${r}, ${g}, ${b}, ${
      chartType === "scatter"
        ? "0.95"
        : chartType === "stackedLine"
        ? "0.95"
        : "0.85"
    })`; // Higher contrast for scatter and stacked lines

    patternContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${
      chartType === "scatter"
        ? "0.95"
        : chartType === "stackedLine"
        ? "0.95"
        : "0.85"
    })`; // Higher contrast for scatter and stacked lines

    // Adjust line width based on chart type
    let lineWidth = 2; // Default thicker lines for better visibility

    if (chartType === "bubble") {
      lineWidth = 1.5; // Slightly thinner for small patterns
    } else if (chartType === "scatter") {
      lineWidth = 3; // Thicker lines for scatter plot patterns
    } else if (chartType === "radar") {
      lineWidth = 2.5; // Slightly thicker for radar
    } else if (chartType === "stackedLine") {
      lineWidth = 2.5; // Thicker lines for stacked line charts
    }

    patternContext.lineWidth = lineWidth;

    switch (patternType) {
      case "lines":
        // For stacked line charts, use more prominent horizontal lines
        if (chartType === "stackedLine") {
          patternContext.beginPath();
          const lineSpacing = size / 2.5; // Slightly closer spacing for stacked areas
          for (let y = lineSpacing / 2; y < size; y += lineSpacing) {
            patternContext.moveTo(0, y);
            patternContext.lineTo(size, y);
          }
          patternContext.stroke();
        }
        // For scatter plots, use fewer, more distinct lines
        else if (chartType === "scatter") {
          patternContext.beginPath();
          const lineSpacing = size / 2; // Fewer, more visible lines
          for (let y = lineSpacing / 2; y < size; y += lineSpacing) {
            patternContext.moveTo(0, y);
            patternContext.lineTo(size, y);
          }
          patternContext.stroke();
        } else {
          // Horizontal lines - more visible with multiple lines
          patternContext.beginPath();
          const lineSpacing = size / 3;
          for (let y = lineSpacing / 2; y < size; y += lineSpacing) {
            patternContext.moveTo(0, y);
            patternContext.lineTo(size, y);
          }
          patternContext.stroke();
        }
        break;

      case "dots":
        // For stacked line charts, use distinct dot pattern
        if (chartType === "stackedLine") {
          const dotRadius = size / 5; // Larger dots for stacked areas
          const dotSpacing = size / 2.5;
          for (let x = dotSpacing / 2; x < size; x += dotSpacing) {
            for (let y = dotSpacing / 2; y < size; y += dotSpacing) {
              patternContext.beginPath();
              patternContext.arc(x, y, dotRadius, 0, Math.PI * 2);
              patternContext.fill();
            }
          }
        }
        // For scatter plots, use larger dots in pattern
        else if (chartType === "scatter") {
          const dotRadius = size / 6; // Larger dots for scatter
          const dotSpacing = size / 2; // Fewer dots with more space
          for (let x = dotSpacing / 2; x < size; x += dotSpacing) {
            for (let y = dotSpacing / 2; y < size; y += dotSpacing) {
              patternContext.beginPath();
              patternContext.arc(x, y, dotRadius, 0, Math.PI * 2);
              patternContext.fill();
            }
          }
        } else {
          // Dotted pattern - multiple dots for visibility
          const dotRadius = Math.max(size / 12, 1.5); // Ensure dots are visible
          const dotSpacing = size / 3;
          for (let x = dotSpacing / 2; x < size; x += dotSpacing) {
            for (let y = dotSpacing / 2; y < size; y += dotSpacing) {
              patternContext.beginPath();
              patternContext.arc(x, y, dotRadius, 0, Math.PI * 2);
              patternContext.fill();
            }
          }
        }
        break;

      case "crosses":
        // For stacked line charts, use more distinct cross pattern
        if (chartType === "stackedLine") {
          patternContext.beginPath();
          // Primary cross
          patternContext.moveTo(size / 2, 0);
          patternContext.lineTo(size / 2, size);
          patternContext.moveTo(0, size / 2);
          patternContext.lineTo(size, size / 2);
          patternContext.stroke();

          // Smaller offset crosses for more texture
          patternContext.beginPath();
          patternContext.lineWidth = lineWidth * 0.7; // Thinner lines for offset crosses
          patternContext.moveTo(size / 4, size / 4);
          patternContext.lineTo((size * 3) / 4, (size * 3) / 4);
          patternContext.moveTo((size * 3) / 4, size / 4);
          patternContext.lineTo(size / 4, (size * 3) / 4);
          patternContext.stroke();
        }
        // Cross pattern - thicker lines for scatter plots
        else if (chartType === "scatter") {
          patternContext.beginPath();
          patternContext.moveTo(size / 2, 0);
          patternContext.lineTo(size / 2, size);
          patternContext.moveTo(0, size / 2);
          patternContext.lineTo(size, size / 2);
          patternContext.stroke();

          // Add diagonal lines for more visibility
          patternContext.beginPath();
          patternContext.moveTo(0, 0);
          patternContext.lineTo(size, size);
          patternContext.moveTo(size, 0);
          patternContext.lineTo(0, size);
          patternContext.stroke();
        } else {
          // Cross pattern - thicker lines
          patternContext.beginPath();
          patternContext.moveTo(size / 2, 0);
          patternContext.lineTo(size / 2, size);
          patternContext.moveTo(0, size / 2);
          patternContext.lineTo(size, size / 2);
          patternContext.stroke();
        }
        break;

      case "diagonal":
        // For stacked line charts, use more distinct diagonal lines
        if (chartType === "stackedLine") {
          patternContext.beginPath();
          // Primary diagonal lines
          patternContext.moveTo(0, 0);
          patternContext.lineTo(size, size);
          patternContext.moveTo(0, size);
          patternContext.lineTo(size, 0);
          patternContext.stroke();

          // Optional: Secondary diagonal lines for more texture
          patternContext.beginPath();
          patternContext.lineWidth = lineWidth * 0.6; // Thinner lines
          const offset = size / 3;
          patternContext.moveTo(offset, 0);
          patternContext.lineTo(size, size - offset);
          patternContext.moveTo(0, offset);
          patternContext.lineTo(size - offset, size);
          patternContext.stroke();
        }
        // Diagonal lines - bolder and fewer for scatter plots
        else if (chartType === "scatter") {
          patternContext.beginPath();
          patternContext.moveTo(0, 0);
          patternContext.lineTo(size, size);
          patternContext.moveTo(0, size);
          patternContext.lineTo(size, 0);
          patternContext.stroke();
        } else {
          // Diagonal lines - multiple lines for better visibility
          patternContext.beginPath();
          const diagonalSpacing = size / 2;
          for (let i = -size; i < size * 2; i += diagonalSpacing) {
            patternContext.moveTo(i, 0);
            patternContext.lineTo(i + size, size);
          }
          patternContext.stroke();
        }
        break;

      case "crosshatch":
        // For stacked line charts, use more distinct crosshatch
        if (chartType === "stackedLine") {
          patternContext.beginPath();
          // First set of diagonals (positive slope)
          for (let i = -size / 3; i < size * 1.3; i += size / 2) {
            patternContext.moveTo(i, 0);
            patternContext.lineTo(i + size, size);
          }
          // Second set of diagonals (negative slope)
          for (let i = -size / 3; i < size * 1.3; i += size / 2) {
            patternContext.moveTo(i + size, 0);
            patternContext.lineTo(i, size);
          }
          patternContext.stroke();
        }
        // Crosshatch pattern - bolder for scatter
        else if (chartType === "scatter") {
          patternContext.beginPath();
          // Bolder lines for scatter plots
          patternContext.moveTo(0, 0);
          patternContext.lineTo(size, size);
          patternContext.moveTo(size, 0);
          patternContext.lineTo(0, size);
          patternContext.stroke();

          // Add perpendicular lines for more visibility
          patternContext.beginPath();
          patternContext.moveTo(size / 2, 0);
          patternContext.lineTo(size / 2, size);
          patternContext.moveTo(0, size / 2);
          patternContext.lineTo(size, size / 2);
          patternContext.stroke();
        } else {
          // Crosshatch pattern - more visible
          patternContext.beginPath();
          // First set of diagonals
          for (let i = -size / 2; i < size * 1.5; i += size / 2) {
            patternContext.moveTo(i, 0);
            patternContext.lineTo(i + size, size);
          }
          // Second set of diagonals (perpendicular)
          for (let i = -size / 2; i < size * 1.5; i += size / 2) {
            patternContext.moveTo(i + size, 0);
            patternContext.lineTo(i, size);
          }
          patternContext.stroke();
        }
        break;

      default:
        // Fallback to solid
        patternContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        // For stacked line charts, use higher opacity for solid fill
        if (chartType === "stackedLine") {
          patternContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        }
        patternContext.fillRect(0, 0, size, size);
    }

    try {
      // Create and return the pattern
      return patternContext.createPattern(patternCanvas, "repeat");
    } catch (e) {
      debugLog("theme", "error", "Error creating pattern", e);
      return color; // Fallback to original colour
    }
  }

  /**
   * Initialise controls on all Chart.js diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      debugLog("init", "warn", "No container provided");
      return;
    }

    // Find all Chart.js containers
    const chartContainers = container.querySelectorAll(".chart-container");
    if (chartContainers.length === 0) return;

    debugLog(
      "init",
      "info",
      `Adding controls to ${chartContainers.length} charts`
    );

    // Add controls to each chart
    chartContainers.forEach((container, index) => {
      addControlsToContainer(container, index);
    });
  }

  /**
   * Add control buttons to a Chart container
   * @param {HTMLElement} container - The Chart container element
   * @param {number} index - Index for unique IDs
   */
  function addControlsToContainer(container, index) {
    // Skip if already processed
    if (container.querySelector(".chart-controls")) return;

    debugLog("init", "debug", `Adding controls to container ${index}`);

    // Get the chart code (original source) from data attribute
    const encodedCode = container.getAttribute("data-chart-code") || "{}";
    const originalCode = decodeURIComponent(encodedCode);

    // Find the canvas element for the chart
    const canvasElement = container.querySelector("canvas");
    if (!canvasElement) {
      debugLog("init", "warn", "No canvas found in chart container");
      return;
    }

    // Ensure container has proper positioning
    container.style.position = "relative";

    // Create controls container
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "chart-controls";
    controlsContainer.setAttribute("role", "toolbar");
    controlsContainer.setAttribute("aria-label", "Chart export options");

    // Create palette selector
    const paletteContainer = document.createElement("div");
    paletteContainer.className = "chart-palette-container";

    const paletteLabel = document.createElement("label");
    paletteLabel.textContent = "Theme:";
    paletteLabel.className = "chart-palette-label";
    paletteLabel.setAttribute("for", `chart-palette-${index}`);

    const paletteSelect = document.createElement("select");
    paletteSelect.id = `chart-palette-${index}`;
    paletteSelect.className = "chart-palette-select";
    paletteSelect.setAttribute("aria-label", "Change chart colour palette");

    // Add palette options
    Object.keys(palettes).forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      paletteSelect.appendChild(option);
    });

    // Get saved palette preference or use default based on theme mode
    const savedPalette = Utils.getDefaultPaletteForCurrentMode();
    paletteSelect.value = savedPalette;

    // Add event listener for palette changes
    paletteSelect.addEventListener("change", function () {
      const newPalette = this.value;
      debugLog("events", "info", `Palette changed to: ${newPalette}`);
      // Apply the new palette to the chart
      applyPalette(container, canvasElement, newPalette);
    });

    // Create copy button
    const copyButton = document.createElement("button");
    copyButton.className = "chart-control-button";
    copyButton.innerHTML = `${getCopyButtonIcon()} Copy Code`;
    copyButton.setAttribute("aria-label", "Copy chart code to clipboard");
    copyButton.setAttribute("type", "button");
    copyButton.setAttribute("data-chart-index", index);

    // Add event listener for copy button
    copyButton.addEventListener("click", function () {
      debugLog("events", "info", "Copy button clicked");

      // Enhanced copy functionality - extract from chart instance
      const canvas = container.querySelector("canvas");
      const chartInstance = canvas ? Chart.getChart(canvas) : null;

      if (!chartInstance) {
        debugLog("events", "error", "No chart instance found for copy");
        updateButtonStatus(copyButton, false, "No chart found");
        return;
      }

      try {
        // Extract complete chart configuration
        const chartConfig = {
          type: chartInstance.config.type,
          data: {
            labels: [...chartInstance.data.labels], // Create copy to avoid mutations
            datasets: chartInstance.data.datasets.map((dataset) => ({
              label: dataset.label,
              data: [...dataset.data],
              backgroundColor: dataset.backgroundColor,
              borderColor: dataset.borderColor,
              borderWidth: dataset.borderWidth,
              // Include any other dataset properties
              ...Object.fromEntries(
                Object.entries(dataset).filter(
                  ([key]) =>
                    ![
                      "label",
                      "data",
                      "backgroundColor",
                      "borderColor",
                      "borderWidth",
                    ].includes(key)
                )
              ),
            })),
          },
          options: JSON.parse(JSON.stringify(chartInstance.options)), // Deep copy
        };

        // Format the configuration nicely
        const formattedCode = JSON.stringify(chartConfig, null, 2);

        debugLog(
          "events",
          "info",
          "Chart configuration extracted successfully"
        );

        // Enhanced clipboard functionality with reliable fallback
        enhancedCopyToClipboard(formattedCode, copyButton);
      } catch (error) {
        debugLog(
          "events",
          "error",
          "Failed to extract chart configuration",
          error
        );
        updateButtonStatus(copyButton, false, "Copy failed");
      }
    });

    // ADD THIS NEW FUNCTION TO chart-controls.js (after the copyCodeToClipboard function):

    /**
     * Enhanced copy to clipboard with reliable fallback
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - The button that was clicked
     */
    function enhancedCopyToClipboard(text, button) {
      debugLog("events", "debug", "Starting enhanced clipboard copy operation");

      // Try modern Clipboard API first (with proper error handling)
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            updateButtonStatus(button, true, "Copied!");
            announceToScreenReader("Chart code copied to clipboard");
            debugLog("events", "info", "Clipboard API copy successful");
          })
          .catch((error) => {
            debugLog(
              "events",
              "warn",
              "Clipboard API failed, using fallback:",
              error.name
            );
            // Always use fallback for reliability
            fallbackCopyToClipboard(text, button);
          });
      } else {
        // Use fallback directly if Clipboard API not available
        debugLog("events", "info", "Using fallback copy method");
        fallbackCopyToClipboard(text, button);
      }
    }

    /**
     * Reliable fallback copy method using deprecated but stable execCommand
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - The button that was clicked
     */
    function fallbackCopyToClipboard(text, button) {
      try {
        // Create temporary textarea element
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        textarea.style.top = "-999999px";
        textarea.style.opacity = "0";
        textarea.setAttribute("readonly", "");
        textarea.setAttribute("aria-hidden", "true");

        // Add to DOM
        document.body.appendChild(textarea);

        // Focus and select content
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile devices

        // Copy using execCommand (deprecated but reliable)
        let successful = false;
        try {
          successful = document.execCommand("copy");
          debugLog("events", "debug", "execCommand copy result:", successful);
        } catch (err) {
          debugLog("events", "error", "execCommand copy failed:", err);
        }

        // Clean up
        document.body.removeChild(textarea);

        // Update button status
        updateButtonStatus(
          button,
          successful,
          successful ? "Copied!" : "Copy failed"
        );

        if (successful) {
          announceToScreenReader("Chart code copied to clipboard");
          debugLog("events", "info", "Fallback copy successful");
        } else {
          debugLog("events", "error", "All copy methods failed");
        }
      } catch (error) {
        debugLog("events", "error", "Fallback copy method failed:", error);
        updateButtonStatus(button, false, "Copy failed");
      }
    }

    // Create PNG export button
    const pngButton = document.createElement("button");
    pngButton.className = "chart-control-button";
    pngButton.innerHTML = `${getPngButtonIcon()} Save as PNG`;
    pngButton.setAttribute("aria-label", "Download chart as PNG");
    pngButton.setAttribute("type", "button");
    pngButton.setAttribute("data-chart-index", index);

    // Add event listener for PNG button
    pngButton.addEventListener("click", function () {
      debugLog("events", "info", "PNG export button clicked");
      exportAsPng(container, canvasElement, index);
    });

    // Add palette selector to container
    paletteContainer.appendChild(paletteLabel);
    paletteContainer.appendChild(paletteSelect);

    // Add all elements to the controls container
    controlsContainer.appendChild(paletteContainer);
    controlsContainer.appendChild(copyButton);
    controlsContainer.appendChild(pngButton);

    // Add controls to the container
    container.appendChild(controlsContainer);

    // Set a data attribute to mark this container for resize handling
    container.setAttribute("data-has-chart-controls", "true");

    // Initial padding adjustment
    setTimeout(() => {
      adjustContainerPadding(container);
    }, 100);

    // Apply the current palette
    applyPalette(container, canvasElement, savedPalette);

    // Validate PNG export for newly created chart (if enabled)
    if (PngExportValidator.config.validateOnInit) {
      setTimeout(() => {
        PngExportValidator.validatePngExport(
          container,
          canvasElement,
          true
        ).catch((error) =>
          debugLog("validation", "warn", "Initial validation failed", error)
        );
      }, 1000); // Longer delay for initial chart setup
    }
  }

  /**
   * Adjust the opacity of a colour
   * @param {string|Object} color - The colour to adjust (hex, rgb, rgba, or pattern object)
   * @param {number} opacity - The target opacity (0-1)
   * @returns {string|Object} The colour with adjusted opacity
   */
  function adjustColorOpacity(color, opacity) {
    // If colour is not a string (could be a pattern object or null), return it unchanged
    if (!color || typeof color !== "string") {
      return color;
    }

    // Now we know colour is a string, we can use string methods

    // If already an rgba colour, just update the opacity
    if (color.startsWith("rgba")) {
      return color.replace(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/,
        `rgba($1, $2, $3, ${opacity})`
      );
    }

    // If rgb colour, convert to rgba
    if (color.startsWith("rgb(")) {
      return color.replace(
        /rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
        `rgba($1, $2, $3, ${opacity})`
      );
    }

    // If hex colour, convert to rgba
    if (color.startsWith("#")) {
      let r, g, b;

      // Convert hex to rgb
      if (color.length === 4) {
        // Short hex format (#RGB)
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        // Full hex format (#RRGGBB)
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }

      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // For named colours or other formats, return as is
    return color;
  }

  /**
   * Apply a palette to a chart
   * @param {HTMLElement} container - The chart container
   * @param {HTMLElement} canvasElement - The canvas element
   * @param {string} paletteName - Name of the palette to apply
   */
  function applyPalette(container, canvasElement, paletteName) {
    debugLog("theme", "info", `Applying palette: ${paletteName}`);

    // Get the palette
    const palette = palettes[paletteName] || palettes.default;

    // Get the Chart.js instance from the canvas
    const chartInstance = Chart.getChart(canvasElement);

    if (!chartInstance) {
      debugLog("theme", "warn", "No Chart.js instance found for canvas");
      return;
    }

    // Identify the chart type for easier reference
    const chartType = chartInstance.config.type;
    debugLog("theme", "debug", `Chart type: ${chartType}`);

    // Apply palette colours based on chart type
    if (
      chartType === "pie" ||
      chartType === "doughnut" ||
      chartType === "polarArea"
    ) {
      // For pie/doughnut/polarArea charts
      chartInstance.data.datasets.forEach((dataset) => {
        dataset.backgroundColor = palette.backgroundColor;
        dataset.borderColor = palette.borderColor;

        // Enforce minimum border width for circular charts
        dataset.borderWidth = Math.max(dataset.borderWidth || 1, 3);

        // Apply patterns to fill if available
        if (palette.patterns) {
          dataset.backgroundColor = dataset.backgroundColor.map((color, i) => {
            const patternType = palette.patterns[i % palette.patterns.length];
            if (patternType === "solid") return color;
            return createPattern(patternType, color, chartType);
          });
        }
      });
    } else if (chartType === "radar") {
      // Specific handling for Radar charts
      chartInstance.data.datasets.forEach((dataset, i) => {
        const colorIndex = i % palette.backgroundColor.length;

        // Special handling for single-dataset bar charts
        if (chartType === "bar" && chartInstance.data.datasets.length === 1) {
          debugLog(
            "theme",
            "info",
            "Applying different colours to individual bars in bar chart"
          );

          // Create arrays of background and border colours - one colour per bar
          const dataLength = dataset.data.length;
          dataset.backgroundColor = Array(dataLength)
            .fill()
            .map((_, j) => {
              return palette.backgroundColor[
                j % palette.backgroundColor.length
              ];
            });

          dataset.borderColor = Array(dataLength)
            .fill()
            .map((_, j) => {
              return palette.borderColor[j % palette.borderColor.length];
            });

          debugLog("theme", "debug", "Applied bar colours", {
            backgroundColor: dataset.backgroundColor,
            borderColor: dataset.borderColor,
            dataLength: dataLength,
          });
        } else {
          // Default behaviour for other charts
          dataset.backgroundColor = palette.backgroundColor[colorIndex];
          dataset.borderColor = palette.borderColor[colorIndex];
        }

        // Apply line styles (borderDash) for line charts
        if (
          (chartType === "line" || dataset.type === "line") &&
          palette.borderDash
        ) {
          const dashIndex = i % palette.borderDash.length;
          dataset.borderDash = palette.borderDash[dashIndex];
        }

        // For bar charts, ensure border width is set to make borders visible
        if (chartType === "bar" || dataset.type === "bar") {
          dataset.borderWidth = Math.max(dataset.borderWidth || 2, 3);
        }
      });

      // Ensure label backdrop settings are applied after pattern fills
      if (palette.chartStyle) {
        const style = palette.chartStyle;

        // Make sure we have the scales.r object
        if (chartInstance.options.scales && chartInstance.options.scales.r) {
          if (!chartInstance.options.scales.r.pointLabels) {
            chartInstance.options.scales.r.pointLabels = {};
          }

          chartInstance.options.scales.r.pointLabels.color = style.textColor;

          if (!chartInstance.options.scales.r.ticks) {
            chartInstance.options.scales.r.ticks = {};
          }

          // Ensure ticks are drawn on top with a more opaque backdrop
          chartInstance.options.scales.r.ticks.color = style.textColor;
          chartInstance.options.scales.r.ticks.backdropColor =
            style.backgroundColor || "rgba(255, 255, 255, 0.95)";
          chartInstance.options.scales.r.ticks.backdropPaddingX = 4;
          chartInstance.options.scales.r.ticks.backdropPaddingY = 4;
          chartInstance.options.scales.r.ticks.z = 10; // Higher z-index to appear on top
          chartInstance.options.scales.r.ticks.showLabelBackdrop = true;

          // Set grid line colours with lower z-index
          if (!chartInstance.options.scales.r.grid) {
            chartInstance.options.scales.r.grid = {};
          }

          chartInstance.options.scales.r.grid.color =
            style.gridLinesColor || "rgba(0, 0, 0, 0.1)";
          chartInstance.options.scales.r.grid.z = 1; // Lower z-index for grid lines
        }
      }
    } else if (chartType === "bubble") {
      // Specific handling for Bubble charts
      chartInstance.data.datasets.forEach((dataset, i) => {
        const colorIndex = i % palette.backgroundColor.length;

        // For bubble charts, we need to handle both point and background colours
        const bubbleColour = palette.backgroundColor[colorIndex];
        const bubbleBorder = palette.borderColor[colorIndex];

        // Apply colours to the bubbles
        dataset.backgroundColor = bubbleColour;
        dataset.borderColor = bubbleBorder;

        // Enforce minimum border width of 3 for bubble charts
        dataset.borderWidth = Math.max(dataset.borderWidth || 1, 3);

        // Apply pattern fills to bubbles if available
        if (palette.patterns) {
          const patternType = palette.patterns[i % palette.patterns.length];
          if (patternType !== "solid") {
            // Create pattern specifically for bubbles (smaller pattern size)
            dataset.backgroundColor = createPattern(
              patternType,
              bubbleColour,
              chartType
            );
          }
        }
      });
    } else if (chartType === "scatter") {
      debugLog(
        "theme",
        "debug",
        "Applying scatter plot styling with increased point size"
      );

      // Specific handling for Scatter charts
      chartInstance.data.datasets.forEach((dataset, i) => {
        debugLog("theme", "debug", "Dataset before changes", {
          pointRadius: dataset.pointRadius,
          borderWidth: dataset.pointBorderWidth,
          index: i,
        });

        const colorIndex = i % palette.backgroundColor.length;

        // Apply colours to points and lines
        dataset.pointBackgroundColor = palette.backgroundColor[colorIndex];
        dataset.backgroundColor = palette.backgroundColor[colorIndex];
        dataset.borderColor = palette.borderColor[colorIndex];

        // EXTREME TESTING VALUES
        dataset.pointRadius = 8; // Much larger for visibility testing
        dataset.pointHoverRadius = 18; // Larger hover radius

        // Contrasting border for visibility
        dataset.pointBorderColor = i % 2 === 0 ? "#f0f2e8" : "#f0f2e8";
        dataset.pointBorderWidth = 1; // Thick border

        // Apply pattern fills to points if available
        if (palette.patterns) {
          // Override the pattern type for better visibility in testing
          const visiblePatterns = ["diagonal", "crosses", "dots"];
          let patternType = visiblePatterns[i % visiblePatterns.length];

          debugLog(
            "theme",
            "debug",
            `Using pattern type ${patternType} for dataset ${i}`
          );

          if (patternType !== "solid") {
            // Create pattern specifically for scatter points with testing values
            const pattern = createPattern(
              patternType,
              dataset.pointBackgroundColor,
              "scatter" // Force scatter type for testing
            );

            // Apply to points
            dataset.pointBackgroundColor = pattern;

            // If dataset has fill area, apply pattern there too
            if (dataset.fill === true) {
              dataset.backgroundColor = pattern;
            }
          }
        }

        // Apply borderDash pattern for connecting lines if showLine is true
        if (palette.borderDash && dataset.showLine) {
          const dashIndex = i % palette.borderDash.length;
          dataset.borderDash = palette.borderDash[dashIndex];
          dataset.borderWidth = 5; // Thicker lines
        }

        debugLog("theme", "debug", "Dataset after changes", {
          pointRadius: dataset.pointRadius,
          borderWidth: dataset.pointBorderWidth,
          index: i,
        });
      });
    } else {
      // For other chart types like bar, line, etc.
      chartInstance.data.datasets.forEach((dataset, i) => {
        const colorIndex = i % palette.backgroundColor.length;
        dataset.backgroundColor = palette.backgroundColor[colorIndex];
        dataset.borderColor = palette.borderColor[colorIndex];

        // Apply line styles (borderDash) for line charts
        if (
          (chartType === "line" || dataset.type === "line") &&
          palette.borderDash
        ) {
          const dashIndex = i % palette.borderDash.length;
          dataset.borderDash = palette.borderDash[dashIndex];
        }

        // For bar charts, ensure border width is set to make borders visible
        if (chartType === "bar" || dataset.type === "bar") {
          dataset.borderWidth = Math.max(dataset.borderWidth || 2, 3);
        }

        // Handle patterns for filled areas (area charts, bar charts, and stacked line charts)
        if (
          palette.patterns &&
          (chartType === "bar" ||
            dataset.type === "bar" ||
            ((chartType === "line" || dataset.type === "line") &&
              dataset.fill !== undefined))
        ) {
          // Check if this is a stacked line chart
          const isStacked =
            (chartType === "line" || dataset.type === "line") &&
            chartInstance.options.scales &&
            chartInstance.options.scales.y &&
            chartInstance.options.scales.y.stacked;

          // If it's a stacked line chart, we need special handling
          if (isStacked) {
            debugLog(
              "theme",
              "info",
              "Applying special handling for stacked line chart"
            );

            // For stacked line charts, we need to use a specific approach
            // that works better with Chart.js's stacking mechanism

            // Get the base colour (either borderColor or backgroundColor)
            const baseColor = dataset.borderColor || dataset.backgroundColor;

            // Create a semi-transparent fill colour
            // The key is to use varying opacities that work well with stacking
            const fillOpacity = 0.2; // High opacity for better visibility

            // Create an rgba colour with the right opacity
            let fillColor;

            // Parse the colour to create a proper rgba version
            if (typeof baseColor === "string") {
              if (baseColor.startsWith("rgba")) {
                // Already rgba, just adjust opacity
                fillColor = baseColor.replace(
                  /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/,
                  `rgba($1, $2, $3, ${fillOpacity})`
                );
              } else if (baseColor.startsWith("rgb")) {
                // Convert rgb to rgba
                fillColor = baseColor.replace(
                  /rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
                  `rgba($1, $2, $3, ${fillOpacity})`
                );
              } else if (baseColor.startsWith("#")) {
                // Convert hex to rgba
                const r = parseInt(baseColor.slice(1, 3), 16);
                const g = parseInt(baseColor.slice(3, 5), 16);
                const b = parseInt(baseColor.slice(5, 7), 16);
                fillColor = `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
              } else {
                // Default fallback
                fillColor = baseColor;
              }
            } else {
              // If it's not a string (perhaps already a pattern), use as is
              fillColor = baseColor;
            }

            // Apply the semi-transparent fill colour
            dataset.backgroundColor = fillColor;

            // Ensure we have a visible border
            dataset.borderWidth = Math.max(dataset.borderWidth || 1, 2);

            // No pattern for stacked charts - use solid fills with transparency
            // This works better with Chart.js's stacking mechanism
            if (palette.borderDash) {
              const dashIndex = i % palette.borderDash.length;
              dataset.borderDash = palette.borderDash[dashIndex];
            }
          } else {
            // Handle both single colours and arrays of colours for non-stacked charts
            if (Array.isArray(dataset.backgroundColor)) {
              // For arrays (like individual bar colours), apply patterns to each colour
              dataset.backgroundColor = dataset.backgroundColor.map(
                (color, j) => {
                  const patternType =
                    palette.patterns[j % palette.patterns.length];
                  if (patternType !== "solid") {
                    return createPattern(patternType, color, chartType);
                  }
                  return color;
                }
              );
            } else {
              // For single colour backgrounds
              const patternType = palette.patterns[i % palette.patterns.length];
              if (patternType !== "solid") {
                // Store the original border colour before applying pattern
                const originalBorderColor = dataset.borderColor;

                // Apply pattern to background
                dataset.backgroundColor = createPattern(
                  patternType,
                  dataset.backgroundColor,
                  chartType
                );

                // Ensure border colour remains solid for visibility
                dataset.borderColor = originalBorderColor;
              }
            }

            // Set border width if not already set
            if (
              !dataset.borderWidth &&
              (chartType === "bar" || dataset.type === "bar")
            ) {
              dataset.borderWidth = Math.max(dataset.borderWidth || 2, 3);
            }
          }
        }
      });
    }

    // Apply chart styling for elements if available
    if (palette.chartStyle) {
      // Get the style options
      const style = palette.chartStyle;

      // Set background colour on canvas
      if (style.backgroundColor) {
        // First, set it on the canvas element itself
        canvasElement.style.backgroundColor = style.backgroundColor;

        // Set in chart options for proper rendering
        if (!chartInstance.options.plugins) {
          chartInstance.options.plugins = {};
        }

        // Apply background to chart via plugin options
        if (!chartInstance.options.plugins.chart) {
          chartInstance.options.plugins.chart = {};
        }
        chartInstance.options.plugins.chart.backgroundColor =
          style.backgroundColor;

        // Also set on canvas background
        if (!chartInstance.options.canvas) {
          chartInstance.options.canvas = {};
        }
        chartInstance.options.canvas.backgroundColor = style.backgroundColor;

        // For Chart.js 3.x, set on the chart background directly
        chartInstance.options.backgroundColor = style.backgroundColor;

        // Apply to parent container for extra safety
        canvasElement.parentNode.style.backgroundColor = style.backgroundColor;
      }

      // Apply annotation background colours if any
      if (
        chartInstance.options.plugins &&
        chartInstance.options.plugins.annotation
      ) {
        chartInstance.options.plugins.annotation.annotations.forEach(
          (annotation) => {
            if (annotation.backgroundColor) {
              annotation.backgroundColor = style.backgroundColor;
            }
          }
        );
      }

      // Update scales (x and y axes)
      if (chartInstance.options.scales) {
        Object.values(chartInstance.options.scales).forEach((scale) => {
          // Grid lines
          if (scale.grid) {
            scale.grid.color = style.gridLinesColor;
            scale.grid.borderColor = style.axisColor;
          }

          // Axis ticks and labels
          if (scale.ticks) {
            scale.ticks.color = style.textColor;
          }

          // Axis titles
          if (scale.title) {
            scale.title.color = style.axisTitleColor || style.textColor; // Fallback to textColor if axisTitleColor not specified

            // Make sure the titles are displayed
            scale.title.display = true;
          }
        });
      }

      // Update title styling
      if (
        chartInstance.options.plugins &&
        chartInstance.options.plugins.title
      ) {
        chartInstance.options.plugins.title.color = style.titleColor;
      }

      // Update subtitle styling
      if (
        chartInstance.options.plugins &&
        chartInstance.options.plugins.subtitle
      ) {
        chartInstance.options.plugins.subtitle.color =
          style.titleColor || style.textColor; // Use titleColor or fall back to textColor
      }

      // Update legend styling
      if (
        chartInstance.options.plugins &&
        chartInstance.options.plugins.legend
      ) {
        chartInstance.options.plugins.legend.labels = {
          ...chartInstance.options.plugins.legend.labels,
          color: style.legendTextColor,
        };
      }

      // Update tooltip styling
      if (
        chartInstance.options.plugins &&
        chartInstance.options.plugins.tooltip
      ) {
        chartInstance.options.plugins.tooltip.backgroundColor =
          style.tooltipBackgroundColor;
        chartInstance.options.plugins.tooltip.titleColor =
          style.tooltipTextColor;
        chartInstance.options.plugins.tooltip.bodyColor =
          style.tooltipTextColor;
        chartInstance.options.plugins.tooltip.borderColor =
          style.tooltipBorderColor;
      }

      // Special handling for polar area charts
      if (chartType === "polarArea") {
        // Handle datasets colours if needed
        chartInstance.data.datasets.forEach((dataset, i) => {
          // Apply background colours from palette
          if (
            !dataset.backgroundColor ||
            dataset.backgroundColor.length === 0
          ) {
            dataset.backgroundColor = palette.backgroundColor;
          }

          // Apply border colours from palette
          if (!dataset.borderColor || dataset.borderColor.length === 0) {
            dataset.borderColor = palette.borderColor;
          }

          // Reduce opacity slightly to make labels more visible
          if (Array.isArray(dataset.backgroundColor)) {
            dataset.backgroundColor = dataset.backgroundColor.map((color) => {
              return adjustColorOpacity(color, 0.8); // Reduce opacity to 80%
            });
          } else if (typeof dataset.backgroundColor === "string") {
            dataset.backgroundColor = adjustColorOpacity(
              dataset.backgroundColor,
              0.8
            );
          }
        });

        // Style the scale for polar area
        if (chartInstance.options.scales && chartInstance.options.scales.r) {
          if (!chartInstance.options.scales.r.ticks) {
            chartInstance.options.scales.r.ticks = {};
          }

          chartInstance.options.scales.r.ticks.color = style.textColor;
          chartInstance.options.scales.r.ticks.backdropColor =
            style.backgroundColor || "rgba(255, 255, 255, 0.95)"; // More opaque
          chartInstance.options.scales.r.ticks.backdropPaddingY = 4; // Increased padding
          chartInstance.options.scales.r.ticks.backdropPaddingX = 4; // Increased padding
          chartInstance.options.scales.r.ticks.z = 10; // Higher z-index to appear on top
          chartInstance.options.scales.r.ticks.showLabelBackdrop = true; // Explicitly enable backdrops

          // Set grid line colours with lower z-index
          if (!chartInstance.options.scales.r.grid) {
            chartInstance.options.scales.r.grid = {};
          }

          chartInstance.options.scales.r.grid.color =
            style.gridLinesColor || "rgba(0, 0, 0, 0.1)";
          chartInstance.options.scales.r.grid.z = 1; // Lower z-index for grid lines
        }
      }
    }

    // Update the chart
    chartInstance.update();

    // Validate PNG export after palette change (if enabled)
    if (PngExportValidator.config.validateOnPaletteChange) {
      setTimeout(() => {
        PngExportValidator.validatePngExport(
          container,
          canvasElement,
          true
        ).catch((error) =>
          debugLog(
            "validation",
            "warn",
            "Post-palette validation failed",
            error
          )
        );
      }, 500); // Small delay to ensure chart is fully rendered
    }

    // Announce to screen readers
    announceToScreenReader(`Chart palette changed to ${paletteName}`);
  }

  /**
   * Export chart as high-resolution PNG with correct styling
   * @param {HTMLElement} container - The chart container element
   * @param {HTMLElement} canvasElement - The canvas element
   * @param {number} index - Index for unique filename
   */
  async function exportAsPng(container, canvasElement, index) {
    debugLog("export", "info", "Starting PNG export process");

    // Prevent double-exports by checking if already in progress
    if (container.dataset.exportInProgress === "true") {
      debugLog("export", "info", "Export already in progress, skipping");
      return;
    }

    // Mark export as in progress
    container.dataset.exportInProgress = "true";

    try {
      const chartInstance = Chart.getChart(canvasElement);
      debugLog("export", "info", "Chart instance found", !!chartInstance);

      if (!chartInstance) {
        debugLog("export", "error", "No Chart.js instance found for canvas");
        return;
      }

      debugLog("export", "info", `Chart type: ${chartInstance.config.type}`);

      // Ensure chart is fully rendered and all animations are complete
      debugLog("export", "info", "Ensuring chart is fully rendered...");

      // Stop any ongoing animations
      chartInstance.stop();

      // Force a render without animation
      chartInstance.update("none");

      // Wait for any pending renders to complete
      await new Promise((resolve) => {
        // Use requestAnimationFrame to ensure we're after any pending renders
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      // Additional small delay to ensure everything is settled
      await new Promise((resolve) => setTimeout(resolve, 150));

      debugLog(
        "export",
        "info",
        "Chart rendering complete, proceeding with export"
      );

      // Create a high-resolution canvas for export
      const exportCanvas = document.createElement("canvas");
      const exportContext = exportCanvas.getContext("2d");

      // Set a scale factor for higher resolution
      const scaleFactor = 2;

      // Get the rendered dimensions of the canvas
      const displayWidth = canvasElement.clientWidth || canvasElement.width;
      const displayHeight = canvasElement.clientHeight || canvasElement.height;
      debugLog("export", "debug", "Display dimensions", {
        displayWidth,
        displayHeight,
      });

      // Set the export canvas size
      exportCanvas.width = displayWidth * scaleFactor;
      exportCanvas.height = displayHeight * scaleFactor;
      debugLog("export", "debug", "Export canvas dimensions", {
        width: exportCanvas.width,
        height: exportCanvas.height,
      });

      // Get background colour
      const containerBgColor =
        window.getComputedStyle(container).backgroundColor;
      const chartBgColor =
        chartInstance.options.backgroundColor ||
        (chartInstance.options.plugins &&
          chartInstance.options.plugins.chart &&
          chartInstance.options.plugins.chart.backgroundColor);

      const backgroundColor =
        chartBgColor && chartBgColor !== "transparent"
          ? chartBgColor
          : containerBgColor !== "rgba(0, 0, 0, 0)"
          ? containerBgColor
          : "#ffffff";

      debugLog(
        "export",
        "debug",
        `Final background colour: ${backgroundColor}`
      );

      // Fill the background
      exportContext.fillStyle = backgroundColor;
      exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      debugLog("export", "debug", "Background filled successfully");

      // Try multiple methods to get the chart image
      let baseImage;
      let imageObtained = false;

      // Method 1: Chart.js toBase64Image (preferred)
      try {
        debugLog(
          "export",
          "debug",
          "Attempting Method 1: Chart.js toBase64Image..."
        );
        baseImage = chartInstance.toBase64Image("image/png", 1.0);

        if (baseImage && baseImage.length > 1000) {
          // Reasonable size check
          debugLog(
            "export",
            "debug",
            `Method 1 successful, image length: ${baseImage.length}`
          );
          imageObtained = true;
        } else {
          throw new Error("Image too small or empty");
        }
      } catch (error) {
        debugLog("export", "warn", "Method 1 failed", error.message);
      }

      // Method 2: Direct canvas export (fallback)
      if (!imageObtained) {
        try {
          debugLog(
            "export",
            "debug",
            "Attempting Method 2: Direct canvas export..."
          );
          baseImage = canvasElement.toDataURL("image/png", 1.0);

          if (baseImage && baseImage.length > 1000) {
            debugLog(
              "export",
              "debug",
              `Method 2 successful, image length: ${baseImage.length}`
            );
            imageObtained = true;
          } else {
            throw new Error("Canvas export failed or empty");
          }
        } catch (error) {
          debugLog("export", "error", "Method 2 also failed", error);
          throw new Error("Unable to export chart image using any method");
        }
      }

      if (!imageObtained) {
        throw new Error("Failed to obtain chart image");
      }

      debugLog(
        "export",
        "debug",
        `Base64 image starts with: ${baseImage.substring(0, 50)}`
      );

      // Create a temporary image element to process the chart data
      const tempImage = new Image();
      debugLog("export", "debug", "Creating temporary image element");

      // Use a promise to handle the asynchronous image loading
      const imageLoadPromise = new Promise((resolve, reject) => {
        tempImage.onload = function () {
          debugLog("export", "debug", "Image loaded successfully");
          debugLog("export", "debug", "Image dimensions", {
            width: tempImage.width,
            height: tempImage.height,
          });

          try {
            // Draw the chart image onto our high-res export canvas
            exportContext.drawImage(
              tempImage,
              0,
              0,
              tempImage.width,
              tempImage.height, // Source rectangle
              0,
              0,
              exportCanvas.width,
              exportCanvas.height // Destination rectangle (scaled up)
            );
            debugLog(
              "export",
              "debug",
              "Image drawn to export canvas successfully"
            );

            // Get the final PNG data URL
            const pngUrl = exportCanvas.toDataURL("image/png", 1.0);
            debugLog(
              "export",
              "debug",
              `PNG data URL generated, length: ${pngUrl.length}`
            );

            // Quick validation - sample a few pixels to ensure chart content is present
            const testCanvas = document.createElement("canvas");
            const testCtx = testCanvas.getContext("2d");
            testCanvas.width = exportCanvas.width;
            testCanvas.height = exportCanvas.height;
            testCtx.drawImage(exportCanvas, 0, 0);

            // Sample center pixel
            const centerPixel = testCtx.getImageData(
              Math.floor(exportCanvas.width / 2),
              Math.floor(exportCanvas.height / 2),
              1,
              1
            ).data;

            debugLog(
              "export",
              "debug",
              "Final validation - center pixel",
              Array.from(centerPixel)
            );

            resolve(pngUrl);
          } catch (drawError) {
            debugLog(
              "export",
              "error",
              "Error drawing image to canvas",
              drawError
            );
            reject(drawError);
          }
        };

        tempImage.onerror = function (errorEvent) {
          debugLog("export", "error", "Failed to load chart image for export");
          reject(new Error("Failed to load chart image for export"));
        };
      });

      // Set the source to trigger the load
      debugLog("export", "debug", "Setting image source to trigger load...");
      tempImage.src = baseImage;

      // Handle the promise resolution
      const pngUrl = await imageLoadPromise;

      debugLog("export", "info", "Creating download...");

      // Create download link with a more predictable filename
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `chart-${Date.now()}.png`; // Use timestamp for unique names

      debugLog(
        "export",
        "debug",
        `Download link created with filename: ${downloadLink.download}`
      );

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Announce success
      announceToScreenReader("High resolution PNG downloaded successfully");
      debugLog("export", "info", "PNG export completed successfully");
    } catch (error) {
      debugLog("export", "error", "Error exporting PNG", error);
      announceToScreenReader("Failed to download PNG");
    } finally {
      // Always clear the export progress flag
      delete container.dataset.exportInProgress;
      debugLog(
        "export",
        "debug",
        "Export process finished, cleared progress flag"
      );
    }
  }

  /**
   * PNG Export Validation and Regression Detection System
   * Provides automated testing of PNG export functionality
   */
  const PngExportValidator = {
    // Configuration
    config: {
      enabled: true,
      validateOnInit: true,
      validateOnPaletteChange: true,
      minImageSize: 5000, // Reduced from 1000 - any real chart should be at least 5KB
      maxBackgroundRatio: 0.95, // Not used in simple validation
      validationTimeout: 5000,
      alertThreshold: 5, // Increased from 3 - be less sensitive to occasional failures
      debugMode: false,
    },

    // State tracking
    state: {
      validationHistory: [],
      consecutiveFailures: 0,
      lastValidationTime: 0,
      validationInProgress: false,
    },

    /**
     * Simple validation that just tests if PNG export mechanism works
     * @param {HTMLElement} container - Chart container
     * @param {HTMLElement} canvasElement - Canvas element
     * @param {boolean} silent - If true, don't show alerts
     * @returns {Promise<Object>} Validation result
     */
    async validatePngExport(container, canvasElement, silent = false) {
      if (!this.config.enabled || this.state.validationInProgress) {
        return { success: true, reason: "validation-disabled-or-in-progress" };
      }

      this.state.validationInProgress = true;
      const startTime = Date.now();

      try {
        debugLog(
          "validation",
          "debug",
          `Starting simple validation for container: ${container.id}`
        );

        const chartInstance = Chart.getChart(canvasElement);
        if (!chartInstance) {
          throw new Error("No Chart.js instance found");
        }

        debugLog(
          "validation",
          "debug",
          "Chart instance found, testing export capability..."
        );

        // Test 1: Can we get a base64 image at all?
        let baseImage;
        let exportMethod = "unknown";

        try {
          baseImage = chartInstance.toBase64Image("image/png", 1.0);
          exportMethod = "chartjs-method";
          debugLog("validation", "debug", "Chart.js toBase64Image successful");
        } catch (error) {
          try {
            baseImage = canvasElement.toDataURL("image/png", 1.0);
            exportMethod = "canvas-method";
            debugLog(
              "validation",
              "debug",
              "Canvas toDataURL fallback successful"
            );
          } catch (error2) {
            throw new Error("Both export methods failed");
          }
        }

        // Test 2: Is the image a reasonable size?
        const imageSize = baseImage ? baseImage.length : 0;
        const hasReasonableSize = imageSize > this.config.minImageSize;

        // Test 3: Does it start with proper PNG data URI?
        const hasValidFormat =
          baseImage && baseImage.startsWith("data:image/png;base64,");

        // Test 4: Quick sanity check - is it different from a tiny empty image?
        const isNotEmpty = imageSize > 5000; // A real chart should be at least 5KB

        debugLog("validation", "debug", "Validation results", {
          exportMethod,
          imageSize,
          hasReasonableSize,
          hasValidFormat,
          isNotEmpty,
          imageStart: baseImage ? baseImage.substring(0, 50) : "null",
        });

        // Simple validation: if we can export an image of reasonable size with proper format, it's working
        const isWorking = hasReasonableSize && hasValidFormat && isNotEmpty;

        const result = {
          success: isWorking,
          timestamp: Date.now(),
          processingTime: Date.now() - startTime,
          imageSize: imageSize,
          chartId: container.id,
          exportMethod: exportMethod,
          hasValidFormat: hasValidFormat,
          reason: isWorking
            ? "export-mechanism-working"
            : "export-mechanism-failed",
          details: {
            hasReasonableSize,
            hasValidFormat,
            isNotEmpty,
            minSizeRequired: this.config.minImageSize,
          },
        };

        this.recordValidationResult(result, silent);
        return result;
      } catch (error) {
        const result = {
          success: false,
          timestamp: Date.now(),
          processingTime: Date.now() - startTime,
          error: error.message,
          chartId: container.id,
          reason: "validation-error",
        };

        this.recordValidationResult(result, silent);
        return result;
      } finally {
        this.state.validationInProgress = false;
      }
    },

    /**
     * Validate image content to ensure chart data is present
     * @param {string} base64Image - Base64 image data
     * @returns {Promise<Object>} Content validation result
     */
    async validateImageContent(base64Image) {
      const self = this; // Capture context for use in nested functions

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            // Create canvas to analyze pixels with willReadFrequently optimization
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            debugLog("validation", "debug", "Analyzing image dimensions", {
              width: img.width,
              height: img.height,
            });

            // Sample more pixels from different areas for better detection
            const samples = [
              // Corners
              {
                x: Math.floor(img.width * 0.1),
                y: Math.floor(img.height * 0.1),
              },
              {
                x: Math.floor(img.width * 0.9),
                y: Math.floor(img.height * 0.1),
              },
              {
                x: Math.floor(img.width * 0.1),
                y: Math.floor(img.height * 0.9),
              },
              {
                x: Math.floor(img.width * 0.9),
                y: Math.floor(img.height * 0.9),
              },
              // Center and mid-points
              {
                x: Math.floor(img.width * 0.5),
                y: Math.floor(img.height * 0.5),
              },
              {
                x: Math.floor(img.width * 0.3),
                y: Math.floor(img.height * 0.5),
              },
              {
                x: Math.floor(img.width * 0.7),
                y: Math.floor(img.height * 0.5),
              },
              {
                x: Math.floor(img.width * 0.5),
                y: Math.floor(img.height * 0.3),
              },
              {
                x: Math.floor(img.width * 0.5),
                y: Math.floor(img.height * 0.7),
              },
              // Additional strategic points
              {
                x: Math.floor(img.width * 0.25),
                y: Math.floor(img.height * 0.25),
              },
              {
                x: Math.floor(img.width * 0.75),
                y: Math.floor(img.height * 0.75),
              },
            ];

            const pixelData = samples.map((sample, index) => {
              const pixel = ctx.getImageData(sample.x, sample.y, 1, 1).data;
              const colorStr = `${pixel[0]},${pixel[1]},${pixel[2]}`;

              debugLog(
                "validation",
                "debug",
                `Sample ${index + 1} at (${sample.x}, ${sample.y}): RGBA(${
                  pixel[0]
                }, ${pixel[1]}, ${pixel[2]}, ${pixel[3]}) = ${colorStr}`
              );

              return colorStr;
            });

            // Count unique colours
            const uniqueColours = new Set(pixelData);
            const diversePixels = uniqueColours.size;

            debugLog(
              "validation",
              "debug",
              "Unique colours found",
              Array.from(uniqueColours)
            );
            debugLog(
              "validation",
              "debug",
              `Total unique colours: ${diversePixels}`
            );

            // Calculate background ratio
            const mostCommonColor = [...uniqueColours].reduce((a, b) =>
              pixelData.filter((v) => v === a).length >=
              pixelData.filter((v) => v === b).length
                ? a
                : b
            );

            const backgroundPixelCount = pixelData.filter(
              (color) => color === mostCommonColor
            ).length;
            const backgroundRatio = backgroundPixelCount / samples.length;

            debugLog(
              "validation",
              "debug",
              `Most common colour: ${mostCommonColor}`
            );
            debugLog(
              "validation",
              "debug",
              `Background pixel count: ${backgroundPixelCount} out of ${samples.length}`
            );
            debugLog(
              "validation",
              "debug",
              `Background ratio: ${backgroundRatio}`
            );

            // More lenient validation
            const isValid = diversePixels >= 2 && backgroundRatio < 0.85;

            debugLog("validation", "debug", "Validation result", {
              isValid,
              diversePixels,
              backgroundRatio,
            });

            resolve({
              isValid,
              diversePixels,
              backgroundRatio,
              mostCommonColor,
              reason: isValid
                ? "content-detected"
                : diversePixels < 2
                ? "only-one-colour-detected"
                : "too-much-background",
            });
          } catch (error) {
            debugLog("validation", "error", "Pixel analysis error", error);
            resolve({
              isValid: false,
              diversePixels: 0,
              backgroundRatio: 1,
              reason: "pixel-analysis-failed",
              error: error.message,
            });
          }
        };

        img.onerror = () => {
          debugLog("validation", "error", "Image load failed");
          resolve({
            isValid: false,
            diversePixels: 0,
            backgroundRatio: 1,
            reason: "image-load-failed",
          });
        };

        img.src = base64Image;
      });
    },

    /**
     * Record validation result and handle alerts
     * @param {Object} result - Validation result
     * @param {boolean} silent - If true, don't show alerts
     */
    recordValidationResult(result, silent) {
      // Add to history (keep last 10 results)
      this.state.validationHistory.unshift(result);
      if (this.state.validationHistory.length > 10) {
        this.state.validationHistory.pop();
      }

      this.state.lastValidationTime = result.timestamp;

      if (result.success) {
        this.state.consecutiveFailures = 0;
        debugLog("validation", "debug", "✓ Validation passed", result);
      } else {
        this.state.consecutiveFailures++;
        debugLog("validation", "warn", "✗ Validation failed", result);

        // Show alert if threshold reached and not silent
        if (
          !silent &&
          this.state.consecutiveFailures >= this.config.alertThreshold
        ) {
          this.showRegressionAlert(result);
        }
      }
    },

    /**
     * Show regression alert to user
     * @param {Object} result - Latest validation result
     */
    showRegressionAlert(result) {
      const alertMessage =
        `⚠️ PNG Export Regression Detected!\n\n` +
        `The chart PNG export functionality appears to have broken.\n` +
        `Issue: ${result.reason}\n` +
        `Chart: ${result.chartId}\n` +
        `Consecutive failures: ${this.state.consecutiveFailures}\n\n` +
        `This may be caused by recent changes to chart rendering or theming.\n` +
        `Check the browser console for detailed error information.`;

      // Show browser alert
      alert(alertMessage);

      // Also log detailed information
      debugLog("validation", "error", "REGRESSION ALERT", {
        result,
        history: this.state.validationHistory,
        consecutiveFailures: this.state.consecutiveFailures,
      });

      // Announce to screen readers
      if (
        window.ChartControls &&
        typeof window.ChartControls.announceToScreenReader === "function"
      ) {
        window.ChartControls.announceToScreenReader(
          "PNG export functionality has stopped working"
        );
      }
    },

    /**
     * Validate all charts on the page
     * @param {boolean} silent - If true, don't show individual alerts
     * @returns {Promise<Array>} Array of validation results
     */
    async validateAllCharts(silent = true) {
      const chartContainers = document.querySelectorAll(".chart-container");
      const results = [];

      debugLog(
        "validation",
        "info",
        `Validating ${chartContainers.length} charts...`
      );

      for (const container of chartContainers) {
        const canvas = container.querySelector("canvas");
        if (canvas && Chart.getChart(canvas)) {
          const result = await this.validatePngExport(
            container,
            canvas,
            silent
          );
          results.push(result);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      debugLog(
        "validation",
        "info",
        `Validation complete: ${successCount} passed, ${failureCount} failed`
      );

      if (failureCount > 0) {
        debugLog(
          "validation",
          "warn",
          "Failed validations",
          results.filter((r) => !r.success)
        );
      }

      return results;
    },

    /**
     * Get validation status report
     * @returns {Object} Status report
     */
    getStatusReport() {
      return {
        config: this.config,
        state: this.state,
        isHealthy: this.state.consecutiveFailures < this.config.alertThreshold,
        lastValidation: this.state.lastValidationTime
          ? new Date(this.state.lastValidationTime).toLocaleString()
          : "Never",
      };
    },
  };

  // Add to global scope for manual testing
  window.PngExportValidator = PngExportValidator;

  /**
   * Copy chart code to clipboard
   * @param {string} code - The chart code to copy
   * @param {HTMLElement} button - The button that was clicked
   */
  function copyCodeToClipboard(code, button) {
    if (!code) return;

    debugLog("events", "debug", "Starting clipboard copy operation");

    // Ensure the code is decoded
    const decodedCode =
      typeof code === "string" && code.includes("%")
        ? decodeURIComponent(code)
        : code;

    // Format the JSON nicely for improved readability
    let formattedCode;
    try {
      // Try to parse and format as JSON
      const jsonObj = JSON.parse(decodedCode);
      formattedCode = JSON.stringify(jsonObj, null, 2);
    } catch (e) {
      // If not valid JSON, use as is
      formattedCode = decodedCode;
    }

    // Now copy the formatted code
    // Use Clipboard API if available
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(formattedCode)
        .then(() => {
          updateButtonStatus(button, true);
        })
        .catch((error) => {
          debugLog(
            "events",
            "warn",
            "Clipboard API failed, using fallback method",
            error.name
          );
          fallbackCopyToClipboard(formattedCode, button);
        });
    } else {
      fallbackCopyToClipboard(formattedCode, button);
    }
  }

  /**
   * Fallback method for copying to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - The button that was clicked
   */
  function fallbackCopyToClipboard(text, button) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      updateButtonStatus(button, successful);
    } catch (error) {
      debugLog("events", "error", "Error in fallback copy method", error);
      updateButtonStatus(button, false);
    }
  }

  /**
   * Update button status after copy operation
   * @param {HTMLElement} button - The button element
   * @param {boolean} success - Whether the action was successful
   * @param {string} message - Optional custom message
   */
  function updateButtonStatus(button, success, message) {
    const originalContent = button.innerHTML;

    // Determine message
    const statusMessage = message || (success ? "Copied!" : "Copy failed");

    // Extract icon if present
    const icon = button.querySelector("svg")
      ? button.querySelector("svg").outerHTML
      : "";

    // Update button content
    button.innerHTML = `${icon} ${statusMessage}`;

    // Reset button after delay
    setTimeout(() => {
      button.innerHTML = originalContent;
    }, 2000);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    debugLog(
      "accessibility",
      "debug",
      `Announcing to screen reader: ${message}`
    );

    // Find or create screen reader announcer
    let announcer = document.getElementById("chart-sr-announcer");

    if (!announcer) {
      // Create screen reader announcer element
      announcer = document.createElement("div");
      announcer.id = "chart-sr-announcer";
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);

      // Add necessary CSS if not already present
      if (!document.getElementById("sr-styles")) {
        const style = document.createElement("style");
        style.id = "sr-styles";
        style.textContent = `
          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Set the message to be announced
    announcer.textContent = message;
  }

  /**
   * Get SVG icon for copy button
   * @returns {string} SVG icon HTML
   */
  function getCopyButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }

  /**
   * Get SVG icon for PNG button
   * @returns {string} SVG icon HTML
   */
  function getPngButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>`;
  }

  /**
   * Update charts when site theme changes
   * This function should be called when the site theme is toggled
   */
  function updateChartsForThemeChange() {
    debugLog("theme", "info", "Theme change detected, updating charts");

    // Get all chart containers
    const chartContainers = document.querySelectorAll(".chart-container");
    debugLog(
      "theme",
      "info",
      `Found ${chartContainers.length} chart containers`
    );

    // Get the current appropriate default palette
    const newDefaultPalette = Utils.getDefaultPaletteForCurrentMode();
    debugLog(
      "theme",
      "info",
      `Current default palette for mode: ${newDefaultPalette}`
    );

    chartContainers.forEach((container) => {
      const paletteSelect = container.querySelector(".chart-palette-select");
      if (!paletteSelect) {
        debugLog("theme", "debug", "No palette select found for container");
        return;
      }

      // Set selected palette to default for current mode
      paletteSelect.value = newDefaultPalette;

      // Get the canvas element
      const canvasElement = container.querySelector("canvas");
      if (!canvasElement) {
        debugLog("theme", "warn", "No canvas found in chart container");
        return;
      }

      // Apply the new palette to the chart
      applyPalette(container, canvasElement, newDefaultPalette);
    });
  }

  /**
   * Initialise controls using Intersection Observer for performance
   * @param {HTMLElement} container - Container to observe (defaults to document)
   */
  function initWithLazyLoading(container = document) {
    if (!container) {
      debugLog("init", "warn", "No container provided");
      return;
    }

    debugLog("init", "info", "Initialising with lazy loading");

    // Find all Chart containers
    const chartContainers = Utils.findContainersWithoutControls(container);

    if (chartContainers.length === 0) {
      debugLog("init", "info", "No chart containers found for lazy loading");
      return;
    }

    debugLog(
      "init",
      "info",
      `Found ${chartContainers.length} charts to observe`
    );

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const container = entry.target;

            // Add controls if not already present
            if (!container.querySelector(".chart-controls")) {
              debugLog("init", "info", "Loading controls for visible chart");

              // Get chart index from data attribute or generate one
              const chartId =
                container.dataset.chartId ||
                `chart-${Math.random().toString(36).substring(2, 10)}`;

              // Store ID if not already present
              if (!container.dataset.chartId) {
                container.dataset.chartId = chartId;
              }

              addControlsToContainer(container, chartId);
            }

            // Stop observing this container once controls are added
            observer.unobserve(container);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when at least 10% of the element is visible
        rootMargin: "100px", // Add 100px margin to load slightly before visible
      }
    );

    // Start observing each container
    chartContainers.forEach((container) => {
      observer.observe(container);
    });
  }

  /**
   * Adjust container padding based on controls height - optimised version
   * @param {HTMLElement} container - The chart container
   */
  function adjustContainerPadding(container) {
    if (!container) {
      debugLog("layout", "warn", "Cannot adjust padding: Container is null");
      return;
    }

    // Use a cached selector for better performance
    const controlsContainer = container.querySelector(".chart-controls");
    if (!controlsContainer) {
      // Skip silently for better performance when called frequently
      return;
    }

    // Check if we've already set appropriate padding recently
    const lastAdjustTime = parseInt(
      container.getAttribute("data-last-adjust-time") || "0"
    );
    const now = Date.now();

    // Only adjust if it's been more than 100ms since last adjustment (prevents excessive adjustments)
    // But always adjust if this is the first time (lastAdjustTime === 0)
    if (lastAdjustTime === 0 || now - lastAdjustTime > 100) {
      try {
        // Get the current height of the controls - use getBoundingClientRect for more accurate measurement
        const controlsRect = controlsContainer.getBoundingClientRect();
        const controlsHeight = controlsRect.height;

        // Check if we got a valid height
        if (controlsHeight > 0) {
          // Add extra padding to be safe (20px buffer)
          const newPadding = Math.ceil(controlsHeight) + 20 + "px";

          // Only update if the padding has changed
          if (container.style.paddingBottom !== newPadding) {
            container.style.paddingBottom = newPadding;
            debugLog(
              "layout",
              "debug",
              `Adjusted container padding to: ${newPadding}`
            );

            // Store the current time as the last adjustment time
            container.setAttribute("data-last-adjust-time", now.toString());
          }
        } else {
          // Set a default minimum padding if height is zero
          container.style.paddingBottom = "100px";
          debugLog("layout", "debug", "Set default padding: 100px");
        }

        // Force a browser reflow to ensure padding is applied immediately
        void container.offsetHeight;
      } catch (error) {
        // Set a fallback padding without logging to reduce console noise
        container.style.paddingBottom = "100px";
        debugLog(
          "layout",
          "warn",
          "Error adjusting padding, using fallback",
          error
        );
      }
    }
  }

  /**
   * Set up an Intersection Observer to adjust chart controls when they scroll into view
   */
  function setupScrollObserver() {
    debugLog("scroll", "info", "Setting up scroll observer for charts");

    // Create an observer to watch for charts scrolling into view
    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Get the container element
          const container = entry.target;

          debugLog(
            "scroll",
            "debug",
            `Intersection detected for chart: isIntersecting=${
              entry.isIntersecting
            }, intersectionRatio=${entry.intersectionRatio.toFixed(2)}`
          );

          if (entry.isIntersecting) {
            // Chart is now visible in the viewport
            debugLog(
              "scroll",
              "info",
              `Chart scrolled into view: ${
                container.id || "unnamed"
              }, has controls: ${!!container.querySelector(
                `.${config.controlsContainerClass}`
              )}`
            );

            // First, ensure the container has controls
            if (!container.querySelector(`.${config.controlsContainerClass}`)) {
              debugLog(
                "scroll",
                "info",
                "Adding controls to newly visible chart"
              );
              // Get chart index from data attribute or generate one
              const chartId =
                container.dataset.chartId ||
                `chart-${Math.random().toString(36).substring(2, 10)}`;

              // Store ID if not already present
              if (!container.dataset.chartId) {
                container.dataset.chartId = chartId;
              }

              // Add controls if not already present
              addControlsToContainer(container, chartId);
            }

            // Mark for resize handling
            container.setAttribute("data-has-chart-controls", "true");

            // Apply adjustment with a slight delay to ensure controls are fully rendered
            setTimeout(() => {
              debugLog(
                "scroll",
                "debug",
                "Applying delayed adjustment to scrolled chart"
              );
              adjustContainerPadding(container);

              // Force a browser reflow to ensure changes take effect immediately
              void container.offsetHeight;
            }, 50);
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 1.0], // Multiple thresholds for better detection
        rootMargin: "100px 0px 300px 0px", // Expanded margins to detect earlier
      }
    );

    // Start observing all chart containers, including ones that already have controls
    const allChartContainers = document.querySelectorAll(".chart-container");
    debugLog(
      "scroll",
      "info",
      `Found ${allChartContainers.length} chart containers to observe`
    );

    allChartContainers.forEach((container, index) => {
      // Add an ID if not present for better debugging
      if (!container.id) {
        container.id = `chart-container-${index}`;
      }

      scrollObserver.observe(container);
      debugLog("scroll", "debug", `Now observing chart: ${container.id}`);

      // Mark for resize handling if it has controls
      if (container.querySelector(`.${config.controlsContainerClass}`)) {
        container.setAttribute("data-has-chart-controls", "true");
        debugLog(
          "scroll",
          "debug",
          `Marked ${container.id} for resize handling`
        );
      }
    });

    // Trigger an immediate check for charts already in view
    setTimeout(() => {
      debugLog("scroll", "debug", "Triggering immediate scroll check");
      window.dispatchEvent(new Event("scroll"));
    }, 100);

    return scrollObserver;
  }

  // Add resize listener with debouncing
  // Improved resize handler with throttling
  let resizeTimeout = null;
  const handleResize = function () {
    // Clear previous timeout
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    // Set a new timeout to prevent excessive adjustments
    resizeTimeout = setTimeout(() => {
      debugLog(
        "events",
        "info",
        "Window resized, adjusting all chart containers"
      );
      const chartContainers = document.querySelectorAll(
        '.chart-container[data-has-chart-controls="true"]'
      );

      // Log the number of containers found for debugging
      debugLog(
        "events",
        "debug",
        `Found ${chartContainers.length} chart containers to adjust`
      );

      // Apply adjustments to each container
      chartContainers.forEach((container) => {
        adjustContainerPadding(container);
      });

      // Clear the timeout reference
      resizeTimeout = null;
    }, 200);
  };

  // Function to adjust all chart containers (used in multiple places)
  const adjustAllChartContainers = function () {
    const chartContainers = document.querySelectorAll(
      '.chart-container[data-has-chart-controls="true"]'
    );

    debugLog(
      "layout",
      "debug",
      `Adjusting ${chartContainers.length} chart containers`
    );

    chartContainers.forEach((container) => {
      adjustContainerPadding(container);
    });
  };

  // Add the event listener
  window.removeEventListener("resize", handleResize); // Remove any existing listeners
  window.addEventListener("resize", handleResize);

  // Add debounce utility function inside the module
  function debounce(func, delay) {
    let debounceTimer;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
  }

  // Public API
  return {
    init: init,
    initWithLazyLoading: initWithLazyLoading,
    addControlsToContainer: addControlsToContainer,
    announceToScreenReader: announceToScreenReader,
    applyPalette: applyPalette,
    utils: Utils,
    palettes: palettes,
    updateChartsForThemeChange: updateChartsForThemeChange, // Added function to the public API
    debounce: debounce, // Export the debounce function for use outside
    adjustContainerPadding: adjustContainerPadding, // Export the adjustment function
    adjustAllChartContainers: adjustAllChartContainers, // Export the container adjustment function
    setupScrollObserver: setupScrollObserver, // Add scroll observer setup function
    config: config, // Expose config object for external use
    // Expose debug configuration for external control
    debugConfig: debugConfig,
    debugLog: debugLog, // Export debug logging function
  };
})();

// Initialise when DOM is fully loaded
document.addEventListener("DOMContentLoaded", function () {
  console.log(
    "[Chart Controls] DOM content loaded, initialising chart controls"
  );

  // Initialise for existing charts
  if (typeof window.ChartControls !== "undefined") {
    window.ChartControls.debugLog(
      "init",
      "info",
      "Found ChartControls module, initialising"
    );

    // Use lazy loading initialisation for better performance
    window.ChartControls.initWithLazyLoading();

    // Perform an immediate adjustment for any containers that are already visible
    window.ChartControls.debugLog(
      "init",
      "info",
      "Performing immediate padding adjustment"
    );
    const visibleContainers = document.querySelectorAll(".chart-container");
    if (visibleContainers.length > 0) {
      window.ChartControls.debugLog(
        "init",
        "info",
        `Found ${visibleContainers.length} chart containers for immediate adjustment`
      );

      // First pass - immediate adjustment
      visibleContainers.forEach((container) => {
        // Mark container for resize handling
        container.setAttribute("data-has-chart-controls", "true");

        // Apply adjustment immediately
        window.ChartControls.adjustContainerPadding(container);

        // Force a browser reflow to ensure changes take effect immediately
        void container.offsetHeight;
      });

      // Trigger an immediate scroll event to ensure all visible charts are adjusted
      const scrollEvent = new Event("scroll");
      window.dispatchEvent(scrollEvent);
    }

    // Use requestAnimationFrame for better performance than setTimeout
    requestAnimationFrame(() => {
      window.ChartControls.debugLog(
        "performance",
        "debug",
        "Running first animation frame adjustment"
      );
      window.ChartControls.adjustAllChartContainers();

      // Schedule a second adjustment to catch any late-rendering elements
      requestAnimationFrame(() => {
        window.ChartControls.debugLog(
          "performance",
          "debug",
          "Running second animation frame adjustment"
        );
        window.ChartControls.adjustAllChartContainers();
      });
    });

    // Set up theme change listener
    const themeToggleButton = document.getElementById("modeToggle");
    if (themeToggleButton) {
      window.ChartControls.debugLog(
        "events",
        "info",
        "Setting up theme change listener"
      );
      themeToggleButton.addEventListener("click", function () {
        window.ChartControls.debugLog("events", "info", "Theme toggle clicked");
        // Wait a small amount of time for the theme to actually change
        setTimeout(() => {
          // No need to check if ChartControls exists since we're inside the module
          window.ChartControls.debugLog(
            "theme",
            "info",
            "Updating charts for theme change"
          );
          window.ChartControls.updateChartsForThemeChange();
          // Also adjust container padding after theme change
          window.ChartControls.adjustAllChartContainers();
        }, 100);
      });
    } else {
      window.ChartControls.debugLog(
        "events",
        "debug",
        "No theme toggle button found"
      );
    }

    // Set up scroll observer to adjust padding when charts come into view
    window.ChartControls.debugLog(
      "scroll",
      "info",
      "Setting up scroll observer for charts in view"
    );
    const scrollObserver = window.ChartControls.setupScrollObserver();

    // Force a check for charts already in view
    window.ChartControls.debugLog(
      "scroll",
      "info",
      "Forcing additional check for charts already in view"
    );
    setTimeout(() => {
      // Trigger a scroll event to force intersection observer to check
      window.dispatchEvent(new Event("scroll"));

      // Also do a direct check for visible charts
      const visibleCharts = Array.from(
        document.querySelectorAll(".chart-container")
      ).filter((container) => {
        const rect = container.getBoundingClientRect();
        const isVisible =
          rect.top >= -100 &&
          rect.left >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight) +
              300 &&
          rect.right <=
            (window.innerWidth || document.documentElement.clientWidth);

        window.ChartControls.debugLog(
          "scroll",
          "debug",
          `Chart ${container.id || "unnamed"} visibility check: ${
            isVisible ? "visible" : "not visible"
          }`
        );
        return isVisible;
      });

      window.ChartControls.debugLog(
        "scroll",
        "info",
        `Found ${visibleCharts.length} charts currently in viewport`
      );
      visibleCharts.forEach((chart) => {
        const controlsClass = window._chartControlsConfig
          ? window._chartControlsConfig.controlsContainerClass
          : "chart-controls";
        if (
          chart.querySelector(
            `.${window.ChartControls.config.controlsContainerClass}`
          )
        ) {
          window.ChartControls.debugLog(
            "scroll",
            "debug",
            `Adjusting visible chart: ${chart.id || "unnamed"}`
          );
          window.ChartControls.adjustContainerPadding(chart);
        }
      });
    }, 300);

    // Also observe changes to handle dynamically added charts
    window.ChartControls.debugLog(
      "mutation",
      "info",
      "Setting up mutation observer for dynamic charts"
    );
    const observer = new MutationObserver(function (mutations) {
      let newChartsFound = false;

      // Process mutations to find new charts
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Element node
              // Check if this is a chart container or contains one
              if (
                node.classList &&
                node.classList.contains("chart-container") &&
                !node.querySelector(".chart-controls")
              ) {
                window.ChartControls.debugLog(
                  "mutation",
                  "info",
                  "Found new chart container node"
                );
                newChartsFound = true;
              } else {
                // Check for chart containers inside this node
                const containersWithoutControls =
                  window.ChartControls.utils.findContainersWithoutControls(
                    node
                  );
                if (containersWithoutControls.length > 0) {
                  window.ChartControls.debugLog(
                    "mutation",
                    "info",
                    `Found ${containersWithoutControls.length} new chart containers inside node`
                  );
                  newChartsFound = true;
                }
              }
            }
          });
        }
      });

      // Add a scroll event listener to ensure charts are adjusted when scrolling
      // This should be inside a function like setupScrollObserver or similar
      const scrollHandler = window.ChartControls.debounce(() => {
        // Store a reference to the config object to use in this scope
        const chartConfig = window.ChartControls.config;

        const visibleCharts = Array.from(
          document.querySelectorAll(".chart-container")
        ).filter((container) => {
          // Skip containers in fullscreen mode
          if (container.getAttribute("data-in-fullscreen") === "true") {
            window.ChartControls.debugLog(
              "scroll",
              "debug",
              `Skipping fullscreen container: ${container.id}`
            );
            return false;
          }

          const rect = container.getBoundingClientRect();
          return (
            rect.top >= -100 &&
            rect.left >= 0 &&
            rect.bottom <=
              (window.innerHeight || document.documentElement.clientHeight) +
                300 &&
            rect.right <=
              (window.innerWidth || document.documentElement.clientWidth)
          );
        });

        if (visibleCharts.length > 0) {
          window.ChartControls.debugLog(
            "scroll",
            "debug",
            `Adjusting ${visibleCharts.length} visible charts`
          );
          visibleCharts.forEach((chart) => {
            // Use chartConfig instead of config here
            if (chart.querySelector(`.${chartConfig.controlsContainerClass}`)) {
              window.ChartControls.adjustContainerPadding(chart);
            }
          });
        }
      }, 250); // Increase debounce time to reduce frequency of adjustments

      window.addEventListener("scroll", scrollHandler);

      // Only initialise if new charts without controls were found
      if (newChartsFound) {
        window.ChartControls.debugLog(
          "mutation",
          "info",
          "New charts detected, initialising controls immediately"
        );
        window.ChartControls.initWithLazyLoading(document);

        // Immediately adjust padding for new charts without waiting
        window.ChartControls.debugLog(
          "mutation",
          "debug",
          "Immediately adjusting padding for new charts"
        );
        window.ChartControls.adjustAllChartContainers();

        // Add new charts to the scroll observer right away
        if (scrollObserver) {
          window.ChartControls.debugLog(
            "mutation",
            "debug",
            "Immediately adding new charts to scroll observer"
          );
          const newCharts = document.querySelectorAll(".chart-container");
          newCharts.forEach((container) => {
            // Force immediate adjustment for each container
            if (container.querySelector(".chart-controls")) {
              // Mark for resize handling
              container.setAttribute("data-has-chart-controls", "true");

              // Apply adjustment immediately
              window.ChartControls.adjustContainerPadding(container);

              // Force a browser reflow to ensure changes take effect immediately
              void container.offsetHeight;
            }

            // Add to scroll observer regardless of controls status
            scrollObserver.observe(container);
          });
        }

        // Trigger an immediate scroll event to catch any charts in the viewport
        const scrollEvent = new Event("scroll");
        window.dispatchEvent(scrollEvent);

        // Still do a final check after a very short delay to catch any late renders
        requestAnimationFrame(() => {
          window.ChartControls.adjustAllChartContainers();
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Trigger an adjustment when images load, as they can affect layout
    window.addEventListener("load", function () {
      window.ChartControls.debugLog(
        "events",
        "info",
        "Window load event fired, adjusting containers"
      );
      setTimeout(() => {
        window.ChartControls.adjustAllChartContainers();
      }, 200);
    });

    // Also adjust containers when fonts load, which can affect layout
    if (document.fonts && typeof document.fonts.ready === "function") {
      document.fonts.ready.then(function () {
        window.ChartControls.debugLog(
          "events",
          "info",
          "Fonts loaded, adjusting containers"
        );
        window.ChartControls.adjustAllChartContainers();
      });
    }
  }
});

// Make debugLog function available globally for easy access in console
window.ChartControlsDebug = {
  log: function (area, level, message, data) {
    if (window.ChartControls && window.ChartControls.debugLog) {
      window.ChartControls.debugLog(area, level, message, data);
    }
  },
  enable: function (area) {
    if (window.ChartControls && window.ChartControls.debugConfig) {
      window.ChartControls.debugConfig.enabled = true;
      if (area) {
        window.ChartControls.debugConfig.areas[area] = true;
        console.log(`[Chart Controls Debug] Enabled logging for area: ${area}`);
      } else {
        // Enable all areas
        Object.keys(window.ChartControls.debugConfig.areas).forEach((key) => {
          window.ChartControls.debugConfig.areas[key] = true;
        });
        console.log("[Chart Controls Debug] Enabled logging for all areas");
      }
    }
  },
  disable: function (area) {
    if (window.ChartControls && window.ChartControls.debugConfig) {
      if (area) {
        window.ChartControls.debugConfig.areas[area] = false;
        console.log(
          `[Chart Controls Debug] Disabled logging for area: ${area}`
        );
      } else {
        // Disable all areas
        window.ChartControls.debugConfig.enabled = false;
        console.log("[Chart Controls Debug] Disabled all logging");
      }
    }
  },
  status: function () {
    if (window.ChartControls && window.ChartControls.debugConfig) {
      console.log(
        "[Chart Controls Debug] Current configuration:",
        window.ChartControls.debugConfig
      );
    }
  },
  areas: function () {
    if (window.ChartControls && window.ChartControls.debugConfig) {
      console.log(
        "[Chart Controls Debug] Available areas:",
        Object.keys(window.ChartControls.debugConfig.areas)
      );
    }
  },
};
