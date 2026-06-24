// music-log.js
// Shared logger for the Accessible Music proof of concept.
// Exposed as window.MusicLog so every music-poc file logs through one place
// rather than calling console directly. The logging internals below are the
// project's canonical block, kept byte-identical on purpose.

const MusicLog = (function () {
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

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(`[MusicPoc] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(`[MusicPoc] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(`[MusicPoc] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(`[MusicPoc] ${message}`, ...args);
  }

  // Self-test: verifies the logging surface and the visibility decisions at the
  // default configuration (all flags false, level WARN). Builds a plain results
  // object, prints it as a table, and also returns it for programmatic checks.
  function selfTest() {
    const results = {
      hasLogError: typeof logError === "function",
      hasLogWarn: typeof logWarn === "function",
      hasLogInfo: typeof logInfo === "function",
      hasLogDebug: typeof logDebug === "function",
      levelsShape:
        LOG_LEVELS.ERROR === 0 &&
        LOG_LEVELS.WARN === 1 &&
        LOG_LEVELS.INFO === 2 &&
        LOG_LEVELS.DEBUG === 3,
      errorVisibleAtDefault: shouldLog(LOG_LEVELS.ERROR) === true,
      warnVisibleAtDefault: shouldLog(LOG_LEVELS.WARN) === true,
      infoHiddenAtDefault: shouldLog(LOG_LEVELS.INFO) === false,
      debugHiddenAtDefault: shouldLog(LOG_LEVELS.DEBUG) === false,
    };
    console.table(results);
    return results;
  }

  // Initialisation marker. Silent at the WARN default by design; it only
  // surfaces if a developer raises the level or flips ENABLE_ALL_LOGGING.
  logInfo("Logging initialised (default level WARN)");

  return { LOG_LEVELS, shouldLog, logError, logWarn, logInfo, logDebug, selfTest };
})();

window.MusicLog = MusicLog;
