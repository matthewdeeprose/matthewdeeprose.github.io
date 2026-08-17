/**
 * @fileoverview Ally Statement Preview Content Library - IIFE Module
 * @module AllyStatementPreviewContent
 * @version 1.0.0
 * @since Statement Preview build-out Stage 1
 *
 * @description
 * The single authoritative store of all student-facing text for the
 * Statement Preview feature. Published as a plain object literal on
 * `window.ALLY_SP_CONTENT` via a `<script>` tag (NOT fetched JSON) so it
 * loads identically over the preview server AND over a bare `file://` path —
 * there is no fetch to be blocked by the file:// origin.
 *
 * The configuration module (`ally-statement-preview-config.js`) is a thin
 * adapter over this library: every legacy accessor (THEMES, INTRO, SUCCESS,
 * getTheme, getActiveThemes, getAllFields, getThemeForField, getTokens,
 * getEnvironments, resolve*) derives its shapes from here. Raw content stays
 * a token-bearing projection — literal `{token}` strings live here unchanged;
 * token resolution happens later at render time and never mutates this store.
 *
 * Shape (the "unifying model", plan §"The unifying model"):
 * - `entries` — one flat map keyed by a STABLE content id. Each entry carries
 *   `id` (the stable content id, == its key), `kind`
 *   (`theme` | `intro` | `success` | `authored`), and for themes a `legacyId`
 *   (e.g. "missing-alt") so `getTheme("missing-alt")` and `THEMES[i].id` stay
 *   unchanged. Theme entries otherwise keep today's exact theme shape.
 * - `environments` — the institution / VLE wording profiles (editable content).
 * - `defaultEnvironment` — the id selected on first load.
 *
 * @example
 * const entry = window.ALLY_SP_CONTENT.entries["theme:missing-alt"];
 * // entry.legacyId === "missing-alt"; entry.title === "Missing image descriptions"
 */

