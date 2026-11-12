/**
 * TTS Controls Bar — RA-99: keeps Pause/Play, Stop and "Show Read Aloud panel"
 * in reach at the bottom of the screen while any surface is reading aloud.
 *
 * One player: the bar mirrors TTSController's events (tts:start / pause /
 * resume / end / error) and calls its public pause(), resume() and stop().
 * It keeps no second playback state of its own beyond the last event seen.
 *
 * Deliberately silent: no live region, no aria-live, no title, no announcement.
 * The surfaces' own buttons and the shared announcer already say what happened.
 * Before anything speaks, nothing from this file is in the DOM.
 *
 * Exposes: window.TTSControlsBar
 *
 * @author Matthew Deeprose
 */
var TTSControlsBar = (function () {
  'use strict';

  // ==========================================================================
  // LOGGING CONFIGURATION
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

  function logError(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ['[TTSControlsBar]', message].concat(args));
  }

  function logWarn(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ['[TTSControlsBar]', message].concat(args));
  }

  function logInfo(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ['[TTSControlsBar]', message].concat(args));
  }

  function logDebug(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ['[TTSControlsBar]', message].concat(args));
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const MODES = Object.freeze({ IDLE: 'idle', READING: 'reading', PAUSED: 'paused' });

  // The one engine whose speech can be paused. Neural engines stop on pause().
  const PAUSABLE_ENGINE = 'webspeech';

  const BAR_ID = 'tts-controls-bar';
  const ON_CLASS = 'tts-controls-bar-on';
  const HEIGHT_VAR = '--tts-controls-bar-height';
  const DOC_END_VAR = '--tts-controls-bar-doc-end';

  // Surfaces that publish their speaking state as data-tts-state on the starting
  // button (Convert, Chat bubbles, Local Chat bubbles).
  const STATE_ATTR_SELECTOR = '[data-tts-state="speaking"], [data-tts-state="paused"]';

  // Image Describer's button has no data-tts-state; its module exposes getState().
  const IMGDESC_BUTTON_ID = 'imgdesc-read-aloud';

  // Where focus goes when the bar leaves with focus in it and the starter cannot take it:
  // the speak buttons by id, then the selected mode radio (always present and focusable).
  const FOCUS_FALLBACK_IDS = ['convert-speak-btn', IMGDESC_BUTTON_ID];
  const FOCUS_LAST_RESORT_SELECTOR = 'input[name="presentation"]:checked';

  // ==========================================================================
  // STATE
  // ==========================================================================

  let mode = MODES.IDLE;
  let engine = PAUSABLE_ENGINE;
  let bar = null;
  let observer = null;
  let toggleBtn = null;
  let showBtn = null;
  let initialised = false;

  // The starting button, remembered while it can still be identified. By the time the
  // bar goes (tts:end) every surface has reset its button to idle, so findStarter()
  // can no longer tell which one it was. A reference only, never playback state.
  let starter = null;

  // ==========================================================================
  // STARTING BUTTON (for "Show Read Aloud panel" and focus return)
  // ==========================================================================

  /**
   * Find the button that started the current speech, from each surface's own
   * state. Resolved when needed, never cached, because a surface may update its
   * button after this file's listener has run.
   * @returns {HTMLElement|null}
   */
  function findStarter() {
    // Only a button that is on screen can be the starter. Image Describer's module
    // moves to "speaking" on ANY tts:start (the Voice Settings preview too), so its
    // state alone would point Show at a button in a hidden panel.
    const rendered = function (el) { return !!el && el.getClientRects().length > 0; };

    const byAttr = Array.prototype.find.call(document.querySelectorAll(STATE_ATTR_SELECTOR), rendered);
    if (byAttr) return byAttr;

    const imgdesc = document.getElementById(IMGDESC_BUTTON_ID);
    const reader = window.TTSReadAloud;
    if (rendered(imgdesc) && reader && typeof reader.getState === 'function') {
      const state = reader.getState();
      if (state === 'speaking' || state === 'paused') return imgdesc;
    }
    return null;
  }

  // ==========================================================================
  // BUILD / UPDATE / REMOVE
  // ==========================================================================

  function makeButton(className, iconName, text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tts-controls-bar-btn ' + className;

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('data-icon', iconName);
    btn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tts-controls-bar-btn-text';
    label.textContent = text;
    btn.appendChild(label);
    return btn;
  }

  function refreshIcons(scope) {
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === 'function') {
      window.IconLibrary.populateIcons(scope);
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function onShowClick() {
    const target = findStarter() || starter;
    if (!target) {
      logDebug('Show pressed but no starting button found');
      return;
    }
    try {
      target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } catch (e) {
      target.scrollIntoView();
    }
    // The scroll above already brings the button into view; do not let focus()
    // start a second, competing scroll.
    target.focus({ preventScroll: true });
  }

  /** Publish the bar's live height and where the page's scrollable end is. */
  function publishMetrics() {
    if (!bar) return;
    const root = document.documentElement;
    const height = Math.ceil(bar.getBoundingClientRect().height);
    // scrollHeight already includes the spacer once it exists, so take it off
    // before recording where the page's own content ends.
    const published = parseFloat(root.style.getPropertyValue(HEIGHT_VAR)) || 0;
    const spacer = root.classList.contains(ON_CLASS) ? published : 0;
    const docEnd = Math.max(0, root.scrollHeight - spacer);
    root.style.setProperty(DOC_END_VAR, docEnd + 'px');
    root.style.setProperty(HEIGHT_VAR, height + 'px');
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'tts-controls-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Read Aloud');

    // The visible word is for sighted readers; the group already has its name.
    const heading = document.createElement('span');
    heading.className = 'tts-controls-bar-label';
    heading.setAttribute('aria-hidden', 'true');
    heading.textContent = 'Read Aloud:';

    toggleBtn = makeButton('tts-controls-bar-toggle', 'pause', 'Pause');
    const stopBtn = makeButton('tts-controls-bar-stop', 'close', 'Stop');
    showBtn = makeButton('tts-controls-bar-show', 'chevronDown', 'Show Read Aloud panel');

    toggleBtn.addEventListener('click', function () {
      if (!window.TTSController) return;
      if (mode === MODES.PAUSED) window.TTSController.resume();
      else window.TTSController.pause();
    });
    stopBtn.addEventListener('click', function () {
      if (window.TTSController) window.TTSController.stop();
    });
    showBtn.addEventListener('click', onShowClick);

    bar.append(heading, toggleBtn, stopBtn, showBtn);
    document.body.appendChild(bar);
    refreshIcons(bar);

    // Measure the page's end BEFORE the spacer class exists, then switch it on.
    publishMetrics();
    document.documentElement.classList.add(ON_CLASS);
    document.body.classList.add(ON_CLASS);

    if (typeof window.ResizeObserver === 'function') {
      observer = new window.ResizeObserver(publishMetrics);
      observer.observe(bar);
    }
    logDebug('Bar built');
  }

  function removeBar() {
    if (!bar) return;
    // Focus in the bar would fall to <body> when it goes, and a screen reader reads the
    // document there before the button. Move focus to the starter FIRST, while the bar is
    // still in the page, so focus goes from the bar's button straight to the starter.
    const hadFocus = bar.contains(document.activeElement);
    if (hadFocus) returnFocus();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    bar.remove();
    bar = null;
    toggleBtn = null;
    showBtn = null;

    const root = document.documentElement;
    root.classList.remove(ON_CLASS);
    document.body.classList.remove(ON_CLASS);
    root.style.removeProperty(HEIGHT_VAR);
    root.style.removeProperty(DOC_END_VAR);

    starter = null;
    logDebug('Bar removed');
  }

  /** Send focus to the starting speak button, else a named fallback; never <body>. */
  function returnFocus() {
    const candidates = [starter, findStarter()];
    FOCUS_FALLBACK_IDS.forEach(function (id) { candidates.push(document.getElementById(id)); });
    candidates.push(document.querySelector(FOCUS_LAST_RESORT_SELECTOR));

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate || !document.contains(candidate) || candidate.disabled) continue;
      if (candidate.getClientRects().length === 0) continue;
      candidate.focus();
      // A refused focus() leaves activeElement elsewhere; try the next candidate.
      if (document.activeElement === candidate) return;
    }
    logWarn('No element could take focus after the bar was removed');
  }

  /**
   * Swap the toggle between Pause and Play, and hide the controls that cannot
   * apply: no Pause for a neural engine, no Show without a known starting button.
   */
  function render() {
    if (!bar) return;
    const paused = mode === MODES.PAUSED;
    const wantText = paused ? 'Play' : 'Pause';
    const label = toggleBtn.querySelector('.tts-controls-bar-btn-text');
    if (label.textContent !== wantText) {
      label.textContent = wantText;
      toggleBtn.querySelector('[data-icon]').setAttribute('data-icon', paused ? 'play' : 'pause');
      refreshIcons(toggleBtn);
    }

    // A neural engine cannot pause (pause() stops it), and cannot be paused when
    // it is already stopped, so Pause is absent for it. Play is never needed there.
    const pausable = engine === PAUSABLE_ENGINE;
    if (toggleBtn.hidden === pausable) toggleBtn.hidden = !pausable;

    const found = findStarter();
    if (found) starter = found;
    const hasStarter = !!found;
    if (showBtn.hidden === hasStarter) showBtn.hidden = !hasStarter;
  }

  /** Bring the DOM in step with `mode`. */
  function sync() {
    if (mode === MODES.IDLE) {
      removeBar();
      return;
    }
    if (!bar) buildBar();
    render();
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  function setMode(next, data) {
    mode = next;
    if (data && typeof data.engine === 'string') engine = data.engine;
    // Surfaces update their own buttons in listeners that may run after this one,
    // and findStarter() reads those buttons, so act once all of them have run.
    queueMicrotask(sync);
  }

  function wireEvents() {
    const emitter = window.EmbedEventEmitter;
    if (!emitter || typeof emitter.on !== 'function') {
      logWarn('EmbedEventEmitter not available — controls bar will not appear');
      return;
    }
    emitter.on('tts:start', function (data) { setMode(MODES.READING, data); });
    emitter.on('tts:resume', function (data) { setMode(MODES.READING, data); });
    emitter.on('tts:pause', function (data) { setMode(MODES.PAUSED, data); });
    emitter.on('tts:end', function () { setMode(MODES.IDLE); });
    emitter.on('tts:error', function () { setMode(MODES.IDLE); });
  }

  function init() {
    if (initialised) return;
    initialised = true;
    wireEvents();
    logInfo('Initialised');
  }

  init();

  return {
    /** Current mode mirrored from the last TTS event: 'idle' | 'reading' | 'paused'. */
    getMode: function () {
      return mode;
    },
    /** True while the bar is in the document. */
    isShown: function () {
      return !!bar;
    }
  };
})();

window.TTSControlsBar = TTSControlsBar;
