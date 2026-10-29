/**
 * Chart Export Utilities
 *
 * Turns the Markdown Editor's Chart.js charts into something that survives the
 * static HTML and SCORM export: a picture (one for each site mode, so the
 * exported page's own light/dark switch can show the matching one), the chart's
 * description inside a "Description" disclosure, and the chart's data table,
 * built at export time, inside that disclosure.
 *
 * Everything here acts on the export copy. The live page is only ever READ,
 * with one exception: ensureDescriptions() runs the same public initialisers
 * that scrolling a diagram near the screen would have run (a diagram that was
 * never scrolled near has no description to export). It skips anything already
 * initialised.
 *
 * The three steps are kept apart so the caller takes ONE copy of the live
 * document (Mermaid's prepareStaticExport does that), not two:
 *   1. ensureDescriptions(root)        - live page, before the copy
 *   2. captureCharts(root)             - live page, read-only: PNGs and tables
 *   3. applyChartExport(html, captures) - the copy, as an HTML string
 * prepareChartExport() runs all three around a caller-supplied copy step.
 */
window.ChartExportUtils = (function () {
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

  /** The two site modes, as the static export tags its copies with them. */
  const SITE_MODES = Object.freeze({ LIGHT: "light", DARK: "dark" });

  /**
   * The attribute naming the site mode an image was painted for. Same name the
   * Mermaid export uses, so one convention covers both.
   */
  const EXPORT_MODE_ATTRIBUTE = "data-export-mode";

  /**
   * The ground behind a chart when nothing on the page paints one. Taken from
   * the Mermaid export's SITE_MODE_GROUNDS (the ground each site mode paints).
   */
  const FALLBACK_GROUNDS = Object.freeze({
    light: "rgb(249, 255, 244)",
    dark: "rgb(46, 40, 42)",
  });

  /**
   * Selectors, classes and wording the chart export works with. The disclosure
   * classes are the SCORM builder's own long-description convention
   * (scorm-builder/enhancers/long-descriptions.js), the same ones Mermaid uses.
   */
  const CHART_EXPORT = Object.freeze({
    figureSelector: "figure.chart-figure",
    containerSelector: ".chart-container",
    deadControlsSelector: ".chart-view-controls, .chart-controls",
    descriptionToolbarSelector: ".chart-export-controls",
    liveTableSelector: ".chart-data-table-container",
    descriptionIdPrefix: "chart-description-",
    disclosureIdPrefix: "chart-details-",
    disclosureClass: "long-description-details",
    disclosureBodyClass: "image-long-description",
    disclosureSummary: "Description",
    imageClass: "chart-export-image",
    tableSectionClass: "chart-data-table-section",
    tableHeading: "Data table",
    tableCaptionPrefix: "Data table for: ",
    mermaidContainerSelector: ".mermaid-container",
    // Off-screen render of the other site mode (never inside the document flow)
    hostOffsetPx: -20000,
    canvasWidthAttr: 600,
    canvasHeightAttr: 400,
  });

  /** Chart types whose data is points, not one value per category. */
  const POINT_CHART_TYPES = Object.freeze(["scatter", "bubble"]);

  /**
   * Head CSS for the chart pictures: show the image whose mode matches the
   * exported page's own light/dark switch (`data-theme` on <html>). With no
   * `data-theme`, the light image shows. Images with no mode tag (the
   * single-image fallback) are never hidden. Same rule shape as Mermaid's
   * THEMED_EXPORT_HEAD, which it is joined to by getExportHead().
   */
  const CHART_EXPORT_HEAD = `<style>
img.${CHART_EXPORT.imageClass} {
  display: block;
  max-width: 100%;
  height: auto;
}
html[data-theme="dark"] img.${CHART_EXPORT.imageClass}[${EXPORT_MODE_ATTRIBUTE}="${SITE_MODES.LIGHT}"],
html:not([data-theme="dark"]) img.${CHART_EXPORT.imageClass}[${EXPORT_MODE_ATTRIBUTE}="${SITE_MODES.DARK}"] {
  display: none !important;
}
</style>`;

  /**
   * The head CSS for an export: Mermaid's, then the chart pictures'. Either
   * module may be absent; absent ones are skipped.
   * @returns {string|undefined} The combined CSS, or undefined if neither exists
   */
  function getExportHead() {
    const mermaid =
      window.MermaidExportUtils && window.MermaidExportUtils.THEMED_EXPORT_HEAD;
    const parts = [mermaid, CHART_EXPORT_HEAD].filter(Boolean);
    return parts.length ? parts.join("\n") : undefined;
  }

  // ---------------------------------------------------------------------------
  // 1. Descriptions exist before the copy is taken
  // ---------------------------------------------------------------------------

  /**
   * Build the description of every diagram and chart in `root` that has not
   * been given one yet, through each module's own public initialiser. Both
   * initialisers return at once for a container already initialised, so this
   * never builds a second description. What it does on the live page is what
   * scrolling the diagram within 100px of the screen would have done.
   * Never throws.
   *
   * @param {HTMLElement} root - The live, rendered document (e.g. `#output`)
   * @returns {Promise<{charts: number, diagrams: number}>} Counts initialised
   */
  async function ensureDescriptions(root) {
    const counts = { charts: 0, diagrams: 0 };
    if (!root) return counts;

    const chartAccess = window.ChartAccessibility;
    if (chartAccess && typeof chartAccess.initAccessibilityFeatures === "function") {
      const pending = root.querySelectorAll(
        `${CHART_EXPORT.containerSelector}:not([data-accessibility-initialized="true"])`
      );
      pending.forEach((container, index) => {
        try {
          const id = container.id || `chart-export-${index}`;
          const controls = window.ChartControls;
          if (
            !container.querySelector(".chart-controls") &&
            controls &&
            typeof controls.addControlsToContainer === "function"
          ) {
            controls.addControlsToContainer(container, id);
          }
          chartAccess.initAccessibilityFeatures(container, id);
          counts.charts++;
        } catch (error) {
          logError("[Chart Export] Could not build a chart description", error);
        }
      });
    }

    const mermaidAccess = window.MermaidAccessibility;
    if (
      mermaidAccess &&
      typeof mermaidAccess.initAccessibilityFeatures === "function"
    ) {
      const pending = Array.from(
        root.querySelectorAll(
          `${CHART_EXPORT.mermaidContainerSelector}:not([data-accessibility-initialized="true"])`
        )
      );
      for (let index = 0; index < pending.length; index++) {
        const container = pending[index];
        try {
          await mermaidAccess.initAccessibilityFeatures(
            container,
            container.id || `mermaid-export-${index}`
          );
          counts.diagrams++;
        } catch (error) {
          logError("[Chart Export] Could not build a diagram description", error);
        }
      }
    }

    logInfo(
      `[Chart Export] Descriptions built before export: ${counts.charts} charts, ${counts.diagrams} diagrams`
    );
    return counts;
  }

  // ---------------------------------------------------------------------------
  // 2. Pictures and tables, read from the live charts
  // ---------------------------------------------------------------------------

  function isTransparent(colour) {
    return (
      !colour ||
      colour === "transparent" ||
      /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(colour)
    );
  }

  /**
   * The ground the page paints behind a chart: the canvas's own background,
   * else the nearest opaque ancestor's, else the site mode's ground.
   */
  function resolveLiveGround(canvas, mode) {
    for (let node = canvas; node && node.nodeType === 1; node = node.parentElement) {
      const colour = getComputedStyle(node).backgroundColor;
      if (!isTransparent(colour)) return colour;
    }
    return FALLBACK_GROUNDS[mode];
  }

  /** A PNG of a chart canvas painted over a ground (Chart.js draws none). */
  function paintOverGround(sourceCanvas, ground) {
    const flat = document.createElement("canvas");
    flat.width = sourceCanvas.width;
    flat.height = sourceCanvas.height;
    const context = flat.getContext("2d");
    context.fillStyle = ground;
    context.fillRect(0, 0, flat.width, flat.height);
    context.drawImage(sourceCanvas, 0, 0);
    return flat.toDataURL("image/png");
  }

  function currentSiteMode() {
    const controls = window.ChartControls;
    const dark =
      controls && controls.utils && typeof controls.utils.isDarkThemeActive === "function"
        ? controls.utils.isDarkThemeActive()
        : false;
    return dark ? SITE_MODES.DARK : SITE_MODES.LIGHT;
  }

  /**
   * Draw the chart again, off the page, painted for the OTHER site mode: the
   * chart's own source, that mode's default palette and ground. The live chart
   * is never repainted. The throwaway chart and its host are removed in
   * `finally`. Never throws.
   *
   * @param {HTMLElement} container - The live `.chart-container`
   * @param {HTMLCanvasElement} liveCanvas - Its canvas (for the size)
   * @param {string} mode - The mode to paint for (SITE_MODES)
   * @returns {string|null} A PNG data URL, or null (after logging)
   */
  function renderOtherMode(container, liveCanvas, mode) {
    const controls = window.ChartControls;
    let host = null;
    let chart = null;
    try {
      const encoded = container.getAttribute("data-chart-code");
      const paletteName =
        controls && controls.config && controls.config.defaultPalettes
          ? controls.config.defaultPalettes[mode]
          : null;
      if (
        !encoded ||
        !window.Chart ||
        !controls ||
        typeof controls.applyPalette !== "function" ||
        !paletteName
      ) {
        logWarn("[Chart Export] No chart source or palette - one picture only");
        return null;
      }

      const source = JSON.parse(decodeURIComponent(encoded));
      source.options = source.options || {};
      source.options.animation = false;

      // A plain div on purpose: no `chart-container` class, so nothing that
      // watches for chart containers can pick the throwaway up.
      host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.position = "absolute";
      host.style.left = `${CHART_EXPORT.hostOffsetPx}px`;
      host.style.top = "0";
      host.style.width = `${liveCanvas.clientWidth}px`;
      host.style.height = `${liveCanvas.clientHeight}px`;
      const canvas = document.createElement("canvas");
      canvas.width = CHART_EXPORT.canvasWidthAttr;
      canvas.height = CHART_EXPORT.canvasHeightAttr;
      host.appendChild(canvas);
      document.body.appendChild(host);

      chart = new window.Chart(canvas, source);
      controls.applyPalette(host, canvas, paletteName, { announce: false });
      chart.update("none");

      const palette = controls.palettes && controls.palettes[paletteName];
      const ground =
        (palette && palette.chartStyle && palette.chartStyle.backgroundColor) ||
        FALLBACK_GROUNDS[mode];
      return paintOverGround(canvas, ground);
    } catch (error) {
      logError("[Chart Export] Second picture failed - one picture only", error);
      return null;
    } finally {
      if (chart) chart.destroy();
      if (host) host.remove();
    }
  }

  function pointValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      return value.y !== undefined ? value.y : value.r !== undefined ? value.r : "";
    }
    return value;
  }

  function chartTitle(chart) {
    const plugins = (chart.options && chart.options.plugins) || {};
    const title = plugins.title && plugins.title.text;
    const text = Array.isArray(title) ? title.join(" ") : title;
    return text || "chart";
  }

  /**
   * The chart's data as headers and rows, from the live Chart.js instance.
   * One row per category for category charts (first column is the row header);
   * one row per point for scatter and bubble charts.
   */
  function extractTable(chart) {
    const type = chart.config.type;
    const datasets = chart.data.datasets || [];
    if (POINT_CHART_TYPES.includes(type)) {
      const headers = ["Series", "X", "Y"];
      if (type === "bubble") headers.push("Radius");
      const rows = [];
      datasets.forEach((dataset, index) => {
        (dataset.data || []).forEach((point) => {
          const row = [dataset.label || `Series ${index + 1}`, point.x, point.y];
          if (type === "bubble") row.push(point.r);
          rows.push(row);
        });
      });
      return { headers, rows, rowHeaders: false };
    }

    const labels = chart.data.labels || [];
    const headers = [
      "Category",
      ...datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`),
    ];
    const rows = labels.map((label, index) => [
      label,
      ...datasets.map((dataset) => pointValue((dataset.data || [])[index])),
    ]);
    return { headers, rows, rowHeaders: true };
  }

  /**
   * Build the chart's data table at export time, whatever state the author left
   * the page's own table toggle in. Has a visible caption, column headers with
   * scope, and no ids, so it cannot collide with anything on the page.
   *
   * @param {Object} chart - The live Chart.js instance
   * @returns {string|null} The table's HTML, or null
   */
  function buildDataTableHtml(chart) {
    const { headers, rows, rowHeaders } = extractTable(chart);
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = `${CHART_EXPORT.tableCaptionPrefix}${chartTitle(chart)}`;
    table.appendChild(caption);

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.setAttribute("scope", "col");
      th.textContent = header;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell, index) => {
        const isRowHeader = rowHeaders && index === 0;
        const element = document.createElement(isRowHeader ? "th" : "td");
        if (isRowHeader) element.setAttribute("scope", "row");
        element.textContent = cell === undefined || cell === null ? "" : String(cell);
        tr.appendChild(element);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table.outerHTML;
  }

  /**
   * Read every chart in `root` into the pieces the export needs. Read-only on
   * the live page. One entry per `figure.chart-figure`, in document order;
   * an entry is null where a chart could not be read (that chart is left as it
   * is in the export).
   *
   * @param {HTMLElement} root - The live, rendered document (e.g. `#output`)
   * @returns {Array<Object|null>} One capture per chart figure
   */
  function captureCharts(root) {
    if (!root || !window.Chart) return [];
    const primaryMode = currentSiteMode();
    const secondMode =
      primaryMode === SITE_MODES.DARK ? SITE_MODES.LIGHT : SITE_MODES.DARK;

    return Array.from(root.querySelectorAll(CHART_EXPORT.figureSelector)).map(
      (figure) => {
        try {
          const container = figure.querySelector(CHART_EXPORT.containerSelector);
          const canvas = container && container.querySelector("canvas");
          const chart = canvas && window.Chart.getChart(canvas);
          if (!chart) return null;

          const primary = paintOverGround(
            chart.canvas,
            resolveLiveGround(canvas, primaryMode)
          );
          const second = renderOtherMode(container, canvas, secondMode);
          const images = [{ mode: primaryMode, src: primary }];
          if (second) images.push({ mode: secondMode, src: second });

          return {
            containerId: container.id,
            alt: canvas.getAttribute("aria-label") || "",
            width: Math.round(chart.width),
            height: Math.round(chart.height),
            images,
            tableHtml: buildDataTableHtml(chart),
          };
        } catch (error) {
          logError("[Chart Export] Could not read a chart", error);
          return null;
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // 3. The copy
  // ---------------------------------------------------------------------------

  function makeImage(capture, image, detailsId, tagged) {
    const img = document.createElement("img");
    img.className = CHART_EXPORT.imageClass;
    img.src = image.src;
    img.alt = capture.alt;
    img.width = capture.width;
    img.height = capture.height;
    if (detailsId) img.setAttribute("aria-details", detailsId);
    if (tagged) img.setAttribute(EXPORT_MODE_ATTRIBUTE, image.mode);
    return img;
  }

  function transformFigure(figure, capture) {
    const container = figure.querySelector(CHART_EXPORT.containerSelector);
    const canvas = container && container.querySelector("canvas");
    if (!container || !canvas) return false;

    // The page's own controls, caption and table do nothing in the export.
    figure
      .querySelectorAll(CHART_EXPORT.deadControlsSelector)
      .forEach((node) => node.remove());
    figure
      .querySelectorAll(CHART_EXPORT.liveTableSelector)
      .forEach((node) => node.remove());
    figure.querySelectorAll("figcaption").forEach((node) => node.remove());

    // The description panel is the figure's next sibling; find it by id.
    const panelId = `${CHART_EXPORT.descriptionIdPrefix}${capture.containerId}`;
    const panel = figure.parentNode.querySelector(
      `[id="${panelId.replace(/"/g, '\\"')}"]`
    );
    const detailsId = panel
      ? `${CHART_EXPORT.disclosureIdPrefix}${capture.containerId}`
      : null;

    const tagged = capture.images.length > 1;
    capture.images.forEach((image) => {
      canvas.before(makeImage(capture, image, detailsId, tagged));
    });
    canvas.remove();

    // The container was a positioned, padded, coloured box for the toolbar.
    ["style", "role", "aria-label", "data-chart-code"].forEach((name) =>
      container.removeAttribute(name)
    );
    Array.from(container.attributes)
      .filter((attribute) => /^data-(has-|accessibility-|last-|figcaption-)/.test(attribute.name))
      .forEach((attribute) => container.removeAttribute(attribute.name));
    container.classList.remove("view-controls-added");

    if (!panel) return true;

    panel
      .querySelectorAll(CHART_EXPORT.descriptionToolbarSelector)
      .forEach((node) => node.remove());
    panel.style.removeProperty("display");
    if (!panel.getAttribute("style")) panel.removeAttribute("style");
    panel.removeAttribute("aria-live");
    panel.classList.add(CHART_EXPORT.disclosureBodyClass);

    if (capture.tableHtml) {
      const section = document.createElement("section");
      section.className = CHART_EXPORT.tableSectionClass;
      const heading = document.createElement("h3");
      heading.textContent = CHART_EXPORT.tableHeading;
      section.appendChild(heading);
      section.insertAdjacentHTML("beforeend", capture.tableHtml);
      panel.appendChild(section);
    }

    const details = document.createElement("details");
    details.className = CHART_EXPORT.disclosureClass;
    details.id = detailsId;
    const summary = document.createElement("summary");
    summary.textContent = CHART_EXPORT.disclosureSummary;
    panel.parentNode.insertBefore(details, panel);
    details.appendChild(summary);
    details.appendChild(panel);
    return true;
  }

  /**
   * Turn each chart in an export copy into pictures plus a "Description"
   * disclosure holding the description and the data table. Re-parses the copy
   * into an inert <template>, so nothing in it loads or runs. Charts are paired
   * with the captures by index; a count mismatch leaves every chart as it was.
   *
   * @param {string} html - The export copy's inner HTML
   * @param {Array<Object|null>} captures - From captureCharts()
   * @returns {string} The copy's inner HTML with the charts transformed
   */
  function applyChartExport(html, captures) {
    if (!html || !captures || !captures.length) return html;
    const template = document.createElement("template");
    template.innerHTML = html;
    const figures = template.content.querySelectorAll(CHART_EXPORT.figureSelector);
    if (figures.length !== captures.length) {
      logWarn(
        `[Chart Export] ${captures.length} live charts against ${figures.length} in the copy - charts left as they were`
      );
      return html;
    }

    let done = 0;
    figures.forEach((figure, index) => {
      const capture = captures[index];
      if (capture && transformFigure(figure, capture)) done++;
    });
    logInfo(`[Chart Export] ${done} of ${figures.length} charts exported as pictures`);
    return template.innerHTML;
  }

  /**
   * The whole chart step around a caller-supplied copy step, in order:
   * descriptions built, charts read, the copy taken, the charts transformed.
   *
   * @param {HTMLElement} root - The live, rendered document (e.g. `#output`)
   * @param {(root: HTMLElement) => (string|Promise<string>)} prepareHtml - Takes
   *   the one copy of `root` and returns its HTML
   * @returns {Promise<string>} The export HTML
   */
  async function prepareChartExport(root, prepareHtml) {
    if (!root) return "";
    await ensureDescriptions(root);
    const captures = captureCharts(root);
    const html = await prepareHtml(root);
    return applyChartExport(html, captures);
  }

  return {
    ensureDescriptions,
    captureCharts,
    applyChartExport,
    prepareChartExport,
    getExportHead,
    CHART_EXPORT_HEAD,
    CHART_EXPORT,
    SITE_MODES,
  };
})();
