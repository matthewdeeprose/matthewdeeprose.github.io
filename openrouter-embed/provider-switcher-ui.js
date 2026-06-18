/**
 * OpenRouter Embed - Provider Switcher UI (Stage 3a, Task 3.4a)
 *
 * Library-agnostic JS wiring for the global provider switch markup in
 * tools.html (Task 3.3a). On DOMContentLoaded:
 *   1. Looks up the fieldset and its child radios/status spans.
 *   2. Populates status sub-labels from ProviderSwitcher.getKnown().
 *   3. Syncs the checked radio to match ProviderSwitcher.getActive().
 *   4. Attaches a single delegated change handler on the fieldset that
 *      calls ProviderSwitcher.setActive(newId) when the user flips a radio.
 *   5. Subscribes to 'provider:changed' (cross-tab sync) and
 *      'credentials:changed' (Set-Up tool, lands in Task 3.2b) to refresh
 *      the UI whenever state changes elsewhere.
 *
 * Does NOT depend on:
 *   - window.OpenRouterEmbed
 *   - window.EmbedProviderRegistry / EmbedProviderLookup
 *   - window.EmbedEventEmitter
 *
 * Only dependency: window.ProviderSwitcher (Task 3.1a).
 *
 * Visibility: works regardless of whether the fieldset is currently
 * visible. getElementById is unaffected by display:none or hidden.
 * The fieldset is hidden in non-Set-Up modes; status sub-labels update
 * via events whether visible or not, so re-revealing the fieldset
 * always shows current state.
 *
 * Public API:
 *   ProviderSwitcherUI.refresh()  -> void
 *     Re-reads ProviderSwitcher state and updates DOM. Idempotent.
 *     Exposed primarily for manual debugging and tests; the module
 *     calls it itself on init and on subscribed events.
 *
 * @version 1.0.0 (Stage 3a, Task 3.4a)
 * @date 18 May 2026
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
      console.error(`[ProviderSwitcherUI ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ProviderSwitcherUI WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ProviderSwitcherUI INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ProviderSwitcherUI DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // MODULE CONSTANTS
  // ============================================================================

  const FIELDSET_ID = "provider-switch-fieldset";
  const RADIO_NAME = "provider-switch";
  const RADIO_ID_PREFIX = "provider-switch-";          // e.g. provider-switch-openrouter
  const STATUS_ID_SUFFIX = "-status";                  // e.g. provider-switch-openrouter-status
  const PROVIDER_CHANGED_EVENT = "provider:changed";
  const CREDENTIALS_CHANGED_EVENT = "credentials:changed";
  const STATUS_TEXT_CONFIGURED = "Configured";
  const STATUS_TEXT_NOT_CONFIGURED = "Not configured";

  // Module-scope listener references so re-running the IIFE replaces
  // rather than duplicates. Same idempotency pattern as Task 3.1a's
  // _activeStorageListener.
  let _activeProviderChangedListener = null;
  let _activeCredentialsChangedListener = null;
  let _activeChangeListener = null;
  let _changeListenerTarget = null;

  // ============================================================================
  // PROVIDER SWITCHER UI CLASS
  // ============================================================================

  class ProviderSwitcherUI {
    constructor() {
      this._initialised = false;
      this._elements = null;

      // Defensive: ProviderSwitcher must be loaded BEFORE this module.
      if (!window.ProviderSwitcher) {
        logError("window.ProviderSwitcher not loaded; UI wiring inert");
        return;
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this._init(), {
          once: true,
        });
      } else {
        this._init();
      }
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * One-time initialisation. Called from the constructor on DOMContentLoaded
     * (or immediately if the document is already parsed).
     *
     * Discovers DOM elements, attaches the delegated change handler, subscribes
     * to provider:changed and credentials:changed, then runs an initial
     * refresh() to sync the UI with current ProviderSwitcher state.
     *
     * Idempotent: a second call (e.g. from a re-run IIFE) returns early.
     *
     * @private
     */
    _init() {
      if (this._initialised) {
        logDebug("_init called twice; ignoring");
        return;
      }

      const fieldset = document.getElementById(FIELDSET_ID);
      if (!fieldset) {
        logInfo(
          `fieldset #${FIELDSET_ID} not found; not on a page with the provider switch`
        );
        return;
      }

      // Build the element cache from ProviderSwitcher.getKnown() so adding a
      // new provider needs only KNOWN_PROVIDERS + matching markup, no edits
      // here.
      const known = window.ProviderSwitcher.getKnown();
      this._elements = {
        fieldset,
        byProvider: {},
      };

      for (const p of known) {
        const radio = document.getElementById(RADIO_ID_PREFIX + p.id);
        const status = document.getElementById(
          RADIO_ID_PREFIX + p.id + STATUS_ID_SUFFIX
        );
        this._elements.byProvider[p.id] = { radio, status };

        if (!radio) {
          logWarn(
            `radio #${RADIO_ID_PREFIX + p.id} not found; check tools.html markup for provider '${p.id}'`
          );
        }
        if (!status) {
          logWarn(
            `status span #${RADIO_ID_PREFIX + p.id + STATUS_ID_SUFFIX} not found; check tools.html markup for provider '${p.id}'`
          );
        }
      }

      // Delegated change listener on the fieldset. One per re-run; the
      // module-scope reference lets us detach a stale handler from a previous
      // IIFE execution before attaching this one. Same pattern as Task 3.1a's
      // _activeStorageListener.
      if (_activeChangeListener && _changeListenerTarget) {
        _changeListenerTarget.removeEventListener(
          "change",
          _activeChangeListener
        );
        logInfo("fieldset change listener replaced (likely double-load)");
      }
      _activeChangeListener = (e) => this._handleRadioChange(e);
      _changeListenerTarget = fieldset;
      fieldset.addEventListener("change", _activeChangeListener);

      // provider:changed subscription — fires on every ProviderSwitcher state
      // transition (in-tab via setActive, and cross-tab via storage events).
      if (_activeProviderChangedListener) {
        window.removeEventListener(
          PROVIDER_CHANGED_EVENT,
          _activeProviderChangedListener
        );
        logInfo(
          `${PROVIDER_CHANGED_EVENT} listener replaced (likely double-load)`
        );
      }
      _activeProviderChangedListener = () => this.refresh();
      window.addEventListener(
        PROVIDER_CHANGED_EVENT,
        _activeProviderChangedListener
      );

      // credentials:changed subscription — forward-compatible. The event
      // source ships in Task 3.2b; until then this listener is dormant but
      // harmless.
      if (_activeCredentialsChangedListener) {
        window.removeEventListener(
          CREDENTIALS_CHANGED_EVENT,
          _activeCredentialsChangedListener
        );
        logInfo(
          `${CREDENTIALS_CHANGED_EVENT} listener replaced (likely double-load)`
        );
      }
      _activeCredentialsChangedListener = () => this.refresh();
      window.addEventListener(
        CREDENTIALS_CHANGED_EVENT,
        _activeCredentialsChangedListener
      );

      this._initialised = true;

      // Initial sync — overrides the markup's parse-time `checked` default if
      // it disagrees with ProviderSwitcher.getActive(), and fills in the empty
      // status sub-label spans.
      this.refresh();

      logInfo(
        `UI wired and synced; active=${window.ProviderSwitcher.getActive()}, known=${known.length} providers`
      );
    }

    /**
     * Delegated change handler attached to the fieldset. Filters to our radio
     * group and calls ProviderSwitcher.setActive() with the new id.
     *
     * ProviderSwitcher.setActive() synchronously dispatches provider:changed,
     * which fires our subscribed handler, which calls refresh(), which sets
     * radio.checked = true on the already-checked radio. Programmatic .checked
     * assignment does NOT fire `change` (per HTML spec), so this cycle
     * terminates after one pass — no event loop.
     *
     * @private
     * @param {Event} event
     */
    _handleRadioChange(event) {
      if (!event || !event.target) return;
      if (event.target.name !== RADIO_NAME) return;

      const newId = event.target.value;

      if (!window.ProviderSwitcher) {
        logError(
          "radio change fired but window.ProviderSwitcher is gone; cannot update state"
        );
        return;
      }

      const changed = window.ProviderSwitcher.setActive(newId);
      if (!changed) {
        logWarn(
          `setActive returned false for '${newId}'; forcing refresh to re-sync UI`
        );
        this.refresh();
        return;
      }

      logInfo(`Radio change: switched to ${newId}`);
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Re-read state from window.ProviderSwitcher and update the DOM to match.
     *
     * Specifically:
     *   - For each provider in getKnown():
     *     - Set its radio's .checked = (provider.id === getActive())
     *     - Set its status span's textContent to 'Configured' or 'Not configured'
     *   - Missing DOM elements are logged at WARN, not skipped silently
     *
     * Idempotent. Safe to call repeatedly. Called automatically:
     *   - Once on init (after DOMContentLoaded)
     *   - On every 'provider:changed' window event
     *   - On every 'credentials:changed' window event
     *
     * Public so external code can force a re-sync if it has reason to believe
     * state diverged (e.g. test harnesses, dev tools).
     *
     * @returns {void}
     */
    refresh() {
      if (!this._initialised) {
        logDebug("refresh called before init; ignoring");
        return;
      }
      if (!window.ProviderSwitcher) {
        logError("refresh called but window.ProviderSwitcher is gone");
        return;
      }

      const active = window.ProviderSwitcher.getActive();
      const known = window.ProviderSwitcher.getKnown();

      for (const provider of known) {
        const cached = this._elements.byProvider[provider.id];
        if (!cached) {
          logWarn(
            `no DOM cache for provider '${provider.id}'; was it added to KNOWN_PROVIDERS after init?`
          );
          continue;
        }

        const { radio, status } = cached;

        if (radio) {
          // Programmatic assignment does not fire `change`, so no loop.
          radio.checked = provider.id === active;
        } else {
          logWarn(
            `radio for provider '${provider.id}' missing from cache; skipping checked update`
          );
        }

        if (status) {
          // Target the inner .setup-status-text span so the visually-hidden
          // provider-name prefix (added in tools.html for the 3.5b follow-up)
          // is preserved across refresh. Without this, screen-reader users
          // would hear "Configured" with no provider context.
          const innerText = status.querySelector(".setup-status-text");
          const text = provider.configured
            ? STATUS_TEXT_CONFIGURED
            : STATUS_TEXT_NOT_CONFIGURED;
          if (innerText) {
            innerText.textContent = text;
          } else {
            // Defensive fallback if HTML restructure was missed for this site.
            status.textContent = text;
            logWarn(
              `.setup-status-text inner span not found in #${status.id}; falling back to outer textContent (provider prefix lost)`
            );
          }
        } else {
          logWarn(
            `status span for provider '${provider.id}' missing from cache; skipping textContent update`
          );
        }

        logDebug(
          `refreshed ${provider.id}: checked=${provider.id === active}, configured=${provider.configured}`
        );
      }
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const providerSwitcherUI = new ProviderSwitcherUI();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ProviderSwitcherUI = providerSwitcherUI;
  window.ProviderSwitcherUIClass = ProviderSwitcherUI;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Provider Switcher UI (Stage 3a Task 3.4a) loaded");
  logInfo("Available as: window.ProviderSwitcherUI (singleton instance)");
  logInfo("Class available as: window.ProviderSwitcherUIClass");
})();
