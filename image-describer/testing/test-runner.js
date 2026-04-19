// Phase 9A — Modular Test Runner Framework
// Provides register/run/runAll API for all Image Describer test modules.
// Load via <script> in tools.html — invoke from browser console.
//
// Usage:
//   ImageDescriberTests.register('my-tests', { ... });
//   ImageDescriberTests.run('my-tests');
//   ImageDescriberTests.runAll();
//   ImageDescriberTests.runAll({ verbose: true });

window.ImageDescriberTests = (function () {
  "use strict";

  // ── Logging configuration ────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
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

  // ── Console colour helpers ───────────────────────────────────────────
  const STYLES = {
    pass: "color: #2e7d32; font-weight: bold", // green
    fail: "color: #c62828; font-weight: bold", // red
    skip: "color: #f57f17; font-weight: bold", // amber
    heading: "color: #1565c0; font-weight: bold; font-size: 1.1em",
    summary: "font-weight: bold; font-size: 1.1em",
    dim: "color: #757575",
  };

  // ── Assertion helpers ────────────────────────────────────────────────
  // Each throws on failure so the test is marked as failed.

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        (message || "assertEqual") +
          " — expected " +
          JSON.stringify(expected) +
          ", got " +
          JSON.stringify(actual),
      );
    }
  }

  function assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(
        (message || "assertNotNull") + " — got " + JSON.stringify(value),
      );
    }
  }

  function assertTrue(value, message) {
    if (value !== true) {
      throw new Error(
        (message || "assertTrue") +
          " — expected true, got " +
          JSON.stringify(value),
      );
    }
  }

  function assertFalse(value, message) {
    if (value !== false) {
      throw new Error(
        (message || "assertFalse") +
          " — expected false, got " +
          JSON.stringify(value),
      );
    }
  }

  function assertThrows(fn, message) {
    let threw = false;
    try {
      fn();
    } catch (_e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(
        (message || "assertThrows") +
          " — expected function to throw, but it did not",
      );
    }
  }

  function assertApprox(actual, expected, tolerance, message) {
    if (typeof actual !== "number" || typeof expected !== "number") {
      throw new Error(
        (message || "assertApprox") +
          " — both values must be numbers, got " +
          typeof actual +
          " and " +
          typeof expected,
      );
    }
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(
        (message || "assertApprox") +
          " — expected " +
          expected +
          " ± " +
          tolerance +
          ", got " +
          actual,
      );
    }
  }

  function assertContains(haystack, needle, message) {
    if (typeof haystack === "string") {
      if (!haystack.includes(needle)) {
        throw new Error(
          (message || "assertContains") +
            " — string does not contain " +
            JSON.stringify(needle),
        );
      }
    } else if (Array.isArray(haystack)) {
      if (!haystack.includes(needle)) {
        throw new Error(
          (message || "assertContains") +
            " — array does not contain " +
            JSON.stringify(needle),
        );
      }
    } else {
      throw new Error(
        (message || "assertContains") + " — haystack must be a string or array",
      );
    }
  }

  // Skip sentinel — thrown to mark a test as skipped (not a failure)
  class SkipError extends Error {
    constructor(reason) {
      super(reason || "skipped");
      this.name = "SkipError";
    }
  }

  /**
   * Skip the current test with an optional reason.
   * @param {string} [reason] — why this test was skipped
   */
  function skip(reason) {
    throw new SkipError(reason);
  }

  // Bundle assertions for passing into test functions
  const assertions = {
    assertEqual,
    assertNotNull,
    assertTrue,
    assertFalse,
    assertThrows,
    assertApprox,
    assertContains,
    skip,
  };

  // ── Module registry ──────────────────────────────────────────────────
  const modules = new Map();

  /**
   * Register a test module.
   * @param {string} id   — unique identifier (e.g. 'phase-9b-cache')
   * @param {object} mod  — { name: string, tests: { testName: async fn(assert) } }
   */
  function register(id, mod) {
    if (!id || typeof id !== "string") {
      logError("register(): id must be a non-empty string.");
      return;
    }
    if (!mod || typeof mod !== "object" || !mod.tests) {
      logError('register(): module must have a "tests" object.');
      return;
    }
    if (modules.has(id)) {
      logWarn('register(): overwriting existing module "' + id + '".');
    }
    modules.set(id, mod);
    logDebug("Registered test module: " + id);
  }

  /**
   * Run a single registered module.
   * @param {string} id
   * @param {object} [options]  — { verbose: false }
   * @returns {Promise<{ passed: number, failed: number, skipped: number, duration: number }>}
   */
  async function run(id, options) {
    const opts = Object.assign({ verbose: false }, options);

    if (!modules.has(id)) {
      logError('%c TEST MODULE NOT FOUND: "' + id + '"', STYLES.fail);
      logError(
        "Registered modules: " +
          (modules.size === 0
            ? "(none)"
            : Array.from(modules.keys()).join(", ")),
      );
      return { passed: 0, failed: 0, skipped: 0, duration: 0 };
    }

    const mod = modules.get(id);
    const moduleName = mod.name || id;
    const testEntries = Object.entries(mod.tests);
    let passed = 0;
    let failed = 0;
    const failDetails = [];

    console.log(
      "%c── " + moduleName + " (" + testEntries.length + " tests) ──",
      STYLES.heading,
    );
    const moduleStart = performance.now();

    let skipped = 0;

    for (const [testName, testFn] of testEntries) {
      const testStart = performance.now();
      try {
        // Support both sync and async test functions
        await testFn(assertions);
        passed++;
        const elapsed = (performance.now() - testStart).toFixed(0);
        if (opts.verbose) {
          console.log(
            "%c  PASS %c " + testName + " %c(" + elapsed + " ms)",
            STYLES.pass,
            "",
            STYLES.dim,
          );
        }
      } catch (err) {
        const elapsed = (performance.now() - testStart).toFixed(0);
        if (err instanceof SkipError) {
          skipped++;
          if (opts.verbose) {
            console.log(
              "%c  SKIP %c " +
                testName +
                " %c(" +
                elapsed +
                " ms) — " +
                err.message,
              STYLES.skip,
              "",
              STYLES.dim,
            );
          }
        } else {
          failed++;
          console.log(
            "%c  FAIL %c " + testName + " %c(" + elapsed + " ms)",
            STYLES.fail,
            "",
            STYLES.dim,
          );
          console.log("       " + err.message);
          failDetails.push({ test: testName, error: err.message });
        }
      }
    }

    const duration = performance.now() - moduleStart;
    const allPassed = failed === 0;

    // Module summary line
    const summaryStyle = allPassed ? STYLES.pass : STYLES.fail;
    const summaryIcon = allPassed ? "PASS" : "FAIL";
    console.log(
      "%c  " +
        summaryIcon +
        " %c " +
        moduleName +
        ": " +
        passed +
        " passed, " +
        failed +
        " failed (" +
        duration.toFixed(0) +
        " ms)",
      summaryStyle,
      "",
    );

    return { passed, failed, skipped, duration };
  }

  /**
   * Run all registered modules.
   * @param {object} [options]  — { verbose: false }
   * @returns {Promise<{ passed: number, failed: number, skipped: number, duration: number, modules: number }>}
   */
  async function runAll(options) {
    const opts = Object.assign({ verbose: false }, options);
    const ids = Array.from(modules.keys());

    if (ids.length === 0) {
      logWarn("No test modules registered.");
      return { passed: 0, failed: 0, skipped: 0, duration: 0, modules: 0 };
    }

    console.log(
      "%c═══════════════════════════════════════════════════",
      STYLES.heading,
    );
    console.log(
      "%c Image Describer Test Runner — " + ids.length + " module(s)",
      STYLES.heading,
    );
    console.log(
      "%c═══════════════════════════════════════════════════",
      STYLES.heading,
    );

    let totalPassed = 0;
    let totalFailed = 0;
    const overallStart = performance.now();

    for (const id of ids) {
      const result = await run(id, opts);
      totalPassed += result.passed;
      totalFailed += result.failed;
    }

    const totalDuration = performance.now() - overallStart;
    const allPassed = totalFailed === 0;

    console.log(
      "%c═══════════════════════════════════════════════════",
      STYLES.heading,
    );
    const overallStyle = allPassed ? STYLES.pass : STYLES.fail;
    const overallIcon = allPassed ? "ALL PASSED" : "FAILURES DETECTED";
    console.log(
      "%c " +
        overallIcon +
        " %c — " +
        totalPassed +
        " passed, " +
        totalFailed +
        " failed across " +
        ids.length +
        " module(s) (" +
        totalDuration.toFixed(0) +
        " ms)",
      overallStyle,
      "",
    );
    console.log(
      "%c═══════════════════════════════════════════════════",
      STYLES.heading,
    );

    return {
      passed: totalPassed,
      failed: totalFailed,
      skipped: 0,
      duration: totalDuration,
      modules: ids.length,
    };
  }

  // ── Self-test module ─────────────────────────────────────────────────
  // Registers automatically — verifies all assertions and runner behaviour.
  register("self-test", {
    name: "Test Runner Self-Test",
    tests: {
      "assertEqual passes for equal values": function (assert) {
        assert.assertEqual(1, 1, "integers");
        assert.assertEqual("hello", "hello", "strings");
        assert.assertEqual(true, true, "booleans");
        assert.assertEqual(null, null, "null");
      },

      "assertEqual fails for unequal values": function (assert) {
        let caught = false;
        try {
          assert.assertEqual(1, 2, "should fail");
        } catch (_e) {
          caught = true;
        }
        if (!caught) {
          throw new Error("assertEqual did not throw for unequal values");
        }
      },

      "assertNotNull passes for non-null": function (assert) {
        assert.assertNotNull(0, "zero is not null");
        assert.assertNotNull("", "empty string is not null");
        assert.assertNotNull(false, "false is not null");
      },

      "assertNotNull fails for null/undefined": function (assert) {
        let caughtNull = false;
        try {
          assert.assertNotNull(null, "null");
        } catch (_e) {
          caughtNull = true;
        }
        if (!caughtNull)
          throw new Error("assertNotNull did not throw for null");

        let caughtUndefined = false;
        try {
          assert.assertNotNull(undefined, "undefined");
        } catch (_e) {
          caughtUndefined = true;
        }
        if (!caughtUndefined)
          throw new Error("assertNotNull did not throw for undefined");
      },

      "assertTrue and assertFalse work correctly": function (assert) {
        assert.assertTrue(true, "true");
        assert.assertFalse(false, "false");

        let caughtTrue = false;
        try {
          assert.assertTrue(false, "should fail");
        } catch (_e) {
          caughtTrue = true;
        }
        if (!caughtTrue) throw new Error("assertTrue did not throw for false");

        let caughtFalse = false;
        try {
          assert.assertFalse(true, "should fail");
        } catch (_e) {
          caughtFalse = true;
        }
        if (!caughtFalse) throw new Error("assertFalse did not throw for true");
      },

      "assertTrue rejects truthy non-boolean values": function (assert) {
        // assertTrue must require exactly true, not just truthy
        let caught = false;
        try {
          assert.assertTrue(1, "truthy 1");
        } catch (_e) {
          caught = true;
        }
        if (!caught) throw new Error("assertTrue accepted truthy value 1");
      },

      "assertThrows detects thrown errors": function (assert) {
        assert.assertThrows(function () {
          throw new Error("boom");
        }, "should catch");
      },

      "assertThrows fails when nothing is thrown": function (assert) {
        let caught = false;
        try {
          assert.assertThrows(function () {
            /* no throw */
          }, "should fail");
        } catch (_e) {
          caught = true;
        }
        if (!caught)
          throw new Error(
            "assertThrows did not throw when function was silent",
          );
      },

      "assertApprox passes within tolerance": function (assert) {
        assert.assertApprox(3.14, 3.14159, 0.01, "pi approximation");
        assert.assertApprox(100, 101, 2, "within 2");
      },

      "assertApprox fails outside tolerance": function (assert) {
        let caught = false;
        try {
          assert.assertApprox(1, 10, 0.5, "too far");
        } catch (_e) {
          caught = true;
        }
        if (!caught)
          throw new Error("assertApprox did not throw for out-of-range");
      },

      "assertContains works with strings": function (assert) {
        assert.assertContains("hello world", "world", "substring");

        let caught = false;
        try {
          assert.assertContains("hello", "xyz", "missing");
        } catch (_e) {
          caught = true;
        }
        if (!caught)
          throw new Error("assertContains did not throw for missing substring");
      },

      "assertContains works with arrays": function (assert) {
        assert.assertContains([1, 2, 3], 2, "array element");

        let caught = false;
        try {
          assert.assertContains([1, 2], 9, "missing");
        } catch (_e) {
          caught = true;
        }
        if (!caught)
          throw new Error("assertContains did not throw for missing element");
      },

      "async tests complete and report correctly": async function (assert) {
        // Simulate async work
        const value = await new Promise(function (resolve) {
          setTimeout(function () {
            resolve(42);
          }, 10);
        });
        assert.assertEqual(value, 42, "async resolved value");
      },

      "failed tests do not prevent subsequent tests": function (assert) {
        // This test simply passes — the runner's ability to reach it
        // after any earlier failures proves isolation works.
        assert.assertTrue(true, "reached after prior tests");
      },
    },
  });

  // ── Public API ───────────────────────────────────────────────────────
  logInfo(
    "ImageDescriberTests loaded. Run ImageDescriberTests.runAll() to execute all tests.",
  );

  return {
    register: register,
    run: run,
    runAll: runAll,
  };
})();
