// music-pdf-markup.js
// The pure PDF document builder for the Accessible Music proof of concept.
//
// A PURE STRING SERVICE, the document half of the PDF feature: it turns a bar
// count into deterministic pagination breaks, injects those breaks into a COPY
// of the MusicXML, and builds the Typst 0.14 source for the multi-page tagged
// document. It owns no DOM, loads no dependency and never throws on its happy
// path. The orchestrator (js/music-pdf.js, Stage 16) drives Verovio, rasterises
// each page and compiles via typst.ts; this module only produces document
// SOURCE — strings — so every part of it runs and self-tests under node with no
// browser. Its only collaborator is logging. The proven internals (the <print>
// injection, the multi-page markup body, the Typst escaping and the %PDF magic
// check) are lifted verbatim from the Phase 4 and 5 spikes, since removed,
// narrowed to the validated norm; the record of what those spikes established is
// music-poc/docs/poc-plan-phase-4.md and poc-plan-phase-5.md.
// Exposed as globalThis.MusicPdfMarkup.

const MusicPdfMarkup = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The pagination profiles, keyed by profile name. Each profile now carries only
  // barsPerSystem: since Stage 31 switched Verovio to breaks:"line" it paginates
  // pages itself and ignores encoded page breaks, so this module injects only
  // SYSTEM breaks and no longer stores a systemsPerPage or derives a barsPerPage.
  // Standard is the engraving norm the 135-bar render validated (see "What the
  // Stage 18 spike settled" in music-poc/docs/poc-plan-phase-5.md, which records
  // five bars per system and about three pages on that fixture; the spike's own
  // HANDOVER went with the spike folders, and the norm RANGE it quoted, roughly
  // four to six bars per line and eight to ten lines per page, is no longer
  // recorded anywhere, so five is preserved as a validated value rather than as
  // a derivation);
  // the spike hand-picked systemEvery=5 for one fixture, but this module derives
  // systemEvery from barsPerSystem instead, since it takes any uploaded score.
  const PAGINATION_PROFILES = {
    // standard: the engraving norm the 135-bar render validated. Five bars to a
    // system.
    standard: { barsPerSystem: 5 },
    // large-print: a narrower Verovio page (set in the engraving profile in
    // js/music-pdf.js) takes fewer bars per system. The profile name threads in
    // from generate(model, xml, profile) in the orchestrator.
    //
    // CORRECTED AT STAGE 89. This said "two not three, because three bars on a
    // page this narrow over-compresses horizontally, which Verovio warns about
    // below a 0.8 justification ratio", and that reads as though 2 avoids a
    // warning 3 would cause. It does not. Measured on Satie (47 bars, two
    // staves) across the four bar counts at four staff sizes, counting Verovio's
    // own "Justification is highly compressed" lines per run:
    //   at the shipped 12.80 mm staff — 1 bar: 38 warnings, 2 bars: 22,
    //     3 bars: 15, 4 bars: 11, worst ratio 0.757 down to 0.696
    //   at a 9.97 mm staff — 0 warnings at ALL FOUR bar counts
    //   at a 6.98 mm staff — 0 warnings at ALL FOUR bar counts
    // So COMPRESSION IS CAUSED BY STAFF SIZE, NOT BY BAR COUNT. At 12.80 mm
    // essentially every system is compressed whatever the bar count, and raising
    // bars per system lowers the warning COUNT only because it lowers the SYSTEM
    // count. At 10 mm and below every combination is clean. The zero readings are
    // interpretable because the same detector fired 22 and 23 times on the two
    // largest sizes in the same sweep — a positive canary, not a silent instrument.
    //
    // Two therefore stays as the SHIPPED CHOICE, not as a necessity: it is the
    // value the 135-bar render was validated at and the value every recorded
    // page count refers to, and nothing measured argues against it. Nothing
    // measured argues for it over three either, so a future bars-per-system
    // control should offer the range rather than defend this number.
    "large-print": { barsPerSystem: 2 },
  };
  const DEFAULT_PROFILE = "standard";

  // resolvePagination(profile) → the { barsPerSystem } object for a profile name,
  // with the absent and unknown cases kept distinct:
  //   - profile undefined or empty: the documented default, standard, with NO
  //     warning (an absent profile is the supported "just give me standard" call).
  //   - profile an unknown string: warn that it is unknown and falling back, then
  //     return standard so the builder still produces a usable document.
  // The caller reads barsPerSystem to space the system breaks; there is no
  // page-size factor, because Verovio owns page breaks (breaks:"line") since
  // Stage 31.
  //
  // IT RETURNS THE SHARED BLOCK ITSELF, not a copy — every caller must copy before
  // merging anything onto it. That is not a defect to fix here: the entry is read
  // by every call and copying on the way out would allocate on a path that only
  // reads. Stage 90 is where it starts to matter, and withEncodedBreaks does the
  // copying at the one place a merge happens.
  function resolvePagination(profile) {
    if (!profile) {
      return PAGINATION_PROFILES[DEFAULT_PROFILE];
    }
    const found = PAGINATION_PROFILES[profile];
    if (!found) {
      logWarn(
        "withEncodedBreaks: unknown pagination profile, falling back to standard",
        { profile }
      );
      return PAGINATION_PROFILES[DEFAULT_PROFILE];
    }
    return found;
  }

  // unknownOverrideKeys / acceptedOverrides — the Stage 90 key filter, in the two
  // halves a caller needs: the names to warn about, and a fresh object carrying
  // only what survived. Both PURE, both node-runnable.
  //
  // DELIBERATELY DUPLICATED from js/music-pdf.js rather than shared. This module
  // is loadable and self-testable under node with NOTHING else present — that is
  // the property its whole "attach to globalThis" comment exists to protect — and
  // reaching into a sibling for six lines would trade it away. The two copies are
  // filtering different allowed sets over different shapes; they are the same
  // algorithm, not the same decision.
  function unknownOverrideKeys(overrides, allowed) {
    if (!overrides) return [];
    const unknown = [];
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i++) {
      if (allowed.indexOf(keys[i]) === -1) unknown.push(keys[i]);
    }
    return unknown;
  }

  function acceptedOverrides(overrides, allowed) {
    const accepted = {};
    if (!overrides) return accepted;
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i++) {
      if (allowed.indexOf(keys[i]) !== -1) accepted[keys[i]] = overrides[keys[i]];
    }
    return accepted;
  }

  // withEncodedBreaks(xml, barCount, profile, overrides): inject MusicXML <print>
  // SYSTEM breaks into a COPY of the score so Verovio lays each line out to the validated
  // norm, deterministically. The original string is never mutated — strings are
  // immutable and replace returns a fresh copy — so the summary and the attachment
  // keep the untouched author's notation. Injection mechanism lifted from the
  // spike; the one explicit argument it took (systemEvery) is replaced by a value
  // derived from the resolved profile. The profile threads in from
  // generate(model, xml, profile) in the orchestrator; an absent profile resolves
  // to standard, so a two-argument call still produces exactly today's standard
  // output.
  //   - <print new-system="yes"/> forces a new system (line) at that measure.
  // Since Stage 31 Verovio runs with breaks:"line": it paginates PAGES itself and
  // ignores any encoded page break, so this module injects only system breaks and
  // no longer computes page boundaries. barCount is retained in the signature for
  // the caller's sake but is no longer read.
  //
  // Incoming <print> new-system and new-page breaks are STRIPPED FIRST, so the
  // file's own breaks cannot collide with the profile's. A score that arrives
  // already carrying hand-authored line/page breaks (Satie, Palestrina and the
  // like commonly do) would otherwise force Verovio to honour both sets at once,
  // fragmenting the profile's deterministic pagination. The strip removes only
  // the break ATTRIBUTES (new-system, new-page) and any <print> those attributes
  // left empty; a <print> carrying layout children (a system-layout, say) keeps
  // them, losing only its break attribute. Because both new-system and new-page
  // appear only on <print> in MusicXML, the attribute-level strip touches nothing
  // else. The original string is still never mutated — the strip and the
  // injection each return a fresh copy.
  //
  // STAGE 90 adds an optional fourth argument, overrides, merged over the resolved
  // profile's pagination. Its allowed key set is DERIVED — the keys the resolved
  // entry already carries — so there is no hand-kept list here and no clause that
  // could go inert; any other key is dropped with a warn naming it. Absent or empty
  // overrides produce a byte-identical output string, and that is asserted on the
  // whole document rather than assumed. The orchestrator only ever passes a
  // non-null value at the
  // large-print profile (see profileOverridesFrom in js/music-pdf.js), so the
  // standard document cannot be reached through this argument.
  function withEncodedBreaks(xml, barCount, profile, overrides) {
    // barCount is retained for the caller's signature but no longer read: Verovio
    // owns page breaks (breaks:"line") since Stage 31, so this module injects only
    // system breaks and never computes a page boundary from the bar count.
    //
    // THE RESOLVED ENTRY IS COPIED BEFORE ANYTHING IS MERGED ONTO IT.
    // resolvePagination hands back the PAGINATION_PROFILES entry itself, so
    // merging in place would write this module's own block and every later call —
    // including one for the other profile — would inherit an override from a
    // single earlier call. Object.assign's first term is a fresh {}; the block is
    // read as the second term and never assigned into.
    const resolved = resolvePagination(profile);
    const allowed = Object.keys(resolved);
    const unknown = unknownOverrideKeys(overrides, allowed);
    if (unknown.length) {
      logWarn(
        "withEncodedBreaks: dropping unknown pagination override key(s)",
        { keys: unknown }
      );
    }
    const pagination = Object.assign({}, resolved, acceptedOverrides(overrides, allowed));
    const systemEvery = pagination.barsPerSystem;
    const resolvedProfile =
      profile && PAGINATION_PROFILES[profile] ? profile : DEFAULT_PROFILE;
    logDebug("withEncodedBreaks", {
      barCount,
      profile: resolvedProfile,
      systemEvery,
    });
    // Strip the file's own break directives before injecting the profile's:
    // drop the break attributes, then any <print> they left empty. Pure string
    // work on a fresh copy; the profile below then paginates from a clean slate.
    const cleaned = String(xml)
      .replace(/\s+new-system=(["'])[^"']*\1/g, "")
      .replace(/\s+new-page=(["'])[^"']*\1/g, "")
      .replace(/<print\s*\/>/g, "")
      .replace(/<print>\s*<\/print>/g, "");
    return cleaned.replace(
      /<measure\b[^>]*\bnumber="(\d+)"[^>]*>/g,
      function (openTag, num) {
        const n = parseInt(num, 10);
        if (n > 1 && (n - 1) % systemEvery === 0) {
          return openTag + '<print new-system="yes"/>';
        }
        return openTag;
      }
    );
  }

  // escapeTypstString — make a value safe inside a Typst "…" string literal.
  // Backslash first, then double-quote (order matters). Private to the module;
  // exercised through buildMultiPageMarkup in the selfTest. Lifted verbatim.
  function escapeTypstString(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // escapeTypstAlt — the ONE escaping route for a page image's alt text, whether
  // that alt is the positional default this module generates or an override the
  // orchestrator composed from the piece summary. Since Stage 82 an alt can carry
  // arbitrary prose from a user's own score (its title, its lyrics, its dynamics),
  // so it is no longer the run of digits the default was.
  //
  // WHAT ACTUALLY NEEDS ESCAPING, and what does not. The alt sits inside a Typst
  // "…" STRING LITERAL, not in markup, so the characters that are special in Typst
  // markup are ordinary text here: #, [, ], *, _, @ and % all pass through verbatim
  // and MUST NOT be escaped — escaping them would put literal backslashes into the
  // spoken alt. Only two characters can end or reinterpret the literal itself:
  //   - the double quote, which would close it early;
  //   - the backslash, which would start an escape sequence of its own.
  // Backslash is replaced FIRST, so the backslashes this function introduces are
  // not themselves re-escaped.
  //
  // CR and LF are additionally folded to their escape sequences. That is
  // PRECAUTIONARY rather than measured: a raw newline inside the one-line
  // image(…) call would at minimum break the generated markup's line structure,
  // and nothing in the pipeline needs a literal newline in an alt. The summary
  // arrives as one joined line, so this branch does not fire on the real path.
  //
  // Private to the module and exercised THROUGH buildMultiPageMarkup in the
  // selfTest, following escapeTypstString's precedent: a row that patched the
  // function directly would prove the escaping and not that the builder uses it.
  function escapeTypstAlt(alt) {
    return String(alt)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  // pageAltFor(index, pageCount) → the positional default alt for a page image,
  // "Score, page N of M", from a ZERO-based index. PUBLIC because the orchestrator
  // needs the very same wording when it composes a level-2 override: the summary
  // alt is this string, then ". ", then the summary prose, so the page identity
  // survives in front of the description. Exporting it keeps ONE source for that
  // wording — a second copy in js/music-pdf.js would drift the moment either is
  // reworded, and nothing would fail.
  function pageAltFor(index, pageCount) {
    return "Score, page " + (index + 1) + " of " + pageCount;
  }

  // The appendix's own heading. A CONSTANT rather than a literal at the point of
  // use, so the selfTest asserts against the same string the builder emits.
  const APPENDIX_HEADING = "Appendix: the note list";

  // The document title's heading level. Named rather than written at the point of
  // use so the relationship below is stated once: the appendix's levels are chosen
  // RELATIVE to this one, and moving the title without moving them would produce
  // either two h1s or a gap in the heading sequence.
  const TITLE_HEADING_LEVEL = 1;

  // The heading levels the appendix uses. The document title is already a level-1
  // heading, so the appendix sits at level 2 and each block — a part, or a merged
  // keyboard pair — at level 3. That keeps ONE h1 in the tagged PDF and makes the
  // appendix a sibling section of the score rather than a second document title.
  const APPENDIX_HEADING_LEVEL = 2;
  const APPENDIX_BLOCK_HEADING_LEVEL = 3;

  // buildAppendixMarkup(outline, opts) → Typst source for the talking-score
  // appendix, or "" when there is nothing to emit. PURE STRING WORK: it takes the
  // plain-data outline MusicRenderText.outlineOf returns and never touches a DOM,
  // so it runs and self-tests under node like the rest of this module.
  //
  // WHY CODE MODE, and why every string is a "…" LITERAL. Typst has two contexts.
  // In MARKUP, characters such as #, *, _, $, <, >, @, [, ] and ~ are live, and a
  // line STARTING with -, +, = or a digit-then-dot begins a list or a heading. The
  // appendix carries the engraver's own words — lyrics, rehearsal marks, part names
  // — so any of those can appear anywhere, and none of them is under our control.
  // Emitting the appendix in CODE mode puts every one of those strings inside a
  // "…" string literal, where only the double quote and the backslash are special
  // and escapeTypstString — the escaper this module has always had, and the one
  // that is genuinely correct for that context — handles both.
  //
  // This was MEASURED before it was chosen, not assumed. A spike compiled the same
  // content twice, once in markup syntax and once in code mode, and the two PDFs'
  // structure trees were byte-identical: the same /H1, /H2, /L, /LI, /Lbl and
  // /LBody elements, in the same order, hashing the same. So code mode costs
  // NOTHING in tagging and buys the whole escaping problem away.
  //
  // WHAT THIS DELIBERATELY DID NOT DO, AND WHO CLOSED IT. Stage 84 left the
  // summary body and the document title emitted as MARKUP and escaped with
  // escapeTypstString — the wrong escaper for that context — because fixing it
  // would have moved the level-1 and level-2 documents that stage's whole gate
  // needed byte-identical. STAGE 92 took that fix: both now emit in code mode,
  // through this same route, so there is one escaping context in this whole module
  // and escapeTypstString is correct everywhere it is called.
  //
  // A null, empty or malformed outline emits "" rather than throwing or emitting a
  // bare heading. The caller then produces exactly the document it would have
  // produced with no appendix at all, which is the degradation the orchestrator
  // relies on.
  function buildAppendixMarkup(outline, opts) {
    const o = opts || {};
    const headingText = typeof o.heading === "string" && o.heading.trim() ? o.heading : APPENDIX_HEADING;

    // Guard: anything that is not an object carrying a blocks ARRAY means "no
    // appendix". This covers null, undefined, a string, a number and a stray
    // object, so a malformed outline is never a special case downstream.
    if (!outline || typeof outline !== "object" || !Array.isArray(outline.blocks)) return "";

    const lit = function (s) { return '"' + escapeTypstString(s) + '"'; };

    // One outline item → one enum.item carrying a plain string literal.
    const itemsSource = function (items, indent) {
      const list = Array.isArray(items) ? items : [];
      const usable = list.filter(function (it) { return it && typeof it.text === "string"; });
      if (!usable.length) return null;
      const lines = [indent + "#enum("];
      for (const item of usable) {
        lines.push(indent + "  enum.item(" + lit(item.text) + "),");
      }
      lines.push(indent + ")");
      return lines.join("\n");
    };

    // One group → an enum.item whose body is the group heading followed by that
    // group's own enum. The heading is a string literal inside a content block, so
    // it is still escaped for the literal context and never for markup.
    const groupsSource = function (groups, indent) {
      const list = Array.isArray(groups) ? groups : [];
      const usable = list.filter(function (g) { return g && typeof g.heading === "string"; });
      if (!usable.length) return null;
      const lines = [indent + "#enum("];
      for (const group of usable) {
        const inner = itemsSource(group.items, indent + "    ");
        if (inner === null) {
          lines.push(indent + "  enum.item(" + lit(group.heading) + "),");
        } else {
          lines.push(indent + "  enum.item([#" + lit(group.heading) + " ");
          lines.push(inner);
          lines.push(indent + "  ]),");
        }
      }
      lines.push(indent + ")");
      return lines.join("\n");
    };

    const blocks = [];
    for (const block of outline.blocks) {
      if (!block || typeof block.heading !== "string" || !Array.isArray(block.bars)) continue;
      const barLines = [];
      for (const bar of block.bars) {
        if (!bar || typeof bar.label !== "string") continue;

        // Exactly one of groups and items is populated in a well-formed outline,
        // and groups wins if both somehow are, so the emitted shape can never
        // depend on which was checked first.
        const nested =
          groupsSource(bar.groups, "      ") || itemsSource(bar.items, "      ");

        if (nested === null) {
          // A bar with no content at all: the label alone, no empty sub-list.
          barLines.push("  enum.item(" + lit(bar.label) + "),");
        } else {
          barLines.push("  enum.item([#" + lit(bar.label) + " ");
          barLines.push(nested);
          barLines.push("  ]),");
        }
      }
      blocks.push({ heading: block.heading, barLines: barLines });
    }

    // Every block was malformed, or the outline carried none: emit nothing.
    if (!blocks.length) return "";

    const lines = [];
    lines.push("#pagebreak()");
    lines.push("#heading(level: " + APPENDIX_HEADING_LEVEL + ", " + lit(headingText) + ")");
    lines.push("");
    for (const block of blocks) {
      lines.push("#heading(level: " + APPENDIX_BLOCK_HEADING_LEVEL + ", " + lit(block.heading) + ")");
      if (block.barLines.length) {
        lines.push("#enum(");
        for (const line of block.barLines) lines.push(line);
        lines.push(")");
      }
      lines.push("");
    }

    const markup = lines.join("\n");
    logDebug("buildAppendixMarkup produced markup", {
      length: markup.length,
      blocks: blocks.length,
    });
    return markup;
  }

  // buildMultiPageMarkup({ title, lang, summaryText, pageImagePaths, attachments,
  //   pageAlts, outline }) → Typst 0.14 source for a genuine multi-page tagged PDF.
  //   Body lifted verbatim from the spike.
  //
  // Since Stage 84 the caller may also supply `outline`, the plain-data note-list
  // outline from MusicRenderText.outlineOf, which appends the talking-score
  // appendix between the last page figure and the attachments. An absent, null or
  // malformed outline emits NOTHING, so a caller that does not pass one gets the
  // byte-for-byte document this builder produced before that stage.
  //
  // Structure: the document title (#set document), the text language (#set text,
  // which drives the PDF /Lang), a fixed A4 page matching the A4 SVGs Verovio
  // paginated onto, the honest summary placed ONCE as a normal paragraph (real
  // tagged text, not alt text), one score image per page as a #figure with a
  // SHORT alt "Score, page N of M" separated by #pagebreak() between pages but
  // NOT after the last, and one #pdf.attach per attachment.
  //
  // WHY the summary is REAL TEXT and the page images carry only SHORT alts:
  // the long human-readable description belongs in the PDF as ACTUAL TAGGED TEXT,
  // authored once. A screen reader then reads it as text — selectable, navigable,
  // reflowable, translatable — and reads it exactly ONCE. If instead we baked the
  // full summary into every page image's alt attribute, a screen-reader user
  // paging through the score would hear the entire description repeated on every
  // single page, which is worse, not better. So each page IMAGE gets only a terse
  // positional alt ("Score, page N of M") that says what the picture is and where
  // the reader is, while the meaning lives once in the real text above. (The full
  // MusicXML is additionally attached for non-visual reconstruction.)
  //
  // THE DEFAULT ABOVE IS STILL THE DEFAULT. Since Stage 82 the caller may supply
  // pageAlts, a per-page array of alt OVERRIDES, and the level-2 orchestrator uses
  // it to put the whole-piece summary on page 1 ONLY — every later page keeps the
  // terse positional default, so the repetition the paragraph above warns about
  // still cannot happen. An entry that is absent, null, a non-string or blank
  // falls through to the generated default, so a short array, a sparse one and no
  // array at all all behave identically: level 1 produces byte-for-byte today's
  // document.
  //
  // ESCAPING: title, lang, summaryText and every path go through
  // escapeTypstString. EVERY alt — the generated defaults included, not only the
  // overrides — goes through escapeTypstAlt, so there is one route and no way to
  // add a page-alt path that misses it. The defaults are unchanged by that, being
  // words and digits with nothing to escape.
  //
  // SINCE STAGE 92 THERE IS ONLY ONE ESCAPING CONTEXT IN THIS BUILDER, and that is
  // what makes the sentence above true rather than merely tidy. Until then the
  // visible title and the summary were emitted as Typst MARKUP — a bare "= …"
  // heading line and a bare paragraph line — while still being run through
  // escapeTypstString, the escaper for a "…" string LITERAL. The two contexts want
  // opposite things, so the mismatch cut both ways: #, *, _, $, <, >, @, [, ] and ~
  // in a score's own title or summary reached the document as LIVE markup and were
  // interpreted, a line beginning -, +, = or a digit-then-dot silently became a
  // list or a heading, and a backslash arrived doubled and rendered literally.
  // Both now emit in CODE MODE — #heading(level: 1, "…") and #par("…") — which is
  // the route Stage 84's appendix already uses and Stage 84's spike already
  // MEASURED to cost nothing in tagging (the same content compiled as markup and
  // as code mode produced byte-identical structure trees). A second markup-context
  // escaper was the alternative and was rejected: it would have had to be complete
  // against every Typst metacharacter, and a miss in it is silent, where a string
  // literal has exactly two special characters and escapeTypstString has always
  // handled both.
  //
  // THE COST, STATED: the emitted MARKUP is no longer byte-identical to the
  // pre-Stage-92 document, so the level-1 and level-2 markup baselines were re-cut
  // at that stage. The selfTest therefore asserts on the string content the heading
  // and the paragraph CARRY, not on markup bytes, which differ by design.
  //
  // THE COMPILED PDF, HOWEVER, IS BYTE-IDENTICAL — measured, not argued. Both
  // builders were run against the same compiler on the same page, and Satie at
  // levels 1, 2 and 3, Satie large-print and Joplin at level 1 all produced the
  // same SHA-256 within a single creation second. On the two-second Joplin
  // talking-score compile the runs straddle a second, and every differing byte was
  // then enumerated: all of them sit inside /CreationDate, /ModDate,
  // xmp:CreateDate, xmp:ModifyDate, xmpMM:InstanceID, xmpMM:DocumentID or /ID. So
  // Stage 84's spike finding — code mode costs nothing in tagging — holds at the
  // whole-document level, not merely at the structure tree.
  function buildMultiPageMarkup(opts) {
    const o = opts || {};
    const title = o.title || "Untitled score";
    const lang = o.lang || "en";
    const summaryText = o.summaryText ? String(o.summaryText) : "";
    const pageImagePaths = Array.isArray(o.pageImagePaths) ? o.pageImagePaths : [];
    const attachments = Array.isArray(o.attachments) ? o.attachments : [];
    // Anything that is not an array — absent, null, a stray object — means "no
    // overrides", which is the level-1 path and must not be a special case below.
    const pageAlts = Array.isArray(o.pageAlts) ? o.pageAlts : [];
    // Stage 84: the OPTIONAL talking-score appendix. Absent, null or malformed
    // means no appendix, and the emitted document is then byte-for-byte the one
    // this builder produced before this stage — which is what keeps the level-1
    // and level-2 comparison baselines usable.
    const appendix = buildAppendixMarkup(o.outline);

    const pageCount = pageImagePaths.length;
    const lines = [];

    lines.push('#set document(title: "' + escapeTypstString(title) + '")');
    lines.push('#set text(lang: "' + escapeTypstString(lang) + '")');
    /* Fixed A4 page — the score SVGs were paginated to A4 by Verovio. */
    lines.push('#set page(paper: "a4")');
    lines.push("");

    /* Title as a level-1 heading (real text), then the honest summary as a
     * normal paragraph (real text). Authored once; read once.
     *
     * CODE MODE since Stage 92 — see the ESCAPING note above for why. Both carry
     * their text as a "…" string literal, where escapeTypstString is the correct
     * and complete escaper, rather than as a markup line where the engraver's own
     * words would be interpreted. */
    lines.push(
      "#heading(level: " +
        TITLE_HEADING_LEVEL +
        ', "' +
        escapeTypstString(title) +
        '")'
    );
    lines.push("");
    if (summaryText.trim()) {
      lines.push('#par("' + escapeTypstString(summaryText.trim()) + '")');
      lines.push("");
    }

    /* One image per page, each with a short positional alt. #pagebreak() between
     * pages, never after the last. */
    for (let i = 0; i < pageCount; i++) {
      const path = pageImagePaths[i];
      // An override only wins when it is a non-blank string; everything else
      // (absent, null, a number, whitespace) falls back to the positional
      // default, so a caller cannot accidentally ship an image with no alt.
      const override = pageAlts[i];
      const alt =
        typeof override === "string" && override.trim()
          ? override
          : pageAltFor(i, pageCount);
      lines.push("#figure(");
      lines.push(
        '  image("' +
          escapeTypstString(path) +
          '", alt: "' +
          escapeTypstAlt(alt) +
          '", width: 100%),'
      );
      lines.push(")");
      if (i < pageCount - 1) {
        lines.push("#pagebreak()");
      }
      lines.push("");
    }

    /* Stage 84: the talking-score appendix, between the last page figure and the
     * attachments. It carries its OWN #pagebreak(), because the figure loop above
     * deliberately omits one after the last page; without it the appendix heading
     * would land on the same page as the final score image. Nothing inside the
     * appendix breaks pages explicitly — Typst flows and paginates the list itself,
     * and manual breaks would fight the layout engine and orphan bar headings.
     * An empty string here leaves the document exactly as it was. */
    if (appendix) {
      lines.push(appendix);
      lines.push("");
    }

    /* Real file attachments via #pdf.attach (Typst 0.14). Each produces an
     * embedded file the viewer can browse and extract, which is what keeps
     * "attached as MusicXML" honest. */
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i] || {};
      if (!a.path) continue;
      lines.push("#pdf.attach(");
      lines.push('  "' + escapeTypstString(a.path) + '",');
      if (a.relationship)
        lines.push('  relationship: "' + escapeTypstString(a.relationship) + '",');
      if (a.mimeType)
        lines.push('  mime-type: "' + escapeTypstString(a.mimeType) + '",');
      if (a.description)
        lines.push('  description: "' + escapeTypstString(a.description) + '",');
      lines.push(")");
      lines.push("");
    }

    const markup = lines.join("\n");
    logDebug("buildMultiPageMarkup produced markup", {
      length: markup.length,
      pageCount: pageCount,
      attachments: attachments.length,
      altOverrides: pageAlts.length,
    });
    return markup;
  }

  // pdfMagicOk(bytes) — true when the bytes begin with the ASCII signature
  // "%PDF". Guards null or empty input. Lifted verbatim from the spike.
  function pdfMagicOk(pdfBytes) {
    if (!pdfBytes || typeof pdfBytes.length !== "number" || pdfBytes.length < 4) {
      return false;
    }
    return (
      pdfBytes[0] === 0x25 &&
      pdfBytes[1] === 0x50 &&
      pdfBytes[2] === 0x44 &&
      pdfBytes[3] === 0x46
    );
  }

  // Self-test: synchronous and self-contained; needs no browser and no
  // dependency. Builds a results object, console.table()s it and returns it.
  function selfTest() {
    // makeScore(n): a minimal well-formed score-partwise with n measures, each
    // shaped <measure number="i">…</measure> so the injection regex finds them.
    function makeScore(n) {
      let measures = "";
      for (let i = 1; i <= n; i++) {
        measures +=
          '<measure number="' +
          i +
          '"><note><pitch><step>C</step><octave>4</octave></pitch>' +
          "<duration>4</duration><type>quarter</type></note></measure>";
      }
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        '<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>' +
        '<part id="P1">' +
        measures +
        "</part></score-partwise>"
      );
    }

    // makeScoreWithPrints(n, systemBars, pageBars): the same n-measure score as
    // makeScore, but carrying the file's OWN break directives — a
    // <print new-page="yes"/> at the start of each measure in pageBars, else a
    // <print new-system="yes"/> at the start of each measure in systemBars (page
    // wins where a bar is in both). This is the shape an uploaded Satie or
    // Palestrina score arrives in, and lets the strip be proven: after
    // withEncodedBreaks the file's breaks must contribute nothing.
    function makeScoreWithPrints(n, systemBars, pageBars) {
      const sys = systemBars || [];
      const pg = pageBars || [];
      let measures = "";
      for (let i = 1; i <= n; i++) {
        let printEl = "";
        if (pg.indexOf(i) !== -1) {
          printEl = '<print new-page="yes"/>';
        } else if (sys.indexOf(i) !== -1) {
          printEl = '<print new-system="yes"/>';
        }
        measures +=
          '<measure number="' +
          i +
          '">' +
          printEl +
          "<note><pitch><step>C</step><octave>4</octave></pitch>" +
          "<duration>4</duration><type>quarter</type></note></measure>";
      }
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0">' +
        '<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>' +
        '<part id="P1">' +
        measures +
        "</part></score-partwise>"
      );
    }

    // Count non-overlapping occurrences of needle in haystack.
    function countOf(haystack, needle) {
      if (!needle) return 0;
      let count = 0;
      let idx = 0;
      while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        count += 1;
        idx += needle.length;
      }
      return count;
    }

    const score135 = makeScore(135);
    const broke135 = withEncodedBreaks(score135, 135);

    const markup3 = buildMultiPageMarkup({
      title: "Test score",
      lang: "en",
      summaryText: "A short honest summary of the piece.",
      pageImagePaths: ["/assets/p1.png", "/assets/p2.png", "/assets/p3.png"],
      attachments: [
        { path: "/assets/score.musicxml", mimeType: "application/vnd.recordare.musicxml+xml" },
      ],
    });
    const markup2Attach = buildMultiPageMarkup({
      title: "Two attachments",
      pageImagePaths: ["/assets/p1.png"],
      attachments: [{ path: "/assets/a.musicxml" }, { path: "/assets/b.mid" }],
    });
    const escapedMarkup = buildMultiPageMarkup({
      title: 'Bad "quote" \\slash',
      pageImagePaths: ["/assets/p1.png"],
    });

    // Stage 82: per-page alt overrides. markup3 above passes NO pageAlts, so the
    // existing altPage1Of3/2Of3/3Of3 rows are themselves the level-1 regression
    // check — they read the generated defaults through the new override branch.
    const THREE_PAGES = ["/assets/p1.png", "/assets/p2.png", "/assets/p3.png"];
    // Built from the same options as markup3 with pageAlts explicitly null: an
    // absent array and a null one must produce the identical document.
    const markup3NullAlts = buildMultiPageMarkup({
      title: "Test score",
      lang: "en",
      summaryText: "A short honest summary of the piece.",
      pageImagePaths: THREE_PAGES,
      attachments: [
        { path: "/assets/score.musicxml", mimeType: "application/vnd.recordare.musicxml+xml" },
      ],
      pageAlts: null,
    });
    // The level-2 shape: page 1 overridden, later pages left to the default.
    const SUMMARY_ALT = "Score, page 1 of 3. This piece has 1 part across 2 bars.";
    const markupOverride = buildMultiPageMarkup({
      title: "Override",
      pageImagePaths: THREE_PAGES,
      pageAlts: [SUMMARY_ALT, null, null],
    });
    // Every rejected override shape in one document, one per page: a blank string,
    // a whitespace-only string, and a non-string. All three must fall back.
    const markupRejected = buildMultiPageMarkup({
      title: "Rejected overrides",
      pageImagePaths: THREE_PAGES,
      pageAlts: ["", "   ", 42],
    });
    // A SHORT array: page 1 overridden, pages 2 and 3 have no entry at all.
    const markupShortArray = buildMultiPageMarkup({
      title: "Short array",
      pageImagePaths: THREE_PAGES,
      pageAlts: ["Only the first"],
    });
    // Hostile alt text, one string carrying every character that could matter.
    // The quote and the backslash MUST be escaped; the hash, the brackets, the
    // asterisk, the underscore, the at-sign and the percent are ordinary inside a
    // Typst string literal and must arrive VERBATIM — escaping them would speak
    // stray backslashes to a screen-reader user.
    const HOSTILE_ALT = 'A "quoted" \\ back #hash [bracket] *star* _under_ @at 100%';
    const markupHostile = buildMultiPageMarkup({
      title: "Hostile",
      pageImagePaths: ["/assets/p1.png"],
      pageAlts: [HOSTILE_ALT],
    });
    const markupNewlineAlt = buildMultiPageMarkup({
      title: "Newline",
      pageImagePaths: ["/assets/p1.png"],
      pageAlts: ["Line one\r\nline two"],
    });

    // Stage 19: the pagination profile threaded through withEncodedBreaks. The
    // standard rows above call it with no profile argument and stay byte-for-byte
    // identical; these prove an absent profile defaults to standard, an unknown
    // one warns and falls back, and the large-print profile breaks more densely.
    const standardBroke135 = withEncodedBreaks(score135, 135, "standard");
    const unknownBroke135 = withEncodedBreaks(score135, 135, "nonsense");

    const lpBroke8 = withEncodedBreaks(makeScore(8), 8, "large-print");

    const score20 = makeScore(20);
    const lpBroke20 = withEncodedBreaks(score20, 20, "large-print");
    const stdBroke20 = withEncodedBreaks(score20, 20);

    // ---- Stage 90 (the pagination override seam) ----
    //
    // The shared block is snapshotted BEFORE any override call, so the no-mutation
    // row reads a genuine before-and-after. This is the mutation the copy-before-
    // merge in withEncodedBreaks exists to prevent: without it, the first override
    // call below would write PAGINATION_PROFILES["large-print"] and every later
    // call in this very selfTest — including the standard-profile rows — would
    // engrave from a block one earlier call had edited.
    const PAGINATION_BEFORE = JSON.stringify(PAGINATION_PROFILES);
    const lpNoOverride = withEncodedBreaks(score20, 20, "large-print", undefined);
    const lpEmptyOverride = withEncodedBreaks(score20, 20, "large-print", {});
    // barsPerSystem 5 IS the standard profile's value, so a correctly applied
    // override must make the large-print output byte-identical to the standard
    // one. A stronger row than any count: it compares two whole documents.
    const lpOverriddenToFive = withEncodedBreaks(score20, 20, "large-print", { barsPerSystem: 5 });
    const lpUnknownOverride = withEncodedBreaks(score20, 20, "large-print", { bogusKey: 99 });
    const lpMixedOverride = withEncodedBreaks(score20, 20, "large-print", {
      barsPerSystem: 5,
      bogusKey: 99,
    });
    const PAGINATION_AFTER = JSON.stringify(PAGINATION_PROFILES);
    const stdAfterOverrides = withEncodedBreaks(score20, 20, "standard");

    // Phase 4 (Stage 4.1 / 4.2a): strip the file's own <print> breaks before
    // injecting the profile's, so an uploaded score's hand-authored breaks cannot
    // collide with the deterministic pagination. A 135-bar Satie-like score
    // carrying system breaks at 7, 13, 19, 30, 35, 40, 45 and a page break at 25
    // must, once run through withEncodedBreaks, produce EXACTLY the SYSTEM-break
    // count of the clean makeScore(135) — the file breaks contribute zero. (Page
    // breaks are no longer injected at all since Stage 31: Verovio owns them.)
    const satie135 = makeScoreWithPrints(
      135,
      [7, 13, 19, 30, 35, 40, 45],
      [25]
    );
    const satieStd = withEncodedBreaks(satie135, 135);
    const satieLp = withEncodedBreaks(satie135, 135, "large-print");

    // Clean baseline for the system-break count (broke135 is the clean standard
    // output).
    const cleanStd135NewSystem = countOf(broke135, 'new-system="yes"');
    const satieStdNewSystem = countOf(satieStd, 'new-system="yes"');

    // A <print> carrying a system-layout child must survive the strip with its
    // layout children intact and only its break attribute removed. Measure 1 is
    // never a profile boundary, so nothing is injected there — any remaining
    // new-system on this print would mean the strip missed it.
    const layoutScore =
      '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">' +
      '<part id="P1"><measure number="1">' +
      '<print new-system="yes"><system-layout><system-distance>100</system-distance></system-layout></print>' +
      "<note><pitch><step>C</step><octave>4</octave></pitch>" +
      "<duration>4</duration><type>quarter</type></note></measure>" +
      "</part></score-partwise>";
    const layoutBroke = withEncodedBreaks(layoutScore, 1);

    // No empty <print> may remain after the strip, in either profile's output.
    function hasEmptyPrint(s) {
      return (
        countOf(s, "<print/>") > 0 ||
        countOf(s, "<print />") > 0 ||
        countOf(s, "<print></print>") > 0
      );
    }

    // ---- Stage 84 (the talking-score appendix) ----
    //
    // Fixtures shaped exactly as MusicRenderText.outlineOf returns them, so these
    // rows exercise the real contract and not a convenient approximation.

    // Built from char codes rather than typed, so the escaping rows below cannot
    // be quietly weakened by this file's own source passing through a shell or an
    // editor that rewrites an escape sequence.
    const BACKSLASH_CHAR = String.fromCharCode(92);
    const DQUOTE_CHAR = String.fromCharCode(34);

    // Depth 2: a single-staff part, events straight off the bar.
    const OUTLINE_DEPTH2 = {
      blocks: [
        {
          heading: "Melody",
          bars: [
            { label: "Bar 1", groups: [], items: [{ text: "C4 crotchet", notes: null },
                                                  { text: "D4 crotchet", notes: null }] },
            { label: "Bar 2", groups: [], items: [{ text: "E4 minim", notes: null }] },
          ],
        },
      ],
    };

    // Depth 3: a two-staff part, events under one group per staff.
    const OUTLINE_DEPTH3 = {
      blocks: [
        {
          heading: "Piano",
          bars: [
            {
              label: "Bar 1",
              items: [],
              groups: [
                { heading: "Treble staff", items: [{ text: "G4 crotchet", notes: null }] },
                { heading: "Bass staff", items: [{ text: "C3 crotchet", notes: null }] },
              ],
            },
          ],
        },
      ],
    };

    // Every character that is live in Typst MARKUP but inert inside a "…" literal,
    // plus the two that are live inside the literal (the double quote and the
    // backslash), plus the line-initial list and heading markers. If the appendix
    // ever reached a markup context, this string is what would break it.
    const HOSTILE =
      'Hash # star * under _ dollar $ lt < gt > at @ bracket [ ] tilde ~ ' +
      "backslash " + String.fromCharCode(92) + " quote " + String.fromCharCode(34) +
      " dash -- slash // comment /* apostrophe ' ";
    const OUTLINE_HOSTILE = {
      blocks: [
        {
          heading: HOSTILE + "heading",
          bars: [
            {
              label: HOSTILE + "label",
              items: [],
              groups: [
                { heading: HOSTILE + "group", items: [{ text: HOSTILE + "item", notes: null }] },
              ],
            },
          ],
        },
      ],
    };

    const appendixDepth2 = buildAppendixMarkup(OUTLINE_DEPTH2);
    const appendixDepth3 = buildAppendixMarkup(OUTLINE_DEPTH3);
    const appendixHostile = buildAppendixMarkup(OUTLINE_HOSTILE);

    // The byte-identity control: the SAME builder call, once with no outline and
    // once with each falsy or malformed outline. Every one must produce the
    // document the builder produced before Stage 84.
    const APPENDIX_DOC_ARGS = {
      title: "Doc",
      lang: "en",
      summaryText: "A summary.",
      pageImagePaths: ["/assets/page-1.svg", "/assets/page-2.svg"],
      attachments: [{ path: "/assets/score.musicxml", mimeType: "text/xml", description: "Src.", relationship: "source" }],
    };
    const docNoOutline = buildMultiPageMarkup(APPENDIX_DOC_ARGS);
    const docWithOutline = buildMultiPageMarkup(
      Object.assign({}, APPENDIX_DOC_ARGS, { outline: OUTLINE_DEPTH2 })
    );
    const malformedOutlines = [
      null, undefined, "", 0, false, {}, { blocks: null }, { blocks: [] },
      { blocks: [null] }, { blocks: [{ heading: 5, bars: [] }] },
      { blocks: [{ heading: "H" }] }, "not an outline", 42, [],
    ];
    const everyMalformedEmitsNothing = malformedOutlines.every(function (bad) {
      return buildAppendixMarkup(bad) === "";
    });
    const everyMalformedDocIsIdentical = malformedOutlines.every(function (bad) {
      return buildMultiPageMarkup(Object.assign({}, APPENDIX_DOC_ARGS, { outline: bad })) === docNoOutline;
    });

    // Where the appendix sits in the assembled document: after the last figure,
    // before the first attachment.
    const idxLastFigure = docWithOutline.lastIndexOf('image("/assets/page-2.svg"');
    const idxAppendix = docWithOutline.indexOf("#heading(level: 2,");
    const idxAttach = docWithOutline.indexOf("#pdf.attach(");

    // ---- Stage 92 (the markup-context escaping fix) ----
    //
    // The document title and the summary now emit in CODE MODE, on the same route
    // the appendix has used since Stage 84. These fixtures reuse HOSTILE — the
    // always-special and sequence-special set grounded at that stage — and add a
    // LINE-START-SPECIAL prefix to each, because that class is the one a bare
    // markup line turns into a list or a heading and no character-by-character
    // check would catch. A title beginning "3." and a summary beginning "- " are
    // exactly the shapes a real edition's title page and a generated summary can
    // take, so neither prefix is contrived.
    const MARKUP_TITLE = "3. " + HOSTILE + "title";
    const MARKUP_SUMMARY = "- " + HOSTILE + "summary";
    const markupContextDoc = buildMultiPageMarkup({
      title: MARKUP_TITLE,
      summaryText: MARKUP_SUMMARY,
      pageImagePaths: ["/assets/p1.png"],
    });

    // readTypstLiteralAfter(source, opener) → the value of the Typst "…" string
    // literal that begins immediately after `opener`, with its escapes RESOLVED,
    // or null when the opener is absent or the literal is unterminated.
    //
    // WHY A SCANNER AND NOT A REGEX. The claim these rows make is that the string
    // the builder was given is the string a Typst parser will recover. A regex
    // ending at the first double quote stops at an ESCAPED one too, so a hostile
    // value would be silently truncated and the row would then compare one
    // truncation against another and PASS. Walking the literal the way the parser
    // does — a backslash consumes the next character, an unescaped quote ends it —
    // is the only reading that can fail in the direction the rows care about.
    //
    // It is an INSTRUMENT, so it carries its own canary row below rather than
    // being trusted: a scanner that always returned the same value would satisfy
    // every round-trip row on this list.
    function readTypstLiteralAfter(source, opener) {
      const at = source.indexOf(opener);
      if (at === -1) return null;
      let i = at + opener.length;
      let out = "";
      while (i < source.length) {
        const ch = source.charAt(i);
        if (ch === BACKSLASH_CHAR) {
          i += 1;
          if (i >= source.length) return null;
          out += source.charAt(i);
          i += 1;
          continue;
        }
        if (ch === DQUOTE_CHAR) return out;
        out += ch;
        i += 1;
      }
      return null;
    }

    const TITLE_OPENER = "#heading(level: " + TITLE_HEADING_LEVEL + ', "';
    const SUMMARY_OPENER = '#par("';

    // The line-start constructs a bare markup line would have created. Applied to
    // EVERY line of the assembled hostile document, not only the two that changed:
    // the claim is about the document, and a fix that moved the problem elsewhere
    // would satisfy a narrower row.
    const startsWithMarkupConstruct = function (line) {
      const t = line.trim();
      return /^[-+=]\s/.test(t) || /^\d+\.\s/.test(t) || /^\/\s/.test(t);
    };

    const results = {
      hasWithEncodedBreaks: typeof withEncodedBreaks === "function",
      hasBuildMultiPageMarkup: typeof buildMultiPageMarkup === "function",
      hasPdfMagicOk: typeof pdfMagicOk === "function",
      hasSelfTest: typeof selfTest === "function",

      // ---- Stage 84 (the talking-score appendix) ----
      hasBuildAppendixMarkup: typeof buildAppendixMarkup === "function",

      // NOTHING IS EMITTED for a null, empty or malformed outline, and — the row
      // that actually protects the levels-1-and-2 baselines — the assembled
      // document is then BYTE-IDENTICAL to the one built with no outline at all.
      // Thirteen malformed shapes are swept, so a guard that caught only null
      // cannot pass.
      appendixNullOutlineEmitsNothing: buildAppendixMarkup(null) === "",
      appendixEmptyBlocksEmitsNothing: buildAppendixMarkup({ blocks: [] }) === "",
      appendixMalformedOutlinesAllEmitNothing: everyMalformedEmitsNothing,
      appendixAbsentOutlineDocumentUnchanged:
        buildMultiPageMarkup(Object.assign({}, APPENDIX_DOC_ARGS)) === docNoOutline,
      appendixMalformedOutlineDocumentsByteIdentical: everyMalformedDocIsIdentical,
      // The positive canary for the four rows above: a GOOD outline must change
      // the document. Without this, a buildAppendixMarkup that returned "" for
      // everything would satisfy every identity row on this list.
      appendixGoodOutlineChangesDocument: docWithOutline !== docNoOutline,

      // The heading, at the levels this module documents: the appendix at 2 (the
      // document title already holds level 1) and each block at 3.
      appendixEmitsItsHeading:
        appendixDepth2.indexOf('#heading(level: 2, "Appendix: the note list")') !== -1,
      appendixBlockHeadingIsLevel3:
        appendixDepth2.indexOf('#heading(level: 3, "Melody")') !== -1,
      appendixHeadingConstantMatchesEmitted:
        appendixDepth2.indexOf('#heading(level: 2, "' + APPENDIX_HEADING + '")') !== -1,

      // Exactly ONE #pagebreak(), and it precedes the heading. The figure loop
      // omits a break after the last page, so without this the appendix would
      // start on the final score page; more than one would leave a blank page.
      appendixPagebreakAppearsExactlyOnce: countOf(appendixDepth2, "#pagebreak()") === 1,
      appendixPagebreakPrecedesHeading:
        appendixDepth2.indexOf("#pagebreak()") < appendixDepth2.indexOf("#heading(level: 2,"),
      appendixPagebreakIsFirstLine: appendixDepth2.split("\n")[0] === "#pagebreak()",

      // DEPTH 2: events hang straight off the bar — one #enum of bars, each
      // carrying one #enum of items, and no group heading anywhere.
      appendixDepth2EmitsBarsAndItems:
        appendixDepth2.indexOf('enum.item([#"Bar 1" ') !== -1 &&
        appendixDepth2.indexOf('enum.item("C4 crotchet"),') !== -1 &&
        appendixDepth2.indexOf('enum.item("D4 crotchet"),') !== -1 &&
        appendixDepth2.indexOf('enum.item([#"Bar 2" ') !== -1,
      // One bars enum plus one items enum per bar: 1 + 2 = 3, and NO group enum.
      appendixDepth2EnumCount: countOf(appendixDepth2, "#enum(") === 3,
      appendixDepth2HasNoGroupHeadings:
        appendixDepth2.indexOf("staff") === -1 && appendixDepth2.indexOf("voice") === -1,

      // DEPTH 3: the group heading appears BETWEEN the bar and its items, giving
      // three nesting levels. Both shapes must emit, since the three real scores
      // between them use both.
      appendixDepth3EmitsGroupHeadings:
        appendixDepth3.indexOf('enum.item([#"Bar 1" ') !== -1 &&
        appendixDepth3.indexOf('enum.item([#"Treble staff" ') !== -1 &&
        appendixDepth3.indexOf('enum.item([#"Bass staff" ') !== -1 &&
        appendixDepth3.indexOf('enum.item("G4 crotchet"),') !== -1,
      // One bars enum, one groups enum, and one items enum per group: 1 + 1 + 2 = 4.
      // The extra level against depth 2 is the whole difference between the shapes.
      appendixDepth3EnumCount: countOf(appendixDepth3, "#enum(") === 4,
      appendixBothShapesEmit: appendixDepth2.length > 0 && appendixDepth3.length > 0,

      // HOSTILE STRINGS round-trip through the literal escaper. Every character
      // that is live in Typst MARKUP must arrive VERBATIM and UNESCAPED, because
      // it is inert inside a "…" literal and escaping it would put a backslash
      // into the reader's text; the two that are live inside the literal — the
      // double quote and the backslash — must arrive ESCAPED. The rows check the
      // heading, the bar label and the item text separately, because each reaches
      // the escaper down a different path.
      appendixHostileMarkupCharsPassThroughVerbatim: (function () {
        const inert = ["#", "*", "_", "$", "<", ">", "@", "[", "]", "~", "--", "//", "/*", "'"];
        return inert.every(function (ch) {
          return appendixHostile.indexOf(ch) !== -1 &&
            appendixHostile.indexOf(BACKSLASH_CHAR + ch) === -1;
        });
      })(),
      appendixHostileQuoteIsEscaped:
        appendixHostile.indexOf(BACKSLASH_CHAR + DQUOTE_CHAR) !== -1,
      appendixHostileBackslashIsDoubled:
        appendixHostile.indexOf(BACKSLASH_CHAR + BACKSLASH_CHAR) !== -1,
      appendixHostileHeadingRoundTrips:
        appendixHostile.indexOf('#heading(level: 3, "' + escapeTypstString(HOSTILE + "heading") + '")') !== -1,
      appendixHostileLabelRoundTrips:
        appendixHostile.indexOf('enum.item([#"' + escapeTypstString(HOSTILE + "label") + '" ') !== -1,
      appendixHostileGroupRoundTrips:
        appendixHostile.indexOf('enum.item([#"' + escapeTypstString(HOSTILE + "group") + '" ') !== -1,
      appendixHostileItemRoundTrips:
        appendixHostile.indexOf('enum.item("' + escapeTypstString(HOSTILE + "item") + '"),') !== -1,
      // No line in the appendix may BEGIN with a Typst markup construct, which is
      // what a code-mode emitter guarantees and a markup one cannot.
      appendixNoLineStartsWithMarkupConstruct: appendixHostile.split("\n").every(function (line) {
        const t = line.trim();
        return !/^[-+=]\s/.test(t) && !/^\d+\.\s/.test(t) && !/^\/\s/.test(t);
      }),

      // PLACEMENT: after the last page figure, before the first attachment.
      appendixSitsAfterLastFigure: idxLastFigure !== -1 && idxAppendix > idxLastFigure,
      appendixSitsBeforeAttachments: idxAttach !== -1 && idxAppendix < idxAttach,
      appendixDocumentKeepsAllFigures:
        countOf(docWithOutline, "#figure(") === countOf(docNoOutline, "#figure(") &&
        countOf(docWithOutline, "#figure(") === 2,
      appendixDocumentKeepsAttachment:
        countOf(docWithOutline, "#pdf.attach(") === 1,

      // ---- Stage 90 (the pagination override seam) ----
      hasPaginationOverrideSeam: withEncodedBreaks.length === 4,

      // ABSENT AND EMPTY OVERRIDES PRODUCE THE BYTE-IDENTICAL STRING. The whole
      // output document is compared, not a break count, so a change anywhere in
      // the injected markup would redden this. The undefined and {} routes are
      // separate rows because they take different branches through the filter.
      paginationAbsentOverrideIdentical: lpNoOverride === lpBroke20,
      paginationEmptyOverrideIdentical: lpEmptyOverride === lpBroke20,
      paginationNullOverrideIdentical:
        withEncodedBreaks(score20, 20, "large-print", null) === lpBroke20,

      // A KNOWN KEY IS APPLIED. Large-print at barsPerSystem 5 must produce the
      // document standard produces, since 5 is standard's own value — and the two
      // profiles must genuinely differ without the override, or the row could pass
      // on two identical profiles.
      paginationKnownKeyApplied: lpOverriddenToFive === stdBroke20,
      paginationProfilesDifferWithoutOverride: lpBroke20 !== stdBroke20,

      // AN UNKNOWN KEY IS DROPPED, and named in the list the warn is built from.
      // The mixed object proves the drop is per-key, not per-call: the known half
      // still lands while the unknown half goes.
      paginationUnknownKeyNamedForWarn:
        unknownOverrideKeys({ bogusKey: 99 }, ["barsPerSystem"]).join(",") === "bogusKey",
      paginationKnownKeyNotNamedForWarn:
        unknownOverrideKeys({ barsPerSystem: 5 }, ["barsPerSystem"]).length === 0,
      paginationUnknownKeyDropped: lpUnknownOverride === lpBroke20,
      paginationMixedKeepsKnownDropsUnknown: lpMixedOverride === stdBroke20,

      // THE SHARED BLOCK IS NEVER WRITTEN — the copy-before-merge. Read before the
      // override calls and again after them; the large-print entry's own value is
      // asserted at its literal 2 as well, and a standard-profile document built
      // AFTER all the override calls is compared against one built before them, so
      // a leaked mutation would have to survive three different checks.
      paginationBlockUnmutated: PAGINATION_BEFORE === PAGINATION_AFTER,
      paginationLargePrintEntryStillTwo:
        PAGINATION_PROFILES["large-print"].barsPerSystem === 2,
      paginationStandardUnaffectedByEarlierOverride: stdAfterOverrides === stdBroke20,

      systemBreakInMeasure6:
        broke135.indexOf('<measure number="6"><print new-system="yes"/>') !== -1,

      // Verovio owns page breaks (breaks:"line") since Stage 31, so
      // withEncodedBreaks must inject NO new-page in either profile's output.
      standardInjectsNoPageBreak: countOf(broke135, 'new-page="yes"') === 0,
      largePrintInjectsNoPageBreak: countOf(lpBroke20, 'new-page="yes"') === 0,

      inputXmlUnchanged: score135 === makeScore(135),

      threeFigures: countOf(markup3, "#figure(") === 3,
      twoPageBreaksInMarkup: countOf(markup3, "#pagebreak()") === 2,
      summaryOnce: countOf(markup3, "A short honest summary of the piece.") === 1,
      altPage1Of3: markup3.indexOf("Score, page 1 of 3") !== -1,
      altPage2Of3: markup3.indexOf("Score, page 2 of 3") !== -1,
      altPage3Of3: markup3.indexOf("Score, page 3 of 3") !== -1,

      oneAttachForOneEntry: countOf(markup3, "#pdf.attach(") === 1,
      twoAttachForTwoEntries: countOf(markup2Attach, "#pdf.attach(") === 2,

      titleEscapedSafely:
        escapedMarkup.indexOf('#set document(title: "Bad \\"quote\\" \\\\slash")') !== -1,

      pdfMagicTrueOnPdf: pdfMagicOk([0x25, 0x50, 0x44, 0x46, 0x2d]) === true,
      pdfMagicFalseOnNonPdf: pdfMagicOk([0x00, 0x01, 0x02, 0x03]) === false,
      pdfMagicFalseOnNull: pdfMagicOk(null) === false,
      pdfMagicFalseOnEmpty: pdfMagicOk([]) === false,

      // Stage 19: pagination profile and its fallback behaviour.
      absentMatchesStandard: broke135 === standardBroke135,
      unknownFallsBackToStandard: unknownBroke135 === broke135,
      largePrintSystemBreakAt3:
        lpBroke8.indexOf('<measure number="3"><print new-system="yes"/>') !== -1,
      largePrintDenserThanStandard:
        countOf(lpBroke20, "<print ") > countOf(stdBroke20, "<print "),

      // Phase 4 (Stage 4.1 / 4.2a): the file's own <print> breaks are stripped
      // before the profile's are injected, so they contribute zero.
      satieStdSystemCountMatchesClean:
        satieStdNewSystem === cleanStd135NewSystem,
      satieBar7SystemBreakStripped:
        satieStd.indexOf('<measure number="7"><print new-system="yes"/>') ===
        -1,
      satieNoEmptyPrintStandard: !hasEmptyPrint(satieStd),
      satieNoEmptyPrintLargePrint: !hasEmptyPrint(satieLp),
      layoutPrintChildSurvivesStrip:
        layoutBroke.indexOf(
          "<system-layout><system-distance>100</system-distance></system-layout>"
        ) !== -1 && layoutBroke.indexOf('new-system="yes"') === -1,

      // Stage 82: the positional default alt, now a named public function so the
      // orchestrator can compose "<default>. <summary>" without a second copy of
      // the wording.
      hasPageAltFor: typeof pageAltFor === "function",
      pageAltForIsZeroBased:
        pageAltFor(0, 3) === "Score, page 1 of 3" &&
        pageAltFor(2, 3) === "Score, page 3 of 3",
      // The builder must USE it, not merely export it beside a private copy — an
      // unshared wording is exactly what this row exists to stop.
      builderUsesPageAltFor:
        markup3.indexOf('alt: "' + pageAltFor(1, 3) + '"') !== -1,

      // Level 1 is untouched: an absent pageAlts and an explicit null produce the
      // identical document, byte for byte. The altPage1Of3/2Of3/3Of3 rows above
      // read markup3, which passes no pageAlts, so they are the other half of this.
      nullPageAltsMatchesAbsent: markup3NullAlts === markup3,

      // Level 2's shape: page 1 carries the composed summary alt, pages 2 and 3
      // keep the terse positional default, so nothing repeats.
      overrideAppliesToPage1:
        markupOverride.indexOf('alt: "' + SUMMARY_ALT + '"') !== -1,
      overrideLeavesLaterPagesDefault:
        markupOverride.indexOf('alt: "Score, page 2 of 3"') !== -1 &&
        markupOverride.indexOf('alt: "Score, page 3 of 3"') !== -1,
      // The summary must appear ONCE as an alt and ONCE as the real paragraph is a
      // separate claim; here: the override does not leak onto another page.
      overrideAppearsOnceOnly: countOf(markupOverride, SUMMARY_ALT) === 1,

      // Every rejected override shape falls back rather than shipping a blank alt.
      // Asserted per PAGE, so a fallback that fired for the wrong reason is visible.
      emptyStringOverrideFallsBack:
        markupRejected.indexOf('alt: "Score, page 1 of 3"') !== -1,
      whitespaceOverrideFallsBack:
        markupRejected.indexOf('alt: "Score, page 2 of 3"') !== -1,
      nonStringOverrideFallsBack:
        markupRejected.indexOf('alt: "Score, page 3 of 3"') !== -1 &&
        markupRejected.indexOf('alt: "42"') === -1,
      shortOverrideArrayLeavesRestDefault:
        markupShortArray.indexOf('alt: "Only the first"') !== -1 &&
        markupShortArray.indexOf('alt: "Score, page 2 of 3"') !== -1 &&
        markupShortArray.indexOf('alt: "Score, page 3 of 3"') !== -1,

      // The escaping function, exercised THROUGH the builder so the row proves the
      // builder uses it rather than proving the function in isolation. The quote
      // and the backslash are escaped…
      hostileAltEscapesQuoteAndBackslash:
        markupHostile.indexOf('A \\"quoted\\" \\\\ back') !== -1,
      // …and the Typst MARKUP metacharacters are NOT, because an alt is a string
      // literal and escaping them would speak backslashes aloud.
      hostileAltLeavesMarkupCharsVerbatim:
        markupHostile.indexOf("#hash [bracket] *star* _under_ @at 100%") !== -1 &&
        markupHostile.indexOf("\\#") === -1 &&
        markupHostile.indexOf("\\[") === -1,
      // The whole line is well-formed: one image(…) call whose alt literal opens
      // and closes exactly where it should, with the width argument still after it.
      hostileAltLineWellFormed:
        markupHostile.indexOf(
          '  image("/assets/p1.png", alt: "A \\"quoted\\" \\\\ back #hash [bracket] *star* _under_ @at 100%", width: 100%),'
        ) !== -1,
      // CR and LF are folded, so the one-line image(…) call stays one line.
      newlineAltFoldedToEscape:
        markupNewlineAlt.indexOf('alt: "Line one\\r\\nline two"') !== -1 &&
        markupNewlineAlt.indexOf("Line one\r\nline two") === -1,

      // ---- Stage 92 (the markup-context escaping fix) ----
      //
      // THE CONSTRUCTS. The title is a #heading call at the named level and the
      // summary a #par call, so neither text is in a markup context any more.
      titleEmitsCodeModeHeading: markupContextDoc.indexOf(TITLE_OPENER) !== -1,
      summaryEmitsCodeModePar: markupContextDoc.indexOf(SUMMARY_OPENER) !== -1,
      titleHeadingLevelMatchesConstant: TITLE_HEADING_LEVEL === 1,
      // The old constructs are GONE, not merely joined by the new ones. Without
      // this a builder emitting both would satisfy the two rows above.
      noBareMarkupHeadingLineRemains: markupContextDoc
        .split("\n")
        .every(function (line) {
          return line.indexOf("= ") !== 0;
        }),

      // THE ROUND TRIP, and the whole claim of the stage: what an escape-honouring
      // read of the emitted literal recovers is the string the builder was given,
      // character for character — the hash, the asterisk, the underscore, the
      // dollar, the angle brackets, the at-sign, the square brackets, the tilde,
      // the double dash, the double slash, the comment opener, the apostrophe, the
      // quote and the backslash all included.
      hostileTitleRoundTrips:
        readTypstLiteralAfter(markupContextDoc, TITLE_OPENER) === MARKUP_TITLE,
      hostileSummaryRoundTrips:
        readTypstLiteralAfter(markupContextDoc, SUMMARY_OPENER) === MARKUP_SUMMARY,
      // The scanner's own canary. It must recover DIFFERENT values from the two
      // literals and must return null for an opener that is not there — a scanner
      // returning one fixed value, or the same value for everything, would satisfy
      // both rows above while proving nothing.
      literalScannerDiscriminates:
        readTypstLiteralAfter(markupContextDoc, TITLE_OPENER) !==
          readTypstLiteralAfter(markupContextDoc, SUMMARY_OPENER) &&
        readTypstLiteralAfter(markupContextDoc, '#nosuchcall("') === null,
      // …and it must honour the escapes rather than stopping at the first quote it
      // meets. HOSTILE carries an embedded double quote, so a regex-style read
      // would truncate there; this row fails if the scanner ever degrades to that.
      // The `|| ""` is not defensive noise: an inversion that removes the heading
      // makes the scanner return null, and a row that THROWS takes the whole
      // selfTest down instead of reddening — which is exactly what it did the
      // first time this inversion was run.
      literalScannerHonoursEscapedQuote:
        (readTypstLiteralAfter(markupContextDoc, TITLE_OPENER) || "").indexOf(
          DQUOTE_CHAR
        ) !== -1,

      // INSIDE the literal the markup metacharacters arrive UNESCAPED. Escaping
      // them would be the mirror-image defect: literal backslashes rendered on the
      // page and spoken by a reader.
      //
      // Asserted on the RECOVERED VALUE, not on the emitted line. Reading the line
      // would let the construct answer for the content — `#heading(` and `#par("`
      // each carry a hash of their own, so a `#` check over the raw line passes
      // whether or not the score's title contains one.
      markupCharsUnescapedInsideLiterals: (function () {
        const inert = ["#", "*", "_", "$", "<", ">", "@", "[", "]", "~", "--", "//", "/*", "'"];
        const titleValue = readTypstLiteralAfter(markupContextDoc, TITLE_OPENER);
        const parValue = readTypstLiteralAfter(markupContextDoc, SUMMARY_OPENER);
        if (titleValue === null || parValue === null) return false;
        return inert.every(function (ch) {
          return titleValue.indexOf(ch) !== -1 && parValue.indexOf(ch) !== -1;
        });
      })(),
      // …while the two that ARE live inside a literal arrive escaped, which is
      // what keeps the emitted line parseable at all.
      markupContextQuoteEscapedAndBackslashDoubled:
        markupContextDoc.indexOf(BACKSLASH_CHAR + DQUOTE_CHAR) !== -1 &&
        markupContextDoc.indexOf(BACKSLASH_CHAR + BACKSLASH_CHAR) !== -1,

      // NO LINE of the assembled document begins with a Typst markup construct,
      // which is the line-start-special class: the title begins "3." and the
      // summary begins "- ", and before this stage each would have opened a list
      // or a heading. Asserted over the whole document, not the two changed lines.
      noDocumentLineStartsWithMarkupConstruct:
        markupContextDoc.split("\n").every(function (line) {
          return !startsWithMarkupConstruct(line);
        }),
      // The positive canary for the row above: the fixture really does carry the
      // two line-start constructs, so a builder that dropped the title and the
      // summary altogether could not pass it.
      markupContextFixtureCarriesLineStartConstructs:
        startsWithMarkupConstruct(MARKUP_TITLE) &&
        startsWithMarkupConstruct(MARKUP_SUMMARY),

      // A PLAIN title and summary reach the document UNCHANGED. Asserted on the
      // string content the heading and the paragraph carry, NOT on markup bytes —
      // the bytes moved by design at this stage, and comparing them would only
      // restate that. markup3 is the long-standing three-page fixture, so these
      // two rows read the same document the alt and figure rows above read.
      plainTitleContentUnchanged:
        readTypstLiteralAfter(markup3, TITLE_OPENER) === "Test score",
      plainSummaryContentUnchanged:
        readTypstLiteralAfter(markup3, SUMMARY_OPENER) ===
        "A short honest summary of the piece.",
      // The document-property title and the visible heading carry the SAME text by
      // construction rather than by coincidence — two literals, one source value.
      documentTitleAndHeadingAgree:
        readTypstLiteralAfter(markup3, '#set document(title: "') ===
        readTypstLiteralAfter(markup3, TITLE_OPENER),
    };

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicPdfMarkup selfTest verdict", results);
    return results;
  }

  return {
    withEncodedBreaks,
    buildMultiPageMarkup,
    buildAppendixMarkup,
    pageAltFor,
    pdfMagicOk,
    selfTest,
  };
})();

// Attach to globalThis (not window) deliberately: the builder is pure and owns
// no DOM, so reaching it via globalThis lets it self-test under node with no
// browser. In the browser globalThis IS window, so window.MusicPdfMarkup resolves
// unchanged.
globalThis.MusicPdfMarkup = MusicPdfMarkup;
