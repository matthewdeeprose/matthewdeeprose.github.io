/**
 * Markdown Render Core
 *
 * One shared markdown-to-HTML pipeline for the Markdown Editor and the
 * standalone page loader. The logic is moved over from markdown-editor.js,
 * which is the reference; differences between consumers are the named options
 * below, never forks.
 *
 * Public API (window.MarkdownRenderCore):
 *   createMarkdownIt(options)   configured markdown-it instance
 *   render(markdownText, options)   protect maths, render, restore -> HTML
 *   postProcess(container, options) what runs after the HTML is in the page
 *   version
 *
 * Named options (defaults are the editor's values):
 *   anchorStyle     "inside" | "after" | "none" (none: no header anchors and no
 *                   heading ids). Default "inside".
 *   MRC-36 options (all defaults equal the behaviour before they existed; an
 *   invalid value falls back to the default, never throws):
 *   html            boolean, default true. markdown-it html. true writes raw
 *                   HTML into the output; sanitising stays the caller's job.
 *   breaks          boolean, default true. Single newline becomes <br>.
 *   linkify         boolean, default true. Bare URLs become links.
 *   typographer     boolean, default true. Smart quotes, dashes, (c).
 *   highlight       boolean, default true. Prism code blocks (false: plain
 *                   markdown-it code blocks, and postProcess skips Prism).
 *   supSub          boolean, default true. ^sup^ and ~sub~ plugins (maths stays
 *                   protected either way).
 *   taskListStyle   "semantic" | "plain", default "semantic" (the editor's
 *                   markup). "plain" uses window.markdownitTaskLists, the markup
 *                   the Chat renderers emit; without that plugin task items
 *                   stay as text.
 *   tables          "sortable" | "plain", default "sortable". plain skips the
 *                   sortable-tables plugin and its postProcess step.
 *   diagrams        boolean, default true. false leaves chart and mermaid
 *                   fences as code blocks (nothing is drawn or run).
 *   images          "core" | "plain", default "core" (figure, lazy loading).
 *                   plain is markdown-it's own <img>.
 *   plugins         boolean, default true. The group footnote, deflist, abbr,
 *                   emoji, ins, mark, container, attrs, multimd-table, tab, toc.
 *   attrs           boolean, default true (MRC-74). false skips the markdown-it-attrs
 *                   plugin only; the rest of the group stays. The plugin deletes a
 *                   trailing {...} from prose (JSON, {name}, bare \frac{a}{b}), so AI
 *                   output (Chat) turns it off; authored pages and the editor keep
 *                   {.class}. Owner ruling, 12 November 2026.
 *   mermaidDefaults { width, height, lockAspectRatio }
 *   figureRole      boolean
 *   tocSlugMatchesAnchor  boolean, default false. When true the [toc] list
 *                   uses the heading-id slug, so its links reach the headings
 *                   (MRC-8). The editor keeps false until it migrates.
 *   tocListType     "ul" | "ol", default "ul" (MRC-47). The list tag the [toc]
 *                   contents list is drawn with. "ol" gives a numbered list, which
 *                   a screen reader speaks as "1.", "2." (position); "ul" speaks
 *                   bullet glyphs. Any other value falls back to "ul".
 *   containerInit   names of window helpers whose init(container) runs in
 *                   postProcess, e.g. ["ChartViewControls",
 *                   "MermaidViewControls", "MermaidControls",
 *                   "MermaidAccessibility"]. Default [] (the editor calls none).
 *   longInlineMathScrolls  boolean, default false (MRC-20). When true, after
 *                   maths is typeset, an inline equation whose drawn maths is
 *                   wider than its paragraph, list item or table cell scrolls
 *                   inside itself (class mdrc-long-inline-math, one <style>
 *                   added to document.head). Equations that fit, and display
 *                   maths, are never marked. Marks are re-checked on window
 *                   resize (debounced). The editor keeps false.
 *   report          { debug, warn, error } replaces the editor's Logger and
 *                   NotificationHandler; the core has no UI dependency.
 *
 * Not loaded by any page yet (MRC-2). Plugins are read from window.* at call
 * time, and every optional helper is called only if it exists.
 *
 * @author Matthew Deeprose
 * @version 1.3.0
 */

