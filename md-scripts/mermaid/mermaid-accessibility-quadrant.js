/**
 * Mermaid Accessibility - Quadrant Chart Module
 * Generates accessible descriptions for quadrant charts
 */
(function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) {
      return false;
    }
    if (ENABLE_ALL_LOGGING) {
      return true;
    }
    return level <= currentLogLevel;
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

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;
  const Common = window.MermaidAccessibilityCommon;

  /**
   * Parse quadrant chart structure from mermaid code
   * @param {string} code - The mermaid code
   * @param {HTMLElement} svgElement - The SVG element (fallback)
   * @returns {Object} Parsed quadrant chart data
   */
  function parseQuadrantChart(code, svgElement) {
    // Initialize result structure
    const result = {
      title: "",
      axes: {
        x: { left: "", right: "" },
        y: { bottom: "", top: "" },
      },
      quadrants: [
        { id: 1, position: "top-right", label: "" },
        { id: 2, position: "top-left", label: "" },
        { id: 3, position: "bottom-left", label: "" },
        { id: 4, position: "bottom-right", label: "" },
      ],
      points: [],
    };

    try {
      // Parse from mermaid code
      const lines = code
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      // Process each line
      for (const line of lines) {
        // Extract title
        if (line.startsWith("title ")) {
          result.title = line.substring(6).trim();
          continue;
        }

        // Extract x-axis
        if (line.startsWith("x-axis ")) {
          const axisText = line.substring(7).trim();
          const parts = axisText.split("-->");

          if (parts.length >= 1) {
            result.axes.x.left = parts[0].trim();
          }

          if (parts.length >= 2) {
            result.axes.x.right = parts[1].trim();
          }
          continue;
        }

        // Extract y-axis
        if (line.startsWith("y-axis ")) {
          const axisText = line.substring(7).trim();
          const parts = axisText.split("-->");

          if (parts.length >= 1) {
            result.axes.y.bottom = parts[0].trim();
          }

          if (parts.length >= 2) {
            result.axes.y.top = parts[1].trim();
          }
          continue;
        }

        // Extract quadrant labels
        if (line.startsWith("quadrant-1 ")) {
          result.quadrants[0].label = line.substring(11).trim();
          continue;
        }

        if (line.startsWith("quadrant-2 ")) {
          result.quadrants[1].label = line.substring(11).trim();
          continue;
        }

        if (line.startsWith("quadrant-3 ")) {
          result.quadrants[2].label = line.substring(11).trim();
          continue;
        }

        if (line.startsWith("quadrant-4 ")) {
          result.quadrants[3].label = line.substring(11).trim();
          continue;
        }

        // Extract points
        // Format: "Name: [x, y]" or "Name:::class: [x, y]" or with styling
        const pointMatch = line.match(
          /^([^:]+)(?:::([^:]+))?:\s*\[([\d.]+),\s*([\d.]+)\](.*)/
        );
        if (pointMatch) {
          const pointName = pointMatch[1].trim();
          const pointClass = pointMatch[2] || "";
          const x = parseFloat(pointMatch[3]);
          const y = parseFloat(pointMatch[4]);
          const stylingText = pointMatch[5] || "";

          // Parse styling if present
          const styling = {};

          if (stylingText) {
            // Extract radius
            const radiusMatch = stylingText.match(/radius:\s*([\d.]+)/);
            if (radiusMatch) {
              styling.radius = parseFloat(radiusMatch[1]);
            }

            // Extract colour
            const colourMatch = stylingText.match(
              /color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/
            );
            if (colourMatch) {
              styling.colour = colourMatch[1];
            }

            // Extract stroke-width
            const strokeWidthMatch = stylingText.match(
              /stroke-width:\s*([\d.]+)px/
            );
            if (strokeWidthMatch) {
              styling.strokeWidth = parseFloat(strokeWidthMatch[1]);
            }

            // Extract stroke-colour
            const strokeColourMatch = stylingText.match(
              /stroke-color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/
            );
            if (strokeColourMatch) {
              styling.strokeColour = strokeColourMatch[1];
            }
          }

          // Determine quadrant based on coordinates
          let quadrant = 0;
          const xBoundary = isBoundaryPosition(x);
          const yBoundary = isBoundaryPosition(y);

          // Handle special boundary cases
          if (xBoundary.isCenter && yBoundary.isCenter) {
            // Point is at the exact center - special case
            quadrant = 0; // Special center case
          } else if (xBoundary.isCenter) {
            // On vertical boundary - assign to the quadrant on the right if y >= 0.5, left if y < 0.5
            quadrant = y >= 0.5 ? 1 : 4;
          } else if (yBoundary.isCenter) {
            // On horizontal boundary - assign to the quadrant on top if x < 0.5, bottom if x >= 0.5
            quadrant = x < 0.5 ? 2 : 1;
          } else {
            // Standard quadrant determination
            if (x >= 0.5 && y >= 0.5) {
              quadrant = 1; // top-right
            } else if (x < 0.5 && y >= 0.5) {
              quadrant = 2; // top-left
            } else if (x < 0.5 && y < 0.5) {
              quadrant = 3; // bottom-left
            } else {
              quadrant = 4; // bottom-right
            }
          }

          // Add point to result
          result.points.push({
            name: pointName,
            coordinates: [x, y],
            quadrant: quadrant,
            class: pointClass,
            styling: styling,
          });
        }

        // Parse class definitions
        const classDefMatch = line.match(/^classDef\s+([^\s]+)\s+(.*)/);
        if (classDefMatch) {
          const className = classDefMatch[1];
          const styleText = classDefMatch[2];

          // Parse class styles
          const classStyle = {};

          // Extract colour
          const colourMatch = styleText.match(
            /color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/
          );
          if (colourMatch) {
            classStyle.colour = colourMatch[1];
          }

          // Extract radius
          const radiusMatch = styleText.match(/radius\s*:\s*([\d.]+)/);
          if (radiusMatch) {
            classStyle.radius = parseFloat(radiusMatch[1]);
          }

          // Extract stroke-width
          const strokeWidthMatch = styleText.match(
            /stroke-width:\s*([\d.]+)px/
          );
          if (strokeWidthMatch) {
            classStyle.strokeWidth = parseFloat(strokeWidthMatch[1]);
          }

          // Extract stroke-colour
          const strokeColourMatch = styleText.match(
            /stroke-color:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/
          );
          if (strokeColourMatch) {
            classStyle.strokeColour = strokeColourMatch[1];
          }

          // Apply class style to points with this class
          result.points.forEach((point) => {
            if (point.class === className) {
              // Apply class styles (direct styles take precedence)
              point.styling = { ...classStyle, ...point.styling };
            }
          });
        }
      }

      // Fallback to SVG parsing if needed (empty result)
      if (!result.title && !result.axes.x.left && svgElement) {
        // Basic SVG extraction - fallback for when code isn't available
        try {
          // Try to extract title from SVG
          const titleElement = svgElement.querySelector("text.quadrant-title");
          if (titleElement) {
            result.title = titleElement.textContent.trim();
          }

          // Extract axes from SVG if possible
          const xAxisElements = svgElement.querySelectorAll(
            "text.quadrant-x-axis-text"
          );
          if (xAxisElements.length >= 2) {
            result.axes.x.left = xAxisElements[0].textContent.trim();
            result.axes.x.right = xAxisElements[1].textContent.trim();
          }

          const yAxisElements = svgElement.querySelectorAll(
            "text.quadrant-y-axis-text"
          );
          if (yAxisElements.length >= 2) {
            result.axes.y.bottom = yAxisElements[0].textContent.trim();
            result.axes.y.top = yAxisElements[1].textContent.trim();
          }

          // Extract quadrant labels if possible
          const quadrantLabels = svgElement.querySelectorAll(
            "text.quadrant-label"
          );
          for (let i = 0; i < Math.min(quadrantLabels.length, 4); i++) {
            result.quadrants[i].label = quadrantLabels[i].textContent.trim();
          }

          // Extract points - this is more complex and less reliable from SVG
          const pointElements = svgElement.querySelectorAll(
            "circle.quadrant-point"
          );
          pointElements.forEach((pointEl, index) => {
            // Try to find associated text element
            const textEl = svgElement.querySelector(
              `text[data-point-id="${pointEl.id}"]`
            );
            const name = textEl
              ? textEl.textContent.trim()
              : `Point ${index + 1}`;

            // Try to extract coordinates
            let x = 0.5;
            let y = 0.5;
            try {
              const cx = parseFloat(pointEl.getAttribute("cx"));
              const cy = parseFloat(pointEl.getAttribute("cy"));
              // Normalize to 0-1 range based on viewBox
              const svgWidth = parseFloat(svgElement.getAttribute("width"));
              const svgHeight = parseFloat(svgElement.getAttribute("height"));
              if (svgWidth && svgHeight) {
                x = cx / svgWidth;
                y = 1 - cy / svgHeight; // Y is inverted in SVG
              }
            } catch (err) {
              logWarn(
                "[Mermaid Accessibility] Error extracting point coordinates from SVG",
                err
              );
            }

            // Determine quadrant
            let quadrant = 0;
            if (x >= 0.5 && y >= 0.5) {
              quadrant = 1; // top-right
            } else if (x < 0.5 && y >= 0.5) {
              quadrant = 2; // top-left
            } else if (x < 0.5 && y < 0.5) {
              quadrant = 3; // bottom-left
            } else {
              quadrant = 4; // bottom-right
            }

            // Add point
            result.points.push({
              name: name,
              coordinates: [x, y],
              quadrant: quadrant,
              styling: {},
            });
          });
        } catch (svgErr) {
          logWarn(
            "[Mermaid Accessibility] Error parsing quadrant chart from SVG:",
            svgErr
          );
        }
      }

      return result;
    } catch (error) {
      logError("[Mermaid Accessibility] Error parsing quadrant chart:", error);
      return result;
    }
  }

  /**
   * Determine if a point is on or very close to a boundary
   * @param {number} value - The coordinate value (x or y)
   * @param {number} threshold - The threshold to consider "on boundary" (default: 0.02)
   * @param {number} centerValue - The center value (default: 0.5)
   * @returns {Object} Object with boundary information
   */
  function isBoundaryPosition(value, threshold = 0.02, centerValue = 0.5) {
    return {
      isMin: Math.abs(value) <= threshold, // Near minimum (0)
      isMax: Math.abs(value - 1) <= threshold, // Near maximum (1)
      isCenter: Math.abs(value - centerValue) <= threshold, // Near center (0.5)
      value: value, // Original value
    };
  }

  /**
   * Generate a short description for a quadrant chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    try {
      // Parse the quadrant chart structure
      const chart = parseQuadrantChart(code, svgElement);

      // Count points in each quadrant
      const quadrantCounts = [0, 0, 0, 0]; // For quadrants 1-4
      chart.points.forEach((point) => {
        if (point.quadrant >= 1 && point.quadrant <= 4) {
          quadrantCounts[point.quadrant - 1]++;
        }
      });

      // The two tiers are built SIDE BY SIDE from the same raw fields.
      //
      // The plain tier used to be derived as htmlDescription.replace(/<[^>]*>/g, ""),
      // which could not tell the author's markup from the generator's own spans:
      // an author's <b> was silently deleted, and a lone '<' paired with the '>'
      // closing a generator span and truncated the sentence. Building it from the
      // raw fields removes the derivation entirely.
      //
      // Diagram-source text is escaped once, on the HTML side only, where it
      // enters an HTML string. The plain side keeps the raw values: it feeds the
      // SVG aria-label and the textContent fallback, neither of which parses
      // HTML, so entities there would be announced literally.
      let htmlDescription = `A quadrant chart`;
      let plainTextDescription = `A quadrant chart`;

      if (chart.title) {
        htmlDescription += ` titled "<span class="diagram-title">${Common.escapeHtml(
          chart.title
        )}</span>"`;
        plainTextDescription += ` titled "${chart.title}"`;
      }

      // Add a simple explanation of what a quadrant chart is

      htmlDescription += `. This chart compares `;
      plainTextDescription += `. This chart compares `;

      // Add axis information with ranges
      if (chart.axes.x.left && chart.axes.x.right) {
        htmlDescription += `<span class="axis x-axis">${Common.escapeHtml(
          chart.axes.x.left
        )} to ${Common.escapeHtml(
          chart.axes.x.right
        )}</span> on the x-axis (horizontal)`;
        plainTextDescription += `${chart.axes.x.left} to ${chart.axes.x.right} on the x-axis (horizontal)`;
      } else {
        htmlDescription += `values on the x-axis (horizontal)`;
        plainTextDescription += `values on the x-axis (horizontal)`;
      }

      htmlDescription += ` and `;
      plainTextDescription += ` and `;

      if (chart.axes.y.bottom && chart.axes.y.top) {
        htmlDescription += `<span class="axis y-axis">${Common.escapeHtml(
          chart.axes.y.bottom
        )} to ${Common.escapeHtml(
          chart.axes.y.top
        )}</span> on the y-axis (vertical)`;
        plainTextDescription += `${chart.axes.y.bottom} to ${chart.axes.y.top} on the y-axis (vertical)`;
      } else {
        htmlDescription += `values on the y-axis (vertical)`;
        plainTextDescription += `values on the y-axis (vertical)`;
      }

      // Add point information with proper grammar. A count string carries no
      // diagram-source text, so it is safe unescaped on both sides.
      const pointCount = chart.points.length;
      if (pointCount > 0) {
        const pointsText =
          window.MermaidAccessibilityCommon &&
          typeof window.MermaidAccessibilityCommon.formatCountNoun ===
            "function"
            ? window.MermaidAccessibilityCommon.formatCountNoun(
                pointCount,
                "data point"
              )
            : `${pointCount} data ${pointCount === 1 ? "point" : "points"}`;

        htmlDescription += `. The chart contains <span class="diagram-point-count">${pointsText}</span>`;
        plainTextDescription += `. The chart contains ${pointsText}`;
      }

      htmlDescription += `.`;
      plainTextDescription += `.`;

      return {
        html: htmlDescription,
        text: plainTextDescription,
      };
    } catch (error) {
      logError(
        "[Mermaid Accessibility] Error generating short description:",
        error
      );
      return {
        html: `A quadrant chart diagram.`,
        text: `A quadrant chart diagram.`,
      };
    }
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The plain text description for backwards compatibility
   */
  function shortDescriptionWrapper(svgElement, code) {
    const descriptions = generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Generate a detailed description for a quadrant chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(
    svgElement,
    code,
    diagramId = "diagram"
  ) {
    logInfo("[Mermaid Accessibility] Generating quadrant chart description");

    try {
      // Parse the quadrant chart structure
      const chart = parseQuadrantChart(code, svgElement);

      // Ensure quadrants have position properties
      // This is the key fix - make sure positions are explicitly set
      chart.quadrants.forEach((quadrant, index) => {
        if (!quadrant.position) {
          // Assign positions based on quadrant index if not already set
          switch (index) {
            case 0:
              quadrant.position = "top-right";
              break;
            case 1:
              quadrant.position = "top-left";
              break;
            case 2:
              quadrant.position = "bottom-left";
              break;
            case 3:
              quadrant.position = "bottom-right";
              break;
            default:
              quadrant.position = "unknown";
          }
        }
      });

      // Count points in each quadrant for distribution analysis
      const quadrantCounts = [0, 0, 0, 0]; // For quadrants 1-4
      chart.points.forEach((point) => {
        // Add this check to ensure valid quadrant values
        if (point.quadrant >= 1 && point.quadrant <= 4) {
          quadrantCounts[point.quadrant - 1]++;
        }
      });

      // Calculate point distribution statistics
      const totalPoints = chart.points.length;
      const pointsText =
        window.MermaidAccessibilityCommon &&
        typeof window.MermaidAccessibilityCommon.formatCountNoun === "function"
          ? window.MermaidAccessibilityCommon.formatCountNoun(
              totalPoints,
              "data point"
            )
          : `${totalPoints} data ${totalPoints === 1 ? "point" : "points"}`;

      const quadrantPercents = quadrantCounts.map((count) =>
        totalPoints > 0 ? Math.round((count / totalPoints) * 100) : 0
      );

      // Find empty quadrants
      const emptyQuadrants = [];
      quadrantCounts.forEach((count, index) => {
        if (count === 0) {
          emptyQuadrants.push(index + 1);
        }
      });

      // Start building the detailed HTML description with sections
      let description = `<div class="quadrant-chart-description">`;

      // Introduction section - explain what a quadrant chart is
      description += `<section class="introduction-section" role="region" aria-labelledby="quadrant-introduction-heading">
      <h4 id="quadrant-introduction-heading">What is a Quadrant Chart?</h4>
      <p>A quadrant chart divides information into four sections (quadrants) based on two different measures. 
      Each section represents a different combination of high or low values for these measures. 
      Items are placed in the chart based on their values for each measure.</p>
    </section>`;

      // Overview Section with improved explanation of coordinates
      description += `<section class="overview-section" role="region" aria-labelledby="quadrant-overview-heading">
      <h4 id="quadrant-overview-heading">Chart overview</h4>
      <p>This quadrant chart is titled "${Common.escapeHtml(
        chart.title
      )}" and shows data points based on two measurements:</p>
      
      <h5>How the axes work</h5>
      <p>Each axis uses values from 0 to 1, where:</p>
      <ul>
        <li><strong>Horizontal axis (x-axis):</strong> 
          <ul>
            <li>Values from 0 to 0.5 represent "${Common.escapeHtml(
              chart.axes.x.left
            )}" (left side).</li>
            <li>Values from 0.5 to 1 represent "${Common.escapeHtml(
              chart.axes.x.right
            )}" (right side).</li>
            <li>The higher the number, the further right on the chart.</li>
          </ul>
        </li>
        <li><strong>Vertical axis (y-axis):</strong>
          <ul>
            <li>Values from 0 to 0.5 represent "${Common.escapeHtml(
              chart.axes.y.bottom
            )}" (bottom half).</li>
            <li>Values from 0.5 to 1 represent "${Common.escapeHtml(
              chart.axes.y.top
            )}" (top half).</li>
            <li>The higher the number, the higher up on the chart.</li>
          </ul>
        </li>
      </ul>

      <p>The chart contains ${pointsText} spread across the quadrants.</p>
    </section>`;

      // Quadrant Framework Section - with clearer explanations
      description += `<section class="framework-section" role="region" aria-labelledby="quadrant-framework-heading">
      <h4 id="quadrant-framework-heading">The four quadrants</h4>
      <p>The chart is divided into four sections, each with its own meaning:</p>
      <ul>`;

      // Describe each quadrant with clearer positioning
      chart.quadrants.forEach((quadrant) => {
        let position;
        switch (quadrant.position) {
          case "top-right":
            position = "top-right (high x, high y)";
            break;
          case "top-left":
            position = "top-left (low x, high y)";
            break;
          case "bottom-left":
            position = "bottom-left (low x, low y)";
            break;
          case "bottom-right":
            position = "bottom-right (high x, low y)";
            break;
          default:
            position = quadrant.position;
        }

        description += `<li>Quadrant ${quadrant.id} (${position}): "${Common.escapeHtml(
          quadrant.label || "Unlabelled"
        )}".</li>`;
      });

      description += `</ul>
    </section>`;

      // Point Distribution Section
      description += `<section class="distribution-section" role="region" aria-labelledby="quadrant-distribution-heading">
      <h4 id="quadrant-distribution-heading">How points are distributed</h4>`;

      if (totalPoints > 0) {
        // Count center points separately
        const centerPoints = chart.points.filter(
          (point) => point.quadrant === 0
        ).length;
        const nonCenterPoints = totalPoints - centerPoints;

        // Use formatCountNoun for proper grammar
        description += `<p>The ${pointsText} ${
          totalPoints === 1 ? "is" : "are"
        } distributed as follows:</p>
      <ul>`;

        // Use formatCountNoun for each quadrant
        for (let i = 0; i < 4; i++) {
          const quadCount = quadrantCounts[i];
          const quadText =
            window.MermaidAccessibilityCommon &&
            typeof window.MermaidAccessibilityCommon.formatCountNoun ===
              "function"
              ? window.MermaidAccessibilityCommon.formatCountNoun(
                  quadCount,
                  "point"
                )
              : `${quadCount} ${quadCount === 1 ? "point" : "points"}`;

          description += `<li>Quadrant ${i + 1} (${
            chart.quadrants[i].position
          }): ${quadText} (${quadrantPercents[i]}%).</li>`;
        }

        // Add center points if any exist
        if (centerPoints > 0) {
          const centerText =
            window.MermaidAccessibilityCommon &&
            typeof window.MermaidAccessibilityCommon.formatCountNoun ===
              "function"
              ? window.MermaidAccessibilityCommon.formatCountNoun(
                  centerPoints,
                  "point"
                )
              : `${centerPoints} ${centerPoints === 1 ? "point" : "points"}`;

          const centerPercent = Math.round((centerPoints / totalPoints) * 100);
          description += `<li>Center of chart (where all quadrants meet): ${centerText} (${centerPercent}%).</li>`;
        }

        description += `</ul>`;

        // Add insights about empty quadrants if any
        // Fix the empty quadrants grammar using formatList if available
        if (emptyQuadrants.length > 0) {
          let emptyQuadrantsText = "";

          // Use formatList if available from MermaidAccessibilityCommon
          if (
            window.MermaidAccessibilityCommon &&
            typeof window.MermaidAccessibilityCommon.formatList === "function"
          ) {
            emptyQuadrantsText = window.MermaidAccessibilityCommon.formatList(
              emptyQuadrants.map((q) => `${q}`)
            );
          } else {
            // Simple fallback if formatList isn't available
            if (emptyQuadrants.length === 1) {
              emptyQuadrantsText = emptyQuadrants[0];
            } else if (emptyQuadrants.length === 2) {
              emptyQuadrantsText = `${emptyQuadrants[0]} and ${emptyQuadrants[1]}`;
            } else {
              const lastQuadrant = emptyQuadrants.pop();
              emptyQuadrantsText = `${emptyQuadrants.join(
                ", "
              )}, and ${lastQuadrant}`;
              // Restore the array
              emptyQuadrants.push(lastQuadrant);
            }
          }

          description += `<p>Note: ${
            emptyQuadrants.length === 1 ? "Quadrant" : "Quadrants"
          } ${emptyQuadrantsText} ${
            emptyQuadrants.length === 1 ? "is" : "are"
          } empty.</p>`;
        }
      }

      description += `</section>`;

      // Data Points Section with Improved Coordinate Descriptions
      if (totalPoints > 0) {
        description += `<section class="points-section" role="region" aria-labelledby="quadrant-points-heading">
        <h4 id="quadrant-points-heading">Individual data points</h4>
        <p>These are the specific data points on the chart:</p>
        <ul>`;

        // List each point with more detailed descriptions
        chart.points.forEach((point) => {
          // Special handling for center points
          if (
            point.quadrant === 0 ||
            (Math.abs(point.coordinates[0] - 0.5) < 0.02 &&
              Math.abs(point.coordinates[1] - 0.5) < 0.02)
          ) {
            // Description for center point
            let pointDescription = `<li><strong>${Common.escapeHtml(
              point.name
            )}</strong>: Located at the center of the chart (where all quadrants meet) with coordinates [${point.coordinates[0].toFixed(
              2
            )}, ${point.coordinates[1].toFixed(2)}].<br>`;
            pointDescription +=
              "This means: at the intersection of all four quadrants, with balanced values on both axes.</li>";

            description += pointDescription;
            return; // Skip the rest of this iteration
          }

          // Regular point description (unchanged)
          // Add defensive check to prevent errors with invalid quadrants
          const quadrantIndex =
            point.quadrant >= 1 && point.quadrant <= 4 ? point.quadrant - 1 : 0;

          const quadrantInfo = chart.quadrants[quadrantIndex] || {
            position: "unknown",
            label: "Unlabelled",
          };

          const xVal = point.coordinates[0];
          const yVal = point.coordinates[1];

          // Start with name and quadrant
          let pointDescription = `<li><strong>${Common.escapeHtml(
            point.name
          )}</strong>: Located in the ${
            quadrantInfo.position
          } quadrant ("${Common.escapeHtml(
            quadrantInfo.label || "Unlabelled"
          )}") with coordinates [${xVal.toFixed(2)}, ${yVal.toFixed(2)}].<br>`;

          // Add detailed position description
          pointDescription += "This means: ";

          // X-axis description with more detail
          if (xVal < 0.25) {
            pointDescription += `very low ${Common.escapeHtml(
              chart.axes.x.left
            )}`;
          } else if (xVal < 0.4) {
            pointDescription += `low ${Common.escapeHtml(
              chart.axes.x.left
            )}`;
          } else if (xVal < 0.5) {
            pointDescription += `moderately low ${Common.escapeHtml(
              chart.axes.x.left
            )}`;
          } else if (xVal < 0.6) {
            pointDescription += `moderately high ${Common.escapeHtml(
              chart.axes.x.right
            )}`;
          } else if (xVal < 0.75) {
            pointDescription += `high ${Common.escapeHtml(
              chart.axes.x.right
            )}`;
          } else {
            pointDescription += `very high ${Common.escapeHtml(
              chart.axes.x.right
            )}`;
          }

          pointDescription += " and ";

          // Y-axis description with more detail
          if (yVal < 0.25) {
            pointDescription += `very low ${Common.escapeHtml(
              chart.axes.y.bottom
            )}`;
          } else if (yVal < 0.4) {
            pointDescription += `low ${Common.escapeHtml(
              chart.axes.y.bottom
            )}`;
          } else if (yVal < 0.5) {
            pointDescription += `moderately low ${Common.escapeHtml(
              chart.axes.y.bottom
            )}`;
          } else if (yVal < 0.6) {
            pointDescription += `moderately high ${Common.escapeHtml(
              chart.axes.y.top
            )}`;
          } else if (yVal < 0.75) {
            pointDescription += `high ${Common.escapeHtml(
              chart.axes.y.top
            )}`;
          } else {
            pointDescription += `very high ${Common.escapeHtml(
              chart.axes.y.top
            )}`;
          }

          pointDescription += `.`;

          description += pointDescription + `</li>`;
        });

        description += `</ul>
        </section>`;
      }

      // Data Points Table Section
      if (totalPoints > 0) {
        description += `<section class="points-table-section" role="region" aria-labelledby="quadrant-points-table-heading">
        <h5 id="quadrant-points-table-heading">Data points table</h5>`;

        // Create table elements
        const { titleElement, tableWrapper } = createQuadrantDataTable(
          chart,
          diagramId || "diagram"
        );

        // Convert DOM elements to HTML strings
        const tableWrapperHTML = tableWrapper.outerHTML;

        // Add the table HTML to the description
        description += tableWrapperHTML;
        description += `</section>`;
      }

      // Visual Representation Note - with clearer explanation
      description += `<section class="visual-note-section" role="region" aria-labelledby="quadrant-visual-heading">
      <h4 id="quadrant-visual-heading">How to read this chart</h4>
      <p>The chart is divided into four equal sections by two crossing lines:
      <ul>
        <li>A vertical line in the middle divides left from right.</li>
        <li>A horizontal line in the middle divides top from bottom.</li>
      </ul>
      </p>
      <p>Points are placed according to their values:
      <ul>
        <li>Points further to the right have higher x-axis values (${Common.escapeHtml(
          chart.axes.x.right || "high x-values"
        )}).</li>
        <li>Points higher up on the chart have higher y-axis values (${Common.escapeHtml(
          chart.axes.y.top || "high y-values"
        )}).</li>
      </ul>
      </p>
    `;

      // Add note about styling if points have different styles
      const hasCustomStyling = chart.points.some(
        (point) => Object.keys(point.styling || {}).length > 0
      );
      if (hasCustomStyling) {
        description += `<p>Some points have different visual styling that may indicate different categories or importance.</p>`;
      }

      description += `</section>`;

      // Close the main container
      description += `</div>`;

      return description;
    } catch (error) {
      logError(
        "[Mermaid Accessibility] Error generating detailed description:",
        error
      );
      return `<p>This appears to be a quadrant chart diagram, but it could not be fully parsed for accessibility.</p>`;
    }
  }

  /**
   * Create a data table for quadrant chart points
   * @param {Object} chart - The parsed quadrant chart data
   * @param {string|number} diagramId - Unique identifier for the diagram
   * @returns {HTMLElement} The wrapper containing the table
   */
  function createQuadrantDataTable(chart, diagramId) {
    // Create a container for the title
    const titleElement = document.createElement("h3");
    titleElement.textContent = `Data table for: ${
      chart.title || "Quadrant Chart"
    }`;
    titleElement.className = "chart-data-table-title";

    // Create HTML table
    const table = document.createElement("table");
    table.id = `quadrant-data-table-${diagramId}`;
    table.className = "chart-data-table sortable-table";
    table.setAttribute(
      "aria-label",
      `Data table for ${chart.title || "Quadrant Chart"}`
    );

    // Add caption with chart title/description
    const caption = document.createElement("caption");
    caption.textContent = `Data points for: ${chart.title || "Quadrant Chart"}`;
    table.appendChild(caption);

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Define headers
    const headers = [
      "Point Name",
      "Quadrant",
      `X Value (${chart.axes.x.left || "X"} to ${chart.axes.x.right || "X"})`,
      `Y Value (${chart.axes.y.bottom || "Y"} to ${chart.axes.y.top || "Y"})`,
    ];

    // Add header cells
    headers.forEach((header, index) => {
      const th = document.createElement("th");
      th.textContent = header;
      th.setAttribute("scope", "col");
      th.setAttribute("data-column-index", index.toString());
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");

    // Add data rows
    chart.points.forEach((point) => {
      const tr = document.createElement("tr");

      // Check if point is at the center (quadrant 0)
      let quadrantText;
      if (
        point.quadrant === 0 ||
        (Math.abs(point.coordinates[0] - 0.5) < 0.02 &&
          Math.abs(point.coordinates[1] - 0.5) < 0.02)
      ) {
        // Use "Centre point" for center points (using British spelling)
        quadrantText = "Centre point (where all quadrants meet)";
      } else {
        // Use regular quadrant description for non-center points
        const quadrantInfo = chart.quadrants[point.quadrant - 1] || {
          position: "unknown",
          label: "Unlabelled",
        };
        quadrantText = `Quadrant ${point.quadrant} (${
          quadrantInfo.position
        }): "${quadrantInfo.label || "Unlabelled"}"`;
      }

      // Create row cells
      const cells = [
        point.name,
        quadrantText,
        point.coordinates[0].toFixed(2),
        point.coordinates[1].toFixed(2),
      ];

      // Add each cell to the row
      cells.forEach((cellText, cellIndex) => {
        const cellElement = document.createElement("td");
        cellElement.setAttribute("data-label", headers[cellIndex]);
        cellElement.textContent = cellText;
        tr.appendChild(cellElement);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Create a wrapper div for the table to help with alignment
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "chart-data-table-wrapper";
    tableWrapper.appendChild(table);

    return { titleElement, tableWrapper };
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("quadrantChart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
  });

  // Detection is NOT set up here. This module used to monkey-patch
  // window.MermaidDiagramDetection.detectDiagramType with a quadrantChart
  // special case, which gave detection two owners and meant load order decided
  // the answer. Detection now belongs solely to mermaid-diagram-detection.js,
  // which asks Mermaid's own detector and already resolves quadrant charts.

  logInfo(
    "[Mermaid Accessibility] Quadrant chart module loaded and registered"
  );
})();
