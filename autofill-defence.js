/**
 * @fileoverview Browser-autofill defence for credential inputs
 * @description
 * Applies the `readonly`-until-focus pattern to every hardened credential
 * input (any input whose `name` starts with `<service>_credential_`).
 *
 * Why: even with `autocomplete="new-password"`, Chrome's password-manager
 * heuristic fires "Save password?" / "Update password?" prompts when it
 * detects a programmatic value change on a credential-shaped input — which
 * happens every time a mode controller's loadStoredConfig() populates the
 * App Key / API Token fields from localStorage. Setting the input to
 * `readonly` masks the change from Chrome's heuristic; we lift `readonly`
 * on first focus so the user can still edit normally. Idempotent — safe
 * to load multiple times.
 *
 * Loaded as a plain script (no module) so it can run before any mode
 * controller. Registers its DOMContentLoaded listener at evaluation time
 * so it fires before later-loaded scripts' listeners.
 */

(function () {
  "use strict";

  const SELECTOR =
    'input[name^="mathpix_credential_"], ' +
    'input[name^="openrouter_credential_"], ' +
    'input[name^="ally_credential_"]';

  function applyDefence() {
    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach(function (input) {
      if (input.dataset.autofillDefenceApplied === "1") return;
      input.dataset.autofillDefenceApplied = "1";
      input.setAttribute("readonly", "readonly");
      // Re-apply readonly on every blur (not once-on-focus). The field is
      // readonly whenever the user isn't actively typing — Chrome's
      // password-manager heuristic ignores value changes on readonly
      // inputs, so the prompt won't fire on programmatic populates from
      // loadStoredConfig() or mode-switcher re-init paths.
      input.addEventListener("focus", function () {
        input.removeAttribute("readonly");
      });
      input.addEventListener("blur", function () {
        input.setAttribute("readonly", "readonly");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDefence);
  } else {
    applyDefence();
  }
})();
