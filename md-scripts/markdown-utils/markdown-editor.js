/**
 * Markdown Editor
 * A comprehensive markdown editor with support for LaTeX math, charts, diagrams and accessible task lists
 */

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Current log level (can be changed at runtime)
let currentLogLevel = DEFAULT_LOG_LEVEL;

// Logging utilities
const Logger = {
  shouldLog: function (level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  },

  error: function (message, ...args) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  },

  warn: function (message, ...args) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  },

  info: function (message, ...args) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(message, ...args);
    }
  },

  debug: function (message, ...args) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  },

  setLevel: function (level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
      this.info(`Logging level set to: ${Object.keys(LOG_LEVELS)[level]}`);
    } else {
      this.warn(
        `Invalid log level: ${level}. Valid levels are ${LOG_LEVELS.ERROR}-${LOG_LEVELS.DEBUG}`
      );
    }
  },

  getCurrentLevel: function () {
    return currentLogLevel;
  },
};

const MarkdownEditor = (function () {
  // Configuration options
  const config = {
    autoSave: true,
    renderDelay: 300,
    autoSaveDelay: 1000,
    mathJaxConfig: {
      tex: {
        inlineMath: [["$", "$"]],
        displayMath: [["$$", "$$"]],
        processEscapes: true,
      },
      options: {
        skipHtmlTags: [
          "script",
          "noscript",
          "style",
          "textarea",
          "pre",
          "span.currency",
        ],
      },
    },
    mermaidConfig: {
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    },
  };

  // State management
  const state = {
    isRendering: false,
    lastSavedContent: "",
    pluginsLoaded: false,
    mathJaxLoaded: false,
    isInitialized: false,
  };

  // DOM element references
  let elements = {};

  // Live editor instance
  let liveMarkdownEditor = null;

  // Notification utilities using UniversalNotifications
  const NotificationHandler = {
    /**
     * Check if Markdown Editor is the currently selected tool
     * @returns {boolean} Whether Markdown Editor radio button is selected
     */
    isMarkdownEditorSelected: function () {
      const markdownRadio = document.getElementById("MarkdownEditorRadio");
      return markdownRadio && markdownRadio.checked;
    },

    showError: function (message, error = null) {
      Logger.error("Error:", message, error);

      // Only show notifications if Markdown Editor is selected
      if (this.isMarkdownEditorSelected()) {
        // Use UniversalNotifications for error display
        if (window.UniversalNotifications) {
          window.UniversalNotifications.error(message, {
            duration: 5000,
            dismissible: true,
          });
        } else {
          // Fallback if UniversalNotifications not available
          console.error(`Error: ${message}`, error);
          alert(`Error: ${message}`);
        }
      }
      // Always log to console regardless of selection
      console.error(`[Markdown Editor] Error: ${message}`, error);
    },

    showSuccess: function (message) {
      // Only show notifications if Markdown Editor is selected
      if (this.isMarkdownEditorSelected()) {
        // Use UniversalNotifications for success display
        if (window.UniversalNotifications) {
          window.UniversalNotifications.success(message, {
            duration: 3000,
            dismissible: true,
          });
        } else {
          // Fallback if UniversalNotifications not available
          console.info(`Success: ${message}`);
        }
      }
      // Always log to console regardless of selection
      console.info(`[Markdown Editor] Success: ${message}`);
    },

    showWarning: function (message) {
      // Only show notifications if Markdown Editor is selected
      if (this.isMarkdownEditorSelected()) {
        // Additional method for warnings
        if (window.UniversalNotifications) {
          window.UniversalNotifications.warning(message, {
            duration: 4000,
            dismissible: true,
          });
        } else {
          // Fallback if UniversalNotifications not available
          console.warn(`Warning: ${message}`);
        }
      }
      // Always log to console regardless of selection
      console.warn(`[Markdown Editor] Warning: ${message}`);
    },

    showInfo: function (message) {
      // Only show notifications if Markdown Editor is selected
      if (this.isMarkdownEditorSelected()) {
        // Additional method for info messages
        if (window.UniversalNotifications) {
          window.UniversalNotifications.info(message, {
            duration: 3000,
            dismissible: true,
          });
        } else {
          // Fallback if UniversalNotifications not available
          console.info(`Info: ${message}`);
        }
      }
      // Always log to console regardless of selection
      console.info(`[Markdown Editor] Info: ${message}`);
    },

    handlePluginError: function (pluginName, error) {
      Logger.error(`Plugin '${pluginName}' failed to load:`, error);

      // Show user-friendly notification only if Markdown Editor is selected
      if (this.isMarkdownEditorSelected()) {
        this.showWarning(
          `Plugin '${pluginName}' failed to load - some features may be unavailable`
        );
      }

      return function fallbackRenderer(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };
    },
  };

  // Loading indicator management
  const LoadingManager = {
    show: function () {
      if (elements.loading) {
        elements.loading.classList.add("visible");
      }
      if (elements.renderBtn) {
        elements.renderBtn.disabled = true;
      }
    },

    hide: function () {
      if (elements.loading) {
        elements.loading.classList.remove("visible");
      }
      if (elements.renderBtn) {
        elements.renderBtn.disabled = false;
      }
    },
  };

  // Autosave functionality
  const AutoSave = {
    save: function () {
      const content = elements.markdownInput.value;
      if (content !== state.lastSavedContent) {
        localStorage.setItem("markdown-content", content);
        state.lastSavedContent = content;
      }
    },

    load: function () {
      const saved = localStorage.getItem("markdown-content");
      if (saved) {
        elements.markdownInput.value = saved;
        state.lastSavedContent = saved;
      }
    },

    clear: function () {
      localStorage.removeItem("markdown-content");
      state.lastSavedContent = "";
    },
  };

  /**
   * Setup accessible semantic task lists
   * Processes task list markdown and renders as semantic HTML with status indicators
   */
  function setupCustomTaskLists(md) {
    // Process tokens after inline processing is complete
    // Process tokens after inline processing is complete
    md.core.ruler.after("inline", "custom_task_lists", function (state) {
      const tokens = state.tokens;
      let processedCount = 0;

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "bullet_list_open") {
          let hasDirectTaskItems = false;
          let j = i + 1;
          let nestingLevel = 0;

          // Only scan DIRECT children of this list, not nested lists
          while (j < tokens.length && tokens[j].type !== "bullet_list_close") {
            // Track nesting level to avoid processing nested lists
            if (tokens[j].type === "bullet_list_open") {
              nestingLevel++;
            } else if (tokens[j].type === "bullet_list_close") {
              nestingLevel--;
            }

            // Only process list items at the direct level (nesting level 0)
            else if (
              tokens[j].type === "list_item_open" &&
              nestingLevel === 0
            ) {
              // Look for paragraph and inline tokens within this DIRECT list item
              let k = j + 1;
              let itemNestingLevel = 0;

              while (
                k < tokens.length &&
                tokens[k].type !== "list_item_close"
              ) {
                // Track nesting within the list item
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
                }

                // Only check for tasks in direct content (not nested lists)
                else if (
                  tokens[k].type === "paragraph_open" &&
                  itemNestingLevel === 0
                ) {
                  const inlineToken = tokens[k + 1];
                  if (inlineToken && inlineToken.type === "inline") {
                    const content = inlineToken.content.trim();

                    // Check for task list syntax
                    const taskMatch = content.match(/^\[([x\s])\]\s*(.*)/i);
                    if (taskMatch) {
                      hasDirectTaskItems = true;
                      const isChecked = taskMatch[1].toLowerCase() === "x";
                      const taskText = taskMatch[2].trim();

                      // Mark the list item as a task item
                      if (!tokens[j].attrs) tokens[j].attrs = [];
                      tokens[j].attrs.push(["class", "task-list-item"]);
                      tokens[j].attrs.push([
                        "data-checked",
                        isChecked ? "true" : "false",
                      ]);
                      tokens[j].attrs.push(["data-task-text", taskText]);

                      // Update the inline content
                      inlineToken.content = taskText;

                      // Update children tokens if they exist
                      if (
                        inlineToken.children &&
                        inlineToken.children.length > 0
                      ) {
                        for (let c = 0; c < inlineToken.children.length; c++) {
                          if (inlineToken.children[c].type === "text") {
                            const childContent =
                              inlineToken.children[c].content;
                            const childMatch =
                              childContent.match(/^\[([x\s])\]\s*(.*)/i);
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
          // OR if it's a list with ONLY task items (no mixed content)
          if (hasDirectTaskItems) {
            // Count direct list items to see if they're all tasks
            let directItems = 0;
            let directTaskItems = 0;
            let j2 = i + 1;
            let nestingLevel2 = 0;

            while (
              j2 < tokens.length &&
              tokens[j2].type !== "bullet_list_close"
            ) {
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

            // Only mark as task list if ALL direct items are tasks
            if (directItems > 0 && directTaskItems === directItems) {
              if (!tokens[i].attrs) tokens[i].attrs = [];
              tokens[i].attrs.push(["class", "contains-task-list"]);
            }
          }
        }
      }

      // Log only if tasks were processed
      if (processedCount > 0) {
        Logger.debug(`[Task Lists] Processed ${processedCount} tasks`);
      }
      return true;
    });

    // Custom renderer for task lists
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
        // Count tasks
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

    // Custom renderer for task list items
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
        let taskText = token.attrGet("data-task-text") || "";

        const statusText = isChecked ? "Completed" : "Not completed";
        const statusIcon = isChecked ? "✅" : "⭕";
        const completedClass = isChecked ? " task-completed" : "";

        // Handle empty tasks gracefully
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

    // Custom renderer for task list item closing
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
      // Find the matching opening token
      const openToken = findMatchingOpenToken(tokens, idx);
      const isTaskListItem =
        openToken && openToken.attrGet("class") === "task-list-item";

      if (isTaskListItem) {
        return "</span></li>";
      }

      return originalListItemClose(tokens, idx, options, env, self);
    };

    // Helper function to find matching opening token
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

  // Custom image renderer for enhanced figure output with accessibility
  function setupImageRenderer(md) {
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const src = token.attrGet("src") || "";
      const alt = token.content || "";
      const title = token.attrGet("title") || "";

      // Escape HTML entities for safety
      const escapeHtml = (str) => {
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      const escapedSrc = escapeHtml(src);
      const escapedAlt = escapeHtml(alt);
      const escapedTitle = escapeHtml(title);

      // Build figure with enhanced classes
      let html = '<figure class="demoImage">';
      html += `<img class="demoImg" src="${escapedSrc}" alt="${escapedAlt}"`;

      if (title) {
        html += ` title="${escapedTitle}"`;
      }

      html += ' loading="lazy">';

      // Add figcaption only if title is provided
      if (title) {
        html += `<figcaption class="borders">${escapedTitle}</figcaption>`;
      }

      html += "</figure>";

      return html;
    };

    Logger.debug("Custom image renderer configured");
  }

  // Initialize markdown-it with plugins
  function initializeMarkdownIt() {
    const md = window.markdownit({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && Prism.languages[lang]) {
          try {
            return (
              '<pre class="language-' +
              lang +
              '"><code>' +
              Prism.highlight(str, Prism.languages[lang], lang) +
              "</code></pre>"
            );
          } catch (err) {
            NotificationHandler.showError(
              `Syntax highlighting failed for ${lang}`
            );
          }
        }
        return (
          '<pre class="language-none"><code>' +
          md.utils.escapeHtml(str) +
          "</code></pre>"
        );
      },
    });

    // Add enhanced sortable table functionality
    if (
      window.sortableTablesEnhanced &&
      window.sortableTablesEnhanced.markdownItPlugin
    ) {
      md.use(window.sortableTablesEnhanced.markdownItPlugin);
      Logger.info("Enhanced sortable tables plugin loaded");
    } else {
      Logger.warn(
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
        if (tokens[i].type === "dl_open") {
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
      }

      return true;
    });

    // Set up custom table cell renderers
    const originalTdOpen =
      md.renderer.rules.td_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    const originalThOpen =
      md.renderer.rules.th_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.td_open = function (tokens, idx, options, env, self) {
      env.insideTableCell = true;
      return originalTdOpen(tokens, idx, options, env, self);
    };

    md.renderer.rules.th_open = function (tokens, idx, options, env, self) {
      env.insideTableCell = true;
      return originalThOpen(tokens, idx, options, env, self);
    };

    md.renderer.rules.td_close = function (tokens, idx, options, env, self) {
      env.insideTableCell = false;
      return "</td>";
    };

    md.renderer.rules.th_close = function (tokens, idx, options, env, self) {
      env.insideTableCell = false;
      return "</th>";
    };

    // Plugin initialisation with error handling
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
      { name: "attrs", plugin: window.markdownitAttrs },
      { name: "multimd-table", plugin: window.markdownitMultimdTable },
      { name: "tab", plugin: window.markdownitTab },
    ];

    // Enable tables by default
    md.enable("table");

    plugins.forEach(({ name, plugin }) => {
      if (plugin) {
        try {
          if (name === "container") {
            md.use(plugin, "info").use(plugin, "warning").use(plugin, "danger");
          } else if (name === "anchor") {
            md.use(plugin, {
              permalink: plugin.permalink.linkInsideHeader({
                class: "header-anchor",
                symbol:
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
                placement: "after",
                space: true,
                ariaHidden: false,
              }),
              slugify: function (s) {
                return String(s)
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^\w\-]+/g, "")
                  .replace(/\-\-+/g, "-")
                  .replace(/^-+/, "")
                  .replace(/-+$/, "");
              },
            });
          } else if (name === "toc") {
            md.use(plugin, {
              containerClass: "toc",
              listType: "ul",
              level: [1, 2, 3],
            });
          } else if (name === "attrs") {
            md.use(plugin, {
              allowedAttributes: [
                "id",
                "class",
                "style",
                "width",
                "height",
                "alt",
              ],
            });
          } else if (name === "tab") {
            md.use(plugin, {
              name: "tabs",
            });
          } else {
            md.use(plugin);
          }
        } catch (error) {
          NotificationHandler.handlePluginError(name, error);
        }
      }
    });

    // Setup custom task lists (bypassing the plugin)
    setupCustomTaskLists(md);

    // Custom image renderer for enhanced figures
    setupImageRenderer(md);

    // Custom chart renderer
    md.renderer.rules.fence = createFenceRenderer(md);

    return md;
  }

  // Create fence renderer for charts and mermaid
  function createFenceRenderer(md) {
    const originalFence =
      md.renderer.rules.fence ||
      function (tokens, idx, options, env, slf) {
        return (
          "<pre><code>" +
          md.utils.escapeHtml(tokens[idx].content) +
          "</code></pre>"
        );
      };

    return function (tokens, idx, options, env, slf) {
      const token = tokens[idx];
      const code = token.content.trim();
      const info = token.info.trim();

      if (info === "chart") {
        return renderChart(code);
      } else if (info === "mermaid" && window.mermaid) {
        return renderMermaid(code);
      }

      return originalFence(tokens, idx, options, env, slf);
    };
  }

  // Chart rendering
  function renderChart(code) {
    try {
      const chartData = JSON.parse(code);
      const chartId = "chart-" + Math.random().toString(36).substring(2, 15);

      setTimeout(() => {
        try {
          const canvas = document.getElementById(chartId);
          if (canvas) {
            new Chart(canvas, chartData);

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
          NotificationHandler.showError("Chart rendering failed", err);
        }
      }, 0);

      return `<div class="chart-container" aria-label="Chart" role="figure" data-chart-code="${encodeURIComponent(
        code
      )}">
                <canvas id="${chartId}" width="600" height="400"></canvas>
            </div>`;
    } catch (err) {
      NotificationHandler.showError("Invalid chart data", err);
      return `<pre class="error-boundary"><code>${err.message}</code></pre>`;
    }
  }

  // Mermaid diagram rendering
  function renderMermaid(code) {
    try {
      const mermaidId =
        "mermaid-diagram-" + Math.random().toString(36).substring(2, 15);
      const cleanCode = code.trim();

      setTimeout(() => {
        try {
          const element = document.getElementById(mermaidId);
          if (element) {
            window.mermaid
              .render(mermaidId + "-svg", cleanCode)
              .then((result) => {
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
                  const savedWidth =
                    window.MermaidControls.utils.getSavedPreference(
                      "mermaid-diagram-width",
                      70
                    );
                  const savedHeight =
                    window.MermaidControls.utils.getSavedPreference(
                      "mermaid-diagram-height",
                      100
                    );
                  const lockAspectRatio =
                    window.MermaidControls.utils.getSavedPreference(
                      "mermaid-lock-aspect-ratio",
                      false
                    );

                  if (
                    typeof window.MermaidControls.applyDiagramSize ===
                    "function"
                  ) {
                    window.MermaidControls.applyDiagramSize(
                      svg,
                      savedWidth,
                      savedHeight,
                      lockAspectRatio === "true" || lockAspectRatio === true
                    );
                  }
                }

                // Add controls if available
                if (
                  window.MermaidControls &&
                  typeof window.MermaidControls.addControlsToContainer ===
                    "function"
                ) {
                  const container = element.closest(".mermaid-container");
                  if (container) {
                    window.MermaidControls.addControlsToContainer(
                      container,
                      mermaidId.split("-").pop()
                    );
                  }
                }
              });
          }
        } catch (err) {
          NotificationHandler.showError("Mermaid rendering failed", err);
        }
      }, 0);

      return `<div class="mermaid-container" aria-label="Diagram" role="figure" data-diagram-code="${encodeURIComponent(
        cleanCode
      )}">
              <div id="${mermaidId}" class="mermaid">${cleanCode}</div>
            </div>`;
    } catch (err) {
      NotificationHandler.showError("Invalid mermaid diagram", err);
      return `<pre class="error-boundary"><code>${err.message}</code></pre>`;
    }
  }

  // Check for existing MathJax and wait for it to be ready
  function initializeMathJax() {
    // Check if MathJax is already configured (from boilerplate.html)
    if (typeof window.MathJax !== "undefined") {
      Logger.info("MathJax already configured - using existing instance");

      // Check if MathJax is fully loaded
      if (window.MathJax.startup && window.MathJax.startup.document) {
        state.mathJaxLoaded = true;
        Logger.info("MathJax already loaded and ready");
      } else {
        // Wait for MathJax to finish loading
        const checkMathJaxReady = () => {
          if (window.MathJax.startup && window.MathJax.startup.document) {
            state.mathJaxLoaded = true;
            Logger.info("MathJax loading completed - ready for use");
          } else {
            setTimeout(checkMathJaxReady, 100);
          }
        };
        checkMathJaxReady();
      }
      return;
    }

    // Fallback: If MathJax not configured, set up basic configuration
    Logger.warn(
      "MathJax not pre-configured - setting up fallback configuration"
    );
    window.MathJax = {
      tex: config.mathJaxConfig.tex,
      options: config.mathJaxConfig.options,
      startup: {
        pageReady: function () {
          return MathJax.startup.defaultPageReady().then(() => {
            state.mathJaxLoaded = true;
            Logger.info("Fallback MathJax configuration loaded");
          });
        },
      },
    };

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    script.async = true;
    script.id = "MathJax-script";

    script.onerror = () => {
      NotificationHandler.showError("Failed to load MathJax");
    };

    document.head.appendChild(script);
  }

  // Initialize mermaid
  function initializeMermaid() {
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
      });
    }
  }

  // Post-processing for figure images - adds aspect-ratio on load
  function enhanceFigureImages(container) {
    const figures = container.querySelectorAll("figure.demoImage");

    figures.forEach((figure) => {
      const img = figure.querySelector("img.demoImg");
      if (!img) return;

      // Handle successful image load
      img.addEventListener(
        "load",
        function () {
          const width = this.naturalWidth;
          const height = this.naturalHeight;

          if (width && height) {
            figure.style.aspectRatio = `${width} / ${height}`;
            Logger.debug(`Image loaded: ${width}x${height}, aspect-ratio set`);
          }
        },
        { once: true }
      );

      // Handle image load failure
      img.addEventListener(
        "error",
        function () {
          // Remove aspect-ratio for minimal error display
          figure.style.aspectRatio = "auto";

          // Replace image with minimal error message
          const errorMessage = document.createElement("span");
          errorMessage.className = "demoImg-error";
          errorMessage.setAttribute("role", "img");
          errorMessage.setAttribute(
            "aria-label",
            this.alt || "Image failed to load"
          );
          errorMessage.textContent = "⚠ Image not found";

          this.replaceWith(errorMessage);
          Logger.warn(`Image failed to load: ${this.src}`);
        },
        { once: true }
      );

      // Check if image is already loaded (cached)
      if (img.complete && img.naturalWidth) {
        figure.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        Logger.debug("Image already cached, aspect-ratio set immediately");
      }
    });
  }

  // Debounce utility
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * Fix WCAG 4.1.2: Ensure aria-hidden elements contain no focusable content
   * MathJax generates mjx-assistive-mml with aria-hidden="true" but these
   * may contain focusable elements which violates accessibility guidelines
   * @param {HTMLElement} container - Container to process
   */
  function fixMathJaxAccessibility(container) {
    if (!container) return;

    // Find all mjx-assistive-mml elements (hidden MathML for screen readers)
    const assistiveMml = container.querySelectorAll("mjx-assistive-mml");
    let fixedCount = 0;

    assistiveMml.forEach((mml) => {
      // Remove tabindex from the container itself
      mml.setAttribute("tabindex", "-1");

      // Find and fix all potentially focusable descendants
      // Must include mjx-container explicitly as MathJax nests these
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

      const focusables = mml.querySelectorAll(focusableSelectors);
      focusables.forEach((el) => {
        // Set tabindex to -1 to remove from tab order
        el.setAttribute("tabindex", "-1");

        // For elements with role="application", also neutralise the role
        // as this role implies interactivity which shouldn't exist in aria-hidden
        if (el.getAttribute("role") === "application") {
          el.setAttribute("role", "presentation");
        }

        fixedCount++;
      });
    });

    if (fixedCount > 0) {
      Logger.debug(
        `[Accessibility] Fixed ${fixedCount} focusable elements in ${assistiveMml.length} mjx-assistive-mml containers`
      );
    }
  }
  /**
   * Protect math blocks from markdown-it processing
   * Prevents plugins like markdown-it-sup from corrupting LaTeX syntax
   * @param {string} text - Raw markdown text
   * @returns {{text: string, mathMap: Map}} Protected text and restoration map
   */
  function protectMathBlocks(text) {
    const mathMap = new Map();
    let counter = 0;

    // Protect display math first ($$...$$) - greedy but non-greedy content
    // Must handle multi-line blocks
    let protectedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
      const placeholder = `%%MATHBLOCK_${counter}%%`;
      mathMap.set(placeholder, match);
      counter++;
      return placeholder;
    });

    // Protect inline math ($...$) - single line, avoid currency like $50
    // Match $ followed by non-space, content, non-space, then $
    // Negative lookbehind for digit (avoid $50) and lookahead for non-digit
    protectedText = protectedText.replace(
      /\$([^\s$](?:[^$]*[^\s$])?)\$/g,
      (match, content) => {
        // Skip if it looks like currency (just digits, commas, periods)
        if (/^[\d,.\s]+$/.test(content)) {
          return match;
        }
        const placeholder = `%%MATHBLOCK_${counter}%%`;
        mathMap.set(placeholder, match);
        counter++;
        return placeholder;
      }
    );

    Logger.debug(`[Math Protection] Protected ${counter} math blocks`);
    return { text: protectedText, mathMap };
  }

  /**
   * Restore protected math blocks after markdown-it processing
   * @param {string} html - Processed HTML
   * @param {Map} mathMap - Map of placeholders to original math content
   * @returns {string} HTML with math blocks restored
   */
  function restoreMathBlocks(html, mathMap) {
    let restoredHtml = html;

    for (const [placeholder, original] of mathMap) {
      // The placeholder might be wrapped in <p> tags, handle that
      restoredHtml = restoredHtml.split(placeholder).join(original);
    }

    Logger.debug(`[Math Protection] Restored ${mathMap.size} math blocks`);
    return restoredHtml;
  }

  // Main render function
  const renderMarkdown = debounce(async function () {
    // Guard: Check if editor is initialized
    if (!state.isInitialized || !elements.markdownInput) {
      Logger.debug("Render called before initialization complete - skipping");
      return;
    }

    if (state.isRendering) return;

    state.isRendering = true;
    LoadingManager.show();

    try {
      const markdownText = elements.markdownInput.value;
      const md = initializeMarkdownIt();

      // Protect math blocks from markdown-it plugins (especially sup)
      const { text: protectedText, mathMap } = protectMathBlocks(markdownText);
      let htmlResult = md.render(protectedText);

      // Restore math blocks after markdown processing
      htmlResult = restoreMathBlocks(htmlResult, mathMap);

      // Enhance header anchors for accessibility
      htmlResult = enhanceHeaderAnchors(htmlResult);
      elements.output.innerHTML = htmlResult;

      // Post-processing
      if (window.Prism) {
        Prism.highlightAllUnder(elements.output);
      }

      if (
        window.MathJax &&
        typeof window.MathJax.typesetPromise === "function"
      ) {
        // Try queue system first for race condition prevention
        if (window.mathJaxManager) {
          const managerStatus = window.mathJaxManager.getStatus();

          if (managerStatus.isHealthy) {
            try {
              await window.mathJaxManager.queueTypeset(elements.output);
              Logger.debug("MathJax rendering via queue system");
            } catch (error) {
              Logger.warn(
                "Queue rendering failed, using direct fallback:",
                error
              );
              // Fallback to direct rendering if queue fails
              await window.MathJax.typesetPromise([elements.output]);
            }
          } else {
            // Manager exists but unhealthy, use direct rendering
            Logger.debug("MathJax Manager unhealthy, using direct rendering");
            await window.MathJax.typesetPromise([elements.output]);
          }
        } else {
          // Manager not available, use direct rendering
          Logger.debug("MathJax Manager not available, using direct rendering");
          await window.MathJax.typesetPromise([elements.output]);
        }

        // Apply MathPix enhancements if available (for cross-mode compatibility)
        if (typeof window.mathPixEnhanceMathJax === "function") {
          Logger.debug(
            "Applying MathPix enhancements to markdown editor output"
          );
          window.mathPixEnhanceMathJax();
        }

        // Fix WCAG 4.1.2: Remove focusability from aria-hidden MathJax elements
        fixMathJaxAccessibility(elements.output);
      }

      // Enhance figure images with aspect-ratio
      enhanceFigureImages(elements.output);

      // Initialize sortable tables
      if (typeof window.initSortableTables === "function") {
        window.initSortableTables();
      }

      NotificationHandler.showSuccess("Content rendered successfully");
      if (config.autoSave) {
        AutoSave.save();
      }
    } catch (error) {
      NotificationHandler.showError("Failed to render markdown", error);
      elements.output.innerHTML =
        '<div class="error-boundary">Rendering failed. Please check the console for details.</div>';
    } finally {
      state.isRendering = false;
      LoadingManager.hide();
      if (window.MarkdownCodeCopy) {
        window.MarkdownCodeCopy.init(elements.output);
      }
    }
  }, config.renderDelay);

  // Event handlers
  function handleKeyboardShortcuts(event) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      renderMarkdown();
    } else if (event.key === "Escape") {
      event.preventDefault();

      // Use async IIFE to handle modal confirm
      (async () => {
        try {
          const confirmed = await window.safeConfirm(
            "Clear all content? This action cannot be undone.",
            "Confirm Clear"
          );

          if (confirmed) {
            elements.markdownInput.value = "";
            AutoSave.clear();
            elements.output.innerHTML = "";
            NotificationHandler.showInfo("Content cleared");
            elements.markdownInput.focus();
          }
        } catch (error) {
          console.error("Modal confirm failed:", error);
          // Fallback to native confirm if modal system fails
          if (confirm("Clear all content?")) {
            elements.markdownInput.value = "";
            AutoSave.clear();
            elements.output.innerHTML = "";
            NotificationHandler.showInfo("Content cleared");
            elements.markdownInput.focus();
          }
        }
      })();
    } else if (event.key === "?") {
      event.preventDefault();
      elements.shortcuts.classList.toggle("visible");
    } else if (event.ctrlKey && event.key === "l") {
      event.preventDefault();
      if (liveMarkdownEditor && liveMarkdownEditor.isReady()) {
        liveMarkdownEditor.toggle();
        const status = liveMarkdownEditor.isEnabled ? "enabled" : "disabled";
        NotificationHandler.showInfo(`Live highlighting ${status}`);
      }
    }
  }

  /**
   * Add accessibility attributes to header anchor links
   */
  function enhanceHeaderAnchors(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const anchors = doc.querySelectorAll(".header-anchor");

    anchors.forEach((anchor) => {
      const heading = anchor.closest("h1, h2, h3, h4, h5, h6");
      if (heading) {
        let headingText = heading.textContent || "";
        headingText = headingText.replace(/[\s\u200B]*$/g, "");
        anchor.setAttribute(
          "aria-label",
          `Direct link to "${headingText}" section`
        );
      }
    });

    return doc.body.innerHTML;
  }

  /**
   * Cleanup live editor for mode switching
   * Called when user switches away from Markdown Editor mode
   */
  function cleanupLiveEditor() {
    if (liveMarkdownEditor && liveMarkdownEditor.isInitialised) {
      Logger.debug("Cleaning up live editor for mode switch");

      try {
        // Sync final content to ensure no data loss
        if (typeof liveMarkdownEditor.syncHiddenInput === "function") {
          liveMarkdownEditor.syncHiddenInput("mode-switch");
        }

        // Clear any pending timeouts to prevent memory leaks
        if (liveMarkdownEditor.updateTimeout) {
          clearTimeout(liveMarkdownEditor.updateTimeout);
          liveMarkdownEditor.updateTimeout = null;
        }
        if (liveMarkdownEditor.blurSyncTimeout) {
          clearTimeout(liveMarkdownEditor.blurSyncTimeout);
          liveMarkdownEditor.blurSyncTimeout = null;
        }

        // Don't destroy the editor, just mark as paused
        Logger.info("Live editor paused for mode switch");
      } catch (error) {
        Logger.error("Error during live editor cleanup:", error);
      }
    } else {
      Logger.debug("No live editor to clean up");
    }
  }

  /**
   * Restore live editor after mode switching
   * Called when user switches back to Markdown Editor mode
   */
  function restoreLiveEditor() {
    if (liveMarkdownEditor && liveMarkdownEditor.isInitialised) {
      Logger.debug("Restoring live editor after mode switch");

      try {
        // Refresh highlighting if enabled
        if (
          liveMarkdownEditor.isEnabled &&
          typeof liveMarkdownEditor.updateHighlighting === "function"
        ) {
          liveMarkdownEditor.updateHighlighting();
        }

        // Re-focus if appropriate
        if (
          liveMarkdownEditor.isEnabled &&
          liveMarkdownEditor.contentEditableElement
        ) {
          // Only focus if markdown editor is visible
          const markdownRadio = document.getElementById("MarkdownEditorRadio");
          if (markdownRadio && markdownRadio.checked) {
            Logger.debug("Restoring focus to live editor");
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
              if (liveMarkdownEditor.contentEditableElement) {
                liveMarkdownEditor.contentEditableElement.focus();
              }
            }, 50);
          }
        }

        Logger.info("Live editor restored successfully");
      } catch (error) {
        Logger.error("Error during live editor restore:", error);
      }
    } else {
      Logger.debug("No live editor to restore");
    }
  }

  /**
   * Setup live highlighting toggle button
   */
  function setupLiveHighlightingToggleButton() {
    const toggleBtn = document.getElementById("toggle-highlighting-btn");
    if (!toggleBtn) {
      Logger.warn("Toggle highlighting button not found");
      return;
    }

    // Guard: Check if already setup
    if (toggleBtn.dataset.liveHighlightingSetup === "true") {
      Logger.debug(
        "Toggle button already configured, skipping duplicate setup"
      );

      // Just update the button state
      function updateButtonState() {
        const stateSpan = document.getElementById("highlighting-state");

        if (liveMarkdownEditor && liveMarkdownEditor.isEnabled) {
          toggleBtn.setAttribute("aria-pressed", "true");
          toggleBtn.classList.add("active");
          if (stateSpan) {
            stateSpan.textContent = "on";
          }
        } else {
          toggleBtn.setAttribute("aria-pressed", "false");
          toggleBtn.classList.remove("active");
          if (stateSpan) {
            stateSpan.textContent = "off";
          }
        }
      }
      updateButtonState();
      return;
    }

    // Mark as setup
    toggleBtn.dataset.liveHighlightingSetup = "true";

    // Update button state and span text
    function updateButtonState() {
      const stateSpan = document.getElementById("highlighting-state");

      if (liveMarkdownEditor && liveMarkdownEditor.isEnabled) {
        toggleBtn.setAttribute("aria-pressed", "true");
        toggleBtn.classList.add("active");
        if (stateSpan) {
          stateSpan.textContent = "on";
        }
      } else {
        toggleBtn.setAttribute("aria-pressed", "false");
        toggleBtn.classList.remove("active");
        if (stateSpan) {
          stateSpan.textContent = "off";
        }
      }
    }

    // Initial state
    updateButtonState();

    // Click handler
    toggleBtn.addEventListener("click", () => {
      if (liveMarkdownEditor && liveMarkdownEditor.isReady()) {
        liveMarkdownEditor.toggle();
        updateButtonState();

        const status = liveMarkdownEditor.isEnabled ? "enabled" : "disabled";
        NotificationHandler.showInfo(`Live highlighting ${status}`);
      } else {
        NotificationHandler.showWarning("Live highlighting not ready yet");
      }
    });

    Logger.debug("Live highlighting toggle button configured");
  }

  // Initialize the application
  function initialize() {
    // Guard against double initialization
    if (state.isInitialized) {
      Logger.debug(
        "Markdown Editor already initialized, skipping duplicate initialization"
      );
      return true;
    }

    // Cache DOM elements
    elements = {
      markdownInput: document.getElementById("markdown-input"),
      renderBtn: document.getElementById("render-btn"),
      clearBtn: document.getElementById("clear-btn"),
      helpBtn: document.getElementById("help-btn"),
      output: document.getElementById("output"),
      loading: document.getElementById("loading-indicator"),
      shortcuts: document.getElementById("keyboard-shortcuts"),
    };

    // Validate required elements (removed status element as it's no longer needed)
    const requiredElements = [
      "markdownInput",
      "renderBtn",
      "clearBtn",
      "helpBtn",
      "output",
      "loading",
      "shortcuts",
    ];

    const missingElements = requiredElements.filter((el) => !elements[el]);

    if (missingElements.length > 0) {
      Logger.error("Missing required DOM elements:", missingElements);

      // Show notification about missing elements
      if (window.UniversalNotifications) {
        NotificationHandler.showError(
          `Missing required DOM elements: ${missingElements.join(", ")}`
        );
      }

      return false;
    }

    // Load saved content
    AutoSave.load();

    // Initialize components
    initializeMathJax();
    initializeMermaid();

    // Initialize live markdown editor if available
    if (window.ContentEditableMarkdownEditor) {
      // Guard: Check if already initialized
      if (
        !window.markdownLiveEditor ||
        !window.markdownLiveEditor.isInitialised
      ) {
        setTimeout(async () => {
          // Double-check after timeout (in case of race condition)
          if (
            window.markdownLiveEditor &&
            window.markdownLiveEditor.isInitialised
          ) {
            Logger.debug(
              "Live editor already initialised, skipping duplicate initialization"
            );
            return;
          }

          // Clean up any existing contenteditable elements (from previous initialization attempts)
          const existingContentEditable = document.getElementById(
            "markdown-input-contenteditable"
          );
          if (existingContentEditable) {
            Logger.debug("Removing existing contenteditable element");
            existingContentEditable.remove();
          }
          const existingHiddenInput = document.getElementById(
            "markdown-input-hidden-sync"
          );
          if (existingHiddenInput) {
            existingHiddenInput.remove();
          }

          liveMarkdownEditor = new window.ContentEditableMarkdownEditor();

          // ⚙️ CONFIGURABLE: Adjust these values as needed
          const success = await liveMarkdownEditor.initialise(
            "markdown-input",
            {
              syncDelay: 150, // Debounce delay (ms)
              maxContentLength: 50000, // Auto-disable threshold (chars) - EASILY ADJUSTABLE
              announceChanges: true, // Screen reader announcements
              enableByDefault: true, // Enabled by default for new users
            }
          );

          if (success) {
            Logger.info("Live markdown syntax highlighting enabled");

            // Setup toggle button
            setupLiveHighlightingToggleButton();

            // Expose for testing
            window.markdownLiveEditor = liveMarkdownEditor;
          } else {
            Logger.warn("Live markdown highlighting initialisation failed");

            // Notify user if initialization fails
            if (window.UniversalNotifications) {
              window.UniversalNotifications.warning(
                "Live syntax highlighting could not be initialised. Editor will function normally without it.",
                { duration: 5000, dismissible: true }
              );
            }
          }
        }, 100); // Small delay to ensure Prism.js fully loaded
      } else {
        Logger.debug("Live markdown editor already initialised");
      }
    } else {
      Logger.warn(
        "ContentEditableMarkdownEditor not available - live highlighting disabled"
      );
    }

    // Event listeners
    elements.renderBtn.addEventListener("click", renderMarkdown);
    elements.clearBtn.addEventListener("click", async () => {
      try {
        const confirmed = await window.safeConfirm(
          "Clear all content? This action cannot be undone.",
          "Confirm Clear"
        );

        if (confirmed) {
          elements.markdownInput.value = "";

          // Also clear live editor if it exists
          if (liveMarkdownEditor && liveMarkdownEditor.isInitialised) {
            liveMarkdownEditor.setContent("");
          }

          AutoSave.clear();
          elements.output.innerHTML = "";
          NotificationHandler.showInfo("Content cleared");

          // Focus the appropriate element
          if (liveMarkdownEditor && liveMarkdownEditor.isEnabled) {
            liveMarkdownEditor.contentEditableElement.focus();
          } else {
            elements.markdownInput.focus();
          }
        }
      } catch (error) {
        console.error("Modal confirm failed:", error);
        // Fallback maintains existing functionality
        if (confirm("Clear all content?")) {
          elements.markdownInput.value = "";

          // Also clear live editor if it exists
          if (liveMarkdownEditor && liveMarkdownEditor.isInitialised) {
            liveMarkdownEditor.setContent("");
          }

          AutoSave.clear();
          elements.output.innerHTML = "";
          NotificationHandler.showInfo("Content cleared");

          // Focus the appropriate element
          if (liveMarkdownEditor && liveMarkdownEditor.isEnabled) {
            liveMarkdownEditor.contentEditableElement.focus();
          } else {
            elements.markdownInput.focus();
          }
        }
      }
    });
    elements.helpBtn.addEventListener("click", () => {
      elements.shortcuts.classList.toggle("visible");
    });
    elements.markdownInput.addEventListener("keydown", handleKeyboardShortcuts);
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        elements.shortcuts.classList.contains("visible")
      ) {
        elements.shortcuts.classList.remove("visible");
      }
    });

    // Auto-save on input
    if (config.autoSave) {
      elements.markdownInput.addEventListener(
        "input",
        debounce(() => {
          AutoSave.save();
        }, config.autoSaveDelay)
      );
    }

    // Initial render if content exists
    if (elements.markdownInput.value) {
      renderMarkdown();
    }

    // Mark as initialized
    state.isInitialized = true;

    Logger.info("Markdown Editor initialised successfully");
    NotificationHandler.showSuccess("Markdown Editor loaded successfully");
    return true;
  }

  // Public API
  return {
    init: initialize,
    render: renderMarkdown,
    clear: function () {
      if (elements.markdownInput) {
        elements.markdownInput.value = "";
        AutoSave.clear();
        elements.output.innerHTML = "";
        NotificationHandler.showInfo("Content cleared");
      }
    },
    // Load markdown content into editor (for examples loader)
    loadContent: function (markdownText) {
      if (elements.markdownInput) {
        elements.markdownInput.value = markdownText;
        renderMarkdown();
        Logger.info("Content loaded into editor");
      } else {
        Logger.error("Cannot load content - editor not initialised");
      }
    },
    // Live highlighting controls
    toggleLiveHighlighting: function () {
      if (liveMarkdownEditor && liveMarkdownEditor.isReady()) {
        return liveMarkdownEditor.toggle();
      }
      Logger.warn("Live editor not ready");
      return false;
    },

    enableLiveHighlighting: function () {
      if (liveMarkdownEditor && liveMarkdownEditor.isReady()) {
        liveMarkdownEditor.enable();
        return true;
      }
      Logger.warn("Live editor not ready");
      return false;
    },

    disableLiveHighlighting: function () {
      if (liveMarkdownEditor && liveMarkdownEditor.isReady()) {
        liveMarkdownEditor.disable();
        return true;
      }
      Logger.warn("Live editor not ready");
      return false;
    },

    getLiveHighlightingStatus: function () {
      if (liveMarkdownEditor) {
        return liveMarkdownEditor.getStatus();
      }
      return { available: false };
    },

    // Mode switching lifecycle hooks
    cleanup: cleanupLiveEditor,
    restore: restoreLiveEditor,

    // Expose logger controls for runtime configuration
    setLogLevel: Logger.setLevel,
    getLogLevel: Logger.getCurrentLevel,
    Logger: Logger,
    // Expose notification handler for external use
    NotificationHandler: NotificationHandler,
  };
})();
// Make MarkdownEditor globally available
window.MarkdownEditor = MarkdownEditor;

// Expose mode switching functions globally for boilerplate.html integration
window.markdownEditorCleanup = function () {
  if (
    window.MarkdownEditor &&
    typeof window.MarkdownEditor.cleanup === "function"
  ) {
    window.MarkdownEditor.cleanup();
  }
};

window.markdownEditorRestore = function () {
  if (
    window.MarkdownEditor &&
    typeof window.MarkdownEditor.restore === "function"
  ) {
    window.MarkdownEditor.restore();
  }
};

// Expose live editor for testing (set in initialize function)
// Access via: window.markdownLiveEditor
