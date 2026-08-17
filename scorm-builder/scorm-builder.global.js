/*
 * scorm-builder global shim — load this from a CLASSIC <script> (NOT type=module)
 * so plain/IIFE code (window globals) can use the ESM library:
 *
 *   <script src="path/to/scorm-builder/scorm-builder.global.js"></script>
 *   <script>
 *     window.ScormBuilder.ready.then(function (SB) {
 *       SB.attachExportButton(btn, { target: 'scorm', getContent: () => editor.value });
 *       // or: SB.export({ target: 'html', html, download: true });
 *     });
 *   </script>
 *
 * A classic script can't `import` statically, but it CAN dynamic-import(), so this
 * shim loads ./index.js (resolved relative to its own URL) and exposes the API on
 * window.ScormBuilder, with a `ready` promise and a `scorm-builder:ready` event.
 */
(function () {
  "use strict";

  // Capture this script's URL synchronously (currentScript is only valid now).
  var self = document.currentScript;
  var indexURL = new URL("./index.js", self ? self.src : location.href).href;

  var resolveReady, rejectReady;
  var ready = new Promise(function (res, rej) {
    resolveReady = res;
    rejectReady = rej;
  });

  // Expose immediately so callers can grab `.ready` before the import resolves.
  window.ScormBuilder = window.ScormBuilder || {};
  window.ScormBuilder.ready = ready;

  import(indexURL)
    .then(function (mod) {
      var SB = window.ScormBuilder;
      for (var key in mod) {
        if (Object.prototype.hasOwnProperty.call(mod, key)) SB[key] = mod[key];
      }
      // `export` is a reserved word as an ESM name; expose the alias here.
      SB.export = mod.exportDocument;
      SB.ready = ready;

      resolveReady(SB);
      try {
        window.dispatchEvent(new CustomEvent("scorm-builder:ready", { detail: SB }));
      } catch (e) {
        /* CustomEvent unavailable — ignore */
      }
    })
    .catch(function (err) {
      console.error("[scorm-builder] failed to load library from " + indexURL, err);
      rejectReady(err);
    });
})();
