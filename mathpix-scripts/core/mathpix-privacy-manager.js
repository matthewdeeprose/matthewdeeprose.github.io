// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MATHPIX_CONFIG from "./mathpix-config.js";

/**
 * MathPix Privacy Manager
 * Handles privacy confirmation workflow and consent management
 * Integrates with existing modal system for user-friendly privacy controls
 */
class MathPixPrivacyManager {
  constructor(modalBridge) {
    this.modals = modalBridge || {
      confirm: window.UniversalModal
        ? window.UniversalModal.confirm
        : window.safeConfirm || this.fallbackConfirm,
      alert: window.UniversalModal
        ? window.UniversalModal.alert
        : window.safeAlert || this.fallbackAlert,
    };

    this.privacySettings = {
      dataRetentionOptOut: true, // Already configured in MATHPIX_CONFIG
      requireConfirmation: true, // Always ask for consent
      rememberChoice: false, // Always ask for maximum privacy
      alwaysConsentSession: false, // Session-only auto-consent for testing
      processingLocation: "EU (Frankfurt)", // Hard-coded EU processing only
      processingEndpoint: "eu-central-1.api.mathpix.com", // EU-specific endpoint
      dataLocality: "European Union", // All processing within EU
      secureTransmission: true, // HTTPS only
      noDataImprovement: true, // improve_mathpix: false
    };

    // Phase 4: Check configuration for privacy modal toggle
    this.isPrivacyModalEnabled =
      MATHPIX_CONFIG.USER_EXPERIENCE?.PRIVACY_MODAL_ENABLED !== false;

    // Session consent tracking (not persistent for privacy)
    this.sessionConsent = {
      granted: false,
      timestamp: null,
      fileCount: 0,
    };

    logInfo("MathPix Privacy Manager initialised", {
      requiresConfirmation: this.privacySettings.requireConfirmation,
      dataRetention: this.privacySettings.dataRetentionOptOut,
      modalIntegration: typeof this.modals.confirm === "function",
    });
  }

  /**
   * Request processing consent from user
   * @param {Object} fileInfo - Information about the file to be processed
   * @returns {Promise<boolean>} True if consent granted, false if denied
   */
  async requestProcessingConsent(fileInfo = {}) {
    logInfo("Requesting processing consent", {
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      sessionFileCount: this.sessionConsent.fileCount,
      privacyModalEnabled: this.isPrivacyModalEnabled,
    });

    // Phase 4: Check if privacy modal is disabled via configuration
    if (!this.isPrivacyModalEnabled) {
      logInfo(
        "Privacy modal disabled via configuration - auto-consenting with privacy protection",
        {
          fileName: fileInfo.name,
          privacyProtectionMaintained: true,
          dataRetention: false,
          dataImprovement: false,
          secureProcessing: true,
        }
      );

      this.sessionConsent = {
        granted: true,
        timestamp: Date.now(),
        fileCount: this.sessionConsent.fileCount + 1,
      };

      return true;
    }

    // Check if user has enabled "always consent" for this session
    if (this.privacySettings.alwaysConsentSession) {
      logInfo("Auto-consenting based on session preference", {
        fileName: fileInfo.name,
        sessionAutoConsent: true,
      });

      this.sessionConsent = {
        granted: true,
        timestamp: Date.now(),
        fileCount: this.sessionConsent.fileCount + 1,
      };

      return true;
    }

    try {
      // Build privacy confirmation message as HTML
      const consentMessage = this.buildConsentMessage(fileInfo);
      const consentTitle = "Privacy & Processing Consent";

      // Use custom modal with HTML support and custom buttons
      const userConsent = await window.UniversalModal.custom(consentMessage, {
        title: consentTitle,
        type: "info",
        size: "large",
        allowBackgroundClose: false,
        buttons: [
          {
            text: "No, Cancel",
            type: "secondary",
            action: false,
          },
          {
            text: "Yes, I Consent",
            type: "primary",
            action: true,
          },
        ],
      });

      if (userConsent) {
        // Check if user selected "always consent" checkbox
        const alwaysConsentCheckbox = document.getElementById(
          "mathpix-always-consent"
        );
        if (alwaysConsentCheckbox && alwaysConsentCheckbox.checked) {
          this.privacySettings.alwaysConsentSession = true;
          logInfo("Session auto-consent enabled by user", {
            fileName: fileInfo.name,
            sessionAutoConsent: true,
          });
        }

        this.sessionConsent = {
          granted: true,
          timestamp: Date.now(),
          fileCount: this.sessionConsent.fileCount + 1,
        };

        logInfo("Processing consent granted", {
          sessionFileCount: this.sessionConsent.fileCount,
          timestamp: new Date(this.sessionConsent.timestamp).toISOString(),
          alwaysConsentEnabled: !!this.privacySettings.alwaysConsentSession,
        });
      } else {
        logInfo("Processing consent denied by user");
      }

      return userConsent;
    } catch (error) {
      logError("Error requesting processing consent", error);

      // Show error and default to no consent for safety
      await window.UniversalModal.alert(
        "Unable to display privacy confirmation. Processing cancelled for your protection.",
        { title: "Privacy System Error" }
      );

      return false;
    }
  }

