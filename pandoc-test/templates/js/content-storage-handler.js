// ===========================================================================================
// CONTENT STORAGE HANDLER TEMPLATE
// ===========================================================================================
// Verifies embedded Base64 content and manages save button visibility
// Handles screen reader announcements for save functionality status
// Part of Enhanced Pandoc-WASM Mathematical Playground export system

const ContentStorageHandler = (function() {
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
      console.error('[CONTENT-STORAGE]', message, ...args);
    }
  }
  
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn('[CONTENT-STORAGE]', message, ...args);
    }
  }
  
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log('[CONTENT-STORAGE]', message, ...args);
    }
  }
  
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log('[CONTENT-STORAGE]', message, ...args);
    }
  }

  // ===================================================================
  // CONTENT VERIFICATION AND SAVE BUTTON MANAGEMENT
  // ===================================================================

  // Verify embedded content and hide save button if no more saves available
  setTimeout(function() {
    const embeddedData = document.getElementById('original-content-data');
    
    if (embeddedData) {
      const base64Content = embeddedData.textContent.trim();
      
      if (base64Content.length === 0) {
        // Empty script tag means no more saves with full MathJax functionality
        logInfo('⚠️ No embedded Base64 content - this is the final save iteration');
        logInfo('🔒 Hiding save button as MathJax will not work properly on next save');
        
        // Hide the save button
        const saveButton = document.querySelector('button.action-button.save-button');
        if (saveButton) {
          saveButton.style.display = 'none';
          logInfo('✅ Save button hidden successfully');
          
          // Announce to screen readers
          if (typeof announceToScreenReader === 'function') {
            announceToScreenReader('Save functionality has reached its limit. This document can still be saved using your browser\'s Save As function, but mathematical expressions may have limited functionality.');
          }
        } else {
          logWarn('⚠️ Save button not found - selector may need adjustment');
          // Try alternative selectors
          const altButton = document.querySelector('.save-button') || document.querySelector('[title*="Save"]') || document.querySelector('[aria-label*="Save"]');
          if (altButton) {
            altButton.style.display = 'none';
            logInfo('✅ Save button hidden using alternative selector');
          }
        }
        
      } else {
        logInfo('✅ Clean HTML content embedded and ready for saving');
        logInfo('📊 Embedded data size:', base64Content.length, 'Base64 characters');
        
        // Verify we can decode it
        try {
          // First check if base64Content is valid
          if (!base64Content || typeof base64Content !== 'string') {
            throw new Error('Base64 content is null, undefined, or not a string');
          }
          
          // Check for invalid Base64 characters
          const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!base64Regex.test(base64Content)) {
            throw new Error('Base64 content contains invalid characters');
          }
          
          // Test decode with error handling
          const testDecode = atob(base64Content).substring(0, 100);
          logInfo('✅ Embedded data decoding verified');
          logDebug('🔍 Decoded preview:', testDecode.substring(0, 50) + '...');
          
        } catch (e) {
          logError('❌ Embedded data exists but cannot be decoded:', e);
          logDebug('🔍 Base64 content type:', typeof base64Content);
          logDebug('🔍 Base64 content length:', base64Content ? base64Content.length : 'null/undefined');
          logDebug('🔍 Base64 content preview:', base64Content ? base64Content.substring(0, 100) : 'null/undefined');
          
          // Log invalid characters if any
          if (base64Content && typeof base64Content === 'string') {
            const invalidChars = base64Content.match(/[^A-Za-z0-9+/=]/g);
            if (invalidChars) {
              logWarn('🚨 Invalid Base64 characters found:', [...new Set(invalidChars)]);
            }
          }
        }
      }
      
    } else {
      logWarn('⚠️ No embedded data element found - save functionality will use fallback methods');
    }
  }, 100);

  // ===================================================================
  // PUBLIC API
  // ===================================================================

  return {
    // No public methods needed - verification runs automatically
  };
})();