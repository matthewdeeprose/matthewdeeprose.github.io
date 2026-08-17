// scorm-api.js generation — SCORM 2004 RTE (API_1484_11) wrapper that the
// packaged content.html loads. Ported verbatim from scorm-export-manager.js
// generateSCORMAPIWrapper (~line 424); only the comment header is genericised.
//
// The returned string is the file contents; it self-discovers the LMS API by
// walking window.parent up to maxSearchDepth, then Initialize/SetValue/Terminate.

/**
 * @param {object} [opts]
 * @param {boolean} [opts.quizPresent] - a scored quiz is in the content, so
 *   terminate must NOT hard-code success_status="passed" (the quiz decides it,
 *   or it stays unknown/incomplete when the learner never submits).
 * @param {boolean} [opts.reportScore] - the build wants score reporting (kept for
 *   symmetry; the reportScore() method is always exposed and simply no-ops when
 *   no LMS API is present).
 * @returns {string} scorm-api.js file contents
 */
export function generateApiWrapper(opts = {}) {
  const quizPresent = opts.quizPresent === true;

  return `/**
 * SCORM 2004 API Wrapper
 * Self-contained accessible content SCORM integration.
 */

(function() {
  'use strict';

  var scormAPI = null;
  var maxSearchDepth = 7;
  // Baked at build time: when a scored quiz is present, session end must not
  // assert "passed" — reportScore() sets the real status, or it stays unknown.
  var quizPresent = ${quizPresent ? "true" : "false"};
  var scoreReported = false;
  var sessionTerminated = false;

  // SCORM API Discovery. Walk a window's frame hierarchy (parent chain) looking
  // for the LMS-provided API object.
  function findSCORMAPI(win) {
    var depth = 0;
    while ((win.API_1484_11 == null) && (win.parent != null) &&
           (win.parent != win) && (depth < maxSearchDepth)) {
      depth++;
      win = win.parent;
    }
    return win.API_1484_11;
  }

  function getSCORMAPI() {
    if (scormAPI != null) return scormAPI;

    // 1. This window's own frame chain (SCO launched in an iframe).
    var api = findSCORMAPI(window);

    // 2. The opener's frame chain. Some LMSs (and the SCORM Cloud sandbox) launch
    //    the SCO in a NEW WINDOW, where window.parent === window, so the API is
    //    only reachable through window.opener. Guard for cross-origin access.
    if (api == null && window.opener != null && typeof window.opener !== "undefined") {
      try { api = findSCORMAPI(window.opener); } catch (e) { /* cross-origin */ }
    }

    // 3. Some players nest the opener under top.
    if (api == null && window.top && window.top.opener != null) {
      try { api = findSCORMAPI(window.top.opener); } catch (e) { /* cross-origin */ }
    }

    scormAPI = api;
    return scormAPI;
  }

  // SCORM Session Management
  function initializeSCORM() {
    var api = getSCORMAPI();
    if (api != null) {
      try {
        var result = api.Initialize("");
        if (result === "true") {
          console.log("[SCORM] Session initialized successfully");

          api.SetValue("cmi.completion_status", "incomplete");
          api.SetValue("cmi.success_status", "unknown");
          api.SetValue("cmi.exit", "");

          api.SetValue("cmi.comments_from_learner._count", "1");
          api.SetValue("cmi.comments_from_learner.0.comment",
                      "Accessible content with WCAG 2.2 AA features");
          api.SetValue("cmi.comments_from_learner.0.location", "accessibility");
          api.SetValue("cmi.comments_from_learner.0.timestamp", new Date().toISOString());

          api.Commit("");
          return true;
        }
      } catch (error) {
        console.error("[SCORM] Initialization error:", error);
      }
    } else {
      console.warn("[SCORM] API not found - standalone mode");
    }
    return false;
  }

  function terminateSCORM() {
    if (sessionTerminated) return; // guard against double Terminate (Finish + unload)
    var api = getSCORMAPI();
    if (api != null) {
      try {
        // Content-only packages complete on exit as before. When a scored quiz
        // is present, leave completion/success to reportScore() — an unsubmitted
        // quiz then stays incomplete/unknown, so no grade is recorded.
        if (!quizPresent) {
          api.SetValue("cmi.completion_status", "completed");
          api.SetValue("cmi.success_status", "passed");
        }
        api.SetValue("cmi.exit", "normal");

        if (window.scormSessionStart) {
          var sessionTime = Math.floor((Date.now() - window.scormSessionStart) / 1000);
          var timeString = "PT" + sessionTime + "S";
          api.SetValue("cmi.session_time", timeString);
        }

        api.Commit("");
        api.Terminate("");
        sessionTerminated = true;
        console.log("[SCORM] Session terminated successfully");
      } catch (error) {
        console.error("[SCORM] Termination error:", error);
      }
    }
  }

  // End the attempt and ask the LMS to return to its own UI. Support varies by
  // LMS (Blackboard/Rustici honour adl.nav.request in many configs); when it is
  // not honoured the learner still has the LMS's own close control, and the quiz
  // UI shows guidance to that effect.
  function requestExit() {
    var api = getSCORMAPI();
    if (api == null) return false;
    try {
      try { api.SetValue("adl.nav.request", "exitAll"); } catch (e) { /* unsupported */ }
      terminateSCORM();
      return true;
    } catch (error) {
      console.error("[SCORM] requestExit error:", error);
      return false;
    }
  }

  // Report a quiz score to the LMS gradebook. Order and commit discipline follow
  // the SCORM guidance that lands a score in Blackboard Ultra reliably:
  //   1. guard against overwriting a higher prior attempt on re-entry;
  //   2. set score BEFORE status (mastery evaluation reads the score);
  //   3. set completion + success status;
  //   4. Commit immediately (the single most common point of data loss).
  function reportScore(raw, min, max, passed) {
    var api = getSCORMAPI();
    if (api == null) return false;
    try {
      var lo = Number(min) || 0;
      var hi = Number(max);
      var newScaled = (hi > lo) ? (Number(raw) - lo) / (hi - lo) : 0;
      if (newScaled < -1) newScaled = -1;
      if (newScaled > 1) newScaled = 1;

      // No-overwrite guard: keep a better prior attempt (SCORM keeps one attempt
      // across sessions; re-entry could otherwise lower a higher score).
      var prior = parseFloat(api.GetValue("cmi.score.scaled"));
      if (!isNaN(prior) && prior >= newScaled) {
        return false;
      }

      api.SetValue("cmi.score.min", String(lo));
      api.SetValue("cmi.score.max", String(hi));
      api.SetValue("cmi.score.raw", String(raw));
      api.SetValue("cmi.score.scaled", String(Math.round(newScaled * 10000) / 10000));

      api.SetValue("cmi.completion_status", "completed");
      api.SetValue("cmi.success_status", passed ? "passed" : "failed");

      scoreReported = true;
      api.Commit("");
      return true;
    } catch (error) {
      console.error("[SCORM] reportScore error:", error);
      return false;
    }
  }

  function trackProgress(location, progress) {
    var api = getSCORMAPI();
    if (api != null) {
      try {
        api.SetValue("cmi.location", location);
        api.SetValue("cmi.progress_measure", (progress / 100).toString());
        api.Commit("");
      } catch (error) {
        console.error("[SCORM] Progress tracking error:", error);
      }
    }
  }

  window.scormSessionStart = Date.now();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSCORM);
  } else {
    initializeSCORM();
  }

  window.addEventListener('beforeunload', terminateSCORM);

  window.SCORM = {
    initialize: initializeSCORM,
    terminate: terminateSCORM,
    trackProgress: trackProgress,
    reportScore: reportScore,
    requestExit: requestExit,
    getAPI: getSCORMAPI,
    isAvailable: function() { return getSCORMAPI() != null; }
  };

})();`;
}
