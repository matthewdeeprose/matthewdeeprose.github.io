// Turn inline quiz-question JSON blocks into accessible, semantic HTML at build
// time. Like enhancers/enhance-tables.js this is a pure string transform (regex
// over <script type="application/json" data-quiz-question> blocks), so it stays
// environment-independent (node + browser) and needs no DOM.
//
// An author drops a schema-shaped question anywhere in their content:
//
//   <script type="application/json" data-quiz-question>
//   { "id": "q1", "type": "multiple-choice", "prompt": {...}, "body": {...}, ... }
//   </script>
//
// For each block we:
//   - parse + (Stage 1) minimally validate the question;
//   - render static semantic HTML (a <fieldset>/<legend> radio group), so the
//     question is in the real DOM (no-JS friendly, screen-reader friendly, and
//     it enters the TOC/find-in-document like any other content); and
//   - emit a sibling answers block <script data-quiz-answers="id"> carrying the
//     authored question verbatim, which quiz-runtime.js reads to score + give
//     feedback and (SCORM only) report the score. Keeping answers in a JSON
//     <script> keeps them out of casual view and out of the accessible name.
//
// Malformed or unsupported blocks are replaced with an HTML comment rather than
// rendered broken (fail loudly in tests, degrade quietly for a learner).
//
// Every question type is rendered through the RENDERERS / VALIDATORS dispatch
// tables near the foot of the file: a type is supported iff it has an entry in
// RENDERERS. Authored HTML is treated as trusted here (inserted as-is, matching
// the rest of the pipeline); an allow-list sanitiser lands only when an
// editor/API introduces untrusted input. Every value entering an ATTRIBUTE
// (id/for/name/data-*, plain-string labels) still goes through escapeXML.

import { escapeXML } from "../util/escape-xml.js";

