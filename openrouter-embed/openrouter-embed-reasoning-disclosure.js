/**
 * OpenRouter Embed API - Reasoning Disclosure Component (Reasoning Disclosure Task 3)
 *
 * A reusable, DOM-free-until-mounted disclosure widget for displaying a model's
 * reasoning summary as collapsed, on-demand content beneath the main answer.
 *
 * - Renders accumulated reasoning text as markdown (markdown-it, with a
 *   MarkdownEditor.md fallback and an escaped-<pre> floor), mirroring core's
 *   processMarkdownWithFallback (never calls the debounced MarkdownEditor.render()).
 * - Stays hidden AND collapsed until reasoning text actually arrives (D2/D3).
 * - Demotes any h1-h6 in the rendered summary to bold paragraphs so the summary
 *   never disturbs the page heading outline (D5).
 * - Native <details>/<summary> provide keyboard focus and the UA focus outline;
 *   no aria-live (this is collapsed on-demand content, not a live region).
 * - Full WCAG 2.2 AA: native semantics first, no removed focus outline.
 *
 * @version 1.0.0 (Reasoning Disclosure Task 3)
 * @date 16 June 2026
 */
(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[EmbedReasoningDisclosure] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedReasoningDisclosure] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedReasoningDisclosure] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedReasoningDisclosure] ${message}`, ...args);
  }

  // ============================================================================
  // REASONING DISCLOSURE CLASS
  // ============================================================================

  class EmbedReasoningDisclosure {
    /**
     * Create a disclosure component.
     *
     * The constructor is DOM-free so the singleton is valid while unmounted.
     * All mutators (appendReasoning/setReasoning/reset/setOpen) no-op-with-warn
     * until mount() has been called.
     */
    constructor() {
      this.container = null;
      this.detailsEl = null;
      this.bodyEl = null;
      this.text = "";
      this._mdInstance = null;
    }

    /**
     * Mount the disclosure into a container.
     *
     * @param {HTMLElement|string} container - Element or element id.
     * @param {Object} [options] - Configuration.
     * @param {string} [options.label="Reasoning"] - Summary label text.
     * @param {boolean} [options.open=false] - Start expanded (only honoured if
     *   text is already present).
     * @returns {EmbedReasoningDisclosure} this
     */
    mount(container, options = {}) {
      // Resolve container: accept an HTMLElement or an id string.
      let resolved = container;
      if (typeof container === "string") {
        resolved = document.getElementById(container);
      }
      if (!resolved || typeof resolved.appendChild !== "function") {
        logWarn("mount(): container not found", container);
        return this;
      }

      const label =
        typeof options.label === "string" && options.label.length > 0
          ? options.label
          : "Reasoning";

      // Build the DOM with createElement (not innerHTML string-building).
      const details = document.createElement("details");
      details.className = "embed-reasoning-disclosure";
      // Collapsed AND hidden until text arrives (D2/D3).
      details.hidden = true;
      details.open = false;
      // Minimal inline styling only — no <style> block, no transitions.
      details.style.marginTop = "0.75rem";

      const summary = document.createElement("summary");
      summary.className = "embed-reasoning-disclosure__summary";
      summary.textContent = label;
      // Native <summary> keyboard focus + UA focus outline provide WCAG 2.2 AA
      // focus visibility; do NOT remove the outline.

      const body = document.createElement("div");
      body.className = "embed-reasoning-disclosure__body";
      // Subtle left border + padding to distinguish the reasoning block.
      body.style.padding = "0.5rem 0.75rem";
      body.style.marginTop = "0.5rem";
      body.style.borderLeft = "3px solid rgba(127, 127, 127, 0.4)";

      details.appendChild(summary);
      details.appendChild(body);

      // Store refs and append to container.
      this.container = resolved;
      this.detailsEl = details;
      this.bodyEl = body;
      resolved.appendChild(details);

      // Honour options.open === true only if there is already text.
      if (options.open === true && this.text.trim() !== "") {
        details.open = true;
      }

      // Render whatever text may already exist (so a pre-mount setReasoning
      // followed by mount() shows correctly).
      this._render();

      logDebug("mount(): mounted disclosure", { label, open: details.open });
      return this;
    }

    /**
     * Append reasoning text to the accumulated buffer and re-render.
     *
     * @param {string} text - Text delta to append.
     */
    appendReasoning(text) {
      if (!this.detailsEl) {
        logWarn("appendReasoning(): not mounted");
        return;
      }
      if (typeof text === "string") {
        this.text += text;
      }
      this._render();
    }

    /**
     * Replace the reasoning buffer and re-render.
     *
     * @param {string} text - Full reasoning text (non-strings clear the buffer).
     */
    setReasoning(text) {
      if (!this.detailsEl) {
        logWarn("setReasoning(): not mounted");
        return;
      }
      this.text = typeof text === "string" ? text : "";
      this._render();
    }

    /**
     * Clear the buffer and return the disclosure to its hidden, collapsed state.
     */
    reset() {
      this.text = "";
      if (this.detailsEl) {
        this.bodyEl.innerHTML = "";
        this.detailsEl.hidden = true;
        this.detailsEl.open = false;
      }
    }

    /**
     * Expand or collapse the disclosure.
     *
     * @param {boolean} isOpen - Whether to expand.
     */
    setOpen(isOpen) {
      if (this.detailsEl) {
        this.detailsEl.open = !!isOpen;
      }
    }

    // ========================================================================
    // PRIVATE
    // ========================================================================

    /**
     * Render the accumulated buffer into the body, or hide when empty.
     *
     * @private
     */
    _render() {
      if (this.text.trim() === "") {
        this.detailsEl.hidden = true;
        this.bodyEl.innerHTML = "";
        return;
      }
      this.detailsEl.hidden = false;
      this.bodyEl.innerHTML = this._demoteHeadings(
        this._renderMarkdown(this.text)
      );
    }

    /**
     * Render markdown to an HTML string, mirroring core's
     * processMarkdownWithFallback. NEVER calls MarkdownEditor.render() (it is
     * debounced and returns undefined).
     *
     * @param {string} md - Markdown source.
     * @returns {string} HTML string.
     * @private
     */
    _renderMarkdown(md) {
      try {
        // Priority 1: markdown-it directly (most reliable for returning HTML).
        // html:true mirrors core's main-answer rendering; the summary comes from
        // the same trusted model.
        if (typeof window.markdownit === "function") {
          if (!this._mdInstance) {
            this._mdInstance = window.markdownit({
              html: true,
              breaks: true,
              linkify: true,
              typographer: true,
            });
            logDebug("Created markdown-it instance for reasoning disclosure");
          }
          const html = this._mdInstance.render(md);
          if (html && typeof html === "string") {
            return html;
          }
        }
      } catch (error) {
        logWarn("markdown-it render failed, trying fallback", error);
      }

      try {
        // Priority 2: MarkdownEditor's markdown-it instance (NOT .render()).
        if (
          window.MarkdownEditor?.md &&
          typeof window.MarkdownEditor.md.render === "function"
        ) {
          const html = window.MarkdownEditor.md.render(md);
          if (html && typeof html === "string") {
            return html;
          }
        }
      } catch (error) {
        logWarn("MarkdownEditor.md render failed, using floor", error);
      }

      // Floor: escaped plain text.
      return `<pre>${this._escapeHtml(md)}</pre>`;
    }

    /**
     * Demote any h1-h6 in the rendered HTML to bold paragraphs so the reasoning
     * summary never enters the document heading outline (D5).
     *
     * @param {string} html - HTML string.
     * @returns {string} HTML string with headings demoted.
     * @private
     */
    _demoteHeadings(html) {
      const el = document.createElement("div");
      el.innerHTML = html;

      const headings = el.querySelectorAll("h1,h2,h3,h4,h5,h6");
      headings.forEach((heading) => {
        const p = document.createElement("p");
        p.className = "embed-reasoning-disclosure__heading";
        const strong = document.createElement("strong");
        // Preserve inline links/emphasis from the original heading.
        strong.innerHTML = heading.innerHTML;
        // Small inline font-size bump to keep some visual prominence.
        strong.style.fontSize = "1.05em";
        p.appendChild(strong);
        heading.replaceWith(p);
      });

      return el.innerHTML;
    }

    /**
     * Escape HTML special characters (mirrors core's escapeHtml).
     *
     * @param {string} s - Raw string.
     * @returns {string} Escaped string.
     * @private
     */
    _escapeHtml(s) {
      const div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.EmbedReasoningDisclosureClass = EmbedReasoningDisclosure;
  window.EmbedReasoningDisclosure = new EmbedReasoningDisclosure();

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo(
    "OpenRouter Embed Reasoning Disclosure (Reasoning Disclosure Task 3) loaded"
  );
  logInfo("Available class: EmbedReasoningDisclosureClass");
  logInfo("Available singleton: EmbedReasoningDisclosure");
})();
