// test-download-monitor.js
// Test suite for Download Monitor System

const TestDownloadMonitor = (function () {
  "use strict";

  function testDownloadMonitor() {
    const tests = {
      moduleExists: () => !!window.DownloadMonitor,

      hasCorrectAPI: () => {
        const requiredMethods = [
          "recordDownload",
          "getStatus",
          "getHistory",
          "test",
        ];
        return requiredMethods.every(
          (method) => typeof window.DownloadMonitor[method] === "function"
        );
      },

      canInitialise: () => {
        const status = window.DownloadMonitor.getStatus();
        return status.enabled && status.initialised;
      },

      canRecordDownload: () => {
        const historyBefore = window.DownloadMonitor.getHistory().length;
        window.DownloadMonitor.recordDownload("test-file.html", {
          type: "test",
          source: "test-suite",
        });
        const historyAfter = window.DownloadMonitor.getHistory().length;
        return historyAfter === historyBefore + 1;
      },

      canDetectDuplicates: () => {
        // Use a unique filename for this test to avoid interference
        const testFilename = `duplicate-test-${Date.now()}.html`;

        // Store a reference to check for console warnings
        let duplicateDetected = false;
        const originalWarn = console.warn;

        // Temporarily capture console.warn to detect duplicate warnings
        console.warn = function (...args) {
          if (
            args.some(
              (arg) =>
                typeof arg === "string" &&
                arg.includes("DUPLICATE DOWNLOAD DETECTED")
            )
          ) {
            duplicateDetected = true;
          }
          originalWarn.apply(console, args);
        };

        try {
          // Record two identical downloads quickly
          window.DownloadMonitor.recordDownload(testFilename, {
            type: "test",
            source: "test-suite-duplicate-check",
          });
          window.DownloadMonitor.recordDownload(testFilename, {
            type: "test",
            source: "test-suite-duplicate-check",
          });

          return duplicateDetected;
        } finally {
          // Restore original console.warn
          console.warn = originalWarn;
        }
      },

      hasModalIntegration: () => {
        return typeof UniversalModal !== "undefined";
      },

      internalTestsPassing: () => {
        const testResult = window.DownloadMonitor.test();
        return testResult.success;
      },
    };

    return TestUtilities.runTestSuite("DownloadMonitor", tests);
  }

  // Convenience functions for manual testing
  function simulateDuplicateDownload() {
    console.log("🧪 Simulating duplicate download...");
    window.DownloadMonitor.recordDownload("manual-test.html", {
      type: "manual-test",
      source: "manual-simulation",
    });
    setTimeout(() => {
      window.DownloadMonitor.recordDownload("manual-test.html", {
        type: "manual-test",
        source: "manual-simulation",
      });
    }, 100);
    console.log("✅ Duplicate simulation complete - check for debug modal");
  }

  function getMonitorStatus() {
    const status = window.DownloadMonitor.getStatus();
    console.log("📊 Download Monitor Status:");
    console.table(status);
    return status;
  }

  function getDownloadHistory() {
    const history = window.DownloadMonitor.getHistory();
    console.log("📋 Download History:");
    console.table(history);
    return history;
  }

  function clearMonitorHistory() {
    window.DownloadMonitor.clearHistory();
    console.log("🗑️ Download history cleared");
  }

  function disableMonitoring() {
    window.DownloadMonitor.setEnabled(false);
    console.log("⏸️ Download monitoring disabled");
  }

  function enableMonitoring() {
    window.DownloadMonitor.setEnabled(true);
    console.log("▶️ Download monitoring enabled");
  }

  return {
    testDownloadMonitor,
    simulateDuplicateDownload,
    getMonitorStatus,
    getDownloadHistory,
    clearMonitorHistory,
    disableMonitoring,
    enableMonitoring,
  };
})();

// Make testing functions globally available
window.testDownloadMonitor = TestDownloadMonitor.testDownloadMonitor;
window.simulateDuplicateDownload =
  TestDownloadMonitor.simulateDuplicateDownload;
window.getMonitorStatus = TestDownloadMonitor.getMonitorStatus;
window.getDownloadHistory = TestDownloadMonitor.getDownloadHistory;
window.clearMonitorHistory = TestDownloadMonitor.clearMonitorHistory;
window.disableMonitoring = TestDownloadMonitor.disableMonitoring;
window.enableMonitoring = TestDownloadMonitor.enableMonitoring;
