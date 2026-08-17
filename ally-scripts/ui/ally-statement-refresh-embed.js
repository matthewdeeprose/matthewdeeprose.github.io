/**
 * @fileoverview Bundled "Update accessibility data" refresh script for the
 * EXPORTED Ally statement (standalone HTML + SCORM). Runs INSIDE the export.
 * @module ally-statement-refresh-embed
 *
 * @description
 * A self-contained, zero-app-dependency vanilla script that lets a viewer of the
 * exported statement refresh just the accessibility-data section against fresh
 * Ally issue counts, WITHOUT the app's render engine. It reads the pre-rendered
 * data island (a JSON <script> the export injects, see Stage 7), and on demand:
 *   fetch fresh counts (Stage 4 transport) -> recompute which themes are active
 *   using the SAME count>0 rule as the app -> reassemble the data section from
 *   the pre-baked fragments -> swap the [data-sp-category="data"] sections ->
 *   update the freshness <time> -> persist to localStorage (Stage 5).
 *
 * Parity is guaranteed by construction: the fragments were produced at export
 * time by the real app renderers + the real export cleanup (Stage 1), so this
 * script never builds statement markup — it only selects and swaps.
 *
 * This file is the editable SOURCE. It is stringified (no bundler) by
 * js/scorm-export/_gen-ally-refresh-embed.mjs into the committed constant
 * js/scorm-export/ally-refresh-embed-src.js and re-exported through the
 * scorm-export.js facade. Regenerate after editing this file:
 *   node js/scorm-export/_gen-ally-refresh-embed.mjs
 *
 * STAGE MAP (this file is fleshed out across stages, per the Phase 3 plan):
 *   Stage 2 (this): island read, computeActiveThemes, assembleDataFragment,
 *                   applyRefresh, updateFreshness, button + init, transport SEAM.
 *   Stage 4: real worker transport (fetchIssueCounts over WORKER_URL).
 *   Stage 5: localStorage persistence + rehydrate.
 *   Stage 6: progress UI + British-spelling copy.
 */