// One inline authored question. [\s\S]*? is non-greedy so adjacent blocks don't
// merge. `data-quiz-question` may carry a value or stand alone.
const QUIZ_BLOCK =
  /<script\b[^>]*\btype\s*=\s*["']application\/json["'][^>]*\bdata-quiz-question\b[^>]*>([\s\S]*?)<\/script>/gi;

// Leading icon for the "Check answer" button. Monochrome line art using
// currentColor so it inherits the button text colour; aria-hidden because the
// button's text label is the accessible name. Matches the app's icon style.
// Deliberately a magnifying glass (examine/inspect), NOT a tick or cross — a
// tick/cross on "Check answer" would imply a right/wrong verdict before the
// learner has seen any feedback.
const CHECK_ICON =
  '<svg class="quiz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
  ' focusable="false"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

// Serialise a question for an inline <script>: escape "<" so a "</script>" (or
// any "<") inside authored feedback text cannot break out of the block. The
// result is still valid JSON (< is a legal JSON escape).
function toInlineJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// Insert prompt/option rich text. A single wrapping <p>…</p> is unwrapped so it
// can sit as phrasing content inside a <legend> or <label>; anything else is
// passed through unchanged (trusted authored HTML in this pipeline).
function inlineRich(rich) {
  const html = rich && typeof rich === "object" ? String(rich.html || "") : String(rich || "");
  const m = html.match(/^\s*<p>([\s\S]*)<\/p>\s*$/i);
  return m ? m[1] : html;
}

// The prompt as a stem paragraph, for the types that have no <legend> (entry,
// ordering, matching, select-in-text). Its id is `${id}-legend` so the section
// wrapper's aria-labelledby stays type-agnostic — every renderer emits exactly
// one element with that id carrying the prompt.
function renderStem(q) {
  return `<p class="quiz-stem" id="${escapeXML(q.id)}-stem">${inlineRich(q.prompt)}</p>`;
}

// Wrap a multi-control answer (fill-in blanks, matching rows, select-in-text
// dropdowns) in a fieldset whose legend carries the stem, so a screen reader
// announces the instruction on entry and ties the controls together (SC 1.3.1).
// Single controls (numeric) and button lists (ordering) never use this.
function entryFieldset(q, groupClass, innerHtml) {
  const stemId = `${escapeXML(q.id)}-stem`;
  return (
    `<fieldset class="${groupClass}">\n` +
    `<legend class="quiz-stem" id="${stemId}">${inlineRich(q.prompt)}</legend>\n` +
    `${innerHtml}\n` +
    `</fieldset>`
  );
}

// Detag rich text to a plain string for contexts that cannot hold markup:
// native <option> labels (matching, select-in-text) and aria-label values
// (ordering move buttons). Strips tags then escapes for its target attribute
// at the call site.
function detag(rich) {
  return inlineRich(rich).replace(/<[^>]+>/g, "").trim();
}

// Envelope shape check shared by every type, then dispatch to the per-type
// validator. Enough to render + score a question and to keep a broken block from
// reaching a learner. Returns an error string, or null when usable.
function validate(q) {
  if (!q || typeof q !== "object") return "not an object";
  if (!q.id || typeof q.id !== "string") return "missing string id";
  if (!RENDERERS[q.type]) return `unsupported type "${q.type}"`;
  if (!q.prompt || typeof q.prompt !== "object") return "missing prompt";
  if (q.points != null && (typeof q.points !== "number" || q.points < 0))
    return "points must be a non-negative number";
  // Every attached image needs a non-null text alternative (spec rule; SC 1.1.1).
  if (Array.isArray(q.media)) {
    for (const m of q.media) {
      if (m && m.kind === "image" && m.alt == null)
        return `media image "${m.id || "?"}" needs a non-null alt`;
    }
  }
  const perType = VALIDATORS[q.type];
  return perType ? perType(q) : null;
}

// Partial-credit methods should carry a partiallyCorrect outcome message, else a
// partial result silently falls back to the "incorrect" message (spec rule).
// This is a SOFT warning: the question still renders.
const PARTIAL_METHODS = new Set(["per-option", "per-position", "per-pair"]);

function softWarnings(q) {
  const method = q.scoring && q.scoring.method;
  if (!PARTIAL_METHODS.has(method)) return [];
  const hasPartial = q.feedback && q.feedback.byOutcome && q.feedback.byOutcome.partiallyCorrect;
  if (hasPartial) return [];
  return [
    `quiz: question "${q.id}" uses partial-credit scoring ("${method}") but has no ` +
      `feedback.byOutcome.partiallyCorrect; a partial result falls back to the incorrect message`,
  ];
}

// Shared validity check for a list of choice-style options (multiple-choice,
// multiple-answer, likert, select-in-text): at least two, each with a unique
// string id. `label` names the list in the error for the author.
function validateOptionList(list, label) {
  if (!Array.isArray(list) || list.length < 2) return `${label} needs at least two options`;
  const ids = new Set();
  for (const o of list) {
    if (!o || typeof o.id !== "string") return "every option needs a string id";
    if (ids.has(o.id)) return `duplicate option id "${o.id}"`;
    ids.add(o.id);
  }
  return null;
}

function validateMultipleChoice(q) {
  const opts = q.body && Array.isArray(q.body.options) ? q.body.options : null;
  const err = validateOptionList(opts, "multiple-choice");
  if (err) return err;
  if (!opts.some((o) => o.correct === true)) return "no option marked correct";
  return null;
}

function validateMultipleAnswer(q) {
  const opts = q.body && Array.isArray(q.body.options) ? q.body.options : null;
  const err = validateOptionList(opts, "multiple-answer");
  if (err) return err;
  if (!opts.some((o) => o.correct === true)) return "no option marked correct";
  return null;
}

function validateLikert(q) {
  // Unscored opinion scale: needs a scale of options, but no correct answer.
  return validateOptionList(q.body && q.body.scale, "likert");
}

function validateTrueFalse(q) {
  if (typeof (q.body && q.body.correctAnswer) !== "boolean")
    return "true-false needs a boolean correctAnswer";
  return null;
}

// Two fixed label-wrapped radios (true / false). Values are the literal strings
// "true"/"false" so the runtime can compare against String(body.correctAnswer).
function renderTrueFalse(q) {
  const name = escapeXML(q.id);
  const b = q.body || {};
  const rows = [
    ["true", b.trueLabel, "True"],
    ["false", b.falseLabel, "False"],
  ]
    .map(([value, label, fallback]) => {
      const optId = `${name}-${value}`;
      const text = label ? inlineRich(label) : fallback;
      return (
        `<div class="quiz-option">` +
        `<input type="radio" name="${name}" id="${optId}" value="${value}">` +
        `<label for="${optId}">${text}</label>` +
        `</div>`
      );
    })
    .join("\n");
  return (
    `<fieldset class="quiz-fieldset">\n` +
    `<legend id="${name}-stem">${inlineRich(q.prompt)}</legend>\n` +
    `${rows}\n` +
    `</fieldset>`
  );
}

// A one-line description of a selection limit, referenced by aria-describedby so
// the constraint is announced with the group, never left silent (SC 3.3.2).
function selectionLimitText(min, max) {
  if (min != null && max != null) {
    return min === max ? `Select exactly ${min}.` : `Select between ${min} and ${max}.`;
  }
  if (min != null) return `Select at least ${min}.`;
  return `Select at most ${max}.`;
}

// Checkboxes, plus a selection-limit hint the fieldset points at when the author
// sets min/maxSelections.
function renderMultipleAnswer(q) {
  const b = q.body || {};
  const min = typeof b.minSelections === "number" ? b.minSelections : null;
  const max = typeof b.maxSelections === "number" ? b.maxSelections : null;
  let opts = {};
  if (min != null || max != null) {
    const hintId = `${escapeXML(q.id)}-limit`;
    opts = {
      describedById: hintId,
      hintHtml: `<p class="quiz-hint" id="${hintId}">${escapeXML(selectionLimitText(min, max))}</p>\n`,
    };
  }
  return renderChoiceGroup(q, "checkbox", opts);
}

// --- Entry family ----------------------------------------------------------
function validateFillIn(q) {
  const b = q.body || {};
  const tpl = b.template && typeof b.template.html === "string" ? b.template.html : null;
  if (tpl == null) return "fill-in-the-blank needs a template.html string";
  const blanks = Array.isArray(b.blanks) ? b.blanks : null;
  if (!blanks || !blanks.length) return "fill-in-the-blank needs at least one blank";
  const ids = new Set();
  for (const blank of blanks) {
    if (!blank || typeof blank.id !== "string") return "every blank needs a string id";
    if (ids.has(blank.id)) return `duplicate blank id "${blank.id}"`;
    ids.add(blank.id);
    if (!Array.isArray(blank.expected) || !blank.expected.length)
      return `blank "${blank.id}" needs a non-empty expected list`;
    if (tpl.indexOf(`{{blank:${blank.id}}}`) === -1)
      return `blank "${blank.id}" has no matching {{blank:${blank.id}}} token`;
  }
  // Orphan tokens: a {{blank:…}} in the template with no matching blank entry.
  const tokenRe = /\{\{blank:([^}]+)\}\}/g;
  let m;
  while ((m = tokenRe.exec(tpl))) {
    if (!ids.has(m[1])) return `template references unknown blank "${m[1]}"`;
  }
  return null;
}

