/**
 * @fileoverview Ally Accessibility Reporting Tool - shared tenant/data UI
 * @module AllyTenantUI
 * @requires ally-scripts/core/ally-config.js (getTenantRecord, parseTenantRecord, applyTenantRecord)
 * @requires ally-scripts/core/ally-tenant-data.js (importExportFiles, fetchRemote, removeForCurrentTenant, describeCurrent)
 *
 * @description
 * Multi-tenancy parcel 1a. The controls that configure WHICH institution the
 * tool is looking at, and WHERE its course data comes from: the tenant record
 * export and import, the course-data upload, the URL fetch and its format
 * choice, the remove, the three inline error messages and the status line.
 *
 * Lifted VERBATIM out of setup-tool/setup-tool.js so a second surface can be
 * given the same controls without the Ally page depending on Set Up's own
 * module. Nothing here is new behaviour; the record shape, its validation and
 * its application still belong to ALLY_CONFIG, and the parsing, storage,
 * install and resolution order still belong to ALLY_TENANT_DATA.
 *
 * WHAT STAYED BEHIND, and why. Everything credential — load, save, clear,
 * the visibility toggle, the status badge, the sign-in reconciliation and the
 * credentials:changed emission. Those already mirror between Set Up and the
 * Ally page correctly, and a helper reachable from both modules is the drift
 * this extraction exists to prevent. Where a moved function needs one of them
 * — applyTenantImport has to refill the card and emit — it is PASSED IN as a
 * callback rather than reaching for it.
 *
 * EVERY DEPENDENCY IS READ INSIDE THE FUNCTION THAT NEEDS IT, never captured
 * at module scope. ALLY_CONFIG and ALLY_TENANT_DATA are separate <script>
 * tags, and every function here fires on a user gesture or after load, so a
 * call-time read always resolves while a module-scope capture could not.
 *
 * ELEMENTS ARE RESOLVED THROUGH getElements(name), WHICH RETURNS AN ARRAY.
 * That is the Model Manager dual-UI pattern (setup-tool/docs/setup-tool-kb.md
 * "Model Manager Dual-UI"): one state change updates every surface that owns a
 * copy of the control. Since parcel 1b there are TWO surfaces — Set Up's
 * #setup-ally card and the Ally Reporting page's #ally-tenant-data card — so a
 * WRITE fans out over the array and a READ must say which surface it means.
 *
 * READS ARE SURFACE-AWARE, and parcel 1b is where that was paid for. Parcel
 * 1a's firstElement(name) returned getElements(name)[0], the first match in
 * DOCUMENT ORDER, which is Set Up's copy on every page that carries both. Four
 * reads of a person's own input went through it, and none of them threw: each
 * returned a real element and a plausible wrong value. Every entry point now
 * takes an ORIGIN — an event, an element, or a surface id where there is no
 * event — resolves the containing card from it, and scopes its reads to that
 * card with elementIn(). firstElement is gone; do not reintroduce it.
 *
 * document.getElementById IS WRITTEN EXACTLY ONCE, inside getElements. Every
 * other lookup filters that result. Keep it that way: a single-element lookup
 * written anywhere else is what makes adding a third surface a hunt.
 */

