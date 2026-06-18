/**
 * OpenRouter Embed - Provider Mismatch Notice (Stage 3a, Task 3.2a)
 *
 * Library-agnostic helper that renders an inline notice + one-click switch
 * button when a tool's active provider doesn't satisfy its capability
 * requirements. Consumed by tools that need to surface "switch provider to
 * use this feature" UX consistently.
 *
 * Public API:
 *   ProviderMismatchNotice.render(containerElement, options) -> boolean
 *
 * Behaviour on button click:
 *   1. Call ProviderSwitcher.setActive(alternativeProvider)
 *      (which synchronously dispatches 'provider:changed' on window)
 *   2. If options.focusAfterSwitch is set, focus the target element
 *      (the consumer's provider:changed handler is responsible for clearing
 *       the notice container and repopulating the dropdown that gets focused)
 *
 * Does NOT depend on:
 * - window.OpenRouterEmbed
 * - window.EmbedProviderRegistry / EmbedProviderLookup
 * - window.EmbedEventEmitter
 *
 * Only dependency: window.ProviderSwitcher (Task 3.1a).
 *
 * @version 1.0.0 (Stage 3a, Task 3.2a)
 * @date 17 May 2026
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[ProviderMismatchNotice ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ProviderMismatchNotice WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ProviderMismatchNotice INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ProviderMismatchNotice DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // MODULE CONSTANTS
  // ============================================================================

  // Maps internal capability ids to human-readable labels used in notice text.
  // Unknown ids fall back to the raw string in the rendered notice.
  // Extend here as new capabilities are introduced.
  const CAPABILITY_LABELS = {
    images: "image inputs",
    pdf: "PDF inputs",
    streaming: "streaming responses",
    reasoning: "extended reasoning",
    toolCalls: "tool calling",
  };

  // Generic fallback used when `requiredCapabilities` is missing or empty.
  // Phrased to flow naturally into the notice template's surrounding prose.
  const GENERIC_CAPABILITY_FALLBACK = "the required capability";

  // Class names — semantic only. Visual styling lands in a separate CSS task
  // (see Task 3.2a closing-handoff side-finding about the CSS gap).
  const NOTICE_CLASS = "provider-mismatch-notice";
  const NOTICE_TEXT_CLASS = "provider-mismatch-notice-text";
  const NOTICE_BUTTON_CLASS = "provider-mismatch-notice-button";

  // Accessibility-critical inline styles. Applied directly to elements as
  // defence-in-depth so the WCAG 2.2 AA touch-target requirement holds even
  // before the project CSS lands. Everything else (colours, borders, padding)
  // is class-name only and waits on the CSS task.
  const BUTTON_MIN_HEIGHT = "44px";
  const BUTTON_MIN_WIDTH = "44px";

  // ============================================================================
  // PROVIDER MISMATCH NOTICE CLASS
  // ============================================================================

  class ProviderMismatchNotice {
    constructor() {
      logInfo("ProviderMismatchNotice initialised");
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * Look up the human-readable label for a provider id via
     * ProviderSwitcher.getKnown(). Returns the id itself if no match is found
     * — this is defensive only; render()'s validation should have rejected
     * unknown ids before we get here.
     *
     * @private
     * @param {string} id - Provider id (e.g. 'openrouter', 'azure-openai')
     * @returns {string} The provider label, or the id as a fallback
     */
    _lookupProviderLabel(id) {
      const switcher = window.ProviderSwitcher;
      if (!switcher || typeof switcher.getKnown !== "function") {
        return id;
      }
      const known = switcher.getKnown();
      const entry = Array.isArray(known)
        ? known.find((p) => p && p.id === id)
        : null;
      if (entry && typeof entry.label === "string" && entry.label) {
        return entry.label;
      }
      return id;
    }

    /**
     * Compose the human-readable capability fragment for the notice text.
     *
     * - String matching CAPABILITY_LABELS → friendly label.
     * - String not in the map → raw string with a DEBUG log noting it was
     *   unmapped (so future maintainers can spot capability ids that have
     *   slipped through without a friendly label).
     * - Array → map each entry through the same logic, then join with " and ".
     * - Missing / empty / non-string-non-array → generic fallback.
     *
     * @private
     * @param {string|string[]} requiredCapabilities
     * @returns {string}
     */
    _computeCapabilityText(requiredCapabilities) {
      if (Array.isArray(requiredCapabilities)) {
        if (requiredCapabilities.length === 0) {
          return GENERIC_CAPABILITY_FALLBACK;
        }
        const parts = requiredCapabilities.map((cap) =>
          this._mapSingleCapability(cap)
        );
        return parts.join(" and ");
      }
      if (typeof requiredCapabilities === "string" && requiredCapabilities) {
        return this._mapSingleCapability(requiredCapabilities);
      }
      return GENERIC_CAPABILITY_FALLBACK;
    }

    /**
     * Map a single capability id to its friendly label, or return the raw
     * string with a DEBUG log if it isn't in CAPABILITY_LABELS. Non-string
     * inputs fall through to the generic fallback (defence in depth — array
     * entries can theoretically be non-strings).
     *
     * @private
     * @param {string} cap
     * @returns {string}
     */
    _mapSingleCapability(cap) {
      if (typeof cap !== "string" || !cap) {
        return GENERIC_CAPABILITY_FALLBACK;
      }
      if (Object.prototype.hasOwnProperty.call(CAPABILITY_LABELS, cap)) {
        return CAPABILITY_LABELS[cap];
      }
      logDebug(
        `Capability id '${cap}' not in CAPABILITY_LABELS; using raw string in notice text`
      );
      return cap;
    }

    /**
     * Heuristic focusability check. Sufficient for Task 3.2a's use case (the
     * caller typically passes a `<select>` or `<input>` that has just been
     * repopulated). Not a full WCAG/ATAG focusability audit — we don't probe
     * for `hidden`, `display:none`, `visibility:hidden`, or `disabled`
     * because those depend on layout state that this helper isn't supposed
     * to inspect, and getting it wrong would block a legitimate focus move.
     *
     * @private
     * @param {Element} element
     * @returns {boolean}
     */
    _isFocusable(element) {
      if (!element) return false;
      if (typeof element.focus !== "function") return false;
      // tabIndex of -1 means programmatically focusable but not keyboard-tabbable.
      // For our purposes (post-switch focus move) we treat -1 as non-focusable
      // so the consumer surfaces an audible WARN rather than silently moving
      // focus to something that's been deliberately removed from the tab order.
      if (element.tabIndex === -1) return false;
      return true;
    }

    /**
     * Resolve `focusAfterSwitch` to an Element. Strings go through
     * `document.querySelector`; Elements pass through. Anything else yields
     * `null`.
     *
     * @private
     * @param {string|Element} target
     * @returns {{ element: Element|null, sourceLabel: string }}
     */
    _resolveFocusTarget(target) {
      if (typeof target === "string" && target) {
        let element = null;
        try {
          element = document.querySelector(target);
        } catch (err) {
          logWarn(
            `focusAfterSwitch selector '${target}' is invalid; focus unchanged`,
            err
          );
          return { element: null, sourceLabel: target };
        }
        return { element, sourceLabel: target };
      }
      if (target instanceof Element) {
        return {
          element: target,
          sourceLabel: target.tagName ? target.tagName.toLowerCase() : "element",
        };
      }
      return { element: null, sourceLabel: "" };
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Render the mismatch notice into a container.
     *
     * Clears any existing content in the container before rendering. Builds a
     * role="status" / aria-live="polite" notice containing descriptive text
     * and a single button that, when clicked, calls
     * ProviderSwitcher.setActive() and optionally moves focus to a
     * caller-supplied element.
     *
     * The consumer is responsible for:
     *   - Detecting that a mismatch exists (this helper does not check
     *     capabilities)
     *   - Subscribing to 'provider:changed' to clear the container and
     *     repopulate its dropdown after the user clicks the switch button
     *   - Providing the focus target (usually the now-populated dropdown)
     *
     * @param {Element} containerElement - DOM element to render the notice
     *   into.
     * @param {Object} options
     * @param {string|string[]} [options.requiredCapabilities] - Capability
     *   id(s) the active provider doesn't satisfy. Used to compose the notice
     *   text. Strings matching CAPABILITY_LABELS are mapped to friendly
     *   labels; others are passed through verbatim. Array entries are joined
     *   with " and ". Missing or empty falls back to a generic phrase.
     * @param {string} options.activeProvider - Provider id from
     *   getKnown()[*].id that's currently active. Used to compose the "from"
     *   part of the notice.
     * @param {string} options.alternativeProvider - Provider id from
     *   getKnown()[*].id that DOES satisfy the requirement. Used as the
     *   setActive() target on click, and to compose the button label and
     *   "to" part of the notice.
     * @param {string|Element} [options.focusAfterSwitch] - CSS selector OR
     *   DOM element to focus after the switch. Optional. If absent or
     *   unfocusable, focus management is skipped with a DEBUG (no element)
     *   or WARN (unfocusable) log.
     * @returns {boolean} true on successful render, false on validation
     *   failure.
     *
     * @example
     * ProviderMismatchNotice.render(
     *   document.getElementById('mismatch-notice-slot'),
     *   {
     *     requiredCapabilities: 'images',
     *     activeProvider: 'azure-openai',
     *     alternativeProvider: 'openrouter',
     *     focusAfterSwitch: '#chat-model-select'
     *   }
     * );
     */
    render(containerElement, options) {
      // 1. ProviderSwitcher must be loaded.
      const switcher = window.ProviderSwitcher;
      if (!switcher || typeof switcher.getKnown !== "function") {
        logError(
          "window.ProviderSwitcher is not loaded; cannot render mismatch notice"
        );
        return false;
      }

      // 2. containerElement must be a real DOM Element.
      if (!(containerElement instanceof Element)) {
        logWarn(
          "render() called with invalid containerElement; expected an Element",
          { containerElement }
        );
        return false;
      }

      // 3. options must be a non-null object.
      if (!options || typeof options !== "object") {
        logWarn("render() called with invalid options; expected an object", {
          options,
        });
        return false;
      }

      // 4. activeProvider and alternativeProvider must be strings that appear
      //    in getKnown(). Look up the full set once for clearer diagnostics.
      const known = switcher.getKnown();
      const knownIds = Array.isArray(known)
        ? known.map((p) => p && p.id).filter((id) => typeof id === "string")
        : [];

      const { activeProvider, alternativeProvider } = options;

      if (
        typeof activeProvider !== "string" ||
        !activeProvider ||
        !knownIds.includes(activeProvider)
      ) {
        logWarn(
          `render() called with invalid activeProvider '${activeProvider}'. Known: ${knownIds.join(", ")}`
        );
        return false;
      }

      if (
        typeof alternativeProvider !== "string" ||
        !alternativeProvider ||
        !knownIds.includes(alternativeProvider)
      ) {
        logWarn(
          `render() called with invalid alternativeProvider '${alternativeProvider}'. Known: ${knownIds.join(", ")}`
        );
        return false;
      }

      // 5. Compose the capability text fragment.
      const capabilityText = this._computeCapabilityText(
        options.requiredCapabilities
      );

      // 6. Resolve provider labels for the notice prose.
      const activeLabel = this._lookupProviderLabel(activeProvider);
      const alternativeLabel = this._lookupProviderLabel(alternativeProvider);

      // 7. Clear the container so re-renders replace cleanly. Discarding the
      //    old DOM also drops the old button's click listener (no manual
      //    teardown needed).
      containerElement.innerHTML = "";

      // 8. Build the notice DOM via createElement + textContent. Avoid
      //    innerHTML with interpolated strings — keeps the rendering path
      //    XSS-safe even if a future consumer passes user-supplied data into
      //    `requiredCapabilities`.
      const notice = document.createElement("div");
      notice.className = NOTICE_CLASS;
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");

      const noticeText = document.createElement("p");
      noticeText.className = NOTICE_TEXT_CLASS;
      noticeText.textContent = `The active provider (${activeLabel}) doesn't support ${capabilityText}. Switch to ${alternativeLabel} to use this feature.`;

      const buttonLabel = `Switch to ${alternativeLabel} for this session`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = NOTICE_BUTTON_CLASS;
      button.textContent = buttonLabel;
      // Single source of truth: the visible label is also the accessible name,
      // so screen reader users and sighted users hear/see the same wording.
      // aria-label deliberately omitted — adding it would risk drift if the
      // visible text changes later.
      button.style.minHeight = BUTTON_MIN_HEIGHT;
      button.style.minWidth = BUTTON_MIN_WIDTH;

      // 9. Wire the click handler. Captures activeProvider /
      //    alternativeProvider / focusAfterSwitch by closure so the handler
      //    keeps working even if the consumer later mutates the options
      //    object it passed in.
      const focusAfterSwitch = options.focusAfterSwitch;
      button.addEventListener("click", () => {
        const currentSwitcher = window.ProviderSwitcher;
        if (!currentSwitcher || typeof currentSwitcher.setActive !== "function") {
          logError(
            "ProviderSwitcher unavailable at click time; cannot switch providers"
          );
          return;
        }

        currentSwitcher.setActive(alternativeProvider);

        if (focusAfterSwitch === undefined || focusAfterSwitch === null) {
          logDebug("No focusAfterSwitch supplied; skipping focus management");
          return;
        }

        const { element: focusTarget, sourceLabel } =
          this._resolveFocusTarget(focusAfterSwitch);

        if (!focusTarget) {
          if (typeof focusAfterSwitch === "string") {
            logWarn(
              `focusAfterSwitch selector '${sourceLabel}' didn't match anything; focus unchanged`
            );
          } else {
            logWarn(
              "focusAfterSwitch was supplied but didn't resolve to an Element; focus unchanged",
              { focusAfterSwitch }
            );
          }
          return;
        }

        if (!this._isFocusable(focusTarget)) {
          logWarn(
            `focusAfterSwitch target isn't focusable (${sourceLabel}); focus unchanged`
          );
          return;
        }

        focusTarget.focus();
        logInfo(`Focus moved to ${sourceLabel}`);
      });

      // 10. Compose and inject. Single appendChild keeps the notice atomic
      //     in the DOM — assistive tech sees the new role="status" container
      //     as one unit rather than streaming partial updates.
      notice.appendChild(noticeText);
      notice.appendChild(button);
      containerElement.appendChild(notice);

      // 11. INFO log so a maintainer can confirm at a glance which mismatch
      //     fired when debugging a tool that consumes this helper.
      logInfo(
        `Notice rendered: ${activeProvider} → ${alternativeProvider} (required: ${capabilityText})`
      );

      return true;
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const providerMismatchNotice = new ProviderMismatchNotice();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ProviderMismatchNotice = providerMismatchNotice;
  window.ProviderMismatchNoticeClass = ProviderMismatchNotice;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo(
    "OpenRouter Embed Provider Mismatch Notice (Stage 3a Task 3.2a) loaded"
  );
  logInfo("Available as: window.ProviderMismatchNotice (singleton instance)");
  logInfo("Class available as: window.ProviderMismatchNoticeClass");
})();