// Replace each {{blank:id}} token with a labelled text input. The visible
// sentence stays authored HTML (trusted); the label (visually hidden) and every
// attribute value are escaped. A replacer function is used so a "$" in a label
// can never be read as a replacement pattern.
function renderFillIn(q) {
  const id = escapeXML(q.id);
  let tpl = String(q.body.template.html || "");
  q.body.blanks.forEach((blank) => {
    const bid = escapeXML(blank.id);
    const inputId = `${id}-${bid}`;
    const label = escapeXML(String(blank.label || blank.id));
    const width = blank.inputWidth ? ` style="width:${escapeXML(String(blank.inputWidth))}"` : "";
    // aria-label (not an inline hidden <label>): a hidden label sitting in the
    // sentence flow reads once as content and again as the control name.
    const field =
      `<input class="quiz-blank" type="text" id="${inputId}" name="${inputId}" ` +
      `autocomplete="off" data-blank="${bid}" data-part="${bid}" aria-label="${label}"${width}>`;
    tpl = tpl.replace(`{{blank:${blank.id}}}`, () => field);
  });
  return entryFieldset(q, "quiz-entry-group", `<p class="quiz-entry">${tpl}</p>`);
}

function validateNumeric(q) {
  const b = q.body || {};
  if (typeof b.expected !== "number" || Number.isNaN(b.expected))
    return "numeric needs a numeric expected value";
  if (b.tolerance != null && (typeof b.tolerance !== "number" || b.tolerance < 0))
    return "numeric tolerance must be a non-negative number";
  return null;
}

