// Phase HK — OWL-ViT removal verification
// Paste this entire file into the browser console, or load via <script>
(function () {
  "use strict";

  var results = [];
  var pass = 0;
  var fail = 0;

  function check(label, actual, expected) {
    var ok = actual === expected;
    if (ok) { pass++; } else { fail++; }
    results.push(
      (ok ? "PASS" : "FAIL") + " | " + label +
      (ok ? "" : " — expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual))
    );
  }

  // File 1 — Transformers gateway
  check("detectObjects removed", typeof ImageDescriberAnalyserTransformers.detectObjects, "undefined");
  check("classifyImage intact", typeof ImageDescriberAnalyserTransformers.classifyImage, "function");
  check("ensureLibrary intact", typeof ImageDescriberAnalyserTransformers.ensureLibrary, "function");

  // File 2 — Debug controller
  check("downloadOwlVitModel removed", typeof ImageDescriberController.downloadOwlVitModel, "undefined");
  check("checkOwlVitCached removed", typeof ImageDescriberController.checkOwlVitCached, "undefined");
  check("updateDebugPanel intact", typeof ImageDescriberController.updateDebugPanel, "function");
  check("updateLibraryStatus intact", typeof ImageDescriberController.updateLibraryStatus, "function");

  // File 3 — Analyser
  check("analyse intact", typeof ImageDescriberAnalyser.analyse, "function");
  check("formatForPrompt intact", typeof ImageDescriberAnalyser.formatForPrompt, "function");

  // File 4 — HTML
  check("owlvit element removed", document.getElementById("imgdesc-lib-owlvit"), null);
  check("owlvit button removed", document.getElementById("imgdesc-owlvit-download-btn"), null);
  check("tesseract element intact", document.getElementById("imgdesc-lib-tesseract") !== null, true);

  // File 5 — Profiles
  check("OBJECT_DETECTION_LABELS removed", typeof ImageDescriberAnalyserProfiles.OBJECT_DETECTION_LABELS, "undefined");
  check("getProfile intact", typeof ImageDescriberAnalyserProfiles.getProfile, "function");
  check("diagram profile works", ImageDescriberAnalyserProfiles.getProfile("diagram").name, "diagram");

  // Summary
  console.log("========================================");
  console.log(" Phase HK — OWL-ViT Removal Verification");
  console.log("========================================");
  for (var i = 0; i < results.length; i++) {
    console.log(results[i]);
  }
  console.log("----------------------------------------");
  console.log(pass + " passed, " + fail + " failed");
  if (fail === 0) {
    console.log("All checks passed — OWL-ViT fully removed.");
  } else {
    console.warn("Some checks failed — review above.");
  }
  console.log("========================================");
})();