const ALLY_TENANT_UI = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration
  // ========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AllyTenantUI] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AllyTenantUI] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AllyTenantUI] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AllyTenantUI] " + message, ...args);
  }

  // ========================================================================
  // Constants
  // ========================================================================

  // The two course-data URL formats. Re-declared here rather than imported
  // for the same reason setup-tool.js re-declares the storage keys it needs:
  // this module must keep working when ally-config.js has not loaded.
  const ALLY_DATA_URL_FORMAT_SCRIPT = "script";
  const ALLY_DATA_URL_FORMAT_JSON = "json";

  /** Which institution the bundled course data belongs to, for the messages. */
  const BUNDLED_DATA_INSTITUTION = "University of Southampton";

  /** The three optional files that carry an export's history (multi-tenancy Stage 7). */
  const ALLY_TREND_FILES = "years.csv, months.csv and departments_terms.csv";

  /**
   * The institution name's storage key, for the same reason the format values
   * above are re-declared: this module must keep working when ally-config.js
   * has not loaded. The canonical name is ALLY_CONFIG.STORAGE_KEYS.TENANT_NAME
   * and tenantNameStorageKey() prefers it at call time.
   */
  const ALLY_TENANT_NAME_KEY = "ally-tenant-name";

  /**
   * The two surfaces, as the element ids of the cards that host them. Ordered
   * as they appear in tools.html, which is the order firstElement used to
   * privilege — named here so a reader can see the asymmetry that ordering
   * created rather than having to infer it.
   */
  const SETUP_SURFACE_ID = "setup-ally";
  const ALLY_SURFACE_ID = "ally-tenant-data";

  // ========================================================================
  // Element resolution — the dual-UI seam
  // ========================================================================

  /**
   * Every control this module touches, by role, to the element ids that carry
   * it. Set Up's copy first, the Ally Reporting page's second, matching
   * document order in tools.html.
   *
   * The Ally page's ids are prefixed ally-tenant- rather than ally-, because
   * that page already owns a large ally-* id space and a collision would make
   * getElementById return one of two elements with nothing reporting it.
   *
   * PARCEL 1A'S COMMENT HERE WAS WRONG. It said 1b "appends the Ally page's
   * own ids to these arrays and no other line in this file changes". Appending
   * is necessary and is NOT sufficient — see the surface-awareness note in the
   * file header. The same mistake is available to whoever adds a third
   * surface: appending is the easy half.
   */
  const ELEMENT_IDS = Object.freeze({
    tenantCard: [SETUP_SURFACE_ID, ALLY_SURFACE_ID],
    tenantNameInput: ["setup-ally-tenant-name", "ally-tenant-name"],
    exportTokenCheckbox: ["setup-ally-export-token", "ally-tenant-export-token"],
    importFileInput: ["setup-ally-import-file", "ally-tenant-import-file"],
    importError: ["setup-ally-import-error", "ally-tenant-import-error"],
    dataFilesInput: ["setup-ally-data-files", "ally-tenant-data-files"],
    dataExcludeArchivedCheckbox: [
      "setup-ally-data-exclude-archived",
      "ally-tenant-data-exclude-archived",
    ],
    dataError: ["setup-ally-data-error", "ally-tenant-data-error"],
    dataStatus: ["setup-ally-data-status", "ally-tenant-data-status"],
    dataUrlInput: ["setup-ally-data-url", "ally-tenant-data-url"],
    dataUrlError: ["setup-ally-data-url-error", "ally-tenant-data-url-error"],
    dataUrlFormatJson: [
      "setup-ally-data-url-format-json",
      "ally-tenant-data-url-format-json",
    ],
    dataUrlFormatScript: [
      "setup-ally-data-url-format-script",
      "ally-tenant-data-url-format-script",
    ],
  });

  /**
   * Every control lookup in this module goes through here, and this is the
   * ONLY place a document lookup is written. A single-element lookup written
   * anywhere else is exactly what a third surface would have to hunt down.
   *
   * Missing elements are dropped rather than returned as null, so a caller
   * iterating the result never has to test each member.
   *
   * @param {string} name - A key of ELEMENT_IDS
   * @returns {Element[]} Every element of that role present in this document
   */
  function getElements(name) {
    const ids = ELEMENT_IDS[name];
    if (!ids) {
      logWarn("Unknown element role requested: " + name);
      return [];
    }

    const found = [];
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) found.push(el);
    }
    return found;
  }

  /**
   * The card a gesture came from, so a read can be scoped to the surface the
   * person actually used rather than to document order.
   *
   * Three shapes are accepted, because the callers genuinely have three:
   * an Event (the file inputs, which already carry their target), an Element,
   * and a surface id string. The string exists for Set Up's five
   * window.setupXxxAlly globals, which tools.html calls with NO arguments from
   * inline onclick attributes — their markup is deliberately untouched by this
   * parcel, so the surface has to come from the caller instead of the DOM.
   *
   * @param {Event|Element|string|null} origin
   * @returns {Element|null} The hosting tenant card, or null when unknown
   */
  function resolveSurface(origin) {
    if (!origin) return null;

    const cards = getElements("tenantCard");

    if (typeof origin === "string") {
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].id === origin) return cards[i];
      }
      logWarn("Unknown surface id: " + origin);
      return null;
    }

    const el =
      typeof origin.nodeType === "number"
        ? origin
        : origin.currentTarget || origin.target || null;

    // A REAL NODE OR NOTHING. The test suites drive these entry points with a
    // hand-built event — { target: { files, value, disabled } } — and
    // Node.contains() throws a TypeError on anything that is not a Node, so a
    // bare truthiness test here would turn a synthetic drive into an
    // exception. Returning null lets the caller fall back to its surfaceId,
    // which is what those drives now supply.
    if (!el || typeof el.nodeType !== "number") return null;

    for (let i = 0; i < cards.length; i++) {
      if (cards[i] === el || cards[i].contains(el)) return cards[i];
    }
    return null;
  }

  /**
   * One control of a role, taken from a named surface.
   *
   * WITH NO SURFACE THIS REFUSES rather than falling back to document order,
   * whenever the document carries more than one copy. A document-order read IS
   * the parcel 1a defect: it returns a real element and a plausible wrong
   * value, so nothing downstream can tell it went to the wrong card. A null is
   * loud by comparison — every caller below already handles one, and each
   * handles it in the safe direction (no token exported, JSON format, an
   * on-screen "enter the address first" refusal).
   *
   * @param {Element|null} surface - A tenant card, from resolveSurface()
   * @param {string} name - A key of ELEMENT_IDS
   * @returns {Element|null}
   */
  function elementIn(surface, name) {
    const all = getElements(name);

    if (surface) {
      for (let i = 0; i < all.length; i++) {
        if (surface === all[i] || surface.contains(all[i])) return all[i];
      }
      return null;
    }

    if (all.length > 1) {
      logWarn(
        "Surface-blind read refused for role " +
          name +
          "; " +
          all.length +
          " copies are present and document order is not an answer",
      );
      return null;
    }
    return all[0] || null;
  }

  // ========================================================================
  // Screen reader announcements
  // ========================================================================
  // The shared announcer, resolved at CALL time and never cached — a
  // module-scope capture of window.accessibilityHelpers reads undefined on a
  // page where the announcer publishes after this file.
  function announce(message) {
    if (
      window.accessibilityHelpers &&
      typeof window.accessibilityHelpers.announce === "function"
    ) {
      window.accessibilityHelpers.announce(message);
    } else {
      // Fallback: use the existing sr-only alert region. It is FOUND here,
      // never created — see the module note above on never manufacturing a
      // region. Written as a class query plus an attribute test rather than
      // one attribute selector because the live-region inventory reads a
      // quoted live role inside a string literal as a region being created,
      // and a query is not a creation (AGENTS.md § Announcements).
      var alertRegion = null;
      var srOnly = document.querySelectorAll(".sr-only");
      for (var i = 0; i < srOnly.length; i++) {
        if (srOnly[i].getAttribute("role") === "alert") {
          alertRegion = srOnly[i];
          break;
        }
      }
      if (alertRegion) {
        alertRegion.textContent = message;
      }
    }
  }

  // ========================================================================
  // Telling the rest of the page that a tenant write landed (parcel 1c)
  // ========================================================================

  /**
   * The event a COMPLETED tenant or course-data write announces.
   *
   * Exported as a constant so a consumer subscribes to a name this module owns
   * rather than to a typed literal that can drift.
   */
  const TENANT_CHANGED_EVENT = "ally:tenant-changed";

  /**
   * Announces that a tenant or course-data write has SUCCEEDED.
   *
   * ITS PURPOSE IS CONSUMERS OUTSIDE THIS MODULE. Both surfaces already fan
   * out inside it — setDataStatusText writes every status line and
   * applyTenantFields every mirrored field — so nothing here needs this event.
   * Parcel 2b does: it needs a signal that a link's configuration has landed.
   * No subscriber is wired up by this parcel; adding one in the Ally Reporting
   * content is a separate decision with its own blast radius.
   *
   * ON THE EMITTER ONLY, never a window CustomEvent. Ally's own
   * credentials:changed is emitted on the emitter alone, and four unrelated
   * subscribers listen on the window channel; putting tenant traffic there
   * would start delivering it to all of them.
   *
   * IT IS NOT A VOICE. It adds no live region and no announcement — the
   * gestures that reach it already speak exactly once each, and a second
   * voice for one event is this repo's commonest announcement defect.
   *
   * Called only AFTER the write has succeeded, never before, so a refused
   * operation emits nothing.
   *
   * @param {string} change - dataUploaded, dataFetched, dataRemoved,
   *   configImported or tenantNameSaved
   */
  function emitTenantChanged(change) {
    if (
      window.EmbedEventEmitter &&
      typeof window.EmbedEventEmitter.emit === "function"
    ) {
      window.EmbedEventEmitter.emit(TENANT_CHANGED_EVENT, { change: change });
      logDebug("Emitted " + TENANT_CHANGED_EVENT + ": " + change);
    }
  }

  // ========================================================================
  // Ally tenant record — export and import (multi-tenancy Stage 3)
  // ========================================================================
  // One administrator configures Ally once and colleagues import the file
  // rather than each repeating the setup. ALLY_CONFIG owns the record's shape,
  // its validation and its application; this section owns the controls, the
  // download, the confirmation and the messages.

  /**
   * Shows or hides the inline validation message on the import control.
   * The message element is in the file input's aria-describedby alongside the
   * help text, so a screen reader reads the error with the field.
   * @param {string} message - Text to show; "" hides the message and the flag
   */
  function setImportError(message) {
    getElements("importError").forEach(function (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    });

    getElements("importFileInput").forEach(function (input) {
      if (message) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    });
  }

  /**
   * Reports whether the tenant-record half of ALLY_CONFIG has loaded.
   * @returns {boolean} True if the record functions are callable
   */
  function allyTenantApiAvailable() {
    return (
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.getTenantRecord === "function" &&
      typeof ALLY_CONFIG.parseTenantRecord === "function" &&
      typeof ALLY_CONFIG.applyTenantRecord === "function"
    );
  }

  /**
   * Turns a display name into something safe for a filename.
   * @param {string} value - Raw text
   * @returns {string} Lowercase hyphenated slug, or "" when nothing survives
   */
  function slugForFilename(value) {
    if (!value || typeof value !== "string") return "";
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }

  /**
   * Downloads text as a file. The same idiom as ally-result-renderer.js and
   * ally-course-report.js — there is no shared download helper to import.
   * @param {string} content - File content
   * @param {string} filename - Suggested filename
   * @param {string} mimeType - MIME type
   */
  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logInfo("Downloaded Ally configuration: " + filename);
  }

  /**
   * Exports the current Ally configuration as a JSON file.
   *
   * The token is included ONLY when the opt-in checkbox is ticked, and the
   * announcement says which of the two happened — a person who ticks it should
   * hear that the file now carries a credential, and a person who did not
   * should hear that it does not.
   *
   * SURFACE-AWARE: the checkbox is read from the card the button lives in.
   * Read from document order this exported without the token for anyone who
   * ticked it on the Ally page, and silently — the file is well formed either
   * way, and the announcement would have described the wrong one.
   *
   * @param {Event|Element|string|null} origin - The gesture's surface
   */
  function exportTenant(origin) {
    const surface = resolveSurface(origin);
    setImportError("");

    if (!allyTenantApiAvailable()) {
      logWarn("ALLY_CONFIG tenant record API unavailable; export refused");
      announce(
        "Ally configuration is not ready yet. Reload the page and try again.",
      );
      return;
    }

    const tokenCheckbox = elementIn(surface, "exportTokenCheckbox");
    const includeToken = tokenCheckbox ? tokenCheckbox.checked : false;
    const record = ALLY_CONFIG.getTenantRecord({ includeToken: includeToken });

    if (!record.clientId) {
      announce(
        "There is nothing to export yet. Enter a Client ID and select Save Credentials first.",
      );
      logWarn("Ally export refused: no client id resolved");
      return;
    }

    const slug =
      slugForFilename(record.displayName) ||
      slugForFilename(record.clientId) ||
      "tenant";
    const filename = "ally-configuration-" + slug + ".json";

    downloadTextFile(
      ALLY_CONFIG.serialiseTenantRecord(record),
      filename,
      "application/json",
    );

    // ONE computed string, ONE output. announce() is this card's single channel
    // and no toast fires for this event, so nothing else speaks it.
    const hasToken = Object.prototype.hasOwnProperty.call(record, "token");
    announce(
      "Ally configuration exported as " +
        filename +
        ". " +
        (hasToken
          ? "It contains your API token, so share it only with people who may query as you."
          : "Your API token was not included."),
    );
  }

  /**
   * Handles a file chosen in the import control: read, parse, then confirm.
   *
   * The real gesture carries its own target, so this read was never
   * surface-blind. The fallback is now scoped anyway — options.surfaceId names
   * the card for a call made without an event.
   *
   * @param {Event} event - The change event from the file input
   * @param {Object} [options] - Passed through to applyTenantImport;
   *   { onApplied?: Function, surfaceId?: string }
   */
  function importTenantFile(event, options) {
    // The event first, its caller's declared surface second. Two calls rather
    // than one `||` of arguments, because a synthetic event resolves to no
    // surface at all and the surfaceId has to still be reachable behind it.
    const surface =
      resolveSurface(event) ||
      resolveSurface((options && options.surfaceId) || null);
    const input =
      (event && event.target) || elementIn(surface, "importFileInput") || null;
    const file = input && input.files && input.files[0];

    // Clearing the control is what lets the SAME file be chosen again after a
    // failed or declined import — a repeat selection of an unchanged value
    // fires no change event.
    function resetInput() {
      if (input) input.value = "";
    }

    if (!file) {
      resetInput();
      return;
    }
    setImportError("");

    if (!allyTenantApiAvailable()) {
      resetInput();
      setImportError(
        "Ally configuration is not ready yet. Reload the page and try again.",
      );
      announce(
        "Import failed. Ally configuration is not ready yet. Reload the page and try again.",
      );
      return;
    }

    const reader = new FileReader();

    reader.onerror = function () {
      resetInput();
      const reason = "That file could not be read.";
      setImportError(reason);
      announce("Ally configuration import failed. " + reason);
      logWarn("Ally import failed: FileReader error");
    };

    reader.onload = function () {
      const parsed = ALLY_CONFIG.parseTenantRecord(String(reader.result || ""));
      resetInput();

      if (!parsed.ok) {
        setImportError(parsed.error);
        announce("Ally configuration import failed. " + parsed.error);
        logWarn("Ally import refused: " + parsed.error);
        return;
      }

      confirmTenantImport(parsed.record, options);
    };

    reader.readAsText(file);
  }

  /**
   * Asks before overwriting configured credentials, then applies.
   *
   * A confirmation rather than a notification, because this replaces
   * credentials the person has already stored — AGENTS.md § Notifications &
   * Modals.
   * @param {Object} record - A validated record from parseTenantRecord()
   * @param {Object} [options] - Passed through to applyTenantImport
   */
  function confirmTenantImport(record, options) {
    const who = record.displayName
      ? record.displayName
      : "Client ID " + record.clientId;
    const message =
      "Import the Ally configuration for " +
      who +
      "? This replaces the region, Client ID, API token and proxy worker URL " +
      "saved in this browser.";

    if (typeof window.safeConfirm === "function") {
      window
        .safeConfirm(message, "Import Ally Configuration")
        .then(function (confirmed) {
          if (confirmed) applyTenantImport(record, options);
        });
    } else {
      // Fallback if safeConfirm is not available
      if (confirm(message)) {
        applyTenantImport(record, options);
      }
    }
  }

  /**
   * Applies an imported record and tells everyone who needs to know.
   *
   * REACHED FROM INSIDE A safeConfirm .then, so the outcome is spoken through
   * the shared notify*() path rather than announce(). window.safeConfirm
   * resolves BEFORE its modal is gone, and a direct region write in that window
   * lands in a region the open dialog has removed from the accessibility tree —
   * measured, and the fault is unrepaired. notify*() is modal-aware and
   * reroutes into the open dialogue by itself.
   *
   * ONE voice: a toast already announces through the shared announcer, so there
   * is deliberately no announce() call beside it. announce() appears below only
   * on the branch where no toast system exists to do the speaking.
   *
   * options.onApplied is the CREDENTIAL half, which stayed in setup-tool.js:
   * refilling that card from storage and emitting credentials:changed. It is
   * passed in rather than reached for, so this module owns no credential code.
   *
   * @param {Object} record - A validated record from parseTenantRecord()
   * @param {Object} [options] - { onApplied?: Function }
   */
  function applyTenantImport(record, options) {
    const applied = ALLY_CONFIG.applyTenantRecord(record);

    if (!applied || !applied.ok) {
      const reason =
        (applied && applied.error) ||
        "That configuration could not be applied.";
      setImportError(reason);
      speakImportOutcome("error", "Ally configuration import failed. " + reason);
      logError("Ally import failed to apply");
      return;
    }

    // Refill the surface from what was actually STORED, so nothing on screen
    // can come from the file rather than from storage, and tell the Ally tool,
    // which reloads its own credential form.
    if (options && typeof options.onApplied === "function") {
      options.onApplied();
    }

    const who = record.displayName
      ? record.displayName
      : "Client ID " + record.clientId;
    speakImportOutcome(
      "success",
      "Ally configuration imported for " +
        who +
        ", " +
        record.region +
        " region. " +
        (applied.transport === "direct"
          ? "An API token was included and is now in use."
          : "No API token was included, so add one or a proxy worker URL if Ally does not connect."),
    );

    logInfo(
      "Ally configuration imported, transport: " +
        applied.transport +
        ", live client updated: " +
        applied.pushedToClient,
    );

    // After the write, and after the credential half has refilled the card —
    // a consumer reading storage on this event must find the imported record,
    // not the one it replaced.
    emitTenantChanged("configImported");
  }

  /**
   * Speaks an import outcome exactly once.
   * @param {string} kind - "success" or "error"
   * @param {string} message - The already-built sentence
   */
  function speakImportOutcome(kind, message) {
    const notify =
      kind === "error" ? window.notifyError : window.notifySuccess;

    if (typeof notify === "function") {
      // The toast announces through the shared announcer itself; adding an
      // announce() here would speak this twice.
      notify(message);
      return;
    }

    // No toast system on this page: announce() is the remaining voice, and it
    // is an ELSE rather than an addition for exactly that reason.
    announce(message);
  }

  // ========================================================================
  // Ally course data upload (multi-tenancy Stage 4)
  // ========================================================================
  // The three CSVs of an Ally export are parsed in the browser and the compact
  // payload is stored in IndexedDB keyed by Client ID and region.
  // ALLY_TENANT_DATA owns the parsing, the storage, the install and the
  // resolution order; this section owns the controls, the messages and the
  // status line.

  /**
   * The history clause of the status line and the upload announcement:
   * whether a stored record carries trends, and what to do if not.
   * @param {boolean} hasTrends
   * @param {boolean} fromUrl - A fetched record is regenerated, not re-uploaded
   * @returns {string}
   */
  function describeAllyTrendsClause(hasTrends, fromUrl) {
    if (hasTrends) {
      return "with accessibility history from " + ALLY_TREND_FILES + ", so the Trends view shows your own data";
    }
    return (
      "without history; " +
      (fromUrl
        ? "regenerate the hosted payload with " + ALLY_TREND_FILES
        : "add " + ALLY_TREND_FILES + " to the upload") +
      " to see Trends"
    );
  }

  /**
   * Shows or hides the inline validation message on the upload control.
   * @param {string} message - Text to show; "" hides the message and the flag
   */
  function setDataError(message) {
    getElements("dataError").forEach(function (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    });

    getElements("dataFilesInput").forEach(function (input) {
      if (message) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    });
  }

  /**
   * Reports whether the Stage 4 resolver has loaded.
   * @returns {boolean}
   */
  function allyTenantDataApiAvailable() {
    return (
      typeof ALLY_TENANT_DATA !== "undefined" &&
      typeof ALLY_TENANT_DATA.importExportFiles === "function" &&
      typeof ALLY_TENANT_DATA.fetchRemote === "function" &&
      typeof ALLY_TENANT_DATA.removeForCurrentTenant === "function" &&
      typeof ALLY_TENANT_DATA.describeCurrent === "function"
    );
  }

  /**
   * Shows or hides the inline validation message on the course-data URL
   * field - the worker-URL idiom, on its own field and error element.
   * @param {string} message - Text to show; "" hides the message and the flag
   */
  function setDataUrlError(message) {
    getElements("dataUrlError").forEach(function (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    });

    getElements("dataUrlInput").forEach(function (input) {
      if (message) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    });
  }

  /**
   * Which payload format the radios say, on the surface the gesture came
   * from. JSON unless that surface's script option is ticked - the safe
   * direction to default in, and the direction an unresolvable surface takes.
   *
   * SURFACE-AWARE: read from document order this took Set Up's answer, so a
   * person who chose "Scripts from a folder" on the Ally page silently fetched
   * a JSON payload from a folder address, or the reverse.
   *
   * @param {Event|Element|string|null} [origin] - The gesture's surface
   * @returns {string} "json" or "script"
   */
  function readDataUrlFormatChoice(origin) {
    const script = elementIn(resolveSurface(origin), "dataUrlFormatScript");
    return script && script.checked
      ? ALLY_DATA_URL_FORMAT_SCRIPT
      : ALLY_DATA_URL_FORMAT_JSON;
  }

  /**
   * Sets the radios from a stored value. Anything but "script" selects JSON.
   * @param {string} format
   */
  function setDataUrlFormatChoice(format) {
    const script = format === ALLY_DATA_URL_FORMAT_SCRIPT;
    getElements("dataUrlFormatScript").forEach(function (radio) {
      radio.checked = script;
    });
    getElements("dataUrlFormatJson").forEach(function (radio) {
      radio.checked = !script;
    });
  }

  /**
   * The origin of a URL, for messages.
   * @param {string} url
   * @returns {string}
   */
  function originOfUrl(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return String(url);
    }
  }

  /**
   * Writes the status line, only when it has actually changed.
   * @param {string} text
   */
  function setDataStatusText(text) {
    getElements("dataStatus").forEach(function (el) {
      if (el.textContent === text) return;
      el.textContent = text;
    });
  }

  /**
   * Formats a stored-at timestamp for the status line.
   * @param {string} iso
   * @returns {string}
   */
  function formatStoredDate(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "an unknown date";
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  /**
   * Describes what is stored for the current Client ID and region, and which
   * data the tool is therefore using. Read from IndexedDB, so it is called
   * when the card opens and after every change - never on a plain page load.
   * @returns {Promise<void>}
   */
  async function refreshDataStatus() {
    if (!getElements("dataStatus").length) return;

    if (!allyTenantDataApiAvailable()) {
      setDataStatusText("");
      return;
    }

    try {
      const info = await ALLY_TENANT_DATA.describeCurrent();
      const who = info.tenantKey
        ? "Client ID " + info.clientId + " (" + info.region + ")"
        : "";

      if (!info.tenantKey) {
        setDataStatusText(
          "No Client ID is saved, so uploaded course data cannot be stored yet.",
        );
        return;
      }

      if (info.stored) {
        const s = info.stored;
        // A fetched record says where it came from and when it was fetched;
        // an upload says when it was stored. Same counts, same closing line.
        const fromUrl = s.source === "remote";
        setDataStatusText(
          (fromUrl
            ? "Course data fetched from " + s.sourceOrigin + " for "
            : "Uploaded course data for ") +
            who +
            ": " +
            s.courseCount.toLocaleString() +
            " courses, " +
            s.termCount.toLocaleString() +
            " terms and " +
            s.departmentCount.toLocaleString() +
            " departments, " +
            (fromUrl ? "fetched " : "stored ") +
            formatStoredDate(s.storedAt) +
            ", " +
            describeAllyTrendsClause(!!s.trends, fromUrl) +
            ". " +
            (s.excludesArchived
              ? s.archivedExcluded.toLocaleString() + " archived courses were left out. "
              : "Archived courses were included. ") +
            "It is used instead of the bundled " +
            BUNDLED_DATA_INSTITUTION +
            " data.",
        );
        return;
      }

      const sources =
        typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.DATA_SOURCES
          ? ALLY_CONFIG.DATA_SOURCES
          : { BUNDLED: "bundled", REMOTE: "remote" };

      if (info.dataSource === sources.REMOTE) {
        // Nothing stored, but the source is a URL: either it is fetched on
        // the next Ally Reporting switch (JSON), loaded as scripts each time
        // (script), or no address has been fetched yet.
        setDataStatusText(
          "No stored course data for " +
            who +
            ". " +
            (!info.dataUrl
              ? "The data source is set to a URL, but none has been fetched yet, so there is no course data until one is."
              : info.dataUrlFormat === ALLY_DATA_URL_FORMAT_SCRIPT
                ? "Course data is loaded as scripts from " +
                  info.dataUrlOrigin +
                  " each time Ally Reporting opens."
                : "Course data is fetched from " +
                  info.dataUrlOrigin +
                  " when Ally Reporting opens."),
        );
        return;
      }

      setDataStatusText(
        "No uploaded course data for " +
          who +
          ". " +
          (info.dataSource === sources.BUNDLED
            ? "The bundled " + BUNDLED_DATA_INSTITUTION + " course data is in use."
            : "The data source is set to " +
              info.dataSource +
              ", so there is no course data until an export is uploaded."),
      );
    } catch (error) {
      setDataStatusText("Could not read stored course data: " + error.message);
      logWarn("Ally data status refresh failed: " + error.message);
    }
  }

  /**
   * Handles files chosen in the upload control: parse, store, install.
   *
   * Two announcements for two events - one when the read starts, because a
   * large export takes seconds and silence reads as nothing happening, and
   * one for the outcome. No toast fires on this path, so announce() is the
   * single voice.
   *
   * @param {Event} event - The change event from the file input
   * @param {Object} [options] - { surfaceId?: string } for a call with no event
   */
  async function uploadData(event, options) {
    // The event first, its caller's declared surface second — see the same
    // pair in importTenantFile above.
    const surface =
      resolveSurface(event) ||
      resolveSurface((options && options.surfaceId) || null);
    const input =
      (event && event.target) || elementIn(surface, "dataFilesInput") || null;
    const files =
      input && input.files ? Array.prototype.slice.call(input.files) : [];

    // Clearing the control is what lets the SAME files be chosen again after
    // a refusal - a repeat selection of an unchanged value fires no change.
    function resetInput() {
      if (input) input.value = "";
    }

    if (!files.length) {
      resetInput();
      return;
    }
    setDataError("");

    if (!allyTenantDataApiAvailable()) {
      resetInput();
      const reason =
        "Course data upload is not ready yet. Reload the page and try again.";
      setDataError(reason);
      announce("Course data upload failed. " + reason);
      return;
    }

    // SURFACE-AWARE: read from document order this took Set Up's tick, so
    // untick it on the Ally page and two thirds of the export was still
    // dropped - a wrong stored payload, with nothing on screen to say so.
    const excludeArchivedCheckbox = elementIn(
      surface,
      "dataExcludeArchivedCheckbox",
    );
    const excludeArchived = excludeArchivedCheckbox
      ? excludeArchivedCheckbox.checked
      : true;

    if (input) input.disabled = true;
    announce(
      "Reading " +
        files.length +
        (files.length === 1 ? " file" : " files") +
        ". A large export takes a few seconds.",
    );
    setDataStatusText("Reading your Ally export…");

    try {
      const result = await ALLY_TENANT_DATA.importExportFiles(files, {
        excludeArchived: excludeArchived,
        onProgress: function (bytesRead, totalBytes, rowCount) {
          const percent = totalBytes
            ? Math.min(100, Math.round((bytesRead / totalBytes) * 100))
            : 0;
          setDataStatusText(
            "Reading courses.csv: " +
              percent +
              "%, " +
              rowCount.toLocaleString() +
              " rows so far.",
          );
        },
      });

      resetInput();
      await refreshDataStatus();

      // ONE computed string, ONE output. The history clause names any
      // missing file, so a person who chose five of the six hears which.
      announce(
        "Course data uploaded for Client ID " +
          result.clientId +
          ", " +
          result.region +
          " region: " +
          result.courseCount.toLocaleString() +
          " courses, " +
          result.termCount.toLocaleString() +
          " terms and " +
          result.departmentCount.toLocaleString() +
          " departments, " +
          (result.trends
            ? describeAllyTrendsClause(true, false)
            : "without history" +
              (result.trendsMissingFiles && result.trendsMissingFiles.length &&
               result.trendsMissingFiles.length < 3
                ? " because " + result.trendsMissingFiles.join(" and ") + " was not chosen; add it"
                : "; add " + ALLY_TREND_FILES + " to the upload") +
              " to see Trends") +
          ". " +
          (result.excludesArchived
            ? result.archivedExcluded.toLocaleString() +
              " archived courses were left out."
            : "Archived courses were included."),
      );
      logInfo(
        "Ally course data uploaded for " +
          result.tenantKey +
          ": parse " +
          Math.round(result.timings.parseMs) +
          "ms, store " +
          Math.round(result.timings.storeMs) +
          "ms, install " +
          Math.round(result.timings.installMs) +
          "ms",
      );

      // In the TRY and after the await, so a refusal cannot reach it. Not in
      // the finally, which runs on both paths and would announce a write that
      // never happened.
      emitTenantChanged("dataUploaded");
    } catch (error) {
      resetInput();
      const reason = error && error.message ? error.message : String(error);
      setDataError(reason);
      await refreshDataStatus();
      announce("Course data upload failed. " + reason);
      logWarn("Ally course data upload refused: " + reason);
    } finally {
      if (input) input.disabled = false;
    }
  }

  /** Set while a fetch is in flight, so a second press cannot start another. */
  let allyDataFetchInFlight = false;

  /**
   * Fetches course data from the URL in the field: validate, fetch, store,
   * install. Multi-tenancy Stage 6.
   *
   * Same voice as the upload above - two announcements for two events, the
   * start (a fetch takes seconds and silence reads as nothing happening) and
   * the outcome. No toast fires on this path, so announce() is the single
   * voice. A refusal before any request is ONE event and speaks once.
   *
   * The button is not disabled while the fetch runs: disabling a focused
   * button drops keyboard focus to the page. A flag refuses a second press
   * instead, and the field is disabled as the upload control is.
   *
   * SURFACE-AWARE, and this was the worst of the four: read from document
   * order it fetched whatever Set Up's box held, so an address typed on the
   * Ally page fetched a different institution's payload, or - with Set Up's
   * box empty - refused with "Enter the address of the course data first"
   * against a field the person had just filled in.
   *
   * @param {Event|Element|string|null} origin - The gesture's surface
   */
  async function fetchDataFromUrl(origin) {
    const surface = resolveSurface(origin);
    const input = elementIn(surface, "dataUrlInput");
    setDataUrlError("");
    setDataError("");

    if (allyDataFetchInFlight) {
      announce("Course data is still being fetched. Please wait.");
      return;
    }

    if (!allyTenantDataApiAvailable()) {
      const reason =
        "Course data fetch is not ready yet. Reload the page and try again.";
      setDataUrlError(reason);
      announce("Course data fetch failed. " + reason);
      return;
    }

    const raw = input ? input.value.trim() : "";
    if (!raw) {
      const reason = "Enter the address of the course data first.";
      setDataUrlError(reason);
      announce("Course data fetch failed. " + reason);
      return;
    }

    // Validated HERE as well as in fetchRemote, so a bad paste is refused
    // on the field before the resolver is asked for anything.
    const normalised =
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.normaliseDataUrl === "function"
        ? ALLY_CONFIG.normaliseDataUrl(raw)
        : raw;
    if (!normalised) {
      const reason = ALLY_TENANT_DATA.DATA_URL_REFUSAL;
      setDataUrlError(reason);
      announce("Course data fetch failed. " + reason);
      return;
    }

    const format = readDataUrlFormatChoice(surface);
    const urlOrigin = originOfUrl(normalised);

    allyDataFetchInFlight = true;
    if (input) input.disabled = true;
    announce(
      "Fetching course data from " + urlOrigin + ". This takes a few seconds.",
    );
    setDataStatusText("Fetching course data from " + urlOrigin + "…");

    try {
      const result = await ALLY_TENANT_DATA.fetchRemote({
        url: raw,
        format: format,
      });

      // Show what was actually STORED, not what was typed.
      if (input) input.value = result.url;
      await refreshDataStatus();

      // ONE computed string, ONE output.
      announce(
        "Course data " +
          (result.stored ? "fetched from " : "loaded as scripts from ") +
          result.origin +
          " for Client ID " +
          result.clientId +
          ", " +
          result.region +
          " region: " +
          result.courseCount.toLocaleString() +
          " courses, " +
          result.termCount.toLocaleString() +
          " terms and " +
          result.departmentCount.toLocaleString() +
          " departments. " +
          (result.excludesArchived
            ? result.archivedExcluded.toLocaleString() +
              " archived courses were left out."
            : "Archived courses were included."),
      );
      logInfo(
        "Ally course data fetched for " +
          result.tenantKey +
          " from " +
          result.origin +
          " (" +
          result.format +
          "): fetch " +
          Math.round(result.timings.fetchMs) +
          "ms, store " +
          Math.round(result.timings.storeMs) +
          "ms, install " +
          Math.round(result.timings.installMs) +
          "ms",
      );

      // Same placement as the upload above, and for the same reason: in the
      // try, after the await, never in the finally.
      emitTenantChanged("dataFetched");
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      setDataUrlError(reason);
      await refreshDataStatus();
      announce("Course data fetch failed. " + reason);
      logWarn("Ally course data fetch refused: " + reason);
    } finally {
      allyDataFetchInFlight = false;
      if (input) input.disabled = false;
    }
  }

  /**
   * Asks before removing the stored payload, then removes it.
   *
   * A confirmation rather than a notification, because this deletes data the
   * person took the trouble to upload - AGENTS.md § Notifications & Modals.
   */
  function removeData() {
    setDataError("");

    if (!allyTenantDataApiAvailable()) {
      announce(
        "Course data removal is not ready yet. Reload the page and try again.",
      );
      return;
    }

    const message =
      "Remove the uploaded course data stored in this browser for the current " +
      "Client ID? The bundled " +
      BUNDLED_DATA_INSTITUTION +
      " course data is used again until you upload another export.";

    if (typeof window.safeConfirm === "function") {
      window
        .safeConfirm(message, "Remove Uploaded Course Data")
        .then(function (confirmed) {
          if (confirmed) performRemoveData();
        });
    } else if (confirm(message)) {
      performRemoveData();
    }
  }

  /**
   * Removes the payload and says what the tool is now running on.
   *
   * REACHED FROM INSIDE A safeConfirm .then, so the outcome goes through the
   * modal-aware notify path (speakImportOutcome) rather than announce() -
   * the same reasoning as applyTenantImport above.
   */
  async function performRemoveData() {
    try {
      const result = await ALLY_TENANT_DATA.removeForCurrentTenant();
      await refreshDataStatus();
      speakImportOutcome(
        "success",
        result.existed
          ? "Uploaded course data removed. The bundled " +
              BUNDLED_DATA_INSTITUTION +
              " course data is in use."
          : "There was no uploaded course data stored for this Client ID. The bundled " +
              BUNDLED_DATA_INSTITUTION +
              " course data is in use.",
      );
      logInfo("Ally course data removed for " + result.tenantKey);

      // A removal IS a completed write — the tenant now runs on the bundled
      // data, which is a configuration change a consumer needs to hear about.
      emitTenantChanged("dataRemoved");
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      setDataError(reason);
      speakImportOutcome("error", "Could not remove uploaded course data. " + reason);
      logError("Ally course data removal failed: " + reason);
    }
  }

  /**
   * Refreshes the status line the first time a hosting card is opened, and on
   * every later opening, so the IndexedDB read happens on demand only.
   */
  function watchCardForDataStatus() {
    getElements("tenantCard").forEach(function (card) {
      card.addEventListener("toggle", function () {
        if (card.open) refreshDataStatus();
      });
    });
  }

  // ========================================================================
  // The mirrored fields (multi-tenancy parcel 1b)
  // ========================================================================
  // A person who sets a control on one card sees it on the other WITHOUT a
  // reload, because a colleague who never opens Set Up must still be able to
  // check what the tool is configured with. Mirroring is a convenience; the
  // surface-aware reads above are the correctness guarantee, and neither
  // substitutes for the other.
  //
  // FILE INPUTS ARE NOT MIRRORED and cannot be: a browser refuses a
  // programmatic write to input.files, and a chosen file is a gesture rather
  // than a setting.

  /** Text and URL fields whose value follows across surfaces. */
  const MIRRORED_VALUE_ROLES = Object.freeze([
    "tenantNameInput",
    "dataUrlInput",
  ]);

  /** Checkboxes whose ticked state follows across surfaces. */
  const MIRRORED_CHECKED_ROLES = Object.freeze([
    "exportTokenCheckbox",
    "dataExcludeArchivedCheckbox",
  ]);

  /**
   * Writes a value onto every copy of a role, skipping any already holding it.
   *
   * Write-if-changed, per AGENTS.md: rewriting identical text is wasted work
   * at best. It also keeps this safe to call from an input handler — a
   * programmatic value assignment fires no input or change event, so there is
   * no loop to break, and the equality test makes that true twice over.
   *
   * @param {string} name - A key of ELEMENT_IDS
   * @param {string} value
   * @param {Element} [except] - The element the value came from
   */
  function setRoleValue(name, value, except) {
    getElements(name).forEach(function (el) {
      if (el === except) return;
      if (el.value !== value) el.value = value;
    });
  }

  /**
   * Writes a ticked state onto every copy of a role. See setRoleValue.
   * @param {string} name - A key of ELEMENT_IDS
   * @param {boolean} checked
   * @param {Element} [except] - The element the state came from
   */
  function setRoleChecked(name, checked, except) {
    getElements(name).forEach(function (el) {
      if (el === except) return;
      if (el.checked !== checked) el.checked = checked;
    });
  }

  /**
   * Sets the mirrored fields on EVERY surface from a plain object.
   *
   * AN ABSENT PROPERTY IS NO OPINION; AN EMPTY STRING IS A CLEAR. That is why
   * this takes an options object rather than positional arguments — a caller
   * blanking the institution name has to be able to say so without also
   * blanking the course-data URL, and "" has to reach the other surface as a
   * blank rather than being read as "nothing supplied".
   *
   * @param {Object} values - Any of tenantName, dataUrl, dataUrlFormat,
   *   excludeArchived, exportToken
   */
  function applyTenantFields(values) {
    if (!values || typeof values !== "object") {
      logWarn("applyTenantFields called with no values object");
      return;
    }

    const has = function (key) {
      return Object.prototype.hasOwnProperty.call(values, key);
    };

    if (has("tenantName")) {
      setRoleValue("tenantNameInput", String(values.tenantName || ""));
    }
    if (has("dataUrl")) {
      setRoleValue("dataUrlInput", String(values.dataUrl || ""));
    }
    if (has("dataUrlFormat")) {
      setDataUrlFormatChoice(values.dataUrlFormat);
    }
    if (has("excludeArchived")) {
      setRoleChecked("dataExcludeArchivedCheckbox", !!values.excludeArchived);
    }
    if (has("exportToken")) {
      setRoleChecked("exportTokenCheckbox", !!values.exportToken);
    }
  }

  /**
   * Reads one mirrored field from the surface a gesture came from.
   *
   * The counterpart to applyTenantFields, and deliberately singular: a write
   * fans out, a read has to name its surface.
   *
   * @param {string} name - tenantName, dataUrl, dataUrlFormat,
   *   excludeArchived or exportToken
   * @param {Event|Element|string|null} [origin] - The gesture's surface
   * @returns {*} The field's value, or its safe default when unresolvable
   */
  function readTenantField(name, origin) {
    const surface = resolveSurface(origin);
    let el = null;

    switch (name) {
      case "tenantName":
        el = elementIn(surface, "tenantNameInput");
        return el ? el.value.trim() : "";
      case "dataUrl":
        el = elementIn(surface, "dataUrlInput");
        return el ? el.value.trim() : "";
      case "dataUrlFormat":
        return readDataUrlFormatChoice(origin);
      case "excludeArchived":
        el = elementIn(surface, "dataExcludeArchivedCheckbox");
        return el ? el.checked : true;
      case "exportToken":
        el = elementIn(surface, "exportTokenCheckbox");
        return el ? el.checked : false;
      default:
        logWarn("Unknown tenant field requested: " + name);
        return undefined;
    }
  }

  /**
   * Wires the mirroring listeners. Idempotent through initialise()'s flag.
   */
  function watchMirroredFields() {
    MIRRORED_VALUE_ROLES.forEach(function (role) {
      getElements(role).forEach(function (el) {
        el.addEventListener("input", function () {
          setRoleValue(role, el.value, el);
        });
      });
    });

    MIRRORED_CHECKED_ROLES.forEach(function (role) {
      getElements(role).forEach(function (el) {
        el.addEventListener("change", function () {
          setRoleChecked(role, el.checked, el);
        });
      });
    });

    // The format radios are one CONTROL across two elements, so they mirror
    // through setDataUrlFormatChoice rather than element by element. The two
    // surfaces carry different radio group NAMES on purpose: one shared name
    // would make the four radios a single group, and only one of the four
    // could then be checked at a time.
    getElements("dataUrlFormatScript").forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) setDataUrlFormatChoice(ALLY_DATA_URL_FORMAT_SCRIPT);
      });
    });
    getElements("dataUrlFormatJson").forEach(function (el) {
      el.addEventListener("change", function () {
        if (el.checked) setDataUrlFormatChoice(ALLY_DATA_URL_FORMAT_JSON);
      });
    });
  }

  // ========================================================================
  // The institution name (multi-tenancy parcel 1b)
  // ========================================================================
  // Tenant IDENTITY, not a credential — it labels a configuration so a
  // colleague can tell which institution a shared file is for. Parcel 1a left
  // it in setup-tool.js, which is why the Ally page had no way to show it.
  //
  // Its storage rules are the worker URL's, not the credentials': written
  // outside the Remember gate, removed only by an EXPLICIT clear. That tie is
  // preserved by setup-tool.js calling clearTenantName() from
  // performClearAllyCredentials and from nowhere else.

  /**
   * The canonical storage key, preferred from ALLY_CONFIG at call time.
   * @returns {string}
   */
  function tenantNameStorageKey() {
    if (
      typeof ALLY_CONFIG !== "undefined" &&
      ALLY_CONFIG.STORAGE_KEYS &&
      ALLY_CONFIG.STORAGE_KEYS.TENANT_NAME
    ) {
      return ALLY_CONFIG.STORAGE_KEYS.TENANT_NAME;
    }
    return ALLY_TENANT_NAME_KEY;
  }

  /**
   * Fills the institution name on every surface from storage.
   * @returns {string} What was stored, or ""
   */
  function loadTenantName() {
    const stored = localStorage.getItem(tenantNameStorageKey()) || "";
    applyTenantFields({ tenantName: stored });
    return stored;
  }

  /**
   * Stores the institution name as typed on one surface, and mirrors it.
   * An emptied box removes the key rather than storing "".
   * @param {Event|Element|string|null} [origin] - The gesture's surface
   * @returns {string} What was stored, or ""
   */
  function saveTenantName(origin) {
    const previous = localStorage.getItem(tenantNameStorageKey()) || "";
    const value = readTenantField("tenantName", origin);
    if (value) {
      localStorage.setItem(tenantNameStorageKey(), value);
    } else {
      localStorage.removeItem(tenantNameStorageKey());
    }
    applyTenantFields({ tenantName: value });

    // ON A CHANGE ONLY, and that is a deliberate narrowing of "after every
    // completed write". Both Save buttons call this on EVERY credential save,
    // whether or not the name was touched, so emitting unconditionally would
    // tell a consumer an institution name had changed on every save of a
    // token. An unchanged rewrite is not a configuration landing.
    if (value !== previous) emitTenantChanged("tenantNameSaved");

    return value;
  }

  /**
   * Removes the institution name and blanks it on every surface.
   * Called only from an EXPLICIT credential clear.
   */
  function clearTenantName() {
    localStorage.removeItem(tenantNameStorageKey());
    applyTenantFields({ tenantName: "" });
  }

  // ========================================================================
  // Following a tenant switch (multi-tenancy parcel 1c, item 2)
  // ========================================================================
  // MEASURED BEFORE IT WAS WRITTEN, because the dispatch's case for it was a
  // prediction from structure and this repo has had two of those refuted. It
  // reproduced: with a payload stored under one Client ID, typing another on
  // the Ally page and pressing Save credentials left BOTH status lines
  // describing the first tenant's data — "Uploaded course data for Client ID
  // …-A: 111,111 courses" under a saved Client ID of …-B.
  //
  // BUT NOT FOR THE REASON PREDICTED, and the difference decides the shape of
  // the fix. The dispatch expected Set Up's own path to cover the case where
  // its card is open, since loadAllyCredentials refreshes the status line
  // then. It does run — instrumented at exactly ONE call — and it still
  // produced the stale line, because of an ORDERING fault:
  //
  //   handleSaveCredentials()  →  saveCredentials()  →  emit credentials:changed
  //                            →  applyCredentialsToClient()   ← the LIVE pair
  //
  // The emit happens BEFORE the live client is updated, and
  // ALLY_TENANT_DATA.resolveTenantIdentity() reads the LIVE pair in preference
  // to storage. So every synchronous subscriber sees the previous tenant. A
  // plain synchronous subscription here would have read the same stale pair
  // and fixed nothing while reading as coverage.
  //
  // HENCE THE MICROTASK, which is the load-bearing half of this fix and not a
  // timing guess. Everything after the emit — applyCredentialsToClient, and
  // ally-main-controller's own subscriber, which pushes storage onto the
  // client for a save made on the Set Up page — is SYNCHRONOUS in the emit's
  // own task. A microtask therefore runs after all of it, by construction of
  // the event loop rather than by waiting long enough. The ordering fault
  // itself lives in handleSaveCredentials, which this parcel may not touch;
  // it is registered as owed rather than worked around silently.

  /** Set once the subscription is wired, so it can never be taken twice. */
  let credentialSubscription = false;

  /**
   * Re-reads the data-status line on both surfaces after a credential change.
   *
   * The tenant key is clientId + "@" + region, so a changed Client ID or
   * region means the stored course data both status lines describe is no
   * longer this tenant's. refreshDataStatus re-reads from storage and is
   * idempotent, so no source tracking is needed and a redundant call costs an
   * IndexedDB read.
   *
   * ON THE EMITTER ONLY. Ally emits credentials:changed on EmbedEventEmitter
   * alone; four unrelated subscribers listen on the window channel and must
   * not start hearing Ally tenant traffic.
   *
   * IT ADDS NO VOICE. setDataStatusText writes only when the text has actually
   * changed, and neither status line carries a live role, so a refresh is
   * silent.
   *
   * Exported so a proof can read this function's own source off the live
   * module — a landed-canary read of the bytes we sent proves nothing about
   * the module the page parsed. Its own flag, rather than initialise()'s
   * alone, is what makes that export safe: a second subscription is a second
   * re-render.
   */
  function subscribeToCredentialChanges() {
    if (credentialSubscription) return;
    if (
      !window.EmbedEventEmitter ||
      typeof window.EmbedEventEmitter.on !== "function"
    ) {
      logDebug("EmbedEventEmitter absent; tenant status will not follow a switch");
      return;
    }

    credentialSubscription = true;
    window.EmbedEventEmitter.on("credentials:changed", function (data) {
      if (!data || data.service !== "ally") return;
      Promise.resolve().then(function () {
        refreshDataStatus();
      });
    });
    logInfo("Tenant UI following credentials:changed");
  }

  // ========================================================================
  // Initialisation
  // ========================================================================

  let initialised = false;

  /**
   * Wires the card watchers and the mirroring. Idempotent, and called from
   * both directions: setup-tool.js's init() and this module's own
   * DOMContentLoaded below. Either may be first, and a page carrying only one
   * of the two surfaces still gets wired.
   */
  function initialise() {
    if (initialised) return;
    initialised = true;
    watchCardForDataStatus();
    watchMirroredFields();
    subscribeToCredentialChanges();
    logInfo(
      "Tenant UI initialised across " +
        getElements("tenantCard").length +
        " surface(s)",
    );
  }

  /**
   * Whether initialise() has run.
   *
   * Worth asserting beside any mirroring measurement: an uninitialised
   * controller looks exactly like a broken sync, and the two want different
   * fixes.
   * @returns {boolean}
   */
  function isInitialised() {
    return initialised;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialise);
    } else {
      initialise();
    }
  }

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    getElements: getElements,

    // The surface seam. Exported so a test can prove a read is scoped rather
    // than inferring it from an outcome.
    SETUP_SURFACE_ID: SETUP_SURFACE_ID,
    ALLY_SURFACE_ID: ALLY_SURFACE_ID,
    resolveSurface: resolveSurface,
    elementIn: elementIn,

    // Initialisation
    initialise: initialise,
    isInitialised: isInitialised,
    watchCardForDataStatus: watchCardForDataStatus,
    subscribeToCredentialChanges: subscribeToCredentialChanges,

    // The event a completed tenant or course-data write announces (parcel 1c)
    TENANT_CHANGED_EVENT: TENANT_CHANGED_EVENT,

    // Inline validation messages
    setImportError: setImportError,
    setDataError: setDataError,
    setDataUrlError: setDataUrlError,

    // The course-data URL format radios
    readDataUrlFormatChoice: readDataUrlFormatChoice,
    setDataUrlFormatChoice: setDataUrlFormatChoice,

    // The mirrored fields
    applyTenantFields: applyTenantFields,
    readTenantField: readTenantField,

    // The institution name
    loadTenantName: loadTenantName,
    saveTenantName: saveTenantName,
    clearTenantName: clearTenantName,

    // The status line
    setDataStatusText: setDataStatusText,
    refreshDataStatus: refreshDataStatus,

    // The five gestures, each reached from a window global
    exportTenant: exportTenant,
    importTenantFile: importTenantFile,
    uploadData: uploadData,
    fetchDataFromUrl: fetchDataFromUrl,
    removeData: removeData,
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_TENANT_UI = ALLY_TENANT_UI;

  // The Ally Reporting page's own handlers (multi-tenancy parcel 1b).
  //
  // Set Up's five window.setupXxxAlly globals are deliberately UNTOUCHED —
  // they already delegate into this module and work, and renaming them would
  // be a second change inside a parcel whose proof depends on Set Up behaving
  // identically. These five are their siblings, and each names its own surface
  // so the reads below reach the Ally card rather than Set Up's.
  //
  // The two change-driven handlers pass the real event, which already carries
  // its target; the surface id is the fallback for a call made without one.
  //
  // EACH RETURNS WHAT THE MODULE RETURNS, so the two async gestures can be
  // awaited. An inline onclick ignores a returned promise, and a drive that
  // cannot await one has to poll an announcement instead — which is a race
  // against the in-flight guard, and cost this parcel two red rows before the
  // return was added. Set Up's five are deliberately NOT changed to match:
  // they are outside this parcel's remit and the existing suites poll.

  window.allyTenantExport = function () {
    return ALLY_TENANT_UI.exportTenant(ALLY_TENANT_UI.ALLY_SURFACE_ID);
  };

  window.allyTenantImport = function (event) {
    return ALLY_TENANT_UI.importTenantFile(event, {
      surfaceId: ALLY_TENANT_UI.ALLY_SURFACE_ID,
      onApplied: function () {
        // The credential half belongs to setup-tool.js, which owns the Ally
        // credential fields on both surfaces. Reached through the global it
        // publishes, at CALL time, because this file may parse first.
        if (typeof window.setupReloadAllyCredentials === "function") {
          window.setupReloadAllyCredentials();
        }
      },
    });
  };

  window.allyTenantUpload = function (event) {
    return ALLY_TENANT_UI.uploadData(event, {
      surfaceId: ALLY_TENANT_UI.ALLY_SURFACE_ID,
    });
  };

  window.allyTenantFetch = function () {
    return ALLY_TENANT_UI.fetchDataFromUrl(ALLY_TENANT_UI.ALLY_SURFACE_ID);
  };

  window.allyTenantRemove = function () {
    return ALLY_TENANT_UI.removeData();
  };
}