// A native text input with inputmode (never type=number, which strips meaningful
// input from some AT), a real <label>, and the unit in the label text (SC 3.3.2).
function renderNumeric(q) {
  const id = escapeXML(q.id);
  const b = q.body || {};
  const inputId = `${id}-value`;
  const labelText = escapeXML(String(b.label || "Answer"));
  // The symbolic unit is a visual convenience; hide it from AT because the label
  // words carry the unit (the spec tells authors to state it in the label).
  const unit = b.unit ? ` <span class="quiz-unit" aria-hidden="true">${escapeXML(String(b.unit))}</span>` : "";
  const mode = escapeXML(String(b.inputMode || "decimal"));
  // Name the field with the stem first, then the format label, so tabbing to it
  // announces the question (which a bare <label for> would not reach).
  return (
    `${renderStem(q)}\n` +
    `<p class="quiz-entry">` +
    `<label for="${inputId}" id="${id}-label">${labelText}${unit}</label> ` +
    `<input class="quiz-numeric" type="text" id="${inputId}" name="${inputId}" ` +
    `inputmode="${mode}" autocomplete="off" data-numeric data-part="value" aria-labelledby="${id}-stem ${id}-label">` +
    `</p>`
  );
}

// Generalises the single-answer radio group to every choice-style type: reads
// `body.options` or `body.scale`, uses the given native input type, and (for
// multiple-answer) references a selection-limit hint via aria-describedby.
// `describedById` is appended to the fieldset's aria-describedby when set.
function renderChoiceGroup(q, inputType, opts) {
  opts = opts || {};
  const name = escapeXML(q.id);
  const legendId = `${name}-stem`;
  const list = q.body.options || q.body.scale || [];

  const rows = list
    .map((opt) => {
      const optId = `${name}-${escapeXML(opt.id)}`;
      // data-part lets the runtime mark this option's per-part validity (used by
      // multiple-answer; harmless/unused on single-answer radios and likert).
      return (
        `<div class="quiz-option">` +
        `<input type="${inputType}" name="${name}" id="${optId}" value="${escapeXML(opt.id)}" data-part="${escapeXML(opt.id)}">` +
        `<label for="${optId}">${inlineRich(opt.content)}</label>` +
        `</div>`
      );
    })
    .join("\n");

  const describedBy = opts.describedById ? ` aria-describedby="${escapeXML(opts.describedById)}"` : "";
  const hint = opts.hintHtml || "";

  return (
    `<fieldset class="quiz-fieldset"${describedBy}>\n` +
    `<legend id="${legendId}">${inlineRich(q.prompt)}</legend>\n` +
    hint +
    `${rows}\n` +
    `</fieldset>`
  );
}

// --- Ordering --------------------------------------------------------------
function validateOrdering(q) {
  const b = q.body || {};
  const items = Array.isArray(b.items) ? b.items : null;
  if (!items || items.length < 2) return "ordering needs at least two items";
  const ids = new Set();
  for (const it of items) {
    if (!it || typeof it.id !== "string") return "every item needs a string id";
    if (ids.has(it.id)) return `duplicate item id "${it.id}"`;
    ids.add(it.id);
  }
  const order = Array.isArray(b.correctOrder) ? b.correctOrder : null;
  if (!order) return "ordering needs a correctOrder";
  if (order.length !== items.length) return "correctOrder must list every item exactly once";
  const seen = new Set();
  for (const oid of order) {
    if (!ids.has(oid)) return `correctOrder references unknown item "${oid}"`;
    if (seen.has(oid)) return `correctOrder lists "${oid}" more than once`;
    seen.add(oid);
  }
  return null;
}

