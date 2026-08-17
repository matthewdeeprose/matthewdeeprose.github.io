/**
 * Set Up Tool — Centralised credential management
 * Phase SU-2: OpenRouter, MathPix, and Ally credentials + status summary
 *
 * @author Matthew Deeprose
 * @version 1.1.0
 */
window.SetUpTool = (function () {
  "use strict";

  // ============================================================
  // Logging configuration
  // ============================================================
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[SetUpTool]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[SetUpTool]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[SetUpTool]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[SetUpTool]", message, ...args);
  }

  // ============================================================
  // Cached DOM elements
  // ============================================================
  let elements = null;

  function cacheElements() {
    elements = {
      // OpenRouter credential inputs
      orApiKeyInput: document.getElementById("setup-or-api-key"),
      orToggleBtn: document.getElementById("setup-or-toggle-btn"),
      orStatusBadge: document.getElementById("setup-or-status-badge"),

      // MathPix credential inputs
      mpAppIdInput: document.getElementById("setup-mp-app-id"),
      mpAppKeyInput: document.getElementById("setup-mp-app-key"),
      mpToggleBtn: document.getElementById("setup-mp-toggle-btn"),
      mpStatusBadge: document.getElementById("setup-mp-status-badge"),

      // Ally credential inputs
      allyRegionSelect: document.getElementById("setup-ally-region"),
      allyClientIdInput: document.getElementById("setup-ally-client-id"),
      allyTokenInput: document.getElementById("setup-ally-token"),
      allyToggleBtn: document.getElementById("setup-ally-toggle-btn"),
      allyWorkerUrlInput: document.getElementById("setup-ally-worker-url"),
      allyRememberCheckbox: document.getElementById("setup-ally-remember"),
      allyStatusBadge: document.getElementById("setup-ally-status-badge"),

      // Foundry credential inputs (Stage 3b, Task 3.2b)
      fdyProxyUrlInput: document.getElementById("setup-fdy-proxy-url"),
      fdyUserTokenInput: document.getElementById("setup-fdy-user-token"),
      fdyToggleBtn: document.getElementById("setup-fdy-toggle-btn"),
      fdySaveBtn: document.getElementById("setup-fdy-save-btn"),
      fdyClearBtn: document.getElementById("setup-fdy-clear-btn"),
      fdyTestBtn: document.getElementById("setup-fdy-test-btn"),
      fdyStatusBadge: document.getElementById("setup-fdy-status-badge"),
      fdyActiveBadge: document.getElementById("setup-fdy-active-badge"),

      // University sign-in card (F2 stage 9a)
      signinStatusBadge: document.getElementById("setup-signin-status-badge"),
      signinBtn: document.getElementById("setup-signin-btn"),
      signoutBtn: document.getElementById("setup-signout-btn"),

      // Status summary values
      summaryOrValue: document.getElementById("setup-summary-or-value"),
      summaryMpValue: document.getElementById("setup-summary-mp-value"),
      summaryFdyValue: document.getElementById("setup-summary-fdy-value"),
      summaryAllyValue: document.getElementById("setup-summary-ally-value"),

      // Status summary items (for styling)
      summaryOrItem: document.getElementById("setup-summary-openrouter"),
      summaryMpItem: document.getElementById("setup-summary-mathpix"),
      summaryFdyItem: document.getElementById("setup-summary-foundry"),
      summaryAllyItem: document.getElementById("setup-summary-ally"),

      // Model status summary
      summaryModelsValue: document.getElementById("setup-summary-models-value"),
      summaryModelsItem: document.getElementById("setup-summary-models"),
      summaryModelsTypes: document.getElementById("setup-summary-models-types"),
    };

    logDebug("Elements cached");
    return elements;
  }

  // ============================================================
  // Screen reader announcements
  // ============================================================
  function announce(message) {
    if (
      window.accessibilityHelpers &&
      typeof window.accessibilityHelpers.announce === "function"
    ) {
      window.accessibilityHelpers.announce(message);
    } else {
      // Fallback: use the existing sr-only alert region
      var alertRegion = document.querySelector('[role="alert"].sr-only');
      if (alertRegion) {
        alertRegion.textContent = message;
      }
    }
  }

  // ============================================================
  // Announcing after a confirmation modal
  // ============================================================
  // A WORKAROUND, not a property of announcements in general — an announcement
  // made anywhere else on this page needs no delay and must not copy this.
  //
  // window.safeConfirm's promise resolves when Yes is CLICKED, roughly 200ms
  // BEFORE the dialog leaves the page. The dependency is js/universal-modal.js:
  // showConfirm's Yes handler calls modalInstance.close() and resolves
  // immediately; close() (:794) only sets a `closing` attribute and schedules
  // finishClose (:810) 200ms later under prefers-reduced-motion: no-preference.
  // finishClose is where cleanupModalInert, the removeChild and the opener
  // focus-restore ALL happen. So a .then that announces straight away writes
  // into a live region the open dialog has removed from the accessibility tree,
  // and no screen reader of any version reads it.
  //
  // MEASURED 13 August 2026, headless chromium-1223, all four Set Up clears,
  // three runs each, times relative to the promise resolving:
  //   t_write   (region receives the text)      +7.1 to +26.0 ms
  //   t_focus   (opener focus restored)       +209.9 to +243.8 ms
  //   t_removed (dialog leaves the DOM)       +216.5 to +249.9 ms
  //   t_inert   (inert lifted from the region's ancestor) — same instant
  // A CDP read of the accessibility tree during that window showed the region
  // ignored=true, role=none, reason activeModalDialog — so this is exposure,
  // confirmed at the tree, not merely a DOM attribute.
  //
  // WHY 350. Two floors: the 249.9ms worst observed teardown, and the focus
  // restore at 243.8ms plus the ~10ms in which a polite write landing on a
  // focus change has been measured lost elsewhere in this repo. The margin is
  // NOT sized against the 2.3ms run-to-run jitter, which would be far too thin.
  // It is a DIFFERENTIAL between two timers scheduled at the same instant on
  // the same event loop: the modal's 200ms and this one, so a loaded machine
  // delays both together and the 150ms gap between them survives. Teardown's
  // own synchronous work costs 16.5 to 49.9ms of that gap — a third of it.
  //
  // THE ROOT FIX IS ELSEWHERE, and this constant becomes unnecessary the day it
  // lands: safeConfirm's promise should resolve AFTER finishClose, not before.
  // Whoever changes that 200ms in js/universal-modal.js — or removes the
  // closing animation — should delete this and the helper below.
  const MODAL_CLOSE_ANNOUNCE_DELAY_MS = 350;

  /**
   * Announce a message once the confirmation modal has finished tearing down.
   * For callers reached THROUGH window.safeConfirm only — see the note above.
   * @param {string} message - the already-built announcement string
   */
  function announceAfterModalClose(message) {
    window.setTimeout(function () {
      announce(message);
    }, MODAL_CLOSE_ANNOUNCE_DELAY_MS);
  }

  // ============================================================
  // Live-region status writes (3.5b follow-up)
  // ============================================================
  // Each status span in tools.html has the structure
  //   <span>
  //     <span class="visually-hidden">Provider Name: </span>
  //     <span class="setup-status-text">{text}</span>
  //   </span>
  // The visually-hidden prefix gives screen-reader users context on which
  // provider the status refers to. JS must target the inner .setup-status-text
  // span so it doesn't overwrite the prefix.
  //
  // These are deliberately NOT live regions any more. announce() above is the
  // single channel for state changes; when these spans also carried aria-live,
  // each provider status was echoed by three exposed regions and the load-time
  // "Checking..." settle spoke them all before the user reached the page. Writing
  // here is therefore SILENT by design — if a state change needs to be heard, add
  // an announce() call for it rather than re-adding aria-live.
  function setStatusText(el, text) {
    if (!el) return;
    const inner = el.querySelector(".setup-status-text");
    if (inner) {
      inner.textContent = text;
    } else {
      // Defensive fallback: if HTML restructure was missed for this site,
      // keep behaviour working but surface the gap so it can be fixed.
      el.textContent = text;
      logWarn(
        "setup-status-text inner span not found in #" + el.id +
          "; falling back to outer textContent (provider prefix lost)"
      );
    }
  }

  // ============================================================
  // Event emission
  // ============================================================
  function emitCredentialChange(service, action) {
    const detail = { service: service, action: action };

    if (
      window.EmbedEventEmitter &&
      typeof window.EmbedEventEmitter.emit === "function"
    ) {
      window.EmbedEventEmitter.emit("credentials:changed", detail);
      logDebug("Emitted credentials:changed", detail);
    } else {
      logDebug("EmbedEventEmitter not available, skipping emit");
    }

    // Bridge: EmbedEventEmitter and window are separate channels. Real
    // consumers (enhanced-model-selection, provider-switcher-ui, Image
    // Describer) subscribe via window.addEventListener('credentials:changed').
    // Dispatch on window too so those subscribers fire alongside the
    // EmbedEventEmitter ones. Same detail payload on both channels.
    window.dispatchEvent(
      new CustomEvent("credentials:changed", { detail: detail }),
    );
  }

  // ============================================================
  // OpenRouter credential management
  // ============================================================
  function loadOpenRouterKey() {
    if (!elements || !elements.orApiKeyInput) return;

    const storedKey = localStorage.getItem("openrouter_api_key");
    if (storedKey) {
      elements.orApiKeyInput.value = storedKey;
    } else {
      elements.orApiKeyInput.value = "";
    }

    updateOpenRouterStatus(!!storedKey);
    logDebug("OpenRouter key loaded, exists:", !!storedKey);
  }

  function saveOpenRouterKey() {
    if (!elements || !elements.orApiKeyInput) {
      logError("Cannot save: elements not cached");
      return;
    }

    const key = elements.orApiKeyInput.value.trim();
    if (!key) {
      logWarn("Save attempted with empty key");
      announce("Please enter an API key before saving.");
      return;
    }

    // Warn if prefix doesn't match, but still save
    if (!key.startsWith("sk-or-v1-")) {
      logWarn("Key does not start with expected prefix sk-or-v1-");
    }

    localStorage.setItem("openrouter_api_key", key);
    updateOpenRouterStatus(true);
    emitCredentialChange("openrouter", "saved");
    announce("OpenRouter API key saved successfully.");
    logInfo("OpenRouter key saved");
  }

  function clearOpenRouterKey() {
    if (typeof window.safeConfirm === "function") {
      window.safeConfirm(
        "Are you sure you want to clear your OpenRouter API key?",
        "Clear API Key"
      ).then(function (confirmed) {
        if (confirmed) {
          performClearOpenRouterKey();
        }
      });
    } else {
      // Fallback if safeConfirm is not available
      if (confirm("Are you sure you want to clear your OpenRouter API key?")) {
        performClearOpenRouterKey();
      }
    }
  }

  function performClearOpenRouterKey() {
    localStorage.removeItem("openrouter_api_key");

    if (elements && elements.orApiKeyInput) {
      elements.orApiKeyInput.value = "";
    }

    updateOpenRouterStatus(false);
    emitCredentialChange("openrouter", "cleared");
    // Reached only through the confirmation modal — see announceAfterModalClose.
    announceAfterModalClose("OpenRouter API key cleared.");
    logInfo("OpenRouter key cleared");
  }

  function toggleOpenRouterVisibility() {
    if (!elements || !elements.orApiKeyInput || !elements.orToggleBtn) return;

    const input = elements.orApiKeyInput;
    const btn = elements.orToggleBtn;

    if (input.type === "password") {
      input.type = "text";
      btn.setAttribute("aria-label", "Hide API key");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Hide"));
      }
    } else {
      input.type = "password";
      btn.setAttribute("aria-label", "Show API key");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Show"));
      }
    }
  }

  // ============================================================
  // MathPix credential management
  // ============================================================
  function loadMathPixCredentials() {
    if (!elements) return;

    const storedId = localStorage.getItem("mathpix-app-id");
    const storedKey = localStorage.getItem("mathpix-app-key");

    if (elements.mpAppIdInput) {
      elements.mpAppIdInput.value = storedId || "";
    }
    if (elements.mpAppKeyInput) {
      elements.mpAppKeyInput.value = storedKey || "";
    }

    updateMathPixStatus(!!storedId && !!storedKey);
    logDebug("MathPix credentials loaded, configured:", !!storedId && !!storedKey);
  }

  function saveMathPixCredentials() {
    if (!elements || !elements.mpAppIdInput || !elements.mpAppKeyInput) {
      logError("Cannot save MathPix: elements not cached");
      return;
    }

    const appId = elements.mpAppIdInput.value.trim();
    const appKey = elements.mpAppKeyInput.value.trim();

    if (!appId || !appKey) {
      logWarn("MathPix save attempted with missing fields");
      announce("Please enter both an App ID and App Key before saving.");
      return;
    }

    localStorage.setItem("mathpix-app-id", appId);
    localStorage.setItem("mathpix-app-key", appKey);
    updateMathPixStatus(true);
    emitCredentialChange("mathpix", "saved");
    announce("MathPix credentials saved successfully.");
    logInfo("MathPix credentials saved");
  }

  function clearMathPixCredentials() {
    if (typeof window.safeConfirm === "function") {
      window.safeConfirm(
        "Are you sure you want to clear your MathPix credentials?",
        "Clear MathPix Credentials"
      ).then(function (confirmed) {
        if (confirmed) {
          performClearMathPixCredentials();
        }
      });
    } else {
      if (confirm("Are you sure you want to clear your MathPix credentials?")) {
        performClearMathPixCredentials();
      }
    }
  }

  function performClearMathPixCredentials() {
    localStorage.removeItem("mathpix-app-id");
    localStorage.removeItem("mathpix-app-key");

    if (elements && elements.mpAppIdInput) {
      elements.mpAppIdInput.value = "";
    }
    if (elements && elements.mpAppKeyInput) {
      elements.mpAppKeyInput.value = "";
    }

    updateMathPixStatus(false);
    emitCredentialChange("mathpix", "cleared");
    // Reached only through the confirmation modal — see announceAfterModalClose.
    announceAfterModalClose("MathPix credentials cleared.");
    logInfo("MathPix credentials cleared");
  }

  function toggleMathPixVisibility() {
    if (!elements || !elements.mpAppKeyInput || !elements.mpToggleBtn) return;

    const input = elements.mpAppKeyInput;
    const btn = elements.mpToggleBtn;

    if (input.type === "password") {
      input.type = "text";
      btn.setAttribute("aria-label", "Hide App Key");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Hide"));
      }
    } else {
      input.type = "password";
      btn.setAttribute("aria-label", "Show App Key");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Show"));
      }
    }
  }

  function updateMathPixStatus(isConfigured) {
    if (!elements) return;

    const badgeText = isConfigured ? "Configured" : "Not configured";
    const badgeClass = isConfigured
      ? "setup-status-configured"
      : "setup-status-not-configured";

    if (elements.mpStatusBadge) {
      setStatusText(elements.mpStatusBadge, badgeText);
      elements.mpStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }
    if (elements.summaryMpValue) {
      setStatusText(elements.summaryMpValue, badgeText);
    }
    if (elements.summaryMpItem) {
      elements.summaryMpItem.className = "setup-status-item " + badgeClass;
    }
  }

  // ============================================================
  // Ally credential management
  // ============================================================
  // localStorage keys:
  //   - ally-region / ally-client-id / ally-api-token / ally-save-credentials
  //   - ally-worker-url  BASE url of an Ally proxy worker. An alternative to the
  //     API token: the worker holds a read-only token server-side, so the app
  //     needs client ID + region, then EITHER a token OR this. It carries no
  //     secret, so it deliberately SURVIVES an unchecked-Remember clear.
  const ALLY_WORKER_URL_KEY = "ally-worker-url";

  /**
   * Normalises a pasted worker URL to its base form. Defers to ALLY_CONFIG,
   * which owns the canonical rules (strip a trailing /issues or /query, strip
   * trailing slashes, reject anything that is not an absolute http(s) URL), and
   * falls back to a plain trim if the Ally config has not loaded on this page.
   * @param {string} raw - Raw user input
   * @returns {string} Normalised base URL, or "" if unusable
   */
  function normaliseAllyWorkerUrl(raw) {
    if (
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.normaliseWorkerUrl === "function"
    ) {
      return ALLY_CONFIG.normaliseWorkerUrl(raw);
    }

    logWarn("ALLY_CONFIG unavailable; storing worker URL with a plain trim");
    return typeof raw === "string" ? raw.trim() : "";
  }

  /**
   * Reports whether Ally will actually work for this person: a client ID —
   * stored, or the built-in default a sign-in earns — plus ONE transport,
   * either a stored token or a usable worker.
   *
   * This REPLACES a raw `!!localStorage.getItem(ALLY_WORKER_URL_KEY)`
   * truthiness test that both configured computations used to run. That test
   * differed from the one the Ally app itself applied: hasUsableWorkerUrl()
   * runs normaliseWorkerUrl(), so a junk stored string such as "not-a-url"
   * previously read CONFIGURED on this card while reading NOT CONFIGURED in
   * the Ally tool. That divergence was pre-existing; both sides now ask the
   * same question and agree.
   *
   * Falls back to the previous raw behaviour if ally-config.js has not loaded,
   * so this card still works on its own.
   *
   * @returns {boolean} True if an Ally request could be issued now
   */
  function isAllyConfigured() {
    const storedClientId = localStorage.getItem("ally-client-id");
    const storedToken = localStorage.getItem("ally-api-token");

    if (
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.hasUsableWorkerUrl === "function" &&
      typeof ALLY_CONFIG.getEffectiveClientId === "function"
    ) {
      const clientId = storedClientId || ALLY_CONFIG.getEffectiveClientId();
      return !!clientId && (!!storedToken || ALLY_CONFIG.hasUsableWorkerUrl());
    }

    logWarn("ALLY_CONFIG unavailable; judging Ally configured from raw storage");
    return (
      !!storedClientId &&
      (!!storedToken || !!localStorage.getItem(ALLY_WORKER_URL_KEY))
    );
  }

  /**
   * Resolves the client ID to show in the field: a stored value wins, else the
   * built-in default, which getEffectiveClientId() gates on the sign-in.
   * @returns {string} The client ID, or "" when none applies
   */
  function effectiveAllyClientId() {
    const stored = localStorage.getItem("ally-client-id");
    if (stored) return stored;

    if (
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.getEffectiveClientId === "function"
    ) {
      return ALLY_CONFIG.getEffectiveClientId();
    }

    logWarn("ALLY_CONFIG unavailable; no default client ID to resolve");
    return "";
  }

  /**
   * Shows or hides the inline validation message on the worker-URL field.
   * The message span is referenced from the input's aria-describedby alongside
   * the help text, so a screen reader reads the error with the field.
   * @param {string} message - Text to show; "" hides the message and the flag
   */
  function setAllyWorkerUrlError(message) {
    const input = elements && elements.allyWorkerUrlInput;
    const errorEl = document.getElementById("setup-ally-worker-url-error");

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }

    if (!input) return;
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  function loadAllyCredentials() {
    if (!elements) return;

    const storedRegion = localStorage.getItem("ally-region");
    const storedClientId = localStorage.getItem("ally-client-id");
    const storedToken = localStorage.getItem("ally-api-token");
    const storedRemember = localStorage.getItem("ally-save-credentials");
    const storedWorkerUrl = localStorage.getItem(ALLY_WORKER_URL_KEY);

    if (elements.allyRegionSelect && storedRegion) {
      elements.allyRegionSelect.value = storedRegion;
    }
    if (elements.allyClientIdInput) {
      // A stored value wins; the built-in default only fills a gap, and it is
      // gated on the sign-in inside getEffectiveClientId().
      elements.allyClientIdInput.value = effectiveAllyClientId();
    }
    if (elements.allyTokenInput) {
      elements.allyTokenInput.value = storedToken || "";
    }
    if (elements.allyWorkerUrlInput) {
      elements.allyWorkerUrlInput.value = storedWorkerUrl || "";
      // A reload replaces whatever was in the box, so any previous validation
      // message no longer describes what is on screen.
      setAllyWorkerUrlError("");
    }
    if (elements.allyRememberCheckbox) {
      // Default to checked if no stored preference exists
      elements.allyRememberCheckbox.checked =
        storedRemember === null ? true : storedRemember === "true";
    }

    // Ally is configured with a client ID plus ONE transport: a token, or a
    // usable worker. isAllyConfigured() owns that question for both call sites.
    const isConfigured = isAllyConfigured();
    const fromSignIn = isConfigured && !storedToken && !storedWorkerUrl;
    updateAllyStatus(isConfigured, storedRegion, fromSignIn);
    logDebug("Ally credentials loaded, configured:", isConfigured);
  }

  function saveAllyCredentials() {
    if (!elements) {
      logError("Cannot save Ally: elements not cached");
      return;
    }

    const region = elements.allyRegionSelect
      ? elements.allyRegionSelect.value
      : "EU";
    const clientId = elements.allyClientIdInput
      ? elements.allyClientIdInput.value.trim()
      : "";
    const token = elements.allyTokenInput
      ? elements.allyTokenInput.value.trim()
      : "";
    const remember = elements.allyRememberCheckbox
      ? elements.allyRememberCheckbox.checked
      : true;
    const rawWorkerUrl = elements.allyWorkerUrlInput
      ? elements.allyWorkerUrlInput.value.trim()
      : "";
    const workerUrl = normaliseAllyWorkerUrl(rawWorkerUrl);

    // A non-empty entry the normaliser rejects is a typo — most often a missing
    // scheme — not a request to remove the worker. Reject it in place rather
    // than silently deleting a URL that was working.
    if (rawWorkerUrl && !workerUrl) {
      setAllyWorkerUrlError(
        "Enter a full URL including https://, for example https://your-proxy.workers.dev",
      );
      announce(
        "The proxy worker URL is not valid. Enter a full URL including https://.",
      );
      logWarn("Ally save rejected: worker URL could not be normalised");
      return;
    }
    setAllyWorkerUrlError("");

    // The worker URL is not a credential, so it is stored on its own terms:
    // before the Remember gate, and it survives the fromRememberUncheck branch
    // below, which is a save rather than an explicit clear. An EXPLICIT clear
    // does remove it — see performClearAllyCredentials.
    // Storage is compared before and after because the guard below can return
    // early, and the Ally form still has to be told about a worker-URL change.
    const previousWorkerUrl = localStorage.getItem(ALLY_WORKER_URL_KEY);
    if (elements.allyWorkerUrlInput) {
      if (workerUrl) {
        localStorage.setItem(ALLY_WORKER_URL_KEY, workerUrl);
        // Reflect the normalised form so the user sees what was actually saved.
        elements.allyWorkerUrlInput.value = workerUrl;
      } else {
        localStorage.removeItem(ALLY_WORKER_URL_KEY);
      }
    }
    const workerUrlChanged =
      localStorage.getItem(ALLY_WORKER_URL_KEY) !== previousWorkerUrl;

    if (!remember) {
      // Unchecking Remember removes ALL Ally credentials, but NOT the worker
      // URL: the `true` below is what tells performClearAllyCredentials this is
      // a save rather than an explicit clear, so it keeps the URL written a few
      // lines above. This path emits "cleared" itself, so a worker-URL change
      // made in the same save still reaches the Ally form.
      performClearAllyCredentials(true);
      return;
    }

    // An institutional sign-in is a transport in its own right: it makes the
    // built-in worker reachable, so a colleague with a client ID and neither a
    // token nor a URL of their own is not "missing fields" — Ally already
    // works for them, and refusing the save would contradict the card's own
    // Configured badge.
    const signInIsTransport =
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.hasUsableWorkerUrl === "function" &&
      ALLY_CONFIG.hasUsableWorkerUrl();

    if (!clientId || (!token && !workerUrl && !signInIsTransport)) {
      logWarn("Ally save attempted with missing fields");
      // The worker URL above may already have been written. Announce that
      // change even though the credential save did not complete, or the Ally
      // form silently disagrees with storage until the next page load.
      if (workerUrlChanged) {
        emitCredentialChange("ally", "saved");
      }
      announce(
        "Please enter a Client ID, and either an API Token or a proxy worker URL, before saving.",
      );
      return;
    }

    localStorage.setItem("ally-region", region);
    localStorage.setItem("ally-client-id", clientId);
    if (token) {
      localStorage.setItem("ally-api-token", token);
    } else {
      localStorage.removeItem("ally-api-token");
    }
    localStorage.setItem("ally-save-credentials", "true");

    // No token and no worker URL of their own means the save completed on the
    // strength of the sign-in alone.
    updateAllyStatus(true, region, !token && !workerUrl);
    emitCredentialChange("ally", "saved");
    announce("Ally credentials saved successfully for the " + region + " region.");
    logInfo("Ally credentials saved, region:", region);
  }

  function clearAllyCredentials() {
    const message =
      "Are you sure you want to clear your Ally credentials? The proxy worker URL will be removed as well.";

    if (typeof window.safeConfirm === "function") {
      window
        .safeConfirm(message, "Clear Ally Credentials")
        .then(function (confirmed) {
          if (confirmed) {
            performClearAllyCredentials(false);
          }
        });
    } else {
      // Fallback if safeConfirm is not available
      if (confirm(message)) {
        performClearAllyCredentials(false);
      }
    }
  }

  function performClearAllyCredentials(fromRememberUncheck) {
    localStorage.removeItem("ally-region");
    localStorage.removeItem("ally-client-id");
    localStorage.removeItem("ally-api-token");
    localStorage.removeItem("ally-save-credentials");

    // An EXPLICIT clear removes the worker URL too, because a control labelled
    // Clear should clear it — that is what people expect of it. Only safe as of
    // abcea04: before then an empty worker-URL field made the Ally app's
    // formHasTransport() return false, so removing the URL would have left a
    // signed-in colleague unable to use the tool. An empty field now falls
    // through to the built-in default.
    //
    // GATED, because fromRememberUncheck is NOT an explicit clear. That path is
    // reached from inside saveAllyCredentials(), which has ALREADY written this
    // key from the form a few lines earlier — so removing it here would undo,
    // within the same button press, the URL the person just saved. A save is
    // not a clear.
    //
    // This must stay ABOVE the isAllyConfigured() call below, which has to see
    // the post-clear state.
    if (!fromRememberUncheck) {
      localStorage.removeItem(ALLY_WORKER_URL_KEY);
    }

    if (elements) {
      if (elements.allyRegionSelect) {
        elements.allyRegionSelect.value = "EU";
      }
      if (elements.allyClientIdInput) {
        // Not "" — resolve what will actually be sent. Signed out this IS "",
        // so nothing changes; signed in it is the built-in default.
        //
        // Blanking was also unstable: reconcileAllyWithSignInState populates
        // only a field whose value is "", so an emptied box refilled with the
        // default on the next entra:changed event with no user action in
        // between. Writing the resolved value removes that flicker.
        elements.allyClientIdInput.value = effectiveAllyClientId();
      }
      if (elements.allyTokenInput) {
        elements.allyTokenInput.value = "";
      }
      if (elements.allyRememberCheckbox) {
        elements.allyRememberCheckbox.checked = false;
      }
      // Same gate as the removal above: on the save path the field holds the
      // URL that was just saved, and blanking it would contradict storage.
      if (!fromRememberUncheck && elements.allyWorkerUrlInput) {
        elements.allyWorkerUrlInput.value = "";
      }
    }

    // The clear removes what the PERSON stored, which is not the same as
    // removing their access. A signed-in colleague keeps a working transport —
    // the built-in client ID and the built-in worker both survive this — so the
    // badge has to be computed rather than assumed. Signed out it computes to
    // false anyway, because isAllyConfigured() needs a client ID and the
    // removal above has just taken the only one such a person has.
    const configured = isAllyConfigured();
    const fromSignIn =
      configured &&
      !localStorage.getItem("ally-api-token") &&
      !localStorage.getItem(ALLY_WORKER_URL_KEY);
    updateAllyStatus(configured, null, fromSignIn);
    emitCredentialChange("ally", "cleared");

    // Built once, announced once. `configured` is the right gate here and not
    // merely a convenient one: after this clear the ONLY route to a configured
    // state is the sign-in default, since no stored client ID can survive the
    // removal above. Signed out it is false and both strings are unchanged.
    let message = fromRememberUncheck
      ? "Ally credentials removed from browser storage."
      : "Ally credentials cleared. The proxy worker URL was removed as well.";
    if (configured) {
      message += " Ally still works with your University sign-in.";
    }

    // One string, announced once — only WHEN it is delivered branches. The
    // explicit clear comes back through window.safeConfirm and has to outlast
    // the modal teardown (see announceAfterModalClose); the Remember-uncheck
    // path is reached from inside saveAllyCredentials with no modal anywhere in
    // it, so it keeps the immediate announcement it has always had.
    if (fromRememberUncheck) {
      announce(message);
    } else {
      announceAfterModalClose(message);
    }
    logInfo("Ally credentials cleared");
  }

  function toggleAllyVisibility() {
    if (!elements || !elements.allyTokenInput || !elements.allyToggleBtn) return;

    const input = elements.allyTokenInput;
    const btn = elements.allyToggleBtn;

    if (input.type === "password") {
      input.type = "text";
      btn.setAttribute("aria-label", "Hide API token");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Hide"));
      }
    } else {
      input.type = "password";
      btn.setAttribute("aria-label", "Show API token");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Show"));
      }
    }
  }

  /**
   * Renders the Ally badge and summary row.
   * @param {boolean} isConfigured - Whether Ally will work for this person
   * @param {string|null} region - Region key, when one is stored
   * @param {boolean} [fromSignIn=false] - Whether the configured state rests on
   *   an institutional sign-in rather than on credentials the person supplied.
   *   Optional and defaulting to false, so any call site that does not pass it
   *   renders exactly as it did before.
   */
  function updateAllyStatus(isConfigured, region, fromSignIn) {
    if (!elements) return;

    const badgeText = isConfigured ? "Configured" : "Not configured";
    const badgeClass = isConfigured
      ? "setup-status-configured"
      : "setup-status-not-configured";

    if (elements.allyStatusBadge) {
      setStatusText(elements.allyStatusBadge, badgeText);
      elements.allyStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }

    // Summary composes ONE parenthetical from whichever parts apply. The
    // configured-with-region-only case is byte-identical to before, so an
    // existing configured user's text does not change.
    let summaryText = badgeText;
    if (isConfigured) {
      const parts = [];
      if (region) parts.push(region);
      if (fromSignIn === true) parts.push("University sign-in");
      if (parts.length) {
        summaryText = "Configured (" + parts.join(", ") + ")";
      }
    }
    if (elements.summaryAllyValue) {
      setStatusText(elements.summaryAllyValue, summaryText);
    }
    if (elements.summaryAllyItem) {
      elements.summaryAllyItem.className = "setup-status-item " + badgeClass;
    }
  }

  // ============================================================
  // Foundry credential management (Stage 3b, Task 3.2b)
  // ============================================================
  // localStorage keys:
  //   - foundryProxyUrl       (camelCase, matches existing bridging code)
  //   - foundry-user-token    (kebab-case)
  //   - foundry-test-last-result (kebab-case, JSON-stringified)
  //
  // Active-provider id is 'azure-openai' (NOT 'foundry') — the
  // ProviderSwitcher's KNOWN_PROVIDERS entry uses 'azure-openai' as the
  // canonical id with label "Microsoft Foundry".
  //
  // The OpenRouter card has no active badge element yet — Foundry-only
  // subscription is documented in the Task 3.2b Actuals.

  // The EntraAuth scope name the Foundry test authenticates against. Matches
  // the "foundry" key in SCOPES in auth/entra-auth.js, and the identical
  // ENTRA_SCOPE_NAME constant in both provider adapters.
  const FOUNDRY_ENTRA_SCOPE_NAME = "foundry";

  // Built-in Foundry proxy URL.
  //
  // THIS IS A DUPLICATE AND MUST BE KEPT IN STEP with the DEFAULT_PROXY_URL
  // constant in BOTH provider adapters:
  //   openrouter-embed/providers/azure-openai-v1.js
  //   openrouter-embed/providers/azure-openai-responses.js
  //
  // Copied rather than read because no seam exposes it. Measured 6 August 2026:
  // a provider object's public surface is id, capabilities, buildRequest,
  // endpoint, parseStreamChunk, parseResponse, streamRequest, request — the
  // constant and readProviderConfig are both closure-private, and neither
  // EmbedProviderRegistry nor EmbedProviderLookup exposes them. endpoint() is
  // the only route to the value, and it returns the full endpoint including the
  // routing path (".../openai/v1/chat/completions"), so deriving a base would
  // mean this file knowing and stripping the provider's path — a WORSE coupling
  // than this copy, because a path change would silently yield a wrong base
  // instead of failing loudly. Giving the providers a real export is the proper
  // fix and is deliberately out of scope for this stage.
  const FOUNDRY_DEFAULT_PROXY_URL =
    "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev";

  /**
   * The proxy URL that will ACTUALLY be used: the stored override when it is a
   * non-empty string, otherwise the built-in default.
   *
   * Why a stored value is not required, and why the card is therefore always
   * configured: the Worker holds the Azure credential server-side, so there is
   * nothing for a colleague to configure. The proxy URL field is an OVERRIDE
   * for pointing at something else (staging, a local Worker), not a
   * prerequisite. Measured after F2-18a armed production: a person with nothing
   * stored reaches the live Worker and gets a correct 401 while signed out —
   * the request arrives, it is simply unauthenticated.
   *
   * @returns {string} A usable proxy URL; never empty.
   */
  function effectiveFoundryProxyUrl() {
    let stored = null;
    try {
      stored = localStorage.getItem("foundryProxyUrl");
    } catch (err) {
      // Unreadable storage cannot remove the built-in default, so fail towards
      // the URL that still works rather than towards "nothing configured".
      logWarn("Could not read foundryProxyUrl; using the built-in default", err);
    }
    if (typeof stored === "string" && stored.trim()) return stored.trim();
    return FOUNDRY_DEFAULT_PROXY_URL;
  }

  /**
   * Whether the Foundry card should report itself configured — i.e. whether a
   * proxy URL will be used. Always true while a built-in default exists; tied
   * to the helper above so that removing the fallback would follow through here
   * automatically rather than leaving a stale `true` behind.
   *
   * @returns {boolean}
   */
  function isFoundryConfigured() {
    return !!effectiveFoundryProxyUrl();
  }

  function loadFoundryCredentials() {
    if (!elements) return;

    const storedUrl = localStorage.getItem("foundryProxyUrl");
    const storedToken = localStorage.getItem("foundry-user-token");

    if (elements.fdyProxyUrlInput) {
      elements.fdyProxyUrlInput.value = storedUrl || "";
    }
    if (elements.fdyUserTokenInput) {
      elements.fdyUserTokenInput.value = storedToken || "";
    }

    // Restore the persisted test result, if any
    const lastResultJson = localStorage.getItem("foundry-test-last-result");
    let lastResult = null;
    if (lastResultJson) {
      try {
        lastResult = JSON.parse(lastResultJson);
      } catch (err) {
        logWarn("Could not parse foundry-test-last-result; ignoring", err);
      }
    }

    updateFoundryStatus(isFoundryConfigured(), lastResult);
    updateFoundryActiveBadge();

    logDebug(
      "Foundry credentials loaded, configured:",
      isFoundryConfigured(),
      "lastResult:",
      lastResult
    );
  }

  function saveFoundryCredentials() {
    if (!elements || !elements.fdyProxyUrlInput) {
      logError("Cannot save Foundry: elements not cached");
      return;
    }

    const proxyUrl = elements.fdyProxyUrlInput.value.trim();
    const userToken = elements.fdyUserTokenInput
      ? elements.fdyUserTokenInput.value.trim()
      : "";

    if (!proxyUrl) {
      logWarn("Foundry save attempted with empty proxy URL");
      announce("Please enter a proxy URL before saving.");
      return;
    }

    localStorage.setItem("foundryProxyUrl", proxyUrl);
    if (userToken) {
      localStorage.setItem("foundry-user-token", userToken);
    } else {
      localStorage.removeItem("foundry-user-token");
    }

    // Preserve any existing persisted test result so reloads and saves
    // don't lose the green "Connected (Xms)" state.
    const lastResultJson = localStorage.getItem("foundry-test-last-result");
    let lastResult = null;
    if (lastResultJson) {
      try {
        lastResult = JSON.parse(lastResultJson);
      } catch (err) {
        logWarn("Could not parse foundry-test-last-result; ignoring", err);
      }
    }

    updateFoundryStatus(true, lastResult);
    emitCredentialChange("foundry", "saved");
    announce("Foundry credentials saved successfully.");
    logInfo("Foundry credentials saved");
  }

  function clearFoundryCredentials() {
    if (typeof window.safeConfirm === "function") {
      window.safeConfirm(
        "Are you sure you want to clear your Foundry credentials? This will also remove the last test result.",
        "Clear Foundry Credentials"
      ).then(function (confirmed) {
        if (confirmed) {
          performClearFoundryCredentials();
        }
      });
    } else {
      if (
        confirm(
          "Are you sure you want to clear your Foundry credentials? This will also remove the last test result."
        )
      ) {
        performClearFoundryCredentials();
      }
    }
  }

  function performClearFoundryCredentials() {
    localStorage.removeItem("foundryProxyUrl");
    localStorage.removeItem("foundry-user-token");
    localStorage.removeItem("foundry-test-last-result");

    if (elements) {
      if (elements.fdyProxyUrlInput) {
        elements.fdyProxyUrlInput.value = "";
      }
      if (elements.fdyUserTokenInput) {
        elements.fdyUserTokenInput.value = "";
      }
    }

    // Clearing removes the OVERRIDE, not the provider: the built-in default
    // still applies, so the card stays configured and — with the stored test
    // result gone too — falls back to "Configured (not tested)". Passing false
    // here would put the card back to claiming a working provider is
    // unavailable, which is the defect this stage exists to remove.
    updateFoundryStatus(isFoundryConfigured(), null);
    emitCredentialChange("foundry", "cleared");
    // Reached only through the confirmation modal — see announceAfterModalClose.
    announceAfterModalClose("Foundry credentials cleared.");
    logInfo("Foundry credentials cleared");
  }

  function toggleFoundryVisibility() {
    if (!elements || !elements.fdyUserTokenInput || !elements.fdyToggleBtn) return;

    const input = elements.fdyUserTokenInput;
    const btn = elements.fdyToggleBtn;

    if (input.type === "password") {
      input.type = "text";
      btn.setAttribute("aria-label", "Hide user token");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Hide"));
      }
    } else {
      input.type = "password";
      btn.setAttribute("aria-label", "Show user token");
      const iconSpan = btn.querySelector("[data-icon]");
      if (iconSpan) {
        btn.innerHTML = "";
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(" Show"));
      }
    }
  }

  async function testFoundryConnection() {
    if (!elements || !elements.fdyProxyUrlInput || !elements.fdyTestBtn) {
      logError("Cannot test Foundry: elements not cached");
      return;
    }

    const inputUrl = elements.fdyProxyUrlInput.value.trim();
    const inputToken = elements.fdyUserTokenInput
      ? elements.fdyUserTokenInput.value.trim()
      : "";

    // Read stored state BEFORE the empty-field guard, which now depends on it.
    const storedUrl = localStorage.getItem("foundryProxyUrl") || "";
    const storedToken = localStorage.getItem("foundry-user-token") || "";

    // An empty field is no longer a refusal on its own. With nothing stored the
    // built-in default applies and IS testable — refusing there told a
    // colleague to configure something that already works, and withheld the one
    // button that would have reassured them. It still refuses when something IS
    // stored, because an emptied field disagrees with the stored value and
    // testing the stored one would mislead — the same reasoning as the
    // save-first check below.
    if (!inputUrl && storedUrl) {
      announce("Please enter and save a proxy URL first.");
      return;
    }

    // Require an explicit save before testing so the test always reflects
    // the persisted value (the value the provider actually uses). Unchanged:
    // with both the field and storage empty the two already agree, so this does
    // not fire and the default case falls through to the test below.
    if (inputUrl !== storedUrl || inputToken !== storedToken) {
      announce("Please save your credentials first.");
      return;
    }

    // Test the URL that will ACTUALLY be used — the stored override when there
    // is one, otherwise the built-in default. Strip trailing slash before
    // appending /test.
    const baseUrl = effectiveFoundryProxyUrl().replace(/\/+$/, "");
    const testUrl = baseUrl + "/test";

    const btn = elements.fdyTestBtn;
    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Testing…";

    if (elements.fdyStatusBadge) {
      setStatusText(elements.fdyStatusBadge, "Testing…");
      elements.fdyStatusBadge.className =
        "setup-credential-summary-status setup-status-not-configured";
    }

    // The badge write above is silent (see setStatusText). Every other state here
    // already has its own announce(); entering the test did not, and relied on the
    // badge's aria-live. Announced explicitly so removing that live region did not
    // take a state with it — the request can take a few seconds, and silence while
    // waiting is indistinguishable from the button not having worked.
    announce("Testing the Foundry connection…");

    // Token precedence mirrors the providers' readProviderConfig
    // (openrouter-embed/providers/azure-openai-v1.js and -responses.js): the
    // Entra token first, then the legacy localStorage value. Set Up has no
    // explicit-config tier, so those are the only two.
    //
    // ensureFresh, NOT getCachedToken, for two reasons:
    //   - this function is already async, so there is a natural await point.
    //     The providers use the synchronous cached read only because endpoint()
    //     is synchronous and cannot await.
    //   - pressing Test Connection is a deliberate question, so a token near
    //     expiry deserves renewing rather than sending stale. A nearly-dead
    //     token would report "Sign-in expired" to somebody signed in perfectly
    //     well — the opposite of what the button is for.
    //
    // THE GUARD IS ON THE RETURN VALUE, NOT ON A CATCH. ensureFresh resolves to
    // null on every failure: acquire() in auth/entra-auth.js catches internally
    // and returns null for an unknown scope, for no signed-in account, and for
    // a failed silent acquisition. Treating a catch as the failure path would
    // be dead code. The try/catch below is defence against a synchronous throw
    // from some future refactor, not the failure path.
    let entraToken = null;
    try {
      if (
        window.EntraAuth &&
        typeof window.EntraAuth.ensureFresh === "function" &&
        typeof window.EntraAuth.isSignedIn === "function" &&
        window.EntraAuth.isSignedIn()
      ) {
        const fresh = await window.EntraAuth.ensureFresh(FOUNDRY_ENTRA_SCOPE_NAME);
        // Non-empty string only. A promise, a number or an object here would
        // otherwise reach the header as "[object Promise]".
        if (typeof fresh === "string" && fresh.trim()) {
          entraToken = fresh.trim();
        }
      }
    } catch (err) {
      logWarn(
        "EntraAuth.ensureFresh threw; falling back to the stored token",
        err
      );
    }

    const headers = { "Content-Type": "application/json" };
    let tokenSource = "none";
    if (entraToken) {
      headers["x-user-token"] = entraToken;
      tokenSource = "entra";
    } else if (storedToken) {
      headers["x-user-token"] = storedToken;
      tokenSource = "localStorage";
    }

    // The TIER ONLY — never the token, and never any part of it.
    logDebug("Foundry test token tier: " + tokenSource);

    const startTime = performance.now();
    let result;

    try {
      const response = await fetch(testUrl, {
        method: "POST",
        headers: headers,
      });

      let payload;
      try {
        payload = await response.json();
      } catch (parseErr) {
        logWarn("Foundry /test response was not valid JSON", parseErr);
        result = {
          ok: false,
          timestamp: Date.now(),
          message: "Invalid response from proxy",
          stage: "parse-error",
          elapsedMs: Math.round(performance.now() - startTime),
        };
      }

      if (!result) {
        const elapsedMs =
          typeof payload.elapsedMs === "number"
            ? payload.elapsedMs
            : Math.round(performance.now() - startTime);

        // The branch ORDER below is the design — it encodes who can fix the
        // problem. HTTP-level Worker faults (500 config, 502 network) outrank
        // a sign-in problem, because they block everyone and only the Worker's
        // operator can fix them. Then an armed gate with a non-valid sign-in
        // outranks the stage branches, because /test sits above the Entra gate
        // on purpose and answers 200 stage "success" even to a signed-out
        // caller. Only then are the Worker's four stage values read, exactly
        // as before.
        //
        // ROLLBACK GUARANTEE: production's /test carries neither `armed` nor
        // `auth`. payload.armed === true is strict, so an undefined `armed`
        // (production today) falls straight through to the stage branches and
        // behaviour is byte-identical to before this change. Arming is never
        // inferred from the presence of `auth` alone.
        if (response.status === 500) {
          result = {
            ok: false,
            timestamp: Date.now(),
            message: "Worker misconfigured",
            stage: "config",
            elapsedMs: elapsedMs,
          };
        } else if (response.status === 502) {
          result = {
            ok: false,
            timestamp: Date.now(),
            message: "Cannot reach Azure",
            stage: "network",
            elapsedMs: elapsedMs,
          };
        } else if (payload.armed === true && payload.auth !== "valid") {
          // The gate is in force and this person cannot use Foundry, whatever
          // else the payload says. These "auth-*" stage values are LOCAL to
          // Set Up's own result object and its localStorage record — they are
          // NOT the Worker's four stage values (config, network, azure,
          // success) and must never be sent anywhere. The name collision is
          // otherwise a trap.
          const authResultsByAuthState = {
            absent: { stage: "auth-required", message: "Sign in to use Foundry" },
            expired: { stage: "auth-expired", message: "Sign-in expired" },
            invalid: { stage: "auth-invalid", message: "Sign-in not valid" },
            forbidden: { stage: "auth-forbidden", message: "Account not permitted" },
            unavailable: { stage: "auth-unavailable", message: "Could not check sign-in" },
          };
          const mapped = authResultsByAuthState[payload.auth] || {
            stage: "auth-unknown",
            message: "Sign-in state not recognised",
          };
          result = {
            ok: false,
            timestamp: Date.now(),
            message: mapped.message,
            stage: mapped.stage,
            elapsedMs: elapsedMs,
          };
        } else if (payload.ok && payload.stage === "success") {
          result = {
            ok: true,
            timestamp: Date.now(),
            message: "Connected (" + elapsedMs + "ms)",
            stage: "success",
            elapsedMs: elapsedMs,
          };
        } else if (payload.stage === "config") {
          result = {
            ok: false,
            timestamp: Date.now(),
            message: "Worker misconfigured",
            stage: "config",
            elapsedMs: elapsedMs,
          };
        } else if (payload.stage === "network") {
          result = {
            ok: false,
            timestamp: Date.now(),
            message: "Cannot reach Azure",
            stage: "network",
            elapsedMs: elapsedMs,
          };
        } else if (payload.stage === "azure") {
          const detail = (payload.error || "").toString().slice(0, 60);
          result = {
            ok: false,
            timestamp: Date.now(),
            message: detail ? "Azure error: " + detail : "Azure error",
            stage: "azure",
            elapsedMs: elapsedMs,
          };
        } else {
          // Unknown stage — treat as parse error so it's visible to the user
          result = {
            ok: false,
            timestamp: Date.now(),
            message: "Invalid response from proxy",
            stage: "parse-error",
            elapsedMs: elapsedMs,
          };
        }
      }
    } catch (fetchErr) {
      logWarn("Foundry /test fetch failed", fetchErr);
      result = {
        ok: false,
        timestamp: Date.now(),
        message: "Cannot reach proxy",
        stage: "proxy-unreachable",
        elapsedMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      localStorage.setItem(
        "foundry-test-last-result",
        JSON.stringify(result)
      );
    } catch (storeErr) {
      logWarn("Could not persist foundry-test-last-result", storeErr);
    }

    updateFoundryStatus(true, result);

    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;

    // Auth results announce the actionable sentence rather than the terse
    // badge text. auth-forbidden deliberately does NOT tell anyone to sign in
    // again — signing in again will not help, and sending a person round that
    // loop is worse than saying nothing.
    const authAnnouncements = {
      "auth-required":
        "Foundry needs University sign-in. Sign in above, then test again.",
      "auth-expired": "Your sign-in has expired. Sign in again, then test again.",
      "auth-invalid":
        "Your sign-in is not valid. Sign in again, then test again.",
      "auth-forbidden": "Your account is not permitted to use Foundry.",
      "auth-unavailable":
        "Foundry could not check your sign-in just now. Try again shortly.",
      "auth-unknown": "Foundry reported a sign-in state that was not recognised.",
    };
    if (authAnnouncements[result.stage]) {
      announce(authAnnouncements[result.stage]);
    } else {
      announce(
        result.ok
          ? "Foundry connection successful: " + result.message + "."
          : "Foundry connection failed: " + result.message + "."
      );
    }
    logInfo("Foundry test completed", result);
  }

  function updateFoundryStatus(isConfigured, lastResult) {
    if (!elements || !elements.fdyStatusBadge) return;

    let badgeText;
    let badgeClass;

    if (!isConfigured) {
      badgeText = "Not configured";
      badgeClass = "setup-status-not-configured";
    } else if (
      lastResult &&
      lastResult.ok &&
      lastResult.stage === "success"
    ) {
      badgeText = "Connected (" + lastResult.elapsedMs + "ms)";
      badgeClass = "setup-status-configured";
    } else if (lastResult) {
      badgeText = lastResult.message || "Last test failed";
      badgeClass = "setup-status-not-configured";
    } else {
      badgeText = "Configured (not tested)";
      badgeClass = "setup-status-not-configured";
    }

    setStatusText(elements.fdyStatusBadge, badgeText);
    elements.fdyStatusBadge.className =
      "setup-credential-summary-status " + badgeClass;

    // Summary row (added in Task 3.3b) — simpler text mapping than the badge.
    // Four outcomes: "Not configured" / "Sign-in needed" (added at stage 9b) /
    // "Connection error (last test)" / "Configured".
    let summaryText;
    let summaryClass;
    if (!isConfigured) {
      summaryText = "Not configured";
      summaryClass = "setup-status-not-configured";
    } else if (
      lastResult &&
      typeof lastResult.stage === "string" &&
      lastResult.stage.indexOf("auth-") === 0
    ) {
      // A sign-in problem is not a connection error — nothing is erroring.
      summaryText = "Sign-in needed";
      summaryClass = "setup-status-not-configured";
    } else if (lastResult && lastResult.ok === false) {
      summaryText = "Connection error (last test)";
      summaryClass = "setup-status-error";
    } else {
      summaryText = "Configured";
      summaryClass = "setup-status-configured";
    }

    if (elements.summaryFdyValue) {
      setStatusText(elements.summaryFdyValue, summaryText);
    }
    if (elements.summaryFdyItem) {
      elements.summaryFdyItem.className = "setup-status-item " + summaryClass;
    }
  }

  function updateFoundryActiveBadge() {
    if (!elements || !elements.fdyActiveBadge) return;

    if (
      window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
    ) {
      const active = window.ProviderSwitcher.getActive();
      // The ProviderSwitcher's canonical id for Foundry is 'azure-openai'
      // (with label "Microsoft Foundry"). The string 'foundry' is NOT a
      // valid provider id.
      elements.fdyActiveBadge.hidden = active !== "azure-openai";
    } else {
      elements.fdyActiveBadge.hidden = true;
    }
  }

  // ============================================================
  // Foundry / sign-in state reconciliation (F2 stage 15a)
  // ============================================================
  // A stored Foundry test result is a measurement taken under ONE sign-in
  // state, and it can stop being true when that state changes — in BOTH
  // directions. Stage 9b handled only the first; both now live here:
  //
  //   signed OUT — a stored success is no longer true. Replaced with an
  //     auth-required result, exactly as 9b did, so the row reads
  //     "Sign-in needed".
  //   signed IN  — a stored auth-* failure is no longer true. The key is
  //     DELETED.
  //
  // DELETION IS DELIBERATE, NOT LAZINESS. An absent key already renders the
  // target state through updateFoundryStatus's existing else branches —
  // summary "Configured", badge "Configured (not tested)" — so no new branch
  // is needed there. A synthetic replacement object would carry ok === false
  // and render "Connection error (last test)", which would be wrong: nothing
  // is erroring.
  //
  // EVERY auth-* VALUE IS DISCARDED, INCLUDING auth-forbidden. That result was
  // measured under a different sign-in state, possibly for a different person,
  // so keeping it would assert something about the newly signed-in person that
  // has not been measured. Deleting it says "we do not know yet", which is
  // true, and the next Test Connection settles it. This does NOT contradict
  // the auth-forbidden announcement in testFoundryConnection, which rightly
  // does not tell that person to sign in again: that is wording for a result
  // just measured, this is a result that is no longer current.
  //
  // The stage test is the same PREFIX match updateFoundryStatus itself uses
  // (indexOf("auth-") === 0) rather than an enumerated list, so a future
  // auth-* value is covered without a second edit here.
  //
  // THIS FUNCTION NEVER ANNOUNCES. Nothing else in this file announces on a
  // summary write; the summary row and the badge carry no aria-live and no
  // role, so the re-render is silent; and renderSignInState already speaks the
  // sign-in state through announce(). A second announcement here would make
  // one action speak twice.
  //
  // Idempotent by construction: each branch removes the very condition it
  // tests on, so a second call carrying the same state falls through and does
  // nothing.
  function reconcileFoundryWithSignInState(detail) {
    const state = detail || {};
    const signedOut =
      state.isSignedIn === false || state.reason === "renewal-failed";
    const signedIn = state.isSignedIn === true;
    if (!signedOut && !signedIn) return;

    let lastResult = null;
    try {
      const lastResultJson = localStorage.getItem("foundry-test-last-result");
      if (!lastResultJson) return;
      lastResult = JSON.parse(lastResultJson);
    } catch (err) {
      logWarn("Could not read foundry-test-last-result; ignoring", err);
      return;
    }
    if (!lastResult) return;

    if (signedOut) {
      if (lastResult.ok !== true) return;

      const replacement = {
        ok: false,
        timestamp: Date.now(),
        message: "Sign in to use Foundry",
        stage: "auth-required",
        elapsedMs: null,
      };
      try {
        localStorage.setItem(
          "foundry-test-last-result",
          JSON.stringify(replacement),
        );
      } catch (storeErr) {
        logWarn("Could not persist foundry-test-last-result", storeErr);
      }
      updateFoundryStatus(isFoundryConfigured(), replacement);
      logInfo("Stored Foundry success cleared after sign-out");
      return;
    }

    // Signed in: discard a stored sign-in failure, and only that. A success,
    // or a real connection failure such as stage "config", is a measurement
    // signing in does not invalidate — it survives untouched.
    if (
      typeof lastResult.stage !== "string" ||
      lastResult.stage.indexOf("auth-") !== 0
    ) {
      return;
    }
    try {
      localStorage.removeItem("foundry-test-last-result");
    } catch (removeErr) {
      logWarn("Could not remove foundry-test-last-result", removeErr);
      return;
    }
    updateFoundryStatus(isFoundryConfigured(), null);
    logInfo("Stored Foundry sign-in failure discarded after sign-in");
  }

  // ============================================================
  // University sign-in card (F2 stage 9a)
  // ============================================================
  // Renders the sign-in card's five states. The badge deliberately carries NO
  // aria-live (see the comment above #setup-signin in tools.html): announce()
  // is the single audible channel, and announce() does no change detection of
  // its own, so the last announced string is held here and compared before
  // announcing. The transient "Checking" state at load is rendered silently —
  // announcing it would speak on every page load before the state has settled.
  const SIGN_IN_STATES = Object.freeze({
    CHECKING: "checking",
    SIGNED_OUT: "signedOut",
    SIGNED_IN: "signedIn",
    EXPIRED: "expired",
    UNAVAILABLE: "unavailable",
  });

  let lastSignInAnnouncement = null;

  function renderSignInState(state, username) {
    if (!elements) return;

    let badgeText;
    switch (state) {
      case SIGN_IN_STATES.CHECKING:
        badgeText = "Checking";
        break;
      case SIGN_IN_STATES.SIGNED_IN:
        badgeText = "Signed in as " + username;
        break;
      case SIGN_IN_STATES.EXPIRED:
        badgeText = "Sign-in expired, please sign in again";
        break;
      case SIGN_IN_STATES.UNAVAILABLE:
        badgeText = "Sign-in is not available just now";
        break;
      default:
        badgeText = "Not signed in";
    }

    if (elements.signinStatusBadge) {
      setStatusText(elements.signinStatusBadge, badgeText);
    }

    // Both buttons navigate the whole page away when used, so no focus
    // management is needed — and none is done, because on the renewal-failed
    // path nothing navigates and moving focus would be disruptive.
    if (elements.signinBtn) {
      elements.signinBtn.disabled =
        state === SIGN_IN_STATES.CHECKING ||
        state === SIGN_IN_STATES.UNAVAILABLE;
      elements.signinBtn.hidden = state === SIGN_IN_STATES.SIGNED_IN;
    }
    if (elements.signoutBtn) {
      elements.signoutBtn.hidden =
        state !== SIGN_IN_STATES.SIGNED_IN && state !== SIGN_IN_STATES.EXPIRED;
      elements.signoutBtn.disabled = false;
    }

    const announcement = "University sign-in: " + badgeText + ".";
    if (
      state !== SIGN_IN_STATES.CHECKING &&
      announcement !== lastSignInAnnouncement
    ) {
      lastSignInAnnouncement = announcement;
      announce(announcement);
    }

    logDebug("Sign-in card state rendered:", state);
  }

  async function initSignIn() {
    // Render immediately so the card never sits on the static markup's
    // "Not yet available" while the promise settles.
    renderSignInState(SIGN_IN_STATES.CHECKING, null);

    // EntraAuth fires NO change event when window.msal is absent — its runInit
    // returns early before the try/finally that dispatches "init". So the
    // first render must come from awaiting init(), never from the event, and
    // both dependencies are checked here rather than waited on.
    if (!window.EntraAuth) {
      logWarn("window.EntraAuth is unavailable — sign-in card disabled");
      renderSignInState(SIGN_IN_STATES.UNAVAILABLE, null);
      return;
    }
    if (!window.msal) {
      logWarn("window.msal is unavailable — sign-in card disabled");
      renderSignInState(SIGN_IN_STATES.UNAVAILABLE, null);
      return;
    }

    // Registered BEFORE awaiting init(), so a fast redirect return-leg event
    // cannot be missed. There is no distinct sign-in reason — the return leg
    // surfaces as reason "init" with isSignedIn true — so state is read from
    // detail.isSignedIn; detail.reason matters only for "renewal-failed".
    window.addEventListener(window.EntraAuth.CHANGE_EVENT, function (event) {
      const detail = event && event.detail ? event.detail : {};
      if (detail.reason === "renewal-failed") {
        renderSignInState(SIGN_IN_STATES.EXPIRED, null);
      } else if (detail.isSignedIn === true) {
        renderSignInState(SIGN_IN_STATES.SIGNED_IN, detail.username);
      } else {
        renderSignInState(SIGN_IN_STATES.SIGNED_OUT, null);
      }
    });

    try {
      // Idempotent: EntraAuth holds the in-flight promise, so this is safe
      // even if another consumer has already called it.
      await window.EntraAuth.init();
    } catch (error) {
      logError("EntraAuth.init() failed", error);
      renderSignInState(SIGN_IN_STATES.UNAVAILABLE, null);
      return;
    }

    const account = window.EntraAuth.getAccount();
    const signedIn = window.EntraAuth.isSignedIn() && !!account;
    if (signedIn) {
      renderSignInState(SIGN_IN_STATES.SIGNED_IN, account.username);
    } else {
      renderSignInState(SIGN_IN_STATES.SIGNED_OUT, null);
    }

    // The same settled read, for the Foundry summary (F2 stage 15a). The
    // sign-in card has always guarded against a missed change event by reading
    // the state here rather than relying on the event alone; the Foundry
    // summary had no equivalent, so an event that fired before this file
    // registered its listener would leave a stale "Sign-in needed" on the row.
    // Reconciling from the same settled read closes that asymmetry. Running
    // alongside the listener is safe: the second call carrying the same state
    // is a no-op.
    reconcileFoundryWithSignInState({ isSignedIn: signedIn });
  }

  function signInWithEntra() {
    if (!window.EntraAuth) {
      logWarn("Sign-in requested but window.EntraAuth is unavailable");
      return;
    }
    // signIn() NAVIGATES AWAY to Microsoft — nothing after this call runs.
    // The state change is announced by the card render, not here.
    window.EntraAuth.signIn();
  }

  function signOutOfEntra() {
    if (!window.EntraAuth) {
      logWarn("Sign-out requested but window.EntraAuth is unavailable");
      return;
    }
    // signOut() NAVIGATES AWAY to Microsoft — nothing after this call runs.
    window.EntraAuth.signOut();
  }

  // ============================================================
  // Status updates
  // ============================================================
  function updateOpenRouterStatus(isConfigured) {
    if (!elements) return;

    const badgeText = isConfigured ? "Configured" : "Not configured";
    const badgeClass = isConfigured
      ? "setup-status-configured"
      : "setup-status-not-configured";

    // Update credential section badge
    if (elements.orStatusBadge) {
      setStatusText(elements.orStatusBadge, badgeText);
      elements.orStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }

    // Update summary panel
    if (elements.summaryOrValue) {
      setStatusText(elements.summaryOrValue, badgeText);
    }
    if (elements.summaryOrItem) {
      elements.summaryOrItem.className =
        "setup-status-item " + badgeClass;
    }
  }

  function updateModelStatusSummary() {
    if (!elements || !elements.summaryModelsValue) return;

    // Build per-type model groups, deduplicated across managers.
    var groups = [];

    function addGroup(label, iconName, mgr, filterFn) {
      if (!mgr || typeof mgr.getRegisteredModels !== "function") return;
      var list = mgr.getRegisteredModels();
      if (filterFn) list = list.filter(filterFn);
      if (!list.length) return;
      var dl = list.filter(function (m) {
        return m.state === "cached" || m.state === "loaded";
      }).length;
      groups.push({
        label: label,
        icon: iconName,
        total: list.length,
        downloaded: dl,
      });
    }

    // Dedup: text models are owned by LocalTextModelManager. The image manager
    // re-registers three of them flagged type:'text' — exclude those here so
    // they are not counted twice.
    addGroup("Vision", "image", window.ImageDescriberModelManager, function (m) {
      return m.type !== "text";
    });
    addGroup("Text", "document", window.LocalTextModelManager, null);
    addGroup("Speech", "speaker", window.TTSNeuralGateway, null);

    var total = groups.reduce(function (s, g) {
      return s + g.total;
    }, 0);
    var downloaded = groups.reduce(function (s, g) {
      return s + g.downloaded;
    }, 0);

    if (total === 0) {
      setStatusText(elements.summaryModelsValue, "Not available");
      if (elements.summaryModelsTypes) elements.summaryModelsTypes.innerHTML = "";
      if (elements.summaryModelsItem) {
        elements.summaryModelsItem.className =
          "setup-status-item setup-status-not-configured";
        elements.summaryModelsItem.style.removeProperty("--setup-fill");
      }
      return;
    }

    // Single source of truth for the percentage: drives both the displayed text
    // and the progress-bar fill, so the number and the bar can never disagree.
    var fillPercent = Math.round((downloaded / total) * 100);

    var text =
      downloaded + " of " + total + " downloaded (" + fillPercent + "%)";
    setStatusText(elements.summaryModelsValue, text);

    // Per-type chips (icon + count). Inline getIcon() so the SVGs populate
    // without a follow-up refreshIcons() call. Labels are static strings, so
    // building the markup with innerHTML is safe here.
    if (elements.summaryModelsTypes) {
      elements.summaryModelsTypes.innerHTML = groups
        .map(function (g) {
          var icon =
            typeof window.getIcon === "function" ? window.getIcon(g.icon) : "";
          return (
            '<span class="setup-type-chip">' +
            icon +
            '<span aria-hidden="true">' +
            g.label +
            " " +
            g.downloaded +
            "/" +
            g.total +
            "</span>" +
            '<span class="visually-hidden">' +
            g.label +
            " models: " +
            g.downloaded +
            " of " +
            g.total +
            " downloaded.</span>" +
            "</span>"
          );
        })
        .join("");
    }

    var statusClass = downloaded === total
      ? "setup-status-configured"
      : downloaded > 0
        ? "setup-status-partial"
        : "setup-status-not-configured";

    if (elements.summaryModelsItem) {
      elements.summaryModelsItem.className = "setup-status-item " + statusClass;
      // Drive the progress-bar fill (see .setup-status-partial in light.css/dark.css).
      // Decorative only — the aria-live value span is the accessible source of truth.
      elements.summaryModelsItem.style.setProperty(
        "--setup-fill",
        fillPercent + "%"
      );
    }

    logDebug("Model status summary updated:", text);
  }

  // Keeps the Ally card following the sign-in state, in both directions.
  //
  // NO DUPLICATE SIGN-IN STATE IS TRACKED HERE, per the ruling this file
  // already records at the Foundry listener registration below: a second copy
  // can drift, and the event's own detail carries everything needed. Non-flip
  // safety comes from IDEMPOTENCE instead — each branch removes the very
  // condition it tests on, so a second event carrying the same state falls
  // through and does nothing. The event fires for several reasons, including
  // "renewal-failed", so that property is what makes it safe to run on all of
  // them.
  //
  // ally-scripts/core/ally-main-controller.js DOES hold a last-known-state
  // flip guard for the same event, and that is correct THERE: its handler
  // calls loadStoredCredentials(), which overwrites the whole form
  // unconditionally, so without a guard a renewal-failed event would discard
  // whatever the colleague had typed. Nothing here is unconditional. Two
  // patterns for one event is deliberate; do not unify them.
  //
  // KNOWN COST, accepted: a colleague who deliberately EMPTIES the client-ID
  // field sees the built-in default return on the next event, because emptying
  // restores the very condition the populate branch tests on. That is the
  // price of idempotence rather than a guard, and it is measured.
  //
  // It never announces: the badge and summary carry no aria-live and no role,
  // so the re-render is silent, and this is not a change the person initiated.
  function reconcileAllyWithSignInState(detail) {
    refreshStatusSummary();

    const input = elements && elements.allyClientIdInput;
    if (!input) return;

    const stored = localStorage.getItem("ally-client-id");
    const defaultClientId =
      typeof ALLY_CONFIG !== "undefined" ? ALLY_CONFIG.DEFAULT_CLIENT_ID : null;

    if (detail && detail.isSignedIn === true) {
      // Populate an EMPTY field only — never write over typed input.
      if (input.value === "") {
        input.value = effectiveAllyClientId();
      }
      return;
    }

    // Signed out: clear only the bare built-in default with nothing stored
    // behind it. A typed value, or one the person saved, is left alone.
    if (defaultClientId && input.value === defaultClientId && !stored) {
      input.value = "";
    }
  }

  function refreshStatusSummary() {
    if (!elements) {
      logDebug("Elements not cached, skipping status refresh");
      return;
    }

    // OpenRouter
    const orConfigured = !!localStorage.getItem("openrouter_api_key");
    updateOpenRouterStatus(orConfigured);

    // MathPix
    const mpConfigured =
      !!localStorage.getItem("mathpix-app-id") &&
      !!localStorage.getItem("mathpix-app-key");
    updateMathPixStatus(mpConfigured);

    // Ally — a client ID plus ONE transport: an API token, or a usable worker.
    // isAllyConfigured() owns that question, so this computation and
    // loadAllyCredentials() cannot drift apart, and both agree with the Ally
    // app about what a stored worker URL has to look like.
    const allyConfigured = isAllyConfigured();
    const allyRegion = localStorage.getItem("ally-region");
    const allyFromSignIn =
      allyConfigured &&
      !localStorage.getItem("ally-api-token") &&
      !localStorage.getItem(ALLY_WORKER_URL_KEY);
    updateAllyStatus(allyConfigured, allyRegion, allyFromSignIn);

    // Foundry (Task 3.3b) — configured whenever a proxy URL will be used, which
    // the built-in default guarantees. See effectiveFoundryProxyUrl.
    const fdyConfigured = isFoundryConfigured();
    let fdyLastResult = null;
    const fdyLastResultJson = localStorage.getItem("foundry-test-last-result");
    if (fdyLastResultJson) {
      try {
        fdyLastResult = JSON.parse(fdyLastResultJson);
      } catch (err) {
        logWarn("Could not parse foundry-test-last-result; ignoring", err);
      }
    }
    updateFoundryStatus(fdyConfigured, fdyLastResult);

    // Local AI models
    updateModelStatusSummary();

    logDebug("Status summary refreshed", {
      openrouter: orConfigured,
      mathpix: mpConfigured,
      ally: allyConfigured,
      foundry: fdyConfigured,
    });
  }

  // ============================================================
  // Initialisation
  // ============================================================
  function init() {
    cacheElements();
    loadOpenRouterKey();
    loadMathPixCredentials();
    loadAllyCredentials();
    loadFoundryCredentials();
    // Not awaited: init() is called synchronously from two places and must
    // stay synchronous. The card renders "Checking" at once and settles when
    // the promise resolves.
    initSignIn();
    refreshStatusSummary();

    // Listen for external credential changes (bidirectional sync — Phase SU-3)
    if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.on === 'function') {
      window.EmbedEventEmitter.on('credentials:changed', function (data) {
        logDebug('Received credentials:changed event', data);
        // Refresh status summary for any credential change
        refreshStatusSummary();
        // Reload the specific service's form values
        if (data && data.service === 'openrouter') {
          loadOpenRouterKey();
        } else if (data && data.service === 'mathpix') {
          loadMathPixCredentials();
        } else if (data && data.service === 'ally') {
          loadAllyCredentials();
        } else if (data && data.service === 'foundry') {
          loadFoundryCredentials();
        }
      });
      logDebug('Bidirectional sync listener registered');

      // Listen for model state changes to keep summary count live
      window.EmbedEventEmitter.on('model:stateChange', function () {
        logDebug('Received model:stateChange event');
        updateModelStatusSummary();
      });
      logDebug('Model state change listener registered');
    }

    // Listen for provider switches so the Foundry "Active" badge follows
    // ProviderSwitcher.getActive(). The switcher dispatches CustomEvent
    // 'provider:changed' on window — there is no subscribe() method.
    window.addEventListener('provider:changed', function (event) {
      logDebug('Received provider:changed event', event && event.detail);
      updateFoundryActiveBadge();
    });
    logDebug('provider:changed listener registered');

    // Keep the Foundry summary following the sign-in state, in both
    // directions (F2 stages 9b and 15a). Both directions live in
    // reconcileFoundryWithSignInState; this is one of its two callers, and it
    // announces nothing — see the comment on that function.
    // No second copy of the sign-in state is tracked (a duplicate can drift);
    // the event's own detail carries everything reconciliation needs.
    if (window.EntraAuth) {
      window.addEventListener(window.EntraAuth.CHANGE_EVENT, function (event) {
        reconcileFoundryWithSignInState(
          event && event.detail ? event.detail : {},
        );
      });
      logDebug("entra:changed Foundry reconciliation listener registered");
    }

    // Same arrangement for the Ally card — see reconcileAllyWithSignInState,
    // which explains why this one tracks no sign-in state of its own.
    window.addEventListener(
      (window.EntraAuth && window.EntraAuth.CHANGE_EVENT) || "entra:changed",
      function (event) {
        reconcileAllyWithSignInState(
          event && event.detail ? event.detail : {},
        );
      },
    );
    logDebug("entra:changed Ally reconciliation listener registered");

    logInfo("Set Up Tool initialised");
  }

  function refresh() {
    if (!elements) {
      cacheElements();
    }
    loadOpenRouterKey();
    loadMathPixCredentials();
    loadAllyCredentials();
    loadFoundryCredentials();
    refreshStatusSummary();
    logDebug("Set Up Tool refreshed");
  }

  // ============================================================
  // Auto-initialise on DOMContentLoaded
  // ============================================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ============================================================
  // Global onclick handlers for inline HTML buttons
  // ============================================================
  window.setupSaveOpenRouter = function () {
    saveOpenRouterKey();
  };

  window.setupClearOpenRouter = function () {
    clearOpenRouterKey();
  };

  window.setupToggleOpenRouter = function () {
    toggleOpenRouterVisibility();
  };

  window.setupSaveMathPix = function () {
    saveMathPixCredentials();
  };

  window.setupClearMathPix = function () {
    clearMathPixCredentials();
  };

  window.setupToggleMathPix = function () {
    toggleMathPixVisibility();
  };

  window.setupSaveAlly = function () {
    saveAllyCredentials();
  };

  window.setupClearAlly = function () {
    clearAllyCredentials();
  };

  window.setupToggleAlly = function () {
    toggleAllyVisibility();
  };

  window.setupSaveFoundry = function () {
    saveFoundryCredentials();
  };

  window.setupClearFoundry = function () {
    clearFoundryCredentials();
  };

  window.setupToggleFoundry = function () {
    toggleFoundryVisibility();
  };

  window.setupTestFoundry = function () {
    testFoundryConnection();
  };

  window.setupSignIn = function () {
    signInWithEntra();
  };

  window.setupSignOut = function () {
    signOutOfEntra();
  };

  // ============================================================
  // Public API
  // ============================================================
  return {
    init: init,
    refresh: refresh,
  };
})();
