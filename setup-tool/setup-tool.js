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

      // Status summary values
      summaryOrValue: document.getElementById("setup-summary-or-value"),
      summaryMpValue: document.getElementById("setup-summary-mp-value"),
      summaryAllyValue: document.getElementById("setup-summary-ally-value"),

      // Status summary items (for styling)
      summaryOrItem: document.getElementById("setup-summary-openrouter"),
      summaryMpItem: document.getElementById("setup-summary-mathpix"),
      summaryAllyItem: document.getElementById("setup-summary-ally"),

      // Model status summary
      summaryModelsValue: document.getElementById("setup-summary-models-value"),
      summaryModelsItem: document.getElementById("setup-summary-models"),
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
  // Event emission
  // ============================================================
  function emitCredentialChange(service, action) {
    if (
      window.EmbedEventEmitter &&
      typeof window.EmbedEventEmitter.emit === "function"
    ) {
      window.EmbedEventEmitter.emit("credentials:changed", {
        service: service,
        action: action,
      });
      logDebug("Emitted credentials:changed", { service: service, action: action });
    } else {
      logDebug("EmbedEventEmitter not available, skipping event emission");
    }
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
      elements.mpStatusBadge.textContent = badgeText;
      elements.mpStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }
    if (elements.summaryMpValue) {
      elements.summaryMpValue.textContent = badgeText;
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
      elements.allyStatusBadge.textContent = badgeText;
      elements.allyStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }

    // Summary shows region when configured
    const summaryText = isConfigured && region
      ? "Configured (" + region + ")"
      : badgeText;
    if (elements.summaryAllyValue) {
      elements.summaryAllyValue.textContent = summaryText;
    }
    if (elements.summaryAllyItem) {
      elements.summaryAllyItem.className = "setup-status-item " + badgeClass;
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
      elements.orStatusBadge.textContent = badgeText;
      elements.orStatusBadge.className =
        "setup-credential-summary-status " + badgeClass;
    }

    // Update summary panel
    if (elements.summaryOrValue) {
      elements.summaryOrValue.textContent = badgeText;
    }
    if (elements.summaryOrItem) {
      elements.summaryOrItem.className =
        "setup-status-item " + badgeClass;
    }
  }

  function updateModelStatusSummary() {
    if (!elements || !elements.summaryModelsValue) return;

    var total = 0;
    var downloaded = 0;

    // Count VLM/analysis models
    if (
      window.ImageDescriberModelManager &&
      typeof window.ImageDescriberModelManager.getRegisteredModels === "function"
    ) {
      var vlmModels = window.ImageDescriberModelManager.getRegisteredModels();
      total += vlmModels.length;
      downloaded += vlmModels.filter(function (m) {
        return m.state === "cached" || m.state === "loaded";
      }).length;
    }

    // Count text models (DE-4b)
    if (
      window.LocalTextModelManager &&
      typeof window.LocalTextModelManager.getRegisteredModels === "function"
    ) {
      var textModels = window.LocalTextModelManager.getRegisteredModels();
      total += textModels.length;
      downloaded += textModels.filter(function (m) {
        return m.state === "cached" || m.state === "loaded";
      }).length;
    }

    if (total === 0) {
      elements.summaryModelsValue.textContent = "Not available";
      if (elements.summaryModelsItem) {
        elements.summaryModelsItem.className =
          "setup-status-item setup-status-not-configured";
      }
      return;
    }

    var text = downloaded + " of " + total + " downloaded";
    elements.summaryModelsValue.textContent = text;

    var statusClass = downloaded === total
      ? "setup-status-configured"
      : downloaded > 0
        ? "setup-status-partial"
        : "setup-status-not-configured";

    if (elements.summaryModelsItem) {
      elements.summaryModelsItem.className = "setup-status-item " + statusClass;
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

    // Local AI models
    updateModelStatusSummary();

    logDebug("Status summary refreshed", {
      openrouter: orConfigured,
      mathpix: mpConfigured,
      ally: allyConfigured,
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

    logInfo("Set Up Tool initialised");
  }

  function refresh() {
    if (!elements) {
      cacheElements();
    }
    loadOpenRouterKey();
    loadMathPixCredentials();
    loadAllyCredentials();
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

  // ============================================================
  // Public API
  // ============================================================
  return {
    init: init,
    refresh: refresh,
  };
})();
