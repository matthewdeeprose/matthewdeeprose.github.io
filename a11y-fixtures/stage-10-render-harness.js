// stage-10-render-harness.js — Stage 10 Parcel 6 render harness mount.
//
// Mounts the LIVE Edit-Alt sub-view of the MathPix Image Manager into a
// permanent, servable accessibility-audit fixture, in its
// decorative-ON-with-conflict state, so the P9 auditor can audit the real
// markup in both themes (decisions-doc H-8 / F2.4).
//
// This file is shared (DRY) by both the light entry
// (stage-10-render-harness.html) and the dark twin
// (stage-10-render-harness-dark.html). The dark twin differs ONLY by an
// inline pre-mount theme-force; the mount itself is identical.
//
// Restorer-free render path: _buildEditAltViewHTML(), _applyDecorativeState()
// and _attachFormReactivityListeners() are DOM-only and never touch
// this.restorer, so an empty truthy object ({}) passes the constructor guard.
// We deliberately do NOT route through openEditAltText() or getInstance()
// (both need a real session restorer).
(function () {
  "use strict";

  // --- Logging (project house style: configurable, British spelling) ---
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

  function mount() {
    const ImgMgrNS = window.MathPixImageManagerUI;
    if (!ImgMgrNS || !ImgMgrNS.MathPixImageManagerUI) {
      logError(
        "Render harness: window.MathPixImageManagerUI.MathPixImageManagerUI " +
          "is not available. Did mathpix-image-manager-ui.js load before this?",
      );
      return;
    }

    const mountEl = document.getElementById("harness-mount");
    if (!mountEl) {
      logError("Render harness: #harness-mount not found in the document.");
      return;
    }

    // Restorer-free instance (nested global; {} is truthy → guard passes).
    const ui = new ImgMgrNS.MathPixImageManagerUI({});

    // Inject the this-free Edit-Alt template, then un-hide its container.
    mountEl.innerHTML = ui._buildEditAltViewHTML();
    document
      .getElementById("mmd-image-manager-edit-view")
      ?.removeAttribute("hidden");

    // Seed content so the conflict state is meaningful, then drive the LIVE
    // mutator into decorative-ON-with-conflict.
    document.getElementById("edit-alt-alttext-input").value =
      "Existing alt text";
    document.getElementById("edit-alt-longdesc-input").value =
      "Existing long description";
    document.getElementById("edit-alt-decorative-input").checked = true;
    ui._applyDecorativeState(true); // decorative-ON-with-conflict

    // Wire real reactivity so a manual tester can untick to see the OFF state
    // live (the stub instance has no _valuesAtOpen/_dirtyFields, so the dirty
    // flag path returns early and never touches the absent restorer).
    ui._attachFormReactivityListeners();

    logInfo("Render harness: Edit-Alt view mounted (decorative-ON-with-conflict).");
  }

  // Scripts load at end of <body>, so #harness-mount already exists; but guard
  // for the loading state just in case a future entry moves the script.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