(function () {
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
      console.error("[AllyStatementContent] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementContent] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementContent] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementContent] " + message, ...args);
  }

  // ========================================================================
  // Content library — flat map keyed by stable content id
  // ========================================================================
  //
  // Theme entries keep today's exact theme shape (fields, icon, title,
  // summary, [summaryExtra], disclosureId, whatThisMeans, suggestions) plus
  // the content-library metadata (id, kind, legacyId). All literal {token}
  // placeholders are preserved verbatim.

  const ENTRIES = {
    "theme:missing-alt": {
      id: "theme:missing-alt",
      kind: "theme",
      legacyId: "missing-alt",
      fields: [
        "alternativeText2",
        "htmlImageAlt2",
        "htmlObjectAlt2",
        "imageDescription2",
      ],
      icon: "missingAlt",
      title: "Missing image descriptions",
      summary:
        "This {courseNoun} includes images without image descriptions, also known as alternative text. We write image descriptions so that those who do not see the image will not miss out on important content.",
      disclosureId: "ally-sp-missing-alt-details",
      whatThisMeans: [
        "Images in {vle} content can be given descriptions or marked as decorative if they have educational purpose.",
        "Missing image descriptions prevent those using the audio alternative format or assistive technology - such as screen readers - from accessing the important information the image presents.",
        "When decorative images are not marked as decorative, those who use alternative formats such as the audio format or who use screen readers may worry they missed important information.",
      ],
      suggestions: [
        "Ask your {contentOwner} to provide descriptions for images that don't have them.",
        {
          text: "Try out different tools that may help you to get a description of the image:",
          nested: [
            'Automatic image description is available in <a href="https://support.google.com/chrome/answer/9311597?hl=en-GB&co=GENIE.Platform%3DDesktop">Chrome</a> and <a href="https://www.microsoft.com/en-us/edge/learning-center/how-to-turn-on-automatic-image-descriptions?form=MA13I2">Edge</a> but descriptions may be unreliable.',
            '<a href="https://www.seeingai.com/">Seeing AI</a> is a mobile app that will describe images using your camera.',
          ],
        },
      ],
    },
    "theme:broken-links": {
      id: "theme:broken-links",
      kind: "theme",
      legacyId: "broken-links",
      fields: ["htmlBrokenLink2"],
      icon: "brokenLink",
      title: "Broken links",
      summary:
        "This {courseNoun} includes web links that may not work. This means when you select a link within the {courseNoun} you may receive an error message.",
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
        "Contact your {contentOwner} if you follow a link in {vle} that doesn't appear to work. They can update the link so it works for everyone.",
      ],
    },
    "theme:colour-contrast": {
      id: "theme:colour-contrast",
      kind: "theme",
      legacyId: "colour-contrast",
      fields: ["contrast2", "htmlColorContrast2"],
      icon: "palette",
      title: "Low colour contrast",
      summary:
        "This {courseNoun} includes content that may be hard to see due to low colour contrast. Colour contrast is about how much one colour stands out against another. For example, bright yellow text on a light blue background is hard to read.",
      disclosureId: "ally-sp-contrast-details",
      whatThisMeans: [
        "Low colour contrast affects everyone, especially when screen glare from reflections makes viewing difficult.",
        "Those with low vision or colour vision deficiency (colour-blindness) are more likely to find low contrast text difficult to read.",
        "As we age it becomes harder to tell the difference between similar colours, making low contrast text harder to read.",
        "If your laptop battery is low and your screen brightness is lowered, low colour contrast content is harder to read.",
      ],
      suggestions: [
        "Try using the beeline reader or immersive reader alternative formats in {vle}. These allow you to change the colour of the content.",
        'Adobe Reader has a "Replace document colours" feature under accessibility within the preference menu. You can use this to adjust colours within a PDF file.',
        "Your {contentOwner} may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    "theme:headings": {
      id: "theme:headings",
      kind: "theme",
      legacyId: "headings",
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
        "You may find some {courseNoun} content hard to navigate or skim read because it lacks proper headings or uses them inappropriately.",
      disclosureId: "ally-sp-headings-details",
      whatThisMeans: [
        "While headings provide a visual overview of different sections of a document, their true value is that they also provide this information in ways we cannot see but computers can.",
        'We can use the <a href="https://support.microsoft.com/en-gb/office/use-the-navigation-pane-in-word-394787be-bca7-459b-894e-3f8511515e55">navigation pane in Word</a> and <a href="https://helpx.adobe.com/uk/acrobat/using/navigating-pdf-pages.html">bookmarks in Adobe Reader</a> to move quickly between sections of a document. This also allows those who use screen readers and other assistive technologies to quickly navigate a document.',
        "When headings haven't been added to a document, moving quickly between sections will be more difficult, particularly for those who rely on assistive technologies such as screen readers.",
        "Incorrect or decorative use of headings can confuse assistive technology users who rely on properly structured headings to navigate the document.",
        'If you use the audio <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative format</a>, it will be harder to understand when one section of the content ends and the next one begins.',
      ],
      suggestions: [
        'If the content was created within {institutionShort}, ask the {contentOwner} to upload a version with a correct heading structure. <a href="https://alt-5f16d636b7ae3.blackboard.com/bbcswebdav/courses/ACCESS1001/Courseware_365_2023/index.html?one_hash=AB54572836B618CEAAFA4BBA44AF3028&f_hash=CC813A4C8FBDD78F1B680AB7CB5B82EA#/lessons/nNcjVunDR0mIhp-U6nTeahqb57sPvgp3">Adding headings to content</a> is fast and easy.',
        {
          text: "If the content was created outside of {institutionShort}, you may find a newer, more accessible version of the content from the publisher's website.",
          nested: [
            "Your {contentOwner} or the {library} may be able to identify an equivalent resource that is more digitally accessible.",
          ],
        },
      ],
    },
    "theme:ocred": {
      id: "theme:ocred",
      kind: "theme",
      legacyId: "ocred",
      fields: ["ocred2"],
      icon: "ocr",
      title: "Scanned and OCRed documents",
      summary:
        "This {courseNoun} includes documents scanned and processed with Optical Character Recognition (OCR) to make the text readable by your computer. This process allows you to search for words and copy and paste text from the document into another place. While this is an improvement over a scanned document, potential issues remain.",
      disclosureId: "ally-sp-ocred-details",
      whatThisMeans: [
        'OCR may produce errors like incorrect or incomplete words and missing punctuation, which will especially impact listening to the text through <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative formats</a> or screen readers.',
        "These documents may not have headings. This makes it harder to navigate long documents, for example by using the bookmarks menu in Adobe Acrobat.",
      ],
      suggestions: [
        "Be mindful of potential inaccuracies when using scanned and OCRed documents.",
        "Your {contentOwner} may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    "theme:scanned": {
      id: "theme:scanned",
      kind: "theme",
      legacyId: "scanned",
      fields: ["scanned1"],
      icon: "camera",
      title: "Scanned content",
      summary:
        "This {courseNoun} contains scanned content: a digital photocopy that you cannot interact with. Only sighted readers can access scanned material.",
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
          text: '{vle} provides an OCR (Optical Character Recognition) <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative format</a> for scanned documents. This will attempt to:',
          nested: [
            "allow you to listen to it using text to speech.",
            "allow you to copy and paste text from the document.",
          ],
        },
        "Your {contentOwner} may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    "theme:seizure": {
      id: "theme:seizure",
      kind: "theme",
      legacyId: "seizure",
      fields: ["imageSeizure1"],
      icon: "warning",
      title: "Animations that may trigger a seizure",
      summary:
        "This {courseNoun} includes content that may cause a seizure. GIFs and other rapid-movement or flickering media have the potential to trigger seizures or other harmful responses.",
      disclosureId: "ally-sp-seizure-details",
      whatThisMeans: [
        "We disabled autoplay for these animations. A warning icon replaces the play button. Select it to start the animation.",
        "These animations may trigger seizures, vertigo, nausea and imbalance, especially in people with photosensitive epilepsy or vestibular conditions.",
      ],
      suggestions: [
        "If you encounter an animation with a warning symbol instead of a play button, ask your {contentOwner} for an alternative way to access the information that the animation presents.",
      ],
    },
    "theme:tables": {
      id: "theme:tables",
      kind: "theme",
      legacyId: "tables",
      fields: ["tableHeaders2", "htmlEmptyTableHeader2", "htmlTdHasHeader2"],
      icon: "table",
      title: "Tables without heading information",
      summary:
        "When we look at a table visually, we tend to make row or column headings bold to make clear that the other cells in the table are related to those headings.",
      summaryExtra:
        "Besides this visual distinction we should also provide a way for computers to understand the table headings. When this is missing it can present the information in a way that is hard to understand for those who use text to speech or other assistive technology tools.",
      disclosureId: "ally-sp-tables-details",
      whatThisMeans: [
        "Without table heading information, screen readers and {vle}'s alternative audio format will read each cell individually, making the table's content difficult to understand.",
        "The larger the table, the more this issue impacts your ability to understand it, as you must rely on memory to mentally reconstruct the table.",
      ],
      suggestions: [
        "If the content was created within {institution}, your {contentOwner} or instructor may be able to update the tables and share this updated version in {vle}.",
        "If the resource was created externally, your {contentOwner} may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },
    "theme:tagged": {
      id: "theme:tagged",
      kind: "theme",
      legacyId: "tagged",
      fields: ["tagged2"],
      icon: "pdf",
      title: "PDF files that lack a logical structure",
      summary:
        "This {courseNoun} contains PDF files that lack a logical structure affecting how they perform with assistive technologies. To better support assistive technologies, PDF files should have tags. PDF tags make it possible to identify content as headings, lists, tables, etc., and to include alternate text for images. Without tags, none of these accessibility features are possible.",
      disclosureId: "ally-sp-tagged-details",
      whatThisMeans: [
        "This will primarily affect those who use assistive technologies, particularly screen readers. Without a clear structure, the text might not be read in the right order, and things like tables, images, and lists won't work as expected.",
        'If you convert these PDFs into <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats">alternative formats</a>, you may find that tables, images, and lists don\'t show up correctly.',
      ],
      suggestions: [
        "Adobe Acrobat has an autotagging feature that will use AI to add tags. While it is not perfect the result may be beneficial while awaiting an improved version.",
        'If the document was originally an office document created by someone within {institution}, your {contentOwner} can create a version with tags <a href="https://knowledgenow.soton.ac.uk/Articles/KB0082847">by following our knowledge base article</a>.',
        "If the document was published externally, your {contentOwner} may be able to identify an equivalent resource that is more digitally accessible.",
      ],
    },

    // ----------------------------------------------------------------------
    // Non-theme content entries
    // ----------------------------------------------------------------------

    intro: {
      id: "intro",
      kind: "intro",
      // The section's main heading (h4, beside the magnifying-glass-chart icon
      // in the info-box gutter); "Introduction" is now an h5 sub-heading inside
      // the box (see `subHeading`).
      heading: "Accessibility data",
      subHeading: "Introduction",
      paragraphs: [
        "This section provides information about potential accessibility issues you may encounter in the {courseNoun}.",
        "We'll explain:",
      ],
      bulletPoints: [
        "what this means",
        "the likely impact",
        "what you can do about it",
      ],
    },

    success: {
      id: "success",
      kind: "success",
      icon: "checkCircle",
      title: "No known accessibility issues",
      message:
        "Based on our automated checks, this {courseNoun} has no known accessibility issues. If you encounter any barriers, please contact your {contentOwner}.",
    },
  };

  // ========================================================================
  // Authored (static / config-driven) sections
  // ========================================================================
  //
  // Rendered via the section registry (ALLY_STATEMENT_PREVIEW_SECTIONS). Kept as
  // a top-level array (not folded into `entries`) because these are ordered
  // section specs, not id-keyed content; the layout model references them by
  // their stable `id`.
  //
  // Live per-render tokens ({courseName}, {courseCode}, {academicYear},
  // {lastRefreshed}, {inclusionMessage}, {moduleLead}, {moduleLeadEmail},
  // {moduleLeadHtml}, {statementLastEdited}) are merged over the environment
  // tokens by the controller at render time, so authored content can reference
  // the live course, its Ally-data refresh time, and the inclusion
  // questionnaire's module-lead answers. {lastRefreshed} and
  // {statementLastEdited} resolve to ready-built <time> elements (the latter
  // to a placeholder span when unanswered) and {moduleLeadHtml} to the escaped
  // name or its placeholder span — all three are innerHTML-context only.
  // {moduleLead}/{moduleLeadEmail} are the plain values ("" when unanswered,
  // falling through to the courseInfo item placeholders).

  const AUTHORED_SECTIONS = [
    {
      // Statement header — the overarching title (rendered <h3>, the top of the
      // statement) plus two labelled metadata groups. Module lead, email and
      // last-edited details are not available from the Ally API — they resolve
      // from the inclusion questionnaire's contact step via the {moduleLead} /
      // {moduleLeadEmail} / {moduleLeadHtml} / {statementLastEdited} live
      // tokens, falling back to fill-in placeholders when unanswered.
      type: "courseInfo",
      id: "statement-header",
      // Section role: the one-and-only statement header (see markExportable →
      // data-sp-category). Header has no top/bottom region.
      category: "header",
      heading: "{vle} accessibility statement for {courseName}",
      groups: [
        {
          heading: "Module Information",
          items: [
            { label: "Module Code", value: "{courseCode}" },
            {
              label: "Academic Year",
              value: "{academicYear}",
              placeholder: "[Add academic year]",
            },
          ],
          notes: [
            // {moduleLeadHtml}/{statementLastEdited} are innerHTML-context tokens
            // that carry their own placeholder-span fallback when unanswered.
            "This statement last edited by {moduleLeadHtml} on {statementLastEdited}.",
            "Accessibility data last refreshed on {lastRefreshed}.",
          ],
        },
        {
          heading: "Module Lead",
          graphic: "userCard",
          items: [
            {
              label: "Module Lead",
              value: "{moduleLead}",
              placeholder: "[Add module lead]",
              icon: "user",
            },
            {
              label: "Email",
              email: "{moduleLeadEmail}",
              placeholder: "[Add email]",
              icon: "mail",
            },
          ],
        },
      ],
    },
    {
      // "What this statement tells you" — an introductory info box sitting
      // directly below the statement header (before the intro). Renders at h4
      // (with an h5 sub-heading) via the controller's heading-level threading,
      // nesting under the h3 statement title. {courseName}/{courseCode} are live
      // per-render tokens; {moduleLeadHtml} resolves to the questionnaire's
      // module-lead name (or its placeholder span when unanswered).
      type: "info",
      id: "what-this-tells-you",
      // Section role: fixed institutional boilerplate, sitting above the data
      // section (top boilerplate) — see markExportable → data-sp-category/region.
      category: "boilerplate",
      region: "top",
      heading: "What this statement tells you",
      icon: "brain",
      columns: [
        {
          blocks: [
            {
              p: "The University of Southampton is creating a more inclusive virtual learning environment. {moduleLeadHtml} is accountable for providing information on the accessibility status of learning content within {courseName} ({courseCode}).",
            },
            {
              ul: [
                "This accessibility information benefits everyone, not only disabled students, students with mental health conditions, or specific learning differences.",
                "This statement will help to direct you to the tools, support and techniques you can use for a more accessible experience.",
                "This statement will include information on actions taken to design inclusive content.",
              ],
            },
            { h4: "Telling us about a disability", icon: "messageSquare" },
            {
              p: 'If you let the module teaching team know that you have a disability, they will act quickly to make reasonable adjustments. They will also contact the <a href="https://sotonac.sharepoint.com/teams/StudentDisabilityandInclusionTeamSupport">Student Disability and Inclusion</a> team to get advice and make sure the support is consistent.',
            },
          ],
        },
      ],
    },
    {
      // "How your module was created with accessibility and inclusion in mind" —
      // a GROUP wrapper (a part heading over a set of child info boxes) placed
      // BETWEEN the top boilerplate (what-this-tells-you) and the data section
      // (intro) via the Soton layout. Each child is an OPTIONAL, unique answer to
      // a "how was this designed inclusively?" question. Children will later carry
      // show-rules (criteria TBD) evaluated by the controller's ctx.shouldShow
      // hook; the whole group SELF-COLLAPSES (part heading included) when none
      // qualify — renderGroup returns null. The handHeart icon sits beside the
      // part heading (decorative). category "inclusive-design" marks this new role
      // in the show/hide taxonomy. The group heading renders at h4 (title-first
      // layout) with child info boxes at h5.
      type: "group",
      id: "inclusive-design",
      category: "inclusive-design",
      icon: "handHeart",
      heading:
        "How your module was created with accessibility and inclusion in mind",
      // Answer cards — each an OPTIONAL, unique info-box child (id stable +
      // unique, kebab-case `inclusive-design-<slug>`; that id is the permanent
      // handle the per-child show/hide criteria target — never reuse or rename
      // it). An `icon` is optional and renders in the shared gutter, in line with
      // the group's handHeart. Each card carries a `showWhen: "answer:<questionId>"`
      // rule (wired via the controller's ctx.shouldShow) so it appears only when
      // the author opts in; when every card's rule fails the whole part
      // self-collapses (heading included). Add further answers as more info-box
      // children here.
      children: [
        {
          // "An inclusive experience" — reassures students that the module has
          // been shaped by disability and inclusion expertise and continues to
          // improve. "Blackboard" -> {vle} and "module" -> {courseNoun} to match
          // the rest of the content library (both resolve to the Soton wording;
          // this group is Soton-layout-only). Shown only when the author answers
          // "Yes" to the matching inclusion question (see ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-inclusive-experience",
          showWhen: "answer:supporting-student-accessibility",
          category: "inclusive-design",
          icon: "peopleGroup",
          heading: "An inclusive experience",
          columns: [
            {
              blocks: [
                {
                  p: "We are working to make this {vle} {courseNoun} better for everyone. The module team has listened to what the student disability and inclusion experts suggested. This means we've updated this {vle} {courseNoun} to be more inclusive and are striving for further improvements.",
                },
              ],
            },
          ],
        },
        {
          // "Accessible content" — explains how the team checks and fixes new /
          // updated content, and flags the caveats. "module" -> {courseNoun} for
          // the course-sense word (resolves to "module" for Soton; this group is
          // Soton-layout-only); "module team" kept literal to match the rest of
          // the library. Shown only when the author answers "Yes" to the matching
          // inclusion question (see ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-accessible-content",
          showWhen: "answer:creating-accessible-content",
          category: "inclusive-design",
          icon: "universalAccess",
          heading: "Accessible content",
          columns: [
            {
              blocks: [
                {
                  p: "The module team makes new and updated content easier for everyone to use:",
                },
                {
                  ul: [
                    "we use accessibility tools to check if our new and updated content works well for all students",
                    "our team fixes problems these tools find",
                    "this means you should be able to use the content easily, whether you're using assistive technology or need it in a different format.",
                  ],
                },
                { p: "Be aware:" },
                {
                  ul: [
                    "some older content or items created elsewhere might still be tricky to access",
                    "you can find out more about how digitally accessible your {courseNoun} is later in this statement",
                  ],
                },
              ],
            },
          ],
        },
        {
          // "Organising module content" — a TWO-COLUMN info box (see the wireframe
          // in the buildout notes). A full-width `lead` intro spans both columns
          // (info-type extension), then the left column covers finding your way
          // around + signposting and the right column covers file naming. "module"
          // -> {courseNoun} and "Blackboard" -> {vle} (both resolve to the Soton
          // wording; this group is Soton-layout-only); "module team"/file names kept
          // literal. Sub-headings are {h4} blocks; under the h4 group they render at
          // h6 (card heading h5), all sub-headings of the card heading. Shown only
          // when the author answers "Yes" to the matching inclusion question (see
          // ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-organising-content",
          showWhen: "answer:content-curation",
          category: "inclusive-design",
          icon: "milestone",
          heading: "Organising module content",
          lead: [
            {
              p: "We've made your {vle} {courseNoun} clear and easy to follow. Here's how we help you stay organised:",
            },
          ],
          columns: [
            {
              blocks: [
                { h4: "Finding your way around" },
                {
                  p: "Everything we put on this {vle} {courseNoun} has a clear purpose. You'll always know:",
                },
                {
                  ul: [
                    "what it is",
                    "why it's useful for you",
                    "what you need to do with it",
                  ],
                },
                { h4: "Clear signposts" },
                { p: "We give you helpful hints like:" },
                {
                  p: "“Having trouble with this technique? Watch this extra video to help you understand”.",
                },
                {
                  p: "“Before your next class: Take a look at this problem and write down any questions you have”.",
                },
              ],
            },
            {
              blocks: [
                { h4: "Easy-to-find files" },
                {
                  p: "We name all files in a way that makes sense. This helps you:",
                },
                {
                  ul: [
                    "find things quickly",
                    "know what's inside each file",
                    "stay organised when revising",
                  ],
                },
                { h4: "Examples of file names" },
                { p: "Your files will look like this:" },
                {
                  ul: [
                    "Week 3 Lecture Notes - Electricity &amp; Electronics (Circuit Theory 3) - GENG1234.pptx",
                    "Week 5 - Media Effects Theory - FILM1234.pptx",
                    "Module Handbook 2025-26 - CHEM1234.docx",
                  ],
                },
              ],
            },
          ],
        },
        {
          // "Understanding your assessments" — what each assessment's section
          // contains, as an ORDERED list (the author enumerated four items).
          // "Blackboard" -> {vle} and "module" -> {courseNoun} (Soton-layout-only
          // group; both resolve to the Soton wording). Uses the {ol} info block
          // (added alongside {ul}). Shown only when the author answers "Yes" to the
          // matching inclusion question (see ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-understanding-assessments",
          showWhen: "answer:assessment-clarity",
          category: "inclusive-design",
          icon: "lightbulbGear",
          heading: "Understanding your assessments",
          columns: [
            {
              blocks: [
                {
                  p: "Within the assessments area of your {vle} {courseNoun}, each piece of work you will be asked to complete will have its own section. You'll find:",
                },
                {
                  ol: [
                    "whether it counts towards your {courseNoun} mark and, if so, how much it contributes to your {courseNoun} mark",
                    "clear instructions about what to do and when the assessment is due",
                    "an assignment rubric that sets out exactly what we're looking for in your work and how we will mark it",
                    "when and how you will get feedback on your work.",
                  ],
                },
              ],
            },
          ],
        },
        {
          // "Reading list: Your path, your pace" — points students at the online
          // reading list and explains the essential/additional labelling. "module"
          // -> {courseNoun} and "library" -> {library} (Soton-layout-only group;
          // both resolve to the Soton wording); "teaching team" kept literal. No
          // showWhen: shown only when the author answers "Yes" to the matching
          // inclusion question (see ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-reading-list",
          showWhen: "answer:online-reading-lists",
          category: "inclusive-design",
          icon: "books",
          heading: "Reading list: Your path, your pace",
          columns: [
            {
              blocks: [
                {
                  p: "This {courseNoun} has an online reading list. The {library}'s online reading list gives you easy and direct access to the books, journal articles and other resources connected to your {courseNoun}.",
                },
                {
                  p: "The teaching team has indicated the importance of each resource as either “essential” (core, must read resources) or “additional” (recommended and further reading).",
                },
              ],
            },
          ],
        },
        {
          // "A message from your module lead" — a PLACEHOLDER for a future dynamic
          // message that could include paragraphs, bullet points, numbered lists
          // and in-text links (all already supported by the info block types:
          // {p}/{ul}/{ol}, plus inline <a> in {p}). That per-module injection is
          // future work; for now a clearly-marked placeholder holds the spot,
          // reusing the shared .ally-sp-placeholder style (as the statement header
          // and what-this-tells-you fill-ins do). "module lead" -> {contentOwner}
          // (Soton-layout-only group; resolves to "module lead"). Shown only when
          // the author has written a non-empty free-text message (the
          // `additional-information` inclusion answer; see ALLY_INCLUSION_ANSWERS).
          type: "info",
          id: "inclusive-design-module-lead-message",
          showWhen: "answer:additional-information",
          category: "inclusive-design",
          icon: "personWaving",
          heading: "A message from your {contentOwner}",
          columns: [
            {
              blocks: [
                // The author's free-text message, resolved from the
                // {inclusionMessage} live token (real Markdown rendered to safe
                // block-level HTML by buildInclusionMessageHtml — headings,
                // numbered + bulleted lists, and bold; Stage D). A {html} block
                // (block-level <div>) is used, not {p}, because Markdown emits
                // block elements invalid inside a <p>. This card is answer-gated
                // (showWhen above), so it only renders when a non-empty message
                // exists — no placeholder is needed.
                { html: "{inclusionMessage}" },
              ],
            },
          ],
        },
      ],
    },
    {
      // Key Definitions — a glossary info box placed AFTER the issue block
      // (below the last warning card) via the Soton layout. Generic
      // accessibility definitions with no environment-varying wording, so no
      // tokens. Uses a {dl} definition-list block (term -> definition), the
      // correct semantics for a glossary; the term renders as a bold <dt> (via
      // CSS, no <strong> needed) and exports as "Term: definition". Renders at
      // h4 under the h3 statement title via the controller's heading-level
      // threading.
      type: "info",
      id: "key-definitions",
      // Section role: fixed institutional boilerplate, below the data section
      // (bottom boilerplate) — see markExportable → data-sp-category/region.
      category: "boilerplate",
      region: "bottom",
      heading: "Key Definitions",
      icon: "bookOpenText",
      columns: [
        {
          blocks: [
            {
              dl: [
                {
                  term: "Accessibility",
                  definition:
                    "Designing and building products, services, and environments for everyone regardless of impairment or disability or irrespective of their condition or context, i.e. low bandwidth, using a mobile device or large screen.",
                },
                {
                  term: "Alternative format",
                  definition:
                    "A different version of content designed for specific preferences and needs. An additional format could be presented as audio, braille, and HTML.",
                },
                {
                  term: "Assistive technology",
                  definition:
                    "Hardware or software that supports people in interacting with products, services, and environments. These can be either low, medium or high tech, for example, white cane, wheelchair, prosthetic device, and hearing loop.",
                },
                {
                  term: "Screen reader",
                  definition:
                    "A feature or device that reads content aloud, software such as JAWS, NVDA, Narrator and VoiceOver.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // Accessibility features in {vle} — an info box placed after Key
      // Definitions via the Soton layout. Blackboard-specific content (the links
      // are Blackboard help pages), so it lives only in the Soton layout;
      // "Blackboard" is tokenised to {vle} to match the rest of the content
      // library (resolves to "Blackboard" for soton-blackboard). A {ul} block
      // (unordered — these features have no inherent sequence), each item an
      // inline <a> link plus a short description (trusted innerHTML). Renders at
      // h4 under the h3 statement title via heading-level threading.
      type: "info",
      id: "blackboard-features",
      // Section role: fixed institutional boilerplate, below the data section
      // (bottom boilerplate) — see markExportable → data-sp-category/region.
      category: "boilerplate",
      region: "bottom",
      heading: "Accessibility features in {vle}",
      icon: "keyboardOutline",
      columns: [
        {
          blocks: [
            {
              ul: [
                '<a href="https://help.blackboard.com/Accessibility/Keyboard_Navigation">Keyboard navigation</a>: {vle} supports keyboard navigation and shortcuts.',
                '<a href="https://help.blackboard.com/Learn/Instructor/Original/Accessibility/Navigate_Blackboard_Learn_With_JAWS">Screen reader compatibility</a>: {vle} works with screen readers like NVDA and JAWS.',
                '<a href="https://help.blackboard.com/Ally/Ally_for_Websites/Instructor_Editor/Improve_Content_Accessibility/Add_Alt_Text_To_Webpage_Images">Image descriptions</a>: {vle} enables adding image descriptions to images.',
                '<a href="https://help.blackboard.com/Learn/Student/Ultra/Add_and_Format_Content/Work_with_Text">Content formatting</a>: {vle} supports structured content with heading styles, lists, and table styles.',
                '<a href="https://help.blackboard.com/Learn/Instructor/Ultra/Course_Content/Create_Content/Create_Course_Materials/Math_Editor">Math equation editor</a>: {vle} supports a feature that produces accessible equations.',
              ],
            },
          ],
        },
      ],
    },
    {
      // Accessibility tools in {vle} — an info box with a lazy YouTube video
      // beside the text (mediaLayout: true → text | video, collapsing to stacked
      // on the card's own width). Blackboard-specific, so Soton-layout-only and
      // "Blackboard" tokenised to {vle}. The video uses the self-hosted
      // lite-youtube ("light" embed): the poster shows until the user clicks, and
      // the play control is a real <a> that exports as a titled link. Renders at
      // h4 under the h3 statement title via heading-level threading.
      type: "info",
      id: "accessibility-tools-video",
      // Section role: fixed institutional boilerplate, below the data section
      // (bottom boilerplate) — see markExportable → data-sp-category/region.
      category: "boilerplate",
      region: "bottom",
      heading: "Accessibility tools in {vle}",
      icon: "playCircle",
      mediaLayout: true,
      columns: [
        {
          blocks: [
            {
              p: "Use {vle} to generate alternative formats of content to suit your preferences and needs.",
            },
          ],
        },
        {
          blocks: [
            {
              video: {
                youTubeId: "8Q-kmnyGHbU",
                title: "Accessibility tools in Blackboard",
                poster: "ally-scripts/assets/ally-thumbnail.png",
                href: "https://www.youtube.com/watch?v=8Q-kmnyGHbU",
              },
            },
          ],
        },
      ],
    },
    {
      // Support and Resources — a 2x2 grid of button-styled link cards. Each card
      // carries a decorative icon beside its heading (the wireframe layout). The
      // links stay real button-styled <a>s. Southampton-specific support pages,
      // so Soton-layout-only; "Blackboard" tokenised to {vle} in prose, and
      // "The university" kept literal (({institutionShort}) would lowercase the
      // sentence-opening "The").
      type: "linkButtons",
      id: "support-resources",
      // Section role: fixed institutional boilerplate, below the data section
      // (bottom boilerplate) — see markExportable → data-sp-category/region.
      category: "boilerplate",
      region: "bottom",
      heading: "Support and Resources",
      columns: 2,
      cards: [
        {
          heading: "My computer, my way",
          icon: "monitor",
          body: "Learn how to make your device easier to use through accessibility adjustments.",
          link: {
            text: 'Visit "My Computer, My Way"',
            href: "https://mcmw.abilitynet.org.uk/",
          },
        },
        {
          heading: "Assistive technology",
          icon: "wrench",
          body: "The university provides a range of assistive technology solutions to support your learning.",
          link: {
            text: "Explore available tools",
            href: "https://sotonac.sharepoint.com/teams/StudentDisabilityandInclusionTeamSupport/SitePages/Assistive-Technology.aspx",
          },
        },
        {
          heading: "Student disability and inclusion team",
          icon: "lifebuoy",
          body: 'We offer a variety of specialist support for disabled and neurodivergent students, students with a specific learning difference (such as dyslexia or slow cognitive processing), and students with physical, long-term and <a href="https://sotonac.sharepoint.com/teams/StudentDisabilityandInclusionTeamSupport">mental health conditions (such as anxiety or depression).</a>',
          link: {
            text: "Visit the Student Disability and Inclusion Team",
            href: "https://sotonac.sharepoint.com/teams/StudentDisabilityandInclusionTeamSupport",
          },
        },
        {
          heading: "Blackboard accessibility statement",
          icon: "fileText",
          body: "Read the accessibility statement for our {vle} Virtual Learning Environment.",
          link: {
            text: "Blackboard Accessibility Statement",
            href: "https://elearn.soton.ac.uk/knowledge-base/bb-accessibility",
          },
        },
      ],
    },
  ];

  // ========================================================================
  // Master-settings environments (institution / VLE wording profiles)
  // ========================================================================
  //
  // Each maps the content tokens ({vle}, {contentOwner}, {institution},
  // {institutionShort}, {library}, {courseNoun}) embedded in the theme / intro
  // / success / authored content to environment-appropriate wording. Token
  // values are chosen so the DEFAULT (soton-blackboard) profile reproduces the
  // original hand-written wording.

  // Each environment's `layout` is an ordered list of content ids controlling
  // WHICH sections appear and in WHAT order (Stage 2). Entries are either a
  // bare id string or an object `{ id, showWhen? }` (the object form is
  // forward-compatible with Stage 3 show-rules; `showWhen` is ignored until
  // then). The `@issues` sentinel marks where the accessibility-issue block
  // (warnings, or the success entry when none) injects, so authored sections
  // can sit before / between / after it. An environment with no `layout` falls
  // back to the legacy placement path (intro -> before-issues authored ->
  // @issues -> after-issues authored). The two real environments below carry an
  // explicit `["intro", "@issues"]`, which reproduces today's output verbatim
  // while making the layout model authoritative.
  const ENVIRONMENTS = {
    "soton-blackboard": {
      label: "University of Southampton (Blackboard)",
      tokens: {
        vle: "Blackboard",
        contentOwner: "module lead",
        institution: "the University of Southampton",
        institutionShort: "the university",
        library: "library",
        courseNoun: "module",
      },
      layout: [
        "statement-header",
        "what-this-tells-you",
        { id: "inclusive-design" },
        "intro",
        "@issues",
        { id: "key-definitions" },
        { id: "blackboard-features" },
        { id: "accessibility-tools-video" },
        { id: "support-resources" },
      ],
      // Id-keyed whole-sentence overrides (Stage 4). Keyed by content id
      // (e.g. "theme:broken-links", "intro", "success", or an authored id).
      // Each value is a PARTIAL object deep-merged over the base entry BEFORE
      // token substitution (resolution order: base -> override -> tokens);
      // listed fields replace the base field wholesale (arrays included), and
      // overrides may themselves contain {tokens}. The default (Soton) map is
      // empty: it reproduces the base wording through tokens alone.
      overrides: {},
    },
    // CPD Hub — DRAFT token values; correct the wording as needed. The {vle}
    // value carries its own determiner ("the CPD Hub"); source strings no
    // longer prepend "your"/"the" to {vle}, so no "your your"/"the the".
    "cpd-hub": {
      label: "CPD Hub",
      tokens: {
        vle: "the CPD Hub",
        contentOwner: "course team",
        institution: "the University of Southampton",
        institutionShort: "the university",
        library: "library",
        courseNoun: "course",
      },
      layout: ["intro", "@issues"],
      // DRAFT — no whole-sentence overrides yet; the author adds the handful of
      // sentences that genuinely differ from the Soton base here (keyed by
      // content id). See the Soton `overrides` comment for the shape.
      overrides: {},
    },
  };

  const DEFAULT_ENVIRONMENT = "soton-blackboard";

  // ========================================================================
  // Publish the content library on window (plain object literal — no fetch)
  // ========================================================================

  window.ALLY_SP_CONTENT = {
    version: "1.0.0",
    lastUpdated: "2026-07-05",
    entries: ENTRIES,
    authoredSections: AUTHORED_SECTIONS,
    environments: ENVIRONMENTS,
    defaultEnvironment: DEFAULT_ENVIRONMENT,
  };

  // Synchronous storage (a plain <script>), but publish a resolved readiness
  // promise so consumers can await it uniformly and enforce load order.
  window.ALLY_SP_CONTENT_READY = Promise.resolve(window.ALLY_SP_CONTENT);

  logInfo(
    "Content library published: " +
      Object.keys(ENTRIES).length +
      " entries, " +
      Object.keys(ENVIRONMENTS).length +
      " environments",
  );
})();
