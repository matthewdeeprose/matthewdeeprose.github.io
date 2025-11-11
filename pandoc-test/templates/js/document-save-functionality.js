// ===========================================================================================
// DOCUMENT SAVE FUNCTIONALITY TEMPLATE
// ===========================================================================================
// Provides save functionality for exported HTML documents
// Uses embedded Base64 content to ensure clean saves without MathJax pollution
// Part of Enhanced Pandoc-WASM Mathematical Playground export system

const DocumentSaveFunctionality = (function() {
  "use strict";

  // ===================================================================
  // LOGGING CONFIGURATION (SCOPED)
  // ===================================================================
  
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
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
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error('[SAVE-FUNC]', message, ...args);
    }
  }
  
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn('[SAVE-FUNC]', message, ...args);
    }
  }
  
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log('[SAVE-FUNC]', message, ...args);
    }
  }
  
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log('[SAVE-FUNC]', message, ...args);
    }
  }

  // ===================================================================
  // GLOBAL STORAGE
  // ===================================================================
  
  // Global storage for original HTML content
  window.originalDocumentHTML = null;

  // ===================================================================
  // SAVE FUNCTIONALITY
  // ===================================================================

  /**
   * Save complete document functionality for exported HTML files
   * Retrieves clean HTML from embedded Base64 data
   * Guarantees no MathJax pollution in saved files
   */
  function saveCompleteDocument() {
    logInfo('🔥 saveCompleteDocument function called');
    
    try {
      // Get the original static HTML content
      let documentHtml;
      let retrievalMethod = 'none'; // Track which method succeeded
      
      // ✅ PRIMARY METHOD: Retrieve from embedded Base64 data
      const embeddedData = document.getElementById('original-content-data');
      logDebug('🔍 Looking for embedded data element...');
      
      if (embeddedData) {
        logInfo('✅ Found embedded data element');
        try {
          const base64Content = embeddedData.textContent.trim();
          logInfo('📊 Embedded Base64 data size:', base64Content.length, 'characters');
          
          // Show first 100 chars for debugging
          logDebug('🔍 Base64 preview:', base64Content.substring(0, 100) + '...');
          
          documentHtml = decodeURIComponent(escape(atob(base64Content)));
          logInfo('✅ Successfully decoded clean HTML from embedded Base64 data');
          logInfo('📊 Decoded content length:', documentHtml.length, 'characters');
          retrievalMethod = 'embedded-base64';
        } catch (decodeError) {
          logError('❌ Failed to decode embedded content:', decodeError);
          logError('Error details:', decodeError.message);
          documentHtml = null;
        }
      } else {
        logWarn('⚠️ No embedded data element found with ID "original-content-data"');
        logDebug('🔍 Available script elements:', document.querySelectorAll('script[type*="original"]').length);
      }
      
      // FALLBACK 1: Use stored original HTML if available
      if (!documentHtml && window.originalDocumentHTML) {
        documentHtml = window.originalDocumentHTML;
        logWarn('⚠️ Using FALLBACK 1: stored original HTML');
        logInfo('📊 Stored content length:', documentHtml.length, 'characters');
        retrievalMethod = 'stored-original';
      }
      
      // FALLBACK 2: Attempt to clean current DOM
      if (!documentHtml) {
        logWarn('⚠️ Using FALLBACK 2: attempting to clean current DOM');
        documentHtml = cleanDynamicMathJaxContent(document.documentElement.outerHTML);
        logInfo('📊 Cleaned DOM length:', documentHtml ? documentHtml.length : 0, 'characters');
        retrievalMethod = 'cleaned-dom';
      }
      
      if (!documentHtml) {
        throw new Error('Unable to retrieve document content for saving - all methods failed');
      }
      
      logInfo('✅ Content retrieved using method:', retrievalMethod);
      
      // Create filename based on document title
      const title = document.title || 'Mathematical Document';
      const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = cleanTitle + '_' + timestamp + '.html';
      
      // Create and trigger download
      const blob = new Blob([documentHtml], { 
        type: 'text/html;charset=utf-8' 
      });
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      downloadLink.setAttribute('aria-hidden', 'true');
      
      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 100);
      
      // Announce to screen readers
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader('Document saved as ' + filename + '. The file contains all original formatting, mathematics, and accessibility features.');
      }
      
      logInfo('✅ Document saved successfully:', filename);
      logInfo('📄 Final content length:', documentHtml.length, 'characters');
      logInfo('🎯 Save completed using retrieval method:', retrievalMethod);
      
    } catch (error) {
      logError('❌ Error saving document:', error);
      logError('Full error details:', error.stack);
      alert("Sorry, there was an error saving the document. Please try using your browser's Save As function instead.");
    }
  }

  /**
   * Clean dynamic MathJax content from HTML to restore original state
   * Removes runtime-generated styles and elements that can break functionality
   */
  function cleanDynamicMathJaxContent(html) {
    logInfo('🧹 Cleaning dynamic MathJax content from HTML');
    
    // Remove dynamic MathJax style elements added at runtime
    let cleaned = html.replace(/<style[^>]*id="MJX-CHTML-styles"[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>\s*\.CtxtMenu_[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>\s*\.MJX_[\s\S]*?<\/style>/gi, '');
    
    // Remove dynamic font-face declarations 
    cleaned = cleaned.replace(/@font-face\s*\/\*\s*\d+\s*\*\/\s*\{[\s\S]*?\}/gi, '');
    
    // Remove dynamic MathJax font styles
    cleaned = cleaned.replace(/mjx-c\.mjx-c[^{]*\{[^}]*\}/gi, '');
    
    // Remove MathJax accessibility live regions that are added dynamically
    cleaned = cleaned.replace(/<div[^>]*class="MJX_LiveRegion"[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*class="MJX_HoverRegion"[^>]*>[\s\S]*?<\/div>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*class="MJX_ToolTip"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove any script elements that were added by MathJax dynamically
    cleaned = cleaned.replace(/<script[^>]*src="[^"]*mathjax[^"]*a11y[^"]*"[^>]*><\/script>/gi, '');
    
    logInfo('✅ Cleaned dynamic MathJax content');
    return cleaned;
  }

  /**
   * Store original document HTML for later saving
   * Call this when the document is first loaded
   */
  function storeOriginalDocumentHTML(htmlContent) {
    window.originalDocumentHTML = htmlContent;
    logInfo('📄 Stored original document HTML for saving');
    logInfo('📊 Original content length:', htmlContent.length, 'characters');
  }

  // ===================================================================
  // PUBLIC API
  // ===================================================================

  // Expose functions globally
  window.saveCompleteDocument = saveCompleteDocument;
  window.cleanDynamicMathJaxContent = cleanDynamicMathJaxContent;
  window.storeOriginalDocumentHTML = storeOriginalDocumentHTML;

  logInfo('✅ Save document functionality loaded and ready');

  return {
    saveCompleteDocument,
    cleanDynamicMathJaxContent,
    storeOriginalDocumentHTML
  };
})();

// Note: Original content is now embedded as Base64 data, no runtime storage needed