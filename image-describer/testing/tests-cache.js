// Phase 9B — Analysis Cache Tests
// Registers with the Phase 9A test runner.
// Run: ImageDescriberTests.run('cache', { verbose: true })

(function () {
    'use strict';

    if (typeof window.ImageDescriberTests === 'undefined') {
        console.warn('[tests-cache] Test runner not loaded — skipping registration.');
        return;
    }

    window.ImageDescriberTests.register('cache', {
        name: 'Analysis Cache (Phase 9B)',
        tests: {

            // ── Hashing ────────────────────────────────────────────────

            'Hash of same file content produces same SHA-256 every time': async function (assert) {
                var content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
                var blob1 = new Blob([content], { type: 'image/png' });
                var blob2 = new Blob([content], { type: 'image/png' });

                var hash1 = await window.ImageDescriberCache.hashFile(blob1);
                var hash2 = await window.ImageDescriberCache.hashFile(blob2);

                assert.assertEqual(hash1, hash2, 'Same content should produce identical hashes');
            },

            'Hash output is 64-character hex string': async function (assert) {
                var blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
                var hash = await window.ImageDescriberCache.hashFile(blob);

                assert.assertEqual(hash.length, 64, 'SHA-256 hex should be 64 characters');
                assert.assertTrue(/^[0-9a-f]{64}$/.test(hash), 'Should be lowercase hex only');
            },

            // ── Save / Load ────────────────────────────────────────────

            'Save then load returns identical record': async function (assert) {
                var cache = window.ImageDescriberCache;
                var testHash = 'test_save_load_' + Date.now();
                var testAnalysis = {
                    schemaVersion: 1,
                    profile: 'default',
                    ocr: { status: 'complete', items: [{ text: 'hello' }] },
                    colour: { status: 'complete', regions: [] },
                };

                try {
                    await cache.save(testHash, testAnalysis);
                    var loaded = await cache.load(testHash);

                    assert.assertNotNull(loaded, 'Loaded record should not be null');
                    assert.assertEqual(loaded.hash, testHash, 'Hash should match');
                    assert.assertEqual(loaded.analysis.profile, 'default', 'Profile should match');
                    assert.assertEqual(
                        loaded.analysis.ocr.items[0].text,
                        'hello',
                        'OCR item text should match'
                    );
                } finally {
                    await cache.delete(testHash);
                }
            },

            'load() for non-existent hash returns null (not error)': async function (assert) {
                var result = await window.ImageDescriberCache.load('nonexistent_hash_xyz_' + Date.now());
                assert.assertEqual(result, null, 'Should return null for missing hash');
            },

            // ── shouldReuseSlot ────────────────────────────────────────

            'shouldReuseSlot returns false for version mismatch': function (assert) {
                var slot = { version: 1, profile: 'default', completedAt: Date.now() };
                var result = window.ImageDescriberCache.shouldReuseSlot(slot, 2, 'default');
                assert.assertFalse(result, 'Version mismatch should return false');
            },

            'shouldReuseSlot returns false for profile mismatch': function (assert) {
                var slot = { version: 1, profile: 'default', completedAt: Date.now() };
                var result = window.ImageDescriberCache.shouldReuseSlot(slot, 1, 'chart');
                assert.assertFalse(result, 'Profile mismatch should return false');
            },

            'shouldReuseSlot returns true when version and profile match': function (assert) {
                var slot = { version: 1, profile: 'default', completedAt: Date.now() };
                var result = window.ImageDescriberCache.shouldReuseSlot(slot, 1, 'default');
                assert.assertTrue(result, 'Matching version and profile should return true');
            },

            // ── Eviction ───────────────────────────────────────────────

            'evictOldest removes records, oldest-accessed first': async function (assert) {
                var cache = window.ImageDescriberCache;
                var prefix = 'test_evict_' + Date.now() + '_';

                try {
                    // Save three records with staggered lastAccessedAt
                    var oldRecord = {
                        hash: prefix + 'old',
                        analysis: { schemaVersion: 1, profile: 'default' },
                        createdAt: 1000,
                        lastAccessedAt: 1000,
                        profile: 'default',
                        schemaVersion: 1,
                        slotVersions: {},
                        userEdits: null,
                        generations: [],
                    };
                    var midRecord = {
                        hash: prefix + 'mid',
                        analysis: { schemaVersion: 1, profile: 'default' },
                        createdAt: 2000,
                        lastAccessedAt: 2000,
                        profile: 'default',
                        schemaVersion: 1,
                        slotVersions: {},
                        userEdits: null,
                        generations: [],
                    };
                    var newRecord = {
                        hash: prefix + 'new',
                        analysis: { schemaVersion: 1, profile: 'default' },
                        createdAt: 3000,
                        lastAccessedAt: 3000,
                        profile: 'default',
                        schemaVersion: 1,
                        slotVersions: {},
                        userEdits: null,
                        generations: [],
                    };

                    await cache.save(prefix + 'old', oldRecord);
                    await cache.save(prefix + 'mid', midRecord);
                    await cache.save(prefix + 'new', newRecord);

                    // Evict enough to remove at least 1 record
                    var removed = await cache.evictOldest(1);
                    assert.assertTrue(removed >= 1, 'Should remove at least 1 record');

                    // The oldest should be gone
                    var oldLoaded = await cache.load(prefix + 'old');
                    assert.assertEqual(oldLoaded, null, 'Oldest record should be evicted');
                } finally {
                    // Clean up any remaining test records
                    await cache.delete(prefix + 'old');
                    await cache.delete(prefix + 'mid');
                    await cache.delete(prefix + 'new');
                }
            },

            // ── Clear ──────────────────────────────────────────────────

            'clear() removes all records': async function (assert) {
                var cache = window.ImageDescriberCache;
                var prefix = 'test_clear_' + Date.now() + '_';

                // Save a couple of test records
                await cache.save(prefix + 'a', { schemaVersion: 1, profile: 'default' });
                await cache.save(prefix + 'b', { schemaVersion: 1, profile: 'default' });

                // Verify they exist
                var beforeStats = await cache.getStats();
                assert.assertTrue(beforeStats.count >= 2, 'Should have at least 2 records before clear');

                await cache.clear();

                var afterStats = await cache.getStats();
                assert.assertEqual(afterStats.count, 0, 'Should have 0 records after clear');
                assert.assertEqual(afterStats.totalBytes, 0, 'Should have 0 bytes after clear');
            },

            // ── Stats ──────────────────────────────────────────────────

            'getStats() returns accurate count and size': async function (assert) {
                var cache = window.ImageDescriberCache;

                // Start clean
                await cache.clear();

                var emptyStats = await cache.getStats();
                assert.assertEqual(emptyStats.count, 0, 'Empty cache should have count 0');
                assert.assertEqual(emptyStats.totalBytes, 0, 'Empty cache should have 0 bytes');

                var testHash = 'test_stats_' + Date.now();
                try {
                    await cache.save(testHash, { schemaVersion: 1, profile: 'default', ocr: { status: 'complete' } });
                    var stats = await cache.getStats();
                    assert.assertEqual(stats.count, 1, 'Should have 1 record');
                    assert.assertTrue(stats.totalBytes > 0, 'Total bytes should be > 0');
                } finally {
                    await cache.clear();
                }
            },

        },
    });

})();
