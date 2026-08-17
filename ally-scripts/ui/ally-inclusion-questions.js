/**
 * @fileoverview Ally Statement Preview - Inclusion Questionnaire Wizard
 * @module AllyInclusionQuestions
 * @requires UniversalModal, ALLY_INCLUSION_QUESTIONS_CONTENT, ALLY_INCLUSION_ANSWERS,
 *           ALLY_STATEMENT_PREVIEW (all looked up defensively at call time)
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Step-by-step wizard (one question per step) that lets the report author answer
 * the inclusion questions for the currently-selected module: a module-lead
 * contact step (name + email text fields), five Yes/No questions, and a
 * free-text (Markdown) message. Answers are saved per step to the durable
 * per-module store (ALLY_INCLUSION_ANSWERS) and, on close, the statement
 * preview is re-rendered from the already-loaded data (light re-render — no API
 * call) so the header details and inclusive-design cards reflect the new
 * answers immediately.
 *
 * Built on the Universal Modal legacy class (a long-lived instance we drive
 * imperatively — see docs/universal-ui-components-guide.md §2.2). All step markup
 * is hand-written semantic HTML (fieldset/legend/label) built with textContent, so
 * authored copy can never inject markup.
 *
 * Exposed globally as ALLY_INCLUSION_QUESTIONS (and on window).
 */