// A button-reorderable list (no drag — SC 2.5.7). Emitted in AUTHORED order so
// the build stays deterministic; the runtime shuffles to a non-correct start.
// Each move button's accessible name includes the item ("Move 'cat' up"); a
// per-question role="status" region announces the new position after a move.
function renderOrdering(q) {
  const id = escapeXML(q.id);
  const rows = q.body.items
    .map((item) => {
      const itemId = escapeXML(item.id);
      const name = escapeXML(detag(item.content));
      return (
        `<li class="quiz-reorder-item" data-item-id="${itemId}" data-part="${itemId}">` +
        `<span class="quiz-item-text">${inlineRich(item.content)}</span>` +
        // aria-label leads with the visible text ("Move up") so the visible
        // words are a contiguous run inside the accessible name (SC 2.5.3).
        `<span class="quiz-move-buttons">` +
        `<button type="button" class="quiz-move" data-dir="up" aria-label="Move up, ${name}">Move up</button>` +
        `<button type="button" class="quiz-move" data-dir="down" aria-label="Move down, ${name}">Move down</button>` +
        `</span>` +
        `</li>`
      );
    })
    .join("\n");
  return (
    `${renderStem(q)}\n` +
    `<ul class="quiz-reorder-list" data-quiz-reorder aria-labelledby="${id}-stem">\n${rows}\n</ul>\n` +
    `<div class="quiz-reorder-status quiz-visually-hidden" role="status" aria-live="polite" data-reorder-status></div>`
  );
}

// --- Matching --------------------------------------------------------------
function validateMatching(q) {
  const b = q.body || {};
  const prompts = Array.isArray(b.prompts) ? b.prompts : null;
  const choices = Array.isArray(b.choices) ? b.choices : null;
  if (!prompts || !prompts.length) return "matching needs at least one prompt";
  if (!choices || !choices.length) return "matching needs at least one choice";
  const promptIds = new Set();
  for (const p of prompts) {
    if (!p || typeof p.id !== "string") return "every prompt needs a string id";
    if (promptIds.has(p.id)) return `duplicate prompt id "${p.id}"`;
    promptIds.add(p.id);
  }
  const choiceIds = new Set();
  for (const c of choices) {
    if (!c || typeof c.id !== "string") return "every choice needs a string id";
    if (choiceIds.has(c.id)) return `duplicate choice id "${c.id}"`;
    choiceIds.add(c.id);
  }
  const pairs = Array.isArray(b.correctPairs) ? b.correctPairs : null;
  if (!pairs || !pairs.length) return "matching needs correctPairs";
  const paired = new Set();
  for (const pair of pairs) {
    if (!pair || !promptIds.has(pair.prompt))
      return `correctPairs references unknown prompt "${pair && pair.prompt}"`;
    if (!choiceIds.has(pair.choice))
      return `correctPairs references unknown choice "${pair && pair.choice}"`;
    if (paired.has(pair.prompt)) return `prompt "${pair.prompt}" has more than one correct pair`;
    paired.add(pair.prompt);
  }
  return null;
}

