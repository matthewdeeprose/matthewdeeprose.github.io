/**
 * @file tool-registry.js
 * @description Single place to control WHICH tools appear in the tool picker,
 * in WHAT ORDER, and whether each carries an "Alpha" or "Beta" maturity badge.
 *
 * Edit the TOOLS array below and reload the page. Nothing else needs touching.
 *
 * Loaded by a <script> tag placed immediately after the tool picker's closing
 * </nav> in tools.html, so the reorder and hide apply before the rest of the
 * page is parsed — there is no flash of the wrong order.
 *
 * @module ToolRegistry
 * @author Matthew Deeprose
 */
window.ToolRegistry = (function () {
  "use strict";

  // Logging configuration
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
      console.error("[ToolRegistry]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ToolRegistry]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ToolRegistry]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ToolRegistry]", message, ...args);
  }

  // =========================================================================
  // === TOOL REGISTRY — THIS IS THE BIT YOU EDIT ============================
  // =========================================================================
  //
  //   ORDER   The order of the lines below is the order the tools appear on
  //           screen, left to right (and top to bottom on a narrow screen).
  //           Move a line to move a tool. That is the whole mechanism.
  //           EXCEPT Set Up, which is pinned to first place — see
  //           PINNED_FIRST below. Everything after it is yours to arrange.
  //
  //   status  null      no badge — the tool is ready for general use
  //           "alpha"   adds a visible "Alpha" badge
  //           "beta"    adds a visible "Beta" badge
  //
  //   hidden  false     the tool appears in the picker
  //           true      the tool is removed from the picker. It still WORKS —
  //                     you can open it from the console with its showXxx()
  //                     function (e.g. showOpenRouter()) — it is just not
  //                     offered to visitors. Set back to false to restore it.
  //
  //   value   MUST match the radio's `value` attribute in tools.html exactly.
  //           Do not invent or change these: other parts of the app read them.
  //           A typo here is reported as a console warning on page load.
  //
  // The badge text becomes part of what a screen reader announces for the
  // option ("Image Describer Beta, radio button"), which is deliberate — see
  // the notes above .tool-flag in main.css.
  //
  const TOOLS = [
    // Always first — pinned, not merely listed first. See PINNED_FIRST.
    { value: "Set Up", status: null, hidden: false },

    { value: "Ally Reporting", status: "beta", hidden: false },
    { value: "Image Describer", status: "beta", hidden: false },
    { value: "MathPix", status: "beta", hidden: false },
    { value: "Local Chat", status: null, hidden: false },
    { value: "Markdown Editor", status: null, hidden: false },
    { value: "Chat", status: "beta", hidden: false },
    { value: "Graph Builder", status: "alpha", hidden: false },

    { value: "OpenRouter", status: null, hidden: true },
  ];

  // =========================================================================
  // Below here is the machinery. You should not need to change it.
  // =========================================================================

  /**
   * Visible badge text per status. Frozen so an unrecognised status is caught
   * as a warning rather than silently rendering an empty pill.
   */
  const FLAG_LABELS = Object.freeze({
    alpha: "Alpha",
    beta: "Beta",
  });

  /**
   * Tool pinned to first position regardless of where it sits in TOOLS.
   * Set Up is the landing page and the one place every credential is
   * configured, so its position is fixed rather than a convention that a
   * future reorder could quietly undo. Moving it in the array is reported and
   * corrected, not obeyed. Set to null to unpin.
   */
  const PINNED_FIRST = "Set Up";

  const FIELDSET_ID = "toolSelection";
  const WRAPPER_SELECTOR = ".tool-option-wrapper";
  const FLAG_CLASS = "tool-flag";
  const QUICK_START_SELECTOR = ".setup-quick-start-list";
  const TOOL_COUNT_SELECTOR = "[data-tool-count]";

  /**
   * Spelled numbers, so the Quick Start intro keeps reading as prose rather
   * than switching to a numeral. Anything past the end falls back to digits.
   */
  const NUMBER_WORDS = Object.freeze([
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
  ]);

  /**
   * Build the badge element for a status, or null if the tool has none.
   *
   * @param {string|null} status - "alpha", "beta", or null
   * @param {string} toolValue - only used to name the tool in a warning
   * @returns {HTMLElement|null}
   */
  function buildFlag(status, toolValue) {
    if (!status) return null;

    const text = FLAG_LABELS[status];
    if (!text) {
      logWarn(
        `"${toolValue}" has status "${status}", which is not recognised. ` +
          `Use ${Object.keys(FLAG_LABELS).join(", ")}, or null for no badge.`,
      );
      return null;
    }

    const span = document.createElement("span");
    span.className = FLAG_CLASS;
    span.setAttribute("data-flag", status);
    span.textContent = text;
    return span;
  }

  /**
   * Remove any badge already present, so applying twice cannot double up.
   *
   * @param {HTMLElement} container
   */
  function clearExistingFlag(container) {
    container
      .querySelectorAll(`.${FLAG_CLASS}`)
      .forEach((existing) => existing.remove());
  }

  /**
   * Find the picker label (the pill) for a given radio value.
   *
   * @param {HTMLElement} fieldset
   * @param {string} value
   * @returns {HTMLElement|null}
   */
  function findWrapper(fieldset, value) {
    const radio = fieldset.querySelector(
      `input[name="presentation"][value="${CSS.escape(value)}"]`,
    );
    return radio ? radio.closest(WRAPPER_SELECTOR) : null;
  }

  /**
   * Read a tool's visible name from its own label, rather than storing it a
   * second time in the array. Keeps the picker and the Quick Start list from
   * drifting apart.
   *
   * @param {HTMLElement} wrapper
   * @returns {string}
   */
  function readVisibleName(wrapper) {
    const nameSpan = wrapper.querySelector(".radio");
    return nameSpan ? nameSpan.textContent.trim() : "";
  }

  /**
   * Apply hiding, badges and ordering to the tool picker.
   * Runs synchronously at script load, while the rest of the page is still
   * being parsed.
   */
  function applyToPicker() {
    const fieldset = document.getElementById(FIELDSET_ID);
    if (!fieldset) {
      logError(
        `#${FIELDSET_ID} not found. The <script> tag for this file must sit ` +
          `AFTER the tool picker markup in tools.html.`,
      );
      return;
    }

    const allWrappers = Array.from(
      fieldset.querySelectorAll(WRAPPER_SELECTOR),
    );
    const ordered = [];

    // Honour the pin before anything else, so the rest of the array can be
    // rearranged freely without the landing tool drifting out of first place.
    const entries = TOOLS.slice();
    if (PINNED_FIRST) {
      const at = entries.findIndex((tool) => tool.value === PINNED_FIRST);
      if (at > 0) {
        entries.unshift(entries.splice(at, 1)[0]);
        logWarn(
          `"${PINNED_FIRST}" is pinned to first position and has been moved ` +
            `back there. Reorder the other tools freely, or change ` +
            `PINNED_FIRST in js/tool-registry.js if you mean to unpin it.`,
        );
      }
    }

    entries.forEach((tool) => {
      const wrapper = findWrapper(fieldset, tool.value);

      if (!wrapper) {
        logWarn(
          `No tool found with value "${tool.value}". Check the spelling ` +
            `against the radio's value attribute in tools.html — it is ` +
            `case- and space-sensitive. This entry has been ignored.`,
        );
        return;
      }

      // Hidden: one attribute removes it from layout, from the tab order,
      // and from the accessibility tree.
      if (tool.hidden) {
        wrapper.hidden = true;
      } else {
        wrapper.hidden = false;
      }

      clearExistingFlag(wrapper);
      const flag = buildFlag(tool.status, tool.value);
      if (flag) wrapper.appendChild(flag);

      ordered.push(wrapper);
    });

    // Anything in the markup but missing from the array keeps its place at the
    // end rather than disappearing — a newly added tool must never vanish
    // silently just because nobody remembered to list it here.
    allWrappers.forEach((wrapper) => {
      if (ordered.includes(wrapper)) return;
      logWarn(
        `"${readVisibleName(wrapper)}" is in tools.html but not in the TOOLS ` +
          `array, so it has been left at the end of the picker. Add it to ` +
          `js/tool-registry.js to control its position.`,
      );
      ordered.push(wrapper);
    });

    // Re-parenting an existing node moves it; the radios keep their identity,
    // their onclick, and their checked state.
    ordered.forEach((wrapper) => fieldset.appendChild(wrapper));

    ensureVisibleSelection(fieldset, ordered);

    logInfo(
      `Picker applied: ${ordered.filter((w) => !w.hidden).length} visible, ` +
        `${ordered.filter((w) => w.hidden).length} hidden.`,
    );
  }

  /**
   * Guard against the selected tool being a hidden one, which would land a
   * visitor on a tool with no corresponding option on screen.
   *
   * @param {HTMLElement} fieldset
   * @param {HTMLElement[]} ordered
   */
  function ensureVisibleSelection(fieldset, ordered) {
    const checked = fieldset.querySelector(
      'input[name="presentation"]:checked',
    );
    const checkedWrapper = checked ? checked.closest(WRAPPER_SELECTOR) : null;

    if (checkedWrapper && !checkedWrapper.hidden) return;

    const firstVisible = ordered.find((wrapper) => !wrapper.hidden);
    if (!firstVisible) {
      logError("Every tool is hidden. At least one must stay visible.");
      return;
    }

    const radio = firstVisible.querySelector('input[type="radio"]');
    if (!radio) return;

    radio.checked = true;
    logWarn(
      `The selected tool is hidden, so "${readVisibleName(firstVisible)}" ` +
        `has been selected instead.`,
    );
  }

  /**
   * Bring the Quick Start guide on the Set Up page into line with the picker:
   * same order, same badges, hidden tools' entries hidden, and the tool count
   * in the intro rewritten.
   *
   * Called from an inline script directly beneath the </dl> in tools.html —
   * the earliest point at which the list exists — with a DOMContentLoaded
   * listener as the fallback. It cannot run at this file's own load, because
   * the list is further down the document and has not been parsed yet.
   *
   * Terms with no matching tool — "Microsoft Foundry", which is a credential
   * provider rather than a tool — keep their relative order and fall to the
   * end of the list rather than interrupting the tool sequence.
   */
  function applyToQuickStart() {
    const list = document.querySelector(QUICK_START_SELECTOR);
    if (!list) {
      logDebug("No Quick Start list on this page — nothing to do.");
      return;
    }

    const fieldset = document.getElementById(FIELDSET_ID);
    if (!fieldset) return;

    // A <dt> owns every <dd> up to the next <dt>, so the pair must move as one
    // unit. Reordering the terms alone would leave each description stranded
    // under the wrong term — a silent, and very confusing, corruption.
    const groups = [];
    Array.from(list.children).forEach((node) => {
      if (node.tagName === "DT") {
        groups.push({ term: node, details: [] });
      } else if (node.tagName === "DD" && groups.length) {
        groups[groups.length - 1].details.push(node);
      }
    });

    const ordered = [];

    TOOLS.forEach((tool) => {
      const wrapper = findWrapper(fieldset, tool.value);
      if (!wrapper) return;

      const name = readVisibleName(wrapper);
      const group = groups.find(
        (candidate) =>
          !ordered.includes(candidate) && readTermName(candidate.term) === name,
      );

      if (!group) {
        logDebug(`No Quick Start entry for "${name}" — nothing to reorder.`);
        return;
      }

      group.term.hidden = Boolean(tool.hidden);
      group.details.forEach((dd) => {
        dd.hidden = Boolean(tool.hidden);
      });

      clearExistingFlag(group.term);
      const flag = buildFlag(tool.status, tool.value);
      if (flag) {
        group.term.appendChild(document.createTextNode(" "));
        group.term.appendChild(flag);
      }

      ordered.push(group);
    });

    // An entry describing something that is not a tool — Microsoft Foundry is
    // a credential provider — keeps its relative order and falls to the end,
    // rather than interrupting the tool sequence partway down.
    groups.forEach((group) => {
      if (!ordered.includes(group)) ordered.push(group);
    });

    ordered.forEach((group) => {
      list.appendChild(group.term);
      group.details.forEach((dd) => list.appendChild(dd));
    });

    updateToolCount();

    logDebug(`Quick Start guide updated: ${ordered.length} entries.`);
  }

  /**
   * Read a term's own text, excluding any badge previously appended to it, so
   * matching still works when the guide is re-applied.
   *
   * @param {HTMLElement} term
   * @returns {string}
   */
  function readTermName(term) {
    const copy = term.cloneNode(true);
    copy.querySelectorAll(`.${FLAG_CLASS}`).forEach((flag) => flag.remove());
    return copy.textContent.trim();
  }

  /**
   * Write the number of visible tools into any [data-tool-count] element, so
   * the Quick Start intro cannot contradict the picker after a tool is hidden
   * or added.
   *
   * Counts the options a visitor can actually choose, Set Up included.
   * Writes only on a change — rewriting identical text is wasted work, and a
   * live region would speak it again.
   */
  function updateToolCount() {
    const targets = document.querySelectorAll(TOOL_COUNT_SELECTOR);
    if (!targets.length) return;

    const fieldset = document.getElementById(FIELDSET_ID);
    if (!fieldset) return;

    const visible = Array.from(
      fieldset.querySelectorAll(WRAPPER_SELECTOR),
    ).filter((wrapper) => !wrapper.hidden).length;

    const text = NUMBER_WORDS[visible] || String(visible);
    targets.forEach((target) => {
      if (target.textContent !== text) target.textContent = text;
    });
  }

  /**
   * Re-apply everything. Exposed mainly so the effect of an edit can be tried
   * from the console without a reload.
   */
  function apply() {
    applyToPicker();
    applyToQuickStart();
  }

  /**
   * @param {string} value - a tool's radio value
   * @returns {string|null|undefined} its status, or undefined if not listed
   */
  function getStatus(value) {
    const tool = TOOLS.find((entry) => entry.value === value);
    return tool ? tool.status : undefined;
  }

  /**
   * @returns {Array<Object>} a copy of the registry, for inspection
   */
  function list() {
    return TOOLS.map((tool) => ({ ...tool }));
  }

  // Apply to the picker straight away — the markup above this script tag has
  // been parsed, but nothing has painted yet.
  applyToPicker();

  // The Quick Start list is further down the document and does not exist yet,
  // so it cannot be done here. tools.html calls applyQuickStart() from a
  // two-line inline script directly beneath the </dl>, which is the earliest
  // possible moment and avoids the list visibly rearranging itself: on this
  // page DOMContentLoaded is SECONDS after first paint, so waiting for it
  // would show the old order and then jump.
  // This listener stays as the fallback for a page that carries the list
  // without that call. Both paths are idempotent, so running twice is safe.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyToQuickStart);
  } else {
    applyToQuickStart();
  }

  return { apply, applyQuickStart: applyToQuickStart, getStatus, list };
})();
