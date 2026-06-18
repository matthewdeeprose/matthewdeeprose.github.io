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
  // Live-region status writes (3.5b follow-up)
  // ============================================================
  // Each aria-live status span in tools.html has the structure
  //   <span aria-live="polite" aria-atomic="true">
  //     <span class="visually-hidden">Provider Name: </span>
  //     <span class="setup-status-text">{text}</span>
  //   </span>
  // The visually-hidden prefix gives screen-reader users context on which
  // provider the announcement refers to. JS must target the inner
  // .setup-status-text span so it doesn't overwrite the prefix.
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
    announce("OpenRouter API key cleared.");
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
    announce("MathPix credentials cleared.");
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
  function loadAllyCredentials() {
    if (!elements) return;

    const storedRegion = localStorage.getItem("ally-region");
    const storedClientId = localStorage.getItem("ally-client-id");
    const storedToken = localStorage.getItem("ally-api-token");
    const storedRemember = localStorage.getItem("ally-save-credentials");

    if (elements.allyRegionSelect && storedRegion) {
      elements.allyRegionSelect.value = storedRegion;
    }
    if (elements.allyClientIdInput) {
      elements.allyClientIdInput.value = storedClientId || "";
    }
    if (elements.allyTokenInput) {
      elements.allyTokenInput.value = storedToken || "";
    }
    if (elements.allyRememberCheckbox) {
      // Default to checked if no stored preference exists
      elements.allyRememberCheckbox.checked =
        storedRemember === null ? true : storedRemember === "true";
    }

    const isConfigured = !!storedToken && !!storedClientId;
    updateAllyStatus(isConfigured, storedRegion);
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

    if (!remember) {
      // Unchecking Remember removes ALL Ally credentials
      performClearAllyCredentials(true);
      return;
    }

    if (!clientId || !token) {
      logWarn("Ally save attempted with missing fields");
      announce("Please enter both a Client ID and API Token before saving.");
      return;
    }

    localStorage.setItem("ally-region", region);
    localStorage.setItem("ally-client-id", clientId);
    localStorage.setItem("ally-api-token", token);
    localStorage.setItem("ally-save-credentials", "true");

    updateAllyStatus(true, region);
    emitCredentialChange("ally", "saved");
    announce("Ally credentials saved successfully for the " + region + " region.");
    logInfo("Ally credentials saved, region:", region);
  }

  function performClearAllyCredentials(fromRememberUncheck) {
    localStorage.removeItem("ally-region");
    localStorage.removeItem("ally-client-id");
    localStorage.removeItem("ally-api-token");
    localStorage.removeItem("ally-save-credentials");

    if (elements) {
      if (elements.allyRegionSelect) {
        elements.allyRegionSelect.value = "EU";
      }
      if (elements.allyClientIdInput) {
        elements.allyClientIdInput.value = "";
      }
      if (elements.allyTokenInput) {
        elements.allyTokenInput.value = "";
      }
      if (elements.allyRememberCheckbox) {
        elements.allyRememberCheckbox.checked = false;
      }
    }

    updateAllyStatus(false, null);
    emitCredentialChange("ally", "cleared");

    if (fromRememberUncheck) {
      announce("Ally credentials removed from browser storage.");
    } else {
      announce("Ally credentials cleared.");
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

  function updateAllyStatus(isConfigured, region) {
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

    // Summary shows region when configured
    const summaryText = isConfigured && region
      ? "Configured (" + region + ")"
      : badgeText;
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

    updateFoundryStatus(!!storedUrl, lastResult);
    updateFoundryActiveBadge();

    logDebug(
      "Foundry credentials loaded, configured:",
      !!storedUrl,
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

    updateFoundryStatus(false, null);
    emitCredentialChange("foundry", "cleared");
    announce("Foundry credentials cleared.");
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

    if (!inputUrl) {
      announce("Please enter and save a proxy URL first.");
      return;
    }

    // Require an explicit save before testing so the test always reflects
    // the persisted value (the value the provider actually uses).
    const storedUrl = localStorage.getItem("foundryProxyUrl") || "";
    const storedToken = localStorage.getItem("foundry-user-token") || "";
    if (inputUrl !== storedUrl || inputToken !== storedToken) {
      announce("Please save your credentials first.");
      return;
    }

    // Strip trailing slash before appending /test
    const baseUrl = storedUrl.replace(/\/+$/, "");
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

    const headers = { "Content-Type": "application/json" };
    if (storedToken) {
      headers["x-user-token"] = storedToken;
    }

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

        if (payload.ok && payload.stage === "success") {
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

    announce(
      result.ok
        ? "Foundry connection successful: " + result.message + "."
        : "Foundry connection failed: " + result.message + "."
    );
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

    // Summary row (added in Task 3.3b) — simpler text mapping than the badge:
    // shows "Not configured" / "Configured" / "Connection error (last test)".
    let summaryText;
    let summaryClass;
    if (!isConfigured) {
      summaryText = "Not configured";
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

    // Ally
    const allyConfigured =
      !!localStorage.getItem("ally-api-token") &&
      !!localStorage.getItem("ally-client-id");
    const allyRegion = localStorage.getItem("ally-region");
    updateAllyStatus(allyConfigured, allyRegion);

    // Foundry (Task 3.3b)
    const fdyConfigured = !!localStorage.getItem("foundryProxyUrl");
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

  // ============================================================
  // Public API
  // ============================================================
  return {
    init: init,
    refresh: refresh,
  };
})();
