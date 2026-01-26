/**
 * @fileoverview Ally Statement Preview Configuration - IIFE Module
 * @module AllyStatementPreviewConfig
 * @version 1.0.0
 * @since Phase 7B
 *
 * @description
 * Contains accessibility theme definitions, field mappings, and all
 * student-facing content for the Statement Preview feature.
 *
 * Key Features:
 * - Theme-to-API-field mappings for conditional display
 * - Complete disclosure content (What this means / Suggestions)
 * - Icon mappings for each theme
 * - Success/empty state messages
 *
 * @example
 * const themes = ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(issueData);
 * const theme = ALLY_STATEMENT_PREVIEW_CONFIG.getTheme('missing-alt');
 */

const ALLY_STATEMENT_PREVIEW_CONFIG = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyStatementConfig] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementConfig] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementConfig] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementConfig] " + message, ...args);
  }

  // ========================================================================
  // Accessibility Theme Definitions
  // ========================================================================

  /**
   * Accessibility themes with field mappings and display content.
   * Each theme defines:
   * - id: Unique identifier
   * - fields: Array of API field names to sum
   * - icon: Icon name from SVG library
   * - title: Display title (h3)
   * - summary: Brief explanation paragraph
   * - summaryExtra: Optional additional summary paragraph
   * - disclosureId: Unique ID for aria-controls
   * - whatThisMeans: Array of list items (strings or nested objects)
   * - suggestions: Array of list items (strings or nested objects)
   */
  const ACCESSIBILITY_THEMES = [
    {
      id: "missing-alt",
      fields: [
        "alternativeText2",
        "htmlImageAlt2",
        "htmlObjectAlt2",
        "imageDescription2",
      ],
      icon: "missingAlt",
      title: "Missing image descriptions",
      summary:
        "This module includes images without image descriptions, also known as alternative text. We write image descriptions so that those who do not see the image will not miss out on important content.",
      disclosureId: "ally-sp-missing-alt-details",
      whatThisMeans: [
        "Images in Blackboard content can be given descriptions or marked as decorative if they have educational purpose.",
        "Missing image descriptions prevent those using the audio alternative format or assistive technology - such as screen readers - from accessing the important information the image presents.",
        "When decorative images are not marked as decorative, those who use alternative formats such as the audio format or who use screen readers may worry they missed important information.",
      ],
      suggestions: [
        "Ask your module lead to provide descriptions for images that don't have them.",
        {
          text: "Try out different tools that may help you to get a description of the image:",
          nested: [
            'Automatic image description is available in <a href="https://support.google.com/chrome/answer/9311597?hl=en-GB&co=GENIE.Platform%3DDesktop">Chrome</a> and <a href="https://www.microsoft.com/en-us/edge/learning-center/how-to-turn-on-automatic-image-descriptions?form=MA13I2">Edge</a> but descriptions may be unreliable.',
            '<a href="https://www.seeingai.com/">Seeing AI</a> is a mobile app that will describe images using your camera.',
          ],
        },
      ],
    },
    {
      id: "broken-links",
      fields: ["htmlBrokenLink2"],
      icon: "brokenLink",
      title: "Broken links",
      summary:
        "This module includes web links that may not work. This means when you select a link within the module you may receive an error message.",
      disclosureId: "ally-sp-broken-links-details",
      whatThisMeans: [
        {
          text: "Broken links occur when:",
          nested: [
            "The content you're trying to open is no longer available.",
            "You don't have permission to view the content to which the link takes you.",
            "The link contains a typing or spelling error.",
          ],
        },
      ],
      suggestions: [
        "Contact your module lead if you follow a link from your Blackboard module that doesn't appear to work. They can update the link so it works for everyone.",
      ],
    },
    {
      id: "colour-contrast",
      fields: ["contrast2", "htmlColorContrast2"],
      icon: "palette",
      title: "Low colour contrast",
      summary:
        "This module includes content that may be hard to see due to low colour contrast. Colour contrast is about how much one colour stands out against another. For example, bright yellow text on a light blue background is hard to read.",
      disclosureId: "ally-sp-contrast-details",
      whatThisMeans: [
        "Low colour contrast affects everyone, especially when screen glare from reflections makes viewing difficult.",
        "Those with low vision or colour vision deficiency (colour-blindness) are more likely to find low contrast text difficult to read.",
        "As we age it becomes harder to tell the difference between similar colours, making low contrast text harder to read.",
        "If your laptop battery is low and your screen brightness is lowered, low colour contrast content is harder to read.",
      ],
      suggestions: [
        "Try using the beeline reader or immersive reader alternative formats in Blackboard. These allow you to change the colour of the content.",
        'Adobe Reader has a "Replace document colours" feature under accessibility within the preference menu. You can use this to adjust colours within a PDF file.',
        "Your module lead may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    {
      id: "headings",
      fields: [
        "headingsSequential3",
        "headingsPresence2",
        "headingsStartAtOne3",
        "htmlHeadingOrder3",
        "htmlHeadingsPresence2",
        "htmlEmptyHeading2",
        "htmlHeadingsStart2",
      ],
      icon: "document",
      title: "Heading structure",
      summary:
        "You may find some module content hard to navigate or skim read because it lacks proper headings or uses them inappropriately.",
      disclosureId: "ally-sp-headings-details",
      whatThisMeans: [
        "While headings provide a visual overview of different sections of a document, their true value is that they also provide this information in ways we cannot see but computers can.",
        'We can use the <a href="https://support.microsoft.com/en-gb/office/use-the-navigation-pane-in-word-394787be-bca7-459b-894e-3f8511515e55">navigation pane in Word</a> and <a href="https://helpx.adobe.com/uk/acrobat/using/navigating-pdf-pages.html">bookmarks in Adobe Reader</a> to move quickly between sections of a document. This also allows those who use screen readers and other assistive technologies to quickly navigate a document.',
        "When headings haven't been added to a document, moving quickly between sections will be more difficult, particularly for those who rely on assistive technologies such as screen readers.",
        "Incorrect or decorative use of headings can confuse assistive technology users who rely on properly structured headings to navigate the document.",
        'If you use the audio <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative format</a>, it will be harder to understand when one section of the content ends and the next one begins.',
      ],
      suggestions: [
        'If the content was created within the university, ask the module lead to upload a version with a correct heading structure. <a href="https://alt-5f16d636b7ae3.blackboard.com/bbcswebdav/courses/ACCESS1001/Courseware_365_2023/index.html?one_hash=AB54572836B618CEAAFA4BBA44AF3028&f_hash=CC813A4C8FBDD78F1B680AB7CB5B82EA#/lessons/nNcjVunDR0mIhp-U6nTeahqb57sPvgp3">Adding headings to content</a> is fast and easy.',
        {
          text: "If the content was created outside of the university, you may find a newer, more accessible version of the content from the publisher's website.",
          nested: [
            "Your module lead or the library may be able to identify an equivalent resource that is more digitally accessible.",
          ],
        },
      ],
    },
    {
      id: "ocred",
      fields: ["ocred2"],
      icon: "ocr",
      title: "Scanned and OCRed documents",
      summary:
        "This module includes documents scanned and processed with Optical Character Recognition (OCR) to make the text readable by your computer. This process allows you to search for words and copy and paste text from the document into another place. While this is an improvement over a scanned document, potential issues remain.",
      disclosureId: "ally-sp-ocred-details",
      whatThisMeans: [
        'OCR may produce errors like incorrect or incomplete words and missing punctuation, which will especially impact listening to the text through <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative formats</a> or screen readers.',
        "These documents may not have headings. This makes it harder to navigate long documents, for example by using the bookmarks menu in Adobe Acrobat.",
      ],
      suggestions: [
        "Be mindful of potential inaccuracies when using scanned and OCRed documents.",
        "Your module lead may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    {
      id: "scanned",
      fields: ["scanned1"],
      icon: "camera",
      title: "Scanned content",
      summary:
        "This module contains scanned content: a digital photocopy that you cannot interact with. Only sighted readers can access scanned material.",
      disclosureId: "ally-sp-scanned-details",
      whatThisMeans: [
        "By its nature, scanned content can present a range of challenges because it is effectively just a photo of a document.",
        'Tools that convert text to speech such as the audio <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative format</a> and screen readers are unlikely to detect the text from this content.',
        "When magnified or zoomed into, content may appear to be blurred.",
        "You cannot search for words in a scanned document or copy and paste words from a scanned document into another document.",
        "It is not possible to change fonts and colours for the benefit of dyslexic or visually impaired students.",
        "Scanned documents will not have the extra information that can make content more accessible such as headings and alternative text.",
      ],
      suggestions: [
        {
          text: 'Blackboard provides an OCR (Optical Character Recognition) <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative format</a> for scanned documents. This will attempt to:',
          nested: [
            "allow you to listen to it using text to speech.",
            "allow you to copy and paste text from the document.",
          ],
        },
        "Your module lead may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    {
      id: "seizure",
      fields: ["imageSeizure1"],
      icon: "warning",
      title: "Animations that may trigger a seizure",
      summary:
        "This module includes content that may cause a seizure. GIFs and other rapid-movement or flickering media have the potential to trigger seizures or other harmful responses.",
      disclosureId: "ally-sp-seizure-details",
      whatThisMeans: [
        "We disabled autoplay for these animations. A warning icon replaces the play button. Select it to start the animation.",
        "These animations may trigger seizures, vertigo, nausea and imbalance, especially in people with photosensitive epilepsy or vestibular conditions.",
      ],
      suggestions: [
        "If you encounter an animation with a warning symbol instead of a play button, ask your module lead for an alternative way to access the information that the animation presents.",
      ],
    },
    {
      id: "tables",
      fields: ["tableHeaders2", "htmlEmptyTableHeader2", "htmlTdHasHeader2"],
      icon: "table",
      title: "Tables without heading information",
      summary:
        "When we look at a table visually, we tend to make row or column headings bold to make clear that the other cells in the table are related to those headings.",
      summaryExtra:
        "Besides this visual distinction we should also provide a way for computers to understand the table headings. When this is missing it can present the information in a way that is hard to understand for those who use text to speech or other assistive technology tools.",
      disclosureId: "ally-sp-tables-details",
      whatThisMeans: [
        "Without table heading information, screen readers and Blackboard's alternative audio format will read each cell individually, making the table's content difficult to understand.",
        "The larger the table, the more this issue impacts your ability to understand it, as you must rely on memory to mentally reconstruct the table.",
      ],
      suggestions: [
        "If the content was created within the University of Southampton, your module lead or instructor may be able to update the tables and share this updated version in the Blackboard module.",
        "If the resource was created externally, your module lead may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    {
      id: "tagged",
      fields: ["tagged2"],
      icon: "pdf",
      title: "PDF files that lack a logical structure",
      summary:
        "This module contains PDF files that lack a logical structure affecting how they perform with assistive technologies. To better support assistive technologies, PDF files should have tags. PDF tags make it possible to identify content as headings, lists, tables, etc., and to include alternate text for images. Without tags, none of these accessibility features are possible.",
      disclosureId: "ally-sp-tagged-details",
      whatThisMeans: [
        "This will primarily affect those who use assistive technologies, particularly screen readers. Without a clear structure, the text might not be read in the right order, and things like tables, images, and lists won't work as expected.",
        'If you convert these PDFs into <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative formats</a>, you may find that tables, images, and lists don\'t show up correctly.',
      ],
      suggestions: [
        "Adobe Acrobat has an autotagging feature that will use AI to add tags. While it is not perfect the result may be beneficial while awaiting an improved version.",
        'If the document was originally an office document created by someone within the University, your module lead can create a version with tags <a href="https://knowledgenow.soton.ac.uk/Articles/KB0082847">by following our knowledge base article</a>.',
        "If the document was published externally, your module lead may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
  ];

  // ========================================================================
  // Introduction and Success State Content
  // ========================================================================

  /**
   * Introduction section content
   */
  const INTRO_TEXT = {
    heading: "Introduction",
    paragraphs: [
      "This section provides information about potential accessibility issues you may encounter in the module.",
      "We'll explain:",
    ],
    bulletPoints: [
      "what this means",
      "the likely impact",
      "what you can do about it",
    ],
  };

  /**
   * Success state content (shown when no issues found)
   */
  const SUCCESS_STATE = {
    icon: "checkCircle",
    title: "No known accessibility issues",
    message:
      "Based on our automated checks, this module has no known accessibility issues. If you encounter any barriers, please contact your module lead.",
  };

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Creates a lookup map for quick theme retrieval by ID
   */
  const themeMap = (function () {
    const map = {};
    ACCESSIBILITY_THEMES.forEach(function (theme) {
      map[theme.id] = theme;
    });
    return map;
  })();

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    /**
     * All accessibility themes
     * @type {Array}
     */
    THEMES: ACCESSIBILITY_THEMES,

    /**
     * Introduction text configuration
     * @type {Object}
     */
    INTRO: INTRO_TEXT,

    /**
     * Success state configuration
     * @type {Object}
     */
    SUCCESS: SUCCESS_STATE,

    /**
     * Gets a theme by its ID
     * @param {string} id - Theme ID (e.g., 'missing-alt', 'broken-links')
     * @returns {Object|null} Theme configuration or null if not found
     */
    getTheme: function (id) {
      const theme = themeMap[id] || null;
      if (!theme) {
        logWarn("Theme not found: " + id);
      }
      return theme;
    },

    /**
     * Calculates the total issue count for a theme from API data
     * @param {Object} theme - Theme configuration object
     * @param {Object} issueData - API response data containing issue counts
     * @returns {number} Total issues for this theme (sum of all mapped fields)
     */
    calculateThemeIssues: function (theme, issueData) {
      if (!theme || !theme.fields || !issueData) {
        return 0;
      }

      let total = 0;
      theme.fields.forEach(function (field) {
        const value = issueData[field];
        if (typeof value === "number" && !isNaN(value)) {
          total += value;
        }
      });

      logDebug(
        "Theme '" + theme.id + "' has " + total + " issues from fields:",
        theme.fields,
      );
      return total;
    },

    /**
     * Gets themes that have issues (count > 0)
     * @param {Object} issueData - API response data containing issue counts
     * @returns {Array} Array of {theme, count} objects for themes with issues
     */
    getActiveThemes: function (issueData) {
      const self = this;
      const active = [];

      if (!issueData) {
        logWarn("No issue data provided to getActiveThemes");
        return active;
      }

      ACCESSIBILITY_THEMES.forEach(function (theme) {
        const count = self.calculateThemeIssues(theme, issueData);
        if (count > 0) {
          active.push({ theme: theme, count: count });
        }
      });

      logInfo(
        "Found " +
          active.length +
          " active themes out of " +
          ACCESSIBILITY_THEMES.length +
          " total",
      );
      return active;
    },

    /**
     * Gets all field names used across all themes
     * @returns {Array} Array of unique field names
     */
    getAllFields: function () {
      const fields = new Set();
      ACCESSIBILITY_THEMES.forEach(function (theme) {
        theme.fields.forEach(function (field) {
          fields.add(field);
        });
      });
      return Array.from(fields);
    },

    /**
     * Gets the theme ID for a given field name
     * @param {string} fieldName - API field name
     * @returns {string|null} Theme ID or null if field not found
     */
    getThemeForField: function (fieldName) {
      for (let i = 0; i < ACCESSIBILITY_THEMES.length; i++) {
        const theme = ACCESSIBILITY_THEMES[i];
        if (theme.fields.indexOf(fieldName) !== -1) {
          return theme.id;
        }
      }
      return null;
    },

    /**
     * Gets debug information about the configuration
     * @returns {Object} Debug information
     */
    getDebugInfo: function () {
      return {
        themeCount: ACCESSIBILITY_THEMES.length,
        themes: ACCESSIBILITY_THEMES.map(function (t) {
          return {
            id: t.id,
            title: t.title,
            fieldCount: t.fields.length,
          };
        }),
        totalFields: this.getAllFields().length,
      };
    },
  };
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyStatementPreviewConfig = function () {
  console.group("ALLY_STATEMENT_PREVIEW_CONFIG Tests");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence tests
  test(
    "ALLY_STATEMENT_PREVIEW_CONFIG exists",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG === "object",
  );
  test("has THEMES array", Array.isArray(ALLY_STATEMENT_PREVIEW_CONFIG.THEMES));
  test(
    "has INTRO object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.INTRO === "object",
  );
  test(
    "has SUCCESS object",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS === "object",
  );

  // Method existence tests
  test(
    "has getTheme method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getTheme === "function",
  );
  test(
    "has calculateThemeIssues method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues === "function",
  );
  test(
    "has getActiveThemes method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes === "function",
  );
  test(
    "has getAllFields method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields === "function",
  );
  test(
    "has getThemeForField method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField === "function",
  );
  test(
    "has getDebugInfo method",
    typeof ALLY_STATEMENT_PREVIEW_CONFIG.getDebugInfo === "function",
  );

  // Theme structure tests
  const themes = ALLY_STATEMENT_PREVIEW_CONFIG.THEMES;
  test("has 9 themes", themes.length === 9);

  const firstTheme = themes[0];
  test("first theme has id", typeof firstTheme.id === "string");
  test("first theme has fields array", Array.isArray(firstTheme.fields));
  test("first theme has icon", typeof firstTheme.icon === "string");
  test("first theme has title", typeof firstTheme.title === "string");
  test("first theme has summary", typeof firstTheme.summary === "string");
  test(
    "first theme has disclosureId",
    typeof firstTheme.disclosureId === "string",
  );
  test(
    "first theme has whatThisMeans array",
    Array.isArray(firstTheme.whatThisMeans),
  );
  test(
    "first theme has suggestions array",
    Array.isArray(firstTheme.suggestions),
  );

  // getTheme tests
  const missingAltTheme = ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("missing-alt");
  test("getTheme returns correct theme", missingAltTheme !== null);
  test(
    "getTheme returns theme with correct title",
    missingAltTheme && missingAltTheme.title === "Missing image descriptions",
  );
  test(
    "getTheme returns null for unknown theme",
    ALLY_STATEMENT_PREVIEW_CONFIG.getTheme("unknown-theme") === null,
  );

  // calculateThemeIssues tests
  const mockIssueData = {
    alternativeText2: 5,
    htmlImageAlt2: 3,
    htmlObjectAlt2: 0,
    imageDescription2: 2,
  };
  const issueCount = ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues(
    missingAltTheme,
    mockIssueData,
  );
  test("calculateThemeIssues returns correct count", issueCount === 10);
  test(
    "calculateThemeIssues handles null data",
    ALLY_STATEMENT_PREVIEW_CONFIG.calculateThemeIssues(
      missingAltTheme,
      null,
    ) === 0,
  );

  // getActiveThemes tests
  const activeThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(mockIssueData);
  test("getActiveThemes returns array", Array.isArray(activeThemes));
  test(
    "getActiveThemes returns themes with issues",
    activeThemes.length > 0 && activeThemes[0].count > 0,
  );

  // getActiveThemes with no issues
  const emptyData = {};
  const noActiveThemes =
    ALLY_STATEMENT_PREVIEW_CONFIG.getActiveThemes(emptyData);
  test(
    "getActiveThemes returns empty array for no issues",
    noActiveThemes.length === 0,
  );

  // getAllFields tests
  const allFields = ALLY_STATEMENT_PREVIEW_CONFIG.getAllFields();
  test("getAllFields returns array", Array.isArray(allFields));
  test("getAllFields has reasonable count", allFields.length > 10);
  test(
    "getAllFields includes known field",
    allFields.indexOf("alternativeText2") !== -1,
  );

  // getThemeForField tests
  const themeForField =
    ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField("alternativeText2");
  test(
    "getThemeForField returns correct theme",
    themeForField === "missing-alt",
  );
  test(
    "getThemeForField returns null for unknown field",
    ALLY_STATEMENT_PREVIEW_CONFIG.getThemeForField("unknownField123") === null,
  );

  // INTRO structure tests
  const intro = ALLY_STATEMENT_PREVIEW_CONFIG.INTRO;
  test("INTRO has heading", typeof intro.heading === "string");
  test("INTRO has paragraphs array", Array.isArray(intro.paragraphs));
  test("INTRO has bulletPoints array", Array.isArray(intro.bulletPoints));

  // SUCCESS structure tests
  const success = ALLY_STATEMENT_PREVIEW_CONFIG.SUCCESS;
  test("SUCCESS has icon", typeof success.icon === "string");
  test("SUCCESS has title", typeof success.title === "string");
  test("SUCCESS has message", typeof success.message === "string");

  // Debug info test
  const debugInfo = ALLY_STATEMENT_PREVIEW_CONFIG.getDebugInfo();
  test("getDebugInfo returns object", typeof debugInfo === "object");
  test("debugInfo has themeCount", typeof debugInfo.themeCount === "number");
  test("debugInfo has themes array", Array.isArray(debugInfo.themes));

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};
