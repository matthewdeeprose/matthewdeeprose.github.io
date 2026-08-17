// Author-facing primitive: turn an array (or authored object) of quiz questions
// into the `content` HTML string that the rest of the pipeline consumes.
//
// A quiz author works in plain JSON — an array of question objects, or an object
// carrying a title/intro plus the questions and the SCORM reporting defaults —
// and this module renders it into the inline
// `<script type="application/json" data-quiz-question>` blocks that
// `enhancers/quiz.js` (`processQuiz`) picks up at build time. It is the missing
// half of the loop: `processQuiz` reads those blocks, this writes them.
//
// It is deliberately tiny and pure (string in, string out) so it runs unchanged
// in node and the browser, is unit-testable offline, and can be shared by the
// authoring page, the sample-quiz CLI, and a future WYSIWYG editor.

import { escapeXML } from "../util/escape-xml.js";

/**
 * Serialise one question object into the inline JSON block that `processQuiz`
 * consumes. Mirrors the `q()` helper the sample-quiz CLI used to carry inline —
 * pretty-printed so a downloaded/inspected block stays human-readable.
 *
 * @param {object} q - a schema-shaped question
 * @returns {string} the `<script type="application/json" data-quiz-question>` block
 */
export function wrapQuestion(q) {
  return `<script type="application/json" data-quiz-question>\n${JSON.stringify(q, null, 2)}\n</script>`;
}

/**
 * Build the document `content` HTML from a list of questions: an optional
 * escaped `<h1>` heading, an optional intro (trusted authored HTML, inserted
 * as-is like the rest of this pipeline), then every question wrapped and joined.
 *
 * @param {object[]} questions
 * @param {object} [options]
 * @param {string} [options.heading] - a plain-text `<h1>` (escaped)
 * @param {string} [options.intro]   - authored HTML placed under the heading
 * @returns {string}
 */
export function quizContentFromQuestions(questions, options = {}) {
  if (!Array.isArray(questions)) {
    throw new Error("quizContentFromQuestions: expected an array of questions");
  }
  const parts = [];
  if (options.heading) parts.push(`<h1>${escapeXML(String(options.heading))}</h1>`);
  if (options.intro) parts.push(String(options.intro));
  for (const q of questions) parts.push(wrapQuestion(q));
  return parts.join("\n");
}

/**
 * Normalise + validate author input into a quiz model. Accepts either a JSON
 * string or an already-parsed value, in two shapes:
 *   - a bare array of questions            → { questions }
 *   - an object with a `questions` array   → passes through, carrying its
 *     `title`, `intro`, `reportScore` and `masteryScore`.
 * Anything else throws a clear, author-facing error (never a bare TypeError),
 * so a malformed paste lands in the page's status line rather than a broken
 * preview.
 *
 * @param {string|object|Array} input
 * @returns {{ questions: object[], title?: string, intro?: string, reportScore?: boolean, masteryScore?: number }}
 */
export function parseQuizJson(input) {
  let value = input;
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) throw new Error("Quiz JSON is empty — paste or upload a questions array or object.");
    try {
      value = JSON.parse(text);
    } catch (e) {
      throw new Error(`Quiz JSON is not valid JSON: ${e.message}`);
    }
  }

  if (Array.isArray(value)) {
    return { questions: value };
  }

  if (value && typeof value === "object") {
    if (!Array.isArray(value.questions)) {
      throw new Error(
        'Quiz JSON object needs a "questions" array (or pass a bare array of questions).'
      );
    }
    const model = { questions: value.questions };
    if (typeof value.title === "string") model.title = value.title;
    if (typeof value.intro === "string") model.intro = value.intro;
    if (typeof value.reportScore === "boolean") model.reportScore = value.reportScore;
    if (typeof value.masteryScore === "number") model.masteryScore = value.masteryScore;
    return model;
  }

  throw new Error("Quiz JSON must be an array of questions or an object with a questions array.");
}
