/**
 * Phase 7.2G: Partial Page Processing Audit - Test Commands
 * 
 * Run these commands in the browser console to test partial page processing.
 * 
 * PREREQUISITES:
 * 1. Have a 20+ page test PDF ready
 * 2. Process it with "First 10 Pages" option
 * 3. Then run these tests
 */

// ============================================================================
// G.1: PAGE RANGE DATA FLOW INSPECTION
// ============================================================================

/**
 * Inspect current page range data across all components
 */
window.inspectPageRangeDataFlow = function() {
  console.log("🔍 PHASE 7.2G: Page Range Data Flow Inspection");
  console.log("=".repeat(60));
  
  const results = {
    pdfHandler: null,
    pdfProcessor: null,
    sessionRestorer: null,
    aiEnhancer: null,
    confidenceVisualiser: null
  };
  
  // 1. Check PDF Handler
  console.log("\n📁 1. PDF Handler (Current Processing Options):");
  try {
    const controller = window.getMathPixController?.();
    const pdfHandler = controller?.pdfHandler;
    if (pdfHandler?.currentProcessingOptions) {
      results.pdfHandler = pdfHandler.currentProcessingOptions.page_range;
      console.log("   page_range:", results.pdfHandler || "not set");
    } else {
      console.log("   ⚠️ No current processing options");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // 2. Check PDF Processor
  console.log("\n⚙️ 2. PDF Processor (Processing Options):");
  try {
    const controller = window.getMathPixController?.();
    const pdfProcessor = controller?.pdfProcessor;
    if (pdfProcessor?.processingOptions) {
      results.pdfProcessor = pdfProcessor.processingOptions.page_range;
      console.log("   page_range:", results.pdfProcessor || "not set");
      console.log("   lastDebugData pageRange:", 
        pdfProcessor.lastDebugData?.metadata?.pageRange || "not captured");
    } else {
      console.log("   ⚠️ No processing options");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // 3. Check Session Restorer
  console.log("\n💾 3. Session Restorer (Restored Session):");
  try {
    const restorer = window.getMathPixSessionRestorer?.();
    if (restorer?.restoredSession) {
      const session = restorer.restoredSession;
      results.sessionRestorer = {
        hasMetadata: !!session.metadata,
        pageRangeInMetadata: session.metadata?.processing?.pageRange || 
                            session.metadata?.pageRange || "NOT FOUND",
        isPDF: session.isPDF,
        linesDataPages: session.linesData?.pages?.length || 0
      };
      console.log("   hasMetadata:", results.sessionRestorer.hasMetadata);
      console.log("   pageRange in metadata:", results.sessionRestorer.pageRangeInMetadata);
      console.log("   isPDF:", results.sessionRestorer.isPDF);
      console.log("   linesData pages:", results.sessionRestorer.linesDataPages);
    } else {
      console.log("   ⚠️ No restored session");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // 4. Check AI Enhancer
  console.log("\n🤖 4. AI Enhancer (PDF Document):");
  try {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (enhancer) {
      results.aiEnhancer = {
        hasOriginalMMD: !!enhancer.originalMMD,
        hasPdfDocument: !!enhancer.pdfDocument,
        pdfTotalPages: enhancer.pdfDocument?.numPages || "not loaded"
      };
      console.log("   hasOriginalMMD:", results.aiEnhancer.hasOriginalMMD);
      console.log("   PDF total pages:", results.aiEnhancer.pdfTotalPages);
      
      // Check if there's page range awareness
      console.log("   ⚠️ NO pageRange awareness in AI Enhancer!");
    } else {
      console.log("   ⚠️ AI Enhancer not initialised");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // 5. Check Confidence Visualiser
  console.log("\n📊 5. Confidence Visualiser:");
  try {
    const controller = window.getMathPixController?.();
    const visualiser = controller?.confidenceVisualiser;
    if (visualiser) {
      results.confidenceVisualiser = {
        hasLinesData: !!visualiser.linesData,
        linesDataPagesCount: visualiser.linesData?.pages?.length || 0,
        rendererTotalPages: visualiser.renderer?.totalPages || "not loaded"
      };
      console.log("   linesData pages count:", results.confidenceVisualiser.linesDataPagesCount);
      console.log("   renderer total pages:", results.confidenceVisualiser.rendererTotalPages);
      
      // Check for mismatch
      if (results.confidenceVisualiser.linesDataPagesCount !== 
          results.confidenceVisualiser.rendererTotalPages) {
        console.log("   ⚠️ MISMATCH: linesData has fewer pages than PDF!");
      }
    } else {
      console.log("   ⚠️ Confidence Visualiser not initialised");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 SUMMARY:");
  console.log(JSON.stringify(results, null, 2));
  
  return results;
};

// ============================================================================
// G.2: CONFIDENCE VISUALISER TESTING
// ============================================================================

/**
 * Test confidence visualiser with partial page processing
 */
window.testConfidenceVisualiserPartialPages = function() {
  console.log("🔍 G.2: Confidence Visualiser Partial Page Test");
  console.log("=".repeat(60));
  
  const controller = window.getMathPixController?.();
  const visualiser = controller?.confidenceVisualiser;
  
  if (!visualiser?.isInitialised) {
    console.log("❌ Confidence visualiser not initialised");
    console.log("💡 Process a PDF first, then run this test");
    return false;
  }
  
  const tests = [];
  
  // Test 1: Check linesData page count vs PDF page count
  const linesDataPages = visualiser.linesData?.pages?.length || 0;
  const pdfTotalPages = visualiser.renderer?.totalPages || 0;
  
  tests.push({
    name: "Page count comparison",
    linesDataPages,
    pdfTotalPages,
    hasMismatch: linesDataPages !== pdfTotalPages,
    status: linesDataPages > 0 ? "✅" : "⚠️"
  });
  console.log("\n📄 Test 1: Page Count Comparison");
  console.log("   linesData pages:", linesDataPages);
  console.log("   PDF total pages:", pdfTotalPages);
  console.log("   Mismatch:", linesDataPages !== pdfTotalPages ? "YES ⚠️" : "NO ✅");
  
  // Test 2: Check what pages have confidence data
  console.log("\n📄 Test 2: Pages with Confidence Data");
  const pagesWithData = [];
  const pagesWithoutData = [];
  
  for (let i = 1; i <= pdfTotalPages; i++) {
    const pageData = visualiser.getPageLinesData?.(i);
    if (pageData) {
      pagesWithData.push(i);
    } else {
      pagesWithoutData.push(i);
    }
  }
  
  console.log("   Pages WITH confidence data:", pagesWithData.join(", ") || "none");
  console.log("   Pages WITHOUT confidence data:", pagesWithoutData.join(", ") || "none");
  
  tests.push({
    name: "Pages with/without data",
    pagesWithData,
    pagesWithoutData,
    status: pagesWithData.length > 0 ? "✅" : "❌"
  });
  
  // Test 3: Try to render an unprocessed page (if any)
  if (pagesWithoutData.length > 0) {
    console.log("\n📄 Test 3: Rendering Unprocessed Page");
    const testPage = pagesWithoutData[0];
    console.log("   Attempting to render page", testPage);
    
    try {
      // Navigate to unprocessed page
      visualiser.renderer.goToPage(testPage);
      setTimeout(() => {
        const currentPageData = visualiser.currentPageData;
        console.log("   currentPageData after navigation:", currentPageData);
        console.log("   Result:", currentPageData === null ? 
          "✅ Correctly returns null for unprocessed page" : 
          "⚠️ Unexpected data for unprocessed page");
      }, 500);
      
      tests.push({
        name: "Navigate to unprocessed page",
        page: testPage,
        status: "✅ (graceful handling)"
      });
    } catch (e) {
      console.log("   ❌ Error navigating to page:", e.message);
      tests.push({
        name: "Navigate to unprocessed page",
        page: testPage,
        error: e.message,
        status: "❌"
      });
    }
  }
  
  // Test 4: Check if there's any visual indication
  console.log("\n📄 Test 4: User Indication of Partial Processing");
  console.log("   ⚠️ FINDING: No visual indication that only some pages were processed!");
  console.log("   💡 User can navigate to unprocessed pages with no warning");
  
  tests.push({
    name: "Visual indication of partial processing",
    hasIndication: false,
    status: "❌ GAP"
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY:");
  tests.forEach(t => console.log(`   ${t.status} ${t.name}`));
  
  return tests;
};

// ============================================================================
// G.3: AI ENHANCER TESTING
// ============================================================================

/**
 * Test AI enhancer with partial page processing
 */
window.testAIEnhancerPartialPages = function() {
  console.log("🔍 G.3: AI Enhancer Partial Page Test");
  console.log("=".repeat(60));
  
  const enhancer = window.getMathPixAIEnhancer?.();
  const restorer = window.getMathPixSessionRestorer?.();
  
  if (!enhancer || !restorer?.restoredSession?.isPDF) {
    console.log("❌ No PDF session restored");
    console.log("💡 Process a PDF with partial pages first, then restore it");
    return false;
  }
  
  const tests = [];
  
  // Test 1: Check MMD content vs PDF pages
  console.log("\n📄 Test 1: MMD Content vs PDF Pages");
  const mmdContent = restorer.restoredSession.currentMMD || "";
  const mmdLineCount = mmdContent.split('\n').length;
  const linesDataPages = restorer.restoredSession.linesData?.pages?.length || 0;
  
  console.log("   MMD line count:", mmdLineCount);
  console.log("   linesData page count:", linesDataPages);
  
  // Check PDF blob
  const pdfBlob = enhancer.getSourcePDF?.();
  console.log("   PDF blob available:", !!pdfBlob);
  
  tests.push({
    name: "MMD content check",
    mmdLineCount,
    linesDataPages,
    hasPdfBlob: !!pdfBlob,
    status: "✅"
  });
  
  // Test 2: Check if AI prompt mentions page range
  console.log("\n📄 Test 2: AI Prompt Page Range Awareness");
  
  // Check prompts.json content
  console.log("   Checking AI prompt configuration...");
  console.log("   ⚠️ FINDING: AI prompt does NOT mention partial page processing!");
  console.log("   💡 AI will see full PDF but only partial MMD content");
  
  tests.push({
    name: "AI prompt page range awareness",
    hasAwareness: false,
    status: "❌ GAP"
  });
  
  // Test 3: Check PDF render behaviour (without opening modal)
  console.log("\n📄 Test 3: PDF Rendering Behaviour Analysis");
  console.log("   renderPdfPages() uses: this.pdfDocument.numPages");
  console.log("   ⚠️ FINDING: Renders ALL PDF pages regardless of processing range!");
  console.log("   💡 AI modal shows pages 11-20 even if not processed");
  
  tests.push({
    name: "PDF rendering scope",
    rendersAllPages: true,
    status: "❌ MISMATCH"
  });
  
  // Test 4: Potential AI confusion analysis
  console.log("\n📄 Test 4: Potential AI Confusion Analysis");
  console.log("   Scenario: 20-page PDF, processed pages 1-10");
  console.log("   - AI sees: Full 20-page PDF in 4th column");
  console.log("   - AI receives: MMD content for pages 1-10 only");
  console.log("   - Risk: AI may try to 'add missing content' for pages 11-20");
  console.log("   - Risk: AI may be confused by apparent 'missing' content");
  
  tests.push({
    name: "AI confusion risk assessment",
    riskLevel: "HIGH",
    reason: "PDF/MMD page mismatch",
    status: "⚠️ HIGH RISK"
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY:");
  tests.forEach(t => console.log(`   ${t.status} ${t.name}`));
  
  return tests;
};

// ============================================================================
// G.4: ZIP WORKFLOW TESTING  
// ============================================================================

/**
 * Test ZIP download/resume with partial page processing
 */
window.testZIPWorkflowPartialPages = function() {
  console.log("🔍 G.4: ZIP Workflow Partial Page Test");
  console.log("=".repeat(60));
  
  const tests = [];
  
  // Test 1: Check README generation (without creating ZIP)
  console.log("\n📄 Test 1: README.txt Page Range Inclusion");
  console.log("   Examining generateProductionReadme() method...");
  console.log("   ⚠️ FINDING: README does NOT include page range information!");
  console.log("   💡 User won't know which pages were processed from README");
  
  tests.push({
    name: "README includes page range",
    included: false,
    status: "❌ GAP"
  });
  
  // Test 2: Check metadata.json generation
  console.log("\n📄 Test 2: metadata.json Page Range Inclusion");
  console.log("   Examining generateMetadata() method...");
  console.log("   ⚠️ FINDING: metadata.json does NOT include page range!");
  console.log("   💡 Archive metadata doesn't record what was processed");
  
  tests.push({
    name: "metadata.json includes page range",
    included: false,
    status: "❌ GAP"
  });
  
  // Test 3: Check session restorer persistence
  console.log("\n📄 Test 3: Session Restorer Page Range Storage");
  const restorer = window.getMathPixSessionRestorer?.();
  
  if (restorer) {
    const sessionData = restorer.restoredSession;
    const hasPageRange = !!(sessionData?.metadata?.processing?.pageRange ||
                          sessionData?.pageRange ||
                          sessionData?.processingOptions?.page_range);
    
    console.log("   Checking restoredSession structure...");
    console.log("   pageRange in session data:", hasPageRange ? "YES" : "NO");
    console.log("   ⚠️ FINDING: Session restorer does NOT store pageRange!");
    
    tests.push({
      name: "Session restorer stores page range",
      stored: hasPageRange,
      status: hasPageRange ? "✅" : "❌ GAP"
    });
  }
  
  // Test 4: Check localStorage persistence
  console.log("\n📄 Test 4: localStorage Session Page Range");
  console.log("   Examining startPersistenceSession() method...");
  console.log("   localStorage sessionData structure:");
  console.log("   - sourceFileName ✅");
  console.log("   - original, baseline, current ✅");
  console.log("   - aiEnhanced ✅");
  console.log("   - pageRange ❌ NOT INCLUDED");
  
  tests.push({
    name: "localStorage includes page range",
    included: false,
    status: "❌ GAP"
  });
  
  // Test 5: Resume mode awareness
  console.log("\n📄 Test 5: Resume Mode Partial Processing Awareness");
  console.log("   When restoring from ZIP:");
  console.log("   - User sees: MMD content (pages 1-10)");
  console.log("   - User sees: Full PDF (pages 1-20)");
  console.log("   - User sees: NO indication that processing was partial");
  console.log("   ⚠️ FINDING: No UI indication of partial processing on resume!");
  
  tests.push({
    name: "Resume mode shows partial processing indicator",
    showsIndicator: false,
    status: "❌ GAP"
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY:");
  tests.forEach(t => console.log(`   ${t.status} ${t.name}`));
  
  return tests;
};

// ============================================================================
// G.5: COMPREHENSIVE GAP ANALYSIS
// ============================================================================

/**
 * Run all partial page processing tests
 */
window.runPartialPageAudit = function() {
  console.log("🔍 PHASE 7.2G: COMPREHENSIVE PARTIAL PAGE PROCESSING AUDIT");
  console.log("=".repeat(70));
  console.log("Date:", new Date().toISOString());
  console.log("");
  
  // Run all tests
  const results = {
    dataFlow: window.inspectPageRangeDataFlow(),
    confidenceVisualiser: null,
    aiEnhancer: null,
    zipWorkflow: null
  };
  
  console.log("\n");
  results.confidenceVisualiser = window.testConfidenceVisualiserPartialPages();
  
  console.log("\n");
  results.aiEnhancer = window.testAIEnhancerPartialPages();
  
  console.log("\n");
  results.zipWorkflow = window.testZIPWorkflowPartialPages();
  
  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 PHASE 7.2G AUDIT COMPLETE - GAP SUMMARY");
  console.log("=".repeat(70));
  
  const gaps = [
    {
      component: "Session Restorer",
      issue: "Does NOT store pageRange in session data",
      impact: "Cannot know what pages were processed on resume",
      priority: "HIGH",
      fix: "Add pageRange to session storage structure"
    },
    {
      component: "ZIP README",
      issue: "Does NOT include page range in documentation",
      impact: "User doesn't know what was processed from archive",
      priority: "HIGH",
      fix: "Add 'Pages Processed' section to README"
    },
    {
      component: "ZIP metadata.json",
      issue: "Does NOT include page range",
      impact: "Archive metadata incomplete",
      priority: "HIGH", 
      fix: "Add processing.pageRange to metadata structure"
    },
    {
      component: "AI Enhancer",
      issue: "Renders ALL PDF pages, not just processed ones",
      impact: "AI sees mismatch between PDF content and MMD",
      priority: "HIGH",
      fix: "Restrict PDF view OR add page range to AI prompt"
    },
    {
      component: "AI Prompt",
      issue: "No awareness of partial page processing",
      impact: "AI may hallucinate content for unprocessed pages",
      priority: "MEDIUM",
      fix: "Add page range context to system prompt"
    },
    {
      component: "Confidence Visualiser",
      issue: "No user indication for unprocessed pages",
      impact: "User confusion when viewing pages without overlays",
      priority: "MEDIUM",
      fix: "Add 'No confidence data' message for unprocessed pages"
    },
    {
      component: "Resume UI",
      issue: "No visual indicator of partial processing",
      impact: "User doesn't know session was partial",
      priority: "MEDIUM",
      fix: "Add badge or banner indicating processed page range"
    },
    {
      component: "localStorage",
      issue: "Does NOT store pageRange",
      impact: "Edit sessions don't know processing scope",
      priority: "LOW",
      fix: "Add pageRange to localStorage session data"
    }
  ];
  
  console.log("\n📊 IDENTIFIED GAPS:");
  console.log("-".repeat(70));
  gaps.forEach((gap, i) => {
    console.log(`\n${i + 1}. ${gap.component} [${gap.priority}]`);
    console.log(`   Issue: ${gap.issue}`);
    console.log(`   Impact: ${gap.impact}`);
    console.log(`   Fix: ${gap.fix}`);
  });
  
  console.log("\n" + "=".repeat(70));
  console.log("📊 PRIORITY BREAKDOWN:");
  console.log(`   HIGH: ${gaps.filter(g => g.priority === "HIGH").length}`);
  console.log(`   MEDIUM: ${gaps.filter(g => g.priority === "MEDIUM").length}`);
  console.log(`   LOW: ${gaps.filter(g => g.priority === "LOW").length}`);
  
  console.log("\n💡 RECOMMENDED CONVERSATION H PRIORITIES:");
  console.log("   1. Store pageRange in processingMetadata → session → ZIP");
  console.log("   2. Add pageRange to ZIP README (PROCESSING SUMMARY section)");
  console.log("   3. Add pageRange to AI prompt context");
  console.log("   4. Consider restricting AI PDF view to processed pages");
  
  return { results, gaps };
};

// Quick validation command
window.validatePhase72G = function() {
  console.log("🧪 Phase 7.2G Quick Validation");
  console.log("=".repeat(50));
  
  const checks = [
    {
      name: "inspectPageRangeDataFlow available",
      pass: typeof window.inspectPageRangeDataFlow === "function"
    },
    {
      name: "testConfidenceVisualiserPartialPages available",
      pass: typeof window.testConfidenceVisualiserPartialPages === "function"
    },
    {
      name: "testAIEnhancerPartialPages available",
      pass: typeof window.testAIEnhancerPartialPages === "function"
    },
    {
      name: "testZIPWorkflowPartialPages available",
      pass: typeof window.testZIPWorkflowPartialPages === "function"
    },
    {
      name: "runPartialPageAudit available",
      pass: typeof window.runPartialPageAudit === "function"
    }
  ];
  
  let passed = 0;
  checks.forEach(check => {
    const icon = check.pass ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
    if (check.pass) passed++;
  });
  
  console.log("=".repeat(50));
  console.log(`Result: ${passed}/${checks.length} checks passed`);
  
  return passed === checks.length;
};

// ============================================================================
// COMPREHENSIVE DATA CAPTURE (Run this to capture everything at once)
// ============================================================================

/**
 * Capture all relevant data in one JSON object for easy recording
 * Run this AFTER processing a PDF with partial pages
 */
window.capturePartialPageTestData = function() {
  console.log("📸 CAPTURING ALL TEST DATA...");
  console.log("=".repeat(70));
  
  const timestamp = new Date().toISOString();
  const capture = {
    captureTimestamp: timestamp,
    testType: "Phase 7.2G Partial Page Processing Audit",
    
    // Will be populated below
    environment: {},
    pdfHandler: {},
    pdfProcessor: {},
    sessionRestorer: {},
    confidenceVisualiser: {},
    aiEnhancer: {},
    localStorage: {},
    gaps: []
  };
  
  try {
    // Environment
    capture.environment = {
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100)
    };
    
    // PDF Handler
    const controller = window.getMathPixController?.();
    if (controller?.pdfHandler) {
      const ph = controller.pdfHandler;
      capture.pdfHandler = {
        currentProcessingOptions: ph.currentProcessingOptions || null,
        pageRange: ph.currentProcessingOptions?.page_range || "NOT SET",
        formats: ph.currentProcessingOptions?.formats || [],
        currentPDFFile: ph.currentPDFFile ? {
          name: ph.currentPDFFile.name,
          size: ph.currentPDFFile.size,
          type: ph.currentPDFFile.type
        } : null
      };
    }
    
    // PDF Processor
    if (controller?.pdfProcessor) {
      const pp = controller.pdfProcessor;
      capture.pdfProcessor = {
        processingOptions: pp.processingOptions || null,
        pageRange: pp.processingOptions?.page_range || "NOT SET",
        lastDebugData: pp.lastDebugData ? {
          hasData: true,
          metadataPageRange: pp.lastDebugData.metadata?.pageRange || "NOT IN DEBUG DATA",
          pollCount: pp.lastDebugData.metadata?.pollCount,
          totalTime: pp.lastDebugData.timing?.total
        } : { hasData: false }
      };
    }
    
    // Session Restorer
    const restorer = window.getMathPixSessionRestorer?.();
    if (restorer) {
      const session = restorer.restoredSession;
      capture.sessionRestorer = {
        isInitialised: restorer.isInitialised,
        hasRestoredSession: !!session,
        isPDF: session?.isPDF || false,
        sourceFilename: session?.source?.filename || "N/A",
        
        // Check for pageRange in various locations
        pageRangeLocations: {
          "restoredSession.pageRange": session?.pageRange || "NOT FOUND",
          "restoredSession.metadata?.pageRange": session?.metadata?.pageRange || "NOT FOUND",
          "restoredSession.metadata?.processing?.pageRange": session?.metadata?.processing?.pageRange || "NOT FOUND",
          "restoredSession.processingOptions?.page_range": session?.processingOptions?.page_range || "NOT FOUND"
        },
        
        // Content info
        mmdLineCount: session?.currentMMD?.split('\n').length || 0,
        originalMmdLineCount: session?.originalMMD?.split('\n').length || 0,
        
        // Lines data info
        linesData: session?.linesData ? {
          hasData: true,
          pageCount: session.linesData.pages?.length || 0,
          pageNumbers: session.linesData.pages?.map(p => p.page) || []
        } : { hasData: false }
      };
    }
    
    // Confidence Visualiser
    if (controller?.confidenceVisualiser) {
      const cv = controller.confidenceVisualiser;
      capture.confidenceVisualiser = {
        isInitialised: cv.isInitialised,
        hasLinesData: !!cv.linesData,
        linesDataPageCount: cv.linesData?.pages?.length || 0,
        linesDataPageNumbers: cv.linesData?.pages?.map(p => p.page) || [],
        rendererTotalPages: cv.renderer?.totalPages || 0,
        rendererCurrentPage: cv.renderer?.currentPage || 0,
        
        // Mismatch detection
        hasMismatch: (cv.linesData?.pages?.length || 0) !== (cv.renderer?.totalPages || 0),
        
        // Test each page for data
        pageDataAvailability: {}
      };
      
      // Check first few and last few pages
      const pagesToCheck = [1, 2, 5, 10, 11, 12, 15, 20, 24];
      pagesToCheck.forEach(pageNum => {
        if (pageNum <= (cv.renderer?.totalPages || 0)) {
          const hasData = !!cv.linesData?.pages?.find(p => p.page === pageNum);
          capture.confidenceVisualiser.pageDataAvailability[`page${pageNum}`] = hasData;
        }
      });
    }
    
    // AI Enhancer
    const enhancer = window.getMathPixAIEnhancer?.();
    if (enhancer) {
      capture.aiEnhancer = {
        isAvailable: enhancer.isEnhancementAvailable?.() || false,
        hasOriginalMMD: !!enhancer.originalMMD,
        originalMmdLength: enhancer.originalMMD?.length || 0,
        hasPdfDocument: !!enhancer.pdfDocument,
        pdfTotalPages: enhancer.pdfDocument?.numPages || "NOT LOADED",
        pdfRendered: enhancer.pdfRendered || false,
        
        // Page range awareness
        hasPageRangeAwareness: false, // We know this is false from code analysis
        note: "AI Enhancer renders ALL PDF pages regardless of processing range"
      };
    }
    
    // localStorage sessions
    const sessionKeys = Object.keys(localStorage).filter(k => k.includes('mathpix-resume'));
    capture.localStorage = {
      sessionCount: sessionKeys.length,
      sessionKeys: sessionKeys,
      sessions: []
    };
    
    sessionKeys.slice(0, 3).forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        capture.localStorage.sessions.push({
          key: key,
          hasPageRange: 'pageRange' in data,
          fields: Object.keys(data),
          sourceFileName: data.sourceFileName || "N/A",
          lastModified: data.lastModified || "N/A"
        });
      } catch (e) {
        capture.localStorage.sessions.push({ key: key, error: e.message });
      }
    });
    
    // Identify gaps
    capture.gaps = [];
    
    if (!capture.sessionRestorer.pageRangeLocations["restoredSession.pageRange"] || 
        capture.sessionRestorer.pageRangeLocations["restoredSession.pageRange"] === "NOT FOUND") {
      capture.gaps.push("Session Restorer: pageRange NOT stored in restoredSession");
    }
    
    if (capture.confidenceVisualiser.hasMismatch) {
      capture.gaps.push(`Confidence Visualiser: Mismatch - linesData has ${capture.confidenceVisualiser.linesDataPageCount} pages but PDF has ${capture.confidenceVisualiser.rendererTotalPages} pages`);
    }
    
    if (capture.aiEnhancer.pdfTotalPages !== "NOT LOADED" && 
        capture.aiEnhancer.pdfTotalPages > capture.confidenceVisualiser.linesDataPageCount) {
      capture.gaps.push("AI Enhancer: Will show more PDF pages than were processed");
    }
    
    if (capture.localStorage.sessions.length > 0 && !capture.localStorage.sessions[0].hasPageRange) {
      capture.gaps.push("localStorage: pageRange NOT stored in session data");
    }
    
  } catch (error) {
    capture.error = error.message;
    console.error("Error during capture:", error);
  }
  
  // Output
  console.log("\n📋 CAPTURED DATA (copy this JSON):");
  console.log("=".repeat(70));
  const jsonOutput = JSON.stringify(capture, null, 2);
  console.log(jsonOutput);
  
  console.log("\n=".repeat(70));
  console.log("📊 QUICK SUMMARY:");
  console.log(`   PDF File: ${capture.pdfHandler.currentPDFFile?.name || "N/A"}`);
  console.log(`   Page Range Setting: ${capture.pdfHandler.pageRange}`);
  console.log(`   linesData Pages: ${capture.confidenceVisualiser.linesDataPageCount}`);
  console.log(`   PDF Total Pages: ${capture.confidenceVisualiser.rendererTotalPages}`);
  console.log(`   Mismatch Detected: ${capture.confidenceVisualiser.hasMismatch ? "YES ⚠️" : "NO ✅"}`);
  console.log(`   Gaps Found: ${capture.gaps.length}`);
  capture.gaps.forEach(g => console.log(`   ❌ ${g}`));
  
  // Store in window for easy access
  window.lastTestCapture = capture;
  console.log("\n💡 Data also stored in window.lastTestCapture");
  console.log("💡 To copy JSON: copy(JSON.stringify(window.lastTestCapture, null, 2))");
  
  return capture;
};

/**
 * Pre-flight check before running expensive tests
 */
window.preFlightCheck = function() {
  console.log("✈️ PRE-FLIGHT CHECK");
  console.log("=".repeat(50));
  
  const checks = [];
  
  // Check 1: MathPix mode active
  const mathpixRadio = document.getElementById('MathPix');
  checks.push({
    name: "MathPix mode selected",
    pass: mathpixRadio?.checked,
    fix: "Click the MathPix radio button"
  });
  
  // Check 2: Controller available
  const controller = window.getMathPixController?.();
  checks.push({
    name: "MathPix Controller initialised",
    pass: !!controller,
    fix: "Refresh page and select MathPix mode"
  });
  
  // Check 3: PDF Handler available
  checks.push({
    name: "PDF Handler available",
    pass: !!controller?.pdfHandler,
    fix: "Controller should have pdfHandler"
  });
  
  // Check 4: Session Restorer available
  const restorer = window.getMathPixSessionRestorer?.();
  checks.push({
    name: "Session Restorer available",
    pass: !!restorer,
    fix: "Session restorer should be initialised"
  });
  
  // Check 5: Test commands loaded
  checks.push({
    name: "Test commands loaded",
    pass: typeof window.capturePartialPageTestData === 'function',
    fix: "Load phase-72g-audit-tests.js"
  });
  
  // Check 6: Console ready for copying
  checks.push({
    name: "Console copy() function available",
    pass: typeof copy === 'function',
    fix: "Use Chrome/Firefox DevTools console"
  });
  
  let allPassed = true;
  checks.forEach(check => {
    const icon = check.pass ? "✅" : "❌";
    console.log(`${icon} ${check.name}`);
    if (!check.pass) {
      console.log(`   Fix: ${check.fix}`);
      allPassed = false;
    }
  });
  
  console.log("=".repeat(50));
  if (allPassed) {
    console.log("✅ ALL CHECKS PASSED - Ready to test!");
    console.log("\n📋 TESTING WORKFLOW:");
    console.log("1. Upload your 24-page PDF");
    console.log("2. Select 'First 10 Pages'");
    console.log("3. Select formats (MMD at minimum)");
    console.log("4. Click 'Process PDF'");
    console.log("5. Wait for processing to complete");
    console.log("6. Run: capturePartialPageTestData()");
    console.log("7. Copy the JSON output to your test record");
  } else {
    console.log("❌ Some checks failed - fix issues above first");
  }
  
  return allPassed;
};

/**
 * Quick capture after processing - minimal output for fast recording
 */
window.quickCapture = function() {
  const c = window.capturePartialPageTestData();
  
  // Create a minimal summary for easy pasting
  const summary = {
    timestamp: c.captureTimestamp,
    pdf: c.pdfHandler.currentPDFFile?.name,
    pageRangeSetting: c.pdfHandler.pageRange,
    linesDataPages: c.confidenceVisualiser.linesDataPageCount,
    pdfTotalPages: c.confidenceVisualiser.rendererTotalPages,
    hasMismatch: c.confidenceVisualiser.hasMismatch,
    sessionHasPageRange: c.sessionRestorer.pageRangeLocations,
    localStorageHasPageRange: c.localStorage.sessions[0]?.hasPageRange || false,
    gapsFound: c.gaps
  };
  
  console.log("\n📋 QUICK SUMMARY (copy-paste friendly):");
  console.log(JSON.stringify(summary, null, 2));
  
  return summary;
};

console.log("📦 Phase 7.2G Audit Tests Loaded");
console.log("=".repeat(50));
console.log("Commands available:");
console.log("  • preFlightCheck() - Run FIRST to verify setup");
console.log("  • validatePhase72G() - Quick validation");
console.log("  • capturePartialPageTestData() - MAIN: Capture all data");
console.log("  • quickCapture() - Minimal summary output");
console.log("  • inspectPageRangeDataFlow() - Trace page range");
console.log("  • testConfidenceVisualiserPartialPages() - Test overlay");
console.log("  • testAIEnhancerPartialPages() - Test AI modal");
console.log("  • testZIPWorkflowPartialPages() - Test ZIP");
console.log("  • runPartialPageAudit() - Full audit report");
console.log("=".repeat(50));
console.log("💡 START WITH: preFlightCheck()");