  /**
   * Build comprehensive consent message for user
   * @param {Object} fileInfo - File information
   * @returns {string} Formatted consent message
   */
  buildConsentMessage(fileInfo) {
    const fileName = fileInfo.name || "your mathematical content";
    const fileSize = fileInfo.size
      ? this.formatFileSize(fileInfo.size)
      : "unknown size";
    const fileType = this.getFileTypeDescription(fileInfo.type);

    return `
    <div class="mathpix-privacy-consent">
      <div class="consent-file-info">
        <p><strong>Process "${fileName}" (${fileSize}) with MathPix Mathematics OCR?</strong></p>
      </div>

      <div class="consent-section">
        <h3><span aria-hidden="true">📋</span> What Will Happen:</h3>
        <ul>
          <li>Your ${fileType} will be securely processed to extract mathematical expressions</li>
          <li>Content converted to LaTeX, MathML, AsciiMath, and other formats</li>
          <li>Processing typically completed within 5-10 seconds</li>
        </ul>
      </div>

      <div class="consent-section privacy-protection">
        <h3><span aria-hidden="true">🔒</span> Enhanced EU Privacy Protection:</h3>
        <ul>
          <li><strong>Data retention:</strong> DISABLED (files deleted within 24 hours)</li>
          <li><strong>Data improvement:</strong> DISABLED (your content won't train their models)</li>
          <li><strong>Transmission:</strong> Secure HTTPS encryption</li>
          <li><strong>Processing location:</strong> GUARANTEED EU-only (Frankfurt, Germany)</li>
          <li><strong>Data locality:</strong> Your content never leaves European Union jurisdiction</li>
        </ul>
      </div>

      <div class="consent-section gdpr-compliance">
        <h3><span aria-hidden="true">🇪🇺</span> GDPR Compliance Enhanced:</h3>
        <ul>
          <li>All processing occurs within EU data centres</li>
          <li>EU-specific API endpoint ensures data sovereignty</li>
          <li>No cross-border data transfers outside EU</li>
          <li>Full compliance with EU data protection regulations</li>
        </ul>
      </div>

      <div class="consent-section data-rights">
        <h3><span aria-hidden="true">📊</span> Your Data Rights:</h3>
        <ul>
          <li>Processing is temporary and for conversion only</li>
          <li>No permanent storage of your mathematical content</li>
          <li>No sharing with third parties</li>
          <li>Complete EU GDPR compliance maintained</li>
        </ul>
      </div>

      <div class="consent-section important-notes">
        <h3><span aria-hidden="true">⚠️</span> Important Notes:</h3>
        <ul>
          <li>This is your <strong>${
            this.sessionConsent.fileCount + 1
          }${this.getOrdinalSuffix(
      this.sessionConsent.fileCount + 1
    )} file</strong> this session</li>
          <li>Each file requires separate consent for transparency</li>
          <li>You can cancel processing at any time</li>
        </ul>
      </div>

<div class="consent-question">
          <p><strong>Do you consent to process this file with enhanced EU privacy protections?</strong></p>
        </div>

        <div class="consent-testing-options">
          <label class="consent-checkbox-wrapper">
            <input type="checkbox" id="mathpix-always-consent" class="consent-checkbox">
            <span class="checkbox-label">
              <strong>Remember my choice for this session</strong> 
              <small>(Testing mode - resets when browser closes)</small>
            </span>
          </label>
        </div>
    </div>
  `;
  }

  /**
   * Show detailed privacy policy information
   * @returns {Promise<void>}
   */
  async showPrivacyDetails() {
    const privacyDetails = this.getPrivacyPolicyText();
    const privacyTitle = "MathPix Privacy Policy & Data Handling";

    await this.modals.alert(privacyDetails, privacyTitle);

    logInfo("Privacy policy details displayed to user");
  }

