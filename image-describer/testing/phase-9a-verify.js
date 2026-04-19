// Phase 9A — Test Runner Framework Verification
// Paste into browser console after tools.html loads.
// Verifies that the test runner is loaded, its API works, and self-tests pass.
(async function phase9aVerify() {
    'use strict';

    var results = [];
    var pass = 0;
    var fail = 0;

    function check(label, actual, expected) {
        var ok = actual === expected;
        if (ok) { pass++; } else { fail++; }
        results.push(
            (ok ? 'PASS' : 'FAIL') + ' | ' + label +
            (ok ? '' : ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual))
        );
    }

    // ── 1. Global exists ─────────────────────────────────────────────────
    check('ImageDescriberTests global exists', typeof window.ImageDescriberTests, 'object');
    check('register method exists', typeof window.ImageDescriberTests.register, 'function');
    check('run method exists', typeof window.ImageDescriberTests.run, 'function');
    check('runAll method exists', typeof window.ImageDescriberTests.runAll, 'function');

    // ── 2. run() with non-existent module returns gracefully ─────────────
    var badResult = await window.ImageDescriberTests.run('nonexistent-module-xyz');
    check('run(nonexistent) returns object', typeof badResult, 'object');
    check('run(nonexistent) passed is 0', badResult.passed, 0);
    check('run(nonexistent) failed is 0', badResult.failed, 0);

    // ── 3. Self-test module is registered and passes ─────────────────────
    var selfTestResult = await window.ImageDescriberTests.run('self-test', { verbose: true });
    check('self-test passed count > 0', selfTestResult.passed > 0, true);
    check('self-test failed count is 0', selfTestResult.failed, 0);
    check('self-test duration is a number', typeof selfTestResult.duration, 'number');

    // ── 4. runAll() works and includes self-test ─────────────────────────
    var allResult = await window.ImageDescriberTests.runAll();
    check('runAll() passed >= self-test passed', allResult.passed >= selfTestResult.passed, true);
    check('runAll() modules >= 1', allResult.modules >= 1, true);
    check('runAll() failed is 0', allResult.failed, 0);

    // ── 5. Summary counts match ──────────────────────────────────────────
    // The self-test has 13 tests — verify the count is reasonable
    check('self-test ran at least 10 tests', selfTestResult.passed >= 10, true);

    // ── Summary ──────────────────────────────────────────────────────────
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(' Phase 9A — Test Runner Verification');
    console.log('════════════════════════════════════════');
    for (var i = 0; i < results.length; i++) {
        console.log(results[i]);
    }
    console.log('════════════════════════════════════════');
    console.log(fail === 0
        ? 'ALL PASSED (' + pass + '/' + pass + ')'
        : 'FAILURES: ' + fail + ' of ' + (pass + fail)
    );
    console.log('════════════════════════════════════════');

})();
