/**
 * Chart Accessibility Extensions
 * Adds accessibility features to Chart.js charts:
 * - CSV data export
 * - Data table generation
 * - Automated descriptions
 *
 * Dependencies:
 * - chart-controls.js (for integration with existing UI)
 * - Chart.js (for accessing chart data)
 */
const advancedAnalysisAvailable =
  window.ChartStatistics && window.ChartTrends && window.ChartPerformance;

if (advancedAnalysisAvailable) {
  console.log("[Chart Accessibility] Advanced analysis modules loaded");
} else {
  console.warn(
    "[Chart Accessibility] Advanced analysis modules not found, using basic analysis"
  );
}
// Create the ChartAccessibility module and assign it to the window object
const ChartAccessibility = (function () {
  // Configuration
  const config = {
    buttonClasses: "chart-control-button",
    copyText: "Copy Code",
    successText: "Copied",
    failText: "Failed to copy",
    csvText: "Download CSV",
    tableText: "Show Data Table",
    hideTableText: "Hide Data Table",
    showDescriptionText: "Show Description",
    hideDescriptionText: "Hide Description",
    successDuration: 2000, // Time in ms to show success message
    ariaLiveRegionId: "chart-sr-announcer",
    dataTableClass:
      "chart-data-table mdSortableTable-data-table sortable-table", // Integrate with enhanced sortable tables
    descriptionClass: "chart-description",
    detailsClass: "chart-details",
    captionsVisibleByDefault: false, // Set to false to hide captions by default
    // Defaults for automated descriptions
    descriptionTemplates: {
      bar: "Bar chart showing {yAxisTitle} by {xAxisTitle}.",
      line: "Line chart showing {yAxisTitle} over {xAxisTitle}.",
      pie: "Pie chart showing distribution of {title}.",
      doughnut: "Doughnut chart showing distribution of {title}.",
      polarArea: "Polar area chart showing distribution of {title}.",
      radar:
        "Radar chart comparing multiple data sets across different categories.",
      scatter:
        "Scatter plot showing the relationship between {xAxisTitle} and {yAxisTitle}.",
      bubble:
        "Bubble chart showing the relationship between {xAxisTitle}, {yAxisTitle}, and bubble size.",
    },
    enableAdvancedAnalysis: advancedAnalysisAvailable,
    analysisTimeout: 5000,
    minDataPointsForAdvanced: 5,
    generateAdvancedInsights: true,
  };
  /**
   * Extract description from chart data or generate one if not provided
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {Object} Object containing short and long descriptions
   */
  function getChartDescriptions(chartInstance, chartData, chartType) {
    // Check if custom descriptions are provided in the chart data
    const customDescriptions = chartData.descriptions || {};

    // Create result object with both short and detailed descriptions
    const descriptions = {
      short: null,
      detailed: null,
    };

    // Use custom short description if provided, otherwise generate one
    if (customDescriptions.short) {
      descriptions.short = customDescriptions.short;
      console.log("[Chart Accessibility] Using custom short description");
    } else {
      descriptions.short = generateShortDescription(
        chartInstance,
        chartData,
        chartType
      );
      console.log("[Chart Accessibility] Using generated short description");
    }

    // Use custom detailed description if provided, otherwise generate one
    if (customDescriptions.detailed) {
      descriptions.detailed = customDescriptions.detailed;
      console.log("[Chart Accessibility] Using custom detailed description");
    } else {
      descriptions.detailed = generateDetailedDescription(
        chartInstance,
        chartData,
        chartType
      );
      console.log("[Chart Accessibility] Using generated detailed description");
    }

    return descriptions;
  }
  /**
   * Initialize accessibility features for a chart container
   * @param {HTMLElement} container - The chart container
   * @param {string|number} chartId - Unique identifier for the chart
   */
  function initAccessibilityFeatures(container, chartId) {
    if (!container) {
      console.warn("[Chart Accessibility] No container provided");
      return;
    }

    // Skip if already processed
    if (container.getAttribute("data-accessibility-initialized") === "true") {
      return;
    }

    console.log(
      `[Chart Accessibility] Initializing features for chart ${chartId}`
    );

    // Get the canvas element
    const canvasElement = container.querySelector("canvas");
    if (!canvasElement) {
      console.warn("[Chart Accessibility] No canvas found in chart container");
      return;
    }

    // Get the Chart.js instance
    const chartInstance = Chart.getChart(canvasElement);
    if (!chartInstance) {
      console.warn(
        "[Chart Accessibility] No Chart.js instance found for canvas"
      );
      return;
    }

    // Get the chart data from the data-chart-code attribute
    const encodedCode = container.getAttribute("data-chart-code") || "{}";
    const chartData = JSON.parse(decodeURIComponent(encodedCode));

    // Find the controls container (created by chart-controls.js)
    const controlsContainer = container.querySelector(".chart-controls");
    if (!controlsContainer) {
      console.warn("[Chart Accessibility] No controls container found");
      return;
    }

    // Add CSS styles for data tables and descriptions if not already added
    addDataTableStyles();
    addDescriptionStyles();

    // Get descriptions (either custom or generated)
    const descriptions = getChartDescriptions(
      chartInstance,
      chartData,
      chartInstance.config.type
    );

    // Create a figure element to wrap the container
    const figureElement = document.createElement("figure");
    figureElement.className = "chart-figure";

    // Check if container is already wrapped in a figure (to avoid double wrapping)
    if (
      container.parentElement &&
      container.parentElement.tagName !== "FIGURE"
    ) {
      // Get the parent element of the container
      const parent = container.parentElement;

      // Replace the container with the figure element
      parent.replaceChild(figureElement, container);

      // First create the figcaption
      const figcaption = document.createElement("figcaption");
      figcaption.className = "chart-figcaption";
      figcaption.textContent = descriptions.short;

      // Add sr-only class if captions should be hidden by default
      if (!config.captionsVisibleByDefault) {
        figcaption.classList.add("sr-only");
      }

      // Store the figcaption ID in the container's dataset
      container.dataset.figcaptionId = `chart-caption-${chartId}`;
      figcaption.id = `chart-caption-${chartId}`;

      // Associate the chart with its caption using aria-describedby
      canvasElement.setAttribute(
        "aria-describedby",
        `chart-caption-${chartId}`
      );

      // Add the figcaption first, then the container
      figureElement.appendChild(figcaption);
      figureElement.appendChild(container);

      // Optionally add a class to make figcaption visually hidden but accessible to screen readers
      // Uncomment the next line if you want captions to be visually hidden by default
      // figcaption.classList.add("sr-only");
    }

    // Add CSV download button
    const csvButton = createCsvButton(chartInstance, chartData, chartId);
    controlsContainer.appendChild(csvButton);

    // Add table toggle button
    const tableToggleButton = createTableToggleButton(
      container,
      chartInstance,
      chartData,
      chartId
    );
    controlsContainer.appendChild(tableToggleButton);

    // Add description toggle button
    const descriptionToggleButton = createDescriptionToggleButton(
      container,
      chartInstance,
      chartData,
      chartId,
      descriptions.detailed
    );
    controlsContainer.appendChild(descriptionToggleButton);

    // Apply short description to chart container for screen readers
    canvasElement.setAttribute("aria-label", descriptions.short);

    // Mark as initialized
    container.setAttribute("data-accessibility-initialized", "true");
  }

  /**
   * Create a button to download chart data as CSV
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string|number} chartId - Unique identifier for the chart
   * @returns {HTMLElement} The created button
   */
  function createCsvButton(chartInstance, chartData, chartId) {
    const csvButton = document.createElement("button");
    csvButton.className = config.buttonClasses;
    csvButton.innerHTML = `${getCsvButtonIcon()} ${config.csvText}`;
    csvButton.setAttribute("aria-label", "Download data as CSV");
    csvButton.setAttribute("type", "button");
    csvButton.setAttribute("data-chart-id", chartId);

    // Add event listener for CSV button
    csvButton.addEventListener("click", function () {
      downloadChartDataAsCsv(chartInstance, chartData, chartId);
    });

    return csvButton;
  }

  /**
   * Convert chart data to CSV and trigger download
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string|number} chartId - Unique identifier for the chart
   */
  function downloadChartDataAsCsv(chartInstance, chartData, chartId) {
    try {
      const chartType = chartInstance.config.type;
      const csvData = convertChartDataToCsv(
        chartInstance,
        chartData,
        chartType
      );

      // Create a Blob containing the CSV data
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

      // Create a temporary link element to trigger the download
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      // Set link properties
      link.setAttribute("href", url);
      link.setAttribute("download", `chart-${chartId}.csv`);
      link.style.visibility = "hidden";

      // Add to DOM, trigger click, and clean up
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Announce to screen readers
      announceToScreenReader("CSV data downloaded successfully");
    } catch (error) {
      console.error("[Chart Accessibility] Error downloading CSV:", error);
      announceToScreenReader("Failed to download CSV data");
    }
  }

  /**
   * Convert chart data to CSV format
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {string} CSV formatted string
   */
  function convertChartDataToCsv(chartInstance, chartData, chartType) {
    // Default CSV header and rows
    let csvHeader = [];
    let csvRows = [];

    // Handle different chart types
    if (chartType === "bar" || chartType === "line" || chartType === "radar") {
      // Get labels (usually x-axis labels)
      const labels = chartInstance.data.labels || [];

      // Start with 'Category' or the x-axis title if available
      let xAxisTitle = "Category";
      if (
        chartInstance.options &&
        chartInstance.options.scales &&
        chartInstance.options.scales.x &&
        chartInstance.options.scales.x.title &&
        chartInstance.options.scales.x.title.text
      ) {
        xAxisTitle = chartInstance.options.scales.x.title.text;
      }

      csvHeader = [xAxisTitle];

      // Add dataset labels to header
      chartInstance.data.datasets.forEach((dataset) => {
        csvHeader.push(dataset.label || "Dataset");
      });

      // Create rows
      labels.forEach((label, labelIndex) => {
        const row = [label];
        chartInstance.data.datasets.forEach((dataset) => {
          row.push(dataset.data[labelIndex]);
        });
        csvRows.push(row);
      });
    } else if (
      chartType === "pie" ||
      chartType === "doughnut" ||
      chartType === "polarArea"
    ) {
      // For pie/doughnut/polarArea charts, we have a single header row
      csvHeader = ["Category", "Value"];

      // There's typically only one dataset for these chart types
      const dataset = chartInstance.data.datasets[0];
      const labels = chartInstance.data.labels || [];

      // Create a row for each label and corresponding data point
      labels.forEach((label, index) => {
        csvRows.push([label, dataset.data[index]]);
      });
    } else if (chartType === "scatter" || chartType === "bubble") {
      // For scatter/bubble charts
      csvHeader = ["Dataset"];

      // Add x and y headers
      let xLabel = "X";
      let yLabel = "Y";
      if (chartInstance.options && chartInstance.options.scales) {
        if (
          chartInstance.options.scales.x &&
          chartInstance.options.scales.x.title &&
          chartInstance.options.scales.x.title.text
        ) {
          xLabel = chartInstance.options.scales.x.title.text;
        }
        if (
          chartInstance.options.scales.y &&
          chartInstance.options.scales.y.title &&
          chartInstance.options.scales.y.title.text
        ) {
          yLabel = chartInstance.options.scales.y.title.text;
        }
      }

      csvHeader.push(xLabel, yLabel);

      // Add size header for bubble charts
      if (chartType === "bubble") {
        csvHeader.push("Size");
      }

      // Create rows for each dataset and point
      chartInstance.data.datasets.forEach((dataset) => {
        const datasetLabel = dataset.label || "Dataset";

        // For scatter/bubble, data is in {x, y} format
        dataset.data.forEach((point) => {
          const row = [datasetLabel, point.x, point.y];

          // Add size for bubble charts
          if (chartType === "bubble" && point.r !== undefined) {
            row.push(point.r);
          }

          csvRows.push(row);
        });
      });
    }

    // Convert headers and rows to CSV format
    let csvContent = csvHeader.join(",") + "\n";

    csvRows.forEach((row) => {
      // Format each cell properly for CSV
      const formattedRow = row.map((cell) => {
        // If cell is a string with commas, wrap in quotes
        if (typeof cell === "string" && cell.includes(",")) {
          return `"${cell}"`;
        }
        return cell;
      });

      csvContent += formattedRow.join(",") + "\n";
    });

    return csvContent;
  }

  /**
   * Create a button to toggle data table visibility
   * @param {HTMLElement} container - The chart container
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string|number} chartId - Unique identifier for the chart
   * @returns {HTMLElement} The created button
   */
  function createTableToggleButton(
    container,
    chartInstance,
    chartData,
    chartId
  ) {
    // Create the toggle button
    const tableButton = document.createElement("button");
    tableButton.className = config.buttonClasses;
    tableButton.innerHTML = `${getTableButtonIcon()} ${config.tableText}`;
    tableButton.setAttribute("aria-label", "Show data table");
    tableButton.setAttribute("type", "button");
    tableButton.setAttribute("data-chart-id", chartId);
    tableButton.setAttribute("aria-expanded", "false");
    tableButton.setAttribute("aria-controls", `chart-data-table-${chartId}`);

    // Add click event listener
    tableButton.addEventListener("click", function () {
      // Check if the table exists
      let tableContainer = document.getElementById(
        `chart-data-table-container-${chartId}`
      );

      // If table container doesn't exist, create it
      if (!tableContainer) {
        console.log(
          `[Chart Accessibility] Creating new data table for chart ${chartId}`
        );

        try {
          // Create table container
          tableContainer = document.createElement("div");
          tableContainer.id = `chart-data-table-container-${chartId}`;
          tableContainer.className = "chart-data-table-container";
          tableContainer.style.display = "none"; // Hidden by default

          // Generate data table with title and wrapper
          const { titleElement, tableWrapper } = createDataTable(
            chartInstance,
            chartData,
            chartInstance.config.type,
            chartId
          );

          // Add title and table wrapper to container
          tableContainer.appendChild(titleElement);
          tableContainer.appendChild(tableWrapper);

          // Insert after the chart container
          container.parentNode.insertBefore(
            tableContainer,
            container.nextSibling
          );

          // Initialize enhanced sortable table functionality if available
          if (
            window.sortableTablesEnhanced &&
            typeof window.sortableTablesEnhanced.initSortableTables ===
              "function"
          ) {
            console.log(
              `[Chart Accessibility] Initializing enhanced sortable table for chart ${chartId}`
            );
            window.sortableTablesEnhanced.initSortableTables(tableContainer);
          } else if (typeof window.initSortableTables === "function") {
            // Fallback to old implementation
            console.log(
              `[Chart Accessibility] Falling back to legacy sortable table for chart ${chartId}`
            );
            window.initSortableTables(tableContainer);
          }
          // Note: ARIA attributes are now handled automatically by the enhanced tables
        } catch (error) {
          console.error(
            "[Chart Accessibility] Error creating data table:",
            error
          );
          announceToScreenReader("Error creating data table");
          return;
        }
      }

      // Toggle table visibility
      toggleDataTable(tableContainer, tableButton, chartId);
    });

    return tableButton;
  }

  /**
   * Toggle data table visibility
   * @param {HTMLElement} tableContainer - The table container element
   * @param {HTMLElement} toggleButton - The toggle button
   * @param {string|number} chartId - Unique identifier for the chart
   */
  function toggleDataTable(tableContainer, toggleButton, chartId) {
    // Check if table is currently visible
    const isHidden = tableContainer.style.display === "none";

    // Toggle display
    if (isHidden) {
      tableContainer.style.display = "block";
      toggleButton.innerHTML = `${getTableButtonIcon()} ${
        config.hideTableText
      }`;
      toggleButton.setAttribute("aria-expanded", "true");
      announceToScreenReader("Data table is now visible");
      // Note: ARIA attributes are now handled automatically by enhanced sortable tables
      if (window.sortableTablesEnhanced) {
        console.log(
          `[Chart Accessibility] Enhanced sortable tables handle ARIA automatically for chart ${chartId}`
        );
      } else if (typeof window.addTableARIA === "function") {
        // Fallback to old implementation
        console.log(
          `[Chart Accessibility] Applying legacy ARIA attributes to table for chart ${chartId}`
        );
        window.addTableARIA();
      }
    } else {
      tableContainer.style.display = "none";
      toggleButton.innerHTML = `${getTableButtonIcon()} ${config.tableText}`;
      toggleButton.setAttribute("aria-expanded", "false");
      announceToScreenReader("Data table is now hidden");
    }
  }

  /**
   * Create an HTML table from chart data
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @param {string|number} chartId - Unique identifier for the chart
   * @returns {HTMLElement} The created table
   */
  function createDataTable(chartInstance, chartData, chartType, chartId) {
    console.log(
      `[Chart Accessibility] Creating data table for ${chartType} chart ${chartId}`
    );

    // Extract chart data
    const tableData = extractTableData(chartInstance, chartData, chartType);

    // Create a container for the title
    const titleElement = document.createElement("h3");
    titleElement.textContent = `Data table for: ${getChartTitle(
      chartInstance,
      chartData
    )}`;
    titleElement.className = "chart-data-table-title";

    // Create HTML table
    const table = document.createElement("table");
    table.id = `chart-data-table-${chartId}`;
    table.className = config.dataTableClass;
    table.setAttribute(
      "aria-label",
      `Data table for ${getChartTitle(chartInstance, chartData)}`
    );

    // Add caption with chart title/description (hidden visually but available to screen readers)
    const caption = document.createElement("caption");
    caption.textContent = `Data table for: ${getChartTitle(
      chartInstance,
      chartData
    )}`;
    caption.style.cssText =
      "clip: rect(0 0 0 0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px;";
    table.appendChild(caption);

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Add header cells
    tableData.headers.forEach((header, index) => {
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
    tableData.rows.forEach((row) => {
      const tr = document.createElement("tr");

      // For each cell in the row
      row.forEach((cell, cellIndex) => {
        const cellElement = document.createElement("td");

        // Add data-label attribute for responsive tables
        cellElement.setAttribute("data-label", tableData.headers[cellIndex]);

        // Format the cell value appropriately
        cellElement.textContent = formatCellValue(cell);

        tr.appendChild(cellElement);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Create a wrapper div for the table to help with alignment
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "chart-data-table-wrapper";
    tableWrapper.appendChild(table);

    // Return both elements to be added to the container
    return { titleElement, tableWrapper };
  }

  /**
   * Extract data from chart for table presentation
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {Object} Object with headers and rows for the table
   */
  function extractTableData(chartInstance, chartData, chartType) {
    // Default structure
    const tableData = {
      headers: [],
      rows: [],
    };

    // Extract data based on chart type
    if (chartType === "bar" || chartType === "line" || chartType === "radar") {
      // Get labels (usually x-axis labels)
      const labels = chartInstance.data.labels || [];

      // Get x-axis title if available
      let xAxisTitle = "Category";
      if (
        chartInstance.options &&
        chartInstance.options.scales &&
        chartInstance.options.scales.x &&
        chartInstance.options.scales.x.title &&
        chartInstance.options.scales.x.title.text
      ) {
        xAxisTitle = chartInstance.options.scales.x.title.text;
      }

      // First column header is the x-axis title
      tableData.headers.push(xAxisTitle);

      // Add dataset labels to headers
      chartInstance.data.datasets.forEach((dataset) => {
        tableData.headers.push(dataset.label || "Dataset");
      });

      // Create rows
      labels.forEach((label, labelIndex) => {
        const row = [label];
        chartInstance.data.datasets.forEach((dataset) => {
          row.push(dataset.data[labelIndex]);
        });
        tableData.rows.push(row);
      });
    } else if (
      chartType === "pie" ||
      chartType === "doughnut" ||
      chartType === "polarArea"
    ) {
      // For pie/doughnut/polarArea charts
      tableData.headers = ["Category", "Value"];

      // There's typically only one dataset for these chart types
      const dataset = chartInstance.data.datasets[0];
      const labels = chartInstance.data.labels || [];

      // Create a row for each label and corresponding data point
      labels.forEach((label, index) => {
        tableData.rows.push([label, dataset.data[index]]);
      });
    } else if (chartType === "scatter" || chartType === "bubble") {
      // For scatter/bubble charts
      tableData.headers = ["Dataset"];

      // Get axis titles if available
      let xLabel = "X";
      let yLabel = "Y";

      if (chartInstance.options && chartInstance.options.scales) {
        if (
          chartInstance.options.scales.x &&
          chartInstance.options.scales.x.title &&
          chartInstance.options.scales.x.title.text
        ) {
          xLabel = chartInstance.options.scales.x.title.text;
        }
        if (
          chartInstance.options.scales.y &&
          chartInstance.options.scales.y.title &&
          chartInstance.options.scales.y.title.text
        ) {
          yLabel = chartInstance.options.scales.y.title.text;
        }
      }

      tableData.headers.push(xLabel, yLabel);

      // Add size header for bubble charts
      if (chartType === "bubble") {
        tableData.headers.push("Size");
      }

      // Extract data from each dataset
      chartInstance.data.datasets.forEach((dataset) => {
        const datasetLabel = dataset.label || "Dataset";

        // For scatter/bubble, data is in {x, y} format
        dataset.data.forEach((point) => {
          const row = [datasetLabel, point.x, point.y];

          // Add size for bubble charts
          if (chartType === "bubble" && point.r !== undefined) {
            row.push(point.r);
          }

          tableData.rows.push(row);
        });
      });
    }

    return tableData;
  }

  /**
   * Format cell value appropriately based on content
   * @param {*} value - The cell value
   * @returns {string} Formatted cell value
   */
  function formatCellValue(value) {
    // Handle undefined/null
    if (value === undefined || value === null) {
      return "N/A";
    }

    // Handle numbers
    if (typeof value === "number") {
      // Format with appropriate number of decimal places
      if (Number.isInteger(value)) {
        return value.toString();
      } else {
        // Limit decimal places for readability
        return value.toFixed(2);
      }
    }

    // Handle dates
    if (value instanceof Date) {
      return value.toLocaleDateString("en-GB"); // Format for UK (DD/MM/YYYY)
    }

    // Handle objects
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return Object.prototype.toString.call(value);
      }
    }

    // Default string conversion
    return value.toString();
  }

  /**
   * Analyze chart data to generate insights and key takeaways
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {Object} Object containing insights array and primary takeaway string
   */
  function analyzeChartForInsights(chartInstance, chartData, chartType) {
    const insights = [];
    let primaryTakeaway = "";

    // Extract basic data
    const datasets = chartInstance.data.datasets;
    const labels = chartInstance.data.labels || [];
    const xAxisLabel = getAxisLabel(chartInstance, "x", true); // lowercase
    const yAxisLabel = getAxisLabel(chartInstance, "y", true); // lowercase

    // Check if we should use advanced analysis
    const useAdvancedAnalysis =
      config.enableAdvancedAnalysis &&
      datasets.length > 0 &&
      datasets[0].data.length >= config.minDataPointsForAdvanced;
    console.log(
      "[Chart Accessibility] Using advanced analysis:",
      useAdvancedAnalysis
    );

    // Default value descriptor if needed
    let valueDescriptor = yAxisLabel || "values";
    if (datasets.length === 1 && datasets[0].label) {
      valueDescriptor = datasets[0].label.toLowerCase();
    }

    try {
      switch (chartType) {
        case "bar":
          if (useAdvancedAnalysis) {
            return analyzeBarChartAdvanced(
              datasets,
              labels,
              valueDescriptor,
              xAxisLabel,
              yAxisLabel
            );
          } else {
            return analyzeBarChartBasic(datasets, labels, valueDescriptor);
          }

        case "line":
          if (useAdvancedAnalysis) {
            return analyzeLineChartAdvanced(
              datasets,
              labels,
              valueDescriptor,
              xAxisLabel,
              yAxisLabel
            );
          } else {
            return analyzeLineChartBasic(datasets, labels, valueDescriptor);
          }

        case "pie":
        case "doughnut":
          return analyzePieChartBasic(datasets, labels, valueDescriptor);

        case "scatter":
          return analyzeScatterChartBasic(
            datasets,
            labels,
            xAxisLabel,
            yAxisLabel
          );

        case "bubble":
          return analyzeBubbleChartBasic(
            datasets,
            labels,
            xAxisLabel,
            yAxisLabel
          );

        case "radar":
          return analyzeRadarChartBasic(datasets, labels, valueDescriptor);

        default:
          return analyzeGenericChartBasic(datasets, labels, valueDescriptor);
      }
    } catch (error) {
      console.warn("[Chart Accessibility] Error generating insights:", error);
      return {
        insights: ["Data analysis unavailable."],
        primaryTakeaway: "",
      };
    }
  }

  /**
   * Analyze bar chart data (basic version)
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeBarChartBasic(datasets, labels, valueDescriptor) {
    console.log("[Chart Accessibility] Using BASIC bar chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    const barStats = analyzeData(datasets);

    // Format data for insights
    insights.push(
      `Highest value: ${formatValue(barStats.max)} (${
        labels[barStats.maxIndex]
      })`
    );
    insights.push(
      `Lowest value: ${formatValue(barStats.min)} (${
        labels[barStats.minIndex]
      })`
    );
    insights.push(`Average value: ${formatValue(barStats.average)}`);

    // Determine primary takeaway for bar charts
    if (labels.length > 0) {
      const maxLabel = labels[barStats.maxIndex];
      const minLabel = labels[barStats.minIndex];

      // Compare max to average to determine significance
      const maxToAvgRatio = barStats.max / barStats.average;
      const minToAvgRatio = barStats.min / barStats.average;

      if (maxToAvgRatio > 1.5) {
        primaryTakeaway = `${maxLabel} has the highest ${valueDescriptor} at ${formatValue(
          barStats.max
        )}, ${Math.round((maxToAvgRatio - 1) * 100)}% above the average.`;
      } else if (minToAvgRatio < 0.5) {
        primaryTakeaway = `${minLabel} has the lowest ${valueDescriptor} at ${formatValue(
          barStats.min
        )}, ${Math.round((1 - minToAvgRatio) * 100)}% below the average.`;
      } else {
        primaryTakeaway = `Values range from ${formatValue(
          barStats.min
        )} to ${formatValue(barStats.max)} with an average of ${formatValue(
          barStats.average
        )}.`;
      }
    }

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze bar chart data with advanced techniques
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @param {string} xAxisLabel - X-axis label
   * @param {string} yAxisLabel - Y-axis label
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeBarChartAdvanced(
    datasets,
    labels,
    valueDescriptor,
    xAxisLabel,
    yAxisLabel
  ) {
    console.log("[Chart Accessibility] Using ADVANCED bar chart analysis");

    // Start with basic analysis
    const basicAnalysis = analyzeBarChartBasic(
      datasets,
      labels,
      valueDescriptor
    );
    const insights = [...basicAnalysis.insights];

    // Add more advanced insights
    const barStats = analyzeData(datasets);

    // Calculate variance and distribution
    const values = [];
    datasets.forEach((dataset) => {
      dataset.data.forEach((val) => {
        if (val !== null && val !== undefined) {
          values.push(val);
        }
      });
    });

    if (values.length > 0) {
      // Calculate standard deviation
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const stdDev = Math.sqrt(variance);

      // Sort values first before using them
      const sortedValues = [...values].sort((a, b) => a - b);
      const median = sortedValues[Math.floor(sortedValues.length / 2)];

      // Now we can log the stats
      console.log("[Chart Accessibility] Advanced bar chart analysis stats:", {
        mean,
        median,
        stdDev,
        values,
      });

      insights.push(`Standard deviation: ${formatValue(stdDev)}`);
      insights.push(`Median value: ${formatValue(median)}`);

      // Determine skewness
      if (mean > median + stdDev * 0.2) {
        insights.push("Distribution is positively skewed (right-tailed).");
      } else if (mean < median - stdDev * 0.2) {
        insights.push("Distribution is negatively skewed (left-tailed).");
      } else {
        insights.push("Distribution is approximately symmetric.");
      }

      // Detect outliers using 1.5 * IQR
      const q1Index = Math.floor(sortedValues.length * 0.25);
      const q3Index = Math.floor(sortedValues.length * 0.75);
      const q1 = sortedValues[q1Index];
      const q3 = sortedValues[q3Index];
      const iqr = q3 - q1;
      const outlierThresholdLow = q1 - 1.5 * iqr;
      const outlierThresholdHigh = q3 + 1.5 * iqr;

      const outliers = values.filter(
        (val) => val < outlierThresholdLow || val > outlierThresholdHigh
      );
      if (outliers.length > 0) {
        // Find labels for outliers
        const outlierLabels = [];
        datasets[0].data.forEach((val, i) => {
          if (val < outlierThresholdLow || val > outlierThresholdHigh) {
            outlierLabels.push(labels[i]);
          }
        });

        insights.push(
          `Outlier data points detected: ${outlierLabels.join(", ")}.`
        );
      }
    }

    // Return a combination of basic and advanced insights with advancedAnalysis flag
    return {
      insights: insights,
      primaryTakeaway: basicAnalysis.primaryTakeaway,
      advancedAnalysis: true,
    };
  }

  /**
   * Analyze line chart data (basic version)
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeLineChartBasic(datasets, labels, valueDescriptor) {
    console.log("[Chart Accessibility] Using BASIC line chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // For each dataset, analyze trends and significant points
    datasets.forEach((dataset, i) => {
      const datasetLabel = dataset.label || `Dataset ${i + 1}`;
      const stats = analyzeData([dataset]);
      const trend = analyzeTrend(dataset.data);

      insights.push(`${datasetLabel} shows a ${trend} trend.`);
      insights.push(
        `${datasetLabel} peaks at ${formatValue(stats.max)} (${
          labels[stats.maxIndex]
        }).`
      );
      insights.push(
        `${datasetLabel} reaches its lowest point at ${formatValue(
          stats.min
        )} (${labels[stats.minIndex]}).`
      );

      // If this is the first or only dataset, use it for the primary takeaway
      if (i === 0 || datasets.length === 1) {
        // Determine if the trend is the most important aspect
        if (trend.includes("consistently")) {
          primaryTakeaway = `${datasetLabel} shows a ${trend} trend, ranging from ${formatValue(
            stats.min
          )} to ${formatValue(stats.max)}.`;
        }
        // Or if there's a dramatic peak or trough
        else if (stats.max / stats.average > 1.5) {
          primaryTakeaway = `${datasetLabel} peaks significantly at ${formatValue(
            stats.max
          )} during ${labels[stats.maxIndex]}.`;
        }
        // Otherwise, provide a trend summary
        else {
          primaryTakeaway = `${datasetLabel} ${trend}, with values between ${formatValue(
            stats.min
          )} and ${formatValue(stats.max)}.`;
        }
      }
    });

    // If there are multiple datasets, consider adding a comparison
    if (datasets.length > 1) {
      // Find the dataset with highest average as a simple comparison
      let highestAvgIndex = 0;
      let highestAvg = -Infinity;

      datasets.forEach((dataset, i) => {
        const values = dataset.data.filter(
          (val) => val !== null && val !== undefined
        );
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        if (avg > highestAvg) {
          highestAvg = avg;
          highestAvgIndex = i;
        }
      });

      primaryTakeaway = `${
        datasets[highestAvgIndex].label || `Dataset ${highestAvgIndex + 1}`
      } shows the highest overall ${valueDescriptor}.`;
    }

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze line chart data with advanced techniques
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @param {string} xAxisLabel - X-axis label
   * @param {string} yAxisLabel - Y-axis label
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeLineChartAdvanced(
    datasets,
    labels,
    valueDescriptor,
    xAxisLabel,
    yAxisLabel
  ) {
    console.log("[Chart Accessibility] Using ADVANCED line chart analysis");
    // Start with basic analysis
    const basicAnalysis = analyzeLineChartBasic(
      datasets,
      labels,
      valueDescriptor
    );
    const insights = [...basicAnalysis.insights];

    // Add more sophisticated trend analysis
    if (datasets.length > 0 && datasets[0].data.length > 3) {
      // Check for seasonality or patterns
      const dataset = datasets[0];
      const dataPoints = dataset.data.filter(
        (val) => val !== null && val !== undefined
      );

      if (dataPoints.length > 0) {
        // Check for cyclic patterns
        let hasCyclicPattern = false;
        let peakCount = 0;
        let troughCount = 0;

        for (let i = 1; i < dataPoints.length - 1; i++) {
          // Check for peaks (local maxima)
          if (
            dataPoints[i] > dataPoints[i - 1] &&
            dataPoints[i] > dataPoints[i + 1]
          ) {
            peakCount++;
          }
          // Check for troughs (local minima)
          if (
            dataPoints[i] < dataPoints[i - 1] &&
            dataPoints[i] < dataPoints[i + 1]
          ) {
            troughCount++;
          }
        }

        // If we have multiple peaks and troughs, there might be a cyclic pattern
        if (peakCount > 1 && troughCount > 1) {
          hasCyclicPattern = true;
          insights.push(
            `The data shows a cyclic pattern with ${peakCount} peaks and ${troughCount} troughs.`
          );
        }

        // Check for overall rate of change
        const firstValue = dataPoints[0];
        const lastValue = dataPoints[dataPoints.length - 1];
        const totalChange = lastValue - firstValue;
        const percentChange = (totalChange / Math.abs(firstValue)) * 100;

        if (Math.abs(percentChange) > 50) {
          insights.push(
            `Overall ${
              percentChange > 0 ? "increase" : "decrease"
            } of ${Math.abs(percentChange).toFixed(1)}% from start to end.`
          );
        }
      }
    }

    return {
      insights: insights,
      primaryTakeaway: basicAnalysis.primaryTakeaway,
    };
  }

  /**
   * Analyze pie chart data
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzePieChartBasic(datasets, labels, valueDescriptor) {
    console.log("[Chart Accessibility] Using BASIC pie chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // Calculate percentages and find the largest/smallest segments
    const pieData = datasets[0].data;
    const total = pieData.reduce((sum, value) => sum + value, 0);
    const maxIndex = pieData.indexOf(Math.max(...pieData));
    const minIndex = pieData.indexOf(Math.min(...pieData));

    const maxPercent = ((pieData[maxIndex] / total) * 100).toFixed(1);
    const minPercent = ((pieData[minIndex] / total) * 100).toFixed(1);

    insights.push(`Total: ${formatValue(total)}`);
    insights.push(
      `Largest segment: ${labels[maxIndex]} (${formatValue(
        pieData[maxIndex]
      )}, ${maxPercent}%)`
    );
    insights.push(
      `Smallest segment: ${labels[minIndex]} (${formatValue(
        pieData[minIndex]
      )}, ${minPercent}%)`
    );

    // Determine primary takeaway
    if (parseFloat(maxPercent) > 50) {
      primaryTakeaway = `${labels[maxIndex]} represents the majority at ${maxPercent}% of the total.`;
    } else if (parseFloat(maxPercent) > 33) {
      primaryTakeaway = `${labels[maxIndex]} is the largest segment at ${maxPercent}%, representing over a third of the total.`;
    } else {
      primaryTakeaway = `${
        labels[maxIndex]
      } is the largest segment at ${maxPercent}%, followed by ${
        labels[
          pieData.indexOf(
            Math.max(...pieData.filter((val) => val !== pieData[maxIndex]))
          )
        ]
      } at ${(
        (pieData[
          pieData.indexOf(
            Math.max(...pieData.filter((val) => val !== pieData[maxIndex]))
          )
        ] /
          total) *
        100
      ).toFixed(1)}%.`;
    }

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze scatter chart data
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} xAxisLabel - X-axis label
   * @param {string} yAxisLabel - Y-axis label
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeScatterChartBasic(datasets, labels, xAxisLabel, yAxisLabel) {
    console.log("[Chart Accessibility] Using BASIC scatter chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // Handle scatter plots - analyze correlation
    datasets.forEach((dataset, i) => {
      const datasetLabel = dataset.label || `Dataset ${i + 1}`;

      if (dataset.data.length > 0 && typeof dataset.data[0] === "object") {
        const xValues = dataset.data.map((point) => point.x);
        const yValues = dataset.data.map((point) => point.y);

        const correlation = calculateCorrelation(xValues, yValues);
        const correlationDesc = describeCorrelation(correlation);

        insights.push(
          `${datasetLabel} shows a ${correlationDesc} correlation between ${
            xAxisLabel || "x"
          } and ${yAxisLabel || "y"}.`
        );

        // Use correlation as primary takeaway for the first dataset
        if (i === 0) {
          if (Math.abs(correlation) > 0.7) {
            primaryTakeaway = `There is a ${correlationDesc} correlation between ${
              xAxisLabel || "x"
            } and ${yAxisLabel || "y"}.`;
          } else if (Math.abs(correlation) > 0.3) {
            primaryTakeaway = `There is a ${correlationDesc} correlation between ${
              xAxisLabel || "x"
            } and ${yAxisLabel || "y"}.`;
          } else {
            primaryTakeaway = `There is little correlation between ${
              xAxisLabel || "x"
            } and ${yAxisLabel || "y"}.`;
          }
        }
      }
    });

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze bubble chart data
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} xAxisLabel - X-axis label
   * @param {string} yAxisLabel - Y-axis label
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeBubbleChartBasic(datasets, labels, xAxisLabel, yAxisLabel) {
    console.log("[Chart Accessibility] Using BASIC bubble chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // Analyze bubble sizes and positions
    datasets.forEach((dataset, i) => {
      const datasetLabel = dataset.label || `Dataset ${i + 1}`;

      if (dataset.data.length > 0 && typeof dataset.data[0] === "object") {
        // Find largest bubble
        const bubbleSizes = dataset.data.map((point) => point.r);
        const maxBubbleIndex = bubbleSizes.indexOf(Math.max(...bubbleSizes));
        const maxBubble = dataset.data[maxBubbleIndex];

        insights.push(
          `${datasetLabel}'s largest bubble is at (${formatValue(
            maxBubble.x
          )}, ${formatValue(maxBubble.y)}) with size ${maxBubble.r}.`
        );

        // Use largest bubble as primary takeaway for first dataset
        if (i === 0) {
          primaryTakeaway = `The largest bubble has ${
            xAxisLabel || "x"
          } value of ${formatValue(maxBubble.x)} and ${
            yAxisLabel || "y"
          } value of ${formatValue(maxBubble.y)}.`;
        }
      }
    });

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze radar chart data
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeRadarChartBasic(datasets, labels, valueDescriptor) {
    console.log("[Chart Accessibility] Using BASIC radar chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // Analyze radar chart strengths and weaknesses
    datasets.forEach((dataset, i) => {
      const datasetLabel = dataset.label || `Dataset ${i + 1}`;
      const dataValues = dataset.data;

      const maxValue = Math.max(...dataValues);
      const minValue = Math.min(...dataValues);
      const maxIndex = dataValues.indexOf(maxValue);
      const minIndex = dataValues.indexOf(minValue);

      insights.push(
        `${datasetLabel} is strongest in ${labels[maxIndex]} (${formatValue(
          maxValue
        )}).`
      );
      insights.push(
        `${datasetLabel} is weakest in ${labels[minIndex]} (${formatValue(
          minValue
        )}).`
      );

      if (i === 0) {
        primaryTakeaway = `${datasetLabel} shows the highest value in ${labels[maxIndex]} and lowest in ${labels[minIndex]}.`;
      }
    });

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Analyze generic chart data
   * @param {Array} datasets - Chart datasets
   * @param {Array} labels - Chart labels
   * @param {string} valueDescriptor - Description of the values
   * @returns {Object} Object containing insights and primary takeaway
   */
  function analyzeGenericChartBasic(datasets, labels, valueDescriptor) {
    console.log("[Chart Accessibility] Using BASIC generic chart analysis");
    const insights = [];
    let primaryTakeaway = "";

    // Generic analysis for other chart types
    const genericStats = analyzeData(datasets);
    insights.push(`Highest value: ${formatValue(genericStats.max)}`);
    insights.push(`Lowest value: ${formatValue(genericStats.min)}`);
    insights.push(`Average value: ${formatValue(genericStats.average)}`);

    // Generic primary takeaway
    primaryTakeaway = `Values range from ${formatValue(
      genericStats.min
    )} to ${formatValue(genericStats.max)}.`;

    return {
      insights: insights,
      primaryTakeaway: primaryTakeaway,
    };
  }

  /**
   * Get the chart title or generate a suitable caption
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @returns {string} The chart title
   */
  function getChartTitle(chartInstance, chartData) {
    // Try to get title from Chart.js v3+ options (rendered instance)
    if (
      chartInstance.options &&
      chartInstance.options.plugins &&
      chartInstance.options.plugins.title &&
      chartInstance.options.plugins.title.text
    ) {
      return chartInstance.options.plugins.title.text;
    }

    // Try to get title from Chart.js v3+ original chart data
    if (
      chartData.options &&
      chartData.options.plugins &&
      chartData.options.plugins.title &&
      chartData.options.plugins.title.text
    ) {
      return chartData.options.plugins.title.text;
    }

    // ✓ ADDED: Try to get title from Chart.js v2 format (backward compatibility)
    if (
      chartData.options &&
      chartData.options.title &&
      chartData.options.title.text
    ) {
      console.log(
        "[Chart Accessibility] Using legacy Chart.js v2 title format. Consider updating to v3 format: options.plugins.title.text"
      );
      return chartData.options.title.text;
    }

    // Generate a default title based on chart type
    const chartType = chartInstance.config.type;
    let title = `${
      chartType.charAt(0).toUpperCase() + chartType.slice(1)
    } Chart`;

    // Try to add more context from axis labels
    if (chartInstance.options && chartInstance.options.scales) {
      let xLabel = "";
      let yLabel = "";

      if (
        chartInstance.options.scales.x &&
        chartInstance.options.scales.x.title &&
        chartInstance.options.scales.x.title.text
      ) {
        xLabel = chartInstance.options.scales.x.title.text;
      }

      if (
        chartInstance.options.scales.y &&
        chartInstance.options.scales.y.title &&
        chartInstance.options.scales.y.title.text
      ) {
        yLabel = chartInstance.options.scales.y.title.text;
      }

      if (xLabel && yLabel) {
        title += ` of ${yLabel} by ${xLabel}`;
      } else if (yLabel) {
        title += ` of ${yLabel}`;
      } else if (xLabel) {
        title += ` by ${xLabel}`;
      }
    }

    return title;
  }

  /**
   * Add necessary CSS styles for data tables
   * Call this function once during initialization
   */
  function addDataTableStyles() {
    // Check if styles are already added
    if (document.getElementById("chart-data-table-styles")) {
      return;
    }

    // Create style element
    const style = document.createElement("style");
    style.id = "chart-data-table-styles";

    // Add CSS rules
    style.textContent = `

  `;

    // Add styles to document head
    document.head.appendChild(style);

    console.log("[Chart Accessibility] Added data table styles");
  }

  /**
   * Create a button to toggle description visibility
   * @param {HTMLElement} container - The chart container
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string|number} chartId - Unique identifier for the chart
   * @param {string} detailedDescription - Optional custom detailed description
   * @returns {HTMLElement} The created button
   */
  function createDescriptionToggleButton(
    container,
    chartInstance,
    chartData,
    chartId,
    detailedDescription
  ) {
    const descButton = document.createElement("button");
    descButton.className = config.buttonClasses;
    descButton.innerHTML = `${getDescriptionButtonIcon()} ${
      config.showDescriptionText
    }`;
    descButton.setAttribute("aria-label", "Show chart description");
    descButton.setAttribute("type", "button");
    descButton.setAttribute("data-chart-id", chartId);
    descButton.setAttribute("aria-expanded", "false");
    descButton.setAttribute("aria-controls", `chart-description-${chartId}`);

    // Create description container (initially hidden)
    const descContainer = createDescriptionContainer(
      chartInstance,
      chartData,
      chartId,
      detailedDescription
    );

    // Find the figure element that wraps the container
    let figureElement = container.parentElement;
    if (figureElement && figureElement.tagName === "FIGURE") {
      // Insert the detailed description after the figure
      figureElement.parentNode.insertBefore(
        descContainer,
        figureElement.nextSibling
      );
    } else {
      // Fallback: insert after container if not wrapped in figure yet
      container.parentNode.insertBefore(descContainer, container.nextSibling);
    }

    // Add event listener for description toggle button
    descButton.addEventListener("click", function () {
      const isExpanded = this.getAttribute("aria-expanded") === "true";
      const newState = !isExpanded;

      // Toggle visibility
      this.setAttribute("aria-expanded", newState.toString());
      descContainer.style.display = newState ? "block" : "none";

      // Update button text
      this.innerHTML = `${getDescriptionButtonIcon()} ${
        newState ? config.hideDescriptionText : config.showDescriptionText
      }`;

      // Announce to screen readers
      announceToScreenReader(
        newState ? "Chart description shown" : "Chart description hidden"
      );
    });

    return descButton;
  }

  /**
   * Create the description container for a chart
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string|number} chartId - Unique identifier for the chart
   * @returns {HTMLElement} The created description container
   */
  function createDescriptionContainer(
    chartInstance,
    chartData,
    chartId,
    detailedDescription
  ) {
    // Create the main container
    const container = document.createElement("div");
    container.id = `chart-description-${chartId}`;
    container.className = config.descriptionClass;
    container.setAttribute("aria-live", "polite");
    container.style.display = "none"; // Hidden by default

    // Generate short and detailed descriptions
    const chartType = chartInstance.config.type;
    const shortDesc = generateShortDescription(
      chartInstance,
      chartData,
      chartType
    );
    const detailedDesc =
      detailedDescription ||
      generateDetailedDescription(chartInstance, chartData, chartType);

    // Create the short description section
    const shortDescSection = document.createElement("section");
    shortDescSection.className = "chart-short-description-section";

    // Create the short description heading
    const shortDescHeading = document.createElement("h3");
    shortDescHeading.className = "chart-short-description-heading";
    shortDescHeading.textContent = "Short Description";
    shortDescSection.appendChild(shortDescHeading);

    // Create the short description paragraph
    const shortDescElem = document.createElement("p");
    shortDescElem.className = "chart-short-description";
    shortDescElem.textContent = shortDesc;
    shortDescSection.appendChild(shortDescElem);

    // Add the short description section to the container
    container.appendChild(shortDescSection);

    // Create the detailed description section
    const detailsSection = document.createElement("section");
    detailsSection.className = "chart-detailed-description-section";

    // Add detailed description heading
    const detailsHeading = document.createElement("h3");
    detailsHeading.className = "chart-details-heading";
    detailsHeading.textContent = "Detailed Description";
    detailsSection.appendChild(detailsHeading);

    // The modified generateDetailedDescription function now returns HTML with its own container
    // so we should just insert it directly into the section
    detailsSection.innerHTML += detailedDesc;

    // Add the detailed description section to the container
    container.appendChild(detailsSection);

    // Add export controls if the export module is available
    if (window.ChartAccessibilityExport) {
      try {
        const exportControls = createExportControls(container);
        if (exportControls) {
          container.appendChild(exportControls);
        }
      } catch (error) {
        console.error(
          "[Chart Accessibility] Error adding export controls:",
          error
        );
      }
    }

    return container;
  }

  /**
   * Create export control buttons for a description container
   * @param {HTMLElement} descContainer - The description container element
   * @returns {HTMLElement} The export controls container
   */
  function createExportControls(descContainer) {
    // Check if export module is loaded
    if (!window.ChartAccessibilityExport) {
      console.warn(
        "[Chart Accessibility] Export module not loaded, skipping export controls"
      );
      return null;
    }

    // Create export controls container
    const exportControls = document.createElement("div");
    exportControls.className = "chart-export-controls";
    exportControls.setAttribute("role", "toolbar");
    exportControls.setAttribute("aria-label", "Description export options");

    // Create copy group
    const copyGroup = document.createElement("div");
    copyGroup.className = "chart-export-group";

    // Copy group label
    const copyLabel = document.createElement("div");
    copyLabel.className = "chart-export-group-label";
    copyLabel.textContent = "Copy to Clipboard";
    copyGroup.appendChild(copyLabel);

    // Copy buttons container
    const copyButtons = document.createElement("div");
    copyButtons.className = "chart-export-buttons";

    // Copy as HTML button
    const copyHtmlButton = createExportButton(
      "copy-html",
      "Copy as HTML",
      "Copy description HTML to clipboard",
      getCopyHtmlIcon(),
      () => handleCopyHtml(descContainer)
    );
    copyButtons.appendChild(copyHtmlButton);

    // Copy as Formatted Text button
    const copyFormattedButton = createExportButton(
      "copy-formatted",
      "Copy formatted text",
      "Copy formatted description for pasting into Word etc",
      getCopyFormattedIcon(),
      () => handleCopyFormatted(descContainer)
    );
    copyButtons.appendChild(copyFormattedButton);

    // Copy as Text button
    const copyTextButton = createExportButton(
      "copy-text",
      "Copy plain text",
      "Copy description text to clipboard",
      getCopyTextIcon(),
      () => handleCopyText(descContainer)
    );
    copyButtons.appendChild(copyTextButton);

    copyGroup.appendChild(copyButtons);
    exportControls.appendChild(copyGroup);

    // Create download group
    const downloadGroup = document.createElement("div");
    downloadGroup.className = "chart-export-group";

    // Download group label
    const downloadLabel = document.createElement("div");
    downloadLabel.className = "chart-export-group-label";
    downloadLabel.textContent = "Download";
    downloadGroup.appendChild(downloadLabel);

    // Download buttons container
    const downloadButtons = document.createElement("div");
    downloadButtons.className = "chart-export-buttons";

    // Download as HTML button
    const downloadHtmlButton = createExportButton(
      "download-html",
      "HTML",
      "Download description as HTML file",
      getDownloadHtmlIcon(),
      () => handleDownloadHtml(descContainer)
    );
    downloadButtons.appendChild(downloadHtmlButton);

    // Download as Text button
    const downloadTextButton = createExportButton(
      "download-text",
      "Text",
      "Download description as text file",
      getDownloadTextIcon(),
      () => handleDownloadText(descContainer)
    );
    downloadButtons.appendChild(downloadTextButton);

    // Download as Markdown button
    const downloadMarkdownButton = createExportButton(
      "download-markdown",
      "Markdown",
      "Download description as Markdown file",
      getDownloadMarkdownIcon(),
      () => handleDownloadMarkdown(descContainer)
    );
    downloadButtons.appendChild(downloadMarkdownButton);

    downloadGroup.appendChild(downloadButtons);
    exportControls.appendChild(downloadGroup);

    // Create feedback tooltip
    const feedbackTooltip = document.createElement("div");
    feedbackTooltip.className = "chart-export-feedback";
    feedbackTooltip.setAttribute("aria-hidden", "true");
    exportControls.appendChild(feedbackTooltip);

    return exportControls;
  }

  /**
   * Create a button for export controls
   * @param {string} className - Button class name suffix
   * @param {string} text - Button text
   * @param {string} ariaLabel - Button ARIA label
   * @param {string} icon - Button icon SVG
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} The button element
   */
  function createExportButton(className, text, ariaLabel, icon, onClick) {
    const button = document.createElement("button");
    button.className = `chart-export-button ${className}`;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("type", "button");
    button.innerHTML = `${icon}<span>${text}</span>`;

    // Add click handler
    button.addEventListener("click", onClick);

    // Add keyboard support
    button.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });

    return button;
  }

  /**
   * Show feedback notification using Universal Notifications
   * Replacement for tooltip-based feedback system
   * @param {HTMLElement} exportControls - Legacy parameter (no longer used but kept for compatibility)
   * @param {string} message - The message to show
   * @param {boolean} isError - Whether it's an error message
   * @returns {string|null} Notification ID for potential dismissal
   */
  function showFeedbackTooltip(exportControls, message, isError = false) {
    // Determine notification type based on error status
    const notificationType = isError ? "error" : "success";

    // Configure options for consistent behaviour with original tooltip
    const options = {
      duration: 3000, // Match original 3-second duration
      dismissible: true, // Allow manual dismissal
      persistent: false, // Auto-dismiss after duration
    };

    // Special handling for errors - they typically shouldn't auto-dismiss
    // But maintaining original behaviour for compatibility
    if (isError) {
      // Override default error behaviour to match original auto-hide
      options.duration = 3000;
    }

    // Show notification using UniversalNotifications
    // This automatically handles:
    // - Screen reader announcements
    // - Proper ARIA attributes
    // - Accessible styling
    // - Cross-browser compatibility
    const notificationId = UniversalNotifications.show(
      message,
      notificationType,
      options
    );

    // Return notification ID in case caller wants to dismiss it manually
    return notificationId;
  }

  /**
   * Handle copy as HTML button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleCopyHtml(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    window.ChartAccessibilityExport.copyHtmlToClipboard(descContainer)
      .then((success) => {
        if (success) {
          showFeedbackTooltip(exportControls, "HTML copied to clipboard");
        } else {
          showFeedbackTooltip(exportControls, "Failed to copy HTML", true);
        }
      })
      .catch((error) => {
        console.error("[Chart Accessibility] Error copying HTML:", error);
        showFeedbackTooltip(exportControls, "Failed to copy HTML", true);
      });
  }

  /**
   * Handle copy as text button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleCopyText(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    window.ChartAccessibilityExport.copyTextToClipboard(descContainer)
      .then((success) => {
        if (success) {
          showFeedbackTooltip(exportControls, "Text copied to clipboard");
        } else {
          showFeedbackTooltip(exportControls, "Failed to copy text", true);
        }
      })
      .catch((error) => {
        console.error("[Chart Accessibility] Error copying text:", error);
        showFeedbackTooltip(exportControls, "Failed to copy text", true);
      });
  }

  /**
   * Handle copy as formatted text button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleCopyFormatted(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    window.ChartAccessibilityExport.copyFormattedTextForWord(descContainer)
      .then((success) => {
        if (success) {
          showFeedbackTooltip(exportControls, "Formatted text copied for Word");
        } else {
          showFeedbackTooltip(
            exportControls,
            "Failed to copy formatted text",
            true
          );
        }
      })
      .catch((error) => {
        console.error(
          "[Chart Accessibility] Error copying formatted text:",
          error
        );
        showFeedbackTooltip(
          exportControls,
          "Failed to copy formatted text",
          true
        );
      });
  }

  /**
   * Handle download as HTML button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleDownloadHtml(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    try {
      // Extract chart ID from container ID
      const containerIdMatch = descContainer.id.match(
        /chart-description-([\w-]+)/
      );
      const chartId = containerIdMatch ? containerIdMatch[1] : "chart";

      window.ChartAccessibilityExport.downloadAsHtml(
        descContainer,
        `chart-description-${chartId}.html`
      );

      showFeedbackTooltip(exportControls, "HTML downloaded");
    } catch (error) {
      console.error("[Chart Accessibility] Error downloading HTML:", error);
      showFeedbackTooltip(exportControls, "Failed to download HTML", true);
    }
  }

  /**
   * Handle download as text button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleDownloadText(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    try {
      // Extract chart ID from container ID
      const containerIdMatch = descContainer.id.match(
        /chart-description-([\w-]+)/
      );
      const chartId = containerIdMatch ? containerIdMatch[1] : "chart";

      window.ChartAccessibilityExport.downloadAsText(
        descContainer,
        `chart-description-${chartId}.txt`
      );

      showFeedbackTooltip(exportControls, "Text downloaded");
    } catch (error) {
      console.error("[Chart Accessibility] Error downloading text:", error);
      showFeedbackTooltip(exportControls, "Failed to download text", true);
    }
  }

  /**
   * Handle download as Markdown button click
   * @param {HTMLElement} descContainer - The description container
   */
  function handleDownloadMarkdown(descContainer) {
    const exportControls = descContainer.querySelector(
      ".chart-export-controls"
    );
    if (!exportControls) return;

    try {
      // Extract chart ID from container ID
      const containerIdMatch = descContainer.id.match(
        /chart-description-([\w-]+)/
      );
      const chartId = containerIdMatch ? containerIdMatch[1] : "chart";

      window.ChartAccessibilityExport.downloadAsMarkdown(
        descContainer,
        `chart-description-${chartId}.md`
      );

      showFeedbackTooltip(exportControls, "Markdown downloaded");
    } catch (error) {
      console.error("[Chart Accessibility] Error downloading Markdown:", error);
      showFeedbackTooltip(exportControls, "Failed to download Markdown", true);
    }
  }

  /**
   * Get copy HTML icon SVG
   * @returns {string} SVG HTML
   */
  function getCopyHtmlIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>`;
  }

  /**
   * Get copy text icon SVG
   * @returns {string} SVG HTML
   */
  function getCopyTextIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>`;
  }

  /**
   * Get copy formatted text icon SVG
   * @returns {string} SVG HTML
   */
  function getCopyFormattedIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
  <rect x="7" y="7" width="6" height="2"></rect>
  <rect x="7" y="13" width="10" height="2"></rect>
  <rect x="7" y="17" width="8" height="2"></rect>
</svg>`;
  }

  /**
   * Get download HTML icon SVG
   * @returns {string} SVG HTML
   */
  function getDownloadHtmlIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 20h16"></path>
    <path d="M12 4v12"></path>
    <path d="m8 12 4 4 4-4"></path>
  </svg>`;
  }

  /**
   * Get download text icon SVG
   * @returns {string} SVG HTML
   */
  function getDownloadTextIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>`;
  }

  /**
   * Get download Markdown icon SVG
   * @returns {string} SVG HTML
   */
  function getDownloadMarkdownIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
    <path d="M3 21h18"></path>
  </svg>`;
  }

  /**
   * Format numbers according to style guide
   * @param {number} num - The number to format
   * @param {boolean} isRanking - Whether this is a ranking (1st, 2nd, etc.)
   * @returns {string} Formatted number as word or numeral
   */
  function formatNumberToWord(num, isRanking = false) {
    // Arrays for number words and ranking words
    const numberWords = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];
    const rankingWords = [
      "first",
      "second",
      "third",
      "fourth",
      "fifth",
      "sixth",
      "seventh",
      "eighth",
      "ninth",
    ];

    // Handle rankings
    if (isRanking) {
      if (num >= 1 && num <= 9) {
        return rankingWords[num - 1];
      } else {
        // 10th and above
        return `${num}th`;
      }
    }

    // Handle regular numbers
    if (num >= 0 && num <= 9) {
      return numberWords[num];
    } else {
      // Use numerals for 10 and above
      return num.toString();
    }
  }

  /**
   * Detect what type of time periods the labels represent (months, days, years, etc.)
   * @param {Array} labels - The chart labels
   * @returns {string|null} The detected time period type or null if not detected
   */
  function detectTimePeriodsType(labels) {
    // If no labels or not enough labels, return null
    if (!labels || !Array.isArray(labels) || labels.length < 2) {
      return null;
    }

    // Convert labels to lowercase for matching
    const lowerLabels = labels.map((label) => String(label).toLowerCase());

    // Check for month names
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];

    const hasMonths = lowerLabels.some((label) => monthNames.includes(label));
    if (hasMonths) return "months";

    // Check for days of the week
    const dayNames = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ];

    const hasDays = lowerLabels.some((label) => dayNames.includes(label));
    if (hasDays) return "days";

    // Check for years (e.g., 2020, 2021, 2022)
    const yearPattern = /^(19|20)\d{2}$/;
    const hasYears = lowerLabels.some((label) => yearPattern.test(label));
    if (hasYears) return "years";

    // Check for date patterns
    const datePattern = /\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?/;
    const hasDatePattern = lowerLabels.some((label) => datePattern.test(label));
    if (hasDatePattern) return "dates";

    // Check for time patterns (HH:MM:SS or HH:MM)
    const timePattern = /\d{1,2}:\d{2}(:\d{2})?/;
    const hasTimePattern = lowerLabels.some((label) => timePattern.test(label));
    if (hasTimePattern) return "times";

    // Check for quarters (Q1, Q2, Q3, Q4)
    const quarterPattern = /^q[1-4]$/;
    const hasQuarters = lowerLabels.some((label) => quarterPattern.test(label));
    if (hasQuarters) return "quarters";

    // Unable to detect a specific time period
    return null;
  }

  /**
   * Format a list of items as a comma-separated string with "and" before the last item
   * @param {Array} items - Array of items to format
   * @param {boolean} lowercase - Whether to convert items to lowercase
   * @returns {string} Formatted string (e.g., "item1, item2 and item3")
   */
  function formatListWithAnd(items, lowercase = true) {
    if (!items || items.length === 0) return "";

    // Convert items to lowercase if needed
    const formattedItems = lowercase
      ? items.map((item) =>
          typeof item === "string" ? item.toLowerCase() : item
        )
      : [...items];

    if (formattedItems.length === 1) {
      return formattedItems[0];
    } else if (formattedItems.length === 2) {
      return `${formattedItems[0]} and ${formattedItems[1]}`;
    } else {
      const lastItem = formattedItems.pop();
      return `${formattedItems.join(", ")} and ${lastItem}`;
    }
  }

  /**
   * Generate a short description for a chart
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {string} A short description
   */
  function generateShortDescription(chartInstance, chartData, chartType) {
    // Get chart title
    const title = getChartTitle(chartInstance, chartData);

    // Get axis information
    const xAxisLabel = getAxisLabel(chartInstance, "x");
    const yAxisLabel = getAxisLabel(chartInstance, "y");
    const xAxisLabelLowercase = getAxisLabel(chartInstance, "x", true);
    const yAxisLabelLowercase = getAxisLabel(chartInstance, "y", true);

    // Count datasets and data points
    const datasetCount = chartInstance.data.datasets.length;
    const dataPointCount = chartInstance.data.labels
      ? chartInstance.data.labels.length
      : 0;

    // Get the time period type if applicable
    const timePeriodType = detectTimePeriodsType(chartInstance.data.labels);

    // Determine the value descriptor (use dataset label if only one dataset)
    let valueDescriptor = yAxisLabelLowercase || "values"; // Use lowercase by default for short description
    if (datasetCount === 1 && chartInstance.data.datasets[0].label) {
      // Use the dataset label but convert to lowercase for sentence context
      valueDescriptor = chartInstance.data.datasets[0].label.toLowerCase();
    }

    // Get dataset labels for multi-dataset charts
    let datasetLabels = [];
    if (datasetCount > 1) {
      datasetLabels = chartInstance.data.datasets.map(
        (dataset) => dataset.label || "Unlabelled dataset"
      );
    }

    // Format dataset labels string if needed
    const datasetLabelsString =
      datasetCount > 1 ? `: ${formatListWithAnd(datasetLabels)}` : "";

    // Create basic description based on chart type
    let basicDescription = "";

    switch (chartType) {
      case "bar":
        basicDescription = `A bar chart titled "${title}" showing ${valueDescriptor} for ${formatNumberToWord(
          dataPointCount
        )} ${
          timePeriodType ||
          (xAxisLabel ? xAxisLabel.toLowerCase() : "categories")
        }${
          datasetCount > 1
            ? ` for ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
        break;

      case "line":
        basicDescription = `A line chart titled "${title}" showing ${valueDescriptor} over ${formatNumberToWord(
          dataPointCount
        )} ${
          timePeriodType ||
          (xAxisLabel ? xAxisLabel.toLowerCase() : "time periods")
        }${
          datasetCount > 1
            ? ` for ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
        break;

      case "pie":
      case "doughnut":
        basicDescription = `A ${chartType} chart titled "${title}" showing the distribution of ${formatNumberToWord(
          dataPointCount
        )} categories.`;
        break;

      case "scatter":
        basicDescription = `A scatter plot titled "${title}" showing the relationship between ${
          xAxisLabelLowercase || "x-values"
        } and ${yAxisLabelLowercase || "y-values"}${
          datasetCount > 1
            ? ` for ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
        break;

      case "bubble":
        basicDescription = `A bubble chart titled "${title}" showing the relationship between ${
          xAxisLabelLowercase || "x-values"
        }, ${yAxisLabelLowercase || "y-values"}, and bubble size${
          datasetCount > 1
            ? ` for ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
        break;

      case "radar":
        basicDescription = `A radar chart titled "${title}" comparing ${formatNumberToWord(
          dataPointCount
        )} metrics${
          datasetCount > 1
            ? ` across ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
        break;

      case "polarArea":
        basicDescription = `A polar area chart titled "${title}" showing the distribution of ${formatNumberToWord(
          dataPointCount
        )} categories.`;
        break;

      default:
        basicDescription = `A ${chartType} chart titled "${title}"${
          dataPointCount > 0
            ? ` with ${formatNumberToWord(dataPointCount)} data points`
            : ""
        }${
          datasetCount > 1
            ? ` across ${formatNumberToWord(
                datasetCount
              )} data series${datasetLabelsString}`
            : ""
        }.`;
    }

    // Get data insights and primary takeaway
    const analysis = analyzeChartForInsights(
      chartInstance,
      chartData,
      chartType
    );

    // Combine basic description with primary takeaway if available
    if (analysis.primaryTakeaway) {
      return `${basicDescription} ${analysis.primaryTakeaway}`;
    }

    return basicDescription;
  }

  /**
   * Generate a detailed description for a chart
   * @param {Object} chartInstance - The Chart.js instance
   * @param {Object} chartData - The original chart data object
   * @param {string} chartType - The type of chart
   * @returns {string} A detailed description with HTML formatting
   */
  function generateDetailedDescription(chartInstance, chartData, chartType) {
    // Initialize the detailed description container
    let description = `<div class="chart-detailed-description">`;
    // Get basic chart information
    const title = getChartTitle(chartInstance, chartData);
    const xAxisLabel = getAxisLabel(chartInstance, "x");
    const yAxisLabel = getAxisLabel(chartInstance, "y");
    const xAxisLabelLowercase = getAxisLabel(chartInstance, "x", true);
    const yAxisLabelLowercase = getAxisLabel(chartInstance, "y", true);

    // Extract data points and perform analysis
    const datasets = chartInstance.data.datasets;
    const labels = chartInstance.data.labels || [];

    // Get time period type if applicable
    const timePeriodType = detectTimePeriodsType(labels);

    // Determine value descriptor (use dataset label if only one dataset)
    let valueDescriptor = yAxisLabel || "values";
    let valueDescriptorLowercase = yAxisLabelLowercase || "values";
    if (datasets.length === 1 && datasets[0].label) {
      valueDescriptor = datasets[0].label;
      valueDescriptorLowercase = datasets[0].label.toLowerCase();
    }

    // Determine x-axis descriptor
    const xAxisDescriptor =
      timePeriodType || (xAxisLabel ? xAxisLabel.toLowerCase() : "categories");
    const xAxisDescriptorCapitalized =
      xAxisDescriptor.charAt(0).toUpperCase() + xAxisDescriptor.slice(1);

    // Start with chart construction section
    description += `<section class="chart-section chart-construction-section">
      <h4 class="chart-details-heading">Chart Construction</h4>`;

    // Add structure description based on chart type
    switch (chartType) {
      case "bar":
        // For bar charts
        description += `<p>This ${chartType} chart titled "${title}" shows ${valueDescriptorLowercase} for ${
          timePeriodType || xAxisLabelLowercase || "categories"
        }.</p>`;

        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        // Add data points as bullet list
        if (labels.length > 0) {
          description += `<p>and ${formatNumberToWord(
            labels.length
          )} data points${datasets.length > 1 ? " per series" : ""}:</p>`;
          description += `<ul>`;
          labels.forEach((label) => {
            description += `<li>${label.toString().toLowerCase()}</li>`;
          });
          description += `</ul>`;
        }

        description += `<p>${xAxisDescriptorCapitalized} are plotted on the x-axis and ${valueDescriptorLowercase} are plotted on the y-axis.</p>`;

        // Add key insights/data analysis with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const analysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (analysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (analysis.primaryTakeaway) {
          description += `<li><strong>${analysis.primaryTakeaway}</strong></li>`;
        }
        analysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (analysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            analysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            analysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            analysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            analysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            analysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // List all data points with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Complete Data Points</h4>`;
        description += `<ul>`;
        labels.forEach((label, index) => {
          let dataValues = [];
          datasets.forEach((dataset) => {
            if (dataset.data[index] !== undefined) {
              dataValues.push({
                label: dataset.label || "Dataset",
                value: dataset.data[index],
              });
            }
          });

          // Format data points consistently
          const dataPointDesc = dataValues
            .map((dv) => `${dv.label}: ${formatValue(dv.value)}`)
            .join(", ");
          description += `<li>${label}: ${dataPointDesc}</li>`;
        });
        description += `</ul>`;
        break;

      case "line":
        description += `<p>This ${chartType} chart titled "${title}" shows trends over ${
          timePeriodType || "time or categories"
        }.</p>`;

        // Add dataset information as bullet list if multiple datasets
        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        // Add data points as bullet list
        if (labels.length > 0) {
          description += `<p>and ${formatNumberToWord(
            labels.length
          )} data points${datasets.length > 1 ? " per series" : ""}:</p>`;
          description += `<ul>`;
          labels.forEach((label) => {
            description += `<li>${label.toString().toLowerCase()}</li>`;
          });
          description += `</ul>`;
        }

        description += `<p>${xAxisDescriptorCapitalized} are shown on the x-axis and ${valueDescriptorLowercase} on the y-axis.</p>`;

        // Add key insights with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const lineAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (lineAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (lineAnalysis.primaryTakeaway) {
          description += `<li><strong>${lineAnalysis.primaryTakeaway}</strong></li>`;
        }
        lineAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (lineAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            lineAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            lineAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            lineAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            lineAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            lineAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Complete data points listing for each time period with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Complete Data Points</h4>`;
        description += `<ul>`;
        labels.forEach((label, index) => {
          description += `<li>${label}: `;
          const points = datasets
            .map(
              (d) => `${d.label || "Dataset"}: ${formatValue(d.data[index])}`
            )
            .join(", ");
          description += `${points}</li>`;
        });
        description += `</ul>`;
        break;

      case "pie":
      case "doughnut":
        description += `<p>This ${chartType} chart titled "${title}" shows the distribution of categories.</p>`;

        // Add data points as bullet list
        if (labels.length > 0) {
          description += `<p>The chart shows ${formatNumberToWord(
            labels.length
          )} categories:</p>`;
          description += `<ul>`;
          labels.forEach((label) => {
            description += `<li>${label.toString().toLowerCase()}</li>`;
          });
          description += `</ul>`;
        }

        // Add key insights with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const pieAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (pieAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (pieAnalysis.primaryTakeaway) {
          description += `<li><strong>${pieAnalysis.primaryTakeaway}</strong></li>`;
        }
        pieAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (pieAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            pieAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            pieAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            pieAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            pieAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            pieAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Complete data listing with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Complete Data Points</h4>`;
        description += `<ul>`;
        const pieData = datasets[0].data;
        const total = pieData.reduce((sum, value) => sum + value, 0);

        labels.forEach((label, index) => {
          const value = pieData[index];
          const percentage = ((value / total) * 100).toFixed(1);
          description += `<li>${label}: ${formatValue(
            value
          )} (${percentage}%)</li>`;
        });
        description += `</ul>`;
        break;

      case "scatter":
        description += `<p>This ${chartType} chart titled "${title}" shows the relationship between ${
          xAxisLabel || "x-values"
        } and ${yAxisLabel || "y-values"}.</p>`;

        // Add dataset information as bullet list if multiple datasets
        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        description += `<p>The chart contains a total of ${formatNumberToWord(
          getTotalPointCount(datasets)
        )} data points.</p>`;

        // Add correlation analysis as key insight with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const scatterAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (scatterAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (scatterAnalysis.primaryTakeaway) {
          description += `<li><strong>${scatterAnalysis.primaryTakeaway}</strong></li>`;
        }
        scatterAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (scatterAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            scatterAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            scatterAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            scatterAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            scatterAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            scatterAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Only add sample data points for scatter plots (could be too many) with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Sample Data Points</h4>`;
        description += `<ul>`;
        datasets.forEach((dataset) => {
          const samplePoints = dataset.data.slice(0, 10);
          description += `<li>${dataset.label || "Dataset"}: `;
          description += samplePoints
            .map(
              (point) => `(${formatValue(point.x)}, ${formatValue(point.y)})`
            )
            .join(", ");
          description += `</li>`;
        });
        description += `</ul>`;

        // Add note about full data availability
        if (getTotalPointCount(datasets) > 20) {
          description += `<p>Note: This chart contains ${formatNumberToWord(
            getTotalPointCount(datasets)
          )} total data points. Only a sample is shown above.</p>`;
        }
        break;

      case "bubble":
        description += `<p>This ${chartType} chart titled "${title}" shows the relationship between ${
          xAxisLabel || "x-values"
        }, ${yAxisLabel || "y-values"}, and bubble size.</p>`;

        // Add dataset information as bullet list if multiple datasets
        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        description += `<p>The chart contains a total of ${formatNumberToWord(
          getTotalPointCount(datasets)
        )} data points.</p>`;

        // Add key insights with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const bubbleAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (bubbleAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (bubbleAnalysis.primaryTakeaway) {
          description += `<li><strong>${bubbleAnalysis.primaryTakeaway}</strong></li>`;
        }
        bubbleAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (bubbleAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            bubbleAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            bubbleAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            bubbleAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            bubbleAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            bubbleAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Sample data points with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Sample Data Points</h4>`;
        description += `<ul>`;
        datasets.forEach((dataset) => {
          const samplePoints = dataset.data.slice(0, 10);
          description += `<li>${dataset.label || "Dataset"}: `;
          description += samplePoints
            .map(
              (point) =>
                `(${formatValue(point.x)}, ${formatValue(
                  point.y
                )}, size: ${formatValue(point.r)})`
            )
            .join(", ");
          description += `</li>`;
        });
        description += `</ul>`;
        break;

      case "radar":
      case "polarArea":
        description += `<p>This ${chartType} chart titled "${title}" compares multiple metrics across categories.</p>`;

        // Add categories information as bullet list
        if (labels.length > 0) {
          description += `<p>The chart displays ${formatNumberToWord(
            labels.length
          )} categories:</p>`;
          description += `<ul>`;
          labels.forEach((label) => {
            description += `<li>${label.toString().toLowerCase()}</li>`;
          });
          description += `</ul>`;
        }

        // Add dataset information as bullet list if multiple datasets
        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        // Add key insights with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const radarAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (radarAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (radarAnalysis.primaryTakeaway) {
          description += `<li><strong>${radarAnalysis.primaryTakeaway}</strong></li>`;
        }
        radarAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (radarAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            radarAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            radarAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            radarAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            radarAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            radarAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Complete data listing with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Complete Data Points</h4>`;
        description += `<ul>`;
        labels.forEach((label, index) => {
          description += `<li>${label}: `;
          description += datasets
            .map(
              (dataset) =>
                `${dataset.label || "Dataset"}: ${formatValue(
                  dataset.data[index]
                )}`
            )
            .join(", ");
          description += `</li>`;
        });
        description += `</ul>`;
        break;

      default:
        description += `<p>This ${chartType} chart titled "${title}" presents data in a ${chartType} format.</p>`;

        // Add categories information as bullet list
        if (labels.length > 0) {
          description += `<p>The chart contains ${formatNumberToWord(
            labels.length
          )} categories:</p>`;
          description += `<ul>`;
          labels.forEach((label) => {
            description += `<li>${label.toString().toLowerCase()}</li>`;
          });
          description += `</ul>`;
        }

        // Add dataset information as bullet list if multiple datasets
        if (datasets.length > 1) {
          description += `<p>The chart has ${formatNumberToWord(
            datasets.length
          )} data series:</p>`;
          description += `<ul>`;
          datasets.forEach((dataset) => {
            // Convert dataset label to lowercase for better accessibility
            const labelText = dataset.label
              ? dataset.label.toLowerCase()
              : "unlabelled dataset";
            description += `<li>${labelText}</li>`;
          });
          description += `</ul>`;
        } else {
          // For single dataset, also convert to lowercase
          const singleLabelText = datasets[0].label
            ? datasets[0].label.toLowerCase()
            : "";
          description += `<p>The chart has one data series${
            singleLabelText ? `: ${singleLabelText}` : ""
          }.</p>`;
        }

        // Add key insights with heading
        description += `</section>
        <section class="chart-section chart-insights-section">
          <h4 class="chart-details-heading">Key Insights</h4>`;
        const defaultAnalysis = analyzeChartForInsights(
          chartInstance,
          chartData,
          chartType
        );
        // Check if advanced analysis was used
        if (defaultAnalysis.advancedAnalysis) {
          console.log(
            "[Chart Accessibility] Advanced statistical analysis applied."
          );
        }
        description += `<ul>`;
        if (defaultAnalysis.primaryTakeaway) {
          description += `<li><strong>${defaultAnalysis.primaryTakeaway}</strong></li>`;
        }
        defaultAnalysis.insights.forEach((insight) => {
          description += `<li>${insight}</li>`;
        });
        description += `</ul>`;

        // Add statistical summary if available
        if (defaultAnalysis.statistics) {
          description += `</section>
          <section class="chart-section chart-statistics-section">
            <h4 class="chart-details-heading">Statistical Summary</h4>`;
          description += `<ul>`;
          description += `<li>Mean: ${formatValue(
            defaultAnalysis.statistics.mean
          )}</li>`;
          description += `<li>Median: ${formatValue(
            defaultAnalysis.statistics.median
          )}</li>`;
          description += `<li>Standard Deviation: ${formatValue(
            defaultAnalysis.statistics.standardDeviation
          )}</li>`;
          description += `<li>95% Confidence Interval: ${formatValue(
            defaultAnalysis.statistics.confidenceInterval.lower
          )} to ${formatValue(
            defaultAnalysis.statistics.confidenceInterval.upper
          )}</li>`;
          description += `</ul>`;
        }

        // Add generic data listing for unknown chart types with heading
        description += `</section>
        <section class="chart-section chart-data-points-section">
          <h4 class="chart-details-heading">Data Points</h4>`;
        description += `<ul>`;
        labels.forEach((label, index) => {
          description += `<li>${label}: `;
          description += datasets
            .map(
              (dataset) =>
                `${dataset.label || "Dataset"}: ${formatValue(
                  dataset.data[index]
                )}`
            )
            .join(", ");
          description += `</li>`;
        });
        description += `</ul>`;
    }

    // Add the disclaimer text at the end
    description += `</section>
    <p class="chart-disclaimer">Description generated automatically, check data table to verify accuracy.</p>
    </div>`;

    return description;
  }

  /**
   * Get axis label from chart instance
   * @param {Object} chartInstance - The Chart.js instance
   * @param {string} axis - The axis to get the label for ('x' or 'y')
   * @param {boolean} lowercase - Whether to return the label in lowercase
   * @returns {string|null} The axis label or null if not found
   */
  function getAxisLabel(chartInstance, axis, lowercase = false) {
    if (
      chartInstance.options &&
      chartInstance.options.scales &&
      chartInstance.options.scales[axis] &&
      chartInstance.options.scales[axis].title &&
      chartInstance.options.scales[axis].title.text
    ) {
      const label = chartInstance.options.scales[axis].title.text;
      return lowercase ? label.charAt(0).toLowerCase() + label.slice(1) : label;
    }
    return null;
  }

  /**
   * Analyze dataset to get min, max, and average values
   * @param {Array} datasets - Array of Chart.js datasets
   * @returns {Object} Object with min, max, and average values, plus index information
   */
  function analyzeData(datasets) {
    let allValues = [];
    let valueIndices = {}; // To track where values came from

    // Extract all values from datasets
    datasets.forEach((dataset, datasetIndex) => {
      if (Array.isArray(dataset.data)) {
        // Handle different data formats
        dataset.data.forEach((value, valueIndex) => {
          // Skip null or undefined values
          if (value === null || value === undefined) return;

          let actualValue;
          if (typeof value === "object") {
            // Handle {x, y} format for scatter plots
            actualValue = value.y !== undefined ? value.y : value.x;
          } else {
            actualValue = value;
          }

          allValues.push(actualValue);
          // Store index information for reference
          valueIndices[actualValue] = {
            datasetIndex: datasetIndex,
            valueIndex: valueIndex,
          };
        });
      }
    });

    if (allValues.length === 0) {
      return { min: 0, max: 0, average: 0, maxIndex: 0, minIndex: 0 };
    }

    // Calculate statistics
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const sum = allValues.reduce((total, val) => total + val, 0);
    const average = (sum / allValues.length).toFixed(2);

    // Get indices for min and max values
    const minIndex = valueIndices[min]?.valueIndex || 0;
    const maxIndex = valueIndices[max]?.valueIndex || 0;

    return { min, max, average, minIndex, maxIndex };
  }

  /**
   * Analyze trend in data series
   * @param {Array} data - Array of data points
   * @returns {string} Description of trend (increasing, decreasing, stable, or fluctuating)
   */
  function analyzeTrend(data) {
    // Extract numeric values for analysis, filtering out nulls
    const values = data
      .map((value) => {
        if (value === null || value === undefined) return null;

        if (typeof value === "object") {
          return value.y !== undefined ? value.y : value.x;
        }
        return value;
      })
      .filter((value) => value !== null); // Filter out null values

    if (values.length < 2) return "unknown";

    // Calculate differences between consecutive points
    const differences = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i - 1]);
    }

    // Count positive and negative changes
    const positiveChanges = differences.filter((diff) => diff > 0).length;
    const negativeChanges = differences.filter((diff) => diff < 0).length;
    const noChanges = differences.filter((diff) => diff === 0).length;

    // Calculate overall change
    const overallChange = values[values.length - 1] - values[0];

    // Determine trend type
    if (positiveChanges > 0.7 * differences.length) {
      return "consistently increasing";
    } else if (negativeChanges > 0.7 * differences.length) {
      return "consistently decreasing";
    } else if (noChanges > 0.7 * differences.length) {
      return "stable";
    } else if (overallChange > 0) {
      return "generally increasing with fluctuations";
    } else if (overallChange < 0) {
      return "generally decreasing with fluctuations";
    } else {
      return "fluctuating with no clear trend";
    }
  }

  /**
   * Get total number of data points across all datasets
   * @param {Array} datasets - Array of Chart.js datasets
   * @returns {number} Total number of data points
   */
  function getTotalPointCount(datasets) {
    return datasets.reduce((count, dataset) => count + dataset.data.length, 0);
  }

  /**
   * Calculate correlation coefficient between two arrays
   * @param {Array} xValues - Array of x values
   * @param {Array} yValues - Array of y values
   * @returns {number} Correlation coefficient (-1 to 1)
   */
  function calculateCorrelation(xValues, yValues) {
    if (xValues.length !== yValues.length || xValues.length === 0) {
      return 0;
    }

    const n = xValues.length;

    // Calculate means
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

    // Calculate variances and covariance
    let xxVar = 0;
    let yyVar = 0;
    let xyVar = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = yValues[i] - yMean;
      xxVar += xDiff * xDiff;
      yyVar += yDiff * yDiff;
      xyVar += xDiff * yDiff;
    }

    // Calculate correlation coefficient
    const correlation = xyVar / (Math.sqrt(xxVar) * Math.sqrt(yyVar));

    return isNaN(correlation) ? 0 : correlation;
  }

  /**
   * Describe correlation in words
   * @param {number} correlation - Correlation coefficient (-1 to 1)
   * @returns {string} Description of correlation
   */
  function describeCorrelation(correlation) {
    const absCorrelation = Math.abs(correlation);

    if (absCorrelation > 0.9) {
      return correlation > 0 ? "very strong positive" : "very strong negative";
    } else if (absCorrelation > 0.7) {
      return correlation > 0 ? "strong positive" : "strong negative";
    } else if (absCorrelation > 0.5) {
      return correlation > 0 ? "moderate positive" : "moderate negative";
    } else if (absCorrelation > 0.3) {
      return correlation > 0 ? "weak positive" : "weak negative";
    } else {
      return "very weak or no";
    }
  }

  /**
   * Format numeric value with appropriate precision
   * @param {number} value - The numeric value to format
   * @returns {string} Formatted value
   */
  function formatValue(value) {
    if (typeof value !== "number") return value;

    // Check if value is an integer
    if (Number.isInteger(value)) {
      return value.toString();
    }

    // For decimals, format with 1-2 decimal places depending on magnitude
    const absValue = Math.abs(value);
    if (absValue >= 100) {
      return value.toFixed(0);
    } else if (absValue >= 10) {
      return value.toFixed(1);
    } else {
      return value.toFixed(2);
    }
  }

  /**
   * Add necessary CSS styles for chart descriptions
   * Call this function once during initialization
   */
  function addDescriptionStyles() {
    // Check if styles are already added
    if (document.getElementById("chart-description-styles")) {
      return;
    }

    // Create style element
    const style = document.createElement("style");
    style.id = "chart-description-styles";

    // Updated CSS rules with figure and figcaption styles
    style.textContent = `

  `;

    // Add styles to document head
    document.head.appendChild(style);

    console.log("[Chart Accessibility] Added description styles");
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

  /**
   * Get SVG icon for CSV button
   * @returns {string} SVG icon HTML
   */
  function getCsvButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <polyline points="8 16 12 12 16 16"></polyline>
            <line x1="12" y1="12" x2="12" y2="21"></line>
        </svg>`;
  }

  /**
   * Get SVG icon for table button
   * @returns {string} SVG icon HTML
   */
  function getTableButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>`;
  }

  /**
   * Get SVG icon for description button
   * @returns {string} SVG icon HTML
   */
  function getDescriptionButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>`;
  }

  /**
   * Initialize accessibility features for all charts
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      console.warn("[Chart Accessibility] No container provided");
      return;
    }

    // Add description styles
    addDescriptionStyles();

    // Find all Chart.js containers
    const chartContainers = container.querySelectorAll(".chart-container");
    if (chartContainers.length === 0) {
      console.log("[Chart Accessibility] No chart containers found");
      return;
    }

    console.log(
      `[Chart Accessibility] Adding features to ${chartContainers.length} charts`
    );

    // Add features to each chart
    chartContainers.forEach((container, index) => {
      // Get chart ID from container or generate one
      const chartId = container.id || `chart-${index}`;

      // Initialize accessibility features for this container
      initAccessibilityFeatures(container, chartId);
    });
  }

  /**
   * Initialize accessibility features using Intersection Observer for performance
   * @param {HTMLElement} container - Container to observe (defaults to document)
   */
  function initWithLazyLoading(container = document) {
    if (!container) {
      console.warn("[Chart Accessibility] No container provided");
      return;
    }

    console.log("[Chart Accessibility] Initializing with lazy loading");

    // Find all Chart containers
    const chartContainers = container.querySelectorAll(".chart-container");
    if (chartContainers.length === 0) {
      console.log(
        "[Chart Accessibility] No chart containers found for lazy loading"
      );
      return;
    }

    console.log(
      `[Chart Accessibility] Found ${chartContainers.length} charts to observe`
    );

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const container = entry.target;
            const chartId =
              container.id ||
              `chart-${Math.random().toString(36).substring(2, 10)}`;

            // Add accessibility features if not already initialized
            if (
              container.getAttribute("data-accessibility-initialized") !==
              "true"
            ) {
              console.log(
                `[Chart Accessibility] Initializing features for visible chart ${chartId}`
              );
              initAccessibilityFeatures(container, chartId);
            }

            // Stop observing this container once initialized
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
  async function analyzeChartOptimized(chartInstance, chartData, chartType) {
    if (!config.enableAdvancedAnalysis) {
      // Fallback to synchronous basic analysis
      return analyzeChartForInsights(chartInstance, chartData, chartType);
    }

    const datasets = chartInstance.data.datasets;
    const labels = chartInstance.data.labels || [];

    // Check data size
    const dataSize = datasets.reduce(
      (sum, dataset) => sum + dataset.data.length,
      0
    );
    const complexity = window.ChartPerformance.estimateComplexity(
      datasets.length * labels.length,
      "statistics"
    );

    if (complexity.recommendedApproach === "synchronous") {
      // Small dataset, use synchronous analysis
      return analyzeChartForInsights(chartInstance, chartData, chartType);
    }

    // Use progressive analysis for large datasets
    try {
      const result = await window.ChartPerformance.progressiveAnalysis(
        datasets[0].data, // Analyze first dataset for now
        (data) => {
          // Full analysis function
          return {
            stats: window.ChartStatistics.calculateAdvancedStats(data),
            trend: window.ChartTrends.detectTrend(data),
          };
        },
        (data) => {
          // Quick analysis function
          return {
            basicStats: {
              min: Math.min(...data),
              max: Math.max(...data),
              average: data.reduce((sum, val) => sum + val, 0) / data.length,
            },
          };
        }
      );

      // Format results based on analysis type
      if (result.analysisType === "full" || result.analysisType === "sampled") {
        return {
          insights: [
            ...window.ChartStatistics.generateStatisticalInsights(result.stats),
            ...window.ChartTrends.generateTrendInsights(result.trend),
          ],
          primaryTakeaway: `Advanced analysis (${result.analysisType}) performed on the dataset.`,
          advancedAnalysis: true,
          statistics: result.stats,
        };
      } else {
        // Fallback to quick analysis
        return {
          insights: [
            `Data ranges from ${formatValue(
              result.basicStats.min
            )} to ${formatValue(result.basicStats.max)}.`,
            `Average value: ${formatValue(result.basicStats.average)}.`,
          ],
          primaryTakeaway: `Basic analysis performed due to dataset size.`,
          advancedAnalysis: false,
        };
      }
    } catch (error) {
      console.error(
        "[Chart Accessibility] Error in optimized analysis:",
        error
      );
      // Fallback to basic analysis
      return analyzeChartForInsights(chartInstance, chartData, chartType);
    }
  }
  // Public API
  return {
    init: init,
    initWithLazyLoading: initWithLazyLoading,
    initAccessibilityFeatures: initAccessibilityFeatures,
    announceToScreenReader: announceToScreenReader,
    generateShortDescription: generateShortDescription,
    generateDetailedDescription: generateDetailedDescription,
    createDescriptionContainer: createDescriptionContainer,
    createExportControls: createExportControls,
    handleCopyHtml: handleCopyHtml,
    handleCopyText: handleCopyText,
    handleCopyFormatted: handleCopyFormatted,
    handleDownloadHtml: handleDownloadHtml,
    handleDownloadText: handleDownloadText,
    handleDownloadMarkdown: handleDownloadMarkdown,
    analyzeChartOptimized,
    config, // Expose config for external modification
  };
})();

