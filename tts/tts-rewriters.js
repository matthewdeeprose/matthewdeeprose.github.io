/**
 * TTS Rewriters — Stage 2 + Stage 3
 *
 * Shared per-element rewriter helpers for TTS panels. Each rewriter operates
 * on a clone of the rendered output (never the live DOM) and produces a
 * speech-friendly stand-in that TTSSemantic.linearise can read coherently.
 *
 * Stage 2 shipped the table rewriter. Stage 3 promoted the math-speech
 * extractor (sreSpeechFor) and the panel-prepare orchestrator
 * (preparePanelForTts) — both previously duplicated across consumers — into
 * this module. Stage X added the chemistry SMILES rewriter. Stage Y.2b adds
 * the code-block summary rewriter and its localStorage-backed mode
 * preference. Future stages add diagram, block-quote, definition-list, and
 * figure rewriters here.
 *
 * Public API:
 *   window.TTSRewriters.rewriteTableForTts(tableEl, opts)
 *     → returns a replacement <div> wrapping a <p> with header-aware speech
 *       text, or null when the table is empty / has no rows / exceeds the
 *       soft cap. Callers do: `if (replacement) table.replaceWith(replacement)`.
 *
 *   window.TTSRewriters.rewriteChemistryForTts(rootEl, opts)
 *     → in-place: replaces each `.smiles-inline[role="img"][aria-label]`
 *       descendant of `rootEl` with a synthetic <span> containing the
 *       aria-label as text. Lets TTSSemantic.linearise read the descriptive
 *       chemistry label that `addChemistryAltText` already sets, instead of
 *       walking the SMILES SVG geometry (which produces gibberish). Selector
 *       is narrow to avoid colliding with emoji shortcode spans, markdown
 *       task-list status spans, and other role="img" sites in the codebase.
 *
 *   window.TTSRewriters.rewriteCodeBlockForTts(preEl, opts)
 *     → replaces a `<pre><code>` block in the clone with a synthetic `<p>`
 *       carrying a speech-friendly announcement. Three modes, selectable via
 *       `opts.mode` or the persisted `tts-code-mode` localStorage preference
 *       (default `'summary-with-first-line'`):
 *         verbatim — "Code block in Javascript. <full body>" (pre-Y.2b
 *                    behaviour, matches `lineariseCodeBlock` output).
 *         summary  — "Code block in Javascript with N lines."
 *         summary-with-first-line — adds " First line: <first non-blank line>"
 *                    to the summary form. Degrades to summary for blocks
 *                    longer than LONG_CODE_THRESHOLD lines. First line is
 *                    capped at FIRST_LINE_MAX_CHARS for very long single
 *                    lines (e.g. wide import statements).
 *       Returns the replacement `<p>`, or null if `<pre>` lacks a `<code>`
 *       child (the lineariser's `lineariseCodeBlock` then handles it as the
 *       plain-text fallback path).
 *
 *   window.TTSRewriters.getCodeMode()
 *     → reads the persisted code-block reading mode; validates and falls back
 *       to the default if storage holds an unrecognised value.
 *
 *   window.TTSRewriters.setCodeMode(mode)
 *     → validates and writes the code-block mode preference. Invalid modes
 *       are ignored with a console warning. Voice Settings UI calls this on
 *       dropdown change.
 *
 *   window.TTSRewriters.sreSpeechFor(el, sre)
 *     → runs SRE.toSpeech on the first <math> descendant of `el` and returns
 *       Clearspeak text, or null if `el`/`sre` is falsy, no <math> child
 *       exists, or SRE throws. Stage 3 promotion from Image Describer's
 *       IIFE-private helper (avoids the third duplication for Local Chat).
 *
 *   window.TTSRewriters.preparePanelForTts(rootEl)
 *     → async. Clones `rootEl`, awaits `window.TTSSreLoader.loadSRE()`, runs
 *       the math pass (CDN wrappers + bare mjx-containers), runs the table
 *       pass, returns the mutated clone. On SRE-load failure resolves with
 *       the clone unchanged (formulas keep existing aria-labels). Stage 3
 *       promotion from the duplicated prepare-pipeline in tts-read-aloud.js
 *       so Local Chat can call the shared helper rather than copying ~30 LOC
 *       of orchestration. The same shape will accept future rewriter passes
 *       (diagrams in Stage 5, etc.) without each consumer needing to know
 *       what's been added.
 *
 * Order in the prepare pipeline: math passes first (so cells contain
 * synthetic <mjx-container aria-label="…"> placeholders that the cell
 * extractor can substitute), then this table pass, then any future
 * container rewriters.
 *
 * Soft cap: tables with more than SOFT_CAP_CELLS cells return null so the
 * caller leaves the original <table> in place for TTSSemantic.lineariseTable
 * to handle row-by-row. Very large tables produce unwieldy paragraphs no
 * matter the format; the row-by-row format is the lesser evil there.
 *
 * @author Matthew Deeprose
 */
