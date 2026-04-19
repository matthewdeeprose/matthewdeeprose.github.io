// ─── MathPixSessionRestorer Diff Preview Mixin ───────────────────────────────
// Content preview and diff display.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-diff-preview.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // CONTENT PREVIEW (for session selection UI)
  // =========================================================================

  /**
   * Extract a meaningful preview snippet from MMD content
   * @param {string} content - MMD content
   * @param {string} [original] - Original content for diff comparison
   * @returns {string} Preview snippet (max 50 chars)
   */
  proto.getContentPreview = function (content, original = null) {
    if (!content) return "(empty)";

    // If we have original, try to find and show the first difference
    if (original && content !== original) {
      const diffSnippet = this.findFirstDifference(content, original);
      if (diffSnippet) {
        return this.truncatePreview(diffSnippet, 50);
      }
    }

    // Fallback: show first non-empty line
    const lines = content.split("\n").filter((l) => l.trim());
    const firstLine = lines[0] || content.substring(0, 50);
    return this.truncatePreview(firstLine, 50);
  };

  /**
   * Find the first meaningful difference between two strings
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {string|null} Snippet around first difference
   */
  proto.findFirstDifference = function (current, original) {
    let diffStart = 0;
    const minLen = Math.min(current.length, original.length);

    // Find first differing character
    while (diffStart < minLen && current[diffStart] === original[diffStart]) {
      diffStart++;
    }

    if (diffStart === current.length && diffStart === original.length) {
      return null; // No difference
    }

    // Get context around the difference
    const contextStart = Math.max(0, diffStart - 10);
    const contextEnd = Math.min(current.length, diffStart + 40);

    return current.substring(contextStart, contextEnd);
  };

  /**
   * Truncate and format preview text
   * @param {string} text - Text to truncate
   * @param {number} maxLen - Maximum length
   * @returns {string} Truncated text with ellipsis if needed
   */
  proto.truncatePreview = function (text, maxLen) {
    // Clean up whitespace
    const cleaned = text.replace(/\s+/g, " ").trim();

    if (cleaned.length <= maxLen) {
      return `"${cleaned}"`;
    }

    return `"${cleaned.substring(0, maxLen - 3)}..."`;
  };

  /**
   * Compute detailed diff information between current and original content
   * Returns structured data for accessible diff rendering
   * @param {string} current - Current content
   * @param {string} original - Original content to compare against
   * @returns {Object} Diff analysis result
   */
  proto.computeDiff = function (current, original) {
    // Handle edge cases
    if (!current && !original) {
      return {
        magnitude: "identical",
        changeCount: 0,
        summary: "Empty content",
      };
    }

    if (!original) {
      // No original to compare - show content preview only
      const preview = this.getFirstMeaningfulLine(current);
      return {
        magnitude: "unknown",
        changeCount: 0,
        preview: preview,
        summary: preview,
      };
    }

    if (current === original) {
      return { magnitude: "identical", changeCount: 0, summary: "No changes" };
    }

    // Calculate line-level changes
    const currentLines = (current || "").split("\n");
    const originalLines = (original || "").split("\n");

    const linesAdded = currentLines.filter(
      (line) => line.trim() && !originalLines.includes(line),
    ).length;
    const linesRemoved = originalLines.filter(
      (line) => line.trim() && !currentLines.includes(line),
    ).length;

    // Calculate character-level percentage change
    const maxLen = Math.max(current.length, original.length);
    let diffChars = 0;
    const minLen = Math.min(current.length, original.length);
    for (let i = 0; i < minLen; i++) {
      if (current[i] !== original[i]) diffChars++;
    }
    diffChars += Math.abs(current.length - original.length);
    const percentChanged =
      maxLen > 0 ? Math.round((diffChars / maxLen) * 100) : 0;

    // Determine magnitude
    let magnitude = "minor";
    if (percentChanged > 50) {
      magnitude = "major";
    } else if (percentChanged > 15) {
      magnitude = "moderate";
    }

// Find first word-level change with context
    const firstChange = this.findFirstWordChange(current, original);

    // Find unique lines for differentiation between similar versions
    const uniqueLines = this.getUniqueLines(current, original);

    // Count total changes (simplified: count differing line pairs)
    const changeCount = Math.max(linesAdded, linesRemoved, 1);

    // Build summary string
    let summary = "";
    if (linesAdded > 0 && linesRemoved > 0) {
      if (linesAdded === linesRemoved) {
        // Same number added/removed = lines were modified
        summary = `${linesAdded} line${linesAdded !== 1 ? "s" : ""} changed`;
      } else {
        // Different counts = mix of edits, additions, deletions
        summary = `+${linesAdded}, −${linesRemoved} lines`;
      }
    } else if (linesAdded > 0) {
      summary = `${linesAdded} line${linesAdded !== 1 ? "s" : ""} added`;
    } else if (linesRemoved > 0) {
      summary = `${linesRemoved} line${linesRemoved !== 1 ? "s" : ""} removed`;
    } else {
      summary = `${percentChanged}% changed`;
    }

    return {
      magnitude,
      changeCount,
      linesAdded,
      linesRemoved,
      percentChanged,
      firstChange,
      uniqueLines,
      summary,
    };
  };

  /**
   * Find the first word-level change between two strings
   * Returns context, removed text, and added text
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {Object|null} First change details or null if identical
   */
  proto.findFirstWordChange = function (current, original) {
    if (!current || !original || current === original) return null;

    // Find first differing character position
    let diffStart = 0;
    const minLen = Math.min(current.length, original.length);
    while (diffStart < minLen && current[diffStart] === original[diffStart]) {
      diffStart++;
    }

    if (diffStart === current.length && diffStart === original.length) {
      return null; // Identical
    }

    // Expand backwards to find word boundary for context
    let contextStart = diffStart;
    while (contextStart > 0 && !/\s/.test(current[contextStart - 1])) {
      contextStart--;
    }
    // Include some leading context (up to ~15 chars or previous whitespace)
    let leadingContext = contextStart;
    let contextChars = 0;
    while (leadingContext > 0 && contextChars < 15) {
      leadingContext--;
      contextChars++;
      if (/\s/.test(current[leadingContext]) && contextChars > 5) break;
    }
    // Adjust to not start mid-word
    while (leadingContext > 0 && !/\s/.test(current[leadingContext])) {
      leadingContext--;
    }
    if (leadingContext > 0) leadingContext++; // Skip the whitespace itself

    // Find end of differing region in both strings
    let currentDiffEnd = diffStart;
    let originalDiffEnd = diffStart;

    // For current: find where it matches original again (simplified)
    // Look for next matching segment
const lookAhead = 40;
    let foundSync = false;

    for (let i = 1; i <= lookAhead && !foundSync; i++) {
      const currentPos = diffStart + i;
      const searchStr = current.substring(currentPos, currentPos + 5);
      if (searchStr.length >= 3) {
        const originalIdx = original.indexOf(searchStr, diffStart);
        if (originalIdx > diffStart) {
          currentDiffEnd = currentPos;
          originalDiffEnd = originalIdx;
          foundSync = true;
        }
      }
    }

    if (!foundSync) {
      // Couldn't sync - just take reasonable chunks
      currentDiffEnd = Math.min(diffStart + 20, current.length);
      originalDiffEnd = Math.min(diffStart + 20, original.length);
    }

    // Expand to word boundaries
    while (
      currentDiffEnd < current.length &&
      !/\s/.test(current[currentDiffEnd])
    ) {
      currentDiffEnd++;
    }
    while (
      originalDiffEnd < original.length &&
      !/\s/.test(original[originalDiffEnd])
    ) {
      originalDiffEnd++;
    }

    // Extract the pieces
    const contextBefore = current
      .substring(leadingContext, contextStart)
      .trim();
    const removed = original.substring(contextStart, originalDiffEnd).trim();
    const added = current.substring(contextStart, currentDiffEnd).trim();

// Truncate if too long — 50 chars captures enough context to
    // differentiate versions that share the same opening change
    const maxLen = 50;
    const truncate = (str) =>
      str.length > maxLen ? str.substring(0, maxLen - 1) + "…" : str;

    return {
      contextBefore: truncate(contextBefore),
      removed: truncate(removed),
      added: truncate(added),
      isAdditionOnly: !removed && added,
      isDeletionOnly: removed && !added,
    };
};

  /**
   * Find the last word-level change between two strings.
   * Scans from the end to find the trailing edge of the diff region.
   * Returns null if the diff region is small enough that first and last
   * changes overlap (i.e. there is effectively only one change area).
   *
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {Object|null} Last change details or null if same region as first change
   */
  proto.findLastWordChange = function (current, original) {
    if (!current || !original || current === original) return null;

    // Find matching prefix length
    let prefixLen = 0;
    const minLen = Math.min(current.length, original.length);
    while (prefixLen < minLen && current[prefixLen] === original[prefixLen]) {
      prefixLen++;
    }

    // Find matching suffix length
    let suffixLen = 0;
    while (
      suffixLen < current.length - prefixLen &&
      suffixLen < original.length - prefixLen &&
      current[current.length - 1 - suffixLen] ===
        original[original.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    // Diff region boundaries
    const curDiffEnd = current.length - suffixLen;
    const origDiffEnd = original.length - suffixLen;

    // If diff regions are empty, no change to show
    if (curDiffEnd <= prefixLen && origDiffEnd <= prefixLen) return null;

    // If diff region is short enough that first and last overlap, return null
    // (renderDiffPreview will just use firstChange)
    const maxSnippet = 25;
    if (
      curDiffEnd - prefixLen <= maxSnippet &&
      origDiffEnd - prefixLen <= maxSnippet
    ) {
      return null;
    }

    // Extract the END of each diff region (up to maxSnippet chars)
    let curSnipStart = Math.max(prefixLen, curDiffEnd - maxSnippet);
    let origSnipStart = Math.max(prefixLen, origDiffEnd - maxSnippet);

    // Expand forward to word boundary so we don't start mid-word
    while (curSnipStart > prefixLen && !/\s/.test(current[curSnipStart - 1])) {
      curSnipStart--;
    }
    while (
      origSnipStart > prefixLen &&
      !/\s/.test(original[origSnipStart - 1])
    ) {
      origSnipStart--;
    }

    // Trailing context from the matching suffix
    const contextEnd = Math.min(current.length, curDiffEnd + 15);
    let contextBoundary = curDiffEnd;
    while (contextBoundary < contextEnd && !/\s/.test(current[contextBoundary])) {
      contextBoundary++;
    }

    const removed = original.substring(origSnipStart, origDiffEnd).trim();
    const added = current.substring(curSnipStart, curDiffEnd).trim();
    const contextAfter = current.substring(curDiffEnd, contextBoundary).trim();

    // Truncate — prefix with ellipsis since we are showing the tail end
    const truncate = (str) =>
      str.length > maxSnippet
        ? "…" + str.substring(str.length - maxSnippet + 1)
        : str;

    return {
      contextAfter: contextAfter.length > 15 ? contextAfter.substring(0, 14) + "…" : contextAfter,
      removed: truncate(removed),
      added: truncate(added),
      isAdditionOnly: !removed && !!added,
      isDeletionOnly: !!removed && !added,
    };
  };

  /**
   * Get first meaningful (non-empty, non-whitespace) line from content
   * @param {string} content - Content to extract from
   * @returns {string} First meaningful line, truncated
   */
  proto.getFirstMeaningfulLine = function (content) {
    if (!content) return "(empty)";
    const lines = content.split("\n").filter((l) => l.trim());
    const firstLine = lines[0] || content.substring(0, 50);
    const cleaned = firstLine.replace(/\s+/g, " ").trim();
return cleaned.length > 40 ? cleaned.substring(0, 37) + "…" : cleaned;
  };

  /**
   * Find lines unique to current content (not present in original).
   * Captures both genuinely new lines AND modified lines, since a modified
   * line exists in current but not in original.
   *
   * Returns null if no meaningful unique lines found.
   *
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {Object|null} { count, first, last, hasDifferentEnds }
   */
  proto.getUniqueLines = function (current, original) {
    if (!current || !original || current === original) return null;

    const currentLines = current.split("\n").filter((l) => l.trim());
    const originalSet = new Set(original.split("\n").map((l) => l.trim()));

    // Lines in current that are not in original (by trimmed content)
    const unique = currentLines.filter((l) => !originalSet.has(l.trim()));

    if (unique.length === 0) return null;

    const maxLen = 50;
    const truncate = (str) =>
      str.length > maxLen ? str.substring(0, maxLen - 1) + "…" : str;

    const first = truncate(unique[0].trim());
    const last = truncate(unique[unique.length - 1].trim());

    return {
      count: unique.length,
      first,
      last,
      hasDifferentEnds: unique.length > 1 && first !== last,
    };
  };

  /**
   * Render accessible HTML for diff preview
   * @param {Object} diffResult - Result from computeDiff()
   * @returns {string} Accessible HTML string
   */
  proto.renderDiffPreview = function (diffResult) {
    if (!diffResult) {
      return `<span class="diff-preview-fallback">(unknown)</span>`;
    }

    // Identical content
    if (diffResult.magnitude === "identical") {
      return `
    <span class="diff-preview diff-preview-identical" role="status">
      ${getIcon("check")} No changes from original
    </span>
  `.trim();
    }

    // No original to compare (e.g., ZIP original itself)
    if (diffResult.magnitude === "unknown" && diffResult.preview) {
      return `
    <span class="diff-preview diff-preview-content">
      ${getIcon("document")}
      <span class="diff-preview-text">"${this.escapeHtml(
        diffResult.preview,
      )}"</span>
    </span>
  `.trim();
    }

// Unique lines preview — cross-referenced distinguishing line preferred,
    // then last unique line. Enters this branch when we have EITHER a
    // cross-referenced distinguishing line OR hasDifferentEnds on unique lines.
    if (diffResult.uniqueLines && (diffResult.distinguishingLine || diffResult.uniqueLines.hasDifferentEnds)) {
      const ul = diffResult.uniqueLines;
      const displayLine = diffResult.distinguishingLine || ul.last;

      // Build stats hint with percentage for extra differentiation
      const hasLineChanges =
        diffResult.linesAdded > 0 || diffResult.linesRemoved > 0;
      const pctPart =
        diffResult.percentChanged != null
          ? `${diffResult.percentChanged}%`
          : "";
      let statsText = "";
      if (hasLineChanges && pctPart) {
        statsText = `${pctPart}, ${diffResult.summary}`;
      } else if (hasLineChanges) {
        statsText = diffResult.summary;
      } else if (pctPart) {
        statsText = `${pctPart} changed`;
      }
      const statsHint = statsText
        ? `<span class="diff-stats-hint">(${this.escapeHtml(statsText)})</span>`
        : "";

      // Count badge — always different between versions, quick visual scan
      const countBadge = `<span class="diff-unique-count">${ul.count} unique line${ul.count !== 1 ? "s" : ""}</span>`;

      return `
        <span class="diff-preview diff-preview-unique" role="group" aria-label="${ul.count} unique line${ul.count !== 1 ? "s" : ""} in this version">
          <ins class="diff-added">…${this.escapeHtml(displayLine)}</ins>
          ${countBadge}
          ${statsHint}
        </span>
      `.trim();
    }

    // Prefer firstChange — with increased snippet length (50 chars) it now captures
    // enough unique content to differentiate versions. lastChange is retained in the
    // diffResult for future use but not shown in the preview.
    const changeToShow = diffResult.firstChange;

    if (changeToShow) {
      const fc = changeToShow;
      const isLastChange = false;

      // Build stats hint — include percentage for extra differentiation
      const hasLineChanges =
        diffResult.linesAdded > 0 || diffResult.linesRemoved > 0;
      const pctPart =
        diffResult.percentChanged != null
          ? `${diffResult.percentChanged}%`
          : "";
      let statsText = "";
      if (hasLineChanges && pctPart) {
        statsText = `${pctPart}, ${diffResult.summary}`;
      } else if (hasLineChanges) {
        statsText = diffResult.summary;
      } else if (pctPart) {
        statsText = `${pctPart} changed`;
      }
      const statsHint = statsText
        ? `<span class="diff-stats-hint">(${this.escapeHtml(statsText)})</span>`
        : "";

      // Context: firstChange uses contextBefore, lastChange uses contextAfter
      const contextHTML = isLastChange
        ? fc.contextAfter
          ? ` <span class="diff-context">${this.escapeHtml(fc.contextAfter)}</span>`
          : ""
        : fc.contextBefore
          ? `<span class="diff-context">${this.escapeHtml(fc.contextBefore)} </span>`
          : "";

      // Addition only
      if (fc.isAdditionOnly) {
        return `
          <span class="diff-preview diff-preview-addition" role="group" aria-label="Content added">
            ${isLastChange ? "" : contextHTML}
            <span class="visually-hidden">Added: </span>
            <ins class="diff-added">${this.escapeHtml(fc.added)}</ins>
            ${isLastChange ? contextHTML : ""}
            ${statsHint}
          </span>
        `.trim();
      }

      // Deletion only
      if (fc.isDeletionOnly) {
        return `
          <span class="diff-preview diff-preview-deletion" role="group" aria-label="Content removed">
            ${isLastChange ? "" : contextHTML}
            <span class="visually-hidden">Removed: </span>
            <del class="diff-removed">${this.escapeHtml(fc.removed)}</del>
            ${isLastChange ? contextHTML : ""}
            ${statsHint}
          </span>
        `.trim();
      }

      // Standard change (removal + addition)
      return `
        <span class="diff-preview diff-preview-change" role="group" aria-label="Content change">
          ${isLastChange ? "" : contextHTML}
<del class="diff-removed">
            <span class="visually-hidden">was </span>${this.escapeHtml(
              fc.removed,
            )}
          </del>
          <span class="diff-arrow">${getIcon("arrowRight")}</span>
          <span class="visually-hidden">, now </span>
          <ins class="diff-added">${this.escapeHtml(fc.added)}</ins>
          ${isLastChange ? contextHTML : ""}
          ${statsHint}
        </span>
      `.trim();
    }

    // Fallback to summary with badge
    const badgeClass =
      diffResult.magnitude === "moderate"
        ? "diff-badge-moderate"
        : "diff-badge-minor";

    return `
      <span class="diff-preview diff-preview-summary" role="group" aria-label="Document changes">
        <span class="diff-badge ${badgeClass}">${diffResult.magnitude}</span>
        <span class="diff-stats">${this.escapeHtml(diffResult.summary)}</span>
      </span>
    `.trim();
  };

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  proto.escapeHtml = function (str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  console.log("[SessionRestorer] Diff preview mixin loaded");
})();