// One native <select> per prompt (keyboard + AT for free, no drag — SC 2.5.7).
// Options are the choices, detagged because <option> cannot hold markup; a
// "Choose…" placeholder is the empty default. Distractor choices are allowed.
function renderMatching(q) {
  const id = escapeXML(q.id);
  const choiceOptions = q.body.choices
    .map((c) => `<option value="${escapeXML(c.id)}">${escapeXML(detag(c.content))}</option>`)
    .join("");
  const rows = q.body.prompts
    .map((p) => {
      const selectId = `${id}-${escapeXML(p.id)}`;
      return (
        `<div class="quiz-match-row">` +
        `<label for="${selectId}">${inlineRich(p.content)}</label>` +
        `<select class="quiz-match-select" id="${selectId}" data-prompt="${escapeXML(p.id)}" data-part="${escapeXML(p.id)}">` +
        `<option value="">Choose…</option>${choiceOptions}</select>` +
        `</div>`
      );
    })
    .join("\n");
  // Visible <label for> stays (its text is visible, so no double-read); the
  // fieldset groups the rows as one answer with the stem in the legend.
  return entryFieldset(q, "quiz-match-group", `<div class="quiz-match">\n${rows}\n</div>`);
}

// --- Select-in-text --------------------------------------------------------
function validateSelectInText(q) {
  const b = q.body || {};
  const tpl = b.template && typeof b.template.html === "string" ? b.template.html : null;
  if (tpl == null) return "select-in-text needs a template.html string";
  const selects = Array.isArray(b.selects) ? b.selects : null;
  if (!selects || !selects.length) return "select-in-text needs at least one select";
  const ids = new Set();
  for (const sel of selects) {
    if (!sel || typeof sel.id !== "string") return "every select needs a string id";
    if (ids.has(sel.id)) return `duplicate select id "${sel.id}"`;
    ids.add(sel.id);
    const err = validateOptionList(sel.options, `select "${sel.id}"`);
    if (err) return err;
    const correct = sel.options.filter((o) => o.correct === true);
    if (correct.length !== 1) return `select "${sel.id}" needs exactly one correct option`;
    if (tpl.indexOf(`{{select:${sel.id}}}`) === -1)
      return `select "${sel.id}" has no matching {{select:${sel.id}}} token`;
  }
  const tokenRe = /\{\{select:([^}]+)\}\}/g;
  let m;
  while ((m = tokenRe.exec(tpl))) {
    if (!ids.has(m[1])) return `template references unknown select "${m[1]}"`;
  }
  return null;
}

// Replace each {{select:id}} token with a labelled native <select> (options
// detagged). Labels are visually hidden where the sentence names the field.
function renderSelectInText(q) {
  const id = escapeXML(q.id);
  let tpl = String(q.body.template.html || "");
  q.body.selects.forEach((sel) => {
    const sid = escapeXML(sel.id);
    const selectId = `${id}-${sid}`;
    const label = escapeXML(String(sel.label || sel.id));
    const options = sel.options
      .map((o) => `<option value="${escapeXML(o.id)}">${escapeXML(detag(o.content))}</option>`)
      .join("");
    // aria-label (not an inline hidden <label>) to avoid the double-read.
    const field =
      `<select class="quiz-inline-select" id="${selectId}" data-select="${sid}" data-part="${sid}" aria-label="${label}">` +
      `<option value="">Choose…</option>${options}</select>`;
    tpl = tpl.replace(`{{select:${sel.id}}}`, () => field);
  });
  return entryFieldset(q, "quiz-entry-group", `<p class="quiz-entry">${tpl}</p>`);
}

// --- Dispatch tables -------------------------------------------------------
// A type is supported iff it appears in RENDERERS. Each renderer returns the
// question BODY html (the fieldset/list/inputs); the section wrapper, Check
// button, feedback region and answers block in renderQuestion stay type-agnostic.
// Each validator returns an error string or null (envelope checks live in
// validate()). Add a type by registering it in both tables.
const RENDERERS = {
  "multiple-choice": (q) => renderChoiceGroup(q, "radio"),
  "true-false": (q) => renderTrueFalse(q),
  "multiple-answer": (q) => renderMultipleAnswer(q),
  "likert": (q) => renderChoiceGroup(q, "radio"),
  "fill-in-the-blank": (q) => renderFillIn(q),
  "numeric": (q) => renderNumeric(q),
  "ordering": (q) => renderOrdering(q),
  "matching": (q) => renderMatching(q),
  "select-in-text": (q) => renderSelectInText(q),
};

