/**
 * Markdown Page Loader
 * Fetches and renders markdown content into a target element
 *
 * Since 2.0.0 this is a thin wrapper over window.MarkdownRenderCore, the one
 * shared markdown pipeline the Markdown Editor also uses. The loader fetches,
 * shows the loading and error states and scrolls to the URL fragment; the core
 * renders. Where the loader differs from the editor it says so through the
 * named options in LOADER_OPTIONS, never a copy of the pipeline.
 *
 * Usage: Add data-markdown-src attribute to <main> element
 * Example: <main data-markdown-src="content/about.md">Loading...</main>
 *
 * Since 2.1.0 (MRC-77) the loader loads the core itself when a page has not:
 * if window.MarkdownRenderCore is absent at render time it injects one <script>
 * for markdown-render-core.js, resolved from THIS file's own URL (so a page in
 * any folder finds it), waits for it once, then renders. Pages written before
 * the core existed (they carry only this loader) therefore keep rendering
 * after the loader is republished. A page that already loads the core loads
 * it once, as before.
 *
 * Needs (for maths): js/math-protect.js and a MathJax configuration, as before.
 *
 * @author Matthew Deeprose
 * @version 2.1.0
 */

const MarkdownPageLoader = (function () {
  'use strict';

  // Captured while this file runs: document.currentScript is null afterwards.
  const OWN_SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const CORE_FILE_NAME = 'markdown-render-core.js';

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

  const VERSION = '2.1.0';

  // Where a loader page differs from the editor. Every other behaviour is the core's default (the editor's).
  // mermaidDefaults are the editor's own values: a null width reaches applyDiagramSize as the string "null%", the browser drops it,
  // and every diagram then fills the column (667 px instead of its natural 289 px). MRC-3b found the cause, MRC-4 the fix.
  // MermaidControls is left out of containerInit on purpose (MRC-6, MRC-7). Its init adds the theme selector, which starts a themed render,
  // and the core's own deferred plain render then replaced it, so dark diagrams were drawn in Mermaid's default palette (arrows 1.14:1).
  // The core's render .then adds the controls instead, after its plain render, as on the editor page, so the themed render lands last.
  const LOADER_OPTIONS = Object.freeze({
    anchorStyle: 'after',
    mermaidDefaults: Object.freeze({ width: 70, height: 100, lockAspectRatio: false }),
    figureRole: true,
    tocSlugMatchesAnchor: true, // MRC-8: contents links match heading ids
    longInlineMathScrolls: true, // MRC-20: a long inline equation scrolls inside itself; equations that fit do not change
    containerInit: Object.freeze(['ChartViewControls', 'MermaidViewControls', 'MermaidAccessibility'])
  });

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
   * Scroll to the element named in the URL fragment, if there is one.
   * The browser tries this itself on page load, but the markdown has not
   * rendered by then, so the target does not exist and the jump fails.
   * Focus moves to the target as well, so keyboard and screen reader users
   * land in the same place as the visual scroll.
   */
  function scrollToHash() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) {
      logDebug('No URL fragment, nothing to scroll to');
      return;
    }

    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch (error) {
      logWarn('Could not decode the URL fragment:', hash, error);
      return;
    }

    const target = document.getElementById(id);
    if (!target) {
      logWarn('URL fragment target not found:', id);
      return;
    }

    // Headings from markdown-it-anchor already have tabindex="-1"; add it
    // to any other target so it can take focus without joining the tab order
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }

    // Wait one frame so the rendered content has laid out
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
      logInfo('Scrolled to URL fragment target:', id);
    });
  }

  // One shared promise, so two articles on a page load the core once.
  let corePromise = null;

  /**
   * Make sure window.MarkdownRenderCore exists, loading it beside this file when
   * the page has not. The core is resolved from the loader's own URL.
   * @returns {Promise<object>} The core
   */
  function ensureCore() {
    if (window.MarkdownRenderCore) {
      return Promise.resolve(window.MarkdownRenderCore);
    }
    if (corePromise) {
      return corePromise;
    }

    corePromise = new Promise((resolve, reject) => {
      if (!OWN_SCRIPT_SRC) {
        reject(new Error('MarkdownRenderCore is not loaded and the loader could not work out where to find it'));
        return;
      }

      const coreUrl = new URL(CORE_FILE_NAME, OWN_SCRIPT_SRC).href;
      logInfo('MarkdownRenderCore not loaded by the page, loading', coreUrl);

      const script = document.createElement('script');
      script.src = coreUrl;
      script.onload = () => {
        if (window.MarkdownRenderCore) {
          resolve(window.MarkdownRenderCore);
        } else {
          corePromise = null;
          reject(new Error(`Loaded ${coreUrl} but it did not provide MarkdownRenderCore`));
        }
      };
      script.onerror = () => {
        corePromise = null;
        reject(new Error(`MarkdownRenderCore could not be loaded from ${coreUrl}`));
      };
      document.head.appendChild(script);
    });

    return corePromise;
  }

  /**
   * Render markdown content to target element through the shared core
   * @param {string} markdownText - Raw markdown text
   * @param {HTMLElement} target - Target element
   */
  async function renderToElement(markdownText, target) {
    try {
      const core = await ensureCore();

      target.innerHTML = core.render(markdownText, LOADER_OPTIONS);
      await core.postProcess(target, LOADER_OPTIONS);

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
    logDebug('init() called, readyState:', document.readyState);

    if (state.isInitialised) {
      logWarn('Already initialised, skipping');
      return;
    }

    logInfo('Initialising Markdown Page Loader');

    // Find target element
    state.targetElement = document.querySelector(config.targetSelector);
    logDebug('Target element:', state.targetElement);

    if (!state.targetElement) {
      logWarn('No target element found with selector:', config.targetSelector);
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
    state.targetElement.innerHTML = config.loadingMessage;

    try {
      // Fetch markdown
      const markdownText = await fetchMarkdown(state.markdownSource);

      // Render content
      await renderToElement(markdownText, state.targetElement);

      state.isInitialised = true;

      // Jump to the URL fragment now that the headings exist
      scrollToHash();

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
    scrollToHash: scrollToHash,

    // Expose for testing
    getState: function () {
      return { ...state };
    },

    // Version info
    version: VERSION
  };
})();

// Make globally available
window.MarkdownPageLoader = MarkdownPageLoader;
