/**
 * @fileoverview Ally Cache UI - User Interface Module
 * @module ALLY_CACHE_UI
 * @requires ALLY_CACHE
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 *
 * @description
 * Manages cache-related UI components:
 * - Status indicator (entry count, toggle manager)
 * - Manager panel (list entries, usage bar, clear all)
 * - Cached data banner (shown on cached results)
 * - Update available banner (when fresh data differs)
 * - Offline banner (API unavailable)
 * - Cache browser (select from cached entries)
 */

var ALLY_CACHE_UI = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration
  // ========================================================================

  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.error.apply(console, ["[AllyCacheUI] " + message].concat(args));
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.warn.apply(console, ["[AllyCacheUI] " + message].concat(args));
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[AllyCacheUI] " + message].concat(args));
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[AllyCacheUI] " + message].concat(args));
    }
  }

  // ========================================================================
  // Private State
  // ========================================================================

  var initialised = false;
  var elements = {};
  var browserSelectCallback = null;

  // Report type configuration
  var REPORT_TYPES = {
    "course-report": {
      label: "Course Reports",
      icon: "document",
      ariaLabel: "course report",
    },
    "statement-preview": {
      label: "Statement Previews",
      icon: "eye",
      ariaLabel: "accessibility statement preview",
    },
    "report-builder": {
      label: "Custom Queries",
      icon: "gear",
      ariaLabel: "custom query",
    },
  };

  // ========================================================================
  // DOM Caching
  // ========================================================================

  function cacheElements() {
    elements = {
      // Status indicator
      statusContainer: document.getElementById("ally-cache-status"),
      statusBtn: document.getElementById("ally-cache-status-btn"),
      statusText: document.getElementById("ally-cache-status-text"),

      // Manager panel
      managerPanel: document.getElementById("ally-cache-manager-panel"),
      managerClose: document.getElementById("ally-cache-manager-close"),
      usageFill: document.getElementById("ally-cache-usage-fill"),
      usageText: document.getElementById("ally-cache-usage-text"),
      entriesContainer: document.getElementById("ally-cache-entry-list"),
      emptyMessage: document.getElementById("ally-cache-empty"),
      clearAllBtn: document.getElementById("ally-cache-clear-all"),

      // Offline banner
      offlineBanner: document.getElementById("ally-cache-offline-banner"),
      offlineCount: document.getElementById("ally-cache-offline-count"),
      offlineBrowse: document.getElementById("ally-cache-offline-browse"),
      offlineRetry: document.getElementById("ally-cache-offline-retry"),

      // Cache browser
      cacheBrowser: document.getElementById("ally-cache-browser"),
      browserClose: document.getElementById("ally-cache-browser-close"),
      browserOptions: document.getElementById("ally-cache-browser-options"),
      browserLoad: document.getElementById("ally-cache-browser-load"),
      browserCancel: document.getElementById("ally-cache-browser-cancel"),
    };

    logDebug("Elements cached");
  }

  // ========================================================================
  // Utility Functions
  // ========================================================================

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDateShort(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function getReportTypeConfig(type) {
    return REPORT_TYPES[type] || { label: "Unknown", icon: "document" };
  }

  function announce(message) {
    if (typeof ALLY_UI_MANAGER !== "undefined" && ALLY_UI_MANAGER.announce) {
      ALLY_UI_MANAGER.announce(message);
    }
  }

  function populateIcons() {
    if (typeof IconLibrary !== "undefined" && IconLibrary.populateIcons) {
      IconLibrary.populateIcons();
    }
  }

  // ========================================================================
  // Status Indicator
  // ========================================================================

  function updateStatusIndicator() {
    if (!elements.statusBtn || !elements.statusText) return;

    if (typeof ALLY_CACHE === "undefined") {
      logWarn("ALLY_CACHE not available");
      return;
    }

    var stats = ALLY_CACHE.getStats();
    var count = stats.entryCount;
    var text = count === 0 ? "No cache" : count + " cached";

    elements.statusText.textContent = text;
    elements.statusBtn.setAttribute(
      "aria-label",
      "Cached data: " + count + " items",
    );

    logDebug("Status updated:", text);
  }

  // ========================================================================
  // Manager Panel
  // ========================================================================

  function toggleManagerPanel() {
    if (!elements.managerPanel || !elements.statusBtn) return;

    var isHidden = elements.managerPanel.hidden;

    if (isHidden) {
      openManagerPanel();
    } else {
      closeManagerPanel();
    }
  }

  function openManagerPanel() {
    if (!elements.managerPanel) return;

    renderManagerEntries();
    updateUsageBar();

    elements.managerPanel.hidden = false;
    elements.statusBtn.setAttribute("aria-expanded", "true");

    // Focus close button
    if (elements.managerClose) {
      elements.managerClose.focus();
    }

    announce("Cache manager opened");
    logDebug("Manager panel opened");
  }

  function closeManagerPanel() {
    if (!elements.managerPanel) return;

    elements.managerPanel.hidden = true;
    elements.statusBtn.setAttribute("aria-expanded", "false");

    // Return focus to status button
    if (elements.statusBtn) {
      elements.statusBtn.focus();
    }

    logDebug("Manager panel closed");
  }

  function updateUsageBar() {
    if (!elements.usageFill || !elements.usageText) return;

    var stats = ALLY_CACHE.getStats();
    var percent = stats.usagePercent;
    var sizeText =
      ALLY_CACHE.formatSize(stats.totalSize) +
      " of " +
      ALLY_CACHE.formatSize(stats.maxSize) +
      " (Ally: " +
      ALLY_CACHE.formatSize(stats.allyCacheSize) +
      ")";

    elements.usageFill.style.width = percent + "%";
    elements.usageText.textContent = sizeText;

    // Update meter aria-valuenow
    var usageBar = elements.usageFill.parentElement;
    if (usageBar) {
      usageBar.setAttribute("aria-valuenow", Math.round(percent));
    }

    // Warning/critical states
    elements.usageFill.classList.remove(
      "ally-cache-usage-warning",
      "ally-cache-usage-critical",
    );
    if (percent >= 90) {
      elements.usageFill.classList.add("ally-cache-usage-critical");
    } else if (percent >= 70) {
      elements.usageFill.classList.add("ally-cache-usage-warning");
    }
  }

  function renderManagerEntries() {
    if (!elements.entriesContainer) return;

    var entries = ALLY_CACHE.getAllEntries();

    // Update clear all button state
    if (elements.clearAllBtn) {
      elements.clearAllBtn.disabled = entries.length === 0;
    }

    // Show empty message or entries
    if (entries.length === 0) {
      if (elements.emptyMessage) {
        elements.emptyMessage.hidden = false;
      }
      // Clear the list
      elements.entriesContainer.innerHTML = "";
      return;
    }

    if (elements.emptyMessage) {
      elements.emptyMessage.hidden = true;
    }

    // Build entries HTML (now as list items)
    var html = "";
    entries.forEach(function (item) {
      html += renderEntryHTML(item.key, item.entry);
    });

    // Replace list contents
    elements.entriesContainer.innerHTML = html;

    // Populate icons
    populateIcons();

    // Attach load handlers
    var loadButtons = elements.entriesContainer.querySelectorAll(
      ".ally-cache-entry-load",
    );
    loadButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-cache-key");
        handleLoadEntry(key);
      });
    });

    // Attach remove handlers
    var removeButtons = elements.entriesContainer.querySelectorAll(
      ".ally-cache-entry-remove",
    );
    removeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-cache-key");
        handleRemoveEntry(key);
      });
    });

    logDebug("Rendered", entries.length, "entries");
  }

  function renderEntryHTML(key, entry) {
    var config = getReportTypeConfig(entry.type);
    var name = entry.courseName || entry.queryDescription || "Unknown";
    var code = entry.courseCode ? entry.courseCode + " — " : "";
    var age = ALLY_CACHE.formatAge(entry.timestamp);
    var size = ALLY_CACHE.formatSize(entry.size);
    var typeLabel = config.ariaLabel || "report";

    // Create ISO timestamp for <time> element
    var isoTimestamp = entry.timestamp
      ? new Date(entry.timestamp).toISOString()
      : "";

    return (
      '<li class="ally-cache-entry" data-cache-key="' +
      escapeHtml(key) +
      '">' +
      '<span class="ally-cache-entry-icon" aria-hidden="true" data-icon="' +
      config.icon +
      '"></span>' +
      '<div class="ally-cache-entry-info">' +
      '<strong class="ally-cache-entry-name">' +
      escapeHtml(name) +
      "</strong>" +
      '<span class="ally-cache-entry-meta">' +
      escapeHtml(code) +
      '<time datetime="' +
      isoTimestamp +
      '">' +
      age +
      "</time>" +
      " — " +
      size +
      "</span>" +
      "</div>" +
      '<div class="ally-cache-entry-actions">' +
      '<button type="button" class="ally-cache-entry-load" ' +
      'data-cache-key="' +
      escapeHtml(key) +
      '" ' +
      'aria-label="Load ' +
      escapeHtml(name) +
      " " +
      typeLabel +
      '">' +
      '<span aria-hidden="true" data-icon="external"></span> Load' +
      "</button>" +
      '<button type="button" class="ally-cache-entry-remove" ' +
      'data-cache-key="' +
      escapeHtml(key) +
      '" ' +
      'aria-label="Remove ' +
      escapeHtml(name) +
      " " +
      typeLabel +
      ' from cache">' +
      '<span aria-hidden="true" data-icon="close"></span>' +
      "</button>" +
      "</div>" +
      "</li>"
    );
  }

  function handleRemoveEntry(key) {
    if (!key) return;

    var entry = ALLY_CACHE.get(key);
    var name = entry
      ? entry.courseName || entry.queryDescription || "entry"
      : "entry";

    ALLY_CACHE.remove(key);

    announce("Removed " + name + " from cache");
    logInfo("Removed entry:", key);

    // Re-render if panel is open
    if (elements.managerPanel && !elements.managerPanel.hidden) {
      renderManagerEntries();
      updateUsageBar();
    }
  }

  function handleLoadEntry(key) {
    if (!key) return;

    var entry = ALLY_CACHE.get(key);
    if (!entry) {
      logWarn("Cache entry not found:", key);
      return;
    }

    var name = entry.courseName || entry.queryDescription || "entry";
    logInfo("Loading cached entry:", key);

    // Close manager panel
    closeManagerPanel();

    // Use main controller to handle the load
    if (
      typeof ALLY_MAIN_CONTROLLER !== "undefined" &&
      typeof ALLY_MAIN_CONTROLLER.handleCacheBrowserSelect === "function"
    ) {
      ALLY_MAIN_CONTROLLER.handleCacheBrowserSelect(key, entry);
    } else {
      logWarn("ALLY_MAIN_CONTROLLER.handleCacheBrowserSelect not available");
    }

    announce("Loading " + name);
  }

  function handleClearAll() {
    var stats = ALLY_CACHE.getStats();
    var count = stats.entryCount;

    if (count === 0) return;

    // Confirm before clearing
    if (
      !window.confirm(
        "Clear all " + count + " cached reports? This cannot be undone.",
      )
    ) {
      return;
    }

    ALLY_CACHE.clear();

    announce("Cleared all cached data");
    logInfo("Cleared all cache entries");

    // Re-render
    if (elements.managerPanel && !elements.managerPanel.hidden) {
      renderManagerEntries();
      updateUsageBar();
    }
  }

  // ========================================================================
  // Cached Data Banner
  // ========================================================================

  function showCachedBanner(container, timestamp, isError, isCheckingUpdates) {
    if (!container) return;

    // Default isCheckingUpdates to true for backward compatibility
    if (typeof isCheckingUpdates === "undefined") {
      isCheckingUpdates = true;
    }

    // Remove any existing banner
    hideCachedBanner(container);
    hideUpdateBanner(container);

    var age = ALLY_CACHE.formatAge(timestamp);
    var bannerClass = isError
      ? "ally-cache-banner-error"
      : "ally-cache-banner-cached";
    var iconName = isError ? "warning" : "clock";

    var message;
    if (isError) {
      message =
        'Showing cached data due to API error. Data from <span class="ally-cache-banner-age">' +
        age +
        "</span>.";
    } else if (isCheckingUpdates) {
      message =
        'Showing cached data from <span class="ally-cache-banner-age">' +
        age +
        "</span>. Check for updates?";
    } else {
      message =
        'Showing cached data from <span class="ally-cache-banner-age">' +
        age +
        "</span>.";
    }

    var html =
      '<div class="ally-cache-banner ' +
      bannerClass +
      '" id="ally-cache-data-banner" role="status">' +
      '<span class="ally-cache-banner-icon" aria-hidden="true" data-icon="' +
      iconName +
      '"></span>' +
      '<span class="ally-cache-banner-text">' +
      message +
      "</span>" +
      '<button type="button" class="ally-cache-refresh-btn" id="ally-cache-refresh-btn">' +
      '<span aria-hidden="true" data-icon="refresh"></span> Refresh' +
      "</button>" +
      "</div>";

    container.insertAdjacentHTML("afterbegin", html);
    populateIcons();

    logDebug(
      "Showing cached banner, age:",
      age,
      "isError:",
      isError,
      "checkingUpdates:",
      isCheckingUpdates,
    );
  }

  function hideCachedBanner(container) {
    if (!container) return;

    var banner = container.querySelector("#ally-cache-data-banner");
    if (banner) {
      banner.remove();
      logDebug("Hid cached banner");
    }
  }

  // ========================================================================
  // Update Available Banner
  // ========================================================================

  function showUpdateBanner(container, onApply) {
    if (!container) return;

    // Remove cached banner first
    hideCachedBanner(container);
    hideUpdateBanner(container);

    var html =
      '<div class="ally-cache-banner ally-cache-banner-update" id="ally-cache-update-banner" role="status">' +
      '<span class="ally-cache-banner-icon" aria-hidden="true" data-icon="refresh"></span>' +
      '<span class="ally-cache-banner-text">Updated data is available.</span>' +
      '<button type="button" class="ally-cache-apply-btn" id="ally-cache-apply-btn">' +
      "Apply Update" +
      "</button>" +
      "</div>";

    container.insertAdjacentHTML("afterbegin", html);
    populateIcons();

    // Attach handler
    var applyBtn = container.querySelector("#ally-cache-apply-btn");
    if (applyBtn && typeof onApply === "function") {
      applyBtn.addEventListener("click", function () {
        onApply();
      });
    }

    announce("Updated data is available");
    logDebug("Showing update banner");
  }

  function hideUpdateBanner(container) {
    if (!container) return;

    var banner = container.querySelector("#ally-cache-update-banner");
    if (banner) {
      banner.remove();
      logDebug("Hid update banner");
    }
  }

  // ========================================================================
  // Offline Banner
  // ========================================================================

  function showOfflineBanner() {
    if (!elements.offlineBanner) return;

    var stats = ALLY_CACHE.getStats();
    var count = stats.entryCount;

    if (elements.offlineCount) {
      elements.offlineCount.textContent =
        count > 0
          ? "You have " +
            count +
            " cached report" +
            (count === 1 ? "" : "s") +
            " available."
          : "No cached reports available.";
    }

    // Disable browse if no entries
    if (elements.offlineBrowse) {
      elements.offlineBrowse.disabled = count === 0;
    }

    elements.offlineBanner.hidden = false;
    announce("API unavailable. " + count + " cached reports available.");
    logInfo("Showing offline banner, cached count:", count);
  }

  function hideOfflineBanner() {
    if (!elements.offlineBanner) return;

    elements.offlineBanner.hidden = true;
    logDebug("Hid offline banner");
  }

  // ========================================================================
  // Cache Browser
  // ========================================================================

  function showCacheBrowser(onSelect) {
    if (!elements.cacheBrowser) return;

    browserSelectCallback = onSelect;

    renderBrowserOptions();

    elements.cacheBrowser.hidden = false;

    // Focus first option or close button
    var firstRadio = elements.browserOptions.querySelector(
      'input[type="radio"]',
    );
    if (firstRadio) {
      firstRadio.focus();
    } else if (elements.browserClose) {
      elements.browserClose.focus();
    }

    var stats = ALLY_CACHE.getStats();
    announce(
      "Cache browser opened. " +
        stats.entryCount +
        " cached reports available.",
    );
    logDebug("Cache browser opened");
  }

  function hideCacheBrowser() {
    if (!elements.cacheBrowser) return;

    elements.cacheBrowser.hidden = true;
    browserSelectCallback = null;

    logDebug("Cache browser closed");
  }

  function renderBrowserOptions() {
    if (!elements.browserOptions) return;

    var entries = ALLY_CACHE.getAllEntries();

    if (entries.length === 0) {
      elements.browserOptions.innerHTML =
        '<p class="ally-cache-empty">No cached reports available.</p>';
      if (elements.browserLoad) {
        elements.browserLoad.disabled = true;
      }
      return;
    }

    // Group by type
    var grouped = {
      "course-report": [],
      "statement-preview": [],
      "report-builder": [],
    };

    entries.forEach(function (item) {
      var type = item.entry.type;
      if (grouped[type]) {
        grouped[type].push(item);
      }
    });

    // Build HTML
    var html = "";
    var isFirst = true;

    Object.keys(grouped).forEach(function (type) {
      var items = grouped[type];
      if (items.length === 0) return;

      var config = getReportTypeConfig(type);

      // Group heading
      html +=
        '<div class="ally-cache-browser-group-heading">' +
        '<span aria-hidden="true" data-icon="' +
        config.icon +
        '"></span> ' +
        config.label +
        " (" +
        items.length +
        ")" +
        "</div>";

      // Entries
      items.forEach(function (item) {
        var name =
          item.entry.courseName || item.entry.queryDescription || "Unknown";
        var code = item.entry.courseCode ? item.entry.courseCode + " — " : "";
        var age = ALLY_CACHE.formatAge(item.entry.timestamp);
        var size = ALLY_CACHE.formatSize(item.entry.size);

        html +=
          '<label class="resume-session-option resume-session-option-localstorage">' +
          '<input type="radio" name="ally-cache-browser-choice" value="' +
          escapeHtml(item.key) +
          '"' +
          (isFirst ? " checked" : "") +
          ">" +
          '<span class="resume-session-option-content">' +
          '<time class="resume-session-option-date" datetime="' +
          new Date(item.entry.timestamp).toISOString() +
          '">' +
          '<span class="resume-session-source-icon">' +
          '<span aria-hidden="true" data-icon="' +
          config.icon +
          '"></span>' +
          "</span>" +
          formatDateShort(item.entry.timestamp) +
          "</time>" +
          '<strong class="ally-cache-entry-name">' +
          escapeHtml(name) +
          "</strong>" +
          '<span class="resume-session-option-size">' +
          escapeHtml(code) +
          age +
          " — " +
          size +
          "</span>" +
          "</span>" +
          "</label>";

        isFirst = false;
      });
    });

    elements.browserOptions.innerHTML = html;
    populateIcons();

    // Enable load button
    if (elements.browserLoad) {
      elements.browserLoad.disabled = false;
    }
  }

  function handleBrowserLoad() {
    if (!elements.browserOptions) return;

    var selected = elements.browserOptions.querySelector(
      'input[name="ally-cache-browser-choice"]:checked',
    );
    if (!selected) return;

    var key = selected.value;
    var entry = ALLY_CACHE.get(key);

    if (!entry) {
      logWarn("Selected cache entry not found:", key);
      return;
    }

    logInfo("Loading cached entry:", key);

    // Call the callback
    if (typeof browserSelectCallback === "function") {
      browserSelectCallback(key, entry);
    }

    hideCacheBrowser();
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  function setupEventListeners() {
    // Status button
    if (elements.statusBtn) {
      elements.statusBtn.addEventListener("click", toggleManagerPanel);
    }

    // Manager close
    if (elements.managerClose) {
      elements.managerClose.addEventListener("click", closeManagerPanel);
    }

    // Clear all
    if (elements.clearAllBtn) {
      elements.clearAllBtn.addEventListener("click", handleClearAll);
    }

    // Offline browse
    if (elements.offlineBrowse) {
      elements.offlineBrowse.addEventListener("click", function () {
        hideOfflineBanner();
        showCacheBrowser(browserSelectCallback);
      });
    }

    // Offline retry
    if (elements.offlineRetry) {
      elements.offlineRetry.addEventListener("click", function () {
        hideOfflineBanner();
        // Trigger API retry via main controller if available
        if (
          typeof ALLY_MAIN_CONTROLLER !== "undefined" &&
          ALLY_MAIN_CONTROLLER.testConnection
        ) {
          ALLY_MAIN_CONTROLLER.testConnection();
        }
      });
    }

    // Browser close
    if (elements.browserClose) {
      elements.browserClose.addEventListener("click", hideCacheBrowser);
    }

    // Browser cancel
    if (elements.browserCancel) {
      elements.browserCancel.addEventListener("click", hideCacheBrowser);
    }

    // Browser load
    if (elements.browserLoad) {
      elements.browserLoad.addEventListener("click", handleBrowserLoad);
    }

    // Escape key handling for panels
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (elements.cacheBrowser && !elements.cacheBrowser.hidden) {
          hideCacheBrowser();
          e.preventDefault();
        } else if (elements.managerPanel && !elements.managerPanel.hidden) {
          closeManagerPanel();
          e.preventDefault();
        }
      }
    });

    logDebug("Event listeners attached");
  }

  // ========================================================================
  // Initialisation
  // ========================================================================

  function initialise() {
    if (initialised) {
      logDebug("Already initialised");
      return true;
    }

    // Check dependency
    if (typeof ALLY_CACHE === "undefined") {
      logError("ALLY_CACHE not available - cannot initialise");
      return false;
    }

    cacheElements();
    setupEventListeners();

    // Listen for cache changes
    ALLY_CACHE.onChange(function (event) {
      updateStatusIndicator();

      // Update manager if open
      if (elements.managerPanel && !elements.managerPanel.hidden) {
        renderManagerEntries();
        updateUsageBar();
      }
    });

    // Initial status update
    updateStatusIndicator();

    initialised = true;
    logInfo("ALLY_CACHE_UI initialised");
    return true;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    initialise: initialise,
    isInitialised: function () {
      return initialised;
    },

    // Status
    updateStatusIndicator: updateStatusIndicator,

    // Manager
    toggleManagerPanel: toggleManagerPanel,
    openManagerPanel: openManagerPanel,
    closeManagerPanel: closeManagerPanel,

    // Banners (called by report modules)
    showCachedBanner: showCachedBanner,
    hideCachedBanner: hideCachedBanner,
    showUpdateBanner: showUpdateBanner,
    hideUpdateBanner: hideUpdateBanner,

    // Offline
    showOfflineBanner: showOfflineBanner,
    hideOfflineBanner: hideOfflineBanner,

    // Browser
    showCacheBrowser: showCacheBrowser,
    hideCacheBrowser: hideCacheBrowser,

    // Debug
    getDebugInfo: function () {
      return {
        initialised: initialised,
        elementsFound: {
          statusBtn: !!elements.statusBtn,
          managerPanel: !!elements.managerPanel,
          offlineBanner: !!elements.offlineBanner,
          cacheBrowser: !!elements.cacheBrowser,
        },
        managerOpen: elements.managerPanel
          ? !elements.managerPanel.hidden
          : false,
        browserOpen: elements.cacheBrowser
          ? !elements.cacheBrowser.hidden
          : false,
        offlineVisible: elements.offlineBanner
          ? !elements.offlineBanner.hidden
          : false,
      };
    },
  };
})();
