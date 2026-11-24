/**
 * @fileoverview MathPix Quiz Editor - the in-place editor for ONE practice-quiz question
 * @module MathPixQuizEditor
 * @version 1.0.0
 * @since QZ-8 (23 November 2026)
 *
 * Builds the editor for a single question from DOM nodes (no innerHTML, every
 * string by textContent), reads it back into an edited COPY of the question,
 * and shows a refusal's reasons beside the fields they concern. It does not
 * touch the store, the checker or any announcement: the Quiz tab
 * (mathpix-quiz-tab.js) owns Save, Cancel, focus and the toasts.
 *
 * THE ROUND TRIP between a stored `html` string and what a box shows:
 *   - a field that is one or more whole <p>...</p> paragraphs shows the text
 *     inside them, a blank line between paragraphs;
 *   - anything else shows the stored string as it is;
 *   - the person's other tags (em, strong, code, sub, sup, br) stay as typed,
 *     and maths stays as typed \( \) source: the format allows nothing else;
 *   - QZ-10: inside maths a stored "&lt;" or "&gt;" shows as the "<" or ">" a
 *     person types, and an edited box stores them as entities again
 *     (MathPixQuizFormat.escapeAnglesInMaths, one paragraph at a time);
 *   - a box left as it opened writes back the ORIGINAL string untouched, so
 *     opening and saving a question with no change cannot alter one byte;
 *   - an edited box is written back as <p>...</p> per paragraph when the
 *     original was paragraphs, or as typed otherwise. Anything the format
 *     refuses (an img, a script, an unclosed tag) is refused by the checker,
 *     never repaired here.
 *
 * Not in this module: adding or removing options, changing a type, adding a question.
 *
 * @accessibility Every field is a native control with a visible label. A
 * reason is a plain paragraph tied to its control by aria-describedby and
 * stays until the next save; the summary lists every reason once.
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
      console.error(`[QuizEditor] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[QuizEditor] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[QuizEditor] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[QuizEditor] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const VERSION = "1.0.0";

  /** A string that is only whole paragraphs, none nested: <p>a</p><p>b</p>. */
  const PARAGRAPHS_ONLY = /^(?:<p>(?:(?!<\/?p>)[\s\S])*<\/p>)+$/;
  const PARAGRAPH_BODY = /<p>((?:(?!<\/?p>)[\s\S])*)<\/p>/g;
  const BLANK_LINE = /\r?\n[ \t]*\r?\n/;
  const PARAGRAPH_JOIN = "\n\n";

  const TYPE = Object.freeze({
    MULTIPLE_CHOICE: "multiple-choice",
    MULTIPLE_ANSWER: "multiple-answer",
    TRUE_FALSE: "true-false",
    NUMERIC: "numeric",
  });

  const TYPE_WORDS = Object.freeze({
    "multiple-choice": "multiple choice",
    "true-false": "true or false",
    "multiple-answer": "multiple answer",
    numeric: "numeric",
  });

  const OUTCOME_WORDS = Object.freeze({
    correct: "Feedback when correct",
    incorrect: "Feedback when incorrect",
    partiallyCorrect: "Feedback when partly correct",
  });

  const TEXTAREA_ROWS = 3;

  const HINT_TEXT =
    "Type the text as it should read. A blank line starts a new paragraph. " +
    "Maths stays as typed source between \\( and \\). These tags are allowed: " +
    "em, strong, code, sub, sup and br. A less-than or greater-than sign belongs " +
    "inside maths. Outside maths, a less-than sign followed by a letter is read " +
    "as the start of a tag, and the question is not saved.";

  // ============================================================================
  // HTML <-> TEXT
  // ============================================================================

  /**
   * QZ-10: the format's escapeAnglesInMaths, read at call time. Inside maths a
   * stored "&lt;" shows as "<" (reverse), and a typed "<" is stored as "&lt;".
   * Applied to one paragraph at a time, so a span never crosses a paragraph
   * join. If the format is not on the page the text passes through unchanged.
   */
  function anglesInMaths(text, reverse) {
    const format = window.MathPixQuizFormat;
    if (!format || typeof format.escapeAnglesInMaths !== "function") return text;
    return format.escapeAnglesInMaths(text, { reverse });
  }

  /** What a box shows for a stored html string. */
  function htmlToText(html) {
    if (typeof html !== "string") return "";
    if (!PARAGRAPHS_ONLY.test(html)) return anglesInMaths(html, true);
    const parts = [];
    html.replace(PARAGRAPH_BODY, (_all, inner) => {
      parts.push(anglesInMaths(inner, true));
      return "";
    });
    return parts.join(PARAGRAPH_JOIN);
  }

  /**
   * The html string a box's text becomes. Text unchanged from what the stored
   * string shows writes the stored string back untouched. Edited text has a
   * "<" or ">" inside maths stored as "&lt;" or "&gt;" (QZ-10).
   */
  function textToHtml(text, originalHtml) {
    if (typeof originalHtml === "string" && text === htmlToText(originalHtml)) return originalHtml;
    const asParagraphs = typeof originalHtml !== "string" || PARAGRAPHS_ONLY.test(originalHtml);
    if (!asParagraphs) return anglesInMaths(String(text), false);
    return String(text)
      .split(BLANK_LINE)
      .map((p) => p.trim())
      .filter((p) => p !== "")
      .map((p) => `<p>${anglesInMaths(p, false)}</p>`)
      .join("");
  }

  // ============================================================================
  // SMALL DOM HELPERS (textContent only)
  // ============================================================================

  function el(tag, props, text) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined) continue;
        if (k === "className") node.className = v;
        else node.setAttribute(k, v);
      }
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const letter = (i) => String.fromCharCode(65 + (i % 26));

  const getAt = (obj, path) => path.reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);

  /** The parent object of a path, created on the way when `make` is true. */
  function parentAt(obj, path, make) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i += 1) {
      if (cur[path[i]] === undefined || cur[path[i]] === null) {
        if (!make) return null;
        cur[path[i]] = {};
      }
      cur = cur[path[i]];
    }
    return cur;
  }

  // ============================================================================
  // BUILDING THE EDITOR
  // ============================================================================

  /**
   * Build the editor for one question.
   * @param {object} question - the stored question (never changed)
   * @param {number} index - zero-based position in the quiz
   * @param {number} total - how many questions the quiz holds
   * @returns {{ root: HTMLElement, collect: Function, showErrors: Function, firstControl: HTMLElement, buttons: object }}
   */
  function build(question, index, total) {
    const n = index + 1;
    const prefix = `quiz-edit-${n}`;
    const fields = []; // { key, label, kind, control(s), initial, apply }
    const wraps = new Map(); // key -> element the reason is placed after

    const root = el("section", { className: "quiz-question quiz-question-editing" });
    const headingId = `${prefix}-heading`;
    root.setAttribute("aria-labelledby", headingId);
    root.appendChild(el("h5", { id: headingId, tabindex: "-1" }, `Editing question ${n} of ${total}: ${TYPE_WORDS[question.type] || question.type}`));
    root.appendChild(el("p", { className: "field-hint", id: `${prefix}-hint` }, HINT_TEXT));

    const summary = el("div", { className: "quiz-edit-summary", id: `${prefix}-summary`, hidden: "" });
    const summaryHeading = el("h6", { id: `${prefix}-summary-heading`, tabindex: "-1" });
    const summaryList = el("ul");
    summary.appendChild(summaryHeading);
    summary.appendChild(summaryList);
    root.appendChild(summary);

    // ---- field makers -------------------------------------------------------

    function addTextarea(host, key, label, path, opts) {
      const id = `${prefix}-${key.replace(/[^A-Za-z0-9]+/g, "-")}`;
      const wrap = el("div", { className: "mathpix-context-field" });
      wrap.appendChild(el("label", { for: id }, label));
      const initialHtml = getAt(question, path.concat("html"));
      const initial = htmlToText(initialHtml);
      const box = el("textarea", { id, rows: String(TEXTAREA_ROWS), "data-quiz-field": key });
      box.value = initial;
      wrap.appendChild(box);
      host.appendChild(wrap);
      wraps.set(key, wrap);
      fields.push({
        key,
        label,
        control: box,
        initial,
        removable: Boolean(opts && opts.removable),
        apply(copy) {
          if (box.value === initial) return;
          const parent = parentAt(copy, path, true);
          const leaf = path[path.length - 1];
          if (this.removable && box.value.trim() === "") {
            delete parent[leaf];
            return;
          }
          const obj = parent[leaf] && typeof parent[leaf] === "object" ? parent[leaf] : (parent[leaf] = {});
          obj.html = textToHtml(box.value, typeof obj.html === "string" ? obj.html : undefined);
        },
      });
    }

    function addPlain(host, key, label, path, opts) {
      const id = `${prefix}-${key.replace(/[^A-Za-z0-9]+/g, "-")}`;
      const wrap = el("div", { className: "mathpix-context-field" });
      wrap.appendChild(el("label", { for: id }, label));
      const stored = getAt(question, path);
      const initial = stored === undefined || stored === null ? "" : String(stored);
      const box = el("input", { type: "text", id, "data-quiz-field": key });
      if (opts && opts.numeric) box.setAttribute("inputmode", "decimal");
      box.value = initial;
      wrap.appendChild(box);
      host.appendChild(wrap);
      wraps.set(key, wrap);
      fields.push({
        key,
        label,
        control: box,
        initial,
        problem() {
          if (!opts || !opts.numeric || box.value === initial) return null;
          const t = box.value.trim();
          if (t === "" && opts.optional) return null;
          return t !== "" && Number.isFinite(Number(t)) ? null : "must be a number";
        },
        apply(copy) {
          if (box.value === initial) return;
          const parent = parentAt(copy, path, true);
          const leaf = path[path.length - 1];
          const t = box.value.trim();
          if (t === "" && opts && opts.optional) delete parent[leaf];
          else parent[leaf] = opts && opts.numeric ? Number(t) : box.value;
        },
      });
    }

    /** A group of radios or ticks: one item each, with its own state to write back. */
    function addChoiceGroup(host, key, legendText, kind, items, apply) {
      const group = el("fieldset", { className: "quiz-edit-group", id: `${prefix}-${key}`, "data-quiz-field": key });
      group.appendChild(el("legend", null, legendText));
      const controls = items.map((item, i) => {
        const id = `${prefix}-${key}-${i}`;
        const wrap = el("div", { className: "mathpix-context-field" });
        const box = el("input", { type: kind, id, name: `${prefix}-${key}` });
        box.checked = item.checked;
        wrap.appendChild(box);
        wrap.appendChild(el("label", { for: id }, item.label));
        group.appendChild(wrap);
        return box;
      });
      host.appendChild(group);
      wraps.set(key, group);
      const initial = controls.map((c) => c.checked);
      fields.push({
        key,
        label: legendText,
        control: group,
        controls,
        initial,
        apply(copy) {
          if (controls.every((c, i) => c.checked === initial[i])) return;
          apply(copy, controls.map((c) => c.checked));
        },
      });
    }

    // ---- the question text, then the body by type -----------------------------

    addTextarea(root, "prompt", "Question text", ["prompt"]);

    const body = question.body || {};
    if (question.type === TYPE.MULTIPLE_CHOICE || question.type === TYPE.MULTIPLE_ANSWER) {
      const multi = question.type === TYPE.MULTIPLE_ANSWER;
      const options = Array.isArray(body.options) ? body.options : [];
      addChoiceGroup(
        root,
        "body.options",
        multi ? "Correct options (tick every right answer)" : "Correct option",
        multi ? "checkbox" : "radio",
        options.map((o, i) => ({ label: `Option ${letter(i)} is correct`, checked: o && o.correct === true })),
        (copy, states) => {
          copy.body.options.forEach((o, i) => {
            if (states[i]) o.correct = true;
            else if (o.correct === true) delete o.correct;
          });
        },
      );
      options.forEach((o, i) => {
        const set = el("fieldset", { className: "quiz-edit-group" });
        set.appendChild(el("legend", null, `Option ${letter(i)}`));
        const base = ["body", "options", i];
        addTextarea(set, `body.options[${i}].content`, `Text of option ${letter(i)}`, base.concat("content"));
        if (o && o.feedback) {
          addTextarea(set, `body.options[${i}].feedback`, `Feedback for option ${letter(i)}`, base.concat("feedback"), { removable: true });
        }
        if (o && o.feedbackWhenMissed) {
          addTextarea(set, `body.options[${i}].feedbackWhenMissed`, `Feedback if option ${letter(i)} is missed`, base.concat("feedbackWhenMissed"), { removable: true });
        }
        root.appendChild(set);
      });
    } else if (question.type === TYPE.TRUE_FALSE) {
      addChoiceGroup(
        root,
        "body.correctAnswer",
        "Correct answer",
        "radio",
        [
          { label: "True", checked: body.correctAnswer === true },
          { label: "False", checked: body.correctAnswer === false },
        ],
        (copy, states) => {
          copy.body.correctAnswer = states[0] === true;
        },
      );
      if (body.trueLabel) addTextarea(root, "body.trueLabel", "Label for True", ["body", "trueLabel"], { removable: true });
      if (body.falseLabel) addTextarea(root, "body.falseLabel", "Label for False", ["body", "falseLabel"], { removable: true });
    } else if (question.type === TYPE.NUMERIC) {
      addPlain(root, "body.expected", "Expected answer (a number)", ["body", "expected"], { numeric: true });
      addPlain(root, "body.tolerance", "Tolerance (a number, zero or more)", ["body", "tolerance"], { numeric: true, optional: true });
      addPlain(root, "body.unit", "Unit", ["body", "unit"], { optional: true });
      addPlain(root, "body.label", "Answer box label", ["body", "label"], { optional: true });
    }

    // ---- the feedback the question already has ---------------------------------

    const feedback = question.feedback || {};
    const byOutcome = feedback.byOutcome || {};
    Object.keys(OUTCOME_WORDS).forEach((k) => {
      if (byOutcome[k]) addTextarea(root, `feedback.byOutcome.${k}`, OUTCOME_WORDS[k], ["feedback", "byOutcome", k], { removable: true });
    });
    if (feedback.default) addTextarea(root, "feedback.default", "Feedback", ["feedback", "default"], { removable: true });

    // ---- the buttons (their behaviour is the tab's) -----------------------------

    const actions = el("div", { className: "quiz-question-actions" });
    const save = el("button", { type: "button", id: `${prefix}-save`, "data-quiz-action": "save", "data-quiz-index": String(index) }, `Save question ${n}`);
    const cancel = el("button", { type: "button", id: `${prefix}-cancel`, "data-quiz-action": "cancel", "data-quiz-index": String(index) }, `Cancel editing question ${n}`);
    actions.appendChild(save);
    actions.appendChild(cancel);
    root.appendChild(actions);

    // ---- reading it back -----------------------------------------------------

    /**
     * Apply every changed box to a copy of the question.
     * @returns {{ question: object, problems: object[] }} problems are {field, message}
     */
    function collect() {
      const copy = JSON.parse(JSON.stringify(question));
      const problems = [];
      fields.forEach((f) => {
        const message = typeof f.problem === "function" ? f.problem() : null;
        if (message) problems.push({ questionId: question.id, field: f.key, message });
      });
      if (problems.length === 0) fields.forEach((f) => f.apply(copy));
      return { question: copy, problems };
    }

    // ---- showing reasons -------------------------------------------------------

    function clearErrors() {
      root.querySelectorAll(".quiz-edit-error").forEach((p) => p.remove());
      fields.forEach((f) => {
        const target = f.control;
        target.removeAttribute("aria-invalid");
        const base = target.getAttribute("data-describedby-base");
        if (base === null) return;
        if (base === "") target.removeAttribute("aria-describedby");
        else target.setAttribute("aria-describedby", base);
        target.removeAttribute("data-describedby-base");
      });
      summaryList.textContent = "";
      summary.hidden = true;
    }

    function fieldFor(rawField) {
      const key = String(rawField || "").replace(/\.html$/, "");
      return fields.find((f) => f.key === key) || null;
    }

    /**
     * Show every reason once, beside the field it concerns where it names one,
     * and in a summary at the top. Returns the control focus should go to.
     */
    function showErrors(errors) {
      clearErrors();
      const seen = new Set();
      const list = [];
      (errors || []).forEach((e) => {
        const text = e && e.message ? String(e.message) : String(e);
        const f = e && e.field ? fieldFor(e.field) : null;
        const sameQuestion = !e || e.questionId === null || e.questionId === undefined || e.questionId === question.id;
        const attach = f && sameQuestion ? f : null;
        const lead = attach ? attach.label : e && e.field && sameQuestion ? e.field : "";
        const owner = !sameQuestion ? `Question ${e.questionId}: ` : "";
        const full = /^[A-Z]/.test(text) && !attach ? `${owner}${text}` : `${owner}${lead ? `${lead} ` : ""}${text}`;
        const dedupe = `${attach ? attach.key : ""}|${full}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        list.push({ attach, text, full });
      });

      let first = null;
      list.forEach((item, i) => {
        summaryList.appendChild(el("li", null, item.full));
        if (!item.attach) return;
        const f = item.attach;
        const host = wraps.get(f.key);
        const id = `${prefix}-error-${i}`;
        const p = el("p", { className: "field-hint quiz-edit-error", id }, `${f.label} ${item.text}`);
        host.appendChild(p);
        const control = f.control;
        if (control.getAttribute("data-describedby-base") === null) {
          control.setAttribute("data-describedby-base", control.getAttribute("aria-describedby") || "");
        }
        const existing = control.getAttribute("aria-describedby");
        control.setAttribute("aria-describedby", existing ? `${existing} ${id}` : id);
        control.setAttribute("aria-invalid", "true");
        const focusTarget = f.controls ? f.controls[0] : control;
        if (!first) first = focusTarget;
      });

      summaryHeading.textContent =
        list.length === 1
          ? `Question ${n} was not saved: 1 reason`
          : `Question ${n} was not saved: ${list.length} reasons`;
      summary.hidden = list.length === 0;
      return first || (list.length ? summaryHeading : null);
    }

    return {
      root,
      collect,
      showErrors,
      clearErrors,
      firstControl: fields.length ? fields[0].control : root,
      buttons: { save, cancel },
      heading: root.querySelector("h5"),
      summaryHeading,
    };
  }

  window.MathPixQuizEditor = Object.freeze({
    VERSION,
    build,
    htmlToText,
    textToHtml,
  });
  logInfo("Quiz editor module ready");
})();
