/**
 * MathPix Chemistry Registry Writer — Lane C C-P2a.
 *
 * Converts comprehensive-tier chemistry HTML (the three-tag <p>/<ol>/<li>
 * subset emitted by mathpix-chemistry-prose.js's
 * _assembleComprehensiveDescriptionHTML) into appendix Markdown suitable for an
 * image registry long-description field, and provides the PF4 freeze predicate
 * that decides which provenance states a machine write may overwrite.
 *
 * C-P2a shipped the converter + freeze predicate. C-P2b adds the keying helper
 * (buildUrlToSmilesMap, internal) and the public generation routine
 * (writeChemistryDescriptions) — the generation half of the two-host write
 * flow. No host wiring lands here: the manager-open and export hosts call this
 * routine in a later pass.
 *
 * Provenance grounding: mathpix-scripts/docs/alt-text/pf4-provenance-contract.md
 *   — machine-owned states (`ai-generated`, `algo-generated`, `original`) are
 *   refreshable by this writer; the human-owned states named by the write
 *   stage's runtime freeze floor are not, and any unrecognised source freezes.
 *   The single decision point is isFrozenSource; see the freeze-floor block.
 *   NOTE: `isRefreshable` below is a SEPARATE, older predicate that is dead in
 *   the write path and disagrees with this on `original` — do not reach for it.
 *
 * @author Matthew Deeprose, University of Southampton
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ChemRegistryWriter]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ChemRegistryWriter]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[ChemRegistryWriter]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ChemRegistryWriter]", message, ...args);
  }

  // ==========================================================================
  // Entity decoding (fallback path only)
  //   The engine's _escapeHtml encodes in the order & < > " ' (ampersand
  //   FIRST). To reverse without double-decoding we must decode the ampersand
  //   LAST — otherwise "&amp;lt;" (an encoded literal "&lt;") would wrongly
  //   collapse to "<". DOMParser does this natively and correctly; this manual
  //   reversal is used only where DOMParser is unavailable.
  // ==========================================================================

  function _decodeEntities(str) {
    return String(str)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&"); // ampersand decoded last
  }

  // ==========================================================================
  // Fallback parser — used only when DOMParser is not present (non-browser).
  //   Walks the flat <p>…</p> / <ol>…</ol> sequence the engine emits, in
  //   document order, and reads <li>…</li> children inside each <ol>.
  // ==========================================================================

  function _convertViaRegex(html) {
    const blocks = [];
    const blockRe = /<p>([\s\S]*?)<\/p>|<ol>([\s\S]*?)<\/ol>/gi;
    let match;
    while ((match = blockRe.exec(html)) !== null) {
      if (match[1] !== undefined) {
        const text = _decodeEntities(match[1]).trim();
        if (text) blocks.push(text);
      } else {
        const inner = match[2] || "";
        const items = [];
        const liRe = /<li>([\s\S]*?)<\/li>/gi;
        let li;
        let n = 1;
        while ((li = liRe.exec(inner)) !== null) {
          items.push(n + ". " + _decodeEntities(li[1]).trim());
          n++;
        }
        if (items.length) blocks.push(items.join("\n"));
      }
    }
    return blocks.join("\n\n").trim();
  }

  // ==========================================================================
  // Public: comprehensiveHtmlToAppendixMarkdown
  // ==========================================================================

  /**
   * Convert comprehensive-tier chemistry HTML into appendix Markdown.
   *
   * Input is the <p>/<ol>/<li> subset emitted by the description engine.
   * Each top-level <p> becomes one paragraph; each <ol> becomes a numbered
   * list (one `1.`-style line per <li>, in document order). Blocks are
   * separated by a single blank line, and the result is trimmed so there is no
   * leading or trailing blank line. No ATX heading and no list marker other
   * than the ordered `1.` form is emitted. Empty or non-string input returns
   * the empty string.
   *
   * Entities the engine encoded (&amp; &lt; &gt; &quot; &#39;) are decoded back
   * to plain characters. The preferred decode path reads `textContent` per
   * element via DOMParser, which mirrors how the engine encoded the prose and
   * avoids any double-decoding. A small explicit parser handles the rare
   * non-DOM environment.
   *
   * @param {string} html - Comprehensive HTML (three-tag subset).
   * @returns {string} Appendix Markdown, or "" for empty input.
   */
  function comprehensiveHtmlToAppendixMarkdown(html) {
    if (typeof html !== "string" || html.trim() === "") return "";

    // Non-DOM fallback (e.g. a bare Node context).
    if (typeof DOMParser === "undefined") {
      logDebug("comprehensiveHtmlToAppendixMarkdown(): DOMParser absent — using regex fallback");
      return _convertViaRegex(html);
    }

    let root;
    try {
      const doc = new DOMParser().parseFromString(
        "<div id=\"__chem_writer_root\">" + html + "</div>",
        "text/html",
      );
      root = doc.getElementById("__chem_writer_root");
    } catch (err) {
      logWarn("comprehensiveHtmlToAppendixMarkdown(): DOMParser threw — using regex fallback", err);
      return _convertViaRegex(html);
    }
    if (!root) {
      logWarn("comprehensiveHtmlToAppendixMarkdown(): parse root missing — using regex fallback");
      return _convertViaRegex(html);
    }

    const blocks = [];
    for (const node of root.children) {
      const tag = node.tagName.toLowerCase();
      if (tag === "p") {
        // textContent natively decodes the entities the engine emitted.
        const text = node.textContent.trim();
        if (text) blocks.push(text);
      } else if (tag === "ol") {
        const items = [];
        let n = 1;
        for (const li of node.children) {
          if (li.tagName.toLowerCase() !== "li") continue;
          items.push(n + ". " + li.textContent.trim());
          n++;
        }
        if (items.length) blocks.push(items.join("\n"));
      }
      // Any other tag is silently ignored — the engine emits only p/ol/li.
    }

    return blocks.join("\n\n").trim();
  }

  // ==========================================================================
  // Freeze floor (PF4) — ONE predicate, read from the write stage at RUNTIME
  //
  //   Every freeze decision in this file flows through isFrozenSource below.
  //   Before this was centralised, three sites decided independently: this
  //   file's classifyField hard-coded the floor's literals, and the
  //   text-in-image and title gates each tested the source inline against a
  //   NARROWER list that omitted "ai-edited" — so a person's correction to a
  //   machine-written text-in-image field was silently replaced with raw
  //   SMILES on the next chemistry refresh.
  // ==========================================================================

  /**
   * FALLBACK ONLY — a literal copy of today's freeze floor.
   *
   * The PRIMARY source is the runtime read from the write stage (see
   * _resolveFrozenSources). This copy exists solely so a missing or malformed
   * export cannot leave the writer with no floor at all; it is correct as of
   * today and will go stale the moment the real floor moves, which is why it is
   * never consulted while the export is reachable.
   */
  const FROZEN_SOURCES_FALLBACK = Object.freeze([
    "user",
    "ai-reviewed",
    "ai-edited",
  ]);

  /**
   * This writer's OWN domain knowledge: the provenance states whose content is
   * machine-owned, so this writer may regenerate them freely as the chemistry
   * generator improves. Deliberately not derived from the write stage — the
   * floor says what is protected, and this says what THIS writer considers its
   * own to refresh. Anything in neither list is unrecognised and freezes
   * (forward-safety).
   */
  const MACHINE_REFRESHABLE_SOURCES = Object.freeze([
    "ai-generated",
    "algo-generated",
    "original",
  ]);

  /** Warn once per session, not once per call — this runs in a per-image loop. */
  let _floorWarningIssued = false;

  /**
   * Resolve the freeze floor at CALL time from the write stage's export.
   *
   * Call-time rather than load-time by necessity: tools.html loads this file
   * BEFORE alt-text-write-stage.js, so the global does not yet exist when this
   * module is defined. It always exists by the time writeChemistryDescriptions
   * can be reached, because that runs on a host gesture long after both tags
   * have executed.
   *
   * @returns {string[]} The runtime floor, or the fallback copy.
   */
  function _resolveFrozenSources() {
    const stage =
      typeof window !== "undefined" ? window.MathPixAltTextWriteStage : null;
    const floor = stage && stage.FROZEN_SOURCES;
    if (Array.isArray(floor) && floor.length > 0) return floor;

    if (!_floorWarningIssued) {
      _floorWarningIssued = true;
      logWarn(
        "freeze floor unreachable at window.MathPixAltTextWriteStage.FROZEN_SOURCES — falling back to the local copy (correct as of today)",
      );
    }
    return FROZEN_SOURCES_FALLBACK;
  }

  /**
   * True when a field's provenance source forbids an automatic machine write.
   *
   * THE CONTRACT: the freeze floor is read from the write stage at runtime —
   * nothing wider, nothing narrower — so a change there reaches this writer
   * without a second edit. On top of that floor this writer applies its own
   * forward-safe rule: a non-null source it does not recognise as
   * machine-refreshable is frozen, so a provenance state added in the future
   * defaults to protected rather than to overwritable.
   *
   * THE FALLBACK DIRECTION, and why it is that way round: if the export is
   * unreachable the predicate degrades to the local copy of today's floor. That
   * is deliberately correct-as-of-today rather than maximally cautious. Freezing
   * everything would break the refresh workflow the chemistry generator exists
   * to serve — machine content must keep improving — while freezing nothing
   * would silently overwrite human work. So the fallback NEVER over-freezes the
   * refresh workflow and NEVER under-freezes human work.
   *
   * @param {string|null|undefined} source - The field's `*Source` value.
   * @returns {boolean} True when the field is frozen against a machine write.
   */
  function isFrozenSource(source) {
    // A never-written field is not frozen — there is no decision to displace.
    if (source === null || source === undefined) return false;

    if (_resolveFrozenSources().includes(source)) return true;

    // Forward-safety: unrecognised, non-null sources freeze.
    return !MACHINE_REFRESHABLE_SOURCES.includes(source);
  }

  // ==========================================================================
  // Public: isRefreshable (PF4 freeze predicate)
  // ==========================================================================

  /**
   * Decide whether a machine write may overwrite a registry field carrying the
   * given provenance source. Per the PF4 contract, only machine-owned states
   * are refreshable: a never-written field (`null`/absent) and an
   * `ai-generated` value. Human-touched states and the imported `original`
   * state are frozen and must not be refreshed by a machine.
   *
   * NOT THE WRITE PATH'S PREDICATE, and kept only for its existing callers.
   * `isFrozenSource` is what every gate in this file consults; the two disagree
   * about `original`, which this treats as frozen and the write path refreshes.
   * Reaching for this one by name would silently re-narrow the freeze floor.
   *
   * @param {string|null|undefined} source - The field's `*Source` value.
   * @returns {boolean} True if a machine write may overwrite, false if frozen.
   */
  function isRefreshable(source) {
    return (
      source == null ||
      source === "ai-generated" ||
      source === "algo-generated"
    );
  }

  // ==========================================================================
  // Internal: buildUrlToSmilesMap
  // ==========================================================================

  /**
   * Build a Map of image URL → SMILES notation from MMD content.
   *
   * The two regexes are copied verbatim from mathpix-mmd-preview.js's
   * _extractChemistrySmiles — the `\includegraphics` form and the markdown-image
   * form Mathpix emits for chemistry crops — so every chemistry-keying site
   * stays in lockstep. Each match keys by the URL capture (group 2) with the
   * SMILES capture (group 1) as the value. Falsy input yields an empty Map.
   *
   * Pass the pristine MMD (CDN URLs, never blob-rewritten) so the URL keys match
   * the registry entries' `originalUrl`.
   *
   * @param {string} mmd - MMD content.
   * @returns {Map<string,string>} URL → SMILES.
   */
  function buildUrlToSmilesMap(mmd) {
    const urlToSmiles = new Map();
    if (!mmd) return urlToSmiles;

    // \includegraphics form.
    const includeGfxRegex =
      /\\includegraphics\s*\[alt=\{[^}]*<smiles[^>]*>(.*?)<\/smiles>[^}]*\}[^\]]*\]\s*\{([^}]+)\}/g;
    let match;
    while ((match = includeGfxRegex.exec(mmd)) !== null) {
      const smiles = match[1];
      const url = match[2].trim();
      if (smiles && url) urlToSmiles.set(url, smiles);
    }

    // Markdown-image form (![<smiles>X</smiles>](URL)) — some PDFs (typically
    // Word-derived) emit chemistry images this way.
    const mdGfxRegex = /!\[<smiles[^>]*>(.*?)<\/smiles>\]\(([^)]+)\)/g;
    while ((match = mdGfxRegex.exec(mmd)) !== null) {
      const smiles = match[1];
      const url = match[2].trim();
      if (smiles && url) urlToSmiles.set(url, smiles);
    }

    return urlToSmiles;
  }

  // ==========================================================================
  // Working-document slot readers (C-P3 content-aware refresh gate)
  //
  //   A localStorage-autosave reload rebuilds the registry via buildFromMMD,
  //   which resets a chemistry field's *Source to null and its value to "".
  //   The provenance stamp is therefore unreliable post-reload
  //   (nextSource(null) === "user"). The only reliable signal is the current
  //   WORKING-document slot: a raw <smiles> tag (or an empty slot) is
  //   machine-owned and refreshable; prose is a human edit to protect.
  //
  //   The two readers below mirror, verbatim, the robustness of code that is
  //   NOT exposed for reuse, so the duplication is deliberate (drift risk
  //   noted — fix one, fix all):
  //     - the brace-matched alt extraction of mathpix-alt-text-integrator.js
  //       _extractCurrentAlt (via local copies of the serialiser's
  //       findMatchingBrace / unescapeAltFromLatex), and the two reference
  //       forms of buildUrlToSmilesMap above; and
  //     - the marker-anchored appendix parse of
  //       mathpix-alt-text-mmd-serialiser.js _parseAppendixEntries.
  // ==========================================================================

  // Mirror of mathpix-alt-text-mmd-serialiser.js findMatchingBrace — a
  // backslash-escaped `\{` / `\}` does not affect depth. Returns the index of
  // the matching `}` for the `{` at openIndex, or -1.
  function _findMatchingBrace(text, openIndex) {
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

  // Mirror of mathpix-alt-text-mmd-serialiser.js unescapeAltFromLatex — reverse
  // order: braces first, then backslashes. Matches exactly what
  // _extractCurrentAlt returns, so an adopted slot value written into the
  // registry no-ops on propagation rather than re-escaping.
  function _unescapeAltFromLatex(text) {
    if (typeof text !== "string") return "";
    return text
      .replace(/\\\{/g, "{")
      .replace(/\\\}/g, "}")
      .replace(/\\\\/g, "\\");
  }

  // Mirror of mathpix-alt-text-mmd-serialiser.js APPENDIX_MARKER_RE /
  // APPENDIX_HEADING_RE — the marker comment is the canonical per-image anchor.
  const _APPENDIX_MARKER_RE = /<!--\s*img-desc:([^\s>][^\s>]*?)\s*-->/;
  const _APPENDIX_HEADING_RE = /^(#{1,6})\s+\S/;

  /**
   * Extract the FULL current alt-slot content of every image reference in a
   * working MMD string, keyed by URL. Mirrors the two reference forms of
   * buildUrlToSmilesMap (the `\includegraphics` form and the markdown-image
   * form) but captures the WHOLE alt — prose or raw `<smiles>` — not just the
   * SMILES, brace-matched per _extractCurrentAlt so a prose alt containing
   * braces is captured whole.
   *
   * Operates line by line, matching _extractCurrentAlt's first-image-on-line
   * contract. The `\includegraphics` alt is LaTeX-decoded; the markdown alt is
   * returned verbatim (markdown alt is not LaTeX-escaped). First reference wins
   * per URL. Empty Map for falsy / non-string input.
   *
   * @param {string} mmd - Working MMD (currentMMD), NOT the pristine results.mmd.
   * @returns {Map<string,string>} URL → current alt-slot content.
   */
  function extractWorkingAltByUrl(mmd) {
    const map = new Map();
    if (!mmd || typeof mmd !== "string") return map;

    const igRe = /\\includegraphics\s*(\[([^\]]*)\])?\s*\{([^}]+)\}/;
    const altRe = /(?:^|,)\s*alt\s*=\s*\{/;
    const mdRe = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/;

    for (const line of mmd.split("\n")) {
      const ig = igRe.exec(line);
      if (ig) {
        const optionsStr = ig[2] || "";
        const url = (ig[3] || "").trim();
        let altRaw = "";
        const altMatch = altRe.exec(optionsStr);
        if (altMatch) {
          const braceStart = altMatch.index + altMatch[0].length - 1;
          const braceEnd = _findMatchingBrace(optionsStr, braceStart);
          if (braceEnd !== -1) {
            altRaw = _unescapeAltFromLatex(
              optionsStr.substring(braceStart + 1, braceEnd),
            );
          }
        }
        if (url && !map.has(url)) map.set(url, altRaw);
        continue;
      }
      const md = mdRe.exec(line);
      if (md) {
        const url = (md[2] || "").trim();
        if (url && !map.has(url)) map.set(url, md[1]);
      }
    }
    return map;
  }

  /**
   * Extract the current appendix long-description text of every image in a
   * working MMD string, keyed by registry image ID. Mirrors the module-private
   * mathpix-alt-text-mmd-serialiser.js _parseAppendixEntries: each
   * `<!-- img-desc:ID -->` marker anchors an entry whose text is the prose
   * between its heading line (if any) and the next marker (or end-of-document),
   * with leading / trailing blank lines trimmed and internal blank lines
   * preserved. Duplicate IDs keep the first occurrence. Empty Map for falsy /
   * non-string input.
   *
   * @param {string} mmd - Working MMD (currentMMD).
   * @returns {Map<string,string>} image ID → current long-description text.
   */
  function extractWorkingLongById(mmd) {
    const map = new Map();
    if (!mmd || typeof mmd !== "string") return map;

    const lines = mmd.split("\n");
    const markers = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(_APPENDIX_MARKER_RE);
      if (m) markers.push({ line: i, id: m[1] });
    }
    if (markers.length === 0) return map;

    for (let mi = 0; mi < markers.length; mi++) {
      const { line: markerLine, id } = markers[mi];
      const nextMarkerLine =
        mi + 1 < markers.length ? markers[mi + 1].line : lines.length;

      if (map.has(id)) {
        logWarn(
          'extractWorkingLongById(): duplicate marker for ID "' +
            id +
            '" — keeping first occurrence only',
        );
        continue;
      }

      let headingLine = -1;
      for (let i = markerLine + 1; i < nextMarkerLine; i++) {
        const trimmedI = lines[i].trim();
        if (_APPENDIX_HEADING_RE.test(trimmedI)) {
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

      map.set(id, textLines.join("\n"));
    }
    return map;
  }

  /**
   * Raw-`<smiles>` slot test. True iff the string holds a `<smiles>` tag or a
   * ```smiles fence, via
   * window.MathPixChemistryUtils.extractChemistryFromResponse({ text: s }).
   * An empty / whitespace-only string is NOT raw-smiles (it classifies as
   * "empty", which is refreshable). Defensive: false when the util is absent or
   * throws.
   *
   * @param {string} s
   * @returns {boolean}
   */
  function isRawSmilesSlot(s) {
    if (typeof s !== "string" || s.trim() === "") return false;
    const utils = window.MathPixChemistryUtils;
    if (!utils || typeof utils.extractChemistryFromResponse !== "function") {
      return false;
    }
    try {
      return utils.extractChemistryFromResponse({ text: s }).length > 0;
    } catch (err) {
      logWarn("isRawSmilesSlot(): extractChemistryFromResponse threw", err);
      return false;
    }
  }

  /**
   * Per-field refresh decision for the content-aware gate. Returns one of
   * "freeze" | "refresh" | "adopt".
   *
   *   - anything isFrozenSource rejects → "freeze". That is the runtime freeze
   *                                   floor (human-owned states, read from the
   *                                   write stage) PLUS forward-safety: any
   *                                   unrecognised non-null source freezes too.
   *   - "ai-generated" / "algo-generated" / "original"
   *                                 → "refresh" (machine-owned prose, this
   *                                   writer's own algorithmic output, and
   *                                   source-imported raw <smiles> — all three
   *                                   safe to regenerate)
   *   - null / undefined            → unreliable (a fresh build OR a
   *                                   reset-after-reload). Fall back to the slot
   *                                   content: prose → "adopt" the human edit;
   *                                   raw <smiles> or empty → "refresh".
   *
   * The freeze list is deliberately NOT enumerated here — it is whatever the
   * runtime floor says, and a copy in this doc block is exactly how the three
   * decision sites drifted apart in the first place.
   *
   * For alt (isAlt true) a raw-<smiles> slot is NOT prose. For long (isAlt
   * false) any non-empty slot is prose — an appendix body is never a SMILES tag.
   *
   * @param {string|null|undefined} source - The field's `*Source` value.
   * @param {string} slotContent - The current working-document slot content.
   * @param {boolean} isAlt - True for the alt field, false for long.
   * @returns {"freeze"|"refresh"|"adopt"}
   */
  function classifyField(source, slotContent, isAlt) {
    if (isFrozenSource(source)) return "freeze";

    // Everything non-null that survives the predicate is machine-refreshable —
    // forward-safety already froze anything unrecognised, so no tail is needed.
    if (source != null) return "refresh";

    // null/undefined keep the content-check: adopt human prose, else refresh.
    const trimmed = typeof slotContent === "string" ? slotContent.trim() : "";
    const hasProse =
      trimmed !== "" && (isAlt ? !isRawSmilesSlot(slotContent) : true);
    return hasProse ? "adopt" : "refresh";
  }

  // ==========================================================================
  // Public: writeChemistryDescriptions
  // ==========================================================================

  /**
   * Generate accessible chemistry descriptions for every chemistry image in a
   * registry and write them back through the registry's provenance-aware
   * setters. This is the generation half of the two-host write flow; the
   * manager-open and export hosts call it in a later pass.
   *
   * C-P3 content-aware gate: a localStorage-autosave reload rebuilds the
   * registry via buildFromMMD, which resets a chemistry field's `*Source` to
   * null and its value to "", so the provenance stamp is unreliable post-reload.
   * Each field's refresh decision is therefore taken by `classifyField` from
   * (a) the reliable source states and (b) the current WORKING-document slot
   * (`workingMmd`):
   *   - "freeze"  → leave the field untouched (a reliable human edit);
   *   - "refresh" → (re)generate machine prose and stamp `algo-generated`;
   *   - "adopt"   → copy the slot's human prose INTO the registry and stamp
   *                 `ai-reviewed`. Adopting (never leaving the field empty) is
   *                 what stops the forward writer — which has no empty-target
   *                 guard — from erasing the prose on propagation.
   *
   * For each registry image whose `originalUrl` appears in the pristine MMD's
   * URL→SMILES map:
   *   - reuse the matching chemistryData entry's PubChem data when present, else
   *     degrade to graph-only prose (no PubChem, no throw);
   *   - when (and only when) some field needs a refresh, prime the RDKit graph
   *     cache via renderStructureToBlob and generate the SHORT (alt) and
   *     COMPREHENSIVE-HTML (long) tiers, retrying once on a cold-RDKit empty
   *     return (mirrors mathpix-result-renderer.js's idiom);
   *   - ALT: adopt the slot prose (`ai-reviewed`), or refresh with SHORT (or the
   *     generic "Chemical structure diagram" fallback when undrawable, the
   *     locked product decision), or freeze;
   *   - LONG: adopt the appendix slot prose (`ai-reviewed`), or refresh with the
   *     converted comprehensive Markdown (only when non-empty), or freeze;
   *   - TEXT-IN-IMAGE has no MMD home, so it is gated on source ALONE: written
   *     as the SMILES (`algo-generated`) unless the source is `user`/`ai-reviewed`.
   *
   * Pass-1 neutrality: when `workingMmd` is absent both slot maps are empty, so
   * a null-source field sees no prose and a chemistry slot classifies as
   * "refresh" — preserving the pre-C-P3 behaviour until the hosts thread
   * `workingMmd` through in Pass 2.
   *
   * The chemistry utils are looked up fresh inside the routine so a test can
   * stub the generators on window.MathPixChemistryUtils.
   *
   * @param {Object} args
   * @param {Object} args.registry - MathPixImageRegistry instance.
   * @param {string} args.pristineMmd - Pristine MMD (CDN URLs) for URL→SMILES keying.
   * @param {string} [args.workingMmd] - Working MMD (currentMMD) whose alt /
   *   appendix slots drive the content-aware gate. Omit for Pass-1 neutrality.
   * @param {Array<Object>} [args.chemistryData] - _chemistryData entries.
   * @returns {Promise<{total:number, results:Array<Object>}>}
   */
  async function writeChemistryDescriptions({
    registry,
    pristineMmd,
    workingMmd,
    chemistryData,
  }) {
    const utils = window.MathPixChemistryUtils;
    const urlToSmiles = buildUrlToSmilesMap(pristineMmd);
    // Pass-1 neutral when no working MMD is supplied: both maps stay empty, so
    // a null-source field has no prose and classifies as "refresh".
    const altByUrl = workingMmd ? extractWorkingAltByUrl(workingMmd) : new Map();
    const longById = workingMmd ? extractWorkingLongById(workingMmd) : new Map();
    const data = Array.isArray(chemistryData) ? chemistryData : [];
    const results = [];

    const images = registry.getAllImages();
    for (const img of images) {
      const smiles = urlToSmiles.get(img.originalUrl);
      if (!smiles) continue; // not a chemistry image

      const item = data.find((e) => e && e.notation === smiles);
      const pubchem = item ? utils._buildPubchemDataFromItem(item) : null;

      // Per-field decisions from reliable source + current working slot.
      const altSlot = altByUrl.get(img.originalUrl) ?? "";
      const longSlot = longById.get(img.id) ?? "";
      const altDecision = classifyField(img.altTextSource, altSlot, true);
      const longDecision = classifyField(
        img.longDescriptionSource,
        longSlot,
        false,
      );

      const res = {
        id: img.id,
        smiles,
        altWritten: false,
        longWritten: false,
        textWritten: false,
        titleWritten: false,
        altAdopted: false,
        longAdopted: false,
        graphOnly: false,
        fallback: false,
      };

      // Generate machine prose only when a field actually needs a refresh —
      // adopt / freeze paths never touch RDKit.
      const needGenerate =
        altDecision === "refresh" || longDecision === "refresh";
      let short = "";
      let html = "";
      if (needGenerate) {
        await utils.renderStructureToBlob(smiles);
        short = utils.generateShortDescription(smiles, pubchem);
        html = utils.generateComprehensiveDescriptionHTML(smiles, pubchem);

        // One retry — the cold-RDKit idiom (mirrors mathpix-result-renderer.js):
        // the first prime can return with the graph cache still warming, leaving
        // the synchronous generators empty.
        if (!short) {
          await utils.renderStructureToBlob(smiles);
          short = utils.generateShortDescription(smiles, pubchem);
          html = utils.generateComprehensiveDescriptionHTML(smiles, pubchem);
        }
      }

      // ---- ALT ----
      if (altDecision === "adopt") {
        // Adopt the human slot prose so propagation no-ops instead of erasing.
        registry.updateAltText(img.id, altSlot, "ai-reviewed");
        res.altWritten = true;
        res.altAdopted = true;
      } else if (altDecision === "refresh") {
        if (short) {
          registry.updateAltText(img.id, short, "algo-generated");
          res.altWritten = true;
          res.graphOnly = !pubchem;
        } else {
          // Undrawable → generic alt fallback (locked product decision).
          registry.updateAltText(
            img.id,
            "Chemical structure diagram",
            "algo-generated",
          );
          res.altWritten = true;
          res.fallback = true;
          logWarn(
            "writeChemistryDescriptions: structure not drawable, wrote generic alt",
            { id: img.id, smiles },
          );
        }
      } // "freeze" → no write

      // ---- LONG ----
      if (longDecision === "adopt") {
        registry.updateLongDescription(img.id, longSlot, "ai-reviewed");
        res.longWritten = true;
        res.longAdopted = true;
      } else if (longDecision === "refresh" && short) {
        const long =
          window.MathPixChemistryRegistryWriter.internals.comprehensiveHtmlToAppendixMarkdown(
            html,
          );
        if (long) {
          registry.updateLongDescription(img.id, long, "algo-generated");
          res.longWritten = true;
        }
      } // "freeze", or "refresh" with no drawable structure → no write

      // ---- TEXT-IN-IMAGE (no MMD home → source gate only) ----
      // Gated on the runtime freeze floor, via the shared predicate. This gate
      // previously tested the source inline against a narrower list, so an
      // "ai-edited" correction was replaced with raw SMILES here.
      if (isFrozenSource(img.textInImageSource)) {
        // Frozen by the floor (or by forward-safety) — leave it.
      } else {
        registry.updateTextInImage(img.id, smiles, "algo-generated");
        res.textWritten = true;
      }

      // ---- TITLE / CAPTION (C-P5: synthesise into an empty title only) ----
      // Fills an empty caption from PubChem name and formula. Never overwrites an
      // existing caption — a real caption from the source document, or a prior
      // synthesis — and freezes any title the floor protects. Writes nothing when
      // the helper returns null (no name and no formula). Needs no RDKit.
      const titleFrozen = isFrozenSource(img.titleSource);
      const titleEmpty = !(img.title && img.title.trim());
      if (titleEmpty && !titleFrozen) {
        const caption = utils.generateChemistryCaption(pubchem);
        if (caption) {
          registry.updateTitle(img.id, caption, "algo-generated");
          res.titleWritten = true;
        }
      }

      results.push(res);
    }

    const written = results.filter(
      (r) => r.altWritten || r.longWritten || r.textWritten || r.titleWritten,
    ).length;
    const adopted = results.filter((r) => r.altAdopted || r.longAdopted).length;
    const fallbacks = results.filter((r) => r.fallback).length;
    logInfo(
      "writeChemistryDescriptions: " +
        results.length +
        " chemistry image(s), " +
        written +
        " wrote a field, " +
        adopted +
        " adopted a human slot, " +
        fallbacks +
        " fallback",
    );

    return { total: results.length, results };
  }

  // ==========================================================================
  // Global exposure
  // ==========================================================================

  window.MathPixChemistryRegistryWriter = {
    writeChemistryDescriptions,
    internals: {
      comprehensiveHtmlToAppendixMarkdown,
      isRefreshable,
      isFrozenSource,
      classifyField,
      buildUrlToSmilesMap,
      extractWorkingAltByUrl,
      extractWorkingLongById,
      isRawSmilesSlot,
    },
  };

  logInfo("MathPixChemistryRegistryWriter initialised");
})();
