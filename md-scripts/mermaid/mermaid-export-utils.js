/**
 * Mermaid Export Utilities
 * Enhanced export functions for Mermaid diagrams with text wrapping fixes and consistent Verdana font
 */
window.MermaidExportUtils = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level - can be overridden by flags
  let currentLogLevel = DEFAULT_LOG_LEVEL;
  if (ENABLE_ALL_LOGGING) {
    currentLogLevel = LOG_LEVELS.DEBUG;
  } else if (DISABLE_ALL_LOGGING) {
    currentLogLevel = -1; // Disable all logging
  }

  // Helper functions to check if logging should occur
  function shouldLog(level) {
    return currentLogLevel >= level;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Configuration
  const config = {
    viewBoxPadding: 50, // Add some padding to the viewBox if needed
    pngScale: 3, // Base scale for PNG exports (increased from 2 to 3)
    highDpiScale: 4, // High DPI scale for smaller diagrams
    maxDpiScale: 6, // Maximum DPI scale for very small diagrams
    ariaLiveRegionId: "sr-announcer",
    debugMode: true,
    font: '"trebuchet ms", verdana, arial, sans-serif', // Updated to match working mermaid-cli font
    minWidth: 700, // Minimum width for exports
    minHeight: 900, // Minimum height for exports
    // DPI quality thresholds
    dpiThresholds: {
      small: 100000, // diagrams smaller than 100k pixels get max DPI
      medium: 500000, // diagrams smaller than 500k pixels get high DPI
      large: 1000000, // diagrams smaller than 1M pixels get standard high DPI
      // anything larger gets base DPI
    },
    maxCanvasPixels: 16777216, // 4096x4096 - browser canvas limit safety margin
  };

  /**
   * Fix text wrapping in SVG elements and apply consistent font
   * @param {SVGElement} svgElement - The SVG element to prepare
   * @returns {SVGElement} Prepared SVG clone with fixed text wrapping and font
   */
  function prepareSvgForExport(svgElement) {
    if (!svgElement) {
      logError(
        "[Mermaid Export] No SVG element provided for export preparation"
      );
      return null;
    }

    logInfo("[Mermaid Export] Starting SVG preparation for export");

    // Create a clone to avoid modifying the displayed SVG
    const clone = svgElement.cloneNode(true);

    // Set the background to white
    clone.style.backgroundColor = "white";

    // Apply font family to SVG root
    clone.style.fontFamily = config.font;
    logDebug(`[Mermaid Export] Applied font family: ${config.font}`);

    // Get the original viewBox and dimensions
    const originalViewBox = svgElement.getAttribute("viewBox");
    const originalWidth =
      svgElement.width?.baseVal?.value ||
      svgElement.getBoundingClientRect().width;
    const originalHeight =
      svgElement.height?.baseVal?.value ||
      svgElement.getBoundingClientRect().height;

    // Store original dimensions for debugging
    if (config.debugMode) {
      logDebug(
        `[Mermaid Export] Original dimensions: ${originalWidth}x${originalHeight}`
      );
      logDebug(`[Mermaid Export] Original viewBox: ${originalViewBox}`);
    }

    // Ensure the SVG has enough width and height
    const width = Math.max(originalWidth, config.minWidth);
    const height = Math.max(originalHeight, config.minHeight);

    // Set proper dimensions on the clone
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    // Process the viewBox
    if (originalViewBox) {
      const viewBoxValues = originalViewBox.split(" ").map(parseFloat);
      if (viewBoxValues.length === 4) {
        // Add padding to the viewBox to ensure text isn't cut off
        const paddedViewBox = [
          viewBoxValues[0] - config.viewBoxPadding,
          viewBoxValues[1] - config.viewBoxPadding,
          viewBoxValues[2] + config.viewBoxPadding * 2,
          viewBoxValues[3] + config.viewBoxPadding * 2,
        ].join(" ");

        // Set the padded viewBox
        clone.setAttribute("viewBox", paddedViewBox);

        if (config.debugMode) {
          logDebug(`[Mermaid Export] Padded viewBox: ${paddedViewBox}`);
        }
      }
    }

    // Fix foreignObject div text wrapping issues - MAIN FIX
    const foreignObjectDivs = clone.querySelectorAll("foreignObject div");
    logDebug(
      `[Mermaid Export] Found ${foreignObjectDivs.length} foreignObject divs to process`
    );

    foreignObjectDivs.forEach((div, index) => {
      logDebug(
        `[Mermaid Export] Processing foreignObject div ${index + 1}/${
          foreignObjectDivs.length
        }`
      );
      logDebug(`[Mermaid Export] Original div styles:`, {
        whiteSpace: div.style.whiteSpace,
        display: div.style.display,
        width: div.style.width,
        overflow: div.style.overflow,
      });

      // Apply critical text wrapping fixes based on working mermaid-cli exports
      div.style.whiteSpace = "break-spaces"; // Changed from "normal" to "break-spaces"
      div.style.display = "table"; // Changed from "block" to "table"
      div.style.overflow = "visible";
      div.style.fontFamily = config.font;

      // Get the foreignObject parent to determine width
      const foreignObject = div.closest("foreignObject");
      if (foreignObject) {
        const foreignObjectWidth = foreignObject.getAttribute("width");
        if (foreignObjectWidth) {
          const availableWidth = parseInt(foreignObjectWidth);
          // Use full width instead of reducing by 10px - this was causing text overflow
          div.style.width = `${availableWidth}px`;
          logDebug(
            `[Mermaid Export] Set div width to full foreignObject width: ${availableWidth}px`
          );
        } else {
          logWarn(
            `[Mermaid Export] ForeignObject ${index + 1} has no width attribute`
          );
        }
      } else {
        logWarn(
          `[Mermaid Export] Div ${index + 1} has no foreignObject parent`
        );
      }

      logDebug(`[Mermaid Export] Updated div styles:`, {
        whiteSpace: div.style.whiteSpace,
        display: div.style.display,
        width: div.style.width,
        overflow: div.style.overflow,
        fontFamily: div.style.fontFamily,
      });
    });

    // Fix edge label text wrapping
    const edgeLabels = clone.querySelectorAll(".edgeLabel div");
    logDebug(
      `[Mermaid Export] Found ${edgeLabels.length} edge label divs to process`
    );

    edgeLabels.forEach((div, index) => {
      logDebug(
        `[Mermaid Export] Processing edge label div ${index + 1}/${
          edgeLabels.length
        }`
      );
      div.style.whiteSpace = "break-spaces"; // Changed from "normal" to "break-spaces"
      div.style.display = "table"; // Changed from "block" to "table"
      div.style.fontFamily = config.font;
    });

    // Apply styles to all text elements
    const textElements = clone.querySelectorAll("text, tspan");
    logDebug(
      `[Mermaid Export] Found ${textElements.length} text elements to process`
    );

    textElements.forEach((el) => {
      el.style.fontFamily = config.font;
      el.setAttribute("font-family", config.font);
    });

    // Add a comprehensive style element with improved text handling
    const styleElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style"
    );
    styleElement.textContent = `
        /* Global font selector */
        * {
          font-family: ${config.font} !important;
        }
        
        /* Font styles */
        svg, text, tspan, div, span, foreignObject, p, .nodeLabel {
          font-family: ${config.font} !important;
        }
        
        /* Text element styles with improved wrapping */
        .nodeLabel div, foreignObject div {
          white-space: break-spaces !important; 
          display: table !important;
          overflow: visible !important;
          font-family: ${config.font} !important;
          line-height: 1.5 !important;
          text-align: center !important;
        }
        
        /* Edge label styles with improved wrapping */
        .edgeLabel div {
          white-space: break-spaces !important;
          display: table !important;
          font-family: ${config.font} !important;
          line-height: 1.5 !important;
          text-align: center !important;
        }

        /* Ensure foreignObject elements don't clip text */
        foreignObject {
          overflow: visible !important;
        }
      `;
    clone.insertBefore(styleElement, clone.firstChild);
    logDebug("[Mermaid Export] Added comprehensive style element");

    // Fix any existing style elements by overriding critical properties
    const existingStyles = clone.querySelectorAll("style");
    logDebug(
      `[Mermaid Export] Found ${existingStyles.length} existing style elements`
    );

    existingStyles.forEach((style, index) => {
      if (style !== styleElement) {
        logDebug(
          `[Mermaid Export] Updating existing style element ${index + 1}`
        );
        style.textContent += `
            /* Override problematic styles for text wrapping */
            div { 
              white-space: break-spaces !important; 
              display: table !important;
            }
            .labelBkg div, .edgeLabel div, foreignObject div, .nodeLabel div {
              white-space: break-spaces !important;
              display: table !important;
              overflow: visible !important;
              line-height: 1.5 !important;
            }
          `;
      }
    });

    // Set preserveAspectRatio attribute
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    logInfo(
      "[Mermaid Export] Prepared SVG with enhanced text wrapping and font fixes"
    );

    // Debug: Log some key measurements
    if (config.debugMode) {
      const finalForeignObjects = clone.querySelectorAll("foreignObject");
      logDebug(
        `[Mermaid Export] Final foreignObject count: ${finalForeignObjects.length}`
      );
      finalForeignObjects.forEach((fo, index) => {
        const width = fo.getAttribute("width");
        const height = fo.getAttribute("height");
        const childDiv = fo.querySelector("div");
        logDebug(
          `[Mermaid Export] ForeignObject ${
            index + 1
          }: width=${width}, height=${height}, div width=${
            childDiv?.style.width
          }`
        );
      });
    }

    return clone;
  }

  /**
   * Export diagram as SVG
   * @param {HTMLElement} container - The Mermaid container element
   * @param {string|number} id - Unique identifier for the filename
   */
  function exportAsSvg(container, id) {
    try {
      logInfo(`[Mermaid Export] Starting SVG export for diagram ${id}`);

      // Find the SVG element, specifically looking inside the .mermaid div
      const mermaidDiv = container.querySelector(".mermaid");
      const svgElement = mermaidDiv ? mermaidDiv.querySelector("svg") : null;

      if (!svgElement) {
        logError("[Mermaid Export] No diagram SVG found for export");
        announceToScreenReader("Failed to find diagram for SVG export");
        return;
      }

      logDebug("[Mermaid Export] Found SVG element, preparing for export");

      // Fix text wrapping and apply fonts to the SVG
      const preparedSvg = prepareSvgForExport(svgElement);

      if (!preparedSvg) {
        logError("[Mermaid Export] Failed to prepare SVG for export");
        announceToScreenReader("Failed to prepare SVG for export");
        return;
      }

      logInfo("[Mermaid Export] SVG prepared successfully, serialising");

      // Serialise the SVG to a string
      const svgData = new XMLSerializer().serializeToString(preparedSvg);

      logDebug(
        `[Mermaid Export] Serialised SVG length: ${svgData.length} characters`
      );

      // Create a blob with the SVG data
      const svgBlob = new Blob(
        ['<?xml version="1.0" standalone="no"?>\r\n', svgData],
        {
          type: "image/svg+xml;charset=utf-8",
        }
      );

      // Create download link
      const url = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `diagram-${id}.svg`;

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);

      logInfo(
        `[Mermaid Export] SVG export completed successfully for diagram ${id}`
      );
      // Announce to screen readers
      announceToScreenReader("SVG downloaded successfully");
    } catch (error) {
      logError("[Mermaid Export] Error exporting SVG:", error);
      announceToScreenReader("Failed to download SVG");
    }
  }

  /**
   * Export diagram as PNG
   * @param {HTMLElement} container - The Mermaid container element
   * @param {string|number} id - Unique identifier for the filename
   */
  function exportAsPng(container, id) {
    try {
      logInfo(`[Mermaid Export] Starting PNG export for diagram ${id}`);

      // Find the SVG element, specifically looking inside the .mermaid div
      const mermaidDiv = container.querySelector(".mermaid");
      const svgElement = mermaidDiv ? mermaidDiv.querySelector("svg") : null;

      if (!svgElement) {
        logError("[Mermaid Export] No diagram SVG found for export");
        announceToScreenReader("Failed to find diagram for PNG export");
        return;
      }

      logDebug("[Mermaid Export] Found SVG element, preparing for PNG export");

      // Fix text wrapping and apply fonts to the SVG
      const preparedSvg = prepareSvgForExport(svgElement);

      if (!preparedSvg) {
        logError("[Mermaid Export] Failed to prepare SVG for PNG export");
        announceToScreenReader("Failed to prepare SVG for export");
        return;
      }

      // Get the viewBox values to determine true aspect ratio
      const viewBox = preparedSvg.getAttribute("viewBox");
      let viewBoxWidth, viewBoxHeight, originalAspectRatio;

      if (viewBox) {
        const viewBoxValues = viewBox.split(" ").map(parseFloat);
        if (viewBoxValues.length === 4) {
          viewBoxWidth = Math.abs(viewBoxValues[2] - viewBoxValues[0]);
          viewBoxHeight = Math.abs(viewBoxValues[3] - viewBoxValues[1]);
          originalAspectRatio = viewBoxWidth / viewBoxHeight;
          logDebug(
            `[Mermaid Export] ViewBox dimensions: ${viewBoxWidth} x ${viewBoxHeight}, aspect ratio: ${originalAspectRatio}`
          );
        }
      }

      // Get SVG element dimensions as fallback
      const svgWidth =
        parseFloat(preparedSvg.getAttribute("width")) ||
        viewBoxWidth ||
        config.minWidth;
      const svgHeight =
        parseFloat(preparedSvg.getAttribute("height")) ||
        viewBoxHeight ||
        config.minHeight;

      // Use the more reliable aspect ratio
      if (!originalAspectRatio) {
        originalAspectRatio = svgWidth / svgHeight;
        logDebug(
          `[Mermaid Export] Using SVG dimensions: ${svgWidth} x ${svgHeight}, aspect ratio: ${originalAspectRatio}`
        );
      }

      // Calculate proper PNG dimensions while preserving aspect ratio
      let width, height;

      // Start with a reasonable base size that respects the aspect ratio
      const targetWidth = Math.max(svgWidth, 800); // Minimum reasonable width
      const targetHeight = Math.max(svgHeight, 600); // Minimum reasonable height

      // Determine which dimension to use as the base and scale accordingly
      if (originalAspectRatio > 1) {
        // Width is greater than height (landscape)
        width = Math.min(targetWidth, 1600); // Cap at reasonable maximum
        height = width / originalAspectRatio;
      } else {
        // Height is greater than width (portrait) or square
        height = Math.min(targetHeight, 1200); // Cap at reasonable maximum
        width = height * originalAspectRatio;
      }

      // Apply minimum constraints only if they don't severely distort the aspect ratio
      const minWidth = 600; // Reduced from 700 to be less aggressive
      const minHeight = 400; // Reduced from 900 to be less aggressive

      if (width < minWidth) {
        const scaleFactor = minWidth / width;
        width = minWidth;
        height = height * scaleFactor;
      }

      if (height < minHeight) {
        const scaleFactor = minHeight / height;
        height = minHeight;
        width = width * scaleFactor;
      }

      // Final constraint to prevent excessively large images
      const maxDimension = 2400;
      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = width * scale;
        height = height * scale;
      }

      // Round to whole numbers
      width = Math.round(width);
      height = Math.round(height);

      /**
       * Calculate optimal DPI scale factor based on diagram size and complexity
       * @param {number} width - Base width of the diagram
       * @param {number} height - Base height of the diagram
       * @returns {number} Optimal scale factor for high DPI rendering
       */
      function calculateOptimalDpiScale(width, height) {
        const basePixels = width * height;
        logDebug(
          `[Mermaid Export] Base diagram size: ${width}x${height} = ${basePixels} pixels`
        );

        let optimalScale;

        // Determine scale based on diagram size
        if (basePixels <= config.dpiThresholds.small) {
          optimalScale = config.maxDpiScale; // 6x for very small diagrams
          logDebug(
            `[Mermaid Export] Small diagram detected - using maximum DPI scale: ${optimalScale}x`
          );
        } else if (basePixels <= config.dpiThresholds.medium) {
          optimalScale = config.highDpiScale; // 4x for medium diagrams
          logDebug(
            `[Mermaid Export] Medium diagram detected - using high DPI scale: ${optimalScale}x`
          );
        } else if (basePixels <= config.dpiThresholds.large) {
          optimalScale = config.pngScale; // 3x for large diagrams
          logDebug(
            `[Mermaid Export] Large diagram detected - using standard DPI scale: ${optimalScale}x`
          );
        } else {
          optimalScale = Math.max(2, config.pngScale - 1); // 2x for very large diagrams
          logDebug(
            `[Mermaid Export] Very large diagram detected - using reduced DPI scale: ${optimalScale}x`
          );
        }

        // Safety check: ensure we don't exceed canvas limits
        const scaledPixels = width * optimalScale * (height * optimalScale);
        if (scaledPixels > config.maxCanvasPixels) {
          // Calculate the maximum safe scale
          const maxSafeScale = Math.floor(
            Math.sqrt(config.maxCanvasPixels / basePixels)
          );
          optimalScale = Math.max(1, Math.min(optimalScale, maxSafeScale));
          logDebug(
            `[Mermaid Export] Canvas size limit reached - reducing scale to safe maximum: ${optimalScale}x`
          );
          logDebug(
            `[Mermaid Export] Final canvas size will be: ${
              width * optimalScale
            }x${height * optimalScale} = ${scaledPixels} pixels`
          );
        } else {
          logDebug(
            `[Mermaid Export] Canvas size within limits: ${
              width * optimalScale
            }x${height * optimalScale} = ${scaledPixels} pixels`
          );
        }

        return optimalScale;
      }

      // Create a canvas with the proper dimensions and scale
      const canvas = document.createElement("canvas");
      canvas.width = width * config.pngScale;
      canvas.height = height * config.pngScale;

      const ctx = canvas.getContext("2d");
      ctx.scale(config.pngScale, config.pngScale);

      // Draw white background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      logDebug("[Mermaid Export] Canvas prepared, converting SVG to data URL");

      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(preparedSvg);

      // Fix any namespace issues
      const svgDataFixed = svgData
        .replace(/NS\d+:xmlns/g, "xmlns")
        .replace(/xmlns:NS\d+=""/g, "");

      const svgUrl =
        "data:image/svg+xml;base64," +
        btoa(unescape(encodeURIComponent(svgDataFixed)));

      logDebug(
        `[Mermaid Export] SVG data URL created, length: ${svgUrl.length}`
      );

      // Create an image and draw it to the canvas when loaded
      const img = new Image();

      img.onload = function () {
        logDebug(
          "[Mermaid Export] Image loaded successfully, drawing to canvas"
        );

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to PNG with maximum quality
        const pngUrl = canvas.toDataURL("image/png", 1.0); // Maximum quality

        logInfo("[Mermaid Export] PNG conversion completed with high DPI");
        logDebug(
          `[Mermaid Export] Final PNG file estimated size: ~${Math.round(
            (pngUrl.length * 0.75) / 1024
          )}KB`
        );

        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `diagram-${id}.png`;

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        logInfo(
          `[Mermaid Export] PNG export completed successfully for diagram ${id}`
        );
        // Announce to screen readers
        announceToScreenReader("PNG downloaded successfully");
      };

      img.onerror = function (e) {
        logError("[Mermaid Export] Error loading SVG for PNG conversion:", e);
        logDebug(
          "[Mermaid Export] SVG data causing error (first 200 chars):",
          svgUrl.substring(0, 200) + "..."
        );
        announceToScreenReader("Failed to convert SVG to PNG");
      };

      img.src = svgUrl;
    } catch (error) {
      logError("[Mermaid Export] Error exporting PNG:", error);
      announceToScreenReader("Failed to download PNG");
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    // Find or create screen reader announcer
    let announcer = document.getElementById(config.ariaLiveRegionId);

    if (!announcer) {
      // Create screen reader announcer element
      announcer = document.createElement("div");
      announcer.id = config.ariaLiveRegionId;
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

  // Module initialised message
  logInfo("[Mermaid Export] Export utilities module initialised");

  // Public API
  return {
    exportAsSvg: exportAsSvg,
    exportAsPng: exportAsPng,
    prepareSvgForExport: prepareSvgForExport,
    config: config, // Expose config for external modification if needed
  };
})();
