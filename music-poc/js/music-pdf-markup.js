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
// check) are lifted verbatim from the pdf-spike, narrowed to the validated norm.
// Exposed as globalThis.MusicPdfMarkup.

const MusicPdfMarkup = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The pagination profiles, keyed by profile name. Standard is the engraving
  // norm the 135-bar render validated (HANDOVER §14.4); the spike hand-picked
  // systemEvery=5 and pageAtMeasures=[46, 91] for one fixture, but this module
  // derives both from the bar count and the chosen profile instead, since it
  // takes any uploaded score. barsPerPage is never stored — it is always derived
  // as barsPerSystem * systemsPerPage in the resolver — so the two factors and
  // the page size cannot drift apart.
  const PAGINATION_PROFILES = {
    // standard: the engraving norm the 135-bar render validated. Five bars to a
    // system, nine systems to a page, so forty-five bars per page.
    standard: { barsPerSystem: 5, systemsPerPage: 9 },
    // large-print: a narrower Verovio page (set in the engraving profile in
    // js/music-pdf.js) needs fewer bars per system. Two bars per system, four
    // systems per page, so eight bars per page. Two not three, because three
    // bars on a page this narrow over-compresses horizontally, which Verovio
    // warns about below a 0.8 justification ratio. The profile name threads in
    // from generate(model, xml, profile) in the orchestrator.
    "large-print": { barsPerSystem: 2, systemsPerPage: 4 },
  };
  const DEFAULT_PROFILE = "standard";

  // resolvePagination(profile) → the { barsPerSystem, systemsPerPage } pair for a
  // profile name, with the absent and unknown cases kept distinct:
  //   - profile undefined or empty: the documented default, standard, with NO
  //     warning (an absent profile is the supported "just give me standard" call).
  //   - profile an unknown string: warn that it is unknown and falling back, then
  //     return standard so the builder still produces a usable document.
  // The caller derives barsPerPage as barsPerSystem * systemsPerPage; it is never
  // stored on the profile.
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

  // The page-break measure numbers for a score of barCount bars: every
  // 1 + barsPerPage * k that is still within the score. A 135-bar score under the
  // standard profile (barsPerPage 45) gives [46, 91] (k=3 would be 136, past the
  // end), matching the spike; the page count is this list's length plus one, which
  // equals ceil(barCount / barsPerPage). barsPerPage is passed in so the profile
  // chooses it; this function is private and only withEncodedBreaks calls it, so
  // taking it as a parameter is safe.
  function pageBreakMeasures(barCount, barsPerPage) {
    const breaks = [];
    for (let k = 1; 1 + barsPerPage * k <= barCount; k++) {
      breaks.push(1 + barsPerPage * k);
    }
    return breaks;
  }

  // withEncodedBreaks(xml, barCount, profile): inject MusicXML <print> breaks into
  // a COPY of the score so Verovio lays it out to the validated norm,
  // deterministically. The original string is never mutated — strings are
  // immutable and replace returns a fresh copy — so the summary and the attachment
  // keep the untouched author's notation. Injection mechanism lifted verbatim from
  // the spike; only the two explicit arguments it took (systemEvery,
  // pageAtMeasures) are replaced by values derived from the resolved profile. The
  // profile threads in from generate(model, xml, profile) in the orchestrator; an
  // absent profile resolves to standard, so a two-argument call still produces
  // exactly today's standard output. A page boundary wins over a coincident system
  // boundary (the early return), the spike's exact handling of a bar that is both.
  //   - <print new-page="yes"/>   forces a NEW PAGE at that measure.
  //   - <print new-system="yes"/> forces a new system (line) at that measure.
  // With breaks:"encoded" Verovio honours ONLY these, so no system overflows the
  // page width and no staff is cut at a boundary.
  function withEncodedBreaks(xml, barCount, profile) {
    const pagination = resolvePagination(profile);
    const barsPerPage = pagination.barsPerSystem * pagination.systemsPerPage;
    const pageAtMeasures = pageBreakMeasures(barCount, barsPerPage);
    const systemEvery = pagination.barsPerSystem;
    const resolvedProfile =
      profile && PAGINATION_PROFILES[profile] ? profile : DEFAULT_PROFILE;
    logDebug("withEncodedBreaks", {
      barCount,
      profile: resolvedProfile,
      pageAtMeasures,
      systemEvery,
    });
    return String(xml).replace(
      /<measure\b[^>]*\bnumber="(\d+)"[^>]*>/g,
      function (openTag, num) {
        const n = parseInt(num, 10);
        if (pageAtMeasures.indexOf(n) !== -1) {
          return openTag + '<print new-page="yes"/>';
        }
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

  // buildMultiPageMarkup({ title, lang, summaryText, pageImagePaths, attachments })
  //   → Typst 0.14 source for a genuine multi-page tagged PDF. Body lifted
  //   verbatim from the spike.
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
  // ESCAPING: title, lang, summaryText and every path are escaped here. The
  // per-page alt is GENERATED here from integers, so it contains no user data.
  function buildMultiPageMarkup(opts) {
    const o = opts || {};
    const title = o.title || "Untitled score";
    const lang = o.lang || "en";
    const summaryText = o.summaryText ? String(o.summaryText) : "";
    const pageImagePaths = Array.isArray(o.pageImagePaths) ? o.pageImagePaths : [];
    const attachments = Array.isArray(o.attachments) ? o.attachments : [];

    const pageCount = pageImagePaths.length;
    const lines = [];

    lines.push('#set document(title: "' + escapeTypstString(title) + '")');
    lines.push('#set text(lang: "' + escapeTypstString(lang) + '")');
    /* Fixed A4 page — the score SVGs were paginated to A4 by Verovio. */
    lines.push('#set page(paper: "a4")');
    lines.push("");

    /* Title as a level-1 heading (real text), then the honest summary as a
     * normal paragraph (real text). Authored once; read once. */
    lines.push("= " + escapeTypstString(title));
    lines.push("");
    if (summaryText.trim()) {
      lines.push(escapeTypstString(summaryText.trim()));
      lines.push("");
    }

    /* One image per page, each with a short positional alt. #pagebreak() between
     * pages, never after the last. */
    for (let i = 0; i < pageCount; i++) {
      const path = pageImagePaths[i];
      const alt = "Score, page " + (i + 1) + " of " + pageCount;
      lines.push("#figure(");
      lines.push(
        '  image("' +
          escapeTypstString(path) +
          '", alt: "' +
          escapeTypstString(alt) +
          '", width: 100%),'
      );
      lines.push(")");
      if (i < pageCount - 1) {
        lines.push("#pagebreak()");
      }
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
    const pb135 = countOf(broke135, 'new-page="yes"');

    const broke45 = withEncodedBreaks(makeScore(45), 45);
    const pb45 = countOf(broke45, 'new-page="yes"');
    const broke46 = withEncodedBreaks(makeScore(46), 46);
    const pb46 = countOf(broke46, 'new-page="yes"');

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

    // Stage 19: the pagination profile threaded through withEncodedBreaks. The
    // standard rows above call it with no profile argument and stay byte-for-byte
    // identical; these prove an absent profile defaults to standard, an unknown
    // one warns and falls back, and the large-print profile breaks more densely.
    const standardBroke135 = withEncodedBreaks(score135, 135, "standard");
    const unknownBroke135 = withEncodedBreaks(score135, 135, "nonsense");

    const lpBroke8 = withEncodedBreaks(makeScore(8), 8, "large-print");
    const lpBroke9 = withEncodedBreaks(makeScore(9), 9, "large-print");
    const lpPb8 = countOf(lpBroke8, 'new-page="yes"');
    const lpPb9 = countOf(lpBroke9, 'new-page="yes"');

    const score20 = makeScore(20);
    const lpBroke20 = withEncodedBreaks(score20, 20, "large-print");
    const stdBroke20 = withEncodedBreaks(score20, 20);

    const results = {
      hasWithEncodedBreaks: typeof withEncodedBreaks === "function",
      hasBuildMultiPageMarkup: typeof buildMultiPageMarkup === "function",
      hasPdfMagicOk: typeof pdfMagicOk === "function",
      hasSelfTest: typeof selfTest === "function",

      twoPageBreaksAt135: pb135 === 2,
      pageBreakInMeasure46:
        broke135.indexOf('<measure number="46"><print new-page="yes"/>') !== -1,
      pageBreakInMeasure91:
        broke135.indexOf('<measure number="91"><print new-page="yes"/>') !== -1,
      threePagesAt135: pb135 + 1 === 3,
      systemBreakInMeasure6:
        broke135.indexOf('<measure number="6"><print new-system="yes"/>') !== -1,

      noPageBreakAt45: pb45 === 0,
      onePageAt45: pb45 + 1 === 1,
      onePageBreakAt46: pb46 === 1,
      twoPagesAt46: pb46 + 1 === 2,
      pageBreakAt46Measure:
        broke46.indexOf('<measure number="46"><print new-page="yes"/>') !== -1,

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
      largePrintNoPageBreakAt8: lpPb8 === 0,
      largePrintOnePageBreakAt9:
        lpPb9 === 1 &&
        lpBroke9.indexOf('<measure number="9"><print new-page="yes"/>') !== -1,
      largePrintSystemBreakAt3:
        lpBroke8.indexOf('<measure number="3"><print new-system="yes"/>') !== -1,
      largePrintDenserThanStandard:
        countOf(lpBroke20, "<print ") > countOf(stdBroke20, "<print "),
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
    pdfMagicOk,
    selfTest,
  };
})();

// Attach to globalThis (not window) deliberately: the builder is pure and owns
// no DOM, so reaching it via globalThis lets it self-test under node with no
// browser. In the browser globalThis IS window, so window.MusicPdfMarkup resolves
// unchanged.
globalThis.MusicPdfMarkup = MusicPdfMarkup;
