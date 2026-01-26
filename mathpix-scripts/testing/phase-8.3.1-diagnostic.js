/**
 * Phase 8.3.1: Total Downloader Audit - Resume Round-Trip Verification
 * 
 * Purpose: Verify that ZIP archives created from Resume Mode can be resumed correctly
 * 
 * Tests:
 * 1. Component availability and bridge status
 * 2. Edit accumulation across sessions
 * 3. Converted file collection
 * 4. Full round-trip workflow
 */

// ============================================================================
// DIAGNOSTIC TESTS
// ============================================================================

/**
 * Enhanced Phase 8.3.1 Diagnostic
 * Properly checks all components including the class-based Total Downloader
 */
window.phase831Diagnostic = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 8.3.1 COMPREHENSIVE DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    components: {},
    bridges: {},
    issues: [],
    recommendations: []
  };

  // -------------------------------------------------------------------------
  // 1. TOTAL DOWNLOADER STATUS
  // -------------------------------------------------------------------------
  console.log('1. TOTAL DOWNLOADER STATUS');
  console.log('-'.repeat(40));
  
  const tdAvailable = typeof window.MathPixTotalDownloader === 'function';
  const jsZipAvailable = typeof JSZip !== 'undefined';
  
  let tdInstance = null;
  let tdInitSuccess = false;
  let tdMethods = [];
  
  if (tdAvailable && jsZipAvailable) {
    try {
      tdInstance = new window.MathPixTotalDownloader(null);
      tdInitSuccess = tdInstance.initialize();
      tdMethods = [
        { name: 'collectSourceFiles', exists: typeof tdInstance.collectSourceFiles === 'function' },
        { name: 'collectResultFiles', exists: typeof tdInstance.collectResultFiles === 'function' },
        { name: 'collectMMDEdits', exists: typeof tdInstance.collectMMDEdits === 'function' },
        { name: 'collectConvertedFiles', exists: typeof tdInstance.collectConvertedFiles === 'function' },
        { name: 'createArchive', exists: typeof tdInstance.createArchive === 'function' },
        { name: 'generateEditsFilename', exists: typeof tdInstance.generateEditsFilename === 'function' }
      ];
    } catch (e) {
      console.error('  ✗ Failed to instantiate:', e.message);
      results.issues.push(`Total Downloader instantiation failed: ${e.message}`);
    }
  }

  results.components.totalDownloader = {
    classAvailable: tdAvailable,
    jsZipAvailable: jsZipAvailable,
    instanceCreated: !!tdInstance,
    initialized: tdInitSuccess,
    methods: tdMethods
  };

  console.log(`  Class available: ${tdAvailable ? '✓' : '✗'}`);
  console.log(`  JSZip available: ${jsZipAvailable ? '✓' : '✗'}`);
  console.log(`  Instance created: ${tdInstance ? '✓' : '✗'}`);
  console.log(`  Initialized: ${tdInitSuccess ? '✓' : '✗'}`);
  if (tdMethods.length > 0) {
    console.log('  Critical methods:');
    tdMethods.forEach(m => {
      console.log(`    - ${m.name}: ${m.exists ? '✓' : '✗'}`);
      if (!m.exists) {
        results.issues.push(`Total Downloader missing method: ${m.name}`);
      }
    });
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 2. MMD PERSISTENCE STATUS
  // -------------------------------------------------------------------------
  console.log('2. MMD PERSISTENCE STATUS');
  console.log('-'.repeat(40));
  
  const persistenceFn = window.getMathPixMMDPersistence;
  const persistence = persistenceFn?.();
  
  results.components.mmdPersistence = {
    functionExists: typeof persistenceFn === 'function',
    instanceAvailable: !!persistence,
    hasSession: persistence?.hasSession?.() ?? false,
    sessionData: null
  };

  if (persistence?.hasSession?.()) {
    const session = persistence.session || {};
    results.components.mmdPersistence.sessionData = {
      hasOriginal: !!session.original,
      hasCurrent: !!session.current,
      sourceFileName: session.sourceFileName || '(not set)',
      isModified: session.current !== session.original,
      originalLength: session.original?.length || 0,
      currentLength: session.current?.length || 0
    };
  }

  console.log(`  Function exists: ${results.components.mmdPersistence.functionExists ? '✓' : '✗'}`);
  console.log(`  Instance available: ${results.components.mmdPersistence.instanceAvailable ? '✓' : '✗'}`);
  console.log(`  Has session: ${results.components.mmdPersistence.hasSession ? '✓' : '✗'}`);
  if (results.components.mmdPersistence.sessionData) {
    const sd = results.components.mmdPersistence.sessionData;
    console.log(`  Session details:`);
    console.log(`    - Source: ${sd.sourceFileName}`);
    console.log(`    - Original: ${sd.originalLength} chars`);
    console.log(`    - Current: ${sd.currentLength} chars`);
    console.log(`    - Modified: ${sd.isModified ? '✓ YES' : '✗ NO'}`);
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 3. SESSION RESTORER STATUS
  // -------------------------------------------------------------------------
  console.log('3. SESSION RESTORER STATUS');
  console.log('-'.repeat(40));
  
  const restorerFn = window.getMathPixSessionRestorer;
  const restorer = restorerFn?.();
  
  results.components.sessionRestorer = {
    functionExists: typeof restorerFn === 'function',
    instanceAvailable: !!restorer,
    isInitialised: restorer?.isInitialised ?? false,
    hasRestoredSession: !!restorer?.restoredSession,
    restoredSessionData: null
  };

  if (restorer?.restoredSession) {
    const rs = restorer.restoredSession;
    results.components.sessionRestorer.restoredSessionData = {
      hasOriginalMMD: !!rs.originalMMD,
      hasCurrentMMD: !!rs.currentMMD,
      hasSourceFilename: !!rs.source?.filename,
      sourceFilename: rs.source?.filename || '(not set)',
      hasLinesData: !!rs.linesData,
      isPDF: rs.isPDF ?? false,
      hasConversionResults: !!restorer.conversionResults && restorer.conversionResults.size > 0,
      conversionCount: restorer.conversionResults?.size || 0
    };
  }

  console.log(`  Function exists: ${results.components.sessionRestorer.functionExists ? '✓' : '✗'}`);
  console.log(`  Instance available: ${results.components.sessionRestorer.instanceAvailable ? '✓' : '✗'}`);
  console.log(`  Initialised: ${results.components.sessionRestorer.isInitialised ? '✓' : '✗'}`);
  console.log(`  Has restored session: ${results.components.sessionRestorer.hasRestoredSession ? '✓' : '✗'}`);
  if (results.components.sessionRestorer.restoredSessionData) {
    const rsd = results.components.sessionRestorer.restoredSessionData;
    console.log(`  Restored session details:`);
    console.log(`    - Source: ${rsd.sourceFilename}`);
    console.log(`    - isPDF: ${rsd.isPDF ? '✓' : '✗'}`);
    console.log(`    - Has lines data: ${rsd.hasLinesData ? '✓' : '✗'}`);
    console.log(`    - Conversions: ${rsd.conversionCount}`);
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 4. CONVERT UI STATUS
  // -------------------------------------------------------------------------
  console.log('4. CONVERT UI STATUS');
  console.log('-'.repeat(40));
  
  const convertUIFn = window.getMathPixConvertUI;
  const convertUI = convertUIFn?.();
  
  results.components.convertUI = {
    functionExists: typeof convertUIFn === 'function',
    instanceAvailable: !!convertUI,
    hasGetCompletedDownloads: typeof convertUI?.getCompletedDownloads === 'function',
    hasGetCompletedDownloadsWithFilenames: typeof convertUI?.getCompletedDownloadsWithFilenames === 'function',
    completedDownloadsCount: convertUI?.completedDownloads?.size || 0,
    baseFilename: convertUI?.baseFilename || '(not set)'
  };

  console.log(`  Function exists: ${results.components.convertUI.functionExists ? '✓' : '✗'}`);
  console.log(`  Instance available: ${results.components.convertUI.instanceAvailable ? '✓' : '✗'}`);
  console.log(`  getCompletedDownloads: ${results.components.convertUI.hasGetCompletedDownloads ? '✓' : '✗'}`);
  console.log(`  getCompletedDownloadsWithFilenames: ${results.components.convertUI.hasGetCompletedDownloadsWithFilenames ? '✓' : '✗'}`);
  console.log(`  Completed downloads: ${results.components.convertUI.completedDownloadsCount}`);
  console.log(`  Base filename: ${results.components.convertUI.baseFilename}`);
  console.log('');

  // -------------------------------------------------------------------------
  // 5. BRIDGE ANALYSIS
  // -------------------------------------------------------------------------
  console.log('5. BRIDGE ANALYSIS');
  console.log('-'.repeat(40));

  // Check if Session Restorer can access Total Downloader
  const canAccessTD = restorer && typeof window.MathPixTotalDownloader === 'function';
  
  // Check if Total Downloader can access Persistence
  const canAccessPersistence = tdInstance && typeof window.getMathPixMMDPersistence === 'function';
  
  // Check if Total Downloader can access ConvertUI
  const canAccessConvertUI = tdInstance && typeof window.getMathPixConvertUI === 'function';

  results.bridges = {
    sessionRestorerToTotalDownloader: canAccessTD,
    totalDownloaderToPersistence: canAccessPersistence,
    totalDownloaderToConvertUI: canAccessConvertUI,
    allBridgesWorking: canAccessTD && canAccessPersistence && canAccessConvertUI
  };

  console.log(`  Restorer → TotalDownloader: ${canAccessTD ? '✓' : '✗'}`);
  console.log(`  TotalDownloader → Persistence: ${canAccessPersistence ? '✓' : '✗'}`);
  console.log(`  TotalDownloader → ConvertUI: ${canAccessConvertUI ? '✓' : '✗'}`);
  console.log(`  All bridges working: ${results.bridges.allBridgesWorking ? '✓' : '✗'}`);
  console.log('');

  // -------------------------------------------------------------------------
  // 6. EDIT COLLECTION SIMULATION
  // -------------------------------------------------------------------------
  console.log('6. EDIT COLLECTION SIMULATION');
  console.log('-'.repeat(40));
  
  if (tdInstance && persistence) {
    try {
      // Create mock folder
      const mockFolder = {
        files: {},
        file: function(name, content) {
          this.files[name] = { name, size: content?.length || 0 };
          return this;
        }
      };

      const editsResult = tdInstance.collectMMDEdits(mockFolder);
      results.editCollectionTest = {
        success: true,
        hasEdits: editsResult.hasEdits,
        filename: editsResult.filename,
        characterDifference: editsResult.characterDifference,
        errors: editsResult.errors
      };

      console.log(`  Edit collection test: ✓`);
      console.log(`    - Has edits: ${editsResult.hasEdits ? '✓' : '✗'}`);
      if (editsResult.hasEdits) {
        console.log(`    - Filename: ${editsResult.filename}`);
        console.log(`    - Char diff: ${editsResult.characterDifference}`);
      }
    } catch (e) {
      results.editCollectionTest = { success: false, error: e.message };
      console.error(`  Edit collection test: ✗ ${e.message}`);
      results.issues.push(`Edit collection test failed: ${e.message}`);
    }
  } else {
    console.log('  ✗ Cannot test - missing Total Downloader or Persistence');
    results.issues.push('Cannot test edit collection - components unavailable');
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 7. SUMMARY
  // -------------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  if (results.issues.length === 0) {
    console.log('✓ All components operational - ready for round-trip testing');
    results.recommendations.push('Ready for round-trip verification tests');
  } else {
    console.log('⚠️ Issues found:');
    results.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  console.log('\n📋 Full results object available in return value');
  console.log('');
  
  return results;
};

// ============================================================================
// ROUND-TRIP VERIFICATION TESTS
// ============================================================================

/**
 * Test Round-Trip Workflow
 * Simulates: Create ZIP → Resume → Edit → Create Updated ZIP → Verify
 */
window.testPhase831RoundTrip = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 8.3.1: ROUND-TRIP VERIFICATION TEST');
  console.log('='.repeat(60));
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const test = (name, condition, details = '') => {
    const passed = !!condition;
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      console.log(`✓ ${name}${details ? ': ' + details : ''}`);
    } else {
      results.failed++;
      console.log(`✗ ${name}${details ? ': ' + details : ''}`);
    }
    return passed;
  };

  // -------------------------------------------------------------------------
  // TEST 1: Total Downloader Instantiation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Total Downloader Instantiation ---');
  
  let downloader = null;
  try {
    downloader = new window.MathPixTotalDownloader(null);
    const initResult = downloader.initialize();
    test('Total Downloader created', !!downloader);
    test('Total Downloader initialized', initResult);
  } catch (e) {
    test('Total Downloader created', false, e.message);
  }

  if (!downloader) {
    console.log('\n⛔ Cannot proceed - Total Downloader unavailable');
    return results;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Persistence Bridge
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Persistence Bridge ---');
  
  const persistence = window.getMathPixMMDPersistence?.();
  test('Persistence getter exists', typeof window.getMathPixMMDPersistence === 'function');
  test('Persistence instance available', !!persistence);
  
  if (persistence) {
    test('Persistence has session method', typeof persistence.hasSession === 'function');
    test('Persistence session state', persistence.hasSession?.() ?? false, 
         persistence.hasSession?.() ? 'Active session' : 'No session');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Edit Collection Flow
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Edit Collection Flow ---');
  
  // Create mock folder for testing
  const mockEditsFolder = {
    files: new Map(),
    file(name, content) {
      this.files.set(name, { name, content, size: content?.length || 0 });
      return this;
    }
  };

  try {
    const editsResult = downloader.collectMMDEdits(mockEditsFolder);
    test('collectMMDEdits executed', true);
    test('Edit collection result valid', typeof editsResult === 'object');
    
    if (persistence?.hasSession?.()) {
      const session = persistence.session;
      const hasModifications = session?.current !== session?.original;
      test('Session modification detected', editsResult.hasEdits === hasModifications,
           hasModifications ? 'Has modifications' : 'No modifications');
      
      if (editsResult.hasEdits) {
        test('Edit filename generated', !!editsResult.filename, editsResult.filename);
        test('File added to folder', mockEditsFolder.files.size > 0);
      }
    }
  } catch (e) {
    test('collectMMDEdits executed', false, e.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Convert Collection Flow
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Convert Collection Flow ---');
  
  const convertUI = window.getMathPixConvertUI?.();
  test('ConvertUI getter exists', typeof window.getMathPixConvertUI === 'function');
  test('ConvertUI instance available', !!convertUI);
  
  const mockConvertFolder = {
    files: new Map(),
    file(name, content) {
      this.files.set(name, { name, content, size: content?.size || content?.length || 0 });
      return this;
    }
  };

  try {
    const convertResult = downloader.collectConvertedFiles(mockConvertFolder);
    test('collectConvertedFiles executed', true);
    test('Convert collection result valid', typeof convertResult === 'object');
    
    if (convertUI?.completedDownloads?.size > 0) {
      test('Converted files collected', convertResult.fileCount > 0,
           `${convertResult.fileCount} files`);
    } else {
      test('No conversions to collect', convertResult.fileCount === 0, 'Expected behaviour');
    }
  } catch (e) {
    test('collectConvertedFiles executed', false, e.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Session Restorer Bridge Setup
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Session Restorer Bridge Setup ---');
  
  const restorer = window.getMathPixSessionRestorer?.();
  test('SessionRestorer getter exists', typeof window.getMathPixSessionRestorer === 'function');
  test('SessionRestorer instance available', !!restorer);
  
  if (restorer) {
    test('SessionRestorer initialised', restorer.isInitialised);
    test('SessionRestorer has restored session', !!restorer.restoredSession);
    
    // Test bridge setup methods exist
    test('setupPersistenceForEdits exists', typeof restorer.setupPersistenceForEdits === 'function');
    test('setupConvertUIForDownload exists', typeof restorer.setupConvertUIForDownload === 'function');
    test('downloadUpdatedZIP exists', typeof restorer.downloadUpdatedZIP === 'function');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${results.passed}/${results.passed + results.failed} tests passed`);
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('✓ All round-trip verification tests passed!');
    console.log('\nNext steps:');
    console.log('1. Make an edit to MMD content');
    console.log('2. Run a conversion (e.g., to DOCX)');
    console.log('3. Click "Download Updated ZIP"');
    console.log('4. Resume with the new ZIP');
    console.log('5. Verify all edits and conversions are present');
  } else {
    console.log('⚠️ Some tests failed - review issues above');
  }

  return results;
};

// ============================================================================
// DATA FLOW VERIFICATION
// ============================================================================

/**
 * Verify data flow between components
 */
window.verifyPhase831DataFlow = function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 8.3.1: DATA FLOW VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Check what data Session Restorer has
  console.log('1. Session Restorer Current State:');
  const restorer = window.getMathPixSessionRestorer?.();
  if (restorer?.restoredSession) {
    const rs = restorer.restoredSession;
    console.log(`   Source: ${rs.source?.filename || 'Unknown'}`);
    console.log(`   Original MMD: ${rs.originalMMD?.length || 0} chars`);
    console.log(`   Current MMD: ${rs.currentMMD?.length || 0} chars`);
    console.log(`   Modified: ${rs.currentMMD !== rs.originalMMD ? 'YES' : 'NO'}`);
    console.log(`   Lines data: ${rs.linesData ? 'Present' : 'Missing'}`);
    console.log(`   Conversions: ${restorer.conversionResults?.size || 0}`);
  } else {
    console.log('   No restored session active');
  }

  // Step 2: Check what data Persistence module has
  console.log('\n2. Persistence Module State:');
  const persistence = window.getMathPixMMDPersistence?.();
  if (persistence?.hasSession?.()) {
    const session = persistence.session;
    console.log(`   Source: ${session.sourceFileName || 'Unknown'}`);
    console.log(`   Original: ${session.original?.length || 0} chars`);
    console.log(`   Current: ${session.current?.length || 0} chars`);
    console.log(`   Modified: ${session.current !== session.original ? 'YES' : 'NO'}`);
    console.log(`   Last modified: ${session.lastModified ? new Date(session.lastModified).toISOString() : 'N/A'}`);
  } else {
    console.log('   No persistence session active');
  }

  // Step 3: Check what data ConvertUI has
  console.log('\n3. ConvertUI State:');
  const convertUI = window.getMathPixConvertUI?.();
  if (convertUI) {
    console.log(`   Base filename: ${convertUI.baseFilename || 'Not set'}`);
    console.log(`   Completed downloads: ${convertUI.completedDownloads?.size || 0}`);
    if (convertUI.completedDownloads?.size > 0) {
      convertUI.completedDownloads.forEach((blob, format) => {
        console.log(`     - ${format}: ${blob.size} bytes`);
      });
    }
  } else {
    console.log('   ConvertUI not available');
  }

  // Step 4: Check synchronisation
  console.log('\n4. Data Synchronisation Check:');
  if (restorer?.restoredSession && persistence?.hasSession?.()) {
    const rsOriginal = restorer.restoredSession.originalMMD;
    const psOriginal = persistence.session.original;
    const originalsMatch = rsOriginal === psOriginal;
    console.log(`   Original MMD matches: ${originalsMatch ? '✓ YES' : '✗ NO'}`);
    
    if (!originalsMatch) {
      console.log(`     Restorer: ${rsOriginal?.length} chars`);
      console.log(`     Persistence: ${psOriginal?.length} chars`);
    }
    
    const rsCurrent = restorer.getCurrentMMDContent?.() || restorer.restoredSession.currentMMD;
    const psCurrent = persistence.session.current;
    const currentsMatch = rsCurrent === psCurrent;
    console.log(`   Current MMD matches: ${currentsMatch ? '✓ YES' : '✗ NO'}`);
  }

  console.log('\n' + '='.repeat(60));
};

// ============================================================================
// QUICK STATUS COMMAND
// ============================================================================

/**
 * Quick status check for debugging
 */
window.phase831Status = function() {
  const td = typeof window.MathPixTotalDownloader === 'function' ? '✓' : '✗';
  const zip = typeof JSZip !== 'undefined' ? '✓' : '✗';
  const pers = window.getMathPixMMDPersistence?.()?.hasSession?.() ? '✓' : '✗';
  const rest = window.getMathPixSessionRestorer?.()?.restoredSession ? '✓' : '✗';
  const conv = (window.getMathPixConvertUI?.()?.completedDownloads?.size || 0);
  
  console.log(`Phase 8.3.1 Status: TD:${td} JSZip:${zip} Pers:${pers} Rest:${rest} Conv:${conv}`);
  
  return { td, zip, pers, rest, conv };
};

// ============================================================================
// HELP
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Phase 8.3.1 Diagnostic Tools Loaded');
console.log('='.repeat(60));
console.log('');
console.log('Available commands:');
console.log('  window.phase831Diagnostic()      - Full diagnostic');
console.log('  window.testPhase831RoundTrip()   - Round-trip tests');
console.log('  window.verifyPhase831DataFlow()  - Data flow check');
console.log('  window.phase831Status()          - Quick status');
console.log('');
console.log('Run window.phase831Diagnostic() first for full analysis');
console.log('='.repeat(60));
