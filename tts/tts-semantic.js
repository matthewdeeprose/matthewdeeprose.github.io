/**
 * TTS Semantic — S2: Core Lineariser
 *
 * Generic DOM-to-spoken-text lineariser that walks any HTML container and
 * returns text with screen-reader-style structural cues ("Heading level 2.",
 * "Bulleted list with 3 items.", "Table with 3 columns and 2 rows.").
 *
 * Exposes: window.TTSSemantic
 *
 * Public API:
 *   TTSSemantic.linearise(element, options)  — returns { text, sections }
 *   TTSSemantic.getVerbosity()               — returns 'on' or 'off'
 *   TTSSemantic.setVerbosity(v)              — stores 'on' or 'off'
 *
 * localStorage key: tts-semantic-verbosity ('on' | 'off', default 'on')
 *
 * @author Matthew Deeprose
 */
const TTSSemantic = (function () {
  'use strict';

  // Logging
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[TTSSemantic]', message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[TTSSemantic]', message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[TTSSemantic]', message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[TTSSemantic]', message, ...args);
  }

  // Constants
  const STORAGE_KEY = 'tts-semantic-verbosity';
  const DEFAULT_VERBOSITY = 'on';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'BR']);
  const BLOCK_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'PRE', 'DL', 'HR',
    'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'ASIDE',
    'FIGURE', 'FIGCAPTION', 'DETAILS', 'SUMMARY'
  ]);
  const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

  // ---- Verbosity persistence ------------------------------------------------

  function getVerbosity() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'on' || stored === 'off') return stored;
    } catch (e) {
      logWarn('Could not read localStorage:', e);
    }
    return DEFAULT_VERBOSITY;
  }

  function setVerbosity(v) {
    const value = (v === 'off') ? 'off' : 'on';
    try {
      localStorage.setItem(STORAGE_KEY, value);
      logInfo('Verbosity set to', value);
    } catch (e) {
      logWarn('Could not write localStorage:', e);
    }
  }

  // ---- Text utilities -------------------------------------------------------

  function normaliseText(str) {
    return str.replace(/\s+/g, ' ').trim();
  }

  function ensureFullStop(str) {
    const trimmed = str.trim();
    if (!trimmed) return '';
    if (/[.!?]$/.test(trimmed)) return trimmed;
    return trimmed + '.';
  }

  function joinParts(parts) {
    return parts
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length > 0; })
      .join(' ')
      .replace(/\.\s*\./g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---- Bare line breaks and question labels (RA-120, register 63, F1-B and F2-D) ------
  // The same two rules as an export's Read Aloud (scorm-builder source/templates/js/read-aloud.js), in the structure-on path only.
  // F1: a typed <br> whose text before it has no end punctuation . ! ? : ; , (or ends in an equation) says a comma, so the voice
  // pauses where the author broke the line. F2: "(a)" at the start of a section, after . ! ? : ; ] ), or after a comma F1 put in,
  // and before a capital, is said "Part a.". F1 marks its own comma with a private-use character so F2 can tell it from a comma
  // the author typed; every mark is stripped before the text leaves linearise(). Both act on a CLONE, never the live panel.
  const LINE_BREAK_MARK = '';
  const LINE_BREAK_COMMA = ',' + LINE_BREAK_MARK;
  // A comma F1 has just put in carries the mark, so two breaks in a row do not give two commas.
  const LINE_END_PUNCTUATION = new RegExp('[.!?:;,]' + LINE_BREAK_MARK + '?$');
  const LINE_BREAK_MARK_PATTERN = new RegExp(LINE_BREAK_MARK, 'g');
  const PART_LABEL_PATTERN = new RegExp('(^|[.!?:;\\])]\\s|,' + LINE_BREAK_MARK + '\\s)\\(([a-z])\\)\\s+(?=[A-Z])', 'g');

  // The last thing before a break, looking inside wrappers: { maths: true } for an equation, { node, text } for text, null for nothing.
  function lastLeafBefore(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      return node.data.trim() ? { maths: false, node: node, text: node.data.replace(/\s+/g, ' ').trim() } : null;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (isMathJax(node)) return { maths: true, node: null, text: '' };
    for (let child = node.lastChild; child; child = child.previousSibling) {
      const found = lastLeafBefore(child);
      if (found) return found;
    }
    return null;
  }

  // Is anything spoken after this break inside the clone? Text, an equation, or a picture (its "Image:" words are in the same section).
  function spokenAfterBreak(br, root) {
    for (let node = br; node && node !== root; node = node.parentNode) {
      for (let next = node.nextSibling; next; next = next.nextSibling) {
        if (next.nodeType === Node.TEXT_NODE && next.data.trim()) return true;
        if (next.nodeType !== Node.ELEMENT_NODE) continue;
        if (next.textContent.trim() || isMathJax(next) || next.tagName === 'IMG') return true;
        if (next.querySelector('mjx-container, .MathJax, img')) return true;
      }
    }
    return false;
  }

  // Put the comma in, on the clone, ahead of the <br>.
  function commaBeforeBreak(br, root) {
    if (!spokenAfterBreak(br, root)) return;
    let before = { maths: false, node: null, text: '' };
    for (let sibling = br.previousSibling; sibling; sibling = sibling.previousSibling) {
      const found = lastLeafBefore(sibling);
      if (found) { before = found; break; }
    }
    if (!before.maths && (!before.text || LINE_END_PUNCTUATION.test(before.text))) return;
    if (before.node) before.node.data = before.node.data.replace(/\s*$/, LINE_BREAK_COMMA + '$&');
    else br.before(document.createTextNode(LINE_BREAK_COMMA));
  }

  // F2 on a section's finished text; also strips F1's mark.
  function speakPartLabels(text) {
    return text.replace(PART_LABEL_PATTERN, function (match, lead, letter) {
      return lead + 'Part ' + letter + '. ';
    }).replace(LINE_BREAK_MARK_PATTERN, '');
  }

  // ---- Cue words (RA-122, register 69) ----------------------------------------
  // With "Announce structure" on, these are spoken in front of or after the content they describe. With it off, ONLY these are
  // dropped: the rest of the reading (line-break comma, "Part a.", full stops at block ends, spacing) is the same in both settings.
  // Every phrase in the spoken text that names a structure is built here, so this list is what "off" leaves out.
  const CUES = Object.freeze({
    headingLevel: function (level) { return 'Heading level ' + level + '. '; },
    listLead: function (isOrdered, total) { return (isOrdered ? 'Numbered' : 'Bulleted') + ' list with ' + total + ' items.'; },
    listItem: function (index, total) { return 'Item ' + index + ' of ' + total + ': '; },
    tableLead: function (columns, rows) { return 'Table with ' + columns + ' columns and ' + rows + ' rows.'; },
    columnHeading: 'Column heading: ',
    cell: function (row, column) { return 'Row ' + row + ', Column ' + column + ': '; },
    quoteStart: 'Quote. ',
    quoteEnd: ' End quote.',
    codeLead: function (language) { return language ? 'Code block in ' + language.charAt(0).toUpperCase() + language.slice(1) + '.' : 'Code block.'; },
    definitionLead: function (terms) { return 'Definition list with ' + terms + ' terms.'; },
    maths: 'Mathematical expression.',
    image: 'Image: ',
    imageNoAlt: 'Image.',
    link: ', link.'
  });

  // A cue's text when cues are on, and nothing when they are off.
  function cueText(cues, text) {
    return cues ? text : '';
  }

  function mathsText(node, cues) {
    const label = node.getAttribute('aria-label');
    if (!label) return cueText(cues, CUES.maths);
    return cueText(cues, CUES.maths + ' ') + ensureFullStop(label);
  }

  function imageText(node, cues) {
    const alt = node.getAttribute('alt');
    if (!alt) return cueText(cues, CUES.imageNoAlt);
    return cueText(cues, CUES.image) + ensureFullStop(alt);
  }

  function linkText(node, cues) {
    const text = normaliseText(node.textContent);
    return text ? text + cueText(cues, CUES.link) : '';
  }

  // ---- Element checks -------------------------------------------------------

  function shouldSkipElement(el, skipSelectors) {
    if (el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    if (el.hasAttribute('hidden')) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (skipSelectors && el.matches(skipSelectors)) return true;
    return false;
  }

  function isMathJax(el) {
    return el.nodeType === Node.ELEMENT_NODE &&
      (el.classList.contains('MathJax') || el.tagName === 'MJX-CONTAINER');
  }

  // ---- Table lineariser -----------------------------------------------------

  function lineariseTable(tableEl, cues) {
    const thead = tableEl.querySelector('thead');
    const tbody = tableEl.querySelector('tbody');
    const allRows = Array.from(tableEl.querySelectorAll('tr'));
    let headerCells = [];
    let bodyRows = [];

    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        headerCells = Array.from(headerRow.querySelectorAll('th, td'));
      }
      bodyRows = tbody
        ? Array.from(tbody.querySelectorAll('tr'))
        : allRows.filter(function (r) { return !thead.contains(r); });
    } else if (allRows.length > 0) {
      const firstRow = allRows[0];
      const ths = firstRow.querySelectorAll('th');
      if (ths.length > 0) {
        headerCells = Array.from(ths);
        bodyRows = allRows.slice(1);
      } else {
        bodyRows = allRows;
      }
    }

    const colCount = headerCells.length > 0
      ? headerCells.length
      : (allRows.length > 0 ? allRows[0].querySelectorAll('td, th').length : 0);
    const rowCount = bodyRows.length;
    const parts = [];
    parts.push(cueText(cues, CUES.tableLead(colCount, rowCount)));

    headerCells.forEach(function (th) {
      parts.push(cueText(cues, CUES.columnHeading) + ensureFullStop(normaliseText(th.textContent)));
    });

    bodyRows.forEach(function (tr, rowIdx) {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      cells.forEach(function (cell, colIdx) {
        parts.push(
          cueText(cues, CUES.cell(rowIdx + 1, colIdx + 1)) +
          ensureFullStop(normaliseText(cell.textContent))
        );
      });
    });
    return joinParts(parts);
  }

  // ---- Code block lineariser ------------------------------------------------

  function lineariseCodeBlock(preEl, cues) {
    const codeEl = preEl.querySelector('code');
    const parts = [];
    if (codeEl) {
      const langMatch = codeEl.className.match(/language-(\w+)/);
      const language = langMatch ? langMatch[1] : null;
      parts.push(cueText(cues, CUES.codeLead(language)));
      parts.push(normaliseText(codeEl.textContent));
    } else {
      parts.push(cueText(cues, CUES.codeLead(null)));
      parts.push(normaliseText(preEl.textContent));
    }
    return joinParts(parts);
  }

  // ---- Definition list lineariser -------------------------------------------

  function lineariseDefList(dlEl, cues) {
    const children = Array.from(dlEl.children);
    const termCount = children.filter(function (c) { return c.tagName === 'DT'; }).length;
    const parts = [];
    parts.push(cueText(cues, CUES.definitionLead(termCount)));
    let currentTerm = '';
    children.forEach(function (child) {
      if (child.tagName === 'DT') {
        currentTerm = normaliseText(child.textContent);
      } else if (child.tagName === 'DD') {
        const def = normaliseText(child.textContent);
        parts.push(ensureFullStop(currentTerm + ': ' + def));
      }
    });
    return joinParts(parts);
  }

  // ---- List lineariser ------------------------------------------------------

  function lineariseList(listEl, cues) {
    const isOrdered = listEl.tagName === 'OL';
    const items = Array.from(listEl.children).filter(function (c) {
      return c.tagName === 'LI';
    });
    const total = items.length;
    const parts = [];
    parts.push(cueText(cues, CUES.listLead(isOrdered, total)));
    items.forEach(function (li, idx) {
      const itemText = normaliseText(walkInlineContent(li, cues));
      parts.push(cueText(cues, CUES.listItem(idx + 1, total)) + ensureFullStop(itemText));
    });
    return joinParts(parts);
  }

  // ---- Inline content walker ------------------------------------------------

  function walkInlineContent(el, cues) {
    const parts = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normaliseText(node.textContent);
        if (text) parts.push(text);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (shouldSkipElement(node, null)) continue;

      if (isMathJax(node)) {
        parts.push(mathsText(node, cues));
        continue;
      }
      if (node.tagName === 'IMG') {
        parts.push(imageText(node, cues));
        continue;
      }
      if (node.tagName === 'A') {
        parts.push(linkText(node, cues));
        continue;
      }
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        parts.push(lineariseList(node, cues));
        continue;
      }
      parts.push(walkInlineContent(node, cues));
    }
    return joinParts(parts);
  }

  // ---- Main DOM walker ------------------------------------------------------

  function walkDOM(rootEl, skipSelectors, cues) {
    const sections = [];
    let currentText = '';
    let currentType = 'paragraph';
    let currentLevel = undefined;

    function pushCurrentSection() {
      const trimmed = currentText.trim();
      if (trimmed) {
        const section = { type: currentType, text: trimmed };
        if (currentLevel !== undefined) section.level = currentLevel;
        sections.push(section);
      }
      currentText = '';
      currentType = 'paragraph';
      currentLevel = undefined;
    }

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normaliseText(node.textContent);
        if (text) currentText = joinParts([currentText, text]);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (shouldSkipElement(node, skipSelectors)) return;

      const tag = node.tagName;

      // MathJax — atomic, could be inline or block
      if (isMathJax(node)) {
        const mathText = mathsText(node, cues);
        if (node.parentNode === rootEl) {
          pushCurrentSection();
          if (mathText.trim()) sections.push({ type: 'math', text: mathText });
        } else {
          currentText = joinParts([currentText, mathText]);
        }
        return;
      }

      // Headings
      if (HEADING_TAGS.has(tag)) {
        pushCurrentSection();
        const level = parseInt(tag.charAt(1), 10);
        let headingContent = normaliseText(walkInlineContent(node, cues));
        // Strip redundant manual numbering that matches the heading level
        // e.g. <h3>3. Long Description</h3> → avoid "Heading level 3. 3. Long Description"
        const manualNumberPattern = new RegExp('^' + level + '\\.\\s*');
        if (manualNumberPattern.test(headingContent)) {
          headingContent = headingContent.replace(manualNumberPattern, '');
        }
        currentType = 'heading';
        currentLevel = level;
        currentText = cueText(cues, CUES.headingLevel(level)) + ensureFullStop(headingContent);
        pushCurrentSection();
        return;
      }

      if (tag === 'UL' || tag === 'OL') {
        pushCurrentSection();
        sections.push({ type: 'list', text: lineariseList(node, cues) });
        return;
      }
      if (tag === 'TABLE') {
        pushCurrentSection();
        sections.push({ type: 'table', text: lineariseTable(node, cues) });
        return;
      }
      if (tag === 'BLOCKQUOTE') {
        pushCurrentSection();
        const quoteContent = normaliseText(walkInlineContent(node, cues));
        sections.push({
          type: 'blockquote',
          text: cueText(cues, CUES.quoteStart) + ensureFullStop(quoteContent) + cueText(cues, CUES.quoteEnd)
        });
        return;
      }
      if (tag === 'PRE') {
        pushCurrentSection();
        sections.push({ type: 'code', text: lineariseCodeBlock(node, cues) });
        return;
      }
      if (tag === 'DL') {
        pushCurrentSection();
        sections.push({ type: 'definition-list', text: lineariseDefList(node, cues) });
        return;
      }
      if (tag === 'HR') {
        pushCurrentSection();
        return;
      }
      if (tag === 'IMG') {
        currentText = joinParts([currentText, imageText(node, cues)]);
        return;
      }
      if (tag === 'A') {
        const linked = linkText(node, cues);
        if (linked) currentText = joinParts([currentText, linked]);
        return;
      }
      if (tag === 'P') {
        pushCurrentSection();
        const pContent = walkInlineContent(node, cues);
        if (pContent) {
          currentText = ensureFullStop(pContent);
          currentType = 'paragraph';
        }
        pushCurrentSection();
        return;
      }

      // Other block-level elements — recurse into children
      if (BLOCK_TAGS.has(tag)) {
        pushCurrentSection();
        for (let i = 0; i < node.childNodes.length; i++) {
          processNode(node.childNodes[i]);
        }
        pushCurrentSection();
        return;
      }

      // Inline elements — recurse
      for (let i = 0; i < node.childNodes.length; i++) {
        processNode(node.childNodes[i]);
      }
    }

    for (let i = 0; i < rootEl.childNodes.length; i++) {
      processNode(rootEl.childNodes[i]);
    }
    pushCurrentSection();
    return sections;
  }

  // ---- Public API -----------------------------------------------------------

  function linearise(element, options) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      logError('linearise() requires an HTMLElement');
      return { text: '', sections: [] };
    }
    const opts = options || {};
    const verbosity = opts.verbosity || getVerbosity();
    logDebug('linearise() called, verbosity:', verbosity);

    // RA-122: "off" reads exactly what "on" reads, minus the cue words in CUES, so words never run together
    // and the RA-120 pauses apply in both settings.
    const cues = verbosity !== 'off';

    // RA-120: F1 runs on a clone, so the live panel is never touched; with no <br> there is nothing to clone.
    let walkRoot = element;
    if (element.querySelector('br')) {
      walkRoot = element.cloneNode(true);
      walkRoot.querySelectorAll('br').forEach(function (br) { commaBeforeBreak(br, walkRoot); });
    }
    const sections = walkDOM(walkRoot, opts.skipSelectors || null, cues);
    sections.forEach(function (s) { s.text = speakPartLabels(s.text); });
    const text = sections
      .map(function (s) { return s.text; })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    logDebug('linearise() produced', sections.length, 'sections,', text.length, 'chars');
    return { text: text, sections: sections };
  }

  logInfo('TTSSemantic loaded');

  return {
    linearise: linearise,
    getVerbosity: getVerbosity,
    setVerbosity: setVerbosity
  };
})();

// Expose to window (classic-script `const` is script-scoped, not global)
window.TTSSemantic = TTSSemantic;
