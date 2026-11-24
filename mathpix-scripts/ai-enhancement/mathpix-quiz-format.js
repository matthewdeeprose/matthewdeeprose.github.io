/**
 * @fileoverview MathPix Quiz Format - the practice quiz's shape and checker
 * @module MathPixQuizFormat
 * @version 1.0.0
 * @since QZ-2 (22 November 2026)
 *
 * The quiz the MathPix AI lane holds beside the MMD is
 *   { version: 1, title, questions: [ ... ] }
 * where every question is in the SCORM library's OWN JSON shape for its type,
 * so a question passes straight to the library's `wrapQuestion`. This file
 * defines that, checks it, and turns it into the `data-quiz-question` blocks an
 * export appends. It has no UI, calls no model and reads no key.
 *
 * The checker has two halves. Our own rules are synchronous and pure. The
 * library's own verdict (its `processQuiz`, with every warning counted as an
 * error) needs the library's ES modules, which a classic script reaches with a
 * dynamic `import()`; so `checkQuiz` and `toQuizContent` are ASYNC. If the
 * library cannot be loaded, nothing is accepted (fail closed).
 *
 * QZ-3 (22 November 2026): loaded by tools.html, before mathpix-quiz-store.js
 * and session-restorer-scorm-export.js. Two first-layer rules were added so the
 * breakout guard no longer rests on the library failing to parse a block: every
 * level's keys are a closed set (an unknown key is an error, not a warning), and
 * no string outside the allow-listed HTML fields may contain "<".
 *
 * QZ-10 (23 November 2026): one pure helper, escapeAnglesInMaths, turns a bare
 * "<" or ">" inside maths into "&lt;" or "&gt;" (and back, for the editor). The
 * writer and the editor call it before the checker; no rule of the checker changed.
 *
 * @requires scorm-builder/enhancers/quiz.js - processQuiz (vendored, never edited)
 * @requires scorm-builder/render/quiz-from-json.js - wrapQuestion, quizContentFromQuestions
 *
 * @accessibility WCAG 2.2 AA: refuses maths in post-Check feedback (never
 * typeset), and HTML outside a small allow-list (model text lands unescaped).
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[QuizFormat] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[QuizFormat] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[QuizFormat] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[QuizFormat] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** The only quiz format version this file reads and writes. */
  const QUIZ_FORMAT_VERSION = 1;

  /**
   * Most questions one quiz may hold. Twenty keeps the check-and-edit window
   * readable, keeps a model's single reply short enough not to be cut off, and
   * keeps the "Question N" headings a manageable table of contents in the
   * exported page. A judgement, not a library limit (the library has none).
   */
  const MAX_QUESTIONS = 20;

  /** The four maths-safe question types allowed first (owner ruling, 22 Nov 2026). */
  const ALLOWED_TYPES = Object.freeze({
    MULTIPLE_CHOICE: "multiple-choice",
    TRUE_FALSE: "true-false",
    MULTIPLE_ANSWER: "multiple-answer",
    NUMERIC: "numeric",
  });

  /** Tags a model's HTML may use. No attributes on any of them. */
  const ALLOWED_TAGS = Object.freeze([
    "p", "br", "em", "strong", "code", "sub", "sup", "ul", "ol", "li",
  ]);
  const VOID_TAGS = Object.freeze(["br"]);
  /** Tags that cannot sit inside a legend or label (inline fields). */
  const BLOCK_TAGS = Object.freeze(["p", "ul", "ol", "li"]);

  /** Where a field is written: inline = inside a legend/label, block = a div. */
  const CONTEXT = Object.freeze({ INLINE: "inline", BLOCK: "block" });

  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  const MAX_ID_LENGTH = 40;
  // The same unwrap the library applies to a prompt or option (quiz.js inlineRich).
  const SINGLE_P_WRAPPER = /^\s*<p>([\s\S]*)<\/p>\s*$/i;
  // Maths markers: \( \) \[ \] , a dollar sign, or a backslash command.
  const MATHS_PATTERN = /\\[()[\]]|\$|\\[A-Za-z]+/;
  const TAG_FULL = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)\s*(\/?)>$/;
  const TAG_START = /[A-Za-z/!?]/;

  // QZ-3: every level of the quiz has a closed set of keys. A key outside its
  // set is REFUSED, not warned: a field the checker does not read is a field it
  // cannot vouch for, and the library writes every string into a <script>
  // block without escaping "<" (QZ-2 surprise 1).
  const ENVELOPE_KEYS = Object.freeze([
    "id", "type", "points", "prompt", "body", "feedback", "scoring", "shuffle", "media",
  ]);
  const QUIZ_KEYS = Object.freeze(["version", "title", "questions"]);
  const RICH_KEYS = Object.freeze(["html"]);
  const OPTION_KEYS = Object.freeze(["id", "content", "correct", "feedback", "feedbackWhenMissed", "score"]);
  const FEEDBACK_KEYS = Object.freeze(["byOutcome", "default", "showAnswerFeedback"]);
  const OUTCOME_KEYS = Object.freeze(["correct", "incorrect", "partiallyCorrect"]);
  const SCORING_KEYS = Object.freeze(["method", "penaliseIncorrect", "minScore"]);
  /** Body keys per type: the fields the checker below reads, and no others. */
  const BODY_KEYS = Object.freeze({
    "multiple-choice": Object.freeze(["options"]),
    "multiple-answer": Object.freeze(["options", "minSelections", "maxSelections"]),
    "true-false": Object.freeze(["correctAnswer", "trueLabel", "falseLabel"]),
    numeric: Object.freeze(["expected", "tolerance", "label", "unit", "inputMode"]),
  });
  /** Scoring methods the runtime knows, per type (runtime: per-option, else all-or-nothing). */
  const SCORING_METHODS = Object.freeze({
    "multiple-answer": Object.freeze(["per-option", "all-or-nothing"]),
    default: Object.freeze(["all-or-nothing"]),
  });

  /**
   * The only places a string may hold HTML: the `.html` of a rich field the
   * checker reads with htmlProblems. Every other string anywhere in the quiz
   * must be free of "<" (QZ-3, the first layer of the breakout guard).
   */
  const HTML_FIELD_PATHS = Object.freeze([
    /^questions\[\d+\]\.prompt\.html$/,
    /^questions\[\d+\]\.body\.options\[\d+\]\.(content|feedback|feedbackWhenMissed)\.html$/,
    /^questions\[\d+\]\.body\.(trueLabel|falseLabel)\.html$/,
    /^questions\[\d+\]\.feedback\.byOutcome\.(correct|incorrect|partiallyCorrect)\.html$/,
    /^questions\[\d+\]\.feedback\.default\.html$/,
  ]);

  const LIBRARY_PATHS = Object.freeze({
    quiz: "../../scorm-builder/enhancers/quiz.js",
    fromJson: "../../scorm-builder/render/quiz-from-json.js",
  });

  // The URL this classic script came from, so import() resolves against it in a
  // browser. In Node there is no document and the relative specifier is used.
  const SCRIPT_URL =
    typeof document !== "undefined" && document.currentScript
      ? document.currentScript.src
      : "";

  // ============================================================================
  // RESULT COLLECTOR
  // ============================================================================

  function newResult() {
    const errors = [];
    const warnings = [];
    return {
      errors,
      warnings,
      error(questionId, field, message) {
        errors.push({ questionId: questionId == null ? null : questionId, field, message });
      },
      warn(questionId, field, message) {
        warnings.push({ questionId: questionId == null ? null : questionId, field, message });
      },
    };
  }

  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

  // ============================================================================
  // HTML AND TEXT FIELDS
  // ============================================================================

  /** Visible text of an HTML string: tags removed, trimmed. */
  function visibleText(html) {
    return String(html).replace(/<[^>]*>/g, "").trim();
  }

  /** QZ-3b: every maths span, in the three delimiter forms the library typesets. */
  const MATHS_SPANS = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

  /**
   * QZ-3b: with maths and tags taken out, does a letter or digit remain?
   * A digit is readable ("6"); a label of maths alone is not.
   */
  function hasWordsOutsideMaths(html) {
    const text = String(html).replace(MATHS_SPANS, " ").replace(/<[^>]*>/g, " ");
    return /[\p{L}\p{N}]/u.test(text);
  }

  // QZ-10: an allow-listed tag written whole (no attributes), as htmlProblems reads one.
  const ALLOWED_TAG_INSIDE = new RegExp(`<\\/?(?:${ALLOWED_TAGS.join("|")})\\s*\\/?>`, "i");

  /**
   * QZ-10: make a less-than or greater-than sign inside maths safe to store.
   *
   * Inside each maths span (the MATHS_SPANS forms above, the ones tools.html and
   * the export's MathJax both typeset) a bare "<" becomes "&lt;" and a bare ">"
   * becomes "&gt;". Text outside maths, and every entity already written, is left
   * exactly as it is. A span that holds an allowed tag written whole is left alone
   * too: tags split the text MathJax reads, so it is not one equation, and the
   * checker judges it as it always has. Running it twice changes nothing more.
   *
   * With { reverse: true } it turns "&lt;" and "&gt;" inside maths back into the
   * characters a person types (the editor's view); a span skipped one way is
   * skipped the other.
   *
   * Pure: no DOM, never throws. A non-string comes back unchanged.
   * @param {string} html
   * @param {{ reverse?: boolean }} [options]
   * @returns {string}
   */
  function escapeAnglesInMaths(html, options) {
    if (typeof html !== "string") return html;
    const reverse = Boolean(options && options.reverse);
    return html.replace(MATHS_SPANS, (span) => {
      if (ALLOWED_TAG_INSIDE.test(span)) return span;
      return reverse
        ? span.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        : span.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    });
  }

  /**
   * Check one HTML string against the allow-list. Refuses, never repairs, and
   * names the offending tag. Returns an array of plain-English messages.
   */
  function htmlProblems(html, context) {
    const problems = [];
    let source = html;

    if (context === CONTEXT.INLINE) {
      // The library unwraps ONE wrapping <p>; anything else block-level inside a
      // legend or label would produce broken markup (measured, see report.md).
      const m = source.match(SINGLE_P_WRAPPER);
      if (m) source = m[1];
    }

    const stack = [];
    let i = source.indexOf("<");
    while (i !== -1) {
      const next = source.charAt(i + 1);
      if (!TAG_START.test(next)) {
        i = source.indexOf("<", i + 1);
        continue;
      }

      const close = source.indexOf(">", i);
      if (close === -1) {
        problems.push("contains an unfinished tag (a \"<\" with no \">\")");
        break;
      }

      const tag = source.slice(i, close + 1);
      const parsed = TAG_FULL.exec(tag);
      const shown = tag.length > 40 ? `${tag.slice(0, 40)}...` : tag;

      if (!parsed) {
        problems.push(
          `contains markup that is not allowed: ${shown} (tags may not carry attributes, and comments are not allowed)`
        );
      } else {
        const closing = parsed[1] === "/";
        const name = parsed[2].toLowerCase();
        const selfClose = parsed[3] === "/";

        if (!ALLOWED_TAGS.includes(name)) {
          problems.push(`uses the <${name}> tag, which is not allowed (allowed: ${ALLOWED_TAGS.join(", ")})`);
        } else if (context === CONTEXT.INLINE && BLOCK_TAGS.includes(name)) {
          problems.push(`uses the <${name}> tag, which cannot sit inside a question or option line (use a single paragraph, or plain inline text)`);
        } else if (VOID_TAGS.includes(name)) {
          if (closing) problems.push(`has a closing </${name}> tag, which is not allowed`);
        } else if (selfClose) {
          problems.push(`writes <${name}/> as self-closing, which is not allowed`);
        } else if (!closing) {
          stack.push(name);
        } else if (stack.pop() !== name) {
          problems.push(`has a closing </${name}> tag that does not match an opening one`);
        }
      }

      i = source.indexOf("<", close + 1);
    }

    if (stack.length) problems.push(`leaves <${stack[stack.length - 1]}> open`);
    return problems;
  }

  /**
   * Check a rich-text field shaped { html: "..." }.
   * @param {object} opts - { context, noMaths, required }
   */
  function checkRich(res, qid, field, value, opts) {
    if (value === undefined || value === null) {
      if (opts.required) res.error(qid, field, "is missing");
      return;
    }
    if (!isObject(value) || typeof value.html !== "string") {
      res.error(qid, field, 'must be an object of the form { "html": "..." }');
      return;
    }
    refuseUnknownKeys(res, qid, field, value, RICH_KEYS);
    const where = `${field}.html`;
    if (opts.required && !visibleText(value.html)) {
      res.error(qid, where, "is empty");
      return;
    }
    htmlProblems(value.html, opts.context).forEach((p) => res.error(qid, where, p));
    // QZ-3b: an answer label must carry words. A label of only maths has an
    // empty accessible name in the export (mjx-math is aria-hidden).
    if (opts.requireWords && !hasWordsOutsideMaths(value.html)) {
      res.error(
        qid,
        where,
        "is only maths, which a screen reader cannot name inside an answer; add the words, for example \\(\\tfrac12 CV^2\\) (half C V squared)"
      );
    }
    if (opts.noMaths && MATHS_PATTERN.test(value.html)) {
      res.error(
        qid,
        where,
        "contains maths. Feedback is shown after \"Check answer\" and is never typeset, so maths would appear as raw code. Say it in words, or move the maths into the question or option text"
      );
    }
  }

  /** Check a plain-text field: a string with no "<". */
  function checkPlain(res, qid, field, value, required) {
    if (value === undefined || value === null) {
      if (required) res.error(qid, field, "is missing");
      return;
    }
    if (typeof value !== "string") {
      res.error(qid, field, "must be text");
      return;
    }
    if (required && !value.trim()) res.error(qid, field, "is empty");
    if (value.indexOf("<") !== -1) res.error(qid, field, 'must be plain text (it contains a "<")');
  }

  /** QZ-3: a key outside the level's closed set is an error (it was a warning at QZ-2). */
  function refuseUnknownKeys(res, qid, field, obj, allowed) {
    Object.keys(obj).forEach((k) => {
      if (!allowed.includes(k)) {
        res.error(qid, `${field}${field ? "." : ""}${k}`, "is not a field this quiz format uses, so the quiz is refused");
      }
    });
  }

  /**
   * QZ-3, the breakout guard's first layer: walk EVERY string in the quiz,
   * whatever key holds it, and refuse a "<" anywhere outside the allow-listed
   * HTML fields (those are checked tag by tag by htmlProblems). This does not
   * depend on the key rule above: either one alone keeps a "</script>" out of
   * the library's unescaped block. Cycle-safe and never throws.
   */
  function refuseMarkupOutsideHtmlFields(res, quiz) {
    const seen = new WeakSet();
    const questionIdAt = (n) => {
      const q = Array.isArray(quiz.questions) ? quiz.questions[n] : null;
      return isObject(q) && typeof q.id === "string" && q.id ? q.id : `#${n + 1}`;
    };

    function visit(value, path) {
      if (typeof value === "string") {
        if (value.indexOf("<") === -1) return;
        if (HTML_FIELD_PATHS.some((re) => re.test(path))) return;
        const m = /^questions\[(\d+)\]\.?(.*)$/.exec(path);
        const qid = m ? questionIdAt(Number(m[1])) : null;
        const field = m ? m[2] : path;
        res.error(qid, field, 'contains a "<", which is allowed only in the question, option and feedback text');
        return;
      }
      if (value === null || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((v, i) => visit(v, `${path}[${i}]`));
      } else {
        Object.keys(value).forEach((k) => visit(value[k], path ? `${path}.${k}` : k));
      }
    }

    visit(quiz, "");
  }

  function checkScoring(res, qid, scoring, type) {
    if (scoring === undefined) return;
    if (!isObject(scoring)) {
      res.error(qid, "scoring", "must be an object");
      return;
    }
    refuseUnknownKeys(res, qid, "scoring", scoring, SCORING_KEYS);
    const methods = SCORING_METHODS[type] || SCORING_METHODS.default;
    if (scoring.method !== undefined && !methods.includes(scoring.method)) {
      res.error(qid, "scoring.method", `must be one of: ${methods.join(", ")}`);
    }
    if (scoring.penaliseIncorrect !== undefined && typeof scoring.penaliseIncorrect !== "boolean") {
      res.error(qid, "scoring.penaliseIncorrect", "must be true or false");
    }
    if (scoring.minScore !== undefined && !isFiniteNumber(scoring.minScore)) {
      res.error(qid, "scoring.minScore", "must be a number");
    }
  }

  // ============================================================================
  // OWN RULES
  // ============================================================================

  function checkFeedback(res, qid, feedback) {
    if (feedback === undefined || feedback === null) {
      res.warn(qid, "feedback", 'has no feedback, so "Check answer" will show nothing for this question');
      return;
    }
    if (!isObject(feedback)) {
      res.error(qid, "feedback", "must be an object");
      return;
    }
    refuseUnknownKeys(res, qid, "feedback", feedback, FEEDBACK_KEYS);
    if (feedback.showAnswerFeedback !== undefined && typeof feedback.showAnswerFeedback !== "boolean") {
      res.error(qid, "feedback.showAnswerFeedback", "must be true or false");
    }
    const outcomes = feedback.byOutcome;
    if (outcomes !== undefined && !isObject(outcomes)) {
      res.error(qid, "feedback.byOutcome", "must be an object");
    } else if (isObject(outcomes)) {
      refuseUnknownKeys(res, qid, "feedback.byOutcome", outcomes, OUTCOME_KEYS);
      Object.keys(outcomes)
        .filter((k) => OUTCOME_KEYS.includes(k))
        .forEach((k) =>
          checkRich(res, qid, `feedback.byOutcome.${k}`, outcomes[k], { context: CONTEXT.BLOCK, noMaths: true })
        );
    }
    checkRich(res, qid, "feedback.default", feedback.default, { context: CONTEXT.BLOCK, noMaths: true });

    const hasOutcome = isObject(outcomes) && outcomes.correct && outcomes.incorrect;
    if (!hasOutcome && !feedback.default) {
      res.warn(qid, "feedback", 'has no correct and incorrect messages, so "Check answer" may show nothing for this question');
    }
  }

  function checkChoiceOptions(res, qid, body, type) {
    const options = body.options;
    if (!Array.isArray(options) || options.length < 2) {
      res.error(qid, "body.options", "needs at least two options");
      return;
    }

    const seen = new Set();
    let correctCount = 0;
    options.forEach((opt, n) => {
      const f = `body.options[${n}]`;
      if (!isObject(opt)) {
        res.error(qid, f, "must be an object");
        return;
      }
      refuseUnknownKeys(res, qid, f, opt, OPTION_KEYS);
      if (opt.score !== undefined && !isFiniteNumber(opt.score)) {
        res.error(qid, `${f}.score`, "must be a number");
      }
      if (typeof opt.id !== "string" || !ID_PATTERN.test(opt.id)) {
        res.error(qid, `${f}.id`, "needs a short id of letters, numbers, hyphens or underscores");
      } else if (seen.has(opt.id)) {
        res.error(qid, `${f}.id`, `repeats the option id "${opt.id}"`);
      } else {
        seen.add(opt.id);
      }
      if (opt.correct !== undefined && typeof opt.correct !== "boolean") {
        res.error(qid, `${f}.correct`, "must be true or false");
      }
      if (opt.correct === true) correctCount += 1;
      checkRich(res, qid, `${f}.content`, opt.content, { context: CONTEXT.INLINE, required: true, requireWords: true });
      checkRich(res, qid, `${f}.feedback`, opt.feedback, { context: CONTEXT.BLOCK, noMaths: true });
      checkRich(res, qid, `${f}.feedbackWhenMissed`, opt.feedbackWhenMissed, { context: CONTEXT.BLOCK, noMaths: true });
    });

    if (correctCount === 0) {
      res.error(qid, "body.options", "has no option marked correct");
    } else if (type === ALLOWED_TYPES.MULTIPLE_CHOICE && correctCount > 1) {
      res.warn(qid, "body.options", `has ${correctCount} options marked correct; a multiple-choice question normally has one (use multiple-answer for several)`);
    }

    if (type === ALLOWED_TYPES.MULTIPLE_ANSWER) {
      ["minSelections", "maxSelections"].forEach((k) => {
        const v = body[k];
        if (v === undefined) return;
        if (!Number.isInteger(v) || v < 1 || v > options.length) {
          res.error(qid, `body.${k}`, `must be a whole number from 1 to ${options.length}`);
        }
      });
      if (Number.isInteger(body.minSelections) && Number.isInteger(body.maxSelections) && body.minSelections > body.maxSelections) {
        res.error(qid, "body.minSelections", "is larger than maxSelections");
      }
    }
  }

  function checkTrueFalse(res, qid, body) {
    if (typeof body.correctAnswer !== "boolean") {
      res.error(qid, "body.correctAnswer", "must be true or false");
    }
    ["trueLabel", "falseLabel"].forEach((k) =>
      checkRich(res, qid, `body.${k}`, body[k], { context: CONTEXT.INLINE, requireWords: true })
    );
  }

  function checkNumeric(res, qid, body) {
    if (!isFiniteNumber(body.expected)) {
      res.error(qid, "body.expected", "needs the expected answer as a finite number");
    }
    if (body.tolerance !== undefined && (!isFiniteNumber(body.tolerance) || body.tolerance < 0)) {
      res.error(qid, "body.tolerance", "must be a number that is zero or more");
    }
    checkPlain(res, qid, "body.label", body.label, false);
    checkPlain(res, qid, "body.unit", body.unit, false);
    checkPlain(res, qid, "body.inputMode", body.inputMode, false);
    if (typeof body.label !== "string" || !body.label.trim()) {
      res.warn(qid, "body.label", "has no label naming the unit, so the answer box is called just \"Answer\"");
    }
  }

  function checkQuestion(res, q, index, seenIds) {
    let qid = `#${index + 1}`;
    if (!isObject(q)) {
      res.error(qid, "", "must be an object");
      return;
    }

    if (typeof q.id !== "string" || !q.id) {
      res.error(qid, "id", "is missing");
    } else {
      qid = q.id;
      if (!ID_PATTERN.test(q.id) || q.id.length > MAX_ID_LENGTH) {
        res.error(qid, "id", `must be letters, numbers, hyphens or underscores, up to ${MAX_ID_LENGTH} characters, starting with a letter or number`);
      }
      if (seenIds.has(q.id)) res.error(qid, "id", `is used by more than one question ("${q.id}")`);
      seenIds.add(q.id);
    }

    const typeValues = Object.values(ALLOWED_TYPES);
    if (!typeValues.includes(q.type)) {
      res.error(qid, "type", `"${q.type}" is not a question type this quiz allows (allowed: ${typeValues.join(", ")})`);
    }

    checkRich(res, qid, "prompt", q.prompt, { context: CONTEXT.INLINE, required: true });

    if (q.points !== undefined && (!isFiniteNumber(q.points) || q.points < 0)) {
      res.error(qid, "points", "must be a number that is zero or more");
    }
    if (q.media !== undefined) {
      res.error(qid, "media", "is not supported yet: practice quiz questions cannot carry images");
    }
    refuseUnknownKeys(res, qid, "", q, ENVELOPE_KEYS);
    if (q.shuffle !== undefined && typeof q.shuffle !== "boolean") {
      res.error(qid, "shuffle", "must be true or false");
    }
    checkScoring(res, qid, q.scoring, q.type);

    if (isObject(q.body) && BODY_KEYS[q.type]) {
      refuseUnknownKeys(res, qid, "body", q.body, BODY_KEYS[q.type]);
    }

    if (!isObject(q.body)) {
      res.error(qid, "body", "is missing");
    } else if (q.type === ALLOWED_TYPES.MULTIPLE_CHOICE || q.type === ALLOWED_TYPES.MULTIPLE_ANSWER) {
      checkChoiceOptions(res, qid, q.body, q.type);
    } else if (q.type === ALLOWED_TYPES.TRUE_FALSE) {
      checkTrueFalse(res, qid, q.body);
    } else if (q.type === ALLOWED_TYPES.NUMERIC) {
      checkNumeric(res, qid, q.body);
    }

    checkFeedback(res, qid, q.feedback);
  }

  /**
   * Our own rules only: synchronous, pure, never throws.
   * @param {*} quiz
   * @returns {{ ok: boolean, errors: object[], warnings: object[] }}
   */
  function checkQuizRules(quiz) {
    const res = newResult();
    try {
      if (!isObject(quiz)) {
        res.error(null, "", "The quiz must be an object with a version, a title and questions");
      } else {
        if (quiz.version !== QUIZ_FORMAT_VERSION) {
          res.error(null, "version", `must be ${QUIZ_FORMAT_VERSION}`);
        }
        if (quiz.title === undefined || quiz.title === null || quiz.title === "") {
          res.warn(null, "title", "is missing");
        } else {
          checkPlain(res, null, "title", quiz.title, false);
        }
        refuseUnknownKeys(res, null, "", quiz, QUIZ_KEYS);

        if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
          res.error(null, "questions", "The quiz has no questions");
        } else if (quiz.questions.length > MAX_QUESTIONS) {
          res.error(null, "questions", `The quiz has ${quiz.questions.length} questions; the most allowed is ${MAX_QUESTIONS}`);
        } else {
          const seenIds = new Set();
          quiz.questions.forEach((q, n) => checkQuestion(res, q, n, seenIds));
        }

        // QZ-3: independent of every rule above, so neither alone carries the guard.
        refuseMarkupOutsideHtmlFields(res, quiz);
      }
    } catch (e) {
      logError("checkQuizRules threw", e);
      res.error(null, "", `The quiz could not be checked (${e && e.message})`);
    }
    return { ok: res.errors.length === 0, errors: res.errors, warnings: res.warnings };
  }

  // ============================================================================
  // THE LIBRARY'S OWN VERDICT
  // ============================================================================

  let injectedLibrary = null;
  let libraryPromise = null;

  function libraryUrl(relative) {
    return SCRIPT_URL ? new URL(relative, SCRIPT_URL).href : relative;
  }

  /**
   * Reach the vendored library's ES modules with a dynamic import() (a classic
   * script cannot use static import). `quiz.js` is imported directly because
   * the library's `index.js` does not re-export `processQuiz`.
   */
  function loadLibrary() {
    if (injectedLibrary) return Promise.resolve(injectedLibrary);
    if (!libraryPromise) {
      libraryPromise = Promise.all([
        import(libraryUrl(LIBRARY_PATHS.quiz)),
        import(libraryUrl(LIBRARY_PATHS.fromJson)),
      ])
        .then(([quizModule, fromJson]) => ({
          processQuiz: quizModule.processQuiz,
          wrapQuestion: fromJson.wrapQuestion,
          quizContentFromQuestions: fromJson.quizContentFromQuestions,
        }))
        .catch((e) => {
          libraryPromise = null;
          throw e;
        });
    }
    return libraryPromise;
  }

  /** Test hook: supply a library (or null to clear it). */
  function setLibrary(lib) {
    injectedLibrary = lib || null;
  }

  /** Pull the question id out of a library warning such as: skipped question "q1" - ... */
  function questionIdFromWarning(message) {
    const m = /question "([^"]*)"/.exec(message);
    return m ? m[1] : null;
  }

  /**
   * Run every question through the library's writer and `processQuiz`; every
   * library warning, and any shortfall in the rendered count, is an error.
   * Never throws; a library that cannot be loaded is reported as an error.
   */
  async function runLibraryCheck(quiz) {
    const res = newResult();
    let lib;
    try {
      lib = await loadLibrary();
    } catch (e) {
      logError("Could not load the SCORM library", e);
      res.error(null, "library", "The SCORM quiz library could not be loaded, so the quiz cannot be checked and is not accepted");
      return { errors: res.errors, count: 0 };
    }

    try {
      const blocks = quiz.questions.map((q) => lib.wrapQuestion(q)).join("\n");
      const out = lib.processQuiz(blocks, {
        onWarning: (message) => res.error(questionIdFromWarning(message), "library", message),
      });
      if (out.count !== quiz.questions.length) {
        res.error(null, "library", `The library rendered ${out.count} of ${quiz.questions.length} questions`);
      }
      return { errors: res.errors, count: out.count };
    } catch (e) {
      logError("Library check threw", e);
      res.error(null, "library", `The SCORM quiz library could not process the quiz (${e && e.message})`);
      return { errors: res.errors, count: 0 };
    }
  }

  // ============================================================================
  // PUBLIC: CHECK AND BLOCKS OUT
  // ============================================================================

  /**
   * Our rules, then the library's verdict. Async because of the library import.
   * @param {*} quiz
   * @returns {Promise<{ ok: boolean, errors: object[], warnings: object[] }>}
   */
  async function checkQuiz(quiz) {
    const own = checkQuizRules(quiz);
    if (!own.ok) return own;

    try {
      const lib = await runLibraryCheck(quiz);
      const errors = own.errors.concat(lib.errors);
      return { ok: errors.length === 0, errors, warnings: own.warnings };
    } catch (e) {
      logError("checkQuiz threw", e);
      return {
        ok: false,
        errors: [{ questionId: null, field: "", message: `The quiz could not be checked (${e && e.message})` }],
        warnings: own.warnings,
      };
    }
  }

  /**
   * The string of data-quiz-question blocks an export appends, built with the
   * library's own quizContentFromQuestions. A quiz checkQuiz refuses gives
   * content null and the errors.
   * @param {*} quiz
   * @returns {Promise<{ ok: boolean, content: (string|null), errors: object[], warnings: object[] }>}
   */
  async function toQuizContent(quiz) {
    const verdict = await checkQuiz(quiz);
    if (!verdict.ok) return { ok: false, content: null, errors: verdict.errors, warnings: verdict.warnings };

    try {
      const lib = await loadLibrary();
      return {
        ok: true,
        content: lib.quizContentFromQuestions(quiz.questions),
        errors: [],
        warnings: verdict.warnings,
      };
    } catch (e) {
      logError("toQuizContent threw", e);
      return {
        ok: false,
        content: null,
        errors: [{ questionId: null, field: "library", message: `The quiz blocks could not be built (${e && e.message})` }],
        warnings: verdict.warnings,
      };
    }
  }

  const api = Object.freeze({
    VERSION: QUIZ_FORMAT_VERSION,
    MAX_QUESTIONS,
    ALLOWED_TYPES,
    ALLOWED_TAGS,
    checkQuizRules,
    escapeAnglesInMaths,
    checkQuiz,
    toQuizContent,
    runLibraryCheck,
    setLibrary,
  });

  window.MathPixQuizFormat = api;
  logInfo("Quiz format module ready");
})();