const ALLY_INCLUSION_QUESTIONS = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  let DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyInclusionQuestions] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyInclusionQuestions] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyInclusionQuestions] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyInclusionQuestions] " + message, ...args);
  }

  // ========================================================================
  // Module state (single wizard instance at a time)
  // ========================================================================

  let modalInstance = null;
  let questions = [];
  let draft = {}; // working copy of answers, persisted per step
  let courseKey = "";
  let course = null;
  let stepIndex = 0;
  let discardCurrentStep = false; // set when the user confirms "close without saving"
  let confirmOpen = false; // a close-confirmation dialog is currently showing
  let initialAnswersJson = "{}"; // snapshot at open, to detect changes on close

  // Cached DOM references for the open wizard
  let stepHostEl = null;
  let progressEl = null;
  let stepsNavEl = null;
  let backBtn = null;
  let nextBtn = null;

  // ========================================================================
  // Small DOM helper — text-only, injection-safe
  // ========================================================================

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }

  // ========================================================================
  // Step rendering
  // ========================================================================

  /**
   * Builds the persistent wizard shell (progress line, step host, nav buttons)
   * and returns the wrapper element. Per-step content is injected into the step
   * host by renderStep().
   * @returns {HTMLElement}
   */
  function buildShell() {
    progressEl = el("p", { class: "ally-iq-progress", role: "status" });
    // Clickable step navigator (populated per render by renderStepsNav()).
    stepsNavEl = el("nav", {
      class: "ally-iq-steps",
      "aria-label": "Question navigation",
    });
    stepHostEl = el("div", { class: "ally-iq-step-host" });

    backBtn = el("button", {
      type: "button",
      class: "ally-secondary-btn ally-iq-back",
      text: "Back",
    });
    nextBtn = el("button", {
      type: "button",
      class: "ally-primary-btn ally-iq-next",
      text: "Save & continue",
    });
    backBtn.addEventListener("click", goBack);
    nextBtn.addEventListener("click", goNext);

    const closeBtn = el("button", {
      type: "button",
      class: "ally-secondary-btn ally-iq-close",
      text: "Close",
    });
    closeBtn.addEventListener("click", requestClose);

    const navLeft = el("div", { class: "ally-iq-nav-left" }, [closeBtn, backBtn]);
    const nav = el("div", { class: "ally-iq-nav" }, [navLeft, nextBtn]);
    return el("div", { class: "ally-iq-wizard" }, [
      progressEl,
      stepsNavEl,
      stepHostEl,
      nav,
    ]);
  }

  /**
   * True when question `i` has a recorded answer: a Yes/No choice (either value),
   * a non-empty free-text message, or (contact step) a non-empty name — the first
   * field. The email is optional per-site: each statement placeholder falls back
   * independently, so a name without an email is still a useful answer. Reflects
   * saved state (the working draft), which updates whenever a step is left
   * (Back/Continue/step jump).
   * @param {number} i
   * @returns {boolean}
   */
  function isAnswered(i) {
    const q = questions[i];
    if (!q) return false;
    if (q.type === "contact") {
      const nameField = q.fields && q.fields[0];
      const name = nameField ? draft[nameField.id] : undefined;
      return typeof name === "string" && name.trim() !== "";
    }
    const v = draft[q.id];
    if (q.type === "markdown") return typeof v === "string" && v.trim() !== "";
    return v === "yes" || v === "no";
  }

  /**
   * Jumps to question `i`, saving the current step first (mirrors Back/Continue).
   * @param {number} i
   */
  function goToStep(i) {
    if (i === stepIndex || i < 0 || i >= questions.length) return;
    persistCurrent();
    stepIndex = i;
    renderStep();
  }

  /** Builds one step-navigator dot (a button) for question `i`. */
  function buildStepDot(i) {
    const q = questions[i];
    const answered = isAnswered(i);
    const current = i === stepIndex;
    const checkSvg =
      answered && typeof window.getIcon === "function"
        ? window.getIcon("check")
        : null;

    const btn = el("button", {
      type: "button",
      class:
        "ally-iq-step-dot" +
        (answered ? " is-answered" : "") +
        (current ? " is-current" : ""),
      "aria-label":
        "Question " +
        (i + 1) +
        " of " +
        questions.length +
        ": " +
        q.title +
        ". " +
        (answered ? "Answered." : "Not answered yet."),
    });
    if (current) btn.setAttribute("aria-current", "step");

    const inner = el("span", {
      class: "ally-iq-step-dot-inner",
      "aria-hidden": "true",
    });
    if (checkSvg) inner.innerHTML = checkSvg; // trusted icon-library SVG
    else inner.textContent = String(i + 1);
    btn.appendChild(inner);

    btn.addEventListener("click", function () {
      goToStep(i);
    });
    return btn;
  }

  /** (Re)builds the step navigator to reflect current position and answers. */
  function renderStepsNav() {
    if (!stepsNavEl) return;
    stepsNavEl.innerHTML = "";
    const ol = el("ol", { class: "ally-iq-steps-list" });
    questions.forEach(function (q, i) {
      ol.appendChild(el("li", { class: "ally-iq-steps-item" }, [buildStepDot(i)]));
    });
    stepsNavEl.appendChild(ol);
  }

  /**
   * Renders the question at `stepIndex` into the step host, pre-filled from the
   * working draft, updates the progress line + bar and nav-button state, and
   * moves focus to the step heading. Layout is a two-column grid (question left,
   * guidance right — the guide video plus a "Read more" link to the written
   * guidance) that collapses to a single column on narrow viewports.
   */
  function renderStep() {
    const q = questions[stepIndex];
    if (!q) return;
    const total = questions.length;

    let answeredCount = 0;
    for (let i = 0; i < total; i++) if (isAnswered(i)) answeredCount++;
    progressEl.textContent =
      "Question " +
      (stepIndex + 1) +
      " of " +
      total +
      " — " +
      answeredCount +
      " answered";

    // Rebuild the step navigator so answered/current states are current.
    renderStepsNav();

    // Step heading with visually-hidden step count for screen readers.
    const heading = el("h2", { class: "ally-iq-step-title", tabindex: "-1" });
    heading.appendChild(document.createTextNode(q.title));
    heading.appendChild(
      el("span", {
        class: "visually-hidden",
        text: " — question " + (stepIndex + 1) + " of " + total,
      }),
    );

    // Question column (prompt/points/answer, or prompt/textarea).
    const questionCol = el("div", { class: "ally-iq-col-question" }, [
      renderQuestionBody(q),
    ]);

    const grid = el("div", { class: "ally-iq-grid" });
    grid.appendChild(questionCol);

    // Guidance column — the guide video and/or the "Read more" link. Either
    // alone is enough to warrant the column (el() skips null children).
    const video = renderVideo(q);
    const readMore = renderReadMoreLink(q);
    if (video || readMore) {
      grid.classList.add("ally-iq-grid--with-video");
      grid.appendChild(
        el("div", { class: "ally-iq-col-video" }, [
          video
            ? el("p", { class: "ally-iq-video-label", text: "Video guide" })
            : null,
          video,
          readMore,
        ]),
      );
    }

    const step = el("div", { class: "ally-iq-step" }, [heading, grid]);

    stepHostEl.innerHTML = "";
    stepHostEl.appendChild(step);

    // Nav state
    backBtn.disabled = stepIndex === 0;
    nextBtn.textContent =
      stepIndex === total - 1 ? "Save & finish" : "Save & continue";

    // Move focus to the step heading so the question is announced.
    heading.focus();
    logDebug("Rendered step " + (stepIndex + 1) + "/" + total + " (" + q.id + ")");
  }

  /**
   * Builds the responsive Panopto guide-video embed for a step, or null when the
   * question has no video. The <iframe> carries a `title` (the one element where
   * a title attribute is required and correct) so it has an accessible name; it
   * is lazy-loaded and does not autoplay (autoplay=false is set in the URL).
   * @param {Object} q
   * @returns {HTMLElement|null}
   */
  function renderVideo(q) {
    if (!q.videoUrl) return null;
    const iframe = el("iframe", {
      class: "ally-iq-video-frame",
      src: q.videoUrl,
      title: q.videoTitle || "Video guide: " + q.title,
      loading: "lazy",
      allowfullscreen: "",
      allow: "autoplay; fullscreen",
    });
    return el("div", { class: "ally-iq-video" }, [iframe]);
  }

  /**
   * Builds the "Read more" link to the step's written guidance, or null when the
   * question has no `readMoreUrl`. The visible text stays short; a visually-hidden
   * suffix names the destination and the new tab, so each of the six otherwise
   * identical links has a distinct, honest accessible name. It opens in a new tab
   * deliberately — the wizard is a modal holding unsaved answers, and a same-tab
   * navigation would discard the current step's edit.
   * @param {Object} q
   * @returns {HTMLElement|null}
   */
  function renderReadMoreLink(q) {
    if (!q.readMoreUrl) return null;

    const link = el("a", {
      class: "ally-iq-video-readmore",
      href: q.readMoreUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    link.appendChild(document.createTextNode("Read more"));
    link.appendChild(
      el("span", {
        class: "visually-hidden",
        text: " about " + q.title + " (opens in a new tab)",
      }),
    );

    const iconSvg =
      typeof window.getIcon === "function" ? window.getIcon("external") : null;
    if (iconSvg) {
      const icon = el("span", {
        class: "ally-iq-video-readmore-icon",
        "aria-hidden": "true",
      });
      icon.innerHTML = iconSvg; // trusted icon-library SVG
      link.appendChild(icon);
    }
    return link;
  }

  /**
   * Dispatches to the contact, free-text, or Yes/No body for the question column.
   * @param {Object} q
   * @returns {HTMLElement}
   */
  function renderQuestionBody(q) {
    if (q.type === "contact") return renderContactBody(q);
    return q.type === "markdown" ? renderMarkdownBody(q) : renderYesNoBody(q);
  }

  /**
   * Contact step: one labelled text input per field in `q.fields`. Each field's
   * `id` is its own store key (the question's `id` is never stored), so the two
   * values feed the {moduleLead}/{moduleLeadEmail} live tokens independently.
   * @param {Object} q
   * @returns {HTMLElement}
   */
  function renderContactBody(q) {
    const wrap = el("div", { class: "ally-iq-question ally-iq-question--contact" });
    const promptId = "iq-" + q.id + "-prompt";
    wrap.appendChild(
      el("p", { class: "ally-iq-prompt", id: promptId, text: q.prompt }),
    );

    (q.fields || []).forEach(function (field) {
      const inputId = "iq-" + field.id;
      const input = el("input", {
        type: field.inputType || "text",
        id: inputId,
        class: "ally-iq-input",
        autocomplete: "off",
        spellcheck: field.inputType === "email" ? "false" : null,
      });
      input.value = typeof draft[field.id] === "string" ? draft[field.id] : "";
      wrap.appendChild(
        el("div", { class: "ally-iq-field" }, [
          el("label", { class: "ally-iq-label", for: inputId, text: field.label }),
          input,
        ]),
      );
    });
    return wrap;
  }

  function renderYesNoBody(q) {
    const wrap = el("div", { class: "ally-iq-question" });
    const promptId = "iq-" + q.id + "-prompt";
    wrap.appendChild(
      el("p", { class: "ally-iq-prompt", id: promptId, text: q.prompt }),
    );

    if (q.points && q.points.length) {
      const ul = el("ul", { class: "ally-iq-points" });
      q.points.forEach(function (p) {
        ul.appendChild(el("li", { text: p }));
      });
      wrap.appendChild(ul);
    }

    // Answer group: a labelled radiogroup whose accessible name is the prompt.
    const hintId = "iq-" + q.id + "-hint";
    const hint = el("p", {
      class: "ally-iq-answer-hint",
      id: hintId,
      text: "Does this apply to your module?",
    });

    const options = el("div", {
      class: "ally-iq-options",
      role: "radiogroup",
      "aria-labelledby": promptId,
      "aria-describedby": hintId,
    });
    [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ].forEach(function (opt) {
      const inputId = "iq-" + q.id + "-" + opt.value;
      const input = el("input", {
        type: "radio",
        id: inputId,
        name: "iq-" + q.id,
        value: opt.value,
        class: "ally-iq-radio",
      });
      if (draft[q.id] === opt.value) input.checked = true;
      // Label wraps the radio (implicit association) + visible text.
      options.appendChild(
        el("label", { class: "ally-iq-option" }, [
          input,
          el("span", { class: "ally-iq-option-text", text: opt.label }),
        ]),
      );
    });

    wrap.appendChild(el("div", { class: "ally-iq-answer" }, [hint, options]));
    return wrap;
  }

  function renderMarkdownBody(q) {
    const wrap = el("div", { class: "ally-iq-question ally-iq-question--markdown" });
    const promptId = "iq-" + q.id + "-prompt";
    const helpId = "iq-" + q.id + "-help";
    const textId = "iq-" + q.id + "-text";

    wrap.appendChild(
      el("p", { class: "ally-iq-prompt", id: promptId, text: q.prompt }),
    );
    wrap.appendChild(
      el("label", { class: "ally-iq-label", for: textId, text: "Your message" }),
    );
    if (q.help)
      wrap.appendChild(el("p", { class: "ally-iq-help", id: helpId, text: q.help }));

    const ta = el("textarea", {
      id: textId,
      class: "ally-iq-textarea",
      rows: "10",
      "aria-describedby": promptId + (q.help ? " " + helpId : ""),
    });
    ta.value = typeof draft[q.id] === "string" ? draft[q.id] : "";
    wrap.appendChild(ta);
    return wrap;
  }

  // ========================================================================
  // Read / persist the current step
  // ========================================================================

  /**
   * Reads the current step's control(s) into a value, or null when the Yes/No
   * step has no selection (left unanswered). The contact step returns a `values`
   * map (field id → string) instead of a single `value` — empty strings included,
   * so clearing a field is a deliberate, persistable edit.
   * @returns {{id: (string|null), value?: (string|null), values?: Object.<string, string>}}
   */
  function readCurrentAnswer() {
    const q = questions[stepIndex];
    if (!q) return { id: null, value: null };
    if (q.type === "contact") {
      const values = {};
      (q.fields || []).forEach(function (field) {
        const input = stepHostEl.querySelector("#iq-" + CSS.escape(field.id));
        values[field.id] = input ? input.value : "";
      });
      return { id: q.id, values: values };
    }
    if (q.type === "markdown") {
      const ta = stepHostEl.querySelector("#iq-" + CSS.escape(q.id) + "-text");
      return { id: q.id, value: ta ? ta.value : "" };
    }
    const checked = stepHostEl.querySelector('input[name="iq-' + CSS.escape(q.id) + '"]:checked');
    return { id: q.id, value: checked ? checked.value : null };
  }

  /**
   * Persists the current step's answer to the working draft and the durable
   * store. A Yes/No step with no selection is left as-is (not written), so an
   * unanswered question stays hidden. Contact-step fields are written even when
   * empty — clearing the name/email must revert the statement to placeholders.
   */
  function persistCurrent() {
    const ans = readCurrentAnswer();
    if (!ans.id) return;
    if (ans.values) {
      Object.keys(ans.values).forEach(function (fieldId) {
        draft[fieldId] = ans.values[fieldId];
        if (typeof ALLY_INCLUSION_ANSWERS !== "undefined") {
          ALLY_INCLUSION_ANSWERS.setAnswer(courseKey, fieldId, ans.values[fieldId]);
        }
      });
      logDebug("Persisted contact fields " + JSON.stringify(ans.values));
      return;
    }
    if (ans.value === null) return; // unanswered Yes/No — leave untouched
    draft[ans.id] = ans.value;
    if (typeof ALLY_INCLUSION_ANSWERS !== "undefined") {
      ALLY_INCLUSION_ANSWERS.setAnswer(courseKey, ans.id, ans.value);
    }
    logDebug("Persisted " + ans.id + " = " + JSON.stringify(ans.value));
  }

  // ========================================================================
  // Close guard (Close button / × / Escape → confirm-when-dirty, then discard)
  // ========================================================================

  /**
   * True when the current step's on-screen answer differs from what is stored —
   * i.e. there is an unsaved edit that closing would discard. Steps you have
   * moved past are already saved (Back/Continue persist), so are never "dirty".
   * @returns {boolean}
   */
  function isDirty() {
    const q = questions[stepIndex];
    if (!q || !stepHostEl) return false;
    const ans = readCurrentAnswer();
    if (q.type === "contact") {
      return (q.fields || []).some(function (field) {
        const onScreen = (ans.values && ans.values[field.id]) || "";
        const stored = typeof draft[field.id] === "string" ? draft[field.id] : "";
        return onScreen !== stored;
      });
    }
    const stored = draft[q.id];
    if (q.type === "markdown") {
      return (ans.value || "") !== (typeof stored === "string" ? stored : "");
    }
    if (ans.value === null) return false; // no selection made this step
    return ans.value !== stored;
  }

  /** Closes the modal for real (routes through onClose → handleClose). */
  function doClose() {
    if (modalInstance) modalInstance.close();
  }

  /**
   * Entry point for every close route (Close button, ×, Escape). Closes straight
   * away when the current step has no unsaved edit; otherwise asks the user to
   * confirm discarding this step's answer (previously-saved answers are kept).
   */
  function requestClose() {
    if (!isDirty()) {
      doClose();
      return;
    }
    if (confirmOpen) return; // a confirm is already showing
    confirmOpen = true;
    const confirmFn =
      typeof window.safeConfirm === "function"
        ? window.safeConfirm
        : function (m) {
            return Promise.resolve(window.confirm(m));
          };
    confirmFn(
      "Discard your answer to this question and close?\n\nAnswers you have already saved are kept.",
      "Close inclusion questions",
    )
      .then(function (ok) {
        confirmOpen = false;
        if (ok) {
          discardCurrentStep = true;
          doClose();
        }
      })
      .catch(function () {
        confirmOpen = false;
      });
  }

  // Capture-phase interceptors: the modal's built-in × always closes and Escape
  // is disabled (closeOnOverlayClick:false → allowBackgroundClose:false), so we
  // intercept both here and route them through requestClose. Stable function
  // references so they can be removed on close.
  function onDialogClickCapture(e) {
    if (confirmOpen) return;
    const btn =
      e.target &&
      e.target.closest &&
      e.target.closest(".universal-modal-close, .modal-close-button");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    requestClose();
  }

  function onEscapeCapture(e) {
    if (e.key !== "Escape") return;
    if (!modalInstance) return;
    if (confirmOpen) return; // let the confirm dialog handle its own Escape
    e.preventDefault();
    e.stopImmediatePropagation();
    requestClose();
  }

  /** Wires the × / Escape capture interceptors once the modal is open. */
  function wireCloseGuards() {
    const dialog = modalInstance && modalInstance.modal;
    if (dialog) {
      dialog.addEventListener("click", onDialogClickCapture, { capture: true });
    }
    document.addEventListener("keydown", onEscapeCapture, { capture: true });
  }

  function goNext() {
    persistCurrent();
    if (stepIndex >= questions.length - 1) {
      if (modalInstance) modalInstance.close();
      return;
    }
    stepIndex += 1;
    renderStep();
  }

  function goBack() {
    persistCurrent();
    if (stepIndex === 0) return;
    stepIndex -= 1;
    renderStep();
  }

  // ========================================================================
  // Close handling — persist + light re-render of the preview
  // ========================================================================

  /**
   * Confirms the statement was updated and reminds the author how to revisit the
   * questions. A global toast (forceToast) so it survives the modal teardown; the
   * "Edit answers" action reopens the wizard for the still-selected course.
   */
  function notifyStatementUpdated() {
    if (typeof window.notifySuccess !== "function") return;
    window.notifySuccess(
      "Your accessibility statement has been updated. To change your answers, choose “Answer inclusion questions” again.",
      {
        forceToast: true,
        duration: 10000,
        actions: [
          {
            label: "Edit answers",
            ariaLabel: "Edit inclusion answers",
            onClick: function () {
              publicApi.open();
            },
            dismissOnClick: true,
          },
        ],
      },
    );
  }

  function handleClose() {
    // Persist the current step UNLESS the user chose to close without saving it
    // (Save & finish and non-dirty closes still persist — a no-op when clean).
    if (!discardCurrentStep) {
      try {
        persistCurrent();
      } catch (e) {
        logWarn("persist on close failed:", e);
      }
    } else {
      logDebug("Closed without saving the current step (discarded by user)");
    }
    // Light re-render so the inclusive-design cards reflect the saved answers,
    // without re-hitting the Ally API. Guarded — added in Stage B.6.
    if (
      typeof ALLY_STATEMENT_PREVIEW !== "undefined" &&
      typeof ALLY_STATEMENT_PREVIEW.rerender === "function"
    ) {
      ALLY_STATEMENT_PREVIEW.rerender();
    }

    // If the answers actually changed this session, confirm the statement update.
    try {
      const finalJson =
        typeof ALLY_INCLUSION_ANSWERS !== "undefined"
          ? JSON.stringify(ALLY_INCLUSION_ANSWERS.get(courseKey))
          : "{}";
      if (finalJson !== initialAnswersJson) {
        notifyStatementUpdated();
      }
    } catch (e) {
      logWarn("update-notice failed:", e);
    }
    // Remove the Escape capture guard (the dialog click guard dies with the DOM).
    document.removeEventListener("keydown", onEscapeCapture, { capture: true });
    modalInstance = null;
    stepHostEl = progressEl = stepsNavEl = backBtn = nextBtn = null;
    discardCurrentStep = false;
    confirmOpen = false;
    logInfo("Wizard closed; preview re-rendered");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicApi = {
    /**
     * Opens the wizard for the currently-selected module. No-op (with a warning
     * / notification) when prerequisites are missing.
     */
    open: function () {
      if (modalInstance) {
        logDebug("Wizard already open");
        return;
      }
      if (typeof UniversalModal === "undefined" || !UniversalModal.Modal) {
        logError("UniversalModal not available");
        return;
      }
      const content = ALLY_INCLUSION_QUESTIONS_CONTENT;
      if (typeof content === "undefined") {
        logError("Question content not available");
        return;
      }
      course =
        typeof ALLY_STATEMENT_PREVIEW !== "undefined" &&
        typeof ALLY_STATEMENT_PREVIEW.getSelectedCourse === "function"
          ? ALLY_STATEMENT_PREVIEW.getSelectedCourse()
          : null;
      if (!course) {
        logWarn("No module selected — cannot open wizard");
        if (typeof window.notifyInfo === "function") {
          window.notifyInfo("Select a module first to answer the inclusion questions.");
        }
        return;
      }

      courseKey =
        typeof ALLY_INCLUSION_ANSWERS !== "undefined"
          ? ALLY_INCLUSION_ANSWERS.courseKey(course)
          : "";
      draft =
        typeof ALLY_INCLUSION_ANSWERS !== "undefined"
          ? ALLY_INCLUSION_ANSWERS.get(courseKey)
          : {};
      initialAnswersJson = JSON.stringify(draft || {});
      questions = content.getQuestions();
      stepIndex = 0;
      discardCurrentStep = false;
      confirmOpen = false;

      const shell = buildShell();
      const titleCourse = course.code || course.name || "this module";

      modalInstance = new UniversalModal.Modal({
        title: "Inclusion questions — " + titleCourse,
        content: shell,
        size: "fullscreen",
        className: "ally-iq-modal-wrapper",
        closeOnOverlayClick: false, // avoid accidental loss of in-progress answers
        onOpen: function () {
          renderStep();
          wireCloseGuards();
        },
        onClose: function () {
          handleClose();
        },
      });
      modalInstance.open();
      logInfo("Wizard opened for " + titleCourse + " (" + questions.length + " questions)");
    },

    /** @returns {boolean} */
    isOpen: function () {
      return !!modalInstance;
    },

    setLogLevel: function (level) {
      if (typeof level === "number") DEFAULT_LOG_LEVEL = level;
    },
    LOG_LEVELS: LOG_LEVELS,
  };

  return publicApi;
})();

if (typeof window !== "undefined") {
  window.ALLY_INCLUSION_QUESTIONS = ALLY_INCLUSION_QUESTIONS;
}
