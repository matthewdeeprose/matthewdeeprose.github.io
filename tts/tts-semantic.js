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

  function lineariseTable(tableEl) {
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
    parts.push('Table with ' + colCount + ' columns and ' + rowCount + ' rows.');

    headerCells.forEach(function (th) {
      parts.push('Column heading: ' + ensureFullStop(normaliseText(th.textContent)));
    });

    bodyRows.forEach(function (tr, rowIdx) {
      const cells = Array.from(tr.querySelectorAll('td, th'));
      cells.forEach(function (cell, colIdx) {
        parts.push(
          'Row ' + (rowIdx + 1) + ', Column ' + (colIdx + 1) + ': ' +
          ensureFullStop(normaliseText(cell.textContent))
        );
      });
    });
    return joinParts(parts);
  }

  // ---- Code block lineariser ------------------------------------------------

  function lineariseCodeBlock(preEl) {
    const codeEl = preEl.querySelector('code');
    const parts = [];
    if (codeEl) {
      const langMatch = codeEl.className.match(/language-(\w+)/);
      const language = langMatch ? langMatch[1] : null;
      if (language) {
        parts.push('Code block in ' + language.charAt(0).toUpperCase() + language.slice(1) + '.');
      } else {
        parts.push('Code block.');
      }
      parts.push(normaliseText(codeEl.textContent));
    } else {
      parts.push('Code block.');
      parts.push(normaliseText(preEl.textContent));
    }
    return joinParts(parts);
  }

  // ---- Definition list lineariser -------------------------------------------

  function lineariseDefList(dlEl) {
    const children = Array.from(dlEl.children);
    const termCount = children.filter(function (c) { return c.tagName === 'DT'; }).length;
    const parts = [];
    parts.push('Definition list with ' + termCount + ' terms.');
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

  function lineariseList(listEl) {
    const isOrdered = listEl.tagName === 'OL';
    const items = Array.from(listEl.children).filter(function (c) {
      return c.tagName === 'LI';
    });
    const total = items.length;
    const listType = isOrdered ? 'Numbered' : 'Bulleted';
    const parts = [];
    parts.push(listType + ' list with ' + total + ' items.');
    items.forEach(function (li, idx) {
      const itemText = normaliseText(walkInlineContent(li));
      parts.push('Item ' + (idx + 1) + ' of ' + total + ': ' + ensureFullStop(itemText));
    });
    return joinParts(parts);
  }

  // ---- Inline content walker ------------------------------------------------

  function walkInlineContent(el) {
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
        const label = node.getAttribute('aria-label');
        parts.push(label
          ? 'Mathematical expression. ' + ensureFullStop(label)
          : 'Mathematical expression.');
        continue;
      }
      if (node.tagName === 'IMG') {
        const alt = node.getAttribute('alt');
        parts.push(alt ? 'Image: ' + ensureFullStop(alt) : 'Image.');
        continue;
      }
      if (node.tagName === 'A') {
        const linkText = normaliseText(node.textContent);
        if (linkText) parts.push(linkText + ', link.');
        continue;
      }
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        parts.push(lineariseList(node));
        continue;
      }
      parts.push(walkInlineContent(node));
    }
    return joinParts(parts);
  }

  // ---- Main DOM walker ------------------------------------------------------

  function walkDOM(rootEl, skipSelectors) {
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
        const label = node.getAttribute('aria-label');
        const mathText = label
          ? 'Mathematical expression. ' + ensureFullStop(label)
          : 'Mathematical expression.';
        if (node.parentNode === rootEl) {
          pushCurrentSection();
          sections.push({ type: 'math', text: mathText });
        } else {
          currentText = joinParts([currentText, mathText]);
        }
        return;
      }

      // Headings
      if (HEADING_TAGS.has(tag)) {
        pushCurrentSection();
        const level = parseInt(tag.charAt(1), 10);
        let headingContent = normaliseText(walkInlineContent(node));
        // Strip redundant manual numbering that matches the heading level
        // e.g. <h3>3. Long Description</h3> → avoid "Heading level 3. 3. Long Description"
        const manualNumberPattern = new RegExp('^' + level + '\\.\\s*');
        if (manualNumberPattern.test(headingContent)) {
          headingContent = headingContent.replace(manualNumberPattern, '');
        }
        currentType = 'heading';
        currentLevel = level;
        currentText = 'Heading level ' + level + '. ' + ensureFullStop(headingContent);
        pushCurrentSection();
        return;
      }

      if (tag === 'UL' || tag === 'OL') {
        pushCurrentSection();
        sections.push({ type: 'list', text: lineariseList(node) });
        return;
      }
      if (tag === 'TABLE') {
        pushCurrentSection();
        sections.push({ type: 'table', text: lineariseTable(node) });
        return;
      }
      if (tag === 'BLOCKQUOTE') {
        pushCurrentSection();
        const quoteContent = normaliseText(walkInlineContent(node));
        sections.push({
          type: 'blockquote',
          text: 'Quote. ' + ensureFullStop(quoteContent) + ' End quote.'
        });
        return;
      }
      if (tag === 'PRE') {
        pushCurrentSection();
        sections.push({ type: 'code', text: lineariseCodeBlock(node) });
        return;
      }
      if (tag === 'DL') {
        pushCurrentSection();
        sections.push({ type: 'definition-list', text: lineariseDefList(node) });
        return;
      }
      if (tag === 'HR') {
        pushCurrentSection();
        return;
      }
      if (tag === 'IMG') {
        const alt = node.getAttribute('alt');
        currentText = joinParts([
          currentText,
          alt ? 'Image: ' + ensureFullStop(alt) : 'Image.'
        ]);
        return;
      }
      if (tag === 'A') {
        const linkText = normaliseText(node.textContent);
        if (linkText) currentText = joinParts([currentText, linkText + ', link.']);
        return;
      }
      if (tag === 'P') {
        pushCurrentSection();
        const pContent = walkInlineContent(node);
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

    if (verbosity === 'off') {
      // Split on newlines (preserved by innerText at block boundaries) and
      // ensure each block ends with a full stop so TTS pauses between blocks
      // even when the source content lacks trailing punctuation.
      const raw = (element.innerText || element.textContent || '').trim();
      const blocks = raw
        .split(/\n+/)
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p.length > 0; })
        .map(ensureFullStop);
      const plainText = blocks.join(' ');
      return { text: plainText, sections: [{ type: 'plain', text: plainText }] };
    }

    const sections = walkDOM(element, opts.skipSelectors || null);
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