const VALIDATORS = {
  "multiple-choice": validateMultipleChoice,
  "true-false": validateTrueFalse,
  "multiple-answer": validateMultipleAnswer,
  "likert": validateLikert,
  "fill-in-the-blank": validateFillIn,
  "numeric": validateNumeric,
  "ordering": validateOrdering,
  "matching": validateMatching,
  "select-in-text": validateSelectInText,
};

// Choice-family types shuffle their option DISPLAY order at runtime when the
// author opts in (data-quiz-shuffle). Ordering is always shuffled (not listed).
const SHUFFLE_TYPES = new Set(["multiple-choice", "multiple-answer", "likert", "true-false"]);

// Render one validated question to its full section markup + answers block.
// `number` is the question's 1-based position among rendered questions; it names
// a per-question heading that enters the outline/TOC (processHeadings picks up
// the <h2> and keeps its id) so learners can jump between questions.
function renderQuestion(q, number) {
  const id = escapeXML(q.id);
  const body = RENDERERS[q.type](q);
  const answers = toInlineJson(q);

  // Opt-in per question: the runtime shuffles the option DISPLAY order on load.
  // Kept as a flag (not a build-time shuffle) so buildHtml stays deterministic.
  // Authors set shuffle:false where order carries meaning (e.g. "all of the
  // above"). Only meaningful for choice-family types; ordering always shuffles.
  const shuffleAttr =
    q.shuffle === true && SHUFFLE_TYPES.has(q.type) ? ` data-quiz-shuffle="true"` : "";

  // No aria-labelledby on the section: a named <section> is a region landmark, and
  // one per question floods the rotor. The "Question N" <h2> gives heading-level
  // navigation instead; the prompt (legend/stem) names each control group.
  return (
    `<section class="quiz-question" data-quiz-question-root="${id}"${shuffleAttr}>\n` +
    `<h2 class="quiz-question-heading" id="${id}-heading">Question ${number}</h2>\n` +
    `${body}\n` +
    `<div class="quiz-actions">` +
    `<button type="button" class="quiz-check" data-quiz-check="${id}">${CHECK_ICON}Check answer</button>` +
    `</div>\n` +
    `<div class="quiz-feedback" data-quiz-feedback="${id}" role="status" aria-live="polite"></div>\n` +
    `<script type="application/json" data-quiz-answers="${id}">${answers}</script>\n` +
    `</section>`
  );
}

/**
 * Replace every inline quiz-question block in an HTML string with rendered,
 * accessible question markup. Blocks that fail to parse/validate become an
 * HTML comment so nothing broken renders to a learner.
 *
 * @param {string} html
 * @param {object} [options]
 * @param {(message: string) => void} [options.onWarning] - called for each
 *   warning (skipped blocks and soft authoring warnings) so a host can surface
 *   authoring gaps loudly, mirroring onLongDescriptionWarning.
 * @returns {{ html: string, count: number, warnings: string[] }}
 */
export function processQuiz(html, options = {}) {
  const warnings = [];
  const emit = (message) => {
    warnings.push(message);
    if (typeof options.onWarning === "function") options.onWarning(message);
  };
  let count = 0;

  const out = String(html).replace(QUIZ_BLOCK, (full, jsonText) => {
    let q;
    try {
      q = JSON.parse(jsonText.trim());
    } catch (e) {
      emit(`quiz: could not parse a question block (${e.message})`);
      return `<!-- quiz: skipped unparseable question block -->`;
    }
    const err = validate(q);
    if (err) {
      emit(`quiz: skipped question "${q && q.id ? q.id : "?"}" — ${err}`);
      return `<!-- quiz: skipped question (${escapeXML(err)}) -->`;
    }
    count += 1;
    softWarnings(q).forEach(emit);
    return renderQuestion(q, count);
  });

  return { html: out, count, warnings };
}

// Cheap early-out probe so buildHtml can skip the work when no quiz is present.
export function hasQuizBlock(html) {
  return /data-quiz-question\b/i.test(String(html));
}
