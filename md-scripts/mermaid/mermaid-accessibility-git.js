/**
 * Mermaid Accessibility - Git Graph Module
 *
 * Generates accessible descriptions for git graphs from the shared parse
 * adapter's git surface (mermaid-parse-adapter.js), never from the SVG or a
 * source-text scan — with one measured exception, the mainBranchName rename
 * detection below. Stage 2 of the git graph work: before this module existed,
 * git graphs received the core's honest "no description available" fallback,
 * and the legacy keyword scan's gitGraph key was the last scan key still
 * reaching the generic template.
 *
 * The adapter hands over commits in seq order with the merge parent
 * convention already decoded (mergedFromBranch, cherryPickSourceId), machine
 * cherry-pick tags already filtered from tags, and branches in display order
 * (docs/mermaid-gitgraph-stage1-adapter-report-2026-08-03.md). Parses are
 * serialised inside the adapter, so this module needs no queue of its own.
 */
const GitGraphModule = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[Git][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Git][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[Git][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Git][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[Git][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Git][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[Git][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Git][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // Shared prose layer (loads before every diagram module — knowledge base
  // § 2): narrationNumber, formatList, capitalize.
  const Common = window.MermaidAccessibilityCommon;

  /**
   * Detect a mainBranchName rename in the config text ahead of the opener.
   *
   * Measured in stage 1 probe A
   * (docs/mermaid-gitgraph-stage1-adapter-report-2026-08-03.md): the DRAWING
   * applies a mainBranchName rename — the branch label reads "trunk" — while
   * the data path this module narrates from does not: commits and branches
   * still read "main" through getDiagramFromText, in both config forms
   * (stage 0 G8). Narration therefore substitutes the rename itself, so the
   * spoken branch matches what is drawn.
   *
   * Only the text BEFORE the first line whose trimmed content starts with
   * "gitGraph" is scanned — the init directive and the YAML frontmatter can
   * only sit there — so a commit id or tag mentioning mainBranchName can
   * never trigger a rename. Both config spellings are matched: the
   * init-directive style `'mainBranchName': 'trunk'` (single or double
   * quotes) and the frontmatter style `mainBranchName: trunk` (unquoted).
   *
   * @param {string} code - The original mermaid code
   * @returns {string} The renamed main branch, or "" when there is none
   */
  function detectMainBranchRename(code) {
    const lines = String(code || "").split("\n");
    const openerIndex = lines.findIndex((line) =>
      line.trim().startsWith("gitGraph")
    );
    if (openerIndex <= 0) {
      return "";
    }

    const preamble = lines.slice(0, openerIndex).join("\n");
    const match = preamble.match(
      /["']?mainBranchName["']?\s*:\s*(?:["']([^"']+)["']|([^\s"',}]+))/
    );
    if (!match) {
      return "";
    }

    const name = match[1] || match[2] || "";
    logDebug("detectMainBranchRename", `Rename detected: "${name}"`);
    return name;
  }

  /**
   * Escape author text at an HTML sink — conservatively, because this module
   * cannot use Common.escapeHtml.
   *
   * The parse adapter delivers git graph's fields ALREADY PARTLY
   * ENTITY-ENCODED, and in two contradictory ways within a single parse of a
   * single diagram (docs/mermaid-adapter-four-hostile-capture-2026-08-06.md
   * § 4, re-measured in docs/mermaid-git-escaping-adoption-2026-08-07.md § 1).
   * Branch names, commit ids and tag names arrive with < and > encoded and &
   * raw; the body title arrives the other way round. Common.escapeHtml would
   * escape the & of an incoming &lt;, and a reader would then see the
   * characters "&lt;b&gt;bold&lt;/b&gt;" where the author typed "<b>bold</b>".
   *
   * Decoding first is not an option either: the encoding is NOT reversible.
   * An author-typed "&lt;" and an author-typed "<" both arrive as the same
   * four bytes, so no decode can tell them apart (adoption report § 2). This
   * escapes what is unambiguous and leaves alone what is not — < and > always,
   * & only where it does not already open an entity.
   *
   * Ampersands are handled FIRST, so the decision is taken on the incoming
   * bytes alone and this function can never re-escape its own output.
   *
   * Text sinks only. Every value narrated by this module lands between tags,
   * never inside an attribute, so quote characters are deliberately untouched.
   *
   * @param {string} text - Author text exactly as the adapter delivered it
   * @returns {string} The text, safe to interpolate into an HTML string
   */
  function escapeNarration(text) {
    return String(text)
      .replace(/&(?!lt;|gt;|amp;|quot;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * The narrated reference for one commit: its id when the author named it,
   * else its message when it has one, else null (unnamed). Auto-generated
   * ids are random per parse (stage 0 G1) and are never spoken.
   * @param {Object} commit - An adapter commit object
   * @returns {string|null} The reference, or null for an unnamed commit
   */
  function refFor(commit) {
    if (commit.hasCustomId) {
      return commit.id;
    }
    return commit.message ? commit.message : null;
  }

  /**
   * Count phrases with digits always ("2 commits", "1 branch"). The plural
   * is spelled out by the caller — "branch" pluralises to "branches", which
   * a bare -s suffix gets wrong.
   * @param {number} count - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} e.g. "3 branches"
   */
  function countPhrase(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  /**
   * The type marker appendix for one commit, or "" when it carries none.
   * Reverse and highlight are normal commits with a drawn marker; a merge
   * can carry the same marker through its overrideKind (stage 0 G5:
   * customType, decoded by the adapter).
   * @param {Object} commit - An adapter commit object
   * @returns {string} "Shown as a reverse commit." etc., or ""
   */
  function typeMarkerSentence(commit) {
    if (commit.kind === "reverse" || commit.overrideKind === "reverse") {
      return "Shown as a reverse commit.";
    }
    if (commit.kind === "highlight" || commit.overrideKind === "highlight") {
      return "Shown as a highlighted commit.";
    }
    return "";
  }

  /**
   * The tags appendix for one commit, or "" when it has no author tags.
   * The adapter has already filtered machine cherry-pick markers out.
   * @param {Object} commit - An adapter commit object
   * @returns {string} e.g. 'Tagged "wip" and "urgent".', or ""
   */
  function tagsSentence(commit) {
    if (!commit.tags || commit.tags.length === 0) {
      return "";
    }
    // Each tag is escaped before the join, so formatList's own furniture —
    // the commas and the "and" — is never escaped with it.
    const quoted = commit.tags.map((tag) => `"${escapeNarration(tag)}"`);
    return `Tagged ${Common.formatList(quoted)}.`;
  }

  /**
   * Render one commit as a history list item: a base sentence, then the
   * type marker appendix, then the tags appendix.
   * @param {Object} commit - An adapter commit object
   * @param {Map<string, Object>} commitsById - This graph's commits by id
   * @param {function(string): string} displayName - branchDisplayName
   * @returns {string} An <li> fragment
   */
  function renderHistoryItem(commit, commitsById, displayName) {
    // Transform first, then escape: the rename substitution runs inside
    // displayName, and escapeNarration is applied to its result. Escaped once
    // into a local, because several templates below reuse the same branch.
    // Nothing here mutates the commit — commit.id stays raw, so the
    // commitsById lookup below still matches.
    const branch = escapeNarration(displayName(commit.branch));
    let base;

    if (commit.kind === "merge") {
      base = commit.mergedFromBranch
        ? `Merge of ${escapeNarration(displayName(commit.mergedFromBranch))} into ${branch}`
        : `A merge commit on ${branch}`;
      // A merge's custom id is authoritative from the db (stage 1); it is
      // inserted before the full stop.
      if (commit.hasCustomId) {
        base += `, named "${escapeNarration(commit.id)}"`;
      }
      base += ".";
    } else if (commit.kind === "cherryPick") {
      if (commit.cherryPickSourceId) {
        // The source is resolved in this graph's own commits; a source with
        // no speakable reference (or one missing entirely) falls back to
        // the raw id string. The lookup key stays RAW; only the narrated
        // reference is escaped.
        const source = commitsById.get(commit.cherryPickSourceId);
        const sourceRef =
          (source && refFor(source)) || commit.cherryPickSourceId;
        base = `Cherry-pick of "${escapeNarration(sourceRef)}" onto ${branch}.`;
      } else {
        base = `A cherry-pick onto ${branch}.`;
      }
    } else {
      // normal, reverse, highlight (markers are appendices), and the
      // defensive "unknown" arm, which is spoken as an unnamed commit.
      const ref = commit.kind === "unknown" ? null : refFor(commit);
      base =
        ref === null
          ? `A commit on ${branch}.`
          : `Commit "${escapeNarration(ref)}" on ${branch}.`;
    }

    const sentences = [base];

    const marker = typeMarkerSentence(commit);
    if (marker) {
      sentences.push(marker);
    }

    const tags = tagsSentence(commit);
    if (tags) {
      sentences.push(tags);
    }

    return `<li>${sentences.join(" ")}</li>`;
  }

  /**
   * Parse the code through the adapter's git surface and refuse to narrate
   * an unverified graph.
   *
   * A parse rejection is deliberately NOT caught here — the core's catch
   * turns it into the honest generation-failed fallback. A failed adapter
   * self-check throws for the same reason.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to the adapter's git graph
   */
  async function parseVerified(code) {
    const graph = await window.MermaidParseAdapter.parseGit(code);
    if (window.MermaidParseAdapter.isGitHealthy() === false) {
      throw new Error(
        "Parse adapter failed its git self-check; refusing to narrate an unverified graph"
      );
    }
    return graph;
  }

  /**
   * Generate a short description for a git graph.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to an object with HTML and plain text versions of the description
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const graph = await parseVerified(code);

    const commitCount = graph.commits.length;
    const branchCount = graph.branches.length;
    logDebug("Counts", `${commitCount} commits, ${branchCount} branches`);

    // The two forms diverge only in the title, which is the one piece of
    // author text this tier carries. The PLAIN form passes the adapter's
    // bytes through unchanged, and escaping a plain-text tier would put
    // entities into the figcaption and the aria-label. The HTML form escapes
    // conservatively, as every other sink in this module does.
    //
    // WHY THE PASS-THROUGH IS RIGHT — corrected 8 August 2026, because the
    // reasoning recorded here before was wrong in a way worth naming. It
    // said the adapter's encoding "is not reversible, so there is no decoded
    // form to hand it". That conflates two different properties. A decode
    // does exist and is well defined; what fails is INJECTIVITY against
    // author-typed literals, and that turns out not to be disqualifying —
    // the canvas resolves those collisions the same lossy way, so a decode
    // matching the canvas is right on the colliding inputs too
    // (docs/mermaid-quot-placeholder-capture-2026-08-08.md § 4.1).
    //
    // The real reason to leave ENTITY-ENCODED bytes alone is that this
    // surface draws into SVG <text>, where an author-typed `&quot;` is drawn
    // literally — measured, 0 foreignObjects (P4b in
    // docs/mermaid-git-escaping-adoption-2026-08-07.md § 1.4, completed for
    // this class in docs/mermaid-quot-adoption-2026-08-08.md § 1). Resolving
    // them would move the description AWAY from the drawing.
    //
    // PLACEHOLDER bytes are a different class and are no longer this tier's
    // problem: the adapter now resolves them upstream, per its measured
    // C-PH verdict for this surface, so `graph.title` arrives carrying the
    // characters the author meant and the canvas shows.
    const titledText = graph.title ? ` titled "${graph.title}"` : "";
    const titledHtml = graph.title
      ? ` titled "${escapeNarration(graph.title)}"`
      : "";
    const tail =
      commitCount === 0
        ? "with no commits."
        : `with ${countPhrase(commitCount, "commit", "commits")} on ${countPhrase(branchCount, "branch", "branches")}.`;

    const text = `A git graph${titledText} ${tail}`;
    const html = `A git graph${titledHtml} ${tail}`;

    logDebug("Final Short Description", text);

    return { html, text };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }

  /**
   * Generate a detailed description for a git graph.
   *
   * One section: an Overview paragraph, then the History as an ordered list
   * in the adapter's seq order (stage 0 G11) — omitted entirely when there
   * are no commits. Branch names pass through branchDisplayName everywhere
   * they are spoken, so a mainBranchName rename matches the drawing.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating git graph description");

    const graph = await parseVerified(code);

    const commitCount = graph.commits.length;
    const branchCount = graph.branches.length;

    const rename = detectMainBranchRename(code);

    /**
     * The narrated name of one branch: the rename when the data path's
     * "main" is drawn under another name (stage 1 probe A), else the name.
     * @param {string} name - The branch name from the data path
     * @returns {string} The name as narrated
     */
    function branchDisplayName(name) {
      return rename && name === "main" ? rename : name;
    }

    const commitsById = new Map(
      graph.commits.map((commit) => [commit.id, commit])
    );

    // --- Overview -------------------------------------------------------
    const sentences = [];

    const titled = graph.title
      ? `, titled "${escapeNarration(graph.title)}",`
      : "";
    sentences.push(
      commitCount === 0
        ? `This git graph${titled} contains no commits.`
        : `This git graph${titled} shows ${countPhrase(commitCount, "commit", "commits")} on ${countPhrase(branchCount, "branch", "branches")}.`
    );

    if (branchCount >= 2) {
      // Rename first, escape second, and each name escaped before the join so
      // formatList's commas and "and" stay unescaped furniture.
      const names = graph.branches.map((branch) =>
        escapeNarration(branchDisplayName(branch.name))
      );
      sentences.push(`The branches are ${Common.formatList(names)}.`);
    }

    // A branch with no commits of its own is only detectable by walking the
    // commits (stage 0 G7: its head points at another branch's commit). The
    // sentence stays silent on a zero-commit graph, where "contains no
    // commits" already says it all.
    if (commitCount > 0) {
      const populated = new Set(graph.commits.map((commit) => commit.branch));
      const empty = graph.branches.filter(
        (branch) => !populated.has(branch.name)
      );

      if (empty.length > 0) {
        const countWord = Common.capitalize(
          Common.narrationNumber(empty.length)
        );
        const noun = empty.length === 1 ? "branch" : "branches";
        const possessive = empty.length === 1 ? "its" : "their";
        const verb = empty.length === 1 ? "has" : "have";
        // Same order as above. The `populated` set above is keyed on the RAW
        // branch name, so this narration transform cannot disturb the lookup.
        const names = Common.formatList(
          empty.map((branch) => escapeNarration(branchDisplayName(branch.name)))
        );
        sentences.push(
          `${countWord} ${noun}, ${names}, ${verb} no commits of ${possessive} own.`
        );
      }
    }

    // --- Assembly -------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);

    if (commitCount > 0) {
      parts.push(`<h4 class="mermaid-details-heading">History</h4>`);
      parts.push(`<ol class="git-history">`);
      for (const commit of graph.commits) {
        parts.push(renderHistoryItem(commit, commitsById, branchDisplayName));
      }
      parts.push(`</ol>`);
    }

    parts.push(`</section>`);

    // Newline-joined so text-content extraction keeps list boundaries apart.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption — the {html, text} object is the tier's own return shape,
  // reached through this wrapper exactly as the ER and class modules do.
  //
  // `generateShortHTML` publishes the OTHER half of that same object. The
  // escaped `html` form was built by the escaping adoption of 7 August 2026
  // (docs/mermaid-git-escaping-adoption-2026-08-07.md § 4) and, until this
  // registration, reached nothing: shortDescriptionWrapper discarded it and
  // the core's `typeof generator.generateShortHTML === "function"` test read
  // false, so the tier was generated and thrown away on every diagram. This
  // registration is what makes it live, and is register item 13's git half
  // (docs/mermaid-outstanding.md § 13). Async because the tier awaits the
  // parse adapter, exactly as the flowchart module's registration does; both
  // the core and the description panel await or thread the returned promise.
  window.MermaidAccessibility.registerDescriptionGenerator("gitGraph", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);

      return descriptions.html;
    },
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "Git Graph Module",
    "Git graph module loaded and registered on the parse adapter's git surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = GitGraphModule;
} else {
  window.GitGraphModule = GitGraphModule;
}
