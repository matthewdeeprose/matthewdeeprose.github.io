/**
 * Mermaid View Controls
 * Adds width toggle and fullscreen capabilities to mermaid diagrams
 */
console.log("[Mermaid View Controls] Script loaded and initializing");

const MermaidViewControls = (function () {
  // Configuration
  const config = {
    expandText: "Expand Width",
    collapseText: "Collapse Width",
    fullscreenText: "Enter full screen",
    exitFullscreenText: "Exit full screen",
    expandedClass: "expanded",
    fullscreenClass: "fullscreen-mode",
    viewControlsClass: "mermaid-view-controls",
    buttonClass: "mermaid-view-button",
    ariaLiveRegionId: "mermaid-view-announcer",
  };

  // State management
  const state = {
    fullscreenEnabled: false,
    activeFullscreenContainer: null,
    // Set when exitFullscreen asks the browser to leave native full screen:
    // the browser's own change event arrives later, finds no active
    // container, and uses this to speak and to restore focus
    nativeExitContainer: null,
  };

  // DOM element references
  let elements = {
    announcer: null,
  };

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // ============================================================================
  // ATTACH / DETACH — the per-figure runtime (parcel 3+4)
  // ============================================================================

  // One record per attached root — its two buttons and their click handlers —
  // keyed on the NODE. A class cannot decide this: .view-controls-added
  // serialises with the markup, so the bridge's live copy of a container
  // carried the marker from the scratch container it was bound in, and was
  // skipped (parcel 3+4 grounding, 25 September 2026).
  const records = new WeakMap();

  // Roots attached and not yet detached. The first attach installs the global
  // listeners and the last detach removes them. A root removed from the DOM
  // without detach — every page re-render does this — stays counted, which
  // only means the global listeners stay installed. No sweeper, on purpose.
  let attachedCount = 0;
  let globalListenersInstalled = false;

  // Counter for container ids minted when the figure carries none
  let containerIdCounter = 0;

  const FULLSCREEN_CHANGE_EVENTS = Object.freeze([
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange",
  ]);

  const MERMAID_CONTAINER_CLASS = "mermaid-container";

  // Full-screen timings, in ms (F11). The fits chase the browser's full-screen
  // transition; the retries run relative to the first fit, not to entry.
  const FULLSCREEN_DELAYS_MS = Object.freeze({
    nativeFirstFit: 100, // native entry: first fit after activation
    nativeFitRetries: Object.freeze([300, 600]), // then two more
    cssFit: 300, // CSS entry: one fit after activation
    changeActivate: 50, // fullscreenchange: activate pan/zoom after the DOM settles
    changeFirstFit: 100, // then fit
    changeFitRetry: 200, // and fit again
  });

  // Full-screen focus and speech (register item 160, slice 2b, 11 November
  // 2026). One polite region INSIDE the container says when full screen is on
  // and off, so native full screen (where everything outside the container is
  // not exposed) speaks it too. It is built when the controls attach, long
  // before it is written, because a region made just before its text is not
  // registered in time. A write waits for the view and the focus to settle and
  // is dropped if a later write has overtaken it.
  const FULLSCREEN_STATUS_CLASS = "mermaid-fullscreen-status";
  // CSS full screen has no browser alert, so its line says how to leave; native
  // full screen already gets "To exit full screen, press Esc" from the browser.
  const FULLSCREEN_STATUS_ON_TEXT = "Full screen on. Press Escape to leave.";
  const FULLSCREEN_STATUS_ON_NATIVE_TEXT = "Full screen on.";
  const FULLSCREEN_BUTTON_ENTER_TEXT = "Enter full screen";
  const FULLSCREEN_BUTTON_EXIT_TEXT = "Exit full screen";
  const FULLSCREEN_STATUS_OFF_TEXT = "Full screen off.";
  const FULLSCREEN_STATUS_DELAY_MS = 250;
  const FULLSCREEN_STATUS_CLEAR_MS = 5000;
  const FOCUS_RESTORE_RETRY_MS = 100;
  const INERT_ATTRIBUTE = "inert";
  const TAB_STOP_SELECTOR =
    "button, a[href], input, select, textarea, summary, [tabindex]";
  const INERT_SKIPPED_TAGS = Object.freeze([
    "SCRIPT",
    "STYLE",
    "LINK",
    "TEMPLATE",
    "NOSCRIPT",
  ]);

  // The control that opened full screen, per container, so every exit route
  // puts focus back on it; and the siblings made inert for CSS full screen,
  // per container, so exit removes exactly those and no other inert attribute.
  const fullscreenOpeners = new WeakMap();
  const inertSweeps = new WeakMap();
  let statusSequence = 0;

  // Kept although nothing in this file decides anything on it:
  // chart-view-controls.js:161 reads it document-wide in its own
  // setupGlobalEventListeners, and mermaid-accessibility-core.js removes it on
  // its retry path.
  const LEGACY_ATTACHED_CLASS = "view-controls-added";

  // F22 (parcel 9d): a diagram drawn at its 10 px text floor can be wider than
  // its .mermaid box, which then scrolls sideways (mermaid-controls.css).
  // While it scrolls the box is a named, focusable group, so a keyboard can
  // reach it and scroll it with the arrow keys; the three attributes go when
  // it stops. Nothing announces. In full screen the box does not scroll — pan
  // and zoom reach the whole diagram — so it is never a stop there.
  const SCROLL_BOX_LABEL = "Diagram, scrolls sideways";
  const SCROLL_BOX_ROLE = "group";
  const SCROLL_OVERFLOW_TOLERANCE_PX = 1;

  // Parcel 9e, Matthew's two rulings of 28 September 2026 (item 94). (A) On
  // focus a stop should say only the diagram's short description: once the
  // description engine has cached it on the container
  // (data-svg-accessible-name), the stop is an image named with it and its
  // SVG leaves the accessibility tree; until then it keeps the group and
  // label above. (B) A visible note, hidden from screen readers — inside the
  // stop's box, after the SVG, since parcel 9e-2 (Matthew, 29 September).
  // mermaid-export-utils.js carries the same words for the export.
  //
  // The engine names a container only once it has been scrolled into view,
  // usually long after the box became a stop, and nothing tells this module
  // when it does. So while a stop is unnamed it is re-checked every
  // SCROLL_NAME_RETRY_MS, and again whenever focus enters the container.
  const SCROLL_BOX_NAMED_ROLE = "img";
  const SCROLL_NOTE_CLASS = "mermaid-scroll-note";
  const SCROLL_NOTE_TEXT = "Scroll sideways to see the whole diagram.";
  const SCROLL_NAME_RETRY_MS = 500;
  const ACCESSIBILITY_FAILED_STATE = "error";
  // The diagram SVG in a .mermaid box: its direct child, or inside pan/zoom's
  // wrapper while in full screen (mermaid-pan-zoom.js panZoomContainerClass).
  const DIAGRAM_SVG_IN_BOX =
    ":scope > svg, :scope > .mermaid-pan-zoom-container > svg";

  /**
   * Work out whether native full screen is supported and make sure the
   * announcer exists. Idempotent; run by init and by every attach.
   */
  function prepareModule() {
    state.fullscreenEnabled =
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled;

    createScreenReaderAnnouncer();
  }

  /**
   * Install the document-level full-screen change and Escape handlers, once
   */
  function installGlobalListeners() {
    if (globalListenersInstalled) return;

    FULLSCREEN_CHANGE_EVENTS.forEach((type) => {
      document.addEventListener(type, handleFullscreenChange);
    });
    document.addEventListener("keydown", handleEscapeKey);
    document.addEventListener("keydown", handleFullscreenTab);

    globalListenersInstalled = true;
    logDebug("[Mermaid View Controls] Global event listeners installed");
  }

  /**
   * Remove the document-level handlers installGlobalListeners added
   */
  function removeGlobalListeners() {
    if (!globalListenersInstalled) return;

    FULLSCREEN_CHANGE_EVENTS.forEach((type) => {
      document.removeEventListener(type, handleFullscreenChange);
    });
    document.removeEventListener("keydown", handleEscapeKey);
    document.removeEventListener("keydown", handleFullscreenTab);

    globalListenersInstalled = false;
    logDebug("[Mermaid View Controls] Global event listeners removed");
  }

  /**
   * An id for a container that has none: derived from the figure (the inner
   * .mermaid div's id) when there is one, else a module counter — never a
   * timestamp. Skips any id already in the document.
   * @param {HTMLElement} root - The mermaid container
   * @returns {string} A fresh id
   */
  function mintContainerId(root) {
    const figure = root.querySelector(".mermaid[id]");
    const fromFigure = figure ? `mermaid-container-${figure.id}` : null;
    if (fromFigure && !document.getElementById(fromFigure)) return fromFigure;

    let candidate;
    do {
      containerIdCounter++;
      candidate = `mermaid-container-${containerIdCounter}`;
    } while (document.getElementById(candidate));
    return candidate;
  }

  /**
   * Remove one record's two click handlers from its buttons
   * @param {Object} record - The root's record
   */
  function unbindRecord(record) {
    record.widthButton.removeEventListener("click", record.onWidth);
    record.fullscreenButton.removeEventListener("click", record.onFullscreen);
    if (record.scrollObserver) record.scrollObserver.disconnect();
  }

  /**
   * Set an attribute, or remove it when the value is null — only when that
   * changes something, so an observer that calls this cannot feed itself.
   * @param {Element} element - The element to write
   * @param {string} name - The attribute
   * @param {string|null} value - The value, or null for absent
   */
  function writeAttribute(element, name, value) {
    if (value === null) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  /**
   * Show the scroll note inside the box, as its last child after the SVG, or
   * hide it (parcel 9e-2: inside, so the box's own ground and side borders
   * contain it; mermaid-controls.css keeps it at the box's left edge while
   * the box scrolls). Built the first time it is needed and kept, hidden,
   * after that. Every render replaces the box's content and takes the note
   * with it; the box's height then changes, the root's ResizeObserver runs
   * and this builds it again. A note left directly in the root (parcel 9e's
   * place) is taken back into the box.
   * @param {HTMLElement} root - The mermaid container
   * @param {HTMLElement} box - The root's .mermaid
   * @param {boolean} show - Whether the box is a stop
   */
  function showScrollNote(root, box, show) {
    let note =
      box.querySelector(`:scope > .${SCROLL_NOTE_CLASS}`) ||
      root.querySelector(`:scope > .${SCROLL_NOTE_CLASS}`);
    if (!note) {
      if (!show) return;
      note = document.createElement("p");
      note.className = SCROLL_NOTE_CLASS;
      note.setAttribute("aria-hidden", "true");
      note.textContent = SCROLL_NOTE_TEXT;
    }
    if (box.lastElementChild !== note) box.append(note);
    if (note.hidden === show) note.hidden = !show;
  }

  // Item 168, fix 1 (12 November 2026): containers already warned about a
  // missing pointer element, so the warning is logged once per container.
  const pointerWarned = new WeakSet();

  /**
   * The id of the container's pointer element (the one sentence about the full
   * description that the SVG's own aria-describedby names), or null when the
   * id is absent or resolves to nothing. Logs WARN once per container.
   * @param {HTMLElement} root - The mermaid container
   * @returns {string|null} The pointer id, or null
   */
  function resolvePointerId(root) {
    const pointerId = root.dataset.pointerId;
    if (pointerId && document.getElementById(pointerId)) return pointerId;
    if (!pointerWarned.has(root)) {
      pointerWarned.add(root);
      logWarn(
        "[Mermaid View Controls] No pointer element for the named scroll box",
        root.id
      );
    }
    return null;
  }

  /**
   * Make the root's diagram box a focusable stop while it overflows sideways,
   * and a plain box when it does not. A stop is named with the diagram's
   * short description, its SVG hidden, once the description engine has
   * cached one; otherwise it is the named group. Writes only on a change.
   * Every render replaces the SVG, so the current one is found each time.
   * @param {HTMLElement} root - The mermaid container
   * @returns {boolean} True while the box is a stop still waiting for a name
   */
  function updateScrollBox(root) {
    const box = root.querySelector(":scope > .mermaid");
    if (!box) return false;

    const scrolls =
      !root.classList.contains(config.fullscreenClass) &&
      box.scrollWidth > box.clientWidth + SCROLL_OVERFLOW_TOLERANCE_PX;
    const cachedName = root.dataset.svgAccessibleName || "";

    // Item 168, fix 1 (12 November 2026): a diagram whose SVG holds anything
    // focusable keeps its structure (DI4), so the box is never the named image
    // and the SVG is never hidden. The test is the one applyDiagramAccessibleWiring
    // uses, read from window.MermaidControls at call time.
    const svgs = Array.from(box.querySelectorAll(DIAGRAM_SVG_IN_BOX));
    const controls = window.MermaidControls;
    const focusableSelector =
      controls && typeof controls.svgFocusableSelector === "string"
        ? controls.svgFocusableSelector
        : "";
    const hasFocusable =
      focusableSelector !== "" &&
      svgs.some((svg) => svg.querySelector(focusableSelector));
    const named = scrolls && !hasFocusable && cachedName.trim() !== "";

    let role = null;
    let label = null;
    if (scrolls) {
      role = named ? SCROLL_BOX_NAMED_ROLE : SCROLL_BOX_ROLE;
      label = named ? cachedName : SCROLL_BOX_LABEL;
    }
    writeAttribute(box, "tabindex", scrolls ? "0" : null);
    writeAttribute(box, "role", role);
    writeAttribute(box, "aria-label", label);
    writeAttribute(box, "aria-describedby", named ? resolvePointerId(root) : null);

    // In full screen pan/zoom wraps the SVG, and the box is no stop there, so
    // the wrapped SVG must be found too or it would stay hidden, unnamed.
    svgs.forEach((svg) => writeAttribute(svg, "aria-hidden", named ? "true" : null));

    showScrollNote(root, box, scrolls);

    return (
      scrolls &&
      !named &&
      !hasFocusable &&
      root.getAttribute("data-accessibility-initialized") !==
        ACCESSIBILITY_FAILED_STATE
    );
  }

  /**
   * Watch one root for its diagram box starting or stopping to scroll. The
   * root resizes on Expand Width, full screen and the window; the diagram
   * resizes when its size is applied. Every render replaces the SVG, so the
   * current one is re-found on each callback. While the box is a stop with no
   * name yet, it is re-checked on a timer and on focus (parcel 9e).
   * @param {HTMLElement} root - The mermaid container
   * @returns {{disconnect: Function}|null} Disconnected by unbindRecord
   */
  function watchScrollBox(root) {
    if (typeof ResizeObserver !== "function") return null;

    let watchedSvg = null;
    let nameTimer = null;
    const reconcile = () => {
      if (nameTimer !== null) {
        clearTimeout(nameTimer);
        nameTimer = null;
      }
      if (updateScrollBox(root)) {
        nameTimer = setTimeout(reconcile, SCROLL_NAME_RETRY_MS);
      }
    };
    // The callback's own writes (the scroll note, tabindex, role) can resize
    // the root, so they run a frame later, outside the observer's delivery.
    // Run inside it, they made the browser report "ResizeObserver loop
    // completed with undelivered notifications" on every gantt exit.
    let frame = null;
    const onResize = () => {
      frame = null;
      reconcile();
      const svg = root.querySelector(":scope > .mermaid > svg");
      if (svg && svg !== watchedSvg) {
        if (watchedSvg) observer.unobserve(watchedSvg);
        observer.observe(svg);
        watchedSvg = svg;
      }
    };
    const observer = new ResizeObserver(() => {
      if (frame === null) frame = requestAnimationFrame(onResize);
    });
    observer.observe(root);
    root.addEventListener("focusin", reconcile);

    return {
      disconnect() {
        observer.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        root.removeEventListener("focusin", reconcile);
        if (nameTimer !== null) clearTimeout(nameTimer);
        nameTimer = null;
      },
    };
  }

  /**
   * Find the root's existing view toolbar and its two buttons, if complete
   * @param {HTMLElement} root - The mermaid container
   * @returns {Object|null} The toolbar and buttons, or null
   */
  function findExistingToolbar(root) {
    const toolbar = root.querySelector(`.${config.viewControlsClass}`);
    if (!toolbar) return null;

    const widthButton = toolbar.querySelector('button[id^="toggle-width-"]');
    const fullscreenButton = toolbar.querySelector(
      'button[id^="toggle-fullscreen-"]'
    );
    if (!widthButton || !fullscreenButton) {
      logWarn(
        "[Mermaid View Controls] Incomplete view toolbar found; replacing it",
        root.id
      );
      toolbar.remove();
      return null;
    }
    return { toolbar, widthButton, fullscreenButton };
  }

  /**
   * Build the view toolbar and insert it as the root's first child
   * @param {HTMLElement} root - The mermaid container
   * @returns {Object} The two new buttons
   */
  function buildToolbar(root) {
    const viewControls = document.createElement("div");
    viewControls.className = config.viewControlsClass;
    viewControls.setAttribute("role", "toolbar");
    viewControls.setAttribute("aria-label", "Diagram view controls");

    // Create expand/collapse button
    const widthButton = createButton(
      getExpandIcon(),
      config.expandText,
      `toggle-width-${root.id}`
    );

    // Create fullscreen button
    const fullscreenButton = createButton(
      getFullscreenIcon(),
      config.fullscreenText,
      `toggle-fullscreen-${root.id}`
    );

    viewControls.appendChild(widthButton);
    viewControls.appendChild(fullscreenButton);

    // Insert view controls at the beginning of the container
    if (root.firstChild) {
      root.insertBefore(viewControls, root.firstChild);
    } else {
      root.appendChild(viewControls);
    }

    return { widthButton, fullscreenButton };
  }

  /**
   * Attach the view controls to one diagram container. Idempotent, keyed on
   * the node: a second call is a no-op while the buttons it bound are still in
   * the root. A toolbar already in the root (the bridge's markup copy) is
   * ADOPTED — its buttons are bound — rather than built beside.
   * @param {HTMLElement} root - One .mermaid-container
   */
  function attach(root) {
    if (
      !root ||
      !root.classList ||
      !root.classList.contains(MERMAID_CONTAINER_CLASS)
    ) {
      logWarn("[Mermaid View Controls] attach needs a .mermaid-container");
      return;
    }

    prepareModule();
    ensureFullscreenStatus(root);

    const existing = records.get(root);
    if (existing) {
      if (
        root.contains(existing.widthButton) &&
        root.contains(existing.fullscreenButton)
      ) {
        return;
      }
      // The toolbar this record bound has left the root (the accessibility
      // core's retry path removes it): release the record and attach afresh.
      unbindRecord(existing);
      records.delete(root);
      attachedCount--;
    }

    if (!root.id) {
      root.id = mintContainerId(root);
      logDebug(`[Mermaid View Controls] Added ID to container: ${root.id}`);
    }

    const found = findExistingToolbar(root);
    const buttons = found || buildToolbar(root);

    // An adopted toolbar's button ids must name this root: the exit paths
    // find the full-screen button by `toggle-fullscreen-${container.id}`.
    buttons.widthButton.id = `toggle-width-${root.id}`;
    buttons.fullscreenButton.id = `toggle-fullscreen-${root.id}`;

    const record = {
      widthButton: buttons.widthButton,
      fullscreenButton: buttons.fullscreenButton,
      onWidth: () => toggleWidth(root, buttons.widthButton),
      onFullscreen: () => toggleFullscreen(root, buttons.fullscreenButton),
    };
    record.widthButton.addEventListener("click", record.onWidth);
    record.fullscreenButton.addEventListener("click", record.onFullscreen);
    record.scrollObserver = watchScrollBox(root);
    records.set(root, record);

    root.classList.add(LEGACY_ATTACHED_CLASS);
    attachedCount++;
    installGlobalListeners();

    logDebug(
      `[Mermaid View Controls] Attached to ${root.id} (${
        found ? "adopted toolbar" : "built toolbar"
      })`
    );
  }

  /**
   * Detach the view controls from one container: remove its two button
   * listeners and its record, and the global listeners with the last root.
   * The markup stays.
   * @param {HTMLElement} root - One .mermaid-container
   */
  function detach(root) {
    const record = root ? records.get(root) : null;
    if (!record) return;

    unbindRecord(record);
    records.delete(root);
    attachedCount--;
    if (attachedCount <= 0) {
      attachedCount = 0;
      removeGlobalListeners();
    }

    logDebug(`[Mermaid View Controls] Detached from ${root.id}`);
  }

  /**
   * Check if MermaidPanZoom is loaded and available
   * @returns {boolean} Whether MermaidPanZoom is available
   */
  function isPanZoomAvailable() {
    const available =
      typeof window.MermaidPanZoom !== "undefined" &&
      window.MermaidPanZoom !== null &&
      typeof window.MermaidPanZoom.activateForContainer === "function";

    console.log(
      `[Mermaid View Controls] MermaidPanZoom availability check: ${available}`
    );
    return available;
  }

  /**
   * Try to load MermaidPanZoom if not already available
   * @returns {Promise} Promise that resolves when MermaidPanZoom is available
   */
  function ensurePanZoomAvailable() {
    return new Promise((resolve, reject) => {
      // If already available, resolve immediately
      if (isPanZoomAvailable()) {
        console.log("[Mermaid View Controls] MermaidPanZoom already available");
        resolve(window.MermaidPanZoom);
        return;
      }

      console.log(
        "[Mermaid View Controls] MermaidPanZoom not available, checking for script..."
      );

      // Listen for the custom event
      const eventListener = (e) => {
        console.log(
          "[Mermaid View Controls] Received mermaid-pan-zoom-loaded event"
        );
        document.removeEventListener("mermaid-pan-zoom-loaded", eventListener);
        resolve(e.detail);
      };

      document.addEventListener("mermaid-pan-zoom-loaded", eventListener);

      // Also use a timeout with regular checks as fallback
      console.log(
        "[Mermaid View Controls] Starting fallback polling for MermaidPanZoom"
      );
      let attempts = 0;
      const maxAttempts = 20; // Increase to 20 attempts
      const checkInterval = setInterval(() => {
        attempts++;

        if (isPanZoomAvailable()) {
          clearInterval(checkInterval);
          document.removeEventListener(
            "mermaid-pan-zoom-loaded",
            eventListener
          );
          console.log(
            "[Mermaid View Controls] MermaidPanZoom is now available (via polling)"
          );
          resolve(window.MermaidPanZoom);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          document.removeEventListener(
            "mermaid-pan-zoom-loaded",
            eventListener
          );
          console.warn(
            "[Mermaid View Controls] MermaidPanZoom failed to load after multiple attempts"
          );

          // Create a minimal implementation to avoid errors
          console.log(
            "[Mermaid View Controls] Creating fallback implementation"
          );
          window.MermaidPanZoom = {
            activateForContainer: (container) => {
              console.log(
                "[Fallback MermaidPanZoom] Activation requested but not implemented"
              );
            },
            deactivateForContainer: (container) => {
              console.log(
                "[Fallback MermaidPanZoom] Deactivation requested but not implemented"
              );
            },
            fitDiagramToScreen: (containerId) => {
              console.log(
                "[Fallback MermaidPanZoom] Fit to screen requested but not implemented"
              );
              return null;
            },
          };

          resolve(window.MermaidPanZoom);
        }
      }, 250); // Check every 250ms
    });
  }

  /**
   * Attach the view controls to `root` itself if it is a .mermaid-container,
   * then to every .mermaid-container inside it. Kept on the API as a wrapper
   * round attach: the accessibility core's retry path calls
   * MermaidViewControls.init(container) with the container it means.
   * @param {HTMLElement|Document} root - Where to look (defaults to document)
   */
  function init(root = document) {
    if (!root) {
      console.warn("[Mermaid View Controls] No container provided");
      return;
    }

    prepareModule();

    if (root.classList && root.classList.contains(MERMAID_CONTAINER_CLASS)) {
      attach(root);
    }

    if (typeof root.querySelectorAll !== "function") return;
    root
      .querySelectorAll(`.${MERMAID_CONTAINER_CLASS}`)
      .forEach((container) => attach(container));
  }

  /**
   * Create screen reader announcer element
   */
  function createScreenReaderAnnouncer() {
    if (document.getElementById(config.ariaLiveRegionId)) {
      elements.announcer = document.getElementById(config.ariaLiveRegionId);
      return;
    }

    elements.announcer = document.createElement("div");
    elements.announcer.id = config.ariaLiveRegionId;
    elements.announcer.className = "sr-only";
    elements.announcer.setAttribute("aria-live", "polite");
    elements.announcer.setAttribute("aria-atomic", "true");
    document.body.appendChild(elements.announcer);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    if (!elements.announcer) {
      console.warn(
        "[Mermaid View Controls] Screen reader announcer not initialized"
      );
      return;
    }

    console.log(`[Mermaid View Controls] Announcing: ${message}`);

    // Set the message to be announced
    elements.announcer.textContent = message;

    // After a delay, clear the announcer
    setTimeout(() => {
      elements.announcer.textContent = "";
    }, 3000);
  }

  /**
   * Create a button element
   * @param {string} icon - HTML for the button icon
   * @param {string} text - Button text
   * @param {string} id - Button ID
   * @param {string} [ariaLabel] - Accessibility label; omit it when the visible text is the name (SC 2.5.3)
   * @returns {HTMLElement} The created button
   */
  function createButton(icon, text, id, ariaLabel) {
    const button = document.createElement("button");
    button.id = id;
    button.className = config.buttonClass;
    button.innerHTML = `${icon} <span class="button-text">${text}</span>`;
    if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("type", "button");
    return button;
  }

  /**
   * Toggle width of a mermaid container
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The toggle button
   */
  function toggleWidth(container, button) {
    const isExpanded = container.classList.toggle(config.expandedClass);

    // Update button text and icon
    if (isExpanded) {
      button.innerHTML = `${getCollapseIcon()} <span class="button-text">${
        config.collapseText
      }</span>`;
      announceToScreenReader("Diagram expanded to full width");
    } else {
      button.innerHTML = `${getExpandIcon()} <span class="button-text">${
        config.expandText
      }</span>`;
      announceToScreenReader("Diagram width collapsed");
    }

    // Trigger resize event to help diagrams adjust
    window.dispatchEvent(new Event("resize"));
  }

  /**
   * The full-screen status region inside a container: found, or built once.
   * Built at attach so it exists long before it is written.
   * @param {HTMLElement} container - The mermaid container
   * @returns {HTMLElement|null} The region, or null for a non-container
   */
  function ensureFullscreenStatus(container) {
    if (!container || !container.classList) return null;
    if (!container.classList.contains(MERMAID_CONTAINER_CLASS)) return null;

    let region = container.querySelector(`:scope > .${FULLSCREEN_STATUS_CLASS}`);
    if (region) return region;

    region = document.createElement("div");
    region.className = `${FULLSCREEN_STATUS_CLASS} sr-only`;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    container.appendChild(region);
    return region;
  }

  /**
   * Say a line in the container's own region, once. A later call, for either
   * line, overtakes one still waiting, so the two lines can never both speak
   * for one event.
   * @param {HTMLElement} container - The mermaid container
   * @param {string} text - The line
   */
  function announceInView(container, text) {
    const region = ensureFullscreenStatus(container);
    if (!region) return;

    statusSequence++;
    const sequence = statusSequence;
    region.textContent = "";

    setTimeout(() => {
      if (sequence !== statusSequence) return;
      region.textContent = text;

      setTimeout(() => {
        if (sequence === statusSequence) region.textContent = "";
      }, FULLSCREEN_STATUS_CLEAR_MS);
    }, FULLSCREEN_STATUS_DELAY_MS);
  }

  /**
   * Make everything outside the container inert, for CSS full screen: the
   * siblings of the container and of each ancestor up to the body, never the
   * container's own path. Records exactly what it set, so exit removes only
   * those. A node that was already inert is left alone and not recorded.
   * @param {HTMLElement} container - The mermaid container
   */
  function makeOutsideInert(container) {
    removeOutsideInert(container);
    const added = [];
    let node = container;

    while (node !== document.body && node.parentElement) {
      const parent = node.parentElement;
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === node) return;
        if (INERT_SKIPPED_TAGS.includes(sibling.tagName)) return;
        if (sibling.hasAttribute(INERT_ATTRIBUTE)) return;
        sibling.setAttribute(INERT_ATTRIBUTE, "");
        added.push(sibling);
      });
      node = parent;
    }

    inertSweeps.set(container, added);
  }

  /**
   * Remove exactly the inert attributes makeOutsideInert set
   * @param {HTMLElement|null} container - The mermaid container
   */
  function removeOutsideInert(container) {
    if (!container) return;
    const added = inertSweeps.get(container);
    if (!added) return;

    added.forEach((element) => element.removeAttribute(INERT_ATTRIBUTE));
    inertSweeps.delete(container);
  }

  /**
   * The elements Tab can stop on inside a container: visible, enabled, not
   * taken out of the order, not inert
   * @param {HTMLElement} container - The mermaid container
   * @returns {HTMLElement[]} The stops, in document order
   */
  function fullscreenTabStops(container) {
    return Array.from(container.querySelectorAll(TAB_STOP_SELECTOR)).filter(
      (element) => {
        if (element.disabled) return false;
        if (element.getAttribute("tabindex") === "-1") return false;
        if (element.closest("[inert]")) return false;
        return element.checkVisibility
          ? element.checkVisibility({ visibilityProperty: true })
          : element.getClientRects().length > 0;
      }
    );
  }

  /**
   * Keep Tab and Shift+Tab inside the full-screen view, in both modes: past
   * the last stop it goes to the first, before the first it goes to the last,
   * and from anywhere outside it goes in. Acts only while a container is in
   * full screen, and leaves chords with Ctrl, Alt or Meta alone.
   * @param {KeyboardEvent} event - The keyboard event
   */
  function handleFullscreenTab(event) {
    if (event.key !== "Tab") return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const container = state.activeFullscreenContainer;
    if (!container || !container.classList.contains(config.fullscreenClass)) {
      return;
    }

    const stops = fullscreenTabStops(container);
    if (stops.length === 0) {
      event.preventDefault();
      return;
    }

    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    const onStop = stops.includes(active);

    if (!onStop) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Remember the control that opened full screen, for every exit route
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement|undefined} button - The toggle button, when given
   */
  function rememberOpener(container, button) {
    const opener =
      button ||
      (container.contains(document.activeElement)
        ? document.activeElement
        : null) ||
      document.getElementById(`toggle-fullscreen-${container.id}`);
    if (opener) fullscreenOpeners.set(container, opener);
  }

  /**
   * Toggle fullscreen mode for a mermaid container
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function toggleFullscreen(container, button) {
    console.log("[Mermaid View Controls] Toggle fullscreen clicked");

    // Check if this container is already in fullscreen
    const isFullscreen =
      document.fullscreenElement === container ||
      container.classList.contains(config.fullscreenClass);

    if (isFullscreen) {
      exitFullscreen(container);
      return;
    }

    // After a site light/dark flip a diagram may still be waiting for its
    // repaint. Full screen shows the live SVG, so wait for the gate first. A
    // current diagram goes straight in, synchronously, so the click's user
    // gesture (which native full screen needs) is not spent on a wait.
    const themes = window.MermaidThemes;
    const needsGate =
      themes &&
      typeof themes.isThemeCurrent === "function" &&
      typeof themes.ensureThemeCurrent === "function" &&
      !themes.isThemeCurrent(container);

    if (!needsGate) {
      enterFullscreen(container, button);
      return;
    }

    themes.ensureThemeCurrent(container).then(() => {
      const alreadyIn =
        document.fullscreenElement === container ||
        container.classList.contains(config.fullscreenClass);
      if (container.isConnected && !alreadyIn) {
        enterFullscreen(container, button);
      }
    });
  }

  /**
   * Enter fullscreen mode
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  /**
   * Enter fullscreen mode
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enterFullscreen(container, button) {
    console.log("[Mermaid View Controls] Entering fullscreen mode");
    console.log("[Mermaid View Controls] Container ID:", container.id);

    // Remember the control that opened full screen: focus stays on it on
    // entry and every exit route puts it back there
    rememberOpener(container, button);

    // Check the configuration setting to determine which fullscreen mode to use
    const fullscreenMode =
      window.MermaidPanZoom && window.MermaidPanZoom.config
        ? window.MermaidPanZoom.config.fullscreenMode
        : "auto";

    // Decide based on the configuration
    if (fullscreenMode === "css") {
      console.log(
        "[Mermaid View Controls] Using CSS-based fullscreen (forced by configuration)"
      );
      enableCssFullscreen(container, button);
      return;
    } else if (fullscreenMode === "native" && state.fullscreenEnabled) {
      console.log(
        "[Mermaid View Controls] Using native fullscreen (forced by configuration)"
      );
      // No request method at all: fall back to CSS. A throw is NOT caught
      // here, exactly as before — only the auto branch below catches.
      if (!enterNativeFullscreen(container)) {
        console.log(
          "[Mermaid View Controls] Native fullscreen API failed, falling back to CSS fullscreen"
        );
        enableCssFullscreen(container, button);
      }
      return;
    }

    // Auto mode (default behavior)
    // Try native fullscreen API first if supported
    if (state.fullscreenEnabled && !isMobileDevice()) {
      console.log("[Mermaid View Controls] Using native fullscreen API");

      try {
        if (!enterNativeFullscreen(container)) {
          // If none of the vendor methods exists, fall back to CSS
          throw new Error("No requestFullscreen method available");
        }
      } catch (err) {
        console.warn("[Mermaid View Controls] Fullscreen API error:", err);
        enableCssFullscreen(container, button);
      }
    } else {
      // Use CSS-based fullscreen for mobile or if API not available
      console.log("[Mermaid View Controls] Using CSS-based fullscreen");
      enableCssFullscreen(container, button);
    }
  }

  /**
   * Ask the browser for native full screen on the container, through
   * whichever vendor method exists
   * @param {HTMLElement} container - The mermaid container
   * @returns {boolean} False when no request method exists at all
   */
  function requestNativeFullscreen(container) {
    // Different vendor prefixes
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    } else {
      return false;
    }
    return true;
  }

  /**
   * Enter native full screen — the one path for both the forced-native and
   * the auto branch of enterFullscreen (F11). Hides the width toggle and the
   * diagram toolbar, marks the container, requests full screen, then updates
   * the button, activates pan/zoom with fits at FULLSCREEN_DELAYS_MS, and
   * announces. When no request method exists it returns false having done
   * only the first four of those, as both old blocks did; each caller keeps
   * its own fallback to CSS. A throw propagates to the caller.
   * @param {HTMLElement} container - The mermaid container
   * @returns {boolean} False when no request method exists
   */
  function enterNativeFullscreen(container) {
    // Hide the width toggle button immediately
    toggleWidthButtonVisibility(container, false);

    // Hide mermaid-controls div for more diagram space
    toggleMermaidControlsVisibility(container, false);

    // Mark this container as the active fullscreen element and add class for CSS styling
    state.activeFullscreenContainer = container;
    container.classList.add(config.fullscreenClass);

    if (!requestNativeFullscreen(container)) return false;

    // Update button appearance right away
    updateFullscreenButtonInContainer(container, true);

    // Check and wait for MermaidPanZoom to be available
    ensurePanZoomAvailable()
      .then((panZoom) => {
        console.log(
          "[Mermaid View Controls] Activating pan-zoom for container:",
          container.id
        );
        panZoom.activateForContainer(container);

        // Auto-fit the diagram after a short delay - use a longer delay to ensure everything is ready
        setTimeout(() => {
          if (panZoom.fitDiagramToScreen) {
            // Call fitDiagramToScreen multiple times with increasing delays
            // to ensure proper scaling as the fullscreen transition completes
            panZoom.fitDiagramToScreen(container.id);

            FULLSCREEN_DELAYS_MS.nativeFitRetries.forEach((delay) => {
              setTimeout(() => {
                panZoom.fitDiagramToScreen(container.id);
              }, delay);
            });
          }
        }, FULLSCREEN_DELAYS_MS.nativeFirstFit);
      })
      .catch((error) => {
        console.warn("[Mermaid View Controls] MermaidPanZoom error:", error);
      });

    // Nothing is said here: the browser's own change event says "Full screen
    // on" once the container really is full screen (handleFullscreenChange)
    return true;
  }

  /**
   * Remove the "pan and zoom not available" notices a CSS entry added, so
   * none is left behind after exit and a second entry adds only its own.
   * @param {HTMLElement|null} container - The mermaid container
   */
  function removePanZoomNotices(container) {
    if (!container) return;
    container
      .querySelectorAll(".pan-zoom-notice")
      .forEach((notice) => notice.remove());
  }

  /**
   * Enable CSS-based fullscreen (fallback method)
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enableCssFullscreen(container, button) {
    console.log(
      "[Mermaid View Controls] Enabling CSS fullscreen for container:",
      container.id
    );

    container.classList.add(config.fullscreenClass);
    document.body.style.overflow = "hidden"; // Prevent scrolling

    // Hide the width toggle button explicitly
    toggleWidthButtonVisibility(container, false);

    // Hide mermaid-controls div for more diagram space
    toggleMermaidControlsVisibility(container, false);

    // Mark this container as the active fullscreen element
    state.activeFullscreenContainer = container;

    // Update the button appearance
    updateFullscreenButtonInContainer(container, true);

    // Add a notice to the container that can be shown if pan-zoom isn't available
    removePanZoomNotices(container);
    const notice = document.createElement("div");
    notice.className = "pan-zoom-notice";
    notice.style.position = "absolute";
    notice.style.top = "10px";
    notice.style.left = "50%";
    notice.style.transform = "translateX(-50%)";
    notice.style.background = "rgba(255, 255, 255, 0.8)";
    notice.style.padding = "5px 10px";
    notice.style.borderRadius = "4px";
    notice.style.display = "none";
    notice.textContent = "Pan and zoom functionality not available";
    container.appendChild(notice);

    // Check and wait for MermaidPanZoom to be available
    ensurePanZoomAvailable()
      .then((panZoom) => {
        console.log(
          "[Mermaid View Controls] PanZoom implementation:",
          panZoom === window.MermaidPanZoom ? "Global" : "Event-based"
        );

        if (panZoom.activateForContainer.toString().includes("Fallback")) {
          // We're using the fallback implementation
          console.warn(
            "[Mermaid View Controls] Using fallback implementation - limited functionality"
          );
          notice.style.display = "block";

          // Try to at least center and scale the diagram in a basic way
          const svg = container.querySelector("svg");
          if (svg) {
            svg.style.maxWidth = "90%";
            svg.style.maxHeight = "90%";
            svg.style.margin = "0 auto";
            svg.style.display = "block";
          }
        } else {
          console.log(
            "[Mermaid View Controls] Activating pan-zoom for container (CSS fullscreen):",
            container.id
          );
          panZoom.activateForContainer(container);

          // Auto-fit the diagram after a short delay
          setTimeout(() => {
            if (panZoom.fitDiagramToScreen) {
              console.log(
                "[Mermaid View Controls] Auto-fitting diagram to screen"
              );
              panZoom.fitDiagramToScreen(container.id);
            }
          }, FULLSCREEN_DELAYS_MS.cssFit);
        }
      })
      .catch((error) => {
        console.warn(
          "[Mermaid View Controls] MermaidPanZoom not available for CSS fullscreen:",
          error
        );
        notice.style.display = "block";
      });

    // Everything outside the view is inert while it is open (WCAG 2.4.3,
    // 2.4.11); exit removes exactly these. Then say it, once, inside the view.
    makeOutsideInert(container);
    announceInView(container, FULLSCREEN_STATUS_ON_TEXT);

    // Focus stays on the control that opened full screen
    if (button) setTimeout(() => button.focus(), 100);
  }
  /**
   * Restore focus to the previous element after exiting fullscreen
   * @param {HTMLElement} container - The container element
   */
  function restoreFocus(container) {
    if (!container) return;

    // The control that opened full screen, else the container's toggle button,
    // else the container itself
    const opener = fullscreenOpeners.get(container);
    fullscreenOpeners.delete(container);
    const target =
      (opener && opener.isConnected ? opener : null) ||
      document.getElementById(`toggle-fullscreen-${container.id}`) ||
      container;

    // Now, and once more if something took focus back in the same moment
    target.focus();
    setTimeout(() => {
      if (document.activeElement !== target && target.isConnected) {
        target.focus();
      }
    }, FOCUS_RESTORE_RETRY_MS);
  }

  /**
   * Exit fullscreen mode
   * @param {HTMLElement} container - The mermaid container
   */
  function exitFullscreen(container) {
    console.log("[Mermaid View Controls] Exiting fullscreen mode");

    // Store reference to the active container for restoration
    const activeContainer = container || state.activeFullscreenContainer;

    // Find and update the fullscreen button directly
    if (activeContainer) {
      const containerId = activeContainer.id;
      const fullscreenButton = document.getElementById(
        `toggle-fullscreen-${containerId}`
      );
      if (fullscreenButton) {
        console.log(
          "[Mermaid View Controls] Directly updating fullscreen button to enter mode"
        );
        fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        fullscreenButton.removeAttribute("aria-label");
      }
    }

    // Deactivate pan-zoom functionality. A throw here must not skip the rest
    // of the exit (the class, the scroll lock, the inert siblings, focus).
    if (window.MermaidPanZoom && activeContainer) {
      try {
        window.MermaidPanZoom.deactivateForContainer(activeContainer);
      } catch (error) {
        logError("[Mermaid View Controls] Pan-zoom deactivation failed:", error);
      }
    }
    removePanZoomNotices(activeContainer);
    removeOutsideInert(activeContainer);

    // Check if we're using the native fullscreen API
    const inNativeFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    // Check if we're in CSS fullscreen
    const inCssFullscreen = !!(
      activeContainer &&
      activeContainer.classList.contains(config.fullscreenClass) &&
      !inNativeFullscreen
    );

    console.log(
      `[Mermaid View Controls] Current fullscreen state: native=${inNativeFullscreen}, CSS=${inCssFullscreen}`
    );

    // First exit native fullscreen if active
    if (inNativeFullscreen) {
      console.log("[Mermaid View Controls] Exiting native fullscreen");

      // Remove the fullscreen class immediately to prevent double fullscreen
      if (activeContainer) {
        activeContainer.classList.remove(config.fullscreenClass);
      }

      // Exit using the appropriate method
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }

      // Directly force restore controls in the active container
      forceRestoreMermaidControls(activeContainer);

      // Update the button again after a delay to ensure it gets updated
      setTimeout(() => {
        if (activeContainer) {
          const fullscreenButton = document.getElementById(
            `toggle-fullscreen-${activeContainer.id}`
          );
          if (fullscreenButton) {
            fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
              config.fullscreenText
            }</span>`;
            fullscreenButton.removeAttribute("aria-label");
          }
        }
      }, 200);

      // Clear active container reference to prevent double fullscreen. The
      // browser's change event, which arrives later, speaks "Full screen off"
      // and restores focus, through nativeExitContainer.
      state.nativeExitContainer = activeContainer;
      state.activeFullscreenContainer = null;
    }
    // Then handle CSS fullscreen if active
    else if (
      activeContainer &&
      activeContainer.classList.contains(config.fullscreenClass)
    ) {
      console.log("[Mermaid View Controls] Exiting CSS fullscreen");

      activeContainer.classList.remove(config.fullscreenClass);
      document.body.style.overflow = ""; // Restore scrolling

      // Directly force restore controls in the active container
      forceRestoreMermaidControls(activeContainer);

      // Also restore all mermaid control buttons
      forceRestoreAllMermaidControls();

      // Clear active container reference
      state.activeFullscreenContainer = null;

      // Focus back on the opening control, then say it, once, in the view
      restoreFocus(activeContainer);
      announceInView(activeContainer, FULLSCREEN_STATUS_OFF_TEXT);
    } else {
      // If we can't find the specific container, try to restore all hidden controls
      forceRestoreAllMermaidControls();
    }
  }

  /**
   * Handle fullscreen change events from the browser
   */
  function handleFullscreenChange() {
    const isInFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    console.log(
      `[Mermaid View Controls] Fullscreen change detected. In fullscreen: ${!!isInFullscreen}`
    );

    if (isInFullscreen) {
      // We've entered fullscreen mode
      const container = isInFullscreen;
      console.log(
        "[Mermaid View Controls] Container entered fullscreen:",
        container.id
      );

      // Make sure container has the fullscreen class
      container.classList.add(config.fullscreenClass);
      state.activeFullscreenContainer = container; // Store the active container

      // Update button appearance right away
      updateFullscreenButtonInContainer(container, true);

      // Focus stays on the opening control (it is put back there if the
      // switch took it), and "Full screen on" is said once, inside the view
      state.nativeExitContainer = null;
      if (container.classList.contains(MERMAID_CONTAINER_CLASS)) {
        if (!fullscreenOpeners.has(container)) rememberOpener(container, null);
        const opener = fullscreenOpeners.get(container);
        if (opener && !container.contains(document.activeElement)) {
          opener.focus();
        }
        announceInView(container, FULLSCREEN_STATUS_ON_NATIVE_TEXT);
      }

      // The browser has now resized the container: fit on the next frame,
      // with the transition off, so the diagram is at its fitted size when
      // full screen appears. The timed fits below stay as a safety net.
      requestAnimationFrame(() => {
        if (
          window.MermaidPanZoom &&
          window.MermaidPanZoom.fitDiagramToScreen &&
          document.fullscreenElement === container
        ) {
          window.MermaidPanZoom.fitDiagramToScreen(container.id, {
            instant: true,
          });
        }
      });

      // Activate pan-zoom with a short delay to ensure DOM is updated
      setTimeout(() => {
        if (window.MermaidPanZoom) {
          console.log(
            "[Mermaid View Controls] Activating pan-zoom after fullscreen change"
          );
          window.MermaidPanZoom.activateForContainer(container);

          // Auto-fit the diagram to the screen - call twice with a delay to ensure proper fit
          setTimeout(() => {
            if (window.MermaidPanZoom.fitDiagramToScreen) {
              window.MermaidPanZoom.fitDiagramToScreen(container.id);

              // Call again after a delay to ensure accurate dimensions
              setTimeout(() => {
                window.MermaidPanZoom.fitDiagramToScreen(container.id);
              }, FULLSCREEN_DELAYS_MS.changeFitRetry);
            }
          }, FULLSCREEN_DELAYS_MS.changeFirstFit);
        }
      }, FULLSCREEN_DELAYS_MS.changeActivate);
    } else {
      // We've exited fullscreen mode
      const container = state.activeFullscreenContainer;

      if (container) {
        // Log the container we're exiting from
        console.log(
          "[Mermaid View Controls] Exiting fullscreen for container:",
          container.id
        );

        // Find the button for this container and update it directly
        const fullscreenButton = document.getElementById(
          `toggle-fullscreen-${container.id}`
        );
        if (fullscreenButton) {
          console.log(
            "[Mermaid View Controls] Found fullscreen button, updating to enter mode"
          );
          fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
            config.fullscreenText
          }</span>`;
          fullscreenButton.removeAttribute("aria-label");
        } else {
          console.warn(
            "[Mermaid View Controls] Fullscreen button not found for container:",
            container.id
          );
        }

        // Deactivate pan-zoom functionality; a throw must not skip the rest
        if (window.MermaidPanZoom) {
          try {
            window.MermaidPanZoom.deactivateForContainer(container);
          } catch (error) {
            logError(
              "[Mermaid View Controls] Pan-zoom deactivation failed:",
              error
            );
          }
        }
        removePanZoomNotices(container);
        removeOutsideInert(container);

        console.log(
          "[Mermaid View Controls] Restoring UI after fullscreen exit"
        );

        // Remove the fullscreen class immediately to prevent double fullscreen
        container.classList.remove(config.fullscreenClass);
        document.body.style.overflow = ""; // Restore scrolling

        // Force restore mermaid controls
        forceRestoreMermaidControls(container);

        // Clear active container reference
        state.activeFullscreenContainer = null;
        state.nativeExitContainer = null;

        // Focus back on the opening control, then say it, once, in the view
        restoreFocus(container);
        announceInView(container, FULLSCREEN_STATUS_OFF_TEXT);
      } else {
        // If activeFullscreenContainer is not available, try to restore all controls
        console.log(
          "[Mermaid View Controls] No active container reference, restoring all controls"
        );
        forceRestoreAllMermaidControls();

        // Reset all fullscreen buttons
        document
          .querySelectorAll('button[id^="toggle-fullscreen-"]')
          .forEach((button) => {
            button.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
              config.fullscreenText
            }</span>`;
            button.removeAttribute("aria-label");
          });

        setTimeout(resetAllFullscreenButtons, 300);

        // The exit exitFullscreen asked for (button or Escape): the browser's
        // change event is the moment native full screen is really over
        const exited = state.nativeExitContainer;
        state.nativeExitContainer = null;
        if (exited) {
          restoreFocus(exited);
          announceInView(exited, FULLSCREEN_STATUS_OFF_TEXT);
        }
      }
    }
  }

  /**
   * Update all fullscreen button appearances in a container
   * @param {HTMLElement} container - The mermaid container
   * @param {boolean} isFullscreen - Whether in fullscreen mode
   */
  function updateFullscreenButtonInContainer(container, isFullscreen) {
    if (!container) return;

    // Find the fullscreen button in this container
    const containerId = container.id;
    const fullscreenButton = document.getElementById(
      `toggle-fullscreen-${containerId}`
    );

    if (fullscreenButton) {
      console.log(
        `[Mermaid View Controls] Updating fullscreen button to: ${
          isFullscreen ? "exit" : "enter"
        } mode`
      );

      if (isFullscreen) {
        fullscreenButton.innerHTML = `${getExitFullscreenIcon()} <span class="button-text">${
          config.exitFullscreenText
        }</span>`;
        fullscreenButton.removeAttribute("aria-label");
      } else {
        fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        fullscreenButton.removeAttribute("aria-label");
      }
    }
  }

  /**
   * Handle escape key press to exit fullscreen
   * @param {KeyboardEvent} event - The keyboard event
   */
  function handleEscapeKey(event) {
    if (event.key === "Escape") {
      // First check if we have an active CSS fullscreen container
      if (
        state.activeFullscreenContainer &&
        state.activeFullscreenContainer.classList.contains(
          config.fullscreenClass
        )
      ) {
        console.log(
          "[Mermaid View Controls] Escape key detected, exiting CSS fullscreen"
        );
        exitFullscreen(state.activeFullscreenContainer);
        event.preventDefault(); // Prevent other escape handlers
      }
      // We don't need to handle native fullscreen here, the browser does it for us
    }
  }
  /**
   * Reset all fullscreen buttons to their default state
   * This is a catch-all solution for when normal update methods fail
   */
  function resetAllFullscreenButtons() {
    console.log("[Mermaid View Controls] Resetting all fullscreen buttons");

    // Find all fullscreen toggle buttons
    const fullscreenButtons = document.querySelectorAll(
      'button[id^="toggle-fullscreen-"]'
    );

    fullscreenButtons.forEach((button) => {
      // Get container ID from button ID
      const containerId = button.id.replace("toggle-fullscreen-", "");
      const container = document.getElementById(containerId);

      // Check if container is in fullscreen
      const isInFullscreen =
        container &&
        (container === document.fullscreenElement ||
          container === document.webkitFullscreenElement ||
          container === document.mozFullScreenElement ||
          container === document.msFullscreenElement ||
          container.classList.contains(config.fullscreenClass));

      // Update button based on fullscreen state
      if (isInFullscreen) {
        button.innerHTML = `${getExitFullscreenIcon()} <span class="button-text">${
          config.exitFullscreenText
        }</span>`;
        button.removeAttribute("aria-label");
      } else {
        button.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        button.removeAttribute("aria-label");
      }
    });
  }
  /**
   * Check if current device is mobile
   * @returns {boolean} True if device is likely mobile
   */
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Force restore mermaid controls in a specific container
   * @param {HTMLElement} container - The mermaid container
   */
  function forceRestoreMermaidControls(container) {
    if (!container) {
      console.warn(
        "[Mermaid View Controls] Cannot restore controls: No container provided"
      );
      return;
    }

    // First try the standard toggle method
    toggleWidthButtonVisibility(container, true);
    toggleMermaidControlsVisibility(container, true);

    // Then force direct restoration of any controls
    const mermaidControls = container.querySelector(".mermaid-controls");
    if (mermaidControls) {
      console.log(
        "[Mermaid View Controls] Directly forcing control visibility in container"
      );
      mermaidControls.style.removeProperty("display");
      mermaidControls.removeAttribute("aria-hidden");
    }
  }

  /**
   * Force restore all mermaid controls in the document
   * Useful as a fallback when specific container references are lost
   */
  function forceRestoreAllMermaidControls() {
    console.log(
      "[Mermaid View Controls] Attempting to restore all hidden mermaid controls"
    );

    // Find all hidden mermaid-controls in the document
    const hiddenControls = document.querySelectorAll(
      ".mermaid-controls[style*='display: none'], .mermaid-controls[aria-hidden='true']"
    );

    if (hiddenControls.length > 0) {
      console.log(
        `[Mermaid View Controls] Found ${hiddenControls.length} hidden mermaid controls to restore`
      );

      hiddenControls.forEach((controls) => {
        // Remove the display style property entirely
        controls.style.removeProperty("display");
        // Remove the aria-hidden attribute
        controls.removeAttribute("aria-hidden");
      });
    }

    // Also restore any width toggle buttons that might be hidden
    const hiddenWidthButtons = document.querySelectorAll(
      "button[id^='toggle-width-'][style*='display: none']"
    );
    if (hiddenWidthButtons.length > 0) {
      hiddenWidthButtons.forEach((button) => {
        button.style.removeProperty("display");
      });
    }
  }

  /**
   * Toggle visibility of the width toggle button
   * @param {HTMLElement} container - The mermaid container
   * @param {boolean} isVisible - Whether the button should be visible
   */
  function toggleWidthButtonVisibility(container, isVisible) {
    if (!container) return;

    const widthToggleButton = container.querySelector(
      'button[id^="toggle-width-"]'
    );
    if (widthToggleButton) {
      widthToggleButton.style.display = isVisible ? "" : "none";
    }
  }

  /**
   * Toggle visibility of the mermaid-controls div
   * @param {HTMLElement} container - The mermaid container
   * @param {boolean} isVisible - Whether the controls should be visible
   */
  function toggleMermaidControlsVisibility(container, isVisible) {
    if (!container) {
      console.warn("[Mermaid View Controls] Container is null or undefined");
      return;
    }

    // Use querySelectorAll to find ALL mermaid-controls divs in the container
    const mermaidControlsList = container.querySelectorAll(".mermaid-controls");

    if (mermaidControlsList.length === 0) {
      console.warn(
        "[Mermaid View Controls] No mermaid-controls found in container:",
        container
      );

      // As a fallback, try to find mermaid-controls in the entire document
      if (isVisible) {
        const allMermaidControls = document.querySelectorAll(
          ".mermaid-controls[style*='display: none']"
        );
        if (allMermaidControls.length > 0) {
          console.log(
            `[Mermaid View Controls] Found ${allMermaidControls.length} hidden mermaid-controls in document`
          );

          allMermaidControls.forEach((controls) => {
            // CHANGE: Use removeProperty instead of setting to empty string
            controls.style.removeProperty("display");
            controls.removeAttribute("aria-hidden");
          });
        }
      }

      return;
    }

    // Update all mermaid-controls divs found
    mermaidControlsList.forEach((controls) => {
      // CHANGE: Use removeProperty when making visible
      if (isVisible) {
        controls.style.removeProperty("display");
      } else {
        controls.style.display = "none";
      }

      // Ensure the controls have correct ARIA attributes for accessibility
      if (isVisible) {
        controls.removeAttribute("aria-hidden");
      } else {
        controls.setAttribute("aria-hidden", "true");
      }
    });
  }

  // SVG Icons
  function getExpandIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>`;
  }

  function getCollapseIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>`;
  }

  function getFullscreenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
  }

  function getExitFullscreenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>`;
  }

  function getCloseIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
  }

  // No page scan and no body-wide observer (F4): figures are attached from
  // the render, through MermaidControls.addControlsToContainer. The
  // announcer is still created at DOMContentLoaded, as it always was, so it
  // exists long before anything is written to it (parcel 5 owns announcers).
  document.addEventListener("DOMContentLoaded", prepareModule);

  // Public API
  return {
    init: init,
    attach: attach,
    detach: detach,
    toggleWidth: toggleWidth,
    toggleFullscreen: toggleFullscreen,
    exitFullscreen: exitFullscreen,
    toggleMermaidControlsVisibility: toggleMermaidControlsVisibility,
  };
})();

// On window (F1): a top-level const is a global binding but not a window
// property, so every `window.MermaidViewControls` check — this file's own
// and mermaid-accessibility-core.js's — used to read undefined.
window.MermaidViewControls = MermaidViewControls;
