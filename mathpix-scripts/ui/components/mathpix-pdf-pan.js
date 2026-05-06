/**
 * MathPix PDF Pan
 *
 * Click-to-drag panning for the MathPix PDF preview scroll containers.
 * Sits on top of native scroll: drag updates container.scrollLeft/scrollTop,
 * so keyboard arrow-key scrolling continues to work in parallel.
 *
 * Activation:
 *   - Pointer down on a <canvas> inside .mmd-pdf-pages (event-delegated)
 *   - Drag activates after dragThreshold pixels of movement (default 5px)
 *   - Cursor: grab when canvas overflows container, grabbing during active drag
 *
 * Auto-init on DOMContentLoaded for both:
 *   #mmd-pdf-scroll-container         (upload mode)
 *   #resume-mmd-pdf-scroll-container  (resume mode)
 *
 * Runtime tweaks:
 *   window.MATHPIX_PDF_PAN_CONFIG.dragThreshold = 0;   // disable threshold
 *   window.MATHPIX_PDF_PAN_CONFIG.disableDrag = true;  // kill switch
 *   window.MathPixPdfPan.getHandle('upload').refresh();
 */
window.MathPixPdfPan = (function () {
  "use strict";

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(m, ...a) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[MathPix PDF Pan]", m, ...a);
  }
  function logWarn(m, ...a) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MathPix PDF Pan]", m, ...a);
  }
  function logInfo(m, ...a) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[MathPix PDF Pan]", m, ...a);
  }
  function logDebug(m, ...a) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[MathPix PDF Pan]", m, ...a);
  }

  const DEFAULTS = {
    dragThreshold: 5, // pixels of movement before drag activates
    disableDrag: false, // kill switch
  };

  if (!window.MATHPIX_PDF_PAN_CONFIG) {
    window.MATHPIX_PDF_PAN_CONFIG = { ...DEFAULTS };
  }

  function readConfig(localOpts) {
    return {
      ...DEFAULTS,
      ...window.MATHPIX_PDF_PAN_CONFIG,
      ...(localOpts || {}),
    };
  }

  const handles = new Map();

  function attach(container, options) {
    if (!container || !(container instanceof Element)) {
      logWarn("attach: invalid container", container);
      return null;
    }

    let opts = readConfig(options);
    let activePointerId = null;
    let dragActive = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let pannableTimer = null;

    function overflowsContainer() {
      return (
        container.scrollWidth > container.clientWidth ||
        container.scrollHeight > container.clientHeight
      );
    }

    function updatePannableState() {
      const shouldBePannable = overflowsContainer() && !opts.disableDrag;
      container.classList.toggle("mmd-pdf-pannable", shouldBePannable);
    }

    function scheduleUpdate() {
      if (pannableTimer) clearTimeout(pannableTimer);
      pannableTimer = setTimeout(updatePannableState, 50);
    }

    function isCanvasTarget(target) {
      return (
        target &&
        target.tagName === "CANVAS" &&
        target.closest(".mmd-pdf-pages")
      );
    }

    function onPointerDown(e) {
      if (activePointerId !== null) return; // already tracking another pointer
      if (e.button !== 0) return;
      if (opts.disableDrag) return;
      if (!isCanvasTarget(e.target)) return;
      if (!overflowsContainer()) return;

      activePointerId = e.pointerId;
      dragActive = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = container.scrollLeft;
      startScrollTop = container.scrollTop;

      try {
        container.setPointerCapture(e.pointerId);
      } catch (err) {
        logDebug("setPointerCapture failed", err);
      }
      logDebug("pointerdown", { startX, startY });
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragActive) {
        if (
          Math.abs(dx) <= opts.dragThreshold &&
          Math.abs(dy) <= opts.dragThreshold
        ) {
          return; // below threshold; quick clicks pass through
        }
        dragActive = true;
        container.classList.add("mmd-pdf-panning");
        logDebug("drag activated");
      }

      container.scrollLeft = startScrollLeft - dx;
      container.scrollTop = startScrollTop - dy;
      e.preventDefault();
    }

    function endDrag(e) {
      if (e && e.pointerId !== activePointerId) return;
      if (activePointerId !== null) {
        try {
          container.releasePointerCapture(activePointerId);
        } catch (err) {
          // ignore: capture may already have been released
        }
      }
      activePointerId = null;
      dragActive = false;
      container.classList.remove("mmd-pdf-panning");
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    let resizeObserver = null;
    let mutationObserver = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(container);
    }
    if (typeof MutationObserver === "function") {
      mutationObserver = new MutationObserver(scheduleUpdate);
      mutationObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "width", "height"],
      });
    }

    updatePannableState();
    logInfo("attached", container.id || "(no id)");

    return {
      detach() {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", endDrag);
        container.removeEventListener("pointercancel", endDrag);
        if (resizeObserver) resizeObserver.disconnect();
        if (mutationObserver) mutationObserver.disconnect();
        if (pannableTimer) clearTimeout(pannableTimer);
        container.classList.remove("mmd-pdf-pannable", "mmd-pdf-panning");
        logInfo("detached", container.id || "(no id)");
      },
      refresh() {
        opts = readConfig(options);
        updatePannableState();
      },
      setOptions(newOpts) {
        opts = { ...opts, ...newOpts };
        updatePannableState();
      },
      getContainer() {
        return container;
      },
    };
  }

  function autoInit() {
    const targets = [
      { name: "upload", id: "mmd-pdf-scroll-container" },
      { name: "resume", id: "resume-mmd-pdf-scroll-container" },
    ];
    targets.forEach(({ name, id }) => {
      const el = document.getElementById(id);
      if (!el) {
        logDebug(`auto-init: ${id} not found`);
        return;
      }
      if (handles.has(name)) {
        logDebug(`auto-init: ${name} already attached`);
        return;
      }
      const h = attach(el);
      if (h) {
        handles.set(name, h);
        logInfo(`auto-init: attached ${name}`);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

  return {
    attach,
    getHandle(name) {
      return handles.get(name) || null;
    },
    listHandles() {
      return Array.from(handles.keys());
    },
  };
})();
