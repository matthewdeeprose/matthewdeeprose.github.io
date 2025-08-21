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

                  --success-bg: #e8f5e8;
            --success-text: #2d5a2d;
            --success-border: #4a7c4a;
            --success-hover: #d4f4d4;
            
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

            --success-bg: #2d5a2d;
            --success-text: #e8f5e8;
            --success-border: #4a7c4a;
            --success-hover: #3d6a3d;
            
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
   * Generate focus management styles for proper keyboard navigation
   */
  function generateFocusManagementCSS() {
    return `
        /* ===== FOCUS MANAGEMENT - KEYBOARD NAVIGATION ONLY ===== */
        /* Remove default focus outline for mouse/touch interactions */
        :focus:not(:focus-visible) {
            outline: none !important;
        }

        /* Apply focus styles only for keyboard navigation */
        :focus-visible {
            outline: 3px solid var(--focus-outline) !important;
            outline-offset: 2px !important;
            border-radius: 2px;
        }

        /* Enhanced focus for interactive elements */
        button:focus-visible,
        select:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        a:focus-visible,
        .theme-toggle:focus-visible,
        .reset-button:focus-visible,
        .print-button:focus-visible,
        .action-button:focus-visible,
        .focus-toggle-btn:focus-visible {
            outline: 3px solid var(--focus-outline) !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 4px var(--focus-bg);
        }

        /* MathJax containers */
        mjx-container:focus:not(:focus-visible) {
            outline: none;
            background-color: transparent;
        }

        mjx-container:focus-visible {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
            background-color: var(--focus-bg);
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
            grid-template-columns: minmax(220px, 240px) 1fr minmax(300px, 360px);
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

        /* Visual heading for TOC using CSS pseudo-element */
        .table-of-contents::before {
            content: "Table of Contents";
            display: block;
            font-size: 1rem;
            font-weight: 600;
            color: var(--heading-color);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
            line-height: 1.3;
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

.sidebar-section h2 {
            margin: 0 0 1rem 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--heading-color);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 0.5rem;
        }

        .sidebar-section h3 {
            margin: 1.5rem 0 0.75rem 0;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--heading-color);
            
            letter-spacing: 0.05em;
        }

        .sidebar-section h3:first-of-type {
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

/* Remove outline for mouse clicks on links */
        a:focus:not(:focus-visible) {
            outline: none;
        }

        a:focus-visible {
            outline: 2px solid var(--focus-outline);
            outline-offset: 2px;
            border-radius: 2px;
            background-color: var(--focus-bg);
        }
            /* ===== CREDITS AND ACKNOWLEDGEMENTS - DESCRIPTION LIST STYLING ===== */

/* Main credits section */
.credits-acknowledgements {
    background: linear-gradient(135deg, var(--body-bg) 0%, var(--surface-color) 100%);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2.5vw, 2rem);
    margin: 2rem 0;
    box-shadow: 0 4px 20px var(--sidebar-shadow);
    position: relative;
    box-sizing: border-box;
    max-width: 100%;
}

/* Subtle decorative top border */
.credits-acknowledgements::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--link-color), var(--border-color), var(--link-color));
    opacity: 0.6;
    border-radius: 12px 12px 0 0;
}

/* Credits heading */
.credits-acknowledgements h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--heading-color);
    margin: 0 0 1.5rem 0;
    line-height: 1.2;
    letter-spacing: -0.025em;
    font-family: var(--font-family-sans, inherit);
}

/* Description list container */
.credits-list {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* Definition terms (categories) */
.credits-list dt {
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--heading-color);
    margin: 0 0 0.5rem 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.25rem;
    display: inline-block;
    /* Ensure proper text wrapping */
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
}

/* Definition descriptions */
.credits-list dd {
    margin: 0 0 1.5rem 1rem;
    line-height: 1.6;
    color: var(--body-text);
    font-size: 1rem;
    /* Ensure proper text wrapping */
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    max-width: 100%;
}

/* Last description item spacing */
.credits-list dd:last-child {
    margin-bottom: 0;
}

/* Links styling within credits */
.credits-list a {
    color: var(--link-color);
    text-decoration: underline;
    font-weight: 500;
    transition: color 0.3s ease, text-decoration-color 0.3s ease;
}

.credits-list a:hover,
.credits-list a:focus {
    color: var(--link-hover);
    text-decoration: none;
}

/* Enhanced focus styles for links */
.credits-list a:focus-visible {
    outline: 3px solid var(--focus-outline);
    outline-offset: 2px;
    border-radius: 2px;
    background-color: var(--focus-bg);
    padding: 0.125rem 0.25rem;
    margin: -0.125rem -0.25rem;
}

/* Dark mode enhancements */
[data-theme="dark"] .credits-acknowledgements {
    background: linear-gradient(135deg, var(--surface-color) 0%, var(--sidebar-bg) 100%);
    border-color: var(--sidebar-border);
    box-shadow: 0 8px 32px rgba(179, 219, 210, 0.08);
}

[data-theme="dark"] .credits-list dt {
    border-bottom-color: var(--border-color);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .credits-acknowledgements {
        padding: 1.25rem 1rem;
        margin: 1.5rem 0;
    }
    
    .credits-list dd {
        margin-left: 0.5rem;
    }
    
    .credits-acknowledgements h3 {
        font-size: 1.375rem;
    }
    
    .credits-list dt {
        font-size: 1.0625rem;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .credits-list dt {
        border-bottom-width: 3px;
    }
    
    .credits-list a {
        text-decoration-thickness: 2px;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    .credits-list a {
        transition: none;
    }
}
        `;
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

        .print-button:focus-visible {
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

        .action-button:focus-visible {
            outline: 3px solid var(--focus-outline);
            outline-offset: 2px;
        }

        .action-button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .action-button.save-button {
            background: var(--success-bg, #e8f5e8);
            color: var(--success-text, #2d5a2d);
            border: 2px solid var(--success-border, #4a7c4a);
        }
            .action-button.save-button {margin-bottom: .5rem;}

        .action-button.save-button:hover {
            background: var(--success-hover, #d4f4d4);
            transform: translateY(-1px);
        }

        .action-button.save-button:focus {
            outline: 3px solid var(--focus-color);
            outline-offset: 2px;
        }

.action-button:hover .action-icon {
  transform: scale(1.1);
}

.action-button {
  stroke-width: 1.5; /* Adjust line thickness if needed */
}
  .action-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
  .theme-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .theme-icon {
    transition: none;
  }
}

.theme-toggle:hover .theme-icon {
  transform: rotate(15deg);
}

@media (prefers-reduced-motion: reduce) {
  .theme-toggle:hover .theme-icon {
    transform: none;
  }
}

.theme-toggle-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 0.5rem;
}
  .reset-icon {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .reset-icon {
    transition: none;
  }
}

.reset-button:hover .reset-icon {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .reset-button:hover .reset-icon {
    transform: none;
  }
}

.reset-button:active .reset-icon {
  transform: rotate(360deg);
}

@media (prefers-reduced-motion: reduce) {
  .reset-button:active .reset-icon {
    transform: none;
  }
}
  .heading-icon {
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5rem;
}

.action-icon {
  flex-shrink: 0;
  vertical-align: middle;
  margin-right: 0.5rem;
}







@media (prefers-reduced-motion: reduce) {
  .action-button:hover .action-icon {
    transform: none;
  }
}



        /* ===== THEME TOGGLE STYLING ===== */
        .theme-toggle {
            width: 100%;
            background: var(--surface-color);
            color: var(--body-text);
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

        .theme-toggle:focus-visible {
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

        /* Remove outline for mouse clicks on checkboxes/radios */
        .form-group input[type="checkbox"]:focus:not(:focus-visible),
        .form-group input[type="radio"]:focus:not(:focus-visible) {
            outline: none;
        }

        .form-group input[type="checkbox"]:focus-visible,
        .form-group input[type="radio"]:focus-visible {
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

        /* Remove outline for mouse clicks on selects */
        .form-group select:focus:not(:focus-visible) {
            outline: none;
        }

        .form-group select:focus-visible {
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

        /* Remove outline for mouse clicks on number inputs */
        .form-group input[type="number"]:focus:not(:focus-visible) {
            outline: none;
        }

        .form-group input[type="number"]:focus-visible {
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

        /* Remove outline for mouse clicks on range sliders */
        .form-group input[type="range"]:focus:not(:focus-visible) {
            outline: none;
        }

        .form-group input[type="range"]:focus-visible {
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

        mjx-container:focus-visible {
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
   * Generate print-specific CSS styles for exported HTML documents
   * Fixes gaps and spacing issues when printing mathematical content
   */
  function generatePrintCSS() {
    return `
        /* ===== ENHANCED PRINT STYLES - BOOTSTRAP-INSPIRED UNIVERSAL RESET ===== */
        @media print {
            /* CRITICAL: Bootstrap-style universal reset - removes ALL visual effects */
            *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
                
                /* Universal reset for print context */
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
                transform: none !important;
                box-shadow: none !important;
                text-shadow: none !important;
            }

            .distraction-free-controls {display: none !important;}

            /* BREAKTHROUGH FIX: Complete mjx-container reset - let MathJax handle everything */
            mjx-container, 
            mjx-container[display="true"], 
            mjx-container:not([display="true"]),
            mjx-container:hover,
            mjx-container:focus,
            mjx-container:focus-visible {
                /* Complete CSS reset - removes ALL custom styling */
                all: unset !important;
                
                /* Restore only essential display properties */
                display: revert !important;
                font-family: revert !important;
                font-size: revert !important;
                color: revert !important;
                
                /* Let MathJax's default print behavior work */
                margin: revert !important;
                padding: revert !important;
                background: revert !important;
                border: revert !important;
                
                /* Ensure page break avoidance */
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                
                /* Remove any interfering properties */
                cursor: default !important;
                border-radius: 0 !important;
                outline: none !important;
                max-width: 100% !important;
                overflow: visible !important;
            }

            /* OPTIMIZED: Document layout for printing */
            .document-wrapper {
                display: block !important;
                grid-template-columns: none !important;
                grid-template-areas: none !important;
                max-width: none !important;
                box-shadow: none !important;
                background: white !important;
            }

            /* Hide interactive elements when printing */
            .document-sidebar,
            .table-of-contents,
            .document-navigation,
            .skip-link {
                display: none !important;
            }

            /* Optimize main content for printing */
            .document-content {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                background: white !important;
                grid-area: unset !important;
                overflow: visible !important;
            }

            /* ENHANCED: Page break optimization for semantic elements */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid !important;
                break-after: avoid !important;
                margin-top: 1em !important;
                margin-bottom: 0.5em !important;

            }

            /* Orphans and widows optimization */
            p, li, blockquote {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                orphans: 3 !important;
                widows: 3 !important;
            }

            /* Academic content boxes */
            .definition, .theorem, .example, .proof {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin: 0.5em 0 !important;
                padding: 0.5em !important;

            }

            .credits-acknowledgements {
        background: white !important;
        border: 1px solid #333 !important;
        box-shadow: none !important;
        page-break-inside: avoid;
    }
    
    .credits-acknowledgements::before {
        display: none;
    }
    
    .credits-list dt {
        color: #000 !important;
        border-bottom-color: #333 !important;
    }
    
    .credits-list dd {
        color: #000 !important;
    }
    
    .credits-list a {
        color: #000 !important;
        text-decoration: underline !important;
    }

            /* List optimisation */
            ul, ol {
                margin: 0.5em 0 !important;
                padding-left: 1.5em !important;
            }

            li {
                margin-bottom: 0.2em !important;
            }

            /* Footer optimisation */
            .document-footer {
                margin-top: 2em !important;
                padding: 1em 0 !important;
                border-top: 1px solid #ccc !important;
                background: transparent !important;
                font-size: 0.8em !important;
            }

            /* ENHANCED: Force light mode CSS custom properties for ALL elements */
            :root, [data-theme="dark"] {
                --body-bg: #fff !important;
                --body-text: #000 !important;
                --link-color: #000 !important;
                --link-hover: #000 !important;
                --border-color: #333 !important;
                --heading-color: #000 !important;
                --text-secondary: #333 !important;
                --code-bg: #f5f5f5 !important;
                --surface-color: #fff !important;
                --success-color: #000 !important;
                --warning-color: #000 !important;
                --error-color: #000 !important;
                --focus-outline: #000 !important;
                --focus-bg: transparent !important;
                --sidebar-bg: #fff !important;
                --sidebar-border: #ccc !important;
                --sidebar-shadow: none !important;
            }

            /* CRITICAL: Force all elements to use light colours */
            *, *::before, *::after {
                color: #000 !important;
                background: transparent !important;
                background-color: transparent !important;
                border-color: #666 !important;
                outline-color: #000 !important;
            }

            /* Ensure good contrast for printing */
            body, .document-content {
                color: #000 !important;
                background: #fff !important;
            }

            /* Links should be readable when printed */
            a {
                color: #000 !important;
                text-decoration: underline !important;
            }

            /* Print-friendly tables */
            table {
                border-collapse: collapse !important;
                width: 100% !important;
                page-break-inside: auto !important;
            }

            tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            th, td {
                border: 1px solid #ccc !important;
                padding: 0.5em !important;
            }

            /* CRITICAL: Force proper page margins */
            @page {
                margin: 1in !important;
                size: letter !important;
            }

            /* Remove any custom scrollbars that might affect printing */
            ::-webkit-scrollbar {
                display: none !important;
            }
                /* ===== TITLE BLOCK PRINT OPTIMISATION ===== */
            #title-block-header {
                background: white !important;
                border: 2px solid #333 !important;
                border-radius: 0 !important;
                padding: 1.5rem 1rem 1rem !important;
                margin: 0 0 2rem 0 !important;
                text-align: center !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
            }

            /* Remove decorative elements for print */
            #title-block-header::before {
                display: none !important;
            }

            /* Print-optimised title */
            #title-block-header .title {
                font-size: 1.75rem !important;
                font-weight: 700 !important;
                color: #000 !important;
                margin: 0 0 0.75rem 0 !important;
                line-height: 1.2 !important;
                letter-spacing: -0.01em !important;
            }

            /* Print-optimised author */
            #title-block-header .author {
                font-size: 1rem !important;
                font-weight: 500 !important;
                color: #333 !important;
                margin: 0 0 0.25rem 0 !important;
                line-height: 1.3 !important;
            }

            /* Print-optimised date */
            #title-block-header .date {
                font-size: 0.875rem !important;
                font-weight: 400 !important;
                color: #666 !important;
                margin: 0 !important;
                opacity: 1 !important;
            }

            /* Ensure title block doesn't break across pages */
            #title-block-header * {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            /* Add some space after title block */
            #title-block-header + * {
                margin-top: 1.5rem !important;
            }
        }`;
  }

  /**
   * Generate large screen optimizations
   */
  function generateLargeScreenOptimizationsCSS() {
    return `
        /* ===== LARGE SCREEN OPTIMIZATIONS ===== */
        @media (max-width: 1200px) {
            /* IMPROVED: Better responsive TOC layout for tablets - Enhanced TOC width */
            .document-wrapper:not(.no-toc) {
               grid-template-columns: minmax(220px, 240px) 1fr minmax(240px, 260px);
            }
        }

        @media (min-width: 1200px) {
            .document-wrapper {
                max-width: 1800px;
            }
            
            .document-wrapper.no-toc {
                grid-template-columns: 1fr minmax(300px, 350px);
            }
            
.document-wrapper:not(.no-toc) {
                grid-template-columns: minmax(240px, 260px) 1fr minmax(300px, 350px);
            }
            
.document-content {
                padding: 2rem 3rem 4rem 3rem;
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
                padding: 2rem 4rem 4rem 4rem;
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

/* ===== READING WIDTH CONTROL CLASSES (MISSING FROM EXPORT) ===== */
.document-content.width-extra-narrow {
    max-width: 50ch !important;
}

.document-content.width-narrow {
    max-width: 65ch !important;
}

.document-content.width-wide {
    max-width: 80ch !important;
}

.document-content.width-full {
    max-width: 100% !important;
}

/* Responsive behavior for reading width classes */
@media (max-width: 900px) {
    .document-content.width-extra-narrow,
    .document-content.width-narrow,
    .document-content.width-wide,
    .document-content.width-full {
        max-width: 100% !important;
        padding: 1.5rem 1rem;
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
        }
            
        /* ===== ASSISTIVE MATHJAX MESSAGE STYLING ===== */
.assistive-mathml-message {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    line-height: 1.4;
    transition: all 0.3s ease;
    border: 1px solid;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Success state (when MathML is disabled) */
.assistive-mathml-message.success {
    background: color-mix(in srgb, var(--success-color) 10%, var(--body-bg));
    border-color: var(--success-color);
    color: var(--success-color);
}

/* Warning state (when refresh is required) */
.assistive-mathml-message.warning {
    background: color-mix(in srgb, var(--warning-color) 15%, var(--body-bg));
    border-color: var(--warning-color);
    color: var(--warning-color);
}

/* Dark mode adjustments */
[data-theme="dark"] .assistive-mathml-message.success {
    background: color-mix(in srgb, var(--success-color) 15%, var(--body-bg));
    color: var(--success-color);
}

[data-theme="dark"] .assistive-mathml-message.warning {
    background: color-mix(in srgb, var(--warning-color) 20%, var(--body-bg));
    color: var(--warning-color);
}

/* Message content layout */
.message-content {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
}

.message-icon {
    font-size: 1rem;
    line-height: 1;
    margin-top: 1px;
    flex-shrink: 0;
}

.message-text {
    flex: 1;
    min-width: 0;
}

.message-text strong {
    font-weight: 600;
    color: inherit;
}

/* Message buttons container */
.message-buttons {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

/* Message button styling */
.message-button {
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.message-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.message-button:focus-visible {
    outline: 2px solid var(--focus-outline);
    outline-offset: 2px;
}

.message-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Primary button (main action) */
.message-button.primary {
    background: var(--success-color);
    color: var(--body-bg);
}

.message-button.primary:hover {
    background: color-mix(in srgb, var(--success-color) 85%, black);
}

/* Warning primary button */
.assistive-mathml-message.warning .message-button.primary {
    background: var(--warning-color);
    color: var(--body-bg);
}

.assistive-mathml-message.warning .message-button.primary:hover {
    background: color-mix(in srgb, var(--warning-color) 85%, black);
}

/* Secondary button (cancel/dismiss) */
.message-button.secondary {
    background: var(--text-secondary);
    color: var(--body-bg);
}

.message-button.secondary:hover {
    background: color-mix(in srgb, var(--text-secondary) 80%, black);
}

/* Dark mode button adjustments */
[data-theme="dark"] .message-button.primary {
    background: var(--success-color);
    color: var(--body-bg);
}

[data-theme="dark"] .assistive-mathml-message.warning .message-button.primary {
    background: var(--warning-color);
    color: var(--body-bg);
}

[data-theme="dark"] .message-button.secondary {
    background: var(--text-secondary);
    color: var(--body-bg);
}

/* Responsive adjustments */
@media (max-width: 900px) {
    .assistive-mathml-message {
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        padding: 0.75rem;
    }
    
    .message-buttons {
        flex-direction: column;
    }
    
    .message-button {
        width: 100%;
        justify-content: center;
    }
}
        
        
        `;
  }

  /**
   * Generate document title block styling for exported HTML documents
   * Integrates with existing design system and custom properties
   */
  function generateTitleBlockCSS() {
    return `
        /* ===== DOCUMENT TITLE BLOCK STYLING ===== */
        #title-block-header {
            background: linear-gradient(135deg, var(--body-bg) 0%, var(--surface-color) 100%);
            border: 1px solid var(--sidebar-border);
            border-radius: 12px;
            padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2.5vw, 2rem) clamp(1.5rem, 3vw, 2rem);
            margin: 0 0 3rem 0;
            text-align: left;
            box-shadow: 0 4px 20px var(--sidebar-shadow);

            /* FIXED: Remove overflow hidden and add proper text wrapping */
            box-sizing: border-box;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
        }

        /* Subtle decorative element */
        #title-block-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--link-color), var(--border-color), var(--link-color));
            opacity: 0.6;
        }

        /* Document title styling - FIXED: Ensure proper text wrapping */
        #title-block-header .title {
            font-size: 2.25rem;
            font-weight: 700;
            color: var(--heading-color);
            margin: 0 0 1rem 0;
            line-height: 1.2;
            letter-spacing: -0.025em;
            font-family: var(--font-family-sans);
            /* FIXED: Add text wrapping rules */
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            max-width: 100%;
        }

        /* Author styling - FIXED: Ensure proper text wrapping */
        #title-block-header .author {
            font-size: 1.125rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin: 0 0 0.5rem 0;
            line-height: 1.4;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
        }

        /* Date styling - FIXED: Ensure proper text wrapping */
        #title-block-header .date {
            font-size: 1rem;
            font-weight: 400;
            color: var(--text-secondary);
            margin: 0;
            opacity: 0.8;
            font-variant-numeric: tabular-nums;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-width: 100%;
        }

        /* Enhanced styling for dark mode */
        [data-theme="dark"] #title-block-header {
            background: linear-gradient(135deg, var(--surface-color) 0%, var(--sidebar-bg) 100%);
            border-color: var(--sidebar-border);
            box-shadow: 0 8px 32px rgba(179, 219, 210, 0.08);
        }

        [data-theme="dark"] #title-block-header::before {
            background: linear-gradient(90deg, var(--link-color), var(--border-color), var(--link-hover));
            opacity: 0.8;
        }

        [data-theme="dark"] #title-block-header .title {
            color: var(--heading-color);
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            #title-block-header {
                padding: 2rem 1.5rem 1.5rem;
                margin: 0 0 2rem 0;
                border-radius: 8px;
            }

            #title-block-header .title {
                font-size: 1.875rem;
                margin-bottom: 0.75rem;
            }

            #title-block-header .author {
                font-size: 1rem;
                margin-bottom: 0.25rem;
            }

            #title-block-header .date {
                font-size: 0.875rem;
            }
        }

        @media (max-width: 480px) {
            #title-block-header .title {
                font-size: 1.5rem;
                line-height: 1.3;
            }
        }`;
  }

  /**
   * Generate distraction-free mode CSS for neurodivergent users
   */
  function generateDistractionFreeCSS() {
    logInfo("Generating distraction-free mode CSS for neurodivergent users");

    return `
      /* ===== DISTRACTION-FREE MODE FOR NEURODIVERGENT USERS ===== */
      
/* Distraction-free controls container - horizontal inline layout */
      .distraction-free-controls {

          margin: 0.5rem 0;
          border: none;
          border-radius: 0;
      }
      
      .distraction-free-controls h3 {
          display: inline;
          font-size: 0.8rem;
          margin: 0 1rem 0 0;
          font-weight: 500;
          color: var(--text-secondary);
          vertical-align: middle;
      }
      
/* Focus controls layout - horizontal inline */
      .focus-controls {
          display: inline-flex;
          gap: 0.5rem;
          align-items: center;
      }
      
     /* Toggle button styling - compact horizontal */
      .focus-toggle-btn {
          background: var(--body-bg);
          color: var(--body-text);
            border: 2px solid var(--border-color);
          border-radius: 4px;
          padding: 0.35rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 400;
          cursor: pointer;
          text-align:left;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          	margin: 8px;
      }
      
      .focus-toggle-btn:hover {
          background: var(--focus-bg);
          border-color: var(--link-color);
          transform: translateY(-1px);
      }
      
/* Remove outline for mouse clicks */
      .focus-toggle-btn:focus:not(:focus-visible) {
          outline: none;
      }
      
      .focus-toggle-btn:focus-visible {
          outline: 3px solid var(--focus-outline);
          outline-offset: 2px;
          background: var(--focus-bg);
      }
      
      /* Pressed state for toggle buttons */
.focus-toggle-btn[aria-pressed="false"] {
    background: var(--body-bg);
    color: var( --border-color);
    border-color: var( --border-color);
}
      
.focus-toggle-btn[aria-pressed="false"]:hover {
    background:   var( --code-bg);
    color: var( --body-text);
    border-color:     var( --body-text);

}
      
      /* Focus mode button special styling */
      .focus-mode-btn {
          background: var(--success-color);
          color: var(--body-bg);
          border-color: var(--success-color);
          font-weight: 600;
      }
      
      .focus-mode-btn:hover {
          background: color-mix(in srgb, var(--success-color) 85%, black 15%);
          border-color: color-mix(in srgb, var(--success-color) 85%, black 15%);
      }
      
.focus-mode-btn[aria-pressed="true"] {
    color: var(  --warning-color);
    background: var(--body-bg);
	     border-color: var( --warning-color);
}


.distraction-free-controls legend {
    font-size: 1rem;
    font-weight: 600;
    color: var(--heading-color);
    padding: 0 0.5rem;
}
      
      /* ===== DISTRACTION-FREE GRID LAYOUTS ===== */
      
      /* Single column layout - content only */
      .document-wrapper.distraction-free-mode {
          grid-template-columns: 1fr !important;
          grid-template-areas: 
              "content"
              "footer" !important;
      }
      
/* Two column - TOC + content only */
      .document-wrapper.distraction-free-mode.show-toc-only {
          grid-template-columns: minmax(220px, 260px) 1fr !important;
          grid-template-areas: 
              "toc content"
              "footer footer" !important;
      }
      
      /* Two column - content + sidebar only */
      .document-wrapper.distraction-free-mode.show-sidebar-only {
          grid-template-columns: 1fr minmax(320px, 380px) !important;
          grid-template-areas: 
              "content sidebar"
              "footer footer" !important;
      }

      /* Dark mode adaptations for horizontal layout */
      [data-theme="dark"] .distraction-free-controls {
          border-left-color: var(--link-color);
      }
      
      [data-theme="dark"] .distraction-free-controls h3 {
          color: var(--text-secondary);
      }
      
      /* ===== HIDDEN ELEMENTS ===== */
      .hide-toc,
      .hide-sidebar {
          display: none !important;
      }
      
/* Content expansion when elements are hidden - PRESERVE READING WIDTH */
.document-wrapper.distraction-free-mode .document-content {
    margin: 0 auto;  /* Center content instead of removing max-width */
    padding: 1.5rem 3rem 3rem 3rem;
}

/* Ensure reading width classes work in distraction-free mode */
.document-wrapper.distraction-free-mode .document-content.width-extra-narrow {
    max-width: 50ch !important;
    margin: 0 auto;
}

.document-wrapper.distraction-free-mode .document-content.width-narrow {
    max-width: 65ch !important;
    margin: 0 auto;
}

.document-wrapper.distraction-free-mode .document-content.width-wide {
    max-width: 80ch !important;
    margin: 0 auto;
}

.document-wrapper.distraction-free-mode .document-content.width-full {
    max-width: none !important;
    margin: 0;
}
      
      /* ===== SMOOTH TRANSITIONS ===== */
      .table-of-contents,
      .document-sidebar,
      .document-content {
          transition: all 0.3s ease;
      }
      
      /* Respect reduced motion preferences */
      @media (prefers-reduced-motion: reduce) {
          .table-of-contents,
          .document-sidebar,
          .document-content,
          .focus-toggle-btn {
              transition: none;
          }
      }
      
/* ===== MOBILE ADAPTATIONS ===== */
      @media (max-width: 900px) {
          /* Hide distraction-free controls on mobile - single column layout already optimal */
          .distraction-free-controls {
              display: none !important;
          }
          
          /* Optional: Show mobile optimization message */
          .mobile-focus-message {
              display: block;
              padding: 1rem;
              margin: 1rem 0;
              background: var(--surface-color);
              border: 1px solid var(--sidebar-border);
              border-radius: 8px;
              text-align: center;
              colour: var(--text-secondary);
              font-size: 0.9rem;
          }
      }
      
      /* Hide mobile message on desktop */
      @media (min-width: 901px) {
          .mobile-focus-message {
              display: none;
          }
      }
      
      /* ===== ACCESSIBILITY ENHANCEMENTS ===== */
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
      
      /* Live region for announcements */
      #focus-announcements {
          position: absolute;
          left: -10000px;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
      }
      
      /* High contrast support */
      @media (prefers-contrast: high) {
          .focus-toggle-btn {
              border-width: 3px;
          }
          
          .focus-toggle-btn:focus-visible {
              outline-width: 4px;
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
      generateTableCSS(),
      generateTitleBlockCSS(),
      generateDistractionFreeCSS(), // ✅ NEW: Add distraction-free CSS
      generateLargeScreenOptimizationsCSS(),
      generateMobileResponsiveCSS(),
      generateAccessibilitySupportCSS(),
      generatePrintCSS(),
      generateFocusManagementCSS(),
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
        '\n        <nav class="table-of-contents" aria-label="Table of contents" tabindex="0">\n';

      // Build nested structure - heading now provided by CSS
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
        '\n        <nav id="toc" class="table-of-contents" aria-label="Table of contents" tabindex="0">\n';

      // Build nested structure - heading now provided by CSS
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
   * Generate distraction-free controls HTML with conditional TOC button
   * @param {Object} metadata - Document metadata containing sections info
   */
  function generateDistractionFreeControls(metadata = {}) {
    logInfo(
      "Generating distraction-free controls HTML for neurodivergent users"
    );

    // Determine if TOC button should be shown
    const hasTOC = metadata.sections && metadata.sections.length > 0;

    // Conditionally generate TOC button and help text
    const tocButtonHTML = hasTOC
      ? `
<button type="button" 
                      id="toggle-toc" 
                      class="focus-toggle-btn"
                      aria-pressed="true"
                      aria-describedby="toc-help">
                  <svg height="24" width="24" viewBox="0 0 21 21" class="action-icon toc-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m.5 12.5v-10c0-1.1045695.8954305-2 2-2h10c1.1045695 0 2 .8954305 2 2v10c0 1.1045695-.8954305 2-2 2h-10c-1.1045695 0-2-.8954305-2-2z"/><path d="m2.5 12.5v-10c0-1.1045695.8954305-2 2-2h-2c-1 0-2 .8954305-2 2v10c0 1.1045695 1 2 2 2h2c-1.1045695 0-2-.8954305-2-2z" fill="currentColor"/><path d="m7.5 10.5-3-3 3-3"/><path d="m12.5 7.5h-8"/></g></svg> <span class="toggle-text">Hide Table of Contents</span>
              </button>
              <div id="toc-help" class="sr-only">Toggle visibility of the table of contents navigation</div>
              `
      : "";

    logDebug(
      `Generating distraction-free controls: hasTOC=${hasTOC}, sections=${
        metadata.sections ? metadata.sections.length : 0
      }`
    );
    return `
    <!-- Distraction-Free Mode Controls for Neurodivergent Users -->
    <fieldset class="distraction-free-controls" aria-label="Distraction-free mode controls">
        <legend>Focus Mode</legend>
        <div class="focus-controls" role="group" aria-labelledby="focus-controls-heading">
            <span id="focus-controls-heading" class="sr-only">Choose which elements to show or hide</span>
            
            ${tocButtonHTML}
            
<button type="button" 
                    id="toggle-sidebar" 
                    class="focus-toggle-btn"
                    aria-pressed="true"
                    aria-describedby="sidebar-help">
                <svg height="24" width="24" viewBox="0 0 21 21" class="action-icon settings-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m7.5.5c.35132769 0 .69661025.02588228 1.03404495.07584411l.50785434 1.53911115c.44544792.12730646.86820077.30839026 1.26078721.53578009l1.4600028-.70360861c.5166435.39719686.9762801.86487779 1.3645249 1.388658l-.7293289 1.44720284c.2201691.39604534.3936959.82158734.5131582 1.2692035l1.5298263.5338186c.0390082.29913986.0591302.60421522.0591302.91399032 0 .35132769-.0258823.69661025-.0758441 1.03404495l-1.5391112.50785434c-.1273064.44544792-.3083902.86820077-.5357801 1.26078721l.7036087 1.4600028c-.3971969.5166435-.8648778.9762801-1.388658 1.3645249l-1.4472029-.7293289c-.39604532.2201691-.82158732.3936959-1.26920348.5131582l-.5338186 1.5298263c-.29913986.0390082-.60421522.0591302-.91399032.0591302-.35132769 0-.69661025-.0258823-1.03404495-.0758441l-.50785434-1.5391112c-.44544792-.1273064-.86820077-.3083902-1.26078723-.5357801l-1.46000277.7036087c-.51664349-.3971969-.97628006-.8648778-1.36452491-1.388658l.72932886-1.4472029c-.2203328-.39633993-.39395403-.82222042-.51342462-1.27020241l-1.52968981-.53381682c-.03892294-.29882066-.05900023-.60356226-.05900023-.91299317 0-.35132769.02588228-.69661025.07584411-1.03404495l1.53911115-.50785434c.12730646-.44544792.30839026-.86820077.53578009-1.26078723l-.70360861-1.46000277c.39719686-.51664349.86487779-.97628006 1.388658-1.36452491l1.44720284.72932886c.39633995-.2203328.82222044-.39395403 1.27020243-.51342462l.53381682-1.52968981c.29882066-.03892294.60356226-.05900023.91299317-.05900023z" stroke-width=".933"/><circle cx="7.5" cy="7.5" r="3"/></g></svg> <span class="toggle-text">Hide Tools & Settings</span>
            </button>
            <div id="sidebar-help" class="sr-only">Toggle visibility of the document tools and accessibility settings</div>
            
<button type="button" 
                    id="focus-mode" 
                    class="focus-toggle-btn focus-mode-btn"
                    aria-pressed="false"
                    aria-describedby="focus-help">
                <svg height="24" width="24" viewBox="0 0 21 21" class="action-icon focus-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(2 2)"><path d="m8.5 14.5c3.3285018 0 6-2.6447124 6-5.97321429 0-3.32850184-2.6714982-6.02678571-6-6.02678571-3.32850184 0-6 2.69828387-6 6.02678571 0 3.32850189 2.67149816 5.97321429 6 5.97321429z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" fill="currentColor" r="3.5"/><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m.5 8.5h2"/><path d="m14.5 8.5h2"/><path d="m7.5 1.5h2" transform="matrix(0 1 -1 0 10 -7)"/><path d="m7.5 15.5h2" transform="matrix(0 1 -1 0 24 7)"/></g></g></svg> <span class="focus-mode-text">Enable Focus Mode</span>
            </button>
            <div id="focus-help" class="sr-only">Hide all distractions and show only the main content</div>
        </div>
        
        <!-- Status announcements for screen readers -->
        <div id="focus-announcements" aria-live="polite" aria-atomic="true" class="sr-only"></div>
    </fieldset>`;
  }

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
      }">`;

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

      // Main content area with ID and distraction-free controls
      holyGrailStructure +=
        '<main id="main" class="document-content" role="main">\n';

      // Add distraction-free controls for neurodivergent users
      holyGrailStructure += generateDistractionFreeControls(metadata) + "\n";

      // Enhance theorem environments before adding to content
      enhancedContent = enhanceTheoremEnvironments(enhancedContent);

      // Add section anchors
      enhancedContent = addSectionAnchors(enhancedContent, metadata.sections);

      holyGrailStructure += enhancedContent + "\n";
      holyGrailStructure += "</main>\n\n";

      // ✅ NEW: Add table accessibility enhancement script
      // This script will run after the DOM is ready to enhance tables
      holyGrailStructure += `
<script>
// Enhanced Table Accessibility Enhancement Script
(function() {
  'use strict';
  
  function initializeTableAccessibility() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTableAccessibility);
        return;
      }
      
      console.log('Initializing table accessibility enhancements...');
      
      // Add comprehensive ARIA attributes (Adrian Roselli method)
      let tableCount = 0;
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table, index) => {
        // Add ARIA roles
        table.setAttribute('role', 'table');
        
        // Process captions
        const caption = table.querySelector('caption');
        if (caption) {
          caption.setAttribute('role', 'caption');
        }
        
        // Process row groups
        table.querySelectorAll('thead, tbody, tfoot').forEach(group => {
          group.setAttribute('role', 'rowgroup');
        });
        
        // Process rows
        table.querySelectorAll('tr').forEach(row => {
          row.setAttribute('role', 'row');
        });
        
        // Process cells
        table.querySelectorAll('td').forEach(cell => {
          cell.setAttribute('role', 'cell');
        });
        
        // Process headers
        table.querySelectorAll('th').forEach(header => {
          if (header.getAttribute('scope') === 'row') {
            header.setAttribute('role', 'rowheader');
          } else {
            header.setAttribute('role', 'columnheader');
          }
        });
        
        // Generate data-label attributes for mobile responsive design
        const headerRow = table.querySelector('thead tr, tr:first-child');
        if (headerRow) {
          const headers = Array.from(headerRow.querySelectorAll('th, td'))
            .map(header => header.textContent.trim());
            
          table.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(row => {
            row.querySelectorAll('td, th').forEach((cell, cellIndex) => {
              if (headers[cellIndex]) {
                cell.setAttribute('data-label', headers[cellIndex]);
              }
            });
          });
        }
        
        // Add table description for screen readers
        if (!table.getAttribute('aria-describedby')) {
          const rows = table.querySelectorAll('tr').length;
          const cols = headerRow ? headerRow.querySelectorAll('th, td').length : 0;
          
          const description = document.createElement('div');
          description.className = 'table-description sr-only';
          description.id = 'table-desc-' + (index + 1);
          description.textContent = 'Data table with ' + rows + ' rows and ' + cols + ' columns';
          
          table.parentNode.insertBefore(description, table);
          table.setAttribute('aria-describedby', description.id);
        }
        
        tableCount++;
      });
      
      console.log('✅ Table accessibility enhancement complete: ' + tableCount + ' tables processed');
      
      // Announce to screen readers if function is available
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(tableCount + ' tables enhanced for accessibility with ARIA labels and responsive design');
      }
      
    } catch (error) {
      console.error('Error enhancing table accessibility:', error);
    }
  }
  
  // Initialize immediately or wait for DOM
  initializeTableAccessibility();
})();

// Distraction-Free Mode Controller for Neurodivergent Users
(function() {
    'use strict';
    
    // ===========================================================================================
    // LOGGING CONFIGURATION (IIFE SCOPE)
    // ===========================================================================================

    const LOG_LEVELS = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
    };

    const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    const ENABLE_ALL_LOGGING = false;
    const DISABLE_ALL_LOGGING = false;

    function shouldLog(level) {
        if (DISABLE_ALL_LOGGING) return false;
        if (ENABLE_ALL_LOGGING) return true;
        return level <= DEFAULT_LOG_LEVEL;
    }

    function logError(message, ...args) {
        if (shouldLog(LOG_LEVELS.ERROR))
            console.error("[DistractionFree]", message, ...args);
    }

    function logWarn(message, ...args) {
        if (shouldLog(LOG_LEVELS.WARN))
            console.warn("[DistractionFree]", message, ...args);
    }

    function logInfo(message, ...args) {
        if (shouldLog(LOG_LEVELS.INFO))
            console.log("[DistractionFree]", message, ...args);
    }

    function logDebug(message, ...args) {
        if (shouldLog(LOG_LEVELS.DEBUG))
            console.log("[DistractionFree]", message, ...args);
    }
    
    class DistractionFreeManager {
        constructor() {
            this.state = {
                tocVisible: true,
                sidebarVisible: true,
                focusMode: false
            };
            this.elements = {
                wrapper: null,
                toc: null,
                sidebar: null,
                content: null,
                announcements: null,
                toggleTocBtn: null,
                toggleSidebarBtn: null,
                focusModeBtn: null
            };
            
            logInfo("DistractionFreeManager initialised");
        }
        
        initialize() {
            try {
                // Get DOM elements
                this.elements.wrapper = document.querySelector('.document-wrapper');
                this.elements.toc = document.querySelector('#toc, .table-of-contents');
                this.elements.sidebar = document.querySelector('#sidebar, .document-sidebar');
                this.elements.content = document.querySelector('.document-content');
                this.elements.announcements = document.getElementById('focus-announcements');
                
// Get control buttons with null checks
                this.elements.toggleTocBtn = document.getElementById('toggle-toc');
                this.elements.toggleSidebarBtn = document.getElementById('toggle-sidebar');
                this.elements.focusModeBtn = document.getElementById('focus-mode');
                
                // Check if elements exist
                if (!this.elements.wrapper) {
                    logWarn("Document wrapper not found");
                    return false;
                }
                
                // Handle missing TOC button gracefully (when document has no TOC)
                if (!this.elements.toggleTocBtn) {
                    logInfo("TOC toggle button not found - document has no table of contents");
                    this.state.tocVisible = false; // No TOC means it's not visible
                } else {
                    logDebug("TOC toggle button found - document has table of contents");
                }
                
                // Set up event listeners
                this.setupEventListeners();
                
                // Initialize state based on existing elements
                this.state.tocVisible = this.elements.toc && !this.elements.toc.classList.contains('hide-toc');
                this.state.sidebarVisible = this.elements.sidebar && !this.elements.sidebar.classList.contains('hide-sidebar');
                
                // Update button states
                this.updateButtonStates();
                
                logInfo("DistractionFreeManager successfully initialised");
                return true;
            } catch (error) {
                logError("Error initialising DistractionFreeManager:", error);
                return false;
            }
        }
        
setupEventListeners() {
            // Only add TOC event listener if button exists
            if (this.elements.toggleTocBtn) {
                this.elements.toggleTocBtn.addEventListener('click', () => this.toggleToc());
                logDebug("TOC toggle event listener added");
            } else {
                logDebug("TOC toggle button not present - skipping event listener");
            }
            
            // Sidebar and focus mode buttons should always exist
            if (this.elements.toggleSidebarBtn) {
                this.elements.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
                logDebug("Sidebar toggle event listener added");
            } else {
                logWarn("Sidebar toggle button not found");
            }
            
            if (this.elements.focusModeBtn) {
                this.elements.focusModeBtn.addEventListener('click', () => this.toggleFocusMode());
                logDebug("Focus mode toggle event listener added");
            } else {
                logWarn("Focus mode toggle button not found");
            }
            
            // Keyboard shortcuts (optional enhancement)
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.altKey) {
                    switch (event.key) {
                        case 't':
                        case 'T':
                            event.preventDefault();
                            this.toggleToc();
                            break;
                        case 's':
                        case 'S':
                            event.preventDefault();
                            this.toggleSidebar();
                            break;
                        case 'f':
                        case 'F':
                            event.preventDefault();
                            this.toggleFocusMode();
                            break;
                    }
                } else if (event.key === 'Escape' && this.state.focusMode) {
                    this.disableFocusMode();
                }
            });
            
            logDebug("Event listeners set up");
        }
        
        toggleToc() {
            if (!this.elements.toc) {
                this.announceChange("Table of contents is not available");
                return;
            }
            
            this.state.tocVisible = !this.state.tocVisible;
            
            if (this.state.tocVisible) {
                this.elements.toc.classList.remove('hide-toc');
                this.announceChange("Table of contents shown");
            } else {
                this.elements.toc.classList.add('hide-toc');
                this.announceChange("Table of contents hidden");
                this.manageFocus(this.elements.toc);
            }
            
            // If focus mode is active, disable it
            if (this.state.focusMode) {
                this.state.focusMode = false;
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.updateIntelligentFocusMode(); 
            logInfo("TOC toggled:", this.state.tocVisible ? "shown" : "hidden");
        }
        
        toggleSidebar() {
            if (!this.elements.sidebar) {
                this.announceChange("Sidebar is not available");
                return;
            }
            
            this.state.sidebarVisible = !this.state.sidebarVisible;
            
            if (this.state.sidebarVisible) {
                this.elements.sidebar.classList.remove('hide-sidebar');
                this.announceChange("Tools and settings shown");
            } else {
                this.elements.sidebar.classList.add('hide-sidebar');
                this.announceChange("Tools and settings hidden");
                this.manageFocus(this.elements.sidebar);
            }
            
            // If focus mode is active, disable it
            if (this.state.focusMode) {
                this.state.focusMode = false;
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.updateIntelligentFocusMode(); 
            logInfo("Sidebar toggled:", this.state.sidebarVisible ? "shown" : "hidden");
        }
        
        toggleFocusMode() {
            if (this.state.focusMode) {
                this.disableFocusMode();
            } else {
                this.enableFocusMode();
            }
        }
        
        enableFocusMode() {
            this.state.focusMode = true;
            this.state.tocVisible = false;
            this.state.sidebarVisible = false;
            
            // Hide elements
            if (this.elements.toc) {
                this.elements.toc.classList.add('hide-toc');
                this.manageFocus(this.elements.toc);
            }
            
            if (this.elements.sidebar) {
                this.elements.sidebar.classList.add('hide-sidebar');
                this.manageFocus(this.elements.sidebar);
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.announceChange("Focus mode enabled. All distractions hidden. Press Escape to exit focus mode.");
            logInfo("Focus mode enabled");
        }
        
        disableFocusMode() {
            this.state.focusMode = false;
            this.state.tocVisible = true;
            this.state.sidebarVisible = true;
            
            // Show elements
            if (this.elements.toc) {
                this.elements.toc.classList.remove('hide-toc');
            }
            
            if (this.elements.sidebar) {
                this.elements.sidebar.classList.remove('hide-sidebar');
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.announceChange("Focus mode disabled. All elements restored.");
            logInfo("Focus mode disabled");
        }
        
updateGridLayout() {
    if (!this.elements.wrapper) return;
    
    // Remove all distraction-free classes
    this.elements.wrapper.classList.remove(
        'distraction-free-mode',
        'show-toc-only',
        'show-sidebar-only'
    );
    
    // Apply appropriate layout class
    if (this.state.focusMode) {
        this.elements.wrapper.classList.add('distraction-free-mode');
    } else if (!this.state.tocVisible && this.state.sidebarVisible) {
        this.elements.wrapper.classList.add('distraction-free-mode', 'show-sidebar-only');
    } else if (this.state.tocVisible && !this.state.sidebarVisible) {
        this.elements.wrapper.classList.add('distraction-free-mode', 'show-toc-only');
    }
    
    logDebug("Grid layout updated");
}

updateIntelligentFocusMode() {
    const contentOnlyState = !this.state.tocVisible && !this.state.sidebarVisible;
    const shouldAutoEnableFocus = contentOnlyState && !this.state.focusMode;
    
    if (shouldAutoEnableFocus) {
        logInfo("Auto-enabling focus mode - content only state detected");
        this.state.focusMode = true;
        this.updateButtonStates();
        this.updateGridLayout();
        this.announceChange("Focus mode automatically enabled - content only view");
    }
}
        
updateButtonStates() {
            this.updateAriaPressed(this.elements.toggleTocBtn, this.state.tocVisible);
            this.updateAriaPressed(this.elements.toggleSidebarBtn, this.state.sidebarVisible);
            this.updateAriaPressed(this.elements.focusModeBtn, this.state.focusMode);
            
            // Update TOC button text
            if (this.elements.toggleTocBtn) {
                const tocTextElement = this.elements.toggleTocBtn.querySelector('.toggle-text');
                if (tocTextElement) {
                    tocTextElement.textContent = this.state.tocVisible ? 'Hide Table of Contents' : 'Show Table of Contents';
                }
            }
            
            // Update sidebar button text
            if (this.elements.toggleSidebarBtn) {
                const sidebarTextElement = this.elements.toggleSidebarBtn.querySelector('.toggle-text');
                if (sidebarTextElement) {
                    sidebarTextElement.textContent = this.state.sidebarVisible ? 'Hide Tools & Settings' : 'Show Tools & Settings';
                }
            }
            
            // Update focus mode button text
            if (this.elements.focusModeBtn) {
                const textElement = this.elements.focusModeBtn.querySelector('.focus-mode-text');
                if (textElement) {
                    textElement.textContent = this.state.focusMode ? 'Disable Focus Mode' : 'Enable Focus Mode';
                }
            }
            
            logDebug("Button states updated");
        }
        
        updateAriaPressed(button, pressed) {
            if (button) {
                button.setAttribute('aria-pressed', pressed.toString());
            }
        }
        
        announceChange(message) {
            if (this.elements.announcements) {
                this.elements.announcements.textContent = message;
                
                // Clear announcement after 3 seconds
                setTimeout(() => {
                    if (this.elements.announcements) {
                        this.elements.announcements.textContent = '';
                    }
                }, 3000);
            }
            
            // Also use AppConfig if available
            if (window.AppConfig && typeof window.AppConfig.announceToScreenReader === 'function') {
                window.AppConfig.announceToScreenReader(message);
            }
        }
        
        manageFocus(hiddenElement) {
            // If the currently focused element is inside the hidden element, move focus
            if (document.activeElement && hiddenElement.contains(document.activeElement)) {
                if (this.elements.content) {
                    this.elements.content.focus();
                } else {
                    document.getElementById('main')?.focus() || document.body.focus();
                }
            }
        }
        
        // Public API
        getState() {
            return { ...this.state };
        }
        
        isReady() {
            return !!(this.elements.wrapper && this.elements.content);
        }
    }
    
// Initialize when DOM is ready - ONLY when distraction-free controls exist
function initializeDistractionFree() {
    // ✅ GUARD: Prevent initialization during export generation
    if (window.exportGenerationInProgress) {
        logDebug("Skipping DistractionFreeManager initialization - export in progress");
        return;
    }
    
    // ✅ GUARD: Only initialize if distraction-free controls exist in DOM
    if (!document.querySelector('.distraction-free-controls')) {
        logDebug("Skipping DistractionFreeManager initialization - no distraction-free controls found");
        return;
    }
    
    // ✅ GUARD: Prevent duplicate initialization
    if (window.distractionFreeManager) {
        logDebug("DistractionFreeManager already exists - skipping initialization");
        return;
    }
    
    try {
        window.distractionFreeManager = new DistractionFreeManager();
        const initialized = window.distractionFreeManager.initialize();
        
        if (initialized) {
            logInfo("✅ Distraction-free mode ready for neurodivergent users");
        } else {
            logWarn("⚠️ Distraction-free mode initialization incomplete");
        }
    } catch (error) {
        logError("Failed to initialise distraction-free mode:", error);
    }
}

// ✅ IMPROVED: Use more reliable initialization trigger
if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDistractionFree);
    } else {
        // If DOM is already ready, wait a bit for content to be fully rendered
        setTimeout(initializeDistractionFree, 100);
    }
}
})();
</script>`;

      logInfo(
        "Document structure enhancement complete with improved layout and table accessibility"
      );
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

  // ===========================================================================================
  // TABLE ACCESSIBILITY ENHANCEMENT (ADRIAN ROSELLI METHODS)
  // ===========================================================================================

  /**
   * Add comprehensive ARIA attributes to tables (Adrian Roselli method)
   * This function enhances table accessibility for screen readers
   */
  function addTableARIA() {
    try {
      logInfo("Adding comprehensive ARIA attributes to tables");
      let enhancedCount = 0;

      // Enhance all tables with role="table"
      const allTables = document.querySelectorAll("table");
      for (let i = 0; i < allTables.length; i++) {
        allTables[i].setAttribute("role", "table");
        enhancedCount++;
      }

      // Enhance captions
      const allCaptions = document.querySelectorAll("caption");
      for (let i = 0; i < allCaptions.length; i++) {
        allCaptions[i].setAttribute("role", "caption");
      }

      // Enhance row groups (thead, tbody, tfoot)
      const allRowGroups = document.querySelectorAll("thead, tbody, tfoot");
      for (let i = 0; i < allRowGroups.length; i++) {
        allRowGroups[i].setAttribute("role", "rowgroup");
      }

      // Enhance all rows
      const allRows = document.querySelectorAll("tr");
      for (let i = 0; i < allRows.length; i++) {
        allRows[i].setAttribute("role", "row");
      }

      // Enhance data cells
      const allCells = document.querySelectorAll("td");
      for (let i = 0; i < allCells.length; i++) {
        allCells[i].setAttribute("role", "cell");
      }

      // Enhance header cells
      const allHeaders = document.querySelectorAll("th");
      for (let i = 0; i < allHeaders.length; i++) {
        allHeaders[i].setAttribute("role", "columnheader");
      }

      // Handle scoped row headers
      const allRowHeaders = document.querySelectorAll("th[scope=row]");
      for (let i = 0; i < allRowHeaders.length; i++) {
        allRowHeaders[i].setAttribute("role", "rowheader");
      }

      logInfo(`✅ ARIA attributes added to ${enhancedCount} tables`);
      return enhancedCount;
    } catch (error) {
      logError("Error adding table ARIA attributes:", error);
      return 0;
    }
  }

  /**
   * Generate data-label attributes for responsive table cards
   * This enables the mobile card layout to show column headers
   */
  function enhanceTableDataLabels() {
    try {
      logInfo("Generating data-label attributes for responsive tables");
      let processedTables = 0;

      document.querySelectorAll("table").forEach((table) => {
        // Get headers from the first row
        const headerRow = table.querySelector("thead tr, tr:first-child");
        if (!headerRow) return;

        const headers = Array.from(headerRow.querySelectorAll("th, td")).map(
          (header) => header.textContent.trim()
        );

        if (headers.length === 0) return;

        // Add data-label to all data cells
        const dataRows = table.querySelectorAll(
          "tbody tr, tr:not(:first-child)"
        );
        dataRows.forEach((row) => {
          const cells = row.querySelectorAll("td, th");
          cells.forEach((cell, index) => {
            if (headers[index] && headers[index] !== "") {
              cell.setAttribute("data-label", headers[index]);
            } else {
              cell.setAttribute("data-label", `Column ${index + 1}`);
            }
          });
        });

        processedTables++;
      });

      logInfo(`✅ Data labels generated for ${processedTables} tables`);
      return processedTables;
    } catch (error) {
      logError("Error generating table data labels:", error);
      return 0;
    }
  }

  /**
   * Add table navigation help for screen readers
   */
  function addTableNavigationHelp() {
    try {
      logInfo("Adding table navigation help for screen readers");
      let helpAdded = 0;

      document.querySelectorAll("table").forEach((table) => {
        // Check if help already exists
        if (table.querySelector(".table-nav-help")) return;

        // Create navigation help element
        const helpElement = document.createElement("div");
        helpElement.className = "table-nav-help";
        helpElement.setAttribute("tabindex", "0");
        helpElement.setAttribute("role", "region");
        helpElement.setAttribute("aria-label", "Table navigation help");
        helpElement.innerHTML = `
          <p><strong>Table Navigation Help:</strong></p>
          <ul>
            <li>Use <kbd>Ctrl + Alt + Arrow Keys</kbd> to navigate between cells</li>
            <li>Use <kbd>Ctrl + Alt + Home</kbd> to go to the first cell</li>
            <li>Use <kbd>Ctrl + Alt + End</kbd> to go to the last cell</li>
            <li>Press <kbd>Enter</kbd> on this help to dismiss it</li>
          </ul>
        `;

        // Add event listener to hide help
        helpElement.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            helpElement.style.display = "none";
          }
        });

        // Insert before the table
        table.parentNode.insertBefore(helpElement, table);
        helpAdded++;
      });

      logInfo(`✅ Navigation help added to ${helpAdded} tables`);
      return helpAdded;
    } catch (error) {
      logError("Error adding table navigation help:", error);
      return 0;
    }
  }

  /**
   * Add table descriptions for better context
   */
  function addTableDescriptions() {
    try {
      logInfo("Adding table descriptions for accessibility");
      let descriptionsAdded = 0;

      document.querySelectorAll("table").forEach((table, index) => {
        // Skip if description already exists
        if (
          table.previousElementSibling?.classList.contains("table-description")
        ) {
          return;
        }

        // Get table dimensions for description
        const rows = table.querySelectorAll("tr").length;
        const headerRow = table.querySelector("thead tr, tr:first-child");
        const columns = headerRow
          ? headerRow.querySelectorAll("th, td").length
          : 0;

        // Create description
        const description = document.createElement("div");
        description.className = "table-description";
        description.setAttribute("id", `table-desc-${index + 1}`);

        let descriptionText = `Table ${index + 1}: `;
        if (rows > 0 && columns > 0) {
          descriptionText += `${rows} rows by ${columns} columns`;
          if (table.querySelector("caption")) {
            descriptionText += ` with caption`;
          }
        } else {
          descriptionText += `Data table`;
        }

        description.textContent = descriptionText;

        // Link table to description
        table.setAttribute("aria-describedby", `table-desc-${index + 1}`);

        // Insert before table
        table.parentNode.insertBefore(description, table);
        descriptionsAdded++;
      });

      logInfo(`✅ Descriptions added to ${descriptionsAdded} tables`);
      return descriptionsAdded;
    } catch (error) {
      logError("Error adding table descriptions:", error);
      return 0;
    }
  }

  /**
   * Comprehensive table accessibility enhancement
   * This is the main function to call for full table accessibility
   */
  function enhanceTableAccessibility() {
    try {
      logInfo("Starting comprehensive table accessibility enhancement");

      const results = {
        ariaCount: addTableARIA(),
        dataLabelsCount: enhanceTableDataLabels(),
        navigationHelpCount: addTableNavigationHelp(),
        descriptionsCount: addTableDescriptions(),
      };

      const totalTables = document.querySelectorAll("table").length;

      logInfo("✅ Table accessibility enhancement complete:", {
        totalTables,
        ariaEnhanced: results.ariaCount,
        dataLabelsAdded: results.dataLabelsCount,
        navigationHelp: results.navigationHelpCount,
        descriptions: results.descriptionsCount,
      });

      // Screen reader announcement
      if (window.AppConfig && window.AppConfig.announceToScreenReader) {
        window.AppConfig.announceToScreenReader(
          `${totalTables} tables enhanced for accessibility with ARIA labels, responsive data labels, and navigation help.`
        );
      }

      return results;
    } catch (error) {
      logError(
        "Error in comprehensive table accessibility enhancement:",
        error
      );
      return null;
    }
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
   * Generate advanced desktop table styling CSS
   */
  function generateAdvancedTableCSS() {
    return `
        /* ===== ENHANCED TABLE STYLING ===== */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: var(--surface-color);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--sidebar-border);
            position: relative;
            font-variant-numeric: tabular-nums; /* Better number alignment */
        }

        /* Enhanced table typography */
        table {
            font-size: 0.95rem;
            line-height: 1.5;
        }

        /* Table captions */
        caption {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--heading-color);
            text-align: left;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: var(--body-bg);
            border-radius: 8px 8px 0 0;
            border: 1px solid var(--sidebar-border);
            border-bottom: none;
        }

        /* Enhanced cell styling */
th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--sidebar-border);
    vertical-align: top;
    position: relative;
}

table td, table th, table tr {
    border: 1px solid color-mix(in srgb, var(--sidebar-border) 80%, var(--body-text) 20%) !important;
}

/* Remove border from last column */
th:last-child, td:last-child {
    border-right: none;
}

        /* Header styling with gradient */
        th {
            background: linear-gradient(135deg, var(--border-color) 0%, color-mix(in srgb, var(--border-color) 90%, white) 100%);
            color: var(--body-bg);
            font-weight: 600;
            font-size: 0.875rem;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 2px solid var(--sidebar-border);
        }

        /* Dark mode header adjustments */
        [data-theme="dark"] th {
            background: linear-gradient(135deg, var(--border-color) 0%, color-mix(in srgb, var(--border-color) 80%, black) 100%);
            color: var(--body-bg);
        }

        /* Row styling with enhanced interactions */
        tr {
            transition: all 0.2s ease;
        }

        tbody tr:hover {
            background: var(--focus-bg);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        tbody tr:focus-within {
            background: var(--focus-bg);
            outline: 2px solid var(--focus-outline);
            outline-offset: -2px;
        }

        /* Zebra striping for better readability */
        tbody tr:nth-child(even) {
            background: color-mix(in srgb, var(--surface-color) 50%, var(--body-bg) 50%);
        }

        tbody tr:nth-child(even):hover {
            background: var(--focus-bg);
        }

        tr:last-child td {
            border-bottom: none;
        }

        /* Cell content alignment classes */
        .table-cell-center { text-align: center; }
        .table-cell-right { text-align: right; }
        .table-cell-numeric { 
            text-align: right; 
            font-variant-numeric: tabular-nums;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace, var(--font-primary);
        }

        /* Mathematical content in tables */
        table mjx-container {
            margin: 0.25em 0;
            font-size: 0.9em;
        }

        /* Enhanced focus states for accessibility */
        th:focus-visible, td:focus-visble {
            background: var(--focus-bg);
            outline: 2px solid var(--focus-outline);
            outline-offset: -2px;
            z-index: 1;
        }
    `;
  }

  /**
   * Generate responsive table CSS with card layout for mobile
   */
  function generateResponsiveTableCSS() {
    return `
        /* ===== RESPONSIVE TABLE DESIGN ===== */
        
        /* Tablet adjustments */
        @media (max-width: 1024px) {
            table {
                font-size: 0.9rem;
            }
            
            th, td {
                padding: 0.75rem;
            }
            
            th {
                font-size: 0.8rem;
            }
        }

        /* Mobile card layout */
        @media (max-width: 768px) {
            /* Hide table structure for mobile card layout */
            table, thead, tbody, th, td, tr {
                display: block;
            }

            /* Hide table headers but keep them for data-label attributes */
            thead tr {
                position: absolute;
                top: -9999px;
                left: -9999px;
                clip: rect(0 0 0 0);
                height: 1px;
                width: 1px;
                overflow: hidden;
            }

            /* Caption remains visible and styled */
            caption {
                display: block;
                text-align: center;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                border-radius: 8px;
            }

            /* Transform each row into a card */
            tbody tr {
                border: 1px solid var(--sidebar-border);
                border-radius: 8px;
                padding: 1rem;
                margin: 0 0 1rem 0;
                background: var(--surface-color);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                transform: none; /* Reset hover transform for mobile */
                transition: box-shadow 0.2s ease;
            }

            tbody tr:hover {
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                transform: none;
            }

            /* Style each cell as a data row */
            td {
                border: none;
                padding: 0.5rem 0;
                text-align: left !important; /* Override alignment classes on mobile */
                position: relative;
                min-height: 2rem;
                display: flex;
                align-items: center;
            }

            /* Add labels using data-label attribute */
            td:before {
                content: attr(data-label) ": ";
                font-weight: 600;
                color: var(--heading-color);
                margin-right: 0.5rem;
                min-width: 120px;
                flex-shrink: 0;
                font-size: 0.875rem;
                letter-spacing: 0.02em;
            }

            /* Handle empty cells gracefully */
            td:empty:before {
                content: attr(data-label) ": ";
                color: var(--text-secondary);
            }

            td:empty:after {
                content: "—";
                color: var(--text-secondary);
                font-style: italic;
            }

            /* Mathematical content adjustments for mobile cards */
            td mjx-container {
                flex: 1;
                margin-left: 0.5rem;
            }

            /* Remove zebra striping on mobile - cards are distinct */
            tbody tr:nth-child(even) {
                background: var(--surface-color);
            }
        }

        /* Mobile card layout */
@media (max-width: 768px) {
    /* Hide table structure for mobile card layout */
    table, thead, tbody, th, td, tr {
        display: block;
    }

    /* ✅ NEW: Remove internal borders for clean card appearance */
    table td, table th, table tr {
        border: none !important;
    }

    /* Caption remains visible and styled */
    caption {
        display: block;
        text-align: center;
        font-size: 1.2rem;
        margin-bottom: 1rem;
        border-radius: 8px;
        border: none; /* Remove caption borders too */
    }

    /* Transform each row into a clean card */
    tbody tr {
        border: 1px solid var(--sidebar-border); /* Single card border only */
        border-radius: 8px;
        padding: 1rem;
        margin: 0 0 1rem 0;
        background: var(--surface-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    /* Clean cell styling without internal borders */
    td {
        border: none !important; /* Emphasize: no internal borders */
        padding: 0.5rem 0;
        text-align: left !important;
        position: relative;
        min-height: 2rem;
        display: flex;
        align-items: center;
    }

    /* Keep the data labels clean */
    td:before {
        content: attr(data-label) ": ";
        font-weight: 600;
        color: var(--heading-color);
        margin-right: 0.5rem;
        min-width: 120px;
        flex-shrink: 0;
        font-size: 0.875rem;
        letter-spacing: 0.02em;
    }
}

        /* Very small screens */
        @media (max-width: 480px) {
            tbody tr {
                padding: 0.75rem;
                margin: 0 0 0.75rem 0;
            }

            td:before {
                min-width: 100px;
                font-size: 0.8rem;
            }

            caption {
                font-size: 1.1rem;
                padding: 0.75rem;
            }
        }
    `;
  }

  /**
   * Generate table accessibility CSS with ARIA support
   */
  function generateTableAccessibilityCSS() {
    return `
        /* ===== TABLE ACCESSIBILITY ENHANCEMENTS ===== */
        
        /* Enhanced focus indicators for keyboard navigation */
        table:focus-visble {
            outline: 2px solid var(--focus-outline);
            outline-offset: 2px;
        }

        /* Row and cell focus management */
        tr[tabindex]:focus-visible {
            background: var(--focus-bg);
            outline: 2px solid var(--focus-outline);
            outline-offset: -2px;
        }

        /* ARIA-enhanced tables */
        table[role="table"] {
            border: 2px solid var(--sidebar-border);
        }

        /* Screen reader enhancements */
        .table-description {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            font-style: italic;
        }

        /* High contrast mode enhancements */
        @media (prefers-contrast: high) {
            table {
                border: 3px solid currentColor;
            }

            th {
                border: 2px solid currentColor;
                font-weight: 700;
            }

            td {
                border: 1px solid currentColor;
            }

            tbody tr:hover {
                background: Highlight;
                color: HighlightText;
            }
        }

        /* Reduced motion preferences */
        @media (prefers-reduced-motion: reduce) {
            tr, tbody tr:hover {
                transition: none;
                transform: none;
            }
        }

        /* Screen reader only content for table navigation help */
        .table-nav-help {
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

        .table-nav-help:focus-visible{
            position: static;
            width: auto;
            height: auto;
            padding: 0.5rem;
            margin: 0.5rem 0;
            overflow: visible;
            clip: auto;
            white-space: normal;
            background: var(--focus-bg);
            border: 1px solid var(--focus-outline);
            border-radius: 4px;
        }
    `;
  }

  /**
   * Generate enhanced table print CSS
   */
  function generateTablePrintCSS() {
    return `
        /* ===== ENHANCED TABLE PRINT STYLING ===== */
        @media print {
            /* Use browser defaults for better print compatibility */
            table, table *, 
            table[role="table"], table[role="table"] *,
            thead, thead *, tbody, tbody *, tfoot, tfoot *,
            tr, tr *, th, th *, td, td * {
                all: unset !important;
                display: revert !important;
                font-family: revert !important;
                margin: revert !important;
                padding: revert !important;
                background: revert !important;
                border: revert !important;
                color: revert !important;
            }

            /* Restore essential table structure */
            table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin: 1rem 0 !important;
                page-break-inside: auto !important;
            }

            caption {
                text-align: center !important;
                font-weight: bold !important;
                margin-bottom: 0.5rem !important;
            }

            th, td {
                border: 1px solid #000 !important;
                padding: 0.3rem 0.5rem !important;
                text-align: left !important;
                vertical-align: top !important;
            }

            th {
                background: #f0f0f0 !important;
                font-weight: bold !important;
            }

            /* Improve page breaks */
            tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            /* Ensure headers repeat on new pages */
            thead {
                display: table-header-group !important;
            }

            tbody {
                display: table-row-group !important;
            }

            /* Remove interactive elements for print */
            tr:hover, td:focus, th:focus {
                background: transparent !important;
                outline: none !important;
                transform: none !important;
                box-shadow: none !important;
            }
        }
    `;
  }

  /**
   * Generate main table CSS (replaces the original function)
   */
  function generateTableCSS() {
    logInfo(
      "Generating comprehensive table CSS with accessibility enhancements"
    );

    return [
      generateAdvancedTableCSS(),
      generateResponsiveTableCSS(),
      generateTableAccessibilityCSS(),
      generateTablePrintCSS(),
    ].join("\n\n");
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // CSS generation
    generateEnhancedCSS,
    generateDistractionFreeCSS, // ✅ NEW: Distraction-free CSS
    minifyCSS,
    generateResponsiveImageCSS,
    generateTableCSS,

    // ✅ NEW: Enhanced table CSS functions
    generateAdvancedTableCSS,
    generateResponsiveTableCSS,
    generateTableAccessibilityCSS,
    generateTablePrintCSS,

    // Table of contents
    generateTableOfContents,
    generateTableOfContentsWithId,

    // Document structure
    enhanceDocumentStructure,
    generateDistractionFreeControls, // ✅ NEW: Distraction-free controls
    enhanceTheoremEnvironments,
    addSectionAnchors,

    // ✅ NEW: Table accessibility functions
    addTableARIA,
    enhanceTableDataLabels,
    addTableNavigationHelp,
    addTableDescriptions,
    enhanceTableAccessibility,

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