(function () {
  "use strict";

  // ==========================================================================
  // Logging (mirrors the mp-73 IIFE logging convention; British spelling)
  // ==========================================================================
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
      console.error("[AllySPRefresh] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllySPRefresh] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllySPRefresh] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllySPRefresh] " + message, ...args);
  }

  // ==========================================================================
  // Constants
  // ==========================================================================
  const ISLAND_ID = "ally-sp-refresh-island";
  const FRESHNESS_ID = "ally-sp-last-refreshed"; // Stage 3 stamps this on the <time>
  const BUTTON_ID = "ally-sp-refresh-button";
  const DATA_SECTION_SELECTOR = '[data-sp-category="data"]';
  const BUTTON_LABEL = "Update accessibility data";

  // Warm-up polling (Stage 4). The Ally report warms up on first request and can
  // take up to ~3 minutes; the Worker does one pass-through call per POST, so the
  // embed re-polls here while the status is "Processing".
  const POLL_INTERVAL_MS = 6000; // gap between warm-up polls
  const MAX_WAIT_MS = 300000; // give up after 5 minutes
  const TYPICAL_WARMUP_SECONDS = 180; // typical warm-up; drives the progress bar

  // Progress UI (Stage 6)
  const PROGRESS_ID = "ally-sp-refresh-progress";
  const STATUS_ID = "ally-sp-refresh-status";
  const PROGRESSBAR_ID = "ally-sp-refresh-progressbar";
  const STYLE_ID = "ally-sp-refresh-styles";
  const PROGRESS_CAP = 95; // never show 100% until the API reports "Successful"
  const ALMOST_READY_SECONDS = 30;

  // British-spelling copy (mirrors ally-main-controller.js warm-up wording).
  const COPY = {
    updating: "Updating accessibility data. This can take 2 to 3 minutes.",
    almostReady: "Almost ready…",
    longer: "This is taking longer than usual. Please wait…",
    success: "Accessibility data updated.",
    failure:
      "Sorry, the accessibility data could not be updated. Please try again.",
    // Restated freshness line shown just above the button (the reason to update).
    restatedPrefix: "Accessibility data last refreshed on ",
  };

  // Progress-UI element refs, populated by buildControls().
  let ui = null;

  // ==========================================================================
  // Island
  // ==========================================================================

  /**
   * Reads and parses the JSON data island the export injected. Returns null when
   * absent (a static export: flag off or null island) or unparseable — in which
   * case the script does nothing and the baked snapshot stands.
   * @returns {Object|null}
   */
  function readIsland() {
    const el = document.getElementById(ISLAND_ID);
    if (!el) {
      logDebug("No refresh island present — static export, nothing to do.");
      return null;
    }
    try {
      const island = JSON.parse(el.textContent);
      if (!island || !island.fragments || !Array.isArray(island.themeOrder)) {
        logWarn("Refresh island is malformed — ignoring.");
        return null;
      }
      return island;
    } catch (e) {
      logWarn("Could not parse refresh island:", e.message);
      return null;
    }
  }

  // ==========================================================================
  // Core logic (pure — no network, no app deps)
  // ==========================================================================

  /**
   * Recomputes which themes are active for a set of fresh counts. This is a
   * literal transcription of the app's calculateThemeIssues + getActiveThemes:
   * for each theme, in island.themeOrder, sum the numeric values of its mapped
   * fields; the theme is active when that total is > 0. Returns the ordered list
   * of active theme ids (same order the app renders them in).
   * @param {Object} counts - a flat {field: number} record (the worker's `record`)
   * @param {Object} island - the parsed data island (themeOrder + fieldMap)
   * @returns {string[]} active theme ids, in themeOrder order
   */
  function computeActiveThemes(counts, island) {
    const order = (island && island.themeOrder) || [];
    const fieldMap = (island && island.fieldMap) || {};
    const active = [];
    order.forEach(function (id) {
      const fields = fieldMap[id] || [];
      let total = 0;
      fields.forEach(function (field) {
        const value = counts ? counts[field] : undefined;
        if (typeof value === "number" && !isNaN(value)) {
          total += value;
        }
      });
      if (total > 0) {
        active.push(id);
      }
    });
    return active;
  }

  /**
   * Assembles the accessibility-data section from the pre-baked fragments into a
   * DocumentFragment, in the same order a fresh export produces: the intro and
   * the issue block (active warnings in themeOrder, or the success box when no
   * theme is active), respecting the baked introFirst placement.
   * @param {Object} island
   * @param {string[]} activeIds - output of computeActiveThemes
   * @returns {DocumentFragment}
   */
  function assembleDataFragment(island, activeIds) {
    const fragments = island.fragments || {};
    const warnings = fragments.warnings || {};

    const issueHtml =
      activeIds.length > 0
        ? activeIds
            .map(function (id) {
              return warnings[id];
            })
            .filter(Boolean)
        : [fragments.success];

    const ordered =
      island.introFirst === false
        ? issueHtml.concat([fragments.intro])
        : [fragments.intro].concat(issueHtml);

    const template = document.createElement("template");
    template.innerHTML = ordered.filter(Boolean).join("");
    return template.content;
  }

  /**
   * Swaps the document's accessibility-data section for a freshly assembled one.
   * The data-category sections are contiguous in the export (intro immediately
   * followed by the issue block, bounded by non-data sections), so the new run
   * is inserted before the first existing data section and every old data
   * section is then removed — preserving the surrounding header/boilerplate.
   * @param {Object} island
   * @param {Object} counts
   * @returns {boolean} true if the swap happened
   */
  function applyRefresh(island, counts) {
    const existing = document.querySelectorAll(DATA_SECTION_SELECTOR);
    if (!existing.length) {
      logWarn("No data-category sections found — cannot apply refresh.");
      return false;
    }

    const first = existing[0];
    const parent = first.parentNode;
    if (!parent) {
      logWarn("Data section has no parent — cannot apply refresh.");
      return false;
    }

    // The controls live INSIDE the intro section, which this swap replaces. Detach
    // them first (keeping the element and its live `ui` refs intact) so the section
    // removal below can't destroy them; they are re-homed into the fresh intro
    // afterwards. Detaching a child of the intro does not affect `first`/`parent`.
    if (ui && ui.wrap && ui.wrap.parentNode) {
      ui.wrap.parentNode.removeChild(ui.wrap);
    }

    const activeIds = computeActiveThemes(counts, island);
    const fragment = assembleDataFragment(island, activeIds);

    // Capture the section nodes BEFORE insertion moves them out of the fragment,
    // so we can collapse just their disclosures afterwards.
    const insertedNodes = Array.prototype.slice.call(fragment.childNodes);
    parent.insertBefore(fragment, first);
    existing.forEach(function (node) {
      node.remove();
    });

    // Re-home the detached controls at the end of the freshly-swapped intro.
    if (ui && ui.wrap) {
      placeControls(ui.wrap);
    }

    // The injected fragments ship their disclosure content VISIBLE (progressive
    // enhancement). The export's disclosure script binds clicks via delegation
    // (so the swapped-in buttons already work) but only collapses content on load;
    // collapse the freshly-injected sections now so they match a fresh export. No-op
    // in a static export (no disclosure script) or if the hook is absent.
    collapseInjectedDisclosures(insertedNodes);

    logInfo(
      "Applied refresh: " +
        (activeIds.length > 0
          ? activeIds.length + " active theme(s)"
          : "no issues (success)"),
    );
    return true;
  }

  /**
   * Collapses the disclosures inside freshly-injected section nodes via the
   * export disclosure script's exposed hook (window.ALLY_SP_DISCLOSURES.collapse),
   * scoped to only the new sections so any user-expanded boilerplate disclosure is
   * left untouched. Silent no-op when the hook is unavailable.
   * @param {Node[]} nodes - the section nodes just inserted
   */
  function collapseInjectedDisclosures(nodes) {
    const disclosures =
      typeof window !== "undefined" ? window.ALLY_SP_DISCLOSURES : null;
    if (!disclosures || typeof disclosures.collapse !== "function") return;
    nodes.forEach(function (node) {
      if (node && node.nodeType === 1) {
        disclosures.collapse(node);
      }
    });
  }

  /**
   * Formats a Date for the freshness indicator (British day-month-year plus
   * time). Stage 6 may align this with the app's formatDate wording.
   * @param {Date} date
   * @returns {string}
   */
  function formatFreshness(date) {
    try {
      return date.toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return date.toISOString();
    }
  }

  /**
   * Updates BOTH freshness <time>s to a new refresh moment: the header indicator
   * (#ally-sp-last-refreshed, Stage 3) and the restated line above the button
   * (ui.restatedTime). No-op (returns false) when neither is present.
   * @param {Date} date
   * @returns {boolean}
   */
  function updateFreshness(date) {
    const iso = date.toISOString();
    const text = formatFreshness(date);
    let updated = false;
    const header = document.getElementById(FRESHNESS_ID);
    if (header) {
      header.setAttribute("datetime", iso);
      header.textContent = text;
      updated = true;
    }
    if (ui && ui.restatedTime) {
      ui.restatedTime.setAttribute("datetime", iso);
      ui.restatedTime.textContent = text;
      updated = true;
    }
    if (!updated) {
      logDebug("No freshness element to update.");
    }
    return updated;
  }

  // ==========================================================================
  // Transport SEAM (Stage 4 implements the real worker fetch)
  // ==========================================================================

  /** Promise-based delay. */
  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Fetches fresh issue counts for the island's course from the Worker proxy.
   *
   * POSTs {clientId, courseId, region} to island.workerUrl and re-polls while the
   * Worker reports status "Processing" (the Worker does one Ally call per POST, so
   * the warm-up loop lives here, client-side). Resolves to the flat {field: number}
   * counts record once status is "Successful". No token is sent — the Worker holds
   * the read-only Ally token as a server-side secret.
   *
   * A test may override window.ALLY_SP_REFRESH._transport to bypass the network.
   *
   * @param {Object} island
   * @param {{onProgress?: Function}} [hooks]
   * @returns {Promise<Object>} a flat {field: number} counts record
   */
  async function fetchIssueCounts(island, hooks) {
    const opts = hooks || {};
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : function () {};

    // Test seam: an injected transport wins (used by the headless pipeline tests).
    if (typeof api._transport === "function") {
      return api._transport(island, opts);
    }

    const workerUrl = island && island.workerUrl;
    if (!workerUrl) {
      throw new Error("No worker URL is configured in the data island.");
    }

    const body = JSON.stringify({
      clientId: island.clientId,
      courseId: island.courseId,
      region: island.region,
    });

    const started = Date.now();
    let firstPoll = true;

    while (Date.now() - started < MAX_WAIT_MS) {
      if (!firstPoll) {
        await delay(POLL_INTERVAL_MS);
      }
      firstPoll = false;

      let response;
      try {
        response = await fetch(workerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
        });
      } catch (networkError) {
        // A cross-origin block or offline network fails the fetch outright; there
        // is no point re-polling a blocked endpoint, so surface it immediately.
        throw new Error("Could not reach the update service.");
      }

      if (!response.ok) {
        throw new Error("Update service returned HTTP " + response.status + ".");
      }

      const data = await response.json();
      const status = data && data.status;

      onProgress({
        status: status,
        elapsedMs: Date.now() - started,
        typicalWarmupSeconds: TYPICAL_WARMUP_SECONDS,
      });

      if (status === "Successful") {
        if (!data.record) {
          throw new Error("The update service returned no data for this course.");
        }
        return data.record;
      }

      if (status !== "Processing") {
        throw new Error("Unexpected status from the update service: " + status);
      }
    }

    throw new Error("Timed out waiting for the accessibility data to update.");
  }

  // ==========================================================================
  // Persistence (Stage 5) — localStorage snapshot, no token / no PII
  // ==========================================================================

  const SNAPSHOT_VERSION = 1;

  /**
   * Extracts the PII-safe numeric subset of a counts record: only the fields
   * that map to a theme (island.fieldMap). The worker's record also carries
   * identifiers (courseName, courseUrl, departmentName, numberOfStudents); those
   * are deliberately dropped — only the accessibility counts are ever stored.
   * @param {Object} record - the worker's flat record
   * @param {Object} island
   * @returns {Object} {field: number}
   */
  function extractCounts(record, island) {
    const fieldMap = (island && island.fieldMap) || {};
    const counts = {};
    Object.keys(fieldMap).forEach(function (themeId) {
      (fieldMap[themeId] || []).forEach(function (field) {
        const value = record ? record[field] : undefined;
        if (typeof value === "number" && !isNaN(value)) {
          counts[field] = value;
        }
      });
    });
    return counts;
  }

  /**
   * Persists the refresh snapshot under island.storageKey. Stores ONLY
   * {v, courseId, counts, lastCheckedOn, refreshedAt} — never the token or any
   * identifier. Fails soft when localStorage is unavailable (private / partitioned
   * storage, quota) so a refresh still succeeds visually without persistence.
   * @param {Object} island
   * @param {Object} counts - PII-safe subset from extractCounts
   * @param {string|null} lastCheckedOn - the Ally data timestamp, if any
   * @param {Date} refreshedAt
   */
  function persistSnapshot(island, counts, lastCheckedOn, refreshedAt) {
    if (!island || !island.storageKey) return;
    try {
      const snapshot = {
        v: SNAPSHOT_VERSION,
        courseId: island.courseId,
        counts: counts,
        lastCheckedOn: lastCheckedOn || null,
        refreshedAt: refreshedAt.toISOString(),
      };
      window.localStorage.setItem(island.storageKey, JSON.stringify(snapshot));
      logDebug("Refresh snapshot persisted.");
    } catch (e) {
      logWarn("Could not persist refresh snapshot:", e.message);
    }
  }

  /**
   * Reads and validates the persisted snapshot for this island's course. Returns
   * null when absent, unparseable, a different version, or a different course.
   * @param {Object} island
   * @returns {Object|null}
   */
  function readSnapshot(island) {
    if (!island || !island.storageKey) return null;
    try {
      const raw = window.localStorage.getItem(island.storageKey);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      if (
        !snapshot ||
        snapshot.v !== SNAPSHOT_VERSION ||
        snapshot.courseId !== island.courseId ||
        !snapshot.counts
      ) {
        return null;
      }
      return snapshot;
    } catch (e) {
      logWarn("Could not read refresh snapshot:", e.message);
      return null;
    }
  }

  /**
   * Rehydrates the document from a previously-persisted snapshot: re-applies the
   * stored counts (no network) and restores the freshness time. No-op (returns
   * false) when there is no valid snapshot.
   * @param {Object} island
   * @returns {boolean} true if the document was rehydrated
   */
  function rehydrate(island) {
    const snapshot = readSnapshot(island);
    if (!snapshot) return false;
    const applied = applyRefresh(island, snapshot.counts);
    if (!applied) return false;
    if (snapshot.refreshedAt) {
      const date = new Date(snapshot.refreshedAt);
      if (!isNaN(date.getTime())) {
        updateFreshness(date);
      }
    }
    logInfo("Rehydrated accessibility data from a previous refresh.");
    return true;
  }

  // ==========================================================================
  // Orchestration + UI
  // ==========================================================================

  /**
   * Sets the busy/disabled state on the refresh button.
   * @param {HTMLButtonElement} button
   * @param {boolean} busy
   */
  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      button.setAttribute("aria-disabled", "true");
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
    } else {
      button.removeAttribute("aria-disabled");
      button.removeAttribute("aria-busy");
      button.disabled = false;
    }
  }

  // The injected refresh-UI stylesheet. Theme-token based (var(--body-text) etc.)
  // so it tracks the export's own light/dark toggle, with pinned fallbacks for a
  // bare document. The button is a >=44px target with a visible focus ring; the
  // progress track carries a 1px border so the bar has a >=3:1 graphical boundary.
  const REFRESH_STYLES = [
    "#" + BUTTON_ID + "{font:inherit;cursor:pointer;min-height:44px;",
    "padding:.5rem 1rem;margin:.5rem .5rem .5rem 0;color:var(--body-text,#00131d);",
    "background:var(--body-bg,#fff);border:2px solid var(--body-text,#00131d);border-radius:4px;}",
    "#" + BUTTON_ID + ":hover{background:var(--body-text,#00131d);color:var(--body-bg,#fff);}",
    "#" + BUTTON_ID + ":focus-visible{outline:3px solid var(--heading-color,#005051);outline-offset:2px;}",
    "#" + BUTTON_ID + "[disabled]{cursor:progress;}",
    ".ally-sp-refresh-restated{margin:.75rem 0 .25rem;}",
    "." + "ally-sp-refresh-progress{margin:.5rem 0;max-width:32rem;}",
    ".ally-sp-refresh-status{margin:.25rem 0;}",
    ".ally-sp-refresh-track{position:relative;height:.75rem;border:1px solid var(--body-text,#00131d);",
    "border-radius:4px;overflow:hidden;background:var(--body-bg,#fff);}",
    ".ally-sp-refresh-fill{display:block;height:100%;width:0;background:var(--heading-color,#005051);transition:width .3s ease;}",
    "@media (prefers-reduced-motion:reduce){.ally-sp-refresh-fill{transition:none;}}",
    ".ally-sp-refresh-vh{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;",
    "overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}",
  ].join("");

  /** Injects the refresh-UI stylesheet once. */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = REFRESH_STYLES;
    (document.head || document.documentElement).appendChild(style);
  }

  /** Sets the polite status line, only when it actually changes (no re-announce). */
  function setMessage(text) {
    if (!ui || !ui.status) return;
    if (ui.lastMessage === text) return;
    ui.lastMessage = text;
    ui.status.textContent = text;
  }

  /** Sets the progressbar value (0-100) and the mirrored fill width. */
  function setPercent(percent) {
    if (!ui || !ui.track) return;
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    ui.track.setAttribute("aria-valuenow", String(p));
    ui.track.setAttribute("aria-valuetext", p + "%");
    ui.fill.style.width = p + "%";
  }

  /** Reveals the progress block (status line + bar). */
  function showProgress() {
    if (!ui) return;
    ui.progress.hidden = false;
    ui.track.hidden = false;
  }

  /**
   * onProgress handler for fetchIssueCounts: drives the percentage (capped at 95%
   * until success) and the reassurance copy from the warm-up clock.
   * @param {{status?: string, elapsedMs?: number, typicalWarmupSeconds?: number}} info
   */
  function updateProgress(info) {
    if (!ui) return;
    const typical = (info && info.typicalWarmupSeconds) || TYPICAL_WARMUP_SECONDS;
    const elapsed = ((info && info.elapsedMs) || 0) / 1000;
    const remaining = Math.max(0, typical - elapsed);
    setPercent(Math.min(PROGRESS_CAP, (elapsed / typical) * 100));
    if (remaining === 0) {
      setMessage(COPY.longer);
    } else if (remaining <= ALMOST_READY_SECONDS) {
      setMessage(COPY.almostReady);
    } else {
      setMessage(COPY.updating);
    }
  }

  /**
   * The refresh flow: fetch -> recompute -> swap -> update freshness -> persist,
   * with a polite status line + progressbar throughout. Fails soft: any error
   * leaves the baked snapshot untouched, shows a failure message, and re-enables
   * the button.
   * @param {Object} island
   * @param {HTMLButtonElement} button
   */
  async function refresh(island, button) {
    setBusy(button, true);
    showProgress();
    setPercent(0);
    setMessage(COPY.updating);
    try {
      const record = await fetchIssueCounts(island, { onProgress: updateProgress });
      // Reduce to the PII-safe numeric subset before it ever touches the DOM or
      // storage — computeActiveThemes only reads the theme fields anyway.
      const counts = extractCounts(record, island);
      const applied = applyRefresh(island, counts);
      if (!applied) {
        throw new Error("Refresh could not be applied to the document.");
      }
      const now = new Date();
      updateFreshness(now);
      persistSnapshot(island, counts, record && record.lastCheckedOn, now);
      setPercent(100);
      setMessage(COPY.success);
      if (ui && ui.track) ui.track.hidden = true; // keep the success line, drop the bar
      logInfo("Accessibility data updated.");
    } catch (e) {
      setMessage(COPY.failure);
      if (ui && ui.track) ui.track.hidden = true;
      logError("Refresh failed:", e && e.message);
    } finally {
      setBusy(button, false);
    }
  }

  /**
   * Places the controls at the end of the intro section's text — inside
   * <section class="ally-sp-intro ally-sp-info">, after the "what you can do about
   * it" content — so the update button reads with the accessibility-data
   * explanation it acts on. Falls back to after the freshness <time>, then before
   * the first data-category section, if there is no intro.
   * @param {HTMLElement} wrap - the controls wrapper
   * @returns {boolean} true if placed
   */
  function placeControls(wrap) {
    const intro =
      document.querySelector('[data-sp-section="intro"]') ||
      document.querySelector(".ally-sp-intro");
    if (intro) {
      const col =
        intro.querySelector(".ally-sp-info-col") ||
        intro.querySelector(".ally-sp-info-body") ||
        intro;
      col.appendChild(wrap);
      logDebug("Refresh controls placed at the end of the intro section.");
      return true;
    }
    const fresh = document.getElementById(FRESHNESS_ID);
    if (fresh && fresh.parentNode) {
      fresh.parentNode.insertBefore(wrap, fresh.nextSibling);
      logDebug("Refresh controls placed after the freshness indicator (fallback).");
      return true;
    }
    const firstData = document.querySelector(DATA_SECTION_SELECTOR);
    if (firstData && firstData.parentNode) {
      firstData.parentNode.insertBefore(wrap, firstData);
      logDebug("Refresh controls placed before the data section (fallback).");
      return true;
    }
    logWarn("No anchor for the refresh controls — not placed.");
    return false;
  }

  /**
   * Builds the refresh controls (button + hidden progress block: a
   * role="status" polite line and a role="progressbar" with a visually-hidden
   * name) and places them at the end of the intro section (see placeControls).
   * Idempotent.
   * @param {Object} island
   * @returns {HTMLButtonElement|null}
   */
  function injectControls(island) {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) return existing;

    const wrap = document.createElement("div");
    wrap.className = "ally-sp-refresh-controls";

    // Restated "last refreshed" line above the button, so the reason to update is
    // clear at the point of action. Its initial value is copied from the header
    // freshness <time> (#ally-sp-last-refreshed); updateFreshness updates BOTH. Only
    // shown when there is a baked date to restate.
    let restatedTime = null;
    const header = document.getElementById(FRESHNESS_ID);
    if (header) {
      const restated = document.createElement("p");
      restated.className = "ally-sp-refresh-restated";
      restated.appendChild(document.createTextNode(COPY.restatedPrefix));
      restatedTime = document.createElement("time");
      restatedTime.setAttribute("datetime", header.getAttribute("datetime") || "");
      restatedTime.textContent = header.textContent || "";
      restated.appendChild(restatedTime);
      restated.appendChild(document.createTextNode("."));
      wrap.appendChild(restated);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.id = BUTTON_ID;
    button.className = "ally-sp-refresh-button";
    button.textContent = BUTTON_LABEL;
    button.addEventListener("click", function () {
      refresh(island, button);
    });
    wrap.appendChild(button);

    const progress = document.createElement("div");
    progress.id = PROGRESS_ID;
    progress.className = "ally-sp-refresh-progress";
    progress.hidden = true;

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "ally-sp-refresh-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    progress.appendChild(status);

    const track = document.createElement("div");
    track.id = PROGRESSBAR_ID;
    track.className = "ally-sp-refresh-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", "0");
    track.setAttribute("aria-valuetext", "0%");

    // Visually-hidden accessible name for the progressbar (referenced, not shown).
    const label = document.createElement("span");
    const labelId = PROGRESSBAR_ID + "-label";
    label.id = labelId;
    label.className = "ally-sp-refresh-vh";
    label.textContent = "Accessibility data update progress";
    track.setAttribute("aria-labelledby", labelId);
    track.appendChild(label);

    const fill = document.createElement("span");
    fill.className = "ally-sp-refresh-fill";
    fill.setAttribute("aria-hidden", "true");
    track.appendChild(fill);

    progress.appendChild(track);
    wrap.appendChild(progress);

    ui = {
      wrap: wrap,
      button: button,
      progress: progress,
      status: status,
      track: track,
      fill: fill,
      restatedTime: restatedTime,
      lastMessage: "",
    };

    if (!placeControls(wrap)) {
      return null;
    }
    return button;
  }

  /**
   * Boots the refresh feature: reads the island and, when present, injects the
   * styles + controls and rehydrates any prior refresh. A static export (no
   * island) leaves the document exactly as baked.
   * @returns {boolean} true if the feature initialised
   */
  function init() {
    const island = readIsland();
    if (!island) return false;
    api.island = island;
    injectStyles();
    injectControls(island);
    // Rehydrate from a prior refresh (no network) so a reopened export shows the
    // last-refreshed data rather than the baked snapshot.
    rehydrate(island);
    logInfo("Refresh feature initialised for course " + island.courseId);
    return true;
  }

  // ==========================================================================
  // Public surface (for testing + the Stage 4/5/6 seams) + auto-init
  // ==========================================================================
  const api = {
    init: init,
    readIsland: readIsland,
    computeActiveThemes: computeActiveThemes,
    assembleDataFragment: assembleDataFragment,
    applyRefresh: applyRefresh,
    updateFreshness: updateFreshness,
    injectControls: injectControls,
    updateProgress: updateProgress,
    refresh: refresh,
    extractCounts: extractCounts,
    persistSnapshot: persistSnapshot,
    readSnapshot: readSnapshot,
    rehydrate: rehydrate,
    island: null,
    _transport: null, // Stage 4 sets the real transport; tests may override.
    _version: 1,
  };

  if (typeof window !== "undefined") {
    window.ALLY_SP_REFRESH = api;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
