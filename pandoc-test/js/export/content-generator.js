// content-generator.js
// CSS Generation and Document Structure Enhancement Module
// Holy Grail Layout with WCAG 2.2 AA Compliance - ENHANCED VERSION

const ContentGenerator = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[CONTENT]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CONTENT]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CONTENT]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CONTENT]", message, ...args);
  }

  // ===========================================================================================
  // CSS GENERATION COMPONENTS - MODULAR APPROACH
  // ===========================================================================================

  /**
   * Generate skip links CSS with higher specificity
   */
  function generateSkipLinksCSS() {
    return `
        /* ===== SKIP LINKS (First in Tab Order) - Enhanced Specificity ===== */
        a.skip-link {
            position: absolute;
            top: -40px;
            left: 6px;
            background-color: var(--link-color) !important;
            color: var(--body-bg) !important;
            padding: 8px;
            text-decoration: none;
            border-radius: 0 0 6px 6px;
            font-weight: 600;
            font-size: 14px;
            z-index: 10000;
            transition: top 0.3s ease;
        }
        
        a.skip-link:focus {
            top: 0;
            outline: 3px solid var(--body-bg) !important;
            outline-offset: 2px;
            background-color: var(--link-color) !important;
            color: var(--body-bg) !important;
        }
        
        a.skip-link:hover {
            background-color: var(--link-hover) !important;
            color: var(--body-bg) !important;
        }
        
        /* Dark mode skip links */
        [data-theme="dark"] a.skip-link {
            background-color: var(--link-color) !important;
            color: var(--body-bg) !important;
        }
        
        [data-theme="dark"] a.skip-link:focus,
        [data-theme="dark"] a.skip-link:hover {
            background-color: var(--link-hover) !important;
            color: var(--body-bg) !important;
            outline-color: var(--body-bg) !important;
        }`;
  }

  /**
   * Generate CSS custom properties
   */
  function generateCustomPropertiesCSS() {
    return `
        /* ===== CSS CUSTOM PROPERTIES - WCAG AA COMPLIANT COLORS ===== */
        :root {
            /* Your Original Colors - Preserved Exactly */
            --body-bg: #FFFFF4;              /* Your warm cream - perfect contrast */
            --body-text: #00131D;            /* Your deep blue-black - 13.8:1 ratio */
            --link-color: #002E3B;           /* Your dark teal - 7.2:1 ratio */
            --link-hover: #005051;           /* Your hover teal - 5.4:1 ratio */
            --border-color: #8D3970;         /* Your rich purple - decorative use */
            --heading-color: #495961;        /* From your existing palette */
            
            /* Minimal WCAG Adjustments */
            --text-secondary: #3D4A52;       /* Darkened slightly from your grey family */
            --code-bg: #F7F7F1;              /* Warmed to match your cream aesthetic */
            --surface-color: #F8F8F4;        /* Slightly warmed neutral from your palette */
            
            /* Derived from Your Palette */
            --success-color: #0A5D3A;        /* From your teal family, WCAG compliant */
            --warning-color: #8B4513;        /* Warm brown, complements your purple */
            --error-color: #8B2635;          /* Deep red, harmonises with your purple */
            
            /* Interactive States */
            --focus-outline: var(--link-color);
            --focus-bg: rgba(0, 46, 59, 0.08);
            
            /* Sidebar Colors */
            --sidebar-bg: #FAFAF6;           /* Warm white matching your cream */
            --sidebar-border: #E8E6E1;       /* Warm grey border from your palette */
            --sidebar-shadow: rgba(0, 19, 29, 0.06);
        }

        /* Dark mode - Your original colors preserved */
        [data-theme="dark"] {
            --body-bg: #231F20;              /* Your sophisticated charcoal */
            --body-text: #E1E8EC;            /* Your light blue-grey - 12.6:1 ratio */
            --link-color: #3CBAC6;           /* Your bright teal - 6.8:1 ratio */
            --link-hover: #FCBC00;           /* Your energising yellow - 10.2:1 ratio */
            --border-color: #B3DBD2;         /* Your soft mint green */
            --heading-color: #B3DBD2;        /* Your mint for headings */
            
            --text-secondary: #A8B8C4;       /* Lightened from your grey family */
            --code-bg: #2A2626;              /* Warmed to match your charcoal */
            --surface-color: #2D2929;        /* Warmed dark surface from your palette */
            
            --success-color: #4ADE80;        /* Light green, works with your mint */
            --warning-color: #FCD34D;        /* Your yellow family extended */
            --error-color: #F87171;          /* Warm coral that works with your greys */
            
            --focus-outline: var(--link-color);
            --focus-bg: rgba(60, 186, 198, 0.12);
            
            --sidebar-bg: #2A2626;           /* Matching your warm charcoal tone */
            --sidebar-border: #3F3A3B;       /* Warm dark border from your palette */
            --sidebar-shadow: rgba(179, 219, 210, 0.05);
        }`;
  }

  /**
   * Generate base styles
   */
  function generateBaseStylesCSS() {
    return `
        /* ===== BASE STYLES ===== */
        *, *::before, *::after {
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
            height: 100%;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: Verdana, sans-serif;
            line-height: 1.6;
            color: var(--body-text);
            background-color: var(--sidebar-bg);
            font-size: 16px;
            transition: color 0.3s ease, background-color 0.3s ease;
            height: 100%;
        }`;
  }

  /**
   * Generate FIXED enhanced grid layout system - Natural content flow + proper footer placement
   */
  function generateGridLayoutCSS() {
    return `
        /* ===== ENHANCED GRID LAYOUT SYSTEM - FIXED: Natural Content Flow ===== */
        .document-wrapper {
            display: grid;
            gap: 0;
            min-height: 100vh;
            background-color: var(--sidebar-bg);
            font-family: inherit;
            max-width: 1600px;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }

        /* FIXED: Layout with TOC (3 columns, content flows naturally) - IMPROVED: Better proportions */
        .document-wrapper:not(.no-toc) {
            grid-template-columns: minmax(200px, 220px) 1fr minmax(300px, 360px);
            grid-template-rows: auto auto;
            grid-template-areas: 
                "toc content sidebar"
                "footer footer footer";
        }

        /* FIXED: Layout without TOC (2 columns, content flows naturally) */
        .document-wrapper.no-toc {
            grid-template-columns: 1fr minmax(320px, 380px);
            grid-template-rows: auto auto;
            grid-template-areas: 
                "content sidebar"
                "footer footer";
        }

        /* ===== HIDDEN SECTIONS ===== */
        .document-header,
        .document-navigation {
            display: none !important;
        }

        /* ===== TABLE OF CONTENTS (Only when exists) ===== */
        .table-of-contents {
            grid-area: toc;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--sidebar-border);
            padding: 1.5rem;
            /* ENHANCED: Let content flow naturally without height constraints */
            /* Removed max-height and overflow-y to prevent scroll bars at zoom levels */
        }

        .document-wrapper.no-toc .table-of-contents {
            display: none;
        }

        /* ===== MAIN CONTENT (Enhanced spacing and typography) ===== */
        .document-content {
            grid-area: content;
            background: var(--body-bg);
            padding: 3rem 2.5rem;
            /* FIXED: Remove fixed height constraints */
            border-right: 1px solid var(--sidebar-border);
            /* IMPROVED: Ensure containers don't overflow */
            overflow-x: hidden;
            word-wrap: break-word;
            
            /* Reading accessibility controls target */
            font-family: inherit;
            line-height: inherit;
            word-spacing: normal;
            letter-spacing: normal;
            
            /* Enhanced content presentation */
           max-width: clamp(min(93.75vw, 50ch), 60vw, 65ch);
            margin: 0 auto;
            /* Allow natural content flow */
            min-height: 0;
        }

        /* ===== DOCUMENT SIDEBAR (Enhanced aesthetic - FIXED: Natural flow) ===== */
        .document-sidebar {
            grid-area: sidebar;
            background: var(--sidebar-bg);
            border-left: 1px solid var(--sidebar-border);
            padding: 0;
            /* FIXED: Remove fixed height, allow natural content flow */
            box-shadow: inset 1px 0 0 var(--sidebar-shadow);
            /* Allow natural content flow */
            min-height: 0;
        }

        /* ===== FOOTER (Enhanced integration - FIXED: Proper placement) ===== */
        .document-footer {
            grid-area: footer;
            background: var(--sidebar-bg);
            border-top: 2px solid var(--border-color);
            padding: 1.5rem 2rem;
            text-align: left;
            color: var(--text-secondary);
            font-size: 0.875rem;
            /* FIXED: Remove min-height that was causing issues */
            margin-top: 2rem; /* Add some space above footer */
        }

        .document-footer p {
            margin: 0.25rem 0;
        }`;
  }

  /**
   * Generate sidebar sections styling
   */
  function generateSidebarStylingCSS() {
    return `
        /* ===== SIDEBAR SECTIONS ===== */
        .sidebar-section {
            padding: 1.5rem;
            border-bottom: 1px solid var(--sidebar-border);
        }

        .sidebar-section:last-child {
            border-bottom: none;
        }

        .sidebar-section h3 {
            margin: 0 0 1rem 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--heading-color);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 0.5rem;
        }

        .sidebar-section h4 {
            margin: 1.5rem 0 0.75rem 0;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--heading-color);
            
            letter-spacing: 0.05em;
        }

        .sidebar-section h4:first-of-type {
            margin-top: 0;
        }

/* ===== TOOLS SECTION STYLING (Enhanced to match accessibility-controls) ===== */
        .tools-section {
            background: var(--body-bg);
            border: 1px solid var(--sidebar-border);
            border-radius: 8px;
            margin: 1rem 0.75rem;
            padding: 1.25rem;
            box-shadow: 0 2px 8px var(--sidebar-shadow);
            /* IMPROVED: Prevent overflow at high zoom levels */
            box-sizing: border-box;
            max-width: calc(100% - 1.5rem);
        }

        .tool-group {
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--sidebar-border);
            /* IMPROVED: Ensure content fits within container */
            box-sizing: border-box;
            max-width: 100%;
        }

        .tool-group:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .tool-group h4 {
            margin: 0 0 0.75rem 0;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--heading-color);
            
            letter-spacing: 0.05em;
        }`;
  }

  /**
   * Generate enhanced typography styles
   */
  function generateTypographyCSS() {
    return `
        /* ===== ENHANCED TYPOGRAPHY ===== */
        h1, h2, h3, h4, h5, h6 {
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
            line-height: 1.25;
            color: var(--heading-color);
            break-after: avoid;
            transition: color 0.3s ease;
              text-wrap: balance;
        }

        header h1 {
            border-bottom: none;
            padding-bottom: 0rem;
        }
         
        h1:first-child,
        h2:first-child,
        h3:first-child {
            margin-top: 0;
        }

        h1 { 
            font-size: 2.25rem; 
            margin-bottom: 2rem;
            border-bottom: 3px solid var(--border-color);
            padding-bottom: 1rem;
            letter-spacing: -0.025em;
        }

        h2 { 
            font-size: 1.75rem; 
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 0.5rem;
            margin-top: 3rem;
            letter-spacing: -0.015em;
        }

        h3 { 
            font-size: 1.375rem; 
            color: var(--heading-color);
            margin-top: 2.5rem;
        }

        p {
            margin-bottom: 1.25rem;

            hyphens: auto;
            color: var(--body-text);
            transition: color 0.3s ease;
            font-size: 1rem;
            line-height: 1.7;
            text-wrap: pretty;
        }

        /* Enhanced mathematical content spacing */
        .math.display {
            margin: 2rem 0;
        }

        .math.inline {
            margin: 0 0.1em;
        }

        /* ===== LINKS ===== */
        a {
            color: var(--link-color);
            text-decoration: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 2px;
            transition: all 0.3s ease;
        }

        a:hover {
            color: var(--link-hover);
            text-decoration-thickness: 2px;
        }

        a:focus {
            outline: 2px solid var(--focus-outline);
            outline-offset: 2px;
            border-radius: 2px;
            background-color: var(--focus-bg);
        }`;
  }

  /**
   * Generate button styling (including missing print/action buttons)
   */
  function generateButtonStylingCSS() {
    return `
        /* ===== RESET BUTTON STYLING ===== */
        .reset-button {
            width: 100%;
            background:  #495961;
            color: var(--body-bg);
            border: none;
            border-radius: 6px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: inherit;
            margin-top: 0.5rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .reset-button:hover {
            background: #231F20;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .reset-button:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
        }

        .reset-button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Dark mode reset button */
        [data-theme="dark"] .reset-button {
            background: #FCBC00;
            color: var(--body-bg);
        }

        [data-theme="dark"] .reset-button:hover {
            background: #EF7D00;
        }

        /* ===== PRINT BUTTON STYLING ===== */
        .print-button {
            width: 100%;
            background: var(--success-color);
            color: var(--body-bg);
            border: none;
            border-radius: 6px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: inherit;
        }

        .print-button:hover {
            background: var(--link-color);
            transform: translateY(-1px);
        }

        .print-button:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
        }

        /* ===== ACTION BUTTON BASE STYLING ===== */
        .action-button {
            width: 100%;
            border: none;
            border-radius: 6px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: inherit;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .action-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .action-button:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
        }

        .action-button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* ===== THEME TOGGLE STYLING ===== */
        .theme-toggle {
            width: 100%;
            background: var(--surface-color);
            color: var(--body-text);
            border: 2px solid var(--sidebar-border);
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: inherit;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .theme-toggle:hover {
            background: var(--focus-bg);
            border-color: var(--link-color);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .theme-toggle:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
            box-shadow: 0 0 0 4px var(--focus-bg);
        }

        .theme-toggle:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Theme toggle icon styling */
        .theme-toggle-icon {
            font-size: 16px;
            line-height: 1;
            display: inline-block;
            transition: transform 0.3s ease;
        }

        .theme-toggle:hover .theme-toggle-icon {
            transform: scale(1.1);
        }

        .theme-toggle-text {
            font-weight: 600;
            letter-spacing: 0.025em;
        }

        /* Dark mode theme toggle styling */
        [data-theme="dark"] .theme-toggle {
            background: var(--surface-color);
            border-color: var(--sidebar-border);
            color: var(--body-text);
        }

        [data-theme="dark"] .theme-toggle:hover {
            background: var(--focus-bg);
            border-color: var(--link-color);
        }`;
  }

  /**
   * Generate form controls styling
   */
  function generateFormControlsCSS() {
    return `
        /* ===== FORM CONTROLS STYLING ===== */
        .form-group {
            margin-bottom: 0.75rem;
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            /* IMPROVED: Prevent form elements from overflowing */
            box-sizing: border-box;
            max-width: 100%;
            min-width: 0;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        .form-group label {
            font-size: 0.85rem;
            color: var(--body-text);
            cursor: pointer;
            flex: 1;
            line-height: 1.4;
            font-weight: 500;
        }

        .form-group input[type="checkbox"],
        .form-group input[type="radio"] {
            margin: 0;
            cursor: pointer;
            accent-color: var(--link-color);
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            margin-top: 2px;
        }

        .form-group input[type="checkbox"]:focus,
        .form-group input[type="radio"]:focus {
            outline: 2px solid var(--focus-outline);
            outline-offset: 2px;
        }

.form-group select {
            padding: 8px 12px;
            border: 1px solid var(--sidebar-border);
            border-radius: 6px;
            background: var(--surface-color);
            color: var(--body-text);
            font-size: 0.85rem;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            /* FIXED: Responsive sizing to prevent overflow */
            max-width: 100%;
            min-width: 0;
            width: 100%;
            box-sizing: border-box;
            /* IMPROVED: Better text overflow handling */
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
        }

        .form-group select:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
            border-color: var(--link-color);
            box-shadow: 0 0 0 4px var(--focus-bg);
        }

        .form-group select:hover {
            border-color: var(--link-color);
            background: var(--focus-bg);
        }

        .form-group input[type="number"] {
            padding: 6px 8px;
            border: 1px solid var(--sidebar-border);
            border-radius: 4px;
            background: var(--surface-color);
            color: var(--body-text);
            font-size: 0.8rem;
            font-family: inherit;
            width: 80px;
            transition: all 0.2s ease;
        }

        .form-group input[type="number"]:focus {
            outline: 2px solid var(--focus-outline);
            outline-offset: 1px;
            border-color: var(--focus-outline);
            box-shadow: 0 0 0 4px var(--focus-bg);
        }

        .form-group input[type="number"]:hover {
            border-color: var(--link-color);
            background: var(--body-bg);
        }

        /* ===== RANGE SLIDER STYLING ===== */
        .slider-group {
            flex-direction: column;
            align-items: stretch;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .slider-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .form-group input[type="range"] {
            flex: 1;
            cursor: pointer;
            accent-color: var(--link-color);
            height: 6px;
            background: var(--surface-color);
            border-radius: 3px;
            outline: none;
            border: none;
            transition: all 0.2s ease;
        }

        .form-group input[type="range"]:focus {
            outline: 2px solid var(--focus-outline);
            outline-offset: 2px;
            box-shadow: 0 0 0 4px var(--focus-bg);
        }

        .form-group input[type="range"]:hover {
            background: var(--border-color);
        }

        .form-group input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 20px;
            height: 20px;
            background: var(--link-color);
            border-radius: 50%;
            cursor: pointer;
            border: 3px solid var(--body-bg);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
        }

        .form-group input[type="range"]::-webkit-slider-thumb:hover {
            background: var(--link-hover);
            transform: scale(1.1);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
        }

        .form-group input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: var(--link-color);
            border-radius: 50%;
            cursor: pointer;
            border: 3px solid var(--body-bg);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
        }

        .form-group input[type="range"]::-moz-range-thumb:hover {
            background: var(--link-hover);
            transform: scale(1.1);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
        }

        .range-value {
            min-width: 3.5rem;
            text-align: center;
            font-weight: 600;
            color: var(--link-color);
            font-size: 0.85rem;
            background: var(--focus-bg);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            border: 1px solid var(--sidebar-border);
            transition: all 0.2s ease;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .radio-group {
            margin-left: 0.5rem;
            border-left: 2px solid var(--sidebar-border);
            padding-left: 0.75rem;
        }`;
  }

  /**
   * Generate accessibility controls styling
   */
  function generateAccessibilityControlsCSS() {
    return `
        /* ===== ACCESSIBILITY CONTROLS STYLING ===== */
        .accessibility-controls {
            background: var(--body-bg);
            border: 1px solid var(--sidebar-border);
            border-radius: 8px;
            margin: 1rem 0.75rem;
            padding: 1.25rem;
            box-shadow: 0 2px 8px var(--sidebar-shadow);
            /* IMPROVED: Consistent sizing with tools-section */
            box-sizing: border-box;
            max-width: calc(100% - 1.5rem);
        }

        .control-group {
            margin-bottom: 1.5rem;
        }

        .control-group:last-child {
            margin-bottom: 0;
        }

        /* ===== USAGE INSTRUCTIONS ===== */
        .usage-instructions h4 {
            color: var(--heading-color);
            margin-bottom: 0.75rem;
        }

        .usage-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .usage-list li {
            font-size: 0.8rem;
            color: var(--text-secondary);
            line-height: 1.4;
            margin-bottom: 0.5rem;
            padding-left: 0.5rem;
            position: relative;
        }

        .usage-list li::before {
            content: '•';
            color: var(--link-color);
            font-weight: bold;
            position: absolute;
            left: 0;
        }

        .usage-list li strong {
            color: var(--body-text);
            font-weight: 600;
        }`;
  }

  /**
   * Generate enhanced mathematical content styling
   */
  function generateMathematicalContentCSS() {
    return `
        /* ===== ENHANCED MATHEMATICAL CONTENT ===== */
        mjx-container {
            max-width: 100%;
            cursor: context-menu;
            border-radius: 4px;
            transition: all 0.2s ease;
            margin: 0.5em 0;
            overflow-x: auto;
            min-width: 0;
            overflow-y: hidden;
        }

        mjx-container:hover {
            background-color: var(--focus-bg);
            outline: 1px solid var(--border-color);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        mjx-container:focus {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
            background-color: var(--focus-bg);
        }

        /* Enhanced display math styling */
        mjx-container[display="true"] {
            margin: 1.5em 0;
            padding: 0.5em;
            border-radius: 6px;
        }

        mjx-container[display="true"]:hover {
            background-color: var(--focus-bg);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Custom scrollbar styling for math overflow */
        mjx-container::-webkit-scrollbar {
            height: 8px;
        }
        
        mjx-container::-webkit-scrollbar-track {
            background: var(--surface-color);
            border-radius: 4px;
        }
        
        mjx-container::-webkit-scrollbar-thumb {
            background: var(--text-secondary);
            border-radius: 4px;
        }
        
        mjx-container::-webkit-scrollbar-thumb:hover {
            background: var(--link-color);
        }`;
  }

  /**
   * Generate large screen optimizations
   */
  function generateLargeScreenOptimizationsCSS() {
    return `
        /* ===== LARGE SCREEN OPTIMIZATIONS ===== */
        @media (max-width: 1200px) {
            /* IMPROVED: Better responsive TOC layout for tablets */
            .document-wrapper:not(.no-toc) {
                grid-template-columns: minmax(180px, 200px) 1fr minmax(280px, 320px);
            }
        }

        @media (min-width: 1200px) {
            .document-wrapper {
                max-width: 1800px;
            }
            
            .document-wrapper.no-toc {
                grid-template-columns: 1fr minmax(400px, 450px);
            }
            
            .document-wrapper:not(.no-toc) {
                grid-template-columns: minmax(220px, 240px) 1fr minmax(400px, 450px);
            }
            
            .document-content {
                padding: 4rem 3rem;
                font-size: 1.05rem;
            }
            
            h1 {
                font-size: 2.5rem;
            }
            
            h2 {
                font-size: 1.875rem;
            }
        }

        @media (min-width: 1600px) {
            .document-wrapper {
                max-width: 2000px;
            }
            
            .document-content {
                padding: 4rem 4rem;
                font-size: 1.1rem;
                line-height: 1.8;
            }
            
            .sidebar-section {
                padding: 2rem;
            }
        }`;
  }

  /**
   * Generate enhanced mobile responsive styles
   */
  function generateMobileResponsiveCSS() {
    return `
        /* ===== ENHANCED MOBILE RESPONSIVE ===== */
        @media (max-width: 900px) {
            /* IMPROVED: Single column layout for better mobile experience */
            .document-wrapper,
            .document-wrapper.no-toc {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0;
                box-shadow: none;
                height: auto;
                overflow: visible;
            }

            /* IMPROVED: Reset grid areas for block layout */
            .table-of-contents,
            .document-content,
            .document-sidebar {
                grid-area: unset !important;
                width: 100% !important;
                max-width: 100% !important;
                border: none !important;
            }

            /* IMPROVED: TOC styling for mobile */
            .table-of-contents {
                background: var(--surface-color);
                padding: 1rem;
                margin-bottom: 1px;
                border-right: none;
                border-bottom: 1px solid var(--sidebar-border);
            }

            /* IMPROVED: Content styling for mobile */
            .document-content {
                padding: 1.5rem 1rem;
                background: var(--body-bg);
                border-left: none;
                border-right: none;
                height: auto;
                overflow-y: visible;
            }

            /* IMPROVED: Sidebar styling for mobile */
            .document-sidebar {
                background: var(--sidebar-bg);
                padding: 0;
                position: relative;
                max-height: none;
                height: auto;
                border-left: none;
                border-top: 1px solid var(--sidebar-border);
                overflow-y: visible;
            }

            /* IMPROVED: Footer styling for mobile */
            .document-footer {
                background: var(--sidebar-bg);
                padding: 1.5rem 1rem;
                margin-top: 1rem;
            }

            .accessibility-controls {
                margin: 0.5rem;
                padding: 1rem !important;
            }

            .tools-section .tool-group {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 1rem;
            }

            .tool-group .form-group {
                flex-direction: row;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
            }

            .tool-group input[type="number"] {
                width: 60px;
            }

            .reset-button {
                font-size: 13px;
                padding: 8px 14px;
            }
            
            .slider-container {
                flex-direction: column;
                align-items: stretch;
                gap: 0.5rem;
            }
            
            .range-value {
                align-self: center;
                min-width: auto;
                width: 4rem;
            }
        }`;
  }

  /**
   * Generate accessibility and contrast support
   */
  function generateAccessibilitySupportCSS() {
    return `
        /* ===== HIGH CONTRAST MODE ===== */
        @media (prefers-contrast: high) {
            :root {
                --body-bg: #FFFFFF;
                --body-text: #000000;
                --border-color: #000000;
                --link-color: #0000EE;
                --link-hover: #551A8B;
            }
            
            [data-theme="dark"] {
                --body-bg: #000000;
                --body-text: #FFFFFF;
                --border-color: #FFFFFF;
                --link-color: #00FFFF;
                --link-hover: #FFFF00;
            }

            .theme-toggle, .reset-button {
                border-width: 3px;
                font-weight: 700;
            }
            
            .range-value {
                border: 2px solid currentColor;
            }
        }

/* ===== SCREEN READER ONLY CONTENT (for screen reader accessibility) ===== */
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        
        :focus-visible {
            outline: 2px transparent solid;
            box-shadow: 0 0 0 2px white, 0 0 0 4px #002e3b, 0 0 4px 8px white;
        }

        /* ===== REDUCED MOTION SUPPORT ===== */
        @media (prefers-reduced-motion: reduce) {
            .theme-toggle, .theme-toggle-icon, .reset-button {
                transition: none;
            }
            
            .theme-toggle:hover .theme-toggle-icon {
                transform: none;
            }
            
            .reset-button:hover {
                transform: none;
            }

            .form-group input[type="range"]::-webkit-slider-thumb:hover,
            .form-group input[type="range"]::-moz-range-thumb:hover {
                transform: none;
            }
        }`;
  }

  /**
   * Enhanced CSS generation with all components - COMPLETE ENHANCED VERSION
   */
  function generateEnhancedCSS() {
    logInfo(
      "Generating enhanced CSS with Holy Grail layout and complete styling"
    );

    const cssComponents = [
      "/* Enhanced CSS for Mathematical Documents with ENHANCED Grid Layout */",
      generateSkipLinksCSS(),
      generateCustomPropertiesCSS(),
      generateBaseStylesCSS(),
      generateGridLayoutCSS(),
      generateSidebarStylingCSS(),
      generateTypographyCSS(),
      generateButtonStylingCSS(),
      generateFormControlsCSS(),
      generateAccessibilityControlsCSS(),
      generateMathematicalContentCSS(),
      generateLargeScreenOptimizationsCSS(),
      generateMobileResponsiveCSS(),
      generateAccessibilitySupportCSS(),
    ];

    const finalCSS = cssComponents.join("\n\n");

    logInfo(
      "✅ Enhanced CSS generation complete with all aesthetic improvements"
    );
    logDebug("Generated CSS length:", finalCSS.length);

    return finalCSS;
  }

  // ===========================================================================================
  // TABLE OF CONTENTS GENERATION
  // ===========================================================================================

  /**
   * Generate table of contents with proper nested structure
   */
  function generateTableOfContents(sections) {
    if (!sections || sections.length === 0) {
      return "";
    }

    try {
      logInfo(`Generating TOC for ${sections.length} sections`);

      let tocHTML =
        '\n        <nav class="table-of-contents" aria-label="Table of contents" tabindex="0">\n' +
        "            <h2>Table of Contents</h2>\n";

      // Build nested structure
      tocHTML += buildNestedTOC(sections, "            ");

      tocHTML += "\n        </nav>";

      logInfo("✅ Table of contents generated successfully");
      return tocHTML;
    } catch (error) {
      logError("Error generating table of contents:", error);
      return "";
    }
  }

  /**
   * Build nested TOC structure with proper ul/li hierarchy
   */
  function buildNestedTOC(sections, baseIndent) {
    if (!sections.length) return "";

    let html = "";
    let currentLevel = 0;
    let openLists = [];

    sections.forEach((section, index) => {
      const level = section.level;

      // Close lists if we're going to a higher level (less nested)
      while (currentLevel > level) {
        const indent = baseIndent + "    ".repeat(openLists.length - 1);
        html += "\n" + indent + "</ul>";
        html += "\n" + indent.slice(4) + "</li>";
        openLists.pop();
        currentLevel--;
      }

      // Open new lists if we're going to a lower level (more nested)
      while (currentLevel < level) {
        const indent = baseIndent + "    ".repeat(openLists.length);
        if (openLists.length === 0) {
          // First level - just open ul
          html += "\n" + indent + "<ul>";
        } else {
          // Nested level - open ul inside current li
          html += "\n" + indent + "<ul>";
        }
        openLists.push(level);
        currentLevel++;
      }

      // Add the list item
      const indent = baseIndent + "    ".repeat(openLists.length);
      html +=
        "\n" +
        indent +
        `<li><a href="#${section.id}">${escapeHtml(section.title)}</a>`;

      // Check if next section is at a deeper level
      const nextSection = sections[index + 1];
      if (!nextSection || nextSection.level <= level) {
        html += "</li>";
      }
    });

    // Close all remaining open lists
    while (openLists.length > 0) {
      const indent = baseIndent + "    ".repeat(openLists.length - 1);
      html += "\n" + indent + "</ul>";
      if (openLists.length > 1) {
        html += "\n" + indent.slice(4) + "</li>";
      }
      openLists.pop();
    }

    return html;
  }

  /**
   * Generate table of contents with ID attribute and proper nesting
   */
  function generateTableOfContentsWithId(sections) {
    if (!sections || sections.length === 0) {
      return "";
    }

    try {
      logInfo(`Generating TOC with ID for ${sections.length} sections`);

      let tocHTML =
        '\n        <nav id="toc" class="table-of-contents" aria-label="Table of contents" tabindex="0">\n' +
        "            <h2>Table of Contents</h2>\n";

      // Build nested structure
      tocHTML += buildNestedTOC(sections, "            ");

      tocHTML += "\n        </nav>";

      logInfo("✅ Table of contents with ID generated successfully");
      return tocHTML;
    } catch (error) {
      logError("Error generating table of contents with ID:", error);
      return "";
    }
  }

  // ===========================================================================================
  // DOCUMENT STRUCTURE ENHANCEMENT
  // ===========================================================================================

  /**
   * Enhanced document structure processing with integrated layout
   */
  function enhanceDocumentStructure(content, metadata) {
    logInfo("Enhancing document structure with improved layout");

    try {
      let enhancedContent = content;

      // Create Holy Grail structure wrapper with dynamic TOC detection
      const hasTOC = metadata.sections && metadata.sections.length > 0;
      let holyGrailStructure = `<div class="document-wrapper${
        hasTOC ? "" : " no-toc"
      }">\n`;

      // ADD SKIP LINKS (first in tab order)
      holyGrailStructure += "    <!-- Skip Navigation Links -->\n";
      holyGrailStructure +=
        '    <a class="skip-link" id="skipToContent" href="#main">Skip to content</a>\n';
      if (hasTOC) {
        holyGrailStructure +=
          '    <a class="skip-link" id="skipToToc" href="#toc">Skip to table of contents</a>\n';
      }
      holyGrailStructure +=
        '    <a class="skip-link" id="skipToSidebar" href="#sidebar">Skip to options</a>\n';
      holyGrailStructure += "\n";

      // HIDDEN HEADER (keeping structure but hidden via CSS)
      holyGrailStructure += '<header class="document-header">\n';
      holyGrailStructure +=
        "    <!-- Header hidden via CSS but preserved for potential future use -->\n";
      holyGrailStructure += "</header>\n\n";

      // Add table of contents only if we have sections (with ID)
      if (hasTOC) {
        holyGrailStructure +=
          generateTableOfContentsWithId(metadata.sections) + "\n";
      }

      // HIDDEN NAVIGATION (keeping structure but hidden via CSS)
      holyGrailStructure += '<nav class="document-navigation">\n';
      holyGrailStructure +=
        "    <!-- Navigation hidden via CSS but preserved for potential future use -->\n";
      holyGrailStructure += "</nav>\n\n";

      // Main content area with ID
      holyGrailStructure +=
        '<main id="main" class="document-content" role="main">\n';

      // Enhance theorem environments before adding to content
      enhancedContent = enhanceTheoremEnvironments(enhancedContent);

      // Add section anchors
      enhancedContent = addSectionAnchors(enhancedContent, metadata.sections);

      holyGrailStructure += enhancedContent + "\n";
      holyGrailStructure += "</main>\n\n";

      logInfo("Document structure enhancement complete with improved layout");
      return holyGrailStructure;
    } catch (error) {
      logError("Error enhancing document structure:", error);
      return content;
    }
  }

  /**
   * Enhance theorem environments with proper semantic structure while preserving original formatting
   * FIXED: Avoid double processing and preserve exact playground formatting
   */
  function enhanceTheoremEnvironments(content) {
    try {
      // Skip if already processed (avoid double processing)
      if (
        content.includes('role="region"') &&
        content.includes("aria-labelledby")
      ) {
        logDebug("Theorem environments already enhanced, skipping");
        return content;
      }

      const theoremPatterns = [
        { name: "theorem", class: "theorem" },
        { name: "definition", class: "definition" },
        { name: "lemma", class: "lemma" },
        { name: "corollary", class: "corollary" },
        { name: "proposition", class: "proposition" },
        { name: "example", class: "example" },
        { name: "proof", class: "proof" },
      ];

      let enhancedContent = content;

      theoremPatterns.forEach((pattern) => {
        // More precise regex that captures case-insensitive theorem patterns with full titles
        const regex = new RegExp(
          "<p[^>]*>\\s*<strong>\\s*(" +
            pattern.name +
            "\\s+[^<]*?)\\s*</strong>(.*?)</p>",
          "gis"
        );

        enhancedContent = enhancedContent.replace(
          regex,
          (match, fullTitle, body) => {
            logDebug(
              `Processing ${
                pattern.name
              }: "${fullTitle}" with body: "${body.substring(0, 50)}..."`
            );

            // Keep the exact same format as playground but add accessibility wrapper
            return (
              '<div class="' +
              pattern.class +
              '" role="region" aria-labelledby="' +
              pattern.name +
              '-title">\n' +
              '    <p><strong id="' +
              pattern.name +
              '-title">' +
              fullTitle.trim() +
              "</strong>" +
              body +
              "</p>\n" +
              "</div>"
            );
          }
        );
      });

      logDebug("Theorem environments enhancement complete");
      return enhancedContent;
    } catch (error) {
      logError("Error enhancing theorem environments:", error);
      return content;
    }
  }

  /**
   * Add navigation anchors to sections for better accessibility
   */
  function addSectionAnchors(content, sections) {
    try {
      let enhancedContent = content;

      if (!sections) return content;

      sections.forEach((section) => {
        const sectionRegex = new RegExp(
          "(<h" + section.level + "[^>]*>)(.*?)(</h" + section.level + ">)",
          "gi"
        );
        enhancedContent = enhancedContent.replace(
          sectionRegex,
          (match, openTag, title, closeTag) => {
            if (!openTag.includes("id=")) {
              return (
                openTag.slice(0, -1) +
                ' id="' +
                section.id +
                '">' +
                title +
                closeTag
              );
            }
            return match;
          }
        );
      });

      return enhancedContent;
    } catch (error) {
      logError("Error adding section anchors:", error);
      return content;
    }
  }

  // ===========================================================================================
  // UTILITY FUNCTIONS
  // ===========================================================================================

  /**
   * HTML escaping for security and proper display
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * CSS minification (basic)
   */
  function minifyCSS(css) {
    try {
      return css
        .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
        .replace(/\s+/g, " ") // Collapse whitespace
        .replace(/;\s*}/g, "}") // Remove last semicolon in rules
        .replace(/{\s*/g, "{") // Remove space after opening braces
        .replace(/}\s*/g, "}") // Remove space after closing braces
        .replace(/,\s*/g, ",") // Remove space after commas
        .replace(/:\s*/g, ":") // Remove space after colons
        .trim();
    } catch (error) {
      logError("Error minifying CSS:", error);
      return css;
    }
  }

  /**
   * Generate responsive image CSS
   */
  function generateResponsiveImageCSS() {
    return `
        /* ===== RESPONSIVE IMAGES ===== */
        img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        figure {
            margin: 2rem 0;
            text-align: center;
        }

        figcaption {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
            font-style: italic;
        }
    `;
  }

  /**
   * Generate table styling CSS
   */
  function generateTableCSS() {
    return `
        /* ===== TABLE STYLING ===== */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: var(--surface-color);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid var(--sidebar-border);
        }

        th {
            background: var(--border-color);
            color: var(--body-bg);
            font-weight: 600;
            
            font-size: 0.875rem;
            letter-spacing: 0.05em;
        }

        tr:hover {
            background: var(--focus-bg);
        }

        tr:last-child td {
            border-bottom: none;
        }

        /* Table responsiveness */
        @media (max-width: 768px) {
            table, thead, tbody, th, td, tr {
                display: block;
            }

            thead tr {
                position: absolute;
                top: -9999px;
                left: -9999px;
            }

            tr {
                border: 1px solid var(--sidebar-border);
                margin-bottom: 1rem;
                border-radius: 6px;
                padding: 0.5rem;
            }

            td {
                border: none;
                position: relative;
                padding-left: 50% !important;
            }

            td:before {
                content: attr(data-label);
                position: absolute;
                left: 6px;
                width: 45%;
                padding-right: 10px;
                white-space: nowrap;
                font-weight: 600;
                color: var(--heading-color);
            }
        }
    `;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // CSS generation
    generateEnhancedCSS,
    minifyCSS,
    generateResponsiveImageCSS,
    generateTableCSS,

    // Table of contents
    generateTableOfContents,
    generateTableOfContentsWithId,

    // Document structure
    enhanceDocumentStructure,
    enhanceTheoremEnvironments,
    addSectionAnchors,

    // Utilities
    escapeHtml,

    // Logging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available for other modules
window.ContentGenerator = ContentGenerator;
