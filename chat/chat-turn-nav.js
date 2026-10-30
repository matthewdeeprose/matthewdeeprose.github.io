/**
 * Unified Chat Tool — question navigation (parcel P10)
 *
 * Two things for a long conversation, each with its own switch in TURN_NAV_CONFIG:
 *
 *   1. A visible heading on every question ("Question 3"), put inside the question's
 *      bubble as its first child by decorateQuestion(). chat/chat-messages.js calls it from
 *      renderUserContent, which every question passes through — live, restored, and after a
 *      cancelled or committed edit — so the heading arrives in the same insertion as the
 *      question text and never as a separate addition to the live message list.
 *
 *   2. "Previous question" and "Next question" buttons added to the site's fixed Top / Bottom
 *      panel at run time (no markup in tools.html). They show only while Chat is the open
 *      tool and has MIN_REPLIES or more replies. A move scrolls the target to the top of the
 *      screen and focuses it; the screen reader reads the focused heading, so nothing is
 *      announced and nothing is written to the live list.
 *
 * To turn it off, set SHOW_BUTTONS and ADD_HEADINGS to false (Chat then behaves as before),
 * or delete the <script> and <link> tags for this file in tools.html (the two guarded calls
 * in chat-messages.js and chat-core.js then do nothing).
 *
 * Loads AFTER chat/chat-messages.js. Reads window.ChatState only; never touches Local Chat.
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
      args.unshift("[ChatTurnNav]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatTurnNav]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatTurnNav]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatTurnNav]");
      console.log.apply(console, args);
    }
  }

  // ── The switches. Change these and nothing else to change the behaviour. ──
  const TURN_NAV_CONFIG = Object.freeze({
    SHOW_BUTTONS: true, // false: no Previous / Next question buttons anywhere
    ADD_HEADINGS: true, // false: no question headings (buttons then jump to the question bubbles)
    MIN_REPLIES: 2, // buttons appear once there are this many replies
    HEADING_LEVEL: 2, // under the page's h1 "Chat"; a reply keeps its own heading levels
    HEADING_TEXT: "Question", // shown as "Question 3"
    LABEL_PREVIOUS: "Previous question",
    LABEL_NEXT: "Next question",
    TOP_THRESHOLD_PX: 8, // a question this close to the top of the screen counts as "here"
  });

  // ── Names ───────────────────────────────────────────────────────────────
  const LIST_ID = "chat-messages";
  const APP_ID = "chat-app";
  const PANEL_ID = "panel";
  const PREV_ID = "chat-turn-prev";
  const NEXT_ID = "chat-turn-next";
  const HEADING_CLASS = "chat-turn-heading";
  const BUTTON_CLASS = "chat-turn-nav-btn";
  const USER_BUBBLE_SELECTOR = ":scope > .local-chat-bubble-user";
  const DIRECTION = Object.freeze({ PREVIOUS: -1, NEXT: 1 });
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  let prevBtn = null;
  let nextBtn = null;
  let scrollFramePending = false;

  // ── Small readers ───────────────────────────────────────────────────────

  function getList() {
    const S = window.ChatState;
    return (S && S.els && S.els.messageList) || document.getElementById(LIST_ID);
  }

  // Same test as isChatOpen() in chat/chat-persistence.js (~:519): Chat is open while its
  // container is displayed and not aria-hidden.
  function isChatOpen() {
    const app = document.getElementById(APP_ID);
    return !!app && app.style.display !== "none" && app.getAttribute("aria-hidden") !== "true";
  }

  function countReplies() {
    const S = window.ChatState;
    if (!S || !Array.isArray(S.messages)) return 0;
    return S.messages.filter((m) => m && m.role === "assistant").length;
  }

  // ── Headings ────────────────────────────────────────────────────────────

  /**
   * Put "Question n" at the top of a question bubble. Called from renderUserContent after the
   * bubble's content is set, so it runs for live, restored, cancelled and committed questions.
   * n counts from the bubble's place in the list: when the bubble is not yet in the list (the
   * first render of a new question) it is one more than all the questions there; otherwise one
   * more than the questions before it. A cleared conversation therefore starts again at 1.
   * @param {HTMLElement} bubble the question bubble
   */
  function decorateQuestion(bubble) {
    if (!bubble) return;
    if (!TURN_NAV_CONFIG.ADD_HEADINGS) {
      // No headings: a move lands on the bubble itself, so it needs a programmatic focus stop. Set it
      // here, while the bubble is being built, so a move never writes an attribute into the live list.
      // Only when the buttons are on, so with both switches off Chat is exactly as it was.
      if (TURN_NAV_CONFIG.SHOW_BUTTONS) bubble.tabIndex = -1;
      return;
    }
    const list = getList();
    if (!list) return;

    const existing = bubble.querySelector(":scope > ." + HEADING_CLASS);
    if (existing) existing.remove();

    let number = 1;
    for (const q of list.querySelectorAll(USER_BUBBLE_SELECTOR)) {
      if (q === bubble) break;
      number += 1;
    }

    const heading = document.createElement("h" + TURN_NAV_CONFIG.HEADING_LEVEL);
    heading.className = HEADING_CLASS;
    heading.tabIndex = -1;
    heading.textContent = TURN_NAV_CONFIG.HEADING_TEXT + " " + number;
    bubble.insertBefore(heading, bubble.firstChild);
  }

  // ── Where a move can go ─────────────────────────────────────────────────

  // The things a move lands on: the question headings, or (headings switched off) the bubbles.
  function getTargets() {
    const list = getList();
    if (!list) return [];
    const selector = TURN_NAV_CONFIG.ADD_HEADINGS ? ":scope > .local-chat-bubble-user > ." + HEADING_CLASS : USER_BUBBLE_SELECTOR;
    return Array.from(list.querySelectorAll(selector));
  }

  function isOnScreen(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  /**
   * The target a move in this direction would land on, or null at either end.
   * When focus is already on a target that is still on screen (we have just moved there, and at
   * the end of the page it cannot reach the top) step from it. Otherwise: Next is the first target
   * below the top threshold, Previous the last one above it.
   */
  function pickTarget(direction) {
    const targets = getTargets();
    if (!targets.length) return null;
    const threshold = TURN_NAV_CONFIG.TOP_THRESHOLD_PX;

    const current = targets.indexOf(document.activeElement);
    if (current !== -1 && isOnScreen(targets[current])) {
      return targets[current + direction] || null;
    }
    if (direction === DIRECTION.NEXT) {
      return targets.find((el) => el.getBoundingClientRect().top > threshold) || null;
    }
    for (let i = targets.length - 1; i >= 0; i -= 1) {
      if (targets[i].getBoundingClientRect().top < -threshold) return targets[i];
    }
    return null;
  }

  function move(direction) {
    const target = pickTarget(direction);
    if (!target) return;
    const smooth = !window.matchMedia(REDUCED_MOTION_QUERY).matches;
    target.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "instant" });
    // The screen reader reads the focused target: nothing is announced and nothing is written
    // to the live message list.
    target.focus({ preventScroll: true });
    refresh();
  }

  // ── The buttons ─────────────────────────────────────────────────────────

  function buildButton(id, iconName, label, direction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = "panelButton " + BUTTON_CLASS;
    btn.hidden = true;
    btn.setAttribute("aria-disabled", "true");

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("data-icon", iconName);
    btn.appendChild(icon);

    const text = document.createElement("span");
    text.className = "panelLabel chat-turn-nav-label";
    text.textContent = label;
    btn.appendChild(text);

    btn.addEventListener("click", function () {
      if (btn.getAttribute("aria-disabled") === "true") return;
      move(direction);
    });
    return btn;
  }

  function ensureButtons() {
    if (prevBtn && prevBtn.isConnected) return true;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return false;

    prevBtn = buildButton(PREV_ID, "arrowUp", TURN_NAV_CONFIG.LABEL_PREVIOUS, DIRECTION.PREVIOUS);
    nextBtn = buildButton(NEXT_ID, "arrowDown", TURN_NAV_CONFIG.LABEL_NEXT, DIRECTION.NEXT);
    // Before Top, in reading order: Previous, Next, Top, Bottom.
    panel.insertBefore(nextBtn, panel.firstChild);
    panel.insertBefore(prevBtn, nextBtn);
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
      window.IconLibrary.populateIcons(prevBtn);
      window.IconLibrary.populateIcons(nextBtn);
    }
    logDebug("buttons added to the panel");
    return true;
  }

  function setDisabled(btn, disabled) {
    const value = disabled ? "true" : "false";
    if (btn.getAttribute("aria-disabled") !== value) btn.setAttribute("aria-disabled", value);
  }

  /**
   * Re-check whether the buttons show, and whether either end has been reached. Safe to call
   * at any time; called from updateConversationUI, on a mode change, on scroll and after a move.
   */
  function refresh() {
    if (!TURN_NAV_CONFIG.SHOW_BUTTONS) return;
    if (!ensureButtons()) return;

    const show = isChatOpen() && countReplies() >= TURN_NAV_CONFIG.MIN_REPLIES;
    if (prevBtn.hidden === show) {
      prevBtn.hidden = !show;
      nextBtn.hidden = !show;
    }
    if (!show) return;

    setDisabled(prevBtn, !pickTarget(DIRECTION.PREVIOUS));
    setDisabled(nextBtn, !pickTarget(DIRECTION.NEXT));
  }

  // One check per animation frame however many scroll events arrive.
  function onScrollOrResize() {
    if (scrollFramePending) return;
    scrollFramePending = true;
    window.requestAnimationFrame(function () {
      scrollFramePending = false;
      refresh();
    });
  }

  function init() {
    if (!TURN_NAV_CONFIG.SHOW_BUTTONS) return;
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    // Re-check on every mode switch: the tool switcher shows and hides Chat by its container's
    // display and aria-hidden, so watch those two attributes rather than hooking the switcher.
    const app = document.getElementById(APP_ID);
    if (app && typeof MutationObserver === "function") {
      new MutationObserver(refresh).observe(app, { attributes: true, attributeFilter: ["style", "aria-hidden"] });
    }
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ChatTurnNav = {
    decorateQuestion: decorateQuestion,
    refresh: refresh,
    config: TURN_NAV_CONFIG,
  };

  logInfo("loaded");
})();
