/**
 * @fileoverview MathPix Alt Text MMD Serialiser — caption sync between registry and MMD
 * @module MathPixAltTextMMDSerialiser
 * @requires MathPixImageRegistry (consumed at call time; not imported)
 * @version 1.0.0 (Stage 1.B — production module, tests extracted)
 * @since Image Manager Alt Text plan, Stage 1
 *
 * @description
 * Translates between registry caption titles and `\begin{figure}\caption{...}\end{figure}`
 * content in the MMD. Supports wrap, replace, unwrap, empty-caption, insert-caption, no-op,
 * and the MMD → registry read path. Multi-line `\caption{}` content is parsed across lines
 * (Stage 1.B fix) and flattened to a single space on registry round-trip.
 *
 * Design decision (post-Stage-0): captions live inside figure environments rather than as
 * bare paragraphs below an image. Adding a caption to a bare `![](url)` wraps it; clearing
 * the caption on a previously-bare image unwraps back to `![alt](url)`. The `originalSyntax`
 * field added in the Stage 0 addendum drives the unwrap-vs-keep-shell decision.
 *
 * Test suite lives in `mathpix-scripts/testing/mathpix-alt-text-serialiser-tests.js`
 * (`window.runStage1Tests`, `window.runStage1aTests`). Stage 2 extends this module with
 * appendix serialisation for long descriptions.
 *
 * @see mathpix-scripts/docs/alt-text/image-manager-alt-text-build-plan.md — Stage 1 spec
 * @see mathpix-image-registry.js — entry shape, `originalSyntax`, `title`, `updateTitle()`
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
      console.error(`[AltTextMMDSerialiser] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextMMDSerialiser] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextMMDSerialiser] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextMMDSerialiser] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const FIGURE_BEGIN = "\\begin{figure}";
  const FIGURE_END = "\\end{figure}";
  const CAPTION_SETUP_LINE = "\\captionsetup{labelformat=empty}";

  const DEFAULT_OPTIONS = Object.freeze({
    suppressFigureNumbering: true,
    includeMaxWidth: true,
  });

  // ============================================================================
  // STRING HELPERS
  // ============================================================================

  /**
   * Escape a string for use inside a RegExp.
   * @param {string} text
   * @returns {string}
   */
  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Encode alt text for inclusion in `\includegraphics[alt={...}]`.
   * Escape backslashes first, then braces, so a backslash in input doesn't
   * get re-interpreted as an escape sequence for the inserted brace-escapes.
   * @param {string} text
   * @returns {string}
   */
  function escapeAltForLatex(text) {
    if (typeof text !== "string") return "";
    return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  }

  /**
   * Decode a string previously processed by `escapeAltForLatex`.
   * Reverse order: unescape braces, then backslashes.
   * @param {string} text
   * @returns {string}
   */
  function unescapeAltFromLatex(text) {
    if (typeof text !== "string") return "";
    return text.replace(/\\\{/g, "{").replace(/\\\}/g, "}").replace(/\\\\/g, "\\");
  }

  /**
   * Find the matching `}` for the `{` at `openIndex` in `text`. Handles
   * LaTeX-style backslash-escapes — `\{` and `\}` do not affect depth.
   *
   * @param {string} text
   * @param {number} openIndex - Index of the opening `{` (must be `{`).
   * @returns {number} Index of the matching `}`, or -1 if not found.
   */
  function findMatchingBrace(text, openIndex) {
    if (typeof text !== "string" || text[openIndex] !== "{") return -1;
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
      if (text[i] === "\\" && i + 1 < text.length) {
        i++;
        continue;
      }
      if (text[i] === "{") {
        depth++;
      } else if (text[i] === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  // ============================================================================
  // IMAGE LOCATION
  // ============================================================================

  /**
   * Locate an image entry's reference inside an MMD string. Tries exact
   * match on `entry.mmdReference` first, then falls back to a URL-pattern
   * regex based on `entry.originalSyntax`.
   *
   * @param {string} mmd
   * @param {Object} entry - Registry entry (must have at least mmdReference + originalUrl).
   * @returns {{ found: boolean, lineIndex?: number, viaFallback?: boolean }}
   */
  function findImage(mmd, entry) {
    if (typeof mmd !== "string" || !entry) return { found: false };
    const lines = mmd.split("\n");

    if (entry.mmdReference) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(entry.mmdReference)) {
          return { found: true, lineIndex: i, viaFallback: false };
        }
      }
    }

    if (entry.originalUrl) {
      const escapedUrl = escapeRegExp(entry.originalUrl);
      let pattern;
      if (entry.originalSyntax === "includegraphics") {
        pattern = new RegExp(
          `\\\\includegraphics\\s*(\\[[^\\]]*\\])?\\s*\\{${escapedUrl}\\}`,
        );
      } else {
        pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`);
      }
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          logWarn(
            `findImage(): fell back to URL regex for entry ${entry.id || "?"} (mmdReference no longer matches)`,
          );
          return { found: true, lineIndex: i, viaFallback: true };
        }
      }
    }

    return { found: false };
  }

  /**
   * Determine whether `lines[imageLineIndex]` sits inside a `\begin{figure}...\end{figure}`
   * environment, and if so, where any caption + captionsetup commands live.
   *
   * @param {Array<string>} lines
   * @param {number} imageLineIndex
   * @returns {Object} Context descriptor — see fields below.
   */
  function detectFigureContext(lines, imageLineIndex) {
    let beginIndex = null;
    for (let i = imageLineIndex - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed === FIGURE_BEGIN) {
        beginIndex = i;
        break;
      }
      if (trimmed === FIGURE_END) {
        return { inFigure: false };
      }
    }
    if (beginIndex === null) return { inFigure: false };

    let endIndex = null;
    for (let i = imageLineIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed === FIGURE_END) {
        endIndex = i;
        break;
      }
      if (trimmed === FIGURE_BEGIN) {
        logWarn(
          "detectFigureContext(): nested \\begin{figure} before matching \\end{figure} — treating as outside figure env",
        );
        return { inFigure: false };
      }
    }
    if (endIndex === null) return { inFigure: false };

    let captionIndex = null;
    let captionEndIndex = null;
    let captionText = null;
    let captionSetupIndex = null;

    for (let i = beginIndex + 1; i < endIndex; i++) {
      const line = lines[i];

      if (captionSetupIndex === null && line.includes("\\captionsetup{")) {
        captionSetupIndex = i;
      }

      if (captionIndex === null) {
        const tagIdx = line.indexOf("\\caption{");
        if (tagIdx !== -1) {
          const openBraceIdx = tagIdx + "\\caption".length;
          const singleLineCloseIdx = findMatchingBrace(line, openBraceIdx);
          if (singleLineCloseIdx !== -1) {
            captionIndex = i;
            captionEndIndex = i;
            captionText = line.substring(openBraceIdx + 1, singleLineCloseIdx);
          } else {
            // Stage 1.B: span multiple lines until the closing brace is found
            // (or the end of the figure env). Flatten internal newlines to a
            // single space when storing captionText so write-back stays single-line.
            const joined = lines.slice(i, endIndex).join("\n");
            const joinedCloseIdx = findMatchingBrace(joined, openBraceIdx);
            if (joinedCloseIdx === -1) {
              logWarn(
                "detectFigureContext(): \\caption{ has unbalanced braces across figure env — caption parse skipped",
              );
            } else {
              const lineOffset =
                joined.substring(0, joinedCloseIdx + 1).split("\n").length - 1;
              captionIndex = i;
              captionEndIndex = i + lineOffset;
              captionText = joined
                .substring(openBraceIdx + 1, joinedCloseIdx)
                .replace(/\n/g, " ");
            }
          }
        }
      }
    }

    return {
      inFigure: true,
      beginIndex,
      endIndex,
      captionIndex,
      captionEndIndex,
      captionText,
      captionSetupIndex,
    };
  }

  // ============================================================================
  // INTERNAL WRITE TRANSFORMATIONS
  // ============================================================================

  /**
   * Build the `\includegraphics[...]{url}` line for a wrap or rebuild operation.
   * @private
   */
  function _buildIncludegraphicsLine(url, altText, options) {
    const escapedAlt = escapeAltForLatex(altText || "");
    const optionParts = [`alt={${escapedAlt}}`];
    if (options.includeMaxWidth) {
      optionParts.push("max width=\\textwidth");
    }
    return `\\includegraphics[${optionParts.join(",")}]{${url}}`;
  }

  /**
   * Build the figure block (as an array of lines) for the wrap operation.
   * @private
   */
  function _buildFigureBlock(url, altText, captionText, options) {
    const block = [FIGURE_BEGIN, _buildIncludegraphicsLine(url, altText, options)];
    if (options.suppressFigureNumbering) block.push(CAPTION_SETUP_LINE);
    block.push(`\\caption{${captionText}}`);
    block.push(FIGURE_END);
    return block;
  }

  /**
   * Parse `![alt](url)` from a markdown image line. Returns the first match.
   * Returns null if the line contains content beyond the image syntax — we
   * refuse to wrap inline images in Stage 1.A to avoid mangling surrounding text.
   * @private
   */
  function _parseMarkdownImage(line) {
    const trimmed = line.trim();
    const m = /^!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)$/.exec(trimmed);
    if (!m) return null;
    return { alt: m[1], url: m[2] };
  }

  /**
   * Parse `\includegraphics[opts]{url}` from a line. Bare includegraphics only —
   * line must contain just the command (after trim). Stage 1.B will broaden.
   * @private
   */
  function _parseIncludegraphics(line) {
    const trimmed = line.trim();
    const m = /^\\includegraphics\s*(\[([^\]]*)\])?\s*\{([^}]+)\}$/.exec(trimmed);
    if (!m) return null;
    return { options: m[2] || "", url: m[3] };
  }

  /**
   * Wrap a bare image line into a figure environment. Returns an object with the
   * updated lines array plus the new `\includegraphics` line we just inserted
   * (so the caller can refresh `entry.mmdReference`). Returns null if the line
   * couldn't be parsed (e.g. inline image with surrounding text).
   * @private
   * @returns {{ lines: Array<string>, newMmdReference: string, newSyntax: string }|null}
   */
  function _wrapBareImage(lines, idx, entry, options) {
    const line = lines[idx];
    let url = entry.originalUrl;
    let altForFigure = "";

    if (entry.originalSyntax === "markdown") {
      const parsed = _parseMarkdownImage(line);
      if (!parsed) {
        logWarn(
          `_wrapBareImage(): line is not a stand-alone markdown image — refusing to wrap. Line: ${JSON.stringify(line)}`,
        );
        return null;
      }
      url = parsed.url;
      altForFigure = parsed.alt;
    } else {
      const parsed = _parseIncludegraphics(line);
      if (!parsed) {
        logWarn(
          `_wrapBareImage(): line is not a stand-alone \\includegraphics — refusing to wrap. Line: ${JSON.stringify(line)}`,
        );
        return null;
      }
      url = parsed.url;
      altForFigure = entry.altText || "";
    }

    const figureBlock = _buildFigureBlock(url, altForFigure, entry.title, options);
    // figureBlock[1] is the `\includegraphics[...]{url}` line — the new
    // mmdReference for the entry. Capture it before splice so any later refactor
    // that omits `max width=\textwidth` or otherwise re-shapes the line is
    // reflected verbatim, not reconstructed from a template.
    const newMmdReference = figureBlock[1];

    lines.splice(idx, 1, ...figureBlock);
    let insertStart = idx;
    let insertEnd = idx + figureBlock.length - 1;

    if (insertStart > 0 && lines[insertStart - 1].trim() !== "") {
      lines.splice(insertStart, 0, "");
      insertStart++;
      insertEnd++;
    }
    if (insertEnd + 1 < lines.length && lines[insertEnd + 1].trim() !== "") {
      lines.splice(insertEnd + 1, 0, "");
    }
    return { lines, newMmdReference, newSyntax: "includegraphics" };
  }

  /**
   * Replace the content of an existing `\caption{X}` with `newText`. Handles
   * both single-line and multi-line caption ranges. When the caption spans
   * multiple lines (Stage 1.B fix), the entire range is collapsed to one line
   * after replacement; round-trip stability is preserved because subsequent
   * reads of the resulting MMD see a fully single-line `\caption{...}`.
   * @private
   */
  function _replaceCaptionContent(lines, ctx, newText) {
    const startIdx = ctx.captionIndex;
    const endIdx = typeof ctx.captionEndIndex === "number" ? ctx.captionEndIndex : startIdx;

    if (startIdx === endIdx) {
      const line = lines[startIdx];
      const tagIdx = line.indexOf("\\caption{");
      const openBraceIdx = tagIdx + "\\caption".length;
      const closeBraceIdx = findMatchingBrace(line, openBraceIdx);
      if (closeBraceIdx === -1) {
        logWarn("_replaceCaptionContent(): could not find matching brace — skipping");
        return null;
      }
      lines[startIdx] =
        line.substring(0, openBraceIdx + 1) + newText + line.substring(closeBraceIdx);
      return lines;
    }

    const startLine = lines[startIdx];
    const tagIdx = startLine.indexOf("\\caption{");
    const openBraceIdx = tagIdx + "\\caption".length;
    const joined = lines.slice(startIdx, endIdx + 1).join("\n");
    const joinedCloseIdx = findMatchingBrace(joined, openBraceIdx);
    if (joinedCloseIdx === -1) {
      logWarn(
        "_replaceCaptionContent(): multi-line caption has unbalanced braces — skipping",
      );
      return null;
    }
    const prefix = startLine.substring(0, openBraceIdx + 1);
    // Tail-after-close-brace strips internal newlines so the collapsed line
    // remains a single line; anything after the closing brace was extra
    // intra-figure content that we don't carry over (typical input has just `}`).
    const tail = joined.substring(joinedCloseIdx).replace(/\n/g, "");
    const collapsed = prefix + newText + tail;
    lines.splice(startIdx, endIdx - startIdx + 1, collapsed);
    return lines;
  }

  /**
   * Unwrap a figure environment back to a bare `![alt](url)` line. Used when
   * the registry caption is cleared and `originalSyntax === "markdown"`.
   * Returns the new bare image line so the caller can refresh `entry.mmdReference`.
   * @private
   * @returns {{ lines: Array<string>, newMmdReference: string, newSyntax: string }|null}
   */
  function _unwrapFigureEnv(lines, ctx) {
    let includegraphicsIdx = null;
    for (let i = ctx.beginIndex + 1; i < ctx.endIndex; i++) {
      if (lines[i].includes("\\includegraphics")) {
        includegraphicsIdx = i;
        break;
      }
    }
    if (includegraphicsIdx === null) {
      logWarn("_unwrapFigureEnv(): no \\includegraphics line found inside figure env");
      return null;
    }

    const igLine = lines[includegraphicsIdx];
    const igMatch =
      /\\includegraphics\s*(\[([^\]]*)\])?\s*\{([^}]+)\}/.exec(igLine);
    if (!igMatch) {
      logWarn("_unwrapFigureEnv(): could not parse \\includegraphics line");
      return null;
    }
    const optionsStr = igMatch[2] || "";
    const url = igMatch[3];

    let altRaw = "";
    const altMatch = /(?:^|,)\s*alt\s*=\s*\{/.exec(optionsStr);
    if (altMatch) {
      const braceStart = altMatch.index + altMatch[0].length - 1;
      const braceEnd = findMatchingBrace(optionsStr, braceStart);
      if (braceEnd !== -1) {
        altRaw = optionsStr.substring(braceStart + 1, braceEnd);
      }
    }
    const alt = unescapeAltFromLatex(altRaw);

    const bareLine = `![${alt}](${url})`;
    lines.splice(ctx.beginIndex, ctx.endIndex - ctx.beginIndex + 1, bareLine);
    return { lines, newMmdReference: bareLine, newSyntax: "markdown" };
  }

  /**
   * Refresh an entry's `mmdReference` and `syntax` in the registry after wrap
   * or unwrap has mutated the MMD. No-op when no registry was supplied (so
   * `writeCaption` remains callable in standalone mode).
   *
   * Uses `updateImageReference` — a narrow setter that touches only the two
   * reference fields plus `isModified` and the registry's `lastUpdated`. We
   * deliberately do NOT use `replaceImage` here: that method flips `status`
   * to `"user-replaced"` and stamps `replacedAt`, which is correct for a real
   * image swap but wrong for a caption-driven MMD reshape.
   *
   * @private
   */
  function _refreshEntryReference(registry, id, newMmdReference, newSyntax) {
    if (!registry || typeof registry.updateImageReference !== "function") return;
    registry.updateImageReference(id, newMmdReference, newSyntax);
  }

  // ============================================================================
  // PUBLIC: writeCaption
  // ============================================================================

  /**
   * Apply a single entry's caption state to the MMD. The state machine described
   * in the Stage 1 build plan (§ "Behaviour spec") is realised here.
   *
   * When a `registry` is provided, wrap and unwrap transformations also refresh
   * the entry's `mmdReference` and `syntax` in-place via `replaceImage`, so a
   * subsequent call on the same `(mmd, registry)` pair locates the image
   * correctly instead of falling through to `image-not-found`. `originalSyntax`
   * is preserved across the refresh. No-op / replace-caption / empty-caption /
   * insert-caption do not touch the registry — they only mutate the caption line.
   *
   * @param {string} mmd
   * @param {Object} entry - Registry entry (read-only — caller decides whether to write back).
   * @param {Object} [opts] - Same shape as `DEFAULT_OPTIONS`.
   * @param {Object} [registry] - MathPixImageRegistry instance. Optional;
   *   when supplied, wrap/unwrap refresh `entry.mmdReference` and `entry.syntax`.
   * @returns {{ mmd: string, transformed: boolean, action: string }}
   */
  function writeCaption(mmd, entry, opts, registry) {
    const options = Object.assign({}, DEFAULT_OPTIONS, opts || {});
    if (typeof mmd !== "string" || !entry) {
      return { mmd: mmd || "", transformed: false, action: "no-op" };
    }

    const loc = findImage(mmd, entry);
    if (!loc.found) {
      logWarn(`writeCaption(): image not found for entry ${entry.id || "?"}`);
      return { mmd, transformed: false, action: "image-not-found" };
    }

    const lines = mmd.split("\n");
    const ctx = detectFigureContext(lines, loc.lineIndex);
    const T = typeof entry.title === "string" ? entry.title : "";

    if (!ctx.inFigure) {
      if (T === "") {
        return { mmd, transformed: false, action: "no-op" };
      }
      const wrapped = _wrapBareImage(lines, loc.lineIndex, entry, options);
      if (wrapped === null) {
        return { mmd, transformed: false, action: "no-op" };
      }
      _refreshEntryReference(
        registry,
        entry.id,
        wrapped.newMmdReference,
        wrapped.newSyntax,
      );
      return { mmd: wrapped.lines.join("\n"), transformed: true, action: "wrap" };
    }

    if (ctx.captionIndex !== null) {
      const X = ctx.captionText;
      if (X === T) {
        return { mmd, transformed: false, action: "no-op" };
      }
      if (T !== "") {
        const replaced = _replaceCaptionContent(lines, ctx, T);
        if (replaced === null) {
          return { mmd, transformed: false, action: "no-op" };
        }
        return { mmd: replaced.join("\n"), transformed: true, action: "replace-caption" };
      }
      if (entry.originalSyntax === "markdown") {
        const unwrapped = _unwrapFigureEnv(lines, ctx);
        if (unwrapped === null) {
          return { mmd, transformed: false, action: "no-op" };
        }
        _refreshEntryReference(
          registry,
          entry.id,
          unwrapped.newMmdReference,
          unwrapped.newSyntax,
        );
        return { mmd: unwrapped.lines.join("\n"), transformed: true, action: "unwrap" };
      }
      const emptied = _replaceCaptionContent(lines, ctx, "");
      if (emptied === null) {
        return { mmd, transformed: false, action: "no-op" };
      }
      return { mmd: emptied.join("\n"), transformed: true, action: "empty-caption" };
    }

    if (T === "") {
      return { mmd, transformed: false, action: "no-op" };
    }
    lines.splice(ctx.endIndex, 0, `\\caption{${T}}`);
    return { mmd: lines.join("\n"), transformed: true, action: "insert-caption" };
  }

  // ============================================================================
  // PUBLIC: writeAllCaptions
  // ============================================================================

  /**
   * Apply every registry entry's caption state to the MMD in turn. Returns the
   * accumulated MMD plus a count of transformations and a per-action breakdown.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance (exposes getAllImages()).
   * @param {Object} [opts]
   * @returns {{ mmd: string, transformations: number, actions: Object }}
   */
  function writeAllCaptions(mmd, registry, opts) {
    if (!registry || typeof registry.getAllImages !== "function") {
      logError("writeAllCaptions(): registry is missing getAllImages()");
      return { mmd: mmd || "", transformations: 0, actions: {} };
    }
    let current = typeof mmd === "string" ? mmd : "";
    let transformations = 0;
    const actions = {};
    for (const entry of registry.getAllImages()) {
      const result = writeCaption(current, entry, opts, registry);
      current = result.mmd;
      if (result.transformed) transformations++;
      actions[result.action] = (actions[result.action] || 0) + 1;
    }
    logInfo(
      `writeAllCaptions(): ${transformations} transformations across ${Object.values(actions).reduce((a, b) => a + b, 0)} entries`,
    );
    return { mmd: current, transformations, actions };
  }

  // ============================================================================
  // PUBLIC: parseCaptions
  // ============================================================================

  /**
   * Read captions from the MMD and update each matching registry entry's title.
   * MMD wins — when the MMD value differs from the registry value, the registry
   * is updated. When values already agree, the registry is left untouched so we
   * don't spuriously flip `isModified` on every parse.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{ processed: number, updated: number, skipped: number, notFound: number }}
   */
  function parseCaptions(mmd, registry) {
    if (!registry || typeof registry.getAllImages !== "function") {
      logError("parseCaptions(): registry is missing getAllImages()");
      return { processed: 0, updated: 0, skipped: 0, notFound: 0 };
    }
    if (typeof mmd !== "string") {
      logError("parseCaptions(): mmd must be a string");
      return { processed: 0, updated: 0, skipped: 0, notFound: 0 };
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const lines = mmd.split("\n");

    for (const entry of registry.getAllImages()) {
      processed++;
      const loc = findImage(mmd, entry);
      if (!loc.found) {
        logWarn(`parseCaptions(): image not found for entry ${entry.id || "?"}`);
        notFound++;
        continue;
      }
      const ctx = detectFigureContext(lines, loc.lineIndex);
      let newTitle = "";
      if (ctx.inFigure && ctx.captionIndex !== null) {
        newTitle = ctx.captionText;
      }
      if (newTitle === entry.title) {
        skipped++;
        continue;
      }
      const ok = registry.updateTitle(entry.id, newTitle, "user");
      if (ok) {
        updated++;
      } else {
        logWarn(
          `parseCaptions(): updateTitle returned false for entry ${entry.id || "?"}`,
        );
      }
    }
    logInfo(
      `parseCaptions(): processed=${processed} updated=${updated} skipped=${skipped} notFound=${notFound}`,
    );
    return { processed, updated, skipped, notFound };
  }

  // ============================================================================
  // STAGE 2.A — APPENDIX CONSTANTS
  // ============================================================================

  /**
   * Frozen set of action keys emitted by writeAppendix / parseAppendix.
   * Promoted to a constant rather than relying on string literals at call
   * sites per the Stage 1.B lesson about stringly-typed action keys drifting
   * between implementation and tests. Internal — not exposed on the namespace.
   *
   * @private
   */
  const APPENDIX_ACTIONS = Object.freeze({
    CREATED: "created-appendix",
    APPENDED: "appended-entry",
    UPDATED: "updated-entry",
    REMOVED_ENTRY: "removed-entry",
    REMOVED_APPENDIX: "removed-appendix",
    NO_OP: "no-op",
    ENTRY_NOT_MAPPED: "entry-not-mapped",
  });

  const APPENDIX_MARKER_RE = /<!--\s*img-desc:([^\s>][^\s>]*?)\s*-->/;
  const APPENDIX_HEADING_RE = /^(#{1,6})\s+\S/;
  const APPENDIX_FENCE_RE = /^(```|~~~)/;

  // ============================================================================
  // STAGE 2.A — HEADING-LEVEL DETECTION
  // ============================================================================

  /**
   * Find the shallowest ATX heading level present in the MMD. Returns 1–6 for
   * the smallest `#`-count among heading lines, or `null` if the document
   * contains no headings at all. Fenced code blocks (``` or ~~~) are skipped
   * so `# Comment` lines inside code samples do not shift the appendix level.
   *
   * Setext-style headings and LaTeX `\section*{}` are not considered — the
   * heading-level rule of Stage 2 is about the markdown heading hierarchy
   * that Mathpix Convert promotes to LaTeX sectioning, not already-LaTeX
   * content.
   *
   * @param {string} mmd
   * @returns {number|null}
   */
  function detectShallowestHeading(mmd) {
    if (typeof mmd !== "string") return null;
    const lines = mmd.split("\n");
    let inFence = false;
    let shallowest = null;
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (APPENDIX_FENCE_RE.test(trimmed)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = trimmed.match(APPENDIX_HEADING_RE);
      if (m) {
        const level = m[1].length;
        if (shallowest === null || level < shallowest) {
          shallowest = level;
          if (shallowest === 1) break;
        }
      }
    }
    return shallowest;
  }

  // ============================================================================
  // STAGE 2.A — APPENDIX PARSING (internal)
  // ============================================================================

  /**
   * Find every appendix entry currently present in the MMD via its marker
   * comment. Each entry's text is the prose between its heading line and the
   * next marker (or end-of-document). Leading and trailing blank lines in the
   * captured prose are trimmed; internal blank lines are preserved so
   * multi-paragraph descriptions round-trip cleanly.
   *
   * Does not require the parent heading (`## Long descriptions`) to be
   * present — markers are the canonical anchor. Robust to hand-edits of the
   * parent heading text. Duplicate marker IDs keep the first occurrence and
   * log a warning.
   *
   * @private
   * @param {string} mmd
   * @returns {Array<{id: string, text: string, markerLine: number, headingLine: number|null}>}
   */
  function _parseAppendixEntries(mmd) {
    if (typeof mmd !== "string") return [];
    const lines = mmd.split("\n");
    const markers = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(APPENDIX_MARKER_RE);
      if (m) markers.push({ line: i, id: m[1] });
    }
    if (markers.length === 0) return [];

    const entries = [];
    const seenIds = new Set();
    for (let mi = 0; mi < markers.length; mi++) {
      const { line: markerLine, id } = markers[mi];
      const nextMarkerLine =
        mi + 1 < markers.length ? markers[mi + 1].line : lines.length;

      if (seenIds.has(id)) {
        logWarn(
          `_parseAppendixEntries(): duplicate marker for ID "${id}" — keeping first occurrence only`,
        );
        continue;
      }
      seenIds.add(id);

      let headingLine = -1;
      for (let i = markerLine + 1; i < nextMarkerLine; i++) {
        const trimmedI = lines[i].trim();
        if (APPENDIX_HEADING_RE.test(trimmedI)) {
          headingLine = i;
          break;
        }
        if (trimmedI !== "") break;
      }

      const textStart = headingLine === -1 ? markerLine + 1 : headingLine + 1;
      const textLines = lines.slice(textStart, nextMarkerLine);
      while (textLines.length > 0 && textLines[0].trim() === "")
        textLines.shift();
      while (
        textLines.length > 0 &&
        textLines[textLines.length - 1].trim() === ""
      )
        textLines.pop();

      entries.push({
        id,
        text: textLines.join("\n"),
        markerLine,
        headingLine: headingLine === -1 ? null : headingLine,
      });
    }
    return entries;
  }

  /**
   * Find the line range occupied by the appendix in the MMD, for splicing.
   * Starts at the parent heading immediately preceding the first marker (if
   * one is present), or at the first marker line if no preceding heading
   * exists. Ends at the last line of the MMD — Stage 2.A treats the appendix
   * as always living at the trailing end of the document.
   *
   * Returns `null` if the MMD contains no marker comments at all.
   *
   * @private
   * @param {string} mmd
   * @returns {{startLine: number, endLine: number}|null}
   */
  function _findAppendixRange(mmd) {
    if (typeof mmd !== "string") return null;
    const lines = mmd.split("\n");
    let firstMarkerLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (APPENDIX_MARKER_RE.test(lines[i])) {
        firstMarkerLine = i;
        break;
      }
    }
    if (firstMarkerLine === -1) return null;

    let startLine = firstMarkerLine;
    for (let i = firstMarkerLine - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed === "") continue;
      if (APPENDIX_HEADING_RE.test(trimmed)) {
        startLine = i;
      }
      break;
    }
    return { startLine, endLine: lines.length - 1 };
  }

  /**
   * Build a single entry's heading text. Uses the entry's title if non-empty,
   * else its alt text, else its registry ID. Internal whitespace collapses to
   * a single space so the heading remains single-line.
   *
   * @private
   */
  function _entryHeadingText(entry) {
    const raw =
      (typeof entry.title === "string" && entry.title.trim()) ||
      (typeof entry.altText === "string" && entry.altText.trim()) ||
      entry.id;
    const flat = String(raw).replace(/\s+/g, " ").trim();
    return `Description of ${flat}`;
  }

  // ============================================================================
  // STAGE 2.A — PUBLIC: buildAppendix
  // ============================================================================

  /**
   * Construct the appendix string from registry entries with non-empty
   * `longDescription`. The top heading level is
   * `(detectShallowestHeading(mmd) ?? 1) + 1`, capped at 6; entry headings
   * are one deeper, also capped at 6. An explicit `options.appendixHeadingLevel`
   * overrides the auto-detection but is still capped at 6.
   *
   * Returns the rendered string, the chosen top level, and the entry count.
   * The string has no leading or trailing blank lines — the caller decides
   * splicing context.
   *
   * @param {Object} registry - MathPixImageRegistry instance.
   * @param {string} mmd - Used only for heading-level detection.
   * @param {Object} [options]
   * @param {string} [options.appendixHeading="Long descriptions"]
   * @param {number} [options.appendixHeadingLevel] - Explicit override (1–6).
   * @returns {{appendix: string, level: number, entryCount: number}}
   */
  function buildAppendix(registry, mmd, options) {
    const opts = Object.assign(
      { appendixHeading: "Long descriptions" },
      options || {},
    );
    if (!registry || typeof registry.getAllImages !== "function") {
      logError("buildAppendix(): registry is missing getAllImages()");
      return { appendix: "", level: 2, entryCount: 0 };
    }

    let topLevel;
    if (
      typeof opts.appendixHeadingLevel === "number" &&
      opts.appendixHeadingLevel >= 1
    ) {
      topLevel = Math.min(6, Math.floor(opts.appendixHeadingLevel));
    } else {
      const shallowest = detectShallowestHeading(mmd);
      topLevel = Math.min(6, (shallowest === null ? 1 : shallowest) + 1);
    }
    const entryLevel = Math.min(6, topLevel + 1);
    const topHashes = "#".repeat(topLevel);
    const entryHashes = "#".repeat(entryLevel);

    const entries = registry
      .getAllImages()
      .filter(
        (e) =>
          typeof e.longDescription === "string" &&
          e.longDescription.length > 0,
      );
    if (entries.length === 0) {
      return { appendix: "", level: topLevel, entryCount: 0 };
    }

    const out = [];
    out.push(`${topHashes} ${opts.appendixHeading}`);
    out.push("");
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      out.push(`<!-- img-desc:${e.id} -->`);
      out.push(`${entryHashes} ${_entryHeadingText(e)}`);
      out.push("");
      out.push(e.longDescription);
      if (i < entries.length - 1) out.push("");
    }
    return {
      appendix: out.join("\n"),
      level: topLevel,
      entryCount: entries.length,
    };
  }

  // ============================================================================
  // STAGE 2.A — PUBLIC: writeAppendix
  // ============================================================================

  /**
   * Apply the registry's `longDescription` state to the MMD via the write
   * state machine in the Stage 2 build plan. Operates on the whole appendix
   * in one pass — rebuilds it from registry truth and splices the result onto
   * the trailing end of the MMD.
   *
   * Action counts use the values from `APPENDIX_ACTIONS`. The `transformations`
   * count parallels `writeAllCaptions`'s — it is the sum of work-doing
   * actions (created, appended, updated, removed-entry, removed-appendix);
   * `no-op` and `entry-not-mapped` are not counted as transformations.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @param {Object} [options] - Forwarded to buildAppendix.
   * @returns {{mmd: string, actions: Object, transformations: number}}
   */
  function writeAppendix(mmd, registry, options) {
    const actions = {};
    const safeMmd = typeof mmd === "string" ? mmd : "";

    if (!registry || typeof registry.getAllImages !== "function") {
      logError("writeAppendix(): registry is missing getAllImages()");
      return { mmd: safeMmd, actions, transformations: 0 };
    }

    const existingEntries = _parseAppendixEntries(safeMmd);
    const existingById = new Map(existingEntries.map((e) => [e.id, e]));

    const registryEntries = registry
      .getAllImages()
      .filter(
        (e) =>
          typeof e.longDescription === "string" &&
          e.longDescription.length > 0,
      );
    const registryIds = new Set(registryEntries.map((e) => e.id));

    const appendixExisted = existingEntries.length > 0;
    const willHaveAppendix = registryEntries.length > 0;

    // Strip the existing appendix region (if any) to get the prefix MMD.
    // Heading-level detection then runs on the prefix only — an appendix-only
    // MMD doesn't inflate its own next heading level.
    let lines = safeMmd.split("\n");
    const range = _findAppendixRange(safeMmd);
    if (range) {
      lines.splice(range.startLine, range.endLine - range.startLine + 1);
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    const prefixMmd = lines.join("\n");

    if (!willHaveAppendix && !appendixExisted) {
      actions[APPENDIX_ACTIONS.NO_OP] = 1;
      return { mmd: safeMmd, actions, transformations: 0 };
    }

    if (!willHaveAppendix && appendixExisted) {
      actions[APPENDIX_ACTIONS.REMOVED_APPENDIX] = 1;
      logInfo(
        `writeAppendix(): removed appendix (${existingEntries.length} stale entries cleared)`,
      );
      return { mmd: prefixMmd, actions, transformations: 1 };
    }

    const built = buildAppendix(registry, prefixMmd, options);
    const nextMmd =
      prefixMmd.length === 0
        ? built.appendix
        : prefixMmd + "\n\n" + built.appendix;

    if (!appendixExisted) {
      // Per spec: per-entry actions are subsumed by `created-appendix` when
      // the appendix is being created from scratch.
      actions[APPENDIX_ACTIONS.CREATED] = 1;
      logInfo(
        `writeAppendix(): created appendix with ${registryEntries.length} entries (level ${built.level})`,
      );
      return { mmd: nextMmd, actions, transformations: 1 };
    }

    // Appendix exists, > 0 registry entries — per-entry actions + removed-entry.
    let appended = 0;
    let updated = 0;
    let noOp = 0;
    for (const e of registryEntries) {
      const existing = existingById.get(e.id);
      if (!existing) {
        appended++;
      } else if (existing.text === e.longDescription) {
        noOp++;
      } else {
        updated++;
      }
    }
    let removedEntry = 0;
    for (const e of existingEntries) {
      if (!registryIds.has(e.id)) removedEntry++;
    }
    if (appended > 0) actions[APPENDIX_ACTIONS.APPENDED] = appended;
    if (updated > 0) actions[APPENDIX_ACTIONS.UPDATED] = updated;
    if (noOp > 0) actions[APPENDIX_ACTIONS.NO_OP] = noOp;
    if (removedEntry > 0)
      actions[APPENDIX_ACTIONS.REMOVED_ENTRY] = removedEntry;
    const transformations = appended + updated + removedEntry;

    logInfo(
      `writeAppendix(): appended=${appended} updated=${updated} removed-entry=${removedEntry} no-op=${noOp}`,
    );
    return { mmd: nextMmd, actions, transformations };
  }

  // ============================================================================
  // STAGE 2.A — PUBLIC: parseAppendix
  // ============================================================================

  /**
   * Read appendix entries from the MMD and update each matching registry
   * entry's `longDescription`. MMD wins — when the MMD value differs from the
   * registry value, the registry is updated. When values already agree, the
   * registry is left untouched so we don't spuriously flip `isModified` on
   * every parse (parallel to `parseCaptions`'s convention).
   *
   * Defensiveness rule: if the MMD contains no appendix at all, the registry
   * is left untouched — `longDescription` fields are never blanked on the
   * basis of an absent appendix. Manual deletion of an entry from the
   * appendix is "noticed" only on the next `writeAppendix`, which re-creates
   * it from the registry's still-populated `longDescription`.
   *
   * Note: the spec called for source `"mmd"` but `VALID_LONG_DESC_SOURCES`
   * does not include that value (it allows original/user/ai-generated/
   * ai-reviewed/null). We use `"user"` to match Stage 1's `parseCaptions`
   * convention — a textarea-driven manual edit and an MMD-driven sync both
   * read as "user origin" downstream.
   *
   * @param {string} mmd
   * @param {Object} registry - MathPixImageRegistry instance.
   * @returns {{updated: number, actions: Object}}
   */
  function parseAppendix(mmd, registry) {
    const actions = {};
    let updated = 0;

    if (typeof mmd !== "string") {
      logError("parseAppendix(): mmd must be a string");
      return { updated, actions };
    }
    if (
      !registry ||
      typeof registry.updateLongDescription !== "function" ||
      typeof registry.getImage !== "function"
    ) {
      logError(
        "parseAppendix(): registry is missing updateLongDescription/getImage",
      );
      return { updated, actions };
    }

    const existingEntries = _parseAppendixEntries(mmd);
    if (existingEntries.length === 0) {
      logDebug("parseAppendix(): no appendix found — registry untouched");
      return { updated, actions };
    }

    for (const e of existingEntries) {
      const regEntry = registry.getImage(e.id);
      if (!regEntry) {
        logWarn(
          `parseAppendix(): marker ID "${e.id}" not present in registry`,
        );
        actions[APPENDIX_ACTIONS.ENTRY_NOT_MAPPED] =
          (actions[APPENDIX_ACTIONS.ENTRY_NOT_MAPPED] || 0) + 1;
        continue;
      }
      if (regEntry.longDescription === e.text) {
        actions[APPENDIX_ACTIONS.NO_OP] =
          (actions[APPENDIX_ACTIONS.NO_OP] || 0) + 1;
        continue;
      }
      const ok = registry.updateLongDescription(e.id, e.text, "user");
      if (ok) {
        updated++;
        actions[APPENDIX_ACTIONS.UPDATED] =
          (actions[APPENDIX_ACTIONS.UPDATED] || 0) + 1;
      } else {
        logWarn(
          `parseAppendix(): updateLongDescription returned false for ID "${e.id}"`,
        );
      }
    }

    logInfo(
      `parseAppendix(): updated=${updated} entries=${existingEntries.length}`,
    );
    return { updated, actions };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.MathPixAltTextMMDSerialiser = {
    parseCaptions,
    writeAllCaptions,
    writeCaption,
    findImage,
    detectFigureContext,
    findMatchingBrace,
    escapeAltForLatex,
    unescapeAltFromLatex,
    // Stage 2.A
    detectShallowestHeading,
    buildAppendix,
    writeAppendix,
    parseAppendix,
    APPENDIX_ACTIONS,
  };

  // ============================================================================
  // STAGE 2.A — INLINE SMOKE TESTS
  // ============================================================================

  /**
   * Stage 2.A smoke suite — 5 fixtures covering create / update / remove /
   * remove-all / parse-roundtrip. Mirrors Stage 1.A's inline style and the
   * Stage 0 alias-placement convention. The full Stage 2.B suite (formal
   * round-trip, idempotency, MMD-wins defensiveness, options, edge cases)
   * lives in the extracted test file.
   *
   * @returns {{passed: number, failed: number, total: number, results: string[]}}
   */
  function runStage2aSmokeTests() {
    console.log(
      "=== MathPix Alt Text MMD Serialiser — Stage 2.A Smoke Suite ===\n",
    );

    if (typeof window.MathPixImageRegistry !== "function") {
      console.error(
        "MathPixImageRegistry not available — load the registry module first.",
      );
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: ["❌ Registry not loaded"],
      };
    }

    let passed = 0;
    let failed = 0;
    const results = [];

    function assert(name, condition, detail) {
      if (condition) {
        passed++;
        results.push(`✅ ${name}`);
      } else {
        failed++;
        const msg = detail ? `${name} — ${detail}` : name;
        results.push(`❌ ${msg}`);
        console.error(`FAILED: ${msg}`);
      }
    }

    const Registry = window.MathPixImageRegistry;
    const S = window.MathPixAltTextMMDSerialiser;

    // ------------------------------------------------------------------------
    // Fixture 1: create-appendix from a no-headings MMD
    // ------------------------------------------------------------------------
    console.log("\n--- F1: create-appendix (no-headings doc → H2/H3) ---");
    {
      const mmdBefore =
        "Intro paragraph.\n\n" +
        "![](https://cdn.mathpix.com/img1.png)\n\n" +
        "Outro paragraph.";
      const reg = new Registry();
      reg.buildFromMMD(mmdBefore);
      const entry = reg.getAllImages()[0];
      reg.updateTitle(entry.id, "First image", "user");
      reg.updateLongDescription(
        entry.id,
        "A detailed description of image 1.",
        "user",
      );

      assert(
        "F1: detectShallowestHeading returns null for no-headings doc",
        S.detectShallowestHeading(mmdBefore) === null,
      );

      const built = S.buildAppendix(reg, mmdBefore);
      assert(
        "F1: buildAppendix level === 2 (H1 baseline + 1)",
        built.level === 2,
        `got ${built.level}`,
      );
      assert(
        "F1: buildAppendix entryCount === 1",
        built.entryCount === 1,
      );

      const r = S.writeAppendix(mmdBefore, reg);
      assert(
        "F1: writeAppendix action created-appendix === 1",
        r.actions["created-appendix"] === 1,
        JSON.stringify(r.actions),
      );
      assert(
        "F1: writeAppendix transformations === 1",
        r.transformations === 1,
      );
      assert(
        "F1: output contains '## Long descriptions'",
        r.mmd.includes("## Long descriptions"),
      );
      assert(
        "F1: output contains entry heading '### Description of First image'",
        r.mmd.includes("### Description of First image"),
      );
      assert(
        "F1: output contains marker for the registry ID",
        r.mmd.includes(`<!-- img-desc:${entry.id} -->`),
      );
      assert(
        "F1: output contains the longDescription text",
        r.mmd.includes("A detailed description of image 1."),
      );
      assert(
        "F1: output starts with original intro prose",
        r.mmd.startsWith("Intro paragraph."),
      );
    }

    // ------------------------------------------------------------------------
    // Fixture 2: update-entry (existing appendix, registry text differs)
    // ------------------------------------------------------------------------
    console.log("\n--- F2: update-entry (existing appendix, text differs) ---");
    {
      const prefix =
        "Intro.\n\n![](https://cdn.mathpix.com/img2.png)\n\nOutro.";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${id} -->\n` +
        "### Description of Old title\n\n" +
        "Old description text.";
      reg.updateLongDescription(id, "New description text.", "user");

      const r = S.writeAppendix(mmdBefore, reg);
      assert(
        "F2: action updated-entry === 1",
        r.actions["updated-entry"] === 1,
        JSON.stringify(r.actions),
      );
      assert("F2: transformations === 1", r.transformations === 1);
      assert(
        "F2: output no longer contains 'Old description text.'",
        !r.mmd.includes("Old description text."),
      );
      assert(
        "F2: output contains 'New description text.'",
        r.mmd.includes("New description text."),
      );
      assert(
        "F2: '## Long descriptions' heading still present",
        r.mmd.includes("## Long descriptions"),
      );
      assert(
        "F2: marker for entry still present",
        r.mmd.includes(`<!-- img-desc:${id} -->`),
      );
    }

    // ------------------------------------------------------------------------
    // Fixture 3: remove-entry (existing 2-entry appendix, one longDesc cleared)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- F3: remove-entry (clear one of two longDescriptions) ---",
    );
    {
      const prefix =
        "Para A.\n\n" +
        "![](https://cdn.mathpix.com/img3a.png)\n\n" +
        "Para B.\n\n" +
        "![](https://cdn.mathpix.com/img3b.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const ids = reg.getAllImages().map((e) => e.id);
      const idA = ids[0];
      const idB = ids[1];
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idA} -->\n` +
        "### Description of A\n\n" +
        "Description A text.\n\n" +
        `<!-- img-desc:${idB} -->\n` +
        "### Description of B\n\n" +
        "Description B text.";
      reg.updateLongDescription(idA, "Description A text.", "user");
      reg.updateLongDescription(idB, "Description B text.", "user");
      // Now clear B's longDescription — A keeps its description.
      reg.updateLongDescription(idB, "", "user");

      const r = S.writeAppendix(mmdBefore, reg);
      assert(
        "F3: removed-entry action === 1",
        r.actions["removed-entry"] === 1,
        JSON.stringify(r.actions),
      );
      assert("F3: transformations === 1", r.transformations === 1);
      assert(
        "F3: '## Long descriptions' heading still present",
        r.mmd.includes("## Long descriptions"),
      );
      assert(
        "F3: A's marker still present",
        r.mmd.includes(`<!-- img-desc:${idA} -->`),
      );
      assert(
        "F3: B's marker removed",
        !r.mmd.includes(`<!-- img-desc:${idB} -->`),
      );
      assert(
        "F3: A's description text preserved",
        r.mmd.includes("Description A text."),
      );
      assert(
        "F3: B's description text removed",
        !r.mmd.includes("Description B text."),
      );
    }

    // ------------------------------------------------------------------------
    // Fixture 4: remove-appendix (existing 1-entry appendix, longDesc cleared)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- F4: remove-appendix (clear the only longDescription) ---",
    );
    {
      const prefix = "Body.\n\n![](https://cdn.mathpix.com/img4.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const id = reg.getAllImages()[0].id;
      const mmdBefore =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${id} -->\n` +
        "### Description of Sole\n\n" +
        "Sole description text.";
      reg.updateLongDescription(id, "Sole description text.", "user");
      // Now clear it.
      reg.updateLongDescription(id, "", "user");

      const r = S.writeAppendix(mmdBefore, reg);
      assert(
        "F4: removed-appendix action === 1",
        r.actions["removed-appendix"] === 1,
        JSON.stringify(r.actions),
      );
      assert("F4: transformations === 1", r.transformations === 1);
      assert(
        "F4: output has no '## Long descriptions'",
        !r.mmd.includes("## Long descriptions"),
      );
      assert(
        "F4: output has no markers",
        !r.mmd.includes(`<!-- img-desc:${id} -->`),
      );
      assert(
        "F4: pre-appendix prose preserved (body + image)",
        r.mmd.includes("Body.") &&
          r.mmd.includes("https://cdn.mathpix.com/img4.png"),
      );
    }

    // ------------------------------------------------------------------------
    // Fixture 5: parse-roundtrip (one entry differs, one matches)
    // ------------------------------------------------------------------------
    console.log(
      "\n--- F5: parse-roundtrip (one differs, one matches; defensiveness) ---",
    );
    {
      const prefix =
        "![](https://cdn.mathpix.com/img5a.png)\n\n" +
        "![](https://cdn.mathpix.com/img5b.png)";
      const reg = new Registry();
      reg.buildFromMMD(prefix);
      const ids = reg.getAllImages().map((e) => e.id);
      const idA = ids[0];
      const idB = ids[1];
      reg.updateLongDescription(idA, "Original A text.", "user");
      reg.updateLongDescription(idB, "Original B text.", "user");

      const mmd =
        prefix +
        "\n\n## Long descriptions\n\n" +
        `<!-- img-desc:${idA} -->\n` +
        "### Description of A\n\n" +
        "Edited A text.\n\n" +
        `<!-- img-desc:${idB} -->\n` +
        "### Description of B\n\n" +
        "Original B text.";

      const res = S.parseAppendix(mmd, reg);
      assert(
        "F5: parseAppendix updated === 1",
        res.updated === 1,
        JSON.stringify(res),
      );
      assert(
        "F5: actions[updated-entry] === 1",
        res.actions["updated-entry"] === 1,
      );
      assert(
        "F5: actions[no-op] === 1 (B's content matched, no call)",
        res.actions["no-op"] === 1,
      );
      assert(
        "F5: A's longDescription now equals MMD value",
        reg.getImage(idA).longDescription === "Edited A text.",
        `got "${reg.getImage(idA).longDescription}"`,
      );
      assert(
        "F5: B's longDescription unchanged (matched, skipped)",
        reg.getImage(idB).longDescription === "Original B text.",
      );

      // Defensiveness: parseAppendix on MMD with no appendix is a no-op,
      // and the registry's existing longDescriptions are preserved.
      const noAppendixMmd = "Just prose, no appendix here.";
      const res2 = S.parseAppendix(noAppendixMmd, reg);
      assert(
        "F5: parseAppendix on no-appendix MMD returns updated=0",
        res2.updated === 0,
      );
      assert(
        "F5: registry longDescriptions preserved by defensive parse",
        reg.getImage(idA).longDescription === "Edited A text." &&
          reg.getImage(idB).longDescription === "Original B text.",
      );
    }

    // ------------------------------------------------------------------------
    console.log("\n" + "=".repeat(60));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`,
    );
    if (failed > 0) {
      console.log("Failed tests:");
      results
        .filter((r) => r.startsWith("❌"))
        .forEach((r) => console.log(`  ${r}`));
    }
    console.log("\n=== Stage 2.A Smoke Suite Complete ===");
    return { passed, failed, total: passed + failed, results };
  }

  window.runStage2aTests = runStage2aSmokeTests;

  logInfo(
    "MathPixAltTextMMDSerialiser module loaded (Stage 2.A appendix functions registered)",
  );
})();
