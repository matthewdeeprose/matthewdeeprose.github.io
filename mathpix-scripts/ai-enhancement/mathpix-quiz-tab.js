/**
 * @fileoverview MathPix Quiz Tab - ask for a practice quiz, watch it being written, read the result
 * @module MathPixQuizTab
 * @version 1.0.0
 * @since QZ-7 (22 November 2026)
 *
 * The Resume-mode "Quiz" tab (#resume-panel-quiz in tools.html, before the AI
 * tab). Part 3a of the AI quiz: a form (question types, difficulty, number of
 * questions, an estimated cost range), a write button that calls
 * MathPixQuizWriter.generate once, and a read-only view of the quiz the store
 * then holds. QZ-8 (23 November 2026) adds Edit and Delete for one question
 * (the editor itself is mathpix-quiz-editor.js). QZ-10 (23 November 2026): a
 * repeat refused save names its attempt so it is announced every time, and a
 * later successful save or write takes down the earlier refusal toasts.
 *
 * NOTHING SENDS UNTIL THE PERSON PRESSES WRITE. Every figure shown is an
 * estimate. The transport is a module-level seam (setTransport): the default
 * is the writer's own, and a test supplies its own so no row reaches a network.
 *
 * AI-SUPPLIED HTML never reaches innerHTML. It is parsed in an inert document
 * (DOMParser) and only an allow-list of tags is copied into the page, with no
 * attributes; every other string is written with textContent. The view is built
 * from DOM nodes, not a markdown-it render, so there is no LaTeX to protect:
 * the \( \) text survives as text and MathJax typesets it once the panel has a
 * layout box.
 *
 * @requires window.MathPixQuizWriter, window.MathPixQuizStore, window.MathPixQuizFormat
 * @accessibility No live region in the panel. The three events (writing
 * started, written, refused) and the delete speak through notify*(), which
 * announce through the shared announcer (AGENTS.md § Announcements, question 1).
 * After a safeConfirm every spoken line waits past the modal close and the
 * focus restore. Focus never moves when a quiz arrives.
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
      console.error(`[QuizTab] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[QuizTab] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[QuizTab] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[QuizTab] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const VERSION = "1.0.0";

  const IDS = Object.freeze({
    tab: "resume-tab-quiz",
    panel: "resume-panel-quiz",
    form: "resume-quiz-form",
    providerName: "resume-quiz-provider-name",
    state: "resume-quiz-state",
    typesFieldset: "resume-quiz-types",
    typesError: "resume-quiz-types-error",
    count: "resume-quiz-count",
    countHint: "resume-quiz-count-hint",
    estimate: "resume-quiz-estimate",
    write: "resume-quiz-write",
    writeLabel: "resume-quiz-write-label",
    writeHint: "resume-quiz-write-hint",
    progress: "resume-quiz-progress",
    refusal: "resume-quiz-refusal",
    refusalList: "resume-quiz-refusal-list",
    result: "resume-quiz-result",
    resultHeading: "resume-quiz-result-heading",
    resultBody: "resume-quiz-result-body",
    delete: "resume-quiz-delete",
    editNote: "resume-quiz-edit-note",
    lastNote: "resume-quiz-last-question-note",
  });

  const TYPE_WORDS = Object.freeze({
    "multiple-choice": "multiple choice",
    "true-false": "true or false",
    "multiple-answer": "multiple answer",
    numeric: "numeric",
  });

  const DIFFICULTY_NAME = "resume-quiz-difficulty";
  const DEFAULT_COUNT = 6;

  /**
   * How long to wait after a safeConfirm resolves before anything is spoken or
   * sent: the modal closes about 200 ms after its promise resolves, and the
   * focus restore follows. The same figure and reason as
   * MODAL_CLOSE_ANNOUNCE_DELAY_MS in setup-tool/setup-tool.js.
   */
  const MODAL_CLOSE_DELAY_MS = 350;

  /** Tags copied from AI HTML into the page when the format module does not name them. */
  const FALLBACK_TAGS = Object.freeze([
    "p", "br", "em", "strong", "code", "sub", "sup", "ul", "ol", "li",
  ]);
  const VOID_TAGS = Object.freeze(["br"]);
  /** Elements whose content is dropped, not unwrapped. */
  const DROP_TAGS = Object.freeze([
    "script", "style", "template", "noscript", "iframe", "object", "embed", "title",
  ]);

  const WRITE_LABEL = Object.freeze({
    FIRST: "Write practice quiz",
    REPLACE: "Write a new practice quiz",
  });

  const MESSAGES = Object.freeze({
    noSession: "Open a session first: the practice quiz is written from the open session's text.",
    noKey: "No AI provider key is set.",
    noPrice: "No price is known for the model chosen for the quiz, so its cost cannot be shown.",
    noText: "The open session has no text to write a quiz from.",
    notReady: "The quiz tools have not finished loading.",
    noTypes: "Choose at least one question type.",
    started: "Writing the quiz. This usually takes about a minute.",
    deleted: "Practice quiz deleted.",
    refused: "The practice quiz was not written. The reasons are listed in the Quiz tab.",
    replaceTitle: "Write a new practice quiz?",
    replaceConfirm: "Write a new quiz",
    replaceCancel: "Keep the current quiz",
    deleteTitle: "Delete the practice quiz?",
    deleteConfirm: "Delete quiz",
    deleteCancel: "Keep quiz",
    // QZ-8: one question at a time
    lastQuestion: "A quiz needs at least one question. To remove them all, use Delete practice quiz.",
    deleteQuestionConfirm: "Delete question",
    deleteQuestionCancel: "Keep question",
    saved: (n) => `Question ${n} saved.`,
    // QZ-10: a repeat refusal in the same open editor names its attempt, so the
    // toast's 2-second and the announcer's 5-second repeat suppressors (both
    // shared files, both keyed on identical text) cannot swallow it.
    saveRefused: (n, attempt) =>
      attempt > 1
        ? `Question ${n} was not saved (attempt ${attempt}). The reasons are listed in the editor.`
        : `Question ${n} was not saved. The reasons are listed in the editor.`,
    questionDeleted: (n) => `Question ${n} deleted.`,
    deleteRefused: (n, why) => `Question ${n} was not deleted.${why ? ` ${why}` : ""}`,
  });

  /** Elements that show no bar when they have no text (an empty hint draws an empty strip). */
  const HIDE_WHEN_EMPTY = Object.freeze([IDS.state, IDS.writeHint]);

  // ============================================================================
  // STATE
  // ============================================================================

  /** A press is in flight (the confirm, the send and the result). A second press does nothing. */
  let running = false;

  /** The transport the next press sends through. Null means the writer's own. */
  let transport = null;

  /** A quiz was drawn while the panel had no layout box; typeset it when it has one. */
  let typesetPending = false;

  let panelObserver = null;
  let initialised = false;

  /** The question open in the editor: { index, handle }, or null. One at a time. */
  let editing = null;

  /** A save is in flight (its check is async). A second press does nothing. */
  let saving = false;

  /** QZ-10: refused saves since the open editor was opened (names a repeat). */
  let saveRefusals = 0;

  /** QZ-10: ids of the "was not saved" and "was not written" toasts still up. */
  let refusalToasts = [];

  const byId = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function setText(el, text) {
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    if (HIDE_WHEN_EMPTY.includes(el.id)) el.hidden = text === "";
  }

  // ============================================================================
  // READING THE WORLD AT CALL TIME (never captured)
  // ============================================================================

  function writer() {
    return window.MathPixQuizWriter || null;
  }

  function store() {
    return window.MathPixQuizStore || null;
  }

  function activeProviderId() {
    const switcher = window.ProviderSwitcher;
    return switcher && typeof switcher.getActive === "function"
      ? switcher.getActive()
      : "openrouter";
  }

  function providerLabel(providerId) {
    const switcher = window.ProviderSwitcher;
    const known =
      switcher && typeof switcher.getKnown === "function" ? switcher.getKnown() : [];
    const found = Array.isArray(known) ? known.find((p) => p && p.id === providerId) : null;
    return found && found.label ? found.label : providerId;
  }

  function hasProviderKey() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.isAvailable !== "function") return false;
    return switcher.isAvailable(activeProviderId()) === true;
  }

  function hasSession() {
    const getRestorer = window.getMathPixSessionRestorer;
    const restorer = typeof getRestorer === "function" ? getRestorer() : null;
    return Boolean(restorer && restorer.restoredSession);
  }

  function recommendedModelId() {
    const registry = window.MathPixModelRegistry;
    if (!registry || typeof registry.recommendedModel !== "function") return null;
    const entry = registry.recommendedModel(writer() ? writer().PURPOSE : "practice-quiz", activeProviderId());
    return entry && typeof entry.modelId === "string" ? entry.modelId : null;
  }

  function maxQuestions() {
    const format = window.MathPixQuizFormat;
    return format && Number.isInteger(format.MAX_QUESTIONS) ? format.MAX_QUESTIONS : 20;
  }

  function minQuestions() {
    const w = writer();
    return w && Number.isInteger(w.MIN_QUESTIONS) ? w.MIN_QUESTIONS : 3;
  }

  function quizNoun(n) {
    return n === 1 ? "1 question" : `${n} questions`;
  }

  // ============================================================================
  // THE FORM
  // ============================================================================

  /** The person's three choices, as the writer wants them. */
  function readOptions() {
    const panel = byId(IDS.panel);
    const types = panel
      ? [...panel.querySelectorAll("input[data-quiz-type]")]
          .filter((box) => box.checked)
          .map((box) => box.dataset.quizType)
      : [];
    const picked = panel ? panel.querySelector(`input[name="${DIFFICULTY_NAME}"]:checked`) : null;
    const countInput = byId(IDS.count);
    const raw = countInput ? countInput.value.trim() : "";
    const count = /^\d+$/.test(raw) ? Number(raw) : NaN;
    return { types, difficulty: picked ? picked.value : null, count };
  }

  function dollars(n) {
    return `$${n.toFixed(2)}`;
  }

  /** "about $0.18 to $0.29", or null when no price is known. */
  function estimateRange(request) {
    const est = request && request.ok ? request.estimate : null;
    if (!est || typeof est.lowUsd !== "number" || typeof est.highUsd !== "number") return null;
    return `about ${dollars(est.lowUsd)} to ${dollars(est.highUsd)}`;
  }

  /**
   * Why the button cannot run, or null when it can. Also returns the request
   * (for the estimate). The key is asked first, as the AI tab does.
   */
  function assess() {
    const w = writer();
    const options = readOptions();
    const result = { reason: null, request: null, options };

    if (!w || !store() || !window.MathPixQuizFormat) {
      result.reason = MESSAGES.notReady;
      return result;
    }
    if (!hasProviderKey()) {
      result.reason = MESSAGES.noKey;
      return result;
    }
    if (!hasSession()) {
      result.reason = MESSAGES.noSession;
      return result;
    }
    if (options.types.length === 0) {
      result.reason = MESSAGES.noTypes;
      return result;
    }
    if (!Number.isInteger(options.count) || options.count < minQuestions() || options.count > maxQuestions()) {
      result.reason = `Choose a number of questions from ${minQuestions()} to ${maxQuestions()}.`;
      return result;
    }

    const request = w.buildRequest(options);
    result.request = request;
    if (!request.ok) {
      const first = request.errors && request.errors[0] ? request.errors[0].message : MESSAGES.notReady;
      result.reason = /no document content/i.test(first) ? MESSAGES.noText : `${first}.`;
      return result;
    }
    if (!estimateRange(request)) result.reason = MESSAGES.noPrice;
    return result;
  }

  /** Write only if changed: the whole form reflects the live state. */
  function refresh() {
    const panel = byId(IDS.panel);
    if (!panel) return;

    const w = writer();
    if (w && typeof w.loadPrompts === "function" && !refresh.promptsAsked) {
      refresh.promptsAsked = true;
      Promise.resolve(w.loadPrompts()).then(() => refresh());
    }

    const assessed = assess();
    const options = assessed.options;
    const provider = activeProviderId();
    const model = recommendedModelId();
    setText(byId(IDS.providerName), model ? `${providerLabel(provider)}, ${model}` : providerLabel(provider));

    // The standing state line: what is missing, in words.
    const stateReasons = [MESSAGES.noKey, MESSAGES.noSession, MESSAGES.noText];
    setText(byId(IDS.state), stateReasons.includes(assessed.reason) ? assessed.reason : "");

    // Question types: a plain inline error tied to the fieldset by aria-describedby.
    const typesError = byId(IDS.typesError);
    const noTypes = options.types.length === 0;
    if (typesError) {
      setText(typesError, noTypes ? MESSAGES.noTypes : "");
      typesError.hidden = !noTypes;
    }
    const fieldset = byId(IDS.typesFieldset);
    if (fieldset) fieldset.setAttribute("aria-invalid", noTypes ? "true" : "false");

    setText(byId(IDS.countHint), `From ${minQuestions()} to ${maxQuestions()}.`);
    const countInput = byId(IDS.count);
    if (countInput) {
      countInput.min = String(minQuestions());
      countInput.max = String(maxQuestions());
    }

    // The estimate: a range, labelled an estimate, in a plain element.
    const range = estimateRange(assessed.request);
    setText(
      byId(IDS.estimate),
      range ? `Estimated cost: ${range}.` : "Estimated cost: not available yet.",
    );

    // The write button and why it cannot run.
    const hasQuiz = Boolean(store() && store().count() > 0);
    setText(byId(IDS.writeLabel), hasQuiz ? WRITE_LABEL.REPLACE : WRITE_LABEL.FIRST);
    const write = byId(IDS.write);
    if (write) {
      const blocked = Boolean(assessed.reason) || running;
      write.setAttribute("aria-disabled", blocked ? "true" : "false");
      if (running) write.setAttribute("aria-busy", "true");
      else write.removeAttribute("aria-busy");
    }
    setText(byId(IDS.writeHint), running ? "" : assessed.reason || "");

    renderResult();
  }

  // ============================================================================
  // THE RESULT (read-only; nothing reaches innerHTML)
  // ============================================================================

  function allowedTags() {
    const format = window.MathPixQuizFormat;
    return format && Array.isArray(format.ALLOWED_TAGS) ? format.ALLOWED_TAGS : FALLBACK_TAGS;
  }

  /**
   * Copy AI HTML into `dest` through an inert document: allow-listed tags only,
   * no attributes, text as text nodes. Anything else is unwrapped (its text is
   * kept) or, for script-like elements, dropped with its content.
   */
  function appendRich(dest, html) {
    if (typeof html !== "string" || html === "") return;
    const allowed = allowedTags();
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

    const walk = (src, out) => {
      for (const node of src.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          out.appendChild(document.createTextNode(node.nodeValue));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          if (DROP_TAGS.includes(tag)) continue;
          if (!allowed.includes(tag)) {
            walk(node, out);
            continue;
          }
          const el = document.createElement(tag);
          if (!VOID_TAGS.includes(tag)) walk(node, el);
          out.appendChild(el);
        }
      }
    };
    walk(doc.body, dest);
  }

  function richBlock(html, className) {
    const div = document.createElement("div");
    if (className) div.className = className;
    appendRich(div, html && html.html);
    return div;
  }

  function labelled(label, html) {
    const wrap = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = label;
    wrap.appendChild(strong);
    appendRich(wrap, html && html.html);
    return wrap;
  }

  function line(text) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }

  function appendOptions(parent, options) {
    const list = document.createElement("ol");
    list.type = "a";
    for (const option of options || []) {
      const li = document.createElement("li");
      appendRich(li, option.content && option.content.html);
      if (option.correct === true) {
        const mark = document.createElement("strong");
        mark.textContent = " Correct answer";
        li.appendChild(mark);
      }
      if (option.feedback) li.appendChild(labelled("Feedback for this option: ", option.feedback));
      if (option.feedbackWhenMissed) {
        li.appendChild(labelled("Feedback if this option is missed: ", option.feedbackWhenMissed));
      }
      list.appendChild(li);
    }
    parent.appendChild(list);
  }

  function appendAnswer(parent, q) {
    const body = q.body || {};
    if (q.type === "true-false") {
      const strong = document.createElement("strong");
      strong.textContent = `Correct answer: ${body.correctAnswer === true ? "True" : "False"}`;
      const p = document.createElement("p");
      p.appendChild(strong);
      parent.appendChild(p);
      return;
    }
    if (q.type === "numeric") {
      const parts = [`Correct answer: ${body.expected}`];
      if (body.unit) parts[0] += ` ${body.unit}`;
      if (typeof body.tolerance === "number") parts.push(`tolerance ${body.tolerance}`);
      if (body.label) parts.push(`answer box label: ${body.label}`);
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = parts[0];
      p.appendChild(strong);
      if (parts.length > 1) p.appendChild(document.createTextNode(` (${parts.slice(1).join("; ")})`));
      parent.appendChild(p);
      return;
    }
    appendOptions(parent, body.options);
  }

  function appendFeedback(parent, feedback) {
    if (!feedback) return;
    const by = feedback.byOutcome || {};
    if (by.correct) parent.appendChild(labelled("Feedback when correct: ", by.correct));
    if (by.incorrect) parent.appendChild(labelled("Feedback when incorrect: ", by.incorrect));
    if (by.partiallyCorrect) {
      parent.appendChild(labelled("Feedback when partly correct: ", by.partiallyCorrect));
    }
    if (feedback.default) parent.appendChild(labelled("Feedback: ", feedback.default));
  }

  /** A button whose visible name carries the question's number. */
  function actionButton(action, index, text) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-quiz-action", action);
    b.setAttribute("data-quiz-index", String(index));
    b.textContent = text;
    return b;
  }

  /** Edit and Delete for one drawn question (QZ-8). A quiz of one cannot lose it. */
  function appendActions(section, index, total) {
    const bar = document.createElement("div");
    bar.className = "quiz-question-actions";
    bar.appendChild(actionButton("edit", index, `Edit question ${index + 1}`));
    const del = actionButton("delete", index, `Delete question ${index + 1}`);
    bar.appendChild(del);
    if (total === 1) {
      const note = document.createElement("p");
      note.className = "field-hint";
      note.id = IDS.lastNote;
      note.textContent = MESSAGES.lastQuestion;
      del.setAttribute("aria-disabled", "true");
      del.setAttribute("aria-describedby", IDS.lastNote);
      bar.appendChild(note);
    }
    section.appendChild(bar);
  }

  /** One question's read-only section. */
  function drawQuestion(q, index, total, withActions) {
    const section = document.createElement("section");
    section.className = "quiz-question";
    const heading = document.createElement("h5");
    heading.textContent = `Question ${index + 1} of ${total}: ${TYPE_WORDS[q.type] || q.type}`;
    section.appendChild(heading);
    section.appendChild(richBlock(q.prompt, "quiz-question-prompt"));
    appendAnswer(section, q);
    appendFeedback(section, q.feedback);
    if (withActions) appendActions(section, index, total);
    return section;
  }

  /**
   * Build the questions, in order, into `target`. Exposed so a test can hand a
   * quiz straight in. Edit and Delete buttons are drawn only when
   * `options.actions` is true (the result view asks for them; a bare draw does not).
   */
  function drawQuiz(target, quiz, options) {
    target.textContent = "";
    const withActions = Boolean(options && options.actions);
    const questions = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
    questions.forEach((q, index) => {
      target.appendChild(drawQuestion(q, index, questions.length, withActions));
    });
    return questions.length;
  }

  /** Typeset the drawn quiz once the panel has a layout box; otherwise wait. */
  async function typesetResult() {
    const body = byId(IDS.resultBody);
    const panel = byId(IDS.panel);
    if (!body || !panel) return;
    if (panel.hidden || body.getClientRects().length === 0) {
      typesetPending = true;
      return;
    }
    typesetPending = false;
    const mj = window.MathJax;
    if (!mj || typeof mj.typesetPromise !== "function") return;
    try {
      await mj.typesetPromise([body]);
    } catch (e) {
      logWarn("MathJax could not typeset the quiz", e);
    }
  }

  /** Reflect the store in the result view. Redraws only when the quiz changed. */
  function renderResult() {
    const s = store();
    const section = byId(IDS.result);
    const body = byId(IDS.resultBody);
    const heading = byId(IDS.resultHeading);
    if (!s || !section || !body || !heading) return;

    const quiz = s.get();
    if (!quiz) {
      if (!section.hidden) {
        body.textContent = "";
        delete body.dataset.drawn;
        section.hidden = true;
      }
      return;
    }

    const signature = JSON.stringify(quiz);
    section.hidden = false;
    if (body.dataset.drawn === signature) return;
    const count = drawQuiz(body, quiz, { actions: true });
    editing = null; // a redraw replaces any open editor with the read-only view
    body.dataset.drawn = signature;
    setText(heading, `Your practice quiz (${quizNoun(count)})`);
    typesetResult();
  }

  /** The refusal list: visible until the next attempt, drawn with textContent only. */
  function showRefusal(errors) {
    const box = byId(IDS.refusal);
    const list = byId(IDS.refusalList);
    if (!box || !list) return;
    list.textContent = "";
    // The checker reports a reason once for every place it applies (a prompt
    // with two paragraphs is named twice), so each distinct line shows once.
    const shown = new Set();
    for (const err of errors || []) {
      const where = err && err.questionId ? `Question ${err.questionId}: ` : "";
      const text = `${where}${err && err.message ? err.message : String(err)}`;
      if (shown.has(text)) continue;
      shown.add(text);
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    }
    box.hidden = false;
  }

  function clearRefusal() {
    const box = byId(IDS.refusal);
    const list = byId(IDS.refusalList);
    if (list) list.textContent = "";
    if (box) box.hidden = true;
  }

  // ============================================================================
  // NOTIFICATIONS (the toast is the voice: no announce() beside it)
  // ============================================================================

  /** Returns the toast id the notification system gives back, or null. */
  function notify(kind, message, options) {
    const fn = window[kind];
    if (typeof fn === "function") return fn(message, options) || null;
    logWarn(`${kind} is not available`);
    return null;
  }

  /** QZ-10: a refusal toast, remembered so a later success can take it down. */
  function notifyRefusal(message) {
    const id = notify("notifyError", message);
    if (id) refusalToasts.push(id);
  }

  /**
   * QZ-10: once a save or a write succeeds, the refusal toasts of earlier
   * attempts are out of date, so dismiss them through the notification
   * system's own public dismiss. A toast holding focus is left for the person
   * to close: dismissing it here would drop focus on the page body.
   */
  function dismissRefusalToasts() {
    const api = window.UniversalNotifications;
    const ids = refusalToasts;
    refusalToasts = [];
    if (!api || typeof api.dismiss !== "function") return;
    for (const id of ids) {
      const toast = document.getElementById(id);
      if (toast && toast.contains(document.activeElement)) {
        refusalToasts.push(id);
        continue;
      }
      api.dismiss(id);
    }
  }

  // ============================================================================
  // WRITING
  // ============================================================================

  function setRunning(next) {
    running = next;
    const progress = byId(IDS.progress);
    if (progress) {
      setText(progress, next ? MESSAGES.started : "");
      progress.hidden = !next;
    }
    refresh();
  }

  /**
   * The write button's press. One transport call per press; a second press
   * while one is in flight does nothing. Returns the writer's result, or null
   * when nothing was sent.
   */
  async function write() {
    if (running) return null;
    running = true; // claim it before the first await: a second press must find it taken

    try {
      const assessed = assess();
      if (assessed.reason) {
        refresh();
        return null;
      }

      const hadQuiz = Boolean(store() && store().count() > 0);
      if (hadQuiz) {
        const range = estimateRange(assessed.request);
        const confirmed = await window.safeConfirm(
          `This replaces the practice quiz you have and costs ${range}. It is an estimate, not a price.`,
          MESSAGES.replaceTitle,
          {
            confirmText: MESSAGES.replaceConfirm,
            cancelText: MESSAGES.replaceCancel,
            returnFocusTo: byId(IDS.write),
          },
        );
        // Past the modal close and the focus restore, before anything is spoken or sent.
        await sleep(MODAL_CLOSE_DELAY_MS);
        if (!confirmed) return null;
      }

      clearRefusal();
      setRunning(true);
      notify("notifyInfo", MESSAGES.started);

      const deps = typeof transport === "function" ? { transport } : {};
      const result = await writer().generate(assessed.options, deps);

      if (result && result.ok) {
        dismissRefusalToasts();
        notify("notifySuccess", `Practice quiz written: ${quizNoun(result.quiz.questions.length)}.`);
      } else {
        showRefusal(result ? result.errors : []);
        notifyRefusal(MESSAGES.refused);
      }
      return result;
    } catch (e) {
      logError("The write failed unexpectedly", e);
      showRefusal([{ questionId: null, message: e && e.message ? e.message : String(e) }]);
      notifyRefusal(MESSAGES.refused);
      return null;
    } finally {
      running = false;
      const progress = byId(IDS.progress);
      if (progress) {
        setText(progress, "");
        progress.hidden = true;
      }
      refresh();
    }
  }

  async function deleteQuiz() {
    const s = store();
    if (!s || s.count() === 0) return false;

    const confirmed = await window.safeConfirm(
      "This deletes the practice quiz. It cannot be undone, and writing a new one costs money.",
      MESSAGES.deleteTitle,
      {
        confirmText: MESSAGES.deleteConfirm,
        cancelText: MESSAGES.deleteCancel,
        returnFocusTo: byId(IDS.write),
      },
    );
    await sleep(MODAL_CLOSE_DELAY_MS);
    if (!confirmed) return false;

    s.clear();
    clearRefusal(); // the reasons belonged to a quiz that no longer exists
    editing = null;
    const write = byId(IDS.write);
    if (write) write.focus();
    notify("notifySuccess", MESSAGES.deleted);
    return true;
  }

  // ============================================================================
  // EDIT AND DELETE ONE QUESTION (QZ-8)
  // ============================================================================

  const questionSection = (index) => {
    const body = byId(IDS.resultBody);
    return body ? body.querySelectorAll(":scope > section.quiz-question")[index] || null : null;
  };

  const actionButtonFor = (action, index) => {
    const body = byId(IDS.resultBody);
    return body ? body.querySelector(`button[data-quiz-action="${action}"][data-quiz-index="${index}"]`) : null;
  };

  /**
   * While one question is open, every other Edit and Delete says so and does
   * nothing: aria-disabled keeps them focusable, and a visible note names the
   * reason (never a live region).
   */
  function setOthersBlocked(openIndex) {
    const body = byId(IDS.resultBody);
    if (!body) return;
    const blocked = openIndex !== null;
    let note = byId(IDS.editNote);
    if (blocked && !note) {
      note = document.createElement("p");
      note.id = IDS.editNote;
      note.className = "field-hint";
      body.insertBefore(note, body.firstChild);
    }
    if (note) {
      if (blocked) note.textContent = `Question ${openIndex + 1} is open for editing. Save or cancel it before editing or deleting another question.`;
      else note.remove();
    }
    body.querySelectorAll('button[data-quiz-action="edit"], button[data-quiz-action="delete"]').forEach((b) => {
      if (blocked) {
        b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-describedby", IDS.editNote);
      } else {
        b.removeAttribute("aria-disabled");
        b.removeAttribute("aria-describedby");
      }
    });
    if (!blocked) {
      // a quiz of one keeps its Delete explained
      const only = body.querySelectorAll(":scope > section.quiz-question").length === 1;
      const del = actionButtonFor("delete", 0);
      if (only && del) {
        del.setAttribute("aria-disabled", "true");
        del.setAttribute("aria-describedby", IDS.lastNote);
      }
    }
  }

  function startEdit(index) {
    const editor = window.MathPixQuizEditor;
    const s = store();
    const quiz = s ? s.get() : null;
    if (!editor || !quiz || editing || !quiz.questions[index]) return false;

    const section = questionSection(index);
    if (!section) return false;
    const handle = editor.build(quiz.questions[index], index, quiz.questions.length);
    section.replaceWith(handle.root);
    editing = { index, handle };
    saveRefusals = 0;
    setOthersBlocked(index);
    handle.firstControl.focus();
    return true;
  }

  /** Put the read-only view back in place of the editor, and say nothing. */
  function closeEditor(focusIndex) {
    const s = store();
    const quiz = s ? s.get() : null;
    const current = editing;
    if (!current || !quiz) return false;
    const q = quiz.questions[current.index];
    if (q) current.handle.root.replaceWith(drawQuestion(q, current.index, quiz.questions.length, true));
    editing = null;
    setOthersBlocked(null);
    typesetResult();
    const back = actionButtonFor("edit", focusIndex === undefined ? current.index : focusIndex);
    if (back) back.focus();
    return true;
  }

  function cancelEdit() {
    return closeEditor();
  }

  /**
   * Save the open editor. The whole quiz is checked before anything is stored;
   * a refusal keeps the editor open, lists the reasons beside their fields and
   * leaves the store as it was.
   */
  async function saveEdit() {
    const current = editing;
    if (!current || saving) return null;
    saving = true;
    const { handle, index } = current;
    handle.buttons.save.setAttribute("aria-busy", "true");
    handle.buttons.save.setAttribute("aria-disabled", "true");

    try {
      const s = store();
      const format = window.MathPixQuizFormat;
      const quiz = s ? s.get() : null;
      if (!s || !format || !quiz) return null;

      const collected = handle.collect();
      let errors = collected.problems;
      if (errors.length === 0) {
        quiz.questions[index] = collected.question;
        const verdict = await format.checkQuiz(quiz);
        errors = verdict.ok ? [] : verdict.errors;
        if (verdict.ok) {
          const stored = s.set(quiz);
          if (!stored.ok) errors = stored.errors;
        }
      }

      if (errors.length > 0) {
        const target = handle.showErrors(errors);
        if (target) target.focus();
        saveRefusals += 1;
        notifyRefusal(MESSAGES.saveRefused(index + 1, saveRefusals));
        return { ok: false, errors };
      }

      // A changed quiz redrew itself through the store's change event; a save
      // that changed nothing did not, so close the editor ourselves. Either
      // way focus lands on this question's Edit button.
      if (editing) {
        closeEditor();
      } else {
        const back = actionButtonFor("edit", index);
        if (back) back.focus();
      }
      dismissRefusalToasts();
      notify("notifySuccess", MESSAGES.saved(index + 1));
      return { ok: true, errors: [] };
    } finally {
      saving = false;
      handle.buttons.save.removeAttribute("aria-busy");
      handle.buttons.save.removeAttribute("aria-disabled");
    }
  }

  /** Delete one question after asking, then re-check and store the rest. */
  async function deleteQuestion(index) {
    const s = store();
    const format = window.MathPixQuizFormat;
    const quiz = s ? s.get() : null;
    if (!s || !format || !quiz || editing || !quiz.questions[index]) return false;
    if (quiz.questions.length < 2) return false; // the button already says why

    const n = index + 1;
    const confirmed = await window.safeConfirm(
      `Delete question ${n}? It cannot be undone.`,
      `Delete question ${n}?`,
      {
        confirmText: MESSAGES.deleteQuestionConfirm,
        cancelText: MESSAGES.deleteQuestionCancel,
        returnFocusTo: actionButtonFor("delete", index),
      },
    );
    await sleep(MODAL_CLOSE_DELAY_MS);
    if (!confirmed) return false;

    quiz.questions.splice(index, 1);
    const verdict = await format.checkQuiz(quiz);
    const stored = verdict.ok ? s.set(quiz) : { ok: false, errors: verdict.errors };
    if (!stored.ok) {
      const first = stored.errors && stored.errors[0] && stored.errors[0].message ? stored.errors[0].message : "";
      notify("notifyError", MESSAGES.deleteRefused(n, first));
      return false;
    }

    // The next question now holds this number; after the last, the one before.
    const total = quiz.questions.length;
    const next = actionButtonFor("edit", Math.min(index, total - 1));
    if (next) next.focus();
    notify("notifySuccess", MESSAGES.questionDeleted(n));
    return true;
  }

  function onResultClick(event) {
    const button = event.target && event.target.closest ? event.target.closest("button[data-quiz-action]") : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const index = Number(button.getAttribute("data-quiz-index"));
    const action = button.getAttribute("data-quiz-action");
    if (action === "edit") startEdit(index);
    else if (action === "cancel") cancelEdit();
    else if (action === "save") saveEdit();
    else if (action === "delete") deleteQuestion(index);
  }

  // ============================================================================
  // WIRING
  // ============================================================================

  function onPress(event) {
    if (event) event.preventDefault();
    write();
  }

  function watchPanel() {
    const panel = byId(IDS.panel);
    if (!panel || panelObserver) return;
    panelObserver = new MutationObserver(() => {
      if (panel.hidden) return;
      refresh();
      if (typesetPending) typesetResult();
    });
    panelObserver.observe(panel, { attributes: true, attributeFilter: ["hidden", "class"] });
  }

  function init() {
    if (initialised) return;
    const panel = byId(IDS.panel);
    if (!panel) return;
    initialised = true;

    const form = byId(IDS.form);
    if (form) {
      form.addEventListener("input", () => refresh());
      form.addEventListener("change", () => refresh());
      form.addEventListener("submit", (event) => event.preventDefault());
    }
    const writeBtn = byId(IDS.write);
    if (writeBtn) writeBtn.addEventListener("click", onPress);
    const deleteBtn = byId(IDS.delete);
    if (deleteBtn) deleteBtn.addEventListener("click", () => deleteQuiz());
    const resultBody = byId(IDS.resultBody);
    if (resultBody) resultBody.addEventListener("click", onResultClick);

    document.addEventListener("mathpix:quiz-changed", () => refresh());
    watchPanel();
    refresh();
    logInfo("Quiz tab ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  /**
   * Test seam: supply the transport the next press sends through, or null for
   * the writer's own. A function, never a property a page could set by accident.
   */
  function setTransport(fn) {
    transport = typeof fn === "function" ? fn : null;
  }

  window.MathPixQuizTab = Object.freeze({
    VERSION,
    IDS,
    refresh,
    write,
    deleteQuiz,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteQuestion,
    drawQuiz,
    readOptions,
    setTransport,
  });
})();
