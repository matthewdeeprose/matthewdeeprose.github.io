// music-confirm.js
// Modal / confirm adapter for the Accessible Music proof of concept.
//
// Today this runs in FALLBACK mode: confirmations and alerts are delivered
// through a native <dialog> element shown with showModal() (which inert-s and
// focus-traps the background for us). Its signatures and Promise contract are
// written to match the real modal system exactly, so wiring in the real system
// later is a one-line change at the SWAP POINT inside confirm() / alert().
// Exposed as window.MusicConfirm.

const MusicConfirm = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  let dialogSeq = 0; // for unique heading/message ids

  // Shared dialogue builder. buttons: array of { text, value } in DOM order.
  // escapeValue: the value to resolve with when the user presses Escape.
  // Returns a Promise that resolves (never rejects) with the chosen value.
  function openDialog(message, title, buttons, escapeValue) {
    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      dialogSeq += 1;
      const headingId = "music-dialog-heading-" + dialogSeq;
      const messageId = "music-dialog-message-" + dialogSeq;

      const dialog = document.createElement("dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", headingId);
      dialog.setAttribute("aria-describedby", messageId);

      const heading = document.createElement("h2");
      heading.id = headingId;
      heading.tabIndex = -1;
      heading.textContent = title;

      const body = document.createElement("p");
      body.id = messageId;
      body.textContent = message;

      dialog.append(heading, body);

      let settled = false;
      function cleanup(value) {
        if (settled) return;
        settled = true;
        dialog.close();
        dialog.remove();
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        resolve(value);
      }

      buttons.forEach(function (b) {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = b.text;
        el.addEventListener("click", function () {
          cleanup(b.value);
        });
        dialog.append(el);
      });

      // Escape: the native <dialog> fires a "cancel" event — map it to
      // escapeValue. We add NO backdrop-click handler, so a backdrop click is
      // ignored, matching the real component's closeOnOverlayClick:false.
      dialog.addEventListener("cancel", function (e) {
        e.preventDefault();
        cleanup(escapeValue);
      });

      document.body.appendChild(dialog);
      dialog.showModal(); // modal: inert-s and focus-traps the background automatically
      heading.focus(); // focus the title heading, mirroring the real component
      logDebug("Opened dialogue box: " + title);
    });
  }

  // Fallback confirm: cancel button first (left), affirmative last (right).
  // Escape resolves false.
  function fallbackConfirm(message, title, options) {
    const confirmText = (options && options.confirmText) || "Yes";
    const cancelText = (options && options.cancelText) || "No";
    return openDialog(
      message,
      title,
      [
        { text: cancelText, value: false },
        { text: confirmText, value: true },
      ],
      false
    );
  }

  // Fallback alert: a single OK button resolving undefined (void). Escape also
  // resolves undefined.
  function fallbackAlert(message, title, options) {
    const okText = (options && options.okText) || "OK";
    return openDialog(message, title, [{ text: okText, value: undefined }], undefined);
  }

  // Public confirm — resolves Promise<boolean>.
  function confirm(message, title = "Confirm", options = {}) {
    // === SWAP POINT — to wire the real system, replace the next line with:
    //        return window.safeConfirm(message, title, options);
    return fallbackConfirm(message, title, options);
  }

  // Public alert — resolves Promise<void>.
  function alert(message, title = "Alert", options = {}) {
    // === SWAP POINT — to wire the real system, replace the next line with:
    //        return window.safeAlert(message, title, options);
    return fallbackAlert(message, title, options);
  }

  // Self-test: async because it drives the dialogues programmatically. Verifies
  // the surface, the resolve values for each button and Escape, the void alert
  // contract, that the 2nd positional argument lands as the heading text, and
  // that focus returns to the invoking element on close.
  async function selfTest() {
    const results = {};
    results.hasConfirm = typeof confirm === "function";
    results.hasAlert = typeof alert === "function";

    // confirm resolves TRUE on the affirmative button; and the 2nd positional
    // arg lands as the heading text.
    let p = confirm("self-test confirm", "Heading Proof");
    let dlg = document.querySelector("dialog[open]");
    results.confirmReturnsThenable = !!p && typeof p.then === "function";
    results.titleIsSecondPositionalArg =
      !!dlg &&
      !!dlg.querySelector("h2") &&
      dlg.querySelector("h2").textContent === "Heading Proof";
    let btns = dlg.querySelectorAll("button");
    btns[btns.length - 1].click(); // last button = affirmative
    results.confirmAffirmativeResolvesTrue = (await p) === true;

    // confirm resolves FALSE on the cancel button.
    p = confirm("self-test no", "T");
    dlg = document.querySelector("dialog[open]");
    dlg.querySelectorAll("button")[0].click(); // first button = cancel
    results.confirmCancelResolvesFalse = (await p) === false;

    // confirm resolves FALSE on Escape (never rejects).
    p = confirm("self-test esc", "T");
    dlg = document.querySelector("dialog[open]");
    dlg.dispatchEvent(new Event("cancel", { cancelable: true }));
    results.escapeResolvesFalse = (await p) === false;

    // alert resolves undefined (void) on OK.
    p = alert("self-test alert", "Alert Heading");
    dlg = document.querySelector("dialog[open]");
    dlg.querySelector("button").click(); // OK
    results.alertResolvesVoid = (await p) === undefined;

    // focus returns to the invoking element on close.
    const temp = document.createElement("button");
    temp.type = "button";
    temp.textContent = "temp";
    document.body.appendChild(temp);
    temp.focus();
    p = confirm("self-test focus", "T");
    dlg = document.querySelector("dialog[open]");
    dlg.querySelectorAll("button")[1].click(); // affirmative
    await p;
    results.returnsFocusToInvoker = document.activeElement === temp;
    temp.remove();

    console.table(results);
    return results;
  }

  return { confirm, alert, selfTest };
})();

window.MusicConfirm = MusicConfirm;