(function () {
  "use strict";

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
      console.error("[MarkdownRenderCore]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MarkdownRenderCore]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MarkdownRenderCore]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MarkdownRenderCore]", message, ...args);
  }

  const VERSION = "1.3.0";

  const ANCHOR_STYLES = Object.freeze({
    INSIDE: "inside",
    AFTER: "after",
    NONE: "none",
  });

  // MRC-36 named options: the first value of each is the default (today's behaviour).
  const TASK_LIST_STYLES = Object.freeze({
    SEMANTIC: "semantic",
    PLAIN: "plain",
  });
  const TABLE_STYLES = Object.freeze({ SORTABLE: "sortable", PLAIN: "plain" });
  const IMAGE_STYLES = Object.freeze({ CORE: "core", PLAIN: "plain" });
  // MRC-47: the [toc] list tag; the first value is the default.
  const TOC_LIST_TYPES = Object.freeze({ UL: "ul", OL: "ol" });

  // MRC-60: the words that open a broken chart block's error, before the parser message.
  const CHART_ERROR_LEAD = "Chart could not be drawn:";

  // Plugins switched together by the `plugins` option (sub, sup, anchor and the
  // task-list markup have their own options).
  const PLUGIN_GROUP_NAMES = Object.freeze([
    "footnote",
    "deflist",
    "abbr",
    "emoji",
    "ins",
    "mark",
    "container",
    "attrs",
    "multimd-table",
    "tab",
    "toc",
  ]);
  const SUP_SUB_NAMES = Object.freeze(["sub", "sup"]);

  // Editor values; the loader passes its own through the options.
  const EDITOR_MERMAID_DEFAULTS = Object.freeze({
    width: 70,
    height: 100,
    lockAspectRatio: false,
  });

  const DEFAULT_REPORT = Object.freeze({
    debug: logDebug,
    warn: logWarn,
    error: logError,
  });

  const ANCHOR_SYMBOL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';

  // Fences drawn from their source text. The HTML-level maths restore never
  // reaches inside them, so typed maths is put back before drawing (RA-87).
  const MATHS_RESTORE_FENCES = Object.freeze(["chart", "mermaid"]);

  // \(...\) inline and \[...\] display maths; may span lines.
  const BRACKET_MATH_PATTERN = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g;

  // Same numeric slice the editor uses for random ids.
  const ID_SLICE_START = 2;
  const CHART_ID_SLICE_END = 15;

  /**
   * Merge caller options over the editor defaults.
   * @param {Object} [options]
   * @returns {Object} resolved options
   */
  function resolveOptions(options) {
    const given = options || {};
    // A boolean option that defaults to true: only an explicit false turns it off.
    const onUnlessFalse = (value) => value !== false;

    return {
      anchorStyle:
        given.anchorStyle === ANCHOR_STYLES.AFTER ||
        given.anchorStyle === ANCHOR_STYLES.NONE
          ? given.anchorStyle
          : ANCHOR_STYLES.INSIDE,
      html: onUnlessFalse(given.html),
      breaks: onUnlessFalse(given.breaks),
      linkify: onUnlessFalse(given.linkify),
      typographer: onUnlessFalse(given.typographer),
      highlight: onUnlessFalse(given.highlight),
      supSub: onUnlessFalse(given.supSub),
      plugins: onUnlessFalse(given.plugins),
      attrs: onUnlessFalse(given.attrs),
      diagrams: onUnlessFalse(given.diagrams),
      taskListStyle:
        given.taskListStyle === TASK_LIST_STYLES.PLAIN
          ? TASK_LIST_STYLES.PLAIN
          : TASK_LIST_STYLES.SEMANTIC,
      tables:
        given.tables === TABLE_STYLES.PLAIN
          ? TABLE_STYLES.PLAIN
          : TABLE_STYLES.SORTABLE,
      images:
        given.images === IMAGE_STYLES.PLAIN
          ? IMAGE_STYLES.PLAIN
          : IMAGE_STYLES.CORE,
      mermaidDefaults: Object.assign(
        {},
        EDITOR_MERMAID_DEFAULTS,
        given.mermaidDefaults || {}
      ),
      figureRole: given.figureRole === true,
      tocSlugMatchesAnchor: given.tocSlugMatchesAnchor === true,
      tocListType:
        given.tocListType === TOC_LIST_TYPES.OL
          ? TOC_LIST_TYPES.OL
          : TOC_LIST_TYPES.UL,
      longInlineMathScrolls: given.longInlineMathScrolls === true,
      containerInit: Array.isArray(given.containerInit)
        ? given.containerInit
        : [],
      report: Object.assign({}, DEFAULT_REPORT, given.report || {}),
    };
  }

  // Heading id slug used by the anchor plugin (and, when tocSlugMatchesAnchor is on, the contents list).
  function headingSlugify(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------------------------------------------------------------- tasks

  /**
   * Setup accessible semantic task lists
   * Processes task list markdown and renders as semantic HTML with status indicators
   */
  function setupCustomTaskLists(md, report) {
    md.core.ruler.after("inline", "custom_task_lists", function (state) {
      const tokens = state.tokens;
      let processedCount = 0;

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== "bullet_list_open") continue;

        let hasDirectTaskItems = false;
        let j = i + 1;
        let nestingLevel = 0;

        // Only scan DIRECT children of this list, not nested lists
        while (j < tokens.length && tokens[j].type !== "bullet_list_close") {
          if (tokens[j].type === "bullet_list_open") {
            nestingLevel++;
          } else if (tokens[j].type === "bullet_list_close") {
            nestingLevel--;
          } else if (
            tokens[j].type === "list_item_open" &&
            nestingLevel === 0
          ) {
            let k = j + 1;
            let itemNestingLevel = 0;

            while (k < tokens.length && tokens[k].type !== "list_item_close") {
              if (
                tokens[k].type === "bullet_list_open" ||
                tokens[k].type === "ordered_list_open"
              ) {
                itemNestingLevel++;
              } else if (
                tokens[k].type === "bullet_list_close" ||
                tokens[k].type === "ordered_list_close"
              ) {
                itemNestingLevel--;
              } else if (
                tokens[k].type === "paragraph_open" &&
                itemNestingLevel === 0
              ) {
                const inlineToken = tokens[k + 1];
                if (inlineToken && inlineToken.type === "inline") {
                  const content = inlineToken.content.trim();
                  const taskMatch = content.match(/^\[([x\s])\]\s*(.*)/i);
                  if (taskMatch) {
                    hasDirectTaskItems = true;
                    const isChecked = taskMatch[1].toLowerCase() === "x";
                    const taskText = taskMatch[2].trim();

                    if (!tokens[j].attrs) tokens[j].attrs = [];
                    tokens[j].attrs.push(["class", "task-list-item"]);
                    tokens[j].attrs.push([
                      "data-checked",
                      isChecked ? "true" : "false",
                    ]);
                    tokens[j].attrs.push(["data-task-text", taskText]);

                    inlineToken.content = taskText;

                    if (inlineToken.children && inlineToken.children.length > 0) {
                      for (let c = 0; c < inlineToken.children.length; c++) {
                        if (inlineToken.children[c].type === "text") {
                          const childMatch =
                            inlineToken.children[c].content.match(
                              /^\[([x\s])\]\s*(.*)/i
                            );
                          if (childMatch) {
                            inlineToken.children[c].content =
                              childMatch[2].trim();
                          }
                          break;
                        }
                      }
                    }

                    processedCount++;
                  }
                }
              }
              k++;
            }
          }
          j++;
        }

        // Only mark as task list if ALL direct children are task items
        if (!hasDirectTaskItems) continue;

        let directItems = 0;
        let directTaskItems = 0;
        let j2 = i + 1;
        let nestingLevel2 = 0;

        while (j2 < tokens.length && tokens[j2].type !== "bullet_list_close") {
          if (tokens[j2].type === "bullet_list_open") {
            nestingLevel2++;
          } else if (tokens[j2].type === "bullet_list_close") {
            nestingLevel2--;
          } else if (
            tokens[j2].type === "list_item_open" &&
            nestingLevel2 === 0
          ) {
            directItems++;
            if (
              tokens[j2].attrGet &&
              tokens[j2].attrGet("class") === "task-list-item"
            ) {
              directTaskItems++;
            }
          }
          j2++;
        }

        if (directItems > 0 && directTaskItems === directItems) {
          if (!tokens[i].attrs) tokens[i].attrs = [];
          tokens[i].attrs.push(["class", "contains-task-list"]);
        }
      }

      if (processedCount > 0) {
        report.debug(`[Task Lists] Processed ${processedCount} tasks`);
      }
      return true;
    });

    const originalBulletListOpen =
      md.renderer.rules.bullet_list_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.bullet_list_open = function (
      tokens,
      idx,
      options,
      env,
      self
    ) {
      const token = tokens[idx];
      const isTaskList = token.attrGet("class") === "contains-task-list";

      if (isTaskList) {
        let totalTasks = 0;
        let completedTasks = 0;

        for (
          let i = idx + 1;
          i < tokens.length && tokens[i].type !== "bullet_list_close";
          i++
        ) {
          if (
            tokens[i].type === "list_item_open" &&
            tokens[i].attrGet("class") === "task-list-item"
          ) {
            totalTasks++;
            if (tokens[i].attrGet("data-checked") === "true") {
              completedTasks++;
            }
          }
        }

        const progressText = `Task list: ${completedTasks} of ${totalTasks} completed`;

        return `<ul class="contains-task-list task-status-list semantic-tasks"
                  role="list"
                  aria-label="${progressText}"
                  data-tasks-total="${totalTasks}"
                  data-tasks-completed="${completedTasks}">`;
      }

      return originalBulletListOpen(tokens, idx, options, env, self);
    };

    const originalListItemOpen =
      md.renderer.rules.list_item_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.list_item_open = function (
      tokens,
      idx,
      options,
      env,
      self
    ) {
      const token = tokens[idx];
      const isTaskListItem = token.attrGet("class") === "task-list-item";

      if (isTaskListItem) {
        const isChecked = token.attrGet("data-checked") === "true";
        const taskText = token.attrGet("data-task-text") || "";

        const statusText = isChecked ? "Completed" : "Not completed";
        const statusIcon = isChecked ? "✅" : "⭕";
        const completedClass = isChecked ? " task-completed" : "";

        const ariaLabel = taskText.trim()
          ? `${statusText}: ${taskText}`
          : `${statusText} task with no content`;

        const emptyClass = taskText.trim() ? "" : " task-empty";

        return `<li class="task-list-item semantic-task${completedClass}${emptyClass}" role="listitem">
          <span class="task-status"
                role="img"
                aria-label="${ariaLabel}"
                title="${statusText}">
            <span class="status-icon" aria-hidden="true">${statusIcon}</span>
            <span class="status-text sr-only">${statusText}:</span>
          </span>
          <span class="task-content">`;
      }

      return originalListItemOpen(tokens, idx, options, env, self);
    };

    const originalListItemClose =
      md.renderer.rules.list_item_close ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.list_item_close = function (
      tokens,
      idx,
      options,
      env,
      self
    ) {
      const openToken = findMatchingOpenToken(tokens, idx);
      const isTaskListItem =
        openToken && openToken.attrGet("class") === "task-list-item";

      if (isTaskListItem) {
        return "</span></li>";
      }

      return originalListItemClose(tokens, idx, options, env, self);
    };

    function findMatchingOpenToken(tokens, closeIdx) {
      let level = 0;
      for (let i = closeIdx - 1; i >= 0; i--) {
        if (tokens[i].type === "list_item_close") {
          level++;
        } else if (tokens[i].type === "list_item_open") {
          if (level === 0) {
            return tokens[i];
          }
          level--;
        }
      }
      return null;
    }
  }

  // ---------------------------------------------------------------- images

  // Custom image renderer for enhanced figure output with accessibility
  function setupImageRenderer(md, report) {
    md.renderer.rules.image = function (tokens, idx) {
      const token = tokens[idx];
      const src = token.attrGet("src") || "";
      const alt = token.content || "";
      const title = token.attrGet("title") || "";

      const escapeBasic = (str) =>
        str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const escapedSrc = escapeBasic(src);
      const escapedAlt = escapeBasic(alt);
      const escapedTitle = escapeBasic(title);

      let html = '<figure class="demoImage">';
      html += `<img class="demoImg" src="${escapedSrc}" alt="${escapedAlt}"`;

      if (title) {
        html += ` title="${escapedTitle}"`;
      }

      html += ' loading="lazy">';

      if (title) {
        html += `<figcaption class="borders">${escapedTitle}</figcaption>`;
      }

      html += "</figure>";

      return html;
    };

    report.debug("Custom image renderer configured");
  }

  // ---------------------------------------------------------------- fences

  function createFenceRenderer(md, settings) {
    const originalFence =
      md.renderer.rules.fence ||
      function (tokens, idx) {
        return (
          "<pre><code>" + md.utils.escapeHtml(tokens[idx].content) + "</code></pre>"
        );
      };

    return function (tokens, idx, options, env, slf) {
      // diagrams:false leaves chart and mermaid fences as ordinary code blocks
      // (the HTML-level maths restore then reaches their text as it does any code).
      if (!settings.diagrams) {
        return originalFence(tokens, idx, options, env, slf);
      }

      const token = tokens[idx];
      const info = token.info.trim();
      let code = token.content.trim();

      // Put each stashed maths original back into the source before drawing.
      if (MATHS_RESTORE_FENCES.includes(info) && env && env.mathMap) {
        for (const [placeholder, original] of env.mathMap) {
          code = code.split(placeholder).join(original);
        }
      }

      if (info === "chart") {
        return renderChart(code, settings);
      } else if (info === "mermaid" && window.mermaid) {
        return renderMermaid(code, settings);
      }

      return originalFence(tokens, idx, options, env, slf);
    };
  }

  function renderChart(code, settings) {
    const report = settings.report;
    try {
      const chartData = JSON.parse(code);
      const chartId =
        "chart-" +
        Math.random().toString(36).substring(ID_SLICE_START, CHART_ID_SLICE_END);

      setTimeout(() => {
        try {
          const canvas = document.getElementById(chartId);
          if (canvas) {
            new window.Chart(canvas, chartData);

            if (
              window.ChartControls &&
              typeof window.ChartControls.addControlsToContainer === "function"
            ) {
              const container = canvas.closest(".chart-container");
              if (container) {
                window.ChartControls.addControlsToContainer(container, chartId);
              }
            }
          }
        } catch (err) {
          report.error("Chart rendering failed", err);
        }
      }, 0);

      const canvasLabel = settings.figureRole
        ? ' aria-label="Chart visualisation"'
        : "";

      return `<div class="chart-container" aria-label="Chart" role="figure" data-chart-code="${encodeURIComponent(
        code
      )}">
                <canvas id="${chartId}" width="600" height="400"${canvasLabel}></canvas>
            </div>`;
    } catch (err) {
      report.error("Invalid chart data", err);
      // MRC-60: lead says a chart failed, in the same text node as the parser
      // message so it is read as one line. The message can echo the reader's own
      // JSON, so it is escaped (it used to be inserted as markup).
      return `<pre class="error-boundary"><code>${CHART_ERROR_LEAD} ${escapeHtml(
        String(err.message)
      )}</code></pre>`;
    }
  }

  function renderMermaid(code, settings) {
    const report = settings.report;
    const defaults = settings.mermaidDefaults;
    try {
      const mermaidId =
        "mermaid-diagram-" +
        Math.random().toString(36).substring(ID_SLICE_START, CHART_ID_SLICE_END);
      const cleanCode = code.trim();

      setTimeout(() => {
        try {
          const element = document.getElementById(mermaidId);
          if (!element) return;

          window.mermaid.render(mermaidId + "-svg", cleanCode).then(
            (result) => {
              element.innerHTML = result.svg;
              const svg = element.querySelector("svg");
              if (svg) {
                svg.setAttribute("aria-label", "Mermaid diagram");
                svg.setAttribute("role", "img");
                svg.style.maxWidth = "100%";
                svg.style.height = "auto";
              }

              // Apply saved preferences if available
              if (
                window.MermaidControls &&
                typeof window.MermaidControls.utils === "object"
              ) {
                const utils = window.MermaidControls.utils;
                const savedWidth = utils.getSavedPreference(
                  "mermaid-diagram-width",
                  defaults.width
                );
                const savedHeight = utils.getSavedPreference(
                  "mermaid-diagram-height",
                  defaults.height
                );
                const lockAspectRatio = utils.getSavedPreference(
                  "mermaid-lock-aspect-ratio",
                  defaults.lockAspectRatio
                );

                if (typeof window.MermaidControls.applyDiagramSize === "function") {
                  window.MermaidControls.applyDiagramSize(
                    svg,
                    savedWidth,
                    savedHeight,
                    lockAspectRatio === "true" || lockAspectRatio === true
                  );
                }
              }

              if (
                window.MermaidControls &&
                typeof window.MermaidControls.addControlsToContainer === "function"
              ) {
                const container = element.closest(".mermaid-container");
                if (container) {
                  window.MermaidControls.addControlsToContainer(
                    container,
                    mermaidId.split("-").pop()
                  );
                }
              }
            },
            (error) => {
              // render() rejected: say so beside the diagram. A second
              // argument to .then, not a .catch, so a fault in the success
              // handler above is never mistaken for a failed diagram.
              report.warn("Mermaid render rejected", error);
              if (
                window.MermaidControls &&
                typeof window.MermaidControls.noteRenderFailure === "function"
              ) {
                window.MermaidControls.noteRenderFailure(element);
              }
            }
          );
        } catch (err) {
          report.error("Mermaid rendering failed", err);
        }
      }, 0);

      // The source sits in the div as a placeholder only; every downstream
      // consumer reads its textContent, never innerHTML. Escaping keeps that
      // read identical while stopping the source being parsed as live markup.
      const escapedCode = escapeHtml(cleanCode);
      if (escapedCode !== cleanCode) {
        report.debug(
          `Escaped HTML-significant characters in diagram source for ${mermaidId}`
        );
      }

      const figureAttrs = settings.figureRole
        ? ' aria-label="Diagram" role="figure"'
        : "";

      return `<div class="mermaid-container"${figureAttrs} data-diagram-code="${encodeURIComponent(
        cleanCode
      )}">
              <div id="${mermaidId}" class="mermaid">${escapedCode}</div>
            </div>`;
    } catch (err) {
      report.error("Invalid mermaid diagram", err);
      return `<pre class="error-boundary"><code>${err.message}</code></pre>`;
    }
  }

  // ---------------------------------------------------------------- markdown-it

  /**
   * Create the configured markdown-it instance.
   * @param {Object} [options] named options (see file header)
   * @returns {Object} markdown-it instance
   */
  function createMarkdownIt(options) {
    const settings = resolveOptions(options);
    const report = settings.report;

    if (!window.markdownit) {
      throw new Error("markdown-it library not loaded");
    }

    const markdownItOptions = {
      html: settings.html,
      breaks: settings.breaks,
      linkify: settings.linkify,
      typographer: settings.typographer,
    };

    // highlight:false leaves markdown-it's own plain code block (no Prism).
    if (settings.highlight) {
      markdownItOptions.highlight = function (str, lang) {
        if (lang && window.Prism && window.Prism.languages[lang]) {
          try {
            return (
              '<pre class="language-' +
              lang +
              '"><code>' +
              window.Prism.highlight(str, window.Prism.languages[lang], lang) +
              "</code></pre>"
            );
          } catch (err) {
            report.error(`Syntax highlighting failed for ${lang}`, err);
          }
        }
        return (
          '<pre class="language-none"><code>' +
          md.utils.escapeHtml(str) +
          "</code></pre>"
        );
      };
    }

    const md = window.markdownit(markdownItOptions);

    if (settings.tables === TABLE_STYLES.PLAIN) {
      report.debug("Plain tables requested, sortable tables plugin skipped");
    } else if (
      window.sortableTablesEnhanced &&
      window.sortableTablesEnhanced.markdownItPlugin
    ) {
      md.use(window.sortableTablesEnhanced.markdownItPlugin);
      report.debug("Enhanced sortable tables plugin loaded");
    } else {
      report.warn(
        "Enhanced sortable tables plugin not available, falling back to basic tables"
      );
    }

    // Process tables and escape dollar signs in cells
    md.core.ruler.push("escape_table_dollars", function (state) {
      const tokens = state.tokens;
      let inTable = false;
      let inTableCell = false;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === "table_open") {
          inTable = true;
        } else if (token.type === "table_close") {
          inTable = false;
        } else if (
          inTable &&
          (token.type === "th_open" || token.type === "td_open")
        ) {
          inTableCell = true;
        } else if (
          inTable &&
          (token.type === "th_close" || token.type === "td_close")
        ) {
          inTableCell = false;
        } else if (inTable && inTableCell && token.type === "text") {
          if (token.content.includes("$")) {
            token.content = token.content.replace(
              /\$/g,
              '<span class="currency">$</span>'
            );
          }
        }
      }

      return true;
    });

    // Add custom rule to modify definition lists
    md.core.ruler.push("add_deflist_class", function (state) {
      const tokens = state.tokens;

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== "dl_open") continue;

        if (!tokens[i].attrs) {
          tokens[i].attrs = [];
        }

        let classAttrIndex = -1;
        for (let j = 0; j < tokens[i].attrs.length; j++) {
          if (tokens[i].attrs[j][0] === "class") {
            classAttrIndex = j;
            break;
          }
        }

        if (classAttrIndex === -1) {
          tokens[i].attrs.push(["class", "definition-list"]);
        } else {
          tokens[i].attrs[classAttrIndex][1] += " definition-list";
        }
      }

      return true;
    });

    // Custom table cell renderers (env.insideTableCell)
    const originalTdOpen =
      md.renderer.rules.td_open ||
      function (tokens, idx, opts, env, self) {
        return self.renderToken(tokens, idx, opts);
      };

    const originalThOpen =
      md.renderer.rules.th_open ||
      function (tokens, idx, opts, env, self) {
        return self.renderToken(tokens, idx, opts);
      };

    md.renderer.rules.td_open = function (tokens, idx, opts, env, self) {
      env.insideTableCell = true;
      return originalTdOpen(tokens, idx, opts, env, self);
    };

    md.renderer.rules.th_open = function (tokens, idx, opts, env, self) {
      env.insideTableCell = true;
      return originalThOpen(tokens, idx, opts, env, self);
    };

    md.renderer.rules.td_close = function (tokens, idx, opts, env) {
      env.insideTableCell = false;
      return "</td>";
    };

    md.renderer.rules.th_close = function (tokens, idx, opts, env) {
      env.insideTableCell = false;
      return "</th>";
    };

    // Plugins are read from window at call time
    const plugins = [
      { name: "sub", plugin: window.markdownitSub },
      { name: "sup", plugin: window.markdownitSup },
      { name: "footnote", plugin: window.markdownitFootnote },
      { name: "deflist", plugin: window.markdownitDeflist },
      { name: "abbr", plugin: window.markdownitAbbr },
      { name: "emoji", plugin: window.markdownitEmoji },
      { name: "ins", plugin: window.markdownitIns },
      { name: "mark", plugin: window.markdownitMark },
      { name: "container", plugin: window.markdownitContainer },
      { name: "anchor", plugin: window.markdownItAnchor },
      { name: "toc", plugin: window.markdownItTocDoneRight },
      // The served plugin file registers window.markdownItAttrs (capital I); the lowercase name was never defined (MRC-70).
      { name: "attrs", plugin: window.markdownItAttrs || window.markdownitAttrs },
      { name: "multimd-table", plugin: window.markdownitMultimdTable },
      { name: "tab", plugin: window.markdownitTab },
    ];

    md.enable("table");

    plugins.forEach(({ name, plugin }) => {
      if (!plugin) return;

      // Named switches: supSub, plugins (the group) and anchorStyle "none".
      if (!settings.supSub && SUP_SUB_NAMES.includes(name)) return;
      if (!settings.plugins && PLUGIN_GROUP_NAMES.includes(name)) return;
      if (!settings.attrs && name === "attrs") return;
      if (name === "anchor" && settings.anchorStyle === ANCHOR_STYLES.NONE) {
        return;
      }

      try {
        if (name === "container") {
          md.use(plugin, "info").use(plugin, "warning").use(plugin, "danger");
        } else if (name === "anchor") {
          const permalink =
            settings.anchorStyle === ANCHOR_STYLES.AFTER
              ? plugin.permalink.linkAfterHeader({
                  class: "header-anchor",
                  symbol: ANCHOR_SYMBOL,
                  style: "aria-labelledby",
                })
              : plugin.permalink.linkInsideHeader({
                  class: "header-anchor",
                  symbol: ANCHOR_SYMBOL,
                  placement: "after",
                  space: true,
                  ariaHidden: false,
                });

          md.use(plugin, {
            permalink,
            slugify: headingSlugify,
          });
        } else if (name === "toc") {
          const tocOptions = {
            containerClass: "toc",
            listType: settings.tocListType,
            level: [1, 2, 3],
          };
          if (settings.tocSlugMatchesAnchor) {
            tocOptions.slugify = headingSlugify;
          }
          md.use(plugin, tocOptions);
        } else if (name === "attrs") {
          md.use(plugin, {
            allowedAttributes: ["id", "class", "style", "width", "height", "alt"],
          });
        } else if (name === "tab") {
          md.use(plugin, { name: "tabs" });
        } else {
          md.use(plugin);
        }
      } catch (error) {
        report.error(`Plugin "${name}" failed to load`, error);
      }
    });

    if (settings.taskListStyle === TASK_LIST_STYLES.PLAIN) {
      // The plain markup the Chat renderers emit: the markdown-it-task-lists plugin, if loaded.
      if (window.markdownitTaskLists) {
        try {
          md.use(window.markdownitTaskLists);
        } catch (error) {
          report.error('Plugin "task-lists" failed to load', error);
        }
      } else {
        report.warn("Plain task lists requested but markdown-it-task-lists is not loaded");
      }
    } else {
      setupCustomTaskLists(md, report);
    }

    if (settings.images === IMAGE_STYLES.CORE) {
      setupImageRenderer(md, report);
    }
    md.renderer.rules.fence = createFenceRenderer(md, settings);

    return md;
  }

  // ---------------------------------------------------------------- maths

  /**
   * Protect math blocks from markdown-it processing.
   * Prevents plugins like markdown-it-sup from corrupting LaTeX syntax.
   * @param {string} text raw markdown
   * @param {Object} report injected reporter
   * @returns {{text: string, mathMap: Map}}
   */
  function protectMathBlocks(text, report) {
    const mathMap = new Map();
    let counter = 0;

    // Display maths first ($$...$$), may span lines
    let protectedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
      const placeholder = `%%MATHBLOCK_${counter}%%`;
      mathMap.set(placeholder, match);
      counter++;
      return placeholder;
    });

    // Inline maths ($...$), single line, currency left alone
    protectedText = protectedText.replace(
      /\$([^\s$](?:[^$]*[^\s$])?)\$/g,
      (match, content) => {
        if (/^[\d,.\s]+$/.test(content)) {
          return match;
        }
        const placeholder = `%%MATHBLOCK_${counter}%%`;
        mathMap.set(placeholder, match);
        counter++;
        return placeholder;
      }
    );

    // \(...\) and \[...\] too: markdown-it's backslash-escape rule would
    // otherwise delete the backslashes.
    protectedText = protectedText.replace(BRACKET_MATH_PATTERN, (match) => {
      const placeholder = `%%MATHBLOCK_${counter}%%`;
      mathMap.set(placeholder, match);
      counter++;
      return placeholder;
    });

    report.debug(`[Math Protection] Protected ${counter} math blocks`);
    return { text: protectedText, mathMap };
  }

  /**
   * Restore protected math blocks after markdown-it processing.
   * @param {string} html processed HTML
   * @param {Map} mathMap placeholders to originals
   * @param {Object} report injected reporter
   * @returns {string}
   */
  function restoreMathBlocks(html, mathMap, report) {
    // Mark unpaired "$" so MathJax leaves prices alone. Unchanged when the
    // MathProtect helper is absent.
    const mathHelpers = window.MathProtect;
    let restoredHtml =
      mathHelpers && typeof mathHelpers.markPrices === "function"
        ? mathHelpers.markPrices(html)
        : html;

    for (const [placeholder, original] of mathMap) {
      // Escape on the way back in, otherwise `\(a<b\)` would start a tag.
      const escaped = original
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      restoredHtml = restoredHtml.split(placeholder).join(escaped);
    }

    report.debug(`[Math Protection] Restored ${mathMap.size} math blocks`);
    return restoredHtml;
  }

  /**
   * Add accessibility attributes to header anchor links ("inside" style only:
   * the "after" style carries aria-labelledby from the plugin).
   * @param {string} html
   * @returns {string}
   */
  function enhanceHeaderAnchors(html) {
    const parser = new DOMParser();
    // Explicit <body>: HTML that is only a comment (a lone stashed equation,
    // <!--MATH_PLACEHOLDER_0-->) otherwise parses as a child of the document and
    // body.innerHTML below comes back empty, losing the equation (MRC-52).
    const doc = parser.parseFromString("<body>" + html, "text/html");
    const anchors = doc.querySelectorAll(".header-anchor");

    anchors.forEach((anchor) => {
      const heading = anchor.closest("h1, h2, h3, h4, h5, h6");
      if (heading) {
        let headingText = heading.textContent || "";
        headingText = headingText.replace(/[\s​]*$/g, "");
        anchor.setAttribute(
          "aria-label",
          `Direct link to "${headingText}" section`
        );
      }
    });

    return doc.body.innerHTML;
  }

  /**
   * Render markdown text to an HTML string.
   * @param {string} markdownText
   * @param {Object} [options] named options
   * @returns {string} HTML
   */
  function render(markdownText, options) {
    const settings = resolveOptions(options);
    const md = createMarkdownIt(options);

    const { text: protectedText, mathMap } = protectMathBlocks(
      markdownText,
      settings.report
    );
    // mathMap goes in as env so the fence renderer can restore maths in charts and diagrams
    let htmlResult = md.render(protectedText, { mathMap });

    htmlResult = restoreMathBlocks(htmlResult, mathMap, settings.report);

    if (settings.anchorStyle === ANCHOR_STYLES.INSIDE) {
      htmlResult = enhanceHeaderAnchors(htmlResult);
    }

    return htmlResult;
  }

  // ---------------------------------------------------------------- post-processing

  /**
   * Fix WCAG 4.1.2: aria-hidden MathJax elements must hold no focusable content.
   * @param {HTMLElement} container
   * @param {Object} report
   */
  function fixMathJaxAccessibility(container, report) {
    if (!container) return;

    const assistiveMml = container.querySelectorAll("mjx-assistive-mml");
    let fixedCount = 0;

    assistiveMml.forEach((mml) => {
      mml.setAttribute("tabindex", "-1");

      const focusableSelectors = [
        '[tabindex]:not([tabindex="-1"])',
        '[role="application"]',
        "mjx-container",
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        "math",
      ].join(", ");

      mml.querySelectorAll(focusableSelectors).forEach((el) => {
        el.setAttribute("tabindex", "-1");

        if (el.getAttribute("role") === "application") {
          el.setAttribute("role", "presentation");
        }

        fixedCount++;
      });
    });

    if (fixedCount > 0) {
      report.debug(
        `[Accessibility] Fixed ${fixedCount} focusable elements in ${assistiveMml.length} mjx-assistive-mml containers`
      );
    }
  }

  // Post-processing for figure images: aspect-ratio on load, minimal error
  function enhanceFigureImages(container, report) {
    const figures = container.querySelectorAll("figure.demoImage");

    figures.forEach((figure) => {
      const img = figure.querySelector("img.demoImg");
      if (!img) return;

      img.addEventListener(
        "load",
        function () {
          const width = this.naturalWidth;
          const height = this.naturalHeight;

          if (width && height) {
            figure.style.aspectRatio = `${width} / ${height}`;
            report.debug(`Image loaded: ${width}x${height}, aspect-ratio set`);
          }
        },
        { once: true }
      );

      img.addEventListener(
        "error",
        function () {
          figure.style.aspectRatio = "auto";

          const errorMessage = document.createElement("span");
          errorMessage.className = "demoImg-error";
          errorMessage.setAttribute("role", "img");
          errorMessage.setAttribute(
            "aria-label",
            this.alt || "Image failed to load"
          );
          errorMessage.textContent = "⚠ Image not found";

          this.replaceWith(errorMessage);
          report.warn(`Image failed to load: ${this.src}`);
        },
        { once: true }
      );

      if (img.complete && img.naturalWidth) {
        figure.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        report.debug("Image already cached, aspect-ratio set immediately");
      }
    });
  }

  /**
   * Typeset maths in a container: the editor's queue manager when healthy,
   * otherwise MathJax directly.
   */
  async function typeset(container, report) {
    if (
      !window.mathJaxManager ||
      !window.mathJaxManager.getStatus().isHealthy
    ) {
      report.debug("MathJax Manager unavailable or unhealthy, using direct rendering");
      await window.MathJax.typesetPromise([container]);
      return;
    }

    try {
      await window.mathJaxManager.queueTypeset(container);
      report.debug("MathJax rendering via queue system");
    } catch (error) {
      report.warn("Queue rendering failed, using direct fallback:", error);
      await window.MathJax.typesetPromise([container]);
    }
  }

  // ------------------------------------------------- long inline maths (MRC-20)

  const LONG_MATH_CLASS = "mdrc-long-inline-math";
  const LONG_MATH_STYLE_ID = "mdrc-long-inline-math-style";
  const LONG_MATH_RESIZE_DEBOUNCE_MS = 150;
  const LONG_MATH_PARENT_TAGS = Object.freeze(["P", "LI", "TD", "TH"]);

  // The scroll rule is added only to a marked equation, so an equation that fits is never a scroll area.
  // The assistive-MathML cap stops MathJax's hidden copy (wider than the drawn maths) adding scrollable width.
  const LONG_MATH_CSS =
    'mjx-container.' + LONG_MATH_CLASS + ':not([display="true"]) {\n' +
    "  display: inline-block; max-width: 100%; overflow-x: auto; overflow-y: hidden; vertical-align: middle;\n" +
    "}\n" +
    'mjx-container.' + LONG_MATH_CLASS + ':not([display="true"]) > mjx-assistive-mml { max-width: 100%; }\n';

  // Containers that asked for the behaviour; re-checked on window resize.
  const longMathContainers = new Set();
  let longMathResizeTimer = null;
  let longMathResizeListening = false;

  function ensureLongMathStyle() {
    if (document.getElementById(LONG_MATH_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LONG_MATH_STYLE_ID;
    style.textContent = LONG_MATH_CSS;
    document.head.appendChild(style);
  }

  // Marks an inline equation (a direct child of p, li, td or th) whose drawn maths is wider than its parent's
  // content width, and unmarks one that now fits. A parent with no layout box (width 0) is skipped and left as it was.
  function markLongInlineMaths(container) {
    container.querySelectorAll("mjx-container").forEach((equation) => {
      if (equation.getAttribute("display") === "true") return;

      const parent = equation.parentElement;
      if (!parent || !LONG_MATH_PARENT_TAGS.includes(parent.tagName)) return;

      const parentStyle = getComputedStyle(parent);
      const available =
        parent.clientWidth -
        (parseFloat(parentStyle.paddingLeft) || 0) -
        (parseFloat(parentStyle.paddingRight) || 0);
      if (available <= 0) return;

      const drawn = equation.querySelector("mjx-math") || equation;
      equation.classList.toggle(
        LONG_MATH_CLASS,
        drawn.getBoundingClientRect().width > available
      );
    });
  }

  function recheckLongInlineMaths() {
    longMathResizeTimer = null;
    longMathContainers.forEach((container) => {
      if (!container.isConnected) {
        longMathContainers.delete(container);
        return;
      }
      markLongInlineMaths(container);
    });
  }

  function onLongMathResize() {
    clearTimeout(longMathResizeTimer);
    longMathResizeTimer = setTimeout(
      recheckLongInlineMaths,
      LONG_MATH_RESIZE_DEBOUNCE_MS
    );
  }

  function enableLongInlineMathScroll(container) {
    ensureLongMathStyle();
    longMathContainers.add(container);
    if (!longMathResizeListening) {
      window.addEventListener("resize", onLongMathResize);
      longMathResizeListening = true;
    }
    markLongInlineMaths(container);
  }

  const TYPESET_PENDING_ATTRIBUTE = "data-typeset-pending";

  /**
   * Mark the not-yet-enhanced sortable tables in a container as waiting for
   * MathJax. Only when this render will typeset and enhance them itself.
   * @returns {HTMLElement[]} the tables marked
   */
  function markTablesTypesetPending(container, settings) {
    if (
      settings.tables !== TABLE_STYLES.SORTABLE ||
      typeof window.initSortableTables !== "function" ||
      !window.MathJax ||
      typeof window.MathJax.typesetPromise !== "function"
    ) {
      return [];
    }

    const tables = Array.from(
      container.querySelectorAll(
        'table.sortable-table:not([data-enhanced="true"])'
      )
    );
    tables.forEach((table) =>
      table.setAttribute(TYPESET_PENDING_ATTRIBUTE, String(Date.now()))
    );
    return tables;
  }

  function clearTypesetPending(tables) {
    tables.forEach((table) => table.removeAttribute(TYPESET_PENDING_ATTRIBUTE));
  }

  /**
   * Everything that runs after the HTML is in the page. Each step is called
   * only if its helper exists on window.
   * @param {HTMLElement} container
   * @param {Object} [options] named options (`report`, `containerInit`)
   * @returns {Promise<void>}
   */
  async function postProcess(container, options) {
    const settings = resolveOptions(options);
    const report = settings.report;

    if (window.Prism && settings.highlight) {
      window.Prism.highlightAllUnder(container);
    }

    // Tell the table enhancer's page observer to leave these tables alone until
    // they are typeset, or it stores raw LaTeX in the cells (MRC-40). Cleared in
    // `finally`, and the enhancer ignores a mark older than its bound anyway.
    const pendingTables = markTablesTypesetPending(container, settings);

    try {
      if (
        window.MathJax &&
        typeof window.MathJax.typesetPromise === "function"
      ) {
        try {
          await typeset(container, report);
        } catch (err) {
          report.warn("MathJax typesetting failed", err);
        }

        if (typeof window.mathPixEnhanceMathJax === "function") {
          report.debug("Applying MathPix enhancements");
          window.mathPixEnhanceMathJax();
        }

        fixMathJaxAccessibility(container, report);
      }
    } finally {
      clearTypesetPending(pendingTables);
    }

    enhanceFigureImages(container, report);

    if (
      settings.tables === TABLE_STYLES.SORTABLE &&
      typeof window.initSortableTables === "function"
    ) {
      window.initSortableTables();
    }

    if (
      window.MarkdownCodeCopy &&
      typeof window.MarkdownCodeCopy.init === "function"
    ) {
      window.MarkdownCodeCopy.init(container);
    }

    // After the table set-up, because that restyles table cells and a cell's width is only final then (MRC-20).
    if (
      settings.longInlineMathScrolls &&
      container.querySelector("mjx-container")
    ) {
      enableLongInlineMathScroll(container);
    }

    // Helpers the loader calls on a container and the editor does not
    // (the editor passes none, so its output is unchanged).
    settings.containerInit.forEach((name) => {
      const helper = window[name];
      if (helper && typeof helper.init === "function") {
        helper.init(container);
        report.debug(`${name} initialised`);
      }
    });
  }

  window.MarkdownRenderCore = {
    createMarkdownIt,
    render,
    postProcess,
    version: VERSION,
  };

  logInfo("Markdown Render Core loaded, version " + VERSION);
})();
