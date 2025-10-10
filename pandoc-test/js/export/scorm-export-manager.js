// scorm-export-manager.js
// SCORM 2004 3rd Edition Export Module
// Generates LMS-compatible packages with full accessibility features

const SCORMExportManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[SCORM]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[SCORM]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[SCORM]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[SCORM]", message, ...args);
  }

  // ===========================================================================================
  // SCORM CONFIGURATION
  // ===========================================================================================

  const SCORM_CONFIG = {
    VERSION: "2004 3rd Edition",
    SCHEMA_VERSION: "2004 3rd Edition",
    API_VERSION: "1.0",
    CONTENT_FILENAME: "content.html",
    MANIFEST_FILENAME: "imsmanifest.xml",
    METADATA_FILENAME: "metadata.xml",
    API_FILENAME: "scorm-api.js",
    MATHJAX_MODE: "cdn", // "cdn" or "local"
    CDN_MATHJAX_URL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js",
    LOCAL_MATHJAX_PATH: "./libs/mathjax-3.2.2/es5/tex-chtml.js",
    MAX_PACKAGE_SIZE_MB: 50,
    COMPRESSION_LEVEL: 6,
  };

  // ===========================================================================================
  // DEPENDENCY VALIDATION
  // ===========================================================================================

  /**
   * Validate SCORM export dependencies
   * @returns {Object} Validation results with dependency status
   */
  function validateSCORMDependencies() {
    logDebug("Validating SCORM export dependencies...");

    const dependencies = {
      jsZip: typeof JSZip !== "undefined",
      exportManager: !!window.ExportManager,
      appConfig: !!window.AppConfig,
      laTeXProcessor: !!window.LaTeXProcessor,
      templateSystem: !!window.TemplateSystem,
      contentGenerator: !!window.ContentGenerator,
    };

    const missing = Object.keys(dependencies).filter(
      (dep) => !dependencies[dep]
    );
    const allAvailable = missing.length === 0;

    if (!allAvailable) {
      logError("Missing SCORM dependencies:", missing);
    } else {
      logDebug("✅ All SCORM dependencies available");
    }

    return {
      success: allAvailable,
      dependencies,
      missing,
      jsZipVersion: typeof JSZip !== "undefined" ? JSZip.version : null,
      mathjaxMode: SCORM_CONFIG.MATHJAX_MODE,
    };
  }

  // ===========================================================================================
  // SCORM MANIFEST GENERATION
  // ===========================================================================================

  /**
   * Generate SCORM 2004 3rd Edition compliant manifest
   * @param {Object} metadata - Document metadata
   * @returns {string} XML manifest content
   */
  function generateSCORMManifest(metadata) {
    logDebug("Generating SCORM 2004 3rd Edition manifest...");

    const scormId = `enhanced_pandoc_scorm_${Date.now()}`;
    const title = escapeXML(metadata.title || "Mathematical Document");
    const description = escapeXML(
      `Accessible mathematical content exported from Enhanced Pandoc-WASM Playground. ` +
        `WCAG 2.2 AA compliant with screen reader support and interactive MathJax features.`
    );

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
  <manifest identifier="${scormId}" version="1.3"
            xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
            xmlns:adlcp="http://www.adltraining.com/xsd/adlcp_v1p3"
            xmlns:adlseq="http://www.adltraining.com/xsd/adlseq_v1p3"
            xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                                http://www.adltraining.com/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                                http://www.adltraining.com/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                                http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  
    <metadata>
      <schema>ADL SCORM</schema>
      <schemaversion>${SCORM_CONFIG.SCHEMA_VERSION}</schemaversion>
      <adlcp:location>${SCORM_CONFIG.METADATA_FILENAME}</adlcp:location>
    </metadata>
  
    <organizations default="enhanced_pandoc_org">
      <organization identifier="enhanced_pandoc_org">
        <title>${title}</title>
        <item identifier="mathematical_content" identifierref="resource_main_content">
          <title>${title}</title>
          <adlcp:prerequisites type="aicc_script"></adlcp:prerequisites>
          <adlcp:masteryscore></adlcp:masteryscore>
          <adlcp:maxtimeallowed></adlcp:maxtimeallowed>
          <adlcp:timelimitaction>continue,no message</adlcp:timelimitaction>
        </item>
      </organization>
    </organizations>
  
    <resources>
      <resource identifier="resource_main_content" type="webcontent" 
                adlcp:scormType="sco" href="${SCORM_CONFIG.CONTENT_FILENAME}">
        <file href="${SCORM_CONFIG.CONTENT_FILENAME}"/>
        <file href="${SCORM_CONFIG.API_FILENAME}"/>
        <metadata>
          <adlcp:location>${SCORM_CONFIG.METADATA_FILENAME}</adlcp:location>
        </metadata>
      </resource>
    </resources>
  
  </manifest>`;

    logDebug("✅ SCORM manifest generated successfully");
    return manifest;
  }

  // ===========================================================================================
  // SCORM METADATA GENERATION (IEEE LOM Standard)
  // ===========================================================================================

  /**
   * Convert numbers 0-9 to words, leave others as digits
   * @param {number} num - Number to convert
   * @returns {string} Word representation for 0-9, digit for others
   */
  function numberToWord(num) {
    const words = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];

    if (num >= 0 && num <= 9 && Number.isInteger(num)) {
      return words[num];
    }
    return num.toString();
  }

  /**
   * Format section list with proper grammar and quotation marks
   * @param {Array} sections - Array of section objects
   * @param {number} maxShow - Maximum sections to show before truncating
   * @returns {string} Formatted section list
   */
  function formatSectionList(sections, maxShow = 3) {
    if (!sections || sections.length === 0) return "";

    const sectionTitles = sections.map((s) => `"${s.title}"`);
    const count = sections.length;

    if (count === 1) {
      return sectionTitles[0];
    } else if (count === 2) {
      return `${sectionTitles[0]} and ${sectionTitles[1]}`;
    } else if (count <= maxShow) {
      // 3 or fewer: "A", "B", and "C"
      const lastSection = sectionTitles.pop();
      return `${sectionTitles.join(", ")}, and ${lastSection}`;
    } else {
      // More than maxShow: show first few with "starting with"
      const firstThree = sectionTitles.slice(0, maxShow);
      const lastSection = firstThree.pop();
      return `starting with ${firstThree.join(", ")}, and ${lastSection}`;
    }
  }

  /**
   * Generate intelligent description based on document content
   * @param {Object} metadata - Document metadata
   * @returns {string} Contextual description with British spelling
   */
  function generateIntelligentDescription(metadata) {
    logDebug("Generating intelligent description from metadata...");

    let description = "";
    const title = metadata.title || "Mathematical Document";

    console.log("🔍 Debug - All metadata:", metadata);
    console.log("🔍 Debug - Sections array:", metadata.sections);
    if (metadata.sections) {
      metadata.sections.forEach((section, index) => {
        console.log(`🔍 Debug - Section ${index}:`, section);
      });
    }

    // Filter to get only actual content sections (not title, toc, etc.)
    const documentTitle = (metadata.title || "").trim();
    const actualSections = metadata.sections
      ? metadata.sections.filter(
          (section) =>
            section &&
            section.title &&
            section.title.trim() !== "" &&
            section.title.trim() !== documentTitle && // Exclude document title
            !section.title.toLowerCase().includes("table of contents") &&
            !section.title.toLowerCase().includes("abstract") &&
            section.level > 0 // Ensure it's an actual section, not title-level
        )
      : [];

    // Start with document-specific information
    if (actualSections.length > 0) {
      const sectionCount = actualSections.length;
      const sectionCountWord = numberToWord(sectionCount);
      const sectionWord = sectionCount === 1 ? "section" : "sections";

      // Format sections with proper grammar
      const formattedSections = formatSectionList(actualSections);

      if (sectionCount >= 5) {
        description += `${title} with ${sectionCountWord} ${sectionWord} ${formattedSections}`;
      } else {
        description += `${title} with ${sectionCountWord} ${sectionWord}: ${formattedSections}`;
      }
      description += ". ";
    } else {
      // More natural phrasing for documents without sections
      description += `${title}. `;
    }

    // Add subject-specific context based on content analysis
    const contentContext = analyseContentContext(metadata);
    if (contentContext) {
      description += `This ${contentContext} material `;
    } else {
      description += "This mathematical material ";
    }

    // Add accessibility and technical features (British spelling)
    description += "may open in a new browser window or tab.";

    return description;
  }

  /**
   * Analyse content to determine subject context
   * @param {Object} metadata - Document metadata
   * @returns {string} Subject context or null
   */
  function analyseContentContext(metadata) {
    const title = (metadata.title || "").toLowerCase();
    const allSections = metadata.sections
      ? metadata.sections.map((s) => (s.title || "").toLowerCase()).join(" ")
      : "";
    const content = (title + " " + allSections).toLowerCase();

    // Mathematics subdisciplines
    if (content.match(/calculus|derivative|integral|limit|differential/))
      return "calculus";
    if (content.match(/algebra|equation|polynomial|matrix|vector/))
      return "algebra";
    if (content.match(/geometry|triangle|circle|angle|theorem/))
      return "geometry";
    if (content.match(/statistics|probability|distribution|regression/))
      return "statistics";
    if (content.match(/analysis|topology|metric|space|function/))
      return "mathematical analysis";
    if (content.match(/number theory|prime|modular|arithmetic/))
      return "number theory";

    // Physics
    if (
      content.match(/physics|quantum|mechanics|thermodynamics|electromagnetic/)
    )
      return "physics";
    if (content.match(/force|energy|momentum|wave|particle/)) return "physics";

    // Engineering
    if (content.match(/engineering|circuit|signal|system|control/))
      return "engineering";

    // Computer Science
    if (
      content.match(/algorithm|computer|programming|complexity|data structure/)
    )
      return "computer science";

    // Chemistry
    if (content.match(/chemistry|chemical|molecule|reaction|bond/))
      return "chemistry";

    // General STEM
    if (content.match(/science|research|experiment|theory|analysis/))
      return "STEM";

    return null; // Default to null for generic mathematical content
  }

  /**
   * Generate IEEE LOM compliant metadata
   * @param {Object} metadata - Document metadata
   * @returns {string} XML metadata content
   */
  function generateSCORMMetadata(metadata) {
    logDebug("Generating IEEE LOM metadata...");

    const title = escapeXML(metadata.title || "Mathematical Document");

    // Generate intelligent description based on document content
    const description = escapeXML(generateIntelligentDescription(metadata));

    const currentDate = new Date().toISOString();
    const packageId = `enhanced_pandoc_${Date.now()}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
  <lom xmlns="http://ltsc.ieee.org/xsd/LOM">
    <general>
      <identifier>
        <catalog>URI</catalog>
        <entry>${packageId}</entry>
      </identifier>
      <title>
        <string language="en">${title}</string>
      </title>
      <language>en</language>
      <description>
        <string language="en">${description}</string>
      </description>
      <keyword><string language="en">mathematics</string></keyword>
      <keyword><string language="en">accessibility</string></keyword>
      <keyword><string language="en">LaTeX</string></keyword>
      <keyword><string language="en">MathJax</string></keyword>
      <keyword><string language="en">WCAG</string></keyword>
      <keyword><string language="en">screen reader</string></keyword>
    </general>
    
    <technical>
      <format>text/html</format>
      <requirement>
        <orComposite>
          <type><source>LOMv1.0</source><value>browser</value></type>
          <name><source>LOMv1.0</source><value>any</value></name>
          <minimumVersion>HTML5</minimumVersion>
        </orComposite>
      </requirement>
      <installationRemarks>
        <string language="en">Requires JavaScript-enabled browser. MathJax CDN recommended for optimal rendering.</string>
      </installationRemarks>
    </technical>
    
    <educational>
      <learningResourceType><source>LOMv1.0</source><value>lecture</value></learningResourceType>
      <intendedEndUserRole><source>LOMv1.0</source><value>learner</value></intendedEndUserRole>
      <intendedEndUserRole><source>LOMv1.0</source><value>teacher</value></intendedEndUserRole>
      <context><source>LOMv1.0</source><value>higher education</value></context>
    </educational>
    
    <rights>
      <cost><source>LOMv1.0</source><value>no</value></cost>
      <copyrightAndOtherRestrictions><source>LOMv1.0</source><value>yes</value></copyrightAndOtherRestrictions>
    </rights>
  </lom>`;
  }

  // ===========================================================================================
  // SCORM API WRAPPER GENERATION
  // ===========================================================================================

  /**
   * Generate SCORM 2004 API wrapper with mathematical content tracking
   * @returns {string} JavaScript SCORM API integration code
   */
  function generateSCORMAPIWrapper() {
    logDebug("Generating SCORM API wrapper...");

    return `/**
   * SCORM 2004 API Wrapper for Mathematical Content
   * Enhanced Pandoc-WASM Playground SCORM Integration
   */
  
  (function() {
    'use strict';
    
    var scormAPI = null;
    var maxSearchDepth = 7;
    
    // SCORM API Discovery
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
      if (scormAPI == null) {
        scormAPI = findSCORMAPI(window);
      }
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
            
            // Set initial values
            api.SetValue("cmi.completion_status", "incomplete");
            api.SetValue("cmi.success_status", "unknown");
            api.SetValue("cmi.exit", "");
            
            // Mathematical content metadata
            api.SetValue("cmi.comments_from_learner._count", "1");
            api.SetValue("cmi.comments_from_learner.0.comment", 
                        "Mathematical content with WCAG 2.2 AA accessibility features");
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
      var api = getSCORMAPI();
      if (api != null) {
        try {
          api.SetValue("cmi.completion_status", "completed");
          api.SetValue("cmi.success_status", "passed");
          api.SetValue("cmi.exit", "normal");
          
          // Set session time
          if (window.scormSessionStart) {
            var sessionTime = Math.floor((Date.now() - window.scormSessionStart) / 1000);
            var timeString = "PT" + sessionTime + "S";
            api.SetValue("cmi.session_time", timeString);
          }
          
          api.Commit("");
          api.Terminate("");
          console.log("[SCORM] Session terminated successfully");
        } catch (error) {
          console.error("[SCORM] Termination error:", error);
        }
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
    
    // Session tracking
    window.scormSessionStart = Date.now();
    
    // Auto-initialize and cleanup
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeSCORM);
    } else {
      initializeSCORM();
    }
    
    window.addEventListener('beforeunload', terminateSCORM);
    
    // Global SCORM interface
    window.SCORM = {
      initialize: initializeSCORM,
      terminate: terminateSCORM,
      trackProgress: trackProgress,
      getAPI: getSCORMAPI,
      isAvailable: function() { return getSCORMAPI() != null; }
    };
    
  })();`;
  }

  // ===========================================================================================
  // ENHANCED HTML CONTENT MODIFICATION FOR SCORM
  // ===========================================================================================

  /**
   * Modify exported HTML for SCORM environment compatibility
   * @param {string} htmlContent - Original enhanced HTML
   * @param {string} mathjaxMode - "cdn" or "local"
   * @returns {string} SCORM-optimized HTML
   */
  function prepareSCORMHTML(htmlContent, mathjaxMode = "cdn") {
    logDebug(`Preparing HTML for SCORM (MathJax mode: ${mathjaxMode})...`);

    let scormHTML = htmlContent;

    // 1. Add SCORM API initialization before closing body tag
    const scormInitScript = `
      <script>
        // SCORM session tracking for mathematical content
        if (window.SCORM && window.SCORM.isAvailable()) {
          console.log("[SCORM] Mathematical content loaded in LMS environment");
          
          // Track mathematical expressions rendered
          if (typeof MathJax !== 'undefined') {
            MathJax.startup.promise.then(() => {
              const mathElements = document.querySelectorAll('.MathJax');
              if (mathElements.length > 0) {
                window.SCORM.trackProgress('mathematical_content_rendered', 50);
                console.log(\`[SCORM] Tracked \${mathElements.length} mathematical expressions\`);
              }
            });
          }
        }
      </script>
    </body>`;

    scormHTML = scormHTML.replace("</body>", scormInitScript);

    // 2. Add SCORM-specific meta tags
    const scormMeta = `
      <meta name="scorm.version" content="${SCORM_CONFIG.VERSION}">
      <meta name="mathematical.accessibility" content="WCAG 2.2 AA">
      <meta name="mathjax.mode" content="${mathjaxMode}">`;

    scormHTML = scormHTML.replace(
      '<meta charset="utf-8">',
      '<meta charset="utf-8">' + scormMeta
    );

    // 3. Modify MathJax configuration for SCORM environment
    if (mathjaxMode === "local") {
      // Replace CDN references with local paths (Phase 2)
      scormHTML = scormHTML.replace(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3\/es5\/tex-chtml\.js/g,
        SCORM_CONFIG.LOCAL_MATHJAX_PATH
      );
    }

    // 4. Add SCORM-specific error handling
    const scormErrorHandler = `
      <script>
        // Enhanced error handling for SCORM environment
        window.addEventListener('error', function(event) {
          console.error('[SCORM Error]', event.error);
          if (window.SCORM && window.SCORM.isAvailable()) {
            // Could track errors to LMS if needed
          }
        });
      </script>`;

    scormHTML = scormHTML.replace("</head>", scormErrorHandler + "</head>");

    logDebug("✅ HTML prepared for SCORM environment");
    return scormHTML;
  }

  // ===========================================================================================
  // MAIN SCORM EXPORT FUNCTION
  // ===========================================================================================

  // ===========================================================================================
  // SCORM INSTRUCTIONS MODAL
  // ===========================================================================================

  /**
   * Show SCORM upload instructions modal after successful export
   * @param {string} filename - Generated SCORM filename
   * @param {Object} metadata - Document metadata
   */
  function showSCORMInstructionsModal(filename, metadata) {
    logInfo("Showing SCORM upload instructions modal...");

    // Check if modal system is available
    if (typeof UniversalModal === "undefined") {
      logWarn("UniversalModal not available, skipping instructions modal");
      return;
    }

    const modalContent = generateSCORMInstructionsContent(filename, metadata);

    // Show modal with instructions
    UniversalModal.custom(modalContent, {
      title: "SCORM Package Ready - Upload Instructions",
      type: "success",
      size: "large",
      buttons: [
        {
          text: "Copy Instructions",
          type: "primary",
          action: async () => {
            console.log("🔄 Copy button clicked - ensuring document focus...");

            // Ensure document has focus
            window.focus();
            document.body.focus();

            // Small delay to ensure focus is established
            await new Promise((resolve) => setTimeout(resolve, 100));

            try {
              if (
                window.SCORMExportManager &&
                window.SCORMExportManager.copyInstructionsToClipboard
              ) {
                console.log("🔄 Calling copy function with proper focus...");
                const result =
                  await window.SCORMExportManager.copyInstructionsToClipboard();

                if (result !== false) {
                  console.log("✅ Copy operation completed");
                  // Don't show status here - the copy function handles it
                }
              } else {
                throw new Error("Copy function not available");
              }
            } catch (error) {
              console.error("❌ Copy operation failed:", error);
              if (typeof UniversalNotifications !== "undefined") {
                UniversalNotifications.error("Copy failed: " + error.message);
              }
            }

            return false; // Don't close modal
          },
        },
        {
          text: "Close",
          type: "secondary",
          action: "close",
        },
      ],
      allowBackgroundClose: true,
    });
  }

  /**
   * Generate HTML content for SCORM instructions modal
   * @param {string} filename - SCORM filename
   * @param {Object} metadata - Document metadata
   * @returns {string} HTML content
   */
  function generateSCORMInstructionsContent(filename, metadata) {
    const title = metadata.title || "Mathematical Document";

    return `
      <div class="scorm-instructions-modal">
        <div class="instructions-quick">
<h3>
  <svg height="24" width="24" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" class="action-icon upload-icon" aria-hidden="true">
    <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
      <path d="m11.5 4.5-3.978-4-4.022 4"/>
      <path d="m7.522.521v11.979"/>
      <path d="m.5 9v4.5c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-4.5"/>
    </g>
  </svg>
  Upload to Blackboard Ultra
</h3>
          <ol>
            <li><strong>In your Blackboard course:</strong> Select the <strong>Add</strong> button (+ icon)</li>
            <li><strong>From the menu:</strong> Select <strong>"Create"</strong></li>
            <li><strong>Choose content type:</strong> Select <strong>"SCORM Package"</strong></li>
<li><strong>Upload file:</strong> Choose <code>${escapeXML(
      filename
    )}</code></li>
            <li><strong>Ignore the warning:</strong> Blackboard may show "Some issues found" - this is normal and safe to ignore</li>
            <li><strong>Disable scoring (Important):</strong> Scroll halfway down and <strong>UNTICK the "Mark Score" checkbox</strong></li>
            <li><strong>Review description:</strong> Check the auto-generated description and adjust to your preferences</li>
            <li>Select other options according to your preferences</li>
            <li><strong>Save:</strong> Select the <strong>"Save"</strong> button when ready</li>
          </ol>
        </div>

        <div class="instructions-detailed">
          <details>
            <summary>
  <svg aria-hidden="true" class="action-icon document-list-icon" height="24" width="24" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)">
      <path d="m12.5 12.5v-10c0-1.1045695-.8954305-2-2-2h-8c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/>
      <path d="m5.5 4.5h5"/>
      <path d="m2.5 4.5h1"/>
      <path d="m5.5 7.5h5"/>
      <path d="m2.5 7.5h1"/>
      <path d="m5.5 10.5h5"/>
      <path d="m2.5 10.5h1"/>
    </g>
  </svg>
  Other LMS Systems & Troubleshooting
</summary>
            <div style="margin-top: 1rem;">
              <h4>Other Learning Management Systems</h4>
              <ul>
                <li><strong>Moodle:</strong> Course settings → Add an activity → SCORM package</li>
                <li><strong>Canvas:</strong> Modules → Add Item → External Tool → Upload SCORM</li>
                <li><strong>D2L Brightspace:</strong> Content → Upload/Create → SCORM</li>
                <li><strong>Most LMS:</strong> Look for "SCORM", "Content Package", or "IMS Package" options</li>
              </ul>

              <h4>
  <svg aria-hidden="true" class="action-icon warning-icon" height="24" width="24" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fill-rule="evenodd" transform="translate(1 1)">
      <path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="9.5" cy="13.5" fill="currentColor" r="1"/>
    </g>
  </svg>
  Troubleshooting
</h4>
              <ul>
                <li><strong>"Some issues found" in Blackboard:</strong> Safe to ignore - this is a false positive from Blackboard's strict validation</li>
                <li><strong>Mathematical expressions not rendering:</strong> Ensure JavaScript is enabled and internet access for MathJax CDN</li>
                <li><strong>Accessibility features not working:</strong> Check that assistive technology is compatible with modern JavaScript</li>
                <li><strong>Mobile viewing issues:</strong> SCORM packages work best in full browser windows rather than embedded frames</li>
              </ul>

              <h4><svg class="action-icon check-icon" height="24" width="24" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m12.8571123 1.79063546c-3.70547974-2.40636667-8.66011018-1.35322746-11.06647684 2.35225226-2.40636667 3.70547972-1.35322746 8.66011018 2.35225226 11.06647678 1.40713892.9138067 2.9944136 1.3287299 4.55387082 1.2889715 2.54712886-.0649393 5.02004606-1.3428829 6.51260596-3.6412237 1.5774991-2.4291355 1.6682799-5.39509184.4997393-7.82805117"/><path d="m4.5 7.5 3 3 8-8"/></g></svg> Content Features</h4>
<p>Your SCORM package "${escapeXML(title)}" includes:</p>
              <ul>
                <li>✓ WCAG 2.2 AA accessibility compliance</li>
                <li>✓ Screen reader support (JAWS, NVDA, VoiceOver)</li>
                <li>✓ Interactive MathJax expressions with context menus</li>
                <li>✓ Keyboard navigation throughout</li>
                <li>✓ High contrast theme options</li>
                <li>✓ Adjustable typography and reading tools</li>
                <li>✓ Responsive design for mobile/tablet/desktop</li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  /**
   * Copy SCORM instructions to clipboard
   */
  /**
   * Copy SCORM instructions to clipboard with enhanced debugging
   */
  async function copyInstructionsToClipboard() {
    logInfo("🔄 Starting copy to clipboard...");
    logInfo("🔍 Document focused:", document.hasFocus());
    logInfo("🔍 Active element:", document.activeElement.tagName);

    // Ensure document focus
    if (!document.hasFocus()) {
      logWarn("⚠️ Document not focused, attempting to focus...");
      window.focus();
      document.body.focus();

      // Wait a bit for focus to establish
      await new Promise((resolve) => setTimeout(resolve, 150));
      logInfo("🔍 After focus attempt:", document.hasFocus());
    }

    const instructions = `SCORM Package Upload Instructions

BLACKBOARD ULTRA:
1. In your Blackboard course: Click the Add button (+ icon)
2. From the menu: Select "Create"
3. Choose content type: Select "SCORM Package"
4. Upload file: Choose your downloaded SCORM ZIP file
5. Ignore the warning: Blackboard may show "Some issues found" - this is normal
6. Disable scoring (Important): Scroll halfway down and UNTICK the "Mark Score" checkbox
7. Review description: Check the auto-generated description and adjust to your preferences
8. Save: Click the "Save" button when ready

OTHER LMS SYSTEMS:
- Moodle: Course settings → Add an activity → SCORM package
- Canvas: Modules → Add Item → External Tool → Upload SCORM
- D2L Brightspace: Content → Upload/Create → SCORM

TROUBLESHOOTING:
- "Some issues found" warning in Blackboard: Safe to ignore
- Mathematical expressions not rendering: Ensure JavaScript enabled
- Accessibility features not working: Check assistive technology compatibility

Generated by Enhanced Pandoc-WASM Mathematical Playground`;

    logInfo("📝 Instructions text prepared, length:", instructions.length);

    // Check clipboard availability
    const hasClipboardAPI =
      navigator.clipboard && navigator.clipboard.writeText;
    const isSecureContext =
      location.protocol === "https:" || location.hostname === "localhost";

    logInfo("🔍 Clipboard environment check:");
    logInfo("- Clipboard API available:", hasClipboardAPI);
    logInfo("- Secure context:", isSecureContext);
    logInfo("- Protocol:", location.protocol);
    logInfo("- Hostname:", location.hostname);

    if (hasClipboardAPI && isSecureContext) {
      logInfo("✅ Using modern Clipboard API...");

      navigator.clipboard
        .writeText(instructions)
        .then(() => {
          logInfo("✅ Modern clipboard copy successful");
          // Show success notification
          if (typeof UniversalNotifications !== "undefined") {
            UniversalNotifications.success("Instructions copied to clipboard!");
          }
          return true;
        })
        .catch((err) => {
          logError("❌ Modern clipboard copy failed:", err);
          logInfo("🔄 Falling back to legacy method...");
          return fallbackCopyToClipboard(instructions);
        });
    } else {
      logWarn("⚠️ Modern clipboard not available, using fallback...");
      logInfo("🔄 Trying fallback copy method...");
      return fallbackCopyToClipboard(instructions);
    }
  }

  /**
   * Enhanced fallback copy method with better debugging
   * @param {string} text - Text to copy
   */
  function fallbackCopyToClipboard(text) {
    logInfo("🔄 Starting fallback clipboard copy...");

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      textArea.style.opacity = "0";
      textArea.setAttribute("aria-hidden", "true");
      textArea.setAttribute("readonly", "");

      document.body.appendChild(textArea);

      // Focus and select
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      logInfo("📝 Text area created and text selected");

      // Try execCommand
      const successful = document.execCommand("copy");
      logInfo("📋 execCommand('copy') result:", successful);

      if (successful) {
        logInfo("✅ Fallback copy successful!");
        if (typeof UniversalNotifications !== "undefined") {
          UniversalNotifications.success("Instructions copied to clipboard!");
        }
      } else {
        logError("❌ execCommand('copy') failed");
        showManualCopyFallback(text);
      }

      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      logError("❌ Fallback copy error:", err);
      showManualCopyFallback(text);
      return false;
    }
  }

  /**
   * Show manual copy instructions when all else fails
   * @param {string} text - Text to display for manual copying
   */
  function showManualCopyFallback(text) {
    logWarn("⚠️ All copy methods failed, showing manual copy option");

    if (typeof UniversalModal !== "undefined") {
      UniversalModal.custom(
        `
      <div style="margin-bottom: 1rem;">
        <p><strong>Automatic copying failed.</strong> Please manually copy the instructions below:</p>
      </div>
      <textarea readonly style="width: 100%; height: 200px; font-family: monospace; font-size: 0.875rem; padding: 1rem; border: 1px solid var(--sidebar-border); border-radius: 4px; background: var(--surface-color);">${escapeXML(
        text
      )}</textarea>
      <div style="margin-top: 1rem;">
        <p><em>Select all text above (Ctrl+A) and copy (Ctrl+C)</em></p>
      </div>
    `,
        {
          title: "Copy Instructions Manually",
          type: "info",
          size: "large",
          buttons: [
            {
              text: "Close",
              type: "primary",
              action: "close",
            },
          ],
        }
      );
    } else {
      // Last resort: console log
      console.log("📋 SCORM INSTRUCTIONS TO COPY:\n", text);
      alert(
        "Copy failed. Instructions have been logged to the browser console. Press F12 and look for the instructions."
      );
    }
  }

  /**
   * Fallback copy method for older browsers
   * @param {string} text - Text to copy
   */
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.setAttribute("aria-hidden", "true");

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        logInfo("Instructions copied using fallback method");
      } else {
        logError("Fallback copy failed");
      }
    } catch (err) {
      logError("Fallback copy error:", err);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Export current content as SCORM 2004 3rd Edition package
   * Phase 1: CDN-based MathJax implementation
   */
  async function exportEnhancedSCORM() {
    logInfo("=== SCORM EXPORT STARTED (CDN MODE) ===");

    // ✅ ENHANCED: Use SCORM-specific progress tracking to prevent duplicates
    if (window.scormExportInProgress) {
      logWarn("SCORM export already in progress - ignoring request");
      return;
    }

    // ✅ ENHANCED: Set SCORM-specific progress flag first
    window.scormExportInProgress = true;

    // Also check general export flag for compatibility
    if (window.exportGenerationInProgress) {
      logWarn(
        "General export already in progress - ignoring SCORM export request"
      );
      window.scormExportInProgress = false;
      return;
    }

    // Set general flag for compatibility with other systems
    window.exportGenerationInProgress = true;

    const exportButton = document.getElementById("exportSCORMButton");
    const outputContent = document.getElementById("output");

    // Validate prerequisites
    if (!outputContent || !outputContent.innerHTML.trim()) {
      alert(
        "Please render some LaTeX content first before exporting to SCORM."
      );
      // ✅ ENHANCED: Reset both progress flags
      window.scormExportInProgress = false;
      window.exportGenerationInProgress = false;
      return;
    }

    // Validate dependencies
    const depValidation = validateSCORMDependencies();
    if (!depValidation.success) {
      const missingList = depValidation.missing.join(", ");
      alert(
        `SCORM export requires: ${missingList}. Please refresh and try again.`
      );
      // ✅ ENHANCED: Reset both progress flags
      window.scormExportInProgress = false;
      window.exportGenerationInProgress = false;
      return;
    }

    let originalButtonContent = exportButton ? exportButton.innerHTML : "";

    try {
      // Update button state
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML =
          '<svg class="icon spinning" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">' +
          '<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>' +
          "</svg>" +
          "Generating SCORM Package...";
      }

      // Get and validate content
      const content = outputContent.innerHTML.trim();
      window.AppConfig.validateEnhancedContent(content);
      logInfo("Content validated for SCORM export");

      // Extract metadata
      const metadata = window.LaTeXProcessor.extractDocumentMetadata(content);
      metadata.contentSize = content.length;
      metadata.scormVersion = SCORM_CONFIG.VERSION;
      metadata.mathjaxMode = SCORM_CONFIG.MATHJAX_MODE;

      logInfo("Metadata extracted:", {
        title: metadata.title,
        sections: metadata.sections?.length || 0,
        size: metadata.contentSize,
        scormVersion: metadata.scormVersion,
      });

      // Generate enhanced HTML (same as regular export)
      logInfo("Generating enhanced HTML for SCORM package...");
      const standaloneHTML =
        await window.ExportManager.generateEnhancedStandaloneHTML(
          content,
          metadata.title,
          2 // Level 2 accessibility - full features
        );

      // Prepare HTML for SCORM environment
      const scormHTML = prepareSCORMHTML(
        standaloneHTML,
        SCORM_CONFIG.MATHJAX_MODE
      );
      logInfo("SCORM HTML prepared:", scormHTML.length, "characters");

      // Create SCORM package structure
      logInfo("Creating SCORM package structure...");
      const zip = new JSZip();

      // Add main content file
      zip.file(SCORM_CONFIG.CONTENT_FILENAME, scormHTML);

      // Generate and add SCORM files
      const manifest = generateSCORMManifest(metadata);
      const metadataXml = generateSCORMMetadata(metadata);
      const apiWrapper = generateSCORMAPIWrapper();

      zip.file(SCORM_CONFIG.MANIFEST_FILENAME, manifest);
      zip.file(SCORM_CONFIG.METADATA_FILENAME, metadataXml);
      zip.file(SCORM_CONFIG.API_FILENAME, apiWrapper);

      // Add instructor documentation
      const readme = generateInstructorReadme(metadata);
      zip.file("README.txt", readme);

      logDebug("SCORM package structure complete");

      // Generate ZIP file
      logInfo("Generating SCORM ZIP package...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: SCORM_CONFIG.COMPRESSION_LEVEL },
      });

      // Validate package size
      const sizeMB = zipBlob.size / (1024 * 1024);
      if (sizeMB > SCORM_CONFIG.MAX_PACKAGE_SIZE_MB) {
        const proceed = confirm(
          `SCORM package size (${sizeMB.toFixed(2)}MB) exceeds recommended ` +
            `${SCORM_CONFIG.MAX_PACKAGE_SIZE_MB}MB limit. Continue?`
        );
        if (!proceed) {
          throw new Error("Export cancelled due to package size");
        }
      }

      // Download SCORM package
      const scormFilename = generateSCORMFilename(metadata);

      // 🛡️ Record download for duplicate detection
      if (window.DownloadMonitor) {
        window.DownloadMonitor.recordDownload(scormFilename, {
          type: "scorm",
          size: zipBlob.size,
          source: "scorm-export-manager",
          metadata: {
            title: metadata.title || "Mathematical Document",
            sections: metadata.sections?.length || 0,
            scormVersion: SCORM_CONFIG.VERSION,
            mathjaxMode: SCORM_CONFIG.MATHJAX_MODE,
            compressionLevel: SCORM_CONFIG.COMPRESSION_LEVEL,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // Use enhanced download method to prevent duplicates
      logInfo("⬇️ Starting enhanced download process...");
      const downloadResult = await enhancedDownloadWithDuplicatePrevention(
        zipBlob,
        scormFilename
      );

      logInfo("✅ Download completed:", downloadResult);

      // Additional success handling based on download method
      if (downloadResult.requiresUserAction) {
        window.AppConfig.announceToScreenReader(
          `SCORM package ready for manual download. Please follow the instructions displayed.`
        );
      }

      // Success announcement with modal
      const features = [];
      if (metadata.sections?.length)
        features.push(`${metadata.sections.length} sections`);
      features.push("WCAG 2.2 AA accessibility");
      features.push("MathJax context menus");
      features.push("SCORM 2004 3rd Edition compliance");

      window.AppConfig.announceToScreenReader(
        `SCORM package "${scormFilename}" downloaded successfully with ${features.join(
          ", "
        )}. ` + "Upload instructions are now displayed."
      );

      // Show upload instructions modal
      setTimeout(() => {
        showSCORMInstructionsModal(scormFilename, metadata);
      }, 500); // Small delay to let download complete

      logInfo("✅ SCORM export completed successfully:", scormFilename);

      logInfo("✅ SCORM export completed successfully:", scormFilename);
      logInfo("📊 Package statistics:", {
        filename: scormFilename,
        size: sizeMB.toFixed(2) + "MB",
        htmlSize: Math.round(scormHTML.length / 1024) + "KB",
        scormVersion: SCORM_CONFIG.VERSION,
        mathjaxMode: SCORM_CONFIG.MATHJAX_MODE,
        accessibilityLevel: 2,
      });
    } catch (error) {
      logError("SCORM export error:", error);

      if (
        error.message.includes("No content") ||
        error.message.includes("cancelled")
      ) {
        if (!error.message.includes("cancelled")) {
          alert("SCORM export failed: " + error.message);
        }
      } else {
        alert(
          "SCORM export failed: " +
            error.message +
            "\n\nPlease try again or check the browser console for details."
        );
      }

      window.AppConfig.announceToScreenReader(
        "SCORM export failed. Please check the error message and try again."
      );
      // ✅ ENHANCED: Ensure flags are reset even in error cases
      window.scormExportInProgress = false;
    } finally {
      // ✅ ENHANCED: Reset both progress flags to prevent duplicates
      window.scormExportInProgress = false;
      window.exportGenerationInProgress = false;

      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = originalButtonContent;
      }
    }
  }

  // ===========================================================================================
  // UTILITY FUNCTIONS
  // ===========================================================================================

  /**
   * Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string} XML-safe text
   */
  function escapeXML(text) {
    if (typeof text !== "string") return text;

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Enhanced Academic SCORM Package Filename Generation
   * Format: Title_with_Underscores-Author_Year-SCORM_Package-Converted_on_YYYY-MM-DD.zip
   * Matches the academic paper style with clear SCORM identification
   */
  function generateSCORMFilename(metadata) {
    try {
      // ===========================================================================================
      // SCORM FILENAME CONFIGURATION (Easy to adjust)
      // ===========================================================================================

      const SCORM_FILENAME_CONFIG = {
        // Main separators (matching HTML filename style)
        WORD_SEPARATOR: "_", // For spaces within title/author names
        SECTION_SEPARATOR: "-", // Between major sections (title-author-scorm-date)

        // SCORM-specific templates
        SCORM_IDENTIFIER: "SCORM_Package", // Clear SCORM identification
        CONVERSION_TEMPLATE: "Packaged_on_", // Matches HTML filename style

        // Fallback values (matching HTML filename style)
        DEFAULT_TITLE: "Mathematical_Document",
        DEFAULT_AUTHOR: "Unknown_Author",
        DEFAULT_YEAR: new Date().getFullYear().toString(),

        // Length limits (slightly shorter for SCORM due to extra sections)
        MAX_TITLE_LENGTH: 50,
        MAX_AUTHOR_LENGTH: 25,

        // Character filtering
        ALLOWED_CHARS_REGEX: /[^a-zA-Z0-9\s]/g, // Remove special characters
        MULTIPLE_SPACES_REGEX: /\s+/g, // Collapse multiple spaces

        // File extension
        EXTENSION: ".zip",
      };

      // ===========================================================================================
      // DATE PROCESSING
      // ===========================================================================================

      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

      // ===========================================================================================
      // TITLE PROCESSING (Same as HTML filename)
      // ===========================================================================================

      let processedTitle;
      if (metadata.title && metadata.title.trim()) {
        processedTitle = metadata.title
          .trim()
          .replace(SCORM_FILENAME_CONFIG.ALLOWED_CHARS_REGEX, " ") // Remove special chars
          .replace(SCORM_FILENAME_CONFIG.MULTIPLE_SPACES_REGEX, " ") // Collapse spaces
          .trim()
          .slice(0, SCORM_FILENAME_CONFIG.MAX_TITLE_LENGTH) // Limit length
          .replace(/\s+/g, SCORM_FILENAME_CONFIG.WORD_SEPARATOR); // Spaces to underscores
      } else {
        processedTitle = SCORM_FILENAME_CONFIG.DEFAULT_TITLE;
      }

      // ===========================================================================================
      // AUTHOR PROCESSING (Same as HTML filename)
      // ===========================================================================================

      let processedAuthor;
      if (metadata.author && metadata.author.trim()) {
        processedAuthor = metadata.author
          .trim()
          .replace(SCORM_FILENAME_CONFIG.ALLOWED_CHARS_REGEX, " ") // Remove special chars
          .replace(SCORM_FILENAME_CONFIG.MULTIPLE_SPACES_REGEX, " ") // Collapse spaces
          .trim()
          .slice(0, SCORM_FILENAME_CONFIG.MAX_AUTHOR_LENGTH) // Limit length
          .replace(/\s+/g, SCORM_FILENAME_CONFIG.WORD_SEPARATOR); // Spaces to underscores
      } else {
        processedAuthor = SCORM_FILENAME_CONFIG.DEFAULT_AUTHOR;
      }

      // ===========================================================================================
      // YEAR PROCESSING (Same as HTML filename)
      // ===========================================================================================

      let documentYear;
      if (metadata.date) {
        // Try to extract year from various date formats
        const yearMatch = metadata.date.match(/\b(19|20)\d{2}\b/);
        documentYear = yearMatch
          ? yearMatch[0]
          : SCORM_FILENAME_CONFIG.DEFAULT_YEAR;
      } else {
        documentYear = SCORM_FILENAME_CONFIG.DEFAULT_YEAR;
      }

      // ===========================================================================================
      // SCORM FILENAME ASSEMBLY (Academic Paper Style with SCORM identifier)
      // ===========================================================================================

      const filenameParts = [
        processedTitle, // Mathematical_Foundations_A_Sample_Document
        processedAuthor + SCORM_FILENAME_CONFIG.WORD_SEPARATOR + documentYear, // Smith_2025
        SCORM_FILENAME_CONFIG.SCORM_IDENTIFIER, // SCORM_Package
        SCORM_FILENAME_CONFIG.CONVERSION_TEMPLATE + timestamp, // Converted_on_2025-08-19
      ];

      const filename =
        filenameParts.join(SCORM_FILENAME_CONFIG.SECTION_SEPARATOR) +
        SCORM_FILENAME_CONFIG.EXTENSION;

      // ===========================================================================================
      // VALIDATION & LOGGING
      // ===========================================================================================

      logInfo("Generated academic SCORM filename:", filename);
      logDebug("SCORM filename components:", {
        title: processedTitle,
        author: processedAuthor,
        year: documentYear,
        scormId: SCORM_FILENAME_CONFIG.SCORM_IDENTIFIER,
        timestamp: timestamp,
        totalLength: filename.length,
      });

      return filename;
    } catch (error) {
      logError("Error generating enhanced SCORM filename:", error);

      // ===========================================================================================
      // FALLBACK SCORM FILENAME (Academic Style)
      // ===========================================================================================

      const fallbackTimestamp = new Date().toISOString().slice(0, 10);
      const fallbackFilename = `Mathematical_Document-Unknown_Author-SCORM_Package-Converted_on_${fallbackTimestamp}.zip`;

      logWarn("Using fallback SCORM filename:", fallbackFilename);
      return fallbackFilename;
    }
  }

  /**
   * Generate instructor documentation
   * @param {Object} metadata - Document metadata
   * @returns {string} README content for instructors
   */
  function generateInstructorReadme(metadata) {
    const title = metadata.title || "Mathematical Document";
    const currentDate = new Date().toLocaleDateString("en-GB");

    return `SCORM Package: ${title}
Generated: ${currentDate}
Enhanced Pandoc-WASM Mathematical Playground

SCORM VERSION: ${SCORM_CONFIG.VERSION}
MATHJAX MODE: ${SCORM_CONFIG.MATHJAX_MODE.toUpperCase()}

QUICK START: UPLOADING TO BLACKBOARD ULTRA
===========================================
1. In your Blackboard course: Click the Add button (+ icon)
2. From the menu: Select "Create"
3. Choose content type: Select "SCORM Package"
4. Upload file: Choose this SCORM ZIP file
5. Ignore the warning: Blackboard may show "Some issues were found" - this is normal
6. Disable scoring (Important): Scroll halfway down and UNTICK the "Mark Score" checkbox
   (This removes unnecessary deadline/scoring options since there's no assessment)
7. Review description: Check the auto-generated description and adjust to your preferences
8. Save: Click the "Save" button when ready

UPLOADING TO OTHER LMS SYSTEMS
===============================
- Moodle: Course settings → Add an activity → SCORM package
- Canvas: Modules → Add Item → External Tool → Upload SCORM
- Most LMS: Look for "SCORM", "Content Package", or "IMS Package" options
- Always select SCORM 2004 3rd Edition when prompted for version

ACCESSIBILITY FEATURES
======================
✓ WCAG 2.2 AA Compliance
✓ Screen Reader Support (JAWS, NVDA, VoiceOver)
✓ MathJax Context Menus for mathematical navigation
✓ Keyboard Navigation throughout all content
✓ High Contrast Themes (light/dark modes)
✓ Adjustable Typography and Reading Tools
✓ Mathematical Expression Explorer

TECHNICAL REQUIREMENTS
======================
- Modern browser with JavaScript enabled
- MathJax CDN access recommended (current mode: ${SCORM_CONFIG.MATHJAX_MODE})
- Responsive design works on mobile/tablet/desktop
- No additional plugins required

MATHEMATICAL CONTENT
====================
This package contains interactive mathematical expressions with:
- LaTeX equation rendering via MathJax
- Context menus for mathematical exploration
- Screen reader accessible mathematical descriptions
- Zoom and navigation tools for complex expressions

TROUBLESHOOTING
===============
- "Some issues found" warning in Blackboard: Safe to ignore, content will work correctly
- Mathematical expressions not rendering: Ensure JavaScript is enabled and MathJax CDN is accessible
- Accessibility features not working: Check that assistive technology is compatible with modern JavaScript

Generated by Enhanced Pandoc-WASM Mathematical Playground
Designed for university STEM education with accessibility-first approach`;
  }

  // ===========================================================================================
  // TESTING AND VALIDATION
  // ===========================================================================================

  /**
   * Test SCORM export functionality
   * @returns {Object} Test results
   */
  function testSCORMExport() {
    logInfo("🧪 Testing SCORM export functionality...");

    try {
      // Test dependency validation
      const depValidation = validateSCORMDependencies();

      // Test manifest generation
      const testMetadata = {
        title: "Test Mathematical Document",
        author: "Test Author",
        sections: [{ title: "Introduction" }],
        contentSize: 50000,
      };

      const manifest = generateSCORMManifest(testMetadata);
      const metadata = generateSCORMMetadata(testMetadata);
      const apiWrapper = generateSCORMAPIWrapper();

      // Validate generated content
      const manifestValid =
        manifest.includes("<?xml") &&
        manifest.includes("ADL SCORM") &&
        manifest.includes("content.html");

      const metadataValid =
        metadata.includes("<?xml") &&
        metadata.includes("<lom xmlns") &&
        metadata.includes("mathematics");

      const apiValid =
        apiWrapper.includes("findSCORMAPI") &&
        apiWrapper.includes("Initialize") &&
        apiWrapper.includes("API_1484_11");

      const allValid =
        depValidation.success && manifestValid && metadataValid && apiValid;

      logInfo(
        allValid
          ? "✅ SCORM export tests passed"
          : "❌ SCORM export tests failed"
      );

      return {
        success: allValid,
        dependencies: depValidation.success,
        manifestGeneration: manifestValid,
        metadataGeneration: metadataValid,
        apiGeneration: apiValid,
        jsZipVersion: depValidation.jsZipVersion,
        mathjaxMode: SCORM_CONFIG.MATHJAX_MODE,
      };
    } catch (error) {
      logError("SCORM export test failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Switch MathJax mode (for Phase 2 local implementation)
   * @param {string} mode - "cdn" or "local"
   */
  function setMathJaxMode(mode) {
    if (mode === "cdn" || mode === "local") {
      SCORM_CONFIG.MATHJAX_MODE = mode;
      logInfo(`MathJax mode switched to: ${mode}`);
      return true;
    }
    logWarn("Invalid MathJax mode:", mode);
    return false;
  }

  // ===========================================================================================
  // INITIALIZATION
  // ===========================================================================================

  /**
   * Set up SCORM export handlers with comprehensive duplicate prevention
   */
  function setupSCORMExportHandlers() {
    // ✅ ENHANCED: Call stack tracing for debugging
    const caller = new Error().stack.split("\n")[2]?.trim() || "unknown";
    logInfo("Setting up SCORM export event handlers...");
    logDebug("🔍 Handler setup called from:", caller);

    // ✅ ENHANCED: Global function guard to prevent multiple setups
    if (window.scormHandlersSetup) {
      logWarn("⚠️ SCORM handlers already set up globally - skipping");
      return;
    }

    // Find SCORM export button
    const scormButton = document.getElementById("exportSCORMButton");

    if (!scormButton) {
      logError("SCORM export button not found - retrying in 100ms");
      // ✅ ENHANCED: Add retry limit to prevent infinite retries
      const retryCount = (window.scormButtonRetries || 0) + 1;
      if (retryCount <= 5) {
        window.scormButtonRetries = retryCount;
        setTimeout(setupSCORMExportHandlers, 100);
      } else {
        logError(
          "❌ SCORM export button not found after 5 retries - giving up"
        );
        window.scormButtonRetries = 0;
      }
      return;
    }

    // ✅ ENHANCED: Double-check for existing listeners
    if (scormButton.hasAttribute("data-scorm-initialized")) {
      logWarn(
        "SCORM export button already initialized with data attribute - skipping"
      );
      window.scormHandlersSetup = true;
      return;
    }

    // ✅ FIXED: Preserve button element - DON'T replace it
    // Instead, store a reference to our handler to avoid duplicates
    if (!window.scormButtonHandler) {
      window.scormButtonHandler = function (e) {
        logInfo("SCORM export button clicked");
        e.preventDefault();

        // ✅ ENHANCED: Prevent double-clicks during export
        if (window.scormExportInProgress) {
          logWarn("SCORM export already in progress - ignoring click");
          return;
        }

        exportEnhancedSCORM();
      };
    }

    // ✅ FIXED: Remove any existing listeners without replacing the element
    // This preserves AppStateManager's reference to the button
    scormButton.removeEventListener("click", window.scormButtonHandler);

    // Add our handler (safe even if it wasn't there before)
    scormButton.addEventListener("click", window.scormButtonHandler);

    // ✅ NEW: Mark as initialized at multiple levels
    scormButton.setAttribute("data-scorm-initialized", "true");
    window.scormHandlersSetup = true;

    // ✅ CRITICAL: Force enable button if AppStateManager is ready
    // This addresses the button enablement issue
    if (window.AppStateManager && window.AppStateManager.isReady()) {
      scormButton.disabled = false;
      logInfo("✅ SCORM button force-enabled (AppStateManager ready)");
    }

    logInfo(
      "✅ SCORM export handlers set up successfully with duplicate prevention"
    );
  }

  /**
   * Initialize SCORM export functionality with race condition protection
   */
  function initialiseSCORMExportFunctionality() {
    // ✅ ENHANCED: Call stack tracing for debugging
    const caller = new Error().stack.split("\n")[2]?.trim() || "unknown";
    logInfo("Initialising SCORM export functionality (CDN mode)...");
    logDebug("🔍 Initialization called from:", caller);

    // ✅ ENHANCED: Prevent duplicate initialization
    if (window.scormFunctionalityInitialized) {
      logWarn("⚠️ SCORM functionality already initialized - skipping");
      return true;
    }

    window.scormFunctionalityInitialized = true;

    try {
      const validation = validateSCORMDependencies();

      if (validation.success) {
        logInfo("✅ SCORM export functionality ready");
        logInfo("Configuration:", {
          scormVersion: SCORM_CONFIG.VERSION,
          mathjaxMode: SCORM_CONFIG.MATHJAX_MODE,
          jsZipVersion: validation.jsZipVersion,
        });

        // ✅ ENHANCED: DOM ready handling
        if (document.readyState === "loading") {
          document.addEventListener(
            "DOMContentLoaded",
            setupSCORMExportHandlers
          );
        } else {
          setupSCORMExportHandlers();
        }
      } else {
        logWarn("⚠️ SCORM export dependencies missing:", validation.missing);
        // Reset flag so we can try again later
        window.scormFunctionalityInitialized = false;
      }

      return validation.success;
    } catch (error) {
      logError("SCORM initialization error:", error);
      // Reset flag so we can try again later
      window.scormFunctionalityInitialized = false;
      return false;
    }
  }

  // ===========================================================================================
  // BROWSER DETECTION AND ALTERNATIVE DOWNLOAD METHODS
  // ===========================================================================================

  /**
   * Detect browser environment and potential download issues
   */
  function detectBrowserEnvironment() {
    const userAgent = navigator.userAgent;
    const isChrome =
      /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);

    // Detect potential problematic environments
    const hasDownloadExtensions = !!window.chrome?.downloads;
    const isIncognito =
      window.webkitRequestFileSystem === undefined &&
      window.safari === undefined;

    return {
      browser: isChrome
        ? "chrome"
        : isFirefox
        ? "firefox"
        : isSafari
        ? "safari"
        : isEdge
        ? "edge"
        : "unknown",
      isChrome,
      isFirefox,
      isSafari,
      isEdge,
      hasDownloadExtensions,
      isIncognito,
      userAgent,
    };
  }

  /**
   * Enhanced download method with browser-specific handling
   */
  async function enhancedDownloadWithDuplicatePrevention(zipBlob, filename) {
    logInfo("🚀 Starting enhanced download with duplicate prevention...");

    const browserInfo = detectBrowserEnvironment();
    logInfo("🌐 Browser environment:", browserInfo);

    // Method 1: Standard download with duplicate prevention
    if (!browserInfo.hasDownloadExtensions && !browserInfo.isIncognito) {
      logInfo("✅ Using standard download method (clean environment)");
      return await standardDownloadMethod(zipBlob, filename);
    }

    // Method 2: Alternative download for problematic environments
    logWarn("⚠️ Problematic environment detected, using alternative method");
    return await alternativeDownloadMethod(zipBlob, filename, browserInfo);
  }

  /**
   * Standard download method with enhanced monitoring
   */
  async function standardDownloadMethod(zipBlob, filename) {
    return new Promise((resolve, reject) => {
      try {
        // Create download link with enhanced attributes
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = filename;
        downloadLink.style.display = "none";
        downloadLink.setAttribute("aria-hidden", "true");
        downloadLink.setAttribute("data-download-id", Date.now());

        // Enhanced click tracking
        let clicked = false;
        downloadLink.addEventListener("click", function () {
          if (clicked) {
            logWarn("⚠️ Duplicate click prevented on download link");
            return false;
          }
          clicked = true;
          logInfo("🖱️ Download link clicked successfully");

          // Cleanup after short delay
          setTimeout(() => {
            if (document.body.contains(downloadLink)) {
              document.body.removeChild(downloadLink);
            }
            URL.revokeObjectURL(downloadLink.href);
            resolve({ method: "standard", success: true });
          }, 150);
        });

        // Append, click, and immediate protection
        document.body.appendChild(downloadLink);

        // Prevent rapid-fire clicks
        setTimeout(() => {
          if (!clicked) {
            downloadLink.click();
          }
        }, 10);
      } catch (error) {
        logError("❌ Standard download method failed:", error);
        reject(error);
      }
    });
  }

  /**
   * Alternative download method for problematic browsers
   */
  async function alternativeDownloadMethod(zipBlob, filename, browserInfo) {
    logInfo(
      "🔧 Using alternative download method for browser:",
      browserInfo.browser
    );

    try {
      // Method A: Use invisible iframe (works well in many browsers)
      if (browserInfo.isFirefox || browserInfo.isSafari) {
        return await iframeDownloadMethod(zipBlob, filename);
      }

      // Method B: Use data URL method (for smaller files)
      if (zipBlob.size < 50 * 1024 * 1024) {
        // < 50MB
        return await dataURLDownloadMethod(zipBlob, filename);
      }

      // Method C: Manual save dialog
      return await manualSaveMethod(zipBlob, filename);
    } catch (error) {
      logError("❌ All alternative methods failed:", error);

      // Final fallback: User instruction
      return await userInstructionFallback(zipBlob, filename);
    }
  }

  /**
   * Download using invisible iframe
   */
  async function iframeDownloadMethod(zipBlob, filename) {
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.style.position = "absolute";
      iframe.style.top = "-9999px";

      const blobUrl = URL.createObjectURL(zipBlob);
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
        resolve({ method: "iframe", success: true });
      }, 1000);

      logInfo("✅ Iframe download method initiated");
    });
  }

  /**
   * Download using data URL (for smaller files)
   */
  async function dataURLDownloadMethod(zipBlob, filename) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function () {
        const link = document.createElement("a");
        link.href = reader.result;
        link.download = filename;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        resolve({ method: "dataURL", success: true });
      };
      reader.readAsDataURL(zipBlob);

      logInfo("✅ Data URL download method initiated");
    });
  }

  /**
   * Manual save method with user guidance
   */
  async function manualSaveMethod(zipBlob, filename) {
    const blobUrl = URL.createObjectURL(zipBlob);

    // Show user instructions
    if (window.UniversalModal) {
      window.UniversalModal.show({
        title: "Manual Download Required",
        size: "medium",
        content: `
        <div style="text-align: center;">
          <p>Your browser requires manual download activation.</p>
          <p><strong>Right-click the link below and select "Save link as...":</strong></p>
          <br>
          <a href="${blobUrl}" download="${filename}" 
             style="display: inline-block; padding: 12px 24px; 
                    background: var(--primary-color, #007cba); color: white; 
                    text-decoration: none; border-radius: 4px; font-weight: bold;">
            📁 ${filename}
          </a>
          <br><br>
          <p style="font-size: 0.9em; color: var(--secondary-text, #666);">
            File size: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      `,
        buttons: [
          {
            text: "Done",
            type: "primary",
            action: "close",
          },
        ],
      });
    }

    return { method: "manual", success: true, requiresUserAction: true };
  }

  /**
   * Final fallback with user instructions
   */
  async function userInstructionFallback(zipBlob, filename) {
    logWarn("⚠️ Using final fallback method");

    // Create persistent download link
    const blobUrl = URL.createObjectURL(zipBlob);

    if (window.UniversalNotifications) {
      window.UniversalNotifications.warning(
        `Download ready: Right-click <a href="${blobUrl}" download="${filename}">this link</a> and save the file.`,
        { duration: 0 } // Persistent notification
      );
    }

    return { method: "fallback", success: true, requiresUserAction: true };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main export function
    exportEnhancedSCORM,

    // Enhanced export function
    enhancedDownloadWithDuplicatePrevention,
    detectBrowserEnvironment,

    // SCORM generators
    generateSCORMManifest,
    generateSCORMMetadata,
    generateSCORMAPIWrapper,
    prepareSCORMHTML,

    // Modal and UI functions
    showSCORMInstructionsModal,
    generateSCORMInstructionsContent,
    copyInstructionsToClipboard,
    fallbackCopyToClipboard,

    // Utilities
    generateSCORMFilename,
    generateInstructorReadme,
    escapeXML,

    // Configuration
    SCORM_CONFIG,
    setMathJaxMode, // For Phase 2

    // Validation and testing
    validateSCORMDependencies,
    testSCORMExport,

    // Initialization
    initialiseSCORMExportFunctionality,
    setupSCORMExportHandlers,

    // Logging (for debugging)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.SCORMExportManager = SCORMExportManager;

// ===========================================================================================
// GLOBAL INITIALIZATION GUARD
// ===========================================================================================

// ✅ CRITICAL: Prevent duplicate module initialization
if (!window.SCORMExportManagerInitialized) {
  window.SCORMExportManagerInitialized = true;

  // Auto-initialise with duplicate prevention
  SCORMExportManager.initialiseSCORMExportFunctionality();

  SCORMExportManager.logDebug(
    "✅ SCORMExportManager auto-initialization completed with global guard"
  );
} else {
  SCORMExportManager.logWarn(
    "⚠️ SCORMExportManager already initialized - skipping duplicate initialization"
  );
}
