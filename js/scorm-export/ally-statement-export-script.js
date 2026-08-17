/**
 * @fileoverview Injected disclosure script for the Ally statement export.
 * @module ally-statement-export-script
 * @version 0.1.0
 * @since 0.3.0 (interactive disclosure parity)
 *
 * @description
 * A single self-contained `<script>` (+ a `<noscript>` fallback) handed to the
 * Phase 1 export facade as `options.bodyEnd`, so it runs at the END of the
 * exported document's `<body>` — after the statement has parsed, so there is no
 * flash of expanded content.
 *
 * It reproduces the in-app disclosure behaviour (`toggleDisclosure` in
 * ally-statement-preview.js) that native `<details>` cannot: on expand the
 * "Read more" toggle **relocates to the end** of the wrapper (so it sits below
 * the revealed content — DOM order = visual order = focus order, WCAG 2.4.3 /
 * 1.3.2), its label flips **Read more ↔ Read less**, the chevron rotates via
 * `aria-expanded`, and focus is kept on the toggle across the DOM move.
 *
 * PROGRESSIVE ENHANCEMENT: the export ships the disclosure content VISIBLE in the
 * raw HTML (fully readable with JS off or by a checker). This script collapses it
 * on load and wires the interactive toggle; the `<noscript>` block hides the
 * (inert) toggle button when JS is unavailable, so there is no dead control.
 *
 * Data-only module (no logging): it exports one string constant, mirroring
 * ally-statement-export-css.js.
 */

export const ALLY_STATEMENT_EXPORT_SCRIPT = `<script>
(function () {
  "use strict";
  function toggle(button) {
    var content = document.getElementById(button.getAttribute("aria-controls"));
    if (!content) return;
    var wrapper = content.parentNode;
    var next = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(next));
    if (next) {
      content.removeAttribute("hidden");
      wrapper.appendChild(button); // toggle moves BELOW the revealed content
    } else {
      content.setAttribute("hidden", "");
      wrapper.insertBefore(button, content); // toggle moves back ABOVE the content
    }
    // Keep focus on the toggle across the DOM move in BOTH directions (moving a
    // focused element via append/insert drops focus in Chromium, so the in-app's
    // expand path — which does not refocus — loses keyboard focus). preventScroll
    // avoids a jarring jump to the relocated toggle.
    button.focus({ preventScroll: true });
    var label = button.querySelector(".ally-sp-disclosure-text");
    if (label) {
      label.textContent = next
        ? label.textContent.replace("Read more about", "Read less about")
        : label.textContent.replace("Read less about", "Read more about");
    }
  }
  // Collapse every disclosure within \`scope\` (default document). Content ships
  // VISIBLE in the raw HTML (no-JS readable); this hides it, puts the toggle above
  // the content, and resets the label to "Read more". Idempotent — safe to run on
  // load AND again on any content injected later: the Phase 3 refresh swap calls
  // this on the freshly-injected sections so they match a fresh export.
  function collapse(scope) {
    var root = scope || document;
    var wrappers = root.querySelectorAll(".ally-sp-disclosure-wrapper");
    for (var i = 0; i < wrappers.length; i++) {
      var button = wrappers[i].querySelector(".ally-sp-disclosure-button");
      var content = wrappers[i].querySelector(".ally-sp-expandable-content");
      if (!button || !content) continue;
      content.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", "false");
      wrappers[i].insertBefore(button, content);
      var label = button.querySelector(".ally-sp-disclosure-text");
      if (label) {
        label.textContent = label.textContent.replace(
          "Read less about",
          "Read more about"
        );
      }
    }
  }
  // ONE delegated click listener handles every disclosure button — including any
  // injected AFTER load (the Phase 3 refresh swap) — so bindings never go stale.
  document.addEventListener("click", function (e) {
    var button =
      e.target && e.target.closest
        ? e.target.closest(".ally-sp-disclosure-button")
        : null;
    if (button) toggle(button);
  });
  // Injected at end-of-body, so the whole statement above is already parsed:
  // collapse immediately (before paint — no flash). Misplaced into <head> it would
  // find nothing and disclosures stay expanded (still readable) — a safe degradation.
  collapse(document);
  // Expose the collapse hook so injected content (the Phase 3 refresh swap) can be
  // collapsed to match a fresh export.
  window.ALLY_SP_DISCLOSURES = { collapse: collapse };
})();
</script>
<noscript><style>.ally-sp-disclosure-button { display: none !important; }</style></noscript>`;