// Explicitly assign to window object for global access
window.ChartAccessibility = ChartAccessibility;

// Initialize when DOM is fully loaded
document.addEventListener("DOMContentLoaded", function () {
  console.log(
    "[Chart Accessibility] DOM content loaded, initializing accessibility features"
  );

  // Initialize for existing charts
  if (typeof window.ChartAccessibility !== "undefined") {
    console.log(
      "[Chart Accessibility] Found ChartAccessibility module, initializing"
    );

    // Use lazy loading initialization for better performance
    window.ChartAccessibility.initWithLazyLoading();

    // Also observe changes to handle dynamically added charts
    console.log(
      "[Chart Accessibility] Setting up mutation observer for dynamic charts"
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
                node.getAttribute("data-accessibility-initialized") !== "true"
              ) {
                console.log(
                  "[Chart Accessibility] Found new chart container node"
                );
                newChartsFound = true;
              } else {
                // Check for chart containers inside this node
                const containersWithoutFeatures = Array.from(
                  node.querySelectorAll
                    ? node.querySelectorAll(
                        ".chart-container:not([data-accessibility-initialized='true'])"
                      )
                    : []
                );
                if (containersWithoutFeatures.length > 0) {
                  console.log(
                    `[Chart Accessibility] Found ${containersWithoutFeatures.length} new chart containers inside node`
                  );
                  newChartsFound = true;
                }
              }
            }
          });
        }
      });

      // Only initialize if new charts without features were found
      if (newChartsFound) {
        console.log(
          "[Chart Accessibility] New charts detected, initializing accessibility features"
        );
        window.ChartAccessibility.initWithLazyLoading(document);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  } else {
    console.warn(
      "[Chart Accessibility] ChartAccessibility not found. Make sure chart-accessibility.js is loaded."
    );
  }
});
