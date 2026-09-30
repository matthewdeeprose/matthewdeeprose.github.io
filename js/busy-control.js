/**
 * Busy control — hold a control busy WITHOUT throwing keyboard focus away.
 *
 * Why this exists. Setting native `disabled` on the control a person has just
 * pressed (or is typing in) makes the browser blur it synchronously, inside the
 * assignment, so focus falls to <body> and a screen reader re-orients on the
 * whole document. Parcel 39 measured that in nine shipped sites across six
 * tools, and in six of them nothing ever put focus back
 * (.claude/measurements/p39-focus-drop-census/findings.md). This helper is the
 * one shared answer: it marks the control busy, suppresses its activation, and
 * puts focus back on release — and it never sets `disabled`.
 *
 * This is a plain IIFE script (NOT an ES module) deliberately: every tool that
 * drops focus is a plain script, and Image Describer forbids `import` outright.
 * It publishes `window.BusyControl`. Callers resolve that global AT CALL TIME and
 * never cache it at module scope, the same rule as `window.accessibilityHelpers`.
 *
 *   const hold = window.BusyControl.hold(control, { moveTo, restoreTo });
 *   // …work…
 *   hold.release();
 *
 * What it does NOT do:
 *   - No CSS. `:disabled` does not match an `aria-disabled` control, so each
 *     adopting tool styles `[aria-disabled="true"]` and `[readonly]` beside
 *     `:disabled` in its own sheet, in both themes.
 *   - No announcement of any kind. A busy state is not an event, and a fifth
 *     announcement channel is forbidden (AGENTS.md § Announcements).
 *   - Nothing inside a UniversalModal body. The modal owns focus there — it
 *     restores on close and on rebuild — so do not hold a control inside one.
 *
 * @version 1.0.0
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[BusyControl]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[BusyControl]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[BusyControl]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[BusyControl]");
      console.log.apply(console, args);
    }
  }

  // ── Constants ───────────────────────────────────────────────────────────
  const ATTR = Object.freeze({
    BUSY: "aria-busy",
    DISABLED: "aria-disabled",
    READONLY: "aria-readonly",
    ROLE: "role",
  });
  const ATTR_TRUE = "true";

  const KEY = Object.freeze({
    ENTER: "Enter",
    SPACE: " ",
    SPACEBAR: "Spacebar", // legacy key value for Space
  });

  const EVENT = Object.freeze({
    CLICK: "click",
    KEYDOWN: "keydown",
    BEFOREINPUT: "beforeinput",
  });
  const GUARDED_EVENTS = Object.freeze([
    EVENT.CLICK,
    EVENT.KEYDOWN,
    EVENT.BEFOREINPUT,
  ]);

  /** What a control is, which decides how it is held. */
  const KIND = Object.freeze({
    BUTTON: "button",
    TEXT_CONTROL: "text-control", // <textarea> and text-like <input>: native readOnly
    EDITING_HOST: "editing-host", // contenteditable: has no readOnly, see holdAttributes
    OTHER: "other",
  });

  const BUTTON_INPUT_TYPES = Object.freeze(["button", "submit", "reset"]);
  const TEXT_INPUT_TYPES = Object.freeze([
    "text",
    "search",
    "email",
    "url",
    "tel",
    "password",
    "number",
  ]);

  // ── State ───────────────────────────────────────────────────────────────
  /** Held control → its handle. A Map (not a WeakMap) so the guard knows when none remain. */
  const held = new Map();
  let guardInstalled = false;

  // ── Classification ──────────────────────────────────────────────────────
  function kindOf(control) {
    const tag = control.tagName;
    if (tag === "BUTTON") return KIND.BUTTON;
    if (tag === "TEXTAREA") return KIND.TEXT_CONTROL;
    if (tag === "INPUT") {
      const type = (control.getAttribute("type") || "text").toLowerCase();
      if (BUTTON_INPUT_TYPES.indexOf(type) !== -1) return KIND.BUTTON;
      if (TEXT_INPUT_TYPES.indexOf(type) !== -1) return KIND.TEXT_CONTROL;
      return KIND.OTHER;
    }
    if (control.getAttribute(ATTR.ROLE) === "button") return KIND.BUTTON;
    if (control.isContentEditable) return KIND.EDITING_HOST;
    return KIND.OTHER;
  }

  function isActivationKey(event) {
    return (
      event.key === KEY.ENTER ||
      event.key === KEY.SPACE ||
      event.key === KEY.SPACEBAR
    );
  }

  /**
   * Decide whether one event must be refused because it targets a held control.
   * @returns {boolean}
   */
  function shouldSuppress(handle, event) {
    if (handle.kind === KIND.BUTTON) {
      if (event.type === EVENT.CLICK) return true;
      return event.type === EVENT.KEYDOWN && isActivationKey(event);
    }
    if (handle.kind === KIND.TEXT_CONTROL || handle.kind === KIND.EDITING_HOST) {
      if (event.type === EVENT.BEFOREINPUT) return true;
      return (
        event.type === EVENT.KEYDOWN &&
        event.key === KEY.ENTER &&
        !event.shiftKey
      );
    }
    return false;
  }

  /** The held handle whose control is, or contains, the event target — or null. */
  function heldHandleFor(target) {
    if (!(target instanceof Node)) return null;
    for (const handle of held.values()) {
      if (handle.control === target || handle.control.contains(target)) {
        return handle;
      }
    }
    return null;
  }

  // ── The shared guard ────────────────────────────────────────────────────
  // ONE document-level capture listener for every held control, so the order
  // in which a tool registered its own listeners cannot defeat it. Events on a
  // control that is not held — the moveTo target above all — pass untouched.
  function guard(event) {
    const handle = heldHandleFor(event.target);
    if (!handle) return;
    if (!shouldSuppress(handle, event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    logDebug("guard: refused", event.type, event.key || "");
  }

  function installGuard() {
    if (guardInstalled) return;
    GUARDED_EVENTS.forEach(function (type) {
      document.addEventListener(type, guard, true);
    });
    guardInstalled = true;
    logDebug("guard installed");
  }

  function removeGuard() {
    if (!guardInstalled) return;
    GUARDED_EVENTS.forEach(function (type) {
      document.removeEventListener(type, guard, true);
    });
    guardInstalled = false;
    logDebug("guard removed");
  }

  // ── Attributes: record exactly what was added, so release removes only that ─
  function setRecorded(control, name, added) {
    const previous = control.getAttribute(name);
    if (previous === ATTR_TRUE) return; // already set by the caller: leave as found
    added.attributes.push({ name: name, previous: previous });
    control.setAttribute(name, ATTR_TRUE);
  }

  function holdAttributes(control, kind, added) {
    setRecorded(control, ATTR.BUSY, added);

    if (kind === KIND.BUTTON) {
      setRecorded(control, ATTR.DISABLED, added);
      return;
    }
    if (kind === KIND.TEXT_CONTROL) {
      // Native readOnly keeps focus and refuses edits; aria-disabled is NOT
      // used on a text box, because its busy-ness is about editing.
      if (!control.readOnly) {
        control.readOnly = true;
        added.readOnly = true;
      }
      return;
    }
    if (kind === KIND.EDITING_HOST) {
      // A contenteditable host has no readOnly property, and setting
      // contenteditable="false" would make it unfocusable and drop focus. So
      // aria-readonly says it, and the guard's beforeinput refusal enforces it.
      setRecorded(control, ATTR.READONLY, added);
    }
  }

  function releaseAttributes(control, added) {
    added.attributes.forEach(function (entry) {
      if (entry.previous === null) {
        control.removeAttribute(entry.name);
      } else {
        control.setAttribute(entry.name, entry.previous);
      }
    });
    if (added.readOnly) control.readOnly = false;
  }

  // ── Focus restore on release ────────────────────────────────────────────
  function restoreFocus(handle) {
    const active = document.activeElement;
    const personIsElsewhere = !(
      active === null ||
      active === document.body ||
      (handle.moveTo !== null && active === handle.moveTo)
    );
    if (personIsElsewhere) return; // never take focus from where the person moved it

    let target = null;
    if (handle.control.isConnected) {
      target = handle.control;
    } else if (handle.restoreTo instanceof Element && handle.restoreTo.isConnected) {
      target = handle.restoreTo;
    }
    if (target === null) {
      logWarn(
        "release: the held control is no longer in the document and no connected restoreTo was given; focus left alone",
      );
      return;
    }
    if (target !== active) target.focus();
  }

  // ── Public API ──────────────────────────────────────────────────────────
  /**
   * Hold a control busy. Never sets native `disabled`, never removes one a
   * caller set, and never changes the accessible name.
   *
   * Sets aria-busy="true"; a button also gets aria-disabled="true"; a text box
   * gets native readOnly (a contenteditable host gets aria-readonly, having no
   * readOnly). Activation is refused while held by one shared capture guard.
   * Holding a control that is already held returns the same handle and changes
   * nothing.
   *
   * @param {Element} control - The control the person activated or is in.
   * @param {Object} [options]
   * @param {Element} [options.moveTo] - A control that becomes useful while
   *   busy (Cancel). It receives focus FIRST, before any attribute is set.
   * @param {Element} [options.restoreTo] - Where release puts focus if the held
   *   control has been removed from the document by then.
   * @returns {{release: function(): void, control: Element}} The handle.
   */
  function hold(control, options) {
    if (!(control instanceof Element)) {
      logError("hold: expected an Element, received", control);
      return { control: null, release: function () {} };
    }

    const existing = held.get(control);
    if (existing) {
      logDebug("hold: already held; returning the same handle");
      return existing;
    }

    const opts = options || {};
    const moveTo = opts.moveTo instanceof Element ? opts.moveTo : null;
    const restoreTo = opts.restoreTo instanceof Element ? opts.restoreTo : null;
    const kind = kindOf(control);
    if (kind === KIND.OTHER) {
      logWarn("hold: not a button or text box; only aria-busy is set", control);
    }

    // moveTo FIRST: focus leaves only for a control the person can use, and
    // before anything about the held control changes.
    if (moveTo !== null && moveTo.isConnected) moveTo.focus();

    const added = { attributes: [], readOnly: false };
    holdAttributes(control, kind, added);

    const handle = {
      control: control,
      kind: kind,
      moveTo: moveTo,
      restoreTo: restoreTo,
      released: false,
      release: function () {
        release(handle, added);
      },
    };
    held.set(control, handle);
    installGuard();
    logDebug("hold: holding", kind);
    return handle;
  }

  /**
   * Release a hold: remove exactly what hold added, remove the shared guard if
   * nothing remains held, then put focus back on the held control (or on
   * restoreTo if the held control was removed) — but ONLY if focus is on
   * <body>, null, or the moveTo target. It never takes focus from somewhere the
   * person moved it, and never focuses a detached node.
   *
   * Call it BEFORE hiding a moveTo target. Hiding the focused moveTo target
   * first throws focus to <body> — Image Describer's second measured drop.
   * Idempotent: a second call does nothing.
   */
  function release(handle, added) {
    if (handle.released) {
      logDebug("release: already released; nothing to do");
      return;
    }
    handle.released = true;
    held.delete(handle.control);
    releaseAttributes(handle.control, added);
    if (held.size === 0) removeGuard();
    restoreFocus(handle);
    logDebug("release: released");
  }

  window.BusyControl = Object.freeze({ hold: hold });
  logInfo("BusyControl published");
})();
