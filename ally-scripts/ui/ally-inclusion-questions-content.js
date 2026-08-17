/**
 * @fileoverview Ally Statement Preview - Inclusion Questionnaire Content
 * @module AllyInclusionQuestionsContent
 * @requires None - Standalone content library
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Single source of truth for the author-facing "inclusion questions": a
 * module-lead contact step plus the six questions that drive the visibility
 * of the "How your module was created with accessibility and inclusion in
 * mind" cards (group id `inclusive-design`) in the Statement Preview.
 *
 * Each card-gating question maps 1:1 to a card via `cardId`, and its `id` is
 * the stable handle stored in ALLY_INCLUSION_ANSWERS and referenced by the
 * card's `showWhen: "answer:<id>"` rule. Five questions are Yes/No; one is a
 * free-text (Markdown) message. The leading "contact" step gates no card —
 * its two fields feed the {moduleLead}/{moduleLeadEmail} live tokens in the
 * statement header. Order here is the wizard step order.
 *
 * NOTE: the `prompt`/`points` wording below is DRAFT — derived from each card's
 * content and the one worked example supplied during planning. It is authored
 * copy the module owner should review and replace; changing these strings has
 * no structural effect. Each `videoUrl` is the Panopto Embed.aspx src supplied
 * for that step's guide video (stored verbatim so per-video params stay
 * adjustable); `videoTitle` is its accessible <iframe> title. `readMoreUrl` is
 * the written-guidance page for the same topic, surfaced as a "Read more" link
 * below the video.
 *
 * Exposed globally as ALLY_INCLUSION_QUESTIONS_CONTENT (and on window).
 */

