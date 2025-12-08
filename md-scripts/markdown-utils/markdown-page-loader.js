/**
 * Markdown Page Loader
 * Fetches and renders markdown content into a target element
 * 
 * Usage: Add data-markdown-src attribute to <main> element
 * Example: <main data-markdown-src="content/about.md">Loading...</main>
 * 
 * @author Matthew Deeprose
 * @version 1.0.0
 */

const MarkdownPageLoader = (function () {
  'use strict';

  // Logging configuration
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[MarkdownPageLoader]', message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[MarkdownPageLoader]', message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[MarkdownPageLoader]', message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[MarkdownPageLoader]', message, ...args);
  }

  // Configuration
  const config = {
    targetSelector: '[data-markdown-src]',
    loadingMessage: '<p class="markdown-loading" role="status" aria-live="polite">Loading content…</p>',
    errorTemplate: (src, message) => `
      <div class="markdown-load-error" role="alert">
        <h2>Unable to Load Content</h2>
        <p>The markdown file could not be loaded:</p>
        <p><code>${escapeHtml(src)}</code></p>
        <p><strong>Error:</strong> ${escapeHtml(message)}</p>
        <p>Please check that the file exists and the path is correct.</p>
      </div>
    `
  };

  // State
  const state = {
    isInitialised: false,
    targetElement: null,
    markdownSource: null
  };

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Initialise markdown-it with all plugins
   * Mirrors the configuration from markdown-editor.js
   * @returns {Object} Configured markdown-it instance
   */
  function initializeMarkdownIt() {
    if (!window.markdownit) {
      throw new Error('markdown-it library not loaded');
    }

    const md = window.markdownit({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && window.Prism && Prism.languages[lang]) {
          try {
            return (
              '<pre class="language-' + lang + '"><code>' +
              Prism.highlight(str, Prism.languages[lang], lang) +
              '</code></pre>'
            );
          } catch (err) {
            logWarn('Syntax highlighting failed for ' + lang, err);
          }
        }
        return (
          '<pre class="language-none"><code>' +
          md.utils.escapeHtml(str) +
          '</code></pre>'
        );
      }
    });

    // Add enhanced sortable table functionality
    if (window.sortableTablesEnhanced && window.sortableTablesEnhanced.markdownItPlugin) {
      md.use(window.sortableTablesEnhanced.markdownItPlugin);
      logDebug('Enhanced sortable tables plugin loaded');
    }

    // Process tables and escape dollar signs in cells
    md.core.ruler.push('escape_table_dollars', function (state) {
      const tokens = state.tokens;
      let inTable = false;
      let inTableCell = false;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'table_open') {
          inTable = true;
        } else if (token.type === 'table_close') {
          inTable = false;
        } else if (inTable && (token.type === 'th_open' || token.type === 'td_open')) {
          inTableCell = true;
        } else if (inTable && (token.type === 'th_close' || token.type === 'td_close')) {
          inTableCell = false;
        } else if (inTable && inTableCell && token.type === 'text') {
          if (token.content.includes('$')) {
            token.content = token.content.replace(/\$/g, '<span class="currency">$</span>');
          }
        }
      }
      return true;
    });

    // Add custom rule to modify definition lists
    md.core.ruler.push('add_deflist_class', function (state) {
      const tokens = state.tokens;

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'dl_open') {
          if (!tokens[i].attrs) {
            tokens[i].attrs = [];
          }

          let classAttrIndex = -1;
          for (let j = 0; j < tokens[i].attrs.length; j++) {
            if (tokens[i].attrs[j][0] === 'class') {
              classAttrIndex = j;
              break;
            }
          }

          if (classAttrIndex === -1) {
            tokens[i].attrs.push(['class', 'definition-list']);
          } else {
            tokens[i].attrs[classAttrIndex][1] += ' definition-list';
          }
        }
      }
      return true;
    });

    // Enable tables by default
    md.enable('table');

    // Plugin list - matching markdown-editor.js
    const plugins = [
      { name: 'sub', plugin: window.markdownitSub },
      { name: 'sup', plugin: window.markdownitSup },
      { name: 'footnote', plugin: window.markdownitFootnote },
      { name: 'deflist', plugin: window.markdownitDeflist },
      { name: 'abbr', plugin: window.markdownitAbbr },
      { name: 'emoji', plugin: window.markdownitEmoji },
      { name: 'ins', plugin: window.markdownitIns },
      { name: 'mark', plugin: window.markdownitMark },
      { name: 'container', plugin: window.markdownitContainer },
      { name: 'anchor', plugin: window.markdownItAnchor },
      { name: 'toc', plugin: window.markdownItTocDoneRight },
      { name: 'attrs', plugin: window.markdownitAttrs },
      { name: 'multimd-table', plugin: window.markdownitMultimdTable },
      { name: 'implicit-figures', plugin: window.markdownitImplicitFigures },
      { name: 'tab', plugin: window.markdownitTab }
    ];

    plugins.forEach(({ name, plugin }) => {
      if (plugin) {
        try {
          if (name === 'container') {
            md.use(plugin, 'info').use(plugin, 'warning').use(plugin, 'danger');
          } else if (name === 'anchor') {
            md.use(plugin, {
              permalink: plugin.permalink.linkInsideHeader({
                class: 'header-anchor',
                symbol: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
                placement: 'after',
                space: true,
                ariaHidden: false
              }),
              slugify: function (s) {
                return String(s)
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^\w\-]+/g, '')
                  .replace(/\-\-+/g, '-')
                  .replace(/^-+/, '')
                  .replace(/-+$/, '');
              }
            });
          } else if (name === 'toc') {
            md.use(plugin, {
              containerClass: 'toc',
              listType: 'ul',
              level: [1, 2, 3]
            });
          } else if (name === 'attrs') {
            md.use(plugin, {
              allowedAttributes: ['id', 'class', 'style', 'width', 'height', 'alt']
            });
          } else if (name === 'implicit-figures') {
            md.use(plugin, {
              figcaption: true,
              dataType: false,
              tabindex: false,
              copyAttrs: false
            });
          } else if (name === 'tab') {
            md.use(plugin, {
              name: 'tabs'
            });
          } else {
            md.use(plugin);
          }
          logDebug('Plugin loaded:', name);
        } catch (error) {
          logWarn('Failed to load plugin:', name, error);
        }
      } else {
        logDebug('Plugin not available:', name);
      }
    });

    // Setup task lists
    setupTaskLists(md);

    // Setup chart and mermaid fence renderer
    setupFenceRenderer(md);

    return md;
  }

  /**
   * Setup custom task list rendering
   * @param {Object} md - markdown-it instance
   */
  function setupTaskLists(md) {
    const originalListItemOpen = md.renderer.rules.list_item_open || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const nextToken = tokens[idx + 1];

      if (nextToken && nextToken.type === 'paragraph_open') {
        const inlineToken = tokens[idx + 2];
        if (inlineToken && inlineToken.type === 'inline' && inlineToken.content) {
          const content = inlineToken.content;
          const checkboxMatch = content.match(/^\[([ xX])\]\s*/);

          if (checkboxMatch) {
            const isChecked = checkboxMatch[1].toLowerCase() === 'x';
            const checkboxId = 'task-' + Math.random().toString(36).substring(2, 11);
            const remainingContent = content.substring(checkboxMatch[0].length);

            inlineToken.content = '';
            inlineToken.children = [];

            token.attrJoin('class', 'task-list-item');
            if (isChecked) {
              token.attrJoin('class', 'task-complete');
            }

            return '<li class="task-list-item' + (isChecked ? ' task-complete' : '') + '">' +
              '<input type="checkbox" class="task-list-checkbox" id="' + checkboxId + '"' +
              (isChecked ? ' checked' : '') + ' disabled aria-label="Task item">' +
              '<label for="' + checkboxId + '" class="task-list-label">' + md.renderInline(remainingContent) + '</label>';
          }
        }
      }

      return originalListItemOpen(tokens, idx, options, env, self);
    };
  }

  /**
   * Setup fence renderer for charts and mermaid
   * @param {Object} md - markdown-it instance
   */
  function setupFenceRenderer(md) {
    const originalFence = md.renderer.rules.fence || function (tokens, idx, options, env, slf) {
      return '<pre><code>' + md.utils.escapeHtml(tokens[idx].content) + '</code></pre>';
    };

    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
      const token = tokens[idx];
      const code = token.content.trim();
      const info = token.info.trim();

      if (info === 'chart') {
        return renderChart(code);
      } else if (info === 'mermaid' && window.mermaid) {
        return renderMermaid(code);
      }

      return originalFence(tokens, idx, options, env, slf);
    };
  }

  /**
   * Render a Chart.js chart
   * @param {string} code - JSON chart configuration
   * @returns {string} HTML for chart container
   */
  function renderChart(code) {
    try {
      const chartData = JSON.parse(code);
      const chartId = 'chart-' + Math.random().toString(36).substring(2, 15);

      setTimeout(() => {
        try {
          const canvas = document.getElementById(chartId);
          if (canvas && window.Chart) {
            new Chart(canvas, chartData);

            if (window.ChartControls && typeof window.ChartControls.addControlsToContainer === 'function') {
              const container = canvas.closest('.chart-container');
              if (container) {
                window.ChartControls.addControlsToContainer(container, chartId);
              }
            }
          }
        } catch (err) {
          logError('Chart rendering failed', err);
        }
      }, 0);

      return `<div class="chart-container" aria-label="Chart" role="figure" data-chart-code="${encodeURIComponent(code)}">
        <canvas id="${chartId}" aria-label="Chart visualisation"></canvas>
      </div>`;
    } catch (error) {
      logError('Invalid chart JSON', error);
      return `<div class="chart-error" role="alert">
        <p>Chart Error: Invalid JSON configuration</p>
        <pre><code>${escapeHtml(code)}</code></pre>
      </div>`;
    }
  }

  /**
   * Render a Mermaid diagram
   * @param {string} code - Mermaid diagram definition
   * @returns {string} HTML for mermaid container
   */
  function renderMermaid(code) {
    const mermaidId = 'mermaid-diagram-' + Math.random().toString(36).substring(2, 15);
    const cleanCode = code.trim();

    setTimeout(async () => {
      try {
        const element = document.getElementById(mermaidId);
        if (element && window.mermaid) {
          const { svg } = await mermaid.render(mermaidId + '-svg', cleanCode);
          element.innerHTML = svg;

          // Apply saved diagram preferences if MermaidControls is available
          if (window.MermaidControls && typeof window.MermaidControls.utils === 'object') {
            const savedWidth = window.MermaidControls.utils.getSavedPreference('mermaid-diagram-width', null);
            const savedHeight = window.MermaidControls.utils.getSavedPreference('mermaid-diagram-height', null);
            const lockAspectRatio = window.MermaidControls.utils.getSavedPreference('mermaid-lock-aspect-ratio', true);

            if (typeof window.MermaidControls.applyDiagramSize === 'function') {
              window.MermaidControls.applyDiagramSize(element, savedWidth, savedHeight, lockAspectRatio);
            }
          }

          // Add controls to container
          if (window.MermaidControls && typeof window.MermaidControls.addControlsToContainer === 'function') {
            const container = element.closest('.mermaid-container');
            if (container) {
              window.MermaidControls.addControlsToContainer(container, mermaidId.split('-').pop());
            }
          }
        }
      } catch (err) {
        logError('Mermaid rendering failed', err);
        const element = document.getElementById(mermaidId);
        if (element) {
          element.innerHTML = `<div class="mermaid-error" role="alert">
            <p>Diagram Error: ${escapeHtml(err.message || 'Failed to render diagram')}</p>
          </div>`;
        }
      }
    }, 0);

    return `<div class="mermaid-container" aria-label="Diagram" role="figure" data-diagram-code="${encodeURIComponent(cleanCode)}">
      <div id="${mermaidId}" class="mermaid">${cleanCode}</div>
    </div>`;
  }

  /**
   * Enhance header anchors for accessibility
   * @param {string} html - Rendered HTML
   * @returns {string} Enhanced HTML
   */
  function enhanceHeaderAnchors(html) {
    return html.replace(
      /<a class="header-anchor"([^>]*)>/g,
      '<a class="header-anchor" aria-label="Link to this section"$1>'
    );
  }

  /**
   * Fetch markdown content from URL
   * @param {string} src - URL of markdown file
   * @returns {Promise<string>} Markdown content
   */
  async function fetchMarkdown(src) {
    logInfo('Fetching markdown from:', src);

    const response = await fetch(src);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('text/') && !contentType.includes('markdown')) {
      logWarn('Unexpected content type:', contentType);
    }

    return await response.text();
  }

  /**
   * Run post-processing on rendered content
   * @param {HTMLElement} container - Container element
   */
  async function runPostProcessing(container) {
    logDebug('Running post-processing');

    // Syntax highlighting with Prism
    if (window.Prism) {
      Prism.highlightAllUnder(container);
      logDebug('Prism highlighting complete');
    }

    // MathJax typesetting
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      try {
        await window.MathJax.typesetPromise([container]);
        logDebug('MathJax typesetting complete');
      } catch (err) {
        logWarn('MathJax typesetting failed', err);
      }
    }

    // Sortable tables
    if (typeof window.initSortableTables === 'function') {
      window.initSortableTables();
      logDebug('Sortable tables initialised');
    }

    // Code copy buttons
    if (window.MarkdownCodeCopy && typeof window.MarkdownCodeCopy.init === 'function') {
      window.MarkdownCodeCopy.init(container);
      logDebug('Code copy buttons added');
    }

    // Chart view controls (fullscreen, expand width buttons)
    if (window.ChartViewControls && typeof window.ChartViewControls.init === 'function') {
      window.ChartViewControls.init(container);
      logDebug('Chart view controls initialised');
    }

    // Mermaid view controls (fullscreen, expand width buttons)
    if (window.MermaidViewControls && typeof window.MermaidViewControls.init === 'function') {
      window.MermaidViewControls.init(container);
      logDebug('Mermaid view controls initialised');
    }

    // Mermaid controls (theme, pan/zoom)
    if (window.MermaidControls && typeof window.MermaidControls.init === 'function') {
      window.MermaidControls.init(container);
      logDebug('Mermaid controls initialised');
    }

    // Mermaid accessibility (descriptions, figure wrapper, export buttons)
    if (window.MermaidAccessibility && typeof window.MermaidAccessibility.init === 'function') {
      window.MermaidAccessibility.init(container);
      logDebug('Mermaid accessibility initialised');
    }
  }

  /**
   * Render markdown content to target element
   * @param {string} markdownText - Raw markdown text
   * @param {HTMLElement} target - Target element
   */
  async function renderToElement(markdownText, target) {
    try {
      const md = initializeMarkdownIt();
      let htmlResult = md.render(markdownText);

      // Enhance header anchors
      htmlResult = enhanceHeaderAnchors(htmlResult);

      // Insert content
      target.innerHTML = htmlResult;

      // Run post-processing
      await runPostProcessing(target);

      logInfo('Markdown rendered successfully');
    } catch (error) {
      logError('Rendering failed', error);
      throw error;
    }
  }

  /**
   * Main initialisation function
   * Called automatically on DOMContentLoaded
   */
  async function init() {
    console.log('[MarkdownPageLoader] init() called, readyState:', document.readyState);
    
    if (state.isInitialised) {
      logWarn('Already initialised, skipping');
      return;
    }

    logInfo('Initialising Markdown Page Loader');

    // Find target element
    state.targetElement = document.querySelector(config.targetSelector);
    console.log('[MarkdownPageLoader] Target element:', state.targetElement);

    if (!state.targetElement) {
      console.warn('[MarkdownPageLoader] No target element found with selector:', config.targetSelector);
      return;
    }

    // Get markdown source
    state.markdownSource = state.targetElement.dataset.markdownSrc;

    if (!state.markdownSource) {
      logError('No markdown source specified in data-markdown-src attribute');
      state.targetElement.innerHTML = config.errorTemplate('(not specified)', 'No markdown source URL provided');
      return;
    }

    // Show loading state
    const originalContent = state.targetElement.innerHTML;
    state.targetElement.innerHTML = config.loadingMessage;

    try {
      // Fetch markdown
      const markdownText = await fetchMarkdown(state.markdownSource);

      // Render content
      await renderToElement(markdownText, state.targetElement);

      state.isInitialised = true;

    } catch (error) {
      logError('Failed to load markdown', error);
      state.targetElement.innerHTML = config.errorTemplate(
        state.markdownSource,
        error.message || 'Unknown error'
      );
    }
  }

  /**
   * Manually reload content
   * @param {string} [newSrc] - Optional new source URL
   */
  async function reload(newSrc) {
    if (newSrc) {
      state.markdownSource = newSrc;
      if (state.targetElement) {
        state.targetElement.dataset.markdownSrc = newSrc;
      }
    }

    state.isInitialised = false;
    await init();
  }

  // Auto-initialise with multiple fallback strategies
  function autoInit() {
    // Try to init - if element not found, it might not be parsed yet
    if (document.querySelector(config.targetSelector)) {
      init();
    } else {
      // Element not found yet, wait for full DOM
      console.warn('[MarkdownPageLoader] Target element not found, waiting for DOM...');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        // DOM should be ready but element not found - try again after a tick
        setTimeout(init, 0);
      }
    }
  }

  // Run auto-init when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else if (document.readyState === 'interactive') {
    // DOM parsed but might still be processing - use setTimeout
    setTimeout(init, 0);
  } else {
    // Complete - run immediately
    init();
  }

  // Public API
  return {
    init: init,
    reload: reload,
    renderToElement: renderToElement,
    
    // Expose for testing
    getState: function () {
      return { ...state };
    },
    
    // Version info
    version: '1.0.0'
  };
})();

// Make globally available
window.MarkdownPageLoader = MarkdownPageLoader;