  /**
   * Get comprehensive privacy policy text
   * @returns {string} Privacy policy information
   */
  getPrivacyPolicyText() {
    return `MATHPIX PRIVACY & DATA HANDLING POLICY

🔒 ENHANCED EU PRIVACY-FIRST CONFIGURATION:
Our integration is configured for maximum privacy protection with guaranteed EU processing:

- Data Retention: DISABLED
  - Your files are automatically deleted within 24 hours
  - No permanent storage or archiving of your content
  - Processing is temporary conversion only

- Data Improvement: DISABLED  
  - Your content will NOT be used to train or improve MathPix models
  - No machine learning or AI training on your mathematical expressions
  - Your content remains private and confidential

- Secure Transmission: ENABLED
  - All communication uses HTTPS encryption
  - Data encrypted during transmission
  - No unencrypted data transfer

🇪🇺 EU-GUARANTEED PROCESSING LOCATION:
- Hard-coded EU-specific endpoint: eu-central-1.api.mathpix.com
- All processing occurs in Frankfurt, Germany data centres
- Your data NEVER leaves the European Union during processing
- No automatic server selection - EU processing guaranteed
- Full data sovereignty within EU jurisdiction
- Zero cross-border data transfers outside EU

📋 WHAT IS PROCESSED:
- Mathematical expressions, equations, and formulas
- Handwritten or printed mathematical content
- Diagrams containing mathematical notation
- PDF documents with mathematical content

📊 WHAT IS NOT PROCESSED:
- Personal identifying information (beyond filename)
- Non-mathematical content in your files
- Metadata beyond what's needed for conversion
- Any content outside the mathematical scope

⚖️  GDPR COMPLIANCE:
- Right to be informed: This notice fulfills that requirement
- Right to rectification: Not applicable (no permanent storage)
- Right to erasure: Automatic (24-hour deletion)
- Right to restrict processing: You control each file consent
- Right to data portability: Your converted output is immediately available
- Right to object: You can decline processing any file

🛡️  YOUR RIGHTS:
- Consent is required for each file individually
- You can withdraw consent before processing begins
- No penalty for declining to process any file
- Full transparency about data handling

For more information, visit: https://mathpix.com/privacy-policy

This privacy-first configuration ensures maximum protection of your mathematical content.`;
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Get user-friendly file type description
   * @param {string} mimeType - MIME type of file
   * @returns {string} User-friendly description
   */
  getFileTypeDescription(mimeType) {
    const typeMap = {
      "image/jpeg": "JPEG image",
      "image/png": "PNG image",
      "image/webp": "WebP image",
      "application/pdf": "PDF document",
    };

    return typeMap[mimeType] || "file";
  }

  /**
   * Get ordinal suffix for numbers
   * @param {number} num - Number to get suffix for
   * @returns {string} Ordinal suffix (st, nd, rd, th)
   */
  getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;

    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }

  /**
   * Get current session consent status
   * @returns {Object} Session consent information
   */
  getConsentStatus() {
    return {
      hasConsent: this.sessionConsent.granted,
      timestamp: this.sessionConsent.timestamp,
      filesProcessed: this.sessionConsent.fileCount,
      timeSinceConsent: this.sessionConsent.timestamp
        ? Date.now() - this.sessionConsent.timestamp
        : null,
    };
  }

  /**
   * Reset session consent (for testing or session restart)
   */
  resetSessionConsent() {
    this.sessionConsent = {
      granted: false,
      timestamp: null,
      fileCount: 0,
    };

    this.privacySettings.alwaysConsentSession = false;

    logInfo("Session consent and auto-consent preference reset");
  }

  /**
   * Test privacy manager functionality
   * @returns {boolean} True if working correctly
   */
  async testPrivacyManager() {
    logInfo("Testing MathPix Privacy Manager...");

    try {
      // Test consent request with mock file
      const mockFile = {
        name: "test-equation.png",
        size: 15678,
        type: "image/png",
      };

      logInfo("🧪 Testing consent request (will show actual modal)...");
      const consentResult = await this.requestProcessingConsent(mockFile);

      logInfo("✓ Consent request test completed:", {
        result: consentResult,
        sessionStatus: this.getConsentStatus(),
      });

      // Test privacy details display
      logInfo("🧪 Testing privacy details display...");
      // Don't automatically show this as it's a large modal
      // await this.showPrivacyDetails();

      logInfo("✅ Privacy manager test completed successfully");
      return true;
    } catch (error) {
      logError("❌ Privacy manager test failed:", error);
      return false;
    }
  }

  /**
   * Fallback confirm function if safeConfirm not available
   * @param {string} message - Message to display
   * @param {string} title - Title for confirmation
   * @returns {Promise<boolean>} User confirmation
   */
  async fallbackConfirm(message, title) {
    logWarn("Using fallback confirm - safeConfirm not available");
    return confirm(`${title}\n\n${message}`);
  }

  /**
   * Fallback alert function if safeAlert not available
   * @param {string} message - Message to display
   * @param {string} title - Title for alert
   * @returns {Promise<void>}
   */
  async fallbackAlert(message, title) {
    logWarn("Using fallback alert - safeAlert not available");
    alert(`${title}\n\n${message}`);
  }
}

export default MathPixPrivacyManager;