const ALLY_INCLUSION_QUESTIONS_CONTENT = (function () {
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
      console.error("[AllyInclusionQuestionsContent] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyInclusionQuestionsContent] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyInclusionQuestionsContent] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyInclusionQuestionsContent] " + message, ...args);
  }

  // ========================================================================
  // Question definitions (wizard step order)
  // ========================================================================
  //
  // Shape:
  //   id       - stable handle; stored key + `answer:<id>` show-rule target
  //              (the "contact" step's id is never stored — its `fields` carry
  //              their own store ids instead)
  //   cardId   - the inclusive-design card this question toggles (null = none)
  //   type     - "yesno" | "markdown" | "contact"
  //   title    - short label (review list / progress heading / modal title)
  //   prompt   - the question stem (plain text)
  //   points   - optional array of bullet strings shown under the prompt
  //   help     - optional short helper line (markdown question)
  //   fields   - contact type only: [{ id, label, inputType }] — each field's
  //              `id` is its own ALLY_INCLUSION_ANSWERS store key
  //   videoUrl - Panopto Embed.aspx src for the step's guide video (null = none)
  //   videoTitle - accessible <iframe> title for that video
  //   readMoreUrl - written-guidance page for the step, opened in a new tab from
  //              the "Read more" link under the video (null = no link)

  const QUESTIONS = [
    {
      id: "module-lead-contact",
      cardId: null,
      type: "contact",
      title: "Module lead details",
      prompt:
        "Confirm the module lead's name and email address. These appear in the statement header, and the module lead is named as accountable for the accessibility information in the statement.",
      fields: [
        { id: "module-lead-name", label: "Module lead name", inputType: "text" },
        { id: "module-lead-email", label: "Module lead email", inputType: "email" },
      ],
      videoUrl: null,
      videoTitle: null,
      readMoreUrl: null,
    },
    {
      id: "supporting-student-accessibility",
      cardId: "inclusive-design-inclusive-experience",
      type: "yesno",
      title: "Supporting student accessibility",
      prompt:
        "The module team has engaged with student disability and inclusion expertise and is actively working to make this module more inclusive — listening to what students and inclusion experts suggest and acting on it.",
      points: [],
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=60178f5b-1c56-4a87-921e-b39b00dec120&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all",
      videoTitle: "Video guide: Supporting student accessibility",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-1/",
    },
    {
      id: "creating-accessible-content",
      cardId: "inclusive-design-accessible-content",
      type: "yesno",
      title: "Creating accessible content",
      prompt:
        "When the team creates or updates module content, where possible it checks the content with accessibility tools and acts on the feedback:",
      points: [
        "new and updated content is checked with accessibility tools (for example the Microsoft Accessibility Checker or Blackboard Ally)",
        "problems those tools find are fixed by the team",
      ],
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=30f76248-2a03-406d-b1af-b39b00fddb7e&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all",
      videoTitle: "Video guide: Creating accessible content",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-2/",
    },
    {
      id: "content-curation",
      cardId: "inclusive-design-organising-content",
      type: "yesno",
      title: "Content curation",
      prompt:
        "Module content is clearly organised and signposted so students can find their way around:",
      points: [
        "each item has a clear purpose (what it is, why it is useful, what to do with it)",
        "helpful signposts guide students (for example 'before your next class…')",
        "files are named consistently and meaningfully",
      ],
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=ab0024ba-cc6a-4371-b605-b39b00fe39d5&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all",
      videoTitle: "Video guide: Content curation",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-3/",
    },
    {
      id: "assessment-clarity",
      cardId: "inclusive-design-understanding-assessments",
      type: "yesno",
      title: "Assessment clarity",
      prompt: "The module's assessment section provides:",
      points: [
        "a clear breakdown of assessment weighting",
        "a sub-section for each assessment that specifies whether it is formative or summative",
        "the brief, instructions, deadline, and mark scheme or rubric for each assessment",
        "how and when students will receive feedback",
      ],
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=f76b4947-4521-4f7e-889d-b39b00feea7c&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all",
      videoTitle: "Video guide: Assessment clarity",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-4/",
    },
    {
      id: "online-reading-lists",
      cardId: "inclusive-design-reading-list",
      type: "yesno",
      title: "Online reading lists",
      prompt:
        "This module has an online reading list giving direct access to its books, journal articles and other resources, with each resource labelled by importance (for example 'essential' or 'additional').",
      points: [],
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=be2b7ea9-d73d-4980-a0ff-b2b200f1ee8c&autoplay=false&offerviewer=true&showtitle=true&showbrand=false&captions=true&interactivity=all",
      videoTitle: "Video guide: Online reading lists",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-5/",
    },
    {
      id: "additional-information",
      cardId: "inclusive-design-module-lead-message",
      type: "markdown",
      title: "A message from the module lead",
      prompt:
        "Would you like to add a personal message from the module lead? It appears as its own card in the statement.",
      help: "Write in Markdown. Leave this blank to omit the message card entirely.",
      videoUrl:
        "https://southampton.cloud.panopto.eu/Panopto/Pages/Embed.aspx?id=0c8aec77-5b51-4feb-8787-b3b000cce400&autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=true&interactivity=all",
      videoTitle: "Video guide: A message from the module lead",
      readMoreUrl: "https://elearn.soton.ac.uk/knowledge-base/bmas-statement-6/",
    },
  ];

  // ========================================================================
  // Public API
  // ========================================================================

  const publicApi = {
    /**
     * Returns a shallow copy of the ordered question definitions.
     * @returns {Array<Object>}
     */
    getQuestions: function () {
      return QUESTIONS.map(function (q) {
        return Object.assign({}, q);
      });
    },

    /**
     * Returns a single question definition by id (copy), or null.
     * @param {string} id
     * @returns {Object|null}
     */
    getById: function (id) {
      const found = QUESTIONS.find(function (q) {
        return q.id === id;
      });
      return found ? Object.assign({}, found) : null;
    },

    /**
     * The ordered list of question ids.
     * @returns {Array<string>}
     */
    ids: function () {
      return QUESTIONS.map(function (q) {
        return q.id;
      });
    },
  };

  logDebug("Inclusion questionnaire content loaded (" + QUESTIONS.length + " questions)");
  return publicApi;
})();

if (typeof window !== "undefined") {
  window.ALLY_INCLUSION_QUESTIONS_CONTENT = ALLY_INCLUSION_QUESTIONS_CONTENT;
}