const TTSRewriters = (function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
      console.error("[TTSRewriters]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TTSRewriters]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TTSRewriters]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TTSRewriters]", message, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const SOFT_CAP_CELLS = 50;

  // Stage Y.2b — code-block summary mode
  const STORAGE_KEY_CODE_MODE = "tts-code-mode";
  const DEFAULT_CODE_MODE = "summary-with-first-line";
  const VALID_CODE_MODES = ["verbatim", "summary", "summary-with-first-line"];
  // Blocks longer than this drop the "First line: …" clause in
  // summary-with-first-line mode (degrades to summary). Mirrors the table
  // SOFT_CAP_CELLS soft-cap intuition: at some size the extra detail is
  // noise, not signal.
  const LONG_CODE_THRESHOLD = 50;
  // Safety net for pathological one-line first lines (e.g. wide imports,
  // long license headers on a single line). Beyond this length, the first
  // line is truncated with an ellipsis.
  const FIRST_LINE_MAX_CHARS = 200;

  // ==========================================================================
  // CELL EXTRACTOR (private)
  // ==========================================================================

  /**
   * Extract speakable text from a table cell. If the cell contains math
   * elements (already SRE-processed by the math pass above), substitute
   * their aria-labels for the otherwise-empty SVG textContent. Falls back
   * to plain textContent for cells with no math.
   *
   * Private — exposed only via rewriteTableForTts. Mirrors Stage 1's
   * decision to keep sreSpeechFor IIFE-private.
   */
  function extractCellSpeech(cell) {
    if (!cell) return "";
    const hasMath = !!cell.querySelector("mjx-container[aria-label]");
    if (!hasMath) {
      return (cell.textContent || "").replace(/\s+/g, " ").trim();
    }
    // Clone the cell so we can mutate it without affecting the parent tree.
    const cellClone = cell.cloneNode(true);
    cellClone
      .querySelectorAll("mjx-container[aria-label]")
      .forEach((el) => {
        el.replaceWith(
          document.createTextNode(" " + el.getAttribute("aria-label") + " "),
        );
      });
    return (cellClone.textContent || "").replace(/\s+/g, " ").trim();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Build a header-aware speech paragraph for a table and return a `<div>`
   * suitable for replacing the original `<table>` in the cloned tree.
   * Returns null when the table is empty, has no rows, or exceeds the soft
   * cap (in which case TTSSemantic.lineariseTable handles it).
   *
   * Header detection (in priority order):
   *   1. <thead><tr> — semantic table.
   *   2. First row contains any <th> — partial semantic markup.
   *   3. Otherwise the first row is treated as headers heuristically. This
   *      is the MathPix-CDN signature: the renderer emits all cells as <td>
   *      regardless of role.
   *
   * @param {HTMLTableElement} table - table inside a clone (never the live DOM)
   * @param {Object} [opts] - reserved for future verbosity tiers; ignored
   * @returns {HTMLDivElement|null}
   */
  function rewriteTableForTts(table, opts) {
    if (!table) return null;

    const allRows = Array.from(table.querySelectorAll("tr"));
    if (allRows.length === 0) return null;

    let headerCells, dataRows;
    const theadRow = table.querySelector("thead tr");
    if (theadRow) {
      headerCells = Array.from(theadRow.querySelectorAll("th, td"));
      const tbody = table.querySelector("tbody");
      dataRows = tbody
        ? Array.from(tbody.querySelectorAll("tr"))
        : allRows.filter((r) => !theadRow.contains(r) && r !== theadRow);
    } else {
      const firstRowThs = allRows[0].querySelectorAll("th");
      if (firstRowThs.length > 0) {
        headerCells = Array.from(firstRowThs);
        dataRows = allRows.slice(1);
      } else {
        headerCells = Array.from(allRows[0].querySelectorAll("td"));
        dataRows = allRows.slice(1);
      }
    }

    const totalCells =
      headerCells.length +
      dataRows.reduce(
        (acc, r) => acc + r.querySelectorAll("td, th").length,
        0,
      );
    if (totalCells === 0) return null;
    if (totalCells > SOFT_CAP_CELLS) {
      logDebug(
        "Table exceeds soft cap (" +
          totalCells +
          " cells) — falling back to TTSSemantic.lineariseTable",
      );
      return null;
    }

    const headerLabels = headerCells.map((h) => extractCellSpeech(h));
    const colCount = headerLabels.length;
    const rowCount = dataRows.length;

    const sentences = [];
    // Prefix each header with its column position, so the listener can map
    // a cell to a column without having to count headers in real time.
    const headerWithPos = headerLabels.map((h, i) =>
      h ? "Column " + (i + 1) + " " + h : "Column " + (i + 1),
    );

    if (rowCount === 0 && colCount > 0) {
      sentences.push(
        "Table with " + colCount + " column" + (colCount === 1 ? "" : "s") + ".",
      );
      sentences.push("Headers: " + headerWithPos.join(", ") + ".");
    } else {
      sentences.push(
        "Table with " +
          colCount +
          " column" +
          (colCount === 1 ? "" : "s") +
          " and " +
          rowCount +
          " data row" +
          (rowCount === 1 ? "" : "s") +
          ".",
      );
      if (headerLabels.length > 0 && headerLabels.some((h) => h)) {
        sentences.push("Headers: " + headerWithPos.join(", ") + ".");
      }
      dataRows.forEach((tr, rowIdx) => {
        const cells = Array.from(tr.querySelectorAll("td, th"));
        const cellTexts = cells.map((c, colIdx) => {
          const value = extractCellSpeech(c);
          const header = headerLabels[colIdx];
          return header ? header + " " + value : value;
        });
        sentences.push("Row " + (rowIdx + 1) + ": " + cellTexts.join(", ") + ".");
      });
    }

    const wrapper = document.createElement("div");
    const p = document.createElement("p");
    p.textContent = sentences.join(" ");
    wrapper.appendChild(p);
    return wrapper;
  }

  // ==========================================================================
  // CHEMISTRY REWRITER (Stage X — Chemistry SMILES rewriter)
  // ==========================================================================

  /**
   * Replace each chemistry SMILES placeholder with a synthetic <span> carrying
   * the visible aria-label as text. Matches `.smiles-inline[role="img"][aria-label]`
   * — the exact shape `addChemistryAltText` (mathpix-result-renderer.js)
   * applies to CDN-rendered chemistry structures.
   *
   * Why this exists: TTSSemantic.linearise has no `role="img" + aria-label`
   * handler — it falls through to recursive child-walking, which on a SMILES
   * SVG produces gibberish (coordinate strings from `<path>` elements).
   * Replacing the wrapper with a plain <span> containing the label text lets
   * the existing inline walker pick it up cleanly.
   *
   * Why a <span> (not <mjx-container> or <img alt>):
   *   - <mjx-container> would trigger the lineariser's MathJax handler, which
   *     prefixes with "Mathematical expression." — wrong for chemistry.
   *   - <img alt> would announce "Image: …" — a prefix the visible aria-label
   *     deliberately omits.
   *   - A <span> needs no special lineariser handling and produces no unwanted
   *     prefix or synthetic-shape collision with math or future Stage 5 diagrams.
   *
   * Selector scope is narrow on purpose:
   *   `.smiles-inline[role="img"][aria-label], .smiles[role="img"][aria-label]`
   * matches MathPix CDN-rendered chemistry specifically. `.smiles-inline` is
   * the wrapper for <smiles>...</smiles> HTML tags; `.smiles` is the wrapper
   * for ```smiles\n...\n``` Markdown code-fences (Stage Y.2a added the second
   * form when Convert mode revealed the library emits a different class for
   * the fence path). Generic `[role="img"][aria-label]` handling was
   * considered and rejected — it would affect emoji shortcode spans
   * (results-manager-content-emoji.js) and markdown task-list status spans
   * (markdown-editor.js), causing emoji label changes and task-list audible
   * duplication respectively. See Stage X and Stage Y.1/Y.2a lessons in
   * tts/docs/semantic-tts-plan.md.
   *
   * Image Describer and Local Chat contain no `.smiles-inline` today, so this
   * pass is a graceful no-op there. If chemistry rendering is ever added to
   * chat, the pass will work automatically.
   *
   * Order in preparePanelForTts: math first, then chemistry, then tables —
   * chemistry runs before tables so a SMILES inside a <td> resolves to the
   * label text by the time extractCellSpeech reads the cell.
   *
   * @param {Element} rootEl - clone-resident root element. Mutated in place.
   * @param {Object} [opts] - reserved for future verbosity tiers; ignored.
   */
  function rewriteChemistryForTts(rootEl, opts) {
    if (!rootEl) return;
    // Match both wrapper shapes the mathpix-markdown-it library produces:
    //   .smiles-inline — from <smiles>...</smiles> HTML tags
    //   .smiles        — from ```smiles\n...\n``` Markdown code-fences
    // Both need the role + aria-label step from addChemistryAltText (API path)
    // or applyAriaLabelsToSmilesInline (Convert/upload path).
    const targets = rootEl.querySelectorAll(
      '.smiles-inline[role="img"][aria-label], .smiles[role="img"][aria-label]',
    );
    if (targets.length === 0) return;
    targets.forEach(function (el) {
      const label = el.getAttribute("aria-label");
      if (!label || !label.trim()) return;
      const placeholder = document.createElement("span");
      placeholder.textContent = label.trim();
      el.replaceWith(placeholder);
    });
    logDebug(
      "rewriteChemistryForTts replaced " +
        targets.length +
        " SMILES element(s)",
    );
  }

  // ==========================================================================
  // CODE BLOCK REWRITER (Stage Y.2b — code-block summary mode)
  // ==========================================================================

  /**
   * Read the persisted code-block reading mode preference. Returns one of
   * the three valid modes; falls back to DEFAULT_CODE_MODE if storage holds
   * an unrecognised value or localStorage is unreadable.
   *
   * @returns {string}
   */
  function getCodeMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CODE_MODE);
      if (VALID_CODE_MODES.indexOf(stored) !== -1) return stored;
    } catch (e) {
      logWarn("Could not read localStorage tts-code-mode:", e);
    }
    return DEFAULT_CODE_MODE;
  }

  /**
   * Write the code-block reading mode preference. Invalid modes are ignored
   * with a console warning so a future caller that gets the value wrong
   * surfaces the bug rather than silently corrupting the stored preference.
   *
   * @param {string} mode - one of VALID_CODE_MODES
   */
  function setCodeMode(mode) {
    if (VALID_CODE_MODES.indexOf(mode) === -1) {
      logWarn('setCodeMode: invalid mode "' + mode + '" — ignored');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_CODE_MODE, mode);
      logInfo("Code mode set to", mode);
    } catch (e) {
      logWarn("Could not write localStorage tts-code-mode:", e);
    }
  }

  /**
   * Extract the language name from a `<code>` element's class list, matching
   * the patterns `language-X`, `lang-X`, and any combination with `hljs`
   * (which is what `mathpix-markdown-it` and most markdown-it highlighting
   * plugins emit). Returns the language with its first letter capitalised
   * to match the existing TTSSemantic.lineariseCodeBlock output ("Javascript",
   * "Python", "C"). Returns null if no language class is found.
   *
   * Private — exposed only via rewriteCodeBlockForTts.
   *
   * @param {Element} codeEl
   * @returns {string|null}
   */
  function extractCodeLanguage(codeEl) {
    if (!codeEl || !codeEl.className || typeof codeEl.className !== "string") {
      return null;
    }
    const m = codeEl.className.match(/\b(?:language|lang)-([\w+#-]+)/);
    if (!m) return null;
    const lang = m[1];
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  /**
   * Return the first non-blank line of `text`, trimmed and capped at
   * FIRST_LINE_MAX_CHARS. Returns null if every line is blank (or the text
   * is empty). No comment/shebang stripping — a comment is often the most
   * informative line of a block (file-level docstring, function purpose).
   *
   * Private — exposed only via rewriteCodeBlockForTts.
   *
   * @param {string} text
   * @returns {string|null}
   */
  function getFirstNonBlankLine(text) {
    if (!text) return null;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed) {
        if (trimmed.length > FIRST_LINE_MAX_CHARS) {
          return trimmed.slice(0, FIRST_LINE_MAX_CHARS) + "…";
        }
        return trimmed;
      }
    }
    return null;
  }

  /**
   * Replace a `<pre><code>` code block in the clone with a synthetic `<p>`
   * carrying a speech-friendly announcement.
   *
   * Reading code verbatim aloud — the pre-Y.2b default behaviour inherited
   * from TTSSemantic.lineariseCodeBlock — leaks every `=>`, `;`, `${name}`,
   * `i++` as spoken punctuation, which is almost never useful audibly. The
   * audit captured in tts/docs/mmd-tts-audit.md confirms both fenced
   * (```` ```js ````) and LaTeX-listing (`\begin{lstlisting}`) code blocks
   * suffer this. Y.2b adds three modes; default is `summary-with-first-line`.
   *
   * Modes (resolved from `opts.mode` then `getCodeMode()`):
   *   verbatim — "Code block in Javascript. const greet = (name) => …"
   *              Identical to TTSSemantic.lineariseCodeBlock today.
   *   summary  — "Code block in Javascript with 2 lines."
   *   summary-with-first-line —
   *              "Code block in Javascript with 2 lines. First line: …"
   *              Drops the first-line clause for blocks longer than
   *              LONG_CODE_THRESHOLD lines (degrades to summary).
   *
   * Edge cases:
   *   - Empty block (no body) → "Empty code block in X." (or "Empty code
   *     block." when language is unknown).
   *   - 1 line → singular "with 1 line." not "with 1 lines."
   *   - No `<code>` child → return null. The caller leaves the original
   *     `<pre>` in place and TTSSemantic.lineariseCodeBlock handles it as
   *     plain-text fallback. (Plain `<pre>` for verse / ASCII art is rare in
   *     the panels this runs against, but the fallback path keeps us safe.)
   *
   * Selector strategy — match `<pre>` programmatically and require a `<code>`
   * descendant before rewriting (option ii of Stage Y.2b ambiguity A). This
   * mirrors the lineariser's own `preEl.querySelector('code')` predicate and
   * avoids matching prose `<pre>` that lacks an inner `<code>`. Language is
   * extracted best-effort from the `<code>` class via `language-X` or
   * `lang-X`, with or without an `hljs` prefix.
   *
   * Verbosity composition — code mode is orthogonal to TTSSemantic verbosity.
   * Brief + summary code = Standard + summary code = "Code block in X with N
   * lines." Verbatim mode + any verbosity emits the verbatim body. The
   * rewriter does not read the verbosity preference.
   *
   * @param {HTMLPreElement} preEl - <pre> inside a clone (never the live DOM)
   * @param {Object} [opts]
   * @param {string} [opts.mode] - override the persisted preference
   * @returns {HTMLParagraphElement|null}
   */
  function rewriteCodeBlockForTts(preEl, opts) {
    if (!preEl) return null;
    const codeEl = preEl.querySelector("code");
    if (!codeEl) return null;

    const mode =
      opts && opts.mode && VALID_CODE_MODES.indexOf(opts.mode) !== -1
        ? opts.mode
        : getCodeMode();

    const language = extractCodeLanguage(codeEl);
    const rawText = codeEl.textContent || "";

    // Trim trailing blank lines so the line count reflects content lines, not
    // the trailing newline most code-fence renderers append.
    const lines = rawText.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    const lineCount = lines.length;

    let announcement;
    if (lineCount === 0) {
      announcement = language
        ? "Empty code block in " + language + "."
        : "Empty code block.";
    } else if (mode === "verbatim") {
      const prefix = language
        ? "Code block in " + language + "."
        : "Code block.";
      const body = rawText.replace(/\s+/g, " ").trim();
      announcement = body ? prefix + " " + body : prefix;
    } else {
      const linesWord = lineCount === 1 ? "line" : "lines";
      const prefix = language
        ? "Code block in " +
          language +
          " with " +
          lineCount +
          " " +
          linesWord +
          "."
        : "Code block with " + lineCount + " " + linesWord + ".";

      if (
        mode === "summary-with-first-line" &&
        lineCount <= LONG_CODE_THRESHOLD
      ) {
        const firstLine = getFirstNonBlankLine(rawText);
        announcement = firstLine ? prefix + " First line: " + firstLine : prefix;
      } else {
        announcement = prefix;
      }
    }

    const replacement = document.createElement("p");
    replacement.textContent = announcement;
    preEl.replaceWith(replacement);
    logDebug(
      "rewriteCodeBlockForTts: mode=" +
        mode +
        ", language=" +
        (language || "none") +
        ", lines=" +
        lineCount,
    );
    return replacement;
  }

  // ==========================================================================
  // MATH SPEECH EXTRACTOR (Stage 3 promotion from Image Describer + Local Chat)
  // ==========================================================================

  /**
   * Run SRE.toSpeech on the first <math> descendant of `el` and return the
   * Clearspeak text. Returns null when SRE is unavailable, no <math> is found,
   * or the call throws. Stage 3 promoted this from Image Describer's
   * IIFE-private duplicate; Local Chat is the third would-be consumer and is
   * the trigger for promotion.
   *
   * @param {Element} el - element that contains a <math> descendant (typically
   *   a <mjx-container> or a [role="math"] wrapper).
   * @param {Object} sre - the resolved SRE engine from TTSSreLoader.loadSRE().
   * @returns {string|null}
   */
  function sreSpeechFor(el, sre) {
    if (!sre || !el) return null;
    const mathEl = el.querySelector("math");
    if (!mathEl) return null;
    try {
      const speech = sre.toSpeech(mathEl.outerHTML);
      return speech && typeof speech === "string" ? speech.trim() : null;
    } catch (err) {
      logWarn("SRE.toSpeech failed for formula — using fallback", err);
      return null;
    }
  }

  // ==========================================================================
  // PANEL PREPARE ORCHESTRATOR (Stage 3 promotion)
  // ==========================================================================

  /**
   * Clone `rootEl`, await SRE, run the math pass (both `[role="math"]` CDN
   * wrappers and bare `<mjx-container>` elements) followed by the table pass,
   * and return the mutated clone. The live DOM is never touched.
   *
   * On SRE-load failure this resolves with the clone unchanged so the
   * lineariser still produces intelligible audio (formulas keep their
   * existing aria-labels, tables still go through the table rewriter — the
   * table rewriter does not need SRE).
   *
   * Order is fixed: math passes first so cells with formulas carry synthetic
   * `<mjx-container aria-label="…">` placeholders that `extractCellSpeech`
   * (inside rewriteTableForTts) substitutes when reading rows.
   *
   * Stage 5 will add a diagram pass here. Consumers will not need to change.
   *
   * @param {Element} rootEl - the panel root (`#imgdesc-output`, a
   *   `.local-chat-bubble`, etc.). Must be a live DOM element; the clone is
   *   made internally.
   * @returns {Promise<Element|null>} the mutated clone, or null if `rootEl`
   *   is falsy.
   */
  function preparePanelForTts(rootEl) {
    if (!rootEl) return Promise.resolve(null);
    const clone = rootEl.cloneNode(true);

    return Promise.resolve()
      .then(function () {
        if (
          !window.TTSSreLoader ||
          typeof window.TTSSreLoader.loadSRE !== "function"
        ) {
          return null;
        }
        return window.TTSSreLoader.loadSRE().catch(function (err) {
          logWarn(
            "SRE unavailable — falling back to existing aria-labels for TTS",
            err,
          );
          return null;
        });
      })
      .then(function (sre) {
        // Path 2 (CDN wrappers): `<span role="math" aria-label="…">` around
        // hidden source-format tags plus a rendered <mjx-container>. Replace
        // each wrapper with a synthetic mjx-container so the lineariser
        // treats it atomically with our Clearspeak label.
        const cdnWrappers = clone.querySelectorAll('[role="math"][aria-label]');
        cdnWrappers.forEach(function (wrapper) {
          const speech =
            sreSpeechFor(wrapper, sre) || wrapper.getAttribute("aria-label");
          if (!speech || !speech.trim()) return;
          const placeholder = document.createElement("mjx-container");
          placeholder.setAttribute("aria-label", speech);
          wrapper.replaceWith(placeholder);
        });

        // Path 1 (MathJax fallback): bare <mjx-container> with no role="math"
        // wrapper. Default aria-labels there come from the bundled MathJax SRE
        // and are MathSpeak — overwrite with Clearspeak.
        const mjxContainers = clone.querySelectorAll("mjx-container");
        mjxContainers.forEach(function (mjx) {
          if (mjx.getAttribute("data-mathpix-enhanced") === "duplicate") return;
          const speech = sreSpeechFor(mjx, sre);
          if (!speech || !speech.trim()) return;
          mjx.setAttribute("aria-label", speech);
        });

        // Chemistry: replace `.smiles-inline[role="img"][aria-label]` with a
        // synthetic <span> containing the visible aria-label as text. Runs
        // before the table pass so a SMILES inside a <td> resolves to label
        // text in time for extractCellSpeech. No-op for panels with no
        // chemistry (Image Describer, Local Chat).
        rewriteChemistryForTts(clone);

        // Code blocks (Stage Y.2b): replace `<pre><code>` with a synthetic
        // `<p>` carrying a speech-friendly announcement (default
        // summary-with-first-line). Runs before the table pass so a code
        // block inside a `<td>` resolves to its paragraph text in time for
        // extractCellSpeech. `<pre>` elements with no `<code>` descendant
        // are left in place and TTSSemantic.lineariseCodeBlock handles them.
        const preEls = clone.querySelectorAll("pre");
        preEls.forEach(function (preEl) {
          rewriteCodeBlockForTts(preEl);
        });

        // Single-content code paragraphs (Stage Y.2b follow-up): paragraphs
        // whose only child is a `<code>` element with no surrounding prose.
        // Markdown wraps single-backtick inline code in `<p><code>…</code></p>`
        // when it's the entire content of an answer (common in Local Chat
        // short-answer responses like a one-line bash command). Real inline
        // code intermixed with prose ("Use the `git status` command") has
        // text around the `<code>` and the equality predicate below excludes
        // it — so true inline references stay inline.
        const codeParagraphs = clone.querySelectorAll("p");
        codeParagraphs.forEach(function (pEl) {
          if (pEl.children.length !== 1) return;
          const codeChild = pEl.children[0];
          if (!codeChild || codeChild.tagName !== "CODE") return;
          const pText = (pEl.textContent || "").trim();
          const codeText = (codeChild.textContent || "").trim();
          if (!codeText || pText !== codeText) return;
          // Wrap the <code> in a synthetic <pre> so the existing rewriter
          // produces a consistent announcement, then replace the <p> with
          // the resulting paragraph.
          const synthPre = document.createElement("pre");
          synthPre.appendChild(codeChild.cloneNode(true));
          const replacement = rewriteCodeBlockForTts(synthPre);
          if (replacement) pEl.replaceWith(replacement);
        });

        // Tables: math + chemistry + code passes first (above) so cells with
        // formulas, chemistry structures, or code blocks carry their speech
        // text (synthetic mjx aria-labels, rewritten chemistry spans, and
        // code-summary paragraphs respectively) by the time extractCellSpeech
        // reads them. rewriteTableForTts returns a replacement <div> or null
        // (soft-cap fallback / empty table) — leave the original <table> in
        // place when null so TTSSemantic.lineariseTable can handle it
        // row-by-row.
        const tables = clone.querySelectorAll("table");
        tables.forEach(function (table) {
          const replacement = rewriteTableForTts(table);
          if (replacement) table.replaceWith(replacement);
        });

        return clone;
      });
  }

  return {
    rewriteTableForTts: rewriteTableForTts,
    rewriteChemistryForTts: rewriteChemistryForTts,
    rewriteCodeBlockForTts: rewriteCodeBlockForTts,
    getCodeMode: getCodeMode,
    setCodeMode: setCodeMode,
    sreSpeechFor: sreSpeechFor,
    preparePanelForTts: preparePanelForTts,
  };
})();

window.TTSRewriters = TTSRewriters;
