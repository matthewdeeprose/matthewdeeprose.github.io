// Phase 9B — Analysis Cache + File Hashing Verification
// Paste into browser console after tools.html loads.
// Verifies cache module, test registration, and controller integration.
(async function phase9bVerify() {
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

    // ── 1. Cache module exists ──────────────────────────────────────────
    check('ImageDescriberCache global exists', typeof window.ImageDescriberCache, 'object');
    check('hashFile method exists', typeof window.ImageDescriberCache.hashFile, 'function');
    check('save method exists', typeof window.ImageDescriberCache.save, 'function');
    check('load method exists', typeof window.ImageDescriberCache.load, 'function');
    check('updateSlot method exists', typeof window.ImageDescriberCache.updateSlot, 'function');
    check('saveUserEdits method exists', typeof window.ImageDescriberCache.saveUserEdits, 'function');
    check('saveGeneration method exists', typeof window.ImageDescriberCache.saveGeneration, 'function');
    check('delete method exists', typeof window.ImageDescriberCache.delete, 'function');
    check('list method exists', typeof window.ImageDescriberCache.list, 'function');
    check('getStats method exists', typeof window.ImageDescriberCache.getStats, 'function');
    check('evictOldest method exists', typeof window.ImageDescriberCache.evictOldest, 'function');
    check('shouldReuseSlot method exists', typeof window.ImageDescriberCache.shouldReuseSlot, 'function');
    check('clear method exists', typeof window.ImageDescriberCache.clear, 'function');

    // ── 2. Hash smoke test ──────────────────────────────────────────────
    try {
        var blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
        var hash = await window.ImageDescriberCache.hashFile(blob);
        check('hashFile returns a string', typeof hash, 'string');
        check('hashFile returns 64-char hex', hash.length, 64);
    } catch (err) {
        check('hashFile does not throw', true, false);
    }

    // ── 3. Save/load round-trip ─────────────────────────────────────────
    var testHash = 'verify_9b_' + Date.now();
    try {
        await window.ImageDescriberCache.save(testHash, { schemaVersion: 1, profile: 'test' });
        var loaded = await window.ImageDescriberCache.load(testHash);
        check('save/load round-trip returns record', loaded !== null, true);
        check('loaded record has correct hash', loaded && loaded.hash, testHash);
        await window.ImageDescriberCache.delete(testHash);
        var deleted = await window.ImageDescriberCache.load(testHash);
        check('delete removes record', deleted, null);
    } catch (err) {
        check('save/load/delete does not throw', true, false);
    }

    // ── 4. Tests registered with runner ─────────────────────────────────
    if (typeof window.ImageDescriberTests !== 'undefined') {
        var cacheResult = await window.ImageDescriberTests.run('cache', { verbose: true });
        check('cache tests registered and ran', cacheResult.passed > 0, true);
        check('cache tests all passed', cacheResult.failed, 0);
        check('cache tests count >= 10', cacheResult.passed >= 10, true);
    } else {
        check('test runner loaded', false, true);
    }

    // ── 5. Controller integration ───────────────────────────────────────
    if (typeof window.ImageDescriberController !== 'undefined') {
        check('controller has currentFileHash property', 'currentFileHash' in window.ImageDescriberController, true);
        check('controller has _cacheHit property', '_cacheHit' in window.ImageDescriberController, true);
    } else {
        check('controller loaded', false, true);
    }

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(' Phase 9B — Cache Verification');
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
